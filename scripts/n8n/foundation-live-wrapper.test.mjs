import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

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
      ];
      const script = join(directory, 'projection.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$script:closureVerified=$false
$needles=[Collections.Generic.List[string]]::new();$needles.Add('PrivateKeyAlpha47');$needles.Add('123456')
$knownWorkflowIds=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);$null=$knownWorkflowIds.Add('FixtureWFID')
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
