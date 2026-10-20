import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const sourcePath = resolve('scripts/n8n/windows/New-M03AcceptanceHandoff.ps1');
const source = readFileSync(sourcePath, 'utf8');

test('live handoff has a separate approved purpose and no administrator or token extraction path', () => {
  assert.match(source, /m03_approved_dev_acceptance_/);
  assert.match(source, /f42930f90c2de43c84f61ad6d966d0ee6074d70e/);
  assert.match(source, /009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712/);
  assert.match(source, /ValidateSet\('Management','Writer','ApifyRead','All'\)/);
  assert.match(source, /Read-Host \$prompt -AsSecureString/);
  assert.match(source, /ConvertFrom-SecureString/);
  assert.match(source, /AddHours\(2\)/);
  assert.match(source, /FileMode\]::CreateNew/);
  assert.match(source, /Flush\(\$true\)/);
  assert.doesNotMatch(
    source,
    /ConvertTo-SecureString|ZeroFreeBSTR|PGPASSWORD|https?:\/\/|Invoke-WebRequest|Start-Process/,
  );
  assert.doesNotMatch(source, /Write-(Output|Host|Error|Verbose).*\$(secret|cipher|bytes|metadata)/);
});

const windowsOnly = { skip: process.platform !== 'win32' };
function runFixture(kind, inputCount, prefix = '') {
  const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-handoff-'));
  mkdirSync(join(directory, 'Temp'));
  const script = join(directory, 'fixture.ps1');
  const safePath = sourcePath.replaceAll("'", "''");
  const body = `Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
${prefix}
$global:fixturePrompts=0
function Read-Host { param($Prompt,[switch]$AsSecureString)
 $global:fixturePrompts++
 if($global:fixturePrompts -gt ${inputCount}) { throw 'synthetic prompt refused' }
 return ConvertTo-SecureString -String 'synthetic-local-fixture-only' -AsPlainText -Force
}
& '${safePath}' -Kind '${kind}'
exit $LASTEXITCODE
`;
  writeFileSync(script, body);
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
    env: {
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      PATH: process.env.PATH,
      TEMP: directory,
      TMP: directory,
      LOCALAPPDATA: directory,
    },
    windowsHide: true,
    encoding: 'utf8',
    timeout: 15000,
  });
  return { directory, result };
}

test('Windows helper saves only a synthetic purpose-bound Management handoff', windowsOnly, () => {
  const { directory, result } = runFixture('Management', 1);
  try {
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /M03_ACCEPTANCE_HANDOFF_READY: Management\./);
    assert.doesNotMatch(result.stdout, /synthetic-local-fixture-only/);
    const files = readdirSync(join(directory, 'Temp')).sort();
    assert.deepEqual(files, [
      'emr-m03-acceptance-management.dpapi',
      'emr-m03-acceptance-management.lease.json',
    ]);
    const lease = JSON.parse(readFileSync(join(directory, 'Temp', files[1]), 'utf8'));
    assert.equal(lease.purpose, 'm03_approved_dev_acceptance_management');
    assert.equal(lease.kind, 'Management');
    assert.equal(Date.parse(lease.expiresAt) - Date.parse(lease.createdAt), 7200000);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('partial All input refusal removes only invocation-created synthetic handoffs', windowsOnly, () => {
  const { directory, result } = runFixture('All', 1);
  try {
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.trim(), 'M03_ACCEPTANCE_HANDOFF_BLOCKED');
    assert.deepEqual(readdirSync(join(directory, 'Temp')), []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('existing handoff is never overwritten or consumed by delivery', windowsOnly, () => {
  const { directory, result } = runFixture(
    'Management',
    0,
    "[IO.File]::WriteAllText((Join-Path $env:LOCALAPPDATA 'Temp\\emr-m03-acceptance-management.dpapi'),'synthetic-existing-ciphertext')",
  );
  try {
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.trim(), 'M03_ACCEPTANCE_HANDOFF_BLOCKED');
    assert.equal(
      readFileSync(join(directory, 'Temp', 'emr-m03-acceptance-management.dpapi'), 'utf8'),
      'synthetic-existing-ciphertext',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
