import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertFixtureAdmission,
  assertPristineGateway,
  assertRace,
  fixedGatewayConnectionOptions,
  gatewayWorkerEnvironment,
  createAuditArgsFactory,
  finalizeGatewayResources,
} from './check-gw01-concurrency.mjs';

const config = 'project_id = "everyone-market-radar"\n[db]\nport = 60322\nmajor_version = 17\n';
const pristine = {
  window_id: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
  namespace: 'gw01-dev',
  project_ref: 'zmotjsbzhzjvpelxvxlf',
  environment: 'dev',
  bound_audience: null,
  bound_commit_sha: null,
  bound_deployment_id: null,
  starts_at: null,
  expires_at: null,
  closed_at: null,
  admitted_count: 0,
  close_count: 0,
  minute_start: null,
  minute_count: 0,
  day_start: null,
  day_count: 0,
  requests: 0,
  holders: 0,
};
test('requires exact explicit local fixture admission and fixed config', () => {
  assert.doesNotThrow(() => assertFixtureAdmission(['--local'], config));
  for (const args of [[], ['--linked'], ['--local', '--project-ref', 'other']]) {
    assert.throws(() => assertFixtureAdmission(args, config), /^Error: gw01_local_admission$/);
  }
  for (const bad of [config.replace('60322', '5432'), config.replace('everyone-market-radar', 'other')]) {
    assert.throws(() => assertFixtureAdmission(['--local'], bad));
  }
});
test('connection cannot be redirected by caller environment or URL', () => {
  const options = fixedGatewayConnectionOptions('gw01-local-test');
  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, 60322);
  assert.equal(options.database, 'postgres');
  assert.equal(options.username, 'supabase_admin');
  assert.equal(options.ssl, false);
  assert.equal(options.max, 1);
  assert.equal(options.prepare, false);
});
test('worker environment forwards no database/provider/production secrets', () => {
  const actual = gatewayWorkerEnvironment({
    SystemRoot: 'C:\\Windows',
    PATH: 'safe-path',
    PGPASSWORD: 'synthetic-secret-canary',
    SUPABASE_ACCESS_TOKEN: 'synthetic-secret-canary',
    EMR_WORKER_DB_PASSWORD: 'synthetic-secret-canary',
    YOUTUBE_API_KEY: 'synthetic-secret-canary',
    NODE_OPTIONS: '--require unreviewed',
  });
  assert.equal(actual.SystemRoot, 'C:\\Windows');
  assert.equal(actual.PGPASSWORD, undefined);
  assert.equal(actual.SUPABASE_ACCESS_TOKEN, undefined);
  assert.equal(actual.NODE_OPTIONS, undefined);
  assert.equal(JSON.stringify(actual).includes('synthetic-secret-canary'), false);
});
test('never resets an opened, closed or nonempty durable trial journal', () => {
  assert.doesNotThrow(() => assertPristineGateway(pristine));
  for (const changed of [
    { starts_at: '2026-10-18T00:00:00Z' },
    { expires_at: '2026-10-18T00:30:00Z' },
    { closed_at: '2026-10-18T00:01:00Z' },
    { admitted_count: 1 },
    { requests: 1 },
    { holders: 1 },
    { namespace: 'prod' },
    { environment: 'prod' },
    { project_ref: 'hkiafqrcxaafdbcvjlzv' },
    { bound_audience: 'https://already-bound.vercel.app' },
    { bound_commit_sha: '0000000000000000000000000000000000000000' },
    { bound_deployment_id: 'dpl_AlreadyBound' },
    { close_count: 1 },
    { minute_start: '2026-10-18T00:00:00Z' },
    { minute_count: 1 },
    { day_start: '2026-10-18' },
    { day_count: 1 },
    { window_id: '76c2ad42-c094-4ba4-9a0b-566e19b97781' },
  ]) {
    assert.throws(
      () => assertPristineGateway({ ...pristine, ...changed }),
      /^Error: gw01_fixture_not_pristine$/,
    );
  }
});
test('two-reservation proof requires exact observed winners and persisted count', () => {
  assert.doesNotThrow(() =>
    assertRace(['admitted', 'limited', 'admitted', 'limited'], { admitted: 2, limited: 2 }, 4, 4),
  );
  assert.throws(() =>
    assertRace(['admitted', 'admitted', 'admitted', 'limited'], { admitted: 2, limited: 2 }, 4, 4),
  );
  assert.throws(() =>
    assertRace(['admitted', 'limited', 'admitted', 'limited'], { admitted: 2, limited: 2 }, 3, 4),
  );
});
test('retained audit evidence uses fresh per-run IDs and stable within-run replay', () => {
  const first = createAuditArgsFactory();
  const second = createAuditArgsFactory();
  assert.deepEqual(first(30), first(30));
  assert.notEqual(first(30).executionId, second(30).executionId);
  assert.notEqual(first(30).executionId, first(31).executionId);
  assert.equal(first(30).workflow, 'M03-GATEWAY-ACCEPTANCE-DEV');
});
test('fixture cleanup failure still closes both database clients', async () => {
  const calls = [];
  await assert.rejects(
    finalizeGatewayResources(
      async () => {
        throw new Error('synthetic cleanup failure');
      },
      [0, 1].map((n) => ({
        end: async (options) => {
          calls.push(n);
          assert.equal(options.timeout, 2);
        },
      })),
    ),
    /synthetic cleanup failure/,
  );
  assert.deepEqual(calls, [0, 1]);
});
test('one failed client close never skips the other or exposes a native error', async () => {
  const calls = [];
  await assert.rejects(
    finalizeGatewayResources(async () => {}, [
      {
        end() {
          calls.push(0);
          throw new Error('synthetic private native error');
        },
      },
      {
        async end() {
          calls.push(1);
        },
      },
    ]),
    /^Error: gw01_client_close_failed$/,
  );
  assert.deepEqual(calls, [0, 1]);
});
