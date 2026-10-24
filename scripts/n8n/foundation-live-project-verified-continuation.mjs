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
// Exact public reconciliation of the first CLOSED persistent-access attempt.
// This permits an immutable technical sibling, never reopening the old clock
// or forgetting its acknowledged temporary writes, residuals or usage.
const effectfulRecovery = Object.freeze({
  approvalRelative: 'milestones/M03-n8n-foundation/evidence/sole-bypass-scope-approval-20261023.json',
  approvalSha256: '38faad6db1cf73045c81c410cb5aaec657c9e213c2aea00b9d5609ad2d54c574',
  packetRelative: 'milestones/M03-n8n-foundation/evidence/sole-bypass-scope-decision-20261023.md',
  packetSha256: '4856982665b2fb5265ec31e1c3251e719595f65889a4bd6318601e28b1a00def',
  receiptRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-persistent-attempt-20261023.json',
  receiptSha256: '1d2455a5134e7b39339bf7612b48d0cb0de44a42e83e38a4b75c91804441eb6c',
  mainManagementAttempts: 9,
  mainControlAttempts: 250,
  setupRows: 13,
  setupAttempts: 9,
  preflightRows: 1,
  pins: Object.freeze({
    'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.json':
      '8e0392a73ca29ccdf64cc0bfcb4da2f19a48ad7378f0a7eac1a0d0f298da86ed',
    'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.runtime-claim.json':
      '9bb55db624da03de06b008a969557254b82f6115841e7308dbaab80d55a89340',
    'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.closed.json':
      '507a7a75ba34ecff8676c8b54568ae2316bb0cdd7f6265c6f1baa4e029b7bebd',
    'scripts/n8n/out/foundation/live/management.jsonl':
      '5816c9937e68473d73ca577b359f02bee064989423fde3877bb3ec8d74837bd5',
    'scripts/n8n/out/foundation/live/control.jsonl':
      '07daf2c74525b9e7dc0561395b1719e6081817eccaa6843c8107e7b04e29dc8c',
    'scripts/n8n/out/foundation/live/setup.jsonl':
      '83927b3ab4acfd0bf5d7b541d9846e7ae5092c19e06480be3027e8a94ecf069f',
    'scripts/n8n/out/foundation/live/preflight.jsonl':
      'ff31cdf66e1b7e2dee718a61fb6d5a48eb65e4a9cc3f3c5b5d12d5713513711b',
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-attempt.json':
      'de5a06a29bd9c40f9236d18568b8ec8fc74f99819ce4582ca9ffcaa5f95d794f',
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-latest.json':
      '732414828c862cb86b18eb1f322ceb2b3405d51923dae7ca2137f3ceb80eda8b',
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-reactivation-attempt.json':
      '7980c9fa89b6d8a739b1104fa24ad51ec2a27e12e4ce8990dc00289b4ed69080',
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-unprovisioned-archive-attempt.json':
      '52b2fe10c2d1a60eff7be1d307495bd25592e92d757d1d845361484c8bf97dd7',
  }),
});
// Root verified immutable a5e with CI39990446858 (all five) and Vercel success.
// Original f429 remains the authorization reference and historical header.
const priorActiveRuntime = Object.freeze({
  windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
  sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
  sourceCi: 39990446858,
  allFiveCiJobsPassed: true,
  vercelPassed: true,
  setupMaximum: 88,
  proposedSetupMaximum: 88,
});
// Both earlier SQL rows are permanently closed. Root verified this immutable
// third-window app source against all five CI40046523317 jobs and Vercel.
export const foundationProjectVerifiedActiveRuntime = Object.freeze({
  windowId: 'eda4fae1-1e19-47db-81b8-beac1a4ed883',
  sourceCommitSha: 'aff94f2b2d8055cf93b5405e6b11d4e7d9c86803',
  sourceCi: 40046523317,
  allFiveCiJobsPassed: true,
  vercelPassed: true,
  setupMaximum: 132,
  proposedSetupMaximum: 132,
});
const activeRuntime = (recovery) =>
  recovery?.closedFixtureTechnicalAttempt === 8 ? foundationProjectVerifiedActiveRuntime : priorActiveRuntime;
const setupAllocationApproval = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/remaining-control-allocation-approval-20261023.json',
  sha256: '313dd1de36e1c2d24e426cb2d09d1a027d192305a97a3a45b5a1783f61bf3f43',
});
const closedWindowRecovery = Object.freeze({
  receiptRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-sole-default-attempt-20261023.json',
  receiptSha256: '3e9938b2e054fa8633c626d3318c4eff444ede0e5ece60ab55b5974501c0dbe1',
  cleanupRelative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-sole-default-cleanup-20261023.json',
  cleanupSha256: '346ca90d3bbaee0f9c7333d049f354f4e02fec8aa5ddacd4bf2e12eb741341b3',
  readbackRelative:
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-sole-default-readback-20261023.json',
  readbackSha256: '86359c0db20e852c2a945122f0f6a07543433421307f4f445497a69c7fcd8801',
  mainManagementAttempts: 92,
  carriedManagementAttempts: 6,
  mainControlAttempts: 300,
  carriedControlAttempts: 1,
  setupRows: 84,
  setupAttempts: 44,
  preflightRows: 4,
  runtimeRows: 50,
  gatewayPreflightAttempts: 2,
  legacySqlAdmitted: 2,
  pins: Object.freeze({
    'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-2.json':
      '1664a4026a479ef9de04e117fb362198fda844519cada3b9c4d443b47e4f7dea',
    'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-2.runtime-claim.json':
      '7dadd3e321329f856079bc20eeefdee25136bab52b4c255a04d40c8af41ec83f',
    'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-2.closed.json':
      '50f77b6872648d2ab26b67199898ae07e7016af719520b397dcce4f602c088a7',
    'scripts/n8n/out/foundation/live/management.jsonl':
      'f103e2f9e04f0e1802271c0d42db2023e4acd8cd9ae13ff873ca253a2c8366e4',
    'scripts/n8n/out/foundation/live/control.jsonl':
      '0ddb25eb3355b86d3fc507b3f8b322285a89439ad0829ec00a94f3a4a4536080',
    'scripts/n8n/out/foundation/live/setup.jsonl':
      '0cad48fd9550da762c0b629ee63364e4668f4829c3a89bd6f75ec2843d32f624',
    'scripts/n8n/out/foundation/live/preflight.jsonl':
      'ae07f30519e51f81d60bfa5cabe5ef80b5694fe13bac3da181c2b8fe38d08598',
    'scripts/n8n/out/foundation/live/runtime.jsonl':
      '3f1c85ad7d185481da33c8989b34b82cbbef26aa3ec01209bc13561bd3481378',
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-2-attempt.json':
      '7024fb38b75d21921222a2b68ca7abf6a991bc1fad74284c9f7ccc0e464ae62f',
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-2-latest.json':
      '13dc87d6a6b7ddf8f066a83f1db19aeb8efe928049bb6ba3b36ee263b0608ed2',
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-2-owner-provision-attempt.json':
      'e4f386983ed722c5c579f34484b515b03fe8264ebab1f096a0ad2a2d079e5046',
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-2-reactivation-attempt.json':
      '310fd780934bf7500236d60fd786020a758c0262730722903d8ad4ea74c91912',
    'scripts/db/out/m03-foundation-writer-close-df4f29ec-e2dc-4d82-a276-62a4e695e6f9-latest.json':
      '78e718069962421d1b88f1b2d794a7b691ec7ab1efb0ad6940e4e45e472d4c6e',
    'scripts/db/out/m03-foundation-inspect-82f55b86-3bc8-42bd-95b4-82039af7b9fc-latest.json':
      '3e8972d1e27ac0d829b506878753c305202c5acc0cc5ffff23965586c3108437',
    'scripts/db/out/m03-foundation-archive-df4f29ec-e2dc-4d82-a276-62a4e695e6f9-latest.json':
      'c2d67c19b2a449f020b6d944ef1e0f6ec3a1e5bff3e4c4083b36162352596de1',
  }),
});
// The separate inactive WF-00 repair consumed four management requests. Its
// append-only journal and physically closed receipt extend the carried ledger;
// they do not rewrite the earlier 98-request reconciliation or replenish caps.
const wf00RestoreRecovery = Object.freeze({
  receiptRelative: 'milestones/M03-n8n-foundation/evidence/wf00-restore-verified-20261023.json',
  receiptSha256: '32184be54a4b36f250fa026ece00f295c94c6149b2af5fb682bfb769f683f9ec',
  priorReceiptRelative: 'milestones/M03-n8n-foundation/evidence/wf00-restore-attempt-20261023.json',
  priorReceiptSha256: 'e5d6188f80281a0603209b57de131f4f8fe16278c7d56a53ae3f56b77156a3f7',
  journalRelative: 'scripts/n8n/out/foundation/wf00-restore-20261023.jsonl',
  journalSha256: '53b1620b0ee3bdd54645076cd81cfc2c80d6040ee58d2c0cdb6511fc68b5298b',
  priorJournalSha256: '22c18ac86b7e0e03762cf19ad98a33560344af664fcf25f0a45673906fdc955d',
});
const readonlyPrepareRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical3-reconciliation-20261023.json',
  sha256: '176831e9c435b174e7d19e436c42c40d825b72ca677f7fb0ab1bd3b1f14e610b',
});
const nativeDiscoveryRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical4-reconciliation-20261023.json',
  sha256: 'b4e9beab46bf5c375529f082e9815979d87e9c6a3526edf38705c418bc78f0ef',
});
const nativeBrowserDiscoveryRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical5-reconciliation-20261023.json',
  sha256: '82327c57bd526bd61629fa5c2d099f21e82351abb419201353bff7965ae2d2ca',
});
const baselineDiscoveryRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical6-reconciliation-20261024.json',
  sha256: '258a6c7d15c59323f4e95c5315d42d839f735ea40d70834b8aa171ff00b9ca66',
});
const wf70DiagnosticRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-wf70-readback-20261024.json',
  sha256: '4b76cc98a34ad10ff16f200d34cd89c6527076a849b168e0bfcd48690392ac0c',
  journalRelative: 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl',
  journalSha256: '86753c28dc66e902bfe80774ba3f66543b5808e99ef7f694154c831543d16c58',
});
const managementAllocationApproval = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/remaining-management-allocation-approval-20261024.json',
  sha256: 'e2819cf2dc62a01befabca78d32032cfab4378a39625b8d0dfae14229d9d80db',
  packetRelative: 'milestones/M03-n8n-foundation/evidence/remaining-management-allocation-20261024.md',
  packetSha256: '54bf439c37109db9cb184fd70fc8896684ff605d7f243fce0196684d54ddfa74',
});
const controlManagementAllocationApproval = Object.freeze({
  relative:
    'milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-approval-20261024.json',
  sha256: '72ffb37faa1854ac86893f8bf166949daa4034be19ec2af5c217bde8383f65e2',
  packetRelative:
    'milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-20261024.md',
  packetSha256: 'dddc18288e44fcb0fde06ee6de6fc86bbc21f65353cd089988b10f5dd0714fa2',
});
const closedPreparationRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical7-reconciliation-20261024.json',
  sha256: '467b2f08fca6d7ea9f224cd0ea02dcdcd9e0519b263abb5ad188bdae0bc2191a',
});
const closedFixtureRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical8-reconciliation-20261024.json',
  sha256: 'e0435f69edc0223195b167e59c94cf87e9f41aa147941a35fb8486f51382c94c',
});
const preprivateAdminRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical9-reconciliation-20261024.json',
  sha256: 'ffd01a34c5e542c66035fde8995a46ce5975912705e57b8f249ce5f30cc5614e',
});
const catalogReadonlyRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical10-reconciliation-20261024.json',
  sha256: '6e4e1af66c0f94ea87bddabe4b326b512a87e3c8ee678f037a7bed68f60702be',
});
const catalogManagementAllocationApproval = Object.freeze({
  relative:
    'milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-approval-20261024.json',
  sha256: '9cb054ca3421e9bd32c7bfd92ad7982b32c5c6d4b4aacb5c77e50f58a9cb1b1f',
  packetRelative: 'milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-20261024.md',
  packetSha256: '967b0250f7b61b2108d31ca59bc20e12c0367e7fcb8dc8ca877665a9af4071d6',
});
const adminAdmissionReadonlyRecovery = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical11-reconciliation-20261024.json',
  sha256: '92b1628477730b3f32ea93e9724a29028be8019ba73e18e57f8f76d4fa953628',
});
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
  x.recovery = reconciledEffectfulAttempt(x);
  x.recovery = reconciledClosedWindow(x) ?? x.recovery;
  x.recovery = reconciledWf00Restore(x) ?? x.recovery;
  x.recovery = reconciledReadonlyPrepare(x) ?? x.recovery;
  x.recovery = reconciledNativeDiscovery(x) ?? x.recovery;
  x.recovery = reconciledBaselineDiscovery(x) ?? x.recovery;
  x.recovery = reconciledWf70Diagnostic(x) ?? x.recovery;
  x.recovery = approvedManagementAllocation(x) ?? x.recovery;
  x.recovery = reconciledClosedPreparation(x) ?? x.recovery;
  x.recovery = reconciledClosedFixture(x) ?? x.recovery;
  x.recovery = approvedControlManagementAllocation(x) ?? x.recovery;
  x.recovery = reconciledPreprivateAdmin(x) ?? x.recovery;
  x.recovery = reconciledCatalogReadonly(x) ?? x.recovery;
  x.recovery = approvedCatalogManagementAllocation(x) ?? x.recovery;
  x.recovery = reconciledAdminAdmissionReadonly(x) ?? x.recovery;
  if (x.recovery?.closedWindow) assertSetupAllocationApproval(x);
  recoveryPreflight(x);
  return p;
}
function reconciledEffectfulAttempt(x) {
  const text = x.file(effectfulRecovery.receiptRelative, { optional: true });
  if (text === null) return null;
  if (hash(text) !== effectfulRecovery.receiptSha256) fail();
  const r = JSON.parse(text);
  const approvalText = x.file(effectfulRecovery.approvalRelative);
  if (
    hash(approvalText) !== effectfulRecovery.approvalSha256 ||
    hash(x.file(effectfulRecovery.packetRelative)) !== effectfulRecovery.packetSha256
  )
    fail();
  const owner = JSON.parse(approvalText);
  if (
    owner.kind !== 'm03_temporary_sole_default_bypass_approval' ||
    owner.version !== 1 ||
    owner.ownerReply !== 'I approve' ||
    owner.packet !== effectfulRecovery.packetRelative ||
    owner.projectId !== 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' ||
    owner.teamId !== 'team_gboXPxTevpCOZuaA8eY9PmR1' ||
    owner.branch !== 'm03-n8n-foundation' ||
    owner.maximumConcurrentOwnedBypasses !== 1 ||
    owner.requireEmptyInitialMap !== true ||
    owner.requireRevokeAndVerifiedAbsence !== true ||
    owner.allowancesReplenished !== false ||
    owner.priorAttemptsPreserved !== true ||
    owner.productionOperationsApproved !== false ||
    owner.mergeApproved !== false ||
    owner.m04Approved !== false
  )
    fail();
  for (const [path, expected] of Object.entries(effectfulRecovery.pins)) {
    if (!path.endsWith('.jsonl') && hash(x.file(path)) !== expected) fail();
  }
  if (
    r.kind !== 'm03_persistent_dev_acceptance_attempt' ||
    r.version !== 1 ||
    r.environment !== 'dev' ||
    r.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    r.applicationSource !== c.sourceCommitSha ||
    r.clock.segmentId !== c.segmentId ||
    r.clock.parentProcessId !== 30232 ||
    r.clock.runtimeProcessId !== 63592 ||
    r.clock.closedRecordReopened !== false ||
    r.clock.closedAt > x.clock() ||
    r.clock.admissionSha256 !== effectfulRecovery.pins[c.admissionRelative] ||
    r.clock.runtimeClaimSha256 !== effectfulRecovery.pins[c.claimRelative] ||
    r.clock.technicalClosureSha256 !==
      effectfulRecovery.pins[c.admissionRelative.replace(/\.json$/, '.closed.json')] ||
    r.vercelSetup.setupJournalRows !== 13 ||
    r.vercelSetup.newSetupAttempts !== 7 ||
    r.vercelSetup.ownedBypassCreateAcknowledged !== true ||
    r.vercelSetup.ownedBypassRemovalAcknowledgedAndAbsentVerified !== true ||
    r.vercelSetup.failedPatchIntentPreserved !== true ||
    r.vercelSetup.environmentEntriesCreated !== 0 ||
    r.vercelSetup.deploymentsCreated !== 0 ||
    r.database.authenticationVerified !== true ||
    r.database.reviewedMigrationVersions !== 14 ||
    r.database.pushAttempted !== false ||
    r.database.unprovisionedFixtureArchived !== true ||
    r.database.reactivationState !== 'acknowledged_and_verified' ||
    r.database.childrenClosed !== true ||
    r.sourceClose.status !== 'closed' ||
    r.sourceClose.childTransportsClosed !== true ||
    r.sourceClose.adminChildClosed !== true ||
    r.sourceClose.residual !== true ||
    r.wrapperClose.childClosed !== true ||
    r.wrapperClose.credentialChildrenClosed !== true ||
    r.wrapperClose.emergencyShutdown !== false ||
    r.wrapperClose.nativeExit !== 1 ||
    r.subsequentLocalBypassCleanup.nativeExit !== 0 ||
    r.subsequentLocalBypassCleanup.temporaryFileAbsent !== true ||
    r.subsequentLocalBypassCleanup.localBypassHandoffPresent !== false ||
    r.subsequentLocalBypassCleanup.parentOperationLockPresent !== false ||
    r.subsequentLocalBypassCleanup.privateContentsRead !== false ||
    r.accounting.mainManagementAttempts !== 9 ||
    r.accounting.outsideManagementAttempts !== 4 ||
    r.accounting.aggregateManagementAttempts !== 13 ||
    r.accounting.mainControlAttempts !== 250 ||
    r.accounting.outsideControlAttempts !== 1 ||
    r.accounting.aggregateControlAttempts !== 251 ||
    r.accounting.aggregateCombinedAttempts !== 264 ||
    r.accounting.allowancesReplenished !== false ||
    r.accounting.nativeWorkflowExecutions !== 0 ||
    r.accounting.gatewayAttempts !== 0 ||
    r.accounting.providerGetAttempts !== 0 ||
    r.accounting.actorStarts !== 0 ||
    r.acceptance.sqlFoundationWindowProvisioned !== false ||
    r.acceptance.workflowTransitions !== 0 ||
    r.acceptance.newCollectedItems !== 0 ||
    r.acceptance.phaseB !== false ||
    r.acceptance.fullD !== false ||
    r.acceptance.m03Complete !== false
  )
    fail();
  return effectfulRecovery;
}
function reconciledClosedWindow(x) {
  const text = x.file(closedWindowRecovery.receiptRelative, { optional: true });
  if (text === null) return null;
  if (
    !x.recovery ||
    hash(text) !== closedWindowRecovery.receiptSha256 ||
    hash(x.file(closedWindowRecovery.cleanupRelative)) !== closedWindowRecovery.cleanupSha256 ||
    hash(x.file(closedWindowRecovery.readbackRelative)) !== closedWindowRecovery.readbackSha256
  )
    fail();
  const appendOnlyPrefixes = {
    'scripts/n8n/out/foundation/live/management.jsonl': closedWindowRecovery.mainManagementAttempts + 1,
    'scripts/n8n/out/foundation/live/control.jsonl': closedWindowRecovery.mainControlAttempts,
    'scripts/n8n/out/foundation/live/setup.jsonl': closedWindowRecovery.setupRows,
    'scripts/n8n/out/foundation/live/preflight.jsonl': closedWindowRecovery.preflightRows,
  };
  for (const [path, expected] of Object.entries(closedWindowRecovery.pins)) {
    const text = x.file(path);
    if (Object.hasOwn(appendOnlyPrefixes, path)) {
      // Global journals append during this claimed attempt. Preserve the exact
      // reconciled prefix; journals()/recoveryPreflight() validate later rows.
      const rows = jsonl(text, 8000),
        length = appendOnlyPrefixes[path];
      if (rows.lines.length < length || hash(rows.lines.slice(0, length).join('\n') + '\n') !== expected)
        fail();
    } else if (hash(text) !== expected) fail();
  }
  const attempt = JSON.parse(text),
    cleanup = JSON.parse(x.file(closedWindowRecovery.cleanupRelative));
  const readback = JSON.parse(x.file(closedWindowRecovery.readbackRelative));
  const writer = JSON.parse(x.file(cleanup.writerClose.receiptPath));
  const owner = JSON.parse(x.file(cleanup.independentAdminReadback.receiptPath));
  const archive = JSON.parse(x.file(cleanup.subsequentArchive.receiptPath));
  for (const [field, raw] of [
    ['writerClose', writer],
    ['independentAdminReadback', owner],
    ['subsequentArchive', archive],
  ])
    if (
      cleanup[field].receiptSha256 !== closedWindowRecovery.pins[cleanup[field].receiptPath] ||
      cleanup[field].runId !== raw.runId
    )
      fail();
  if (
    attempt.kind !== 'm03_sole_default_technical_attempt' ||
    attempt.version !== 1 ||
    attempt.environment !== 'dev' ||
    attempt.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    attempt.technicalOrdinal !== 2 ||
    attempt.segmentId !== c.segmentId ||
    attempt.windowId !== c.windowId ||
    attempt.applicationSource !== c.sourceCommitSha ||
    attempt.status !== 'closed_with_residuals' ||
    attempt.clock.childClosed !== true ||
    attempt.clock.credentialChildrenClosed !== true ||
    attempt.clock.emergencyShutdown !== false ||
    attempt.clock.closureVerified !== false ||
    attempt.clock.bypassHandoffDeleted !== false ||
    attempt.clock.closedAt > x.clock() ||
    attempt.closure.windowClosed !== false ||
    attempt.closure.fixtureArchived !== false ||
    attempt.closure.baselineRestored !== false ||
    attempt.closure.remoteWorkSettled !== false ||
    attempt.closure.environmentCleanupVerified !== true ||
    attempt.closure.parentLockAbsent !== true ||
    attempt.closure.localBypassDeletedAfterChildClosure !== true ||
    attempt.closure.knownCredentialProcessCount !== 0 ||
    attempt.workflowPreparation.workflowWrites !== 0 ||
    attempt.workflowPreparation.credentialWrites !== 0 ||
    attempt.accounting.mainManagementAttempts !== 92 ||
    attempt.accounting.aggregateManagementAttempts !== 96 ||
    attempt.accounting.mainControlAttempts !== 300 ||
    attempt.accounting.aggregateControlAttempts !== 301 ||
    attempt.accounting.gatewayPreflightAttempts !== 2 ||
    attempt.accounting.nativeWorkflowExecutions !== 0 ||
    attempt.accounting.contentProviderReadAttempts !== 0 ||
    attempt.accounting.actorStarts !== 0 ||
    attempt.accounting.allowancesReplenished !== false ||
    attempt.setup.setupRows !== 84 ||
    attempt.setup.setupRequests !== 44 ||
    attempt.setup.defaultAndEnvironmentRemovalVerified !== true ||
    cleanup.kind !== 'm03_sole_default_cleanup_reconciliation' ||
    cleanup.version !== 1 ||
    cleanup.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    cleanup.environment !== 'dev' ||
    cleanup.parentAttempt !== closedWindowRecovery.receiptRelative.split('/').at(-1) ||
    cleanup.accounting.managementAttempts !== 98 ||
    cleanup.accounting.controlAttempts !== 301 ||
    cleanup.accounting.combinedAttempts !== 399 ||
    cleanup.accounting.allowancesReplenished !== false ||
    cleanup.remaining.fixtureArchiveVerified !== true ||
    cleanup.remaining.sqlWindowPermanentlyClosed !== true ||
    cleanup.operations.actorStarts !== 0 ||
    cleanup.operations.providerSpendUsd !== 0 ||
    cleanup.operations.writerCloseMutations !== 1 ||
    cleanup.operations.fixtureArchiveMutations !== 1 ||
    readback.workflow.actualGetCalls !== 2 ||
    readback.workflow.authenticationVerified !== true ||
    readback.workflow.projectVerified !== true ||
    readback.workflow.socketsAndChildrenClosed !== true ||
    readback.workflow.disposableCopiesDeleted !== true ||
    readback.workflow.definitionChangedByThisRead !== false ||
    readback.accounting.aggregateManagementAttempts !== 98 ||
    readback.accounting.aggregateControlAttempts !== 301 ||
    readback.accounting.aggregateCombinedAttempts !== 399 ||
    readback.accounting.newIndependentManagement !== 2 ||
    readback.accounting.nativeExecutions !== 0 ||
    readback.accounting.actorStarts !== 0
  )
    fail();
  for (const receipt of [writer, owner, archive])
    if (
      receipt.environment !== 'dev' ||
      receipt.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      receipt.host !== 'aws-1-eu-central-1.pooler.supabase.com' ||
      receipt.port !== 5432 ||
      receipt.authenticationVerified !== true ||
      receipt.childrenClosed !== true ||
      receipt.scratchDeleted !== true ||
      receipt.pushAttempted !== false ||
      receipt.pendingVersions.length !== 0 ||
      receipt.inspectParentLockDeleted !== true
    )
      fail();
  if (
    writer.status !== 'writer_close_verified' ||
    writer.administratorLoaded !== false ||
    writer.writerCloseAcknowledged !== true ||
    writer.writerCloseNativeExit !== 0 ||
    writer.writerRpcClosed !== true ||
    writer.persistentWriterPreserved !== true ||
    writer.writerBefore.currentUser !== 'n8n_writer' ||
    writer.writerBefore.sessionUser !== 'n8n_writer' ||
    writer.writerBefore.bindingVerified !== true ||
    writer.writerBefore.closed !== false ||
    writer.writerBefore.totalAdmitted !== 1 ||
    writer.writerAfter.currentUser !== 'n8n_writer' ||
    writer.writerAfter.sessionUser !== 'n8n_writer' ||
    writer.writerAfter.bindingVerified !== true ||
    writer.writerAfter.closed !== true ||
    writer.writerAfter.totalAdmitted !== 2 ||
    writer.writerAfter.code !== 'window_closed' ||
    owner.status !== 'inspection_verified' ||
    owner.historyBefore !== 'complete' ||
    owner.historyAfter !== 'complete' ||
    owner.bindingMatchesPriorProvision !== true ||
    archive.status !== 'archive_verified' ||
    archive.archiveAcknowledged !== true ||
    archive.archiveNativeExit !== 0 ||
    archive.fixtureArchived !== true ||
    archive.historyBefore !== 'complete' ||
    archive.historyAfter !== 'complete' ||
    archive.persistentAdminPreserved !== true
  )
    fail();
  for (const inspected of [owner.inspection, archive.archiveAfter]) {
    const w = inspected.window,
      fixture = inspected.fixture;
    if (
      inspected.identity !== true ||
      inspected.windowId !== c.windowId ||
      w.id !== c.windowId ||
      w.closeCount !== 1 ||
      w.admittedCount !== 2 ||
      typeof w.closedAt !== 'string' ||
      !Number.isFinite(Date.parse(w.closedAt)) ||
      w.audience !== attempt.setup.audience ||
      w.commitSha !== c.sourceCommitSha ||
      w.deploymentId !== attempt.setup.deploymentId ||
      inspected.approval.closed !== true ||
      inspected.approval.batchMaxUsd !== 2 ||
      inspected.approval.maxChargeUsd !== 1 ||
      [
        'activeLeaseCount',
        'actorRunCount',
        'collectedItemCount',
        'costEntryCount',
        'costUsd',
        'incompleteRequests',
        'launchCount',
        'reservedRequests',
        'scrapeRunCount',
      ].some((k) => inspected[k] !== 0) ||
      inspected.requestCount !== 1 ||
      fixture.competitorId !== 'd51a39f6-fe87-4d17-aee9-3070c45693aa' ||
      fixture.accountId !== 'bd23314c-591f-4fb7-92fd-b7450634eeb6' ||
      fixture.itemsCount !== 0 ||
      fixture.locked !== false ||
      fixture.progressPresent !== false
    )
      fail();
  }
  if (
    archive.archiveAfter.fixture.competitorArchived !== true ||
    archive.archiveAfter.fixture.accountPaused !== true ||
    archive.archiveAfter.fixture.competitorActive !== false ||
    archive.archiveAfter.fixture.accountActive !== false ||
    x.io.processAlive(attempt.clock.parentProcessId) !== false ||
    x.io.processAlive(attempt.clock.runtimeProcessId) !== false
  )
    fail();
  return Object.freeze({
    ...effectfulRecovery,
    ...closedWindowRecovery,
    closedWindow: true,
    pins: Object.freeze({ ...effectfulRecovery.pins, ...closedWindowRecovery.pins }),
  });
}
function reconciledWf00Restore(x) {
  if (!x.recovery?.closedWindow) return null;
  const text = x.file(wf00RestoreRecovery.receiptRelative),
    priorText = x.file(wf00RestoreRecovery.priorReceiptRelative),
    journal = x.file(wf00RestoreRecovery.journalRelative),
    { lines, rows } = jsonl(journal, 9);
  if (
    hash(text) !== wf00RestoreRecovery.receiptSha256 ||
    hash(priorText) !== wf00RestoreRecovery.priorReceiptSha256 ||
    hash(journal) !== wf00RestoreRecovery.journalSha256 ||
    rows.length !== 9 ||
    hash(lines.slice(0, 2).join('\n') + '\n') !== wf00RestoreRecovery.priorJournalSha256
  )
    fail();
  const receipt = JSON.parse(text),
    prior = JSON.parse(priorText),
    workflowId = 'MzimjpsuyPuK7SKe',
    priorBackup = 'fc0bdea1-f733-4c68-ba8c-f062e83b7919',
    backup = '4586bbde-add3-4376-b8b4-5200443c06d5',
    versionId = 'f5f755b7-9683-4fb6-a26d-87b001127244';
  const expectedRows = [
    {
      event: 'request',
      number: 1,
      method: 'GET',
      path: `/api/v1/workflows/${workflowId}?excludePinnedData=true`,
    },
    { event: 'backup_ready', workflowId, backupRunId: priorBackup },
    {
      event: 'restore_continuation',
      workflowId,
      priorToolReceipt: '905f06',
      priorRequestCount: 1,
      priorBackupRunId: priorBackup,
    },
    {
      event: 'request',
      number: 2,
      method: 'GET',
      path: `/api/v1/workflows/${workflowId}?excludePinnedData=true`,
    },
    { event: 'backup_ready', workflowId, backupRunId: backup },
    {
      event: 'restore_intent',
      workflowId,
      sourceCommitSha: '025c2a2c0127566df71cef77797db277f1565568',
      backupRunId: backup,
    },
    {
      event: 'request',
      number: 3,
      method: 'PUT',
      path: `/api/v1/workflows/${workflowId}?publishIfActive=false`,
    },
    {
      event: 'request',
      number: 4,
      method: 'GET',
      path: `/api/v1/workflows/${workflowId}?excludePinnedData=true`,
    },
    {
      event: 'restore_verified',
      workflowId,
      versionId,
      backupRunId: backup,
      nativeReadonlySettings: { binaryMode: 'separate' },
    },
  ];
  if (
    rows.some((row, i) => JSON.stringify(row) !== JSON.stringify(expectedRows[i])) ||
    prior.kind !== 'actual_owned_wf00_restore_attempt' ||
    prior.toolReceipt !== '905f06' ||
    prior.actual.nativeExit !== 1 ||
    prior.actual.requestCount !== 1 ||
    prior.actual.putCount !== 0 ||
    prior.actual.putAttempted !== false ||
    prior.actual.writeIntentRecorded !== false ||
    prior.actual.childClosed !== true ||
    prior.actual.networkCompletionVerified !== true ||
    prior.journal.rowCount !== 2 ||
    prior.journal.sha256 !== wf00RestoreRecovery.priorJournalSha256 ||
    receipt.kind !== 'actual_owned_wf00_restore_verified' ||
    receipt.environment !== 'dev' ||
    receipt.toolReceipt !== '87a22f' ||
    receipt.actual.version !== 1 ||
    receipt.actual.windowId !== c.windowId ||
    receipt.actual.host !== 'muhhammedsayed.app.n8n.cloud' ||
    receipt.actual.projectId !== 'pHvQjDmjxVZ3KQLT' ||
    receipt.actual.workflowId !== workflowId ||
    receipt.actual.status !== 'wf00_restore_verified' ||
    receipt.actual.nativeExit !== 0 ||
    receipt.actual.requestCount !== 3 ||
    receipt.actual.versionId !== versionId ||
    receipt.actual.backupReady !== true ||
    receipt.actual.beforeVersionPrivatelyBackedUp !== true ||
    receipt.actual.writeIntentRecorded !== true ||
    receipt.actual.putAttempted !== true ||
    receipt.actual.putAcknowledged !== true ||
    receipt.actual.exactContentVerified !== true ||
    receipt.actual.inactiveVerified !== true ||
    receipt.actual.ownerAndTagsVerified !== true ||
    receipt.actual.nativeStorageModePreserved !== true ||
    receipt.actual.childClosed !== true ||
    receipt.actual.networkCompletionVerified !== true ||
    receipt.actual.parentLockDeleted !== true ||
    receipt.actual.persistentManagementRetained !== true ||
    receipt.actual.diagnostic !== null ||
    receipt.actual.executionCount !== 0 ||
    receipt.actual.credentialsCreated !== 0 ||
    receipt.actual.gatewayWindowStarted !== false ||
    receipt.journal.path !== wf00RestoreRecovery.journalRelative ||
    receipt.journal.rowCount !== 9 ||
    receipt.journal.sha256 !== wf00RestoreRecovery.journalSha256 ||
    receipt.journal.putCount !== 1 ||
    receipt.journal.originalPrefix.rowCount !== 2 ||
    receipt.journal.originalPrefix.sha256 !== wf00RestoreRecovery.priorJournalSha256 ||
    receipt.journal.originalPrefix.byteIdentical !== true ||
    receipt.journal.continuationBackupRunId !== backup ||
    JSON.stringify(receipt.journal.requestOrdinals) !== '[1,2,3,4]' ||
    receipt.usage.beforeRestore.management !== 98 ||
    receipt.usage.beforeRestore.control !== 301 ||
    receipt.usage.beforeRestore.combined !== 399 ||
    receipt.usage.totalRestore.management !== 4 ||
    receipt.usage.totalRestore.control !== 0 ||
    receipt.usage.totalRestore.combined !== 4 ||
    receipt.usage.after.management !== 102 ||
    receipt.usage.after.control !== 301 ||
    receipt.usage.after.combined !== 403 ||
    receipt.usage.carriedManagementBefore !== x.recovery.carriedManagementAttempts ||
    receipt.usage.carriedManagementAfter !== x.recovery.carriedManagementAttempts + 4 ||
    receipt.usage.allowancesReplenished !== false ||
    receipt.cleanup.nativeExit !== 0 ||
    receipt.cleanup.acceptanceParentLockAbsent !== true ||
    receipt.cleanup.provisionMutexExclusiveOpenCloseVerified !== true ||
    receipt.acceptance.wf00RestoreVerified !== true ||
    receipt.acceptance.m03DevAcceptanceComplete !== false
  )
    fail();
  return Object.freeze({
    ...x.recovery,
    carriedManagementAttempts: x.recovery.carriedManagementAttempts + 4,
  });
}
function reconciledReadonlyPrepare(x) {
  const text = x.file(readonlyPrepareRecovery.relative, { optional: true });
  if (text === null) return null;
  // This exact attempt stopped before the Admin child could reach any SQL.
  // A newly discovered prior mutation/output invalidates that classification.
  for (const suffix of [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'reactivation-attempt',
    'unprovisioned-archive-attempt',
  ])
    if (
      x.physical(
        join(
          repo,
          `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-3-${suffix}.json`,
        ),
        true,
      )
    )
      fail();
  if (x.physical(join(repo, 'scripts/n8n/out/foundation/live/runtime.technical-3.jsonl'), true)) fail();
  if (
    hash(text) !== readonlyPrepareRecovery.sha256 ||
    !x.recovery?.closedWindow ||
    x.recovery.mainManagementAttempts !== 92 ||
    x.recovery.carriedManagementAttempts !== 10 ||
    x.recovery.mainControlAttempts !== 300
  )
    fail();
  const r = JSON.parse(text);
  if (
    r.kind !== 'm03_technical3_closed_readonly_reconciliation' ||
    r.version !== 1 ||
    r.environment !== 'dev' ||
    r.usage.mainManagement !== 117 ||
    r.usage.carriedManagement !== 10 ||
    r.usage.management !== 127 ||
    r.usage.mainControl !== 350 ||
    r.usage.carriedControl !== 1 ||
    r.usage.control !== 351 ||
    r.usage.combined !== 478 ||
    r.usage.vercelSetupUsed !== 44 ||
    r.usage.vercelSetupMaximum !== 88 ||
    r.usage.allowancesReplenished !== false ||
    r.actualSideEffects.baselineGets !== 25 ||
    r.actualSideEffects.executionDiscoveryGets !== 50 ||
    r.actualSideEffects.newHostedWritesReached !== false ||
    r.actualSideEffects.nativeExecutions !== 0 ||
    r.actualSideEffects.actorStarts !== 0 ||
    r.actualSideEffects.contentProviderCalls !== 0 ||
    r.actualCleanup.nativeExit !== 0 ||
    r.actualCleanup.bypassFilePresent !== false ||
    r.actualCleanup.acceptanceParentLockAbsent !== true ||
    r.actualCleanup.privateContentsRead !== false ||
    r.actualCleanup.persistentOriginalsUntouched !== true ||
    r.acceptance.actualM03DevAcceptanceVerified !== false ||
    r.immutableTechnicalRecords.closureVerifiedRemainsFalse !== true
  )
    fail();
  if (hash(x.file(r.frozenAttempt.path)) !== r.frozenAttempt.sha256) fail();
  const pins = { ...x.recovery.pins };
  for (const key of ['admission', 'runtimeClaim', 'closed']) {
    const p = r.immutableTechnicalRecords[key];
    if (hash(x.file(p.path)) !== p.sha256) fail();
    pins[p.path] = p.sha256;
  }
  for (const [name, retainedRows] of [
    ['management', 118],
    ['control', 350],
    ['setup', 84],
    ['preflight', 4],
    ['runtime', 50],
  ]) {
    const p = r.actualPublicJournals[name],
      current = x.file(p.path),
      parsed = jsonl(current, 8000);
    if (
      parsed.lines.length < retainedRows ||
      hash(parsed.lines.slice(0, retainedRows).join('\n') + '\n') !== p.sha256 ||
      (name === 'runtime' && current !== parsed.lines.slice(0, retainedRows).join('\n') + '\n')
    )
      fail();
    pins[p.path] = p.sha256;
  }
  return Object.freeze({
    ...x.recovery,
    mainManagementAttempts: 117,
    mainControlAttempts: 350,
    readonlyTechnicalAttempt: 3,
    pins: Object.freeze(pins),
  });
}
function reconciledNativeDiscovery(x) {
  let recovery = x.recovery;
  for (const [ordinal, checkpoint] of [
    [4, nativeDiscoveryRecovery],
    [5, nativeBrowserDiscoveryRecovery],
  ]) {
    const text = x.file(checkpoint.relative, { optional: true });
    if (text === null) {
      if (ordinal === 4 && x.file(nativeBrowserDiscoveryRecovery.relative, { optional: true }) !== null)
        fail();
      break;
    }
    recovery = reconciledNativeDiscoveryStep(x, recovery, text, checkpoint, ordinal);
  }
  return recovery === x.recovery ? null : recovery;
}
function reconciledNativeDiscoveryStep(x, recovery, text, checkpoint, ordinal) {
  const previousMainControl = ordinal === 4 ? 350 : 351;
  if (
    hash(text) !== checkpoint.sha256 ||
    recovery?.readonlyTechnicalAttempt !== 3 ||
    (ordinal === 5 && recovery.nativeDiscoveryTechnicalAttempt !== 4) ||
    recovery.mainManagementAttempts !== 117 ||
    recovery.carriedManagementAttempts !== 10 ||
    recovery.mainControlAttempts !== previousMainControl
  )
    fail();
  const mainControl = previousMainControl + 1;
  const base = `scripts/n8n/out/foundation/live/project-verified-continuation-${c.segmentId}.technical-${ordinal}`;
  for (const suffix of [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'reactivation-attempt',
    'unprovisioned-archive-attempt',
  ])
    if (
      x.physical(
        join(
          repo,
          `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-${ordinal}-${suffix}.json`,
        ),
        true,
      )
    )
      fail();
  if (x.physical(join(repo, `scripts/n8n/out/foundation/live/runtime.technical-${ordinal}.jsonl`), true))
    fail();
  const r = JSON.parse(text);
  if (
    r.kind !==
      (ordinal === 4
        ? 'm03_technical4_closed_native_discovery_reconciliation'
        : 'm03_technical5_closed_browser_discovery_reconciliation') ||
    r.version !== 1 ||
    r.environment !== 'dev' ||
    r.usage.mainManagement !== 117 ||
    r.usage.carriedManagement !== 10 ||
    r.usage.management !== 127 ||
    r.usage.mainControl !== mainControl ||
    r.usage.carriedControl !== 1 ||
    r.usage.control !== mainControl + 1 ||
    r.usage.combined !== 127 + mainControl + 1 ||
    r.usage.vercelSetupUsed !== 44 ||
    r.usage.vercelSetupMaximum !== 88 ||
    r.usage.allowancesReplenished !== false ||
    r.actualFailure.phase !== 'early_native_discovery' ||
    (ordinal === 4
      ? r.actualFailure.toolResultIsError !== true
      : r.actualFailure.executionSource !== 'browser_ui' ||
        r.actualFailure.statusCode !== 'FOUNDATION_NATIVE_UI_BLOCKED' ||
        r.actualFailure.browserAcknowledgementAccepted !== false ||
        r.actualFailure.protocolCloseReceiptProduced !== true ||
        r.actualFailure.protocolResidual !== false) ||
    r.actualFailure.nativeExecutions !== 0 ||
    r.actualFailure.actorStarts !== 0 ||
    r.actualFailure.baselineGets !== 0 ||
    r.actualFailure.administrativePrivateRead !== false ||
    r.actualFailure.administrativeAuthenticationAttempted !== false ||
    r.actualFailure.newPreviewRequests !== 0 ||
    r.actualFailure.newWorkflowWrites !== 0 ||
    r.actualFailure.newDatabaseOrFixtureWrites !== 0 ||
    r.actualCleanup.nativeExit !== 0 ||
    r.actualCleanup.bothProcessesDead !== true ||
    r.actualCleanup.parentLockAbsent !== true ||
    r.actualCleanup.bypassAbsent !== true ||
    r.actualCleanup.contentsRead !== false ||
    r.actualCleanup.networkRequests !== 0 ||
    r.actualCleanup.persistentOriginalsUntouched !== true ||
    r.acceptance.actualM03DevAcceptanceVerified !== false ||
    r.acceptance.successfulNativeDiscoveryVerified !== false ||
    r.immutableTechnicalRecords.closureVerifiedRemainsFalse !== true ||
    r.immutableTechnicalRecords.bypassHandoffDeletedRemainsFalse !== true
  )
    fail();
  const pins = { ...recovery.pins };
  for (const [key, suffix] of [
    ['admission', '.json'],
    ['runtimeClaim', '.runtime-claim.json'],
    ['closed', '.closed.json'],
  ]) {
    const p = r.immutableTechnicalRecords[key];
    if (p.path !== base + suffix || hash(x.file(p.path)) !== p.sha256) fail();
    pins[p.path] = p.sha256;
  }
  const admission = JSON.parse(x.file(base + '.json')),
    closed = JSON.parse(x.file(base + '.closed.json'));
  if (
    closed.closureVerified !== false ||
    closed.bypassHandoffDeleted !== false ||
    r.actualCleanup.closedReceiptSha256 !== pins[base + '.closed.json']
  )
    fail();
  for (const [name, retainedRows] of [
    ['management', 118],
    ['control', mainControl],
    ['setup', 84],
    ['preflight', 4],
    ['runtime', 50],
  ]) {
    const path = `scripts/n8n/out/foundation/live/${name}.jsonl`,
      p = r.actualPublicJournals[name];
    if (p.path !== path) fail();
    const current = x.file(path),
      parsed = jsonl(current, 8000);
    if (
      parsed.lines.length < retainedRows ||
      hash(parsed.lines.slice(0, retainedRows).join('\n') + '\n') !== p.sha256 ||
      (name === 'runtime' && current !== parsed.lines.slice(0, retainedRows).join('\n') + '\n')
    )
      fail();
    if (name === 'control') {
      const last = parsed.rows[mainControl - 1],
        at = Date.parse(last.at);
      if (
        !exact(last, ['event', 'ordinal', 'kind', 'workflowId', 'at']) ||
        last.event !== 'control_request_intent' ||
        last.ordinal !== mainControl ||
        last.kind !== 'discovery' ||
        last.workflowId !== 'MzimjpsuyPuK7SKe' ||
        !Number.isFinite(at) ||
        at < admission.startsAt ||
        at > closed.closedAt
      )
        fail();
    } else if (p.sha256 !== recovery.pins[path]) fail();
    pins[path] = p.sha256;
  }
  return Object.freeze({
    ...recovery,
    mainControlAttempts: mainControl,
    nativeDiscoveryTechnicalAttempt: ordinal,
    pins: Object.freeze(pins),
  });
}
function assertSetupAllocationApproval(x) {
  const maximum = priorActiveRuntime.setupMaximum;
  if (maximum === 50) return;
  if (maximum !== 88) fail();
  const text = x.file(setupAllocationApproval.relative);
  if (hash(text) !== setupAllocationApproval.sha256) fail();
  const a = JSON.parse(text);
  if (
    a.kind !== 'm03_cumulative_vercel_allocation_approval' ||
    a.questionCallId !== 'call_9bd1dfd31b95479381b5bc036dfa1925' ||
    a.ownerReply !== 'Approve cumulative88; keep44 charged' ||
    a.decision !== 'approved' ||
    a.environment !== 'dev' ||
    a.milestone !== 'M03' ||
    a.allocation.previousSetupMaximum !== 50 ||
    a.allocation.setupMaximum !== maximum ||
    a.allocation.usedSetupRequests !== 44 ||
    // This historical decision stays at44. The separately pinned technical8
    // reconciliation and newer allocation prove its later79 charged requests.
    (x.recovery.closedFixtureTechnicalAttempt !== 8 &&
      a.allocation.usedSetupRequests !== x.recovery.setupAttempts) ||
    a.allocation.additionalSetupRequestsMaximum !== 44 ||
    a.allocation.countersReset !== false ||
    a.unchangedGlobalCaps.management !== caps.runtimeManagement ||
    a.unchangedGlobalCaps.control !== caps.control ||
    a.unchangedGlobalCaps.combined !== caps.combined ||
    a.unchangedGlobalCaps.nativeExecutions !== caps.nativeExecutions ||
    a.unchangedGlobalCaps.gatewayAttempts !== caps.gatewayAttempts ||
    a.unchangedGlobalCaps.directProviderReads !== caps.providerGetAttempts ||
    a.unchangedGlobalCaps.actorStarts !== caps.actorStarts ||
    a.unchangedGlobalCaps.maxActorUsd !== caps.requestedUsdEachActor ||
    a.unchangedGlobalCaps.actorReserveUsd !== caps.actorReserveUsd ||
    a.unchangedGlobalCaps.actorsSequential !== true ||
    a.unchangedGlobalCaps.newDistinctCollectedItems !== 1 ||
    // The owner record pins usage at the decision, not later charged reads.
    a.actualPriorUsage.management !== 102 ||
    a.actualPriorUsage.control !== 301 ||
    a.actualPriorUsage.combined !== 403 ||
    a.actualPriorUsage.carriedManagement !== 10 ||
    a.actualPriorUsage.actorStarts !== 0 ||
    a.actualPriorUsage.actorSpendUsd !== 0 ||
    a.actualPriorUsage.receiptPath !== wf00RestoreRecovery.receiptRelative ||
    a.actualPriorUsage.receiptSha256 !== wf00RestoreRecovery.receiptSha256 ||
    Object.values(a.limitsPreserved).some((v) => v !== true) ||
    Object.values(a.boundaries).some((v) => v !== false) ||
    a.acceptance.allocationDecisionComplete !== true ||
    a.acceptance.executionStartedByThisRecord !== false ||
    a.acceptance.m03DevAcceptanceVerified !== false
  )
    fail();
}
function reconciledBaselineDiscovery(x) {
  const text = x.file(baselineDiscoveryRecovery.relative, { optional: true });
  if (text === null) return null;
  if (
    hash(text) !== baselineDiscoveryRecovery.sha256 ||
    x.recovery?.nativeDiscoveryTechnicalAttempt !== 5 ||
    x.recovery.mainManagementAttempts !== 117 ||
    x.recovery.carriedManagementAttempts !== 10 ||
    x.recovery.mainControlAttempts !== 352
  )
    fail();
  const r = JSON.parse(text);
  if (
    r.kind !== 'm03_technical6_closed_baseline_discovery_reconciliation' ||
    r.version !== 1 ||
    r.environment !== 'dev' ||
    r.usage.mainManagement !== 142 ||
    r.usage.carriedManagement !== 10 ||
    r.usage.management !== 152 ||
    r.usage.mainControl !== 381 ||
    r.usage.carriedControl !== 1 ||
    r.usage.control !== 382 ||
    r.usage.combined !== 534 ||
    r.usage.vercelSetupUsed !== 44 ||
    r.usage.vercelSetupMaximum !== 88 ||
    r.usage.allowancesReplenished !== false ||
    r.actualFailure.phase !== 'baseline_execution_discovery' ||
    r.actualFailure.lastWorkflowKey !== 'WF-70' ||
    r.actualFailure.readerCodeRecorded !== false ||
    r.actualFailure.httpStatusRecorded !== false ||
    r.actualFailure.browserAcknowledgementAccepted !== true ||
    r.actualFailure.baselineSourceGets !== 25 ||
    r.actualFailure.executionDiscoveryAttempts !== 28 ||
    r.actualFailure.browserDiscoveryAttempts !== 1 ||
    r.actualFailure.newControlAttempts !== 29 ||
    r.actualFailure.nativeExecutions !== 0 ||
    r.actualFailure.actorStarts !== 0 ||
    r.actualFailure.administrativePrivateRead !== false ||
    r.actualFailure.administrativeAuthenticationAttempted !== false ||
    r.actualFailure.newPreviewRequests !== 0 ||
    r.actualFailure.newWorkflowWrites !== 0 ||
    r.actualFailure.newDatabaseOrFixtureWrites !== 0 ||
    r.actualCleanup.nativeExit !== 0 ||
    r.actualCleanup.bothProcessesDead !== true ||
    r.actualCleanup.parentLockAbsent !== true ||
    r.actualCleanup.adminSessionLockExclusive !== true ||
    r.actualCleanup.unusedAdminPasswordAbsent !== true ||
    r.actualCleanup.unusedAdminLeaseAbsent !== true ||
    r.actualCleanup.bypassAbsent !== true ||
    r.actualCleanup.cleanupLockRemoved !== true ||
    r.actualCleanup.contentsRead !== false ||
    r.actualCleanup.networkRequests !== 0 ||
    r.actualCleanup.persistentOriginalsUntouched !== true ||
    r.acceptance.actualM03DevAcceptanceVerified !== false ||
    r.acceptance.executionBaselineComplete !== false ||
    r.acceptance.fullDVerified !== false ||
    r.immutableTechnicalRecords.closureVerifiedRemainsFalse !== true ||
    r.immutableTechnicalRecords.bypassHandoffDeletedRemainsFalse !== true
  )
    fail();
  const base = `scripts/n8n/out/foundation/live/project-verified-continuation-${c.segmentId}.technical-6`;
  for (const suffix of [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'reactivation-attempt',
    'unprovisioned-archive-attempt',
  ])
    if (
      x.physical(
        join(
          repo,
          `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-6-${suffix}.json`,
        ),
        true,
      )
    )
      fail();
  if (x.physical(join(repo, 'scripts/n8n/out/foundation/live/runtime.technical-6.jsonl'), true)) fail();
  const pins = { ...x.recovery.pins };
  for (const [key, suffix] of [
    ['admission', '.json'],
    ['runtimeClaim', '.runtime-claim.json'],
    ['closed', '.closed.json'],
  ]) {
    const p = r.immutableTechnicalRecords[key];
    if (p.path !== base + suffix || hash(x.file(p.path)) !== p.sha256) fail();
    pins[p.path] = p.sha256;
  }
  const admission = JSON.parse(x.file(base + '.json')),
    closed = JSON.parse(x.file(base + '.closed.json'));
  if (
    closed.closureVerified !== false ||
    closed.bypassHandoffDeleted !== false ||
    r.actualCleanup.closedReceiptSha256 !== pins[base + '.closed.json']
  )
    fail();
  for (const [name, count] of [
    ['management', 143],
    ['control', 382],
    ['setup', 84],
    ['preflight', 4],
    ['runtime', 50],
  ]) {
    const path = `scripts/n8n/out/foundation/live/${name}.jsonl`,
      p = r.actualPublicJournals[name];
    if (p.path !== path) fail();
    const current = x.file(path),
      parsed = jsonl(current, 8000),
      prefix = parsed.lines.slice(0, count).join('\n') + '\n';
    if (parsed.rows.length < count || hash(prefix) !== p.sha256 || (name === 'runtime' && current !== prefix))
      fail();
    if (name === 'management') {
      const added = parsed.rows.slice(118, 143);
      if (
        added.length !== 25 ||
        added.some(
          (row, index) =>
            !exact(row, ['event', 'ordinal']) ||
            row.event !== 'management_attempt' ||
            row.ordinal !== 118 + index,
        )
      )
        fail();
    } else if (name === 'control') {
      const added = parsed.rows.slice(352, 382);
      const expectedIds = [
        'MzimjpsuyPuK7SKe',
        '4JMHLDBSdgGxhPlk',
        'Oq19AMI9C3B1wbo9',
        '8pz1lF0xPDQCs3ab',
        'F7S8Llr0ZSaSuw4T',
        'VbJn4mLYm0sGy1X2',
        'h6lUXSGN5sV2jxuQ',
        '02yefa9uEPYwmM3N',
        '83LybyawRpHXbjx6',
        'qzgT9giRQJ7eMDmV',
        'mySfLZbU7I1850uP',
        'kkAGgnbD8NjWHMKC',
        'ze8T1o0Cx0OGi3Wd',
        '2U6nPs3uJkmjij82',
        'S6KDFsx5IjQRf6tm',
      ];
      if (added.length !== 30) fail();
      for (let index = 0; index < added.length; index++) {
        const row = added[index],
          at = Date.parse(row.at);
        if (!Number.isFinite(at) || at < admission.startsAt || at > closed.closedAt) fail();
        if (index === 1) {
          if (
            !exact(row, ['event', 'kind', 'workflowId', 'at']) ||
            row.event !== 'browser_port_preflight_verified' ||
            row.kind !== 'browser_ui' ||
            row.workflowId !== expectedIds[0]
          )
            fail();
        } else {
          const ordinal = index === 0 ? 353 : 352 + index,
            id = index === 0 ? expectedIds[0] : expectedIds[1 + Math.floor((index - 2) / 2)];
          if (
            !exact(row, ['event', 'ordinal', 'kind', 'workflowId', 'at']) ||
            row.event !== 'control_request_intent' ||
            row.kind !== 'discovery' ||
            row.ordinal !== ordinal ||
            row.workflowId !== id
          )
            fail();
        }
      }
    } else if (p.sha256 !== x.recovery.pins[path]) fail();
    pins[path] = p.sha256;
  }
  return Object.freeze({
    ...x.recovery,
    mainManagementAttempts: 142,
    mainControlAttempts: 381,
    controlRows: 382,
    baselineDiscoveryTechnicalAttempt: 6,
    pins: Object.freeze(pins),
  });
}
function reconciledWf70Diagnostic(x) {
  const text = x.file(wf70DiagnosticRecovery.relative, { optional: true });
  const journalText = x.file(wf70DiagnosticRecovery.journalRelative, { optional: true });
  if (text === null && journalText === null) {
    if (x.recovery?.baselineDiscoveryTechnicalAttempt === 6) fail();
    return null;
  }
  if (
    text === null ||
    journalText === null ||
    hash(text) !== wf70DiagnosticRecovery.sha256 ||
    hash(journalText) !== wf70DiagnosticRecovery.journalSha256 ||
    x.recovery?.baselineDiscoveryTechnicalAttempt !== 6 ||
    x.recovery.mainManagementAttempts !== 142 ||
    x.recovery.carriedManagementAttempts !== 10 ||
    x.recovery.mainControlAttempts !== 381 ||
    x.recovery.carriedControlAttempts !== 1 ||
    x.recovery.controlRows !== 382
  )
    fail();
  const r = JSON.parse(text),
    result = r.actualNativeResult,
    usage = r.usage,
    custody = r.durableUsageJournal,
    cleanup = r.independentCleanupReadback;
  if (
    r.kind !== 'm03_wf70_bounded_discovery_readback' ||
    r.version !== 1 ||
    r.environment !== 'dev' ||
    r.originalFailure.receiptPath !== baselineDiscoveryRecovery.relative ||
    r.originalFailure.receiptSha256 !== baselineDiscoveryRecovery.sha256 ||
    r.originalFailure.historicalAttemptRewritten !== false ||
    r.originalFailure.exactHistoricalReaderCodeKnown !== false ||
    r.originalFailure.exactHistoricalHttpStatusKnown !== false ||
    result.status !== 'complete' ||
    result.outerNativeExit !== 0 ||
    result.nativeExit !== 0 ||
    result.childClosed !== true ||
    result.handoffDeleted !== true ||
    result.host !== 'muhhammedsayed.app.n8n.cloud' ||
    result.configuredProjectId !== 'pHvQjDmjxVZ3KQLT' ||
    result.workflowKey !== 'WF-70' ||
    result.workflowId !== 'S6KDFsx5IjQRf6tm' ||
    result.discoveryStatus !== 'discovery_complete' ||
    result.requestCount !== 2 ||
    result.maximumRequests !== 4 ||
    result.authenticationVerified !== true ||
    result.paginationComplete !== true ||
    result.candidateCount !== 0 ||
    result.readerFailure !== null ||
    result.networkCompletionVerified !== true ||
    result.adoptionProven !== false ||
    result.drainProven !== false ||
    !Array.isArray(result.requests) ||
    result.requests.length !== 2 ||
    result.requests.some(
      (row, i) =>
        row.filter !== ['all', 'running'][i] ||
        row.page !== 1 ||
        row.tcpConnected !== true ||
        row.tlsVerified !== true ||
        row.httpStatus !== 200 ||
        row.bodyRead !== 'complete' ||
        row.jsonParsed !== true ||
        row.schemaValidated !== true ||
        row.socketClosed !== true ||
        row.failureStage !== 'none' ||
        row.failureCode !== 'none',
    ) ||
    custody.path !== wf70DiagnosticRecovery.journalRelative ||
    custody.sha256 !== wf70DiagnosticRecovery.journalSha256 ||
    custody.rowCount !== 4 ||
    custody.headerBeforePrivateMetadata !== true ||
    custody.intentSyncedBeforeEachGet !== true ||
    JSON.stringify(custody.controlOrdinals) !== '[383,384]' ||
    custody.oneUseFenceRetained !== true ||
    custody.originalLiveJournalsUnchanged !== true ||
    cleanup.parentProcessDead !== true ||
    cleanup.childProcessDead !== true ||
    cleanup.parentOperationLockAbsent !== true ||
    cleanup.temporaryManagementCopyAbsent !== true ||
    cleanup.persistentManagementOriginalPresent !== true ||
    cleanup.allFourPersistentEntriesReady !== true ||
    cleanup.credentialContentsReadByCleanupCheck !== false ||
    usage.management !== 152 ||
    usage.control !== 384 ||
    usage.combined !== 536 ||
    usage.diagnosticControlAttempts !== 2 ||
    usage.vercelSetupUsed !== 44 ||
    usage.vercelSetupMaximum !== 88 ||
    usage.nativeExecutions !== 0 ||
    usage.gatewayPreflightAttempts !== 2 ||
    usage.providerDirectAttempts !== 0 ||
    usage.actorStarts !== 0 ||
    usage.actorReserveUsd !== 2 ||
    usage.managementMaximum !== 512 ||
    usage.controlMaximum !== 2048 ||
    usage.combinedMaximum !== 2560 ||
    usage.countersReset !== false ||
    r.interpretation.historicalFailureCauseEstablished !== false ||
    r.interpretation.newWorkflowExecutionOrRemoteWrite !== false ||
    r.interpretation.actualM03DevAcceptanceVerified !== false ||
    r.interpretation.fullDVerified !== false ||
    r.interpretation.managementAllocationIncreaseApproved !== false ||
    r.interpretation.newAcceptanceAdmissionBlockedByCurrent512 !== true
  )
    fail();
  const parsed = jsonl(journalText, 4),
    [header, claim, ...intents] = parsed.rows;
  if (
    parsed.rows.length !== 4 ||
    !exact(header, [
      'kind',
      'version',
      'receiptSha256',
      'managementAttempts',
      'controlAttempts',
      'combinedAttempts',
      'maximumRequests',
      'parentProcessId',
    ]) ||
    header.kind !== 'm03_wf70_discovery_budget' ||
    header.version !== 1 ||
    header.receiptSha256 !== baselineDiscoveryRecovery.sha256 ||
    header.managementAttempts !== 152 ||
    header.controlAttempts !== 382 ||
    header.combinedAttempts !== 534 ||
    header.maximumRequests !== 4 ||
    !positive(header.parentProcessId) ||
    header.parentProcessId !== custody.parentProcessId ||
    !exact(claim, ['event', 'processId']) ||
    claim.event !== 'diagnostic_child_claim' ||
    !positive(claim.processId) ||
    claim.processId !== custody.childProcessId ||
    claim.processId === header.parentProcessId ||
    x.io.processAlive(header.parentProcessId) !== false ||
    x.io.processAlive(claim.processId) !== false
  )
    fail();
  const closed = JSON.parse(
    x.file(
      `scripts/n8n/out/foundation/live/project-verified-continuation-${c.segmentId}.technical-6.closed.json`,
    ),
  );
  const recordedAt = Date.parse(r.recordedAt);
  if (!Number.isFinite(recordedAt) || recordedAt > x.clock()) fail();
  for (const [i, row] of intents.entries()) {
    const at = Date.parse(row.at);
    if (
      !exact(row, ['event', 'ordinal', 'diagnosticOrdinal', 'kind', 'workflowKey', 'at']) ||
      row.event !== 'control_request_intent' ||
      row.ordinal !== 383 + i ||
      row.diagnosticOrdinal !== i + 1 ||
      row.kind !== 'discovery' ||
      row.workflowKey !== 'WF-70' ||
      !Number.isFinite(at) ||
      at < closed.closedAt ||
      at > recordedAt
    )
      fail();
  }
  return Object.freeze({ ...x.recovery, carriedControlAttempts: 3, wf70DiagnosticControlAttempts: 2 });
}
function approvedControlManagementAllocation(x) {
  if (x.recovery?.closedFixtureTechnicalAttempt !== 8) return null;
  if (!controlManagementAllocationApproval) fail();
  const text = x.file(controlManagementAllocationApproval.relative);
  if (
    hash(text) !== controlManagementAllocationApproval.sha256 ||
    hash(x.file(controlManagementAllocationApproval.packetRelative)) !==
      controlManagementAllocationApproval.packetSha256
  )
    fail();
  const a = JSON.parse(text),
    allocation = a.allocation;
  if (
    a.kind !== 'm03_cumulative_control_management_allocation_approval' ||
    a.questionCallId !== 'call_66a364df504149ee99f2b0cb28876975' ||
    a.ownerReply !==
      'Approve cumulative Management 640 and Vercel 132; retain all charges and other limits' ||
    a.decision !== 'approved' ||
    a.environment !== 'dev' ||
    a.milestone !== 'M03' ||
    !Number.isFinite(Date.parse(a.recordedAt)) ||
    Date.parse(a.recordedAt) > x.clock() ||
    a.referencePacket.path !== controlManagementAllocationApproval.packetRelative ||
    a.referencePacket.sha256 !== controlManagementAllocationApproval.packetSha256 ||
    a.referencePacket.sourceCommitSha !== '8ee16f6d05041ee8b8927b95452431f3ccb5643a' ||
    a.reviewedDelivery.headSha !== a.referencePacket.sourceCommitSha ||
    a.reviewedDelivery.ciRunId !== 40043938844 ||
    ['quality', 'unit', 'build', 'e2e', 'dbTests', 'vercel'].some(
      (k) => a.reviewedDelivery[k] !== 'success',
    ) ||
    allocation.previousManagementMaximum !== 576 ||
    allocation.managementMaximum !== 640 ||
    allocation.usedManagementRequests !== 237 ||
    allocation.remainingManagementRequestsMaximum !== 403 ||
    allocation.remainingPlanMaximum !== 376 ||
    allocation.planCumulativeMaximum !== 613 ||
    allocation.reserveAbovePlan !== 27 ||
    allocation.previousVercelMaximum !== 88 ||
    allocation.vercelMaximum !== 132 ||
    allocation.usedVercelRequests !== 79 ||
    allocation.remainingVercelRequestsMaximum !== 53 ||
    allocation.remainingVercelPlanMaximum !== 44 ||
    allocation.vercelPlanCumulativeMaximum !== 123 ||
    allocation.vercelReserveAbovePlan !== 9 ||
    allocation.vercelIncludedInManagement !== true ||
    allocation.countersReset !== false ||
    a.actualPriorUsage.management !== 237 ||
    a.actualPriorUsage.control !== 486 ||
    a.actualPriorUsage.combined !== 723 ||
    a.actualPriorUsage.vercel !== 79 ||
    a.actualPriorUsage.sqlFamilyAdmitted !== 3 ||
    a.actualPriorUsage.actorStarts !== 0 ||
    a.actualPriorUsage.actorSpendUsd !== 0 ||
    a.actualPriorUsage.reconciliationPath !== closedFixtureRecovery.relative ||
    a.actualPriorUsage.reconciliationSha256 !== closedFixtureRecovery.sha256 ||
    a.approvedFreshWindow.id !== foundationProjectVerifiedActiveRuntime.windowId ||
    a.approvedFreshWindow.registered !== false ||
    a.approvedFreshWindow.usesExistingOwnerRegistration !== true ||
    a.approvedFreshWindow.changesExistingClosedRows !== false ||
    a.approvedFreshWindow.replenishesFamilyAllowances !== false ||
    a.unchangedCaps.control !== caps.control ||
    a.unchangedCaps.combined !== caps.combined ||
    a.unchangedCaps.nativeExecutions !== caps.nativeExecutions ||
    a.unchangedCaps.gatewayAttempts !== caps.gatewayAttempts ||
    a.unchangedCaps.directProviderReads !== caps.providerGetAttempts ||
    a.unchangedCaps.actorStarts !== 2 ||
    a.unchangedCaps.maxActorUsd !== 1 ||
    a.unchangedCaps.actorReserveUsd !== 2 ||
    a.unchangedCaps.actorsSequential !== true ||
    a.unchangedCaps.newDistinctCollectedItems !== 1 ||
    Object.values(a.limitsPreserved).some((v) => v !== true) ||
    Object.values(a.boundaries).some((v) => v !== false) ||
    a.acceptance.allocationDecisionComplete !== true ||
    a.acceptance.executionStartedByThisRecord !== false ||
    a.acceptance.consumerIntegrationVerified !== false ||
    a.acceptance.m03DevAcceptanceVerified !== false ||
    x.recovery.mainManagementAttempts !== 227 ||
    x.recovery.carriedManagementAttempts !== 10 ||
    x.recovery.mainControlAttempts !== 483 ||
    x.recovery.carriedControlAttempts !== 3 ||
    x.recovery.setupAttempts !== 79
  )
    fail();
  return Object.freeze({ ...x.recovery, managementMaximum: 640 });
}
function approvedManagementAllocation(x) {
  const text = x.file(managementAllocationApproval.relative, { optional: true });
  if (text === null) return null;
  if (
    hash(text) !== managementAllocationApproval.sha256 ||
    hash(x.file(managementAllocationApproval.packetRelative)) !== managementAllocationApproval.packetSha256 ||
    x.recovery?.baselineDiscoveryTechnicalAttempt !== 6 ||
    x.recovery.wf70DiagnosticControlAttempts !== 2 ||
    x.recovery.mainManagementAttempts !== 142 ||
    x.recovery.carriedManagementAttempts !== 10 ||
    x.recovery.mainControlAttempts !== 381 ||
    x.recovery.carriedControlAttempts !== 3 ||
    x.recovery.setupAttempts !== 44
  )
    fail();
  const a = JSON.parse(text),
    allocation = a.allocation;
  const recordedAt = Date.parse(a.recordedAt);
  if (!Number.isFinite(recordedAt) || recordedAt > x.clock()) fail();
  if (
    a.kind !== 'm03_cumulative_management_allocation_approval' ||
    a.questionCallId !== 'call_bab43b11555c42afbb61ecb2bc4bfe30' ||
    a.ownerReply !== 'Approve cumulative management 576; retain 152 charged' ||
    a.decision !== 'approved' ||
    a.environment !== 'dev' ||
    a.milestone !== 'M03' ||
    a.referencePacket.path !== managementAllocationApproval.packetRelative ||
    a.referencePacket.sha256 !== managementAllocationApproval.packetSha256 ||
    a.referencePacket.sourceCommitSha !== '0bb85989e0996e3844817bbe1d08e8e376afeb4d' ||
    allocation.previousManagementMaximum !== 512 ||
    allocation.managementMaximum !== 576 ||
    allocation.usedManagementRequests !== 152 ||
    allocation.remainingManagementRequestsMaximum !== 424 ||
    allocation.remainingPlanMaximum !== 376 ||
    allocation.planCumulativeMaximum !== 528 ||
    allocation.reserveAbovePlan !== 48 ||
    allocation.countersReset !== false ||
    a.actualPriorUsage.management !== 152 ||
    a.actualPriorUsage.control !== 384 ||
    a.actualPriorUsage.combined !== 536 ||
    a.actualPriorUsage.vercel !== 44 ||
    a.actualPriorUsage.actorStarts !== 0 ||
    a.actualPriorUsage.actorSpendUsd !== 0 ||
    a.actualPriorUsage.reconciliationPath !== baselineDiscoveryRecovery.relative ||
    a.actualPriorUsage.reconciliationSha256 !== baselineDiscoveryRecovery.sha256 ||
    a.actualPriorUsage.diagnosticPath !== wf70DiagnosticRecovery.relative ||
    a.actualPriorUsage.diagnosticSha256 !== wf70DiagnosticRecovery.sha256 ||
    a.unchangedCaps.control !== caps.control ||
    a.unchangedCaps.combined !== caps.combined ||
    a.unchangedCaps.vercel !== 88 ||
    a.unchangedCaps.nativeExecutions !== caps.nativeExecutions ||
    a.unchangedCaps.gatewayAttempts !== caps.gatewayAttempts ||
    a.unchangedCaps.directProviderReads !== caps.providerGetAttempts ||
    a.unchangedCaps.actorStarts !== 2 ||
    a.unchangedCaps.maxActorUsd !== 1 ||
    a.unchangedCaps.actorReserveUsd !== 2 ||
    a.unchangedCaps.actorsSequential !== true ||
    a.unchangedCaps.newDistinctCollectedItems !== 1 ||
    Object.values(a.limitsPreserved).some((v) => v !== true) ||
    Object.values(a.boundaries).some((v) => v !== false) ||
    a.acceptance.allocationDecisionComplete !== true ||
    a.acceptance.executionStartedByThisRecord !== false ||
    a.acceptance.m03DevAcceptanceVerified !== false
  )
    fail();
  return Object.freeze({ ...x.recovery, managementMaximum: 576 });
}
function reconciledClosedPreparation(x) {
  if (!closedPreparationRecovery || x.recovery?.managementMaximum !== 576) return null;
  const text = x.file(closedPreparationRecovery.relative);
  if (
    hash(text) !== closedPreparationRecovery.sha256 ||
    x.recovery.wf70DiagnosticControlAttempts !== 2 ||
    x.recovery.mainManagementAttempts !== 142 ||
    x.recovery.mainControlAttempts !== 381 ||
    x.recovery.carriedManagementAttempts !== 10 ||
    x.recovery.carriedControlAttempts !== 3 ||
    x.recovery.controlRows !== 382
  )
    fail();
  const r = JSON.parse(text),
    a = r.administrativeResult,
    cleanup = r.actualCleanup,
    readback = r.independentHostedReadback;
  const recordedAt = Date.parse(r.recordedAt);
  if (
    r.kind !== 'm03_technical7_closed_preparation_reconciliation' ||
    r.version !== 1 ||
    r.environment !== 'dev' ||
    r.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    !Number.isFinite(recordedAt) ||
    recordedAt > x.clock() ||
    r.source.head !== '16d30fd13581516c8310ae9803cfb13e23204228' ||
    r.source.applicationSource !== priorActiveRuntime.sourceCommitSha ||
    r.source.ciRun !== 40039419304 ||
    r.source.allFiveCiJobsPassed !== true ||
    r.source.vercelPassed !== true
  )
    fail();
  const expectedUsage = {
    mainManagement: 167,
    carriedManagement: 10,
    management: 177,
    mainControl: 432,
    carriedControl: 3,
    control: 435,
    combined: 612,
    vercelSetupUsed: 44,
    vercelSetupMaximum: 88,
    managementMaximum: 576,
    controlMaximum: 2048,
    combinedMaximum: 2560,
    gatewayPreflightAttempts: 2,
    actorStarts: 0,
    maxActorUsd: 1,
    actorReserveUsd: 2,
    allowancesReplenished: false,
  };
  if (Object.entries(expectedUsage).some(([key, value]) => r.usage[key] !== value)) fail();
  const expectedFailure = {
    phase: 'after_administrative_preflight_command_before_setup_prepare',
    exactCaughtErrorRetained: false,
    baselineSourceGets: 25,
    executionDiscoveryAttempts: 50,
    browserDiscoveryAttempts: 1,
    newManagementAttempts: 25,
    newControlAttempts: 51,
    nativeExecutions: 0,
    actorStarts: 0,
    newPreviewRequests: 0,
    newWorkflowWrites: 0,
    newDatabaseOrFixtureWrites: 0,
  };
  if (Object.entries(expectedFailure).some(([key, value]) => r.actualFailure[key] !== value)) fail();
  for (const key of [
    'bothProcessesDead',
    'parentLockAbsent',
    'runtimeLockAbsent',
    'allEightRuntimeInputFilesAbsent',
    'bypassAbsent',
    'cleanupLockRemoved',
    'persistentOriginalsUntouched',
  ])
    if (cleanup[key] !== true) fail();
  if (
    cleanup.nativeExit !== 0 ||
    cleanup.contentsRead !== false ||
    cleanup.decrypted !== false ||
    cleanup.networkRequests !== 0 ||
    r.immutableTechnicalRecords.closedReceiptNotRewritten !== true ||
    r.immutableTechnicalRecords.closureVerifiedRemainsFalse !== true ||
    r.immutableTechnicalRecords.bypassHandoffDeletedRemainsFalse !== true ||
    r.acceptance.actualM03DevAcceptanceVerified !== false ||
    r.acceptance.fullDVerified !== false
  )
    fail();
  for (const key of ['all25SavedWorkflowBaselineVerified', 'executionBaselineComplete', 'postchecksVerified'])
    if (r.acceptance[key] !== true) fail();
  const expectedProtocol = {
    status: 'closed',
    childTransportsClosed: true,
    adminChildClosed: true,
    residual: false,
    windowClosed: false,
    fixtureArchived: false,
    baselineRestored: false,
    environmentCleanupVerified: false,
    remoteWorkSettled: false,
  };
  if (
    Object.entries(expectedProtocol).some(([key, value]) => r.protocolClose[key] !== value) ||
    r.wrapperClose.nativeExit !== 1 ||
    r.wrapperClose.childClosed !== true ||
    r.wrapperClose.credentialChildrenClosed !== true ||
    r.wrapperClose.handoffsDeleted !== true ||
    r.wrapperClose.bypassHandoffDeleted !== false ||
    r.wrapperClose.pendingMachinePreserved !== true ||
    r.wrapperClose.emergencyShutdown !== false
  )
    fail();
  const base = `scripts/n8n/out/foundation/live/project-verified-continuation-${c.segmentId}.technical-7`,
    db = `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-7`;
  const absent = [
    ...['owner-provision-attempt', 'reactivation-attempt', 'unprovisioned-archive-attempt'].map(
      (suffix) => db + '-' + suffix + '.json',
    ),
    'scripts/n8n/out/foundation/live/runtime.technical-7.jsonl',
  ];
  if (
    !Array.isArray(r.absentSideEffectOutputs) ||
    JSON.stringify(r.absentSideEffectOutputs) !== JSON.stringify(absent) ||
    absent.some((path) => x.physical(join(repo, path), true))
  )
    fail();
  const pins = { ...x.recovery.pins };
  const pin = (path, expected) => {
    const value = x.file(path);
    if (hash(value) !== expected) fail();
    pins[path] = expected;
    return value;
  };
  const raw = {};
  for (const [key, suffix] of [
    ['admission', '.json'],
    ['runtimeClaim', '.runtime-claim.json'],
    ['closed', '.closed.json'],
  ]) {
    const p = r.immutableTechnicalRecords[key];
    if (p.path !== base + suffix) fail();
    raw[key] = JSON.parse(pin(p.path, p.sha256));
  }
  if (
    raw.closed.closureVerified !== false ||
    raw.closed.bypassHandoffDeleted !== false ||
    cleanup.parentProcessId !== raw.admission.parentProcessId ||
    cleanup.runtimeProcessId !== raw.runtimeClaim.processId ||
    raw.closed.runtimeProcessId !== cleanup.runtimeProcessId ||
    x.io.processAlive(cleanup.parentProcessId) !== false ||
    x.io.processAlive(cleanup.runtimeProcessId) !== false
  )
    fail();
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(a.runId) ||
    a.attemptPath !== db + '-attempt.json' ||
    a.receiptPath !== db + '-latest.json' ||
    a.generatedTypePath !== `scripts/db/out/m03-foundation-continuation-${a.runId}-db.types.ts`
  )
    fail();
  const attempt = JSON.parse(pin(a.attemptPath, a.attemptSha256)),
    admin = JSON.parse(pin(a.receiptPath, a.receiptSha256));
  pin(a.generatedTypePath, a.generatedTypeSha256);
  if (
    attempt.version !== 1 ||
    attempt.runId !== a.runId ||
    attempt.projectRef !== r.projectRef ||
    attempt.segmentId !== c.segmentId ||
    attempt.purpose !== 'postcheck-only-continuation' ||
    admin.version !== 1 ||
    admin.runId !== a.runId ||
    admin.environment !== 'dev' ||
    admin.projectRef !== r.projectRef ||
    admin.host !== 'aws-1-eu-central-1.pooler.supabase.com' ||
    admin.port !== 5432 ||
    admin.activeWindowId !== priorActiveRuntime.windowId ||
    admin.clockSegmentId !== c.segmentId ||
    admin.technicalAttemptOrdinal !== 7 ||
    admin.postcheckCandidate !== a.generatedTypePath ||
    !Array.isArray(admin.pendingVersions) ||
    admin.pendingVersions.length !== 0
  )
    fail();
  for (const key of [
    'authenticationAttempted',
    'authenticationVerified',
    'childrenClosed',
    'handoffDeleted',
    'leaseDeleted',
    'scratchDeleted',
    'phaseAControl',
    'postcheckContinuation',
    'projectVerifiedContinuation',
    'forwardWindow',
  ])
    if (admin[key] !== true) fail();
  for (const key of [
    'status',
    'historyBefore',
    'historyAfter',
    'pushAttempted',
    'postcheckStage',
    'phaseACommands',
    'phaseAClosed',
    'unprovisionedFixtureArchived',
  ])
    if (admin[key] !== a[key]) fail();
  if (
    a.status !== 'continuation_history_verified' ||
    a.historyBefore !== 'complete' ||
    a.historyAfter !== 'complete' ||
    a.migrationCount !== 15 ||
    a.migrationsAppliedThisAttempt !== 0 ||
    a.pushAttempted !== false ||
    a.postcheckStage !== 'complete' ||
    a.phaseACommands !== 3 ||
    a.phaseAClosed !== false ||
    a.unprovisionedFixtureArchived !== false ||
    a.childrenClosed !== true ||
    a.handoffDeleted !== true ||
    a.leaseDeleted !== true ||
    a.scratchDeleted !== true
  )
    fail();
  const window = readback.windows?.[0],
    fixture = readback.fixture,
    pf = readback.preflight;
  if (
    readback.projectRef !== r.projectRef ||
    readback.mutations !== 0 ||
    readback.migrationCount !== 15 ||
    !Array.isArray(readback.windows) ||
    readback.windows.length !== 1 ||
    window.windowId !== c.windowId ||
    window.namespace !== 'm03-foundation-dev' ||
    window.environment !== 'dev' ||
    window.projectRef !== r.projectRef ||
    window.closed !== true ||
    window.closeCount !== 1 ||
    window.admittedCount !== 2 ||
    fixture.competitorId !== 'd51a39f6-fe87-4d17-aee9-3070c45693aa' ||
    fixture.accountId !== 'bd23314c-591f-4fb7-92fd-b7450634eeb6' ||
    fixture.companyCode !== 'C999' ||
    fixture.competitorStatus !== 'archived' ||
    fixture.accountStatus !== 'paused' ||
    fixture.itemsCount !== 0 ||
    fixture.locked !== null ||
    pf.dailyBudgetUsd !== 25 ||
    pf.dailyBudgetType !== 'number' ||
    pf.statsDailyEnabled !== false ||
    pf.statsType !== 'boolean' ||
    pf.errorCount24h !== 0 ||
    pf.notificationCooldownClear !== true ||
    pf.priceBookType !== 'object' ||
    pf.priceBookEntries !== 25
  )
    fail();
  const expectedIds = [
    '4JMHLDBSdgGxhPlk',
    'Oq19AMI9C3B1wbo9',
    '8pz1lF0xPDQCs3ab',
    'F7S8Llr0ZSaSuw4T',
    'VbJn4mLYm0sGy1X2',
    'h6lUXSGN5sV2jxuQ',
    '02yefa9uEPYwmM3N',
    '83LybyawRpHXbjx6',
    'qzgT9giRQJ7eMDmV',
    'mySfLZbU7I1850uP',
    'kkAGgnbD8NjWHMKC',
    'ze8T1o0Cx0OGi3Wd',
    '2U6nPs3uJkmjij82',
    'S6KDFsx5IjQRf6tm',
    'gBDmjIIEoM6XC7Wi',
    'MzimjpsuyPuK7SKe',
    'TsqSMa5MlO3QBLkt',
    'S9NHRkKFUIiXX2wv',
    'sowAIvuN7adg0JBq',
    'qTjioYmBUVMIERVz',
    'lkVDS0oO4WULipeV',
    'RUTwaXMRh3PgLhJq',
    'nDijMP0IurUw58Kg',
    'v4yeqqNm6xHjZ5ue',
    'tiEhU3dXrMifOnTL',
  ];
  for (const [name, count] of [
    ['management', 168],
    ['control', 434],
    ['setup', 84],
    ['preflight', 4],
    ['runtime', 50],
  ]) {
    const path = `scripts/n8n/out/foundation/live/${name}.jsonl`,
      p = r.actualPublicJournals[name];
    if (p.path !== path || p.rowCount !== count) fail();
    const current = x.file(path),
      parsed = jsonl(current, 8000),
      prefix = parsed.lines.slice(0, count).join('\n') + '\n';
    if (parsed.rows.length < count || hash(prefix) !== p.sha256 || (name === 'runtime' && current !== prefix))
      fail();
    if (name === 'management') {
      const added = parsed.rows.slice(143, 168);
      if (
        added.length !== 25 ||
        added.some(
          (row, i) =>
            !exact(row, ['event', 'ordinal']) ||
            row.event !== 'management_attempt' ||
            row.ordinal !== 143 + i,
        )
      )
        fail();
    } else if (name === 'control') {
      const added = parsed.rows.slice(382, 434);
      if (added.length !== 52) fail();
      for (const [i, row] of added.entries()) {
        const at = Date.parse(row.at);
        if (!Number.isFinite(at) || at < raw.admission.startsAt || at > raw.closed.closedAt) fail();
        if (i === 1) {
          if (
            !exact(row, ['event', 'kind', 'workflowId', 'at']) ||
            row.event !== 'browser_port_preflight_verified' ||
            row.kind !== 'browser_ui' ||
            row.workflowId !== 'MzimjpsuyPuK7SKe'
          )
            fail();
        } else if (
          !exact(row, ['event', 'ordinal', 'kind', 'workflowId', 'at']) ||
          row.event !== 'control_request_intent' ||
          row.kind !== 'discovery' ||
          row.ordinal !== (i === 0 ? 382 : 381 + i) ||
          row.workflowId !== (i === 0 ? 'MzimjpsuyPuK7SKe' : expectedIds[Math.floor((i - 2) / 2)])
        )
          fail();
      }
    } else if (p.sha256 !== x.recovery.pins[path]) fail();
    pins[path] = p.sha256;
  }
  pins[closedPreparationRecovery.relative] = closedPreparationRecovery.sha256;
  return Object.freeze({
    ...x.recovery,
    mainManagementAttempts: 167,
    mainControlAttempts: 432,
    controlRows: 434,
    closedPreparationTechnicalAttempt: 7,
    closedPreparationPins: Object.freeze([
      closedPreparationRecovery.relative,
      base + '.json',
      base + '.runtime-claim.json',
      base + '.closed.json',
      a.attemptPath,
      a.receiptPath,
      a.generatedTypePath,
    ]),
    pins: Object.freeze(pins),
  });
}
function reconciledClosedFixture(x) {
  if (!closedFixtureRecovery || x.recovery?.managementMaximum !== 576) return null;
  if (
    x.recovery.closedPreparationTechnicalAttempt !== 7 ||
    x.recovery.mainManagementAttempts !== 167 ||
    x.recovery.mainControlAttempts !== 432 ||
    x.recovery.controlRows !== 434 ||
    x.recovery.carriedManagementAttempts !== 10 ||
    x.recovery.carriedControlAttempts !== 3
  )
    fail();
  const text = x.file(closedFixtureRecovery.relative);
  if (hash(text) !== closedFixtureRecovery.sha256) fail();
  const r = JSON.parse(text),
    recordedAt = Date.parse(r.recordedAt),
    cleanup = r.actualCleanup,
    readback = r.subsequentReadback,
    base = `scripts/n8n/out/foundation/live/project-verified-continuation-${c.segmentId}.technical-8`,
    db = `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-8`;
  if (
    r.kind !== 'm03_technical8_closed_fixture_preflight_reconciliation' ||
    r.version !== 1 ||
    r.environment !== 'dev' ||
    r.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    !Number.isFinite(recordedAt) ||
    recordedAt > x.clock() ||
    r.source.head !== 'f9e999a46427392ef9b9cb3f45090fda639fc551' ||
    r.source.applicationSource !== priorActiveRuntime.sourceCommitSha ||
    r.source.ciRun !== 40042065141 ||
    r.source.allFiveJobsPassed !== true ||
    r.source.vercelPassed !== true
  )
    fail();
  const match = (object, expected) => {
    if (!object || Object.entries(expected).some(([key, value]) => object[key] !== value)) fail();
  };
  match(r.usage, {
    mainManagement: 227,
    carriedManagement: 10,
    management: 237,
    mainControl: 483,
    carriedControl: 3,
    control: 486,
    combined: 723,
    vercel: 79,
    managementMaximum: 576,
    controlMaximum: 2048,
    combinedMaximum: 2560,
    vercelMaximum: 88,
    actorStarts: 0,
    maxActorUsd: 1,
    actorReserveUsd: 2,
    sqlFamilyAdmitted: 3,
    allowancesReplenished: false,
  });
  match(r.actualAttempt, {
    baselineSourceGets: 25,
    executionDiscoveryGets: 50,
    browserDiscoveryAttempts: 1,
    previewPrepared: true,
    ownerProvisionIntentPresent: true,
    reactivationIntentPresent: true,
    fixtureReactivationCommitted: false,
    failedStage: 'owned_fixture_reactivation_preflight',
    originalSqlErrorRetained: false,
    nativeWorkflowExecutions: 0,
    actorStarts: 0,
  });
  match(cleanup, {
    nativeExit: 0,
    bothKnownProcessesDead: true,
    allEightInputFilesAbsent: true,
    parentLockAbsent: true,
    bypassCopyAbsent: true,
    ciphertextRead: false,
    decrypted: false,
    networkRequests: 0,
    persistentOriginalsUntouched: true,
    retainedMachinePreserved: true,
  });
  match(r.acceptance, {
    actualM03DevAcceptanceVerified: false,
    fullDVerified: false,
    subsequentEnvironmentCleanupVerified: true,
    subsequentSqlFamilyClosedVerified: true,
    subsequentFixtureArchivedVerified: true,
    zeroActorsAndOutstandingWorkVerified: true,
    productionChanged: false,
    pr8Merged: false,
    m04Started: false,
  });
  match(r.protocolClose, {
    status: 'closed',
    childTransportsClosed: true,
    adminChildClosed: true,
    windowClosed: false,
    fixtureArchived: false,
    baselineRestored: false,
    environmentCleanupVerified: true,
    remoteWorkSettled: false,
    residual: true,
  });
  match(r.wrapperClose, {
    kind: 'm03_acceptance_wrapper_closed',
    childClosed: true,
    credentialChildrenClosed: true,
    emergencyShutdown: false,
    nativeExit: 1,
    handoffsDeleted: true,
    bypassHandoffDeleted: false,
    pendingMachinePreserved: true,
    privateRead: true,
    code: 'M03_ACCEPTANCE_BLOCKED',
  });
  const absent = [
    db + '-unprovisioned-archive-attempt.json',
    'scripts/n8n/out/foundation/live/runtime.technical-8.jsonl',
  ];
  if (absent.some((path) => x.physical(join(repo, path), true))) fail();
  const pins = { ...x.recovery.pins },
    immutable = [];
  const pin = (p, path) => {
    const value = x.file(path);
    if (
      p.path !== path ||
      !/^[a-f0-9]{64}$/.test(p.sha256) ||
      hash(value) !== p.sha256 ||
      Buffer.byteLength(value) !== p.bytes
    )
      fail();
    pins[path] = p.sha256;
    immutable.push(path);
    return value;
  };
  const raw = {};
  for (const [key, suffix] of [
    ['admission', '.json'],
    ['runtimeClaim', '.runtime-claim.json'],
    ['closed', '.closed.json'],
  ])
    raw[key] = JSON.parse(pin(r.immutableTechnicalRecords[key], base + suffix));
  const records = r.immutableTechnicalRecords;
  if (
    records.rawClosureVerifiedRemainsFalse !== true ||
    records.rawBypassHandoffDeletedRemainsFalse !== true ||
    raw.closed.closureVerified !== false ||
    raw.closed.bypassHandoffDeleted !== false ||
    raw.closed.childClosed !== true ||
    raw.closed.credentialChildrenClosed !== true ||
    raw.closed.emergencyShutdown !== false ||
    raw.closed.nativeExit !== 1 ||
    records.parentProcessId !== raw.admission.parentProcessId ||
    records.runtimeProcessId !== raw.runtimeClaim.processId ||
    raw.closed.parentProcessId !== records.parentProcessId ||
    raw.closed.runtimeProcessId !== records.runtimeProcessId ||
    x.io.processAlive(records.parentProcessId) !== false ||
    x.io.processAlive(records.runtimeProcessId) !== false
  )
    fail();
  const a = r.administrativeResult.admin;
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(a.runId) ||
    !Array.isArray(r.administrativeResult.pins) ||
    r.administrativeResult.pins.length !== 5
  )
    fail();
  const typePath = `scripts/db/out/m03-foundation-continuation-${a.runId}-db.types.ts`;
  const adminPaths = [
    db + '-attempt.json',
    db + '-latest.json',
    db + '-owner-provision-attempt.json',
    db + '-reactivation-attempt.json',
    typePath,
  ];
  const values = r.administrativeResult.pins.map((p, i) => pin(p, adminPaths[i]));
  const [attempt, admin, provision, reactivation] = values.slice(0, 4).map(JSON.parse);
  match(attempt, {
    version: 1,
    runId: a.runId,
    projectRef: r.projectRef,
    segmentId: c.segmentId,
    purpose: 'postcheck-only-continuation',
  });
  match(admin, {
    version: 1,
    runId: a.runId,
    environment: 'dev',
    projectRef: r.projectRef,
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 5432,
    activeWindowId: priorActiveRuntime.windowId,
    clockSegmentId: c.segmentId,
    technicalAttemptOrdinal: 8,
    phaseAControl: true,
    postcheckContinuation: true,
    projectVerifiedContinuation: true,
    postcheckCandidate: typePath,
  });
  match(a, {
    status: 'phase_a_control_failed',
    authenticationAttempted: true,
    authenticationVerified: true,
    historyBefore: 'complete',
    historyAfter: 'complete',
    pushAttempted: false,
    childrenClosed: true,
    handoffDeleted: true,
    leaseDeleted: true,
    scratchDeleted: true,
    phaseACommands: 4,
    phaseAClosed: false,
    postcheckStage: 'complete',
    forwardWindow: true,
    unprovisionedFixtureArchived: false,
    postcheckCandidate: typePath,
  });
  for (const key of Object.keys(a)) if (admin[key] !== a[key]) fail();
  if (
    !Array.isArray(admin.pendingVersions) ||
    admin.pendingVersions.length ||
    admin.reactivationState !== 'unknown'
  )
    fail();
  match(provision, { version: 1, runId: a.runId, windowId: priorActiveRuntime.windowId });
  match(provision.packet, {
    audience: r.actualAttempt.previewAudience,
    commitSha: priorActiveRuntime.sourceCommitSha,
    deploymentId: r.actualAttempt.previewDeployment,
    actorBuild: '0.3.99',
    approvalReference: 'M03-A-D-f42930f-20261021',
    maxTotalChargeUsd: 1,
    batchMaxUsd: 2,
  });
  match(reactivation, {
    version: 1,
    runId: a.runId,
    segmentId: c.segmentId,
    competitorId: 'd51a39f6-fe87-4d17-aee9-3070c45693aa',
    accountId: 'bd23314c-591f-4fb7-92fd-b7450634eeb6',
  });
  if (JSON.stringify(reactivation) !== JSON.stringify(r.administrativeResult.reactivation)) fail();
  match(readback, {
    projectRef: r.projectRef,
    migrationCount: 15,
    mutations: 0,
    readQueries: 2,
    eachAuditCount: 1,
  });
  match(readback.fixture, {
    competitorId: 'd51a39f6-fe87-4d17-aee9-3070c45693aa',
    accountId: 'bd23314c-591f-4fb7-92fd-b7450634eeb6',
    competitorStatus: 'archived',
    accountStatus: 'paused',
    itemsCount: 0,
  });
  const audits = [
    'm03_smoke_setup.v1',
    'm03_smoke_reactivate.v1:1c69c89e-7807-46d5-b7b8-ca28285ff2b4',
    `m03_smoke_reactivate.v1:${c.segmentId}`,
    `m03_smoke_reactivate.v1:${c.segmentId}:technical-2`,
  ];
  if (
    JSON.stringify(readback.audits) !== JSON.stringify(audits) ||
    !Array.isArray(readback.windowFamily) ||
    readback.windowFamily.length !== 2 ||
    !exact(readback.vacancy, [
      'items',
      'runs',
      'apifyRuns',
      'launches',
      'costEntries',
      'runningRuns',
      'activeLeases',
      'incompleteRequests',
    ]) ||
    Object.values(readback.vacancy).some((value) => value !== 0)
  )
    fail();
  match(readback.windowFamily[0], {
    id: priorActiveRuntime.windowId,
    closed: true,
    started: false,
    closeCount: 1,
    admitted: 1,
    commit: priorActiveRuntime.sourceCommitSha,
    deployment: r.actualAttempt.previewDeployment,
    audience: r.actualAttempt.previewAudience,
  });
  match(readback.windowFamily[1], {
    id: c.windowId,
    closed: true,
    started: true,
    closeCount: 1,
    admitted: 2,
  });
  match(r.restrictedWriterClose, {
    windowId: priorActiveRuntime.windowId,
    verified: true,
    administratorSubstituted: false,
  });
  match(r.setup, {
    newRequests: 35,
    environmentCreated: 7,
    environmentAbsenceVerified: 7,
    bypassAbsenceVerified: 1,
    coordinatorCleanupVerified: true,
  });
  if (JSON.stringify(r.setup.methodCounts) !== JSON.stringify({ GET: 18, PATCH: 2, POST: 8, DELETE: 7 }))
    fail();
  const counts = { management: 228, control: 486, setup: 155, preflight: 6, runtime: 50 };
  const expectedIds = [
    '4JMHLDBSdgGxhPlk',
    'Oq19AMI9C3B1wbo9',
    '8pz1lF0xPDQCs3ab',
    'F7S8Llr0ZSaSuw4T',
    'VbJn4mLYm0sGy1X2',
    'h6lUXSGN5sV2jxuQ',
    '02yefa9uEPYwmM3N',
    '83LybyawRpHXbjx6',
    'qzgT9giRQJ7eMDmV',
    'mySfLZbU7I1850uP',
    'kkAGgnbD8NjWHMKC',
    'ze8T1o0Cx0OGi3Wd',
    '2U6nPs3uJkmjij82',
    'S6KDFsx5IjQRf6tm',
    'gBDmjIIEoM6XC7Wi',
    'MzimjpsuyPuK7SKe',
    'TsqSMa5MlO3QBLkt',
    'S9NHRkKFUIiXX2wv',
    'sowAIvuN7adg0JBq',
    'qTjioYmBUVMIERVz',
    'lkVDS0oO4WULipeV',
    'RUTwaXMRh3PgLhJq',
    'nDijMP0IurUw58Kg',
    'v4yeqqNm6xHjZ5ue',
    'tiEhU3dXrMifOnTL',
  ];
  for (const [name, count] of Object.entries(counts)) {
    const path = `scripts/n8n/out/foundation/live/${name}.jsonl`,
      p = r.actualPublicJournals[name];
    const current = x.file(path),
      parsed = jsonl(current, 8000),
      prefix = parsed.lines.slice(0, count).join('\n') + '\n';
    if (
      p.path !== path ||
      p.rows !== count ||
      parsed.rows.length < count ||
      hash(prefix) !== p.sha256 ||
      Buffer.byteLength(prefix) !== p.bytes ||
      (name === 'runtime' && current !== prefix)
    )
      fail();
    const beforeCount = { management: 168, control: 434, setup: 84, preflight: 4, runtime: 50 }[name];
    const before = parsed.lines.slice(0, beforeCount).join('\n') + '\n';
    if (hash(before) !== x.recovery.pins[path]) fail();
    const added = parsed.rows.slice(beforeCount, count);
    if (name === 'management') {
      if (
        added.some(
          (row, i) =>
            !exact(row, ['event', 'ordinal']) ||
            row.event !== 'management_attempt' ||
            row.ordinal !== 168 + i,
        )
      )
        fail();
    } else if (name === 'control') {
      for (const [i, row] of added.entries()) {
        const at = Date.parse(row.at);
        if (!Number.isFinite(at) || at < raw.admission.startsAt || at > raw.closed.closedAt) fail();
        if (i === 1) {
          if (
            !exact(row, ['event', 'kind', 'workflowId', 'at']) ||
            row.event !== 'browser_port_preflight_verified' ||
            row.kind !== 'browser_ui' ||
            row.workflowId !== 'MzimjpsuyPuK7SKe'
          )
            fail();
        } else if (
          !exact(row, ['event', 'ordinal', 'kind', 'workflowId', 'at']) ||
          row.event !== 'control_request_intent' ||
          row.kind !== 'discovery' ||
          row.ordinal !== (i === 0 ? 433 : 432 + i) ||
          row.workflowId !== (i === 0 ? 'MzimjpsuyPuK7SKe' : expectedIds[Math.floor((i - 2) / 2)])
        )
          fail();
      }
    } else if (name === 'setup') {
      const attempts = added.filter((row) => row.event === 'setup_attempt');
      const methods = Object.fromEntries(
        ['GET', 'PATCH', 'POST', 'DELETE'].map((kind) => [
          kind,
          attempts.filter((row) => row.kind === kind).length,
        ]),
      );
      if (
        JSON.stringify(methods) !== JSON.stringify(r.setup.methodCounts) ||
        attempts.length !== 35 ||
        attempts.some((row, i) => row.ordinal !== 45 + i) ||
        added.some((row) => {
          const inAttempt = (value) =>
            Number.isSafeInteger(value) && value >= raw.admission.startsAt && value <= raw.closed.closedAt;
          if (row.event === 'setup_ack' && row.kind === 'environment')
            return (
              !exact(row, [
                'event',
                'kind',
                'id',
                'key',
                'type',
                'target',
                'gitBranch',
                'comment',
                'createdAt',
                'updatedAt',
              ]) ||
              !inAttempt(row.createdAt) ||
              !inAttempt(row.updatedAt) ||
              row.updatedAt < row.createdAt ||
              row.type !== 'sensitive' ||
              row.gitBranch !== 'm03-n8n-foundation' ||
              JSON.stringify(row.target) !== JSON.stringify(['preview']) ||
              row.comment !== 'M03 foundation temporary dev ' + priorActiveRuntime.windowId
            );
          return !inAttempt(row.at);
        }) ||
        added.filter((row) => row.event === 'setup_ack' && row.kind === 'environment').length !== 7 ||
        added.filter((row) => row.event === 'setup_cleanup_absent' && row.kind === 'environment').length !==
          7 ||
        added.filter((row) => row.event === 'setup_cleanup_absent' && row.kind === 'bypass').length !== 1
      )
        fail();
    } else if (name === 'preflight') {
      const [intent, verified] = added;
      match(intent, {
        event: 'foundation_writer_close_intent',
        windowId: priorActiveRuntime.windowId,
        requestId: '00000000-0000-4000-8000-000000000021',
        audience: r.actualAttempt.previewAudience,
        sourceCommitSha: priorActiveRuntime.sourceCommitSha,
        deploymentId: r.actualAttempt.previewDeployment,
        at: r.restrictedWriterClose.intentAt,
      });
      match(verified, {
        event: 'foundation_writer_close_verified',
        windowId: priorActiveRuntime.windowId,
        identityVerified: true,
        bindingVerified: true,
        closeAcknowledged: true,
        connectionClosed: true,
        at: r.restrictedWriterClose.verifiedAt,
      });
    }
    pins[path] = p.sha256;
  }
  pins[closedFixtureRecovery.relative] = closedFixtureRecovery.sha256;
  return Object.freeze({
    ...x.recovery,
    mainManagementAttempts: 227,
    mainControlAttempts: 483,
    controlRows: 486,
    setupRows: 155,
    setupAttempts: 79,
    preflightRows: 6,
    legacySqlAdmitted: 3,
    closedFixtureTechnicalAttempt: 8,
    historicalWindowIds: Object.freeze([c.windowId, priorActiveRuntime.windowId]),
    closedFixturePins: Object.freeze([closedFixtureRecovery.relative, ...immutable]),
    pins: Object.freeze(pins),
  });
}
function reconcileReadonlyDiscoveryRecords(x, r, journalCounts, additionalPaths = []) {
  const a = r.attempt;
  // The exact no-spawn failure11 preserves its native incomplete flags. Its
  // separate immutable reconciliation below proves physical local closure.
  const noAdminSpawn = a.technicalOrdinal === 11;
  const match = (value, expected) => {
    if (!value || Object.entries(expected).some(([key, v]) => value[key] !== v)) fail();
  };
  const base = `scripts/n8n/out/foundation/live/project-verified-continuation-${c.segmentId}.technical-${a.technicalOrdinal}`;
  const immutable = ['.json', '.runtime-claim.json', '.closed.json', '.public-frames.jsonl'].map(
    (s) => base + s,
  );
  const expectedPins = [
    ...immutable,
    ...additionalPaths,
    ...Object.keys(journalCounts).map((n) => `scripts/n8n/out/foundation/live/${n}.jsonl`),
  ];
  if (!exact(r.pins, expectedPins)) fail();
  const pins = { ...x.recovery.pins };
  for (const path of [...immutable, ...additionalPaths]) {
    if (typeof r.pins[path] !== 'string' || hash(x.file(path)) !== r.pins[path]) fail();
    pins[path] = r.pins[path];
  }
  const admission = JSON.parse(x.file(base + '.json')),
    claim = JSON.parse(x.file(base + '.runtime-claim.json')),
    close = JSON.parse(x.file(base + '.closed.json'));
  match(admission, {
    sourceCommitSha: foundationProjectVerifiedActiveRuntime.sourceCommitSha,
    windowId: a.windowId,
    startsAt: a.startsAt,
    parentProcessId: a.parentProcessId,
  });
  match(claim, {
    processId: a.runtimeProcessId,
    parentProcessId: a.parentProcessId,
    admissionSha256: r.pins[base + '.json'],
  });
  match(close, {
    parentProcessId: a.parentProcessId,
    runtimeProcessId: a.runtimeProcessId,
    admissionSha256: r.pins[base + '.json'],
    closedAt: a.closedAt,
    nativeExit: 1,
    childClosed: true,
    credentialChildrenClosed: !noAdminSpawn,
    emergencyShutdown: false,
    pendingMachinePreserved: true,
    bypassHandoffDeleted: false,
    closureVerified: false,
  });
  if (
    !positive(a.parentProcessId) ||
    !positive(a.runtimeProcessId) ||
    x.io.processAlive(a.parentProcessId) !== false ||
    x.io.processAlive(a.runtimeProcessId) !== false ||
    !Number.isSafeInteger(a.closedAt) ||
    a.closedAt < a.startsAt ||
    a.closedAt > x.clock()
  )
    fail();
  const frames = jsonl(x.file(base + '.public-frames.jsonl'), 10).rows;
  if (
    frames.length !== 10 ||
    JSON.stringify(frames.map((f) => f.kind)) !==
      JSON.stringify([
        'm03_public_raw_pipe_receipt',
        'm03_acceptance_transport_ready',
        'm03_acceptance_vercel_metadata',
        'm03_acceptance_ready',
        'mcp_port_request',
        'm03_acceptance_result',
        'm03_acceptance_result',
        'm03_acceptance_closed',
        'm03_acceptance_wrapper_closed',
        'm03_public_raw_pipe_closed',
      ])
  )
    fail();
  match(frames[0], {
    version: 1,
    helperHead: r.source.head,
    applicationSource: r.source.applicationSource,
    windowId: a.windowId,
    technicalAttempt: a.technicalOrdinal,
    parentProcessId: a.parentProcessId,
    adapterReadsCredentialValues: false,
  });
  match(frames[1], { privateRead: false, networkRequests: 0 });
  match(frames[2], {
    status: 'metadata_covers_75_minutes',
    metadataValid: true,
    unexpired: true,
    covers75Minutes: true,
    networkRequests: 0,
    authenticationAttempted: false,
    refreshAttempted: false,
    configWritten: false,
    childClosed: true,
  });
  match(frames[3], {
    status: 'private_child_ready',
    sourceCommitSha: r.source.applicationSource,
    deadlineAt: admission.deadlineAt,
    approvedHead: c.sourceCommitSha,
  });
  match(frames[4], { action: 'browser_discover', workflowId: 'MzimjpsuyPuK7SKe' });
  if ([frames[1].nonce, frames[4].nonce].some((n) => typeof n !== 'string' || !/^[a-f0-9]{32}$/.test(n)))
    fail();
  for (const frame of frames.slice(5, 8))
    match(frame, {
      managementAttempts: r.usage.management - (r.usage.additionalCarriedManagement ?? 0),
      controlAttempts: r.usage.control,
      nativeExecutions: 0,
      gatewayPreflightAttempts: 2,
      providerDirectAttempts: 0,
      phaseBReady: false,
      domainProofReady: false,
      businessAcceptanceProven: false,
      ...(noAdminSpawn ? {} : { code: a.prepareCode }),
      residual: true,
    });
  if (noAdminSpawn && frames.slice(5, 8).some((frame) => Object.hasOwn(frame, 'code'))) fail();
  match(frames[5], { id: a.prepareCommand, command: 'prepare', status: 'blocked' });
  match(frames[6], {
    id: a.restoreCommand,
    command: 'restore',
    status: 'restoration_residual',
    baselineRestored: false,
    environmentCleanupVerified: false,
    windowClosed: false,
    fixtureArchived: false,
    remoteWorkSettled: false,
  });
  match(frames[7], {
    status: noAdminSpawn ? 'residual' : 'closed',
    childTransportsClosed: !noAdminSpawn,
    adminChildClosed: !noAdminSpawn,
    baselineRestored: false,
    environmentCleanupVerified: false,
    windowClosed: false,
    fixtureArchived: false,
    remoteWorkSettled: false,
  });
  match(frames[8], {
    childClosed: true,
    credentialChildrenClosed: !noAdminSpawn,
    emergencyShutdown: false,
    nativeExit: 1,
    handoffsDeleted: !noAdminSpawn,
    bypassHandoffDeleted: false,
    pendingMachinePreserved: true,
    privateRead: true,
    code: 'M03_ACCEPTANCE_BLOCKED',
  });
  match(frames[9], {
    nativeExit: 1,
    parentClosed: true,
    stderrPresent: false,
    protocolBlocked: false,
    overflow: false,
  });
  for (const [name, count] of Object.entries(journalCounts)) {
    const path = `scripts/n8n/out/foundation/live/${name}.jsonl`,
      parsed = jsonl(x.file(path), 8000);
    const prefix = parsed.lines.slice(0, count).join('\n') + '\n';
    const beforeCount = {
      management: x.recovery.mainManagementAttempts + 1,
      control: x.recovery.controlRows,
      setup: x.recovery.setupRows,
      preflight: x.recovery.preflightRows,
      runtime: x.recovery.runtimeRows,
    }[name];
    if (
      parsed.rows.length < count ||
      hash(prefix) !== r.pins[path] ||
      hash(parsed.lines.slice(0, beforeCount).join('\n') + '\n') !== x.recovery.pins[path]
    )
      fail();
    const added = parsed.rows.slice(beforeCount, count);
    if (
      name === 'management' &&
      (added.length !== 25 ||
        added.some(
          (row, i) =>
            !exact(row, ['event', 'ordinal']) ||
            row.event !== 'management_attempt' ||
            row.ordinal !== beforeCount + i,
        ))
    )
      fail();
    if (name === 'control') {
      const [intent, browser, ...discoveries] = added;
      match(intent, {
        event: 'control_request_intent',
        ordinal: x.recovery.mainControlAttempts + 1,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
      });
      match(browser, {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: 'MzimjpsuyPuK7SKe',
      });
      const beforeIds = parsed.rows.slice(beforeCount - 50, beforeCount).map((row) => row.workflowId);
      if (
        added.length !== 52 ||
        discoveries.length !== 50 ||
        discoveries.some(
          (row, i) =>
            !exact(row, ['event', 'ordinal', 'kind', 'workflowId', 'at']) ||
            row.event !== 'control_request_intent' ||
            row.ordinal !== x.recovery.mainControlAttempts + 2 + i ||
            row.kind !== 'discovery' ||
            row.workflowId !== beforeIds[i],
        ) ||
        added.some(
          (row) =>
            !Number.isFinite(Date.parse(row.at)) ||
            Date.parse(row.at) < a.startsAt ||
            Date.parse(row.at) > a.closedAt,
        )
      )
        fail();
    }
    if (!['management', 'control'].includes(name) && added.length !== 0) fail();
    pins[path] = r.pins[path];
  }
  return { pins, immutable: [...immutable, ...additionalPaths] };
}
function reconciledPreprivateAdmin(x) {
  if (!preprivateAdminRecovery) return null;
  if (
    x.recovery?.managementMaximum !== 640 ||
    x.recovery.closedFixtureTechnicalAttempt !== 8 ||
    x.recovery.mainManagementAttempts !== 227 ||
    x.recovery.carriedManagementAttempts !== 10 ||
    x.recovery.mainControlAttempts !== 483 ||
    x.recovery.carriedControlAttempts !== 3
  )
    fail();
  const text = x.file(preprivateAdminRecovery.relative);
  if (hash(text) !== preprivateAdminRecovery.sha256) fail();
  const r = JSON.parse(text),
    a = r.attempt;
  const match = (value, expected) => {
    if (!value || Object.entries(expected).some(([key, expectedValue]) => value[key] !== expectedValue))
      fail();
  };
  match(r, {
    kind: 'm03_technical9_preprivate_admin_reconciliation',
    version: 1,
    environment: 'dev',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
  });
  if (!Number.isFinite(Date.parse(r.recordedAt)) || Date.parse(r.recordedAt) > x.clock()) fail();
  match(r.source, {
    head: '2c6d9524a277c089c01633c7d99e72d564bb7b9e',
    applicationSource: foundationProjectVerifiedActiveRuntime.sourceCommitSha,
    ciRun: 40050661178,
    allFiveJobsPassed: true,
    vercelPassed: true,
  });
  match(a, {
    technicalOrdinal: 9,
    windowId: foundationProjectVerifiedActiveRuntime.windowId,
    nativeExit: 1,
    prepareCode: 'FOUNDATION_ADMIN_PREFLIGHT_BLOCKED',
    adminDpapiRead: 'not_attempted',
    adminAuthentication: 'not_attempted',
    exactPublicPreflightFailureLayer: 'unestablished',
    baselineGets: 25,
    executionDiscoveryGets: 50,
    browserDiscoveryAttempts: 1,
    workflowExecutions: 0,
    newGatewayRequests: 0,
    providerDirectRequests: 0,
    actorStarts: 0,
    previewSetupAttempted: false,
    sqlProvisionAttempted: false,
    fixtureReactivationAttempted: false,
    migrationOperationAttempted: false,
    databaseReadbackPerformed: false,
  });
  match(r.raw, {
    status: 'closed',
    residual: true,
    baselineRestored: false,
    environmentCleanupVerified: false,
    windowClosed: false,
    fixtureArchived: false,
    remoteWorkSettled: false,
    closureVerified: false,
    bypassHandoffDeleted: false,
    childTransportsClosed: true,
    adminChildClosed: true,
    credentialChildrenClosed: true,
    handoffsDeleted: true,
    emergencyShutdown: false,
  });
  match(r.cleanup, {
    nativeExit: 0,
    bothKnownProcessesDead: true,
    allThreeAbsent: true,
    parentLockAbsent: true,
    ciphertextRead: false,
    decrypted: false,
    networkRequests: 0,
    persistentOriginalsPreserved: true,
    retainedMachinePreserved: true,
    persistentStatusAllFourPresent: true,
  });
  if (
    JSON.stringify(r.cleanup.deletedOnly) !==
    JSON.stringify([
      'emr-m03-foundation-dev-migration-password.dpapi',
      'emr-m03-foundation-dev-migration-password.lease.json',
      'emr-m03-acceptance-protection-bypass.dpapi',
    ])
  )
    fail();
  match(r.additionalDiagnostic, {
    requestCount: 1,
    method: 'GET',
    origin: 'https://muhhammedsayed.app.n8n.cloud',
    path: '/api/v1/discover',
    credentialSupplied: false,
    httpStatus: null,
    tlsVerified: true,
    socketClosed: true,
    chargeAs: 'Management carried attempt',
    dnsCheckApiRequests: 0,
  });
  match(r.usage, {
    mainManagement: 252,
    priorCarriedManagement: 10,
    additionalCarriedManagement: 1,
    carriedManagement: 11,
    management: 263,
    mainControl: 534,
    carriedControl: 3,
    control: 537,
    combined: 800,
    vercel: 79,
    managementMaximum: 640,
    controlMaximum: 2048,
    combinedMaximum: 2560,
    vercelMaximum: 132,
    actorStarts: 0,
    actorMaximum: 2,
    actorReserveUsd: 2,
    allowancesReplenished: false,
    nextConservativeManagement: 639,
    nextConservativeVercel: 123,
  });
  match(r.acceptance, {
    actualM03DevAcceptanceVerified: false,
    fullDVerified: false,
    sqlStateFreshlyReadBack: false,
    priorHostedEvidencePreserved: true,
    allFifteenMigrationFilesMatchPackets: true,
    productionTouched: false,
    mergeApproved: false,
    m04Started: false,
  });
  const { pins, immutable } = reconcileReadonlyDiscoveryRecords(x, r, {
    management: 253,
    control: 538,
    setup: 155,
    preflight: 6,
    runtime: 50,
  });
  for (const suffix of [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'unprovisioned-archive-attempt',
    'reactivation-attempt',
  ])
    if (
      x.physical(
        join(
          repo,
          `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-9-${suffix}.json`,
        ),
        true,
      )
    )
      fail();
  if (x.physical(join(repo, 'scripts/n8n/out/foundation/live/runtime.technical-9.jsonl'), true)) fail();
  pins[preprivateAdminRecovery.relative] = preprivateAdminRecovery.sha256;
  return Object.freeze({
    ...x.recovery,
    mainManagementAttempts: 252,
    carriedManagementAttempts: 11,
    mainControlAttempts: 534,
    controlRows: 538,
    preprivateAdminTechnicalAttempt: 9,
    preprivateAdminPins: Object.freeze([preprivateAdminRecovery.relative, ...immutable]),
    pins: Object.freeze(pins),
  });
}
function reconciledCatalogReadonly(x) {
  if (!catalogReadonlyRecovery) return null;
  if (
    x.recovery?.preprivateAdminTechnicalAttempt !== 9 ||
    x.recovery.mainManagementAttempts !== 252 ||
    x.recovery.carriedManagementAttempts !== 11 ||
    x.recovery.mainControlAttempts !== 534 ||
    x.recovery.carriedControlAttempts !== 3 ||
    x.recovery.managementMaximum !== 640
  )
    fail();
  const text = x.file(catalogReadonlyRecovery.relative);
  if (hash(text) !== catalogReadonlyRecovery.sha256) fail();
  const r = JSON.parse(text),
    a = r.attempt;
  const match = (value, expected) => {
    if (!value || Object.entries(expected).some(([key, v]) => value[key] !== v)) fail();
  };
  match(r, {
    kind: 'm03_technical10_catalog_readonly_reconciliation',
    version: 1,
    environment: 'dev',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
  });
  if (!Number.isFinite(Date.parse(r.recordedAt)) || Date.parse(r.recordedAt) > x.clock()) fail();
  match(r.source, {
    head: '94ef0e000af36866437dfe1c2ede95f49d25165d',
    applicationSource: foundationProjectVerifiedActiveRuntime.sourceCommitSha,
    ciRun: 40053783222,
    allFiveJobsPassed: true,
    vercelPassed: true,
  });
  match(a, {
    technicalOrdinal: 10,
    windowId: foundationProjectVerifiedActiveRuntime.windowId,
    nativeExit: 1,
    adminAuthenticationVerified: true,
    historyBefore: 'complete',
    historyAfter: 'complete',
    migrationCount: 15,
    phaseACommands: 1,
    postcheckStage: 'catalog',
    pushAttempted: false,
    migrationOperationAttempted: false,
    baselineGets: 25,
    executionDiscoveryGets: 50,
    browserDiscoveryAttempts: 1,
    workflowExecutions: 0,
    newGatewayRequests: 0,
    providerDirectRequests: 0,
    actorStarts: 0,
    previewSetupAttempted: false,
    sqlProvisionAttempted: false,
    fixtureReactivationAttempted: false,
  });
  match(r.raw, {
    kind: 'm03_acceptance_closed',
    status: 'closed',
    managementAttempts: 288,
    controlAttempts: 588,
    nativeExecutions: 0,
    gatewayPreflightAttempts: 2,
    providerDirectAttempts: 0,
    phaseBReady: false,
    domainProofReady: false,
    businessAcceptanceProven: false,
    childTransportsClosed: true,
    adminChildClosed: true,
    windowClosed: false,
    fixtureArchived: false,
    baselineRestored: false,
    environmentCleanupVerified: false,
    remoteWorkSettled: false,
    residual: true,
  });
  match(r.wrapper, {
    childClosed: true,
    credentialChildrenClosed: true,
    emergencyShutdown: false,
    nativeExit: 1,
    handoffsDeleted: true,
    bypassHandoffDeleted: false,
    pendingMachinePreserved: true,
    privateRead: true,
  });
  match(r.cleanup, {
    nativeExit: 0,
    bothKnownProcessesDead: true,
    allTenLeavesAbsent: true,
    runtimeLockAbsent: true,
    allStreamsDestroyed: true,
    publicReceiptClosed: true,
    unusedLocalBypassDeleted: true,
    ciphertextReadForCleanup: false,
    decryptedForCleanup: false,
    networkRequestsForCleanup: 0,
    persistentOriginalsPreserved: true,
    persistentStatusAllFourPresent: true,
    retainedMachinePreserved: true,
  });
  match(r.adapterRecovery, {
    sameParentProcessId: a.parentProcessId,
    secondChildOrAdmissionStarted: false,
    prepareCommandsBeforeRecovery: 0,
    unrelatedSecretsRead: false,
    networkDebugPortOpened: false,
    debugSessionDisconnectedBeforePrepare: true,
  });
  const observed = r.hostedReadback;
  match(observed, {
    source: 'authenticated Supabase browser SQL Editor, SELECT only',
    serverObservedAt: null,
    reportedAfterPhysicalClosure: true,
    queries: 1,
    identity: true,
    migrationCount: 15,
    catalogNoNewWindow: false,
    freshWindowAbsent: true,
    reservedRequests: 0,
    activeLeases: 0,
    launchCount: 0,
    actorRunCount: 0,
    scrapeRunCount: 0,
    costCount: 0,
    itemCount: 0,
    baselineCompetitors: 285,
    baselineAccounts: 1754,
    otherCatalogFlagsObserved: false,
  });
  match(observed.fixture, {
    unlocked: true,
    noProgress: true,
    accountPaused: true,
    competitorArchived: true,
  });
  if (!Array.isArray(observed.windows) || observed.windows.length !== 2) fail();
  for (const [i, id, admittedCount] of [
    [0, priorActiveRuntime.windowId, 1],
    [1, c.windowId, 2],
  ])
    match(observed.windows[i], {
      id,
      closed: true,
      namespace: 'm03-foundation-dev',
      closeCount: 1,
      admittedCount,
    });
  match(r.usage, {
    mainManagement: 277,
    carriedManagement: 11,
    management: 288,
    mainControl: 585,
    carriedControl: 3,
    control: 588,
    combined: 876,
    vercel: 79,
    managementMaximum: 640,
    controlMaximum: 2048,
    combinedMaximum: 2560,
    vercelMaximum: 132,
    actorStarts: 0,
    actorMaximum: 2,
    actorReserveUsd: 2,
    allowancesReplenished: false,
    nextConservativeManagement: 664,
    nextConservativeVercel: 123,
  });
  match(r.acceptance, {
    actualM03DevAcceptanceVerified: false,
    fullDVerified: false,
    productionTouched: false,
    mergeApproved: false,
    m04Started: false,
  });
  const db = `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-10`;
  const counts = { management: 278, control: 590, setup: 155, preflight: 6, runtime: 50 };
  if (
    !exact(r.journalCounts, Object.keys(counts)) ||
    Object.entries(counts).some(([k, v]) => r.journalCounts[k] !== v)
  )
    fail();
  const { pins, immutable } = reconcileReadonlyDiscoveryRecords(x, r, counts, [
    db + '-attempt.json',
    db + '-latest.json',
  ]);
  const attempt = JSON.parse(x.file(db + '-attempt.json')),
    latest = JSON.parse(x.file(db + '-latest.json'));
  match(attempt, {
    version: 1,
    runId: a.adminRunId,
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    segmentId: c.segmentId,
    purpose: 'postcheck-only-continuation',
  });
  match(latest, {
    version: 1,
    runId: a.adminRunId,
    environment: 'dev',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 5432,
    status: 'phase_a_control_failed',
    authenticationAttempted: true,
    authenticationVerified: true,
    historyBefore: 'complete',
    historyAfter: 'complete',
    dryRunMatched: false,
    dryRunCheck: 'not_attempted',
    dryRunNativeExit: null,
    pushAttempted: false,
    pushNativeExit: null,
    childrenClosed: true,
    handoffDeleted: true,
    leaseDeleted: true,
    scratchDeleted: true,
    phaseAControl: true,
    phaseACommands: 1,
    phaseAClosed: false,
    postcheckContinuation: true,
    projectVerifiedContinuation: true,
    forwardWindow: true,
    activeWindowId: a.windowId,
    clockSegmentId: c.segmentId,
    technicalAttemptOrdinal: 10,
    unprovisionedFixtureArchived: false,
    postcheckStage: 'catalog',
  });
  if (
    !Array.isArray(latest.pendingVersions) ||
    latest.pendingVersions.length ||
    [attempt.createdAt, latest.observedAt].some(
      (t) => !Number.isFinite(Date.parse(t)) || Date.parse(t) < a.startsAt || Date.parse(t) > a.closedAt,
    )
  )
    fail();
  for (const suffix of ['owner-provision-attempt', 'unprovisioned-archive-attempt', 'reactivation-attempt'])
    if (x.physical(join(repo, db + '-' + suffix + '.json'), true)) fail();
  if (x.physical(join(repo, 'scripts/n8n/out/foundation/live/runtime.technical-10.jsonl'), true)) fail();
  pins[catalogReadonlyRecovery.relative] = catalogReadonlyRecovery.sha256;
  return Object.freeze({
    ...x.recovery,
    mainManagementAttempts: 277,
    mainControlAttempts: 585,
    controlRows: 590,
    catalogReadonlyTechnicalAttempt: 10,
    catalogReadonlyPins: Object.freeze([catalogReadonlyRecovery.relative, ...immutable]),
    pins: Object.freeze(pins),
  });
}
function approvedCatalogManagementAllocation(x) {
  if (!catalogManagementAllocationApproval) return null;
  if (
    x.recovery?.catalogReadonlyTechnicalAttempt !== 10 ||
    x.recovery.managementMaximum !== 640 ||
    x.recovery.mainManagementAttempts !== 277 ||
    x.recovery.carriedManagementAttempts !== 11 ||
    x.recovery.mainControlAttempts !== 585 ||
    x.recovery.carriedControlAttempts !== 3 ||
    x.recovery.setupAttempts !== 79
  )
    fail();
  const text = x.file(catalogManagementAllocationApproval.relative);
  if (
    hash(text) !== catalogManagementAllocationApproval.sha256 ||
    hash(x.file(catalogManagementAllocationApproval.packetRelative)) !==
      catalogManagementAllocationApproval.packetSha256
  )
    fail();
  const a = JSON.parse(text);
  const match = (value, expected) => {
    if (!exact(value, Object.keys(expected)) || Object.entries(expected).some(([key, v]) => value[key] !== v))
      fail();
  };
  if (
    !exact(a, [
      'kind',
      'recordedAt',
      'clientDate',
      'ownerReply',
      'decision',
      'environment',
      'milestone',
      'referencePacket',
      'reviewedDelivery',
      'allocation',
      'actualPriorUsage',
      'unchangedCaps',
      'limitsPreserved',
      'boundaries',
      'acceptance',
    ]) ||
    a.kind !== 'm03_cumulative_management_after_catalog_approval' ||
    a.ownerReply !== 'Approve Management704; retain all charges and other limits' ||
    a.decision !== 'approved' ||
    a.environment !== 'dev' ||
    a.milestone !== 'M03' ||
    a.clientDate !== '2026-10-24' ||
    !Number.isFinite(Date.parse(a.recordedAt)) ||
    Date.parse(a.recordedAt) > x.clock()
  )
    fail();
  const reviewedHead = '4b31c5f8447d79418b8572a872a86afd5722244d';
  match(a.referencePacket, {
    path: catalogManagementAllocationApproval.packetRelative,
    sha256: catalogManagementAllocationApproval.packetSha256,
    sourceCommitSha: reviewedHead,
    url:
      'https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/blob/' +
      reviewedHead +
      '/' +
      catalogManagementAllocationApproval.packetRelative,
  });
  match(a.reviewedDelivery, {
    ciRunId: 40055207916,
    ciAttempt: 1,
    headSha: reviewedHead,
    quality: 'success',
    unit: 'success',
    build: 'success',
    e2e: 'success',
    dbTests: 'success',
    vercel: 'success',
    pullRequest: 8,
    pullRequestOpen: true,
    pullRequestDraft: true,
  });
  match(a.allocation, {
    previousManagementMaximum: 640,
    managementMaximum: 704,
    usedManagementRequests: 288,
    remainingManagementRequestsMaximum: 416,
    remainingPlanMaximum: 376,
    planCumulativeMaximum: 664,
    reserveAbovePlan: 40,
    vercelMaximum: 132,
    usedVercelRequests: 79,
    remainingVercelPlanMaximum: 44,
    vercelPlanCumulativeMaximum: 123,
    vercelIncludedInManagement: true,
    countersReset: false,
  });
  match(a.actualPriorUsage, {
    management: 288,
    control: 588,
    combined: 876,
    vercel: 79,
    actorStarts: 0,
    actorSpendUsd: 0,
    reconciliationPath: catalogReadonlyRecovery.relative,
    reconciliationSha256: catalogReadonlyRecovery.sha256,
  });
  match(a.unchangedCaps, {
    control: caps.control,
    combined: caps.combined,
    nativeExecutions: caps.nativeExecutions,
    gatewayAttempts: caps.gatewayAttempts,
    directProviderReads: caps.providerGetAttempts,
    actorStarts: 2,
    maxActorUsd: 1,
    actorReserveUsd: 2,
    actorsSequential: true,
    newDistinctCollectedItems: 1,
  });
  match(a.limitsPreserved, {
    historicalAttempts: true,
    closedWindows: true,
    priorRequestIntentsAndSideEffectIds: true,
    dev15AndOriginal14Fingerprints: true,
    seededDataExclusionsAndLogos: true,
    restoredWf00: true,
    closedDf4: true,
    closed38b: true,
    archivedC999: true,
    perRequestDurableAccounting: true,
    cleanupReserveBeforeNewWork: true,
    noBlindReplayOrOverlappingUncertainWork: true,
  });
  match(a.boundaries, {
    spendingIncrease: false,
    actorAllowanceReplenished: false,
    productionApproved: false,
    migrationReplayApproved: false,
    recurringActivityApproved: false,
    externalMessagingApproved: false,
    sharedCredentialRotationApproved: false,
    mergeApproved: false,
    m04Approved: false,
    credentialDelivery: false,
    timeWindowRenewal: false,
  });
  match(a.acceptance, {
    allocationDecisionComplete: true,
    executionStartedByThisRecord: false,
    consumerIntegrationVerified: false,
    m03DevAcceptanceVerified: false,
  });
  return Object.freeze({ ...x.recovery, managementMaximum: 704 });
}
function reconciledAdminAdmissionReadonly(x) {
  if (!adminAdmissionReadonlyRecovery) return null;
  if (
    x.recovery?.catalogReadonlyTechnicalAttempt !== 10 ||
    x.recovery.managementMaximum !== 704 ||
    x.recovery.mainManagementAttempts !== 277 ||
    x.recovery.carriedManagementAttempts !== 11 ||
    x.recovery.mainControlAttempts !== 585 ||
    x.recovery.carriedControlAttempts !== 3
  )
    fail();
  const text = x.file(adminAdmissionReadonlyRecovery.relative);
  if (hash(text) !== adminAdmissionReadonlyRecovery.sha256) fail();
  const r = JSON.parse(text),
    a = r.attempt;
  const match = (value, expected) => {
    if (!value || Object.entries(expected).some(([key, v]) => value[key] !== v)) fail();
  };
  match(r, {
    kind: 'm03_technical11_admin_admission_reconciliation',
    version: 1,
    environment: 'dev',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
  });
  if (!Number.isFinite(Date.parse(r.recordedAt)) || Date.parse(r.recordedAt) > x.clock()) fail();
  match(r.source, {
    helperHead: '9d9edf37f310f82647837e5b4cef31876a89b244',
    applicationSource: foundationProjectVerifiedActiveRuntime.sourceCommitSha,
    ciRun: 40082014843,
    ciAttempt: 1,
    allFiveJobsPassed: true,
    vercelPassed: true,
    pr: 8,
    prDraft: true,
  });
  match(a, {
    technicalAttempt: 11,
    segmentId: c.segmentId,
    windowId: foundationProjectVerifiedActiveRuntime.windowId,
    nativeExit: 1,
    prepareId: 'm03_live_021',
    prepareStatus: 'blocked',
    prepareCode: null,
    restoreId: 'm03_live_022',
    restoreStatus: 'restoration_residual',
    closeId: 'm03_live_023',
    sourceCloseStatus: 'residual',
    baselineDefinitionGets: 25,
    executionDiscoveryGets: 50,
    browserDiscoveryCalls: 1,
    newGatewayPreflightAttempts: 0,
    newProviderDirectAttempts: 0,
    nativeExecutions: 0,
    actorStarts: 0,
    previewSetupAttempted: false,
    sqlProvisionAttempted: false,
    fixtureReactivationAttempted: false,
    migrationOperationAttempted: false,
  });
  match(r.localCause, {
    consumerRelative: 'scripts/db/foundation-admin-client.mjs',
    sealedConsumerSha256: '82e9bd5acf5e412e5c1d54b332c8f7543e8f8497dd4ebb38d3cbae871662249f',
    predicate: 'forwardWindow && verifiedCheckpoint.managementMaximum === 640',
    actualManagementMaximum: 704,
    actualSource: foundationProjectVerifiedActiveRuntime.sourceCommitSha,
    actualWindowId: foundationProjectVerifiedActiveRuntime.windowId,
    incorrectSelectedSource: priorActiveRuntime.sourceCommitSha,
    incorrectSelectedWindowId: priorActiveRuntime.windowId,
    genericThrowBeforeSpawn: true,
    adminChildSpawned: false,
    adminDecryptionAttempted: false,
    databaseAuthenticationAttempted: false,
    dbTechnical11FilesAbsent: true,
    nativeLocalRedSpawnCount: 0,
    nativeLocalRedFailed: true,
  });
  match(r.rawSourceClose, {
    kind: 'm03_acceptance_closed',
    status: 'residual',
    managementAttempts: 313,
    controlAttempts: 639,
    nativeExecutions: 0,
    gatewayPreflightAttempts: 2,
    providerDirectAttempts: 0,
    phaseBReady: false,
    domainProofReady: false,
    businessAcceptanceProven: false,
    childTransportsClosed: false,
    adminChildClosed: false,
    windowClosed: false,
    fixtureArchived: false,
    baselineRestored: false,
    environmentCleanupVerified: false,
    remoteWorkSettled: false,
    residual: true,
  });
  match(r.rawWrapperClose, {
    kind: 'm03_acceptance_wrapper_closed',
    childClosed: true,
    credentialChildrenClosed: false,
    emergencyShutdown: false,
    nativeExit: 1,
    handoffsDeleted: false,
    bypassHandoffDeleted: false,
    pendingMachinePreserved: true,
    privateRead: true,
    code: 'M03_ACCEPTANCE_BLOCKED',
  });
  match(r.cleanup, {
    nativeExit: 0,
    networkRequests: 0,
    knownParentAndRuntimeAbsent: true,
    knownDescendantsAbsent: true,
    adminChildNeverSpawned: true,
    allTenLeavesAbsent: true,
    runtimeLockAbsent: true,
    allStreamsDestroyed: true,
    publicReceiptClosed: true,
    persistentOriginalsPreserved: true,
    retainedMachinePreserved: true,
    ciphertextReadForCleanup: false,
    decryptedForCleanup: false,
    credentialContentsReadForCleanup: false,
    temporaryLeavesDeleted: 10,
  });
  match(r.usage, {
    mainManagement: 302,
    carriedManagement: 11,
    management: 313,
    mainControl: 636,
    carriedControl: 3,
    control: 639,
    combined: 952,
    vercel: 79,
    managementMaximum: 704,
    controlMaximum: 2048,
    combinedMaximum: 2560,
    vercelMaximum: 132,
    actorStarts: 0,
    actorMaximum: 2,
    actorReserveUsd: 2,
    allowancesReplenished: false,
    nextConservativeManagement: 689,
    nextConservativeVercel: 123,
  });
  match(r.acceptance, {
    actualM03DevAcceptanceVerified: false,
    fullDVerified: false,
    freshDatabaseSchemaReverified: false,
    priorDatabaseReceiptPreserved: catalogReadonlyRecovery.relative,
    productionTouched: false,
    mergeApproved: false,
    m04Started: false,
  });
  const counts = { management: 303, control: 642, setup: 155, preflight: 6, runtime: 50 };
  if (
    !exact(r.journalCounts, Object.keys(counts)) ||
    Object.entries(counts).some(([key, v]) => r.journalCounts[key] !== v)
  )
    fail();
  const { pins, immutable } = reconcileReadonlyDiscoveryRecords(
    x,
    {
      ...r,
      source: { ...r.source, head: r.source.helperHead },
      attempt: {
        ...a,
        technicalOrdinal: a.technicalAttempt,
        prepareCommand: a.prepareId,
        restoreCommand: a.restoreId,
      },
    },
    counts,
  );
  const base = `scripts/n8n/out/foundation/live/project-verified-continuation-${c.segmentId}.technical-11`;
  const frames = jsonl(x.file(base + '.public-frames.jsonl'), 10).rows;
  if (
    JSON.stringify(frames[7]) !== JSON.stringify(r.rawSourceClose) ||
    JSON.stringify(frames[8]) !== JSON.stringify(r.rawWrapperClose) ||
    JSON.stringify(JSON.parse(x.file(base + '.closed.json'))) !== JSON.stringify(r.rawTechnicalClose)
  )
    fail();
  for (const suffix of [
    'attempt',
    'latest',
    'owner-provision-attempt',
    'unprovisioned-archive-attempt',
    'reactivation-attempt',
  ])
    if (
      x.physical(
        join(
          repo,
          `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-11-${suffix}.json`,
        ),
        true,
      )
    )
      fail();
  if (x.physical(join(repo, 'scripts/n8n/out/foundation/live/runtime.technical-11.jsonl'), true)) fail();
  pins[adminAdmissionReadonlyRecovery.relative] = adminAdmissionReadonlyRecovery.sha256;
  return Object.freeze({
    ...x.recovery,
    mainManagementAttempts: 302,
    mainControlAttempts: 636,
    controlRows: 642,
    adminAdmissionReadonlyTechnicalAttempt: 11,
    adminAdmissionReadonlyPins: Object.freeze([adminAdmissionReadonlyRecovery.relative, ...immutable]),
    pins: Object.freeze(pins),
  });
}
function currentReadiness(x) {
  if (!x.recovery?.closedWindow) return null;
  assertSetupAllocationApproval(x);
  if (activeRuntime(x.recovery).setupMaximum - x.recovery.setupAttempts < 14 + 18)
    return 'setup_cap_insufficient';
  if (
    x.recovery.mainManagementAttempts + x.recovery.carriedManagementAttempts + 25 + 44 + 308 >
    (x.recovery.managementMaximum ?? caps.runtimeManagement)
  )
    return 'management_cap_insufficient';
  const active = activeRuntime(x.recovery);
  if (
    typeof active.sourceCommitSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(active.sourceCommitSha) ||
    active.sourceCommitSha === c.sourceCommitSha ||
    !positive(active.sourceCi) ||
    active.allFiveCiJobsPassed !== true ||
    active.vercelPassed !== true
  )
    return 'application_source_unselected';
  return null;
}
function blockedReadiness(x, status) {
  return Object.freeze({
    kind: 'project_verified_continuation_blocked',
    status,
    segmentId: c.segmentId,
    sourceCommitSha: activeRuntime(x.recovery).sourceCommitSha,
    windowId: activeRuntime(x.recovery).windowId,
    managementAttempts: x.recovery.mainManagementAttempts + x.recovery.carriedManagementAttempts,
    controlAttempts: x.recovery.mainControlAttempts + x.recovery.carriedControlAttempts,
    combinedAttempts:
      x.recovery.mainManagementAttempts +
      x.recovery.carriedManagementAttempts +
      x.recovery.mainControlAttempts +
      x.recovery.carriedControlAttempts,
    gatewayPreflightAttempts: x.recovery.gatewayPreflightAttempts,
    setupAttempts: x.recovery.setupAttempts,
    setupMaximum: activeRuntime(x.recovery).setupMaximum,
    minimumNewSetupRequests: 32,
    proposedSetupMaximum: activeRuntime(x.recovery).proposedSetupMaximum,
    privateRead: false,
    networkRequests: 0,
  });
}
function recoveryPreflight(x, initial = false) {
  if (!x.recovery) return;
  const path = 'scripts/n8n/out/foundation/live/preflight.jsonl';
  const text = x.file(path),
    rows = jsonl(text, 500);
  const prefix = rows.lines.slice(0, x.recovery.preflightRows).join('\n') + '\n';
  if (
    rows.rows.length < x.recovery.preflightRows ||
    hash(prefix) !== x.recovery.pins[path] ||
    (initial && text !== prefix)
  )
    fail();
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
    ['management', (x.recovery?.managementMaximum ?? caps.runtimeManagement) + 1, 3],
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
    const recoveredPrefix = x.recovery
      ? {
          management: x.recovery.mainManagementAttempts + 1,
          control: x.recovery.controlRows ?? x.recovery.mainControlAttempts,
          setup: x.recovery.setupRows,
        }[name]
      : prefix;
    const recoveredText = v.lines.slice(0, recoveredPrefix).join('\n') + '\n';
    if (
      v.lines.length < prefix ||
      hash(first) !== j[name].sha256 ||
      (x.recovery &&
        (v.lines.length < recoveredPrefix || hash(recoveredText) !== x.recovery.pins[j[name].path])) ||
      (initial && text !== recoveredText)
    )
      fail();
    values[name] = { text, rows: v.rows };
  }
  const [header, ...management] = values.management.rows;
  if (
    !exact(header, ['event', 'version', 'sourceCommitSha', 'deadlineAt']) ||
    header.event !== 'management_header' ||
    header.version !== 1 ||
    header.sourceCommitSha !== c.sourceCommitSha ||
    header.deadlineAt !== c.originalDeadlineAt ||
    management.length + (x.recovery?.carriedManagementAttempts ?? 4) >
      (x.recovery?.managementMaximum ?? caps.runtimeManagement) ||
    management.some(
      (r, i) => !exact(r, ['event', 'ordinal']) || r.event !== 'management_attempt' || r.ordinal !== i + 1,
    )
  )
    fail();
  const control = values.control.rows.filter((r) => r.event === 'control_request_intent');
  if (
    control.length + (x.recovery?.carriedControlAttempts ?? 1) > 2048 ||
    control.some((r, i) => r.ordinal !== i + 1) ||
    (initial &&
      (control.length !== (x.recovery?.mainControlAttempts ?? 200) ||
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
  const active = technicalPaths(x);
  if (active.exists && !admitted) closedTechnicalAttempt(x, active);
  if (admitted && x.physical(join(repo, active.claimRelative), true)) fail();
  for (const name of ['preflight', 'runtime']) {
    const t = x.file(`scripts/n8n/out/foundation/live/${name}.jsonl`, { optional: true });
    if (x.recovery && name === 'preflight') {
      if (
        t === null ||
        hash(t) !== x.recovery.pins[`scripts/n8n/out/foundation/live/${name}.jsonl`] ||
        jsonl(t, x.recovery.preflightRows).rows.length !== x.recovery.preflightRows
      )
        fail();
    } else if (x.recovery?.closedWindow && name === 'runtime') {
      if (
        t === null ||
        hash(t) !== x.recovery.pins['scripts/n8n/out/foundation/live/runtime.jsonl'] ||
        jsonl(t, 1800).rows.length !== x.recovery.runtimeRows
      )
        fail();
    } else if (t !== null && t !== '') fail();
  }
  for (const path of [
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
    if (
      x.physical(join(repo, path), true) &&
      (!x.recovery || x.recovery.pins[path] === undefined || hash(x.file(path)) !== x.recovery.pins[path])
    )
      fail();
  if (x.recovery) {
    const ordinal = admitted ? active.ordinal : active.ordinal + 1;
    if (
      x.recovery.closedWindow &&
      x.physical(join(repo, `scripts/n8n/out/foundation/live/runtime.technical-${ordinal}.jsonl`), true)
    )
      fail();
    for (const suffix of [
      'attempt',
      'latest',
      'owner-provision-attempt',
      'unprovisioned-archive-attempt',
      'reactivation-attempt',
    ])
      if (
        x.physical(
          join(
            repo,
            `scripts/db/out/m03-foundation-project-verified-continuation-${c.segmentId}-technical-${ordinal}-${suffix}.json`,
          ),
          true,
        )
      )
        fail();
  }
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
// Technical retries use this existing coordinator and immutable sibling records.
// The original admission/claim and all closed clocks remain untouched. A retry
// is automatic for a proven no-effect closure, or the separately pinned public
// effect reconciliation above. Unrecognized effects/counters still fail closed.
function attemptPaths(ordinal) {
  const stem = c.admissionRelative.slice(0, -5) + (ordinal === 1 ? '' : `.technical-${ordinal}`);
  return {
    ordinal,
    admissionRelative: stem + '.json',
    claimRelative: stem + '.runtime-claim.json',
    closedRelative: stem + '.closed.json',
  };
}
function technicalPaths(x) {
  let active = attemptPaths(1);
  active.exists = !!x.physical(join(repo, active.admissionRelative), true);
  if (!active.exists) {
    if (
      x.physical(join(repo, active.claimRelative), true) ||
      x.physical(join(repo, active.closedRelative), true)
    )
      fail();
    return active;
  }
  for (let ordinal = 2; ordinal <= 1024; ordinal++) {
    const next = attemptPaths(ordinal);
    if (!x.physical(join(repo, next.admissionRelative), true)) {
      if (
        x.physical(join(repo, next.claimRelative), true) ||
        x.physical(join(repo, next.closedRelative), true)
      )
        fail();
      return active;
    }
    const closed = closedTechnicalAttempt(x, active);
    const nextData = record(x, { paths: next, allowExpired: true, checkParent: false });
    if (nextData.r.startsAt < closed.closedAt) fail();
    active = { ...next, exists: true };
  }
  fail();
}
function closedTechnicalAttempt(x, paths) {
  const data = record(x, { paths, allowExpired: true, checkParent: false });
  const text = x.file(paths.closedRelative),
    close = JSON.parse(text);
  const reconciled =
    (paths.ordinal === 1 && x.recovery !== null && x.recovery !== undefined) ||
    (paths.ordinal === 2 && x.recovery?.closedWindow === true) ||
    (paths.ordinal === 3 && x.recovery?.readonlyTechnicalAttempt === 3) ||
    (paths.ordinal === 4 && [4, 5].includes(x.recovery?.nativeDiscoveryTechnicalAttempt)) ||
    (paths.ordinal === 5 && x.recovery?.nativeDiscoveryTechnicalAttempt === 5) ||
    (paths.ordinal === 6 && x.recovery?.baselineDiscoveryTechnicalAttempt === 6) ||
    (paths.ordinal === 7 && x.recovery?.closedPreparationTechnicalAttempt === 7) ||
    (paths.ordinal === 8 && x.recovery?.closedFixtureTechnicalAttempt === 8) ||
    (paths.ordinal === 9 && x.recovery?.preprivateAdminTechnicalAttempt === 9) ||
    (paths.ordinal === 10 && x.recovery?.catalogReadonlyTechnicalAttempt === 10) ||
    (paths.ordinal === 11 && x.recovery?.adminAdmissionReadonlyTechnicalAttempt === 11);
  const noAdminSpawnReconciled =
    paths.ordinal === 11 && x.recovery?.adminAdmissionReadonlyTechnicalAttempt === 11;
  if (
    !exact(close, [
      'kind',
      'version',
      'admissionSha256',
      'parentProcessId',
      'runtimeProcessId',
      'closedAt',
      'childClosed',
      'credentialChildrenClosed',
      'emergencyShutdown',
      'pendingMachinePreserved',
      'nativeExit',
      'bypassHandoffDeleted',
      'closureVerified',
    ]) ||
    close.kind !== 'm03_project_verified_technical_closed' ||
    close.version !== 1 ||
    close.admissionSha256 !== hash(data.text) ||
    close.parentProcessId !== data.r.parentProcessId ||
    !(close.runtimeProcessId === null || positive(close.runtimeProcessId)) ||
    (data.claim && close.runtimeProcessId !== data.claim.processId) ||
    !Number.isSafeInteger(close.closedAt) ||
    close.closedAt < data.r.startsAt ||
    close.closedAt > x.clock() ||
    close.childClosed !== true ||
    close.credentialChildrenClosed !== !noAdminSpawnReconciled ||
    close.emergencyShutdown !== false ||
    close.pendingMachinePreserved !== true ||
    !(
      (close.runtimeProcessId === null && close.nativeExit === null) ||
      (Number.isSafeInteger(close.nativeExit) && close.nativeExit >= 0)
    ) ||
    (!reconciled && (close.bypassHandoffDeleted !== true || close.closureVerified !== true)) ||
    text !== JSON.stringify(close) + '\n' ||
    x.io.processAlive(close.parentProcessId) !== false ||
    (close.runtimeProcessId !== null && x.io.processAlive(close.runtimeProcessId) !== false)
  )
    fail();
  return close;
}
function record(x, { paths = technicalPaths(x), allowExpired = false, checkParent = true } = {}) {
  const text = x.file(paths.admissionRelative),
    r = JSON.parse(text);
  const active =
    x.recovery?.closedWindow && paths.ordinal >= 3
      ? paths.ordinal >= 9
        ? activeRuntime(x.recovery)
        : priorActiveRuntime
      : c;
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
    r.sourceCommitSha !== active.sourceCommitSha ||
    r.windowId !== active.windowId ||
    r.approvalSha256 !== c.approvalSha256 ||
    !Number.isSafeInteger(r.startsAt) ||
    r.startsAt < x.approvedAt ||
    r.deadlineAt !== r.startsAt + 3600000 ||
    r.stopNewAt !== r.startsAt + 3000000 ||
    r.hardDeadlineAt !== r.startsAt + 4200000 ||
    !positive(r.parentProcessId) ||
    text !== JSON.stringify(r) + '\n' ||
    x.clock() < r.startsAt ||
    (!allowExpired && x.clock() >= r.stopNewAt)
  )
    fail();
  if (checkParent) x.parent(r.parentProcessId);
  journals(x);
  const ct = x.file(paths.claimRelative, { optional: true }),
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
  return { r, text, claim, checkpoint: x.checkpoint, paths, recovery: x.recovery };
}
function proof(data, claimed = false) {
  const p = Object.freeze({
    kind: 'foundation_project_verified_continuation',
    segmentId: c.segmentId,
    sourceCommitSha: data.r.sourceCommitSha,
    windowId: data.r.windowId,
    startsAt: data.r.startsAt,
    deadlineAt: data.r.deadlineAt,
    stopNewAt: data.r.stopNewAt,
    hardDeadlineAt: data.r.hardDeadlineAt,
    carriedManagementAttempts: data.recovery?.carriedManagementAttempts ?? 4,
    carriedControlAttempts: data.recovery?.carriedControlAttempts ?? 1,
  });
  proofs.set(p, {
    admissionSha256: hash(data.text),
    claimed,
    processId: data.claim?.processId,
    controlPrefixSha256:
      data.recovery?.pins[data.checkpoint.journals.control.path] ?? data.checkpoint.journals.control.sha256,
    checkpoint: data.checkpoint,
    recovery: data.recovery,
    resume: Object.freeze({
      mainManagementAttempts: data.recovery?.mainManagementAttempts ?? 2,
      aggregateManagementAttempts:
        (data.recovery?.mainManagementAttempts ?? 2) + (data.recovery?.carriedManagementAttempts ?? 4),
      managementMaximum: data.recovery?.managementMaximum ?? caps.runtimeManagement,
      mainControlAttempts: data.recovery?.mainControlAttempts ?? 200,
      aggregateControlAttempts:
        (data.recovery?.mainControlAttempts ?? 200) + (data.recovery?.carriedControlAttempts ?? 1),
      setupRows: data.recovery?.setupRows ?? 2,
      setupAttempts: data.recovery?.setupAttempts ?? 2,
      preflightRows: data.recovery?.preflightRows ?? 0,
      technicalAttemptOrdinal: data.paths.ordinal,
      ...(data.recovery?.closedWindow
        ? {
            closedWindow: true,
            gatewayPreflightAttempts: data.recovery.gatewayPreflightAttempts,
            legacySqlAdmitted: data.recovery.legacySqlAdmitted,
            headerSourceCommitSha: c.sourceCommitSha,
            activeWindowId: data.r.windowId,
            setupMaximum: activeRuntime(data.recovery).setupMaximum,
            ...(data.recovery.closedFixtureTechnicalAttempt === 8
              ? { historicalWindowIds: Object.freeze([c.windowId, priorActiveRuntime.windowId]) }
              : {}),
            runtimeFilename: `runtime.technical-${data.paths.ordinal}.jsonl`,
          }
        : {}),
    }),
  });
  return p;
}
export function assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed = false } = {}) {
  const meta = proofs.get(p);
  if (!meta || !Object.isFrozen(p) || (claimed && (meta.claimed !== true || meta.processId !== process.pid)))
    fail();
  return p;
}
export function foundationProjectVerifiedContinuationResumeCheckpoint(p) {
  assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed: true });
  return proofs.get(p).resume;
}
export function assertFoundationProjectVerifiedContinuationSetupResume(
  p,
  { sourceCommitSha, deadlineAt, previousEvents },
) {
  assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed: true });
  assertFoundationProjectVerifiedContinuationJournalPrefixes(p);
  const meta = proofs.get(p);
  if (
    sourceCommitSha !== p.sourceCommitSha ||
    deadlineAt !== p.deadlineAt ||
    !Array.isArray(previousEvents) ||
    previousEvents.length !== meta.resume.setupRows ||
    (meta.recovery
      ? hash(previousEvents.map((r) => JSON.stringify(r) + '\n').join('')) !==
        meta.recovery.pins[meta.checkpoint.journals.setup.path]
      : JSON.stringify(previousEvents) !==
        JSON.stringify([
          { event: 'setup_attempt', ordinal: 1, kind: 'GET', at: 1792608136543 },
          { event: 'setup_attempt', ordinal: 2, kind: 'GET', at: 1792666486587 },
        ]))
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
    previousEvents.length !==
      (proofs.get(p).recovery?.controlRows ?? proofs.get(p).resume.mainControlAttempts) ||
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
  x.recovery = proofs.get(p).recovery;
  if (x.recovery?.wf70DiagnosticControlAttempts === 2) {
    for (const [path, expected] of [
      [wf70DiagnosticRecovery.relative, wf70DiagnosticRecovery.sha256],
      [wf70DiagnosticRecovery.journalRelative, wf70DiagnosticRecovery.journalSha256],
    ])
      if (hash(x.file(path)) !== expected) fail();
  }
  if ([576, 640, 704].includes(x.recovery?.managementMaximum)) {
    for (const [path, expected] of [
      [managementAllocationApproval.relative, managementAllocationApproval.sha256],
      [managementAllocationApproval.packetRelative, managementAllocationApproval.packetSha256],
    ])
      if (hash(x.file(path)) !== expected) fail();
  }
  if ([640, 704].includes(x.recovery?.managementMaximum)) {
    for (const [path, expected] of [
      [controlManagementAllocationApproval.relative, controlManagementAllocationApproval.sha256],
      [controlManagementAllocationApproval.packetRelative, controlManagementAllocationApproval.packetSha256],
    ])
      if (hash(x.file(path)) !== expected) fail();
  }
  if (x.recovery?.managementMaximum === 704) {
    for (const [path, expected] of [
      [catalogManagementAllocationApproval.relative, catalogManagementAllocationApproval.sha256],
      [catalogManagementAllocationApproval.packetRelative, catalogManagementAllocationApproval.packetSha256],
    ])
      if (hash(x.file(path)) !== expected) fail();
  }
  if (x.recovery?.closedFixtureTechnicalAttempt === 8)
    for (const path of x.recovery.closedFixturePins) if (hash(x.file(path)) !== x.recovery.pins[path]) fail();
  if (x.recovery?.preprivateAdminTechnicalAttempt === 9)
    for (const path of x.recovery.preprivateAdminPins)
      if (hash(x.file(path)) !== x.recovery.pins[path]) fail();
  if (x.recovery?.catalogReadonlyTechnicalAttempt === 10)
    for (const path of x.recovery.catalogReadonlyPins)
      if (hash(x.file(path)) !== x.recovery.pins[path]) fail();
  if (x.recovery?.adminAdmissionReadonlyTechnicalAttempt === 11)
    for (const path of x.recovery.adminAdmissionReadonlyPins)
      if (hash(x.file(path)) !== x.recovery.pins[path]) fail();
  if (x.recovery?.closedPreparationTechnicalAttempt === 7)
    for (const path of x.recovery.closedPreparationPins)
      if (hash(x.file(path)) !== x.recovery.pins[path]) fail();
  recoveryPreflight(x);
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
    const readiness = currentReadiness(x);
    if (readiness) return blockedReadiness(x, readiness);
    return Object.freeze({
      kind: approved
        ? 'project_verified_continuation_ready'
        : 'project_verified_continuation_approval_required',
      ...(approved ? {} : { status: 'approval_required', approvalRequired: true }),
      segmentId: c.segmentId,
      sourceCommitSha: x.recovery?.closedWindow
        ? activeRuntime(x.recovery).sourceCommitSha
        : c.sourceCommitSha,
      windowId: x.recovery?.closedWindow ? activeRuntime(x.recovery).windowId : c.windowId,
      privateRead: false,
      networkRequests: 0,
      ...([576, 640, 704].includes(x.recovery?.managementMaximum)
        ? {
            managementMaximum: x.recovery.managementMaximum,
            managementAttempts: x.recovery.mainManagementAttempts + x.recovery.carriedManagementAttempts,
            controlAttempts: x.recovery.mainControlAttempts + x.recovery.carriedControlAttempts,
            combinedAttempts:
              x.recovery.mainManagementAttempts +
              x.recovery.carriedManagementAttempts +
              x.recovery.mainControlAttempts +
              x.recovery.carriedControlAttempts,
          }
        : {}),
    });
  } catch {
    fail();
  }
}
export function reconcileFoundationProjectVerifiedContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    checkpoint(x);
    approval(x);
    initial(x, false);
    const readiness = currentReadiness(x);
    if (readiness) return blockedReadiness(x, readiness);
    return Object.freeze({
      status: x.recovery ? 'ready_reconciled_effects' : 'ready_no_effects',
      privateRead: false,
      networkRequests: 0,
    });
  } catch {
    return Object.freeze({ status: 'reconciliation_required', privateRead: false, networkRequests: 0 });
  }
}
export function admitFoundationProjectVerifiedContinuation(options = {}, dependencies = {}) {
  try {
    const x = context(options, dependencies);
    checkpoint(x);
    approval(x);
    if (currentReadiness(x)) fail();
    const values = initial(x),
      parent = x.parent(undefined, true),
      startsAt = x.clock();
    const previous = technicalPaths(x),
      paths = previous.exists ? attemptPaths(previous.ordinal + 1) : previous;
    const active = x.recovery?.closedWindow ? activeRuntime(x.recovery) : c;
    x.create(paths.admissionRelative, {
      kind: 'm03_project_verified_continuation_admission',
      version: 1,
      segmentId: c.segmentId,
      sourceCommitSha: active.sourceCommitSha,
      windowId: active.windowId,
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
    if (values.management.rows.length !== (x.recovery?.mainManagementAttempts ?? 2) + 1) fail();
    x.parent(data.r.parentProcessId, true);
    x.create(data.paths.claimRelative, {
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
      mode === 'Reconcile'
        ? reconcileFoundationProjectVerifiedContinuation()
        : mode === 'CheckOnly'
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
