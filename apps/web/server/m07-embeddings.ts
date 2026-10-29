import 'server-only';
import { m07EmbeddingRequest, type M07EmbeddingDispatch } from '@emr/shared';
import { authorizeM07, m07GatewayConfig } from './m07-gateway';
import { WorkerFailure } from './n8n-worker/errors';
import { readBody } from './n8n-worker/dispatcher';
import { validateEmbeddingSnapshot, inputContractVersion } from '../../../n8n/ai/embedding-contracts.mjs';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const fail = () => new WorkerFailure('reconciliation_required', 503);
export function embeddingConfig(env: Record<string, string | undefined>) {
  const base = m07GatewayConfig(env);
  const batchSize = Number(env.EMR_M07_EMBED_BATCH_SIZE ?? '4');
  const maxInputBytes = Number(env.EMR_M07_EMBED_MAX_INPUT_BYTES ?? '4096');
  const maxTotalBytes = Number(env.EMR_M07_EMBED_MAX_TOTAL_BYTES ?? '16384');
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(env.OPENAI_MODEL_EMBED ?? '') ||
    !Number.isSafeInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 20 ||
    !Number.isSafeInteger(maxInputBytes) ||
    maxInputBytes < 1 ||
    maxInputBytes > 8192 ||
    !Number.isSafeInteger(maxTotalBytes) ||
    maxTotalBytes < maxInputBytes ||
    maxTotalBytes > 300000
  )
    throw new WorkerFailure('unavailable', 503);
  return { ...base, model: env.OPENAI_MODEL_EMBED!, batchSize, maxInputBytes, maxTotalBytes };
}
function receipt(value: unknown, args: Record<string, unknown>, config?: ReturnType<typeof embeddingConfig>) {
  if (
    !object(value) ||
    value.batch_id !== args.batch_id ||
    value.owner_id !== args.owner_id ||
    !['claimed', 'prepared', 'dispatched', 'completed', 'failed', 'unknown'].includes(String(value.state))
  )
    throw fail();
  if (config?.embeddingEntities) {
    const mapping = object(value.snapshot) ? value.snapshot.mapping : value.messages;
    const allowed = new Set(config.embeddingEntities.map((v) => v.entity_type + ':' + v.entity_id));
    if (
      !Array.isArray(mapping) ||
      mapping.some((v) => !object(v) || !allowed.has(v.entity_type + ':' + v.entity_id))
    )
      throw new WorkerFailure('forbidden', 403);
  }
  return value;
}
async function prepared(
  dispatch: M07EmbeddingDispatch,
  args: Record<string, unknown>,
  config: ReturnType<typeof embeddingConfig>,
  signal: AbortSignal,
) {
  const current = receipt(await dispatch('status', args, signal), args, config);
  if (object(current.snapshot)) {
    if (
      (current.state !== 'completed' && !validateEmbeddingSnapshot(current.snapshot)) ||
      !/^[a-f0-9]{64}$/.test(String(current.request_hash))
    )
      throw fail();
    return current;
  }
  const p = receipt(
    await dispatch(
      'prepare',
      {
        ...args,
        model: config.model,
        input_version: inputContractVersion,
        settings: {
          max_input_bytes: config.maxInputBytes,
          max_total_bytes: config.maxTotalBytes,
          accounting_mode: config.accountingMode,
        },
      },
      signal,
    ),
    args,
    config,
  );
  if (
    (p.state !== 'completed' && !validateEmbeddingSnapshot(p.snapshot)) ||
    !/^[a-f0-9]{64}$/.test(String(p.request_hash))
  )
    throw fail();
  return p;
}
export function createEmbeddingHandler(deps: {
  environment: () => Record<string, string | undefined>;
  database: (connection: string, profile?: 'local' | 'dev') => M07EmbeddingDispatch;
}) {
  return async (request: Request) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const timeout = setTimeout(abort, 30000);
    let requestId: string | null = null;
    try {
      const config = embeddingConfig(deps.environment());
      authorizeM07(request, config, '/api/internal/m07/embed');
      const input = m07EmbeddingRequest.safeParse(await readBody(request, controller.signal));
      if (!input.success) throw new WorkerFailure('invalid_request', 400);
      const { operation, args } = input.data;
      requestId = input.data.requestId;
      const dispatch = deps.database(config.databaseUrl, config.profile);
      let result: unknown;
      if (operation === 'claim')
        result = await dispatch(
          'claim',
          { ...args, limit: config.batchSize, allowed_entities: config.embeddingEntities },
          controller.signal,
        );
      else if (operation === 'status' || operation === 'ack') {
        if (config.embeddingEntities)
          receipt(await dispatch('status', args, controller.signal), args, config);
        result = await dispatch(operation, args, controller.signal);
      } else {
        const p = await prepared(dispatch, args, config, controller.signal);
        const snapshot = p.snapshot as Record<string, unknown>;
        if (operation === 'prepare')
          result = { ...p, provider_request: p.state === 'prepared' ? snapshot.provider_request : null };
        else if (operation === 'dispatch') {
          const admitted = receipt(
            await dispatch('dispatch', { ...args, request_hash: p.request_hash }, controller.signal),
            args,
          );
          result = {
            ...admitted,
            provider_request: admitted.admitted === true ? snapshot.provider_request : null,
          };
        } else if (operation === 'outcome.unknown')
          result = await dispatch('unknown', { ...args, request_hash: p.request_hash }, controller.signal);
        else {
          const settings = object(snapshot.settings) ? snapshot.settings : {};
          result = await dispatch(
            'settle',
            {
              ...args,
              request_hash: p.request_hash,
              accounting_mode: settings.accounting_mode,
              provider_response: args.provider_response,
            },
            controller.signal,
          );
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
