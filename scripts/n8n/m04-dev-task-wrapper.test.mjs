import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { test } from 'node:test';

const windows = process.platform === 'win32';
const wrapper = resolve('scripts/n8n/windows/Invoke-M04DevTask.ps1');
const helper = resolve('scripts/n8n/windows/Dev-CredentialStore.ps1');
const q = (value) => `'${value.replaceAll("'", "''")}'`;
const kinds = {
  Inventory: ['management'],
  ProviderMetadata: ['apifyRead'],
  Stage: ['management'],
  Observe: ['management'],
  Probe: ['machine'],
  Restore: ['machine', 'management'],
};

function ps(directory, code, expectedStatus = 0) {
  const script = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$env:LOCALAPPDATA=${q(join(directory, 'local'))}\n${code}`;
  const result = spawnSync(
    join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    {
      encoding: 'utf8',
      timeout: 25000,
      windowsHide: true,
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'APPDATA', 'USERPROFILE'].flatMap((key) =>
          process.env[key] ? [[key, process.env[key]]] : [],
        ),
      ),
    },
  );
  assert.equal(result.status, expectedStatus, 'unexpected fixed wrapper exit');
  assert.equal(result.stderr, '', 'no raw native errors may escape');
  assert.doesNotMatch(result.stdout, /SYNTHETIC_/);
  return result.stdout.trim();
}

function fixture(callback) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-m04-task-test-'));
  const windowsDir = join(directory, 'scripts/n8n/windows');
  mkdirSync(windowsDir, { recursive: true });
  mkdirSync(join(directory, 'local'));
  copyFileSync(wrapper, join(windowsDir, 'Invoke-M04DevTask.ps1'));
  copyFileSync(helper, join(windowsDir, 'Dev-CredentialStore.ps1'));
  try {
    callback({
      directory,
      entry: join(windowsDir, 'Invoke-M04DevTask.ps1'),
      helper: join(windowsDir, 'Dev-CredentialStore.ps1'),
      runner: join(directory, 'scripts/n8n/m04-dev-task.mjs'),
    });
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(directory).startsWith('emr-m04-task-test-'));
    rmSync(directory, { recursive: true, force: true });
  }
}

function initialize(f) {
  ps(
    f.directory,
    `. ${q(f.helper)}
$root=Initialize-M03DevPrivateDirectory
foreach($kind in @('Management','Writer','ApifyRead')) {
 $secure=ConvertTo-SecureString ('SYNTHETIC_'+$kind+'_LOCAL_ONLY') -AsPlainText -Force
 try{$bytes=[Text.Encoding]::ASCII.GetBytes((ConvertFrom-SecureString $secure));Write-M03DevPrivateFile -Path (Get-M03DevCredentialSpec $kind).Source -Bytes $bytes}finally{$secure.Dispose();[Array]::Clear($bytes,0,$bytes.Length)}
}
$directory=Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private\\foundation\\df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
$null=[IO.Directory]::CreateDirectory($directory);Set-M03DevPrivateAcl $directory $true
$secure=ConvertTo-SecureString 'SYNTHETIC_Machine_LOCAL_ONLY' -AsPlainText -Force
try{$bytes=[Text.Encoding]::ASCII.GetBytes((ConvertFrom-SecureString $secure));Write-M03DevPrivateFile -Path (Join-Path $directory 'machine.dpapi') -Bytes $bytes}finally{$secure.Dispose();[Array]::Clear($bytes,0,$bytes.Length)}
Write-Output 'SYNTHETIC_SETUP_COMPLETE'.Replace('SYNTHETIC_','')`,
  );
}

function native(f, task, phase = 'default', expected = 0, prefix = '') {
  return JSON.parse(
    ps(
      f.directory,
      `${prefix}\n& ${q(f.entry)} -Task ${q(task)} -Phase ${q(phase)}\nexit $LASTEXITCODE`,
      expected,
    ),
  );
}

function readState(f) {
  return JSON.parse(
    ps(
      f.directory,
      `Add-Type -AssemblyName System.Security
$path=Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private\\m04\\state.dpapi'
$plain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
try{[Text.Encoding]::UTF8.GetString($plain)}finally{[Array]::Clear($plain,0,$plain.Length)}`,
    ),
  );
}

const consumer = `
let text='';for await(const chunk of process.stdin)text+=chunk;
const x=JSON.parse(text);
if(process.env.PGPASSWORD || process.env.NODE_OPTIONS || process.env.UNRELATED_SECRET)process.exit(7);
const expected=JSON.parse(process.env.EMR_NOT_FORWARDED ?? 'null');
if(expected!==null)process.exit(8);
const count=(x.state.count??0)+1;
process.stdout.write(JSON.stringify({public:{status:'completed',task:x.task,phase:x.phase,keys:Object.keys(x.secrets).sort(),priorCount:x.state.count??0},private:{count,large:'a'.repeat(70000)}}));
`;

test('M04 wrapper native syntax and CheckOnly read no private files', { skip: !windows }, () =>
  fixture((f) => {
    writeFileSync(f.runner, consumer);
    const output = ps(
      f.directory,
      `$tokens=$null;$errors=$null;$null=[Management.Automation.Language.Parser]::ParseFile(${q(f.entry)},[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'PARSE_FAILED'}
& ${q(f.entry)} -Task Setup -Phase project -CheckOnly
if(Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private')){throw 'PRIVATE_READ_OR_WRITE'}
exit $LASTEXITCODE`,
    );
    assert.deepEqual(JSON.parse(output), {
      status: 'check_only_ready',
      task: 'Setup',
      phase: 'project',
      privateRead: false,
      networkRequests: 0,
    });
    const invalid = ps(
      f.directory,
      `& ${q(f.entry)} -Task Stage -Phase unsupported -CheckOnly
$code=$LASTEXITCODE
if(Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private')){throw 'PRIVATE_READ_OR_WRITE'}
exit $code`,
      1,
    );
    assert.equal(JSON.parse(invalid).stage, 'phase');
  }),
);

test(
  'each task receives only its scoped persistent originals and preserves them across children',
  { skip: !windows },
  () =>
    fixture((f) => {
      initialize(f);
      writeFileSync(f.runner, consumer);
      const root = join(f.directory, 'local/Everyone-Market-Radar-Private');
      const originalPaths = ['management', 'writer', 'apifyread'].map((key) =>
        join(root, `secrets/dev/runtime/${key}.dpapi`),
      );
      originalPaths.push(join(root, 'foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9/machine.dpapi'));
      const originals = originalPaths.map((path) => readFileSync(path));
      let count = 0;
      for (const [task, expected] of Object.entries(kinds)) {
        const actual = native(
          f,
          task,
          task === 'Stage' ? 'stage' : task === 'Restore' ? 'native' : 'default',
          0,
          "$env:PGPASSWORD='SYNTHETIC_ENV_LOCAL_ONLY';$env:UNRELATED_SECRET='SYNTHETIC_ENV_LOCAL_ONLY';$env:EMR_NOT_FORWARDED='SYNTHETIC_ENV_LOCAL_ONLY';$env:NODE_OPTIONS='--require=does-not-exist'",
        );
        assert.deepEqual(actual.keys, expected);
        assert.equal(actual.priorCount, count++);
      }
      assert.deepEqual(native(f, 'Setup', 'configure').keys, ['apifyRead', 'machine', 'writer']);
      assert.deepEqual(native(f, 'Stage', 'publish').keys, ['management']);
      assert.deepEqual(native(f, 'Stage', 'machine').keys, ['machine', 'management']);
      for (const phase of ['project', 'prepare', 'poll', 'cleanup']) {
        assert.deepEqual(native(f, 'Setup', phase).keys, []);
      }
      assert.equal(
        readState(f).large.length,
        70000,
        'large state uses DPAPI bytes rather than SecureString limit',
      );
      originalPaths.forEach((path, index) => assert.deepEqual(readFileSync(path), originals[index]));
    }),
);

test(
  'handled blocked task persists recovery snapshot before fixed public output and failure exit',
  { skip: !windows },
  () =>
    fixture((f) => {
      initialize(f);
      writeFileSync(f.runner, consumer);
      native(f, 'Inventory');
      writeFileSync(
        f.runner,
        `let t='';for await(const c of process.stdin)t+=c;const x=JSON.parse(t);process.stdout.write(JSON.stringify({public:{status:'blocked',code:'M04_SYNTHETIC_FAILURE'.replace('SYNTHETIC_','')},private:{...x.state,rollback:{workflowId:'owned-fixture'},charged:2}}));`,
      );
      assert.equal(native(f, 'Inventory', 'default', 1).status, 'blocked');
      assert.equal(readState(f).rollback.workflowId, 'owned-fixture');
      assert.equal(readState(f).charged, 2);
    }),
);

test(
  'fatal child, malformed output and selected-secret reflection preserve earlier state without raw output',
  { skip: !windows },
  () =>
    fixture((f) => {
      initialize(f);
      writeFileSync(f.runner, consumer);
      native(f, 'Inventory');
      const statePath = join(f.directory, 'local/Everyone-Market-Radar-Private/m04/state.dpapi');
      const before = readFileSync(statePath);
      for (const body of [
        "process.stderr.write('SYNTHETIC_RAW_ERROR_LOCAL_ONLY');process.exit(3);",
        "process.stdout.write('SYNTHETIC_RAW_STDOUT_LOCAL_ONLY');",
        "let t='';for await(const c of process.stdin)t+=c;const x=JSON.parse(t);process.stdout.write(JSON.stringify({public:{status:'completed',leak:x.secrets.management},private:{changed:true}}));",
      ]) {
        writeFileSync(f.runner, body);
        assert.deepEqual(native(f, 'Inventory', 'default', 1), {
          status: 'blocked',
          code: 'M04_BOUNDED_TASK_BLOCKED',
          stage: 'child_contract',
        });
        assert.deepEqual(readFileSync(statePath), before);
      }
    }),
);

test(
  'broad credential ACL and invalid setup phase fail before the fixed child runs',
  { skip: !windows },
  () =>
    fixture((f) => {
      initialize(f);
      writeFileSync(
        f.runner,
        "process.stdout.write(JSON.stringify({public:{status:'completed',childRan:true}}));",
      );
      assert.equal(native(f, 'Setup', 'arbitrary', 1).status, 'blocked');
      ps(
        f.directory,
        `. ${q(f.helper)};$path=(Get-M03DevCredentialSpec Management).Source
$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.WindowsIdentity]::GetCurrent().User);$acl.SetAccessRuleProtection($false,$true);[IO.File]::SetAccessControl($path,$acl)`,
      );
      assert.deepEqual(native(f, 'Inventory', 'default', 1), {
        status: 'blocked',
        code: 'M04_BOUNDED_TASK_BLOCKED',
        stage: 'private_acl',
      });
    }),
);
