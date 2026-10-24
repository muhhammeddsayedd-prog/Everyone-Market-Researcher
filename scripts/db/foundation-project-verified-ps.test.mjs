import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  mkdirSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, basename, sep } from 'node:path';
import { test } from 'node:test';

const executable = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const consumer = 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1';
const control = 'scripts/db/windows/Foundation-AdminControl.ps1';
const wrapper = 'scripts/n8n/windows/Invoke-M03Acceptance.ps1';
const segment = '20275b22-b7fe-4737-a9a4-c50c2feadb74';
const previous = '1c69c89e-7807-46d5-b7b8-ca28285ff2b4';
const source = (file) => readFileSync(file, 'utf8');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const environment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );
function removeOwnedTemporary(directory) {
  const absolute = resolve(directory);
  const base = resolve(tmpdir());
  assert.ok(
    absolute.startsWith(base + sep) && basename(absolute).startsWith('emr-project-'),
    'owned temporary path escaped',
  );
  assert.equal(
    realpathSync.native(absolute).toLowerCase(),
    absolute.toLowerCase(),
    'temporary path redirected',
  );
  rmSync(absolute, { recursive: true, force: true });
}
function powershell(code, expectedStatus = 0) {
  const script = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n${code}\nexit 0\n`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const temporary = encoded.length > 28000 ? mkdtempSync(join(tmpdir(), 'emr-project-extracted-ps-')) : null;
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
    if (temporary) removeOwnedTemporary(temporary);
  }
}
const definitions = (names, file = consumer) => `
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(resolve(file))},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'SOURCE_PARSE_FAILED'}
foreach($name in @(${[...new Set([...(file === control ? ['Foundation-ProjectVerifiedTechnicalIdentity', 'Foundation-ForwardWindowId'] : []), ...names])].map(quote).join(',')})){
 $found=@($ast.FindAll({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true))
 if($found.Count -ne 1){throw 'EXPECTED_FUNCTION_MISSING'};Invoke-Expression $found[0].Extent.Text
}`;
const clockContext = `
$repo='C:\\__emr_synthetic_never_accessed';$PhaseAControl=$true;$OriginalDeadlineAtMs=0;$ClockAmendment=$false;$PostcheckContinuation=$true;$RemainingContinuation=$false;$ProjectVerifiedContinuation=$true;$StartupReplacement=$false;$postcheckContinuationSegment='${segment}';$postcheckContinuationStart=$null;$node='synthetic-never-spawned.exe'
function Assert-Path($Root,$Relative){$script:module=$Relative;return Join-Path $Root $Relative}
`;
const readyDto = `([ordered]@{kind='project_verified_continuation_ready';segmentId='${segment}';sourceCommitSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';privateRead=$false;networkRequests=0})`;
const metadataDto = `([pscustomobject][ordered]@{kind='m03_vercel_saved_auth_metadata';status='metadata_covers_75_minutes';metadataValid=$true;unexpired=$true;covers75Minutes=$true;effectiveBackendEstablished=$false;networkRequests=0;authenticationAttempted=$false;refreshAttempted=$false;configWritten=$false;childClosed=$true})`;

test(
  'normal administrator Close is readback-only and requires actual owned closure before returning proof',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Foundation-Literal', 'Close-FoundationOwnedWindow'], control)}
$script:closed=$true;$script:calls=[Collections.Generic.List[string]]::new()
function Invoke-FoundationQuery($Sql,$Field){if($Sql -match 'foundation_gateway_admit|update |delete |insert '){throw 'ADMIN_CLOSE_ATTEMPTED_WRITER_MUTATION'};$script:calls.Add($Field);if($Field -ceq 'ownership'){return [pscustomobject]@{owned=$true}};return [pscustomobject]@{closed=$script:closed}}
$binding=[pscustomobject]@{audience='synthetic';commitSha='synthetic';deploymentId='synthetic'}
$value=Close-FoundationOwnedWindow $binding;if($value.state -cne 'closed' -or $value.window.closed -ne $true){throw 'CLOSURE_PROOF_MISSING'}
$script:closed=$false;$denied=$false;try{$null=Close-FoundationOwnedWindow $binding}catch{$denied=$true}
if(-not $denied -or $script:calls.Count -ne 4){throw 'UNVERIFIED_ADMIN_CLOSE_ACCEPTED'};Write-Output 'ADMIN_CLOSE_READBACK_ONLY'
`);
    assert.equal(output, 'ADMIN_CLOSE_READBACK_ONLY');
  },
);

test(
  'ArchiveFixture requires independent closed binding, zero work, exact technical2 audit and expected statuses',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Assert-FoundationArchiveInspection'])}
$expected=[pscustomobject]@{id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';audience='synthetic';commitSha='synthetic';deploymentId='synthetic';startsAt='synthetic-start';expiresAt='synthetic-expiry';closedAt='synthetic-closed'}
$window=[ordered]@{id=$expected.id;audience=$expected.audience;commitSha=$expected.commitSha;deploymentId=$expected.deploymentId;startsAt=$expected.startsAt;expiresAt=$expected.expiresAt;closedAt=$expected.closedAt;closeCount=1;admittedCount=2}
$dto=[ordered]@{window=[pscustomobject]$window;requestCount=1;reservedRequests=0;incompleteRequests=0;activeLeaseCount=0;launchCount=0;actorRunCount=0;scrapeRunCount=0;costEntryCount=0;costUsd=0;collectedItemCount=0;approval=[pscustomobject]@{closed=$true};fixture=[pscustomobject]@{itemsCount=0;locked=$false;progressPresent=$false;competitorArchived=$false;accountPaused=$false;competitorActive=$true;accountActive=$true};audits=[pscustomobject]@{creationCount=1;startupCount=1;originalCount=1;technical2Count=1;technical2Exact=$true}}
Assert-FoundationArchiveInspection $dto $expected $false
$denied=0
foreach($fault in @('open','count','binding','actor','reserved','lease','audit','human-progress')){
 switch($fault){'open'{$dto.window.closedAt=$null};'count'{$dto.window.closeCount=0};'binding'{$dto.window.deploymentId='other'};'actor'{$dto.actorRunCount=1};'reserved'{$dto.reservedRequests=1};'lease'{$dto.activeLeaseCount=1};'audit'{$dto.audits.technical2Exact=$false};'human-progress'{$dto.fixture.progressPresent=$true}}
 try{Assert-FoundationArchiveInspection $dto $expected $false}catch{$denied++}
 $dto.window.closedAt=$expected.closedAt;$dto.window.closeCount=1;$dto.window.deploymentId=$expected.deploymentId;$dto.actorRunCount=0;$dto.reservedRequests=0;$dto.activeLeaseCount=0;$dto.audits.technical2Exact=$true;$dto.fixture.progressPresent=$false
}
$dto.fixture.competitorArchived=$true;$dto.fixture.accountPaused=$true;$dto.fixture.competitorActive=$false;$dto.fixture.accountActive=$false
Assert-FoundationArchiveInspection $dto $expected $true
if($denied -ne 8){throw 'ARCHIVE_PROJECTION_GATE_FAILED'};Write-Output 'CLOSED_OWNED_QUIESCENT_ARCHIVE_ONLY'
`);
    assert.equal(output, 'CLOSED_OWNED_QUIESCENT_ARCHIVE_ONLY');
  },
);

test(
  'ArchiveFixture permits only fixed history, inspect and teardown files, with one durable mutation intent',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Invoke-Cli'])}
$ArchiveFixture=$true;$WriterClose=$false;$InspectOnly=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false
$leaseExpires=[DateTime]::UtcNow.AddMinutes(5);$phaseAControlHardDeadline=$null;$queryFile='history.sql';$inspectQueryFile='inspect.sql';$archiveFile='archive.sql'
$cliPath='never-started.exe';$scratch='synthetic';$dbUri='synthetic';$password='synthetic-unused';$receipt=[ordered]@{childrenClosed=$true};$script:children=0
function Invoke-Bounded {$script:children++;return [pscustomobject]@{closed=$true;ok=$true}}
foreach($file in @($queryFile,$inspectQueryFile,$archiveFile)){$null=Invoke-Cli @('db','query','--file',$file) 5000}
$denied=0;foreach($args in @(@('db','push'),@('db','advisors'),@('gen','types'),@('db','query','--file','other.sql'))){try{$null=Invoke-Cli $args 5000}catch{$denied++}}
if($script:children -ne 3 -or $denied -ne 4){throw 'ARCHIVE_DISPATCH_NOT_FIXED'};Write-Output 'FIXED_ARCHIVE_FILES_ONLY'
`);
    assert.equal(output, 'FIXED_ARCHIVE_FILES_ONLY');
    const value = source(consumer);
    const intent = value.indexOf("purpose='exact-owned-fixture-archive-after-independent-close'");
    const mutation = value.indexOf("$archive=Invoke-Cli @('db','query','--file',$archiveFile)");
    assert.ok(
      intent > value.indexOf('Assert-FoundationArchiveInspection $beforeArchive') && mutation > intent,
    );
    assert.equal(
      (value.match(/\$archive=Invoke-Cli @\('db','query','--file',\$archiveFile\)/g) || []).length,
      1,
    );
    const check = value.indexOf('if($CheckOnly -and $ArchiveFixture){');
    assert.ok(check > 0 && check < value.indexOf('$writerSpec=Get-M03DevCredentialSpec -Kind Admin'));
  },
);

test(
  'WriterClose accepts only direct restricted identity, exact binding and the once-incremented close response',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Assert-Keys', 'Read-FoundationWriterControl'])}
$expected=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic.vercel.app';commitSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';deploymentId='dpl_synthetic';startsAt='2026-10-23T15:47:55.265665+00:00';expiresAt='2026-10-23T16:47:55.265665+00:00';admittedCount=1}
$dto=[ordered]@{currentUser='n8n_writer';sessionUser='n8n_writer';database='postgres';control=[ordered]@{state='admitted';code=$null;result=$null;replayed=$false;operation='identity.read';window=[ordered]@{id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';startsAt=$expected.startsAt;expiresAt=$expected.expiresAt;closed=$false;totalAdmitted=1;boundAudience=$expected.audience;boundCommitSha=$expected.commitSha;boundDeploymentId=$expected.deploymentId}}}
function Run-Projection([bool]$Closed){return Read-FoundationWriterControl ([pscustomobject]@{ok=$true;closed=$true;text=('[{"writer_receipt":'+($dto|ConvertTo-Json -Depth 10 -Compress)+'}]')}) $expected $Closed}
$null=Run-Projection $false
$dto.control.state='closed';$dto.control.code='window_expired';$dto.control.window.closed=$true;$null=Run-Projection $false
$dto.control.code='window_closed';$dto.control.window.totalAdmitted=2;$null=Run-Projection $true
$denied=0
foreach($fault in @('owner-session','wrong-binding','extra-secret','wrong-counter','wrong-code','wrong-field-type')){
 switch($fault){'owner-session'{$dto.sessionUser='postgres'};'wrong-binding'{$dto.control.window.boundDeploymentId='dpl_other'};'extra-secret'{$dto['secret']='SYNTHETIC_WRITER_SECRET'};'wrong-counter'{$dto.control.window.totalAdmitted=3};'wrong-code'{$dto.control.code='window_expired'};'wrong-field-type'{$dto.control.window.closed='true'}}
 try{$null=Run-Projection $true}catch{$denied++}
 $dto.sessionUser='n8n_writer';$dto.control.window.boundDeploymentId=$expected.deploymentId;$dto.Remove('secret');$dto.control.window.totalAdmitted=2;$dto.control.code='window_closed';$dto.control.window.closed=$true
}
try{$null=Read-FoundationWriterControl ([pscustomobject]@{ok=$false;closed=$true;text='SYNTHETIC_WRITER_SECRET'}) $expected $true}catch{$denied++}
if($denied -ne 7){throw 'WRITER_CLOSE_PROJECTION_NOT_ENFORCED'};Write-Output 'DIRECT_WRITER_CLOSE_ONLY'
`);
    assert.equal(output, 'DIRECT_WRITER_CLOSE_ONLY');
    assert.doesNotMatch(output, /SYNTHETIC_WRITER_SECRET/);
  },
);

test(
  'WriterClose dispatcher excludes administrator history, arbitrary SQL and migration commands',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Invoke-Cli'])}
$WriterClose=$true;$InspectOnly=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false
$leaseExpires=[DateTime]::UtcNow.AddMinutes(5);$phaseAControlHardDeadline=$null;$writerInspectFile='C:\\synthetic\\writer-inspect.sql';$writerCloseFile='C:\\synthetic\\writer-close.sql';$queryFile='C:\\synthetic\\history.sql'
$cliPath='never-started.exe';$scratch='synthetic';$dbUri='synthetic';$password='synthetic-unused';$receipt=[ordered]@{childrenClosed=$true};$script:children=0
function Invoke-Bounded {$script:children++;return [pscustomobject]@{closed=$true;ok=$true}}
foreach($file in @($writerInspectFile,$writerCloseFile)){$null=Invoke-Cli @('db','query','--file',$file) 5000}
$denied=0;foreach($args in @(@('db','push'),@('db','advisors'),@('gen','types'),@('db','query','--file',$queryFile),@('db','query','--file','other.sql'))){try{$null=Invoke-Cli $args 5000}catch{$denied++}}
if($script:children -ne 2 -or $denied -ne 5){throw 'WRITER_SCOPE_NOT_ENFORCED'};Write-Output 'WRITER_FILES_ONLY'
`);
    assert.equal(output, 'WRITER_FILES_ONLY');
    const value = source(consumer);
    const intent = value.indexOf("purpose='restricted-writer-owned-window-close'");
    const mutate = value.indexOf("$close=Invoke-Cli @('db','query','--file',$writerCloseFile)");
    assert.ok(
      intent > value.indexOf("$receipt['writerBefore']=Read-FoundationWriterControl") && mutate > intent,
    );
    assert.equal(
      (value.match(/\$close=Invoke-Cli @\('db','query','--file',\$writerCloseFile\)/g) || []).length,
      1,
    );
    assert.ok(
      value.includes(
        'if (-not $WriterClose -and -not $ArchiveFixture -and -not $ForwardMigration -and ($consumed -or $inspectMaterialized)',
      ),
    );
    assert.ok(value.includes('$writerSpec=Get-M03DevCredentialSpec -Kind Writer'));
  },
);

test(
  'InspectOnly dispatch permits only the two sealed SELECT files before any native child',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Invoke-Cli'])}
$InspectOnly=$true;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false
$leaseExpires=[DateTime]::UtcNow.AddMinutes(10);$phaseAControlHardDeadline=$null;$queryFile='C:\\synthetic\\history.sql';$inspectQueryFile='C:\\synthetic\\inspect.sql'
$cliPath='never-started.exe';$scratch='synthetic';$dbUri='synthetic';$password='synthetic-unused';$receipt=[ordered]@{childrenClosed=$true};$script:children=0
function Invoke-Bounded {param($Executable,$Arguments,$WorkingDirectory,$TimeoutMs,$PrivatePassword) $script:children++;return [pscustomobject]@{closed=$true;ok=$true}}
foreach($file in @($queryFile,$inspectQueryFile)){$null=Invoke-Cli @('db','query','--file',$file) 5000}
$denied=0
foreach($args in @(@('db','push'),@('db','advisors'),@('gen','types'),@('db','query','--file','C:\\synthetic\\other.sql'),@('db','query','--file',$inspectQueryFile,'--unsafe'))){
 try{$null=Invoke-Cli $args 5000}catch{$denied++}
}
if($script:children -ne 2 -or $denied -ne 5){throw 'READ_ONLY_DISPATCH_NOT_ENFORCED'}
Write-Output 'FIXED_SELECT_ONLY'
`);
    assert.equal(output, 'FIXED_SELECT_ONLY');
  },
);

test(
  'InspectOnly accepts open residual projections and rejects secret fields, wrong identity and malformed data',
  { skip: process.platform !== 'win32' },
  () => {
    const dto = {
      kind: 'm03_foundation_inspection',
      windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
      identity: true,
      window: {
        id: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        audience: 'https://everyone-market-researcher-synthetic.vercel.app',
        commitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
        deploymentId: 'dpl_synthetic',
        startsAt: '2026-10-23T15:47:00+00:00',
        expiresAt: '2026-10-23T16:47:00+00:00',
        closedAt: null,
        admittedCount: 2,
        closeCount: 0,
      },
      requestCount: 2,
      reservedRequests: 0,
      incompleteRequests: 0,
      activeLeaseCount: 0,
      approval: {
        closed: false,
        expiresAt: '2026-10-23T16:47:00.123456+00:00',
        actorBuild: '0.3.99',
        maxChargeUsd: 1,
        batchMaxUsd: 2,
      },
      launchCount: 0,
      actorRunCount: 0,
      scrapeRunCount: 0,
      costEntryCount: 0,
      costUsd: 0,
      collectedItemCount: 0,
      fixture: {
        competitorId: 'd51a39f6-fe87-4d17-aee9-3070c45693aa',
        accountId: 'bd23314c-591f-4fb7-92fd-b7450634eeb6',
        competitorArchived: false,
        competitorActive: true,
        accountPaused: false,
        accountActive: true,
        itemsCount: 0,
        locked: false,
        progressPresent: false,
      },
      audits: {
        creationCount: 1,
        startupCount: 1,
        originalCount: 1,
        technical2Count: 1,
        technical2Exact: true,
      },
    };
    const inputs = [
      dto,
      { ...dto, window: null, approval: null, fixture: null },
      { ...dto, token: 'SYNTHETIC_SECRET_CANARY' },
      { ...dto, identity: false },
      { ...dto, requestCount: 'SYNTHETIC_SECRET_CANARY' },
      { ...dto, window: { ...dto.window, audience: 'SYNTHETIC_SECRET_CANARY' } },
      { ...dto, approval: { ...dto.approval, secret: 'SYNTHETIC_SECRET_CANARY' } },
      { ...dto, fixture: { ...dto.fixture, progressPresent: 'false' } },
    ];
    const output = powershell(`
${definitions(['Assert-Keys', 'Read-FoundationInspection'])}
$inputs=ConvertFrom-Json -InputObject ${quote(JSON.stringify(inputs.map((inspection) => JSON.stringify([{ inspection }]))))}
$accepted=0;$denied=0
foreach($inputText in $inputs){$result=[pscustomobject]@{ok=$true;closed=$true;text=$inputText};try{$null=Read-FoundationInspection $result;$accepted++}catch{$denied++}}
foreach($raw in @('SYNTHETIC_SECRET_CANARY','[{"inspection":"SYNTHETIC_SECRET_CANARY"}]')){try{$null=Read-FoundationInspection ([pscustomobject]@{ok=$true;closed=$true;text=$raw})}catch{$denied++}}
if($accepted -ne 2 -or $denied -ne 8){throw 'UNSAFE_INSPECTION_PROJECTION'}
Write-Output 'FINITE_INSPECTION_ONLY'
`);
    assert.equal(output, 'FINITE_INSPECTION_ONLY');
    assert.equal(output.includes('SYNTHETIC_SECRET_CANARY'), false);
  },
);

test(
  'InspectOnly requires the exact physically closed technical2 chain while permitting its unresolved remote state',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-project-inspection-chain-'));
    const liveStem = `scripts/n8n/out/foundation/live/project-verified-continuation-${segment}.technical-2`;
    const dbStem = `scripts/db/out/m03-foundation-project-verified-continuation-${segment}-technical-2`;
    mkdirSync(join(directory, 'scripts/n8n/out/foundation/live'), { recursive: true });
    mkdirSync(join(directory, 'scripts/db/out'), { recursive: true });
    try {
      const output = powershell(`
${definitions(['Assert-Keys', 'Assert-Path', 'Read-Json', 'File-Hash', 'Assert-FoundationInspectClosed'])}
$repo=${quote(directory)};$script:live=$false
function Get-CimInstance {param($ClassName,$Filter,$Property,$ErrorAction) if($script:live){return [pscustomobject]@{ProcessId=123456789}}}
$now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();$start=$now-10000
$admission=[ordered]@{kind='m03_project_verified_continuation_admission';version=1;segmentId='${segment}';sourceCommitSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';approvalSha256='5eb38cbe8740ed9a9f72d2356de3fa2e9ce77c8de3710020a7d3de7a6ebdd610';startsAt=$start;deadlineAt=$start+3600000;stopNewAt=$start+3000000;hardDeadlineAt=$start+4200000;parentProcessId=123456789}
$path=Join-Path $repo '${liveStem}.json';[IO.File]::WriteAllText($path,($admission|ConvertTo-Json -Compress));$hash=File-Hash $path
$claim=[ordered]@{kind='m03_project_verified_continuation_runtime_claim';version=1;segmentId='${segment}';admissionSha256=$hash;processId=123456788;parentProcessId=123456789;claimedAt=$start+1000}
[IO.File]::WriteAllText((Join-Path $repo '${liveStem}.runtime-claim.json'),($claim|ConvertTo-Json -Compress))
$closed=[ordered]@{kind='m03_project_verified_technical_closed';version=1;admissionSha256=$hash;parentProcessId=123456789;runtimeProcessId=123456788;closedAt=$start+2000;childClosed=$true;credentialChildrenClosed=$true;emergencyShutdown=$false;pendingMachinePreserved=$true;nativeExit=1;bypassHandoffDeleted=$false;closureVerified=$false}
$closeFile=Join-Path $repo '${liveStem}.closed.json';[IO.File]::WriteAllText($closeFile,($closed|ConvertTo-Json -Compress))
$latest=[ordered]@{runId='52cd6a97-a23a-4061-a694-00c50c700b00';environment='dev';projectRef='zmotjsbzhzjvpelxvxlf';authenticationVerified=$true;historyBefore='complete';historyAfter='complete';pushAttempted=$false;childrenClosed=$true;handoffDeleted=$true;leaseDeleted=$true;scratchDeleted=$true;technicalAttemptOrdinal=2;status='phase_a_control_failed';reactivationState='acknowledged_and_verified';phaseAClosed=$false}
$latestFile=Join-Path $repo '${dbStem}-latest.json';[IO.File]::WriteAllText($latestFile,($latest|ConvertTo-Json -Compress))
$provision=[ordered]@{version=1;runId=$latest.runId;windowId=$admission.windowId;packet=[ordered]@{audience='https://everyone-market-researcher-synthetic.vercel.app';commitSha=$admission.sourceCommitSha;deploymentId='dpl_synthetic';actorBuild='0.3.99';approvalReference='M03-A-D-f42930f-20261021';maxTotalChargeUsd=1;batchMaxUsd=2};createdAt=[DateTime]::UtcNow.ToString('o')}
[IO.File]::WriteAllText((Join-Path $repo '${dbStem}-owner-provision-attempt.json'),($provision|ConvertTo-Json -Compress -Depth 5))
$good=Assert-FoundationInspectClosed;if($good.deploymentId -cne 'dpl_synthetic'){throw 'WRONG_BINDING'}
$denied=0;$script:live=$true;try{$null=Assert-FoundationInspectClosed}catch{$denied++};$script:live=$false
$closed.credentialChildrenClosed=$false;[IO.File]::WriteAllText($closeFile,($closed|ConvertTo-Json -Compress));try{$null=Assert-FoundationInspectClosed}catch{$denied++}
$closed.credentialChildrenClosed=$true;$closed.admissionSha256=('0'*64);[IO.File]::WriteAllText($closeFile,($closed|ConvertTo-Json -Compress));try{$null=Assert-FoundationInspectClosed}catch{$denied++}
$closed.admissionSha256=$hash;[IO.File]::WriteAllText($closeFile,($closed|ConvertTo-Json -Compress));$latest.runId='00000000-0000-4000-8000-000000000001';[IO.File]::WriteAllText($latestFile,($latest|ConvertTo-Json -Compress));try{$null=Assert-FoundationInspectClosed}catch{$denied++}
if($denied -ne 4){throw 'UNSAFE_PHYSICAL_CHAIN'};Write-Output 'PHYSICAL_CLOSED_REMOTE_UNRESOLVED'
`);
      assert.equal(output, 'PHYSICAL_CLOSED_REMOTE_UNRESOLVED');
    } finally {
      removeOwnedTemporary(directory);
    }
  },
);

test(
  'dev coordinator materializes only its four scoped disposable inputs after public and Machine provenance gates',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-project-dev-materialization-'));
    const adapter = join(directory, 'synthetic-store.ps1');
    try {
      writeFileSync(
        adapter,
        `function Ensure-M03DevRuntimeHandoff { param($Kind,$AdminMode,$CoordinatorLock)\nif($AdminMode -cne 'ProjectVerifiedContinuation' -or $CoordinatorLock -isnot [IO.FileStream] -or -not $CoordinatorLock.CanWrite){throw 'WRONG_ADMIN_PURPOSE_OR_MUTEX'}\nif($Kind -ceq $script:fault){throw 'SYNTHETIC_MISSING'}\n$script:calls.Add($Kind)\n}\n`,
      );
      for (const fault of ['', 'Writer']) {
        const output = powershell(`
${definitions(['Initialize-M03AcceptanceDevCredentials'], wrapper)}
$script:calls=[Collections.Generic.List[string]]::new();$script:fault=${quote(fault)}
function Public-File($Path,$Maximum){
 if(-not $Path.EndsWith('scripts\\n8n\\windows\\Dev-CredentialStore.ps1') -or $Maximum -ne 524288){throw 'WRONG_ADAPTER'}
 return ${quote(adapter)}
}
$testLock=[IO.File]::Open(${quote(join(directory, 'synthetic-held.lock'))},[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::Write,[IO.FileShare]::Read)
$blocked=$false;try{Initialize-M03AcceptanceDevCredentials 'C:\\__emr_synthetic_never_accessed' $testLock}catch{$blocked=$true}finally{$testLock.Dispose()}
[ordered]@{calls=@($script:calls.ToArray());blocked=$blocked}|ConvertTo-Json -Compress
`);
        const result = JSON.parse(output);
        assert.equal(result.blocked, fault !== '');
        assert.deepEqual(
          result.calls,
          fault === '' ? ['Admin', 'Management', 'Writer', 'ApifyRead'] : ['Admin', 'Management'],
        );
      }
      const value = source(wrapper);
      const materialize = value.indexOf(' Initialize-M03AcceptanceDevCredentials $repo');
      assert.ok(materialize > value.indexOf(' Confirm-ProjectVerifiedVercelMetadata $node $repo'));
      assert.ok(materialize > value.indexOf("$machinePath=Public-File (Join-Path $pending 'machine.dpapi')"));
      assert.ok(materialize < value.indexOf("foreach($kind in @('Management','Writer','ApifyRead')){"));
      assert.ok(value.indexOf(' if($CheckOnly){') < materialize);
    } finally {
      removeOwnedTemporary(directory);
    }
  },
);

test(
  'technical closure is an immutable fixed projection tied to the actual wrapper admission',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-project-technical-close-'));
    const stem = `scripts/n8n/out/foundation/live/project-verified-continuation-${segment}`;
    mkdirSync(join(directory, 'scripts/n8n/out/foundation/live'), { recursive: true });
    try {
      const output = powershell(`
${definitions(['Public-File', 'Write-M03ProjectVerifiedTechnicalClosure'], wrapper)}
$admission=[ordered]@{startsAt=123456;parentProcessId=$PID}
$file=Join-Path ${quote(directory)} ${quote(stem + '.json')}
[IO.File]::WriteAllText($file,($admission|ConvertTo-Json -Compress)+"\`n",[Text.UTF8Encoding]::new($false))
$receipt=[ordered]@{childClosed=$true;credentialChildrenClosed=$true;emergencyShutdown=$false;pendingMachinePreserved=$true;nativeExit=$null;bypassHandoffDeleted=$true}
Write-M03ProjectVerifiedTechnicalClosure ${quote(directory)} ([pscustomobject]@{startsAt=123456}) $receipt $null $true
$path=Join-Path ${quote(directory)} ${quote(stem + '.closed.json')}
$first=[IO.File]::ReadAllText($path);$blocked=$false
try{Write-M03ProjectVerifiedTechnicalClosure ${quote(directory)} ([pscustomobject]@{startsAt=123456}) $receipt $null $true}catch{$blocked=$true}
if(-not $blocked -or [IO.File]::ReadAllText($path) -cne $first){throw 'CLOSURE_OVERWRITTEN'}
$value=ConvertFrom-Json -InputObject $first
if($value.parentProcessId -ne $PID -or $value.kind -cne 'm03_project_verified_technical_closed' -or $value.admissionSha256 -cne (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -or $value.runtimeProcessId -ne $null -or -not $value.closureVerified){throw 'BAD_CLOSURE_PROJECTION'}
Write-Output 'IMMUTABLE_TECHNICAL_CLOSE_VERIFIED'
`);
      assert.equal(output, 'IMMUTABLE_TECHNICAL_CLOSE_VERIFIED');
    } finally {
      removeOwnedTemporary(directory);
    }
  },
);

test(
  'native administrator resolves the current technical sibling and rejects an orphan claim without an admission',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Resolve-FoundationProjectVerifiedTechnicalPaths'])}
$repo='C:\\__emr_synthetic_never_accessed';$script:fault=$false
function Test-Path {param($LiteralPath)
 if($LiteralPath.EndsWith('.technical-2.json')){return $true}
 if($script:fault -and $LiteralPath.EndsWith('.technical-3.runtime-claim.json')){return $true}
 return $false
}
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
$value=Resolve-FoundationProjectVerifiedTechnicalPaths
if(-not $value.admission.EndsWith('.technical-2.json') -or -not $value.claim.EndsWith('.technical-2.runtime-claim.json') -or $value.technicalOrdinal -ne 2){throw 'WRONG_TECHNICAL_SELECTION'}
$script:fault=$true;$blocked=$false;try{$null=Resolve-FoundationProjectVerifiedTechnicalPaths}catch{$blocked=$true}
if(-not $blocked){throw 'ORPHAN_CLAIM_NOT_RECONCILED'}
Write-Output 'TECHNICAL_ANCESTRY_PATHS_VERIFIED'
`);
    assert.equal(output, 'TECHNICAL_ANCESTRY_PATHS_VERIFIED');
  },
);

test(
  'technical DB output and audit identities are bounded and derive only from the native selected ordinal',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Foundation-ProjectVerifiedTechnicalIdentity'], control)}
$ProjectVerifiedContinuation=$true;$script:projectVerifiedTechnicalOrdinal=2
$value=Foundation-ProjectVerifiedTechnicalIdentity
if($value.outputSegment -cne '${segment}-technical-2' -or $value.auditSegment -cne '${segment}:technical-2' -or $value.ordinal -ne 2){throw 'WRONG_TECHNICAL_IDENTITIES'}
foreach($bad in @('2',0,1024)){$script:projectVerifiedTechnicalOrdinal=$bad;$blocked=$false;try{$null=Foundation-ProjectVerifiedTechnicalIdentity}catch{$blocked=$true};if(-not $blocked){throw 'UNBOUNDED_ORDINAL_ACCEPTED'}}
Write-Output 'TECHNICAL_DB_IDENTITIES_VERIFIED'
`);
    assert.equal(output, 'TECHNICAL_DB_IDENTITIES_VERIFIED');
  },
);

test(
  'technical fixture SQL sets its native selected ordinal before validating the exact retained lifecycle',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(`
${definitions(['Foundation-FixtureSql'], control)}
$ProjectVerifiedContinuation=$true;$StartupReplacement=$false;$RemainingContinuation=$false;$PostcheckContinuation=$true;$script:projectVerifiedTechnicalOrdinal=2;$repo=${quote(resolve('.'))}
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
$sql=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'
if(-not $sql.Contains("set_config('emr.smoke_technical_ordinal','2',true)") -or $sql.IndexOf("set_config('emr.smoke_technical_ordinal','2',true)") -gt $sql.IndexOf('v_technical_text:=')){throw 'TECHNICAL_SETTING_ORDER_CHANGED'}
if($sql.Contains('\\set') -or -not $sql.Contains('v_known_audit_ids') -or -not $sql.Contains('M03_REACTIVATION_ORIGINAL_BASELINE_CHANGED')){throw 'SQL_BOUNDARY_WEAKENED'}
Write-Output 'TECHNICAL_SQL_SETTINGS_VERIFIED'
`);
    assert.equal(output, 'TECHNICAL_SQL_SETTINGS_VERIFIED');
  },
);

test(
  'project-verified metadata projection rejects secret fields and impossible or unclosed readiness',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['ConvertTo-ProjectVerifiedVercelMetadata'], wrapper)}
$script:fault=''
$valid=${metadataDto};$safe=ConvertTo-ProjectVerifiedVercelMetadata $valid
if($safe.kind -cne 'm03_acceptance_vercel_metadata' -or -not $safe.covers75Minutes -or $safe.effectiveBackendEstablished -ne $false){throw 'SAFE_METADATA_NOT_PROJECTED'}
foreach($fault in @('extra','secret-status','string-bool','network','auth','refresh','write','backend','impossible')){
 $value=${metadataDto}
 switch($fault){'extra'{$value|Add-Member -NotePropertyName token -NotePropertyValue 'SYNTHETIC_NEVER_ECHO'};'secret-status'{$value.status='SYNTHETIC_NEVER_ECHO'};'string-bool'{$value.childClosed='true'};'network'{$value.networkRequests=1};'auth'{$value.authenticationAttempted=$true};'refresh'{$value.refreshAttempted=$true};'write'{$value.configWritten=$true};'backend'{$value.effectiveBackendEstablished=$true};'impossible'{$value.unexpired=$false}}
 $blocked=$false;try{$null=ConvertTo-ProjectVerifiedVercelMetadata $value}catch{$blocked=$true};if(-not $blocked){throw 'UNSAFE_METADATA_ACCEPTED'}
}
`);
  },
);

test(
  'project-verified early metadata gate emits only its fixed frame and blocks before all credential work',
  { skip: process.platform !== 'win32' },
  () => {
    const value = source(wrapper);
    const start = value.indexOf(' # Project-verified Run checks saved CLI metadata');
    const end = value.indexOf(' # Verify retained input provenance', start);
    assert.ok(start > 0 && end > start, 'early metadata gate missing');
    for (const status of ['metadata_covers_75_minutes', 'saved_auth_expired', 'child_failed', 'malformed']) {
      const output = powershell(`
${definitions(['ConvertTo-ProjectVerifiedVercelMetadata', 'Confirm-ProjectVerifiedVercelMetadata'], wrapper)}
$ProjectVerifiedContinuation=$true;$node='synthetic-never-spawned';$repo='C:\\__emr_synthetic_never_accessed';$script:projectVerifiedMetadataClosed=$true;$receipt=[ordered]@{code='M03_ACCEPTANCE_BLOCKED'}
function Read-ProjectVerifiedVercelMetadata {
 $value=${metadataDto}
 if('${status}' -ceq 'saved_auth_expired'){$value.status='saved_auth_expired';$value.unexpired=$false;$value.covers75Minutes=$false}
 if('${status}' -ceq 'child_failed'){$value.status='child_failed';$value.metadataValid=$false;$value.unexpired=$false;$value.covers75Minutes=$false;$value.childClosed=$false}
 if('${status}' -ceq 'malformed'){$value|Add-Member -NotePropertyName token -NotePropertyValue 'SYNTHETIC_NEVER_ECHO'}
 return [pscustomobject]$value
}
$blocked=$false;try{
${value.slice(start, end)}
 Write-Output 'LATER_CREDENTIAL_GATE'
}catch{$blocked=$true}
Write-Output (([ordered]@{blocked=$blocked;closed=$script:projectVerifiedMetadataClosed;code=$receipt.code})|ConvertTo-Json -Compress)
`);
      assert.doesNotMatch(output, /SYNTHETIC_NEVER_ECHO/);
      const lines = output.split(/\r?\n/);
      const result = JSON.parse(lines.at(-1));
      assert.equal(result.blocked, status !== 'metadata_covers_75_minutes');
      assert.equal(result.closed, !['child_failed', 'malformed'].includes(status));
      assert.equal(output.includes('LATER_CREDENTIAL_GATE'), status === 'metadata_covers_75_minutes');
      const frame = JSON.parse(lines[0]);
      assert.equal(frame.kind, 'm03_acceptance_vercel_metadata');
      assert.equal(frame.effectiveBackendEstablished, false);
      assert.equal(Object.keys(frame).length, 11);
    }
    assert.ok(value.indexOf(' Confirm-PublicTransport') < start);
    assert.ok(value.indexOf('$lock.Write($parentBytes') < start);
    assert.ok(
      value.indexOf(
        "$lockedPublicClock=Invoke-ClockAmendmentPublic $node $repo 'CheckOnly'",
        value.indexOf('$lock.Write'),
      ) < start,
    );
    assert.ok(value.indexOf("$lockedPublicClock.kind -cne 'project_verified_continuation_ready'") < start);
    assert.ok(end < value.indexOf("$amendmentClock=Invoke-ClockAmendmentPublic $node $repo 'Admit'"));
    assert.ok(value.includes('$credentialChildrenClosed=$script:projectVerifiedMetadataClosed -and'));
  },
);

test(
  'project-verified metadata failure preserves all unconsumed handoffs and retains the mutex unless dependent closure is proven',
  { skip: process.platform !== 'win32' },
  () => {
    const value = source(wrapper).replaceAll('\r\n', '\n');
    const start = value.indexOf(' $deleted=$true');
    const end = value.indexOf('\n}\n$receipt|ConvertTo-Json', start);
    assert.ok(start > 0 && end > start);
    const directory = mkdtempSync(join(tmpdir(), 'emr-project-metadata-closure-'));
    const lockPath = join(directory, 'synthetic-parent.lock');
    try {
      for (const closed of [true, false]) {
        writeFileSync(lockPath, 'synthetic-owned-mutex');
        const output = powershell(`
$script:projectVerifiedMetadataClosed=$${closed};$script:credentialClosureVerified=$false;$script:closureVerified=$false
$ProjectVerifiedContinuation=$true;$amendmentClock=$null;$runtimeProcessId=$null
$consumed=[Collections.Generic.List[string]]::new();$closed=$true;$started=$false;$treeClosed=$false;$emergency=$false;$bypassCreated=$false;$exitCode=1
$lockPath=${quote(lockPath)};$lock=[IO.File]::Open($lockPath,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::Read)
$receipt=[ordered]@{kind='m03_acceptance_wrapper_closed';childClosed=$true;credentialChildrenClosed=$false;emergencyShutdown=$false;nativeExit=$null;handoffsDeleted=$false;bypassHandoffDeleted=$false;pendingMachinePreserved=$true;privateRead=$false;code='M03_ACCEPTANCE_VERCEL_METADATA_BLOCKED'}
function Public-File {throw 'UNCONSUMED_HANDOFF_TOUCHED'}
${value.slice(start, end)}
$receipt|ConvertTo-Json -Compress
`);
        const receipt = JSON.parse(output);
        assert.equal(receipt.code, 'M03_ACCEPTANCE_VERCEL_METADATA_BLOCKED');
        assert.equal(receipt.childClosed, true);
        assert.equal(receipt.credentialChildrenClosed, closed);
        assert.equal(receipt.handoffsDeleted, false);
        assert.equal(receipt.bypassHandoffDeleted, false);
        assert.equal(receipt.privateRead, false);
        assert.equal(receipt.pendingMachinePreserved, true);
        assert.equal(receipt.nativeExit, null);
        assert.equal(receipt.emergencyShutdown, false);
        assert.equal(existsSync(lockPath), !closed);
      }
    } finally {
      removeOwnedTemporary(directory);
    }
  },
);

test(
  'project-verified bounded metadata child accepts only fixed closed projections and discards raw canaries',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-project-synthetic-metadata-'));
    const entry = join(directory, 'scripts/n8n/foundation-vercel-auth-preflight.mjs');
    mkdirSync(join(directory, 'scripts/n8n'), { recursive: true });
    const dto = {
      kind: 'm03_vercel_saved_auth_metadata',
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
    };
    try {
      for (const scenario of [
        'covered',
        'expired',
        'unclosed',
        'stdout-canary',
        'stderr-canary',
        'extra-key',
        'wrong-exit',
      ]) {
        const value = { ...dto };
        let code = 0;
        if (scenario === 'expired') {
          Object.assign(value, { status: 'saved_auth_expired', unexpired: false, covers75Minutes: false });
          code = 2;
        }
        if (scenario === 'unclosed') {
          value.childClosed = false;
          code = 2;
        }
        if (scenario === 'extra-key') value.token = 'SYNTHETIC_METADATA_CANARY';
        if (scenario === 'wrong-exit') code = 2;
        writeFileSync(
          entry,
          `if(process.env.NODE_OPTIONS || process.env.VERCEL_TOKEN) process.stderr.write('SYNTHETIC_INHERITED_SECRET');\nprocess.stdout.write(${JSON.stringify(scenario === 'stdout-canary' ? 'SYNTHETIC_METADATA_CANARY' : JSON.stringify(value))});\n${scenario === 'stderr-canary' ? "process.stderr.write('SYNTHETIC_METADATA_CANARY');" : ''}\nprocess.exitCode=${code};\n`,
        );
        const output = powershell(`
${definitions(['Initialize-BoundedIo', 'Public-File', 'ConvertTo-ProjectVerifiedVercelMetadata', 'Read-ProjectVerifiedVercelMetadata'], wrapper)}
Initialize-BoundedIo
$env:NODE_OPTIONS='SYNTHETIC_NEVER_INHERIT';$env:VERCEL_TOKEN='SYNTHETIC_NEVER_INHERIT'
$value=Read-ProjectVerifiedVercelMetadata ${quote(process.execPath)} ${quote(directory)}
ConvertTo-ProjectVerifiedVercelMetadata $value|ConvertTo-Json -Compress
`);
        assert.doesNotMatch(output, /SYNTHETIC_/);
        const result = JSON.parse(output);
        assert.equal(
          result.status,
          scenario === 'covered' || scenario === 'unclosed'
            ? 'metadata_covers_75_minutes'
            : scenario === 'expired'
              ? 'saved_auth_expired'
              : 'child_failed',
        );
        assert.equal(result.childClosed, scenario === 'covered' || scenario === 'expired');
        assert.equal(result.effectiveBackendEstablished, false);
        assert.equal(Object.keys(result).length, 11);
      }
    } finally {
      removeOwnedTemporary(directory);
    }
  },
);

test(
  'project-verified approved public database CheckOnly still exits before handoff metadata',
  { skip: process.platform !== 'win32' },
  () => {
    const value = source(consumer);
    const start = value.indexOf('if($CheckOnly -and $ProjectVerifiedContinuation){Write-Output');
    const end = value.indexOf('\ntry {', start);
    assert.ok(start > 0 && end > start);
    assert.ok(end < value.indexOf('Assert-Keys $lease'));
    const output = powershell(
      `$CheckOnly=$true;$ProjectVerifiedContinuation=$true\n${value.slice(start, end)}\nWrite-Output 'PRIVATE_HANDOFF_METADATA_REACHED';exit 99`,
      4,
    );
    assert.match(output, /^M03_FOUNDATION PUBLIC_INPUTS_READY\./);
    assert.doesNotMatch(output, /PRIVATE_HANDOFF_METADATA_REACHED/);
  },
);

test(
  'project-verified continuation has separate PowerShell parameters, public guard and output custody',
  { skip: process.platform !== 'win32' },
  () => {
    for (const file of [consumer, wrapper, 'scripts/db/windows/New-M03FoundationMigrationHandoff.ps1']) {
      assert.match(source(file), /\[switch\]\$ProjectVerifiedContinuation/);
    }
    assert.match(source(consumer), /foundation-live-project-verified-continuation\.mjs/);
    assert.match(source(consumer), /m03-foundation-project-verified-continuation-/);
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
  'actual copied project-verified DB entry requires the explicit PhaseAControl parameter before public verification',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-project-copied-entry-'));
    const entry = join(directory, 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1');
    mkdirSync(join(directory, 'scripts/db/windows'), { recursive: true });
    writeFileSync(entry, readFileSync(consumer));
    try {
      for (const extra of [[], ['-PhaseAControl'], ['-PhaseAControl', '-StartupReplacement']]) {
        const result = spawnSync(
          executable,
          [
            '-NoProfile',
            '-NonInteractive',
            '-File',
            entry,
            '-CheckOnly',
            '-ProjectVerifiedContinuation',
            ...extra,
          ],
          { env: environment(), windowsHide: true, encoding: 'utf8', timeout: 15000 },
        );
        assert.equal(result.status, 1);
        assert.equal(result.stderr, '');
        if (extra.length === 1) {
          // No copied public packet exists. The accepted parameter combination
          // reaches its public-file guard and exits before CLI/private metadata.
          assert.equal(
            result.stdout.trim(),
            'M03_FOUNDATION PREFLIGHT_BLOCKED. Public packet/seal/target/CLI verification failed; no decryption or authentication attempted.',
          );
        } else {
          assert.equal(
            result.stdout.trim(),
            'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting continuation modes; no private access.',
          );
        }
        assert.equal(existsSync(join(directory, 'scripts/db/out')), false);
      }
    } finally {
      removeOwnedTemporary(directory);
    }
  },
);

test(
  'project-verified public adapter accepts only exact new ready and claimed clocks and preserves the75 minute lease',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation', 'Get-FoundationLeaseFloor'])}
${clockContext}
$script:fault='';$script:calledMode='';$admittedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-1000
function Invoke-Bounded($Executable,$Arguments,$WorkingDirectory,$Timeout){
 $script:calledMode=$Arguments[1];$value=${readyDto}
 if($Arguments[1] -ceq 'ReadClaimed'){$value.kind='clock_project_verified_continuation_admitted';$value.startsAt=$admittedAt;$value.deadlineAt=$admittedAt+3600000;$value.stopNewAt=$admittedAt+3000000;$value.hardDeadlineAt=$admittedAt+4200000}
 switch($script:fault){'old-kind'{$value.kind='remaining_continuation_ready'};'old-segment'{$value.segmentId='${previous}'};'string-bool'{$value.privateRead='false'};'private-read'{$value.privateRead=$true};'network'{$value.networkRequests=1};'extra'{$value.extra=$true};'shift'{$value.deadlineAt++}}
 return [pscustomobject]@{ok=$true;closed=($script:fault -cne 'unclosed');text=($value|ConvertTo-Json -Compress)}
}
$CheckOnly=$true
if($null -ne (Read-FoundationPostcheckContinuation) -or $script:calledMode -cne 'CheckOnly' -or $script:module -cne 'scripts/n8n/foundation-live-project-verified-continuation.mjs'){throw 'NEW_READY_NOT_SELECTED'}
foreach($fault in @('old-kind','old-segment','string-bool','private-read','network','extra','unclosed')){$script:fault=$fault;$blocked=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$blocked=$true};if(-not $blocked){throw 'PUBLIC_CLOCK_SPOOF_ACCEPTED'}}
$script:fault='';$CheckOnly=$false;$proof=Read-FoundationPostcheckContinuation
if($script:calledMode -cne 'ReadClaimed' -or $proof.kind -cne 'clock_project_verified_continuation_admitted' -or $proof.startsAt -ne $admittedAt){throw 'NEW_CLAIMED_CLOCK_NOT_SELECTED'}
$postcheckContinuationStart=[DateTimeOffset]::FromUnixTimeMilliseconds($proof.startsAt).UtcDateTime
if((Get-FoundationLeaseFloor) -ne $postcheckContinuationStart.AddMinutes(75)){throw 'LEASE_FLOOR_CHANGED'}
$script:fault='shift';$blocked=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$blocked=$true};if(-not $blocked){throw 'SHIFTED_CLOCK_ACCEPTED'}
`);
  },
);

test(
  'project-verified approval missing exits3 before any later private metadata path',
  { skip: process.platform !== 'win32' },
  () => {
    const output = powershell(
      `
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation'])}
${clockContext}
$CheckOnly=$true
function Invoke-Bounded {
 $value=${readyDto};$value.kind='project_verified_continuation_approval_required';$value.status='approval_required';$value.approvalRequired=$true
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
  'project-verified wrapper stops at the public missing-approval branch before the database or private metadata helper',
  { skip: process.platform !== 'win32' },
  () => {
    const value = source(wrapper);
    const start = value.indexOf(' $remainingAuthorityReady=$true');
    const end = value.indexOf(' $bindings=ConvertFrom-Json', start);
    assert.ok(start > 0 && end > start, 'public wrapper approval gate missing');
    const output = powershell(`
$ResumeZeroSetup=$false;$ClockAmendment=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$ProjectVerifiedContinuation=$true;$StartupReplacement=$false;$CheckOnly=$true;$admittedClockMode=$true;$node='synthetic-never-spawned.exe';$repo='C:\\__emr_synthetic_never_accessed';$resumeDeadlineAt=$null;$seal=[pscustomobject]@{windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'}
function Invoke-ClockAmendmentPublic {return [pscustomobject]@{kind='project_verified_continuation_approval_required'}}
function Invoke-PublicDatabaseCheck {Write-Output 'PRIVATE_DATABASE_METADATA_HELPER_REACHED';throw 'PRIVATE_DATABASE_METADATA_HELPER_REACHED'}
${value.slice(start, end)}
throw 'PUBLIC_APPROVAL_GATE_DID_NOT_EXIT'
`);
    const dto = JSON.parse(output);
    assert.equal(dto.status, 'project_verified_continuation_approval_required');
    assert.equal(dto.segmentId, segment);
    assert.equal(dto.approvalRequired, true);
    assert.equal(dto.privateRead, false);
    assert.equal(dto.networkRequests, 0);
    assert.equal(dto.adminPublicInputsVerified, false);
    assert.equal(dto.adminHandoffReady, false);
  },
);

test(
  'project-verified native dispatcher admits query only and refuses migration or advisor children',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Invoke-Cli'])}
$ProjectVerifiedContinuation=$true;$StartupReplacement=$false;$RemainingContinuation=$false;$PostcheckContinuation=$true;$leaseExpires=[DateTime]::UtcNow.AddHours(1);$phaseAControlHardDeadline=$null;$script:children=0
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
  'project-verified native ancestry binds its own admission and claim to the actual bounded kernel chain',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Assert-Keys', 'Read-FoundationKernelProcess', 'Resolve-FoundationProjectVerifiedTechnicalPaths', 'Assert-FoundationProjectVerifiedContinuationProcessAncestry'])}
$ProjectVerifiedContinuation=$true;$StartupReplacement=$false;$RemainingContinuation=$false;$CheckOnly=$false;$repo='C:\\__emr_synthetic_never_accessed';$env:LOCALAPPDATA=$repo
$now=[DateTimeOffset]::UtcNow;$start=$now.AddMinutes(-1);$claimed=$now.AddSeconds(-45);$script:fault=''
$clock=[pscustomobject]@{segmentId='${segment}';startsAt=$start.ToUnixTimeMilliseconds();stopNewAt=$start.AddMinutes(50).ToUnixTimeMilliseconds()}
function Assert-Path($Root,$Relative){
 if($Relative -notin @('scripts/n8n/out/foundation/live/project-verified-continuation-${segment}.json','scripts/n8n/out/foundation/live/project-verified-continuation-${segment}.runtime-claim.json','Temp/emr-m03-acceptance-parent.operation.lock')){throw 'UNEXPECTED_CUSTODY_PATH'}
 return Join-Path $Root $Relative
}
function File-Hash {return 'synthetic-fixed-admission-hash'}
function Read-Json($Path){
 if($Path.EndsWith('.runtime-claim.json')){$value=[pscustomobject]@{kind='m03_project_verified_continuation_runtime_claim';version=1;segmentId=$clock.segmentId;admissionSha256='synthetic-fixed-admission-hash';processId=90001;parentProcessId=90002;claimedAt=$claimed.ToUnixTimeMilliseconds()};switch($script:fault){'old-claim'{$value.kind='m03_remaining_continuation_runtime_claim'};'wrong-hash'{$value.admissionSha256='different'};'future-claim'{$value.claimedAt=$now.AddMinutes(1).ToUnixTimeMilliseconds()}};return $value}
 $value=[pscustomobject]@{kind='m03_project_verified_continuation_admission';segmentId=$clock.segmentId;startsAt=$clock.startsAt;parentProcessId=90002};if($script:fault -ceq 'old-admission'){$value.kind='m03_remaining_continuation_admission'};return $value
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
if((Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock) -ne $true){throw 'VALID_CHAIN_REFUSED'}
$script:fault='same-ms-runtime';if((Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock) -ne $true){throw 'SAME_MILLISECOND_CHAIN_REFUSED'}
foreach($fault in @('old-claim','old-admission','old-parent','wrong-hash','future-claim','separate-admin','wrong-runtime-parent','reused-runtime','reused-wrapper','dead-runtime')){$script:fault=$fault;$blocked=$false;try{$null=Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock}catch{$blocked=$true};if(-not $blocked){throw 'UNOWNED_CHAIN_ACCEPTED'}}
`);
    const value = source(consumer);
    assert.ok(
      value.lastIndexOf('Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock') <
        value.indexOf('$consumed = $true'),
    );
  },
);

test(
  'project-verified vacancy requires fresh14 and all six globally vacant control tables and four prior intent fences',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Assert-FoundationContinuationVacant'], control)}
${definitions(['Assert-Keys'])}
$ProjectVerifiedContinuation=$true;$StartupReplacement=$false;$RemainingContinuation=$false;$repo='C:\\__emr_synthetic_never_accessed';$queryFile='synthetic-history.sql';$queryTimeoutMs=1;$continuationOutputStem='m03-foundation-project-verified-continuation-';$postcheckContinuationSegment='${segment}';$script:history=0;$script:sql='';$script:intent='';$script:historyState='complete'
function Invoke-Cli($Arguments,$Timeout){$script:history++;if(($Arguments -join ' ') -cne 'db query --file synthetic-history.sql'){throw 'UNEXPECTED_CLI'};return [pscustomobject]@{text='synthetic'}}
function History-State {return $script:historyState}
function Invoke-FoundationQuery($Sql,$Field){$script:sql=$Sql;return [pscustomobject]@{windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';windows=0;approvals=0;launches=0;requests=0;bindings=0;leases=0}}
function Test-Path {param($LiteralPath) return $script:intent -ne '' -and $LiteralPath.EndsWith($script:intent)}
Assert-FoundationContinuationVacant -RefreshHistory
if($script:history -ne 1 -or $script:sql.Contains(' where window_id=') -or [regex]::Matches($script:sql,'select count\\(\\*\\)').Count -ne 6){throw 'GLOBAL_HISTORY_VACANCY_NOT_ENFORCED'}
foreach($name in @('m03-foundation-owner-provision-attempt.json','m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json','m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-owner-provision-attempt.json','m03-foundation-startup-replacement-${previous}-owner-provision-attempt.json','m03-foundation-project-verified-continuation-${segment}-owner-provision-attempt.json')){$script:intent=$name;$blocked=$false;try{Assert-FoundationContinuationVacant}catch{$blocked=$true};if(-not $blocked){throw 'PRIOR_INTENT_ACCEPTED'}}
$script:intent='';$script:historyState='baseline';$blocked=$false;try{Assert-FoundationContinuationVacant -RefreshHistory}catch{$blocked=$true};if(-not $blocked){throw 'LESS_THAN14_HISTORY_ACCEPTED'}
`);
  },
);

test(
  'project-verified reactivation records its own once intent after fresh14 and caches only exact audited readback on a lost ACK',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Reactivate-FoundationProjectVerifiedContinuationFixture'], control)}
$ProjectVerifiedContinuation=$true;$RemainingContinuation=$false;$script:projectVerifiedTechnicalOrdinal=2;$phaseAStart=[DateTime]::UtcNow;$out='C:\\__emr_synthetic_never_accessed';$runId='synthetic';$continuationOutputStem='m03-foundation-project-verified-continuation-';$postcheckContinuationSegment='${segment}';$receipt=[ordered]@{};$script:remainingOwnedFixture=$null;$script:intent=0;$script:mutations=0;$script:readbackFails=$false;$script:history=0;$script:archived=0
function Assert-FoundationContinuationVacant {param([switch]$RefreshHistory) if(-not $RefreshHistory){throw 'FRESH14_REQUIRED'};$script:history++}
function Assert-FoundationRemainingArchivedFixture {$script:archived++;return 'synthetic-verified'}
function Write-NewJson($Path,$Value){if($script:intent -ne 0){throw 'ONCE_ONLY'};if($script:history -ne 1 -or $script:archived -ne 1 -or -not $Path.EndsWith('m03-foundation-project-verified-continuation-${segment}-technical-2-reactivation-attempt.json') -or $Value.segmentId -cne '${segment}' -or $Value.competitorId -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa' -or $Value.accountId -cne 'bd23314c-591f-4fb7-92fd-b7450634eeb6'){throw 'WRONG_REACTIVATION_INTENT'};$script:intent++}
function Foundation-FixtureSql($Name){if($Name -cne 'm03_smoke_reactivate_project_verified.sql'){throw 'WRONG_SQL'};return 'synthetic-reactivation'}
function Invoke-FoundationMutation($Sql){if($script:intent -ne 1){throw 'NO_INTENT'};$script:mutations++;return [ordered]@{childrenClosed=$true;acknowledged=$false}}
function Read-FoundationProjectVerifiedContinuationReactivatedFixture {if($script:readbackFails){throw 'UNKNOWN_READBACK'};return [pscustomobject]@{result='M03_SMOKE_FIXTURE_READY';company_code='C999';competitor_id='d51a39f6-fe87-4d17-aee9-3070c45693aa';account_id='bd23314c-591f-4fb7-92fd-b7450634eeb6';platform='website_work_page';url='https://everyone.film/about-everyone';competitor_status='active';account_status='active'}}
$blocked=$false;try{Reactivate-FoundationProjectVerifiedContinuationFixture}catch{$blocked=$true}
if(-not $blocked -or $script:mutations -ne 1 -or $null -eq $script:remainingOwnedFixture -or $receipt.reactivationState -cne 'committed_after_unknown_ack'){throw 'OWNED_UNKNOWN_ACK_NOT_CACHED'}
try{Reactivate-FoundationProjectVerifiedContinuationFixture}catch{};if($script:mutations -ne 1){throw 'REACTIVATION_REPLAYED'}
$script:intent=0;$script:remainingOwnedFixture=$null;$script:readbackFails=$true;$script:history=0;$script:archived=0
try{Reactivate-FoundationProjectVerifiedContinuationFixture}catch{}
if($null -ne $script:remainingOwnedFixture -or $receipt.reactivationState -cne 'unknown'){throw 'UNKNOWN_STATE_ADOPTED'}
`);
  },
);

test(
  'project-verified readback requires its exact audit actor, segment and retained fixture IDs',
  { skip: process.platform !== 'win32' },
  () => {
    powershell(`
${definitions(['Read-FoundationProjectVerifiedContinuationReactivatedFixture', 'Assert-FoundationContinuationFixture'], control)}
${definitions(['Assert-Keys'])}
$ProjectVerifiedContinuation=$true;$script:projectVerifiedTechnicalOrdinal=2;$script:foreign=$false
function Invoke-FoundationQuery($Sql,$Field){
 if($Field -cne 'fixture' -or -not $Sql.Contains("l.actor_id='m03_smoke_reactivate.v1:${segment}:technical-2'") -or -not $Sql.Contains("l.after->>'segment_id'='${segment}:technical-2'") -or $Sql.Contains('${previous}') -or -not $Sql.Contains("o.action='m03_smoke_fixture_created'")){throw 'WRONG_REACTIVATION_AUDIT'}
 return [pscustomobject]@{result='M03_SMOKE_FIXTURE_READY';company_code='C999';competitor_id=$(if($script:foreign){'90000000-0000-4000-8000-000000000001'}else{'d51a39f6-fe87-4d17-aee9-3070c45693aa'});account_id='bd23314c-591f-4fb7-92fd-b7450634eeb6';platform='website_work_page';url='https://everyone.film/about-everyone';competitor_status='active';account_status='active'}
}
$value=Read-FoundationProjectVerifiedContinuationReactivatedFixture
if($value.competitor_id -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa'){throw 'OWNED_FIXTURE_REFUSED'}
$script:foreign=$true;$blocked=$false;try{$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture}catch{$blocked=$true};if(-not $blocked){throw 'FOREIGN_FIXTURE_ADOPTED'}
`);
  },
);

test(
  'project-verified wrapper cannot Admit with absent runtime delivery, short lease or invalid Machine provenance',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-project-verified-admission-gates-'));
    const delivery = join(directory, 'synthetic-public-delivery.json');
    const admin = join(directory, 'synthetic-public-admin-metadata.json');
    const oldAdmin = join(directory, 'synthetic-old-purpose-admin-metadata.json');
    const shortAdmin = join(directory, 'synthetic-short-admin-metadata.json');
    const now = new Date();
    const head = 'f42930f90c2de43c84f61ad6d966d0ee6074d70e';
    writeFileSync(delivery, JSON.stringify({ audience: 'synthetic-audience', sourceCommitSha: head }));
    writeFileSync(
      admin,
      JSON.stringify({
        version: 1,
        environment: 'dev',
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        purpose: 'm03-foundation-project-verified-continuation-dev:20275b22-b7fe-4737-a9a4-c50c2feadb74',
        approvalSha: head,
        createdAt: now.toISOString().replace('Z', '0000Z'),
        expiresAt: new Date(now.getTime() + 7200000).toISOString().replace('Z', '0000Z'),
      }),
    );
    const adminMetadata = JSON.parse(readFileSync(admin, 'utf8'));
    writeFileSync(oldAdmin, JSON.stringify({ ...adminMetadata, purpose: 'm03-foundation-phase-a-dev' }));
    writeFileSync(
      shortAdmin,
      JSON.stringify({
        ...adminMetadata,
        createdAt: new Date(now.getTime() - 3600000).toISOString().replace('Z', '0000Z'),
        expiresAt: new Date(now.getTime() + 3600000).toISOString().replace('Z', '0000Z'),
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
$node='synthetic-never-spawned';$ResumeZeroSetup=$false;$ClockAmendment=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$ProjectVerifiedContinuation=$true;$StartupReplacement=$false;$admittedClockMode=$true;$resumeDeadlineAt=$null;$lock=$null;$script:admissions=0;$script:fault=''
function Public-File($Path,$Maximum=0){
 if($Path.EndsWith('foundation-delivery-packet.json')){return ${quote(delivery)}}
 if($Path.EndsWith('emr-m03-foundation-dev-migration-password.lease.json')){if($script:fault -ceq 'old-admin-purpose'){return ${quote(oldAdmin)}};if($script:fault -ceq 'short-admin-lease'){return ${quote(shortAdmin)}};return ${quote(admin)}}
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
function Invoke-ClockAmendmentPublic($Node,$Repository,$Mode,$PostcheckClock,$RemainingClock,$StartupClock,$ProjectClock){
 if($Mode -cne 'Admit' -or -not $ProjectClock -or $StartupClock -or $RemainingClock -or $PostcheckClock){throw 'WRONG_ADMISSION_MODE'}
 $script:admissions++;$start=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 return [pscustomobject]@{startsAt=$start;deadlineAt=$start+3600000}
}
function Plain-Dpapi {throw 'DPAPI_MUST_NOT_BE_REACHED'}
function Initialize-M03AcceptanceDevCredentials { }
foreach($fault in @('missing-runtime','short-lease','machine-provenance','old-admin-purpose','short-admin-lease')){
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
      removeOwnedTemporary(directory);
    }
  },
);
