import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { foundationWorkflowNames, foundationTagNames } from '../../packages/shared/src/n8n-bindings.ts';
import { buildFoundationGatewayWorkflows } from './build-foundation-gateway.mjs';
const bindings = {
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: Object.fromEntries(
    Object.entries(foundationWorkflowNames).map(([key, name], i) => [
      key,
      { id: 'SyntheticComplete' + i, name },
    ]),
  ),
  tagRefs: Object.fromEntries(
    foundationTagNames.map((name, i) => [name, { id: 'SyntheticCompleteTag' + i, name }]),
  ),
  credentials: {
    postgres: {
      id: 'SyntheticWriter',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
    apify: {
      id: 'SyntheticExistingNativeApify',
      name: 'Apify account',
      type: 'apifyApi',
      environment: 'dev',
    },
  },
};
const transport = {
  audience: 'https://everyone-market-researcher-synthetic.vercel.app',
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  credential: {
    id: 'SyntheticFoundationMachine',
    name: 'M03 foundation machine [dev]',
    type: 'httpCustomAuth',
  },
};
const graphs = buildFoundationGatewayWorkflows(bindings, transport),
  callback = graphs.find((g) => g.key === 'WF-19'),
  smoke = graphs.find((g) => g.key === 'WF-99');
const run = (graph, name, input, named = {}) =>
  JSON.parse(
    JSON.stringify(
      runInNewContext(
        `(function(){${graph.workflow.nodes.find((n) => n.name === name).parameters.jsCode}\n})()`,
        {
          $execution: { id: 'SyntheticNative19' },
          $input: { all: () => [{ json: input }] },
          $: (name) => ({ first: () => ({ json: named[name] }) }),
          require: (name) => {
            assert.equal(name, 'crypto');
            return { createHash };
          },
        },
        { timeout: 1000 },
      ),
    ),
  );
const registry = {
  apify_run_id: 'Original1',
  actor_id: 'aYG0l9s7dbB7j3gbS',
  run_id: '01111111-1111-4111-8111-111111111111',
  account_ids: ['02222222-2222-4222-8222-222222222222'],
  purpose: 'daily',
  processed_at: null,
};
const terminal = {
  apifyRunId: 'Original1',
  parentRunId: registry.run_id,
  accountId: registry.account_ids[0],
  actorId: 'aYG0l9s7dbB7j3gbS',
  wireStatus: 'SUCCEEDED',
  status: 'SUCCEEDED',
  datasetId: 'Dataset1',
  usageTotalUsd: 0.01,
  finishedAt: '2026-10-19T00:00:00Z',
};
test('twenty-five final graphs have complete unique node references, retention off and no Cloud URL global', () => {
  for (const g of graphs) {
    const names = new Set(g.workflow.nodes.map((n) => n.name));
    assert.equal(names.size, g.workflow.nodes.length, g.key);
    for (const n of g.workflow.nodes) {
      assert.match(n.id, /^[a-f0-9-]{36}$/);
      if (n.type === 'n8n-nodes-base.code')
        assert.doesNotMatch(
          n.parameters.jsCode,
          /new URL\(|require\(['"](?:https?|node:https?|url|node:url)['"]\)/,
        );
    }
    for (const c of Object.values(g.workflow.connections))
      for (const output of c.main ?? [])
        for (const e of output) assert.ok(names.has(e.node), g.key + ':' + e.node);
  }
  assert.equal(graphs.length, 25);
  assert.equal(callback.runnableWorkflow, true);
  assert.equal(smoke.runnableWorkflow, true);
});
test('unknown and mismatched registration callback context route to the exact rejection audit with safe metadata only', () => {
  for (const [raw, reason] of [
    [null, 'unregistered'],
    [{ ...registry, apify_run_id: 'Different' }, 'registry_mismatch'],
  ]) {
    const result = run(
      callback,
      'Bind registered context',
      { registered: raw },
      { 'Validate callback source': { apify_run_id: 'Original1', transport: 'webhook' } },
    )[0].json;
    assert.equal(result.accepted, false);
    assert.equal(result.reason, reason);
    const rejection = run(callback, 'Prepare callback rejection', result)[0].json;
    assert.deepEqual(rejection.params, ['SyntheticNative19', 'Original1', reason]);
    assert.doesNotMatch(JSON.stringify(rejection), /groups|cost|items|email|token/);
  }
  assert.ok(callback.gatewayOperations.includes('callback.reject'));
  assert.equal(
    callback.workflow.nodes.find((n) => n.name === 'Respond rejected').parameters.options.responseCode,
    403,
  );
});
test('unconfirmed authenticated metadata and altered actor context cannot reach ingestion', () => {
  const named = { 'Bind registered context': { registry, transport: 'webhook' } };
  assert.equal(
    run(callback, 'Project first terminal', { unconfirmed: true }, named)[0].json.reason,
    'metadata_unavailable',
  );
  assert.equal(
    run(callback, 'Project first terminal', { terminal: { ...terminal, actorId: 'WrongActor' } }, named)[0]
      .json.reason,
    'actor_mismatch',
  );
  const valid = run(callback, 'Project first terminal', { terminal }, named)[0].json;
  assert.equal(valid.accepted, true);
  const stable = run(
    callback,
    'Verify stable terminal',
    { terminal: { ...terminal, usageTotalUsd: 0.02 } },
    { 'Project first terminal': { ...valid, observed_at_ms: Date.now() - 10001 } },
  )[0].json;
  assert.equal(stable.accepted, false);
  assert.equal(stable.reason, 'unsettled');
});
test('only the bounded reader result matching settled registered metadata normalizes the exact Everyone page', () => {
  const input = {
    terminal,
    rows: [
      {
        url: 'https://everyone.film/about-everyone',
        markdown: 'Public title',
        metadata: { title: 'Everyone' },
      },
    ],
    transport: { runBytesMax: 65536, datasetBytesMax: 262144, requests: 2, retries: 0, socketsClosed: true },
  };
  const named = {
    'Verify stable terminal': {
      registry,
      transport: 'webhook',
      terminal,
      observed_at_ms: Date.now() - 10001,
    },
  };
  const normalized = run(callback, 'Normalize exact public page', input, named)[0].json;
  assert.equal(normalized.accepted, true);
  assert.equal(normalized.payload.p_groups[0].items.length, 1);
  for (const changed of [
    { ...input, terminal: { ...terminal, datasetId: 'WrongDataset' } },
    { ...input, transport: { ...input.transport, datasetBytesMax: 999999 } },
    { ...input, rows: [{ ...input.rows[0], url: 'https://unrelated.invalid/' }] },
  ])
    assert.equal(
      run(callback, 'Normalize exact public page', changed, named)[0].json.reason,
      'unsupported_input',
    );
});
test('an ambiguous atomic acknowledgement falls through to original registry readback, never a blind rewrite', () => {
  assert.deepEqual(run(callback, 'Persist atomic callback', { error: { message: 'private raw failure' } }), [
    { json: { receipt: null } },
  ]);
  const next = callback.workflow.connections['Persist atomic callback'].main[0][0].node;
  assert.equal(next, 'Validate atomic response');
  assert.ok(callback.workflow.nodes.some((n) => n.name === 'Read saved completion and pending'));
});
test('smoke source is a functional exact async actor launch with two independent disabled controls and no retries', () => {
  const post = smoke.workflow.nodes.find((n) => n.name === 'Start exact actor once (disabled)');
  assert.equal(post.disabled, true);
  assert.equal(post.retryOnFail, false);
  assert.equal(post.parameters.authentication, 'predefinedCredentialType');
  assert.equal(post.parameters.nodeCredentialType, 'apifyApi');
  const query = Object.fromEntries(post.parameters.queryParameters.parameters.map((v) => [v.name, v.value]));
  assert.equal(query.waitForFinish, '0');
  assert.equal(query.restartOnError, 'false');
  assert.equal(query.build, '0.3.99');
  assert.equal(query.memory, '1024');
  assert.equal(query.timeout, '300');
  assert.equal(query.maxTotalChargeUsd, '1');
  const prepared = run(smoke, 'Validate smoke action', {
    action: 'launch',
    launch_id: registry.run_id,
    account_id: registry.account_ids[0],
    env: 'dev',
  })[0].json;
  assert.equal(prepared.launchEnabled, false);
  assert.equal(smoke.launchAvailable, true);
  assert.equal(smoke.launchEnabled, false);
  assert.ok(smoke.gatewayOperations.includes('launch.authorize'));
  assert.ok(smoke.gatewayOperations.includes('launch.reconcile'));
  assert.equal(smoke.actor.input.maxCrawlDepth, 0);
  assert.equal(smoke.actor.input.maxCrawlPages, 1);
  assert.equal(smoke.actor.input.maxRequestRetries, 0);
  assert.equal(smoke.actor.input.maxSessionRotations, 0);
  assert.equal(smoke.actor.input.summarize, false);
  assert.equal(smoke.actor.input.saveFiles, false);
  assert.doesNotMatch(post.parameters.url, /run-sync/);
});
test('lost actor acknowledgement retains admission and forbids replacing the original actor', () => {
  const value = run(
    smoke,
    'Retain original launch identifier',
    { statusCode: 504, error: { message: 'unrelated private value' } },
    { 'Validate first launch authorization': { launch: { launch_id: registry.run_id } } },
  )[0].json;
  assert.equal(value.originalKnown, false);
  assert.equal(value.automaticRetry, false);
  assert.equal(value.reconciliationRequired, true);
  assert.doesNotMatch(JSON.stringify(value), /unrelated private value/);
});
test('gateway durable readback rejects cross-operation, unconfirmed, closed and expired receipts', () => {
  const g = graphs.find((g) => g.key === 'SUB-COST'),
    prep = 'Observe gateway · Log costs';
  const context = {
    request: { requestId: '01111111-1111-4111-8111-111111111111', operation: 'cost.log' },
    statusRequest: { requestId: '02222222-2222-4222-8222-222222222222' },
    observed: false,
  };
  const b = {
    version: 1,
    requestId: context.statusRequest.requestId,
    operation: 'cost.log',
    outcome: 'completed',
    replayed: true,
    result: { inserted: 0 },
    window: {
      id: transport.windowId,
      boundAudience: transport.audience,
      closed: false,
      totalAdmitted: 2,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    },
  };
  assert.deepEqual(run(g, 'Log costs', { statusCode: 200, body: b }, { [prep]: context }), [
    { json: { inserted: 0 } },
  ]);
  for (const changed of [
    { ...b, operation: 'run.start' },
    { ...b, replayed: false },
    { ...b, window: { ...b.window, closed: true } },
    { ...b, window: { ...b.window, expiresAt: new Date(Date.now() - 1).toISOString() } },
  ])
    assert.throws(
      () => run(g, 'Log costs', { statusCode: 200, body: changed }, { [prep]: context }),
      /UNCONFIRMED/,
    );
});
test('known actual cost replay accepts only four safe attribution fields and rejects generic or invented costs', () => {
  const g = graphs.find((g) => g.key === 'SUB-COST');
  const entry = {
    provider: 'apify',
    category: 'scrape',
    quantity: 1,
    unit: 'result',
    cost_usd: 0.01,
    run_id: registry.run_id,
    competitor_id: '03333333-3333-4333-8333-333333333333',
    platform: 'website_work_page',
    meta: {
      actor: 'apify/website-content-crawler',
      apify_run_id: 'Original1',
      account_id: registry.account_ids[0],
      cost_key: 'apify:Original1:' + registry.account_ids[0],
    },
  };
  assert.equal(
    JSON.parse(run(g, 'Prepare costs', { entries: [entry], env: 'dev' })[0].json.params[0])[0].meta
      .apify_run_id,
    'Original1',
  );
  for (const changed of [
    { ...entry, provider: 'openai' },
    { ...entry, meta: { cost_key: entry.meta.cost_key } },
    { ...entry, meta: { ...entry.meta, cost_key: 'different' } },
    { ...entry, meta: { ...entry.meta, private: 'extra' } },
  ])
    assert.throws(() => run(g, 'Prepare costs', { entries: [changed], env: 'dev' }), /COST_INVALID/);
});
test('a release graph can be reviewed locally but still has inactive workflows and requires first native authorization', () => {
  const released = buildFoundationGatewayWorkflows(bindings, transport, { launchEnabled: true }).find(
    (g) => g.key === 'WF-99',
  );
  assert.equal(released.workflow.active, false);
  assert.equal(
    released.workflow.nodes.find((n) => n.name === 'Start exact actor once (disabled)').disabled,
    false,
  );
  const value = run(released, 'Validate smoke action', {
    action: 'launch',
    launch_id: registry.run_id,
    account_id: registry.account_ids[0],
    env: 'dev',
  })[0].json;
  assert.equal(value.launchEnabled, true);
  const context = {
    request: { requestId: registry.run_id, operation: 'launch.authorize' },
    statusRequest: { requestId: registry.account_ids[0] },
    observed: false,
  };
  const result = { authorized: true, reason: 'first_post_only', launch: {} };
  const response = {
    statusCode: 200,
    body: {
      version: 1,
      requestId: context.statusRequest.requestId,
      operation: 'launch.authorize',
      outcome: 'completed',
      replayed: true,
      result,
      window: {
        id: transport.windowId,
        boundAudience: transport.audience,
        closed: false,
        totalAdmitted: 2,
        startsAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      },
    },
  };
  assert.throws(
    () =>
      run(released, 'Authorize exact actor launch', response, {
        'Observe gateway · Authorize exact actor launch': context,
      }),
    /RECONCILIATION_REQUIRED/,
  );
  const late = structuredClone(response);
  late.body.window.expiresAt = new Date(Date.now() + 120000).toISOString();
  assert.throws(
    () =>
      run(released, 'Authorize exact actor launch', late, {
        'Observe gateway · Authorize exact actor launch': {
          ...context,
          observed: true,
          observedResult: result,
        },
      }),
    /RECONCILIATION_REQUIRED/,
  );
});
