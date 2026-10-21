import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { readFileSync, existsSync } from 'node:fs';
import { syntheticRemainingContinuation } from './foundation-live-remaining-fixtures.mjs';
import { runFoundationLiveRuntimeCli } from './foundation-live-runtime-cli.mjs';

test('synthetic remaining preparation carries totals through50 baseline reads and passes only its new proof to admin', async () => {
  const f = await syntheticRemainingContinuation();
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
      remainingContinuationProof: proof,
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
    assert.equal(result.managementAttempts, 4);
    assert.equal(result.controlAttempts, 151);
    assert.equal(
      f.module.assertFoundationLiveRemainingContinuationProof(adminArgs.remainingContinuationProof, {
        claimed: true,
      }),
      proof,
    );
    assert.deepEqual(Object.keys(adminArgs).sort(), ['now', 'remainingContinuationProof', 'repositoryRoot']);
    assert.equal(result.nativeExecutions, 0);
    assert.equal(result.providerDirectAttempts, 0);
    assert.equal(result.gatewayPreflightAttempts, 0);
    assert.equal(JSON.parse(readFileSync(f.paths.control, 'utf8').trimEnd().split('\n').at(-1)).ordinal, 150);
    assert.equal((await session.close()).adminChildClosed, true);
  } finally {
    await session?.close();
    f.cleanup();
  }
});

test('remaining CLI refuses missing authority before reading private protocol or starting children', async () => {
  const input = new PassThrough(),
    output = new PassThrough();
  let text = '',
    privateChildren = 0;
  output.on('data', (b) => {
    text += b;
  });
  try {
    const code = await runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['SessionRemainingContinuation'],
      dependencies: {
        readRemainingContinuation() {
          throw Error('SYNTHETIC_NO_OWNER_APPROVAL');
        },
        startAdmin() {
          privateChildren++;
          throw Error('SYNTHETIC_UNEXPECTED');
        },
      },
    });
    assert.equal(code, 1);
    assert.equal(privateChildren, 0);
    assert.equal(input.readableFlowing, null);
    assert.deepEqual(JSON.parse(text), { kind: 'm03_acceptance_closed', status: 'blocked', residual: true });
    assert.equal(text.includes('SYNTHETIC_NO_OWNER_APPROVAL'), false);
  } finally {
    input.destroy();
    output.destroy();
  }
});

test('synthetic claimed remaining CLI retains original source and reports aggregate4/101 before any remote work', async () => {
  const f = await syntheticRemainingContinuation();
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
      args: ['SessionRemainingContinuation'],
      dependencies: {
        now: f.now,
        storage: { directory: f.directory + '/scripts/n8n/out/foundation/live' },
        readRemainingContinuation: () => admitted,
        claimRemainingContinuation: (p) => f.claim(p),
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
    assert.equal(state.managementAttempts, 4);
    assert.equal(state.controlAttempts, 101);
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
