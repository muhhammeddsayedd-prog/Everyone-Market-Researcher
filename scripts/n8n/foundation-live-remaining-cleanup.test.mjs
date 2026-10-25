import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

const script = resolve('scripts/n8n/windows/Remove-M03RemainingTemporaryState.ps1');
const source = readFileSync(script, 'utf8');
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const windows = process.platform === 'win32';
function powershell(code) {
  const result = spawnSync(
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(
        "$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n" + code + '\nexit 0\n',
        'utf16le',
      ).toString('base64'),
    ],
    {
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((k) =>
          process.env[k] === undefined ? [] : [[k, process.env[k]]],
        ),
      ),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000,
    },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
function definitions(names) {
  return `$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${quote(script)},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'PARSE_FAILED'}
foreach($name in @(${names.map(quote).join(',')})){$found=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($found.Count -ne 1){throw 'FUNCTION_MISSING'};Invoke-Expression $found[0].Extent.Text}`;
}
function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-remaining-cleanup-test-'));
  const owner = randomUUID();
  writeFileSync(join(directory, '.test-owner'), owner);
  try {
    return run(directory);
  } finally {
    assert.equal(resolve(directory).startsWith(resolve(tmpdir()) + '\\'), windows);
    assert.ok(basename(directory).startsWith('emr-remaining-cleanup-test-'));
    assert.equal(readFileSync(join(directory, '.test-owner'), 'utf8'), owner);
    rmSync(directory, { recursive: true });
  }
}

test('cleanup source has only fixed nine-leaf deletion, metadata access and immutable public proof gates', () => {
  assert.match(source, /ValidateSet\('CheckOnly','Apply'\)/);
  for (const hash of [
    '60b1bc756fb57cfba27e44cac6444dd7882327dc3ec3d4f6c1e0b2f803229fe3',
    'c9745b21c0b9cfb6e648e23a40cd8dbb93c03d7d5bce4c245a362acee12ff4e7',
    '81d12836e721c3bb98853ff0a238c49e556f933b0094b0d11a032c7f4dcf15a6',
    'c69bef7f046d8f0a67a368b07b8cd063a6552ed6883bd530d68c817b8f890d49',
  ])
    assert.ok(source.includes(hash));
  assert.doesNotMatch(
    source,
    /Add-Type|Start-Process|\.Start\(|Invoke-WebRequest|ConvertTo-SecureString|Get-Content|Remove-Item|\[IO\.File\]::Delete/,
  );
  assert.match(source, /-Property ProcessId,ParentProcessId,CreationDate/);
  assert.match(source, /CreateNew/);
  assert.match(source, /unknownOrphanClosureProven=\$false/);
  assert.ok(
    source.indexOf('Write-RemainingNewPublic $intentPath') < source.indexOf('Remove-RemainingHeldLeaf $leaf'),
  );
  const cipherBranch = source.slice(
    source.indexOf('function Open-RemainingLeaf'),
    source.indexOf('function Write-RemainingNewPublic'),
  );
  assert.ok(cipherBranch.indexOf('if($Target.public)') < cipherBranch.indexOf('$stream.Length'));
});

test(
  'process guard rejects roots, descendants, malformed snapshots and cycles without inspecting process content',
  { skip: !windows },
  () => {
    powershell(`${definitions(['Assert-RemainingProcessSnapshot'])}
$now=[DateTime]::UtcNow.AddSeconds(-10)
$safe=@([pscustomobject]@{ProcessId=0;ParentProcessId=0;CreationDate=$null},[pscustomobject]@{ProcessId=100;ParentProcessId=0;CreationDate=$now},[pscustomobject]@{ProcessId=101;ParentProcessId=100;CreationDate=$now})
if(-not (Assert-RemainingProcessSnapshot $safe)){throw 'VALID_REFUSED'}
$reused=@([pscustomobject]@{ProcessId=0;ParentProcessId=0;CreationDate=$null},[pscustomobject]@{ProcessId=996;ParentProcessId=1196;CreationDate=$now},[pscustomobject]@{ProcessId=1196;ParentProcessId=1116;CreationDate=$now.AddSeconds(-1)},[pscustomobject]@{ProcessId=1116;ParentProcessId=996;CreationDate=$now.AddSeconds(-2)})
if(-not (Assert-RemainingProcessSnapshot $reused)){throw 'UNRELATED_REUSED_PID_CYCLE_REFUSED'}
foreach($fault in @('root','runtime','direct-child','grandchild','duplicate','bad-time','cycle','negative')){
 $rows=@($safe|ForEach-Object{$_.PSObject.Copy()})
 switch($fault){
 'root' {$rows[2].ProcessId=5468}
 'runtime' {$rows[2].ProcessId=35920}
 'direct-child' {$rows[2].ParentProcessId=35920}
 'grandchild' {$rows[1].ParentProcessId=5468}
 'duplicate' {$rows[2].ProcessId=100}
 'bad-time' {$rows[2].CreationDate='not-date'}
 'cycle' {$rows[1].ParentProcessId=101}
 'negative' {$rows[2].ProcessId=-1}
 }
 $blocked=$false;try{$null=Assert-RemainingProcessSnapshot $rows}catch{$blocked=$true};if(-not $blocked){throw 'UNSAFE_SNAPSHOT_ACCEPTED'}
}`);
  },
);

test(
  'target constructor includes exactly six runtime leaves, bypass and two locks, excluding Admin and Machine',
  { skip: !windows },
  () => {
    powershell(`${definitions(['Get-RemainingCleanupTargets'])}
$rows=@(Get-RemainingCleanupTargets 'C:\\__synthetic_temp' 'C:\\__synthetic_repo\\live')
if($rows.Count -ne 9 -or @($rows|Where-Object{$_.name -match 'foundation-dev-migration|machine|admission|claim'}).Count -ne 0){throw 'SCOPE_WRONG'}
if(@($rows|Where-Object{$_.name -match '\\.dpapi$'}).Count -ne 4 -or @($rows|Where-Object{$_.name -match '\\.lease.json$'}).Count -ne 3){throw 'SCOPE_WRONG'}
`);
  },
);

test(
  'public intent is durable and refuses any second write without overwriting the first record',
  { skip: !windows },
  () =>
    fixture((directory) => {
      const path = join(directory, 'synthetic-intent.json');
      powershell(`${definitions(['Assert-RemainingOrdinaryPath', 'Assert-RemainingAbsent', 'Write-RemainingNewPublic'])}
$path=${quote(path)};Write-RemainingNewPublic $path ([ordered]@{kind='synthetic';n=1})
$blocked=$false;try{Write-RemainingNewPublic $path ([ordered]@{kind='synthetic';n=2})}catch{$blocked=$true};if(-not $blocked){throw 'REPLAY_ACCEPTED'}
if((ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($path))).n -ne 1){throw 'OVERWRITTEN'}
`);
      assert.equal(JSON.parse(readFileSync(path, 'utf8')).n, 1);
    }),
);

test(
  'native metadata/delete-only primitive owns an exclusive handle and removes only its isolated test marker',
  { skip: !windows },
  () =>
    fixture((directory) => {
      const marker = join(directory, 'SYNTHETIC-OWNED-MARKER');
      writeFileSync(marker, 'SYNTHETIC PUBLIC TEST MARKER ONLY');
      powershell(`${definitions(['Assert-RemainingOrdinaryPath', 'Assert-RemainingAbsent', 'Initialize-RemainingNative', 'Open-RemainingLeaf', 'Remove-RemainingHeldLeaf'])}
$path=${quote(marker)};$when=[DateTime]::SpecifyKind([DateTime]::Parse('2026-10-21T23:13:00'),[DateTimeKind]::Utc)
[IO.File]::SetCreationTimeUtc($path,$when);[IO.File]::SetLastWriteTimeUtc($path,$when)
Initialize-RemainingNative
$leaf=Open-RemainingLeaf ([pscustomobject]@{path=$path;name='SYNTHETIC-OWNED-MARKER';kind='synthetic';public=$false})
$blocked=$false;try{$other=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$other.Dispose()}catch{$blocked=$true}
if(-not $blocked){throw 'EXCLUSIVE_CUSTODY_NOT_HELD'}
Remove-RemainingHeldLeaf $leaf
if([IO.File]::Exists($path) -or $leaf.handle -ne [IntPtr]::Zero){throw 'EXACT_HANDLE_DELETE_FAILED'}
`);
      assert.equal(existsSync(marker), false);
    }),
);

test(
  'public lock and lease readers reject foreign ownership while never deleting their synthetic markers',
  { skip: !windows },
  () =>
    fixture((directory) => {
      const parent = join(directory, 'SYNTHETIC-PARENT-LOCK');
      const lease = join(directory, 'SYNTHETIC-WRITER-LEASE');
      writeFileSync(
        parent,
        JSON.stringify({
          kind: 'm03_clock_admission_parent',
          version: 1,
          segmentId: 'e8035391-dba8-48c9-97e0-139ba980d86e',
          processId: 5468,
        }),
      );
      writeFileSync(
        lease,
        JSON.stringify({
          version: 1,
          windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
          purpose: 'm03_approved_dev_acceptance_writer',
          approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
          kind: 'Writer',
          createdAt: '2026-10-21T23:11:00.000Z',
          expiresAt: '2026-10-22T01:11:00.000Z',
        }),
      );
      powershell(`${definitions(['Assert-RemainingOrdinaryPath', 'Assert-RemainingKeys', 'Initialize-RemainingNative', 'Open-RemainingLeaf'])}
$segment='e8035391-dba8-48c9-97e0-139ba980d86e'
Initialize-RemainingNative
foreach($value in @(@(${quote(parent)},'parent'),@(${quote(lease)},'writer'))){
 $path=$value[0];$kind=$value[1];$when=[DateTime]::SpecifyKind([DateTime]::Parse('2026-10-21T23:13:00'),[DateTimeKind]::Utc)
 [IO.File]::SetCreationTimeUtc($path,$when);[IO.File]::SetLastWriteTimeUtc($path,$when)
 $target=[pscustomobject]@{path=$path;name='SYNTHETIC-PUBLIC-MARKER';kind=$kind;public=$true}
 $leaf=Open-RemainingLeaf $target;if([EmrM03RemainingCleanupNative]::CloseHandle($leaf.handle) -eq 0){throw 'PUBLIC_READ_CLOSED_OWNED_HANDLE'}
 $text=[IO.File]::ReadAllText($path)
 if($kind -ceq 'parent'){$text=$text.Replace('5468','5469')}else{$text=$text.Replace('m03_approved_dev_acceptance_writer','foreign-purpose')}
 [IO.File]::WriteAllText($path,$text);[IO.File]::SetLastWriteTimeUtc($path,$when)
 $blocked=$false;try{$bad=Open-RemainingLeaf $target;$null=[EmrM03RemainingCleanupNative]::CloseHandle($bad.handle)}catch{$blocked=$true};if(-not $blocked){throw 'FOREIGN_OWNER_ACCEPTED'}
 if(-not [IO.File]::Exists($path)){throw 'PUBLIC_MARKER_DELETED'}
}
`);
      assert.equal(existsSync(parent), true);
      assert.equal(existsSync(lease), true);
    }),
);
