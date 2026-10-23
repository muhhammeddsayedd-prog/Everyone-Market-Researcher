import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFoundationControlJournal,
  assertFoundationControlJournal,
  createFoundationControlBudget,
  assertFoundationControlBudget,
} from './foundation-control-state.mjs';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';

const deadlineAt = Date.parse('2026-10-19T10:00:00Z');
const startAt = deadlineAt - 3600000;
const workflowId = foundationRuntimeCheckpoint.workflows['WF-00'].id;
function fixture(previousEvents = []) {
  let clock = startAt;
  const writes = [];
  const journal = createFoundationControlJournal({
    durableAppend: (row) => {
      writes.push(row);
    },
    previousEvents,
  });
  const budget = createFoundationControlBudget({ journal, now: () => clock, deadlineAt });
  return {
    journal,
    budget,
    writes,
    time: (t) => {
      clock = t;
    },
  };
}
const rejects = (fn) => assert.throws(fn, /^Error: FOUNDATION_CONTROL_STATE_BLOCKED$/);

test('journal requires a synchronous explicit durable port and admits only safe projection fields', () => {
  rejects(() => createFoundationControlJournal({}));
  rejects(() => createFoundationControlJournal({ durableAppend: () => {}, previousEvents: [{}] }));
  const f = fixture();
  for (const bad of [
    { data: {} },
    { headers: {} },
    { error: 'secret' },
    { body: 'raw' },
    { status: 'bad\ntext' },
  ]) {
    rejects(() => f.journal.append({ event: 'test', ...bad }));
  }
  f.journal.append({
    event: 'native_full_receipt',
    executionId: '123',
    workflowId,
    nativeGatewayRequests: [{ requestId: '12345678-1234-1234-1234-123456789012', operation: 'identity' }],
    missingNativeChildCalls: [
      { key: 'WF-30', targetWorkflowId: workflowId, sourceNode: 'Call child', sourceRun: 0 },
    ],
    errorDispatchExpected: true,
    nativeProviderCallback: { apifyRunId: 'OriginalRun123', eventType: 'ACTOR.RUN.SUCCEEDED' },
  });
  assert.equal(f.writes.length, 1);
  assert.equal(f.journal.rows.length, 1);
  assert.ok(Object.isFrozen(f.writes[0].missingNativeChildCalls[0]));
  assert.throws(() => {
    f.journal.rows.push({});
  });
  assert.equal(assertFoundationControlJournal(f.journal), f.journal);
  rejects(() => assertFoundationControlJournal({ ...f.journal }));
});

test('uncertain async or throwing durable append fences further writes', async () => {
  for (const durableAppend of [
    async () => {},
    () => {
      throw Error('private');
    },
  ]) {
    const j = createFoundationControlJournal({ durableAppend });
    rejects(() => j.append({ event: 'test' }));
    rejects(() => j.append({ event: 'test' }));
    assert.equal(j.rows.length, 0);
  }
  await Promise.resolve();
});

test('the shared 2048 request budget replaces416 and cannot be copied, recreated or replenished', () => {
  const f = fixture();
  assert.equal(
    createFoundationControlBudget({ journal: f.journal, now: () => startAt, deadlineAt }),
    f.budget,
  );
  assert.equal(assertFoundationControlBudget(f.budget, { journal: f.journal, deadlineAt }), f.budget);
  rejects(() => assertFoundationControlBudget({ ...f.budget }, { journal: f.journal, deadlineAt }));
  rejects(() => assertFoundationControlBudget(f.budget, { journal: fixture().journal, deadlineAt }));
  rejects(() => createFoundationControlBudget({ journal: f.journal, deadlineAt: deadlineAt + 1 }));
  for (let i = 0; i < 2048; i++) f.budget.admit({ kind: 'workflow', workflowId });
  assert.equal(f.budget.snapshot().attempts, 2048);
  rejects(() => f.budget.admit({ kind: 'workflow', workflowId }));
  assert.equal(f.writes.length, 2048);
  const restored = fixture(f.journal.rows);
  assert.equal(restored.budget.snapshot().attempts, 2048);
  rejects(() => restored.budget.admit({ kind: 'start', workflowId }));
});

test('the eight-metadata ceiling is shared across reader recreations and reconstructed journals', () => {
  const f = fixture();
  for (let i = 0; i < 8; i++) f.budget.admit({ kind: 'metadata', workflowId, executionId: '123' });
  rejects(() => f.budget.admit({ kind: 'metadata', workflowId, executionId: '123' }));
  const restored = fixture(f.journal.rows);
  rejects(() => restored.budget.admit({ kind: 'metadata', workflowId, executionId: '123' }));
  restored.budget.admit({ kind: 'metadata', workflowId, executionId: '124' });
  assert.equal(restored.budget.snapshot().attempts, 9);
});

test('a382-row mixed journal charges381 control intents and preserves the next sequential ordinal', () => {
  const intents = Array.from({ length: 381 }, (_, i) => ({
    event: 'control_request_intent',
    ordinal: i + 1,
    kind: 'discovery',
    workflowId,
    at: new Date(startAt).toISOString(),
  }));
  const rows = [
    ...intents.slice(0, 353),
    {
      event: 'browser_port_preflight_verified',
      kind: 'browser_ui',
      workflowId,
      at: new Date(startAt).toISOString(),
    },
    ...intents.slice(353),
  ];
  const f = fixture(rows);
  assert.equal(f.journal.rows.length, 382);
  assert.equal(f.budget.snapshot().mainAttempts, 381);
  assert.equal(f.budget.snapshot().attempts, 381);
  assert.equal(f.budget.snapshot().carriedAttempts, 0);
  f.budget.admit({ kind: 'discovery', workflowId });
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].ordinal, 382);
  assert.equal(f.budget.snapshot().attempts, 382);
  assert.equal(f.journal.rows.length, 383);
  rejects(() => fixture(rows.map((row) => (row.ordinal === 381 ? { ...row, ordinal: 382 } : row))));
  rejects(() => fixture(rows.map((row) => (row.ordinal === 381 ? { ...row, workflowId: 'FOREIGN' } : row))));
});

test('mixed rows and a lookalike project continuation cannot manufacture branded carried-budget authority', () => {
  const journal = createFoundationControlJournal({
    durableAppend: () => {},
    previousEvents: [
      {
        event: 'control_request_intent',
        ordinal: 1,
        kind: 'discovery',
        workflowId,
        at: new Date(startAt).toISOString(),
      },
      {
        event: 'browser_port_preflight_verified',
        kind: 'browser_ui',
        workflowId,
        at: new Date(startAt).toISOString(),
      },
    ],
  });
  const forged = Object.freeze({
    kind: 'foundation_project_verified_continuation',
    startsAt: startAt,
    stopNewAt: deadlineAt - 600000,
    deadlineAt,
    carriedControlAttempts: 1,
  });
  assert.throws(
    () =>
      createFoundationControlBudget({
        journal,
        now: () => startAt,
        deadlineAt,
        projectVerifiedContinuationProof: forged,
      }),
    /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
  );
  assert.throws(
    () =>
      createFoundationControlBudget({
        journal,
        now: () => startAt,
        deadlineAt,
        projectVerifiedContinuationProof: { ...forged },
      }),
    /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
  );
  assert.equal(journal.rows.length, 2);
});

test('budget validates replay sequence and metadata context before creating authority', () => {
  const row = {
    event: 'control_request_intent',
    ordinal: 1,
    kind: 'metadata',
    workflowId,
    executionId: '123',
    at: new Date(startAt).toISOString(),
  };
  rejects(() => fixture([{ ...row, ordinal: 2 }]));
  rejects(() => fixture([{ ...row, kind: 'raw_get' }]));
  rejects(() => fixture([{ ...row, executionId: 'untrusted' }]));
  rejects(() => fixture([{ ...row, workflowId: 'unrelated' }]));
  rejects(() => fixture(Array.from({ length: 9 }, (_, i) => ({ ...row, ordinal: i + 1 }))));
  const f = fixture();
  for (const bad of [
    { kind: 'raw_get' },
    { kind: 'workflow', workflowId: 'unrelated' },
    { kind: 'metadata', workflowId },
    { kind: 'metadata', workflowId, executionId: '0001' },
  ])
    rejects(() => f.budget.admit(bad));
  assert.equal(f.writes.length, 0);
});

test('deadline and a failed ledger stop network admission without exposing private errors', () => {
  const f = fixture();
  f.time(deadlineAt);
  rejects(() => f.budget.admit({ kind: 'start', workflowId }));
  assert.equal(f.writes.length, 0);
  let clock = startAt;
  const j = createFoundationControlJournal({
    durableAppend: () => {
      clock = deadlineAt;
    },
  });
  const b = createFoundationControlBudget({ journal: j, now: () => clock, deadlineAt });
  rejects(() => b.admit({ kind: 'start', workflowId }));
  assert.equal(j.rows.length, 1);
  assert.equal(b.snapshot().stopped, true);
  const failed = createFoundationControlJournal({
    durableAppend: () => {
      throw Error('never surface private message');
    },
  });
  const failedBudget = createFoundationControlBudget({ journal: failed, now: () => startAt, deadlineAt });
  rejects(() => failedBudget.admit({ kind: 'start', workflowId }));
  assert.equal(failedBudget.snapshot().stopped, true);
  rejects(() => failedBudget.admit({ kind: 'start', workflowId }));
});
