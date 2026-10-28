import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildNativeLinkedIn, m05LinkedInCloudSource } from './build-native-m05-linkedin.mjs';
import { m05Args } from '../../packages/shared/src/n8n-m05-contracts.ts';

const bindings = JSON.parse(
  readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
);
const transport = {
  audience: 'https://everyone-market-researcher-local-fixture.vercel.app',
  credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const ids = ['11111111-1111-4111-a111-111111111111', '33333333-3333-4333-a333-333333333333'];
const runId = '44444444-4444-4444-a444-444444444444';
const selection = (kind = 'posts') => ({
  env: 'dev',
  mode: kind === 'posts' ? 'daily' : 'weekly',
  account_ids: ids,
  results_limit: 20,
  max_actor_starts: 2,
});
const accounts = (kind) =>
  ids.map((account_id, index) => ({
    account_id,
    competitor_id: '22222222-2222-4222-a222-222222222222',
    platform: kind === 'posts' ? 'linkedin' : 'linkedin_employees',
    handle: `m05-local-fixture-${index}`,
    url: `https://www.linkedin.com/company/m05-local-fixture-${index}/`,
    watermark_published_at: index === 0 ? '2026-10-24T12:00:00Z' : '2026-10-20T12:00:00Z',
  }));
const rt = () =>
  runInNewContext(
    m05LinkedInCloudSource + '\n({initializeM05LinkedIn,advanceM05LinkedInGateway,advanceM05LinkedInActor})',
    {},
    { timeout: 1000 },
  );
const reply = (state, result, replayed = false) => ({
  statusCode: 200,
  body: {
    version: 1,
    requestId: state.request.requestId,
    operation: state.request.operation,
    replayed,
    result,
  },
});
function launchResult(state, replayed = false) {
  return {
    permit: true,
    replayed,
    launch_id: state.launchId,
    descriptor: {
      billingModel: 'PPE',
      actorPath: state.batches[state.batchIndex].actor.replace('/', '~'),
      build: '0.0.1',
      maxTotalChargeUsd: 1,
      maxItems: 20,
      memory: 1024,
      timeout: 600,
    },
  };
}
function drive(
  kind = 'posts',
  closed = { registration_closed: true, state: 'awaiting_callbacks', finished_now: false, summary: null },
) {
  const runtime = rt(),
    calls = [];
  let state = runtime.initializeM05LinkedIn(selection(kind), kind, '701', '2026-10-27T22:30:00Z');
  let starts = 0;
  for (let index = 0; state.action !== 'done' && index < 50; index++) {
    if (state.action === 'gateway') {
      const request = JSON.parse(JSON.stringify(state.request));
      m05Args[request.operation].parse(request.args);
      calls.push(request);
      const result =
        request.operation === 'm05.start'
          ? { run_id: runId }
          : request.operation === 'm05.claim'
            ? accounts(kind)
            : request.operation === 'm05.launch'
              ? launchResult(state)
              : request.operation === 'm05.register'
                ? { registered: true, run_id: runId, apify_run_id: state.startedActorId }
                : closed;
      state = runtime.advanceM05LinkedInGateway(state, reply(state, result));
    } else {
      assert.equal(state.action, 'apify');
      calls.push({
        operation: 'local_actor_http',
        input: JSON.parse(JSON.stringify(state.batches[state.batchIndex].input)),
      });
      state = runtime.advanceM05LinkedInActor(state, {
        statusCode: 201,
        body: { data: { id: `synthetic_native_actor_${++starts}` } },
      });
    }
  }
  assert.equal(state.action, 'done');
  return { state, calls, starts };
}

test('native LinkedIn posts and employees use supported private HTTP graphs and synthetic fixed selectors', () => {
  for (const kind of ['posts', 'employees']) {
    const definition = buildNativeLinkedIn(bindings, transport, kind, selection(kind));
    assert.equal(definition.workflow.active, false);
    assert.equal(definition.hostedAcceptance, false);
    assert.equal(definition.liveEnabled, false);
    assert.equal(definition.fixtureProvenance.actualProviderCapture, false);
    assert.equal(definition.workflow.settings.errorWorkflow, undefined);
    assert.equal(definition.workflow.settings.saveDataSuccessExecution, 'none');
    assert.equal(definition.workflow.settings.saveDataErrorExecution, 'none');
    assert.equal(definition.workflow.settings.saveManualExecutions, false);
    assert.deepEqual(definition.workflow.pinData, {});
    assert.equal(
      definition.workflow.nodes.some((node) => node.type.endsWith('.scheduleTrigger')),
      false,
    );
    for (const node of definition.workflow.nodes) {
      if (node.type.endsWith('.code'))
        assert.doesNotMatch(node.parameters.jsCode, /\bfetch\s*\(|\brequire\s*\(|\bimport\s*\(/);
      if (node.type.endsWith('.httpRequest')) {
        assert.equal(node.typeVersion, 4.5);
        assert.equal(node.retryOnFail, false);
        assert.equal(node.parameters.options.allowUnauthorizedCerts, false);
        assert.equal(node.parameters.options.redirect.redirect.followRedirects, false);
      }
    }
    const actor = definition.workflow.nodes.find((node) => node.name === 'Start asynchronous LinkedIn actor');
    assert.equal(actor.parameters.nodeCredentialType, 'apifyApi');
    assert.equal(actor.credentials.apifyApi.id, bindings.credentials.apify.id);
    assert.match(actor.parameters.url, /waitForFinish=0&restartOnError=false/);
    assert.match(actor.parameters.url, /maxTotalChargeUsd/);
  }
});
test('serialized post path binds exact INPUT and registers every date bucket before closing registration', () => {
  const result = drive();
  assert.equal(result.starts, 2);
  assert.equal(result.state.result.state, 'awaiting_callbacks');
  assert.deepEqual(
    result.calls.map((call) => call.operation),
    [
      'm05.start',
      'm05.claim',
      'm05.launch',
      'local_actor_http',
      'm05.register',
      'm05.launch',
      'local_actor_http',
      'm05.register',
      'm05.close_registration',
    ],
  );
  for (const call of result.calls.filter((call) => call.operation === 'm05.launch')) {
    assert.equal(call.args.pass, 'primary');
    assert.equal(call.args.actor_input.scrapeComments, false);
    assert.equal(call.args.actor_input.scrapeReactions, false);
    assert.equal(call.args.actor_input.includeReposts, true);
  }
});
test('serialized employee path stays Short singleton and uses the trusted capture Cairo date without raw employee ingestion', () => {
  const result = drive('employees');
  assert.equal(result.starts, 2);
  const starts = result.calls.filter((call) => call.operation === 'm05.launch');
  for (const call of starts) {
    assert.equal(call.args.snapshot_date, '2026-10-28');
    assert.equal(call.args.actor_input.profileScraperMode, 'Short ($4 per 1k)');
    assert.equal(call.args.actor_input.companies.length, 1);
    assert.equal(call.args.actor_input.maxItems, 20);
    assert.equal(call.args.actor_input.takePages, 1);
  }
  assert.equal(
    result.calls.some((call) =>
      ['m05.ingest', 'm05.snapshot', 'm05.cost', 'm05.finish'].includes(call.operation),
    ),
    false,
  );
});
test('serialized close receipt reports an already-settled run status and rejects inconsistent/foreign summaries', () => {
  for (const status of ['success', 'partial', 'failed']) {
    const { state } = drive('posts', {
      registration_closed: true,
      state: 'completed',
      finished_now: true,
      summary: { run_id: runId, status },
    });
    assert.equal(state.result.state, 'completed');
    assert.equal(state.result.status, status);
    assert.equal(state.result.run_id, runId);
  }
  for (const closed of [
    { registration_closed: true },
    { registration_closed: true, state: 'awaiting_callbacks', finished_now: true, summary: null },
    {
      registration_closed: true,
      state: 'awaiting_callbacks',
      finished_now: false,
      summary: { run_id: runId, status: 'success' },
    },
    {
      registration_closed: true,
      state: 'completed',
      finished_now: false,
      summary: { run_id: runId, status: 'success' },
    },
    { registration_closed: true, state: 'completed', finished_now: true, summary: null },
    {
      registration_closed: true,
      state: 'completed',
      finished_now: true,
      summary: { run_id: ids[0], status: 'success' },
    },
    {
      registration_closed: true,
      state: 'completed',
      finished_now: true,
      summary: { run_id: runId, status: 'running' },
    },
  ])
    assert.throws(() => drive('employees', closed), /RECEIPT_INVALID/);
});
test('fixed local graph ignores caller account knobs and rejects unsafe authored selections', () => {
  const definition = buildNativeLinkedIn(bindings, transport, 'posts', selection());
  const source = definition.workflow.nodes.find((node) => node.name === 'Initialize fixed LinkedIn selection')
    .parameters.jsCode;
  const initialize = new Function('$input', '$execution', source);
  const [row] = initialize(
    { all: () => [{ json: { account_ids: ['99999999-9999-4999-a999-999999999999'], env: 'prod' } }] },
    { id: '701' },
  );
  assert.equal(row.json.request.args.env, 'dev');
  assert.deepEqual(row.json.accountIds, ids);
  for (const changes of [{ env: 'prod' }, { results_limit: 0 }, { max_actor_starts: 41 }, { cookies: [] }])
    assert.throws(
      () => buildNativeLinkedIn(bindings, transport, 'posts', { ...selection(), ...changes }),
      /INPUT_INVALID/,
    );
});
test('native permit replay, credential-bearing transport errors and unknown paid outcomes never authorize a retry or closure', () => {
  const runtime = rt();
  let state = runtime.initializeM05LinkedIn(selection(), 'posts', '701', '2026-10-28T12:00:00Z');
  state = runtime.advanceM05LinkedInGateway(state, reply(state, { run_id: runId }));
  state = runtime.advanceM05LinkedInGateway(state, reply(state, accounts('posts')));
  assert.throws(
    () => runtime.advanceM05LinkedInGateway(state, reply(state, launchResult(state, true), true)),
    /RECONCILIATION_REQUIRED/,
  );
  const wrongBilling = launchResult(state);
  wrongBilling.descriptor.billingModel = 'PPU';
  assert.throws(
    () => runtime.advanceM05LinkedInGateway(state, reply(state, wrongBilling)),
    /RECONCILIATION_REQUIRED/,
  );
  state = runtime.advanceM05LinkedInGateway(state, reply(state, launchResult(state)));
  for (const response of [
    { statusCode: 500, body: { token: 'synthetic-private-diagnostic' } },
    { error: 'synthetic-private-diagnostic' },
    { statusCode: 201, body: { data: {} } },
  ])
    assert.throws(
      () => runtime.advanceM05LinkedInActor(state, response),
      (error) => /RECONCILIATION_REQUIRED/.test(error.message) && !error.message.includes('diagnostic'),
    );
  assert.equal(state.action, 'apify');
  assert.equal(state.actorIds.length, 0);
});
