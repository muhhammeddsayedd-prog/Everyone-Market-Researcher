import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildNativeMedia, buildUnboundNativeMedia, parseMediaTransport } from './build-native-media.mjs';

const transport = {
  audience: 'https://everyone-market-researcher-media-synthetic.vercel.app',
  credential: {
    id: 'SyntheticMediaCredential',
    name: 'Synthetic media only',
    type: 'httpCustomAuth',
    environment: 'dev',
  },
};
const executionId = '73123';
const named = (definition, name) => definition.workflow.nodes.find((n) => n.name === name);
function code(definition, name, json = {}, id = executionId, prepared) {
  return runInNewContext(
    '(function(){' + named(definition, name).parameters.jsCode + '\n})()',
    {
      $input: { all: () => [{ json: structuredClone(json) }] },
      $execution: { id },
      $: () => ({ first: () => ({ json: structuredClone(prepared) }) }),
      URL: undefined,
      require: undefined,
      process: undefined,
      console: undefined,
    },
    { timeout: 1000 },
  );
}
const receipt = (overrides = {}) => ({
  version: 1,
  execution_id: executionId,
  replayed: false,
  state: 'completed',
  claimed: 1,
  processed: 1,
  held: 0,
  stored: 1,
  skipped: 0,
  expired: 0,
  retryable: 0,
  reconciliation_required: 0,
  bytes: 18000,
  infrastructure_cost_usd: null,
  ...overrides,
});

test('missing media binding fails before the only HTTP node is reached', () => {
  const graph = buildUnboundNativeMedia();
  assert.equal(graph.workflow.active, false);
  assert.equal(graph.bindingManifest.ready, false);
  assert.throws(() => code(graph, 'Validate media binding'), /M06_MEDIA_BINDING_REQUIRED/);
});
test('builder accepts only an exact dev Preview and scoped combined credential reference', () => {
  assert.deepEqual(parseMediaTransport(transport), transport);
  for (const change of [
    { audience: 'http://everyone-market-researcher-dev.vercel.app' },
    { audience: 'https://unrelated.vercel.app' },
    { audience: transport.audience + '/path' },
    { audience: transport.audience + '?token=never' },
    { audience: 'https://user:secret@everyone-market-researcher-dev.vercel.app' },
    { credential: { ...transport.credential, type: 'postgres' } },
    { credential: { ...transport.credential, environment: 'prod' } },
    { credential: { ...transport.credential, id: '' } },
    { credential: { ...transport.credential, id: 123 } },
    { credential: { ...transport.credential, password: 'never' } },
  ])
    assert.throws(() => buildNativeMedia({ ...transport, ...change }), /M06_MEDIA_BINDING_INVALID/);
});
test('generated workflow uses supported pinned nodes and Vercel Node image processing', () => {
  const graph = buildNativeMedia(transport),
    workflow = graph.workflow;
  assert.equal(workflow.active, false);
  assert.equal(workflow.settings.executionTimeout, 300);
  assert.equal(workflow.settings.callerPolicy, 'workflowsFromSameOwner');
  assert.equal(workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(workflow.settings.saveDataErrorExecution, 'none');
  assert.equal(workflow.settings.saveExecutionProgress, false);
  assert.equal(workflow.settings.saveManualExecutions, false);
  assert.equal(workflow.settings.errorWorkflow, undefined);
  assert.equal(workflow.settings.availableInMCP, false);
  assert.deepEqual(named(graph, 'When called').parameters, { inputSource: 'passthrough' });
  assert.notEqual(named(graph, 'When called').disabled, true);
  assert.equal(workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger').length, 0);
  assert.deepEqual(
    workflow.nodes.map((n) => [n.type, n.typeVersion]),
    [
      ['n8n-nodes-base.manualTrigger', 1],
      ['n8n-nodes-base.executeWorkflowTrigger', 1.3],
      ['n8n-nodes-base.code', 2],
      ['n8n-nodes-base.httpRequest', 4.5],
      ['n8n-nodes-base.code', 2],
    ],
  );
  const http = named(graph, 'Process media batch');
  assert.equal(http.parameters.method, 'POST');
  assert.equal(http.parameters.genericAuthType, transport.credential.type);
  assert.equal(http.credentials.httpCustomAuth.id, transport.credential.id);
  assert.equal(http.parameters.options.allowUnauthorizedCerts, false);
  assert.equal(http.parameters.options.redirect.redirect.followRedirects, false);
  assert.equal(http.parameters.options.sendCredentialsOnCrossOriginRedirect, false);
  assert.equal(http.parameters.options.timeout, 270000);
  assert.equal(http.retryOnFail, false);
  for (const n of workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code'))
    assert.doesNotMatch(
      n.parameters.jsCode,
      /require\s*\(|import\s|sharp\s*\(|zod|SUPABASE_SECRET_KEY|process\.env/,
    );
});
test('both inactive entry paths connect through preflight, HTTP and receipt validation', () => {
  const workflow = buildNativeMedia(transport).workflow;
  for (const entry of ['Manual dev check', 'When called'])
    assert.equal(workflow.connections[entry].main[0][0].node, 'Validate media binding');
  assert.equal(workflow.connections['Validate media binding'].main[0][0].node, 'Process media batch');
  assert.equal(workflow.connections['Process media batch'].main[0][0].node, 'Verify media receipt');
});
test('generated preflight fixes endpoint and native execution identity, ignoring no caller choices', () => {
  const graph = buildNativeMedia(transport),
    prepared = code(graph, 'Validate media binding')[0].json;
  assert.deepEqual(JSON.parse(JSON.stringify(prepared)), {
    execution_id: executionId,
    url: transport.audience + '/api/internal/media/process',
    body: { execution_id: executionId },
  });
  for (const input of [
    { item_ids: ['foreign'] },
    { url: 'https://private.invalid' },
    { execution_id: 'other' },
    { env: 'prod' },
  ])
    assert.throws(() => code(graph, 'Validate media binding', input), /M06_MEDIA_INPUT_INVALID/);
  for (const id of ['', '01', '../1', 'abc', '123456789012345678901', 42, null])
    assert.throws(() => code(graph, 'Validate media binding', {}, id), /M06_MEDIA_EXECUTION_INVALID/);
});
test('generated HTTP expressions send only the preflight endpoint and body', () => {
  const graph = buildNativeMedia(transport),
    prepared = code(graph, 'Validate media binding')[0].json,
    http = named(graph, 'Process media batch');
  const expression = (value) =>
    runInNewContext('(' + value.slice(3, -2) + ')', { $json: prepared }, { timeout: 1000 });
  assert.equal(expression(http.parameters.url), prepared.url);
  assert.deepEqual(JSON.parse(JSON.stringify(expression(http.parameters.jsonBody))), {
    execution_id: executionId,
  });
});
test('successful and completed replay receipts are validated and safely projected', () => {
  const graph = buildNativeMedia(transport),
    prepared = code(graph, 'Validate media binding')[0].json;
  for (const replayed of [false, true]) {
    const rows = code(
      graph,
      'Verify media receipt',
      { statusCode: 200, body: receipt({ replayed }) },
      executionId,
      prepared,
    );
    assert.equal(rows[0].json.execution_id, executionId);
    assert.equal(rows[0].json.replayed, replayed);
    assert.equal(rows[0].json.infrastructure_cost_usd, null);
    assert.equal(rows[0].json.bytes, 18000);
  }
});
test('mismatched receipt identity, status, fields and cost cannot become workflow success', () => {
  const graph = buildNativeMedia(transport),
    prepared = code(graph, 'Validate media binding')[0].json;
  for (const response of [
    { statusCode: 409, body: receipt() },
    { statusCode: 200, body: receipt({ execution_id: '99123' }) },
    { statusCode: 200, body: receipt({ infrastructure_cost_usd: 0 }) },
    { statusCode: 200, body: receipt({ state: 'reconciliation_required' }) },
    { statusCode: 200, body: receipt({ signedUrl: 'https://never.invalid' }) },
    { statusCode: 200, body: receipt({ claimed: 0 }) },
    { statusCode: 200, body: receipt({ replayed: 'true' }) },
  ])
    assert.throws(() => code(graph, 'Verify media receipt', response, executionId, prepared), /M06_MEDIA_/);
});
test('partial and empty native results stay honest without retrying a batch', () => {
  const graph = buildNativeMedia(transport),
    prepared = code(graph, 'Validate media binding')[0].json;
  const partial = code(
    graph,
    'Verify media receipt',
    { statusCode: 200, body: receipt({ state: 'partial', stored: 0, retryable: 1, bytes: 0 }) },
    executionId,
    prepared,
  );
  assert.equal(partial[0].json.state, 'partial');
  const empty = code(
    graph,
    'Verify media receipt',
    { statusCode: 200, body: receipt({ claimed: 0, processed: 0, stored: 0, bytes: 0 }) },
    executionId,
    prepared,
  );
  assert.equal(empty[0].json.claimed, 0);
});
test('checked-in definition is generated, inactive and explicitly unbound rather than claimed as a Cloud save', () => {
  const checked = JSON.parse(readFileSync(new URL('../workflows/WF-31-media.json', import.meta.url), 'utf8'));
  assert.deepEqual(checked, buildUnboundNativeMedia());
  assert.equal(checked.hostedAcceptance, false);
  assert.equal(checked.nativeSaved, false);
  assert.equal(checked.bindingManifest.ready, false);
  assert.equal(checked.bindingManifest.imageRuntime, 'vercel-node-sharp');
});
