import { lookup as osLookup } from 'node:dns';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readFileSync,
  existsSync,
  openSync,
  fstatSync,
  lstatSync,
  writeSync,
  fsyncSync,
  closeSync,
  constants,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const host = 'muhhammedsayed.app.n8n.cloud';
const projectId = 'pHvQjDmjxVZ3KQLT';
const maxBytes = 4 * 1024 * 1024;
const runtimeReconciliationCheckpoint = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json',
  sha256: '226ed15257e8fb5ac2c81f454631bcf11773f67ce9fdc15d6048184389260983',
  management: 483,
  mainManagement: 472,
  control: 791,
  mainControl: 788,
  windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
  sourceCommitSha: '7b1837201ac7925591577a1517d7288936ca3464',
});
const runtimeReconciliationPaths = Object.freeze({
  management: 'scripts/n8n/out/foundation/live/management.jsonl',
  control: 'scripts/n8n/out/foundation/live/control.jsonl',
  runtime: 'scripts/n8n/out/foundation/live/runtime.technical-13.jsonl',
  provision:
    'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-13-owner-provision-attempt.json',
  claim: 'scripts/n8n/out/foundation/runtime-reconciliation-diagnostic-technical13-20261024.jsonl',
});
const publicDigest = (v) => createHash('sha256').update(v).digest('hex');
function readRuntimePublicFile(root, relative, encoding = 'utf8') {
  if (
    typeof relative !== 'string' ||
    /[:\x00]|(?:^|[/\\])\.\.(?:[/\\]|$)/.test(relative) ||
    resolve(root, relative) !== join(root, relative)
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  const path = join(root, relative);
  for (let cursor = path; ; cursor = dirname(cursor)) {
    if (lstatSync(cursor).isSymbolicLink()) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    if (dirname(cursor) === cursor) break;
  }
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 2097152)
      throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    return readFileSync(fd, encoding);
  } finally {
    closeSync(fd);
  }
}
export async function readRuntimeReconciliationContext(
  repositoryRoot = fileURLToPath(new URL('../../', import.meta.url)),
) {
  const root = resolve(repositoryRoot),
    cfg = runtimeReconciliationCheckpoint,
    text = readRuntimePublicFile(root, cfg.relative);
  if (publicDigest(text) !== cfg.sha256) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  const receipt = JSON.parse(text),
    paths = runtimeReconciliationPaths,
    pinned = {};
  if (!record(receipt.pins) || Object.keys(receipt.pins).length !== 15)
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  for (const [path, pin] of Object.entries(receipt.pins)) {
    if (
      !/^(?:scripts\/n8n\/out\/foundation\/live\/|scripts\/db\/out\/m03-foundation-project-verified-continuation-)/.test(
        path,
      ) ||
      typeof pin !== 'string' ||
      !/^[a-f0-9]{64}$/.test(pin)
    )
      throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    const value = readRuntimePublicFile(root, path),
      base = path === paths.management ? value.trimEnd().split('\n').slice(0, 473).join('\n') + '\n' : value;
    if (publicDigest(base) !== pin) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
  for (const name of ['management', 'control', 'runtime', 'provision']) {
    const path = paths[name],
      value = readRuntimePublicFile(root, path),
      pin = receipt.pins?.[path];
    if (typeof pin !== 'string' || !/^[a-f0-9]{64}$/.test(pin)) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    if (name === 'management') {
      const lines = value.trimEnd().split('\n');
      if (
        lines.length < 473 ||
        lines.length > 476 ||
        publicDigest(lines.slice(0, 473).join('\n') + '\n') !== pin
      )
        throw Error('RUNTIME_RECONCILIATION_BLOCKED');
      for (let i = 473; i < lines.length; i++)
        if (
          JSON.stringify(JSON.parse(lines[i])) !== JSON.stringify({ event: 'management_attempt', ordinal: i })
        )
          throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    } else if (publicDigest(value) !== pin) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
    pinned[name] = value;
  }
  const m = pinned.management.trimEnd().split('\n').map(JSON.parse),
    c = pinned.control.trimEnd().split('\n').map(JSON.parse),
    rows = pinned.runtime.trimEnd().split('\n').map(JSON.parse),
    provision = JSON.parse(pinned.provision);
  if (
    m.slice(0, 473).filter((v) => v.event === 'management_attempt').length !== 472 ||
    c.filter((v) => v.event === 'control_request_intent').length !== 788 ||
    c.length !== 796 ||
    rows.length !== 38 ||
    receipt.usage.management !== 483 ||
    receipt.usage.control !== 791 ||
    receipt.usage.combined !== 1274 ||
    provision.windowId !== cfg.windowId ||
    provision.packet.commitSha !== cfg.sourceCommitSha ||
    provision.packet.audience !==
      'https://everyone-market-researcher-7fcbxykan-muhammed-abdelrahman.vercel.app' ||
    provision.packet.deploymentId !== 'dpl_4hzfdXHd2F9B2Q89RiK2wVftzg25'
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  const { createFoundationRuntimePlan } = await import('./foundation-runtime-plan.mjs');
  const { createFoundationRuntimeJournal, foundationRuntimeState, runtimeGraphHash } =
    await import('./foundation-runtime-control.mjs');
  const bindings = JSON.parse(readRuntimePublicFile(root, 'n8n/foundation/bindings.dev.json')),
    transport = JSON.parse(readRuntimePublicFile(root, 'n8n/foundation/transport.dev.json'));
  const records = Object.keys(bindings.workflowRefs).map((k) =>
    JSON.parse(readRuntimePublicFile(root, 'n8n/workflows/' + k + '.json')),
  );
  const plan = createFoundationRuntimePlan({
    bindings,
    transport,
    records,
    activeWindowId: cfg.windowId,
    setup: {
      version: 1,
      projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      branch: 'm03-n8n-foundation',
      sourceCommitSha: cfg.sourceCommitSha,
      deploymentId: provision.packet.deploymentId,
      audience: provision.packet.audience,
      environment: 'preview',
      readyState: 'READY',
      protection: 'all_except_custom_domains',
      protectionVerified: true,
      protectionTransportVerified: true,
      sqlAudienceBindingVerified: true,
    },
  });
  const journal = createFoundationRuntimeJournal(plan, rows.slice(1), () => {
      throw Error('RUNTIME_RECONCILIATION_READ_ONLY');
    }),
    state = foundationRuntimeState(plan, journal);
  if (
    state.requestCount !== 22 ||
    state.pending?.sequence !== 7 ||
    state.pending.action !== 'save' ||
    state.pending.key !== 'SUB-NOTIFY' ||
    state.restoreComplete ||
    state.setupComplete ||
    !state.machineRebound
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  const expected = {};
  for (const key of ['SUB-NOTIFY', 'WF-90']) {
    const baseline = plan.baseline.find((b) => b.key === key),
      before = key === 'SUB-NOTIFY' ? state.pending.before : state.workflows[key];
    expected[key] = {
      id: baseline.id,
      tags: baseline.tags,
      baseline: {
        versionId: baseline.versionId,
        activeVersionId: null,
        graphHash: runtimeGraphHash(baseline.body),
        publishedHash: null,
      },
      before,
      target: key === 'SUB-NOTIFY' ? { ...state.pending.target, versionId: before.versionId } : before,
    };
  }
  return Object.freeze({
    root,
    receipt,
    plan,
    journal,
    state,
    expected,
    pinned,
    paths,
    managementAttempts: 483 + m.length - 473,
    controlAttempts: 791,
    combinedAttempts: 1274 + m.length - 473,
    receiptSha256: cfg.sha256,
  });
}
export async function openRuntimeReconciliationDiagnosticBudget(repositoryRoot) {
  const context = await readRuntimeReconciliationContext(repositoryRoot);
  if (context.managementAttempts !== 483 || 483 + 3 > 832 || 1274 + 3 > 2560)
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  let marker,
    management,
    closed = false,
    requests = 0;
  try {
    marker = openSync(
      join(context.root, context.paths.claim),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    const header =
      JSON.stringify({
        kind: 'm03_runtime_reconciliation_diagnostic',
        version: 1,
        technicalAttempt: 13,
        receiptSha256: context.receiptSha256,
        managementAttempts: 483,
        controlAttempts: 791,
        maximumRequests: 3,
        processId: process.pid,
        parentProcessId: process.ppid,
      }) + '\n';
    if (writeSync(marker, header, null, 'utf8') !== Buffer.byteLength(header)) throw Error();
    fsyncSync(marker);
    management = openSync(
      join(context.root, context.paths.management),
      constants.O_RDWR | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0),
    );
    if (readRuntimePublicFile(context.root, context.paths.management) !== context.pinned.management)
      throw Error();
  } catch {
    if (marker !== undefined) closeSync(marker);
    if (management !== undefined) closeSync(management);
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
  return Object.freeze({
    context,
    admit() {
      if (closed || requests >= 3) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
      const expected =
        context.pinned.management +
        Array.from(
          { length: requests },
          (_, i) => JSON.stringify({ event: 'management_attempt', ordinal: 473 + i }) + '\n',
        ).join('');
      const current = lstatSync(join(context.root, context.paths.management)),
        opened = fstatSync(management);
      if (
        current.isSymbolicLink() ||
        current.ino !== opened.ino ||
        current.dev !== opened.dev ||
        current.nlink !== 1 ||
        opened.nlink !== 1 ||
        readRuntimePublicFile(context.root, context.paths.management) !== expected
      )
        throw Error('RUNTIME_RECONCILIATION_BLOCKED');
      const line = JSON.stringify({ event: 'management_attempt', ordinal: 473 + requests }) + '\n';
      requests++;
      if (writeSync(management, line, null, 'utf8') !== Buffer.byteLength(line))
        throw Error('RUNTIME_RECONCILIATION_BLOCKED');
      fsyncSync(management);
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(management);
        closeSync(marker);
      }
    },
  });
}
const machineMetadataCheckpoint = Object.freeze({
  managementSha256: '96f1b856d23f4cd384014e715420b305dbf2f108c8ad2b446f9f8b036fc2b994',
  controlSha256: 'badae95523d4c57dd4370be827cfaf6c1da6c067913b703384a772646b5a18d1',
  mainManagement: 389,
  mainControl: 737,
  management: 400,
  control: 740,
});
export function openMachineMetadataDiagnosticBudget(
  repositoryRoot = fileURLToPath(new URL('../../', import.meta.url)),
) {
  const directory = join(repositoryRoot, 'scripts/n8n/out/foundation/live');
  let fd,
    used = false,
    closed = false;
  const read = (path, writable = false) => {
    for (let cursor = path; ; cursor = dirname(cursor)) {
      if (lstatSync(cursor).isSymbolicLink()) throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
      if (dirname(cursor) === cursor) break;
    }
    const handle = openSync(
      path,
      (writable ? constants.O_RDWR | constants.O_APPEND : constants.O_RDONLY) | (constants.O_NOFOLLOW ?? 0),
    );
    if (writable) fd = handle;
    try {
      const stat = fstatSync(handle);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 2097152)
        throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
      return readFileSync(handle, 'utf8');
    } finally {
      if (!writable) closeSync(handle);
    }
  };
  try {
    const management = read(join(directory, 'management.jsonl'), true),
      control = read(join(directory, 'control.jsonl'));
    const digest = (text) => createHash('sha256').update(text).digest('hex');
    if (
      digest(management) !== machineMetadataCheckpoint.managementSha256 ||
      digest(control) !== machineMetadataCheckpoint.controlSha256
    )
      throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
    const m = management.trimEnd().split('\n').map(JSON.parse),
      c = control.trimEnd().split('\n').map(JSON.parse);
    if (
      m.length !== 390 ||
      m.filter((r) => r.event === 'management_attempt').length !== machineMetadataCheckpoint.mainManagement ||
      c.length !== 744 ||
      c.filter((r) => r.event === 'control_request_intent').length !==
        machineMetadataCheckpoint.mainControl ||
      machineMetadataCheckpoint.management + 1 > 704 ||
      machineMetadataCheckpoint.management + machineMetadataCheckpoint.control + 1 > 2560
    )
      throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
  } catch {
    if (fd !== undefined) closeSync(fd);
    throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
  }
  return Object.freeze({
    admit() {
      if (closed || used) throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
      used = true;
      const text = JSON.stringify({ event: 'management_attempt', ordinal: 390 }) + '\n';
      if (writeSync(fd, text, null, 'utf8') !== Buffer.byteLength(text))
        throw Error('MACHINE_DIAGNOSTIC_BUDGET_BLOCKED');
      fsyncSync(fd);
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(fd);
      }
    },
  });
}
const wf00ExecutionCheckpoint = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/wf00-unadmitted-manual-checkpoint-20261024.json',
  sha256: '9c49750496d602781903de09459d729c6a3061b433a78cfea6aabdb4d796e99f',
  claim: 'scripts/n8n/out/foundation/wf00-execution-diagnostic-20261024.jsonl',
});
export function checkWf00ExecutionDiagnostic(
  repositoryRoot = fileURLToPath(new URL('../../', import.meta.url)),
) {
  const root = resolve(repositoryRoot),
    text = readRuntimePublicFile(root, wf00ExecutionCheckpoint.relative);
  if (publicDigest(text) !== wf00ExecutionCheckpoint.sha256) throw Error('WF00_EXECUTION_DIAGNOSTIC_BLOCKED');
  const r = JSON.parse(text),
    paths = ['management', 'control', 'setup', 'preflight', 'runtime']
      .map((name) => `scripts/n8n/out/foundation/live/${name}.jsonl`)
      .concat('scripts/n8n/out/foundation/live/runtime.technical-13.jsonl');
  if (
    r.kind !== 'm03_unadmitted_wf00_manual_execution_checkpoint' ||
    r.version !== 1 ||
    r.environment !== 'dev' ||
    r.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    r.helperHead !== '17f83cfaf82118e3baf641d447b0ac49e480ac30' ||
    r.event?.workflowId !== 'MzimjpsuyPuK7SKe' ||
    r.event.acceptanceAdmitted !== false ||
    r.event.executionId !== null ||
    r.event.executionIdVerified !== false ||
    r.reservedCumulativeUsage?.management !== 524 ||
    r.reservedCumulativeUsage.control !== 846 ||
    r.reservedCumulativeUsage.combined !== 1370 ||
    r.reservedCumulativeUsage.vercel !== 149 ||
    r.limits?.management !== 1024 ||
    r.limits.control !== 2048 ||
    r.limits.combined !== 2560 ||
    r.limits.allowancesReplenished !== false ||
    !record(r.pins) ||
    Object.keys(r.pins).length !== paths.length ||
    paths.some(
      (path) =>
        !Object.hasOwn(r.pins, path) || publicDigest(readRuntimePublicFile(root, path)) !== r.pins[path],
    )
  )
    throw Error('WF00_EXECUTION_DIAGNOSTIC_BLOCKED');
  try {
    lstatSync(join(root, wf00ExecutionCheckpoint.claim));
    throw Error();
  } catch (error) {
    if (error.code !== 'ENOENT') throw Error('WF00_EXECUTION_DIAGNOSTIC_BLOCKED');
  }
  return Object.freeze({
    kind: 'm03_wf00_execution_check',
    status: 'ready',
    technicalAttempt: 15,
    sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
    windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
    managementAttempts: 524,
    controlAttempts: 846,
    combinedAttempts: 1370,
    maximumRequests: 3,
    privateRead: false,
    networkRequests: 0,
  });
}
export function openWf00ExecutionDiagnosticBudget(
  repositoryRoot = fileURLToPath(new URL('../../', import.meta.url)),
) {
  checkWf00ExecutionDiagnostic(repositoryRoot);
  const root = resolve(repositoryRoot),
    pins = JSON.parse(readRuntimePublicFile(root, wf00ExecutionCheckpoint.relative)).pins;
  let fd,
    requests = 0,
    closed = false,
    expected = '';
  try {
    fd = openSync(
      join(root, wf00ExecutionCheckpoint.claim),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    const header =
      JSON.stringify({
        kind: 'm03_wf00_execution_diagnostic_budget',
        version: 1,
        checkpointSha256: wf00ExecutionCheckpoint.sha256,
        managementAttempts: 524,
        controlAttempts: 846,
        maximumRequests: 3,
        processId: process.pid,
        parentProcessId: process.ppid,
      }) + '\n';
    if (writeSync(fd, header, null, 'utf8') !== Buffer.byteLength(header)) throw Error();
    fsyncSync(fd);
    expected = header;
  } catch {
    if (fd !== undefined) closeSync(fd);
    throw Error('WF00_EXECUTION_DIAGNOSTIC_BLOCKED');
  }
  return Object.freeze({
    admit() {
      if (
        closed ||
        requests >= 3 ||
        Object.entries(pins).some(([path, pin]) => publicDigest(readRuntimePublicFile(root, path)) !== pin)
      )
        throw Error('WF00_EXECUTION_DIAGNOSTIC_BLOCKED');
      const current = lstatSync(join(root, wf00ExecutionCheckpoint.claim)),
        opened = fstatSync(fd);
      if (
        current.isSymbolicLink() ||
        current.ino !== opened.ino ||
        current.dev !== opened.dev ||
        current.nlink !== 1 ||
        opened.nlink !== 1 ||
        readRuntimePublicFile(root, wf00ExecutionCheckpoint.claim) !== expected
      )
        throw Error('WF00_EXECUTION_DIAGNOSTIC_BLOCKED');
      const line = JSON.stringify({ event: 'management_attempt', ordinal: 525 + requests }) + '\n';
      requests++;
      if (writeSync(fd, line, null, 'utf8') !== Buffer.byteLength(line))
        throw Error('WF00_EXECUTION_DIAGNOSTIC_BLOCKED');
      fsyncSync(fd);
      expected += line;
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(fd);
      }
    },
  });
}
const execution31130Checkpoint = Object.freeze({
  relative: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json',
  sha256: 'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb',
  cleanup: 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-cleanup-20261024.json',
  cleanupSha256: '49192237b29231f20f67595fdc7522b49926f10c8e278bea3871cf75a9788b57',
  claim: 'scripts/n8n/out/foundation/execution-31130-metadata-diagnostic-20261024.jsonl',
  nativeClaim: 'scripts/n8n/out/foundation/execution-31130-native-metadata-diagnostic-20261024.jsonl',
  nativeReceipt:
    'milestones/M03-n8n-foundation/evidence/technical16-execution31130-native-metadata-readback-20261024.json',
  nativeReceiptSha256: 'd82862ef3c23f9a4dc51b5a7b246c239890acdcda6df31d2a81c7101f21cd057',
  childUiReceipt: 'milestones/M03-n8n-foundation/evidence/technical16-child-ui-readback-20261024.json',
  childUiReceiptSha256: '2c9100fd58caf7715838462de11337e8d06bcd691ab13b20b380413b6c3e4ba3',
  snapshotClaim: 'scripts/n8n/out/foundation/execution-31130-snapshot-diagnostic-20261024.jsonl',
  categoryClaim: 'scripts/n8n/out/foundation/execution-31130-category-diagnostic-20261024.jsonl',
  parameterDefaultsClaim:
    'scripts/n8n/out/foundation/execution-31130-parameter-defaults-diagnostic-20261024.jsonl',
  categoryReceipt:
    'milestones/M03-n8n-foundation/evidence/technical16-execution31130-parameter-category-readback-20261024.json',
  categoryReceiptSha256: '414874a3dc27f724d399e0dad3bc1a07f96a75fe1709175114c6c5084b795a7c',
  snapshotReceipt:
    'milestones/M03-n8n-foundation/evidence/technical16-execution31130-native-snapshot-readback-20261024.json',
  snapshotReceiptSha256: '6db76fb75d2956c2835c6a9adb5c2bd7700f53b39b377968e8ec4d1139c842e7',
  metadataReceipt:
    'milestones/M03-n8n-foundation/evidence/technical16-execution31130-metadata-readback-20261024.json',
  metadataReceiptSha256: 'ea613ccfaa51b2fadcbfd93a7b3608b9e0d6a6df453400fb7aa7abe01725d470',
});
function readExecution31130Context(root = fileURLToPath(new URL('../../', import.meta.url))) {
  root = resolve(root);
  const cfg = execution31130Checkpoint,
    text = readRuntimePublicFile(root, cfg.relative),
    cleanupText = readRuntimePublicFile(root, cfg.cleanup);
  if (publicDigest(text) !== cfg.sha256 || publicDigest(cleanupText) !== cfg.cleanupSha256)
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const r = JSON.parse(text),
    cleanup = JSON.parse(cleanupText);
  if (
    r.kind !== 'm03_technical16_native_reader_reconciliation' ||
    r.environment !== 'dev' ||
    r.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    r.attempt?.technicalAttempt !== 16 ||
    r.attempt.windowId !== '4c602549-2c42-4ec3-9328-714d7cb66a77' ||
    r.attempt.nativeExit !== 1 ||
    r.attempt.executionIdObserved !== '31130' ||
    r.attempt.caseId !== 'dispatch.vimeo' ||
    r.usage?.management !== 824 ||
    r.usage.control !== 955 ||
    r.usage.combined !== 1779 ||
    r.usage.vercel !== 184 ||
    r.usage.actorStarts !== 0 ||
    r.usage.managementMaximum !== 1024 ||
    r.usage.controlMaximum !== 2048 ||
    r.usage.combinedMaximum !== 2560 ||
    cleanup.kind !== 'm03_technical16_local_cleanup' ||
    cleanup.technicalAttempt !== 16 ||
    cleanup.attemptReceiptSha256 !== cfg.sha256 ||
    cleanup.nativeExit !== 0 ||
    cleanup.privateContentsRead !== false ||
    cleanup.networkRequests !== 0 ||
    [
      'allTenDisposableLeavesAbsent',
      'parentProcessAbsent',
      'runtimeProcessAbsent',
      'parentLockAbsent',
      'runtimeLockAbsent',
      'persistentOriginalsRetained',
      'machineRetained',
      'originalFailedAttemptPreserved',
    ].some((k) => cleanup[k] !== true) ||
    cleanup.managementAttempts !== 824 ||
    cleanup.controlAttempts !== 955 ||
    cleanup.combinedAttempts !== 1779 ||
    !record(r.pins) ||
    Object.keys(r.pins).length !== 12
  )
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  for (const [path, pin] of Object.entries(r.pins)) {
    if (
      !/^(?:scripts\/n8n\/out\/foundation\/live\/|milestones\/M03-n8n-foundation\/evidence\/technical16-wf00-dispatch-ui-20261024\.png$)/.test(
        path,
      ) ||
      typeof pin !== 'string' ||
      !/^[a-f0-9]{64}$/.test(pin) ||
      publicDigest(readRuntimePublicFile(root, path, null)) !== pin
    )
      throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  }
  const controlPath = 'scripts/n8n/out/foundation/live/control.jsonl';
  if (!Object.hasOwn(r.pins, controlPath)) throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const ack = readRuntimePublicFile(root, controlPath)
    .trimEnd()
    .split('\n')
    .map(JSON.parse)
    .filter((v) => v.event === 'native_start_ack' && v.executionId === '31130');
  if (
    ack.length !== 1 ||
    ack[0].caseId !== 'dispatch.vimeo' ||
    ack[0].workflowKey !== 'WF-00' ||
    ack[0].workflowId !== 'MzimjpsuyPuK7SKe' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(ack[0].versionId) ||
    typeof ack[0].intentAt !== 'string' ||
    !Number.isFinite(Date.parse(ack[0].intentAt))
  )
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  return { root, pins: r.pins, versionId: ack[0].versionId, intentAt: Date.parse(ack[0].intentAt) };
}
function readNativeExecution31130Context(root) {
  const context = readExecution31130Context(root),
    cfg = execution31130Checkpoint,
    text = readRuntimePublicFile(context.root, cfg.metadataReceipt);
  if (publicDigest(text) !== cfg.metadataReceiptSha256) throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const r = JSON.parse(text),
    raw = r.rawResult,
    claim = readRuntimePublicFile(context.root, cfg.claim),
    rows = claim.trimEnd().split('\n').map(JSON.parse);
  if (
    r.kind !== 'm03_technical16_execution_metadata_readback' ||
    r.originalAttemptSha256 !== cfg.sha256 ||
    r.technicalAttempt !== 16 ||
    r.environment !== 'dev' ||
    r.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
    r.usage?.management !== 825 ||
    r.usage.control !== 955 ||
    r.usage.combined !== 1780 ||
    r.usage.vercel !== 184 ||
    raw?.status !== 'complete' ||
    raw.nativeExit !== 0 ||
    raw.childClosed !== true ||
    raw.handoffDeleted !== true ||
    raw.inventory?.status !== 'execution_metadata_classified' ||
    raw.inventory.acceptanceProven !== false ||
    raw.inventory.fields?.readerMetadataContractSatisfied !== true ||
    raw.inventory.requestCount !== 1 ||
    !record(r.pins) ||
    r.pins[cfg.claim] !== publicDigest(claim) ||
    rows.length !== 2 ||
    rows[0].kind !== 'm03_execution_31130_metadata_diagnostic_budget' ||
    rows[0].checkpointSha256 !== cfg.sha256 ||
    rows[0].managementAttempts !== 824 ||
    rows[0].controlAttempts !== 955 ||
    JSON.stringify(rows[1]) !== JSON.stringify({ event: 'management_attempt', ordinal: 825 }) ||
    [
      'parentAbsent',
      'childAbsent',
      'managementCopyAbsent',
      'parentLockAbsent',
      'persistentManagementRetained',
    ].some((k) => r.cleanup?.[k] !== true) ||
    r.cleanup.privateContentsRead !== false ||
    r.cleanup.networkRequests !== 0
  )
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  return context;
}
function readSnapshotExecution31130Context(root) {
  const context = readNativeExecution31130Context(root),
    cfg = execution31130Checkpoint,
    text = readRuntimePublicFile(context.root, cfg.nativeReceipt),
    uiText = readRuntimePublicFile(context.root, cfg.childUiReceipt);
  if (publicDigest(text) !== cfg.nativeReceiptSha256 || publicDigest(uiText) !== cfg.childUiReceiptSha256)
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const r = JSON.parse(text),
    ui = JSON.parse(uiText),
    raw = r.rawResult,
    claim = readRuntimePublicFile(context.root, cfg.nativeClaim),
    rows = claim.trimEnd().split('\n').map(JSON.parse);
  if (
    r.kind !== 'm03_technical16_native_metadata_readback' ||
    r.originalAttemptSha256 !== cfg.sha256 ||
    r.metadataReadbackSha256 !== cfg.metadataReceiptSha256 ||
    r.usage?.management !== 826 ||
    r.usage.control !== 956 ||
    r.usage.combined !== 1782 ||
    raw?.status !== 'complete' ||
    raw.nativeExit !== 0 ||
    raw.childClosed !== true ||
    raw.handoffDeleted !== true ||
    raw.inventory?.status !== 'native_metadata_verified' ||
    raw.inventory.acceptanceProven !== false ||
    raw.inventory.metadata?.versionMatchesIntent !== true ||
    raw.inventory.networkCompletionVerified !== true ||
    !record(r.pins) ||
    r.pins[cfg.nativeClaim] !== publicDigest(claim) ||
    rows.length !== 3 ||
    rows[0].managementAttempts !== 825 ||
    rows[0].controlAttempts !== 955 ||
    JSON.stringify(rows[1]) !== JSON.stringify({ event: 'management_attempt', ordinal: 826 }) ||
    JSON.stringify(rows[2]) !==
      JSON.stringify({
        event: 'native_read_control_reservation',
        ordinal: 956,
        additionalHttpRequest: false,
      }) ||
    [
      'parentAbsent',
      'childAbsent',
      'managementCopyAbsent',
      'parentLockAbsent',
      'persistentManagementRetained',
    ].some((k) => r.cleanup?.[k] !== true) ||
    r.cleanup.privateContentsRead !== false ||
    r.cleanup.networkRequests !== 0 ||
    ui.kind !== 'm03_technical16_child_ui_lookup' ||
    ui.nativeMetadataReadbackSha256 !== cfg.nativeReceiptSha256 ||
    ui.parent?.executionId !== '31130' ||
    ui.parent.workflowId !== 'MzimjpsuyPuK7SKe' ||
    ui.parent.childLinkObserved !== true ||
    ui.child?.executionId !== '31131' ||
    ui.child.workflowId !== '4JMHLDBSdgGxhPlk' ||
    ui.usage?.management !== 826 ||
    ui.usage.control !== 957 ||
    ui.usage.combined !== 1783 ||
    ui.nativeTreeSettlementEstablished !== false ||
    ui.fullAcceptance !== false ||
    publicDigest(readRuntimePublicFile(context.root, ui.screenshot?.path, null)) !== ui.screenshot.sha256
  )
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const runtime = readRuntimePublicFile(
      context.root,
      'scripts/n8n/out/foundation/live/runtime.technical-16.jsonl',
    )
      .trimEnd()
      .split('\n')
      .map(JSON.parse),
    intents = runtime.filter((v) => v.event === 'intent' && v.sequence === 37),
    verified = runtime.filter((v) => v.event === 'verified' && v.sequence === 37);
  if (
    intents.length !== 1 ||
    intents[0].action !== 'save' ||
    intents[0].key !== 'WF-00' ||
    verified.length !== 1 ||
    verified[0].after?.versionId !== context.versionId ||
    typeof verified[0].after.graphHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(verified[0].after.graphHash) ||
    intents[0].target?.graphHash !== verified[0].after.graphHash
  )
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  return { ...context, bodyHash: verified[0].after.graphHash };
}
async function readCategoryExecution31130Context(root) {
  const context = readSnapshotExecution31130Context(root),
    cfg = execution31130Checkpoint,
    text = readRuntimePublicFile(context.root, cfg.snapshotReceipt),
    claim = readRuntimePublicFile(context.root, cfg.snapshotClaim),
    r = JSON.parse(text),
    rows = claim.trimEnd().split('\n').map(JSON.parse),
    raw = r.rawResult;
  if (
    publicDigest(text) !== cfg.snapshotReceiptSha256 ||
    r.kind !== 'm03_technical16_native_snapshot_readback' ||
    r.originalAttemptSha256 !== cfg.sha256 ||
    r.nativeMetadataReadbackSha256 !== cfg.nativeReceiptSha256 ||
    r.childUiReadbackSha256 !== cfg.childUiReceiptSha256 ||
    r.pins?.[cfg.snapshotClaim] !== publicDigest(claim) ||
    rows.length !== 3 ||
    rows[0].kind !== 'm03_execution_31130_snapshot_diagnostic_budget' ||
    rows[0].managementAttempts !== 826 ||
    rows[0].controlAttempts !== 957 ||
    JSON.stringify(rows[1]) !== JSON.stringify({ event: 'management_attempt', ordinal: 827 }) ||
    JSON.stringify(rows[2]) !==
      JSON.stringify({
        event: 'native_read_control_reservation',
        ordinal: 958,
        additionalHttpRequest: false,
      }) ||
    r.usage?.management !== 827 ||
    r.usage.control !== 958 ||
    r.usage.combined !== 1785 ||
    r.usage.vercel !== 184 ||
    raw?.status !== 'complete' ||
    raw.nativeExit !== 0 ||
    raw.childClosed !== true ||
    raw.handoffDeleted !== true ||
    raw.inventory?.status !== 'native_snapshot_classified' ||
    raw.inventory.requestCount !== 1 ||
    raw.inventory.httpStatus !== 200 ||
    raw.inventory.tlsVerified !== true ||
    raw.inventory.networkCompletionVerified !== true ||
    raw.inventory.acceptanceProven !== false ||
    raw.inventory.metadata?.versionMatchesIntent !== true ||
    raw.inventory.transportState?.pendingRequests !== 0 ||
    raw.inventory.transportState.unclosedResponses !== 0 ||
    [
      'parentAbsent',
      'childAbsent',
      'managementCopyAbsent',
      'parentLockAbsent',
      'persistentManagementRetained',
    ].some((k) => r.cleanup?.[k] !== true) ||
    r.cleanup.privateContentsRead !== false ||
    r.cleanup.networkRequests !== 0
  )
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const [{ materializeFoundationAcceptanceCase }, { graphBody }, retention, { foundationRuntimeGraphHash }] =
    await Promise.all([
      import('../../n8n/foundation/materialize-acceptance-case.mjs'),
      import('./foundation-bind.mjs'),
      import('./foundation-retention-proposal.mjs'),
      import('./foundation-runtime-checkpoint.mjs'),
    ]);
  const categoryPins = {
      [cfg.snapshotReceipt]: publicDigest(text),
      [cfg.snapshotClaim]: publicDigest(claim),
    },
    read = (path) => {
      const value = readRuntimePublicFile(context.root, path);
      categoryPins[path] = publicDigest(value);
      return value;
    };
  const bindings = JSON.parse(read('n8n/foundation/bindings.dev.json')),
    transport = JSON.parse(read('n8n/foundation/transport.dev.json')),
    records = Object.keys(bindings.workflowRefs).map((k) => JSON.parse(read('n8n/workflows/' + k + '.json'))),
    setup = read('scripts/n8n/out/foundation/live/setup.jsonl')
      .trimEnd()
      .split('\n')
      .map(JSON.parse)
      .filter((v) => v.event === 'setup_verified' && v.kind === 'deployment')
      .at(-1);
  const graph = materializeFoundationAcceptanceCase(
      bindings,
      {
        audience: setup?.audience,
        windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
        credential: transport.credential,
      },
      'dispatch.vimeo',
    ),
    expectedBody = graphBody(graph);
  expectedBody.settings = retention.applyFoundationApprovedRetentionSettings(
    retention.createFoundationApprovedRetentionPolicy({ bindings, records }),
    graph.key,
    expectedBody.settings,
  );
  expectedBody.settings.availableInMCP = true;
  for (const n of expectedBody.nodes)
    if (
      n.type !== 'n8n-nodes-base.manualTrigger' &&
      (/Trigger$/.test(n.type) || ['n8n-nodes-base.webhook', 'n8n-nodes-base.form'].includes(n.type))
    )
      n.disabled = true;
  // Pure reconstruction only. This does not create a plan, binding, admission
  // or receipt, and must reproduce the exact past sequence37 before private use.
  if (foundationRuntimeGraphHash(expectedBody) !== context.bodyHash)
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  return { ...context, expectedBody, categoryPins };
}
async function readParameterDefaultsExecution31130Context(root) {
  const context = await readCategoryExecution31130Context(root),
    cfg = execution31130Checkpoint,
    text = readRuntimePublicFile(context.root, cfg.categoryReceipt),
    claim = readRuntimePublicFile(context.root, cfg.categoryClaim),
    r = JSON.parse(text),
    rows = claim.trimEnd().split('\n').map(JSON.parse),
    raw = r.rawResult;
  if (
    publicDigest(text) !== cfg.categoryReceiptSha256 ||
    r.kind !== 'm03_technical16_native_parameter_category_readback' ||
    r.originalAttemptSha256 !== cfg.sha256 ||
    r.snapshotReadbackSha256 !== cfg.snapshotReceiptSha256 ||
    r.pins?.[cfg.categoryClaim] !== publicDigest(claim) ||
    rows.length !== 3 ||
    rows[0].kind !== 'm03_execution_31130_category_diagnostic_budget' ||
    rows[0].managementAttempts !== 827 ||
    rows[0].controlAttempts !== 958 ||
    JSON.stringify(rows[1]) !== JSON.stringify({ event: 'management_attempt', ordinal: 828 }) ||
    JSON.stringify(rows[2]) !==
      JSON.stringify({
        event: 'native_read_control_reservation',
        ordinal: 959,
        additionalHttpRequest: false,
      }) ||
    r.usage?.management !== 828 ||
    r.usage.control !== 959 ||
    r.usage.combined !== 1787 ||
    r.usage.vercel !== 184 ||
    raw?.status !== 'complete' ||
    raw.nativeExit !== 0 ||
    raw.childClosed !== true ||
    raw.handoffDeleted !== true ||
    raw.inventory?.status !== 'native_snapshot_classified' ||
    raw.inventory.requestCount !== 1 ||
    raw.inventory.httpStatus !== 200 ||
    raw.inventory.tlsVerified !== true ||
    raw.inventory.networkCompletionVerified !== true ||
    raw.inventory.acceptanceProven !== false ||
    raw.inventory.transportState?.pendingRequests !== 0 ||
    raw.inventory.transportState.unclosedResponses !== 0 ||
    [
      'parentAbsent',
      'childAbsent',
      'managementCopyAbsent',
      'parentLockAbsent',
      'persistentManagementRetained',
    ].some((k) => r.cleanup?.[k] !== true) ||
    r.cleanup.privateContentsRead !== false ||
    r.cleanup.networkRequests !== 0
  )
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const { foundationRuntimeExecutionParameterCandidates } =
    await import('./foundation-runtime-checkpoint.mjs');
  foundationRuntimeExecutionParameterCandidates(context.expectedBody);
  context.categoryPins[cfg.categoryReceipt] = publicDigest(text);
  context.categoryPins[cfg.categoryClaim] = publicDigest(claim);
  return context;
}
const wf32DiscoveryScope = Object.freeze({
  claim: 'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.jsonl',
  path: '/api/v1/executions?workflowId=kkAGgnbD8NjWHMKC&includeData=false&limit=120',
  failures: Object.freeze([
    '4f0697080d9bd1ff728b48d9c159f4cbe6f61ebaa04d19ec295da14c3e297960',
    '5b2f8e590876f37d89aad2a35151e07489c4601111af09c27b01268f43df0c57',
    '886da0004471f526d0767c3e60a5c1474bb38f439f022ab3edd162efdeb412ae',
    '68fecd32ceda855b5f522bf9448f5fa94c1411dc4bd4950ea6d7a3979602bc72',
  ]),
});
async function readWf32DiscoveryContext(root) {
  const context = await readParameterDefaultsExecution31130Context(root),
    pins = { ...context.pins, ...context.categoryPins };
  const read = (path, hash) => {
    const b = readRuntimePublicFile(context.root, path, null);
    if (publicDigest(b) !== hash) throw Error('WF32_DIAGNOSTIC_BLOCKED');
    pins[path] = hash;
    return b;
  };
  for (const path of [
    execution31130Checkpoint.relative,
    execution31130Checkpoint.cleanup,
    execution31130Checkpoint.metadataReceipt,
    execution31130Checkpoint.claim,
    execution31130Checkpoint.nativeReceipt,
    execution31130Checkpoint.nativeClaim,
    execution31130Checkpoint.childUiReceipt,
  ])
    pins[path] = publicDigest(readRuntimePublicFile(context.root, path, null));
  const ui = JSON.parse(readRuntimePublicFile(context.root, execution31130Checkpoint.childUiReceipt));
  read(ui.screenshot.path, ui.screenshot.sha256);
  const resolutionPath =
    'milestones/M03-n8n-foundation/evidence/technical16-executed-parameters-resolution-20261024.json';
  const resolution = JSON.parse(
    read(resolutionPath, 'e0c919ab2a12aa9306be3d2b3656b7d0c43d97c21ddc6376ffa12bbfbb89d07b'),
  );
  read(
    execution31130Checkpoint.parameterDefaultsClaim,
    resolution.pins[execution31130Checkpoint.parameterDefaultsClaim],
  );
  for (let i = 1; i <= 4; i++) {
    const path =
      'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt' + i + '-20261024.json';
    const r = JSON.parse(read(path, wf32DiscoveryScope.failures[i - 1]));
    if (
      r.cleanupAttempt !== i ||
      r.technicalAttempt !== 16 ||
      r.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      r.windowId !== '4c602549-2c42-4ec3-9328-714d7cb66a77' ||
      r.rawResult.recordsDeleted !== 0 ||
      r.rawResult.qualifiedSideEffects !== false ||
      r.cleanup.parentAbsent !== true ||
      r.cleanup.childAbsent !== true ||
      r.cleanup.parentLockAbsent !== true
    )
      throw Error('WF32_DIAGNOSTIC_BLOCKED');
    for (const [path, hash] of Object.entries(r.pins))
      if (path.startsWith('scripts/n8n/out/foundation/')) read(path, hash);
    if (i === 4) {
      if (
        r.usage.management !== 862 ||
        r.usage.control !== 993 ||
        r.usage.combined !== 1855 ||
        r.usage.vercel !== 184 ||
        r.rawResult.requestCount !== 25 ||
        r.rawResult.networkCompletionVerified !== true ||
        r.rawResult.originalPublicRecordsUnchanged !== true ||
        r.rawResult.diagnosticCode !== 'native_REJECTED'
      )
        throw Error('WF32_DIAGNOSTIC_BLOCKED');
      for (const pid of [r.cleanup.parentProcessId, r.cleanup.childProcessId]) {
        if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid || pid === process.ppid)
          throw Error('WF32_DIAGNOSTIC_BLOCKED');
        let dead = false;
        try {
          process.kill(pid, 0);
        } catch (e) {
          dead = e?.code === 'ESRCH';
        }
        if (!dead) throw Error('WF32_DIAGNOSTIC_BLOCKED');
      }
    }
  }
  return { root: context.root, pins };
}
export async function checkWf32DiscoveryDiagnostic(root) {
  const c = await readWf32DiscoveryContext(root);
  const path = resolve(c.root, wf32DiscoveryScope.claim);
  if (existsSync(path)) throw Error('WF32_DIAGNOSTIC_BLOCKED');
  return {
    kind: 'm03_wf32_discovery_check',
    status: 'ready',
    technicalAttempt: 16,
    sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
    windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
    managementAttempts: 862,
    controlAttempts: 993,
    combinedAttempts: 1855,
    maximumRequests: 1,
    privateRead: false,
    networkRequests: 0,
  };
}
export async function openWf32DiscoveryDiagnosticBudget(root) {
  await checkWf32DiscoveryDiagnostic(root);
  const c = await readWf32DiscoveryContext(root);
  const fd = openSync(resolve(c.root, wf32DiscoveryScope.claim), 'wx');
  let charged = false,
    uncertain = false;
  const append = (row) => {
    const b = Buffer.from(JSON.stringify(row) + '\n');
    let n = 0;
    while (n < b.length) {
      const w = writeSync(fd, b, n, b.length - n);
      if (w <= 0) throw Error('WF32_DIAGNOSTIC_BLOCKED');
      n += w;
    }
    fsyncSync(fd);
  };
  try {
    append({
      kind: 'm03_wf32_discovery_diagnostic_budget',
      version: 1,
      failedAttemptSha256: wf32DiscoveryScope.failures[3],
      managementAttempts: 862,
      controlAttempts: 993,
      combinedAttempts: 1855,
      maximumRequests: 1,
    });
  } catch {
    closeSync(fd);
    throw Error('WF32_DIAGNOSTIC_BLOCKED');
  }
  return {
    admit() {
      if (charged || uncertain) throw Error('WF32_DIAGNOSTIC_BLOCKED');
      for (const [path, hash] of Object.entries(c.pins))
        if (publicDigest(readRuntimePublicFile(c.root, path, null)) !== hash)
          throw Error('WF32_DIAGNOSTIC_BLOCKED');
      charged = true;
      try {
        append({ event: 'management_attempt', ordinal: 863 });
        append({ event: 'native_read_control_reservation', ordinal: 994, additionalHttpRequest: false });
      } catch {
        uncertain = true;
        throw Error('WF32_DIAGNOSTIC_BLOCKED');
      }
    },
    close() {
      closeSync(fd);
    },
  };
}
export function projectWf32DiscoveryDiagnostic(dto) {
  const objectShape = record(dto),
    dataArray = objectShape && Array.isArray(dto.data),
    rows = dataArray ? dto.data : [];
  const known = ['new', 'running', 'waiting', 'unknown', 'success', 'error', 'canceled', 'crashed'];
  const r = {
    objectShape,
    dataArray,
    listWithinLimit: dataArray && rows.length <= 120,
    nextCursorPresent: objectShape && Object.hasOwn(dto, 'nextCursor'),
    nextCursorShape:
      objectShape &&
      (dto.nextCursor === null ||
        (typeof dto.nextCursor === 'string' && /^[\x21-\x7e]{1,400}$/.test(dto.nextCursor))),
    firstPageEmpty: dataArray && rows.length === 0,
    pendingCountZero:
      dataArray && !rows.some((v) => ['new', 'running', 'waiting', 'unknown'].includes(v?.status)),
    unknownStatusCountZero: dataArray && !rows.some((v) => !known.includes(v?.status)),
    workflowIdsMatch: dataArray && rows.every((v) => v?.workflowId === 'kkAGgnbD8NjWHMKC'),
    idsShape: dataArray && rows.every((v) => typeof v?.id === 'string' && /^[1-9]\d{0,31}$/.test(v.id)),
    payloadAbsent:
      dataArray &&
      rows.every((v) => record(v) && !Object.hasOwn(v, 'data') && !Object.hasOwn(v, 'workflowData')),
  };
  return Object.freeze({
    ...r,
    listShapeVerified:
      r.dataArray &&
      r.listWithinLimit &&
      r.nextCursorPresent &&
      r.nextCursorShape &&
      r.unknownStatusCountZero &&
      r.workflowIdsMatch &&
      r.idsShape &&
      r.payloadAbsent,
  });
}
export async function runWf32DiscoveryDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    workflowKey: 'WF-32',
    technicalAttempt: 16,
    status: 'not_attempted',
    requestCount: 0,
    maximumRequests: 1,
    httpStatus: null,
    stage: 'not_attempted',
    nativeTransportCode: null,
    readerCode: null,
    tlsVerified: false,
    networkCompletionVerified: false,
    controlReservationConservative: true,
    acceptanceProven: false,
    drainProven: false,
    firstPageSchemaValidated: false,
    nextReadRefusedLocally: false,
    fields: null,
    transportState: null,
  };
  if (typeof key !== 'string' || key.length < 8 || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  let budget,
    native,
    response,
    job,
    timer,
    closed = false,
    getCode = () => null,
    getReaderCode = () => null;
  const controller = new AbortController();
  try {
    result.stage = 'budget';
    budget = await (dependencies.openBudget ?? openWf32DiscoveryDiagnosticBudget)();
    const [
      { createFoundationNativeTransport, foundationNativeTransportErrorCode },
      { createFoundationNativeReader, foundationNativeReaderErrorCode },
    ] = await Promise.all([
      import('./foundation-native-transport.mjs'),
      import('./foundation-native-reader.mjs'),
    ]);
    getCode = foundationNativeTransportErrorCode;
    getReaderCode = foundationNativeReaderErrorCode;
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url), 'utf8'),
    );
    native = createFoundationNativeTransport(
      { apiKey: key, bindings, authorizeExecution: () => false },
      dependencies.nativeTransport ?? {},
    );
    let secondBoundary = false,
      body = [];
    const wrappedRequest = async (input) => {
      if (input.method !== 'GET' || input.path !== wf32DiscoveryScope.path || response)
        throw Error('WF32_ROUTE_BLOCKED');
      try {
        response = await native.request(input);
      } catch (error) {
        result.nativeTransportCode = getCode(error);
        throw error;
      }
      result.httpStatus = response.status;
      result.tlsVerified = true;
      response.closed.then(
        () => {
          closed = true;
        },
        (e) => {
          closed = true;
          result.nativeTransportCode = getCode(e);
        },
      );
      result.stage = 'response';
      return {
        ...response,
        body: {
          async *[Symbol.asyncIterator]() {
            try {
              for await (const chunk of response.body) {
                body.push(Buffer.from(chunk));
                yield chunk;
              }
            } catch (e) {
              result.nativeTransportCode = getCode(e);
              throw e;
            }
          },
        },
      };
    };
    const reader = createFoundationNativeReader({
      bindings,
      transport: { request: wrappedRequest },
      admitControlAttempt: (args) => {
        if (result.requestCount !== 0) {
          secondBoundary = true;
          throw Error('WF32_SECOND_READ_FORBIDDEN');
        }
        if (args.kind !== 'discovery' || args.workflowId !== 'kkAGgnbD8NjWHMKC')
          throw Error('WF32_ROUTE_BLOCKED');
        budget.admit();
        result.requestCount = 1;
        result.stage = 'request';
      },
      sensitiveValues: [key],
      now: Date.now,
      deadlineAt: Date.now() + 20000,
    });
    job = reader.discover({ workflowKey: 'WF-32', baselineIds: [] });
    try {
      await Promise.race([
        job,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            native.close();
            reject(Error('WF32_TIMEOUT'));
          }, 20000);
        }),
      ]);
    } catch (error) {
      const failure = reader.lastFailure();
      result.readerCode = getReaderCode(error);
      if (secondBoundary && failure?.stage === 'admission') {
        result.readerCode = null;
        result.firstPageSchemaValidated = true;
        result.nextReadRefusedLocally = true;
      } else if (failure)
        result.stage =
          failure.stage === 'projection'
            ? 'projection'
            : failure.stage === 'request'
              ? 'request'
              : 'response';
      if (!secondBoundary && failure?.stage !== 'projection') throw error;
    }
    result.fields = projectWf32DiscoveryDiagnostic(JSON.parse(Buffer.concat(body).toString('utf8')));
    body = [];
    if (!secondBoundary && result.readerCode !== null) {
      result.status = 'discovery_page_failed';
    } else {
      result.stage = 'complete';
      result.status = 'discovery_page_classified';
    }
  } catch (e) {
    result.nativeTransportCode = result.nativeTransportCode ?? getCode(e);
    result.readerCode = getReaderCode(e);
    result.status = 'discovery_page_failed';
  } finally {
    clearTimeout(timer);
    controller.abort();
    native?.close();
    key = null;
    const until = Date.now() + 5000;
    while (
      native &&
      (native.state().pendingRequests || native.state().unclosedResponses) &&
      Date.now() < until
    )
      await new Promise((r) => setTimeout(r, 10));
    job?.catch(() => {});
    result.transportState = native?.state() ?? null;
    result.networkCompletionVerified =
      !!native &&
      (!response || closed) &&
      result.transportState.pendingRequests === 0 &&
      result.transportState.unclosedResponses === 0;
    if (!result.networkCompletionVerified && result.status === 'discovery_page_classified')
      result.status = 'discovery_page_failed';
    budget?.close();
  }
  return result;
}
export function checkExecution31130MetadataDiagnostic(root, native = false) {
  if (![false, true, 'snapshot', 'categories', 'parameter_defaults'].includes(native))
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  if (native === 'categories' || native === 'parameter_defaults')
    return (
      native === 'parameter_defaults'
        ? readParameterDefaultsExecution31130Context(root)
        : readCategoryExecution31130Context(root)
    ).then((context) => checkExecution31130Context(context, native));
  const context =
    native === 'snapshot'
      ? readSnapshotExecution31130Context(root)
      : native
        ? readNativeExecution31130Context(root)
        : readExecution31130Context(root);
  return checkExecution31130Context(context, native);
}
function checkExecution31130Context(context, native) {
  try {
    lstatSync(
      join(
        context.root,
        native === 'parameter_defaults'
          ? execution31130Checkpoint.parameterDefaultsClaim
          : native === 'categories'
            ? execution31130Checkpoint.categoryClaim
            : native === 'snapshot'
              ? execution31130Checkpoint.snapshotClaim
              : native
                ? execution31130Checkpoint.nativeClaim
                : execution31130Checkpoint.claim,
      ),
    );
    throw Error();
  } catch (error) {
    if (error.code !== 'ENOENT') throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  }
  return Object.freeze({
    kind:
      native === 'parameter_defaults'
        ? 'm03_execution_31130_parameter_defaults_check'
        : native === 'categories'
          ? 'm03_execution_31130_category_check'
          : native === 'snapshot'
            ? 'm03_execution_31130_snapshot_check'
            : native
              ? 'm03_execution_31130_native_metadata_check'
              : 'm03_execution_31130_metadata_check',
    status: 'ready',
    technicalAttempt: 16,
    sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
    windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
    managementAttempts:
      native === 'parameter_defaults'
        ? 828
        : native === 'categories'
          ? 827
          : native === 'snapshot'
            ? 826
            : native
              ? 825
              : 824,
    controlAttempts:
      native === 'parameter_defaults'
        ? 959
        : native === 'categories'
          ? 958
          : native === 'snapshot'
            ? 957
            : 955,
    combinedAttempts:
      native === 'parameter_defaults'
        ? 1787
        : native === 'categories'
          ? 1785
          : native === 'snapshot'
            ? 1783
            : native
              ? 1780
              : 1779,
    maximumRequests: 1,
    privateRead: false,
    networkRequests: 0,
  });
}
export function openExecution31130MetadataDiagnosticBudget(root, native = false) {
  if (native === 'categories' || native === 'parameter_defaults')
    return (
      native === 'parameter_defaults'
        ? readParameterDefaultsExecution31130Context(root)
        : readCategoryExecution31130Context(root)
    ).then((context) => {
      checkExecution31130Context(context, native);
      return openExecution31130ContextBudget(context, native);
    });
  checkExecution31130MetadataDiagnostic(root, native);
  const context =
    native === 'snapshot'
      ? readSnapshotExecution31130Context(root)
      : native
        ? readNativeExecution31130Context(root)
        : readExecution31130Context(root);
  return openExecution31130ContextBudget(context, native);
}
function openExecution31130ContextBudget(context, native) {
  const claim =
      native === 'parameter_defaults'
        ? execution31130Checkpoint.parameterDefaultsClaim
        : native === 'categories'
          ? execution31130Checkpoint.categoryClaim
          : native === 'snapshot'
            ? execution31130Checkpoint.snapshotClaim
            : native
              ? execution31130Checkpoint.nativeClaim
              : execution31130Checkpoint.claim,
    path = join(context.root, claim);
  let fd,
    expected = '',
    used = false,
    closed = false;
  try {
    fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    expected =
      JSON.stringify({
        kind:
          native === 'parameter_defaults'
            ? 'm03_execution_31130_parameter_defaults_diagnostic_budget'
            : native === 'categories'
              ? 'm03_execution_31130_category_diagnostic_budget'
              : native === 'snapshot'
                ? 'm03_execution_31130_snapshot_diagnostic_budget'
                : native
                  ? 'm03_execution_31130_native_metadata_diagnostic_budget'
                  : 'm03_execution_31130_metadata_diagnostic_budget',
        version: 1,
        checkpointSha256: execution31130Checkpoint.sha256,
        cleanupSha256: execution31130Checkpoint.cleanupSha256,
        managementAttempts:
          native === 'parameter_defaults'
            ? 828
            : native === 'categories'
              ? 827
              : native === 'snapshot'
                ? 826
                : native
                  ? 825
                  : 824,
        controlAttempts:
          native === 'parameter_defaults'
            ? 959
            : native === 'categories'
              ? 958
              : native === 'snapshot'
                ? 957
                : 955,
        ...(native === 'parameter_defaults'
          ? { categoryReceiptSha256: execution31130Checkpoint.categoryReceiptSha256 }
          : {}),
        ...(native === 'categories'
          ? { snapshotReceiptSha256: execution31130Checkpoint.snapshotReceiptSha256 }
          : {}),
        maximumRequests: 1,
        ...(native
          ? {
              metadataReceiptSha256: execution31130Checkpoint.metadataReceiptSha256,
              conservativeControlReservation: true,
              additionalHttpRequests: 0,
            }
          : {}),
        processId: process.pid,
        parentProcessId: process.ppid,
      }) + '\n';
    if (writeSync(fd, expected, null, 'utf8') !== Buffer.byteLength(expected)) throw Error();
    fsyncSync(fd);
  } catch {
    if (fd !== undefined) closeSync(fd);
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  }
  return Object.freeze({
    admit() {
      if (closed || used) throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
      if (native === 'categories' || native === 'parameter_defaults') {
        // Recheck every public pin immediately before the synchronous debit.
        readSnapshotExecution31130Context(context.root);
        for (const [path, sha] of Object.entries(context.categoryPins))
          if (publicDigest(readRuntimePublicFile(context.root, path)) !== sha)
            throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
      } else if (native === 'snapshot') readSnapshotExecution31130Context(context.root);
      else if (native) readNativeExecution31130Context(context.root);
      else readExecution31130Context(context.root);
      const current = lstatSync(path),
        opened = fstatSync(fd);
      if (
        current.isSymbolicLink() ||
        current.ino !== opened.ino ||
        current.dev !== opened.dev ||
        current.nlink !== 1 ||
        opened.nlink !== 1 ||
        readRuntimePublicFile(context.root, claim) !== expected
      )
        throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
      used = true;
      const charges = [
        {
          event: 'management_attempt',
          ordinal:
            native === 'parameter_defaults'
              ? 829
              : native === 'categories'
                ? 828
                : native === 'snapshot'
                  ? 827
                  : native
                    ? 826
                    : 825,
        },
        ...(native
          ? [
              {
                event: 'native_read_control_reservation',
                ordinal:
                  native === 'parameter_defaults'
                    ? 960
                    : native === 'categories'
                      ? 959
                      : native === 'snapshot'
                        ? 958
                        : 956,
                additionalHttpRequest: false,
              },
            ]
          : []),
      ];
      for (const charge of charges) {
        const line = JSON.stringify(charge) + '\n';
        if (writeSync(fd, line, null, 'utf8') !== Buffer.byteLength(line))
          throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
        fsyncSync(fd);
        expected += line;
      }
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(fd);
      }
    },
  });
}
export const inventoryDiagnosticVersion = 1;
export const wf70DiscoveryReceiptSha256 = '258a6c7d15c59323f4e95c5315d42d839f735ea40d70834b8aa171ff00b9ca66';
export function openWf70DiscoveryBudget(repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))) {
  const path = join(repositoryRoot, 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl');
  let cursor = path;
  while (true) {
    if (lstatSync(cursor).isSymbolicLink()) throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const fd = openSync(path, constants.O_RDWR | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0));
  let requests = 0,
    closed = false;
  const append = (value) => {
    const text = JSON.stringify(value) + '\n';
    if (writeSync(fd, text, null, 'utf8') !== Buffer.byteLength(text))
      throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    fsyncSync(fd);
  };
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096) throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    const text = readFileSync(fd, 'utf8'),
      rows = text.trimEnd().split('\n');
    if (rows.length !== 1) throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    const header = JSON.parse(rows[0]);
    const keys = [
      'kind',
      'version',
      'receiptSha256',
      'managementAttempts',
      'controlAttempts',
      'combinedAttempts',
      'maximumRequests',
      'parentProcessId',
    ];
    if (
      !record(header) ||
      Object.keys(header).length !== keys.length ||
      keys.some((k) => !Object.hasOwn(header, k)) ||
      header.kind !== 'm03_wf70_discovery_budget' ||
      header.version !== 1 ||
      header.receiptSha256 !== wf70DiscoveryReceiptSha256 ||
      header.managementAttempts !== 152 ||
      header.controlAttempts !== 382 ||
      header.combinedAttempts !== 534 ||
      header.maximumRequests !== 4 ||
      header.parentProcessId !== process.ppid ||
      header.controlAttempts + 4 > 2048 ||
      header.combinedAttempts + 4 > 2560
    )
      throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
    append({ event: 'diagnostic_child_claim', processId: process.pid });
  } catch {
    closeSync(fd);
    throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
  }
  return Object.freeze({
    admit(value) {
      if (
        closed ||
        value?.kind !== 'discovery' ||
        value.workflowId !== 'S6KDFsx5IjQRf6tm' ||
        Object.keys(value).length !== 2 ||
        requests >= 4
      )
        throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
      requests++;
      append({
        event: 'control_request_intent',
        ordinal: 382 + requests,
        diagnosticOrdinal: requests,
        kind: 'discovery',
        workflowKey: 'WF-70',
        at: new Date().toISOString(),
      });
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(fd);
      }
    },
  });
}
function requestDiagnostic(resource, page) {
  return {
    resource,
    page,
    tcpConnected: null,
    tlsVerified: null,
    httpStatus: null,
    bodyRead: 'not_observed',
    jsonParsed: false,
    schemaValidated: false,
    socketClosed: false,
    failureStage: 'none',
    failureCode: 'none',
  };
}
function diagnosticFailure(diagnostic, stage, code) {
  if (diagnostic && diagnostic.failureStage === 'none') {
    diagnostic.failureStage = stage;
    diagnostic.failureCode = code;
  }
}
function safeTransportCode(error) {
  const codes = {
    ECONNREFUSED: 'connection_refused',
    ECONNRESET: 'connection_reset',
    ETIMEDOUT: 'timeout',
    ABORT_ERR: 'timeout',
    SELF_SIGNED_CERT_IN_CHAIN: 'tls_untrusted',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'tls_untrusted',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls_untrusted',
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'tls_untrusted',
    CERT_HAS_EXPIRED: 'tls_expired',
    ERR_TLS_CERT_ALTNAME_INVALID: 'tls_hostname',
  };
  return typeof error?.code === 'string' && Object.hasOwn(codes, error.code)
    ? codes[error.code]
    : 'network_failed';
}
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
// Explicit owner-authorized IDs observed in the intended Personal project.
// Names/types must match readback; native credentials are never relabeled.
export const inventoryCredentialCandidates = Object.freeze(
  [
    {
      key: 'postgres',
      id: '3ZZtc9kMDcminv6w',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
    },
    { key: 'apify', id: 'EYmaOt0rd45ysq0J', name: 'Apify account', type: 'apifyApi' },
    { key: 'openai', id: 'e04LREfPBELWQQ9D', name: 'OpenAI account', type: 'openAiApi' },
    { key: 'vimeo', id: 'HeZBOZhFMeFYOC0N', name: 'Vimeo Token', type: 'httpHeaderAuth' },
    { key: 'youtube', id: 'ltvBSloVLGVeUjqV', name: 'YouTube Data API key', type: 'httpHeaderAuth' },
  ].map((value) => Object.freeze(value)),
);
const credentialTypes = {
  postgres: 'postgres',
  apify: 'apifyApi',
  openai: 'openAiApi',
  vimeo: 'httpHeaderAuth',
  youtube: 'httpHeaderAuth',
};
export const inventoryWorkflowNames = Object.freeze([
  'SUB · Start run [dev]',
  'SUB · Finish run [dev]',
  'SUB · Ingest items [dev]',
  'SUB · Log cost [dev]',
  'SUB · Notify [dev]',
  'WF-00 · Orchestrator [dev]',
  'WF-19 · Apify run callback [dev]',
  'WF-90 · Error handler [dev]',
  'WF-91 · Health & cost [dev]',
  'WF-99 · Foundation smoke test [dev]',
  'WF-10 · Vimeo collector [dev]',
  'WF-11 · Instagram posts/reels collector [dev]',
  'WF-12 · Instagram stories collector [dev]',
  'WF-13 · YouTube collector [dev]',
  'WF-18 · LinkedIn posts collector [dev]',
  'WF-18b · LinkedIn employees [dev]',
  'WF-21 · Websites collector [dev]',
  'WF-22 · News [dev]',
  'WF-23 · Awards and trade [dev]',
  'WF-30 · AI extractor [dev]',
  'WF-32 · Campaign linker [dev]',
  'WF-40 · Removal check [dev]',
  'WF-50 · Weekly briefs [dev]',
  'WF-70 · Publish / revalidate [dev]',
  'WF-80 · Alerts [dev]',
]);
const workflowNames = new Set(inventoryWorkflowNames);
const routes = {
  workflowList: ['GET', '/api/v1/workflows'],
  workflowRead: ['GET', '/api/v1/workflows/{workflowId}'],
  workflowCreate: ['POST', '/api/v1/workflows'],
  workflowUpdate: ['PUT', '/api/v1/workflows/{workflowId}'],
  workflowPublish: ['POST', '/api/v1/workflows/{workflowId}/publish'],
  workflowUnpublish: ['POST', '/api/v1/workflows/{workflowId}/unpublish'],
  credentialList: ['GET', '/api/v1/credentials'],
  credentialRead: ['GET', '/api/v1/credentials/{credentialId}'],
  credentialTest: ['POST', '/api/v1/credentials/{credentialId}/test'],
  projectList: ['GET', '/api/v1/projects'],
};
class InventoryError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const reject = (code = 'response_rejected') => {
  throw new InventoryError(code);
};

// Same conservative public-address rules reviewed for the bounded M02 diagnostic.
function publicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6 || address.includes('%') || address.includes('.')) return false;
  const [first = '', second = ''] = address.toLowerCase().split(':');
  const a = Number.parseInt(first, 16);
  const b = second ? Number.parseInt(second, 16) : 0;
  return (
    a >= 0x2000 &&
    a <= 0x3fff &&
    a !== 0x2002 &&
    !(a === 0x2001 && (b <= 0x01ff || b === 0x0db8)) &&
    !(a === 0x3fff && b <= 0x0fff)
  );
}
export function resolveInstance(signal, lookup = osLookup) {
  // The OS operation itself cannot be cancelled. The callback guard and the
  // existing overall deadline prevent late results from starting a request;
  // the bounded Windows consumer also owns the native process lifetime.
  return new Promise((done, fail) => {
    let settled = false;
    const finish = (error, addresses) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      if (error) fail(error);
      else done(addresses);
    };
    const abort = () => finish(new InventoryError('timeout'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    try {
      lookup(host, { all: true }, (error, addresses) => {
        if (error) {
          if (['ENODATA', 'ENOTFOUND'].includes(error.code)) finish(null, []);
          else finish(new InventoryError('network_failed'));
        } else finish(null, addresses);
      });
    } catch {
      finish(new InventoryError('network_failed'));
    }
  });
}
function validatedAddresses(addresses) {
  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.length > 100 ||
    addresses.some(
      (entry) => !record(entry) || entry.family !== isIP(entry.address) || !publicAddress(entry.address),
    )
  )
    reject('unsafe_dns');
  return addresses;
}
function nativeRequest(input, requestImpl = request) {
  const responseMaximum = input.maxBytes ?? maxBytes;
  if (!Number.isInteger(responseMaximum) || responseMaximum < 1 || responseMaximum > maxBytes)
    return Promise.reject(new InventoryError('body_too_large'));
  return new Promise((done, fail) => {
    const diagnostic = input.diagnostic;
    let settled = false;
    let abort;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        if (abort) input.signal.removeEventListener('abort', abort);
        done(value);
      }
    };
    const failed = (stage, code, bodyState) => {
      if (settled) return;
      settled = true;
      if (abort) input.signal.removeEventListener('abort', abort);
      if (diagnostic && bodyState) diagnostic.bodyRead = bodyState;
      diagnosticFailure(diagnostic, stage, code);
      fail(new InventoryError(code === 'body_too_large' ? 'body_too_large' : 'network_failed'));
    };
    const req = requestImpl(
      input.url,
      {
        method: 'GET',
        headers: input.headers,
        rejectUnauthorized: true,
        servername: host,
        agent: false,
        family: input.address.family,
        signal: input.signal,
        lookup: (_name, _options, callback) => callback(null, input.address.address, input.address.family),
      },
      (response) => {
        if (settled) {
          response.destroy();
          return;
        }
        const status = response.statusCode ?? 0;
        if (diagnostic) {
          diagnostic.httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
          diagnostic.bodyRead = 'reading';
        }
        if (status >= 300 && status < 400) {
          diagnosticFailure(diagnostic, 'status', 'redirect_refused');
          response.destroy();
          req.destroy();
          finish({ status, body: new Uint8Array() });
          return;
        }
        const declared =
          response.headers['content-length'] === undefined
            ? null
            : Number(response.headers['content-length']);
        if (
          declared !== null &&
          (!Number.isSafeInteger(declared) || declared < 0 || declared > responseMaximum)
        ) {
          failed(
            'body_read',
            declared > responseMaximum ? 'body_too_large' : 'body_failed',
            declared > responseMaximum ? 'too_large' : 'failed',
          );
          response.destroy();
          req.destroy();
          return;
        }
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > responseMaximum) {
            failed('body_read', 'body_too_large', 'too_large');
            response.destroy();
            req.destroy();
          } else chunks.push(chunk);
        });
        response.once('end', () => {
          if (response.complete === false || (declared !== null && size !== declared)) {
            failed('body_read', 'body_truncated', 'truncated');
            req.destroy();
            return;
          }
          if (!settled && diagnostic) diagnostic.bodyRead = 'complete';
          finish({ status, body: Buffer.concat(chunks) });
        });
        response.once('error', () => {
          failed('body_read', 'body_failed', 'failed');
          req.destroy();
        });
        response.once('aborted', () => {
          failed('body_read', 'body_aborted', 'aborted');
          req.destroy();
        });
      },
    );
    if (diagnostic || input.onTlsVerified || input.onSocketClosed) {
      req.once('socket', (socket) => {
        if (diagnostic) {
          diagnostic.tcpConnected = false;
          diagnostic.tlsVerified = false;
        }
        socket.once('connect', () => {
          if (!settled && diagnostic) diagnostic.tcpConnected = true;
        });
        socket.once('secureConnect', () => {
          const verified = socket.encrypted === true && socket.authorized === true;
          if (!settled && diagnostic) diagnostic.tlsVerified = verified;
          if (!settled) input.onTlsVerified?.(verified);
        });
        socket.once('close', () => {
          if (diagnostic) diagnostic.socketClosed = true;
          input.onSocketClosed?.();
        });
      });
    }
    req.once('error', (error) => {
      const code = safeTransportCode(error);
      const stage = code.startsWith('tls_')
        ? 'tls'
        : diagnostic?.httpStatus !== null && diagnostic?.httpStatus !== undefined
          ? 'body_read'
          : diagnostic?.tlsVerified
            ? 'status'
            : diagnostic?.tcpConnected
              ? 'tls'
              : 'connect';
      failed(stage, code, stage === 'body_read' ? (code === 'timeout' ? 'timed_out' : 'failed') : undefined);
      req.destroy();
    });
    abort = () => {
      const stage =
        diagnostic?.httpStatus !== null && diagnostic?.httpStatus !== undefined
          ? 'body_read'
          : diagnostic?.tlsVerified
            ? 'status'
            : diagnostic?.tcpConnected
              ? 'tls'
              : diagnostic?.tcpConnected === false
                ? 'connect'
                : 'unknown';
      failed(stage, 'timeout', stage === 'body_read' ? 'timed_out' : undefined);
      req.destroy();
    };
    input.signal.addEventListener('abort', abort, { once: true });
    if (input.signal.aborted) abort();
    else req.end();
  });
}

// Credential-free, fixed-route transport proof. This does not call runInventory
// or establish API authentication. Normal keyed-reader routes/counts are intact.
export async function probePublicInventoryTransport(dependencies = {}) {
  const controller = new AbortController();
  const result = { httpStatus: null, tlsVerified: false, socketClosed: false };
  const deadlineMs =
    Number.isInteger(dependencies.timeoutMs) && dependencies.timeoutMs > 0 && dependencies.timeoutMs <= 10_000
      ? dependencies.timeoutMs
      : 10_000;
  const closeMs =
    Number.isInteger(dependencies.closeTimeoutMs) &&
    dependencies.closeTimeoutMs > 0 &&
    dependencies.closeTimeoutMs <= 5000
      ? dependencies.closeTimeoutMs
      : 5000;
  let requestIssued = false;
  let resolveClosed;
  const closed = new Promise((done) => {
    resolveClosed = done;
  });
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    requestIssued = true;
    const response = await nativeRequest(
      {
        url: new URL(`https://${host}/api/v1/discover`),
        headers: {
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-public-transport-check/1',
        },
        address: addresses[0],
        signal: controller.signal,
        onTlsVerified: (verified) => {
          result.tlsVerified = verified;
        },
        onSocketClosed: () => {
          result.socketClosed = true;
          resolveClosed();
        },
      },
      dependencies.request ?? request,
    );
    if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599)
      result.httpStatus = response.status;
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch {
    /* Fixed booleans/null only; no body, headers or raw errors. */
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (requestIssued && !result.socketClosed) {
      let closeTimer;
      try {
        await Promise.race([
          closed,
          new Promise((done) => {
            closeTimer = setTimeout(done, closeMs);
          }),
        ]);
      } finally {
        clearTimeout(closeTimer);
      }
    }
  }
  return result;
}
function listPage(value) {
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    value.data.length > 100 ||
    !(
      value.nextCursor === null ||
      (typeof value.nextCursor === 'string' && /^[A-Za-z0-9_+=/-]{1,2048}$/.test(value.nextCursor))
    )
  )
    reject();
  return value;
}
function inspectCapabilities(value, capabilities) {
  if (
    !record(value) ||
    !record(value.data) ||
    !record(value.data.resources) ||
    Object.keys(value.data.resources).length > 200
  )
    reject();
  const found = new Set();
  for (const resource of Object.values(value.data.resources)) {
    if (
      !record(resource) ||
      !Array.isArray(resource.endpoints) ||
      resource.endpoints.length > 1000 ||
      !Array.isArray(resource.operations)
    )
      reject();
    for (const endpoint of resource.endpoints) {
      if (
        !record(endpoint) ||
        !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(endpoint.method) ||
        typeof endpoint.path !== 'string' ||
        endpoint.path.length > 512 ||
        typeof endpoint.operationId !== 'string'
      )
        reject();
      found.add(`${endpoint.method} ${endpoint.path}`);
    }
  }
  for (const [name, [method, path]] of Object.entries(routes))
    capabilities[name] = found.has(`${method} ${path}`);
}
function projectBound(row, resource) {
  return (
    Array.isArray(row.shared) &&
    row.shared.some(
      (entry) =>
        record(entry) &&
        (resource === 'credentials' ? entry.id === projectId : entry.projectId === projectId),
    )
  );
}
function projectRows(resource, rows, seen, candidates) {
  const known = [];
  let unknownCount = 0;
  for (const row of rows) {
    if (!record(row) || !id(row.id) || typeof row.name !== 'string' || row.name.length > 512) reject();
    if (resource === 'projects') {
      if (!['personal', 'team'].includes(row.type)) reject();
      if (row.id === projectId) {
        if (row.type !== 'personal' || seen.has(row.id)) reject();
        seen.add(row.id);
        known.push({ id: projectId, type: 'personal' });
      } else unknownCount++;
    } else if (resource === 'credentials') {
      if (typeof row.type !== 'string' || row.type.length > 128) reject();
      const candidate = candidates.get(row.id);
      if (!candidate) {
        unknownCount++;
        continue;
      }
      if (
        row.name !== candidate.name ||
        row.type !== candidate.type ||
        !projectBound(row, resource) ||
        seen.has(row.id)
      )
        reject();
      seen.add(row.id);
      known.push({ name: row.name, id: row.id, type: row.type });
    } else {
      if (typeof row.active !== 'boolean' || typeof row.isArchived !== 'boolean') reject();
      if (!workflowNames.has(row.name)) {
        unknownCount++;
        continue;
      }
      if (!projectBound(row, resource) || seen.has(row.name)) reject();
      seen.add(row.name);
      known.push({ name: row.name, id: row.id, active: row.active, archived: row.isArchived });
    }
  }
  return { known, unknownCount };
}

/** Four fixed GET-only endpoint families; dependencies are local, non-network test adapters. */
export async function runInventory(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    status: 'complete',
    requestCount: 0,
    authenticationVerified: false,
    projectVerified: false,
    capabilities: Object.fromEntries(Object.keys(routes).map((name) => [name, false])),
    manualExecutionSupportedByReviewedPublicApi: false,
    diagnostics: { version: inventoryDiagnosticVersion, dns: 'not_attempted', requests: [] },
    resources: Object.fromEntries(
      ['projects', 'workflows', 'credentials'].map((name) => [
        name,
        { status: 'not_attempted', httpStatus: null, count: 0, unknownCount: 0, known: [] },
      ]),
    ),
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  // Tests may supply synthetic candidates alongside synthetic transport. The
  // sealed CLI entry point accepts no arguments and always uses the fixed list.
  const supplied = dependencies.credentialCandidates ?? inventoryCredentialCandidates;
  const candidates = new Map(),
    services = new Set();
  if (!Array.isArray(supplied) || supplied.length > 5) {
    result.status = 'invalid_options';
    return result;
  }
  for (const candidate of supplied) {
    if (
      !record(candidate) ||
      Object.keys(candidate).length !== 4 ||
      !['key', 'id', 'name', 'type'].every((k) => Object.hasOwn(candidate, k)) ||
      !Object.hasOwn(credentialTypes, candidate.key) ||
      candidate.type !== credentialTypes[candidate.key] ||
      !id(candidate.id) ||
      typeof candidate.name !== 'string' ||
      candidate.name.length < 1 ||
      candidate.name.length > 200 ||
      /[\x00-\x1f\x7f]/.test(candidate.name) ||
      candidates.has(candidate.id) ||
      services.has(candidate.key)
    ) {
      result.status = 'invalid_options';
      return result;
    }
    candidates.set(candidate.id, candidate);
    services.add(candidate.key);
  }
  const timeoutMs = dependencies.timeoutMs ?? 60_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    result.status = 'invalid_options';
    return result;
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    const get = async (resource, cursor) => {
      const url = new URL(`https://${host}/api/v1/${resource}`);
      if (resource !== 'discover') url.searchParams.set('limit', '100');
      if (resource === 'workflows') {
        url.searchParams.set('projectId', projectId);
        url.searchParams.set('excludePinnedData', 'true');
      }
      if (cursor) url.searchParams.set('cursor', cursor);
      const diagnostic = requestDiagnostic(
        resource,
        1 + result.diagnostics.requests.filter((row) => row.resource === resource).length,
      );
      result.diagnostics.requests.push(diagnostic);
      result.requestCount++;
      const transport = dependencies.request
        ? (input) => nativeRequest(input, dependencies.request)
        : (dependencies.transport ?? nativeRequest);
      const response = await transport({
        url,
        method: 'GET',
        headers: {
          'x-n8n-api-key': key,
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-read-only-inventory/1',
        },
        address: addresses[0],
        signal: controller.signal,
        maxBytes,
        rejectUnauthorized: true,
        servername: host,
        diagnostic,
      });
      if (controller.signal.aborted) reject('timeout');
      if (
        !record(response) ||
        !Number.isInteger(response.status) ||
        response.status < 100 ||
        response.status > 599
      )
        reject();
      diagnostic.httpStatus = response.status;
      if (response.status >= 300 && response.status < 400) {
        diagnosticFailure(diagnostic, 'status', 'redirect_refused');
        reject('redirect_refused');
      }
      if (response.status === 401) {
        diagnosticFailure(diagnostic, 'status', 'unauthorized');
        reject('unauthorized');
      }
      if (!(response.body instanceof Uint8Array) || response.body.byteLength > maxBytes) {
        diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
        diagnostic.bodyRead = 'too_large';
        reject('body_too_large');
      }
      diagnostic.bodyRead = 'complete';
      if (response.status !== 200) {
        diagnosticFailure(diagnostic, 'status', 'http_failed');
        return { status: response.status, value: null, diagnostic };
      }
      let value;
      try {
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
        diagnostic.jsonParsed = true;
      } catch {
        diagnosticFailure(diagnostic, 'parse', 'invalid_json');
        reject();
      }
      // Fail closed if a response reflects this request's private key into an
      // ID, cursor, name or nested field. Do not redact, hash or report the value.
      const pending = [value];
      let visited = 0;
      while (pending.length) {
        if (++visited > 100_000) reject();
        const item = pending.pop();
        if (typeof item === 'string' && item.includes(key)) {
          diagnosticFailure(diagnostic, 'schema', 'confidentiality_rejected');
          reject('confidentiality_rejected');
        }
        if (Array.isArray(item)) pending.push(...item);
        else if (record(item)) pending.push(...Object.values(item));
      }
      result.authenticationVerified = true;
      return { status: response.status, value, diagnostic };
    };
    const discovered = await get('discover');
    if (discovered.status !== 200) reject('http_failed');
    inspectCapabilities(discovered.value, result.capabilities);
    discovered.diagnostic.schemaValidated = true;
    for (const resource of ['projects', 'workflows', 'credentials']) {
      const section = result.resources[resource];
      const seen = new Set();
      const cursors = new Set();
      let cursor;
      try {
        for (let page = 0; page < 2; page++) {
          const response = await get(resource, cursor);
          section.httpStatus = response.status;
          if (response.status !== 200) {
            section.status = response.status === 403 ? 'forbidden' : 'http_failed';
            break;
          }
          const value = listPage(response.value);
          const projected = projectRows(resource, value.data, seen, candidates);
          if (value.nextCursor !== null && cursors.has(value.nextCursor)) reject();
          response.diagnostic.schemaValidated = true;
          section.count += value.data.length;
          section.known.push(...projected.known);
          section.unknownCount += projected.unknownCount;
          if (value.nextCursor === null) {
            section.status = 'complete';
            break;
          }
          cursors.add(value.nextCursor);
          cursor = value.nextCursor;
          section.status = 'page_limit';
        }
      } catch (error) {
        const last = result.diagnostics.requests.at(-1);
        if (last?.failureStage === 'none')
          diagnosticFailure(
            last,
            last.jsonParsed ? 'schema' : 'unknown',
            last.jsonParsed ? 'invalid_schema' : 'network_failed',
          );
        if (
          [
            'redirect_refused',
            'unauthorized',
            'timeout',
            'network_failed',
            'body_too_large',
            'confidentiality_rejected',
          ].includes(error?.code)
        )
          throw error;
        section.status = 'response_rejected';
        section.known = [];
        section.count = 0;
        section.unknownCount = 0;
      }
    }
    result.projectVerified =
      result.resources.projects.status === 'complete' && result.resources.projects.known.length === 1;
    result.status = Object.values(result.resources).every((section) => section.status === 'complete')
      ? 'complete'
      : 'partial';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.failureStage === 'none') {
      const stage =
        last.httpStatus !== null && last.bodyRead !== 'complete'
          ? 'body_read'
          : last.jsonParsed
            ? 'schema'
            : last.tlsVerified
              ? 'status'
              : last.tcpConnected
                ? 'tls'
                : last.tcpConnected === false
                  ? 'connect'
                  : 'unknown';
      diagnosticFailure(
        last,
        stage,
        timedOut ? 'timeout' : stage === 'schema' ? 'invalid_schema' : 'network_failed',
      );
      if (timedOut && last.bodyRead === 'reading') last.bodyRead = 'timed_out';
    }
    result.status = timedOut
      ? 'timeout'
      : [
            'unsafe_dns',
            'timeout',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
            'confidentiality_rejected',
          ].includes(error?.code)
        ? error.code
        : 'network_failed';
    if (result.status === 'confidentiality_rejected') {
      result.projectVerified = false;
      for (const section of Object.values(result.resources)) {
        section.known = [];
        section.count = 0;
        section.unknownCount = 0;
        section.status = 'response_rejected';
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
  }
  return result;
}

export async function projectRuntimeReconciliationWorkflow(dto, expected) {
  const { foundationRuntimeGraphHash, foundationRuntimePublishedHash } =
    await import('./foundation-runtime-checkpoint.mjs');
  const shape = record(dto),
    sortedTags = (v) =>
      Array.isArray(v)
        ? v.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => String(a.id).localeCompare(String(b.id)))
        : null;
  let observedHash = null;
  try {
    if (shape) observedHash = foundationRuntimeGraphHash(dto);
  } catch {
    /* Only fixed comparisons leave this reader. */
  }
  const publicationMatches = (state) => {
    if (
      !shape ||
      dto.active !== (state.activeVersionId !== null) ||
      dto.activeVersionId !== state.activeVersionId
    )
      return false;
    if (state.activeVersionId === null) return true;
    try {
      return (
        record(dto.activeVersion) &&
        dto.activeVersion.workflowId === expected.id &&
        dto.activeVersion.versionId === state.activeVersionId &&
        foundationRuntimePublishedHash(dto.activeVersion) === state.publishedHash
      );
    } catch {
      return false;
    }
  };
  return {
    objectShape: shape,
    idMatches: shape && dto.id === expected.id,
    archiveStateMatches: shape && dto.isArchived === false,
    ownerProjectMatches:
      shape &&
      Array.isArray(dto.shared) &&
      dto.shared.some((s) => s.projectId === projectId && s.role === 'workflow:owner'),
    tagsMatchBaseline:
      shape && JSON.stringify(sortedTags(dto.tags)) === JSON.stringify(sortedTags(expected.tags)),
    pinnedDataAbsent:
      shape &&
      (dto.pinData === undefined ||
        dto.pinData === null ||
        (record(dto.pinData) && Object.keys(dto.pinData).length === 0)),
    baselineGraphEqual: observedHash !== null && observedHash === expected.baseline.graphHash,
    beforeGraphEqual: observedHash !== null && observedHash === expected.before.graphHash,
    targetGraphEqual: observedHash !== null && observedHash === expected.target.graphHash,
    versionMatchesBaseline: shape && dto.versionId === expected.baseline.versionId,
    versionMatchesBefore: shape && dto.versionId === expected.before.versionId,
    versionMatchesTarget: shape && dto.versionId === expected.target.versionId,
    publicationMatchesBaseline: publicationMatches(expected.baseline),
    publicationMatchesBefore: publicationMatches(expected.before),
    publicationMatchesTarget: publicationMatches(expected.target),
  };
}
export async function checkRuntimeReconciliationDiagnostic(repositoryRoot) {
  const context = await readRuntimeReconciliationContext(repositoryRoot);
  if (context.managementAttempts !== 483) throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  try {
    lstatSync(join(context.root, context.paths.claim));
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  } catch (error) {
    if (error.code !== 'ENOENT') throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
  return Object.freeze({
    kind: 'm03_runtime_reconciliation_check',
    status: 'ready',
    technicalAttempt: 13,
    sourceCommitSha: runtimeReconciliationCheckpoint.sourceCommitSha,
    windowId: runtimeReconciliationCheckpoint.windowId,
    managementAttempts: 483,
    controlAttempts: 791,
    combinedAttempts: 1274,
    maximumRequests: 3,
    privateRead: false,
    networkRequests: 0,
  });
}
export async function runRuntimeReconciliationDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    technicalAttempt: 13,
    sourceCommitSha: runtimeReconciliationCheckpoint.sourceCommitSha,
    windowId: runtimeReconciliationCheckpoint.windowId,
    status: 'not_attempted',
    requestCount: 0,
    authenticationVerified: false,
    networkCompletionVerified: false,
    metadata: null,
    workflows: { 'SUB-NOTIFY': null, 'WF-90': null },
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 60000,
    closeTimeoutMs = dependencies.closeTimeoutMs ?? 5000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 60000 ||
    !Number.isInteger(closeTimeoutMs) ||
    closeTimeoutMs < 1 ||
    closeTimeoutMs > 5000
  ) {
    result.status = 'invalid_options';
    return result;
  }
  let budget;
  try {
    budget = await (dependencies.openBudget ?? openRuntimeReconciliationDiagnosticBudget)();
  } catch {
    result.status = 'budget_blocked';
    return result;
  }
  const controller = new AbortController(),
    sockets = [];
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    const routes = [
      ['Machine', 'credentials', '/api/v1/credentials/EmrM03Machine19', 1, 65536],
      ['SUB-NOTIFY', 'workflows', '/api/v1/workflows/tiEhU3dXrMifOnTL?excludePinnedData=true', 1, 524288],
      ['WF-90', 'workflows', '/api/v1/workflows/S9NHRkKFUIiXX2wv?excludePinnedData=true', 2, 524288],
    ];
    for (const [name, resource, path, page, limit] of routes) {
      if (controller.signal.aborted) reject('timeout');
      try {
        const value = budget.admit();
        if (value !== undefined) {
          if (value?.then) Promise.resolve(value).catch(() => {});
          throw Error();
        }
      } catch {
        reject('budget_blocked');
      }
      const diagnostic = requestDiagnostic(resource, page);
      result.diagnostics.requests.push(diagnostic);
      result.requestCount++;
      let resolveClosed;
      const closed = new Promise((done) => {
        resolveClosed = done;
      });
      sockets.push({ closed, diagnostic });
      const transport = dependencies.request
        ? (input) => nativeRequest(input, dependencies.request)
        : (dependencies.transport ?? nativeRequest);
      const response = await transport({
        url: new URL('https://' + host + path),
        method: 'GET',
        headers: {
          'x-n8n-api-key': key,
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-runtime-reconciliation/1',
        },
        address: addresses[0],
        signal: controller.signal,
        maxBytes: limit,
        rejectUnauthorized: true,
        servername: host,
        diagnostic,
        onSocketClosed() {
          diagnostic.socketClosed = true;
          resolveClosed();
        },
      });
      if (controller.signal.aborted) reject('timeout');
      if (
        !record(response) ||
        !Number.isInteger(response.status) ||
        response.status < 100 ||
        response.status > 599
      )
        reject();
      diagnostic.httpStatus = response.status;
      if (response.status !== 200) {
        const code =
          response.status === 401
            ? 'unauthorized'
            : response.status >= 300 && response.status < 400
              ? 'redirect_refused'
              : 'http_failed';
        diagnosticFailure(diagnostic, 'status', code);
        reject(code);
      }
      if (!(response.body instanceof Uint8Array) || response.body.byteLength > limit) {
        diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
        reject('body_too_large');
      }
      diagnostic.bodyRead = 'complete';
      let dto;
      try {
        dto = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
        diagnostic.jsonParsed = true;
      } catch {
        diagnosticFailure(diagnostic, 'parse', 'invalid_json');
        reject();
      }
      if (name === 'Machine') {
        const shape = record(dto),
          expected = budget.context.plan.machine;
        // Presence is checked without reading, traversing or stringifying data.
        result.metadata = {
          objectShape: shape,
          dataPresent: shape && Object.hasOwn(dto, 'data'),
          idMatches: shape && dto.id === 'EmrM03Machine19',
          nameMatches: shape && dto.name === expected.name,
          typeMatches: shape && dto.type === 'httpCustomAuth',
          createdAtMatches: shape && dto.createdAt === expected.createdAt,
          updatedAtMatchesJournal:
            shape &&
            typeof dto.updatedAt === 'string' &&
            dto.updatedAt === budget.context.state.machineUpdatedAt,
          flagsCompatible:
            shape &&
            ['isManaged', 'isGlobal', 'isResolvable'].every((k) => dto[k] === undefined || dto[k] === false),
          resolverCompatible: shape && (dto.resolverId === undefined || dto.resolverId === null),
        };
      } else
        result.workflows[name] = await projectRuntimeReconciliationWorkflow(
          dto,
          budget.context.expected[name],
        );
      dto = null;
      diagnostic.schemaValidated = true;
      if (!diagnostic.socketClosed) {
        let closing;
        await Promise.race([
          closed,
          new Promise((done) => {
            closing = setTimeout(done, closeTimeoutMs);
          }),
        ]);
        clearTimeout(closing);
        if (!diagnostic.socketClosed) reject('network_failed');
      }
    }
    result.authenticationVerified = result.diagnostics.requests.every(
      (v) => v.httpStatus === 200 && v.tlsVerified === true,
    );
    result.status = 'readback_observed';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.failureStage === 'none')
      diagnosticFailure(
        last,
        last.jsonParsed ? 'schema' : 'unknown',
        timedOut ? 'timeout' : last.jsonParsed ? 'invalid_schema' : 'network_failed',
      );
    result.status = timedOut
      ? 'timeout'
      : [
            'budget_blocked',
            'unsafe_dns',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
          ].includes(error?.code)
        ? error.code
        : 'response_rejected';
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
    let closing;
    await Promise.race([
      Promise.all(sockets.map((v) => v.closed)),
      new Promise((done) => {
        closing = setTimeout(done, closeTimeoutMs);
      }),
    ]);
    clearTimeout(closing);
    result.networkCompletionVerified = sockets.every((v) => v.diagnostic.socketClosed);
    if (!result.networkCompletionVerified) result.status = 'network_failed';
    budget.close();
  }
  return result;
}
// Schema/profile validation is not mutation authority. A restoration consumer
// must separately pin the actual owner-recorded readback and current ledgers.
export function assertRuntimeReconciliationReadback(value) {
  const exact = (v, keys) =>
    record(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
  const bools = (v, keys) => exact(v, keys) && keys.every((k) => typeof v[k] === 'boolean');
  const metadataKeys = [
    'objectShape',
    'dataPresent',
    'idMatches',
    'nameMatches',
    'typeMatches',
    'createdAtMatches',
    'updatedAtMatchesJournal',
    'flagsCompatible',
    'resolverCompatible',
  ];
  const workflowKeys = [
    'objectShape',
    'idMatches',
    'archiveStateMatches',
    'ownerProjectMatches',
    'tagsMatchBaseline',
    'pinnedDataAbsent',
    'baselineGraphEqual',
    'beforeGraphEqual',
    'targetGraphEqual',
    'versionMatchesBaseline',
    'versionMatchesBefore',
    'versionMatchesTarget',
    'publicationMatchesBaseline',
    'publicationMatchesBefore',
    'publicationMatchesTarget',
  ];
  if (
    !exact(value, [
      'version',
      'environment',
      'host',
      'projectId',
      'technicalAttempt',
      'sourceCommitSha',
      'windowId',
      'status',
      'requestCount',
      'authenticationVerified',
      'networkCompletionVerified',
      'metadata',
      'workflows',
      'diagnostics',
    ]) ||
    value.version !== 1 ||
    value.environment !== 'dev' ||
    value.host !== host ||
    value.projectId !== projectId ||
    value.technicalAttempt !== 13 ||
    value.sourceCommitSha !== runtimeReconciliationCheckpoint.sourceCommitSha ||
    value.windowId !== runtimeReconciliationCheckpoint.windowId ||
    value.status !== 'readback_observed' ||
    value.requestCount !== 3 ||
    value.authenticationVerified !== true ||
    value.networkCompletionVerified !== true ||
    !bools(value.metadata, metadataKeys) ||
    value.metadata.dataPresent ||
    metadataKeys.filter((k) => k !== 'dataPresent').some((k) => value.metadata[k] !== true) ||
    !exact(value.workflows, ['SUB-NOTIFY', 'WF-90'])
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  for (const key of ['SUB-NOTIFY', 'WF-90']) {
    const w = value.workflows[key];
    if (
      !bools(w, workflowKeys) ||
      [
        'objectShape',
        'idMatches',
        'archiveStateMatches',
        'ownerProjectMatches',
        'tagsMatchBaseline',
        'pinnedDataAbsent',
        'targetGraphEqual',
        'versionMatchesTarget',
        'publicationMatchesTarget',
      ].some((k) => w[k] !== true)
    )
      throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
  if (
    !exact(value.diagnostics, ['version', 'dns', 'requests']) ||
    value.diagnostics.version !== 1 ||
    value.diagnostics.dns !== 'complete' ||
    !Array.isArray(value.diagnostics.requests) ||
    value.diagnostics.requests.length !== 3
  )
    throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  for (const [i, d] of value.diagnostics.requests.entries()) {
    const expected = {
      resource: i === 0 ? 'credentials' : 'workflows',
      page: i === 2 ? 2 : 1,
      tcpConnected: true,
      tlsVerified: true,
      httpStatus: 200,
      bodyRead: 'complete',
      jsonParsed: true,
      schemaValidated: true,
      socketClosed: true,
      failureStage: 'none',
      failureCode: 'none',
    };
    if (!exact(d, Object.keys(expected)) || Object.entries(expected).some(([k, v]) => d[k] !== v))
      throw Error('RUNTIME_RECONCILIATION_BLOCKED');
  }
}

// Exactly one owned workflow GET. This diagnostic neither creates a runtime
// plan nor admits a window, reads credentials/variables, saves or adopts a graph.
export async function runMachineMetadataDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    credentialId: 'EmrM03Machine19',
    expectedCreatedAt: '2026-10-19T00:25:21.669Z',
    status: 'not_attempted',
    requestCount: 0,
    httpStatus: null,
    authenticationVerified: false,
    networkCompletionVerified: false,
    metadata: null,
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 20000,
    closeTimeoutMs = dependencies.closeTimeoutMs ?? 5000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 20000 ||
    !Number.isInteger(closeTimeoutMs) ||
    closeTimeoutMs < 1 ||
    closeTimeoutMs > 5000
  ) {
    result.status = 'invalid_options';
    return result;
  }
  let budget;
  try {
    if (dependencies.admitManagementAttempt === undefined) budget = openMachineMetadataDiagnosticBudget();
    else if (typeof dependencies.admitManagementAttempt !== 'function') throw Error();
  } catch {
    result.status = 'budget_blocked';
    return result;
  }
  const controller = new AbortController();
  let timedOut = false,
    requestIssued = false,
    resolveClosed;
  const closed = new Promise((done) => {
    resolveClosed = done;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    try {
      const answer = (dependencies.admitManagementAttempt ?? (() => budget.admit()))();
      if (answer !== undefined) {
        if (answer?.then) Promise.resolve(answer).catch(() => {});
        throw Error();
      }
    } catch {
      reject('budget_blocked');
    }
    const diagnostic = requestDiagnostic('credentials', 1);
    result.diagnostics.requests.push(diagnostic);
    result.requestCount = 1;
    requestIssued = true;
    const transport = dependencies.request
      ? (input) => nativeRequest(input, dependencies.request)
      : (dependencies.transport ?? nativeRequest);
    const response = await transport({
      url: new URL(`https://${host}/api/v1/credentials/EmrM03Machine19`),
      method: 'GET',
      headers: {
        'x-n8n-api-key': key,
        accept: 'application/json',
        'user-agent': 'everyone-market-radar-m03-machine-metadata/1',
      },
      address: addresses[0],
      signal: controller.signal,
      maxBytes: 65536,
      rejectUnauthorized: true,
      servername: host,
      diagnostic,
      onSocketClosed() {
        diagnostic.socketClosed = true;
        resolveClosed();
      },
    });
    if (controller.signal.aborted) reject('timeout');
    if (
      !record(response) ||
      !Number.isInteger(response.status) ||
      response.status < 100 ||
      response.status > 599
    )
      reject();
    result.httpStatus = diagnostic.httpStatus = response.status;
    if (response.status !== 200) {
      const code =
        response.status === 401
          ? 'unauthorized'
          : response.status >= 300 && response.status < 400
            ? 'redirect_refused'
            : 'http_failed';
      diagnosticFailure(diagnostic, 'status', code);
      reject(code);
    }
    result.authenticationVerified = true;
    if (!(response.body instanceof Uint8Array) || response.body.byteLength > 65536) {
      diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
      reject('body_too_large');
    }
    diagnostic.bodyRead = 'complete';
    let dto;
    try {
      dto = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
      diagnostic.jsonParsed = true;
    } catch {
      diagnosticFailure(diagnostic, 'parse', 'invalid_json');
      reject();
    }
    // Never traverse, read or stringify dto.data. Only fixed public predicates
    // escape this child; no response values, descriptions or unknown timestamps.
    const shape = record(dto),
      updatedAt = shape ? dto.updatedAt : undefined;
    result.metadata = {
      objectShape: shape,
      dataPresent: shape && Object.hasOwn(dto, 'data'),
      idMatches: shape && dto.id === result.credentialId,
      nameMatches: shape && dto.name === 'M03 foundation machine [dev]',
      typeMatches: shape && dto.type === 'httpCustomAuth',
      createdAtMatches: shape && dto.createdAt === result.expectedCreatedAt,
      updatedAtValid: typeof updatedAt === 'string' && Number.isFinite(Date.parse(updatedAt)),
      flagsCompatible:
        shape &&
        ['isManaged', 'isGlobal', 'isResolvable'].every((k) => dto[k] === undefined || dto[k] === false),
      resolverCompatible: shape && (dto.resolverId === undefined || dto.resolverId === null),
      updatedAtMatchesCreatedAt: shape && dto.updatedAt === result.expectedCreatedAt,
    };
    diagnostic.schemaValidated = shape;
    result.status = 'metadata_observed';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.httpStatus !== null && last?.httpStatus !== undefined) result.httpStatus = last.httpStatus;
    if (last?.failureStage === 'none')
      diagnosticFailure(
        last,
        last.jsonParsed ? 'schema' : 'unknown',
        timedOut ? 'timeout' : last.jsonParsed ? 'invalid_schema' : 'network_failed',
      );
    result.status = timedOut
      ? 'timeout'
      : [
            'budget_blocked',
            'unsafe_dns',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
          ].includes(error?.code)
        ? error.code
        : 'network_failed';
    result.metadata = null;
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
    if (requestIssued && !result.diagnostics.requests[0].socketClosed) {
      let closeTimer;
      try {
        await Promise.race([
          closed,
          new Promise((done) => {
            closeTimer = setTimeout(done, closeTimeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(closeTimer);
      }
    }
    result.networkCompletionVerified = requestIssued && result.diagnostics.requests[0].socketClosed;
    if (requestIssued && !result.networkCompletionVerified) {
      result.status = 'network_failed';
      result.metadata = null;
    }
    budget?.close();
  }
  return result;
}

// Inputs are the received JSON DTO and the reader's source-pinned baseline.
// Only expected identifiers/key names leave this projection; received values,
// unknown key names and credential fields never do. This grants no graph parity.
export function projectBaselineNodeDifferences(dto, baseline, parameterCandidates = null) {
  try {
    const expected = baseline?.body?.nodes;
    if (
      baseline?.key !== 'WF-00' ||
      !Array.isArray(expected) ||
      expected.length > 64 ||
      !Array.isArray(dto?.nodes) ||
      dto.nodes.length !== expected.length
    )
      return null;
    const received = new Map();
    for (const node of dto.nodes) {
      if (
        !record(node) ||
        typeof node.id !== 'string' ||
        typeof node.name !== 'string' ||
        !record(node.parameters) ||
        Object.keys(node.parameters).length > 256 ||
        received.has(node.id) ||
        !Array.isArray(node.position) ||
        node.position.length !== 2 ||
        node.position.some((v) => !Number.isFinite(v))
      )
        return null;
      received.set(node.id, node);
    }
    const differences = [];
    for (const node of expected) {
      const actual = received.get(node.id);
      if (!actual || !record(node.parameters)) return null;
      const keys = Object.keys(node.parameters),
        keySet = new Set(keys),
        missingParameterKeys = keys.filter((key) => !Object.hasOwn(actual.parameters, key)).sort(),
        changedParameterKeys = keys
          .filter(
            (key) =>
              Object.hasOwn(actual.parameters, key) &&
              !isDeepStrictEqual(actual.parameters[key], node.parameters[key]),
          )
          .sort(),
        extraParameterKeyCount = Object.keys(actual.parameters).filter((key) => !keySet.has(key)).length,
        layoutChanged = !isDeepStrictEqual(actual.position, node.position),
        native = parameterCandidates?.nativeDefaults?.nodes?.find((value) => value.id === node.id);
      if (
        missingParameterKeys.length ||
        changedParameterKeys.length ||
        extraParameterKeyCount ||
        layoutChanged
      )
        differences.push({
          nodeId: node.id,
          nodeName: node.name,
          changedParameterKeys,
          missingParameterKeys,
          extraParameterKeyCount,
          layoutChanged,
          canonicalOrNativeDefaultsMatch:
            isDeepStrictEqual(actual.parameters, node.parameters) ||
            (native !== undefined && isDeepStrictEqual(actual.parameters, native.parameters)),
        });
    }
    return differences;
  } catch {
    return null;
  }
}

export async function runWorkflowBaselineDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    status: 'not_attempted',
    requestCount: 0,
    authenticationVerified: false,
    projectVerified: false,
    workflowKey: 'WF-00',
    observedVersionId: null,
    baseline: null,
    forensics: null,
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  let baseline,
    parameterCandidates,
    diagnoseFoundationRuntimeBaseline,
    diagnoseFoundationRuntimeBaselineVariants;
  try {
    const checkpoint = await import('./foundation-runtime-checkpoint.mjs');
    const { foundationRuntimeCheckpoint } = checkpoint;
    diagnoseFoundationRuntimeBaseline = checkpoint.diagnoseFoundationRuntimeBaseline;
    diagnoseFoundationRuntimeBaselineVariants = checkpoint.diagnoseFoundationRuntimeBaselineVariants;
    const pinned = foundationRuntimeCheckpoint.workflows['WF-00'];
    const record = JSON.parse(
      readFileSync(new URL('../../n8n/workflows/WF-00.json', import.meta.url), 'utf8'),
    );
    if (
      record.key !== 'WF-00' ||
      record.id !== pinned.id ||
      record.versionId !== pinned.versionId ||
      record.projectId !== projectId ||
      createHash('sha256').update(JSON.stringify(record)).digest('hex') !== pinned.recordHash
    )
      reject();
    baseline = {
      key: 'WF-00',
      id: pinned.id,
      versionId: pinned.versionId,
      body: {
        name: record.workflow.name,
        nodes: record.workflow.nodes,
        connections: record.workflow.connections,
        settings: record.workflow.settings,
      },
      tags: record.workflow.tags,
      ...(Object.hasOwn(record, 'nativeReadonlySettings')
        ? { nativeReadonlySettings: record.nativeReadonlySettings }
        : {}),
    };
    if (diagnoseFoundationRuntimeBaseline(null, baseline, projectId).failedChecks.includes('expected_shape'))
      reject();
    parameterCandidates = checkpoint.foundationRuntimeExecutionParameterCandidates(baseline.body);
  } catch {
    result.status = 'response_rejected';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 20000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) {
    result.status = 'invalid_options';
    return result;
  }
  const controller = new AbortController();
  let timedOut = false,
    requestIssued = false,
    resolveClosed;
  const closed = new Promise((done) => {
    resolveClosed = done;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    const diagnostic = requestDiagnostic('workflows', 1);
    result.diagnostics.requests.push(diagnostic);
    result.requestCount = 1;
    requestIssued = true;
    const transport = dependencies.request
      ? (input) => nativeRequest(input, dependencies.request)
      : (dependencies.transport ?? nativeRequest);
    const response = await transport({
      url: new URL(`https://${host}/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true`),
      method: 'GET',
      headers: {
        'x-n8n-api-key': key,
        accept: 'application/json',
        'user-agent': 'everyone-market-radar-m03-baseline-read-only/1',
      },
      address: addresses[0],
      signal: controller.signal,
      maxBytes,
      rejectUnauthorized: true,
      servername: host,
      diagnostic,
      onSocketClosed: resolveClosed,
    });
    if (controller.signal.aborted) reject('timeout');
    if (
      !record(response) ||
      !Number.isInteger(response.status) ||
      response.status < 100 ||
      response.status > 599
    )
      reject();
    diagnostic.httpStatus = response.status;
    if (response.status !== 200) {
      const code =
        response.status >= 300 && response.status < 400
          ? 'redirect_refused'
          : response.status === 401
            ? 'unauthorized'
            : 'http_failed';
      diagnosticFailure(diagnostic, 'status', code);
      reject(code);
    }
    if (!(response.body instanceof Uint8Array) || response.body.byteLength > maxBytes) {
      diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
      reject('body_too_large');
    }
    diagnostic.bodyRead = 'complete';
    let dto;
    try {
      dto = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
      diagnostic.jsonParsed = true;
    } catch {
      diagnosticFailure(diagnostic, 'parse', 'invalid_json');
      reject();
    }
    const pending = [dto];
    let visited = 0;
    while (pending.length) {
      if (++visited > 100000) reject();
      const value = pending.pop();
      if (typeof value === 'string' && value.includes(key)) {
        diagnosticFailure(diagnostic, 'schema', 'confidentiality_rejected');
        reject('confidentiality_rejected');
      }
      if (Array.isArray(value)) pending.push(...value);
      else if (record(value)) pending.push(...Object.values(value));
    }
    result.authenticationVerified = true;
    result.observedVersionId =
      typeof dto?.versionId === 'string' &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(dto.versionId)
        ? dto.versionId
        : null;
    result.baseline = diagnoseFoundationRuntimeBaseline(dto, baseline, projectId);
    const forensics = diagnoseFoundationRuntimeBaselineVariants(dto, baseline);
    result.forensics =
      forensics === null
        ? null
        : {
            ...forensics,
            nodeDifferences: projectBaselineNodeDifferences(dto, baseline, parameterCandidates),
          };
    result.projectVerified =
      !result.baseline.failedChecks.includes('owner_project') &&
      !result.baseline.failedChecks.includes('dto_shape');
    diagnostic.schemaValidated = !result.baseline.failedChecks.includes('dto_shape');
    result.status = result.baseline.failedChecks.length === 0 ? 'matching_baseline' : 'baseline_mismatch';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.failureStage === 'none')
      diagnosticFailure(
        last,
        last.jsonParsed ? 'schema' : 'unknown',
        timedOut ? 'timeout' : last.jsonParsed ? 'invalid_schema' : 'network_failed',
      );
    result.status = timedOut
      ? 'timeout'
      : [
            'unsafe_dns',
            'timeout',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
            'confidentiality_rejected',
          ].includes(error?.code)
        ? error.code
        : 'network_failed';
    result.baseline = null;
    result.forensics = null;
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
    if (requestIssued && !result.diagnostics.requests[0].socketClosed) {
      let closeTimer;
      try {
        await Promise.race([
          closed,
          new Promise((done) => {
            closeTimer = setTimeout(done, 5000);
          }),
        ]);
      } finally {
        clearTimeout(closeTimer);
      }
      if (!result.diagnostics.requests[0].socketClosed) {
        result.status = 'network_failed';
        result.baseline = null;
        result.forensics = null;
      }
    }
  }
  return result;
}

const execution31130NodeFields = Object.freeze([
  'id',
  'name',
  'type',
  'typeVersion',
  'parameters',
  'position',
  'disabled',
  'credentials',
  'extendsCredential',
  'retryOnFail',
  'maxTries',
  'waitBetweenTries',
  'onError',
  'continueOnFail',
  'alwaysOutputData',
  'executeOnce',
  'notes',
  'notesInFlow',
  'webhookId',
]);
const execution31130SettingFields = Object.freeze([
  'executionOrder',
  'timezone',
  'executionTimeout',
  'callerPolicy',
  'callerIds',
  'availableInMCP',
  'saveDataErrorExecution',
  'saveDataSuccessExecution',
  'saveManualExecutions',
  'saveExecutionProgress',
  'errorWorkflow',
  'timeSavedPerExecution',
  'executionConcurrency',
  'binaryMode',
]);
export async function projectExecution31130ParameterDefaults(dto, context) {
  const {
      foundationRuntimeGraphHash,
      foundationRuntimeObservedGraphHash,
      foundationRuntimeExecutionParameterCandidates,
    } = await import('./foundation-runtime-checkpoint.mjs'),
    source = context?.expectedBody;
  if (!source || foundationRuntimeGraphHash(source) !== context.bodyHash)
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const candidates = foundationRuntimeExecutionParameterCandidates(source),
    snapshot = dto?.workflowData,
    sets = source.nodes.filter((n) => n.type === 'n8n-nodes-base.set'),
    tasks = sets.length === 1 ? dto?.data?.resultData?.runData?.[sets[0].name] : null,
    knownSetExecuted = Array.isArray(tasks) && tasks.length > 0 && tasks.length <= 256 && tasks.every(record),
    matches = (body) => {
      try {
        return (
          body !== null &&
          foundationRuntimeObservedGraphHash(snapshot, {
            key: 'WF-00',
            id: 'MzimjpsuyPuK7SKe',
            nativeReadonlySettings: { binaryMode: 'separate' },
          }) === foundationRuntimeGraphHash(body)
        );
      } catch {
        return false;
      }
    },
    nativeDefaultsMatch = matches(candidates.nativeDefaults),
    nativeDefaultsAndSetOutputMatch = knownSetExecuted && matches(candidates.nativeDefaultsAndSetOutput),
    nodeTypes = Object.fromEntries(
      [
        'executeWorkflowTrigger',
        'manualTrigger',
        'code',
        'set',
        'httpRequest',
        'if',
        'executeWorkflow',
        'errorTrigger',
        'scheduleTrigger',
        'switch',
        'webhook',
        'wait',
        'respondToWebhook',
      ].map((type) => {
        const selected = source.nodes
            .map((n, i) => ({ node: n, index: i }))
            .filter((v) => v.node.type === 'n8n-nodes-base.' + type),
          match = (body) =>
            body !== null &&
            selected.every(
              (v) =>
                record(snapshot?.nodes?.[v.index]) &&
                snapshot.nodes[v.index].id === v.node.id &&
                snapshot.nodes[v.index].type === v.node.type &&
                snapshot.nodes[v.index].typeVersion === v.node.typeVersion &&
                isDeepStrictEqual(snapshot.nodes[v.index].parameters, body.nodes[v.index].parameters),
            );
        return [
          type,
          {
            present: selected.length > 0,
            parametersMatch:
              match(candidates.nativeDefaults) ||
              (knownSetExecuted && match(candidates.nativeDefaultsAndSetOutput)),
          },
        ];
      }),
    ),
    rootIdentityMatches =
      dto?.id === '31130' && dto.workflowId === 'MzimjpsuyPuK7SKe' && snapshot?.id === 'MzimjpsuyPuK7SKe',
    versionMatchesIntent = dto?.workflowVersionId === context.versionId;
  return {
    fields: {
      sourceBodyHashMatches: true,
      rootIdentityMatches,
      versionMatchesIntent,
      knownSetExecuted,
      nativeDefaultsMatch,
      nativeDefaultsAndSetOutputMatch,
      graphQualified:
        rootIdentityMatches &&
        versionMatchesIntent &&
        (nativeDefaultsMatch || nativeDefaultsAndSetOutputMatch),
    },
    nodeTypes,
  };
}
export async function projectExecution31130Categories(dto, context) {
  const {
    foundationRuntimeGraphHash,
    foundationRuntimeObservedGraphHash,
    foundationEditableSettings,
    diagnoseFoundationRuntimeBaselineVariants,
  } = await import('./foundation-runtime-checkpoint.mjs');
  const wanted = context?.expectedBody;
  if (!wanted || foundationRuntimeGraphHash(wanted) !== context.bodyHash)
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  const snapshot = record(dto?.workflowData) ? dto.workflowData : null,
    actualNodes =
      Array.isArray(snapshot?.nodes) && snapshot.nodes.length <= 200 && snapshot.nodes.every(record)
        ? snapshot.nodes
        : [],
    validNodes =
      Array.isArray(snapshot?.nodes) && snapshot.nodes.length <= 200 && snapshot.nodes.every(record),
    actualSettings = record(snapshot?.settings) ? snapshot.settings : {},
    sameField = (a, b, k) => Object.hasOwn(a, k) === Object.hasOwn(b, k) && isDeepStrictEqual(a[k], b[k]),
    indexIds = (nodes) => new Map(nodes.map((n) => [n.id, n])),
    actualById = indexIds(actualNodes),
    wantedById = indexIds(wanted.nodes),
    idsValid =
      validNodes &&
      actualNodes.length === wanted.nodes.length &&
      actualById.size === actualNodes.length &&
      wantedById.size === wanted.nodes.length &&
      [...actualById.keys()].every((id) => typeof id === 'string' && wantedById.has(id)),
    aligned = idsValid ? wanted.nodes.map((n) => actualById.get(n.id)) : [],
    nodeFields = Object.fromEntries(
      execution31130NodeFields.map((k) => [
        k,
        idsValid && aligned.every((n, i) => sameField(n, wanted.nodes[i], k)),
      ]),
    ),
    settings = Object.fromEntries(
      execution31130SettingFields.map((k) => [
        k,
        {
          equal: record(snapshot?.settings) && sameField(actualSettings, wanted.settings, k),
          expectedPresent: Object.hasOwn(wanted.settings, k),
          observedPresent: Object.hasOwn(actualSettings, k),
        },
      ]),
    );
  let editable = null,
    categories = null;
  try {
    editable = foundationEditableSettings(actualSettings);
    if (validNodes)
      categories = diagnoseFoundationRuntimeBaselineVariants(
        { ...snapshot, settings: editable },
        { key: 'WF-00', body: wanted },
      );
  } catch {}
  const fallbackNodes = Object.fromEntries(
      [
        'identityEqual',
        'parametersEqual',
        'credentialsEqual',
        'behaviorEqual',
        'layoutEqual',
        'annotationsEqual',
      ].map((k) => [k, false]),
    ),
    fallbackSettings = Object.fromEntries(
      ['retentionEqual', 'mcpVisibilityEqual', 'errorRoutingEqual', 'otherEqual'].map((k) => [k, false]),
    ),
    graphMatch = (body) => {
      try {
        return foundationRuntimeGraphHash(body) === context.bodyHash;
      } catch {
        return false;
      }
    },
    normalizedNodes = (nodes) =>
      nodes.map((n) =>
        Object.fromEntries(
          Object.entries(n).filter(
            ([k, v]) =>
              !(
                ['disabled', 'retryOnFail', 'continueOnFail', 'executeOnce', 'alwaysOutputData'].includes(
                  k,
                ) && v === false
              ),
          ),
        ),
      ),
    clearDefault = (v) => {
      const out = { ...v };
      if (out.errorWorkflow === 'DEFAULT') delete out.errorWorkflow;
      return out;
    },
    body = editable && snapshot ? { ...snapshot, settings: editable } : null,
    settingsValid = record(snapshot?.settings),
    components = {
      nameEqual: typeof snapshot?.name === 'string' && snapshot.name === wanted.name,
      nodesEqual: validNodes && isDeepStrictEqual(actualNodes, wanted.nodes),
      connectionsEqual:
        record(snapshot?.connections) && isDeepStrictEqual(snapshot.connections, wanted.connections),
      settingsEqual: settingsValid && isDeepStrictEqual(editable, wanted.settings),
    };
  return {
    components,
    nodes: {
      indexExact: components.nodesEqual,
      idSetEqual: idsValid,
      idOrderEqual: idsValid && actualNodes.every((n, i) => n.id === wanted.nodes[i].id),
      idAlignedExact: idsValid && isDeepStrictEqual(aligned, wanted.nodes),
    },
    nodeFields,
    settings,
    settingsUnknownKeyPresent:
      settingsValid && Object.keys(actualSettings).some((k) => !execution31130SettingFields.includes(k)),
    nodeUnknownKeyPresent: actualNodes.some((n) =>
      Object.keys(n).some((k) => !execution31130NodeFields.includes(k)),
    ),
    nodeCategories: categories?.nodeCategories ?? fallbackNodes,
    settingsCategories: categories?.settingsCategories ?? fallbackSettings,
    normalizationCandidates: {
      nodesEqualAfterKnownFalseDefaults:
        validNodes && isDeepStrictEqual(normalizedNodes(actualNodes), normalizedNodes(wanted.nodes)),
      graphEqualAfterNodeOrderAlignment: idsValid && body !== null && graphMatch({ ...body, nodes: aligned }),
      graphEqualAfterLayoutOmitted:
        validNodes &&
        body !== null &&
        (() => {
          const omit = (nodes) =>
            nodes.map((n) => Object.fromEntries(Object.entries(n).filter(([k]) => k !== 'position')));
          try {
            return (
              foundationRuntimeGraphHash({ ...body, nodes: omit(actualNodes) }) ===
              foundationRuntimeGraphHash({ ...wanted, nodes: omit(wanted.nodes) })
            );
          } catch {
            return false;
          }
        })(),
      graphEqualAfterNativeBinaryModeOmitted: (() => {
        try {
          return (
            foundationRuntimeObservedGraphHash(snapshot, {
              key: 'WF-00',
              id: 'MzimjpsuyPuK7SKe',
              nativeReadonlySettings: { binaryMode: 'separate' },
            }) === context.bodyHash
          );
        } catch {
          return false;
        }
      })(),
      settingsEqualAfterDefaultErrorWorkflowOmitted:
        settingsValid && isDeepStrictEqual(clearDefault(editable ?? {}), clearDefault(wanted.settings)),
      graphEqualAfterDefaultErrorWorkflowOmitted:
        body !== null && graphMatch({ ...body, settings: clearDefault(body.settings) }),
    },
  };
}
export async function projectExecution31130Snapshot(dto, context) {
  const shape = record(dto),
    snapshot = shape ? dto.workflowData : undefined,
    data = shape ? dto.data : undefined,
    resultData = record(data) ? data.resultData : undefined,
    runs = record(resultData) ? resultData.runData : undefined,
    nodes =
      record(snapshot) && Array.isArray(snapshot.nodes) && snapshot.nodes.length <= 200 ? snapshot.nodes : [],
    nodesShape =
      nodes.length > 0 &&
      nodes.every((n) => record(n) && typeof n.name === 'string' && n.name.length <= 200) &&
      new Set(nodes.map((n) => n.name)).size === nodes.length,
    manual = nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger' && n.disabled !== true),
    eligibleTriggers = nodes.filter(
      (n) =>
        n.disabled !== true &&
        [
          'n8n-nodes-base.manualTrigger',
          'n8n-nodes-base.scheduleTrigger',
          'n8n-nodes-base.webhook',
          'n8n-nodes-base.formTrigger',
          '@n8n/n8n-nodes-langchain.chatTrigger',
        ].includes(n.type),
    ),
    pins = record(resultData) ? resultData.pinData : undefined,
    redaction = record(data) ? data.redactionInfo : undefined,
    exact = (v, keys) =>
      record(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k)),
    emptyJson = (item) => record(item) && exact(item.json, []),
    items = manual.length === 1 && record(pins) ? pins[manual[0].name] : undefined,
    singleEmptyPin =
      manual.length === 1 &&
      exact(pins, [manual[0].name]) &&
      Array.isArray(items) &&
      items.length === 1 &&
      exact(items[0], ['json']) &&
      emptyJson(items[0]),
    f = {
      objectShape: shape,
      dataObject: record(data),
      resultDataObject: record(resultData),
      idMatches: shape && dto.id === '31130',
      workflowMatches: shape && dto.workflowId === 'MzimjpsuyPuK7SKe',
      versionMatchesIntent: shape && dto.workflowVersionId === context.versionId,
      snapshotObject: record(snapshot),
      snapshotIdMatches: record(snapshot) && snapshot.id === 'MzimjpsuyPuK7SKe',
      snapshotVersionMatches: record(snapshot) && snapshot.versionId === context.versionId,
      graphComputable: false,
      executedGraphMatches: false,
      nodesShape,
      runDataShape: record(runs),
      runDataNamesKnown:
        record(runs) && nodesShape && Object.keys(runs).every((k) => nodes.some((n) => n.name === k)),
      pinsPresent: record(resultData) && Object.hasOwn(resultData, 'pinData'),
      pinsNull: pins === null,
      pinsObject: record(pins),
      pinsEmpty: exact(pins, []),
      pinsSingleEmptyManual: singleEmptyPin,
      pinsPassExistingReader:
        pins === undefined ||
        exact(pins, []) ||
        (singleEmptyPin &&
          dto?.mode === 'manual' &&
          eligibleTriggers.length === 1 &&
          eligibleTriggers[0].type === 'n8n-nodes-base.manualTrigger' &&
          snapshot?.settings?.availableInMCP === true),
      redactionPresent: record(data) && Object.hasOwn(data, 'redactionInfo'),
      redactionPassesExistingReader:
        redaction === undefined ||
        (record(redaction) && redaction.isRedacted === false && redaction.provisional !== true),
      rootParentAbsent: record(data) && data.parentExecution === undefined,
      manualOutputEmptyJson: false,
      executeRunsShape: true,
      childLinksShape: true,
      observedChildLink: false,
      unexpectedChildLink: false,
    };
  try {
    const { foundationRuntimeObservedGraphHash, foundationRuntimeCheckpoint } =
      await import('./foundation-runtime-checkpoint.mjs');
    const hash = foundationRuntimeObservedGraphHash(snapshot, {
      key: 'WF-00',
      id: 'MzimjpsuyPuK7SKe',
      nativeReadonlySettings: foundationRuntimeCheckpoint.workflows['WF-00'].nativeReadonlySettings,
    });
    f.graphComputable = true;
    f.executedGraphMatches = hash === context.bodyHash;
  } catch {
    /* Only fixed comparison predicates leave this child. */
  }
  if (manual.length === 1 && record(runs)) {
    const tasks = runs[manual[0].name],
      item = tasks?.[0]?.data?.main?.[0];
    f.manualOutputEmptyJson =
      Array.isArray(tasks) &&
      tasks.length === 1 &&
      Array.isArray(item) &&
      item.length === 1 &&
      emptyJson(item[0]);
  }
  const childIds = new Set();
  const add = (link, target) => {
    if (
      !record(link) ||
      typeof link.executionId !== 'string' ||
      !/^[1-9]\d{0,31}$/.test(link.executionId) ||
      link.workflowId !== '4JMHLDBSdgGxhPlk' ||
      target !== '4JMHLDBSdgGxhPlk'
    ) {
      f.childLinksShape = false;
      f.unexpectedChildLink = true;
      return;
    }
    if (link.executionId !== '31131') {
      f.unexpectedChildLink = true;
      return;
    }
    f.observedChildLink = true;
    if (f.executedGraphMatches) childIds.add('31131');
  };
  if (record(runs) && nodesShape) {
    for (const node of nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow')) {
      const tasks = runs[node.name] ?? [],
        target =
          typeof node.parameters?.workflowId === 'string'
            ? node.parameters.workflowId
            : node.parameters?.workflowId?.value;
      if (!Array.isArray(tasks) || tasks.length > 120) {
        f.executeRunsShape = false;
        continue;
      }
      for (const task of tasks) {
        if (!record(task)) {
          f.executeRunsShape = false;
          continue;
        }
        if (task.metadata?.subExecution !== undefined) add(task.metadata.subExecution, target);
        const waiting = task.metadata?.waitingChildExecutionIds;
        if (waiting !== undefined) {
          if (!Array.isArray(waiting) || waiting.length > 120) f.childLinksShape = false;
          else for (const id of waiting) add({ executionId: id, workflowId: target }, target);
        }
        if (task.data !== undefined) {
          if (!record(task.data) || Object.keys(task.data).length > 8) {
            f.executeRunsShape = false;
            continue;
          }
          for (const branches of Object.values(task.data)) {
            if (!Array.isArray(branches) || branches.length > 120) {
              f.executeRunsShape = false;
              continue;
            }
            for (const branch of branches) {
              if (branch === null) continue;
              if (!Array.isArray(branch) || branch.length > 120) {
                f.executeRunsShape = false;
                continue;
              }
              for (const item of branch)
                if (record(item) && item.metadata?.subExecution !== undefined)
                  add(item.metadata.subExecution, target);
            }
          }
        }
      }
    }
  } else f.executeRunsShape = false;
  return { fields: f, childExecutionIds: [...childIds], nativeTreeSettlementProven: false };
}

// The same native streaming/projection implementations used by acceptance,
// restricted here to one metadata-only path and a separate charged purpose.
export async function runNativeExecution31130MetadataDiagnostic(
  key,
  dependencies = {},
  snapshotMode = false,
) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    technicalAttempt: 16,
    status: 'not_attempted',
    requestCount: 0,
    maximumRequests: 1,
    httpStatus: null,
    tlsVerified: false,
    readerMetadataVerified: false,
    networkCompletionVerified: false,
    controlReservationConservative: true,
    acceptanceProven: false,
    metadata: null,
    readerFailure: null,
    transportFailureCode: null,
    readerState: null,
    transportState: null,
  };
  if (![false, true, 'categories', 'parameter_defaults'].includes(snapshotMode))
    throw Error('EXECUTION_31130_DIAGNOSTIC_BLOCKED');
  if (snapshotMode) Object.assign(result, { forensics: null, snapshotStage: 'not_attempted' });
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length < 8 || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 20000,
    closeTimeoutMs = dependencies.closeTimeoutMs ?? 5000,
    now = dependencies.now ?? Date.now;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 20000 ||
    !Number.isInteger(closeTimeoutMs) ||
    closeTimeoutMs < 1 ||
    closeTimeoutMs > 5000
  ) {
    result.status = 'invalid_options';
    return result;
  }
  let context,
    budget,
    reader,
    native,
    job,
    timedOut = false,
    responseClosed = false,
    sends = 0;
  try {
    context = await (
      dependencies.readContext ??
      (snapshotMode === 'parameter_defaults'
        ? readParameterDefaultsExecution31130Context
        : snapshotMode === 'categories'
          ? readCategoryExecution31130Context
          : snapshotMode
            ? readSnapshotExecution31130Context
            : readNativeExecution31130Context)
    )();
    budget = await (dependencies.openBudget
      ? dependencies.openBudget()
      : openExecution31130MetadataDiagnosticBudget(
          undefined,
          snapshotMode === 'parameter_defaults'
            ? 'parameter_defaults'
            : snapshotMode === 'categories'
              ? 'categories'
              : snapshotMode
                ? 'snapshot'
                : true,
        ));
  } catch {
    result.status = 'budget_blocked';
    return result;
  }
  const nativeCodes = new Set([
    'CONFIG',
    'REQUEST',
    'DNS',
    'DEADLINE',
    'SOCKET',
    'TLS',
    'STATUS',
    'FRAMING',
    'RESPONSE_LIMIT',
    'TRUNCATED',
    'RESPONSE',
    'ABORTED',
    'STREAM',
    'CLOSE',
    'CLOSED',
  ]);
  const recordTransportFailure = (error) => {
    const match = /^FOUNDATION_NATIVE_TRANSPORT_([A-Z_]+)$/.exec(error?.message ?? '');
    if (match && nativeCodes.has(match[1]) && result.transportFailureCode === null)
      result.transportFailureCode = match[1];
  };
  let rejectTimeout;
  const timeout = new Promise((_, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    native?.close();
    rejectTimeout(Error('NATIVE_DIAGNOSTIC_TIMEOUT'));
  }, timeoutMs);
  try {
    const [
      { createFoundationNativeTransport },
      { createFoundationNativeReader, assertFoundationNativeMetadataReceipt },
    ] = await Promise.all([
      import('./foundation-native-transport.mjs'),
      import('./foundation-native-reader.mjs'),
    ]);
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url), 'utf8'),
    );
    native = createFoundationNativeTransport(
      {
        apiKey: key,
        bindings,
        authorizeExecution: (args) => args.method === 'GET' && args.executionId === '31130',
      },
      dependencies.nativeTransport ?? {},
    );
    const admit = (args) => {
      if (
        result.requestCount !== 0 ||
        args.kind !== (snapshotMode ? 'full' : 'metadata') ||
        args.workflowId !== 'MzimjpsuyPuK7SKe' ||
        args.executionId !== '31130'
      )
        throw Error('NATIVE_DIAGNOSTIC_ADMISSION');
      const answer = budget.admit();
      if (answer !== undefined) {
        if (answer?.then) Promise.resolve(answer).catch(() => {});
        throw Error('NATIVE_DIAGNOSTIC_ADMISSION');
      }
      result.requestCount = 1;
    };
    const requestNative = async (input) => {
      if (
        sends++ !== 0 ||
        result.requestCount !== 1 ||
        input.method !== 'GET' ||
        input.path !== '/api/v1/executions/31130?includeData=' + String(!!snapshotMode)
      )
        throw Error('NATIVE_DIAGNOSTIC_ROUTE');
      try {
        const response = await native.request(input);
        result.httpStatus = response.status;
        result.tlsVerified = true;
        response.closed.then(() => {
          responseClosed = true;
        }, recordTransportFailure);
        return response;
      } catch (error) {
        recordTransportFailure(error);
        throw error;
      }
    };
    if (snapshotMode) {
      job = (async () => {
        admit({ kind: 'full', workflowId: 'MzimjpsuyPuK7SKe', executionId: '31130' });
        result.snapshotStage = 'request';
        const response = await requestNative({
          method: 'GET',
          path: '/api/v1/executions/31130?includeData=true',
        });
        if (response.status !== 200) {
          response.abort();
          throw Error('SNAPSHOT_HTTP');
        }
        result.snapshotStage = 'body';
        let text = '',
          bytes = 0;
        const decoder = new TextDecoder('utf-8', { fatal: true });
        for await (const chunk of response.body) {
          if (!(chunk instanceof Uint8Array) || (bytes += chunk.byteLength) > 8 * 1024 * 1024)
            throw Error('SNAPSHOT_LIMIT');
          text += decoder.decode(chunk, { stream: true });
        }
        text += decoder.decode();
        result.snapshotStage = 'parse';
        let dto = JSON.parse(text);
        text = '';
        result.snapshotStage = 'projection';
        result.forensics = await projectExecution31130Snapshot(dto, context);
        if (snapshotMode === 'categories')
          result.forensics.categories = await projectExecution31130Categories(dto, context);
        if (snapshotMode === 'parameter_defaults')
          result.forensics.parameterDefaults = await projectExecution31130ParameterDefaults(dto, context);
        const knownStatus = [
          'new',
          'running',
          'waiting',
          'unknown',
          'success',
          'error',
          'canceled',
          'crashed',
        ];
        result.metadata = {
          executionId: dto?.id === '31130' ? '31130' : null,
          workflowId: dto?.workflowId === 'MzimjpsuyPuK7SKe' ? 'MzimjpsuyPuK7SKe' : null,
          mode: dto?.mode === 'manual' ? 'manual' : null,
          status: knownStatus.includes(dto?.status) ? dto.status : null,
          versionMatchesIntent: dto?.workflowVersionId === context.versionId,
        };
        dto = null;
        await response.closed;
        result.snapshotStage = 'complete';
      })();
      await Promise.race([job, timeout]);
      result.status = 'native_snapshot_classified';
    } else {
      reader = createFoundationNativeReader({
        bindings,
        deadlineAt: now() + timeoutMs,
        now,
        sensitiveValues: [key],
        admitControlAttempt: admit,
        transport: { request: requestNative },
      });
      job = reader.metadata({
        workflowKey: 'WF-00',
        executionId: '31130',
        expectedMode: 'manual',
        intentAt: context.intentAt,
      });
      const metadata = assertFoundationNativeMetadataReceipt(await Promise.race([job, timeout]));
      result.readerMetadataVerified = true;
      result.metadata = {
        executionId: '31130',
        workflowId: 'MzimjpsuyPuK7SKe',
        mode: metadata.mode,
        status: metadata.status,
        versionMatchesIntent: metadata.versionId === context.versionId,
      };
      result.status = result.metadata.versionMatchesIntent
        ? 'native_metadata_verified'
        : 'native_metadata_failed';
    }
  } catch {
    result.readerFailure = reader?.lastFailure() ?? null;
    result.status = snapshotMode ? 'native_snapshot_failed' : 'native_metadata_failed';
  } finally {
    clearTimeout(timer);
    native?.close();
    key = null;
    const until = Date.now() + closeTimeoutMs;
    while (
      Date.now() < until &&
      (reader?.state().busy ||
        reader?.state().pendingRequests ||
        native?.state().pendingRequests ||
        native?.state().unclosedResponses)
    )
      await new Promise((done) => setTimeout(done, Math.min(10, Math.max(1, until - Date.now()))));
    job?.catch(() => {});
    result.readerState = reader?.state() ?? null;
    result.transportState = native?.state() ?? null;
    result.networkCompletionVerified =
      responseClosed &&
      (snapshotMode ||
        (result.readerState?.pendingRequests === 0 &&
          result.readerState.unclosedResponses === 0 &&
          result.readerState.busy === false)) &&
      result.transportState?.pendingRequests === 0 &&
      result.transportState.unclosedResponses === 0;
    if (timedOut || !result.networkCompletionVerified)
      result.status = snapshotMode ? 'native_snapshot_failed' : 'native_metadata_failed';
    budget.close();
  }
  return result;
}

export const runExecution31130SnapshotDiagnostic = (key, dependencies = {}) =>
  runNativeExecution31130MetadataDiagnostic(key, dependencies, true);
export const runExecution31130CategoryDiagnostic = (key, dependencies = {}) =>
  runNativeExecution31130MetadataDiagnostic(key, dependencies, 'categories');
export const runExecution31130ParameterDefaultsDiagnostic = (key, dependencies = {}) =>
  runNativeExecution31130MetadataDiagnostic(key, dependencies, 'parameter_defaults');

// Fixed single-ID structural diagnosis only. No run data is traversed, no
// response-defined field names or values escape, and no native receipt is made.
export async function runExecution31130MetadataDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    technicalAttempt: 16,
    status: 'not_attempted',
    requestCount: 0,
    maximumRequests: 1,
    httpStatus: null,
    authenticationVerified: false,
    networkCompletionVerified: false,
    acceptanceProven: false,
    metadata: null,
    fields: null,
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 20000,
    closeTimeoutMs = dependencies.closeTimeoutMs ?? 5000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 20000 ||
    !Number.isInteger(closeTimeoutMs) ||
    closeTimeoutMs < 1 ||
    closeTimeoutMs > 5000
  ) {
    result.status = 'invalid_options';
    return result;
  }
  let context, budget;
  try {
    context = (dependencies.readContext ?? readExecution31130Context)();
    budget = (dependencies.openBudget ?? openExecution31130MetadataDiagnosticBudget)();
  } catch {
    result.status = 'budget_blocked';
    return result;
  }
  const controller = new AbortController();
  let timedOut = false,
    issued = false,
    resolveClosed;
  const closed = new Promise((done) => {
    resolveClosed = done;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    try {
      const answer = budget.admit();
      if (answer !== undefined) {
        if (answer?.then) Promise.resolve(answer).catch(() => {});
        throw Error();
      }
    } catch {
      reject('budget_blocked');
    }
    const diagnostic = requestDiagnostic('executions', 1);
    result.diagnostics.requests.push(diagnostic);
    result.requestCount = 1;
    issued = true;
    const transport = dependencies.request
      ? (input) => nativeRequest(input, dependencies.request)
      : (dependencies.transport ?? nativeRequest);
    const response = await transport({
      url: new URL(`https://${host}/api/v1/executions/31130?includeData=false`),
      method: 'GET',
      headers: {
        'x-n8n-api-key': key,
        accept: 'application/json',
        'user-agent': 'everyone-market-radar-m03-execution-31130-metadata/1',
      },
      address: addresses[0],
      signal: controller.signal,
      maxBytes: 65536,
      rejectUnauthorized: true,
      servername: host,
      diagnostic,
      onSocketClosed() {
        diagnostic.socketClosed = true;
        resolveClosed();
      },
    });
    if (controller.signal.aborted) reject('timeout');
    if (
      !record(response) ||
      !Number.isInteger(response.status) ||
      response.status < 100 ||
      response.status > 599
    )
      reject();
    result.httpStatus = diagnostic.httpStatus = response.status;
    if (response.status !== 200) {
      const code =
        response.status === 401
          ? 'unauthorized'
          : response.status >= 300 && response.status < 400
            ? 'redirect_refused'
            : 'http_failed';
      diagnosticFailure(diagnostic, 'status', code);
      reject(code);
    }
    result.authenticationVerified = true;
    if (!(response.body instanceof Uint8Array) || response.body.byteLength > 65536) {
      diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
      reject('body_too_large');
    }
    diagnostic.bodyRead = 'complete';
    let dto;
    try {
      dto = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
      diagnostic.jsonParsed = true;
    } catch {
      diagnosticFailure(diagnostic, 'parse', 'invalid_json');
      reject();
    }
    const shape = record(dto),
      own = (k) => shape && Object.hasOwn(dto, k),
      value = (k) => (shape ? dto[k] : undefined),
      date = (v) =>
        typeof v === 'string' &&
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
        Number.isFinite(Date.parse(v)),
      id = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v),
      modes = ['manual', 'integrated', 'error', 'webhook', 'trigger'],
      statuses = ['new', 'running', 'waiting', 'unknown', 'success', 'error', 'canceled', 'crashed'],
      terminal = ['success', 'error', 'canceled', 'crashed'].includes(value('status')),
      now = (dependencies.now ?? Date.now)(),
      f = {
        objectShape: shape,
        idPresent: own('id'),
        idString: typeof value('id') === 'string',
        idMatches: value('id') === '31130',
        workflowIdPresent: own('workflowId'),
        workflowIdString: typeof value('workflowId') === 'string',
        workflowIdMatches: value('workflowId') === 'MzimjpsuyPuK7SKe',
        modePresent: own('mode'),
        modeKnown: modes.includes(value('mode')),
        modeManual: value('mode') === 'manual',
        statusPresent: own('status'),
        statusKnown: statuses.includes(value('status')),
        versionPresent: own('workflowVersionId'),
        versionNull: value('workflowVersionId') === null,
        versionIdentifier: id(value('workflowVersionId')),
        versionMatchesBinding: value('workflowVersionId') === context.versionId,
        createdAtPresent: own('createdAt'),
        createdAtString: typeof value('createdAt') === 'string',
        createdAtCanonical: date(value('createdAt')),
        createdAtWithinIntent:
          date(value('createdAt')) && Date.parse(value('createdAt')) >= context.intentAt - 30000,
        timestampsNotFuture: ['createdAt', 'startedAt', 'stoppedAt'].every(
          (k) => value(k) === null || (date(value(k)) && Date.parse(value(k)) <= now + 30000),
        ),
        startedAtPresent: own('startedAt'),
        startedAtNull: value('startedAt') === null,
        startedAtCanonical: date(value('startedAt')),
        stoppedAtPresent: own('stoppedAt'),
        stoppedAtNull: value('stoppedAt') === null,
        stoppedAtCanonical: date(value('stoppedAt')),
        waitTillPresent: own('waitTill'),
        waitTillNull: value('waitTill') === null,
        waitTillCanonical: date(value('waitTill')),
        terminalTimestampsOrdered:
          !terminal ||
          (date(value('startedAt')) &&
            date(value('stoppedAt')) &&
            Date.parse(value('stoppedAt')) >= Date.parse(value('startedAt'))),
        terminalWaitNull: !terminal || value('waitTill') === null,
        payloadAbsent: !['data', 'workflowData', 'customData'].some(own),
        sizeFlagPresent: own('dataTooLargeToDisplay'),
        sizeFlagBoolean: typeof value('dataTooLargeToDisplay') === 'boolean',
        sizeFlagSafe: !own('dataTooLargeToDisplay') || value('dataTooLargeToDisplay') === false,
        finishedPresent: own('finished'),
        finishedBoolean: typeof value('finished') === 'boolean',
      };
    f.readerMetadataContractSatisfied =
      shape &&
      f.idMatches &&
      f.workflowIdMatches &&
      f.modeManual &&
      f.statusKnown &&
      f.versionIdentifier &&
      f.versionMatchesBinding &&
      f.createdAtCanonical &&
      f.createdAtWithinIntent &&
      f.timestampsNotFuture &&
      f.startedAtPresent &&
      (f.startedAtNull || f.startedAtCanonical) &&
      f.stoppedAtPresent &&
      (f.stoppedAtNull || f.stoppedAtCanonical) &&
      f.waitTillPresent &&
      (f.waitTillNull || f.waitTillCanonical) &&
      f.terminalTimestampsOrdered &&
      f.terminalWaitNull &&
      f.sizeFlagSafe &&
      f.payloadAbsent;
    result.fields = f;
    result.metadata = {
      executionId: f.idMatches ? '31130' : null,
      workflowId: f.workflowIdMatches ? 'MzimjpsuyPuK7SKe' : null,
      mode: f.modeKnown ? value('mode') : null,
      status: f.statusKnown ? value('status') : null,
    };
    dto = null;
    diagnostic.schemaValidated = true;
    result.status = 'execution_metadata_classified';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.failureStage === 'none')
      diagnosticFailure(
        last,
        last.jsonParsed ? 'schema' : 'unknown',
        timedOut ? 'timeout' : last.jsonParsed ? 'invalid_schema' : 'network_failed',
      );
    result.status = timedOut
      ? 'timeout'
      : [
            'budget_blocked',
            'unsafe_dns',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
          ].includes(error?.code)
        ? error.code
        : 'response_rejected';
    result.fields = null;
    result.metadata = null;
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
    if (issued && !result.diagnostics.requests[0].socketClosed) {
      let closing;
      await Promise.race([
        closed,
        new Promise((done) => {
          closing = setTimeout(done, closeTimeoutMs);
        }),
      ]);
      clearTimeout(closing);
    }
    result.networkCompletionVerified =
      issued &&
      result.diagnostics.requests[0].socketClosed &&
      result.diagnostics.requests[0].tlsVerified === true;
    if (issued && !result.networkCompletionVerified) {
      result.status = 'network_failed';
      result.fields = null;
      result.metadata = null;
    }
    budget.close();
  }
  return result;
}

// One-use reconciliation only: no execution adoption, mutation or acceptance authority.
export async function runWf00ExecutionDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    workflowKey: 'WF-00',
    status: 'not_attempted',
    requestCount: 0,
    maximumRequests: 3,
    authenticationVerified: false,
    networkCompletionVerified: false,
    runningEmpty: null,
    runningPaginationComplete: false,
    latest: [],
    latestPaginationComplete: false,
    unadmittedExecutionIdEstablished: false,
    allActiveExecutionsAbsentProven: false,
    savedWorkflowVerified: false,
    manualRetentionDisabled: false,
    baseline: null,
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 60000,
    closeTimeoutMs = dependencies.closeTimeoutMs ?? 5000;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 60000 ||
    !Number.isInteger(closeTimeoutMs) ||
    closeTimeoutMs < 1 ||
    closeTimeoutMs > 5000
  ) {
    result.status = 'invalid_options';
    return result;
  }
  let budget;
  try {
    budget = (dependencies.openBudget ?? openWf00ExecutionDiagnosticBudget)();
  } catch {
    result.status = 'budget_blocked';
    return result;
  }
  const controller = new AbortController(),
    sockets = [];
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const transport = dependencies.request
    ? (input) => nativeRequest(input, dependencies.request)
    : (dependencies.transport ?? nativeRequest);
  const charge = () => {
    if (controller.signal.aborted || result.requestCount >= 3) reject('timeout');
    const written = budget.admit();
    if (written !== undefined) {
      if (written?.then) Promise.resolve(written).catch(() => {});
      reject('budget_blocked');
    }
  };
  const date = (v) =>
    typeof v === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
    Number.isFinite(Date.parse(v));
  const operation = async () => {
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    result.diagnostics.dns = 'complete';
    for (const running of [true, false]) {
      charge();
      const diagnostic = requestDiagnostic('executions', running ? 1 : 2);
      result.diagnostics.requests.push(diagnostic);
      result.requestCount++;
      let resolveClosed;
      const closed = new Promise((done) => {
        resolveClosed = done;
      });
      sockets.push({ closed, diagnostic });
      const response = await transport({
        url: new URL(
          `https://${host}/api/v1/executions?workflowId=MzimjpsuyPuK7SKe&includeData=false&limit=2${running ? '&status=running' : ''}`,
        ),
        method: 'GET',
        headers: {
          'x-n8n-api-key': key,
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-wf00-read-only/1',
        },
        address: addresses[0],
        signal: controller.signal,
        maxBytes: 65536,
        rejectUnauthorized: true,
        servername: host,
        diagnostic,
        onSocketClosed() {
          diagnostic.socketClosed = true;
          resolveClosed();
        },
      });
      if (controller.signal.aborted) reject('timeout');
      if (
        !record(response) ||
        !Number.isInteger(response.status) ||
        response.status < 100 ||
        response.status > 599
      )
        reject();
      diagnostic.httpStatus = response.status;
      if (response.status !== 200) {
        const code =
          response.status === 401
            ? 'unauthorized'
            : response.status >= 300 && response.status < 400
              ? 'redirect_refused'
              : 'http_failed';
        diagnosticFailure(diagnostic, 'status', code);
        reject(code);
      }
      if (!(response.body instanceof Uint8Array) || response.body.byteLength > 65536) {
        diagnosticFailure(diagnostic, 'body_read', 'body_too_large');
        reject('body_too_large');
      }
      diagnostic.bodyRead = 'complete';
      let dto;
      try {
        dto = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
        diagnostic.jsonParsed = true;
      } catch {
        diagnosticFailure(diagnostic, 'parse', 'invalid_json');
        reject();
      }
      if (
        !record(dto) ||
        !Array.isArray(dto.data) ||
        dto.data.length > 2 ||
        !(
          dto.nextCursor === null ||
          (typeof dto.nextCursor === 'string' &&
            dto.nextCursor.length > 0 &&
            dto.nextCursor.length <= 2048 &&
            !/[\r\n\x00]/.test(dto.nextCursor))
        )
      )
        reject();
      const seen = new Set(),
        rows = dto.data.map((row) => {
          if (
            !record(row) ||
            Object.hasOwn(row, 'data') ||
            Object.hasOwn(row, 'workflowData') ||
            typeof row.id !== 'string' ||
            !/^[1-9]\d{0,31}$/.test(row.id) ||
            seen.has(row.id) ||
            row.workflowId !== 'MzimjpsuyPuK7SKe' ||
            !['manual', 'integrated', 'error', 'webhook', 'trigger'].includes(row.mode) ||
            !['new', 'running', 'waiting', 'unknown', 'success', 'error', 'canceled', 'crashed'].includes(
              row.status,
            ) ||
            (running && row.status !== 'running') ||
            !Object.hasOwn(row, 'startedAt') ||
            !Object.hasOwn(row, 'stoppedAt') ||
            [row.startedAt, row.stoppedAt].some((v) => v !== null && !date(v)) ||
            (row.startedAt !== null &&
              row.stoppedAt !== null &&
              Date.parse(row.stoppedAt) < Date.parse(row.startedAt))
          )
            reject();
          seen.add(row.id);
          return {
            executionId: row.id,
            mode: row.mode,
            status: row.status,
            startedAt: row.startedAt,
            stoppedAt: row.stoppedAt,
            withinObservedInterval:
              row.startedAt !== null &&
              Date.parse(row.startedAt) >= Date.parse('2026-10-24T15:41:07.249Z') &&
              Date.parse(row.startedAt) <= Date.parse('2026-10-24T15:41:09.628Z'),
          };
        });
      if (running) {
        result.runningPaginationComplete = dto.nextCursor === null;
        result.runningEmpty = rows.length === 0 && result.runningPaginationComplete;
      } else {
        result.latest = rows;
        result.latestPaginationComplete = dto.nextCursor === null;
      }
      dto = null;
      diagnostic.schemaValidated = true;
      if (!diagnostic.socketClosed) {
        let closing;
        await Promise.race([
          closed,
          new Promise((done) => {
            closing = setTimeout(done, closeTimeoutMs);
          }),
        ]);
        clearTimeout(closing);
        if (!diagnostic.socketClosed) reject('network_failed');
      }
      if (diagnostic.tlsVerified !== true) reject('network_failed');
    }
    const baseline = await runWorkflowBaselineDiagnostic(key, {
      timeoutMs: Math.min(timeoutMs, 20000),
      lookup: async () => addresses,
      transport: async (input) => {
        if (
          input.method !== 'GET' ||
          input.url.href !== `https://${host}/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true`
        )
          reject();
        charge();
        result.requestCount++;
        result.diagnostics.requests.push(input.diagnostic);
        let resolveClosed;
        const closed = new Promise((done) => {
          resolveClosed = done;
        });
        sockets.push({ closed, diagnostic: input.diagnostic });
        return transport({
          ...input,
          maxBytes: 524288,
          signal: AbortSignal.any([input.signal, controller.signal]),
          onSocketClosed() {
            input.diagnostic.socketClosed = true;
            input.onSocketClosed();
            resolveClosed();
          },
        });
      },
    });
    const checks = baseline.baseline?.failedChecks ?? [];
    result.baseline =
      baseline.baseline === null
        ? null
        : {
            versionMatches: !checks.some((c) => ['version_shape', 'version_mismatch'].includes(c)),
            definitionMatches:
              baseline.baseline.components.nameEqual &&
              baseline.baseline.components.nodesEqual &&
              baseline.baseline.components.connectionsEqual,
            settingsMatch: baseline.baseline.components.settingsEqual,
            ownershipMatches: baseline.projectVerified,
            inactive: !checks.some((c) => ['activation_state', 'active_version'].includes(c)),
          };
    result.savedWorkflowVerified =
      baseline.status === 'matching_baseline' && baseline.projectVerified === true;
    const canonical = JSON.parse(
      readFileSync(new URL('../../n8n/workflows/WF-00.json', import.meta.url), 'utf8'),
    );
    result.manualRetentionDisabled =
      result.baseline?.settingsMatch === true && canonical.workflow.settings.saveManualExecutions === false;
    if (
      !['matching_baseline', 'baseline_mismatch'].includes(baseline.status) ||
      baseline.diagnostics.requests.length !== 1 ||
      baseline.diagnostics.requests[0].tlsVerified !== true ||
      baseline.diagnostics.requests[0].socketClosed !== true
    )
      reject('network_failed');
    result.authenticationVerified = result.diagnostics.requests.every(
      (d) => d.httpStatus === 200 && d.tlsVerified === true,
    );
    result.status = 'execution_metadata_observed';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    if (result.diagnostics.dns === 'resolving') result.diagnostics.dns = timedOut ? 'timeout' : 'failed';
    const last = result.diagnostics.requests.at(-1);
    if (last?.failureStage === 'none')
      diagnosticFailure(
        last,
        last.jsonParsed ? 'schema' : 'unknown',
        timedOut ? 'timeout' : last.jsonParsed ? 'invalid_schema' : 'network_failed',
      );
    result.status = timedOut
      ? 'timeout'
      : [
            'budget_blocked',
            'unsafe_dns',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
          ].includes(error?.code)
        ? error.code
        : 'response_rejected';
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
    let closing;
    await Promise.race([
      Promise.all(sockets.map((v) => v.closed)),
      new Promise((done) => {
        closing = setTimeout(done, closeTimeoutMs);
      }),
    ]);
    clearTimeout(closing);
    result.networkCompletionVerified =
      sockets.every((v) => v.diagnostic.socketClosed) &&
      result.diagnostics.requests.every((d) => d.socketClosed);
    if (!result.networkCompletionVerified) result.status = 'network_failed';
    budget.close();
  }
  return result;
}

// Fixed metadata-only diagnostic: the bounded inventory GET transport supplies
// bytes and actual socket closure to the SAME strict native discovery reader.
// This explicitly is an adapter, not identical native-wire transport evidence.
export async function runWf70DiscoveryDiagnostic(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    workflowKey: 'WF-70',
    status: 'discovery_failed',
    transportAdapter: 'inventory_bounded_get_adapter',
    requestCount: 0,
    maximumRequests: 4,
    authenticationVerified: false,
    paginationComplete: false,
    candidateCount: null,
    adoptionProven: false,
    drainProven: false,
    readerFailure: null,
    networkCompletionVerified: false,
    diagnostics: { version: 1, dns: 'not_attempted', requests: [] },
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length < 8 || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  const timeoutMs = dependencies.timeoutMs ?? 60000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    result.status = 'invalid_options';
    return result;
  }
  let reader, ownedBudget;
  const controller = new AbortController(),
    sockets = [],
    requests = new Set(),
    deadlineAt = Date.now() + timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { createFoundationNativeReader } = await import('./foundation-native-reader.mjs');
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url), 'utf8'),
    );
    const admit = dependencies.admitControlAttempt ?? (ownedBudget = openWf70DiscoveryBudget()).admit;
    result.diagnostics.dns = 'resolving';
    const addresses = validatedAddresses(
      await Promise.race([
        (dependencies.lookup ?? resolveInstance)(controller.signal),
        new Promise((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(new InventoryError('timeout')), {
            once: true,
          }),
        ),
      ]),
    );
    if (controller.signal.aborted) throw new InventoryError('timeout');
    result.diagnostics.dns = 'complete';
    reader = createFoundationNativeReader({
      bindings,
      deadlineAt,
      sensitiveValues: [key],
      admitControlAttempt(value) {
        if (controller.signal.aborted || Date.now() >= deadlineAt || result.requestCount >= 4)
          throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
        result.requestCount++;
        const written = admit(value);
        if (written !== undefined) {
          if (written?.then) Promise.resolve(written).catch(() => {});
          throw Error('WF70_DIAGNOSTIC_BUDGET_BLOCKED');
        }
      },
      transport: {
        async request({ method, path, signal }) {
          if (
            method !== 'GET' ||
            !/^\/api\/v1\/executions\?workflowId=S6KDFsx5IjQRf6tm&includeData=false&limit=120(?:&status=running)?(?:&cursor=[^\s#]+)?$/.test(
              path,
            )
          )
            throw Error('WF70_DIAGNOSTIC_ROUTE_BLOCKED');
          const diagnostic = requestDiagnostic('executions', path.includes('&cursor=') ? 2 : 1);
          result.diagnostics.requests.push(diagnostic);
          let done;
          const closure = {
            closed: false,
            promise: new Promise((resolveClosed) => {
              done = resolveClosed;
            }),
          };
          sockets.push(closure);
          const input = {
            url: new URL('https://' + host + path),
            method: 'GET',
            headers: {
              'x-n8n-api-key': key,
              accept: 'application/json',
              'user-agent': 'everyone-market-radar-m03-wf70-read-only/1',
            },
            address: addresses[0],
            signal: AbortSignal.any([signal, controller.signal]),
            maxBytes,
            rejectUnauthorized: true,
            servername: host,
            diagnostic,
            onSocketClosed() {
              diagnostic.socketClosed = true;
              closure.closed = true;
              done();
            },
          };
          const response = await (
            dependencies.transport ??
            ((input) =>
              nativeRequest(input, (...args) => {
                const req = (dependencies.request ?? request)(...args);
                requests.add(req);
                return req;
              }))
          )(input);
          if (
            !record(response) ||
            !Number.isInteger(response.status) ||
            response.status < 100 ||
            response.status > 599 ||
            !(response.body instanceof Uint8Array) ||
            response.body.byteLength > maxBytes
          )
            throw Error('WF70_DIAGNOSTIC_RESPONSE_BLOCKED');
          diagnostic.httpStatus = response.status;
          diagnostic.bodyRead = 'complete';
          if (response.status === 200) result.authenticationVerified = true;
          const bytes = response.body;
          return {
            status: response.status,
            headers: {},
            body: (async function* () {
              yield bytes;
            })(),
            closed: closure.promise,
            abort() {
              for (const req of requests) {
                try {
                  req.destroy();
                } catch {}
              }
            },
          };
        },
      },
    });
    const candidates = await reader.discover({ workflowKey: 'WF-70', baselineIds: [] });
    result.paginationComplete = candidates.paginationComplete === true;
    result.candidateCount = candidates.candidates.length;
    result.status = 'discovery_complete';
    for (const diagnostic of result.diagnostics.requests) {
      diagnostic.jsonParsed = true;
      diagnostic.schemaValidated = true;
    }
  } catch {
    result.readerFailure = reader?.lastFailure() ?? null;
    if (result.diagnostics.dns === 'resolving')
      result.diagnostics.dns = controller.signal.aborted ? 'timeout' : 'failed';
    const diagnostic = result.diagnostics.requests.at(-1);
    if (diagnostic && diagnostic.failureStage === 'none') {
      const failure = result.readerFailure;
      if (failure?.httpStatus !== null && failure?.httpStatus !== undefined)
        diagnostic.httpStatus = failure.httpStatus;
      if (['projection', 'http_status'].includes(failure?.stage)) {
        diagnostic.jsonParsed = true;
        diagnosticFailure(
          diagnostic,
          failure.stage === 'http_status' ? 'status' : 'schema',
          failure.stage === 'http_status' ? 'http_failed' : 'invalid_schema',
        );
      } else
        diagnosticFailure(
          diagnostic,
          failure?.stage === 'parse' ? 'parse' : 'unknown',
          failure?.stage === 'parse'
            ? 'invalid_json'
            : controller.signal.aborted
              ? 'timeout'
              : 'network_failed',
        );
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
    for (const req of requests) {
      try {
        req.destroy();
      } catch {}
    }
    let closeTimer;
    await Promise.race([
      Promise.allSettled(sockets.map((s) => s.promise)),
      new Promise((done) => {
        closeTimer = setTimeout(done, 1000);
      }),
    ]);
    clearTimeout(closeTimer);
    result.networkCompletionVerified =
      sockets.every((s) => s.closed) &&
      (reader?.state().pendingRequests ?? 0) === 0 &&
      (reader?.state().unclosedResponses ?? 0) === 0;
    if (!result.networkCompletionVerified) result.status = 'discovery_failed';
    ownedBudget?.close();
    key = null;
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const key = [
    '--runtime-reconciliation-check-only',
    '--wf00-execution-check-only',
    '--execution-31130-metadata-check-only',
    '--execution-31130-native-metadata-check-only',
    '--execution-31130-snapshot-check-only',
    '--execution-31130-category-check-only',
    '--execution-31130-parameter-defaults-check-only',
  ].includes(process.argv[2])
    ? undefined
    : process.env.M03_N8N_API_KEY;
  delete process.env.M03_N8N_API_KEY;
  if (!(
    process.argv.length === 2 ||
    (process.argv.length === 3 &&
      [
        '--workflow-baseline-diagnostic',
        '--wf32-discovery-check-only',
        '--wf32-discovery-diagnostic',
        '--wf70-discovery-diagnostic',
        '--machine-metadata-diagnostic',
        '--runtime-reconciliation-check-only',
        '--runtime-reconciliation-diagnostic',
        '--wf00-execution-check-only',
        '--wf00-execution-diagnostic',
        '--execution-31130-metadata-check-only',
        '--execution-31130-native-metadata-check-only',
        '--execution-31130-snapshot-check-only',
        '--execution-31130-category-check-only',
        '--execution-31130-parameter-defaults-check-only',
        '--execution-31130-metadata-diagnostic',
        '--execution-31130-native-metadata-diagnostic',
        '--execution-31130-snapshot-diagnostic',
        '--execution-31130-category-diagnostic',
        '--execution-31130-parameter-defaults-diagnostic',
      ].includes(process.argv[2]))
  )) {
    process.stdout.write(JSON.stringify({ version: 1, status: 'argument_rejected' }) + '\n');
    process.exitCode = 1;
  } else if (['--wf32-discovery-check-only', '--wf32-discovery-diagnostic'].includes(process.argv[2])) {
    const check = process.argv[2].endsWith('-check-only');
    setImmediate(() =>
      Promise.resolve()
        .then(() => (check ? checkWf32DiscoveryDiagnostic() : runWf32DiscoveryDiagnostic(key)))
        .then(
          (value) => {
            process.stdout.write(JSON.stringify(value) + '\n');
            process.exitCode = value.status === (check ? 'ready' : 'discovery_page_classified') ? 0 : 1;
          },
          () => {
            process.stdout.write(
              JSON.stringify(
                check
                  ? {
                      kind: 'm03_wf32_discovery_check',
                      status: 'blocked',
                      privateRead: false,
                      networkRequests: 0,
                    }
                  : { version: 1, status: 'diagnostic_failed' },
              ) + '\n',
            );
            process.exitCode = 1;
          },
        ),
    );
  } else if (
    [
      '--execution-31130-native-metadata-check-only',
      '--execution-31130-native-metadata-diagnostic',
      '--execution-31130-snapshot-check-only',
      '--execution-31130-snapshot-diagnostic',
      '--execution-31130-category-check-only',
      '--execution-31130-parameter-defaults-check-only',
      '--execution-31130-category-diagnostic',
      '--execution-31130-parameter-defaults-diagnostic',
    ].includes(process.argv[2])
  ) {
    const parameterDefaults = process.argv[2].startsWith('--execution-31130-parameter-defaults-'),
      category = process.argv[2].startsWith('--execution-31130-category-'),
      snapshot = parameterDefaults
        ? 'parameter_defaults'
        : category
          ? 'categories'
          : process.argv[2].startsWith('--execution-31130-snapshot-'),
      check = process.argv[2].endsWith('-check-only');
    // Native modules import this inventory module. Defer their dynamic imports
    // until this entry module has finished evaluating.
    setImmediate(() =>
      Promise.resolve()
        .then(() =>
          check
            ? checkExecution31130MetadataDiagnostic(
                undefined,
                parameterDefaults
                  ? 'parameter_defaults'
                  : category
                    ? 'categories'
                    : snapshot
                      ? 'snapshot'
                      : true,
              )
            : runNativeExecution31130MetadataDiagnostic(key, {}, snapshot),
        )
        .then(
          (value) => {
            process.stdout.write(JSON.stringify(value) + '\n');
            process.exitCode =
              value.status ===
              (check ? 'ready' : snapshot ? 'native_snapshot_classified' : 'native_metadata_verified')
                ? 0
                : 1;
          },
          () => {
            process.stdout.write(
              JSON.stringify(
                check
                  ? {
                      kind: 'm03_execution_31130_native_metadata_check',
                      status: 'blocked',
                      privateRead: false,
                      networkRequests: 0,
                    }
                  : { version: 1, status: 'diagnostic_failed' },
              ) + '\n',
            );
            process.exitCode = 1;
          },
        ),
    );
  } else if (
    ['--execution-31130-metadata-check-only', '--execution-31130-metadata-diagnostic'].includes(
      process.argv[2],
    )
  ) {
    const check = process.argv[2] === '--execution-31130-metadata-check-only';
    try {
      const value = check
        ? checkExecution31130MetadataDiagnostic()
        : await runExecution31130MetadataDiagnostic(key);
      process.stdout.write(JSON.stringify(value) + '\n');
      process.exitCode = value.status === (check ? 'ready' : 'execution_metadata_classified') ? 0 : 1;
    } catch {
      process.stdout.write(
        JSON.stringify(
          check
            ? {
                kind: 'm03_execution_31130_metadata_check',
                status: 'blocked',
                privateRead: false,
                networkRequests: 0,
              }
            : { version: 1, status: 'diagnostic_failed' },
        ) + '\n',
      );
      process.exitCode = 1;
    }
  } else if (['--wf00-execution-check-only', '--wf00-execution-diagnostic'].includes(process.argv[2])) {
    const check = process.argv[2] === '--wf00-execution-check-only';
    try {
      const value = check ? checkWf00ExecutionDiagnostic() : await runWf00ExecutionDiagnostic(key);
      process.stdout.write(JSON.stringify(value) + '\n');
      process.exitCode = value.status === (check ? 'ready' : 'execution_metadata_observed') ? 0 : 1;
    } catch {
      process.stdout.write(
        JSON.stringify(
          check
            ? {
                kind: 'm03_wf00_execution_check',
                status: 'blocked',
                privateRead: false,
                networkRequests: 0,
              }
            : { version: 1, status: 'diagnostic_failed' },
        ) + '\n',
      );
      process.exitCode = 1;
    }
  } else if (
    ['--runtime-reconciliation-check-only', '--runtime-reconciliation-diagnostic'].includes(process.argv[2])
  ) {
    setImmediate(() => {
      const check = process.argv[2] === '--runtime-reconciliation-check-only';
      (check ? checkRuntimeReconciliationDiagnostic() : runRuntimeReconciliationDiagnostic(key)).then(
        (result) => {
          process.stdout.write(JSON.stringify(result) + '\n');
          process.exitCode = (check ? result.status === 'ready' : result.status === 'readback_observed')
            ? 0
            : 1;
        },
        () => {
          process.stdout.write(
            JSON.stringify(
              check
                ? {
                    kind: 'm03_runtime_reconciliation_check',
                    status: 'blocked',
                    privateRead: false,
                    networkRequests: 0,
                  }
                : { version: 1, status: 'diagnostic_failed' },
            ) + '\n',
          );
          process.exitCode = 1;
        },
      );
    });
  } else if (process.argv[2] === '--machine-metadata-diagnostic') {
    const result = await runMachineMetadataDiagnostic(key);
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.status === 'metadata_observed' ? 0 : 1;
  } else if (process.argv[2] === '--wf70-discovery-diagnostic') {
    // The reader's runtime-control dependency imports resolveInstance above.
    // Schedule only this new mode after module evaluation, avoiding a circular
    // top-level-await wait without changing the existing inventory entry paths.
    setImmediate(() =>
      runWf70DiscoveryDiagnostic(key).then(
        (result) => {
          process.stdout.write(JSON.stringify(result) + '\n');
          process.exitCode = result.status === 'discovery_complete' ? 0 : 1;
        },
        () => {
          process.stdout.write(JSON.stringify({ version: 1, status: 'diagnostic_failed' }) + '\n');
          process.exitCode = 1;
        },
      ),
    );
  } else {
    const result =
      process.argv.length === 3 ? await runWorkflowBaselineDiagnostic(key) : await runInventory(key);
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = ['complete', 'partial', 'matching_baseline', 'baseline_mismatch'].includes(
      result.status,
    )
      ? 0
      : 1;
  }
}
