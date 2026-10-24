import { readFileSync, lstatSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { foundationZeroSetupCheckpoint as original } from './foundation-live-zero-setup.mjs';
import {
  createFoundationControlJournal,
  createFoundationControlBudget,
} from './foundation-control-state.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const proofs = new WeakMap();
export const foundationPostcheckContinuationCheckpoint = Object.freeze({
  segmentId: 'a570212a-634c-444f-90a2-578ae47e8d27',
  sourceCommitSha: original.sourceCommitSha,
  windowId: original.windowId,
  originalDeadlineAt: original.deadlineAt,
  approvalRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-approval-20261021.json',
  approvalSha256: 'ab24cf3488a0990988550ec361a7bbe4f147d0bce5a62a5aa5d2eb9cdf17e19a',
  packetRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-continuation-20261021.md',
  packetSha256: 'ceb239bef756ee9a169ddde0e8e94eb1a4d35dcff2f282c2ead95950b7250447',
  checkpointRelative:
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-checkpoint-20261021.json',
  checkpointSha256: '99d8cc0befc307fae2ccb23042d8ebcdc2319f4bfe01838c91cfa1b42a5f0d77',
  priorAttemptRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-amended-attempt-20261021.json',
  priorAttemptSha256: '4a5e85d57ba8d64ba20c7337c66e70d01af59ac118915710c567faec4ec9c778',
  admissionRelative:
    'scripts/n8n/out/foundation/live/postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27.json',
  claimRelative:
    'scripts/n8n/out/foundation/live/postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27.runtime-claim.json',
  parentLockFilename: 'emr-m03-acceptance-parent.operation.lock',
});
const c = foundationPostcheckContinuationCheckpoint;
const fail = () => {
  throw Error('M03_POSTCHECK_CONTINUATION_BLOCKED');
};
const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const positive = (v) => Number.isSafeInteger(v) && v > 0;
const ioKeys = new Set([
  'readFileSync',
  'lstatSync',
  'openSync',
  'writeSync',
  'fsyncSync',
  'closeSync',
  'processId',
  'parentProcessId',
  'processAlive',
]);
function context(options = {}, dependencies = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some((k) => k !== 'now') ||
    !dependencies ||
    typeof dependencies !== 'object' ||
    Array.isArray(dependencies)
  )
    fail();
  const now = options.now ?? Date.now;
  if (typeof now !== 'function' || Object.keys(dependencies).some((k) => !ioKeys.has(k))) fail();
  const processAlive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error?.code !== 'ESRCH';
    }
  };
  const io = {
    readFileSync,
    lstatSync,
    openSync,
    writeSync,
    fsyncSync,
    closeSync,
    processAlive,
    ...dependencies,
  };
  if (
    ['readFileSync', 'lstatSync', 'openSync', 'writeSync', 'fsyncSync', 'closeSync', 'processAlive'].some(
      (k) => typeof io[k] !== 'function',
    )
  )
    fail();
  const pid = dependencies.processId ?? process.pid,
    ppid = dependencies.parentProcessId ?? process.ppid;
  if (!positive(pid) || !positive(ppid)) fail();
  const clock = () => {
    const t = now();
    if (!Number.isSafeInteger(t) || t < 0) fail();
    return t;
  };
  const physical = (path, optional = false) => {
    let leaf;
    for (let p = resolve(path); ; p = dirname(p)) {
      try {
        const s = io.lstatSync(p);
        if (s.isSymbolicLink()) fail();
        if (p === resolve(path)) leaf = s;
      } catch (e) {
        if (e?.code !== 'ENOENT') fail();
        if (p === resolve(path) && !optional) fail();
      }
      if (dirname(p) === p) break;
    }
    return leaf;
  };
  const file = (relative, { optional = false, max = 2097152, absolute = false } = {}) => {
    const path = absolute ? relative : join(repo, relative),
      s = physical(path, optional);
    if (!s) return null;
    if (
      !s.isFile() ||
      !Number.isSafeInteger(s.size) ||
      s.size > max ||
      (s.nlink !== undefined && s.nlink !== 1)
    )
      fail();
    const value = io.readFileSync(path, 'utf8');
    if (typeof value !== 'string' || Buffer.byteLength(value) !== s.size) fail();
    return value;
  };
  const parent = (expected, requireOwnParent = false) => {
    if (typeof process.env.LOCALAPPDATA !== 'string' || !process.env.LOCALAPPDATA) fail();
    const text = file(join(process.env.LOCALAPPDATA, 'Temp', c.parentLockFilename), {
      absolute: true,
      max: 4096,
    });
    const p = JSON.parse(text);
    if (
      !exact(p, ['kind', 'version', 'segmentId', 'processId']) ||
      p.kind !== 'm03_clock_admission_parent' ||
      p.version !== 1 ||
      p.segmentId !== c.segmentId ||
      !positive(p.processId) ||
      (expected !== undefined && p.processId !== expected) ||
      (requireOwnParent && p.processId !== ppid)
    )
      fail();
    return { text, pid: p.processId };
  };
  const create = (relative, row) => {
    const path = join(repo, relative);
    if (physical(path, true)) fail();
    const text = JSON.stringify(row) + '\n',
      bytes = Buffer.from(text);
    let fd;
    try {
      fd = io.openSync(path, 'wx', 0o600);
      for (let at = 0; at < bytes.length;) {
        const n = io.writeSync(fd, bytes, at, bytes.length - at);
        if (!Number.isSafeInteger(n) || n <= 0) fail();
        at += n;
      }
      io.fsyncSync(fd);
    } finally {
      if (fd !== undefined) io.closeSync(fd);
    }
    if (file(relative) !== text) fail();
    return text;
  };
  return { io, clock, physical, file, parent, create, pid, ppid };
}
function approval(x) {
  const text = x.file(c.approvalRelative);
  if (hash(text) !== c.approvalSha256) fail();
  const a = JSON.parse(text);
  if (
    a.kind !== 'm03_postcheck_continuation_approval' ||
    a.version !== 1 ||
    a.segmentId !== c.segmentId ||
    a.applicationSource !== c.sourceCommitSha ||
    a.originalWindowId !== c.windowId ||
    a.reviewedHead !== 'd834968cd99d6360d1dd3bd0cad237f186424fb3' ||
    a.singleSegmentNoAutomaticRenewal !== true ||
    a.preserveBothAttemptsHeaderAndAggregateCounters !== true ||
    a.noMigrationReplay !== true ||
    a.ownerReply !== 'I approve' ||
    a.reviewedPacketRelative !== c.packetRelative ||
    a.reviewedPacketSha256 !== c.packetSha256 ||
    a.checkpointRelative !== c.checkpointRelative ||
    a.checkpointSha256 !== c.checkpointSha256 ||
    a.priorAttemptRelative !== c.priorAttemptRelative ||
    a.priorAttemptSha256 !== c.priorAttemptSha256 ||
    hash(x.file(c.packetRelative)) !== c.packetSha256 ||
    hash(x.file(c.checkpointRelative)) !== c.checkpointSha256 ||
    hash(x.file(c.priorAttemptRelative)) !== c.priorAttemptSha256
  )
    fail();
  const caps = {
    durationMinutes: 60,
    stopNewWorkMinute: 50,
    physicalCloseMinute: 70,
    leaseCoverageMinute: 75,
    runtimeManagement: 512,
    control: 2048,
    combined: 2560,
    nativeExecutions: 120,
    gatewayAttempts: 256,
    providerGetAttempts: 32,
    actorStarts: 2,
    requestedUsdEachActor: 1,
    actorReserveUsd: 2,
    uniquePublishedDependencies: 7,
    publicationActions: 8,
  };
  if (!exact(a.caps, Object.keys(caps)) || Object.keys(caps).some((k) => a.caps[k] !== caps[k])) fail();
  const at = Date.parse(a.recordedAtUtc);
  if (!Number.isFinite(at) || x.clock() < at) fail();
  x.approvedAt = at;
  x.checkpoint = JSON.parse(x.file(c.checkpointRelative));
  return a;
}
function management(x, zero = false) {
  const text = x.file(original.managementRelative, { max: 2097152 });
  if (!text.endsWith('\n')) fail();
  const lines = text.slice(0, -1).split('\n');
  if (lines.length < 1 || lines.length > 513) fail();
  const header = JSON.parse(lines.shift());
  if (
    !exact(header, ['event', 'version', 'sourceCommitSha', 'deadlineAt']) ||
    header.event !== 'management_header' ||
    header.version !== 1 ||
    header.sourceCommitSha !== c.sourceCommitSha ||
    header.deadlineAt !== original.deadlineAt
  )
    fail();
  const rows = lines.map((s) => JSON.parse(s));
  if (
    (zero && rows.length) ||
    rows.some(
      (r, i) => !exact(r, ['event', 'ordinal']) || r.event !== 'management_attempt' || r.ordinal !== i + 1,
    )
  )
    fail();
  return text;
}
// This checkpoint includes successful migration effects. It is never treated as
// the earlier zero-setup failure, and its counters cannot be refilled.
function closedCheckpoint(x, initial = false, beforePrivate = false) {
  const p = x.checkpoint;
  if (
    p.kind !== 'm03_postcheck_closed_checkpoint' ||
    p.version !== 1 ||
    p.applicationSource !== c.sourceCommitSha ||
    p.windowId !== c.windowId ||
    p.managementAttempts !== 0 ||
    p.controlAttempts !== 50 ||
    p.nativeExecutions !== 0 ||
    p.gatewayAttempts !== 0 ||
    p.providerGetAttempts !== 0 ||
    p.actorStarts !== 0 ||
    p.migrationCount !== 14 ||
    p.historyAfter !== 'complete' ||
    p.fixtureRows !== 0 ||
    p.foundationWindowRows !== 0 ||
    !p.priorChildrenPhysicallyClosed ||
    !p.consumedTemporaryInputsAndScratchDeleted ||
    !p.unusedBypassDeleted ||
    p.priorWrapperNativeExit !== 1 ||
    p.priorFullDProven !== false ||
    p.priorBusinessAcceptanceProven !== false
  )
    fail();
  const currentManagement = management(x, initial);
  const controlRelative = 'scripts/n8n/out/foundation/live/control.jsonl';
  for (const [relative, v] of Object.entries(p.retainedFiles)) {
    const text = x.file(relative);
    if (relative === original.managementRelative || relative === controlRelative) {
      if (
        typeof v.text !== 'string' ||
        hash(v.text) !== v.sha256 ||
        Buffer.byteLength(v.text) !== v.bytes ||
        !text.startsWith(v.text) ||
        (initial && text !== v.text)
      )
        fail();
    } else if (hash(text) !== v.sha256 || Buffer.byteLength(text) !== v.bytes) fail();
  }
  const control = x.file(controlRelative);
  if (!control.endsWith('\n')) fail();
  const rows = control
    .slice(0, -1)
    .split('\n')
    .map((s) => JSON.parse(s));
  const journal = createFoundationControlJournal({
    previousEvents: rows,
    durableAppend() {
      fail();
    },
  });
  const budget = createFoundationControlBudget({ journal, now: x.clock, deadlineAt: x.clock() + 3600000 });
  if (
    (initial && (rows.length !== 50 || budget.snapshot().attempts !== 50)) ||
    budget.snapshot().attempts < 50
  )
    fail();
  for (const name of ['preflight', 'setup', 'runtime']) {
    const text = x.file('scripts/n8n/out/foundation/live/' + name + '.jsonl', { optional: true });
    if (initial && text !== null && text !== '') fail();
  }
  if (initial) {
    for (const relative of [
      'scripts/n8n/out/foundation/live/runtime.operation.lock',
      'scripts/db/out/m03-foundation-owner-provision-attempt.json',
      'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-attempt.json',
      'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-latest.json',
      'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json',
      'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-unprovisioned-archive-attempt.json',
    ])
      if (x.physical(join(repo, relative), true)) fail();
    for (const pid of [p.priorNodeProcessId, p.priorParentProcessId]) {
      if (!positive(pid) || x.io.processAlive(pid) !== false) fail();
    }
    if (beforePrivate) {
      if (
        typeof process.env.LOCALAPPDATA !== 'string' ||
        !process.env.LOCALAPPDATA ||
        x.physical(join(process.env.LOCALAPPDATA, 'Temp', 'emr-m03-acceptance-protection-bypass.dpapi'), true)
      )
        fail();
    }
  }
  if (management(x, initial) !== currentManagement) fail();
  return currentManagement;
}
function record(x) {
  const text = x.file(c.admissionRelative),
    r = JSON.parse(text);
  if (
    !exact(r, [
      'kind',
      'version',
      'segmentId',
      'sourceCommitSha',
      'windowId',
      'approvalSha256',
      'startsAt',
      'deadlineAt',
      'stopNewAt',
      'hardDeadlineAt',
      'parentProcessId',
    ]) ||
    r.kind !== 'm03_postcheck_continuation_admission' ||
    r.version !== 1 ||
    r.segmentId !== c.segmentId ||
    r.sourceCommitSha !== c.sourceCommitSha ||
    r.windowId !== c.windowId ||
    r.approvalSha256 !== c.approvalSha256 ||
    !Number.isSafeInteger(r.startsAt) ||
    !Number.isSafeInteger(x.approvedAt) ||
    r.startsAt < x.approvedAt ||
    r.deadlineAt !== r.startsAt + 3600000 ||
    r.stopNewAt !== r.startsAt + 3000000 ||
    r.hardDeadlineAt !== r.startsAt + 4200000 ||
    !positive(r.parentProcessId) ||
    text !== JSON.stringify(r) + '\n' ||
    x.clock() < r.startsAt ||
    x.clock() >= r.stopNewAt
  )
    fail();
  x.parent(r.parentProcessId);
  closedCheckpoint(x);
  const control = x.file('scripts/n8n/out/foundation/live/control.jsonl', { optional: true, max: 2097152 });
  if (control !== null && control !== '') {
    if (!control.endsWith('\n')) fail();
    const rows = control
      .slice(0, -1)
      .split('\n')
      .map((s) => JSON.parse(s));
    const journal = createFoundationControlJournal({
      previousEvents: rows,
      durableAppend() {
        fail();
      },
    });
    createFoundationControlBudget({ journal, now: x.clock, deadlineAt: r.deadlineAt });
  }
  const claimText = x.file(c.claimRelative, { optional: true }),
    claim = claimText === null ? null : JSON.parse(claimText);
  if (
    claim !== null &&
    (!exact(claim, ['kind', 'version', 'segmentId', 'admissionSha256', 'processId', 'parentProcessId']) ||
      claim.kind !== 'm03_postcheck_continuation_runtime_claim' ||
      claim.version !== 1 ||
      claim.segmentId !== c.segmentId ||
      claim.admissionSha256 !== hash(text) ||
      !positive(claim.processId) ||
      claim.parentProcessId !== r.parentProcessId ||
      claimText !== JSON.stringify(claim) + '\n')
  )
    fail();
  return { r, text, claim };
}
function proof(data, claimed = false) {
  const r = data.r,
    p = Object.freeze({
      kind: 'foundation_postcheck_continuation',
      segmentId: c.segmentId,
      sourceCommitSha: c.sourceCommitSha,
      windowId: c.windowId,
      startsAt: r.startsAt,
      deadlineAt: r.deadlineAt,
      stopNewAt: r.stopNewAt,
      hardDeadlineAt: r.hardDeadlineAt,
    });
  proofs.set(p, { admissionSha256: hash(data.text), claimed, processId: data.claim?.processId });
  return p;
}
export function assertFoundationLivePostcheckContinuationProof(p, { claimed = false } = {}) {
  const meta = proofs.get(p);
  if (!meta || !Object.isFrozen(p) || (claimed && (meta.claimed !== true || meta.processId !== process.pid)))
    fail();
  return p;
}
export function verifyFoundationPostcheckContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    approval(x);
    closedCheckpoint(x, true, true);
    if (x.physical(join(repo, c.admissionRelative), true) || x.physical(join(repo, c.claimRelative), true))
      fail();
    return Object.freeze({
      kind: 'postcheck_continuation_ready',
      segmentId: c.segmentId,
      sourceCommitSha: c.sourceCommitSha,
      windowId: c.windowId,
      privateRead: false,
      networkRequests: 0,
    });
  } catch {
    fail();
  }
}
export function admitFoundationPostcheckContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    approval(x);
    const header = closedCheckpoint(x, true, true);
    if (x.physical(join(repo, c.admissionRelative), true) || x.physical(join(repo, c.claimRelative), true))
      fail();
    const parent = x.parent(undefined, true),
      startsAt = x.clock();
    const r = {
      kind: 'm03_postcheck_continuation_admission',
      version: 1,
      segmentId: c.segmentId,
      sourceCommitSha: c.sourceCommitSha,
      windowId: c.windowId,
      approvalSha256: c.approvalSha256,
      startsAt,
      deadlineAt: startsAt + 3600000,
      stopNewAt: startsAt + 3000000,
      hardDeadlineAt: startsAt + 4200000,
      parentProcessId: parent.pid,
    };
    x.create(c.admissionRelative, r);
    if (x.parent(parent.pid, true).text !== parent.text || management(x, true) !== header) fail();
    return proof(record(x));
  } catch {
    fail();
  }
}
export function readFoundationPostcheckContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    approval(x);
    return proof(record(x));
  } catch {
    fail();
  }
}
export function readClaimedFoundationPostcheckContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    approval(x);
    const data = record(x);
    if (!data.claim) fail();
    return proof(data);
  } catch {
    fail();
  }
}
export function claimFoundationPostcheckContinuation(p, options = {}, dependencies = {}) {
  try {
    assertFoundationLivePostcheckContinuationProof(p);
    const x = context(options, dependencies);
    approval(x);
    const data = record(x),
      meta = proofs.get(p);
    if (meta.claimed || meta.admissionSha256 !== hash(data.text) || data.claim) fail();
    closedCheckpoint(x, true, false);
    x.parent(data.r.parentProcessId, true);
    x.create(c.claimRelative, {
      kind: 'm03_postcheck_continuation_runtime_claim',
      version: 1,
      segmentId: c.segmentId,
      admissionSha256: hash(data.text),
      processId: x.pid,
      parentProcessId: x.ppid,
    });
    const actual = record(x);
    if (actual.claim?.processId !== x.pid) fail();
    return proof(actual, true);
  } catch {
    fail();
  }
}
const publicProof = (p) => ({
  kind: 'clock_postcheck_continuation_admitted',
  segmentId: p.segmentId,
  sourceCommitSha: p.sourceCommitSha,
  windowId: p.windowId,
  startsAt: p.startsAt,
  deadlineAt: p.deadlineAt,
  stopNewAt: p.stopNewAt,
  hardDeadlineAt: p.hardDeadlineAt,
  privateRead: false,
  networkRequests: 0,
});
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) fail();
    let out;
    if (process.argv[2] === 'CheckOnly') out = verifyFoundationPostcheckContinuation();
    else if (process.argv[2] === 'Admit') out = publicProof(admitFoundationPostcheckContinuation());
    else if (process.argv[2] === 'Read') out = publicProof(readFoundationPostcheckContinuation());
    else if (process.argv[2] === 'ReadClaimed')
      out = publicProof(readClaimedFoundationPostcheckContinuation());
    else fail();
    process.stdout.write(JSON.stringify(out) + '\n');
  } catch {
    process.stdout.write(
      '{"kind":"postcheck_continuation_blocked","privateRead":false,"networkRequests":0}\n',
    );
    process.exitCode = 1;
  }
}
