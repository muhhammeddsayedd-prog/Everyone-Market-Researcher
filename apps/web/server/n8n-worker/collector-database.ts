import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { databaseConfig, type WorkerPool } from './database';
import type { CollectorConfig, CollectorDispatch } from './collectors';
import { WorkerFailure } from './errors';

const operations = new Set([
  'start',
  'claim',
  'resolve',
  'ingest',
  'report',
  'cost',
  'finish',
  'launch',
  'register',
  'close_registration',
  'lookup',
  'classify',
  'stage',
  'settle',
  'status',
]);
/** The existing pinned dev writer/TLS pool, one fixed SQL call and native principal checks.
 * Every request and its effects commit together; a lost receipt is never retried here.
 */
export async function dispatchCollectorDatabase(
  pool: WorkerPool,
  requestId: string,
  operation: string,
  args: Record<string, unknown>,
  _config: CollectorConfig,
  signal: AbortSignal,
): Promise<{ replayed: boolean; result: unknown }> {
  if (!operations.has(operation) || signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
  const client = await pool.connect();
  let released = false,
    closed: Promise<void> | undefined;
  const destroy = () => {
    if (closed) return closed;
    released = true;
    closed = (async () => {
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
    })();
    return closed;
  };
  const abort = () => {
    void destroy();
  };
  client.on('error', abort);
  signal.addEventListener('abort', abort, { once: true });
  const query = async (sql: string, values?: unknown[]) => {
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
    const result = (
      await query('select ops.collector_execute($1::uuid,$2::text,$3::jsonb) as receipt', [
        requestId,
        operation,
        JSON.stringify(args),
      ])
    ).rows[0]?.receipt;
    if (
      !result ||
      typeof result !== 'object' ||
      !('replayed' in result) ||
      typeof result.replayed !== 'boolean' ||
      !Object.hasOwn(result, 'result')
    )
      throw new WorkerFailure('outcome_unknown', 503);
    await query('commit');
    return result as { replayed: boolean; result: unknown };
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
    if (closed) await closed;
    else if (!released) {
      released = true;
      client.release();
    }
  }
}
let pool: Pool | undefined;
export const dispatchCollectorWorkerDatabase: CollectorDispatch = async (
  requestId,
  operation,
  args,
  config,
  signal,
) => {
  if (!pool) {
    const ca = readFileSync(join(process.cwd(), 'server/n8n-worker/certs/supabase-root-2021.crt'));
    pool = new Pool({ ...databaseConfig(config.password, ca), application_name: 'emr-m04-collectors-dev' });
    pool.on('error', () => {});
    pool.on('connect', (client) => client.on('error', () => {}));
    attachDatabasePool(pool);
  }
  return dispatchCollectorDatabase(
    { connect: async () => (await pool!.connect()) as PoolClient },
    requestId,
    operation,
    args,
    config,
    signal,
  );
};
