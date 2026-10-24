import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createFoundationSettlementReader,
  assertFoundationSettlementReader,
  assertFoundationSettlementReceipt,
  assertFoundationProviderOrigins,
  foundationSettlementQuery,
} from './foundation-native-settlement.mjs';
import { fixture } from './foundation-native-test-fixtures.mjs';

const epoch = Date.parse('2026-10-19T12:00:00.000Z'),
  iso = (delta = 0) => new Date(epoch + delta).toISOString();
const fixed = /^Error: FOUNDATION_SETTLEMENT_[A-Z_]+$/;

for (const windowId of [
  '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
  'eda4fae1-1e19-47db-81b8-beac1a4ed883',
  '3c46c791-e140-4eb9-890a-eecfa251f65e',
  '4c602549-2c42-4ec3-9328-714d7cb66a77',
])
  test(`fresh source-known ${windowId} settlement uses only that window and refuses legacy or arbitrary window evidence`, async () => {
    const f = await fixture();
    const reader = createFoundationSettlementReader({
      ...f.ports,
      windowId,
      readGateway: async (args) => ({ ...(await f.ports.readGateway(args)), window_id: windowId }),
    });
    const proof = await reader.settle({ caseId: 'dispatch.vimeo', receipts: f.receipts, providerRuns: [] });
    assert.equal(proof.windowId, windowId);
    assert.equal(
      f.calls.every((r) => r.params[0] === windowId),
      true,
    );
    const old = await fixture();
    await assert.rejects(
      createFoundationSettlementReader({ ...old.ports, windowId }).settle({
        caseId: 'dispatch.vimeo',
        receipts: old.receipts,
        providerRuns: [],
      }),
      fixed,
    );
    assert.throws(
      () =>
        createFoundationSettlementReader({ ...f.ports, windowId: '11111111-1111-4111-8111-111111111111' }),
      fixed,
    );
  });

test('zero-actor settlement requires actual branded native and completed SQL observations, no caller boolean', async () => {
  const f = await fixture(),
    reader = createFoundationSettlementReader(f.ports);
  assert.equal(assertFoundationSettlementReader(reader), reader);
  const proof = await reader.settle({ caseId: 'dispatch.vimeo', receipts: f.receipts, providerRuns: [] });
  assert.equal(assertFoundationSettlementReceipt(proof), proof);
  assert.deepEqual(proof.executionIds, ['101']);
  assert.deepEqual(proof.providerRunIds, []);
  assert.deepEqual(
    proof.gatewayRequestIds,
    f.receipt.nativeGatewayRequests.map((r) => r.requestId),
  );
  assert.equal(proof.transportSettled, true);
  assert.equal(f.calls.length, 2);
  assert.equal(f.providerCalls.length, 0);
  assert.equal(f.calls[0].query, foundationSettlementQuery);
  assert.equal(/\b(insert|update|delete|alter|create)\b/i.test(foundationSettlementQuery), false);
  assert.throws(() => assertFoundationSettlementReceipt(structuredClone(proof)), fixed);
  await assert.rejects(
    reader.settle({ caseId: 'dispatch.vimeo', receipts: [{ ...f.receipt }], providerRuns: [] }),
    fixed,
  );
});

test('an original is taken from SQL identity and two actual pinned terminal samples separated by real elapsed time', async () => {
  const f = await fixture({ provider: true }),
    reader = createFoundationSettlementReader(f.ports);
  const proof = await reader.settle({
    caseId: 'smoke.first',
    receipts: f.receipts,
    providerRuns: [f.original],
  });
  assert.equal(f.providerCalls.length, 2);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(
    f.providerCalls.map((r) => r.apifyRunId),
    [f.original, f.original],
  );
  assert.equal(Date.parse(proof.observedAt) - Date.parse(proof.startedAt), 10000);
  assert.deepEqual(proof.providerOrigins, [
    {
      apifyRunId: f.original,
      nativeExecutionId: '101',
      runId: f.context.registry.run_id,
      accountId: f.context.launch.account_id,
    },
  ]);
  assert.equal(proof.transportSettled, true);
  assert.deepEqual(proof.providerTerminals, [
    {
      apifyRunId: f.original,
      status: 'SUCCEEDED',
      wireStatus: 'SUCCEEDED',
      finishedAt: iso(-2000),
      costUsd: '0.125',
    },
  ]);
  assert.equal(proof.costParityVerified, true);
});

test('original lookup admits pending actual registration without claiming external settlement or spending provider reads', async () => {
  const f = await fixture({ provider: true });
  f.context.run_status = 'running';
  f.context.run_finished_at = null;
  Object.assign(f.context.registry, {
    processed_at: null,
    processing_result: null,
    status: 'RUNNING',
    usage_usd: null,
    dataset_id: null,
  });
  const reader = createFoundationSettlementReader(f.ports);
  const proof = await reader.originals({ caseId: 'smoke.first', receipts: f.receipts });
  assert.equal(assertFoundationProviderOrigins(proof), proof);
  assert.equal(proof.settlementProven, false);
  assert.equal(f.calls.length, 1);
  assert.equal(f.providerCalls.length, 0);
  assert.deepEqual(
    proof.providerOrigins.map((r) => r.apifyRunId),
    [f.original],
  );
  assert.throws(() => assertFoundationSettlementReceipt(proof), fixed);
  assert.throws(() => assertFoundationProviderOrigins(structuredClone(proof)), fixed);
  await assert.rejects(
    reader.settle({ caseId: 'smoke.first', receipts: f.receipts, providerRuns: [f.original] }),
    fixed,
  );
});

test('zero leases alone cannot prove missing, reserved, unfinished or externally started rejected gateway calls settled', async () => {
  for (const change of [
    (f) => {
      f.snapshot.window_exists = false;
    },
    (f) => {
      f.snapshot.requests = [];
    },
    (f) => {
      f.snapshot.requests[0].state = 'reserved';
    },
    (f) => {
      f.snapshot.requests[0].completed_at = null;
    },
    (f) => {
      f.snapshot.requests[0].operation = 'another.operation';
    },
    (f) => {
      f.snapshot.unsettled_requests = 1;
    },
    (f) => {
      f.snapshot.leases = [
        { slot: 1, request_id: f.snapshot.requests[0].request_id, expires_at: iso(-10000) },
      ];
    },
    (f) => {
      Object.assign(f.snapshot.requests[0], { state: 'rejected', read_started: true });
    },
  ]) {
    const f = await fixture();
    change(f);
    await assert.rejects(
      createFoundationSettlementReader(f.ports).settle({
        caseId: 'dispatch.vimeo',
        receipts: f.receipts,
        providerRuns: [],
      }),
      fixed,
    );
    assert.equal(f.providerCalls.length, 0);
  }
});

test('caller provider IDs, mismatched SQL ownership/build/input and unprocessed registry never become original authority', async () => {
  const f = await fixture({ provider: true }),
    reader = createFoundationSettlementReader(f.ports);
  for (const providerRuns of [[], ['OtherOriginal'], [f.original, f.original], [{ apifyRunId: f.original }]])
    await assert.rejects(reader.settle({ caseId: 'smoke.first', receipts: f.receipts, providerRuns }), fixed);
  for (const change of [
    (g) => {
      g.context.execution_id = '999';
    },
    (g) => {
      g.context.scrape_execution_id = '999';
    },
    (g) => {
      g.context.launch.actor_build = '0.3.98';
    },
    (g) => {
      g.context.launch.input.maxCrawlPages = 2;
    },
    (g) => {
      g.context.registry.run_id = '04444444-4444-4444-8444-444444444444';
    },
    (g) => {
      g.context.registry.processing_result.cost_keys = ['invented'];
    },
  ]) {
    const g = await fixture({ provider: true });
    change(g);
    await assert.rejects(
      createFoundationSettlementReader(g.ports).settle({
        caseId: 'smoke.first',
        receipts: g.receipts,
        providerRuns: [g.original],
      }),
      fixed,
    );
    assert.equal(g.providerCalls.length, 0);
  }
});

test('changed provider cost or identity, incomplete transport and fake early pause are never settlement', async () => {
  for (const change of [
    (r) => {
      r.body.data.usageTotalUsd = 0.126;
    },
    (r) => {
      r.body.data.finishedAt = iso(-1900);
    },
    (r) => {
      r.body.data.buildNumber = '0.3.98';
    },
    (r) => {
      r.body.data.options.memoryMbytes = 2048;
    },
    (r) => {
      r.transport.socketsClosed = false;
    },
  ]) {
    const f = await fixture({ provider: true }),
      original = f.ports.readProvider;
    f.ports.readProvider = async (args) => {
      const r = await original(args);
      if (f.providerCalls.length === 2) change(r);
      return r;
    };
    await assert.rejects(
      createFoundationSettlementReader(f.ports).settle({
        caseId: 'smoke.first',
        receipts: f.receipts,
        providerRuns: [f.original],
      }),
      fixed,
    );
    assert.equal(f.providerCalls.length, 2);
  }
  const f = await fixture({ provider: true });
  f.ports.pause = async () => {};
  await assert.rejects(
    createFoundationSettlementReader(f.ports).settle({
      caseId: 'smoke.first',
      receipts: f.receipts,
      providerRuns: [f.original],
    }),
    fixed,
  );
  assert.equal(f.providerCalls.length, 1);
});

test('waiting/canceled/crashed native receipts, pending transport, expired admission and raw private errors refuse safely', async () => {
  for (const status of ['waiting', 'canceled', 'crashed']) {
    const f = await fixture({ status });
    await assert.rejects(
      createFoundationSettlementReader(f.ports).settle({
        caseId: 'dispatch.vimeo',
        receipts: f.receipts,
        providerRuns: [],
      }),
      fixed,
    );
    assert.equal(f.calls.length, 0);
  }
  const f = await fixture();
  f.ports.transportSnapshot = () => ({
    pendingRequests: 1,
    unclosedResponses: 0,
    pendingProviderRequests: 0,
    pendingGatewayRequests: 0,
  });
  await assert.rejects(
    createFoundationSettlementReader(f.ports).settle({
      caseId: 'dispatch.vimeo',
      receipts: f.receipts,
      providerRuns: [],
    }),
    fixed,
  );
  assert.equal(f.calls.length, 0);
  const g = await fixture(),
    reader = createFoundationSettlementReader(g.ports);
  g.setClock(epoch + 180000);
  await assert.rejects(
    reader.settle({ caseId: 'dispatch.vimeo', receipts: g.receipts, providerRuns: [] }),
    fixed,
  );
  const h = await fixture();
  h.ports.readGateway = async () => {
    throw Error('FOUNDATION_SETTLEMENT_SYNTHETIC_PRIVATE_SECRET');
  };
  await assert.rejects(
    createFoundationSettlementReader(h.ports).settle({
      caseId: 'dispatch.vimeo',
      receipts: h.receipts,
      providerRuns: [],
    }),
    /^Error: FOUNDATION_SETTLEMENT_UNCONFIRMED$/,
  );
});

test('a terminal receipt from this bounded batch remains valid while child discovery exceeds a metadata-poll interval', async () => {
  const f = await fixture();
  f.setClock(epoch + 25000);
  const proof = await createFoundationSettlementReader(f.ports).settle({
    caseId: 'dispatch.vimeo',
    receipts: f.receipts,
    providerRuns: [],
  });
  assert.equal(proof.transportSettled, true);
});

test('a timed-out trusted port remains an observed pending call and cannot mint a later proof', async () => {
  const f = await fixture();
  f.ports.deadlineAt = epoch + 5;
  f.ports.readGateway = () => new Promise(() => {});
  const reader = createFoundationSettlementReader(f.ports);
  await assert.rejects(
    reader.settle({ caseId: 'dispatch.vimeo', receipts: f.receipts, providerRuns: [] }),
    fixed,
  );
  assert.deepEqual(reader.state(), { pendingPortCalls: 1, busy: false });
  await assert.rejects(
    reader.originals({ caseId: 'dispatch.vimeo', receipts: f.receipts }),
    /^Error: FOUNDATION_SETTLEMENT_PORT_PENDING$/,
  );
});

test('stable provider spend must also match durable Postgres-rounded cost on the final read', async () => {
  const f = await fixture({ provider: true });
  f.providerBody.data.usageTotalUsd = 0.2;
  await assert.rejects(
    createFoundationSettlementReader(f.ports).settle({
      caseId: 'smoke.first',
      receipts: f.receipts,
      providerRuns: [f.original],
    }),
    fixed,
  );
  assert.equal(f.providerCalls.length, 2);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(JSON.parse(f.calls[0].params[3]), []);
  assert.deepEqual(JSON.parse(f.calls[1].params[3]), [{ apify_run_id: f.original, usage_usd: 0.2 }]);
  assert.match(foundationSettlementQuery, /round\(\(s->>'usage_usd'\)::numeric,6\)/);
});

test('root launch and SUB-START scrape identities remain distinct and require actual reciprocal native linkage', async () => {
  const equal = await fixture({ provider: true });
  equal.context.scrape_execution_id = '101';
  await assert.rejects(
    createFoundationSettlementReader(equal.ports).settle({
      caseId: 'smoke.first',
      receipts: equal.receipts,
      providerRuns: [equal.original],
    }),
    fixed,
  );
  assert.equal(equal.providerCalls.length, 0);
  const unlinked = await fixture({ provider: true, startParent: '999' });
  await assert.rejects(
    createFoundationSettlementReader(unlinked.ports).settle({
      caseId: 'smoke.first',
      receipts: unlinked.receipts,
      providerRuns: [unlinked.original],
    }),
    fixed,
  );
  assert.equal(unlinked.providerCalls.length, 0);
  const missing = await fixture({ provider: true });
  await assert.rejects(
    createFoundationSettlementReader(missing.ports).settle({
      caseId: 'smoke.first',
      receipts: [missing.receipt],
      providerRuns: [missing.original],
    }),
    fixed,
  );
  assert.equal(missing.providerCalls.length, 0);
});
