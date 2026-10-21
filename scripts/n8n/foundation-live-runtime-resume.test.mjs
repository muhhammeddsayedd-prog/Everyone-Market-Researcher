import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFoundationLiveAcceptanceSession } from './foundation-live-runtime-cli.mjs';
import { syntheticZeroSetup } from './foundation-live-runtime-resume-fixtures.mjs';
import { fixture } from './foundation-live-runtime-fixtures.mjs';

test('original zero-setup deadline reaches the actual admin port and shared control reader without a new clock', async () => {
  const f = fixture(),
    z = syntheticZeroSetup();
  let session,
    adminArgs,
    lists = 0;
  writeFileSync(join(f.directory, 'management.jsonl'), z.header);
  const packet = {
    kind: 'm03_acceptance_private_input',
    version: 1,
    approvedHead: z.checkpoint.sourceCommitSha,
    approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
    sourceCommitSha: z.checkpoint.sourceCommitSha,
    managementKey: 'SYNTHETIC_RESUME_MANAGEMENT',
    writerPassword: 'SYNTHETIC_RESUME_WRITER',
    apifyReadToken: 'SYNTHETIC_RESUME_READER',
    machineToken: 'M'.repeat(43),
    protectionBypass: 'B'.repeat(32),
    leaseExpiry: z.now() + 7200000,
  };
  const actualPhysicalReceipt = {
    nativeExit: 0,
    childClosed: true,
    receipt: { childrenClosed: true, handoffDeleted: true, leaseDeleted: true, scratchDeleted: true },
  };
  try {
    session = createFoundationLiveAcceptanceSession(packet, () => {}, {
      now: z.now,
      zeroSetupProof: z.proof,
      storage: { directory: f.directory },
      createNativeTransport: () => ({
        request: async ({ path }) => {
          lists++;
          assert.ok(path.startsWith('/api/v1/executions?'));
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
            throw Error('SYNTHETIC_POSTCHECK_STOP');
          },
          end: async () => actualPhysicalReceipt,
        };
      },
    });
    assert.equal(session.deadlineAt, z.checkpoint.deadlineAt);
    assert.equal(readFileSync(join(f.directory, 'management.jsonl'), 'utf8'), z.header);
    const r = await session.command({
      kind: 'm03_acceptance_command',
      id: 'resume_preflight',
      command: 'prepare',
    });
    assert.equal(r.status, 'blocked');
    assert.equal(r.controlAttempts, 50);
    assert.equal(lists, 50);
    assert.equal(adminArgs.originalDeadlineAtMs, z.checkpoint.deadlineAt);
    assert.equal(adminArgs.now(), z.now());
    assert.deepEqual(Object.keys(adminArgs).sort(), ['now', 'originalDeadlineAtMs', 'repositoryRoot']);
    const closed = await session.close();
    assert.equal(closed.adminChildClosed, true);
    assert.equal(closed.childTransportsClosed, true);
    assert.equal(readFileSync(join(f.directory, 'management.jsonl'), 'utf8'), z.header);
  } finally {
    await session?.close();
    f.cleanup();
  }
});
