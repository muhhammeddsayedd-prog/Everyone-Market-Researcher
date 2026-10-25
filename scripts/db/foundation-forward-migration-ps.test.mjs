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
  appendFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep, dirname } from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { syntheticProjectVerifiedContinuation } from '../n8n/foundation-live-project-verified-fixtures.mjs';

const consumer = resolve('scripts/db/windows/Invoke-M03FoundationMigrations.ps1');
const technical18NoReactivationSha256 = '92a5976dbce66210abbdd76655afaf71a98c9c48f29c8c15422831a85f3737d9';
const technical20NoReactivationSha256 = 'd5f4353439ff6a3254f71609048ff43aa1d453308b5708bd968182ce959bf983';
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const definitions = (names, file = consumer) => `
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(file)},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'PUBLIC_SOURCE_PARSE_FAILED'}
foreach($name in @(${[...new Set([...(file.endsWith('Foundation-AdminControl.ps1') ? ['Foundation-ForwardWindowId'] : ['Assert-FoundationHistoricalIdentityAbsent', 'Read-FoundationTechnical18NoReactivation']), ...names])].map(quote).join(',')})){
 $functions=@($ast.FindAll({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true))
 if($functions.Count -ne 1){throw 'EXPECTED_FUNCTION_MISSING'};Invoke-Expression $functions[0].Extent.Text
}`;
function run(code, timeout = 15000) {
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
      timeout,
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

test(
  'technical19 SELECT-only inspection pins closed19 and rejects progress or a changed six-window family',
  native,
  () => {
    const receipt = JSON.parse(
      readFileSync(
        resolve('milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-20261024.json'),
        'utf8',
      ),
    );
    const value = structuredClone(receipt.rawResult.archiveAfter);
    Object.assign(value, {
      windowId: 'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
      familyWindowCount: 6,
      globalAdmittedCount: 11,
      globalRequestCount: 5,
      fixtureAuditCount: 8,
      technical19Exact: true,
    });
    Object.assign(value.window, {
      id: value.windowId,
      audience: 'https://everyone-market-researcher-punvhefs2-muhammed-abdelrahman.vercel.app',
      commitSha: 'effa3de9e1fee6c3f3c08fc347a5e3175db14c80',
      deploymentId: 'dpl_8Qy4Ywx8aEZ6j3ueVm3TaAP7LB3Y',
      startsAt: '2026-10-25T00:35:34+00:00',
      expiresAt: '2026-10-25T01:35:34+00:00',
      closedAt: '2026-10-25T00:36:16+00:00',
    });
    assert.equal(
      run(String.raw`
${definitions(['Assert-Keys', 'Assert-Path', 'File-Hash', 'Read-Json', 'Read-FoundationTechnical19Closed', 'Foundation-Technical13FamilyPredicate', 'Foundation-Technical16FamilyPredicate', 'Foundation-Technical19FamilyPredicate', 'Foundation-Technical13AuditPredicate', 'Foundation-Technical13InspectionSql', 'Read-FoundationInspection', 'Assert-FoundationArchiveInspection'])}
$repo=${quote(process.cwd())};$TechnicalResidual19=$true;$TechnicalResidual16=$false;$TechnicalResidual13=$false;$InspectOnly=$true;$projectRef='zmotjsbzhzjvpelxvxlf'
function Get-CimInstance{return @()}
$expected=Read-FoundationTechnical19Closed
$sql=Foundation-Technical13InspectionSql -Technical19 $true
if($sql -notmatch 'count\(\*\)=6' -or $sql -notmatch 'coalesce\(sum\(admitted_count\),0\)=11' -or $sql -notmatch 'count\(\*\)=5' -or $sql -notmatch 'technical19Exact' -or $sql -notmatch 'edbc6d11-7c1f-43a7-b745-1ded06deb29f' -or $sql -cmatch '(?im)^\s*(update|insert|delete|alter|do|call)\b'){throw 'NON_READ_ONLY19_SQL'}
$json=${quote(JSON.stringify([{ inspection: value }]))}
$result=[pscustomobject]@{ok=$true;closed=$true;text=$json}
$parsed=Read-FoundationInspection $result;Assert-FoundationArchiveInspection $parsed $expected $true
foreach($key in @('familyWindowCount','globalAdmittedCount','globalRequestCount','fixtureAuditCount','activeLeaseCount','launchCount','collectedItemCount')){
 $changed=ConvertFrom-Json $json;$changed[0].inspection.$key++;$denied=$false
 try{$bad=Read-FoundationInspection ([pscustomobject]@{ok=$true;closed=$true;text=ConvertTo-Json -InputObject $changed -Depth 30 -Compress});Assert-FoundationArchiveInspection $bad $expected $true}catch{$denied=$true};if(-not $denied){throw 'CHANGED19_FAMILY_ACCEPTED'}
}
foreach($key in @('familyClosed','technical12Exact','technical13Exact','technical16Exact','technical19Exact')){
 $changed=ConvertFrom-Json $json;$changed[0].inspection.$key=$false;$denied=$false
 try{$null=Read-FoundationInspection ([pscustomobject]@{ok=$true;closed=$true;text=ConvertTo-Json -InputObject $changed -Depth 30 -Compress})}catch{$denied=$true};if(-not $denied){throw 'CHANGED19_AUDIT_ACCEPTED'}
}
Write-Output 'TECHNICAL19_READ_ONLY_PASS'
`),
      'TECHNICAL19_READ_ONLY_PASS',
    );
  },
);

test(
  'historical native identities distinguish reused PIDs without treating observation as closure',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-FoundationHistoricalIdentityAbsent'])}
$script:rows=@();$script:second=$null;$script:reads=0;$script:query=''
function Get-CimInstance($ClassName,$Filter,$Property,$ErrorAction){
 if($ClassName -cne 'Win32_Process' -or ($Property -join ',') -cne 'ProcessId,ParentProcessId,CreationDate' -or $ErrorAction -cne 'Stop'){throw 'NON_PUBLIC_PROCESS_PROJECTION'}
 $script:query=$Filter;$script:reads++;if($script:reads -eq 2 -and $null -ne $script:second){return $script:second};return $script:rows
}
$now=[DateTimeOffset]::UtcNow;$bound=$now.AddMinutes(-5).ToUnixTimeMilliseconds();$new=$now.AddMinutes(-1).UtcDateTime
function Probe($Rows,$Second=$null,$Anchor=$bound){$script:rows=$Rows;$script:second=$Second;$script:reads=0;$null=Assert-FoundationHistoricalIdentityAbsent 59876 $Anchor;if($script:reads -ne 2){throw 'IDENTITY_NOT_READ_TWICE'}}
Probe @()
$parent=[pscustomobject]@{ProcessId=59876;ParentProcessId=1;CreationDate=$new}
Probe @($parent)
Probe @($parent) -Anchor $now.AddMinutes(-5).UtcDateTime.ToString('o')
if($script:query -cne 'ProcessId = 59876'){throw 'HISTORICAL_ID_FILTER_CHANGED'}
foreach($fault in @('older','equal','sameMillisecond','futureBirth','unknownBirth','unknownKind','wrongPid','duplicate','unknownAnchor','futureAnchor','changingBirth','changingParent','appeared','disappeared')){
 $rows=@([pscustomobject]@{ProcessId=59876;ParentProcessId=1;CreationDate=$new});$second=$null;$anchor=$bound
 switch($fault){
  'older'{$rows[0].CreationDate=[DateTimeOffset]::FromUnixTimeMilliseconds($bound-1).UtcDateTime}
  'equal'{$rows[0].CreationDate=[DateTimeOffset]::FromUnixTimeMilliseconds($bound).UtcDateTime}
  'sameMillisecond'{$rows[0].CreationDate=[DateTimeOffset]::FromUnixTimeMilliseconds($bound).UtcDateTime.AddTicks(1)}
  'futureBirth'{$rows[0].CreationDate=$now.AddHours(1).UtcDateTime}
  'unknownBirth'{$rows[0].CreationDate='unknown'}
  'unknownKind'{$rows[0].CreationDate=[DateTime]::SpecifyKind($new,[DateTimeKind]::Unspecified)}
  'wrongPid'{$rows[0].ProcessId=123}
  'duplicate'{$rows+=($rows[0])}
  'unknownAnchor'{$anchor='unknown'}
  'futureAnchor'{$anchor=$now.AddHours(1).ToUnixTimeMilliseconds()}
  'changingBirth'{$second=@([pscustomobject]@{ProcessId=59876;ParentProcessId=1;CreationDate=$new.AddSeconds(1)})}
  'changingParent'{$second=@([pscustomobject]@{ProcessId=59876;ParentProcessId=2;CreationDate=$new})}
  'appeared'{$second=$rows;$rows=@()}
  'disappeared'{$second=@()}
 }
 $denied=$false;try{Probe $rows $second -Anchor $anchor}catch{$denied=$true};if(-not $denied){throw ('UNKNOWN_HISTORICAL_IDENTITY_ACCEPTED_'+$fault)}
}
Write-Output 'HISTORICAL_IDENTITY_ONLY_NOT_CLOSURE_OR_CURRENT_ANCESTRY'
`),
      'HISTORICAL_IDENTITY_ONLY_NOT_CLOSURE_OR_CURRENT_ANCESTRY',
    );
  },
);

test(
  'technical16 archive requires a separately pinned typed native settlement and exact durable deletion accounting',
  native,
  () => {
    // Synthetic validator contract only. The real settlement pin cannot authorize
    // this fixture; no live qualification, credential or database is created.
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical16-settlement-'));
    const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
    const put = (path, value) => {
      const target = join(directory, path);
      mkdirSync(dirname(target), { recursive: true });
      const text = typeof value === 'string' ? value : JSON.stringify(value) + '\n';
      writeFileSync(target, text);
      return digest(text);
    };
    const original =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json';
    const resolution =
      'milestones/M03-n8n-foundation/evidence/technical16-executed-parameters-resolution-20261024.json';
    const attempt = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt7.json';
    const journal = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt7.jsonl';
    const result = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt7-result.json';
    const failed = 'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt1-20261024.json';
    const oldOnce = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt.json';
    const oldJournal = 'scripts/n8n/out/foundation/technical16-native-cleanup.jsonl';
    const oldSeal = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.provision-seal.json';
    const oldLock = 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.runtime-lock';
    const priorFailed = [
      ...[2, 3, 4, 5, 6].flatMap((ordinal) => [
        `milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt${ordinal}-20261024.json`,
        ...['.json', '.jsonl', '-result.json', '.provision-seal.json', '.runtime-lock'].map(
          (suffix) => `scripts/n8n/out/foundation/technical16-native-cleanup-attempt${ordinal}${suffix}`,
        ),
      ]),
    ];
    const probePins = {
      'milestones/M03-n8n-foundation/evidence/technical16-wf32-discovery-readback-20261024.json':
        '9a6463326e06719dc0a4123145df96f49ebcf9f4125be81f727f496f5f635c39',
      'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.jsonl':
        '54f2981b2d0faaa4b71793de2d5eaa59d22161657a449c4244ad3ceddbdb10f2',
      'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.inventory-seal.json':
        '985fb551e12a66e106c267a2fd43e4fb8a15194d76f50fd35d828c2474809cc4',
      'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.foundation-seal.json':
        '12575579756a116397b7e0249e7ed37d99398fe7fd211056ac2007b885b8387e',
      'milestones/M03-n8n-foundation/evidence/technical16-public-transport-diagnostics-20261024.json':
        '6185e8af680ebd245a63b33e5fbd8390bd6804e71a994d9fe30db190016789bc',
      'scripts/n8n/out/foundation/technical16-public-transport-diagnostic-20261024.jsonl':
        'db7a307dff3cf2b357bdacdba093614f75a7d371f064ae630ca40f384693b797',
      'scripts/n8n/out/foundation/technical16-native-public-transport-diagnostic-20261024.jsonl':
        '693802c29a5ce12e3ca290e4c80ea3d0d0790394e24eb93e1629c3e9d7100767',
      'scripts/n8n/out/foundation/technical16-native-public-transport-diagnostic-20261024-result.json':
        '822d47f80da7e71ca512463d69fbf6f358f5d45a21a245cb2f8d00d0fcffd287',
      'scripts/n8n/out/foundation/technical16-public-tls-timing-20261024.json':
        'd33f411b5cf69f3b95bb96b0178b721946672530f05c3ec10a632b8b0b01dd2b',
    };
    const actualPrior = {
      [failed]: '4f0697080d9bd1ff728b48d9c159f4cbe6f61ebaa04d19ec295da14c3e297960',
      [oldOnce]: '1e165ea75442200af05e57206c32cd0edc07c248571a1405ae8025e31588e66e',
      [oldJournal]: '4fccea19e19a162ca2d7b912c200a0cb1fc857b9ea54d4bdf5b6f97f76dd71d7',
      [oldSeal]: '9aade5d3ae4c4a0a3aace8da74c38e3b0c9f1da672d7187c7ff1b14aeee9ca1b',
      [oldLock]: 'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f',
      ...Object.fromEntries(
        priorFailed.map((path, index) => [
          path,
          [
            '5b2f8e590876f37d89aad2a35151e07489c4601111af09c27b01268f43df0c57',
            '86e74f0c574384e33c28721b345899476d198d49e91501c3f37d8a27f9361639',
            'bac9e865ea04c6f083dc836e2e71e0cd37a58dc542a5f03af7ed06767b66ee17',
            'efa7b2812baf34f520eac9bea4337b5197bfc680244acaaabe6fcead8a55c137',
            '45a924660d94d87a5fc9eab45307c550a74288b6556873633c39b571c37b62be',
            'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f',
            '886da0004471f526d0767c3e60a5c1474bb38f439f022ab3edd162efdeb412ae',
            '6319abe719e5fb40d0e77e83376ef39a625c341e9195f055255b435029016a61',
            '0e6c97a10ee2aca0c1171f09a63dcc4b536a8df58e3061cb804d7fac98ab6f27',
            '5609476a03848f524398f3e72ca614d1a5e6390cc8b9e287ac1bc9ff95c972c5',
            '0e7051051f4e605b42da8da40261237f9682f492860d1c05ace19a5b79b90af5',
            'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f',
            '68fecd32ceda855b5f522bf9448f5fa94c1411dc4bd4950ea6d7a3979602bc72',
            '9c5a07ff9c23ebf14cabf96c245ec8fe4d0eeca4a2b13c2c50e918a90a84b7de',
            '76d3b6b1fa4367e9a2ecfa79eab0fd4f2dbfd26402f8bd224a0945541aa7f62d',
            '7c4f4923a985842d4286c603810449c08ec305a7a0c721a689b9e040cd739ebf',
            '41a6afc82524105adb2f522c78abc63a9e6dddcec4898969d11facefe193cab7',
            'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f',
            '7aa4ab07f9be3f837a49cbc69dbedc2c19720493740e05157ff852b9161ced55',
            'ab3ad645c29b1d21db2a1df3b9f5b968b8c0c6774a2f79a0eabeabf70ffa36bb',
            '8c3e54a720e0d9488a7e8026c88c95103430d790d9cb5caecd71cbf018a2b970',
            '199e4499e30e362a5a72048846e782dd08a25afb444bd43aaf9467ffeb38d02a',
            '968943a6f5de2322a48ab6cbfe514d6a80e750ea0356978448d82b843e50dfc3',
            'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f',
            '1bf2243210b417b8ea7d2ed360adc3c026796a57271c7488f664acc145673a7d',
            '2a814ff7c93f2734322796b1214c806cdd8580420933de52f44862024fb54927',
            '59a30c4ec18a34c2c49773a61534e4e2149d4bdc73bf8fd45976b06eb7d801e4',
            '85982e616aaac3b37654e70e4c562410e44449ed65944a6d93aacae4c369cc19',
            '162ae09e991e6a18b8c6969663e0c9f71d1b7d7661ba7dc10ec1d41f9f8e7d22',
            'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f',
          ][index],
        ]),
      ),
      ...probePins,
    };
    const settlement = 'milestones/M03-n8n-foundation/evidence/technical16-native-settlement-20261024.json';
    const settlementPinDeclaration = readFileSync(consumer, 'utf8').match(
      /\$settlementSha256=(?:\$null|'[a-f0-9]{64}')/,
    )?.[0];
    assert.ok(settlementPinDeclaration);
    const source = '5087d4d93d2f6ffdca0bc0096b365723005446fc';
    const windowId = '4c602549-2c42-4ec3-9328-714d7cb66a77';
    try {
      const originalSha = put(original, '{}\n'),
        resolutionSha = put(resolution, '{"synthetic":true}\n');
      const prior = {
        [failed]: put(failed, { synthetic: 'failed-entry' }),
        [oldOnce]: put(oldOnce, { synthetic: 'once1' }),
        [oldJournal]: put(oldJournal, { event: 'technical16_cleanup_header', version: 1 }),
        [oldSeal]: put(oldSeal, { synthetic: 'seal1' }),
        [oldLock]: put(oldLock, 'emr-m03-foundation-live-runtime-v1\n'),
      };
      for (const path of priorFailed)
        prior[path] = put(
          path,
          path.endsWith('.runtime-lock') ? 'emr-m03-foundation-live-runtime-v1\n' : { synthetic: path },
        );
      for (const path of Object.keys(probePins)) prior[path] = put(path, { synthetic: path });
      const sixthFailed = priorFailed[24],
        sixthOnce = priorFailed[25],
        sixthJournal = priorFailed[26];
      const continuation = {
        cleanupAttempt: 7,
        priorFailedAttemptSha256: prior[sixthFailed],
        priorOnceSha256: prior[sixthOnce],
        priorJournalSha256: prior[sixthJournal],
      };
      const substitutePriorPins = Object.entries(actualPrior)
        .map(([path, hash]) => `.Replace('${hash}','${prior[path]}')`)
        .join('');
      const bindings = readFileSync('n8n/foundation/bindings.dev.json');
      put('n8n/foundation/bindings.dev.json', bindings.toString());
      const ids = Object.values(JSON.parse(bindings).workflowRefs).map((row) => row.id);
      const requests = [];
      const add = (kind, workflowId, executionId) =>
        requests.push({
          event: 'technical16_http_intent',
          ordinal: requests.length + 1,
          kind,
          workflowId,
          ...(executionId ? { executionId } : {}),
          managementAttempts: 879 + requests.length,
          controlAttempts: 1010 + requests.length,
          at: '2026-10-24T18:00:00.000Z',
        });
      for (const [id, wf] of [
        ['31130', 'MzimjpsuyPuK7SKe'],
        ['31131', '4JMHLDBSdgGxhPlk'],
      ]) {
        add('metadata', wf, id);
        add('full', wf, id);
      }
      for (const id of ids) {
        add('discovery', id);
        add('discovery', id);
      }
      for (const id of ids) add('workflow', id);
      add('metadata', '4JMHLDBSdgGxhPlk', '31131');
      add('metadata', 'MzimjpsuyPuK7SKe', '31130');
      const rows = [
        {
          event: 'technical16_cleanup_header',
          version: 1,
          resolutionSha256: resolutionSha,
          originalAttemptSha256: originalSha,
          ...continuation,
        },
        ...requests,
      ];
      for (const [i, [id, wf]] of [
        ['31131', '4JMHLDBSdgGxhPlk'],
        ['31130', 'MzimjpsuyPuK7SKe'],
      ].entries()) {
        rows.push({ event: 'native_cleanup_evidence', executionId: id, workflowId: wf });
        rows.push({
          event: 'native_cleanup_intent',
          batchId: 'technical16-postclose-native-cleanup',
          caseId: 'dispatch.vimeo-reconciliation',
          executionId: id,
          workflowId: wf,
          ordinal: i + 1,
          at: '2026-10-24T18:00:00.000Z',
        });
        add('delete', wf, id);
        rows.push(requests.at(-1));
        rows.push({
          event: 'native_cleanup_absence_intent',
          batchId: 'technical16-postclose-native-cleanup',
          caseId: 'dispatch.vimeo-reconciliation',
          executionId: id,
          workflowId: wf,
          ordinal: i + 1,
          at: '2026-10-24T18:00:00.000Z',
        });
        add('absence', wf, id);
        rows.push(requests.at(-1));
        rows.push({
          event: 'native_cleanup_result',
          batchId: 'technical16-postclose-native-cleanup',
          caseId: 'dispatch.vimeo-reconciliation',
          executionId: id,
          workflowId: wf,
          state: 'native_record_deleted',
          deleteAcknowledged: true,
          absenceVerified: true,
          residual: false,
          at: '2026-10-24T18:00:00.000Z',
        });
      }
      const n = requests.length;
      assert.equal(n, 85);
      const inner = {
        kind: 'm03_technical16_native_cleanup',
        version: 1,
        environment: 'dev',
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        windowId,
        sourceCommitSha: source,
        status: 'native_cleanup_verified',
        requestCount: n,
        controlRequestCount: n,
        managementAttempts: 878 + n,
        controlAttempts: 1009 + n,
        combinedAttempts: 1887 + 2 * n,
        canonicalWorkflowsVerified: 25,
        qualifiedSideEffects: true,
        recordsDeleted: 2,
        deleteAcknowledged: true,
        absenceVerified: true,
        remoteWorkSettled: true,
        networkCompletionVerified: true,
        originalPublicRecordsUnchanged: true,
        nativeAcceptanceProven: false,
        originalMaskedFirstFailureRecovered: false,
        executionCount: 0,
        actorStarts: 0,
        workflowWrites: 0,
        credentialWrites: 0,
        migrationOperations: 0,
        diagnosticStage: 'complete',
        diagnosticCode: 'none',
      };
      const usage = {
        management: 878 + n,
        control: 1009 + n,
        combined: 1887 + 2 * n,
        vercel: 184,
        nativeExecutionsReserved: 3,
        actorStarts: 0,
        providerReads: 0,
      };
      const pins = {
        ...prior,
        [original]: originalSha,
        [resolution]: resolutionSha,
        [attempt]: put(attempt, {
          kind: 'm03_technical16_cleanup_once',
          version: 1,
          ...continuation,
          resolutionSha256: resolutionSha,
          executionIds: ['31131', '31130'],
          processId: 111,
          parentProcessId: 222,
          usage: { management: 878, control: 1009, combined: 1887 },
          maximumRequests: 109,
          maximumControlRequests: 109,
          at: '2026-10-24T18:00:00.000Z',
        }),
        [journal]: put(journal, rows.map((row) => JSON.stringify(row) + '\n').join('')),
        [result]: put(result, inner),
      };
      assert.equal(Object.keys(pins).length, 49);
      put(settlement, {
        kind: 'm03_technical16_native_settlement',
        version: 1,
        environment: 'dev',
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        technicalAttempt: 16,
        windowId,
        sourceCommitSha: source,
        originalAttemptSha256: originalSha,
        resolutionSha256: resolutionSha,
        outerNativeExit: 0,
        rawResult: {
          ...inner,
          nativeExit: 0,
          childClosed: true,
          credentialChildrenClosed: true,
          parentLockDeleted: true,
          privateRead: true,
          persistentManagementRetained: true,
        },
        cleanup: {
          parentAbsent: true,
          childAbsent: true,
          parentLockAbsent: true,
          runtimeLockAbsent: true,
          persistentManagementRetained: true,
          privateContentsRead: false,
          networkRequests: 0,
        },
        pins,
        usage,
      });
      assert.equal(
        run(
          `
${definitions(['Assert-Keys', 'Assert-Path', 'File-Hash', 'Read-Json', 'Assert-FoundationTechnical16Settled'])}
$repo=${quote(directory)};$projectRef='zmotjsbzhzjvpelxvxlf';$script:liveParent=$false
function Get-CimInstance{if($script:liveParent){return @([pscustomobject]@{ProcessId=111})};return @()}
$expected=[pscustomobject]@{id='${windowId}';commitSha='${source}'}
$denied=$false;try{$null=Assert-FoundationTechnical16Settled $expected}catch{$denied=$true};if(-not $denied){throw 'REAL_PIN_AUTHORIZED_SYNTHETIC_FIXTURE'}
$fn=(Get-Command Assert-FoundationTechnical16Settled).ScriptBlock.ToString().Replace(${quote(settlementPinDeclaration)},'$settlementSha256=$script:syntheticSettlementSha').Replace('d6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb','${originalSha}').Replace('e0c919ab2a12aa9306be3d2b3656b7d0c43d97c21ddc6376ffa12bbfbb89d07b','${resolutionSha}')${substitutePriorPins}
Set-Item -Path Function:Assert-FoundationTechnical16Settled -Value ([scriptblock]::Create($fn))
$file=Join-Path $repo ${quote(settlement)};$original=Read-Json $file;$journal=Join-Path $repo ${quote(journal)};$saved=[IO.File]::ReadAllText($journal)
$oncePath=Join-Path $repo ${quote(attempt)};$savedOnce=[IO.File]::ReadAllText($oncePath)
$resultPath=Join-Path $repo ${quote(result)};$savedInner=[IO.File]::ReadAllText($resultPath)
function Persist($v){[IO.File]::WriteAllText($file,($v|ConvertTo-Json -Depth 30 -Compress)+[char]10,[Text.UTF8Encoding]::new($false));$script:syntheticSettlementSha=File-Hash $file}
function Add-Retry($r,[string]$Kind,[string]$WorkflowId=''){
 $previous=@($r|Where-Object{$_.event -ceq 'technical16_http_intent' -and $_.kind -ceq $Kind -and ($WorkflowId -ceq '' -or $_.workflowId -ceq $WorkflowId)})[0];$index=[array]::IndexOf($r,$previous)
 $copy=$previous|ConvertTo-Json -Depth 12|ConvertFrom-Json;$copy|Add-Member NoteProperty retryOf 0
 return @($r[0..$index])+@($copy)+@($r[($index+1)..($r.Count-1)])
}
function Set-CoherentJournal($v,$r,[bool]$Relink=$true){
 $http=@($r|Where-Object{$_.event -ceq 'technical16_http_intent'})
 for($i=0;$i -lt $http.Count;$i++){$http[$i].ordinal=$i+1;$http[$i].managementAttempts=879+$i;$http[$i].controlAttempts=1010+$i;if($Relink -and $null -ne $http[$i].PSObject.Properties['retryOf']){$http[$i].retryOf=$i}}
 $count=$http.Count;$v.rawResult.requestCount=$count;$v.rawResult.controlRequestCount=$count;$v.rawResult.managementAttempts=878+$count;$v.rawResult.controlAttempts=1009+$count;$v.rawResult.combinedAttempts=1887+2*$count
 $v.usage.management=$v.rawResult.managementAttempts;$v.usage.control=$v.rawResult.controlAttempts;$v.usage.combined=$v.rawResult.combinedAttempts
 $inner=ConvertFrom-Json $savedInner;foreach($key in @('requestCount','controlRequestCount','managementAttempts','controlAttempts','combinedAttempts')){$inner.$key=$v.rawResult.$key}
 [IO.File]::WriteAllText($resultPath,($inner|ConvertTo-Json -Depth 12 -Compress)+[char]10,[Text.UTF8Encoding]::new($false));$v.pins.${quote(result)}=File-Hash $resultPath
 [IO.File]::WriteAllText($journal,(($r|ForEach-Object{$_|ConvertTo-Json -Depth 12 -Compress}) -join [char]10)+[char]10,[Text.UTF8Encoding]::new($false));$v.pins.${quote(journal)}=File-Hash $journal
}
Persist $original;$verified=Assert-FoundationTechnical16Settled $expected;if($verified.rawResult.recordsDeleted -ne 2){throw 'TYPED_FIXTURE_FAILED'}
foreach($kinds in @(@('metadata'),@('full','workflow','discovery'))){
 $v=$original|ConvertTo-Json -Depth 30|ConvertFrom-Json;$r=@($saved.TrimEnd([char]10) -split [char]10|ForEach-Object{ConvertFrom-Json $_})
 foreach($kind in $kinds){$r=Add-Retry $r $kind}
 Set-CoherentJournal $v $r;Persist $v;$verified=Assert-FoundationTechnical16Settled $expected
 if($verified.rawResult.requestCount -ne 85+$kinds.Count -or $verified.usage.management -ne 963+$kinds.Count){throw 'RETRY_CHARGE_COALESCED'}
}
$v=$original|ConvertTo-Json -Depth 30|ConvertFrom-Json;$r=@($saved.TrimEnd([char]10) -split [char]10|ForEach-Object{ConvertFrom-Json $_})
foreach($id in @((Read-Json (Join-Path $repo 'n8n/foundation/bindings.dev.json')).workflowRefs.PSObject.Properties|ForEach-Object{$_.Value.id}|Select-Object -First 21)){$r=Add-Retry $r 'workflow' $id}
$r=Add-Retry $r 'metadata' 'MzimjpsuyPuK7SKe';$r=Add-Retry $r 'metadata' '4JMHLDBSdgGxhPlk';$r=Add-Retry $r 'full' 'MzimjpsuyPuK7SKe'
Set-CoherentJournal $v $r;Persist $v;$verified=Assert-FoundationTechnical16Settled $expected;if($verified.rawResult.requestCount -ne 109 -or $verified.usage.management -ne 987 -or $verified.usage.control -ne 1118 -or $verified.usage.combined -ne 2105){throw 'MAXIMUM_RAW_RETRY_CHARGES_CHANGED'}
$r=Add-Retry $r 'full' '4JMHLDBSdgGxhPlk';Set-CoherentJournal $v $r;Persist $v;$denied=$false;try{$null=Assert-FoundationTechnical16Settled $expected}catch{$denied=$true};if(-not $denied){throw 'RAW_REQUEST_110_ACCEPTED'}
foreach($missing in @(${[...priorFailed.slice(24), ...Object.keys(probePins).slice(4)].map(quote).join(',')})){
 $v=$original|ConvertTo-Json -Depth 30|ConvertFrom-Json
 [IO.File]::WriteAllText($journal,$saved,[Text.UTF8Encoding]::new($false));[IO.File]::WriteAllText($resultPath,$savedInner,[Text.UTF8Encoding]::new($false));[IO.File]::WriteAllText($oncePath,$savedOnce,[Text.UTF8Encoding]::new($false))
 $v.pins.PSObject.Properties.Remove($missing);Persist $v
 $denied=$false;try{$null=Assert-FoundationTechnical16Settled $expected}catch{$denied=$true};if(-not $denied){throw 'NEW_CUSTODY_PIN_OMITTED'}
}
foreach($fault in @('kindArray','outerType','nativeExit','requestType','wrongCount','acceptance','masked','childOpen','noParentCleanup','noManagement','notSettled','missingAck','missingAbsence','recordsOne','wrongSource','wrongIds','extraPin','wrongPin','journalDrift','ordinalDrift','foreignWorkflow','duplicateDelete','incompleteCanonical','lostAck','liveParent','wrongUsage','attemptType','priorOnceMismatch','missingFailedPin','headerAttempt','missingSecondPin','missingThirdPin','missingThirdMarker','priorThirdMismatch','refilledMaximum','counterReset','missingFourthPin','missingFourthMarker','missingProbePin','missingProbeJournal','preProbeCounterReset','missingFifthPin','missingFifthMarker','staleFifthBase','staleSixthBase','retryString','retryNull','retryForward','retryOrphan','retryChain','retryKind','retryWorkflow','retryExecution','retryDelete','retryAbsence','retryRefund','retryHeader','retryEvidence')){
 $v=$original|ConvertTo-Json -Depth 30|ConvertFrom-Json;[IO.File]::WriteAllText($journal,$saved,[Text.UTF8Encoding]::new($false));$script:liveParent=$false
 [IO.File]::WriteAllText($oncePath,$savedOnce,[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText($resultPath,$savedInner,[Text.UTF8Encoding]::new($false))
 switch($fault){
  'kindArray'{$v.rawResult.kind=@('m03_technical16_native_cleanup')} 'outerType'{$v.outerNativeExit='0'} 'nativeExit'{$v.rawResult.nativeExit=1} 'requestType'{$v.rawResult.requestCount='85'} 'wrongCount'{$v.rawResult.requestCount=84} 'acceptance'{$v.rawResult.nativeAcceptanceProven=$true} 'masked'{$v.rawResult.originalMaskedFirstFailureRecovered=$true}
  'childOpen'{$v.rawResult.childClosed=$false} 'noParentCleanup'{$v.cleanup.parentLockAbsent=$false} 'noManagement'{$v.rawResult.persistentManagementRetained=$false} 'notSettled'{$v.rawResult.remoteWorkSettled=$false} 'missingAck'{$v.rawResult.deleteAcknowledged=$false} 'missingAbsence'{$v.rawResult.absenceVerified=$false} 'recordsOne'{$v.rawResult.recordsDeleted=1} 'wrongSource'{$v.sourceCommitSha='a'*40} 'wrongIds'{$v.windowId='00000000-0000-4000-8000-000000000001'} 'extraPin'{$v.pins|Add-Member NoteProperty unexpected ('a'*64)} 'wrongPin'{$v.pins.${quote(result)}='a'*64} 'journalDrift'{[IO.File]::AppendAllText($journal,'{}'+[char]10)} 'liveParent'{$script:liveParent=$true} 'wrongUsage'{$v.usage.nativeExecutionsReserved=0}
  'missingFailedPin'{$v.pins.PSObject.Properties.Remove(${quote(failed)})}
  'missingSecondPin'{$v.pins.PSObject.Properties.Remove(${quote(priorFailed[0])})}
  'missingThirdPin'{$v.pins.PSObject.Properties.Remove(${quote(priorFailed[6])})}
  'missingThirdMarker'{$v.pins.PSObject.Properties.Remove(${quote(priorFailed[11])})}
  'missingFourthPin'{$v.pins.PSObject.Properties.Remove(${quote(priorFailed[12])})}
  'missingFourthMarker'{$v.pins.PSObject.Properties.Remove(${quote(priorFailed[17])})}
  'missingFifthPin'{$v.pins.PSObject.Properties.Remove(${quote(priorFailed[18])})}
  'missingFifthMarker'{$v.pins.PSObject.Properties.Remove(${quote(priorFailed[23])})}
  'missingProbePin'{$v.pins.PSObject.Properties.Remove(${quote(Object.keys(probePins)[0])})}
  'missingProbeJournal'{$v.pins.PSObject.Properties.Remove(${quote(Object.keys(probePins)[1])})}
  'preProbeCounterReset'{$v.rawResult.managementAttempts--;$v.rawResult.controlAttempts--;$v.rawResult.combinedAttempts-=2;$v.usage.management--;$v.usage.control--;$v.usage.combined-=2}
  'counterReset'{$v.rawResult.managementAttempts-=8;$v.rawResult.controlAttempts-=8;$v.rawResult.combinedAttempts-=16;$v.usage.management-=8;$v.usage.control-=8;$v.usage.combined-=16}
  'staleFifthBase'{$v.rawResult.managementAttempts-=11;$v.rawResult.controlAttempts-=11;$v.rawResult.combinedAttempts-=22;$v.usage.management-=11;$v.usage.control-=11;$v.usage.combined-=22}
  'staleSixthBase'{$v.rawResult.managementAttempts-=4;$v.rawResult.controlAttempts-=4;$v.rawResult.combinedAttempts-=8;$v.usage.management-=4;$v.usage.control-=4;$v.usage.combined-=8}
  {$_ -cin @('attemptType','priorOnceMismatch','priorThirdMismatch','refilledMaximum')} {
   $o=ConvertFrom-Json $savedOnce;if($fault -ceq 'attemptType'){$o.cleanupAttempt='7'}elseif($fault -ceq 'refilledMaximum'){$o.maximumRequests=113;$o.maximumControlRequests=113}elseif($fault -ceq 'priorThirdMismatch'){$o.priorFailedAttemptSha256=$v.pins.${quote(failed)}}else{$o.priorOnceSha256='a'*64}
   [IO.File]::WriteAllText($oncePath,($o|ConvertTo-Json -Depth 20 -Compress)+[char]10,[Text.UTF8Encoding]::new($false));$v.pins.${quote(attempt)}=File-Hash $oncePath
  }
  {$_ -clike 'retry*'} {
   $r=@($saved.TrimEnd([char]10) -split [char]10|ForEach-Object{ConvertFrom-Json $_})
   if($fault -ceq 'retryHeader' -or $fault -ceq 'retryEvidence'){$target=if($fault -ceq 'retryHeader'){$r[0]}else{@($r|Where-Object{$_.event -ceq 'native_cleanup_evidence'})[0]};$target|Add-Member NoteProperty retryOf 1;Set-CoherentJournal $v $r}
   elseif($fault -ceq 'retryDelete' -or $fault -ceq 'retryAbsence'){$kind=if($fault -ceq 'retryDelete'){'delete'}else{'absence'};$r=Add-Retry $r $kind;Set-CoherentJournal $v $r}
   else{
    $r=Add-Retry $r 'metadata';Set-CoherentJournal $v $r;$retry=@($r|Where-Object{$null -ne $_.PSObject.Properties['retryOf']})[0]
    switch($fault){
     'retryString'{$retry.retryOf=[string]$retry.retryOf} 'retryNull'{$retry.retryOf=$null} 'retryForward'{$retry.retryOf=$retry.ordinal+1} 'retryOrphan'{$r[1]|Add-Member NoteProperty retryOf 0}
     'retryChain'{$index=[array]::IndexOf($r,$retry);$copy=$retry|ConvertTo-Json -Depth 12|ConvertFrom-Json;$r=@($r[0..$index])+@($copy)+@($r[($index+1)..($r.Count-1)]);Set-CoherentJournal $v $r}
     'retryKind'{$retry.kind='full'} 'retryWorkflow'{$retry.workflowId='4JMHLDBSdgGxhPlk';$retry.executionId='31131'} 'retryExecution'{$retry.executionId='31131'}
     'retryRefund'{$v.rawResult.requestCount--;$v.rawResult.controlRequestCount--;$v.rawResult.managementAttempts--;$v.rawResult.controlAttempts--;$v.rawResult.combinedAttempts-=2;$v.usage.management--;$v.usage.control--;$v.usage.combined-=2}
    }
    if($fault -cne 'retryRefund'){Set-CoherentJournal $v $r $false}
   }
  }
  {$_ -cin @('ordinalDrift','foreignWorkflow','duplicateDelete','incompleteCanonical','lostAck','headerAttempt')} {
   $r=@($saved.TrimEnd([char]10) -split [char]10|ForEach-Object{ConvertFrom-Json $_})
   if($fault -ceq 'ordinalDrift'){$r[1].ordinal=2}
   if($fault -ceq 'foreignWorkflow'){$r[1].workflowId='foreign'}
   if($fault -ceq 'duplicateDelete'){$r+=($r|Where-Object{$_.event -ceq 'native_cleanup_intent'}|Select-Object -First 1)}
   if($fault -ceq 'incompleteCanonical'){$r=@($r|Where-Object{-not ($_.event -ceq 'technical16_http_intent' -and $_.kind -ceq 'workflow')})}
   if($fault -ceq 'lostAck'){($r|Where-Object{$_.event -ceq 'native_cleanup_result'}|Select-Object -First 1).deleteAcknowledged=$false}
   if($fault -ceq 'headerAttempt'){$r[0].cleanupAttempt=1}
   [IO.File]::WriteAllText($journal,(($r|ForEach-Object{$_|ConvertTo-Json -Depth 12 -Compress}) -join [char]10)+[char]10,[Text.UTF8Encoding]::new($false));$v.pins.${quote(journal)}=File-Hash $journal
  }
 }
 Persist $v;$denied=$false;try{$null=Assert-FoundationTechnical16Settled $expected}catch{$denied=$true};if(-not $denied){throw ('SETTLEMENT_ACCEPTED_'+$fault)}
}
Write-Output 'TYPED_SETTLEMENT7_49_PINS_RETRY_CONTRACT'
`,
          75000,
        ),
        'TYPED_SETTLEMENT7_49_PINS_RETRY_CONTRACT',
      );
    } finally {
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      rmSync(directory, { recursive: true });
    }
  },
);
test(
  'technical16 archive prior returns only its closed binding before actual SQL construction',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Path', 'Read-FoundationArchivePrior', 'Foundation-ArchiveFixtureSql', 'Foundation-Technical13ArchiveSql', 'Foundation-Technical13FamilyPredicate', 'Foundation-Technical16FamilyPredicate', 'Foundation-Technical13AuditPredicate'])}
${definitions(['Foundation-Literal', 'Foundation-FixtureSql'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$repo=${quote(resolve('.'))};$TechnicalResidual16=$true;$TechnicalResidual13=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false
$script:closedReads=0;$script:settlementChecks=0;$script:closedValid=$true;$script:settled=$true
$script:closedBinding=[pscustomobject]@{id='4c602549-2c42-4ec3-9328-714d7cb66a77';audience='https://everyone-market-researcher-synthetic.vercel.app';commitSha='5087d4d93d2f6ffdca0bc0096b365723005446fc';deploymentId='dpl_synthetic';closedAt='2026-10-24T16:00:00Z'}
function Read-FoundationTechnical16Closed{if(-not $script:closedValid){throw 'CLOSED_PROOF_REJECTED'};$script:closedReads++;return $script:closedBinding}
function Assert-FoundationTechnical16Settled($Expected){if(-not $script:settled -or -not [object]::ReferenceEquals($Expected,$script:closedBinding)){throw 'SETTLEMENT_REJECTED'};$script:settlementChecks++;return [pscustomobject]@{kind='m03_technical16_native_settlement';usage=[pscustomobject]@{management=963;control=1094;combined=2057}}}
$binding=Read-FoundationArchivePrior
$body=Foundation-ArchiveFixtureSql $binding
if(@($binding).Count -ne 1 -or -not [object]::ReferenceEquals($binding,$script:closedBinding) -or $script:closedReads -ne 1 -or $script:settlementChecks -ne 1){throw 'ARCHIVE_BINDING_PIPELINE_POLLUTED'}
foreach($needle in @("window_id='4c602549-2c42-4ec3-9328-714d7cb66a77' and bound_audience=","bound_commit_sha='5087d4d93d2f6ffdca0bc0096b365723005446fc'","M03_ARCHIVE_OWNERSHIP_OR_QUIESCENCE_CHANGED","technical-16")){if(-not $body.Contains($needle)){throw 'ARCHIVE_SQL_OWNER_OR_HISTORY_LOST'}}
$script:settled=$false;$denied=$false;try{$null=Read-FoundationArchivePrior}catch{$denied=$true};if(-not $denied){throw 'UNSETTLED_BINDING_EMITTED'}
$script:settled=$true;$script:closedValid=$false;$denied=$false;try{$null=Read-FoundationArchivePrior}catch{$denied=$true};if(-not $denied){throw 'UNCLOSED_BINDING_EMITTED'}
Write-Output 'SINGLE_CLOSED_ARCHIVE_BINDING_AND_SQL'
`),
      'SINGLE_CLOSED_ARCHIVE_BINDING_AND_SQL',
    );
  },
);

test(
  'technical16 zero-auth archive failure permits only its fixed untouched-prefix successor under owned locks',
  native,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-archive-preflight-successor-'));
    const failed =
      'milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-preflight-failure-20261024.json';
    const oldBase = 'scripts/db/out/m03-foundation-archive-4c602549-2c42-4ec3-9328-714d7cb66a77';
    const nextBase = oldBase + '-after-preflight-698498b3';
    const sourceRelative = 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1';
    const bytes = readFileSync(failed);
    const digest = (value) => createHash('sha256').update(value).digest('hex');
    assert.equal(digest(bytes), '635736c1bff404046d3805e356a6640bf8e5e2148434404a29bc85bc0095901d');
    try {
      for (const [path, data] of [
        [failed, bytes],
        [oldBase + '-latest.json', bytes],
        [sourceRelative, readFileSync(consumer)],
      ]) {
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        writeFileSync(join(directory, path), data);
      }
      const local = join(directory, 'local');
      const temp = join(directory, 'temp');
      mkdirSync(join(local, 'Temp'), { recursive: true });
      mkdirSync(temp);
      const scriptHash = digest(readFileSync(join(directory, sourceRelative)));
      assert.equal(
        run(`
${definitions(['Assert-Path', 'Assert-Keys', 'File-Hash', 'Read-Json', 'Assert-FoundationArchivePreflightContinuation'])}
$repo=${quote(directory)};$env:LOCALAPPDATA=${quote(local)};$env:TEMP=${quote(temp)};$env:TMP=${quote(temp)};$ArchiveFixture=$true;$TechnicalResidual16=$true
$packet=[pscustomobject]@{files=[pscustomobject]@{${quote(sourceRelative)}='${scriptHash}'}};$sessionLock=$null;$inspectParentLock=$null;$script:oldProcessLive=$false
function Get-CimInstance{if($script:oldProcessLive){return @([pscustomobject]@{ProcessId=22664;ParentProcessId=0})};return @()}
$failed=Join-Path $repo ${quote(failed)};$old=Join-Path $repo ${quote(oldBase + '-latest.json')};$oldAttempt=Join-Path $repo ${quote(oldBase + '-attempt.json')}
$nextAttempt=Join-Path $repo ${quote(nextBase + '-attempt.json')};$nextLatest=Join-Path $repo ${quote(nextBase + '-latest.json')};$saved=[IO.File]::ReadAllBytes($old)
$sourcePath=Join-Path $repo ${quote(sourceRelative)};$savedSource=[IO.File]::ReadAllBytes($sourcePath)
$scratch=Join-Path ([IO.Path]::GetTempPath()) 'emr-m03-foundation-dev-migrations-698498b3-bdbe-448a-b991-3a9eaee17197'
$public=Assert-FoundationArchivePreflightContinuation
if($public.attemptFile -cne $nextAttempt -or $public.latestFile -cne $nextLatest -or (File-Hash $old) -cne '635736c1bff404046d3805e356a6640bf8e5e2148434404a29bc85bc0095901d'){throw 'FIXED_SUCCESSOR_OR_OLD_BYTES_CHANGED'}
foreach($fault in @('missingCopy','changedCopy','missingLatest','changedLatest','oldAttempt','nextAttempt','nextLatest','scratchPresent','oldProcessLive','wrongMode')){
 try{
  switch($fault){
   'missingCopy'{[IO.File]::Delete($failed)} 'changedCopy'{[IO.File]::AppendAllText($failed,' ')} 'missingLatest'{[IO.File]::Delete($old)} 'changedLatest'{[IO.File]::AppendAllText($old,' ')}
   'oldAttempt'{[IO.File]::WriteAllText($oldAttempt,'{}')} 'nextAttempt'{[IO.File]::WriteAllText($nextAttempt,'{}')} 'nextLatest'{[IO.File]::WriteAllText($nextLatest,'{}')}
   'scratchPresent'{$null=[IO.Directory]::CreateDirectory($scratch)} 'oldProcessLive'{$script:oldProcessLive=$true} 'wrongMode'{$TechnicalResidual16=$false}
  }
  $denied=$false;try{$null=Assert-FoundationArchivePreflightContinuation}catch{$denied=$true};if(-not $denied){throw ('UNSAFE_PREFIX_ACCEPTED_'+$fault)}
 }finally{
  [IO.File]::WriteAllBytes($failed,$saved);[IO.File]::WriteAllBytes($old,$saved);foreach($path in @($oldAttempt,$nextAttempt,$nextLatest)){if(Test-Path -LiteralPath $path){[IO.File]::Delete($path)}}
  if(Test-Path -LiteralPath $scratch){[IO.Directory]::Delete($scratch)};$script:oldProcessLive=$false;$TechnicalResidual16=$true
 }
}
$denied=$false;try{$null=Assert-FoundationArchivePreflightContinuation $true}catch{$denied=$true};if(-not $denied){throw 'UNOWNED_LOCKS_ACCEPTED'}
$sessionPath=Join-Path $repo 'scripts/db/out/m03-foundation-dev-migration-session.lock';$parentPath=Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-acceptance-parent.operation.lock'
try{
 $sessionLock=[IO.File]::Open($sessionPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $inspectParentLock=[IO.File]::Open($parentPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
 $owner=[Text.UTF8Encoding]::new($false).GetBytes((([ordered]@{kind='m03_archive_parent';version=1;processId=$PID})|ConvertTo-Json -Compress));$inspectParentLock.Write($owner,0,$owner.Length);$inspectParentLock.Flush($true)
 $locked=Assert-FoundationArchivePreflightContinuation $true;if($locked.attemptFile -cne $nextAttempt){throw 'LOCKED_SUCCESSOR_CHANGED'}
 [IO.File]::AppendAllText($sourcePath,' ');$denied=$false;try{$null=Assert-FoundationArchivePreflightContinuation $true}catch{$denied=$true};if(-not $denied){throw 'CHANGED_EXECUTABLE_ACCEPTED'};[IO.File]::WriteAllBytes($sourcePath,$savedSource)
 if((File-Hash $old) -cne (File-Hash $failed) -or (Test-Path -LiteralPath $nextAttempt) -or (Test-Path -LiteralPath $nextLatest)){throw 'PUBLIC_CHECK_MUTATED_ARCHIVE_STATE'}
}finally{if($null -ne $inspectParentLock){$inspectParentLock.Dispose()};if($null -ne $sessionLock){$sessionLock.Dispose()}}
Write-Output 'FIXED_ZERO_AUTH_PREFIX_AND_OWNED_SUCCESSOR'
`),
        'FIXED_ZERO_AUTH_PREFIX_AND_OWNED_SUCCESSOR',
      );
    } finally {
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      rmSync(directory, { recursive: true });
    }
  },
);

test(
  'technical16 archive preparation reports only fixed stages before consuming any private value',
  native,
  () => {
    const source = readFileSync(consumer, 'utf8').replaceAll('\r\n', '\n');
    const start = source.indexOf(
      "try {\n  if($ArchiveFixture){$receipt['preparationStage']='SESSION_LOCK'}\n  $lockPath",
    );
    const end = source.indexOf('  $consumed = $true', start);
    const publicStart = source.indexOf(
      '  if($ArchiveFixture){\n    $archivePrior=Read-FoundationArchivePrior',
    );
    const publicEnd = source.indexOf('  if($PostcheckContinuation){', publicStart);
    assert.ok(start >= 0 && end > start && publicStart >= 0 && publicEnd > publicStart);
    assert.deepEqual(
      [...new Set([...source.matchAll(/\$receipt\['preparationStage'\]='([^']+)'/g)].map((m) => m[1]))],
      [
        'SESSION_LOCK',
        'NODE_PIN',
        'TLS_PROBE',
        'TLS_RECEIPT',
        'SCRATCH_SETUP',
        'READBACK_SQL',
        'ARCHIVE_SQL',
        'PRIVATE_METADATA',
        'complete',
      ],
    );
    const directory = mkdtempSync(join(tmpdir(), 'emr-archive-preparation-stages-'));
    try {
      for (const relative of ['scripts/db/out', 'scripts/seed', 'scripts/db', 'temp'])
        mkdirSync(join(directory, relative), { recursive: true });
      for (const [relative, text] of [
        ['scripts/seed/check-tls.mjs', 'PUBLIC_SYNTHETIC_ONLY'],
        ['scripts/db/foundation-inspect.sql', 'select 1;'],
        ['scripts/db/foundation-forward-postcheck.sql', 'select 2;'],
        ['node.exe', 'PUBLIC_SYNTHETIC_NODE'],
        ['ca.crt', 'PUBLIC_SYNTHETIC_CA'],
      ])
        writeFileSync(join(directory, relative), text);
      assert.equal(
        run(`
${definitions(['Assert-Path', 'Assert-Keys'])}
$repo=${quote(directory)};$out=Join-Path $repo 'scripts/db/out';$env:TEMP=Join-Path $repo 'temp';$env:TMP=$env:TEMP
$ArchiveFixture=$true;$TechnicalResidual16=$true;$TechnicalResidual13=$false;$ForwardMigration=$false;$PostcheckContinuation=$false;$InspectOnly=$false;$WriterClose=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false;$forwardSchema=$true
$originalPhaseAStart=$null;$clockAmendmentStart=$null;$postcheckContinuationStart=$null;$node=Join-Path $repo 'node.exe';$caPath=Join-Path $repo 'ca.crt';$caHash='PUBLIC_HASH';$poolerHost='aws-1-eu-central-1.pooler.supabase.com';$projectRef='zmotjsbzhzjvpelxvxlf';$runId='00000000-0000-4000-8000-000000000111';$handoff='SYNTHETIC_PRIVATE_PATH_NEVER_OPENED';$archivePrior=[pscustomobject]@{audience='PUBLIC'};$attemptFile=Join-Path $out 'successor-attempt.json'
$script:metadataReads=0;$script:fault='';$script:prefixChecks=0
function File-Hash($Path){if($script:fault -ceq 'NODE_PIN' -and $Path -ceq $node){return 'CHANGED'};return 'PUBLIC_HASH'}
function Assert-FoundationArchivePreflightContinuation([bool]$RequireLocks=$false){$script:prefixChecks++;if($script:fault -ceq 'SESSION_LOCK'){throw 'FIXED_SESSION_GATE'};return [pscustomobject]@{attemptFile=$attemptFile;latestFile=(Join-Path $out 'successor-latest.json')}}
function Invoke-Bounded{if($script:fault -ceq 'TLS_PROBE'){return [pscustomobject]@{ok=$false;closed=$true;text=''}};$status=if($script:fault -ceq 'TLS_RECEIPT'){'failed'}else{'verified'};return [pscustomobject]@{ok=$true;closed=$true;text=(([ordered]@{status=$status;phase='tls_handshake';code='TLS_VERIFIED';environment='dev';projectRef=$projectRef;host=$poolerHost;port=5432;rejectUnauthorized=$true;exactServerName=$true;scopedCaVerified=$true;startupMessageSent=$false;authenticationAttempted=$false;socketsClosed=$true})|ConvertTo-Json -Compress)}}
function Foundation-Technical13InspectionSql{return 'select 1;'}
function Foundation-ArchiveFixtureSql{if($script:fault -ceq 'ARCHIVE_SQL'){throw 'FIXED_SQL_CONSTRUCTOR'};return 'select 1;'}
function Assert-M03DevPrivateAcl{$script:metadataReads++;throw 'PRIVATE_METADATA_SENTINEL'}
function Write-NewJson($Path,$Value){[IO.File]::WriteAllText($Path,($Value|ConvertTo-Json -Compress))}
foreach($stage in @('SESSION_LOCK','NODE_PIN','TLS_PROBE','TLS_RECEIPT','SCRATCH_SETUP','READBACK_SQL','ARCHIVE_SQL','PRIVATE_METADATA')){
 $script:fault=$stage;$receipt=[ordered]@{childrenClosed=$true;scratchDeleted=$true};$consumed=$false;$scratch=$null;$sessionLock=$null;$script:metadataReads=0
 $packet=[pscustomobject]@{node=[pscustomobject]@{sha256='PUBLIC_HASH'};files=[pscustomobject]@{'scripts/db/foundation-inspect.sql'=$(if($stage -ceq 'READBACK_SQL'){'CHANGED'}else{'PUBLIC_HASH'});'scripts/db/foundation-forward-postcheck.sql'='PUBLIC_HASH'}}
 $knownScratch=Join-Path $env:TEMP ('emr-m03-foundation-dev-migrations-'+$runId);if($stage -ceq 'SCRATCH_SETUP'){$null=[IO.Directory]::CreateDirectory($knownScratch)}
 try{
  $denied=$false;try{. {${source.slice(start + 'try {\n'.length, end)}}}catch{$denied=$true}
  if(-not $denied -or $consumed -or $receipt.preparationStage -cne $stage -or $script:metadataReads -ne $(if($stage -ceq 'PRIVATE_METADATA'){1}else{0})){throw ('PREPARATION_STAGE_OR_PRIVATE_BOUNDARY_'+$stage)}
 }finally{
  if($null -ne $sessionLock){$sessionLock.Dispose()}
  if(Test-Path -LiteralPath $knownScratch){$absolute=[IO.Path]::GetFullPath($knownScratch);if(-not $absolute.StartsWith([IO.Path]::GetFullPath($env:TEMP)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'SYNTHETIC_SCRATCH_OUTSIDE_TEST'};Remove-Item -LiteralPath $absolute -Recurse -Force}
 }
}
$script:publicPrefixReads=0;$script:publicBinding=$null
function Read-FoundationArchivePrior{return $script:publicBinding}
function Assert-FoundationArchivePreflightContinuation{$script:publicPrefixReads++;return [pscustomobject]@{attemptFile=$attemptFile;latestFile=(Join-Path $out 'successor-latest.json')}}
$binding=[pscustomobject]@{id='4c602549-2c42-4ec3-9328-714d7cb66a77';audience='PUBLIC';commitSha=('a'*40);deploymentId='dpl_public'}
foreach($invalid in @(@([pscustomobject]@{kind='settlement'},$binding),[pscustomobject]@{id=$binding.id;audience='PUBLIC';commitSha=('a'*40);deploymentId='dpl_public';extra=$true})){
 $script:publicBinding=$invalid;$denied=$false;try{&{${source.slice(publicStart, publicEnd)}}}catch{$denied=$true};if(-not $denied -or $script:publicPrefixReads -ne 0){throw 'PUBLIC_BINDING_ARRAY_OR_EXTRA_REACHED_PRIVATE_PREFIX'}
}
Write-Output 'FIXED_PREPARATION_STAGES_AND_EARLY_SINGLE_BINDING'
`),
        'FIXED_PREPARATION_STAGES_AND_EARLY_SINGLE_BINDING',
      );
    } finally {
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      rmSync(directory, { recursive: true });
    }
  },
);
test(
  'technical16 mode and public-private binding are revalidated before the bounded Admin copy',
  native,
  () => {
    const source = readFileSync(consumer, 'utf8');
    const initialModes = source.slice(source.indexOf('if($TechnicalResidual16'), source.indexOf('$repo ='));
    assert.equal(
      run(`
$CheckOnly=$true;$InspectOnly=$true;$TechnicalResidual13=$false;$TechnicalResidual16=$true;$ArchiveFixture=$false;$WriterClose=$false;$ForwardMigration=$false;$ForwardWindow=$false;$PhaseAControl=$false;$OriginalDeadlineAtMs=0;$ClockAmendment=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false
${initialModes}
${definitions(['Assert-FoundationInspectClosed'])}
$script:valid=$true;$script:reads=0
function Read-FoundationTechnical16Closed{if(-not $script:valid){throw 'SYNTHETIC16_PROOF_CHANGED'};$script:reads++;return [pscustomobject]@{id='4c602549-2c42-4ec3-9328-714d7cb66a77'}}
function Read-FoundationTechnical13Closed{throw 'OLD_BINDING_SUBSTITUTED'}
$public=Assert-FoundationInspectClosed;$private=Assert-FoundationInspectClosed
if($script:reads -ne 2 -or $public.id -cne $private.id){throw 'CURRENT_BINDING_NOT_REVALIDATED'}
$script:valid=$false;$denied=$false;try{$null=Assert-FoundationInspectClosed}catch{$denied=$true};if(-not $denied){throw 'CHANGED_CURRENT_BINDING_ACCEPTED'}
Write-Output 'TECHNICAL16_FIXED_MODE_AND_BINDING'
`),
      'TECHNICAL16_FIXED_MODE_AND_BINDING',
    );
    const privateStart = source.indexOf(
      'if($InspectOnly -or $WriterClose -or $ArchiveFixture -or $ForwardMigration){',
      source.indexOf('if($CheckOnly -and $ForwardMigration){Write-Output'),
    );
    const privatePreparation = source.slice(
      privateStart,
      source.indexOf('if($WriterClose -or $ArchiveFixture -or $ForwardMigration){', privateStart),
    );
    assert.ok(
      privatePreparation.indexOf('$inspectExpectedBinding=Assert-FoundationInspectClosed') <
        privatePreparation.indexOf('Ensure-M03DevReadOnlyHandoff'),
    );
    for (const flags of [
      ['-TechnicalResidual16'],
      ['-TechnicalResidual16', '-InspectOnly', '-ArchiveFixture'],
      ['-TechnicalResidual16', '-TechnicalResidual13', '-InspectOnly'],
      ['-TechnicalResidual16', '-InspectOnly', '-ForwardWindow'],
    ]) {
      const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', consumer, ...flags], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
        env: Object.fromEntries(
          ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((name) =>
            process.env[name] === undefined ? [] : [[name, process.env[name]]],
          ),
        ),
      });
      assert.equal(result.status, 1);
      assert.equal(result.stderr, '');
      assert.equal(
        result.stdout.trim(),
        'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting residual read/archive modes; no private access.',
      );
    }
  },
);

test(
  'technical19 read-only mode rejects all write and continuation combinations before source or credential access',
  native,
  () => {
    for (const flags of [
      [],
      ['-ArchiveFixture'],
      ['-ForwardWindow'],
      ['-TechnicalResidual16'],
      ['-WriterClose'],
      ['-PhaseAControl'],
    ]) {
      const result = spawnSync(
        powershell,
        [
          '-NoProfile',
          '-NonInteractive',
          '-File',
          consumer,
          '-TechnicalResidual19',
          ...(flags.length ? ['-InspectOnly', ...flags] : []),
        ],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 10000,
          env: Object.fromEntries(
            ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((name) =>
              process.env[name] === undefined ? [] : [[name, process.env[name]]],
            ),
          ),
        },
      );
      assert.equal(result.status, 1);
      assert.equal(result.stderr, '');
      assert.equal(
        result.stdout.trim(),
        'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting read-only19 mode; no private access.',
      );
    }
  },
);

for (const ordinal of [16, 19])
  test(
    `technical${ordinal} read-only mode requires all fifteen original migration fingerprints without a push`,
    native,
    () => {
      const packet = JSON.parse(
        readFileSync('scripts/db/m03-foundation-forward-dev-migration-packet.json', 'utf8'),
      );
      const history = [...packet.baseline, ...packet.pending].map(({ version, name, historySha256 }) => ({
        version,
        name,
        historySha256,
      }));
      assert.equal(
        run(`
${definitions(['Assert-Keys', 'History-State'])}
$TechnicalResidual${ordinal}=$true;$migrations=ConvertFrom-Json ${quote(JSON.stringify(history))}
function Result($Count){return [pscustomobject]@{ok=$true;closed=$true;text=(ConvertTo-Json -InputObject @([pscustomobject]@{receipt=[pscustomobject]@{current_user='postgres';session_user='postgres';database='postgres';migrations=@($migrations|Select-Object -First $Count)}}) -Depth 12 -Compress)}}
if((History-State (Result 15)) -cne 'complete' -or (History-State (Result 14)) -cne 'baseline'){throw 'FIFTEEN_VERSION_RECEIPT_REQUIRED'}
$bad=Result 15;$rows=ConvertFrom-Json $bad.text;$rows[0].receipt.migrations[4].historySha256='0'*64;$bad.text=ConvertTo-Json -InputObject @($rows) -Depth 12 -Compress
if((History-State $bad) -cne 'rejected'){throw 'OLD_MIGRATION_DRIFT_ACCEPTED'}
Write-Output 'TECHNICAL16_FIFTEEN_HISTORY_NO_PUSH'
`),
        'TECHNICAL16_FIFTEEN_HISTORY_NO_PUSH',
      );
    },
  );

test(
  'technical16 physical closure permits fixed inspection but never substitutes for missing native settlement',
  native,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical16-public-'));
    const receiptPath =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json';
    const cleanupPath =
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-cleanup-20261024.json';
    const actual = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const stem =
      'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-16';
    try {
      for (const file of [
        receiptPath,
        cleanupPath,
        ...Object.keys(actual.pins),
        ...['-latest.json', '-owner-provision-attempt.json', '-reactivation-attempt.json'].map(
          (suffix) => stem + suffix,
        ),
      ]) {
        const destination = join(directory, file);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(file, destination);
      }
      // Genuine public copies retain immutable hashes, with independently charged tails.
      for (const name of ['management', 'control', 'setup', 'preflight'])
        appendFileSync(
          join(directory, 'scripts/n8n/out/foundation/live/' + name + '.jsonl'),
          '{"laterChargedPublicRow":true}\n',
        );
      assert.equal(
        run(`
${definitions(['Assert-Path', 'Read-Json', 'File-Hash', 'Read-FoundationTechnical16Closed', 'Assert-FoundationTechnical16Settled', 'Assert-FoundationInspectClosed', 'Read-FoundationArchivePrior'])}
$repo=${quote(directory)};$projectRef='zmotjsbzhzjvpelxvxlf';$TechnicalResidual13=$false;$TechnicalResidual16=$true
function Get-CimInstance{return @()}
$binding=Assert-FoundationInspectClosed
if($binding.id -cne '4c602549-2c42-4ec3-9328-714d7cb66a77' -or $binding.commitSha -cne '5087d4d93d2f6ffdca0bc0096b365723005446fc'){throw 'PUBLIC16_BINDING_CHANGED'}
$denied=$false;try{$null=Read-FoundationArchivePrior}catch{$denied=$true};if(-not $denied){throw 'PHYSICAL_CLOSE_SUBSTITUTED_FOR_NATIVE_SETTLEMENT'}
$runtime=Join-Path $repo 'scripts/n8n/out/foundation/live/runtime.technical-16.jsonl';$original=[IO.File]::ReadAllText($runtime);[IO.File]::AppendAllText($runtime,"{}\n")
$denied=$false;try{$null=Assert-FoundationInspectClosed}catch{$denied=$true};[IO.File]::WriteAllText($runtime,$original);if(-not $denied){throw 'HISTORICAL_RUNTIME_DRIFT_ACCEPTED'}
$management=Join-Path $repo 'scripts/n8n/out/foundation/live/management.jsonl';$original=[IO.File]::ReadAllText($management);[IO.File]::WriteAllText($management,' '+$original)
$denied=$false;try{$null=Assert-FoundationInspectClosed}catch{$denied=$true};[IO.File]::WriteAllText($management,$original);if(-not $denied){throw 'HISTORICAL_LEDGER_PREFIX_DRIFT_ACCEPTED'}
function Get-CimInstance{return @([pscustomobject]@{ProcessId=26268})}
$denied=$false;try{$null=Assert-FoundationInspectClosed}catch{$denied=$true};if(-not $denied){throw 'LIVE_PARENT_ACCEPTED'}
Write-Output 'ACTUAL_STYLE16_PUBLIC_INSPECTION_NOT_SETTLEMENT'
`),
        'ACTUAL_STYLE16_PUBLIC_INSPECTION_NOT_SETTLEMENT',
      );
    } finally {
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      assert.equal(realpathSync.native(directory).toLowerCase(), resolve(directory).toLowerCase());
      rmSync(directory, { recursive: true });
    }
  },
);

test(
  'technical16 inspection requires its exact current closed family and typed seven-audit readback',
  native,
  () => {
    const value = {
      kind: 'm03_foundation_inspection',
      windowId: '4c602549-2c42-4ec3-9328-714d7cb66a77',
      identity: true,
      window: {
        id: '4c602549-2c42-4ec3-9328-714d7cb66a77',
        audience: 'https://everyone-market-researcher-13wnnoywv-muhammed-abdelrahman.vercel.app',
        commitSha: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
        deploymentId: 'dpl_Hqcn7hxpuEUz6Bbq9tTtmQs5MdYd',
        startsAt: '2026-10-24T16:00:00Z',
        expiresAt: '2026-10-24T17:00:00Z',
        closedAt: '2026-10-24T16:35:00Z',
        admittedCount: 2,
        closeCount: 1,
      },
      requestCount: 1,
      reservedRequests: 0,
      incompleteRequests: 0,
      activeLeaseCount: 0,
      approval: {
        closed: true,
        expiresAt: '2026-10-24T17:00:00Z',
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
      familyWindowCount: 5,
      globalAdmittedCount: 9,
      globalRequestCount: 4,
      globalLaunchCount: 0,
      fixtureAuditCount: 7,
      technical12Exact: true,
      technical13Exact: true,
      technical16Exact: true,
    };
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Read-FoundationInspection', 'Assert-FoundationArchiveInspection'])}
$TechnicalResidual13=$false;$TechnicalResidual16=$true;$InspectOnly=$true;$original=ConvertFrom-Json ${quote(JSON.stringify(value))};$expected=$original.window
function Check($Value,[bool]$Archived=$false){$read=Read-FoundationInspection ([pscustomobject]@{ok=$true;closed=$true;text=('[{"inspection":'+($Value|ConvertTo-Json -Depth 12 -Compress)+'}]')});Assert-FoundationArchiveInspection $read $expected $Archived}
Check $original
foreach($fault in @('stringCount','wrongWindows','wrongAdmitted','wrongRequests','missing16','false12','false13','false16','extraAudit','reserved','launch','actor','scrape','cost','item','progress','wrongBinding','archived','extra')){
 $value=$original|ConvertTo-Json -Depth 12|ConvertFrom-Json
 switch($fault){
  'stringCount'{$value.globalAdmittedCount='9'} 'wrongWindows'{$value.familyWindowCount=4} 'wrongAdmitted'{$value.globalAdmittedCount=10} 'wrongRequests'{$value.globalRequestCount=5}
  'missing16'{$value.PSObject.Properties.Remove('technical16Exact')} 'false12'{$value.technical12Exact=$false} 'false13'{$value.technical13Exact=$false} 'false16'{$value.technical16Exact=$false} 'extraAudit'{$value.fixtureAuditCount=8}
  'reserved'{$value.reservedRequests=1} 'launch'{$value.globalLaunchCount=1} 'actor'{$value.actorRunCount=1} 'scrape'{$value.scrapeRunCount=1} 'cost'{$value.costEntryCount=1} 'item'{$value.collectedItemCount=1} 'progress'{$value.fixture.progressPresent=$true}
  'wrongBinding'{$value.window.commitSha='f'*40} 'archived'{$value.fixture.competitorArchived=$true;$value.fixture.competitorActive=$false} 'extra'{$value|Add-Member NoteProperty unexpected $true}
 }
 $denied=$false;try{Check $value}catch{$denied=$true};if(-not $denied){throw ('TECHNICAL16_DTO_ACCEPTED_'+$fault)}
}
$InspectOnly=$false;$after=$original|ConvertTo-Json -Depth 12|ConvertFrom-Json;$after.fixture.competitorArchived=$true;$after.fixture.competitorActive=$false;$after.fixture.accountPaused=$true;$after.fixture.accountActive=$false;Check $after $true
Write-Output 'TECHNICAL16_EXACT_TYPED_CURRENT_READBACK'
`),
      'TECHNICAL16_EXACT_TYPED_CURRENT_READBACK',
    );
  },
);

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
$InspectOnly=$true;$current=$after|ConvertTo-Json -Depth 12|ConvertFrom-Json;$current|Add-Member NoteProperty globalLaunchCount 0
Check $current $true
foreach($fault in @('missingGlobal','stringGlobal','launch','actor','scrape','cost','item','activeFixture','familyChanged','auditChanged')){
 $value=$current|ConvertTo-Json -Depth 12|ConvertFrom-Json
 switch($fault){
  'missingGlobal'{$value.PSObject.Properties.Remove('globalLaunchCount')} 'stringGlobal'{$value.globalLaunchCount='0'} 'launch'{$value.globalLaunchCount=1}
  'actor'{$value.actorRunCount=1} 'scrape'{$value.scrapeRunCount=1} 'cost'{$value.costEntryCount=1} 'item'{$value.collectedItemCount=1}
  'activeFixture'{$value.fixture.competitorArchived=$false;$value.fixture.competitorActive=$true}
  'familyChanged'{$value.familyClosed=$false} 'auditChanged'{$value.fixtureAuditCount=7}
 }
 $blocked=$false;try{Check $value $true}catch{$blocked=$true};if(-not $blocked){throw ('READ_ONLY_CURRENT_ACCEPTED_'+$fault)}
}
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
  'technical18 and19 fixture SQL require each fixed qualified no-reactivation marker for the sixth binding',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Foundation-FixtureSql'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$repo=${quote(resolve('.'))};$ProjectVerifiedContinuation=$true;$ForwardWindow=$true;$PostcheckContinuation=$true;$RemainingContinuation=$false;$StartupReplacement=$false;$projectVerifiedForwardWindowId='edbc6d11-7c1f-43a7-b745-1ded06deb29f';$projectVerifiedForwardSource='effa3de9e1fee6c3f3c08fc347a5e3175db14c80';$script:ordinal=18;$script:proofValid=$true
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=$script:ordinal}}
function Read-FoundationTechnical14NoAdmin([int]$Ordinal=14){if($Ordinal -eq 15){return '59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
function Read-FoundationForwardPrior{if(-not $script:proofValid){throw 'QUALIFIED_READCLAIMED_PRIOR_REQUIRED'};return [pscustomobject]@{fixtureAuditCount=7}}
function Read-FoundationTechnical18NoReactivation{if(-not $script:proofValid){throw 'QUALIFIED_TECHNICAL18_PRIOR_REQUIRED'};return '${technical18NoReactivationSha256}'}
$marker="set_config('emr.smoke_technical17_no_reactivation','d16198186698ddefdad06902f4c39d50ac51e46e87686d77bb3d0f3429f491ac',true)"
$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql';if(-not $body.Contains($marker)){throw 'QUALIFIED_NO_COMMAND17_MARKER_MISSING'}
$script:proofValid=$false;$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'UNQUALIFIED18_SQL_EMITTED'};$script:proofValid=$true
$script:ordinal=17;$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql';if($body.Contains($marker)){throw 'HISTORICAL17_SETTING_CHANGED'}
$script:ordinal=19;$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql';if(-not $body.Contains($marker) -or -not $body.Contains("set_config('emr.smoke_technical18_no_reactivation','${technical18NoReactivationSha256}',true)")){throw 'QUALIFIED_TECHNICAL19_MARKERS_MISSING'}
$script:proofValid=$false;$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'UNQUALIFIED19_SQL_EMITTED'};$script:proofValid=$true
foreach($ordinal in @(16,20)){$script:ordinal=$ordinal;$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'UNKNOWN_SIXTH_ORDINAL_EMITTED'}}
$script:ordinal=18;$projectVerifiedForwardSource='5087d4d93d2f6ffdca0bc0096b365723005446fc';$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'MIXED_SIXTH_SOURCE_EMITTED'}
Write-Output 'QUALIFIED_TECHNICAL18_SQL_ONLY'
`),
      'QUALIFIED_TECHNICAL18_SQL_ONLY',
    );
  },
);

test(
  'technical19 native proof pins the actual immutable18 receipt and denies a different hash',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Path', 'File-Hash', 'Read-FoundationTechnical18NoReactivation'])}
$repo=${quote(resolve('.'))}
if((Read-FoundationTechnical18NoReactivation) -cne '${technical18NoReactivationSha256}'){throw 'QUALIFIED18_RECEIPT_PIN_CHANGED'}
function File-Hash{return 'unverified'}
$denied=$false;try{$null=Read-FoundationTechnical18NoReactivation}catch{$denied=$true};if(-not $denied){throw 'UNVERIFIED18_RECEIPT_ACCEPTED'}
Write-Output 'EXACT_IMMUTABLE18_RECEIPT_ONLY'
`),
      'EXACT_IMMUTABLE18_RECEIPT_ONLY',
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
  'current read-only residual inspection accepts only its exact mode before any public or private read',
  native,
  () => {
    const source = readFileSync(consumer, 'utf8');
    const initialModes = source.slice(source.indexOf('if($TechnicalResidual13'), source.indexOf('$repo ='));
    assert.ok(initialModes.length > 0);
    assert.equal(
      run(`
$CheckOnly=$true;$InspectOnly=$true;$TechnicalResidual13=$true;$ArchiveFixture=$false;$WriterClose=$false;$ForwardMigration=$false;$ForwardWindow=$false;$PhaseAControl=$false;$OriginalDeadlineAtMs=0;$ClockAmendment=$false;$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false
${initialModes}
Write-Output 'CURRENT_READ_ONLY_MODE_ACCEPTED_WITHOUT_READS'
`),
      'CURRENT_READ_ONLY_MODE_ACCEPTED_WITHOUT_READS',
    );
    for (const flags of [
      ['-TechnicalResidual13'],
      ['-TechnicalResidual13', '-InspectOnly', '-ArchiveFixture'],
      ['-TechnicalResidual13', '-InspectOnly', '-ForwardMigration'],
      ['-TechnicalResidual13', '-InspectOnly', '-ForwardWindow'],
      ['-TechnicalResidual13', '-InspectOnly', '-PhaseAControl'],
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
      assert.equal(
        result.stdout.trim(),
        'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting residual read/archive modes; no private access.',
      );
    }
  },
);

test(
  'current read-only public and private preparation select the same revalidated technical13 binding',
  native,
  () => {
    const source = readFileSync(consumer, 'utf8');
    const publicSelection = source.match(
      /\$inspectExpectedBinding=if\(\$TechnicalResidual13\)\{Read-FoundationTechnical13Closed\}else\{Assert-FoundationInspectClosed\}/,
    )?.[0];
    assert.ok(publicSelection, 'actual public selection retained');
    const privateStart = source.indexOf(
      'if($InspectOnly -or $WriterClose -or $ArchiveFixture -or $ForwardMigration){',
      source.indexOf('if($CheckOnly -and $ForwardMigration){Write-Output'),
    );
    assert.ok(privateStart > 0);
    const privatePreparation = source.slice(
      privateStart,
      source.indexOf('if($WriterClose -or $ArchiveFixture -or $ForwardMigration){', privateStart),
    );
    const recheck = privatePreparation.indexOf('$inspectExpectedBinding=Assert-FoundationInspectClosed');
    const materialize = privatePreparation.indexOf('Ensure-M03DevReadOnlyHandoff');
    assert.ok(recheck >= 0 && materialize > recheck);
    assert.equal(
      run(`
${definitions(['Assert-FoundationInspectClosed'])}
$TechnicalResidual13=$true;$script:valid=$true;$script:reads=0
function Assert-Path{throw 'HISTORICAL_INSPECTION_READ_NOT_ALLOWED'}
function Read-FoundationTechnical13Closed{if(-not $script:valid){throw 'SYNTHETIC_PRIOR_CHANGED'};$script:reads++;return [pscustomobject]@{id='3c46c791-e140-4eb9-890a-eecfa251f65e';commitSha='7b1837201ac7925591577a1517d7288936ca3464'}}
${publicSelection}
$public=$inspectExpectedBinding
$inspectExpectedBinding=Assert-FoundationInspectClosed
if($script:reads -ne 2 -or $public.id -cne $inspectExpectedBinding.id -or $public.commitSha -cne $inspectExpectedBinding.commitSha){throw 'PUBLIC_PRIVATE_BINDING_CHANGED'}
$script:valid=$false
foreach($path in @('public','private')){$denied=$false;try{if($path -ceq 'public'){${publicSelection}}else{$inspectExpectedBinding=Assert-FoundationInspectClosed}}catch{$denied=$true};if(-not $denied){throw 'CHANGED_PRIOR_ACCEPTED'}}
Write-Output 'SAME_CURRENT_BINDING_REVALIDATED_BEFORE_ADMIN_COPY'
`),
      'SAME_CURRENT_BINDING_REVALIDATED_BEFORE_ADMIN_COPY',
    );
  },
);

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
function Read-FoundationTechnical14NoAdmin([int]$Ordinal=14){if(-not $script:proofValid){throw 'CLOSED_NO_ADMIN_PROOF_REQUIRED'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
$null=Read-FoundationPostcheckContinuation
foreach($mutation in @(@{key='managementMaximum';value=832},@{key='managementAttempts';value=525},@{key='controlAttempts';value=841},@{key='combinedAttempts';value=1365},@{key='controlAttempts';value='842'},@{key='sourceCommitSha';value='7b1837201ac7925591577a1517d7288936ca3464'})){
 $mixed=[ordered]@{};foreach($name in $valid.Keys){$mixed[$name]=$valid[$name]};$mixed[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$mixed;$denied=$false
 try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'RESET_OR_MIXED_BROWSER_CHARGE_ACCEPTED'}
}
$next=[ordered]@{};foreach($name in $valid.Keys){$next[$name]=$valid[$name]};$next.controlAttempts=843;$next.combinedAttempts=1367;$script:dto=[pscustomobject]$next;$null=Read-FoundationPostcheckContinuation
$carry=[ordered]@{};foreach($name in $next.Keys){$carry[$name]=$next[$name]};$carry.managementAttempts=527;$carry.controlAttempts=846;$carry.combinedAttempts=1373;$script:dto=[pscustomobject]$carry;$null=Read-FoundationPostcheckContinuation
foreach($mutation in @(@{key='managementAttempts';value=524},@{key='managementAttempts';value='527'},@{key='controlAttempts';value=843},@{key='combinedAttempts';value=1370})){
 $bad=[ordered]@{};foreach($name in $carry.Keys){$bad[$name]=$carry[$name]};$bad[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$bad;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'UNADMITTED_CARRY_NATIVE_RESET_ACCEPTED'}
}
foreach($mutation in @(@{key='controlAttempts';value=842},@{key='combinedAttempts';value=1366},@{key='controlAttempts';value='843'})){$mixed=[ordered]@{};foreach($name in $next.Keys){$mixed[$name]=$next[$name]};$mixed[$mutation.key]=$mutation.value;$script:dto=[pscustomobject]$mixed;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'SECOND_BROWSER_CHARGE_RESET_ACCEPTED'}}
$script:dto=[pscustomobject]$next;$script:proofValid=$false;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MISSING_NO_ADMIN_PROOF_ACCEPTED'}
Write-Output 'EXACT_POST_BROWSER_NATIVE_TUPLE'
`),
      'EXACT_POST_BROWSER_NATIVE_TUPLE',
    );
  },
);

for (const ordinal of [14, 15])
  test(
    `technical${ordinal} no-Admin proof preserves ledger prefixes and refuses any DB artifact before its next gap`,
    native,
    () => {
      assert.equal(
        run(`
${definitions(['Assert-Path', 'Read-Json', 'File-Hash', 'Read-FoundationTechnical14NoAdmin'])}
${definitions(['Foundation-FixtureSql'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$originalRepo=${quote(resolve('.'))};$repo=$PSScriptRoot
$ordinal=${ordinal}
foreach($priorOrdinal in 14..$ordinal){
 $record='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical'+$priorOrdinal+'-reconciliation-20261024.json';$cleanup='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical'+$priorOrdinal+'-cleanup-20261024.json'
 $actual=ConvertFrom-Json ([IO.File]::ReadAllText((Join-Path $originalRepo $record)))
 foreach($relative in @($record,$cleanup)+@($actual.pins.PSObject.Properties.Name)){
  $source=Assert-Path $originalRepo $relative;$target=Join-Path $repo $relative;$null=[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target));[IO.File]::Copy($source,$target,$true)
 }
}
$script:historicalMode='absent';$script:historicalBirth=[DateTime]::UtcNow.AddMinutes(-1)
function Get-CimInstance($ClassName,$Filter,$Property,$ErrorAction){if($script:historicalMode -ceq 'absent'){return @()};return [pscustomobject]@{ProcessId=[int]($Filter -replace '^ProcessId = ','');ParentProcessId=1;CreationDate=$(if($script:historicalMode -ceq 'reused'){$script:historicalBirth}else{[DateTime]::SpecifyKind([DateTime]::MinValue,[DateTimeKind]::Utc)})}}
$expected=$(if($ordinal -eq 15){'59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd'}else{'6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'})
if((Read-FoundationTechnical14NoAdmin -Ordinal $ordinal) -cne $expected){throw 'ACTUAL_STYLE_NO_ADMIN_PROOF_REJECTED'}
$script:historicalMode='reused';if((Read-FoundationTechnical14NoAdmin -Ordinal $ordinal) -cne $expected){throw 'REUSED_HISTORICAL_PID_REJECTED'}
if($ordinal -eq 15){
 $fixtureSource='scripts/assert/m03_smoke_reactivate_project_verified.sql';$target=Join-Path $repo $fixtureSource;$null=[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target));[IO.File]::Copy((Join-Path $originalRepo $fixtureSource),$target,$true)
 $ProjectVerifiedContinuation=$true;$ForwardWindow=$true;$PostcheckContinuation=$true;$RemainingContinuation=$false;$StartupReplacement=$false;$projectVerifiedForwardWindowId='edbc6d11-7c1f-43a7-b745-1ded06deb29f';$projectVerifiedForwardSource='effa3de9e1fee6c3f3c08fc347a5e3175db14c80'
 function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=18}}
 function Read-FoundationForwardPrior{return $null}
 $body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'
 foreach($marker in @('emr.smoke_technical14_no_reactivation','emr.smoke_technical15_no_reactivation','emr.smoke_technical17_no_reactivation')){if(-not $body.Contains($marker)){throw 'LATENT_NO_ADMIN_FIXTURE_MARKER_MISSING'}}
 $script:historicalMode='old';$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'LATENT_FIXTURE_WITH_OLD_IDENTITY_ACCEPTED'};$script:historicalMode='reused'
}
$script:historicalMode='old';$denied=$false;try{$null=Read-FoundationTechnical14NoAdmin -Ordinal $ordinal}catch{$denied=$true};if(-not $denied){throw 'OLD_OR_UNKNOWN_HISTORICAL_IDENTITY_ACCEPTED'};$script:historicalMode='absent'
foreach($name in @('management','control','setup','preflight')){[IO.File]::AppendAllText((Join-Path $repo ('scripts/n8n/out/foundation/live/'+$name+'.jsonl')),'{"event":"synthetic_tail"}'+"\`n")}
if((Read-FoundationTechnical14NoAdmin -Ordinal $ordinal) -cne $expected){throw 'CHARGED_TAIL_REJECTED'}
foreach($relative in $actual.absentOutputs){
 $file=Join-Path $repo $relative;$null=[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($file));[IO.File]::WriteAllText($file,'{}')
 $denied=$false;try{$null=Read-FoundationTechnical14NoAdmin -Ordinal $ordinal}catch{$denied=$true};[IO.File]::Delete($file);if(-not $denied){throw 'UNKNOWN_CLOSED_ATTEMPT_DB_OPERATION_ACCEPTED'}
}
$denied=$false;try{$null=Read-FoundationTechnical14NoAdmin -Ordinal 16}catch{$denied=$true};if(-not $denied){throw 'UNREVIEWED_ORDINAL_PROOF_ACCEPTED'}
$historical=Join-Path $repo 'scripts/n8n/out/foundation/live/runtime.jsonl';$before=[IO.File]::ReadAllText($historical);[IO.File]::AppendAllText($historical,'{"event":"synthetic_tail"}'+"\`n")
$denied=$false;try{$null=Read-FoundationTechnical14NoAdmin -Ordinal $ordinal}catch{$denied=$true};[IO.File]::WriteAllText($historical,$before);if(-not $denied){throw 'HISTORICAL_RUNTIME_CHANGED'}
$cleanupFile=Join-Path $repo $cleanup;[IO.File]::AppendAllText($cleanupFile,' ');$denied=$false;try{$null=Read-FoundationTechnical14NoAdmin -Ordinal $ordinal}catch{$denied=$true};if(-not $denied){throw 'CHANGED_CLEANUP_PROOF_ACCEPTED'}
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
$script:ordinal=16;Assert-FoundationForwardWindowState $true
$script:proofValid=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'UNPROVEN_MISSING14_STATE_ACCEPTED'};$script:proofValid=$true
$projectVerifiedForwardSource='7b1837201ac7925591577a1517d7288936ca3464';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'MIXED_FIFTH_SOURCE_ACCEPTED'}
Write-Output 'FOUR_CLOSED_PREDECESSORS_AND_TYPED_AUDITS'
`),
      'FOUR_CLOSED_PREDECESSORS_AND_TYPED_AUDITS',
    );
  },
);

test(
  'sixth registered window requires five closed predecessors and typed12/13/16 fixture audits',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Foundation-Technical13AuditPredicate'])}
${definitions(['Foundation-Literal', 'Assert-FoundationForwardWindowState'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$out='synthetic';$continuationOutputStem='synthetic';$projectVerifiedForwardWindowId='edbc6d11-7c1f-43a7-b745-1ded06deb29f';$projectVerifiedForwardSource='effa3de9e1fee6c3f3c08fc347a5e3175db14c80';$script:ordinal=17;$script:proofValid=$true
function Read-FoundationForwardPrior{if(-not $script:proofValid){throw 'MISSING_SETTLEMENT_ARCHIVE'};return [pscustomobject]@{window=[pscustomobject]@{closedAt='2026-10-24T16:34:00.000Z'}}}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=$script:ordinal;outputSegment=('synthetic'+$script:ordinal)}}
$script:forwardWindowBinding=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic.vercel.app';deploymentId='dpl_Synthetic'}
$script:value=[pscustomobject]@{identity=$true;legacyClosed=$true;intermediateClosed=$true;runtimeClosed=$true;restorationClosed=$true;acceptanceClosed=$true;fixtureAuditCount=7;technical12Exact=$true;technical13Exact=$true;technical16Exact=$true;windows=5;freshWindows=0;freshPrepared=$false;globalAdmitted=9;requests=4;activeLeases=0;launches=0;bindings=0;progress=0}
function Invoke-FoundationQuery($Sql,$Column){
 if($Column -ceq 'ownership'){if(-not $Sql.Contains("where w.window_id='edbc6d11-7c1f-43a7-b745-1ded06deb29f'")){throw 'WRONG_SIXTH_OWNERSHIP'};return [pscustomobject]@{owned=$true}}
 foreach($needle in @("'acceptanceClosed'","'technical16Exact'","'fixtureAuditCount'","bound_commit_sha='effa3de9e1fee6c3f3c08fc347a5e3175db14c80'","'dpl_Hqcn7hxpuEUz6Bbq9tTtmQs5MdYd'","'2026-10-24T16:34:00.000Z'::timestamptz","jsonb_build_object('fixture_version',1")){if(-not $Sql.Contains($needle)){throw 'SIXTH_PREDECESSOR_OR_AUDIT_NOT_EXACT'}}
 return $script:value
}
Assert-FoundationForwardWindowState $false
$script:value.windows=6;$script:value.freshWindows=1;$script:value.freshPrepared=$true;Assert-FoundationForwardWindowState $true
$script:ordinal=18;Assert-FoundationForwardWindowState $true
$script:ordinal=19;Assert-FoundationForwardWindowState $true
$script:ordinal=20;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'UNKNOWN_SIXTH_SUCCESSOR_ACCEPTED'};$script:ordinal=17
foreach($key in @('legacyClosed','intermediateClosed','runtimeClosed','restorationClosed','acceptanceClosed','technical12Exact','technical13Exact','technical16Exact','freshPrepared')){$script:value.$key=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$true;if(-not $denied){throw 'UNQUALIFIED_SIXTH_PREDECESSOR_ACCEPTED'}}
$script:value.acceptanceClosed=$null;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.acceptanceClosed=$true;if(-not $denied){throw 'NULL_SIXTH_CLOSURE_ACCEPTED'}
foreach($key in @('fixtureAuditCount','windows','globalAdmitted','requests','activeLeases','launches','bindings','progress')){$saved=$script:value.$key;$script:value.$key=$saved+1;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$saved;if(-not $denied){throw 'UNRECONCILED_SIXTH_PROGRESS_ACCEPTED'}}
$script:value.fixtureAuditCount='7';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'COERCED_SIXTH_AUDITS_ACCEPTED'};$script:value.fixtureAuditCount=7
$script:ordinal=16;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'WRONG_SIXTH_ORDINAL_ACCEPTED'};$script:ordinal=17
$script:proofValid=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'MISSING_SETTLEMENT_ARCHIVE_ACCEPTED'};$script:proofValid=$true
$projectVerifiedForwardSource='5087d4d93d2f6ffdca0bc0096b365723005446fc';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'MIXED_SIXTH_SOURCE_ACCEPTED'}
Write-Output 'FIVE_CLOSED_PREDECESSORS_AND_TYPED_AUDITS'
`),
      'FIVE_CLOSED_PREDECESSORS_AND_TYPED_AUDITS',
    );
  },
);

test(
  'seventh registered window requires closed19 and six exact predecessors without reopening any old window',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'File-Hash', 'Foundation-Technical13AuditPredicate'])}
${definitions(['Foundation-Literal', 'Assert-FoundationForwardWindowState'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$repo=${quote(process.cwd())};$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$out='synthetic';$continuationOutputStem='synthetic';$projectVerifiedForwardWindowId='e2be1a67-f6db-4c90-bfd2-671c5db9b90a';$projectVerifiedForwardSource='5f256ce915f930481b0d31ac38b919c0a7692cd1';$script:ordinal=20;$script:proofValid=$true
function Read-FoundationForwardPrior{if(-not $script:proofValid){throw 'MISSING_EXACT19_READBACK'};return [pscustomobject]@{window=[pscustomobject]@{id='edbc6d11-7c1f-43a7-b745-1ded06deb29f';closedAt='2026-10-25T00:36:16.111Z'}}}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=$script:ordinal;outputSegment=('synthetic'+$script:ordinal)}}
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
function Read-Json($Path){return Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json}
$script:forwardWindowBinding=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic20.vercel.app';deploymentId='dpl_Synthetic20'}
$script:value=[pscustomobject]@{identity=$true;legacyClosed=$true;intermediateClosed=$true;runtimeClosed=$true;restorationClosed=$true;acceptanceClosed=$true;technical19Closed=$true;fixtureAuditCount=8;technical12Exact=$true;technical13Exact=$true;technical16Exact=$true;technical19Exact=$true;windows=6;freshWindows=0;freshPrepared=$false;globalAdmitted=11;requests=5;activeLeases=0;launches=0;bindings=0;progress=0}
function Invoke-FoundationQuery($Sql,$Column){
 if($Column -ceq 'ownership'){if(-not $Sql.Contains("where w.window_id='e2be1a67-f6db-4c90-bfd2-671c5db9b90a'")){throw 'WRONG_SEVENTH_OWNERSHIP'};return [pscustomobject]@{owned=$true}}
 foreach($needle in @("'technical19Closed'","'technical19Exact'","bound_commit_sha='5f256ce915f930481b0d31ac38b919c0a7692cd1'","'dpl_8Qy4Ywx8aEZ6j3ueVm3TaAP7LB3Y'","'2026-10-25T00:36:16.111Z'::timestamptz","jsonb_build_object('fixture_version',1")){if(-not $Sql.Contains($needle)){throw 'SEVENTH_PREDECESSOR_OR_AUDIT_NOT_EXACT'}}
 return $script:value
}
Assert-FoundationForwardWindowState $false
$script:value.windows=7;$script:value.freshWindows=1;$script:value.freshPrepared=$true;Assert-FoundationForwardWindowState $true
foreach($key in @('legacyClosed','intermediateClosed','runtimeClosed','restorationClosed','acceptanceClosed','technical19Closed','technical12Exact','technical13Exact','technical16Exact','technical19Exact','freshPrepared')){$script:value.$key=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$true;if(-not $denied){throw 'UNQUALIFIED_SEVENTH_PREDECESSOR_ACCEPTED'}}
foreach($key in @('fixtureAuditCount','windows','globalAdmitted','requests','activeLeases','launches','bindings','progress')){$saved=$script:value.$key;$script:value.$key=$saved+1;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};$script:value.$key=$saved;if(-not $denied){throw 'UNRECONCILED_SEVENTH_PROGRESS_ACCEPTED'}}
$script:value.fixtureAuditCount='8';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'COERCED_SEVENTH_AUDITS_ACCEPTED'};$script:value.fixtureAuditCount=8
$script:ordinal=21;Assert-FoundationForwardWindowState $true
foreach($ordinal in @(19,22)){$script:ordinal=$ordinal;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'WRONG_SEVENTH_ORDINAL_ACCEPTED'}};$script:ordinal=20
$script:proofValid=$false;$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'MISSING19_READBACK_ACCEPTED'};$script:proofValid=$true
$projectVerifiedForwardSource='effa3de9e1fee6c3f3c08fc347a5e3175db14c80';$denied=$false;try{Assert-FoundationForwardWindowState $true}catch{$denied=$true};if(-not $denied){throw 'MIXED_SEVENTH_SOURCE_ACCEPTED'}
Write-Output 'SIX_CLOSED_PREDECESSORS_AND_TYPED19_AUDIT'
`),
      'SIX_CLOSED_PREDECESSORS_AND_TYPED19_AUDIT',
    );
  },
);

test(
  'post20 UI native public projection requires its exact receipt and preserves historical counters only when absent',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation'])}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$PhaseAControl=$true;$PostcheckContinuation=$true;$ClockAmendment=$false;$OriginalDeadlineAtMs=0;$RemainingContinuation=$false;$StartupReplacement=$false;$CheckOnly=$true;$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$node='never-spawned';$repo='synthetic';$script:eventPresent=$true;$script:eventValid=$true;$script:priorCalls=0
function Assert-Path($Root,$Relative){return $Relative}
function Test-Path([string]$LiteralPath){return $script:eventPresent}
function File-Hash($Path){if(-not $script:eventValid){return '0'*64};return 'c5e4e506d788b399fd95354cc2bc59849076daec48e0a41901e717a4a22c157e'}
function Read-FoundationTechnical19Database{$script:priorCalls++;return [pscustomobject]@{familyWindowCount=6;globalAdmittedCount=11;fixtureAuditCount=8;technical19Exact=$true}}
function Read-Json{return [pscustomobject]@{usage=[pscustomobject]@{management=1317;control=1246;combined=2563}}}
function Invoke-Bounded{return [pscustomobject]@{ok=$true;closed=$true;text=($script:dto|ConvertTo-Json -Compress)}}
$script:dto=[pscustomobject]@{kind='project_verified_continuation_ready';segmentId=$postcheckContinuationSegment;sourceCommitSha='5f256ce915f930481b0d31ac38b919c0a7692cd1';windowId='e2be1a67-f6db-4c90-bfd2-671c5db9b90a';privateRead=$false;networkRequests=0;managementMaximum=1728;managementAttempts=1317;controlAttempts=1249;combinedAttempts=2566}
$null=Read-FoundationPostcheckContinuation;if($script:priorCalls -ne 1){throw 'REAL19_PRIOR_SKIPPED'}
foreach($mutation in @(@{key='managementMaximum';value=1408},@{key='managementAttempts';value=1316},@{key='controlAttempts';value=1246},@{key='controlAttempts';value='1249'},@{key='combinedAttempts';value=2563},@{key='combinedAttempts';value='2566'},@{key='sourceCommitSha';value='unknown'},@{key='windowId';value='unknown'},@{key='privateRead';value=$true},@{key='networkRequests';value=1})){
 $original=$script:dto.($mutation.key);$script:dto.($mutation.key)=$mutation.value;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};$script:dto.($mutation.key)=$original;if(-not $denied){throw 'UI_COUNTER_REFUND_OR_BINDING_CHANGED'}
}
$script:eventValid=$false;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'UNPINNED_UI_COUNTERS_ACCEPTED'};$script:eventValid=$true
$script:eventPresent=$false;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'UNPROVEN_UI_COUNTERS_ACCEPTED'}
$script:dto.controlAttempts=1246;$script:dto.combinedAttempts=2563;$null=Read-FoundationPostcheckContinuation
$script:eventPresent=$true;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'UI_CHARGES_REFUNDED'}
Write-Output 'NATIVE_UI_EXACT_RECEIPT_AND_COUNTERS'
`),
      'NATIVE_UI_EXACT_RECEIPT_AND_COUNTERS',
    );
  },
);

test(
  'seventh public DTO and native prior pin actual19 readback without resetting1317 retained charges',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Assert-Path', 'File-Hash', 'Read-Json', 'Read-FoundationInspection', 'Assert-FoundationArchiveInspection', 'Read-FoundationTechnical19Database', 'Read-FoundationPostcheckContinuation'])}
$repo=${quote(process.cwd())};$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$PhaseAControl=$true;$PostcheckContinuation=$true;$ClockAmendment=$false;$OriginalDeadlineAtMs=0;$RemainingContinuation=$false;$StartupReplacement=$false;$CheckOnly=$true;$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$node='never-spawned';$TechnicalResidual16=$false;$TechnicalResidual13=$false
$prior=Read-FoundationTechnical19Database
if($prior.familyWindowCount -ne 6 -or $prior.globalAdmittedCount -ne 11 -or $prior.globalRequestCount -ne 5 -or $prior.fixtureAuditCount -ne 8 -or -not $prior.technical19Exact){throw 'ACTUAL19_FAMILY_NOT_PINNED'}
function Invoke-Bounded{return [pscustomobject]@{ok=$true;closed=$true;text=($script:dto|ConvertTo-Json -Compress)}}
$script:dto=[pscustomobject]@{kind='project_verified_continuation_ready';segmentId=$postcheckContinuationSegment;sourceCommitSha='5f256ce915f930481b0d31ac38b919c0a7692cd1';windowId='e2be1a67-f6db-4c90-bfd2-671c5db9b90a';privateRead=$false;networkRequests=0;managementMaximum=1728;managementAttempts=1317;controlAttempts=1249;combinedAttempts=2566}
$null=Read-FoundationPostcheckContinuation
if($projectVerifiedForwardWindowId -cne $script:dto.windowId -or $projectVerifiedForwardSource -cne $script:dto.sourceCommitSha){throw 'SEVENTH_BINDING_NOT_SELECTED'}
foreach($mutation in @(@{key='managementAttempts';value=1316},@{key='controlAttempts';value=1245},@{key='combinedAttempts';value=2562},@{key='managementMaximum';value=1408},@{key='managementMaximum';value='1728'},@{key='sourceCommitSha';value='effa3de9e1fee6c3f3c08fc347a5e3175db14c80'},@{key='privateRead';value=$true},@{key='networkRequests';value=1})){
 $original=$script:dto.($mutation.key);$script:dto.($mutation.key)=$mutation.value;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};$script:dto.($mutation.key)=$original;if(-not $denied){throw 'SEVENTH_CHARGES_OR_BINDING_CHANGED'}
}
function File-Hash($Path){if($Path.EndsWith('dev-acceptance-technical19-database-readback-20261025.json')){return '0'*64};return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
$denied=$false;try{$null=Read-FoundationTechnical19Database}catch{$denied=$true};if(-not $denied){throw 'UNPINNED19_READBACK_ACCEPTED'}
Write-Output 'EXACT19_PRIOR_AND_SEVENTH_DTO'
`),
      'EXACT19_PRIOR_AND_SEVENTH_DTO',
    );
  },
);

test(
  'technical21 native proof pins the exact closed20 receipt without changing its failed closure flags',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Path', 'File-Hash', 'Read-FoundationTechnical20NoReactivation'])}
$repo=${quote(process.cwd())}
if((Read-FoundationTechnical20NoReactivation) -cne '${technical20NoReactivationSha256}'){throw 'QUALIFIED20_RECEIPT_PIN_CHANGED'}
function File-Hash($Path){return '0'*64}
$denied=$false;try{$null=Read-FoundationTechnical20NoReactivation}catch{$denied=$true};if(-not $denied){throw 'UNVERIFIED20_RECEIPT_ACCEPTED'}
Write-Output 'QUALIFIED20_EXACT_NATIVE_PIN'
`),
      'QUALIFIED20_EXACT_NATIVE_PIN',
    );
  },
);

test(
  'technical21 native prior requires both immutable20 no-Admin proof and exact19 database history',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Path', 'File-Hash', 'Read-FoundationForwardPrior', 'Read-FoundationTechnical20NoReactivation'])}
${definitions(['Foundation-ForwardWindowId', 'Foundation-ProjectVerifiedTechnicalIdentity'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$repo=${quote(process.cwd())};$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$script:projectVerifiedTechnicalOrdinal=21;$projectVerifiedForwardWindowId='e2be1a67-f6db-4c90-bfd2-671c5db9b90a';$projectVerifiedForwardSource='5f256ce915f930481b0d31ac38b919c0a7692cd1';$script:priorCalls=0
function Read-FoundationTechnical19Database{$script:priorCalls++;return [pscustomobject]@{familyWindowCount=6;globalAdmittedCount=11;fixtureAuditCount=8;technical19Exact=$true}}
$value=Read-FoundationForwardPrior;if($script:priorCalls -ne 1 -or $value.fixtureAuditCount -ne 8 -or -not $value.technical19Exact){throw 'REAL19_PRIOR_NOT_REQUIRED'}
function Read-FoundationTechnical20NoReactivation{throw 'EXACT20_NO_ADMIN_REQUIRED'}
$denied=$false;try{$null=Read-FoundationForwardPrior}catch{$denied=$true};if(-not $denied -or $script:priorCalls -ne 1){throw 'UNPROVEN21_PRIOR_ACCEPTED'}
$script:projectVerifiedTechnicalOrdinal=20;$null=Read-FoundationForwardPrior;if($script:priorCalls -ne 2){throw 'HISTORICAL20_PRIOR_CHANGED'}
foreach($ordinal in @(19,22)){$script:projectVerifiedTechnicalOrdinal=$ordinal;$denied=$false;try{$null=Read-FoundationForwardPrior}catch{$denied=$true};if(-not $denied){throw 'UNKNOWN_SEVENTH_PRIOR_ACCEPTED'}}
Write-Output 'PINNED20_AND_REAL19_REQUIRED'
`),
      'PINNED20_AND_REAL19_REQUIRED',
    );
  },
);

test(
  'technical21 fixture SQL skips only proven absent20 while retaining all real19 requirements',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Foundation-FixtureSql'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$repo=${quote(process.cwd())};$ProjectVerifiedContinuation=$true;$ForwardWindow=$true;$PostcheckContinuation=$true;$RemainingContinuation=$false;$StartupReplacement=$false;$projectVerifiedForwardWindowId='e2be1a67-f6db-4c90-bfd2-671c5db9b90a';$projectVerifiedForwardSource='5f256ce915f930481b0d31ac38b919c0a7692cd1';$script:ordinal=21;$script:proof20Valid=$true
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=$script:ordinal}}
function Read-FoundationTechnical14NoAdmin([int]$Ordinal=14){if($Ordinal -eq 15){return '59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
function Read-FoundationForwardPrior{return [pscustomobject]@{fixtureAuditCount=8;technical19Exact=$true}}
function Read-FoundationTechnical18NoReactivation{return '${technical18NoReactivationSha256}'}
function Read-FoundationTechnical20NoReactivation{if(-not $script:proof20Valid){throw 'EXACT20_NO_ADMIN_REQUIRED'};return '${technical20NoReactivationSha256}'}
$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'
foreach($markerOrdinal in @(14,15,17,18,20)){if(-not $body.Contains("set_config('emr.smoke_technical"+$markerOrdinal+"_no_reactivation'")){throw 'MISSING21_GAP_MARKER'}}
if(-not $body.Contains("set_config('emr.smoke_technical20_no_reactivation','${technical20NoReactivationSha256}',true)")){throw 'EXACT20_MARKER_MISSING'}
if($body.Contains("set_config('emr.smoke_technical19_no_reactivation'")){throw 'REAL19_AUDIT_SKIPPED'}
$script:proof20Valid=$false;$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'UNPROVEN21_SQL_EMITTED'};$script:proof20Valid=$true
$script:ordinal=20;$old=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql';if($old.Contains("set_config('emr.smoke_technical20_no_reactivation'")){throw 'HISTORICAL20_CHANGED'}
foreach($ordinal in @(19,22)){$script:ordinal=$ordinal;$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'UNKNOWN_SEVENTH_ORDINAL_EMITTED'}}
Write-Output 'EXACT21_MARKERS_REAL19'
`),
      'EXACT21_MARKERS_REAL19',
    );
  },
);

test(
  'technical20 fixture SQL keeps every proven absent marker and requires the real19 lifecycle',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Foundation-FixtureSql'], resolve('scripts/db/windows/Foundation-AdminControl.ps1'))}
$repo=${quote(process.cwd())};$ProjectVerifiedContinuation=$true;$ForwardWindow=$true;$PostcheckContinuation=$true;$RemainingContinuation=$false;$StartupReplacement=$false;$projectVerifiedForwardWindowId='e2be1a67-f6db-4c90-bfd2-671c5db9b90a';$projectVerifiedForwardSource='5f256ce915f930481b0d31ac38b919c0a7692cd1';$script:ordinal=20;$script:proofValid=$true
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=$script:ordinal}}
function Read-FoundationTechnical14NoAdmin([int]$Ordinal=14){if($Ordinal -eq 15){return '59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
function Read-FoundationForwardPrior{if(-not $script:proofValid){throw 'EXACT19_PRIOR_REQUIRED'};return [pscustomobject]@{fixtureAuditCount=8;technical19Exact=$true}}
function Read-FoundationTechnical18NoReactivation{return '${technical18NoReactivationSha256}'}
$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'
foreach($ordinal in @(14,15,17,18)){if(-not $body.Contains("set_config('emr.smoke_technical"+$ordinal+"_no_reactivation'")){throw 'MISSING20_GAP_MARKER'}}
if($body.Contains("set_config('emr.smoke_technical19_no_reactivation'")){throw 'REAL19_AUDIT_SKIPPED'}
$script:proofValid=$false;$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'UNPROVEN20_SQL_EMITTED'};$script:proofValid=$true
foreach($ordinal in @(19,22)){$script:ordinal=$ordinal;$denied=$false;try{$null=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'}catch{$denied=$true};if(-not $denied){throw 'UNKNOWN_SEVENTH_ORDINAL_EMITTED'}}
Write-Output 'EXACT20_MARKERS_REAL19'
`),
      'EXACT20_MARKERS_REAL19',
    );
  },
);

test(
  'sixth public DTO derives exact cumulative usage from qualified settlement instead of caller counters',
  native,
  () => {
    assert.equal(
      run(`
${definitions(['Assert-Keys', 'Read-FoundationPostcheckContinuation'])}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$PhaseAControl=$true;$PostcheckContinuation=$true;$ClockAmendment=$false;$OriginalDeadlineAtMs=0;$RemainingContinuation=$false;$StartupReplacement=$false;$CheckOnly=$true;$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$repo='synthetic';$node='never-spawned';$script:proofValid=$true
function Assert-Path($Root,$Relative){return 'synthetic-public-module'}
function Invoke-Bounded{return [pscustomobject]@{ok=$true;closed=$true;text=($script:dto|ConvertTo-Json -Compress)}}
function Read-FoundationTechnical16Closed{return [pscustomobject]@{id='4c602549-2c42-4ec3-9328-714d7cb66a77'}}
function Assert-FoundationTechnical16Settled($Expected){if(-not $script:proofValid){throw 'UNQUALIFIED_SETTLEMENT'};return [pscustomobject]@{usage=$script:usage}}
$valid=[ordered]@{kind='project_verified_continuation_ready';segmentId=$postcheckContinuationSegment;sourceCommitSha='effa3de9e1fee6c3f3c08fc347a5e3175db14c80';windowId='edbc6d11-7c1f-43a7-b745-1ded06deb29f';privateRead=$false;networkRequests=0;managementMaximum=1408;managementAttempts=914;controlAttempts=1045;combinedAttempts=1959}
$script:usage=[pscustomobject]@{management=914;control=1045;combined=1959};$script:dto=[pscustomobject]$valid;$null=Read-FoundationPostcheckContinuation
if($script:projectVerifiedForwardWindowId -cne $valid.windowId -or $script:projectVerifiedForwardSource -cne $valid.sourceCommitSha){throw 'SIXTH_PROFILE_NOT_SELECTED'}
foreach($change in @(@{key='managementMaximum';value=1024},@{key='managementMaximum';value='1408'},@{key='managementAttempts';value=913},@{key='controlAttempts';value=1044},@{key='combinedAttempts';value=1958},@{key='sourceCommitSha';value='5087d4d93d2f6ffdca0bc0096b365723005446fc'},@{key='windowId';value='4c602549-2c42-4ec3-9328-714d7cb66a77'},@{key='privateRead';value=$true})){
 $mixed=[ordered]@{};foreach($key in $valid.Keys){$mixed[$key]=$valid[$key]};$mixed[$change.key]=$change.value;$script:dto=[pscustomobject]$mixed;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'MIXED_SIXTH_COUNTER_OR_AUTHORITY_ACCEPTED'}
}
$valid.managementAttempts=919;$valid.controlAttempts=1050;$valid.combinedAttempts=1969;$script:dto=[pscustomobject]$valid
$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'CALLER_REPLACED_QUALIFIED_N'}
$script:usage=[pscustomobject]@{management=919;control=1050;combined=1969};$null=Read-FoundationPostcheckContinuation
function Read-FoundationTechnical18NoReactivation{if(-not $script:proofValid){throw 'UNQUALIFIED_TECHNICAL18'};return '${technical18NoReactivationSha256}'}
function Read-Json{return [pscustomobject]@{usage=$script:newUsage}}
$valid.managementAttempts=1023;$valid.controlAttempts=1145;$valid.combinedAttempts=2168;$script:dto=[pscustomobject]$valid
$script:newUsage=[pscustomobject]@{management=1023;control=1145;combined=2168};$null=Read-FoundationPostcheckContinuation
$script:newUsage.management=1022;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'UNQUALIFIED19_COUNTERS_ACCEPTED'};$script:newUsage.management=1023
$script:proofValid=$false;$denied=$false;try{$null=Read-FoundationPostcheckContinuation}catch{$denied=$true};if(-not $denied){throw 'UNQUALIFIED_DYNAMIC_USAGE_ACCEPTED'}
Write-Output 'EXACT_QUALIFIED_DYNAMIC_SETTLEMENT_USAGE'
`),
      'EXACT_QUALIFIED_DYNAMIC_SETTLEMENT_USAGE',
    );
  },
);

test(
  'sixth forward baseline requires the separately pinned actual16 settlement and exact archived fixture',
  native,
  () => {
    const archivePins = readFileSync(consumer, 'utf8').match(/\$archiveSha256=(?:\$null|'[a-f0-9]{64}')/g);
    assert.equal(archivePins?.length, 1);
    const archivePinDeclaration = archivePins[0];
    const directory = mkdtempSync(join(tmpdir(), 'emr-sixth-archive-'));
    try {
      const inspection = JSON.parse(
        readFileSync(
          'milestones/M03-n8n-foundation/evidence/technical16-postclose-db-readback-20261024.json',
          'utf8',
        ),
      ).rawResult.inspection;
      const before = structuredClone(inspection),
        after = structuredClone(inspection);
      Object.assign(after.fixture, {
        competitorArchived: true,
        competitorActive: false,
        accountPaused: true,
        accountActive: false,
      });
      const archive = {
        kind: 'm03_technical16_fixture_archive',
        version: 1,
        environment: 'dev',
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        outerNativeExit: 0,
        settlementSha256: '',
        rawResult: {
          status: 'archive_verified',
          environment: 'dev',
          projectRef: 'zmotjsbzhzjvpelxvxlf',
          historyBefore: 'complete',
          historyAfter: 'complete',
          archiveNativeExit: 0,
          authenticationVerified: true,
          archiveFixture: true,
          archiveAttempted: true,
          archiveAcknowledged: true,
          fixtureArchived: true,
          childrenClosed: true,
          scratchDeleted: true,
          persistentAdminPreserved: true,
          inspectParentLockDeleted: true,
          pushAttempted: false,
          archiveBefore: before,
          archiveAfter: after,
        },
        cleanup: {
          parentAbsent: true,
          childAbsent: true,
          parentLockAbsent: true,
          persistentAdminRetained: true,
          privateContentsRead: false,
          networkRequests: 0,
        },
        pins: {},
      };
      const file = join(directory, 'fixture.json');
      writeFileSync(file, JSON.stringify(archive));
      assert.equal(
        run(`
${definitions(['Assert-Keys', 'Assert-Path', 'Read-Json', 'File-Hash', 'Assert-FoundationArchiveInspection', 'Read-FoundationForwardPrior'])}
$repo=${quote(directory)};$projectRef='zmotjsbzhzjvpelxvxlf';$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$TechnicalResidual13=$false;$TechnicalResidual16=$false;$script:proofValid=$true
function Foundation-ForwardWindowId{return 'edbc6d11-7c1f-43a7-b745-1ded06deb29f'}
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=17}}
function Read-FoundationTechnical16Closed{return (Read-Json ${quote(file)}).rawResult.archiveAfter.window}
function Assert-FoundationTechnical16Settled($Expected){if(-not $script:proofValid){throw 'SETTLEMENT_NOT_QUALIFIED'};return [pscustomobject]@{usage=[pscustomobject]@{management=914;control=1045;combined=1959}}}
$archive=Read-Json ${quote(file)};$original=$archive|ConvertTo-Json -Depth 40 -Compress
$base='scripts/db/out/m03-foundation-archive-4c602549-2c42-4ec3-9328-714d7cb66a77-after-preflight-698498b3';$settlement='milestones/M03-n8n-foundation/evidence/technical16-native-settlement-20261024.json';$relative='milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-20261024.json'
foreach($p in @($settlement,($base+'-attempt.json'),($base+'-latest.json'),$relative)){$absolute=Join-Path $repo $p;$null=[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($absolute));[IO.File]::WriteAllText($absolute,'{}')}
function Persist($v){
 [IO.File]::WriteAllText((Join-Path $repo ($base+'-latest.json')),($v.rawResult|ConvertTo-Json -Depth 40 -Compress),[Text.UTF8Encoding]::new($false))
 $v.pins=[pscustomobject]@{};foreach($p in @($settlement,($base+'-attempt.json'),($base+'-latest.json'))){$v.pins|Add-Member -NotePropertyName $p -NotePropertyValue (File-Hash (Join-Path $repo $p))};$v.settlementSha256=$v.pins.$settlement
 [IO.File]::WriteAllText((Join-Path $repo $relative),($v|ConvertTo-Json -Depth 40 -Compress),[Text.UTF8Encoding]::new($false));$script:archiveSha=File-Hash (Join-Path $repo $relative)
}
Persist $archive
$fn=(Get-Command Read-FoundationForwardPrior).ScriptBlock.ToString();$declaration=${quote(archivePinDeclaration)}
Set-Item -Path Function:Read-FoundationForwardPrior -Value ([scriptblock]::Create($fn.Replace($declaration,'$archiveSha256=$null')))
$denied=$false;try{$null=Read-FoundationForwardPrior}catch{$denied=$true};if(-not $denied){throw 'NULL_ACTUAL_ARCHIVE_PIN_GRANTED'}
Set-Item -Path Function:Read-FoundationForwardPrior -Value ([scriptblock]::Create($fn))
$denied=$false;try{$null=Read-FoundationForwardPrior}catch{$denied=$true};if(-not $denied){throw 'REAL_PIN_AUTHORIZED_SYNTHETIC_ARCHIVE'}
Set-Item -Path Function:Read-FoundationForwardPrior -Value ([scriptblock]::Create($fn.Replace($declaration,'$archiveSha256=$script:archiveSha')))
$actual=Read-FoundationForwardPrior;if($actual.fixtureAuditCount -ne 7 -or -not $actual.fixture.competitorArchived -or -not $actual.technical16Exact){throw 'ARCHIVED_SIXTH_BASELINE_NOT_SELECTED'}
foreach($fault in @('auth','history','archiveExit','before','after','audits','prior16','admitted','requests','pending','cleanup','network','settlement')){
 $v=ConvertFrom-Json -InputObject $original
 switch($fault){'auth'{$v.rawResult.authenticationVerified=$false};'history'{$v.rawResult.historyBefore='pending'};'archiveExit'{$v.rawResult.archiveNativeExit='0'};'before'{$v.rawResult.archiveBefore.fixture.competitorArchived=$true};'after'{$v.rawResult.archiveAfter.fixture.competitorArchived=$false};'audits'{$v.rawResult.archiveAfter.fixtureAuditCount=6};'prior16'{$v.rawResult.archiveAfter.technical16Exact=$false};'admitted'{$v.rawResult.archiveAfter.globalAdmittedCount=8};'requests'{$v.rawResult.archiveAfter.globalRequestCount=3};'pending'{$v.rawResult.archiveAfter.reservedRequests=1};'cleanup'{$v.cleanup.persistentAdminRetained=$false};'network'{$v.cleanup.networkRequests='0'};'settlement'{$script:proofValid=$false}}
 Persist $v;$denied=$false;try{$null=Read-FoundationForwardPrior}catch{$denied=$true};$script:proofValid=$true;if(-not $denied){throw ('UNQUALIFIED_SIXTH_ARCHIVE_'+$fault)}
}
Write-Output 'PINNED_SETTLEMENT_AND_ARCHIVED_SEVEN_AUDITS'
`),
        'PINNED_SETTLEMENT_AND_ARCHIVED_SEVEN_AUDITS',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
$script:ordinal=16;$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture
$script:proofValid=$false;$denied=$false;try{$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture}catch{$denied=$true};if(-not $denied -or $script:queryCount -ne 3){throw 'UNPROVEN_TECHNICAL16_AUDIT_QUERIED'}
$script:ordinal=13;$denied=$false;try{$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture}catch{$denied=$true};if(-not $denied -or $script:queryCount -ne 3){throw 'WRONG_TECHNICAL_AUDIT_QUERIED'}
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
$script:ordinal=16;if((Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock) -ne $true -or $script:projectVerifiedTechnicalOrdinal -ne 16){throw 'VALID_TECHNICAL16_ANCESTRY_DENIED'}
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
function Read-FoundationTechnical14NoAdmin([int]$Ordinal=14){if(-not $script:proofValid){throw 'MISSING_NO_ADMIN_PROOF'};if($Ordinal -eq 15){return '59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd'};return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql'
if(-not $body.Contains("set_config('emr.smoke_technical14_no_reactivation','6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960',true)")){throw 'QUALIFIED_SQL_MARKER_MISSING'}
$script:ordinal=16;$body=Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql';if(-not $body.Contains("set_config('emr.smoke_technical15_no_reactivation','59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd',true)")){throw 'QUALIFIED_SECOND_SQL_MARKER_MISSING'}
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
  'technical16 source closure requires the observed settlement archive and failed preflight assets',
  native,
  () => {
    assert.equal(
      run(`
$source=[IO.File]::ReadAllText(${quote(consumer)})
$start=$source.IndexOf('$requiredFiles = @(');$end=$source.IndexOf('$versions = @(',$start)
if($start -lt 0 -or $end -le $start){throw 'PUBLIC_DECLARATIONS_NOT_FOUND'}
$ForwardWindow=$false;$TechnicalResidual13=$false;$TechnicalResidual16=$false;$caRelative='scripts/seed/certs/supabase-root-2021.crt';$cliRelative='node_modules/.pnpm/@supabase+cli-windows-x64@2.121.0/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
foreach($forward in @($false,$true)){
 $ForwardMigration=$forward;Invoke-Expression $source.Substring($start,$end-$start)
 if($requiredFiles.Count -ne $(if($forward){76}else{74}) -or @($requiredFiles|Select-Object -Unique).Count -ne $requiredFiles.Count){throw 'EXACT_PUBLIC_SOURCE_COUNT_CHANGED'}
 foreach($relative in @('milestones/M03-n8n-foundation/evidence/technical16-native-settlement-20261024.json','milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-preflight-failure-20261024.json','milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-20261024.json')){if(@($requiredFiles|Where-Object{$_ -ceq $relative}).Count -ne 1){throw 'OBSERVED_SOURCE_NOT_PINNED_ONCE'}}
}
Write-Output 'PUBLIC_REGULAR74_FORWARD76_OBSERVED_ONLY'
`),
      'PUBLIC_REGULAR74_FORWARD76_OBSERVED_ONLY',
    );
  },
);

test(
  'actual forward packet has all76 source-required public pins and retains every old migration field',
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
if($requiredFiles.Count -ne 76 -or $packet.baseline.Count -ne 14 -or $packet.pending.Count -ne 1 -or $packet.pending[0].historySha256 -cne '12e313d1c6337209cf7657d6d076b101f446b567033c2d2b3e65c38dbbe7ed18'){throw 'FORWARD_PUBLIC_CONTRACT_CHANGED'}
foreach($relative in @('milestones/M03-n8n-foundation/evidence/technical16-native-settlement-20261024.json','milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-preflight-failure-20261024.json','milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-20261024.json')){if(@($requiredFiles|Where-Object{$_ -ceq $relative}).Count -ne 1){throw 'OBSERVED_SOURCE_NOT_PINNED_ONCE'}}
$prior=@($old.baseline)+@($old.pending)
for($i=0;$i -lt 14;$i++){foreach($field in @('version','name','file','sha256','historySha256')){if($prior[$i].$field -cne $packet.baseline[$i].$field){throw 'ORIGINAL_MIGRATION_REWRITTEN'}}}
Write-Output 'EXACT_PUBLIC_76_AND_OLD14'
`),
      'EXACT_PUBLIC_76_AND_OLD14',
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
  {
    name: 'post15-browser',
    options: { restoredBrowserRetryDiscovery: true },
    managementMaximum: 1024,
    managementAttempts: 524,
    controlAttempts: 843,
    combinedAttempts: 1367,
    technicalOrdinal: 16,
  },
  {
    name: 'unadmitted-carry',
    options: { unadmittedWf00Reconciled: true },
    managementMaximum: 1024,
    managementAttempts: 527,
    controlAttempts: 846,
    combinedAttempts: 1373,
    technicalOrdinal: 16,
  },
  {
    name: 'settled17',
    options: { technical16Settled: true },
    managementMaximum: 1408,
    managementAttempts: 963,
    controlAttempts: 1094,
    combinedAttempts: 2057,
    technicalOrdinal: 17,
  },
  {
    name: 'preready18',
    options: { technical16Settled: true, technical17PreReady: true },
    managementMaximum: 1408,
    managementAttempts: 963,
    controlAttempts: 1094,
    combinedAttempts: 2057,
    technicalOrdinal: 18,
  },
  {
    name: 'closed18-to19',
    options: { technical16Settled: true, technical17PreReady: true, technical18Closed: true },
    managementMaximum: 1408,
    managementAttempts: 1023,
    controlAttempts: 1145,
    combinedAttempts: 2168,
    technicalOrdinal: 19,
  },
  {
    name: 'restored19-to20',
    options: {
      technical16Settled: true,
      technical17PreReady: true,
      technical18Closed: true,
      technical19Restored: true,
      technical20SourceSelected: true,
    },
    managementMaximum: 1728,
    managementAttempts: 1317,
    controlAttempts: 1246,
    combinedAttempts: 2563,
    technicalOrdinal: 20,
  },
  {
    name: 'preready20-to21',
    options: {
      technical16Settled: true,
      technical17PreReady: true,
      technical18Closed: true,
      technical19Restored: true,
      technical20PreReady: true,
      technical20SourceSelected: true,
    },
    managementMaximum: 1728,
    managementAttempts: 1317,
    controlAttempts: 1246,
    combinedAttempts: 2563,
    technicalOrdinal: 21,
  },
  {
    name: 'post20-ui-to21',
    options: {
      technical16Settled: true,
      technical17PreReady: true,
      technical18Closed: true,
      technical19Restored: true,
      technical20PreReady: true,
      technical20SourceSelected: true,
      post20UiStart: true,
    },
    managementMaximum: 1728,
    managementAttempts: 1317,
    controlAttempts: 1249,
    combinedAttempts: 2566,
    technicalOrdinal: 21,
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
        if (!profile.options.post20UiStart)
          delete packet.files[
            'milestones/M03-n8n-foundation/evidence/wf00-unadmitted-manual-start-20261025.json'
          ];
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
        if (profile.options.post20UiStart) {
          const relative =
            'milestones/M03-n8n-foundation/evidence/wf00-unadmitted-manual-start-20261025.json';
          helperSource = helperSource.replaceAll(
            'c5e4e506d788b399fd95354cc2bc59849076daec48e0a41901e717a4a22c157e',
            hash(readFileSync(join(fixture.directory, relative))),
          );
        }
        if (
          profile.options.restoredBrowserDiscovery ||
          profile.options.restoredBrowserRetryDiscovery ||
          profile.options.unadmittedWf00Reconciled ||
          profile.options.technical16Settled
        ) {
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
            ...(profile.options.restoredBrowserRetryDiscovery ||
            profile.options.unadmittedWf00Reconciled ||
            profile.options.technical16Settled
              ? [
                  [
                    'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical15-reconciliation-20261024.json',
                    '59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd',
                  ],
                  [
                    'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical15-cleanup-20261024.json',
                    '21d4d3c897b67189999ae502906dac4cfeb33e187011a8958913bb6fba705b29',
                  ],
                ]
              : []),
          ])
            helperSource = helperSource.replaceAll(
              original,
              hash(readFileSync(join(fixture.directory, relative))),
            );
        }
        if (profile.options.technical16Settled) {
          // Qualify the complete synthetic historical chain through the actual
          // native validators. Only immutable public hash literals are rebound
          // in this test copy; no process/ancestry/settlement check is removed.
          const evidence = 'milestones/M03-n8n-foundation/evidence/';
          const replacements = new Map([
            [
              hash(readFileSync(resolve('n8n/foundation/bindings.dev.json'))),
              hash(readFileSync(join(fixture.directory, 'n8n/foundation/bindings.dev.json'))),
            ],
          ]);
          for (const name of [
            'dev-acceptance-technical16-reconciliation-20261024.json',
            'dev-acceptance-technical16-cleanup-20261024.json',
            'technical16-postclose-custody-20261024.json',
            'technical16-executed-parameters-resolution-20261024.json',
            'technical16-native-settlement-20261024.json',
          ]) {
            const relative = evidence + name;
            const original = readFileSync(resolve(relative));
            replacements.set(hash(original), hash(readFileSync(join(fixture.directory, relative))));
            const document = JSON.parse(original);
            if (
              ![
                'dev-acceptance-technical16-reconciliation-20261024.json',
                'technical16-postclose-custody-20261024.json',
                'technical16-native-settlement-20261024.json',
              ].includes(name)
            )
              continue;
            for (const [path, originalHash] of Object.entries(document.pins ?? {})) {
              const syntheticPath = join(fixture.directory, path);
              assert.ok(existsSync(syntheticPath), 'synthetic native custody input ' + path);
              replacements.set(originalHash, hash(readFileSync(syntheticPath)));
            }
          }
          for (const [originalHash, syntheticHash] of replacements)
            helperSource = helperSource.replaceAll(originalHash, syntheticHash);
          const archivePins = helperSource.match(/\$archiveSha256=(?:\$null|'[a-f0-9]{64}')/g);
          assert.equal(archivePins?.length, 1);
          helperSource = helperSource.replace(
            archivePins[0],
            "$archiveSha256='" +
              hash(
                readFileSync(join(fixture.directory, evidence + 'technical16-fixture-archive-20261024.json')),
              ) +
              "'",
          );
        }
        if (profile.options.technical18Closed) {
          const relative =
            'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical18-preparation-reconciliation-20261025.json';
          const pin = helperSource.match(/\$technical18Sha256='[a-f0-9]{64}'/g);
          assert.equal(pin?.length, 1);
          helperSource = helperSource.replace(
            pin[0],
            "$technical18Sha256='" + hash(readFileSync(join(fixture.directory, relative))) + "'",
          );
        }
        if (profile.options.technical20PreReady) {
          const relative =
            'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical20-pre-ready-reconciliation-20261025.json';
          const pin = helperSource.match(/\$technical20Sha256='[a-f0-9]{64}'/g);
          assert.equal(pin?.length, 1);
          helperSource = helperSource.replace(
            pin[0],
            "$technical20Sha256='" + hash(readFileSync(join(fixture.directory, relative))) + "'",
          );
        }
        if (profile.options.technical19Restored) {
          const evidence = 'milestones/M03-n8n-foundation/evidence/';
          const replacements = new Map([['5f256ce915f930481b0d31ac38b919c0a7692cd1', 'c'.repeat(40)]]);
          for (const name of [
            'dev-acceptance-technical19-restored-20261025.json',
            'dev-acceptance-technical19-database-readback-20261025.json',
          ]) {
            const relative = evidence + name;
            replacements.set(
              hash(readFileSync(resolve(relative))),
              hash(readFileSync(join(fixture.directory, relative))),
            );
          }
          const original = JSON.parse(
            readFileSync(
              resolve(evidence + 'dev-acceptance-technical19-database-readback-20261025.json'),
              'utf8',
            ),
          ).actualNativeResult.inspection.window;
          const synthetic = JSON.parse(
            readFileSync(
              join(
                fixture.directory,
                evidence + 'dev-acceptance-technical19-database-readback-20261025.json',
              ),
              'utf8',
            ),
          ).actualNativeResult.inspection.window;
          for (const key of ['audience', 'commitSha', 'deploymentId'])
            replacements.set(original[key], synthetic[key]);
          let controlSource = readFileSync(resolve('scripts/db/windows/Foundation-AdminControl.ps1'), 'utf8');
          for (const [original, rebound] of replacements) {
            helperSource = helperSource.replaceAll(original, rebound);
            controlSource = controlSource.replaceAll(original, rebound);
          }
          // The existing19-family predicate also pins the older16 archive.
          controlSource = controlSource.replaceAll(
            'd8177cbc39dd0805b831cfddbf0f0d25ab8ce749243b1eab0a0fdf0e4ccae97d',
            hash(
              readFileSync(join(fixture.directory, evidence + 'technical16-fixture-archive-20261024.json')),
            ),
          );
          put('scripts/db/windows/Foundation-AdminControl.ps1', controlSource);
        }
        // Keep the real guard/timeout/closure conditions. This isolated public
        // copy adds only a finite failure label so a refusal cannot be confused
        // with a native18 ancestry or archived-baseline failure.
        const guardChild =
          "if(-not $answer.ok -or -not $answer.closed){throw 'blocked'}\n    $script:publicPreflightStage='CLAIMED_DTO'";
        assert.equal(helperSource.split(guardChild).length, 2);
        helperSource = helperSource.replace(
          guardChild,
          "if(-not $answer.ok -or -not $answer.closed){if(-not $answer.started){throw 'SYNTHETIC_GUARD_NOT_STARTED'};if(-not $answer.closed){throw 'SYNTHETIC_GUARD_UNCLOSED'};if($answer.nativeExit -eq 1){throw 'SYNTHETIC_GUARD_EXIT_ONE'};throw 'SYNTHETIC_GUARD_OTHER_EXIT'}\n    $script:publicPreflightStage='CLAIMED_DTO'",
        );
        const privateBoundary = helperSource.indexOf('if($CheckOnly -and $ForwardMigration){Write-Output');
        assert.ok(privateBoundary > 0);
        // Execute the actual complete Run-only public prefix, not a detached DTO
        // validator. This test copy physically cannot reach a DPAPI/private block.
        const publicPrefix = helperSource
          .slice(0, privateBoundary)
          .replace(
            "Write-Output 'M03_FOUNDATION PREFLIGHT_BLOCKED. Public packet/seal/target/CLI verification failed; no decryption or authentication attempted.'",
            "if($_.Exception.Message -cin @('SYNTHETIC_GUARD_NOT_STARTED','SYNTHETIC_GUARD_UNCLOSED','SYNTHETIC_GUARD_EXIT_ONE','SYNTHETIC_GUARD_OTHER_EXIT')){Write-Output $_.Exception.Message}else{Write-Output ('SYNTHETIC_PUBLIC_PREFLIGHT_LINE='+$_.InvocationInfo.ScriptLineNumber)}",
          )
          .replace(
            "Write-Output ('M03_FOUNDATION PREFLIGHT_BLOCKED. Stage='+$stage+'; no private file read, decryption or authentication attempted.')",
            "if($_.Exception.Message -cin @('SYNTHETIC_GUARD_NOT_STARTED','SYNTHETIC_GUARD_UNCLOSED','SYNTHETIC_GUARD_EXIT_ONE','SYNTHETIC_GUARD_OTHER_EXIT')){Write-Output $_.Exception.Message}else{Write-Output ('SYNTHETIC_PUBLIC_PREFLIGHT_LINE='+$_.InvocationInfo.ScriptLineNumber)}",
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
let stage='GUARD_IMPORT';
try {
const guard=await import(${JSON.stringify(pathToFileURL(guardPath).href)});
stage='GUARD_READ';
const unclaimed=guard.readFoundationProjectVerifiedContinuation();
stage='GUARD_CLAIM';
const proof=guard.claimFoundationProjectVerifiedContinuation(unclaimed);
stage='LOCK_OPEN';
const lockPath=${JSON.stringify(join(fixture.directory, 'scripts/n8n/out/foundation/live/runtime.operation.lock'))};
const lock=openSync(lockPath,'wx');writeFileSync(lock,'emr-m03-foundation-live-runtime-v1\\n');
try {
 stage='LIVE_TAIL_APPEND';
 const managementPath=${JSON.stringify(fixture.paths.management)},controlPath=${JSON.stringify(fixture.paths.control)};
 const management=readFileSync(managementPath,'utf8').trimEnd().split('\\n').map(JSON.parse);
 const control=readFileSync(controlPath,'utf8').trimEnd().split('\\n').map(JSON.parse).filter(r=>r.event==='control_request_intent');
 for(let i=1;i<=25;i++)appendFileSync(managementPath,JSON.stringify({event:'management_attempt',ordinal:management.length-1+i})+'\\n');
 for(let i=1;i<=51;i++)appendFileSync(controlPath,JSON.stringify({event:'control_request_intent',ordinal:control.length+i,kind:'discovery',workflowId:'MzimjpsuyPuK7SKe',at:new Date().toISOString()})+'\\n');
 stage='NATIVE_PUBLIC_PREFIX';
 const r=spawnSync(${JSON.stringify(powershell)},['-NoProfile','-NonInteractive','-File',${JSON.stringify(adminPath)},'-PhaseAControl','-ProjectVerifiedContinuation','-ForwardWindow'],{cwd:${JSON.stringify(fixture.directory)},env:Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]]])),windowsHide:true,encoding:'utf8',timeout:40000});
 const line=(r.stdout??'').trim();
 console.log(JSON.stringify({kind:'synthetic_public_run_result',nativeExit:r.status,publicReady:line==='SYNTHETIC_FULL_PUBLIC_RUN_READY',fixedDiagnostic:/^(?:SYNTHETIC_GUARD_(?:NOT_STARTED|UNCLOSED|EXIT_ONE|OTHER_EXIT)|SYNTHETIC_PUBLIC_PREFLIGHT_LINE=\\d+|M03_FOUNDATION PREFLIGHT_BLOCKED\\. Stage=[A-Z_]+; no private file read, decryption or authentication attempted\\.)$/.test(line)?line:null,stderrObserved:Boolean(r.stderr),privateRead:false,networkRequests:0}));
 process.exitCode=r.status===0&&line==='SYNTHETIC_FULL_PUBLIC_RUN_READY'?0:1;
} finally {closeSync(lock);unlinkSync(lockPath);}
} catch {console.log(JSON.stringify({kind:'synthetic_public_run_result',publicReady:false,fixedDiagnostic:'SYNTHETIC_'+stage+'_BLOCKED',privateRead:false,networkRequests:0}));process.exitCode=1;}
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
