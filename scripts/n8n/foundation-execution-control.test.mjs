import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createFoundationExecutionController as realController,
  createFoundationMcpPort,
} from './foundation-execution-control.mjs';

const bindings = JSON.parse(
  await readFile(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
);
const wf = bindings.workflowRefs['WF-00'].id;
// This is the trusted runtime case-save port boundary under synthetic tests.
// Production defaults to the runtime module's branded successful receipt.
const savedCase = {
  status: 'case_draft_verified',
  caseId: 'dispatch.vimeo',
  workflowId: wf,
  workflowVersionId: 'owned-version-1',
  versionId: 'owned-version-1',
};
const secondSavedCase = { ...savedCase, caseId: 'dispatch.youtube' };
const oneNativeCase = { ...savedCase, caseId: 'dispatch.unknown' };
const createFoundationExecutionController = (options) =>
  realController({
    ...options,
    caseReceiptValidator: (r) => {
      if (![savedCase, secondSavedCase, oneNativeCase].includes(r))
        throw Error('FOUNDATION_CONTROL_CASE_RECEIPT');
      return r;
    },
  });
function fixture(overrides = {}) {
  let time = Date.parse('2026-10-19T10:00:00Z');
  const events = [],
    calls = [];
  const workflow = {
    id: wf,
    versionId: 'owned-version-1',
    canExecute: true,
    scopes: ['workflow:execute'],
    settings: {
      availableInMCP: true,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveManualExecutions: false,
      saveExecutionProgress: false,
    },
    nodes: [{ type: 'n8n-nodes-base.manualTrigger', disabled: false }],
  };
  const port = {
    details: async () => workflow,
    start: async (args) => {
      calls.push(args);
      return { status: 'started', executionId: '301' };
    },
    metadata: async ({ executionId }) => ({
      id: executionId,
      workflowId: wf,
      workflowVersionId: 'owned-version-1',
      mode: 'manual',
      status: 'success',
      startedAt: '2026-10-19T10:00:00Z',
      stoppedAt: '2026-10-19T10:00:01Z',
    }),
    ...overrides,
  };
  const journal = { append: async (event) => events.push(structuredClone(event)) };
  const controller = createFoundationExecutionController({
    bindings,
    port,
    journal,
    now: () => time,
    pause: async (ms) => {
      time += ms;
    },
  });
  return { controller, events, calls, workflow };
}
const input = {
  caseId: 'dispatch.vimeo',
  workflowKey: 'WF-00',
  versionId: 'owned-version-1',
  caseReceipt: savedCase,
};
test('a continuation carry proof cannot fall back to the legacy execution controller', () => {
  let calls = 0;
  assert.throws(
    () =>
      realController({
        bindings,
        projectVerifiedContinuationProof: Object.freeze({ carriedNativeExecutions: 0 }),
        port: {
          start() {
            calls++;
          },
        },
        journal: {
          append() {
            calls++;
          },
        },
      }),
    /FOUNDATION_CONTROL_JOURNAL/,
  );
  assert.equal(calls, 0);
});

test('fixed manual start omits inputs and journals intent before start; exact terminal identity required', async () => {
  const f = fixture();
  const receipt = await f.controller.runCase(input);
  assert.equal(receipt.state, 'terminal');
  assert.deepEqual(f.calls, [{ workflowId: wf, executionMode: 'manual' }]);
  assert.equal(f.events[1].event, 'start_intent');
  assert.equal(receipt.executionId, '301');
  assert.equal(f.controller.snapshot().stopped, true);
  await assert.rejects(f.controller.runCase(input), /CONTROLLER_STOPPED/);
});
test('uncertain start acknowledgement never starts again or invents an execution ID', async () => {
  const f = fixture({
    start: async () => {
      throw Error('secret credential-bearing error');
    },
  });
  const result = await f.controller.runCase(input);
  assert.equal(result.state, 'start_unknown');
  assert.equal(result.executionId, null);
  assert.ok(!JSON.stringify(f.events).includes('secret'));
  await assert.rejects(f.controller.runCase(input), /CONTROLLER_STOPPED/);
});
test('started without ID, null metadata and missing final status never mean completed', async () => {
  const a = fixture({ start: async () => ({ status: 'started', executionId: null }) });
  assert.equal((await a.controller.runCase(input)).state, 'start_unknown');
  const b = fixture({ metadata: async () => null });
  assert.equal((await b.controller.runCase(input)).state, 'completion_unobservable');
  const c = fixture({
    metadata: async () => ({
      id: '301',
      workflowId: wf,
      workflowVersionId: 'owned-version-1',
      status: 'success',
      stoppedAt: null,
    }),
  });
  assert.equal((await c.controller.runCase(input)).state, 'completion_unobservable');
});
test('foreign workflow or execution metadata stops without capturing raw data', async () => {
  const f = fixture({
    metadata: async () => ({
      id: '302',
      workflowId: 'foreign',
      status: 'success',
      stoppedAt: '2026-10-19T10:00:00Z',
      data: { secret: 'never persist' },
    }),
  });
  assert.equal((await f.controller.runCase(input)).state, 'completion_unobservable');
  assert.ok(!JSON.stringify(f.events).includes('never persist'));
});
test('wrong root mode, stale terminal row and fabricated case receipt are rejected', async () => {
  for (const change of [
    { mode: 'integrated' },
    { startedAt: '2026-10-18T10:00:00Z' },
    { workflowVersionId: 'foreign-version' },
    { stoppedAt: '2026-10-20T10:00:00Z' },
  ]) {
    const f = fixture({
      metadata: async () => ({
        id: '301',
        workflowId: wf,
        workflowVersionId: 'owned-version-1',
        mode: 'manual',
        status: 'success',
        startedAt: '2026-10-19T10:00:00Z',
        stoppedAt: '2026-10-19T10:00:01Z',
        ...change,
      }),
    });
    assert.equal((await f.controller.runCase(input)).state, 'completion_unobservable');
  }
  await assert.rejects(
    fixture().controller.runCase({ ...input, caseReceipt: { ...savedCase } }),
    /CONTROL_CASE_RECEIPT/,
  );
});
test('a reused native ACK cannot satisfy a different saved case', async () => {
  const f = fixture();
  await f.controller.runCase({ ...input, caseId: 'dispatch.unknown', caseReceipt: oneNativeCase });
  const result = await f.controller.runCase({
    ...input,
    caseId: 'dispatch.youtube',
    caseReceipt: secondSavedCase,
  });
  assert.equal(result.state, 'start_unknown');
  assert.equal(f.controller.snapshot().stopped, true);
  assert.equal(f.controller.snapshot().observedExecutionIds, 1);
});
test('waiting/running does not complete; finite polling times out with no invented cancellation', async () => {
  let reads = 0;
  const f = fixture({
    metadata: async () => {
      reads++;
      return {
        id: '301',
        workflowId: wf,
        workflowVersionId: 'owned-version-1',
        mode: 'manual',
        status: 'waiting',
        startedAt: '2026-10-19T10:00:00Z',
        stoppedAt: null,
      };
    },
  });
  const r = await f.controller.runCase(input);
  assert.equal(r.state, 'terminal_unconfirmed');
  assert.equal(reads, 8);
  assert.equal(r.cancellationSupported, false);
});
test('drift, enabled schedule, missing MCP execute permission and arbitrary case are denied before start', async () => {
  for (const mutate of [
    (w) => {
      w.versionId = 'changed';
    },
    (w) => w.nodes.push({ type: 'n8n-nodes-base.scheduleTrigger' }),
    (w) => {
      w.canExecute = false;
    },
    (w) => w.nodes.push({ type: 'n8n-nodes-base.webhook' }),
  ]) {
    const f = fixture();
    mutate(f.workflow);
    await assert.rejects(f.controller.runCase(input), /CONTROL_PREFLIGHT/);
    assert.equal(f.calls.length, 0);
  }
  await assert.rejects(fixture().controller.runCase({ ...input, caseId: 'arbitrary' }), /CONTROL_CASE/);
});
test('journal failure precedes every side effect and repeated resume is fenced by prior intents', async () => {
  const f = fixture();
  const controller = createFoundationExecutionController({
    bindings,
    port: { start: async () => assert.fail(), details: async () => f.workflow },
    journal: {
      append: async () => {
        throw Error('disk');
      },
    },
  });
  await assert.rejects(controller.runCase(input));
  const resumed = createFoundationExecutionController({
    bindings,
    port: {},
    journal: { append: async () => {} },
    previousEvents: [{ event: 'start_intent', caseId: input.caseId }],
  });
  await assert.rejects(resumed.runCase(input), /CONTROLLER_STOPPED/);
});
test('nested executions require explicit owned IDs and terminal metadata separately; empty children not inferred', async () => {
  const f = fixture();
  const root = await f.controller.runCase(input);
  assert.equal(root.nestedCoverage, 'not_established');
  await assert.rejects(
    f.controller.observeNested({ parentExecutionId: '301', workflowKey: 'WF-10', executionId: '302' }),
    /NESTED_CAPABILITY_UNAVAILABLE/,
  );
});
test('cancelled native execution is terminal failure, not success or permission to start a replacement', async () => {
  const f = fixture({
    metadata: async () => ({
      id: '301',
      workflowId: wf,
      workflowVersionId: 'owned-version-1',
      mode: 'manual',
      status: 'canceled',
      startedAt: '2026-10-19T10:00:00Z',
      stoppedAt: '2026-10-19T10:00:01Z',
    }),
  });
  const r = await f.controller.runCase(input);
  assert.equal(r.state, 'terminal');
  assert.equal(r.status, 'canceled');
  assert.equal(f.controller.snapshot().stopped, true);
});
test('poll transport failure and a failed journal after start remain fenced', async () => {
  const f = fixture({
    metadata: async () => {
      throw Error('private raw error');
    },
  });
  assert.equal((await f.controller.runCase(input)).state, 'completion_unobservable');
  assert.equal(f.controller.snapshot().stopped, true);
  let writes = 0;
  const original = fixture();
  const c = createFoundationExecutionController({
    bindings,
    port: {
      details: async () => original.workflow,
      start: async () => ({ status: 'started', executionId: '301' }),
    },
    journal: {
      append: async () => {
        if (++writes === 4) throw Error('disk');
      },
    },
  });
  await assert.rejects(c.runCase(input));
  assert.equal(c.snapshot().stopped, true);
});
test('a caller source label cannot fabricate child linkage; full upper bound was already reserved', async () => {
  const childId = bindings.workflowRefs['WF-10'].id;
  const f = fixture({
    metadata: async ({ workflowId, executionId }) => ({
      id: executionId,
      workflowId,
      mode: workflowId === wf ? 'manual' : 'integrated',
      status: 'success',
      startedAt: '2026-10-19T10:00:00Z',
      stoppedAt: '2026-10-19T10:00:01Z',
    }),
  });
  await f.controller.runCase(input);
  await assert.rejects(
    f.controller.observeNested({
      parentExecutionId: '301',
      workflowKey: 'WF-10',
      executionId: '302',
      nativeLink: {
        source: 'native_execute_workflow_metadata',
        parentExecutionId: '301',
        workflowId: childId,
        executionId: '302',
      },
    }),
    /NESTED_CAPABILITY_UNAVAILABLE/,
  );
  assert.equal(f.controller.snapshot().nativeExecutions, 2);
});
test('concurrent same-case calls admit only one start', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.controller.runCase(input), f.controller.runCase(input)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.calls.length, 1);
  assert.match(results.find((r) => r.status === 'rejected').reason.message, /CONTROLLER_BUSY/);
});
test('never-settling start is bounded, unknown and explicitly not transport/native cancellation', async () => {
  const f = fixture();
  const controller = createFoundationExecutionController({
    bindings,
    callTimeoutMs: 5,
    port: { details: async () => f.workflow, start: async () => new Promise(() => {}) },
    journal: { append: async () => {} },
  });
  const result = await controller.runCase(input);
  assert.equal(result.state, 'start_unknown');
  assert.equal(controller.snapshot().pendingTransportCalls, 1);
  assert.equal(controller.snapshot().stopped, true);
});
test('a durable intent flush crossing the start cutoff cannot dispatch a late start', async () => {
  const f = fixture();
  let clock = 0,
    starts = 0;
  const c = createFoundationExecutionController({
    bindings,
    now: () => clock,
    port: {
      details: async () => f.workflow,
      start: async () => {
        starts++;
      },
    },
    journal: {
      append: async (e) => {
        if (e.event === 'mcp_request_intent' && e.kind === 'start') clock = 50 * 60 * 1000;
      },
    },
  });
  await assert.rejects(c.runCase(input), /CONTROL_BUDGET/);
  assert.equal(starts, 0);
  assert.equal(c.snapshot().stopped, true);
});
test('MCP adapter only invokes supported exact schemas; content/error payloads never become diagnostics', async () => {
  const seen = [];
  const port = createFoundationMcpPort({
    getWorkflowDetails: async (x) => ({ structuredContent: { workflow: { id: x.workflowId } } }),
    executeWorkflow: async (x) => {
      seen.push(x);
      return { structuredContent: { status: 'started', executionId: '303' } };
    },
    getExecution: async (x) => {
      seen.push(x);
      return { structuredContent: { execution: null, error: 'sensitive' } };
    },
  });
  assert.equal((await port.start({ workflowId: wf, executionMode: 'manual' })).executionId, '303');
  assert.equal(await port.metadata({ workflowId: wf, executionId: '303' }), null);
  assert.deepEqual(seen[1], {
    workflowId: wf,
    executionId: '303',
    includeData: false,
  });
});

test('native mode refuses caller-labelled reader, journal, budget and settlement ports', () => {
  assert.throws(
    () =>
      realController({
        bindings,
        port: { details: async () => ({}), start: async () => ({}) },
        journal: { append: async () => {} },
        nativeReader: {},
      }),
    /FOUNDATION_NATIVE_CONTROL_BLOCKED/,
  );
});
