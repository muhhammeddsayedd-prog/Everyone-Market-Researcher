import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildStoryBatches } from './stories.mjs';
import {
  prepareM06StoryMediaHandoff,
  advanceM06StoryMediaHandoff,
  buildM06StoryMediaHandoff,
} from './m06-story-media-handoff.mjs';
import {
  buildNativeStories,
  buildUnboundNativeStories,
  m06StoriesCloudSource,
} from './build-native-m06-stories.mjs';
import { m06StoryArgs } from '../../packages/shared/src/n8n-m06-contracts.ts';
import {
  collectorRequest,
  m06RunPolicy,
  collectorPolicy,
} from '../../packages/shared/src/n8n-collector-contracts.ts';
const bindings = JSON.parse(
  readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
);
const transport = {
  audience: 'https://everyone-market-researcher-local-fixture.vercel.app',
  credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const uuid = (n) => `62000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const runId = uuid(1000),
  actor = 'data-slayer/instagram-stories-scraper';
const accounts = (n) =>
  Array.from({ length: n }, (_, i) => ({
    account_id: uuid(i + 1),
    competitor_id: uuid(i + 100),
    platform: 'instagram_stories',
    handle: `synthetic${i.toString().padStart(3, '0')}`,
    url: `https://www.instagram.com/synthetic${i.toString().padStart(3, '0')}/`,
    backfill_status: 'not_applicable',
  }));
const selection = (n = 3, actorId = actor, collectionMode = 'ingest') => ({
  env: 'dev',
  mode: 'daily',
  actor_id: actorId,
  collection_mode: collectionMode,
  account_ids: accounts(n).map((a) => a.account_id),
  results_limit: 10,
  max_actor_starts: 5,
});
const rt = () =>
  runInNewContext(
    m06StoriesCloudSource + '\n({initializeM06Stories,advanceM06StoryGateway,advanceM06StoryActor})',
    {},
    { timeout: 1000 },
  );
const reply = (s, result, replayed = false) => ({
  statusCode: 200,
  body: { version: 1, requestId: s.request.requestId, operation: s.request.operation, result, replayed },
});
const descriptor = (s) => ({
  billingModel: 'PPE',
  actorPath: s.actorId.replace('/', '~'),
  actorId: 'SyntheticActor',
  ownerId: 'SyntheticOwner',
  build: '1.0.32',
  buildId: 'SyntheticBuild',
  maxTotalChargeUsd: 1.125,
  maxOutputItems: s.batches[s.batchIndex].account_ids.length * s.resultsLimit,
  memory: 1024,
  timeout: 600,
});
function drive(n = 3, actorId = actor, mode = 'ingest', finishRace = false) {
  const r = rt();
  let s = r.initializeM06Stories(selection(n, actorId, mode), '101', '2026-10-29T01:00:00Z');
  const calls = [];
  let starts = 0;
  for (let i = 0; i < 50 && s.action !== 'done'; i++) {
    if (s.action === 'gateway') {
      calls.push(structuredClone(s.request));
      m06StoryArgs[s.request.operation].parse(s.request.args);
      let result;
      if (s.request.operation === 'm06.start') result = { run_id: runId };
      else if (s.request.operation === 'm06.claim') result = accounts(n);
      else if (s.request.operation === 'm06.launch')
        result = { permit: true, replayed: false, launch_id: s.launchId, descriptor: descriptor(s) };
      else if (s.request.operation === 'm06.register')
        result = { registered: true, run_id: runId, apify_run_id: s.startedActorId };
      else
        result = finishRace
          ? {
              registration_closed: true,
              finished_now: true,
              state: 'completed',
              summary: { run_id: runId, status: 'success' },
            }
          : { registration_closed: true, finished_now: false, state: 'awaiting_callbacks', summary: null };
      s = r.advanceM06StoryGateway(s, reply(s, result));
    } else {
      starts++;
      const d = s.launchDescriptor;
      s = r.advanceM06StoryActor(s, {
        statusCode: 201,
        body: {
          data: {
            id: `SyntheticRun${starts}`,
            actId: d.actorId,
            userId: d.ownerId,
            buildId: d.buildId,
            buildNumber: d.build,
            options: {
              maxTotalChargeUsd: d.maxTotalChargeUsd,
              maxItems: null,
              memoryMbytes: d.memory,
              timeoutSecs: d.timeout,
            },
          },
        },
      });
    }
  }
  return { s, calls, starts };
}
test('current public INPUT planning uses usernames only, actor-specific account bounds and no fake history completion', () => {
  for (const a of [
    'data-slayer/instagram-stories-scraper',
    'igview-owner/instagram-story-viewer',
    'louisdeconinck/instagram-story-details-scraper',
  ]) {
    const batches = buildStoryBatches(accounts(51), {
      actor_id: a,
      collection_mode: 'bakeoff',
      results_limit: 10,
    });
    assert.equal(batches.length, a.startsWith('igview') ? 2 : 1);
    for (const b of batches) {
      assert.deepEqual(Object.keys(b.input), ['usernames']);
      assert.equal(b.input.usernames.length, b.account_ids.length);
      assert.equal(b.coverage.complete, false);
    }
  }
  assert.throws(() =>
    buildStoryBatches(accounts(1), {
      actor_id: 'apify/instagram-scraper',
      collection_mode: 'ingest',
      results_limit: 10,
    }),
  );
  assert.throws(() =>
    buildStoryBatches([{ ...accounts(1)[0], platform: 'instagram' }], {
      actor_id: actor,
      collection_mode: 'ingest',
      results_limit: 10,
    }),
  );
  assert.throws(() =>
    buildStoryBatches([accounts(1)[0], accounts(1)[0]], {
      actor_id: actor,
      collection_mode: 'ingest',
      results_limit: 10,
    }),
  );
});
test('serialized native path registers every actor batch before closing, with callbacks still pending', () => {
  const { s, calls, starts } = drive(51, 'igview-owner/instagram-story-viewer', 'bakeoff');
  assert.equal(starts, 2);
  assert.equal(s.result.state, 'awaiting_callbacks');
  assert.deepEqual(
    calls.map((c) => c.operation),
    [
      'm06.start',
      'm06.claim',
      'm06.launch',
      'm06.register',
      'm06.launch',
      'm06.register',
      'm06.close_registration',
    ],
  );
  assert.equal(calls[0].args.collection_mode, 'bakeoff');
  assert.equal(s.result.actor_starts, 2);
});
test('registration-close races report an already completed parent accurately', () => {
  assert.equal(drive(3, actor, 'ingest', true).s.result.state, 'completed');
});
test('native graph is inactive, private, asynchronous and uses existing native credentials', () => {
  const d = buildNativeStories(bindings, transport, selection());
  assert.equal(d.workflow.active, false);
  assert.equal(d.hostedAcceptance, false);
  assert.equal(d.workflow.settings.availableInMCP, false);
  assert.equal(d.workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(d.workflow.settings.saveDataErrorExecution, 'none');
  assert.equal(d.workflow.settings.saveManualExecutions, false);
  assert.ok(!d.workflow.nodes.some((n) => n.type.endsWith('scheduleTrigger')));
  for (const node of d.workflow.nodes) {
    if (node.type.endsWith('.code'))
      assert.doesNotMatch(node.parameters.jsCode, /\b(?:fetch|require|import)\s*\(/);
    if (node.type.endsWith('.httpRequest')) {
      assert.equal(node.parameters.options.allowUnauthorizedCerts, false);
      assert.equal(node.retryOnFail, false);
      assert.equal(node.parameters.options.redirect.redirect.followRedirects, false);
    }
  }
  const start = d.workflow.nodes.find((n) => n.name === 'Start asynchronous stories actor');
  assert.equal(start.parameters.nodeCredentialType, 'apifyApi');
  assert.equal(start.credentials.apifyApi.id, bindings.credentials.apify.id);
  assert.match(start.parameters.url, /waitForFinish=0&restartOnError=false/);
  assert.match(start.parameters.url, /maxTotalChargeUsd/);
});
test('claim mismatch and duplicate identities stop before an actor admission', () => {
  const r = rt();
  let s = r.initializeM06Stories(selection(), '102', '2026-10-29T01:00:00Z');
  s = r.advanceM06StoryGateway(s, reply(s, { run_id: runId }));
  assert.throws(() => r.advanceM06StoryGateway(s, reply(s, [accounts(1)[0]])), /CLAIM_INVALID/);
});
test('the maintained unbound export refuses before gateway, provider or credential I/O', () => {
  const definition = buildUnboundNativeStories(bindings, selection());
  expectUnbound(definition);
  const exported = JSON.parse(
    readFileSync(new URL('../workflows/WF-12-instagram-stories.json', import.meta.url), 'utf8'),
  );
  const observed = JSON.parse(
    readFileSync(
      new URL(
        '../../milestones/M06-collectors-stories-upkeep/evidence/story-account-selection-20261029.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.deepEqual(
    exported,
    buildUnboundNativeStories(bindings, {
      env: 'dev',
      mode: 'daily',
      actor_id: actor,
      collection_mode: 'ingest',
      account_ids: observed.accounts.map((a) => a.accountId),
      results_limit: 50,
      max_actor_starts: 1,
    }),
  );
  expectUnbound(exported);
  function expectUnbound(d) {
    assert.equal(d.bindingManifest.ready, false);
    const code = d.workflow.nodes.find((n) => n.name === 'Initialize fixed stories selection').parameters
      .jsCode;
    assert.throws(
      () =>
        runInNewContext(
          '(function(){' + code + '})()',
          { $input: { all: () => [{ json: {} }] }, $execution: { id: '99' } },
          { timeout: 1000 },
        ),
      /M06_STORIES_BINDING_REQUIRED/,
    );
  }
});
test('known actor IDs are registered before a changed cap or identity blocks every further start', () => {
  const r = rt();
  let s = r.initializeM06Stories(selection(), '103', '2026-10-29T01:00:00Z');
  s = r.advanceM06StoryGateway(s, reply(s, { run_id: runId }));
  s = r.advanceM06StoryGateway(s, reply(s, accounts(3)));
  s = r.advanceM06StoryGateway(
    s,
    reply(s, { permit: true, replayed: false, launch_id: s.launchId, descriptor: descriptor(s) }),
  );
  s = r.advanceM06StoryActor(s, {
    statusCode: 201,
    body: { data: { id: 'KnownUncertainRun', options: { maxTotalChargeUsd: 99 } } },
  });
  assert.equal(s.request.operation, 'm06.register');
  assert.equal(s.request.args.apify_run_id, 'KnownUncertainRun');
  assert.throws(
    () =>
      r.advanceM06StoryGateway(
        s,
        reply(s, { registered: true, run_id: runId, apify_run_id: 'KnownUncertainRun' }),
      ),
    /PROVIDER_OPTIONS_RECONCILIATION_REQUIRED/,
  );
});
test('lost or invalid native starts are never automatically replaced; permit replay cannot start again', () => {
  const r = rt();
  let s = r.initializeM06Stories(selection(), '104', '2026-10-29T01:00:00Z');
  s = r.advanceM06StoryGateway(s, reply(s, { run_id: runId }));
  s = r.advanceM06StoryGateway(s, reply(s, accounts(3)));
  assert.throws(
    () =>
      r.advanceM06StoryGateway(
        s,
        reply(s, { permit: true, replayed: false, launch_id: s.launchId, descriptor: descriptor(s) }, true),
      ),
    /RECONCILIATION_REQUIRED/,
  );
  s = r.advanceM06StoryGateway(
    s,
    reply(
      s,
      { permit: false, replayed: true, launch_id: s.launchId, apify_run_id: 'AlreadyAdmittedRun' },
      true,
    ),
  );
  assert.equal(s.action, 'gateway');
  assert.equal(s.request.operation, 'm06.register');
  assert.equal(s.actorStarts, 0);
  assert.throws(
    () =>
      r.advanceM06StoryGateway(
        s,
        reply(s, { registered: true, run_id: runId, apify_run_id: 'AlreadyAdmittedRun' }),
      ),
    /PROVIDER_OPTIONS_RECONCILIATION_REQUIRED/,
  );
});
test('nonfinite/nonpositive charge descriptors and mismatched output allocation are rejected', () => {
  for (const patch of [
    { maxTotalChargeUsd: 0 },
    { maxTotalChargeUsd: NaN },
    { maxTotalChargeUsd: Infinity },
    { maxTotalChargeUsd: '1' },
    { maxOutputItems: 1 },
  ]) {
    const r = rt();
    let s = r.initializeM06Stories(selection(), '105', '2026-10-29T01:00:00Z');
    s = r.advanceM06StoryGateway(s, reply(s, { run_id: runId }));
    s = r.advanceM06StoryGateway(s, reply(s, accounts(3)));
    assert.throws(
      () =>
        r.advanceM06StoryGateway(
          s,
          reply(s, {
            permit: true,
            replayed: false,
            launch_id: s.launchId,
            descriptor: { ...descriptor(s), ...patch },
          }),
        ),
      /RECONCILIATION_REQUIRED/,
    );
  }
});
test('internal source settlement is absent from the external Machine request parser and M04 policy stays closed', () => {
  assert.throws(() =>
    collectorRequest({ version: 1, requestId: uuid(1), operation: 'm06.settle', args: {} }),
  );
  const p = {
    approval_id: uuid(1),
    max_actor_starts: 3,
    max_actor_usd: 12,
    max_total_usd: 36,
    max_results_per_profile: 10,
    actors: {
      [actor]: {
        billingModel: 'PPE',
        actorId: 'A',
        owner_id: 'O',
        build: '1.0.32',
        buildId: 'B',
        memoryMbytes: 1024,
        timeoutSecs: 600,
      },
    },
  };
  assert.equal(m06RunPolicy.safeParse(p).success, true);
  assert.equal(
    m06RunPolicy.safeParse({
      ...p,
      actors: { [actor]: { ...p.actors[actor], inputDefaults: { unsupported: true } } },
    }).success,
    false,
  );
  assert.equal(collectorPolicy.safeParse(p).success, false);
});

const mediaBinding = {
  environment: 'dev',
  queue: 'stories',
  workflowId: 'LocalOwnedStoryMedia31',
  audience: 'https://everyone-market-researcher-local-stories.vercel.app',
  batchSize: 5,
};
const mediaReceipt = (claimed) => ({
  version: 1,
  execution_id: '62001',
  state: 'completed',
  claimed,
  processed: claimed,
  held: 0,
  stored: claimed,
  skipped: 0,
  expired: 0,
  retryable: 0,
  reconciliation_required: 0,
  infrastructure_cost_usd: null,
});
test('committed story ingestion immediately dispatches finite native media batches independently of the generic backlog', () => {
  const fragment = buildM06StoryMediaHandoff(bindings, mediaBinding);
  const prepare = fragment.nodes.find((n) => n.name === fragment.entry);
  const advance = fragment.nodes.find((n) => n.name === 'Advance story media delivery');
  const child = fragment.nodes.find((n) => n.name === 'Process new story media');
  assert.equal(child.typeVersion, 1.4);
  assert.equal(child.parameters.workflowId.value, mediaBinding.workflowId);
  assert.equal(child.parameters.mode, 'once');
  assert.equal(child.parameters.options.waitForSubWorkflow, true);
  assert.deepEqual(child.parameters.workflowInputs.value, {});
  assert.equal(child.retryOnFail, false);
  const input = { state: 'completed', updated: true, media_dispatch: { queue: 'stories', items_new: 12 } };
  let state = runInNewContext('(function(){' + prepare.parameters.jsCode + '})()', {
    $input: { all: () => [{ json: input }] },
  })[0].json;
  const executions = [];
  for (const claimed of [5, 5, 2]) {
    assert.equal(state.action, 'execute');
    executions.push({ workflowId: child.parameters.workflowId.value, input: {} });
    const prior = state;
    state = runInNewContext('(function(){' + advance.parameters.jsCode + '})()', {
      $input: { all: () => [{ json: mediaReceipt(claimed) }] },
      $: () => ({ item: { json: prior } }),
    })[0].json;
  }
  assert.equal(state.action, 'done');
  assert.equal(state.batches, 3);
  assert.equal(executions.length, 3);
});
test('story media wakes exclude replay, comparison, failed/no-item results and stop on unsafe child receipts', () => {
  for (const result of [
    { state: 'completed', updated: false, media_dispatch: { queue: 'stories', items_new: 12 } },
    { state: 'completed', updated: true, media_dispatch: null },
  ])
    assert.equal(prepareM06StoryMediaHandoff(result, mediaBinding).action, 'done');
  assert.throws(
    () => prepareM06StoryMediaHandoff({}, { ...mediaBinding, queue: 'media' }),
    /BINDING_REQUIRED/,
  );
  const state = prepareM06StoryMediaHandoff(
    { state: 'completed', updated: true, media_dispatch: { queue: 'stories', items_new: 12 } },
    mediaBinding,
  );
  for (const patch of [
    { state: 'reconciliation_required' },
    { retryable: 1 },
    { held: 1 },
    { infrastructure_cost_usd: 0 },
    { processed: 0 },
  ])
    assert.throws(
      () => advanceM06StoryMediaHandoff(state, { ...mediaReceipt(5), ...patch }),
      /RECONCILIATION_REQUIRED/,
    );
  assert.equal(advanceM06StoryMediaHandoff(state, mediaReceipt(0)).action, 'done');
});
