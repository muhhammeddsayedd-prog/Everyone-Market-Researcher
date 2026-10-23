import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';
import {
  createFoundationLiveSetup,
  createFoundationLiveSetupJournal,
  foundationLiveSetupScope,
  assertFoundationLiveDeployment,
  foundationLiveSetupRequestPlan,
} from './foundation-live-setup.mjs';

// Scripted Vercel API boundaries only: no actual deployment, key or network.
const scope = foundationLiveSetupScope;
const sha = 'f'.repeat(40),
  epoch = Date.parse('2026-10-21T08:00:00.000Z');
const secret = {
  writerPassword: 'SYNTHETIC_SETUP_WRITER_ONLY',
  machineToken: 'M'.repeat(43),
  apifyReadToken: 'SYNTHETIC_SEPARATE_APIFY_READER',
  protectionBypass: 'N'.repeat(32),
};
test('setup request plan carries all prior attempts and preserves eighteen cleanup requests before any write', () => {
  for (const [used, polls] of [
    [0, 12],
    [9, 9],
    [17, 1],
    [18, 0],
    [50, 0],
  ]) {
    const p = foundationLiveSetupRequestPlan(used);
    assert.equal(p.buildPollLimit, polls);
    assert.equal(p.cleanupReserve, 18);
    if (polls) assert.ok(used + p.maximumNewPrepareRequests + p.cleanupReserve <= 50);
  }
  for (const invalid of [-1, 51, 1.5, '9']) assert.throws(() => foundationLiveSetupRequestPlan(invalid));
  assert.equal(foundationLiveSetupRequestPlan(44).buildPollLimit, 0);
  const proposed = foundationLiveSetupRequestPlan(44, 88);
  assert.equal(proposed.buildPollLimit, 12);
  assert.equal(44 + proposed.maximumNewPrepareRequests + proposed.cleanupReserve, 88);
});

test('isolated approved cumulative88 fixture uses fresh window in exactly seven Preview entries and preserves44 spent requests', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, proposedBudgetApproved: true });
  try {
    const proof = f.claim(f.admit()),
      setupModule = await f.copy('foundation-live-setup.mjs');
    const current = fixture({
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents: readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse),
      activeWindowId: proof.windowId,
      maximumRequests: 88,
      expectedMigrationCount: 15,
    });
    assert.equal(current.setup.snapshot().requestCount, 44);
    await current.setup.prepare();
    const entries = current.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?'));
    assert.equal(entries.length, 7);
    assert.equal(
      entries.find((c) => c.body.key === 'EMR_M03_FOUNDATION_WINDOW_ID').body.value,
      proof.windowId,
    );
    assert.equal(
      entries.every((c) => c.body.comment.endsWith(proof.windowId)),
      true,
    );
    await current.setup.cleanup();
    assert.equal(current.setup.snapshot().requestCount, 44 + current.calls.length);
    assert.ok(current.setup.snapshot().requestCount <= 88);
    assert.deepEqual(current.bypass, {});
    assert.throws(() => fixture({ maximumRequests: 88 }));
  } finally {
    f.cleanup();
  }
});
test('sole/default journal receipts reject non-default relabeling and arbitrary default-state values', () => {
  const row = {
    event: 'setup_verified',
    kind: 'bypass',
    at: epoch,
    createdAt: epoch,
    soleOwnedDefaultVerified: true,
    nonDefaultVerified: false,
    observedDefaultFlag: 'omitted',
  };
  const build = (value) =>
    createFoundationLiveSetupJournal({ sourceCommitSha: sha, durableAppend() {}, previousEvents: [value] });
  assert.equal(build(row).rows[0].observedDefaultFlag, 'omitted');
  for (const value of [
    { ...row, soleOwnedDefaultVerified: false },
    { ...row, nonDefaultVerified: true },
    { ...row, observedDefaultFlag: 'false' },
    { ...row, observedDefaultFlag: 'SYNTHETIC_PRIVATE' },
    { ...row, createdAt: 'SYNTHETIC_PRIVATE' },
  ])
    assert.throws(() => build(value), /FOUNDATION_LIVE_SETUP_BLOCKED/);
});
test('trusted cleaned effectful resume carries nine requests, resets only the old revoke fence and revokes the new owned default once', async () => {
  const f = await syntheticProjectVerifiedContinuation({ effectful: true });
  try {
    const proof = f.claim(f.admit());
    const setupModule = await f.copy('foundation-live-setup.mjs');
    const previousEvents = readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const current = fixture({
      setupModule,
      sourceSha: proof.sourceCommitSha,
      startsAt: proof.startsAt,
      projectVerifiedContinuationProof: proof,
      previousEvents,
      fault: 'omitted_default',
    });
    assert.equal(current.setup.snapshot().requestCount, 9);
    await current.setup.prepare();
    assert.equal(current.setup.snapshot().buildPollLimit, 9);
    assert.equal(current.setup.snapshot().soleOwnedDefaultVerified, true);
    const close = await current.setup.cleanup();
    assert.equal(close.state, 'setup_resources_removed');
    assert.equal(current.calls.filter((c) => c.body?.generate).length, 1);
    assert.equal(current.calls.filter((c) => c.body?.revoke).length, 1);
    assert.equal(
      current.calls.some((c) => c.body?.update),
      false,
    );
    assert.equal(current.setup.snapshot().requestCount, 9 + current.calls.length);
    assert.ok(current.setup.snapshot().requestCount <= 50);
    assert.deepEqual(current.bypass, {});
  } finally {
    f.cleanup();
  }
});
function fixture({
  fault,
  previousEvents = [],
  persist = () => {},
  setupModule,
  sourceSha = sha,
  startsAt = epoch,
  projectVerifiedContinuationProof,
  activeWindowId = scope.windowId,
  maximumRequests = 50,
  expectedMigrationCount = 14,
} = {}) {
  const calls = [],
    rows = [],
    envs = [],
    bypass = {},
    project = {
      id: scope.projectId,
      name: 'everyone-market-researcher',
      accountId: scope.teamId,
      rootDirectory: 'apps/web',
      nodeVersion: '24.x',
      framework: 'nextjs',
      link: { type: 'github', org: scope.org, repo: scope.repo },
      ssoProtection: { deploymentType: 'all_except_custom_domains' },
      protectionBypass: bypass,
    };
  const deployment = {
    id: 'dpl_SyntheticFoundationLive21',
    projectId: scope.projectId,
    url: 'everyone-market-researcher-synthetic21.vercel.app',
    target: null,
    readyState: 'READY',
    createdAt: fault === 'old_deployment' ? startsAt - 60000 : startsAt,
    meta: { githubCommitSha: sourceSha, githubCommitRef: scope.branch },
  };
  let clock = startsAt,
    attempts = 0,
    readyReads = 0,
    polls = 0;
  const budget = {
    admit() {
      attempts++;
    },
    snapshot() {
      return { attempts };
    },
    attachTransport() {},
  };
  const journal = (setupModule?.createFoundationLiveSetupJournal ?? createFoundationLiveSetupJournal)({
    sourceCommitSha: sourceSha,
    maximumRequests,
    previousEvents,
    durableAppend(row) {
      persist(row);
      rows.push(row);
    },
  });
  const transport = {
    async request(spec) {
      calls.push(JSON.parse(JSON.stringify({ method: spec.method, path: spec.path, body: spec.body })));
      if (fault === 'lost_env_ack' && spec.method === 'POST' && spec.path.includes('/env?'))
        throw Error(secret.writerPassword);
      if (spec.method === 'GET' && spec.path.startsWith('/v9/projects/'))
        return { status: 200, data: structuredClone(project), closed: true };
      if (spec.path.includes('/protection-bypass?')) {
        if (spec.body.generate)
          bypass[spec.body.generate.secret] = {
            scope: 'automation-bypass',
            createdAt: clock,
            note: spec.body.generate.note,
            ...(fault === 'omitted_default'
              ? {}
              : {
                  isEnvVar:
                    fault === 'false_default'
                      ? false
                      : fault === 'invalid_default'
                        ? 'SYNTHETIC_PRIVATE_FLAG'
                        : true,
                }),
          };
        if (spec.body.update && spec.body.update.isEnvVar === false && Object.keys(bypass).length === 1)
          return { status: 400, data: { error: 'SOLE_DEFAULT_REQUIRED' }, closed: true };
        if (spec.body.revoke) delete bypass[spec.body.revoke.secret];
        if (spec.body.generate && fault === 'lost_bypass_ack') throw Error(secret.protectionBypass);
        if (spec.body.generate && fault === 'foreign_after_create')
          bypass.UNRELATED = {
            scope: 'automation-bypass',
            isEnvVar: true,
            createdAt: clock,
            note: 'Other owner',
          };
        return { status: 200, data: { protectionBypass: structuredClone(bypass) }, closed: true };
      }
      if (spec.method === 'GET' && spec.path.includes('/env?'))
        return { status: 200, data: { envs: structuredClone(envs) }, closed: true };
      if (spec.method === 'POST' && spec.path.includes('/env?')) {
        const item = {
          ...spec.body,
          id: 'env_native_' + (envs.length + 1),
          createdAt: clock,
          updatedAt: clock,
          decrypted: false,
        };
        envs.push(item);
        return { status: 200, data: { created: structuredClone(item), failed: [] }, closed: true };
      }
      if (spec.method === 'DELETE') {
        const id = spec.path.split('/env/')[1].split('?')[0];
        envs.splice(
          envs.findIndex((e) => e.id === id),
          1,
        );
        if (fault === 'lost_delete_ack') throw Error('synthetic unknown DELETE');
        return { status: 200, data: {}, closed: true };
      }
      if (spec.method === 'POST' && spec.path.startsWith('/v13/deployments?'))
        return { status: 200, data: structuredClone(deployment), closed: true };
      if (spec.method === 'GET' && spec.path.startsWith('/v13/deployments/')) {
        polls++;
        if (fault === 'wrong_sha')
          return {
            status: 200,
            data: { ...deployment, meta: { ...deployment.meta, githubCommitSha: 'a'.repeat(40) } },
            closed: true,
          };
        return {
          status: 200,
          data: {
            ...structuredClone(deployment),
            readyState: fault === 'last_poll' && polls < 12 ? 'BUILDING' : 'READY',
          },
          closed: fault !== 'unclosed',
        };
      }
      throw Error('unexpected scripted route');
    },
  };
  const setup = (setupModule?.createFoundationLiveSetup ?? createFoundationLiveSetup)(
    {
      sourceCommitSha: sourceSha,
      activeWindowId,
      transport,
      journal,
      managementBudget: budget,
      sensitive: secret,
      now: () => clock,
      deadlineAt: projectVerifiedContinuationProof?.deadlineAt ?? startsAt + 3600000,
      ...(projectVerifiedContinuationProof ? { projectVerifiedContinuationProof } : {}),
      pause: async (ms) => {
        clock += ms;
      },
      verifyDevReady: async () => {
        readyReads++;
        return { projectRef: scope.projectRef, migrationCount: expectedMigrationCount, ready: true };
      },
    },
    {
      transportValidator: (t) => assert.equal(t, transport),
      managementBudgetValidator: (b) => assert.equal(b, budget),
    },
  );
  return {
    setup,
    calls,
    rows,
    envs,
    bypass,
    project,
    journal,
    transport,
    budget,
    attempts: () => attempts,
    readyReads: () => readyReads,
  };
}
// Hypothetical acknowledged resource journal for independent cleanup tests.
// This is not a successful empty-baseline prepare or a hosted receipt.
function acknowledgedCleanupFixture(fault, priorAttempts = 0) {
  const keys = [
    'ENABLED',
    'WINDOW_ID',
    'WRITER_PASSWORD',
    'APIFY_READ_TOKEN',
    'TOKEN_SHA256',
    'AUDIENCE',
    'COMMIT_SHA',
  ];
  const envs = keys.map((key, i) => ({
    key: 'EMR_M03_FOUNDATION_' + key,
    id: 'env_historical_' + i,
    type: 'sensitive',
    target: ['preview'],
    gitBranch: scope.branch,
    comment: 'M03 foundation temporary dev ' + scope.windowId,
    createdAt: epoch,
    updatedAt: epoch,
  }));
  const previousEvents = [
    ...Array.from({ length: priorAttempts }, (_, i) => ({
      event: 'setup_attempt',
      ordinal: i + 1,
      kind: 'GET',
      at: epoch,
    })),
    { event: 'setup_ack', kind: 'bypass', at: epoch },
    ...envs.map((row) => ({ event: 'setup_ack', kind: 'environment', ...row })),
  ];
  const f = fixture({ fault, previousEvents });
  f.envs.push(...structuredClone(envs));
  f.bypass[secret.protectionBypass] = {
    scope: 'automation-bypass',
    createdAt: epoch,
    note: 'M03 foundation temporary dev ' + scope.windowId,
    isEnvVar: true,
  };
  return f;
}
for (const fault of [undefined, 'omitted_default'])
  test(
    'approved sole/default exception prepares one owned bypass without updating any default: ' +
      (fault ?? 'explicit_true'),
    async () => {
      const f = fixture({ fault });
      const proof = await f.setup.prepare();
      assert.equal(f.readyReads(), 1);
      assert.equal(f.setup.snapshot().soleOwnedDefaultVerified, true);
      assert.equal(f.setup.snapshot().nonDefaultVerified, false);
      assert.equal(f.setup.snapshot().deploymentReady, true);
      assert.equal(f.envs.length, 7);
      assert.equal(f.calls.filter((c) => c.body?.generate).length, 1);
      assert.equal(f.calls.filter((c) => c.body?.update).length, 0);
      assert.equal(assertFoundationLiveDeployment(proof), proof);
      const observed = f.rows.find((r) => r.event === 'setup_verified' && r.kind === 'bypass');
      assert.equal(observed.soleOwnedDefaultVerified, true);
      assert.equal(observed.nonDefaultVerified, false);
      assert.equal(observed.observedDefaultFlag, fault === 'omitted_default' ? 'omitted' : 'true');
      assert.equal(f.attempts(), f.calls.length);
      assert.throws(() => assertFoundationLiveDeployment({ version: 1 }));
      const publicText = JSON.stringify({ snapshot: f.setup.snapshot(), rows: f.rows });
      for (const value of Object.values(secret)) assert.equal(publicText.includes(value), false);
      const closed = await f.setup.cleanup();
      assert.equal(closed.state, 'setup_resources_removed');
      assert.equal(f.envs.length, 0);
      assert.deepEqual(f.bypass, {});
      assert.equal(closed.deploymentSnapshotsErased, false);
      assert.equal(f.attempts(), f.calls.length);
    },
  );
test('existing owned-key environment or another bypass blocks before every mutation', async () => {
  for (const kind of ['env', 'bypass']) {
    const f = fixture();
    if (kind === 'env')
      f.envs.push({
        key: 'EMR_M03_FOUNDATION_ENABLED',
        id: 'foreign',
        gitBranch: scope.branch,
        target: ['preview'],
      });
    else f.bypass.foreign = { scope: 'automation-bypass', isEnvVar: true };
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  }
});
test('sole/default exception never adopts another existing entry or an ambiguous missing bypass map', async () => {
  for (const flag of ['true', 'omitted', 'false', 'missing_map']) {
    const f = fixture();
    if (flag === 'missing_map') delete f.project.protectionBypass;
    else
      f.bypass.UNRELATED = {
        scope: 'automation-bypass',
        ...(flag === 'omitted' ? {} : { isEnvVar: flag === 'true' }),
      };
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
    assert.equal(
      f.rows.some((r) => r.event === 'setup_intent'),
      false,
    );
  }
});
test('explicit false or non-boolean generated default never produces a default receipt or environment/deployment mutation', async () => {
  for (const fault of ['false_default', 'invalid_default']) {
    const f = fixture({ fault });
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.calls.filter((c) => c.body?.generate).length, 1);
    assert.equal(f.calls.filter((c) => c.body?.update).length, 0);
    assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
    assert.equal(
      f.rows.some((r) => r.event === 'setup_verified' && r.kind === 'bypass'),
      false,
    );
    assert.equal(f.setup.snapshot().soleOwnedDefaultVerified, false);
  }
});
test('acknowledged owned false-default generation fails acceptance but revokes exactly once with verified empty readback', async () => {
  const f = fixture({ fault: 'false_default' });
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(
    f.rows.some((r) => r.event === 'setup_ack' && r.kind === 'bypass'),
    true,
  );
  assert.equal(
    f.rows.some((r) => r.event === 'setup_verified' && r.kind === 'bypass'),
    false,
  );
  assert.equal(f.setup.snapshot().soleOwnedDefaultVerified, false);
  assert.equal(f.setup.snapshot().nonDefaultVerified, false);
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
  const cleaned = await f.setup.cleanup();
  assert.equal(cleaned.state, 'setup_resources_removed');
  assert.equal(f.calls.filter((c) => c.body?.generate).length, 1);
  assert.equal(f.calls.filter((c) => c.body?.revoke).length, 1);
  assert.equal(
    f.calls.some((c) => c.body?.update),
    false,
  );
  assert.deepEqual(f.bypass, {});
  const after = f.calls.length;
  assert.equal((await f.setup.cleanup()).state, 'setup_resources_removed');
  assert.equal(f.calls.length, after);
});
test('lost generation ACK or an unexpected extra entry remains ambiguous without another create or blind revoke', async () => {
  for (const fault of ['lost_bypass_ack', 'foreign_after_create']) {
    const f = fixture({ fault });
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    const before = f.calls.length;
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.calls.length, before);
    const cleaned = await f.setup.cleanup();
    assert.equal(cleaned.state, 'setup_cleanup_incomplete');
    assert.deepEqual(cleaned.unresolved, ['bypass_create']);
    assert.equal(f.calls.filter((c) => c.body?.generate).length, 1);
    assert.equal(
      f.calls.some((c) => c.body?.update || c.body?.revoke),
      false,
    );
    assert.equal(f.setup.snapshot().soleOwnedDefaultVerified, false);
    assert.equal(JSON.stringify(f.rows).includes(secret.protectionBypass), false);
  }
});
test('ambiguous create is never replayed; known resources can still clean up without raw errors', async () => {
  const f = fixture({
    previousEvents: [
      { event: 'setup_intent', kind: 'environment', key: 'EMR_M03_FOUNDATION_ENABLED', at: epoch },
    ],
  });
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  const count = f.calls.length;
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(f.calls.length, count);
  const closed = await f.setup.cleanup();
  assert.equal(closed.state, 'setup_cleanup_incomplete');
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 0);
  assert.equal(JSON.stringify(f.rows).includes(secret.writerPassword), false);
});
test('project identity, runtime and protection drift cannot be mislabeled as the non-default prerequisite', async () => {
  for (const fault of ['repository', 'node', 'protection']) {
    const f = fixture();
    if (fault === 'repository') f.project.link.repo = 'ForeignProject';
    if (fault === 'node') f.project.nodeVersion = '20.x';
    if (fault === 'protection') f.project.ssoProtection.deploymentType = 'none';
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.setup.snapshot().deploymentReady, false);
    assert.equal(f.setup.snapshot().prerequisiteCode, null);
    assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  }
});
test('scripted documented provider semantics retain the first default when an update tries to unset the sole default', async () => {
  const f = fixture();
  const path = '/v1/projects/' + scope.projectId + '/protection-bypass?teamId=' + scope.teamId;
  const generated = await f.transport.request({
    method: 'PATCH',
    path,
    body: { generate: { secret: secret.protectionBypass, note: 'synthetic' } },
  });
  assert.equal(generated.status, 200);
  assert.equal(generated.data.protectionBypass[secret.protectionBypass].isEnvVar, true);
  const update = await f.transport.request({
    method: 'PATCH',
    path,
    body: { update: { secret: secret.protectionBypass, isEnvVar: false, note: 'synthetic' } },
  });
  assert.equal(update.status, 400);
  assert.equal(f.bypass[secret.protectionBypass].isEnvVar, true);
});
test('durable intent failure, parallel callers, replay journals and missing readiness prevent extra writes', async () => {
  const f = fixture({
    persist(row) {
      if (row.event === 'setup_intent') throw Error('synthetic disk error');
    },
  });
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, 0);
  const g = fixture();
  const first = g.setup.prepare();
  await assert.rejects(g.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  await first;
  const prior = fixture({ previousEvents: g.rows });
  await assert.rejects(prior.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(prior.calls.length, 0);
});
test('a lost DELETE acknowledgement plus absence remains ambiguous and is never retried', async () => {
  const f = acknowledgedCleanupFixture('lost_delete_ack');
  const result = await f.setup.cleanup();
  assert.equal(result.state, 'setup_cleanup_incomplete');
  assert.equal(result.unresolved.length, 7);
  const count = f.calls.filter((c) => c.method === 'DELETE').length;
  await f.setup.cleanup();
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, count);
});
test('historical acknowledged cleanup retains all eighteen reserved requests within the same fifty-request subcap', async () => {
  const f = acknowledgedCleanupFixture(undefined, 32);
  const result = await f.setup.cleanup();
  assert.equal(result.state, 'setup_resources_removed');
  assert.equal(f.calls.length, 18);
  assert.equal(f.attempts(), 18);
  assert.equal(f.setup.snapshot().requestCount, 50);
  assert.equal(f.setup.snapshot().maximumRequests, 50);
});
test('a new bounded child reconstructs only acknowledged resource cleanup and never pretends an old prepared batch is empty', async () => {
  const old = acknowledgedCleanupFixture();
  const resumed = fixture({ previousEvents: old.journal.rows });
  resumed.envs.push(...structuredClone(old.envs));
  Object.assign(resumed.bypass, structuredClone(old.bypass));
  const result = await resumed.setup.cleanup();
  assert.equal(result.state, 'setup_resources_removed');
  assert.equal(resumed.envs.length, 0);
  assert.deepEqual(resumed.bypass, {});
  assert.equal(resumed.calls.filter((c) => c.method === 'DELETE').length, 7);
  assert.equal(
    resumed.calls.some((c) => c.method === 'POST'),
    false,
  );
});
test('shutdown permanently closes setup admission even when no resource was created', async () => {
  const f = fixture();
  assert.equal((await f.setup.cleanup()).state, 'setup_resources_removed');
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(f.calls.length, 0);
});
