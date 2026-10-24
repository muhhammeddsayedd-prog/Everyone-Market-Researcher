import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  realpathSync,
  copyFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep, dirname } from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { syntheticProjectVerifiedContinuation } from '../n8n/foundation-live-project-verified-fixtures.mjs';

const consumer = resolve('scripts/db/windows/Invoke-M03FoundationMigrations.ps1');
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const definitions = (names, file = consumer) => `
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(file)},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'PUBLIC_SOURCE_PARSE_FAILED'}
foreach($name in @(${[...new Set([...(file.endsWith('Foundation-AdminControl.ps1') ? ['Foundation-ForwardWindowId'] : []), ...names])].map(quote).join(',')})){
 $functions=@($ast.FindAll({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true))
 if($functions.Count -ne 1){throw 'EXPECTED_FUNCTION_MISSING'};Invoke-Expression $functions[0].Extent.Text
}`;
function run(code) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-forward-ps-'));
  try {
    const file = join(directory, 'synthetic.ps1');
    writeFileSync(file, `$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n${code}\nexit 0\n`);
    const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', file], {
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((name) =>
          process.env[name] === undefined ? [] : [[name, process.env[name]]],
        ),
      ),
      windowsHide: true,
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, '');
    return result.stdout.trim();
  } finally {
    const absolute = resolve(directory);
    assert.ok(absolute.startsWith(resolve(tmpdir()) + sep));
    assert.equal(realpathSync.native(absolute).toLowerCase(), absolute.toLowerCase());
    rmSync(absolute, { recursive: true });
  }
}
const native = { skip: process.platform !== 'win32' };

test('forward mode admits exact14/15 history only and preserves old hash comparisons', native, () => {
  const old = JSON.parse(readFileSync('scripts/db/m03-foundation-dev-migration-packet.json', 'utf8'));
  const migration = {
    version: '20261023163755',
    name: 'm03_foundation_window_continuation',
    historySha256: 'f'.repeat(64),
  };
  const all = [...old.baseline, ...old.pending, migration].map(({ version, name, historySha256 }) => ({
    version,
    name,
    historySha256,
  }));
  const output = run(`
${definitions(['Assert-Keys', 'History-State'])}
$ForwardMigration=$true;$migrations=ConvertFrom-Json ${quote(JSON.stringify(all))}
function Result($Count){$list=@($migrations|Select-Object -First $Count);return [pscustomobject]@{ok=$true;closed=$true;text=(ConvertTo-Json -InputObject @([pscustomobject]@{receipt=[pscustomobject]@{current_user='postgres';session_user='postgres';database='postgres';migrations=$list}}) -Depth 12 -Compress)}}
if((History-State (Result 14)) -cne 'baseline' -or (History-State (Result 15)) -cne 'complete' -or (History-State (Result 10)) -cne 'rejected'){throw 'FORWARD_HISTORY_COUNT_FAILED'}
$bad=Result 15;$rows=ConvertFrom-Json $bad.text;$rows[0].receipt.migrations[3].historySha256='0'*64;$bad.text=ConvertTo-Json -InputObject @($rows) -Depth 12 -Compress
if((History-State $bad) -cne 'rejected'){throw 'OLD_HISTORY_HASH_DRIFT_ACCEPTED'}
$bad=Result 15;$bad.text=$bad.text.Replace('"session_user":"postgres"','"session_user":"n8n_writer"')
if((History-State $bad) -cne 'rejected'){throw 'WRONG_LOGIN_ACCEPTED'}
Write-Output 'EXACT_FORWARD_HISTORY'
`);
  assert.equal(output, 'EXACT_FORWARD_HISTORY');
});

test(
  'technical13 public closure permits four ledger tails without inventing a historical runtime count',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Path', 'Read-Json', 'File-Hash', 'Read-FoundationTechnical13Closed'])}
$repo=$PSScriptRoot;$projectRef='zmotjsbzhzjvpelxvxlf'
function Write-PublicFixture([string]$Relative,[string]$Text){$path=Join-Path $repo $Relative;$null=[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path));[IO.File]::WriteAllText($path,$Text);return $path}
function Hash-PublicText([string]$Text){$digest=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant()}finally{$digest.Dispose()}}
$pins=[ordered]@{};$prefix='{"event":"synthetic_prefix"}'+"\`n";$tail='{"event":"synthetic_tail"}'+"\`n"
foreach($name in @('management','control','setup','preflight')){$relative='scripts/n8n/out/foundation/live/'+$name+'.jsonl';$null=Write-PublicFixture $relative ($prefix+$tail);$pins[$relative]=Hash-PublicText $prefix}
$historical='scripts/n8n/out/foundation/live/runtime.jsonl';$null=Write-PublicFixture $historical $prefix;$pins[$historical]=Hash-PublicText $prefix
$technical='scripts/n8n/out/foundation/live/runtime.technical-13.jsonl';$null=Write-PublicFixture $technical $prefix;$pins[$technical]=Hash-PublicText $prefix
$actual=[ordered]@{kind='m03_technical13_runtime_setup_reconciliation';environment='dev';projectRef=$projectRef;attempt=@{technicalAttempt=13;windowId='3c46c791-e140-4eb9-890a-eecfa251f65e';actorStarts=0;nativeExecutions=0};source=@{applicationSource='7b1837201ac7925591577a1517d7288936ca3464'};journalCounts=@{management=1;control=1;setup=1;preflight=1;runtimeTechnical13=1};pins=$pins}
$script:syntheticReceiptPath=Write-PublicFixture 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json' ($actual|ConvertTo-Json -Depth 8 -Compress)
# Only the synthetic receipt's immutable pin is stubbed; every ledger uses its actual bytes.
function File-Hash([string]$File){if($File -ceq $script:syntheticReceiptPath){return '226ed15257e8fb5ac2c81f454631bcf11773f67ce9fdc15d6048184389260983'};return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
function Get-CimInstance($ClassName,$Filter,$Property,$ErrorAction){return @()}
$closed=@{childClosed=$true;credentialChildrenClosed=$true;emergencyShutdown=$false;nativeExit=1;parentProcessId=910001;runtimeProcessId=910002}
$null=Write-PublicFixture 'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-13.closed.json' ($closed|ConvertTo-Json -Compress)
$restored=@{kind='m03_technical13_runtime_restoration';version=1;environment='dev';projectRef=$projectRef;windowId=$actual.attempt.windowId;sourceCommitSha=$actual.source.applicationSource;status='restoration_verified';nativeExit=0;executionCount=0;actorStarts=0;childClosed=$true;credentialChildrenClosed=$true;baselineRestored=$true;machineRestored=$true;remoteWorkSettled=$true;originalAckUnknown=$true;mutationReplayAllowed=$false}
$null=Write-PublicFixture 'milestones/M03-n8n-foundation/evidence/runtime-restoration-20261024.json' ($restored|ConvertTo-Json -Compress)
$provision=@{windowId=$actual.attempt.windowId;packet=@{audience='https://everyone-market-researcher-7fcbxykan-muhammed-abdelrahman.vercel.app';commitSha=$actual.source.applicationSource;deploymentId='dpl_4hzfdXHd2F9B2Q89RiK2wVftzg25'}}
$null=Write-PublicFixture 'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-13-owner-provision-attempt.json' ($provision|ConvertTo-Json -Depth 4 -Compress)
if($actual.journalCounts.ContainsKey('runtime')){throw 'SYNTHETIC_SHAPE_HAS_INVENTED_COUNT'}
$functionSource=(Get-Item Function:Read-FoundationTechnical13Closed).ScriptBlock.ToString()
$oldSource=$functionSource.Replace('(management|control|setup|preflight)\\.jsonl$','(management|control|setup|preflight|runtime)\\.jsonl$')
if($oldSource -ceq $functionSource){throw 'EXPECTED_FIXED_PREFIX_NOT_FOUND'}
Set-Item Function:Read-FoundationTechnical13ClosedOld ([scriptblock]::Create($oldSource))
$oldFailed=$false;try{$null=Read-FoundationTechnical13ClosedOld}catch{$oldFailed=$_.FullyQualifiedErrorId -ceq 'PropertyNotFoundStrict'}
if(-not $oldFailed){throw 'OLD_RUNTIME_COUNT_DEFECT_NOT_REPRODUCED'}
$binding=Read-FoundationTechnical13Closed;if($binding.id -cne $actual.attempt.windowId){throw 'FIXED_PUBLIC_BINDING_REJECTED'}
$null=Write-PublicFixture $historical ($prefix+$tail)
$denied=$false;try{$null=Read-FoundationTechnical13Closed}catch{$denied=$true};if(-not $denied){throw 'HISTORICAL_RUNTIME_TAIL_ACCEPTED'}
$null=Write-PublicFixture $historical $prefix
foreach($name in @('management','control','setup','preflight')){
 $relative='scripts/n8n/out/foundation/live/'+$name+'.jsonl';$null=Write-PublicFixture $relative ('{"event":"changed_prefix"}'+"\`n"+$tail)
 $denied=$false;try{$null=Read-FoundationTechnical13Closed}catch{$denied=$true};if(-not $denied){throw 'CHANGED_LEDGER_PREFIX_ACCEPTED'}
 $null=Write-PublicFixture $relative ($prefix+$tail)
}
$null=Read-FoundationTechnical13Closed
Write-Output 'FOUR_APPENDABLE_PREFIXES_AND_EXACT_HISTORICAL_RUNTIME'
`),
      'FOUR_APPENDABLE_PREFIXES_AND_EXACT_HISTORICAL_RUNTIME',
    );
  },
);

test(
  'technical13 archive inspection validates exact native JSON types and closed binding without accepting status claims',
  native,
  () => {
    const window = {
      id: '3c46c791-e140-4eb9-890a-eecfa251f65e',
      audience: 'https://everyone-market-researcher-7fcbxykan-muhammed-abdelrahman.vercel.app',
      commitSha: '7b1837201ac7925591577a1517d7288936ca3464',
      deploymentId: 'dpl_4hzfdXHd2F9B2Q89RiK2wVftzg25',
      startsAt: '2026-10-24T08:00:00Z',
      expiresAt: '2026-10-24T09:00:00Z',
      closedAt: '2026-10-24T10:00:00Z',
      admittedCount: 2,
      closeCount: 1,
    };
    const value = {
      kind: 'm03_foundation_inspection',
      windowId: window.id,
      identity: true,
      window,
      requestCount: 1,
      reservedRequests: 0,
      incompleteRequests: 0,
      activeLeaseCount: 0,
      approval: {
        closed: true,
        expiresAt: '2026-10-24T09:00:00Z',
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
      familyClosed: true,
      fixtureAuditCount: 6,
      technical12Exact: true,
      technical13Exact: true,
    };
    const result = run(`
${definitions(['Assert-Keys', 'Read-FoundationInspection', 'Assert-FoundationArchiveInspection'])}
$TechnicalResidual13=$true;$original=ConvertFrom-Json ${quote(JSON.stringify(value))};$expected=$original.window
function Check($Value,[bool]$Archived=$false){$result=[pscustomobject]@{ok=$true;closed=$true;text=('[{"inspection":'+($Value|ConvertTo-Json -Compress -Depth 12)+'}]')};$checked=Read-FoundationInspection $result;Assert-FoundationArchiveInspection $checked $expected $Archived}
Check $original
foreach($fault in @('flagString','countString','requestString','false12','false13','extra','wrongWindow','progress','open','wrongDate','costString')){
 $value=$original|ConvertTo-Json -Depth 12|ConvertFrom-Json
 switch($fault){
  'flagString'{$value.familyClosed='true'} 'countString'{$value.fixtureAuditCount='6'} 'requestString'{$value.requestCount='1'}
  'false12'{$value.technical12Exact=$false} 'false13'{$value.technical13Exact=$false} 'extra'{$value|Add-Member NoteProperty unexpected $true}
  'wrongWindow'{$value.window.id='eda4fae1-1e19-47db-81b8-beac1a4ed883'} 'progress'{$value.fixture.progressPresent=$true}
  'open'{$value.window.closedAt=$null} 'wrongDate'{$value.window.closedAt='2026-10-24T07:00:00Z'} 'costString'{$value.costUsd='0'}
 }
 $blocked=$false;try{Check $value}catch{$blocked=$true};if(-not $blocked){throw ('ARCHIVE_DTO_ACCEPTED_'+$fault)}
}
$after=$original|ConvertTo-Json -Depth 12|ConvertFrom-Json;$after.fixture.competitorArchived=$true;$after.fixture.competitorActive=$false;$after.fixture.accountPaused=$true;$after.fixture.accountActive=$false
Check $after $true
Write-Output 'TECHNICAL13_ARCHIVE_TYPED_JSON'
`);
    assert.equal(result, 'TECHNICAL13_ARCHIVE_TYPED_JSON');
  },
);

test('one pending migration and seeds/roles exclusion use actual native structured contract', native, () => {
  assert.equal(
    run(`
${definitions(['Assert-Keys', 'Push-Check'])}
$packet=[pscustomobject]@{pending=@([pscustomobject]@{file='supabase/migrations/20261023163755_m03_foundation_window_continuation.sql'})}
$value=[pscustomobject]@{upToDate=$false;dryRun=$true;migrations=@('20261023163755_m03_foundation_window_continuation.sql');seeds=@();roles=@();message='Finished supabase db push.'}
$result=[pscustomobject]@{started=$true;closed=$true;nativeExit=0;ok=$true;text=ConvertTo-Json $value -Compress}
if((Push-Check $result $true) -cne 'matched'){throw 'EXACT_SINGLE_MIGRATION_REJECTED'}
$value.migrations+=@('20261018233338_m03_foundation_boundary_hardening.sql');$result.text=ConvertTo-Json $value -Compress
if((Push-Check $result $true) -cne 'pending_mismatch'){throw 'REPLAY_SET_ACCEPTED'}
$value.migrations=@('20261023163755_m03_foundation_window_continuation.sql');$value.seeds=@('seed.sql');$result.text=ConvertTo-Json $value -Compress
if((Push-Check $result $true) -cne 'invalid_shape'){throw 'SEED_ACCEPTED'}
$result.nativeExit=1;$result.text='synthetic-sensitive-canary'
if((Push-Check $result $true) -cne 'native_failure'){throw 'NATIVE_FAILURE_RECLASSIFIED'}
Write-Output 'SINGLE_NATIVE_CONTRACT'
`),
    'SINGLE_NATIVE_CONTRACT',
  );
});

test(
  'fixed forward CLI dispatcher rejects arbitrary SQL, reset, fixture controls and seed flags',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Invoke-Cli'])}
$ForwardMigration=$true;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false;$InspectOnly=$false;$WriterClose=$false;$ArchiveFixture=$false
$leaseExpires=[DateTime]::UtcNow.AddMinutes(10);$phaseAControlHardDeadline=$null;$queryFile='history.sql';$inspectQueryFile='inspect.sql';$forwardCheckFile='catalog.sql';$forwardFamilyFile='family.sql'
$scratch='synthetic';$cliPath='never-spawned';$dbUri='password-free';$password='synthetic-only';$receipt=[ordered]@{childrenClosed=$true};$script:calls=@()
function Invoke-Bounded($Executable,$Arguments,$WorkingDirectory,$TimeoutMs,$PrivatePassword){$script:calls+=,@($Arguments);return [pscustomobject]@{ok=$true;closed=$true;nativeExit=0;text='{}'}}
$null=Invoke-Cli @('db','push','--dry-run','--skip-vault') 1000;$null=Invoke-Cli @('db','push','--skip-vault','--yes') 1000;$null=Invoke-Cli @('db','query','--file','history.sql') 1000
foreach($args in @(@('db','query','--file','arbitrary.sql'),@('db','push','--include-seed'),@('db','reset'),@('db','query','--sql','select ops.foundation_gateway_provision(null)'))){$denied=$false;try{$null=Invoke-Cli $args 1000}catch{$denied=$true};if(-not $denied){throw 'UNREVIEWED_FORWARD_COMMAND_ALLOWED'}}
if($script:calls.Count -ne 3 -or ($script:calls[0] -join '|') -match '--output\\|json' -or ($script:calls[2] -join '|') -notmatch '--output\\|json'){throw 'NATIVE_FORMATTER_CONTRACT_FAILED'}
Write-Output 'FIXED_FORWARD_DISPATCH'
`),
      'FIXED_FORWARD_DISPATCH',
    );
  },
);

test(
  'fresh registered-window protocol provisions while archived, then reactivates, then verifies restricted closure',
  native,
  () => {
    const code = `
${definitions(['Assert-Keys'])}
${definitions(['Invoke-FoundationAdminControl'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$StartupReplacement=$false;$RemainingContinuation=$false;$PostcheckContinuation=$true;$ClockAmendment=$false
$phaseAStart=[DateTime]::UtcNow;$runId='synthetic';$projectRef='zmotjsbzhzjvpelxvxlf';$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$continuationOutputStem='m03-foundation-project-verified-continuation-';$out='synthetic';$receipt=[ordered]@{phaseACommands=0;phaseAClosed=$false}
$script:events=[Collections.Generic.List[string]]::new();$script:commands=[Collections.Generic.Queue[object]]::new()
foreach($kind in @('postcheck','provision','fixture','close','end')){$value=[pscustomobject]@{};if($kind -ceq 'provision'){$value=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic.vercel.app';commitSha='a5e746736893d5040e93032ae740a0878f748837';deploymentId='dpl_Synthetic'}};$script:commands.Enqueue([pscustomobject]@{id=[Guid]::NewGuid().ToString();kind=$kind;args=$value})}
function Read-FoundationCommand($Deadline){return $script:commands.Dequeue()}
function Assert-FoundationContinuationVacant{$script:events.Add('state:'+([string]$script:forwardWindowPrepared))}
function Assert-FoundationRemainingArchivedFixture{$script:events.Add('archived');return [pscustomobject]@{}}
function Assert-FoundationRemainingPriorPostcheck{throw 'OLD14_POSTCHECK_REUSED'}
function Invoke-FoundationPostcheck{$script:events.Add('postcheck15');return [pscustomobject]@{migrationCount=15;ready=$true}}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{outputSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-3'}}
function Write-NewJson($Path,$Value){if($Value.windowId -cne '38b3708d-61b0-41d2-8170-5ed91c66b4dc'){throw 'OLD_WINDOW_INTENT'};$script:events.Add('intent')}
function Foundation-Json($Value){return "'{}'::jsonb"}
function Invoke-FoundationMutation($Sql){if($Sql -cne "select ops.foundation_gateway_provision('38b3708d-61b0-41d2-8170-5ed91c66b4dc'::uuid,'{}'::jsonb);"){throw 'WRONG_OWNER_OVERLOAD'};$script:events.Add('register');return [pscustomobject]@{childrenClosed=$true;acknowledged=$true}}
function Invoke-FoundationQuery($Sql,$Field){if($Field -cne 'provision' -or -not $Sql.Contains("window_id='38b3708d-61b0-41d2-8170-5ed91c66b4dc'")){throw 'WRONG_PROVISION_READBACK'};return [pscustomobject]@{windowId='38b3708d-61b0-41d2-8170-5ed91c66b4dc';started=$false;closed=$false;totalAdmitted=0;approvalCount=1;boundAudience='https://everyone-market-researcher-synthetic.vercel.app';boundCommitSha='a5e746736893d5040e93032ae740a0878f748837';boundDeploymentId='dpl_Synthetic'}}
function Assert-FoundationForwardWindowState($Prepared){if(-not $Prepared -or $script:forwardWindowBinding.commitSha -cne 'a5e746736893d5040e93032ae740a0878f748837'){throw 'PREPARED_BINDING_MISSING'};$script:events.Add('prepared')}
function Reactivate-FoundationProjectVerifiedContinuationFixture{if(-not $script:forwardWindowPrepared){throw 'FIXTURE_BEFORE_REGISTRATION'};$script:events.Add('reactivate');return [pscustomobject]@{competitor_id='synthetic';account_id='synthetic'}}
function Assert-FoundationContinuationFixture($Value){}
function Close-FoundationOwnedWindow($Binding){$script:events.Add('readonly-close-proof');return [pscustomobject]@{state='closed';window=[pscustomobject]@{id='38b3708d-61b0-41d2-8170-5ed91c66b4dc';closed=$true}}}
Invoke-FoundationAdminControl
if(-not $receipt.phaseAClosed -or ($script:events -join '|') -notmatch 'intent\\|register\\|prepared\\|reactivate\\|readonly-close-proof'){throw 'FRESH_LIFECYCLE_ORDER_WRONG'}
Write-Output 'FRESH_REGISTER_BEFORE_REACTIVATE'
`;
    const latest = code
      .replace(
        '$ForwardWindow=$true;',
        "$projectVerifiedForwardWindowId='eda4fae1-1e19-47db-81b8-beac1a4ed883';$projectVerifiedForwardSource='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803';$ForwardWindow=$true;",
      )
      .replaceAll('38b3708d-61b0-41d2-8170-5ed91c66b4dc', 'eda4fae1-1e19-47db-81b8-beac1a4ed883')
      .replaceAll('a5e746736893d5040e93032ae740a0878f748837', 'aff94f2b2d8055cf93b5405e6b11d4e7d9c86803');
    for (const valid of [code, latest]) {
      assert.equal(run(valid).split('\n').at(-1), 'FRESH_REGISTER_BEFORE_REACTIVATE');
    }
    for (const source of ['a5e746736893d5040e93032ae740a0878f748837', 'f'.repeat(40)]) {
      const wrongSource = latest
        .replace("commitSha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803'", `commitSha='${source}'`)
        .replace(
          'Invoke-FoundationAdminControl\nif(',
          "try{Invoke-FoundationAdminControl;throw 'WRONG_SOURCE_ACCEPTED'}catch{if($_.Exception.Message -cne 'blocked' -or $script:events.Contains('intent') -or $script:events.Contains('register')){throw 'WRONG_SOURCE_MUTATED'}}\nreturn\nif(",
        );
      assert.doesNotThrow(() => run(wrongSource));
    }
    const wrongPair = latest
      .replace(
        "$projectVerifiedForwardSource='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803'",
        "$projectVerifiedForwardSource='a5e746736893d5040e93032ae740a0878f748837'",
      )
      .replace(
        'Invoke-FoundationAdminControl\nif(',
        "try{Invoke-FoundationAdminControl;throw 'WRONG_PAIR_ACCEPTED'}catch{if($_.Exception.Message -cne 'blocked' -or $script:events.Count -ne 0){throw 'WRONG_PAIR_MUTATED'}}\nreturn\nif(",
      );
    assert.doesNotThrow(() => run(wrongPair));
    const premature = code
      .replace("@('postcheck','provision','fixture','close','end')", "@('postcheck','fixture','end')")
      .replace(
        'Invoke-FoundationAdminControl\nif(',
        "try{Invoke-FoundationAdminControl;throw 'EARLY_FIXTURE_ACCEPTED'}catch{if($script:events.Contains('intent') -or $script:events.Contains('reactivate')){throw 'EARLY_FIXTURE_MUTATED'}}\nreturn\nif(",
      );
    assert.doesNotThrow(() => run(premature));
  },
);

const flow = (history, intent, dry = 'matched', after = 'complete', push = true) =>
  run(`
${definitions(['Invoke-FoundationForwardMigration'])}
$repo='synthetic';$out='synthetic';$runId='synthetic';$projectRef='zmotjsbzhzjvpelxvxlf';$attemptFile='synthetic-intent';$queryFile='history.sql';$queryTimeoutMs=1000;$pushTimeoutMs=1000
$packet=[pscustomobject]@{pending=@([pscustomobject]@{version='20261023163755'})};$receipt=[ordered]@{historyBefore='${history}';historyAfter='not_checked';status='initial';dryRunNativeExit=$null;dryRunCheck='not_attempted';dryRunMatched=$false;pushAttempted=$false;pushNativeExit=$null};$script:exitCode=1;$script:commands=@();$script:intents=0;$script:baselines=0
function Test-Path($LiteralPath){return $${intent}}
function Assert-FoundationForwardBaseline{$script:baselines++}
function Write-NewJson($File,$Value){$script:intents++}
function Push-Check($Result,$DryRun){return '${dry}'}
function Push-Matches($Result,$DryRun){return $${push}}
function History-State($Result){if($script:commands.Count -eq 2){return 'baseline'};return '${after}'}
function Invoke-FoundationForwardPostcheck{return [ordered]@{ready=$true;migrationCount=15}}
function Invoke-Cli($Arguments,$Timeout){$script:commands+=,($Arguments -join '|');return [pscustomobject]@{ok=$true;closed=$true;nativeExit=$(if(($Arguments -join '|') -ceq 'db|push|--skip-vault|--yes' -and -not $${push}){1}else{0});text='synthetic-output'}}
Invoke-FoundationForwardMigration
Write-Output ([ordered]@{status=$receipt.status;exit=$script:exitCode;commands=$script:commands;intents=$script:intents;baselines=$script:baselines;push=$receipt.pushAttempted}|ConvertTo-Json -Compress)
`);

test(
  'forward acceptance catalog uses exact vacant-family proof while migration keeps its original catalog',
  native,
  () => {
    const file = resolve('scripts/db/foundation-forward-postcheck.sql');
    const source = readFileSync(file, 'utf8');
    const code = `
${definitions(['Assert-Keys', 'Invoke-FoundationForwardPostcheck'])}
${definitions([], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ForwardMigration=$false;$ProjectVerifiedContinuation=$true
$projectVerifiedForwardWindowId='eda4fae1-1e19-47db-81b8-beac1a4ed883';$projectVerifiedForwardSource='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803'
$forwardCheckFile=${quote(file)};$queryTimeoutMs=1000;$receipt=[ordered]@{};$script:vacancy=0;$script:captured=$null
function Assert-FoundationForwardWindowState($Prepared){if($Prepared){throw 'PREPARED_CATALOG_ALLOWED'};$script:vacancy++}
function Invoke-FoundationQuery($Sql,$Field){if($Field -cne 'postcheck'){throw 'WRONG_CATALOG_FIELD'};$script:captured=$Sql;throw 'CATALOG_CAPTURED'}
function Invoke-Cli($Arguments,$Timeout){if(($Arguments -join '|') -cne ('db|query|--file|'+$forwardCheckFile)){throw 'WRONG_CATALOG_COMMAND'};$script:captured=[IO.File]::ReadAllText($forwardCheckFile);throw 'CATALOG_CAPTURED'}
try{Invoke-FoundationForwardPostcheck;throw 'CAPTURE_NOT_REACHED'}catch{if($_.Exception.Message -cne 'CATALOG_CAPTURED'){throw}}
Write-Output ([ordered]@{vacancy=$script:vacancy;sql=$script:captured}|ConvertTo-Json -Compress)
`;
    const current = JSON.parse(run(code));
    assert.equal(current.vacancy, 1, 'ACCEPTANCE_RECHECKS_EXACT_VACANCY');
    assert.match(current.sql, /eda4fae1-1e19-47db-81b8-beac1a4ed883/);
    assert.match(current.sql, /38b3708d-61b0-41d2-8170-5ed91c66b4dc/);
    const fourth = JSON.parse(
      run(
        code
          .replaceAll('eda4fae1-1e19-47db-81b8-beac1a4ed883', '3c46c791-e140-4eb9-890a-eecfa251f65e')
          .replaceAll('aff94f2b2d8055cf93b5405e6b11d4e7d9c86803', '7b1837201ac7925591577a1517d7288936ca3464'),
      ),
    );
    assert.equal(fourth.vacancy, 1);
    assert.match(fourth.sql, /'no_new_window',\(select count\(\*\)=3/);
    for (const [window, admitted] of [
      ['df4f29ec-e2dc-4d82-a276-62a4e695e6f9', 2],
      ['38b3708d-61b0-41d2-8170-5ed91c66b4dc', 1],
      ['eda4fae1-1e19-47db-81b8-beac1a4ed883', 2],
    ])
      assert.ok(fourth.sql.includes(`window_id='${window}' and admitted_count=${admitted}`));
    assert.match(
      fourth.sql,
      /not exists\(select 1 from ops.foundation_gateway_rate_windows where window_id='3c46c791-e140-4eb9-890a-eecfa251f65e'\)/,
    );
    const historical = JSON.parse(
      run(
        code.replace(
          '$ForwardWindow=$true;$ForwardMigration=$false;',
          '$ForwardWindow=$false;$ForwardMigration=$true;',
        ),
      ),
    );
    assert.equal(historical.vacancy, 0);
    assert.equal(historical.sql, source, 'HISTORICAL_CATALOG_BYTES_UNCHANGED');
    assert.doesNotThrow(() =>
      run(
        code
          .replace(
            "$projectVerifiedForwardSource='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803'",
            "$projectVerifiedForwardSource='a5e746736893d5040e93032ae740a0878f748837'",
          )
          .replace(
            "if($_.Exception.Message -cne 'CATALOG_CAPTURED'){throw}",
            "if($_.Exception.Message -cne 'blocked'){throw};if($null -ne $script:captured){throw 'MIXED_PAIR_QUERIED'}",
          ),
      ),
    );
  },
);

test('forward catalog failures expose only the fixed failed-flag stage', native, () => {
  const checks = [
    'identity',
    'tables_rls',
    'no_machine_table_grants',
    'rpc_shape',
    'owner_control_restricted',
    'all_project_tables_rls',
    'all_views_invoker',
    'gw01_closed',
    'domain_auto_join_off',
    'baseline_counts',
    'forward_primary_key',
    'forward_signatures',
    'forward_namespace',
    'no_new_window',
  ];
  const output = run(`
${definitions(['Assert-Keys', 'Invoke-FoundationForwardPostcheck'])}
$ForwardWindow=$false;$ForwardMigration=$true;$forwardCheckFile='synthetic-catalog.sql';$queryTimeoutMs=1000
$checks=@(${checks.map(quote).join(',')});$script:proof=$null;$script:cliCalls=0
function Invoke-Cli($Arguments,$Timeout){$script:cliCalls++;if($Arguments[1] -cne 'query'){throw 'CATALOG_PASSED'};return [pscustomobject]@{ok=$true;closed=$true;text=ConvertTo-Json -InputObject @([pscustomobject]@{postcheck=$script:proof}) -Depth 8 -Compress}}
foreach($key in @($checks+@('schemas','shape','valid'))){foreach($badValue in @($false,'synthetic-private-canary')){
 $receipt=[ordered]@{};$script:cliCalls=0;$value=[ordered]@{};foreach($name in $checks){$value[$name]=$true};$value.schemas=@('app','api','ops','ingest')
 if($key -ceq 'shape'){$value['unexpected']='synthetic-private-canary'}elseif($key -ceq 'schemas'){$value.schemas=@('app','api','ops')}elseif($key -cne 'valid'){$value[$key]=$badValue}
 $script:proof=[pscustomobject]$value
 try{Invoke-FoundationForwardPostcheck;throw 'INVALID_CATALOG_ACCEPTED'}catch{if($key -ceq 'valid'){if($_.Exception.Message -cne 'CATALOG_PASSED' -or $script:cliCalls -ne 2 -or $receipt.postcheckStage -cne 'advisors_security'){throw 'VALID_CATALOG_BLOCKED'}}else{if($_.Exception.Message -cne 'blocked' -or $script:cliCalls -ne 1 -or $receipt.postcheckStage -cne ('catalog_'+$key)){throw 'FIXED_FLAG_DIAGNOSTIC_FAILED'}}}
 $expectFlags=$key -cin @('valid','schemas') -or ($key -cin $checks -and $badValue -is [bool])
 if($receipt.Contains('catalogChecks') -ne $expectFlags){throw 'CATALOG_FLAGS_NOT_TYPE_GATED'}
 if($expectFlags){if($receipt.catalogChecks.Count -ne $checks.Count){throw 'CATALOG_FLAGS_NOT_WHITELISTED'};foreach($name in $checks){if($receipt.catalogChecks[$name] -isnot [bool] -or $receipt.catalogChecks[$name] -ne $script:proof.$name){throw 'CATALOG_FLAGS_NOT_ACTUAL_BOOLEANS'}}}
}}
Write-Output 'FIXED_CATALOG_DIAGNOSTICS'
`);
  assert.equal(output, 'FIXED_CATALOG_DIAGNOSTICS');
});

test('fresh forward push is once-only after exact dry-run and two baseline checks', native, () => {
  const value = JSON.parse(flow('baseline', false));
  assert.equal(value.status, 'forward_complete');
  assert.equal(value.exit, 0);
  assert.equal(value.intents, 1);
  assert.equal(value.baselines, 3);
  assert.deepEqual(value.commands, [
    'db|push|--dry-run|--skip-vault',
    'db|query|--file|history.sql',
    'db|push|--skip-vault|--yes',
    'db|query|--file|history.sql',
  ]);
});

test('lost push ACK is reconciled using actual15 history without another mutation', native, () => {
  const value = JSON.parse(flow('baseline', false, 'matched', 'complete', false));
  assert.equal(value.status, 'forward_reconciled_complete_after_failure');
  assert.equal(value.exit, 0);
  assert.equal(value.intents, 1);
  assert.equal(value.commands.filter((command) => command === 'db|push|--skip-vault|--yes').length, 1);
});

test('existing intent plus14 history stops;15 resumes readbacks/postchecks only', native, () => {
  const uncertain = JSON.parse(flow('baseline', true));
  assert.equal(uncertain.status, 'reconciliation_required');
  assert.equal(uncertain.exit, 1);
  assert.deepEqual(uncertain.commands, []);
  assert.equal(uncertain.intents, 0);
  const complete = JSON.parse(flow('complete', true));
  assert.equal(complete.status, 'forward_already_complete');
  assert.equal(complete.exit, 0);
  assert.deepEqual(complete.commands, []);
  assert.equal(complete.intents, 0);
});

test('dry-run mismatch or incomplete readback does not become acceptance', native, () => {
  const dry = JSON.parse(flow('baseline', false, 'pending_mismatch'));
  assert.equal(dry.status, 'dry_run_rejected');
  assert.equal(dry.push, false);
  assert.equal(dry.intents, 0);
  const after = JSON.parse(flow('baseline', false, 'matched', 'baseline'));
  assert.equal(after.status, 'reconciliation_required');
  assert.equal(after.exit, 1);
  assert.equal(after.intents, 1);
});

test('forward mode conflicts fail before packet, credential or network access', native, () => {
  const result = spawnSync(
    powershell,
    ['-NoProfile', '-NonInteractive', '-File', consumer, '-ForwardMigration', '-PhaseAControl'],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].map((name) => [name, process.env[name]]),
      ),
    },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Conflicting continuation modes; no private access/);
});

test(
  'forward baseline refuses any reopened window, changed archived fixture or hidden extra family row',
  native,
  () => {
    // Synthetic copy of the finite closed/archive projection; no hosted receipt or private file is read.
    const archived = {
      activeLeaseCount: 0,
      actorRunCount: 0,
      approval: {
        actorBuild: '0.3.99',
        batchMaxUsd: 2,
        closed: true,
        expiresAt: '2026-10-23T16:47:55.265665+00:00',
        maxChargeUsd: 1,
      },
      audits: {
        creationCount: 1,
        originalCount: 1,
        startupCount: 1,
        technical2Count: 1,
        technical2Exact: true,
      },
      collectedItemCount: 0,
      costEntryCount: 0,
      costUsd: 0,
      fixture: {
        accountActive: false,
        accountId: 'bd23314c-591f-4fb7-92fd-b7450634eeb6',
        accountPaused: true,
        competitorActive: false,
        competitorArchived: true,
        competitorId: 'd51a39f6-fe87-4d17-aee9-3070c45693aa',
        itemsCount: 0,
        locked: false,
        progressPresent: false,
      },
      identity: true,
      incompleteRequests: 0,
      kind: 'm03_foundation_inspection',
      launchCount: 0,
      requestCount: 1,
      reservedRequests: 0,
      scrapeRunCount: 0,
      window: {
        admittedCount: 2,
        audience: 'https://everyone-market-researcher-eb5no2yxz-muhammed-abdelrahman.vercel.app',
        closeCount: 1,
        closedAt: '2026-10-23T16:25:54.94722+00:00',
        commitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
        deploymentId: 'dpl_8gyW2MmNfAK4ARLKcKEWkbDxtuiv',
        expiresAt: '2026-10-23T16:47:55.265665+00:00',
        id: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        startsAt: '2026-10-23T15:47:55.265665+00:00',
      },
      windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
    };
    const output = run(`
${definitions(['Assert-Keys', 'Read-FoundationInspection', 'Assert-FoundationArchiveInspection', 'Assert-FoundationForwardBaseline'])}
$ForwardMigration=$true;$TechnicalResidual13=$false;$receipt=[ordered]@{};$inspectQueryFile='inspect.sql';$forwardFamilyFile='family.sql';$queryTimeoutMs=1000
$script:inspection=ConvertFrom-Json ${quote(JSON.stringify(archived))};$forwardPrior=ConvertFrom-Json ${quote(JSON.stringify(archived))}
$script:family=[pscustomobject]@{identity=$true;soleClosedFamily=$true;globalAdmitted=2;launches=0;reservedUsd=0}
function Invoke-Cli($Arguments,$Timeout){$value=if($Arguments[3] -ceq 'inspect.sql'){@([pscustomobject]@{inspection=$script:inspection})}else{@([pscustomobject]@{forward_baseline=$script:family})};return [pscustomobject]@{ok=$true;closed=$true;text=ConvertTo-Json -InputObject @($value) -Depth 12 -Compress}}
Assert-FoundationForwardBaseline
foreach($case in @('reopened','active-fixture','extra-family','launch','unknown-field')){
 $script:inspection=ConvertFrom-Json ${quote(JSON.stringify(archived))};$script:family=[pscustomobject]@{identity=$true;soleClosedFamily=$true;globalAdmitted=2;launches=0;reservedUsd=0}
 switch($case){'reopened'{$script:inspection.window.closedAt=$null};'active-fixture'{$script:inspection.fixture.accountPaused=$false};'extra-family'{$script:family.soleClosedFamily=$false};'launch'{$script:family.launches=1};'unknown-field'{$script:family|Add-Member leakedToken 'synthetic-canary'}}
 $denied=$false;try{Assert-FoundationForwardBaseline}catch{$denied=$true};if(-not $denied){throw 'DIRTY_FORWARD_BASELINE_ACCEPTED'}
}
Write-Output 'CLOSED_ARCHIVE_FAMILY_PROVEN'
`);
    assert.equal(output, 'CLOSED_ARCHIVE_FAMILY_PROVEN');
  },
);

// Registered-state projections are synthetic; the SQL itself is independently reviewed.
test('fresh window state rejects progress and unowned rows before reactivation', native, () => {
  assert.equal(
    run(`
${definitions(['Assert-Keys'])}
${definitions(['Foundation-Literal', 'Assert-FoundationForwardWindowState'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$out='synthetic';$continuationOutputStem='synthetic';$script:forwardWindowBinding=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic.vercel.app';deploymentId='dpl_Synthetic'}
function Read-FoundationForwardPrior{}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{outputSegment='technical-3'}}
function Test-Path($LiteralPath){return $false}
$script:value=[pscustomobject]@{identity=$true;legacyClosed=$true;windows=1;freshWindows=0;freshPrepared=$false;globalAdmitted=2;requests=1;activeLeases=0;launches=0;bindings=0;progress=0}
function Invoke-FoundationQuery($Sql,$Field){if($Sql -match 'foundation_gateway_admit|update |insert |delete '){throw 'PREFLIGHT_MUTATED'};if($Field -ceq 'ownership'){return [pscustomobject]@{owned=$true}};return $script:value}
Assert-FoundationForwardWindowState $false
$script:value.windows=2;$script:value.freshWindows=1;$script:value.freshPrepared=$true;Assert-FoundationForwardWindowState $true
foreach($key in @('windows','globalAdmitted','requests','activeLeases','launches','bindings','progress')){$saved=$script:value.$key;$script:value.$key=$saved+1;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$saved;if(-not $denied){throw 'UNOWNED_OR_PROGRESSED_STATE_ACCEPTED'}}
$script:value.globalAdmitted='2';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'COERCED_COUNTER_ACCEPTED'}
Write-Output 'EXACT_REGISTERED_STATE'
`),
    'EXACT_REGISTERED_STATE',
  );
});

test(
  'approved remaining native window requires both closed predecessors, exact cumulative counters and the selected source',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys'])}
${definitions(['Foundation-Literal', 'Assert-FoundationForwardWindowState'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$out='synthetic';$continuationOutputStem='synthetic';$projectVerifiedForwardWindowId='eda4fae1-1e19-47db-81b8-beac1a4ed883';$projectVerifiedForwardSource='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803'
$script:forwardWindowBinding=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic.vercel.app';deploymentId='dpl_Synthetic'}
function Read-FoundationForwardPrior{}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{outputSegment='technical-9'}}
function Test-Path($LiteralPath){return $false}
$script:value=[pscustomobject]@{identity=$true;legacyClosed=$true;intermediateClosed=$true;windows=2;freshWindows=0;freshPrepared=$false;globalAdmitted=3;requests=1;activeLeases=0;launches=0;bindings=0;progress=0}
function Invoke-FoundationQuery($Sql,$Field){
 if($Sql -match 'foundation_gateway_admit|update |insert |delete '){throw 'PREFLIGHT_MUTATED'}
 if($Field -ceq 'ownership'){if(-not $Sql.Contains("where w.window_id='eda4fae1-1e19-47db-81b8-beac1a4ed883'")){throw 'WRONG_ACTIVE_OWNERSHIP'};return [pscustomobject]@{owned=$true}}
 if(-not $Sql.Contains("'intermediateClosed'") -or -not $Sql.Contains("'dpl_HPq8ot1nNvBZRLTyAoEnXHXuhTPF'") -or -not $Sql.Contains("bound_commit_sha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803'")){throw 'PRIOR_BINDING_NOT_EXACT'};return $script:value
}
Assert-FoundationForwardWindowState $false
$script:value.windows=3;$script:value.freshWindows=1;$script:value.freshPrepared=$true;Assert-FoundationForwardWindowState $true
foreach($key in @('legacyClosed','intermediateClosed','freshPrepared')){$script:value.$key=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$true;if(-not $denied){throw 'UNCLOSED_PREDECESSOR_ACCEPTED'}}
foreach($key in @('windows','globalAdmitted','requests','activeLeases','launches','bindings','progress')){$saved=$script:value.$key;$script:value.$key=$saved+1;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$saved;if(-not $denied){throw 'UNRECONCILED_PROGRESS_ACCEPTED'}}
$projectVerifiedForwardSource='a5e746736893d5040e93032ae740a0878f748837';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'MIXED_WINDOW_SOURCE_ACCEPTED'}
Write-Output 'EXACT_REMAINING_NATIVE_WINDOW'
`),
      'EXACT_REMAINING_NATIVE_WINDOW',
    );
  },
);

test('ForwardWindow requires only the compatible current ProjectVerified PhaseA profile', native, () => {
  for (const flags of [
    ['-ForwardWindow'],
    ['-ForwardWindow', '-PhaseAControl'],
    ['-ForwardWindow', '-PhaseAControl', '-ProjectVerifiedContinuation', '-PostcheckContinuation'],
    ['-ForwardWindow', '-PhaseAControl', '-ProjectVerifiedContinuation', '-ClockAmendment'],
    ['-ForwardWindow', '-PhaseAControl', '-ProjectVerifiedContinuation', '-ForwardMigration'],
  ]) {
    const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', consumer, ...flags], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].map((name) => [name, process.env[name]]),
      ),
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /Conflicting continuation modes; no private access/);
  }
});

test(
  'fourth registered window requires three exact closed predecessors and all retained cumulative counts before mutation',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys'])}
${definitions(['Foundation-Literal', 'Assert-FoundationForwardWindowState'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$out='synthetic';$continuationOutputStem='synthetic';$projectVerifiedForwardWindowId='3c46c791-e140-4eb9-890a-eecfa251f65e';$projectVerifiedForwardSource='7b1837201ac7925591577a1517d7288936ca3464'
function Read-FoundationForwardPrior{return [pscustomobject]@{}}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=13;outputSegment='synthetic13'}}
$script:forwardWindowBinding=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic.vercel.app';deploymentId='dpl_Synthetic'}
$script:value=[pscustomobject]@{identity=$true;legacyClosed=$true;intermediateClosed=$true;runtimeClosed=$true;windows=3;freshWindows=0;freshPrepared=$false;globalAdmitted=5;requests=2;activeLeases=0;launches=0;bindings=0;progress=0}
function Invoke-FoundationQuery($Sql,$Column){
 if($Column -ceq 'ownership'){return [pscustomobject]@{owned=$true}}
 foreach($needle in @("'intermediateClosed'","'runtimeClosed'","w.admitted_count=2","'dpl_ABN1zsMeta6kHd4eRTqT9FbLqkEY'","bound_commit_sha='7b1837201ac7925591577a1517d7288936ca3464'")){if(-not $Sql.Contains($needle)){throw 'THIRD_PREDECESSOR_OR_FRESH_BINDING_NOT_EXACT'}}
 return $script:value
}
Assert-FoundationForwardWindowState $false
$script:value.windows=4;$script:value.freshWindows=1;$script:value.freshPrepared=$true;Assert-FoundationForwardWindowState $true
foreach($key in @('legacyClosed','intermediateClosed','runtimeClosed','freshPrepared')){$script:value.$key=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$true;if(-not $denied){throw 'UNCLOSED_PREDECESSOR_ACCEPTED'}}
foreach($key in @('windows','globalAdmitted','requests','activeLeases','launches','bindings','progress')){$saved=$script:value.$key;$script:value.$key=$saved+1;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$saved;if(-not $denied){throw 'UNRECONCILED_PROGRESS_ACCEPTED'}}
$script:value.globalAdmitted='5';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'COERCED_COUNTER_ACCEPTED'};$script:value.globalAdmitted=5
$projectVerifiedForwardSource='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'MIXED_FOURTH_WINDOW_SOURCE_ACCEPTED'}
Write-Output 'THREE_CLOSED_PREDECESSORS_AND_FRESH_FOURTH'
`),
      'THREE_CLOSED_PREDECESSORS_AND_FRESH_FOURTH',
    );
  },
);

test('ForwardWindow public adapter accepts the selected a5 source and fresh UUID only', native, () => {
  assert.equal(
    run(`
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation'])}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$PhaseAControl=$true;$PostcheckContinuation=$true;$ClockAmendment=$false;$OriginalDeadlineAtMs=0;$RemainingContinuation=$false;$StartupReplacement=$false;$CheckOnly=$true;$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$repo='synthetic';$node='never-spawned'
$script:dto=[pscustomobject]@{kind='project_verified_continuation_ready';segmentId=$postcheckContinuationSegment;sourceCommitSha='a5e746736893d5040e93032ae740a0878f748837';windowId='38b3708d-61b0-41d2-8170-5ed91c66b4dc';privateRead=$false;networkRequests=0}
function Assert-Path($Root,$Relative){return 'synthetic-fixed-module'}
function Invoke-Bounded{return [pscustomobject]@{ok=$true;closed=$true;text=ConvertTo-Json $script:dto -Compress}}
$null=Read-FoundationPostcheckContinuation
foreach($key in @('sourceCommitSha','windowId')){$saved=$script:dto.$key;$script:dto.$key=if($key -ceq 'sourceCommitSha'){'f42930f90c2de43c84f61ad6d966d0ee6074d70e'}else{'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'};$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'LEGACY_BINDING_ACCEPTED_FOR_NEW_WINDOW'};$script:dto.$key=$saved}
Write-Output 'SOURCE_SELECTED_FORWARD_PROFILE'
`),
    'SOURCE_SELECTED_FORWARD_PROFILE',
  );
});

test('post-restoration public adapter binds exact1024 allocation and fifth-window source', native, () => {
  assert.equal(
    run(`
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation'])}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$PhaseAControl=$true;$PostcheckContinuation=$true;$ClockAmendment=$false;$OriginalDeadlineAtMs=0;$RemainingContinuation=$false;$StartupReplacement=$false;$CheckOnly=$true;$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$repo='synthetic';$node='never-spawned'
$valid=[ordered]@{kind='project_verified_continuation_ready';segmentId=$postcheckContinuationSegment;sourceCommitSha='5087d4d93d2f6ffdca0bc0096b365723005446fc';windowId='4c602549-2c42-4ec3-9328-714d7cb66a77';privateRead=$false;networkRequests=0;managementMaximum=1024;managementAttempts=524;controlAttempts=841;combinedAttempts=1365};$script:dto=[pscustomobject]$valid
function Assert-Path($Root,$Relative){return 'synthetic-fixed-module'}
function Invoke-Bounded{return [pscustomobject]@{ok=$true;closed=$true;text=ConvertTo-Json $script:dto -Compress}}
$null=Read-FoundationPostcheckContinuation
if($script:projectVerifiedForwardWindowId -cne $valid.windowId -or $script:projectVerifiedForwardSource -cne $valid.sourceCommitSha){throw 'FIFTH_PROFILE_NOT_SELECTED'}
foreach($mutation in @(@{key='managementMaximum';value=832},@{key='managementMaximum';value=1025},@{key='managementMaximum';value='1024'},@{key='managementAttempts';value=401},@{key='controlAttempts';value=840},@{key='combinedAttempts';value=1364},@{key='sourceCommitSha';value='7b1837201ac7925591577a1517d7288936ca3464'},@{key='windowId';value='3c46c791-e140-4eb9-890a-eecfa251f65e'},@{key='privateRead';value=$true},@{key='networkRequests';value=1},@{key='extra';value=$true})){
 $mixed=[ordered]@{};foreach($name in $valid.Keys){$mixed[$name]=$valid[$name]};$mixed[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MIXED_POST_RESTORATION_PROFILE_ACCEPTED'}
}
foreach($missing in @('managementMaximum','managementAttempts','controlAttempts','combinedAttempts')){
 $mixed=[ordered]@{};foreach($name in $valid.Keys){if($name -cne $missing){$mixed[$name]=$valid[$name]}};$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'PARTIAL_POST_RESTORATION_PROFILE_ACCEPTED'}
}
Write-Output 'EXACT_1024_POST_RESTORATION_PUBLIC_PROFILE'
`),
    'EXACT_1024_POST_RESTORATION_PUBLIC_PROFILE',
  );
});

test(
  'post-browser native adapter retains the extra Control charge and requires immutable no-Admin proof',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation'])}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$PhaseAControl=$true;$PostcheckContinuation=$true;$ClockAmendment=$false;$OriginalDeadlineAtMs=0;$RemainingContinuation=$false;$StartupReplacement=$false;$CheckOnly=$true;$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$repo='synthetic';$node='never-spawned';$script:proofValid=$true
$valid=[ordered]@{kind='project_verified_continuation_ready';segmentId=$postcheckContinuationSegment;sourceCommitSha='5087d4d93d2f6ffdca0bc0096b365723005446fc';windowId='4c602549-2c42-4ec3-9328-714d7cb66a77';privateRead=$false;networkRequests=0;managementMaximum=1024;managementAttempts=524;controlAttempts=842;combinedAttempts=1366};$script:dto=[pscustomobject]$valid
function Assert-Path($Root,$Relative){return 'synthetic-fixed-module'}
function Invoke-Bounded{return [pscustomobject]@{ok=$true;closed=$true;text=ConvertTo-Json $script:dto -Compress}}
function Read-FoundationTechnical14NoAdmin{if(-not $script:proofValid){throw 'CLOSED_NO_ADMIN_PROOF_REQUIRED'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
$null=Read-FoundationPostcheckContinuation
foreach($mutation in @(@{key='managementMaximum';value=832},@{key='managementAttempts';value=525},@{key='controlAttempts';value=841},@{key='combinedAttempts';value=1365},@{key='controlAttempts';value='842'},@{key='sourceCommitSha';value='7b1837201ac7925591577a1517d7288936ca3464'})){
 $mixed=[ordered]@{};foreach($name in $valid.Keys){$mixed[$name]=$valid[$name]};$mixed[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'RESET_OR_MIXED_BROWSER_CHARGE_ACCEPTED'}
}
$script:dto=[pscustomobject]$valid;$script:proofValid=$false;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MISSING_NO_ADMIN_PROOF_ACCEPTED'}
Write-Output 'EXACT_POST_BROWSER_NATIVE_TUPLE'
`),
      'EXACT_POST_BROWSER_NATIVE_TUPLE',
    );
  },
);

test(
  'technical14 no-Admin proof preserves ledger prefixes and refuses any DB artifact before a technical15 gap',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Path', 'Read-Json', 'File-Hash', 'Read-FoundationTechnical14NoAdmin'])}
$originalRepo=${quote(resolve('.'))};$repo=$PSScriptRoot
$record='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical14-reconciliation-20261024.json';$cleanup='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical14-cleanup-20261024.json'
$actual=ConvertFrom-Json ([IO.File]::ReadAllText((Join-Path $originalRepo $record)))
foreach($relative in @($record,$cleanup)+@($actual.pins.PSObject.Properties.Name)){
 $source=Assert-Path $originalRepo $relative;$target=Join-Path $repo $relative;$null=[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target));[IO.File]::Copy($source,$target,$false)
}
function Get-CimInstance($ClassName,$Filter,$Property,$ErrorAction){return @()}
$expected='6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'
if((Read-FoundationTechnical14NoAdmin) -cne $expected){throw 'ACTUAL_STYLE_NO_ADMIN_PROOF_REJECTED'}
foreach($name in @('management','control','setup','preflight')){[IO.File]::AppendAllText((Join-Path $repo ('scripts/n8n/out/foundation/live/'+$name+'.jsonl')),'{"event":"synthetic_tail"}'+"\`n")}
if((Read-FoundationTechnical14NoAdmin) -cne $expected){throw 'CHARGED_TAIL_REJECTED'}
foreach($relative in $actual.absentOutputs){
 $file=Join-Path $repo $relative;$null=[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($file));[IO.File]::WriteAllText($file,'{}')
 $denied=$false;try{$null=Read-FoundationTechnical14NoAdmin}catch{$denied=$true};[IO.File]::Delete($file);if(-not $denied){throw 'UNKNOWN_TECHNICAL14_DB_OPERATION_ACCEPTED'}
}
$historical=Join-Path $repo 'scripts/n8n/out/foundation/live/runtime.jsonl';$before=[IO.File]::ReadAllText($historical);[IO.File]::AppendAllText($historical,'{"event":"synthetic_tail"}'+"\`n")
$denied=$false;try{$null=Read-FoundationTechnical14NoAdmin}catch{$denied=$true};[IO.File]::WriteAllText($historical,$before);if(-not $denied){throw 'HISTORICAL_RUNTIME_CHANGED'}
$cleanupFile=Join-Path $repo $cleanup;[IO.File]::AppendAllText($cleanupFile,' ');$denied=$false;try{$null=Read-FoundationTechnical14NoAdmin}catch{$denied=$true};if(-not $denied){throw 'CHANGED_CLEANUP_PROOF_ACCEPTED'}
Write-Output 'EXACT_IMMUTABLE_TECHNICAL14_GAP_PROOF'
`),
      'EXACT_IMMUTABLE_TECHNICAL14_GAP_PROOF',
    );
  },
);

test(
  'fifth registered window requires four closed predecessors and typed12/13 fixture audits',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Foundation-Technical13AuditPredicate'])}
${definitions(['Foundation-Literal', 'Assert-FoundationForwardWindowState'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$out='synthetic';$continuationOutputStem='synthetic';$projectVerifiedForwardWindowId='4c602549-2c42-4ec3-9328-714d7cb66a77';$projectVerifiedForwardSource='5087d4d93d2f6ffdca0bc0096b365723005446fc';$script:ordinal=14;$script:proofValid=$true
function Read-FoundationForwardPrior{return [pscustomobject]@{}}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=$script:ordinal;outputSegment=('synthetic'+$script:ordinal)}}
function Read-FoundationTechnical14NoAdmin{if(-not $script:proofValid){throw 'MISSING_NO_ADMIN_PROOF'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
$script:forwardWindowBinding=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic.vercel.app';deploymentId='dpl_Synthetic'}
$script:value=[pscustomobject]@{identity=$true;legacyClosed=$true;intermediateClosed=$true;runtimeClosed=$true;restorationClosed=$true;fixtureAuditCount=6;technical12Exact=$true;technical13Exact=$true;windows=4;freshWindows=0;freshPrepared=$false;globalAdmitted=7;requests=3;activeLeases=0;launches=0;bindings=0;progress=0}
function Invoke-FoundationQuery($Sql,$Column){
 if($Column -ceq 'ownership'){if(-not $Sql.Contains("where w.window_id='4c602549-2c42-4ec3-9328-714d7cb66a77'")){throw 'WRONG_FRESH_OWNERSHIP'};return [pscustomobject]@{owned=$true}}
 foreach($needle in @("'restorationClosed'","'fixtureAuditCount'","'technical12Exact'","'technical13Exact'","'dpl_4hzfdXHd2F9B2Q89RiK2wVftzg25'","bound_commit_sha='5087d4d93d2f6ffdca0bc0096b365723005446fc'","jsonb_build_object('fixture_version',1")){if(-not $Sql.Contains($needle)){throw 'RESTORED_PREDECESSOR_OR_AUDIT_NOT_EXACT'}}
 return $script:value
}
Assert-FoundationForwardWindowState $false
$script:value.windows=5;$script:value.freshWindows=1;$script:value.freshPrepared=$true;Assert-FoundationForwardWindowState $true
foreach($key in @('legacyClosed','intermediateClosed','runtimeClosed','restorationClosed','technical12Exact','technical13Exact','freshPrepared')){$script:value.$key=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$true;if(-not $denied){throw 'UNCLOSED_OR_CHANGED_RESTORATION_ACCEPTED'}}
foreach($key in @('fixtureAuditCount','windows','globalAdmitted','requests','activeLeases','launches','bindings','progress')){$saved=$script:value.$key;$script:value.$key=$saved+1;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$saved;if(-not $denied){throw 'UNRECONCILED_FIFTH_PROGRESS_ACCEPTED'}}
$script:value.fixtureAuditCount='6';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'COERCED_FIXTURE_AUDIT_COUNT_ACCEPTED'};$script:value.fixtureAuditCount=6
$script:ordinal=15;Assert-FoundationForwardWindowState $true
$script:proofValid=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'UNPROVEN_MISSING14_STATE_ACCEPTED'};$script:proofValid=$true
$projectVerifiedForwardSource='7b1837201ac7925591577a1517d7288936ca3464';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'MIXED_FIFTH_SOURCE_ACCEPTED'}
Write-Output 'FOUR_CLOSED_PREDECESSORS_AND_TYPED_AUDITS'
`),
      'FOUR_CLOSED_PREDECESSORS_AND_TYPED_AUDITS',
    );
  },
);

test(
  'technical14 native fixture readback requires the exact typed audit and both prior lifecycle receipts',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Foundation-Technical13AuditPredicate'])}
${definitions(['Foundation-Literal', 'Read-FoundationProjectVerifiedContinuationReactivatedFixture', 'Assert-FoundationContinuationFixture'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$projectVerifiedForwardWindowId='4c602549-2c42-4ec3-9328-714d7cb66a77';$projectVerifiedForwardSource='5087d4d93d2f6ffdca0bc0096b365723005446fc';$script:ordinal=14;$script:queryCount=0;$script:proofValid=$true
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=$script:ordinal;auditSegment=('20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-'+$script:ordinal)}}
function Read-FoundationTechnical14NoAdmin{if(-not $script:proofValid){throw 'MISSING_NO_ADMIN_PROOF'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
function Invoke-FoundationQuery($Sql,$Field){
 $script:queryCount++
 foreach($needle in @(("l.actor_id='m03_smoke_reactivate.v1:20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-"+$script:ordinal+"'"),"l.after=jsonb_build_object('fixture_version',1","'original_creation_audit_id',o.id)","count(*)=7","m03_smoke_reactivate.v1:20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-12","m03_smoke_reactivate.v1:20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-13")){if(-not $Sql.Contains($needle)){throw 'TYPED_TECHNICAL14_LIFECYCLE_NOT_BOUND'}}
 return [pscustomobject]@{result='M03_SMOKE_FIXTURE_READY';company_code='C999';competitor_id='d51a39f6-fe87-4d17-aee9-3070c45693aa';account_id='bd23314c-591f-4fb7-92fd-b7450634eeb6';platform='website_work_page';url='https://everyone.film/about-everyone';competitor_status='active';account_status='active'}
}
$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture
$script:ordinal=15;$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture
$script:proofValid=$false;$denied=$false;try{$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture}catch{$denied=$true};if(-not $denied -or $script:queryCount -ne 2){throw 'UNPROVEN_TECHNICAL15_AUDIT_QUERIED'}
$script:ordinal=13;$denied=$false;try{$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture}catch{$denied=$true};if(-not $denied -or $script:queryCount -ne 2){throw 'WRONG_TECHNICAL_AUDIT_QUERIED'}
Write-Output 'EXACT_TYPED_TECHNICAL14_READBACK'
`),
      'EXACT_TYPED_TECHNICAL14_READBACK',
    );
  },
);

test('technical14 native ancestry binds its own fifth-window admission before private access', native, () => {
  assert.equal(
    run(`
${definitions(['Assert-Keys', 'Read-FoundationKernelProcess', 'Resolve-FoundationProjectVerifiedTechnicalPaths', 'Assert-FoundationProjectVerifiedContinuationProcessAncestry'])}
$ProjectVerifiedContinuation=$true;$ForwardWindow=$true;$CheckOnly=$false;$repo='C:\\__emr_synthetic_never_accessed';$env:LOCALAPPDATA=$repo;$script:fault='';$script:ordinal=14;$script:proofValid=$true
$now=[DateTimeOffset]::UtcNow;$start=$now.AddMinutes(-1);$claimed=$now.AddSeconds(-45)
$clock=[pscustomobject]@{segmentId='20275b22-b7fe-4737-a9a4-c50c2feadb74';sourceCommitSha='5087d4d93d2f6ffdca0bc0096b365723005446fc';windowId='4c602549-2c42-4ec3-9328-714d7cb66a77';startsAt=$start.ToUnixTimeMilliseconds();stopNewAt=$start.AddMinutes(50).ToUnixTimeMilliseconds()}
function Test-Path($LiteralPath){if($LiteralPath -cmatch '\\.technical-(\\d+)\\.json$'){return [int]$Matches[1] -le $script:ordinal};return $false}
function Assert-Path($Root,$Relative){if($Relative -notin @(('scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-'+$script:ordinal+'.json'),('scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-'+$script:ordinal+'.runtime-claim.json'),'Temp/emr-m03-acceptance-parent.operation.lock')){throw 'UNEXPECTED_CUSTODY_PATH'};return Join-Path $Root $Relative}
function Read-FoundationTechnical14NoAdmin{if(-not $script:proofValid){throw 'UNVERIFIED_TECHNICAL14_CLOSURE'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
function File-Hash{return 'synthetic-admission-hash'}
function Read-Json($Path){
 if($Path.EndsWith('.runtime-claim.json')){return [pscustomobject]@{kind='m03_project_verified_continuation_runtime_claim';version=1;segmentId=$clock.segmentId;admissionSha256='synthetic-admission-hash';processId=90001;parentProcessId=90002;claimedAt=$claimed.ToUnixTimeMilliseconds()}}
 $value=[pscustomobject]@{kind='m03_project_verified_continuation_admission';segmentId=$clock.segmentId;startsAt=$clock.startsAt;parentProcessId=90002;sourceCommitSha=$clock.sourceCommitSha;windowId=$clock.windowId}
 if($script:fault -ceq 'old-source'){$value.sourceCommitSha='7b1837201ac7925591577a1517d7288936ca3464'};if($script:fault -ceq 'old-window'){$value.windowId='3c46c791-e140-4eb9-890a-eecfa251f65e'};return $value
}
function Read-FoundationParentLock($Path){return [pscustomobject]@{kind='m03_clock_admission_parent';version=1;segmentId=$clock.segmentId;processId=90002}}
function Get-CimInstance($ClassName,$Filter,$Property,$ErrorAction){$number=[long]($Filter -replace '^ProcessId = ','');if($number -eq $PID){return [pscustomobject]@{ProcessId=$number;ParentProcessId=$(if($script:fault -ceq 'foreign-admin'){90099}else{90001});CreationDate=$now.AddSeconds(-40).UtcDateTime}};if($number -eq 90001){return [pscustomobject]@{ProcessId=$number;ParentProcessId=90002;CreationDate=$now.AddSeconds(-50).UtcDateTime}};if($number -eq 90002){return [pscustomobject]@{ProcessId=$number;ParentProcessId=1;CreationDate=$now.AddMinutes(-2).UtcDateTime}};throw 'UNEXPECTED_PROCESS'}
if((Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock) -ne $true -or $script:projectVerifiedTechnicalOrdinal -ne 14){throw 'VALID_TECHNICAL14_ANCESTRY_DENIED'}
$script:ordinal=15;if((Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock) -ne $true -or $script:projectVerifiedTechnicalOrdinal -ne 15){throw 'VALID_TECHNICAL15_ANCESTRY_DENIED'}
$script:proofValid=$false;$denied=$false;try{$null=Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock}catch{$denied=$true};if(-not $denied){throw 'TECHNICAL15_BEFORE_PRIVATE_WITHOUT_PROOF'};$script:proofValid=$true
foreach($fault in @('old-source','old-window','foreign-admin')){$script:fault=$fault;$denied=$false;try{$null=Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock}catch{$denied=$true};if(-not $denied){throw 'UNOWNED_TECHNICAL14_CHAIN_ACCEPTED'}}
Write-Output 'EXACT_TECHNICAL14_NATIVE_ANCESTRY'
`),
    'EXACT_TECHNICAL14_NATIVE_ANCESTRY',
  );
});

test(
  'technical15 fixture SQL receives only the fixed verified missing14 marker while14 stays unchanged',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Foundation-FixtureSql'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$repo=${quote(resolve('.'))};$ProjectVerifiedContinuation=$true;$ForwardWindow=$true;$PostcheckContinuation=$true;$RemainingContinuation=$false;$StartupReplacement=$false;$projectVerifiedForwardWindowId='4c602549-2c42-4ec3-9328-714d7cb66a77';$projectVerifiedForwardSource='5087d4d93d2f6ffdca0bc0096b365723005446fc';$script:ordinal=15;$script:proofValid=$true
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=$script:ordinal}}
function Read-FoundationTechnical14NoAdmin{if(-not $script:proofValid){throw 'MISSING_NO_ADMIN_PROOF'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'
if(-not $body.Contains("set_config('emr.smoke_technical14_no_reactivation','6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960',true)")){throw 'QUALIFIED_SQL_MARKER_MISSING'}
$script:proofValid=$false;$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'UNPROVEN_SQL_GAP_EMITTED'}
$script:ordinal=14;$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql';if($body.Contains("set_config('emr.smoke_technical14_no_reactivation'")){throw 'HISTORICAL14_BODY_SETTING_CHANGED'}
Write-Output 'QUALIFIED_TECHNICAL15_SQL_ONLY'
`),
      'QUALIFIED_TECHNICAL15_SQL_ONLY',
    );
  },
);

test(
  'post-restoration prior requires its immutable archive, native receipt and cleanup without adopting an older baseline',
  native,
  () => {
    const archive = JSON.parse(
      readFileSync(
        'milestones/M03-n8n-foundation/evidence/runtime-restoration-fixture-archive-20261024.json',
        'utf8',
      ),
    );
    const cleanup = JSON.parse(
      readFileSync(
        'milestones/M03-n8n-foundation/evidence/runtime-restoration-cleanup-20261024.json',
        'utf8',
      ),
    );
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Assert-FoundationArchiveInspection', 'Read-FoundationForwardPrior'])}
${definitions([], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$TechnicalResidual13=$false;$repo='synthetic';$script:projectVerifiedForwardWindowId='4c602549-2c42-4ec3-9328-714d7cb66a77';$script:projectVerifiedForwardSource='5087d4d93d2f6ffdca0bc0096b365723005446fc';$script:fault=''
$original=ConvertFrom-Json ${quote(JSON.stringify(archive))};$script:archive=$original;$script:cleanup=ConvertFrom-Json ${quote(JSON.stringify(cleanup))}
function Assert-Path($Root,$Relative){return $Relative}
function File-Hash($Path){switch -Wildcard($Path){'*fixture-archive*'{return $(if($script:fault -ceq 'archiveHash'){'0'*64}else{'37c3f0dc518799700cde6c56f18569634c33b919ba26b4bbac1e6d2d09baa656'})};'*cleanup*'{return $(if($script:fault -ceq 'cleanupHash'){'0'*64}else{'50b274b1f6e26d6ba34b602c2cae45136aea19353073d185a1b25ba4b9cc016a'})};'*latest.json'{return $(if($script:fault -ceq 'nativeHash'){'0'*64}else{'05cf944a0f3a04aa7c87d8e1cdce4f27e0644d30f7dcf6cf849e06529556e8e3'})};default{throw 'UNEXPECTED_PUBLIC_HASH'}}}
function Read-Json($Path){if($Path -like '*fixture-archive*'){return $script:archive};if($Path -like '*cleanup*'){return $script:cleanup};throw 'UNEXPECTED_PUBLIC_RECORD'}
function Read-FoundationTechnical13Closed{if($script:fault -ceq 'notRestored'){throw 'RESTORATION_UNVERIFIED'};return $original.actualNativeResult.archiveAfter.window}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=14}}
$checked=Read-FoundationForwardPrior;if($checked.fixtureAuditCount -ne 6 -or -not $checked.fixture.competitorArchived -or -not $checked.fixture.accountPaused){throw 'EXACT_ARCHIVED_BASELINE_NOT_SELECTED'}
foreach($fault in @('archiveHash','cleanupHash','nativeHash','notRestored','wrongRun','authFalse','pushTrue','activeFixture','auditCount')){
 $script:fault=$fault;$script:archive=$original|ConvertTo-Json -Depth 16|ConvertFrom-Json
 switch($fault){'wrongRun'{$script:archive.actualNativeResult.runId='unknown'};'authFalse'{$script:archive.actualNativeResult.authenticationVerified=$false};'pushTrue'{$script:archive.actualNativeResult.pushAttempted=$true};'activeFixture'{$script:archive.actualNativeResult.archiveAfter.fixture.competitorArchived=$false};'auditCount'{$script:archive.actualNativeResult.archiveAfter.fixtureAuditCount=5}}
 $denied=$false;try{$null=Read-FoundationForwardPrior}catch{$denied=$true};if(-not $denied){throw 'UNVERIFIED_RESTORED_BASELINE_ACCEPTED'}
}
Write-Output 'EXACT_POST_RESTORATION_PRIOR_ONLY'
`),
      'EXACT_POST_RESTORATION_PRIOR_ONLY',
    );
  },
);

test(
  'ForwardWindow public adapter accepts only the exact approved management CheckOnly fields',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation'])}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$PhaseAControl=$true;$PostcheckContinuation=$true;$ClockAmendment=$false;$OriginalDeadlineAtMs=0;$RemainingContinuation=$false;$StartupReplacement=$false;$CheckOnly=$true;$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$repo='synthetic';$node='never-spawned'
$valid=[ordered]@{kind='project_verified_continuation_ready';segmentId=$postcheckContinuationSegment;sourceCommitSha='a5e746736893d5040e93032ae740a0878f748837';windowId='38b3708d-61b0-41d2-8170-5ed91c66b4dc';privateRead=$false;networkRequests=0;managementMaximum=576;managementAttempts=152;controlAttempts=384;combinedAttempts=536}
$script:dto=[pscustomobject]$valid
function Assert-Path($Root,$Relative){return 'synthetic-fixed-module'}
function Invoke-Bounded{return [pscustomobject]@{ok=$true;closed=$true;text=ConvertTo-Json $script:dto -Compress}}
$null=Read-FoundationPostcheckContinuation
foreach($mutation in @(@{key='managementMaximum';value=512},@{key='managementMaximum';value=577},@{key='managementMaximum';value='576'},@{key='managementAttempts';value=151},@{key='controlAttempts';value=382},@{key='combinedAttempts';value=534},@{key='privateRead';value=$true},@{key='networkRequests';value=1},@{key='extra';value='SYNTHETIC_ONLY'})){
 $copy=[ordered]@{};foreach($name in $valid.Keys){$copy[$name]=$valid[$name]};$copy[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$copy;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'UNAPPROVED_PUBLIC_PROFILE_ACCEPTED'}
}
$reconciled=[ordered]@{};foreach($name in $valid.Keys){$reconciled[$name]=$valid[$name]};$reconciled.managementAttempts=177;$reconciled.controlAttempts=435;$reconciled.combinedAttempts=612;$script:dto=[pscustomobject]$reconciled
$null=Read-FoundationPostcheckContinuation
foreach($key in @('managementAttempts','controlAttempts','combinedAttempts')){
 $mixed=[ordered]@{};foreach($name in $reconciled.Keys){$mixed[$name]=$reconciled[$name]};$mixed[$key]=$valid[$key];$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MIXED_CHARGES_ACCEPTED'}
}
$fresh=[ordered]@{};foreach($name in $valid.Keys){$fresh[$name]=$valid[$name]};$fresh.managementMaximum=640;$fresh.managementAttempts=237;$fresh.controlAttempts=486;$fresh.combinedAttempts=723;$fresh.sourceCommitSha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803';$fresh.windowId='eda4fae1-1e19-47db-81b8-beac1a4ed883';$script:dto=[pscustomobject]$fresh
$null=Read-FoundationPostcheckContinuation
foreach($mutation in @(@{key='managementMaximum';value=576},@{key='managementAttempts';value=177},@{key='controlAttempts';value=435},@{key='combinedAttempts';value=612},@{key='sourceCommitSha';value=$valid.sourceCommitSha},@{key='windowId';value=$valid.windowId})){
 $mixed=[ordered]@{};foreach($name in $fresh.Keys){$mixed[$name]=$fresh[$name]};$mixed[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MIXED_640_PROFILE_ACCEPTED'}
}
$continued=[ordered]@{};foreach($name in $fresh.Keys){$continued[$name]=$fresh[$name]};$continued.managementAttempts=263;$continued.controlAttempts=537;$continued.combinedAttempts=800;$script:dto=[pscustomobject]$continued
$null=Read-FoundationPostcheckContinuation
foreach($key in @('managementAttempts','controlAttempts','combinedAttempts')){
 $mixed=[ordered]@{};foreach($name in $continued.Keys){$mixed[$name]=$continued[$name]};$mixed[$key]=$fresh[$key];$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MIXED_POST_ADMIN_PROFILE_ACCEPTED'}
}
$catalog=[ordered]@{};foreach($name in $fresh.Keys){$catalog[$name]=$fresh[$name]};$catalog.managementMaximum=704;$catalog.managementAttempts=288;$catalog.controlAttempts=588;$catalog.combinedAttempts=876;$script:dto=[pscustomobject]$catalog
$null=Read-FoundationPostcheckContinuation
foreach($mutation in @(@{key='managementMaximum';value=640},@{key='managementMaximum';value=705},@{key='managementMaximum';value='704'},@{key='managementAttempts';value=263},@{key='controlAttempts';value=537},@{key='combinedAttempts';value=800},@{key='sourceCommitSha';value=$valid.sourceCommitSha},@{key='windowId';value=$valid.windowId})){
 $mixed=[ordered]@{};foreach($name in $catalog.Keys){$mixed[$name]=$catalog[$name]};$mixed[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MIXED_704_CATALOG_PROFILE_ACCEPTED'}
}
$adminBinding=[ordered]@{};foreach($name in $catalog.Keys){$adminBinding[$name]=$catalog[$name]};$adminBinding.managementAttempts=313;$adminBinding.controlAttempts=639;$adminBinding.combinedAttempts=952;$script:dto=[pscustomobject]$adminBinding
$null=Read-FoundationPostcheckContinuation
foreach($mutation in @(@{key='managementMaximum';value=640},@{key='managementMaximum';value=705},@{key='managementMaximum';value='704'},@{key='managementAttempts';value=288},@{key='controlAttempts';value=588},@{key='combinedAttempts';value=876},@{key='sourceCommitSha';value=$valid.sourceCommitSha},@{key='windowId';value=$valid.windowId})){
 $mixed=[ordered]@{};foreach($name in $adminBinding.Keys){$mixed[$name]=$adminBinding[$name]};$mixed[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MIXED_704_ADMIN_BINDING_PROFILE_ACCEPTED'}
}
$next=[ordered]@{};foreach($name in $adminBinding.Keys){$next[$name]=$adminBinding[$name]};$next.managementMaximum=832;$next.managementAttempts=401;$next.controlAttempts=740;$next.combinedAttempts=1141;$next.sourceCommitSha='7b1837201ac7925591577a1517d7288936ca3464';$next.windowId='3c46c791-e140-4eb9-890a-eecfa251f65e';$script:dto=[pscustomobject]$next
$null=Read-FoundationPostcheckContinuation
foreach($mutation in @(@{key='managementMaximum';value=704},@{key='managementMaximum';value=833},@{key='managementMaximum';value='832'},@{key='managementAttempts';value=400},@{key='controlAttempts';value=739},@{key='combinedAttempts';value=1140},@{key='sourceCommitSha';value=$fresh.sourceCommitSha},@{key='windowId';value=$fresh.windowId})){
 $mixed=[ordered]@{};foreach($name in $next.Keys){$mixed[$name]=$next[$name]};$mixed[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MIXED_832_NEXT_PROFILE_ACCEPTED'}
}
foreach($missing in @('managementMaximum','managementAttempts','controlAttempts','combinedAttempts')){
 $copy=[ordered]@{};foreach($name in $valid.Keys){if($name -cne $missing){$copy[$name]=$valid[$name]}};$script:dto=[pscustomobject]$copy;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'PARTIAL_MANAGEMENT_PROFILE_ACCEPTED'}
}
$script:dto=[pscustomobject]$valid;$CheckOnly=$false;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'PUBLIC_FIELDS_ACCEPTED_IN_PRIVATE_MODE'}
$CheckOnly=$true;$ForwardWindow=$false;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'PUBLIC_FIELDS_ACCEPTED_IN_LEGACY_WINDOW'}
Write-Output 'EXACT_MANAGEMENT_PUBLIC_PROFILE'
`),
      'EXACT_MANAGEMENT_PUBLIC_PROFILE',
    );
  },
);

test(
  'actual forward packet has all65 source-required public pins and retains every old migration field',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys'])}
$source=[IO.File]::ReadAllText(${quote(consumer)})
$start=$source.IndexOf('$requiredFiles = @(');$end=$source.IndexOf('$versions = @(',$start)
if($start -lt 0 -or $end -le $start){throw 'PUBLIC_DECLARATIONS_NOT_FOUND'}
$ForwardMigration=$true;$ForwardWindow=$false;$caRelative='scripts/seed/certs/supabase-root-2021.crt';$cliRelative='node_modules/.pnpm/@supabase+cli-windows-x64@2.121.0/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
Invoke-Expression $source.Substring($start,$end-$start)
$packet=ConvertFrom-Json ([IO.File]::ReadAllText(${quote(resolve('scripts/db/m03-foundation-forward-dev-migration-packet.json'))}))
$old=ConvertFrom-Json ([IO.File]::ReadAllText(${quote(resolve('scripts/db/m03-foundation-dev-migration-packet.json'))}))
Assert-Keys $packet.files $requiredFiles
if($requiredFiles.Count -ne 65 -or $packet.baseline.Count -ne 14 -or $packet.pending.Count -ne 1 -or $packet.pending[0].historySha256 -cne '12e313d1c6337209cf7657d6d076b101f446b567033c2d2b3e65c38dbbe7ed18'){throw 'FORWARD_PUBLIC_CONTRACT_CHANGED'}
$prior=@($old.baseline)+@($old.pending)
for($i=0;$i -lt 14;$i++){foreach($field in @('version','name','file','sha256','historySha256')){if($prior[$i].$field -cne $packet.baseline[$i].$field){throw 'ORIGINAL_MIGRATION_REWRITTEN'}}}
Write-Output 'EXACT_PUBLIC_65_AND_OLD14'
`),
      'EXACT_PUBLIC_65_AND_OLD14',
    );
  },
);

for (const profile of [
  {
    name: 'post11',
    options: { adminAdmissionReadonly: true },
    managementMaximum: 704,
    managementAttempts: 313,
    controlAttempts: 639,
    combinedAttempts: 952,
    technicalOrdinal: 12,
  },
  {
    name: 'post12',
    options: { runtimePreparationClosed: true, runtimeMetadataAllocation: true },
    managementMaximum: 832,
    managementAttempts: 401,
    controlAttempts: 740,
    combinedAttempts: 1141,
    technicalOrdinal: 13,
  },
  {
    name: 'post13-restoration',
    options: { runtimeRestorationClosed: true, runtimeRestorationAllocation: true },
    managementMaximum: 1024,
    managementAttempts: 524,
    controlAttempts: 841,
    combinedAttempts: 1365,
    technicalOrdinal: 14,
  },
  {
    name: 'post14-browser',
    options: { restoredBrowserDiscovery: true },
    managementMaximum: 1024,
    managementAttempts: 524,
    controlAttempts: 842,
    combinedAttempts: 1366,
    technicalOrdinal: 15,
  },
])
  test(
    `${profile.name} fresh ForwardWindow completes the full native public Run preflight before the private boundary`,
    native,
    async () => {
      const fixture = await syntheticProjectVerifiedContinuation(profile.options);
      let primaryFailure;
      try {
        const readiness = fixture.check();
        assert.equal(readiness.kind, 'project_verified_continuation_ready', 'synthetic pre-copy authority');
        assert.equal(readiness.managementMaximum, profile.managementMaximum);
        assert.equal(readiness.managementAttempts, profile.managementAttempts);
        assert.equal(readiness.controlAttempts, profile.controlAttempts);
        assert.equal(readiness.combinedAttempts, profile.combinedAttempts);
        const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
        const put = (relative, bytes) => fixture.put(relative, bytes);
        const packet = JSON.parse(
          readFileSync(resolve('scripts/db/m03-foundation-forward-dev-migration-packet.json'), 'utf8'),
        );
        packet.files[
          'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical11-reconciliation-20261024.json'
        ] = 'synthetic-public-pin-recomputed-below';
        // Keep all isolated historical authority bytes supplied by the existing
        // fixture. Copy only the public source/CLI/migration inputs it lacks.
        for (const relative of [
          ...Object.keys(packet.files),
          ...packet.baseline.map((m) => m.file),
          ...packet.pending.map((m) => m.file),
        ]) {
          const target = join(fixture.directory, relative);
          if (!existsSync(target)) {
            mkdirSync(dirname(target), { recursive: true });
            copyFileSync(resolve(relative), target);
          }
        }
        let helperSource = readFileSync(consumer, 'utf8');
        if (profile.options.restoredBrowserDiscovery) {
          // Bind the native guard to this isolated receipt's coherent synthetic
          // ancestry/prefixes. Production receipt pins and consumer stay unchanged.
          for (const [relative, original] of [
            [
              'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical14-reconciliation-20261024.json',
              '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960',
            ],
            [
              'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical14-cleanup-20261024.json',
              'aabddbc205c3582ba51beb16ca734c35378cf6caa79c288184aaa13c08c4406c',
            ],
          ])
            helperSource = helperSource.replaceAll(
              original,
              hash(readFileSync(join(fixture.directory, relative))),
            );
        }
        const privateBoundary = helperSource.indexOf('if($CheckOnly -and $ForwardMigration){Write-Output');
        assert.ok(privateBoundary > 0);
        // Execute the actual complete Run-only public prefix, not a detached DTO
        // validator. This test copy physically cannot reach a DPAPI/private block.
        const publicPrefix = helperSource
          .slice(0, privateBoundary)
          .replace(
            "Write-Output 'M03_FOUNDATION PREFLIGHT_BLOCKED. Public packet/seal/target/CLI verification failed; no decryption or authentication attempted.'",
            "Write-Output ('SYNTHETIC_PUBLIC_PREFLIGHT_LINE='+$_.InvocationInfo.ScriptLineNumber)",
          );
        const adminPath = put(
          'scripts/db/windows/Invoke-M03FoundationMigrations.ps1',
          publicPrefix + "\nWrite-Output 'SYNTHETIC_FULL_PUBLIC_RUN_READY';exit 0\n",
        );
        for (const relative of Object.keys(packet.files))
          packet.files[relative] = hash(readFileSync(join(fixture.directory, relative)));
        put('scripts/db/m03-foundation-forward-dev-migration-packet.json', JSON.stringify(packet) + '\n');
        assert.equal(
          fixture.check().kind,
          'project_verified_continuation_ready',
          'synthetic post-copy authority',
        );
        const guardPath = join(
          fixture.directory,
          'scripts/n8n/foundation-live-project-verified-continuation.mjs',
        );
        const runtimePath = put(
          'synthetic-native-public-runtime.mjs',
          `
import {readFileSync,appendFileSync,openSync,writeFileSync,closeSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const guard=await import(${JSON.stringify(pathToFileURL(guardPath).href)});
const proof=guard.claimFoundationProjectVerifiedContinuation(guard.readFoundationProjectVerifiedContinuation());
const lockPath=${JSON.stringify(join(fixture.directory, 'scripts/n8n/out/foundation/live/runtime.operation.lock'))};
const lock=openSync(lockPath,'wx');writeFileSync(lock,'emr-m03-foundation-live-runtime-v1\\n');
try {
 const managementPath=${JSON.stringify(fixture.paths.management)},controlPath=${JSON.stringify(fixture.paths.control)};
 const management=readFileSync(managementPath,'utf8').trimEnd().split('\\n').map(JSON.parse);
 const control=readFileSync(controlPath,'utf8').trimEnd().split('\\n').map(JSON.parse).filter(r=>r.event==='control_request_intent');
 for(let i=1;i<=25;i++)appendFileSync(managementPath,JSON.stringify({event:'management_attempt',ordinal:management.length-1+i})+'\\n');
 for(let i=1;i<=51;i++)appendFileSync(controlPath,JSON.stringify({event:'control_request_intent',ordinal:control.length+i,kind:'discovery',workflowId:'MzimjpsuyPuK7SKe',at:new Date().toISOString()})+'\\n');
 const r=spawnSync(${JSON.stringify(powershell)},['-NoProfile','-NonInteractive','-File',${JSON.stringify(adminPath)},'-PhaseAControl','-ProjectVerifiedContinuation','-ForwardWindow'],{cwd:${JSON.stringify(fixture.directory)},env:Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]]])),windowsHide:true,encoding:'utf8',timeout:40000});
 const line=(r.stdout??'').trim();
 console.log(JSON.stringify({kind:'synthetic_public_run_result',nativeExit:r.status,publicReady:line==='SYNTHETIC_FULL_PUBLIC_RUN_READY',fixedDiagnostic:/^(?:SYNTHETIC_PUBLIC_PREFLIGHT_LINE=\\d+|M03_FOUNDATION PREFLIGHT_BLOCKED\\. Stage=[A-Z_]+; no private file read, decryption or authentication attempted\\.)$/.test(line)?line:null,stderrObserved:Boolean(r.stderr),privateRead:false,networkRequests:0}));
 process.exitCode=r.status===0&&line==='SYNTHETIC_FULL_PUBLIC_RUN_READY'?0:1;
} finally {closeSync(lock);unlinkSync(lockPath);}
`,
        );
        const wrapperPath = put(
          'synthetic-native-public-wrapper.ps1',
          `
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
$env:LOCALAPPDATA=${quote(fixture.localAppData)}
$parentPath=Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-acceptance-parent.operation.lock'
$parent=[ordered]@{kind='m03_clock_admission_parent';version=1;segmentId='20275b22-b7fe-4737-a9a4-c50c2feadb74';processId=$PID}
$handle=[IO.File]::Open($parentPath,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::Read)
function Invoke-SyntheticNode([string]$Script,[string]$Extra,[int]$Timeout){
 $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=${quote(packet.node.path)};$info.Arguments='"'+$Script+'"'+$Extra;$info.WorkingDirectory=${quote(fixture.directory)};$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
 foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){if(Test-Path ('Env:'+$name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$info;$null=$child.Start();$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();$closed=$child.WaitForExit($Timeout)
 if(-not $closed){$child.Kill();$null=$child.WaitForExit(5000);throw 'SYNTHETIC_NODE_TIMEOUT'}
 $result=[pscustomobject]@{code=$child.ExitCode;text=$out.Result;stderrObserved=($err.Result.Length -gt 0)};$child.Dispose();return $result
}
try {
 $bytes=[Text.Encoding]::UTF8.GetBytes(($parent|ConvertTo-Json -Compress));$handle.Write($bytes,0,$bytes.Length);$handle.Flush($true)
 $admission=Invoke-SyntheticNode ${quote(guardPath)} ' Admit' 10000
 if($admission.code -ne 0 -or $admission.stderrObserved){Write-Output '{"kind":"synthetic_public_run_result","publicReady":false,"fixedDiagnostic":"SYNTHETIC_ADMISSION_BLOCKED"}';exit 1}
 $runtime=Invoke-SyntheticNode ${quote(runtimePath)} '' 45000
 if($runtime.stderrObserved){Write-Output '{"kind":"synthetic_public_run_result","publicReady":false,"fixedDiagnostic":"SYNTHETIC_RUNTIME_STDERR"}';exit 1}
 Write-Output $runtime.text;exit $runtime.code
} finally {$handle.Dispose()}
`,
        );
        const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', wrapperPath], {
          cwd: fixture.directory,
          env: Object.fromEntries(
            ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
              (name) => (process.env[name] === undefined ? [] : [[name, process.env[name]]]),
            ),
          ),
          windowsHide: true,
          encoding: 'utf8',
          timeout: 60000,
        });
        assert.equal(Boolean(result.stderr), false, 'Synthetic native stderr withheld');
        const projection = JSON.parse(result.stdout.trim());
        assert.equal(result.status, 0, JSON.stringify(projection));
        assert.equal(projection.publicReady, true, JSON.stringify(projection));
        assert.equal(projection.stderrObserved, false);
        assert.equal(projection.privateRead, false);
        assert.equal(
          existsSync(
            join(
              fixture.directory,
              `scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-${profile.technicalOrdinal}-attempt.json`,
            ),
          ),
          false,
        );
      } catch (error) {
        primaryFailure = error;
        throw error;
      } finally {
        try {
          fixture.cleanup();
        } catch (error) {
          if (primaryFailure)
            throw new AggregateError([primaryFailure, error], 'SYNTHETIC_PUBLIC_RUN_AND_CLEANUP_FAILED');
          throw error;
        }
      }
    },
  );
