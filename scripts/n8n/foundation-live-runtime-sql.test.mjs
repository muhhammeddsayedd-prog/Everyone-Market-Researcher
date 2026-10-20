import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerFixture, verifyAndCleanPhaseB } from './foundation-native-controller-fixtures.mjs';
import {
  createFoundationSettlementReader,
  foundationSettlementQuery,
} from './foundation-native-settlement.mjs';
import { verifyFoundationLiveSmokeSql } from './foundation-live-runtime-cli.mjs';

async function scripted(caseId) {
  let ports;
  const f = providerFixture({
    configureSettlement(p) {
      ports = p;
      const read = p.readGateway;
      p.readGateway = async (args) => {
        const value = await read(args);
        if (caseId === 'smoke.second') for (const row of value.providers) row.launch.ordinal = 2;
        return value;
      };
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
  };
}

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
