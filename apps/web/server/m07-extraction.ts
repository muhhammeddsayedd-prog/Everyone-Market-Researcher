import 'server-only';
import { m07ExtractionRequest, type M07Dispatch } from '@emr/shared';
import ai from '../../../n8n/normalizers/aiResult.js';
import { readBody } from './n8n-worker/dispatcher';
import { WorkerFailure } from './n8n-worker/errors';
import { authorizeM07, m07GatewayConfig } from './m07-gateway';

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const fail = () => new WorkerFailure('reconciliation_required', 503);

/** Both profiles are disabled by default; the hosted profile is dev Preview only. */
export function extractionConfig(env: Record<string, string | undefined>) {
  const base = m07GatewayConfig(env);
  const maxOutputTokens = Number(env.EMR_M07_MAX_OUTPUT_TOKENS ?? '2000');
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(env.OPENAI_MODEL_EXTRACT ?? '') ||
    !Number.isSafeInteger(maxOutputTokens) ||
    maxOutputTokens < 1 ||
    maxOutputTokens > 8192
  )
    throw new WorkerFailure('unavailable', 503);
  return { ...base, model: env.OPENAI_MODEL_EXTRACT!, maxOutputTokens };
}
type Config = ReturnType<typeof extractionConfig>;
function frozenReceipt(p: unknown, args: Record<string, unknown>, config?: Config) {
  if (
    !object(p) ||
    p.attempt_id !== args.attempt_id ||
    p.owner_id !== args.owner_id ||
    !['claimed', 'prepared', 'dispatched', 'completed', 'failed', 'unknown'].includes(String(p.state))
  )
    throw fail();
  if (config?.itemIds && !config.itemIds.includes(String(p.item_id)))
    throw new WorkerFailure('forbidden', 403);
  if (p.snapshot === null) return p;
  const s = p.snapshot;
  if (
    !object(s) ||
    s.version !== 1 ||
    s.kind !== 'extraction' ||
    !object(s.context) ||
    !object(s.taxonomy) ||
    !object(s.prices) ||
    !object(s.prompt) ||
    typeof s.prompt.version !== 'string' ||
    typeof s.prompt.content !== 'string' ||
    !object(s.schema) ||
    typeof s.schema.version !== 'string' ||
    !object(s.schema.content) ||
    !object(s.config) ||
    typeof s.config.model !== 'string' ||
    !['simulated', 'provider'].includes(String(s.config.accounting_mode)) ||
    !object(s.provider_request) ||
    s.provider_request.model !== s.config.model ||
    s.provider_request.max_output_tokens !== s.config.max_output_tokens ||
    !/^[a-f0-9]{64}$/.test(String(p.request_hash))
  )
    throw fail();
  return p;
}
const prepared = async (
  dispatch: M07Dispatch,
  args: Record<string, unknown>,
  config: Config,
  signal: AbortSignal,
) => {
  const existing = frozenReceipt(await dispatch('frozen', args, signal), args, config);
  if (object(existing.snapshot)) return existing;
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
    !object(p.context) ||
    !object(p.taxonomy) ||
    !object(p.prices)
  )
    throw fail();
  const snapshot = {
    version: 1,
    kind: 'extraction',
    provider_request: ai.buildRequest(p.context, p.taxonomy, {
      model: config.model,
      maxOutputTokens: config.maxOutputTokens,
    }),
    context: p.context,
    taxonomy: p.taxonomy,
    prompt: { version: ai.promptVersion, content: ai.promptTemplate },
    schema: { version: ai.schemaVersion, content: ai.extractionSchema.schema },
    config: {
      model: config.model,
      max_output_tokens: config.maxOutputTokens,
      accounting_mode: config.accountingMode,
    },
    prices: p.prices,
  };
  const frozen = frozenReceipt(await dispatch('freeze', { ...args, snapshot }, signal), args, config);
  if (!object(frozen.snapshot)) throw fail();
  return frozen;
};

function attemptMeta(
  p: Record<string, unknown>,
  parsed: Record<string, unknown> | null,
  cost: number | null,
) {
  const usage = parsed?.usage;
  const known = object(usage) && cost !== null && typeof parsed?.response_id === 'string';
  const snapshot = p.snapshot as Record<string, unknown>;
  const config = snapshot.config as Record<string, unknown>;
  const prompt = snapshot.prompt as Record<string, unknown>;
  const schema = snapshot.schema as Record<string, unknown>;
  return {
    attempt_id: p.attempt_id,
    owner_id: p.owner_id,
    model: config.model,
    prompt_version: prompt.version,
    schema_version: schema.version,
    provider_response_id: known ? parsed!.response_id : null,
    input_tokens: known ? usage.input_tokens : null,
    output_tokens: known ? usage.output_tokens : null,
    cached_tokens: known ? usage.cached_input_tokens : null,
    cost_usd: known ? cost : null,
    usage_known: known,
    used_vision: false,
    latency_ms: 0,
    accounting_mode: config.accounting_mode,
  };
}

/** Shared handler used by the actual local route and the assembled SQL tests.
 * It never calls a model. The native HTTP node owns the request, with automatic
 * paid retries disabled; only its raw response crosses this settlement boundary. */
export function createExtractionHandler(deps: {
  environment: () => Record<string, string | undefined>;
  database: (connection: string, profile?: 'local' | 'dev') => M07Dispatch;
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
      authorizeM07(request, config, '/api/internal/m07/extract');
      const input = m07ExtractionRequest.safeParse(await readBody(request, controller.signal));
      if (!input.success) throw new WorkerFailure('invalid_request', 400);
      requestId = input.data.requestId;
      const { operation, args } = input.data;
      const dispatch = deps.database(config.databaseUrl, config.profile);
      let result: unknown;
      if (operation === 'claim') {
        result = await dispatch('claim', { ...args, allowed_item_ids: config.itemIds }, controller.signal);
      } else if (operation === 'status' || operation === 'ack') {
        if (config.itemIds) frozenReceipt(await dispatch('frozen', args, controller.signal), args, config);
        result = await dispatch(operation, args, controller.signal);
      } else {
        const p = await prepared(dispatch, args, config, controller.signal);
        const snapshot = p.snapshot as Record<string, unknown>;
        const admittedConfig = snapshot.config as Record<string, unknown>;
        if (operation === 'prepare') {
          result = {
            attempt_id: p.attempt_id,
            owner_id: p.owner_id,
            item_id: p.item_id,
            msg_id: p.msg_id,
            state: p.state,
            result: p.result,
            acked: p.acked,
            request_hash: p.request_hash,
            provider_request: p.state === 'prepared' ? snapshot.provider_request : null,
          };
        } else if (operation === 'dispatch') {
          const admission = await dispatch(
            'dispatch',
            { ...args, request_hash: p.request_hash },
            controller.signal,
          );
          if (
            !object(admission) ||
            admission.attempt_id !== args.attempt_id ||
            typeof admission.admitted !== 'boolean'
          )
            throw fail();
          result = {
            ...admission,
            request_hash: p.request_hash,
            provider_request: admission.admitted ? snapshot.provider_request : null,
          };
        } else if (operation === 'outcome.unknown') {
          result = await dispatch(
            'fail',
            {
              ...args,
              outcome: 'unknown',
              meta: attemptMeta(p, null, null),
              request_hash: p.request_hash,
            },
            controller.signal,
          );
        } else {
          const parsed = ai.parseResponse(
            args.provider_response,
            snapshot.taxonomy,
            (snapshot.schema as Record<string, unknown>).content as typeof ai.extractionSchema.schema,
          );
          const responseModel = object(args.provider_response) ? args.provider_response.model : null;
          const cost =
            responseModel === admittedConfig.model
              ? ai.costOf(parsed.usage, snapshot.prices, admittedConfig.model)
              : null;
          const meta = attemptMeta(p, parsed, cost);
          if (parsed.ok && meta.usage_known) {
            result = await dispatch(
              'apply',
              { item_id: p.item_id, result: parsed.result, meta, request_hash: p.request_hash },
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
              { attempt_id: p.attempt_id, owner_id: p.owner_id, outcome, meta, request_hash: p.request_hash },
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
