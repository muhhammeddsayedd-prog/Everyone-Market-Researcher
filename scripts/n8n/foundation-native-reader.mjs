import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import {
  foundationRuntimeCheckpoint,
  foundationRuntimeNativeReadonlyPin,
  foundationRuntimeObservedGraphHash,
  foundationRuntimeExecutionParameterCandidates,
  diagnoseFoundationRuntimeBaseline,
} from './foundation-runtime-checkpoint.mjs';
import { freezeRuntimeValue } from './foundation-runtime-plan.mjs';
import * as runtimeControl from './foundation-runtime-control.mjs';
import {
  assertFoundationNativeTransport,
  foundationNativeTransportErrorCode,
  foundationNativeTransportErrorDetails,
} from './foundation-native-transport.mjs';
import {
  isFoundationNativeDomainProbeBody,
  projectFoundationNativeDomainDenial,
} from './foundation-live-domain-probe.mjs';

// Private technical-process component. No credential loading, network adapter,
// file access, logging or execution starts. Parsed native DTOs never escape.
export const foundationNativeReaderLimits = Object.freeze({
  responseBytes: 8 * 1024 * 1024,
  timeoutMs: 15000,
  metadataPollsPerId: 8,
  discoveryPagesPerFilter: 2,
  discoveryPageSize: 120,
  metadataFreshMs: 15000,
});
const nativeReceipts = new WeakSet(),
  metadataReceipts = new WeakMap(),
  technical16Qualifications = new WeakMap(),
  readers = new WeakSet();
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const identifier = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const executionId = (v) => typeof v === 'string' && /^[1-9]\d{0,31}$/.test(v);
const sha = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const modes = new Set(['manual', 'integrated', 'error', 'webhook', 'trigger']);
const statuses = new Set(['new', 'running', 'waiting', 'unknown', 'success', 'error', 'canceled', 'crashed']);
const terminal = new Set(['success', 'error', 'canceled', 'crashed']);
// Fixed M03 business alias set from shared n8n-foundation-contracts.ts. The
// TypeScript module has bundler-only extensionless imports; this native Node
// private reader keeps its executable allowlist explicit instead of loading it.
const gatewayOperations = new Set([
  'identity.read',
  'run.start',
  'run.finish',
  'apify.read',
  'apify.completion.read',
  'apify.terminal.read',
  'apify.dataset.read',
  'apify.process',
  'cost.log',
  'settings.read',
  'prices.read',
  'error.log',
  'error.count',
  'health.guard',
  'health.read',
  'fees.accrue',
  'callback.reject',
  'launch.authorize',
  'launch.read',
  'launch.reconcile',
]);
export const foundationNativeFailureCodes = Object.freeze([
  'TRANSPORT_CONFIG',
  'TRANSPORT_BRAND',
  'TRANSPORT_REQUEST',
  'TRANSPORT_DEADLINE',
  'TRANSPORT_DNS',
  'TRANSPORT_FRAMING',
  'TRANSPORT_RESPONSE_LIMIT',
  'TRANSPORT_CLOSE',
  'TRANSPORT_TRUNCATED',
  'TRANSPORT_ABORTED',
  'TRANSPORT_RESPONSE',
  'TRANSPORT_SOCKET',
  'TRANSPORT_TLS',
  'TRANSPORT_STREAM',
  'TRANSPORT_CLOSED',
  'TRANSPORT_STATUS',
  'ADMISSION',
  'READER_BRAND',
  'METADATA_BRAND',
  'RECEIPT_BRAND',
  'SCOPE',
  'CONFIG',
  'SENSITIVE_REFLECTION',
  'STRUCTURE',
  'TRANSPORT_SHAPE',
  'CLOSE',
  'FRAMING',
  'RESPONSE_LIMIT',
  'STREAM',
  'TRUNCATED',
  'JSON',
  'NATIVE_SIZE_LIMIT',
  'DEADLINE',
  'BUSY',
  'PRIVATE_RESPONSE_ARGS',
  'BINDING',
  'METADATA',
  'VERSION',
  'MODE',
  'TIMES',
  'OWNERSHIP_TIME',
  'ARGS',
  'TRACE_ARGS',
  'POLL_LIMIT',
  'NOT_FOUND',
  'HTTP',
  'PARENT',
  'CHILD',
  'CHILD_LIMIT',
  'RUN_DATA',
  'GATEWAY_SOURCE',
  'GATEWAY_PREPARE',
  'GATEWAY_LIMIT',
  'CALLBACK_SOURCE',
  'CALLBACK_PINNED',
  'CURRENT_BODY',
  'PUBLISHED_BODY',
  'TRACE_PUBLISHED',
  'TRACE_PINNED',
  'EXECUTED_BODY',
  'OBSERVATION_CHANGED',
  'EXECUTED_PIN_DATA',
  'REDACTED_DATA',
  'ERROR_DISPATCH_TARGET',
  'TRACE_MODE',
  'TRACE_NODE',
  'TRACE_MISMATCH',
  'DISCOVERY',
  'DISCOVERY_CHANGED',
  'DISCOVERY_CURSOR',
  'DISCOVERY_INCOMPLETE',
  'CLEANUP_ARGS',
  'CLEANUP_QUALIFICATION',
  'CLEANUP_CONTEXT',
  'CLEANUP_TERMINAL',
  'CLEANUP_ROOT_PARENT',
  'CLEANUP_ROOT_CHILD_COUNT',
  'CLEANUP_ROOT_CHILD_IDENTITY',
  'CLEANUP_ROOT_MISSING',
  'CLEANUP_CHILD_PARENT',
  'CLEANUP_CHILD_CHILDREN',
  'CLEANUP_CHILD_MISSING',
  'CLEANUP_CREATED_ORDER',
  'CLEANUP_STARTED_ORDER',
  'CLEANUP_STOPPED_ORDER',
  'CLEANUP_CALL_CONTRACT',
  'CLEANUP_PARENT_WAIT',
  'CLEANUP_ROOT_ERROR',
  'CLEANUP_CHILD_ERROR',
  'CLEANUP_ROOT_CALLBACK',
  'CLEANUP_CHILD_CALLBACK',
  'CLEANUP_KNOWN_CHILD_PROVENANCE_DUPLICATE',
  'CLEANUP_UNKNOWN_CHILD_TREE',
  'CLEANUP_PREFIX_CHECKED',
  'CLEANUP_HTTP',
  'DELETE_ACK',
  'WEBHOOK_ARGS',
  'WEBHOOK_HTTP',
  'STOP_RECEIPT',
  'STOP_ACK',
  'REJECTED',
]);
const safeFailureCodes = new Set(foundationNativeFailureCodes),
  errorCodes = new WeakMap(),
  transportCauses = new WeakMap();
export function foundationNativeReaderErrorCode(error) {
  return errorCodes.get(error) ?? null;
}
export function foundationNativeReaderTransportCause(error) {
  return transportCauses.get(error) ?? null;
}
class NativeReaderError extends Error {
  constructor(code) {
    const safeCode = safeFailureCodes.has(code) ? code : 'REJECTED';
    super('FOUNDATION_NATIVE_' + safeCode);
    errorCodes.set(this, safeCode);
  }
}
const fail = (code) => {
  throw new NativeReaderError(code);
};
const exact = (v, required, optional = []) =>
  object(v) &&
  required.every((k) => Object.hasOwn(v, k)) &&
  Object.keys(v).every((k) => [...required, ...optional].includes(k));
function syncVoid(v) {
  if (v !== undefined) {
    if (v && typeof v.then === 'function') Promise.resolve(v).catch(() => {});
    fail('ADMISSION');
  }
}
function date(v) {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
    Number.isFinite(Date.parse(v))
  );
}
function fixedError(e) {
  if (errorCodes.has(e)) return e;
  const transportCode = foundationNativeTransportErrorCode(e);
  const safe = new NativeReaderError(transportCode === null ? 'REJECTED' : 'TRANSPORT_' + transportCode);
  const cause = foundationNativeTransportErrorDetails(e);
  if (cause !== null) transportCauses.set(safe, cause);
  return safe;
}
function raceAbort(promise, signal) {
  if (signal.aborted) {
    Promise.resolve(promise).catch(() => {});
    return Promise.reject(new NativeReaderError('DEADLINE'));
  }
  return new Promise((resolve, reject) => {
    const abort = () => reject(new NativeReaderError('DEADLINE'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort))
      .catch(() => {});
  });
}
export function assertFoundationNativeReader(reader) {
  if (!readers.has(reader)) fail('READER_BRAND');
  return reader;
}
export function assertFoundationNativeMetadataReceipt(receipt) {
  if (!metadataReceipts.has(receipt)) fail('METADATA_BRAND');
  return receipt;
}
export function assertFoundationNativeReceipt(receipt) {
  if (!nativeReceipts.has(receipt)) fail('RECEIPT_BRAND');
  return receipt;
}
export function assertFoundationTechnical16CleanupQualification(qualification, { reader } = {}) {
  const value = technical16Qualifications.get(qualification);
  if (
    !value ||
    !Object.isFrozen(qualification) ||
    (reader !== undefined && value.reader !== reader) ||
    value.now() < value.observedAt ||
    value.now() - value.observedAt > foundationNativeReaderLimits.metadataFreshMs
  )
    fail('CLEANUP_QUALIFICATION');
  value.assertCurrent();
  // Pin verification can perform bounded local IO. Freshness must still hold
  // after it, immediately before a new mutation can cross the transport gate.
  if (
    value.now() < value.observedAt ||
    value.now() - value.observedAt > foundationNativeReaderLimits.metadataFreshMs
  )
    fail('CLEANUP_QUALIFICATION');
  return qualification;
}
export function claimFoundationTechnical16CleanupQualification(qualification, { reader } = {}) {
  assertFoundationTechnical16CleanupQualification(qualification, { reader });
  const value = technical16Qualifications.get(qualification);
  if (value.claimed) fail('CLEANUP_QUALIFICATION');
  value.claimed = true;
  return qualification;
}

export function createFoundationNativeReader({
  bindings,
  transport,
  admitControlAttempt,
  now = Date.now,
  deadlineAt,
  sensitiveValues,
  bindingValidator = runtimeControl.assertFoundationRuntimeBinding,
}) {
  let refs, byId;
  try {
    parseN8nBindings(bindings);
    refs = structuredClone(bindings.workflowRefs);
    const pins = foundationRuntimeCheckpoint.workflows;
    if (
      bindings.instanceUrl !== 'https://muhhammedsayed.app.n8n.cloud' ||
      bindings.environment !== 'dev' ||
      bindings.runtimeVersion !== '2.43.5' ||
      bindings.projectId !== foundationRuntimeCheckpoint.projectId ||
      Object.keys(refs).length !== 25 ||
      Object.keys(pins).some((k) => refs[k]?.id !== pins[k].id)
    )
      fail('SCOPE');
    byId = new Map(Object.entries(refs).map(([key, r]) => [r.id, key]));
    if (
      byId.size !== 25 ||
      typeof transport?.request !== 'function' ||
      typeof admitControlAttempt !== 'function' ||
      typeof bindingValidator !== 'function' ||
      typeof now !== 'function' ||
      !Number.isFinite(deadlineAt) ||
      deadlineAt <= now() ||
      !Array.isArray(sensitiveValues) ||
      !sensitiveValues.length ||
      sensitiveValues.length > 32 ||
      sensitiveValues.some((v) => typeof v !== 'string' || v.length < 8 || v.length > 8192)
    )
      fail('CONFIG');
  } catch (e) {
    throw fixedError(e);
  }
  const privateValues = [...new Set(sensitiveValues.flatMap((v) => [v, encodeURIComponent(v)]))];
  const overlap = Math.max(...privateValues.map((v) => v.length));
  const readerToken = {},
    polls = new Map(),
    responseClosures = new WeakMap();
  let busy = false,
    requests = 0,
    pendingRequests = 0,
    unclosedResponses = 0,
    currentContext = null,
    lastFailure = null;
  function retainFailure(error) {
    const code = errorCodes.get(error) ?? 'REJECTED';
    const context = currentContext;
    let stage = context?.stage ?? 'unknown';
    let classification =
      code === 'REJECTED'
        ? 'unknown'
        : code === 'DEADLINE' || code === 'TRANSPORT_DEADLINE'
          ? 'timeout'
          : code === 'CLOSE' || code === 'TRANSPORT_CLOSE'
            ? 'closure'
            : code === 'SENSITIVE_REFLECTION'
              ? 'confidentiality'
              : code === 'JSON'
                ? 'parse'
                : [
                      'FRAMING',
                      'RESPONSE_LIMIT',
                      'STREAM',
                      'TRUNCATED',
                      'NATIVE_SIZE_LIMIT',
                      'TRANSPORT_FRAMING',
                      'TRANSPORT_RESPONSE_LIMIT',
                      'TRANSPORT_STREAM',
                      'TRANSPORT_TRUNCATED',
                    ].includes(code)
                  ? 'framing'
                  : code.startsWith('TRANSPORT_')
                    ? 'unknown'
                    : 'contract';
    if (code === 'CLOSE' || code === 'TRANSPORT_CLOSE') stage = 'close';
    if (
      context?.httpStatus !== null &&
      context?.httpStatus !== undefined &&
      context.httpStatus !== 200 &&
      stage === 'projection'
    ) {
      stage = 'http_status';
      classification = 'http';
    }
    lastFailure = Object.freeze({
      version: 1,
      workflowKey: context?.workflowKey ?? null,
      operation: context?.operation ?? 'unknown',
      stage,
      classification,
      code,
      httpStatus: context?.httpStatus ?? null,
    });
  }
  function scope(key) {
    if (!Object.hasOwn(refs, key)) fail('SCOPE');
    return refs[key].id;
  }
  function reflection(s) {
    if (privateValues.some((v) => s.includes(v))) fail('SENSITIVE_REFLECTION');
  }
  function decodedReflection(value, depth = 0) {
    if (depth > 128) fail('STRUCTURE');
    if (typeof value === 'string') return reflection(value);
    if (Array.isArray(value)) {
      for (const item of value) decodedReflection(item, depth + 1);
    } else if (object(value))
      for (const [key, item] of Object.entries(value)) {
        reflection(key);
        decodedReflection(item, depth + 1);
      }
  }
  function responseClosure(response) {
    if (!object(response)) fail('TRANSPORT_SHAPE');
    if (responseClosures.has(response)) return responseClosures.get(response);
    const state = { closed: false, promise: null };
    responseClosures.set(response, state);
    unclosedResponses++;
    if (!response.closed || typeof response.closed.then !== 'function') fail('TRANSPORT_SHAPE');
    state.promise = Promise.resolve(response.closed).then(
      () => {
        state.closed = true;
        unclosedResponses--;
      },
      () => {
        fail('CLOSE');
      },
    );
    state.promise.catch(() => {});
    return state;
  }
  async function consume(response, signal, project, context = null) {
    let iterator,
      result,
      fault = null,
      closure;
    try {
      if (context) {
        context.stage = 'framing';
        context.httpStatus =
          Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599
            ? response.status
            : null;
      }
      closure = responseClosure(response);
      if (
        !Number.isInteger(response.status) ||
        !response.body ||
        typeof response.body[Symbol.asyncIterator] !== 'function'
      )
        fail('TRANSPORT_SHAPE');
      const headers = response.headers ?? {};
      if (!object(headers)) fail('FRAMING');
      const header = (name) => {
        const found = Object.entries(headers).filter(([k]) => k.toLowerCase() === name);
        if (found.length > 1) fail('FRAMING');
        if (!found.length) return null;
        const value = found[0][1];
        if (typeof value !== 'string') fail('FRAMING');
        return value.toLowerCase();
      };
      const length = header('content-length'),
        encoding = header('content-encoding'),
        transfer = header('transfer-encoding'),
        type = header('content-type');
      if (
        (length !== null && !/^\d{1,10}$/.test(length)) ||
        (encoding !== null && encoding !== 'identity') ||
        (transfer !== null && transfer !== 'chunked') ||
        (length !== null && transfer !== null) ||
        (type !== null && !/^application\/json(?:;\s*charset=utf-8)?$/.test(type))
      )
        fail('FRAMING');
      if (length !== null && Number(length) > foundationNativeReaderLimits.responseBytes)
        fail('RESPONSE_LIMIT');
      iterator = response.body[Symbol.asyncIterator]();
      if (context) context.stage = 'body';
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let count = 0,
        text = '',
        tail = '';
      while (true) {
        const next = await raceAbort(iterator.next(), signal);
        if (next.done) break;
        if (!(next.value instanceof Uint8Array)) fail('STREAM');
        count += next.value.byteLength;
        if (count > foundationNativeReaderLimits.responseBytes) fail('RESPONSE_LIMIT');
        const part = decoder.decode(next.value, { stream: true });
        reflection(tail + part);
        tail = (tail + part).slice(-overlap);
        text += part;
      }
      text += decoder.decode();
      if (length !== null && count !== Number(length)) fail('TRUNCATED');
      reflection(text);
      let dto;
      if (context) context.stage = 'parse';
      try {
        dto = JSON.parse(text);
      } catch {
        fail('JSON');
      }
      decodedReflection(dto);
      if (object(dto) && Object.hasOwn(dto, 'dataTooLargeToDisplay') && dto.dataTooLargeToDisplay !== false)
        fail('NATIVE_SIZE_LIMIT');
      if (context) context.stage = 'projection';
      result = project(dto, response.status);
      text = '';
      dto = null;
    } catch (e) {
      fault = fixedError(e);
      try {
        response?.abort?.();
      } catch {}
      try {
        const end = iterator?.return?.();
        if (end && typeof end.then === 'function') Promise.resolve(end).catch(() => {});
      } catch {}
    }
    if (closure?.promise) {
      try {
        await raceAbort(closure.promise, signal);
      } catch {
        if (fault === null) {
          fault = new NativeReaderError('CLOSE');
          if (context) context.stage = 'close';
        }
      }
    }
    if (closure && !closure.closed) fault = fault ?? new NativeReaderError('CLOSE');
    if (signal.aborted || now() >= deadlineAt) fault = fault ?? new NativeReaderError('DEADLINE');
    if (fault) throw fault;
    return result;
  }
  async function exchange(path, project, admission) {
    const context = {
      workflowKey: byId.get(admission?.workflowId) ?? null,
      operation: ['discovery', 'metadata', 'workflow'].includes(admission?.kind) ? admission.kind : 'unknown',
      stage: 'admission',
      httpStatus: null,
    };
    currentContext = context;
    const controller = new AbortController();
    let timer,
      logicalDeadlineAt = deadlineAt;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        context.stage = 'admission';
        if (controller.signal.aborted || now() >= logicalDeadlineAt) fail('DEADLINE');
        if (attempt > 0 && admission?.kind === 'metadata') {
          const count = polls.get(admission.executionId) ?? 0;
          if (count >= foundationNativeReaderLimits.metadataPollsPerId) fail('POLL_LIMIT');
          polls.set(admission.executionId, count + 1);
        }
        try {
          syncVoid(
            attempt === 0
              ? admitControlAttempt(admission)
              : admitControlAttempt(admission, Object.freeze({ retryOfPreviousAttempt: true })),
          );
        } catch (e) {
          throw fixedError(e);
        }
        if (controller.signal.aborted || now() >= logicalDeadlineAt) fail('DEADLINE');
        requests++;
        context.stage = 'request';
        if (timer === undefined) {
          logicalDeadlineAt = Math.min(deadlineAt, now() + foundationNativeReaderLimits.timeoutMs);
          timer = setTimeout(() => controller.abort(), logicalDeadlineAt - now());
        }
        let response;
        try {
          pendingRequests++;
          const requestPromise = Promise.resolve()
            .then(() => {
              if (controller.signal.aborted || now() >= logicalDeadlineAt) fail('DEADLINE');
              return transport.request({ method: 'GET', path, signal: controller.signal });
            })
            .then((value) => {
              if (controller.signal.aborted) {
                try {
                  responseClosure(value);
                } catch {}
                try {
                  value?.abort?.();
                } catch {}
              }
              return value;
            })
            .finally(() => {
              pendingRequests--;
            });
          response = await raceAbort(requestPromise, controller.signal);
        } catch (e) {
          let retry = false;
          if (attempt === 0 && !controller.signal.aborted && now() < logicalDeadlineAt) {
            try {
              assertFoundationNativeTransport(transport);
              const details = foundationNativeTransportErrorDetails(e, transport);
              const state = transport.state();
              retry =
                details !== null &&
                ['REQUEST', 'SOCKET'].includes(details.transportCode) &&
                ['request_error', 'socket_error'].includes(details.origin) &&
                details.nativeOSCode === 'ECONNRESET' &&
                details.responseSeen === false &&
                details.physicalClosureVerified === true &&
                pendingRequests === 0 &&
                unclosedResponses === 0 &&
                state.pendingRequests === 0 &&
                state.unclosedResponses === 0;
            } catch {}
          }
          if (retry) continue;
          throw fixedError(e);
        }
        const result = await consume(response, controller.signal, project, context);
        if (controller.signal.aborted || now() >= logicalDeadlineAt) fail('DEADLINE');
        return result;
      }
      fail('REJECTED');
    } catch (e) {
      controller.abort();
      throw fixedError(e);
    } finally {
      clearTimeout(timer);
    }
  }
  async function exclusive(fn) {
    if (busy) fail('BUSY');
    busy = true;
    currentContext = null;
    try {
      return await fn();
    } catch (e) {
      const safe = fixedError(e);
      retainFailure(safe);
      throw safe;
    } finally {
      busy = false;
    }
  }
  async function privateResponse(response, signal, project) {
    if (!signal || typeof signal.addEventListener !== 'function' || now() >= deadlineAt)
      fail('PRIVATE_RESPONSE_ARGS');
    const ownController = new AbortController(),
      combined = AbortSignal.any([signal, ownController.signal]);
    const timer = setTimeout(
      () => ownController.abort(),
      Math.min(foundationNativeReaderLimits.timeoutMs, deadlineAt - now()),
    );
    try {
      return await consume(response, combined, project);
    } finally {
      clearTimeout(timer);
    }
  }
  function bindingFor(key, value) {
    const b = bindingValidator(value);
    if (b && typeof b.then === 'function') {
      Promise.resolve(b).catch(() => {});
      fail('BINDING');
    }
    if (
      !object(b) ||
      !identifier(b.versionId) ||
      (b.activeVersionId !== null && b.activeVersionId !== b.versionId) ||
      !sha(b.bodyHash) ||
      !object(b.body) ||
      runtimeControl.runtimeGraphHash(b.body) !== b.bodyHash ||
      (b.workflowId !== undefined && b.workflowId !== scope(key))
    )
      fail('BINDING');
    if (Object.hasOwn(b, 'nativeReadonlySettings'))
      foundationRuntimeNativeReadonlyPin({
        key,
        id: scope(key),
        nativeReadonlySettings: b.nativeReadonlySettings,
      });
    return b;
  }
  function observedGraphHash(dto, key, binding) {
    return foundationRuntimeObservedGraphHash(dto, {
      key,
      id: scope(key),
      ...(Object.hasOwn(binding, 'nativeReadonlySettings')
        ? { nativeReadonlySettings: binding.nativeReadonlySettings }
        : {}),
    });
  }
  function executedGraphMatches(snapshot, key, binding, runData) {
    const observed = observedGraphHash(snapshot, key, binding);
    if (observed === binding.bodyHash) return true;
    const candidates = foundationRuntimeExecutionParameterCandidates(binding.body);
    if (observed === runtimeControl.runtimeGraphHash(candidates.nativeDefaults)) return true;
    if (candidates.nativeDefaultsAndSetOutput !== null) {
      const setters = binding.body.nodes.filter((node) => node.type === 'n8n-nodes-base.set');
      const tasks = setters.length === 1 && runData?.[setters[0].name];
      if (
        Array.isArray(tasks) &&
        tasks.length > 0 &&
        tasks.every(object) &&
        observed === runtimeControl.runtimeGraphHash(candidates.nativeDefaultsAndSetOutput)
      )
        return true;
    }
    return false;
  }
  function metadataProjection(row, key, id, { binding, expectedMode, intentAt, list = false } = {}) {
    const workflowId = scope(key);
    // Pinned findManyInWorkflows does not select workflowVersionId/createdAt.
    // Their absence in a list is unknown candidate metadata, never a fence.
    // Single-execution metadata and full reads still require an exact version.
    const versionId = row?.workflowVersionId ?? null;
    if (
      !object(row) ||
      row.id !== id ||
      row.workflowId !== workflowId ||
      (!identifier(versionId) && !(list && versionId === null)) ||
      !modes.has(row.mode) ||
      !statuses.has(row.status) ||
      !Object.hasOwn(row, 'startedAt') ||
      !Object.hasOwn(row, 'stoppedAt') ||
      !Object.hasOwn(row, 'waitTill') ||
      row.dataTooLargeToDisplay === true
    )
      fail('METADATA');
    if (binding && versionId !== binding.versionId) fail('VERSION');
    if (expectedMode !== undefined && (!modes.has(expectedMode) || row.mode !== expectedMode)) fail('MODE');
    const createdAt = row.createdAt ?? null;
    if (
      (!list && !date(createdAt)) ||
      (createdAt !== null && !date(createdAt)) ||
      [row.startedAt, row.stoppedAt, row.waitTill].some((v) => v !== null && !date(v))
    )
      fail('TIMES');
    if (
      terminal.has(row.status) &&
      (!date(row.startedAt) ||
        !date(row.stoppedAt) ||
        Date.parse(row.stoppedAt) < Date.parse(row.startedAt) ||
        row.waitTill !== null)
    )
      fail('TIMES');
    if ([createdAt, row.startedAt, row.stoppedAt].some((v) => v !== null && Date.parse(v) > now() + 30000))
      fail('TIMES');
    if (
      intentAt !== undefined &&
      (!Number.isFinite(intentAt) || createdAt === null || Date.parse(createdAt) < intentAt - 30000)
    )
      fail('OWNERSHIP_TIME');
    return {
      executionId: id,
      workflowId,
      key,
      versionId,
      mode: row.mode,
      status: row.status,
      createdAt,
      startedAt: row.startedAt,
      stoppedAt: row.stoppedAt,
      waitTill: row.waitTill,
    };
  }
  function metadataArgs(args, allowReceipt = false) {
    if (
      !exact(
        args,
        ['workflowKey', 'executionId'],
        [
          'binding',
          'expectedMode',
          'intentAt',
          ...(allowReceipt ? ['metadataReceipt', 'expectedTraceparent', 'expectedTraceparents'] : []),
        ],
      ) ||
      !executionId(args.executionId) ||
      (args.expectedMode !== undefined && !modes.has(args.expectedMode)) ||
      (args.intentAt !== undefined && !Number.isFinite(args.intentAt))
    )
      fail('ARGS');
    const validTrace = (trace) =>
      typeof trace === 'string' && /^00-(?!0{32}-)[a-f0-9]{32}-(?!0{16}-)[a-f0-9]{16}-01$/.test(trace);
    const singleTrace = args.expectedTraceparent !== undefined;
    const tracePair = args.expectedTraceparents !== undefined;
    if (
      (singleTrace || tracePair) &&
      (args.workflowKey !== 'WF-19' ||
        (args.expectedMode !== undefined && args.expectedMode !== 'webhook') ||
        (singleTrace && tracePair) ||
        (singleTrace && !validTrace(args.expectedTraceparent)) ||
        (tracePair &&
          (!Array.isArray(args.expectedTraceparents) ||
            args.expectedTraceparents.length !== 2 ||
            !args.expectedTraceparents.every(validTrace) ||
            args.expectedTraceparents[0] === args.expectedTraceparents[1])))
    )
      fail('TRACE_ARGS');
    scope(args.workflowKey);
    return args.binding === undefined ? undefined : bindingFor(args.workflowKey, args.binding);
  }
  async function obtainMetadata(args, binding) {
    const count = polls.get(args.executionId) ?? 0;
    if (count >= foundationNativeReaderLimits.metadataPollsPerId) fail('POLL_LIMIT');
    polls.set(args.executionId, count + 1);
    const projected = await exchange(
      '/api/v1/executions/' + args.executionId + '?includeData=false',
      (dto, status) => {
        if (status !== 200) fail(status === 404 ? 'NOT_FOUND' : 'HTTP');
        return metadataProjection(dto, args.workflowKey, args.executionId, { ...args, binding });
      },
      { kind: 'metadata', workflowId: scope(args.workflowKey), executionId: args.executionId },
    );
    const receipt = freezeRuntimeValue({
      kind: 'foundation_native_metadata',
      ...projected,
      observedAt: new Date(now()).toISOString(),
      privacyChecked: true,
      transportClosed: true,
    });
    metadataReceipts.set(receipt, { readerToken, observedAt: now() });
    return receipt;
  }
  function links(data, b, key, id) {
    let nativeParent = null;
    if (data.parentExecution !== undefined) {
      const p = data.parentExecution,
        parentKey = byId.get(p?.workflowId);
      if (
        !object(p) ||
        !executionId(p.executionId) ||
        !parentKey ||
        typeof p.shouldResume !== 'boolean' ||
        p.executionId === id
      )
        fail('PARENT');
      nativeParent = {
        executionId: p.executionId,
        workflowId: p.workflowId,
        key: parentKey,
        shouldResume: p.shouldResume,
      };
    }
    const nativeChildren = [],
      missingNativeChildCalls = [],
      seen = new Set();
    const add = (link, node, run, location) => {
      const childKey = byId.get(link?.workflowId);
      const target =
        typeof node.parameters?.workflowId === 'string'
          ? node.parameters.workflowId
          : node.parameters?.workflowId?.value;
      if (
        !object(link) ||
        !executionId(link.executionId) ||
        !childKey ||
        link.executionId === id ||
        target !== link.workflowId
      )
        fail('CHILD');
      const fingerprint = link.executionId + '|' + node.name + '|' + run + '|' + location;
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      nativeChildren.push({
        executionId: link.executionId,
        workflowId: link.workflowId,
        key: childKey,
        sourceNode: node.name,
        sourceRun: run,
        sourceLocation: location,
      });
      if (nativeChildren.length > 120) fail('CHILD_LIMIT');
    };
    for (const node of b.body.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow')) {
      const runs = data.resultData.runData[node.name] ?? [];
      if (!Array.isArray(runs) || runs.length > 120) fail('RUN_DATA');
      for (let index = 0; index < runs.length; index++) {
        const task = runs[index];
        if (!object(task)) fail('RUN_DATA');
        const before = nativeChildren.length;
        if (task.metadata?.subExecution !== undefined)
          add(task.metadata.subExecution, node, index, 'task_metadata');
        for (const branches of Object.values(task.data ?? {})) {
          if (!Array.isArray(branches)) fail('RUN_DATA');
          for (const branch of branches) {
            if (branch === null) continue;
            if (!Array.isArray(branch)) fail('RUN_DATA');
            for (const item of branch)
              if (item?.metadata?.subExecution !== undefined)
                add(item.metadata.subExecution, node, index, 'output_metadata');
          }
        }
        if (task.metadata?.waitingChildExecutionIds !== undefined) {
          if (
            !Array.isArray(task.metadata.waitingChildExecutionIds) ||
            task.metadata.waitingChildExecutionIds.length > 120
          )
            fail('CHILD');
          const target =
            typeof node.parameters?.workflowId === 'string'
              ? node.parameters.workflowId
              : node.parameters?.workflowId?.value;
          for (const childId of task.metadata.waitingChildExecutionIds)
            add({ executionId: childId, workflowId: target }, node, index, 'waiting_metadata');
        }
        if (nativeChildren.length === before) {
          const target =
            typeof node.parameters?.workflowId === 'string'
              ? node.parameters.workflowId
              : node.parameters?.workflowId?.value;
          const targetKey = byId.get(target);
          if (!targetKey) fail('CHILD');
          missingNativeChildCalls.push({
            key: targetKey,
            targetWorkflowId: target,
            sourceNode: node.name,
            sourceRun: index,
          });
        }
      }
    }
    return { nativeParent, nativeChildren, missingNativeChildCalls };
  }
  function gatewayRequests(data, b, key, id) {
    const rows = [],
      seen = new Set();
    for (const node of b.body.nodes.filter(
      (n) => n.type === 'n8n-nodes-base.code' && n.name.startsWith('Prepare gateway · '),
    )) {
      const runs = data.resultData.runData[node.name];
      if (runs === undefined) continue;
      const code = node.parameters?.jsCode;
      const literal =
        typeof code === 'string' &&
        /createHash\('sha256'\)\.update\(("(?:\\.|[^"\\])*")\+execution\+':'\+purpose\)/.exec(code);
      const operation =
        typeof code === 'string' &&
        /request:\{version:1,requestId:hash\('business'\),operation:"([a-z.]+)",args\}/.exec(code)?.[1];
      if (!literal || !gatewayOperations.has(operation)) fail('GATEWAY_SOURCE');
      let prefix;
      try {
        prefix = JSON.parse(literal[1]);
      } catch {
        fail('GATEWAY_SOURCE');
      }
      const name = node.name.slice('Prepare gateway · '.length);
      if (
        prefix !== 'emr-m03-foundation:' + key + ':' + name + ':' ||
        !Array.isArray(runs) ||
        runs.length > 120
      )
        fail('GATEWAY_SOURCE');
      const h = createHash('sha256')
        .update(prefix + id + ':business')
        .digest('hex');
      const requestId =
        h.slice(0, 8) +
        '-' +
        h.slice(8, 12) +
        '-4' +
        h.slice(13, 16) +
        '-a' +
        h.slice(17, 20) +
        '-' +
        h.slice(20, 32);
      for (const task of runs) {
        const output = task?.data?.main?.[0];
        if (!Array.isArray(output) || output.length !== 1) fail('GATEWAY_PREPARE');
        const request = output[0]?.json?.request;
        if (
          !exact(request, ['version', 'requestId', 'operation', 'args']) ||
          request.version !== 1 ||
          request.requestId !== requestId ||
          request.operation !== operation ||
          !object(request.args)
        )
          fail('GATEWAY_PREPARE');
        if (!seen.has(requestId)) {
          seen.add(requestId);
          rows.push({ requestId, operation });
        }
      }
    }
    if (rows.length > 256) fail('GATEWAY_LIMIT');
    return rows;
  }
  function providerCallback(dto, b, key, mode) {
    if (key !== 'WF-19' || mode !== 'webhook') return null;
    const validator = b.body.nodes.find(
      (n) => n.name === 'Validate callback source' && n.type === 'n8n-nodes-base.code',
    );
    const validated = validator && dto.data.resultData.runData[validator.name];
    if (!Array.isArray(validated) || validated.length === 0) return null;
    if (validated.length !== 1) fail('CALLBACK_SOURCE');
    const output = validated[0]?.data?.main?.[0];
    if (output === undefined) return null;
    if (!Array.isArray(output) || output.length !== 1) fail('CALLBACK_SOURCE');
    const value = output[0]?.json;
    if (
      !exact(value, ['apify_run_id', 'transport', 'params']) ||
      !identifier(value.apify_run_id) ||
      value.transport !== 'webhook' ||
      !Array.isArray(value.params) ||
      value.params.length !== 1 ||
      value.params[0] !== value.apify_run_id
    )
      fail('CALLBACK_SOURCE');
    const hooks = b.body.nodes.filter((n) => n.type === 'n8n-nodes-base.webhook' && n.disabled !== true);
    if (hooks.length !== 1) fail('CALLBACK_SOURCE');
    const hook = hooks[0];
    // toWorkflowSnapshot omits pins. The engine's actual resultData.pinData
    // map, not absence in that snapshot, records supplied execution pins.
    if (object(dto.data.resultData.pinData) && Object.hasOwn(dto.data.resultData.pinData, hook.name))
      fail('CALLBACK_PINNED');
    const runs = dto.data.resultData.runData[hook.name];
    if (!Array.isArray(runs) || runs.length !== 1 || runs[0]?.data?.main?.[0]?.length !== 1)
      fail('CALLBACK_SOURCE');
    const body = runs[0].data.main[0][0]?.json?.body;
    if (
      !object(body) ||
      !['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'].includes(
        body.eventType,
      ) ||
      !object(body.resource) ||
      body.resource.id !== value.apify_run_id
    )
      fail('CALLBACK_SOURCE');
    return { apifyRunId: value.apify_run_id, eventType: body.eventType };
  }
  async function currentBinding(key, b, trace = false) {
    await exchange(
      '/api/v1/workflows/' + scope(key) + '?excludePinnedData=true',
      (dto, status) => {
        if (
          status !== 200 ||
          !object(dto) ||
          dto.id !== scope(key) ||
          dto.versionId !== b.versionId ||
          dto.activeVersionId !== b.activeVersionId ||
          observedGraphHash(dto, key, b) !== b.bodyHash
        )
          fail('CURRENT_BODY');
        if (
          b.activeVersionId !== null &&
          (!object(dto.activeVersion) ||
            dto.activeVersion.versionId !== b.activeVersionId ||
            dto.activeVersion.workflowId !== dto.id ||
            observedGraphHash(
              {
                ...dto,
                nodes: dto.activeVersion.nodes,
                connections: dto.activeVersion.connections,
              },
              key,
              b,
            ) !== b.bodyHash)
        )
          fail('PUBLISHED_BODY');
        if (trace) {
          if (b.activeVersionId !== b.versionId) fail('TRACE_PUBLISHED');
          for (const hook of b.body.nodes.filter((node) => node.type === 'n8n-nodes-base.webhook'))
            if (object(dto.pinData) && Object.hasOwn(dto.pinData, hook.name)) fail('TRACE_PINNED');
        }
        return null;
      },
      { kind: 'workflow', workflowId: scope(key) },
    );
    bindingFor(key, b);
  }
  function fullProjection(dto, status, args, b, m, expectedTraces = null) {
    if (status !== 200) fail(status === 404 ? 'NOT_FOUND' : 'HTTP');
    const projected = metadataProjection(dto, args.workflowKey, args.executionId, {
      ...args,
      binding: b,
    });
    const original = Object.fromEntries(Object.keys(projected).map((k) => [k, m[k]]));
    if (!isDeepStrictEqual(projected, original)) fail('OBSERVATION_CHANGED');
    const snapshot = dto.workflowData;
    // Pinned toWorkflowSnapshot persists source fields only; its native
    // DTO has no activeVersionId. That fence belongs to currentBinding
    // above, while execution identity uses workflowVersionId and this
    // persisted source-body hash.
    if (
      !object(snapshot) ||
      snapshot.id !== scope(args.workflowKey) ||
      !executedGraphMatches(snapshot, args.workflowKey, b, dto.data?.resultData?.runData) ||
      !object(dto.data) ||
      !object(dto.data.resultData) ||
      !object(dto.data.resultData.runData) ||
      Object.keys(dto.data.resultData.runData).some(
        (name) => !b.body.nodes.some((node) => node.name === name),
      )
    )
      fail('EXECUTED_BODY');
    const executedPins = dto.data.resultData.pinData;
    if (executedPins !== undefined) {
      if (!object(executedPins)) fail('EXECUTED_PIN_DATA');
      if (Object.keys(executedPins).length) {
        // Pinned execute-workflow.tool's no-input ManualTrigger path
        // creates this empty bootstrap item itself. It supplies no
        // business data and is the sole accepted nonempty pin map.
        const triggers = b.body.nodes.filter(
          (n) =>
            n.disabled !== true &&
            [
              'n8n-nodes-base.manualTrigger',
              'n8n-nodes-base.scheduleTrigger',
              'n8n-nodes-base.webhook',
              'n8n-nodes-base.formTrigger',
              '@n8n/n8n-nodes-langchain.chatTrigger',
            ].includes(n.type),
        );
        const trigger = triggers[0],
          items = trigger && executedPins[trigger.name];
        if (
          projected.mode !== 'manual' ||
          b.body.settings.availableInMCP !== true ||
          triggers.length !== 1 ||
          trigger.type !== 'n8n-nodes-base.manualTrigger' ||
          !exact(executedPins, [trigger.name]) ||
          !Array.isArray(items) ||
          items.length !== 1 ||
          !exact(items[0], ['json']) ||
          !exact(items[0].json, [])
        )
          fail('EXECUTED_PIN_DATA');
      }
    }
    if (
      dto.data.redactionInfo !== undefined &&
      (!object(dto.data.redactionInfo) ||
        dto.data.redactionInfo.isRedacted !== false ||
        dto.data.redactionInfo.provisional === true)
    )
      fail('REDACTED_DATA');
    const errorTarget = b.body.settings.errorWorkflow;
    if (errorTarget !== undefined && errorTarget !== refs['WF-90'].id) fail('ERROR_DISPATCH_TARGET');
    const errorDispatchExpected =
      projected.mode !== 'manual' &&
      projected.status === 'error' &&
      errorTarget === refs['WF-90'].id &&
      projected.workflowId !== refs['WF-90'].id;
    let traceparent;
    if (expectedTraces !== null) {
      if (projected.mode !== 'webhook') fail('TRACE_MODE');
      const hooks = b.body.nodes.filter(
        (node) => node.type === 'n8n-nodes-base.webhook' && node.disabled !== true,
      );
      if (hooks.length !== 1) fail('TRACE_NODE');
      const hook = hooks[0];
      if (object(dto.data.resultData.pinData) && Object.hasOwn(dto.data.resultData.pinData, hook.name))
        fail('TRACE_PINNED');
      const runs = dto.data.resultData.runData[hook.name];
      const actualTrace = runs?.[0]?.data?.main?.[0]?.[0]?.json?.headers?.traceparent;
      if (
        !Array.isArray(runs) ||
        runs.length !== 1 ||
        runs[0]?.data?.main?.[0]?.length !== 1 ||
        !expectedTraces.includes(actualTrace)
      )
        fail('TRACE_MISMATCH');
      traceparent = actualTrace;
    }
    const domain =
      args.workflowKey === 'WF-99' &&
      typeof b.runtimeAudience === 'string' &&
      isFoundationNativeDomainProbeBody(b.body, { runtimeAudience: b.runtimeAudience });
    const nativeDomainDenial = domain
      ? projectFoundationNativeDomainDenial({
          resultData: dto.data.resultData,
          body: b.body,
          runtimeAudience: b.runtimeAudience,
        })
      : null;
    return {
      ...projected,
      ...links(dto.data, b, args.workflowKey, args.executionId),
      nativeGatewayRequests: gatewayRequests(dto.data, b, args.workflowKey, args.executionId),
      nativeProviderCallback: providerCallback(dto, b, args.workflowKey, projected.mode),
      ...(nativeDomainDenial ? { nativeDomainDenial } : {}),
      errorDispatchExpected,
      ...(traceparent ? { traceparent } : {}),
    };
  }
  async function discoverCandidates(args) {
    if (
      !exact(args, ['workflowKey', 'baselineIds']) ||
      !Array.isArray(args.baselineIds) ||
      args.baselineIds.length > 240 ||
      args.baselineIds.some((id) => !executionId(id)) ||
      new Set(args.baselineIds).size !== args.baselineIds.length
    )
      fail('ARGS');
    const workflowId = scope(args.workflowKey),
      rows = new Map(),
      baseline = new Set(args.baselineIds);
    for (const running of [false, true]) {
      let cursor = null;
      const cursors = new Set();
      for (let page = 0; page < foundationNativeReaderLimits.discoveryPagesPerFilter; page++) {
        const path =
          '/api/v1/executions?workflowId=' +
          workflowId +
          '&includeData=false&limit=120' +
          (running ? '&status=running' : '') +
          (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        const next = await exchange(
          path,
          (dto, status) => {
            if (
              status !== 200 ||
              !object(dto) ||
              !Array.isArray(dto.data) ||
              dto.data.length > 120 ||
              !Object.hasOwn(dto, 'nextCursor') ||
              (dto.nextCursor !== null &&
                (typeof dto.nextCursor !== 'string' || !/^[\x21-\x7e]{1,400}$/.test(dto.nextCursor)))
            )
              fail('DISCOVERY');
            for (const row of dto.data) {
              if (!executionId(row?.id)) fail('DISCOVERY');
              const r = metadataProjection(row, args.workflowKey, row.id, { list: true });
              if (rows.has(r.executionId) && !isDeepStrictEqual(rows.get(r.executionId), r))
                fail('DISCOVERY_CHANGED');
              rows.set(r.executionId, r);
            }
            return dto.nextCursor;
          },
          { kind: 'discovery', workflowId },
        );
        if (next === null) {
          cursor = null;
          break;
        }
        if (cursors.has(next)) fail('DISCOVERY_CURSOR');
        cursors.add(next);
        cursor = next;
      }
      if (cursor !== null) fail('DISCOVERY_INCOMPLETE');
    }
    return freezeRuntimeValue({
      kind: 'foundation_native_candidates',
      workflowId,
      key: args.workflowKey,
      candidates: [...rows.values()].filter((r) => !baseline.has(r.executionId)),
      paginationComplete: true,
      adoptionProven: false,
      drainProven: false,
      observedAt: new Date(now()).toISOString(),
      privacyChecked: true,
      transportClosed: true,
    });
  }
  function cleanupProjection(dto, status, receipt, operation) {
    if (operation === 'absence') {
      if (status !== 404 && status !== 200) fail('CLEANUP_HTTP');
      if (status === 200) {
        const current = metadataProjection(dto, receipt.key, receipt.executionId, {
          expectedMode: receipt.mode,
        });
        if (current.versionId !== receipt.versionId) fail('VERSION');
      }
      return freezeRuntimeValue({
        kind: 'foundation_native_absence',
        executionId: receipt.executionId,
        absent: status === 404,
        transportClosed: true,
        privacyChecked: true,
      });
    }
    if (
      status !== 200 ||
      !object(dto) ||
      !Number.isSafeInteger(dto.id) ||
      dto.id <= 0 ||
      String(dto.id) !== receipt.executionId
    )
      fail('DELETE_ACK');
    const projected = metadataProjection({ ...dto, id: String(dto.id) }, receipt.key, receipt.executionId, {
      expectedMode: receipt.mode,
    });
    for (const key of ['workflowId', 'versionId', 'mode', 'status', 'startedAt', 'stoppedAt'])
      if (projected[key] !== receipt[key]) fail('DELETE_ACK');
    return freezeRuntimeValue({
      kind: 'foundation_native_delete_ack',
      executionId: receipt.executionId,
      workflowId: receipt.workflowId,
      versionId: receipt.versionId,
      mode: receipt.mode,
      status: receipt.status,
      startedAt: receipt.startedAt,
      stoppedAt: receipt.stoppedAt,
      acknowledged: true,
      transportClosed: true,
      privacyChecked: true,
    });
  }
  const reader = {
    qualifyTechnical16Cleanup(args) {
      return exclusive(async () => {
        if (
          !exact(args, ['context'], ['qualificationOnly']) ||
          (Object.hasOwn(args, 'qualificationOnly') && args.qualificationOnly !== true)
        )
          fail('CLEANUP_ARGS');
        let context;
        try {
          const { assertTechnical16CleanupContext } = await import('./foundation-provision-cli.mjs');
          context = assertTechnical16CleanupContext(args.context);
        } catch {
          fail('CLEANUP_CONTEXT');
        }
        if (context.bindings.projectId !== bindings.projectId || context.baseline.length !== 25)
          fail('CLEANUP_CONTEXT');
        const readOwned = async (key, id, binding, expectedMode) => {
          const args = { workflowKey: key, executionId: id, expectedMode, intentAt: context.intentAt };
          const metadata = await obtainMetadata(args, binding);
          if (metadata.status !== 'success' || metadata.waitTill !== null) fail('CLEANUP_TERMINAL');
          const output = await exchange(
            '/api/v1/executions/' + id + '?includeData=true',
            (dto, status) => fullProjection(dto, status, args, binding, metadata),
            { kind: 'full', workflowId: scope(key), executionId: id },
          );
          return freezeRuntimeValue({
            ...output,
            bodyHash: binding.bodyHash,
            observedAt: new Date(now()).toISOString(),
            privacyChecked: true,
            transportClosed: true,
          });
        };
        const root = await readOwned('WF-00', '31130', context.rootBinding, 'manual');
        const child = await readOwned('WF-10', '31131', context.childBinding, 'integrated');
        currentContext = {
          workflowKey: 'WF-00',
          operation: 'cleanup_qualification',
          stage: 'qualification',
          httpStatus: null,
        };
        // Keep every original predicate. Fixed codes expose only which known
        // invariant failed, never native payloads, names, dates or URLs.
        if (root.nativeParent !== null) fail('CLEANUP_ROOT_PARENT');
        if (root.missingNativeChildCalls.length !== 0) fail('CLEANUP_ROOT_MISSING');
        if (
          child.nativeParent?.executionId !== '31130' ||
          child.nativeParent.workflowId !== root.workflowId ||
          child.nativeParent.key !== 'WF-00'
        )
          fail('CLEANUP_CHILD_PARENT');
        if (child.nativeChildren.length !== 0) fail('CLEANUP_CHILD_CHILDREN');
        if (child.missingNativeChildCalls.length !== 0) fail('CLEANUP_CHILD_MISSING');
        if (Date.parse(child.createdAt) < Date.parse(root.createdAt)) fail('CLEANUP_CREATED_ORDER');
        if (Date.parse(child.startedAt) < Date.parse(root.startedAt)) fail('CLEANUP_STARTED_ORDER');
        const calls = context.rootBinding.body.nodes.filter(
          (node) =>
            node.type === 'n8n-nodes-base.executeWorkflow' &&
            (node.parameters?.workflowId?.value ?? node.parameters?.workflowId) === child.workflowId,
        );
        const call = calls[0],
          wait = call?.parameters?.options?.waitForSubWorkflow;
        if (
          calls.length !== 1 ||
          call.disabled === true ||
          call.parameters.source !== 'database' ||
          call.parameters.mode !== 'once' ||
          typeof wait !== 'boolean'
        )
          fail('CLEANUP_CALL_CONTRACT');
        if (child.nativeParent.shouldResume !== wait) fail('CLEANUP_PARENT_WAIT');
        if (root.nativeChildren.some((link) => link.sourceNode !== call.name || link.sourceRun !== 0))
          fail('CLEANUP_UNKNOWN_CHILD_TREE');
        // Pinned ExecuteWorkflow.once passes doNotWaitToFinish:!wait and
        // shouldResume:wait. An explicitly asynchronous child may finish later;
        // both records must still be terminal, reciprocal and fully drained.
        if (wait && Date.parse(child.stoppedAt) > Date.parse(root.stoppedAt)) fail('CLEANUP_STOPPED_ORDER');
        if (root.errorDispatchExpected) fail('CLEANUP_ROOT_ERROR');
        if (child.errorDispatchExpected) fail('CLEANUP_CHILD_ERROR');
        if (root.nativeProviderCallback !== null) fail('CLEANUP_ROOT_CALLBACK');
        if (child.nativeProviderCallback !== null) fail('CLEANUP_CHILD_CALLBACK');
        const knownChild = (link) =>
          link.executionId === '31131' && link.key === 'WF-10' && link.workflowId === child.workflowId;
        if (root.nativeChildren.length > 1) {
          // This diagnostic proves all other predicates above before naming
          // equivalent provenance. It does not accept duplicates or mint a
          // cleanup qualification; unknown/conflicting links remain distinct.
          const first = root.nativeChildren[0],
            locations = new Set(root.nativeChildren.map((link) => link.sourceLocation));
          if (
            root.nativeChildren.every(
              (link) =>
                knownChild(link) &&
                link.sourceNode === first.sourceNode &&
                link.sourceRun === first.sourceRun &&
                ['task_metadata', 'output_metadata', 'waiting_metadata'].includes(link.sourceLocation),
            ) &&
            locations.size === root.nativeChildren.length
          )
            fail('CLEANUP_KNOWN_CHILD_PROVENANCE_DUPLICATE');
          fail('CLEANUP_UNKNOWN_CHILD_TREE');
        }
        if (root.nativeChildren.length !== 1) fail('CLEANUP_ROOT_CHILD_COUNT');
        if (!knownChild(root.nativeChildren[0])) fail('CLEANUP_ROOT_CHILD_IDENTITY');
        // A read-only diagnostic stops before discovery, canonical reads,
        // qualification branding or any mutation port can become available.
        if (args.qualificationOnly === true) fail('CLEANUP_PREFIX_CHECKED');
        const owned = new Map([
          [root.executionId, root],
          [child.executionId, child],
        ]);
        for (const baseline of context.baseline) {
          const scan = await discoverCandidates({ workflowKey: baseline.key, baselineIds: [] });
          if (!scan.paginationComplete) fail('DISCOVERY_INCOMPLETE');
          for (const candidate of scan.candidates) {
            const expected = owned.get(candidate.executionId);
            if (
              !expected ||
              candidate.key !== expected.key ||
              candidate.status !== expected.status ||
              candidate.mode !== expected.mode ||
              candidate.startedAt !== expected.startedAt ||
              candidate.stoppedAt !== expected.stoppedAt ||
              candidate.waitTill !== null ||
              (candidate.versionId !== null && candidate.versionId !== expected.versionId)
            )
              fail('CLEANUP_QUALIFICATION');
          }
        }
        // Current restored drafts are fenced separately from immutable executed
        // snapshots. Restored version changes never weaken currentBinding(read).
        for (const baseline of context.baseline) {
          if (scope(baseline.key) !== baseline.id) fail('SCOPE');
          await exchange(
            '/api/v1/workflows/' + baseline.id + '?excludePinnedData=true',
            (dto, status) => {
              if (
                status !== 200 ||
                diagnoseFoundationRuntimeBaseline(dto, baseline, bindings.projectId).failedChecks.length
              )
                fail('CURRENT_BODY');
              return null;
            },
            { kind: 'workflow', workflowId: baseline.id },
          );
        }
        // Refresh both terminal observations after the bounded inventories.
        for (const receipt of [child, root]) {
          const metadata = await obtainMetadata(
            {
              workflowKey: receipt.key,
              executionId: receipt.executionId,
              expectedMode: receipt.mode,
              intentAt: context.intentAt,
            },
            receipt.key === 'WF-00' ? context.rootBinding : context.childBinding,
          );
          for (const key of [
            'versionId',
            'mode',
            'status',
            'createdAt',
            'startedAt',
            'stoppedAt',
            'waitTill',
          ])
            if (metadata[key] !== receipt[key]) fail('OBSERVATION_CHANGED');
        }
        context.assertCurrent();
        const qualification = freezeRuntimeValue({
          kind: 'foundation_technical16_cleanup_qualification',
          version: 1,
          technicalAttempt: 16,
          windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
          sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
          batchId: 'technical16-postclose-native-cleanup',
          caseId: 'dispatch.vimeo-reconciliation',
          owner: 'Mohamed Abdelrahman',
          records: [child, root],
          executionIds: ['31131', '31130'],
          canonicalWorkflowsVerified: 25,
          inventoryComplete: true,
          settled: true,
          observedAt: new Date(now()).toISOString(),
          acceptanceProven: false,
          liveClosureMinted: false,
        });
        technical16Qualifications.set(qualification, {
          reader,
          now,
          observedAt: now(),
          claimed: false,
          assertCurrent: context.assertCurrent,
        });
        return qualification;
      });
    },
    technical16CleanupResponse({ response, qualification, executionId, operation, signal }) {
      return exclusive(async () => {
        // A new DELETE requires fresh qualification. Processing the response to
        // an already issued intent cannot acquire new mutation authority.
        const info = technical16Qualifications.get(qualification);
        if (
          !info ||
          info.reader !== reader ||
          !info.claimed ||
          !signal ||
          typeof signal.addEventListener !== 'function' ||
          !['delete_ack', 'absence'].includes(operation)
        )
          fail('CLEANUP_ARGS');
        info.assertCurrent();
        const receipt = qualification.records.find((value) => value.executionId === executionId);
        if (!receipt) fail('CLEANUP_ARGS');
        return privateResponse(response, signal, (dto, status) =>
          cleanupProjection(dto, status, receipt, operation),
        );
      });
    },
    verifyBinding(args) {
      return exclusive(async () => {
        if (!exact(args, ['workflowKey', 'binding'])) fail('ARGS');
        const b = bindingFor(args.workflowKey, args.binding);
        await currentBinding(args.workflowKey, b);
        return freezeRuntimeValue({
          kind: 'foundation_native_binding',
          workflowId: scope(args.workflowKey),
          key: args.workflowKey,
          versionId: b.versionId,
          activeVersionId: b.activeVersionId,
          bodyHash: b.bodyHash,
          observedAt: new Date(now()).toISOString(),
          transportClosed: true,
          privacyChecked: true,
        });
      });
    },
    metadata(args) {
      return exclusive(async () => {
        const b = metadataArgs(args);
        return obtainMetadata(args, b);
      });
    },
    read(args) {
      return exclusive(async () => {
        const b = metadataArgs(args, true);
        // Freeze the exact one/two correlation values before any private call;
        // a caller-owned pair must not widen while native responses arrive.
        const expectedTraces =
          args.expectedTraceparents !== undefined
            ? Object.freeze([...args.expectedTraceparents])
            : args.expectedTraceparent !== undefined
              ? Object.freeze([args.expectedTraceparent])
              : null;
        if (!b) fail('BINDING');
        let m = args.metadataReceipt;
        if (m !== undefined) {
          const info = metadataReceipts.get(m);
          if (
            !info ||
            info.readerToken !== readerToken ||
            now() - info.observedAt < 0 ||
            now() - info.observedAt > foundationNativeReaderLimits.metadataFreshMs ||
            m.executionId !== args.executionId ||
            m.key !== args.workflowKey ||
            m.versionId !== b.versionId ||
            (args.expectedMode !== undefined && m.mode !== args.expectedMode)
          )
            fail('METADATA_BRAND');
        } else m = await obtainMetadata(args, b);
        if (
          args.intentAt !== undefined &&
          (!Number.isFinite(args.intentAt) || Date.parse(m.createdAt) < args.intentAt - 30000)
        )
          fail('OWNERSHIP_TIME');
        await currentBinding(
          args.workflowKey,
          b,
          expectedTraces !== null || (args.workflowKey === 'WF-19' && m.mode === 'webhook'),
        );
        const output = await exchange(
          '/api/v1/executions/' + args.executionId + '?includeData=true',
          (dto, status) => fullProjection(dto, status, args, b, m, expectedTraces),
          { kind: 'full', workflowId: scope(args.workflowKey), executionId: args.executionId },
        );
        bindingFor(args.workflowKey, args.binding);
        const receipt = freezeRuntimeValue({
          kind: 'foundation_native_receipt',
          ...output,
          bodyHash: b.bodyHash,
          observedAt: new Date(now()).toISOString(),
          privacyChecked: true,
          transportClosed: true,
        });
        nativeReceipts.add(receipt);
        return receipt;
      });
    },
    discover(args) {
      return exclusive(() => discoverCandidates(args));
    },
    cleanupResponse({ response, receipt, operation, signal }) {
      return exclusive(async () => {
        assertFoundationNativeReceipt(receipt);
        if (
          !signal ||
          typeof signal.addEventListener !== 'function' ||
          !['delete_ack', 'absence'].includes(operation) ||
          now() >= deadlineAt
        )
          fail('CLEANUP_ARGS');
        return privateResponse(response, signal, (dto, status) =>
          cleanupProjection(dto, status, receipt, operation),
        );
      });
    },
    webhookResponse({ response, signal, expectedHttpStatus }) {
      return exclusive(async () => {
        if (expectedHttpStatus !== undefined && ![200, 403, 500].includes(expectedHttpStatus))
          fail('WEBHOOK_ARGS');
        return privateResponse(response, signal, (_dto, status) => {
          // The fixed unknown-run branch deliberately responds403. Opting into
          // that exact expected result does not accept other auth/route errors.
          if (expectedHttpStatus === undefined ? ![200, 500].includes(status) : status !== expectedHttpStatus)
            fail('WEBHOOK_HTTP');
          return freezeRuntimeValue({
            kind: 'foundation_native_webhook_ack',
            httpStatus: status,
            transportClosed: true,
            privacyChecked: true,
          });
        });
      });
    },
    stopResponse({ response, receipt, signal }) {
      return exclusive(async () => {
        if (!nativeReceipts.has(receipt) && !metadataReceipts.has(receipt)) fail('STOP_RECEIPT');
        return privateResponse(response, signal, (dto, status) => {
          if (status === 404 || status === 409)
            return freezeRuntimeValue({
              kind: 'foundation_native_stop_ack',
              executionId: receipt.executionId,
              httpStatus: status,
              cancellationAcknowledged: false,
              completionProven: false,
              transportClosed: true,
              privacyChecked: true,
            });
          if (
            status !== 200 ||
            !object(dto) ||
            dto.mode !== receipt.mode ||
            !statuses.has(dto.status) ||
            !date(dto.startedAt) ||
            dto.startedAt !== receipt.startedAt ||
            typeof dto.finished !== 'boolean' ||
            (dto.stoppedAt !== undefined && dto.stoppedAt !== null && !date(dto.stoppedAt))
          )
            fail('STOP_ACK');
          return freezeRuntimeValue({
            kind: 'foundation_native_stop_ack',
            executionId: receipt.executionId,
            workflowId: receipt.workflowId,
            key: receipt.key,
            versionId: receipt.versionId,
            httpStatus: 200,
            mode: dto.mode,
            status: dto.status,
            startedAt: dto.startedAt,
            stoppedAt: dto.stoppedAt ?? null,
            cancellationAcknowledged: true,
            completionProven: false,
            transportClosed: true,
            privacyChecked: true,
          });
        });
      });
    },
    state() {
      return Object.freeze({ requests, pendingRequests, unclosedResponses, busy });
    },
    lastFailure() {
      return lastFailure;
    },
  };
  Object.freeze(reader);
  readers.add(reader);
  return reader;
}
