// Complete isolated synthetic authority fixture. Never imports or reads actual journals.
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  realpathSync,
  existsSync,
} from 'node:fs';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const digest = (text) => createHash('sha256').update(text).digest('hex');
export async function syntheticProjectVerifiedContinuation({
  approved = true,
  cleanupFault,
  priorFault,
  projectFault,
  historicalSetupEvents,
  technical17PreReady = false,
  technical17PreReadyFault,
  technical16Settled = technical17PreReady,
  technical16MixedControl = technical17PreReady,
  technical16CleanupRequests = 85,
  technical16CleanupRetry = null,
  technical16Fault,
  unadmittedWf00Reconciled = technical16Settled,
  unadmittedWf00Fault,
  restoredBrowserRetryDiscovery = unadmittedWf00Reconciled,
  restoredBrowserRetryDiscoveryFault,
  restoredBrowserDiscovery = restoredBrowserRetryDiscovery,
  restoredBrowserDiscoveryFault,
  runtimeRestorationClosed = restoredBrowserDiscovery,
  runtimeRestorationFault,
  runtimeRestorationAllocation = restoredBrowserDiscovery,
  runtimeRestorationAllocationFault,
  runtimePreparationClosed = runtimeRestorationClosed,
  runtimePreparationFault,
  runtimeMetadataAllocation = runtimeRestorationClosed,
  runtimeMetadataAllocationFault,
  runtimeSourceUnverified = false,
  adminAdmissionReadonly = runtimePreparationClosed,
  adminAdmissionReadonlyFault,
  catalogReadonly = adminAdmissionReadonly,
  catalogReadonlyFault,
  catalogManagementAllocation = adminAdmissionReadonly,
  catalogManagementAllocationFault,
  preprivateAdmin = catalogReadonly,
  preprivateAdminFault,
  closedFixture = preprivateAdmin,
  closedFixtureFault,
  controlManagementAllocation = closedFixture,
  controlManagementAllocationFault,
  closedPreparation = closedFixture,
  closedPreparationFault,
  managementAllocation = closedPreparation,
  managementAllocationFault,
  wf70Readback = managementAllocation,
  wf70ReadbackFault,
  baselineDiscovery = wf70Readback,
  baselineDiscoveryFault,
  nativeBrowserDiscovery = baselineDiscovery,
  nativeBrowserDiscoveryFault,
  nativeDiscovery = nativeBrowserDiscovery,
  nativeDiscoveryFault,
  readonlyPrepare = nativeDiscovery,
  readonlyPrepareFault,
  closedWindow = readonlyPrepare,
  closedFault,
  restoreFault,
  allocationFault,
  proposedBudgetApproved = readonlyPrepare,
  effectful = closedWindow,
  effectFault,
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-project-verified-synthetic-'));
  const ownedDirectory = realpathSync(directory);
  const ownedTempRoot = realpathSync(tmpdir());
  const put = (path, text) => {
    const p = join(directory, path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
    return p;
  };
  const snapshot = JSON.parse(
    readFileSync(
      join(
        sourceRoot,
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-checkpoint-20261022.json',
      ),
      'utf8',
    ),
  );
  const cleanedLeaves = [
    'emr-m03-acceptance-management.dpapi',
    'emr-m03-acceptance-management.lease.json',
    'emr-m03-acceptance-writer.dpapi',
    'emr-m03-acceptance-writer.lease.json',
    'emr-m03-acceptance-apifyread.dpapi',
    'emr-m03-acceptance-apifyread.lease.json',
    'emr-m03-acceptance-protection-bypass.dpapi',
    'emr-m03-acceptance-parent.operation.lock',
    'runtime.operation.lock',
  ];
  for (const path of Object.keys(snapshot.preserved)) {
    let record = { syntheticPublicRecord: path };
    if (
      path.endsWith('dev-acceptance-project-preflight-actual-20261022.json') ||
      path.endsWith('dev-acceptance-startup-replacement-attempt-20261022.json')
    ) {
      record = JSON.parse(readFileSync(join(sourceRoot, path), 'utf8'));
      if (path.endsWith('dev-acceptance-startup-replacement-attempt-20261022.json')) {
        if (priorFault === 'archive') record.coordinatorClose.fixtureArchived = false;
        if (priorFault === 'wrapper') record.wrapperClose.credentialChildrenClosed = false;
      }
    }
    if (path.endsWith('dev-acceptance-postcheck-attempt-20261021.json'))
      record = { clock: { parentProcessId: 123456, runtimeProcessId: 123457 } };
    if (path.endsWith('remaining-closed-cleanup-e8035391-dba8-48c9-97e0-139ba980d86e.intent.json'))
      record = {
        kind: 'm03_remaining_exact_temporary_cleanup_intent',
        version: 1,
        segmentId: 'e8035391-dba8-48c9-97e0-139ba980d86e',
        createdAtUtc: '2026-10-21T23:26:01.000Z',
        targets: cleanedLeaves,
        projectedProcessSnapshot: [],
        privateContentsRead: false,
        networkRequests: 0,
        childProcessesStarted: 0,
        unknownOrphanClosureProven: false,
      };
    if (path.endsWith('remaining-closed-cleanup-e8035391-dba8-48c9-97e0-139ba980d86e.result.json'))
      record = {
        kind: 'm03_remaining_exact_temporary_cleanup_result',
        version: 1,
        segmentId: 'e8035391-dba8-48c9-97e0-139ba980d86e',
        status: 'exact_nine_leaves_removed',
        deleted: cleanedLeaves,
        observedAtUtc: '2026-10-21T23:26:05.000Z',
        privateContentsRead: false,
        networkRequests: 0,
        childProcessesStarted: 0,
        adminPairPreserved: true,
        machineAndAdmissionsPreserved: true,
        unknownOrphanClosureProven: false,
        fullD: false,
      };
    if (path.endsWith('remaining-closed-cleanup-e8035391-dba8-48c9-97e0-139ba980d86e.result.json')) {
      if (cleanupFault === 'overclaimed-orphans') record.unknownOrphanClosureProven = true;
      if (cleanupFault === 'incomplete-leaves') record.deleted = cleanedLeaves.slice(1);
      if (cleanupFault === 'private-read') record.privateContentsRead = true;
    }
    const text = JSON.stringify(record) + '\n';
    put(path, text);
    snapshot.preserved[path] = digest(text);
  }
  const projectPin = snapshot.positiveProjectRead;
  const projectRecord = JSON.parse(readFileSync(join(directory, projectPin.path), 'utf8'));
  const projectRows = [
    { event: 'project_preflight_once_intent', oneUseConsumed: true, getAttemptDebited: false },
    { event: 'project_preflight_metadata_result', childClosed: true, covers75Minutes: true },
    {
      event: 'project_get_intent',
      getAttemptDebited: true,
      managementAttempts: 6,
      controlAttempts: 201,
      combinedAttempts: 207,
    },
    { event: 'project_preflight_result', status: 'project_contract_ready', childTransportsClosed: true },
  ];
  if (projectFault === 'extra-get') projectRows.push(projectRows[2]);
  if (projectFault === 'predicate') projectRecord.actual.predicates.projectId = false;
  const projectLedger = projectRows.map((r) => JSON.stringify(r) + '\n').join('');
  put(projectPin.ledgerPath, projectLedger);
  projectPin.ledgerSha256 = snapshot.preserved[projectPin.ledgerPath] = digest(projectLedger);
  projectRecord.ledger.sha256 = digest(projectLedger);
  const projectText = JSON.stringify(projectRecord) + '\n';
  put(projectPin.path, projectText);
  projectPin.sha256 = snapshot.preserved[projectPin.path] = digest(projectText);
  const header = {
    event: 'management_header',
    version: 1,
    sourceCommitSha: snapshot.applicationSource,
    deadlineAt: snapshot.originalDeadlineAt,
  };
  const management =
    JSON.stringify(header) +
    '\n' +
    JSON.stringify({ event: 'management_attempt', ordinal: 1 }) +
    '\n' +
    JSON.stringify({ event: 'management_attempt', ordinal: 2 }) +
    '\n';
  const control = Array.from({ length: 200 }, (_, i) => ({
    event: 'control_request_intent',
    ordinal: i + 1,
    kind: 'discovery',
    at: '2026-10-21T18:40:52.488Z',
  }))
    .map((r) => JSON.stringify(r) + '\n')
    .join('');
  const setup =
    JSON.stringify({ event: 'setup_attempt', ordinal: 1, kind: 'GET', at: 1792608136543 }) +
    '\n' +
    JSON.stringify({ event: 'setup_attempt', ordinal: 2, kind: 'GET', at: 1792666486587 }) +
    '\n';
  for (const [name, text] of Object.entries({ management, control, setup })) {
    put(snapshot.journals[name].path, text);
    snapshot.journals[name].sha256 = digest(text);
  }
  let recoveryConfiguration;
  if (effectful) {
    const base =
      'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74';
    const db =
      'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74';
    const receiptRelative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-persistent-attempt-20261023.json';
    const approvalRelative =
      'milestones/M03-n8n-foundation/evidence/sole-bypass-scope-approval-20261023.json';
    const packetRelative = 'milestones/M03-n8n-foundation/evidence/sole-bypass-scope-decision-20261023.md';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, receiptRelative), 'utf8'));
    if (effectFault === 'archive') receipt.database.unprovisionedFixtureArchived = false;
    if (effectFault === 'actor') receipt.accounting.actorStarts = 1;
    if (effectFault === 'children') receipt.wrapperClose.credentialChildrenClosed = false;
    if (effectFault === 'bypass') receipt.vercelSetup.ownedBypassRemovalAcknowledgedAndAbsentVerified = false;
    if (effectFault === 'sql-window') receipt.acceptance.sqlFoundationWindowProvisioned = true;
    const pins = {};
    // Self-contained synthetic journals/clock/DB metadata. Clean CI does not
    // contain ignored live output, and these are never hosted receipts.
    const json = (value) => JSON.stringify(value) + '\n';
    const rows = (values) => values.map(json).join('');
    const start = receipt.clock.startsAt;
    const synthetic = {
      [base + '.json']: json({
        kind: 'm03_project_verified_continuation_admission',
        version: 1,
        segmentId: snapshot.proposedSegmentId,
        sourceCommitSha: snapshot.applicationSource,
        windowId: snapshot.windowId,
        approvalSha256: '0'.repeat(64),
        startsAt: start,
        deadlineAt: start + 3600000,
        stopNewAt: start + 3000000,
        hardDeadlineAt: start + 4200000,
        parentProcessId: 30232,
      }),
      [base + '.runtime-claim.json']: json({
        kind: 'm03_project_verified_continuation_runtime_claim',
        version: 1,
        segmentId: snapshot.proposedSegmentId,
        admissionSha256: '0'.repeat(64),
        processId: 63592,
        parentProcessId: 30232,
        claimedAt: start + 1000,
      }),
      [base + '.closed.json']: json({
        kind: 'm03_project_verified_technical_closed',
        version: 1,
        admissionSha256: '0'.repeat(64),
        parentProcessId: 30232,
        runtimeProcessId: 63592,
        closedAt: receipt.clock.closedAt,
        childClosed: true,
        credentialChildrenClosed: true,
        emergencyShutdown: false,
        pendingMachinePreserved: true,
        nativeExit: 1,
        bypassHandoffDeleted: false,
        closureVerified: false,
      }),
      [snapshot.journals.management.path]:
        management +
        rows(Array.from({ length: 7 }, (_, i) => ({ event: 'management_attempt', ordinal: i + 3 }))),
      [snapshot.journals.control.path]:
        control +
        rows(
          Array.from({ length: 50 }, (_, i) => ({
            event: 'control_request_intent',
            ordinal: i + 201,
            kind: 'discovery',
            at: new Date(start).toISOString(),
          })),
        ),
      [snapshot.journals.setup.path]:
        setup +
        rows([
          { event: 'setup_attempt', ordinal: 3, kind: 'GET', at: start + 100 },
          { event: 'setup_attempt', ordinal: 4, kind: 'GET', at: start + 200 },
          { event: 'setup_intent', kind: 'bypass', at: start + 300 },
          { event: 'setup_attempt', ordinal: 5, kind: 'PATCH', at: start + 301 },
          { event: 'setup_ack', kind: 'bypass', at: start + 400 },
          { event: 'setup_attempt', ordinal: 6, kind: 'PATCH', at: start + 401 },
          { event: 'setup_attempt', ordinal: 7, kind: 'GET', at: start + 500 },
          { event: 'setup_cleanup_intent', kind: 'bypass', at: start + 600 },
          { event: 'setup_attempt', ordinal: 8, kind: 'PATCH', at: start + 601 },
          { event: 'setup_attempt', ordinal: 9, kind: 'GET', at: start + 700 },
          { event: 'setup_cleanup_absent', kind: 'bypass', at: start + 800 },
        ]),
      ['scripts/n8n/out/foundation/live/preflight.jsonl']: json({
        ...receipt.prepare.failureDiagnostic,
        at: new Date(start + 500).toISOString(),
      }),
    };
    for (const suffix of ['attempt', 'latest', 'reactivation-attempt', 'unprovisioned-archive-attempt'])
      synthetic[db + '-' + suffix + '.json'] = json({
        version: 1,
        runId: 'synthetic-closed-attempt',
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        kind: suffix,
        retained: true,
      });
    for (const [path, text] of Object.entries(synthetic)) {
      put(path, text);
      pins[path] = digest(text);
    }
    for (const [name, count] of [
      ['management', 3],
      ['control', 200],
      ['setup', 2],
    ]) {
      const text = readFileSync(join(directory, snapshot.journals[name].path), 'utf8');
      snapshot.journals[name].sha256 = digest(text.trimEnd().split('\n').slice(0, count).join('\n') + '\n');
    }
    const approvalText = readFileSync(join(sourceRoot, approvalRelative), 'utf8');
    const packetText = readFileSync(join(sourceRoot, packetRelative), 'utf8');
    const receiptText = JSON.stringify(receipt) + '\n';
    put(receiptRelative, receiptText);
    put(approvalRelative, approvalText);
    put(packetRelative, packetText);
    recoveryConfiguration = {
      approvalRelative,
      approvalSha256: digest(approvalText),
      packetRelative,
      packetSha256: digest(packetText),
      receiptRelative,
      receiptSha256: digest(receiptText),
      mainManagementAttempts: 9,
      mainControlAttempts: 250,
      setupRows: 13,
      setupAttempts: 9,
      preflightRows: 1,
      pins,
    };
  }
  const checkpointText = JSON.stringify(snapshot) + '\n';
  const checkpointPath =
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-checkpoint-20261022.json';
  const packetPath =
    'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-packet-20261022.md';
  const packetText = 'Explicit synthetic proposed acceptance packet only.\n';
  put(checkpointPath, checkpointText);
  put(packetPath, packetText);
  const approval = {
    kind: 'm03_project_verified_continuation_approval',
    version: 1,
    segmentId: snapshot.proposedSegmentId,
    applicationSource: snapshot.applicationSource,
    originalWindowId: snapshot.windowId,
    ownerReply: 'SYNTHETIC TEST ONLY',
    recordedAtUtc: '2026-10-22T00:00:00.000Z',
    reviewedPacketRelative: packetPath,
    reviewedPacketSha256: digest(packetText),
    checkpointRelative: checkpointPath,
    checkpointSha256: digest(checkpointText),
    singleSegmentNoAutomaticRenewal: true,
    preserveHistoricalHeadersAndCounters: true,
    noMigrationReplay: true,
    caps: {
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
    },
  };
  const approvalText = JSON.stringify(approval) + '\n';
  if (recoveryConfiguration) {
    const base =
      'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74';
    const admission = JSON.parse(readFileSync(join(directory, base + '.json'), 'utf8'));
    admission.approvalSha256 = digest(approvalText);
    const admissionText = JSON.stringify(admission) + '\n';
    put(base + '.json', admissionText);
    recoveryConfiguration.pins[base + '.json'] = digest(admissionText);
    for (const suffix of ['.runtime-claim.json', '.closed.json']) {
      const value = JSON.parse(readFileSync(join(directory, base + suffix), 'utf8'));
      value.admissionSha256 = digest(admissionText);
      const text = JSON.stringify(value) + '\n';
      put(base + suffix, text);
      recoveryConfiguration.pins[base + suffix] = digest(text);
    }
    const receipt = JSON.parse(readFileSync(join(directory, recoveryConfiguration.receiptRelative), 'utf8'));
    receipt.clock.admissionSha256 = recoveryConfiguration.pins[base + '.json'];
    receipt.clock.runtimeClaimSha256 = recoveryConfiguration.pins[base + '.runtime-claim.json'];
    receipt.clock.technicalClosureSha256 = recoveryConfiguration.pins[base + '.closed.json'];
    const text = JSON.stringify(receipt) + '\n';
    put(recoveryConfiguration.receiptRelative, text);
    recoveryConfiguration.receiptSha256 = digest(text);
  }
  let closedConfiguration,
    restoreConfiguration,
    allocationConfiguration,
    readonlyPrepareConfiguration,
    nativeDiscoveryConfiguration,
    nativeBrowserDiscoveryConfiguration,
    baselineDiscoveryConfiguration,
    wf70ReadbackConfiguration,
    managementAllocationConfiguration,
    closedPreparationConfiguration,
    closedFixtureConfiguration,
    preprivateAdminConfiguration,
    catalogReadonlyConfiguration,
    adminAdmissionReadonlyConfiguration,
    runtimePreparationConfiguration,
    runtimeMetadataAllocationConfiguration,
    runtimeRestorationConfiguration,
    runtimeRestorationAllocationConfiguration,
    restoredBrowserDiscoveryConfiguration,
    catalogManagementAllocationConfiguration,
    controlManagementAllocationConfiguration;
  if (closedWindow) {
    const base =
      'scripts/n8n/out/foundation/live/project-verified-continuation-' + snapshot.proposedSegmentId;
    const db = 'scripts/db/out/m03-foundation-project-verified-continuation-' + snapshot.proposedSegmentId;
    const receiptRelative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-sole-default-attempt-20261023.json';
    const cleanupRelative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-sole-default-cleanup-20261023.json';
    const readbackRelative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-sole-default-readback-20261023.json';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, receiptRelative), 'utf8'));
    const cleanup = JSON.parse(readFileSync(join(sourceRoot, cleanupRelative), 'utf8'));
    const readback = JSON.parse(readFileSync(join(sourceRoot, readbackRelative), 'utf8'));
    const pins = {},
      json = (v) => JSON.stringify(v) + '\n';
    const pin = (path, text) => {
      put(path, text);
      pins[path] = digest(text);
    };
    const start = Date.parse('2026-10-23T15:40:00.000Z');
    const admission = {
      kind: 'm03_project_verified_continuation_admission',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      sourceCommitSha: snapshot.applicationSource,
      windowId: snapshot.windowId,
      approvalSha256: digest(approvalText),
      startsAt: start,
      deadlineAt: start + 3600000,
      stopNewAt: start + 3000000,
      hardDeadlineAt: start + 4200000,
      parentProcessId: receipt.clock.parentProcessId,
    };
    const admissionText = json(admission);
    receipt.clock.admissionSha256 = digest(admissionText);
    pin(base + '.technical-2.json', admissionText);
    pin(
      base + '.technical-2.runtime-claim.json',
      json({
        kind: 'm03_project_verified_continuation_runtime_claim',
        version: 1,
        segmentId: snapshot.proposedSegmentId,
        admissionSha256: digest(admissionText),
        processId: receipt.clock.runtimeProcessId,
        parentProcessId: receipt.clock.parentProcessId,
        claimedAt: start + 1000,
      }),
    );
    pin(base + '.technical-2.closed.json', json(receipt.clock));
    for (const [name, used] of [
      ['management', 92],
      ['control', 300],
      ['setup', 44],
    ]) {
      const path = snapshot.journals[name].path;
      const original = readFileSync(join(directory, path), 'utf8');
      const values =
        name === 'setup' && historicalSetupEvents !== undefined
          ? structuredClone(historicalSetupEvents)
          : original.trimEnd().split('\n').map(JSON.parse);
      const current = values.filter(
        (r) =>
          r.event ===
          (name === 'management'
            ? 'management_attempt'
            : name === 'control'
              ? 'control_request_intent'
              : 'setup_attempt'),
      ).length;
      for (let i = current + 1; i <= used; i++)
        values.push(
          name === 'management'
            ? { event: 'management_attempt', ordinal: i }
            : name === 'control'
              ? {
                  event: 'control_request_intent',
                  ordinal: i,
                  kind: 'discovery',
                  at: new Date(start).toISOString(),
                }
              : { event: 'setup_attempt', ordinal: i, kind: 'GET', at: start + i },
        );
      if (name === 'setup')
        while (values.length < 84)
          values.push({ event: 'setup_cleanup_absent', kind: 'bypass', at: start + values.length });
      pin(path, values.map(json).join(''));
    }
    const preflightPath = 'scripts/n8n/out/foundation/live/preflight.jsonl';
    const preflight = readFileSync(join(directory, preflightPath), 'utf8')
      .trimEnd()
      .split('\n')
      .map(JSON.parse);
    while (preflight.length < 4)
      preflight.push({ event: 'synthetic_retained_gateway_preflight', at: start + preflight.length });
    pin(preflightPath, preflight.map(json).join(''));
    pin(
      'scripts/n8n/out/foundation/live/runtime.jsonl',
      Array.from({ length: 50 }, (_, i) =>
        json({ event: 'synthetic_retained_runtime', ordinal: i + 1 }),
      ).join(''),
    );
    for (const suffix of ['attempt', 'latest', 'owner-provision-attempt', 'reactivation-attempt'])
      pin(db + '-technical-2-' + suffix + '.json', json({ kind: suffix, synthetic: true, retained: true }));
    if (closedFault === 'archive') cleanup.subsequentArchive.archiveAfter.fixture.competitorArchived = false;
    if (closedFault === 'writer') cleanup.writerClose.writerAfter.sessionUser = 'postgres';
    if (closedFault === 'usage') cleanup.accounting.managementAttempts = 96;
    if (closedFault === 'historical-closure') receipt.closure.windowClosed = true;
    if (closedFault === 'readback') readback.workflow.actualGetCalls = 0;
    for (const key of ['writerClose', 'independentAdminReadback', 'subsequentArchive']) {
      const raw = structuredClone(cleanup[key]);
      pin(raw.receiptPath, json(raw));
      cleanup[key].receiptSha256 = pins[raw.receiptPath];
    }
    const receiptText = json(receipt),
      cleanupText = json(cleanup),
      readbackText = json(readback);
    put(receiptRelative, receiptText);
    put(cleanupRelative, cleanupText);
    put(readbackRelative, readbackText);
    closedConfiguration = {
      receiptRelative,
      receiptSha256: digest(receiptText),
      cleanupRelative,
      cleanupSha256: digest(cleanupText),
      readbackRelative,
      readbackSha256: digest(readbackText),
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
      pins,
    };
    // This fixture copies only checked-in public receipts. Its operation journal
    // is rebuilt from their projected rows, never from the real runtime paths.
    const restoreRelative = 'milestones/M03-n8n-foundation/evidence/wf00-restore-verified-20261023.json';
    const priorRestoreRelative = 'milestones/M03-n8n-foundation/evidence/wf00-restore-attempt-20261023.json';
    const restored = JSON.parse(readFileSync(join(sourceRoot, restoreRelative), 'utf8'));
    const priorRestoreText = readFileSync(join(sourceRoot, priorRestoreRelative), 'utf8');
    const journalRows = structuredClone(restored.journal.rows);
    if (restoreFault === 'closure') restored.actual.networkCompletionVerified = false;
    if (restoreFault === 'child') restored.actual.childClosed = false;
    if (restoreFault === 'ack') restored.actual.putAcknowledged = false;
    if (restoreFault === 'quota-reset') restored.usage.carriedManagementAfter = 6;
    if (restoreFault === 'prefix') journalRows[0].path += '&changed=true';
    if (restoreFault === 'extra-request') journalRows.push({ ...journalRows[7], number: 5 });
    if (restoreFault === 'duplicate-put') journalRows[7] = { ...journalRows[6], number: 4 };
    if (restoreFault === 'unknown-setting')
      journalRows[8].nativeReadonlySettings.unknown = 'SYNTHETIC_PRIVATE_CANARY';
    const journalText = journalRows.map(json).join('');
    restored.journal.sha256 = digest(journalText);
    restored.journal.rows = journalRows;
    const restoredText = json(restored);
    put(restoreRelative, restoredText);
    put(priorRestoreRelative, priorRestoreText);
    put(restored.journal.path, journalText);
    restoreConfiguration = {
      receiptRelative: restoreRelative,
      receiptSha256: digest(restoredText),
      priorReceiptRelative: priorRestoreRelative,
      priorReceiptSha256: digest(priorRestoreText),
      journalRelative: restored.journal.path,
      journalSha256: digest(journalText),
      priorJournalSha256: restored.journal.originalPrefix.sha256,
    };
    if (proposedBudgetApproved) {
      const allocationRelative =
        'milestones/M03-n8n-foundation/evidence/remaining-control-allocation-approval-20261023.json';
      const allocation = JSON.parse(readFileSync(join(sourceRoot, allocationRelative), 'utf8'));
      allocation.actualPriorUsage.receiptSha256 = restoreConfiguration.receiptSha256;
      if (allocationFault === 'owner') allocation.ownerReply = 'SYNTHETIC_UNAPPROVED';
      if (allocationFault === 'used') allocation.allocation.usedSetupRequests = 0;
      if (allocationFault === 'maximum') allocation.allocation.setupMaximum = 89;
      if (allocationFault === 'reset') allocation.allocation.countersReset = true;
      if (allocationFault === 'global') allocation.unchangedGlobalCaps.management = 513;
      if (allocationFault === 'budget') allocation.boundaries.actorAllowanceReplenished = true;
      if (allocationFault === 'prior-usage') allocation.actualPriorUsage.management = 98;
      const text = json(allocation);
      put(allocationRelative, text);
      allocationConfiguration = { relative: allocationRelative, sha256: digest(text) };
    }
  }
  if (readonlyPrepare) {
    if (!closedWindow || !proposedBudgetApproved) throw Error('SYNTHETIC_READONLY_PREPARE_PREREQUISITES');
    const relative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical3-reconciliation-20261023.json';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    const json = (v) => JSON.stringify(v) + '\n';
    const base =
      'scripts/n8n/out/foundation/live/project-verified-continuation-' + snapshot.proposedSegmentId;
    const start = Date.parse('2026-10-23T17:00:00.000Z');
    const admission = {
      kind: 'm03_project_verified_continuation_admission',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
      windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      approvalSha256: digest(approvalText),
      startsAt: start,
      deadlineAt: start + 3600000,
      stopNewAt: start + 3000000,
      hardDeadlineAt: start + 4200000,
      parentProcessId: 91001,
    };
    const admissionText = json(admission);
    const claim = {
      kind: 'm03_project_verified_continuation_runtime_claim',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      admissionSha256: digest(admissionText),
      processId: 91002,
      parentProcessId: admission.parentProcessId,
      claimedAt: start + 1000,
    };
    const closed = {
      kind: 'm03_project_verified_technical_closed',
      version: 1,
      admissionSha256: digest(admissionText),
      parentProcessId: admission.parentProcessId,
      runtimeProcessId: claim.processId,
      closedAt: start + 60000,
      childClosed: true,
      credentialChildrenClosed: true,
      emergencyShutdown: false,
      pendingMachinePreserved: true,
      nativeExit: 1,
      bypassHandoffDeleted: false,
      closureVerified: false,
    };
    for (const [key, suffix, value] of [
      ['admission', '.json', admission],
      ['runtimeClaim', '.runtime-claim.json', claim],
      ['closed', '.closed.json', closed],
    ]) {
      const path = base + '.technical-3' + suffix;
      const text = json(value);
      put(path, text);
      receipt.immutableTechnicalRecords[key] = { path, bytes: Buffer.byteLength(text), sha256: digest(text) };
    }
    for (const [name, previous, count] of [
      ['management', 92, 25],
      ['control', 300, 50],
    ]) {
      const path = snapshot.journals[name].path;
      let text = readFileSync(join(directory, path), 'utf8');
      for (let ordinal = previous + 1; ordinal <= previous + count; ordinal++)
        text += json(
          name === 'management'
            ? { event: 'management_attempt', ordinal }
            : {
                event: 'control_request_intent',
                ordinal,
                kind: 'discovery',
                at: new Date(start).toISOString(),
              },
        );
      put(path, text);
    }
    for (const name of ['management', 'control', 'setup', 'preflight', 'runtime']) {
      const value = receipt.actualPublicJournals[name];
      const text = readFileSync(join(directory, value.path), 'utf8');
      value.sha256 = digest(text);
      value.bytes = Buffer.byteLength(text);
      value.rowCount = text.trimEnd().split('\n').length;
    }
    // Copy only the tracked, frozen public attempt. Never read actual ignored
    // runtime records; all sibling records and journals above are synthetic.
    const attemptText = readFileSync(join(sourceRoot, receipt.frozenAttempt.path), 'utf8');
    put(receipt.frozenAttempt.path, attemptText);
    receipt.frozenAttempt.sha256 = digest(attemptText);
    receipt.frozenAttempt.bytes = Buffer.byteLength(attemptText);
    if (readonlyPrepareFault === 'usage') receipt.usage.management = 102;
    if (readonlyPrepareFault === 'side-effect') receipt.actualSideEffects.newHostedWritesReached = true;
    if (readonlyPrepareFault === 'actor') receipt.actualSideEffects.actorStarts = 1;
    if (readonlyPrepareFault === 'cleanup') receipt.actualCleanup.bypassFilePresent = true;
    if (readonlyPrepareFault === 'closure-rewritten')
      receipt.immutableTechnicalRecords.closureVerifiedRemainsFalse = false;
    const text = json(receipt);
    put(relative, text);
    readonlyPrepareConfiguration = { relative, sha256: digest(text) };
  }
  if (nativeDiscovery)
    for (const ordinal of baselineDiscovery ? [4, 5, 6] : nativeBrowserDiscovery ? [4, 5] : [4]) {
      const relative = `milestones/M03-n8n-foundation/evidence/dev-acceptance-technical${ordinal}-reconciliation-${ordinal === 6 ? '20261024' : '20261023'}.json`;
      const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
      const json = (value) => JSON.stringify(value) + '\n';
      const base =
        'scripts/n8n/out/foundation/live/project-verified-continuation-' + snapshot.proposedSegmentId;
      const start = Date.parse(
        ordinal === 4
          ? '2026-10-23T17:10:00.000Z'
          : ordinal === 5
            ? '2026-10-23T17:20:00.000Z'
            : '2026-10-23T17:30:00.000Z',
      );
      const admission = {
        kind: 'm03_project_verified_continuation_admission',
        version: 1,
        segmentId: snapshot.proposedSegmentId,
        sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
        windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
        approvalSha256: digest(approvalText),
        startsAt: start,
        deadlineAt: start + 3600000,
        stopNewAt: start + 3000000,
        hardDeadlineAt: start + 4200000,
        parentProcessId: 91003 + 2 * (ordinal - 4),
      };
      const admissionSha256 = digest(json(admission));
      const claim = {
        kind: 'm03_project_verified_continuation_runtime_claim',
        version: 1,
        segmentId: snapshot.proposedSegmentId,
        admissionSha256,
        processId: 91004 + 2 * (ordinal - 4),
        parentProcessId: admission.parentProcessId,
        claimedAt: start + 1000,
      };
      const closed = {
        kind: 'm03_project_verified_technical_closed',
        version: 1,
        admissionSha256,
        parentProcessId: admission.parentProcessId,
        runtimeProcessId: claim.processId,
        closedAt: start + 20000,
        childClosed: true,
        credentialChildrenClosed: true,
        emergencyShutdown: false,
        pendingMachinePreserved: true,
        nativeExit: 1,
        bypassHandoffDeleted: false,
        closureVerified: false,
      };
      if (ordinal === 6 && baselineDiscoveryFault === 'unknown-completion')
        closed.credentialChildrenClosed = false;
      for (const [key, suffix, value] of [
        ['admission', '.json', admission],
        ['runtimeClaim', '.runtime-claim.json', claim],
        ['closed', '.closed.json', closed],
      ]) {
        const path = base + '.technical-' + ordinal + suffix,
          text = json(value);
        put(path, text);
        receipt.immutableTechnicalRecords[key] = {
          path,
          bytes: Buffer.byteLength(text),
          sha256: digest(text),
        };
      }
      receipt.actualCleanup.closedReceiptSha256 = receipt.immutableTechnicalRecords.closed.sha256;
      receipt.actualCleanup.parentProcessId = admission.parentProcessId;
      receipt.actualCleanup.runtimeProcessId = claim.processId;
      const controlPath = snapshot.journals.control.path;
      const discovery = {
        event: 'control_request_intent',
        ordinal: ordinal + 347,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 6000).toISOString(),
      };
      const fault =
        ordinal === 4
          ? nativeDiscoveryFault
          : ordinal === 5
            ? nativeBrowserDiscoveryFault
            : baselineDiscoveryFault;
      if (fault === 'execution') discovery.kind = 'execution_start';
      if (fault === 'foreign') discovery.workflowId = 'SYNTHETIC_FOREIGN';
      put(controlPath, readFileSync(join(directory, controlPath), 'utf8') + json(discovery));
      if (ordinal === 6) {
        const managementPath = snapshot.journals.management.path;
        const addedManagement = Array.from({ length: 25 }, (_, i) => ({
          event: fault === 'unknown-row' && i === 0 ? 'SYNTHETIC_UNKNOWN_ROW' : 'management_attempt',
          ordinal: 118 + i,
        }));
        put(
          managementPath,
          readFileSync(join(directory, managementPath), 'utf8') + addedManagement.map(json).join(''),
        );
        const verified = {
          event: 'browser_port_preflight_verified',
          kind: 'browser_ui',
          workflowId: discovery.workflowId,
          at: new Date(start + 6500).toISOString(),
        };
        const refs = JSON.parse(
          readFileSync(join(sourceRoot, 'n8n/foundation/bindings.dev.json'), 'utf8'),
        ).workflowRefs;
        const extra = Object.values(refs)
          .slice(0, 14)
          .flatMap((ref, i) =>
            [0, 1].map((j) => ({
              event: 'control_request_intent',
              ordinal: 354 + 2 * i + j,
              kind: 'discovery',
              workflowId: fault === 'foreign' && i === 13 ? 'SYNTHETIC_FOREIGN' : ref.id,
              at: new Date(start + 7000 + (2 * i + j) * 100).toISOString(),
            })),
          );
        put(
          controlPath,
          readFileSync(join(directory, controlPath), 'utf8') + json(verified) + extra.map(json).join(''),
        );
        receipt.executionDiscovery = {
          ...receipt.executionDiscovery,
          browserIntent: discovery,
          browserVerified: verified,
          lastIntent: extra.at(-1),
        };
        if (fault === 'baseline-count') receipt.actualFailure.baselineSourceGets = 24;
      } else receipt.discoveryAttempt = discovery;
      for (const name of ['management', 'control', 'setup', 'preflight', 'runtime']) {
        const value = receipt.actualPublicJournals[name],
          text = readFileSync(join(directory, value.path), 'utf8');
        value.sha256 = digest(text);
        value.bytes = Buffer.byteLength(text);
        value.rowCount = text.trimEnd().split('\n').length;
      }
      if (fault === 'usage') receipt.usage.control--;
      if (fault === 'write') receipt.actualFailure.newWorkflowWrites = 1;
      if (fault === 'actor') receipt.actualFailure.actorStarts = 1;
      if (fault === 'cleanup') receipt.actualCleanup.bypassAbsent = false;
      if (fault === 'unknown-completion') receipt.actualFailure.protocolResidual = true;
      const text = json(receipt);
      put(relative, text);
      if (ordinal === 4) nativeDiscoveryConfiguration = { relative, sha256: digest(text) };
      else if (ordinal === 5) nativeBrowserDiscoveryConfiguration = { relative, sha256: digest(text) };
      else baselineDiscoveryConfiguration = { relative, sha256: digest(text) };
    }
  if (wf70Readback || baselineDiscovery) {
    const relative = 'milestones/M03-n8n-foundation/evidence/dev-acceptance-wf70-readback-20261024.json';
    const journalRelative = 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    receipt.originalFailure.receiptSha256 = baselineDiscoveryConfiguration.sha256;
    receipt.recordedAt = '2026-10-23T17:40:10.000Z';
    const rows = [
      {
        kind: 'm03_wf70_discovery_budget',
        version: 1,
        receiptSha256: baselineDiscoveryConfiguration.sha256,
        managementAttempts: 152,
        controlAttempts: 382,
        combinedAttempts: 534,
        maximumRequests: 4,
        parentProcessId: 91009,
      },
      { event: 'diagnostic_child_claim', processId: 91010 },
      ...[1, 2].map((i) => ({
        event: 'control_request_intent',
        ordinal: 382 + i,
        diagnosticOrdinal: i,
        kind: 'discovery',
        workflowKey: 'WF-70',
        at: new Date(Date.parse('2026-10-23T17:40:00.000Z') + i * 100).toISOString(),
      })),
    ];
    if (wf70ReadbackFault === 'ordinal') rows[3].ordinal = 383;
    if (wf70ReadbackFault === 'unknown-row') rows[3].kind = 'start';
    if (wf70ReadbackFault === 'suffix') rows.push({ ...rows[3], ordinal: 385, diagnosticOrdinal: 3 });
    if (wf70ReadbackFault === 'usage') receipt.usage.control = 383;
    if (wf70ReadbackFault === 'write') receipt.interpretation.newWorkflowExecutionOrRemoteWrite = true;
    if (wf70ReadbackFault === 'cleanup')
      receipt.independentCleanupReadback.temporaryManagementCopyAbsent = false;
    if (wf70ReadbackFault === 'unknown-completion') receipt.actualNativeResult.childClosed = false;
    if (wf70ReadbackFault === 'http') receipt.actualNativeResult.requests[1].httpStatus = 503;
    if (wf70ReadbackFault === 'scope') receipt.actualNativeResult.workflowKey = 'WF-00';
    const journalText = rows.map((v) => JSON.stringify(v) + '\n').join('');
    put(journalRelative, journalText);
    receipt.durableUsageJournal.sha256 = digest(journalText);
    receipt.durableUsageJournal.parentProcessId = 91009;
    receipt.durableUsageJournal.childProcessId = 91010;
    const text = JSON.stringify(receipt) + '\n';
    put(relative, text);
    wf70ReadbackConfiguration = {
      relative,
      sha256: digest(text),
      journalRelative,
      journalSha256: digest(journalText),
    };
  }
  if (managementAllocation) {
    const relative =
      'milestones/M03-n8n-foundation/evidence/remaining-management-allocation-approval-20261024.json';
    const packetRelative =
      'milestones/M03-n8n-foundation/evidence/remaining-management-allocation-20261024.md';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    receipt.recordedAt = '2026-10-23T17:50:00.000Z';
    const packet = readFileSync(join(sourceRoot, packetRelative), 'utf8');
    put(packetRelative, packet);
    receipt.referencePacket.sha256 = digest(packet);
    receipt.actualPriorUsage.reconciliationSha256 = baselineDiscoveryConfiguration.sha256;
    receipt.actualPriorUsage.diagnosticSha256 = wf70ReadbackConfiguration.sha256;
    if (managementAllocationFault === 'usage') receipt.actualPriorUsage.management = 127;
    if (managementAllocationFault === 'maximum') receipt.allocation.managementMaximum = 640;
    if (managementAllocationFault === 'combined') receipt.unchangedCaps.combined = 2624;
    if (managementAllocationFault === 'reset') receipt.allocation.countersReset = true;
    if (managementAllocationFault === 'actor') receipt.unchangedCaps.actorStarts = 3;
    if (managementAllocationFault === 'spend') receipt.boundaries.spendingIncrease = true;
    if (managementAllocationFault === 'reply') receipt.ownerReply = 'Synthetic unapproved allowance';
    const text = JSON.stringify(receipt) + '\n';
    put(relative, text);
    managementAllocationConfiguration = {
      relative,
      sha256: digest(text),
      packetRelative,
      packetSha256: digest(packet),
    };
  }
  if (closedPreparation) {
    const relative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical7-reconciliation-20261024.json';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    const base =
      'scripts/n8n/out/foundation/live/project-verified-continuation-' + snapshot.proposedSegmentId;
    const db =
      'scripts/db/out/m03-foundation-project-verified-continuation-' +
      snapshot.proposedSegmentId +
      '-technical-7';
    const start = Date.parse('2026-10-23T17:51:00.000Z');
    const json = (value) => JSON.stringify(value) + '\n';
    const admission = {
      kind: 'm03_project_verified_continuation_admission',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
      windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      approvalSha256: digest(approvalText),
      startsAt: start,
      deadlineAt: start + 3600000,
      stopNewAt: start + 3000000,
      hardDeadlineAt: start + 4200000,
      parentProcessId: 91011,
    };
    const admissionSha256 = digest(json(admission));
    const claim = {
      kind: 'm03_project_verified_continuation_runtime_claim',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      admissionSha256,
      processId: 91012,
      parentProcessId: 91011,
      claimedAt: start + 1000,
    };
    const closed = {
      kind: 'm03_project_verified_technical_closed',
      version: 1,
      admissionSha256,
      parentProcessId: 91011,
      runtimeProcessId: 91012,
      closedAt: start + 20000,
      childClosed: true,
      credentialChildrenClosed: true,
      emergencyShutdown: false,
      pendingMachinePreserved: true,
      nativeExit: 1,
      bypassHandoffDeleted: false,
      closureVerified: false,
    };
    if (closedPreparationFault === 'unknown-completion') closed.credentialChildrenClosed = false;
    for (const [key, suffix, value] of [
      ['admission', '.json', admission],
      ['runtimeClaim', '.runtime-claim.json', claim],
      ['closed', '.closed.json', closed],
    ]) {
      const path = base + '.technical-7' + suffix,
        text = json(value);
      put(path, text);
      receipt.immutableTechnicalRecords[key] = { path, bytes: Buffer.byteLength(text), sha256: digest(text) };
    }
    receipt.recordedAt = '2026-10-23T17:52:00.000Z';
    receipt.actualCleanup.parentProcessId = 91011;
    receipt.actualCleanup.runtimeProcessId = 91012;
    const runId = 'a7777777-7777-4777-8777-777777777777';
    const typePath = 'scripts/db/out/m03-foundation-continuation-' + runId + '-db.types.ts';
    const typeText = 'Explicit synthetic generated-type snapshot only.\n';
    put(typePath, typeText);
    const attempt = {
      version: 1,
      runId,
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      segmentId: snapshot.proposedSegmentId,
      purpose: 'postcheck-only-continuation',
      createdAt: new Date(start + 2000).toISOString(),
    };
    const admin = {
      version: 1,
      runId,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      host: 'aws-1-eu-central-1.pooler.supabase.com',
      port: 5432,
      status: 'continuation_history_verified',
      authenticationAttempted: true,
      authenticationVerified: true,
      historyBefore: 'complete',
      historyAfter: 'complete',
      pendingVersions: [],
      pushAttempted: false,
      childrenClosed: true,
      handoffDeleted: true,
      leaseDeleted: true,
      scratchDeleted: true,
      phaseAControl: true,
      phaseACommands: 3,
      phaseAClosed: false,
      postcheckContinuation: true,
      projectVerifiedContinuation: true,
      forwardWindow: true,
      activeWindowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      clockSegmentId: snapshot.proposedSegmentId,
      technicalAttemptOrdinal: 7,
      unprovisionedFixtureArchived: false,
      postcheckStage: 'complete',
      postcheckCandidate: typePath,
    };
    if (closedPreparationFault === 'admin') admin.pushAttempted = true;
    put(db + '-attempt.json', json(attempt));
    put(db + '-latest.json', json(admin));
    Object.assign(receipt.administrativeResult, {
      runId,
      attemptPath: db + '-attempt.json',
      attemptSha256: digest(json(attempt)),
      receiptPath: db + '-latest.json',
      receiptSha256: digest(json(admin)),
      generatedTypePath: typePath,
      generatedTypeSha256: digest(typeText),
    });
    const managementPath = snapshot.journals.management.path;
    put(
      managementPath,
      readFileSync(join(directory, managementPath), 'utf8') +
        Array.from({ length: 25 }, (_, i) => json({ event: 'management_attempt', ordinal: 143 + i })).join(
          '',
        ),
    );
    const refs = JSON.parse(
      readFileSync(join(sourceRoot, 'n8n/foundation/bindings.dev.json'), 'utf8'),
    ).workflowRefs;
    const controlRows = [
      {
        event: 'control_request_intent',
        ordinal: 382,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3000).toISOString(),
      },
      {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3500).toISOString(),
      },
      ...Object.values(refs).flatMap((ref, i) =>
        [0, 1].map((j) => ({
          event: 'control_request_intent',
          ordinal: 383 + 2 * i + j,
          kind: 'discovery',
          workflowId: ref.id,
          at: new Date(start + 4000 + (2 * i + j) * 100).toISOString(),
        })),
      ),
    ];
    if (closedPreparationFault === 'unknown-row') controlRows[2].kind = 'start';
    const controlPath = snapshot.journals.control.path;
    put(controlPath, readFileSync(join(directory, controlPath), 'utf8') + controlRows.map(json).join(''));
    for (const name of ['management', 'control', 'setup', 'preflight', 'runtime']) {
      const p = receipt.actualPublicJournals[name],
        text = readFileSync(join(directory, p.path), 'utf8');
      Object.assign(p, {
        bytes: Buffer.byteLength(text),
        rowCount: text.trimEnd().split('\n').length,
        sha256: digest(text),
      });
    }
    if (closedPreparationFault === 'usage') receipt.usage.control = 434;
    if (closedPreparationFault === 'write') receipt.actualFailure.newPreviewRequests = 1;
    if (closedPreparationFault === 'cleanup') receipt.actualCleanup.allEightRuntimeInputFilesAbsent = false;
    if (closedPreparationFault === 'fresh-window')
      receipt.independentHostedReadback.windows.push({
        ...receipt.independentHostedReadback.windows[0],
        windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      });
    const text = json(receipt);
    put(relative, text);
    closedPreparationConfiguration = { relative, sha256: digest(text) };
  }
  if (closedFixture) {
    const relative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical8-reconciliation-20261024.json';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    const base = `scripts/n8n/out/foundation/live/project-verified-continuation-${snapshot.proposedSegmentId}.technical-8`;
    const db = `scripts/db/out/m03-foundation-project-verified-continuation-${snapshot.proposedSegmentId}-technical-8`;
    const start = Date.parse('2026-10-24T00:01:00.000Z');
    const json = (v) => JSON.stringify(v) + '\n';
    const pin = (path, value) => {
      const text = typeof value === 'string' ? value : json(value);
      put(path, text);
      return { path, sha256: digest(text), bytes: Buffer.byteLength(text) };
    };
    const admission = {
      kind: 'm03_project_verified_continuation_admission',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
      windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      approvalSha256: digest(approvalText),
      startsAt: start,
      deadlineAt: start + 3600000,
      stopNewAt: start + 3000000,
      hardDeadlineAt: start + 4200000,
      parentProcessId: 91013,
    };
    const admissionSha256 = digest(json(admission));
    const claim = {
      kind: 'm03_project_verified_continuation_runtime_claim',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      admissionSha256,
      processId: 91014,
      parentProcessId: 91013,
      claimedAt: start + 1000,
    };
    const closed = {
      kind: 'm03_project_verified_technical_closed',
      version: 1,
      admissionSha256,
      parentProcessId: 91013,
      runtimeProcessId: 91014,
      closedAt: start + 180000,
      childClosed: true,
      credentialChildrenClosed: true,
      emergencyShutdown: false,
      pendingMachinePreserved: true,
      nativeExit: 1,
      bypassHandoffDeleted: false,
      closureVerified: false,
    };
    if (closedFixtureFault === 'unknown-completion') closed.credentialChildrenClosed = false;
    receipt.immutableTechnicalRecords.admission = pin(base + '.json', admission);
    receipt.immutableTechnicalRecords.runtimeClaim = pin(base + '.runtime-claim.json', claim);
    receipt.immutableTechnicalRecords.closed = pin(base + '.closed.json', closed);
    receipt.immutableTechnicalRecords.parentProcessId = 91013;
    receipt.immutableTechnicalRecords.runtimeProcessId = 91014;
    receipt.recordedAt = '2026-10-24T00:05:00.000Z';
    const runId = 'a8888888-8888-4888-8888-888888888888';
    const typePath = `scripts/db/out/m03-foundation-continuation-${runId}-db.types.ts`;
    const admin = {
      version: 1,
      runId,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      host: 'aws-1-eu-central-1.pooler.supabase.com',
      port: 5432,
      ...receipt.administrativeResult.admin,
      runId,
      phaseAControl: true,
      pendingVersions: [],
      postcheckContinuation: true,
      projectVerifiedContinuation: true,
      activeWindowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
      clockSegmentId: snapshot.proposedSegmentId,
      technicalAttemptOrdinal: 8,
      postcheckCandidate: typePath,
      reactivationState: 'unknown',
    };
    const reactivation = {
      ...receipt.administrativeResult.reactivation,
      runId,
      createdAt: new Date(start + 50000).toISOString(),
    };
    Object.assign(receipt.administrativeResult.admin, { runId, postcheckCandidate: typePath });
    receipt.administrativeResult.reactivation = reactivation;
    if (closedFixtureFault === 'admin') admin.pushAttempted = true;
    receipt.administrativeResult.pins = [
      pin(db + '-attempt.json', {
        version: 1,
        runId,
        projectRef: receipt.projectRef,
        segmentId: snapshot.proposedSegmentId,
        purpose: 'postcheck-only-continuation',
        createdAt: new Date(start + 2000).toISOString(),
      }),
      pin(db + '-latest.json', admin),
      pin(db + '-owner-provision-attempt.json', {
        version: 1,
        runId,
        windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
        packet: {
          audience: receipt.actualAttempt.previewAudience,
          commitSha: 'a5e746736893d5040e93032ae740a0878f748837',
          deploymentId: receipt.actualAttempt.previewDeployment,
          actorBuild: '0.3.99',
          approvalReference: 'M03-A-D-f42930f-20261021',
          maxTotalChargeUsd: 1,
          batchMaxUsd: 2,
        },
        createdAt: new Date(start + 40000).toISOString(),
      }),
      pin(db + '-reactivation-attempt.json', reactivation),
      pin(typePath, 'Explicit synthetic technical8 generated-type snapshot only.\n'),
    ];
    const managementPath = snapshot.journals.management.path;
    put(
      managementPath,
      readFileSync(join(directory, managementPath), 'utf8') +
        Array.from({ length: 60 }, (_, i) => json({ event: 'management_attempt', ordinal: 168 + i })).join(
          '',
        ),
    );
    const refs = JSON.parse(
      readFileSync(join(sourceRoot, 'n8n/foundation/bindings.dev.json'), 'utf8'),
    ).workflowRefs;
    const control = [
      {
        event: 'control_request_intent',
        ordinal: 433,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3000).toISOString(),
      },
      {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3500).toISOString(),
      },
      ...Object.values(refs).flatMap((ref, i) =>
        [0, 1].map((j) => ({
          event: 'control_request_intent',
          ordinal: 434 + 2 * i + j,
          kind: 'discovery',
          workflowId: ref.id,
          at: new Date(start + 4000 + (2 * i + j) * 100).toISOString(),
        })),
      ),
    ];
    if (closedFixtureFault === 'unknown-row') control[2].kind = 'start';
    const controlPath = snapshot.journals.control.path;
    put(controlPath, readFileSync(join(directory, controlPath), 'utf8') + control.map(json).join(''));
    let at = start + 20000,
      ordinal = 44;
    const setup = [],
      push = (value) => setup.push({ ...value, at: at++ });
    const attempt = (kind) => push({ event: 'setup_attempt', ordinal: ++ordinal, kind });
    attempt('GET');
    attempt('GET');
    push({ event: 'setup_intent', kind: 'bypass' });
    attempt('PATCH');
    push({ event: 'setup_ack', kind: 'bypass' });
    attempt('GET');
    push({
      event: 'setup_verified',
      kind: 'bypass',
      createdAt: at,
      soleOwnedDefaultVerified: true,
      nonDefaultVerified: false,
      observedDefaultFlag: 'true',
    });
    const keys = [
      'EMR_M03_FOUNDATION_ENABLED',
      'EMR_M03_FOUNDATION_WINDOW_ID',
      'EMR_M03_FOUNDATION_WRITER_PASSWORD',
      'EMR_M03_FOUNDATION_APIFY_READ_TOKEN',
      'EMR_M03_FOUNDATION_TOKEN_SHA256',
      'EMR_M03_FOUNDATION_AUDIENCE',
      'EMR_M03_FOUNDATION_COMMIT_SHA',
    ];
    for (const [i, key] of keys.entries()) {
      push({ event: 'setup_intent', kind: 'environment', key });
      attempt('POST');
      setup.push({
        event: 'setup_ack',
        kind: 'environment',
        id: 'synthetic38b' + i,
        key,
        type: 'sensitive',
        target: ['preview'],
        gitBranch: 'm03-n8n-foundation',
        comment: 'M03 foundation temporary dev 38b3708d-61b0-41d2-8170-5ed91c66b4dc',
        createdAt: at,
        updatedAt: at,
      });
    }
    attempt('GET');
    push({ event: 'setup_intent', kind: 'deployment' });
    attempt('POST');
    push({
      event: 'setup_ack',
      kind: 'deployment',
      deploymentId: receipt.actualAttempt.previewDeployment,
      audience: receipt.actualAttempt.previewAudience,
    });
    for (let i = 0; i < 4; i++) attempt('GET');
    push({
      event: 'setup_verified',
      kind: 'deployment',
      deploymentId: receipt.actualAttempt.previewDeployment,
      audience: receipt.actualAttempt.previewAudience,
    });
    attempt('GET');
    for (const [i, key] of keys.entries()) {
      push({ event: 'setup_cleanup_intent', kind: 'environment', id: 'synthetic38b' + i, key });
      attempt('DELETE');
      attempt('GET');
      push({ event: 'setup_cleanup_absent', kind: 'environment', id: 'synthetic38b' + i, key });
    }
    attempt('GET');
    push({ event: 'setup_cleanup_intent', kind: 'bypass' });
    attempt('PATCH');
    attempt('GET');
    push({ event: 'setup_cleanup_absent', kind: 'bypass' });
    const environmentAck = setup.find((row) => row.event === 'setup_ack' && row.kind === 'environment');
    if (closedFixtureFault === 'ack-timestamp') environmentAck.createdAt = start - 1;
    if (closedFixtureFault === 'ack-extra-at') environmentAck.at = at;
    const setupPath = snapshot.journals.setup.path;
    put(setupPath, readFileSync(join(directory, setupPath), 'utf8') + setup.map(json).join(''));
    const intentAt = new Date(start + 100000).toISOString(),
      verifiedAt = new Date(start + 100001).toISOString();
    const closeRows = [
      {
        event: 'foundation_writer_close_intent',
        windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
        requestId: '00000000-0000-4000-8000-000000000021',
        audience: receipt.actualAttempt.previewAudience,
        sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
        deploymentId: receipt.actualAttempt.previewDeployment,
        at: intentAt,
      },
      {
        event: 'foundation_writer_close_verified',
        windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
        identityVerified: true,
        bindingVerified: true,
        closeAcknowledged: true,
        connectionClosed: true,
        at: verifiedAt,
      },
    ];
    receipt.restrictedWriterClose.intentAt = intentAt;
    receipt.restrictedWriterClose.verifiedAt = verifiedAt;
    const preflightPath = 'scripts/n8n/out/foundation/live/preflight.jsonl';
    put(preflightPath, readFileSync(join(directory, preflightPath), 'utf8') + closeRows.map(json).join(''));
    for (const name of ['management', 'control', 'setup', 'preflight', 'runtime']) {
      const p = receipt.actualPublicJournals[name],
        text = readFileSync(join(directory, p.path), 'utf8');
      Object.assign(p, {
        bytes: Buffer.byteLength(text),
        rows: text.trimEnd().split('\n').length,
        sha256: digest(text),
      });
    }
    if (closedFixtureFault === 'usage') receipt.usage.management = 236;
    if (closedFixtureFault === 'cleanup') receipt.actualCleanup.allEightInputFilesAbsent = false;
    if (closedFixtureFault === 'actor') receipt.actualAttempt.actorStarts = 1;
    if (closedFixtureFault === 'mutation') receipt.actualAttempt.fixtureReactivationCommitted = true;
    if (closedFixtureFault === 'window-open') receipt.subsequentReadback.windowFamily[0].closed = false;
    if (closedFixtureFault === 'audit') receipt.subsequentReadback.audits.push('unknown');
    if (closedFixtureFault === 'vacancy') receipt.subsequentReadback.vacancy.launches = 1;
    if (closedFixtureFault === 'writer-close') receipt.restrictedWriterClose.administratorSubstituted = true;
    const text = json(receipt);
    put(relative, text);
    closedFixtureConfiguration = { relative, sha256: digest(text) };
  }
  if (controlManagementAllocation) {
    const relative =
      'milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-approval-20261024.json';
    const packetRelative =
      'milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-20261024.md';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    const packet = readFileSync(join(sourceRoot, packetRelative), 'utf8');
    put(packetRelative, packet);
    receipt.referencePacket.sha256 = digest(packet);
    receipt.actualPriorUsage.reconciliationSha256 = closedFixtureConfiguration.sha256;
    receipt.recordedAt = '2026-10-24T00:45:00.000Z';
    if (controlManagementAllocationFault === 'usage') receipt.actualPriorUsage.management = 0;
    if (controlManagementAllocationFault === 'maximum') receipt.allocation.managementMaximum = 641;
    if (controlManagementAllocationFault === 'vercel') receipt.allocation.vercelMaximum = 133;
    if (controlManagementAllocationFault === 'combined') receipt.unchangedCaps.combined = 2624;
    if (controlManagementAllocationFault === 'reset') receipt.allocation.countersReset = true;
    if (controlManagementAllocationFault === 'actor') receipt.unchangedCaps.actorStarts = 3;
    if (controlManagementAllocationFault === 'reply') receipt.ownerReply = 'Synthetic unapproved allowance';
    const text = JSON.stringify(receipt) + '\n';
    put(relative, text);
    controlManagementAllocationConfiguration = {
      relative,
      sha256: digest(text),
      packetRelative,
      packetSha256: digest(packet),
    };
  }
  if (preprivateAdmin) {
    const relative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical9-reconciliation-20261024.json';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    const base = `scripts/n8n/out/foundation/live/project-verified-continuation-${snapshot.proposedSegmentId}.technical-9`;
    const json = (v) => JSON.stringify(v) + '\n';
    const start = Date.parse('2026-10-24T01:48:30.264Z');
    const admission = {
      kind: 'm03_project_verified_continuation_admission',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      sourceCommitSha: receipt.source.applicationSource,
      windowId: receipt.attempt.windowId,
      approvalSha256: digest(approvalText),
      startsAt: start,
      deadlineAt: start + 3600000,
      stopNewAt: start + 3000000,
      hardDeadlineAt: start + 4200000,
      parentProcessId: 91015,
    };
    const claim = {
      kind: 'm03_project_verified_continuation_runtime_claim',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      admissionSha256: digest(json(admission)),
      processId: 91016,
      parentProcessId: 91015,
      claimedAt: start + 2000,
    };
    const closed = {
      kind: 'm03_project_verified_technical_closed',
      version: 1,
      admissionSha256: digest(json(admission)),
      parentProcessId: 91015,
      runtimeProcessId: 91016,
      closedAt: start + 149883,
      childClosed: true,
      credentialChildrenClosed: true,
      emergencyShutdown: false,
      pendingMachinePreserved: true,
      nativeExit: 1,
      bypassHandoffDeleted: false,
      closureVerified: false,
    };
    Object.assign(receipt.attempt, {
      parentProcessId: 91015,
      runtimeProcessId: 91016,
      startsAt: start,
      closedAt: closed.closedAt,
    });
    const outcome = {
      managementAttempts: 262,
      controlAttempts: 537,
      nativeExecutions: 0,
      gatewayPreflightAttempts: 2,
      providerDirectAttempts: 0,
      phaseBReady: false,
      domainProofReady: false,
      businessAcceptanceProven: false,
      code: 'FOUNDATION_ADMIN_PREFLIGHT_BLOCKED',
    };
    const residual = {
      windowClosed: false,
      fixtureArchived: false,
      baselineRestored: false,
      environmentCleanupVerified: false,
      remoteWorkSettled: false,
      residual: true,
    };
    const frames = [
      {
        kind: 'm03_public_raw_pipe_receipt',
        version: 1,
        helperHead: receipt.source.head,
        applicationSource: receipt.source.applicationSource,
        windowId: receipt.attempt.windowId,
        technicalAttempt: 9,
        parentProcessId: 91015,
        adapterReadsCredentialValues: false,
      },
      {
        kind: 'm03_acceptance_transport_ready',
        nonce: 'a'.repeat(32),
        privateRead: false,
        networkRequests: 0,
      },
      {
        kind: 'm03_acceptance_vercel_metadata',
        status: 'metadata_covers_75_minutes',
        metadataValid: true,
        unexpired: true,
        covers75Minutes: true,
        effectiveBackendEstablished: false,
        networkRequests: 0,
        authenticationAttempted: false,
        refreshAttempted: false,
        configWritten: false,
        childClosed: true,
      },
      {
        kind: 'm03_acceptance_ready',
        status: 'private_child_ready',
        deadlineAt: admission.deadlineAt,
        approvedHead: admission.approvalSha256 && 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
        sourceCommitSha: admission.sourceCommitSha,
      },
      {
        kind: 'mcp_port_request',
        nonce: 'b'.repeat(32),
        action: 'browser_discover',
        workflowId: 'MzimjpsuyPuK7SKe',
      },
      {
        kind: 'm03_acceptance_result',
        id: 'm03_live_015',
        command: 'prepare',
        status: 'blocked',
        ...outcome,
        residual: true,
      },
      {
        kind: 'm03_acceptance_result',
        id: 'm03_live_016',
        command: 'restore',
        status: 'restoration_residual',
        ...outcome,
        ...residual,
      },
      {
        kind: 'm03_acceptance_closed',
        status: 'closed',
        ...outcome,
        childTransportsClosed: true,
        adminChildClosed: true,
        ...residual,
      },
      {
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
      },
      {
        kind: 'm03_public_raw_pipe_closed',
        nativeExit: 1,
        parentClosed: true,
        stderrPresent: false,
        protocolBlocked: false,
        overflow: false,
      },
    ];
    const managementPath = snapshot.journals.management.path;
    put(
      managementPath,
      readFileSync(join(directory, managementPath), 'utf8') +
        Array.from({ length: 25 }, (_, i) => json({ event: 'management_attempt', ordinal: 228 + i })).join(
          '',
        ),
    );
    const refs = JSON.parse(
      readFileSync(join(sourceRoot, 'n8n/foundation/bindings.dev.json'), 'utf8'),
    ).workflowRefs;
    const control = [
      {
        event: 'control_request_intent',
        ordinal: 484,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3000).toISOString(),
      },
      {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3500).toISOString(),
      },
      ...Object.values(refs).flatMap((ref, i) =>
        [0, 1].map((j) => ({
          event: 'control_request_intent',
          ordinal: 485 + i * 2 + j,
          kind: 'discovery',
          workflowId: ref.id,
          at: new Date(start + 4000 + (i * 2 + j) * 100).toISOString(),
        })),
      ),
    ];
    if (preprivateAdminFault === 'start') control[2].kind = 'start';
    put(
      snapshot.journals.control.path,
      readFileSync(join(directory, snapshot.journals.control.path), 'utf8') + control.map(json).join(''),
    );
    if (preprivateAdminFault === 'auth') receipt.attempt.adminAuthentication = 'unknown';
    if (preprivateAdminFault === 'cleanup') receipt.cleanup.allThreeAbsent = false;
    if (preprivateAdminFault === 'diagnostic') receipt.additionalDiagnostic.credentialSupplied = true;
    if (preprivateAdminFault === 'usage') receipt.usage.carriedManagement = 10;
    if (preprivateAdminFault === 'raw') frames[7].windowClosed = true;
    if (preprivateAdminFault === 'child') closed.credentialChildrenClosed = false;
    if (preprivateAdminFault === 'setup')
      put(
        'scripts/n8n/out/foundation/live/setup.jsonl',
        readFileSync(join(directory, 'scripts/n8n/out/foundation/live/setup.jsonl'), 'utf8') +
          json({ event: 'setup_attempt', ordinal: 80, kind: 'GET', at: start }),
      );
    for (const [path, value] of [
      [base + '.json', admission],
      [base + '.runtime-claim.json', claim],
      [base + '.closed.json', closed],
      [base + '.public-frames.jsonl', frames.map(json).join('')],
    ])
      put(path, typeof value === 'string' ? value : json(value));
    for (const path of Object.keys(receipt.pins))
      receipt.pins[path] = digest(readFileSync(join(directory, path), 'utf8'));
    const text = json(receipt);
    put(relative, text);
    preprivateAdminConfiguration = { relative, sha256: digest(text) };
  }
  if (catalogReadonly) {
    const relative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical10-reconciliation-20261024.json';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    const root = `scripts/n8n/out/foundation/live/project-verified-continuation-${snapshot.proposedSegmentId}`;
    const base = root + '.technical-10',
      db = `scripts/db/out/m03-foundation-project-verified-continuation-${snapshot.proposedSegmentId}-technical-10`;
    const json = (v) => JSON.stringify(v) + '\n',
      start = receipt.attempt.startsAt;
    const admission = {
      ...JSON.parse(readFileSync(join(directory, root + '.technical-9.json'), 'utf8')),
      startsAt: start,
      deadlineAt: start + 3600000,
      stopNewAt: start + 3000000,
      hardDeadlineAt: start + 4200000,
      parentProcessId: 91017,
    };
    const claim = {
      ...JSON.parse(readFileSync(join(directory, root + '.technical-9.runtime-claim.json'), 'utf8')),
      admissionSha256: digest(json(admission)),
      processId: 91018,
      parentProcessId: 91017,
      claimedAt: start + 2000,
    };
    const close = {
      ...JSON.parse(readFileSync(join(directory, root + '.technical-9.closed.json'), 'utf8')),
      admissionSha256: digest(json(admission)),
      parentProcessId: 91017,
      runtimeProcessId: 91018,
      closedAt: receipt.attempt.closedAt,
    };
    Object.assign(receipt.attempt, { parentProcessId: 91017, runtimeProcessId: 91018 });
    receipt.adapterRecovery.sameParentProcessId = 91017;
    const frames = readFileSync(join(directory, root + '.technical-9.public-frames.jsonl'), 'utf8')
      .trimEnd()
      .split('\n')
      .map(JSON.parse);
    Object.assign(frames[0], {
      helperHead: receipt.source.head,
      technicalAttempt: 10,
      parentProcessId: 91017,
    });
    frames[1].nonce = 'c'.repeat(32);
    frames[4].nonce = 'd'.repeat(32);
    frames[3].deadlineAt = admission.deadlineAt;
    for (const frame of frames.slice(5, 8)) {
      frame.managementAttempts = 288;
      frame.controlAttempts = 588;
      delete frame.code;
    }
    frames[5].id = receipt.attempt.prepareCommand;
    frames[6].id = receipt.attempt.restoreCommand;
    frames[7] = structuredClone(receipt.raw);
    frames[8] = structuredClone(receipt.wrapper);
    const adminAttempt = {
      version: 1,
      runId: receipt.attempt.adminRunId,
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      segmentId: snapshot.proposedSegmentId,
      purpose: 'postcheck-only-continuation',
      createdAt: new Date(start + 100000).toISOString(),
    };
    const latest = {
      version: 1,
      runId: receipt.attempt.adminRunId,
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
      pendingVersions: [],
      phaseAControl: true,
      phaseACommands: 1,
      phaseAClosed: false,
      observedAt: new Date(start + 150000).toISOString(),
      postcheckContinuation: true,
      projectVerifiedContinuation: true,
      forwardWindow: true,
      activeWindowId: receipt.attempt.windowId,
      clockSegmentId: snapshot.proposedSegmentId,
      technicalAttemptOrdinal: 10,
      unprovisionedFixtureArchived: false,
      postcheckStage: 'catalog',
    };
    const managementPath = snapshot.journals.management.path;
    put(
      managementPath,
      readFileSync(join(directory, managementPath), 'utf8') +
        Array.from({ length: 25 }, (_, i) => json({ event: 'management_attempt', ordinal: 253 + i })).join(
          '',
        ),
    );
    const controlPath = snapshot.journals.control.path,
      prior = readFileSync(join(directory, controlPath), 'utf8').trimEnd().split('\n').map(JSON.parse);
    const added = [
      {
        event: 'control_request_intent',
        ordinal: 535,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3000).toISOString(),
      },
      {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3500).toISOString(),
      },
      ...prior
        .slice(-50)
        .map((row, i) => ({ ...row, ordinal: 536 + i, at: new Date(start + 4000 + i * 100).toISOString() })),
    ];
    if (catalogReadonlyFault === 'start') added[2].kind = 'start';
    if (catalogReadonlyFault === 'auth') latest.authenticationVerified = false;
    if (catalogReadonlyFault === 'push') latest.pushAttempted = true;
    if (catalogReadonlyFault === 'cleanup') receipt.cleanup.allTenLeavesAbsent = false;
    if (catalogReadonlyFault === 'vacancy') receipt.hostedReadback.launchCount = 1;
    if (catalogReadonlyFault === 'window') receipt.hostedReadback.freshWindowAbsent = false;
    if (catalogReadonlyFault === 'catalog') receipt.hostedReadback.catalogNoNewWindow = true;
    if (catalogReadonlyFault === 'usage') receipt.usage.carriedManagement = 10;
    if (catalogReadonlyFault === 'raw') frames[7].windowClosed = true;
    put(controlPath, readFileSync(join(directory, controlPath), 'utf8') + added.map(json).join(''));
    for (const [path, value] of [
      [base + '.json', admission],
      [base + '.runtime-claim.json', claim],
      [base + '.closed.json', close],
      [base + '.public-frames.jsonl', frames.map(json).join('')],
      [db + '-attempt.json', adminAttempt],
      [db + '-latest.json', latest],
    ])
      put(path, typeof value === 'string' ? value : json(value));
    for (const path of Object.keys(receipt.pins))
      receipt.pins[path] = digest(readFileSync(join(directory, path), 'utf8'));
    const text = json(receipt);
    put(relative, text);
    catalogReadonlyConfiguration = { relative, sha256: digest(text) };
  }
  if (catalogManagementAllocation) {
    const relative =
      'milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-approval-20261024.json';
    const packetRelative =
      'milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-20261024.md';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    const packet = readFileSync(join(sourceRoot, packetRelative), 'utf8');
    put(packetRelative, packet);
    receipt.referencePacket.sha256 = digest(packet);
    receipt.actualPriorUsage.reconciliationSha256 = catalogReadonlyConfiguration?.sha256 ?? '0'.repeat(64);
    receipt.recordedAt = '2026-10-24T02:39:00.000Z';
    if (catalogManagementAllocationFault === 'reply') receipt.ownerReply = 'Unapproved allowance';
    if (catalogManagementAllocationFault === 'source')
      receipt.referencePacket.sourceCommitSha = '0'.repeat(40);
    if (catalogManagementAllocationFault === 'usage') receipt.actualPriorUsage.management = 0;
    if (catalogManagementAllocationFault === 'maximum') receipt.allocation.managementMaximum = 705;
    if (catalogManagementAllocationFault === 'vercel') receipt.allocation.vercelMaximum = 133;
    if (catalogManagementAllocationFault === 'combined') receipt.unchangedCaps.combined = 2624;
    if (catalogManagementAllocationFault === 'reset') receipt.allocation.countersReset = true;
    if (catalogManagementAllocationFault === 'actor') receipt.unchangedCaps.actorStarts = 3;
    if (catalogManagementAllocationFault === 'boundary') receipt.boundaries.productionApproved = true;
    if (catalogManagementAllocationFault === 'extra') receipt.allocation.extraAllowance = true;
    const text = JSON.stringify(receipt) + '\n';
    put(relative, text);
    catalogManagementAllocationConfiguration = {
      relative,
      sha256: digest(text),
      packetRelative,
      packetSha256: digest(packet),
    };
  }
  if (adminAdmissionReadonly) {
    const relative =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical11-reconciliation-20261024.json';
    const receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8'));
    const root = `scripts/n8n/out/foundation/live/project-verified-continuation-${snapshot.proposedSegmentId}`;
    const base = root + '.technical-11';
    const json = (v) => JSON.stringify(v) + '\n',
      start = receipt.attempt.startsAt;
    const admission = {
      ...JSON.parse(readFileSync(join(directory, root + '.technical-10.json'), 'utf8')),
      startsAt: start,
      deadlineAt: start + 3600000,
      stopNewAt: start + 3000000,
      hardDeadlineAt: start + 4200000,
      parentProcessId: 91117,
    };
    const claim = {
      ...JSON.parse(readFileSync(join(directory, root + '.technical-10.runtime-claim.json'), 'utf8')),
      admissionSha256: digest(json(admission)),
      processId: 91118,
      parentProcessId: 91117,
      claimedAt: start + 2000,
    };
    const close = {
      ...JSON.parse(readFileSync(join(directory, root + '.technical-10.closed.json'), 'utf8')),
      admissionSha256: digest(json(admission)),
      parentProcessId: 91117,
      runtimeProcessId: 91118,
      closedAt: receipt.attempt.closedAt,
      credentialChildrenClosed: false,
    };
    Object.assign(receipt.attempt, { parentProcessId: 91117, runtimeProcessId: 91118 });
    receipt.rawTechnicalClose = structuredClone(close);
    const frames = readFileSync(join(directory, root + '.technical-10.public-frames.jsonl'), 'utf8')
      .trimEnd()
      .split('\n')
      .map(JSON.parse);
    Object.assign(frames[0], {
      helperHead: receipt.source.helperHead,
      technicalAttempt: 11,
      parentProcessId: 91117,
    });
    frames[1].nonce = 'e'.repeat(32);
    frames[4].nonce = 'f'.repeat(32);
    frames[3].deadlineAt = admission.deadlineAt;
    for (const frame of frames.slice(5, 8)) {
      frame.managementAttempts = 313;
      frame.controlAttempts = 639;
      delete frame.code;
    }
    frames[5].id = receipt.attempt.prepareId;
    frames[6].id = receipt.attempt.restoreId;
    frames[7] = structuredClone(receipt.rawSourceClose);
    frames[8] = structuredClone(receipt.rawWrapperClose);
    const managementPath = snapshot.journals.management.path;
    put(
      managementPath,
      readFileSync(join(directory, managementPath), 'utf8') +
        Array.from({ length: 25 }, (_, i) => json({ event: 'management_attempt', ordinal: 278 + i })).join(
          '',
        ),
    );
    const controlPath = snapshot.journals.control.path,
      prior = readFileSync(join(directory, controlPath), 'utf8').trimEnd().split('\n').map(JSON.parse);
    const added = [
      {
        event: 'control_request_intent',
        ordinal: 586,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3000).toISOString(),
      },
      {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3500).toISOString(),
      },
      ...prior
        .slice(-50)
        .map((row, i) => ({ ...row, ordinal: 587 + i, at: new Date(start + 4000 + i * 100).toISOString() })),
    ];
    if (adminAdmissionReadonlyFault === 'start') added[2].kind = 'start';
    if (adminAdmissionReadonlyFault === 'auth') receipt.localCause.databaseAuthenticationAttempted = true;
    if (adminAdmissionReadonlyFault === 'spawn') receipt.localCause.adminChildSpawned = true;
    if (adminAdmissionReadonlyFault === 'cleanup') receipt.cleanup.allTenLeavesAbsent = false;
    if (adminAdmissionReadonlyFault === 'usage') receipt.usage.carriedManagement = 10;
    if (adminAdmissionReadonlyFault === 'raw') frames[7].adminChildClosed = true;
    if (adminAdmissionReadonlyFault === 'code') frames[5].code = 'UNESTABLISHED';
    put(controlPath, readFileSync(join(directory, controlPath), 'utf8') + added.map(json).join(''));
    for (const [path, value] of [
      [base + '.json', admission],
      [base + '.runtime-claim.json', claim],
      [base + '.closed.json', close],
      [base + '.public-frames.jsonl', frames.map(json).join('')],
    ])
      put(path, typeof value === 'string' ? value : json(value));
    for (const path of Object.keys(receipt.pins))
      receipt.pins[path] = digest(readFileSync(join(directory, path), 'utf8'));
    const text = json(receipt);
    put(relative, text);
    adminAdmissionReadonlyConfiguration = { relative, sha256: digest(text) };
  }
  if (runtimePreparationClosed) {
    const relative =
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical12-reconciliation-20261024.json',
      diagnosticRelative = 'milestones/M03-n8n-foundation/evidence/machine-metadata-readback-20261024.json',
      receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8')),
      diagnostic = JSON.parse(readFileSync(join(sourceRoot, diagnosticRelative), 'utf8')),
      json = (v) => JSON.stringify(v) + '\n',
      prefix = `scripts/n8n/out/foundation/live/project-verified-continuation-${snapshot.proposedSegmentId}`,
      base = prefix + '.technical-12',
      db = `scripts/db/out/m03-foundation-project-verified-continuation-${snapshot.proposedSegmentId}-technical-12`,
      start = receipt.attempt.startsAt;
    const admission = {
      ...JSON.parse(readFileSync(join(directory, prefix + '.technical-11.json'), 'utf8')),
      startsAt: start,
      deadlineAt: start + 3600000,
      stopNewAt: start + 3000000,
      hardDeadlineAt: start + 4200000,
      parentProcessId: 91217,
    };
    const claim = {
      ...JSON.parse(readFileSync(join(directory, prefix + '.technical-11.runtime-claim.json'), 'utf8')),
      admissionSha256: digest(json(admission)),
      processId: 91218,
      parentProcessId: 91217,
      claimedAt: start + 2000,
    };
    Object.assign(receipt.attempt, { parentProcessId: 91217, runtimeProcessId: 91218 });
    const close = {
      ...receipt.rawTechnicalClose,
      admissionSha256: digest(json(admission)),
      parentProcessId: 91217,
      runtimeProcessId: 91218,
    };
    receipt.rawTechnicalClose = structuredClone(close);
    const frames = readFileSync(join(directory, prefix + '.technical-11.public-frames.jsonl'), 'utf8')
      .trimEnd()
      .split('\n')
      .map(JSON.parse);
    Object.assign(frames[0], {
      helperHead: receipt.source.helperHead,
      technicalAttempt: 12,
      parentProcessId: 91217,
    });
    frames[1].nonce = '1'.repeat(32);
    frames[4].nonce = '2'.repeat(32);
    frames[3].deadlineAt = admission.deadlineAt;
    frames[5] = structuredClone(receipt.rawPrepare);
    frames[6] = structuredClone(receipt.rawRestore);
    frames[7] = structuredClone(receipt.rawSourceClose);
    frames[8] = structuredClone(receipt.rawWrapperClose);
    const managementPath = snapshot.journals.management.path,
      controlPath = snapshot.journals.control.path,
      setupPath = snapshot.journals.setup.path,
      preflightPath = 'scripts/n8n/out/foundation/live/preflight.jsonl';
    put(
      managementPath,
      readFileSync(join(directory, managementPath), 'utf8') +
        Array.from({ length: 87 }, (_, i) => json({ event: 'management_attempt', ordinal: 303 + i })).join(
          '',
        ),
    );
    const controls = readFileSync(join(directory, controlPath), 'utf8').trimEnd().split('\n').map(JSON.parse),
      ids = controls.slice(-50).map((v) => v.workflowId);
    const additions = [
      {
        event: 'control_request_intent',
        ordinal: 637,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3000).toISOString(),
      },
      {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(start + 3500).toISOString(),
      },
      ...Array.from({ length: 100 }, (_, i) => ({
        event: 'control_request_intent',
        ordinal: 638 + i,
        kind: 'discovery',
        workflowId: ids[i % 50],
        at: new Date(start + 4000 + i * 100).toISOString(),
      })),
    ];
    put(controlPath, readFileSync(join(directory, controlPath), 'utf8') + additions.map(json).join(''));
    const setup = readFileSync(join(directory, setupPath), 'utf8').trimEnd().split('\n').map(JSON.parse),
      addedSetup = setup
        .slice(-71)
        .map((v) =>
          JSON.parse(
            JSON.stringify(v)
              .replaceAll('38b3708d-61b0-41d2-8170-5ed91c66b4dc', receipt.attempt.windowId)
              .replaceAll('synthetic38b', 'syntheticEda12'),
          ),
        );
    let ordinal = 79;
    for (const row of addedSetup) {
      if (row.event === 'setup_attempt') row.ordinal = ++ordinal;
      if (typeof row.at === 'number') row.at = start + 5000;
    }
    put(setupPath, setup.map(json).join('') + addedSetup.map(json).join(''));
    const audience = receipt.gateway.audience,
      windowId = receipt.attempt.windowId;
    const preflight = [
      {
        event: 'gateway_probe_intent',
        ordinal: 3,
        requestId: '00000000-0000-4000-8000-000000000031',
        unauthorized: false,
        operation: 'identity.read',
        audience,
        at: new Date(start + 10000).toISOString(),
      },
      {
        event: 'gateway_probe_intent',
        ordinal: 4,
        requestId: '00000000-0000-4000-8000-000000000032',
        unauthorized: true,
        operation: 'identity.read',
        audience,
        at: new Date(start + 11000).toISOString(),
      },
      {
        event: 'gateway_probe_verified',
        identityVerified: true,
        unauthorizedVerified: true,
        audience,
        at: new Date(start + 12000).toISOString(),
      },
      {
        event: 'foundation_writer_close_intent',
        windowId,
        requestId: '00000000-0000-4000-8000-000000000021',
        audience,
        sourceCommitSha: receipt.source.applicationSource,
        deploymentId: receipt.gateway.deploymentId,
        at: new Date(start + 13000).toISOString(),
      },
      {
        event: 'foundation_writer_close_verified',
        windowId,
        identityVerified: true,
        bindingVerified: true,
        closeAcknowledged: true,
        connectionClosed: true,
        at: new Date(start + 14000).toISOString(),
      },
    ];
    put(preflightPath, readFileSync(join(directory, preflightPath), 'utf8') + preflight.map(json).join(''));
    const runtime = [
      {
        event: 'file_header',
        version: 1,
        planHash: 'f028080fcf89583244bddcfb340a3f61b75217349ee63fa61c90046c153c3c80',
        deadlineAt: admission.deadlineAt,
      },
      {
        event: 'header',
        version: 1,
        planHash: 'f028080fcf89583244bddcfb340a3f61b75217349ee63fa61c90046c153c3c80',
      },
      ...[
        '/api/v1/credentials/schema/httpCustomAuth',
        '/api/v1/credentials/EmrM03Machine19',
        ...[...new Set(ids)].map((id) => '/api/v1/workflows/' + id + '?excludePinnedData=true'),
      ].map((path, i) => ({ event: 'request', number: i + 1, method: 'GET', path })),
      { event: 'restore_complete' },
    ];
    const latest = {
      version: 1,
      ...receipt.database,
      environment: 'dev',
      projectRef: receipt.projectRef,
      host: 'aws-1-eu-central-1.pooler.supabase.com',
      port: 5432,
      activeWindowId: windowId,
      technicalAttemptOrdinal: 12,
      phaseAClosed: true,
    };
    const values = {
      [base + '.json']: admission,
      [base + '.runtime-claim.json']: claim,
      [base + '.closed.json']: close,
      [base + '.public-frames.jsonl']: frames.map(json).join(''),
      [db + '-attempt.json']: {
        version: 1,
        runId: receipt.database.runId,
        projectRef: receipt.projectRef,
        segmentId: snapshot.proposedSegmentId,
        purpose: 'postcheck-only-continuation',
      },
      [db + '-latest.json']: latest,
      [db + '-owner-provision-attempt.json']: {
        version: 1,
        runId: receipt.database.runId,
        windowId,
        packet: {
          audience,
          commitSha: receipt.source.applicationSource,
          deploymentId: receipt.gateway.deploymentId,
          actorBuild: '0.3.99',
          approvalReference: 'M03-A-D-f42930f-20261021',
          maxTotalChargeUsd: 1,
          batchMaxUsd: 2,
        },
      },
      [db + '-reactivation-attempt.json']: {
        version: 1,
        runId: receipt.database.runId,
        segmentId: snapshot.proposedSegmentId,
        competitorId: 'd51a39f6-fe87-4d17-aee9-3070c45693aa',
        accountId: 'bd23314c-591f-4fb7-92fd-b7450634eeb6',
      },
      ['scripts/n8n/out/foundation/live/runtime.technical-12.jsonl']: runtime.map(json).join(''),
    };
    if (runtimePreparationFault === 'closure') receipt.rawSourceClose.windowClosed = false;
    if (runtimePreparationFault === 'actor') receipt.usage.actorStarts = 1;
    if (runtimePreparationFault === 'replay') latest.pushAttempted = true;
    if (runtimePreparationFault === 'runtime-write') runtime[2].method = 'PATCH';
    if (runtimePreparationFault === 'audit')
      values[db + '-reactivation-attempt.json'].accountId = '00000000-0000-4000-8000-000000000000';
    if (runtimePreparationFault === 'diagnostic-charge') diagnostic.usage.management = 400;
    if (runtimePreparationFault === 'diagnostic-tls')
      diagnostic.actualNativeResult.inventory.diagnostics.requests[0].tlsVerified = false;
    values['scripts/n8n/out/foundation/live/runtime.technical-12.jsonl'] = runtime.map(json).join('');
    for (const [path, value] of Object.entries(values))
      put(path, typeof value === 'string' ? value : json(value));
    for (const path of Object.keys(receipt.pins))
      receipt.pins[path] = digest(readFileSync(join(directory, path), 'utf8'));
    const text = json(receipt);
    put(relative, text);
    put(
      managementPath,
      readFileSync(join(directory, managementPath), 'utf8') +
        json({ event: 'management_attempt', ordinal: 390 }),
    );
    diagnostic.pins[managementPath] = digest(readFileSync(join(directory, managementPath), 'utf8'));
    diagnostic.pins[controlPath] = receipt.pins[controlPath];
    const diagnosticText = json(diagnostic);
    put(diagnosticRelative, diagnosticText);
    runtimePreparationConfiguration = {
      relative,
      sha256: digest(text),
      diagnosticRelative,
      diagnosticSha256: digest(diagnosticText),
    };
  }
  if (runtimeMetadataAllocation) {
    const relative =
        'milestones/M03-n8n-foundation/evidence/remaining-allocation-after-runtime-metadata-approval-20261024.json',
      receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8')),
      packetRelative = receipt.referencePacket.path,
      packet = 'Synthetic qualified metadata continuation allocation\n';
    put(packetRelative, packet);
    receipt.referencePacket.sha256 = digest(packet);
    receipt.actualPriorUsage.reconciliationSha256 = runtimePreparationConfiguration.sha256;
    receipt.actualPriorUsage.metadataReadbackSha256 = runtimePreparationConfiguration.diagnosticSha256;
    if (runtimeMetadataAllocationFault === 'maximum') receipt.allocation.managementMaximum = 833;
    if (runtimeMetadataAllocationFault === 'vercel') receipt.allocation.vercelMaximum = 177;
    if (runtimeMetadataAllocationFault === 'usage') receipt.actualPriorUsage.management = 400;
    if (runtimeMetadataAllocationFault === 'actor') receipt.unchangedCaps.actorStarts = 3;
    if (runtimeMetadataAllocationFault === 'boundary') receipt.boundaries.productionApproved = true;
    if (runtimeMetadataAllocationFault === 'window')
      receipt.approvedFreshWindow.id = 'eda4fae1-1e19-47db-81b8-beac1a4ed883';
    const text = JSON.stringify(receipt) + '\n';
    put(relative, text);
    runtimeMetadataAllocationConfiguration = {
      relative,
      sha256: digest(text),
      ownerReply: receipt.ownerReply,
      packetRelative,
      packetSha256: digest(packet),
    };
  }
  if (runtimeRestorationClosed) {
    const relative =
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json',
      readbackRelative =
        'milestones/M03-n8n-foundation/evidence/runtime-reconciliation-readback-20261024.json',
      restorationRelative = 'milestones/M03-n8n-foundation/evidence/runtime-restoration-20261024.json',
      archiveRelative =
        'milestones/M03-n8n-foundation/evidence/runtime-restoration-fixture-archive-20261024.json',
      cleanupRelative = 'milestones/M03-n8n-foundation/evidence/runtime-restoration-cleanup-20261024.json',
      r = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8')),
      d = JSON.parse(readFileSync(join(sourceRoot, readbackRelative), 'utf8')),
      s = JSON.parse(readFileSync(join(sourceRoot, restorationRelative), 'utf8')),
      a = JSON.parse(readFileSync(join(sourceRoot, archiveRelative), 'utf8')),
      z = JSON.parse(readFileSync(join(sourceRoot, cleanupRelative), 'utf8')),
      json = (v) => JSON.stringify(v) + '\n',
      root = `scripts/n8n/out/foundation/live/project-verified-continuation-${snapshot.proposedSegmentId}.technical-13`,
      db = `scripts/db/out/m03-foundation-project-verified-continuation-${snapshot.proposedSegmentId}-technical-13`,
      liveRoot = 'scripts/n8n/out/foundation/live/',
      load = (path) => readFileSync(join(directory, path), 'utf8'),
      rows = (path) => load(path).trimEnd().split('\n').map(JSON.parse),
      writeRows = (path, value) => put(path, value.map(json).join(''));
    const { fixture } = await import('./foundation-live-runtime-fixtures.mjs'),
      { createFoundationRuntimePlan } = await import('./foundation-runtime-plan.mjs'),
      runtime = await import('./foundation-runtime-control.mjs'),
      { prepareFoundationRuntimeMachinePatch } = await import('./foundation-runtime-machine.mjs');
    const f = fixture();
    let originalRuntime, recoveryRows, restoredVersions;
    try {
      const plan = createFoundationRuntimePlan({
          ...f.input,
          activeWindowId: r.attempt.windowId,
          setup: {
            ...f.input.setup,
            sourceCommitSha: r.source.applicationSource,
            audience: r.provisionAttempt.packet.audience,
            deploymentId: r.provisionAttempt.packet.deploymentId,
          },
        }),
        old = runtime.createFoundationRuntimeJournal(plan, [], () => {});
      let lost = false;
      const send = async (method, path, body) => {
        const response = await f.dependencies.send(method, path, body);
        if (
          !lost &&
          method === 'PUT' &&
          path.includes('/tiEhU3dXrMifOnTL?') &&
          body.settings.errorWorkflow === 'S9NHRkKFUIiXX2wv'
        ) {
          lost = true;
          throw Error('SYNTHETIC_UNKNOWN_SETTINGS_ACK');
        }
        return response;
      };
      const prepareMachinePatch = ({ audience, restore }) =>
        prepareFoundationRuntimeMachinePatch({
          audience,
          restore,
          machineToken: f.input.machineToken,
          ...(restore ? {} : { protectionBypass: f.input.protectionBypass }),
        });
      const failed = await runtime.runFoundationRuntimeSetup(plan, {
        journal: old,
        send,
        prepareMachinePatch,
        admitManagementAttempt() {},
      });
      if (failed.status !== 'reconciliation_required' || !lost)
        throw Error('SYNTHETIC_ORIGINAL13_NOT_REPRODUCED');
      const historical = old.rows
        .filter((row) => row.event !== 'request' || row.number > 25)
        .map((row) => {
          const copy = structuredClone(row);
          if (copy.event === 'request') copy.number -= 25;
          if (copy.event === 'intent' && copy.sequence === 7) copy.target.versionId = null;
          return copy;
        });
      originalRuntime = [
        { event: 'file_header', version: 1, planHash: plan.planHash, deadlineAt: r.rawAdmission.deadlineAt },
        ...historical,
      ];
      const fresh = [],
        journal = runtime.createFoundationRuntimeJournal(plan, historical, (row) => {
          fresh.push(row);
        }),
        ports = { journal, send, prepareMachinePatch, admitManagementAttempt() {} };
      const adopted = await runtime.adoptFoundationRuntimeSettingsSaveForRestoration(plan, ports),
        restored = await runtime.restoreFoundationRuntime(plan, ports);
      if (
        adopted.status !== 'settings_save_readback_verified_original_ack_unknown' ||
        restored.status !== 'exact_staging_restored_unpublished'
      )
        throw Error('SYNTHETIC_RESTORATION_NOT_VERIFIED');
      recoveryRows = fresh;
      const state = runtime.foundationRuntimeState(plan, journal);
      restoredVersions = Object.fromEntries(
        ['SUB-NOTIFY', 'WF-90'].map((key) => [key, state.workflows[key].versionId]),
      );
      for (const [key, record] of f.input.records.map((record) => [
        Object.keys(f.input.bindings.workflowRefs).find(
          (key) => f.input.bindings.workflowRefs[key].id === record.id,
        ),
        record,
      ]))
        put('n8n/workflows/' + key + '.json', json(record));
      put('n8n/foundation/bindings.dev.json', json(f.input.bindings));
      put('n8n/foundation/transport.dev.json', json(f.input.transport));
    } finally {
      f.cleanup();
    }
    writeRows(liveRoot + 'runtime.technical-13.jsonl', originalRuntime);
    const managementPath = snapshot.journals.management.path,
      controlPath = snapshot.journals.control.path,
      setupPath = snapshot.journals.setup.path,
      preflightPath = liveRoot + 'preflight.jsonl';
    writeRows(managementPath, [
      ...rows(managementPath),
      ...Array.from({ length: 82 }, (_, i) => ({ event: 'management_attempt', ordinal: 391 + i })),
    ]);
    const controls = rows(controlPath),
      ids = [
        ...new Set(controls.filter((v) => v.event === 'control_request_intent').map((v) => v.workflowId)),
      ].slice(0, 25);
    writeRows(controlPath, [
      ...controls,
      {
        event: 'control_request_intent',
        ordinal: 738,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: '2026-10-24T10:54:00.000Z',
      },
      {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: '2026-10-24T10:54:00.100Z',
      },
      ...Array.from({ length: 50 }, (_, i) => ({
        event: 'control_request_intent',
        ordinal: 739 + i,
        kind: 'discovery',
        workflowId: ids[i % 25],
        at: '2026-10-24T10:54:01.000Z',
      })),
    ]);
    const setups = rows(setupPath),
      newSetup = setups
        .slice(-71)
        .map((v) =>
          JSON.parse(
            JSON.stringify(v)
              .replaceAll('eda4fae1-1e19-47db-81b8-beac1a4ed883', r.attempt.windowId)
              .replaceAll('syntheticEda12', 'synthetic3c13'),
          ),
        );
    let setupOrdinal = 114;
    for (const row of newSetup) {
      if (row.event === 'setup_attempt') row.ordinal = ++setupOrdinal;
      if (typeof row.at === 'number') row.at = r.attempt.startsAt + 5000;
    }
    writeRows(setupPath, [...setups, ...newSetup]);
    const preflight = rows(preflightPath),
      newPreflight = preflight
        .slice(-5)
        .map((v) =>
          JSON.parse(
            JSON.stringify(v)
              .replaceAll('eda4fae1-1e19-47db-81b8-beac1a4ed883', r.attempt.windowId)
              .replaceAll('aff94f2b2d8055cf93b5405e6b11d4e7d9c86803', r.source.applicationSource),
          ),
        );
    newPreflight[0].ordinal = 5;
    newPreflight[1].ordinal = 6;
    writeRows(preflightPath, [...preflight, ...newPreflight]);
    r.rawAdmission.approvalSha256 = digest(approvalText);
    const admissionText = json(r.rawAdmission);
    r.rawRuntimeClaim.admissionSha256 = digest(admissionText);
    r.rawTechnicalClose.admissionSha256 = digest(admissionText);
    put(root + '.json', admissionText);
    put(root + '.runtime-claim.json', json(r.rawRuntimeClaim));
    put(root + '.closed.json', json(r.rawTechnicalClose));
    const frames = rows(root.replace('.technical-13', '.technical-12') + '.public-frames.jsonl');
    Object.assign(frames[0], {
      helperHead: r.source.helperHead,
      applicationSource: r.source.applicationSource,
      technicalAttempt: 13,
      parentProcessId: r.attempt.parentProcessId,
      windowId: r.attempt.windowId,
    });
    frames[3].deadlineAt = r.rawAdmission.deadlineAt;
    [r.rawPrepare, r.rawRestore, r.rawSourceClose, r.rawWrapperClose].forEach((v, i) => {
      frames[i + 5] = structuredClone(v);
    });
    writeRows(root + '.public-frames.jsonl', frames);
    put(
      db + '-attempt.json',
      json({
        version: 1,
        runId: r.database.runId,
        projectRef: r.projectRef,
        segmentId: snapshot.proposedSegmentId,
        purpose: 'postcheck-only-continuation',
      }),
    );
    put(db + '-latest.json', json(r.rawDatabaseLatest));
    put(db + '-owner-provision-attempt.json', json(r.provisionAttempt));
    put(db + '-reactivation-attempt.json', json(r.reactivationAttempt));
    for (const path of Object.keys(r.pins)) r.pins[path] = digest(load(path));
    if (runtimeRestorationFault === 'raw-closure') r.rawTechnicalClose.closureVerified = true;
    const originalText = json(r);
    put(relative, originalText);
    writeRows(managementPath, [
      ...rows(managementPath),
      ...Array.from({ length: 3 }, (_, i) => ({ event: 'management_attempt', ordinal: 473 + i })),
    ]);
    d.originalAttemptReceiptSha256 = digest(originalText);
    d.pins[relative] = digest(originalText);
    d.pins[managementPath] = digest(load(managementPath));
    d.pins[controlPath] = digest(load(controlPath));
    const diagnosticPath =
      'scripts/n8n/out/foundation/runtime-reconciliation-diagnostic-technical13-20261024.jsonl';
    put(
      diagnosticPath,
      json({
        kind: 'm03_runtime_reconciliation_diagnostic',
        version: 1,
        technicalAttempt: 13,
        receiptSha256: digest(originalText),
        managementAttempts: 483,
        controlAttempts: 791,
        maximumRequests: 3,
        processId: 91301,
        parentProcessId: 91302,
      }),
    );
    d.pins[diagnosticPath] = digest(load(diagnosticPath));
    d.pins[liveRoot + 'runtime.technical-13.jsonl'] = r.pins[liveRoot + 'runtime.technical-13.jsonl'];
    if (runtimeRestorationFault === 'readback')
      d.actualNativeResult.inventory.workflows['SUB-NOTIFY'].targetGraphEqual = false;
    const readbackText = json(d);
    put(readbackRelative, readbackText);
    const recoveryPath = 'scripts/n8n/out/foundation/runtime-technical13-restoration.jsonl';
    const recovery = [
      {
        kind: 'm03_technical13_restore_journal',
        version: 1,
        sourceRuntime: liveRoot + 'runtime.technical-13.jsonl',
        sourceRuntimeSha256: r.pins[liveRoot + 'runtime.technical-13.jsonl'],
        sourceRuntimeRows: 38,
        receiptSha256: digest(originalText),
        readbackSha256: digest(readbackText),
      },
      ...recoveryRows,
    ];
    if (runtimeRestorationFault === 'recovery-version')
      recovery.find((v) => v.event === 'verified' && v.sequence === 9).after.versionId = null;
    if (runtimeRestorationFault === 'recovery-replay') recovery[1].method = 'PUT';
    writeRows(recoveryPath, recovery);
    const restoreAttempt = 'scripts/n8n/out/foundation/runtime-technical13-restoration-attempt.json',
      restoreResult = 'scripts/n8n/out/foundation/runtime-technical13-restoration-result.json';
    put(
      restoreAttempt,
      json({
        kind: 'm03_technical13_restore_intent',
        version: 1,
        receiptSha256: digest(originalText),
        readbackSha256: digest(readbackText),
        oldRuntimeSha256: r.pins[liveRoot + 'runtime.technical-13.jsonl'],
        oldRuntimeRows: 38,
        managementAttempts: 486,
        controlAttempts: 791,
        maximumManagementRequests: 40,
        maximumControlRequests: 50,
        processId: 91303,
        parentProcessId: 91304,
        at: '2026-10-24T11:33:45.493Z',
      }),
    );
    writeRows(managementPath, [
      ...rows(managementPath),
      ...Array.from({ length: 38 }, (_, i) => ({ event: 'management_attempt', ordinal: 476 + i })),
    ]);
    writeRows(controlPath, [
      ...rows(controlPath),
      ...Array.from({ length: 50 }, (_, i) => ({
        event: 'control_request_intent',
        ordinal: 789 + i,
        kind: 'discovery',
        workflowId: ids[i % 25],
        at: '2026-10-24T11:34:10.000Z',
      })),
    ]);
    s.originalAttemptReceiptSha256 = digest(originalText);
    s.readbackReceiptSha256 = digest(readbackText);
    const result = Object.fromEntries(
      Object.entries(s).filter(
        ([key]) =>
          ![
            'observedAt',
            'toolReceipt',
            'outerNativeExit',
            'publicSealTool',
            'publicCheckOnlyTool',
            'originalAttemptReceiptSha256',
            'readbackReceiptSha256',
            'aclTighteningReceiptSha256',
            'sourceQualification',
            'pins',
            'interpretation',
          ].includes(key),
      ),
    );
    put(restoreResult, json(result));
    for (const path of [
      restoreAttempt,
      restoreResult,
      recoveryPath,
      managementPath,
      controlPath,
      liveRoot + 'runtime.technical-13.jsonl',
    ])
      s.pins[path] = digest(load(path));
    if (runtimeRestorationFault === 'settlement') s.remoteWorkSettled = false;
    if (runtimeRestorationFault === 'usage') s.managementAttempts = 523;
    const restorationText = json(s);
    put(restorationRelative, restorationText);
    const archivePaths = Object.keys(a.pins).filter((path) => path.startsWith('scripts/db/out/'));
    for (const path of archivePaths)
      put(
        path,
        json(
          path.endsWith('-latest.json')
            ? a.actualNativeResult
            : {
                version: 1,
                runId: a.actualNativeResult.runId,
                projectRef: r.projectRef,
                windowId: r.attempt.windowId,
                purpose: 'exact-owned-fixture-archive-after-independent-close',
              },
        ),
      );
    for (const path of archivePaths) a.pins[path] = digest(load(path));
    a.pins[restorationRelative] = digest(restorationText);
    if (runtimeRestorationFault === 'archive')
      a.actualNativeResult.archiveAfter.fixture.competitorArchived = false;
    const archiveText = json(a);
    put(archiveRelative, archiveText);
    z.runtimeRestorationReceiptSha256 = digest(restorationText);
    z.fixtureArchiveReceiptSha256 = digest(archiveText);
    if (runtimeRestorationFault === 'cleanup') z.actualNativeResult.allDisposableLeavesAbsent = false;
    const cleanupText = json(z);
    put(cleanupRelative, cleanupText);
    runtimeRestorationConfiguration = {
      relative,
      sha256: digest(originalText),
      readbackRelative,
      readbackSha256: digest(readbackText),
      restorationRelative,
      restorationSha256: digest(restorationText),
      archiveRelative,
      archiveSha256: digest(archiveText),
      cleanupRelative,
      cleanupSha256: digest(cleanupText),
    };
    if (runtimeRestorationAllocation) {
      const relative =
          'milestones/M03-n8n-foundation/evidence/remaining-allocation-after-runtime-restoration-approval-20261024.json',
        approval = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8')),
        packetRelative = approval.referencePacket.path,
        packet = 'Synthetic post-restoration allocation\n';
      put(packetRelative, packet);
      approval.referencePacket.sha256 = digest(packet);
      Object.assign(approval.actualPriorUsage, {
        runtimeRestorationSha256: digest(restorationText),
        fixtureArchiveSha256: digest(archiveText),
        cleanupSha256: digest(cleanupText),
      });
      if (runtimeRestorationAllocationFault === 'maximum') approval.allocation.managementMaximum = 1025;
      if (runtimeRestorationAllocationFault === 'vercel') approval.allocation.vercelMaximum = 225;
      if (runtimeRestorationAllocationFault === 'usage') approval.actualPriorUsage.management = 523;
      if (runtimeRestorationAllocationFault === 'actor') approval.unchangedCaps.actorStarts = 3;
      if (runtimeRestorationAllocationFault === 'boundary') approval.boundaries.productionApproved = true;
      if (runtimeRestorationAllocationFault === 'window')
        approval.continuation.plannedWindowId = r.attempt.windowId;
      const text = json(approval);
      put(relative, text);
      runtimeRestorationAllocationConfiguration = {
        relative,
        sha256: digest(text),
        packetRelative,
        packetSha256: digest(packet),
      };
    }
    void restoredVersions;
  }
  for (const ordinal of restoredBrowserDiscovery ? (restoredBrowserRetryDiscovery ? [14, 15] : [14]) : []) {
    const fault = ordinal === 14 ? restoredBrowserDiscoveryFault : restoredBrowserRetryDiscoveryFault;
    const relative = `milestones/M03-n8n-foundation/evidence/dev-acceptance-technical${ordinal}-reconciliation-20261024.json`,
      cleanupRelative = `milestones/M03-n8n-foundation/evidence/dev-acceptance-technical${ordinal}-cleanup-20261024.json`,
      receipt = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8')),
      cleanup = JSON.parse(readFileSync(join(sourceRoot, cleanupRelative), 'utf8')),
      json = (value) => JSON.stringify(value) + '\n',
      base = `scripts/n8n/out/foundation/live/project-verified-continuation-${snapshot.proposedSegmentId}.technical-${ordinal}`,
      startsAt = Date.parse(ordinal === 14 ? '2026-10-24T15:01:00.000Z' : '2026-10-24T15:12:00.000Z'),
      admission = {
        ...receipt.rawAdmission,
        approvalSha256: digest(approvalText),
        startsAt,
        deadlineAt: startsAt + 3600000,
        stopNewAt: startsAt + 3000000,
        hardDeadlineAt: startsAt + 4200000,
        parentProcessId: ordinal === 14 ? 91040 : 91042,
      },
      claim = {
        ...receipt.rawRuntimeClaim,
        admissionSha256: digest(json(admission)),
        processId: ordinal === 14 ? 91041 : 91043,
        parentProcessId: admission.parentProcessId,
        claimedAt: startsAt + 1000,
      },
      closed = {
        ...receipt.rawTechnicalClose,
        admissionSha256: claim.admissionSha256,
        parentProcessId: admission.parentProcessId,
        runtimeProcessId: claim.processId,
        closedAt: startsAt + 60000,
      };
    receipt.rawAdmission = admission;
    receipt.rawRuntimeClaim = claim;
    receipt.rawTechnicalClose = closed;
    Object.assign(receipt.attempt, {
      startsAt,
      deadlineAt: admission.deadlineAt,
      parentProcessId: admission.parentProcessId,
      runtimeProcessId: claim.processId,
    });
    if (fault === 'execution') receipt.attempt.nativeExecutions = 1;
    if (fault === 'write') receipt.attempt.workflowWriteAttempted = true;
    if (fault === 'admin') receipt.attempt.adminChildStarted = true;
    if (fault === 'usage') receipt.usage.control = 841;
    if (fault === 'raw-closure') closed.closureVerified = true;
    if (fault === 'window') receipt.attempt.windowId = snapshot.windowId;
    if (fault === 'late-response') receipt.browser.responseArrivedAfterDiscoveryDeadline = false;
    if (fault === 'source') receipt.source.helperHead = '0'.repeat(40);
    const controlPath = snapshot.journals.control.path,
      discovery = {
        event: 'control_request_intent',
        ordinal: ordinal === 14 ? 839 : 840,
        kind: 'discovery',
        workflowId: 'MzimjpsuyPuK7SKe',
        at: new Date(startsAt + 6000).toISOString(),
      };
    if (fault === 'control-kind') discovery.kind = 'execution_start';
    if (fault === 'control-workflow') discovery.workflowId = 'SYNTHETIC_FOREIGN';
    put(controlPath, readFileSync(join(directory, controlPath), 'utf8') + json(discovery));
    const frames = [
      {
        kind: 'm03_live_coordinator_checkpoint',
        technicalAttempt: ordinal,
        helperHead: receipt.source.helperHead,
        ciRunId: receipt.source.ciRunId,
        allFiveJobsPassed: true,
        vercelPassed: true,
        applicationSource: admission.sourceCommitSha,
        sourceCiRunId: 40103108266,
        windowId: admission.windowId,
        managementAttempts: 524,
        controlAttempts: ordinal === 14 ? 841 : 842,
        combinedAttempts: ordinal === 14 ? 1365 : 1366,
        vercelAttempts: 149,
        actorStarts: 0,
        observedAt: new Date(startsAt - 1000).toISOString(),
        parentProcessId: admission.parentProcessId,
      },
      ...(ordinal === 14 ? [receipt.coordinatorLocalLaunchRefusal] : []),
      {
        kind: 'm03_acceptance_transport_ready',
        nonce: 'a'.repeat(32),
        privateRead: false,
        networkRequests: 0,
      },
      {
        kind: 'm03_acceptance_vercel_metadata',
        status: 'metadata_covers_75_minutes',
        metadataValid: true,
        unexpired: true,
        covers75Minutes: true,
        effectiveBackendEstablished: false,
        networkRequests: 0,
        authenticationAttempted: false,
        refreshAttempted: false,
        configWritten: false,
        childClosed: true,
      },
      {
        kind: 'm03_acceptance_ready',
        status: 'private_child_ready',
        deadlineAt: admission.deadlineAt,
        approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
        sourceCommitSha: admission.sourceCommitSha,
      },
      {
        kind: 'mcp_port_request',
        nonce: 'b'.repeat(32),
        action: 'browser_discover',
        workflowId: 'MzimjpsuyPuK7SKe',
      },
      receipt.rawPrepare,
      receipt.rawSourceClose,
      receipt.rawWrapperClose,
    ];
    if (fault === 'frame') {
      const i = ordinal === 14 ? 6 : 5;
      frames[i] = { ...frames[i], command: 'execute' };
    }
    for (const [suffix, value] of [
      ['.json', admission],
      ['.runtime-claim.json', claim],
      ['.closed.json', closed],
    ])
      put(base + suffix, json(value));
    put(base + '.public-frames.jsonl', frames.map(json).join(''));
    for (const path of Object.keys(receipt.pins))
      receipt.pins[path] = digest(readFileSync(join(directory, path), 'utf8'));
    const receiptText = json(receipt);
    put(relative, receiptText);
    cleanup.attemptReceiptSha256 = digest(receiptText);
    if (fault === 'cleanup') cleanup.allTenDisposableLeavesAbsent = false;
    const cleanupText = json(cleanup);
    put(cleanupRelative, cleanupText);
    const configuration = {
      technicalAttempt: ordinal,
      relative,
      sha256: digest(receiptText),
      cleanupRelative,
      cleanupSha256: digest(cleanupText),
    };
    if (ordinal === 14) restoredBrowserDiscoveryConfiguration = configuration;
    else restoredBrowserDiscoveryConfiguration.next = configuration;
  }
  let unadmittedWf00Configuration, technical17Configuration, technical17PreReadyConfiguration;
  if (unadmittedWf00Reconciled) {
    const root = 'milestones/M03-n8n-foundation/evidence/',
      relative = root + 'wf00-unadmitted-manual-checkpoint-20261024.json',
      databaseRelative = root + 'wf00-unadmitted-db-readback-20261024.json',
      apiRelative = root + 'wf00-unadmitted-api-readback-20261024.json',
      cleanupRelative = root + 'wf00-unadmitted-cleanup-20261024.json',
      checkpoint = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8')),
      database = JSON.parse(readFileSync(join(sourceRoot, databaseRelative), 'utf8')),
      api = JSON.parse(readFileSync(join(sourceRoot, apiRelative), 'utf8')),
      cleanup = JSON.parse(readFileSync(join(sourceRoot, cleanupRelative), 'utf8')),
      json = (value) => JSON.stringify(value) + '\n';
    for (const path of Object.keys(checkpoint.pins))
      checkpoint.pins[path] = digest(readFileSync(join(directory, path), 'utf8'));
    if (unadmittedWf00Fault === 'native-reset')
      checkpoint.conservativeAdditionalReservation.nativeExecutions = 0;
    if (unadmittedWf00Fault === 'control-reset') checkpoint.conservativeAdditionalReservation.control = 0;
    const text = json(checkpoint);
    put(relative, text);
    database.checkpointSha256 = digest(text);
    if (unadmittedWf00Fault === 'db-active') database.rawResult.inspection.fixture.competitorArchived = false;
    if (unadmittedWf00Fault === 'db-actor') database.rawResult.inspection.actorRunCount = 1;
    const databaseResult = json(database.rawResult);
    put(database.resultPin.path, databaseResult);
    database.resultPin.sha256 = digest(databaseResult);
    const databaseText = json(database);
    put(databaseRelative, databaseText);
    api.checkpointSha256 = digest(text);
    api.databaseReceiptSha256 = digest(databaseText);
    const rows = [
      {
        kind: 'm03_wf00_execution_diagnostic_budget',
        version: 1,
        checkpointSha256: digest(text),
        managementAttempts: 524,
        controlAttempts: 846,
        maximumRequests: 3,
        processId: 7612,
        parentProcessId: 10396,
      },
      ...[525, 526, 527].map((ordinal) => ({ event: 'management_attempt', ordinal })),
    ];
    if (unadmittedWf00Fault === 'diagnostic-reset') rows[1].ordinal = 524;
    const journal = rows.map(json).join('');
    put(api.diagnosticJournal.path, journal);
    api.diagnosticJournal.sha256 = digest(journal);
    if (unadmittedWf00Fault === 'api-running') api.rawNativeResult.inventory.runningEmpty = false;
    if (unadmittedWf00Fault === 'api-overclaim')
      api.rawNativeResult.inventory.allActiveExecutionsAbsentProven = true;
    if (unadmittedWf00Fault === 'api-baseline')
      api.rawNativeResult.inventory.baseline.definitionMatches = false;
    if (unadmittedWf00Fault === 'api-reset') api.usage.carriedControl = 3;
    const apiText = json(api);
    put(apiRelative, apiText);
    cleanup.checkpointSha256 = digest(text);
    cleanup.databaseReceiptSha256 = digest(databaseText);
    cleanup.apiReceiptSha256 = digest(apiText);
    if (unadmittedWf00Fault === 'cleanup')
      cleanup.actualPresenceResult.allElevenDisposableLeavesAbsent = false;
    const cleanupText = json(cleanup);
    put(cleanupRelative, cleanupText);
    unadmittedWf00Configuration = {
      relative,
      sha256: digest(text),
      databaseRelative,
      databaseSha256: digest(databaseText),
      apiRelative,
      apiSha256: digest(apiText),
      cleanupRelative,
      cleanupSha256: digest(cleanupText),
    };
  }
  if (technical16Settled) {
    // Portable synthetic recovery. The only repository reads below are tracked
    // public records and canonical sources; no workstation ignored output is used.
    const e = 'milestones/M03-n8n-foundation/evidence/',
      l = 'scripts/n8n/out/foundation/live/',
      json = (v) => JSON.stringify(v) + '\n',
      load = (p) => readFileSync(join(directory, p), 'utf8'),
      readTracked = (p) => JSON.parse(readFileSync(join(sourceRoot, p), 'utf8')),
      readRows = (p) => load(p).trimEnd().split('\n').map(JSON.parse),
      writeRows = (p, v) => put(p, v.map(json).join('')),
      relative = e + 'dev-acceptance-technical16-reconciliation-20261024.json',
      cleanupRelative = e + 'dev-acceptance-technical16-cleanup-20261024.json',
      custodyRelative = e + 'technical16-postclose-custody-20261024.json',
      resolutionRelative = e + 'technical16-executed-parameters-resolution-20261024.json',
      failedRelative = e + 'technical16-native-cleanup-attempt1-20261024.json',
      settlementRelative = e + 'technical16-native-settlement-20261024.json',
      archiveRelative = e + 'technical16-fixture-archive-20261024.json',
      approvalRelative = e + 'remaining-allocation-after-snapshot-diagnosis-approval-20261024.json',
      packetRelative = e + 'remaining-allocation-after-snapshot-diagnosis-20261024.md',
      r = readTracked(relative),
      custody = readTracked(custodyRelative),
      z = readTracked(cleanupRelative),
      resolution = readTracked(resolutionRelative),
      failed = readTracked(failedRelative),
      owner = readTracked(approvalRelative),
      base = l + `project-verified-continuation-${snapshot.proposedSegmentId}.technical-16`,
      n = technical16CleanupRequests;
    const { createFoundationRuntimeBaseline } = await import('./foundation-runtime-plan.mjs'),
      { runtimeGraphHash } = await import('./foundation-runtime-control.mjs'),
      bindings = JSON.parse(load('n8n/foundation/bindings.dev.json')),
      records = Object.keys(bindings.workflowRefs).map((key) =>
        JSON.parse(load('n8n/workflows/' + key + '.json')),
      ),
      baseline = createFoundationRuntimeBaseline({ bindings, records });
    writeRows(l + 'management.jsonl', [
      ...readRows(l + 'management.jsonl'),
      ...Array.from({ length: 297 }, (_, i) => ({ event: 'management_attempt', ordinal: 514 + i })),
    ]);
    writeRows(l + 'control.jsonl', [
      ...readRows(l + 'control.jsonl'),
      ...Array.from({ length: 109 }, (_, i) => {
        const mixedKind =
          technical16MixedControl && i >= 101
            ? ['details', 'start', 'metadata', 'full', 'workflow', 'workflow', 'workflow', 'stop'][i - 101]
            : null;
        return {
          event: 'control_request_intent',
          ordinal: 841 + i,
          kind: mixedKind ?? 'discovery',
          workflowId: mixedKind ? bindings.workflowRefs['WF-00'].id : baseline[i % 25].id,
          ...(['metadata', 'full', 'stop'].includes(mixedKind) ? { executionId: '31130' } : {}),
          at: '2026-10-24T16:32:00.000Z',
        };
      }),
      { event: 'native_case_intent', caseId: 'dispatch.vimeo', nativeExecutions: 2 },
      {
        event: 'native_start_intent',
        caseId: 'dispatch.vimeo',
        workflowKey: 'WF-00',
        workflowId: bindings.workflowRefs['WF-00'].id,
        versionId: 'synthetic-executed16',
        kind: 'browser_ui',
        intentAt: '2026-10-24T16:33:00.000Z',
      },
      {
        event: 'native_start_ack',
        caseId: 'dispatch.vimeo',
        workflowKey: 'WF-00',
        workflowId: bindings.workflowRefs['WF-00'].id,
        versionId: 'synthetic-executed16',
        executionId: '31130',
        kind: 'browser_ui',
        intentAt: '2026-10-24T16:33:00.000Z',
      },
      ...Array.from({ length: 4 }, () => ({
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId: bindings.workflowRefs['WF-00'].id,
        at: '2026-10-24T16:32:00.000Z',
      })),
    ]);
    const setups = readRows(l + 'setup.jsonl'),
      cloned = setups
        .slice(-71)
        .map((row) =>
          JSON.parse(
            JSON.stringify(row)
              .replaceAll('3c46c791-e140-4eb9-890a-eecfa251f65e', r.attempt.windowId)
              .replaceAll('synthetic3c13', 'synthetic4c16'),
          ),
        );
    let setupOrdinal = 149;
    for (const row of cloned) {
      if (row.event === 'setup_attempt') row.ordinal = ++setupOrdinal;
      if (typeof row.at === 'number') row.at = r.rawAdmission.startsAt + 5000;
    }
    writeRows(l + 'setup.jsonl', [...setups, ...cloned]);
    const preflight = readRows(l + 'preflight.jsonl'),
      extra = preflight
        .slice(-5)
        .map((row) =>
          JSON.parse(
            JSON.stringify(row)
              .replaceAll('3c46c791-e140-4eb9-890a-eecfa251f65e', r.attempt.windowId)
              .replaceAll('7b1837201ac7925591577a1517d7288936ca3464', r.source.applicationSource),
          ),
        );
    extra[0].ordinal = 7;
    extra[1].ordinal = 8;
    writeRows(l + 'preflight.jsonl', [...preflight, ...extra]);
    const runtimeRows = [
      { event: 'file_header', version: 1, planHash: 'a'.repeat(64), deadlineAt: r.rawAdmission.deadlineAt },
      { event: 'header', version: 1, planHash: 'a'.repeat(64) },
    ];
    for (let i = 1; i <= 70; i++) {
      const machine = i === 1 || i === 70,
        record = baseline[(i - 2 + 25) % 25],
        after = machine
          ? { updatedAt: '2026-10-24T16:35:00.000Z' }
          : {
              versionId: custody.restoration.restoredVersions[record.key],
              activeVersionId: null,
              graphHash: runtimeGraphHash(record.body),
              publishedHash: null,
            };
      runtimeRows.push(
        {
          event: 'intent',
          sequence: i,
          action: machine ? (i === 1 ? 'machine_rebind' : 'machine_restore') : 'save',
          key: machine ? 'Machine' : record.key,
          before: machine ? '2026-10-24T16:00:00.000Z' : after,
          target: machine ? (i === 1 ? 'runtime' : 'baseline') : after,
        },
        { event: 'verified', sequence: i, after },
      );
    }
    runtimeRows.push(
      { event: 'machine_observed', metadata: { createdAt: 1, updatedAt: 1 } },
      { event: 'setup_complete' },
    );
    for (let i = 1; i <= 237; i++)
      runtimeRows.push({
        event: 'request',
        number: i,
        method: 'GET',
        path: '/api/v1/workflows/' + baseline[(i - 213 + 250) % 25].id + '?excludePinnedData=true',
      });
    runtimeRows.push({ event: 'restore_complete' });
    if (['final-graph', 'final-published'].includes(technical16Fault)) {
      const intent = runtimeRows.filter((row) => row.event === 'intent' && row.key === 'WF-00').at(-1),
        after = runtimeRows.find((row) => row.event === 'verified' && row.sequence === intent.sequence).after;
      if (technical16Fault === 'final-graph') after.graphHash = 'f'.repeat(64);
      else after.activeVersionId = after.versionId;
    }
    writeRows(l + 'runtime.technical-16.jsonl', runtimeRows);
    r.rawAdmission.approvalSha256 = digest(approvalText);
    const admissionText = json(r.rawAdmission);
    r.rawRuntimeClaim.admissionSha256 = digest(admissionText);
    r.rawTechnicalClose.admissionSha256 = digest(admissionText);
    for (const [suffix, value] of [
      ['.json', r.rawAdmission],
      ['.runtime-claim.json', r.rawRuntimeClaim],
      ['.closed.json', r.rawTechnicalClose],
    ])
      put(base + suffix, json(value));
    writeRows(base + '.public-frames.jsonl', [
      ...Array.from({ length: 8 }, () => ({ kind: 'synthetic_public_frame' })),
      r.rawPrepare,
      r.rawCase,
      r.rawRestore,
      r.rawSourceClose,
      r.rawWrapperClose,
    ]);
    put(e + 'technical16-wf00-dispatch-ui-20261024.png', Buffer.from('synthetic public PNG bytes'));
    const db16Stem =
        'scripts/db/out/m03-foundation-project-verified-continuation-' +
        snapshot.proposedSegmentId +
        '-technical-16',
      db16Paths = new Set([
        db16Stem + '-latest.json',
        db16Stem + '-owner-provision-attempt.json',
        db16Stem + '-reactivation-attempt.json',
      ]),
      db16RunId = '3412e032-4833-43c9-9342-19ea25d50275';
    put(
      db16Stem + '-latest.json',
      json({
        runId: db16RunId,
        status: 'continuation_history_verified',
        historyBefore: 'complete',
        historyAfter: 'complete',
        pushAttempted: false,
        phaseAClosed: true,
        reactivationState: 'acknowledged_and_verified',
      }),
    );
    put(
      db16Stem + '-owner-provision-attempt.json',
      json({
        runId: db16RunId,
        windowId: r.attempt.windowId,
        packet: {
          audience: 'https://everyone-market-researcher-13wnnoywv-muhammed-abdelrahman.vercel.app',
          commitSha: r.source.applicationSource,
          deploymentId: 'dpl_Hqcn7hxpuEUz6Bbq9tTtmQs5MdYd',
        },
      }),
    );
    put(
      db16Stem + '-reactivation-attempt.json',
      json({
        kind: 'synthetic_owned_reactivation_receipt',
        windowId: r.attempt.windowId,
        state: 'acknowledged_and_verified',
      }),
    );
    for (const path of Object.keys(r.pins)) r.pins[path] = digest(readFileSync(join(directory, path)));
    if (technical16Fault === 'raw-closure') r.rawRestore.remoteWorkSettled = true;
    if (technical16Fault === 'native-reset') r.usage.nativeExecutionsReserved = 0;
    const rText = json(r);
    put(relative, rText);
    z.attemptReceiptSha256 = digest(rText);
    custody.originalAttemptSha256 = digest(rText);
    custody.localCleanupSha256 = digest(json(z));
    for (const path of Object.keys(custody.pins)) {
      if (path === l + 'runtime.technical-16.jsonl' || db16Paths.has(path)) continue;
      put(path, path.endsWith('.ts') ? 'synthetic retained types\n' : json({ syntheticPublicRecord: path }));
    }
    for (const path of Object.keys(custody.pins))
      custody.pins[path] = digest(readFileSync(join(directory, path)));
    if (technical16Fault === 'version')
      custody.restoration.restoredVersions['WF-00'] = 'foreign-restored-version';
    put(custodyRelative, json(custody));
    put(cleanupRelative, json(z));
    resolution.originalAttemptSha256 = digest(rText);
    const diagnosticReceipts = [];
    for (const [index, stem] of [
      'metadata',
      'native-metadata',
      'snapshot',
      'category',
      'parameter-defaults',
    ].entries()) {
      const ordinal = 825 + index,
        file = [
          'technical16-execution31130-metadata-readback-20261024.json',
          'technical16-execution31130-native-metadata-readback-20261024.json',
          'technical16-execution31130-native-snapshot-readback-20261024.json',
          'technical16-execution31130-parameter-category-readback-20261024.json',
          'technical16-executed-parameters-resolution-20261024.json',
        ][index],
        path = e + file,
        value = index === 4 ? resolution : readTracked(path),
        claimRelative = 'scripts/n8n/out/foundation/execution-31130-' + stem + '-diagnostic-20261024.jsonl',
        beforeControl = [955, 955, 957, 958, 959][index],
        header = {
          kind: 'm03_execution_31130_' + stem.replaceAll('-', '_') + '_diagnostic_budget',
          version: 1,
          checkpointSha256: digest(rText),
          cleanupSha256: digest(json(z)),
          managementAttempts: ordinal - 1,
          controlAttempts: beforeControl,
          maximumRequests: 1,
          processId: 92000 + index,
          parentProcessId: 92100 + index,
        },
        claimRows = [header, { event: 'management_attempt', ordinal }];
      if (index > 0) {
        header.metadataReceiptSha256 = diagnosticReceipts[0].sha256;
        header.conservativeControlReservation = true;
        header.additionalHttpRequests = 0;
        claimRows.push({
          event: 'native_read_control_reservation',
          ordinal: [0, 956, 958, 959, 960][index],
          additionalHttpRequest: false,
        });
      }
      if (index === 3) header.snapshotReceiptSha256 = diagnosticReceipts[2].sha256;
      if (index === 4) header.categoryReceiptSha256 = diagnosticReceipts[3].sha256;
      writeRows(claimRelative, claimRows);
      value.pins[claimRelative] = digest(load(claimRelative));
      if (index < 4) {
        put(path, json(value));
        diagnosticReceipts.push({ relative: path, sha256: digest(load(path)), claimRelative });
      } else diagnosticReceipts.push({ relative: path, sha256: null, claimRelative });
    }
    const resolutionText = json(resolution);
    put(resolutionRelative, resolutionText);
    diagnosticReceipts[4].sha256 = digest(resolutionText);
    const childUiRelative = e + 'technical16-child-ui-readback-20261024.json';
    const childUi = readTracked(childUiRelative);
    childUi.nativeMetadataReadbackSha256 = diagnosticReceipts[1].sha256;
    put(childUiRelative, json(childUi));
    const oldOnce = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt.json',
      oldJournal = 'scripts/n8n/out/foundation/technical16-native-cleanup.jsonl',
      oldSeal = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.provision-seal.json',
      oldLock = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.runtime-lock';
    put(
      oldOnce,
      json({
        kind: 'm03_technical16_cleanup_once',
        version: 1,
        resolutionSha256: digest(resolutionText),
        executionIds: ['31131', '31130'],
        maximumRequests: 158,
        maximumControlRequests: 158,
        processId: failed.cleanup.childProcessId,
        parentProcessId: failed.cleanup.parentProcessId,
        usage: { management: 829, control: 960, combined: 1789, vercel: 184 },
        at: '2026-10-24T21:00:00.000Z',
      }),
    );
    put(
      oldJournal,
      json({
        event: 'technical16_cleanup_header',
        version: 1,
        resolutionSha256: digest(resolutionText),
        originalAttemptSha256: digest(rText),
      }),
    );
    put(oldSeal, json({ syntheticPublicSeal: true }));
    put(oldLock, 'emr-m03-foundation-live-runtime-v1\n');
    failed.originalAttemptSha256 = digest(rText);
    failed.resolutionSha256 = digest(resolutionText);
    failed.pins[oldOnce] = digest(load(oldOnce));
    failed.pins[oldJournal] = digest(load(oldJournal));
    failed.pins[oldSeal] = digest(load(oldSeal));
    failed.pins['scripts/n8n/out/foundation/live/runtime.operation.lock'] = digest(load(oldLock));
    const failedText = json(failed);
    put(failedRelative, failedText);
    const priorPinPaths = [failedRelative, oldOnce, oldJournal, oldSeal, oldLock],
      spent = [failed];
    let previousFailedPath = failedRelative,
      previousOncePath = oldOnce,
      previousJournalPath = oldJournal;
    for (let attempt = 2; attempt <= 6; attempt++) {
      const path = e + `technical16-native-cleanup-attempt${attempt}-20261024.json`,
        value = readTracked(path),
        stem = `scripts/n8n/out/foundation/technical16-native-cleanup-attempt${attempt}`,
        oncePath = stem + '.json',
        journalPath = stem + '.jsonl',
        resultPath = stem + '-result.json',
        sealPath = stem + '.provision-seal.json',
        lockPath = stem + '.runtime-lock',
        baseUsage = [
          [829, 960, 1789],
          [833, 964, 1797],
          [837, 968, 1805],
          [863, 994, 1857],
          [874, 1005, 1879],
        ][attempt - 2],
        count = [4, 4, 25, 11, 2][attempt - 2],
        nextOnce = {
          kind: 'm03_technical16_cleanup_once',
          version: 1,
          cleanupAttempt: attempt,
          priorFailedAttemptSha256: digest(load(previousFailedPath)),
          priorOnceSha256: digest(load(previousOncePath)),
          priorJournalSha256: digest(load(previousJournalPath)),
          resolutionSha256: digest(resolutionText),
          executionIds: ['31131', '31130'],
          processId: 91080 + attempt,
          parentProcessId: 92080 + attempt,
          usage: {
            ...resolution.usage,
            management: baseUsage[0],
            control: baseUsage[1],
            combined: baseUsage[2],
          },
          maximumRequests: [158, 4, 150, 124, 113][attempt - 2],
          maximumControlRequests: [158, 4, 150, 124, 113][attempt - 2],
          ...(attempt === 3 ? { qualificationOnly: true } : {}),
          at: '2026-10-24T21:00:00.000Z',
        },
        nextRows = [
          {
            event: 'technical16_cleanup_header',
            version: 1,
            resolutionSha256: digest(resolutionText),
            originalAttemptSha256: digest(rText),
            cleanupAttempt: attempt,
            priorFailedAttemptSha256: nextOnce.priorFailedAttemptSha256,
            priorOnceSha256: nextOnce.priorOnceSha256,
            priorJournalSha256: nextOnce.priorJournalSha256,
          },
        ];
      for (let index = 0; index < count; index++) {
        const retry = attempt === 6 && index === 1,
          prefix = index < 4,
          root = index < 2;
        nextRows.push({
          event: 'technical16_http_intent',
          ordinal: index + 1,
          ...(retry ? { retryOf: 1 } : {}),
          kind: attempt === 6 ? 'metadata' : prefix ? (index % 2 === 0 ? 'metadata' : 'full') : 'discovery',
          workflowId:
            attempt === 6
              ? bindings.workflowRefs['WF-00'].id
              : prefix
                ? bindings.workflowRefs[root ? 'WF-00' : 'WF-10'].id
                : baseline[Math.floor((index - 4) / 2)].id,
          ...(prefix || attempt === 6 ? { executionId: attempt === 6 || root ? '31130' : '31131' } : {}),
          managementAttempts: baseUsage[0] + index + 1,
          controlAttempts: baseUsage[1] + index + 1,
          at: '2026-10-24T21:00:01.000Z',
        });
      }
      value.originalAttemptSha256 = digest(rText);
      value.resolutionSha256 = digest(resolutionText);
      value.priorFailedAttemptSha256 = nextOnce.priorFailedAttemptSha256;
      value.cleanup.childProcessId = nextOnce.processId;
      value.cleanup.parentProcessId = nextOnce.parentProcessId;
      put(oncePath, json(nextOnce));
      writeRows(journalPath, nextRows);
      const inner = Object.fromEntries(
        Object.entries(value.rawResult).filter(
          ([key]) =>
            ![
              'nativeExit',
              'childClosed',
              'credentialChildrenClosed',
              'parentLockDeleted',
              'privateRead',
              'persistentManagementRetained',
            ].includes(key),
        ),
      );
      put(resultPath, json(inner));
      put(sealPath, json({ version: 2, syntheticRetainedUsedSeal: attempt }));
      put(lockPath, 'emr-m03-foundation-live-runtime-v1\n');
      for (const pin of Object.keys(value.pins))
        if (existsSync(join(directory, pin))) value.pins[pin] = digest(readFileSync(join(directory, pin)));
      value.pins[oncePath] = digest(load(oncePath));
      value.pins[journalPath] = digest(load(journalPath));
      value.pins[resultPath] = digest(load(resultPath));
      value.pins[sealPath] = digest(load(sealPath));
      if (technical16Fault === 'spent-closure' && attempt === 6) value.rawResult.remoteWorkSettled = true;
      if (technical16Fault === 'spent-counter' && attempt === 5) value.usage.management = 1;
      if (technical16Fault === 'spent-time' && attempt === 6) value.observedAt = 'not-a-time';
      if (technical16Fault === 'spent-time-missing' && attempt === 6) delete value.observedAt;
      if (technical16Fault === 'prior-chain' && attempt === 6)
        nextOnce.priorFailedAttemptSha256 = 'f'.repeat(64);
      if (technical16Fault === 'prior-chain' && attempt === 6) {
        put(oncePath, json(nextOnce));
        value.pins[oncePath] = digest(load(oncePath));
      }
      put(path, json(value));
      priorPinPaths.push(path, oncePath, journalPath, resultPath, sealPath, lockPath);
      spent.push(value);
      previousFailedPath = path;
      previousOncePath = oncePath;
      previousJournalPath = journalPath;
    }
    const wf32Path = e + 'technical16-wf32-discovery-readback-20261024.json',
      wf32 = readTracked(wf32Path),
      wf32Journal = 'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.jsonl';
    wf32.priorFailedAttemptSha256 = digest(load(e + 'technical16-native-cleanup-attempt4-20261024.json'));
    writeRows(wf32Journal, [
      {
        kind: 'm03_wf32_discovery_diagnostic_budget',
        version: 1,
        failedAttemptSha256: wf32.priorFailedAttemptSha256,
        managementAttempts: 862,
        controlAttempts: 993,
        combinedAttempts: 1855,
        maximumRequests: 1,
      },
      { event: 'management_attempt', ordinal: 863 },
      { event: 'native_read_control_reservation', ordinal: 994, additionalHttpRequest: false },
    ]);
    for (const path of Object.keys(wf32.pins)) {
      if (path !== wf32Journal) put(path, json({ syntheticRetainedPublicSeal: path }));
      wf32.pins[path] = digest(load(path));
      priorPinPaths.push(path);
    }
    put(wf32Path, json(wf32));
    priorPinPaths.push(wf32Path);
    const publicPath = e + 'technical16-public-transport-diagnostics-20261024.json',
      publicValue = readTracked(publicPath),
      publicPrefix = 'scripts/n8n/out/foundation/technical16-';
    publicValue.priorFailedAttemptSha256 = digest(load(previousFailedPath));
    for (const [path, native, m, c] of [
      [publicPrefix + 'public-transport-diagnostic-20261024.jsonl', false, 876, 1007],
      [publicPrefix + 'native-public-transport-diagnostic-20261024.jsonl', true, 877, 1008],
    ]) {
      writeRows(path, [
        {
          kind: native
            ? 'm03_technical16_native_public_transport_diagnostic_budget'
            : 'm03_technical16_public_transport_diagnostic_budget',
          version: 1,
          checkpointSha256: publicValue.priorFailedAttemptSha256,
          sourceCommitSha: publicValue.sourceCommitSha,
          managementAttempts: m,
          controlAttempts: c,
          maximumRequests: 1,
          method: 'GET',
          route: native ? '/api/v1/executions/31130?includeData=false' : '/api/v1/discover',
          credentialSupplied: false,
          ...(native ? { publicConstantHeader: true } : {}),
          at: '2026-10-24T21:00:00.000Z',
        },
        { event: 'management_attempt', ordinal: m + 1, at: '2026-10-24T21:00:00.000Z' },
        {
          event: 'native_read_control_reservation',
          ordinal: c + 1,
          conservative: true,
          at: '2026-10-24T21:00:00.000Z',
        },
      ]);
      publicValue.pins[path] = digest(load(path));
      priorPinPaths.push(path);
    }
    for (const [path, value] of [
      [
        publicPrefix + 'native-public-transport-diagnostic-20261024-result.json',
        publicValue.nativePublicHttp,
      ],
      [publicPrefix + 'public-tls-timing-20261024.json', publicValue.tlsTiming],
    ]) {
      put(path, json(value));
      publicValue.pins[path] = digest(load(path));
      priorPinPaths.push(path);
    }
    put(publicPath, json(publicValue));
    priorPinPaths.push(publicPath);
    const settlementPriorPins = Object.fromEntries(
      priorPinPaths.map((path) => [path, digest(readFileSync(join(directory, path)))]),
    );
    const cleanupBase = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt7',
      continuation = {
        cleanupAttempt: 7,
        priorFailedAttemptSha256: digest(load(previousFailedPath)),
        priorOnceSha256: digest(load(previousOncePath)),
        priorJournalSha256: digest(load(previousJournalPath)),
      },
      usage = { management: 878, control: 1009, combined: 1887, vercel: 184 };
    put(
      cleanupBase + '.json',
      json({
        kind: 'm03_technical16_cleanup_once',
        version: 1,
        resolutionSha256: digest(resolutionText),
        executionIds: ['31131', '31130'],
        processId: 91080,
        parentProcessId: 91081,
        usage,
        maximumRequests: 109,
        maximumControlRequests: 109,
        at: '2026-10-24T21:00:00.000Z',
        ...continuation,
      }),
    );
    const cleanupRows = [
        {
          event: 'technical16_cleanup_header',
          version: 1,
          resolutionSha256: digest(resolutionText),
          originalAttemptSha256: digest(rText),
          ...continuation,
        },
      ],
      routes = [];
    for (const record of baseline)
      for (let i = 0; i < 2; i++) routes.push({ kind: 'discovery', workflowId: record.id });
    for (
      let i = 0;
      i < n - 85 - (technical16CleanupRetry === null ? 0 : technical16Fault === 'retry-chain' ? 2 : 1);
      i++
    )
      routes.push({ kind: 'discovery', workflowId: baseline[i % 25].id });
    for (const record of baseline) routes.push({ kind: 'workflow', workflowId: record.id });
    for (const id of ['31130', '31131'])
      for (const kind of ['metadata', 'full', 'metadata'])
        routes.push({
          kind,
          workflowId: bindings.workflowRefs[id === '31130' ? 'WF-00' : 'WF-10'].id,
          executionId: id,
        });
    let httpOrdinal = 0;
    const addHttp = (route) =>
      cleanupRows.push({
        event: 'technical16_http_intent',
        ordinal: ++httpOrdinal,
        ...route,
        managementAttempts: 878 + httpOrdinal,
        controlAttempts: 1009 + httpOrdinal,
        at: '2026-10-24T21:00:01.000Z',
      });
    let retryAdded = false;
    for (const route of routes) {
      addHttp(route);
      if (!retryAdded && route.kind === technical16CleanupRetry) {
        addHttp({ ...route, retryOf: httpOrdinal });
        if (technical16Fault === 'retry-chain') addHttp({ ...route, retryOf: httpOrdinal });
        retryAdded = true;
      }
    }
    for (const [id, index] of [
      ['31131', 1],
      ['31130', 2],
    ]) {
      const workflowId = bindings.workflowRefs[id === '31130' ? 'WF-00' : 'WF-10'].id,
        common = {
          batchId: 'technical16-postclose-native-cleanup',
          caseId: 'dispatch.vimeo-reconciliation',
          executionId: id,
          workflowId,
          at: '2026-10-24T21:00:02.000Z',
        };
      cleanupRows.push(
        { event: 'native_cleanup_evidence', ...common },
        { event: 'native_cleanup_intent', ...common, ordinal: index },
      );
      addHttp({ kind: 'delete', workflowId, executionId: id });
      cleanupRows.push({ event: 'native_cleanup_absence_intent', ...common, ordinal: index });
      addHttp({ kind: 'absence', workflowId, executionId: id });
      cleanupRows.push({
        event: 'native_cleanup_result',
        ...common,
        state: 'native_record_deleted',
        deleteAcknowledged: true,
        absenceVerified: true,
        residual: false,
      });
    }
    if (technical16Fault === 'ack') cleanupRows.at(-1).deleteAcknowledged = false;
    if (technical16Fault === 'counter') cleanupRows[1].managementAttempts = 1;
    if (technical16Fault?.startsWith('retry-')) {
      const retry = cleanupRows.find((row) => Object.hasOwn(row, 'retryOf')),
        http = cleanupRows.filter((row) => row.event === 'technical16_http_intent');
      if (!retry) throw Error('SYNTHETIC_RETRY_REQUIRED');
      switch (technical16Fault) {
        case 'retry-string':
          retry.retryOf = String(retry.retryOf);
          break;
        case 'retry-zero':
          retry.retryOf = 0;
          break;
        case 'retry-future':
          retry.retryOf = retry.ordinal;
          break;
        case 'retry-skip':
          retry.retryOf = retry.ordinal - 2;
          break;
        case 'retry-kind':
          retry.kind = 'full';
          break;
        case 'retry-workflow':
          retry.workflowId = baseline.find((row) => row.id !== retry.workflowId).id;
          break;
        case 'retry-execution':
          retry.executionId = '31131';
          break;
        case 'retry-delete':
          http.find((row) => row.kind === 'delete').retryOf = 1;
          break;
        case 'retry-absence':
          http.find((row) => row.kind === 'absence').retryOf = 1;
          break;
        case 'retry-non-http':
          cleanupRows.find((row) => row.event === 'native_cleanup_evidence').retryOf = 1;
          break;
        case 'retry-chain':
          break;
        default:
          throw Error('SYNTHETIC_RETRY_FAULT_UNKNOWN');
      }
    }
    writeRows(cleanupBase + '.jsonl', cleanupRows);
    const inner = {
      kind: 'm03_technical16_native_cleanup',
      version: 1,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      windowId: r.attempt.windowId,
      sourceCommitSha: r.source.applicationSource,
      status: 'native_cleanup_verified',
      requestCount: n,
      controlRequestCount: n,
      managementAttempts: 878 + n,
      controlAttempts: 1009 + n,
      combinedAttempts: 1887 + 2 * n,
      canonicalWorkflowsVerified: 25,
      qualifiedSideEffects: true,
      recordsDeleted: 2,
      deleteAcknowledged: true,
      absenceVerified: true,
      remoteWorkSettled: true,
      networkCompletionVerified: true,
      originalPublicRecordsUnchanged: true,
      nativeAcceptanceProven: false,
      originalMaskedFirstFailureRecovered: false,
      executionCount: 0,
      actorStarts: 0,
      workflowWrites: 0,
      credentialWrites: 0,
      migrationOperations: 0,
      diagnosticStage: 'complete',
      diagnosticCode: 'none',
    };
    put(cleanupBase + '-result.json', json(inner));
    const settlement = {
      kind: 'm03_technical16_native_settlement',
      version: 1,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      technicalAttempt: 16,
      windowId: r.attempt.windowId,
      sourceCommitSha: r.source.applicationSource,
      originalAttemptSha256: digest(rText),
      resolutionSha256: digest(resolutionText),
      outerNativeExit: 0,
      rawResult: {
        ...inner,
        nativeExit: 0,
        childClosed: true,
        credentialChildrenClosed: true,
        parentLockDeleted: true,
        privateRead: true,
        persistentManagementRetained: true,
      },
      cleanup: {
        parentAbsent: true,
        childAbsent: true,
        parentLockAbsent: true,
        runtimeLockAbsent: true,
        persistentManagementRetained: true,
        privateContentsRead: false,
        networkRequests: 0,
      },
      pins: {},
      usage: {
        management: 878 + n,
        control: 1009 + n,
        combined: 1887 + 2 * n,
        vercel: 184,
        nativeExecutionsReserved: 3,
        actorStarts: 0,
        providerReads: 0,
      },
    };
    for (const path of [
      relative,
      resolutionRelative,
      ...priorPinPaths,
      cleanupBase + '.json',
      cleanupBase + '.jsonl',
      cleanupBase + '-result.json',
    ])
      settlement.pins[path] = digest(readFileSync(join(directory, path)));
    if (technical16Fault === 'acceptance') settlement.rawResult.nativeAcceptanceProven = true;
    if (technical16Fault === 'typed-closure') settlement.rawResult.childClosed = 'true';
    const settlementText = json(settlement);
    put(settlementRelative, settlementText);
    const rawArchive = readTracked(e + 'technical16-postclose-db-readback-20261024.json').rawResult;
    rawArchive.status = 'archive_verified';
    rawArchive.archiveFixture = true;
    rawArchive.archiveAttempted = true;
    rawArchive.archiveAcknowledged = true;
    rawArchive.archiveNativeExit = 0;
    rawArchive.fixtureArchived = true;
    rawArchive.persistentAdminPreserved = true;
    rawArchive.archiveBefore = structuredClone(rawArchive.inspection);
    rawArchive.archiveAfter = structuredClone(rawArchive.inspection);
    Object.assign(rawArchive.archiveAfter.fixture, {
      competitorArchived: true,
      competitorActive: false,
      accountPaused: true,
      accountActive: false,
    });
    delete rawArchive.inspection;
    const archiveBase =
      'scripts/db/out/m03-foundation-archive-' + r.attempt.windowId + '-after-preflight-698498b3';
    put(archiveBase + '-attempt.json', json({ kind: 'synthetic_owned_archive_attempt' }));
    put(archiveBase + '-latest.json', json(rawArchive));
    const archive = {
      kind: 'm03_technical16_fixture_archive',
      version: 1,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      outerNativeExit: 0,
      settlementSha256: digest(settlementText),
      rawResult: rawArchive,
      cleanup: {
        parentAbsent: true,
        childAbsent: true,
        parentLockAbsent: true,
        persistentAdminRetained: true,
        privateContentsRead: false,
        networkRequests: 0,
      },
      pins: {},
    };
    for (const path of [settlementRelative, archiveBase + '-attempt.json', archiveBase + '-latest.json'])
      archive.pins[path] = digest(load(path));
    if (technical16Fault === 'archive') archive.rawResult.archiveAfter.fixture.accountPaused = false;
    put(archiveRelative, json(archive));
    const packet = readFileSync(join(sourceRoot, packetRelative), 'utf8');
    put(packetRelative, packet);
    owner.approvedPacketSha256 = digest(packet);
    if (technical16Fault === 'caps') owner.approvedCaps.control = 5000;
    put(approvalRelative, json(owner));
    technical17Configuration = {
      actualRelative: relative,
      actualSha256: digest(rText),
      custodyRelative,
      custodySha256: digest(load(custodyRelative)),
      approvalRelative,
      approvalSha256: digest(load(approvalRelative)),
      packetRelative,
      packetSha256: digest(packet),
      cleanupRelative,
      cleanupSha256: digest(load(cleanupRelative)),
      resolutionRelative,
      resolutionSha256: digest(resolutionText),
      failedCleanupRelative: failedRelative,
      failedCleanupSha256: digest(failedText),
      settlementPriorPins,
      settlementRelative,
      settlementSha256: digest(settlementText),
      archiveRelative,
      archiveSha256: digest(load(archiveRelative)),
      diagnosticReceipts,
      childUiRelative,
      childUiSha256: digest(load(childUiRelative)),
    };
  }
  if (technical17PreReady) {
    if (!technical16Settled || technical16CleanupRequests !== 85) throw Error('SYNTHETIC17_SCOPE');
    const relative =
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical17-preready-reconciliation-20261025.json',
      r = JSON.parse(readFileSync(join(sourceRoot, relative), 'utf8')),
      l = 'scripts/n8n/out/foundation/live/',
      stem = l + 'project-verified-continuation-' + snapshot.proposedSegmentId + '.technical-17',
      framesPath = l + 'technical17-coordinator-20261024-startup3.jsonl',
      intentPath = l + 'technical17-pre-ready-cleanup.intent.json',
      resultPath = l + 'technical17-pre-ready-cleanup.result.json',
      json = (value) => JSON.stringify(value) + '\n',
      startsAt = Date.parse('2026-10-24T22:00:00.000Z');
    r.parentProcessId = 91092;
    r.runtimeProcessId = 91093;
    Object.assign(r.rawAdmission, {
      parentProcessId: r.parentProcessId,
      approvalSha256: digest(approvalText),
      startsAt,
      deadlineAt: startsAt + 3600000,
      stopNewAt: startsAt + 3000000,
      hardDeadlineAt: startsAt + 4200000,
    });
    const admissionText = json(r.rawAdmission);
    Object.assign(r.rawRuntimeClaim, {
      admissionSha256: digest(admissionText),
      parentProcessId: r.parentProcessId,
      processId: r.runtimeProcessId,
      claimedAt: startsAt + 4000,
    });
    Object.assign(r.rawTechnicalClose, {
      admissionSha256: digest(admissionText),
      parentProcessId: r.parentProcessId,
      runtimeProcessId: r.runtimeProcessId,
      closedAt: startsAt + 6000,
    });
    if (technical17PreReadyFault === 'raw-closure') r.rawTechnicalClose.credentialChildrenClosed = true;
    if (technical17PreReadyFault === 'raw-wrapper') r.rawFrames[3].privateRead = false;
    if (technical17PreReadyFault === 'frame-extra')
      r.rawFrames.push({ kind: 'm03_acceptance_command', id: 'synthetic_extra', command: 'prepare' });
    if (technical17PreReadyFault === 'qualification') r.qualification.noPrepareSent = false;
    if (technical17PreReadyFault === 'usage') r.usage.management++;
    if (technical17PreReadyFault === 'claim') r.rawRuntimeClaim.claimedAt = startsAt - 1;
    if (technical17PreReadyFault === 'cleanup') r.cleanup.plaintextRead = true;
    r.cleanup.observedAt = '2026-10-24T22:02:00.000Z';
    put(stem + '.json', admissionText);
    put(stem + '.runtime-claim.json', json(r.rawRuntimeClaim));
    put(stem + '.closed.json', json(r.rawTechnicalClose));
    put(framesPath, r.rawFrames.map(json).join(''));
    const intent = {
      kind: 'm03_technical17_pre_ready_cleanup_intent',
      version: 1,
      parentProcessId: r.parentProcessId,
      runtimeProcessId: r.runtimeProcessId,
      targets: r.cleanup.deleted,
      journalPins: {},
      plaintextRead: false,
      networkRequests: 0,
      bothLocksHeld: true,
      createdAt: '2026-10-24T22:01:59.000Z',
    };
    for (const path of Object.keys(r.pins).slice(0, 5))
      intent.journalPins[path] = digest(readFileSync(join(directory, path)));
    put(intentPath, json(intent));
    put(resultPath, json(r.cleanup));
    for (const path of Object.keys(r.pins)) r.pins[path] = digest(readFileSync(join(directory, path)));
    if (technical17PreReadyFault === 'runtime-output') put(l + 'runtime.technical-17.jsonl', '{}\n');
    if (technical17PreReadyFault === 'admin-output')
      put(
        'scripts/db/out/m03-foundation-project-verified-continuation-' +
          snapshot.proposedSegmentId +
          '-technical-17-owner-provision-attempt.json',
        '{}\n',
      );
    put(relative, json(r));
    technical17PreReadyConfiguration = { relative, sha256: digest(json(r)) };
  }
  if (approved)
    put(
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-approval-20261022.json',
      approvalText,
    );
  let source = readFileSync(
    join(sourceRoot, 'scripts/n8n/foundation-live-project-verified-continuation.mjs'),
    'utf8',
  );
  if (technical17Configuration)
    source = source.replace(
      /const technical17Recovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const technical17Recovery = Object.freeze(' + JSON.stringify(technical17Configuration) + ');',
    );
  source = source.replace(
    /const technical17PreReadyRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    'const technical17PreReadyRecovery = ' +
      (technical17PreReadyConfiguration
        ? 'Object.freeze(' + JSON.stringify(technical17PreReadyConfiguration) + ')'
        : 'null') +
      ';',
  );
  source = source
    .replace(
      /approvalSha256: (?:null|'[a-f0-9]{64}')/,
      `approvalSha256: ${approved ? JSON.stringify(digest(approvalText)) : 'null'}`,
    )
    .replace(/packetSha256: (?:null|'[a-f0-9]{64}')/, `packetSha256: '${digest(packetText)}'`)
    .replace(/checkpointSha256: (?:null|'[a-f0-9]{64}')/, `checkpointSha256: '${digest(checkpointText)}'`);
  if (recoveryConfiguration)
    source = source.replace(
      /const effectfulRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const effectfulRecovery = Object.freeze(' + JSON.stringify(recoveryConfiguration) + ');',
    );
  if (closedConfiguration)
    source = source.replace(
      /const closedWindowRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const closedWindowRecovery = Object.freeze(' + JSON.stringify(closedConfiguration) + ');',
    );
  if (restoreConfiguration)
    source = source.replace(
      /const wf00RestoreRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const wf00RestoreRecovery = Object.freeze(' + JSON.stringify(restoreConfiguration) + ');',
    );
  if (allocationConfiguration)
    source = source.replace(
      /const setupAllocationApproval = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const setupAllocationApproval = Object.freeze(' + JSON.stringify(allocationConfiguration) + ');',
    );
  if (readonlyPrepareConfiguration)
    source = source.replace(
      /const readonlyPrepareRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const readonlyPrepareRecovery = Object.freeze(' + JSON.stringify(readonlyPrepareConfiguration) + ');',
    );
  if (nativeDiscoveryConfiguration)
    source = source.replace(
      /const nativeDiscoveryRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const nativeDiscoveryRecovery = Object.freeze(' + JSON.stringify(nativeDiscoveryConfiguration) + ');',
    );
  if (nativeBrowserDiscoveryConfiguration)
    source = source.replace(
      /const nativeBrowserDiscoveryRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const nativeBrowserDiscoveryRecovery = Object.freeze(' +
        JSON.stringify(nativeBrowserDiscoveryConfiguration) +
        ');',
    );
  if (baselineDiscoveryConfiguration)
    source = source.replace(
      /const baselineDiscoveryRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const baselineDiscoveryRecovery = Object.freeze(' +
        JSON.stringify(baselineDiscoveryConfiguration) +
        ');',
    );
  if (wf70ReadbackConfiguration)
    source = source.replace(
      /const wf70DiagnosticRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const wf70DiagnosticRecovery = Object.freeze(' + JSON.stringify(wf70ReadbackConfiguration) + ');',
    );
  if (managementAllocationConfiguration)
    source = source.replace(
      /const managementAllocationApproval = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      'const managementAllocationApproval = Object.freeze(' +
        JSON.stringify(managementAllocationConfiguration) +
        ');',
    );
  // These copies explicitly model historical pre-technical7 authority. The
  // production source has no runtime switch to omit its completed receipt.
  source = source.replace(
    /const closedPreparationRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    'const closedPreparationRecovery = ' +
      (closedPreparationConfiguration
        ? 'Object.freeze(' + JSON.stringify(closedPreparationConfiguration) + ')'
        : 'null') +
      ';',
  );
  source = source.replace(
    /const closedFixtureRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    'const closedFixtureRecovery = ' +
      (closedFixtureConfiguration
        ? 'Object.freeze(' + JSON.stringify(closedFixtureConfiguration) + ')'
        : 'null') +
      ';',
  );
  source = source.replace(
    /const controlManagementAllocationApproval = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    'const controlManagementAllocationApproval = ' +
      (controlManagementAllocationConfiguration
        ? 'Object.freeze(' + JSON.stringify(controlManagementAllocationConfiguration) + ')'
        : 'null') +
      ';',
  );
  source = source.replace(
    /const preprivateAdminRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    'const preprivateAdminRecovery = ' +
      (preprivateAdminConfiguration
        ? 'Object.freeze(' + JSON.stringify(preprivateAdminConfiguration) + ')'
        : 'null') +
      ';',
  );
  source = source.replace(
    /const catalogReadonlyRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    'const catalogReadonlyRecovery = ' +
      (catalogReadonlyConfiguration
        ? 'Object.freeze(' + JSON.stringify(catalogReadonlyConfiguration) + ')'
        : 'null') +
      ';',
  );
  source = source.replace(
    /const catalogManagementAllocationApproval = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    'const catalogManagementAllocationApproval = ' +
      (catalogManagementAllocationConfiguration
        ? 'Object.freeze(' + JSON.stringify(catalogManagementAllocationConfiguration) + ')'
        : 'null') +
      ';',
  );
  source = source.replace(
    /const adminAdmissionReadonlyRecovery = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    'const adminAdmissionReadonlyRecovery = ' +
      (adminAdmissionReadonlyConfiguration
        ? 'Object.freeze(' + JSON.stringify(adminAdmissionReadonlyConfiguration) + ')'
        : 'null') +
      ';',
  );
  for (const [name, configuration] of Object.entries({
    runtimePreparationRecovery: runtimePreparationConfiguration,
    runtimeMetadataAllocationApproval: runtimeMetadataAllocationConfiguration,
    runtimeRestorationRecovery: runtimeRestorationConfiguration,
    runtimeRestorationAllocationApproval: runtimeRestorationAllocationConfiguration,
    restoredBrowserDiscoveryRecovery: restoredBrowserDiscoveryConfiguration,
    unadmittedWf00Recovery: unadmittedWf00Configuration,
  }))
    source = source.replace(
      new RegExp('const ' + name + ' = Object\\.freeze\\(\\{[\\s\\S]*?\\n\\}\\);'),
      'const ' +
        name +
        ' = ' +
        (configuration ? 'Object.freeze(' + JSON.stringify(configuration) + ')' : 'null') +
        ';',
    );
  if (runtimeSourceUnverified)
    source = source.replace(
      /export const foundationProjectVerifiedNextRuntime = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      (block) => block.replace('allFiveCiJobsPassed: true', 'allFiveCiJobsPassed: false'),
    );
  if (runtimeRestorationClosed && runtimeSourceUnverified)
    source = source.replace(
      /export const foundationProjectVerifiedRestoredRuntime = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      (block) => block.replace('allFiveCiJobsPassed: true', 'allFiveCiJobsPassed: false'),
    );
  if (closedFixture)
    source = source.replace(
      /export const foundationProjectVerifiedActiveRuntime = Object\.freeze\(\{[\s\S]*?\n\}\);/,
      (block) =>
        block
          .replace(/sourceCi: \d+/, 'sourceCi: 39990446858')
          .replace('allFiveCiJobsPassed: false', 'allFiveCiJobsPassed: true')
          .replace('vercelPassed: false', 'vercelPassed: true'),
    );
  // Explicitly retain the exhausted old50 branch as a synthetic regression.
  source = source.replace(/setupMaximum: (?:50|88),/, `setupMaximum: ${proposedBudgetApproved ? 88 : 50},`);
  for (const [match, relative] of [...source.matchAll(/from '(\.\.?\/[^']+)'/g)])
    source = source.replaceAll(
      match,
      `from '${pathToFileURL(join(sourceRoot, 'scripts/n8n', relative)).href}'`,
    );
  const modulePath = put('scripts/n8n/foundation-live-project-verified-continuation.mjs', source);
  const module = await import(pathToFileURL(modulePath).href);
  const localAppData = join(directory, 'synthetic-localappdata');
  put(
    'synthetic-localappdata/Temp/' +
      module.foundationProjectVerifiedContinuationCheckpoint.parentLockFilename,
    JSON.stringify({
      kind: 'm03_clock_admission_parent',
      version: 1,
      segmentId: snapshot.proposedSegmentId,
      processId: process.ppid,
    }) + '\n',
  );
  let time = Date.parse(
    technical16Settled
      ? '2026-10-24T23:00:00.000Z'
      : unadmittedWf00Reconciled
        ? '2026-10-24T16:10:00.000Z'
        : restoredBrowserRetryDiscovery
          ? '2026-10-24T15:40:00.000Z'
          : restoredBrowserDiscovery
            ? '2026-10-24T15:10:00.000Z'
            : runtimeRestorationClosed
              ? '2026-10-24T15:00:00.000Z'
              : runtimePreparationClosed
                ? '2026-10-24T11:00:00.000Z'
                : adminAdmissionReadonly
                  ? '2026-10-24T10:00:00.000Z'
                  : catalogReadonly
                    ? '2026-10-24T02:40:00.000Z'
                    : preprivateAdmin
                      ? '2026-10-24T02:00:00.000Z'
                      : closedFixture
                        ? '2026-10-24T00:46:00.000Z'
                        : closedWindow
                          ? '2026-10-23T18:00:00.000Z'
                          : effectful
                            ? '2026-10-23T15:00:00.000Z'
                            : '2026-10-22T18:00:00.000Z',
  );
  const now = () => time,
    io = { processAlive: () => false };
  const scoped = (run) => {
    const existed = Object.hasOwn(process.env, 'LOCALAPPDATA'),
      prior = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = localAppData;
    try {
      return run();
    } finally {
      if (existed) process.env.LOCALAPPDATA = prior;
      else delete process.env.LOCALAPPDATA;
    }
  };
  const copied = new Map();
  const coherentModules = new Set();
  const copy = (name) => {
    if (copied.has(name)) return copied.get(name);
    const loading = (async () => {
      const relativePath =
        name === 'foundation-admin-client.mjs' ? 'scripts/db/' + name : 'scripts/n8n/' + name;
      if (runtimeRestorationClosed) {
        // Only the restored-version profile crosses the new proof→plan boundary.
        // Keep its existing WeakMap brands in one isolated module graph; old
        // fixtures retain their original root-factory receipt identities.
        const pending = [relativePath];
        while (pending.length) {
          const path = pending.shift();
          if (coherentModules.has(path)) continue;
          coherentModules.add(path);
          const originalPath = join(sourceRoot, path);
          let text = readFileSync(originalPath, 'utf8');
          for (const match of [...text.matchAll(/(?:from\s*|import\s*\()'?(\.?\.?\/[^']+)'/g)]) {
            const imported = match[1],
              absolute = join(dirname(originalPath), imported),
              child = relative(sourceRoot, absolute).replaceAll('\\', '/');
            let target = absolute;
            if (child === 'scripts/n8n/foundation-live-project-verified-continuation.mjs')
              target = modulePath;
            else if (child.endsWith('.mjs') && child.startsWith('scripts/')) {
              target = join(directory, child);
              pending.push(child);
            }
            text = text.replaceAll("'" + imported + "'", "'" + pathToFileURL(target).href + "'");
          }
          put(path, text);
        }
        return import(pathToFileURL(join(directory, relativePath)).href);
      }
      const sourcePath = join(sourceRoot, relativePath);
      let text = readFileSync(sourcePath, 'utf8');
      for (const [match, relative] of [...text.matchAll(/from '(\.\.?\/[^']+)'/g)]) {
        const base = relative.split('/').at(-1);
        let url;
        if (base === 'foundation-live-project-verified-continuation.mjs')
          url = pathToFileURL(modulePath).href;
        else if (
          [
            'foundation-live-runtime.mjs',
            'foundation-control-state.mjs',
            'foundation-live-setup.mjs',
          ].includes(base)
        ) {
          await copy(base);
          url = pathToFileURL(join(directory, 'scripts/n8n', base)).href;
        } else url = pathToFileURL(join(dirname(sourcePath), relative)).href;
        text = text.replaceAll(match, `from '${url}'`);
      }
      return import(pathToFileURL(put(relativePath, text)).href);
    })();
    copied.set(name, loading);
    return loading;
  };
  return {
    directory,
    module,
    snapshot,
    checkpoint: module.foundationProjectVerifiedContinuationCheckpoint,
    now,
    io,
    put,
    localAppData,
    scoped,
    copy,
    paths: {
      management: join(directory, snapshot.journals.management.path),
      control: join(directory, snapshot.journals.control.path),
      setup: join(directory, snapshot.journals.setup.path),
      admission: join(directory, module.foundationProjectVerifiedContinuationCheckpoint.admissionRelative),
      claim: join(directory, module.foundationProjectVerifiedContinuationCheckpoint.claimRelative),
    },
    setTime: (t) => {
      time = t;
    },
    check: () => scoped(() => module.verifyFoundationProjectVerifiedContinuation({ now }, io)),
    admit: () => scoped(() => module.admitFoundationProjectVerifiedContinuation({ now }, io)),
    read: () => scoped(() => module.readFoundationProjectVerifiedContinuation({ now }, io)),
    readClaimed: () => scoped(() => module.readClaimedFoundationProjectVerifiedContinuation({ now }, io)),
    claim: (p) => scoped(() => module.claimFoundationProjectVerifiedContinuation(p, { now }, io)),
    cleanup: () => {
      const resolved = realpathSync(directory);
      const within = relative(ownedTempRoot, resolved);
      if (resolved !== ownedDirectory || !within || within.startsWith('..') || isAbsolute(within))
        throw Error('SYNTHETIC_CLEANUP_BOUNDARY');
      rmSync(resolved, { recursive: true, force: true });
    },
  };
}
