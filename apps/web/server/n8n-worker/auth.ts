import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { trialWindowId } from '@emr/shared';
import { WorkerFailure } from './errors';
export interface GatewayConfig {
  audience: string;
  password: string;
  verifier: string;
  windowId: typeof trialWindowId;
  commitSha: string;
  deploymentId: string;
}
export function gatewayConfig(env: Record<string, string | undefined>): GatewayConfig {
  if (
    env.EMR_WORKER_GATEWAY_ENABLED !== 'true' ||
    env.VERCEL_ENV !== 'preview' ||
    env.VERCEL_GIT_COMMIT_REF !== 'm03-n8n-foundation' ||
    env.VERCEL_PROJECT_ID !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    env.EMR_WORKER_GATEWAY_WINDOW_ID !== trialWindowId ||
    !env.EMR_WORKER_DB_PASSWORD ||
    !/^[a-f0-9]{64}$/.test(env.EMR_WORKER_GATEWAY_TOKEN_SHA256 ?? '')
  )
    throw new WorkerFailure('unavailable', 503);
  // Generated deployment URL/ID comes from Vercel, never forwarded caller headers.
  if (
    env.EMR_WORKER_GATEWAY_AUDIENCE !== 'vercel-deployment' ||
    !/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '') ||
    !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '') ||
    env.VERCEL_GIT_COMMIT_SHA !== env.EMR_WORKER_GATEWAY_COMMIT_SHA ||
    !/^dpl_[A-Za-z0-9]{1,80}$/.test(env.VERCEL_DEPLOYMENT_ID ?? '')
  )
    throw new WorkerFailure('unavailable', 503);
  return {
    audience: 'https://' + env.VERCEL_URL,
    password: env.EMR_WORKER_DB_PASSWORD,
    verifier: env.EMR_WORKER_GATEWAY_TOKEN_SHA256!,
    windowId: trialWindowId,
    commitSha: env.VERCEL_GIT_COMMIT_SHA!,
    deploymentId: env.VERCEL_DEPLOYMENT_ID!,
  };
}
export function authorize(request: Request, config: GatewayConfig) {
  const url = new URL(request.url);
  if (
    url.origin !== config.audience ||
    url.pathname !== '/api/internal/n8n/rpc' ||
    url.search ||
    request.headers.has('origin') ||
    request.headers.has('cookie')
  )
    throw new WorkerFailure('forbidden', 403);
  const auth = request.headers.get('authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9_-]{32,256}$/.test(auth)) throw new WorkerFailure('unauthorized', 401);
  const supplied = createHash('sha256').update(auth.slice(7)).digest();
  if (!timingSafeEqual(supplied, Buffer.from(config.verifier, 'hex')))
    throw new WorkerFailure('unauthorized', 401);
}
