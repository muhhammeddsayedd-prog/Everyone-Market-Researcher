import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  prepareM06ProductionGuard,
  verifyM06ProductionGuardReceipt,
  buildNativeM06ProductionGuard,
  buildUnboundM06ProductionGuard,
} from './build-native-m06-production-guard.mjs';
const transport = {
  audience: 'https://everyone-market-researcher-local-guard.vercel.app',
  credential: { id: 'LocalGuardMachine', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
// Synthetic exact bytes including whitespace/nonASCII. This is not a provider
// capture or real webhook signature; HMAC checks happen at the actual route.
const raw = Buffer.from(
  '{ "id": "synthetic-event", "label": "أفلام", "payload": {"target":"production"} }\n',
);
const secret = 'synthetic-test-only';
const signature = createHmac('sha1', secret).update(raw).digest('hex');
const item = (bytes = raw, headers = {}) => ({
  json: {
    headers: {
      'x-vercel-signature': signature,
      'content-length': String(bytes.length),
      cookie: 'synthetic-not-forwarded',
      ...headers,
    },
    body: { parsed: true },
    query: { url: 'https://untrusted.invalid' },
  },
  binary: { data: { data: bytes.toString('base64'), mimeType: 'application/json' } },
});
const runCode = async (graph, name, input, read = async () => raw) => {
  const node = graph.nodes.find((n) => n.name === name);
  const fn = runInNewContext(
    '(async function(){' + node.parameters.jsCode + '})',
    { $input: { all: () => input } },
    { timeout: 1000 },
  );
  return fn.call({ helpers: { getBinaryDataBuffer: read } });
};

test('generated native guard forwards exact original binary bytes and only the required signature', async () => {
  const g = buildNativeM06ProductionGuard(transport).workflow;
  const webhook = g.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  assert.equal(webhook.typeVersion, 2.2);
  assert.equal(webhook.parameters.options.rawBody, true);
  assert.equal(webhook.parameters.path, 'emr-m06-production-guard');
  assert.equal(webhook.parameters.responseMode, 'responseNode');
  const incoming = item();
  let reads = 0;
  const rows = await runCode(g, 'Bound original signed event', [incoming], async (index, field) => {
    reads++;
    assert.equal(index, 0);
    assert.equal(field, 'data');
    return raw;
  });
  assert.equal(reads, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(rows[0].json)), { forward: true, signature });
  assert.equal(rows[0].binary.data, incoming.binary.data);
  const http = g.nodes.find((n) => n.type === 'n8n-nodes-base.httpRequest');
  assert.equal(http.typeVersion, 4.5);
  assert.equal(http.parameters.url, transport.audience + '/api/internal/m06/production-conflict');
  assert.equal(http.parameters.contentType, 'binaryData');
  assert.equal(http.parameters.inputDataFieldName, 'data');
  assert.equal(http.parameters.sendQuery, false);
  assert.equal(http.parameters.jsonBody, undefined);
  assert.equal(http.parameters.body, undefined);
  // Emulate exactly pinned HTTPRequest's inline-binary branch, not a new port.
  const actualBody = Buffer.from(rows[0].binary.data.data, 'base64');
  assert.equal(actualBody.equals(raw), true);
  assert.equal(createHmac('sha1', secret).update(actualBody).digest('hex'), rows[0].json.signature);
  assert.notEqual(
    createHmac('sha1', secret)
      .update(JSON.stringify(JSON.parse(raw.toString())))
      .digest('hex'),
    signature,
  );
  assert.deepEqual(
    http.parameters.headerParameters.parameters.map((h) => h.name),
    ['x-vercel-signature', 'content-type'],
  );
  assert.equal(http.credentials.httpCustomAuth.id, transport.credential.id);
  assert.equal(http.retryOnFail, false);
  assert.equal(http.parameters.options.allowUnauthorizedCerts, false);
  assert.equal(http.parameters.options.redirect.redirect.followRedirects, false);
  const confirmed = await runCode(g, 'Verify durable conflict result', [
    { json: { statusCode: 200, body: { accepted: true, production_conflict: true } } },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(confirmed)), [
    { json: { statusCode: 200, response: { accepted: true, production_conflict: true } } },
  ]);
});

test('malformed signature, missing raw bytes and declared oversized content reject before forwarding', async () => {
  for (const headers of [
    { 'x-vercel-signature': 'not-hex' },
    { 'x-vercel-signature': ['a'.repeat(40)] },
    { 'x-vercel-signature': 'a'.repeat(39) },
    { 'x-vercel-signature': 'A'.repeat(40) },
    { 'content-length': '32769' },
    { 'content-length': 'garbage' },
  ]) {
    let reads = 0;
    const rows = await prepareM06ProductionGuard([item(raw, headers)], async () => {
      reads++;
      return raw;
    });
    assert.equal(rows[0].json.statusCode, 403);
    assert.equal(rows[0].json.forward, false);
    assert.equal(rows[0].binary, undefined);
    assert.equal(reads, 0);
  }
  assert.equal(
    (await prepareM06ProductionGuard([{ json: item().json }], async () => raw))[0].json.forward,
    false,
  );
});

test('actual binary bound is enforced despite an incorrect Content-Length; helper errors disclose no diagnostics', async () => {
  for (const bytes of [Buffer.alloc(32769), Buffer.alloc(0)]) {
    const rows = await prepareM06ProductionGuard([item(bytes, { 'content-length': '1' })], async () => bytes);
    assert.equal(rows[0].json.statusCode, 403);
    assert.equal(rows[0].binary, undefined);
  }
  assert.equal(
    (await prepareM06ProductionGuard([item(Buffer.alloc(32768))], async () => Buffer.alloc(32768)))[0].json
      .forward,
    true,
  );
  const rejected = await prepareM06ProductionGuard([item()], async () => {
    throw Error('synthetic-private-platform-error');
  });
  assert.equal(JSON.stringify(rejected).includes('private-platform-error'), false);
  assert.equal(rejected[0].json.statusCode, 403);
});

test('cryptographic rejection or uncertain durable pause cannot produce a successful provider acknowledgment', () => {
  assert.equal(
    verifyM06ProductionGuardReceipt([{ json: { statusCode: 403, body: { rejected: true } } }])[0].json
      .statusCode,
    403,
  );
  for (const r of [
    { statusCode: 503, body: {} },
    { statusCode: 200, body: { accepted: true } },
    { statusCode: 200, body: { accepted: true, production_conflict: 'true' } },
    { statusCode: 200, body: { accepted: true, production_conflict: true, raw: 'not-allowed' } },
  ])
    assert.equal(verifyM06ProductionGuardReceipt([{ json: r }])[0].json.statusCode, 503);
  assert.equal(
    verifyM06ProductionGuardReceipt([
      { json: { statusCode: 200, body: { accepted: true, production_conflict: false } } },
    ])[0].json.statusCode,
    200,
  );
});

test('owned guard has no schedule/manual trigger/persisted executions and unbound export refuses before I/O', async () => {
  const ready = buildNativeM06ProductionGuard(transport).workflow;
  assert.equal(ready.active, false);
  assert.equal(ready.settings.executionTimeout, 30);
  assert.equal(
    ready.nodes.some((n) => /schedule|manual|executeWorkflowTrigger/i.test(n.type)),
    false,
  );
  assert.equal(ready.settings.saveDataSuccessExecution, 'none');
  assert.equal(ready.settings.saveDataErrorExecution, 'none');
  assert.equal(ready.settings.saveExecutionProgress, false);
  assert.equal(ready.settings.saveManualExecutions, false);
  assert.equal(ready.settings.availableInMCP, false);
  const d = buildUnboundM06ProductionGuard();
  assert.equal(d.bindingManifest.ready, false);
  await assert.rejects(runCode(d.workflow, 'Bound original signed event', [item()]), /BINDING_REQUIRED/);
  const saved = JSON.parse(
    readFileSync(new URL('../workflows/WF-M06-production-guard.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(saved, d);
});
