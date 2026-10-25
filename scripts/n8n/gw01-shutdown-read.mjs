import { createHash, randomUUID } from 'node:crypto';
import { lookup as osLookup } from 'node:dns';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const windowId = '76c2ad42-c094-4ba4-9a0b-566e19b97780';
const original = Object.freeze({
  audience: 'https://everyone-market-researcher-7k5et630y-muhammed-abdelrahman.vercel.app',
  commitSha: '4d4d13ebf241f12df64de772b0024bf6d5a067e0',
  deploymentId: 'dpl_34mF18oQnjrqS67pdXMBsChLfV7g',
  projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  branch: 'm03-n8n-foundation',
});
const bindingKeys = ['audience', 'commitSha', 'deploymentId', 'projectId', 'branch'];
const files = [
  'gw01-shutdown-read.mjs',
  'gw01-trial.mjs',
  'gw01-trial-config.json',
  'gw01-reviewed-preview.json',
  'gw01-shutdown-packet.json',
].map((n) => 'scripts/n8n/' + n);
const codes = [
  'INPUT',
  'PROOF',
  'STATE',
  'SEAL',
  'DNS',
  'TLS',
  'STATUS',
  'BODY',
  'TIMEOUT',
  'CLOSE',
  'JOURNAL',
  'CHILD',
].map((c) => 'GW01_SHUTDOWN_' + c);
const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  Object.keys(v).every((k) => keys.includes(k));
const fail = (code) => {
  throw Error('GW01_SHUTDOWN_' + code);
};
const safeCode = (error, fallback = 'INPUT') =>
  codes.includes(error?.message) ? error.message : 'GW01_SHUTDOWN_' + fallback;
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const iso = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(Z|[+-]\d\d:\d\d)$/.test(v) &&
  Number.isFinite(Date.parse(v));
const uuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const same = (a, b) => bindingKeys.every((k) => a[k] === b[k]);
function binding(v) {
  if (
    !exact(v, bindingKeys) ||
    v.projectId !== original.projectId ||
    v.branch !== original.branch ||
    typeof v.audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(v.audience) ||
    typeof v.commitSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(v.commitSha) ||
    typeof v.deploymentId !== 'string' ||
    !/^dpl_[A-Za-z0-9]{16,80}$/.test(v.deploymentId)
  )
    fail('INPUT');
  return v;
}
function previewBinding(v) {
  if (
    !exact(v, ['version', ...bindingKeys, 'teamId', 'target', 'protection', 'routeDisabledVerified']) ||
    v.version !== 1 ||
    v.teamId !== 'team_gboXPxTevpCOZuaA8eY9PmR1' ||
    v.target !== 'preview' ||
    v.protection !== 'all_except_custom_domains' ||
    typeof v.routeDisabledVerified !== 'boolean'
  )
    fail('INPUT');
  return binding(Object.fromEntries(bindingKeys.map((k) => [k, v[k]])));
}
function writerProof(r) {
  const s = r?.result,
    w = s?.window;
  if (
    !exact(r, [
      'version',
      'mode',
      'status',
      'privateRead',
      'rootChildClosed',
      'handoffRetained',
      'nativeExit',
      'result',
    ]) ||
    r.version !== 1 ||
    r.mode !== 'Close' ||
    r.status !== 'complete' ||
    r.privateRead !== true ||
    r.rootChildClosed !== true ||
    typeof r.handoffRetained !== 'boolean' ||
    r.nativeExit !== 0 ||
    !exact(s, [
      'version',
      'status',
      'mode',
      'code',
      'identity',
      'authorizationDenials',
      'window',
      'connectionClosed',
    ]) ||
    s.version !== 1 ||
    s.status !== 'complete' ||
    s.mode !== 'Close' ||
    s.code !== null ||
    s.connectionClosed !== true ||
    !integer(s.authorizationDenials, 0, 4) ||
    !exact(s.identity, ['currentUser', 'sessionUser', 'database', 'projectRef']) ||
    s.identity.currentUser !== 'n8n_writer' ||
    s.identity.sessionUser !== 'n8n_writer' ||
    s.identity.database !== 'postgres' ||
    s.identity.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    !exact(w, [
      'id',
      'startsAt',
      'expiresAt',
      'closed',
      'totalAdmitted',
      'boundAudience',
      'boundCommitSha',
      'boundDeploymentId',
    ]) ||
    w.id !== windowId ||
    w.closed !== true ||
    !integer(w.totalAdmitted, 0, 100) ||
    (w.startsAt === null) !== (w.expiresAt === null) ||
    (w.startsAt !== null &&
      (!iso(w.startsAt) || !iso(w.expiresAt) || Date.parse(w.expiresAt) - Date.parse(w.startsAt) !== 1800000))
  )
    fail('PROOF');
  return w;
}
function revocationProof(r) {
  const booleans = [
    'childClosed',
    'handoffRetained',
    'ownEntryPresent',
    'ownershipMetadataVerified',
    'createdReceiptRecorded',
    'recoveredReadbackRecorded',
    'soleOwnedDefaultVerified',
    'revocationReadbackVerified',
    'nonDefaultVerified',
    'otherEntriesRequested',
  ];
  const counts = [
    'otherEntryCount',
    'otherAutomationCount',
    'otherSelectedDefaultCount',
    'unknownOtherFlagCount',
  ];
  if (
    !exact(r, [
      'version',
      'mode',
      'status',
      'code',
      'nativeExit',
      'defaultFlagShape',
      'provenance',
      ...booleans,
      ...counts,
    ]) ||
    r.version !== 1 ||
    !['Revoke', 'ReconcileRevoked'].includes(r.mode) ||
    r.status !== 'complete' ||
    r.code !== null ||
    r.nativeExit !== 0 ||
    booleans.some((k) => typeof r[k] !== 'boolean') ||
    counts.some((k) => r[k] !== 0) ||
    ![null, 'absent', 'true', 'false', 'not_boolean'].includes(r.defaultFlagShape) ||
    r.provenance !== 'recovered_sole_readback' ||
    r.childClosed !== true ||
    r.handoffRetained !== false ||
    r.ownEntryPresent !== false ||
    r.recoveredReadbackRecorded !== true ||
    r.revocationReadbackVerified !== true ||
    r.soleOwnedDefaultVerified !== false ||
    r.nonDefaultVerified !== false ||
    r.otherEntriesRequested !== false
  )
    fail('PROOF');
}

/** Public evidence declarations are sealed separately by the coordinator. This
 * validates their contract; it does not manufacture an actual Close/revoke. */
export function checkShutdownPrerequisites(packet, preview, coordinator, clock = Date.now) {
  if (
    !exact(packet, ['version', 'windowId', 'writerCloseReceipt', 'bypassRevocationReceipt', 'targets']) ||
    packet.version !== 1 ||
    packet.windowId !== windowId ||
    !Array.isArray(packet.targets) ||
    packet.targets.length < 1 ||
    packet.targets.length > 2 ||
    typeof clock !== 'function'
  )
    fail('INPUT');
  const target = previewBinding(preview),
    targets = packet.targets.map(binding);
  if (
    !same(targets[0], original) ||
    new Set(targets.map((t) => t.audience)).size !== targets.length ||
    !same(targets.at(-1), target)
  )
    fail('PROOF');
  const w = writerProof(packet.writerCloseReceipt);
  revocationProof(packet.bypassRevocationReceipt);
  let state;
  try {
    state = coordinator.snapshot();
    for (const t of targets) coordinator.assertDeployment(t, original);
  } catch {
    fail('STATE');
  }
  const known = [...state.verifiedRejectedAudiences, ...state.unverifiedAudiences];
  const pending = targets.filter((t) => !state.verifiedRejectedAudiences.includes(t.audience));
  const now = clock();
  if (
    state.windowId !== windowId ||
    state.closed !== true ||
    state.inFlight !== 0 ||
    !integer(state.attempts, 0, 100) ||
    !integer(state.remaining, 0, 100) ||
    state.remaining !== 100 - state.attempts ||
    state.remaining < pending.length ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    known.length !== targets.length ||
    new Set(known).size !== targets.length ||
    known.some((a) => !targets.some((t) => t.audience === a))
  )
    fail('STATE');
  const abort = targets.length === 1;
  if (abort) {
    if (
      !same(target, original) ||
      state.startedAt !== null ||
      state.expiresAt !== null ||
      state.authoritativeWindowBound !== false ||
      state.databaseStartedAt !== null ||
      state.databaseExpiresAt !== null ||
      w.startsAt !== null ||
      w.expiresAt !== null ||
      w.boundAudience !== null ||
      w.boundCommitSha !== null ||
      w.boundDeploymentId !== null ||
      w.totalAdmitted !== 0
    )
      fail('PROOF');
  } else if (
    same(target, original) ||
    w.boundAudience !== target.audience ||
    w.boundCommitSha !== target.commitSha ||
    w.boundDeploymentId !== target.deploymentId ||
    w.startsAt === null ||
    state.authoritativeWindowBound !== true ||
    !iso(state.startedAt) ||
    !iso(state.expiresAt) ||
    Date.parse(state.databaseStartedAt) !== Date.parse(w.startsAt) ||
    Date.parse(state.databaseExpiresAt) !== Date.parse(w.expiresAt) ||
    Date.parse(state.expiresAt) > Date.parse(w.expiresAt) ||
    (pending.length && now >= Date.parse(state.expiresAt))
  )
    fail('PROOF');
  return { path: abort ? 'prepared_abort' : 'runtime', pending, state };
}
function publicAddress(v) {
  if (isIP(v) === 4) {
    const [a, b, c] = v.split('.').map(Number);
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
  if (isIP(v) !== 6 || v.includes('%') || v.includes('.')) return false;
  const [first, second] = v.toLowerCase().split(':'),
    a = parseInt(first, 16),
    b = second ? parseInt(second, 16) : 0;
  return (
    a >= 0x2000 &&
    a <= 0x3fff &&
    a !== 0x2002 &&
    !(a === 0x2001 && (b <= 0x1ff || b === 0xdb8)) &&
    !(a === 0x3fff && b <= 0xfff)
  );
}
function lookupPublic(host, signal, lookup) {
  return new Promise((done, rejected) => {
    let settled = false;
    const finish = (error, rows) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      if (error) rejected(Error(signal.aborted ? 'GW01_SHUTDOWN_TIMEOUT' : 'GW01_SHUTDOWN_DNS'));
      else done(rows[0]);
    };
    const abort = () => finish(true);
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      lookup(host, { all: true, verbatim: true }, (error, rows) => {
        if (
          error ||
          !Array.isArray(rows) ||
          rows.length < 1 ||
          rows.length > 100 ||
          rows.some((r) => !r || r.family !== isIP(r.address) || !publicAddress(r.address))
        )
          finish(true);
        else finish(null, rows);
      });
    } catch {
      finish(true);
    }
  });
}
function nativePost(target, requestId, address, signal, request, closeMs) {
  return new Promise((done) => {
    const host = new URL(target.audience).hostname,
      body = JSON.stringify({ version: 1, requestId, operation: 'identity.read', args: {} });
    let req,
      response,
      requestClosed = true,
      responseClosed = true,
      socketClosed = true,
      tlsVerified = false,
      httpStatus = null,
      bodyEnded = false,
      declaredLength = null,
      size = 0,
      code = null,
      settled = false,
      closeTimer;
    const result = () => ({
      httpStatus,
      tlsVerified,
      socketsClosed: requestClosed && responseClosed && socketClosed,
      bodyDiscarded: bodyEnded,
      code,
    });
    const complete = () => {
      if (settled || !requestClosed || !responseClosed || !socketClosed || (!code && !bodyEnded)) return;
      settled = true;
      clearTimeout(closeTimer);
      signal.removeEventListener('abort', abort);
      done(result());
    };
    const stop = (nextCode) => {
      if (settled) return;
      if (!code) code = nextCode;
      if (!closeTimer)
        closeTimer = setTimeout(() => {
          if (!settled) {
            settled = true;
            signal.removeEventListener('abort', abort);
            code = 'GW01_SHUTDOWN_CLOSE';
            done(result());
          }
        }, closeMs);
      try {
        response?.destroy();
      } catch {
        /* fixed cleanup verdict below */
      }
      try {
        req?.destroy();
      } catch {
        /* fixed cleanup verdict below */
      }
      complete();
    };
    const abort = () => stop('GW01_SHUTDOWN_TIMEOUT');
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      requestClosed = false;
      req = request(
        {
          hostname: host,
          port: 443,
          path: '/api/internal/n8n/rpc',
          method: 'POST',
          servername: host,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
          agent: false,
          autoSelectFamily: false,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
          },
          lookup: (name, options, cb) => {
            if (name !== host) return cb(Error('GW01_SHUTDOWN_DNS'));
            cb(null, ...(options?.all ? [[address]] : [address.address, address.family]));
          },
        },
        (res) => {
          if (settled) {
            res.destroy();
            return;
          }
          response = res;
          responseClosed = false;
          res.once('close', () => {
            responseClosed = true;
            complete();
          });
          res.once('error', () => stop('GW01_SHUTDOWN_BODY'));
          res.once('aborted', () => stop('GW01_SHUTDOWN_BODY'));
          res.on('data', (chunk) => {
            size += chunk.length;
            if (size > 65536) stop('GW01_SHUTDOWN_BODY');
          });
          res.once('end', () => {
            if (!code && (res.complete !== true || (declaredLength !== null && size !== declaredLength))) {
              stop('GW01_SHUTDOWN_BODY');
              return;
            }
            if (!code) bodyEnded = true;
            complete();
          });
          if (!tlsVerified) {
            stop('GW01_SHUTDOWN_TLS');
            return;
          }
          if (!integer(res.statusCode, 100, 599)) {
            stop('GW01_SHUTDOWN_STATUS');
            return;
          }
          httpStatus = res.statusCode;
          try {
            if (res.headers === null || typeof res.headers !== 'object' || Array.isArray(res.headers)) {
              stop('GW01_SHUTDOWN_BODY');
              return;
            }
            if (Object.hasOwn(res.headers, 'content-length')) {
              const length = res.headers['content-length'];
              if (
                typeof length !== 'string' ||
                !/^(0|[1-9][0-9]{0,4})$/.test(length) ||
                Number(length) > 65536 ||
                Object.hasOwn(res.headers, 'transfer-encoding')
              ) {
                stop('GW01_SHUTDOWN_BODY');
                return;
              }
              declaredLength = Number(length);
            }
          } catch {
            stop('GW01_SHUTDOWN_BODY');
          }
        },
      );
      req.once('socket', (socket) => {
        socketClosed = false;
        socket.once('close', () => {
          socketClosed = true;
          complete();
        });
        socket.once('secureConnect', () => {
          tlsVerified = socket.encrypted === true && socket.authorized === true;
          if (!tlsVerified) stop('GW01_SHUTDOWN_TLS');
        });
      });
      req.once('error', () => stop(tlsVerified ? 'GW01_SHUTDOWN_BODY' : 'GW01_SHUTDOWN_TLS'));
      req.once('close', () => {
        requestClosed = true;
        complete();
      });
      req.end(body);
    } catch {
      requestClosed = req ? requestClosed : true;
      stop('GW01_SHUTDOWN_BODY');
    }
  });
}
export async function sendPublicShutdown(target, requestId, dependencies = {}) {
  binding(target);
  if (!uuid(requestId)) fail('INPUT');
  const operationMs = dependencies.operationMs ?? 10000,
    closeMs = dependencies.closeMs ?? 5000;
  if (!integer(operationMs, 1, 10000) || !integer(closeMs, 1, 5000)) fail('INPUT');
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), operationMs);
  let networkRequests = 0;
  try {
    const address = await lookupPublic(
      new URL(target.audience).hostname,
      controller.signal,
      dependencies.lookup ?? osLookup,
    );
    if (controller.signal.aborted) fail('TIMEOUT');
    const request = (...args) => {
      networkRequests++;
      return (dependencies.request ?? httpsRequest)(...args);
    };
    return {
      ...(await nativePost(target, requestId, address, controller.signal, request, closeMs)),
      networkRequests,
    };
  } catch (error) {
    return {
      httpStatus: null,
      tlsVerified: false,
      socketsClosed: true,
      bodyDiscarded: false,
      code: safeCode(error, 'DNS'),
      networkRequests,
    };
  } finally {
    clearTimeout(timer);
  }
}
const base = () => ({
  version: 1,
  status: 'blocked',
  code: null,
  privateRead: false,
  ownedChildClosed: null,
  attemptsReserved: 0,
  networkRequests: 0,
  attemptsAfter: null,
  results: [],
});
export async function runShutdownRead(packet, preview, dependencies = {}) {
  const out = base(),
    coordinator = dependencies.coordinator;
  let plan;
  try {
    plan = checkShutdownPrerequisites(packet, preview, coordinator, dependencies.clock ?? Date.now);
  } catch (error) {
    out.code = safeCode(error);
    return out;
  }
  out.attemptsAfter = plan.state.attempts;
  for (const target of plan.pending) {
    let reserved;
    const requestId = randomUUID();
    try {
      reserved = coordinator.reserve({
        requestId,
        operation: 'identity.read',
        audience: target.audience,
        kind: 'shutdown',
      });
    } catch {
      out.code = 'GW01_SHUTDOWN_JOURNAL';
      out.status = out.attemptsReserved ? 'unverified' : 'blocked';
      return out;
    }
    out.attemptsReserved++;
    const r = await sendPublicShutdown(target, requestId, dependencies);
    out.networkRequests += r.networkRequests;
    const complete = r.code === null && r.tlsVerified && r.socketsClosed && r.bodyDiscarded;
    const row = {
      audience: target.audience,
      requestId,
      attemptId: reserved.attemptId,
      httpStatus: r.httpStatus,
      tlsVerified: r.tlsVerified,
      socketsClosed: r.socketsClosed,
      bodyDiscarded: r.bodyDiscarded,
      journalFinished: false,
      rejected: complete && [401, 403, 410].includes(r.httpStatus),
      code: r.code ?? ([401, 403, 410].includes(r.httpStatus) ? null : 'GW01_SHUTDOWN_STATUS'),
    };
    try {
      coordinator.finish(
        reserved.attemptId,
        complete ? { outcome: 'http', httpStatus: r.httpStatus } : { outcome: 'unknown', httpStatus: null },
      );
      row.journalFinished = true;
      out.attemptsAfter = coordinator.snapshot().attempts;
    } catch {
      row.rejected = false;
      row.code = 'GW01_SHUTDOWN_JOURNAL';
    }
    out.results.push(row);
    if (!row.rejected) {
      out.status = 'unverified';
      out.code = row.code;
      return out;
    }
  }
  out.status = 'verified';
  return out;
}
function safePath(path, maximum = 1048576) {
  const file = resolve(path);
  for (let cursor = file; ; cursor = dirname(cursor)) {
    const s = lstatSync(cursor);
    if (s.isSymbolicLink() || (cursor === file ? !s.isFile() || s.size > maximum : !s.isDirectory()))
      fail('SEAL');
    if (dirname(cursor) === cursor) break;
  }
  return file;
}
export function readShutdownPublic(root) {
  try {
    const seal = JSON.parse(
      readFileSync(safePath(join(root, 'scripts/n8n/gw01-shutdown-seal.json'), 65536), 'utf8'),
    );
    if (!exact(seal, ['version', 'files']) || seal.version !== 1 || !exact(seal.files, files)) fail('SEAL');
    for (const path of files)
      if (
        typeof seal.files[path] !== 'string' ||
        !/^[a-f0-9]{64}$/.test(seal.files[path]) ||
        createHash('sha256')
          .update(readFileSync(safePath(join(root, path))))
          .digest('hex') !== seal.files[path]
      )
        fail('SEAL');
    const json = (name) => JSON.parse(readFileSync(safePath(join(root, 'scripts/n8n', name), 65536), 'utf8'));
    const config = json('gw01-trial-config.json');
    if (
      !exact(config, ['windowId', 'audiences']) ||
      config.windowId !== windowId ||
      !Array.isArray(config.audiences) ||
      config.audiences.length !== 1 ||
      config.audiences[0] !== original.audience
    )
      fail('SEAL');
    return { packet: json('gw01-shutdown-packet.json'), preview: json('gw01-reviewed-preview.json'), config };
  } catch {
    fail('SEAL');
  }
}
const osNames = ['SystemRoot', 'WINDIR', 'TEMP', 'TMP'];
// libuv adds these mandatory Windows base variables even when an explicit sparse
// environment is supplied. They contain OS identity/path metadata, not API keys.
const windowsBaseNames = [
  'HOMEDRIVE',
  'HOMEPATH',
  'LOGONSERVER',
  'PATH',
  'SYSTEMDRIVE',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'WINDIR',
  'USERDOMAIN',
  'USERNAME',
  'USERPROFILE',
];
export function shutdownChildEnvironment(env) {
  const out = {};
  for (const name of osNames) {
    const key = Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key && typeof env[key] === 'string') out[name] = env[key];
  }
  return out;
}
function receiptValid(r) {
  return (
    exact(r, Object.keys(base())) &&
    r.version === 1 &&
    ['blocked', 'unverified', 'verified', 'check_only_ready'].includes(r.status) &&
    (r.code === null || codes.includes(r.code)) &&
    r.privateRead === false &&
    r.ownedChildClosed === null &&
    integer(r.attemptsReserved, 0, 2) &&
    integer(r.networkRequests, 0, 2) &&
    (r.attemptsAfter === null || integer(r.attemptsAfter, 0, 100)) &&
    Array.isArray(r.results) &&
    r.results.length <= 2 &&
    r.results.every(
      (v) =>
        exact(v, [
          'audience',
          'requestId',
          'attemptId',
          'httpStatus',
          'tlsVerified',
          'socketsClosed',
          'bodyDiscarded',
          'journalFinished',
          'rejected',
          'code',
        ]) &&
        /^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(v.audience) &&
        uuid(v.requestId) &&
        uuid(v.attemptId) &&
        (v.httpStatus === null || integer(v.httpStatus, 100, 599)) &&
        ['tlsVerified', 'socketsClosed', 'bodyDiscarded', 'journalFinished', 'rejected'].every(
          (k) => typeof v[k] === 'boolean',
        ) &&
        (v.code === null || codes.includes(v.code)),
    )
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let out = base();
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  if (
    process.argv.length === 4 &&
    process.argv[2] === '--owned-shutdown' &&
    ['CheckOnly', 'Verify'].includes(process.argv[3])
  ) {
    try {
      const allowed = process.platform === 'win32' ? windowsBaseNames : osNames.map((n) => n.toUpperCase());
      if (Object.keys(process.env).some((k) => !allowed.includes(k.toUpperCase()))) fail('CHILD');
      const context = readShutdownPublic(root);
      // Import only after the sealed public coordinator bytes were verified.
      const { createTrialCoordinator } = await import(
        pathToFileURL(join(root, 'scripts/n8n/gw01-trial.mjs')).href
      );
      const coordinator = createTrialCoordinator(join(root, 'scripts/n8n/out/gw01'), context.config);
      if (process.argv[3] === 'CheckOnly') {
        const plan = checkShutdownPrerequisites(context.packet, context.preview, coordinator);
        out = { ...base(), status: 'check_only_ready', attemptsAfter: plan.state.attempts };
      } else out = await runShutdownRead(context.packet, context.preview, { coordinator });
    } catch (error) {
      out.code = safeCode(error);
    }
  } else if (process.argv.length === 3 && ['CheckOnly', 'Verify'].includes(process.argv[2])) {
    try {
      const child = spawnSync(
        process.execPath,
        [fileURLToPath(import.meta.url), '--owned-shutdown', process.argv[2]],
        {
          cwd: root,
          env: shutdownChildEnvironment(process.env),
          windowsHide: true,
          timeout: 45000,
          killSignal: 'SIGKILL',
          maxBuffer: 32768,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        },
      );
      const r = JSON.parse(child.stdout);
      if (
        child.error ||
        child.signal ||
        ![0, 1].includes(child.status) ||
        !receiptValid(r) ||
        (child.status === 0) !== ['verified', 'check_only_ready'].includes(r.status)
      )
        fail('CHILD');
      out = { ...r, ownedChildClosed: true };
    } catch {
      out = { ...base(), code: 'GW01_SHUTDOWN_CHILD', ownedChildClosed: true };
    }
  } else out.code = 'GW01_SHUTDOWN_INPUT';
  process.stdout.write(JSON.stringify(out));
  process.exitCode = ['verified', 'check_only_ready'].includes(out.status) ? 0 : 1;
}
