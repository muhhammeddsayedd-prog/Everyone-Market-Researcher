import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import {
  buildCollectorStubs,
  buildSharedWorkflows,
  buildErrorHandler,
  collectorStubSpecs,
} from './build-foundation.mjs';
import { parseCollectorStubInput, foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';

// These IDs are synthetic unit inputs, never saved as deployment bindings.
const bindings = () => ({
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: { 'WF-90': { id: 'SyntheticWf90Id', name: 'WF-90 · Error handler [dev]' } },
  tagRefs: Object.fromEntries(
    [
      'env:dev',
      'layer:collector',
      'layer:ai',
      'layer:ops',
      'platform:vimeo',
      'platform:instagram',
      'platform:instagram_stories',
      'platform:youtube',
      'platform:linkedin',
      'platform:linkedin_employees',
      'platform:website_work_page',
      'platform:news',
    ].map((name, index) => [name, { id: `SyntheticTag${index}`, name }]),
  ),
});

function runCode(node, data, context = {}) {
  const result = runInNewContext(
    `(function(){${node.parameters.jsCode}\n})()`,
    {
      $input: { all: () => data },
      $execution: { id: 'SyntheticExecution99' },
      ...context,
    },
    { timeout: 1000 },
  );
  return JSON.parse(JSON.stringify(result));
}

test('requires actual bindings rather than producing placeholder deployment IDs', () => {
  assert.throws(() => buildCollectorStubs(), /^Error: EMR_N8N_BINDINGS_INVALID$/);
  assert.throws(
    () => buildCollectorStubs({ ...bindings(), workflowRefs: {} }),
    /^Error: EMR_N8N_BINDING_MISSING$/,
  );
  assert.throws(
    () => buildCollectorStubs({ ...bindings(), tagRefs: {} }),
    /^Error: EMR_N8N_BINDING_MISSING$/,
  );
});

test('builds exactly the fifteen T8 stubs using observed node versions', () => {
  const result = buildCollectorStubs(bindings());
  assert.deepEqual(
    result.map((x) => x.key),
    [
      'WF-10',
      'WF-11',
      'WF-12',
      'WF-13',
      'WF-18',
      'WF-18b',
      'WF-21',
      'WF-22',
      'WF-23',
      'WF-30',
      'WF-32',
      'WF-40',
      'WF-50',
      'WF-70',
      'WF-80',
    ],
  );
  const probe = JSON.parse(
    readFileSync(
      new URL('../../milestones/M03-n8n-foundation/evidence/sanitizedprobe.json', import.meta.url),
      'utf8',
    ).replace(/^\uFEFF/, ''),
  );
  const observed = new Map(probe.nodes.map((n) => [n.type, n.typeVersion]));
  for (const entry of result) {
    const w = entry.workflow;
    assert.equal(w.active, false);
    assert.equal(w.settings.timezone, 'Africa/Cairo');
    assert.equal(w.settings.executionTimeout, 900);
    assert.equal(w.settings.errorWorkflow, 'SyntheticWf90Id');
    assert.equal('id' in w, false);
    assert.deepEqual(w.pinData, {});
    assert.ok(w.tags.some((t) => t.name === 'env:dev'));
    for (const n of w.nodes) assert.equal(n.typeVersion, observed.get(n.type));
    assert.equal(w.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger').length, 1);
    const trigger = w.nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
    assert.equal(trigger.parameters.inputSource, 'workflowInputs');
    assert.deepEqual(
      trigger.parameters.workflowInputs.values.map((x) => x.name),
      [
        'mode',
        'limit',
        'result_type',
        'env',
        ...(entry.key === 'WF-70' ? ['tags'] : []),
        ...(entry.key === 'WF-80' ? ['kind'] : []),
      ],
    );
    const set = w.nodes.find((n) => n.type === 'n8n-nodes-base.set');
    assert.equal(set.parameters.includeOtherFields, false);
    assert.deepEqual(
      set.parameters.assignments.assignments.map((x) => x.name),
      ['stub', 'workflow', 'received'],
    );
    assert.equal(set.parameters.assignments.assignments[0].value, true);
    assert.equal(set.parameters.assignments.assignments[1].value, entry.key);
    assert.equal(set.parameters.assignments.assignments[2].value, '={{ $json }}');
    assert.ok(!w.nodes.some((n) => /postgres|httpRequest|scheduleTrigger|webhook/.test(n.type)));
  }
});

test('stub input Code nodes accept manual defaults and preserve bounded declared inputs', () => {
  for (const { key, workflow } of buildCollectorStubs(bindings())) {
    const code = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.code');
    assert.deepEqual(runCode(code, [{ json: {} }]), [{ json: parseCollectorStubInput(key, {}) }]);
    assert.deepEqual(
      runCode(code, [{ json: { mode: 'daily', limit: 500, result_type: 'posts', env: 'dev' } }]),
      [
        {
          json: parseCollectorStubInput(key, { mode: 'daily', limit: 500, result_type: 'posts', env: 'dev' }),
        },
      ],
    );
    for (const bad of [
      { env: 'prod' },
      { env: '' },
      { limit: 0 },
      { limit: 1001 },
      { limit: '5' },
      { mode: 'unknown' },
      { result_type: 'x'.repeat(65) },
      { password: 'SYNTHETIC_PRIVATE_MARKER' },
    ]) {
      assert.throws(() => runCode(code, [{ json: bad }]), /^Error: EMR_N8N_INPUT_INVALID$/);
    }
    assert.throws(() => runCode(code, [{ json: {} }, { json: {} }]), /^Error: EMR_N8N_INPUT_INVALID$/);
  }
});

test('all edges and node IDs are deterministic, unique and refer to real nodes', () => {
  const first = buildCollectorStubs(bindings());
  assert.deepEqual(first, buildCollectorStubs(bindings()));
  const ids = new Set();
  for (const { workflow } of first) {
    const names = new Set(workflow.nodes.map((n) => n.name));
    for (const n of workflow.nodes) {
      assert.equal(ids.has(n.id), false);
      ids.add(n.id);
    }
    for (const [source, outputs] of Object.entries(workflow.connections)) {
      assert.ok(names.has(source));
      for (const branch of outputs.main)
        for (const edge of branch) {
          assert.ok(names.has(edge.node));
          assert.equal(edge.type, 'main');
          assert.equal(edge.index, 0);
        }
    }
  }
  assert.equal(collectorStubSpecs.length, 15);
});

function fullBindings() {
  const b = bindings();
  b.tagRefs['layer:sub'] = { id: 'SyntheticSubTag', name: 'layer:sub' };
  b.workflowRefs = Object.fromEntries(
    Object.entries(foundationWorkflowNames).map(([key, name], i) => [
      key,
      { id: `SyntheticWorkflow${i}`, name },
    ]),
  );
  b.credentials = {
    postgres: {
      id: 'SyntheticWriterId',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
  };
  return b;
}
const codeNamed = (w, name) => w.nodes.find((n) => n.name === name);
const refs = (values) => ({ $: (name) => ({ first: () => ({ json: values[name] }) }) });
const summary = {
  run_id: '10000000-0000-4000-8000-000000000001',
  status: 'success',
  accounts_total: 1,
  accounts_ok: 1,
  accounts_failed: 0,
  items_seen: 1,
  items_new: 1,
  cost_usd: 0.01,
};
const completion = () => ({
  updated: true,
  finished_now: true,
  apify_run_id: 'SyntheticActorRun',
  run_id: summary.run_id,
  account_ids: ['10000000-0000-4000-8000-000000000002'],
  status: 'SUCCEEDED',
  dataset_id: 'SyntheticDataset',
  cost_usd: 0.01,
  groups_sha256: 'a'.repeat(64),
  normalizer_version: 'smoke_website_stub.v1',
  cost_keys: ['apify:SyntheticActorRun:10000000-0000-4000-8000-000000000002'],
  items_seen: 1,
  items_new: 1,
  new_item_ids: ['10000000-0000-4000-8000-000000000003'],
  accounts_ok: 1,
  accounts_failed: 0,
  run_summary: summary,
});

test('WF70 tags and WF80 kind survive declared native trigger and Zod boundaries', () => {
  for (const [key, extra] of [
    ['WF-70', { tags: ['feed', 'stats'] }],
    ['WF-80', { kind: 'budget' }],
  ]) {
    const w = buildCollectorStubs(bindings()).find((x) => x.key === key).workflow;
    assert.deepEqual(
      runCode(codeNamed(w, 'Validate dev input'), [{ json: extra }])[0].json,
      parseCollectorStubInput(key, extra),
    );
  }
  assert.throws(() => parseCollectorStubInput('WF-70', { tags: ['not safe'] }), /EMR_N8N_INPUT_INVALID/);
  assert.throws(() => parseCollectorStubInput('WF-80', { kind: 'unsupported' }), /EMR_N8N_INPUT_INVALID/);
});

test('shared workflows bind only the restricted dev credential and parameterized RPCs', () => {
  assert.throws(() => buildSharedWorkflows(bindings()), /EMR_N8N_BINDING_MISSING/);
  const all = buildSharedWorkflows(fullBindings());
  assert.deepEqual(
    all.map((x) => x.key),
    ['SUB-START', 'SUB-FINISH', 'SUB-INGEST', 'SUB-COST', 'SUB-NOTIFY'],
  );
  for (const { workflow: w } of all)
    for (const n of w.nodes.filter((x) => x.type === 'n8n-nodes-base.postgres')) {
      assert.equal(n.credentials.postgres.id, 'SyntheticWriterId');
      assert.equal(n.parameters.operation, 'executeQuery');
      const expectedQueries = {
        'Start run': 'select ops.start_run($1, $2::app.platform, $3, $4, $5) as run_id;',
        'Log costs': 'select ops.log_cost($1::jsonb) as inserted;',
        'Persist atomic callback': 'select ops.process_apify_run($1, $2, $3, $4::numeric, $5::jsonb) as r;',
        'Log notification': 'select ops.log_workflow_error($1::jsonb) as logged;',
        'Finish run':
          "select case when $4::text is null then ops.finish_run($1::uuid, $2, $3) else ops.get_apify_run($4)->'processing_result'->'run_summary' end as r, case when $4::text is null then null::jsonb else ops.get_apify_run($4)->'processing_result' end as durable;",
      };
      assert.equal(n.parameters.query, expectedQueries[n.name]);
      assert.ok(!n.parameters.query.includes('{{'));
      if (n.name === 'Start run') {
        assert.equal(n.retryOnFail, false);
        assert.equal('maxTries' in n, false);
        assert.equal('waitBetweenTries' in n, false);
      } else {
        assert.equal(n.retryOnFail, true);
        assert.equal(n.maxTries, 3);
        assert.equal(n.waitBetweenTries, 5000);
      }
    }
});

test('Start preserves nullable platform and takes execution ID from native context', () => {
  const w = buildSharedWorkflows(fullBindings())[0].workflow;
  const actual = runCode(codeNamed(w, 'Prepare start'), [
    { json: { workflow: 'WF-99', platform: null, mode: 'manual', env: 'dev' } },
  ]);
  assert.deepEqual(actual, [{ json: { params: ['WF-99', null, 'manual', 'dev', 'SyntheticExecution99'] } }]);
  assert.throws(
    () =>
      runCode(codeNamed(w, 'Prepare start'), [
        { json: { workflow: 'WF-99', platform: null, mode: 'manual', env: 'prod' } },
      ]),
    /EMR_N8N_INPUT_INVALID/,
  );
});

test('Cost validates finite nonnegative entries and serializes one bound JSON parameter', () => {
  const w = buildSharedWorkflows(fullBindings()).find((x) => x.key === 'SUB-COST').workflow;
  const entry = {
    provider: 'other',
    category: 'fixture',
    quantity: 1,
    unit: 'result',
    cost_usd: 0.01,
    meta: { cost_key: 'synthetic-cost' },
  };
  assert.deepEqual(runCode(codeNamed(w, 'Prepare costs'), [{ json: { entries: [entry] } }]), [
    { json: { params: [JSON.stringify([entry])] } },
  ]);
  for (const changes of [
    { cost_usd: NaN },
    { cost_usd: -0.0000001 },
    { quantity: Infinity },
    { meta: {} },
    {
      meta: {
        cost_key: 'synthetic-cost',
        request: { headers: { authorization: 'SYNTHETIC_PRIVATE_MARKER' } },
      },
    },
    { meta: { cost_key: 'synthetic-cost', client_secret: 'SYNTHETIC_PRIVATE_MARKER' } },
    { meta: { cost_key: 'synthetic-cost', actor: { name: 'synthetic' } } },
    { meta: { cost_key: 'synthetic-cost', account_id: 'not-a-uuid' } },
    { provider: 'unsupported' },
  ])
    assert.throws(
      () => runCode(codeNamed(w, 'Prepare costs'), [{ json: { entries: [{ ...entry, ...changes }] } }]),
      /EMR_N8N_INPUT_INVALID/,
    );
});

test('Ingest calls only the atomic bounded callback RPC and returns its durable receipt', () => {
  const w = buildSharedWorkflows(fullBindings()).find((x) => x.key === 'SUB-INGEST').workflow;
  const prepare = codeNamed(w, 'Prepare atomic callback');
  const group = {
    account_id: completion().account_ids[0],
    items: [],
    normalizer_version: 'smoke_website_stub.v1',
  };
  const input = {
    apify_run_id: 'SyntheticActorRun',
    status: 'SUCCEEDED',
    dataset_id: 'SyntheticDataset',
    usage_usd: 0.01,
    groups: [group],
    env: 'dev',
  };
  assert.deepEqual(runCode(prepare, [{ json: input }]), [
    {
      json: {
        params: [
          input.apify_run_id,
          input.status,
          input.dataset_id,
          input.usage_usd,
          JSON.stringify(input.groups),
        ],
      },
    },
  ]);
  const failed = { ...input, status: 'FAILED', dataset_id: null };
  assert.equal(runCode(prepare, [{ json: failed }])[0].json.params[1], 'FAILED');
  for (const changes of [
    { env: 'prod' },
    { status: 'RUNNING' },
    { usage_usd: -0.0000001 },
    { usage_usd: NaN },
    { groups: [] },
    { groups: [group, group] },
    { groups: [{ ...group, normalizer_version: 'future.v1' }] },
    { groups: [{ ...group, items: [{}, {}] }] },
    { status: 'FAILED', groups: [{ ...group, items: [{}] }] },
    { dataset_id: '' },
    { password: 'SYNTHETIC_PRIVATE_MARKER' },
  ])
    assert.throws(() => runCode(prepare, [{ json: { ...input, ...changes } }]), /EMR_N8N_INPUT_INVALID/);
  assert.throws(() => runCode(prepare, [{ json: input }, { json: input }]), /EMR_N8N_INPUT_INVALID/);
  const queries = w.nodes.filter((n) => n.type === 'n8n-nodes-base.postgres');
  assert.equal(queries.length, 1);
  assert.ok(
    !/upsert_items|report_account_result|log_cost|complete_apify_run/.test(queries[0].parameters.query),
  );
  assert.deepEqual(runCode(codeNamed(w, 'Return durable callback'), [{ json: { r: completion() } }]), [
    { json: completion() },
  ]);
  assert.throws(
    () => runCode(codeNamed(w, 'Return durable callback'), [{ json: { r: null } }]),
    /EMR_N8N_COMPLETION_INVALID/,
  );
});

test('Notify is log-only and drops message, HTML, recipients and stack from the audit parameter', () => {
  const w = buildSharedWorkflows(fullBindings()).find((x) => x.key === 'SUB-NOTIFY').workflow;
  const result = runCode(codeNamed(w, 'Prepare notification'), [
    {
      json: {
        to: ['mohamed.abdelrahman@everyone.film'],
        subject: 'SYNTHETIC_PRIVATE_MARKER',
        html: 'SYNTHETIC_PRIVATE_MARKER',
        text: 'SYNTHETIC_PRIVATE_MARKER',
        workflow: 'WF-19',
        execution_id: 'SyntheticOrigin',
      },
    },
  ]);
  const audit = JSON.parse(result[0].json.params[0]);
  assert.deepEqual(audit, {
    kind: 'notify',
    workflow: 'WF-19',
    execution_id: 'SyntheticOrigin',
    node: 'Notify',
    message: 'notify_threshold_reached',
  });
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_MARKER'));
  assert.ok(!w.nodes.some((n) => /email|httpRequest/i.test(n.type)));
  assert.deepEqual(runCode(codeNamed(w, 'Return notification'), [{ json: { logged: null } }]), [
    { json: { mode: 'log', logged: true, sent: false } },
  ]);
});

test('Finish dispatches only for a matching first atomic completion and always returns its summary', () => {
  const w = buildSharedWorkflows(fullBindings()).find((x) => x.key === 'SUB-FINISH').workflow;
  const prepare = codeNamed(w, 'Prepare finish');
  const check = codeNamed(w, 'Validate completion');
  for (const [receipt, dispatch] of [
    [null, false],
    [completion(), true],
    [{ ...completion(), updated: false, finished_now: false }, false],
  ]) {
    const prepared = runCode(prepare, [
      { json: { run_id: summary.run_id, status: 'success', error: null, completion: receipt } },
    ])[0].json;
    assert.deepEqual(prepared.params, [summary.run_id, 'success', null, receipt?.apify_run_id ?? null]);
    const result = runCode(
      check,
      [{ json: { r: summary, durable: receipt ? completion() : null } }],
      refs({ 'Prepare finish': prepared }),
    )[0].json;
    assert.equal(result.dispatch_ai, dispatch);
    assert.equal(result.dispatch_publish, dispatch);
    assert.deepEqual(result.summary, summary);
  }
  const prepared = runCode(prepare, [
    {
      json: {
        run_id: summary.run_id,
        status: 'success',
        completion: { ...completion(), run_summary: { ...summary, items_new: 0 } },
      },
    },
  ])[0].json;
  assert.throws(
    () =>
      runCode(check, [{ json: { r: summary, durable: completion() } }], refs({ 'Prepare finish': prepared })),
    /EMR_N8N_COMPLETION_INVALID/,
  );
  const validPrepared = runCode(prepare, [
    { json: { run_id: summary.run_id, status: 'success', completion: completion() } },
  ])[0].json;
  for (const durable of [
    null,
    { ...completion(), groups_sha256: 'b'.repeat(64) },
    { ...completion(), updated: false, finished_now: false },
  ])
    assert.throws(
      () => runCode(check, [{ json: { r: summary, durable } }], refs({ 'Prepare finish': validPrepared })),
      /EMR_N8N_COMPLETION_INVALID/,
    );
  assert.throws(
    () =>
      runCode(prepare, [
        {
          json: {
            run_id: summary.run_id,
            status: 'success',
            error: 'apify_failed',
            completion: completion(),
          },
        },
      ]),
    /EMR_N8N_INPUT_INVALID/,
  );
  assert.throws(
    () =>
      runCode(prepare, [
        {
          json: {
            run_id: summary.run_id,
            status: 'success',
            completion: { ...completion(), run_summary: undefined },
          },
        },
      ]),
    /EMR_N8N_INPUT_INVALID/,
  );
  for (const n of w.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow')) {
    assert.equal(n.parameters.options.waitForSubWorkflow, false);
    assert.equal(n.parameters.mode, 'once');
    assert.equal(n.parameters.workflowInputs.mappingMode, 'defineBelow');
  }
});

test('WF90 attributes only bound workflow IDs, never raw provider messages or invented run correlation', () => {
  const b = fullBindings(),
    { workflow: w } = buildErrorHandler(b);
  assert.equal('errorWorkflow' in w.settings, false);
  const classify = codeNamed(w, 'Classify error');
  const payload = {
    workflow: { id: b.workflowRefs['WF-19'].id, name: 'SYNTHETIC_PRIVATE_MARKER' },
    execution: {
      id: 'SyntheticFailed99',
      error: { message: 'SYNTHETIC_PRIVATE_MARKER', stack: 'SYNTHETIC_PRIVATE_MARKER' },
      lastNodeExecuted: 'SYNTHETIC_PRIVATE_MARKER',
    },
  };
  const result = runCode(classify, [{ json: payload }])[0].json;
  assert.equal(result.workflow, 'WF-19');
  const audit = JSON.parse(result.params[0]);
  assert.equal(audit.message, 'callback_retryable');
  assert.equal(audit.node, 'Workflow');
  assert.equal('run_id' in audit, false);
  assert.equal('stack' in audit, false);
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_MARKER'));
  assert.throws(
    () => runCode(classify, [{ json: { ...payload, workflow: { id: 'UnrelatedWorkflow' } } }]),
    /EMR_N8N_ERROR_SOURCE_UNKNOWN/,
  );
  const gate = codeNamed(w, 'Prepare threshold notification');
  assert.deepEqual(runCode(gate, [{ json: { error_count: 0 } }], refs({ 'Classify error': result })), []);
  assert.equal(
    runCode(gate, [{ json: { error_count: 3 } }], refs({ 'Classify error': result }))[0].json.workflow,
    'WF-19',
  );
  const query = w.nodes.find((n) => n.parameters.query?.includes('error_count_24h'));
  assert.ok(query.parameters.query.includes('$2'));
  assert.ok(query.parameters.options.queryReplacement.includes('true'));
  assert.equal(query.retryOnFail, false);
  assert.equal('maxTries' in query, false);
  const log = w.nodes.find((n) => n.name === 'Log classified error');
  assert.equal(log.retryOnFail, true);
  assert.equal(log.maxTries, 3);
});

test('WF90 activation failures use the actual handler execution without fabricating a source execution', () => {
  const b = fullBindings(),
    w = buildErrorHandler(b).workflow,
    classify = codeNamed(w, 'Classify error');
  const payload = {
    workflow: { id: b.workflowRefs['WF-00'].id },
    trigger: { error: { message: 'SYNTHETIC_PRIVATE_MARKER', stack: 'SYNTHETIC_PRIVATE_MARKER' } },
  };
  const r = runCode(classify, [{ json: payload }])[0].json;
  const audit = JSON.parse(r.params[0]);
  assert.equal(audit.execution_id, 'handler-SyntheticExecution99');
  assert.equal(audit.node, 'Trigger activation');
  assert.equal(audit.message, 'workflow_failed');
  assert.equal('run_id' in audit, false);
  assert.ok(!JSON.stringify(r).includes('SYNTHETIC_PRIVATE_MARKER'));
  assert.throws(
    () => runCode(classify, [{ json: payload }], { $execution: { id: null } }),
    /EMR_N8N_ERROR_CORRELATION_UNAVAILABLE/,
  );
  assert.throws(
    () => runCode(classify, [{ json: { workflow: payload.workflow } }]),
    /EMR_N8N_ERROR_CORRELATION_UNAVAILABLE/,
  );
});

test('Finish graph follows both branch outcomes and returns one summary after zero or two dispatches', () => {
  const b = fullBindings(),
    w = buildSharedWorkflows(b).find((x) => x.key === 'SUB-FINISH').workflow;
  for (const receipt of [null, completion(), { ...completion(), updated: false, finished_now: false }]) {
    const outputs = {},
      calls = [],
      seen = [];
    let data = [{ json: { run_id: summary.run_id, status: 'success', completion: receipt } }];
    let next = 'When called';
    while (next) {
      assert.ok(seen.length < 20, 'graph terminates');
      seen.push(next);
      const n = codeNamed(w, next);
      let branch = 0;
      const context = { ...refs(outputs), $json: data[0]?.json };
      if (n.type === 'n8n-nodes-base.code') data = runCode(n, data, context);
      else if (n.type === 'n8n-nodes-base.postgres')
        data = [{ json: { r: summary, durable: receipt ? completion() : null } }];
      else if (n.type === 'n8n-nodes-base.if') {
        const expression = n.parameters.conditions.conditions[0].leftValue;
        const passed = runInNewContext(expression.slice(3, -2), context, { timeout: 1000 });
        assert.equal(typeof passed, 'boolean');
        branch = passed ? 0 : 1;
      } else if (n.type === 'n8n-nodes-base.executeWorkflow') {
        calls.push(n.parameters.workflowId.value);
        data = [{ json: { stub: true } }];
      }
      outputs[next] = data[0]?.json;
      const edges = w.connections[next]?.main[branch] ?? [];
      assert.ok(edges.length <= 1, 'bounded graph has a single next edge');
      next = edges[0]?.node;
    }
    assert.deepEqual(data, [{ json: summary }]);
    assert.deepEqual(
      calls,
      receipt?.finished_now ? [b.workflowRefs['WF-30'].id, b.workflowRefs['WF-70'].id] : [],
    );
    assert.equal(seen.filter((x) => x === 'Return summary').length, 1);
  }
});
