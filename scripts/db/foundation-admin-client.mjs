import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixed = () => Error('FOUNDATION_ADMIN_BLOCKED');
const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) =>
  object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const osEnvironment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
      (key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]]),
    ),
  );

// This client never reads or receives the administrator password. The new,
// sealed PowerShell child owns DPAPI, PGPASSWORD, exact SQL and child cleanup.
export async function startFoundationAdminClient(
  { repositoryRoot = defaultRoot, now = Date.now, signal } = {},
  deps = {},
) {
  if (typeof repositoryRoot !== 'string' || typeof now !== 'function' || signal?.aborted) throw fixed();
  const root = resolve(repositoryRoot),
    launch = deps.spawn ?? spawn;
  if (root.toLowerCase() !== resolve(defaultRoot).toLowerCase()) throw fixed();
  const child = launch(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      resolve(root, 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1'),
      '-PhaseAControl',
    ],
    { cwd: root, env: osEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let buffer = '',
    discardOutput = false,
    stopped = false,
    failed = false,
    pending = null,
    finalReceipt = null,
    ready = null,
    requests = 0;
  let settled = false,
    exitResult;
  const closed = new Promise((resolveClose) => {
    exitResult = resolveClose;
  });
  function poison() {
    failed = true;
    pending?.reject(fixed());
    pending = null;
    // EOF lets the reviewed PowerShell finally close its current bounded CLI
    // child and consume its handoff. Killing only the parent could orphan that
    // credential-bearing CLI. No new command is sent after this fence.
    try {
      child.stdin.end();
    } catch {}
  }
  const onAbort = () => poison();
  signal?.addEventListener('abort', onAbort, { once: true });
  child.once('error', poison);
  child.stderr.on('data', () => {}); // Raw native/PowerShell diagnostics are private and discarded.
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    if (discardOutput) return;
    if (Buffer.byteLength(buffer, 'utf8') + Buffer.byteLength(chunk, 'utf8') > 1048576) {
      discardOutput = true;
      buffer = '';
      poison();
      return;
    }
    buffer += chunk;
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n'),
        line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      try {
        const value = JSON.parse(line);
        if (failed) {
          if (
            ready &&
            value.version === 1 &&
            value.runId === ready.runId &&
            value.phaseAControl === true &&
            !finalReceipt
          )
            finalReceipt = value;
          continue;
        }
        if (!ready) {
          if (
            !exact(value, [
              'type',
              'runId',
              'historyAfter',
              'projectRef',
              'hardDeadline',
              'actionDeadline',
              'stopNewAt',
              'postchecksVerified',
            ]) ||
            value.type !== 'foundation_admin_ready' ||
            value.historyAfter !== 'complete' ||
            value.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
            value.postchecksVerified !== false ||
            ![value.hardDeadline, value.actionDeadline, value.stopNewAt].every(
              (time) => typeof time === 'string' && Number.isFinite(Date.parse(time)),
            )
          )
            throw fixed();
          ready = Object.freeze(value);
          pending?.resolve(ready);
          pending = null;
        } else if (value.type === 'foundation_admin_result') {
          if (
            !pending ||
            !exact(value, ['type', 'id', 'kind', 'ok', 'result']) ||
            value.id !== pending.id ||
            value.kind !== pending.kind ||
            value.ok !== true
          )
            throw fixed();
          pending.resolve(value.result);
          pending = null;
        } else if (value.version === 1 && value.runId === ready.runId && value.phaseAControl === true) {
          if (finalReceipt) throw fixed();
          finalReceipt = value;
        } else throw fixed();
      } catch {
        if (failed) continue;
        poison();
        return;
      }
    }
  });
  child.once('close', (code, closeSignal) => {
    settled = true;
    signal?.removeEventListener('abort', onAbort);
    pending?.reject(fixed());
    pending = null;
    exitResult(
      Object.freeze({ nativeExit: code, signal: closeSignal, childClosed: true, receipt: finalReceipt }),
    );
  });
  const race = async (operation, milliseconds) => {
    let timer;
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            poison();
            reject(fixed());
          }, milliseconds);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    await race(
      new Promise((resolveReady, reject) => {
        pending = { resolve: resolveReady, reject };
      }),
      420000,
    );
    const request = async (kind, args = {}) => {
      if (
        failed ||
        stopped ||
        settled ||
        pending ||
        ++requests > 512 ||
        signal?.aborted ||
        now() >= Date.parse(ready.hardDeadline)
      )
        throw fixed();
      const id = randomUUID(),
        text = JSON.stringify({ id, kind, args });
      if (Buffer.byteLength(text, 'utf8') > 131072) throw fixed();
      const response = new Promise((resolveResponse, reject) => {
        pending = { id, kind, resolve: resolveResponse, reject };
      });
      try {
        child.stdin.write(text + '\n', (error) => {
          if (error) poison();
        });
        const compositeCap =
          {
            postcheck: 300000,
            provision: 120000,
            fixture: 90000,
            archive: 90000,
            close: 120000,
            smokeAssert: 45000,
          }[kind] ?? 45000;
        return await race(response, Math.min(compositeCap, Date.parse(ready.hardDeadline) - now()));
      } catch {
        poison();
        throw fixed();
      }
    };
    const api = {
      ready,
      postcheck: () => request('postcheck'),
      preflight: () => request('preflight'),
      fixture: () => request('fixture'),
      provision: (packet) => request('provision', packet),
      async readGateway({ query, params, signal: requestSignal } = {}) {
        const expected = readFileSync(resolve(root, 'scripts/db/foundation-settlement.sql'), 'utf8').trim();
        if (
          requestSignal?.aborted ||
          typeof query !== 'string' ||
          query.trim() !== expected ||
          !Array.isArray(params) ||
          params.length !== 4
        )
          throw fixed();
        return request('settlement', {
          windowId: params[0],
          requestIds: params[1],
          nativeIds: params[2],
          terminalCosts: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
        });
      },
      readUnknown: () => request('unknownCallbackAbsent'),
      firstOriginalContext: () => request('firstOriginalContext'),
      verifyAtomicInput: (args) => request('verifyAtomicInput', args),
      replaySnapshot: () => request('replaySnapshot'),
      smokeAssert: (args) => request('smokeAssert', args),
      close: () => request('close'),
      archive: () => request('archive'),
      async end() {
        await request('end');
        stopped = true;
        child.stdin.end();
        const result = await race(closed, 15000);
        if (
          result.nativeExit !== 0 ||
          !result.receipt ||
          result.receipt.childrenClosed !== true ||
          result.receipt.handoffDeleted !== true ||
          result.receipt.leaseDeleted !== true ||
          result.receipt.scratchDeleted !== true
        )
          throw fixed();
        return result;
      },
      async abort() {
        stopped = true;
        poison();
        return race(closed, 250000);
      },
      state: () =>
        Object.freeze({
          ready: !!ready,
          requests,
          failed,
          childClosed: settled,
          requestPending: pending !== null,
          outputDiscarded: discardOutput,
        }),
    };
    return Object.freeze(api);
  } catch {
    poison();
    try {
      await race(closed, 250000);
    } catch {}
    throw fixed();
  }
}
