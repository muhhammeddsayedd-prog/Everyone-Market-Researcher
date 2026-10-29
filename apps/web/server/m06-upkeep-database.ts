import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { databaseConfig, type WorkerPool } from './n8n-worker/database';
import { WorkerFailure } from './n8n-worker/errors';
import type { UpkeepDispatch, UpkeepOperation } from './m06-upkeep-contracts';

/** One exact restricted RPC in a transaction. Never retry an unknown commit. */
export async function dispatchUpkeepDatabase(
  pool: WorkerPool,
  operation: UpkeepOperation,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<unknown> {
  const statements = {
    targets: {
      sql: 'select ops.get_removal_targets($1::app.platform,$2::integer) as receipt',
      values: [args.platform, args.window_days],
    },
    apply: {
      sql: 'select ops.apply_upkeep_observation($1::uuid,$2::uuid,$3::date,$4::date,$5::jsonb,$6::text[],$7::text,$8::timestamptz) as receipt',
      values: [
        args.request_id,
        args.account_id,
        args.since,
        args.metrics_since,
        JSON.stringify(args.rows),
        args.seen_external_ids,
        args.skip_reason,
        args.observed_before,
      ],
    },
    status: { sql: 'select ops.upkeep_request_status($1::uuid) as receipt', values: [args.request_id] },
    health: { sql: 'select ops.daily_health() as receipt', values: [] },
    quota: {
      sql: "select ops.m05_execute($1::uuid,'m05.quota',$2::jsonb) as receipt",
      values: [args.request_id, JSON.stringify({ quota_day: args.quota_day, quantity: 1 })],
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
  const abort = () => {
    void destroy();
  };
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
export function upkeepDatabase(password: string): UpkeepDispatch {
  return async (operation, args, signal) => {
    if (!pool) {
      pool = new Pool({
        ...databaseConfig(
          password,
          readFileSync(join(process.cwd(), 'server/n8n-worker/certs/supabase-root-2021.crt')),
        ),
        application_name: 'emr-m06-upkeep-dev',
      });
      pool.on('error', () => {});
      pool.on('connect', (client) => client.on('error', () => {}));
      attachDatabasePool(pool);
    }
    return dispatchUpkeepDatabase(
      { connect: async () => (await pool!.connect()) as PoolClient },
      operation,
      args,
      signal,
    );
  };
}
