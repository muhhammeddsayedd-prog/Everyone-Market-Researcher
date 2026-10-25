import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { providerFixture, verifyAndCleanPhaseB } from './foundation-native-controller-fixtures.mjs';
import {
  createFoundationCallbackCases,
  consumeFoundationCallbackCase,
  foundationUnknownCallbackQuery,
} from './foundation-callback-cases.mjs';
import { gatewayOperationNodes } from '../../n8n/foundation/build-foundation-gateway.mjs';

// In-memory native HTTP/SQL fixtures. Real reader/settlement/control/cleanup and
// callback brands are exercised, but no actor, database RPC or Cloud is called.
const require = createRequire(import.meta.url);
const fixed = /FOUNDATION_NATIVE_CONTROL_BLOCKED/;
const secret = 'SYNTHETIC_NATIVE_CONTROL_PRIVATE_123456789';
function callbackFixture({ fault = null, unknownAbsent = true } = {}) {
  const callbackRequests = [],
    absenceQueries = [],
    auditRows = new Map();
  let context,
    firstProviderContext,
    activePosts = 0,
    maximumPosts = 0,
    secondStarts = 0,
    secondProviderReads = 0;
  let secondReceipt;
  const secondOriginal = 'SyntheticSecondOriginalRun';
  const f = providerFixture({
    configureSettlement(ports) {
      const read = ports.readGateway,
        provider = ports.readProvider;
      ports.readGateway = async (request) => {
        const result = await read(request);
        if (result.providers.length) firstProviderContext = structuredClone(result.providers[0]);
        if (request.params[2].includes('601')) {
          const row = structuredClone(firstProviderContext),
            run = '05555555-5555-4555-8555-555555555555';
          Object.assign(row, { execution_id: '601', scrape_execution_id: '606' });
          Object.assign(row.launch, { execution_id: '601', run_id: run, apify_run_id: secondOriginal });
          Object.assign(row.registry, { run_id: run, apify_run_id: secondOriginal });
          const saved = row.registry.processing_result;
          Object.assign(saved, {
            apify_run_id: secondOriginal,
            run_id: run,
            cost_keys: ['apify:' + secondOriginal + ':' + row.launch.account_id],
          });
          saved.run_summary.run_id = run;
          const samples = JSON.parse(request.params[3]);
          row.terminal_cost_match = samples.length ? samples[0].usage_usd === row.registry.usage_usd : null;
          result.providers = [row];
        }
        result.requests = request.params[1].map((requestId) => {
          const modeled = auditRows.get(requestId);
          assert.ok(modeled, 'only a modeled executed callback.reject may supply this SQL receipt');
          return {
            request_id: requestId,
            operation: modeled.operation,
            state: 'completed',
            read_started: false,
            completed_at: new Date(ports.now()).toISOString(),
          };
        });
        return result;
      };
      ports.readProvider = async (request) => {
        if (request.apifyRunId !== secondOriginal) return provider(request);
        secondProviderReads++;
        const baseline = await provider({ ...request, apifyRunId: 'SyntheticOriginalRun' });
        baseline.body.data.id = secondOriginal;
        return baseline;
      };
    },
    beforeCreate(c) {
      context = c;
      const { ports, save, bound, add, idFor, wire } = c;
      const operation = gatewayOperationNodes(
        'WF-19',
        'Record exact unknown rejection',
        {
          audience: 'https://everyone-market-researcher-scripted-callback.vercel.app',
          windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
          credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
        },
        'callback.reject',
        '({executionId:p[0],apifyRunId:p[1],reason:"unregistered"})',
        ['recorded', 'action'],
      );
      save('WF-19', [...bound.get('WF-19').body.nodes, ...operation.nodes], true);
      const nativeData = (traceparent, body) => ({
        resultData: {
          runData: {
            Webhook: [
              {
                data: { main: [[{ json: { headers: traceparent === null ? {} : { traceparent }, body } }]] },
              },
            ],
            'Validate callback source': [
              {
                data: {
                  main: [
                    [
                      {
                        json: {
                          apify_run_id: body.resource.id,
                          transport: 'webhook',
                          params: [body.resource.id],
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
      ports.callbackCases = createFoundationCallbackCases({
        now: ports.now,
        deadlineAt: ports.controlBudget.snapshot().deadlineAt,
        readUnknown: async (request) => {
          absenceQueries.push(request);
          assert.equal(request.query, foundationUnknownCallbackQuery);
          assert.deepEqual(request.params, []);
          return {
            apify_run_id: 'M03AcceptanceUnknown0001',
            registry_absent: unknownAbsent,
            launch_absent: unknownAbsent,
            observed_at: new Date(ports.now()).toISOString(),
          };
        },
      });
      ports.nativeTransport.callbackCase = async ({ wireCase }) => {
        const consumed = consumeFoundationCallbackCase(wireCase),
          body = JSON.parse(consumed.body);
        callbackRequests.push({
          caseId: wireCase.caseId,
          traceparent: consumed.traceparent,
          body,
          acknowledgementMode: wireCase.acknowledgementMode,
        });
        activePosts++;
        maximumPosts = Math.max(maximumPosts, activePosts);
        try {
          const id = String(900 + callbackRequests.length);
          let trace = consumed.traceparent;
          if (fault === 'missing_trace') trace = null;
          if (fault === 'duplicate_trace' && wireCase.caseId === 'callback.concurrent_b')
            trace = callbackRequests.find((r) => r.caseId === 'callback.concurrent_a').traceparent;
          const data = nativeData(trace, body);
          if (fault === 'reflected_trace')
            data.resultData.runData.Webhook[0].data.main[0][0].json.headers.traceparent = secret;
          if (wireCase.caseId === 'callback.unknown') {
            const prepared = Function(
              '$execution',
              '$input',
              'require',
              operation.nodes[0].parameters.jsCode,
            )({ id }, { all: () => [{ json: { params: [id, body.resource.id] } }] }, require)[0].json;
            data.resultData.runData[operation.nodes[0].name] = [{ data: { main: [[{ json: prepared }]] } }];
            auditRows.set(prepared.request.requestId, {
              operation: prepared.request.operation,
              apifyRunId: body.resource.id,
            });
          }
          if (fault !== 'old_id') add(id, 'WF-19', 'webhook', 'success', data);
          if (fault === 'ambiguous')
            add(String(1900 + callbackRequests.length), 'WF-19', 'webhook', 'success', data);
          if (fault === 'io_unknown') throw Error('SYNTHETIC_PRIVATE_HTTP_OUTCOME');
          await new Promise((resolve) => setImmediate(resolve));
          return wire(
            { accepted: wireCase.caseId !== 'callback.unknown' },
            wireCase.caseId === 'callback.unknown' ? 403 : 200,
          );
        } finally {
          activePosts--;
        }
      };
      const oldCase = ports.caseReceiptValidator,
        oldStart = ports.port.start;
      secondReceipt = Object.freeze({
        status: 'case_draft_verified',
        caseId: 'smoke.second',
        workflowId: idFor('WF-99'),
        versionId: bound.get('WF-99').versionId,
      });
      ports.caseReceiptValidator = (receipt) => (receipt === secondReceipt ? receipt : oldCase(receipt));
      ports.port.start = (args) => {
        if (args.workflowId !== idFor('WF-99') || !c.executions.has('501')) return oldStart(args);
        secondStarts++;
        const startNode = bound
          .get('WF-99')
          .body.nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflow');
        add('601', 'WF-99', 'manual', 'success', {
          resultData: {
            runData: {
              [startNode.name]: [
                { metadata: { subExecution: { executionId: '606', workflowId: idFor('SUB-START') } } },
              ],
            },
          },
        });
        add('606', 'SUB-START', 'integrated', 'success', {
          parentExecution: { executionId: '601', workflowId: idFor('WF-99'), shouldResume: true },
          resultData: { runData: {} },
        });
        add(
          '602',
          'WF-19',
          'webhook',
          'success',
          nativeData(null, { eventType: 'ACTOR.RUN.SUCCEEDED', resource: { id: secondOriginal } }),
        );
        return { status: 'started', executionId: '601' };
      };
    },
  });
  return {
    ...f,
    callbackRequests,
    absenceQueries,
    auditRows,
    maximumPosts: () => maximumPosts,
    secondStarts: () => secondStarts,
    secondProviderReads: () => secondProviderReads,
    secondSmoke: {
      caseId: 'smoke.second',
      workflowKey: 'WF-99',
      versionId: secondReceipt.versionId,
      caseReceipt: secondReceipt,
    },
    context: () => context,
  };
}

async function ready(f) {
  const cleanup = await verifyAndCleanPhaseB(f);
  const first = await f.controller.runCase(f.smoke);
  assert.equal(first.state, 'native_settled');
  return { cleanup, first };
}
async function remove(f, cleanup, result) {
  for (const receipt of f.controller.caseReceipts(result.caseId)) {
    const deleted = await cleanup.cleanup({ receipt, closure: result.closure });
    assert.equal(deleted.state, 'native_record_deleted');
    f.controller.recordCleanup(deleted);
  }
}

test('five existing callback POSTs correlate real traces/original proof; unknown403 and private ACK-drill remain distinct from business acceptance', async () => {
  const f = callbackFixture(),
    { cleanup, first } = await ready(f),
    results = [];
  results.push(await f.controller.runCallbackCase('callback.unknown'));
  results.push(await f.controller.runCallbackCase('callback.equal_replay'));
  results.push(await f.controller.runConcurrentCallbackCases());
  results.push(await f.controller.runCallbackCase('callback.recovery_drill'));
  for (const result of results) {
    assert.equal(result.state, 'native_settled');
    assert.equal(result.businessAcceptanceProven, false);
  }
  assert.equal(f.callbackRequests.length, 5);
  assert.equal(new Set(f.callbackRequests.map((r) => r.traceparent)).size, 5);
  assert.equal(f.maximumPosts(), 2);
  assert.equal(f.absenceQueries.length, 1);
  assert.equal(f.auditRows.size, 1);
  for (const request of f.callbackRequests.filter((r) => r.caseId !== 'callback.unknown'))
    assert.equal(request.body.resource.id, f.original);
  const pair = f.controller.caseReceipts('callback.concurrent_pair');
  assert.equal(pair.length, 2);
  assert.equal(new Set(pair.map((r) => r.traceparent)).size, 2);
  assert.deepEqual(
    new Set(pair.map((r) => r.traceparent)),
    new Set(
      f.callbackRequests.filter((r) => r.caseId.startsWith('callback.concurrent_')).map((r) => r.traceparent),
    ),
  );
  const unknown = f.controller.caseSettlement('callback.unknown');
  assert.deepEqual(unknown.gatewayRequestIds, [...f.auditRows.keys()]);
  assert.equal(
    f.rows.filter((r) => r.event === 'native_callback_intent' && r.kind === 'withhold_after_private_check')
      .length,
    1,
  );
  assert.equal(f.controller.caseReceipts('callback.recovery_drill').length, 1);
  assert.equal(f.actorStarts(), 1);
  assert.equal(f.providerReads(), 2);
  for (const result of [first, ...results]) await remove(f, cleanup, result);
  assert.equal(f.controller.snapshot().cleanedExecutionIds.length, 19);
  const posts = f.callbackRequests.length;
  await assert.rejects(f.controller.runCallbackCase('callback.recovery_drill'), fixed);
  assert.equal(f.callbackRequests.length, posts);
});

test('callbacks cannot borrow a first-original proof before the successful first smoke, and the second smoke is ordered', async () => {
  const f = callbackFixture();
  await verifyAndCleanPhaseB(f);
  await assert.rejects(f.controller.runCallbackCase('callback.equal_replay'), fixed);
  await assert.rejects(f.controller.runConcurrentCallbackCases(), fixed);
  await assert.rejects(f.controller.runCase(f.secondSmoke), fixed);
  assert.equal(f.callbackRequests.length, 0);
  assert.equal(f.actorStarts(), 0);
  assert.equal((await f.controller.runCase(f.smoke)).state, 'native_settled');
  const second = await f.controller.runCase(f.secondSmoke);
  assert.equal(second.state, 'native_settled');
  assert.equal(f.actorStarts(), 1);
  assert.equal(f.secondStarts(), 1);
  assert.equal(f.secondProviderReads(), 2);
  assert.deepEqual(second.executionIds, ['601', '606', '602']);
  await assert.rejects(f.controller.runCase(f.secondSmoke), fixed);
  assert.equal(f.secondStarts(), 1);
});

test('missing, reflected, ambiguous, old-ID and unknown-HTTP outcomes never authorize deletion or POST replay', async () => {
  for (const fault of ['missing_trace', 'reflected_trace', 'ambiguous', 'old_id', 'io_unknown']) {
    const f = callbackFixture({ fault }),
      { cleanup } = await ready(f);
    const deletes = f.calls.filter((r) => r.method === 'DELETE').length;
    const result = await f.controller.runCallbackCase('callback.equal_replay');
    assert.equal(result.state, 'native_unresolved', fault);
    assert.equal(f.controller.caseClosure(result.caseId), null);
    assert.equal(f.callbackRequests.length, 1);
    assert.equal(f.calls.filter((r) => r.method === 'DELETE').length, deletes);
    for (const receipt of f.controller.caseReceipts(result.caseId))
      await assert.rejects(cleanup.cleanup({ receipt, closure: result.closure }));
    await assert.rejects(f.controller.runCallbackCase('callback.equal_replay'), fixed);
    assert.equal(f.callbackRequests.length, 1);
    assert.equal(
      f.controller.caseReceipts(result.caseId).some((r) => r.executionId === '502'),
      false,
    );
    assert.equal(JSON.stringify(f.rows).includes(secret), false);
  }
});

test('concurrent callbacks require a trace bijection, and a non-absent unknown ID fails before its only wire attempt', async () => {
  const f = callbackFixture({ fault: 'duplicate_trace' });
  await ready(f);
  const deletes = f.calls.filter((r) => r.method === 'DELETE').length;
  const pair = await f.controller.runConcurrentCallbackCases();
  assert.equal(pair.state, 'native_unresolved');
  assert.equal(f.controller.caseClosure('callback.concurrent_pair'), null);
  assert.equal(f.callbackRequests.length, 2);
  assert.equal(f.calls.filter((r) => r.method === 'DELETE').length, deletes);
  await assert.rejects(f.controller.runConcurrentCallbackCases(), fixed);
  assert.equal(f.callbackRequests.length, 2);
  const g = callbackFixture({ unknownAbsent: false });
  await ready(g);
  assert.equal((await g.controller.runCallbackCase('callback.unknown')).state, 'native_unresolved');
  assert.equal(g.absenceQueries.length, 1);
  assert.equal(g.callbackRequests.length, 0);
});
