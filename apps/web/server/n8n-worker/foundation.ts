import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  foundationRequest,
  foundationReceipt,
  parseFoundationWindowId,
  type FoundationRequest,
} from '@emr/shared';
import { readBody, response } from './dispatcher';
import { WorkerFailure } from './errors';

export interface FoundationConfig {
  audience: string;
  password: string;
  verifier: string;
  windowId: string;
  commitSha: string;
  deploymentId: string;
  apifyReadToken: string;
}
export function foundationConfig(env: Record<string, string | undefined>): FoundationConfig {
  const windowId = parseFoundationWindowId(env.EMR_M03_FOUNDATION_WINDOW_ID);
  if (
    env.EMR_M03_FOUNDATION_ENABLED !== 'true' ||
    env.VERCEL_ENV !== 'preview' ||
    env.VERCEL_GIT_COMMIT_REF !== 'm03-n8n-foundation' ||
    env.VERCEL_PROJECT_ID !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    !windowId ||
    !env.EMR_M03_FOUNDATION_WRITER_PASSWORD ||
    !env.EMR_M03_FOUNDATION_APIFY_READ_TOKEN ||
    !/^[a-f0-9]{64}$/.test(env.EMR_M03_FOUNDATION_TOKEN_SHA256 ?? '') ||
    env.EMR_M03_FOUNDATION_AUDIENCE !== 'vercel-deployment' ||
    !/^everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '') ||
    !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '') ||
    env.VERCEL_GIT_COMMIT_SHA !== env.EMR_M03_FOUNDATION_COMMIT_SHA ||
    !/^dpl_[A-Za-z0-9]{1,80}$/.test(env.VERCEL_DEPLOYMENT_ID ?? '')
  )
    throw new WorkerFailure('unavailable', 503);
  return {
    audience: 'https://' + env.VERCEL_URL,
    password: env.EMR_M03_FOUNDATION_WRITER_PASSWORD,
    verifier: env.EMR_M03_FOUNDATION_TOKEN_SHA256!,
    windowId,
    commitSha: env.VERCEL_GIT_COMMIT_SHA!,
    deploymentId: env.VERCEL_DEPLOYMENT_ID!,
    apifyReadToken: env.EMR_M03_FOUNDATION_APIFY_READ_TOKEN,
  };
}
function authorize(request: Request, config: FoundationConfig) {
  const url = new URL(request.url);
  if (
    url.origin !== config.audience ||
    url.pathname !== '/api/internal/n8n/foundation' ||
    url.search ||
    request.headers.has('origin') ||
    request.headers.has('cookie')
  )
    throw new WorkerFailure('forbidden', 403);
  const auth = request.headers.get('authorization') ?? '';
  if (
    !/^Bearer [A-Za-z0-9_-]{32,256}$/.test(auth) ||
    !timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(), Buffer.from(config.verifier, 'hex'))
  )
    throw new WorkerFailure('unauthorized', 401);
}
interface Dependencies {
  environment: () => Record<string, string | undefined>;
  dispatch: (input: FoundationRequest, config: FoundationConfig, signal: AbortSignal) => Promise<unknown>;
  log: (record: {
    operation: string;
    requestId: string | null;
    outcome: string;
    status: number;
    elapsedMs: number;
  }) => void;
  deadlineMs?: number;
}
export function createFoundationHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const start = Date.now(),
      controller = new AbortController();
    let requestId: string | null = null,
      operation = 'rejected',
      outcome = 'rejected',
      status = 503;
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timer = setTimeout(abort, deps.deadlineMs ?? 20000);
    try {
      const config = foundationConfig(deps.environment());
      authorize(request, config);
      if (request.method !== 'POST') throw new WorkerFailure('method_not_allowed', 405);
      let parsed: FoundationRequest;
      const value = await readBody(request, controller.signal);
      try {
        parsed = foundationRequest(value);
        if (
          parsed.operation === 'launch.authorize' &&
          (parsed.args.launch as { window_id: string }).window_id !== config.windowId
        )
          throw Error('invalid_request');
      } catch {
        throw new WorkerFailure('invalid_request', 400);
      }
      requestId = parsed.requestId;
      operation = parsed.operation;
      if (controller.signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
      const raw = await deps.dispatch(parsed, config, controller.signal);
      if (controller.signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
      let result;
      try {
        result = foundationReceipt(raw, parsed.operation);
        if (result.window.id !== config.windowId) throw Error('invalid_result');
      } catch {
        throw new WorkerFailure('outcome_unknown', 503);
      }
      outcome = result.state;
      status = {
        completed: 200,
        absent: 200,
        admitted: 202,
        in_flight: 202,
        conflict: 409,
        limited: 429,
        closed: 403,
        rejected: 403,
        reconciliation_required: 503,
      }[result.state];
      const output = {
        version: 1,
        requestId,
        outcome: result.state,
        operation: result.operation,
        replayed: result.replayed,
        result: result.result,
        window: result.window,
      };
      if (Buffer.byteLength(JSON.stringify(output)) > 524288)
        throw new WorkerFailure('result_too_large', 503);
      return response(output, status);
    } catch (error) {
      const failure = error instanceof WorkerFailure ? error : new WorkerFailure('outcome_unknown', 503);
      status = failure.status;
      outcome = failure.code;
      return response({ requestId, error: { code: failure.code } }, status);
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', abort);
      deps.log({ operation, requestId, outcome, status, elapsedMs: Math.max(0, Date.now() - start) });
    }
  };
}
