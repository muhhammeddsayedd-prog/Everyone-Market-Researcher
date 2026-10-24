import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerFixture, verifyAndCleanPhaseB } from './foundation-native-controller-fixtures.mjs';
import {
  createFoundationSettlementReader,
  foundationSettlementQuery,
} from './foundation-native-settlement.mjs';
import { verifyFoundationLiveSmokeSql } from './foundation-live-runtime-cli.mjs';

async function scripted(caseId, activeWindowId) {
  let ports;
  const f = providerFixture({
    configureSettlement(p) {
      ports = p;
      if (activeWindowId !== undefined) p.windowId = activeWindowId;
      const read = p.readGateway;
      p.readGateway = async (args) => {
        const value = await read(args);
        if (activeWindowId !== undefined) {
          value.window_id = activeWindowId;
          for (const row of value.providers) row.launch.window_id = activeWindowId;
        }
        if (caseId === 'smoke.second') for (const row of value.providers) row.launch.ordinal = 2;
        return value;
      };
    },
    beforeCreate({ ports }) {
      if (activeWindowId !== undefined) ports.activeWindowId = activeWindowId;
    },
  });
  await verifyAndCleanPhaseB(f);
  assert.equal((await f.controller.runCase(f.smoke)).state, 'native_settled');
  const receipts = f.controller.caseReceipts('smoke.first');
  // This is a scripted post-SQL-assertion fixture, not a second actor receipt.
  // The real settlement factory still validates all native/SQL/provider brands.
  const settlement =
    caseId === 'smoke.first'
      ? f.controller.caseSettlement(caseId)
      : await createFoundationSettlementReader(ports).settle({
          caseId,
          receipts,
          providerRuns: [f.original],
        });
  const calls = [],
    audit = [];
  const admin = {
    readGateway: async (args) => {
      assert.equal(args.query, foundationSettlementQuery);
      assert.deepEqual(
        args.params[2],
        receipts.map((r) => r.executionId),
      );
      assert.equal(args.params[3], '[]');
      return ports.readGateway(args);
    },
    smokeAssert: async (args) => {
      calls.push(args);
      return {
        result: 'M03_SMOKE_SQL_STATE_PASS',
        run_id: args.runId,
        apify_run_id: args.apifyRunId,
        expected_items_new: args.expectedItemsNew,
        webhook_delivery_or_replay_proven: false,
      };
    },
  };
  return {
    caseId,
    receipts,
    settlement,
    admin,
    append: (r) => audit.push(r),
    now: f.ports.now,
    calls,
    audit,
    original: f.original,
    ...(activeWindowId === undefined ? {} : { activeWindowId }),
  };
}

test('fifth-window smoke SQL requires its actual branded settlement and exact window', async () => {
  const activeWindowId = '4c602549-2c42-4ec3-9328-714d7cb66a77';
  const f = await scripted('smoke.first', activeWindowId);
  await verifyFoundationLiveSmokeSql(f);
  assert.equal(f.calls.length, 1);
  assert.equal(f.audit.length, 1);
  assert.equal(f.audit[0].expectedItemsNew, 1);
  await assert.rejects(
    verifyFoundationLiveSmokeSql({ ...f, activeWindowId: '3c46c791-e140-4eb9-890a-eecfa251f65e' }),
    /FOUNDATION_LIVE_CHILD_BLOCKED/,
  );
  await assert.rejects(
    verifyFoundationLiveSmokeSql({ ...f, settlement: structuredClone(f.settlement) }),
    /PROOF_BRAND/,
  );
  assert.equal(f.calls.length, 1);
});

for (const [caseId, expected] of [
  ['smoke.first', 1],
  ['smoke.second', 0],
])
  test(
    'fixed live post-settlement SQL assertion maps ' + caseId + ' to expectedItemsNew' + expected,
    async () => {
      const f = await scripted(caseId);
      await verifyFoundationLiveSmokeSql(f);
      assert.equal(f.calls.length, 1);
      assert.equal(f.calls[0].apifyRunId, f.original);
      assert.equal(f.calls[0].expectedItemsNew, expected);
      assert.equal(f.audit.length, 1);
      assert.equal(f.audit[0].event, 'smoke_sql_state_verified');
      assert.equal(f.audit[0].expectedItemsNew, expected);
    },
  );

test('wrong SQL original, failed native SQL assertion and copied settlement cannot become a smoke receipt', async () => {
  const f = await scripted('smoke.first'),
    originalRead = f.admin.readGateway;
  f.admin.readGateway = async (args) => {
    const s = await originalRead(args);
    s.providers[0].registry.apify_run_id = 'WrongOriginal';
    return s;
  };
  await assert.rejects(verifyFoundationLiveSmokeSql(f), /FOUNDATION_LIVE_CHILD_BLOCKED/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.audit.length, 0);
  f.admin.readGateway = originalRead;
  f.admin.smokeAssert = async () => ({ result: 'M03_SMOKE_SQL_STATE_PASS', expected_items_new: 0 });
  await assert.rejects(verifyFoundationLiveSmokeSql(f), /FOUNDATION_LIVE_CHILD_BLOCKED/);
  assert.equal(f.audit.length, 0);
  await assert.rejects(
    verifyFoundationLiveSmokeSql({ ...f, settlement: structuredClone(f.settlement) }),
    /PROOF_BRAND/,
  );
});
