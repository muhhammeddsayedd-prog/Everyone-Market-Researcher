import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  buildNativeExtractor,
  buildUnboundNativeExtractor,
  initializeM07Extraction,
  advanceM07Gateway,
  advanceM07Provider,
} from './build-native-extractor.mjs';

const bindings = JSON.parse(
  readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
);
const transport = {
  audience: 'http://127.0.0.1:3037',
  credential: { id: 'SyntheticGateway', name: 'Controlled local only', type: 'httpCustomAuth' },
};
const graph = buildNativeExtractor(bindings, transport);
const named = (name) => graph.workflow.nodes.find((n) => n.name === name);
const item = '11111111-1111-4111-a111-111111111111';
const attempt = '22222222-2222-4222-a222-222222222222';
const provider = {
  model: 'controlled_fixture_model',
  store: false,
  stream: false,
  max_output_tokens: 2000,
  input: [
    { role: 'system', content: [{ type: 'input_text', text: 'fixture' }] },
    { role: 'user', content: [{ type: 'input_text', text: 'fixture' }] },
  ],
  text: { format: { type: 'json_schema', strict: true, schema: { type: 'object' } } },
};
const receipt = (state, result) => ({
  statusCode: 200,
  body: {
    version: 1,
    requestId: state.request.requestId,
    operation: state.request.operation,
    result: { request_hash: 'a'.repeat(64), ...result },
  },
});
const claim = (state, extra = {}) =>
  advanceM07Gateway(
    state,
    receipt(state, {
      owner_id: state.owner_id,
      messages: [
        {
          attempt_id: attempt,
          owner_id: state.owner_id,
          item_id: item,
          msg_id: 1,
          read_ct: 1,
          state: 'claimed',
          ...extra,
        },
      ],
    }),
  );
function admitted() {
  let s = claim(initializeM07Extraction({ env: 'dev' }, '73123'));
  s = advanceM07Gateway(
    s,
    receipt(s, {
      attempt_id: attempt,
      owner_id: s.owner_id,
      item_id: item,
      state: 'prepared',
      provider_request: provider,
    }),
  );
  return advanceM07Gateway(
    s,
    receipt(s, { attempt_id: attempt, state: 'dispatched', admitted: true, provider_request: provider }),
  );
}
function code(name, input, prepared, definition = graph) {
  return runInNewContext(
    '(function(){' + definition.workflow.nodes.find((n) => n.name === name).parameters.jsCode + '\n})()',
    {
      structuredClone,
      $input: { all: () => [{ json: structuredClone(input) }] },
      $execution: { id: '73123' },
      $: () => ({ item: { json: structuredClone(prepared) } }),
    },
    { timeout: 1000 },
  );
}

test('unbound export is inactive and blocks before any I/O', () => {
  const g = buildUnboundNativeExtractor(bindings);
  assert.equal(g.workflow.active, false);
  assert.equal(g.runnableWorkflow, false);
  assert.equal(g.bindingManifest.ready, false);
  assert.throws(() => code('Initialize local extraction', { env: 'dev' }, null, g), /M07_BINDING_REQUIRED/);
  const checked = JSON.parse(
    readFileSync(new URL('../workflows/WF-30-ai-extractor.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(checked, g);
});
test('graph uses supported pinned native nodes with one explicit text provider operation', () => {
  assert.equal(graph.workflow.settings.errorWorkflow, undefined);
  assert.equal(graph.workflow.settings.executionTimeout, 900);
  assert.equal(graph.workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(graph.workflow.settings.saveDataErrorExecution, 'none');
  assert.equal(graph.workflow.settings.availableInMCP, false);
  assert.equal(graph.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger').length, 0);
  const http = named('OpenAI Responses text extraction');
  assert.equal(http.typeVersion, 4.5);
  assert.equal(http.parameters.url, 'https://api.openai.com/v1/responses');
  assert.equal(http.parameters.authentication, 'predefinedCredentialType');
  assert.equal(http.parameters.nodeCredentialType, 'openAiApi');
  for (const n of graph.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest')) {
    assert.equal(n.retryOnFail, false);
    assert.equal(n.parameters.options.allowUnauthorizedCerts, false);
    assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
  }
  for (const n of graph.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code'))
    assert.doesNotMatch(n.parameters.jsCode, /require\(|from ['"]|process\.|OPENAI_API_KEY|sharp/);
});
test('transport is loopback only and missing bindings fail construction', () => {
  for (const audience of [
    'https://example.com',
    'http://127.0.0.1:3037/path',
    'http://user:secret@127.0.0.1:3037',
    'http://127.0.0.1:3037?x=1',
  ])
    assert.throws(
      () => buildNativeExtractor(bindings, { ...transport, audience }),
      /M07_LOCAL_TRANSPORT_REQUIRED/,
    );
  assert.throws(
    () =>
      buildNativeExtractor(bindings, {
        ...transport,
        credential: { ...transport.credential, type: 'postgres' },
      }),
    /M07_BINDING_REQUIRED/,
  );
});
test('serialized native Code constructs stable execution ownership and rejects arbitrary input', () => {
  const s = code('Initialize local extraction', { env: 'dev' })[0].json;
  assert.equal(s.request.operation, 'claim');
  assert.equal(s.request.args.limit, 1);
  assert.equal(s.owner_id, initializeM07Extraction({ env: 'dev' }, '73123').owner_id);
  assert.throws(() => code('Initialize local extraction', { env: 'prod' }), /M07_INPUT_INVALID/);
  assert.throws(
    () => code('Initialize local extraction', { env: 'dev', item_id: item }),
    /M07_INPUT_INVALID/,
  );
});
test('native transitions admit provider once then apply and acknowledge only saved result', () => {
  let s = admitted();
  assert.equal(s.action, 'provider');
  s = advanceM07Provider(s, { statusCode: 200, body: { id: 'resp_fixture' } });
  assert.equal(s.request.operation, 'settle');
  const applied = { ai_status: 'done', cost_usd: 0.0002 };
  s = advanceM07Gateway(s, receipt(s, { attempt_id: attempt, state: 'completed', result: applied }));
  assert.equal(s.request.operation, 'ack');
  const r = code('Advance extraction receipt', receipt(s, { attempt_id: attempt, acked: true }), s)[0].json;
  assert.equal(r.action, 'done');
  assert.equal(r.result.status, 'completed');
  assert.deepEqual(JSON.parse(JSON.stringify(r.result.result)), applied);
});
test('completed replay has no preparation or provider dispatch', () => {
  const s = claim(initializeM07Extraction({ env: 'dev' }, '73123'), {
    state: 'completed',
    acked: true,
    result: { ai_status: 'done' },
  });
  assert.equal(s.action, 'done');
  assert.equal(s.result.status, 'completed');
});
test('another owner held and reconciled deliveries never reach provider', () => {
  for (const state of ['held', 'reconciled']) {
    const s = claim(initializeM07Extraction({ env: 'dev' }, '73123'), {
      state,
      owner_id: '33333333-3333-4333-a333-333333333333',
    });
    assert.equal(s.action, 'done');
    assert.equal(s.result.status, state === 'held' ? 'held' : 'completed');
  }
});
test('uncertain provider transport is held, never retried or acknowledged', () => {
  let s = advanceM07Provider(admitted(), { statusCode: 500, body: { error: 'not retained' } });
  assert.equal(s.request.operation, 'outcome.unknown');
  assert.equal(s.provider_request, undefined);
  s = advanceM07Gateway(s, receipt(s, { attempt_id: attempt, state: 'unknown', result: null }));
  assert.equal(s.action, 'done');
  assert.equal(s.result.status, 'held');
});
test('uncertain apply checks same attempt once and acknowledges only terminal saved state', () => {
  let s = advanceM07Provider(admitted(), { statusCode: 200, body: { id: 'resp_fixture' } });
  s = advanceM07Gateway(s, { statusCode: 503 });
  assert.equal(s.request.operation, 'status');
  s = advanceM07Gateway(
    s,
    receipt(s, {
      attempt_id: attempt,
      owner_id: s.owner_id,
      state: 'completed',
      acked: false,
      result: { ai_status: 'done' },
    }),
  );
  assert.equal(s.request.operation, 'ack');
  s = advanceM07Gateway(s, { statusCode: 503 });
  assert.equal(s.action, 'done');
  assert.equal(s.result.status, 'held');
});

test('requires exact dev Preview metadata and immutable preparation/dispatch hash', () => {
  const dev = {
    ...transport,
    profile: 'dev',
    audience: 'https://everyone-market-researcher-controlled.vercel.app',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    branch: 'm07-ai-understanding',
    commitSha: 'a'.repeat(40),
    deploymentId: 'dpl_controlled',
  };
  assert.equal(buildNativeExtractor(bindings, dev).workflow.active, false);
  for (const change of [
    { branch: 'main' },
    { projectRef: 'hkiafqrcxaafdbcvjlzv' },
    { audience: 'https://unrelated.example.com' },
    { commitSha: 'invalid' },
  ])
    assert.throws(() => buildNativeExtractor(bindings, { ...dev, ...change }));
  let s = claim(initializeM07Extraction({ env: 'dev' }, '73123'));
  s = advanceM07Gateway(
    s,
    receipt(s, {
      attempt_id: attempt,
      owner_id: s.owner_id,
      item_id: item,
      state: 'prepared',
      provider_request: provider,
    }),
  );
  assert.throws(
    () =>
      advanceM07Gateway(
        s,
        receipt(s, {
          attempt_id: attempt,
          state: 'dispatched',
          admitted: true,
          request_hash: 'b'.repeat(64),
          provider_request: provider,
        }),
      ),
    /HASH_MISMATCH/,
  );
});
