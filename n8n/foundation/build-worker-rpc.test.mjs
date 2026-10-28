import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildWorkerRpcAdapter, createWorkerAdapterRuntime } from './build-worker-rpc.mjs';
import { gatewayReceipt, gatewayRequest } from '../../packages/shared/src/n8n-worker-contracts.ts';
const a = '10000000-0000-4000-8000-000000000001',
  b = '10000000-0000-4000-8000-000000000002',
  c = '10000000-0000-4000-8000-000000000003';
const input = () => ({ requestId: a, reconcileRequestId: b, operation: 'identity.read', args: {} });
const window = () => ({
  id: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
  startsAt: '2026-10-18T08:00:00Z',
  expiresAt: '2026-10-18T08:30:00Z',
  closed: false,
  totalAdmitted: 1,
  boundAudience: 'https://everyone-market-researcher-synthetic.vercel.app',
  boundCommitSha: 'a'.repeat(40),
  boundDeploymentId: 'dpl_SyntheticOwnedDeployment123',
});
const identity = () => ({
  currentUser: 'n8n_writer',
  sessionUser: 'n8n_writer',
  database: 'postgres',
  projectRef: 'zmotjsbzhzjvpelxvxlf',
  connectionCount: 1,
});
test('native dev adapter has one explicit HTTPS attempt, native credential ID reference and private execution retention disabled', () => {
  const c = buildWorkerRpcAdapter({
    audience: 'https://everyone-market-researcher-synthetic.vercel.app',
    credential: { id: 'SyntheticGw01', name: 'M03 GW-01 machine [dev]', type: 'httpCustomAuth' },
  });
  assert.equal(c.workflow.active, false);
  assert.equal(c.hostedAcceptance, false);
  assert.equal(c.providerCalls, 0);
  const h = c.workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
  assert.equal(h.length, 1);
  assert.equal(h[0].retryOnFail, false);
  assert.equal(h[0].parameters.options.timeout, 25000);
  assert.equal(h[0].parameters.options.allowUnauthorizedCerts, false);
  assert.equal(h[0].parameters.options.redirect.redirect.followRedirects, false);
  assert.equal(h[0].parameters.genericAuthType, 'httpCustomAuth');
  assert.equal(
    h[0].parameters.url,
    'https://everyone-market-researcher-synthetic.vercel.app/api/internal/n8n/rpc',
  );
  assert.equal(c.workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(c.workflow.settings.saveDataErrorExecution, 'none');
  assert.equal(c.workflow.settings.saveManualExecutions, false);
  assert.ok(!c.workflow.nodes.some((n) => /webhook|schedule|postgres/i.test(n.type)));
});
test('strict trial inputs match rootZod schema and prevent route/role/body substitution', () => {
  const r = createWorkerAdapterRuntime(),
    prepared = r.prepare(input());
  assert.deepEqual(
    prepared.request,
    gatewayRequest({ version: 1, requestId: a, operation: 'identity.read', args: {} }),
  );
  for (const change of [
    { audience: 'https://evil.invalid' },
    { operation: 'run.start' },
    { args: { sql: 'select 1' } },
    { reconcileRequestId: a },
  ])
    assert.throws(() => r.prepare({ ...input(), ...change }), /^Error: GW01_ADAPTER_INPUT_INVALID$/);
  const status = r.prepare({
    ...input(),
    operation: 'request.status',
    args: { targetRequestId: b },
    reconcileRequestId: c,
  });
  assert.notEqual(status.request.requestId, status.request.args.targetRequestId);
});
test('ambiguous response emits original target/fresh status descriptor and performs no hidden retry', () => {
  const r = createWorkerAdapterRuntime(),
    p = r.prepare(input());
  for (const response of [
    {},
    { statusCode: 202, body: {} },
    { statusCode: 503, body: { message: 'SYNTHETIC_PRIVATE_CANARY' } },
  ]) {
    const out = r.classify(response, p);
    assert.equal(out.outcome, 'unknown');
    assert.equal(out.reconciliation.requestId, b);
    assert.equal(out.reconciliation.operation, 'request.status');
    assert.equal(out.reconciliation.args.targetRequestId, a);
    assert.equal(out.automaticRetry, false);
    assert.doesNotMatch(JSON.stringify(out), /SYNTHETIC_PRIVATE_CANARY|message/);
  }
});
test('identity requires actual restricted current and session user and outputs booleans rather than raw headers', () => {
  const r = createWorkerAdapterRuntime(),
    p = r.prepare(input());
  const response = {
    statusCode: 200,
    body: { version: 1, requestId: a, outcome: 'completed', result: identity(), window: window() },
    headers: { authorization: 'SYNTHETIC_PRIVATE_CANARY' },
  };
  const out = r.classify(response, p);
  assert.equal(out.identityVerified, true);
  assert.doesNotMatch(JSON.stringify(out), /SYNTHETIC_PRIVATE_CANARY|headers/);
  for (const key of ['currentUser', 'sessionUser', 'projectRef']) {
    const bad = structuredClone(response);
    bad.body.result[key] = 'postgres';
    assert.equal(r.classify(bad, p).outcome, 'unknown');
  }
});
test('runtime embeds exactly without secret access, filesystem, HTTP, URL globals or module imports', () => {
  const r = runInNewContext(
    `(${createWorkerAdapterRuntime.toString()})()`,
    { URL: undefined, require: undefined },
    { timeout: 1000 },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(r.prepare(input()))).request, {
    version: 1,
    requestId: a,
    operation: 'identity.read',
    args: {},
  });
});
test('actual eight-field route window and direct durable status results classify without inventing an operation envelope', () => {
  const r = createWorkerAdapterRuntime('https://everyone-market-researcher-synthetic.vercel.app');
  const values = [
    ['identity.read', identity()],
    ['settings.read', { key: 'daily_budget_usd', value: 25 }],
    ['prices.read', { prices: {} }],
    ['error.count', { count: 2 }],
    ['error.log', { acknowledged: true }],
  ];
  for (const [op, value] of values) {
    gatewayReceipt({ state: 'completed', code: null, result: value, window: window() }, op);
    const p = r.prepare({ ...input(), operation: 'request.status', args: { targetRequestId: c } });
    const out = r.classify(
      {
        statusCode: 200,
        body: { version: 1, requestId: a, outcome: 'completed', result: value, window: window() },
      },
      p,
    );
    assert.equal(out.outcome, 'completed', op);
    assert.equal(out.targetRequestId, c);
  }
  const p = r.prepare(input()),
    w = { ...window(), boundAudience: 'https://everyone-market-researcher-other.vercel.app' };
  assert.equal(
    r.classify(
      {
        statusCode: 200,
        body: { version: 1, requestId: a, outcome: 'completed', result: identity(), window: w },
      },
      p,
    ).outcome,
    'unknown',
  );
});
test('partial health-shaped response cannot pass complete typed health verification', () => {
  const r = createWorkerAdapterRuntime(),
    p = r.prepare({ ...input(), operation: 'health.read' });
  const result = {
    failing_accounts: [],
    stale_accounts: [],
    queues: { ai_extract: 0, embed: 0, media: 0 },
    month_to_date_usd: 0,
    forecast_month_usd: 0,
  };
  const out = r.classify(
    { statusCode: 200, body: { version: 1, requestId: a, outcome: 'completed', result, window: window() } },
    p,
  );
  assert.equal(out.outcome, 'unknown');
});

test('native health adapter accepts only complete legacy or M06 health contracts', () => {
  const runtime = createWorkerAdapterRuntime();
  const prepared = runtime.prepare({ ...input(), operation: 'health.read' });
  const health = {
    failing_accounts: [],
    stale_accounts: [],
    queues: { ai_extract: 0, embed: 0, media: 1 },
    items_new_yesterday: {},
    cost_yesterday: { total: 0, by_provider: {} },
    budget: { daily_budget_usd: 25, over_budget: false },
    month_to_date_usd: 0,
    forecast_month_usd: 0,
    workflow_errors_24h: {},
  };
  const classify = (result) =>
    runtime.classify(
      {
        statusCode: 200,
        body: {
          version: 1,
          requestId: a,
          outcome: 'completed',
          result,
          window: window(),
        },
      },
      prepared,
    ).outcome;
  assert.equal(classify(health), 'completed');
  const extended = {
    ...health,
    zero_item_streaks: [
      {
        account_id: a,
        competitor: 'Synthetic local',
        platform: 'vimeo',
        handle: null,
        last_success_at: null,
      },
    ],
    story_capture_gap: null,
    media_missing_24h: 1,
  };
  assert.equal(classify(extended), 'completed');
  for (const gap of [0, 0.5, 1]) assert.equal(classify({ ...extended, story_capture_gap: gap }), 'completed');
  for (const key of ['zero_item_streaks', 'story_capture_gap', 'media_missing_24h']) {
    const partial = { ...extended };
    delete partial[key];
    assert.equal(classify(partial), 'unknown', key);
  }
  for (const gap of [-1, 1.01, NaN, Infinity, '0'])
    assert.equal(classify({ ...extended, story_capture_gap: gap }), 'unknown');
  for (const count of [-1, 0.1, Infinity, Number.MAX_SAFE_INTEGER + 1, null])
    assert.equal(classify({ ...extended, media_missing_24h: count }), 'unknown');
  assert.equal(classify({ ...extended, unknown_field: 1 }), 'unknown');
  assert.equal(classify({ ...extended, zero_item_streaks: [null] }), 'unknown');
  for (const date of ['2026-02-30T00:00:00Z', '2026-01-01T24:00:00Z', '2025-02-29T00:00:00Z'])
    assert.equal(
      classify({
        ...extended,
        zero_item_streaks: [{ ...extended.zero_item_streaks[0], last_success_at: date }],
      }),
      'unknown',
    );
  assert.equal(
    classify({ ...extended, zero_item_streaks: Array(2001).fill(extended.zero_item_streaks[0]) }),
    'unknown',
  );
});

test('UUID correlations are distinct by identity even when letter case differs', () => {
  const r = createWorkerAdapterRuntime(),
    x = 'e62e7289-28ca-4387-a071-6f327837ea01',
    y = 'a11b7289-28ca-4387-a071-6f327837ea02';
  for (const value of [
    { requestId: x, reconcileRequestId: x.toUpperCase(), operation: 'identity.read', args: {} },
    {
      requestId: x,
      reconcileRequestId: y,
      operation: 'request.status',
      args: { targetRequestId: x.toUpperCase() },
    },
    {
      requestId: x,
      reconcileRequestId: y,
      operation: 'request.status',
      args: { targetRequestId: y.toUpperCase() },
    },
  ])
    assert.throws(() => r.prepare(value), /^Error: GW01_ADAPTER_INPUT_INVALID$/);
});
