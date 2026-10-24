import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  foundationWorkflowNames,
  foundationTagNames,
  nativeFoundationTagName,
} from '../../packages/shared/src/n8n-bindings.ts';
import { buildFoundationGatewayWorkflows, compileFoundationGateway } from './build-foundation-gateway.mjs';
import { nodeId } from './build-foundation.mjs';

export const syntheticFoundationBindings = () => ({
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: Object.fromEntries(
    Object.entries(foundationWorkflowNames).map(([key, name], i) => [
      key,
      { id: `SyntheticFoundation${i}`, name },
    ]),
  ),
  tagRefs: Object.fromEntries(
    foundationTagNames.map((name, i) => [
      name,
      { id: `SyntheticFoundationTag${i}`, name: nativeFoundationTagName(name) },
    ]),
  ),
  credentials: {
    postgres: {
      id: 'SyntheticWriter',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
    apify: { id: 'SyntheticApify', name: 'Existing native Apify', type: 'apifyApi', environment: 'dev' },
  },
});
export const syntheticFoundationTransport = () => ({
  audience: 'https://everyone-market-researcher-synthetic.vercel.app',
  windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  credential: {
    id: 'SyntheticFoundationMachine',
    name: 'M03 foundation machine [dev]',
    type: 'httpCustomAuth',
  },
});
const executeCode = (n, rows, named = {}) =>
  JSON.parse(
    JSON.stringify(
      runInNewContext(`(function(){${n.parameters.jsCode}\n})()`, {
        require: awaitImportCrypto,
        $execution: { id: 'SyntheticExecution19' },
        $input: { all: () => rows },
        $: (name) => ({ first: () => ({ json: named[name] }) }),
      }),
    ),
  );
import { createHash } from 'node:crypto';
const awaitImportCrypto = (name) => {
  assert.equal(name, 'crypto');
  return { createHash };
};

test('all foundation database calls compile to fixed HTTPS operations with no SQL or native fallback', () => {
  const graphs = buildFoundationGatewayWorkflows(
    syntheticFoundationBindings(),
    syntheticFoundationTransport(),
  );
  assert.equal(graphs.length, 25);
  for (const graph of graphs) {
    assert.equal(graph.workflow.active, false);
    assert.equal(graph.hostedAcceptance, false);
    assert.ok(!graph.workflow.nodes.some((n) => n.type === 'n8n-nodes-base.postgres'));
    assert.doesNotMatch(JSON.stringify(graph.workflow), /select ops\.|queryReplacement|SyntheticWriter/);
    const s = graph.workflow.settings;
    assert.equal(s.saveDataErrorExecution, 'none');
    assert.equal(s.saveDataSuccessExecution, 'none');
    assert.equal(s.saveManualExecutions, false);
    assert.equal(s.saveExecutionProgress, false);
    for (const n of graph.workflow.nodes.filter(
      (n) => n.type === 'n8n-nodes-base.httpRequest' && n.parameters.method === 'POST',
    )) {
      assert.equal(n.retryOnFail, false);
      assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
      assert.equal(n.parameters.options.allowUnauthorizedCerts, false);
      if (n.parameters.url.includes('api.apify.com')) {
        assert.equal(n.disabled, true);
        continue;
      }
      assert.equal(
        n.parameters.url,
        syntheticFoundationTransport().audience + '/api/internal/n8n/foundation',
      );
    }
  }
});

test('native save normalization preserves the pinned Webhook and Wait routing IDs', () => {
  const build = () =>
    buildFoundationGatewayWorkflows(syntheticFoundationBindings(), syntheticFoundationTransport());
  const graphs = build();
  const routed = graphs.flatMap((graph) =>
    graph.workflow.nodes
      .filter((n) => ['n8n-nodes-base.webhook', 'n8n-nodes-base.wait'].includes(n.type))
      .map((n) => ({ key: graph.key, node: n })),
  );
  assert.equal(routed.length, 2);
  assert.deepEqual(
    new Set(routed.map(({ node }) => node.type)),
    new Set(['n8n-nodes-base.webhook', 'n8n-nodes-base.wait']),
  );
  for (const { key, node } of routed) {
    assert.equal(node.webhookId, nodeId(key, 'Webhook routing: ' + node.name));
    const nativeSaved = structuredClone(node);
    // Pinned n8n 2.43.5 resolveNodeWebhookId only injects an ID when absent,
    // including Wait's timeInterval mode because its type declares webhooks.
    if (!nativeSaved.webhookId) nativeSaved.webhookId = 'NATIVE_RANDOM_ID_MUST_NOT_APPEAR';
    assert.deepEqual(nativeSaved, node);
  }
  const again = build().flatMap((g) => g.workflow.nodes.filter((n) => n.webhookId).map((n) => n.webhookId));
  assert.deepEqual(
    again,
    routed.map(({ node }) => node.webhookId),
  );
  assert.equal(new Set(again).size, 2);
  const callback = routed.find(({ node }) => node.type === 'n8n-nodes-base.webhook').node;
  assert.equal(callback.parameters.path, 'emr-apify-callback');
  assert.equal(callback.parameters.authentication, 'none');
});
test('fifth known window compiles only the bounded dev gateway transport', () => {
  const windowId = '4c602549-2c42-4ec3-9328-714d7cb66a77';
  const graphs = buildFoundationGatewayWorkflows(syntheticFoundationBindings(), {
    ...syntheticFoundationTransport(),
    windowId,
  });
  assert.equal(graphs.length, 25);
  assert.equal(JSON.stringify(graphs).includes(windowId), true);
  assert.throws(
    () =>
      buildFoundationGatewayWorkflows(syntheticFoundationBindings(), {
        ...syntheticFoundationTransport(),
        windowId: '11111111-1111-4111-8111-111111111111',
      }),
    /FOUNDATION_TRANSPORT_INVALID/,
  );
});

test('sixth known window compiles only the bounded dev gateway transport', () => {
  const windowId = 'edbc6d11-7c1f-43a7-b745-1ded06deb29f';
  const graphs = buildFoundationGatewayWorkflows(syntheticFoundationBindings(), {
    ...syntheticFoundationTransport(),
    windowId,
  });
  assert.equal(graphs.length, 25);
  assert.equal(JSON.stringify(graphs).includes(windowId), true);
  assert.throws(
    () =>
      buildFoundationGatewayWorkflows(syntheticFoundationBindings(), {
        ...syntheticFoundationTransport(),
        windowId: '11111111-1111-4111-8111-111111111111',
      }),
    /FOUNDATION_TRANSPORT_INVALID/,
  );
});

test('closed GW01 window and removed credentials cannot be substituted for the new foundation profile', () => {
  for (const change of [
    { windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780' },
    { audience: 'https://evil.invalid' },
    { credential: { id: 'EmrGw01Machine18', name: 'M03 GW-01 machine [dev]', type: 'httpCustomAuth' } },
  ]) {
    assert.throws(
      () =>
        buildFoundationGatewayWorkflows(syntheticFoundationBindings(), {
          ...syntheticFoundationTransport(),
          ...change,
        }),
      /FOUNDATION_TRANSPORT_INVALID/,
    );
  }
});
test('unknown SQL source cannot be compiled into a generic RPC or silent native Postgres path', () => {
  assert.throws(
    () =>
      compileFoundationGateway(
        {
          key: 'WF-99',
          workflow: {
            nodes: [
              {
                name: 'unexpected',
                type: 'n8n-nodes-base.postgres',
                parameters: { query: 'select secret();' },
              },
            ],
            connections: {},
            settings: {},
          },
        },
        syntheticFoundationTransport(),
      ),
    /FOUNDATION_OPERATION_UNMAPPED/,
  );
});
test('stable business and status IDs survive the same native execution and discard raw response errors', () => {
  const g = buildFoundationGatewayWorkflows(
    syntheticFoundationBindings(),
    syntheticFoundationTransport(),
  ).find((g) => g.key === 'SUB-COST');
  const prep = g.workflow.nodes.find((n) => n.name === 'Prepare gateway · Log costs');
  const rows = [{ json: { params: ['[]'] } }];
  const first = executeCode(prep, rows),
    again = executeCode(prep, rows);
  assert.deepEqual(first, again);
  assert.notEqual(first[0].json.request.requestId, first[0].json.statusRequest.requestId);
  assert.equal(first[0].json.request.operation, 'cost.log');
  assert.deepEqual(first[0].json.request.args, { entries: [] });
  const observe = g.workflow.nodes.find((n) => n.name === 'Observe gateway · Log costs');
  const unknown = executeCode(observe, [{ json: { error: { message: 'unrelated-private-value' } } }], {
    [prep.name]: first[0].json,
  });
  assert.doesNotMatch(JSON.stringify(unknown), /unrelated-private-value/);
  assert.equal(unknown[0].json.observed, false);
  assert.deepEqual(unknown[0].json.statusRequest, first[0].json.statusRequest);
});
