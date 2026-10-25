import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { foundationCheckAdmission, checkFoundationRace } from './check-m03-foundation-concurrency.mjs';
const config = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8');
test('ordinary or ambiguous invocations refuse before local database access', () => {
  for (const args of [[], ['--ci'], ['--local'], ['--gateway-only'], ['--local', '--gateway-only', '--ci']])
    assert.throws(() => foundationCheckAdmission(args, {}, config), /m03_foundation_local_admission/);
});
test('ordinary local scope is gateway-only and never changes C999', () => {
  assert.deepEqual(foundationCheckAdmission(['--local', '--gateway-only'], {}, config), {
    actor: false,
    gateway: true,
  });
});
test('full actor race requires both CI flags and a known local project/port', () => {
  const env = { CI: 'true', GITHUB_ACTIONS: 'true' };
  assert.deepEqual(foundationCheckAdmission(['--ci'], env, config), { actor: true, gateway: true });
  for (const patch of [{ CI: 'false' }, { GITHUB_ACTIONS: 'false' }])
    assert.throws(
      () => foundationCheckAdmission(['--ci'], { ...env, ...patch }, config),
      /m03_foundation_local_admission/,
    );
  for (const modified of [
    config.replace('port = 60322', 'port = 5432'),
    config.replace('everyone-market-radar', 'unrelated'),
  ])
    assert.throws(() => foundationCheckAdmission(['--ci'], env, modified), /m03_foundation_local_config/);
});
test('no remote Docker connection can be selected by environment', () => {
  for (const host of ['ssh://example.test', 'tcp://127.0.0.1:2375', 'https://example.test'])
    assert.throws(
      () => foundationCheckAdmission(['--local', '--gateway-only'], { DOCKER_HOST: host }, config),
      /m03_foundation_remote_docker/,
    );
});
test('actor race requires one fresh permit, one reconciliation receipt and actual overlap', () => {
  assert.doesNotThrow(() => checkFoundationRace([true, false], 1, true));
  assert.doesNotThrow(() => checkFoundationRace([false, true], 1, true));
  for (const [r, n, overlap] of [
    [[true, true], 2, true],
    [[false, false], 1, true],
    [[true, false], 1, false],
    [[true, false], 2, true],
    [[true], 1, true],
  ])
    assert.throws(() => checkFoundationRace(r, n, overlap), /m03_foundation_actor_race/);
});
