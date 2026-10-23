import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendFileSync, existsSync, lstatSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';
import { syntheticRemainingContinuation } from './foundation-live-remaining-fixtures.mjs';
import { syntheticStartupReplacement } from './foundation-live-startup-replacement-fixtures.mjs';

test('project-verified continuation public preapproval is non-authoritative and never creates an admission', async () => {
  const f = await syntheticProjectVerifiedContinuation({ approved: false });
  try {
    const result = f.check();
    assert.equal(result.kind, 'project_verified_continuation_approval_required');
    assert.equal(result.status, 'approval_required');
    assert.equal(result.privateRead, false);
    assert.equal(result.networkRequests, 0);
    assert.equal(Object.keys(result).length, 8);
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    assert.throws(() => f.module.assertFoundationLiveProjectVerifiedContinuationProof(result));
    assert.equal(existsSync(f.paths.admission), false);
    assert.equal(existsSync(f.paths.claim), false);
  } finally {
    f.cleanup();
  }
});

test('project-verified continuation preapproval does not inspect any credential-named path metadata', async () => {
  const f = await syntheticProjectVerifiedContinuation({ approved: false });
  let privateMetadataCalls = 0;
  try {
    f.io.lstatSync = (path) => {
      if (/(?:\.dpapi|\.lease\.json)$/.test(String(path))) {
        privateMetadataCalls++;
        throw Error('SYNTHETIC_PRIVATE_PATH_METADATA_BLOCKED');
      }
      return lstatSync(path);
    };
    assert.equal(f.check().status, 'approval_required');
    assert.throws(() => f.admit());
    assert.equal(privateMetadataCalls, 0);
  } finally {
    f.cleanup();
  }
});

test('separately approved synthetic project-verified continuation has its own one-use claimed proof and unchanged clock caps', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    const beforeControl = readFileSync(f.paths.control, 'utf8');
    assert.equal(beforeControl.trimEnd().split('\n').length, 200);
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    assert.equal(Object.keys(f.check()).length, 6);
    const p = f.admit();
    assert.equal(p.kind, 'foundation_project_verified_continuation');
    assert.equal(p.deadlineAt - p.startsAt, 3600000);
    assert.equal(p.stopNewAt - p.startsAt, 3000000);
    assert.equal(p.hardDeadlineAt - p.startsAt, 4200000);
    assert.equal(p.carriedManagementAttempts, 4);
    assert.equal(p.carriedControlAttempts, 1);
    assert.throws(() => f.module.assertFoundationLiveProjectVerifiedContinuationProof(p, { claimed: true }));
    const claimed = f.claim(p);
    assert.equal(
      f.module.assertFoundationLiveProjectVerifiedContinuationProof(claimed, { claimed: true }),
      claimed,
    );
    assert.throws(() =>
      f.module.assertFoundationLiveProjectVerifiedContinuationProof({ ...claimed }, { claimed: true }),
    );
    assert.throws(() => f.admit());
    assert.throws(() => f.claim(p));
    assert.equal(readFileSync(f.paths.control, 'utf8'), beforeControl);
    f.setTime(p.stopNewAt);
    assert.throws(() => f.read());
  } finally {
    f.cleanup();
  }
});

test('project-verified continuation and spent remaining proofs cannot cross their distinct WeakMap authority brands', async () => {
  const current = await syntheticProjectVerifiedContinuation();
  const spent = await syntheticRemainingContinuation();
  try {
    const currentProof = current.claim(current.admit());
    const oldProof = spent.claim(spent.admit());
    assert.throws(() =>
      current.module.assertFoundationLiveProjectVerifiedContinuationProof(oldProof, { claimed: true }),
    );
    assert.throws(() =>
      spent.module.assertFoundationLiveRemainingContinuationProof(currentProof, { claimed: true }),
    );
  } finally {
    current.cleanup();
    spent.cleanup();
  }
});

test('the project-verified continuation raw200-row control checkpoint cannot be normalized, edited or extended before admission/claim', async () => {
  for (const fault of ['byte-drift', 'ordinal', 'extra', 'claim-drift']) {
    const f = await syntheticProjectVerifiedContinuation();
    try {
      const p = fault === 'claim-drift' ? f.admit() : null;
      const text = readFileSync(f.paths.control, 'utf8');
      if (fault === 'extra')
        appendFileSync(
          f.paths.control,
          JSON.stringify({ event: 'control_request_intent', ordinal: 201, kind: 'discovery' }) + '\n',
        );
      else
        writeFileSync(
          f.paths.control,
          fault === 'ordinal' ? text.replace('"ordinal":200', '"ordinal":199') : text.replace('{', '{ '),
        );
      assert.throws(() => (p === null ? f.admit() : f.claim(p)));
    } finally {
      f.cleanup();
    }
  }
});

test('project-verified continuation ReadClaimed requires live owners/lock and preserves legitimate appended50 baseline rows', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    const p = f.claim(f.admit());
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    assert.throws(() => f.readClaimed());
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    for (let ordinal = 201; ordinal <= 250; ordinal++)
      appendFileSync(
        f.paths.control,
        JSON.stringify({ event: 'control_request_intent', ordinal, kind: 'discovery' }) + '\n',
      );
    const q = f.readClaimed();
    assert.equal(q.segmentId, p.segmentId);
    assert.throws(() => f.module.assertFoundationLiveProjectVerifiedContinuationProof(q, { claimed: true }));
    f.io.processAlive = () => false;
    assert.throws(() => f.readClaimed());
    f.io.processAlive = () => true;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'FOREIGN\n');
    assert.throws(() => f.readClaimed());
  } finally {
    f.cleanup();
  }
});

test('project-verified continuation partial claim/admission and foreign prior provision intent are irreversible denials', async () => {
  for (const fault of ['partial-admission', 'partial-claim', 'e803-provision', 'new-state']) {
    const f = await syntheticProjectVerifiedContinuation();
    try {
      let p;
      if (fault === 'partial-claim') p = f.admit();
      if (fault.startsWith('partial')) f.io.writeSync = () => 0;
      if (fault === 'e803-provision')
        f.put(
          'scripts/db/out/m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-owner-provision-attempt.json',
          '{}\n',
        );
      if (fault === 'new-state')
        f.put(
          `scripts/db/out/m03-foundation-project-verified-continuation-${f.checkpoint.segmentId}-attempt.json`,
          '{}\n',
        );
      assert.throws(() => (p ? f.claim(p) : f.admit()));
      if (fault.startsWith('partial')) {
        delete f.io.writeSync;
        assert.equal(existsSync(p ? f.paths.claim : f.paths.admission), true);
        assert.throws(() => (p ? f.claim(p) : f.admit()));
      }
    } finally {
      f.cleanup();
    }
  }
});

test('pinned historical cleanup must retain nine exact leaves and explicit unknown orphan state', async () => {
  for (const cleanupFault of ['overclaimed-orphans', 'incomplete-leaves', 'private-read']) {
    const f = await syntheticProjectVerifiedContinuation({ cleanupFault });
    try {
      assert.throws(() => f.check());
      assert.throws(() => f.admit());
      assert.equal(existsSync(f.paths.admission), false);
    } finally {
      f.cleanup();
    }
  }
});

test('live retired e803 roots and a foreign canonical public parent cannot admit a replacement', async () => {
  for (const fault of [
    'parent-live',
    'runtime-live',
    'startup-parent-live',
    'startup-runtime-live',
    'foreign-parent',
  ]) {
    const f = await syntheticProjectVerifiedContinuation();
    try {
      if (fault === 'parent-live') f.io.processAlive = (pid) => pid === 5468;
      if (fault === 'runtime-live') f.io.processAlive = (pid) => pid === 35920;
      if (fault === 'startup-parent-live') f.io.processAlive = (pid) => pid === 44408;
      if (fault === 'startup-runtime-live') f.io.processAlive = (pid) => pid === 60040;
      if (fault === 'foreign-parent')
        f.put(
          'synthetic-localappdata/Temp/' + f.checkpoint.parentLockFilename,
          JSON.stringify({
            kind: 'm03_clock_admission_parent',
            version: 1,
            segmentId: f.checkpoint.segmentId,
            processId: process.ppid + 1,
          }) + '\n',
        );
      assert.throws(() => f.admit());
      assert.equal(existsSync(f.paths.admission), false);
    } finally {
      f.cleanup();
    }
  }
});

test('repinned current archive/wrapper or positive project receipt failures cannot be nominally accepted', async () => {
  for (const options of [
    { priorFault: 'archive' },
    { priorFault: 'wrapper' },
    { projectFault: 'extra-get' },
    { projectFault: 'predicate' },
  ]) {
    const f = await syntheticProjectVerifiedContinuation(options);
    try {
      assert.throws(() => f.check(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
      assert.throws(() => f.admit());
      assert.equal(existsSync(f.paths.admission), false);
    } finally {
      f.cleanup();
    }
  }
});

test('missing captured current wrapper receipt blocks before any new clock, and old startup brands cannot cross', async () => {
  const current = await syntheticProjectVerifiedContinuation();
  const spent = await syntheticStartupReplacement();
  try {
    const p = current.claim(current.admit()),
      old = spent.claim(spent.admit());
    assert.throws(() =>
      current.module.assertFoundationLiveProjectVerifiedContinuationProof(old, { claimed: true }),
    );
    assert.throws(() => spent.module.assertFoundationLiveStartupReplacementProof(p, { claimed: true }));
  } finally {
    current.cleanup();
    spent.cleanup();
  }
  const f = await syntheticProjectVerifiedContinuation();
  try {
    unlinkSync(
      join(
        f.directory,
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-attempt-20261022.json',
      ),
    );
    assert.throws(() => f.check());
    assert.throws(() => f.admit());
    assert.equal(existsSync(f.paths.admission), false);
  } finally {
    f.cleanup();
  }
});

test('only the genuine current project-verified claim permits exact200-row control and the two historical setup GETs', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    const p = f.claim(f.admit()),
      rows = readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const control = { deadlineAt: p.deadlineAt, previousEvents: rows };
    assert.equal(f.module.assertFoundationProjectVerifiedContinuationControlResume(p, control), p);
    assert.throws(() => f.module.assertFoundationProjectVerifiedContinuationControlResume({ ...p }, control));
    assert.throws(() =>
      f.module.assertFoundationProjectVerifiedContinuationControlResume(p, {
        ...control,
        previousEvents: rows.slice(1),
      }),
    );
    const setup = {
      sourceCommitSha: p.sourceCommitSha,
      deadlineAt: p.deadlineAt,
      previousEvents: [
        { event: 'setup_attempt', ordinal: 1, kind: 'GET', at: 1792608136543 },
        { event: 'setup_attempt', ordinal: 2, kind: 'GET', at: 1792666486587 },
      ],
    };
    assert.equal(f.module.assertFoundationProjectVerifiedContinuationSetupResume(p, setup), p);
    assert.throws(() =>
      f.module.assertFoundationProjectVerifiedContinuationSetupResume(p, {
        ...setup,
        previousEvents: [{ ...setup.previousEvents[0], kind: 'POST' }],
      }),
    );
    const original = readFileSync(f.paths.management, 'utf8');
    writeFileSync(f.paths.management, original.replace('{"event"', '{ "event"'));
    assert.throws(() => f.module.assertFoundationProjectVerifiedContinuationJournalPrefixes(p));
  } finally {
    f.cleanup();
  }
});

test('new project-verified authority has an independent segment and preserved outside carries', async () => {
  const mod = await import('./foundation-live-project-verified-continuation.mjs');
  const c = mod.foundationProjectVerifiedContinuationCheckpoint;
  assert.equal(c.segmentId, '20275b22-b7fe-4737-a9a4-c50c2feadb74');
  assert.equal(c.carriedManagementAttempts, 4);
  assert.equal(c.carriedControlAttempts, 1);
  assert.throws(() =>
    mod.assertFoundationLiveProjectVerifiedContinuationProof(
      Object.freeze({ kind: 'foundation_project_verified_continuation' }),
    ),
  );
});

test('synthetic project-verified public readiness and genuine claim preserve all counters', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    const proof = f.claim(f.admit());
    assert.equal(proof.carriedManagementAttempts, 4);
    assert.equal(
      f.module.assertFoundationLiveProjectVerifiedContinuationProof(proof, { claimed: true }),
      proof,
    );
  } finally {
    f.cleanup();
  }
});

test('standing M03 authority permits a fresh technical attempt after proven no-effect closure, preserving its spent admission and claim', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  try {
    const first = f.claim(f.admit());
    const admission = readFileSync(f.paths.admission, 'utf8');
    const claim = readFileSync(f.paths.claim, 'utf8');
    f.setTime(first.hardDeadlineAt + 1000);
    f.put(
      f.checkpoint.admissionRelative.replace(/\.json$/, '.closed.json'),
      JSON.stringify({
        kind: 'm03_project_verified_technical_closed',
        version: 1,
        admissionSha256: (await import('node:crypto')).createHash('sha256').update(admission).digest('hex'),
        parentProcessId: process.ppid,
        runtimeProcessId: process.pid,
        closedAt: first.hardDeadlineAt,
        childClosed: true,
        credentialChildrenClosed: true,
        emergencyShutdown: false,
        pendingMachinePreserved: true,
        nativeExit: 0,
        bypassHandoffDeleted: true,
        closureVerified: true,
      }) + '\n',
    );
    assert.equal(f.check().kind, 'project_verified_continuation_ready');
    const second = f.admit();
    assert.equal(second.startsAt, f.now());
    assert.equal(second.deadlineAt - second.startsAt, 3600000);
    assert.equal(second.carriedManagementAttempts, 4);
    assert.equal(second.carriedControlAttempts, 1);
    assert.equal(readFileSync(f.paths.admission, 'utf8'), admission);
    assert.equal(readFileSync(f.paths.claim, 'utf8'), claim);
    assert.equal(f.claim(second).startsAt, second.startsAt);
    assert.equal(f.read().startsAt, second.startsAt);
  } finally {
    f.cleanup();
  }
});

test('technical retry requires reconciliation for missing closure, live children, effects, mutation intents and changed counters', async () => {
  for (const fault of [
    'missing-close',
    'unclosed',
    'live-child',
    'effect',
    'counter',
    'missing-native-exit',
    'emergency',
    'orphan-technical-claim',
    'orphan-technical-close',
    'runtime-journal',
  ]) {
    const f = await syntheticProjectVerifiedContinuation();
    try {
      const p = f.claim(f.admit());
      const admission = readFileSync(f.paths.admission, 'utf8');
      f.setTime(p.hardDeadlineAt + 1000);
      if (fault !== 'missing-close')
        f.put(
          f.checkpoint.admissionRelative.replace(/\.json$/, '.closed.json'),
          JSON.stringify({
            kind: 'm03_project_verified_technical_closed',
            version: 1,
            admissionSha256: (await import('node:crypto'))
              .createHash('sha256')
              .update(admission)
              .digest('hex'),
            parentProcessId: process.ppid,
            runtimeProcessId: process.pid,
            closedAt: p.hardDeadlineAt,
            childClosed: fault !== 'unclosed',
            credentialChildrenClosed: true,
            emergencyShutdown: fault === 'emergency',
            pendingMachinePreserved: true,
            nativeExit: fault === 'missing-native-exit' ? null : 0,
            bypassHandoffDeleted: true,
            closureVerified: true,
          }) + '\n',
        );
      if (fault === 'live-child') f.io.processAlive = (pid) => pid === process.pid;
      if (fault === 'effect')
        f.put(
          `scripts/db/out/m03-foundation-project-verified-continuation-${p.segmentId}-attempt.json`,
          '{}\n',
        );
      if (fault === 'counter')
        appendFileSync(
          f.paths.control,
          JSON.stringify({ event: 'control_request_intent', ordinal: 201, kind: 'discovery' }) + '\n',
        );
      if (fault.startsWith('orphan-technical-'))
        f.put(
          f.checkpoint.admissionRelative.replace(
            /\.json$/,
            fault.endsWith('claim') ? '.technical-2.runtime-claim.json' : '.technical-2.closed.json',
          ),
          '{}\n',
        );
      if (fault === 'runtime-journal') f.put('scripts/n8n/out/foundation/live/runtime.jsonl', '{}\n');
      assert.equal(
        f.module.reconcileFoundationProjectVerifiedContinuation({ now: f.now }, f.io).status,
        'reconciliation_required',
      );
      assert.throws(() => f.admit());
    } finally {
      f.cleanup();
    }
  }
});
