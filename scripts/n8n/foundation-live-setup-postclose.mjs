import { createHash } from 'node:crypto';
import {
  readFileSync,
  lstatSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  unlinkSync,
  fstatSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFoundationLiveSetupCliTransport } from './foundation-live-setup-transport.mjs';
import { createFoundationSetupProjectDiagnostic } from './foundation-live-setup-diagnostic.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
export const foundationPostcloseProjectRead = Object.freeze({
  sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  attemptRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-attempt-20261021.json',
  attemptSha256: 'b984ec79c857468822e9299dd59fc2b26d71a26bb6b324dd90ecbaa7f39d1fcd',
  cleanupRelative:
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-unused-bypass-cleanup-20261021.json',
  cleanupSha256: 'aa14e59e0016b4ecc355742d348a8461d0bdefcc2ffe38199b365d113de6e8ab',
  parentLockFilename: 'emr-m03-acceptance-parent.operation.lock',
  ledgerRelative: 'scripts/n8n/out/foundation/live/postclose-project-read-20261021.jsonl',
  originalDeadlineAt: 1792584023481,
  maximum: 512,
  aggregateAttempts: 3,
});
const c = foundationPostcloseProjectRead;
const fail = () => {
  throw Error('FOUNDATION_POSTCLOSE_PROJECT_READ_BLOCKED');
};
function noLinks(path) {
  for (let p = resolve(path); ;) {
    try {
      if (lstatSync(p).isSymbolicLink()) fail();
    } catch (e) {
      if (e?.code !== 'ENOENT') fail();
    }
    const parent = dirname(p);
    if (parent === p) break;
    p = parent;
  }
}
function absent(path) {
  noLinks(path);
  try {
    lstatSync(path);
    fail();
  } catch (e) {
    if (e?.code !== 'ENOENT') fail();
  }
}
function text(path, maximum = 131072) {
  noLinks(path);
  const s = lstatSync(path);
  if (!s.isFile() || s.size > maximum) fail();
  const bytes = readFileSync(path);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function rows(path) {
  const t = text(path);
  if (!t || !t.endsWith('\n')) fail();
  try {
    return t
      .slice(0, -1)
      .split('\n')
      .map((line) => JSON.parse(line));
  } catch {
    fail();
  }
}
function pinned(relative, hash) {
  const t = text(join(repo, relative));
  if (createHash('sha256').update(Buffer.from(t)).digest('hex') !== hash) fail();
  try {
    return JSON.parse(t);
  } catch {
    fail();
  }
}
function context() {
  if (
    typeof process.env.LOCALAPPDATA !== 'string' ||
    !process.env.LOCALAPPDATA ||
    typeof process.env.APPDATA !== 'string' ||
    !process.env.APPDATA
  )
    fail();
  return {
    parent: join(process.env.LOCALAPPDATA, 'Temp', c.parentLockFilename),
    ledger: join(repo, c.ledgerRelative),
    live: join(repo, 'scripts/n8n/out/foundation/live'),
    cli: join(process.env.APPDATA, 'npm/node_modules/vercel/dist/index.js'),
  };
}
function verify({ ownParent = false, processAlive } = {}) {
  const paths = context();
  const actual = pinned(c.attemptRelative, c.attemptSha256),
    cleanup = pinned(c.cleanupRelative, c.cleanupSha256);
  if (
    actual.applicationSource !== c.sourceCommitSha ||
    actual.windowId !== c.windowId ||
    actual.prepareResult.managementAttempts !== 1 ||
    actual.prepareResult.controlAttempts !== 100 ||
    actual.prepareResult.nativeExecutions !== 0 ||
    actual.prepareResult.gatewayPreflightAttempts !== 0 ||
    actual.prepareResult.providerDirectAttempts !== 0 ||
    actual.prepareResult.actorStarts !== 0 ||
    actual.setup.writeIntents !== 0 ||
    actual.setup.sqlWindowProvisioned !== false ||
    actual.coordinatorClose.childTransportsClosed !== true ||
    actual.coordinatorClose.adminChildClosed !== true ||
    actual.wrapperClose.credentialChildrenClosed !== true ||
    actual.wrapperClose.nativeExit !== 1 ||
    cleanup.actualAttemptSha256 !== c.attemptSha256 ||
    cleanup.deleted !== true ||
    cleanup.absent !== true ||
    cleanup.credentialBearingChildrenAlreadyPhysicallyClosed !== true ||
    actual.postClosureProjectReconciliation.mcpProjectGetAttempts !== 1
  )
    fail();
  const alive =
    processAlive ??
    ((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (e) {
        return e?.code !== 'ESRCH';
      }
    });
  for (const pid of [actual.clock.parentProcessId, actual.clock.runtimeProcessId])
    if (!Number.isSafeInteger(pid) || pid <= 0 || alive(pid)) fail();
  if (!ownParent) absent(paths.parent);
  absent(join(paths.live, 'runtime.operation.lock'));
  absent(join(process.env.LOCALAPPDATA, 'Temp', 'emr-m03-acceptance-protection-bypass.dpapi'));
  absent(paths.ledger);
  const management = rows(join(paths.live, 'management.jsonl'));
  if (
    management.length !== 2 ||
    JSON.stringify(management[0]) !==
      JSON.stringify({
        event: 'management_header',
        version: 1,
        sourceCommitSha: c.sourceCommitSha,
        deadlineAt: c.originalDeadlineAt,
      }) ||
    JSON.stringify(management[1]) !== JSON.stringify({ event: 'management_attempt', ordinal: 1 })
  )
    fail();
  const setup = rows(join(paths.live, 'setup.jsonl'));
  if (setup.length !== 1 || JSON.stringify(setup[0]) !== JSON.stringify(actual.setup.row)) fail();
  const control = rows(join(paths.live, 'control.jsonl'));
  if (
    control.length !== 100 ||
    control.some(
      (r, i) => r.event !== 'control_request_intent' || r.kind !== 'discovery' || r.ordinal !== i + 1,
    )
  )
    fail();
  noLinks(paths.cli);
  if (!lstatSync(paths.cli).isFile()) fail();
  return paths;
}
function write(fd, value) {
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  for (let n = 0; n < bytes.length;) {
    const count = writeSync(fd, bytes, n, bytes.length - n);
    if (!Number.isSafeInteger(count) || count <= 0) fail();
    n += count;
  }
  fsyncSync(fd);
}
export function checkFoundationPostcloseProjectRead(dependencies = {}) {
  verify(dependencies);
  return Object.freeze({
    kind: 'postclose_project_read_ready',
    aggregateAttempts: 3,
    maximum: 512,
    requestMaximum: 1,
    requestTimeoutMs: 20000,
    privateRead: false,
    networkRequests: 0,
  });
}
// The only executable operation is a separately authorized one-use GET after
// the pinned physical closure. It is not an A-D session/clock/handoff consumer.
// Dependencies are explicit local-test ports; the CLI supplies none.
export async function runFoundationPostcloseProjectRead(dependencies = {}) {
  const paths = verify(dependencies),
    now = dependencies.now ?? Date.now;
  let lock,
    ledger,
    diagnostic,
    transport,
    physicallyClosed = false;
  try {
    lock = openSync(paths.parent, 'wx');
    write(lock, { kind: 'm03_postclose_project_read_parent', version: 1, processId: process.pid });
    verify({ ...dependencies, ownParent: true });
    ledger = openSync(paths.ledger, 'wx');
    write(ledger, {
      event: 'postclose_project_read_admission',
      sourceCommitSha: c.sourceCommitSha,
      priorBatchAttempts: 1,
      priorMcpAttempts: 1,
      thisAttempt: 1,
      aggregateAttempts: 3,
      maximum: 512,
      attemptSha256: c.attemptSha256,
      cleanupSha256: c.cleanupSha256,
      at: now(),
    });
    const deadlineAt = now() + 20000;
    transport = createFoundationLiveSetupCliTransport(
      {
        nodeExecutable: process.execPath,
        cliPath: paths.cli,
        noRetryPreloadPath: fileURLToPath(new URL('./foundation-live-setup-no-retry.mjs', import.meta.url)),
        workingDirectory: repo,
        now,
        deadlineAt,
        authorizeRequest: (spec) => diagnostic?.authorizeRequest(spec) === true,
      },
      dependencies.transportDependencies,
    );
    let admitted = false;
    diagnostic = createFoundationSetupProjectDiagnostic({
      transport,
      now,
      deadlineAt,
      admitAttempt() {
        if (admitted) fail();
        admitted = true;
      },
      durableAppend(row) {
        write(ledger, row);
      },
    });
    const receipt = await diagnostic.run();
    physicallyClosed =
      diagnostic.close() === true &&
      transport.state().pendingRequests === 0 &&
      receipt.transport.childClosed === true;
    const result = Object.freeze({
      kind: 'postclose_project_read_result',
      aggregateAttempts: 3,
      maximum: 512,
      status: receipt.status,
      transport: receipt.transport,
      predicates: receipt.predicates,
      childTransportsClosed: physicallyClosed,
      newAcceptanceWindow: false,
      mutations: 0,
    });
    write(ledger, result);
    return result;
  } finally {
    diagnostic?.close();
    transport?.close();
    if (ledger !== undefined) closeSync(ledger);
    if (lock !== undefined) {
      if (physicallyClosed || ledger === undefined) {
        noLinks(paths.parent);
        const leaf = lstatSync(paths.parent),
          own = fstatSync(lock);
        if (!leaf.isFile() || leaf.dev !== own.dev || leaf.ino !== own.ino) fail();
        closeSync(lock);
        lock = undefined;
        unlinkSync(paths.parent);
      } else closeSync(lock); // Unknown physical closure leaves the visible lock.
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || !['CheckOnly', 'Run'].includes(process.argv[2])) fail();
    const receipt =
      process.argv[2] === 'CheckOnly'
        ? checkFoundationPostcloseProjectRead()
        : await runFoundationPostcloseProjectRead();
    process.stdout.write(JSON.stringify(receipt) + '\n');
    if (
      process.argv[2] === 'Run' &&
      (receipt.status !== 'project_contract_ready' || !receipt.childTransportsClosed)
    )
      process.exitCode = 1;
  } catch {
    process.stdout.write(
      '{"kind":"postclose_project_read_blocked","code":"FOUNDATION_POSTCLOSE_PROJECT_READ_BLOCKED"}\n',
    );
    process.exitCode = 1;
  }
}
