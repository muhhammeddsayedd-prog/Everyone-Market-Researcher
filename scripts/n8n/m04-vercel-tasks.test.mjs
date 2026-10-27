import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { runVercelTask } from './m04-vercel-tasks.mjs';

const repo = resolve('.'),
  project = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  team = 'team_gboXPxTevpCOZuaA8eY9PmR1';
const publicProvider = JSON.parse(
  readFileSync(
    join(repo, 'milestones/M04-collectors-vimeo-instagram/evidence/live-provider-preflight-20261027.json'),
    'utf8',
  ),
).provider;
const secrets = {
  writer: 'local-synthetic-writer',
  apifyRead: 'local-synthetic-read',
  machine: 'm'.repeat(43),
};
const originalMachine = JSON.parse(
  readFileSync(join(repo, 'scripts/n8n/foundation-delivery-packet.json'), 'utf8'),
);
function fixture() {
  const local = mkdtempSync(join(tmpdir(), 'emr-m04-vercel-local-'));
  const meta = join(local, 'Everyone-Market-Radar-Private/foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9');
  mkdirSync(meta, { recursive: true });
  writeFileSync(
    join(meta, 'pending-runtime.json'),
    JSON.stringify({
      version: originalMachine.version,
      windowId: originalMachine.windowId,
      credentialId: 'EmrM03Machine19',
      purpose: 'pending_inactive_m03_runtime_delivery',
      audience: originalMachine.audience,
      sourceCommitSha: originalMachine.sourceCommitSha,
      createdAt: '2026-10-19T00:25:21.669Z',
    }),
  );
  const state = {
    provider: structuredClone(publicProvider),
    native: { machine: { baseline: { updatedAt: '2026-10-25T21:06:39.771Z' } } },
  };
  const projectDto = {
    id: project,
    accountId: team,
    rootDirectory: 'apps/web',
    nodeVersion: '24.x',
    framework: 'nextjs',
    link: { type: 'github', org: 'muhhammeddsayedd-prog', repo: 'Everyone-Market-Researcher' },
    ssoProtection: { deploymentType: 'all_except_custom_domains' },
    protectionBypass: {},
  };
  const rows = [],
    calls = [];
  let deployment;
  const send = async (method, path, value) => {
    calls.push({ method, path, value: structuredClone(value) });
    if (path.startsWith('/v9/projects/') && path.includes('/env/') && method === 'DELETE') {
      const id = path.split('/env/')[1].split('?')[0];
      rows.splice(
        rows.findIndex((r) => r.id === id),
        1,
      );
      return { status: 200, data: {}, closed: true };
    }
    if (path.startsWith('/v9/projects/'))
      return { status: 200, data: structuredClone(projectDto), closed: true };
    if (path.includes('/protection-bypass?')) {
      if (value.generate)
        projectDto.protectionBypass[value.generate.secret] = {
          note: value.generate.note,
          scope: 'automation-bypass',
          createdAt: Date.now(),
          isEnvVar: true,
        };
      else {
        assert.equal(value.revoke.regenerate, false);
        delete projectDto.protectionBypass[value.revoke.secret];
      }
      return {
        status: 200,
        data: { protectionBypass: structuredClone(projectDto.protectionBypass) },
        closed: true,
      };
    }
    if (path.includes('/env?')) {
      if (method === 'GET') return { status: 200, data: { envs: structuredClone(rows) }, closed: true };
      const { key, type, target, gitBranch, comment } = value;
      const created = {
        id: 'owned_env_' + (rows.length + 1),
        key,
        type,
        target,
        gitBranch,
        comment,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      rows.push(created);
      return { status: 201, data: { failed: [], created: structuredClone(created) }, closed: true };
    }
    if (path.startsWith('/v13/deployments?')) {
      assert.equal(value.target, undefined);
      assert.equal(value.gitSource.ref, 'm04-collectors-vimeo-instagram');
      assert.equal(value.gitSource.sha, state.sourceHead);
      deployment = {
        id: 'dpl_M04Synthetic',
        url: 'everyone-market-researcher-synthetic.vercel.app',
        target: null,
        projectId: project,
        createdAt: Date.now(),
        meta: { githubCommitSha: state.sourceHead, githubCommitRef: 'm04-collectors-vimeo-instagram' },
        readyState: 'BUILDING',
      };
      return { status: 200, data: structuredClone(deployment), closed: true };
    }
    if (path.startsWith('/v13/deployments/'))
      return { status: 200, data: { ...structuredClone(deployment), readyState: 'READY' }, closed: true };
    assert.fail('unexpected native request');
  };
  const run = async (phase, transport = send) => {
    const prior = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = local;
    try {
      return await runVercelTask({ phase, state, secrets, repo, send: transport });
    } finally {
      if (prior === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = prior;
    }
  };
  return {
    state,
    calls,
    rows,
    projectDto,
    send,
    run,
    metadataPath: join(meta, 'pending-runtime.json'),
    close: () => {
      assert.ok(resolve(local).startsWith(resolve(tmpdir()) + sep));
      assert.ok(basename(local).startsWith('emr-m04-vercel-local-'));
      rmSync(local, { recursive: true, force: true });
    },
  };
}
test('local preparation uses accepted snapshots, one persistent bypass and the exact M04 policy without any network call', async () => {
  const f = fixture();
  try {
    assert.equal((await f.run('prepare')).public.status, 'completed');
    const bypass = f.state.protectionBypass;
    assert.match(bypass, /^[A-Za-z0-9]{32}$/);
    assert.equal((await f.run('prepare')).public.status, 'completed');
    assert.equal(f.state.protectionBypass, bypass);
    assert.equal(f.calls.length, 0);
    assert.equal(f.state.selection.vimeo.length, 2);
    assert.equal(f.state.selection.instagram.length, 2);
    assert.equal(f.state.livePolicy.max_actor_starts, 4);
    assert.equal(f.state.livePolicy.max_total_usd, 4);
    assert.deepEqual(Object.keys(f.state.livePolicy.actors), ['apify/instagram-scraper']);
    assert.deepEqual(f.state.livePolicy.actors['apify/instagram-scraper'].inputDefaults, {
      searchType: 'hashtag',
      addParentData: false,
    });
  } finally {
    f.close();
  }
});
test('configure saves seven Preview-only sensitive entries and one exact-HEAD deployment; poll and cleanup preserve protection', async () => {
  const f = fixture();
  try {
    for (const phase of ['prepare', 'configure', 'poll', 'cleanup']) {
      const r = await f.run(phase);
      assert.equal(r.public.status, 'completed', JSON.stringify(r.public));
      for (const secret of [...Object.values(secrets), f.state.protectionBypass])
        assert.ok(!JSON.stringify(r.public).includes(secret));
    }
    const creates = f.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?'));
    assert.equal(creates.length, 7);
    assert.equal(new Set(creates.map((c) => c.value.key)).size, 7);
    for (const c of creates) {
      assert.deepEqual(c.value.target, ['preview']);
      assert.equal(c.value.gitBranch, 'm04-collectors-vimeo-instagram');
      assert.equal(c.value.type, 'sensitive');
    }
    assert.equal(f.rows.length, 0);
    assert.deepEqual(f.projectDto.protectionBypass, {});
    assert.equal(f.state.vercelSetup.cleanupComplete, true);
    assert.equal(f.state.deployment.readyState, 'READY');
    assert.equal(f.projectDto.ssoProtection.deploymentType, 'all_except_custom_domains');
    assert.equal(f.calls.filter((c) => c.path.startsWith('/v13/deployments/')).length, 1);
  } finally {
    f.close();
  }
});
test('an existing bypass or changed selected Machine baseline blocks without any mutation', async () => {
  const f = fixture();
  try {
    f.state.native.machine.baseline.updatedAt = '2026-10-27T00:00:00.000Z';
    assert.equal((await f.run('prepare')).public.code, 'M04_VERCEL_MACHINE_BASELINE');
    assert.equal(f.calls.length, 0);
    f.state.native.machine.baseline.updatedAt = '2026-10-25T21:06:39.771Z';
    await f.run('prepare');
    f.projectDto.protectionBypass.unrelated = { scope: 'automation-bypass' };
    assert.equal((await f.run('configure')).public.code, 'M04_VERCEL_OWNERSHIP_CONFLICT');
    assert.ok(f.calls.every((c) => c.method === 'GET'));
  } finally {
    f.close();
  }
});
test('a lost env-create acknowledgement is not retried and known resources still clean up without adopting the unknown row', async () => {
  const f = fixture();
  try {
    await f.run('prepare');
    const r = await f.run('configure', async (method, path, value) => {
      const result = await f.send(method, path, value);
      if (method === 'POST' && path.includes('/env?')) throw Error('untrusted private native diagnostic');
      return result;
    });
    assert.equal(r.public.status, 'blocked');
    assert.equal(f.state.vercelSetup.pending.action, 'environment.create');
    const count = f.calls.length;
    assert.equal((await f.run('configure')).public.status, 'blocked');
    assert.equal(f.calls.length, count);
    const cleanup = await f.run('cleanup');
    assert.equal(cleanup.public.code, 'M04_VERCEL_UNRESOLVED_EFFECT');
    assert.deepEqual(f.projectDto.protectionBypass, {});
    assert.equal(f.rows.length, 1);
  } finally {
    f.close();
  }
});
test('changed env ownership is preserved while the independently owned temporary bypass is revoked', async () => {
  const f = fixture();
  try {
    await f.run('prepare');
    await f.run('configure');
    f.rows[0].comment = 'newer legitimate owner edit';
    assert.equal((await f.run('cleanup')).public.code, 'M04_VERCEL_ENVIRONMENT');
    assert.equal(f.rows.length, 7);
    assert.deepEqual(f.projectDto.protectionBypass, {});
    assert.equal(f.rows[0].comment, 'newer legitimate owner edit');
  } finally {
    f.close();
  }
});
test('polling stays one deployment GET per call and refuses exceeding twelve without making another request', async () => {
  const f = fixture();
  try {
    await f.run('prepare');
    await f.run('configure');
    f.state.vercelSetup.polls = 12;
    const before = f.calls.length;
    assert.equal((await f.run('poll')).public.code, 'M04_VERCEL_POLL_LIMIT');
    assert.equal(f.calls.length, before);
  } finally {
    f.close();
  }
});
test('changed policy caps and unrelated actors are rejected before network writes', async () => {
  const f = fixture();
  try {
    await f.run('prepare');
    f.state.livePolicy.max_actor_starts = 5;
    assert.equal((await f.run('configure')).public.code, 'M04_VERCEL_POLICY');
    assert.equal(f.calls.length, 0);
  } finally {
    f.close();
  }
});
test('a lost sole-bypass create acknowledgement is reconciled by its privately saved identity and revoked without replay', async () => {
  const f = fixture();
  try {
    await f.run('prepare');
    const r = await f.run('configure', async (method, path, value) => {
      const response = await f.send(method, path, value);
      if (method === 'PATCH' && value.generate) throw Error('synthetic lost acknowledgement');
      return response;
    });
    assert.equal(r.public.status, 'blocked');
    assert.equal(f.state.vercelSetup.pending.action, 'bypass.create');
    assert.equal((await f.run('cleanup')).public.status, 'completed');
    assert.equal(f.state.vercelSetup.bypassRecoveredByPrivateIdentity, true);
    assert.deepEqual(f.projectDto.protectionBypass, {});
    assert.equal(f.calls.filter((c) => c.method === 'PATCH' && c.value.generate).length, 1);
  } finally {
    f.close();
  }
});
test('Machine custody pins refuse another valid Preview audience, source commit or window before network activity', async () => {
  for (const patch of [
    { audience: 'https://everyone-market-researcher-unrelated.vercel.app' },
    { sourceCommitSha: 'a'.repeat(40) },
    { windowId: 'another-window' },
    { version: 2 },
  ]) {
    const f = fixture();
    try {
      const metadata = JSON.parse(readFileSync(f.metadataPath, 'utf8'));
      writeFileSync(f.metadataPath, JSON.stringify({ ...metadata, ...patch }));
      assert.equal((await f.run('prepare')).public.code, 'M04_VERCEL_MACHINE_BASELINE');
      assert.equal(f.calls.length, 0);
      assert.equal(f.state.machineBaseline, undefined);
    } finally {
      f.close();
    }
  }
});
test('the exact pending bypass creation resumes from full Project readback without another creation PATCH', async () => {
  const f = fixture();
  try {
    await f.run('prepare');
    const v = f.state.vercelSetup,
      at = Date.now();
    v.pending = { action: 'bypass.create', at };
    f.projectDto.protectionBypass[f.state.protectionBypass] = {
      scope: 'automation-bypass',
      note: v.comment,
      createdAt: at,
      isEnvVar: true,
    };
    const result = await f.run('configure');
    assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
    assert.equal(v.bypassRecoveredByPrivateIdentity, true);
    assert.equal(v.environments.length, 7);
    assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, 0);
    assert.equal(f.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?')).length, 7);
  } finally {
    f.close();
  }
});
test('pending bypass recovery refuses a mismatched note, time, default or extra environment before writes', async () => {
  for (const fault of ['note', 'time', 'default', 'environment']) {
    const f = fixture();
    try {
      await f.run('prepare');
      const v = f.state.vercelSetup,
        at = Date.now();
      v.pending = { action: 'bypass.create', at };
      f.projectDto.protectionBypass[f.state.protectionBypass] = {
        scope: 'automation-bypass',
        note: fault === 'note' ? 'another owner' : v.comment,
        createdAt: fault === 'time' ? at - 31000 : at,
        isEnvVar: fault !== 'default',
      };
      if (fault === 'environment')
        f.rows.push({ key: 'EMR_COLLECTORS_ENABLED', gitBranch: 'm04-collectors-vimeo-instagram' });
      const result = await f.run('configure');
      assert.equal(result.public.status, 'blocked');
      assert.ok(f.calls.every((c) => c.method === 'GET'));
      assert.equal(v.pending.action, 'bypass.create');
    } finally {
      f.close();
    }
  }
});
