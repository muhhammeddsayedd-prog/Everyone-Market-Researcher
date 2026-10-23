import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { test } from 'node:test';

const helper = resolve('scripts/n8n/windows/Dev-CredentialStore.ps1');
const entry = resolve('scripts/n8n/windows/New-M03AcceptanceHandoff.ps1');
const q = (value) => `'${value.replaceAll("'", "''")}'`;
const windows = process.platform === 'win32';
function run(directory, code, status = 0) {
  const script = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$env:LOCALAPPDATA=${q(directory)}\n. ${q(helper)}\n${code}\n`;
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
          process.env[key] ? [[key, process.env[key]]] : [],
        ),
      ),
    },
  );
  assert.equal(result.status, status, result.stderr.replaceAll(/SYNTHETIC_[A-Z_]+/g, '[synthetic]'));
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /SYNTHETIC_/);
  return result.stdout.trim();
}
function fixture(callback) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-dev-access-test-'));
  mkdirSync(join(directory, 'Temp'));
  try {
    callback(directory);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(directory).startsWith('emr-dev-access-test-'));
    assert.equal(realpathSync.native(directory).toLowerCase(), resolve(directory).toLowerCase());
    rmSync(directory, { recursive: true, force: true });
  }
}
const initialize = `
$script:prompts=0
function Read-Host {param($Prompt,[switch]$AsSecureString) $script:prompts++;return ConvertTo-SecureString ('SYNTHETIC_'+$script:prompts+'_LOCAL_ONLY') -AsPlainText -Force}
Initialize-M03DevCredentials -Action Initialize -Kind All
if($script:prompts -ne 4){throw 'PROMPT_COUNT'}
`;

test('persistent dev store syntax parses natively', { skip: !windows }, () =>
  fixture((directory) => {
    run(
      directory,
      `foreach($file in @(${q(helper)},${q(entry)})){ $tokens=$null;$errors=$null;$null=[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'PARSE_FAILED'}};Write-Output 'PARSE_OK'`,
    );
  }),
);

test(
  'one setup persists four separate CurrentUser originals with exact SID/SYSTEM ACLs and no expiry',
  { skip: !windows },
  () =>
    fixture((directory) => {
      const output = run(
        directory,
        `${initialize}
$status=Get-M03DevCredentialStatus
if($status.status -cne 'ready' -or $status.missing.Count -ne 0 -or $status.authenticationTested){throw 'STATUS_FAILED'}
foreach($kind in @('Admin','Management','Writer','ApifyRead')){$spec=Get-M03DevCredentialSpec $kind;Assert-M03DevPrivateAcl $spec.Source $false;if(Test-Path -LiteralPath $spec.Cipher){throw 'UNREQUESTED_RUNTIME_COPY'}}
Write-Output 'PERSISTED_PRIVATE_SEPARATE_NO_RUNTIME'
`,
      );
      assert.equal(output, 'PERSISTED_PRIVATE_SEPARATE_NO_RUNTIME');
      const status = JSON.parse(
        run(directory, 'Get-M03DevCredentialStatus|ConvertTo-Json -Depth 5 -Compress'),
      );
      assert.equal(status.status, 'ready');
      assert.deepEqual(
        status.entries.map((item) => item.kind),
        ['Admin', 'Management', 'Writer', 'ApifyRead'],
      );
    }),
);

test(
  'different bounded children reuse a selected credential, dispose its copy, and reuse original without prompting',
  { skip: !windows },
  () =>
    fixture((directory) => {
      run(directory, initialize);
      run(
        directory,
        `
Ensure-M03DevRuntimeHandoff -Kind Writer
$spec=Get-M03DevCredentialSpec Writer
$secure=ConvertTo-SecureString -String ([IO.File]::ReadAllText($spec.Cipher))
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{$value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer);if($value -cne 'SYNTHETIC_3_LOCAL_ONLY'){throw 'DPAPI_CROSS_PROCESS_FAILED'}}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose();$value=$null}
foreach($kind in @('Admin','Management','ApifyRead')){if(Test-Path -LiteralPath (Get-M03DevCredentialSpec $kind).Cipher){throw 'ROLE_LEAK'}}
[IO.File]::Delete($spec.Cipher);[IO.File]::Delete($spec.Lease)
Write-Output 'BOUNDED_CHILD_CLOSED_COPY_DELETED'
`,
      );
      run(
        directory,
        `
function Read-Host {throw 'UNEXPECTED_PROMPT'}
Initialize-M03DevCredentials -Action Initialize -Kind All
Ensure-M03DevRuntimeHandoff -Kind Writer
$spec=Get-M03DevCredentialSpec Writer
if(-not (Test-Path -LiteralPath $spec.Source) -or -not (Test-Path -LiteralPath $spec.Cipher)){throw 'REUSE_FAILED'}
Write-Output 'ORIGINAL_REUSED'
`,
      );
    }),
);

test(
  'only an exact purpose-approved temporary pair imports and original is retained',
  { skip: !windows },
  () =>
    fixture((directory) => {
      run(
        directory,
        `
$spec=Get-M03DevCredentialSpec Management
$secure=ConvertTo-SecureString 'SYNTHETIC_IMPORT_LOCAL_ONLY' -AsPlainText -Force
try{$cipher=ConvertFrom-SecureString $secure;[IO.File]::WriteAllText($spec.Cipher,$cipher)}finally{$secure.Dispose();$cipher=$null}
(Get-M03DevCredentialLease $spec)|ConvertTo-Json -Compress|Set-Content -LiteralPath $spec.Lease -Encoding UTF8
function Read-Host {throw 'UNEXPECTED_PROMPT'}
Initialize-M03DevCredentials -Action Initialize -Kind Management
if(-not (Test-Path -LiteralPath $spec.Source) -or -not (Test-Path -LiteralPath $spec.Cipher)){throw 'IMPORT_DID_NOT_PRESERVE'}
Write-Output 'EXACT_IMPORT_RETAINED'
`,
      );
    }),
);

test(
  'wrong-target temporary metadata, broad ACLs and ambiguous disposable ownership fail without secret output',
  { skip: !windows },
  () =>
    fixture((directory) => {
      run(
        directory,
        `${initialize}
$spec=Get-M03DevCredentialSpec Management
Ensure-M03DevRuntimeHandoff -Kind Management
$metadata=Get-M03DevCredentialLease $spec;$metadata.windowId='unrelated';$metadata|ConvertTo-Json -Compress|Set-Content -LiteralPath $spec.Lease -Encoding UTF8
$blocked=$false;try{Ensure-M03DevRuntimeHandoff -Kind Management}catch{$blocked=$true};if(-not $blocked){throw 'WRONG_PURPOSE_ACCEPTED'}
[IO.File]::Delete($spec.Lease)
$blocked=$false;try{Ensure-M03DevRuntimeHandoff -Kind Management}catch{$blocked=$true};if(-not $blocked){throw 'AMBIGUOUS_ACCEPTED'}
$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner([Security.Principal.WindowsIdentity]::GetCurrent().User);$acl.SetAccessRuleProtection($false,$true);[IO.File]::SetAccessControl($spec.Source,$acl)
$blocked=$false;try{$null=Get-M03DevCredentialStatus}catch{$blocked=$true};if(-not $blocked){throw 'BROAD_ACL_ACCEPTED'}
Write-Output 'FIXED_FAILURES_NO_DECRYPTION'
`,
      );
    }),
);

test(
  'explicit update preserves other entries and initialization never repeats saved prompts',
  { skip: !windows },
  () =>
    fixture((directory) => {
      run(
        directory,
        `${initialize}
$old=[IO.File]::ReadAllText((Get-M03DevCredentialSpec Admin).Source)
$script:prompts=0
Initialize-M03DevCredentials -Action Initialize -Kind All
if($script:prompts -ne 0){throw 'REPEATED_PROMPT'}
Initialize-M03DevCredentials -Action Update -Kind Management
if($script:prompts -ne 1 -or [IO.File]::ReadAllText((Get-M03DevCredentialSpec Admin).Source) -cne $old){throw 'UPDATE_WIDENED'}
Write-Output 'UPDATE_SCOPED'
`,
      );
    }),
);

test(
  'expired matching disposable delivery refreshes only under the current held coordinator mutex',
  { skip: !windows },
  () =>
    fixture((directory) => {
      run(
        directory,
        `${initialize}
Ensure-M03DevRuntimeHandoff -Kind Writer
$spec=Get-M03DevCredentialSpec Writer
$lease=Get-M03DevCredentialLease $spec;$lease.createdAt=[DateTimeOffset]::UtcNow.AddHours(-3).ToString('o');$lease.expiresAt=[DateTimeOffset]::UtcNow.AddHours(-1).ToString('o');$lease|ConvertTo-Json -Compress|Set-Content -LiteralPath $spec.Lease -Encoding UTF8
Write-Output 'OLD_DELIVERY_RETAINED'
`,
      );
      run(
        directory,
        `
$spec=Get-M03DevCredentialSpec Writer
$blocked=$false;try{Ensure-M03DevRuntimeHandoff -Kind Writer}catch{$blocked=$true};if(-not $blocked){throw 'MUTEX_REQUIRED'}
$parent=Join-Path $env:LOCALAPPDATA 'Temp\\emr-m03-acceptance-parent.operation.lock'
$lock=[IO.File]::Open($parent,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{
 $metadata=[ordered]@{kind='m03_clock_admission_parent';version=1;segmentId='20275b22-b7fe-4737-a9a4-c50c2feadb74';processId=$PID}
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($metadata|ConvertTo-Json -Compress));$lock.Write($bytes,0,$bytes.Length);$lock.Flush($true)
 Ensure-M03DevRuntimeHandoff -Kind Writer -CoordinatorLock $lock
 $fresh=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($spec.Lease));if([DateTimeOffset]::Parse($fresh.expiresAt) -lt [DateTimeOffset]::UtcNow.AddMinutes(110)){throw 'EXPIRED_NOT_REFRESHED'}
 if(-not (Test-Path -LiteralPath $spec.Source)){throw 'ORIGINAL_REMOVED'}
}finally{$lock.Dispose()}
Write-Output 'EXPIRED_COPY_REFRESHED_ORIGINAL_RETAINED'
`,
      );
    }),
);

test('hardlinked credential leaves are rejected before loading or changing them', { skip: !windows }, () =>
  fixture((directory) => {
    run(
      directory,
      `${initialize}
$spec=Get-M03DevCredentialSpec Management
$link=Join-Path $env:LOCALAPPDATA 'linked.dpapi'
$null=New-Item -ItemType HardLink -Path $link -Target $spec.Source
$blocked=$false;try{Ensure-M03DevRuntimeHandoff -Kind Management}catch{$blocked=$true};if(-not $blocked){throw 'HARDLINK_ACCEPTED'}
Write-Output 'HARDLINK_BLOCKED'
`,
    );
  }),
);

test('malformed imported ciphertext never becomes a persistent credential', { skip: !windows }, () =>
  fixture((directory) => {
    run(
      directory,
      `
$spec=Get-M03DevCredentialSpec Management
[IO.File]::WriteAllText($spec.Cipher,'SYNTHETIC_NOT_ENCRYPTED')
(Get-M03DevCredentialLease $spec)|ConvertTo-Json -Compress|Set-Content -LiteralPath $spec.Lease -Encoding UTF8
function Read-Host {throw 'UNEXPECTED_PROMPT'}
$blocked=$false;try{Initialize-M03DevCredentials -Action Initialize -Kind Management}catch{$blocked=$true}
if(-not $blocked -or (Test-Path -LiteralPath $spec.Source)){throw 'MALFORMED_CIPHER_IMPORTED'}
Write-Output 'MALFORMED_IMPORT_BLOCKED'
`,
    );
  }),
);
