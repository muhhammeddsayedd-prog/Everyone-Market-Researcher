import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { test } from 'node:test';

const executable = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const consumer = 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1';
const control = 'scripts/db/windows/Foundation-AdminControl.ps1';
const wrapper = 'scripts/n8n/windows/Invoke-M03Acceptance.ps1';
const segment = '1c69c89e-7807-46d5-b7b8-ca28285ff2b4';
const previous = 'e8035391-dba8-48c9-97e0-139ba980d86e';
const source = (file) => readFileSync(file, 'utf8');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const environment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );
function powershell(code, expectedStatus = 0) {
  const script = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest;$ProjectVerifiedContinuation=$false\n${code}\nexit 0\n`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const temporary = encoded.length > 28000 ? mkdtempSync(join(tmpdir(), 'emr-startup-extracted-ps-')) : null;
  try {
    const file = temporary && join(temporary, 'synthetic-functions.ps1');
    if (file) writeFileSync(file, script);
    const result = spawnSync(
      executable,
      ['-NoProfile', '-NonInteractive', ...(file ? ['-File', file] : ['-EncodedCommand', encoded])],
      { env: environment(), windowsHide: true, encoding: 'utf8', timeout: 15000 },
    );
    assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
    assert.equal(result.stderr, '');
    return result.stdout.trim();
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}
const definitions = (names, file = consumer) => `
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(resolve(file))},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'SOURCE_PARSE_FAILED'}
foreach($name in @(${names.map(quote).join(',')})){
 $found=@($ast.FindAll({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true))
 if($found.Count -ne 1){throw 'EXPECTED_FUNCTION_MISSING'};Invoke-Expression $found[0].Extent.Text
}`;
const clockContext = `
$repo='C:\\__emr_synthetic_never_accessed';$PhaseAControl=$true;$OriginalDeadlineAtMs=0;$ClockAmendment=$false;$PostcheckContinuation=$true;$RemainingContinuation=$false;$StartupReplacement=$true;$postcheckContinuationSegment='${segment}';$postcheckContinuationStart=$null;$node='synthetic-never-spawned.exe'
function Assert-Path($Root,$Relative){$script:module=$Relative;return Join-Path $Root $Relative}
`;
const readyDto = `([ordered]@{kind='startup_replacement_ready';segmentId='${segment}';sourceCommitSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';privateRead=$false;networkRequests=0})`;

test(
  'startup replacement has separate PowerShell parameters, public guard and output custody',
  { skip: process.platform !== 'win32' },
  () => {
    for (const file of [consumer, wrapper, 'scripts/db/windows/New-M03FoundationMigrationHandoff.ps1']) {
      assert.match(source(file), /\[switch\]\$StartupReplacement/);
    }
    assert.match(source(consumer), /foundation-live-startup-replacement\.mjs/);
    assert.match(source(consumer), /m03-foundation-startup-replacement-/);
    assert.match(source(consumer), new RegExp(segment));
    for (const file of [
      consumer,
      control,
      wrapper,
      'scripts/db/windows/New-M03FoundationMigrationHandoff.ps1',
    ]) {
      powershell(
        `$errors=$null;$tokens=$null;$null=[Management.Automation.Language.Parser]::ParseFile(${quote(resolve(file))},[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'SOURCE_PARSE_FAILED'}`,
      );
    }
  },
);

test(
  'startup public adapter accepts only exact new ready and claimed clocks and preserves the75 minute lease',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation', 'Get-FoundationLeaseFloor'])}
${clockContext}
$script:fault='';$script:calledMode='';$admittedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-1000
function Invoke-Bounded($Executable,$Arguments,$WorkingDirectory,$Timeout){
 $script:calledMode=$Arguments[1];$value=${readyDto}
 if($Arguments[1] -ceq 'ReadClaimed'){$value.kind='clock_startup_replacement_admitted';$value.startsAt=$admittedAt;$value.deadlineAt=$admittedAt+3600000;$value.stopNewAt=$admittedAt+3000000;$value.hardDeadlineAt=$admittedAt+4200000}
 switch($script:fault){'old-kind'{$value.kind='remaining_continuation_ready'};'old-segment'{$value.segmentId='${previous}'};'string-bool'{$value.privateRead='false'};'private-read'{$value.privateRead=$true};'network'{$value.networkRequests=1};'extra'{$value.extra=$true};'shift'{$value.deadlineAt++}}
 return [pscustomobject]@{ok=$true;closed=($script:fault -cne 'unclosed');text=($value|ConvertTo-Json -Compress)}
}
$CheckOnly=$true
if($null -ne (Read-FoundationPostcheckContinuation) -or $script:calledMode -cne 'CheckOnly' -or $script:module -cne 'scripts/n8n/foundation-live-startup-replacement.mjs'){throw 'NEW_READY_NOT_SELECTED'}
foreach($fault in @('old-kind','old-segment','string-bool','private-read','network','extra','unclosed')){$script:fault=$fault;$blocked=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$blocked=$true};if(-not $blocked){throw 'PUBLIC_CLOCK_SPOOF_ACCEPTED'}}
$script:fault='';$CheckOnly=$false;$proof=Read-FoundationPostcheckContinuation
if($script:calledMode -cne 'ReadClaimed' -or $proof.kind -cne 'clock_startup_replacement_admitted' -or $proof.startsAt -ne $admittedAt){throw 'NEW_CLAIMED_CLOCK_NOT_SELECTED'}
$postcheckContinuationStart=[DateTimeOffset]::FromUnixTimeMilliseconds($proof.startsAt).UtcDateTime
if((Get-FoundationLeaseFloor) -ne $postcheckContinuationStart.AddMinutes(75)){throw 'LEASE_FLOOR_CHANGED'}
$script:fault='shift';$blocked=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$blocked=$true};if(-not $blocked){throw 'SHIFTED_CLOCK_ACCEPTED'}
`);
  },
);

test(
  'startup approval missing exits3 before any later private metadata path',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(
      `
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation'])}
${clockContext}
$CheckOnly=$true
function Invoke-Bounded {
 $value=${readyDto};$value.kind='startup_replacement_approval_required';$value.status='approval_required';$value.approvalRequired=$true
 return [pscustomobject]@{ok=$true;closed=$true;text=($value|ConvertTo-Json -Compress)}
}
$null=Read-FoundationPostcheckContinuation
Write-Output 'PRIVATE_METADATA_PATH_REACHED';exit 99
`,
      3,
    );
    assert.match(output, /^M03_FOUNDATION APPROVAL_REQUIRED\./);
    assert.doesNotMatch(output, /PRIVATE_METADATA_PATH_REACHED/);
  },
);

test(
  'startup wrapper stops at the public missing-approval branch before the database or private metadata helper',
  { skip: process.platform !== 'win32' },
  () => {
    const value = source(wrapper);
    const start = value.indexOf(' $remainingAuthorityReady=$true');
    const end = value.indexOf(' $bindings=ConvertFrom-Json', start);
    assert.ok(start > 0 && end > start, 'public wrapper approval gate missing');
    const output = powershell(`
$ResumeZeroSetup=$false;$ClockAmendment=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$true;$CheckOnly=$true;$admittedClockMode=$true;$node='synthetic-never-spawned.exe';$repo='C:\\__emr_synthetic_never_accessed';$resumeDeadlineAt=$null;$seal=[pscustomobject]@{windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'}
function Invoke-ClockAmendmentPublic {return [pscustomobject]@{kind='startup_replacement_approval_required'}}
function Invoke-PublicDatabaseCheck {Write-Output 'PRIVATE_DATABASE_METADATA_HELPER_REACHED';throw 'PRIVATE_DATABASE_METADATA_HELPER_REACHED'}
${value.slice(start, end)}
throw 'PUBLIC_APPROVAL_GATE_DID_NOT_EXIT'
`);
    const dto = JSON.parse(output);
    assert.equal(dto.status, 'startup_replacement_approval_required');
    assert.equal(dto.segmentId, segment);
    assert.equal(dto.approvalRequired, true);
    assert.equal(dto.privateRead, false);
    assert.equal(dto.networkRequests, 0);
    assert.equal(dto.adminPublicInputsVerified, false);
    assert.equal(dto.adminHandoffReady, false);
  },
);

test(
  'startup native dispatcher admits query only and refuses migration or advisor children',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Invoke-Cli'])}
$StartupReplacement=$true;$RemainingContinuation=$false;$PostcheckContinuation=$true;$leaseExpires=[DateTime]::UtcNow.AddHours(1);$phaseAControlHardDeadline=$null;$script:children=0
$cliPath='synthetic-never-spawned.exe';$scratch='C:\\__emr_synthetic_never_accessed';$dbUri='synthetic-uri';$password='synthetic-password';$receipt=[ordered]@{childrenClosed=$true}
function Invoke-Bounded {$script:children++;return [pscustomobject]@{closed=$true;ok=$true}}
foreach($arguments in @(@('db','push'),@('db','push','--dry-run'),@('db','advisors'),@('gen','types'),@('db','reset'))){$blocked=$false;try{$null=Invoke-Cli $arguments 1000}catch{$blocked=$true};if(-not $blocked){throw 'FORBIDDEN_OPERATION_ADMITTED'}}
if($script:children -ne 0){throw 'FORBIDDEN_CHILD_SPAWNED'}
$null=Invoke-Cli @('db','query','--file','synthetic.sql') 1000
if($script:children -ne 1){throw 'FIXED_QUERY_NOT_ADMITTED'}
`);
  },
);

test(
  'startup native ancestry binds its own admission and claim to the actual bounded kernel chain',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Assert-Keys', 'Read-FoundationKernelProcess', 'Assert-FoundationStartupReplacementProcessAncestry'])}
$StartupReplacement=$true;$RemainingContinuation=$false;$CheckOnly=$false;$repo='C:\\__emr_synthetic_never_accessed';$env:LOCALAPPDATA=$repo
$now=[DateTimeOffset]::UtcNow;$start=$now.AddMinutes(-1);$claimed=$now.AddSeconds(-45);$script:fault=''
$clock=[pscustomobject]@{segmentId='${segment}';startsAt=$start.ToUnixTimeMilliseconds();stopNewAt=$start.AddMinutes(50).ToUnixTimeMilliseconds()}
function Assert-Path($Root,$Relative){
 if($Relative -notin @('scripts/n8n/out/foundation/live/startup-replacement-${segment}.json','scripts/n8n/out/foundation/live/startup-replacement-${segment}.runtime-claim.json','Temp/emr-m03-acceptance-parent.operation.lock')){throw 'UNEXPECTED_CUSTODY_PATH'}
 return Join-Path $Root $Relative
}
function File-Hash {return 'synthetic-fixed-admission-hash'}
function Read-Json($Path){
 if($Path.EndsWith('.runtime-claim.json')){$value=[pscustomobject]@{kind='m03_startup_replacement_runtime_claim';version=1;segmentId=$clock.segmentId;admissionSha256='synthetic-fixed-admission-hash';processId=90001;parentProcessId=90002;claimedAt=$claimed.ToUnixTimeMilliseconds()};switch($script:fault){'old-claim'{$value.kind='m03_remaining_continuation_runtime_claim'};'wrong-hash'{$value.admissionSha256='different'};'future-claim'{$value.claimedAt=$now.AddMinutes(1).ToUnixTimeMilliseconds()}};return $value}
 $value=[pscustomobject]@{kind='m03_startup_replacement_admission';segmentId=$clock.segmentId;startsAt=$clock.startsAt;parentProcessId=90002};if($script:fault -ceq 'old-admission'){$value.kind='m03_remaining_continuation_admission'};return $value
}
function Read-FoundationParentLock($Path){return [pscustomobject]@{kind='m03_clock_admission_parent';version=1;segmentId=$(if($script:fault -ceq 'old-parent'){'${previous}'}else{$clock.segmentId});processId=90002}}
function Get-CimInstance {param($ClassName,$Filter,$Property,$ErrorAction)
 if($ClassName -cne 'Win32_Process' -or @($Property).Count -ne 3 -or @($Property|Where-Object{$_ -cnotin @('ProcessId','ParentProcessId','CreationDate')}).Count -ne 0){throw 'UNSAFE_PROCESS_PROJECTION'}
 $number=[long]($Filter -replace '^ProcessId = ','')
 if($number -eq $PID){return [pscustomobject]@{ProcessId=$number;ParentProcessId=$(if($script:fault -ceq 'separate-admin'){90099}else{90001});CreationDate=$now.AddSeconds(-40).UtcDateTime}}
 if($number -eq 90001){if($script:fault -ceq 'dead-runtime'){return};return [pscustomobject]@{ProcessId=$number;ParentProcessId=$(if($script:fault -ceq 'wrong-runtime-parent'){90099}else{90002});CreationDate=$(if($script:fault -ceq 'reused-runtime'){$now.AddSeconds(-20).UtcDateTime}elseif($script:fault -ceq 'same-ms-runtime'){[DateTimeOffset]::FromUnixTimeMilliseconds($claimed.ToUnixTimeMilliseconds()).UtcDateTime.AddTicks(9999)}else{$now.AddSeconds(-50).UtcDateTime})}}
 if($number -eq 90002){return [pscustomobject]@{ProcessId=$number;ParentProcessId=1;CreationDate=$(if($script:fault -ceq 'reused-wrapper'){$now.AddSeconds(-20).UtcDateTime}else{$now.AddMinutes(-2).UtcDateTime})}}
 throw 'UNEXPECTED_PROCESS'
}
if((Assert-FoundationStartupReplacementProcessAncestry $clock) -ne $true){throw 'VALID_CHAIN_REFUSED'}
$script:fault='same-ms-runtime';if((Assert-FoundationStartupReplacementProcessAncestry $clock) -ne $true){throw 'SAME_MILLISECOND_CHAIN_REFUSED'}
foreach($fault in @('old-claim','old-admission','old-parent','wrong-hash','future-claim','separate-admin','wrong-runtime-parent','reused-runtime','reused-wrapper','dead-runtime')){$script:fault=$fault;$blocked=$false;try{$null=Assert-FoundationStartupReplacementProcessAncestry $clock}catch{$blocked=$true};if(-not $blocked){throw 'UNOWNED_CHAIN_ACCEPTED'}}
`);
    const value = source(consumer);
    assert.ok(
      value.lastIndexOf('Assert-FoundationStartupReplacementProcessAncestry $clock') <
        value.indexOf('$consumed = $true'),
    );
  },
);

test(
  'startup vacancy requires fresh14 and all six globally vacant control tables and four prior intent fences',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Assert-FoundationContinuationVacant'], control)}
${definitions(['Assert-Keys'])}
$StartupReplacement=$true;$RemainingContinuation=$false;$repo='C:\\__emr_synthetic_never_accessed';$queryFile='synthetic-history.sql';$queryTimeoutMs=1;$continuationOutputStem='m03-foundation-startup-replacement-';$postcheckContinuationSegment='${segment}';$script:history=0;$script:sql='';$script:intent='';$script:historyState='complete'
function Invoke-Cli($Arguments,$Timeout){$script:history++;if(($Arguments -join ' ') -cne 'db query --file synthetic-history.sql'){throw 'UNEXPECTED_CLI'};return [pscustomobject]@{text='synthetic'}}
function History-State {return $script:historyState}
function Invoke-FoundationQuery($Sql,$Field){$script:sql=$Sql;return [pscustomobject]@{windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';windows=0;approvals=0;launches=0;requests=0;bindings=0;leases=0}}
function Test-Path {param($LiteralPath) return $script:intent -ne '' -and $LiteralPath.EndsWith($script:intent)}
Assert-FoundationContinuationVacant -RefreshHistory
if($script:history -ne 1 -or $script:sql.Contains(' where window_id=') -or [regex]::Matches($script:sql,'select count\\(\\*\\)').Count -ne 6){throw 'GLOBAL_HISTORY_VACANCY_NOT_ENFORCED'}
foreach($name in @('m03-foundation-owner-provision-attempt.json','m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json','m03-foundation-remaining-continuation-${previous}-owner-provision-attempt.json','m03-foundation-startup-replacement-${segment}-owner-provision-attempt.json')){$script:intent=$name;$blocked=$false;try{Assert-FoundationContinuationVacant}catch{$blocked=$true};if(-not $blocked){throw 'PRIOR_INTENT_ACCEPTED'}}
$script:intent='';$script:historyState='baseline';$blocked=$false;try{Assert-FoundationContinuationVacant -RefreshHistory}catch{$blocked=$true};if(-not $blocked){throw 'LESS_THAN14_HISTORY_ACCEPTED'}
`);
  },
);

test(
  'startup SQL is a distinct fixed source with only its constant changed and cannot use remaining authority',
  { skip: process.platform !== 'win32' },
  () => {
    const original = readFileSync('scripts/assert/m03_smoke_reactivate.sql');
    assert.equal(
      createHash('sha256').update(original).digest('hex'),
      'd13a08a9164d4cea277458613e2b6b49789b6796d219a1365c28cb7aef3141a1',
    );
    assert.equal(
      source('scripts/assert/m03_smoke_reactivate_startup.sql'),
      original
        .toString('utf8')
        .replace(`v_segment constant text := '${previous}'`, `v_segment constant text := '${segment}'`),
    );
    const output = powershell(`
${definitions(['Foundation-FixtureSql'], control)}
$repo=${quote(resolve('.'))};$StartupReplacement=$true;$RemainingContinuation=$false;$PostcheckContinuation=$true
function Assert-Path($Root,$Relative){if($Relative -cne 'scripts/assert/m03_smoke_reactivate_startup.sql'){throw 'UNEXPECTED_SQL_SOURCE'};return Join-Path $Root $Relative}
$body=Foundation-FixtureSql 'm03_smoke_reactivate_startup.sql'
if(-not $body.StartsWith('do $smoke_reactivate$') -or -not $body.Contains("set_config('emr.smoke_reactivation_segment','${segment}',true)") -or -not $body.Contains("v_segment constant text := '${segment}'")){throw 'NEW_SQL_NOT_PURPOSE_BOUND'}
$StartupReplacement=$false;$RemainingContinuation=$true;$blocked=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_startup.sql'}catch{$blocked=$true};if(-not $blocked){throw 'OLD_AUTHORITY_ACCEPTED_NEW_SQL'}
Write-Output 'FIXED_SQL_ONLY'
`);
    assert.equal(output, 'FIXED_SQL_ONLY');
  },
);

test(
  'startup reactivation records its own once intent after fresh14 and caches only exact audited readback on a lost ACK',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Reactivate-FoundationStartupReplacementFixture'], control)}
$StartupReplacement=$true;$RemainingContinuation=$false;$phaseAStart=[DateTime]::UtcNow;$out='C:\\__emr_synthetic_never_accessed';$runId='synthetic';$continuationOutputStem='m03-foundation-startup-replacement-';$postcheckContinuationSegment='${segment}';$receipt=[ordered]@{};$script:remainingOwnedFixture=$null;$script:intent=0;$script:mutations=0;$script:readbackFails=$false;$script:history=0;$script:archived=0
function Assert-FoundationContinuationVacant {param([switch]$RefreshHistory) if(-not $RefreshHistory){throw 'FRESH14_REQUIRED'};$script:history++}
function Assert-FoundationRemainingArchivedFixture {$script:archived++;return 'synthetic-verified'}
function Write-NewJson($Path,$Value){if($script:intent -ne 0){throw 'ONCE_ONLY'};if($script:history -ne 1 -or $script:archived -ne 1 -or -not $Path.EndsWith('m03-foundation-startup-replacement-${segment}-reactivation-attempt.json') -or $Value.segmentId -cne '${segment}' -or $Value.competitorId -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa' -or $Value.accountId -cne 'bd23314c-591f-4fb7-92fd-b7450634eeb6'){throw 'WRONG_REACTIVATION_INTENT'};$script:intent++}
function Foundation-FixtureSql($Name){if($Name -cne 'm03_smoke_reactivate_startup.sql'){throw 'WRONG_SQL'};return 'synthetic-reactivation'}
function Invoke-FoundationMutation($Sql){if($script:intent -ne 1){throw 'NO_INTENT'};$script:mutations++;return [ordered]@{childrenClosed=$true;acknowledged=$false}}
function Read-FoundationStartupReplacementReactivatedFixture {if($script:readbackFails){throw 'UNKNOWN_READBACK'};return [pscustomobject]@{result='M03_SMOKE_FIXTURE_READY';company_code='C999';competitor_id='d51a39f6-fe87-4d17-aee9-3070c45693aa';account_id='bd23314c-591f-4fb7-92fd-b7450634eeb6';platform='website_work_page';url='https://everyone.film/about-everyone';competitor_status='active';account_status='active'}}
$blocked=$false;try{Reactivate-FoundationStartupReplacementFixture}catch{$blocked=$true}
if(-not $blocked -or $script:mutations -ne 1 -or $null -eq $script:remainingOwnedFixture -or $receipt.reactivationState -cne 'committed_after_unknown_ack'){throw 'OWNED_UNKNOWN_ACK_NOT_CACHED'}
try{Reactivate-FoundationStartupReplacementFixture}catch{};if($script:mutations -ne 1){throw 'REACTIVATION_REPLAYED'}
$script:intent=0;$script:remainingOwnedFixture=$null;$script:readbackFails=$true;$script:history=0;$script:archived=0
try{Reactivate-FoundationStartupReplacementFixture}catch{}
if($null -ne $script:remainingOwnedFixture -or $receipt.reactivationState -cne 'unknown'){throw 'UNKNOWN_STATE_ADOPTED'}
`);
  },
);

test(
  'startup readback requires its exact audit actor, segment and retained fixture IDs',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Read-FoundationStartupReplacementReactivatedFixture', 'Assert-FoundationContinuationFixture'], control)}
${definitions(['Assert-Keys'])}
$script:foreign=$false
function Invoke-FoundationQuery($Sql,$Field){
 if($Field -cne 'fixture' -or -not $Sql.Contains("l.actor_id='m03_smoke_reactivate.v1:${segment}'") -or -not $Sql.Contains("l.after->>'segment_id'='${segment}'") -or $Sql.Contains('${previous}') -or -not $Sql.Contains("o.action='m03_smoke_fixture_created'")){throw 'WRONG_REACTIVATION_AUDIT'}
 return [pscustomobject]@{result='M03_SMOKE_FIXTURE_READY';company_code='C999';competitor_id=$(if($script:foreign){'90000000-0000-4000-8000-000000000001'}else{'d51a39f6-fe87-4d17-aee9-3070c45693aa'});account_id='bd23314c-591f-4fb7-92fd-b7450634eeb6';platform='website_work_page';url='https://everyone.film/about-everyone';competitor_status='active';account_status='active'}
}
$value=Read-FoundationStartupReplacementReactivatedFixture
if($value.competitor_id -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa'){throw 'OWNED_FIXTURE_REFUSED'}
$script:foreign=$true;$blocked=$false;try{$null=Read-FoundationStartupReplacementReactivatedFixture}catch{$blocked=$true};if(-not $blocked){throw 'FOREIGN_FIXTURE_ADOPTED'}
`);
  },
);

test(
  'startup wrapper cannot Admit with absent runtime delivery, short lease or invalid Machine provenance',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-startup-admission-gates-'));
    const delivery = join(directory, 'synthetic-public-delivery.json');
    const admin = join(directory, 'synthetic-public-admin-metadata.json');
    const now = new Date();
    const head = 'f42930f90c2de43c84f61ad6d966d0ee6074d70e';
    writeFileSync(delivery, JSON.stringify({ audience: 'synthetic-audience', sourceCommitSha: head }));
    writeFileSync(
      admin,
      JSON.stringify({
        version: 1,
        environment: 'dev',
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        purpose: 'm03-foundation-phase-a-dev',
        approvalSha: head,
        createdAt: now.toISOString().replace('Z', '0000Z'),
        expiresAt: new Date(now.getTime() + 7200000).toISOString().replace('Z', '0000Z'),
      }),
    );
    const value = source(wrapper);
    const start = value.indexOf(' # Verify retained input provenance');
    const end = value.indexOf(' $receipt.privateRead=$true', start);
    assert.ok(start > 0 && end > start);
    const preAdmit = value.slice(start, end);
    try {
      const result = powershell(`
$env:LOCALAPPDATA=${quote(directory)};$repo=${quote(directory)};$directory=${quote(directory)}
$seal=[pscustomobject]@{windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';approvedHead='${head}';approvedPacketSha256='synthetic-public-packet'}
$node='synthetic-never-spawned';$ResumeZeroSetup=$false;$ClockAmendment=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$true;$admittedClockMode=$true;$resumeDeadlineAt=$null;$script:admissions=0;$script:fault=''
function Public-File($Path,$Maximum=0){
 if($Path.EndsWith('foundation-delivery-packet.json')){return ${quote(delivery)}}
 if($Path.EndsWith('emr-m03-foundation-dev-migration-password.lease.json')){return ${quote(admin)}}
 if($script:fault -ceq 'missing-runtime' -and $Path.EndsWith('emr-m03-acceptance-management.dpapi')){throw 'SYNTHETIC_MISSING_RUNTIME'}
 return 'synthetic-existing-unread-ciphertext'
}
function Read-LockedText($Path){
 if($Path.EndsWith('pending-runtime.json')){return ([ordered]@{version=1;windowId=$seal.windowId;purpose='pending_inactive_m03_runtime_delivery';audience='synthetic-audience';sourceCommitSha=$(if($script:fault -ceq 'machine-provenance'){'0000000000000000000000000000000000000000'}else{'${head}'});credentialId='EmrM03Machine19';createdAt=[DateTimeOffset]::UtcNow.AddMinutes(-1).ToString('o')}|ConvertTo-Json -Compress)}
 $kind=if($Path.EndsWith('management.lease.json')){'Management'}elseif($Path.EndsWith('writer.lease.json')){'Writer'}elseif($Path.EndsWith('apifyread.lease.json')){'ApifyRead'}else{throw 'UNEXPECTED_PRIVATE_METADATA_PATH'}
 $created=[DateTimeOffset]::UtcNow.AddMinutes(-1)
 if($script:fault -ceq 'short-lease'){$created=$created.AddHours(-1)}
 return ([ordered]@{version=1;windowId=$seal.windowId;purpose=('m03_approved_dev_acceptance_'+$kind.ToLowerInvariant());approvedHead=$seal.approvedHead;approvedPacketSha256=$seal.approvedPacketSha256;kind=$kind;createdAt=$created.ToString('o');expiresAt=$created.AddHours(2).ToString('o')}|ConvertTo-Json -Compress)
}
function Test-Path {param($LiteralPath) return $false}
function Invoke-ClockAmendmentPublic($Node,$Repository,$Mode,$PostcheckClock,$RemainingClock,$StartupClock){
 if($Mode -cne 'Admit' -or -not $StartupClock -or $RemainingClock -or $PostcheckClock){throw 'WRONG_ADMISSION_MODE'}
 $script:admissions++;$start=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 return [pscustomobject]@{startsAt=$start;deadlineAt=$start+3600000}
}
function Plain-Dpapi {throw 'DPAPI_MUST_NOT_BE_REACHED'}
foreach($fault in @('missing-runtime','short-lease','machine-provenance')){
 $script:fault=$fault;$blocked=$false
 try{${preAdmit}}catch{$blocked=$true}
 if(-not $blocked -or $script:admissions -ne 0){throw 'ADMISSION_PRECONDITION_BYPASSED'}
}
$script:fault='';${preAdmit}
if($script:admissions -ne 1){throw 'VALID_SYNTHETIC_PRECONDITIONS_NEVER_REACHED_ADMIT'}
Write-Output 'PUBLIC_SYNTHETIC_ADMISSION_GATES_VERIFIED'
`);
      assert.equal(result, 'PUBLIC_SYNTHETIC_ADMISSION_GATES_VERIFIED');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
