import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createFoundationExecutionController,
  createFoundationControlJournal,
  createFoundationControlBudget,
  assertFoundationNativeClosure,
} from './foundation-execution-control.mjs';
import { createFoundationNativeReader } from './foundation-native-reader.mjs';
import { createFoundationSettlementReader } from './foundation-native-settlement.mjs';
import { createFoundationNativeCleanup } from './foundation-native-cleanup.mjs';
import { runtimeGraphHash } from './foundation-runtime-control.mjs';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import { providerFixture, verifyAndCleanPhaseB } from './foundation-native-controller-fixtures.mjs';

// Scripted public-API boundary, not native/Cloud execution evidence. Runtime
// binding/case ports are explicit trusted test substitutes. Reader, settlement,
// journal, shared counter, closure and cleanup use their real production brands.
const initial = Date.parse('2026-10-19T12:00:00.000Z');
const iso = (n) => new Date(initial + n).toISOString();
const fixed = /FOUNDATION_NATIVE_CONTROL_BLOCKED/;
function fixture(options = {}) {
  const bindings = JSON.parse(
    readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)),
  );
  const keys = Object.keys(bindings.workflowRefs),
    bodies = new Map(),
    bound = new Map(),
    workflows = new Map(),
    executions = new Map(),
    deleted = new Set();
  const idFor = (key) => bindings.workflowRefs[key].id;
  const manual = (name) => ({
    id: name,
    name,
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
  });
  const call = (name, key) => ({
    id: name,
    name,
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.4,
    position: [0, 0],
    parameters: { workflowId: { __rl: true, mode: 'id', value: idFor(key) } },
  });
  const save = (key, nodes, published = false) => {
    const manualSet = ['WF-00', 'WF-91', 'WF-99', 'SUB-INGEST', 'SUB-COST'].includes(key);
    const integratedSet = !['WF-00', 'WF-99', 'SUB-INGEST', 'SUB-COST'].includes(key);
    const body = {
      name: bindings.workflowRefs[key].name,
      nodes,
      connections: {},
      settings: {
        saveManualExecutions: manualSet,
        saveDataSuccessExecution: integratedSet ? 'all' : 'none',
        saveDataErrorExecution: integratedSet ? 'all' : 'none',
        saveExecutionProgress: false,
        availableInMCP: key === 'WF-00',
      },
    };
    if (key === 'WF-19') body.settings.errorWorkflow = idFor('WF-90');
    const versionId = 'synthetic-' + key;
    const b = {
      workflowId: idFor(key),
      versionId,
      activeVersionId: published ? versionId : null,
      bodyHash: runtimeGraphHash(body),
      body,
    };
    bodies.set(key, body);
    bound.set(key, b);
    workflows.set(idFor(key), {
      id: idFor(key),
      versionId,
      activeVersionId: b.activeVersionId,
      active: published,
      ...body,
      ...(published ? { activeVersion: { workflowId: idFor(key), versionId, nodes, connections: {} } } : {}),
      pinData: {},
    });
  };
  save('WF-00', [manual('Manual'), call('Known call', 'WF-10')]);
  save('WF-10', []);
  save(
    'WF-19',
    [
      {
        id: 'webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2.1,
        position: [0, 0],
        parameters: { path: 'emr-apify-callback' },
      },
    ],
    true,
  );
  save('WF-90', [call('Notify', 'SUB-NOTIFY')], true);
  save('SUB-NOTIFY', [], true);
  const add = (id, key, mode, status = 'success', data = {}, extra = {}) => {
    const b = bound.get(key);
    const resultData = { runData: {}, ...data.resultData };
    const trigger = b.body.nodes.find((node) => node.type === 'n8n-nodes-base.manualTrigger');
    // The native MCP producer always seeds the sole ManualTrigger with an empty item.
    if (!options.browserUi && mode === 'manual' && trigger && resultData.pinData === undefined)
      resultData.pinData = { [trigger.name]: [{ json: {} }] };
    const metadata = {
      id,
      workflowId: idFor(key),
      workflowVersionId: b.versionId,
      mode,
      status,
      createdAt: iso(0),
      startedAt: iso(1),
      stoppedAt: iso(2),
      waitTill: null,
      ...extra,
    };
    executions.set(id, {
      metadata,
      full: {
        ...metadata,
        // Native 2.43.5 toWorkflowSnapshot persists no activeVersionId.
        workflowData: { id: idFor(key), ...b.body },
        data: { ...data, resultData },
      },
    });
  };
  add('301', 'WF-00', 'manual', 'success', {
    resultData: {
      runData: {
        'Known call': [{ metadata: { subExecution: { executionId: '302', workflowId: idFor('WF-10') } } }],
      },
    },
  });
  add(
    '302',
    'WF-10',
    'integrated',
    options.childStatus ?? 'success',
    {
      parentExecution: {
        executionId: options.wrongParent ? '999' : '301',
        workflowId: idFor('WF-00'),
        shouldResume: false,
      },
      resultData: { runData: {} },
    },
    options.childStatus === 'waiting' ? { waitTill: iso(5000) } : {},
  );
  let clock = initial + 1000,
    starts = 0,
    wireOrdinal = 0,
    sqlReads = 0;
  const rows = [],
    calls = [],
    traces = [],
    baselineIdsByKey = Object.fromEntries(keys.map((key) => [key, []]));
  const journal = createFoundationControlJournal({
    previousEvents: options.previousEvents ?? [],
    durableAppend: (row) => {
      options.onAppend?.(row);
      rows.push(row);
    },
  });
  const budget = createFoundationControlBudget({ journal, now: () => clock, deadlineAt: initial + 3601000 });
  const wire = (dto, status = 200) => ({
    status,
    body: (async function* () {
      yield Buffer.from(JSON.stringify(dto));
    })(),
    closed: Promise.resolve(),
  });
  const transport = {
    request: async ({ method, path }) => {
      calls.push({ method, path });
      options.onRequest?.({ method, path });
      const url = new URL('https://synthetic.invalid' + path);
      if (url.pathname.startsWith('/api/v1/workflows/'))
        return wire(workflows.get(url.pathname.split('/').at(-1)));
      if (url.pathname === '/api/v1/executions') {
        const workflowId = url.searchParams.get('workflowId');
        return wire({
          data: [...executions.values()]
            .filter((x) => x.metadata.workflowId === workflowId && !deleted.has(x.metadata.id))
            .map((x) =>
              Object.fromEntries(
                ['id', 'workflowId', 'mode', 'status', 'startedAt', 'stoppedAt', 'waitTill'].map((key) => [
                  key,
                  x.metadata[key],
                ]),
              ),
            ),
          nextCursor: null,
        });
      }
      const id = url.pathname.split('/')[4];
      const item = executions.get(id);
      if (!item || deleted.has(id)) return wire({}, 404);
      if (method === 'DELETE') {
        deleted.add(id);
        return wire({ ...item.metadata, id: Number(id) });
      }
      if (method === 'POST' && url.pathname.endsWith('/stop'))
        return wire({ ...item.metadata, status: 'canceled', finished: false });
      return wire(url.searchParams.get('includeData') === 'true' ? item.full : item.metadata);
    },
    webhookError: async ({ traceparent }) => {
      wireOrdinal++;
      traces.push(traceparent);
      const root = String(400 + wireOrdinal * 10),
        error = String(401 + wireOrdinal * 10);
      add(root, 'WF-19', 'webhook', 'error', {
        resultData: {
          runData: { Webhook: [{ data: { main: [[{ json: { headers: { traceparent }, body: {} } }]] } }] },
          error: { message: 'synthetic validation failure' },
        },
      });
      add(error, 'WF-90', 'error', 'success', {
        parentExecution: { executionId: root, workflowId: idFor('WF-19'), shouldResume: false },
        resultData: {
          runData:
            wireOrdinal === 3
              ? {
                  Notify: [
                    { metadata: { subExecution: { executionId: '499', workflowId: idFor('SUB-NOTIFY') } } },
                  ],
                }
              : {},
        },
      });
      if (wireOrdinal === 3)
        add('499', 'SUB-NOTIFY', 'integrated', 'success', {
          parentExecution: { executionId: error, workflowId: idFor('WF-90'), shouldResume: false },
          resultData: { runData: {} },
        });
      return wire({ error: 'synthetic validation failure' }, 500);
    },
  };
  const reader = createFoundationNativeReader({
    bindings,
    transport,
    admitControlAttempt: budget.admit,
    now: () => clock,
    deadlineAt: initial + 3601000,
    sensitiveValues: ['SYNTHETIC_NATIVE_CONTROL_PRIVATE_123456789'],
    bindingValidator: (b) => b,
  });
  const settlement = createFoundationSettlementReader({
    windowId: options.settlementWindowId ?? options.activeWindowId ?? foundationRuntimeCheckpoint.windowId,
    now: () => clock,
    pause: async (ms) => {
      clock += ms;
    },
    deadlineAt: initial + 3601000,
    transportSnapshot: () => ({
      pendingRequests: reader.state().pendingRequests,
      unclosedResponses: reader.state().unclosedResponses,
      pendingProviderRequests: 0,
      pendingGatewayRequests: 0,
    }),
    readProvider: async () => {
      throw Error('UNUSED');
    },
    readGateway: async ({ params }) => {
      sqlReads++;
      if (options.sqlDelay) await new Promise((resolve) => setTimeout(resolve, options.sqlDelay));
      if (options.unsettled) throw Error('SYNTHETIC_PRIVATE_SQL_ERROR');
      return {
        window_id:
          options.settlementWindowId ?? options.activeWindowId ?? foundationRuntimeCheckpoint.windowId,
        window_exists: true,
        observed_at: new Date(clock).toISOString(),
        requests: params[1].map((request_id) => ({
          request_id,
          operation: 'error.log',
          state: 'completed',
          read_started: false,
          completed_at: new Date(clock).toISOString(),
        })),
        leases: [],
        unsettled_requests: 0,
        providers: [],
      };
    },
  });
  const savedCase = {
    status: 'case_draft_verified',
    caseId: 'dispatch.vimeo',
    workflowId: idFor('WF-00'),
    versionId: bound.get('WF-00').versionId,
  };
  const ports = {
    ...(options.activeWindowId === undefined ? {} : { activeWindowId: options.activeWindowId }),
    bindings,
    journal,
    nativeReader: reader,
    nativeTransport: transport,
    bindingFor: (key, scope) => {
      if (options.strictCaseBinding && key === 'WF-00' && scope.caseReceipt !== savedCase)
        throw Error('CASE_RECEIPT_REQUIRED');
      return bound.get(key);
    },
    runtimeBindingValidator: (b) => b,
    settlementReader: settlement,
    controlBudget: budget,
    baselineIdsByKey,
    now: () => clock,
    pause: async (ms) => {
      clock += ms;
    },
    caseReceiptValidator: (r) => {
      if (r !== savedCase) throw Error('UNTRUSTED_CASE');
      return r;
    },
    callTimeoutMs: options.callTimeoutMs ?? 15000,
    port: {
      ...(options.browserUi ? { source: 'browser_ui' } : {}),
      details: async () => {
        if (options.detailsDelay) await new Promise((resolve) => setTimeout(resolve, options.detailsDelay));
        return options.browserUi
          ? {
              source: 'browser_ui',
              id: idFor('WF-00'),
              renderedName: bindings.workflowRefs['WF-00'].name,
              executeControlEnabled: true,
              ...options.detailsOverride,
            }
          : {
              id: idFor('WF-00'),
              versionId: bound.get('WF-00').versionId,
              canExecute: true,
              scopes: ['workflow:execute'],
            };
      },
      start: async (args) => {
        starts++;
        assert.deepEqual(args, { workflowId: idFor('WF-00'), executionMode: 'manual' });
        if (options.neverStart) return new Promise(() => {});
        if (options.unknownStart) throw Error('SYNTHETIC_PRIVATE_START');
        const id = options.ackId ?? '301';
        return options.browserUi
          ? {
              source: 'browser_ui',
              status: 'started',
              executionId: id,
              executionUrl: `https://muhhammedsayed.app.n8n.cloud/workflow/${idFor('WF-00')}/executions/${id}`,
              ...options.startOverride,
            }
          : { status: 'started', executionId: id };
      },
    },
  };
  options.beforeCreate?.({ executions, bodies, bound, workflows, baselineIdsByKey, ports });
  const controller = createFoundationExecutionController(ports);
  return {
    controller,
    ports,
    reader,
    journal,
    budget,
    rows,
    calls,
    executions,
    bodies,
    bound,
    traces,
    wire,
    transport,
    savedCase,
    starts: () => starts,
    sqlReads: () => sqlReads,
    setClock: (n) => {
      clock = n;
    },
    input: {
      caseId: 'dispatch.vimeo',
      workflowKey: 'WF-00',
      versionId: savedCase.versionId,
      caseReceipt: savedCase,
    },
  };
}

test('browser whole-workflow control uses fresh actual binding and native URL receipt without fake MCP scopes', async () => {
  const f = fixture({ browserUi: true, callTimeoutMs: 5, detailsDelay: 20 });
  const r = await f.controller.runCase(f.input);
  assert.equal(r.state, 'native_settled');
  assert.equal(r.businessAcceptanceProven, false);
  assert.equal(f.starts(), 1);
  assert.deepEqual(
    f.controller.caseReceipts(f.input.caseId).map((v) => v.executionId),
    ['301', '302'],
  );
  assert.equal(f.calls[0].path, '/api/v1/workflows/' + f.savedCase.workflowId + '?excludePinnedData=true');
});

for (const activeWindowId of [
  '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
  'eda4fae1-1e19-47db-81b8-beac1a4ed883',
  '3c46c791-e140-4eb9-890a-eecfa251f65e',
])
  test(`fresh ${activeWindowId} browser dispatch and four errors accept only their real branded settlement while retaining legacy batch identity`, async () => {
    const f = fixture({ browserUi: true, activeWindowId });
    assert.equal((await f.controller.runCase(f.input)).state, 'native_settled');
    assert.equal(f.controller.caseSettlement(f.input.caseId).windowId, activeWindowId);
    assert.equal(f.controller.caseClosure(f.input.caseId).batchId, foundationRuntimeCheckpoint.windowId);
    for (let ordinal = 1; ordinal <= 4; ordinal++)
      assert.equal((await f.controller.runAutomaticErrorCase(ordinal)).state, 'native_settled');
    assert.equal(f.controller.snapshot().phaseBReady, false); // Native records still require exact cleanup.
    assert.equal(f.starts(), 1);
    const wrong = fixture({
      browserUi: true,
      activeWindowId,
      settlementWindowId: foundationRuntimeCheckpoint.windowId,
    });
    assert.equal((await wrong.controller.runCase(wrong.input)).state, 'native_unresolved');
    assert.equal(wrong.controller.caseClosure(wrong.input.caseId), null);
  });
test('unknown active SQL window is refused before browser control or any native start', () => {
  assert.throws(
    () =>
      fixture({
        activeWindowId: '11111111-1111-4111-8111-111111111111',
        settlementWindowId: foundationRuntimeCheckpoint.windowId,
      }),
    fixed,
  );
});
for (const activeWindowId of ['eda4fae1-1e19-47db-81b8-beac1a4ed883', '3c46c791-e140-4eb9-890a-eecfa251f65e'])
  test(`fresh ${activeWindowId} smoke original and final settlement retain the active SQL window through real proof brands`, async () => {
    const f = providerFixture({
      configureSettlement(ports) {
        ports.windowId = activeWindowId;
        const read = ports.readGateway;
        ports.readGateway = async (args) => {
          const value = await read(args);
          value.window_id = activeWindowId;
          for (const provider of value.providers) provider.launch.window_id = activeWindowId;
          return value;
        };
      },
      beforeCreate({ ports }) {
        ports.activeWindowId = activeWindowId;
      },
    });
    await verifyAndCleanPhaseB(f);
    const result = await f.controller.runCase(f.smoke);
    assert.equal(result.state, 'native_settled');
    assert.equal(f.controller.caseSettlement('smoke.first').windowId, activeWindowId);
    assert.equal(result.closure.batchId, foundationRuntimeCheckpoint.windowId);
    assert.equal(f.actorStarts(), 1); // Scripted in-memory route; no provider is called.
    assert.equal(f.providerReads(), 2);
  });

test('browser foreign readiness, mixed sources, changed actual workflow or mismatched URL cannot prove a native start', async () => {
  for (const options of [
    { browserUi: true, detailsOverride: { renderedName: 'Foreign' } },
    { browserUi: true, detailsOverride: { executeControlEnabled: false } },
    { browserUi: true, detailsOverride: { canExecute: true } },
    { browserUi: true, detailsOverride: { source: 'mcp' } },
    {
      browserUi: true,
      beforeCreate({ workflows, ports }) {
        workflows.get(ports.bindings.workflowRefs['WF-00'].id).name = 'Foreign';
      },
      savedDrift: true,
    },
    {
      browserUi: true,
      beforeCreate({ executions }) {
        executions.get('301').full.workflowData.name = 'Foreign';
      },
    },
    {
      browserUi: true,
      startOverride: { executionUrl: 'https://muhhammedsayed.app.n8n.cloud/workflow/Foreign/executions/301' },
    },
  ]) {
    const f = fixture(options),
      result = await f.controller.runCase(f.input);
    assert.equal(result.state, 'native_unresolved');
    assert.equal(f.controller.caseClosure(f.input.caseId), null);
    await assert.rejects(f.controller.runCase(f.input), fixed);
    assert.equal(f.starts(), options.startOverride || (options.beforeCreate && !options.savedDrift) ? 1 : 0);
  }
});

test('browser saved graph drift during UI readiness blocks before durable start intent and every click', async () => {
  const f = fixture({
    browserUi: true,
    beforeCreate({ workflows, ports }) {
      const originalDetails = ports.port.details;
      ports.port.details = async (args) => {
        const observed = await originalDetails(args);
        workflows.get(args.workflowId).name = 'SYNTHETIC_CHANGED_DURING_BROWSER_READINESS';
        return observed;
      };
    },
  });
  const r = await f.controller.runCase(f.input);
  assert.equal(r.state, 'native_unresolved');
  assert.equal(f.starts(), 0);
  assert.equal(f.controller.caseClosure(f.input.caseId), null);
  assert.equal(
    f.rows.some((row) => row.event === 'native_start_intent'),
    false,
  );
  assert.equal(
    f.rows.some((row) => row.event === 'native_start_ack'),
    false,
  );
  assert.equal(f.calls.filter((call) => call.path.startsWith('/api/v1/workflows/')).length, 2);
  await assert.rejects(f.controller.runCase(f.input), fixed);
  assert.equal(f.starts(), 0);
});

test('native main entry proves real scripted root-child, settlement and exact cleanup brands without altering historical mode', async () => {
  const f = fixture();
  assert.equal(f.controller.authorizeExecution({ method: 'GET', executionId: '301' }), false);
  assert.equal(f.controller.authorizeExecution({ method: 'DELETE', executionId: '301' }), false);
  const result = await f.controller.runCase(f.input);
  assert.equal(result.state, 'native_settled');
  assert.equal(result.businessAcceptanceProven, false);
  assert.equal(f.starts(), 1);
  assert.equal(f.controller.snapshot().stopped, false);
  const receipts = f.controller.caseReceipts('dispatch.vimeo');
  assert.deepEqual(
    receipts.map((r) => r.executionId),
    ['301', '302'],
  );
  for (const receipt of receipts)
    assert.equal(assertFoundationNativeClosure(result.closure, { receipt }), result.closure);
  assert.equal(f.controller.authorizeExecution({ method: 'GET', executionId: '301' }), true);
  assert.equal(f.controller.authorizeExecution({ method: 'POST', executionId: '302' }), true);
  assert.equal(f.controller.authorizeExecution({ method: 'DELETE', executionId: '301' }), true);
  assert.equal(f.controller.authorizeExecution({ method: 'DELETE', executionId: '999' }), false);
  assert.throws(() => assertFoundationNativeClosure({ ...result.closure }, { receipt: receipts[0] }), fixed);
  assert.equal(f.sqlReads(), 2);
  const cleanup = createFoundationNativeCleanup({
    reader: f.reader,
    transport: f.transport,
    journal: f.journal,
    admitControlAttempt: f.budget.admit,
    now: f.ports.now,
    deadlineAt: f.budget.snapshot().deadlineAt,
  });
  for (const receipt of receipts) {
    const record = await cleanup.cleanup({ receipt, closure: result.closure });
    assert.equal(record.state, 'native_record_deleted');
    assert.throws(() => f.controller.recordCleanup({ ...record }), /FOUNDATION_NATIVE_CLEANUP_BLOCKED/);
    f.controller.recordCleanup(record);
    assert.equal(
      f.controller.authorizeExecution({ method: 'DELETE', executionId: receipt.executionId }),
      false,
    );
  }
  assert.equal(
    f.rows.some((r) => r.event === 'native_cleanup_evidence'),
    true,
  );
});

test('waiting, wrong native backlink and external unsettled state never produce deletion authority or rearm', async () => {
  for (const options of [{ childStatus: 'waiting' }, { wrongParent: true }, { unsettled: true }]) {
    const f = fixture(options);
    assert.equal((await f.controller.runCase(f.input)).state, 'native_unresolved');
    assert.equal(f.controller.caseClosure('dispatch.vimeo'), null);
    assert.equal(f.controller.snapshot().stopped, true);
    await assert.rejects(f.controller.runCase(f.input), fixed);
    assert.equal(f.starts(), 1);
    assert.equal(f.controller.authorizeExecution({ method: 'DELETE', executionId: '301' }), false);
  }
});

test('lost starts, old native IDs, duplicate cases and restart journals cannot dispatch replacement work', async () => {
  for (const options of [
    { unknownStart: true },
    {
      beforeCreate: ({ baselineIdsByKey }) => {
        baselineIdsByKey['WF-00'].push('301');
      },
    },
  ]) {
    const f = fixture(options);
    assert.equal((await f.controller.runCase(f.input)).state, 'native_unresolved');
    await assert.rejects(f.controller.runCase(f.input), fixed);
    assert.equal(f.starts(), 1);
    const resumed = fixture({ previousEvents: f.journal.rows });
    await assert.rejects(resumed.controller.runCase(resumed.input), fixed);
    assert.equal(resumed.starts(), 0);
  }
});

test('missing parent-side failed-call metadata requires unique bounded candidate plus actual child backlink', async () => {
  const f = fixture({
    beforeCreate: ({ executions }) => {
      executions.get('301').full.data.resultData.runData['Known call'] = [
        { error: { message: 'synthetic failure without native child metadata' } },
      ];
    },
  });
  assert.equal((await f.controller.runCase(f.input)).state, 'native_settled');
  const root = f.controller.caseReceipts('dispatch.vimeo')[0];
  assert.deepEqual(root.nativeChildren, []);
  assert.equal(root.missingNativeChildCalls.length, 1);
  assert.equal(
    f.rows.some((r) => r.event === 'native_tree_link' && r.kind === 'native_backlink'),
    true,
  );
  const ambiguous = fixture({
    beforeCreate: ({ executions }) => {
      executions.get('301').full.data.resultData.runData['Known call'] = [{ error: {} }];
      const another = structuredClone(executions.get('302'));
      another.metadata.id = another.full.id = '303';
      executions.set('303', another);
    },
  });
  assert.equal((await ambiguous.controller.runCase(ambiguous.input)).state, 'native_unresolved');
  assert.equal(
    ambiguous.calls.some((r) => r.path === '/api/v1/executions/303?includeData=true'),
    false,
  );
});

test('four native automatic errors use fresh trace input, positive WF90 backlinks and third-only notification', async () => {
  const f = fixture();
  for (let ordinal = 1; ordinal <= 4; ordinal++)
    assert.equal((await f.controller.runAutomaticErrorCase(ordinal)).state, 'native_settled');
  assert.equal(new Set(f.traces).size, 4);
  assert.equal(
    f.traces.every((s) => /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/.test(s)),
    true,
  );
  assert.equal(f.controller.snapshot().nativeExecutions, 9);
  assert.equal(
    f.controller.caseReceipts('automatic.error.3').some((r) => r.key === 'SUB-NOTIFY'),
    true,
  );
  assert.equal(
    f.controller.caseReceipts('automatic.error.4').some((r) => r.key === 'SUB-NOTIFY'),
    false,
  );
  assert.equal(f.starts(), 0);
  await assert.rejects(f.controller.runAutomaticErrorCase(4), fixed);
});

test('unknown child dispatch and exhausted deadline retain evidence; stop acknowledgement never creates closure', async () => {
  const f = fixture({ childStatus: 'waiting' });
  assert.equal((await f.controller.runCase(f.input)).state, 'native_unresolved');
  const result = await f.controller.stop({ executionId: '301' });
  assert.equal(result.state, 'stop_acknowledged');
  assert.equal(result.completionProven, false);
  assert.equal(f.controller.caseClosure('dispatch.vimeo'), null);
  await assert.rejects(f.controller.stop({ executionId: '301' }), fixed);
  await assert.rejects(f.controller.stop({ executionId: '999' }), fixed);
  const late = fixture();
  late.setClock(initial + 3001000);
  await assert.rejects(late.controller.runCase(late.input), fixed);
  assert.equal(late.starts(), 0);
});

test('bounded start timeout retains the unresolved transport and blocks every new admission', async () => {
  const f = fixture({ neverStart: true, callTimeoutMs: 5 });
  assert.equal((await f.controller.runCase(f.input)).state, 'native_unresolved');
  assert.equal(f.controller.snapshot().pendingTransportCalls, 1);
  assert.equal(f.controller.snapshot().stopped, true);
  await assert.rejects(f.controller.runCase(f.input), fixed);
});

test('settlement composites retain their own bounded calls beyond one external-call timeout', async () => {
  const f = fixture({ callTimeoutMs: 5, sqlDelay: 12 });
  assert.equal((await f.controller.runCase(f.input)).state, 'native_settled');
  assert.equal(f.sqlReads(), 2);
  assert.equal(f.controller.snapshot().pendingTransportCalls, 0);
});

test('pending manual stop retains its actual case binding and last branded metadata without a ninth poll', async () => {
  const f = fixture({
    strictCaseBinding: true,
    beforeCreate: ({ executions }) => {
      for (const dto of [executions.get('301').metadata, executions.get('301').full]) {
        dto.status = 'waiting';
        dto.waitTill = iso(5000);
      }
    },
  });
  assert.equal((await f.controller.runCase(f.input)).state, 'native_unresolved');
  assert.equal(f.calls.filter((r) => r.path === '/api/v1/executions/301?includeData=false').length, 8);
  assert.equal((await f.controller.stop({ executionId: '301' })).state, 'stop_acknowledged');
  assert.equal(f.calls.filter((r) => r.path === '/api/v1/executions/301?includeData=false').length, 8);
});

test('closure never reopens permanent admission after shutdown and copied cleanup cannot unlock paid work', async () => {
  const f = fixture();
  const pending = f.controller.runCase(f.input);
  f.controller.closeAdmission();
  assert.equal((await pending).state, 'native_unresolved');
  assert.equal(f.starts(), 0);
  assert.equal(f.controller.snapshot().admissionClosed, true);
  const paid = fixture();
  await assert.rejects(
    paid.controller.runCase({ ...paid.input, caseId: 'smoke.first', workflowKey: 'WF-99' }),
    fixed,
  );
  assert.equal(paid.starts(), 0);
  assert.equal(paid.controller.snapshot().phaseBReady, false);
  assert.throws(
    () => paid.controller.recordCleanup({ state: 'native_record_deleted', executionId: '301' }),
    fixed,
  );
});

test('new cases cannot spend the immutable460-attempt shutdown reserve', async () => {
  const previousEvents = Array.from({ length: 1589 }, (_, i) => ({
    event: 'control_request_intent',
    ordinal: i + 1,
    kind: 'discovery',
  }));
  const f = fixture({ previousEvents });
  await assert.rejects(f.controller.runCase(f.input), fixed);
  await assert.rejects(f.controller.runAutomaticErrorCase(1), fixed);
  assert.equal(f.starts(), 0);
  assert.equal(f.calls.length, 0);
  assert.equal(
    f.rows.some((r) => ['native_case_intent', 'native_error_group_intent'].includes(r.event)),
    false,
  );
  assert.equal(f.budget.snapshot().attempts, 1589);
});
