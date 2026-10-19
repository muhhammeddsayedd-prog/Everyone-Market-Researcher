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
  assert.equal(p.cases.length, 23);
  assert.equal(p.recommendedLiveCaseIds.length, 19);
  assert.ok(!p.recommendedLiveCaseIds.includes('health.first'));
  assert.equal(p.executionAuthorized, false);
  assert.equal(p.sourceOnly, true);
  assert.deepEqual(p.publicationOrder[0].workflowKeys, ['SUB-NOTIFY']);
  assert.deepEqual(p.publicationOrder[1].workflowKeys, ['WF-90']);
  assert.equal(p.publicationOrder[2].deferredErrorLinks, 24);
  assert.equal(p.totalRecommendedUpperBounds.gatewayHttpAttempts, 110);
  assert.equal(p.totalRecommendedUpperBounds.nativeExecutions, 64);
  assert.equal(p.totalRecommendedUpperBounds.providerGetAttempts, 20);
  assert.equal(p.totalRecommendedUpperBounds.actorStarts, 2);
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
