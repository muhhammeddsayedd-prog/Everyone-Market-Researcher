import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { EventEmitter } from 'node:events';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';
import { PassThrough } from 'node:stream';
import { runFoundationLiveRuntimeCli } from './foundation-live-runtime-cli.mjs';
import { startFoundationAdminClient } from '../db/foundation-admin-client.mjs';

test('project-verified replacement refuses missing approval before private protocol and children', async () => {
  const input = new PassThrough(),
    output = new PassThrough();
  let text = '',
    reads = 0,
    children = 0;
  output.on('data', (bytes) => {
    text += bytes;
  });
  try {
    assert.equal(
      await runFoundationLiveRuntimeCli({
        input,
        output,
        args: ['SessionProjectVerifiedContinuation'],
        dependencies: {
          readProjectVerifiedContinuation() {
            reads++;
            throw Error('SYNTHETIC_APPROVAL_REQUIRED');
          },
          startAdmin() {
            children++;
            throw Error('UNEXPECTED');
          },
        },
      }),
      1,
    );
    assert.equal(reads, 1);
    assert.equal(children, 0);
    assert.equal(input.readableFlowing, null);
    assert.deepEqual(JSON.parse(text), { kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
  } finally {
    input.destroy();
    output.destroy();
  }
});

test('project-verified admin cannot use an unbranded old-style proof or spawn before proof validation', async () => {
  let children = 0;
  await assert.rejects(
    startFoundationAdminClient(
      {
        projectVerifiedContinuationProof: {
          kind: 'foundation_remaining_continuation',
          segmentId: '20275b22-b7fe-4737-a9a4-c50c2feadb74',
        },
      },
      {
        spawn() {
          children++;
          throw Error('UNEXPECTED');
        },
      },
    ),
    /FOUNDATION_ADMIN_BLOCKED/,
  );
  assert.equal(children, 0);
});

test('genuine claimed project-verified admin forwards only its new flag and requires its exact ready clock and mode', async () => {
  for (const fault of ['none', 'old-mode', 'clock', 'extra']) {
    const f = await syntheticProjectVerifiedContinuation();
    let client;
    try {
      const proof = f.claim(f.admit());
      const module = await f.copy('foundation-admin-client.mjs');
      const deps = {
        spawn(executable, args, options) {
          assert.equal(args.includes('-ProjectVerifiedContinuation'), true);
          for (const old of [
            '-RemainingContinuation',
            '-StartupReplacement',
            '-PostcheckContinuation',
            '-ClockAmendment',
            '-OriginalDeadlineAtMs',
          ])
            assert.equal(args.includes(old), false);
          assert.equal(Object.hasOwn(options.env, 'PGPASSWORD'), false);
          const child = new EventEmitter();
          child.stdin = new PassThrough();
          child.stdout = new PassThrough();
          child.stderr = new PassThrough();
          child.stdin.on('end', () =>
            queueMicrotask(() => child.emit('close', fault === 'none' ? 0 : 1, null)),
          );
          child.stdin.on('data', (bytes) => {
            const row = JSON.parse(bytes.toString());
            assert.equal(row.kind, 'end');
            child.stdout.write(
              JSON.stringify({
                type: 'foundation_admin_result',
                id: row.id,
                kind: row.kind,
                ok: true,
                result: { ended: true },
              }) + '\n',
            );
            child.stdout.write(
              JSON.stringify({
                version: 1,
                runId: 'synthetic-project-verified',
                phaseAControl: true,
                childrenClosed: true,
                handoffDeleted: true,
                leaseDeleted: true,
                scratchDeleted: true,
                projectVerifiedContinuation: true,
              }) + '\n',
            );
          });
          queueMicrotask(() => {
            const ready = {
              type: 'foundation_admin_ready',
              runId: 'synthetic-project-verified',
              historyAfter: 'complete',
              projectRef: 'zmotjsbzhzjvpelxvxlf',
              hardDeadline: new Date(proof.hardDeadlineAt).toISOString(),
              actionDeadline: new Date(proof.deadlineAt + (fault === 'clock' ? 1 : 0)).toISOString(),
              stopNewAt: new Date(proof.stopNewAt).toISOString(),
              postchecksVerified: false,
              clockSegmentId: proof.segmentId,
              postcheckContinuation: true,
              projectVerifiedContinuation: true,
            };
            if (fault === 'old-mode') {
              delete ready.projectVerifiedContinuation;
              ready.remainingContinuation = true;
            }
            if (fault === 'extra') ready.remainingContinuation = true;
            child.stdout.write(JSON.stringify(ready) + '\n');
          });
          return child;
        },
      };
      if (fault !== 'none')
        await assert.rejects(
          module.startFoundationAdminClient({ now: f.now, projectVerifiedContinuationProof: proof }, deps),
          /FOUNDATION_ADMIN_BLOCKED/,
        );
      else {
        client = await module.startFoundationAdminClient(
          { now: f.now, projectVerifiedContinuationProof: proof },
          deps,
        );
        assert.equal(client.ready.projectVerifiedContinuation, true);
        const closed = await client.end();
        assert.equal(closed.childClosed, true);
        assert.equal(closed.nativeExit, 0);
      }
      let spawned = false;
      await assert.rejects(
        module.startFoundationAdminClient(
          { now: f.now, projectVerifiedContinuationProof: proof, remainingContinuationProof: proof },
          {
            spawn() {
              spawned = true;
            },
          },
        ),
        /FOUNDATION_ADMIN_BLOCKED/,
      );
      assert.equal(spawned, false);
    } finally {
      f.cleanup();
    }
  }
});

test('synthetic project-verified preparation carries totals through50 baseline reads and passes only its new proof to admin', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  let session,
    adminArgs,
    nativeReads = 0;
  try {
    const proof = f.claim(f.admit());
    const cli = await f.copy('foundation-live-runtime-cli.mjs');
    for (const name of ['bindings.dev.json', 'transport.dev.json'])
      f.put('n8n/foundation/' + name, readFileSync(new URL('../../n8n/foundation/' + name, import.meta.url)));
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
    );
    for (const key of Object.keys(bindings.workflowRefs))
      f.put(
        'n8n/workflows/' + key + '.json',
        readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url)),
      );
    const packet = {
      kind: 'm03_acceptance_private_input',
      version: 1,
      approvedHead: proof.sourceCommitSha,
      approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
      sourceCommitSha: proof.sourceCommitSha,
      managementKey: 'SYNTHETIC_PRIVATE_MANAGEMENT',
      writerPassword: 'SYNTHETIC_PRIVATE_WRITER',
      apifyReadToken: 'SYNTHETIC_PRIVATE_APIFY_READ',
      machineToken: 'M'.repeat(43),
      protectionBypass: 'B'.repeat(32),
      leaseExpiry: f.now() + 7200000,
    };
    session = cli.createFoundationLiveAcceptanceSession(packet, () => {}, {
      now: f.now,
      storage: { directory: f.directory + '/scripts/n8n/out/foundation/live' },
      projectVerifiedContinuationProof: proof,
      createNativeTransport: () => ({
        request: async () => {
          nativeReads++;
          return {
            status: 200,
            body: (async function* () {
              yield Buffer.from('{"data":[],"nextCursor":null}');
            })(),
            closed: Promise.resolve(),
          };
        },
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
    const result = await session.command({
      kind: 'm03_acceptance_command',
      id: 'prepare_only',
      command: 'prepare',
    });
    assert.equal(result.status, 'blocked');
    assert.equal(nativeReads, 50);
    assert.equal(result.managementAttempts, 6);
    assert.equal(result.controlAttempts, 251);
    assert.equal(
      f.module.assertFoundationLiveProjectVerifiedContinuationProof(
        adminArgs.projectVerifiedContinuationProof,
        {
          claimed: true,
        },
      ),
      proof,
    );
    assert.deepEqual(Object.keys(adminArgs).sort(), [
      'now',
      'projectVerifiedContinuationProof',
      'repositoryRoot',
    ]);
    assert.equal(result.nativeExecutions, 0);
    assert.equal(result.providerDirectAttempts, 0);
    assert.equal(result.gatewayPreflightAttempts, 0);
    assert.equal(JSON.parse(readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').at(-1)).ordinal, 250);
    assert.equal((await session.close()).adminChildClosed, true);
  } finally {
    await session?.close();
    f.cleanup();
  }
});

test('synthetic claimed project-verified CLI retains original source and reports aggregate6/201 before any remote work', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  const input = new PassThrough(),
    output = new PassThrough();
  let text = '',
    buffer = '',
    privateChildren = 0;
  const frames = [];
  try {
    const admitted = f.admit();
    const cli = await f.copy('foundation-live-runtime-cli.mjs');
    for (const name of ['bindings.dev.json', 'transport.dev.json'])
      f.put('n8n/foundation/' + name, readFileSync(new URL('../../n8n/foundation/' + name, import.meta.url)));
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
    );
    for (const key of Object.keys(bindings.workflowRefs))
      f.put(
        'n8n/workflows/' + key + '.json',
        readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url)),
      );
    output.on('data', (bytes) => {
      text += bytes;
      buffer += bytes;
      while (buffer.includes('\n')) {
        const at = buffer.indexOf('\n'),
          frame = JSON.parse(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
        frames.push(frame);
        if (frame.kind === 'm03_acceptance_ready')
          input.write(
            JSON.stringify({ kind: 'm03_acceptance_command', id: 'state_only', command: 'state' }) + '\n',
          );
        if (frame.kind === 'm03_acceptance_result')
          input.write(
            JSON.stringify({ kind: 'm03_acceptance_command', id: 'close_only', command: 'close' }) + '\n',
          );
      }
    });
    const run = cli.runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['SessionProjectVerifiedContinuation'],
      dependencies: {
        now: f.now,
        storage: { directory: f.directory + '/scripts/n8n/out/foundation/live' },
        readProjectVerifiedContinuation: () => admitted,
        claimProjectVerifiedContinuation: (p) => f.claim(p),
        startAdmin() {
          privateChildren++;
          throw Error('SYNTHETIC_UNEXPECTED');
        },
      },
    });
    const privatePacket = {
      kind: 'm03_acceptance_private_input',
      version: 1,
      approvedHead: admitted.sourceCommitSha,
      approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
      sourceCommitSha: admitted.sourceCommitSha,
      managementKey: 'SYNTHETIC_PRIVATE_MANAGEMENT',
      writerPassword: 'SYNTHETIC_PRIVATE_WRITER',
      apifyReadToken: 'SYNTHETIC_PRIVATE_APIFY_READ',
      machineToken: 'M'.repeat(43),
      protectionBypass: 'B'.repeat(32),
      leaseExpiry: f.now() + 7200000,
    };
    input.write(JSON.stringify(privatePacket) + '\n');
    const code = await run;
    assert.equal(code, 0);
    assert.equal(privateChildren, 0);
    assert.equal(
      frames.some((r) => r.kind === 'm03_acceptance_ready'),
      true,
    );
    const state = frames.find((r) => r.kind === 'm03_acceptance_result');
    assert.equal(state.managementAttempts, 6);
    assert.equal(state.controlAttempts, 201);
    assert.equal(state.nativeExecutions, 0);
    assert.equal(state.gatewayPreflightAttempts, 0);
    assert.equal(state.providerDirectAttempts, 0);
    assert.equal(state.phaseBReady, false);
    assert.equal(state.businessAcceptanceProven, false);
    assert.equal(
      frames.some((r) => r.kind === 'mcp_port_request'),
      false,
    );
    assert.equal(frames.at(-1).childTransportsClosed, true);
    assert.equal(existsSync(f.paths.management.replace('management.jsonl', 'runtime.operation.lock')), false);
    for (const name of [
      'managementKey',
      'writerPassword',
      'apifyReadToken',
      'machineToken',
      'protectionBypass',
    ])
      assert.equal(text.includes(privatePacket[name]), false);
  } finally {
    input.destroy();
    output.destroy();
    f.cleanup();
  }
});

test('management and control keep main ordinals while charging fixed carried attempts', async () => {
  const f = await syntheticProjectVerifiedContinuation();
  let budget;
  try {
    const proof = f.claim(f.admit()),
      runtime = await f.copy('foundation-live-runtime.mjs'),
      control = await f.copy('foundation-control-state.mjs');
    const old = readFileSync(f.paths.management, 'utf8');
    budget = runtime.createFoundationLiveManagementBudget(
      { sourceCommitSha: proof.sourceCommitSha, deadlineAt: proof.deadlineAt },
      { now: f.now, directory: dirname(f.paths.management), projectVerifiedContinuationProof: proof },
    );
    assert.equal(budget.snapshot().attempts, 6);
    assert.equal(budget.snapshot().mainAttempts, 2);
    budget.admit();
    assert.equal(budget.snapshot().attempts, 7);
    assert.equal(
      JSON.parse(readFileSync(f.paths.management, 'utf8').trimEnd().split('\n').at(-1)).ordinal,
      3,
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
      projectVerifiedContinuationProof: proof,
    });
    assert.equal(cb.snapshot().attempts, 201);
    cb.admit({ kind: 'discovery' });
    assert.equal(cb.snapshot().attempts, 202);
    assert.equal(journal.rows.at(-1).ordinal, 201);
    assert.equal(
      control.createFoundationControlBudget({ journal, now: f.now, deadlineAt: proof.deadlineAt }),
      cb,
    );
    assert.throws(() =>
      control.createFoundationControlBudget({
        journal,
        now: f.now,
        deadlineAt: proof.deadlineAt,
        projectVerifiedContinuationProof: { ...proof },
      }),
    );
    for (let i = 7; i < 512; i++) budget.admit();
    for (let i = 202; i < 2048; i++) cb.admit({ kind: 'discovery' });
    assert.throws(() => budget.admit());
    assert.throws(() => cb.admit({ kind: 'discovery' }));
    assert.equal(budget.snapshot().mainAttempts, 508);
    assert.equal(cb.snapshot().mainAttempts, 2047);
  } finally {
    budget?.close();
    f.cleanup();
  }
});

test('actual setup factory resumes two fixed GETs once and emits physical ordinal3 before a synthetic transport failure', async () => {
  const f = await syntheticProjectVerifiedContinuation();
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
    let count = 6;
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
      projectVerifiedContinuationProof: proof,
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
    assert.equal(setup.snapshot().requestCount, 2);
    assert.throws(() => module.createFoundationLiveSetup(input, deps));
    await assert.rejects(setup.prepare());
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.equal(rows[0].ordinal, 3);
    assert.equal(count, 7);
    await assert.rejects(setup.prepare());
    assert.equal(calls.length, 1);
  } finally {
    setup?.close();
    f.cleanup();
  }
});
