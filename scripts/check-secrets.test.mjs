import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scanner = fileURLToPath(new URL('./check-secrets.mjs', import.meta.url));
const privateMarker = 'synthetic-scanner-marker-must-not-appear';
const uri = (password, host = 'db.fixture.test', scheme = 'postgresql') =>
  `${scheme}://fixture_user:${password}@${host}:5432/postgres`;

function fixture(run) {
  const allowedRoot = realpathSync(tmpdir());
  const directory = mkdtempSync(join(allowedRoot, 'emr-secret-scan-test-'));
  writeFileSync(join(directory, '.owner'), 'emr-secret-scan-test');
  writeFileSync(join(directory, '.git-config'), '');
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(directory, '.git-config'),
    GIT_TERMINAL_PROMPT: '0',
  });
  const git = (...args) => execFileSync('git', args, { cwd: directory, env, stdio: 'pipe', timeout: 10_000 });
  const write = (path, value, stage = true) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), value);
    if (stage) git('add', '--', path);
  };
  const scan = (privateValues = []) => {
    const result = spawnSync(process.execPath, [scanner], {
      cwd: directory,
      env,
      encoding: 'utf8',
      timeout: 15_000,
    });
    assert.ok(!result.error, 'scanner process must run');
    const output = `${result.stdout}${result.stderr}`;
    for (const value of [privateMarker, ...privateValues])
      assert.ok(!output.includes(value), 'matching values must never appear in scanner output');
    let report;
    try {
      report = JSON.parse(result.stdout);
    } catch {
      assert.fail('scanner must emit a metadata-only JSON report');
    }
    return { status: result.status, report };
  };
  try {
    git('init', '--quiet');
    return run({ write, scan });
  } finally {
    const owned = realpathSync(directory);
    assert.equal(dirname(owned), allowedRoot);
    assert.ok(owned.startsWith(`${allowedRoot}${sep}emr-secret-scan-test-`));
    assert.equal(readFileSync(join(owned, '.owner'), 'utf8'), 'emr-secret-scan-test');
    rmSync(owned, { recursive: true });
  }
}

test('finds classic, scoped and prefixed Supabase PATs without exposing their values', () =>
  fixture(({ write, scan }) => {
    const tokens = [
      `sbp_${'a'.repeat(40)}`,
      `sbp_fc${'b'.repeat(38)}`,
      `sbp_oauth_${'c'.repeat(40)}`,
      `sbp_v0_${'d'.repeat(40)}`,
    ];
    write('credentials.txt', tokens.join('\n'));
    const { status, report } = scan(tokens);
    assert.equal(status, 1);
    assert.deepEqual(
      report.violations,
      tokens.map((_, index) => ({ rule: 'supabase-pat', path: 'credentials.txt', line: index + 1 })),
    );
  }));

test('finds password-bearing Postgres URI forms including encoded and query credentials', () =>
  fixture(({ write, scan }) => {
    const values = [
      uri(privateMarker),
      uri(encodeURIComponent(`${privateMarker}@:/`), 'localhost', 'postgres'),
      uri(privateMarker, 'db.fixture.test', 'POSTGRESQL'),
      `postgresql://fixture_user@db.fixture.test/postgres?password=${privateMarker}`,
    ];
    write('connections.txt', values.join('\n'));
    const { status, report } = scan(values);
    assert.equal(status, 1);
    assert.deepEqual(
      report.violations,
      values.map((_, index) => ({ rule: 'postgres-password', path: 'connections.txt', line: index + 1 })),
    );
  }));

test('does not exempt arbitrary weak passwords on localhost or reserved hosts', () =>
  fixture(({ write, scan }) => {
    const values = [uri('password', 'localhost'), uri('changeme', 'db.fixture.test')];
    write('connections.txt', values.join('\n'));
    const { status, report } = scan(values);
    assert.equal(status, 1);
    assert.equal(report.violations.length, 2);
    assert.ok(report.violations.every(({ rule }) => rule === 'postgres-password'));
  }));

test('allows explicit placeholders and visibly named fixture credentials only on reserved hosts', () =>
  fixture(({ write, scan }) => {
    const placeholders = [
      '<pw>',
      '[YOUR-PASSWORD]',
      '${DATABASE_PASSWORD}',
      '<password>',
      '<YOUR-PASSWORD>',
      '<DB_PASSWORD>',
      '<urlencoded-password>',
      '<set-by-owner>',
    ];
    write(
      'examples.txt',
      [
        ...placeholders.map((password) => uri(password, 'aws-0-eu-central-1.pooler.supabase.com')),
        uri(encodeURIComponent('<password>')),
        uri('synthetic-pass'),
        uri('fixture-password', 'localhost'),
        'postgresql://fixture_user@db.fixture.test/postgres',
      ].join('\n'),
    );
    const { status, report } = scan();
    assert.equal(status, 0);
    assert.deepEqual(report.violations, []);
  }));

test('does not exempt production-shaped hosts or credential values in docs and tests', () =>
  fixture(({ write, scan }) => {
    const connection = uri('synthetic-pass', 'db.zmotjsbzhzjvpelxvxlf.supabase.co');
    const token = `sbp_${'e'.repeat(40)}`;
    write('docs/example.md', connection);
    write('tests/example.test.js', token);
    const { status, report } = scan([connection, token]);
    assert.equal(status, 1);
    assert.deepEqual(report.violations, [
      { rule: 'supabase-pat', path: 'tests/example.test.js', line: 1 },
      { rule: 'postgres-password', path: 'docs/example.md', line: 1 },
    ]);
  }));

test('malformed URI encoding and hosts fail closed without echoing the candidate', () =>
  fixture(({ write, scan }) => {
    const values = [uri(`${privateMarker}%broken`), uri(privateMarker, '%invalid-host')];
    write('broken.txt', values.join('\n'));
    const { status, report } = scan(values);
    assert.equal(status, 1);
    assert.equal(report.violations.length, 2);
  }));

test('does not exempt arbitrary angle-wrapped values on a production-shaped host', () =>
  fixture(({ write, scan }) => {
    const value = uri(`<${privateMarker}>`, 'db.zmotjsbzhzjvpelxvxlf.supabase.co');
    write('wrapped.txt', value);
    const { status, report } = scan([value]);
    assert.equal(status, 1);
    assert.deepEqual(report.violations, [{ rule: 'postgres-password', path: 'wrapped.txt', line: 1 }]);
  }));

test('raw delimiters in malformed URI userinfo cannot hide a password', () =>
  fixture(({ write, scan }) => {
    const values = ['/', '#', '?'].map((delimiter) => uri(`${privateMarker}${delimiter}part`));
    write('delimiters.txt', values.join('\n'));
    const { status, report } = scan(values);
    assert.equal(status, 1);
    assert.deepEqual(
      report.violations,
      values.map((_, index) => ({ rule: 'postgres-password', path: 'delimiters.txt', line: index + 1 })),
    );
  }));

test('scans staged content while excluding untracked files and unstaged changes', () =>
  fixture(({ write, scan }) => {
    const token = `sbp_${'f'.repeat(40)}`;
    write('clean.txt', 'safe indexed content');
    write('clean.txt', token, false);
    write('untracked.txt', token, false);
    assert.equal(scan([token]).status, 0);
    write('staged.txt', token);
    write('staged.txt', 'safe working tree', false);
    const { status, report } = scan([token]);
    assert.equal(status, 1);
    assert.deepEqual(report.violations, [{ rule: 'supabase-pat', path: 'staged.txt', line: 1 }]);
  }));

test('preserves existing credential detectors and tracked environment-file restrictions', () =>
  fixture(({ write, scan }) => {
    const existing = [
      ['github-token', `ghp_${'g'.repeat(36)}`],
      ['openai-key', `sk-proj-${'o'.repeat(40)}`],
      ['supabase-secret', `sb_secret_${'s'.repeat(30)}`],
      ['private-key', ['-----BEGIN ', 'PRIVATE KEY-----'].join('')],
    ];
    for (const [rule, value] of existing) write(`${rule}.txt`, value);
    write('.env', 'SYNTHETIC_ONLY=true');
    write('templates/.env.example', 'PLACEHOLDER_ONLY=true');
    write('apps/web/.env.example', 'PLACEHOLDER_ONLY=true');
    const { status, report } = scan(existing.map(([, value]) => value));
    assert.equal(status, 1);
    assert.equal(report.violations.length, 5);
    assert.deepEqual(
      new Set(report.violations.map(({ rule }) => rule)),
      new Set(['tracked-environment', ...existing.map(([rule]) => rule)]),
    );
  }));
