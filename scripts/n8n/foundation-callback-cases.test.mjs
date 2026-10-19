import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createFoundationCallbackCases,
  assertFoundationCallbackCases,
  assertFoundationCallbackCase,
  consumeFoundationCallbackCase,
  foundationUnknownCallbackQuery,
} from './foundation-callback-cases.mjs';
import { createFoundationSettlementReader } from './foundation-native-settlement.mjs';
import { fixture } from './foundation-native-test-fixtures.mjs';

const epoch = Date.parse('2026-10-19T12:00:00.000Z'),
  fixed = /^Error: FOUNDATION_CALLBACK_CASE_BLOCKED$/;
function source() {
  let clock = epoch;
  const calls = [];
  const factory = createFoundationCallbackCases({
    now: () => clock,
    deadlineAt: epoch + 60000,
    readUnknown: async (request) => {
      calls.push(request);
      return {
        apify_run_id: 'M03AcceptanceUnknown0001',
        registry_absent: true,
        launch_absent: true,
        observed_at: new Date(clock).toISOString(),
      };
    },
  });
  return {
    factory,
    calls,
    setClock: (n) => {
      clock = n;
    },
  };
}
async function original() {
  const f = await fixture({ provider: true });
  return createFoundationSettlementReader(f.ports).settle({
    caseId: 'smoke.first',
    receipts: f.receipts,
    providerRuns: [f.original],
  });
}

test('unknown callback uses one fixed SQL-confirmed nonexistent ID and no arbitrary payload', async () => {
  const f = source();
  assert.equal(assertFoundationCallbackCases(f.factory), f.factory);
  const wire = await f.factory.prepare({ caseId: 'callback.unknown' });
  assert.equal(assertFoundationCallbackCase(wire), wire);
  assert.deepEqual(wire.body, {
    eventType: 'ACTOR.RUN.SUCCEEDED',
    resource: { id: 'M03AcceptanceUnknown0001' },
  });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].query, foundationUnknownCallbackQuery);
  assert.deepEqual(f.calls[0].params, []);
  assert.equal(/\b(insert|update|delete|alter|create)\b/i.test(foundationUnknownCallbackQuery), false);
  assert.match(wire.traceparent, /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
  assert.deepEqual(JSON.parse(consumeFoundationCallbackCase(wire).body), wire.body);
  assert.throws(() => consumeFoundationCallbackCase(wire), fixed);
  assert.throws(() => assertFoundationCallbackCase(structuredClone(wire)), fixed);
  await assert.rejects(f.factory.prepare({ caseId: 'callback.unknown' }), fixed);
  await assert.rejects(
    source().factory.prepare({ caseId: 'callback.unknown', apifyRunId: 'Arbitrary' }),
    fixed,
  );
});

test('known replay/concurrent/drill payloads require the actual first-original settlement brand and distinct fresh traces', async () => {
  const receipt = await original(),
    f = source(),
    wires = [];
  for (const caseId of [
    'callback.equal_replay',
    'callback.concurrent_a',
    'callback.concurrent_b',
    'callback.recovery_drill',
  ]) {
    const wire = await f.factory.prepare({ caseId, settlementReceipt: receipt });
    wires.push(wire);
    assert.equal(wire.body.resource.id, receipt.providerRunIds[0]);
    assert.equal(wire.body.eventType, 'ACTOR.RUN.SUCCEEDED');
    assert.equal(wire.strongerRecoveryProven, false);
    assert.equal(
      wire.acknowledgementMode,
      caseId === 'callback.recovery_drill' ? 'withhold_after_private_check' : 'normal',
    );
  }
  assert.equal(new Set(wires.map((w) => w.traceparent)).size, 4);
  assert.equal(f.calls.length, 0);
  await assert.rejects(
    source().factory.prepare({
      caseId: 'callback.equal_replay',
      settlementReceipt: structuredClone(receipt),
    }),
    fixed,
  );
  await assert.rejects(
    source().factory.prepare({ caseId: 'callback.equal_replay', settlementReceipt: { settled: true } }),
    fixed,
  );
  await assert.rejects(source().factory.prepare({ caseId: 'arbitrary', settlementReceipt: receipt }), fixed);
});

test('ambiguous existing IDs, stale absence and expired wire cannot be turned into another POST attempt', async () => {
  for (const patch of [
    { registry_absent: false },
    { launch_absent: false },
    { observed_at: new Date(epoch - 16000).toISOString() },
  ]) {
    const factory = createFoundationCallbackCases({
      now: () => epoch,
      deadlineAt: epoch + 60000,
      readUnknown: async () => ({
        apify_run_id: 'M03AcceptanceUnknown0001',
        registry_absent: true,
        launch_absent: true,
        observed_at: new Date(epoch).toISOString(),
        ...patch,
      }),
    });
    await assert.rejects(factory.prepare({ caseId: 'callback.unknown' }), fixed);
  }
  const f = source(),
    wire = await f.factory.prepare({ caseId: 'callback.unknown' });
  f.setClock(epoch + 15000);
  assert.throws(() => consumeFoundationCallbackCase(wire), fixed);
  assert.throws(() => consumeFoundationCallbackCase(wire), fixed);
});

test('raw query failure and ignored cancellation stay fixed and pending instead of becoming authority', async () => {
  const privateFactory = createFoundationCallbackCases({
    now: () => epoch,
    deadlineAt: epoch + 1000,
    readUnknown: async () => {
      throw Error('SYNTHETIC_PRIVATE_QUERY_DETAIL');
    },
  });
  await assert.rejects(privateFactory.prepare({ caseId: 'callback.unknown' }), fixed);
  const pending = createFoundationCallbackCases({
    now: () => epoch,
    deadlineAt: epoch + 5,
    readUnknown: () => new Promise(() => {}),
  });
  await assert.rejects(pending.prepare({ caseId: 'callback.unknown' }), fixed);
  assert.equal(pending.state().pendingQueries, 1);
  await assert.rejects(pending.prepare({ caseId: 'callback.unknown' }), fixed);
});
