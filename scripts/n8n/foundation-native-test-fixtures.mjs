import { readFileSync } from 'node:fs';
import { createFoundationNativeReader } from './foundation-native-reader.mjs';
import { runtimeGraphHash } from './foundation-runtime-control.mjs';
import { gatewayOperationNodes } from '../../n8n/foundation/build-foundation-gateway.mjs';
import { foundationSmokeInput } from '../../n8n/foundation/build-foundation-smoke.mjs';

// Synthetic fixture creation only. Importing this file registers no test cases.
const bindings = JSON.parse(readFileSync(new URL('../../n8n/foundation/bindings.dev.json', import.meta.url)));
const epoch = Date.parse('2026-10-19T12:00:00.000Z'),
  iso = (delta = 0) => new Date(epoch + delta).toISOString();
export async function fixture({ provider = false, status = 'success', startParent = '101' } = {}) {
  let clock = epoch;
  const key = 'WF-99',
    id = '101',
    workflowId = bindings.workflowRefs[key].id;
  const operation = gatewayOperationNodes(
    key,
    'Read health',
    {
      audience: 'https://everyone-market-researcher-test.vercel.app',
      windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
      credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
    },
    'health.guard',
    '({})',
    ['stats_daily_enabled', 'cairo_yesterday'],
  );
  const prep = operation.nodes[0],
    code = prep.parameters.jsCode;
  const prepared = Function(
    '$execution',
    '$input',
    'require',
    code,
  )(
    { id },
    { all: () => [{ json: { params: [] } }] },
    (await import('node:module')).createRequire(import.meta.url),
  )[0].json;
  const body = {
    name: bindings.workflowRefs[key].name,
    nodes: operation.nodes,
    connections: operation.connections,
    settings: {
      saveManualExecutions: true,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveExecutionProgress: false,
    },
  };
  const startId = '102',
    startWorkflowId = bindings.workflowRefs['SUB-START'].id;
  if (provider)
    body.nodes = [
      ...body.nodes,
      {
        id: 'known-start',
        name: 'Known start',
        type: 'n8n-nodes-base.executeWorkflow',
        typeVersion: 1.4,
        position: [0, 0],
        parameters: { workflowId: { __rl: true, mode: 'id', value: startWorkflowId } },
      },
    ];
  const startBody = {
    name: bindings.workflowRefs['SUB-START'].name,
    nodes: [],
    connections: {},
    settings: {
      saveManualExecutions: false,
      saveDataSuccessExecution: 'all',
      saveDataErrorExecution: 'all',
      saveExecutionProgress: false,
    },
  };
  const startBinding = {
    workflowId: startWorkflowId,
    versionId: 'synthetic-start-version',
    activeVersionId: null,
    bodyHash: runtimeGraphHash(startBody),
    body: startBody,
  };
  const binding = {
    workflowId,
    versionId: 'synthetic-settlement-version',
    activeVersionId: null,
    bodyHash: runtimeGraphHash(body),
    body,
  };
  const metadata = {
    id,
    workflowId,
    workflowVersionId: binding.versionId,
    mode: 'manual',
    status,
    createdAt: iso(-21000),
    startedAt: iso(-20000),
    stoppedAt: status === 'waiting' ? null : iso(-1000),
    waitTill: status === 'waiting' ? iso(20000) : null,
  };
  const wire = (v) => ({
    status: 200,
    body: (async function* () {
      yield Buffer.from(JSON.stringify(v));
    })(),
    closed: Promise.resolve(),
  });
  const startMetadata = {
    ...metadata,
    id: startId,
    workflowId: startWorkflowId,
    workflowVersionId: startBinding.versionId,
    mode: 'integrated',
    status: 'success',
    stoppedAt: iso(-1500),
    waitTill: null,
  };
  const native = createFoundationNativeReader({
    bindings,
    transport: {
      request: async ({ path }) => {
        if (path.includes('/workflows/' + startWorkflowId))
          return wire({
            id: startWorkflowId,
            versionId: startBinding.versionId,
            activeVersionId: null,
            active: false,
            ...startBody,
          });
        if (path.includes('/executions/' + startId + '?'))
          return wire(
            path.endsWith('includeData=false')
              ? startMetadata
              : {
                  ...startMetadata,
                  workflowData: { id: startWorkflowId, activeVersionId: null, ...startBody },
                  data: {
                    parentExecution: { executionId: startParent, workflowId, shouldResume: true },
                    resultData: { runData: {} },
                  },
                },
          );
        return wire(
          path.includes('/workflows/')
            ? { id: workflowId, versionId: binding.versionId, activeVersionId: null, active: false, ...body }
            : path.endsWith('includeData=false')
              ? metadata
              : {
                  ...metadata,
                  workflowData: { id: workflowId, activeVersionId: null, ...body },
                  data: {
                    resultData: {
                      runData: {
                        [prep.name]: [{ data: { main: [[{ json: prepared }]] } }],
                        ...(provider
                          ? {
                              'Known start': [
                                {
                                  metadata: {
                                    subExecution: { executionId: startId, workflowId: startWorkflowId },
                                  },
                                },
                              ],
                            }
                          : {}),
                      },
                    },
                  },
                },
        );
      },
    },
    admitControlAttempt: () => {},
    now: () => clock,
    deadlineAt: epoch + 180000,
    sensitiveValues: ['SYNTHETIC_SETTLEMENT_PRIVATE_MARKER'],
    bindingValidator: (v) => v,
  });
  const receipt = await native.read({ workflowKey: key, executionId: id, binding });
  const receipts = [receipt];
  if (provider)
    receipts.push(
      await native.read({ workflowKey: 'SUB-START', executionId: startId, binding: startBinding }),
    );
  const account = '02222222-2222-4222-8222-222222222222',
    run = '01111111-1111-4111-8111-111111111111',
    original = 'SyntheticOriginalRun';
  const saved = {
    updated: true,
    finished_now: true,
    apify_run_id: original,
    run_id: run,
    account_ids: [account],
    status: 'SUCCEEDED',
    dataset_id: 'SyntheticDataset',
    cost_usd: 0.125,
    groups_sha256: 'a'.repeat(64),
    normalizer_version: 'smoke_website_stub.v1',
    cost_keys: ['apify:' + original + ':' + account],
    items_seen: 1,
    items_new: 0,
    new_item_ids: [],
    accounts_ok: 1,
    accounts_failed: 0,
    run_summary: {
      run_id: run,
      status: 'success',
      accounts_total: 1,
      accounts_ok: 1,
      accounts_failed: 0,
      items_seen: 1,
      items_new: 0,
      cost_usd: 0.125,
    },
  };
  const context = {
    execution_id: id,
    scrape_execution_id: startId,
    run_status: 'success',
    run_finished_at: iso(-1200),
    terminal_cost_match: null,
    launch: {
      window_id: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
      launch_id: '03333333-3333-4333-8333-333333333333',
      execution_id: id,
      run_id: run,
      account_id: account,
      actor_id: 'aYG0l9s7dbB7j3gbS',
      actor_build: '0.3.99',
      input: structuredClone(foundationSmokeInput),
      memory_mb: 1024,
      timeout_seconds: 300,
      max_total_charge_usd: 1,
      post_intent_at: iso(-19000),
      apify_run_id: original,
      reconciled_at: iso(-18000),
    },
    registry: {
      apify_run_id: original,
      actor_id: 'aYG0l9s7dbB7j3gbS',
      run_id: run,
      account_ids: [account],
      purpose: 'daily',
      processed_at: iso(-1500),
      status: 'SUCCEEDED',
      dataset_id: 'SyntheticDataset',
      usage_usd: 0.125,
      processing_result: saved,
    },
  };
  const snapshot = {
    window_id: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
    window_exists: true,
    observed_at: iso(),
    requests: receipt.nativeGatewayRequests.map((r) => ({
      request_id: r.requestId,
      operation: r.operation,
      state: 'completed',
      read_started: false,
      completed_at: iso(-1000),
    })),
    leases: [],
    unsettled_requests: 0,
    providers: provider ? [context] : [],
  };
  const providerBody = {
    data: {
      id: original,
      actId: 'aYG0l9s7dbB7j3gbS',
      buildId: 'BdKJRCYsnmlzPfH3n',
      buildNumber: '0.3.99',
      status: 'SUCCEEDED',
      startedAt: iso(-18500),
      finishedAt: iso(-2000),
      defaultDatasetId: 'SyntheticDataset',
      usageTotalUsd: 0.125,
      options: { memoryMbytes: 1024, timeoutSecs: 300, maxTotalChargeUsd: 1 },
    },
  };
  const calls = [],
    providerCalls = [];
  const ports = {
    readGateway: async (request) => {
      calls.push(request);
      const out = { ...structuredClone(snapshot), observed_at: new Date(clock).toISOString() };
      const samples = JSON.parse(request.params[3]);
      for (const p of out.providers) {
        const sample = samples.find((s) => s.apify_run_id === p.registry.apify_run_id);
        p.terminal_cost_match = sample ? sample.usage_usd === p.registry.usage_usd : null;
      }
      return out;
    },
    readProvider: async (request) => {
      providerCalls.push(request);
      return {
        body: structuredClone(providerBody),
        transport: { requests: 1, retries: 0, socketsClosed: true, runBytesMax: 65536 },
      };
    },
    transportSnapshot: () => ({
      pendingRequests: 0,
      unclosedResponses: 0,
      pendingProviderRequests: 0,
      pendingGatewayRequests: 0,
    }),
    now: () => clock,
    pause: async (ms) => {
      clock += ms;
    },
    deadlineAt: epoch + 180000,
  };
  return {
    receipt,
    receipts,
    ports,
    calls,
    providerCalls,
    snapshot,
    providerBody,
    context,
    original,
    setClock: (n) => {
      clock = n;
    },
  };
}
