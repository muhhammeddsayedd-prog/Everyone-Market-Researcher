import 'server-only';
import { mediaQueueMessage } from '@emr/shared';
import type { MediaOutcome, MediaPorts } from '../../../n8n/media/worker';
import type { WorkerPool } from './n8n-worker/database';
import { WorkerFailure } from './n8n-worker/errors';

export interface MediaBatchSummary {
  state: 'completed' | 'partial' | 'reconciliation_required';
  claimed: number;
  processed: number;
  held: number;
  stored: number;
  skipped: number;
  expired: number;
  retryable: number;
  reconciliation_required: number;
  bytes: number;
  infrastructure_cost_usd: null;
}
export interface MediaBatchClaim {
  replayed: boolean;
  state: 'running' | 'finished' | 'reconciliation_required';
  messages: unknown[];
  held_count: number;
  result?: MediaBatchSummary | null;
}
export interface MediaDatabaseSession {
  claim(signal?: AbortSignal): Promise<MediaBatchClaim>;
  targets: MediaPorts['targets'];
  save: MediaPorts['save'];
  record: MediaPorts['record'];
  ack: MediaPorts['ack'];
  finish(signal: AbortSignal): Promise<MediaBatchSummary>;
  close(): Promise<void>;
}

const bad = () => new WorkerFailure('outcome_unknown', 503);
const integer = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function parseMediaBatchSummary(value: unknown): MediaBatchSummary {
  const counts = [
    'claimed',
    'processed',
    'held',
    'stored',
    'skipped',
    'expired',
    'retryable',
    'reconciliation_required',
  ] as const;
  if (
    !object(value) ||
    Object.keys(value).length !== 11 ||
    !['completed', 'partial', 'reconciliation_required'].includes(String(value.state)) ||
    counts.some((k) => !integer(value[k], 50)) ||
    !integer(value.bytes, 100 * 1024 * 1024) ||
    value.infrastructure_cost_usd !== null
  )
    throw bad();
  const result = value as unknown as MediaBatchSummary;
  if (
    result.processed > result.claimed ||
    result.processed + result.held > result.claimed ||
    result.stored + result.skipped + result.expired + result.retryable + result.reconciliation_required !==
      result.processed
  )
    throw bad();
  return result;
}
function parseClaim(value: unknown): MediaBatchClaim {
  if (
    !object(value) ||
    typeof value.replayed !== 'boolean' ||
    !['running', 'finished', 'reconciliation_required'].includes(String(value.state)) ||
    !Array.isArray(value.messages) ||
    value.messages.length > 50 ||
    !integer(value.held_count, 50) ||
    Object.keys(value).some((k) => !['replayed', 'state', 'messages', 'held_count', 'result'].includes(k))
  )
    throw bad();
  const messages = value.messages.map((m) => mediaQueueMessage.parse(m));
  if (
    new Set(messages.map((m) => m.msg_id)).size !== messages.length ||
    messages.length + (value.held_count as number) > 50 ||
    (value.replayed && messages.length !== 0) ||
    (!value.replayed && value.state !== 'running') ||
    (value.replayed && value.state === 'running')
  )
    throw bad();
  return {
    replayed: value.replayed,
    state: value.state as MediaBatchClaim['state'],
    messages,
    held_count: value.held_count as number,
    ...(value.state === 'finished' ? { result: parseMediaBatchSummary(value.result) } : { result: null }),
  };
}

/** One actual restricted writer session, with serialized short transactions.
 * The fixed session advisory lock is released only after all worker ports close.
 * No write is retried here; a lost receipt remains unknown for reconciliation.
 */
export async function openMediaDatabaseSession(
  pool: WorkerPool,
  executionId: string,
  signal: AbortSignal,
  onLost: () => void = () => {},
  batchSize = 50,
  lane: 'media' | 'stories' = 'media',
): Promise<MediaDatabaseSession> {
  if (
    !/^[1-9][0-9]{0,19}$/.test(executionId) ||
    signal.aborted ||
    !Number.isSafeInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 50 ||
    !['media', 'stories'].includes(lane)
  )
    throw bad();
  const client = await pool.connect();
  const operations =
    lane === 'stories'
      ? {
          claim: 'ops.claim_story_media_batch',
          record: 'ops.record_story_media_outcome',
          ack: 'ops.ack_story_media_batch',
          finish: 'ops.finish_story_media_batch',
        }
      : {
          claim: 'ops.claim_media_batch',
          record: 'ops.record_media_outcome',
          ack: 'ops.ack_media_batch',
          finish: 'ops.finish_media_batch',
        };
  let released = false,
    locked = false,
    closed: Promise<void> | undefined,
    closePromise: Promise<void> | undefined,
    closing = false,
    cleanupFailed = false,
    tail: Promise<void> = Promise.resolve();
  const cleanupFailure = () => new WorkerFailure('media_cleanup_unconfirmed', 503);
  async function bounded<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(cleanupFailure()), 3000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  const destroy = () => {
    if (closed) return closed;
    released = true;
    closing = true;
    closed = (async () => {
      try {
        await bounded(Promise.resolve().then(() => client.end()));
      } catch {
        cleanupFailed = true;
        throw cleanupFailure();
      } finally {
        try {
          client.release(true);
        } catch {
          cleanupFailed = true;
          throw cleanupFailure();
        }
      }
    })();
    return closed;
  };
  const lost = () => {
    onLost();
    void destroy().catch(() => {});
  };
  client.on('error', lost);
  signal.addEventListener('abort', lost, { once: true });
  const query = async (sql: string, values?: unknown[]) => {
    if (released || signal.aborted) throw bad();
    return client.query(sql, values);
  };
  async function transaction<T>(work: () => Promise<T>, operationSignal: AbortSignal = signal): Promise<T> {
    if (closing) throw bad();
    const result = tail.then(async () => {
      if (operationSignal.aborted || signal.aborted || released) throw bad();
      const abort = () => {
        onLost();
        void destroy().catch(() => {});
      };
      operationSignal.addEventListener('abort', abort, { once: true });
      try {
        await query('begin');
        await query(
          "set local statement_timeout='8s';set local lock_timeout='2s';set local idle_in_transaction_session_timeout='10s'",
        );
        const value = await work();
        if (operationSignal.aborted || signal.aborted) throw bad();
        await query('commit');
        return value;
      } catch (error) {
        if (!released)
          try {
            await query('rollback');
          } catch {
            await destroy();
          }
        if (error instanceof WorkerFailure) throw error;
        const code = object(error) ? error.code : null;
        throw new WorkerFailure(
          code === '42501'
            ? 'forbidden'
            : code === '22023'
              ? 'invalid_request'
              : code === '55000'
                ? 'reconciliation_required'
                : 'outcome_unknown',
          code === '42501' ? 403 : code === '22023' ? 400 : 503,
        );
      } finally {
        operationSignal.removeEventListener('abort', abort);
      }
    });
    tail = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  const receipt = async (sql: string, values: unknown[], opSignal = signal) =>
    transaction(async () => {
      const rows = (await query(sql, values)).rows;
      if (rows.length !== 1 || !Object.hasOwn(rows[0] ?? {}, 'result')) throw bad();
      return rows[0]!.result;
    }, opSignal);
  try {
    await transaction(async () => {
      const identity = (
        await query(
          'select current_user::text as principal,session_user::text as login,current_database()::text as database',
        )
      ).rows[0];
      if (
        identity?.principal !== 'n8n_writer' ||
        identity.login !== 'n8n_writer' ||
        identity.database !== 'postgres'
      )
        throw new WorkerFailure('identity_denied', 403);
      const row = (await query('select pg_try_advisory_lock(73106,31) as locked')).rows[0];
      if (row?.locked !== true) throw new WorkerFailure('media_busy', 409);
      locked = true;
    });
  } catch (error) {
    signal.removeEventListener('abort', lost);
    client.off('error', lost);
    await destroy();
    throw error;
  }
  return {
    claim: async (opSignal = signal) =>
      parseClaim(
        await receipt(
          `select ${operations.claim}($1::text,$2::int) as result`,
          [executionId, batchSize],
          opSignal,
        ),
      ),
    targets: async (ids, opSignal) => {
      const result = await receipt('select ops.get_media_targets($1::uuid[]) as result', [ids], opSignal);
      if (!Array.isArray(result) || result.length > 50) throw bad();
      return result;
    },
    save: async (asset, opSignal) => {
      await receipt(
        'select ops.save_media_asset($1::uuid,$2::text,$3::text,$4::text,$5::int,$6::int) as result',
        [asset.item_id, asset.kind, asset.path, asset.source_url, asset.width, asset.height],
        opSignal,
      );
    },
    record: async (outcome: MediaOutcome, opSignal) => {
      await receipt(
        `select ${operations.record}($1::text,$2::jsonb) as result`,
        [executionId, JSON.stringify(outcome)],
        opSignal,
      );
    },
    ack: async (ids, opSignal) => {
      await receipt(
        `select ${operations.ack}($1::text,$2::bigint[]) as result`,
        [executionId, ids],
        opSignal,
      );
    },
    finish: async (opSignal) =>
      parseMediaBatchSummary(
        await receipt(`select ${operations.finish}($1::text) as result`, [executionId], opSignal),
      ),
    close: () => {
      if (closePromise) return closePromise;
      closePromise = (async () => {
        closing = true;
        try {
          try {
            await bounded(tail);
          } catch {
            cleanupFailed = true;
            await destroy();
            throw cleanupFailure();
          }
          if (closed) {
            await closed;
            if (cleanupFailed) throw cleanupFailure();
            return;
          }
          if (!released) {
            if (locked) {
              try {
                const row = (await bounded(query('select pg_advisory_unlock(73106,31) as unlocked'))).rows[0];
                if (row?.unlocked !== true) throw cleanupFailure();
              } catch {
                cleanupFailed = true;
                await destroy();
                throw cleanupFailure();
              }
            }
            released = true;
            try {
              client.release();
            } catch {
              cleanupFailed = true;
              throw cleanupFailure();
            }
          }
          if (cleanupFailed) throw cleanupFailure();
        } finally {
          signal.removeEventListener('abort', lost);
          client.off('error', lost);
        }
      })();
      return closePromise;
    },
  };
}
