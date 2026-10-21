import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { syntheticPostcheckContinuation } from './foundation-live-postcheck-fixtures.mjs';
import { syntheticClockAmendment } from './foundation-live-clock-amendment-fixtures.mjs';
import { assertFoundationLivePostcheckContinuationProof } from './foundation-live-postcheck-continuation.mjs';
import { createFoundationLiveManagementBudget } from './foundation-live-runtime.mjs';
import { createFoundationLiveAcceptanceSession } from './foundation-live-runtime-cli.mjs';
import {
  createFoundationControlJournal,
  createFoundationControlBudget,
} from './foundation-control-state.mjs';

const packet = (clock) => ({
  kind: 'm03_acceptance_private_input',
  version: 1,
  approvedHead: clock.checkpoint.sourceCommitSha,
  approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
  sourceCommitSha: clock.checkpoint.sourceCommitSha,
  managementKey: 'SYNTHETIC_CONTINUATION_MANAGEMENT',
  writerPassword: 'SYNTHETIC_CONTINUATION_WRITER',
  apifyReadToken: 'SYNTHETIC_CONTINUATION_READER',
  machineToken: 'M'.repeat(43),
  protectionBypass: 'B'.repeat(32),
  leaseExpiry: clock.now() + 7200000,
});
function directoryFixture(clock) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-postcheck-runtime-'));
  writeFileSync(join(directory, 'management.jsonl'), clock.header);
  writeFileSync(join(directory, 'control.jsonl'), clock.controlPrefix);
  return { directory, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

test('postcheck continuation preserves original header and control50 while enforcing the remaining512+1998 admissions', () => {
  const clock = syntheticPostcheckContinuation(),
    proof = clock.claim(clock.admit()),
    f = directoryFixture(clock);
  let budget;
  try {
    budget = createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      { now: clock.now, directory: f.directory, postcheckContinuationProof: proof },
    );
    const controlPath = join(f.directory, 'control.jsonl'),
      journal = createFoundationControlJournal({
        previousEvents: clock.controlPrefix.trimEnd().split('\n').map(JSON.parse),
        durableAppend: (row) => appendFileSync(controlPath, JSON.stringify(row) + '\n'),
      }),
      control = createFoundationControlBudget({ journal, now: clock.now, deadlineAt: proof.deadlineAt });
    assert.equal(control.snapshot().attempts, 50);
    for (let i = 0; i < 512; i++) budget.admit();
    for (let i = 0; i < 1998; i++) control.admit({ kind: 'discovery' });
    assert.equal(budget.snapshot().maximum, 512);
    assert.equal(control.snapshot().maximum, 2048);
    assert.throws(() => budget.admit(), /FOUNDATION_LIVE_RUNTIME_BLOCKED/);
    assert.throws(() => control.admit({ kind: 'discovery' }), /FOUNDATION_CONTROL_STATE_BLOCKED/);
    const management = readFileSync(join(f.directory, 'management.jsonl'), 'utf8');
    assert.equal(management.split('\n')[0] + '\n', clock.header);
    assert.equal(JSON.parse(management.trimEnd().split('\n').at(-1)).ordinal, 512);
    const saved = readFileSync(controlPath, 'utf8');
    assert.equal(saved.startsWith(clock.controlPrefix), true);
    assert.equal(JSON.parse(saved.trimEnd().split('\n').at(-1)).ordinal, 2048);
    budget.close();
    budget = null;
    assert.throws(
      () =>
        createFoundationLiveManagementBudget(
          { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
          { now: clock.now, directory: f.directory, postcheckContinuationProof: proof },
        ),
      /FOUNDATION_LIVE_RUNTIME_BLOCKED/,
    );
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('continuation starts with control50 and fresh baseline discovery advances to100 before the claimed no-replay admin port', async () => {
  const clock = syntheticPostcheckContinuation(),
    proof = clock.claim(clock.admit()),
    f = directoryFixture(clock);
  let session, adminArgs;
  try {
    session = createFoundationLiveAcceptanceSession(packet(clock), () => {}, {
      now: clock.now,
      storage: { directory: f.directory },
      postcheckContinuationProof: proof,
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
      startAdmin: async (args) => {
        adminArgs = args;
        return {
          postcheck: async () => {
            throw Error('SYNTHETIC_POSTCHECK_BOUNDARY');
          },
          end: async () => ({
            nativeExit: 0,
            childClosed: true,
            receipt: { childrenClosed: true, handoffDeleted: true, leaseDeleted: true, scratchDeleted: true },
          }),
        };
      },
    });
    const state = await session.command({ kind: 'm03_acceptance_command', id: 'initial', command: 'state' });
    assert.equal(state.controlAttempts, 50);
    assert.equal(state.managementAttempts, 0);
    const prepared = await session.command({
      kind: 'm03_acceptance_command',
      id: 'prepare',
      command: 'prepare',
    });
    assert.equal(prepared.status, 'blocked');
    assert.equal(prepared.controlAttempts, 100);
    assert.equal(
      assertFoundationLivePostcheckContinuationProof(adminArgs.postcheckContinuationProof, { claimed: true }),
      proof,
    );
    assert.deepEqual(Object.keys(adminArgs).sort(), ['now', 'postcheckContinuationProof', 'repositoryRoot']);
    assert.equal(
      readFileSync(join(f.directory, 'control.jsonl'), 'utf8').startsWith(clock.controlPrefix),
      true,
    );
    assert.equal(readFileSync(join(f.directory, 'management.jsonl'), 'utf8'), clock.header);
    assert.equal((await session.close()).adminChildClosed, true);
  } finally {
    await session?.close();
    f.cleanup();
  }
});

test('continuation rejects copied/unclaimed/mixed clocks and any missing or altered retained control prefix', () => {
  for (const fault of ['copy', 'unclaimed', 'mixed', 'missing_control', 'wrong_kind', 'short_lease']) {
    const clock = syntheticPostcheckContinuation(),
      admitted = clock.admit(),
      proof = fault === 'unclaimed' ? admitted : clock.claim(admitted),
      f = directoryFixture(clock);
    try {
      if (fault === 'missing_control') writeFileSync(join(f.directory, 'control.jsonl'), '');
      if (fault === 'wrong_kind')
        writeFileSync(
          join(f.directory, 'control.jsonl'),
          clock.controlPrefix.replace('"discovery"', '"workflow"'),
        );
      const old = fault === 'mixed' ? syntheticClockAmendment() : null;
      const input = packet(clock);
      if (fault === 'short_lease') input.leaseExpiry = proof.startsAt + 4500000 - 1;
      assert.throws(
        () =>
          createFoundationLiveAcceptanceSession(input, () => {}, {
            now: clock.now,
            storage: { directory: f.directory },
            postcheckContinuationProof: fault === 'copy' ? { ...proof } : proof,
            ...(old ? { clockAmendmentProof: old.claim(old.admit()) } : {}),
          }),
        /(?:M03_POSTCHECK_CONTINUATION_BLOCKED|FOUNDATION_LIVE_CHILD_BLOCKED)/,
      );
      assert.equal(readFileSync(join(f.directory, 'management.jsonl'), 'utf8'), clock.header);
    } finally {
      f.cleanup();
    }
  }
});

for (const mode of [
  'preflight_bad_budget',
  'setup_read_failure',
  'archive_lost_ack',
  'archive_wrong_ids',
  'close_without_restore',
  'archive_final_receipt',
  'archive_foreign_final',
  'archive_abort_receipt',
])
  test('unprovisioned owned fixture cleanup remains separate and once-only: ' + mode, async () => {
    const clock = syntheticPostcheckContinuation(),
      proof = clock.claim(clock.admit()),
      f = directoryFixture(clock),
      owned = {
        result: 'M03_SMOKE_FIXTURE_READY',
        company_code: 'C999',
        competitor_id: '11111111-1111-4111-a111-111111111111',
        account_id: '22222222-2222-4222-a222-222222222222',
        platform: 'website_work_page',
        url: 'https://everyone.film/about-everyone',
        competitor_status: 'active',
        account_status: 'active',
      };
    let session,
      archives = 0,
      setups = 0,
      ended = 0;
    try {
      session = createFoundationLiveAcceptanceSession(packet(clock), () => {}, {
        now: clock.now,
        storage: { directory: f.directory },
        postcheckContinuationProof: proof,
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
        startAdmin: async () => ({
          ready: {
            runId: 'synthetic-owned-admin-run',
            clockSegmentId: proof.segmentId,
            postcheckContinuation: true,
          },
          postcheck: async () => ({ ready: true, projectRef: 'zmotjsbzhzjvpelxvxlf', migrationCount: 14 }),
          fixture: async () => owned,
          preflight: async () => ({
            projectRef: 'zmotjsbzhzjvpelxvxlf',
            dailyBudgetUsd: mode === 'setup_read_failure' ? 25 : 99,
            statsDailyEnabled: false,
            errorCount24h: 0,
            notificationCooldownClear: true,
            priceBook: { 'apify/website-content-crawler': { unit: 'compute unit', usd: 0.3 } },
          }),
          archiveUnprovisioned: async () => {
            archives++;
            if (
              [
                'archive_lost_ack',
                'archive_final_receipt',
                'archive_foreign_final',
                'archive_abort_receipt',
              ].includes(mode)
            )
              throw Error('SYNTHETIC_UNKNOWN_ARCHIVE');
            return {
              result: 'M03_SMOKE_FIXTURE_ARCHIVED',
              company_code: 'C999',
              competitor_id:
                mode === 'archive_wrong_ids' ? '33333333-3333-4333-a333-333333333333' : owned.competitor_id,
              account_id: owned.account_id,
              competitor_status: 'archived',
              account_status: 'paused',
              retained_items: 0,
            };
          },
          archive: async () => {
            throw Error('PROVISIONED_ARCHIVE_FORBIDDEN');
          },
          close: async () => {
            throw Error('NONEXISTENT_WINDOW_CLOSE_FORBIDDEN');
          },
          end: async () => {
            ended++;
            if (mode === 'archive_abort_receipt') throw Error('SYNTHETIC_END_CLOSED');
            return {
              nativeExit: 0,
              childClosed: true,
              receipt: {
                runId: mode === 'archive_foreign_final' ? 'another-run' : 'synthetic-owned-admin-run',
                clockSegmentId: proof.segmentId,
                postcheckContinuation: true,
                unprovisionedFixtureArchived: ['archive_final_receipt', 'archive_foreign_final'].includes(
                  mode,
                ),
                childrenClosed: true,
                handoffDeleted: true,
                leaseDeleted: true,
                scratchDeleted: true,
              },
            };
          },
          abort: async () => ({
            nativeExit: 1,
            childClosed: true,
            receipt: {
              runId: 'synthetic-owned-admin-run',
              clockSegmentId: proof.segmentId,
              postcheckContinuation: true,
              unprovisionedFixtureArchived: true,
              childrenClosed: true,
              handoffDeleted: true,
              leaseDeleted: true,
              scratchDeleted: true,
            },
          }),
        }),
        createSetupTransport: () => {
          setups++;
          return {
            request: async () => {
              throw Error('SYNTHETIC_SETUP_READ_FAILURE');
            },
            state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
            close() {},
          };
        },
        setup: { transportValidator() {} }, // Explicit scripted-transport test port only.
      });
      const prepared = await session.command({
        kind: 'm03_acceptance_command',
        id: 'prepare',
        command: 'prepare',
      });
      assert.equal(prepared.status, 'blocked');
      assert.equal(prepared.nativeExecutions, 0);
      if (mode === 'close_without_restore') {
        const closed = await session.close();
        assert.equal(archives, 1);
        assert.equal(closed.fixtureArchived, true);
        assert.equal(closed.windowClosed, false);
        assert.equal(closed.remoteWorkSettled, false);
        assert.equal(closed.residual, true);
        assert.equal(closed.childTransportsClosed, true);
        assert.equal(ended, 1);
        return;
      }
      const restore = await session.command({
        kind: 'm03_acceptance_command',
        id: 'restore1',
        command: 'restore',
      });
      assert.equal(archives, 1);
      assert.equal(
        restore.fixtureArchived,
        ![
          'archive_lost_ack',
          'archive_wrong_ids',
          'archive_final_receipt',
          'archive_foreign_final',
          'archive_abort_receipt',
        ].includes(mode),
      );
      assert.equal(restore.windowClosed, false);
      assert.equal(restore.remoteWorkSettled, false);
      assert.equal(restore.baselineRestored, false);
      assert.equal(restore.residual, true);
      assert.equal(restore.environmentCleanupVerified, mode === 'setup_read_failure');
      const again = await session.command({
        kind: 'm03_acceptance_command',
        id: 'restore2',
        command: 'restore',
      });
      assert.equal(archives, 1, 'an unknown archive acknowledgement is never replayed');
      assert.equal(again.fixtureArchived, restore.fixtureArchived);
      const closed = await session.close();
      assert.equal(
        closed.fixtureArchived,
        ['archive_final_receipt', 'archive_abort_receipt'].includes(mode) || restore.fixtureArchived,
      );
      assert.equal(archives, 1);
      assert.equal(ended, 1);
      assert.equal(closed.adminChildClosed, true);
      assert.equal(closed.childTransportsClosed, true);
      assert.equal(closed.residual, true);
      assert.equal(setups, mode === 'setup_read_failure' ? 1 : 0);
    } finally {
      await session?.close();
      f.cleanup();
    }
  });
