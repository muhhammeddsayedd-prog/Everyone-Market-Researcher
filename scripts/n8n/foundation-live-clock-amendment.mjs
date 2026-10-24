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
export const foundationClockAmendmentCheckpoint = Object.freeze({
  segmentId: '30e75d0d-7e4c-46c6-9a07-556f90b63859',
  sourceCommitSha: original.sourceCommitSha,
  windowId: original.windowId,
  originalDeadlineAt: original.deadlineAt,
  approvalRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-approval-20261021.json',
  approvalSha256: '3d2346715e08edfc9eef4fab04c9c1b7be55d450660c862235b92195976bed31',
  packetRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-amendment-20261021.md',
  packetSha256: 'f0fc4877034acfb5ed66e0c332d6260bbef8c169868a79d8aa550c5c47964fdb',
  lateRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-late-delivery-20261021.json',
  lateSha256: '0304b30f23ed3aed30f72bcf590a79bfe1f37df073f69c2f7eacb8192cf134fc',
  admissionRelative:
    'scripts/n8n/out/foundation/live/clock-amendment-30e75d0d-7e4c-46c6-9a07-556f90b63859.json',
  claimRelative:
    'scripts/n8n/out/foundation/live/clock-amendment-30e75d0d-7e4c-46c6-9a07-556f90b63859.runtime-claim.json',
  parentLockFilename: 'emr-m03-acceptance-parent.operation.lock',
});
const c = foundationClockAmendmentCheckpoint;
const fail = () => {
  throw Error('M03_CLOCK_AMENDMENT_BLOCKED');
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
]);
function context({ now = Date.now } = {}, dependencies = {}) {
  if (typeof now !== 'function' || Object.keys(dependencies).some((k) => !ioKeys.has(k))) fail();
  const io = { readFileSync, lstatSync, openSync, writeSync, fsyncSync, closeSync, ...dependencies };
  if (
    ['readFileSync', 'lstatSync', 'openSync', 'writeSync', 'fsyncSync', 'closeSync'].some(
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
  const file = (relative, { optional = false, max = 131072, absolute = false } = {}) => {
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
    a.kind !== 'm03_single_clock_amendment_approval' ||
    a.version !== 1 ||
    a.segmentId !== c.segmentId ||
    a.applicationSource !== c.sourceCommitSha ||
    a.originalWindowId !== c.windowId ||
    a.originalDeadlineAtMs !== original.deadlineAt ||
    a.originalPacketSha256 !== '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712' ||
    a.singleSegmentNoAutomaticRenewal !== true ||
    a.preserveOriginalHeaderAndAggregateCounters !== true ||
    a.reviewedPacketRelative !== c.packetRelative ||
    a.reviewedPacketSha256 !== c.packetSha256 ||
    a.lateDeliveryRelative !== c.lateRelative ||
    a.lateDeliverySha256 !== c.lateSha256 ||
    hash(x.file(c.packetRelative)) !== c.packetSha256 ||
    hash(x.file(c.lateRelative)) !== c.lateSha256
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
function zeroEffects(x) {
  const text = x.file(original.closureRelative);
  if (hash(text) !== original.closureSha256) fail();
  const expected = {
    kind: 'm03_zero_setup_physical_closure',
    version: 1,
    sourceCommitSha: c.sourceCommitSha,
    windowId: c.windowId,
    deadlineAt: original.deadlineAt,
    wrapperNativeExit: 1,
    nodeClosed: true,
    wrapperClosed: true,
    credentialChildrenClosed: true,
    consumedRuntimeHandoffsDeleted: true,
    administratorStarted: false,
    managementAttempts: 0,
    controlAttempts: 0,
    nativeExecutions: 0,
    gatewayPreflightAttempts: 0,
    providerDirectAttempts: 0,
  };
  const closed = JSON.parse(text);
  if (!exact(closed, Object.keys(expected)) || Object.keys(expected).some((k) => closed[k] !== expected[k]))
    fail();
  const before = management(x, true);
  for (const p of original.emptyRelatives) {
    const text = x.file(p, { optional: true, max: 2097152 });
    if (text !== null && text !== '') fail();
  }
  for (const p of original.absentRelatives) if (x.physical(join(repo, p), true)) fail();
  if (management(x, true) !== before) fail();
  return before;
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
    r.kind !== 'm03_clock_amendment_admission' ||
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
  management(x);
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
      claim.kind !== 'm03_clock_amendment_runtime_claim' ||
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
      kind: 'foundation_clock_amendment',
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
export function assertFoundationLiveClockAmendmentProof(p, { claimed = false } = {}) {
  const meta = proofs.get(p);
  if (!meta || !Object.isFrozen(p) || (claimed && (meta.claimed !== true || meta.processId !== process.pid)))
    fail();
  return p;
}
export function verifyFoundationClockAmendment(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    approval(x);
    zeroEffects(x);
    if (x.physical(join(repo, c.admissionRelative), true) || x.physical(join(repo, c.claimRelative), true))
      fail();
    return Object.freeze({
      kind: 'clock_amendment_ready',
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
export function admitFoundationClockAmendment(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    approval(x);
    const header = zeroEffects(x);
    if (x.physical(join(repo, c.admissionRelative), true) || x.physical(join(repo, c.claimRelative), true))
      fail();
    const parent = x.parent(undefined, true),
      startsAt = x.clock();
    const r = {
      kind: 'm03_clock_amendment_admission',
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
export function readFoundationClockAmendment(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    approval(x);
    return proof(record(x));
  } catch {
    fail();
  }
}
export function readClaimedFoundationClockAmendment(options = {}, dependencies = {}) {
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
export function claimFoundationClockAmendment(p, options = {}, dependencies = {}) {
  try {
    assertFoundationLiveClockAmendmentProof(p);
    const x = context(options, dependencies);
    approval(x);
    const data = record(x),
      meta = proofs.get(p);
    if (meta.claimed || meta.admissionSha256 !== hash(data.text) || data.claim) fail();
    zeroEffects(x);
    x.parent(data.r.parentProcessId, true);
    x.create(c.claimRelative, {
      kind: 'm03_clock_amendment_runtime_claim',
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
  kind: 'clock_amendment_admitted',
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
    if (process.argv[2] === 'CheckOnly') out = verifyFoundationClockAmendment();
    else if (process.argv[2] === 'Admit') out = publicProof(admitFoundationClockAmendment());
    else if (process.argv[2] === 'Read') out = publicProof(readFoundationClockAmendment());
    else if (process.argv[2] === 'ReadClaimed') out = publicProof(readClaimedFoundationClockAmendment());
    else fail();
    process.stdout.write(JSON.stringify(out) + '\n');
  } catch {
    process.stdout.write('{"kind":"clock_amendment_blocked","privateRead":false,"networkRequests":0}\n');
    process.exitCode = 1;
  }
}
