import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkServerIdentity, type ConnectionOptions } from 'node:tls';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { gatewayIdentity, type GatewayRequest, type FoundationRequest } from '@emr/shared';
import type { GatewayConfig } from './auth';
import type { FoundationConfig } from './foundation';
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
  return dispatchBoundDatabase(pool, input, config, signal, 'gw01');
}
type BoundConfig = Omit<GatewayConfig, 'windowId'> & { windowId: string };
type ExternalRead = (
  registry: unknown,
  operation: 'apify.dataset.read' | 'apify.terminal.read' | 'launch.reconcile',
  signal: AbortSignal,
) => Promise<unknown>;
export async function dispatchFoundationDatabase(
  pool: WorkerPool,
  input: FoundationRequest,
  config: FoundationConfig,
  signal: AbortSignal,
  read: ExternalRead,
): Promise<unknown> {
  return dispatchBoundDatabase(pool, input, config, signal, 'foundation', read);
}
async function dispatchBoundDatabase(
  pool: WorkerPool,
  input: GatewayRequest | FoundationRequest,
  config: BoundConfig,
  signal: AbortSignal,
  profile: 'gw01' | 'foundation',
  read?: ExternalRead,
): Promise<unknown> {
  // The selector is supplied only by the two server entry points, never HTTP
  // args. Every SQL statement remains a closed literal with bound values.
  const sqls =
    profile === 'gw01'
      ? {
          identity: identitySql,
          inspect:
            "select ops.worker_gateway_admit($1::uuid,$2::uuid,'identity.read','{}'::jsonb,'inspect') as receipt",
          admit: 'select ops.worker_gateway_admit($1::uuid,$2::uuid,$3::text,$4::jsonb) as receipt',
          status: 'select ops.worker_gateway_status($1::uuid,$2::uuid) as receipt',
          execute: 'select ops.worker_gateway_execute($1::uuid,$2::uuid,$3::text,$4::jsonb) as receipt',
        }
      : {
          identity: identitySql.replace('emr-gw01-dev', 'emr-m03-foundation-dev'),
          inspect:
            "select ops.foundation_gateway_admit($1::uuid,$2::uuid,'identity.read','{}'::jsonb,'inspect') as receipt",
          admit: 'select ops.foundation_gateway_admit($1::uuid,$2::uuid,$3::text,$4::jsonb) as receipt',
          status: 'select ops.foundation_gateway_status($1::uuid,$2::uuid) as receipt',
          execute: 'select ops.foundation_gateway_execute($1::uuid,$2::uuid,$3::text,$4::jsonb) as receipt',
        };
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
    const native = (await query(sqls.identity)).rows[0];
    // This SELECT executes before every SECURITY DEFINER admission/operation.
    const identity = gatewayIdentity.safeParse({ ...native, projectRef: 'zmotjsbzhzjvpelxvxlf' });
    if (!identity.success) throw new WorkerFailure('identity_denied', 403);
    await commit();
    await begin();
    const binding = (await query(sqls.inspect, [config.windowId, input.requestId])).rows[0]?.receipt;
    await commit();
    if (
      !binding ||
      typeof binding !== 'object' ||
      !('window' in binding) ||
      !binding.window ||
      typeof binding.window !== 'object' ||
      (profile === 'foundation' && (!('id' in binding.window) || binding.window.id !== config.windowId)) ||
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
    const admitted = (await query(sqls.admit, params)).rows[0]?.receipt;
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
    if (
      profile === 'foundation' &&
      (input.operation === 'apify.dataset.read' ||
        input.operation === 'apify.terminal.read' ||
        input.operation === 'launch.reconcile')
    ) {
      if (!read) throw new WorkerFailure('unavailable', 503);
      await begin();
      const externalId = input.args.apifyRunId;
      const context = (
        await query('select ops.foundation_gateway_read_context($1::uuid,$2::uuid,$3::text) as context', [
          config.windowId,
          input.requestId,
          externalId,
        ])
      ).rows[0]?.context;
      // Persist the one-shot read intent BEFORE either authenticated HTTP GET.
      await commit();
      const result = await read(context, input.operation, signal);
      if (signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
      await begin();
      const completed = (
        await query(
          'select ops.foundation_gateway_complete_read($1::uuid,$2::uuid,$3::text,$4::jsonb) as receipt',
          [config.windowId, input.requestId, externalId, JSON.stringify(result)],
        )
      ).rows[0]?.receipt;
      await commit();
      return completed;
    }
    await begin();
    const sql = input.operation === 'request.status' ? sqls.status : sqls.execute;
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
let foundationPool: Pool | undefined;
export async function dispatchFoundationWorkerDatabase(
  input: FoundationRequest,
  config: FoundationConfig,
  signal: AbortSignal,
  read: ExternalRead,
) {
  if (!foundationPool) {
    const ca = readFileSync(join(process.cwd(), 'server/n8n-worker/certs/supabase-root-2021.crt'));
    foundationPool = new Pool({
      ...databaseConfig(config.password, ca),
      application_name: 'emr-m03-foundation-dev',
    });
    foundationPool.on('error', () => {});
    foundationPool.on('connect', (client) => client.on('error', () => {}));
    attachDatabasePool(foundationPool);
  }
  return dispatchFoundationDatabase(
    { connect: async () => (await foundationPool!.connect()) as PoolClient },
    input,
    config,
    signal,
    read,
  );
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
