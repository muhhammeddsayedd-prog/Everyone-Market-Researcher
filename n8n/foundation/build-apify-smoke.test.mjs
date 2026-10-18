import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const syntheticCallbackBindings = () => ({
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: {
    'WF-90': { id: 'SyntheticWf90', name: 'WF-90 · Error handler [dev]' },
    'WF-19': { id: 'SyntheticWf19', name: 'WF-19 · Apify run callback [dev]' },
  },
  tagRefs: {
    'env:dev': { id: 'SyntheticTag1', name: 'env:dev' },
    'layer:ops': { id: 'SyntheticTag2', name: 'layer:ops' },
  },
});
const runCallbackCode = (node, rows) =>
  JSON.parse(
    JSON.stringify(
      runInNewContext(
        `(function(){${node.parameters.jsCode}\n})()`,
        { $input: { all: () => rows } },
        { timeout: 1000 },
      ),
    ),
  );

test('smoke blueprint recovers the same known original run and contains no paid launch', async () => {
  const { buildApifySmoke } = await import('./build-apify-smoke.mjs');
  const result = buildApifySmoke(syntheticCallbackBindings());
  assert.equal(result.workflow.active, false);
  assert.equal(result.runnableWorkflow, false);
  assert.equal(result.launchAvailable, false);
  assert.ok(result.remainingGates.includes('durable spend admission before any actor POST'));
  assert.ok(
    !result.workflow.nodes.some(
      (n) => n.type === 'n8n-nodes-base.httpRequest' || n.type === 'n8n-nodes-base.postgres',
    ),
  );
  const prepare = result.workflow.nodes.find((n) => n.name === 'Recover original registered run');
  assert.throws(() => runCallbackCode(prepare, [{ json: {} }]), /EMR_APIFY_SPEND_ADMISSION_UNAVAILABLE/);
  assert.throws(
    () => runCallbackCode(prepare, [{ json: { apify_run_id: 'Original1', env: 'prod' } }]),
    /EMR_APIFY_RECOVERY_INPUT_INVALID/,
  );
  assert.deepEqual(runCallbackCode(prepare, [{ json: { apify_run_id: 'Original1', env: 'dev' } }]), [
    { json: { apify_run_id: 'Original1', env: 'dev', transport: 'recovery' } },
  ]);
});
