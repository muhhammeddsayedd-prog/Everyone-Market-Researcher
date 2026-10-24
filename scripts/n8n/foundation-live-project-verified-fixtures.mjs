// Complete isolated synthetic authority fixture. Never imports or reads actual journals.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
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
  preprivateAdmin = false,
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
  if (approved)
    put(
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-approval-20261022.json',
      approvalText,
    );
  let source = readFileSync(
    join(sourceRoot, 'scripts/n8n/foundation-live-project-verified-continuation.mjs'),
    'utf8',
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
    preprivateAdmin
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
  const copy = (name) => {
    if (copied.has(name)) return copied.get(name);
    const loading = (async () => {
      const relativePath =
        name === 'foundation-admin-client.mjs' ? 'scripts/db/' + name : 'scripts/n8n/' + name;
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
