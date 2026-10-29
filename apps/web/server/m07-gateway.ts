import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { WorkerFailure } from './n8n-worker/errors';
import { localExtractionDatabaseUrl } from './m07-extraction-database';

const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function selections(env: Record<string, string | undefined>) {
  const ids: unknown = JSON.parse(env.EMR_M07_ITEM_IDS ?? '');
  const entities: unknown = JSON.parse(env.EMR_M07_EMBED_ENTITIES ?? '');
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 20 ||
    !ids.every(uuid) ||
    new Set(ids).size !== ids.length ||
    !Array.isArray(entities) ||
    entities.length < 1 ||
    entities.length > 20 ||
    !entities.every(
      (v) =>
        v &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        Object.keys(v).sort().join(',') === 'entity_id,entity_type' &&
        ['item', 'competitor', 'organization'].includes(v.entity_type) &&
        uuid(v.entity_id),
    ) ||
    new Set(entities.map((v) => v.entity_type + ':' + v.entity_id)).size !== entities.length
  )
    throw Error('invalid');
  return {
    itemIds: ids as string[],
    embeddingEntities: entities as { entity_type: string; entity_id: string }[],
  };
}
export const m07DevProject = 'zmotjsbzhzjvpelxvxlf';
export const m07ProjectId = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu';
export function m07GatewayConfig(env: Record<string, string | undefined>) {
  const enabled = env.EMR_M07_GATEWAY_ENABLED === 'true';
  if (env.VERCEL_ENV === 'production' || (env.NODE_ENV === 'production' && !enabled))
    throw new WorkerFailure('not_found', 404);
  try {
    if (enabled) {
      if (
        env.VERCEL_ENV !== 'preview' ||
        env.VERCEL_GIT_COMMIT_REF !== 'm07-ai-understanding' ||
        env.VERCEL_PROJECT_ID !== m07ProjectId ||
        env.EMR_M07_DEV_PROJECT_REF !== m07DevProject ||
        env.EMR_M07_GATEWAY_AUDIENCE !== 'vercel-deployment' ||
        !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '') ||
        !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '') ||
        env.EMR_M07_GATEWAY_COMMIT_SHA !== env.VERCEL_GIT_COMMIT_SHA ||
        !/^dpl_[A-Za-z0-9]{1,80}$/.test(env.VERCEL_DEPLOYMENT_ID ?? '') ||
        !/^[a-f0-9]{64}$/.test(env.EMR_M07_GATEWAY_TOKEN_SHA256 ?? '') ||
        !env.EMR_M07_WRITER_PASSWORD
      )
        throw Error('invalid');
      return {
        ...selections(env),
        profile: 'dev' as const,
        audience: 'https://' + env.VERCEL_URL,
        databaseUrl: env.EMR_M07_WRITER_PASSWORD!,
        verifier: env.EMR_M07_GATEWAY_TOKEN_SHA256!,
        accountingMode: 'provider' as const,
      };
    }
    if (env.VERCEL_ENV || env.VERCEL || !['development', 'test'].includes(env.NODE_ENV ?? ''))
      throw new WorkerFailure('not_found', 404);
    const u = new URL(env.EMR_M07_LOCAL_AUDIENCE ?? '');
    if (
      env.EMR_M07_LOCAL_ENABLED !== 'true' ||
      u.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ||
      !u.port ||
      u.pathname !== '/' ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !/^[a-f0-9]{64}$/.test(env.EMR_M07_LOCAL_TOKEN_SHA256 ?? '')
    )
      throw Error('invalid');
    return {
      itemIds: null,
      embeddingEntities: null,
      profile: 'local' as const,
      audience: u.origin,
      databaseUrl: localExtractionDatabaseUrl(env.EMR_M07_LOCAL_DATABASE_URL ?? ''),
      verifier: env.EMR_M07_LOCAL_TOKEN_SHA256!,
      accountingMode: 'simulated' as const,
    };
  } catch (error) {
    if (error instanceof WorkerFailure) throw error;
    throw new WorkerFailure('unavailable', 503);
  }
}
export function authorizeM07(request: Request, config: ReturnType<typeof m07GatewayConfig>, path: string) {
  const url = new URL(request.url);
  if (
    request.method !== 'POST' ||
    url.origin !== config.audience ||
    url.pathname !== path ||
    url.search ||
    request.headers.has('origin') ||
    request.headers.has('cookie')
  )
    throw new WorkerFailure('forbidden', 403);
  const token = request.headers.get('authorization') ?? '';
  if (
    !/^Bearer [A-Za-z0-9_-]{32,256}$/.test(token) ||
    !timingSafeEqual(
      createHash('sha256').update(token.slice(7)).digest(),
      Buffer.from(config.verifier, 'hex'),
    )
  )
    throw new WorkerFailure('unauthorized', 401);
}
