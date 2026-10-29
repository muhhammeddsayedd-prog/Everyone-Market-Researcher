import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { collectorExecutionErrorArgs, collectorWorkflowIds } from '@emr/shared';
import { databaseConfig, type WorkerPool } from './database';
import type { CollectorConfig, CollectorDispatch } from './collectors';
import { WorkerFailure } from './errors';
import { m05Args, m05ExecutionErrorArgs, m05WorkflowIds } from '@emr/shared';
import { m06StoryArgs, m06StoryInternalArgs } from '@emr/shared';

const operations = new Set([
  ...Object.keys(m05Args),
  ...Object.keys(m06StoryArgs),
  ...Object.keys(m06StoryInternalArgs),
  'm05.settle',
  'm05.classify',
  'm05.lookup',
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
  'execution.error',
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
  let errorEntry: Record<string, unknown> | undefined;
  if (operation === 'execution.error' || operation === 'm05.execution.error') {
    const parsed = (
      operation === 'm05.execution.error' ? m05ExecutionErrorArgs : collectorExecutionErrorArgs
    ).safeParse(args);
    if (!parsed.success) throw new WorkerFailure('invalid_request', 400);
    const input = parsed.data;
    errorEntry = {
      kind: 'error',
      workflow: Object.entries(
        operation === 'm05.execution.error' ? m05WorkflowIds : collectorWorkflowIds,
      ).find(([, id]) => id === input.workflow_id)![0],
      execution_id: input.execution_id,
      node: input.execution_id.startsWith('handler-') ? 'Trigger activation' : 'Workflow',
      message: input.error_code,
    };
  }
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
    // Existing private RPC deduplicates workflow/execution/node atomically.
    // Omit run_id: an error event cannot prove actor completion or safely
    // fail a parent/release claims. Reconciliation remains explicit.
    if (errorEntry) {
      await query('select ops.log_workflow_error($1::jsonb) as logged', [JSON.stringify(errorEntry)]);
      await query('commit');
      return { replayed: false, result: { logged: true, reconciliation_required: true } };
    }
    const result = (
      await query(
        operation.startsWith('m06.') ||
          (_config.scope === 'm06' && ['classify', 'status'].includes(operation))
          ? 'select ops.m06_execute($1::uuid,$2::text,$3::jsonb) as receipt'
          : operation.startsWith('m05.')
            ? 'select ops.m05_execute($1::uuid,$2::text,$3::jsonb) as receipt'
            : operation === 'classify' && _config.scope === 'm05'
              ? 'select ops.m05_execute($1::uuid,$2::text,$3::jsonb) as receipt'
              : 'select ops.collector_execute($1::uuid,$2::text,$3::jsonb) as receipt',
        [
          requestId,
          _config.scope === 'm06' && ['classify', 'status'].includes(operation)
            ? 'm06.' + operation
            : operation,
          JSON.stringify(args),
        ],
      )
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
    pool = new Pool({
      ...databaseConfig(config.password, ca),
      application_name:
        config.scope === 'm06'
          ? 'emr-m06-collectors-dev'
          : config.scope === 'm05'
            ? 'emr-m05-collectors-dev'
            : 'emr-m04-collectors-dev',
    });
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
