import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  foundationWorkflowNames,
  foundationTagNames,
  nativeFoundationTagName,
} from '../../packages/shared/src/n8n-bindings.ts';
import { buildFoundationGatewayWorkflows } from './build-foundation-gateway.mjs';
import {
  materializeFoundationAcceptanceCase,
  foundationAcceptancePlan,
  verifyFoundationSubReplay,
} from './materialize-acceptance-case.mjs';

const bindings = {
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: Object.fromEntries(
    Object.entries(foundationWorkflowNames).map(([key, name], i) => [key, { id: 'SyntheticCase' + i, name }]),
  ),
  tagRefs: Object.fromEntries(
    foundationTagNames.map((key, i) => [key, { id: 'SyntheticTag' + i, name: nativeFoundationTagName(key) }]),
  ),
  credentials: {
    postgres: {
      id: 'SyntheticWriter',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
    apify: { id: 'SyntheticApify', name: 'Apify account', type: 'apifyApi', environment: 'dev' },
  },
};
const transport = {
  audience: 'https://everyone-market-researcher-cases.vercel.app',
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  credential: { id: 'SyntheticMachine', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const fixture = {
  result: 'M03_SMOKE_FIXTURE_READY',
  company_code: 'C999',
  competitor_id: '01111111-1111-4111-8111-111111111111',
  account_id: '02222222-2222-4222-8222-222222222222',
  platform: 'website_work_page',
  url: 'https://everyone.film/about-everyone',
  competitor_status: 'active',
  account_status: 'active',
};
const node = (g, name) => g.workflow.nodes.find((n) => n.name === name);
const run = (n, input = {}) =>
  JSON.parse(
    JSON.stringify(
      runInNewContext(
        `(function(){${n.parameters.jsCode}\n})()`,
        { $input: { all: () => [{ json: input }] }, $execution: { id: 'SyntheticCaseExecution' } },
        { timeout: 1000 },
      ),
    ),
  );

test('finite plan keeps optional local cases separate, avoids a third live health run and grants no execution', () => {
  const p = foundationAcceptancePlan();
  assert.equal(p.cases.length, 27);
  assert.equal(p.recommendedLiveCaseIds.length, 23);
  assert.ok(!p.recommendedLiveCaseIds.includes('health.first'));
  assert.equal(p.executionAuthorized, false);
  assert.equal(p.sourceOnly, true);
  assert.deepEqual(p.publicationOrder[0].workflowKeys, ['SUB-NOTIFY']);
  assert.deepEqual(p.publicationOrder[1].workflowKeys, ['WF-90']);
  assert.equal(p.publicationOrder[2].deferredErrorLinks, 24);
  assert.equal(p.totalRecommendedUpperBounds.gatewayHttpAttempts, 118);
  assert.equal(p.totalRecommendedUpperBounds.nativeExecutions, 68);
  assert.equal(p.totalRecommendedUpperBounds.providerGetAttempts, 20);
  assert.equal(p.totalRecommendedUpperBounds.actorStarts, 2);
});
test('native publication plan includes the exact nested integrated dependencies without publishing WF-00', () => {
  const p = foundationAcceptancePlan(),
    graphs = buildFoundationGatewayWorkflows(bindings, transport),
    byKey = new Map(graphs.map((g) => [g.key, g])),
    byId = new Map(Object.entries(bindings.workflowRefs).map(([key, ref]) => [ref.id, key])),
    published = new Set(['WF-19', 'WF-90']),
    pending = [
      ...['WF-00', 'WF-99', 'WF-91', 'SUB-INGEST', 'SUB-COST'].map((key) => [key, 'manual']),
      ['WF-19', 'webhook'],
      ['WF-90', 'error'],
    ],
    seen = new Set();
  while (pending.length) {
    const [key, mode] = pending.pop(),
      visit = key + ':' + mode;
    if (seen.has(visit)) continue;
    seen.add(visit);
    for (const n of byKey
      .get(key)
      .workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow')) {
      const child = byId.get(n.parameters.workflowId.value);
      assert.ok(child);
      // Pinned 2.43.5: direct manual child loads draft; the child engine is
      // integrated and BaseExecuteContext forwards its mode without replacing
      // it with rootExecutionMode, so the next level loads published source.
      if (mode !== 'manual') published.add(child);
      pending.push([child, 'integrated']);
    }
  }
  assert.deepEqual(
    [...published].sort(),
    [...p.nativePublicationBoundary.uniqueTemporaryWorkflowKeys].sort(),
  );
  assert.equal(p.nativePublicationBoundary.publicationActions, 8);
  const actions = p.publicationOrder.filter((x) => /^bootstrap_notify|^publish_|^republish_/.test(x.phase));
  assert.equal(
    actions.reduce((sum, x) => sum + x.workflowKeys.length, 0),
    8,
  );
  assert.equal(
    actions.some((x) => x.workflowKeys.includes('WF-00')),
    false,
  );
  assert.equal(
    actions.some((x) => x.workflowKeys.includes('WF-91')),
    false,
  );
});
test('all dispatch variants inject one fixed Code node into the Manual branch only and preserve canonical source', () => {
  const original = buildFoundationGatewayWorkflows(bindings, transport).find((g) => g.key === 'WF-00'),
    before = JSON.stringify(original);
  for (const c of foundationAcceptancePlan().cases.filter((c) => c.workflowKey === 'WF-00')) {
    const g = materializeFoundationAcceptanceCase(bindings, transport, c.id);
    assert.equal(g.kind, 'proposed-native-manual-case');
    assert.equal(g.hostedAcceptance, false);
    assert.equal(g.workflow.active, false);
    assert.equal(g.acceptanceCase.executionAuthorized, false);
    assert.equal(g.workflow.nodes.filter((n) => n.name.startsWith('M03 acceptance input · ')).length, 1);
    const manual = node(g, 'Manual slot test'),
      injected = node(g, g.acceptanceCase.inputNodeName);
    assert.deepEqual(g.workflow.connections[manual.name].main, [
      [{ node: injected.name, type: 'main', index: 0 }],
    ]);
    assert.deepEqual(run(injected), [{ json: c.input }]);
    assert.equal(
      g.workflow.nodes
        .filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger')
        .every((n) => n.disabled === true),
      true,
    );
    const restored = structuredClone(g.workflow);
    restored.nodes = restored.nodes.filter((n) => n.name !== injected.name);
    delete restored.connections[injected.name];
    restored.connections[manual.name] = original.workflow.connections[manual.name];
    restored.settings.availableInMCP = original.workflow.settings.availableInMCP;
    for (const n of restored.nodes) {
      const source = node(original, n.name);
      if (n.type === 'n8n-nodes-base.scheduleTrigger') {
        if (Object.hasOwn(source, 'disabled')) n.disabled = source.disabled;
        else delete n.disabled;
      }
    }
    assert.deepEqual(restored, original.workflow);
  }
  assert.equal(JSON.stringify(original), before);
});

// Synthetic projected first-run receipts. This shape is not hosted evidence;
// SQL, not this fixture, verifies the canonical original groups digest.
const originalItem = {
  platform: 'website_work_page',
  external_id: 'e4d69e3fb0d821183258d75248f9df24',
  actor: 'apify/website-content-crawler',
  item_type: 'project_page',
  url: fixture.url,
  published_at: null,
  title: 'Synthetic owned page',
  caption: 'Synthetic public page',
  metrics: {},
  payload: {
    url: fixture.url,
    markdown: 'Synthetic public page',
    metadata: { title: 'Synthetic owned page' },
  },
};
const originalReceipt = {
  updated: true,
  finished_now: true,
  apify_run_id: 'SyntheticOriginalRun',
  run_id: '04444444-4444-4444-8444-444444444444',
  account_ids: [fixture.account_id],
  status: 'SUCCEEDED',
  dataset_id: 'SyntheticOriginalDataset',
  cost_usd: 0.012346,
  groups_sha256: 'f'.repeat(64),
  normalizer_version: 'smoke_website_stub.v1',
  cost_keys: ['apify:SyntheticOriginalRun:' + fixture.account_id],
  items_seen: 1,
  items_new: 1,
  new_item_ids: ['03333333-3333-4333-8333-333333333333'],
  accounts_ok: 1,
  accounts_failed: 0,
  run_summary: {
    run_id: '04444444-4444-4444-8444-444444444444',
    status: 'success',
    accounts_total: 1,
    accounts_ok: 1,
    accounts_failed: 0,
    items_seen: 1,
    items_new: 1,
    cost_usd: 0.012346,
  },
};
const firstRunEvidence = {
  source: 'bounded-original-dataset-read',
  readRequestId: '05555555-5555-4555-8555-555555555555',
  launch: {
    window_id: transport.windowId,
    launch_id: '967a1449-f363-410e-afab-b91e6ce3676a',
    ordinal: 1,
    actor_id: 'aYG0l9s7dbB7j3gbS',
    actor_build: '0.3.99',
    run_id: originalReceipt.run_id,
    account_id: fixture.account_id,
    apify_run_id: originalReceipt.apify_run_id,
  },
  registered: {
    apify_run_id: originalReceipt.apify_run_id,
    actor_id: 'apify/website-content-crawler',
    run_id: originalReceipt.run_id,
    account_ids: [fixture.account_id],
    purpose: 'daily',
    status: 'SUCCEEDED',
    dataset_id: originalReceipt.dataset_id,
    usage_usd: originalReceipt.cost_usd,
    processed_at: '2026-10-19T00:00:00Z',
    processing_result: originalReceipt,
  },
  atomicInput: {
    p_apify_run_id: originalReceipt.apify_run_id,
    p_status: 'SUCCEEDED',
    p_dataset_id: originalReceipt.dataset_id,
    p_usage_usd: 0.01234567,
    p_groups: [
      { account_id: fixture.account_id, normalizer_version: 'smoke_website_stub.v1', items: [originalItem] },
    ],
  },
  costEntry: {
    provider: 'apify',
    category: 'scrape',
    quantity: 1,
    unit: 'result',
    cost_usd: originalReceipt.cost_usd,
    run_id: originalReceipt.run_id,
    competitor_id: fixture.competitor_id,
    platform: 'website_work_page',
    meta: {
      actor: 'apify/website-content-crawler',
      apify_run_id: originalReceipt.apify_run_id,
      account_id: fixture.account_id,
      cost_key: originalReceipt.cost_keys[0],
    },
  },
};
const stableState = {
  items: 1,
  rawSnapshots: 1,
  aiExtractQueue: 1,
  embedQueue: 1,
  mediaQueue: 0,
  costEntries: 1,
  itemsSha256: 'a'.repeat(64),
  rawSnapshotsSha256: 'b'.repeat(64),
  queuesSha256: 'c'.repeat(64),
  costsSha256: 'd'.repeat(64),
};
test('four exact SUB cases reuse only the first original normalized input and measured cost without new provider work', () => {
  const p = foundationAcceptancePlan();
  assert.equal(p.subReadiness.length, 5);
  assert.ok(p.subReadiness.every((x) => x.nativeCompletionRequired && x.emptyExecutionListIsProof === false));
  for (const c of p.cases.filter((c) => c.id.startsWith('sub.'))) {
    const g = materializeFoundationAcceptanceCase(bindings, transport, c.id, {
        fixtureReceipt: fixture,
        firstRunEvidence,
      }),
      input = run(node(g, g.acceptanceCase.inputNodeName))[0].json;
    assert.equal(g.workflow.active, false);
    assert.equal(g.workflow.settings.availableInMCP, true);
    assert.equal(
      g.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger' && n.disabled !== true).length,
      1,
    );
    assert.equal(g.acceptanceCase.upperBounds.actorStarts, 0);
    assert.equal(g.acceptanceCase.upperBounds.providerGetAttempts, 0);
    assert.equal(g.acceptanceCase.upperBounds.gatewayHttpAttempts, 2);
    if (c.workflowKey === 'SUB-INGEST') {
      assert.deepEqual(input, {
        apify_run_id: originalReceipt.apify_run_id,
        status: 'SUCCEEDED',
        dataset_id: originalReceipt.dataset_id,
        usage_usd: firstRunEvidence.atomicInput.p_usage_usd,
        groups: firstRunEvidence.atomicInput.p_groups,
        env: 'dev',
      });
      assert.equal(
        run(node(g, 'Prepare atomic callback'), input)[0].json.params[0],
        originalReceipt.apify_run_id,
      );
    } else {
      assert.deepEqual(input, { entries: [firstRunEvidence.costEntry], env: 'dev' });
      assert.equal(
        JSON.parse(run(node(g, 'Prepare costs'), input)[0].json.params[0])[0].cost_usd,
        originalReceipt.cost_usd,
      );
    }
  }
});
test('SUB replay checks require exact output and unchanged authoritative state without claiming native completion from SQL', () => {
  for (const id of ['sub.ingest.replay_a', 'sub.ingest.replay_b', 'sub.cost.replay_a', 'sub.cost.replay_b']) {
    const g = materializeFoundationAcceptanceCase(bindings, transport, id, {
        fixtureReceipt: fixture,
        firstRunEvidence,
      }),
      result = id.includes('ingest')
        ? { ...originalReceipt, updated: false, finished_now: false }
        : { inserted: 0 };
    const output = result;
    if (id.includes('ingest')) assert.equal(output.items_new, 1);
    assert.equal(g.acceptanceCase.requiresFirstRunEvidence, true);
    assert.equal(
      verifyFoundationSubReplay(
        id,
        output,
        { fixtureReceipt: fixture, firstRunEvidence },
        stableState,
        stableState,
      ).zeroDeltaVerified,
      true,
    );
    for (const change of [
      { ...stableState, aiExtractQueue: 2 },
      { ...stableState, costsSha256: 'e'.repeat(64) },
    ])
      assert.throws(() =>
        verifyFoundationSubReplay(
          id,
          output,
          { fixtureReceipt: fixture, firstRunEvidence },
          stableState,
          change,
        ),
      );
    assert.equal(
      verifyFoundationSubReplay(
        id,
        output,
        { fixtureReceipt: fixture, firstRunEvidence },
        stableState,
        stableState,
      ).nativeCompletionVerified,
      false,
    );
    const bad = structuredClone(output);
    if (id.includes('ingest')) bad.updated = true;
    else bad.inserted = 1;
    assert.throws(() =>
      verifyFoundationSubReplay(
        id,
        bad,
        { fixtureReceipt: fixture, firstRunEvidence },
        stableState,
        stableState,
      ),
    );
  }
});
test('first-run SUB evidence rejects missing provenance, second launch, changed account/item/amount and fabricated entries', () => {
  for (const mutate of [
    (e) => delete e.readRequestId,
    (e) => (e.source = 'execution-export'),
    (e) => (e.launch.ordinal = 2),
    (e) => (e.launch.launch_id = '68836b08-7b71-4894-a758-cb28d92de171'),
    (e) => (e.atomicInput.p_groups[0].account_id = '06666666-6666-4666-8666-666666666666'),
    (e) => (e.atomicInput.p_groups[0].items[0].url = 'https://other.example'),
    (e) => (e.costEntry.cost_usd = 1),
    (e) => (e.costEntry.meta.cost_key = 'fake'),
    (e) => (e.costEntry.item_id = originalReceipt.new_item_ids[0]),
  ]) {
    const e = structuredClone(firstRunEvidence);
    mutate(e);
    assert.throws(() =>
      materializeFoundationAcceptanceCase(bindings, transport, 'sub.cost.replay_a', {
        fixtureReceipt: fixture,
        firstRunEvidence: e,
      }),
    );
  }
  assert.throws(() =>
    materializeFoundationAcceptanceCase(bindings, transport, 'sub.ingest.replay_a', {
      fixtureReceipt: fixture,
    }),
  );
});
test('fixed dispatch inputs exercise fifteen native slots, optional guards, Saturday collision and unknown audit', () => {
  const cases = foundationAcceptancePlan().cases.filter((c) => c.workflowKey === 'WF-00');
  for (const c of cases) {
    const g = materializeFoundationAcceptanceCase(bindings, transport, c.id),
      input = run(node(g, g.acceptanceCase.inputNodeName))[0].json;
    const result = run(node(g, 'Which slot?'), {
      env: 'dev',
      app_url: '',
      webhook_base: 'https://muhhammedsayed.app.n8n.cloud',
      notify_mode: 'log',
      stories_twice_daily: false,
      backfill_enabled: false,
      input: { timestamp: null, slot_override: null, env: null, ...input },
    });
    assert.deepEqual(
      result.map((x) => x.json.target),
      c.expectedTargets,
    );
  }
  assert.deepEqual(cases.find((c) => c.id === 'dispatch.saturday04').expectedTargets, ['WF-18', 'WF-40']);
});
test('health variants use the existing validated input, retention off and no scheduled branch', () => {
  for (const id of ['health.first', 'health.second']) {
    const g = materializeFoundationAcceptanceCase(bindings, transport, id),
      value = run(node(g, g.acceptanceCase.inputNodeName))[0].json;
    assert.deepEqual(run(node(g, 'Validate dev input'), value), [
      { json: { mode: 'manual', limit: null, result_type: null, env: 'dev' } },
    ]);
    assert.equal(g.workflow.settings.saveDataSuccessExecution, 'none');
    assert.equal(g.workflow.settings.saveDataErrorExecution, 'none');
    assert.equal(g.workflow.settings.saveManualExecutions, false);
    assert.equal(g.workflow.settings.saveExecutionProgress, false);
  }
});
test('two fixed launch proposals require the exact fixture receipt and preserve disabled actor controls by default', () => {
  const values = [];
  for (const id of ['smoke.first', 'smoke.second']) {
    const g = materializeFoundationAcceptanceCase(bindings, transport, id, { fixtureReceipt: fixture }),
      value = run(node(g, g.acceptanceCase.inputNodeName))[0].json;
    values.push(value);
    assert.equal(value.action, 'launch');
    assert.equal(value.account_id, fixture.account_id);
    assert.equal(run(node(g, 'Validate smoke action'), value)[0].json.launchEnabled, false);
    assert.equal(node(g, 'Start exact actor once (disabled)').disabled, true);
    assert.equal(g.acceptanceCase.actorLaunchEnabled, false);
    assert.equal(
      g.acceptanceCase.fixtureReceiptVerification,
      'shape-only; hosted fixture ownership remains a separate SQL gate',
    );
  }
  assert.notEqual(values[0].launch_id, values[1].launch_id);
  assert.deepEqual(
    values,
    foundationAcceptancePlan()
      .cases.filter((c) => c.workflowKey === 'WF-99')
      .map((c) => ({ ...c.input, account_id: fixture.account_id })),
  );
});
test('only the existing explicit source release flag can propose enabled launch while retaining inactive workflow and canonical wire limits', () => {
  const base = buildFoundationGatewayWorkflows(bindings, transport, { launchEnabled: true }).find(
      (g) => g.key === 'WF-99',
    ),
    g = materializeFoundationAcceptanceCase(bindings, transport, 'smoke.first', {
      fixtureReceipt: fixture,
      release: { launchEnabled: true },
    });
  assert.equal(g.workflow.active, false);
  assert.deepEqual(
    node(g, 'Start exact actor once (disabled)'),
    node(base, 'Start exact actor once (disabled)'),
  );
  assert.equal(g.acceptanceCase.actorLaunchEnabled, true);
  assert.equal(g.acceptanceCase.executionAuthorized, false);
});
test('unknown cases, arbitrary inputs/options, wrong fixture identity and non-boolean release flags fail closed', () => {
  for (const [id, options] of [
    ['arbitrary', {}],
    ['dispatch.vimeo', { input: { slot_override: 'vimeo' } }],
    ['health.second', { fixtureReceipt: fixture }],
    ['smoke.first', {}],
    ['smoke.first', { fixtureReceipt: { ...fixture, company_code: 'C001' } }],
    ['smoke.first', { fixtureReceipt: { ...fixture, url: 'https://public.example' } }],
    ['smoke.first', { fixtureReceipt: { ...fixture, extra: true } }],
    ['smoke.first', { fixtureReceipt: fixture, release: { launchEnabled: 1 } }],
    ['smoke.first', { fixtureReceipt: fixture, release: { launchEnabled: true, actor: 'other' } }],
  ])
    assert.throws(() => materializeFoundationAcceptanceCase(bindings, transport, id, options));
});

test('source-count bounds remain tied to the current finite acyclic graph operations and child calls', () => {
  const graphs = buildFoundationGatewayWorkflows(bindings, transport);
  const get = (key) => graphs.find((g) => g.key === key);
  const inventory = (key) =>
    Object.fromEntries(
      [
        ...get(key)
          .workflow.nodes.filter((n) => n.name.startsWith('Prepare gateway · '))
          .reduce((counts, n) => {
            const operation = /operation:"([a-z.]+)"/.exec(n.parameters.jsCode)?.[1];
            assert.ok(operation, n.name);
            counts.set(operation, (counts.get(operation) ?? 0) + 1);
            return counts;
          }, new Map())
          .entries(),
      ].sort(),
    );
  assert.deepEqual(inventory('WF-91'), { 'fees.accrue': 1, 'health.guard': 1, 'health.read': 1 });
  assert.deepEqual(inventory('WF-99'), { 'launch.authorize': 1, 'launch.read': 2, 'launch.reconcile': 1 });
  assert.deepEqual(inventory('WF-19'), {
    'apify.completion.read': 1,
    'apify.dataset.read': 1,
    'apify.process': 1,
    'apify.read': 1,
    'apify.terminal.read': 2,
    'callback.reject': 1,
  });
  assert.deepEqual(inventory('SUB-START'), { 'run.start': 1 });
  assert.deepEqual(inventory('SUB-FINISH'), { 'run.finish': 1 });
  assert.deepEqual(inventory('SUB-NOTIFY'), { 'error.log': 1 });
  const children = (key) =>
    get(key).workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow').length;
  assert.equal(children('WF-91'), 6);
  assert.equal(children('WF-19'), 1);
  assert.equal(children('SUB-FINISH'), 2);
  assert.equal(children('WF-99'), 2);
  for (const graph of graphs) {
    const visited = new Set(),
      pending = new Set();
    const walk = (name) => {
      assert.equal(pending.has(name), false, graph.key + ' contains a graph cycle');
      if (visited.has(name)) return;
      pending.add(name);
      for (const branches of Object.values(graph.workflow.connections[name] ?? {}))
        for (const branch of branches) for (const edge of branch) walk(edge.node);
      pending.delete(name);
      visited.add(name);
    };
    for (const n of graph.workflow.nodes) walk(n.name);
    for (const n of graph.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest'))
      assert.equal(n.retryOnFail, false);
  }
});
