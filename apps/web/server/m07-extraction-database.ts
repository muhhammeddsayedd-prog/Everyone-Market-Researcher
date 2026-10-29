import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import type { M07Dispatch, M07DbOperation } from '@emr/shared';
import type { WorkerPool } from './n8n-worker/database';
import { WorkerFailure } from './n8n-worker/errors';

/** Deliberately local-only. No hosted/project credential is accepted by this
 * first M07 slice, even if an operator supplies one by mistake. */
export function localExtractionDatabaseUrl(value: string) {
  try {
    const u = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(u.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ||
      u.username !== 'n8n_writer' ||
      u.pathname !== '/postgres' ||
      !u.port ||
      u.hash ||
      u.search
    )
      throw Error('invalid');
    return value;
  } catch {
    throw new WorkerFailure('unavailable', 503);
  }
}

/** One restricted transaction and no unknown-commit retry. */
export async function dispatchExtractionDatabase(
  pool: WorkerPool,
  operation: M07DbOperation,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<unknown> {
  const statements = {
    claim: {
      sql: 'select ops.m07_claim_ai($1::uuid,$2::int,600) as receipt',
      values: [args.owner_id, args.limit],
    },
    prepare: {
      sql: 'select ops.m07_prepare_ai($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as receipt',
      values: [args.attempt_id, args.owner_id, args.model, args.prompt_version, args.schema_version],
    },
    dispatch: {
      sql: 'select ops.m07_dispatch_ai($1::uuid,$2::uuid) as receipt',
      values: [args.attempt_id, args.owner_id],
    },
    status: {
      sql: 'select ops.m07_ai_status($1::uuid,$2::uuid) as receipt',
      values: [args.attempt_id, args.owner_id],
    },
    apply: {
      sql: 'select ops.apply_extraction($1::uuid,$2::jsonb,$3::jsonb) as receipt',
      values: [args.item_id, JSON.stringify(args.result), JSON.stringify(args.meta)],
    },
    fail: {
      sql: 'select ops.m07_fail_ai($1::uuid,$2::uuid,$3::text,$4::jsonb) as receipt',
      values: [args.attempt_id, args.owner_id, args.outcome, JSON.stringify(args.meta)],
    },
    ack: {
      sql: 'select ops.m07_ack_ai($1::uuid,$2::uuid) as receipt',
      values: [args.attempt_id, args.owner_id],
    },
  };
  const selected = statements[operation];
  if (!selected || signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
  const client = await pool.connect();
  let released = false;
  let closing: Promise<void> | undefined;
  const destroy = () =>
    (closing ??= (async () => {
      released = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          client.end().catch(() => {}),
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 3000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
        client.release(true);
      }
    })());
  const abort = () => void destroy();
  client.on('error', abort);
  signal.addEventListener('abort', abort, { once: true });
  const query = (sql: string, values?: unknown[]) => {
    if (released || signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
    return client.query(sql, values);
  };
  try {
    await query('begin');
    await query(
      "set local statement_timeout='8s';set local lock_timeout='2s';set local idle_in_transaction_session_timeout='10s'",
    );
    const identity = (
      await query(
        'select current_user::text as principal,session_user::text as login,current_database()::text as database',
      )
    ).rows[0];
    if (
      identity?.principal !== 'n8n_writer' ||
      identity?.login !== 'n8n_writer' ||
      identity?.database !== 'postgres'
    )
      throw new WorkerFailure('identity_denied', 403);
    const result = (await query(selected.sql, selected.values)).rows[0];
    if (!result || !Object.hasOwn(result, 'receipt')) throw new WorkerFailure('outcome_unknown', 503);
    await query('commit');
    return result.receipt;
  } catch (error) {
    if (!released)
      try {
        await query('rollback');
      } catch {
        await destroy();
      }
    if (error instanceof WorkerFailure) throw error;
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    throw new WorkerFailure(
      code === '42501' ? 'forbidden' : code === '22023' ? 'invalid_request' : 'reconciliation_required',
      code === '42501' ? 403 : code === '22023' ? 400 : 503,
    );
  } finally {
    signal.removeEventListener('abort', abort);
    client.off('error', abort);
    if (closing) await closing;
    else if (signal.aborted) await destroy();
    else if (!released) {
      released = true;
      client.release();
    }
  }
}

let pool: Pool | undefined;
let poolUrl: string | undefined;
export function extractionDatabase(value: string): M07Dispatch {
  const url = localExtractionDatabaseUrl(value);
  return async (operation, args, signal) => {
    if (pool && poolUrl !== url) throw new WorkerFailure('unavailable', 503);
    if (!pool) {
      poolUrl = url;
      pool = new Pool({
        connectionString: url,
        max: 1,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 5000,
        maxLifetimeSeconds: 60,
        application_name: 'emr-m07-local-extraction',
        ssl: false, // only a verified loopback local test database can reach here
      });
      pool.on('error', () => {});
      pool.on('connect', (c) => c.on('error', () => {}));
      attachDatabasePool(pool);
    }
    return dispatchExtractionDatabase(
      { connect: async () => (await pool!.connect()) as PoolClient },
      operation,
      args,
      signal,
    );
  };
}
