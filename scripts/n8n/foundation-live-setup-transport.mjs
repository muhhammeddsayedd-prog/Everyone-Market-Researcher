import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const checked = new WeakSet();
const fail = () => {
  throw Error('FOUNDATION_LIVE_SETUP_TRANSPORT_BLOCKED');
};
// Inspect bounded private stderr only in memory. Never return a message, URL,
// header, account identity or arbitrary error.code supplied by a provider.
function classifyStderr(text) {
  if (nativeHttpStatus(text) !== null) return 'http_failure';
  for (const code of [
    'saved_auth_missing',
    'saved_auth_expired',
    'saved_auth_invalid_expiry',
    'auxiliary_scope_refusal',
    'auth_refresh_refused',
    'no_retry_bootstrap',
    'local_write_refused',
    'credential_storage_write_refused',
    'credential_storage_unsupported',
  ])
    if (text.includes('FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED:' + code)) return code;
  if (
    /\b(?:CERT_HAS_EXPIRED|CERT_UNTRUSTED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY|SELF_SIGNED_CERT_IN_CHAIN|ERR_TLS_CERT_ALTNAME_INVALID)\b/.test(
      text,
    )
  )
    return 'tls_failure';
  if (/\b(?:ENOTFOUND|EAI_AGAIN)\b/.test(text)) return 'dns_failure';
  if (/\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT)\b/.test(text))
    return 'network_failure';
  return 'unknown';
}
function nativeHttpStatus(text) {
  const matches = [...text.matchAll(/FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED:http_status_([45][0-9]{2})\b/g)];
  const values = new Set(matches.map((match) => Number(match[1])));
  return values.size === 1 ? [...values][0] : null;
}
const project = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  team = 'team_gboXPxTevpCOZuaA8eY9PmR1';
export function assertFoundationLiveSetupTransport(value) {
  if (!checked.has(value)) fail();
  return value;
}
function allowed(method, path) {
  if (typeof path !== 'string') return false;
  if (method === 'GET' && path === `/v9/projects/${project}?teamId=${team}`) return true;
  if (method === 'GET' && path === `/v10/projects/${project}/env?decrypt=false&teamId=${team}`) return true;
  if (method === 'POST' && path === `/v10/projects/${project}/env?teamId=${team}`) return true;
  if (method === 'PATCH' && path === `/v1/projects/${project}/protection-bypass?teamId=${team}`) return true;
  if (method === 'POST' && path === `/v13/deployments?forceNew=1&teamId=${team}`) return true;
  if (
    method === 'GET' &&
    new RegExp('^/v13/deployments/dpl_[A-Za-z0-9]{1,80}\\?teamId=' + team + '$').test(path)
  )
    return true;
  return (
    method === 'DELETE' &&
    new RegExp('^/v9/projects/' + project + '/env/[A-Za-z0-9_-]{1,128}\\?teamId=' + team + '$').test(path)
  );
}
// The parent seals Node/CLI/preload/this file before decrypting. No command-line
// secret or raw CLI error/output is returned. --include frames successful HTTP
// responses; the owned preload projects native HTTP exceptions separately.
export function createFoundationLiveSetupCliTransport(input, dependencies = {}) {
  if (
    !input ||
    typeof input.authorizeRequest !== 'function' ||
    typeof input.now !== 'function' ||
    !Number.isFinite(input.deadlineAt) ||
    ['nodeExecutable', 'cliPath', 'noRetryPreloadPath', 'workingDirectory'].some(
      (k) => typeof input[k] !== 'string' || !isAbsolute(input[k]),
    )
  )
    fail();
  const launch = dependencies.spawn ?? spawn;
  let active = null,
    closed = false,
    failed = false,
    pendingRequests = 0;
  let diagnostic = {
    stage: 'not_started',
    childStarted: false,
    childClosed: false,
    nativeExit: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    httpStatus: null,
    aborted: false,
    code: 'unknown',
  };
  const requestTimeoutMs = dependencies.requestTimeoutMs ?? 20000,
    closeGraceMs = dependencies.closeGraceMs ?? 5000;
  if (
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1 ||
    requestTimeoutMs > 20000 ||
    !Number.isInteger(closeGraceMs) ||
    closeGraceMs < 1 ||
    closeGraceMs > 5000
  )
    fail();
  const environment = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
  environment.VERCEL_TELEMETRY_DISABLED = '1';
  environment.NO_UPDATE_NOTIFIER = '1';
  const transport = Object.freeze({
    async request(spec) {
      if (
        closed ||
        active ||
        !spec ||
        !allowed(spec.method, spec.path) ||
        input.authorizeRequest(spec) !== true ||
        !spec.signal ||
        spec.signal.aborted ||
        input.now() >= input.deadlineAt
      )
        fail();
      diagnostic = {
        stage: 'starting',
        childStarted: false,
        childClosed: false,
        nativeExit: null,
        stdoutBytes: 0,
        stderrBytes: 0,
        httpStatus: null,
        aborted: false,
        code: 'unknown',
      };
      const args = [
        '--import',
        pathToFileURL(input.noRetryPreloadPath).href,
        input.cliPath,
        'api',
        spec.path,
        '--method',
        spec.method,
        '--include',
        '--raw',
        '--non-interactive',
        '--no-color',
      ];
      if (spec.body !== undefined) args.push('--input', '-');
      if (spec.method === 'DELETE') args.push('--dangerously-skip-permissions');
      let payload;
      try {
        payload = spec.body === undefined ? '' : JSON.stringify(spec.body);
      } catch {
        fail();
      }
      if (Buffer.byteLength(payload) > 65536) fail();
      pendingRequests++;
      return new Promise((resolve, reject) => {
        let child,
          chunks = [],
          privateStderr = '',
          bytes = 0,
          errorBytes = 0,
          ended = false,
          timedOut = false,
          exitCode = null,
          spawned = false,
          promiseSettled = false,
          closeTimer = null;
        const rejectUnknown = () => {
          if (!promiseSettled) {
            promiseSettled = true;
            failed = true;
            reject(Error('FOUNDATION_LIVE_SETUP_TRANSPORT_BLOCKED'));
          }
        };
        const finish = () => {
          if (ended) return;
          ended = true;
          clearTimeout(timer);
          if (closeTimer !== null) clearTimeout(closeTimer);
          spec.signal.removeEventListener('abort', abort);
          active = null;
          pendingRequests--;
          payload = null;
          diagnostic.code = classifyStderr(privateStderr);
          diagnostic.httpStatus = nativeHttpStatus(privateStderr);
          privateStderr = '';
          if (promiseSettled) return;
          if (timedOut || exitCode !== 0) {
            if (!timedOut) diagnostic.stage = 'native_exit';
            rejectUnknown();
            return;
          }
          try {
            diagnostic.stage = 'utf8';
            const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
            chunks = [];
            diagnostic.stage = 'framing';
            const split = text.indexOf('\n\n');
            if (split < 0 || split > 32768) fail();
            const first = text.slice(0, split).split('\n')[0].replace(/\r$/, '');
            const match = /^HTTP ([1-5][0-9]{2}) [^\r\n]*$/.exec(first);
            if (!match) fail();
            diagnostic.httpStatus = Number(match[1]);
            diagnostic.stage = 'json';
            const body = text.slice(split + 2).trim(),
              data = body ? JSON.parse(body) : null;
            promiseSettled = true;
            diagnostic.stage = 'completed';
            resolve({ status: Number(match[1]), data, closed: true });
          } catch {
            rejectUnknown();
          }
        };
        const abort = (reason) => {
          diagnostic.aborted = true;
          if (!['stdout_limit', 'stderr_limit', 'child_error'].includes(diagnostic.stage))
            diagnostic.stage = reason === 'timeout' ? 'timeout' : 'aborted';
          timedOut = true;
          try {
            child?.kill();
          } catch {}
          if (closeTimer === null) closeTimer = setTimeout(rejectUnknown, closeGraceMs);
        };
        const timer = setTimeout(
          () => abort('timeout'),
          Math.max(1, Math.min(requestTimeoutMs, input.deadlineAt - input.now())),
        );
        active = { abort, state: () => ({ spawned, timedOut }) };
        spec.signal.addEventListener('abort', abort, { once: true });
        try {
          child = launch(input.nodeExecutable, args, {
            cwd: input.workingDirectory,
            env: {
              ...environment,
              EMR_FOUNDATION_SETUP_METHOD: spec.method,
              EMR_FOUNDATION_SETUP_PATH: spec.path,
            },
            windowsHide: true,
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          spawned = true;
          child.on('spawn', () => {
            diagnostic.childStarted = true;
          });
          child.stdout.on('data', (chunk) => {
            const b = Buffer.from(chunk);
            bytes += b.length;
            diagnostic.stdoutBytes = Math.min(bytes, 1048577);
            if (bytes > 1048576) {
              diagnostic.stage = 'stdout_limit';
              abort();
              return;
            }
            chunks.push(b);
          });
          child.stderr.on('data', (chunk) => {
            errorBytes += Buffer.byteLength(chunk);
            diagnostic.stderrBytes = Math.min(errorBytes, 65537);
            if (errorBytes <= 65536) privateStderr += Buffer.from(chunk).toString('utf8');
            if (errorBytes > 65536) {
              diagnostic.stage = 'stderr_limit';
              abort();
            }
          });
          child.stdin.on('error', abort);
          child.stdout.on('error', abort);
          child.stderr.on('error', abort);
          child.on('error', () => {
            diagnostic.stage = 'child_error';
            timedOut = true;
            if (!spawned) finish();
            else abort();
          });
          child.on('exit', (code) => {
            exitCode = code;
          });
          // close, rather than exit, proves the owned child's pipes are closed.
          child.on('close', (code) => {
            exitCode = code;
            diagnostic.childClosed = true;
            diagnostic.nativeExit = Number.isInteger(code) ? code : null;
            finish();
          });
          child.stdin.end(payload);
          payload = null;
        } catch {
          diagnostic.stage = 'spawn_error';
          timedOut = true;
          finish();
        }
      });
    },
    state() {
      return Object.freeze({ pendingRequests, unclosedResponses: pendingRequests, closed, failed });
    },
    diagnostics() {
      return Object.freeze({ ...diagnostic });
    },
    close() {
      closed = true;
      active?.abort();
      return pendingRequests === 0;
    },
  });
  checked.add(transport);
  return transport;
}
