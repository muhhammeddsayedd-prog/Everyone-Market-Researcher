import { nativeFoundationTagName } from '../../packages/shared/src/n8n-bindings.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildOrchestrator } from './build-orchestrator.mjs';
import { buildHealthWorkflow } from './build-health.mjs';
import {
  foundationWorkflowNames,
  foundationTagNames,
  parseHealthInput,
} from '../../packages/shared/src/n8n-bindings.ts';

// Independent integration of two actual native blueprint adapters. All IDs,
// executions and timestamps are synthetic; this never contacts or runs n8n.
const bindings = {
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: Object.fromEntries(
    Object.entries(foundationWorkflowNames).map(([key, name], i) => [
      key,
      { id: `SyntheticCrossWorkflow${i}`, name },
    ]),
  ),
  tagRefs: Object.fromEntries(
    foundationTagNames.map((name, i) => [
      name,
      { id: `SyntheticCrossTag${i}`, name: nativeFoundationTagName(name) },
    ]),
  ),
  credentials: {
    postgres: {
      id: 'SyntheticCrossWriter',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
  },
};
const named = (workflow, name) => workflow.nodes.find((node) => node.name === name);
function evaluate(value, json) {
  return typeof value === 'string' && value.startsWith('={{')
    ? runInNewContext('(' + value.slice(3, -2) + ')', { $json: json }, { timeout: 1000 })
    : value;
}
function runCode(node, json) {
  return JSON.parse(
    JSON.stringify(
      runInNewContext(
        `(function(){${node.parameters.jsCode}\n})()`,
        {
          $input: { all: () => [{ json }] },
          $execution: { id: 'SyntheticCrossExecution' },
        },
        { timeout: 1000 },
      ),
    ),
  );
}

test('actual WF00 Config/dispatch/resource mapper matches WF91 declared trigger, Zod and Code input at winter/summer Cairo09:15', () => {
  const orchestrator = buildOrchestrator(bindings).workflow;
  const health = buildHealthWorkflow(bindings).workflow;
  const call = named(orchestrator, 'Call WF-91');
  const trigger = named(health, 'When called');
  assert.equal(call.parameters.workflowId.value, bindings.workflowRefs['WF-91'].id);
  assert.deepEqual(
    call.parameters.workflowInputs.schema.map(({ id, type }) => ({ name: id, type })),
    trigger.parameters.workflowInputs.values,
  );
  assert.equal(call.parameters.options.waitForSubWorkflow, false);
  for (const sourceInput of [
    { slot_override: 'health', env: 'dev' },
    { timestamp: '2026-01-05T07:15:00Z', env: 'dev' },
    { timestamp: '2026-07-05T06:15:00Z', env: 'dev' },
  ]) {
    const config = Object.fromEntries(
      named(orchestrator, 'Config').parameters.assignments.assignments.map(({ name, value }) => [
        name,
        evaluate(value, sourceInput),
      ]),
    );
    const dispatch = runCode(named(orchestrator, 'Which slot?'), config);
    assert.equal(dispatch.length, 1);
    assert.equal(dispatch[0].json.target, 'WF-91');
    const mapped = Object.fromEntries(
      Object.entries(call.parameters.workflowInputs.value).map(([name, value]) => [
        name,
        evaluate(value, dispatch[0].json),
      ]),
    );
    const normalized = JSON.parse(JSON.stringify(mapped));
    assert.deepEqual(
      Object.keys(normalized).sort(),
      trigger.parameters.workflowInputs.values.map(({ name }) => name).sort(),
    );
    assert.deepEqual(runCode(named(health, 'Validate dev input'), normalized), [
      { json: parseHealthInput(normalized) },
    ]);
    assert.equal(normalized.env, 'dev');
    assert.equal(normalized.mode, 'daily');
  }
});
