import { request as httpsRequest } from 'node:https';
import { Transform } from 'node:stream';
import { types } from 'node:util';
import { parseN8nBindings } from '../../packages/shared/src/n8n-bindings.ts';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import { validateFoundationAddresses } from './foundation-management-transport.mjs';
import { resolveInstance } from './inventory.mjs';
import { consumeFoundationCallbackCase } from './foundation-callback-cases.mjs';

// A private streaming transport, not a credential loader, executor or admission
// grant. No parsed DTO, response body, key or native error is logged/returned.
// Node's `complete` is a separate parser-completeness check, not socket closure:
// https://nodejs.org/docs/latest-v24.x/api/http.html#messagecomplete
const host = 'muhhammedsayed.app.n8n.cloud';
const responseBytes = 8 * 1024 * 1024;
const transports = new WeakSet();
const transportErrors = new WeakMap();
const transportErrorDetails = new WeakMap(),
  transportOwners = new WeakMap();
const nativeErrorCodes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EADDRNOTAVAIL',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ABORT_ERR',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);
export const foundationNativeTransportFailureCodes = Object.freeze([
  'CONFIG',
  'BRAND',
  'REQUEST',
  'DEADLINE',
  'DNS',
  'FRAMING',
  'RESPONSE_LIMIT',
  'CLOSE',
  'TRUNCATED',
  'ABORTED',
  'RESPONSE',
  'SOCKET',
  'TLS',
  'STREAM',
  'CLOSED',
  'STATUS',
]);
const transportFailureCodes = new Set(foundationNativeTransportFailureCodes);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const executionId = (v) => /^[1-9]\d{0,31}$/.test(v);
const fixed = (code, details = null, owner = null) => {
  const safeCode = transportFailureCodes.has(code) ? code : 'REQUEST';
  const error = Error('FOUNDATION_NATIVE_TRANSPORT_' + safeCode);
  transportErrors.set(error, safeCode);
  if (details !== null)
    transportErrorDetails.set(error, {
      owner,
      value: Object.freeze({ transportCode: safeCode, ...details }),
    });
  return error;
};
export function foundationNativeTransportErrorCode(error) {
  return transportErrors.get(error) ?? null;
}
export function foundationNativeTransportErrorDetails(error, transport) {
  const entry = transportErrorDetails.get(error);
  if (!entry || (transport !== undefined && transportOwners.get(transport) !== entry.owner)) return null;
  return entry.value;
}
function nativeErrorCode(error) {
  if (!types.isNativeError(error)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
  return descriptor &&
    Object.hasOwn(descriptor, 'value') &&
    typeof descriptor.value === 'string' &&
    nativeErrorCodes.has(descriptor.value)
    ? descriptor.value
    : null;
}
const fail = (code) => {
  throw fixed(code);
};
function raceAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(fixed('DEADLINE'));
    if (signal.aborted) {
      Promise.resolve(promise).catch(() => {});
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort))
      .catch(() => {});
  });
}
function requestAllowed(owned, authorize, method, path) {
  if (typeof path !== 'string' || path.length > 1000 || /[\x00-\x20\x7f\\#]/.test(path)) return false;
  const workflow = /^\/api\/v1\/workflows\/([A-Za-z0-9_-]{1,128})\?excludePinnedData=true$/.exec(path);
  if (method === 'GET' && workflow) return owned.has(workflow[1]);
  const execution = /^\/api\/v1\/executions\/([1-9]\d{0,31})(\?includeData=(?:false|true)|\/stop)?$/.exec(
    path,
  );
  if (execution) {
    if (
      !executionId(execution[1]) ||
      !(
        (method === 'GET' && /^\?includeData=/.test(execution[2] ?? '')) ||
        (method === 'DELETE' && execution[2] === undefined) ||
        (method === 'POST' && execution[2] === '/stop')
      )
    )
      return false;
    const allowed = authorize({ method, executionId: execution[1] });
    if (allowed && typeof allowed.then === 'function') {
      Promise.resolve(allowed).catch(() => {});
      return false;
    }
    return allowed === true;
  }
  if (method !== 'GET' || !path.startsWith('/api/v1/executions?')) return false;
  try {
    const url = new URL('https://' + host + path),
      p = url.searchParams;
    const fields = [
      'workflowId',
      'includeData',
      'limit',
      ...(p.has('status') ? ['status'] : []),
      ...(p.has('cursor') ? ['cursor'] : []),
    ];
    if (
      url.hostname !== host ||
      url.pathname !== '/api/v1/executions' ||
      [...p.keys()].length !== fields.length ||
      fields.some((k) => p.getAll(k).length !== 1) ||
      !owned.has(p.get('workflowId')) ||
      p.get('includeData') !== 'false' ||
      p.get('limit') !== '120' ||
      (p.has('status') && p.get('status') !== 'running') ||
      (p.has('cursor') && !/^[\x21-\x7e]{1,400}$/.test(p.get('cursor')))
    )
      return false;
    const canonical =
      '/api/v1/executions?workflowId=' +
      p.get('workflowId') +
      '&includeData=false&limit=120' +
      (p.has('status') ? '&status=running' : '') +
      (p.has('cursor') ? '&cursor=' + encodeURIComponent(p.get('cursor')) : '');
    return path === canonical;
  } catch {
    return false;
  }
}
function safeHeaders(res) {
  if (!object(res.headers)) fail('FRAMING');
  const names = ['content-length', 'content-encoding', 'transfer-encoding', 'content-type'];
  const headers = {};
  for (const name of names) {
    const matches = Object.entries(res.headers).filter(([k]) => k.toLowerCase() === name);
    if (matches.length > 1) fail('FRAMING');
    if (matches.length) {
      const value = matches[0][1];
      if (typeof value !== 'string' || value.length > 256 || /[\x00-\x1f\x7f]/.test(value)) fail('FRAMING');
      headers[name] = value;
    }
  }
  if (res.rawHeaders !== undefined) {
    if (!Array.isArray(res.rawHeaders) || res.rawHeaders.length > 256 || res.rawHeaders.length % 2)
      fail('FRAMING');
    const seen = new Set();
    for (let i = 0; i < res.rawHeaders.length; i += 2) {
      if (typeof res.rawHeaders[i] !== 'string' || typeof res.rawHeaders[i + 1] !== 'string') fail('FRAMING');
      const name = res.rawHeaders[i].toLowerCase();
      if (names.includes(name)) {
        if (seen.has(name)) fail('FRAMING');
        seen.add(name);
      }
    }
  }
  const length = headers['content-length'],
    encoding = headers['content-encoding'],
    transfer = headers['transfer-encoding'],
    type = headers['content-type'];
  if (
    (length !== undefined && !/^(0|[1-9]\d{0,9})$/.test(length)) ||
    (encoding !== undefined && encoding.toLowerCase() !== 'identity') ||
    (transfer !== undefined && (transfer.toLowerCase() !== 'chunked' || length !== undefined)) ||
    (type !== undefined && !/^application\/json(?:;\s*charset=utf-8)?$/i.test(type))
  )
    fail('FRAMING');
  if (length !== undefined && Number(length) > responseBytes) fail('RESPONSE_LIMIT');
  return Object.freeze(headers);
}

export function assertFoundationNativeTransport(transport) {
  if (!transports.has(transport)) fail('BRAND');
  return transport;
}
export function createFoundationNativeTransport({ apiKey, bindings, authorizeExecution }, dependencies = {}) {
  let owned;
  try {
    parseN8nBindings(bindings);
    const pins = foundationRuntimeCheckpoint.workflows;
    if (
      bindings.instanceUrl !== 'https://' + host ||
      bindings.environment !== 'dev' ||
      bindings.runtimeVersion !== '2.43.5' ||
      bindings.projectId !== foundationRuntimeCheckpoint.projectId ||
      Object.keys(bindings.workflowRefs).length !== 25 ||
      Object.keys(pins).some((k) => bindings.workflowRefs[k]?.id !== pins[k].id) ||
      typeof authorizeExecution !== 'function' ||
      typeof apiKey !== 'string' ||
      !/^[\x21-\x7e]{1,4096}$/.test(apiKey)
    )
      fail('CONFIG');
    owned = new Set(Object.values(bindings.workflowRefs).map((r) => r.id));
  } catch {
    fail('CONFIG');
  }
  let privateKey = apiKey;
  const owner = {};
  const active = new Set(),
    unclosedResponses = new Set(),
    send = dependencies.request ?? httpsRequest,
    lookup = dependencies.resolveInstance ?? resolveInstance;
  const timeoutMs = Math.min(dependencies.timeoutMs ?? 15000, 15000),
    closeTimeoutMs = Math.min(dependencies.closeTimeoutMs ?? 1000, 1000);
  if (
    typeof send !== 'function' ||
    typeof lookup !== 'function' ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isFinite(closeTimeoutMs) ||
    closeTimeoutMs <= 0
  )
    fail('CONFIG');
  const exchange = async ({ method, path, signal, traceparent = null, callbackBody = null }) => {
    try {
      if (
        !privateKey ||
        (signal !== undefined && !(signal instanceof AbortSignal)) ||
        signal?.aborted ||
        (traceparent === null
          ? !requestAllowed(owned, authorizeExecution, method, path)
          : method !== 'POST' ||
            path !== '/webhook/emr-apify-callback' ||
            !/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/.test(traceparent) ||
            traceparent.slice(3, 35) === '0'.repeat(32) ||
            traceparent.slice(36, 52) === '0'.repeat(16))
      )
        fail('REQUEST');
    } catch {
      fail('REQUEST');
    }
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener('abort', onCallerAbort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortDns = () => controller.abort();
    active.add(abortDns);
    let addresses;
    try {
      addresses = validateFoundationAddresses(await raceAbort(lookup(controller.signal), controller.signal));
    } catch {
      clearTimeout(timer);
      active.delete(abortDns);
      signal?.removeEventListener('abort', onCallerAbort);
      fail('DNS');
    }
    active.delete(abortDns);
    if (controller.signal.aborted || !privateKey) {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
      fail('DEADLINE');
    }
    const address = addresses[0];
    let req,
      res,
      socket,
      stream,
      fault,
      faultProvenance = null,
      ended = false,
      tlsVerified = false,
      reqClosed = false,
      resClosed = false,
      socketClosed = false,
      settled = false,
      closeTimer,
      bytes = 0;
    let resolveHeaders, rejectHeaders, resolveClosed, rejectClosed;
    const headersPromise = new Promise((resolve, reject) => {
      resolveHeaders = resolve;
      rejectHeaders = reject;
    });
    const closed = new Promise((resolve, reject) => {
      resolveClosed = resolve;
      rejectClosed = reject;
    });
    closed.catch(() => {});
    const physicallyClosed = () => reqClosed && (!res || resClosed) && socket && socketClosed;
    const provenance = (physicalClosureVerified = false) => ({
      nativeOSCode: faultProvenance?.nativeOSCode ?? null,
      origin: faultProvenance?.origin ?? null,
      responseSeen: faultProvenance?.responseSeen ?? res !== undefined,
      tlsVerified: faultProvenance?.tlsVerified ?? tlsVerified,
      physicalClosureVerified,
    });
    const releasePhysical = () => {
      if (physicallyClosed()) {
        active.delete(abort);
        unclosedResponses.delete(abort);
      }
    };
    const destroyPhysical = () => {
      try {
        res?.destroy();
      } catch {}
      try {
        req?.destroy();
      } catch {}
      try {
        socket?.destroy();
      } catch {}
    };
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(closeTimer);
      signal?.removeEventListener('abort', onCallerAbort);
      controller.signal.removeEventListener('abort', onAbort);
      releasePhysical();
    };
    const settle = (closeUnknown = false) => {
      if (settled) {
        releasePhysical();
        return;
      }
      if (!closeUnknown && !physicallyClosed()) return;
      settled = true;
      if (closeUnknown) destroyPhysical();
      cleanup();
      if (closeUnknown || fault || !ended) {
        const error = fixed(
          closeUnknown ? 'CLOSE' : (fault ?? 'TRUNCATED'),
          provenance(physicallyClosed() === true),
          owner,
        );
        stream?.destroy(error);
        rejectHeaders(error);
        rejectClosed(error);
      } else resolveClosed();
    };
    const boundClosure = () => {
      if (!closeTimer) closeTimer = setTimeout(() => settle(true), closeTimeoutMs);
    };
    const abort = (code = 'ABORTED', nativeError = null, origin = null) => {
      if (settled) {
        if (!physicallyClosed()) destroyPhysical();
        releasePhysical();
        return;
      }
      if (!fault) {
        fault = code;
        faultProvenance = Object.freeze({
          nativeOSCode: nativeErrorCode(nativeError),
          origin,
          responseSeen: res !== undefined,
          tlsVerified,
        });
      }
      stream?.destroy(fixed(fault, provenance(), owner));
      destroyPhysical();
      boundClosure();
      settle();
    };
    const onAbort = () => abort('DEADLINE');
    active.add(abort);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    try {
      req = send(
        {
          protocol: 'https:',
          hostname: host,
          port: 443,
          servername: host,
          method,
          path,
          agent: false,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
          family: address.family,
          maxHeaderSize: 16384,
          insecureHTTPParser: false,
          signal: controller.signal,
          lookup: (hostname, _options, callback) =>
            hostname === host ? callback(null, address.address, address.family) : callback(fixed('DNS')),
          headers:
            traceparent === null
              ? {
                  'X-N8N-API-KEY': privateKey,
                  accept: 'application/json',
                  'accept-encoding': 'identity',
                  connection: 'close',
                }
              : { 'content-type': 'application/json', traceparent },
        },
        (response) => {
          res = response;
          unclosedResponses.add(abort);
          res.on('error', () => abort('RESPONSE'));
          res.on('aborted', () => abort('TRUNCATED'));
          res.on('close', () => {
            resClosed = true;
            settle();
          });
          let headers;
          try {
            if (
              !tlsVerified ||
              !Number.isInteger(res.statusCode) ||
              res.statusCode < 200 ||
              res.statusCode > 599 ||
              (res.statusCode >= 300 && res.statusCode < 400)
            )
              fail('STATUS');
            headers = safeHeaders(res);
          } catch (error) {
            abort(
              foundationNativeTransportErrorCode(error) === 'RESPONSE_LIMIT' ? 'RESPONSE_LIMIT' : 'FRAMING',
            );
            return;
          }
          stream = new Transform({
            highWaterMark: 65536,
            transform(chunk, _encoding, callback) {
              if (!Buffer.isBuffer(chunk) || bytes + chunk.length > responseBytes) {
                abort('RESPONSE_LIMIT');
                callback(fixed('RESPONSE_LIMIT'));
                return;
              }
              bytes += chunk.length;
              callback(null, chunk);
            },
          });
          stream.on('error', () => {});
          res.on('end', () => {
            if (
              res.complete !== true ||
              (headers['content-length'] !== undefined && bytes !== Number(headers['content-length']))
            ) {
              abort('TRUNCATED');
              return;
            }
            ended = true;
            boundClosure();
            settle();
          });
          const body = Object.freeze({
            async *[Symbol.asyncIterator]() {
              try {
                for await (const chunk of stream) yield chunk;
              } catch {
                throw fixed(fault ?? 'STREAM', provenance(physicallyClosed() === true), owner);
              } finally {
                if (!ended && !fault) abort('ABORTED');
              }
            },
          });
          resolveHeaders(
            Object.freeze({ status: res.statusCode, headers, body, closed, abort: () => abort('ABORTED') }),
          );
          res.pipe(stream);
        },
      );
      req.on('socket', (assigned) => {
        if (socket) {
          abort('SOCKET');
          return;
        }
        socket = assigned;
        socket.on('close', () => {
          socketClosed = true;
          settle();
        });
        socket.on('error', (error) => abort('SOCKET', error, 'socket_error'));
        socket.on('secureConnect', () => {
          if (
            socket.encrypted !== true ||
            socket.authorized !== true ||
            socket.remoteAddress !== address.address
          ) {
            abort('TLS');
            return;
          }
          tlsVerified = true;
        });
      });
      req.on('error', (error) => abort('REQUEST', error, 'request_error'));
      req.on('close', () => {
        reqClosed = true;
        settle();
      });
      req.end(traceparent === null ? undefined : (callbackBody ?? '{}'));
    } catch (error) {
      abort('REQUEST', error, 'setup');
    }
    return headersPromise;
  };
  const transport = Object.freeze({
    request(input) {
      if (!object(input) || Object.keys(input).some((k) => !['method', 'path', 'signal'].includes(k)))
        return Promise.reject(fixed('REQUEST'));
      return exchange(input);
    },
    webhookError(input) {
      if (
        !object(input) ||
        Object.keys(input).some((k) => !['traceparent', 'signal'].includes(k)) ||
        typeof input.traceparent !== 'string'
      )
        return Promise.reject(fixed('REQUEST'));
      return exchange({ method: 'POST', path: '/webhook/emr-apify-callback', ...input });
    },
    callbackCase(input) {
      try {
        if (!object(input) || Object.keys(input).some((k) => !['wireCase', 'signal'].includes(k)))
          fail('REQUEST');
        const wire = consumeFoundationCallbackCase(input.wireCase);
        return exchange({
          method: 'POST',
          path: '/webhook/emr-apify-callback',
          signal: input.signal,
          traceparent: wire.traceparent,
          callbackBody: wire.body,
        });
      } catch {
        return Promise.reject(fixed('REQUEST'));
      }
    },
    close() {
      privateKey = null;
      for (const abort of active) abort('CLOSED');
    },
    state() {
      return Object.freeze({ pendingRequests: active.size, unclosedResponses: unclosedResponses.size });
    },
  });
  transports.add(transport);
  transportOwners.set(transport, owner);
  return transport;
}
