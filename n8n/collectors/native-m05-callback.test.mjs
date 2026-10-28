import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildNativeM05Callback } from './build-native-m05-callback.mjs';
import { buildM05ErrorHandler, buildM05Orchestrator } from './build-native-m05-orchestration.mjs';
import { m05Args, m05WorkflowIds } from '../../packages/shared/src/n8n-m05-contracts.ts';
const b = JSON.parse(readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url)));
const t = {
  audience: 'https://everyone-market-researcher-local.vercel.app',
  credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const graph = () => buildNativeM05Callback(b, t);
test('maintained callback extends only supported native HTTP/IF nodes; strict TLS and no start retries', () => {
  const g = graph();
  assert.equal(g.workflow.active, false);
  assert.equal(g.hostedAcceptance, false);
  for (const n of g.workflow.nodes) {
    if (n.type.endsWith('.httpRequest')) {
      assert.equal(n.retryOnFail, false);
      assert.equal(n.parameters.options.allowUnauthorizedCerts, false);
      assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
    }
    if (n.type.endsWith('.code')) assert.doesNotMatch(n.parameters.jsCode, /\b(?:fetch|require|import)\s*\(/);
  }
  assert.equal(g.workflow.nodes.filter((n) => n.name === 'Start bounded adaptive retry').length, 1);
});
test('duplicate thin callback with an uncertain launch cannot POST; known registered retry is reused', () => {
  const js = graph().workflow.nodes.find((n) => n.name === 'Verify thin retry permit').parameters.jsCode;
  const prior = {
    request: { requestId: '28000000-0000-4000-a000-000000000001' },
    retry: { results_limit: 1 },
  };
  const run = (result) =>
    runInNewContext('(function(){' + js + '})()', {
      $input: {
        all: () => [
          {
            json: {
              statusCode: 200,
              body: {
                version: 1,
                requestId: prior.request.requestId,
                operation: 'm05.launch',
                replayed: true,
                result,
              },
            },
          },
        ],
      },
      $execution: { id: '12' },
      $: () => ({ item: { json: prior } }),
    });
  assert.throws(() => run({ permit: false, apify_run_id: null }), /M05_RETRY_START_UNKNOWN/);
  assert.equal(run({ permit: false, apify_run_id: 'knownActor' })[0].json.post, false);
});
test('M05 error envelope is source allowlisted, classification-only and uses native existing credential binding', () => {
  const g = buildM05ErrorHandler(b, t);
  assert.equal(g.workflow.active, false);
  const js = g.workflow.nodes.find((n) => n.name === 'Prepare classified M04 error').parameters.jsCode;
  const rows = runInNewContext('(function(){' + js + '})()', {
    $input: {
      all: () => [
        {
          json: {
            workflow: { id: m05WorkflowIds['WF-18b'] },
            execution: { id: '11', error: { message: 'must not copy' } },
          },
        },
      ],
    },
    $execution: { id: '12' },
  });
  assert.equal(m05Args['m05.execution.error'].safeParse(rows[0].json.request.args).success, true);
  assert.doesNotMatch(JSON.stringify(rows), /must not copy/);
});
test('orchestration is inert while a child binding is missing; it never invokes closed M03 dependencies', () => {
  const children = ['WF-21', 'WF-13', 'WF-18', 'WF-18b'].map((key) => ({
    key,
    hostedAcceptance: false,
    runnableWorkflow: key !== 'WF-21',
    workflow: { active: false },
  }));
  const g = buildM05Orchestrator(b, children);
  assert.equal(g.runnableWorkflow, false);
  assert.equal(
    g.workflow.nodes.some((n) => n.type.endsWith('.executeWorkflow')),
    false,
  );
  children[0].runnableWorkflow = true;
  const ready = buildM05Orchestrator(b, children);
  assert.equal(ready.workflow.nodes.filter((n) => n.type.endsWith('.executeWorkflow')).length, 4);
  assert.equal(
    ready.workflow.nodes.some((n) => n.type.endsWith('.scheduleTrigger')),
    false,
  );
  assert.doesNotMatch(JSON.stringify(ready.workflow), /WF-99|WF-97|WF-91/);
});
