import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  bindOwnedInstagramReplay,
  checkM04IncrementalCharge,
  runTask,
  validOperation,
} from './m04-dev-task.mjs';

test('incremental ceilings retain historical charges and count Vercel inside Management', () => {
  assert.doesNotThrow(() =>
    checkM04IncrementalCharge({ management: 296, control: 1446, combined: 1742, vercel: 100 }, 99, 'vercel'),
  );
  for (const key of ['management', 'control', 'combined', 'vercel']) {
    const totals = { management: 296, control: 1446, combined: 1742, vercel: 100 };
    totals[key]++;
    if (key === 'management' || key === 'control') totals.combined++;
    if (key === 'combined') totals.management++;
    assert.throws(() => checkM04IncrementalCharge(totals, 99, 'vercel'), /ALLOWANCE_EXHAUSTED/);
  }
  assert.throws(
    () =>
      checkM04IncrementalCharge({ management: 88, control: 282, combined: 370, vercel: 36 }, 100, 'vercel'),
    /CATEGORY_EXHAUSTED/,
  );
  assert.throws(
    () =>
      checkM04IncrementalCharge({ management: 88, control: 282, combined: 370, vercel: 36 }, 61, 'database'),
    /CATEGORY_EXHAUSTED/,
  );
});

test('invalid counters or cross-scope state cannot admit incremental work', async () => {
  for (const value of [NaN, Infinity, -1, 0.5])
    assert.throws(
      () =>
        checkM04IncrementalCharge({ management: value, control: 282, combined: 370, vercel: 36 }, 0, 'n8n'),
      /LEDGER_INVALID/,
    );
  assert.throws(
    () => checkM04IncrementalCharge({ management: 88, control: 282, combined: 0, vercel: 36 }, 0, 'n8n'),
    /LEDGER_INVALID/,
  );
  await assert.rejects(
    runTask({ task: 'ProviderMetadata', scope: 'incremental', state: { scope: 'other' } }),
    /SCOPE_INVALID/,
  );
  await assert.rejects(
    runTask({ task: 'ProviderMetadata', scope: 'incremental', cohort: { key: 'cursor' } }),
    /SCOPE_INVALID/,
  );
});
test('only concrete M04 task and phase pairs are accepted', () => {
  assert.equal(validOperation('ProviderMetadata', 'default'), true);
  for (const [task, phase] of [
    ['Admin', 'default'],
    ['Setup', 'arbitrary'],
    ['Stage', 'execute'],
    ['Restore', 'production'],
  ])
    assert.equal(validOperation(task, phase), false);
});
function transport(responses) {
  const calls = [],
    closed = [];
  return {
    calls,
    closed,
    dependencies: {
      charge() {},
      result() {},
      jsonTransport(options) {
        return {
          async send(method, path, body) {
            assert.equal(options.allowed(method, path, body), true);
            assert.equal(method, 'GET');
            calls.push({ host: options.host, api: options.api, path });
            const response = responses.shift();
            if (response instanceof Error) throw response;
            return response;
          },
          close() {
            closed.push(options.api);
          },
        };
      },
    },
  };
}
const good = [
  { status: 200, body: { data: { id: 'OwnerId123', email: 'not-returned@example.invalid' } } },
  {
    status: 200,
    body: {
      data: {
        id: 'ActorId123',
        username: 'apify',
        name: 'instagram-scraper',
        taggedBuilds: { latest: { buildId: 'BuildId123' } },
        pricingInfos: [{ pricingModel: 'PAY_PER_EVENT' }],
      },
    },
  },
  { status: 200, body: { data: { status: 'SUCCEEDED', buildNumber: '1.2.3' } } },
  {
    status: 200,
    body: {
      components: {
        schemas: {
          inputSchema: { type: 'object', properties: { resultsType: { enum: ['posts', 'reels'] } } },
        },
      },
    },
  },
];

test('incremental malformed callback logs only the fixed status and reserves its error audit', async () => {
  const charges = [],
    calls = [];
  const result = await runTask(
    {
      task: 'Probe',
      phase: 'malformed',
      scope: 'incremental',
      state: {
        deployment: { audience: 'https://everyone-market-researcher-synthetic.vercel.app' },
        native: { published: true, errorHandler: { current: { active: true } } },
      },
    },
    {
      charge: (...a) => charges.push(a),
      result() {},
      jsonTransport() {
        return {
          async send(method, path, body) {
            calls.push({ method, path, body });
            return { status: 500, body: { message: 'private-native-error-must-not-escape' } };
          },
          close() {
            return true;
          },
        };
      },
    },
  );
  assert.equal(result.public.status, 'completed');
  assert.equal(result.public.callback.status, 500);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { eventType: 'M04.INVALID.CALLBACK' });
  assert.equal(charges.filter(([category]) => category === 'gateway').length, 1);
  assert.equal(JSON.stringify(result).includes('private-native-error'), false);
});
test('metadata uses one authenticated identity read and three public pinned actor/build reads', async () => {
  const t = transport(structuredClone(good));
  const r = await runTask(
    { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
    t.dependencies,
  );
  assert.equal(r.public.status, 'completed');
  assert.equal(t.calls.length, 4);
  assert.equal(t.calls[0].api, 'apify');
  assert.equal(t.calls[1].api, 'no_machine');
  assert.equal(r.private.provider.buildId, 'BuildId123');
  assert.equal(JSON.stringify(r.public).includes('not-returned'), false);
  assert.equal(JSON.stringify(r).includes('synthetic-private-key'), false);
  assert.equal(t.closed.length, 2);
});
test('unsupported owner read stops before actor metadata and keeps credential failures private', async () => {
  const t = transport([{ status: 403, body: { error: { message: 'synthetic-private-key' } } }]);
  const r = await runTask(
    { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
    t.dependencies,
  );
  assert.equal(r.public.code, 'M04_APIFY_OWNER_READ_UNAVAILABLE');
  assert.equal(t.calls.length, 1);
  assert.equal(JSON.stringify(r).includes('synthetic-private-key'), false);
});
test('transport errors produce a fixed diagnostic and no blind request replay', async () => {
  const t = transport([Error('synthetic-private-key')]);
  const r = await runTask(
    { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
    t.dependencies,
  );
  assert.equal(r.public.code, 'M04_TRANSPORT_OR_CONTRACT_FAILURE');
  assert.equal(t.calls.length, 1);
  assert.equal(t.closed.length, 2);
});
test('recorded provider pins are retained rather than rediscovered or overwritten', async () => {
  const t = transport([]),
    state = { provider: { owner_id: 'OwnerId123' } };
  const r = await runTask({ task: 'ProviderMetadata', state }, t.dependencies);
  assert.equal(r.public.code, 'M04_PROVIDER_ALREADY_RECORDED');
  assert.equal(t.calls.length, 0);
  assert.deepEqual(r.private, state);
});
test('unclosed transport ownership is blocking even after successful metadata reads', async () => {
  const t = transport(structuredClone(good)),
    original = t.dependencies.jsonTransport;
  t.dependencies.jsonTransport = (options) => ({ ...original(options), close: () => false });
  const r = await runTask(
    { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
    t.dependencies,
  );
  assert.equal(r.public.status, 'blocked');
  assert.equal(r.public.code, 'M04_TRANSPORT_CLOSE_FAILED');
});
test('untrusted actor IDs and build numbers cannot become provider request paths or pins', async () => {
  for (const [field, value] of [
    ['id', 'Actor/other'],
    ['buildNumber', 'latest'],
  ]) {
    const responses = structuredClone(good);
    if (field === 'id') responses[1].body.data.id = value;
    else responses[2].body.data.buildNumber = value;
    const t = transport(responses),
      r = await runTask(
        { task: 'ProviderMetadata', secrets: { apifyRead: 'synthetic-private-key' } },
        t.dependencies,
      );
    assert.equal(r.public.status, 'blocked');
    assert.equal(r.public.code, 'M04_BUILD_METADATA_UNAVAILABLE');
    assert.equal(t.calls.length, field === 'id' ? 2 : 3);
  }
});
test('access checks use only safe reads or denied operations and keep the five outcomes distinct', async () => {
  const calls = [],
    deps = {
      charge() {},
      result() {},
      jsonTransport(options) {
        return {
          async send(method, path, body) {
            assert.equal(options.allowed(method, path, body), true);
            assert.equal(method, 'POST');
            assert.equal(path, '/api/internal/n8n/collectors');
            calls.push(body.operation);
            if (options.api === 'no_machine')
              return { status: 401, body: { error: { code: 'unauthorized' } } };
            if (options.extraHeaders.cookie) return { status: 403, body: { error: { code: 'forbidden' } } };
            if (body.operation === 'sql')
              return { status: 400, body: { error: { code: 'invalid_request' } } };
            if (body.operation === 'resolve')
              return { status: 403, body: { error: { code: 'account_not_permitted' } } };
            return {
              status: 200,
              body: {
                version: 1,
                requestId: body.requestId,
                operation: body.operation,
                replayed: false,
                result: { scope: 'unknown' },
              },
            };
          },
          close() {
            return true;
          },
          state() {
            return { pendingRequests: 0, unclosedResponses: 0 };
          },
        };
      },
    };
  const r = await runTask(
    {
      task: 'Probe',
      state: {
        deployment: { audience: 'https://everyone-market-researcher-example.vercel.app' },
        native: { published: true },
        protectionBypass: 'synthetic-bypass',
      },
      secrets: { machine: 'synthetic-machine-token' },
    },
    deps,
  );
  assert.equal(r.public.status, 'completed');
  assert.equal(r.private.accessVerified, true);
  assert.deepEqual(
    r.public.probes.map((p) => p.status),
    [200, 401, 403, 400, 403],
  );
  assert.deepEqual(calls, ['callback.classify', 'callback.classify', 'callback.classify', 'sql', 'resolve']);
  assert.equal(JSON.stringify(r.public).includes('synthetic-'), false);
});

const replayReceipt = JSON.parse(
  readFileSync(
    new URL(
      '../../milestones/M04-collectors-vimeo-instagram/evidence/live-instagram-first-assertions-20261027.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const replayApproval = JSON.parse(
  readFileSync(
    new URL(
      '../../milestones/M04-collectors-vimeo-instagram/evidence/live-test-approval-20261027.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const replayState = () => ({
  selection: { instagram: ['962c9c7e-aa0f-46ae-911b-3265859e0577', 'bed82782-753f-4ba9-91ca-691ef36f75c6'] },
});
test('replay binds only the completed owned Instagram posts run from the fixed public database receipt', () => {
  const state = replayState();
  assert.equal(
    bindOwnedInstagramReplay(state, structuredClone(replayReceipt), replayApproval),
    'Wo1flJIBKg7bk07IJ',
  );
  assert.deepEqual(state.functional, {
    replayRunId: 'Wo1flJIBKg7bk07IJ',
    parentRunId: 'd0c86952-df68-48ff-8f41-132500e2e90b',
    executionId: '31159',
    approvalId: '3f3aed72-4f14-4cc4-aefe-4999038efe27',
  });
});
test('replay rejects wrong ownership, pending work and cost disagreement without caching an ID', () => {
  for (const mutate of [
    (r) => {
      r.projectRef = 'other-project';
    },
    (r) => {
      r.childrenClosed = false;
    },
    (r) => {
      r.queryResult[0].collector_assertions.runs.find((x) => x.workflow === 'WF-11').n8n_execution_id =
        '31158';
    },
    (r) => {
      r.queryResult[0].collector_assertions.accounts.find((x) => x.platform === 'instagram').last_run_id =
        'other-parent';
    },
    (r) => {
      r.queryResult[0].collector_assertions.launches[0].approval_id = 'other-approval';
    },
    (r) => {
      r.queryResult[0].collector_assertions.launches[0].account_ids[0] =
        '00000000-0000-4000-8000-000000000004';
    },
    (r) => {
      r.queryResult[0].collector_assertions.actorRuns[0].status = 'RUNNING';
    },
    (r) => {
      r.queryResult[0].collector_assertions.actorRuns[0].processed_at = null;
    },
    (r) => {
      r.queryResult[0].collector_assertions.selectedLiveClaims = 1;
    },
    (r) => {
      r.queryResult[0].collector_assertions.costs.find((x) => x.provider === 'apify').cost_usd += 0.001;
    },
  ]) {
    const receipt = structuredClone(replayReceipt),
      state = replayState();
    mutate(receipt);
    assert.throws(
      () => bindOwnedInstagramReplay(state, receipt, replayApproval),
      /M04_OWNED_CALLBACK_RECEIPT_REQUIRED/,
    );
    assert.equal(state.functional, undefined);
  }
});
