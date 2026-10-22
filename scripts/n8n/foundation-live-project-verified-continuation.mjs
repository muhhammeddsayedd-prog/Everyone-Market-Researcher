import { readFileSync, lstatSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const proofs = new WeakMap();
export const foundationProjectVerifiedContinuationCheckpoint = Object.freeze({
  segmentId: '20275b22-b7fe-4737-a9a4-c50c2feadb74',
  sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  originalDeadlineAt: 1792584023481,
  approvalRelative:
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-approval-20261022.json',
  approvalSha256: '5eb38cbe8740ed9a9f72d2356de3fa2e9ce77c8de3710020a7d3de7a6ebdd610',
  packetRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-packet-20261022.md',
  packetSha256: '13d19460cdb889378dec5ae4d93af4708baf85290c164e07961add18e7243650',
  checkpointRelative:
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-checkpoint-20261022.json',
  checkpointSha256: 'e21e515ae446dcde7983dba87d09221ce1bf3cd2ad06d08329368a8241e6ba10',
  admissionRelative:
    'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.json',
  claimRelative:
    'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.runtime-claim.json',
  parentLockFilename: 'emr-m03-acceptance-parent.operation.lock',
  carriedManagementAttempts: 4,
  carriedControlAttempts: 1,
});
const c = foundationProjectVerifiedContinuationCheckpoint;
const fail = () => {
  throw Error('M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED');
};
const exact = (v, keys) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const positive = (v) => Number.isSafeInteger(v) && v > 0;
const caps = Object.freeze({
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
});
const ioNames = [
  'readFileSync',
  'lstatSync',
  'openSync',
  'writeSync',
  'fsyncSync',
  'closeSync',
  'processAlive',
  'processId',
  'parentProcessId',
];
function context(options = {}, dependencies = {}) {
  if (
    !exact(options, Object.keys(options)) ||
    Object.keys(options).some((k) => k !== 'now') ||
    !exact(dependencies, Object.keys(dependencies)) ||
    Object.keys(dependencies).some((k) => !ioNames.includes(k))
  )
    fail();
  const now = options.now ?? Date.now;
  const processAlive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return e?.code !== 'ESRCH';
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
  if (typeof now !== 'function' || ioNames.slice(0, 7).some((k) => typeof io[k] !== 'function')) fail();
  const pid = io.processId ?? process.pid,
    ppid = io.parentProcessId ?? process.ppid;
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
        if (
          s.isSymbolicLink() ||
          (p !== resolve(path) && typeof s.isDirectory === 'function' && !s.isDirectory())
        )
          fail();
        if (p === resolve(path)) leaf = s;
      } catch (e) {
        if (e?.code !== 'ENOENT' || (p === resolve(path) && !optional)) fail();
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
    const text = io.readFileSync(path, 'utf8');
    if (typeof text !== 'string' || Buffer.byteLength(text) !== s.size || text.includes('\uFFFD')) fail();
    return text;
  };
  const parent = (expected, own = false) => {
    if (typeof process.env.LOCALAPPDATA !== 'string' || !process.env.LOCALAPPDATA) fail();
    const text = file(join(process.env.LOCALAPPDATA, 'Temp', c.parentLockFilename), {
        absolute: true,
        max: 4096,
      }),
      p = JSON.parse(text);
    if (
      !exact(p, ['kind', 'version', 'segmentId', 'processId']) ||
      p.kind !== 'm03_clock_admission_parent' ||
      p.version !== 1 ||
      p.segmentId !== c.segmentId ||
      !positive(p.processId) ||
      (expected !== undefined && p.processId !== expected) ||
      (own && p.processId !== ppid)
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
        if (!Number.isSafeInteger(n) || n <= 0 || n > bytes.length - at) fail();
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
function checkpoint(x) {
  if (typeof c.checkpointSha256 !== 'string' || hash(x.file(c.checkpointRelative)) !== c.checkpointSha256)
    fail();
  const p = JSON.parse(x.file(c.checkpointRelative));
  if (
    p.kind !== 'm03_project_verified_continuation_checkpoint' ||
    p.version !== 1 ||
    p.proposedSegmentId !== c.segmentId ||
    p.applicationSource !== c.sourceCommitSha ||
    p.windowId !== c.windowId ||
    p.originalDeadlineAt !== c.originalDeadlineAt ||
    p.accounting.mainManagement !== 2 ||
    p.accounting.separateManagement !== 4 ||
    p.accounting.aggregateManagement !== 6 ||
    p.accounting.managementMaximum !== 512 ||
    p.accounting.mainControl !== 200 ||
    p.accounting.separateControl !== 1 ||
    p.accounting.aggregateControl !== 201 ||
    p.accounting.controlMaximum !== 2048 ||
    p.accounting.aggregateCombined !== 207 ||
    p.accounting.combinedMaximum !== 2560 ||
    p.actualEffects.unknownOrphanClosureProven !== false ||
    p.actualEffects.finalWrapperReceiptPreserved !== true ||
    p.actualEffects.currentCredentialChildrenClosed !== true ||
    p.actualEffects.runtimeCredentialRootsAbsent !== true ||
    p.actualEffects.consumedRuntimeHandoffsDeleted !== true ||
    p.actualEffects.adminPairPreserved !== false ||
    p.actualEffects.unusedBypassDeleted !== true ||
    p.actualEffects.sqlFoundationWindowProvisioned !== false ||
    p.actualEffects.vercelResourceWrites !== 0 ||
    p.actualEffects.workflowTransitions !== 0 ||
    p.actualEffects.nativeExecutions !== 0 ||
    p.actualEffects.actors !== 0 ||
    p.actualEffects.gatewayAttempts !== 0 ||
    p.actualEffects.providerGets !== 0 ||
    p.actualEffects.fullD !== false ||
    Object.keys(p.preserved).length !== 39
  )
    fail();
  for (const [path, expected] of Object.entries(p.preserved)) {
    if (
      (!/^(?:milestones\/M03-n8n-foundation\/evidence\/|scripts\/(?:n8n|db)\/out\/)/.test(path) &&
        path !== 'scripts/n8n/windows/Remove-M03StartupUnusedBypass.ps1') ||
      path.includes('..') ||
      !/^\w{64}$/.test(expected) ||
      hash(x.file(path)) !== expected
    )
      fail();
  }
  x.checkpoint = p;
  if (
    p.priorAttempt.segmentId !== '1c69c89e-7807-46d5-b7b8-ca28285ff2b4' ||
    p.priorAttempt.parentProcessId !== 44408 ||
    p.priorAttempt.runtimeProcessId !== 60040 ||
    p.priorAttempt.prepareControlGets !== 50 ||
    p.priorAttempt.adminStartupReady !== true ||
    p.priorAttempt.authenticationReceipt !== true ||
    p.priorAttempt.finalWrapperReceiptPreserved !== true ||
    p.priorAttempt.spentAdmissionCannotReopen !== true ||
    p.sourceRepair.head !== 'f4775b2fd1c88e0110555fa006027a3d39cdcd89' ||
    p.sourceRepair.ci !== 39818174853 ||
    p.sourceRepair.ciAllFiveJobsPassed !== true ||
    p.sourceRepair.vercelSuccess !== true ||
    p.fixture.competitorId !== 'd51a39f6-fe87-4d17-aee9-3070c45693aa' ||
    p.fixture.accountId !== 'bd23314c-591f-4fb7-92fd-b7450634eeb6' ||
    p.fixture.competitorStatus !== 'archived' ||
    p.fixture.accountStatus !== 'paused' ||
    p.fixture.knownPriorReactivationSegmentId !== '1c69c89e-7807-46d5-b7b8-ca28285ff2b4' ||
    p.fixture.knownPriorReactivationArchived !== true ||
    p.database.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    p.database.migrationVersions !== 14 ||
    p.database.noMigrationOperationPending !== true ||
    p.database.completedPostcheckEvidencePreserved !== true ||
    p.database.criticalCatalogHistoryVacancyAndFixtureMustBeFreshlyVerified !== true
  )
    fail();
  priorCleanup(x);
  priorCurrentStartup(x, p);
  positiveProjectRead(x, p);
  return p;
}
function priorCurrentStartup(x, p) {
  const path =
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-attempt-20261022.json';
  if (typeof p.preserved[path] !== 'string') fail();
  const a = JSON.parse(x.file(path));
  if (
    a.kind !== 'm03_startup_replacement_actual_attempt' ||
    a.segmentId !== '1c69c89e-7807-46d5-b7b8-ca28285ff2b4' ||
    a.applicationSource !== c.sourceCommitSha ||
    a.windowId !== c.windowId ||
    a.clock.oneUseConsumed !== true ||
    a.clock.automaticRenewalOrSecondChildAuthorized !== false ||
    a.database.authenticationVerified !== true ||
    a.database.migrationCount !== 14 ||
    a.database.migrationsAppliedThisAttempt !== 0 ||
    a.database.ownerProvisionIntentPresent !== false ||
    a.database.sqlWindowProvisioned !== false ||
    a.database.unprovisionedFixtureArchived !== true ||
    a.database.reactivationState !== 'acknowledged_and_verified' ||
    a.setup.allRowsGetOnly !== true ||
    a.setup.writeIntents !== 0 ||
    a.coordinatorClose.status !== 'closed' ||
    a.coordinatorClose.childTransportsClosed !== true ||
    a.coordinatorClose.adminChildClosed !== true ||
    a.coordinatorClose.fixtureArchived !== true ||
    a.coordinatorClose.environmentCleanupVerified !== true ||
    a.coordinatorClose.windowClosed !== false ||
    a.coordinatorClose.baselineRestored !== false ||
    a.coordinatorClose.remoteWorkSettled !== false ||
    a.coordinatorClose.residual !== true ||
    a.wrapperClose.childClosed !== true ||
    a.wrapperClose.credentialChildrenClosed !== true ||
    a.wrapperClose.handoffsDeleted !== true ||
    a.wrapperClose.emergencyShutdown !== false ||
    a.wrapperClose.pendingMachinePreserved !== true ||
    JSON.stringify(a.outerClose.wrapperReceipt) !== JSON.stringify(a.wrapperClose) ||
    a.outerClose.nativeExit !== 1 ||
    a.outerClose.stdoutEnded !== true ||
    a.outerClose.protocolBlocked !== false ||
    a.unusedBypassCleanup.deleted !== true ||
    a.unusedBypassCleanup.nativeExit !== 0 ||
    a.unusedBypassCleanup.privateContentsRead !== false ||
    a.unusedBypassCleanup.networkRequests !== 0 ||
    a.postClosurePresence.allEightInputFilesAbsent !== true ||
    a.postClosurePresence.unusedBypassAbsent !== true ||
    a.postClosurePresence.parentLockAbsent !== true ||
    a.postClosurePresence.runtimeLockAbsent !== true ||
    a.postClosurePresence.privateSqlScratchAbsent !== true ||
    a.acceptance.fullD !== false ||
    a.acceptance.localCredentialClosure !== true
  )
    fail();
}
function positiveProjectRead(x, p) {
  const pin = p.positiveProjectRead;
  if (
    !exact(pin, ['path', 'sha256', 'ledgerPath', 'ledgerSha256']) ||
    pin.path !==
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-preflight-actual-20261022.json' ||
    pin.ledgerPath !==
      'scripts/n8n/out/foundation/live/project-preflight-1c69c89e-7807-46d5-b7b8-ca28285ff2b4.jsonl' ||
    p.preserved[pin.path] !== pin.sha256 ||
    p.preserved[pin.ledgerPath] !== pin.ledgerSha256
  )
    fail();
  const receipt = JSON.parse(x.file(pin.path)),
    r = receipt.actual;
  if (
    receipt.kind !== 'm03_fixed_project_preflight_actual' ||
    receipt.version !== 1 ||
    receipt.sourceHead !== 'f4775b2fd1c88e0110555fa006027a3d39cdcd89' ||
    receipt.sourceCi !== 39818174853 ||
    receipt.allFiveSourceJobsAndVercelPassed !== true ||
    receipt.outerNativeExit !== 0 ||
    !Number.isFinite(Date.parse(receipt.completedAtUtc)) ||
    Date.parse(receipt.completedAtUtc) > x.clock() ||
    r?.status !== 'project_contract_ready' ||
    r.oneUseConsumed !== true ||
    r.getAttemptDebited !== true ||
    r.managementAttempts !== 6 ||
    r.controlAttempts !== 201 ||
    r.combinedAttempts !== 207 ||
    r.childTransportsClosed !== true ||
    r.newAcceptanceWindow !== false ||
    r.mutations !== 0 ||
    r.transport?.stage !== 'completed' ||
    r.transport.httpStatus !== 200 ||
    r.transport.nativeExit !== 0 ||
    r.transport.childStarted !== true ||
    r.transport.childClosed !== true ||
    r.transport.aborted !== false ||
    !exact(r.predicates, [
      'object',
      'projectId',
      'teamId',
      'rootDirectory',
      'nodeVersion',
      'framework',
      'githubType',
      'githubOrg',
      'githubRepo',
      'deploymentProtection',
      'bypassObject',
      'bypassEmpty',
    ]) ||
    Object.values(r.predicates).some((v) => v !== true) ||
    receipt.closure.metadataAndCliChildrenClosed !== true ||
    receipt.closure.parentMutexAbsent !== true ||
    receipt.closure.dpapiInputsConsumed !== 0 ||
    receipt.interpretation.businessAcceptance !== false ||
    receipt.interpretation.fullD !== false ||
    receipt.ledger.path !== pin.ledgerPath ||
    receipt.ledger.sha256 !== pin.ledgerSha256 ||
    receipt.ledger.onceOnly !== true ||
    receipt.ledger.rows !== 4 ||
    receipt.ledger.newGetIntents !== 1
  )
    fail();
  const text = x.file(pin.ledgerPath);
  if (hash(text) !== pin.ledgerSha256 || !text.endsWith('\n')) fail();
  const rows = text.slice(0, -1).split('\n').map(JSON.parse);
  if (
    rows.length !== 4 ||
    rows[0].event !== 'project_preflight_once_intent' ||
    rows[0].oneUseConsumed !== true ||
    rows[0].getAttemptDebited !== false ||
    rows[1].event !== 'project_preflight_metadata_result' ||
    rows[1].childClosed !== true ||
    rows[1].covers75Minutes !== true ||
    rows[2].event !== 'project_get_intent' ||
    rows[2].getAttemptDebited !== true ||
    rows[2].managementAttempts !== 6 ||
    rows[2].controlAttempts !== 201 ||
    rows[2].combinedAttempts !== 207 ||
    rows[3].event !== 'project_preflight_result' ||
    rows[3].status !== 'project_contract_ready' ||
    rows[3].childTransportsClosed !== true
  )
    fail();
}
const cleanedLeaves = Object.freeze([
  'emr-m03-acceptance-management.dpapi',
  'emr-m03-acceptance-management.lease.json',
  'emr-m03-acceptance-writer.dpapi',
  'emr-m03-acceptance-writer.lease.json',
  'emr-m03-acceptance-apifyread.dpapi',
  'emr-m03-acceptance-apifyread.lease.json',
  'emr-m03-acceptance-protection-bypass.dpapi',
  'emr-m03-acceptance-parent.operation.lock',
  'runtime.operation.lock',
]);
function priorCleanup(x) {
  // These are pinned public historical receipts, not reads of named credentials
  // or proof that an unobserved orphan/old full-D cleanup was established.
  const stem =
    'scripts/n8n/out/foundation/live/remaining-closed-cleanup-e8035391-dba8-48c9-97e0-139ba980d86e';
  const intent = JSON.parse(x.file(stem + '.intent.json')),
    result = JSON.parse(x.file(stem + '.result.json'));
  if (
    !exact(result, [
      'kind',
      'version',
      'segmentId',
      'status',
      'deleted',
      'observedAtUtc',
      'privateContentsRead',
      'networkRequests',
      'childProcessesStarted',
      'adminPairPreserved',
      'machineAndAdmissionsPreserved',
      'unknownOrphanClosureProven',
      'fullD',
    ]) ||
    result.kind !== 'm03_remaining_exact_temporary_cleanup_result' ||
    result.version !== 1 ||
    result.segmentId !== 'e8035391-dba8-48c9-97e0-139ba980d86e' ||
    result.status !== 'exact_nine_leaves_removed' ||
    JSON.stringify(result.deleted) !== JSON.stringify(cleanedLeaves) ||
    result.privateContentsRead !== false ||
    result.networkRequests !== 0 ||
    result.childProcessesStarted !== 0 ||
    result.adminPairPreserved !== true ||
    result.machineAndAdmissionsPreserved !== true ||
    result.unknownOrphanClosureProven !== false ||
    result.fullD !== false ||
    intent.kind !== 'm03_remaining_exact_temporary_cleanup_intent' ||
    intent.version !== 1 ||
    intent.segmentId !== result.segmentId ||
    JSON.stringify(intent.targets) !== JSON.stringify(cleanedLeaves) ||
    intent.privateContentsRead !== false ||
    intent.networkRequests !== 0 ||
    intent.childProcessesStarted !== 0 ||
    intent.unknownOrphanClosureProven !== false ||
    !Array.isArray(intent.projectedProcessSnapshot) ||
    !Number.isFinite(Date.parse(intent.createdAtUtc)) ||
    !Number.isFinite(Date.parse(result.observedAtUtc)) ||
    Date.parse(result.observedAtUtc) < Date.parse(intent.createdAtUtc)
  )
    fail();
}
function approval(x, required = true) {
  if (typeof c.packetSha256 !== 'string' || hash(x.file(c.packetRelative)) !== c.packetSha256) fail();
  if (c.approvalSha256 === null) {
    if (required) fail();
    return false;
  }
  const text = x.file(c.approvalRelative);
  if (hash(text) !== c.approvalSha256) fail();
  const a = JSON.parse(text);
  if (
    !exact(a, [
      'kind',
      'version',
      'segmentId',
      'applicationSource',
      'originalWindowId',
      'ownerReply',
      'recordedAtUtc',
      'reviewedPacketRelative',
      'reviewedPacketSha256',
      'checkpointRelative',
      'checkpointSha256',
      'singleSegmentNoAutomaticRenewal',
      'preserveHistoricalHeadersAndCounters',
      'noMigrationReplay',
      'caps',
    ]) ||
    a.kind !== 'm03_project_verified_continuation_approval' ||
    a.version !== 1 ||
    a.segmentId !== c.segmentId ||
    a.applicationSource !== c.sourceCommitSha ||
    a.originalWindowId !== c.windowId ||
    typeof a.ownerReply !== 'string' ||
    !a.ownerReply.trim() ||
    a.reviewedPacketRelative !== c.packetRelative ||
    a.reviewedPacketSha256 !== c.packetSha256 ||
    a.checkpointRelative !== c.checkpointRelative ||
    a.checkpointSha256 !== c.checkpointSha256 ||
    a.singleSegmentNoAutomaticRenewal !== true ||
    a.preserveHistoricalHeadersAndCounters !== true ||
    a.noMigrationReplay !== true ||
    !exact(a.caps, Object.keys(caps)) ||
    Object.keys(caps).some((k) => a.caps[k] !== caps[k])
  )
    fail();
  const at = Date.parse(a.recordedAtUtc);
  if (!Number.isFinite(at) || x.clock() < at) fail();
  x.approvedAt = at;
  return true;
}
function jsonl(text, max) {
  if (!text.endsWith('\n')) fail();
  const lines = text.slice(0, -1).split('\n');
  if (lines.length > max) fail();
  return { lines, rows: lines.map((s) => JSON.parse(s)) };
}
function journals(x, initial = false) {
  const p = x.checkpoint,
    j = p.journals;
  if (!exact(j, ['management', 'control', 'setup'])) fail();
  const values = {};
  for (const [name, maximum, prefix] of [
    ['management', 510, 3],
    ['control', 8000, 200],
    ['setup', 500, 2],
  ]) {
    if (
      !exact(j[name], ['path', 'sha256']) ||
      j[name].path !== `scripts/n8n/out/foundation/live/${name}.jsonl`
    )
      fail();
    const text = x.file(j[name].path),
      v = jsonl(text, maximum),
      first = v.lines.slice(0, prefix).join('\n') + '\n';
    if (v.lines.length < prefix || hash(first) !== j[name].sha256 || (initial && text !== first)) fail();
    values[name] = { text, rows: v.rows };
  }
  const [header, ...management] = values.management.rows;
  if (
    !exact(header, ['event', 'version', 'sourceCommitSha', 'deadlineAt']) ||
    header.event !== 'management_header' ||
    header.version !== 1 ||
    header.sourceCommitSha !== c.sourceCommitSha ||
    header.deadlineAt !== c.originalDeadlineAt ||
    management.length + 4 > 512 ||
    management.some(
      (r, i) => !exact(r, ['event', 'ordinal']) || r.event !== 'management_attempt' || r.ordinal !== i + 1,
    )
  )
    fail();
  const control = values.control.rows.filter((r) => r.event === 'control_request_intent');
  if (
    control.length + 1 > 2048 ||
    control.some((r, i) => r.ordinal !== i + 1) ||
    (initial &&
      (control.length !== 200 ||
        control.some((r) => r.kind !== 'discovery' || Object.hasOwn(r, 'executionId'))))
  )
    fail();
  for (const [i, setup] of values.setup.rows.slice(0, 2).entries())
    if (
      !exact(setup, ['event', 'ordinal', 'kind', 'at']) ||
      setup.event !== 'setup_attempt' ||
      setup.ordinal !== i + 1 ||
      setup.kind !== 'GET' ||
      setup.at !== [1792608136543, 1792666486587][i]
    )
      fail();
  return values;
}
function initial(x, beforePrivate = true, admitted = false) {
  const values = journals(x, true);
  for (const name of ['preflight', 'runtime']) {
    const t = x.file(`scripts/n8n/out/foundation/live/${name}.jsonl`, { optional: true });
    if (t !== null && t !== '') fail();
  }
  for (const path of [
    ...(admitted ? [] : [c.admissionRelative]),
    c.claimRelative,
    'scripts/n8n/out/foundation/live/runtime.operation.lock',
    'scripts/db/out/m03-foundation-owner-provision-attempt.json',
    'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json',
    'scripts/db/out/m03-foundation-startup-replacement-1c69c89e-7807-46d5-b7b8-ca28285ff2b4-owner-provision-attempt.json',
    ...[
      'attempt',
      'latest',
      'owner-provision-attempt',
      'unprovisioned-archive-attempt',
      'reactivation-attempt',
    ].map(
      (n) =>
        `scripts/db/out/m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-${n}.json`,
    ),
    ...[
      'attempt',
      'latest',
      'owner-provision-attempt',
      'unprovisioned-archive-attempt',
      'reactivation-attempt',
    ].map((n) => `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-${n}.json`),
  ])
    if (x.physical(join(repo, path), true)) fail();
  const prior = JSON.parse(
    x.file('milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-attempt-20261021.json'),
  );
  for (const pid of [prior.clock.parentProcessId, prior.clock.runtimeProcessId, 5468, 35920, 44408, 60040])
    if (!positive(pid) || x.io.processAlive(pid) !== false) fail();
  if (beforePrivate) {
    if (
      typeof process.env.LOCALAPPDATA !== 'string' ||
      !process.env.LOCALAPPDATA ||
      x.physical(join(process.env.LOCALAPPDATA, 'Temp', 'emr-m03-acceptance-protection-bypass.dpapi'), true)
    )
      fail();
  }
  return values;
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
    r.kind !== 'm03_project_verified_continuation_admission' ||
    r.version !== 1 ||
    r.segmentId !== c.segmentId ||
    r.sourceCommitSha !== c.sourceCommitSha ||
    r.windowId !== c.windowId ||
    r.approvalSha256 !== c.approvalSha256 ||
    !Number.isSafeInteger(r.startsAt) ||
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
  journals(x);
  const ct = x.file(c.claimRelative, { optional: true }),
    claim = ct === null ? null : JSON.parse(ct);
  if (
    claim !== null &&
    (!exact(claim, [
      'kind',
      'version',
      'segmentId',
      'admissionSha256',
      'processId',
      'parentProcessId',
      'claimedAt',
    ]) ||
      claim.kind !== 'm03_project_verified_continuation_runtime_claim' ||
      claim.version !== 1 ||
      claim.segmentId !== c.segmentId ||
      claim.admissionSha256 !== hash(text) ||
      !positive(claim.processId) ||
      !Number.isSafeInteger(claim.claimedAt) ||
      claim.claimedAt < r.startsAt ||
      claim.claimedAt > x.clock() ||
      claim.parentProcessId !== r.parentProcessId ||
      ct !== JSON.stringify(claim) + '\n')
  )
    fail();
  return { r, text, claim, checkpoint: x.checkpoint };
}
function proof(data, claimed = false) {
  const p = Object.freeze({
    kind: 'foundation_project_verified_continuation',
    segmentId: c.segmentId,
    sourceCommitSha: c.sourceCommitSha,
    windowId: c.windowId,
    startsAt: data.r.startsAt,
    deadlineAt: data.r.deadlineAt,
    stopNewAt: data.r.stopNewAt,
    hardDeadlineAt: data.r.hardDeadlineAt,
    carriedManagementAttempts: 4,
    carriedControlAttempts: 1,
  });
  proofs.set(p, {
    admissionSha256: hash(data.text),
    claimed,
    processId: data.claim?.processId,
    controlPrefixSha256: data.checkpoint.journals.control.sha256,
    checkpoint: data.checkpoint,
  });
  return p;
}
export function assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed = false } = {}) {
  const meta = proofs.get(p);
  if (!meta || !Object.isFrozen(p) || (claimed && (meta.claimed !== true || meta.processId !== process.pid)))
    fail();
  return p;
}
export function assertFoundationProjectVerifiedContinuationSetupResume(
  p,
  { sourceCommitSha, deadlineAt, previousEvents },
) {
  assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed: true });
  assertFoundationProjectVerifiedContinuationJournalPrefixes(p);
  if (
    sourceCommitSha !== c.sourceCommitSha ||
    deadlineAt !== p.deadlineAt ||
    !Array.isArray(previousEvents) ||
    previousEvents.length !== 2 ||
    JSON.stringify(previousEvents) !==
      JSON.stringify([
        { event: 'setup_attempt', ordinal: 1, kind: 'GET', at: 1792608136543 },
        { event: 'setup_attempt', ordinal: 2, kind: 'GET', at: 1792666486587 },
      ])
  )
    fail();
  return p;
}
export function assertFoundationProjectVerifiedContinuationControlResume(p, { deadlineAt, previousEvents }) {
  assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed: true });
  assertFoundationProjectVerifiedContinuationJournalPrefixes(p);
  if (
    deadlineAt !== p.deadlineAt ||
    !Array.isArray(previousEvents) ||
    previousEvents.length !== 200 ||
    hash(previousEvents.map((r) => JSON.stringify(r) + '\n').join('')) !== proofs.get(p).controlPrefixSha256
  )
    fail();
  return p;
}
export function assertFoundationProjectVerifiedContinuationJournalPrefixes(p, options = {}) {
  assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed: true });
  if (!exact(options, Object.keys(options)) || Object.keys(options).some((k) => k !== 'managementText'))
    fail();
  const x = context();
  x.checkpoint = proofs.get(p).checkpoint;
  const current = journals(x);
  if (
    options.managementText !== undefined &&
    (typeof options.managementText !== 'string' || options.managementText !== current.management.text)
  )
    fail();
  return p;
}
export function verifyFoundationProjectVerifiedContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    checkpoint(x);
    const approved = approval(x, false);
    // Public readiness never inspects a credential-named path, even when a
    // future owner approval is pinned. Admit performs its separate metadata gate.
    initial(x, false);
    return Object.freeze({
      kind: approved
        ? 'project_verified_continuation_ready'
        : 'project_verified_continuation_approval_required',
      ...(approved ? {} : { status: 'approval_required', approvalRequired: true }),
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
export function admitFoundationProjectVerifiedContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    checkpoint(x);
    approval(x);
    const values = initial(x),
      parent = x.parent(undefined, true),
      startsAt = x.clock();
    x.create(c.admissionRelative, {
      kind: 'm03_project_verified_continuation_admission',
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
    });
    if (
      x.parent(parent.pid, true).text !== parent.text ||
      journals(x, true).management.text !== values.management.text
    )
      fail();
    return proof(record(x));
  } catch {
    fail();
  }
}
export function readFoundationProjectVerifiedContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    checkpoint(x);
    approval(x);
    return proof(record(x));
  } catch {
    fail();
  }
}
export function readClaimedFoundationProjectVerifiedContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    checkpoint(x);
    approval(x);
    const data = record(x);
    if (!data.claim) fail();
    if (
      x.io.processAlive(data.claim.processId) !== true ||
      x.io.processAlive(data.claim.parentProcessId) !== true ||
      x.file('scripts/n8n/out/foundation/live/runtime.operation.lock', { max: 128 }) !==
        'emr-m03-foundation-live-runtime-v1\n'
    )
      fail();
    return proof(data);
  } catch {
    fail();
  }
}
export function claimFoundationProjectVerifiedContinuation(p, options = {}, dependencies = {}) {
  try {
    assertFoundationLiveProjectVerifiedContinuationProof(p);
    const x = context(options, dependencies);
    checkpoint(x);
    approval(x);
    const data = record(x),
      meta = proofs.get(p);
    if (meta.claimed || meta.admissionSha256 !== hash(data.text) || data.claim) fail();
    // Admission already exists; the rest of the initial snapshot must still be exact.
    const values = initial(x, false, true);
    if (values.management.rows.length !== 3) fail();
    x.parent(data.r.parentProcessId, true);
    x.create(c.claimRelative, {
      kind: 'm03_project_verified_continuation_runtime_claim',
      version: 1,
      segmentId: c.segmentId,
      admissionSha256: hash(data.text),
      processId: x.pid,
      parentProcessId: x.ppid,
      claimedAt: x.clock(),
    });
    const actual = record(x);
    if (actual.claim?.processId !== x.pid) fail();
    return proof(actual, true);
  } catch {
    fail();
  }
}
const publicProof = (p) => ({
  kind: 'clock_project_verified_continuation_admitted',
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
    const mode = process.argv[2];
    const out =
      mode === 'CheckOnly'
        ? verifyFoundationProjectVerifiedContinuation()
        : mode === 'Admit'
          ? publicProof(admitFoundationProjectVerifiedContinuation())
          : mode === 'Read'
            ? publicProof(readFoundationProjectVerifiedContinuation())
            : mode === 'ReadClaimed'
              ? publicProof(readClaimedFoundationProjectVerifiedContinuation())
              : fail();
    process.stdout.write(JSON.stringify(out) + '\n');
  } catch {
    process.stdout.write(
      '{"kind":"project_verified_continuation_blocked","privateRead":false,"networkRequests":0}\n',
    );
    process.exitCode = 1;
  }
}
