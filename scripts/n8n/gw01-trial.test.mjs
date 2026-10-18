import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createTrialCoordinator, GW01_WINDOW_ID } from './gw01-trial.mjs';

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
const fixture = () => {
  const path = mkdtempSync(join(tmpdir(), 'emr-gw01-public-trial-test-'));
  roots.push(path);
  let now = 1792300000000;
  const config = {
    windowId: GW01_WINDOW_ID,
    audiences: ['https://everyone-market-researcher-synthetic.vercel.app'],
  };
  return {
    path,
    config,
    clock: () => now,
    tick: (n) => {
      now += n;
    },
    coordinator: () => createTrialCoordinator(path, config, () => now),
  };
};
const request = (kind = 'ordinary') => ({
  requestId: crypto.randomUUID(),
  operation: 'identity.read',
  audience: 'https://everyone-market-researcher-synthetic.vercel.app',
  kind,
});
test('preparation persists no clock and cannot silently create a replacement window', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  assert.equal(c.snapshot().startedAt, null);
  assert.throws(() => c.prepare(), /GW01_ALREADY_PREPARED/);
  assert.equal(f.coordinator().snapshot().attempts, 0);
});
test('every failed/denial/old-preview attempt is reserved durably before network, across coordinator instances', async () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  let calls = 0;
  await assert.rejects(
    c.attempt(request('denial'), async () => {
      calls++;
      assert.equal(f.coordinator().snapshot().attempts, 1);
      throw Error('SYNTHETIC_PRIVATE_CANARY');
    }),
    /^Error: GW01_TRANSPORT_UNKNOWN$/,
  );
  assert.equal(calls, 1);
  assert.equal(c.snapshot().inFlight, 0);
  assert.doesNotMatch(readFileSync(join(f.path, 'gw01-trial.jsonl'), 'utf8'), /SYNTHETIC_PRIVATE_CANARY/);
});
test('two active attempts are a global persisted limit, not a per-process counter', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  const a = c.reserve(request()),
    b = f.coordinator().reserve(request());
  assert.throws(() => c.reserve(request()), /GW01_PARALLEL_LIMIT/);
  c.finish(a.attemptId, { outcome: 'http', httpStatus: 200 });
  const d = c.reserve(request());
  c.finish(d.attemptId, { outcome: 'unknown', httpStatus: null });
  c.finish(b.attemptId, { outcome: 'http', httpStatus: 401 });
  assert.equal(c.snapshot().attempts, 3);
});
test('ordinary calls stop at85, retaining15 attempts for status/closure verification and never resetting on reload', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  for (let i = 0; i < 85; i++) {
    const a = c.reserve(request());
    c.finish(a.attemptId, { outcome: 'http', httpStatus: 200 });
  }
  assert.throws(() => c.reserve(request()), /GW01_CLOSURE_RESERVE/);
  c.close();
  for (let i = 0; i < 15; i++) {
    const a = f.coordinator().reserve(request('shutdown'));
    c.finish(a.attemptId, { outcome: 'http', httpStatus: 403 });
  }
  assert.equal(c.snapshot().attempts, 100);
  assert.throws(() => c.reserve(request('shutdown')), /GW01_ATTEMPT_LIMIT/);
  assert.throws(() => f.coordinator().start(), /GW01_ALREADY_STARTED/);
});
test('authoritative database window binds once and cannot extend or replace the30minute clock', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  const startedAt = new Date(f.clock()).toISOString(),
    expiresAt = new Date(f.clock() + 1800000).toISOString();
  c.bindDatabaseWindow({ windowId: GW01_WINDOW_ID, startedAt, expiresAt });
  f.tick(1000);
  assert.equal(f.coordinator().snapshot().expiresAt, expiresAt);
  assert.throws(
    () =>
      c.bindDatabaseWindow({
        windowId: GW01_WINDOW_ID,
        startedAt: new Date(f.clock()).toISOString(),
        expiresAt: new Date(f.clock() + 1800000).toISOString(),
      }),
    /GW01_WINDOW_ALREADY_BOUND/,
  );
  f.tick(1799000);
  assert.throws(() => c.reserve(request('shutdown')), /GW01_EXPIRED/);
});
test('closure rejects new business calls but records rejection checks against every pinned older preview', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  c.close();
  assert.throws(() => c.reserve(request()), /GW01_CLOSED/);
  const a = c.reserve(request('shutdown'));
  c.finish(a.attemptId, { outcome: 'http', httpStatus: 403 });
  assert.equal(c.snapshot().verifiedRejectedAudiences.length, 1);
  assert.throws(
    () => c.reserve({ ...request('shutdown'), audience: 'https://unapproved.vercel.app' }),
    /GW01_INPUT_REJECTED/,
  );
});
test('an interrupted attempt retains its lease and count until explicitly reconciled, never automatically retried', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  c.reserve(request());
  f.tick(60000);
  assert.equal(f.coordinator().snapshot().inFlight, 1);
  assert.equal(f.coordinator().snapshot().attempts, 1);
  c.close();
  assert.equal(c.snapshot().inFlight, 1);
});
test('truncated/corrupted persistent journals fail closed without overwriting original bytes', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  const path = join(f.path, 'gw01-trial.jsonl');
  writeFileSync(path, '{"partial":');
  assert.throws(() => c.snapshot(), /GW01_STATE_REJECTED/);
  assert.equal(readFileSync(path, 'utf8'), '{"partial":');
});
test('privacy projection rejects unknown keys/status values rather than retaining response bodies or credentials', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  assert.throws(
    () => c.reserve({ ...request(), authorization: 'SYNTHETIC_PRIVATE_CANARY' }),
    /GW01_INPUT_REJECTED/,
  );
  const a = c.reserve(request());
  assert.throws(
    () => c.finish(a.attemptId, { outcome: 'http', httpStatus: 200, body: 'SYNTHETIC_PRIVATE_CANARY' }),
    /GW01_INPUT_REJECTED/,
  );
  assert.doesNotMatch(readFileSync(join(f.path, 'gw01-trial.jsonl'), 'utf8'), /SYNTHETIC_PRIVATE_CANARY/);
});
test('prepared rejection probes consume the same budget without opening or resetting the clock', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  const a = c.reserve(request('preflight'));
  assert.equal(c.snapshot().startedAt, null);
  assert.throws(() => c.start(), /GW01_IN_FLIGHT/);
  c.finish(a.attemptId, { outcome: 'http', httpStatus: 403 });
  assert.throws(() => c.reserve(request()), /GW01_NOT_STARTED/);
  c.start();
  assert.equal(c.snapshot().attempts, 1);
});
test('binding a later authoritative start can never extend the original absolute local deadline', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  const original = c.snapshot().expiresAt;
  f.tick(5000);
  c.bindDatabaseWindow({
    windowId: GW01_WINDOW_ID,
    startedAt: new Date(f.clock()).toISOString(),
    expiresAt: new Date(f.clock() + 1800000).toISOString(),
  });
  assert.equal(c.snapshot().expiresAt, original);
  assert.equal(c.snapshot().databaseExpiresAt, new Date(f.clock() + 1800000).toISOString());
});
test('generic503 outage is not verified closed-route rejection', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  c.close();
  const a = c.reserve(request('shutdown'));
  c.finish(a.attemptId, { outcome: 'http', httpStatus: 503 });
  assert.deepEqual(c.snapshot().verifiedRejectedAudiences, []);
});
test('new reviewed deployments append targets without replenishing attempts or changing window identity', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  const a = c.reserve(request('preflight'));
  c.finish(a.attemptId, { outcome: 'http', httpStatus: 403 });
  const target = {
    audience: 'https://everyone-market-researcher-synthetic-second.vercel.app',
    commitSha: 'a'.repeat(40),
    deploymentId: 'dpl_SyntheticOwnedDeployment123',
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    branch: 'm03-n8n-foundation',
  };
  c.registerDeployment(target);
  assert.equal(f.coordinator().snapshot().attempts, 1);
  assert.equal(c.snapshot().unverifiedAudiences.length, 2);
  c.start();
  assert.throws(
    () =>
      c.registerDeployment({ ...target, audience: 'https://everyone-market-researcher-third.vercel.app' }),
    /GW01_TARGET_PHASE_REJECTED/,
  );
  c.close();
  c.registerDeployment({
    ...target,
    audience: 'https://everyone-market-researcher-third.vercel.app',
    deploymentId: 'dpl_SyntheticClosingDeployment123',
  });
  assert.equal(c.snapshot().unverifiedAudiences.length, 3);
});

test('read-only deployment guard binds later targets exactly without changing initial config or journal', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  const initial = {
    audience: f.config.audiences[0],
    commitSha: 'a'.repeat(40),
    deploymentId: 'dpl_SyntheticInitialDeployment123',
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    branch: 'm03-n8n-foundation',
  };
  const target = {
    ...initial,
    audience: 'https://everyone-market-researcher-second.vercel.app',
    deploymentId: 'dpl_SyntheticSecondDeployment123',
  };
  c.registerDeployment(target);
  const path = join(f.path, 'gw01-trial.jsonl'),
    before = readFileSync(path);
  assert.equal(c.assertDeployment(initial, initial), true);
  assert.equal(f.coordinator().assertDeployment(target, initial), true);
  for (const altered of [
    { ...target, commitSha: 'b'.repeat(40) },
    { ...target, deploymentId: 'dpl_UnregisteredDeployment123' },
    { ...target, audience: 'https://everyone-market-researcher-unregistered.vercel.app' },
    { ...initial, commitSha: 'b'.repeat(40) },
  ])
    assert.throws(() => c.assertDeployment(altered, initial), /GW01_DEPLOYMENT_REJECTED/);
  assert.deepEqual(readFileSync(path), before);
  assert.equal(c.snapshot().attempts, 0);
  assert.equal(c.snapshot().startedAt, null);
  assert.deepEqual(f.config.audiences, [initial.audience]);
});
test('separate plainNode subprocess observes the same two persisted leases and budget', () => {
  const f = fixture(),
    c = f.coordinator();
  c.prepare();
  c.start();
  const a = c.reserve(request());
  c.reserve(request());
  const script = `import{createTrialCoordinator}from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'scripts/n8n/gw01-trial.mjs')).href)};let text='';for await(const chunk of process.stdin)text+=chunk;const x=JSON.parse(text),c=createTrialCoordinator(x.path,x.config,()=>x.now);try{c.reserve(x.request);process.stdout.write('reserved');}catch(error){process.stdout.write(error.message==='GW01_PARALLEL_LIMIT'?'parallel_denied':'unexpected');}`;
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
  function child() {
    return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      input: JSON.stringify({ path: f.path, config: f.config, now: f.clock(), request: request() }),
      env,
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    });
  }
  const blocked = child();
  assert.equal(blocked.status, 0);
  assert.equal(blocked.stdout, 'parallel_denied');
  assert.equal(c.snapshot().attempts, 2);
  c.finish(a.attemptId, { outcome: 'http', httpStatus: 200 });
  const permitted = child();
  assert.equal(permitted.status, 0);
  assert.equal(permitted.stdout, 'reserved');
  assert.equal(c.snapshot().attempts, 3);
  assert.equal(c.snapshot().inFlight, 2);
});
