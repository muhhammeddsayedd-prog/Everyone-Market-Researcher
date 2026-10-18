import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildHealthWorkflow } from './build-health.mjs';
import { buildSharedWorkflows } from './build-foundation.mjs';
import {
  foundationWorkflowNames,
  foundationTagNames,
  parseHealthInput,
} from '../../packages/shared/src/n8n-bindings.ts';

// Explicitly synthetic inputs; this module never creates a deployment manifest.
const binding = () => ({
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: Object.fromEntries(
    Object.entries(foundationWorkflowNames).map(([key, name], i) => [
      key,
      { id: `SyntheticHealthWorkflow${i}`, name },
    ]),
  ),
  tagRefs: Object.fromEntries(
    foundationTagNames.map((name, i) => [name, { id: `SyntheticHealthTag${i}`, name }]),
  ),
  credentials: {
    postgres: {
      id: 'SyntheticHealthWriter',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
  },
});
const named = (w, name) => w.nodes.find((n) => n.name === name);
function runCode(n, data, outputs = {}) {
  const value = runInNewContext(
    `(function(){${n.parameters.jsCode}\n})()`,
    {
      $input: { all: () => data },
      $execution: { id: 'SyntheticHealthExecution' },
      $: (name) => ({ first: () => ({ json: outputs[name] }) }),
    },
    { timeout: 1000 },
  );
  return JSON.parse(JSON.stringify(value));
}
const health = () => ({
  failing_accounts: [],
  stale_accounts: [],
  queues: { ai_extract: 0, embed: 0, media: 0 },
  items_new_yesterday: {},
  cost_yesterday: { total: 0, by_provider: {} },
  budget: { daily_budget_usd: 25, over_budget: false },
  month_to_date_usd: 0,
  forecast_month_usd: 0,
  workflow_errors_24h: {},
});

test('WF91 requires real bindings and emits only an inactive bounded dev blueprint', () => {
  assert.throws(() => buildHealthWorkflow(), /EMR_N8N_BINDINGS_INVALID/);
  const b = binding();
  delete b.workflowRefs['WF-80'];
  assert.throws(() => buildHealthWorkflow(b), /EMR_N8N_BINDING_MISSING/);
  const entry = buildHealthWorkflow(binding()),
    w = entry.workflow;
  assert.equal(entry.hostedAcceptance, false);
  assert.equal(w.name, foundationWorkflowNames['WF-91']);
  assert.equal(w.active, false);
  assert.equal(w.settings.executionTimeout, 900);
  assert.equal(w.settings.timezone, 'Africa/Cairo');
  assert.equal('id' in w, false);
  assert.equal(w.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger').length, 1);
  assert.ok(!w.nodes.some((n) => /httpRequest|scheduleTrigger|webhook/.test(n.type)));
  assert.deepEqual(
    named(w, 'When called').parameters.workflowInputs.values.map((v) => v.name),
    ['mode', 'limit', 'result_type', 'env'],
  );
});

test('WF91 Code and Zod boundaries agree and explicitly reject unsupported environments or modes', () => {
  const w = buildHealthWorkflow(binding()).workflow;
  for (const input of [
    {},
    { mode: 'daily', limit: 500, result_type: null, env: 'dev' },
    { mode: null, limit: null, result_type: null, env: null },
  ])
    assert.deepEqual(runCode(named(w, 'Validate dev input'), [{ json: input }]), [
      { json: parseHealthInput(input) },
    ]);
  for (const bad of [
    { mode: 'backfill' },
    { env: 'prod' },
    { limit: 1001 },
    { token: 'SYNTHETIC_PRIVATE_MARKER' },
  ]) {
    assert.throws(() => parseHealthInput(bad), /EMR_N8N_INPUT_INVALID/);
    assert.throws(() => runCode(named(w, 'Validate dev input'), [{ json: bad }]), /EMR_N8N_INPUT_INVALID/);
  }
});

test('WF91 uses explicit Cairo-day SQL and blocks unavailable stats refresh before any mutation', () => {
  const w = buildHealthWorkflow(binding()).workflow;
  const guard = named(w, 'Read health guard'),
    accrue = named(w, 'Accrue yesterday');
  assert.equal(
    guard.parameters.query,
    "select ops.get_setting('stats_daily_enabled') as stats_daily_enabled, ((now() at time zone 'Africa/Cairo')::date - 1)::text as cairo_yesterday;",
  );
  assert.equal(accrue.parameters.query, 'select ops.accrue_fixed_costs($1::date) as accrued;');
  assert.equal(
    accrue.parameters.options.queryReplacement,
    "={{ [$('Validate health guard').first().json.cairo_yesterday] }}",
  );
  const check = named(w, 'Validate health guard');
  const value = runCode(check, [{ json: { stats_daily_enabled: false, cairo_yesterday: '2026-10-17' } }])[0]
    .json;
  assert.equal(value.execution_id, 'SyntheticHealthExecution');
  for (const invalid of [
    { stats_daily_enabled: null, cairo_yesterday: '2026-10-17' },
    { stats_daily_enabled: false, cairo_yesterday: 'invalid' },
  ])
    assert.throws(() => runCode(check, [{ json: invalid }]), /EMR_N8N_HEALTH_INVALID/);
  assert.throws(
    () => runCode(named(w, 'Stats refresh unavailable'), [{ json: {} }]),
    /EMR_N8N_STATS_REFRESH_UNAVAILABLE/,
  );
  assert.ok(!w.nodes.some((n) => n.parameters.query?.includes('refresh_stats_daily')));
  assert.equal(w.connections['Stats refresh enabled?'].main[0][0].node, 'Stats refresh unavailable');
});

test('WF91 health validation rejects missing/malformed fields and a Cairo-midnight boundary change', () => {
  const w = buildHealthWorkflow(binding()).workflow,
    n = named(w, 'Validate daily health');
  const outputs = {
    'Validate health guard': { cairo_yesterday: '2026-10-17', execution_id: 'SyntheticHealthExecution' },
    'Accrue yesterday': { accrued: 0 },
  };
  const result = runCode(n, [{ json: { h: health(), cairo_yesterday: '2026-10-17' } }], outputs)[0].json;
  assert.deepEqual(result.health, health());
  assert.equal(result.over_budget, false);
  assert.equal(result.has_failing_sources, false);
  for (const bad of [
    { h: health(), cairo_yesterday: '2026-10-18' },
    { h: { ...health(), queues: { ai_extract: -1, embed: 0, media: 0 } }, cairo_yesterday: '2026-10-17' },
    {
      h: { ...health(), budget: { daily_budget_usd: 25, over_budget: 'false' } },
      cairo_yesterday: '2026-10-17',
    },
    { h: { ...health(), cost_yesterday: { total: NaN, by_provider: {} } }, cairo_yesterday: '2026-10-17' },
    { h: { ...health(), forecast_month_usd: undefined }, cairo_yesterday: '2026-10-17' },
  ])
    assert.throws(() => runCode(n, [{ json: bad }], outputs), /EMR_N8N_HEALTH_INVALID/);
});

test('WF91 local graph dispatches bounded alert stubs and distinct log-only notifications, then publishes stats', () => {
  const b = binding(),
    w = buildHealthWorkflow(b).workflow;
  const notifyTrigger = buildSharedWorkflows(b)
    .find((x) => x.key === 'SUB-NOTIFY')
    .workflow.nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  for (const overBudget of [false, true])
    for (const failing of [false, true]) {
      const outputs = {},
        calls = [],
        h = health();
      h.budget.over_budget = overBudget;
      if (failing)
        h.failing_accounts = [
          {
            account_id: '10000000-0000-4000-8000-000000000001',
            competitor: 'Synthetic public competitor',
            platform: 'vimeo',
            handle: 'synthetic',
            last_error: 'SYNTHETIC_PRIVATE_MARKER',
            consecutive_failures: 3,
          },
        ];
      let next = 'When called',
        data = [{ json: { mode: 'manual', env: 'dev' } }],
        steps = 0;
      const evaluate = (v) =>
        typeof v === 'string' && v.startsWith('={{')
          ? runInNewContext(
              v.slice(3, -2),
              { $json: data[0]?.json, $: (name) => ({ first: () => ({ json: outputs[name] }) }) },
              { timeout: 1000 },
            )
          : v;
      while (next) {
        assert.ok(++steps < 40, 'graph terminates');
        const n = named(w, next);
        let branch = 0;
        if (n.type === 'n8n-nodes-base.code') data = runCode(n, data, outputs);
        else if (n.type === 'n8n-nodes-base.postgres')
          data = [
            {
              json:
                n.name === 'Read health guard'
                  ? { stats_daily_enabled: false, cairo_yesterday: '2026-10-17' }
                  : n.name === 'Accrue yesterday'
                    ? { accrued: 0 }
                    : { h, cairo_yesterday: '2026-10-17' },
            },
          ];
        else if (n.type === 'n8n-nodes-base.if')
          branch = evaluate(n.parameters.conditions.conditions[0].leftValue) ? 0 : 1;
        else if (n.type === 'n8n-nodes-base.executeWorkflow') {
          const values = Object.fromEntries(
            Object.entries(n.parameters.workflowInputs.value).map(([k, v]) => [k, evaluate(v)]),
          );
          calls.push({ id: n.parameters.workflowId.value, values });
          if (n.name.includes('log'))
            assert.deepEqual(
              n.parameters.workflowInputs.schema.map((s) => s.id),
              notifyTrigger.parameters.workflowInputs.values.map((v) => v.name),
            );
          assert.ok(!JSON.stringify(values).includes('SYNTHETIC_PRIVATE_MARKER'));
          data = [{ json: { stub: true } }];
        }
        outputs[next] = data[0]?.json;
        const edges = w.connections[next]?.main[branch] ?? [];
        assert.ok(edges.length <= 1);
        next = edges[0]?.node;
      }
      assert.deepEqual(data, [
        {
          json: {
            health: h,
            accrued: 0,
            cairo_yesterday: '2026-10-17',
            notification_mode: 'log',
            sent: false,
          },
        },
      ]);
      const alertCalls = calls.filter((c) => c.id === b.workflowRefs['WF-80'].id);
      assert.deepEqual(
        alertCalls.map((c) => c.values.kind),
        [...(overBudget ? ['budget'] : []), ...(failing ? ['failing_sources'] : [])],
      );
      const logs = calls.filter((c) => c.id === b.workflowRefs['SUB-NOTIFY'].id);
      assert.deepEqual(
        logs.map((c) => c.values.execution_id),
        [
          ...(overBudget ? ['SyntheticHealthExecution-budget'] : []),
          ...(failing ? ['SyntheticHealthExecution-failing'] : []),
          'SyntheticHealthExecution-health',
        ],
      );
      assert.equal(new Set(logs.map((c) => c.values.execution_id)).size, logs.length);
      const publish = calls.filter((c) => c.id === b.workflowRefs['WF-70'].id);
      assert.equal(publish.length, 1);
      assert.deepEqual(publish[0].values.tags, ['stats']);
    }
});
