import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test(
  'unused bypass cleanup rejects changed closure proof and out-of-segment metadata without running cleanup',
  { skip: process.platform !== 'win32' },
  () => {
    const sourcePath = resolve('scripts/n8n/windows/Remove-M03PostcheckUnusedBypass.ps1');
    assert.ok(existsSync(sourcePath), 'fixed cleanup helper is missing');
    const root = mkdtempSync(join(tmpdir(), 'emr-unused-bypass-pure-'));
    try {
      // Extract only pure validators. The cleanup entrypoint, private paths and
      // metadata native code are deliberately never evaluated by this test.
      const script = join(root, 'pure.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$source='${sourcePath.replaceAll("'", "''")}'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'parse'}
$native=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.StringConstantExpressionAst] -and $node.Value.Contains('public static class EmrM03UnusedBypassNative')},$true))
if($native.Count -ne 1){throw 'native'}
Add-Type -TypeDefinition $native[0].Value -ErrorAction Stop
$owned='${join(root, 'owned-public-metadata.txt').replaceAll("'", "''")}'
[IO.File]::WriteAllText($owned,'PUBLIC_SYNTHETIC_MARKER')
$metadata=[EmrM03UnusedBypassNative]::Open($owned,$false)
try{
  $info=[EmrM03UnusedBypassNative]::Inspect($metadata)
  if($info.NumberOfLinks -ne 1 -or ($info.Attributes -band 0x410) -ne 0 -or $info.Created.Kind -ne [DateTimeKind]::Utc){throw 'metadata'}
}finally{$metadata.Dispose()}
$public=[EmrM03UnusedBypassNative]::Open($owned,$true)
try{
  $stream=[IO.FileStream]::new($public,[IO.FileAccess]::Read)
  try{$reader=[IO.StreamReader]::new($stream);try{if($reader.ReadToEnd() -cne 'PUBLIC_SYNTHETIC_MARKER'){throw 'public'}}finally{$reader.Dispose()}}finally{$stream.Dispose()}
}finally{$public.Dispose()}
foreach($name in @('Assert-ExactKeys','Assert-ClosedAttempt','Assert-LeafTimes')){
  $definition=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
  if($definition.Count -ne 1){throw 'missing'}
  . ([ScriptBlock]::Create($definition[0].Extent.Text))
}
$proof=Get-Content -LiteralPath '${resolve('milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-attempt-20261021.json').replaceAll("'", "''")}' -Raw | ConvertFrom-Json
Assert-ClosedAttempt $proof
$proof.wrapperClose.childClosed=$false
try{Assert-ClosedAttempt $proof;throw 'accepted'}catch{if($_.Exception.Message -ceq 'accepted'){throw}}
$proof.wrapperClose.childClosed=$true;$proof.setup.writeIntents=1
try{Assert-ClosedAttempt $proof;throw 'accepted'}catch{if($_.Exception.Message -ceq 'accepted'){throw}}
Assert-LeafTimes ([DateTime]::Parse('2026-10-21T18:41:00Z').ToUniversalTime()) ([DateTime]::Parse('2026-10-21T18:41:01Z').ToUniversalTime())
try{Assert-LeafTimes ([DateTime]::Parse('2026-10-21T18:41:00Z').ToUniversalTime()) ([DateTime]::Parse('2026-10-21T18:44:00Z').ToUniversalTime());throw 'accepted'}catch{if($_.Exception.Message -ceq 'accepted'){throw}}
Write-Output 'CLEANUP_PURE_GUARDS_PASS'
`,
      );
      const result = spawnSync(
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        ['-NoProfile', '-NonInteractive', '-File', script],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 15000,
          env: Object.fromEntries(
            ['SystemRoot', 'WINDIR', 'TEMP', 'TMP'].flatMap((key) =>
              process.env[key] === undefined ? [] : [[key, process.env[key]]],
            ),
          ),
        },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(result.stdout.trim(), 'CLEANUP_PURE_GUARDS_PASS');
      assert.equal(result.stderr, '');
      const source = readFileSync(sourcePath, 'utf8');
      assert.doesNotMatch(
        source,
        /ConvertTo-SecureString|ConvertFrom-SecureString|SecureStringToBSTR|Plain-Dpapi|ReadAllText\(\$target|ReadAllBytes\(\$target/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
