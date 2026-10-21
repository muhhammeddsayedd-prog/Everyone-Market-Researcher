import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syntheticClockAmendment } from './foundation-live-clock-amendment-fixtures.mjs';
import {
  assertFoundationLiveClockAmendmentProof,
  claimFoundationClockAmendment,
} from './foundation-live-clock-amendment.mjs';
const blocked = /M03_CLOCK_AMENDMENT_BLOCKED/;

test('clock approval check is read-only, and admission is one exclusive fixed segment preserving original bytes', () => {
  const f = syntheticClockAmendment(),
    before = new Map(f.files);
  assert.equal(f.check().kind, 'clock_amendment_ready');
  assert.deepEqual(f.files, before);
  const p = f.admit();
  assert.equal(p.startsAt, f.now());
  assert.equal(p.deadlineAt, p.startsAt + 3600000);
  assert.equal(p.stopNewAt, p.startsAt + 3000000);
  assert.equal(p.hardDeadlineAt, p.startsAt + 4200000);
  assert.equal(f.files.get(f.paths.management), f.header);
  const record = f.files.get(f.paths.admission);
  assert.throws(f.admit, blocked);
  assert.equal(f.files.get(f.paths.admission), record);
  assert.throws(() => assertFoundationLiveClockAmendmentProof(structuredClone(p)), blocked);
});

test('a runtime claim is durable once even when first child has zero attempts and its runtime lock is gone', () => {
  const f = syntheticClockAmendment(),
    p = f.admit();
  assert.throws(f.readClaimed, blocked);
  const claimed = f.claim(p);
  assert.equal(assertFoundationLiveClockAmendmentProof(claimed, { claimed: true }), claimed);
  const bytes = f.files.get(f.paths.claim);
  assert.equal(f.readClaimed().deadlineAt, claimed.deadlineAt);
  assert.throws(() => f.claim(f.read()), blocked);
  assert.throws(
    () => claimFoundationClockAmendment(f.read(), { now: f.now }, { ...f.io, processId: process.pid + 100 }),
    blocked,
  );
  assert.equal(f.files.get(f.paths.claim), bytes);
  assert.equal(f.files.get(f.paths.management), f.header);
});

test('approval tampering, nonzero initial history, wrong parent, symlinks and invalid clocks fail before admission', () => {
  for (const fault of ['approval', 'counter', 'parent', 'link', 'early']) {
    const f = syntheticClockAmendment();
    if (fault === 'approval') {
      const path = [...f.files.keys()].find(
        (p) =>
          p.endsWith(f.checkpoint.approvalRelative.replaceAll('/', '\\')) ||
          p.endsWith(f.checkpoint.approvalRelative),
      );
      f.files.set(path, f.files.get(path) + ' ');
    }
    if (fault === 'counter')
      f.files.set(f.paths.management, f.header + '{"event":"management_attempt","ordinal":1}\n');
    if (fault === 'parent')
      f.files.set(
        f.paths.parent,
        JSON.stringify({
          kind: 'm03_clock_admission_parent',
          version: 1,
          segmentId: f.checkpoint.segmentId,
          processId: process.ppid + 1,
        }),
      );
    if (fault === 'link') {
      const stat = f.io.lstatSync;
      f.io.lstatSync = (p) => (p === f.paths.management ? { isSymbolicLink: () => true } : stat(p));
    }
    if (fault === 'early') f.setTime(1);
    assert.throws(f.admit, blocked);
    assert.equal(f.files.has(f.paths.admission), false);
  }
});

test('partial or unknown admission/claim writes remain owned and cannot be retried or repaired', () => {
  for (const where of ['admission', 'claim']) {
    const f = syntheticClockAmendment();
    const p = where === 'claim' ? f.admit() : null;
    f.setShortWrite(true);
    assert.throws(() => (where === 'claim' ? f.claim(p) : f.admit()), blocked);
    const path = where === 'claim' ? f.paths.claim : f.paths.admission;
    assert.equal(f.files.has(path), true);
    const bytes = f.files.get(path);
    f.setShortWrite(false);
    assert.throws(() => (where === 'claim' ? f.claim(p) : f.admit()), blocked);
    assert.equal(f.files.get(path), bytes);
  }
});

test('Read accepts and verifies aggregate ordinal counters after claim without resetting them or issuing a new clock', () => {
  const f = syntheticClockAmendment(),
    p = f.claim(f.admit());
  f.files.set(f.paths.management, f.header + '{"event":"management_attempt","ordinal":1}\n');
  f.files.set(
    f.paths.control,
    JSON.stringify({
      event: 'control_request_intent',
      ordinal: 1,
      kind: 'discovery',
      at: new Date(f.now()).toISOString(),
    }) + '\n',
  );
  assert.equal(f.readClaimed().deadlineAt, p.deadlineAt);
  assert.equal(f.files.get(f.paths.management).includes('"ordinal":1'), true);
  f.files.set(f.paths.management, f.header + '{"event":"management_attempt","ordinal":2}\n');
  assert.throws(f.read, blocked);
});

test('an expired admitted segment cannot Read, Claim or renew itself', () => {
  const f = syntheticClockAmendment(),
    p = f.admit(),
    bytes = f.files.get(f.paths.admission);
  f.setTime(p.stopNewAt);
  assert.throws(f.read, blocked);
  assert.throws(() => f.claim(p), blocked);
  assert.throws(f.admit, blocked);
  assert.equal(f.files.get(f.paths.admission), bytes);
});
