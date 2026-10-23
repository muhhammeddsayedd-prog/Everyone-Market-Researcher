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
  readonlyPrepare = false,
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
  let closedConfiguration, restoreConfiguration, allocationConfiguration, readonlyPrepareConfiguration;
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
      const values = original.trimEnd().split('\n').map(JSON.parse);
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
    closedWindow
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
