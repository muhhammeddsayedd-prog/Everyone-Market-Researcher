import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syntheticPostcheckContinuation } from './foundation-live-postcheck-fixtures.mjs';
import {
  assertFoundationLivePostcheckContinuationProof,
  verifyFoundationPostcheckContinuation,
} from './foundation-live-postcheck-continuation.mjs';
const blocked = /M03_POSTCHECK_CONTINUATION_BLOCKED/;
const repo = fileURLToPath(new URL('../../', import.meta.url));

test('check is public/read-only and one admission preserves both earlier attempts and exact control50', () => {
  const f = syntheticPostcheckContinuation(),
    before = new Map(f.files);
  assert.equal(f.check().kind, 'postcheck_continuation_ready');
  assert.deepEqual(f.files, before);
  const p = f.admit();
  assert.equal(p.kind, 'foundation_postcheck_continuation');
  assert.equal(p.deadlineAt - p.startsAt, 3600000);
  assert.equal(p.stopNewAt - p.startsAt, 3000000);
  assert.equal(p.hardDeadlineAt - p.startsAt, 4200000);
  for (const [name, bytes] of before) assert.equal(f.files.get(name), bytes);
  assert.equal(f.files.get(f.paths.control), f.controlPrefix);
  assert.throws(f.admit, blocked);
  assert.throws(() => assertFoundationLivePostcheckContinuationProof({ ...p }), blocked);
});

test('claim is one-use, and active read preserves the old header/control prefix while allowing ordinal51', () => {
  const f = syntheticPostcheckContinuation(),
    p = f.admit();
  assert.throws(f.readClaimed, blocked);
  const claimed = f.claim(p),
    claim = f.files.get(f.paths.claim);
  assert.equal(assertFoundationLivePostcheckContinuationProof(claimed, { claimed: true }), claimed);
  f.files.set(
    f.paths.control,
    f.controlPrefix +
      JSON.stringify({
        event: 'control_request_intent',
        ordinal: 51,
        kind: 'discovery',
        at: new Date(f.now()).toISOString(),
      }) +
      '\n',
  );
  assert.equal(f.readClaimed().deadlineAt, p.deadlineAt);
  f.files.set(f.paths.management, f.header + '{"event":"management_attempt","ordinal":1}\n');
  assert.equal(f.readClaimed().deadlineAt, p.deadlineAt);
  assert.throws(() => f.claim(f.read()), blocked);
  assert.equal(f.files.get(f.paths.claim), claim);
  f.files.set(f.paths.control, f.controlPrefix.replace('"ordinal":1', '"ordinal":2'));
  assert.throws(f.read, blocked);
});

test('wrong authority, altered retained receipts/types/control, active old processes and residual files block before admission', () => {
  for (const fault of [
    'authority',
    'retained',
    'types',
    'control',
    'process',
    'runtimeLock',
    'provision',
    'continuationLatest',
    'unprovisionedArchive',
    'bypass',
  ]) {
    const f = syntheticPostcheckContinuation();
    if (fault === 'authority') {
      const path = join(repo, f.checkpoint.approvalRelative);
      f.files.set(path, f.files.get(path) + ' ');
    }
    if (fault === 'retained') {
      const path = join(repo, 'scripts/db/out/m03-foundation-dev-migration-latest.json');
      f.files.set(path, f.files.get(path) + ' ');
    }
    if (fault === 'types') {
      const path = join(repo, 'scripts/db/out/m03-foundation-hosted-db.types.ts');
      f.files.set(path, f.files.get(path) + ' ');
    }
    if (fault === 'control') f.files.set(f.paths.control, f.controlPrefix + '{}\n');
    if (fault === 'process') f.io.processAlive = () => true;
    if (fault === 'runtimeLock')
      f.files.set(join(repo, 'scripts/n8n/out/foundation/live/runtime.operation.lock'), 'owned');
    if (fault === 'provision')
      f.files.set(join(repo, 'scripts/db/out/m03-foundation-owner-provision-attempt.json'), '{}');
    if (fault === 'continuationLatest')
      f.files.set(
        join(
          repo,
          'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-latest.json',
        ),
        '{}',
      );
    if (fault === 'unprovisionedArchive')
      f.files.set(
        join(
          repo,
          'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-unprovisioned-archive-attempt.json',
        ),
        '{}',
      );
    if (fault === 'bypass')
      f.files.set(
        join(f.localAppData, 'Temp', 'emr-m03-acceptance-protection-bypass.dpapi'),
        'not-decrypted',
      );
    assert.throws(f.admit, blocked, fault);
    assert.equal(f.files.has(f.paths.admission), false, fault);
  }
});

test('a newly owned bypass may exist at claim, while wrong parent and links never do', () => {
  const f = syntheticPostcheckContinuation(),
    p = f.admit();
  f.files.set(
    join(f.localAppData, 'Temp', 'emr-m03-acceptance-protection-bypass.dpapi'),
    'synthetic-new-owned-input',
  );
  assert.equal(f.claim(p).segmentId, f.checkpoint.segmentId);
  for (const fault of ['parent', 'link']) {
    const g = syntheticPostcheckContinuation();
    if (fault === 'parent')
      g.files.set(
        g.paths.parent,
        JSON.stringify({
          kind: 'm03_clock_admission_parent',
          version: 1,
          segmentId: g.checkpoint.segmentId,
          processId: process.ppid + 1,
        }),
      );
    else {
      const stat = g.io.lstatSync;
      g.io.lstatSync = (path) => (path === g.paths.control ? { isSymbolicLink: () => true } : stat(path));
    }
    assert.throws(g.admit, blocked);
  }
});

test('partial admission or claim remains fenced and the existing record is never rewritten', () => {
  for (const target of ['admission', 'claim']) {
    const f = syntheticPostcheckContinuation(),
      p = target === 'claim' ? f.admit() : null;
    f.setShortWrite(true);
    assert.throws(() => (target === 'claim' ? f.claim(p) : f.admit()), blocked);
    const path = f.paths[target],
      bytes = f.files.get(path);
    assert.equal(f.files.has(path), true);
    f.setShortWrite(false);
    assert.throws(() => (target === 'claim' ? f.claim(p) : f.admit()), blocked);
    assert.equal(f.files.get(path), bytes);
  }
});

test('expiry, early time and caller-supplied clock/path fields do not bypass the fixed record', () => {
  const f = syntheticPostcheckContinuation(),
    p = f.admit();
  f.setTime(p.stopNewAt);
  assert.throws(f.read, blocked);
  assert.throws(() => f.claim(p), blocked);
  assert.throws(f.admit, blocked);
  const g = syntheticPostcheckContinuation();
  g.setTime(1);
  assert.throws(g.admit, blocked);
  const h = syntheticPostcheckContinuation();
  assert.throws(
    () =>
      h.withLocalAppData(() => verifyFoundationPostcheckContinuation({ now: h.now, path: 'other' }, h.io)),
    blocked,
  );
});
