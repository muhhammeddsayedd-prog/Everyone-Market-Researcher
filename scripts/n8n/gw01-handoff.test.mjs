import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const source = readFileSync('scripts/n8n/windows/New-M03GW01Handoff.ps1', 'utf8');
const roots = [];
after(() => {
  for (const p of roots) rmSync(p, { recursive: true, force: true });
});
const canary = 'SYNTHETIC_GW01_PRIVATE_CANARY_FOR_LOCAL_TESTS';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-handoff-fixture-'));
  roots.push(root);
  mkdirSync(join(root, 'Temp'));
  mkdirSync(join(root, 'scripts/n8n/windows'), { recursive: true });
  writeFileSync(
    join(root, 'scripts/n8n/gw01-cloud-privacy.json'),
    JSON.stringify({
      version: 1,
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      instanceHost: 'muhhammedsayed.app.n8n.cloud',
      passed: true,
      credentialCanaryVerified: true,
      executionCanaryVerified: true,
      exportCanaryVerified: true,
      logCanaryVerified: true,
      ownedWorkflowId: 'SyntheticOwnedCanary',
    }),
  );
  const script = join(root, 'scripts/n8n/windows/New-M03GW01Handoff.ps1');
  writeFileSync(
    script,
    source.replace(
      /Read-Host '[^']+' -AsSecureString/g,
      `ConvertTo-SecureString '${canary}' -AsPlainText -Force`,
    ),
  );
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
  env.LOCALAPPDATA = root;
  return { root, script, env };
}
const names = {
  Writer: 'writer',
  Admin: 'admin',
  Machine: 'machine',
  ProtectionBypass: 'protection',
  Management: 'management',
};
for (const kind of Object.keys(names))
  test(`synthetic ${kind} handoff is encrypted and never printed`, () => {
    const f = fixture(),
      r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', f.script, '-Kind', kind], {
        env: f.env,
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true,
      });
    assert.equal(r.status, 0);
    assert.match(r.stdout, new RegExp('GW01_ENCRYPTED_HANDOFF_READY: ' + kind));
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
    const file = join(f.root, 'Temp', `emr-m03-gw01-dev-${names[kind]}.dpapi`);
    assert.ok(existsSync(file));
    assert.doesNotMatch(readFileSync(file, 'utf8'), new RegExp(canary));
  });
test('existing encrypted handoff is retained without replacement', () => {
  const f = fixture(),
    file = join(f.root, 'Temp', 'emr-m03-gw01-dev-writer.dpapi');
  writeFileSync(file, 'synthetic-existing-ciphertext');
  const r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', f.script, '-Kind', 'Writer'], {
    env: f.env,
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
  });
  assert.equal(r.status, 1);
  assert.equal(readFileSync(file, 'utf8'), 'synthetic-existing-ciphertext');
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(canary));
});
test('no administrator, machine or writer credential enters process arguments or environment declarations', () => {
  assert.doesNotMatch(
    source,
    /SetEnvironmentVariable|ProcessStartInfo|Start-Process|Write-(?:Output|Host).*\$(?:plain|ciphertext|secret|randomBytes)/i,
  );
  assert.match(source, /New-Object byte\[\] 32/);
  assert.match(source, /RandomNumberGenerator/);
  assert.match(source, /FileMode\]::CreateNew/);
  assert.doesNotMatch(source, /emr-m03-dev-migration-password|emr-m01-|emr-m02-/);
});
