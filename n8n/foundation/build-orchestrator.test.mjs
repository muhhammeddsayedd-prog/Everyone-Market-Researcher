import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildOrchestrator } from './build-orchestrator.mjs';
import { foundationWorkflowNames } from '../../packages/shared/src/n8n-bindings.ts';
import { dispatchSlot, scheduledSlots } from '../../packages/shared/src/n8n-schedule.ts';

// Explicit synthetic unit inputs; never persisted as hosted bindings/exports.
const bindings = () => ({
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: Object.fromEntries(
    Object.entries(foundationWorkflowNames).map(([key, name], i) => [
      key,
      { id: `SyntheticWorkflow${i}`, name },
    ]),
  ),
  tagRefs: Object.fromEntries(
    ['env:dev', 'layer:ops'].map((name, i) => [name, { id: `SyntheticTag${i}`, name }]),
  ),
  credentials: {
    postgres: {
      id: 'SyntheticDevWriter',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
  },
});
const named = (workflow, name) => workflow.nodes.find((n) => n.name === name);
function dispatch(input, changes = {}) {
  const { workflow } = buildOrchestrator(bindings());
  const config = {
    env: 'dev',
    app_url: '',
    webhook_base: 'https://muhhammedsayed.app.n8n.cloud',
    notify_mode: 'log',
    stories_twice_daily: false,
    backfill_enabled: false,
    input: { timestamp: null, slot_override: null, env: null, ...input },
    ...changes,
  };
  return JSON.parse(
    JSON.stringify(
      runInNewContext(
        `(function(){${named(workflow, 'Which slot?').parameters.jsCode}\n})()`,
        {
          $input: { all: () => [{ json: config }] },
          $execution: { id: 'SyntheticExecution99' },
        },
        { timeout: 1000 },
      ),
    ),
  );
}
const normalized = (call) => ({
  target: call.workflow,
  input: { ...call.input, result_type: call.input.result_type ?? null },
});

test('requires real-shaped target references, all called children and the restricted dev credential', () => {
  assert.throws(() => buildOrchestrator(), /EMR_N8N_BINDINGS_INVALID/);
  for (const key of [
    'WF-90',
    'WF-10',
    'WF-11',
    'WF-12',
    'WF-13',
    'WF-18',
    'WF-18b',
    'WF-21',
    'WF-22',
    'WF-23',
    'WF-32',
    'WF-40',
    'WF-50',
    'WF-80',
    'WF-91',
  ]) {
    const b = bindings();
    delete b.workflowRefs[key];
    assert.throws(() => buildOrchestrator(b), /EMR_N8N_BINDING_MISSING/);
  }
  const b = bindings();
  delete b.credentials;
  assert.throws(() => buildOrchestrator(b), /EMR_N8N_BINDING_MISSING/);
});

test('builds an inactive Cairo native blueprint with observed core versions and no hosted workflow id', () => {
  const b = bindings(),
    result = buildOrchestrator(b),
    w = result.workflow;
  assert.equal(result.kind, 'native-json-blueprint');
  assert.equal(result.hostedAcceptance, false);
  assert.equal(result.key, 'WF-00');
  assert.equal(w.active, false);
  assert.equal('id' in w, false);
  assert.equal(w.settings.timezone, 'Africa/Cairo');
  assert.equal(w.settings.executionTimeout, 900);
  assert.equal(w.settings.errorWorkflow, b.workflowRefs['WF-90'].id);
  assert.deepEqual(w.pinData, {});
  const probe = JSON.parse(
    readFileSync(
      new URL('../../milestones/M03-n8n-foundation/evidence/sanitizedprobe.json', import.meta.url),
      'utf8',
    ),
  );
  const observed = new Map(probe.nodes.map((n) => [n.type, n.typeVersion]));
  for (const n of w.nodes) assert.equal(n.typeVersion, observed.get(n.type));
  assert.ok(!w.nodes.some((n) => /httpRequest|wait|webhook/i.test(n.type)));
  assert.equal(w.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger').length, 1);
});

test('uses fourteen distinct enabled native cron clocks, with one daily04:00 rule and a separate Sunday07:30 awards clock', () => {
  const w = buildOrchestrator(bindings()).workflow;
  const clock = named(w, 'Cairo clock');
  assert.equal(clock.type, 'n8n-nodes-base.scheduleTrigger');
  const rules = clock.parameters.rule.interval;
  assert.equal(rules.length, 14);
  assert.ok(rules.every((r) => r.field === 'cronExpression'));
  const expressions = rules.map((r) => r.expression);
  assert.equal(new Set(expressions).size, 14);
  assert.equal(expressions.filter((e) => e === '0 0 4 * * *').length, 1);
  assert.ok(expressions.includes('0 30 7 * * 0'));
  assert.equal(clock.parameters.misfirePolicy, 'skip');
  for (const name of ['PM stories (disabled)', 'Backfill waves (disabled)'])
    assert.equal(named(w, name).disabled, true);
  assert.equal(
    named(w, 'Backfill waves (disabled)').parameters.rule.interval[0].expression,
    '0 0 10-23 * * *',
  );
});

test('nonsecret Config hard-disables both optional gates and does not read Variables or accept runtime overrides', () => {
  const w = buildOrchestrator(bindings()).workflow;
  const fields = named(w, 'Config').parameters.assignments.assignments;
  assert.equal(fields.find((x) => x.name === 'env').value, 'dev');
  assert.equal(fields.find((x) => x.name === 'backfill_enabled').value, false);
  assert.equal(fields.find((x) => x.name === 'stories_twice_daily').value, false);
  assert.equal(JSON.stringify(w).includes('$vars'), false);
  for (const changes of [{ env: 'prod' }, { backfill_enabled: true }, { stories_twice_daily: true }])
    assert.throws(() => dispatch({ slot_override: 'health' }, changes), /EMR_N8N_INPUT_INVALID/);
  assert.deepEqual(dispatch({ slot_override: 'stories_pm' }), []);
  assert.deepEqual(dispatch({ slot_override: 'backfill_wave' }), []);
});

test('manual overrides match shared dispatch for all immediate slots with bounded dev-only child inputs', () => {
  for (const slot of [
    'web_map',
    'vimeo',
    'ig_posts',
    'ig_reels',
    'youtube',
    'li_posts',
    'removal',
    'li_employees',
    'stories_am',
    'linker',
    'briefs',
    'digest',
    'health',
  ]) {
    const actual = dispatch({ slot_override: slot }).map((x) => x.json);
    assert.deepEqual(actual, dispatchSlot(slot).calls.map(normalized));
  }
});

test('documents the native news/awards split instead of pretending a thirty-minute call fits the900second timeout', () => {
  const result = buildOrchestrator(bindings());
  assert.deepEqual(
    dispatch({ slot_override: 'news' }).map((x) => x.json),
    [normalized(dispatchSlot('news').calls[0])],
  );
  assert.deepEqual(
    dispatch({ slot_override: 'awards' }).map((x) => x.json),
    [normalized({ ...dispatchSlot('news').calls[1], delayMinutes: 0 })],
  );
  assert.equal(result.scheduleDeviation.kind, 'separate-news-awards-clocks');
  assert.equal(result.scheduleDeviation.sharedLogicalPlanPreserved, true);
  assert.equal(result.scheduleDeviation.manualNewsIncludesAwards, false);
});

test('clock selection matches shared Cairo policy in summer/winter, DST transitions and Saturdaycollision', () => {
  const dates = [
    '2026-10-17',
    '2026-10-18',
    '2026-10-19',
    '2026-12-19',
    '2026-12-20',
    '2026-12-21',
    '2026-10-29',
    '2026-10-30',
    '2026-04-23',
    '2026-04-24',
  ];
  for (const date of dates)
    for (const hour of Array.from({ length: 24 }, (_, i) => i))
      for (const minute of [0, 15, 30, 45]) {
        const timestamp = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
        const cairo = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Africa/Cairo',
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(new Date(timestamp));
        const value = (name) => cairo.find((x) => x.type === name)?.value;
        const awards = value('weekday') === 'Sun' && value('hour') === '07' && value('minute') === '30';
        const expected = scheduledSlots(timestamp).flatMap((slot) =>
          dispatchSlot(slot)
            .calls.filter((c) => c.delayMinutes === 0)
            .map(normalized),
        );
        if (awards) expected.push(normalized({ ...dispatchSlot('news').calls[1], delayMinutes: 0 }));
        assert.deepEqual(
          dispatch({ timestamp }).map((x) => x.json),
          expected,
          timestamp,
        );
      }
  assert.deepEqual(
    dispatch({ timestamp: '2026-10-17T01:00:00Z' }).map((x) => x.json.target),
    ['WF-18', 'WF-40'],
  );
});

test('unknown manual input produces a fixed parameterized audit and never echoes its value', () => {
  const result = dispatch({ slot_override: 'SYNTHETIC_PRIVATE_MARKER' });
  assert.equal(result.length, 1);
  assert.equal(result[0].json.target, 'audit');
  assert.equal(result[0].json.audit_reason, 'unknown_schedule_slot');
  const audit = JSON.parse(result[0].json.params[0]);
  assert.deepEqual(audit, {
    kind: 'error',
    workflow: 'WF-00',
    execution_id: 'SyntheticExecution99',
    node: 'Unknown schedule slot',
    message: 'unexpected_error',
  });
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE_MARKER'), false);
  const w = buildOrchestrator(bindings()).workflow;
  const pg = named(w, 'Audit unknown slot');
  assert.equal(pg.parameters.query, 'select ops.log_workflow_error($1::jsonb) as logged;');
  assert.equal(pg.parameters.options.queryReplacement, '={{ $json.params }}');
  assert.equal(pg.credentials.postgres.id, 'SyntheticDevWriter');
});

test('rejects invalid timestamp/env/shape and does not dispatch an empty manual trigger at the current wall clock', () => {
  for (const input of [
    { timestamp: '2026-10-18T03:30:00' },
    { timestamp: 'not-a-date' },
    { timestamp: '2026-02-30T01:00:00Z' },
    { slot_override: '' },
    { slot_override: 23 },
    { slot_override: 'x'.repeat(101) },
    { env: 'prod' },
    { env: false },
  ])
    assert.throws(() => dispatch(input), /EMR_N8N_INPUT_INVALID/);
  assert.equal(dispatch({})[0].json.target, 'audit');
});

test('routes each emitted target through one bound ExecuteWorkflow with complete declared inputs and no phantom edges', () => {
  const b = bindings(),
    first = buildOrchestrator(b),
    second = buildOrchestrator(b);
  assert.deepEqual(first, second);
  const w = first.workflow,
    router = named(w, 'Route child'),
    names = new Set(w.nodes.map((n) => n.name));
  assert.equal(router.parameters.mode, 'rules');
  assert.equal(router.parameters.rules.values.length, 15);
  assert.equal(router.parameters.options.fallbackOutput, 'extra');
  const ids = new Set();
  for (const n of w.nodes) {
    assert.equal(ids.has(n.id), false);
    ids.add(n.id);
  }
  for (const [source, outputs] of Object.entries(w.connections)) {
    assert.ok(names.has(source));
    for (const branch of outputs.main)
      for (const edge of branch) {
        assert.ok(names.has(edge.node));
        assert.equal(edge.type, 'main');
        assert.equal(edge.index, 0);
      }
  }
  const childNodes = w.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow');
  assert.equal(childNodes.length, 14);
  for (const n of childNodes) {
    assert.ok(Object.values(b.workflowRefs).some((r) => r.id === n.parameters.workflowId.value));
    assert.equal(n.parameters.options.waitForSubWorkflow, false);
    assert.equal(n.parameters.mode, 'once');
    assert.deepEqual(
      n.parameters.workflowInputs.schema.map((x) => x.id),
      ['mode', 'limit', 'result_type', 'env'],
    );
    assert.equal(n.retryOnFail, false);
  }
  router.parameters.rules.values.forEach((rule, index) => {
    const target = rule.conditions.conditions[0].rightValue;
    const routed = w.connections['Route child'].main[index][0].node;
    assert.equal(routed, target === 'audit' ? 'Audit unknown slot' : `Call ${target}`);
    if (target !== 'audit')
      assert.equal(named(w, routed).parameters.workflowId.value, b.workflowRefs[target].id);
  });
  assert.equal(w.connections['Route child'].main.at(-1)[0].node, 'Reject invalid dispatch');
  for (const slot of ['ig_posts', 'ig_reels', 'news', 'awards', 'health', 'removal'])
    for (const item of dispatch({ slot_override: slot })) {
      const child = named(w, `Call ${item.json.target}`);
      const values = Object.fromEntries(
        Object.entries(child.parameters.workflowInputs.value).map(([field, expression]) => [
          field,
          runInNewContext(expression.slice(3, -2), { $json: item.json }, { timeout: 1000 }),
        ]),
      );
      assert.deepEqual(values, item.json.input);
    }
});
