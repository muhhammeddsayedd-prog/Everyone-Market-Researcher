import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  readdirSync,
  lstatSync,
  existsSync,
  openSync,
  closeSync,
  fsyncSync,
} from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  foundationScope,
  wf00RestoreReadOnlyAttempt,
  wf00RestoreScope,
  wf00CurrentRestoreScope,
  qualifyCurrentWf00Restore,
} from './foundation-provision.mjs';
import { writeCompleteSync } from './foundation-export.mjs';

const windows = { skip: process.platform !== 'win32' };
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const canary = 'SYNTHETIC_WF00_MANAGEMENT_PRIVATE_CANARY';
const dtoCanary = 'SYNTHETIC_WF00_FULL_DTO_PRIVATE_CANARY';
const runId = '40000000-0000-4000-8000-000000000001';
const fullDto = {
  id: 'MzimjpsuyPuK7SKe',
  name: 'WF-00 · Orchestrator [dev]',
  active: false,
  activeVersionId: null,
  isArchived: false,
  versionId: 'SyntheticActualBeforeVersion',
  nodes: [],
  connections: {},
  settings: { saveDataSuccessExecution: 'none' },
  shared: [{ projectId: 'pHvQjDmjxVZ3KQLT', role: 'workflow:owner' }],
  pinData: { fullPrivateValue: dtoCanary },
  staticData: { retained: { nested: true } },
  otherSavedMetadata: { retained: ['all', 'fields'] },
  unicodeFidelity: '東京 · مرحبا',
};
const validReceipt = {
  version: 1,
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  host: 'muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowId: 'MzimjpsuyPuK7SKe',
  status: 'wf00_restore_verified',
  requestCount: 3,
  backupReady: true,
  writeIntentRecorded: true,
  putAttempted: true,
  putAcknowledged: true,
  exactContentVerified: true,
  inactiveVerified: true,
  ownerAndTagsVerified: true,
  versionId: 'SyntheticActualAfterVersion',
  beforeVersionPrivatelyBackedUp: true,
  nativeStorageModePreserved: true,
  executionCount: 0,
  credentialsCreated: 0,
  gatewayWindowStarted: false,
  networkCompletionVerified: true,
  diagnostic: null,
};
const environment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'APPDATA', 'USERPROFILE'].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );

function currentFixtureInputs(readSource = readFileSync) {
  const bytes = readSource(wf00CurrentRestoreScope.receiptFile),
    receipt = JSON.parse(bytes),
    inputs = new Map([[wf00CurrentRestoreScope.receiptFile, bytes]]),
    reconstructed = new Map([
      [
        'scripts/n8n/out/foundation/live/technical21-finite-difference-retry-intent.json',
        Buffer.from(JSON.stringify(receipt.rawIntent, null, 2) + '\n'),
      ],
      [
        'scripts/n8n/out/foundation/live/technical21-finite-difference-retry-result.json',
        Buffer.from(JSON.stringify(receipt.rawResult, null, 2) + '\n'),
      ],
      [
        'scripts/n8n/out/foundation/live/technical21-finite-difference-retry-inventory-seal-used.json',
        readSource('scripts/n8n/m03-inventory-seal.json'),
      ],
    ]);
  for (const [relative, expected] of Object.entries(receipt.pins)) {
    if (!reconstructed.has(relative)) assert.doesNotMatch(relative, /(?:^|\/)scripts\/(?:n8n|db)\/out\//);
    const value = reconstructed.get(relative) ?? readSource(relative);
    assert.equal(createHash('sha256').update(value).digest('hex'), expected, relative);
    inputs.set(relative, value);
  }
  return inputs;
}

test('current WF00 fixture reconstructs exact pins in a clean checkout without ignored output reads', () => {
  const reads = [],
    inputs = currentFixtureInputs((path, ...options) => {
      const relative = String(path).replaceAll('\\', '/');
      if (/(?:^|\/)scripts\/(?:n8n|db)\/out\//.test(relative)) throw Error('REAL_IGNORED_OUTPUT_READ_DENIED');
      reads.push(relative);
      return readFileSync(path, ...options);
    });
  const record = JSON.parse(inputs.get(wf00CurrentRestoreScope.receiptFile));
  assert.equal(inputs.size, 9);
  assert.equal(
    createHash('sha256').update(inputs.get(wf00CurrentRestoreScope.receiptFile)).digest('hex'),
    wf00CurrentRestoreScope.receiptSha256,
  );
  for (const [relative, hash] of Object.entries(record.pins))
    assert.equal(createHash('sha256').update(inputs.get(relative)).digest('hex'), hash, relative);
  assert.ok(reads.includes('scripts/n8n/m03-inventory-seal.json'));
});

function fixture(body) {
  const root = mkdtempSync(join(tmpdir(), 'emr-wf00-private-protocol-')),
    repo = join(root, 'repo');
  const source = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8');
  for (const [, relative] of source.matchAll(/^  '([^']+)'/gm)) {
    const target = join(repo, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(relative));
  }
  const priorJournal = join(repo, 'scripts/n8n/out/foundation/wf00-restore-20261023.jsonl');
  for (const [relative, bytes] of currentFixtureInputs()) {
    const target = join(repo, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  mkdirSync(dirname(priorJournal), { recursive: true });
  writeFileSync(
    priorJournal,
    wf00RestoreReadOnlyAttempt.rows.map((row) => JSON.stringify(row)).join('\n') + '\n',
  );
  mkdirSync(join(root, 'Temp'));
  const zod = join(repo, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod');
  mkdirSync(zod, { recursive: true });
  writeFileSync(join(zod, 'package.json'), '{"name":"zod","version":"4.6.7","type":"module"}');
  writeFileSync(join(zod, 'index.js'), 'export const syntheticPublicFixture = true;');
  const modules = join(repo, 'packages/shared/node_modules');
  mkdirSync(modules, { recursive: true });
  symlinkSync(zod, join(modules, 'zod'), 'junction');
  const consumer = join(repo, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1');
  const cli = join(repo, 'scripts/n8n/foundation-provision-cli.mjs');
  const run = (script, input, extraEnv = {}) => {
    const wrapper = join(root, 'public-synthetic-wrapper.ps1');
    writeFileSync(wrapper, script);
    return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
      env: { ...environment(), LOCALAPPDATA: root, ...extraEnv },
      input,
      encoding: 'utf8',
      timeout: 25000,
      windowsHide: true,
    });
  };
  const seal = () => {
    const r = run(
      `& ${literal(join(repo, 'scripts/n8n/windows/New-M03FoundationPublicSeal.ps1'))} -ReplaceReviewedSeal; exit $LASTEXITCODE`,
    );
    assert.equal(r.status, 0, 'synthetic public closure seals');
    assert.equal(r.stderr, '');
  };
  const setupManagement = () => {
    const r = run(
      `function Read-Host {param($Prompt,[switch]$AsSecureString) ConvertTo-SecureString ${literal(canary)} -AsPlainText -Force}; . ${literal(join(repo, 'scripts/n8n/windows/Dev-CredentialStore.ps1'))}; Initialize-M03DevCredentials -Kind Management; Write-Output 'SYNTHETIC_MANAGEMENT_READY'`,
    );
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'SYNTHETIC_MANAGEMENT_READY');
    return join(root, 'Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi');
  };
  const invoke = (mode, input, extraEnv) =>
    run(`& ${literal(consumer)} -Mode ${mode}; exit $LASTEXITCODE`, input, extraEnv);
  const withParent = (mode, input) =>
    run(
      `$lock=[IO.File]::Open(${literal(join(root, 'Temp/emr-m03-acceptance-parent.operation.lock'))},[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);try{$bytes=[Text.Encoding]::UTF8.GetBytes((@{kind='m03_wf00_restore_parent';version=1;processId=$PID}|ConvertTo-Json -Compress));$lock.Write($bytes,0,$bytes.Length);$lock.Flush($true); & ${literal(consumer)} -Mode ${mode}; $native=$LASTEXITCODE}finally{$lock.Dispose();[IO.File]::Delete(${literal(join(root, 'Temp/emr-m03-acceptance-parent.operation.lock'))})};exit $native`,
      input,
    );
  try {
    return body({ root, repo, consumer, cli, run, invoke, withParent, seal, setupManagement, priorJournal });
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('emr-wf00-private-protocol-'));
    rmSync(root, { recursive: true, force: true });
  }
}

test('existing WF00 CLI journal preserves the pinned read-only prefix and enforces one bounded continuation', () =>
  fixture(({ repo, cli, priorJournal }) => {
    const source = readFileSync(cli, 'utf8');
    const functions = source.slice(
      source.indexOf('function restoreReadOnlyReceipt()'),
      source.indexOf('async function protectRestoreBackup('),
    );
    assert.ok(functions.startsWith('function restoreReadOnlyReceipt()'));
    const create = new Function(
      'repo',
      'out',
      'noLinks',
      'fail',
      'wf00RestoreReadOnlyAttempt',
      'foundationScope',
      'wf00RestoreScope',
      'lstatSync',
      'existsSync',
      'readFileSync',
      'mkdirSync',
      'join',
      'createHash',
      'openSync',
      'writeCompleteSync',
      'fsyncSync',
      'closeSync',
      functions + '\nreturn restoreJournal();',
    );
    const open = () =>
      create(
        repo,
        dirname(priorJournal),
        (path) => path,
        () => {
          throw Error('FIXED_SYNTHETIC_BLOCKED');
        },
        wf00RestoreReadOnlyAttempt,
        foundationScope,
        wf00RestoreScope,
        lstatSync,
        existsSync,
        readFileSync,
        mkdirSync,
        join,
        createHash,
        openSync,
        writeCompleteSync,
        fsyncSync,
        closeSync,
      );
    const before = readFileSync(priorJournal);
    const journal = open();
    assert.equal(journal.readOnlyAttemptVerified, true);
    assert.deepEqual(journal.rows, wf00RestoreReadOnlyAttempt.rows);
    assert.throws(() =>
      journal.append({
        event: 'request',
        number: 2,
        method: 'PUT',
        path: '/api/v1/workflows/MzimjpsuyPuK7SKe?publishIfActive=false',
      }),
    );
    const workflowId = wf00RestoreScope.workflowId;
    journal.append({
      event: 'restore_continuation',
      workflowId,
      priorToolReceipt: '905f06',
      priorRequestCount: 1,
      priorBackupRunId: wf00RestoreReadOnlyAttempt.backupRunId,
    });
    journal.append({
      event: 'request',
      number: 2,
      method: 'GET',
      path: '/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true',
    });
    assert.throws(() =>
      journal.append({
        event: 'backup_ready',
        workflowId,
        backupRunId: wf00RestoreReadOnlyAttempt.backupRunId,
      }),
    );
    journal.append({ event: 'backup_ready', workflowId, backupRunId: runId });
    journal.append({
      event: 'restore_intent',
      workflowId,
      sourceCommitSha: wf00RestoreScope.sourceCommitSha,
      backupRunId: runId,
    });
    journal.append({
      event: 'request',
      number: 3,
      method: 'PUT',
      path: '/api/v1/workflows/MzimjpsuyPuK7SKe?publishIfActive=false',
    });
    journal.append({
      event: 'request',
      number: 4,
      method: 'GET',
      path: '/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true',
    });
    assert.throws(() =>
      journal.append({
        event: 'restore_verified',
        workflowId,
        versionId: 'SyntheticNewExactVersion',
        backupRunId: runId,
        nativeReadonlySettings: { binaryMode: 'SYNTHETIC_PRIVATE_UNKNOWN_MODE' },
      }),
    );
    journal.append({
      event: 'restore_verified',
      workflowId,
      versionId: 'SyntheticNewExactVersion',
      backupRunId: runId,
      nativeReadonlySettings: { binaryMode: 'separate' },
    });
    const after = readFileSync(priorJournal);
    assert.equal(after.subarray(0, before.length).equals(before), true);
    assert.equal(journal.rows.length, 9);
    assert.deepEqual(
      journal.rows.filter((row) => row.event === 'request').map((row) => row.number),
      [1, 2, 3, 4],
    );
    assert.throws(open, 'a completed or uncertain continuation cannot be opened for another attempt');
    assert.throws(() =>
      journal.append({
        event: 'request',
        number: 5,
        method: 'GET',
        path: '/api/v1/workflows/MzimjpsuyPuK7SKe?excludePinnedData=true',
      }),
    );
    writeFileSync(priorJournal, before);
    const receipt = join(repo, wf00RestoreReadOnlyAttempt.receiptFile);
    writeFileSync(
      receipt,
      JSON.stringify({ ...JSON.parse(readFileSync(receipt, 'utf8')), actual: { nativeExit: 0 } }),
    );
    assert.throws(open, 'a source-hash mismatch cannot fabricate read-only closure proof');
  }));

test('WF00 restore consumer PowerShell syntax is valid before any private input', windows, () => {
  const file = resolve('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1');
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$tokens=$null;$errors=$null;$null=[Management.Automation.Language.Parser]::ParseFile(${literal(file)},[ref]$tokens,[ref]$errors);Write-Output $errors.Count; if($errors.Count -gt 0){exit 1}`,
    ],
    { env: environment(), encoding: 'utf8', windowsHide: true, timeout: 10000 },
  );
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '0');
  assert.equal(r.stderr, '');
});

test('current WF00 public receipt loader pins every prior readback and creates a fresh once-only three-request journal', () =>
  fixture(({ repo, cli, priorJournal }) => {
    const source = readFileSync(cli, 'utf8'),
      functions = source.slice(
        source.indexOf('function currentRestoreReceipt()'),
        source.indexOf('function restoreJournal()'),
      );
    const create = new Function(
      'repo',
      'out',
      'noLinks',
      'fail',
      'wf00CurrentRestoreScope',
      'wf00RestoreScope',
      'qualifyCurrentWf00Restore',
      'lstatSync',
      'readFileSync',
      'mkdirSync',
      'join',
      'createHash',
      'openSync',
      'writeCompleteSync',
      'fsyncSync',
      'closeSync',
      functions + '\nreturn { receipt: currentRestoreReceipt, journal: currentRestoreJournal };',
    );
    const access = create(
      repo,
      dirname(priorJournal),
      (path) => path,
      () => {
        throw Error('SYNTHETIC_FIXED_BLOCKED');
      },
      wf00CurrentRestoreScope,
      wf00RestoreScope,
      qualifyCurrentWf00Restore,
      lstatSync,
      readFileSync,
      mkdirSync,
      join,
      createHash,
      openSync,
      writeCompleteSync,
      fsyncSync,
      closeSync,
    );
    assert.equal(access.receipt().beforeVersionId, wf00CurrentRestoreScope.beforeVersionId);
    const old = readFileSync(priorJournal),
      journal = access.journal(),
      workflowId = wf00RestoreScope.workflowId;
    assert.throws(access.journal, 'the operation claim is CreateNew even before remote work');
    const get = (number) => ({
      event: 'request',
      number,
      method: 'GET',
      path: '/api/v1/workflows/' + workflowId + '?excludePinnedData=true',
    });
    assert.throws(() => journal.append({ ...get(1), method: 'PUT' }));
    journal.append(get(1));
    journal.append({ event: 'backup_ready', workflowId, backupRunId: runId });
    journal.append({
      event: 'restore_intent',
      workflowId,
      sourceCommitSha: wf00RestoreScope.sourceCommitSha,
      backupRunId: runId,
    });
    journal.append({
      event: 'request',
      number: 2,
      method: 'PUT',
      path: '/api/v1/workflows/' + workflowId + '?publishIfActive=false',
    });
    journal.append(get(3));
    assert.throws(() =>
      journal.append({
        event: 'restore_verified',
        workflowId,
        versionId: 'SyntheticNewExactVersion',
        backupRunId: runId,
        nativeReadonlySettings: { binaryMode: 'combined' },
      }),
    );
    journal.append({
      event: 'restore_verified',
      workflowId,
      versionId: 'SyntheticNewExactVersion',
      backupRunId: runId,
      nativeReadonlySettings: { binaryMode: 'separate' },
    });
    assert.throws(() => journal.append(get(4)));
    assert.deepEqual(readFileSync(priorJournal), old);
    const record = JSON.parse(readFileSync(join(repo, wf00CurrentRestoreScope.receiptFile), 'utf8')),
      first = join(repo, Object.keys(record.pins)[0]);
    writeFileSync(first, 'SYNTHETIC_PUBLIC_PIN_TAMPER');
    assert.throws(access.receipt);
  }));

test(
  'current WF00 native public CheckOnly pins the current version and refuses spent claims before private reads',
  windows,
  () =>
    fixture(({ repo, consumer, run, seal }) => {
      seal();
      const invoke = () =>
        run(`& ${literal(consumer)} -Mode RestoreWF00 -CurrentWf00 -CheckOnly; exit $LASTEXITCODE`);
      const ready = invoke();
      assert.equal(ready.status, 0, ready.stdout + ready.stderr);
      const result = JSON.parse(ready.stdout);
      assert.equal(result.privateRead, false);
      assert.equal(result.networkRequests, 0);
      assert.equal(result.maximumRequests, 3);
      assert.equal(result.currentVersionId, wf00CurrentRestoreScope.beforeVersionId);
      assert.equal(result.currentReconciliationVerified, true);
      writeFileSync(
        join(repo, 'scripts/n8n/out/foundation', wf00CurrentRestoreScope.journalFile),
        'SYNTHETIC_SPENT_CLAIM',
      );
      const denied = invoke();
      assert.equal(denied.status, 1);
      assert.equal(
        denied.stdout.trim(),
        'M03_FOUNDATION_PUBLIC_PREFLIGHT_BLOCKED. No private read/decryption/network.',
      );
    }),
);

test(
  'current WF00 native parent forwards only the fixed current selector and preserves the Management original',
  windows,
  () =>
    fixture(({ cli, invoke, seal, setupManagement }) => {
      const stored = setupManagement(),
        before = readFileSync(stored);
      writeFileSync(
        cli,
        `import{readFileSync}from'node:fs';const p=JSON.parse(readFileSync(0,'utf8'));if(process.argv.length!==4||process.argv[2]!=='RestoreWF00'||process.argv[3]!=='--current-wf00'||p.key!==${JSON.stringify(canary)}||p.purpose!=='m03_owned_wf00_restore'||process.env.PGPASSWORD||process.env.EMR_UNRELATED_ADMIN_CANARY)process.exit(1);console.log(JSON.stringify(${JSON.stringify(validReceipt)}));`,
      );
      seal();
      const r = invoke('RestoreWF00 -CurrentWf00', undefined, {
        PGPASSWORD: 'SYNTHETIC_UNRELATED',
        EMR_UNRELATED_ADMIN_CANARY: 'SYNTHETIC_UNRELATED',
      });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.privateRead, true);
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.parentLockDeleted, true);
      assert.equal(receipt.requestCount, 3);
      assert.deepEqual(readFileSync(stored), before);
      assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC_/);
    }),
);

test('WF00 private full backup is CurrentUser-DPAPI, exact semantic DTO and CreateNew only', windows, () =>
  fixture(({ root, run, withParent, invoke, seal }) => {
    seal();
    const input = JSON.stringify({
      kind: 'wf00_restore_backup',
      runId,
      dto: { ...fullDto, pinData: { ...fullDto.pinData, boundedLargePrivateDefinition: 'X'.repeat(70000) } },
    });
    const absent = invoke('ProtectWf00Backup', input);
    assert.equal(absent.status, 1);
    assert.equal(absent.stdout.trim(), 'M03_WF00_BACKUP_BLOCKED');
    const r = withParent('ProtectWf00Backup', input);
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '');
    assert.deepEqual(JSON.parse(r.stdout), {
      kind: 'wf00_restore_backup_ready',
      runId,
      backupReady: true,
      childNoCredential: true,
    });
    assert.equal(r.stdout.includes(dtoCanary), false);
    const file = join(root, 'Everyone-Market-Radar-Private/foundation/wf00-restore', runId + '.dpapi');
    const before = readFileSync(file);
    assert.equal(before.includes(Buffer.from(dtoCanary)), false);
    const check = run(
      `Add-Type -AssemblyName System.Security;. ${literal(resolve('scripts/n8n/windows/Dev-CredentialStore.ps1'))};Assert-M03DevPrivateAcl ${literal(dirname(file))} $true;Assert-M03DevPrivateAcl ${literal(file)} $false;$bytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes(${literal(file)}),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);try{$dto=ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString($bytes));if($dto.pinData.fullPrivateValue -cne ${literal(dtoCanary)} -or $dto.pinData.boundedLargePrivateDefinition.Length -ne 70000 -or $dto.staticData.retained.nested -ne $true -or $dto.otherSavedMetadata.retained.Count -ne 2 -or $dto.versionId -cne 'SyntheticActualBeforeVersion' -or [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($dto.unicodeFidelity)) -cne ${literal(Buffer.from(fullDto.unicodeFidelity).toString('base64'))}){throw 'blocked'};Write-Output 'FULL_DTO_ROUNDTRIP_READY'}finally{[Array]::Clear($bytes,0,$bytes.Length)}`,
    );
    assert.equal(check.status, 0);
    assert.equal(check.stdout.trim(), 'FULL_DTO_ROUNDTRIP_READY');
    const duplicate = withParent('ProtectWf00Backup', input);
    assert.equal(duplicate.status, 1);
    assert.equal(duplicate.stdout.trim(), 'M03_WF00_BACKUP_BLOCKED');
    assert.deepEqual(readFileSync(file), before);
  }),
);

test(
  'WF00 restore CheckOnly and reviewed-target gate precede private input or credential metadata',
  windows,
  () =>
    fixture(({ root, repo, consumer, run, seal, priorJournal }) => {
      seal();
      const check = () =>
        run(
          `& ${literal(consumer)} -Mode RestoreWF00 -CheckOnly; exit $LASTEXITCODE`,
          'SYNTHETIC_STDIN_NOT_READ',
        );
      const r = check();
      assert.equal(r.status, 0);
      const result = JSON.parse(r.stdout);
      assert.equal(result.privateRead, false);
      assert.equal(result.networkRequests, 0);
      assert.equal(result.maximumRequests, 3);
      for (const name of ['maximumShellCreates', 'maximumTagCreates', 'maximumCredentialCreates'])
        assert.equal(result[name], 0);
      assert.equal(readdirSync(root).includes('Everyone-Market-Radar-Private'), false);
      const backupCheck = run(
        `& ${literal(consumer)} -Mode ProtectWf00Backup -CheckOnly; exit $LASTEXITCODE`,
      );
      assert.equal(backupCheck.status, 0);
      assert.equal(JSON.parse(backupCheck.stdout).maximumRequests, 0);
      const priorBytes = readFileSync(priorJournal);
      writeFileSync(priorJournal, Buffer.concat([priorBytes, Buffer.from('\n')]));
      assert.equal(check().status, 1, 'altered read-only prefix stops before credential metadata');
      assert.equal(readdirSync(root).includes('Everyone-Market-Radar-Private'), false);
      writeFileSync(priorJournal, priorBytes);
      // A verified future runtime-export version must not change the exact
      // historical restore target or make the completed source gate unusable.
      const runtimeExport = join(repo, 'n8n/workflows/WF-00.json');
      const current = JSON.parse(readFileSync(runtimeExport, 'utf8'));
      current.versionId = 'SyntheticVerifiedRuntimeVersionAfterRestore';
      writeFileSync(runtimeExport, JSON.stringify(current));
      seal();
      assert.equal(check().status, 0);
      const target = join(repo, 'n8n/fixtures/WF-00-reviewed-native-staging-025c2a2.json'),
        targetBytes = readFileSync(target);
      writeFileSync(target, '{}');
      seal();
      const changed = check();
      assert.equal(changed.status, 1);
      assert.equal(
        changed.stdout.trim(),
        'M03_FOUNDATION_PUBLIC_PREFLIGHT_BLOCKED. No private read/decryption/network.',
      );
      assert.equal(readdirSync(root).includes('Everyone-Market-Radar-Private'), false);
      writeFileSync(target, targetBytes);
      const approval = join(
        repo,
        'milestones/M03-n8n-foundation/evidence/wf00-restore-approval-20261023.json',
      );
      writeFileSync(
        approval,
        JSON.stringify({ ...JSON.parse(readFileSync(approval, 'utf8')), ownerReply: 'SYNTHETIC_UNAPPROVED' }),
      );
      seal();
      const unapproved = check();
      assert.equal(unapproved.status, 1);
      assert.equal(
        unapproved.stdout.trim(),
        'M03_FOUNDATION_PUBLIC_PREFLIGHT_BLOCKED. No private read/decryption/network.',
      );
      assert.equal(readdirSync(root).includes('Everyone-Market-Radar-Private'), false);
    }),
);

test('WF00 backup rejects a different or active workflow before writing any private file', windows, () =>
  fixture(({ root, withParent, seal }) => {
    seal();
    for (const dto of [
      { ...fullDto, id: 'OtherWorkflow' },
      { ...fullDto, active: true },
      { ...fullDto, activeVersion: { id: 'SyntheticPublishedVersion' } },
      { ...fullDto, shared: [{ projectId: 'OtherProject', role: 'workflow:owner' }] },
    ]) {
      const r = withParent('ProtectWf00Backup', JSON.stringify({ kind: 'wf00_restore_backup', runId, dto }));
      assert.equal(r.status, 1);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'M03_WF00_BACKUP_BLOCKED');
      assert.equal(readdirSync(root).includes('Everyone-Market-Radar-Private'), false);
    }
  }),
);

test(
  'WF00 restore reuses only persistent Management, backs up full DTO in a separate child and closes cleanly',
  windows,
  () =>
    fixture(({ root, cli, consumer, invoke, seal, setupManagement }) => {
      const stored = setupManagement(),
        before = readFileSync(stored);
      writeFileSync(
        cli,
        `import{readFileSync}from'node:fs';import{spawnSync}from'node:child_process';const p=JSON.parse(readFileSync(0,'utf8'));if(Object.keys(p).sort().join(',')!=='expiresAt,key,purpose,windowId'||p.key!==${JSON.stringify(canary)}||p.purpose!=='m03_owned_wf00_restore'||p.windowId!==${JSON.stringify(validReceipt.windowId)}||Date.parse(p.expiresAt)-Date.now()>300000||Date.parse(p.expiresAt)-Date.now()<240000||process.env.EMR_UNRELATED_ADMIN_CANARY||process.env.PGPASSWORD)process.exit(1);const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',${JSON.stringify(consumer)},'-Mode','ProtectWf00Backup'],{input:JSON.stringify({kind:'wf00_restore_backup',runId:${JSON.stringify(runId)},dto:${JSON.stringify(fullDto)}}),env:process.env,encoding:'utf8',windowsHide:true});if(r.status!==0||JSON.parse(r.stdout).backupReady!==true)process.exit(1);console.log(JSON.stringify(${JSON.stringify(validReceipt)}));`,
      );
      seal();
      const r = invoke('RestoreWF00', undefined, {
        EMR_UNRELATED_ADMIN_CANARY: 'SYNTHETIC_UNRELATED',
        PGPASSWORD: 'SYNTHETIC_UNRELATED',
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.includes(canary), false);
      assert.equal(r.stdout.includes(dtoCanary), false);
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.status, 'wf00_restore_verified');
      assert.equal(receipt.requestCount, 3);
      assert.equal(receipt.privateRead, true);
      assert.equal(receipt.persistentManagementRetained, true);
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.parentLockDeleted, true);
      assert.deepEqual(readFileSync(stored), before);
      assert.equal(readdirSync(join(root, 'Everyone-Market-Radar-Private/secrets/dev/admin')).length, 0);
    }),
);

test(
  'WF00 restore fixed projection rejects raw output, over-cap or fabricated acknowledgement',
  windows,
  () =>
    fixture(({ cli, invoke, seal, setupManagement }) => {
      setupManagement();
      for (const changed of [
        { requestCount: 4 },
        { executionCount: 1 },
        { status: 'wf00_restore_reconciled' },
        { exactContentVerified: false },
        { nativeStorageModePreserved: false },
        { privateRaw: dtoCanary },
      ]) {
        writeFileSync(
          cli,
          `console.log(JSON.stringify(${JSON.stringify({ ...validReceipt, ...changed })}));`,
        );
        seal();
        const r = invoke('RestoreWF00');
        assert.equal(r.status, 1);
        assert.equal(r.stderr, '');
        assert.equal(r.stdout.includes(dtoCanary), false);
        const receipt = JSON.parse(r.stdout);
        assert.equal(receipt.status, 'wf00_restore_blocked');
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.parentLockDeleted, true);
        assert.equal(receipt.persistentManagementRetained, true);
      }
      const reconciled = { ...validReceipt, status: 'wf00_restore_reconciled', putAcknowledged: false };
      writeFileSync(cli, `console.log(JSON.stringify(${JSON.stringify(reconciled)}));`);
      seal();
      const recovered = invoke('RestoreWF00');
      assert.equal(recovered.status, 0);
      assert.equal(JSON.parse(recovered.stdout).putAcknowledged, false);
      const blocked = {
        ...validReceipt,
        status: 'wf00_restore_blocked',
        diagnostic: 'settings_merge_unsupported',
        putAttempted: false,
        putAcknowledged: false,
        exactContentVerified: false,
        versionId: null,
      };
      writeFileSync(cli, `console.log(JSON.stringify(${JSON.stringify(blocked)}));`);
      seal();
      const settings = invoke('RestoreWF00');
      assert.equal(settings.status, 1);
      assert.equal(JSON.parse(settings.stdout).diagnostic, 'settings_merge_unsupported');
      writeFileSync(
        cli,
        `process.stderr.write(${JSON.stringify(canary)});throw Error('SYNTHETIC_CHILD_CRASH');`,
      );
      seal();
      const crashed = invoke('RestoreWF00');
      assert.equal(crashed.status, 1);
      assert.equal(crashed.stderr, '');
      assert.equal(crashed.stdout.includes(canary), false);
      const unknown = JSON.parse(crashed.stdout);
      assert.equal(unknown.requestCount, null);
      assert.equal(unknown.networkCompletionVerified, false);
      assert.equal(unknown.childClosed, true);
      assert.equal(unknown.persistentManagementRetained, true);
    }),
);

test('WF00 forced child stop retains the shared marker and reports unknown requests', windows, () =>
  fixture(({ root, cli, consumer, invoke, seal, setupManagement }) => {
    const stored = setupManagement(),
      before = readFileSync(stored);
    writeFileSync(cli, 'process.stdin.resume();setTimeout(()=>{},5000);');
    const source = readFileSync(consumer, 'utf8');
    assert.equal(source.split('WaitForExit(300000)').length, 2);
    // Shorten only this copied consumer's technical wait; production stays5min.
    writeFileSync(consumer, source.replace('WaitForExit(300000)', 'WaitForExit(100)'));
    seal();
    const r = invoke('RestoreWF00');
    assert.equal(r.status, 1);
    assert.equal(r.stderr, '');
    const receipt = JSON.parse(r.stdout);
    assert.equal(receipt.childClosed, false);
    assert.equal(receipt.requestCount, null);
    assert.equal(receipt.networkCompletionVerified, false);
    assert.equal(receipt.parentLockDeleted, false);
    assert.equal(receipt.persistentManagementRetained, true);
    assert.deepEqual(readFileSync(stored), before);
    const marker = JSON.parse(
      readFileSync(join(root, 'Temp/emr-m03-acceptance-parent.operation.lock'), 'utf8'),
    );
    assert.equal(marker.kind, 'm03_wf00_restore_parent');
  }),
);
