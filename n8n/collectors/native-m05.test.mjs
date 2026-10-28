import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildNativeYoutube, m05YoutubeCloudSource } from './build-native-m05.mjs';
import { buildNativeM05Callback } from './build-native-m05-callback.mjs';
import { m05Args } from '../../packages/shared/src/n8n-m05-contracts.ts';
const bindings = JSON.parse(
  readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
);
const selection = {
  env: 'dev',
  mode: 'daily',
  account_ids: ['11111111-1111-4111-a111-111111111111'],
  max_pages: 2,
  page_size: 50,
};
const transport = {
  audience: 'https://everyone-market-researcher-local-fixture.vercel.app',
  credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const channel = 'UC1234567890123456789012',
  playlist = 'UU1234567890123456789012';
const account = {
  account_id: selection.account_ids[0],
  competitor_id: '22222222-2222-4222-a222-222222222222',
  url: 'https://www.youtube.com/@local-fixture',
  external_id: channel,
  uploads_playlist_id: playlist,
  backfill_from: '2024-01-01',
  watermark_published_at: '2026-10-27T00:00:00Z',
  watermark_external_id: 'local000001',
};
const item = {
  id: 'local000001',
  snippet: {
    channelId: channel,
    publishedAt: '2026-10-27T00:00:00Z',
    title: 'Synthetic native contract',
    description: 'fixture #Film',
    thumbnails: {},
  },
  contentDetails: { duration: 'PT90S' },
  statistics: { viewCount: '6' },
  status: { privacyStatus: 'public' },
};
const local = () =>
  runInNewContext(
    m05YoutubeCloudSource +
      '\n({initializeM05Youtube,advanceM05YoutubeGateway,advanceM05YoutubeHttp,m05CheckQuotaDay})',
    {},
    { timeout: 1000 },
  );
function gatewayReply(state, result) {
  return {
    statusCode: 200,
    body: {
      version: 1,
      requestId: state.request.requestId,
      operation: state.request.operation,
      replayed: false,
      result,
    },
  };
}
function drive({ httpFailure = false, quotaDenied = false, claimedAccount = account } = {}) {
  const rt = local(),
    gateway = [],
    http = [];
  let state = rt.initializeM05Youtube(selection, '10', '2026-10-28T12:00:00Z');
  for (let step = 0; state.action !== 'done' && step < 50; step++) {
    if (state.action === 'gateway') {
      const r = state.request;
      m05Args[r.operation].parse(JSON.parse(JSON.stringify(r.args)));
      gateway.push(structuredClone(r));
      const result =
        r.operation === 'm05.start'
          ? { run_id: '33333333-3333-4333-a333-333333333333' }
          : r.operation === 'm05.claim'
            ? [claimedAccount]
            : r.operation === 'm05.quota'
              ? { quota_day: '2026-10-28', used_units: 1, permitted: !(quotaDenied && r.args.quantity === 1) }
              : r.operation === 'm05.ingest'
                ? { inserted: 0, duplicates: r.args.items.length }
                : r.operation === 'm05.finish'
                  ? {
                      state: 'completed',
                      summary: {
                        run_id: state.runId,
                        status:
                          state.outcomes.length && state.outcomes.every((o) => o.status !== 'success')
                            ? 'failed'
                            : state.outcomes.some((o) => o.status !== 'success')
                              ? 'partial'
                              : 'success',
                      },
                    }
                  : {};
      state = rt.advanceM05YoutubeGateway(state, gatewayReply(state, result));
    } else {
      assert.equal(state.action, 'youtube');
      http.push(structuredClone(state.http));
      const body =
        state.http.kind === 'list'
          ? {
              items: [
                {
                  snippet: { videoOwnerChannelId: channel },
                  contentDetails: { videoId: item.id, videoPublishedAt: item.snippet.publishedAt },
                },
              ],
            }
          : { items: [item] };
      state = rt.advanceM05YoutubeHttp(state, {
        statusCode: httpFailure ? 403 : 200,
        body: httpFailure ? { error: { errors: [{ reason: 'quotaExceeded' }] } } : body,
      });
    }
  }
  assert.equal(state.action, 'done');
  return { state, gateway, http };
}
test('native YouTube graph uses supported secured HTTP nodes, fixed selection and no Code-node network/imports', () => {
  const graph = buildNativeYoutube(bindings, transport, selection);
  assert.equal(graph.workflow.active, false);
  assert.equal(graph.hostedAcceptance, false);
  assert.equal(graph.liveEnabled, false);
  assert.equal(graph.workflow.settings.errorWorkflow, undefined);
  assert.equal(graph.workflow.settings.saveManualExecutions, false);
  assert.equal(
    graph.workflow.nodes.some((n) => n.type.endsWith('.scheduleTrigger')),
    false,
  );
  for (const n of graph.workflow.nodes)
    if (n.type.endsWith('.httpRequest')) {
      assert.equal(n.typeVersion, 4.5);
      assert.equal(n.retryOnFail, false);
      assert.equal(n.parameters.options.allowUnauthorizedCerts, false);
      assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
      assert.equal(n.parameters.sendQuery, false);
    }
  const google = graph.workflow.nodes.find((n) => n.name === 'Read public YouTube metadata');
  assert.equal(google.parameters.genericAuthType, 'httpHeaderAuth');
  assert.equal(google.credentials.httpHeaderAuth.id, bindings.credentials.youtube.id);
  for (const n of graph.workflow.nodes)
    if (n.type.endsWith('.code'))
      assert.doesNotMatch(n.parameters.jsCode, /\bfetch\s*\(|\brequire\s*\(|\bimport\s*\(/);
  const initial = graph.workflow.nodes.find((n) => n.name === 'Initialize fixed YouTube selection').parameters
    .jsCode;
  const execute = new Function('$input', '$execution', initial);
  const result = execute(
    { all: () => [{ json: { account_ids: ['99999999-9999-4999-a999-999999999999'] } }] },
    { id: '10' },
  );
  assert.deepEqual(result[0].json.request.args.workflow, 'WF-13');
});
test('serialized native transitions execute the full typed YouTube request/ingest/cost/report/finish path without URL or package globals', () => {
  const r = drive();
  assert.equal(r.state.result.status, 'success');
  assert.equal(r.state.result.quota_units, 2);
  assert.equal(r.http.length, 2);
  assert.equal(r.gateway.filter((x) => x.operation === 'm05.quota' && x.args.quantity === 1).length, 2);
  assert.equal(
    r.gateway.find((x) => x.operation === 'm05.ingest').args.items[0].external_id,
    account.watermark_external_id,
  );
  assert.equal(r.gateway.find((x) => x.operation === 'm05.cost').args.entries[0].quantity, 2);
  assert.equal(r.gateway.find((x) => x.operation === 'm05.report').args.items_new, 0);
});
test('native quota denial settles claims with no source request; provider quota failure never starts an actor', () => {
  const none = drive({ quotaDenied: true });
  assert.equal(none.http.length, 0);
  assert.equal(none.state.result.status, 'failed');
  assert.equal(none.gateway.find((x) => x.operation === 'm05.report').args.backfill_done, false);
  const failed = drive({ httpFailure: true });
  assert.equal(failed.http.length, 1);
  assert.equal(failed.state.result.status, 'failed');
  assert.equal(failed.gateway.find((x) => x.operation === 'm05.cost').args.entries[0].quantity, 1);
  assert.equal(
    failed.gateway.some((x) => x.operation === 'm05.launch'),
    false,
  );
});
test('native saved and resolved uploads IDs stay opaque while channel-bound cursors reject reuse', () => {
  const opaqueUploads = 'ActualUploadedPlaylist_42',
    r = drive({ claimedAccount: { ...account, uploads_playlist_id: opaqueUploads } });
  assert.equal(r.state.result.status, 'success');
  assert.equal(new URL(r.http[0].url).searchParams.get('playlistId'), opaqueUploads);
  const rt = local();
  let s = rt.initializeM05Youtube({ ...selection, mode: 'backfill' }, '10', '2026-10-28T12:00:00Z');
  s = rt.advanceM05YoutubeGateway(s, gatewayReply(s, { run_id: '33333333-3333-4333-a333-333333333333' }));
  s = rt.advanceM05YoutubeGateway(s, gatewayReply(s, [{ ...account, uploads_playlist_id: null }]));
  s = rt.advanceM05YoutubeGateway(
    s,
    gatewayReply(s, { quota_day: '2026-10-28', used_units: 0, permitted: true }),
  );
  s = rt.advanceM05YoutubeGateway(
    s,
    gatewayReply(s, { quota_day: '2026-10-28', used_units: 1, permitted: true }),
  );
  assert.equal(s.http.kind, 'resolve');
  s = rt.advanceM05YoutubeHttp(s, {
    statusCode: 200,
    body: { items: [{ id: channel, contentDetails: { relatedPlaylists: { uploads: opaqueUploads } } }] },
  });
  assert.equal(s.request.operation, 'm05.resolve');
  assert.equal(s.request.args.uploads_playlist_id, opaqueUploads);
  s.context.account.backfill_cursor = {
    channel_id: 'UC9999999999999999999999',
    playlist_id: opaqueUploads,
    page_token: 'foreign-token',
    page_size: 50,
  };
  s = rt.advanceM05YoutubeGateway(s, gatewayReply(s, { ok: true }));
  assert.equal(s.request.operation, 'm05.cost');
  s = rt.advanceM05YoutubeGateway(s, gatewayReply(s, { inserted: 1 }));
  assert.equal(s.request.operation, 'm05.report');
  assert.equal(s.request.args.error, 'youtube_invalid_cursor');
});
test('native gateway mismatch remains an unperformed reconciliation boundary', () => {
  const rt = local(),
    s = rt.initializeM05Youtube(selection, '10', '2026-10-28T12:00:00Z');
  const response = gatewayReply(s, { run_id: '33333333-3333-4333-a333-333333333333' });
  response.body.requestId = 'wrong';
  assert.throws(() => rt.advanceM05YoutubeGateway(s, response), /RECONCILIATION_REQUIRED/);
});

test('native finish returns the actual database summary status and rejects another parent summary', () => {
  const rt = local(),
    s = {
      executionId: '10',
      sequence: 2,
      action: 'gateway',
      request: {
        version: 1,
        requestId: 'c05c0000-0002-4000-a000-00000000000a',
        operation: 'm05.finish',
        args: { status: 'partial' },
      },
      runId: '33333333-3333-4333-a333-333333333333',
      calls: 0,
      quotaDay: '2026-10-28',
      outcomes: [],
    };
  const summary = { run_id: s.runId, status: 'failed' };
  assert.equal(
    rt.advanceM05YoutubeGateway(structuredClone(s), gatewayReply(s, { state: 'completed', summary })).result
      .status,
    'failed',
  );
  assert.throws(
    () =>
      rt.advanceM05YoutubeGateway(
        s,
        gatewayReply(s, { state: 'completed', summary: { ...summary, run_id: 'foreign' } }),
      ),
    /RECEIPT_INVALID/,
  );
});

function callbackNode(name, input, prior = {}) {
  const graph = buildNativeM05Callback(bindings, transport, 'M05LocalErrorHandler');
  const source = graph.workflow.nodes.find((node) => node.name === name)?.parameters.jsCode;
  assert.equal(typeof source, 'string');
  return new Function('$input', '$execution', '$', source)(
    { all: () => [{ json: input }] },
    { id: '10' },
    (key) => ({ item: { json: prior[key] } }),
  )[0].json;
}
function callbackRetry() {
  return {
    run_id: '33333333-3333-4333-a333-333333333333',
    retry_of: '44444444-4444-4444-a444-444444444444',
    launch_id: '55555555-5555-4555-a555-555555555555',
    actor_id: 'apify/website-content-crawler',
    pass: 'primary',
    account_ids: selection.account_ids,
    purpose: 'backfill',
    results_limit: 1,
    urls: ['https://m05.example.com/work/one'],
    crawler_type: 'playwright:adaptive',
    actor_input: {
      startUrls: [{ url: 'https://m05.example.com/work/one' }],
      crawlerType: 'playwright:adaptive',
      ignoreHttpsErrors: false,
      maxSessionRotations: 0,
      maxCrawlPages: 1,
      maxResults: 1,
    },
  };
}
test('maintained M05 callback routes registered scope and exact thin retry through strict native HTTP', () => {
  const graph = buildNativeM05Callback(bindings, transport, 'M05LocalErrorHandler');
  const classification = graph.workflow.nodes.find((node) => node.name === 'Check callback classification');
  assert.match(classification.parameters.jsCode, /\['m04','m05','foundation','unknown'\]/);
  assert.match(
    graph.workflow.nodes.find((node) => node.name === 'M04 registered callback?').parameters.conditions
      .conditions[0].leftValue,
    /\['m04','m05'\]/,
  );
  assert.equal(graph.workflow.active, false);
  for (const node of graph.workflow.nodes.filter((node) => node.type.endsWith('.httpRequest'))) {
    assert.equal(node.retryOnFail, false);
    assert.equal(node.parameters.options.allowUnauthorizedCerts, false);
    assert.equal(node.parameters.options.redirect.redirect.followRedirects, false);
  }
  const prepared = callbackNode('Prepare owned thin retry', {
    apify_run_id: 'primaryProvider',
    transport: 'webhook',
    completion: { state: 'retry_required', retry: callbackRetry() },
  });
  m05Args['m05.launch'].parse(prepared.request.args);
  assert.equal(prepared.request.args.retry_of, callbackRetry().retry_of);
  assert.equal(prepared.request.args.launch_id, callbackRetry().launch_id);
});
test('callback retry replay never permits another actor POST and unknown start remains reconciliation', () => {
  const prepared = callbackNode('Prepare owned thin retry', {
    completion: { state: 'retry_required', retry: callbackRetry() },
  });
  const input = {
    statusCode: 200,
    body: {
      version: 1,
      requestId: prepared.request.requestId,
      operation: 'm05.launch',
      replayed: true,
      result: { permit: false, apify_run_id: 'existingProvider' },
    },
  };
  const replay = callbackNode('Verify thin retry permit', input, { 'Prepare owned thin retry': prepared });
  assert.equal(replay.post, false);
  const registration = callbackNode('Prepare retry registration', replay, {
    'Verify thin retry permit': replay,
  });
  m05Args['m05.register'].parse(registration.request.args);
  assert.equal(registration.request.args.apify_run_id, 'existingProvider');
  assert.equal(registration.request.args.launch_id, callbackRetry().launch_id);
  input.body.result.apify_run_id = null;
  assert.throws(
    () => callbackNode('Verify thin retry permit', input, { 'Prepare owned thin retry': prepared }),
    /M05_RETRY_START_UNKNOWN/,
  );
  assert.throws(
    () =>
      callbackNode(
        'Prepare retry registration',
        { statusCode: 500, body: {} },
        { 'Verify thin retry permit': { ...replay, post: true } },
      ),
    /M05_RETRY_START_UNKNOWN/,
  );
});
test('callback native receipt stops on a reconciled source boundary before authorizing any retry', () => {
  assert.throws(
    () =>
      callbackNode(
        'Verify M04 callback receipt',
        { body: { result: { requires_review: true } } },
        {
          'Prepare M04 callback processing': { source: { apify_run_id: 'localProvider' } },
        },
      ),
    /M05_SOURCE_BOUNDARY_RECONCILED/,
  );
});

test('a Pacific midnight boundary replaces a pending quota reservation with truthful partial settlement before network', () => {
  const rt = local();
  let s = rt.initializeM05Youtube(selection, '10', '2026-10-28T06:59:59Z');
  s = rt.advanceM05YoutubeGateway(s, gatewayReply(s, { run_id: '33333333-3333-4333-a333-333333333333' }));
  s = rt.advanceM05YoutubeGateway(s, gatewayReply(s, [account]));
  s = rt.advanceM05YoutubeGateway(
    s,
    gatewayReply(s, { quota_day: '2026-10-27', used_units: 0, permitted: true }),
  );
  assert.equal(s.request.operation, 'm05.quota');
  assert.equal(s.request.args.quantity, 1);
  s = rt.m05CheckQuotaDay(s, '2026-10-28T07:00:00Z');
  assert.equal(s.request.operation, 'm05.report');
  assert.equal(s.request.args.error, 'youtube_quota_day_changed');
  assert.equal(s.calls, 0);
});

test('checked-in YouTube blueprint exactly matches maintained source and labels fixture-only selection', () => {
  const saved = JSON.parse(readFileSync(new URL('./blueprints/WF-13.json', import.meta.url), 'utf8'));
  assert.equal(saved.fixtureProvenance.actualNativeSave, false);
  assert.equal(saved.fixtureProvenance.requiresApprovedRealSelectors, true);
  const expected = buildNativeYoutube(bindings, transport, {
    ...selection,
    mode: 'backfill',
    max_pages: 1,
    page_size: 5,
  });
  assert.deepEqual(saved.workflow, expected.workflow);
});
