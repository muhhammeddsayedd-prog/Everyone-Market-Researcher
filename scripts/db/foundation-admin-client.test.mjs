import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { startFoundationAdminClient } from './foundation-admin-client.mjs';
import { verifyFoundationTypes } from './check-foundation-types.mjs';
import { syntheticClockAmendment } from '../n8n/foundation-live-clock-amendment-fixtures.mjs';
import { syntheticPostcheckContinuation } from '../n8n/foundation-live-postcheck-fixtures.mjs';
import { syntheticProjectVerifiedContinuation } from '../n8n/foundation-live-project-verified-fixtures.mjs';

const epoch = Date.parse('2026-10-21T10:00:00.000Z');
function fixture({
  badReady = false,
  stderr = false,
  overflow = false,
  originalDeadlineAtMs,
  amendmentProof,
  continuationProof,
  projectProof,
  forwardWindow = false,
  clockMismatch = false,
} = {}) {
  const calls = [],
    child = new EventEmitter();
  let input = '';
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    queueMicrotask(() => child.emit('close', 1, null));
    return true;
  };
  child.stdin.on('end', () => {
    if (badReady || overflow || clockMismatch) queueMicrotask(() => child.emit('close', 1, null));
  });
  const receipt = {
    version: 1,
    runId: 'fixture-run',
    phaseAControl: true,
    childrenClosed: true,
    handoffDeleted: true,
    leaseDeleted: true,
    scratchDeleted: true,
  };
  child.stdin.on('data', (chunk) => {
    input += chunk.toString();
    while (input.includes('\n')) {
      const index = input.indexOf('\n'),
        row = JSON.parse(input.slice(0, index));
      input = input.slice(index + 1);
      calls.push(row);
      if (overflow) {
        child.stdout.write('x'.repeat(1048577));
        child.stdout.write('later-private-data'.repeat(100000));
        continue;
      }
      child.stdout.write(
        JSON.stringify({
          type: 'foundation_admin_result',
          id: row.id,
          kind: row.kind,
          ok: true,
          result: { kind: row.kind },
        }) + '\n',
      );
      if (row.kind === 'end') {
        child.stdout.write(JSON.stringify(receipt) + '\n');
        queueMicrotask(() => child.emit('close', 0, null));
      }
    }
  });
  const deps = {
    spawn(executable, args, options) {
      assert.match(executable, /WindowsPowerShell/);
      assert.ok(args.includes('-PhaseAControl'));
      if (amendmentProof) {
        assert.ok(args.includes('-ClockAmendment'));
        assert.equal(args.includes('-OriginalDeadlineAtMs'), false);
      }
      if (continuationProof) {
        assert.ok(args.includes('-PostcheckContinuation'));
        assert.equal(args.includes('-ClockAmendment'), false);
        assert.equal(args.includes('-OriginalDeadlineAtMs'), false);
      }
      if (projectProof) {
        assert.ok(args.includes('-ProjectVerifiedContinuation'));
        assert.equal(args.includes('-ForwardWindow'), forwardWindow);
        assert.equal(args.includes('-PostcheckContinuation'), false);
      }
      if (originalDeadlineAtMs !== undefined) {
        assert.equal(args[args.indexOf('-OriginalDeadlineAtMs') + 1], String(originalDeadlineAtMs));
      }
      assert.equal(Object.hasOwn(options.env, 'PGPASSWORD'), false);
      assert.equal(Object.hasOwn(options.env, 'SUPABASE_ACCESS_TOKEN'), false);
      assert.equal(options.windowsHide, true);
      queueMicrotask(() => {
        if (stderr) child.stderr.write('SYNTHETIC_PRIVATE_NATIVE_ERROR');
        child.stdout.write(
          badReady
            ? 'SYNTHETIC_PRIVATE_INVALID_OUTPUT\n'
            : JSON.stringify({
                type: 'foundation_admin_ready',
                runId: 'fixture-run',
                historyAfter: 'complete',
                projectRef: 'zmotjsbzhzjvpelxvxlf',
                hardDeadline: new Date(
                  projectProof || continuationProof || amendmentProof
                    ? (projectProof ?? continuationProof ?? amendmentProof).hardDeadlineAt
                    : originalDeadlineAtMs === undefined
                      ? epoch + 4200000
                      : originalDeadlineAtMs + 600000,
                ).toISOString(),
                actionDeadline: new Date(
                  projectProof || continuationProof || amendmentProof
                    ? (projectProof ?? continuationProof ?? amendmentProof).deadlineAt +
                        (clockMismatch ? 1 : 0)
                    : originalDeadlineAtMs === undefined
                      ? epoch + 3600000
                      : originalDeadlineAtMs,
                ).toISOString(),
                stopNewAt: new Date(
                  projectProof || continuationProof || amendmentProof
                    ? (projectProof ?? continuationProof ?? amendmentProof).stopNewAt
                    : originalDeadlineAtMs === undefined
                      ? epoch + 3000000
                      : originalDeadlineAtMs - 600000,
                ).toISOString(),
                postchecksVerified: false,
                ...(amendmentProof ? { clockSegmentId: amendmentProof.segmentId } : {}),
                ...(continuationProof
                  ? { clockSegmentId: continuationProof.segmentId, postcheckContinuation: true }
                  : {}),
                ...(projectProof
                  ? {
                      clockSegmentId: projectProof.segmentId,
                      postcheckContinuation: true,
                      projectVerifiedContinuation: true,
                    }
                  : {}),
              }) + '\n',
        );
      });
      return child;
    },
  };
  return { calls, deps, child };
}
test('same-child client uses fixed protocol without delivering a password to Node or forwarding parent secrets', async () => {
  const f = fixture({ stderr: true }),
    client = await startFoundationAdminClient({ now: () => epoch }, f.deps);
  assert.equal(client.ready.postchecksVerified, false);
  for (const method of [
    'postcheck',
    'preflight',
    'fixture',
    'readUnknown',
    'firstOriginalContext',
    'replaySnapshot',
    'close',
    'archive',
  ])
    await client[method]();
  await client.provision({
    audience: 'https://everyone-market-researcher-fixture.vercel.app',
    commitSha: 'f'.repeat(40),
    deploymentId: 'dpl_Fixture',
  });
  await client.verifyAtomicInput({ atomicInput: {} });
  const query = readFileSync('scripts/db/foundation-settlement.sql', 'utf8').trim();
  await client.readGateway({ query, params: ['df4f29ec-e2dc-4d82-a276-62a4e695e6f9', [], [], '[]'] });
  const done = await client.end();
  assert.equal(done.nativeExit, 0);
  assert.equal(done.childClosed, true);
  assert.deepEqual(f.calls.find((c) => c.kind === 'settlement').args.terminalCosts, []);
  assert.equal(client.state().childClosed, true);
});

test('registered-window Admin option needs the genuine claimed fresh proof and preserves the carried ledger', async () => {
  const f = await syntheticProjectVerifiedContinuation({ closedWindow: true, proposedBudgetApproved: true });
  try {
    const proof = f.claim(f.admit());
    assert.equal(proof.carriedManagementAttempts, 10);
    assert.equal(proof.carriedControlAttempts, 1);
    const module = await f.copy('foundation-admin-client.mjs');
    const wire = fixture({ projectProof: proof, forwardWindow: true });
    const client = await module.startFoundationAdminClient(
      {
        repositoryRoot: f.directory,
        now: f.now,
        projectVerifiedContinuationProof: proof,
        forwardWindow: true,
      },
      wire.deps,
    );
    assert.equal(client.ready.projectVerifiedContinuation, true);
    await client.end();
    for (const options of [
      { forwardWindow: true },
      { projectVerifiedContinuationProof: proof, forwardWindow: false },
      { projectVerifiedContinuationProof: { ...proof }, forwardWindow: true },
      { projectVerifiedContinuationProof: { ...proof, carriedControlAttempts: 3 }, forwardWindow: true },
      { projectVerifiedContinuationProof: proof, forwardWindow: 'true' },
    ]) {
      let spawned = false;
      await assert.rejects(
        module.startFoundationAdminClient(
          { repositoryRoot: f.directory, now: f.now, ...options },
          {
            spawn() {
              spawned = true;
              throw Error('SYNTHETIC_MUST_NOT_SPAWN');
            },
          },
        ),
        /FOUNDATION_ADMIN_BLOCKED/,
      );
      assert.equal(spawned, false);
    }
  } finally {
    f.cleanup();
  }
});
test('approved576 genuine Admin constructor carries3 controls from382 mixed rows without spawning a real child', async () => {
  const f = await syntheticProjectVerifiedContinuation({ managementAllocation: true });
  try {
    const proof = f.claim(f.admit());
    const checkpoint = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
    assert.equal(checkpoint.managementMaximum, 576);
    assert.equal(readFileSync(f.paths.control, 'utf8').trim().split('\n').length, 382);
    assert.equal(checkpoint.mainControlAttempts, 381);
    assert.equal(proof.carriedManagementAttempts, 10);
    assert.equal(proof.carriedControlAttempts, 3);
    const module = await f.copy('foundation-admin-client.mjs');
    const wire = fixture({ projectProof: proof, forwardWindow: true });
    const client = await module.startFoundationAdminClient(
      {
        repositoryRoot: f.directory,
        now: f.now,
        projectVerifiedContinuationProof: proof,
        forwardWindow: true,
      },
      wire.deps,
    );
    assert.equal(client.ready.projectVerifiedContinuation, true);
    assert.equal(wire.calls.length, 0);
    const done = await client.end();
    assert.equal(done.nativeExit, 0);
    assert.equal(done.childClosed, true);
  } finally {
    f.cleanup();
  }
});

for (const profile of [
  { maximum: 640, management: 237, control: 486, options: { closedFixture: true, preprivateAdmin: false } },
  { maximum: 640, management: 263, control: 537, options: { closedFixture: true, preprivateAdmin: true } },
  {
    maximum: 704,
    management: 288,
    control: 588,
    options: { catalogReadonly: true, catalogManagementAllocation: true },
  },
  {
    maximum: 704,
    management: 313,
    control: 639,
    options: { adminAdmissionReadonly: true },
  },
])
  test(`approved${profile.maximum} genuine Admin constructor retains${profile.management}/${profile.control} and selects only its fresh claimed binding`, async () => {
    const f = await syntheticProjectVerifiedContinuation(profile.options);
    try {
      const proof = f.claim(f.admit());
      const checkpoint = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
      assert.equal(checkpoint.managementMaximum, profile.maximum);
      assert.equal(checkpoint.aggregateManagementAttempts, profile.management);
      assert.equal(checkpoint.aggregateControlAttempts, profile.control);
      assert.equal(checkpoint.mainControlAttempts, profile.control - 3);
      if (profile.management === 313) assert.equal(checkpoint.technicalAttemptOrdinal, 12);
      assert.equal(proof.sourceCommitSha, 'aff94f2b2d8055cf93b5405e6b11d4e7d9c86803');
      assert.equal(proof.windowId, 'eda4fae1-1e19-47db-81b8-beac1a4ed883');
      const module = await f.copy('foundation-admin-client.mjs');
      const wire = fixture({ projectProof: proof, forwardWindow: true });
      let spawns = 0,
        startupError,
        client;
      try {
        client = await module.startFoundationAdminClient(
          {
            repositoryRoot: f.directory,
            now: f.now,
            projectVerifiedContinuationProof: proof,
            forwardWindow: true,
          },
          {
            ...wire.deps,
            spawn(...args) {
              spawns++;
              return wire.deps.spawn(...args);
            },
          },
        );
      } catch (error) {
        startupError = error;
      }
      assert.equal(spawns, 1, 'the genuine approved profile must reach exactly one synthetic Admin child');
      assert.equal(startupError, undefined);
      assert.equal(client.ready.projectVerifiedContinuation, true);
      assert.equal(wire.calls.length, 0);
      const done = await client.end();
      assert.equal(done.nativeExit, 0);
      assert.equal(done.childClosed, true);
      for (const options of [
        { projectVerifiedContinuationProof: { ...proof }, forwardWindow: true },
        { projectVerifiedContinuationProof: proof, forwardWindow: false },
        {
          projectVerifiedContinuationProof: {
            ...proof,
            sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
          },
          forwardWindow: true,
        },
        {
          projectVerifiedContinuationProof: { ...proof, windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc' },
          forwardWindow: true,
        },
      ]) {
        let rejectedSpawns = 0;
        await assert.rejects(
          module.startFoundationAdminClient(
            { repositoryRoot: f.directory, now: f.now, ...options },
            {
              spawn() {
                rejectedSpawns++;
                throw Error('SYNTHETIC_MUST_NOT_SPAWN');
              },
            },
          ),
          /FOUNDATION_ADMIN_BLOCKED/,
        );
        assert.equal(rejectedSpawns, 0);
      }
    } finally {
      f.cleanup();
    }
  });

function syntheticClaimedAmendment() {
  const f = syntheticClockAmendment({ parentProcessId: 90210 });
  f.setTime(Date.parse('2026-10-21T14:00:00.000Z'));
  return { proof: f.claim(f.admit()), now: f.now };
}
test('approved amendment client requires a genuine claimed segment and native matching ready clocks', async () => {
  const hadAppData = Object.hasOwn(process.env, 'LOCALAPPDATA'),
    appData = process.env.LOCALAPPDATA;
  const { proof, now } = syntheticClaimedAmendment(),
    f = fixture({ amendmentProof: proof });
  assert.equal(Object.hasOwn(process.env, 'LOCALAPPDATA'), hadAppData);
  assert.equal(process.env.LOCALAPPDATA, appData);
  const client = await startFoundationAdminClient({ now, clockAmendmentProof: proof }, f.deps);
  assert.equal(client.ready.clockSegmentId, proof.segmentId);
  assert.equal(Date.parse(client.ready.actionDeadline), proof.deadlineAt);
  await assert.rejects(client.archiveUnprovisioned(), /FOUNDATION_ADMIN_BLOCKED/);
  assert.equal(f.calls.length, 0);
  await client.end();
  await assert.rejects(
    startFoundationAdminClient({ now, clockAmendmentProof: { ...proof } }, fixture().deps),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
  await assert.rejects(
    startFoundationAdminClient(
      { now, clockAmendmentProof: proof, originalDeadlineAtMs: 1792584023481 },
      fixture().deps,
    ),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
  await assert.rejects(
    startFoundationAdminClient(
      { now, clockAmendmentProof: proof },
      fixture({ amendmentProof: proof, clockMismatch: true }).deps,
    ),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
});
test('amendment DB fixture passes in a fresh child with LOCALAPPDATA absent', () => {
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA'])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  const r = spawnSync(
    process.execPath,
    [
      '--test',
      '--test-name-pattern=^approved amendment client requires a genuine claimed segment and native matching ready clocks$',
      fileURLToPath(import.meta.url),
    ],
    { cwd: process.cwd(), env, encoding: 'utf8', windowsHide: true, timeout: 30000 },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /pass 1/);
});

test('postcheck continuation accepts only its actual claimed proof and exact no-migration ready envelope', async () => {
  const f = syntheticPostcheckContinuation({ parentProcessId: 90210 }),
    proof = f.claim(f.admit());
  const wire = fixture({ continuationProof: proof });
  const client = await startFoundationAdminClient(
    { now: f.now, postcheckContinuationProof: proof },
    wire.deps,
  );
  assert.equal(client.ready.postcheckContinuation, true);
  assert.equal(client.ready.clockSegmentId, proof.segmentId);
  assert.equal(Date.parse(client.ready.actionDeadline), proof.deadlineAt);
  assert.deepEqual(await client.archiveUnprovisioned(), { kind: 'archiveUnprovisioned' });
  await client.end();
  for (const options of [
    { postcheckContinuationProof: { ...proof } },
    { postcheckContinuationProof: proof, clockAmendmentProof: {} },
    { postcheckContinuationProof: proof, originalDeadlineAtMs: 1792584023481 },
  ]) {
    let dispatched = 0;
    await assert.rejects(
      startFoundationAdminClient(
        { now: f.now, ...options },
        {
          spawn() {
            dispatched++;
            throw Error('unexpected');
          },
        },
      ),
      /FOUNDATION_ADMIN_BLOCKED/,
    );
    assert.equal(dispatched, 0);
  }
  await assert.rejects(
    startFoundationAdminClient(
      { now: f.now, postcheckContinuationProof: proof },
      fixture({ continuationProof: proof, clockMismatch: true }).deps,
    ),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
});
test('zero-setup continuation forwards only the fixed original clock and rejects fresh or extended clocks', async () => {
  const deadline = 1792584023481,
    now = () => deadline - 1800000;
  const f = fixture({ originalDeadlineAtMs: deadline });
  const client = await startFoundationAdminClient({ now, originalDeadlineAtMs: deadline }, f.deps);
  assert.equal(Date.parse(client.ready.actionDeadline), deadline);
  assert.equal(Date.parse(client.ready.stopNewAt), deadline - 600000);
  assert.equal(Date.parse(client.ready.hardDeadline), deadline + 600000);
  await client.end();
  for (const value of [deadline + 1, deadline - 1, '1792584023481'])
    await assert.rejects(
      startFoundationAdminClient({ now, originalDeadlineAtMs: value }, fixture().deps),
      /FOUNDATION_ADMIN_BLOCKED/,
    );
  await assert.rejects(
    startFoundationAdminClient(
      { now: () => deadline - 600000, originalDeadlineAtMs: deadline },
      fixture().deps,
    ),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
});
test('foreign SQL and overlapping command requests cannot cross the fixed child protocol', async () => {
  await assert.rejects(
    startFoundationAdminClient({ repositoryRoot: 'C:\\unowned-other-project' }, fixture().deps),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
  const f = fixture(),
    client = await startFoundationAdminClient({ now: () => epoch }, f.deps);
  await assert.rejects(
    client.readGateway({ query: 'select secret from another_project', params: [] }),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
  assert.equal(f.calls.length, 0);
  await client.end();
});
test('malformed private child output becomes only a fixed error and child termination', async () => {
  const f = fixture({ badReady: true });
  await assert.rejects(startFoundationAdminClient({ now: () => epoch }, f.deps), {
    message: 'FOUNDATION_ADMIN_BLOCKED',
  });
});
test('oversized output is permanently discarded while EOF closes the bounded parent', async () => {
  const f = fixture({ overflow: true }),
    client = await startFoundationAdminClient({ now: () => epoch }, f.deps);
  await assert.rejects(client.postcheck(), { message: 'FOUNDATION_ADMIN_BLOCKED' });
  assert.equal(client.state().outputDiscarded, true);
  const stopped = await client.abort();
  assert.equal(stopped.childClosed, true);
  assert.equal(stopped.receipt, null);
});
test('actual checked-in type AST verifies all four schemas and quoted property syntax equivalently', () => {
  const reference = readFileSync('packages/shared/src/db.types.ts', 'utf8');
  const candidate = reference.replace(/^(\s*)(app|api|ops|ingest|Tables|Functions|Views):/gm, '$1"$2":');
  assert.equal(verifyFoundationTypes(candidate, reference).astEquivalent, true);
  assert.throws(
    () =>
      verifyFoundationTypes(reference.replace('foundation_gateway_status:', 'another_function:'), reference),
    /FOUNDATION_TYPES_BLOCKED/,
  );
  assert.throws(
    () => verifyFoundationTypes('export type Database = {broken:', reference),
    /FOUNDATION_TYPES_BLOCKED/,
  );
});
test('fixed settlement SQL remains exactly the source-reviewed native settlement query', () => {
  const canonical = readFileSync('scripts/n8n/foundation-native-settlement.mjs', 'utf8').match(
    /export const foundationSettlementQuery = `([\s\S]+?)`;/,
  )[1];
  assert.equal(readFileSync('scripts/db/foundation-settlement.sql', 'utf8').trim(), canonical.trim());
});
