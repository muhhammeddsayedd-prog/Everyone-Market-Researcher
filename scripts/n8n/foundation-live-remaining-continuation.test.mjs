import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyFoundationRemainingContinuation } from './foundation-live-remaining-continuation.mjs';
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { syntheticRemainingContinuation } from './foundation-live-remaining-fixtures.mjs';
import { dirname } from 'node:path';

test('remaining continuation exposes a separate fail-closed public verifier', () => {
  assert.equal(typeof verifyFoundationRemainingContinuation, 'function');
});

test('preapproval checkpoint verification issues no proof or admission', async () => {
  const f = await syntheticRemainingContinuation({ approved: false });
  try {
    const ready = f.check();
    assert.equal(ready.status, 'approval_required');
    assert.equal(ready.approvalRequired, true);
    assert.equal(ready.privateRead, false);
    assert.throws(() => f.admit(), /REMAINING_CONTINUATION_BLOCKED/);
    assert.equal(existsSync(f.paths.admission), false);
    assert.throws(() => f.module.assertFoundationLiveRemainingContinuationProof(ready));
  } finally {
    f.cleanup();
  }
});
test('synthetic separately approved segment is one-use, genuine and preserves old counters', async () => {
  const f = await syntheticRemainingContinuation();
  try {
    const management = readFileSync(f.paths.management, 'utf8'),
      control = readFileSync(f.paths.control, 'utf8');
    assert.equal(f.check().kind, 'remaining_continuation_ready');
    assert.equal(Object.keys(f.check()).length, 6);
    const admitted = f.admit();
    assert.throws(() => f.module.assertFoundationLiveRemainingContinuationProof(admitted, { claimed: true }));
    const claimed = f.claim(admitted);
    assert.equal(
      f.module.assertFoundationLiveRemainingContinuationProof(claimed, { claimed: true }),
      claimed,
    );
    assert.equal(claimed.carriedManagementAttempts, 3);
    assert.equal(claimed.carriedControlAttempts, 1);
    assert.throws(() =>
      f.module.assertFoundationLiveRemainingContinuationProof({ ...claimed }, { claimed: true }),
    );
    assert.throws(() => f.admit());
    assert.throws(() => f.claim(admitted));
    assert.equal(readFileSync(f.paths.management, 'utf8'), management);
    assert.equal(readFileSync(f.paths.control, 'utf8'), control);
    f.setTime(claimed.stopNewAt);
    assert.throws(() => f.read());
  } finally {
    f.cleanup();
  }
});
test('prefix changes, foreign state and partial admission fail without replay', async () => {
  for (const fault of ['management', 'new-state', 'partial']) {
    const f = await syntheticRemainingContinuation();
    try {
      if (fault === 'management')
        appendFileSync(
          f.paths.management,
          JSON.stringify({ event: 'management_attempt', ordinal: 2 }) + '\n',
        );
      if (fault === 'new-state')
        f.put(
          `scripts/db/out/m03-foundation-remaining-continuation-${f.snapshot.proposedSegmentId}-reactivation-attempt.json`,
          '{}\n',
        );
      if (fault === 'partial') f.io.writeSync = () => 0;
      assert.throws(() => f.admit());
      if (fault === 'partial') {
        assert.equal(existsSync(f.paths.admission), true);
        delete f.io.writeSync;
        assert.throws(() => f.admit());
      }
    } finally {
      f.cleanup();
    }
  }
});
test('management and control keep main ordinals while charging fixed carried attempts', async () => {
  const f = await syntheticRemainingContinuation();
  let budget;
  try {
    const proof = f.claim(f.admit()),
      runtime = await f.copy('foundation-live-runtime.mjs'),
      control = await f.copy('foundation-control-state.mjs');
    const old = readFileSync(f.paths.management, 'utf8');
    budget = runtime.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      { now: f.now, directory: dirname(f.paths.management), remainingContinuationProof: proof },
    );
    assert.equal(budget.snapshot().attempts, 4);
    assert.equal(budget.snapshot().mainAttempts, 1);
    budget.admit();
    assert.equal(budget.snapshot().attempts, 5);
    assert.equal(
      JSON.parse(readFileSync(f.paths.management, 'utf8').trimEnd().split('\n').at(-1)).ordinal,
      2,
    );
    assert.equal(readFileSync(f.paths.management, 'utf8').startsWith(old), true);
    const journal = control.createFoundationControlJournal({
      previousEvents: readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse),
      durableAppend: (r) => {
        appendFileSync(f.paths.control, JSON.stringify(r) + '\n');
      },
    });
    const cb = control.createFoundationControlBudget({
      journal,
      now: f.now,
      deadlineAt: proof.deadlineAt,
      remainingContinuationProof: proof,
    });
    assert.equal(cb.snapshot().attempts, 101);
    cb.admit({ kind: 'discovery' });
    assert.equal(cb.snapshot().attempts, 102);
    assert.equal(journal.rows.at(-1).ordinal, 101);
    assert.equal(
      control.createFoundationControlBudget({ journal, now: f.now, deadlineAt: proof.deadlineAt }),
      cb,
    );
    assert.throws(() =>
      control.createFoundationControlBudget({
        journal,
        now: f.now,
        deadlineAt: proof.deadlineAt,
        remainingContinuationProof: { ...proof },
      }),
    );
    for (let i = 5; i < 512; i++) budget.admit();
    for (let i = 102; i < 2048; i++) cb.admit({ kind: 'discovery' });
    assert.throws(() => budget.admit());
    assert.throws(() => cb.admit({ kind: 'discovery' }));
    assert.equal(budget.snapshot().mainAttempts, 509);
    assert.equal(cb.snapshot().mainAttempts, 2047);
  } finally {
    budget?.close();
    f.cleanup();
  }
});
test('only the genuine remaining proof permits the sole historical GET setup checkpoint', async () => {
  const f = await syntheticRemainingContinuation();
  try {
    const proof = f.claim(f.admit());
    const expected = {
      sourceCommitSha: proof.sourceCommitSha,
      deadlineAt: proof.deadlineAt,
      previousEvents: [{ event: 'setup_attempt', ordinal: 1, kind: 'GET', at: 1792608136543 }],
    };
    assert.equal(f.module.assertFoundationRemainingSetupResume(proof, expected), proof);
    for (const rows of [
      [{ ...expected.previousEvents[0], kind: 'POST' }],
      [...expected.previousEvents, { event: 'setup_intent', kind: 'bypass', at: f.now() }],
      [],
    ])
      assert.throws(() =>
        f.module.assertFoundationRemainingSetupResume(proof, { ...expected, previousEvents: rows }),
      );
    assert.throws(() => f.module.assertFoundationRemainingSetupResume({ ...proof }, expected));
  } finally {
    f.cleanup();
  }
});

test('live old processes, foreign parent, old bypass and changed control bytes block before admission', async () => {
  for (const fault of ['process', 'parent', 'bypass', 'control']) {
    const f = await syntheticRemainingContinuation();
    try {
      if (fault === 'process') f.io.processAlive = () => true;
      if (fault === 'parent')
        f.put(
          'synthetic-localappdata/Temp/' + f.checkpoint.parentLockFilename,
          JSON.stringify({
            kind: 'm03_clock_admission_parent',
            version: 1,
            segmentId: f.checkpoint.segmentId,
            processId: process.ppid + 1,
          }) + '\n',
        );
      if (fault === 'bypass')
        f.put(
          'synthetic-localappdata/Temp/emr-m03-acceptance-protection-bypass.dpapi',
          'SYNTHETIC NEVER DECRYPTED',
        );
      if (fault === 'control')
        appendFileSync(
          f.paths.control,
          JSON.stringify({ event: 'control_request_intent', ordinal: 101, kind: 'discovery' }) + '\n',
        );
      assert.throws(() => f.admit());
      assert.equal(existsSync(f.paths.admission), false);
    } finally {
      f.cleanup();
    }
  }
});

test('claim rechecks untouched checkpoint and never replays a partial claim', async () => {
  for (const fault of ['foreign-state', 'partial']) {
    const f = await syntheticRemainingContinuation();
    try {
      const p = f.admit();
      if (fault === 'foreign-state')
        f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'SYNTHETIC FOREIGN LOCK\n');
      else f.io.writeSync = () => 0;
      assert.throws(() => f.claim(p));
      if (fault === 'partial') {
        assert.equal(existsSync(f.paths.claim), true);
        delete f.io.writeSync;
        assert.throws(() => f.claim(p));
      }
    } finally {
      f.cleanup();
    }
  }
});

test('actual setup factory resumes one fixed GET once and emits physical ordinal2 before a synthetic transport failure', async () => {
  const f = await syntheticRemainingContinuation();
  let setup;
  try {
    const proof = f.claim(f.admit()),
      module = await f.copy('foundation-live-setup.mjs');
    const rows = [],
      calls = [],
      journal = module.createFoundationLiveSetupJournal({
        sourceCommitSha: proof.sourceCommitSha,
        previousEvents: readFileSync(f.paths.setup, 'utf8').trimEnd().split('\n').map(JSON.parse),
        durableAppend: (r) => {
          rows.push(r);
        },
      });
    const transport = {
      async request(spec) {
        calls.push({ method: spec.method, path: spec.path });
        throw Error('SYNTHETIC TRANSPORT UNKNOWN');
      },
    };
    let count = 4;
    const budget = {
      admit() {
        count++;
      },
      snapshot: () => ({ attempts: count }),
      attachTransport() {},
    };
    const input = {
      sourceCommitSha: proof.sourceCommitSha,
      deadlineAt: proof.deadlineAt,
      remainingContinuationProof: proof,
      now: f.now,
      pause: async () => {},
      journal,
      transport,
      managementBudget: budget,
      verifyDevReady: async () => ({ ready: true, migrationCount: 14, projectRef: 'zmotjsbzhzjvpelxvxlf' }),
      sensitive: {
        writerPassword: 'SYNTHETIC_ONLY',
        apifyReadToken: 'SYNTHETIC_READ_ONLY',
        machineToken: 'M'.repeat(43),
        protectionBypass: 'B'.repeat(32),
      },
    };
    const deps = {
      transportValidator: (t) => assert.equal(t, transport),
      managementBudgetValidator: (b) => assert.equal(b, budget),
    };
    setup = module.createFoundationLiveSetup(input, deps);
    assert.equal(setup.snapshot().requestCount, 1);
    assert.throws(() => module.createFoundationLiveSetup(input, deps));
    await assert.rejects(setup.prepare());
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.equal(rows[0].ordinal, 2);
    assert.equal(count, 5);
    await assert.rejects(setup.prepare());
    assert.equal(calls.length, 1);
  } finally {
    setup?.close();
    f.cleanup();
  }
});

test('postclaim byte-only drift in every retained journal blocks the first new factory request', async () => {
  for (const name of ['management', 'control', 'setup']) {
    const f = await syntheticRemainingContinuation();
    let budget;
    try {
      const p = f.claim(f.admit()),
        runtime = await f.copy('foundation-live-runtime.mjs');
      const text = readFileSync(f.paths[name], 'utf8');
      writeFileSync(
        f.paths[name],
        name === 'management'
          ? text.replace(
              '{"event":"management_header","version":1',
              '{"version":1,"event":"management_header"',
            )
          : text
              .split('\n')
              .map((r) => (r ? ' ' + r : r))
              .join('\n'),
      );
      assert.throws(() => {
        budget = runtime.createFoundationLiveManagementBudget(
          { sourceCommitSha: p.sourceCommitSha, deadlineAt: p.deadlineAt },
          { now: f.now, directory: dirname(f.paths.management), remainingContinuationProof: p },
        );
      });
    } finally {
      budget?.close();
      f.cleanup();
    }
  }
});

test('ReadClaimed requires live owners and ordinary runtime lock while preserving legitimate appended work', async () => {
  const f = await syntheticRemainingContinuation();
  try {
    const p = f.claim(f.admit());
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    assert.throws(() => f.readClaimed());
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    const publicProof = f.readClaimed();
    assert.equal(publicProof.kind, 'foundation_remaining_continuation');
    assert.throws(() =>
      f.module.assertFoundationLiveRemainingContinuationProof(publicProof, { claimed: true }),
    );
    appendFileSync(f.paths.management, JSON.stringify({ event: 'management_attempt', ordinal: 2 }) + '\n');
    for (let ordinal = 101; ordinal <= 150; ordinal++)
      appendFileSync(
        f.paths.control,
        JSON.stringify({ event: 'control_request_intent', ordinal, kind: 'discovery' }) + '\n',
      );
    f.put(
      `scripts/db/out/m03-foundation-remaining-continuation-${p.segmentId}-attempt.json`,
      '{"syntheticOwnedNewAttempt":true}\n',
    );
    assert.equal(f.readClaimed().deadlineAt, p.deadlineAt);
    f.io.processAlive = () => false;
    assert.throws(() => f.readClaimed());
    f.io.processAlive = () => true;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'FOREIGN\n');
    assert.throws(() => f.readClaimed());
  } finally {
    f.cleanup();
  }
});
