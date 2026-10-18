import { lookup as osLookup } from 'node:dns';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  gatewayRequest,
  gatewayReceipt,
  trialOperations,
} from '../../packages/shared/src/n8n-worker-contracts.ts';
import { createTrialCoordinator } from './gw01-trial.mjs';
import { scanGatewayLogs } from './gw01-gateway-logs.mjs';

const syntheticAuth = 'GW01_SYNTHETIC_AUTH_CANARY_ONLY_0123456789';
const path = '/api/internal/n8n/rpc';
const exact = (v, names) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === names.length &&
  Object.keys(v).every((k) => names.includes(k));
const reject = (code = 'GW01_GATEWAY_INPUT') => {
  throw Error(code);
};
const coordinatorCodes = new Set([
  'GW01_INPUT_REJECTED',
  'GW01_STATE_REJECTED',
  'GW01_LOCKED_RECONCILE',
  'GW01_CLOCK_REJECTED',
  'GW01_NOT_STARTED',
  'GW01_EXPIRED',
  'GW01_ATTEMPT_LIMIT',
  'GW01_CLOSED',
  'GW01_CLOSURE_RESERVE',
  'GW01_PARALLEL_LIMIT',
]);
const errorStatuses = {
  unavailable: 503,
  forbidden: 403,
  unauthorized: 401,
  identity_denied: 403,
  deployment_denied: 403,
  method_not_allowed: 405,
  unsupported_encoding: 415,
  invalid_content_type: 415,
  body_too_large: 413,
  invalid_request: 400,
  outcome_unknown: 503,
  operation_not_permitted: 403,
  result_too_large: 503,
  cleanup_unverified: 503,
};
const stateStatuses = {
  completed: 200,
  absent: 200,
  admitted: 202,
  in_flight: 202,
  conflict: 409,
  limited: 429,
  closed: 403,
  rejected: 403,
  reconciliation_required: 503,
};
export function gatewayPreview(v) {
  if (
    !exact(v, [
      'version',
      'projectId',
      'teamId',
      'branch',
      'commitSha',
      'deploymentId',
      'audience',
      'target',
      'protection',
      'routeDisabledVerified',
    ]) ||
    v.version !== 1 ||
    v.projectId !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    v.branch !== 'm03-n8n-foundation' ||
    v.teamId !== 'team_gboXPxTevpCOZuaA8eY9PmR1' ||
    typeof v.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(v.audience) ||
    typeof v.commitSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(v.commitSha) ||
    typeof v.deploymentId !== 'string' ||
    !/^dpl_[A-Za-z0-9]{16,80}$/.test(v.deploymentId) ||
    v.target !== 'preview' ||
    v.protection !== 'all_except_custom_domains' ||
    typeof v.routeDisabledVerified !== 'boolean'
  )
    reject();
  return { ...v };
}
function input(value) {
  if (
    !exact(value, ['mode', 'preview', 'request', 'kind', 'authorization', 'fault', 'secrets']) ||
    !['Probe', 'Request'].includes(value.mode) ||
    !['ordinary', 'denial', 'status', 'shutdown', 'preflight'].includes(value.kind) ||
    !['machine', 'synthetic', 'missing'].includes(value.authorization) ||
    !['none', 'before_send_abort', 'after_headers_cancel'].includes(value.fault)
  )
    reject();
  const preview = gatewayPreview(value.preview),
    request = gatewayRequest(value.request);
  if (
    !trialOperations.has(request.operation) ||
    (value.mode === 'Probe' &&
      (value.kind !== 'preflight' ||
        request.operation !== 'identity.read' ||
        value.authorization !== 'synthetic' ||
        value.fault !== 'none')) ||
    (value.mode === 'Request' &&
      (!preview.routeDisabledVerified ||
        value.kind === 'preflight' ||
        (value.kind === 'status') !== (request.operation === 'request.status') ||
        (value.authorization !== 'machine' && value.kind !== 'denial'))) ||
    !exact(value.secrets, value.mode === 'Probe' ? ['protection'] : ['protection', 'machine'])
  )
    reject();
  for (const secret of Object.values(value.secrets))
    if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{32,512}$/.test(secret)) reject();
  const publicInput = JSON.stringify({
    preview,
    request,
    kind: value.kind,
    authorization: value.authorization,
    fault: value.fault,
  });
  if (Object.values(value.secrets).some((secret) => publicInput.includes(secret))) reject();
  return { ...value, preview, request };
}
// Conservative public-only literals; mixed/private answers never fall back to a
// different address. The selected public answer is pinned to the TLS hostname.
function publicAddress(value) {
  if (isIP(value) === 4) {
    const [a, b, c] = value.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && [0, 2].includes(c)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(value) !== 6 || value.includes('%') || value.includes('.')) return false;
  const [first, second] = value.toLowerCase().split(':'),
    a = Number.parseInt(first, 16),
    b = second ? Number.parseInt(second, 16) : 0;
  return (
    a >= 0x2000 &&
    a <= 0x3fff &&
    a !== 0x2002 &&
    !(a === 0x2001 && (b <= 0x1ff || b === 0xdb8)) &&
    !(a === 0x3fff && b <= 0xfff)
  );
}
function lookupPublic(host, signal, lookup) {
  return new Promise((done, fail) => {
    let settled = false;
    const finish = (error, rows) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      if (error) fail(Error('GW01_GATEWAY_DNS'));
      else done(rows);
    };
    const abort = () => finish(true);
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      lookup(host, { all: true }, (error, rows) => {
        if (
          error ||
          !Array.isArray(rows) ||
          !rows.length ||
          rows.length > 100 ||
          rows.some((r) => !r || r.family !== isIP(r.address) || !publicAddress(r.address))
        )
          return finish(true);
        finish(null, rows);
      });
    } catch {
      finish(true);
    }
  });
}
class TransportFailure extends Error {
  constructor(code, info) {
    super(code);
    this.info = info;
  }
}
function nativePost(value, address, signal, dependencies) {
  const send = dependencies.request ?? httpsRequest;
  return new Promise((done, fail) => {
    let req,
      res,
      socket,
      requestClosed = false,
      responseClosed = true,
      socketClosed = true,
      tlsVerified = false,
      headersReceived = false,
      httpStatus = null,
      stage = 'GW01_GATEWAY_TLS',
      settled = false,
      ended = false,
      body,
      closeTimer;
    const chunks = [];
    const info = () => ({
      tlsVerified,
      headersReceived,
      httpStatus,
      socketsClosed: requestClosed && responseClosed && socketClosed,
    });
    const dispose = () => {
      clearTimeout(closeTimer);
      signal.removeEventListener('abort', abort);
      for (const bytes of chunks) bytes.fill(0);
    };
    const failure = () => {
      if (settled) return;
      settled = true;
      const data = info();
      dispose();
      fail(new TransportFailure(data.socketsClosed ? stage : 'GW01_GATEWAY_CLOSE', data));
    };
    const finish = () => {
      if (!requestClosed || !responseClosed || !socketClosed || settled) return;
      if (!ended) return failure();
      settled = true;
      const result = { status: httpStatus, body, ...info() };
      dispose();
      done(result);
    };
    const destroy = () => {
      try {
        req?.destroy();
      } catch {}
      if (!req) {
        requestClosed = true;
        socketClosed = true;
        responseClosed = true;
      }
      if (!closeTimer) closeTimer = setTimeout(failure, dependencies.closeTimeoutMs ?? 5000);
      finish();
    };
    const abort = () => {
      stage = 'GW01_GATEWAY_TIMEOUT';
      destroy();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    const hostname = new URL(value.preview.audience).hostname,
      bytes = Buffer.from(JSON.stringify(value.request));
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      'content-length': String(bytes.length),
      'x-vercel-protection-bypass': value.secrets.protection,
    };
    if (value.authorization !== 'missing')
      headers.authorization =
        'Bearer ' + (value.authorization === 'machine' ? value.secrets.machine : syntheticAuth);
    try {
      req = send(
        {
          hostname,
          port: 443,
          path,
          method: 'POST',
          agent: false,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
          servername: hostname,
          family: address.family,
          lookup: (_host, _options, cb) => cb(null, address.address, address.family),
          signal,
          headers,
        },
        (response) => {
          res = response;
          responseClosed = false;
          headersReceived = true;
          httpStatus = response.statusCode;
          stage = 'GW01_GATEWAY_STATUS';
          res.on('close', () => {
            responseClosed = true;
            finish();
          });
          res.on('error', destroy);
          res.on('aborted', destroy);
          if (!tlsVerified || !Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599) {
            destroy();
            return;
          }
          if (httpStatus >= 300 && httpStatus <= 399) {
            stage = 'GW01_GATEWAY_REDIRECT';
            destroy();
            return;
          }
          if (value.fault === 'after_headers_cancel' && httpStatus === 200) {
            stage = 'GW01_GATEWAY_AFTER_HEADERS_CANCELLED';
            destroy();
            return;
          }
          stage = 'GW01_GATEWAY_BODY';
          const length = res.headers?.['content-length'];
          if (
            res.headers?.['content-encoding'] !== undefined ||
            !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(res.headers?.['content-type'] ?? '') ||
            (length !== undefined &&
              (typeof length !== 'string' || !/^(0|[1-9]\d*)$/.test(length) || Number(length) > 524288))
          ) {
            destroy();
            return;
          }
          let count = 0;
          res.on('data', (chunk) => {
            if (settled || closeTimer) return;
            count += chunk.length;
            if (count > 524288) {
              destroy();
              return;
            }
            chunks.push(Buffer.from(chunk));
          });
          res.on('end', () => {
            if (closeTimer || settled) return;
            if (res.complete !== true || (length !== undefined && count !== Number(length))) {
              destroy();
              return;
            }
            stage = 'GW01_GATEWAY_PARSE';
            try {
              body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
              ended = true;
            } catch {
              destroy();
              return;
            }
            finish();
          });
        },
      );
      req.on('socket', (owned) => {
        socket = owned;
        socketClosed = false;
        socket.on('close', () => {
          socketClosed = true;
          finish();
        });
        socket.on('secureConnect', () => {
          if (socket.authorized !== true) destroy();
          else tlsVerified = true;
        });
      });
      req.on('error', destroy);
      req.on('close', () => {
        requestClosed = true;
        finish();
      });
      req.end(bytes);
    } catch {
      destroy();
    }
  });
}
function response(value, result) {
  const body = result.body;
  if (exact(body, ['requestId', 'error'])) {
    if (
      (body.requestId !== null && body.requestId !== value.request.requestId) ||
      !exact(body.error, ['code']) ||
      !Object.hasOwn(errorStatuses, body.error.code) ||
      errorStatuses[body.error.code] !== result.status
    )
      reject('GW01_GATEWAY_RESPONSE');
    return body;
  }
  if (
    !exact(body, ['version', 'requestId', 'outcome', 'result', 'window']) ||
    body.version !== 1 ||
    body.requestId !== value.request.requestId ||
    !Object.hasOwn(stateStatuses, body.outcome) ||
    stateStatuses[body.outcome] !== result.status
  )
    reject('GW01_GATEWAY_RESPONSE');
  gatewayReceipt(
    { state: body.outcome, code: null, result: body.result, window: body.window },
    value.request.operation,
  );
  if (
    body.window.boundAudience !== value.preview.audience ||
    body.window.boundCommitSha !== value.preview.commitSha ||
    body.window.boundDeploymentId !== value.preview.deploymentId
  )
    reject('GW01_GATEWAY_RESPONSE');
  return body;
}
/** Every attempt is reserved before DNS/HTTP. Unknown outcomes are never retried
 * here. A caller uses a NEW correlation ID for request.status after a lost ack. */
export async function sendGatewayAttempt(raw, dependencies = {}) {
  const out = {
    version: 1,
    mode: ['Probe', 'Request'].includes(raw?.mode) ? raw.mode : null,
    status: 'stopped_reconcile',
    code: null,
    requestId: null,
    operation: null,
    kind: null,
    attemptRecorded: false,
    httpStatus: null,
    tlsVerified: false,
    headersReceived: false,
    socketsClosed: true,
    disabledRouteVerified: false,
    identityVerified: false,
    response: null,
  };
  let reservation, value, controller, timer;
  try {
    value = input(raw);
    out.requestId = value.request.requestId;
    out.operation = value.request.operation;
    out.kind = value.kind;
    reservation = dependencies.coordinator.reserve({
      requestId: out.requestId,
      operation: out.operation,
      audience: value.preview.audience,
      kind: value.kind,
    });
    out.attemptRecorded = true;
    if (value.fault === 'before_send_abort') reject('GW01_GATEWAY_BEFORE_SEND_ABORT');
    controller = new AbortController();
    timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 25000);
    const rows = await lookupPublic(
      new URL(value.preview.audience).hostname,
      controller.signal,
      dependencies.lookup ?? osLookup,
    );
    if (controller.signal.aborted) reject('GW01_GATEWAY_DNS');
    const result = await nativePost(value, rows[0], controller.signal, dependencies);
    for (const key of ['httpStatus', 'tlsVerified', 'headersReceived', 'socketsClosed'])
      out[key] = key === 'httpStatus' ? result.status : result[key];
    const parsed = response(value, result);
    if (
      value.mode === 'Probe' &&
      (result.status !== 503 || parsed.requestId !== null || parsed.error?.code !== 'unavailable')
    )
      reject('GW01_GATEWAY_PROBE_RESULT');
    const serialized = JSON.stringify(parsed);
    if (Object.values(value.secrets).some((secret) => serialized.includes(secret)))
      reject('GW01_GATEWAY_RESPONSE');
    dependencies.coordinator.finish(reservation.attemptId, { outcome: 'http', httpStatus: result.status });
    reservation = null;
    out.response = parsed;
    out.disabledRouteVerified = value.mode === 'Probe';
    out.identityVerified =
      value.mode === 'Request' &&
      value.request.operation === 'identity.read' &&
      parsed.outcome === 'completed';
    out.status = 'complete';
  } catch (error) {
    if (error instanceof TransportFailure) {
      Object.assign(out, error.info);
      out.code = error.message;
    } else
      out.code =
        coordinatorCodes.has(error?.message) ||
        /^GW01_GATEWAY_(INPUT|DNS|RESPONSE|PROBE_RESULT|BEFORE_SEND_ABORT)$/.test(error?.message ?? '')
          ? error.message
          : 'GW01_GATEWAY_RESPONSE';
    if (reservation) {
      try {
        dependencies.coordinator.finish(reservation.attemptId, { outcome: 'unknown', httpStatus: null });
      } catch {
        out.code = 'GW01_GATEWAY_JOURNAL';
      }
    }
    out.response = null;
    out.identityVerified = false;
    out.disabledRouteVerified = false;
  } finally {
    clearTimeout(timer);
  }
  if (value && Object.values(value.secrets).some((secret) => JSON.stringify(out).includes(secret))) {
    out.requestId = null;
    out.response = null;
    out.status = 'stopped_reconcile';
    out.code = 'GW01_GATEWAY_REDACTED';
    out.identityVerified = false;
    out.disabledRouteVerified = false;
  }
  return out;
}

export async function runGatewayPhase(raw, dependencies = {}) {
  const since = new Date(Date.now() - 5000).toISOString();
  const out = await sendGatewayAttempt(raw, dependencies);
  out.logScan = null;
  if (raw.mode === 'Probe' && out.status === 'complete') {
    out.logScan = await (dependencies.scanLogs ?? scanGatewayLogs)({
      preview: raw.preview,
      requestId: raw.request.requestId,
      since,
      until: new Date(Date.now() + 5000).toISOString(),
      protection: raw.secrets.protection,
    });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let out;
  try {
    if (process.argv.length !== 3 || !['--private-gateway', '--check-public'].includes(process.argv[2]))
      reject();
    let size = 0;
    const chunks = [];
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 16384) reject();
      chunks.push(chunk);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const config = JSON.parse(readFileSync(resolve('scripts/n8n/gw01-trial-config.json'), 'utf8'));
    const coordinator = createTrialCoordinator(resolve('scripts/n8n/out/gw01'), config);
    if (process.argv[2] === '--check-public') {
      input(value);
      coordinator.snapshot();
      out = { version: 1, status: 'public_ready', networkRequests: 0, privateRead: false };
    } else out = await runGatewayPhase(value, { coordinator });
  } catch {
    out = { version: 1, status: 'stopped_reconcile', code: 'GW01_GATEWAY_INPUT' };
  }
  process.stdout.write(JSON.stringify(out));
  process.exitCode =
    ['complete', 'public_ready'].includes(out.status) &&
    (out.mode !== 'Probe' || out.logScan?.status === 'verified')
      ? 0
      : 1;
}
