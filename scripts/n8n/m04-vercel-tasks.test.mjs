import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
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
function fixture({ incremental = false, hc01 = false, m05 = false } = {}) {
  incremental ||= hc01;
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
  const records = {};
  if (incremental) {
    state.scope = 'incremental';
    const observedAt = new Date().toISOString();
    const machine = {
      id: 'EmrM03Machine19',
      name: 'M03 foundation machine [dev]',
      type: 'httpCustomAuth',
      createdAt: '2026-10-19T00:25:21.669Z',
      updatedAt: observedAt,
    };
    state.native = {
      inventoryComplete: true,
      machine: { baseline: machine, current: structuredClone(machine), rebound: false, pending: null },
    };
    const base = JSON.parse(
      readFileSync(
        join(
          repo,
          'milestones/M04-collectors-vimeo-instagram/evidence/live-db-preflight-after-path-fix-20261027.json',
        ),
        'utf8',
      ),
    ).preflight;
    const accounts = structuredClone(base.accounts);
    for (const [index, company, vimeo, instagram] of [
      [1, 'C130', 'bigfootfilmseg', 'bigfootfilms'],
      [2, 'C270', 'thetalkiesproductionsleb', 'thetalkies'],
      [3, 'C226', 'bigkahunafilms', 'bigkahunafilms'],
    ]) {
      for (const platform of ['vimeo', 'instagram']) {
        const handle = platform === 'vimeo' ? vimeo : instagram;
        accounts.push({
          ...structuredClone(base.accounts.find((a) => a.platform === platform)),
          id: `27000000-0000-4000-8000-${String(index * 2 + (platform === 'vimeo' ? 0 : 1)).padStart(12, '0')}`,
          company_code: company,
          handle,
          url: platform === 'vimeo' ? `https://vimeo.com/${handle}` : `https://www.instagram.com/${handle}/`,
        });
      }
    }
    records['incremental-dev-approval-20261027.json'] = {
      version: 1,
      approval_kind: 'incremental',
      approval_id: '27000000-0000-4000-8000-000000000099',
      approvedAt: new Date(Date.now() - 60000).toISOString(),
      reviewedHead: '2c450f40557e7582525d96b5dd63bba2338baa0d',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      ceilings: { actorStarts: 8, actorUsd: 8, perActorUsd: 1, resultsPerProfile: 50 },
    };
    records['incremental-db-preflight-20261027.json'] = {
      version: 1,
      phase: 'Query',
      status: 'reviewed_query_complete',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      host: 'aws-1-eu-central-1.pooler.supabase.com',
      port: 5432,
      authenticationVerified: true,
      childrenClosed: true,
      databaseClientClosed: true,
      lastNativeExit: 0,
      observedAt,
      queryResult: [{ incremental_preflight: { ...base, accounts, selectedCount: 10 } }],
    };
    records['incremental-provider-preflight-20261027.json'] = {
      status: 'completed',
      observedAt,
      provider: structuredClone(publicProvider),
    };
  }
  if (hc01) {
    state.scope = 'hc01';
    const approval = records['incremental-dev-approval-20261027.json'];
    records['hc01-dev-approval-20261028.json'] = {
      ...approval,
      approval_kind: 'hc01',
      approval_id: '1cf8406c-1142-445e-a237-6d0fd7a67b22',
      recordedAt: approval.approvedAt,
      reviewedHead: 'bb0cd01d3a6ee239540e73b1d366f86e46b17d42',
      ceilings: { actorStarts: 22, actorUsd: 22, perActorUsd: 1, resultsPerProfile: 30 },
    };
    const historical = JSON.parse(
      readFileSync(
        join(
          repo,
          'milestones/M04-collectors-vimeo-instagram/evidence/incremental-final-readback-20261027.json',
        ),
        'utf8',
      ),
    );
    records['incremental-final-readback-20261027.json'] = historical;
    const db = structuredClone(records['incremental-db-preflight-20261027.json']);
    db.queryResult[0].incremental_preflight = structuredClone(
      historical.queryResult[0].incremental_preflight,
    );
    db.queryResult[0].incremental_preflight.migrations.push({
      version: '20261027192743',
      name: 'm04_recent_instagram_dev_eligibility',
      historySha256: '1'.repeat(64),
    });
    records['hc01-db-preflight-20261028.json'] = db;
    records['hc01-provider-preflight-20261028.json'] = structuredClone(
      records['incremental-provider-preflight-20261027.json'],
    );
  }
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
  if (m05) {
    state.scope = 'm05-subset';
    state.approvalId = 'ee05f451-d27f-4d03-97b2-6a77cbf21805';
    state.sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
      windowsHide: true,
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((key) =>
          process.env[key] ? [[key, process.env[key]]] : [],
        ),
      ),
    }).trim();
    state.selection = {
      youtube: ['df405b78-eb07-4347-af97-6b62522bab8f', '3dbf4ea2-3eae-4369-89cb-85df8fcd2e03'],
      linkedin: ['21e51070-6857-4dbd-873d-3a9feba72831', '22db994a-8b44-4a57-996a-60c80cd7a640'],
      linkedin_employees: ['258f2013-1ca6-4794-830c-6f49efbea0b2'],
    };
    const identities = [
      ['youtube', 'C173', 'https://www.youtube.com/@aflamproductions'],
      ['youtube', 'C186', 'https://www.youtube.com/@hekka_sa'],
      ['linkedin', 'C000', 'https://www.linkedin.com/company/everyonefilms/'],
      ['linkedin', 'C001', 'https://www.linkedin.com/company/goodpeoplefilms/'],
      ['linkedin_employees', 'C000', 'https://www.linkedin.com/company/everyonefilms/'],
    ];
    state.accountSnapshot = Object.values(state.selection)
      .flat()
      .map((id, index) => ({
        id,
        platform: identities[index][0],
        company_code: identities[index][1],
        url: identities[index][2],
        status: 'active',
        competitor_status: 'active',
        locked_until: null,
        backfill_status: identities[index][0] === 'linkedin_employees' ? 'not_applicable' : 'pending',
      }));
    const properties = {
      'harvestapi/linkedin-company-posts': [
        'targetUrls',
        'postedLimitDate',
        'maxPosts',
        'includeReposts',
        'includeQuotePosts',
        'scrapeReactions',
        'scrapeComments',
      ],
      'harvestapi/linkedin-company-employees': [
        'companies',
        'profileScraperMode',
        'companyBatchMode',
        'maxItems',
        'maxItemsPerCompany',
        'startPage',
        'takePages',
      ],
    };
    state.provider = {
      owner_id: 'SyntheticOwner',
      actors: Object.fromEntries(
        Object.entries(properties).map(([actor, inputProperties], index) => [
          actor,
          {
            actorId: 'SyntheticActor' + index,
            buildId: 'SyntheticBuild' + index,
            build: '1.2.3',
            pricing: [{ pricingModel: 'PAY_PER_EVENT' }],
            inputProperties,
          },
        ]),
      ),
    };
    state.livePolicy = {
      approval_id: state.approvalId,
      max_actor_starts: 8,
      max_actor_usd: 1,
      max_total_usd: 8,
      max_results_per_profile: 20,
      actors: Object.fromEntries(
        Object.entries(state.provider.actors).map(([actor, pin]) => [
          actor,
          {
            owner_id: state.provider.owner_id,
            actorId: pin.actorId,
            buildId: pin.buildId,
            build: pin.build,
            billingModel: 'PPE',
          },
        ]),
      ),
    };
    const machine = {
      id: 'EmrM03Machine19',
      name: 'M03 foundation machine [dev]',
      type: 'httpCustomAuth',
      createdAt: '2026-10-19T00:25:21.669Z',
      updatedAt: new Date().toISOString(),
    };
    state.native = {
      inventoryComplete: true,
      machine: { baseline: machine, current: structuredClone(machine), rebound: false, pending: null },
    };
    state.machineBaseline = { audience: originalMachine.audience };
    state.projectBaseline = structuredClone(projectDto);
    // M05 must use its current inventory, not re-open this old metadata source.
    writeFileSync(join(meta, 'pending-runtime.json'), 'not a M05 input');
  }
  const rows = [],
    calls = [],
    productionBuilds = [];
  let deployment;
  const send = async (method, path, value) => {
    calls.push({ method, path, value: structuredClone(value) });
    if (path.startsWith('/v6/deployments?'))
      return {
        status: 200,
        data: { deployments: structuredClone(productionBuilds), pagination: { next: null } },
        closed: true,
      };
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
      assert.equal(
        value.gitSource.ref,
        m05 ? 'm05-collectors-web-youtube-linkedin' : 'm04-collectors-vimeo-instagram',
      );
      assert.equal(value.gitSource.sha, state.sourceHead);
      deployment = {
        id: 'dpl_M04Synthetic',
        url: 'everyone-market-researcher-synthetic.vercel.app',
        target: null,
        projectId: project,
        createdAt: Date.now(),
        meta: {
          githubCommitSha: state.sourceHead,
          githubCommitRef: m05 ? 'm05-collectors-web-youtube-linkedin' : 'm04-collectors-vimeo-instagram',
        },
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
      return await runVercelTask({
        phase,
        state,
        secrets,
        repo,
        send: transport,
        ...(m05
          ? { readEvidence: () => assert.fail('M05 must not read old M04 approval/snapshot files') }
          : incremental
            ? { readEvidence: (_repo, name) => structuredClone(records[name]) }
            : {}),
      });
    } finally {
      if (prior === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = prior;
    }
  };
  return {
    state,
    calls,
    rows,
    records,
    productionBuilds,
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
test('M05 subset uses current inventory and completes branch-only setup through exact shutdown', async () => {
  const f = fixture({ m05: true });
  try {
    assert.equal((await f.run('prepare')).public.status, 'completed');
    const bypass = f.state.protectionBypass;
    assert.equal(f.calls.length, 0);
    assert.equal((await f.run('prepare')).public.status, 'completed');
    assert.equal(f.state.protectionBypass, bypass);
    for (const phase of ['configure', 'poll', 'cleanup']) {
      const result = await f.run(phase);
      assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
      for (const secret of [...Object.values(secrets), bypass])
        assert.ok(!JSON.stringify(result.public).includes(secret));
    }
    const creates = f.calls.filter((call) => call.method === 'POST' && call.path.includes('/env?'));
    assert.equal(creates.length, 7);
    for (const call of creates) {
      assert.equal(call.value.gitBranch, 'm05-collectors-web-youtube-linkedin');
      assert.deepEqual(call.value.target, ['preview']);
      assert.equal(call.value.type, 'sensitive');
    }
    const selected = JSON.parse(
      creates.find((call) => call.value.key === 'EMR_COLLECTORS_ACCOUNT_IDS').value.value,
    );
    assert.deepEqual(selected, Object.values(f.state.selection).flat());
    assert.equal(selected.length, 5);
    assert.deepEqual(f.projectDto.protectionBypass, {});
    assert.equal(f.rows.length, 0);
    assert.equal(f.state.vercelSetup.cleanupComplete, true);
    assert.equal(f.state.deployment.branch, 'm05-collectors-web-youtube-linkedin');
  } finally {
    f.close();
  }
});

test('M05 subset refuses websites, changed identities, provider pins and Machine drift before requests', async () => {
  for (const fault of ['website', 'identity', 'pin', 'machine', 'source']) {
    const f = fixture({ m05: true });
    try {
      if (fault === 'website')
        f.state.livePolicy.actors['apify/website-content-crawler'] = structuredClone(
          Object.values(f.state.livePolicy.actors)[0],
        );
      if (fault === 'identity') f.state.accountSnapshot[0].url = 'https://www.youtube.com/@unapproved';
      if (fault === 'pin') f.state.provider.actors['harvestapi/linkedin-company-posts'].build = '9.9.9';
      if (fault === 'machine') f.state.native.machine.current.updatedAt = '2020-01-01T00:00:00Z';
      if (fault === 'source') f.state.sourceHead = 'a'.repeat(40);
      assert.equal((await f.run('prepare')).public.status, 'blocked', fault);
      assert.equal(f.calls.length, 0);
    } finally {
      f.close();
    }
  }
});

test('M05 subset accepts adjusted finite operational settings and preserves other branch environment', async () => {
  const f = fixture({ m05: true });
  try {
    Object.assign(f.state.livePolicy, { max_actor_starts: 16, max_actor_usd: 2.5, max_total_usd: 20 });
    assert.equal((await f.run('prepare')).public.status, 'completed');
    const foreign = {
      id: 'unrelated_env',
      key: 'EMR_COLLECTORS_ENABLED',
      gitBranch: 'm04-collectors-vimeo-instagram',
      target: ['preview'],
      type: 'sensitive',
      comment: 'preserved historical branch',
    };
    f.rows.push(foreign);
    assert.equal((await f.run('configure')).public.status, 'completed');
    const policy = JSON.parse(
      f.calls.find((call) => call.method === 'POST' && call.value?.key === 'EMR_COLLECTORS_LIVE_POLICY').value
        .value,
    );
    assert.equal(policy.max_actor_starts, 16);
    assert.equal(policy.max_total_usd, 20);
    assert.equal((await f.run('cleanup')).public.status, 'completed');
    assert.deepEqual(f.rows, [foreign]);
    assert.deepEqual(f.projectDto.protectionBypass, {});
  } finally {
    f.close();
  }
});

test('M05 subset production conflict stops before any mutation and never adopts a lost environment create', async () => {
  const conflict = fixture({ m05: true });
  try {
    await conflict.run('prepare');
    conflict.productionBuilds.push({
      uid: 'dpl_OtherProduction',
      projectId: project,
      target: 'production',
      readyState: 'BUILDING',
    });
    assert.equal((await conflict.run('configure')).public.code, 'M04_VERCEL_PRODUCTION_BUILD_CONFLICT');
    assert.ok(conflict.calls.every((call) => call.method === 'GET'));
  } finally {
    conflict.close();
  }
  const f = fixture({ m05: true });
  try {
    await f.run('prepare');
    assert.equal(
      (
        await f.run('configure', async (method, path, value) => {
          const response = await f.send(method, path, value);
          if (method === 'POST' && path.includes('/env?')) throw Error('synthetic lost acknowledgement');
          return response;
        })
      ).public.status,
      'blocked',
    );
    const count = f.calls.length;
    assert.equal((await f.run('configure')).public.status, 'blocked');
    assert.equal(f.calls.length, count);
    assert.equal((await f.run('cleanup')).public.code, 'M04_VERCEL_UNRESOLVED_EFFECT');
    assert.equal(f.rows.length, 1);
    assert.deepEqual(f.projectDto.protectionBypass, {});
  } finally {
    f.close();
  }
});

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

test('HC01 preparation preserves18-version parity and narrows runtime selection to exactfive Instagram plusEveryoneVimeo', async () => {
  const f = fixture({ hc01: true });
  try {
    const r = await f.run('prepare');
    assert.equal(r.public.status, 'completed', JSON.stringify(r.public));
    assert.equal(f.state.selection.instagram.length, 5);
    assert.deepEqual(f.state.selection.vimeo, ['985a57dd-7934-422d-9d18-4e8ca59fc197']);
    assert.equal(f.state.livePolicy.max_actor_starts, 22);
    assert.equal(f.state.livePolicy.max_results_per_profile, 30);
    for (const phase of ['configure', 'poll', 'cleanup'])
      assert.equal((await f.run(phase)).public.status, 'completed', phase);
    assert.equal(f.rows.length, 0);
    assert.deepEqual(f.projectDto.protectionBypass, {});
  } finally {
    f.close();
  }
});

test('HC01 preparation refuses changed approvedidentity, completehistory or missing18th migration before network', async () => {
  for (const fault of ['identity', 'history', 'migration']) {
    const f = fixture({ hc01: true });
    try {
      const snapshot = f.records['hc01-db-preflight-20261028.json'].queryResult[0].incremental_preflight;
      const a = snapshot.accounts.find((a) => a.platform === 'instagram');
      if (fault === 'identity') a.id = '27000000-0000-4000-8000-000000000001';
      if (fault === 'history') a.backfill_status = 'done';
      if (fault === 'migration') snapshot.migrations.pop();
      assert.equal((await f.run('prepare')).public.status, 'blocked');
      assert.equal(f.calls.length, 0);
    } finally {
      f.close();
    }
  }
});

test('incremental preparation binds all ten exact selectors and new caps to fresh receipts and the restored Machine metadata', async () => {
  const f = fixture({ incremental: true });
  try {
    const result = await f.run('prepare');
    assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
    assert.equal(f.calls.length, 0);
    assert.equal(f.state.selection.vimeo.length, 5);
    assert.equal(f.state.selection.instagram.length, 5);
    assert.equal(new Set([...f.state.selection.vimeo, ...f.state.selection.instagram]).size, 10);
    assert.equal(f.state.livePolicy.max_actor_starts, 8);
    assert.equal(f.state.livePolicy.max_total_usd, 8);
    assert.equal(f.state.livePolicy.max_results_per_profile, 50);
    assert.equal(f.state.machineBaseline.audience, originalMachine.audience);
    assert.equal(
      f.state.livePolicy.approval_id,
      f.records['incremental-dev-approval-20261027.json'].approval_id,
    );
    assert.match(f.state.vercelSetup.comment, /^M04 incremental temporary dev /);
  } finally {
    f.close();
  }
});

test('incremental preparation refuses another selector URL, duplicate UUID or mismatched strict Query identity before network use', async () => {
  for (const fault of ['url', 'uuid', 'host', 'closure', 'approval', 'old-receipt', 'machine']) {
    const f = fixture({ incremental: true });
    try {
      const db = f.records['incremental-db-preflight-20261027.json'];
      const accounts = db.queryResult[0].incremental_preflight.accounts;
      if (fault === 'url') accounts[4].url = 'https://vimeo.com/another';
      if (fault === 'uuid') accounts[4].id = accounts[0].id;
      if (fault === 'host') db.host = 'another.pooler.supabase.com';
      if (fault === 'closure') db.databaseClientClosed = false;
      if (fault === 'approval') f.records['incremental-dev-approval-20261027.json'].ceilings.actorStarts = 4;
      if (fault === 'old-receipt') db.observedAt = '2026-10-26T00:00:00Z';
      if (fault === 'machine') f.state.native.machine.current.updatedAt = '2026-10-25T21:06:39.771Z';
      const result = await f.run('prepare');
      assert.equal(result.public.status, 'blocked', fault);
      assert.equal(
        result.public.code,
        'M04_VERCEL_' +
          {
            url: 'ACCOUNT_SELECTION',
            uuid: 'ACCOUNT_SELECTION',
            host: 'DATABASE_SNAPSHOT',
            closure: 'DATABASE_SNAPSHOT',
            approval: 'APPROVAL',
            'old-receipt': 'DATABASE_SNAPSHOT',
            machine: 'MACHINE_BASELINE',
          }[fault],
        fault,
      );
      assert.equal(f.calls.length, 0, fault);
      assert.equal(f.state.livePolicy, undefined, fault);
    } finally {
      f.close();
    }
  }
});

test('incremental setup and shutdown use thirty-five bounded requests with one poll and no Production write', async () => {
  const f = fixture({ incremental: true });
  try {
    for (const phase of ['prepare', 'configure', 'poll', 'cleanup']) {
      const result = await f.run(phase);
      assert.equal(result.public.status, 'completed', JSON.stringify(result.public));
      for (const secret of [...Object.values(secrets), f.state.protectionBypass])
        assert.ok(!JSON.stringify(result.public).includes(secret));
    }
    assert.equal(f.calls.length, 35);
    const productionReads = f.calls.filter((c) => c.path.startsWith('/v6/deployments?'));
    assert.equal(productionReads.length, 2);
    assert.ok(productionReads.every((c) => c.method === 'GET'));
    assert.ok(productionReads.every((c) => c.path.includes('target=production')));
    const creates = f.calls.filter((c) => c.method === 'POST' && c.path.includes('/env?'));
    assert.equal(creates.length, 7);
    assert.ok(creates.every((c) => JSON.stringify(c.value.target) === '["preview"]'));
    assert.deepEqual(f.rows, []);
    assert.deepEqual(f.projectDto.protectionBypass, {});
    assert.equal(f.state.vercelSetup.cleanupComplete, true);
    assert.equal(f.state.deployment.id, 'dpl_M04Synthetic');
  } finally {
    f.close();
  }
});

test('an in-progress Production deployment blocks incremental bypass creation without any mutation', async () => {
  const f = fixture({ incremental: true });
  try {
    await f.run('prepare');
    f.productionBuilds.push({ uid: 'dpl_UnrelatedProduction', state: 'BUILDING', target: 'production' });
    const result = await f.run('configure');
    assert.equal(result.public.code, 'M04_VERCEL_PRODUCTION_BUILD_CONFLICT');
    assert.ok(f.calls.every((c) => c.method === 'GET'));
    assert.deepEqual(f.rows, []);
    assert.deepEqual(f.projectDto.protectionBypass, {});
  } finally {
    f.close();
  }
});

test('a late Production conflict is reported after independent owned incremental bindings and bypass are removed', async () => {
  const f = fixture({ incremental: true });
  try {
    await f.run('prepare');
    await f.run('configure');
    f.productionBuilds.push({ uid: 'dpl_UnrelatedProduction', state: 'QUEUED', target: 'production' });
    const result = await f.run('cleanup');
    assert.equal(result.public.code, 'M04_VERCEL_PRODUCTION_BUILD_CONFLICT');
    assert.equal(result.public.cleanupComplete, true);
    assert.deepEqual(f.rows, []);
    assert.deepEqual(f.projectDto.protectionBypass, {});
    assert.equal(f.productionBuilds.length, 1);
    assert.ok(f.calls.filter((c) => c.path.startsWith('/v6/deployments?')).every((c) => c.method === 'GET'));
  } finally {
    f.close();
  }
});

test('incremental Production metadata errors do not prevent revocation of the already-owned bypass', async () => {
  const f = fixture({ incremental: true });
  try {
    await f.run('prepare');
    await f.run('configure');
    const result = await f.run('cleanup', async (method, path, value) =>
      path.startsWith('/v6/deployments?')
        ? { status: 200, data: { deployments: [], pagination: { next: 1 } }, closed: true }
        : f.send(method, path, value),
    );
    assert.equal(result.public.code, 'M04_VERCEL_PRODUCTION_METADATA');
    assert.equal(result.public.cleanupComplete, true);
    assert.deepEqual(f.projectDto.protectionBypass, {});
    assert.deepEqual(f.rows, []);
  } finally {
    f.close();
  }
});
