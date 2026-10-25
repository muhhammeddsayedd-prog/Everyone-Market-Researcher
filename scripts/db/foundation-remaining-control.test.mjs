import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const source = (name) => readFileSync(name, 'utf8');
const consumer = 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1';
const control = 'scripts/db/windows/Foundation-AdminControl.ps1';
const wrapper = 'scripts/n8n/windows/Invoke-M03Acceptance.ps1';
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
function powershell(code) {
  const result = spawnSync(
    ps,
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(code + '\nexit 0\n', 'utf16le').toString('base64'),
    ],
    {
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
          process.env[key] === undefined ? [] : [[key, process.env[key]]],
        ),
      ),
      windowsHide: true,
      encoding: 'utf8',
      timeout: 15000,
    },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
test('remaining mode is an actual exclusive PowerShell parameter and uses its new clock and no-push output stem', () => {
  const value = source(consumer);
  assert.ok(/\[switch\]\$RemainingContinuation/.test(value), 'new mode parameter missing');
  assert.match(value, /foundation-live-remaining-continuation\.mjs/);
  assert.match(value, /e8035391-dba8-48c9-97e0-139ba980d86e/);
  assert.match(value, /m03-foundation-remaining-continuation-/);
  assert.match(value, /ReadClaimed/);
  for (const name of [
    consumer,
    control,
    wrapper,
    'scripts/db/windows/New-M03FoundationMigrationHandoff.ps1',
  ]) {
    powershell(
      `$errors=$null;$tokens=$null;$null=[Management.Automation.Language.Parser]::ParseFile(${quote(resolve(name))},[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'SOURCE_PARSE_FAILED'}`,
    );
  }
});
const definitions = (names, file = control) => `
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(resolve(file))},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'SOURCE_PARSE_FAILED'}
foreach($name in @(${names.map(quote).join(',')})){
 $found=@($ast.FindAll({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true))
 if($found.Count -ne 1){throw 'EXPECTED_FUNCTION_MISSING'};Invoke-Expression $found[0].Extent.Text
}`;
const exactFixture = `([pscustomobject]@{result='M03_SMOKE_FIXTURE_READY';company_code='C999';competitor_id='d51a39f6-fe87-4d17-aee9-3070c45693aa';account_id='bd23314c-591f-4fb7-92fd-b7450634eeb6';platform='website_work_page';url='https://everyone.film/about-everyone';competitor_status='active';account_status='active'})`;
test('actual remaining vacancy function freshly verifies14 and checks all six global tables plus every prior provision intent', () => {
  powershell(`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
${definitions(['Assert-FoundationContinuationVacant'])}
${definitions(['Assert-Keys'], consumer)}
$RemainingContinuation=$true;$repo='C:\\__emr_synthetic_never_accessed';$queryFile='synthetic-history.sql';$queryTimeoutMs=1;$continuationOutputStem='m03-foundation-remaining-continuation-';$postcheckContinuationSegment='e8035391-dba8-48c9-97e0-139ba980d86e';$script:history=0;$script:sql='';$script:intent=''
function Invoke-Cli($Arguments,$Timeout){$script:history++;if(($Arguments -join ' ') -cne 'db query --file synthetic-history.sql'){throw 'UNEXPECTED_CLI'};return [pscustomobject]@{text='synthetic'}}
function History-State($Value){return 'complete'}
function Invoke-FoundationQuery($Sql,$Field){$script:sql=$Sql;return [pscustomobject]@{windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';windows=0;approvals=0;launches=0;requests=0;bindings=0;leases=0}}
function Test-Path {param($LiteralPath) return $script:intent -ne '' -and $LiteralPath.EndsWith($script:intent)}
Assert-FoundationContinuationVacant -RefreshHistory
if($script:history -ne 1 -or $script:sql.Contains(' where window_id=') -or [regex]::Matches($script:sql,'select count\\(\\*\\)').Count -ne 6){throw 'GLOBAL_HISTORY_VACANCY_NOT_ENFORCED'}
foreach($name in @('m03-foundation-owner-provision-attempt.json','m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json','m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-owner-provision-attempt.json')){
 $script:intent=$name;$blocked=$false;try{Assert-FoundationContinuationVacant}catch{$blocked=$true};if(-not $blocked){throw 'PRIOR_INTENT_ACCEPTED'}
}`);
});
test('actual remaining native dispatcher refuses push, advisors and types before spawning any CLI', () => {
  powershell(`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
${definitions(['Invoke-Cli'], consumer)}
$RemainingContinuation=$true;$PostcheckContinuation=$true;$leaseExpires=[DateTime]::UtcNow.AddHours(1);$phaseAControlHardDeadline=$null;$script:children=0
function Invoke-Bounded {$script:children++;throw 'MUST_NOT_SPAWN'}
foreach($arguments in @(@('db','push'),@('db','push','--dry-run'),@('db','advisors'),@('gen','types'),@('db','reset'))){
 $blocked=$false;try{Invoke-Cli $arguments 1000}catch{$blocked=$true};if(-not $blocked){throw 'FORBIDDEN_CLI_ADMITTED'}
}
if($script:children -ne 0){throw 'FORBIDDEN_CHILD_SPAWNED'}
`);
});
test('remaining administrator ancestry requires the actual kernel parent chain and immutable claim time before any private read', () => {
  powershell(`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
${definitions(['Assert-Keys', 'Read-FoundationKernelProcess', 'Assert-FoundationRemainingProcessAncestry'], consumer)}
$RemainingContinuation=$true;$CheckOnly=$false;$repo='C:\\__emr_synthetic_never_accessed';$env:LOCALAPPDATA=$repo
$now=[DateTimeOffset]::UtcNow;$start=$now.AddMinutes(-1);$claimed=$now.AddSeconds(-45);$script:fault=''
$clock=[pscustomobject]@{segmentId='e8035391-dba8-48c9-97e0-139ba980d86e';startsAt=$start.ToUnixTimeMilliseconds();stopNewAt=$start.AddMinutes(50).ToUnixTimeMilliseconds()}
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
function File-Hash($Path){return 'synthetic-fixed-admission-hash'}
function Read-Json($Path){
 if($Path.EndsWith('.runtime-claim.json')){return [pscustomobject]@{kind='m03_remaining_continuation_runtime_claim';version=1;segmentId=$clock.segmentId;admissionSha256='synthetic-fixed-admission-hash';processId=90001;parentProcessId=90002;claimedAt=$claimed.ToUnixTimeMilliseconds()}}
 if($Path.EndsWith('.lock')){return [pscustomobject]@{kind='m03_clock_admission_parent';version=1;segmentId=$clock.segmentId;processId=90002}}
 return [pscustomobject]@{kind='m03_remaining_continuation_admission';segmentId=$clock.segmentId;startsAt=$clock.startsAt;parentProcessId=90002}
}
function Read-FoundationParentLock($Path){return Read-Json $Path}
function Get-CimInstance {param($ClassName,$Filter,$Property,$ErrorAction)
 if($ClassName -cne 'Win32_Process' -or @($Property).Count -ne 3 -or @($Property|Where-Object{$_ -cnotin @('ProcessId','ParentProcessId','CreationDate')}).Count -ne 0){throw 'UNSAFE_PROCESS_PROJECTION'}
 $number=[long]($Filter -replace '^ProcessId = ','')
 if($number -eq $PID){return [pscustomobject]@{ProcessId=$number;ParentProcessId=$(if($script:fault -ceq 'separate-admin'){90099}else{90001});CreationDate=$now.AddSeconds(-40).UtcDateTime}}
 if($number -eq 90001){if($script:fault -ceq 'dead-runtime'){return};return [pscustomobject]@{ProcessId=$number;ParentProcessId=$(if($script:fault -ceq 'wrong-runtime-parent'){90099}else{90002});CreationDate=$(if($script:fault -ceq 'reused-runtime'){$now.AddSeconds(-20).UtcDateTime}elseif($script:fault -ceq 'same-ms-runtime'){[DateTimeOffset]::FromUnixTimeMilliseconds($claimed.ToUnixTimeMilliseconds()).UtcDateTime.AddTicks(9999)}else{$now.AddSeconds(-50).UtcDateTime})}}
 if($number -eq 90002){return [pscustomobject]@{ProcessId=$number;ParentProcessId=1;CreationDate=$(if($script:fault -ceq 'reused-wrapper'){$now.AddSeconds(-20).UtcDateTime}else{$now.AddMinutes(-2).UtcDateTime})}}
 throw 'UNEXPECTED_PROCESS'
}
if((Assert-FoundationRemainingProcessAncestry $clock) -ne $true){throw 'VALID_CHAIN_REFUSED'}
$script:fault='same-ms-runtime';if((Assert-FoundationRemainingProcessAncestry $clock) -ne $true){throw 'SAME_MILLISECOND_CHAIN_REFUSED'}
foreach($fault in @('separate-admin','wrong-runtime-parent','reused-runtime','reused-wrapper','dead-runtime')){$script:fault=$fault;$blocked=$false;try{$null=Assert-FoundationRemainingProcessAncestry $clock}catch{$blocked=$true};if(-not $blocked){throw 'STALE_OR_UNRELATED_CHAIN_ACCEPTED'}}
`);
  const value = source(consumer);
  assert.ok(
    value.lastIndexOf('Assert-FoundationRemainingProcessAncestry $clock') <
      value.indexOf('$consumed = $true'),
  );
  assert.doesNotMatch(
    value.slice(
      value.indexOf('function Read-FoundationKernelProcess'),
      value.indexOf('# Every native child'),
    ),
    /-Property.*CommandLine/,
  );
});
test('lost reactivation ACK caches only exact audited ownership for cleanup and never replays its durable intent', () => {
  powershell(`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
${definitions(['Reactivate-FoundationRemainingFixture'])}
$RemainingContinuation=$true;$phaseAStart=[DateTime]::UtcNow;$out='C:\\__emr_synthetic_never_accessed';$runId='synthetic';$continuationOutputStem='m03-foundation-remaining-continuation-';$postcheckContinuationSegment='e8035391-dba8-48c9-97e0-139ba980d86e';$receipt=[ordered]@{};$script:remainingOwnedFixture=$null;$script:intent=0;$script:mutations=0;$script:readbackFails=$false
function Assert-FoundationContinuationVacant {param([switch]$RefreshHistory)}
function Assert-FoundationRemainingArchivedFixture {return 'synthetic-verified'}
function Write-NewJson($Path,$Value){if($script:intent -ne 0){throw 'ONCE_ONLY'};$script:intent++}
function Foundation-FixtureSql($Name){if($Name -cne 'm03_smoke_reactivate.sql'){throw 'WRONG_SQL'};return 'synthetic-reactivation'}
function Invoke-FoundationMutation($Sql){if($script:intent -ne 1){throw 'NO_INTENT'};$script:mutations++;return [ordered]@{childrenClosed=$true;acknowledged=$false}}
function Read-FoundationRemainingReactivatedFixture {if($script:readbackFails){throw 'UNKNOWN_READBACK'};return ${exactFixture}}
$blocked=$false;try{Reactivate-FoundationRemainingFixture}catch{$blocked=$true}
if(-not $blocked -or $script:mutations -ne 1 -or $null -eq $script:remainingOwnedFixture -or $receipt.reactivationState -cne 'committed_after_unknown_ack'){throw 'OWNED_UNKNOWN_ACK_NOT_CACHED'}
try{Reactivate-FoundationRemainingFixture}catch{};if($script:mutations -ne 1){throw 'REACTIVATION_REPLAYED'}
$script:intent=0;$script:remainingOwnedFixture=$null;$script:readbackFails=$true
try{Reactivate-FoundationRemainingFixture}catch{}
if($null -ne $script:remainingOwnedFixture -or $receipt.reactivationState -cne 'unknown'){throw 'UNKNOWN_STATE_ADOPTED'}
`);
});
test('actual remaining control finally archives proven reactivation after unknown ACK without claiming window closure', () => {
  powershell(`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
${definitions(['Invoke-FoundationAdminControl'])}
${definitions(['Assert-Keys'], consumer)}
$RemainingContinuation=$true;$PostcheckContinuation=$true;$ClockAmendment=$false;$phaseAStart=[DateTime]::UtcNow;$runId='synthetic';$projectRef='zmotjsbzhzjvpelxvxlf';$postcheckContinuationSegment='e8035391-dba8-48c9-97e0-139ba980d86e';$receipt=[ordered]@{phaseACommands=0;phaseAClosed=$false};$script:step=0;$script:archived=0
function Assert-FoundationContinuationVacant {}
function Assert-FoundationRemainingArchivedFixture {return 'synthetic'}
function Assert-FoundationRemainingPriorPostcheck {return 'synthetic'}
function Read-FoundationCommand($Deadline){$script:step++;return [pscustomobject]@{id='90000000-0000-4000-8000-000000000001';kind=$(if($script:step -eq 1){'postcheck'}else{'fixture'});args=[pscustomobject]@{}}}
function Invoke-FoundationPostcheck {return [pscustomobject]@{ready=$true}}
function Reactivate-FoundationRemainingFixture {$script:remainingOwnedFixture=${exactFixture};throw 'ACK_UNKNOWN_BUT_READBACK_OWNED'}
function Archive-FoundationUnprovisionedFixture($Expected){if($Expected.account_id -cne 'bd23314c-591f-4fb7-92fd-b7450634eeb6'){throw 'WRONG_OWNER'};$script:archived++;return [pscustomobject]@{archived=$true}}
try{Invoke-FoundationAdminControl}catch{}
if($script:archived -ne 1 -or $receipt.unprovisionedFixtureArchived -ne $true -or $receipt.phaseAClosed -ne $false){throw 'OWNED_FIXTURE_CLEANUP_FAILED'}
`);
});
test('remaining fixture path has an irreversible once intent and never creates or adopts a competitor', () => {
  const value = source(control);
  assert.match(value, /function Reactivate-FoundationRemainingFixture/);
  const body = value.slice(
    value.indexOf('function Reactivate-FoundationRemainingFixture'),
    value.indexOf('function Invoke-FoundationPostcheck'),
  );
  assert.match(body, /m03_smoke_reactivate\.sql/);
  assert.match(body, /Write-NewJson/);
  assert.ok(body.indexOf('Write-NewJson') < body.indexOf('Invoke-FoundationMutation'));
  assert.match(body, /d51a39f6-fe87-4d17-aee9-3070c45693aa/);
  assert.match(body, /bd23314c-591f-4fb7-92fd-b7450634eeb6/);
  assert.doesNotMatch(body, /m03_smoke_setup\.sql/);
});
test('remaining postcheck reuses pinned successful evidence and rejects advisor/type regeneration in its branch', () => {
  const value = source(control);
  assert.match(value, /function Invoke-FoundationRemainingPostcheck/);
  const body = value.slice(
    value.indexOf('function Invoke-FoundationRemainingPostcheck'),
    value.indexOf('function Read-FoundationCommand'),
  );
  assert.match(body, /Assert-FoundationRemainingPriorPostcheck/);
  assert.match(body, /foundation-postcheck\.sql/);
  assert.doesNotMatch(body, /'advisors'|'gen','types'/);
  powershell(`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
${definitions(['Invoke-FoundationRemainingPostcheck'])}
${definitions(['Assert-Keys'], consumer)}
$repo=${quote(resolve('.'))};$projectRef='zmotjsbzhzjvpelxvxlf';$receipt=[ordered]@{};$script:catalog=0;$script:freshHistory=0;$script:fixture=0;$script:bad=$false
function Assert-FoundationRemainingPriorPostcheck {return [pscustomobject]@{typesCandidate='synthetic-prior-types.ts';advisorsSourceOrdered=$true;reused=$true}}
function Assert-FoundationContinuationVacant {param([switch]$RefreshHistory) if(-not $RefreshHistory){throw 'NO_FRESH_HISTORY'};$script:freshHistory++}
function Assert-FoundationRemainingArchivedFixture {$script:fixture++;return 'synthetic'}
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
function Invoke-Cli {throw 'UNCHANGED_ADVISOR_OR_TYPE_EXECUTION_FORBIDDEN'}
function Invoke-FoundationQuery($Sql,$Field){if($Field -cne 'postcheck'){throw 'WRONG_QUERY'};$script:catalog++;return [pscustomobject]@{identity=$true;tables_rls=$true;no_machine_table_grants=$true;rpc_shape=$true;owner_control_restricted=$true;all_project_tables_rls=$true;all_views_invoker=$true;gw01_closed=$true;domain_auto_join_off=$true;baseline_counts=(-not $script:bad);schemas=@('app','api','ops','ingest')}}
$value=Invoke-FoundationRemainingPostcheck
if($value.ready -ne $true -or $value.typesGenerated -ne $false -or $value.reusedCompletedPostcheck -ne $true -or $script:catalog -ne 1 -or $script:freshHistory -ne 1 -or $script:fixture -ne 1){throw 'FRESH_VS_REUSED_EVIDENCE_CONFLATED'}
$script:bad=$true;$blocked=$false;try{$null=Invoke-FoundationRemainingPostcheck}catch{$blocked=$true};if(-not $blocked){throw 'CHANGED_CRITICAL_CATALOG_ACCEPTED'}
`);
});
test('remaining outer wrapper forwards only the new exclusive flag/session and seals the new SQL source', () => {
  const value = source(wrapper);
  assert.match(value, /\[switch\]\$RemainingContinuation/);
  assert.match(value, /SessionRemainingContinuation/);
  assert.match(value, /remaining_continuation_ready/);
  assert.match(value, /-RemainingContinuation/);
  assert.match(
    source('scripts/n8n/windows/Acceptance-PublicRuntime.ps1'),
    /scripts\/assert\/m03_smoke_reactivate\.sql/,
  );
});
test('actual public clock adapter returns proposed approval status without accepting malformed booleans or old authority', () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-remaining-public-adapter-'));
  try {
    const modules = join(directory, 'scripts/n8n');
    mkdirSync(modules, { recursive: true });
    const module = join(modules, 'foundation-live-remaining-continuation.mjs');
    const dto = {
      kind: 'remaining_continuation_approval_required',
      status: 'approval_required',
      approvalRequired: true,
      segmentId: 'e8035391-dba8-48c9-97e0-139ba980d86e',
      sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
      windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
      privateRead: false,
      networkRequests: 0,
    };
    const run = (value, blocked) => {
      writeFileSync(
        module,
        `if(process.argv[2]!=='CheckOnly')process.exit(99);process.stdout.write(${JSON.stringify(JSON.stringify(value))});`,
      );
      powershell(`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
${definitions(['Initialize-BoundedIo', 'Invoke-ClockAmendmentPublic'], wrapper)}
function Public-File($Path){return $Path}
Initialize-BoundedIo
$blocked=$false;try{$value=Invoke-ClockAmendmentPublic ${quote(process.execPath)} ${quote(directory)} 'CheckOnly' $false $true;if($value.kind -cne 'remaining_continuation_approval_required'){throw 'WRONG_KIND'}}catch{$blocked=$true}
if($blocked -ne $${blocked}){throw 'PROPOSED_AUTHORITY_ADAPTER_FAILED'}
`);
    };
    run(dto, false);
    run({ ...dto, approvalRequired: 'true' }, true);
    run({ ...dto, kind: 'postcheck_continuation_ready' }, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
