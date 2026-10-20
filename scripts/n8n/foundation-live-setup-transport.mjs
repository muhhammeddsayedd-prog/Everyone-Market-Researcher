import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const checked = new WeakSet();
const fail = () => {
  throw Error('FOUNDATION_LIVE_SETUP_TRANSPORT_BLOCKED');
};
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
// secret or raw CLI error/output is returned. CLI's --include status is required:
// its raw JSON output can exit0 even for an HTTP error.
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
          if (promiseSettled) return;
          if (timedOut || exitCode !== 0) {
            rejectUnknown();
            return;
          }
          try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
            chunks = [];
            const split = text.indexOf('\n\n');
            if (split < 0 || split > 32768) fail();
            const first = text.slice(0, split).split('\n')[0].replace(/\r$/, '');
            const match = /^HTTP ([1-5][0-9]{2}) [^\r\n]*$/.exec(first);
            if (!match) fail();
            const body = text.slice(split + 2).trim(),
              data = body ? JSON.parse(body) : null;
            promiseSettled = true;
            resolve({ status: Number(match[1]), data, closed: true });
          } catch {
            rejectUnknown();
          }
        };
        const abort = () => {
          timedOut = true;
          try {
            child?.kill();
          } catch {}
          if (closeTimer === null) closeTimer = setTimeout(rejectUnknown, closeGraceMs);
        };
        const timer = setTimeout(
          abort,
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
          child.stdout.on('data', (chunk) => {
            const b = Buffer.from(chunk);
            bytes += b.length;
            if (bytes > 1048576) {
              abort();
              return;
            }
            chunks.push(b);
          });
          child.stderr.on('data', (chunk) => {
            errorBytes += Buffer.byteLength(chunk);
            if (errorBytes > 65536) abort();
          });
          child.stdin.on('error', abort);
          child.stdout.on('error', abort);
          child.stderr.on('error', abort);
          child.on('error', () => {
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
            finish();
          });
          child.stdin.end(payload);
          payload = null;
        } catch {
          timedOut = true;
          finish();
        }
      });
    },
    state() {
      return Object.freeze({ pendingRequests, unclosedResponses: pendingRequests, closed, failed });
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
