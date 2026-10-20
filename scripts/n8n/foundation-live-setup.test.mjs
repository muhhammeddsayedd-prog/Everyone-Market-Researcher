import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createFoundationLiveSetup,
  createFoundationLiveSetupJournal,
  foundationLiveSetupScope,
  assertFoundationLiveDeployment,
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
function fixture({ fault, previousEvents = [], persist = () => {} } = {}) {
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
    createdAt: fault === 'old_deployment' ? epoch - 60000 : epoch,
    meta: { githubCommitSha: sha, githubCommitRef: scope.branch },
  };
  let clock = epoch,
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
  const journal = createFoundationLiveSetupJournal({
    sourceCommitSha: sha,
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
            isEnvVar: true,
          };
        if (spec.body.update) bypass[spec.body.update.secret].isEnvVar = spec.body.update.isEnvVar;
        if (spec.body.revoke) delete bypass[spec.body.revoke.secret];
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
  const setup = createFoundationLiveSetup(
    {
      sourceCommitSha: sha,
      transport,
      journal,
      managementBudget: budget,
      sensitive: secret,
      now: () => clock,
      deadlineAt: epoch + 3600000,
      pause: async (ms) => {
        clock += ms;
      },
      verifyDevReady: async () => {
        readyReads++;
        return { projectRef: scope.projectRef, migrationCount: 14, ready: true };
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
test('new protected Preview follows exact dev readiness and seven branch-sensitive entries without production or upsert', async () => {
  const f = fixture();
  const result = await f.setup.prepare();
  assert.equal(f.readyReads(), 1);
  assert.equal(assertFoundationLiveDeployment(result), result);
  assert.equal(result.audience, 'https://everyone-market-researcher-synthetic21.vercel.app');
  assert.equal(result.protectionVerified, true);
  assert.equal(result.protectionTransportVerified, false);
  assert.equal(result.sqlAudienceBindingVerified, false);
  assert.equal(f.envs.length, 7);
  for (const e of f.envs) {
    assert.equal(e.type, 'sensitive');
    assert.deepEqual(e.target, ['preview']);
    assert.equal(e.gitBranch, scope.branch);
  }
  const deploy = f.calls.find((c) => c.method === 'POST' && c.path.startsWith('/v13/deployments?'));
  assert.equal(Object.hasOwn(deploy.body, 'target'), false);
  assert.equal(deploy.body.gitSource.sha, sha);
  assert.equal(deploy.body.gitSource.ref, scope.branch);
  assert.equal(
    f.calls.some((c) => c.path.includes('upsert')),
    false,
  );
  assert.equal(f.bypass[secret.protectionBypass].isEnvVar, false);
  assert.equal(f.attempts(), f.calls.length);
  assert.throws(() => assertFoundationLiveDeployment({ ...result }));
  const publicText = JSON.stringify({ result, rows: f.rows });
  for (const value of Object.values(secret)) assert.equal(publicText.includes(value), false);
  const closed = await f.setup.cleanup();
  assert.equal(closed.state, 'setup_resources_removed');
  assert.equal(f.envs.length, 0);
  assert.deepEqual(f.bypass, {});
  assert.equal(closed.deploymentSnapshotsErased, false);
  assert.equal(f.attempts(), f.calls.length);
});
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
test('ambiguous create is never replayed; known resources can still clean up without raw errors', async () => {
  const f = fixture({ fault: 'lost_env_ack' });
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  const count = f.calls.length;
  await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
  assert.equal(f.calls.length, count);
  const closed = await f.setup.cleanup();
  assert.equal(closed.state, 'setup_cleanup_incomplete');
  assert.equal(f.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?')).length, 1);
  assert.equal(JSON.stringify(f.rows).includes(secret.writerPassword), false);
});
test('wrong source, old environment snapshot or unclosed response cannot produce a deployment proof', async () => {
  for (const fault of ['wrong_sha', 'old_deployment', 'unclosed']) {
    const f = fixture({ fault });
    await assert.rejects(f.setup.prepare(), /FOUNDATION_LIVE_SETUP_BLOCKED/);
    assert.equal(f.setup.snapshot().deploymentReady, false);
  }
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
  const f = fixture({ fault: 'lost_delete_ack' });
  await f.setup.prepare();
  const result = await f.setup.cleanup();
  assert.equal(result.state, 'setup_cleanup_incomplete');
  assert.equal(result.unresolved.length, 7);
  const count = f.calls.filter((c) => c.method === 'DELETE').length;
  await f.setup.cleanup();
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, count);
});
test('last bounded build poll still reserves all eighteen cleanup attempts within the same fifty-request subcap', async () => {
  const f = fixture({ fault: 'last_poll' });
  await f.setup.prepare();
  assert.equal(f.calls.length, 27);
  const result = await f.setup.cleanup();
  assert.equal(result.state, 'setup_resources_removed');
  assert.equal(f.calls.length, 45);
  assert.equal(f.attempts(), 45);
  assert.equal(f.setup.snapshot().maximumRequests, 50);
});
test('a new bounded child reconstructs only acknowledged resource cleanup and never pretends an old prepared batch is empty', async () => {
  const old = fixture();
  await old.setup.prepare();
  const resumed = fixture({ previousEvents: old.rows });
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
