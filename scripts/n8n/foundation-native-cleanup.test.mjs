import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createFoundationNativeCleanup,
  assertFoundationNativeCleanupReceipt,
} from './foundation-native-cleanup.mjs';
import { createFoundationNativeReader } from './foundation-native-reader.mjs';
import {
  createFoundationControlJournal,
  createFoundationControlBudget,
} from './foundation-execution-control.mjs';
import { runtimeGraphHash } from './foundation-runtime-control.mjs';

const instant = Date.parse('2026-10-19T12:00:00.000Z');
const iso = (n) => new Date(instant + n).toISOString();
const fixed = /FOUNDATION_NATIVE_CLEANUP_BLOCKED/;

async function fixture(options = {}) {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  const key = 'WF-00',
    workflowId = bindings.workflowRefs[key].id,
    versionId = 'native-cleanup-synthetic';
  const body = {
    name: bindings.workflowRefs[key].name,
    nodes: [],
    connections: {},
    settings: {
      saveManualExecutions: true,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveExecutionProgress: false,
    },
  };
  const binding = { workflowId, versionId, activeVersionId: null, bodyHash: runtimeGraphHash(body), body };
  const metadata = {
    id: '101',
    workflowId,
    workflowVersionId: versionId,
    mode: 'manual',
    status: options.status ?? 'success',
    createdAt: iso(-2000),
    startedAt: iso(-1000),
    stoppedAt: iso(-100),
    waitTill: options.waitTill ?? null,
  };
  const wire = (value, status = 200, extra = {}) => ({
    status,
    body: (async function* () {
      yield Buffer.from(JSON.stringify(value));
    })(),
    closed: Promise.resolve(),
    ...extra,
  });
  let clock = instant,
    id = '101',
    admissions = 0;
  const workflow = {
    id: workflowId,
    versionId,
    activeVersionId: null,
    active: false,
    ...structuredClone(body),
  };
  const readerTransport = {
    request: async ({ path }) => {
      const row = { ...metadata, id };
      if (path.includes('/workflows/')) return wire(workflow);
      if (path.endsWith('includeData=false')) return wire(row);
      return wire({
        ...row,
        workflowData: { id: workflowId, activeVersionId: null, ...body },
        data: { resultData: { runData: {} } },
      });
    },
  };
  const reader = createFoundationNativeReader({
    bindings,
    transport: readerTransport,
    admitControlAttempt: () => {},
    now: () => clock,
    deadlineAt: instant + 60000,
    sensitiveValues: ['SYNTHETIC_CLEANUP_SECRET_123456789'],
    bindingValidator: (v) => v,
  });
  const receipt = await reader.read({ workflowKey: key, executionId: id, binding });
  const events = [],
    calls = [];
  const journal = createFoundationControlJournal({
    previousEvents: options.previousEvents ?? [],
    durableAppend: (row) => {
      if (options.failJournal?.(row)) throw Error('SYNTHETIC_PRIVATE_ERROR_DO_NOT_COPY');
      events.push(row);
    },
  });
  const closure = {
    kind: 'foundation_native_closure',
    batchId: 'synthetic-owned-batch',
    caseId: 'synthetic-case',
    executionIds: [id],
    settled: true,
    closedAt: iso(0),
    owner: 'Mohamed Abdelrahman',
  };
  const transport = {
    request: async (r) => {
      calls.push({ method: r.method, path: r.path });
      if (options.respond) return options.respond(r, { metadata: { ...metadata, id }, wire });
      if (r.method === 'DELETE') return wire({ ...metadata, id: Number(id) });
      return wire({ message: 'not found' }, 404);
    },
  };
  const ports = {
    reader,
    transport,
    journal,
    now: () => clock,
    deadlineAt: instant + 60000,
    admitControlAttempt: (r) => {
      admissions++;
      options.admit?.(r);
    },
    closureValidator: (value) => value,
    ...(options.ports ?? {}),
  };
  const cleanup = createFoundationNativeCleanup(ports);
  return {
    cleanup,
    ports,
    reader,
    receipt,
    closure,
    metadata,
    events,
    calls,
    wire,
    journal,
    admissions: () => admissions,
    setClock: (n) => {
      clock = n;
    },
    nextReceipt: async (next) => {
      id = next;
      closure.executionIds.push(next);
      return reader.read({ workflowKey: key, executionId: next, binding });
    },
  };
}

test('cleanup rejects caller-labelled ownership or settlement before any request', async () => {
  const calls = [];
  assert.throws(
    () =>
      createFoundationNativeCleanup({
        reader: {},
        transport: { request: async (v) => calls.push(v) },
        admitControlAttempt: () => {},
        journal: { append: () => {} },
        now: () => 1000,
        deadlineAt: 2000,
      }),
    /FOUNDATION_NATIVE_CLEANUP_BLOCKED/,
  );
  assert.equal(calls.length, 0);
});

test('cleanup has no implicit transport, journal, budget or deadline defaults', () => {
  for (const ports of [{}, { reader: {}, transport: {} }, { deadlineAt: Infinity }]) {
    assert.throws(() => createFoundationNativeCleanup(ports), /FOUNDATION_NATIVE_CLEANUP_BLOCKED/);
  }
});

test('safe evidence is flushed before exact DELETE; matching acknowledgement and absence are both required', async () => {
  let f;
  f = await fixture({
    respond: (request, { metadata, wire }) => {
      assert.equal(f.events[0].event, 'native_cleanup_evidence');
      assert.equal(f.events[1].event, 'native_cleanup_intent');
      assert.equal(f.events[0].executionId, '101');
      assert.equal(Object.hasOwn(f.events[0], 'data'), false);
      return request.method === 'DELETE' ? wire({ ...metadata, id: 101 }) : wire({}, 404);
    },
  });
  const result = await f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure });
  assert.equal(
    assertFoundationNativeCleanupReceipt(result, { receipt: f.receipt, closure: f.closure }),
    result,
  );
  assert.throws(() => assertFoundationNativeCleanupReceipt({ ...result }), fixed);
  assert.throws(
    () => assertFoundationNativeCleanupReceipt(result, { receipt: { ...f.receipt }, closure: f.closure }),
    fixed,
  );
  assert.throws(
    () => assertFoundationNativeCleanupReceipt(result, { receipt: f.receipt, closure: { ...f.closure } }),
    fixed,
  );
  assert.equal(result.state, 'native_record_deleted');
  assert.equal(result.deleteAcknowledged, true);
  assert.equal(result.absenceVerified, true);
  assert.equal(result.physicalErasureVerified, false);
  assert.equal(result.residual, false);
  assert.equal(result.followUpOwner, 'Mohamed Abdelrahman');
  assert.deepEqual(f.calls, [
    { method: 'DELETE', path: '/api/v1/executions/101' },
    { method: 'GET', path: '/api/v1/executions/101?includeData=false' },
  ]);
  assert.equal(f.admissions(), 2);
  assert.deepEqual(f.cleanup.snapshot().residuals, []);
  assert.equal(f.events.at(-1).event, 'native_cleanup_result');
  assert.equal(f.events.at(-1).state, 'native_record_deleted');
});

test('waiting, unsettled, foreign, copied and caller-labelled receipts cannot authorize deletion', async () => {
  const waiting = await fixture({ status: 'waiting', waitTill: iso(5000) });
  await assert.rejects(
    waiting.cleanup.cleanup({ receipt: waiting.receipt, closure: waiting.closure }),
    fixed,
  );
  assert.equal(waiting.calls.length, 0);
  for (const change of [
    (f) => ({ receipt: { ...f.receipt }, closure: f.closure }),
    (f) => ({ receipt: f.receipt, closure: { ...f.closure, settled: false } }),
    (f) => ({ receipt: f.receipt, closure: { ...f.closure, executionIds: ['999'] } }),
    (f) => ({ receipt: f.receipt, closure: { ...f.closure, owner: 'other' } }),
  ]) {
    const f = await fixture();
    await assert.rejects(f.cleanup.cleanup(change(f)), fixed);
    assert.equal(f.calls.length, 0);
  }
  const f = await fixture();
  const actualValidator = createFoundationNativeCleanup({ ...f.ports, closureValidator: undefined });
  await assert.rejects(actualValidator.cleanup({ receipt: f.receipt, closure: f.closure }), fixed);
  assert.equal(f.calls.length, 0);
});

test('a canceled receipt still needs independent settlement; completed canceled work can then be cleaned', async () => {
  const f = await fixture({ status: 'canceled' });
  await assert.rejects(
    f.cleanup.cleanup({ receipt: f.receipt, closure: { ...f.closure, settled: false } }),
    fixed,
  );
  assert.equal(f.calls.length, 0);
  const r = await f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure });
  assert.equal(r.state, 'native_record_deleted');
});

test('a lost or mismatched DELETE acknowledgement followed by404 stays ambiguous and is never retried', async () => {
  for (const respond of [
    (r, { wire }) => {
      if (r.method === 'DELETE') throw Error('SYNTHETIC_PRIVATE_URL_ERROR');
      return wire({}, 404);
    },
    (r, { metadata, wire }) => (r.method === 'DELETE' ? wire({ ...metadata, id: 999 }) : wire({}, 404)),
    (r, { metadata, wire }) => (r.method === 'DELETE' ? wire({ ...metadata, id: '101' }) : wire({}, 404)),
    (r, { metadata, wire }) =>
      r.method === 'DELETE' ? wire({ ...metadata, workflowVersionId: 'other', id: 101 }) : wire({}, 404),
    (r, { metadata, wire }) =>
      r.method === 'DELETE'
        ? wire({ ...metadata, id: 101, extra: 'SYNTHETIC_CLEANUP_SECRET_123456789' })
        : wire({}, 404),
  ]) {
    const f = await fixture({ respond });
    const result = await f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure });
    assert.equal(result.state, 'cleanup_ambiguous');
    assert.equal(result.deleteAcknowledged, false);
    assert.equal(result.absenceVerified, true);
    assert.equal(result.residual, true);
    assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE'), false);
    await assert.rejects(f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure }), fixed);
    const resumed = createFoundationNativeCleanup(f.ports);
    await assert.rejects(resumed.cleanup({ receipt: f.receipt, closure: f.closure }), fixed);
    assert.equal(f.calls.length, 2);
  }
});

test('acknowledged DELETE without a verified absence leaves a bounded residual inventory', async () => {
  const f = await fixture({
    respond: (r, { metadata, wire }) => wire({ ...metadata, id: r.method === 'DELETE' ? 101 : '101' }),
  });
  const r = await f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure });
  assert.equal(r.state, 'record_remaining');
  assert.equal(r.deleteAcknowledged, true);
  assert.equal(r.absenceVerified, false);
  assert.equal(r.residual, true);
  assert.equal(f.cleanup.snapshot().residuals[0].executionId, '101');
  assert.equal(f.cleanup.snapshot().expectedCleanupAt, iso(60000));
  const unknown = await fixture({
    respond: (r, { metadata, wire }) => {
      if (r.method === 'GET') throw Error('SYNTHETIC_PRIVATE_TRANSPORT');
      return wire({ ...metadata, id: 101 });
    },
  });
  const unresolved = await unknown.cleanup.cleanup({ receipt: unknown.receipt, closure: unknown.closure });
  assert.equal(unresolved.state, 'cleanup_ambiguous');
  assert.equal(unresolved.absenceVerified, false);
  assert.equal(unresolved.residual, true);
});

test('journal failure, asynchronous durability and budget failure cannot permit an unrecorded DELETE', async () => {
  for (const event of ['native_cleanup_evidence', 'native_cleanup_intent']) {
    const f = await fixture({ failJournal: (row) => row.event === event });
    const r = await f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure });
    assert.equal(r.state, 'cleanup_blocked');
    assert.equal(f.calls.length, 0);
    await assert.rejects(f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure }), fixed);
  }
  const f = await fixture({
    admit: () => {
      throw Error('SYNTHETIC_SHARED_BUDGET_EXHAUSTED');
    },
  });
  const r = await f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure });
  assert.equal(r.state, 'cleanup_ambiguous');
  assert.equal(f.calls.length, 0);
  const asynchronous = await fixture();
  const journal = createFoundationControlJournal({ durableAppend: async () => {} });
  const denied = createFoundationNativeCleanup({ ...asynchronous.ports, journal });
  assert.equal(
    (await denied.cleanup({ receipt: asynchronous.receipt, closure: asynchronous.closure })).state,
    'cleanup_blocked',
  );
  assert.equal(asynchronous.calls.length, 0);
  const finalFailure = await fixture({ failJournal: (row) => row.event === 'native_cleanup_result' });
  const final = await finalFailure.cleanup.cleanup({
    receipt: finalFailure.receipt,
    closure: finalFailure.closure,
  });
  assert.equal(final.state, 'cleanup_ambiguous');
  assert.equal(final.residual, true);
  assert.equal(final.deleteAcknowledged, true);
  assert.equal(final.absenceVerified, true);
  await assert.rejects(
    finalFailure.cleanup.cleanup({ receipt: finalFailure.receipt, closure: finalFailure.closure }),
    fixed,
  );
});

test('an expired or advanced-during-flush clock prevents HTTP, without extending cleanup admission', async () => {
  const f = await fixture();
  f.setClock(instant + 60000);
  await assert.rejects(f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure }), fixed);
  assert.equal(f.calls.length, 0);
  let g;
  g = await fixture({
    failJournal: (row) => {
      if (row.event === 'native_cleanup_intent') g.setClock(instant + 60000);
      return false;
    },
  });
  const r = await g.cleanup.cleanup({ receipt: g.receipt, closure: g.closure });
  assert.equal(r.state, 'cleanup_ambiguous');
  assert.equal(g.calls.length, 0);
});

test('one shared journal fence prevents concurrent cleanup and repeated acknowledged IDs', async () => {
  let release;
  const f = await fixture({
    respond: async (r, { metadata, wire }) => {
      if (r.method === 'DELETE') {
        await new Promise((resolve) => {
          release = resolve;
        });
        return wire({ ...metadata, id: 101 });
      }
      return wire({}, 404);
    },
  });
  const first = f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure });
  const second = createFoundationNativeCleanup(f.ports);
  await assert.rejects(second.cleanup({ receipt: f.receipt, closure: f.closure }), fixed);
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  release();
  assert.equal((await first).state, 'native_record_deleted');
  await assert.rejects(second.cleanup({ receipt: f.receipt, closure: f.closure }), fixed);
  assert.equal(f.calls.length, 2);
});

test('bounded unknown transport does not become a closure or successful erasure claim', async () => {
  const f = await fixture({
    ports: { requestTimeoutMs: 5 },
    respond: (r, { wire }) => (r.method === 'DELETE' ? new Promise(() => {}) : wire({}, 404)),
  });
  const r = await f.cleanup.cleanup({ receipt: f.receipt, closure: f.closure });
  assert.equal(r.state, 'cleanup_ambiguous');
  assert.equal(r.physicalErasureVerified, false);
  assert.equal(f.cleanup.snapshot().pendingTransportCalls, 1);
  assert.equal(f.calls.length, 2);
});

test('prior durable intent survives fresh adapters and120 IDs bound every cleanup attempt', async () => {
  const f = await fixture();
  for (let i = 0; i < 120; i++) {
    const receipt = i === 0 ? f.receipt : await f.nextReceipt(String(101 + i));
    assert.equal((await f.cleanup.cleanup({ receipt, closure: f.closure })).state, 'native_record_deleted');
  }
  const receipt = await f.nextReceipt('221');
  await assert.rejects(f.cleanup.cleanup({ receipt, closure: f.closure }), fixed);
  assert.equal(f.calls.length, 240);
  assert.equal(f.cleanup.snapshot().deleteAttempts, 120);
  assert.equal(f.cleanup.snapshot().absenceReads, 120);
  const old = await fixture({ previousEvents: f.journal.rows });
  await assert.rejects(old.cleanup.cleanup({ receipt: old.receipt, closure: old.closure }), fixed);
  assert.equal(old.calls.length, 0);
});

test('cleanup consumes the actual shared2048 counter with exact delete and absence context', async () => {
  const f = await fixture();
  const budget = createFoundationControlBudget({
    journal: f.journal,
    now: f.ports.now,
    deadlineAt: f.ports.deadlineAt,
  });
  const cleanup = createFoundationNativeCleanup({ ...f.ports, admitControlAttempt: budget.admit });
  assert.equal(
    (await cleanup.cleanup({ receipt: f.receipt, closure: f.closure })).state,
    'native_record_deleted',
  );
  assert.equal(budget.snapshot().attempts, 2);
  assert.deepEqual(
    f.journal.rows
      .filter((r) => r.event === 'control_request_intent')
      .map((r) => [r.kind, r.workflowId, r.executionId]),
    [
      ['delete', f.receipt.workflowId, '101'],
      ['absence', f.receipt.workflowId, '101'],
    ],
  );
  const exhausted = await fixture({
    previousEvents: Array.from({ length: 2048 }, (_, i) => ({
      event: 'control_request_intent',
      ordinal: i + 1,
      kind: 'discovery',
    })),
  });
  const full = createFoundationControlBudget({
    journal: exhausted.journal,
    now: exhausted.ports.now,
    deadlineAt: exhausted.ports.deadlineAt,
  });
  const blocked = createFoundationNativeCleanup({ ...exhausted.ports, admitControlAttempt: full.admit });
  assert.equal(
    (await blocked.cleanup({ receipt: exhausted.receipt, closure: exhausted.closure })).state,
    'cleanup_ambiguous',
  );
  assert.equal(full.snapshot().attempts, 2048);
  assert.equal(exhausted.calls.length, 0);
});
