import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import {
  buildNativeCollector,
  extendNativeCallback,
  collectorCloudSource,
  parseCollectorTransport,
} from './build-native-collectors.mjs';
import {
  initializeCollector,
  advanceCollectorGateway,
  advanceVimeoNative,
  advanceInstagramNative,
  vimeoNativeRequest,
} from './native-runtime.mjs';
import { buildInstagramBatches } from './instagram.mjs';
import vimeo from '../normalizers/vimeoApi.js';
import { generateCollectorBlueprints } from './generate-native-collectors.mjs';

const bindings = JSON.parse(
  readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
);
const baseline = JSON.parse(readFileSync(new URL('../workflows/WF-19.json', import.meta.url), 'utf8'));
const transport = {
  audience: 'https://everyone-market-researcher-synthetic.vercel.app',
  credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const runId = '11111111-1111-4111-a111-111111111111';
const account = (n) => ({
  account_id: `${String(n).padStart(8, '0')}-1111-4111-a111-111111111111`,
  competitor_id: '22222222-2222-4222-a222-222222222222',
  handle: 'publicstudio' + n,
  url: 'https://vimeo.com/publicstudio' + n,
  external_id: String(n + 100),
  watermark_published_at: null,
  backfill_cursor: null,
});
const ids = (n) => Array.from({ length: n }, (_, i) => account(i + 1).account_id);
const ack = (state, result, replayed = false) => ({
  statusCode: 200,
  body: {
    version: 1,
    requestId: state.request.requestId,
    operation: state.request.operation,
    replayed,
    result,
  },
});
const applyGateway = (state, result, replayed) =>
  advanceCollectorGateway(state, ack(state, result, replayed), buildInstagramBatches);
const vmCode = (source, input, selectors = {}, executionId = '99123') =>
  vm.runInNewContext('(function(){' + source + '\n})()', {
    $input: { all: () => [{ json: structuredClone(input) }] },
    $execution: { id: executionId },
    $: (name) => ({
      item: { json: structuredClone(selectors[name]) },
      first: () => ({ json: structuredClone(selectors[name]) }),
    }),
    URL: undefined,
    require: undefined,
    console: undefined,
  });
const nativeNode = (graph, name) => graph.workflow.nodes.find((n) => n.name === name);

test('all emitted Code compiles and executes initialization without URL, require, credentials or network', () => {
  for (const kind of ['vimeo', 'instagram']) {
    const graph = buildNativeCollector(bindings, transport, kind);
    for (const n of graph.workflow.nodes.filter((n) => n.type.endsWith('.code')))
      new vm.Script('(function(){' + n.parameters.jsCode + '\n})()');
    const state = vmCode(nativeNode(graph, 'Initialize collector').parameters.jsCode, {
      mode: 'backfill',
      limit: 2,
      account_ids: ids(2),
      max_pages: 1,
      page_size: 5,
      results_limit: 5,
      max_actor_starts: 2,
    })[0].json;
    assert.equal(state.request.operation, 'start');
    assert.equal(state.request.args.platform, kind);
    assert.equal(state.action, 'gateway');
    assert.equal(graph.workflow.active, false);
    assert.equal(graph.hostedAcceptance, false);
  }
});

test('native Vimeo graph uses existing Header Auth and strict nonredirecting TLS; Instagram uses predefined native Apify API', () => {
  for (const kind of ['vimeo', 'instagram']) {
    const graph = buildNativeCollector(bindings, transport, kind);
    for (const n of graph.workflow.nodes.filter((n) => n.type.endsWith('.httpRequest'))) {
      assert.equal(n.parameters.options.allowUnauthorizedCerts, false);
      assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
      assert.equal(n.parameters.options.sendCredentialsOnCrossOriginRedirect, false);
      assert.equal(n.retryOnFail, false);
      assert.equal(n.parameters.url.includes('run-sync'), false);
      assert.equal(n.type.includes('postgres'), false);
    }
    const provider = graph.workflow.nodes.find((n) =>
      n.name.includes(kind === 'vimeo' ? 'Read public Vimeo' : 'Start asynchronous'),
    );
    if (kind === 'instagram') {
      assert.equal(provider.parameters.authentication, 'predefinedCredentialType');
      assert.equal(provider.parameters.nodeCredentialType, 'apifyApi');
      assert.deepEqual(provider.credentials, {
        apifyApi: { id: bindings.credentials.apify.id, name: bindings.credentials.apify.name },
      });
      assert.match(provider.parameters.url, /waitForFinish=0/);
      assert.match(provider.parameters.url, /launchDescriptor\.build/);
      assert.match(provider.parameters.url, /maxTotalChargeUsd/);
    } else assert.equal(provider.credentials.httpHeaderAuth.id, bindings.credentials.vimeo.id);
  }
});

test('official Vimeo connects selected claim through normalization, ingest, eight-field reporting, zero-cost and run finish', () => {
  let state = initializeCollector(
    { mode: 'backfill', limit: 1, account_ids: [account(1).account_id], max_pages: 1, page_size: 5 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  assert.deepEqual(state.request.args.account_ids, [account(1).account_id]);
  state = applyGateway(state, [account(1)]);
  assert.equal(state.action, 'vimeo');
  assert.match(state.providerUrl, /^https:\/\/api\.vimeo\.com\/users\/101\/videos\?/);
  state = advanceVimeoNative(
    state,
    {
      statusCode: 200,
      body: {
        data: [
          {
            uri: '/videos/123',
            link: 'https://vimeo.com/123',
            name: 'Public film',
            description: 'Synthetic',
            privacy: { view: 'anybody' },
            created_time: '2026-10-26T00:00:00Z',
          },
        ],
        paging: { next: null },
      },
    },
    vimeo.normalizeVimeoApiResult,
  );
  assert.equal(state.request.operation, 'ingest');
  assert.equal(state.request.args.items[0].actor, 'vimeo-api');
  state = applyGateway(state, { inserted: 1, duplicates: 0 });
  assert.deepEqual(
    Object.keys(state.request.args).sort(),
    [
      'run_id',
      'account_id',
      'status',
      'items_seen',
      'items_new',
      'error',
      'backfill_done',
      'backfill_cursor',
    ].sort(),
  );
  assert.equal(state.request.args.items_new, 1);
  state = applyGateway(state, { ok: true });
  assert.equal(state.request.operation, 'cost');
  assert.equal(state.request.args.entries[0].cost_usd, 0);
  assert.equal(state.request.args.entries[0].quantity, 1);
  state = applyGateway(state, { inserted: 1 });
  assert.equal(state.request.operation, 'finish');
  state = applyGateway(state, { status: 'success', items_new: 1 });
  assert.equal(state.action, 'done');
});

test('emitted Vimeo provider-advance code normalizes actual synthetic API shape with unavailable URL global', () => {
  const graph = buildNativeCollector(bindings, transport, 'vimeo');
  let state = initializeCollector(
    { mode: 'backfill', limit: 1, account_ids: ids(1), page_size: 5, max_pages: 1 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(state, [account(1)]);
  const result = vmCode(
    nativeNode(graph, 'Advance provider result').parameters.jsCode,
    {
      statusCode: 200,
      body: {
        data: [
          {
            uri: '/videos/123',
            link: 'https://vimeo.com/123',
            privacy: { view: 'anybody' },
            created_time: '2026-10-26T00:00:00Z',
          },
        ],
        paging: { next: null },
      },
    },
    { 'Prepare collector action': state },
  )[0].json;
  assert.equal(result.request.operation, 'ingest');
  assert.equal(result.request.args.items[0].external_id, '123');
});

test('Instagram posts and reels share one parent claim and registration closes only after BOTH passes are registered', () => {
  let state = initializeCollector(
    { mode: 'backfill', limit: 2, account_ids: ids(2), results_limit: 5, max_actor_starts: 2 },
    'instagram',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(
    state,
    [1, 2].map((n) => ({ ...account(n), url: 'https://www.instagram.com/publicstudio' + n + '/' })),
  );
  assert.equal(state.batches.length, 2);
  assert.equal(state.request.operation, 'launch');
  assert.equal(state.request.args.pass, 'posts');
  assert.equal(state.request.args.results_limit, 5);
  const accountIds = [...state.request.args.account_ids];
  for (const [index, pass] of ['posts', 'reels'].entries()) {
    assert.equal(state.request.args.pass, pass);
    assert.deepEqual(state.request.args.account_ids, accountIds);
    state = applyGateway(state, {
      permit: true,
      launch_id: state.launchId,
      apify_run_id: null,
      descriptor: {
        actorPath: 'apify~instagram-scraper',
        build: '0.0.123',
        maxTotalChargeUsd: 1,
        maxItems: 10,
        timeout: 600,
        memory: 1024,
      },
    });
    assert.equal(state.action, 'apify');
    state = advanceInstagramNative(state, {
      statusCode: 201,
      body: { data: { id: 'SYNTHETIC_RUN_' + index, defaultDatasetId: 'SYNTHETIC_DATASET' } },
    });
    assert.equal(state.request.operation, 'register');
    assert.equal(Object.hasOwn(state.request.args, 'default_dataset_id'), false);
    state = applyGateway(state, { registered: true, apify_run_id: 'SYNTHETIC_RUN_' + index, run_id: runId });
  }
  assert.equal(state.request.operation, 'close_registration');
  assert.equal(state.actorStarts, 2);
  state = applyGateway(state, {
    registration_closed: true,
    pending_passes: 4,
    finished_now: false,
    summary: null,
  });
  assert.equal(state.action, 'done');
  assert.equal(state.summary.finished_now, false);
});

test('one parent supports multiple account batches without reclaiming or closing during registration', () => {
  let state = initializeCollector(
    { mode: 'backfill', limit: 11, account_ids: ids(11), results_limit: 5, max_actor_starts: 4 },
    'instagram',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(
    state,
    Array.from({ length: 11 }, (_, n) => ({
      ...account(n + 1),
      url: 'https://www.instagram.com/publicstudio' + (n + 1) + '/',
    })),
  );
  assert.equal(state.batches.length, 4);
  assert.deepEqual(
    state.batches.map((b) => [b.result_type, b.account_ids.length]),
    [
      ['posts', 10],
      ['posts', 1],
      ['reels', 10],
      ['reels', 1],
    ],
  );
  assert.equal(state.request.operation, 'launch');
  assert.equal(state.request.args.account_ids.length, 10);
});

test('ambiguous actor POST and replayed launch permit never authorize another POST or close the parent', () => {
  let state = initializeCollector(
    { mode: 'backfill', limit: 1, account_ids: ids(1), results_limit: 5 },
    'instagram',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(state, [{ ...account(1), url: 'https://www.instagram.com/publicstudio1/' }]);
  const result = {
    permit: true,
    launch_id: state.launchId,
    apify_run_id: null,
    descriptor: {
      actorPath: 'apify~instagram-scraper',
      build: '0.0.123',
      maxTotalChargeUsd: 1,
      maxItems: 5,
      timeout: 600,
      memory: 1024,
    },
  };
  assert.throws(() => applyGateway(structuredClone(state), result, true), /LAUNCH_RECONCILIATION/);
  state = applyGateway(state, result);
  assert.throws(
    () => advanceInstagramNative(state, { statusCode: 504, body: { error: 'synthetic' } }),
    /START_RECONCILIATION/,
  );
  assert.equal(state.batchIndex, 0);
  assert.equal(state.actorStarts, 0);
});

test('callback extension preserves historical foundation nodes while classifying before trusted M04 processing', () => {
  const graph = extendNativeCallback(bindings, transport, baseline);
  for (const old of baseline.workflow.nodes)
    assert.deepEqual(
      graph.workflow.nodes.find((n) => n.id === old.id),
      old,
    );
  for (const n of graph.workflow.nodes.filter((n) => n.type.endsWith('.code')))
    new vm.Script('(function(){' + n.parameters.jsCode + '\n})()');
  assert.equal(
    graph.workflow.connections['Validate callback source'].main[0][0].node,
    'Prepare callback classification',
  );
  assert.equal(
    graph.workflow.connections['Foundation registered callback?'].main[0][0].node,
    baseline.workflow.connections['Validate callback source'].main[0][0].node,
  );
  const processed = nativeNode(graph, 'Prepare M04 callback processing');
  const next = vmCode(processed.parameters.jsCode, {
    apify_run_id: 'SYNTHETIC_RUN',
    transport: 'webhook',
    pageNumber: 1,
  })[0].json;
  assert.deepEqual(Object.keys(next.request.args), ['apify_run_id']);
  assert.equal(next.request.operation, 'callback.process');
  assert.throws(
    () => vmCode(processed.parameters.jsCode, { apify_run_id: 'SYNTHETIC_RUN', pageNumber: 61 }),
    /PAGE_BOUND/,
  );
  const prior = { ...next, source: { apify_run_id: 'SYNTHETIC_RUN', transport: 'webhook' } };
  const advanced = vmCode(
    nativeNode(graph, 'Verify M04 callback receipt').parameters.jsCode,
    ack({ request: next.request }, { state: 'pending', next_offset: 500 }),
    { 'Prepare M04 callback processing': prior },
  )[0].json;
  assert.equal(advanced.pending, true);
  assert.equal(advanced.pageNumber, 2);
  assert.notEqual(
    vmCode(processed.parameters.jsCode, advanced)[0].json.request.requestId,
    next.request.requestId,
  );
});

test('production target, unsafe transport and separate Instagram pass inputs fail before side effects', () => {
  assert.throws(
    () => initializeCollector({ mode: 'daily', env: 'prod' }, 'vimeo', '99123', '2026-10-27T10:00:00Z'),
    /INPUT_INVALID/,
  );
  assert.throws(
    () =>
      initializeCollector(
        { mode: 'daily', result_type: 'reels' },
        'instagram',
        '99123',
        '2026-10-27T10:00:00Z',
      ),
    /INPUT_INVALID/,
  );
  assert.throws(
    () => parseCollectorTransport({ ...transport, audience: 'http://localhost:3000' }),
    /TRANSPORT_INVALID/,
  );
  assert.throws(
    () =>
      vm.runInNewContext(
        collectorCloudSource +
          ';initializeCollector(' +
          JSON.stringify({ mode: 'daily', limit: 1, account_ids: ids(1) }) +
          ',"vimeo","not-numeric","2026-10-27T10:00:00Z")',
        { URL: undefined, require: undefined },
      ),
    /EXECUTION_ID_INVALID/,
  );
});

test('native Vimeo waits for an exhausted successful-response quota before the next page', () => {
  let state = initializeCollector(
    { mode: 'backfill', limit: 1, account_ids: ids(1), page_size: 5, max_pages: 2 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(state, [account(1)]);
  state = advanceVimeoNative(
    state,
    {
      statusCode: 200,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2026-10-27T10:01:00Z' },
      body: { data: [], paging: { next: '/users/101/videos?page=2&per_page=5' } },
    },
    vimeo.normalizeVimeoApiResult,
  );
  assert.equal(state.action, 'wait');
  assert.equal(state.waitSeconds, 60);
  state = vimeoNativeRequest(state);
  assert.equal(state.action, 'vimeo');
  assert.match(state.providerUrl, /page=2/);
});

test('native Vimeo bounds each ingestion body as well as the PostgreSQL500-item ceiling', () => {
  let state = initializeCollector(
    { mode: 'backfill', limit: 1, account_ids: ids(1), page_size: 100, max_pages: 1 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(state, [account(1)]);
  const data = Array.from({ length: 100 }, (_, i) => ({
    uri: '/videos/' + (100 + i),
    link: 'https://vimeo.com/' + (100 + i),
    description: 'a'.repeat(8000),
    privacy: { view: 'anybody' },
    created_time: '2026-10-26T00:00:00Z',
  }));
  state = advanceVimeoNative(
    state,
    { statusCode: 200, body: { data, paging: { next: null } } },
    vimeo.normalizeVimeoApiResult,
  );
  assert.equal(state.request.operation, 'ingest');
  assert.ok(Buffer.byteLength(JSON.stringify(state.request), 'utf8') <= 512 * 1024);
  assert.ok(state.current.chunks.length > 1);
});

test('native unknown callback responds403 without routing to provider, ingestion or the accepted foundation branch', () => {
  const graph = extendNativeCallback(bindings, transport, baseline);
  const source = { apify_run_id: 'SYNTHETIC_UNKNOWN', transport: 'webhook', params: ['SYNTHETIC_UNKNOWN'] };
  const prepared = vmCode(nativeNode(graph, 'Prepare callback classification').parameters.jsCode, source)[0]
    .json;
  const classified = vmCode(
    nativeNode(graph, 'Check callback classification').parameters.jsCode,
    ack({ request: prepared.request }, { scope: 'unknown' }),
    { 'Prepare callback classification': prepared },
  )[0].json;
  assert.equal(classified.scope, 'unknown');
  assert.equal(
    graph.workflow.connections['Foundation registered callback?'].main[1][0].node,
    'Unknown callback webhook?',
  );
  assert.equal(
    graph.workflow.connections['Unknown callback webhook?'].main[0][0].node,
    'Respond unknown callback',
  );
  assert.equal(nativeNode(graph, 'Respond unknown callback').parameters.options.responseCode, 403);
});

test('a later Vimeo page failure reports only successfully ingested counts, never buffered items the database has not seen', () => {
  let state = initializeCollector(
    { mode: 'backfill', limit: 1, account_ids: ids(1), page_size: 5, max_pages: 2 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(state, [account(1)]);
  state = advanceVimeoNative(
    state,
    {
      statusCode: 200,
      body: {
        data: [
          {
            uri: '/videos/123',
            link: 'https://vimeo.com/123',
            privacy: { view: 'anybody' },
            created_time: '2026-10-26T00:00:00Z',
          },
        ],
        paging: { next: '/users/101/videos?page=2&per_page=5' },
      },
    },
    vimeo.normalizeVimeoApiResult,
  );
  assert.equal(state.action, 'vimeo');
  state = advanceVimeoNative(state, { statusCode: 403, body: {} }, vimeo.normalizeVimeoApiResult);
  assert.equal(state.request.operation, 'report');
  assert.equal(state.request.args.status, 'failed');
  assert.equal(state.request.args.items_seen, 0);
  assert.equal(state.request.args.items_new, 0);
});

test('each Instagram pass resumes its own aggregate backfill cursor and full-wave escalation', () => {
  const claimed = [
    {
      ...account(1),
      url: 'https://www.instagram.com/publicstudio1/',
      backfill_cursor: {
        posts: { full_waves: 3, oldest_seen: '2025-01-01T00:00:00Z' },
        reels: { full_waves: 1, oldest_seen: '2026-01-01T00:00:00Z' },
      },
    },
  ];
  assert.equal(
    buildInstagramBatches(claimed, { mode: 'backfill', result_type: 'posts' })[0].input.resultsLimit,
    3000,
  );
  assert.equal(
    buildInstagramBatches(claimed, { mode: 'backfill', result_type: 'reels' })[0].input.resultsLimit,
    1500,
  );
});

test('daily Vimeo fallback registers asynchronously without reporting or releasing its primary claim, then closes registration', () => {
  let state = initializeCollector(
    { mode: 'daily', limit: 1, account_ids: ids(1), results_limit: 5 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(state, [account(1)]);
  state = advanceVimeoNative(state, { statusCode: 404, body: {} }, vimeo.normalizeVimeoApiResult);
  assert.equal(state.request.operation, 'launch');
  assert.equal(state.request.args.actor_id, 'goat255/vimeo-scraper');
  assert.equal(state.request.args.pass, 'primary');
  assert.deepEqual(state.batches[0].input.videoUrls, []);
  assert.deepEqual(state.batches[0].input.users, [account(1).url]);
  state = applyGateway(state, {
    permit: true,
    launch_id: state.launchId,
    apify_run_id: null,
    descriptor: {
      actorPath: 'goat255~vimeo-scraper',
      build: '0.0.123',
      maxTotalChargeUsd: 1,
      maxItems: 5,
      timeout: 600,
      memory: 1024,
    },
  });
  state = advanceInstagramNative(state, { statusCode: 201, body: { data: { id: 'SYNTHETIC_VIMEO' } } });
  state = applyGateway(state, { registered: true, apify_run_id: 'SYNTHETIC_VIMEO', run_id: runId });
  assert.equal(state.request.operation, 'cost');
  assert.equal(state.request.args.entries[0].quantity, 1);
  state = applyGateway(state, { inserted: 1 });
  assert.equal(state.request.operation, 'close_registration');
  assert.equal(state.outcomes[0].status, 'awaiting_callback');
});

test('access denial and rate limit never authorize fallback; goat255 cannot backfill', () => {
  for (const [mode, status] of [
    ['daily', 403],
    ['daily', 401],
    ['daily', 429],
    ['backfill', 404],
  ]) {
    let state = initializeCollector(
      { mode, limit: 1, account_ids: ids(1) },
      'vimeo',
      '99123',
      '2026-10-27T10:00:00Z',
    );
    state = applyGateway(state, { run_id: runId });
    state = applyGateway(state, [account(1)]);
    if (status === 429) state.current.retries = 3;
    state = advanceVimeoNative(state, { statusCode: status, body: {} }, vimeo.normalizeVimeoApiResult);
    assert.equal(state.request.operation, 'report');
    assert.equal(state.request.args.status, 'failed');
    assert.equal(state.actorStarts, 0);
  }
});

test('a public showcase with no verified API owner uses only the approved fixed collection actor input', () => {
  let state = initializeCollector(
    { mode: 'backfill', limit: 1, account_ids: ids(1), results_limit: 5 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(state, [{ ...account(1), url: 'https://vimeo.com/showcase/123' }]);
  assert.equal(state.request.operation, 'launch');
  assert.equal(state.request.args.actor_id, 'dltik/vimeo-scraper');
  assert.deepEqual(state.batches[0].input, { urls: ['https://vimeo.com/showcase/123'], maxResults: 5 });
  assert.equal(state.calls, 0);
});

test('checked-in blueprints match the current builder and all connected node names resolve', () => {
  for (const graph of generateCollectorBlueprints()) {
    const saved = JSON.parse(
      readFileSync(new URL('./blueprints/' + graph.key + '.json', import.meta.url), 'utf8'),
    );
    assert.deepEqual(saved, graph);
    const names = new Set(graph.workflow.nodes.map((n) => n.name));
    assert.equal(names.size, graph.workflow.nodes.length);
    for (const [from, connection] of Object.entries(graph.workflow.connections)) {
      assert.ok(names.has(from), from);
      for (const branch of connection.main ?? [])
        for (const target of branch) assert.ok(names.has(target.node), target.node);
    }
  }
});

test('native actor URL uses Base64 webhook metadata, a pinned descriptor and explicitly disables actor restart', () => {
  const graph = buildNativeCollector(bindings, transport, 'instagram');
  const expression = nativeNode(graph, 'Start asynchronous Instagram actor').parameters.url;
  const value = vm.runInNewContext(expression.slice(3, -2), {
    $json: {
      launchDescriptor: {
        actorPath: 'apify~instagram-scraper',
        build: '0.0.123',
        maxItems: 10,
        maxTotalChargeUsd: 1,
        timeout: 600,
      },
    },
  });
  const url = new URL(value);
  assert.equal(url.searchParams.get('waitForFinish'), '0');
  assert.equal(url.searchParams.get('restartOnError'), 'false');
  assert.equal(url.searchParams.get('build'), '0.0.123');
  assert.deepEqual(JSON.parse(Buffer.from(url.searchParams.get('webhooks'), 'base64').toString('utf8')), [
    {
      eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
      requestUrl: bindings.instanceUrl + '/webhook/emr-apify-callback',
    },
  ]);
});

test('native optional trigger nulls retain dev defaults without splitting claims or overriding pass checkpoints', () => {
  const state = initializeCollector(
    { env: null, mode: 'backfill', limit: 1, account_ids: ids(1), results_limit: null, result_type: null },
    'instagram',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  assert.equal(state.request.args.env, 'dev');
  assert.equal(state.resultsLimitExplicit, false);
});

test('missing, null or empty exact account selection fails before a run can start', () => {
  for (const account_ids of [undefined, null, []]) {
    assert.throws(
      () =>
        initializeCollector(
          { mode: 'backfill', limit: 1, account_ids },
          'vimeo',
          '99123',
          '2026-10-27T10:00:00Z',
        ),
      /INPUT_INVALID/,
    );
  }
});

test('a saved completed callback is exposed as a logical replay despite a new HTTP request ID', () => {
  const graph = extendNativeCallback(bindings, transport, baseline);
  const prior = {
    pageNumber: 0,
    source: { transport: 'webhook', apify_run_id: 'SYNTHETIC_RUN' },
    request: { requestId: account(1).account_id },
  };
  const result = vmCode(
    nativeNode(graph, 'Verify M04 callback receipt').parameters.jsCode,
    {
      statusCode: 200,
      body: {
        version: 1,
        requestId: prior.request.requestId,
        operation: 'callback.process',
        replayed: false,
        result: { state: 'completed', updated: false },
      },
    },
    { 'Prepare M04 callback processing': prior },
  )[0].json;
  assert.equal(result.replayed, true);
});

test('an exactly30000-row bounded dataset may request one final empty EOF page, but no62nd page', () => {
  const graph = extendNativeCallback(bindings, transport, baseline);
  const source = nativeNode(graph, 'Prepare M04 callback processing').parameters.jsCode;
  const last = vmCode(source, { apify_run_id: 'SYNTHETIC_RUN', pageNumber: 60 })[0].json;
  assert.equal(last.pageNumber, 60);
  assert.equal(last.request.operation, 'callback.process');
  assert.throws(() => vmCode(source, { apify_run_id: 'SYNTHETIC_RUN', pageNumber: 61 }), /PAGE_BOUND/);
});

test('daily results obey actor-specific bounds: Vimeo goat60, dltik50 and Instagram30', () => {
  let state = initializeCollector(
    { mode: 'daily', limit: 1, account_ids: ids(1), results_limit: 60 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  state = applyGateway(state, { run_id: runId });
  state = applyGateway(state, [account(1)]);
  state = advanceVimeoNative(state, { statusCode: 404, body: {} }, vimeo.normalizeVimeoApiResult);
  assert.equal(state.request.args.actor_id, 'goat255/vimeo-scraper');
  assert.equal(state.request.args.results_limit, 60);
  let collection = initializeCollector(
    { mode: 'daily', limit: 1, account_ids: ids(1), results_limit: 60 },
    'vimeo',
    '99123',
    '2026-10-27T10:00:00Z',
  );
  collection = applyGateway(collection, { run_id: runId });
  collection = applyGateway(collection, [{ ...account(1), url: 'https://vimeo.com/showcase/123' }]);
  assert.equal(collection.request.args.actor_id, 'dltik/vimeo-scraper');
  assert.equal(collection.request.args.results_limit, 50);
  assert.throws(
    () =>
      initializeCollector(
        { mode: 'daily', limit: 1, account_ids: ids(1), results_limit: 31 },
        'instagram',
        '99123',
        '2026-10-27T10:00:00Z',
      ),
    /INPUT_INVALID/,
  );
});

test('callback processing HTTP covers its55-second server deadline without lengthening ordinary gateway operations', () => {
  const graph = extendNativeCallback(bindings, transport, baseline);
  const processing = nativeNode(graph, 'Process verified M04 callback');
  assert.equal(processing.parameters.options.timeout, 60000);
  assert.ok(processing.parameters.options.timeout > 55000);
  assert.equal(nativeNode(graph, 'Classify registered callback').parameters.options.timeout, 25000);
  assert.equal(processing.retryOnFail, false);
  assert.equal(processing.parameters.options.allowUnauthorizedCerts, false);
  assert.equal(processing.parameters.options.redirect.redirect.followRedirects, false);
  const collector = buildNativeCollector(bindings, transport, 'vimeo');
  assert.equal(nativeNode(collector, 'Restricted collector RPC').parameters.options.timeout, 25000);
});

test('collector error-workflow links remain deferred while WF90 uses its closed foundation gateway', () => {
  for (const kind of ['vimeo', 'instagram']) {
    const graph = buildNativeCollector(bindings, transport, kind);
    assert.equal(Object.hasOwn(graph.workflow.settings, 'errorWorkflow'), false);
    assert.equal(graph.deferredErrorWorkflowId, bindings.workflowRefs['WF-90'].id);
    assert.equal(graph.definitionProfile, 'inactive_native_staging');
  }
  const callback = extendNativeCallback(bindings, transport, baseline);
  assert.deepEqual(callback.workflow.settings, baseline.workflow.settings);
});
