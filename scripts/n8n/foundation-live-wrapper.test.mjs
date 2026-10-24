import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const names = [
  'New-M03AcceptanceHandoff.ps1',
  'Acceptance-PublicRuntime.ps1',
  'New-M03AcceptancePublicSeal.ps1',
  'Invoke-M03Acceptance.ps1',
];
const windowsOnly = { skip: process.platform !== 'win32' };
const safeEnvironment = (directory) => ({
  SystemRoot: process.env.SystemRoot,
  WINDIR: process.env.WINDIR,
  PATH: process.env.PATH,
  TEMP: directory,
  TMP: directory,
  LOCALAPPDATA: directory,
});

test(
  'public DB forward profile uses only its reviewed project context and a credential-free native child',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-forward-public-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const io = source.slice(
        source.indexOf('function Initialize-BoundedIo'),
        source.indexOf('function Invoke-PublicCompositionCheck'),
      );
      const helper = source.slice(
        source.indexOf('function Invoke-PublicDatabaseCheck('),
        source.indexOf('function ', source.indexOf('function Invoke-PublicDatabaseCheck(') + 10),
      );
      const childDirectory = join(directory, 'scripts/db/windows');
      mkdirSync(childDirectory, { recursive: true });
      writeFileSync(
        join(childDirectory, 'Invoke-M03FoundationMigrations.ps1'),
        `param([switch]$CheckOnly,[switch]$PhaseAControl,[switch]$ProjectVerifiedContinuation,[switch]$ForwardWindow)
if(-not $CheckOnly -or -not $PhaseAControl -or -not $ProjectVerifiedContinuation -or -not $ForwardWindow){exit 1}
if(Test-Path Env:EMR_SYNTHETIC_SECRET){exit 1}
Write-Output 'M03_FOUNDATION PUBLIC_INPUTS_READY.'
exit 4
`,
      );
      const script = join(directory, 'forward.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
${io}
${helper}
function Public-File([string]$Path){return $Path}
Initialize-BoundedIo
$ready=Invoke-PublicDatabaseCheck '${directory.replaceAll("'", "''")}' $true $null $false $false $false $false $true $true
if($ready -ne $false){throw 'WRONG_NATIVE_READY'}
$blocked=$false
try{$null=Invoke-PublicDatabaseCheck '${directory.replaceAll("'", "''")}' $true $null $false $false $false $false $false $true}catch{$blocked=$true}
if(-not $blocked){throw 'LEGACY_FORWARD_ALLOWED'}
Write-Output 'NATIVE_FORWARD_PUBLIC_PASS'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: { ...safeEnvironment(directory), EMR_SYNTHETIC_SECRET: 'SYNTHETIC_ONLY' },
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
      });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'NATIVE_FORWARD_PUBLIC_PASS');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'approved management readiness is projected only for the exact current public profile',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-management-projection-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const start = source.indexOf('function Get-ProjectVerifiedPublicManagementMaximum(');
      const end = source.indexOf('function ConvertTo-ProjectVerifiedReadinessBlock(', start);
      assert.ok(start > 0 && end > start);
      const script = join(directory, 'management.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
${source.slice(start, end)}
$valid=[ordered]@{kind='project_verified_continuation_ready';segmentId='20275b22-b7fe-4737-a9a4-c50c2feadb74';sourceCommitSha='a5e746736893d5040e93032ae740a0878f748837';windowId='38b3708d-61b0-41d2-8170-5ed91c66b4dc';privateRead=$false;networkRequests=0;managementMaximum=576;managementAttempts=152;controlAttempts=384;combinedAttempts=536}
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$valid) $true 'CheckOnly') -ne 576){throw 'APPROVED_CAP_NOT_PROJECTED'}
$reconciled=[ordered]@{};foreach($name in $valid.Keys){$reconciled[$name]=$valid[$name]};$reconciled.managementAttempts=177;$reconciled.controlAttempts=435;$reconciled.combinedAttempts=612
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$reconciled) $true 'CheckOnly') -ne 576){throw 'RECONCILED_CHARGES_NOT_PROJECTED'}
$fresh=[ordered]@{};foreach($name in $valid.Keys){$fresh[$name]=$valid[$name]};$fresh.managementMaximum=640;$fresh.managementAttempts=237;$fresh.controlAttempts=486;$fresh.combinedAttempts=723;$fresh.sourceCommitSha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803';$fresh.windowId='eda4fae1-1e19-47db-81b8-beac1a4ed883'
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$fresh) $true 'CheckOnly') -ne 640){throw 'APPROVED_640_CHARGES_NOT_PROJECTED'}
$latest=[ordered]@{};foreach($name in $fresh.Keys){$latest[$name]=$fresh[$name]};$latest.managementAttempts=263;$latest.controlAttempts=537;$latest.combinedAttempts=800
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$latest) $true 'CheckOnly') -ne 640){throw 'PREPRIVATE_263_CHARGES_NOT_PROJECTED'}
$catalog=[ordered]@{};foreach($name in $fresh.Keys){$catalog[$name]=$fresh[$name]};$catalog.managementMaximum=704;$catalog.managementAttempts=288;$catalog.controlAttempts=588;$catalog.combinedAttempts=876
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$catalog) $true 'CheckOnly') -ne 704){throw 'APPROVED_704_CHARGES_NOT_PROJECTED'}
$admission=[ordered]@{};foreach($name in $catalog.Keys){$admission[$name]=$catalog[$name]};$admission.managementAttempts=313;$admission.controlAttempts=639;$admission.combinedAttempts=952
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$admission) $true 'CheckOnly') -ne 704){throw 'NO_ADMIN_313_CHARGES_NOT_PROJECTED'}
$next=[ordered]@{};foreach($name in $admission.Keys){$next[$name]=$admission[$name]};$next.managementMaximum=832;$next.managementAttempts=401;$next.controlAttempts=740;$next.combinedAttempts=1141;$next.sourceCommitSha='7b1837201ac7925591577a1517d7288936ca3464';$next.windowId='3c46c791-e140-4eb9-890a-eecfa251f65e'
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$next) $true 'CheckOnly') -ne 832){throw 'NEXT_832_CHARGES_NOT_PROJECTED'}
$restored=[ordered]@{};foreach($name in $next.Keys){$restored[$name]=$next[$name]};$restored.managementMaximum=1024;$restored.managementAttempts=524;$restored.controlAttempts=841;$restored.combinedAttempts=1365;$restored.sourceCommitSha='5087d4d93d2f6ffdca0bc0096b365723005446fc';$restored.windowId='4c602549-2c42-4ec3-9328-714d7cb66a77'
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$restored) $true 'CheckOnly') -ne 1024){throw 'RESTORED_1024_CHARGES_NOT_PROJECTED'}
foreach($mutation in @(@{key='managementMaximum';value=832},@{key='managementMaximum';value=1025},@{key='managementMaximum';value='1024'},@{key='managementAttempts';value=523},@{key='controlAttempts';value=840},@{key='combinedAttempts';value=1364},@{key='sourceCommitSha';value=$next.sourceCommitSha},@{key='windowId';value=$next.windowId},@{key='privateRead';value=$true},@{key='networkRequests';value=1})){
 $mixed=[ordered]@{};foreach($name in $restored.Keys){$mixed[$name]=$restored[$name]};$mixed[$mutation.key]=$mutation.value;$denied=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$mixed) $true 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'MIXED_RESTORED_1024_PROFILE_ACCEPTED'}
}
foreach($missing in @('managementMaximum','managementAttempts','controlAttempts','combinedAttempts')){
 $mixed=[ordered]@{};foreach($name in $restored.Keys){if($name -cne $missing){$mixed[$name]=$restored[$name]}};$denied=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$mixed) $true 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'PARTIAL_RESTORED_PROFILE_ACCEPTED'}
}
foreach($mode in @('Admit','Read')){$denied=$false;try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$restored) $true $mode}catch{$denied=$true};if(-not $denied){throw 'RESTORED_WRONG_MODE_ACCEPTED'}}
$denied=$false;try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$restored) $false 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'RESTORED_WRONG_PROFILE_ACCEPTED'}
foreach($mutation in @(@{key='managementMaximum';value=704},@{key='managementMaximum';value=833},@{key='managementMaximum';value='832'},@{key='managementAttempts';value=400},@{key='controlAttempts';value=739},@{key='combinedAttempts';value=1140},@{key='sourceCommitSha';value=$fresh.sourceCommitSha},@{key='windowId';value=$fresh.windowId})){
 $mixed=[ordered]@{};foreach($name in $next.Keys){$mixed[$name]=$next[$name]};$mixed[$mutation.key]=$mutation.value;$denied=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$mixed) $true 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'MIXED_NEXT_832_PROFILE_ACCEPTED'}
}
foreach($mutation in @(@{key='managementAttempts';value=288},@{key='controlAttempts';value=588},@{key='combinedAttempts';value=876})){
 $mixed=[ordered]@{};foreach($name in $admission.Keys){$mixed[$name]=$admission[$name]};$mixed[$mutation.key]=$mutation.value;$denied=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$mixed) $true 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'NO_ADMIN_CHARGES_RESET'}
}
foreach($mutation in @(@{key='managementMaximum';value=640},@{key='managementMaximum';value=705},@{key='managementAttempts';value=263},@{key='controlAttempts';value=537},@{key='combinedAttempts';value=800},@{key='sourceCommitSha';value=$valid.sourceCommitSha},@{key='windowId';value=$valid.windowId})){
 $mixed=[ordered]@{};foreach($name in $catalog.Keys){$mixed[$name]=$catalog[$name]};$mixed[$mutation.key]=$mutation.value;$denied=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$mixed) $true 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'MIXED_704_PROFILE_ACCEPTED'}
}
foreach($mutation in @(@{key='managementAttempts';value=262},@{key='managementAttempts';value=237},@{key='controlAttempts';value=486},@{key='combinedAttempts';value=799},@{key='combinedAttempts';value=723})){
 $mixed=[ordered]@{};foreach($name in $latest.Keys){$mixed[$name]=$latest[$name]};$mixed[$mutation.key]=$mutation.value;$denied=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$mixed) $true 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'PREPRIVATE_CHARGES_RESET'}
}
foreach($mutation in @(@{key='managementMaximum';value=576},@{key='managementAttempts';value=177},@{key='controlAttempts';value=435},@{key='combinedAttempts';value=612},@{key='sourceCommitSha';value=$valid.sourceCommitSha},@{key='windowId';value=$valid.windowId})){
 $mixed=[ordered]@{};foreach($name in $fresh.Keys){$mixed[$name]=$fresh[$name]};$mixed[$mutation.key]=$mutation.value;$denied=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$mixed) $true 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'MIXED_640_PROFILE_ACCEPTED'}
}
foreach($key in @('managementAttempts','controlAttempts','combinedAttempts')){
 $mixed=[ordered]@{};foreach($name in $reconciled.Keys){$mixed[$name]=$reconciled[$name]};$mixed[$key]=$valid[$key];$denied=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$mixed) $true 'CheckOnly'}catch{$denied=$true};if(-not $denied){throw 'MIXED_CHARGES_ACCEPTED'}
}
$legacy=[ordered]@{};foreach($name in $valid.Keys){if($name -cnotin @('managementMaximum','managementAttempts','controlAttempts','combinedAttempts')){$legacy[$name]=$valid[$name]}}
if((Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$legacy) $true 'CheckOnly') -ne 512){throw 'LEGACY_CAP_CHANGED'}
foreach($mutation in @(@{key='managementMaximum';value=512},@{key='managementMaximum';value=577},@{key='managementMaximum';value='576'},@{key='managementAttempts';value=151},@{key='controlAttempts';value=382},@{key='combinedAttempts';value=534},@{key='kind';value='clock_project_verified_continuation_admitted'},@{key='sourceCommitSha';value='f42930f90c2de43c84f61ad6d966d0ee6074d70e'},@{key='privateRead';value=$true},@{key='networkRequests';value=1})){
 $copy=[ordered]@{};foreach($name in $valid.Keys){$copy[$name]=$valid[$name]};$copy[$mutation.key]=$mutation.value;$blocked=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$copy) $true 'CheckOnly'}catch{$blocked=$true};if(-not $blocked){throw 'MANAGEMENT_PROFILE_WEAKENED'}
}
foreach($missing in @('managementMaximum','managementAttempts','controlAttempts','combinedAttempts')){
 $copy=[ordered]@{};foreach($name in $valid.Keys){if($name -cne $missing){$copy[$name]=$valid[$name]}};$blocked=$false
 try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$copy) $true 'CheckOnly'}catch{$blocked=$true};if(-not $blocked){throw 'PARTIAL_PROFILE_ACCEPTED'}
}
foreach($mode in @('Admit','Read')){$blocked=$false;try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$valid) $true $mode}catch{$blocked=$true};if(-not $blocked){throw 'WRONG_MODE_ACCEPTED'}}
$blocked=$false;try{$null=Get-ProjectVerifiedPublicManagementMaximum ([pscustomobject]$valid) $false 'CheckOnly'}catch{$blocked=$true};if(-not $blocked){throw 'WRONG_PROFILE_ACCEPTED'}
Write-Output 'MANAGEMENT_PUBLIC_PROFILE_PASS'
`,
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.equal(result.stderr, '');
      assert.equal(result.stdout.trim(), 'MANAGEMENT_PUBLIC_PROFILE_PASS');
      assert.match(source, /managementMaximum=\$effectiveManagementMaximum;controlMaximum=2048/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'budget readiness projection rejects stale counters and untrusted fields before private initialization',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-budget-readiness-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const start = source.indexOf('function ConvertTo-ProjectVerifiedReadinessBlock(');
      const end = source.indexOf('function Invoke-ClockAmendmentPublic(', start);
      assert.ok(start > 0 && end > start);
      const helper = source.slice(start, end);
      const script = join(directory, 'fixed-projection.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
${helper}
$valid=[ordered]@{kind='project_verified_continuation_blocked';status='setup_cap_insufficient';segmentId='20275b22-b7fe-4737-a9a4-c50c2feadb74';sourceCommitSha='a5e746736893d5040e93032ae740a0878f748837';windowId='38b3708d-61b0-41d2-8170-5ed91c66b4dc';managementAttempts=102;controlAttempts=301;combinedAttempts=403;gatewayPreflightAttempts=2;setupAttempts=44;setupMaximum=50;minimumNewSetupRequests=32;proposedSetupMaximum=88;privateRead=$false;networkRequests=0}
$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$valid)
$management=[ordered]@{};foreach($name in $valid.Keys){$management[$name]=$valid[$name]}
$management.status='management_cap_insufficient';$management.managementAttempts=152;$management.controlAttempts=382;$management.combinedAttempts=534;$management.setupMaximum=88
$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$management)
$catalog=[ordered]@{};foreach($name in $management.Keys){$catalog[$name]=$management[$name]};$catalog.sourceCommitSha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803';$catalog.windowId='eda4fae1-1e19-47db-81b8-beac1a4ed883';$catalog.managementAttempts=288;$catalog.controlAttempts=588;$catalog.combinedAttempts=876;$catalog.setupAttempts=79;$catalog.setupMaximum=132;$catalog.proposedSetupMaximum=132
$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$catalog)
$next=[ordered]@{};foreach($name in $catalog.Keys){$next[$name]=$catalog[$name]};$next.status='setup_cap_insufficient';$next.sourceCommitSha='7b1837201ac7925591577a1517d7288936ca3464';$next.windowId='3c46c791-e140-4eb9-890a-eecfa251f65e';$next.managementAttempts=401;$next.controlAttempts=740;$next.combinedAttempts=1141;$next.gatewayPreflightAttempts=4;$next.setupAttempts=114;$next.setupMaximum=132;$next.proposedSetupMaximum=176
$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$next)
$restored=[ordered]@{};foreach($name in $next.Keys){$restored[$name]=$next[$name]};$restored.sourceCommitSha='5087d4d93d2f6ffdca0bc0096b365723005446fc';$restored.windowId='4c602549-2c42-4ec3-9328-714d7cb66a77';$restored.managementAttempts=524;$restored.controlAttempts=841;$restored.combinedAttempts=1365;$restored.gatewayPreflightAttempts=6;$restored.setupAttempts=149;$restored.setupMaximum=176;$restored.proposedSetupMaximum=224
$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$restored)
foreach($mutation in @(@{key='managementAttempts';value=523},@{key='controlAttempts';value=840},@{key='combinedAttempts';value=1364},@{key='gatewayPreflightAttempts';value=4},@{key='setupAttempts';value=148},@{key='setupMaximum';value=224},@{key='proposedSetupMaximum';value=176},@{key='status';value='management_cap_insufficient'},@{key='sourceCommitSha';value=$next.sourceCommitSha},@{key='windowId';value=$next.windowId},@{key='managementAttempts';value='524'})){
 $copy=[ordered]@{};foreach($name in $restored.Keys){$copy[$name]=$restored[$name]};$copy[$mutation.key]=$mutation.value;$blocked=$false
 try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)}catch{$blocked=$true};if(-not $blocked){throw 'RESTORED_ALLOCATION_OR_BINDING_RESET'}
}
foreach($mutation in @(@{key='managementAttempts';value=400},@{key='controlAttempts';value=739},@{key='combinedAttempts';value=1140},@{key='gatewayPreflightAttempts';value=2},@{key='setupAttempts';value=113},@{key='setupMaximum';value=176},@{key='proposedSetupMaximum';value=132},@{key='status';value='management_cap_insufficient'},@{key='sourceCommitSha';value=$catalog.sourceCommitSha},@{key='windowId';value=$catalog.windowId},@{key='managementAttempts';value='401'})){
 $copy=[ordered]@{};foreach($name in $next.Keys){$copy[$name]=$next[$name]};$copy[$mutation.key]=$mutation.value;$blocked=$false
 try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)}catch{$blocked=$true};if(-not $blocked){throw 'NEXT_ALLOCATION_OR_BINDING_RESET'}
}
foreach($mutation in @(@{key='managementAttempts';value=263},@{key='controlAttempts';value=537},@{key='combinedAttempts';value=800},@{key='status';value='setup_cap_insufficient'},@{key='sourceCommitSha';value=$management.sourceCommitSha},@{key='windowId';value=$management.windowId})){
 $copy=[ordered]@{};foreach($name in $catalog.Keys){$copy[$name]=$catalog[$name]};$copy[$mutation.key]=$mutation.value;$blocked=$false
 try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)}catch{$blocked=$true};if(-not $blocked){throw 'CATALOG_LIMIT_OR_BINDING_RESET'}
}
foreach($diagnosticAttempts in 1..4){
 $copy=[ordered]@{};foreach($name in $management.Keys){$copy[$name]=$management[$name]};$copy.controlAttempts=382+$diagnosticAttempts;$copy.combinedAttempts=534+$diagnosticAttempts
 $null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)
}
foreach($mutation in @(@{key='managementAttempts';value=127},@{key='controlAttempts';value=353},@{key='controlAttempts';value=387},@{key='controlAttempts';value=383},@{key='combinedAttempts';value=480},@{key='setupMaximum';value=512},@{key='status';value='unknown_failure'},@{key='privateRead';value=$true})){
 $copy=[ordered]@{};foreach($name in $management.Keys){$copy[$name]=$management[$name]};$copy[$mutation.key]=$mutation.value;$blocked=$false
 try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)}catch{$blocked=$true};if(-not $blocked){throw 'MANAGEMENT_BOUNDARY_WEAKENED'}
}
$stale=[ordered]@{};foreach($name in $valid.Keys){$stale[$name]=$valid[$name]};$stale.managementAttempts=98;$stale.combinedAttempts=399;$blocked=$false
try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$stale)}catch{$blocked=$true};if(-not $blocked){throw 'HISTORICAL_USAGE_ACCEPTED'}
foreach($key in @('sourceCommitSha','windowId','managementAttempts','setupAttempts','setupMaximum','privateRead','networkRequests')){
 $copy=[ordered]@{};foreach($name in $valid.Keys){$copy[$name]=$valid[$name]};$copy[$key]='SYNTHETIC_PRIVATE_CANARY';$blocked=$false
 try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)}catch{$blocked=$true};if(-not $blocked){throw 'UNTRUSTED_FIELD_ACCEPTED'}
}
$copy=[ordered]@{};foreach($name in $valid.Keys){$copy[$name]=$valid[$name]};$copy['raw']='SYNTHETIC_PRIVATE_CANARY';$blocked=$false
try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)}catch{$blocked=$true};if(-not $blocked){throw 'EXTRA_FIELD_ACCEPTED'}
Write-Output 'FIXED_BUDGET_PROJECTION_PASS'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'FIXED_BUDGET_PROJECTION_PASS');
      const branch = source.indexOf(
        "if($ProjectVerifiedContinuation -and $publicClock.kind -ceq 'project_verified_continuation_blocked')",
      );
      assert.ok(branch > 0 && branch < source.indexOf(' $adminPublicReady=Invoke-PublicDatabaseCheck'));
      assert.ok(branch < source.indexOf(' Confirm-ProjectVerifiedVercelMetadata $node $repo'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'native CheckOnly cap branch returns288/588/876 before any Admin, transport or credential input',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-catalog-cap-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const helper = source.slice(
        source.indexOf('function ConvertTo-ProjectVerifiedReadinessBlock('),
        source.indexOf('function Invoke-ClockAmendmentPublic('),
      );
      const start = source.indexOf(
        " if($ProjectVerifiedContinuation -and $publicClock.kind -ceq 'project_verified_continuation_blocked'){",
      );
      const end = source.indexOf(
        " if($ProjectVerifiedContinuation -and $publicClock.kind -ceq 'project_verified_continuation_approval_required'){",
        start,
      );
      assert.ok(start > 0 && end > start);
      const script = join(directory, 'check.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
${helper}
function Invoke-PublicDatabaseCheck {throw 'UNEXPECTED_ADMIN'}
function Confirm-PublicTransport {throw 'UNEXPECTED_TRANSPORT'}
$ProjectVerifiedContinuation=$true;$CheckOnly=$true
$publicClock=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]@{kind='project_verified_continuation_blocked';status='management_cap_insufficient';segmentId='20275b22-b7fe-4737-a9a4-c50c2feadb74';sourceCommitSha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803';windowId='eda4fae1-1e19-47db-81b8-beac1a4ed883';managementAttempts=288;controlAttempts=588;combinedAttempts=876;gatewayPreflightAttempts=2;setupAttempts=79;setupMaximum=132;minimumNewSetupRequests=32;proposedSetupMaximum=132;privateRead=$false;networkRequests=0})
${source.slice(start, end)}
throw 'CAP_BRANCH_FELL_THROUGH'
`,
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      const value = JSON.parse(result.stdout);
      assert.equal(value.status, 'management_cap_insufficient');
      assert.equal(value.managementAttempts, 288);
      assert.equal(value.controlAttempts, 588);
      assert.equal(value.combinedAttempts, 876);
      assert.equal(value.privateRead, false);
      assert.equal(value.networkRequests, 0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

const writerPackages = {
  pg: [
    '8.23.1',
    'pg@8.23.1',
    ['pg-connection-string', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass', 'pg-cloudflare'],
  ],
  'pg-connection-string': ['2.14.1', 'pg-connection-string@2.14.1', []],
  'pg-pool': ['3.14.0', 'pg-pool@3.14.0_pg@8.23.1', ['pg']],
  'pg-protocol': ['1.16.1', 'pg-protocol@1.16.1', []],
  'pg-types': [
    '2.2.0',
    'pg-types@2.2.0',
    ['pg-int8', 'postgres-array', 'postgres-bytea', 'postgres-date', 'postgres-interval'],
  ],
  pgpass: ['1.0.5', 'pgpass@1.0.5', ['split2']],
  'pg-cloudflare': ['1.4.1', 'pg-cloudflare@1.4.1', []],
  'pg-int8': ['1.0.1', 'pg-int8@1.0.1', []],
  'postgres-array': ['2.0.0', 'postgres-array@2.0.0', []],
  'postgres-bytea': ['1.0.1', 'postgres-bytea@1.0.1', []],
  'postgres-date': ['1.0.7', 'postgres-date@1.0.7', []],
  'postgres-interval': ['1.2.0', 'postgres-interval@1.2.0', ['xtend']],
  xtend: ['4.0.2', 'xtend@4.0.2', []],
  split2: ['4.2.0', 'split2@4.2.0', []],
};

test(
  'the public closure seals the forward packet and actual approved management recovery evidence',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-forward-closure-'));
    try {
      const script = join(directory, 'closure.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
. '${resolve('scripts/n8n/windows/Acceptance-PublicRuntime.ps1').replaceAll("'", "''")}'
$paths=@(Get-M03AcceptancePublicFiles '${resolve('.').replaceAll("'", "''")}')
if($paths -cnotcontains 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical9-reconciliation-20261024.json'){throw 'TECHNICAL9_SOURCE_NOT_SEALED'}
foreach($required in @('scripts/db/m03-foundation-forward-dev-migration-packet.json','scripts/db/foundation-forward-postcheck.sql','supabase/migrations/20261023163755_m03_foundation_window_continuation.sql','milestones/M03-n8n-foundation/evidence/remaining-management-allocation-20261024.md','milestones/M03-n8n-foundation/evidence/remaining-management-allocation-approval-20261024.json','milestones/M03-n8n-foundation/evidence/dev-acceptance-technical6-reconciliation-20261024.json','milestones/M03-n8n-foundation/evidence/dev-acceptance-wf70-readback-20261024.json','milestones/M03-n8n-foundation/evidence/dev-acceptance-technical8-reconciliation-20261024.json','milestones/M03-n8n-foundation/evidence/dev-acceptance-technical10-reconciliation-20261024.json','milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-20261024.md','milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-approval-20261024.json')){if($paths -cnotcontains $required){throw 'FORWARD_SOURCE_NOT_SEALED'}}
Write-Output 'FORWARD_CLOSURE_PASS'
`,
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
      });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.equal(result.stderr, '');
      assert.equal(result.stdout.trim(), 'FORWARD_CLOSURE_PASS');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
function writerClosureFixture(directory) {
  const root = join(directory, 'fixture');
  const physical = (name) => join(root, 'node_modules/.pnpm', writerPackages[name][1], 'node_modules', name);
  for (const [name, [, folder]] of Object.entries(writerPackages)) {
    const from = resolve('node_modules/.pnpm', folder, 'node_modules', name);
    cpSync(from, physical(name), { recursive: true });
  }
  for (const [name, [, , deps]] of Object.entries(writerPackages))
    for (const dep of deps) symlinkSync(physical(dep), join(physical(name), '..', dep), 'junction');
  mkdirSync(join(root, 'apps/web/node_modules'), { recursive: true });
  symlinkSync(physical('pg'), join(root, 'apps/web/node_modules/pg'), 'junction');
  const module = join(directory, 'Acceptance-PublicRuntime.ps1');
  cpSync(resolve('scripts/n8n/windows/Acceptance-PublicRuntime.ps1'), module);
  return { root, module, physical };
}

test(
  'public Writer closure enumerates installed executable/manifests without Node or credential access',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-writer-public-'));
    try {
      const f = writerClosureFixture(directory);
      const script = join(directory, 'public.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. '${f.module.replaceAll("'", "''")}'
$paths=@(Get-M03AcceptancePgPublicFiles '${f.root.replaceAll("'", "''")}')
if($paths.Count -lt 50 -or $paths -cnotcontains 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/client.js' -or $paths -cnotcontains 'node_modules/.pnpm/pg-cloudflare@1.4.1/node_modules/pg-cloudflare/package.json'){exit 1}
Write-Output 'PG_PUBLIC_ENUMERATION_PASS'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
      });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'PG_PUBLIC_ENUMERATION_PASS');
      const source = readFileSync(f.module, 'utf8');
      assert.match(source, /'scripts\/n8n\/gw01-writer\.mjs'/);
      assert.match(source, /'apps\/web\/package\.json'/);
      assert.match(source, /'scripts\/seed\/certs\/supabase-root-2021\.crt'/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'public Writer closure refuses retargeted resolution and changed executable bytes before private use',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-writer-public-deny-'));
    try {
      const f = writerClosureFixture(directory);
      const script = join(directory, 'public-deny.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. '${f.module.replaceAll("'", "''")}'
$root='${f.root.replaceAll("'", "''")}'
$paths=@(Get-M03AcceptancePgPublicFiles $root);$files=[ordered]@{}
foreach($path in $paths){$files[$path]=(Get-FileHash -LiteralPath (Join-Path $root $path) -Algorithm SHA256).Hash.ToLowerInvariant()}
function Get-M03AcceptancePublicFiles($Root){return Get-M03AcceptancePgPublicFiles $Root}
function Import-M03AcceptanceFoundationPublicModule { return '${join(directory, 'tail.ps1').replaceAll("'", "''")}' }
[IO.File]::WriteAllText('${join(directory, 'tail.ps1').replaceAll("'", "''")}', 'function Assert-M03FoundationPublicRuntimeSeal { return "synthetic-node" }; function Assert-M03AcceptanceVercelClosure {}')
$seal=[PSCustomObject]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';approvedHead='f42930f90c2de43c84f61ad6d966d0ee6074d70e';approvedPacketSha256='009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712';files=[PSCustomObject]$files;base=[PSCustomObject]@{node=[PSCustomObject]@{path='synthetic-node'}};vercel=[PSCustomObject]@{}}
$null=Assert-M03AcceptancePublicSeal $root $seal
$code=Join-Path $root 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/client.js'
$original=[IO.File]::ReadAllText($code);[IO.File]::WriteAllText($code,$original+'// public synthetic drift')
try{$null=Assert-M03AcceptancePublicSeal $root $seal;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
[IO.File]::WriteAllText($code,$original)
$link=Join-Path $root 'apps/web/node_modules/pg';[IO.Directory]::Delete($link)
$null=New-Item -ItemType Junction -Path $link -Target (Join-Path $root 'node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types')
try{$null=Get-M03AcceptancePgPublicFiles $root;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
Write-Output 'PG_PUBLIC_DRIFT_REFUSED'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000,
      });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'PG_PUBLIC_DRIFT_REFUSED');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'public Writer closure rejects transitive/native/shadow resolution and omits unresolvable optional code',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-writer-transitive-deny-'));
    try {
      const f = writerClosureFixture(directory);
      const script = join(directory, 'transitive-deny.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. '${f.module.replaceAll("'", "''")}'
$root='${f.root.replaceAll("'", "''")}'
$before=@(Get-M03AcceptancePgPublicFiles $root)
$modules=Join-Path $root 'node_modules/.pnpm/pg-types@2.2.0/node_modules'
$link=Join-Path $modules 'postgres-array';[IO.Directory]::Delete($link)
$null=New-Item -ItemType Junction -Path $link -Target (Join-Path $root 'node_modules/.pnpm/postgres-bytea@1.0.1/node_modules/postgres-bytea')
try{$null=Get-M03AcceptancePgPublicFiles $root;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
[IO.Directory]::Delete($link);$null=New-Item -ItemType Junction -Path $link -Target (Join-Path $root 'node_modules/.pnpm/postgres-array@2.0.0/node_modules/postgres-array')
$native=Join-Path $root 'node_modules/pg-native';$null=New-Item -ItemType Directory -Path $native
try{$null=Get-M03AcceptancePgPublicFiles $root;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
[IO.Directory]::Delete($native)
$shadow=Join-Path $root 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/node_modules';$null=New-Item -ItemType Directory -Path $shadow
try{$null=Get-M03AcceptancePgPublicFiles $root;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
[IO.Directory]::Delete($shadow)
[IO.Directory]::Delete((Join-Path $root 'node_modules/.pnpm/pg@8.23.1/node_modules/pg-cloudflare'))
$withoutOptional=@(Get-M03AcceptancePgPublicFiles $root)
if($withoutOptional.Count -ge $before.Count -or @($withoutOptional|Where-Object {$_ -like '*/pg-cloudflare/*'}).Count -ne 0){exit 1}
Write-Output 'PG_TRANSITIVE_RESOLUTION_PASS'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000,
      });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'PG_TRANSITIVE_RESOLUTION_PASS');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('public helper syntax is parsed without running a private consumer', windowsOnly, () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-syntax-'));
  try {
    const script = join(directory, 'syntax.ps1');
    const paths = names
      .map((name) => "'" + resolve('scripts/n8n/windows', name).replaceAll("'", "''") + "'")
      .join(',');
    writeFileSync(
      script,
      `$ErrorActionPreference='Stop'
foreach($path in @(${paths})){
 $tokens=$null;$errors=$null
 $null=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
 if($errors.Count -ne 0){Write-Output 'PUBLIC_SYNTAX_FAILED';exit 1}
}
Write-Output 'PUBLIC_SYNTAX_PASS: 4'
`,
    );
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
      env: safeEnvironment(directory),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000,
    });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '');
    assert.equal(r.stdout.trim(), 'PUBLIC_SYNTAX_PASS: 4');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test(
  'missing public seal refuses before any private read and preserves synthetic handoffs',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-source-guard-'));
    try {
      const scripts = join(directory, 'scripts', 'n8n', 'windows');
      mkdirSync(scripts, { recursive: true });
      mkdirSync(join(directory, 'Temp'));
      const script = join(scripts, 'Invoke-M03Acceptance.ps1');
      writeFileSync(script, readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1')));
      const canaryPath = join(directory, 'Temp', 'emr-m03-acceptance-management.dpapi');
      const canary = 'synthetic-not-a-real-ciphertext';
      writeFileSync(canaryPath, canary);
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(r.status, 1);
      assert.equal(r.stderr, '');
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.code, 'M03_ACCEPTANCE_BLOCKED');
      assert.equal(receipt.privateRead, false);
      assert.equal(receipt.childClosed, true);
      assert.equal(readFileSync(canaryPath, 'utf8'), canary);
      assert.doesNotMatch(r.stdout, /synthetic-not-a-real-ciphertext/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('private wrapper does not auto-build seals, reveal child stderr or set password arguments', () => {
  const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
  assert.match(source, /Assert-M03AcceptancePublicSeal/);
  assert.match(source, /EnvironmentVariables\.Clear\(\)/);
  assert.match(source, /StandardInput\.WriteLine\(\(\$packet/);
  assert.match(source, /SecureStringToBSTR/);
  assert.match(source, /ZeroFreeBSTR/);
  assert.doesNotMatch(source, /New-M03AcceptancePublicSeal|New-M03FoundationPublicRuntimeSeal/);
  assert.doesNotMatch(
    source,
    /Write-(Output|Host|Error).*\$(private|packet|cipher|bypass|machine|errorTask)/,
  );
  assert.doesNotMatch(source, /Arguments\s*=.*\$(private|packet|cipher|bypass|machine)/);
});

test(
  'private output projection refuses actual secret reflections and unknown workflow IDs',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-output-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const start = source.indexOf('function Safe-PublicLine');
      const end = source.indexOf('\ntry{', start);
      assert.ok(start > 0 && end > start);
      const cases = [
        { kind: 'm03_acceptance_result', id: 'local1', status: 'blocked', residual: true },
        { kind: 'm03_acceptance_result', id: 'sql1', status: 'sql_acceptance_unresolved', residual: true },
        { kind: 'm03_acceptance_result', id: 'PrivateKeyAlpha47', status: 'blocked' },
        { kind: 'mcp_port_request', nonce: 'fixtureNonce', action: 'details', workflowId: 'FixtureWFID' },
        { kind: 'mcp_port_request', nonce: 'fixtureNonce', action: 'details', workflowId: 'OtherWorkflow' },
        {
          kind: 'mcp_port_request',
          nonce: 'PrivateKeyAlpha47',
          action: 'details',
          workflowId: 'FixtureWFID',
        },
        { kind: 'm03_acceptance_result', status: 'blocked', rawError: 'PrivateKeyAlpha47' },
        { kind: 'm03_acceptance_result', status: 'blocked', residual: 'false' },
        { kind: 'm03_acceptance_result', status: 'blocked', executionIds: ['123456'] },
        { kind: 'm03_acceptance_result', status: 'sql_acceptance_unresolved', residual: true },
        {
          kind: 'm03_acceptance_result',
          status: 'blocked',
          baselineWorkflowKey: 'WF-00',
          baselineFailureCodes: ['version_mismatch'],
          baselineNameEqual: true,
          baselineNodesEqual: true,
          baselineConnectionsEqual: true,
          baselineSettingsEqual: true,
        },
        { kind: 'm03_acceptance_result', status: 'blocked', baselineFailureCodes: ['PrivateKeyAlpha47'] },
        { kind: 'm03_acceptance_result', status: 'blocked', baselineWorkflowKey: 'Foreign' },
        { kind: 'm03_acceptance_result', status: 'blocked', baselineNameEqual: 'true' },
        {
          kind: 'm03_acceptance_result',
          status: 'prepared',
          approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
        },
        {
          kind: 'm03_acceptance_result',
          status: 'prepared',
          approvedHead: 'a5e746736893d5040e93032ae740a0878f748837',
          sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
        },
        {
          kind: 'm03_acceptance_result',
          status: 'prepared',
          approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          sourceCommitSha: 'c'.repeat(40),
        },
        {
          kind: 'mcp_port_request',
          nonce: 'fixtureNonce',
          action: 'discover',
          workflowId: 'MzimjpsuyPuK7SKe',
        },
        { kind: 'mcp_port_request', nonce: 'fixtureNonce', action: 'discover', workflowId: 'FixtureWFID' },
        {
          kind: 'mcp_port_request',
          nonce: 'fixtureNonce',
          action: 'browser_discover',
          workflowId: 'MzimjpsuyPuK7SKe',
        },
        {
          kind: 'mcp_port_request',
          nonce: 'fixtureNonce',
          action: 'browser_discover',
          workflowId: 'FixtureWFID',
        },
        {
          kind: 'mcp_port_request',
          nonce: 'fixtureNonce',
          action: 'browser_details',
          workflowId: 'FixtureWFID',
        },
        {
          kind: 'mcp_port_request',
          nonce: 'fixtureNonce',
          action: 'browser_start',
          workflowId: 'FixtureWFID',
        },
        {
          kind: 'mcp_port_request',
          nonce: 'fixtureNonce',
          action: 'browser_start',
          workflowId: 'OtherWorkflow',
        },
        { kind: 'mcp_port_request', nonce: 'fixtureNonce', action: 'browser_run', workflowId: 'FixtureWFID' },
        {
          kind: 'm03_acceptance_result',
          status: 'blocked',
          code: 'FOUNDATION_NATIVE_DISCOVERY',
          nativeReaderWorkflowKey: 'WF-70',
          nativeReaderStage: 'http_status',
          nativeReaderHttpStatus: 429,
        },
        { kind: 'm03_acceptance_result', status: 'blocked', nativeReaderWorkflowKey: 'Foreign' },
        { kind: 'm03_acceptance_result', status: 'blocked', nativeReaderStage: 'PrivateKeyAlpha47' },
        { kind: 'm03_acceptance_result', status: 'blocked', nativeReaderHttpStatus: 600 },
        {
          kind: 'm03_acceptance_ready',
          status: 'private_child_ready',
          approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          sourceCommitSha: 'aff94f2b2d8055cf93b5405e6b11d4e7d9c86803',
          deadlineAt: Date.now() + 3600000,
        },
        {
          kind: 'm03_acceptance_ready',
          status: 'private_child_ready',
          approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          sourceCommitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
          deadlineAt: Date.now() + 3600000,
        },
        {
          kind: 'm03_acceptance_ready',
          status: 'private_child_ready',
          approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          sourceCommitSha: 'c'.repeat(40),
          deadlineAt: Date.now() + 3600000,
        },
      ];
      const script = join(directory, 'projection.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$script:closureVerified=$false
$needles=[Collections.Generic.List[string]]::new();$needles.Add('PrivateKeyAlpha47');$needles.Add('123456')
$knownWorkflowIds=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);$null=$knownWorkflowIds.Add('FixtureWFID')
$null=$knownWorkflowIds.Add('MzimjpsuyPuK7SKe')
${source.slice(start, end)}
$cases=ConvertFrom-Json -InputObject '${JSON.stringify(cases).replaceAll("'", "''")}'
$out=@();foreach($value in $cases){try{$null=Safe-PublicLine $value;$out+='accepted'}catch{$out+='rejected'}}
$out|ConvertTo-Json -Compress
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), [
        'accepted',
        'accepted',
        'rejected',
        'accepted',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
        'accepted',
        'accepted',
        'rejected',
        'rejected',
        'rejected',
        'accepted',
        'rejected',
        'rejected',
        'accepted',
        'rejected',
        'accepted',
        'rejected',
        'accepted',
        'accepted',
        'rejected',
        'rejected',
        'accepted',
        'rejected',
        'rejected',
        'rejected',
        'accepted',
        'accepted',
        'rejected',
      ]);
      assert.doesNotMatch(r.stdout, /PrivateKeyAlpha47/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'public protocol IO refuses oversized lines and text before appending beyond its cap',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-io-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const start = source.indexOf('function Initialize-BoundedIo');
      const end = source.indexOf('function Invoke-PublicCompositionCheck', start);
      const script = join(directory, 'io.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
${source.slice(start, end)}
Initialize-BoundedIo
$out=@()
$r=[IO.StringReader]::new("safe\nnext")
if([EmrM03AcceptanceBoundedIo]::Line($r,4).GetAwaiter().GetResult() -cne 'safe'){exit 1}
if([EmrM03AcceptanceBoundedIo]::Line($r,4).GetAwaiter().GetResult() -cne 'next'){exit 1}
$r.Dispose();$out+='bounded_line_pass'
try{$r=[IO.StringReader]::new('oversize');$null=[EmrM03AcceptanceBoundedIo]::Line($r,4).GetAwaiter().GetResult();exit 1}catch{$out+='line_refused'}finally{$r.Dispose()}
try{$r=[IO.StringReader]::new('oversize');$null=[EmrM03AcceptanceBoundedIo]::Text($r,4).GetAwaiter().GetResult();exit 1}catch{$out+='text_refused'}finally{$r.Dispose()}
$out|ConvertTo-Json -Compress
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), ['bounded_line_pass', 'line_refused', 'text_refused']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'native wrapper forwards a complete long ASCII browser ACK through its actual console reader and pump',
  windowsOnly,
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-browser-relay-'));
    let child,
      childClosed = true;
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const io = source.slice(
        source.indexOf('function Initialize-BoundedIo'),
        source.indexOf('function Invoke-PublicCompositionCheck'),
      );
      // The .NET Framework console defaults to254 payload characters. The actual
      // ConPTY RED/GREEN reproduction accompanies this piped native regression;
      // this assertion retains the process-local larger-buffer remedy, not a
      // reduced browser schema or a global console/security mode change.
      assert.match(io, /OpenStandardInput\(262144\)/);
      const projection = source.slice(
        source.indexOf('function Safe-PublicLine'),
        source.indexOf('\ntry{', source.indexOf('function Safe-PublicLine')),
      );
      const pumpStart = source.indexOf(
        ' $lineTask=[EmrM03AcceptanceBoundedIo]::Line($child.StandardOutput,65536);',
      );
      const pump = source.slice(pumpStart, source.indexOf(' $closed=$child.WaitForExit(0);', pumpStart));
      assert.ok(pumpStart > 0 && pump.includes('$child.StandardInput.WriteLine($inputLine)'));
      const childPath = join(directory, 'child.mjs');
      writeFileSync(
        childPath,
        `import {createInterface} from 'node:readline';
import {readFileSync} from 'node:fs';
import {createFoundationLiveMcpBridge} from ${JSON.stringify(pathToFileURL(resolve('scripts/n8n/foundation-live-runtime-mcp.mjs')).href)};
const bindings=JSON.parse(readFileSync(${JSON.stringify(resolve('n8n/foundation/bindings.dev.json'))},'utf8'));
const emit=value=>{process.stdout.write(JSON.stringify(value)+'\\n');};
const bridge=createFoundationLiveMcpBridge({bindings,executionSource:'browser_ui',deadlineAt:Date.now()+10000,emit},{timeoutMs:5000});
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
const done=ok=>{emit({kind:'m03_acceptance_result',status:ok?'prepared':'blocked',residual:!ok});bridge.close();lines.close();process.stdin.pause();process.exitCode=ok?0:1;};
lines.on('line',line=>{let value;try{value=JSON.parse(line);}catch{done(false);return;}
if(value.kind==='m03_acceptance_command'&&value.command==='prepare')bridge.port.discover({workflowId:bindings.workflowRefs['WF-00'].id}).then(()=>done(true),()=>done(false));
else if(value.kind==='mcp_port_result'&&!bridge.accept(value))done(false);
});
`,
      );
      const quote = (value) => value.replaceAll("'", "''");
      const script = join(directory, 'relay.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$needles=[Collections.Generic.List[string]]::new();$knownWorkflowIds=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);$null=$knownWorkflowIds.Add('MzimjpsuyPuK7SKe')
$script:closureVerified=$true;$child=$null;$closed=$false;$closeRequested=$false;$lineTask=$null;$inputTask=$null;$errorTask=$null;$admittedClockMode=$false;$ResumeZeroSetup=$false
${io}
${projection}
Initialize-BoundedIo
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName='${quote(process.execPath)}';$info.Arguments='"${quote(childPath)}"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
$info.EnvironmentVariables.Clear();foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
try{
$child=[Diagnostics.Process]::new();$child.StartInfo=$info;if(-not $child.Start()){throw 'blocked'};$childDeadline=[DateTimeOffset]::UtcNow.AddSeconds(10)
${pump}
if(-not $child.HasExited){throw 'blocked'}
while($null -ne $lineTask){if(-not $lineTask.Wait(2000)){throw 'blocked'};$line=$lineTask.Result;if($null -eq $line){$lineTask=$null;break};Write-Output (Safe-PublicLine (ConvertFrom-Json -InputObject $line));$lineTask=[EmrM03AcceptanceBoundedIo]::Line($child.StandardOutput,65536)}
if($child.ExitCode -ne 0){throw 'blocked'};Write-Output 'SYNTHETIC_RELAY_PASS'
}catch{Write-Output 'SYNTHETIC_RELAY_BLOCKED';exit 1}finally{if($null -ne $child){if(-not $child.HasExited){$child.Kill();$null=$child.WaitForExit(2000)};$child.Dispose()};$info.EnvironmentVariables.Clear()}
`,
      );
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        windowsHide: true,
      });
      childClosed = false;
      child.once('close', () => {
        childClosed = true;
      });
      let buffer = '',
        stderrBytes = 0,
        requests = 0,
        prepared = false,
        passed = false,
        outputBytes = 0,
        failed = false;
      child.stderr.on('data', (bytes) => {
        stderrBytes += bytes.length;
      });
      child.stdout.on('data', (bytes) => {
        outputBytes += bytes.length;
        if (outputBytes > 16384) {
          failed = true;
          child.kill();
          return;
        }
        buffer += bytes.toString('utf8');
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          if (line === 'SYNTHETIC_RELAY_PASS') {
            passed = true;
            continue;
          }
          let value;
          try {
            value = JSON.parse(line);
          } catch {
            failed = true;
            continue;
          }
          if (value.kind === 'mcp_port_request') {
            requests++;
            if (
              requests !== 1 ||
              value.action !== 'browser_discover' ||
              value.workflowId !== 'MzimjpsuyPuK7SKe'
            ) {
              failed = true;
              child.kill();
              return;
            }
            const ack = {
              kind: 'mcp_port_result',
              nonce: value.nonce,
              action: value.action,
              workflowId: value.workflowId,
              result: {
                source: 'browser_ui',
                id: value.workflowId,
                renderedName: 'WF-00 · Orchestrator [dev]',
                workflowUrl: 'https://muhhammedsayed.app.n8n.cloud/workflow/' + value.workflowId,
                executeControlEnabled: true,
              },
            };
            const ascii = JSON.stringify(ack).replace(
              /[^\x00-\x7f]/g,
              (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
            );
            if (ascii.length <= 254) {
              failed = true;
              child.kill();
              return;
            }
            child.stdin.write(ascii + '\n');
          } else if (value.kind === 'm03_acceptance_result') {
            prepared = value.status === 'prepared' && value.residual === false;
            child.stdin.end();
          } else failed = true;
        }
      });
      child.stdin.write(
        JSON.stringify({ kind: 'm03_acceptance_command', id: 'synthetic_prepare', command: 'prepare' }) +
          '\n',
      );
      const exit = await new Promise((resolveExit) => {
        const timer = setTimeout(() => child.kill(), 15000);
        child.on('close', (code) => {
          clearTimeout(timer);
          resolveExit(code);
        });
      });
      assert.equal(exit, 0);
      assert.equal(stderrBytes, 0);
      assert.equal(requests, 1);
      assert.equal(prepared, true);
      assert.equal(passed, true);
      assert.equal(failed, false);
    } finally {
      if (child && !childClosed) {
        child.kill();
        await new Promise((resolveClose) => {
          const timer = setTimeout(resolveClose, 2000);
          child.once('close', () => {
            clearTimeout(timer);
            resolveClose();
          });
        });
      }
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
