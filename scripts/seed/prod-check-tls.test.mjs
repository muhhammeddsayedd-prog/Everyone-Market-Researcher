import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateProdCa } from './prod-check-tls.mjs';
const bytes = readFileSync(new URL('./certs/supabase-root-2021.crt', import.meta.url));
const metadata = JSON.parse(readFileSync(new URL('./prod-ca.json', import.meta.url), 'utf8'));
test('production target-labelled public CA verifies without a network call', () => {
  assert.match(validateProdCa(bytes, metadata), /^-----BEGIN CERTIFICATE-----/);
});
test('rejects dev label, unknown fields, pin and bytes drift', () => {
  for (const bad of [
    { ...metadata, projectRef: 'zmotjsbzhzjvpelxvxlf' },
    { ...metadata, extra: true },
    { ...metadata, sha256: 'a'.repeat(64) },
  ])
    assert.throws(() => validateProdCa(bytes, bad), /PUBLIC_CA_REJECTED/);
  assert.throws(() => validateProdCa(Buffer.from('not a certificate'), metadata));
});
test('private environment is blocked before CA/network work with no raw private output', () => {
  const sentinel = 'synthetic-private-value';
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
      process.env[key] ? [[key, process.env[key]]] : [],
    ),
  );
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./prod-check-tls.mjs', import.meta.url))],
    { env: { ...env, PGPASSWORD: sentinel }, encoding: 'utf8', timeout: 5000, windowsHide: true },
  );
  assert.equal(result.status, 2);
  assert.equal(result.stdout.includes(sentinel), false);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).authenticationAttempted, false);
});
