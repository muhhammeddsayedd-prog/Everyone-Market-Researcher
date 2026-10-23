import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  readdirSync,
  rmSync,
  mkdirSync,
  existsSync,
  realpathSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';

const sourcePath = resolve('scripts/n8n/windows/New-M03AcceptanceHandoff.ps1');
const source = readFileSync(sourcePath, 'utf8');
const adapter = readFileSync(resolve('scripts/n8n/windows/Dev-CredentialStore.ps1'), 'utf8');

test('single initialization interface keeps admin separate and preserves bounded runtime purposes without extraction', () => {
  assert.match(source, /ValidateSet\('Initialize','Status','Update'\)/);
  assert.match(source, /ValidateSet\('Admin','Management','Writer','ApifyRead','All'\)/);
  assert.match(source, /Dev-CredentialStore\.ps1/);
  assert.match(source, /Get-M03DevCredentialStatus/);
  assert.match(source, /Initialize-M03DevCredentials -Action \$Action -Kind \$Kind/);
  assert.doesNotMatch(source, /Ensure-M03DevRuntimeHandoff|Read-Host|ConvertFrom-SecureString/);
  assert.match(adapter, /Everyone-Market-Radar-Private\\secrets\\dev/);
  assert.match(adapter, /if\(\$Kind -ceq 'Admin'\)\{'admin\\database\.dpapi'\}else\{'runtime\\'/);
  assert.match(adapter, /m03_approved_dev_acceptance_/);
  assert.match(adapter, /f42930f90c2de43c84f61ad6d966d0ee6074d70e/);
  assert.match(adapter, /009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712/);
  assert.match(adapter, /Read-Host \$prompt -AsSecureString/);
  assert.match(adapter, /ConvertFrom-SecureString/);
  assert.match(adapter, /function Ensure-M03DevRuntimeHandoff/);
  assert.match(adapter, /AddHours\(2\)/);
  assert.match(adapter, /FileMode\]::CreateNew/);
  assert.match(adapter, /Flush\(\$true\)/);
  assert.doesNotMatch(
    source + adapter,
    /ConvertTo-SecureString|ZeroFreeBSTR|PGPASSWORD|https?:\/\/|Invoke-WebRequest|Start-Process/,
  );
  assert.doesNotMatch(
    source + adapter,
    /Write-(Output|Host|Error|Verbose).*\$(secret|cipher|bytes|metadata)/,
  );
});

const windowsOnly = { skip: process.platform !== 'win32' };
function runFixture(kind, inputCount, prefix = '') {
  const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-handoff-'));
  mkdirSync(join(directory, 'Temp'));
  const script = join(directory, 'fixture.ps1');
  const safePath = sourcePath.replaceAll("'", "''");
  const body = `Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
${prefix}
$global:fixturePrompts=0
function Read-Host { param($Prompt,[switch]$AsSecureString)
 $global:fixturePrompts++
 if($global:fixturePrompts -gt ${inputCount}) { throw 'synthetic prompt refused' }
 return ConvertTo-SecureString -String 'synthetic-local-fixture-only' -AsPlainText -Force
}
& '${safePath}' -Action Initialize -Kind '${kind}'
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

function cleanupFixture(directory) {
  const absolute = resolve(directory);
  assert.ok(absolute.startsWith(resolve(tmpdir()) + sep));
  assert.ok(basename(absolute).startsWith('emr-acceptance-handoff-'));
  assert.equal(realpathSync.native(absolute).toLowerCase(), absolute.toLowerCase());
  rmSync(absolute, { recursive: true, force: true });
}

test(
  'Windows initialization entrypoint saves only a persistent synthetic Management original and no runtime copy',
  windowsOnly,
  () => {
    const { directory, result } = runFixture('Management', 1);
    try {
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /M03_DEV_ACCESS_READY/);
      assert.doesNotMatch(result.stdout, /synthetic-local-fixture-only/);
      assert.deepEqual(readdirSync(join(directory, 'Temp')), []);
      const store = join(directory, 'Everyone-Market-Radar-Private/secrets/dev');
      assert.deepEqual(readdirSync(join(store, 'runtime')), ['management.dpapi']);
      assert.deepEqual(readdirSync(join(store, 'admin')), []);
      const ciphertext = readFileSync(join(store, 'runtime/management.dpapi'), 'utf8');
      assert.match(ciphertext, /^01000000d08c9ddf0115d1118c7a00c04fc297eb[0-9a-f]+$/i);
      assert.doesNotMatch(ciphertext, /synthetic-local-fixture-only/);
    } finally {
      cleanupFixture(directory);
    }
  },
);

test(
  'partial consolidated setup refusal retains completed encrypted input without runtime copies or raw errors',
  windowsOnly,
  () => {
    const { directory, result } = runFixture('All', 1);
    try {
      assert.equal(result.status, 1);
      assert.equal(result.stderr, '');
      assert.equal(result.stdout.trim(), 'M03_DEV_ACCESS_BLOCKED');
      assert.doesNotMatch(result.stdout, /synthetic-local-fixture-only|synthetic prompt refused/);
      assert.deepEqual(readdirSync(join(directory, 'Temp')), []);
      const store = join(directory, 'Everyone-Market-Radar-Private/secrets/dev');
      assert.equal(existsSync(join(store, 'admin/database.dpapi')), true);
      assert.deepEqual(readdirSync(join(store, 'runtime')), []);
    } finally {
      cleanupFixture(directory);
    }
  },
);

test(
  'unpaired existing temporary ciphertext is never overwritten, imported or consumed by initialization',
  windowsOnly,
  () => {
    const { directory, result } = runFixture(
      'Management',
      0,
      "[IO.File]::WriteAllText((Join-Path $env:LOCALAPPDATA 'Temp\\emr-m03-acceptance-management.dpapi'),'synthetic-existing-ciphertext')",
    );
    try {
      assert.equal(result.status, 1);
      assert.equal(result.stderr, '');
      assert.equal(result.stdout.trim(), 'M03_DEV_ACCESS_BLOCKED');
      assert.equal(
        readFileSync(join(directory, 'Temp', 'emr-m03-acceptance-management.dpapi'), 'utf8'),
        'synthetic-existing-ciphertext',
      );
      assert.equal(
        existsSync(join(directory, 'Everyone-Market-Radar-Private/secrets/dev/runtime/management.dpapi')),
        false,
      );
    } finally {
      cleanupFixture(directory);
    }
  },
);
