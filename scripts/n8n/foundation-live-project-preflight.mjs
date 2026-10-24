import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { foundationSetupVercelPins } from './foundation-live-setup-no-retry.mjs';
import { createFoundationLiveSetupCliTransport } from './foundation-live-setup-transport.mjs';
import { projectFoundationSetupPredicates } from './foundation-live-setup-diagnostic.mjs';
import { runFoundationVercelAuthPreflight } from './foundation-vercel-auth-preflight.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const machine = Object.freeze({
  platform: 'win32',
  profile: 'C:\\Users\\iway',
  appData: 'C:\\Users\\iway\\AppData\\Roaming',
  localTemp: 'C:\\Users\\iway\\AppData\\Local\\Temp',
  nodePath: 'C:\\Program Files\\nodejs\\node.exe',
  nodeSha256: '9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de',
  cliRoot: 'C:\\Users\\iway\\AppData\\Roaming\\npm\\node_modules\\vercel',
});
const attemptRelative =
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-attempt-20261022.json';
const historicalCheckpointRelative =
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-checkpoint-20261022.json';
export const foundationLiveProjectPreflightCheckpoint = Object.freeze({
  segmentId: '1c69c89e-7807-46d5-b7b8-ca28285ff2b4',
  sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
  attemptRelative,
  historicalCheckpointRelative,
  ledgerRelative:
    'scripts/n8n/out/foundation/live/project-preflight-1c69c89e-7807-46d5-b7b8-ca28285ff2b4.jsonl',
  parentLockFilename: 'emr-m03-acceptance-parent.operation.lock',
  ownerProvisionRelative:
    'scripts/db/out/m03-foundation-startup-replacement-1c69c89e-7807-46d5-b7b8-ca28285ff2b4-owner-provision-attempt.json',
  projectPath: '/v9/projects/prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu?teamId=team_gboXPxTevpCOZuaA8eY9PmR1',
  recordPins: Object.freeze({
    [attemptRelative]: '61ea60bedf0268e6145154e6804767d7c76a9db35fda23556864c615f035ea31',
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-followup-20261022.json':
      'aaddc9ff8f86e8010a29421dbe1a941ff9be1bc2022d977d4943c2126508f96f',
    [historicalCheckpointRelative]: 'e144d73dfbcab1e5a286ab9ba11df28bcbd10c8a9ad39eecb7852fee3d61d758',
  }),
  cliPins: foundationSetupVercelPins,
});
const c = foundationLiveProjectPreflightCheckpoint;
const sourcePins = Object.freeze({
  'scripts/n8n/foundation-live-setup-transport.mjs':
    'e830fef613d065e0e3b06528f6e5318d487558c1c89fab37427c3ce64296d3f8',
  'scripts/n8n/foundation-live-setup-no-retry.mjs':
    '725736cf5724bec7f16171c11ccc5dbd75f8ed5688b2b3919dbf4b54831170e4',
  'scripts/n8n/foundation-live-setup-diagnostic.mjs':
    '8cfa9313b19283079805e63d287e8465b927f9090d4430e0a57896b16c6d5ed5',
  'scripts/n8n/foundation-vercel-auth-preflight.mjs':
    'c1e0b211f5a03ca336a58a9c2bcc634bd785d08859867622a494cf6ad7237233',
});
const fail = () => {
  throw Error('M03_PROJECT_PREFLIGHT_BLOCKED');
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
function ordinary(path, optional = false) {
  let leaf;
  for (let p = resolve(path); ; p = dirname(p)) {
    try {
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink() || (p !== resolve(path) && !st.isDirectory())) fail();
      if (p === resolve(path)) leaf = st;
    } catch (e) {
      if (e?.code !== 'ENOENT' || (p === resolve(path) && !optional)) fail();
    }
    if (dirname(p) === p) break;
  }
  if (leaf && (!leaf.isFile() || leaf.nlink !== 1)) fail();
  return leaf;
}
function absent(path) {
  if (ordinary(path, true)) fail();
}
function assertHeldPath(path, descriptor) {
  const disk = ordinary(path),
    held = fs.fstatSync(descriptor);
  if (
    !held.isFile() ||
    held.nlink !== 1 ||
    disk.dev !== held.dev ||
    disk.ino !== held.ino ||
    disk.size !== held.size ||
    disk.mtimeMs !== held.mtimeMs
  )
    fail();
}
function publicBytes(path, expected, maximum = 2097152) {
  const before = ordinary(path);
  if (!Number.isSafeInteger(before.size) || before.size < 0 || before.size > maximum) fail();
  const bytes = fs.readFileSync(path);
  const after = ordinary(path);
  if (
    bytes.length !== before.size ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.mtimeMs !== after.mtimeMs ||
    before.size !== after.size ||
    hash(bytes) !== expected
  )
    fail();
  return bytes;
}
function publicJson(relative, expected) {
  return JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(publicBytes(relativePath(relative), expected)),
  );
}
function relativePath(relative) {
  if (
    typeof relative !== 'string' ||
    !/^(?:scripts|milestones)\//.test(relative) ||
    relative.includes('\\') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..')
  )
    fail();
  const path = resolve(repo, relative);
  if (!path.startsWith(resolve(repo) + (process.platform === 'win32' ? '\\' : '/'))) fail();
  return path;
}
function context(dependencies) {
  if (
    !exact(dependencies, Object.keys(dependencies)) ||
    Object.keys(dependencies).some(
      (k) => !['now', 'processAlive', 'readMetadata', 'transportDependencies'].includes(k),
    )
  )
    fail();
  const now = dependencies.now ?? Date.now;
  const processAlive =
    dependencies.processAlive ??
    ((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (e) {
        return e?.code !== 'ESRCH';
      }
    });
  if (typeof now !== 'function' || typeof processAlive !== 'function') fail();
  const clock = () => {
    const t = now();
    if (!Number.isSafeInteger(t) || t < 0) fail();
    return t;
  };
  return {
    clock,
    processAlive,
    ledger: relativePath(c.ledgerRelative),
    parent: join(machine.localTemp, c.parentLockFilename),
  };
}
function verifyPublic(x, parentOwned = false) {
  const equivalent = (a, b) => typeof a === 'string' && resolve(a).toLowerCase() === resolve(b).toLowerCase();
  if (
    process.platform !== machine.platform ||
    !equivalent(process.execPath, machine.nodePath) ||
    !equivalent(process.env.USERPROFILE ?? process.env.HOME, machine.profile) ||
    !equivalent(process.env.APPDATA ?? repo, machine.appData)
  )
    fail();
  publicBytes(machine.nodePath, machine.nodeSha256, 134217728);
  for (const [relative, expected] of Object.entries(c.cliPins))
    publicBytes(join(machine.cliRoot, relative), expected, 5242880);
  for (const [relative, expected] of Object.entries(sourcePins))
    publicBytes(relativePath(relative), expected);
  const records = {};
  for (const [relative, expected] of Object.entries(c.recordPins))
    records[relative] = publicJson(relative, expected);
  const a = records[c.attemptRelative],
    h = records[c.historicalCheckpointRelative];
  if (
    a.kind !== 'm03_startup_replacement_actual_attempt' ||
    a.segmentId !== c.segmentId ||
    a.applicationSource !== c.sourceCommitSha ||
    a.clock.oneUseConsumed !== true ||
    a.clock.automaticRenewalOrSecondChildAuthorized !== false ||
    a.database.authenticationVerified !== true ||
    a.database.migrationCount !== 14 ||
    a.database.migrationsAppliedThisAttempt !== 0 ||
    a.database.ownerProvisionIntentPresent !== false ||
    a.setup.allRowsGetOnly !== true ||
    a.setup.writeIntents !== 0 ||
    a.setup.bypassInstalledRemotely !== false ||
    a.coordinatorClose.childTransportsClosed !== true ||
    a.coordinatorClose.adminChildClosed !== true ||
    a.wrapperClose.credentialChildrenClosed !== true ||
    a.outerClose.stdoutEnded !== true ||
    a.outerClose.nativeExit !== 1 ||
    a.unusedBypassCleanup.deleted !== true ||
    a.unusedBypassCleanup.privateContentsRead !== false ||
    a.unusedBypassCleanup.nativeExit !== 0 ||
    a.acceptance.fullD !== false ||
    a.usage.currentManagement !== 5 ||
    a.usage.currentControl !== 201 ||
    a.usage.currentCombined !== 206
  )
    fail();
  if (!h.preserved || Object.keys(h.preserved).length !== 24) fail();
  for (const [relative, expected] of Object.entries(h.preserved))
    publicBytes(relativePath(relative), expected);
  if (!Array.isArray(a.publicArtifacts) || a.publicArtifacts.length !== 8) fail();
  const artifacts = new Map();
  for (const row of a.publicArtifacts) {
    if (!exact(row, ['path', 'sha256']) || artifacts.has(row.path)) fail();
    artifacts.set(row.path, publicBytes(relativePath(row.path), row.sha256));
  }
  const rows = (name) => {
    const bytes = artifacts.get('scripts/n8n/out/foundation/live/' + name + '.jsonl');
    if (!bytes) fail();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!text.endsWith('\n')) fail();
    return text.slice(0, -1).split('\n').map(JSON.parse);
  };
  const management = rows('management'),
    control = rows('control'),
    setup = rows('setup');
  if (
    management.length !== 3 ||
    management[0].event !== 'management_header' ||
    management[0].sourceCommitSha !== c.sourceCommitSha ||
    management[0].deadlineAt !== 1792584023481 ||
    management.slice(1).some((v, i) => v.event !== 'management_attempt' || v.ordinal !== i + 1) ||
    control.length !== 200 ||
    control.some(
      (v, i) => v.event !== 'control_request_intent' || v.ordinal !== i + 1 || v.kind !== 'discovery',
    ) ||
    setup.length !== 2 ||
    setup.some((v, i) => v.event !== 'setup_attempt' || v.ordinal !== i + 1 || v.kind !== 'GET')
  )
    fail();
  absent(x.ledger);
  if (!parentOwned) absent(x.parent);
  for (const relative of [
    'scripts/n8n/out/foundation/live/runtime.operation.lock',
    'scripts/n8n/out/foundation/live/preflight.jsonl',
    'scripts/n8n/out/foundation/live/runtime.jsonl',
    c.ownerProvisionRelative,
    'scripts/db/out/m03-foundation-owner-provision-attempt.json',
    'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json',
    'scripts/db/out/m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-owner-provision-attempt.json',
  ])
    absent(relativePath(relative));
  for (const pid of [44408, 60040, 5468, 35920, 49728, 12200]) if (x.processAlive(pid) !== false) fail();
}
function write(fd, row) {
  const bytes = Buffer.from(JSON.stringify(row) + '\n');
  if (bytes.length > 16384) fail();
  for (let at = 0; at < bytes.length;) {
    const n = fs.writeSync(fd, bytes, at, bytes.length - at);
    if (!Number.isSafeInteger(n) || n < 1) fail();
    at += n;
  }
  fs.fsyncSync(fd);
}
const metadataStatuses = new Set([
  'metadata_covers_75_minutes',
  'saved_auth_expired',
  'saved_auth_insufficient_coverage',
  'saved_auth_expiry_unavailable',
  'saved_auth_missing',
  'saved_auth_invalid',
  'path_blocked',
  'public_inputs_blocked',
  'child_failed',
]);
function metadataProjection(value) {
  if (
    !exact(value, [
      'kind',
      'status',
      'metadataValid',
      'unexpired',
      'covers75Minutes',
      'effectiveBackendEstablished',
      'networkRequests',
      'authenticationAttempted',
      'refreshAttempted',
      'configWritten',
      'childClosed',
    ]) ||
    value.kind !== 'm03_vercel_saved_auth_metadata' ||
    !metadataStatuses.has(value.status) ||
    value.effectiveBackendEstablished !== false ||
    value.networkRequests !== 0 ||
    value.authenticationAttempted !== false ||
    value.refreshAttempted !== false ||
    value.configWritten !== false ||
    ['metadataValid', 'unexpired', 'covers75Minutes', 'childClosed'].some(
      (k) => typeof value[k] !== 'boolean',
    )
  )
    return { status: 'child_failed', closed: false, ready: false };
  return {
    status: value.status,
    closed: value.childClosed,
    ready:
      value.status === 'metadata_covers_75_minutes' &&
      value.metadataValid &&
      value.unexpired &&
      value.covers75Minutes &&
      value.childClosed,
  };
}
const stages = new Set([
  'not_started',
  'starting',
  'native_exit',
  'utf8',
  'framing',
  'json',
  'completed',
  'stdout_limit',
  'stderr_limit',
  'child_error',
  'timeout',
  'aborted',
  'spawn_error',
]);
const codes = new Set([
  'unknown',
  'saved_auth_missing',
  'saved_auth_expired',
  'saved_auth_invalid_expiry',
  'auxiliary_scope_refusal',
  'auth_refresh_refused',
  'no_retry_bootstrap',
  'local_write_refused',
  'credential_storage_write_refused',
  'credential_storage_unsupported',
  'tls_failure',
  'dns_failure',
  'network_failure',
]);
function technical(value) {
  const unknown = {
    stage: 'unknown',
    code: 'unknown',
    httpStatus: null,
    nativeExit: null,
    childStarted: false,
    childClosed: false,
    aborted: false,
  };
  if (
    !value ||
    !stages.has(value.stage) ||
    !(
      value.httpStatus === null ||
      (Number.isInteger(value.httpStatus) && value.httpStatus >= 100 && value.httpStatus <= 599)
    ) ||
    !(
      value.nativeExit === null ||
      (Number.isInteger(value.nativeExit) &&
        value.nativeExit >= -2147483648 &&
        value.nativeExit <= 2147483647)
    ) ||
    ['childStarted', 'childClosed', 'aborted'].some((k) => typeof value[k] !== 'boolean')
  )
    return unknown;
  return {
    stage: value.stage,
    code: codes.has(value.code) ? value.code : 'unknown',
    httpStatus: value.httpStatus,
    nativeExit: value.nativeExit,
    childStarted: value.childStarted,
    childClosed: value.childClosed,
    aborted: value.aborted,
  };
}
export function checkFoundationLiveProjectPreflight(dependencies = {}) {
  try {
    const x = context(dependencies);
    verifyPublic(x);
    return Object.freeze({
      kind: 'm03_project_preflight_ready',
      privateRead: false,
      networkRequests: 0,
      managementAttempts: 5,
      controlAttempts: 201,
      combinedAttempts: 206,
      getAttemptDebited: false,
      newAcceptanceWindow: false,
    });
  } catch {
    fail();
  }
}
export async function runFoundationLiveProjectPreflight(dependencies = {}) {
  const x = context(dependencies);
  verifyPublic(x);
  let parent,
    ledger,
    transport,
    current,
    closed = true,
    metadataStatus = 'child_failed',
    debited = false,
    status = 'metadata_rejected',
    predicates = null;
  let transportReceipt = technical(null);
  try {
    parent = fs.openSync(x.parent, 'wx');
    write(parent, {
      kind: 'm03_project_preflight_parent',
      version: 1,
      segmentId: c.segmentId,
      processId: process.pid,
    });
    verifyPublic(x, true);
    ledger = fs.openSync(x.ledger, 'wx');
    write(ledger, {
      event: 'project_preflight_once_intent',
      segmentId: c.segmentId,
      at: x.clock(),
      oneUseConsumed: true,
      getAttemptDebited: false,
      managementAttempts: 5,
      controlAttempts: 201,
      combinedAttempts: 206,
    });
    closed = false;
    let saved;
    try {
      saved = metadataProjection(await (dependencies.readMetadata ?? runFoundationVercelAuthPreflight)());
    } catch {
      saved = { status: 'child_failed', closed: false, ready: false };
    }
    closed = saved.closed;
    metadataStatus = saved.status;
    write(ledger, {
      event: 'project_preflight_metadata_result',
      status: metadataStatus,
      childClosed: closed,
      covers75Minutes: saved.ready,
      at: x.clock(),
    });
    if (saved.ready) {
      assertHeldPath(x.parent, parent);
      assertHeldPath(x.ledger, ledger);
      const deadlineAt = x.clock() + 20000;
      transport = createFoundationLiveSetupCliTransport(
        {
          nodeExecutable: machine.nodePath,
          cliPath: join(machine.cliRoot, 'dist/index.js'),
          noRetryPreloadPath: relativePath('scripts/n8n/foundation-live-setup-no-retry.mjs'),
          workingDirectory: repo,
          now: x.clock,
          deadlineAt,
          authorizeRequest: (spec) => spec === current,
        },
        dependencies.transportDependencies,
      );
      current = { method: 'GET', path: c.projectPath, signal: AbortSignal.timeout(20000) };
      write(ledger, {
        event: 'project_get_intent',
        at: x.clock(),
        getAttemptDebited: true,
        managementAttempts: 6,
        controlAttempts: 201,
        combinedAttempts: 207,
      });
      debited = true;
      closed = false;
      status = 'transport_rejected';
      try {
        const r = await transport.request(current);
        status = 'project_http_rejected';
        if (r.closed === true && r.status === 200) {
          predicates = projectFoundationSetupPredicates(r.data);
          status = Object.values(predicates).every((v) => v === true)
            ? 'project_contract_ready'
            : 'project_contract_rejected';
        }
      } catch {
        /* Only the fixed technical projection below escapes. */
      } finally {
        current = null;
        transportReceipt = technical(transport.diagnostics());
        closed =
          transport.close() === true &&
          transport.state().pendingRequests === 0 &&
          transportReceipt.childClosed === true;
      }
    }
    const result = Object.freeze({
      kind: 'm03_project_preflight_result',
      status,
      privateRead: true,
      oneUseConsumed: true,
      getAttemptDebited: debited,
      managementAttempts: debited ? 6 : 5,
      controlAttempts: 201,
      combinedAttempts: debited ? 207 : 206,
      managementMaximum: 512,
      controlMaximum: 2048,
      combinedMaximum: 2560,
      metadataStatus,
      effectiveBackendEstablished: false,
      transport: Object.freeze(transportReceipt),
      predicates,
      childTransportsClosed: closed,
      newAcceptanceWindow: false,
      mutations: 0,
      historicalGetFailureCause: 'unestablished',
    });
    write(ledger, { event: 'project_preflight_result', ...result, at: x.clock() });
    return result;
  } finally {
    transport?.close();
    if (ledger !== undefined) fs.closeSync(ledger);
    if (parent !== undefined) {
      try {
        // Unknown closure or changed ownership retains the mutex/once fence.
        if (closed) {
          assertHeldPath(x.parent, parent);
          fs.unlinkSync(x.parent);
        }
      } finally {
        fs.closeSync(parent);
      }
    }
  }
}
export async function runFoundationLiveProjectPreflightCli({
  args = process.argv.slice(2),
  output = process.stdout,
  dependencies = {},
} = {}) {
  let mode;
  try {
    if (!Array.isArray(args) || args.length !== 1) fail();
    mode = args[0];
    const result =
      mode === 'CheckOnly'
        ? checkFoundationLiveProjectPreflight(dependencies)
        : mode === 'ReadProject'
          ? await runFoundationLiveProjectPreflight(dependencies)
          : fail();
    output.write(JSON.stringify(result) + '\n');
    return result.kind === 'm03_project_preflight_ready' ||
      (result.status === 'project_contract_ready' && result.childTransportsClosed === true)
      ? 0
      : 1;
  } catch {
    // A finalization failure can follow a successful private read/GET. Never
    // erase those effects with a public no-read/no-network failure claim.
    output.write(
      JSON.stringify(
        mode === 'ReadProject'
          ? {
              kind: 'm03_project_preflight_unknown',
              oneUseOutcome: 'inspect_durable_ledger',
              childTransportsClosed: false,
              newAcceptanceWindow: false,
            }
          : { kind: 'm03_project_preflight_blocked', privateRead: false, networkRequests: 0 },
      ) + '\n',
    );
    return 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runFoundationLiveProjectPreflightCli();
}
