import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const quote = (text) => "'" + text.replaceAll("'", "''") + "'";
const segmentId = 'e8035391-dba8-48c9-97e0-139ba980d86e';
const startupSegmentId = '1c69c89e-7807-46d5-b7b8-ca28285ff2b4';

// A new owned, harmless PS wrapper -> Node runtime -> PS administrator chain.
// Only the source-reviewed three-field CIM projection reads these new children.
// All JSON lives in this test's temp root; no credential or canonical file opens.
function nativeTopology({
  holdParentLock = false,
  legacyReader = false,
  assertParentDenials = false,
  startupReplacement = false,
} = {}) {
  const activeSegmentId = startupReplacement ? startupSegmentId : segmentId;
  const ledgerStem = startupReplacement ? 'startup-replacement' : 'remaining-continuation';
  const proofKind = startupReplacement ? 'm03_startup_replacement' : 'm03_remaining_continuation';
  const ancestryFunction = startupReplacement
    ? 'Assert-FoundationStartupReplacementProcessAncestry'
    : 'Assert-FoundationRemainingProcessAncestry';
  const directory = mkdtempSync(join(tmpdir(), 'emr-remaining-native-topology-'));
  const local = join(directory, 'synthetic-localappdata');
  const live = join(directory, 'scripts/n8n/out/foundation/live');
  mkdirSync(join(local, 'Temp'), { recursive: true });
  mkdirSync(live, { recursive: true });
  const adminPath = join(directory, 'admin.ps1');
  const runtimePath = join(directory, 'runtime.mjs');
  const wrapperPath = join(directory, 'wrapper.ps1');
  const claimPath = join(live, `${ledgerStem}-${activeSegmentId}.runtime-claim.json`);
  const admissionPath = join(live, `${ledgerStem}-${activeSegmentId}.json`);
  const sourcePath = resolve('scripts/db/windows/Invoke-M03FoundationMigrations.ps1');
  assert.ok(readFileSync(sourcePath, 'utf8').includes('function Read-FoundationKernelProcess'));
  writeFileSync(
    adminPath,
    `$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(sourcePath)},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'SOURCE_PARSE_FAILED'}
foreach($name in @('Assert-Path','Read-Json','File-Hash','Assert-Keys','Read-FoundationKernelProcess','Read-FoundationParentLock','${ancestryFunction}')){
 $found=@($ast.FindAll({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true));if($found.Count -ne 1){throw 'SOURCE_FUNCTION_MISSING'};$definition=$found[0].Extent.Text
 if($name -ceq 'Read-FoundationParentLock' -and $${legacyReader}){$definition='function Read-FoundationParentLock([string]$File){return Read-Json $File}'};Invoke-Expression $definition
}
$repo=${quote(directory)};$RemainingContinuation=$${!startupReplacement};$StartupReplacement=$${startupReplacement};$CheckOnly=$false
$clock=Read-Json ${quote(admissionPath)}
$parentPath=${quote(join(local, 'Temp/emr-m03-acceptance-parent.operation.lock'))}
if($${assertParentDenials}){
 foreach($operation in @('write','delete')){
  $denied=$false;try{if($operation -ceq 'write'){$other=[IO.File]::Open($parentPath,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite);$other.Dispose()}else{[IO.File]::Delete($parentPath)}}catch{$native=$_.Exception;while($null -ne $native.InnerException){$native=$native.InnerException};if(($native.HResult -band 65535) -eq 32){$denied=$true}else{throw}}
  if(-not $denied){throw 'PARENT_LOCK_MUTATION_ADMITTED'}
 }
}
$stage='native_ancestry'
try{$null=${ancestryFunction} $clock;$projection=[ordered]@{status='native_ancestry_ready';privateRead=$false;networkRequests=0;canonicalReads=0};if($StartupReplacement){$projection['segmentId']=$clock.segmentId};$projection|ConvertTo-Json -Compress;exit 0}catch{$native=$_.Exception;while($null -ne $native.InnerException){$native=$native.InnerException};$status=if(($native.HResult -band 65535) -eq 32){'native_parent_sharing_violation'}else{'native_ancestry_blocked'};[ordered]@{status=$status;privateRead=$false;networkRequests=0;canonicalReads=0}|ConvertTo-Json -Compress;exit 1}
`,
  );
  writeFileSync(
    runtimePath,
    `import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const admissionText=readFileSync(${JSON.stringify(admissionPath)},'utf8');
writeFileSync(${JSON.stringify(claimPath)},JSON.stringify({kind:'${proofKind}_runtime_claim',version:1,segmentId:${JSON.stringify(activeSegmentId)},admissionSha256:createHash('sha256').update(admissionText).digest('hex'),processId:process.pid,parentProcessId:process.ppid,claimedAt:Date.now()})+'\\n');
const r=spawnSync(${JSON.stringify(powershell)},['-NoProfile','-NonInteractive','-File',${JSON.stringify(adminPath)}],{env:Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]]])),windowsHide:true,encoding:'utf8',timeout:30000});
process.stdout.write(r.stdout??'');
if(r.stderr)process.stdout.write('{"status":"synthetic_native_stderr_present"}\\n');
process.exitCode=r.status??1;
`,
  );
  writeFileSync(
    wrapperPath,
    `$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$env:LOCALAPPDATA=${quote(local)}
$start=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$admission=[ordered]@{kind='${proofKind}_admission';segmentId='${activeSegmentId}';startsAt=$start;stopNewAt=$start+3000000;parentProcessId=$PID}
[IO.File]::WriteAllText(${quote(admissionPath)},($admission|ConvertTo-Json -Compress)+[char]10,[Text.UTF8Encoding]::new($false))
$parent=[ordered]@{kind='m03_clock_admission_parent';version=1;segmentId='${activeSegmentId}';processId=$PID}
$parentHandle=$null;$parentPath=${quote(join(local, 'Temp/emr-m03-acceptance-parent.operation.lock'))};$parentText=$parent|ConvertTo-Json -Compress
if($${holdParentLock}){$parentHandle=[IO.File]::Open($parentPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);$bytes=[Text.Encoding]::UTF8.GetBytes($parentText);$parentHandle.Write($bytes,0,$bytes.Length);$parentHandle.Flush($true)}else{[IO.File]::WriteAllText($parentPath,$parentText,[Text.UTF8Encoding]::new($false))}
try{
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=${quote(process.execPath)};$info.Arguments='"'+${quote(runtimePath)}+'"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA')){if(Test-Path ('Env:'+$name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
$child=[Diagnostics.Process]::new();$child.StartInfo=$info;$null=$child.Start();$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();$closed=$child.WaitForExit(40000)
if(-not $closed){$child.Kill();$null=$child.WaitForExit(5000);Write-Output '{"status":"synthetic_runtime_timeout"}';exit 1}
Write-Output $out.Result;if($err.Result.Length -gt 0){Write-Output '{"status":"synthetic_runtime_stderr_present"}'};$code=$child.ExitCode;$child.Dispose();exit $code
}finally{if($null -ne $parentHandle){$parentHandle.Dispose()}}
`,
  );
  try {
    const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', wrapperPath], {
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
          process.env[key] === undefined ? [] : [[key, process.env[key]]],
        ),
      ),
      windowsHide: true,
      encoding: 'utf8',
      timeout: 45000,
    });
    assert.equal(result.stderr.length, 0, 'Synthetic native child wrote stderr; raw diagnostics withheld');
    return { nativeExit: result.status, projection: JSON.parse(result.stdout.trim()) };
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(directory).startsWith('emr-remaining-native-topology-'));
    rmSync(directory, { recursive: true, force: true });
  }
}
test('remaining ancestry accepts the native clean-environment wrapper/runtime/admin topology with a closed public parent file', () => {
  assert.deepEqual(nativeTopology(), {
    nativeExit: 0,
    projection: {
      status: 'native_ancestry_ready',
      privateRead: false,
      networkRequests: 0,
      canonicalReads: 0,
    },
  });
});
test('the exact live Write/Share.Read parent handle makes the existing public ReadAllText ancestry reader fail with native sharing violation', () => {
  assert.deepEqual(nativeTopology({ holdParentLock: true, legacyReader: true }), {
    nativeExit: 1,
    projection: {
      status: 'native_parent_sharing_violation',
      privateRead: false,
      networkRequests: 0,
      canonicalReads: 0,
    },
  });
});
test('the bounded public-parent reader admits the held-writer topology while additional writers and deletion remain denied', () => {
  assert.deepEqual(nativeTopology({ holdParentLock: true, assertParentDenials: true }), {
    nativeExit: 0,
    projection: {
      status: 'native_ancestry_ready',
      privateRead: false,
      networkRequests: 0,
      canonicalReads: 0,
    },
  });
});

test('startup replacement ancestry accepts the actual held-writer wrapper/runtime/admin topology while additional writers and deletion remain denied', () => {
  assert.deepEqual(
    nativeTopology({
      holdParentLock: true,
      assertParentDenials: true,
      startupReplacement: true,
    }),
    {
      nativeExit: 0,
      projection: {
        status: 'native_ancestry_ready',
        privateRead: false,
        networkRequests: 0,
        canonicalReads: 0,
        segmentId: startupSegmentId,
      },
    },
  );
});

test('the dedicated public-parent reader bounds bytes, validates its exact JSON envelope and closes failed reads', () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-remaining-parent-reader-'));
  const parentPath = join(directory, 'emr-m03-acceptance-parent.operation.lock');
  const sourcePath = resolve('scripts/db/windows/Invoke-M03FoundationMigrations.ps1');
  const code = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
$stage='definitions';try{
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(sourcePath)},[ref]$tokens,[ref]$errors)
foreach($name in @('Assert-Keys','Read-FoundationParentLock')){$found=@($ast.FindAll({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true));if($found.Count -ne 1){throw 'SOURCE_FUNCTION_MISSING'};Invoke-Expression $found[0].Extent.Text}
$stage='valid';$path=${quote(parentPath)};$valid='{"kind":"m03_clock_admission_parent","version":1,"segmentId":"${segmentId}","processId":1234}'
[IO.File]::WriteAllText($path,$valid,[Text.UTF8Encoding]::new($false));$value=Read-FoundationParentLock $path;if($value.processId -ne 1234){throw 'PUBLIC_PARENT_NOT_READ'}
foreach($fault in @('empty','oversized','invalid_utf8','extra_field','array')){
 $stage=$fault
 $bytes=[byte[]]@();switch($fault){'empty'{$bytes=[byte[]]@()};'oversized'{$bytes=New-Object byte[] 4097};'invalid_utf8'{$bytes=[byte[]]@(255,255)};'extra_field'{$bytes=[Text.Encoding]::UTF8.GetBytes($valid.Replace('"processId":1234','"processId":1234,"foreign":true'))};'array'{$bytes=[Text.Encoding]::UTF8.GetBytes('[]')}}
 [IO.File]::WriteAllBytes($path,[byte[]]$bytes);$blocked=$false;try{$null=Read-FoundationParentLock $path}catch{$blocked=$true};if(-not $blocked){throw 'MALFORMED_PARENT_ACCEPTED'}
 $stage=$fault+'_exclusive';$exclusive=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$exclusive.Dispose()
}
Write-Output 'BOUNDED_PUBLIC_PARENT_READER_READY';exit 0
}catch{Write-Output ('SYNTHETIC_PUBLIC_READER_BLOCKED:'+ $stage);exit 1}
`;
  try {
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')],
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
    const fixedFailure =
      ['SOURCE_FUNCTION_MISSING', 'PUBLIC_PARENT_NOT_READ', 'MALFORMED_PARENT_ACCEPTED'].find((code) =>
        result.stderr.includes(code),
      ) ??
      'SYNTHETIC_PUBLIC_READER_STDERR:' +
        (result.stderr
          .match(/At line:(\d+) char:(\d+)/)
          ?.slice(1)
          .join(':') ?? 'unknown');
    assert.equal(result.status, 0, result.stdout);
    assert.equal(result.stderr.length, 0, fixedFailure);
    assert.equal(result.stdout.trim(), 'BOUNDED_PUBLIC_PARENT_READER_READY');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
