import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { syntheticClockAmendment } from './foundation-live-clock-amendment-fixtures.mjs';
import { syntheticZeroSetup } from './foundation-live-runtime-resume-fixtures.mjs';
import { createFoundationLiveManagementBudget } from './foundation-live-runtime.mjs';
import { createFoundationLiveAcceptanceSession } from './foundation-live-runtime-cli.mjs';
import { assertFoundationLiveClockAmendmentProof } from './foundation-live-clock-amendment.mjs';
import { fixture } from './foundation-live-runtime-fixtures.mjs';

test('amended budget keeps original header bytes and consumes the same512 ordinal admissions exactly once', () => {
  const f = fixture(),
    clock = syntheticClockAmendment(),
    p = clock.claim(clock.admit());
  let budget;
  const path = join(f.directory, 'management.jsonl');
  writeFileSync(path, clock.header);
  try {
    budget = createFoundationLiveManagementBudget(
      { sourceCommitSha: p.sourceCommitSha, deadlineAt: p.deadlineAt },
      { directory: f.directory, now: clock.now, clockAmendmentProof: p },
    );
    assert.equal(budget.snapshot().deadlineAt, p.deadlineAt);
    assert.equal(budget.snapshot().maximum, 512);
    for (let i = 0; i < 512; i++) budget.admit();
    assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
    const rows = readFileSync(path, 'utf8').trimEnd().split('\n');
    assert.equal(rows[0] + '\n', clock.header);
    assert.equal(rows.length, 513);
    assert.equal(JSON.parse(rows.at(-1)).ordinal, 512);
    budget.close();
    budget = null;
    assert.throws(
      () =>
        createFoundationLiveManagementBudget(
          { sourceCommitSha: p.sourceCommitSha, deadlineAt: p.deadlineAt },
          { directory: f.directory, now: clock.now, clockAmendmentProof: p },
        ),
      /FOUNDATION_LIVE_RUNTIME_BLOCKED/,
    );
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('runtime amendment requires a claimed proof and propagates the same branded clock to administrator and controls', async () => {
  const f = fixture(),
    clock = syntheticClockAmendment(),
    admitted = clock.admit();
  let session, args;
  const packet = {
    kind: 'm03_acceptance_private_input',
    version: 1,
    approvedHead: admitted.sourceCommitSha,
    approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
    sourceCommitSha: admitted.sourceCommitSha,
    managementKey: 'SYNTHETIC_CLOCK_MANAGEMENT',
    writerPassword: 'SYNTHETIC_CLOCK_WRITER',
    apifyReadToken: 'SYNTHETIC_CLOCK_READER',
    machineToken: 'M'.repeat(43),
    protectionBypass: 'B'.repeat(32),
    leaseExpiry: clock.now() + 7200000,
  };
  writeFileSync(join(f.directory, 'management.jsonl'), clock.header);
  try {
    assert.throws(
      () =>
        createFoundationLiveAcceptanceSession(packet, () => {}, {
          clockAmendmentProof: admitted,
          now: clock.now,
          storage: { directory: f.directory },
        }),
      /M03_CLOCK_AMENDMENT_BLOCKED/,
    );
    assert.throws(() => syntheticZeroSetup(clock.now()), /M03_ZERO_SETUP_BLOCKED/);
    const claimed = clock.claim(admitted);
    session = createFoundationLiveAcceptanceSession(packet, () => {}, {
      clockAmendmentProof: claimed,
      now: clock.now,
      storage: { directory: f.directory },
      createNativeTransport: () => ({
        request: async () => ({
          status: 200,
          body: (async function* () {
            yield Buffer.from('{"data":[],"nextCursor":null}');
          })(),
          closed: Promise.resolve(),
        }),
        state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
        close() {},
      }),
      startAdmin: async (a) => {
        args = a;
        return {
          postcheck: async () => {
            throw Error('SYNTHETIC_BOUNDARY');
          },
          end: async () => ({
            nativeExit: 0,
            childClosed: true,
            receipt: { childrenClosed: true, handoffDeleted: true, leaseDeleted: true, scratchDeleted: true },
          }),
        };
      },
    });
    assert.equal(session.deadlineAt, claimed.deadlineAt);
    const result = await session.command({
      kind: 'm03_acceptance_command',
      id: 'clock_prepare',
      command: 'prepare',
    });
    assert.equal(result.status, 'blocked');
    assert.equal(result.controlAttempts, 50);
    assert.equal(
      assertFoundationLiveClockAmendmentProof(args.clockAmendmentProof, { claimed: true }),
      claimed,
    );
    assert.deepEqual(Object.keys(args).sort(), ['clockAmendmentProof', 'now', 'repositoryRoot']);
    assert.equal((await session.close()).adminChildClosed, true);
    assert.equal(readFileSync(join(f.directory, 'management.jsonl'), 'utf8'), clock.header);
  } finally {
    await session?.close();
    f.cleanup();
  }
});
