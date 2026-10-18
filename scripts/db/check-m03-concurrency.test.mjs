import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  assertCiAdmission,
  assertDockerIdentity,
  assertCostRace,
  dockerChildEnvironment,
  fixedConnectionOptions,
} from './check-m03-concurrency.mjs';

const config = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8');
const admitted = { CI: 'true', GITHUB_ACTIONS: 'true' };
const localContext = [{ Endpoints: { docker: { Host: 'npipe:////./pipe/docker_engine' } } }];
const inspected = () => ({
  Id: 'synthetic-local-container',
  Config: { Labels: { 'com.supabase.cli.project': 'everyone-market-radar' } },
  State: { Running: true },
  NetworkSettings: { Ports: { '5432/tcp': [{ HostPort: '60322' }] } },
});

test('refuses ordinary execution before any local database or Docker access', () => {
  for (const env of [{}, { CI: 'true' }, { GITHUB_ACTIONS: 'true' }, { CI: 'false', GITHUB_ACTIONS: 'true' }])
    assert.throws(() => assertCiAdmission(env, config), /^Error: ci-admission$/);
  assert.doesNotThrow(() => assertCiAdmission(admitted, config));
});

test('refuses remote Docker destinations and changed project/port configuration', () => {
  for (const host of ['tcp://127.0.0.1:2375', 'ssh://example.test', 'https://example.test'])
    assert.throws(
      () => assertCiAdmission({ ...admitted, DOCKER_HOST: host }, config),
      /^Error: docker-host-local$/,
    );
  assert.throws(
    () =>
      assertCiAdmission(
        admitted,
        config.replace('project_id = "everyone-market-radar"', 'project_id = "another"'),
      ),
    /^Error: config-project$/,
  );
  assert.throws(
    () => assertCiAdmission(admitted, config.replace('port = 60322', 'port = 5432')),
    /^Error: config-port$/,
  );
  assert.throws(
    () => assertDockerIdentity([{ Endpoints: { docker: { Host: 'ssh://example.test' } } }], inspected()),
    /^Error: docker-context-local$/,
  );
});

test('requires running project container, port binding and stable immutable container id', () => {
  assert.equal(assertDockerIdentity(localContext, inspected()), 'synthetic-local-container');
  const changes = [
    { State: { Running: false } },
    { Config: { Labels: { 'com.supabase.cli.project': 'another' } } },
    { NetworkSettings: { Ports: { '5432/tcp': [{ HostPort: '5432' }] } } },
  ];
  for (const change of changes)
    assert.throws(
      () => assertDockerIdentity(localContext, { ...inspected(), ...change }),
      /^Error: container-identity$/,
    );
  assert.throws(
    () => assertDockerIdentity(localContext, inspected(), 'replaced-container'),
    /^Error: container-replaced$/,
  );
});

test('child Docker environment excludes unrelated provider and database credentials', () => {
  const env = dockerChildEnvironment({
    PATH: 'synthetic-path',
    SystemRoot: 'synthetic-system-root',
    PGPASSWORD: 'PRIVATE_SENTINEL',
    SUPABASE_ACCESS_TOKEN: 'PRIVATE_SENTINEL',
    DATABASE_URL: 'PRIVATE_SENTINEL',
    APIFY_TOKEN: 'PRIVATE_SENTINEL',
  });
  assert.equal(env.PATH, 'synthetic-path');
  assert.equal(env.SystemRoot, 'synthetic-system-root');
  assert.equal(JSON.stringify(env).includes('PRIVATE_SENTINEL'), false);
  const options = fixedConnectionOptions('synthetic-application');
  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, 60322);
  assert.equal(options.database, 'postgres');
  assert.equal(options.username, 'postgres');
  assert.equal(options.max, 1);
  assert.equal(options.prepare, false);
  assert.equal(options.ssl, false);
});

test('a cost race requires both receipts, an observed lock barrier and exactly one committed insertion', () => {
  assert.doesNotThrow(() => assertCostRace([1, 0], 1, 1, true));
  assert.doesNotThrow(() => assertCostRace([0, 2], 2, 2, true));
  for (const args of [
    [[1], 1, 1, true],
    [[1, 1], 1, 1, true],
    [[1, 0], 1, 2, true],
    [[1, 0], 1, 1, false],
    [[0, 0], 1, 0, true],
  ])
    assert.throws(() => assertCostRace(...args), /^Error: cost-race-result$/);
});

test('actual credential-free CLI refusal has native failure, no skip and no raw environment values', () => {
  const script = fileURLToPath(new URL('./check-m03-concurrency.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [script], {
    env: { ...dockerChildEnvironment(process.env), PGPASSWORD: 'PRIVATE_SENTINEL' },
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  });
  assert.equal(child.status, 1);
  assert.equal(child.stderr, '');
  assert.equal(`${child.stdout}${child.stderr}`.includes('PRIVATE_SENTINEL'), false);
  const result = JSON.parse(child.stdout);
  assert.equal(result.passed, false);
  assert.equal(result.failure, 'ci-admission');
  assert.equal(result.checksCompleted, 0);
  assert.equal(result.skipped, false);
});
