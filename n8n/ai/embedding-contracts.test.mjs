import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  embeddingDimensions,
  inputContractVersion,
  validateEmbeddingRequest,
  validateEmbeddingSnapshot,
  parseEmbeddingResponse,
  embeddingCost,
} from './embedding-contracts.mjs';

const model = 'text-embedding-3-small';
const text = 'Controlled public campaign summary.';
const hash = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const mapping = (index, content = text) => ({
  index,
  entity_type: ['item', 'competitor', 'organization'][index],
  entity_id: `11111111-1111-4111-a111-${String(index + 1).padStart(12, '0')}`,
  content_hash: hash(content),
  text: content,
  msg_ids: [index + 1],
});
const snapshot = () => ({
  provider_request: {
    model,
    input: [text, 'Controlled competitor summary.'],
    dimensions: 1536,
    encoding_format: 'float',
  },
  mapping: [mapping(0), mapping(1, 'Controlled competitor summary.')],
  input_contract_version: inputContractVersion,
  dimensions: embeddingDimensions,
  price: { unit: '1M tokens', usd: 0.02 },
  settings: { max_input_bytes: 4096, max_total_bytes: 8192, accounting_mode: 'simulated' },
});
const vector = (n) => Array.from({ length: 1536 }, (_, i) => (i === 0 ? n : 0));
const response = () => ({
  object: 'list',
  model,
  data: [
    { object: 'embedding', index: 1, embedding: vector(0.2) },
    { object: 'embedding', index: 0, embedding: vector(0.1) },
  ],
  usage: { prompt_tokens: 100, total_tokens: 100 },
});

test('accepts explicit 1536-dimensional finite request and exact text mapping', () => {
  assert.equal(validateEmbeddingRequest(snapshot().provider_request), true);
  assert.equal(validateEmbeddingSnapshot(snapshot()), true);
  assert.equal(inputContractVersion, 'embedding_input.v1');
  assert.equal(embeddingDimensions, 1536);
});

test('enforces UTF8 byte envelopes rather than assuming character/token equivalence', () => {
  const r = snapshot().provider_request;
  assert.equal(validateEmbeddingRequest({ ...r, input: ['x'.repeat(8192)] }), true);
  assert.equal(validateEmbeddingRequest({ ...r, input: ['x'.repeat(8193)] }), false);
  assert.equal(validateEmbeddingRequest({ ...r, input: ['\u0645'.repeat(4097)] }), false);
  assert.equal(validateEmbeddingRequest({ ...r, input: ['\u{1f3ac}'.repeat(2048)] }), true);
  assert.equal(validateEmbeddingRequest({ ...r, input: ['', text] }), false);
  assert.equal(validateEmbeddingRequest({ ...r, input: ['  '] }), false);
  assert.equal(validateEmbeddingRequest({ ...r, input: Array(101).fill(text) }), false);
  assert.equal(validateEmbeddingRequest({ ...r, input: Array(40).fill('x'.repeat(8192)) }), false);
  assert.equal(validateEmbeddingRequest({ ...r, input: ['x'.repeat(100)] }, { maxInputBytes: 99 }), false);
});

test('rejects altered dimensions, model, encoding or unadmitted request properties', () => {
  const r = snapshot().provider_request;
  for (const change of [
    { dimensions: 3072 },
    { model: '' },
    { encoding_format: 'base64' },
    { user: 'caller' },
  ])
    assert.equal(validateEmbeddingRequest({ ...r, ...change }), false);
});

test('snapshot checks hash, version, message ownership mapping and admitted input order', () => {
  const cases = [
    (s) => (s.mapping[0].content_hash = '0'.repeat(64)),
    (s) => (s.mapping[0].text = 'modified after preparation'),
    (s) => (s.mapping[0].index = 1),
    (s) => (s.mapping[0].entity_type = 'campaign'),
    (s) => (s.mapping[0].msg_ids = []),
    (s) => (s.mapping[1].msg_ids = s.mapping[0].msg_ids),
    (s) => (s.input_contract_version = 'unknown.v2'),
    (s) => (s.settings.max_input_bytes = 8193),
    (s) => (s.settings.max_total_bytes = 300001),
    (s) => (s.settings = {}),
    (s) => (s.settings.accounting_mode = 'unlabelled'),
    (s) => (s.price.usd = -1),
  ];
  for (const change of cases) {
    const s = snapshot();
    change(s);
    assert.equal(validateEmbeddingSnapshot(s), false);
  }
});

test('maps unordered response indexes to admitted entities without using response-array order', () => {
  const r = parseEmbeddingResponse(response(), snapshot());
  assert.equal(r.ok, true);
  assert.deepEqual(
    r.rows.map((v) => [v.index, v.entity_type, v.embedding[0]]),
    [
      [0, 'item', 0.1],
      [1, 'competitor', 0.2],
    ],
  );
  assert.deepEqual(r.usage, { prompt_tokens: 100, total_tokens: 100 });
  assert.equal(r.response_model, model);
  assert.equal(
    r.rows.some((v) => Object.hasOwn(v, 'tokens')),
    false,
  );
});

test('rejects missing, duplicate, excess or malformed vectors and mismatched models', () => {
  const cases = [
    (r) => r.data.pop(),
    (r) => (r.data[0].index = 0),
    (r) => (r.data[0].index = 2),
    (r) => (r.data[0].index = 0.1),
    (r) => (r.data[0].embedding = vector(1).slice(1)),
    (r) => (r.data[0].embedding[1] = Number.NaN),
    (r) => (r.data[0].embedding[1] = Infinity),
    (r) => (r.data[0].embedding[1] = '0.3'),
    (r) => (r.data[0].embedding[1] = Number.MAX_VALUE),
    (r) => (r.data[0].embedding = Array(1536).fill(0)),
    (r) => (r.data[0].embedding = Array(1536).fill(1e-300)),
    (r) => (r.model = 'text-embedding-3-large'),
    (r) => (r.object = 'error'),
  ];
  for (const change of cases) {
    const r = response();
    change(r);
    assert.equal(parseEmbeddingResponse(r, snapshot()).ok, false);
  }
});

test('known aggregate usage can be priced once even when vectors are invalid', () => {
  const r = response();
  r.data.pop();
  const parsed = parseEmbeddingResponse(r, snapshot());
  assert.equal(parsed.ok, false);
  assert.deepEqual(parsed.usage, { prompt_tokens: 100, total_tokens: 100 });
  assert.equal(embeddingCost(parsed.usage, snapshot().price, model), 0.000002);
  assert.equal(parsed.rows, null);
});

test('unknown or inconsistent usage stays unknown; explicit zero remains known zero', () => {
  for (const usage of [
    null,
    {},
    { prompt_tokens: 10 },
    { prompt_tokens: -1, total_tokens: -1 },
    { prompt_tokens: 1.5, total_tokens: 1.5 },
    { prompt_tokens: 1, total_tokens: 2 },
  ]) {
    const r = response();
    r.usage = usage;
    const parsed = parseEmbeddingResponse(r, snapshot());
    assert.equal(parsed.ok, false);
    assert.equal(parsed.usage, null);
    assert.equal(embeddingCost(parsed.usage, snapshot().price, model), null);
  }
  assert.equal(embeddingCost({ prompt_tokens: 0, total_tokens: 0 }, snapshot().price, model), 0);
  for (const price of [
    null,
    { unit: 'token', usd: 0.02 },
    { unit: '1M tokens', usd: Infinity },
    { unit: '1M tokens', usd: -1 },
  ])
    assert.equal(embeddingCost({ prompt_tokens: 100, total_tokens: 100 }, price, model), null);
});
