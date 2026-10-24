import {
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  lstatSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { dirname, resolve, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  foundationScope,
  parseLedger,
  runShellProvision,
  restoreOwnedWf00,
  wf00RestoreScope,
  wf00RestoreReadOnlyAttempt,
} from './foundation-provision.mjs';
import { foundationManagementTransport } from './foundation-management-transport.mjs';
import { parseFoundationPacket, createBindingJournal, machineBody } from './foundation-bind.mjs';
import { runAllProvision } from './foundation-all.mjs';
import { foundationTagNames } from '../../packages/shared/src/n8n-bindings.ts';
import { createOwnedStagingExportWriter, writeCompleteSync } from './foundation-export.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(repo, 'scripts/n8n/out/foundation'),
  journalPath = join(out, 'owned-shells.jsonl');
const fail = () => {
  throw Error('FOUNDATION_CHILD_BLOCKED');
};
function noLinks(path) {
  const absolute = resolve(path),
    root = parse(absolute).root;
  let cursor = root;
  for (const part of absolute.slice(root.length).split(/[\\/]/).filter(Boolean)) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) fail();
  }
  return absolute;
}
function readJournal() {
  noLinks(journalPath);
  if (!existsSync(journalPath)) return [];
  if (lstatSync(journalPath).size > 65536) fail();
  const text = readFileSync(journalPath, 'utf8');
  if (!text.endsWith('\n')) fail();
  const rows = text
    .trimEnd()
    .split('\n')
    .map((x) => JSON.parse(x));
  const head = rows.shift();
  if (
    !head ||
    Object.keys(head).sort().join(',') !== 'version,windowId' ||
    head.version !== 1 ||
    head.windowId !== foundationScope.windowId
  )
    fail();
  parseLedger(rows);
  return rows;
}
function journal() {
  const rows = readJournal();
  noLinks(out);
  mkdirSync(out, { recursive: true });
  noLinks(out);
  if (!existsSync(journalPath)) {
    const fd = openSync(journalPath, 'wx');
    try {
      writeCompleteSync(fd, JSON.stringify({ version: 1, windowId: foundationScope.windowId }) + '\n');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  return {
    rows,
    append(row) {
      parseLedger([...rows, row]);
      noLinks(journalPath);
      const fd = openSync(journalPath, 'a');
      try {
        writeCompleteSync(fd, JSON.stringify(row) + '\n');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      rows.push(structuredClone(row));
    },
  };
}
function packet() {
  const target = noLinks(join(repo, 'scripts/n8n/foundation-delivery-packet.json'));
  if (!existsSync(target)) return null;
  if (lstatSync(target).size > 4096) fail();
  return parseFoundationPacket(JSON.parse(readFileSync(target, 'utf8')));
}
function bindingJournal() {
  const path = noLinks(join(out, 'binding-intents.jsonl'));
  let rows = [];
  if (existsSync(path)) {
    if (lstatSync(path).size > 131072) fail();
    const text = readFileSync(path, 'utf8');
    if (!text.endsWith('\n')) fail();
    rows = text
      .trimEnd()
      .split('\n')
      .map((x) => JSON.parse(x));
    const head = rows.shift();
    if (
      !head ||
      Object.keys(head).sort().join(',') !== 'kind,version,windowId' ||
      head.version !== 1 ||
      head.windowId !== foundationScope.windowId ||
      head.kind !== 'inactive_binding_intents'
    )
      fail();
  }
  if (!existsSync(path)) {
    const fd = openSync(path, 'wx');
    try {
      writeCompleteSync(
        fd,
        JSON.stringify({ version: 1, windowId: foundationScope.windowId, kind: 'inactive_binding_intents' }) +
          '\n',
      );
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  return createBindingJournal(rows, (row) => {
    noLinks(path);
    const fd = openSync(path, 'a');
    try {
      writeCompleteSync(fd, JSON.stringify(row) + '\n');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  });
}
async function input(requireMachine = false, restore = false, technical13 = false, technical16 = false) {
  const chunks = [];
  let bytes = 0;
  try {
    for await (const b of process.stdin) {
      bytes += b.length;
      if (bytes > 8192) {
        b.fill(0);
        fail();
      }
      chunks.push(b);
    }
    const p = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      !p ||
      Object.keys(p).sort().join(',') !==
        (requireMachine ? 'expiresAt,key,machine,purpose,windowId' : 'expiresAt,key,purpose,windowId') ||
      p.purpose !==
        (technical16
          ? 'm03_technical16_native_cleanup'
          : technical13
            ? 'm03_technical13_runtime_restoration'
            : restore
              ? 'm03_owned_wf00_restore'
              : 'm03_owned_inactive_provision') ||
      p.windowId !==
        (technical16
          ? '4c602549-2c42-4ec3-9328-714d7cb66a77'
          : technical13
            ? '3c46c791-e140-4eb9-890a-eecfa251f65e'
            : foundationScope.windowId)
    )
      fail();
    const expiry = Date.parse(p.expiresAt),
      now = Date.now();
    if (
      typeof p.expiresAt !== 'string' ||
      !Number.isFinite(expiry) ||
      expiry < now + (restore ? 60000 : 2460000) ||
      expiry > now + (restore ? 300000 : 7200000)
    )
      fail();
    return { key: p.key, machine: p.machine, deadlineMs: expiry };
  } finally {
    for (const b of chunks) b.fill(0);
  }
}
function restoreTarget() {
  const file = noLinks(join(repo, 'n8n/fixtures/WF-00-reviewed-native-staging-025c2a2.json')),
    stat = lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 262144) fail();
  const bytes = readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !== wf00RestoreScope.sourceFileSha256) fail();
  const approval = JSON.parse(
    readFileSync(
      noLinks(join(repo, 'milestones/M03-n8n-foundation/evidence/wf00-restore-approval-20261023.json')),
      'utf8',
    ),
  );
  if (
    approval.workflowId !== wf00RestoreScope.workflowId ||
    approval.projectId !== foundationScope.projectId ||
    approval.sourceCommitSha !== wf00RestoreScope.sourceCommitSha ||
    approval.ownerReply !== 'Restore reviewed WF-00 (Recommended)' ||
    approval.privateEncryptedRollbackRequired !== true ||
    approval.freshDriftRecheckRequired !== true ||
    approval.savedGraphReadbackRequired !== true ||
    approval.otherWorkflowMutationAllowed !== false ||
    approval.executionAllowed !== false ||
    approval.productionAllowed !== false ||
    approval.budgetReplenished !== false
  )
    fail();
  return JSON.parse(bytes.toString('utf8'));
}
function restoreReadOnlyReceipt() {
  const path = noLinks(join(repo, wf00RestoreReadOnlyAttempt.receiptFile)),
    stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16384) fail();
  const bytes = readFileSync(path);
  if (createHash('sha256').update(bytes).digest('hex') !== wf00RestoreReadOnlyAttempt.receiptSha256) fail();
  const receipt = JSON.parse(bytes.toString('utf8')),
    actual = receipt.actual;
  if (
    receipt.kind !== 'actual_owned_wf00_restore_attempt' ||
    receipt.toolReceipt !== wf00RestoreReadOnlyAttempt.toolReceipt ||
    receipt.environment !== 'dev' ||
    receipt.host !== foundationScope.host ||
    receipt.projectId !== foundationScope.projectId ||
    receipt.workflowId !== wf00RestoreScope.workflowId ||
    actual?.nativeExit !== 1 ||
    actual.requestCount !== 1 ||
    actual.getCount !== 1 ||
    actual.putCount !== 0 ||
    actual.backupReady !== true ||
    actual.backupRunId !== wf00RestoreReadOnlyAttempt.backupRunId ||
    actual.writeIntentRecorded !== false ||
    actual.putAttempted !== false ||
    actual.restored !== false ||
    actual.networkCompletionVerified !== true ||
    actual.childClosed !== true ||
    actual.parentLockDeleted !== true ||
    actual.persistentManagementRetained !== true ||
    receipt.journal?.rowCount !== 2 ||
    receipt.journal.sha256 !== wf00RestoreReadOnlyAttempt.journalPrefixSha256 ||
    JSON.stringify(receipt.journal.rows) !== JSON.stringify(wf00RestoreReadOnlyAttempt.rows)
  )
    fail();
  return true;
}
function restoreJournal() {
  const readOnlyAttemptVerified = restoreReadOnlyReceipt();
  noLinks(out);
  mkdirSync(out, { recursive: true });
  noLinks(out);
  const path = noLinks(join(out, 'wf00-restore-20261023.jsonl'));
  const rows = [];
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 65536) fail();
  const bytes = readFileSync(path),
    text = bytes.toString('utf8');
  if (
    !text.endsWith('\n') ||
    createHash('sha256').update(bytes).digest('hex') !== wf00RestoreReadOnlyAttempt.journalPrefixSha256
  )
    fail();
  rows.push(
    ...text
      .trimEnd()
      .split('\n')
      .map((x) => JSON.parse(x)),
  );
  if (JSON.stringify(rows) !== JSON.stringify(wf00RestoreReadOnlyAttempt.rows)) fail();
  return {
    rows,
    readOnlyAttemptVerified,
    append(row) {
      const expected = [
        'restore_continuation',
        'request',
        'backup_ready',
        'restore_intent',
        'request',
        'request',
        'restore_verified',
      ];
      if (row.event !== expected[rows.length - 2]) fail();
      const allowed =
        row.event === 'request'
          ? ['event', 'number', 'method', 'path']
          : row.event === 'restore_continuation'
            ? ['event', 'workflowId', 'priorToolReceipt', 'priorRequestCount', 'priorBackupRunId']
            : row.event === 'backup_ready'
              ? ['event', 'workflowId', 'backupRunId']
              : row.event === 'restore_intent'
                ? ['event', 'workflowId', 'sourceCommitSha', 'backupRunId']
                : row.event === 'restore_verified'
                  ? ['event', 'workflowId', 'versionId', 'backupRunId', 'nativeReadonlySettings']
                  : null;
      if (
        !allowed ||
        Object.keys(row).length !== allowed.length ||
        allowed.some((k) => !Object.hasOwn(row, k))
      )
        fail();
      if (row.event === 'request') {
        const number = rows.filter((x) => x.event === 'request').length + 1;
        if (
          row.number !== number ||
          number > 4 ||
          row.method !== (number === 3 ? 'PUT' : 'GET') ||
          row.path !==
            '/api/v1/workflows/' +
              wf00RestoreScope.workflowId +
              (number === 3 ? '?publishIfActive=false' : '?excludePinnedData=true') ||
          (number === 3 && !rows.some((x) => x.event === 'restore_intent'))
        )
          fail();
      } else if (row.event === 'restore_continuation') {
        if (
          row.workflowId !== wf00RestoreScope.workflowId ||
          row.priorToolReceipt !== wf00RestoreReadOnlyAttempt.toolReceipt ||
          row.priorRequestCount !== 1 ||
          row.priorBackupRunId !== wf00RestoreReadOnlyAttempt.backupRunId
        )
          fail();
      } else if (
        row.workflowId !== wf00RestoreScope.workflowId ||
        typeof row.backupRunId !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.backupRunId) ||
        row.backupRunId === wf00RestoreReadOnlyAttempt.backupRunId ||
        (row.event === 'restore_intent' &&
          (row.sourceCommitSha !== wf00RestoreScope.sourceCommitSha ||
            rows[4].event !== 'backup_ready' ||
            rows[4].backupRunId !== row.backupRunId)) ||
        (row.event === 'restore_verified' &&
          (typeof row.versionId !== 'string' ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(row.versionId) ||
            !row.nativeReadonlySettings ||
            Object.keys(row.nativeReadonlySettings).length !== 1 ||
            !Object.hasOwn(row.nativeReadonlySettings, 'binaryMode') ||
            !['separate', 'combined'].includes(row.nativeReadonlySettings.binaryMode) ||
            rows[4].backupRunId !== row.backupRunId ||
            rows.filter((x) => x.event === 'request').length !== 4))
      )
        fail();
      noLinks(path);
      const fd = openSync(path, existsSync(path) ? 'a' : 'wx');
      try {
        writeCompleteSync(fd, JSON.stringify(row) + '\n');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      rows.push(structuredClone(row));
    },
  };
}
async function protectRestoreBackup(dto) {
  const runId = randomUUID(),
    payload = Buffer.from(JSON.stringify({ kind: 'wf00_restore_backup', runId, dto }));
  if (payload.length > 1048576) fail();
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
  return new Promise((resolveBackup, rejectBackup) => {
    let child,
      body = '',
      invalid = false,
      timer,
      closed = false;
    const reject = () => rejectBackup(Error('FOUNDATION_BACKUP_BLOCKED'));
    try {
      child = spawn(
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-File',
          noLinks(join(repo, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1')),
          '-Mode',
          'ProtectWf00Backup',
        ],
        { cwd: repo, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      timer = setTimeout(() => {
        invalid = true;
        try {
          child.kill();
        } catch {}
      }, 20000);
      child.stdout.on('data', (chunk) => {
        if (invalid) return;
        body += chunk.toString('utf8');
        if (Buffer.byteLength(body) > 4096) {
          invalid = true;
          body = '';
          try {
            child.kill();
          } catch {}
        }
      });
      child.stderr.on('data', () => {});
      child.on('error', () => {
        invalid = true;
        try {
          child.kill();
        } catch {}
      });
      child.on('close', (code) => {
        closed = true;
        clearTimeout(timer);
        payload.fill(0);
        if (invalid || code !== 0) {
          reject();
          return;
        }
        try {
          const result = JSON.parse(body);
          if (
            result.kind !== 'wf00_restore_backup_ready' ||
            result.runId !== runId ||
            result.backupReady !== true ||
            result.childNoCredential !== true
          )
            fail();
          resolveBackup(result);
        } catch {
          reject();
        } finally {
          body = '';
        }
      });
      child.stdin.on('error', () => {
        invalid = true;
        try {
          child.kill();
        } catch {}
      });
      child.stdin.end(payload, () => payload.fill(0));
      // No GET/PUT follows until the backup child reports physical closure.
    } catch {
      clearTimeout(timer);
      payload.fill(0);
      if (child && !closed) {
        try {
          child.kill();
        } catch {}
      }
      reject();
    }
  });
}
const technical13 = Object.freeze({
  windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
  sourceCommitSha: '7b1837201ac7925591577a1517d7288936ca3464',
  receiptSha256: '226ed15257e8fb5ac2c81f454631bcf11773f67ce9fdc15d6048184389260983',
  readbackFile: 'milestones/M03-n8n-foundation/evidence/runtime-reconciliation-readback-20261024.json',
  readbackSha256: 'f03218c0f734e81d153b5123a9a8edc662b0dc1796f434e0a352a95c46575bdc',
  attemptFile: 'scripts/n8n/out/foundation/runtime-technical13-restoration-attempt.json',
  journalFile: 'scripts/n8n/out/foundation/runtime-technical13-restoration.jsonl',
  resultFile: 'scripts/n8n/out/foundation/runtime-technical13-restoration-result.json',
});
export const foundationTechnical16CleanupScope = Object.freeze({
  technicalAttempt: 16,
  windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
  sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
  executionIds: Object.freeze(['31131', '31130']),
  maximumRequests: 154,
  maximumControlRequests: 154,
  forensicAllocationMaximum: 160,
  forensicRequestsAlreadyCharged: 6,
  canonicalWorkflowCount: 25,
  maximumDrainRequests: 100,
});
const technical16Cleanup = Object.freeze({
  executedBodyResolutionFile:
    'milestones/M03-n8n-foundation/evidence/technical16-executed-parameters-resolution-20261024.json',
  // This qualifies the source-derived parameter candidate only; the fresh
  // cleanup-only reader still has to prove ownership, terminal links and drain.
  executedBodyResolutionSha256: 'e0c919ab2a12aa9306be3d2b3656b7d0c43d97c21ddc6376ffa12bbfbb89d07b',
  attemptFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt.json',
  journalFile: 'scripts/n8n/out/foundation/technical16-native-cleanup.jsonl',
  resultFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-result.json',
  failedEntryFile: 'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt1-20261024.json',
  failedEntrySha256: '4f0697080d9bd1ff728b48d9c159f4cbe6f61ebaa04d19ec295da14c3e297960',
  failedOnceSha256: '1e165ea75442200af05e57206c32cd0edc07c248571a1405ae8025e31588e66e',
  failedJournalSha256: '4fccea19e19a162ca2d7b912c200a0cb1fc857b9ea54d4bdf5b6f97f76dd71d7',
  failedSealFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.provision-seal.json',
  failedSealSha256: '9aade5d3ae4c4a0a3aace8da74c38e3b0c9f1da672d7187c7ff1b14aeee9ca1b',
  failedLockSha256: 'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f',
  failedLockArchiveFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.runtime-lock',
  failedSecondFile:
    'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt2-20261024.json',
  failedSecondSha256: '5b2f8e590876f37d89aad2a35151e07489c4601111af09c27b01268f43df0c57',
  failedSecondOnceFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.json',
  failedSecondOnceSha256: '86e74f0c574384e33c28721b345899476d198d49e91501c3f37d8a27f9361639',
  failedSecondJournalFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.jsonl',
  failedSecondJournalSha256: 'bac9e865ea04c6f083dc836e2e71e0cd37a58dc542a5f03af7ed06767b66ee17',
  failedSecondResultFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2-result.json',
  failedSecondResultSha256: 'efa7b2812baf34f520eac9bea4337b5197bfc680244acaaabe6fcead8a55c137',
  failedSecondSealFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.provision-seal.json',
  failedSecondSealSha256: '45a924660d94d87a5fc9eab45307c550a74288b6556873633c39b571c37b62be',
  failedSecondLockArchiveFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.runtime-lock',
});
const technical16CleanupContexts = new WeakMap();
export function assertTechnical16CleanupContext(context) {
  const value = technical16CleanupContexts.get(context);
  if (!value || !Object.isFrozen(context)) fail();
  value.assertCurrent();
  return value;
}
export async function checkTechnical16Cleanup() {
  if (
    typeof technical16Cleanup.executedBodyResolutionSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(technical16Cleanup.executedBodyResolutionSha256)
  )
    fail();
  const pins = new Map();
  const read = (path, expected) => {
    const absolute = noLinks(join(repo, path)),
      stat = lstatSync(absolute);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 2097152) fail();
    const bytes = readFileSync(absolute),
      hash = publicHash(bytes);
    if (expected !== undefined && hash !== expected) fail();
    pins.set(path, hash);
    return bytes.toString('utf8');
  };
  const evidence = 'milestones/M03-n8n-foundation/evidence/';
  const original = JSON.parse(
    read(
      evidence + 'dev-acceptance-technical16-reconciliation-20261024.json',
      'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb',
    ),
  );
  const cleanup = JSON.parse(
    read(
      evidence + 'dev-acceptance-technical16-cleanup-20261024.json',
      '49192237b29231f20f67595fdc7522b49926f10c8e278bea3871cf75a9788b57',
    ),
  );
  const custody = JSON.parse(
    read(
      evidence + 'technical16-postclose-custody-20261024.json',
      'a0bf0dccf6bcf19027d1aba99601fe61a117fec8900128800d3bf3cfa63874cf',
    ),
  );
  const db = JSON.parse(
    read(
      evidence + 'technical16-postclose-db-readback-20261024.json',
      '68f02df7aab0b468ff202ec99630207650fa503eda57b46f81a1166fad9ab222',
    ),
  );
  const resolution = JSON.parse(
    read(technical16Cleanup.executedBodyResolutionFile, technical16Cleanup.executedBodyResolutionSha256),
  );
  if (
    original.attempt?.technicalAttempt !== 16 ||
    original.attempt.nativeExit !== 1 ||
    original.attempt.executionIdObserved !== '31130' ||
    original.attempt.caseId !== 'dispatch.vimeo' ||
    original.source?.applicationSource !== foundationTechnical16CleanupScope.sourceCommitSha ||
    original.rawTechnicalClose?.childClosed !== true ||
    original.rawTechnicalClose.credentialChildrenClosed !== true ||
    cleanup.allTenDisposableLeavesAbsent !== true ||
    cleanup.parentProcessAbsent !== true ||
    cleanup.runtimeProcessAbsent !== true ||
    cleanup.parentLockAbsent !== true ||
    cleanup.runtimeLockAbsent !== true ||
    custody.restoration?.restoreComplete !== true ||
    custody.restoration.finalWorkflowAudits !== 25 ||
    custody.restoration.pendingIntents !== 0 ||
    custody.restoration.baselineRestored !== true ||
    db.rawResult?.status !== 'inspection_verified' ||
    db.rawResult.childrenClosed !== true ||
    db.rawResult.inspection?.familyWindowCount !== 5 ||
    db.rawResult.inspection.globalAdmittedCount !== 9 ||
    db.rawResult.inspection.globalRequestCount !== 4 ||
    db.rawResult.inspection.fixtureAuditCount !== 7 ||
    db.rawResult.inspection.globalLaunchCount !== 0 ||
    resolution.kind !== 'm03_technical16_executed_parameters_resolution' ||
    resolution.version !== 1 ||
    resolution.environment !== 'dev' ||
    resolution.technicalAttempt !== 16 ||
    resolution.originalAttemptSha256 !== 'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb' ||
    resolution.rootExecutionId !== '31130' ||
    resolution.childExecutionId !== '31131' ||
    resolution.sourceCommitSha !== foundationTechnical16CleanupScope.sourceCommitSha ||
    resolution.windowId !== foundationTechnical16CleanupScope.windowId ||
    resolution.parametersQualified !== true ||
    resolution.nativeAcceptanceProven !== false ||
    resolution.settlementProven !== false ||
    resolution.originalMaskedFirstFailureRecovered !== false ||
    resolution.usage?.management !== 829 ||
    resolution.usage.control !== 960 ||
    resolution.usage.combined !== 1789 ||
    resolution.usage.vercel !== 184
  )
    fail();
  for (const name of [
    'activeLeaseCount',
    'actorRunCount',
    'collectedItemCount',
    'costEntryCount',
    'costUsd',
    'incompleteRequests',
    'launchCount',
    'reservedRequests',
    'scrapeRunCount',
  ])
    if (db.rawResult.inspection[name] !== 0) fail();
  for (const [path, hash] of Object.entries(original.pins ?? {})) read(path, hash);
  for (const [path, hash] of Object.entries(custody.pins ?? {})) read(path, hash);
  const dbLatest = 'scripts/db/out/m03-foundation-inspect-1b7b1987-ac32-4e3a-914c-9bda1b1b6d74-latest.json';
  const rawDb = JSON.parse(read(dbLatest, db.pins?.[dbLatest]));
  if (JSON.stringify(rawDb) !== JSON.stringify(db.rawResult)) fail();
  const rows = read('scripts/n8n/out/foundation/live/runtime.technical-16.jsonl')
    .trimEnd()
    .split('\n')
    .map(JSON.parse);
  const controls = read('scripts/n8n/out/foundation/live/control.jsonl')
    .trimEnd()
    .split('\n')
    .map(JSON.parse);
  const ack = controls.filter((row) => row.event === 'native_start_ack' && row.executionId === '31130');
  if (
    ack.length !== 1 ||
    ack[0].caseId !== 'dispatch.vimeo' ||
    ack[0].workflowKey !== 'WF-00' ||
    !Number.isFinite(Date.parse(ack[0].intentAt))
  )
    fail();
  const [
    { materializeFoundationAcceptanceCase },
    { buildFoundationGatewayWorkflows },
    { graphBody },
    retention,
    { createFoundationRuntimeBaseline, freezeRuntimeValue },
    { foundationRuntimeGraphHash },
  ] = await Promise.all([
    import('../../n8n/foundation/materialize-acceptance-case.mjs'),
    import('../../n8n/foundation/build-foundation-gateway.mjs'),
    import('./foundation-bind.mjs'),
    import('./foundation-retention-proposal.mjs'),
    import('./foundation-runtime-plan.mjs'),
    import('./foundation-runtime-checkpoint.mjs'),
  ]);
  const bindings = JSON.parse(read('n8n/foundation/bindings.dev.json'));
  const transport = JSON.parse(read('n8n/foundation/transport.dev.json'));
  const records = Object.keys(bindings.workflowRefs).map((key) =>
    JSON.parse(read('n8n/workflows/' + key + '.json')),
  );
  const versions = custody.restoration.restoredVersions;
  if (
    !versions ||
    Object.keys(versions).length !== 25 ||
    publicHash(JSON.stringify(versions)) !==
      '4cd07e958dc736cf07fb83c7b83a9805f67dc755f2628c8613acd3acae356de2'
  )
    fail();
  const baseline = createFoundationRuntimeBaseline({ bindings, records }).map((record) => ({
    ...record,
    versionId: versions[record.key],
  }));
  if (baseline.some((record) => !/^[A-Za-z0-9_-]{1,128}$/.test(record.versionId))) fail();
  const retentionPolicy = retention.createFoundationApprovedRetentionPolicy({ bindings, records });
  const runtimeTransport = {
    credential: transport.credential,
    audience: db.rawResult.inspection.window.audience,
    windowId: foundationTechnical16CleanupScope.windowId,
  };
  const rootGraph = materializeFoundationAcceptanceCase(bindings, runtimeTransport, 'dispatch.vimeo');
  const rootBody = graphBody(rootGraph);
  rootBody.settings = retention.applyFoundationApprovedRetentionSettings(
    retentionPolicy,
    'WF-00',
    rootBody.settings,
  );
  rootBody.settings.availableInMCP = true;
  for (const node of rootBody.nodes)
    if (
      node.type !== 'n8n-nodes-base.manualTrigger' &&
      (/Trigger$/.test(node.type) || ['n8n-nodes-base.webhook', 'n8n-nodes-base.form'].includes(node.type))
    )
      node.disabled = true;
  const childGraph = buildFoundationGatewayWorkflows(bindings, runtimeTransport).find(
    (graph) => graph.key === 'WF-10',
  );
  const childBody = graphBody(childGraph);
  for (const node of childBody.nodes)
    if (node.type === 'n8n-nodes-base.scheduleTrigger') node.disabled = true;
  childBody.settings = retention.applyFoundationApprovedRetentionSettings(
    retentionPolicy,
    'WF-10',
    childBody.settings,
  );
  childBody.settings.availableInMCP = false;
  childBody.settings.errorWorkflow = bindings.workflowRefs['WF-90'].id;
  const historicalBinding = (key, body, exactSequence) => {
    const hash = foundationRuntimeGraphHash(body);
    const intents = rows.filter(
      (row) =>
        row.event === 'intent' &&
        row.key === key &&
        row.action === 'save' &&
        row.sequence <= 37 &&
        row.target?.graphHash === hash &&
        (exactSequence === undefined || row.sequence === exactSequence),
    );
    const intent = intents.at(-1),
      verified = rows.filter((row) => row.event === 'verified' && row.sequence === intent?.sequence);
    if (
      !intent ||
      verified.length !== 1 ||
      verified[0].after?.graphHash !== hash ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(verified[0].after.versionId)
    )
      fail();
    const record = baseline.find((value) => value.key === key);
    return {
      workflowId: record.id,
      versionId: verified[0].after.versionId,
      activeVersionId: verified[0].after.activeVersionId,
      bodyHash: hash,
      body,
      ...(record.nativeReadonlySettings ? { nativeReadonlySettings: record.nativeReadonlySettings } : {}),
    };
  };
  const rootBinding = historicalBinding('WF-00', rootBody, 37),
    childBinding = historicalBinding('WF-10', childBody);
  if (rootBinding.versionId !== ack[0].versionId) fail();
  let cleanupAttempt = 1,
    paths = technical16Cleanup;
  const lockPath = noLinks(join(repo, 'scripts/n8n/out/foundation/live/runtime.operation.lock'));
  if (
    typeof technical16Cleanup.failedEntrySha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(technical16Cleanup.failedEntrySha256)
  ) {
    const failed = JSON.parse(read(technical16Cleanup.failedEntryFile, technical16Cleanup.failedEntrySha256));
    const once = JSON.parse(read(technical16Cleanup.attemptFile, technical16Cleanup.failedOnceSha256)),
      header = read(technical16Cleanup.journalFile, technical16Cleanup.failedJournalSha256),
      seal = JSON.parse(read(technical16Cleanup.failedSealFile, technical16Cleanup.failedSealSha256));
    const expectedHeader =
      JSON.stringify({
        event: 'technical16_cleanup_header',
        version: 1,
        resolutionSha256: technical16Cleanup.executedBodyResolutionSha256,
        originalAttemptSha256: 'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb',
      }) + '\n';
    const dead = (pid) => {
      if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid || pid === process.ppid) fail();
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error?.code === 'ESRCH') return;
      }
      fail();
    };
    if (
      failed.kind !== 'm03_technical16_native_cleanup_failed_attempt' ||
      failed.version !== 1 ||
      failed.environment !== 'dev' ||
      failed.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      failed.technicalAttempt !== 16 ||
      failed.cleanupAttempt !== 1 ||
      failed.originalAttemptSha256 !== 'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb' ||
      failed.resolutionSha256 !== technical16Cleanup.executedBodyResolutionSha256 ||
      failed.rootExecutionId !== '31130' ||
      failed.childExecutionId !== '31131' ||
      failed.windowId !== foundationTechnical16CleanupScope.windowId ||
      failed.outerNativeExit !== 1 ||
      failed.rawResult?.nativeExit !== 13 ||
      failed.rawResult.requestCount !== 0 ||
      failed.rawResult.controlRequestCount !== 0 ||
      failed.rawResult.recordsDeleted !== 0 ||
      failed.rawResult.qualifiedSideEffects !== false ||
      failed.rawResult.remoteWorkSettled !== false ||
      failed.rawResult.childClosed !== true ||
      failed.rawResult.credentialChildrenClosed !== true ||
      failed.rawResult.diagnosticStage !== 'result_contract' ||
      failed.cleanup?.parentAbsent !== true ||
      failed.cleanup.childAbsent !== true ||
      failed.cleanup.parentLockAbsent !== true ||
      failed.cleanup.runtimeLockPresent !== true ||
      failed.durableState?.journalHeaderCount !== 1 ||
      failed.durableState.httpIntentCount !== 0 ||
      failed.durableState.deleteIntentCount !== 0 ||
      failed.durableState.nativeResultFilePresent !== false ||
      failed.durableState.zeroRemoteCallsSourceQualified !== true ||
      failed.durableState.consumedMutationClaimReusable !== false ||
      failed.cause?.classification !== 'native_entry_top_level_await_cycle' ||
      failed.usage?.management !== 829 ||
      failed.usage.control !== 960 ||
      failed.usage.combined !== 1789 ||
      failed.usage.vercel !== 184 ||
      failed.usage.actorStarts !== 0 ||
      failed.pins?.[technical16Cleanup.attemptFile] !== technical16Cleanup.failedOnceSha256 ||
      failed.pins[technical16Cleanup.journalFile] !== technical16Cleanup.failedJournalSha256 ||
      failed.pins[technical16Cleanup.failedSealFile] !== technical16Cleanup.failedSealSha256 ||
      failed.pins['scripts/n8n/out/foundation/live/runtime.operation.lock'] !==
        technical16Cleanup.failedLockSha256 ||
      once.kind !== 'm03_technical16_cleanup_once' ||
      once.version !== 1 ||
      once.processId !== failed.cleanup.childProcessId ||
      once.parentProcessId !== failed.cleanup.parentProcessId ||
      once.resolutionSha256 !== technical16Cleanup.executedBodyResolutionSha256 ||
      JSON.stringify(once.executionIds) !== JSON.stringify(['31131', '31130']) ||
      once.maximumRequests !== 158 ||
      once.maximumControlRequests !== 158 ||
      once.usage?.management !== 829 ||
      once.usage.control !== 960 ||
      once.usage.combined !== 1789 ||
      header !== expectedHeader ||
      seal.version !== 2 ||
      !seal.files ||
      Object.keys(seal.files).length !== 91 ||
      seal.files['scripts/n8n/foundation-provision-cli.mjs'] !==
        '70ccd4efafe4cbc2d25a723c527ec5fc883993eee21b67c65bee455f6c41905f' ||
      seal.files['scripts/n8n/foundation-native-reader.mjs'] !==
        'fc7279cbf4568e1e0268328ca5641ab9be65742187aaaccad9a4cbfd2543abfc' ||
      seal.files['scripts/n8n/windows/Invoke-M03FoundationProvision.ps1'] !==
        '8ce86d0a26041f9ea446afce21bf9e64ef7399aa59515c924d6337a8759716c7'
    )
      fail();
    dead(once.processId);
    dead(once.parentProcessId);
    if (existsSync(noLinks(join(repo, technical16Cleanup.resultFile)))) fail();
    read(technical16Cleanup.failedLockArchiveFile, technical16Cleanup.failedLockSha256);
    const second = JSON.parse(
        read(technical16Cleanup.failedSecondFile, technical16Cleanup.failedSecondSha256),
      ),
      secondOnce = JSON.parse(
        read(technical16Cleanup.failedSecondOnceFile, technical16Cleanup.failedSecondOnceSha256),
      ),
      secondJournal = read(
        technical16Cleanup.failedSecondJournalFile,
        technical16Cleanup.failedSecondJournalSha256,
      ),
      secondResult = JSON.parse(
        read(technical16Cleanup.failedSecondResultFile, technical16Cleanup.failedSecondResultSha256),
      ),
      secondSeal = JSON.parse(
        read(technical16Cleanup.failedSecondSealFile, technical16Cleanup.failedSecondSealSha256),
      );
    if (
      second.kind !== failed.kind ||
      second.version !== 1 ||
      second.environment !== 'dev' ||
      second.projectRef !== 'zmotjsbzhzjvpelxvxlf' ||
      second.technicalAttempt !== 16 ||
      second.cleanupAttempt !== 2 ||
      second.outerNativeExit !== 1 ||
      second.windowId !== foundationTechnical16CleanupScope.windowId ||
      second.rootExecutionId !== '31130' ||
      second.childExecutionId !== '31131' ||
      second.originalAttemptSha256 !== failed.originalAttemptSha256 ||
      second.resolutionSha256 !== technical16Cleanup.executedBodyResolutionSha256 ||
      second.priorFailedAttemptSha256 !== technical16Cleanup.failedEntrySha256 ||
      second.rawResult?.status !== 'cleanup_reconciliation_required' ||
      second.rawResult.nativeExit !== 1 ||
      second.rawResult.requestCount !== 4 ||
      second.rawResult.controlRequestCount !== 4 ||
      second.rawResult.managementAttempts !== 833 ||
      second.rawResult.controlAttempts !== 964 ||
      second.rawResult.combinedAttempts !== 1797 ||
      second.rawResult.recordsDeleted !== 0 ||
      second.rawResult.qualifiedSideEffects !== false ||
      second.rawResult.remoteWorkSettled !== false ||
      second.rawResult.networkCompletionVerified !== true ||
      second.rawResult.originalPublicRecordsUnchanged !== true ||
      second.rawResult.childClosed !== true ||
      second.rawResult.credentialChildrenClosed !== true ||
      second.rawResult.parentLockDeleted !== true ||
      second.rawResult.diagnosticStage !== 'qualification' ||
      second.rawResult.diagnosticCode !== 'native_CLEANUP_QUALIFICATION' ||
      second.cleanup?.parentAbsent !== true ||
      second.cleanup.childAbsent !== true ||
      second.cleanup.parentLockAbsent !== true ||
      second.cleanup.runtimeLockPresent !== true ||
      second.durableState?.httpIntentCount !== 4 ||
      second.durableState.deleteIntentCount !== 0 ||
      second.durableState.nativeResultFilePresent !== true ||
      second.durableState.consumedMutationClaimReusable !== false ||
      second.usage?.management !== 833 ||
      second.usage.control !== 964 ||
      second.usage.combined !== 1797 ||
      second.usage.vercel !== 184 ||
      second.usage.nativeExecutionsReserved !== 3 ||
      second.usage.actorStarts !== 0 ||
      second.pins?.[technical16Cleanup.failedSecondOnceFile] !== technical16Cleanup.failedSecondOnceSha256 ||
      second.pins[technical16Cleanup.failedSecondJournalFile] !==
        technical16Cleanup.failedSecondJournalSha256 ||
      second.pins[technical16Cleanup.failedSecondResultFile] !==
        technical16Cleanup.failedSecondResultSha256 ||
      second.pins[technical16Cleanup.failedSecondSealFile] !== technical16Cleanup.failedSecondSealSha256 ||
      second.pins[technical16Cleanup.failedLockArchiveFile] !== technical16Cleanup.failedLockSha256 ||
      secondOnce.kind !== once.kind ||
      secondOnce.version !== 1 ||
      secondOnce.cleanupAttempt !== 2 ||
      secondOnce.resolutionSha256 !== once.resolutionSha256 ||
      secondOnce.priorFailedAttemptSha256 !== technical16Cleanup.failedEntrySha256 ||
      secondOnce.priorOnceSha256 !== technical16Cleanup.failedOnceSha256 ||
      secondOnce.priorJournalSha256 !== technical16Cleanup.failedJournalSha256 ||
      JSON.stringify(secondOnce.executionIds) !== JSON.stringify(['31131', '31130']) ||
      secondOnce.maximumRequests !== 158 ||
      secondOnce.maximumControlRequests !== 158 ||
      JSON.stringify(secondOnce.usage) !== JSON.stringify(once.usage) ||
      secondOnce.processId !== second.cleanup.childProcessId ||
      secondOnce.parentProcessId !== second.cleanup.parentProcessId ||
      secondSeal.version !== 2 ||
      !secondSeal.files ||
      Object.keys(secondSeal.files).length !== 92 ||
      secondSeal.files['scripts/n8n/foundation-provision-cli.mjs'] !==
        '5d6a8b8fa1fe4ab6ce2ae41c5958dc7813eb01a297281205101eb749b2e6580b' ||
      secondSeal.files['scripts/n8n/windows/Invoke-M03FoundationProvision.ps1'] !==
        '4a18acaa05614b9dc30c260166c9ddf424dee5012578218478ec54361f45c8bd'
    )
      fail();
    for (const [key, value] of Object.entries(secondResult))
      if (JSON.stringify(second.rawResult[key]) !== JSON.stringify(value)) fail();
    const secondRows = secondJournal.trimEnd().split('\n').map(JSON.parse),
      secondHeader = secondRows[0];
    if (
      !secondJournal.endsWith('\n') ||
      secondRows.length !== 5 ||
      secondHeader.event !== 'technical16_cleanup_header' ||
      secondHeader.version !== 1 ||
      secondHeader.cleanupAttempt !== 2 ||
      secondHeader.resolutionSha256 !== once.resolutionSha256 ||
      secondHeader.originalAttemptSha256 !== failed.originalAttemptSha256 ||
      secondHeader.priorFailedAttemptSha256 !== technical16Cleanup.failedEntrySha256 ||
      secondHeader.priorOnceSha256 !== technical16Cleanup.failedOnceSha256 ||
      secondHeader.priorJournalSha256 !== technical16Cleanup.failedJournalSha256
    )
      fail();
    for (let index = 0; index < 4; index++) {
      const row = secondRows[index + 1],
        root = index < 2;
      if (
        row.event !== 'technical16_http_intent' ||
        row.ordinal !== index + 1 ||
        row.kind !== (index % 2 === 0 ? 'metadata' : 'full') ||
        row.workflowId !== bindings.workflowRefs[root ? 'WF-00' : 'WF-10'].id ||
        row.executionId !== (root ? '31130' : '31131') ||
        row.managementAttempts !== 830 + index ||
        row.controlAttempts !== 961 + index
      )
        fail();
    }
    dead(secondOnce.processId);
    dead(secondOnce.parentProcessId);
    const lockArchive = noLinks(join(repo, technical16Cleanup.failedSecondLockArchiveFile)),
      stalePresent = existsSync(lockPath),
      archived = existsSync(lockArchive);
    if (stalePresent === archived) fail();
    // Preserve both spent claims. Only the exact stale marker is archived by
    // the locked PowerShell parent; public CheckOnly never moves it.
    const markerPath = archived ? lockArchive : lockPath,
      stat = lstatSync(markerPath);
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      stat.size !== 35 ||
      publicHash(readFileSync(markerPath)) !== technical16Cleanup.failedLockSha256
    )
      fail();
    if (archived) read(technical16Cleanup.failedSecondLockArchiveFile, technical16Cleanup.failedLockSha256);
    cleanupAttempt = 3;
    paths = {
      attemptFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.json',
      journalFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.jsonl',
      resultFile: 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3-result.json',
    };
  } else fail();
  for (const name of ['attemptFile', 'journalFile', 'resultFile'])
    if (existsSync(noLinks(join(repo, paths[name])))) fail();
  const value = freezeRuntimeValue({
    bindings,
    baseline,
    rootBinding,
    childBinding,
    intentAt: Date.parse(ack[0].intentAt),
    resolutionSha256: technical16Cleanup.executedBodyResolutionSha256,
    usage: { ...resolution.usage, management: 833, control: 964, combined: 1797 },
    cleanupAttempt,
    paths,
    priorAttempt: {
      receiptSha256: technical16Cleanup.failedSecondSha256,
      onceSha256: technical16Cleanup.failedSecondOnceSha256,
      journalSha256: technical16Cleanup.failedSecondJournalSha256,
    },
    assertCurrent() {
      for (const [path, hash] of pins) {
        const absolute = noLinks(join(repo, path)),
          stat = lstatSync(absolute);
        if (
          !stat.isFile() ||
          stat.nlink !== 1 ||
          stat.size > 2097152 ||
          publicHash(readFileSync(absolute)) !== hash
        )
          fail();
      }
    },
  });
  const context = Object.freeze({
    kind: 'm03_technical16_cleanup_context',
    version: 1,
    technicalAttempt: 16,
    windowId: foundationTechnical16CleanupScope.windowId,
    sourceCommitSha: foundationTechnical16CleanupScope.sourceCommitSha,
    qualifiedSideEffects: false,
    executionCount: 0,
    actorStarts: 0,
  });
  technical16CleanupContexts.set(context, value);
  return context;
}
export function createTechnical16CleanupBudget({ context, deadlineAt, now = Date.now, append }) {
  const value = assertTechnical16CleanupContext(context);
  if (
    !Number.isFinite(deadlineAt) ||
    typeof now !== 'function' ||
    now() >= deadlineAt ||
    typeof append !== 'function'
  )
    fail();
  let count = 0,
    uncertain = false;
  const state = () =>
    Object.freeze({
      requestCount: count,
      controlRequestCount: count,
      managementAttempts: value.usage.management + count,
      controlAttempts: value.usage.control + count,
      combinedAttempts: value.usage.combined + 2 * count,
    });
  return Object.freeze({
    state,
    admit(args) {
      value.assertCurrent();
      const usage = state(),
        ids = new Set(Object.values(value.bindings.workflowRefs).map((row) => row.id));
      if (
        uncertain ||
        now() >= deadlineAt ||
        count >= foundationTechnical16CleanupScope.maximumRequests ||
        usage.managementAttempts + 1 > 1024 ||
        usage.controlAttempts + 1 > 2048 ||
        usage.combinedAttempts + 2 > 2560 ||
        !['workflow', 'metadata', 'full', 'discovery', 'delete', 'absence'].includes(args?.kind) ||
        !ids.has(args.workflowId) ||
        (['metadata', 'full', 'delete', 'absence'].includes(args.kind) &&
          !['31130', '31131'].includes(args.executionId))
      )
        fail();
      count++;
      try {
        const returned = append(
          Object.freeze({
            event: 'technical16_http_intent',
            ordinal: count,
            kind: args.kind,
            workflowId: args.workflowId,
            ...(args.executionId ? { executionId: args.executionId } : {}),
            managementAttempts: value.usage.management + count,
            controlAttempts: value.usage.control + count,
            at: new Date(now()).toISOString(),
          }),
        );
        if (returned !== undefined) {
          if (returned?.then) Promise.resolve(returned).catch(() => {});
          fail();
        }
      } catch {
        uncertain = true;
        fail();
      }
    },
  });
}
async function runTechnical16Cleanup(context, privateInput, qualificationOnly = false) {
  const value = assertTechnical16CleanupContext(context),
    paths = value.paths;
  const [
    { createFoundationNativeReader, assertFoundationTechnical16CleanupQualification },
    { createFoundationNativeTransport },
    { createFoundationNativeCleanup },
    { createFoundationControlJournal },
  ] = await Promise.all([
    import('./foundation-native-reader.mjs'),
    import('./foundation-native-transport.mjs'),
    import('./foundation-native-cleanup.mjs'),
    import('./foundation-control-state.mjs'),
  ]);
  const lockPath = noLinks(join(repo, 'scripts/n8n/out/foundation/live/runtime.operation.lock'));
  let journalFd,
    lock,
    transport,
    reader,
    qualified = false,
    networkClosed = false,
    journalExpected = '',
    uncertainAppend = false;
  const result = {
    kind: 'm03_technical16_native_cleanup',
    version: 1,
    environment: 'dev',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    windowId: foundationTechnical16CleanupScope.windowId,
    sourceCommitSha: foundationTechnical16CleanupScope.sourceCommitSha,
    status: 'cleanup_blocked',
    requestCount: 0,
    controlRequestCount: 0,
    managementAttempts: value.usage.management,
    controlAttempts: value.usage.control,
    combinedAttempts: value.usage.combined,
    canonicalWorkflowsVerified: 0,
    qualifiedSideEffects: false,
    recordsDeleted: 0,
    deleteAcknowledged: false,
    absenceVerified: false,
    remoteWorkSettled: false,
    networkCompletionVerified: false,
    originalPublicRecordsUnchanged: false,
    nativeAcceptanceProven: false,
    originalMaskedFirstFailureRecovered: false,
    executionCount: 0,
    actorStarts: 0,
    workflowWrites: 0,
    credentialWrites: 0,
    migrationOperations: 0,
    diagnosticStage: 'one_use_claim',
    diagnosticCode: 'not_attempted',
  };
  const append = (row) => {
    if (
      uncertainAppend ||
      journalFd === undefined ||
      readFileSync(join(repo, paths.journalFile), 'utf8') !== journalExpected
    )
      fail();
    const text = JSON.stringify(row) + '\n';
    try {
      writeCompleteSync(journalFd, text);
      fsyncSync(journalFd);
      journalExpected += text;
    } catch {
      uncertainAppend = true;
      fail();
    }
  };
  const budget = createTechnical16CleanupBudget({ context, deadlineAt: privateInput.deadlineMs, append });
  const admit = (args) => {
    if (qualificationOnly && (budget.state().requestCount >= 4 || !['metadata', 'full'].includes(args.kind)))
      fail();
    budget.admit(args);
  };
  try {
    const claim = openSync(noLinks(join(repo, paths.attemptFile)), 'wx');
    try {
      writeCompleteSync(
        claim,
        JSON.stringify({
          kind: 'm03_technical16_cleanup_once',
          version: 1,
          ...(value.cleanupAttempt >= 2
            ? {
                cleanupAttempt: value.cleanupAttempt,
                priorFailedAttemptSha256: value.priorAttempt.receiptSha256,
                priorOnceSha256: value.priorAttempt.onceSha256,
                priorJournalSha256: value.priorAttempt.journalSha256,
              }
            : {}),
          resolutionSha256: value.resolutionSha256,
          executionIds: ['31131', '31130'],
          processId: process.pid,
          parentProcessId: process.ppid,
          usage: value.usage,
          maximumRequests: qualificationOnly ? 4 : foundationTechnical16CleanupScope.maximumRequests,
          maximumControlRequests: qualificationOnly
            ? 4
            : foundationTechnical16CleanupScope.maximumControlRequests,
          ...(qualificationOnly ? { qualificationOnly: true } : {}),
          at: new Date().toISOString(),
        }) + '\n',
      );
      fsyncSync(claim);
    } finally {
      closeSync(claim);
    }
    lock = openSync(lockPath, 'wx');
    writeCompleteSync(lock, 'emr-m03-foundation-live-runtime-v1\n');
    fsyncSync(lock);
    journalFd = openSync(noLinks(join(repo, paths.journalFile)), 'wx');
    append({
      event: 'technical16_cleanup_header',
      version: 1,
      resolutionSha256: value.resolutionSha256,
      originalAttemptSha256: 'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb',
      ...(value.cleanupAttempt >= 2
        ? {
            cleanupAttempt: value.cleanupAttempt,
            priorFailedAttemptSha256: value.priorAttempt.receiptSha256,
            priorOnceSha256: value.priorAttempt.onceSha256,
            priorJournalSha256: value.priorAttempt.journalSha256,
          }
        : {}),
    });
    const journal = createFoundationControlJournal({ durableAppend: append });
    transport = createFoundationNativeTransport({
      apiKey: privateInput.key,
      bindings: value.bindings,
      authorizeExecution: ({ method, executionId }) =>
        ['31130', '31131'].includes(executionId) &&
        (method === 'GET' || (!qualificationOnly && qualified && method === 'DELETE')),
    });
    reader = createFoundationNativeReader({
      bindings: value.bindings,
      transport,
      admitControlAttempt: admit,
      now: Date.now,
      deadlineAt: privateInput.deadlineMs,
      sensitiveValues: [privateInput.key],
    });
    const cleanup = createFoundationNativeCleanup({
      reader,
      transport,
      admitControlAttempt: admit,
      journal,
      now: Date.now,
      deadlineAt: privateInput.deadlineMs,
    });
    result.diagnosticStage = 'qualification';
    const qualification = await reader.qualifyTechnical16Cleanup({
      context,
      ...(qualificationOnly ? { qualificationOnly: true } : {}),
    });
    if (qualificationOnly) fail();
    assertFoundationTechnical16CleanupQualification(qualification, { reader });
    qualified = true;
    result.qualifiedSideEffects = true;
    result.canonicalWorkflowsVerified = 25;
    result.diagnosticStage = 'cleanup';
    const deleted = await cleanup.cleanupTechnical16({ qualification });
    result.recordsDeleted = deleted.results.filter(
      (row) => row.state === 'native_record_deleted' && !row.residual,
    ).length;
    result.deleteAcknowledged =
      deleted.results.length === 2 && deleted.results.every((row) => row.deleteAcknowledged);
    result.absenceVerified =
      deleted.results.length === 2 && deleted.results.every((row) => row.absenceVerified);
    result.remoteWorkSettled = deleted.status === 'native_records_deleted' && result.recordsDeleted === 2;
    result.status = result.remoteWorkSettled ? 'native_cleanup_verified' : 'cleanup_reconciliation_required';
    result.diagnosticCode = result.remoteWorkSettled ? 'none' : 'native_cleanup_residual';
  } catch {
    result.status = 'cleanup_reconciliation_required';
    result.diagnosticCode = reader?.lastFailure()?.code
      ? 'native_' + reader.lastFailure().code
      : 'fixed_boundary_blocked';
  } finally {
    const failedStage = result.status === 'native_cleanup_verified' ? null : result.diagnosticStage;
    result.diagnosticStage = failedStage ?? 'closure';
    transport?.close();
    if (transport) {
      const until = Date.now() + 5000;
      while (transport.state().pendingRequests + transport.state().unclosedResponses && Date.now() < until)
        await new Promise((resolve) => setTimeout(resolve, 20));
      networkClosed = transport.state().pendingRequests === 0 && transport.state().unclosedResponses === 0;
    } else networkClosed = true;
    try {
      value.assertCurrent();
      if (
        uncertainAppend ||
        (journalFd !== undefined && readFileSync(join(repo, paths.journalFile), 'utf8') !== journalExpected)
      )
        fail();
      result.originalPublicRecordsUnchanged = true;
    } catch {
      result.status = 'cleanup_reconciliation_required';
    }
    for (const fd of [journalFd, lock]) if (fd !== undefined) closeSync(fd);
    Object.assign(result, budget.state());
    result.networkCompletionVerified = networkClosed;
    if (!networkClosed || !result.originalPublicRecordsUnchanged || !result.remoteWorkSettled)
      result.status = 'cleanup_reconciliation_required';
    if (result.status === 'native_cleanup_verified') unlinkSync(lockPath);
    if (result.status === 'native_cleanup_verified') result.diagnosticStage = 'complete';
    privateInput.key = null;
  }
  writeFileSync(noLinks(join(repo, paths.resultFile)), JSON.stringify(result, null, 2) + '\n', {
    flag: 'wx',
  });
  return result;
}

const publicHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function technical13PublicFile(relative) {
  const path = noLinks(join(repo, relative)),
    stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 2097152) fail();
  return readFileSync(path, 'utf8');
}
export async function checkTechnical13Restoration() {
  const inventory = await import('./inventory.mjs');
  const context = await inventory.readRuntimeReconciliationContext(repo);
  if (
    context.receiptSha256 !== technical13.receiptSha256 ||
    context.plan.windowId !== technical13.windowId ||
    context.managementAttempts !== 486 ||
    context.controlAttempts !== 791 ||
    context.state.requestCount !== 22 ||
    context.state.pending?.sequence !== 7 ||
    typeof technical13.readbackSha256 !== 'string'
  )
    fail();
  const readbackText = technical13PublicFile(technical13.readbackFile);
  if (publicHash(readbackText) !== technical13.readbackSha256) fail();
  const readback = JSON.parse(readbackText);
  inventory.assertRuntimeReconciliationReadback(readback.actualNativeResult.inventory);
  if (readback.originalAttemptReceiptSha256 !== technical13.receiptSha256) fail();
  for (const name of ['attemptFile', 'journalFile', 'resultFile'])
    if (existsSync(noLinks(join(repo, technical13[name])))) fail();
  if (existsSync(noLinks(join(repo, 'scripts/n8n/out/foundation/live/runtime.operation.lock')))) fail();
  return context;
}
export async function restoreTechnical13WithPorts(plan, ports) {
  const runtime = await import('./foundation-runtime-control.mjs');
  const adoption = await runtime.adoptFoundationRuntimeSettingsSaveForRestoration(plan, ports);
  if (adoption.status !== 'settings_save_readback_verified_original_ack_unknown')
    return { adoption, restoration: null };
  const restoration = await runtime.restoreFoundationRuntime(plan, ports);
  if (restoration.status === 'exact_staging_restored_unpublished')
    runtime.assertFoundationRuntimeRestorationAudit(restoration, { plan });
  return { adoption, restoration };
}
export function createTechnical13RestorationBudget({
  context,
  deadlineAt,
  paths,
  appendManagement,
  appendControl,
}) {
  if (
    context.managementAttempts !== 486 ||
    context.controlAttempts !== 791 ||
    typeof context.pinned.management !== 'string' ||
    typeof context.pinned.control !== 'string' ||
    typeof context.pinned.runtime !== 'string' ||
    !Number.isFinite(deadlineAt) ||
    typeof appendManagement !== 'function' ||
    typeof appendControl !== 'function'
  )
    fail();
  const managementPath = noLinks(paths.management),
    controlPath = noLinks(paths.control),
    runtimePath = noLinks(paths.runtime);
  const managementAppends = [],
    controlAppends = [];
  let managementRequests = 0,
    controlRequests = 0,
    uncertainAppend = false;
  const assertCurrent = () => {
    if (
      uncertainAppend ||
      readFileSync(managementPath, 'utf8') !== context.pinned.management + managementAppends.join('') ||
      readFileSync(controlPath, 'utf8') !== context.pinned.control + controlAppends.join('') ||
      readFileSync(runtimePath, 'utf8') !== context.pinned.runtime
    )
      fail();
  };
  const state = () =>
    Object.freeze({
      requestCount: managementRequests,
      controlRequestCount: controlRequests,
      managementAttempts: 486 + managementRequests,
      controlAttempts: 791 + controlRequests,
      combinedAttempts: 1277 + managementRequests + controlRequests,
    });
  return Object.freeze({
    assertCurrent,
    state,
    admitManagement() {
      assertCurrent();
      if (
        managementRequests >= 40 ||
        Date.now() >= deadlineAt ||
        486 + managementRequests + 1 > 832 ||
        1277 + managementRequests + controlRequests + 1 > 2560
      )
        fail();
      const row = { event: 'management_attempt', ordinal: 476 + managementRequests };
      managementRequests++;
      managementAppends.push(JSON.stringify(row) + '\n');
      try {
        appendManagement(row);
      } catch {
        uncertainAppend = true;
        fail();
      }
    },
    admitControl(args, append) {
      assertCurrent();
      if (
        args.kind !== 'discovery' ||
        !context.plan.baseline.some((b) => b.id === args.workflowId) ||
        controlRequests >= 50 ||
        Date.now() >= deadlineAt ||
        791 + controlRequests + 1 > 2048 ||
        1277 + managementRequests + controlRequests + 1 > 2560 ||
        typeof append !== 'function'
      )
        fail();
      controlRequests++;
      try {
        append({
          event: 'control_request_intent',
          ordinal: 788 + controlRequests,
          kind: 'discovery',
          workflowId: args.workflowId,
          at: new Date().toISOString(),
        });
      } catch {
        uncertainAppend = true;
        fail();
      }
    },
    appendControl(row) {
      controlAppends.push(JSON.stringify(row) + '\n');
      appendControl(row);
    },
  });
}
async function runTechnical13Restoration(context, privateInput) {
  const { createFoundationRuntimeJournal, foundationRuntimeState } =
    await import('./foundation-runtime-control.mjs');
  const { createFoundationLiveManagementTransport } = await import('./foundation-live-runtime-transport.mjs');
  const { prepareFoundationRuntimeMachinePatch } = await import('./foundation-runtime-machine.mjs');
  const { createFoundationNativeReader } = await import('./foundation-native-reader.mjs');
  const { createFoundationNativeTransport } = await import('./foundation-native-transport.mjs');
  const { createFoundationControlJournal } = await import('./foundation-control-state.mjs');
  const managementPath = noLinks(join(repo, context.paths.management)),
    controlPath = noLinks(join(repo, context.paths.control)),
    oldRuntimePath = noLinks(join(repo, context.paths.runtime)),
    lockPath = noLinks(join(repo, 'scripts/n8n/out/foundation/live/runtime.operation.lock'));
  let management,
    control,
    recovery,
    lock,
    transport,
    nativeTransport,
    complete = false,
    networkClosed = false;
  const originalRuntime = technical13PublicFile(context.paths.runtime);
  const result = {
    kind: 'm03_technical13_runtime_restoration',
    version: 1,
    environment: 'dev',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    windowId: technical13.windowId,
    sourceCommitSha: technical13.sourceCommitSha,
    status: 'restoration_blocked',
    requestCount: 0,
    controlRequestCount: 0,
    managementAttempts: 486,
    controlAttempts: 791,
    combinedAttempts: 1277,
    baselineRestored: false,
    machineRestored: false,
    remoteWorkSettled: false,
    executionCount: 0,
    actorStarts: 0,
    originalAckUnknown: true,
    mutationReplayAllowed: false,
    oldRuntimeUnchanged: true,
    networkCompletionVerified: false,
  };
  const durable = (fd, row) => {
    writeCompleteSync(fd, JSON.stringify(row) + '\n');
    fsyncSync(fd);
  };
  const budget = createTechnical13RestorationBudget({
    context,
    deadlineAt: privateInput.deadlineMs,
    paths: { management: managementPath, control: controlPath, runtime: oldRuntimePath },
    appendManagement: (row) => durable(management, row),
    appendControl: (row) => durable(control, row),
  });
  try {
    budget.assertCurrent();
    const attempt = openSync(noLinks(join(repo, technical13.attemptFile)), 'wx');
    try {
      durable(attempt, {
        kind: 'm03_technical13_restore_intent',
        version: 1,
        receiptSha256: technical13.receiptSha256,
        readbackSha256: technical13.readbackSha256,
        oldRuntimeSha256: publicHash(originalRuntime),
        oldRuntimeRows: 38,
        managementAttempts: 486,
        controlAttempts: 791,
        maximumManagementRequests: 40,
        maximumControlRequests: 50,
        processId: process.pid,
        parentProcessId: process.ppid,
        at: new Date().toISOString(),
      });
    } finally {
      closeSync(attempt);
    }
    lock = openSync(lockPath, 'wx');
    writeCompleteSync(lock, 'emr-m03-foundation-live-runtime-v1\n');
    fsyncSync(lock);
    recovery = openSync(noLinks(join(repo, technical13.journalFile)), 'wx');
    durable(recovery, {
      kind: 'm03_technical13_restore_journal',
      version: 1,
      sourceRuntime: context.paths.runtime,
      sourceRuntimeSha256: publicHash(originalRuntime),
      sourceRuntimeRows: 38,
      receiptSha256: technical13.receiptSha256,
      readbackSha256: technical13.readbackSha256,
    });
    management = openSync(managementPath, 'a');
    control = openSync(controlPath, 'a');
    const journal = createFoundationRuntimeJournal(context.plan, context.journal.rows, (row) =>
      durable(recovery, row),
    );
    transport = createFoundationLiveManagementTransport({
      plan: context.plan,
      apiKey: privateInput.key,
      sensitiveValues: [privateInput.key, privateInput.machine],
      deadlineAt: privateInput.deadlineMs,
    });
    const ports = {
      journal,
      send: transport.send,
      admitManagementAttempt: budget.admitManagement,
      prepareMachinePatch({ audience, restore }) {
        if (restore !== true || audience !== context.plan.oldAudience) fail();
        return prepareFoundationRuntimeMachinePatch({
          audience,
          restore: true,
          machineToken: privateInput.machine,
        });
      },
    };
    const restored = await restoreTechnical13WithPorts(context.plan, ports),
      state = foundationRuntimeState(context.plan, journal);
    complete =
      restored.restoration?.status === 'exact_staging_restored_unpublished' &&
      state.restoreComplete &&
      !state.machineRebound &&
      state.pending === null;
    result.status = complete ? 'restoration_verified' : 'restoration_reconciliation_required';
    result.baselineRestored = complete;
    result.machineRestored = complete;
    if (complete) {
      const bindings = JSON.parse(technical13PublicFile('n8n/foundation/bindings.dev.json'));
      const controlJournal = createFoundationControlJournal({
        previousEvents: context.pinned.control.trimEnd().split('\n').map(JSON.parse),
        durableAppend: (row) => budget.appendControl(row),
      });
      nativeTransport = createFoundationNativeTransport({
        apiKey: privateInput.key,
        bindings,
        authorizeExecution: () => false,
      });
      const reader = createFoundationNativeReader({
        bindings,
        transport: nativeTransport,
        deadlineAt: privateInput.deadlineMs,
        sensitiveValues: [privateInput.key, privateInput.machine],
        admitControlAttempt(args) {
          budget.admitControl(args, (row) => controlJournal.append(row));
        },
      });
      let zero = true;
      for (const workflowKey of Object.keys(bindings.workflowRefs)) {
        const scan = await reader.discover({ workflowKey, baselineIds: [] });
        if (scan.paginationComplete !== true || scan.candidates.length) zero = false;
      }
      result.remoteWorkSettled = zero && budget.state().controlRequestCount === 50;
    }
  } catch {
    result.status = 'restoration_reconciliation_required';
  } finally {
    transport?.close();
    nativeTransport?.close();
    if (transport) {
      const until = Date.now() + 5000;
      const pending = () => {
        const a = transport.state(),
          b = nativeTransport?.state() ?? { pendingRequests: 0, unclosedResponses: 0 };
        return a.pendingRequests + a.unclosedResponses + b.pendingRequests + b.unclosedResponses;
      };
      while (pending() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 20));
      networkClosed = pending() === 0;
    }
    for (const fd of [management, control, recovery, lock]) if (fd !== undefined) closeSync(fd);
    Object.assign(result, budget.state());
    result.networkCompletionVerified = networkClosed;
    result.oldRuntimeUnchanged = false;
    let publicPrefixesCurrent = false;
    try {
      result.oldRuntimeUnchanged = readFileSync(oldRuntimePath, 'utf8') === originalRuntime;
      budget.assertCurrent();
      publicPrefixesCurrent = true;
    } catch {
      /* Preserve the once claim and operation lock on unexpected public drift. */
    }
    if (
      complete &&
      result.remoteWorkSettled &&
      networkClosed &&
      result.oldRuntimeUnchanged &&
      publicPrefixesCurrent
    )
      unlinkSync(lockPath);
    if (!networkClosed || !result.oldRuntimeUnchanged || !publicPrefixesCurrent || !result.remoteWorkSettled)
      result.status = 'restoration_reconciliation_required';
    privateInput.key = null;
    privateInput.machine = null;
  }
  writeFileSync(noLinks(join(repo, technical13.resultFile)), JSON.stringify(result, null, 2) + '\n', {
    flag: 'wx',
  });
  return result;
}
const report = (value) => process.stdout.write(JSON.stringify(value) + '\n');
let key = null,
  machine = null,
  privateReadAttempted = false;
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Finish module evaluation before the private reader re-imports this module
  // to verify the genuine cleanup context. Awaiting main at top level would
  // otherwise leave that import waiting on its own unsettled evaluation.
  setImmediate(async () => {
    try {
      const mode = process.argv[2];
      if (
        process.argv.length !== 3 ||
        ![
          'CheckOnly',
          'Shells',
          'Reconcile',
          'All',
          'RestoreWF00',
          'RestoreTechnical13CheckOnly',
          'RestoreTechnical13',
          'CleanupTechnical16CheckOnly',
          'CleanupTechnical16',
          'CleanupTechnical16Diagnose',
        ].includes(mode)
      )
        fail();
      if (
        ['CleanupTechnical16CheckOnly', 'CleanupTechnical16', 'CleanupTechnical16Diagnose'].includes(mode)
      ) {
        let context = null;
        try {
          context = await checkTechnical16Cleanup();
        } catch {
          /* Fixed public refusal below. */
        }
        if (mode === 'CleanupTechnical16CheckOnly' || !context) {
          report({
            kind: 'm03_technical16_cleanup_public',
            version: 1,
            status: context ? 'technical16_cleanup_public_ready' : 'technical16_cleanup_public_blocked',
            windowId: foundationTechnical16CleanupScope.windowId,
            privateRead: false,
            networkRequests: 0,
            maximumRequests: foundationTechnical16CleanupScope.maximumRequests,
            maximumControlRequests: foundationTechnical16CleanupScope.maximumControlRequests,
            canonicalWorkflowCount: foundationTechnical16CleanupScope.canonicalWorkflowCount,
            maximumDrainRequests: foundationTechnical16CleanupScope.maximumDrainRequests,
            maximumNativeRecords: foundationTechnical16CleanupScope.executionIds.length,
            executionCount: 0,
            actorStarts: 0,
            qualifiedSideEffects: false,
            cleanupQualificationReady: context !== null,
          });
          process.exitCode = context ? 0 : 1;
        } else {
          const parentPath = noLinks(
            join(process.env.LOCALAPPDATA, 'Temp/emr-m03-acceptance-parent.operation.lock'),
          );
          const parent = JSON.parse(readFileSync(parentPath, 'utf8'));
          if (
            parent.kind !== 'm03_technical16_cleanup_parent' ||
            parent.version !== 1 ||
            parent.processId !== process.ppid
          )
            fail();
          let held = false,
            probe;
          try {
            probe = openSync(parentPath, 'r+');
          } catch {
            held = true;
          } finally {
            if (probe !== undefined) closeSync(probe);
          }
          if (!held) fail();
          privateReadAttempted = true;
          const privateInput = await input(false, true, false, true);
          const result = await runTechnical16Cleanup(
            context,
            privateInput,
            mode === 'CleanupTechnical16Diagnose',
          );
          report(result);
          process.exitCode = result.status === 'native_cleanup_verified' ? 0 : 1;
        }
      } else if (mode === 'RestoreTechnical13CheckOnly' || mode === 'RestoreTechnical13') {
        let context = null;
        try {
          context = await checkTechnical13Restoration();
        } catch {
          /* Fixed public refusal below. */
        }
        if (mode === 'RestoreTechnical13CheckOnly' || !context) {
          report({
            kind: 'm03_technical13_restoration_public',
            version: 1,
            status: context ? 'technical13_restore_public_ready' : 'technical13_restore_public_blocked',
            windowId: technical13.windowId,
            privateRead: false,
            networkRequests: 0,
            maximumRequests: 40,
            maximumControlRequests: 50,
            executionCount: 0,
            actorStarts: 0,
          });
          process.exitCode = context ? 0 : 1;
        } else {
          const parentPath = noLinks(
            join(process.env.LOCALAPPDATA, 'Temp/emr-m03-acceptance-parent.operation.lock'),
          );
          const parent = JSON.parse(readFileSync(parentPath, 'utf8'));
          if (
            parent.kind !== 'm03_technical13_restore_parent' ||
            parent.version !== 1 ||
            parent.processId !== process.ppid
          )
            fail();
          let held = false,
            probe;
          try {
            probe = openSync(parentPath, 'r+');
          } catch {
            held = true;
          } finally {
            if (probe !== undefined) closeSync(probe);
          }
          if (!held) fail();
          privateReadAttempted = true;
          const privateInput = await input(true, true, true);
          const result = await runTechnical13Restoration(context, privateInput);
          report(result);
          process.exitCode = result.status === 'restoration_verified' ? 0 : 1;
        }
      } else if (mode === 'RestoreWF00') {
        const target = restoreTarget(),
          j = restoreJournal();
        privateReadAttempted = true;
        const privateInput = await input(false, true);
        key = privateInput.key;
        privateInput.key = null;
        const body = (await import('./foundation-bind.mjs')).graphBody({
          key: 'WF-00',
          workflow: { ...target.workflow, active: false },
        });
        const send = foundationManagementTransport({
          ownsWorkflow: (id) => id === wf00RestoreScope.workflowId,
          binding: { workflowBodies: new Map([[wf00RestoreScope.workflowId, body]]) },
          deadlineMs: privateInput.deadlineMs,
        });
        const result = await restoreOwnedWf00(key, target, {
          send,
          protectBackup: protectRestoreBackup,
          journal: j,
          readOnlyAttemptVerified: j.readOnlyAttemptVerified,
        });
        if (JSON.stringify(result).includes(key)) fail();
        key = null;
        report(result);
        process.exitCode = ['wf00_restore_verified', 'wf00_restore_reconciled'].includes(result.status)
          ? 0
          : 1;
      } else {
        readJournal();
        const publicPacket = packet();
        if (mode === 'All' && !publicPacket) fail();
        if (mode === 'CheckOnly')
          report({
            status: 'foundation_shell_check_only_ready',
            version: 1,
            windowId: foundationScope.windowId,
            privateRead: false,
            networkRequests: 0,
            maximumRequests: 53,
            maximumCreates: 25,
            finalBindingReady: publicPacket !== null,
            fullProvisionMaximumRequests: 185,
            fullProvisionSourcePrepared: true,
          });
        else {
          const owned = journal();
          privateReadAttempted = true;
          const privateInput = await input(mode === 'All');
          key = privateInput.key;
          machine = privateInput.machine;
          privateInput.key = null;
          privateInput.machine = null;
          const context =
            mode === 'All'
              ? {
                  machineBody: machineBody(publicPacket, machine),
                  knownTagIds: new Set(),
                  workflowBodies: new Map(),
                  workflowTagBodies: new Map(),
                }
              : null;
          const send = foundationManagementTransport({
            ownsWorkflow: (id) => [...parseLedger(owned.rows).values()].some((s) => s.id === id),
            binding: context,
            deadlineMs: privateInput.deadlineMs,
          });
          const result =
            mode === 'All'
              ? await runAllProvision(
                  { management: key, machine },
                  publicPacket,
                  JSON.parse(readFileSync(noLinks(join(repo, 'n8n/foundation/bindings.dev.json')), 'utf8')),
                  {
                    shellJournal: owned,
                    bindingJournal: bindingJournal(),
                    send,
                    context,
                    tagNames: foundationTagNames,
                    onVerified: createOwnedStagingExportWriter(repo, [key, machine]),
                  },
                )
              : await runShellProvision(key, owned, send, { reconcileOnly: mode === 'Reconcile' });
          if (JSON.stringify(result).includes(key) || (machine && JSON.stringify(result).includes(machine)))
            fail();
          key = null;
          machine = null;
          noLinks(out);
          writeFileSync(
            join(out, mode === 'All' ? 'inactive-foundation-receipt.json' : 'shell-provision-receipt.json'),
            JSON.stringify(result, null, 2) + '\n',
          );
          if (result.status === 'shells_verified') {
            const directory = noLinks(join(repo, 'n8n/workflows/foundation-shells'));
            mkdirSync(directory, { recursive: true });
            noLinks(directory);
            for (const shell of result.shells) {
              const target = noLinks(join(directory, shell.key + '.json'));
              writeFileSync(
                target,
                JSON.stringify({ kind: 'actual_saved_inactive_shell', ...shell }, null, 2) + '\n',
              );
            }
          }
          if (result.status === 'inactive_foundation_staged') {
            writeFileSync(
              noLinks(join(repo, 'n8n/foundation/bindings.dev.json')),
              JSON.stringify(result.bindings, null, 2) + '\n',
            );
            writeFileSync(
              noLinks(join(repo, 'n8n/foundation/transport.dev.json')),
              JSON.stringify(
                {
                  kind: 'actual_saved_inactive_staging_transport_binding',
                  ...result.transport,
                  activationAuthorized: false,
                },
                null,
                2,
              ) + '\n',
            );
          }
          report({
            version: 1,
            windowId: foundationScope.windowId,
            host: foundationScope.host,
            projectId: foundationScope.projectId,
            status: result.status,
            phase: result.phase ?? 'shells',
            requestCount: result.requestCount,
            verifiedWorkflows: (result.workflows ?? result.shells).length,
            executionCount: 0,
            credentialsCreated: result.credentialsCreated,
            gatewayWindowStarted: false,
            finalGraphsBound: result.finalGraphsBound,
            inactiveDefinitionsSaved: result.inactiveDefinitionsSaved ?? false,
            deferredErrorWorkflowCount: result.deferredErrorWorkflowCount ?? 0,
            errorRoutingAccepted: false,
            persistedExports: result.persistedExports ?? 0,
            networkCompletionVerified: result.networkCompletionVerified,
            diagnostics: result.diagnostics ?? null,
          });
          process.exitCode = [
            'shells_verified',
            'reconciliation_complete',
            'inactive_foundation_staged',
          ].includes(result.status)
            ? 0
            : 1;
        }
      }
    } catch {
      key = null;
      machine = null;
      report({ status: 'foundation_child_blocked', completionVerified: false, privateReadAttempted });
      process.exitCode = 1;
    }
  });
}
