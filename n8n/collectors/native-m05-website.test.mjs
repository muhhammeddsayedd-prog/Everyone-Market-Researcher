import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildNativeWebsite, m05WebsiteCloudSource } from './build-native-m05-website.mjs';
import { m05Args } from '../../packages/shared/src/n8n-m05-contracts.ts';
import website from '../normalizers/websiteContentCrawler.js';
const bindings = JSON.parse(
  readFileSync(new URL('../foundation/bindings.dev.json', import.meta.url), 'utf8'),
);
const account = {
  account_id: '51000000-0000-4000-8000-000000000001',
  competitor_id: '51000000-0000-4000-8000-000000000002',
  url: 'https://studio.film/Work/',
  platform: 'website_work_page',
};
const rootAccount = {
  ...account,
  account_id: '51000000-0000-4000-8000-000000000003',
  platform: 'website',
  url: 'https://studio.film/',
};
const pageUrl = 'https://studio.film/Work/A-Film';
const selection = {
  env: 'dev',
  mode: 'backfill',
  account_ids: { website_work_page: [account.account_id], website: [rootAccount.account_id] },
  max_actor_starts: 2,
  firecrawl_credit_usd: 0.00083,
};
const firecrawl = {
  id: 'LocalFixtureFirecrawl',
  name: 'LOCAL TEST ONLY Firecrawl',
  type: 'httpHeaderAuth',
  environment: 'dev',
};
const transport = {
  audience: 'https://everyone-market-researcher-local-fixture.vercel.app',
  credential: { id: 'EmrM03Machine19', name: 'M03 foundation machine [dev]', type: 'httpCustomAuth' },
};
const rt = () =>
  runInNewContext(
    m05WebsiteCloudSource +
      '\n({initializeM05Website,advanceM05WebsiteGateway,advanceM05WebsiteMap,advanceM05WebsiteActor,m05WebsiteCanonical})',
    {},
    { timeout: 1000 },
  );
function gatewayReply(s, result, replayed = false) {
  return {
    statusCode: 200,
    body: { version: 1, requestId: s.request.requestId, operation: s.request.operation, replayed, result },
  };
}
function drive({
  fresh = true,
  uncertain = false,
  replayed = false,
  mode = 'backfill',
  redesign = false,
  bounded = false,
  repeatSubset = false,
  actualStatus,
  capAck = true,
  chargeUsd = 0.4,
  numericId = false,
} = {}) {
  const r = rt(),
    calls = [],
    maps = [],
    actors = [];
  const sourceOptions = bounded ? { source_options: { map_limit: 7, max_new_urls_per_account: 3 } } : {};
  const mappedUrls = bounded
    ? Array.from({ length: 7 }, (_, i) => 'https://studio.film/Work/film-' + i)
    : redesign
      ? Array.from({ length: 31 }, (_, i) => 'https://studio.film/Work/' + i)
      : [pageUrl];
  let s = r.initializeM05Website({ ...selection, mode, ...sourceOptions }, '10', '2026-10-28T12:00:00Z');
  for (let step = 0; s.action !== 'done' && step < 100; step++) {
    if (s.action === 'gateway') {
      const q = JSON.parse(JSON.stringify(s.request));
      m05Args[q.operation].parse(q.args);
      calls.push(q);
      const urls = repeatSubset ? mappedUrls.slice(3) : mappedUrls;
      const result =
        q.operation === 'm05.start'
          ? { run_id: '51000000-0000-4000-8000-000000000010' }
          : q.operation === 'm05.claim'
            ? q.args.platform === 'website'
              ? [rootAccount]
              : [account]
            : q.operation === 'm05.diff'
              ? fresh && q.args.account_id === account.account_id
                ? urls
                : []
              : q.operation === 'm05.launch'
                ? {
                    permit: true,
                    launch_id: q.args.launch_id,
                    descriptor: {
                      actorPath: 'apify~website-content-crawler',
                      build: '1.0.0',
                      memory: 1024,
                      timeout: 600,
                      billingModel: 'PPU',
                      maxItems: q.args.results_limit,
                      maxTotalChargeUsd: chargeUsd,
                    },
                  }
                : q.operation === 'm05.register'
                  ? { registered: true, run_id: s.runId, apify_run_id: 'localActor' }
                  : q.operation === 'm05.close_registration'
                    ? actors.length
                      ? {
                          state: 'awaiting_callbacks',
                          registration_closed: true,
                          finished_now: false,
                          summary: null,
                        }
                      : {
                          state: 'completed',
                          registration_closed: true,
                          finished_now: true,
                          summary: {
                            run_id: s.runId,
                            status:
                              actualStatus ??
                              (calls.some((c) => c.operation === 'm05.report' && c.args.status === 'failed')
                                ? 'partial'
                                : 'success'),
                          },
                        }
                    : {};
      s = r.advanceM05WebsiteGateway(s, gatewayReply(s, result, replayed && q.operation === 'm05.launch'));
    } else if (s.action === 'map') {
      maps.push(s.http);
      const links = mappedUrls.map((url) => ({ url }));
      s = r.advanceM05WebsiteMap(s, { statusCode: 200, body: { success: true, links } });
    } else {
      assert.equal(s.action, 'apify');
      actors.push(s.actor);
      s = r.advanceM05WebsiteActor(
        s,
        uncertain
          ? { error: 'local timeout' }
          : {
              statusCode: 201,
              body: {
                data: {
                  id: numericId ? 123 : 'localActor',
                  defaultDatasetId: 'localDataset',
                  options: capAck ? { maxTotalChargeUsd: chargeUsd, isMaxTotalChargeUsdSetByUser: true } : {},
                },
              },
            },
      );
    }
  }
  assert.equal(s.action, 'done');
  return { s, calls, maps, actors };
}
test('native website graph requires a separate actual Firecrawl binding; unbound blueprint is guarded and inert', () => {
  const unbound = buildNativeWebsite(bindings, transport, selection);
  assert.equal(unbound.runnableWorkflow, false);
  assert.equal(unbound.workflow.active, false);
  assert.equal(
    unbound.workflow.nodes.some((n) => n.type.endsWith('.httpRequest')),
    false,
  );
  assert.throws(
    () =>
      buildNativeWebsite(bindings, transport, selection, { ...firecrawl, id: bindings.credentials.vimeo.id }),
    /BINDING_INVALID/,
  );
  const graph = buildNativeWebsite(bindings, transport, selection, firecrawl);
  assert.equal(graph.runnableWorkflow, true);
  assert.equal(graph.hostedAcceptance, false);
  assert.equal(graph.liveEnabled, false);
  assert.equal(graph.workflow.active, false);
  assert.equal(graph.workflow.settings.errorWorkflow, undefined);
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
      assert.equal(n.parameters.options.sendCredentialsOnCrossOriginRedirect, false);
    }
  const map = graph.workflow.nodes.find((n) => n.name === 'Map owned website');
  assert.equal(map.parameters.url, 'https://api.firecrawl.dev/v2/map');
  assert.equal(map.credentials.httpHeaderAuth.id, firecrawl.id);
  assert.equal(map.parameters.options.timeout, 65000);
  const actor = graph.workflow.nodes.find((n) => n.name === 'Start approved website actor');
  assert.equal(actor.parameters.nodeCredentialType, 'apifyApi');
  assert.match(actor.parameters.url, /waitForFinish=0/);
  assert.doesNotMatch(actor.parameters.url, /run-sync|&maxItems=/);
  assert.match(actor.parameters.url, /&maxTotalChargeUsd=/);
  for (const n of graph.workflow.nodes)
    if (n.type.endsWith('.code'))
      assert.doesNotMatch(n.parameters.jsCode, /\bfetch\s*\(|\brequire\s*\(|\bimport\s*\(/);
});
test('serialized native map/diff/cost/async launch/register closes registration without finishing pending callbacks', () => {
  const r = drive();
  assert.equal(r.s.result.state, 'awaiting_callbacks');
  assert.equal(r.actors.length, 1);
  assert.equal(r.maps.length, 2);
  assert.equal(r.calls.filter((c) => c.operation === 'm05.cost').length, 2);
  assert.equal(
    r.calls.some((c) => c.operation === 'm05.finish'),
    false,
  );
  assert.equal(r.calls.at(-1).operation, 'm05.close_registration');
  assert.deepEqual(
    r.calls.filter((c) => c.operation === 'm05.claim').map((c) => c.args.platform),
    ['website_work_page', 'website'],
  );
  assert.equal(r.calls.find((c) => c.operation === 'm05.launch').args.actor_input.ignoreHttpsErrors, false);
});
test('native no-new run finishes with truthful incomplete map coverage and daily redesign stops before an actor', () => {
  const r = drive({ fresh: false });
  assert.equal(r.actors.length, 0);
  assert.equal(r.s.result.state, 'completed');
  assert.equal(r.s.result.status, 'success');
  assert.equal(
    r.calls.filter((c) => c.operation === 'm05.report').every((c) => c.args.backfill_done === false),
    true,
  );
  const redesign = drive({ mode: 'daily', redesign: true });
  assert.equal(redesign.actors.length, 0);
  assert.equal(redesign.s.result.status, 'partial');
  assert.equal(redesign.calls.find((c) => c.args.error === 'web_redesign_guard').args.status, 'failed');
});
test('uncertain paid start closes no registration and a replayed permit cannot start another actor', () => {
  const r = drive({ uncertain: true });
  assert.equal(r.actors.length, 1);
  assert.equal(r.s.result.state, 'reconciliation_required');
  assert.equal(
    r.calls.some((c) => ['m05.register', 'm05.close_registration', 'm05.finish'].includes(c.operation)),
    false,
  );
  assert.throws(() => drive({ replayed: true }), /RECONCILIATION_REQUIRED/);
});
test('native strict public URL subset preserves the canonical Node helper identity without URL globals', () => {
  const r = rt();
  for (const url of [
    pageUrl + '/?utm_source=local#top',
    'https://STUDIO.film:443/Work/A-Film',
    'https://studio.film/Work/فيلم',
    'https://studio.film/Work/%D9%81%D9%8A%D9%84%D9%85',
    'https://studio.film/Work/film%3Ffinal',
    'https://studio.film/Work/[film]',
  ])
    assert.equal(r.m05WebsiteCanonical(url), website.canonicalOwnedWebsiteUrl(url));
  for (const url of [
    'http://studio.film/Work',
    'https://127.0.0.1/Work',
    'https://studio.local/Work',
    'https://studio.film/Work/%2e%2e/x',
    'https://studio.film/Work/A?%2574oken=bad',
    'https://studio.film/Work/../other',
    'https://u:p@studio.film/Work',
  ])
    assert.throws(() => r.m05WebsiteCanonical(url));
});
test('native bounded capture fixes the candidate window before diff, retains deferred pages and repeats without another actor', () => {
  const first = drive({ bounded: true });
  assert.equal(first.actors.length, 1);
  assert.equal(first.maps[0].body.limit, 7);
  assert.equal(first.calls.find((c) => c.operation === 'm05.diff').args.urls.length, 7);
  assert.equal(first.calls.find((c) => c.operation === 'm05.launch').args.urls.length, 3);
  assert.equal(first.s.result.coverage, 'candidate_subset');
  assert.equal(first.s.result.coverage_records[0].deferred_urls, 4);
  assert.equal(first.s.result.coverage_records[0].map_capped, true);
  assert.equal(first.s.result.coverage_records[0].backfill_done, false);
  const repeat = drive({ bounded: true, repeatSubset: true });
  assert.equal(repeat.actors.length, 0);
  assert.equal(repeat.s.result.state, 'completed');
  assert.equal(repeat.s.result.coverage_records[0].selected_urls, 0);
  assert.equal(repeat.s.result.coverage_records[0].deferred_urls, 4);
});
test('native closure uses actual matching parent summary and rejects inconsistent completion evidence', () => {
  const failed = drive({ fresh: false, actualStatus: 'failed' });
  assert.equal(failed.s.result.status, 'failed');
  assert.equal(
    failed.calls.some((c) => c.operation === 'm05.finish'),
    false,
  );
  const r = rt(),
    s = r.initializeM05Website(selection, '10', '2026-10-28T12:00:00Z');
  s.runId = '51000000-0000-4000-8000-000000000010';
  s.request = { ...s.request, operation: 'm05.close_registration', args: { run_id: s.runId } };
  assert.throws(
    () =>
      r.advanceM05WebsiteGateway(
        s,
        gatewayReply(s, {
          state: 'completed',
          registration_closed: true,
          finished_now: true,
          summary: { run_id: '51000000-0000-4000-8000-000000000099', status: 'success' },
        }),
      ),
    /RECEIPT_INVALID/,
  );
  s.request = {
    ...s.request,
    operation: 'm05.finish',
    args: { run_id: s.runId, status: 'success', error: null },
  };
  const actual = r.advanceM05WebsiteGateway(
    s,
    gatewayReply(s, {
      state: 'completed',
      registration_closed: true,
      finished_now: true,
      summary: { run_id: s.runId, status: 'partial' },
    }),
  );
  assert.equal(actual.result.status, 'partial');
});
test('native cap mismatch durably registers the known actor then stops before another paid start or closure', () => {
  const r = drive({ capAck: false });
  assert.equal(r.actors.length, 1);
  assert.equal(r.s.result.state, 'reconciliation_required');
  assert.equal(r.s.result.stage, 'actor_cap_ack');
  assert.equal(r.s.result.actor_starts, 1);
  assert.equal(r.s.result.launches[0].apify_run_id, 'localActor');
  assert.equal(r.s.result.launches[0].cap_acknowledged, false);
  assert.equal(r.calls.filter((c) => c.operation === 'm05.register').length, 1);
  assert.equal(
    r.calls.some((c) => ['m05.close_registration', 'm05.finish'].includes(c.operation)),
    false,
  );
});

test('native website accepts finite server charge configuration above the former ceiling, never malformed amounts', () => {
  assert.equal(drive({ chargeUsd: 1.5 }).s.result.state, 'awaiting_callbacks');
  for (const chargeUsd of [0, -1, NaN, Infinity, '1.5', null])
    assert.throws(() => drive({ chargeUsd }), /DESCRIPTOR_INVALID/);
  assert.doesNotThrow(() =>
    rt().initializeM05Website({ ...selection, max_actor_starts: 41 }, '10', '2026-10-28T12:00:00Z'),
  );
});

test('native website keeps a numeric provider ID unconfirmed and does not register or repeat the POST', () => {
  const r = drive({ numericId: true });
  assert.equal(r.actors.length, 1);
  assert.equal(r.s.result.actor_starts, 0);
  assert.equal(r.s.result.stage, 'actor_start');
  assert.equal(
    r.calls.some((c) => ['m05.register', 'm05.close_registration', 'm05.finish'].includes(c.operation)),
    false,
  );
});
