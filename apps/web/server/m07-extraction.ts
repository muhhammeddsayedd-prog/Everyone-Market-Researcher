import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { m07ExtractionRequest, type M07Dispatch } from '@emr/shared';
import ai from '../../../n8n/normalizers/aiResult.js';
import { readBody } from './n8n-worker/dispatcher';
import { WorkerFailure } from './n8n-worker/errors';
import { localExtractionDatabaseUrl } from './m07-extraction-database';

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const fail = () => new WorkerFailure('reconciliation_required', 503);

/** No Preview/production enable switch exists in this local sequencing slice. */
export function extractionConfig(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV || env.VERCEL)
    throw new WorkerFailure('not_found', 404);
  try {
    const u = new URL(env.EMR_M07_LOCAL_AUDIENCE ?? '');
    const maxOutputTokens = Number(env.EMR_M07_MAX_OUTPUT_TOKENS ?? '2000');
    if (
      !['development', 'test'].includes(env.NODE_ENV ?? '') ||
      env.EMR_M07_LOCAL_ENABLED !== 'true' ||
      u.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ||
      !u.port ||
      u.pathname !== '/' ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !/^[a-f0-9]{64}$/.test(env.EMR_M07_LOCAL_TOKEN_SHA256 ?? '') ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(env.OPENAI_MODEL_EXTRACT ?? '') ||
      !Number.isSafeInteger(maxOutputTokens) ||
      maxOutputTokens < 1 ||
      maxOutputTokens > 8192
    )
      throw Error('invalid');
    return {
      audience: u.origin,
      databaseUrl: localExtractionDatabaseUrl(env.EMR_M07_LOCAL_DATABASE_URL ?? ''),
      verifier: env.EMR_M07_LOCAL_TOKEN_SHA256!,
      model: env.OPENAI_MODEL_EXTRACT!,
      maxOutputTokens,
    };
  } catch {
    throw new WorkerFailure('unavailable', 503);
  }
}

type Config = ReturnType<typeof extractionConfig>;
const prepared = async (
  dispatch: M07Dispatch,
  args: Record<string, unknown>,
  config: Config,
  signal: AbortSignal,
) => {
  const p = await dispatch(
    'prepare',
    {
      attempt_id: args.attempt_id,
      owner_id: args.owner_id,
      model: config.model,
      prompt_version: ai.promptVersion,
      schema_version: ai.schemaVersion,
    },
    signal,
  );
  if (
    !object(p) ||
    p.attempt_id !== args.attempt_id ||
    p.owner_id !== args.owner_id ||
    !['claimed', 'prepared', 'dispatched', 'completed', 'failed', 'unknown'].includes(String(p.state)) ||
    !object(p.context) ||
    !object(p.taxonomy) ||
    !object(p.prices) ||
    !object(p.config) ||
    p.config.model !== config.model ||
    p.config.prompt_version !== ai.promptVersion ||
    p.config.schema_version !== ai.schemaVersion
  )
    throw fail();
  return p;
};

function attemptMeta(
  p: Record<string, unknown>,
  parsed: Record<string, unknown> | null,
  cost: number | null,
) {
  const usage = parsed?.usage;
  const known = object(usage) && cost !== null && typeof parsed?.response_id === 'string';
  const config = p.config as Record<string, unknown>;
  return {
    attempt_id: p.attempt_id,
    owner_id: p.owner_id,
    model: config.model,
    prompt_version: config.prompt_version,
    schema_version: config.schema_version,
    provider_response_id: known ? parsed!.response_id : null,
    input_tokens: known ? usage.input_tokens : null,
    output_tokens: known ? usage.output_tokens : null,
    cached_tokens: known ? usage.cached_input_tokens : null,
    cost_usd: known ? cost : null,
    usage_known: known,
    used_vision: false,
    latency_ms: 0,
    accounting_mode: 'simulated',
  };
}

/** Shared handler used by the actual local route and the assembled SQL tests.
 * It never calls a model. The native HTTP node owns the request, with automatic
 * paid retries disabled; only its raw response crosses this settlement boundary. */
export function createExtractionHandler(deps: {
  environment: () => Record<string, string | undefined>;
  database: (localUrl: string) => M07Dispatch;
}) {
  return async (request: Request) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timeout = setTimeout(abort, 30000);
    let requestId: string | null = null;
    try {
      const config = extractionConfig(deps.environment());
      const url = new URL(request.url);
      if (
        request.method !== 'POST' ||
        url.origin !== config.audience ||
        url.pathname !== '/api/internal/m07/extract' ||
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
      const input = m07ExtractionRequest.safeParse(await readBody(request, controller.signal));
      if (!input.success) throw new WorkerFailure('invalid_request', 400);
      requestId = input.data.requestId;
      const { operation, args } = input.data;
      const dispatch = deps.database(config.databaseUrl);
      let result: unknown;
      if (operation === 'claim') {
        result = await dispatch('claim', args, controller.signal);
      } else if (operation === 'status' || operation === 'ack') {
        result = await dispatch(operation, args, controller.signal);
      } else {
        const p = await prepared(dispatch, args, config, controller.signal);
        if (operation === 'prepare') {
          result = {
            attempt_id: p.attempt_id,
            owner_id: p.owner_id,
            item_id: p.item_id,
            msg_id: p.msg_id,
            state: p.state,
            result: p.result,
            acked: p.acked,
            provider_request:
              p.state === 'prepared'
                ? ai.buildRequest(p.context, p.taxonomy, {
                    model: config.model,
                    maxOutputTokens: config.maxOutputTokens,
                  })
                : null,
          };
        } else if (operation === 'dispatch') {
          const admission = await dispatch('dispatch', args, controller.signal);
          if (
            !object(admission) ||
            admission.attempt_id !== args.attempt_id ||
            typeof admission.admitted !== 'boolean'
          )
            throw fail();
          result = {
            ...admission,
            provider_request: admission.admitted
              ? ai.buildRequest(p.context, p.taxonomy, {
                  model: config.model,
                  maxOutputTokens: config.maxOutputTokens,
                })
              : null,
          };
        } else if (operation === 'outcome.unknown') {
          result = await dispatch(
            'fail',
            {
              ...args,
              outcome: 'unknown',
              meta: attemptMeta(p, null, null),
            },
            controller.signal,
          );
        } else {
          const parsed = ai.parseResponse(args.provider_response, p.taxonomy);
          const responseModel = object(args.provider_response) ? args.provider_response.model : null;
          const cost =
            responseModel === config.model ? ai.costOf(parsed.usage, p.prices, config.model) : null;
          const meta = attemptMeta(p, parsed, cost);
          if (parsed.ok && meta.usage_known) {
            result = await dispatch(
              'apply',
              { item_id: p.item_id, result: parsed.result, meta },
              controller.signal,
            );
          } else {
            const error = String(parsed.error ?? 'invalid_response').toLowerCase();
            const outcome = !meta.usage_known
              ? 'unknown'
              : error.includes('refus')
                ? 'refused'
                : error.includes('incomplete')
                  ? 'incomplete'
                  : 'invalid_response';
            result = await dispatch(
              'fail',
              { attempt_id: p.attempt_id, owner_id: p.owner_id, outcome, meta },
              controller.signal,
            );
          }
        }
      }
      if (controller.signal.aborted) throw fail();
      return Response.json(
        { version: 1, requestId, operation, result },
        { headers: { 'cache-control': 'no-store' } },
      );
    } catch (error) {
      const e = error instanceof WorkerFailure ? error : fail();
      return Response.json(
        { requestId, error: { code: e.code } },
        { status: e.status, headers: { 'cache-control': 'no-store' } },
      );
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener('abort', abort);
    }
  };
}
