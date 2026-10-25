import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  runFoundationLiveRuntimeCli,
  createFoundationLiveAcceptanceSession,
  projectFoundationBaselineDiagnostic,
} from './foundation-live-runtime-cli.mjs';
import * as liveSql from './foundation-live-runtime-cli.mjs';
import { fixture, syntheticBaselinePreflight } from './foundation-live-runtime-fixtures.mjs';
import { syntheticProjectVerifiedContinuation } from './foundation-live-project-verified-fixtures.mjs';

test('functional commands are finite, reject inherited names and require exact identifiers', async () => {
  const { foundationFunctionalCommand } = await import('./foundation-live-runtime-cli.mjs');
  for (const command of [
    'state',
    'prepare_preview',
    'prepare_runtime',
    'authorize_start',
    'callback_unknown',
    'restore',
    'close',
    'close_window',
  ])
    assert.equal(foundationFunctionalCommand({ id: 'public_case', command }), true);
  for (const command of ['charge_control', 'charge_management']) {
    assert.equal(foundationFunctionalCommand({ id: 'public_case', command, count: 1 }), true);
    for (const count of [0, -1, 101, NaN, '1'])
      assert.equal(foundationFunctionalCommand({ id: 'public_case', command, count }), false);
  }
  for (const command of ['toString', '__proto__', 'constructor', 'delete', 'request', 'execute'])
    assert.equal(foundationFunctionalCommand({ id: 'public_case', command }), false);
  assert.equal(
    foundationFunctionalCommand({ id: 'public_case', command: 'state', url: 'https://invalid.example' }),
    false,
  );
  assert.equal(
    foundationFunctionalCommand({
      id: 'public_case',
      command: 'original',
      apifyRunId: 'SYNTHETIC_ORIGINAL',
      runId: 'a'.repeat(36),
    }),
    false,
  );
  assert.equal(
    foundationFunctionalCommand({
      id: 'public_case',
      command: 'original',
      apifyRunId: 'SYNTHETIC_ORIGINAL',
      runId: '00000000-0000-4000-8000-000000000001',
    }),
    true,
  );
});

test('functional durable writes complete partial byte writes and refuse nonprogress before authorization', async () => {
  const { writeFoundationFunctionalBytes } = await import('./foundation-live-runtime-cli.mjs');
  const bytes = Buffer.from('public intent — عربي 🙂\n'),
    chunks = [];
  writeFoundationFunctionalBytes(42, bytes, (fd, buffer, offset, length, position) => {
    assert.equal(fd, 42);
    assert.equal(position, null);
    const count = Math.min(2, length);
    chunks.push(buffer.subarray(offset, offset + count));
    return count;
  });
  assert.deepEqual(Buffer.concat(chunks), bytes);
  for (const value of [0, -1, NaN, 1.5, bytes.length + 1])
    assert.throws(
      () => writeFoundationFunctionalBytes(42, bytes, () => value),
      /M03_FUNCTIONAL_DURABLE_WRITE/,
    );
});

test('functional cleanup blocks callback-path removal until safe Close and attempts independent known resources', async () => {
  const { restoreFoundationFunctionalResources } = await import('./foundation-live-runtime-cli.mjs');
  for (const failure of ['close', 'runtime', 'preview', null]) {
    const calls = [];
    const operation = (name) => async () => {
      calls.push(name);
      if (failure === name) throw Error('synthetic operation failed');
    };
    const work = restoreFoundationFunctionalResources({
      closeWindow: operation('close'),
      restoreRuntime: operation('runtime'),
      cleanupPreview: operation('preview'),
    });
    if (failure === 'close') {
      await assert.rejects(work, /synthetic operation failed/);
      assert.deepEqual(calls, ['close']);
    } else {
      assert.deepEqual(await work, {
        runtimeRestored: failure !== 'runtime',
        previewCleaned: failure !== 'preview',
      });
      assert.deepEqual(calls, ['close', 'runtime', 'preview']);
    }
  }
});

const functionalDelivery = () => ({
  kind: 'delivery_verified',
  head: '890892eb7c61293f0f449102d095acc6fb212765',
  usageUnchanged: { management: 1661, control: 1464, combined: 3125, vercel: 288, actors: 0, usd: 0 },
});
const functionalPacket = () => ({
  kind: 'm03_functional_private_input',
  version: 1,
  sourceCommitSha: 'a'.repeat(40),
  managementKey: 'SYNTHETIC_MANAGEMENT_ONLY',
  writerPassword: 'SYNTHETIC_WRITER_ONLY',
  apifyReadToken: 'SYNTHETIC_APIFY_ONLY',
  machineToken: 'm'.repeat(43),
  protectionBypass: 'b'.repeat(32),
});
async function functionalLocalCase(
  commands,
  { rows = [functionalDelivery()], operator, packet = functionalPacket() } = {},
) {
  const { writeFileSync } = await import('node:fs');
  const { runFoundationFunctionalCli } = await import('./foundation-live-runtime-cli.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'emr-functional-public-test-'));
  const input = new PassThrough(),
    output = [];
  try {
    writeFileSync(
      join(directory, 'functional-acceptance-20261025.jsonl'),
      rows.map((row) => JSON.stringify(row)).join('\n') + '\n',
    );
    if (operator) writeFileSync(join(directory, 'functional-dev-verified.json'), JSON.stringify(operator));
    input.end(
      [JSON.stringify(packet), ...commands.map((command) => JSON.stringify(command))].join('\n') + '\n',
    );
    const exit = await runFoundationFunctionalCli({
      input,
      emit: (row) => output.push(row),
      checkOnly: false,
      stateDirectory: directory,
    });
    const journal = readFileSync(join(directory, 'functional-acceptance-20261025.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((row) => JSON.parse(row));
    return { exit, output, journal };
  } finally {
    input.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
}

test('functional public CheckOnly reads no private input or operator record', async () => {
  const { runFoundationFunctionalCli } = await import('./foundation-live-runtime-cli.mjs');
  const output = [];
  assert.equal(await runFoundationFunctionalCli({ checkOnly: true, emit: (row) => output.push(row) }), 0);
  assert.deepEqual(output, [
    {
      kind: 'm03_functional_result',
      id: 'public',
      status: 'check_only_ready',
      code: 'M03_FUNCTIONAL_PUBLIC_READY',
    },
  ]);
});

test('functional stdin retains commands buffered with its private first line and closes an untouched scope', async () => {
  const r = await functionalLocalCase([
    { id: 'buffered_state', command: 'state' },
    { id: 'buffered_close', command: 'close' },
  ]);
  assert.equal(r.exit, 0);
  assert.equal(
    r.output.some(
      (row) =>
        row.id === 'buffered_state' && row.management === 1661 && row.control === 1464 && row.vercel === 288,
    ),
    true,
  );
  assert.equal(r.output.at(-1).code, 'M03_FUNCTIONAL_CLOSED');
  assert.equal(
    r.journal.some((row) => row.kind === 'functional_closed'),
    true,
  );
  assert.equal(
    r.journal.some((row) => row.kind === 'functional_setup'),
    false,
  );
});

test('functional usage retains checkpoint charges and precharges manual native operations without network calls', async () => {
  const r = await functionalLocalCase([
    { id: 'native_management', command: 'charge_management', count: 3 },
    { id: 'native_control', command: 'charge_control', count: 2 },
    { id: 'close', command: 'close' },
  ]);
  assert.equal(r.exit, 0);
  assert.deepEqual(r.journal.filter((row) => row.kind === 'functional_usage').at(-1).usage, {
    management: 1664,
    control: 1466,
    combined: 3130,
    vercel: 288,
  });
});

test('functional malformed operator dates, admission counts and history fail before Preview networking', async () => {
  const baseline = {
    method: 'native_sql_editor',
    projectRef: 'zmotjsbzhzjvpelxvxlf',
    stage: 'preflight',
    observedAt: new Date().toISOString(),
    identityVerified: true,
    migrationCount: 15,
    historyAggregate: 'ded9037b363fe2cbf6d7dc2e19731c1fe25963100db92b160967c84ec7b7c6d9',
    quiescent: true,
    fixtureOwned: true,
    globalAdmittedCount: 13,
  };
  for (const change of [
    { observedAt: 'not-a-date' },
    { globalAdmittedCount: undefined },
    { globalAdmittedCount: '13' },
    { historyAggregate: '0'.repeat(64) },
    { observedAt: new Date(Date.now() - 360000).toISOString() },
  ]) {
    const r = await functionalLocalCase([{ id: 'prepare', command: 'prepare_preview' }], {
      operator: { ...baseline, ...change },
    });
    assert.equal(r.exit, 0); // An untouched scope can close; the attempted check remains failed.
    assert.equal(r.output.find((row) => row.id === 'prepare').code, 'M03_FUNCTIONAL_DB_EVIDENCE');
    assert.equal(
      r.journal.some((row) => row.kind === 'functional_setup'),
      false,
    );
    assert.equal(
      r.journal.some((row) => row.kind === 'functional_usage'),
      false,
    );
    assert.equal(
      r.journal.some((row) => row.kind === 'functional_command_failure'),
      true,
    );
  }
});

test('functional SQL reserve cannot consume the physical Close admission', async () => {
  const r = await functionalLocalCase([{ id: 'prepare', command: 'prepare_preview' }], {
    operator: {
      method: 'native_sql_editor',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      stage: 'preflight',
      observedAt: new Date().toISOString(),
      identityVerified: true,
      migrationCount: 15,
      historyAggregate: 'ded9037b363fe2cbf6d7dc2e19731c1fe25963100db92b160967c84ec7b7c6d9',
      quiescent: true,
      fixtureOwned: true,
      globalAdmittedCount: 186,
    },
  });
  assert.equal(r.exit, 0);
  assert.equal(r.output.find((row) => row.id === 'prepare').code, 'M03_FUNCTIONAL_SQL_RESERVE');
  assert.equal(
    r.journal.some((row) => row.kind === 'functional_setup'),
    false,
  );
});

test('functional incomplete history and prior paid-start uncertainty never open another scope', async () => {
  for (const rows of [
    [],
    [functionalDelivery(), { kind: 'functional_open', windowId: '00000000-0000-4000-8000-000000000001' }],
    [functionalDelivery(), { kind: 'functional_actor_intent' }],
  ]) {
    const r = await functionalLocalCase([{ id: 'close', command: 'close' }], { rows });
    assert.equal(r.exit, 1);
    assert.equal(
      r.journal.filter((row) => row.kind === 'functional_open').length,
      rows.filter((row) => row.kind === 'functional_open').length,
    );
    assert.equal(
      r.journal.some((row) => row.kind === 'functional_setup'),
      false,
    );
  }
});

test('functional callback commands refuse before runtime and emit no secret contents', async () => {
  for (const command of [
    { id: 'unknown', command: 'callback_unknown' },
    { id: 'replay', command: 'callback_valid', apifyRunId: 'SYNTHETIC_ORIGINAL' },
  ]) {
    const r = await functionalLocalCase([command]);
    assert.equal(r.exit, 0);
    assert.equal(r.output.find((row) => row.id === command.id).code, 'M03_FUNCTIONAL_CALLBACK_ORDER');
    assert.equal(JSON.stringify(r.output).includes('SYNTHETIC_MANAGEMENT_ONLY'), false);
    assert.equal(
      r.journal.some((row) => row.kind === 'functional_callback_intent'),
      false,
    );
  }
});

const privatePacket = () => ({
  kind: 'm03_acceptance_private_input',
  version: 1,
  approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
  approvedPacketSha256: '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712',
  sourceCommitSha: 'a'.repeat(40),
  managementKey: 'SYNTHETIC_PRIVATE_MANAGEMENT',
  writerPassword: 'SYNTHETIC_PRIVATE_WRITER',
  apifyReadToken: 'SYNTHETIC_PRIVATE_APIFY_READ',
  machineToken: 'M'.repeat(43),
  protectionBypass: 'B'.repeat(32),
  leaseExpiry: Date.now() + 7200000,
});

const replaySnapshot = () => ({
  items: 1,
  rawSnapshots: 1,
  aiExtractQueue: 1,
  embedQueue: 1,
  mediaQueue: 0,
  costEntries: 1,
  itemsSha256: 'a'.repeat(64),
  rawSnapshotsSha256: 'b'.repeat(64),
  queuesSha256: 'c'.repeat(64),
  costsSha256: 'd'.repeat(64),
});
test('early browser discovery proves only exact rendered owned control before later REST metadata verification', async () => {
  const workflow = { id: 'MzimjpsuyPuK7SKe', workflow: { name: 'WF-00 · Orchestrator [dev]' } };
  const observed = {
    source: 'browser_ui',
    id: workflow.id,
    renderedName: workflow.workflow.name,
    workflowUrl: `https://muhhammedsayed.app.n8n.cloud/workflow/${workflow.id}`,
    executeControlEnabled: true,
  };
  const order = [],
    rows = [];
  const args = {
    workflow,
    now: () => 1792782000000,
    admit() {
      order.push('charged');
    },
    append(row) {
      rows.push(row);
    },
    port: {
      source: 'browser_ui',
      discover: async () => {
        order.push('observed');
        return observed;
      },
    },
  };
  assert.deepEqual(await liveSql.verifyFoundationLiveNativeMetadata(args), {
    browserControlVerified: true,
    executionsStarted: 0,
  });
  assert.deepEqual(order, ['charged', 'observed']);
  assert.deepEqual(rows, [
    {
      event: 'browser_port_preflight_verified',
      kind: 'browser_ui',
      workflowId: workflow.id,
      at: '2026-10-23T19:00:00.000Z',
    },
  ]);
  for (const value of [
    { ...observed, renderedName: 'foreign' },
    { ...observed, id: 'foreign' },
    { ...observed, workflowUrl: observed.workflowUrl + '/executions/1' },
    { ...observed, executeControlEnabled: false },
    { ...observed, scopes: ['workflow:execute'] },
    { id: workflow.id, name: workflow.workflow.name, active: false, availableInMCP: false },
  ])
    await assert.rejects(
      () =>
        liveSql.verifyFoundationLiveNativeMetadata({
          ...args,
          port: { source: 'browser_ui', discover: async () => value },
        }),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
});
test('early native metadata preflight charges once for owned inactive MCP-disabled discovery and never requests details or executes', async () => {
  const workflow = { id: 'MzimjpsuyPuK7SKe', workflow: { name: 'WF-00 · Orchestrator [dev]' } };
  const discovered = { id: workflow.id, name: workflow.workflow.name, active: false, availableInMCP: false };
  const order = [];
  const args = {
    workflow,
    now: () => 1792782000000,
    admit(value) {
      order.push('charge');
      assert.deepEqual(value, { kind: 'discovery', workflowId: workflow.id });
    },
    append(value) {
      order.push('verified');
      assert.deepEqual(value, {
        event: 'native_port_preflight_verified',
        workflowId: workflow.id,
        active: false,
        availableInMCP: false,
        at: '2026-10-23T19:00:00.000Z',
      });
    },
    port: {
      async discover(value) {
        order.push('discover');
        assert.deepEqual(value, { workflowId: workflow.id });
        return discovered;
      },
      details() {
        throw Error('UNAVAILABLE_DETAILS_FORBIDDEN');
      },
      start() {
        throw Error('NATIVE_START_FORBIDDEN');
      },
    },
  };
  assert.deepEqual(await liveSql.verifyFoundationLiveNativeMetadata(args), {
    metadataVerified: true,
    executionsStarted: 0,
  });
  assert.deepEqual(order, ['charge', 'discover', 'verified']);
  for (const value of [
    null,
    { ...discovered, extra: true },
    { ...discovered, name: 'changed' },
    { ...discovered, id: 'foreign' },
    { ...discovered, active: true },
    { ...discovered, availableInMCP: true },
    { ...discovered, availableInMCP: 'false' },
    { id: workflow.id, versionId: 'SYNTHETIC_PRIVATE_UNRELATED', canExecute: false, scopes: [] },
  ]) {
    let verified = false;
    await assert.rejects(
      () =>
        liveSql.verifyFoundationLiveNativeMetadata({
          ...args,
          append() {
            verified = true;
          },
          port: { discover: async () => value },
        }),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
    assert.equal(verified, false);
  }
});
test('strict replay parity validates exactly six counts/four hashes and ignores property order', () => {
  const before = replaySnapshot(),
    after = Object.fromEntries(Object.entries(before).reverse());
  assert.equal(liveSql.verifyFoundationLiveReplaySnapshots(before, after), true);
  const malformed = [
    undefined,
    null,
    {},
    [],
    { ...before, extra: true },
    { ...before, items: -1 },
    { ...before, items: 0.5 },
    { ...before, items: Number.MAX_SAFE_INTEGER + 1 },
    { ...before, items: NaN },
    { ...before, items: '1' },
    { ...before, itemsSha256: 'A'.repeat(64) },
    { ...before, costsSha256: 'd'.repeat(63) },
  ];
  const missing = { ...before };
  delete missing.items;
  malformed.push(missing);
  const symbol = { ...before, [Symbol('SYNTHETIC_PRIVATE_FIELD')]: true };
  malformed.push(symbol);
  const accessor = { ...before };
  Object.defineProperty(accessor, 'items', {
    enumerable: true,
    get() {
      throw Error('SYNTHETIC_PRIVATE_SQL');
    },
  });
  malformed.push(accessor);
  for (const bad of malformed) {
    assert.throws(
      () => liveSql.verifyFoundationLiveReplaySnapshots(bad, bad),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
    assert.throws(
      () => liveSql.verifyFoundationLiveReplaySnapshots(before, bad),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
  }
  for (const change of [{ items: 2 }, { costsSha256: 'e'.repeat(64) }])
    assert.throws(
      () => liveSql.verifyFoundationLiveReplaySnapshots(before, { ...before, ...change }),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
});
function callbackSqlFixture(options = {}) {
  const {
    caseId = 'callback.equal_replay',
    readFault,
    cleanup = true,
    cleanupFault = false,
    nativeState = 'native_settled',
  } = options;
  const before = Object.hasOwn(options, 'before') ? options.before : replaySnapshot(),
    after = Object.hasOwn(options, 'after') ? options.after : replaySnapshot();
  const calls = [],
    events = [];
  let reads = 0;
  return {
    calls,
    events,
    run: () =>
      liveSql.verifyFoundationLiveCallbackSqlCase({
        caseId,
        async readSnapshot() {
          calls.push('read' + reads);
          if (readFault === reads++) throw Error('SYNTHETIC_PRIVATE_SQL');
          return reads === 1 ? before : after;
        },
        async start() {
          calls.push('native');
          return { state: nativeState, caseId, executionIds: ['123', '124'] };
        },
        async cleanup() {
          calls.push('cleanup');
          if (cleanupFault) throw Error('SYNTHETIC_PRIVATE_CLEANUP');
          return cleanup;
        },
        append(event) {
          calls.push('append');
          events.push(event);
        },
        now: () => Date.parse('2026-10-23T12:00:00Z'),
      }),
  };
}
test('callback and concurrent-pair parity read before start/after settlement and clean exact native records', async () => {
  for (const caseId of [
    'callback.unknown',
    'callback.equal_replay',
    'callback.concurrent_pair',
    'callback.recovery_drill',
  ]) {
    const f = callbackSqlFixture({
        caseId,
        after: Object.fromEntries(Object.entries(replaySnapshot()).reverse()),
      }),
      r = await f.run();
    assert.equal(r.status, 'native_settled_and_cleaned');
    assert.equal(r.residual, false);
    assert.deepEqual(f.calls, ['read0', 'native', 'read1', 'append', 'cleanup']);
    assert.deepEqual(f.events, [
      {
        event: 'callback_replay_sql_parity_verified',
        caseId,
        countsUnchanged: true,
        hashesUnchanged: true,
        at: '2026-10-23T12:00:00.000Z',
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(r) + JSON.stringify(f.events),
      /SYNTHETIC_PRIVATE|Sha256|aaaa|bbbb|cccc|dddd/,
    );
  }
});
test('undefined/malformed/failed pre-callback SQL prevents every native start', async () => {
  for (const options of [{ before: undefined }, { before: {} }, { readFault: 0 }]) {
    const f = callbackSqlFixture(options);
    await assert.rejects(f.run(), /FOUNDATION_LIVE_CHILD_BLOCKED/);
    assert.deepEqual(f.calls, ['read0']);
    assert.deepEqual(f.events, []);
  }
  for (const caseId of ['callback.not_owned', 'callback.concurrent_a', 'callback.concurrent_b', undefined]) {
    let queries = 0;
    await assert.rejects(
      liveSql.verifyFoundationLiveCallbackSqlCase({
        caseId,
        readSnapshot() {
          queries++;
          return replaySnapshot();
        },
        start() {
          throw Error('UNEXPECTED_START');
        },
        cleanup() {
          throw Error('UNEXPECTED_CLEANUP');
        },
        append() {
          throw Error('UNEXPECTED_APPEND');
        },
      }),
      /FOUNDATION_LIVE_CHILD_BLOCKED/,
    );
    assert.equal(queries, 0);
  }
});
test('changed/malformed/failed post-callback SQL still cleans and reports unresolved SQL without parity evidence', async () => {
  for (const options of [
    { after: { ...replaySnapshot(), items: 2 } },
    { after: {} },
    { readFault: 1 },
    { after: { ...replaySnapshot(), costsSha256: 'e'.repeat(64) }, cleanup: false },
  ]) {
    const f = callbackSqlFixture(options),
      r = await f.run();
    assert.equal(r.status, 'sql_acceptance_unresolved');
    assert.equal(r.residual, true);
    assert.deepEqual(f.calls, ['read0', 'native', 'read1', 'cleanup']);
    assert.deepEqual(f.events, []);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_PRIVATE/);
  }
});
test('successful SQL cannot conceal native or cleanup failure', async () => {
  for (const options of [{ cleanup: false }, { cleanupFault: true }]) {
    const f = callbackSqlFixture(options),
      r = await f.run();
    assert.equal(r.status, 'cleanup_unresolved');
    assert.equal(r.residual, true);
    assert.equal(f.events.length, 1);
  }
  const f = callbackSqlFixture({ nativeState: 'native_unresolved' }),
    r = await f.run();
  assert.equal(r.status, 'native_unresolved');
  assert.equal(r.residual, true);
  assert.deepEqual(f.calls, ['read0', 'native']);
  assert.deepEqual(f.events, []);
});

test('reader failure projection refuses raw errors and stale or untrusted diagnostic fields', () => {
  const diagnostic = {
    version: 1,
    workflowKey: 'WF-70',
    operation: 'discovery',
    stage: 'http_status',
    classification: 'http',
    code: 'DISCOVERY',
    httpStatus: 429,
  };
  assert.deepEqual(liveSql.projectFoundationNativeFailureDiagnostic({ lastFailure: () => diagnostic }), {
    code: 'FOUNDATION_NATIVE_DISCOVERY',
    nativeReaderWorkflowKey: 'WF-70',
    nativeReaderStage: 'http_status',
    nativeReaderHttpStatus: 429,
  });
  for (const value of [
    null,
    { ...diagnostic, raw: 'PRIVATE_CANARY' },
    { ...diagnostic, workflowKey: 'PRIVATE_CANARY' },
    { ...diagnostic, code: 'PRIVATE_CANARY' },
    { ...diagnostic, stage: 'PRIVATE_CANARY' },
    { ...diagnostic, httpStatus: '429' },
    { ...diagnostic, httpStatus: 600 },
  ])
    assert.deepEqual(liveSql.projectFoundationNativeFailureDiagnostic({ lastFailure: () => value }), {});
  assert.deepEqual(
    liveSql.projectFoundationNativeFailureDiagnostic({
      lastFailure() {
        throw Error('PRIVATE_CANARY');
      },
    }),
    {},
  );
});

test('failed execution discovery returns the actual safe Reader diagnostic before Admin or Preview starts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-reader-diagnostic-'));
  let adminStarts = 0,
    setupStarts = 0;
  const s = createFoundationLiveAcceptanceSession(privatePacket(), () => {}, {
    storage: { directory },
    createBaselinePreflight: (input) => syntheticBaselinePreflight(input),
    startAdmin() {
      adminStarts++;
      throw Error('PRIVATE_CANARY');
    },
    createSetupTransport() {
      setupStarts++;
      throw Error('PRIVATE_CANARY');
    },
    createNativeTransport: () => ({
      request: async () => ({
        status: 429,
        body: (async function* () {
          yield Buffer.from('{"data":[],"nextCursor":null}');
        })(),
        closed: Promise.resolve(),
      }),
      close() {},
      state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
    }),
  });
  try {
    const r = await s.command({ kind: 'm03_acceptance_command', id: 'reader_failure', command: 'prepare' });
    assert.equal(r.status, 'blocked');
    assert.equal(r.nativeExecutions, 0);
    assert.equal(r.code, 'FOUNDATION_NATIVE_DISCOVERY');
    assert.equal(r.nativeReaderWorkflowKey, 'WF-10');
    assert.equal(r.nativeReaderStage, 'http_status');
    assert.equal(r.nativeReaderHttpStatus, 429);
    assert.equal(adminStarts, 0);
    assert.equal(setupStarts, 0);
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE_CANARY/);
    assert.equal((await s.close()).childTransportsClosed, true);
  } finally {
    await s.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('baseline diagnostic projection exposes only fixed codes and component booleans', () => {
  const diagnostic = {
    version: 1,
    workflowKey: 'WF-00',
    failedChecks: ['version_mismatch'],
    components: { nameEqual: true, nodesEqual: true, connectionsEqual: true, settingsEqual: true },
  };
  assert.deepEqual(projectFoundationBaselineDiagnostic({ diagnostics: () => diagnostic }), {
    baselineWorkflowKey: 'WF-00',
    baselineFailureCodes: ['version_mismatch'],
    baselineNameEqual: true,
    baselineNodesEqual: true,
    baselineConnectionsEqual: true,
    baselineSettingsEqual: true,
  });
  for (const value of [
    null,
    { ...diagnostic, raw: 'PRIVATE_DIAGNOSTIC_CANARY' },
    { ...diagnostic, workflowKey: 'PRIVATE_DIAGNOSTIC_CANARY' },
    { ...diagnostic, failedChecks: ['PRIVATE_DIAGNOSTIC_CANARY'] },
    { ...diagnostic, components: { ...diagnostic.components, nameEqual: 'PRIVATE_DIAGNOSTIC_CANARY' } },
  ])
    assert.deepEqual(projectFoundationBaselineDiagnostic({ diagnostics: () => value }), {});
  assert.deepEqual(
    projectFoundationBaselineDiagnostic({
      diagnostics() {
        throw Error('PRIVATE_DIAGNOSTIC_CANARY');
      },
    }),
    {},
  );
});

test('genuine technical17 constructor refusal releases its opened Management lock without changing counters or the original error', async () => {
  const f = await syntheticProjectVerifiedContinuation({
    technical16Settled: true,
    technical16MixedControl: true,
  });
  let session;
  try {
    const proof = f.claim(f.admit());
    const copied = await f.copy('foundation-live-runtime-cli.mjs');
    const lockPath = join(dirname(f.paths.management), 'runtime.operation.lock');
    const before = Object.fromEntries(
      ['management', 'control', 'setup'].map((key) => [key, readFileSync(f.paths[key], 'utf8')]),
    );
    const refusal = Error('SYNTHETIC_PRIVATE_CONSTRUCTION_REFUSAL');
    let observedOpenedLock = false,
      emitted = 0,
      childStarts = 0,
      caught;
    assert.equal(existsSync(lockPath), false);
    try {
      session = f.scoped(() =>
        copied.createFoundationLiveAcceptanceSession(
          { ...privatePacket(), sourceCommitSha: proof.sourceCommitSha, leaseExpiry: f.now() + 7200000 },
          () => {
            emitted++;
          },
          {
            projectVerifiedContinuationProof: proof,
            now() {
              if (existsSync(lockPath)) {
                observedOpenedLock = true;
                throw refusal;
              }
              return f.now();
            },
            startAdmin() {
              childStarts++;
              throw Error('UNEXPECTED_CHILD');
            },
          },
        ),
      );
    } catch (error) {
      caught = error;
    }
    assert.equal(observedOpenedLock, true);
    assert.equal(existsSync(lockPath), false);
    assert.equal(caught, refusal);
    assert.equal(session, undefined);
    assert.equal(emitted, 0);
    assert.equal(childStarts, 0);
    for (const key of Object.keys(before)) assert.equal(readFileSync(f.paths[key], 'utf8'), before[key]);
  } finally {
    if (session) await session.close();
    f.cleanup();
  }
});

test('constructor refusal retains the genuine budget lock while an attached transport remains pending', () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-constructor-pending-'));
  const lockPath = join(directory, 'runtime.operation.lock');
  const freeze = Object.freeze;
  const refusal = Error('SYNTHETIC_PRIVATE_LATE_CONSTRUCTION_REFUSAL');
  let budget,
    caught,
    pending = true,
    closes = 0;
  try {
    // Inject a synchronous final-allocation failure after the real constructor
    // has registered its budget and attached its ordinary lifecycle sentinel.
    Object.freeze = (value) => {
      if (typeof value?.attachTransport === 'function' && typeof value?.snapshot === 'function')
        budget = value;
      if (typeof value?.acceptMcp === 'function' && typeof value?.command === 'function') {
        budget.attachTransport({
          close() {
            closes++;
          },
          state: () => ({ pendingRequests: pending ? 1 : 0, unclosedResponses: 0 }),
        });
        throw refusal;
      }
      return freeze(value);
    };
    try {
      createFoundationLiveAcceptanceSession(privatePacket(), () => {}, { storage: { directory } });
    } catch (error) {
      caught = error;
    }
    Object.freeze = freeze;
    assert.equal(caught, refusal);
    assert.equal(closes, 1);
    assert.equal(budget.snapshot().closed, false);
    assert.equal(existsSync(lockPath), true);
    pending = false;
    assert.deepEqual(budget.close(), { closed: true, unresolvedTransport: false });
    assert.equal(existsSync(lockPath), false);
  } finally {
    Object.freeze = freeze;
    pending = false;
    budget?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('actual CLI constructor refusal emits only its fixed blocked frame and releases the Management lock', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-constructor-refusal-'));
  const input = new PassThrough(),
    output = new PassThrough(),
    emitted = [];
  const lockPath = join(directory, 'runtime.operation.lock');
  const at = Date.now();
  let observedOpenedLock = false;
  output.on('data', (chunk) => emitted.push(chunk.toString()));
  try {
    const running = runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['Session'],
      dependencies: {
        storage: { directory },
        now() {
          if (existsSync(lockPath)) {
            observedOpenedLock = true;
            throw Error('SYNTHETIC_PRIVATE_CONSTRUCTION_REFUSAL');
          }
          return at;
        },
      },
    });
    input.end(JSON.stringify({ ...privatePacket(), leaseExpiry: at + 7200000 }) + '\n');
    assert.equal(await running, 1);
    assert.equal(observedOpenedLock, true);
    assert.equal(existsSync(lockPath), false);
    const text = emitted.join('');
    assert.deepEqual(
      text
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line)),
      [{ kind: 'm03_acceptance_closed', status: 'blocked', residual: true }],
    );
    assert.doesNotMatch(text, /SYNTHETIC_PRIVATE|childTransportsClosed/);
    assert.equal(readFileSync(join(directory, 'management.jsonl'), 'utf8').trim().split('\n').length, 1);
  } finally {
    input.destroy();
    output.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('effectful continuation reaches the actual session constructor with retained counters and diagnostic, without starting a child', async () => {
  const f = await syntheticProjectVerifiedContinuation({ effectful: true });
  let session;
  try {
    const proof = f.claim(f.admit());
    const bindings = JSON.parse(
      readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
    );
    for (const name of ['bindings.dev.json', 'transport.dev.json'])
      f.put(
        'n8n/foundation/' + name,
        readFileSync(new URL('../../n8n/foundation/' + name, import.meta.url), 'utf8'),
      );
    for (const key of Object.keys(bindings.workflowRefs))
      f.put(
        'n8n/workflows/' + key + '.json',
        readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url), 'utf8'),
      );
    const copied = await f.copy('foundation-live-runtime-cli.mjs');
    session = f.scoped(() =>
      copied.createFoundationLiveAcceptanceSession(
        {
          ...privatePacket(),
          sourceCommitSha: proof.sourceCommitSha,
          leaseExpiry: f.now() + 7200000,
        },
        () => {},
        {
          now: f.now,
          projectVerifiedContinuationProof: proof,
          startAdmin() {
            throw Error('UNEXPECTED_CHILD');
          },
        },
      ),
    );
    const result = await session.command({
      kind: 'm03_acceptance_command',
      id: 'retained',
      command: 'state',
    });
    assert.equal(result.managementAttempts, 13);
    assert.equal(result.controlAttempts, 251);
    assert.equal(result.nativeExecutions, 0);
    assert.equal(result.status, 'not_prepared');
  } finally {
    if (session) await session.close();
    f.cleanup();
  }
});

test('reconciled unadmitted native start is counted by the actual CLI state before any new child or acceptance case', async () => {
  const f = await syntheticProjectVerifiedContinuation({ unadmittedWf00Reconciled: true });
  let session,
    childStarts = 0;
  try {
    const proof = f.claim(f.admit()),
      bindings = JSON.parse(readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)));
    for (const name of ['bindings.dev.json', 'transport.dev.json'])
      f.put(
        'n8n/foundation/' + name,
        readFileSync(new URL('../../n8n/foundation/' + name, import.meta.url), 'utf8'),
      );
    for (const key of Object.keys(bindings.workflowRefs))
      f.put(
        'n8n/workflows/' + key + '.json',
        readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url), 'utf8'),
      );
    const copied = await f.copy('foundation-live-runtime-cli.mjs');
    session = f.scoped(() =>
      copied.createFoundationLiveAcceptanceSession(
        {
          ...privatePacket(),
          sourceCommitSha: proof.sourceCommitSha,
          leaseExpiry: f.now() + 7200000,
        },
        () => {},
        {
          now: f.now,
          projectVerifiedContinuationProof: proof,
          startAdmin() {
            childStarts++;
            throw Error('UNEXPECTED_CHILD');
          },
        },
      ),
    );
    const result = await session.command({ kind: 'm03_acceptance_command', id: 'carry', command: 'state' });
    assert.deepEqual(
      [result.managementAttempts, result.controlAttempts, result.nativeExecutions],
      [527, 846, 1],
    );
    assert.equal(
      result.gatewayPreflightAttempts,
      6,
      'two rejected HTTP sends do not fabricate SQL admissions or gateway probes',
    );
    assert.equal(result.status, 'not_prepared');
    assert.equal(childStarts, 0);
    assert.equal(result.businessAcceptanceProven, false);
  } finally {
    if (session) await session.close();
    f.cleanup();
  }
});

for (const profile of [
  {
    maximum: 576,
    management: 152,
    control: 384,
    controlRows: 382,
    mainControl: 381,
    options: { managementAllocation: true },
  },
  {
    maximum: 640,
    management: 237,
    control: 486,
    controlRows: 486,
    mainControl: 483,
    options: { closedFixture: true },
  },
  {
    maximum: 640,
    management: 263,
    control: 537,
    controlRows: 538,
    mainControl: 534,
    options: { preprivateAdmin: true },
  },
  {
    maximum: 704,
    management: 288,
    control: 588,
    controlRows: 590,
    mainControl: 585,
    options: { catalogReadonly: true, catalogManagementAllocation: true },
  },
  {
    maximum: 832,
    management: 401,
    control: 740,
    controlRows: 744,
    mainControl: 737,
    options: { runtimePreparationClosed: true, runtimeMetadataAllocation: true },
  },
  {
    maximum: 1024,
    management: 524,
    control: 841,
    controlRows: 846,
    mainControl: 838,
    options: { runtimeRestorationClosed: true, runtimeRestorationAllocation: true },
  },
])
  test(`approved${profile.maximum} session composes genuine mixed-row budgets before any child or network`, async () => {
    const f = await syntheticProjectVerifiedContinuation(profile.options);
    let session;
    try {
      const proof = f.claim(f.admit());
      const checkpoint = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
      assert.equal(checkpoint.managementMaximum, profile.maximum);
      assert.equal(readFileSync(f.paths.control, 'utf8').trim().split('\n').length, profile.controlRows);
      assert.equal(checkpoint.mainControlAttempts, profile.mainControl);
      assert.equal(checkpoint.aggregateControlAttempts, profile.control);
      const bindings = JSON.parse(
        readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
      );
      for (const name of ['bindings.dev.json', 'transport.dev.json'])
        f.put(
          'n8n/foundation/' + name,
          readFileSync(new URL('../../n8n/foundation/' + name, import.meta.url), 'utf8'),
        );
      for (const key of Object.keys(bindings.workflowRefs))
        f.put(
          'n8n/workflows/' + key + '.json',
          readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url), 'utf8'),
        );
      let children = 0,
        emitted = 0;
      const copied = await f.copy('foundation-live-runtime-cli.mjs');
      session = f.scoped(() =>
        copied.createFoundationLiveAcceptanceSession(
          { ...privatePacket(), sourceCommitSha: proof.sourceCommitSha, leaseExpiry: f.now() + 7200000 },
          () => {
            emitted++;
          },
          {
            now: f.now,
            projectVerifiedContinuationProof: proof,
            startAdmin() {
              children++;
              throw Error('UNEXPECTED_CHILD');
            },
          },
        ),
      );
      const result = await session.command({
        kind: 'm03_acceptance_command',
        id: 'mixed' + profile.maximum,
        command: 'state',
      });
      assert.equal(result.managementAttempts, profile.management);
      assert.equal(result.controlAttempts, profile.control);
      assert.equal(result.nativeExecutions, 0);
      assert.equal(result.status, 'not_prepared');
      assert.equal(children, 0);
      assert.equal(emitted, 0);
      assert.equal(
        f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof).aggregateManagementAttempts,
        profile.management,
      );
    } finally {
      if (session) await session.close();
      f.cleanup();
    }
  });

for (const profile of [
  {
    maximum: 704,
    ordinal: 12,
    management: 313,
    control: 639,
    source: 'aff94f2b2d8055cf93b5405e6b11d4e7d9c86803',
    window: 'eda4fae1-1e19-47db-81b8-beac1a4ed883',
    options: { adminAdmissionReadonly: true },
  },
  {
    maximum: 832,
    ordinal: 13,
    management: 401,
    control: 740,
    source: '7b1837201ac7925591577a1517d7288936ca3464',
    window: '3c46c791-e140-4eb9-890a-eecfa251f65e',
    options: { runtimePreparationClosed: true, runtimeMetadataAllocation: true },
  },
  {
    maximum: 1024,
    ordinal: 14,
    management: 524,
    control: 841,
    source: '5087d4d93d2f6ffdca0bc0096b365723005446fc',
    window: '4c602549-2c42-4ec3-9328-714d7cb66a77',
    options: { runtimeRestorationClosed: true, runtimeRestorationAllocation: true },
  },
  {
    maximum: 1408,
    ordinal: 18,
    management: 963,
    control: 1094,
    source: 'effa3de9e1fee6c3f3c08fc347a5e3175db14c80',
    window: 'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
    options: { technical16Settled: true, technical17PreReady: true },
    realWriter: true,
  },
  {
    maximum: 1728,
    ordinal: 20,
    management: 1317,
    control: 1246,
    window: 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a',
    options: {
      technical16Settled: true,
      technical17PreReady: true,
      technical18Closed: true,
      technical19Restored: true,
      technical20SourceSelected: true,
    },
    realWriter: true,
  },
  {
    maximum: 1728,
    ordinal: 20,
    management: 1317,
    control: 1246,
    window: 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a',
    options: { technical19Restored: true, technical20SourceSelected: true },
    failAdmin: true,
  },
])
  test(
    profile.failAdmin
      ? 'genuine20 CLI reports a finite Admin constructor refusal without spawning, provisioning or claiming closure'
      : profile.maximum === 1728
        ? 'genuine20 CLI prepare preserves1317 charges through the real Admin and seventh Writer constructors without provisioning'
        : profile.realWriter
          ? 'genuine18 CLI prepare crosses the real Writer constructor after synthetic Preview without connecting or provisioning'
          : `post-reconciliation genuine${profile.maximum} CLI prepare crosses the actual Admin client and native protocol before every Preview operation`,
    async () => {
      const f = await syntheticProjectVerifiedContinuation(profile.options);
      let session,
        spawns = 0,
        setupConstructors = 0,
        nativeReads = 0,
        writerConstructors = 0,
        writerClients = 0;
      const commands = [],
        emitted = [];
      try {
        const proof = f.claim(f.admit());
        const expectedSource =
          profile.source ?? f.module.foundationProjectVerifiedTechnical20Runtime.sourceCommitSha;
        const checkpoint = f.module.foundationProjectVerifiedContinuationResumeCheckpoint(proof);
        assert.equal(checkpoint.technicalAttemptOrdinal, profile.ordinal);
        assert.equal(checkpoint.managementMaximum, profile.maximum);
        assert.equal(checkpoint.aggregateManagementAttempts, profile.management);
        assert.equal(checkpoint.aggregateControlAttempts, profile.control);
        assert.equal(proof.sourceCommitSha, expectedSource);
        assert.equal(proof.windowId, profile.window);
        const bindings = JSON.parse(
          readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
        );
        for (const name of ['bindings.dev.json', 'transport.dev.json'])
          f.put(
            'n8n/foundation/' + name,
            readFileSync(new URL('../../n8n/foundation/' + name, import.meta.url), 'utf8'),
          );
        for (const key of Object.keys(bindings.workflowRefs))
          f.put(
            'n8n/workflows/' + key + '.json',
            readFileSync(new URL('../../n8n/workflows/' + key + '.json', import.meta.url), 'utf8'),
          );
        const copied = await f.copy('foundation-live-runtime-cli.mjs');
        const adminModule = await f.copy('foundation-admin-client.mjs');
        const restoredPlan = profile.maximum >= 1024 ? await f.copy('foundation-runtime-plan.mjs') : null;
        const restoredTransport =
          profile.maximum >= 1024 ? await f.copy('foundation-live-runtime-transport.mjs') : null;
        const spawn = (executable, args, options) => {
          spawns++;
          assert.match(executable, /WindowsPowerShell/);
          assert.ok(args.includes('-ProjectVerifiedContinuation'));
          assert.ok(args.includes('-ForwardWindow'));
          assert.equal(Object.hasOwn(options.env, 'PGPASSWORD'), false);
          assert.equal(Object.hasOwn(options.env, 'SUPABASE_ACCESS_TOKEN'), false);
          assert.equal(options.windowsHide, true);
          const child = new EventEmitter();
          child.stdin = new PassThrough();
          child.stdout = new PassThrough();
          child.stderr = new PassThrough();
          let buffer = '';
          child.stdin.on('data', (chunk) => {
            buffer += chunk.toString();
            while (buffer.includes('\n')) {
              const at = buffer.indexOf('\n'),
                command = JSON.parse(buffer.slice(0, at));
              buffer = buffer.slice(at + 1);
              commands.push(command.kind);
              assert.ok(['postcheck', 'preflight', 'end'].includes(command.kind));
              const result =
                command.kind === 'postcheck'
                  ? { ready: true, projectRef: 'zmotjsbzhzjvpelxvxlf', migrationCount: 15 }
                  : command.kind === 'preflight'
                    ? {
                        projectRef: 'zmotjsbzhzjvpelxvxlf',
                        dailyBudgetUsd: 25,
                        statsDailyEnabled: false,
                        errorCount24h: 0,
                        notificationCooldownClear: true,
                        priceBook: { 'apify/website-content-crawler': { unit: 'compute unit', usd: 0.3 } },
                      }
                    : {};
              child.stdout.write(
                JSON.stringify({
                  type: 'foundation_admin_result',
                  id: command.id,
                  kind: command.kind,
                  ok: true,
                  result,
                }) + '\n',
              );
              if (command.kind === 'end') {
                child.stdout.write(
                  JSON.stringify({
                    version: 1,
                    runId: 'synthetic-post11',
                    phaseAControl: true,
                    childrenClosed: true,
                    handoffDeleted: true,
                    leaseDeleted: true,
                    scratchDeleted: true,
                  }) + '\n',
                );
                queueMicrotask(() => child.emit('close', 0, null));
              }
            }
          });
          queueMicrotask(() =>
            child.stdout.write(
              JSON.stringify({
                type: 'foundation_admin_ready',
                runId: 'synthetic-post11',
                historyAfter: 'complete',
                projectRef: 'zmotjsbzhzjvpelxvxlf',
                hardDeadline: new Date(proof.hardDeadlineAt).toISOString(),
                actionDeadline: new Date(proof.deadlineAt).toISOString(),
                stopNewAt: new Date(proof.stopNewAt).toISOString(),
                postchecksVerified: false,
                clockSegmentId: proof.segmentId,
                postcheckContinuation: true,
                projectVerifiedContinuation: true,
              }) + '\n',
            ),
          );
          return child;
        };
        session = f.scoped(() =>
          copied.createFoundationLiveAcceptanceSession(
            { ...privatePacket(), sourceCommitSha: proof.sourceCommitSha, leaseExpiry: f.now() + 7200000 },
            (message) => {
              emitted.push(message);
              assert.equal(message.kind, 'mcp_port_request');
              assert.equal(message.action, 'browser_discover');
              queueMicrotask(() =>
                assert.equal(
                  session.acceptMcp({
                    ...message,
                    kind: 'mcp_port_result',
                    result: {
                      source: 'browser_ui',
                      id: message.workflowId,
                      renderedName: bindings.workflowRefs['WF-00'].name,
                      workflowUrl: 'https://muhhammedsayed.app.n8n.cloud/workflow/' + message.workflowId,
                      executeControlEnabled: true,
                    },
                  }),
                  true,
                ),
              );
            },
            {
              now: f.now,
              projectVerifiedContinuationProof: proof,
              startAdmin: (args) => {
                if (profile.failAdmin) throw Error('SYNTHETIC_LOCAL_ADMIN_CONSTRUCTOR_REFUSAL');
                return adminModule.startFoundationAdminClient(args, { spawn });
              },
              createBaselinePreflight: (args) => {
                if (profile.maximum >= 1024) assert.equal(args.projectVerifiedContinuationProof, proof);
                return syntheticBaselinePreflight(
                  args,
                  profile.maximum >= 1024
                    ? {
                        createBaseline: restoredPlan.createFoundationRuntimeBaseline,
                        createPreflight: restoredTransport.createFoundationLiveBaselinePreflight,
                      }
                    : {},
                );
              },
              createNativeTransport: () => ({
                async request(spec) {
                  assert.equal(spec.method, 'GET');
                  nativeReads++;
                  return {
                    status: 200,
                    body: (async function* () {
                      yield Buffer.from(JSON.stringify({ data: [], nextCursor: null }));
                    })(),
                    closed: Promise.resolve(),
                  };
                },
                state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
                close() {},
              }),
              createSetupTransport() {
                setupConstructors++;
                if (profile.realWriter)
                  return { close() {}, state: () => ({ pendingRequests: 0, unclosedResponses: 0 }) };
                throw Error('SYNTHETIC_STOP_BEFORE_PREVIEW_NETWORK');
              },
              ...(profile.realWriter
                ? {
                    createSetup: () => ({
                      async prepare() {
                        return {
                          audience: 'https://everyone-market-researcher-synthetic-sixth.vercel.app',
                          deploymentId: 'dpl_SyntheticSixth',
                        };
                      },
                      async cleanup() {
                        return { state: 'setup_resources_removed' };
                      },
                      close() {},
                    }),
                    assertDeployment: (value) => value,
                    createWriterCloser(args) {
                      assert.equal(args.windowId, profile.window);
                      assert.equal(args.sourceCommitSha, expectedSource);
                      const closer = restoredTransport.createFoundationLiveWriterCloser(args, {
                        createClient() {
                          writerClients++;
                          throw Error('NO_CONSTRUCTOR_CONNECTION');
                        },
                      });
                      writerConstructors++;
                      assert.deepEqual(closer.state(), { pendingRequests: 0, unclosedResponses: 0 });
                      closer.close();
                      throw Error('SYNTHETIC_STOP_AFTER_REAL_WRITER_CONSTRUCTOR');
                    },
                  }
                : {}),
            },
          ),
        );
        const result = await session.command({
          kind: 'm03_acceptance_command',
          id: 'post11-native-chain',
          command: 'prepare',
        });
        if (profile.failAdmin) {
          assert.equal(result.status, 'blocked');
          assert.equal(result.code, 'FOUNDATION_ADMIN_CLIENT_BLOCKED');
          assert.equal(spawns, 0);
          assert.equal(setupConstructors, 0);
          assert.equal(writerConstructors, 0);
          assert.deepEqual(commands, []);
          assert.equal(nativeReads, 50);
          assert.equal(emitted.length, 1);
          assert.equal(result.managementAttempts, profile.management + 25);
          assert.equal(result.controlAttempts, profile.control + 51);
          assert.equal(result.nativeExecutions, 3);
          const closed = await session.close();
          assert.equal(closed.adminChildClosed, false);
          assert.equal(closed.residual, true);
          assert.doesNotMatch(
            JSON.stringify(result) + JSON.stringify(closed),
            /SYNTHETIC_LOCAL|CONSTRUCTOR_REFUSAL/,
          );
          return;
        }
        assert.equal(spawns, 1, JSON.stringify(result));
        assert.deepEqual(commands, ['postcheck', 'preflight']);
        assert.equal(setupConstructors, 1, JSON.stringify(result));
        assert.equal(nativeReads, 50);
        assert.equal(emitted.length, 1);
        assert.equal(result.status, 'blocked');
        if (profile.realWriter) {
          assert.equal(result.code, 'FOUNDATION_WRITER_CLOSER_BLOCKED');
          assert.equal(writerConstructors, 1);
          assert.equal(writerClients, 0);
        } else assert.equal(result.code, 'FOUNDATION_SETUP_TRANSPORT_BLOCKED');
        assert.equal(result.managementAttempts, profile.management + 25);
        assert.equal(result.controlAttempts, profile.control + 51);
        assert.equal(result.nativeExecutions, profile.realWriter ? 3 : 0);
        const closed = await session.close();
        assert.deepEqual(commands, ['postcheck', 'preflight', 'end']);
        assert.equal(closed.adminChildClosed, true);
        assert.equal(closed.childTransportsClosed, true);
        assert.equal(closed.residual, profile.realWriter === true);
        if (profile.realWriter) {
          assert.equal(writerClients, 0);
          assert.equal(closed.environmentCleanupVerified, true);
          for (const key of ['baselineRestored', 'windowClosed', 'fixtureArchived', 'remoteWorkSettled'])
            assert.equal(closed[key], false, 'the constructor-only stop cannot claim later acceptance');
        }
        assert.equal(spawns, 1);
        assert.equal(setupConstructors, 1);
        assert.doesNotMatch(
          JSON.stringify(result) + JSON.stringify(closed) + JSON.stringify(emitted),
          /SYNTHETIC_PRIVATE|SYNTHETIC_STOP/,
        );
      } finally {
        if (session) await session.close();
        f.cleanup();
      }
    },
  );

test('a lookalike mixed-row continuation is rejected before session storage, child creation or emitted metadata', () => {
  const time = Date.parse('2026-10-24T01:00:00Z');
  let effects = 0;
  const forged = Object.freeze({
    kind: 'foundation_project_verified_continuation',
    sourceCommitSha: 'a'.repeat(40),
    windowId: '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
    startsAt: time,
    stopNewAt: time + 3000000,
    deadlineAt: time + 3600000,
    carriedControlAttempts: 1,
  });
  assert.throws(
    () =>
      createFoundationLiveAcceptanceSession(
        { ...privatePacket(), leaseExpiry: time + 7200000 },
        () => {
          effects++;
        },
        {
          now: () => time,
          projectVerifiedContinuationProof: forged,
          storage: {
            read() {
              effects++;
              throw Error('SYNTHETIC_STORAGE_FORBIDDEN');
            },
          },
          startAdmin() {
            effects++;
            throw Error('SYNTHETIC_CHILD_FORBIDDEN');
          },
        },
      ),
    /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/,
  );
  assert.equal(effects, 0);
});

test('current technical6 cannot reach the mixed-row session constructor until the unchanged management cap is sufficient', async () => {
  const f = await syntheticProjectVerifiedContinuation({ baselineDiscovery: true });
  try {
    assert.equal(f.check().status, 'management_cap_insufficient');
    assert.throws(() => f.admit(), /M03_PROJECT_VERIFIED_CONTINUATION_BLOCKED/);
    assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-7.json')), false);
    assert.equal(existsSync(f.paths.admission.replace(/\.json$/, '.technical-7.runtime-claim.json')), false);
  } finally {
    f.cleanup();
  }
});

test('public CLI CheckOnly reads no handoff, launches nothing and does not claim a verified MCP port', async () => {
  const output = new PassThrough();
  let text = '';
  output.on('data', (b) => {
    text += b;
  });
  const code = await runFoundationLiveRuntimeCli({ output, args: ['CheckOnly'] });
  const r = JSON.parse(text);
  assert.equal(code, 0);
  assert.equal(r.privateRead, false);
  assert.equal(r.networkCalls, 0);
  assert.equal(r.actualMcpPortVerified, false);
  assert.equal(r.controlMaximum, 2048);
  assert.equal(r.managementMaximum, 512);
});

test('persistent private input followed by fixed state/close uses no credentials outside child and no hosted calls', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-cli-protocol-test-'));
  const input = new PassThrough(),
    output = new PassThrough(),
    packet = privatePacket();
  let text = '',
    buffer = '',
    started = 0;
  output.on('data', (b) => {
    text += b;
    buffer += b;
    while (buffer.includes('\n')) {
      const at = buffer.indexOf('\n'),
        r = JSON.parse(buffer.slice(0, at));
      buffer = buffer.slice(at + 1);
      if (r.kind === 'm03_acceptance_ready')
        input.write(
          JSON.stringify({ kind: 'm03_acceptance_command', id: 'status1', command: 'state' }) + '\n',
        );
      if (r.kind === 'm03_acceptance_result')
        input.write(
          JSON.stringify({ kind: 'm03_acceptance_command', id: 'close1', command: 'close' }) + '\n',
        );
    }
  });
  try {
    const running = runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['Session'],
      dependencies: {
        storage: { directory },
        startAdmin() {
          started++;
          throw Error('UNEXPECTED');
        },
      },
    });
    input.write(JSON.stringify(packet) + '\n');
    assert.equal(await running, 0);
    assert.equal(started, 0);
    for (const k of ['managementKey', 'writerPassword', 'apifyReadToken', 'machineToken', 'protectionBypass'])
      assert.equal(text.includes(packet[k]), false);
    const frames = text.trim().split('\n').map(JSON.parse);
    assert.equal(frames.at(-1).kind, 'm03_acceptance_closed');
    assert.equal(frames.at(-1).residual, false);
    assert.equal(existsSync(join(directory, 'runtime.operation.lock')), false);
  } finally {
    input.destroy();
    output.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('unapproved first DTO and arbitrary public command fail closed without echoing input', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-cli-reject-test-'));
  try {
    const input = new PassThrough(),
      output = new PassThrough();
    let text = '';
    output.on('data', (b) => {
      text += b;
    });
    const run = runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['Session'],
      dependencies: { storage: { directory } },
    });
    const packet = privatePacket();
    packet.approvedHead = 'f'.repeat(40);
    input.write(JSON.stringify(packet) + '\n');
    assert.equal(await run, 1);
    assert.equal(text.includes(packet.writerPassword), false);
    assert.equal(existsSync(join(directory, 'runtime.operation.lock')), false);
    input.destroy();
    output.destroy();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fixed minute50 admission stop closes the same persistent child without a new action window', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-cli-stop-test-'));
  const input = new PassThrough(),
    output = new PassThrough();
  let text = '',
    delay;
  output.on('data', (b) => {
    text += b;
  });
  try {
    const running = runFoundationLiveRuntimeCli({
      input,
      output,
      args: ['Session'],
      dependencies: {
        storage: { directory },
        setStopTimer(fn, ms) {
          delay = ms;
          setImmediate(fn);
          return undefined;
        },
      },
    });
    input.write(JSON.stringify(privatePacket()) + '\n');
    assert.equal(await running, 0);
    assert.ok(delay > 2999000 && delay <= 3000000);
    const rows = text.trim().split('\n').map(JSON.parse);
    assert.equal(rows.at(-1).kind, 'm03_acceptance_closed');
    assert.equal(rows.at(-1).childTransportsClosed, true);
    assert.equal(rows.at(-1).nativeExecutions, 0);
    assert.equal(rows.at(-1).residual, false);
    assert.equal(existsSync(join(directory, 'runtime.operation.lock')), false);
  } finally {
    input.destroy();
    output.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('baseline drift is diagnosed before native discovery, Admin start and every Preview/SQL mutation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-preflight-first-'));
  let adminStarts = 0,
    setupStarts = 0;
  const s = createFoundationLiveAcceptanceSession(privatePacket(), () => {}, {
    storage: { directory },
    startAdmin() {
      adminStarts++;
      throw Error('UNEXPECTED_ADMIN');
    },
    createSetupTransport() {
      setupStarts++;
      throw Error('UNEXPECTED_SETUP');
    },
    createBaselinePreflight({ admitManagementAttempt }) {
      return {
        async read() {
          admitManagementAttempt();
          throw Error('SYNTHETIC_PRIVATE_PREFLIGHT');
        },
        diagnostics: () => ({
          version: 1,
          workflowKey: 'WF-00',
          failedChecks: ['version_mismatch'],
          components: { nameEqual: true, nodesEqual: false, connectionsEqual: true, settingsEqual: false },
        }),
        state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
        close() {},
      };
    },
  });
  try {
    const r = await s.command({ kind: 'm03_acceptance_command', id: 'preflight1', command: 'prepare' });
    assert.equal(r.status, 'blocked');
    assert.equal(r.managementAttempts, 1);
    assert.equal(r.controlAttempts, 0);
    assert.equal(r.nativeExecutions, 0);
    assert.equal(r.baselineWorkflowKey, 'WF-00');
    assert.deepEqual(r.baselineFailureCodes, ['version_mismatch']);
    assert.equal(adminStarts, 0);
    assert.equal(setupStarts, 0);
    assert.equal((await s.close()).childTransportsClosed, true);
  } finally {
    await s.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const mode of [
  'normal',
  'sql_close_failure',
  'writer_close_unknown_ack',
  'writer_close_unknown_native_end',
  'graph_restore_failure',
  'identity_replayed',
  'identity_wrong_request',
  'identity_unstarted',
  'admin_abort_missing_descendants',
  'setup_expired',
  'setup_http',
  'setup_contract',
  'setup_unknown_diagnostics',
  'setup_throwing_diagnostics',
  'setup_missing_diagnostics',
  'setup_malformed_diagnostics',
  'setup_foreign_bypass',
  'preflight_contract',
  'transport_constructor',
  'definition_constructor',
  'runtime_setup',
])
  test('same-child exact route / independent shutdown: ' + mode, async () => {
    let restoreFault = false;
    const f = fixture({
        fault({ method, path }) {
          if (restoreFault && method === 'POST' && path.endsWith('/unpublish'))
            throw Error('SYNTHETIC_UNKNOWN_RESTORE');
          if (mode === 'runtime_setup' && method === 'GET' && path === '/api/v1/credentials/EmrM03Machine19')
            throw Error('SYNTHETIC_PRIVATE_RUNTIME_FAILURE');
        },
      }),
      packet = privatePacket();
    const rows = [],
      envs = [],
      wire = [],
      bypass = {};
    let adminClosed = false,
      adminEnded = false,
      adminAborted = false,
      aborts = 0,
      writerCloseCalls = 0;
    const finalAdminReceipt = () => ({
      childrenClosed: true,
      handoffDeleted: true,
      leaseDeleted: true,
      scratchDeleted: true,
    });
    const projectId = 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
      teamId = 'team_gboXPxTevpCOZuaA8eY9PmR1';
    const audience = 'https://everyone-market-researcher-synthetic-session.vercel.app';
    const admin = {
      postcheck: async () => ({ ready: true, projectRef: 'zmotjsbzhzjvpelxvxlf', migrationCount: 14 }),
      fixture: async () => ({
        result: 'M03_SMOKE_FIXTURE_READY',
        company_code: 'C999',
        competitor_id: '11111111-1111-4111-a111-111111111111',
        account_id: '22222222-2222-4222-a222-222222222222',
        platform: 'website_work_page',
        url: 'https://everyone.film/about-everyone',
        competitor_status: 'active',
        account_status: 'active',
      }),
      preflight: async () => ({
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        dailyBudgetUsd: mode === 'preflight_contract' ? '25' : 25,
        statsDailyEnabled: false,
        errorCount24h: 0,
        notificationCooldownClear: true,
        priceBook: { 'apify/website-content-crawler': { unit: 'compute unit', usd: 0.3 } },
      }),
      provision: async () => ({
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        boundAudience: audience,
        boundCommitSha: packet.sourceCommitSha,
        boundDeploymentId: 'dpl_SyntheticSession',
        started: false,
        closed: false,
        totalAdmitted: 0,
        approvalCount: 1,
      }),
      close: async () => {
        assert.equal(writerCloseCalls, 1, 'restricted Writer precedes independent Admin readback');
        if (mode === 'sql_close_failure') throw Error('PRIVATE_UNKNOWN_CLOSE');
        adminClosed = true;
        return { state: 'closed', window: { id: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9', closed: true } };
      },
      archive: async () => ({ result: 'M03_SMOKE_FIXTURE_ARCHIVED' }),
      end: async () => {
        if (!adminClosed || mode === 'admin_abort_missing_descendants') throw Error('PRIVATE_END_REFUSED');
        adminEnded = true;
        return { nativeExit: 0, childClosed: true, receipt: finalAdminReceipt() };
      },
      abort: async () => {
        adminAborted = true;
        aborts++;
        return {
          nativeExit: 1,
          childClosed: true,
          receipt: mode === 'admin_abort_missing_descendants' && aborts === 1 ? null : finalAdminReceipt(),
        };
      },
      state: () => ({ requestPending: false }),
    };
    const nativeTransport = {
      request: async ({ path }) => {
        wire.push(path);
        return {
          status: 200,
          body: (async function* () {
            yield Buffer.from(JSON.stringify({ data: [], nextCursor: null }));
          })(),
          closed: Promise.resolve(),
        };
      },
      close() {},
      state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
    };
    const setupTransport = {
      async request(spec) {
        let data,
          status = 200;
        if (mode.startsWith('setup_')) {
          assert.equal(spec.method, 'GET');
          assert.equal(spec.path, '/v9/projects/' + projectId + '?teamId=' + teamId);
          if (!['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode))
            throw Error('SYNTHETIC_PRIVATE_TRANSPORT_FAILURE');
          if (mode === 'setup_http')
            return { status: 401, data: { error: packet.writerPassword }, closed: true };
        }
        if (spec.path.startsWith('/v9/projects/') && spec.method === 'GET')
          data = {
            id: projectId,
            accountId: teamId,
            rootDirectory: 'apps/web',
            nodeVersion: mode === 'setup_contract' ? '20.x' : '24.x',
            framework: 'nextjs',
            link: { type: 'github', org: 'muhhammeddsayedd-prog', repo: 'Everyone-Market-Researcher' },
            ssoProtection: { deploymentType: 'all_except_custom_domains' },
            protectionBypass:
              mode === 'setup_foreign_bypass'
                ? { SYNTHETIC_UNRELATED: { scope: 'automation-bypass', isEnvVar: true } }
                : structuredClone(bypass),
          };
        else if (spec.path.includes('/protection-bypass')) {
          const b = spec.body;
          if (b.generate)
            bypass[b.generate.secret] = {
              scope: 'automation-bypass',
              note: b.generate.note,
              isEnvVar: false,
              createdAt: Date.now(),
            };
          if (b.revoke) delete bypass[b.revoke.secret];
          data = { protectionBypass: structuredClone(bypass) };
        } else if (spec.path.includes('/env') && spec.method === 'GET')
          data = { envs: structuredClone(envs), pagination: { next: null } };
        else if (spec.path.includes('/env') && spec.method === 'POST') {
          const b = spec.body;
          const row = {
            id: 'env' + envs.length,
            key: b.key,
            type: b.type,
            target: b.target,
            gitBranch: b.gitBranch,
            comment: b.comment,
            createdAt: 1,
            updatedAt: 1,
          };
          envs.push(row);
          data = { created: row, failed: [] };
        } else if (spec.path.includes('/env/') && spec.method === 'DELETE') {
          envs.splice(
            envs.findIndex((e) => spec.path.includes('/' + e.id + '?')),
            1,
          );
          status = 204;
          data = null;
        } else if (spec.path.startsWith('/v13/deployments'))
          data = {
            id: 'dpl_SyntheticSession',
            projectId,
            target: null,
            url: new URL(audience).host,
            meta: { githubCommitSha: packet.sourceCommitSha, githubCommitRef: 'm03-n8n-foundation' },
            readyState: 'READY',
            createdAt: Date.now(),
          };
        else throw Error('SYNTHETIC_ROUTE_UNSUPPORTED');
        return { status, data, closed: true };
      },
      diagnostics() {
        if (mode === 'setup_throwing_diagnostics') throw Error(packet.writerPassword);
        if (mode === 'setup_missing_diagnostics') return undefined;
        return {
          stage: ['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode)
            ? 'completed'
            : 'native_exit',
          code:
            mode === 'setup_unknown_diagnostics'
              ? packet.writerPassword
              : mode === 'setup_expired'
                ? 'saved_auth_expired'
                : 'unknown',
          httpStatus:
            mode === 'setup_malformed_diagnostics'
              ? '200'
              : mode === 'setup_http'
                ? 401
                : ['setup_contract', 'setup_foreign_bypass'].includes(mode)
                  ? 200
                  : null,
          nativeExit: ['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode) ? 0 : 1,
          childStarted: true,
          childClosed: true,
          aborted: false,
          stdoutBytes: 1048576,
          stderrBytes: 65536,
          path: 'https://private.invalid/' + packet.writerPassword,
          error: packet.writerPassword,
        };
      },
      state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
      close() {},
    };
    const session = createFoundationLiveAcceptanceSession(
      packet,
      (r) => {
        rows.push(r);
      },
      {
        storage: { directory: f.directory },
        startAdmin: async () => admin,
        createNativeTransport: () => nativeTransport,
        createBaselinePreflight: (input) => syntheticBaselinePreflight(input, { workflows: f.workflows }),
        createWriterCloser: (args) => {
          assert.equal(args.password, packet.writerPassword);
          assert.equal(args.sourceCommitSha, packet.sourceCommitSha);
          assert.equal(args.audience, audience);
          assert.equal(args.deploymentId, 'dpl_SyntheticSession');
          return {
            async closeWindow() {
              writerCloseCalls++;
              if (mode === 'writer_close_unknown_ack') throw Error('SYNTHETIC_PRIVATE_WRITER_ACK');
              return { closeVerified: true, connectionClosed: true };
            },
            state: () => ({
              pendingRequests: 0,
              unclosedResponses: mode === 'writer_close_unknown_native_end' ? 1 : 0,
            }),
            close() {},
          };
        },
        createSetupTransport: () => {
          if (mode === 'transport_constructor') throw Error(packet.writerPassword);
          return setupTransport;
        },
        // Post-setup unit behavior is isolated behind explicit factory ports.
        // This stub is not a successful real-component/provider setup receipt.
        ...(mode.startsWith('setup_')
          ? {}
          : {
              createSetup: () => {
                if (mode === 'definition_constructor') throw Error(packet.apifyReadToken);
                return {
                  async prepare() {
                    envs.push(
                      ...Array.from({ length: 7 }, (_, i) => ({ id: 'synthetic_completed_env_' + i })),
                    );
                    return {
                      version: 1,
                      projectId,
                      branch: 'm03-n8n-foundation',
                      sourceCommitSha: packet.sourceCommitSha,
                      deploymentId: 'dpl_SyntheticSession',
                      audience,
                      environment: 'preview',
                      readyState: 'READY',
                      protection: 'all_except_custom_domains',
                      protectionVerified: true,
                      protectionTransportVerified: false,
                      sqlAudienceBindingVerified: false,
                    };
                  },
                  async cleanup() {
                    envs.length = 0;
                    return { state: 'setup_resources_removed' };
                  },
                  close() {},
                };
              },
              assertDeployment: (proof) => proof,
            }),
        setup: { transportValidator: (t) => t },
        runtime: f.dependencies,
        createGatewayProbe: ({ admitGatewayAttempt }) => ({
          async identity({ unauthorized = false } = {}) {
            const requestId = unauthorized
              ? '33333333-3333-4333-a333-333333333333'
              : '44444444-4444-4444-a444-444444444444';
            admitGatewayAttempt({ requestId, unauthorized });
            assert.equal(
              readFileSync(join(f.directory, 'preflight.jsonl'), 'utf8').includes(requestId),
              true,
            );
            if (unauthorized) return { status: 401, body: { error: 'unauthorized' } };
            const probeAt = Date.now();
            return {
              status: 200,
              body: {
                version: 1,
                requestId:
                  mode === 'identity_wrong_request' ? '55555555-5555-4555-a555-555555555555' : requestId,
                outcome: 'completed',
                operation: 'identity.read',
                replayed: mode === 'identity_replayed',
                result: {
                  currentUser: 'n8n_writer',
                  sessionUser: 'n8n_writer',
                  database: 'postgres',
                  projectRef: 'zmotjsbzhzjvpelxvxlf',
                  connectionCount: 1,
                },
                window: {
                  id: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
                  startsAt: mode === 'identity_unstarted' ? null : new Date(probeAt - 1000).toISOString(),
                  expiresAt: mode === 'identity_unstarted' ? null : new Date(probeAt + 3599000).toISOString(),
                  totalAdmitted: 1,
                  closed: false,
                  boundAudience: audience,
                  boundCommitSha: packet.sourceCommitSha,
                  boundDeploymentId: 'dpl_SyntheticSession',
                },
              },
            };
          },
          close() {},
          state: () => ({ pendingRequests: 0, unclosedResponses: 0 }),
        }),
      },
    );
    try {
      const prepared = await session.command({
        kind: 'm03_acceptance_command',
        id: 'prepare1',
        command: 'prepare',
      });
      if (
        ['preflight_contract', 'transport_constructor', 'definition_constructor', 'runtime_setup'].includes(
          mode,
        )
      ) {
        assert.equal(prepared.status, 'blocked');
        assert.equal(
          prepared.code,
          'FOUNDATION_' +
            {
              preflight_contract: 'PREFLIGHT_CONTRACT',
              transport_constructor: 'SETUP_TRANSPORT',
              definition_constructor: 'SETUP_CONSTRUCTOR',
              runtime_setup: 'RUNTIME_SETUP',
            }[mode] +
            '_BLOCKED',
        );
        assert.equal(prepared.residual, true);
        assert.equal(prepared.nativeExecutions, 0);
        assert.equal(rows.length, 0);
        const publicJson = JSON.stringify(prepared);
        assert.equal(publicJson.includes('SYNTHETIC_PRIVATE_RUNTIME_FAILURE'), false);
        for (const key of [
          'managementKey',
          'writerPassword',
          'apifyReadToken',
          'machineToken',
          'protectionBypass',
        ])
          assert.equal(publicJson.includes(packet[key]), false);
        assert.equal((await session.close()).childTransportsClosed, true);
        return;
      }
      if (mode.startsWith('setup_')) {
        assert.equal(prepared.status, 'blocked');
        assert.equal(prepared.residual, true);
        assert.equal(prepared.nativeExecutions, 0);
        assert.equal(prepared.controlAttempts, 50);
        const diagnosticRows = readFileSync(join(f.directory, 'preflight.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map(JSON.parse);
        assert.equal(diagnosticRows.length, 1);
        const receipt = diagnosticRows[0];
        assert.deepEqual(
          Object.keys(receipt).sort(),
          [
            'event',
            'at',
            'stage',
            'code',
            'httpStatus',
            'nativeExit',
            'childStarted',
            'childClosed',
            'aborted',
          ].sort(),
        );
        assert.equal(receipt.event, 'setup_failure_diagnostic');
        assert.ok(Number.isFinite(Date.parse(receipt.at)));
        const unknown = [
          'setup_throwing_diagnostics',
          'setup_missing_diagnostics',
          'setup_malformed_diagnostics',
        ].includes(mode);
        assert.equal(
          receipt.stage,
          unknown
            ? 'unknown'
            : ['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode)
              ? 'completed'
              : 'native_exit',
        );
        assert.equal(receipt.code, mode === 'setup_expired' ? 'saved_auth_expired' : 'unknown');
        assert.equal(
          receipt.httpStatus,
          mode === 'setup_http'
            ? 401
            : ['setup_contract', 'setup_foreign_bypass'].includes(mode)
              ? 200
              : null,
        );
        assert.equal(
          receipt.nativeExit,
          unknown ? null : ['setup_http', 'setup_contract', 'setup_foreign_bypass'].includes(mode) ? 0 : 1,
        );
        assert.equal(receipt.childStarted, !unknown);
        assert.equal(receipt.childClosed, !unknown);
        assert.equal(receipt.aborted, false);
        const publicJson = JSON.stringify({ prepared, rows, diagnosticRows });
        for (const key of [
          'managementKey',
          'writerPassword',
          'apifyReadToken',
          'machineToken',
          'protectionBypass',
        ])
          assert.equal(publicJson.includes(packet[key]), false);
        assert.equal(publicJson.includes('SYNTHETIC_PRIVATE_TRANSPORT_FAILURE'), false);
        const stopped = await session.close();
        assert.equal(stopped.residual, true);
        assert.equal(stopped.environmentCleanupVerified, true);
        assert.equal(stopped.adminChildClosed, true);
        assert.equal(f.calls.length, 0);
        assert.equal(envs.length, 0);
        assert.equal(Object.keys(bypass).length, 0);
        return;
      }
      const identityFailure = mode.startsWith('identity_');
      assert.equal(prepared.status, identityFailure ? 'blocked' : 'dev_runtime_prepared');
      assert.equal(prepared.nativeExecutions, 0);
      assert.equal(prepared.controlAttempts, 50);
      assert.equal(prepared.domainProofReady, false);
      assert.equal(rows.length, 0);
      assert.equal(wire.length, 50);
      assert.equal(envs.length, 7);
      restoreFault = mode === 'graph_restore_failure';
      const closed = await session.close();
      assert.equal(closed.residual, !['normal', 'writer_close_unknown_ack'].includes(mode));
      assert.equal(closed.baselineRestored, !identityFailure && mode !== 'graph_restore_failure');
      assert.equal(closed.environmentCleanupVerified, true);
      assert.equal(closed.windowClosed, mode !== 'sql_close_failure');
      assert.equal(closed.remoteWorkSettled, !identityFailure && mode !== 'graph_restore_failure');
      assert.equal(adminClosed, mode !== 'sql_close_failure');
      assert.equal(adminEnded, !['sql_close_failure', 'admin_abort_missing_descendants'].includes(mode));
      assert.equal(adminAborted, ['sql_close_failure', 'admin_abort_missing_descendants'].includes(mode));
      assert.equal(closed.adminChildClosed, mode !== 'admin_abort_missing_descendants');
      assert.equal(
        closed.childTransportsClosed,
        !['admin_abort_missing_descendants', 'writer_close_unknown_native_end'].includes(mode),
      );
      assert.equal(writerCloseCalls, 1);
      assert.equal(envs.length, 0);
      assert.equal(Object.keys(bypass).length, 0);
      assert.equal(wire.length, closed.baselineRestored ? 100 : 50);
      assert.equal(f.calls.filter((c) => c.path.endsWith('/publish')).length, identityFailure ? 0 : 8);
      const before = f.calls.length;
      if (mode === 'admin_abort_missing_descendants') {
        assert.equal(existsSync(join(f.directory, 'runtime.operation.lock')), true);
        const settled = await session.close();
        assert.equal(settled.adminChildClosed, true);
        assert.equal(settled.childTransportsClosed, true);
        assert.equal(settled.residual, true);
        assert.equal(existsSync(join(f.directory, 'runtime.operation.lock')), false);
      } else assert.deepEqual(await session.close(), closed);
      assert.equal(f.calls.length, before);
    } finally {
      try {
        await session.close();
      } catch {}
      f.cleanup();
    }
  });
