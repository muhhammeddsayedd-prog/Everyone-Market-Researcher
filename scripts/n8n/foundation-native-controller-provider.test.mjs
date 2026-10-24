import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerFixture, verifyAndCleanPhaseB } from './foundation-native-controller-fixtures.mjs';
const fixed = /FOUNDATION_NATIVE_CONTROL_BLOCKED/;

test('provider case requires actual five closed and deleted Phase-B groups, then binds callback to original SQL identity', async () => {
  const f = providerFixture();
  await assert.rejects(f.controller.runCase(f.smoke), fixed);
  assert.equal(f.actorStarts(), 0);
  const cleanup = await verifyAndCleanPhaseB(f);
  const result = await f.controller.runCase(f.smoke);
  assert.equal(result.state, 'native_settled');
  assert.equal(f.actorStarts(), 1);
  assert.equal(f.providerReads(), 2);
  assert.deepEqual(result.executionIds, ['501', '506', '502']);
  const callback = f.controller.caseReceipts('smoke.first').find((r) => r.key === 'WF-19');
  assert.equal(callback.nativeParent, null);
  assert.equal(callback.nativeProviderCallback.apifyRunId, f.original);
  assert.equal(
    f.rows.some(
      (r) => r.event === 'native_callback_origin' && r.nativeExecutionId === '501' && r.executionId === '502',
    ),
    true,
  );
  const settlement = f.rows.find(
    (r) => r.event === 'native_external_settlement' && r.caseId === 'smoke.first',
  );
  assert.equal(settlement.costParityVerified, true);
  assert.equal(settlement.providerTerminals[0].costUsd, '0.125');
  for (const receipt of f.controller.caseReceipts('smoke.first')) {
    const removed = await cleanup.cleanup({ receipt, closure: result.closure });
    assert.equal(removed.state, 'native_record_deleted');
    f.controller.recordCleanup(removed);
  }
  assert.equal(f.controller.snapshot().cleanedExecutionIds.length, 14);
  assert.equal(result.businessAcceptanceProven, false);
});

test('a different validated callback run or stable mismatched provider spend cannot authorize native-record cleanup', async () => {
  for (const options of [{ wrongCallback: true }, { providerCost: 0.2 }]) {
    const f = providerFixture(options);
    await verifyAndCleanPhaseB(f);
    assert.equal((await f.controller.runCase(f.smoke)).state, 'native_unresolved');
    assert.equal(f.controller.caseClosure('smoke.first'), null);
    assert.equal(f.controller.snapshot().stopped, true);
    assert.equal(f.controller.snapshot().cleanedExecutionIds.length, 11);
    assert.equal(f.actorStarts(), 1);
    assert.equal(f.providerReads(), options.wrongCallback ? 0 : 2);
    if (options.wrongCallback) assert.equal(JSON.stringify(f.rows).includes('DifferentOriginalRun'), false);
    await assert.rejects(f.controller.runCase(f.smoke), fixed);
  }
});
