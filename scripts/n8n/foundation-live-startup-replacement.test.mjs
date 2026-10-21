import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendFileSync, existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { syntheticStartupReplacement } from './foundation-live-startup-replacement-fixtures.mjs';
import { syntheticRemainingContinuation } from './foundation-live-remaining-fixtures.mjs';

test('startup replacement public preapproval is non-authoritative and never creates an admission', async () => {
  const f = await syntheticStartupReplacement({ approved: false });
  try {
    const result = f.check();
    assert.equal(result.kind, 'startup_replacement_approval_required');
    assert.equal(result.status, 'approval_required');
    assert.equal(result.privateRead, false);
    assert.equal(result.networkRequests, 0);
    assert.equal(Object.keys(result).length, 8);
    assert.throws(() => f.admit(), /M03_STARTUP_REPLACEMENT_BLOCKED/);
    assert.throws(() => f.module.assertFoundationLiveStartupReplacementProof(result));
    assert.equal(existsSync(f.paths.admission), false);
    assert.equal(existsSync(f.paths.claim), false);
  } finally {
    f.cleanup();
  }
});

test('startup replacement preapproval does not inspect any credential-named path metadata', async () => {
  const f = await syntheticStartupReplacement({ approved: false });
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

test('separately approved synthetic startup replacement has its own one-use claimed proof and unchanged clock caps', async () => {
  const f = await syntheticStartupReplacement();
  try {
    const beforeControl = readFileSync(f.paths.control, 'utf8');
    assert.equal(beforeControl.trimEnd().split('\n').length, 150);
    assert.equal(f.check().kind, 'startup_replacement_ready');
    assert.equal(Object.keys(f.check()).length, 6);
    const p = f.admit();
    assert.equal(p.kind, 'foundation_startup_replacement');
    assert.equal(p.deadlineAt - p.startsAt, 3600000);
    assert.equal(p.stopNewAt - p.startsAt, 3000000);
    assert.equal(p.hardDeadlineAt - p.startsAt, 4200000);
    assert.equal(p.carriedManagementAttempts, 3);
    assert.equal(p.carriedControlAttempts, 1);
    assert.throws(() => f.module.assertFoundationLiveStartupReplacementProof(p, { claimed: true }));
    const claimed = f.claim(p);
    assert.equal(f.module.assertFoundationLiveStartupReplacementProof(claimed, { claimed: true }), claimed);
    assert.throws(() =>
      f.module.assertFoundationLiveStartupReplacementProof({ ...claimed }, { claimed: true }),
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

test('startup replacement and spent remaining proofs cannot cross their distinct WeakMap authority brands', async () => {
  const current = await syntheticStartupReplacement();
  const spent = await syntheticRemainingContinuation();
  try {
    const currentProof = current.claim(current.admit());
    const oldProof = spent.claim(spent.admit());
    assert.throws(() =>
      current.module.assertFoundationLiveStartupReplacementProof(oldProof, { claimed: true }),
    );
    assert.throws(() =>
      spent.module.assertFoundationLiveRemainingContinuationProof(currentProof, { claimed: true }),
    );
  } finally {
    current.cleanup();
    spent.cleanup();
  }
});

test('the startup replacement raw150-row control checkpoint cannot be normalized, edited or extended before admission/claim', async () => {
  for (const fault of ['byte-drift', 'ordinal', 'extra', 'claim-drift']) {
    const f = await syntheticStartupReplacement();
    try {
      const p = fault === 'claim-drift' ? f.admit() : null;
      const text = readFileSync(f.paths.control, 'utf8');
      if (fault === 'extra')
        appendFileSync(
          f.paths.control,
          JSON.stringify({ event: 'control_request_intent', ordinal: 151, kind: 'discovery' }) + '\n',
        );
      else
        writeFileSync(
          f.paths.control,
          fault === 'ordinal' ? text.replace('"ordinal":150', '"ordinal":149') : text.replace('{', '{ '),
        );
      assert.throws(() => (p === null ? f.admit() : f.claim(p)));
    } finally {
      f.cleanup();
    }
  }
});

test('startup replacement ReadClaimed requires live owners/lock and preserves legitimate appended50 baseline rows', async () => {
  const f = await syntheticStartupReplacement();
  try {
    const p = f.claim(f.admit());
    f.io.processAlive = (pid) => pid === process.pid || pid === process.ppid;
    assert.throws(() => f.readClaimed());
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'emr-m03-foundation-live-runtime-v1\n');
    for (let ordinal = 151; ordinal <= 200; ordinal++)
      appendFileSync(
        f.paths.control,
        JSON.stringify({ event: 'control_request_intent', ordinal, kind: 'discovery' }) + '\n',
      );
    const q = f.readClaimed();
    assert.equal(q.segmentId, p.segmentId);
    assert.throws(() => f.module.assertFoundationLiveStartupReplacementProof(q, { claimed: true }));
    f.io.processAlive = () => false;
    assert.throws(() => f.readClaimed());
    f.io.processAlive = () => true;
    f.put('scripts/n8n/out/foundation/live/runtime.operation.lock', 'FOREIGN\n');
    assert.throws(() => f.readClaimed());
  } finally {
    f.cleanup();
  }
});

test('startup replacement partial claim/admission and foreign prior provision intent are irreversible denials', async () => {
  for (const fault of ['partial-admission', 'partial-claim', 'e803-provision', 'new-state']) {
    const f = await syntheticStartupReplacement();
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
          `scripts/db/out/m03-foundation-startup-replacement-${f.checkpoint.segmentId}-attempt.json`,
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
    const f = await syntheticStartupReplacement({ cleanupFault });
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
  for (const fault of ['parent-live', 'runtime-live', 'foreign-parent']) {
    const f = await syntheticStartupReplacement();
    try {
      if (fault === 'parent-live') f.io.processAlive = (pid) => pid === 5468;
      if (fault === 'runtime-live') f.io.processAlive = (pid) => pid === 35920;
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

test('only the genuine current startup claim permits exact150-row control and the single historical setup GET', async () => {
  const f = await syntheticStartupReplacement();
  try {
    const p = f.claim(f.admit()),
      rows = readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const control = { deadlineAt: p.deadlineAt, previousEvents: rows };
    assert.equal(f.module.assertFoundationStartupReplacementControlResume(p, control), p);
    assert.throws(() => f.module.assertFoundationStartupReplacementControlResume({ ...p }, control));
    assert.throws(() =>
      f.module.assertFoundationStartupReplacementControlResume(p, {
        ...control,
        previousEvents: rows.slice(1),
      }),
    );
    const setup = {
      sourceCommitSha: p.sourceCommitSha,
      deadlineAt: p.deadlineAt,
      previousEvents: [{ event: 'setup_attempt', ordinal: 1, kind: 'GET', at: 1792608136543 }],
    };
    assert.equal(f.module.assertFoundationStartupReplacementSetupResume(p, setup), p);
    assert.throws(() =>
      f.module.assertFoundationStartupReplacementSetupResume(p, {
        ...setup,
        previousEvents: [{ ...setup.previousEvents[0], kind: 'POST' }],
      }),
    );
    const original = readFileSync(f.paths.management, 'utf8');
    writeFileSync(f.paths.management, original.replace('{"event"', '{ "event"'));
    assert.throws(() => f.module.assertFoundationStartupReplacementJournalPrefixes(p));
  } finally {
    f.cleanup();
  }
});
