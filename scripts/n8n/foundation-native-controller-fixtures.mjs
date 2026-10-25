import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createFoundationExecutionController,
  createFoundationControlJournal,
  createFoundationControlBudget,
} from './foundation-execution-control.mjs';
import { createFoundationNativeReader } from './foundation-native-reader.mjs';
import { createFoundationSettlementReader } from './foundation-native-settlement.mjs';
import { createFoundationNativeCleanup } from './foundation-native-cleanup.mjs';
import { runtimeGraphHash } from './foundation-runtime-control.mjs';
import { foundationRuntimeCheckpoint } from './foundation-runtime-checkpoint.mjs';
import { foundationSmokeInput } from '../../n8n/foundation/build-foundation-smoke.mjs';

// Scripted public-API boundary, not native/Cloud execution evidence. Runtime
// binding/case ports are explicit trusted test substitutes. Reader, settlement,
// journal, shared counter, closure and cleanup use their real production brands.
const initial = Date.parse('2026-10-19T12:00:00.000Z');
const iso = (n) => new Date(initial + n).toISOString();
export function baseFixture(options = {}) {
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
        workflowData: { id: idFor(key), ...b.body },
        data: { resultData: { runData: {} }, ...data },
      },
    });
    if (mode === 'manual') {
      const manual = b.body.nodes.find(
        (node) => node.type === 'n8n-nodes-base.manualTrigger' && node.disabled !== true,
      );
      if (manual) {
        const result = executions.get(id).full.data.resultData;
        result.pinData = { ...(result.pinData ?? {}), [manual.name]: [{ json: {} }] };
      }
    }
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
                Object.entries(x.metadata).filter(
                  ([name]) => !['createdAt', 'workflowVersionId'].includes(name),
                ),
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
      if (options.unsettled) throw Error('SYNTHETIC_PRIVATE_SQL_ERROR');
      return {
        window_id: foundationRuntimeCheckpoint.windowId,
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
    bindings,
    journal,
    nativeReader: reader,
    nativeTransport: transport,
    bindingFor: (key) => bound.get(key),
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
      details: async () => ({
        id: idFor('WF-00'),
        versionId: bound.get('WF-00').versionId,
        canExecute: true,
        scopes: ['workflow:execute'],
      }),
      start: async (args) => {
        starts++;
        assert.deepEqual(args, { workflowId: idFor('WF-00'), executionMode: 'manual' });
        if (options.neverStart) return new Promise(() => {});
        if (options.unknownStart) throw Error('SYNTHETIC_PRIVATE_START');
        return { status: 'started', executionId: options.ackId ?? '301' };
      },
    },
  };
  options.beforeCreate?.({
    executions,
    bodies,
    bound,
    baselineIdsByKey,
    ports,
    save,
    add,
    idFor,
    workflows,
    wire,
  });
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

export function providerFixture({
  wrongCallback = false,
  providerCost = 0.125,
  beforeCreate,
  configureSettlement,
} = {}) {
  const original = 'SyntheticOriginalRun';
  const runId = '01111111-1111-4111-8111-111111111111';
  const accountId = '02222222-2222-4222-8222-222222222222';
  let savedSmoke,
    providerReads = 0,
    actorStarts = 0;
  const f = baseFixture({
    beforeCreate(context) {
      const { ports, save, add, idFor, bound, workflows, wire } = context;
      save('WF-99', [
        {
          id: 'manual',
          name: 'Manual smoke',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [0, 0],
          parameters: {},
        },
        {
          id: 'start',
          name: 'Start guarded dev parent',
          type: 'n8n-nodes-base.executeWorkflow',
          typeVersion: 1.4,
          position: [240, 0],
          parameters: { workflowId: { __rl: true, mode: 'id', value: idFor('SUB-START') } },
        },
      ]);
      save('SUB-START', []);
      const smokeBinding = bound.get('WF-99');
      smokeBinding.body.settings.availableInMCP = true;
      smokeBinding.bodyHash = runtimeGraphHash(smokeBinding.body);
      workflows.get(idFor('WF-99')).settings.availableInMCP = true;
      const callbackNodes = [
        ...bound.get('WF-19').body.nodes,
        {
          id: 'validate',
          name: 'Validate callback source',
          type: 'n8n-nodes-base.code',
          typeVersion: 2,
          position: [0, 0],
          parameters: { jsCode: '/* scripted trusted binding, not a native execution claim */' },
        },
      ];
      save('WF-19', callbackNodes, true);
      savedSmoke = Object.freeze({
        status: 'case_draft_verified',
        caseId: 'smoke.first',
        workflowId: idFor('WF-99'),
        versionId: smokeBinding.versionId,
      });
      const oldCase = ports.caseReceiptValidator;
      ports.caseReceiptValidator = (receipt) => (receipt === savedSmoke ? receipt : oldCase(receipt));
      const oldDetails = ports.port.details,
        oldStart = ports.port.start;
      ports.port.details = (args) =>
        args.workflowId === idFor('WF-99')
          ? {
              id: args.workflowId,
              versionId: smokeBinding.versionId,
              canExecute: true,
              scopes: ['workflow:execute'],
            }
          : oldDetails(args);
      ports.port.start = (args) => {
        if (args.workflowId !== idFor('WF-99')) return oldStart(args);
        actorStarts++;
        assert.deepEqual(args, { workflowId: idFor('WF-99'), executionMode: 'manual' });
        add('501', 'WF-99', 'manual', 'success', {
          resultData: {
            runData: {
              'Start guarded dev parent': [
                { metadata: { subExecution: { executionId: '506', workflowId: idFor('SUB-START') } } },
              ],
            },
          },
        });
        add('506', 'SUB-START', 'integrated', 'success', {
          parentExecution: { executionId: '501', workflowId: idFor('WF-99'), shouldResume: true },
          resultData: { runData: {} },
        });
        const callbackOriginal = wrongCallback ? 'DifferentOriginalRun' : original;
        add('502', 'WF-19', 'webhook', 'success', {
          resultData: {
            runData: {
              Webhook: [
                {
                  data: {
                    main: [
                      [
                        {
                          json: {
                            headers: {},
                            body: { eventType: 'ACTOR.RUN.SUCCEEDED', resource: { id: callbackOriginal } },
                          },
                        },
                      ],
                    ],
                  },
                },
              ],
              'Validate callback source': [
                {
                  data: {
                    main: [
                      [
                        {
                          json: {
                            apify_run_id: callbackOriginal,
                            transport: 'webhook',
                            params: [callbackOriginal],
                          },
                        },
                      ],
                    ],
                  },
                },
              ],
            },
          },
        });
        return { status: 'started', executionId: '501' };
      };
      const saved = {
        updated: true,
        finished_now: true,
        apify_run_id: original,
        run_id: runId,
        account_ids: [accountId],
        status: 'SUCCEEDED',
        dataset_id: 'SyntheticDataset',
        cost_usd: 0.125,
        groups_sha256: 'a'.repeat(64),
        normalizer_version: 'smoke_website_stub.v1',
        cost_keys: ['apify:' + original + ':' + accountId],
        items_seen: 1,
        items_new: 0,
        new_item_ids: [],
        accounts_ok: 1,
        accounts_failed: 0,
        run_summary: {
          run_id: runId,
          status: 'success',
          accounts_total: 1,
          accounts_ok: 1,
          accounts_failed: 0,
          items_seen: 1,
          items_new: 0,
          cost_usd: 0.125,
        },
      };
      const providerContext = () => ({
        execution_id: '501',
        scrape_execution_id: '506',
        run_status: 'success',
        run_finished_at: iso(2),
        terminal_cost_match: null,
        launch: {
          window_id: foundationRuntimeCheckpoint.windowId,
          launch_id: '03333333-3333-4333-8333-333333333333',
          ordinal: 1,
          execution_id: '501',
          run_id: runId,
          account_id: accountId,
          actor_id: 'aYG0l9s7dbB7j3gbS',
          actor_build: '0.3.99',
          input: structuredClone(foundationSmokeInput),
          memory_mb: 1024,
          timeout_seconds: 300,
          max_total_charge_usd: 1,
          post_intent_at: iso(0),
          apify_run_id: original,
          reconciled_at: iso(1),
        },
        registry: {
          apify_run_id: original,
          actor_id: 'aYG0l9s7dbB7j3gbS',
          run_id: runId,
          account_ids: [accountId],
          purpose: 'daily',
          processed_at: iso(2),
          status: 'SUCCEEDED',
          dataset_id: 'SyntheticDataset',
          usage_usd: 0.125,
          processing_result: structuredClone(saved),
        },
      });
      const now = ports.now;
      const settlementPorts = {
        now,
        pause: ports.pause,
        deadlineAt: ports.controlBudget.snapshot().deadlineAt,
        transportSnapshot: () => ({
          pendingRequests: ports.nativeReader.state().pendingRequests,
          unclosedResponses: ports.nativeReader.state().unclosedResponses,
          pendingProviderRequests: 0,
          pendingGatewayRequests: 0,
        }),
        readGateway: async ({ params }) => {
          const providers = params[2].includes('501') ? [providerContext()] : [];
          const samples = JSON.parse(params[3]);
          for (const row of providers) {
            const sample = samples.find((s) => s.apify_run_id === original);
            row.terminal_cost_match = sample ? sample.usage_usd === row.registry.usage_usd : null;
          }
          return {
            window_id: foundationRuntimeCheckpoint.windowId,
            window_exists: true,
            observed_at: new Date(now()).toISOString(),
            requests: [],
            leases: [],
            unsettled_requests: 0,
            providers,
          };
        },
        readProvider: async ({ apifyRunId }) => {
          providerReads++;
          assert.equal(apifyRunId, original);
          return {
            body: {
              data: {
                id: original,
                actId: 'aYG0l9s7dbB7j3gbS',
                buildId: 'BdKJRCYsnmlzPfH3n',
                buildNumber: '0.3.99',
                status: 'SUCCEEDED',
                startedAt: iso(1),
                finishedAt: iso(2),
                defaultDatasetId: 'SyntheticDataset',
                usageTotalUsd: providerCost,
                options: { memoryMbytes: 1024, timeoutSecs: 300, maxTotalChargeUsd: 1 },
              },
            },
            transport: { requests: 1, retries: 0, socketsClosed: true, runBytesMax: 65536 },
          };
        },
      };
      configureSettlement?.(settlementPorts, context);
      ports.settlementReader = createFoundationSettlementReader(settlementPorts);
      // Native HTTP here is the base scripted in-memory route, never Cloud.
      assert.equal(typeof wire, 'function');
      beforeCreate?.(context);
    },
  });
  return {
    ...f,
    original,
    providerReads: () => providerReads,
    actorStarts: () => actorStarts,
    smoke: {
      caseId: 'smoke.first',
      workflowKey: 'WF-99',
      versionId: savedSmoke.versionId,
      caseReceipt: savedSmoke,
    },
  };
}

export async function verifyAndCleanPhaseB(f) {
  const cleanup = createFoundationNativeCleanup({
    reader: f.reader,
    transport: f.transport,
    journal: f.journal,
    admitControlAttempt: f.budget.admit,
    now: f.ports.now,
    deadlineAt: f.budget.snapshot().deadlineAt,
  });
  const results = [await f.controller.runCase(f.input)];
  for (let ordinal = 1; ordinal <= 4; ordinal++)
    results.push(await f.controller.runAutomaticErrorCase(ordinal));
  assert.equal(f.controller.snapshot().phaseBReady, false);
  for (const result of results) {
    assert.equal(result.state, 'native_settled');
    for (const receipt of f.controller.caseReceipts(result.caseId)) {
      const removed = await cleanup.cleanup({ receipt, closure: result.closure });
      assert.equal(removed.state, 'native_record_deleted');
      f.controller.recordCleanup(removed);
    }
  }
  assert.equal(f.controller.snapshot().phaseBReady, true);
  assert.equal(f.controller.snapshot().cleanedExecutionIds.length, 11);
  return cleanup;
}
