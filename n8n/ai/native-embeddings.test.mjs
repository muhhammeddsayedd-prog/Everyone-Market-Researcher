import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  buildNativeEmbeddings,
  buildUnboundNativeEmbeddings,
  initializeM07Embeddings,
  advanceM07EmbeddingGateway,
  advanceM07EmbeddingProvider,
} from './build-native-embeddings.mjs';

const bindings = JSON.parse(
  readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
);
const transport = {
  audience: 'http://127.0.0.1:3037',
  credential: { id: 'SyntheticGateway', name: 'Controlled local only', type: 'httpCustomAuth' },
};
const graph = buildNativeEmbeddings(bindings, transport);
const batch = '11111111-1111-4111-a111-111111111111';
const requestHash = 'a'.repeat(64);
const provider = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  encoding_format: 'float',
  input: ['Controlled text.'],
};
const receipt = (s, result) => ({
  statusCode: 200,
  body: { version: 1, requestId: s.request.requestId, operation: s.request.operation, result },
});
const claim = (s, extra = {}) =>
  advanceM07EmbeddingGateway(
    s,
    receipt(s, {
      batch_id: batch,
      owner_id: s.owner_id,
      state: 'claimed',
      messages: [{ msg_id: 1, read_ct: 1 }],
      ...extra,
    }),
  );
const prepare = (s, extra = {}) =>
  advanceM07EmbeddingGateway(
    s,
    receipt(s, {
      batch_id: batch,
      owner_id: s.owner_id,
      state: 'prepared',
      snapshot: { provider_request: provider },
      request_hash: requestHash,
      ...extra,
    }),
  );
function admitted() {
  let s = prepare(claim(initializeM07Embeddings({ env: 'dev' }, '73301')));
  return advanceM07EmbeddingGateway(
    s,
    receipt(s, {
      batch_id: batch,
      owner_id: s.owner_id,
      state: 'dispatched',
      admitted: true,
      snapshot: { provider_request: provider },
      request_hash: requestHash,
    }),
  );
}
function code(name, input, prepared, definition = graph) {
  const source = definition.workflow.nodes.find((n) => n.name === name).parameters.jsCode;
  return runInNewContext(
    '(function(){' + source + '\n})()',
    {
      structuredClone,
      $input: { all: () => [{ json: structuredClone(input) }] },
      $execution: { id: '73301' },
      $: () => ({ item: { json: structuredClone(prepared) } }),
    },
    { timeout: 1000 },
  );
}

test('unbound export is inactive and fails missing bindings before any I/O', () => {
  const g = buildUnboundNativeEmbeddings(bindings);
  assert.equal(g.workflow.active, false);
  assert.equal(g.runnableWorkflow, false);
  assert.throws(() => code('Initialize embeddings', { env: 'dev' }, null, g), /M07_EMBED_BINDING_REQUIRED/);
  assert.deepEqual(
    g,
    JSON.parse(readFileSync(new URL('../workflows/WF-33-embeddings.json', import.meta.url), 'utf8')),
  );
});
test('graph preserves supported native types, predefined auth, strict TLS, privacy and no automatic paid retries', () => {
  const http = graph.workflow.nodes.find((n) => n.name === 'OpenAI embeddings');
  assert.equal(http.typeVersion, 4.5);
  assert.equal(http.parameters.url, 'https://api.openai.com/v1/embeddings');
  assert.equal(http.parameters.authentication, 'predefinedCredentialType');
  assert.equal(http.parameters.nodeCredentialType, 'openAiApi');
  assert.equal(graph.workflow.settings.executionTimeout, 900);
  assert.equal(graph.workflow.settings.errorWorkflow, undefined);
  assert.equal(graph.workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(graph.workflow.settings.saveDataErrorExecution, 'none');
  assert.equal(graph.workflow.settings.availableInMCP, false);
  assert.equal(
    graph.workflow.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger'),
    false,
  );
  for (const n of graph.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest')) {
    assert.equal(n.retryOnFail, false);
    assert.equal(n.parameters.options.allowUnauthorizedCerts, false);
    assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
  }
  for (const n of graph.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code'))
    assert.doesNotMatch(n.parameters.jsCode, /require\(|from ['"]|process\.|OPENAI_API_KEY|sharp/);
});
test('validates exact local/dev target bindings and rejects production or malformed audience metadata', () => {
  const dev = {
    ...transport,
    profile: 'dev',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    branch: 'm07-ai-understanding',
    commitSha: 'b'.repeat(40),
    deploymentId: 'dpl_fixture',
    audience: 'https://everyone-market-researcher-fixture.vercel.app',
  };
  assert.equal(buildNativeEmbeddings(bindings, dev).bindingManifest.profile, 'dev');
  for (const extra of [
    { projectRef: 'hkiafqrcxaafdbcvjlzv' },
    { branch: 'main' },
    { commitSha: 'bad' },
    { audience: 'https://example.com' },
    { profile: 'production' },
    { deploymentId: 'dpl_bad-scope' },
  ])
    assert.throws(() => buildNativeEmbeddings(bindings, { ...dev, ...extra }), /M07_EMBED_/);
  assert.throws(
    () => buildNativeEmbeddings(bindings, { ...transport, audience: 'http://127.0.0.1:3037/path' }),
    /M07_EMBED_/,
  );
});
test('serialized generated Code derives stable execution ownership without caller-selected configuration', () => {
  const s = code('Initialize embeddings', { env: 'dev' })[0].json;
  assert.equal(s.request.operation, 'claim');
  assert.deepEqual(Object.keys(s.request.args), ['owner_id']);
  assert.equal(s.owner_id, initializeM07Embeddings({ env: 'dev' }, '73301').owner_id);
  assert.throws(
    () => code('Initialize embeddings', { env: 'dev', model: 'caller' }),
    /M07_EMBED_INPUT_INVALID/,
  );
});
test('empty queue and foreign held batches terminate without another paid start', () => {
  const s = initializeM07Embeddings({ env: 'dev' }, '73301');
  assert.equal(
    advanceM07EmbeddingGateway(
      s,
      receipt(s, { batch_id: null, owner_id: s.owner_id, state: 'empty', messages: [] }),
    ).result.status,
    'empty',
  );
  assert.equal(
    claim(s, { state: 'held', owner_id: '22222222-2222-4222-a222-222222222222' }).result.status,
    'held',
  );
});
test('unchanged-only batch acknowledges durable skip outcome without provider I/O', () => {
  let s = claim(initializeM07Embeddings({ env: 'dev' }, '73301'));
  s = prepare(s, { state: 'completed', snapshot: null, result: { skipped: 1 } });
  assert.equal(s.request.operation, 'ack');
  s = advanceM07EmbeddingGateway(
    s,
    receipt(s, { batch_id: batch, owner_id: s.owner_id, state: 'completed', acked: true }),
  );
  assert.equal(s.result.status, 'completed');
});
test('one-shot admission uses frozen request and rejects hash drift', () => {
  const s = admitted();
  assert.equal(s.action, 'provider');
  assert.deepEqual(s.provider_request, provider);
  let before = prepare(claim(initializeM07Embeddings({ env: 'dev' }, '73301')));
  assert.throws(
    () =>
      advanceM07EmbeddingGateway(
        before,
        receipt(before, {
          batch_id: batch,
          owner_id: before.owner_id,
          state: 'dispatched',
          admitted: true,
          snapshot: { provider_request: provider },
          request_hash: 'b'.repeat(64),
        }),
      ),
    /M07_EMBED_SNAPSHOT_MISMATCH/,
  );
  const denied = advanceM07EmbeddingGateway(
    before,
    receipt(before, {
      batch_id: batch,
      owner_id: before.owner_id,
      state: 'dispatched',
      admitted: false,
      request_hash: requestHash,
    }),
  );
  assert.equal(denied.result.status, 'held');
});
test('generated provider response advances raw aggregate response to settlement then guarded ACK', () => {
  const s = admitted(),
    wire = { object: 'list', model: provider.model, data: [], usage: { prompt_tokens: 0, total_tokens: 0 } };
  let next = code('Advance embedding model receipt', { statusCode: 200, body: wire }, s)[0].json;
  assert.equal(next.request.operation, 'settle');
  assert.equal(next.request.args.provider_response.model, provider.model);
  next = code(
    'Advance embedding receipt',
    receipt(next, {
      batch_id: batch,
      owner_id: s.owner_id,
      state: 'completed',
      request_hash: requestHash,
      result: { cost_usd: 0 },
    }),
    next,
  )[0].json;
  assert.equal(next.request.operation, 'ack');
  next = advanceM07EmbeddingGateway(
    next,
    receipt(next, {
      batch_id: batch,
      owner_id: s.owner_id,
      state: 'completed',
      request_hash: requestHash,
      acked: true,
    }),
  );
  assert.equal(next.result.status, 'completed');
});
test('uncertain provider transport is held without retry or queue acknowledgment', () => {
  let s = advanceM07EmbeddingProvider(admitted(), { statusCode: 503, body: {} });
  assert.equal(s.request.operation, 'outcome.unknown');
  s = advanceM07EmbeddingGateway(
    s,
    receipt(s, {
      batch_id: batch,
      owner_id: s.owner_id,
      state: 'unknown',
      request_hash: requestHash,
      result: { usage_known: false, cost_usd: null },
    }),
  );
  assert.equal(s.result.status, 'held');
  assert.equal(s.action, 'done');
});
test('known failed settlement and its status reconciliation report failure without ACK or retry', () => {
  const pending = advanceM07EmbeddingProvider(admitted(), { statusCode: 200, body: { object: 'list' } });
  const failure = {
    batch_id: batch,
    owner_id: pending.owner_id,
    state: 'failed',
    request_hash: requestHash,
    result: { usage_known: true, cost_usd: 0.000002 },
  };
  let s = advanceM07EmbeddingGateway(pending, receipt(pending, failure));
  assert.equal(s.action, 'done');
  assert.equal(s.result.status, 'failed');
  s = advanceM07EmbeddingGateway(pending, { statusCode: 503, body: {} });
  assert.equal(s.request.operation, 'status');
  s = advanceM07EmbeddingGateway(s, receipt(s, failure));
  assert.equal(s.action, 'done');
  assert.equal(s.result.status, 'failed');
});
test('lost settlement checks original batch once and acknowledges only durable completion', () => {
  let s = advanceM07EmbeddingProvider(admitted(), { statusCode: 200, body: { object: 'list' } });
  s = advanceM07EmbeddingGateway(s, { statusCode: 503, body: {} });
  assert.equal(s.request.operation, 'status');
  s = advanceM07EmbeddingGateway(
    s,
    receipt(s, {
      batch_id: batch,
      owner_id: s.owner_id,
      state: 'completed',
      request_hash: requestHash,
      acked: false,
      result: { settled: true },
    }),
  );
  assert.equal(s.request.operation, 'ack');
  assert.equal(s.reconciled, true);
});
