import 'server-only';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { attachDatabasePool } from '@vercel/functions';
import type { M07Dispatch, M07DbOperation } from '@emr/shared';
import { databaseConfig, type WorkerPool } from './n8n-worker/database';
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
      sql: 'select ops.m07_claim_ai_selected($1::uuid,$2::uuid[],$3::int,600) as receipt',
      values: [args.owner_id, args.allowed_item_ids ?? null, args.limit],
    },
    prepare: {
      sql: 'select ops.m07_prepare_ai($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as receipt',
      values: [args.attempt_id, args.owner_id, args.model, args.prompt_version, args.schema_version],
    },
    frozen: {
      sql: 'select ops.m07_frozen_ai($1::uuid,$2::uuid) as receipt',
      values: [args.attempt_id, args.owner_id],
    },
    freeze: {
      sql: 'select ops.m07_freeze_ai($1::uuid,$2::uuid,$3::jsonb) as receipt',
      values: [args.attempt_id, args.owner_id, JSON.stringify(args.snapshot)],
    },
    dispatch: {
      sql: 'select ops.m07_dispatch_frozen_ai($1::uuid,$2::uuid,$3::text) as receipt',
      values: [args.attempt_id, args.owner_id, args.request_hash],
    },
    status: {
      sql: 'select ops.m07_ai_status($1::uuid,$2::uuid) as receipt',
      values: [args.attempt_id, args.owner_id],
    },
    apply: {
      sql: 'select ops.m07_apply_frozen_ai($1::uuid,$2::jsonb,$3::jsonb,$4::text) as receipt',
      values: [args.item_id, JSON.stringify(args.result), JSON.stringify(args.meta), args.request_hash],
    },
    fail: {
      sql: 'select ops.m07_fail_frozen_ai($1::uuid,$2::uuid,$3::text,$4::jsonb,$5::text) as receipt',
      values: [args.attempt_id, args.owner_id, args.outcome, JSON.stringify(args.meta), args.request_hash],
    },
    ack: {
      sql: 'select ops.m07_ack_ai($1::uuid,$2::uuid) as receipt',
      values: [args.attempt_id, args.owner_id],
    },
  };
  return dispatchM07Statement(pool, statements[operation], signal);
}
/** Shared transaction mechanism for the two closed M07 RPC maps, never caller SQL. */
export async function dispatchM07Statement(
  pool: WorkerPool,
  selected: { sql: string; values: unknown[] } | undefined,
  signal: AbortSignal,
) {
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

export function m07PoolConfig(value: string, profile: 'local' | 'dev', ca?: Buffer): PoolConfig {
  if (profile === 'dev') {
    if (!value || !ca) throw new WorkerFailure('unavailable', 503);
    return { ...databaseConfig(value, ca), application_name: 'emr-m07-dev-ai' };
  }
  return {
    connectionString: localExtractionDatabaseUrl(value),
    max: 1,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 5000,
    maxLifetimeSeconds: 60,
    application_name: 'emr-m07-local-ai',
    ssl: false,
  };
}
const pools = new Map<string, Pool>();
function m07Pool(value: string, profile: 'local' | 'dev') {
  const key = profile + ':' + createHash('sha256').update(value).digest('hex');
  let pool = pools.get(key);
  if (!pool) {
    if (pools.size >= 2) throw new WorkerFailure('unavailable', 503);
    const ca =
      profile === 'dev'
        ? readFileSync(join(process.cwd(), 'server/n8n-worker/certs/supabase-root-2021.crt'))
        : undefined;
    pool = new Pool(m07PoolConfig(value, profile, ca));
    pool.on('error', () => {});
    pool.on('connect', (c) => c.on('error', () => {}));
    attachDatabasePool(pool);
    pools.set(key, pool);
  }
  return pool;
}
export function m07RestrictedPool(value: string, profile: 'local' | 'dev' = 'local'): WorkerPool {
  if (profile === 'local') localExtractionDatabaseUrl(value);
  return { connect: async () => (await m07Pool(value, profile).connect()) as PoolClient };
}
export function extractionDatabase(value: string, profile: 'local' | 'dev' = 'local'): M07Dispatch {
  return (operation, args, signal) =>
    dispatchExtractionDatabase(m07RestrictedPool(value, profile), operation, args, signal);
}
