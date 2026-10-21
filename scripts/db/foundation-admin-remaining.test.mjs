import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { syntheticRemainingContinuation } from '../n8n/foundation-live-remaining-fixtures.mjs';

function native(proof, { mismatch = false, missingFlag = false } = {}) {
  let launches = 0;
  const requests = [];
  return {
    requests,
    launches: () => launches,
    spawn(executable, args, options) {
      launches++;
      assert.ok(args.includes('-RemainingContinuation'));
      for (const old of ['-PostcheckContinuation', '-ClockAmendment', '-OriginalDeadlineAtMs'])
        assert.equal(args.includes(old), false);
      assert.equal(Object.hasOwn(options.env, 'PGPASSWORD'), false);
      const child = new EventEmitter();
      child.stdin = new PassThrough();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin.on('end', () =>
        queueMicrotask(() => child.emit('close', mismatch || missingFlag ? 1 : 0, null)),
      );
      let buffer = '';
      child.stdin.on('data', (bytes) => {
        buffer += bytes;
        while (buffer.includes('\n')) {
          const end = buffer.indexOf('\n'),
            row = JSON.parse(buffer.slice(0, end));
          buffer = buffer.slice(end + 1);
          requests.push(row);
          child.stdout.write(
            JSON.stringify({
              type: 'foundation_admin_result',
              id: row.id,
              kind: row.kind,
              ok: true,
              result: { kind: row.kind },
            }) + '\n',
          );
          if (row.kind === 'end')
            child.stdout.write(
              JSON.stringify({
                version: 1,
                runId: 'synthetic-remaining-run',
                phaseAControl: true,
                childrenClosed: true,
                handoffDeleted: true,
                leaseDeleted: true,
                scratchDeleted: true,
              }) + '\n',
            );
        }
      });
      queueMicrotask(() =>
        child.stdout.write(
          JSON.stringify({
            type: 'foundation_admin_ready',
            runId: 'synthetic-remaining-run',
            historyAfter: 'complete',
            projectRef: 'zmotjsbzhzjvpelxvxlf',
            hardDeadline: new Date(proof.hardDeadlineAt).toISOString(),
            actionDeadline: new Date(proof.deadlineAt + (mismatch ? 1 : 0)).toISOString(),
            stopNewAt: new Date(proof.stopNewAt).toISOString(),
            postchecksVerified: false,
            clockSegmentId: proof.segmentId,
            postcheckContinuation: true,
            ...(!missingFlag ? { remainingContinuation: true } : {}),
          }) + '\n',
        ),
      );
      return child;
    },
  };
}
test('remaining admin uses only a genuine new claimed proof, exclusive flag and exact native ready envelope', async () => {
  const f = await syntheticRemainingContinuation();
  try {
    const proof = f.claim(f.admit()),
      { startFoundationAdminClient } = await f.copy('foundation-admin-client.mjs');
    const wire = native(proof),
      client = await startFoundationAdminClient({ now: f.now, remainingContinuationProof: proof }, wire);
    assert.equal(client.ready.remainingContinuation, true);
    assert.equal(client.ready.postcheckContinuation, true);
    assert.equal(client.ready.clockSegmentId, 'e8035391-dba8-48c9-97e0-139ba980d86e');
    await client.postcheck();
    await client.fixture();
    await client.archiveUnprovisioned();
    await client.end();
    assert.equal(wire.launches(), 1);
    assert.deepEqual(
      wire.requests.map((row) => row.kind),
      ['postcheck', 'fixture', 'archiveUnprovisioned', 'end'],
    );
    for (const input of [
      { remainingContinuationProof: { ...proof } },
      { remainingContinuationProof: proof, postcheckContinuationProof: {} },
      { remainingContinuationProof: proof, clockAmendmentProof: {} },
      { remainingContinuationProof: proof, originalDeadlineAtMs: 1792584023481 },
    ]) {
      const rejected = native(proof);
      await assert.rejects(
        startFoundationAdminClient({ now: f.now, ...input }, rejected),
        /FOUNDATION_ADMIN_BLOCKED/,
      );
      assert.equal(rejected.launches(), 0);
    }
    for (const fault of [{ mismatch: true }, { missingFlag: true }])
      await assert.rejects(
        startFoundationAdminClient({ now: f.now, remainingContinuationProof: proof }, native(proof, fault)),
        /FOUNDATION_ADMIN_BLOCKED/,
      );
  } finally {
    f.cleanup();
  }
});
test('production remaining admin cannot use a proposed/unclaimed/old plain proof to spawn a credential child', async () => {
  const { startFoundationAdminClient } = await import('./foundation-admin-client.mjs');
  let children = 0;
  await assert.rejects(
    startFoundationAdminClient(
      {
        remainingContinuationProof: {
          kind: 'foundation_remaining_continuation',
          segmentId: 'e8035391-dba8-48c9-97e0-139ba980d86e',
        },
      },
      {
        spawn() {
          children++;
        },
      },
    ),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
  assert.equal(children, 0);
});
