import { lookup as osLookup } from 'node:dns';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  gatewayRequest,
  gatewayReceipt,
  trialOperations,
} from '../../packages/shared/src/n8n-worker-contracts.ts';
import { createTrialCoordinator } from './gw01-trial.mjs';
import { scanGatewayLogs } from './gw01-gateway-logs.mjs';

const syntheticAuth = 'GW01_SYNTHETIC_AUTH_CANARY_ONLY_0123456789';
// Original prepared audiences have no deployment tuple in the historical
// journal. Keep that reviewed identity fixed; later identities come exclusively
// from validated, append-only deployment events.
const initialDeployment = Object.freeze({
  audience: 'https://everyone-market-researcher-7k5et630y-muhammed-abdelrahman.vercel.app',
  commitSha: '4d4d13ebf241f12df64de772b0024bf6d5a067e0',
  deploymentId: 'dpl_34mF18oQnjrqS67pdXMBsChLfV7g',
  projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  branch: 'm03-n8n-foundation',
});
const path = '/api/internal/n8n/rpc';
const bindingKeys = ['audience', 'commitSha', 'deploymentId', 'projectId', 'branch'];
const sourceObjects = Object.freeze({
  'apps/web': ['tree', 'ceedfcc695e210d5f14025d9cfd47f17c55d6f2a'],
  'packages/shared': ['tree', 'fc0684990fd7df9260c1deeda7ca18dcdb99651a'],
  'pnpm-lock.yaml': ['blob', '41a2d27d4ac2c16d033930475aa400884562cefb'],
  'package.json': ['blob', 'f34d32bdf8fc7b09ea45f6560e79ae3da94efd10'],
  'pnpm-workspace.yaml': ['blob', '8f91bfb10cdd8d3cfe706adf080b9f6b22b0387e'],
});
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
      (value.kind === 'preflight' ||
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
const sameBinding = (value, expected) =>
  exact(value, bindingKeys) && bindingKeys.every((key) => value[key] === expected[key]);
const canonicalTime = (value) =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  new Date(Date.parse(value)).toISOString() === value;

/** A sealed, public root-reviewed handoff links actual OLD CloudB acceptance to
 * one NEW deployment. Git object IDs/readback records are evidence declarations,
 * not another claim that the runtime deployment itself returned the old503. */
export function assertRuntimePhase(preview, context) {
  gatewayPreview(preview);
  if (preview.routeDisabledVerified !== false || !exact(context, ['cloud', 'environment'])) reject();
  const { cloud, environment } = context;
  if (
    cloud?.version !== 1 ||
    cloud.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    cloud.instanceHost !== 'muhhammedsayed.app.n8n.cloud' ||
    cloud.ownedWorkflowId !== 'p8GikCM8C9Tq3lo4' ||
    ![
      'passed',
      'credentialCanaryVerified',
      'executionCanaryVerified',
      'exportCanaryVerified',
      'logCanaryVerified',
    ].every((key) => cloud[key] === true) ||
    cloud.disabledProbeHttpStatus !== 503 ||
    cloud.disabledProbeRequestId !== '80162039-6088-4011-bdf1-a2a7b5ec11cb' ||
    !sameBinding(cloud.cloudBTarget, initialDeployment) ||
    !Number.isInteger(cloud.logsScanned) ||
    cloud.logsScanned < 1 ||
    cloud.logsScanned >= 100 ||
    cloud.logReadEvidence !== 'milestones/M03-n8n-foundation/evidence/gw01-log-read-20261018.json'
  )
    reject();
  const phase = cloud.runtimePhase;
  if (
    !exact(phase, [
      'version',
      'cloudBTarget',
      'target',
      'sourceObjects',
      'rootVercelJson',
      'environment',
      'readback',
    ]) ||
    phase.version !== 1 ||
    !sameBinding(phase.cloudBTarget, initialDeployment) ||
    !sameBinding(phase.target, preview) ||
    phase.target.audience === initialDeployment.audience ||
    phase.target.deploymentId === initialDeployment.deploymentId ||
    phase.rootVercelJson !== 'absent' ||
    !exact(phase.sourceObjects, Object.keys(sourceObjects))
  )
    reject();
  for (const [name, [kind, id]] of Object.entries(sourceObjects)) {
    const entry = phase.sourceObjects[name];
    if (
      !exact(entry, ['kind', 'cloudB', 'runtime']) ||
      entry.kind !== kind ||
      entry.cloudB !== id ||
      entry.runtime !== id
    )
      reject();
  }
  if (
    !exact(phase.environment, ['recordRef', 'records']) ||
    phase.environment.recordRef !== 'scripts/n8n/out/gw01-environment-delivery.jsonl' ||
    !Array.isArray(environment) ||
    environment.length !== 3 ||
    !Array.isArray(phase.environment.records) ||
    phase.environment.records.length !== 3
  )
    reject();
  const first = environment[0];
  if (
    !exact(first, ['version', 'kind', 'windowId', 'projectId', 'branch', 'createdAt']) ||
    first.version !== 1 ||
    first.kind !== 'environment_intent' ||
    first.windowId !== '76c2ad42-c094-4ba4-9a0b-566e19b97780' ||
    first.projectId !== preview.projectId ||
    first.branch !== preview.branch ||
    !canonicalTime(first.createdAt)
  )
    reject();
  for (let i = 0; i < 3; i++) {
    const record = environment[i],
      embedded = phase.environment.records[i],
      keys = i === 0 ? ['version', 'kind', 'windowId', 'projectId', 'branch', 'createdAt'] : ['kind', 'name'];
    if (!exact(record, keys) || !exact(embedded, keys) || !keys.every((key) => record[key] === embedded[key]))
      reject();
    if (
      i > 0 &&
      (!exact(record, ['kind', 'name']) ||
        record.kind !== 'environment_delivered' ||
        record.name !== ['EMR_WORKER_DB_PASSWORD', 'EMR_WORKER_GATEWAY_TOKEN_SHA256'][i - 1])
    )
      reject();
  }
  const r = phase.readback;
  if (
    !exact(r, [
      'evidenceRef',
      'kind',
      'nativeExit',
      'teamId',
      'environment',
      'readyState',
      'autoExposeSystemEnvs',
      'target',
      'createdAt',
      'observedAt',
      'configuration',
    ]) ||
    r.evidenceRef !== 'milestones/M03-n8n-foundation/evidence/gw01-runtime-readback-20261018.json' ||
    r.kind !== 'vercel_runtime_preview' ||
    r.nativeExit !== 0 ||
    r.teamId !== 'team_gboXPxTevpCOZuaA8eY9PmR1' ||
    r.environment !== 'preview' ||
    r.readyState !== 'READY' ||
    r.autoExposeSystemEnvs !== true ||
    !sameBinding(r.target, preview) ||
    !canonicalTime(r.createdAt) ||
    !canonicalTime(r.observedAt) ||
    Date.parse(r.createdAt) < Date.parse(first.createdAt) ||
    Date.parse(r.observedAt) < Date.parse(r.createdAt)
  )
    reject();
  const config = r.configuration,
    values = config?.values;
  if (
    !exact(config, ['target', 'gitBranch', 'values']) ||
    config.target !== 'preview' ||
    config.gitBranch !== preview.branch ||
    !exact(values, [
      'EMR_WORKER_GATEWAY_ENABLED',
      'EMR_WORKER_GATEWAY_AUDIENCE',
      'EMR_WORKER_GATEWAY_WINDOW_ID',
      'EMR_WORKER_GATEWAY_COMMIT_SHA',
    ]) ||
    values.EMR_WORKER_GATEWAY_ENABLED !== 'true' ||
    values.EMR_WORKER_GATEWAY_AUDIENCE !== 'vercel-deployment' ||
    values.EMR_WORKER_GATEWAY_WINDOW_ID !== '76c2ad42-c094-4ba4-9a0b-566e19b97780' ||
    values.EMR_WORKER_GATEWAY_COMMIT_SHA !== preview.commitSha
  )
    reject();
  return true;
}
export function checkPublicGateway(raw, coordinator, runtimeContext) {
  const value = input(raw),
    target = Object.fromEntries(
      ['audience', 'commitSha', 'deploymentId', 'projectId', 'branch'].map((key) => [
        key,
        value.preview[key],
      ]),
    );
  if (value.mode === 'Request') assertRuntimePhase(value.preview, runtimeContext);
  coordinator.assertDeployment(target, initialDeployment);
  coordinator.snapshot();
  return { version: 1, status: 'public_ready', networkRequests: 0, privateRead: false };
}
/** One approved audit envelope, exactly twice. No caller batch/count is accepted. */
export function checkPublicGatewayDuplicate2(raw, coordinator, runtimeContext) {
  const value = input(raw);
  if (
    value.mode !== 'Request' ||
    value.kind !== 'ordinary' ||
    value.authorization !== 'machine' ||
    value.fault !== 'none' ||
    value.request.operation !== 'error.log'
  )
    reject();
  const ready = checkPublicGateway(value, coordinator, runtimeContext),
    state = coordinator.snapshot();
  if (state.inFlight !== 0) reject('GW01_PARALLEL_LIMIT');
  if (state.closed) reject('GW01_CLOSED');
  if (state.startedAt === null) reject('GW01_NOT_STARTED');
  if (!Number.isInteger(state.attempts) || state.attempts > 83) reject('GW01_CLOSURE_RESERVE');
  return ready;
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
        dependencies.observeNativeSocket?.('opened');
        socket.on('close', () => {
          if (!socketClosed) dependencies.observeNativeSocket?.('closed');
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
    if (value.mode === 'Request') assertRuntimePhase(value.preview, dependencies.runtimeContext);
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

/** Both ordinary sends share the one decrypted input and append separate durable
 * reservations. Neither a missing ack nor a failed sibling is re-executed. The
 * overlap count describes owned HTTPS sockets, not simultaneous SQL execution. */
export async function sendGatewayDuplicate2(raw, dependencies = {}) {
  const out = {
    version: 1,
    mode: 'Duplicate2',
    status: 'stopped_reconcile',
    code: null,
    requestId: null,
    operation: null,
    attempts: [],
    attemptsRecorded: 0,
    maxConcurrentTransports: 0,
    concurrencyVerified: false,
    socketsClosed: true,
  };
  try {
    checkPublicGatewayDuplicate2(raw, dependencies.coordinator, dependencies.runtimeContext);
    const value = input(raw);
    out.requestId = value.request.requestId;
    out.operation = value.request.operation;
    let active = 0;
    const observeNativeSocket = (event) => {
      active += event === 'opened' ? 1 : -1;
      out.maxConcurrentTransports = Math.max(out.maxConcurrentTransports, active);
    };
    const settled = await Promise.allSettled([
      sendGatewayAttempt(value, { ...dependencies, observeNativeSocket }),
      sendGatewayAttempt(value, { ...dependencies, observeNativeSocket }),
    ]);
    out.attempts = settled.map((r) =>
      r.status === 'fulfilled'
        ? { ...r.value, logScan: null }
        : {
            version: 1,
            mode: 'Request',
            status: 'stopped_reconcile',
            code: 'GW01_GATEWAY_RESPONSE',
            requestId: out.requestId,
            operation: out.operation,
            kind: 'ordinary',
            attemptRecorded: false,
            httpStatus: null,
            tlsVerified: false,
            headersReceived: false,
            socketsClosed: false,
            disabledRouteVerified: false,
            identityVerified: false,
            response: null,
            logScan: null,
          },
    );
    out.attemptsRecorded = out.attempts.filter((x) => x.attemptRecorded).length;
    out.socketsClosed = active === 0 && out.attempts.every((x) => x.socketsClosed);
    out.concurrencyVerified =
      out.attemptsRecorded === 2 &&
      out.maxConcurrentTransports === 2 &&
      out.socketsClosed &&
      out.attempts.every(
        (x) =>
          x.status === 'complete' && x.tlsVerified && x.headersReceived && [200, 202].includes(x.httpStatus),
      );
    if (out.concurrencyVerified) out.status = 'complete';
    else out.code = 'GW01_GATEWAY_DUPLICATE';
  } catch (error) {
    out.code =
      coordinatorCodes.has(error?.message) || /^GW01_GATEWAY_INPUT$/.test(error?.message ?? '')
        ? error.message
        : 'GW01_GATEWAY_DUPLICATE';
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
    if (
      process.argv.length !== 3 ||
      ![
        '--private-gateway',
        '--check-public',
        '--private-gateway-duplicate2',
        '--check-public-duplicate2',
      ].includes(process.argv[2])
    )
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
    let runtimeContext;
    if (value.mode === 'Request') {
      const publicText = (relative) => {
        const file = resolve(relative);
        for (let cursor = file; ; cursor = dirname(cursor)) {
          const s = lstatSync(cursor);
          if (s.isSymbolicLink() || (cursor === file ? !s.isFile() || s.size > 65536 : !s.isDirectory()))
            reject();
          if (dirname(cursor) === cursor) break;
        }
        return readFileSync(file, 'utf8');
      };
      if (existsSync(resolve('vercel.json'))) reject();
      const cloud = JSON.parse(publicText('scripts/n8n/gw01-cloud-privacy.json'));
      if (!cloud.runtimePhase) reject();
      const text = publicText('scripts/n8n/out/gw01-environment-delivery.jsonl');
      if (!text.endsWith('\n')) reject();
      runtimeContext = {
        cloud,
        environment: text
          .trimEnd()
          .split('\n')
          .map((line) => JSON.parse(line)),
      };
    }
    const duplicate2 = process.argv[2].endsWith('-duplicate2');
    const readiness = duplicate2
      ? checkPublicGatewayDuplicate2(value, coordinator, runtimeContext)
      : checkPublicGateway(value, coordinator, runtimeContext);
    if (process.argv[2].startsWith('--check-public')) out = readiness;
    else
      out = duplicate2
        ? await sendGatewayDuplicate2(value, { coordinator, runtimeContext })
        : await runGatewayPhase(value, { coordinator, runtimeContext });
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
