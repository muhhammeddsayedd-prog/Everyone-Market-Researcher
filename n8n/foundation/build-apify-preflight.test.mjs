import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildCallbackReadbackComponent } from './build-apify-preflight.mjs';
import { registeredSmokeRun, trustedTerminalRun } from '../../packages/shared/src/n8n-apify-contracts.ts';
const binding = () => ({
  runtimeVersion: '2.43.5',
  environment: 'dev',
  instanceUrl: 'https://muhhammedsayed.app.n8n.cloud',
  projectId: 'pHvQjDmjxVZ3KQLT',
  workflowRefs: {},
  tagRefs: {},
  credentials: {
    postgres: {
      id: 'SyntheticPg',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
    },
    apify: { id: 'SyntheticApify', name: 'Apify account', type: 'apifyApi', environment: 'dev' },
  },
});
const registry = () => ({
  apify_run_id: 'SyntheticRun',
  actor_id: 'apify/website-content-crawler',
  run_id: '10000000-0000-4000-8000-000000000001',
  account_ids: ['10000000-0000-4000-8000-000000000002'],
  purpose: 'daily',
  processed_at: null,
});
const named = (component, name) => component.nodes.find((n) => n.name === name);
function runCode(node, json, outputs = {}) {
  class Clock extends Date {
    static now() {
      return 1792292400000;
    }
  }
  const result = runInNewContext(
    `(function(){${node.parameters.jsCode}\n})()`,
    {
      $input: { all: () => [{ json }] },
      $: (name) => ({ first: () => ({ json: outputs[name] }) }),
      Date: Clock,
    },
    { timeout: 1000 },
  );
  return JSON.parse(JSON.stringify(result));
}
test('readback component declares incomplete native acceptance and contains no launch/persistence/webhook activation', () => {
  const c = buildCallbackReadbackComponent(binding());
  assert.equal(c.runnableWorkflow, false);
  assert.equal(c.hostedAcceptance, false);
  assert.equal('workflow' in c, false);
  assert.equal(c.requestLimit.authenticatedRunGets, 1);
  assert.ok(c.remainingGates.includes('durable unknown-callback audit'));
  assert.ok(c.nodes.every((n) => !n.parameters.method || n.parameters.method === 'GET'));
  assert.ok(!c.nodes.some((n) => /schedule|webhook|executeWorkflow/.test(n.type)));
  assert.equal(c.nodes.filter((n) => n.type === 'n8n-nodes-base.postgres').length, 1);
  assert.equal(
    named(c, 'Read registered run').parameters.query,
    'select ops.get_apify_run($1) as registered;',
  );
  assert.equal(named(c, 'Read authenticated terminal run').parameters.nodeCredentialType, 'apifyApi');
  assert.equal(named(c, 'Read authenticated terminal run').retryOnFail, false);
});
test('notification extraction and registry guard ignore forged context and reject unknown/replayed runs before HTTP', () => {
  const c = buildCallbackReadbackComponent(binding()),
    extract = named(c, 'Validate callback ID'),
    guard = named(c, 'Bind registered run');
  const notification = runCode(extract, {
    body: {
      eventType: 'ACTOR.RUN.SUCCEEDED',
      resource: { id: 'SyntheticRun', defaultDatasetId: 'FORGED' },
      emr: { usage_usd: 100, account_ids: ['FORGED'] },
    },
  })[0].json;
  assert.deepEqual(notification, { apify_run_id: 'SyntheticRun', params: ['SyntheticRun'] });
  const outputs = { 'Validate callback ID': notification };
  assert.throws(() => runCode(guard, { registered: null }, outputs), /EMR_APIFY_RUN_UNREGISTERED/);
  assert.throws(
    () => runCode(guard, { registered: { ...registry(), processed_at: '2026-10-18T03:00:00Z' } }, outputs),
    /EMR_APIFY_REPLAY_REQUIRES_SAVED_RECEIPT/,
  );
  const bound = runCode(guard, { registered: registry() }, outputs)[0].json;
  assert.equal(bound.run_url, 'https://api.apify.com/v2/actor-runs/SyntheticRun?waitForFinish=0');
  assert.ok(!JSON.stringify(bound).includes('FORGED'));
});
test('native Code projects the same trusted terminal contract as Zod and leaves settlement explicitly pending', () => {
  const c = buildCallbackReadbackComponent(binding()),
    check = named(c, 'Project first terminal snapshot');
  for (const status of ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']) {
    const body = {
      data: {
        id: 'SyntheticRun',
        actId: 'aYG0l9s7dbB7j3gbS',
        status,
        defaultDatasetId: 'SyntheticDataset',
        usageTotalUsd: 0.0045,
        finishedAt: '2026-10-18T03:00:00.000Z',
        meta: { secret: 'SYNTHETIC_PRIVATE_MARKER' },
      },
    };
    const output = runCode(
      check,
      { statusCode: 200, body },
      { 'Bind registered run': { registered: registry() } },
    )[0].json;
    assert.deepEqual(
      output.terminal,
      trustedTerminalRun(body, registeredSmokeRun(registry(), 'SyntheticRun')),
    );
    assert.equal(output.requiresDelayedReadback, true);
    assert.equal(output.observed_at_ms, 1792292400000);
    assert.ok(!JSON.stringify(output).includes('SYNTHETIC_PRIVATE_MARKER'));
  }
  for (const data of [
    { id: 'OtherRun' },
    { actId: 'other' },
    { status: 'RUNNING' },
    { usageTotalUsd: undefined },
    { usageTotalUsd: -1 },
    { finishedAt: 'October 18, 2026' },
    { finishedAt: '2026-02-30T03:00:00Z' },
  ])
    assert.throws(
      () =>
        runCode(
          check,
          {
            statusCode: 200,
            body: {
              data: {
                id: 'SyntheticRun',
                actId: 'aYG0l9s7dbB7j3gbS',
                status: 'SUCCEEDED',
                defaultDatasetId: 'SyntheticDataset',
                usageTotalUsd: 0.1,
                finishedAt: '2026-10-18T03:00:00Z',
                ...data,
              },
            },
          },
          { 'Bind registered run': { registered: registry() } },
        ),
      /EMR_APIFY_TRUSTED_RUN_INVALID/,
    );
});
