import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkServerIdentity, type ConnectionOptions } from 'node:tls';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { gatewayIdentity, type GatewayRequest } from '@emr/shared';
import type { GatewayConfig } from './auth';
import { WorkerFailure } from './errors';

export const poolerHost = 'aws-1-eu-central-1.pooler.supabase.com';
export const publicCaSha256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
export function strictTlsOptions(ca: Buffer, servername: string): ConnectionOptions {
  return { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2', servername, checkServerIdentity };
}
export function databaseConfig(password: string, ca: Buffer): PoolConfig {
  if (createHash('sha256').update(ca).digest('hex') !== publicCaSha256)
    throw new WorkerFailure('unavailable', 503);
  return {
    host: poolerHost,
    port: 5432,
    database: 'postgres',
    user: 'n8n_writer.zmotjsbzhzjvpelxvxlf',
    password,
    max: 1,
    min: 0,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 5000,
    maxLifetimeSeconds: 60,
    application_name: 'emr-gw01-dev',
    ssl: strictTlsOptions(ca, poolerHost),
  };
}
export interface WorkerClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean): void;
  end(): Promise<void>;
  on(event: 'error', listener: (error: unknown) => void): unknown;
  off(event: 'error', listener: (error: unknown) => void): unknown;
}
export interface WorkerPool {
  connect(): Promise<WorkerClient>;
}
const identitySql =
  'select current_user::text as "currentUser",session_user::text as "sessionUser",current_database()::text as database,(select count(*)::int from pg_stat_activity where usename=session_user and application_name=\'emr-gw01-dev\') as "connectionCount"';
const timeoutSql =
  "set local statement_timeout='8s'; set local lock_timeout='2s'; set local idle_in_transaction_session_timeout='10s'";
export async function dispatchDatabase(
  pool: WorkerPool,
  input: GatewayRequest,
  config: GatewayConfig,
  signal: AbortSignal,
): Promise<unknown> {
  if (signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
  const client = await pool.connect();
  let released = false;
  let transaction = false;
  let destroyPromise: Promise<boolean> | undefined;
  const destroy = () => {
    if (destroyPromise) return destroyPromise;
    released = true;
    destroyPromise = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          Promise.resolve()
            .then(() => client.end())
            .then(
              () => true,
              () => false,
            ),
          new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), 3000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        client.release(true);
      }
    })();
    return destroyPromise;
  };
  const nativeError = () => {
    void destroy();
  };
  client.on('error', nativeError);
  const abort = () => {
    void destroy();
  };
  signal.addEventListener('abort', abort, { once: true });
  async function query(sql: string, values?: unknown[]) {
    if (signal.aborted || released) throw new WorkerFailure('outcome_unknown', 503);
    return client.query(sql, values);
  }
  async function begin() {
    await query('begin');
    transaction = true;
    await query(timeoutSql);
  }
  async function commit() {
    await query('commit');
    transaction = false;
  }
  try {
    await begin();
    const native = (await query(identitySql)).rows[0];
    // This SELECT executes before every SECURITY DEFINER admission/operation.
    const identity = gatewayIdentity.safeParse({ ...native, projectRef: 'zmotjsbzhzjvpelxvxlf' });
    if (!identity.success) throw new WorkerFailure('identity_denied', 403);
    await commit();
    await begin();
    const binding = (
      await query(
        "select ops.worker_gateway_admit($1::uuid,$2::uuid,'identity.read','{}'::jsonb,'inspect') as receipt",
        [config.windowId, input.requestId],
      )
    ).rows[0]?.receipt;
    await commit();
    if (
      !binding ||
      typeof binding !== 'object' ||
      !('window' in binding) ||
      !binding.window ||
      typeof binding.window !== 'object' ||
      !('boundAudience' in binding.window) ||
      binding.window.boundAudience !== config.audience ||
      !('boundCommitSha' in binding.window) ||
      binding.window.boundCommitSha !== config.commitSha ||
      !('boundDeploymentId' in binding.window) ||
      binding.window.boundDeploymentId !== config.deploymentId
    )
      throw new WorkerFailure('deployment_denied', 403);
    await begin();
    const params = [config.windowId, input.requestId, input.operation, JSON.stringify(input.args)];
    const admitted = (
      await query('select ops.worker_gateway_admit($1::uuid,$2::uuid,$3::text,$4::jsonb) as receipt', params)
    ).rows[0]?.receipt;
    // Separate commit is essential: failed/unknown business execution still counts.
    await commit();
    if (!admitted || typeof admitted !== 'object' || !('state' in admitted))
      throw new WorkerFailure('outcome_unknown', 503);
    const withIdentity = (value: unknown) => {
      if (
        !value ||
        typeof value !== 'object' ||
        !('result' in value) ||
        !value.result ||
        typeof value.result !== 'object'
      )
        return value;
      if (input.operation === 'identity.read')
        return { ...value, result: { ...value.result, currentUser: identity.data.currentUser } };
      if (
        input.operation === 'request.status' &&
        'sessionUser' in value.result &&
        value.result.sessionUser === 'n8n_writer'
      )
        return { ...value, result: { ...value.result, currentUser: identity.data.currentUser } };
      return value;
    };
    if (admitted.state !== 'admitted') return withIdentity(admitted);
    await begin();
    const sql =
      input.operation === 'request.status'
        ? 'select ops.worker_gateway_status($1::uuid,$2::uuid) as receipt'
        : 'select ops.worker_gateway_execute($1::uuid,$2::uuid,$3::text,$4::jsonb) as receipt';
    const values =
      input.operation === 'request.status' ? [config.windowId, input.args.targetRequestId] : params;
    const result = (await query(sql, values)).rows[0]?.receipt;
    await commit();
    return withIdentity(result);
  } catch (error) {
    if (transaction && !released) {
      try {
        await client.query('rollback');
      } catch {
        void destroy();
      }
    }
    void destroy();
    throw error instanceof WorkerFailure ? error : new WorkerFailure('outcome_unknown', 503);
  } finally {
    signal.removeEventListener('abort', abort);
    const closed = destroyPromise ? await destroyPromise : true;
    client.off('error', nativeError);
    if (!released) {
      released = true;
      client.release();
    }
    if (!closed) throw new WorkerFailure('cleanup_unverified', 503);
  }
}
let cachedPool: Pool | undefined;
export async function dispatchWorkerDatabase(
  input: GatewayRequest,
  config: GatewayConfig,
  signal: AbortSignal,
) {
  if (!cachedPool) {
    const ca = readFileSync(join(process.cwd(), 'server/n8n-worker/certs/supabase-root-2021.crt'));
    cachedPool = new Pool(databaseConfig(config.password, ca));
    // Do not let native pg errors become unhandled error logs containing context.
    cachedPool.on('error', () => {});
    cachedPool.on('connect', (client) => {
      client.on('error', () => {});
    });
    attachDatabasePool(cachedPool);
  }
  return dispatchDatabase(
    { connect: async () => (await cachedPool!.connect()) as PoolClient },
    input,
    config,
    signal,
  );
}
