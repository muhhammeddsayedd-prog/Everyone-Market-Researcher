import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  buildNativeM06Campaign,
  buildUnboundNativeM06Campaign,
  m06CampaignCloudSource,
  m06CampaignCron,
} from './build-native-m06-campaign.mjs';
import { buildNativeCampaignStories } from './build-native-m06-stories.mjs';
import * as rt from './native-m06-campaign.mjs';
const uuid = (n) => `62000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const accounts = Array.from({ length: 20 }, (_, i) => ({
  account_id: uuid(i + 1),
  competitor_id: uuid(i + 100),
  platform: 'instagram_stories',
  handle: `synthetic${String(i).padStart(2, '0')}`,
  url: `https://www.instagram.com/synthetic${String(i).padStart(2, '0')}/`,
  backfill_status: 'not_applicable',
}));
const pin = {
  campaign_id: uuid(1000),
  start_date: '2026-10-30',
  end_date: '2026-11-05',
  account_ids: accounts.map((a) => a.account_id),
};
const b = JSON.parse(readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'));
const transport = {
  audience: 'https://everyone-market-researcher-campaign-fixture.vercel.app',
  credential: { id: 'FixtureGateway', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const workflows = { collector: 'FixtureCollector', callback: 'FixtureCallback', media: 'FixtureMediaWorker' };
const at = '2026-10-30T04:00:00Z';
const request = () => rt.prepareM06CampaignTick(pin, '1000', at);
const reply = (r, replayed = false) => ({
  statusCode: 200,
  body: {
    version: 1,
    requestId: request().request.requestId,
    operation: 'm06.campaign_tick',
    replayed,
    result: r,
  },
});
const launch = (actor = 'data-slayer/instagram-stories-scraper') => ({
  action: 'launch',
  campaign_id: pin.campaign_id,
  day: pin.start_date,
  group_key: actor.startsWith('data-') ? 'primary_01' : 'comparison_01',
  run_id: uuid(2000),
  accounts,
  selection: {
    env: 'dev',
    mode: 'daily',
    actor_id: actor,
    collection_mode: actor.startsWith('data-') ? 'ingest' : 'bakeoff',
    account_ids: pin.account_ids,
    results_limit: actor.startsWith('data-') ? 30 : 50,
    max_actor_starts: 1,
  },
});
const executeCode = (graph, name, input, lookup = {}, now = at) => {
  const n = graph.nodes.find((n) => n.name === name);
  class Clock extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
  }
  return runInNewContext(
    '(function(){' + n.parameters.jsCode + '})()',
    {
      $input: { all: () => [{ json: input }] },
      $execution: { id: '1000' },
      $: (name) => ({ item: { json: lookup[name] }, first: () => ({ json: lookup[name] }) }),
      Date: Clock,
    },
    { timeout: 1000 },
  );
};

test('seven calendar dates and Cairo06 schedule are fixed across month boundary; no eighth-day I/O', () => {
  assert.equal(rt.m06CampaignClock('2026-10-29T03:00:00Z').hour, 6);
  assert.equal(rt.m06CampaignClock('2026-10-30T03:00:00Z').hour, 5);
  assert.equal(rt.m06CampaignClock(at).hour, 6);
  assert.equal(rt.prepareM06CampaignTick(pin, '1000', '2026-10-30T03:59:00Z').action, 'idle');
  assert.equal(rt.prepareM06CampaignTick(pin, '1000', at).action, 'gateway');
  assert.equal(rt.prepareM06CampaignTick(pin, '1000', '2026-11-05T15:59:00Z').action, 'gateway');
  assert.equal(rt.prepareM06CampaignTick(pin, '1000', '2026-11-05T16:00:00Z').action, 'idle');
  assert.equal(rt.prepareM06CampaignTick(pin, '1000', '2026-11-06T04:00:00Z').action, 'gateway');
  const closed = rt.prepareM06CampaignTick(pin, '1000', '2026-11-06T16:00:00Z');
  assert.equal(closed.action, 'closed');
  assert.equal(closed.request, undefined);
  assert.deepEqual(
    m06CampaignCron(pin).map((r) => r.expression),
    ['0 */5 6-17 30-31 10 *', '0 */5 6-17 1-6 11 *'],
  );
  for (const patch of [
    { end_date: '2026-11-06' },
    { start_date: '2026-02-30' },
    { account_ids: pin.account_ids.slice(1) },
    { account_ids: Array(20).fill(uuid(1)) },
  ])
    assert.throws(() => rt.validateM06CampaignPin({ ...pin, ...patch }), /PIN_INVALID/);
});

test('native campaign uses authoritative preclaimed run and exactly one launch without another start/claim', () => {
  for (const actor of [
    'data-slayer/instagram-stories-scraper',
    'igview-owner/instagram-story-viewer',
    'louisdeconinck/instagram-story-details-scraper',
  ]) {
    const t = launch(actor),
      s = rt.initializeM06CampaignLaunch(t, '1001', pin, at);
    assert.equal(s.runId, t.run_id);
    assert.equal(s.request.operation, 'm06.launch');
    assert.equal(s.batches.length, 1);
    assert.equal(s.request.args.actor_id, actor);
    assert.equal(s.request.args.collection_mode, t.selection.collection_mode);
    assert.deepEqual([...s.request.args.account_ids].sort(), [...t.selection.account_ids].sort());
  }
  assert.throws(
    () => rt.initializeM06CampaignLaunch(launch(), '1001', pin, '2026-11-06T04:00:00Z'),
    /LAUNCH_INVALID/,
  );
  assert.throws(
    () => rt.initializeM06CampaignLaunch({ ...launch(), accounts: [accounts[1]] }, '1001', pin, at),
    /LAUNCH_INVALID/,
  );
  const bad = launch();
  bad.selection.results_limit = 50;
  assert.throws(() => rt.initializeM06CampaignLaunch(bad, '1001', pin, at), /LAUNCH_INVALID/);
  const g = buildNativeCampaignStories(b, transport, pin).workflow;
  assert.equal(g.nodes.find((n) => n.name === 'When called').parameters.inputSource, 'passthrough');
  assert.ok(!g.nodes.some((n) => n.type === 'n8n-nodes-base.manualTrigger'));
  // The actual serialized initializer is exercised with its dependency set.
  const compiled = runInNewContext(
    m06CampaignCloudSource + '\ninitializeM06CampaignLaunch(t,"1001",p,at)',
    { t: launch(), p: pin, at },
    { timeout: 1000 },
  );
  assert.equal(compiled.request.operation, 'm06.launch');
});

test('tick replay cannot return a fresh launch; malformed or out-of-scope receipts fail before child I/O', () => {
  assert.equal(rt.verifyM06CampaignTick(reply(launch()), request(), pin).action, 'launch');
  assert.throws(() => rt.verifyM06CampaignTick(reply(launch(), true), request(), pin), /RECEIPT_INVALID/);
  for (const result of [
    { ...launch(), campaign_id: uuid(9) },
    { ...launch(), extra: true },
    { action: 'surprise', campaign_id: pin.campaign_id },
    { action: 'media', campaign_id: pin.campaign_id, max_batches: 7 },
    { action: 'media_recover', campaign_id: pin.campaign_id, execution_id: 'not-owned' },
  ])
    assert.throws(() => rt.verifyM06CampaignTick(reply(result), request(), pin), /RECEIPT_INVALID/);
  for (const r of [
    { action: 'idle', campaign_id: pin.campaign_id, reason: 'awaiting_callback' },
    { action: 'blocked', campaign_id: pin.campaign_id, reason: 'uncertain_start' },
    {
      action: 'recover',
      campaign_id: pin.campaign_id,
      apify_run_id: 'KnownActor',
      run_id: uuid(2),
      registration_closed: true,
    },
    { action: 'closed', campaign_id: pin.campaign_id, reason: 'campaign_closed' },
  ])
    assert.deepEqual(rt.verifyM06CampaignTick(reply(r, true), request(), pin), r);
});

test('generated schedule calls pinned supported native children with no actor retry, public secret or generic queue', () => {
  const g = buildNativeM06Campaign(b, transport, pin, workflows).workflow;
  assert.equal(g.settings.timezone, 'Africa/Cairo');
  assert.equal(g.settings.executionTimeout, 2400);
  assert.equal(g.nodes.filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger').length, 1);
  assert.equal(g.nodes.find((n) => n.type === 'n8n-nodes-base.scheduleTrigger').typeVersion, 1.4);
  assert.deepEqual(
    g.nodes
      .filter((n) => n.type === 'n8n-nodes-base.executeWorkflow')
      .map((n) => n.parameters.workflowId.value),
    Object.values(workflows),
  );
  for (const n of g.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow')) {
    assert.equal(n.parameters.options.waitForSubWorkflow, true);
    assert.equal(n.retryOnFail, false);
  }
  assert.equal(
    g.nodes.find((n) => n.name === 'Dispatch one claimed story group').parameters.workflowInputs,
    undefined,
  );
  assert.equal(
    g.nodes.find((n) => n.name === 'Reconcile one story media batch').parameters.workflowInputs,
    undefined,
  );
  const r = executeCode(g, 'Verify claimed campaign operation', reply(launch()), {
    'Prepare campaign tick': request(),
  })[0].json;
  assert.equal(r.action, 'launch');
  for (const patch of [{ ...workflows, media: 'UNBOUND_MEDIA' }, undefined])
    assert.throws(() => buildNativeM06Campaign(b, transport, pin, patch), /BINDING/);
});

test('bounded durable story-lane continuation uses real child receipts and returns after six, holding failures', () => {
  const g = buildNativeM06Campaign(b, transport, pin, workflows).workflow;
  let state = executeCode(g, 'Prepare finite story media recovery', {
    action: 'media',
    campaign_id: pin.campaign_id,
    max_batches: 6,
  })[0].json;
  const receipt = (n) => ({
    version: 1,
    execution_id: '1005',
    state: 'completed',
    claimed: n,
    processed: n,
    held: 0,
    stored: n,
    skipped: 0,
    expired: 0,
    retryable: 0,
    reconciliation_required: 0,
    infrastructure_cost_usd: null,
  });
  for (let i = 0; i < 6; i++) {
    const input = executeCode(g, 'Prepare empty story recovery input', state)[0].json;
    assert.deepEqual(JSON.parse(JSON.stringify(input)), {});
    state = executeCode(g, 'Verify recovered story media', receipt(5), {
      'More story media recovery?': state,
    })[0].json;
  }
  assert.equal(state.action, 'done');
  assert.equal(state.batches, 6);
  const initial = { action: 'execute', remaining: 6, batches: 0, itemsNew: 0 };
  assert.equal(
    executeCode(g, 'Verify recovered story media', receipt(0), { 'More story media recovery?': initial })[0]
      .json.action,
    'done',
  );
  for (const patch of [{ held: 1 }, { retryable: 1 }, { state: 'reconciliation_required' }])
    assert.throws(
      () =>
        executeCode(
          g,
          'Verify recovered story media',
          { ...receipt(5), ...patch },
          { 'More story media recovery?': initial },
        ),
      /RECONCILIATION_REQUIRED/,
    );
});

test('known callback recovery closes only an unfinished registration and refuses uncertain completion', () => {
  const t = {
    action: 'recover',
    campaign_id: pin.campaign_id,
    apify_run_id: 'KnownActor',
    run_id: uuid(2),
    registration_closed: false,
  };
  const c = { accepted: true, state: 'completed', apify_run_id: 'KnownActor', replayed: false };
  const p = rt.prepareM06CampaignRecoveryClose(c, t, '1000');
  assert.equal(p.request.operation, 'm06.close_registration');
  assert.equal(p.request.args.run_id, t.run_id);
  assert.equal(
    rt.prepareM06CampaignRecoveryClose(c, { ...t, registration_closed: true }, '1000').action,
    'done',
  );
  assert.throws(() => rt.prepareM06CampaignRecoveryClose({ ...c, state: 'pending' }, t, '1000'), /UNSETTLED/);
  assert.throws(
    () => rt.prepareM06CampaignRecoveryClose({ ...c, apify_run_id: 'OtherActor' }, t, '1000'),
    /UNSETTLED/,
  );
});

test('assembled generated tick → preclaimed collector → asynchronous registration preserves slot identity', () => {
  const schedule = buildNativeM06Campaign(b, transport, pin, workflows).workflow;
  const collector = buildNativeCampaignStories(b, transport, pin).workflow;
  const initial = executeCode(schedule, 'Guard finite campaign', { timestamp: at })[0].json;
  assert.equal(initial.request.operation, 'm06.campaign_tick');
  const result = executeCode(schedule, 'Verify claimed campaign operation', reply(launch()), {
    'Prepare campaign tick': initial,
  })[0].json;
  const childInput = JSON.parse(JSON.stringify(result));
  let state = executeCode(collector, 'Initialize fixed stories selection', childInput)[0].json;
  const operations = [];
  const gatewayReply = (state, result) => ({
    statusCode: 200,
    body: {
      version: 1,
      requestId: state.request.requestId,
      operation: state.request.operation,
      replayed: false,
      result,
    },
  });
  const descriptor = {
    billingModel: 'PPE',
    actorPath: 'data-slayer~instagram-stories-scraper',
    actorId: 'SyntheticActor',
    ownerId: 'SyntheticOwner',
    build: '1.0.32',
    buildId: 'SyntheticBuild',
    maxTotalChargeUsd: 1,
    maxOutputItems: 600,
    memory: 1024,
    timeout: 180,
  };
  operations.push(state.request.operation);
  const prepared = executeCode(collector, 'Prepare stories gateway', state)[0].json;
  state = executeCode(
    collector,
    'Advance stories gateway',
    gatewayReply(state, { launch_id: state.launchId, permit: true, replayed: false, descriptor }),
    { 'Prepare stories gateway': prepared },
  )[0].json;
  assert.equal(state.action, 'apify');
  const actorPrior = executeCode(collector, 'Prepare stories actor', state)[0].json;
  state = executeCode(
    collector,
    'Advance stories actor response',
    {
      statusCode: 201,
      body: {
        data: {
          id: 'SyntheticCampaignActor',
          actId: descriptor.actorId,
          userId: descriptor.ownerId,
          buildId: descriptor.buildId,
          buildNumber: descriptor.build,
          options: { maxTotalChargeUsd: 1, memoryMbytes: 1024, timeoutSecs: 180 },
        },
      },
    },
    { 'Prepare stories actor': actorPrior },
  )[0].json;
  operations.push(state.request.operation);
  const registration = executeCode(collector, 'Prepare stories gateway', state)[0].json;
  state = executeCode(
    collector,
    'Advance stories gateway',
    gatewayReply(state, {
      registered: true,
      run_id: childInput.run_id,
      apify_run_id: 'SyntheticCampaignActor',
    }),
    { 'Prepare stories gateway': registration },
  )[0].json;
  operations.push(state.request.operation);
  const close = executeCode(collector, 'Prepare stories gateway', state)[0].json;
  state = executeCode(
    collector,
    'Advance stories gateway',
    gatewayReply(state, {
      registration_closed: true,
      finished_now: false,
      state: 'awaiting_callbacks',
      summary: null,
    }),
    { 'Prepare stories gateway': close },
  )[0].json;
  const dispatch = executeCode(collector, 'Return stories dispatch result', state)[0].json;
  const confirmed = executeCode(schedule, 'Verify one story dispatch', dispatch)[0].json;
  assert.deepEqual(operations, ['m06.launch', 'm06.register', 'm06.close_registration']);
  assert.equal(dispatch.run_id, childInput.run_id);
  assert.equal(confirmed.actor_run_ids[0], 'SyntheticCampaignActor');
  assert.equal(dispatch.actor_starts, 1);
});

test('assembled recovery and closure settle a known callback without creating another paid launch', () => {
  const graph = buildNativeM06Campaign(b, transport, pin, workflows).workflow;
  const recovery = {
    action: 'recover',
    campaign_id: pin.campaign_id,
    apify_run_id: 'KnownActor',
    run_id: uuid(2000),
    registration_closed: false,
  };
  const tick = executeCode(graph, 'Verify claimed campaign operation', reply(recovery), {
    'Prepare campaign tick': request(),
  })[0].json;
  const close = executeCode(
    graph,
    'Prepare recovery registration close',
    { accepted: true, state: 'completed', apify_run_id: 'KnownActor', replayed: true },
    { 'Recover known callback?': tick },
  )[0].json;
  assert.equal(close.request.operation, 'm06.close_registration');
  const prepared = executeCode(graph, 'Prepare recovered close request', close)[0].json;
  const result = executeCode(
    graph,
    'Verify recovered registration',
    {
      statusCode: 200,
      body: {
        version: 1,
        requestId: close.request.requestId,
        operation: 'm06.close_registration',
        replayed: false,
        result: {
          registration_closed: true,
          finished_now: true,
          state: 'completed',
          summary: { run_id: tick.run_id, status: 'success' },
        },
      },
    },
    { 'Prepare recovered close request': prepared },
  )[0].json;
  assert.equal(result.state, 'completed');
  const alreadyClosed = executeCode(
    graph,
    'Prepare recovery registration close',
    { accepted: true, state: 'completed', apify_run_id: 'KnownActor', replayed: true },
    { 'Recover known callback?': { ...tick, registration_closed: true } },
  )[0].json;
  assert.equal(alreadyClosed.action, 'done');
  assert.equal(alreadyClosed.request, undefined);
});

test('blocked shared-lane or uncertain-start receipt reaches no child and cannot replace a paid start', () => {
  const graph = buildNativeM06Campaign(b, transport, pin, workflows).workflow;
  for (const reason of ['uncertain_start', 'story_media_uncertain', 'awaiting_primary_media']) {
    const action = reason === 'awaiting_primary_media' ? 'idle' : 'blocked';
    const r = executeCode(
      graph,
      'Verify claimed campaign operation',
      reply({ action, campaign_id: pin.campaign_id, reason }),
      { 'Prepare campaign tick': request() },
    )[0].json;
    assert.equal(r.action === 'launch', false);
    assert.equal(r.action === 'recover', false);
    assert.equal(r.action === 'media', false);
    if (action === 'blocked')
      assert.throws(
        () => executeCode(graph, 'Return finite campaign operation', r),
        /RECONCILIATION_REQUIRED/,
      );
    else assert.equal(executeCode(graph, 'Return finite campaign operation', r)[0].json.action, 'idle');
  }
});

test('unbound maintained campaign export is explicitly synthetic, inactive, and refuses before every HTTP or child', () => {
  const output = buildUnboundNativeM06Campaign(b);
  assert.equal(output.fixture.synthetic, true);
  assert.equal(output.workflow.active, false);
  assert.equal(output.bindingManifest.ready, false);
  assert.throws(() => executeCode(output.workflow, 'Guard finite campaign', {}), /BINDING_REQUIRED/);
  const saved = JSON.parse(
    readFileSync(new URL('../workflows/WF-12-M06-campaign.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(saved, output);
});
