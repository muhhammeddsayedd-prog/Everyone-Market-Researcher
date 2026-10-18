import 'server-only';
import { gatewayRequest, gatewayReceipt, trialOperations, type GatewayRequest } from '@emr/shared';
import { authorize, gatewayConfig, type GatewayConfig } from './auth';
import { WorkerFailure } from './errors';
type SafeLog = {
  operation: string;
  requestId: string | null;
  outcome: string;
  status: number;
  elapsedMs: number;
};
interface Dependencies {
  environment: () => Record<string, string | undefined>;
  dispatch: (request: GatewayRequest, config: GatewayConfig, signal: AbortSignal) => Promise<unknown>;
  log: (record: SafeLog) => void;
  deadlineMs?: number;
}
export async function readBody(request: Request, signal: AbortSignal) {
  if (request.headers.get('content-encoding')) throw new WorkerFailure('unsupported_encoding', 415);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? ''))
    throw new WorkerFailure('invalid_content_type', 415);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > 1048576))
    throw new WorkerFailure('body_too_large', 413);
  if (!request.body) throw new WorkerFailure('invalid_request', 400);
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
      const r = await reader.read();
      if (r.done) break;
      bytes += r.value.byteLength;
      if (bytes > 1048576) throw new WorkerFailure('body_too_large', 413);
      chunks.push(r.value);
    }
    if (length !== null && Number(length) !== bytes) throw new WorkerFailure('invalid_request', 400);
    const buffer = Buffer.concat(chunks);
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) as unknown;
    } catch {
      throw new WorkerFailure('invalid_request', 400);
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function response(value: unknown, status: number) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store, private', 'x-content-type-options': 'nosniff' },
  });
}
export function createWorkerHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const start = Date.now();
    let requestId: string | null = null,
      operation = 'rejected',
      outcome = 'rejected',
      status = 503;
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) controller.abort();
    const timer = setTimeout(abort, deps.deadlineMs ?? 20000);
    try {
      const config = gatewayConfig(deps.environment());
      authorize(request, config);
      if (request.method !== 'POST') throw new WorkerFailure('method_not_allowed', 405);
      const input = await readBody(request, controller.signal);
      let parsed: GatewayRequest;
      try {
        parsed = gatewayRequest(input);
      } catch {
        throw new WorkerFailure('invalid_request', 400);
      }
      requestId = parsed.requestId;
      operation = parsed.operation;
      if (!trialOperations.has(parsed.operation)) throw new WorkerFailure('operation_not_permitted', 403);
      if (controller.signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
      // No Promise.race: await the owned database cancellation/cleanup before returning.
      const raw = await deps.dispatch(parsed, config, controller.signal);
      if (controller.signal.aborted) throw new WorkerFailure('outcome_unknown', 503);
      let result;
      try {
        result = gatewayReceipt(raw, parsed.operation);
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
      // This is a closed projection. Never pass request/errors/config to platform logs.
      deps.log({ operation, requestId, outcome, status, elapsedMs: Math.max(0, Date.now() - start) });
    }
  };
}
