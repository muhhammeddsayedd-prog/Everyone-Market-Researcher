import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFoundationControlJournal,
  assertFoundationControlJournal,
  createFoundationControlBudget,
  assertFoundationControlBudget,
} from './foundation-control-state.mjs';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

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

test('genuine20 Control requires monotonic1728 Management custody and preserves the3584/5312 ceilings', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    technical19Restored: true,
    technical20SourceSelected: true,
  });
  try {
    const proof = f.claim(f.admit()),
      core = await f.copy('foundation-control-state.mjs');
    const rows = readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse);
    assert.equal(rows.length, 1118);
    for (const mode of ['missing', 'throw', 'low', 'fraction', 'high', 'backwards', 'cap']) {
      const writes = [],
        journal = core.createFoundationControlJournal({
          previousEvents: rows,
          durableAppend(row) {
            writes.push(row);
          },
        });
      let count = mode === 'cap' ? 1728 : 1317;
      const args = {
        journal,
        now: f.now,
        deadlineAt: proof.deadlineAt,
        projectVerifiedContinuationProof: proof,
        ...(mode === 'missing'
          ? {}
          : {
              managementAttempts: () => {
                if (mode === 'throw') throw Error('SYNTHETIC_COUNTER_ERROR');
                return mode === 'low' ? 1316 : mode === 'fraction' ? 1317.5 : mode === 'high' ? 1729 : count;
              },
            }),
      };
      if (mode === 'backwards') {
        const budget = core.createFoundationControlBudget(args);
        count = 1316;
        assert.throws(
          () => budget.admit({ kind: 'discovery', workflowId }),
          /FOUNDATION_CONTROL_STATE_BLOCKED/,
        );
      } else if (mode === 'cap') {
        const budget = core.createFoundationControlBudget(args);
        assert.equal(budget.snapshot().attempts, 1246);
        assert.equal(budget.snapshot().maximum, 3584);
        while (budget.snapshot().attempts < 3584) budget.admit({ kind: 'discovery', workflowId });
        assert.equal(budget.snapshot().attempts + count, 5312);
        const before = writes.length;
        assert.throws(
          () => budget.admit({ kind: 'discovery', workflowId }),
          /FOUNDATION_CONTROL_STATE_BLOCKED/,
        );
        assert.equal(writes.length, before);
      } else
        assert.throws(() => core.createFoundationControlBudget(args), /FOUNDATION_CONTROL_STATE_BLOCKED/);
      if (mode !== 'cap') assert.equal(writes.length, 0);
    }
  } finally {
    f.cleanup();
  }
});

test('genuine576 profile accepts382 mixed rows as381 intents plus3 carried controls and enforces combined2560', async () => {
  const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
  try {
    const proof = f.claim(f.admit()),
      core = await f.copy('foundation-control-state.mjs');
    const rows = readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
      writes = [];
    const journal = core.createFoundationControlJournal({
      previousEvents: rows,
      durableAppend: (row) => {
        writes.push(row);
      },
    });
    const budget = core.createFoundationControlBudget({
      journal,
      now: f.now,
      deadlineAt: proof.deadlineAt,
      projectVerifiedContinuationProof: proof,
      managementAttempts: () => 576,
    });
    assert.equal(journal.rows.length, 382);
    assert.equal(budget.snapshot().mainAttempts, 381);
    assert.equal(budget.snapshot().carriedAttempts, 3);
    assert.equal(budget.snapshot().attempts, 384);
    assert.equal(budget.snapshot().maximum, 2048);
    for (let i = 0; i < 1600; i++) budget.admit({ kind: 'discovery', workflowId });
    assert.equal(budget.snapshot().attempts, 1984);
    assert.equal(writes.at(-1).ordinal, 1981);
    assert.throws(() => budget.admit({ kind: 'discovery', workflowId }), /FOUNDATION_CONTROL_STATE_BLOCKED/);
    assert.equal(writes.length, 1600);
    assert.equal(budget.snapshot().attempts + 576, 2560);
  } finally {
    f.cleanup();
  }
});

test('new576 control pool refuses missing, throwing, invalid or backwards authoritative management counters before intents', async () => {
  for (const mode of ['missing', 'throw', 'low', 'fraction', 'high', 'backwards']) {
    const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
    try {
      const proof = f.claim(f.admit()),
        core = await f.copy('foundation-control-state.mjs');
      const rows = readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
        writes = [];
      const journal = core.createFoundationControlJournal({
        previousEvents: rows,
        durableAppend: (row) => {
          writes.push(row);
        },
      });
      let count = 152;
      const args = {
        journal,
        now: f.now,
        deadlineAt: proof.deadlineAt,
        projectVerifiedContinuationProof: proof,
        ...(mode === 'missing'
          ? {}
          : {
              managementAttempts: () => {
                if (mode === 'throw') throw Error('PRIVATE_CALLBACK_CANARY');
                return mode === 'low' ? 151 : mode === 'fraction' ? 152.5 : mode === 'high' ? 577 : count;
              },
            }),
      };
      if (mode === 'backwards') {
        const budget = core.createFoundationControlBudget(args);
        count = 151;
        assert.throws(
          () => budget.admit({ kind: 'discovery', workflowId }),
          /FOUNDATION_CONTROL_STATE_BLOCKED/,
        );
      } else
        assert.throws(() => core.createFoundationControlBudget(args), /FOUNDATION_CONTROL_STATE_BLOCKED/);
      assert.equal(writes.length, 0);
    } finally {
      f.cleanup();
    }
  }
});

test('genuine settled17 control pool preserves the exact reconciled mixed native history and metadata ceiling', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    technical16Settled: true,
    technical16MixedControl: true,
  });
  try {
    const proof = f.claim(f.admit()),
      core = await f.copy('foundation-control-state.mjs'),
      rows = readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
      intents = rows.filter((row) => row.event === 'control_request_intent'),
      writes = [];
    assert.equal(rows.length, 964);
    assert.equal(intents.length, 949);
    assert.equal(intents.filter((row) => row.kind !== 'discovery').length, 8);
    const journal = core.createFoundationControlJournal({
      previousEvents: rows,
      durableAppend: (row) => {
        writes.push(row);
      },
    });
    const args = {
      now: f.now,
      deadlineAt: proof.deadlineAt,
      projectVerifiedContinuationProof: proof,
      managementAttempts: () => 963,
    };
    const budget = core.createFoundationControlBudget({ journal, ...args });
    assert.equal(budget.snapshot().mainAttempts, 949);
    assert.equal(budget.snapshot().carriedAttempts, 145);
    assert.equal(budget.snapshot().attempts, 1094);
    assert.equal(budget.snapshot().maximum, 3456);
    assert.equal(writes.length, 0);
    const tampered = structuredClone(rows),
      metadata = tampered.find((row) => row.event === 'control_request_intent' && row.kind === 'metadata');
    metadata.kind = 'discovery';
    delete metadata.executionId;
    const alteredJournal = core.createFoundationControlJournal({
      previousEvents: tampered,
      durableAppend: () => {},
    });
    assert.throws(
      () => core.createFoundationControlBudget({ journal: alteredJournal, ...args }),
      /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
    );
    budget.admit({ kind: 'workflow', workflowId });
    assert.equal(writes[0].ordinal, 950);
    for (let i = 0; i < 7; i++) budget.admit({ kind: 'metadata', workflowId, executionId: '31130' });
    assert.throws(
      () => budget.admit({ kind: 'metadata', workflowId, executionId: '31130' }),
      /FOUNDATION_CONTROL_STATE_BLOCKED/,
    );
    assert.equal(writes.length, 8);
    assert.equal(budget.snapshot().attempts, 1102);
  } finally {
    f.cleanup();
  }
});

for (const profile of [576, 640, 704, 832, 1024])
  test(`genuine linked${profile} Management andControl snapshots enforce2560 in both directions with no counter or intent reset`, async () => {
    for (const direction of ['management', 'control']) {
      const f = await syntheticProjectVerifiedContinuation(
        profile === 1024
          ? { runtimeRestorationClosed: true, runtimeRestorationAllocation: true }
          : profile === 832
            ? { runtimePreparationClosed: true, runtimeMetadataAllocation: true }
            : profile === 704
              ? { catalogReadonly: true, catalogManagementAllocation: true }
              : profile === 640
                ? { closedFixture: true }
                : { managementAllocation: true },
      );
      let management;
      try {
        const proof = f.claim(f.admit()),
          checkpoint = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof),
          runtime = await f.copy('foundation-live-runtime.mjs'),
          core = await f.copy('foundation-control-state.mjs');
        let control;
        management = runtime.createFoundationLiveManagementBudget(
          { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
          {
            directory: dirname(f.paths.management),
            now: f.now,
            projectVerifiedContinuationProof: proof,
            controlAttempts: () => control?.snapshot().attempts ?? checkpoint.aggregateControlAttempts,
          },
        );
        const writes = [],
          journal = core.createFoundationControlJournal({
            previousEvents: readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
            durableAppend: (row) => {
              writes.push(row);
            },
          });
        control = core.createFoundationControlBudget({
          journal,
          now: f.now,
          deadlineAt: proof.deadlineAt,
          projectVerifiedContinuationProof: proof,
          managementAttempts: () => management.snapshot().attempts,
        });
        const managementTarget =
          direction === 'management' ? Math.max(512, checkpoint.aggregateManagementAttempts) : profile;
        while (management.snapshot().attempts < managementTarget) management.admit();
        while (control.snapshot().attempts < 2560 - managementTarget)
          control.admit({ kind: 'discovery', workflowId });
        const prior = readFileSync(f.paths.management, 'utf8'),
          count = writes.length;
        assert.equal(management.snapshot().attempts + control.snapshot().attempts, 2560);
        if (direction === 'management') {
          assert.equal(management.snapshot().attempts < management.snapshot().maximum, true);
          assert.throws(() => management.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
        } else {
          assert.equal(control.snapshot().attempts < control.snapshot().maximum, true);
          assert.throws(
            () => control.admit({ kind: 'discovery', workflowId }),
            /FOUNDATION_CONTROL_STATE_BLOCKED/,
          );
        }
        assert.equal(readFileSync(f.paths.management, 'utf8'), prior);
        assert.equal(writes.length, count);
        assert.equal(management.snapshot().carriedAttempts, profile >= 704 ? 11 : 10);
        assert.equal(control.snapshot().carriedAttempts, 3);
      } finally {
        management?.close();
        f.cleanup();
      }
    }
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
