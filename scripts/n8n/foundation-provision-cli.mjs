import {
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  lstatSync,
  existsSync,
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
async function input(requireMachine = false, restore = false) {
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
      p.purpose !== (restore ? 'm03_owned_wf00_restore' : 'm03_owned_inactive_provision') ||
      p.windowId !== foundationScope.windowId
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
const report = (value) => process.stdout.write(JSON.stringify(value) + '\n');
let key = null,
  machine = null,
  privateReadAttempted = false;
try {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !['CheckOnly', 'Shells', 'Reconcile', 'All', 'RestoreWF00'].includes(mode))
    fail();
  if (mode === 'RestoreWF00') {
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
    process.exitCode = ['wf00_restore_verified', 'wf00_restore_reconciled'].includes(result.status) ? 0 : 1;
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
