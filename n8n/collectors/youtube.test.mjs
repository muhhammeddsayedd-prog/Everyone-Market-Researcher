import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { m05Args } from '../../packages/shared/src/n8n-m05-contracts.ts';
import { collectYoutubeAccount, youtubeQuotaDay, youtubeEndpoint } from './youtube.mjs';
import { runYoutubeCollector } from './youtube-run.mjs';

const require = createRequire(import.meta.url);
const { normalizeYoutubeApiResult, youtubeDuration } = require('../normalizers/youtubeApi.js');
const { normalizeYoutubeScraperResult } = require('../normalizers/youtubeScraper.js');
const channel = 'UC1234567890123456789012',
  playlist = 'UU1234567890123456789012';
const account = {
  account_id: '11111111-1111-4111-a111-111111111111',
  competitor_id: '22222222-2222-4222-a222-222222222222',
  url: 'https://www.youtube.com/@local-fixture',
  handle: 'local-fixture',
  external_id: channel,
  uploads_playlist_id: playlist,
  backfill_from: '2024-01-01',
  watermark_published_at: '2026-10-27T00:00:00Z',
};
const video = (id = 'local000001', date = '2026-10-27T00:00:00Z') => ({
  id,
  snippet: {
    channelId: channel,
    publishedAt: date,
    title: 'Clearly labelled local fixture',
    description: 'A synthetic #Film @everyone.film',
    tags: ['Film'],
    thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } },
  },
  contentDetails: { duration: 'PT45S' },
  statistics: { viewCount: '12', likeCount: '3' },
  status: { privacyStatus: 'public' },
});
const page = (ids, next) => ({
  items: ids.map(([id, date]) => ({
    snippet: { videoOwnerChannelId: channel },
    contentDetails: { videoId: id, videoPublishedAt: date },
  })),
  ...(next ? { nextPageToken: next } : {}),
});
const config = { mode: 'daily', now: '2026-10-28T12:00:00Z', quotaRemaining: 20, maxPages: 2 };
function requests(responses) {
  const calls = [];
  return {
    calls,
    request: async (r) => {
      calls.push(r);
      assert.equal(r.method, 'GET');
      assert.ok(r.url.startsWith('https://www.googleapis.com/youtube/v3/'));
      assert.equal(new URL(r.url).searchParams.has('key'), false);
      const next = responses.shift();
      assert.ok(next, 'unexpected request');
      return typeof next === 'function' ? next(r) : { status: 200, body: next };
    },
  };
}

test('strict duration/metrics and explicit heuristic do not claim actual Shorts', () => {
  for (const bad of ['P', 'junkPT60S', 'PT-1S', 'PT1.5S', 'P1Y', null])
    assert.equal(youtubeDuration(bad), null);
  assert.equal(youtubeDuration('P1DT2H3M4S'), 93784);
  const row = video();
  row.statistics.commentCount = '9007199254740992';
  row.secret = 'must-not-survive';
  const r = normalizeYoutubeApiResult([row], { account });
  assert.equal(r.errors.length, 0);
  assert.equal(r.items[0].item_type, 'reel');
  assert.equal(r.items[0].payload.shorts_classification, 'duration_heuristic_unverified');
  assert.equal(r.items[0].metrics.comments, null);
  assert.equal(JSON.stringify(r).includes('must-not-survive'), false);
});
test('checked-in fixture is explicitly synthetic and normalized rows satisfy the actual M05 ingress contract', () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL('../normalizers/fixtures/youtube-api/synthetic-local-contract.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(fixture.fixtureProvenance.actualProviderCapture, false);
  const normalized = normalizeYoutubeApiResult([fixture.row], { account: fixture.account });
  assert.equal(normalized.items.length, 1);
  assert.doesNotThrow(() =>
    m05Args['m05.ingest'].parse({
      run_id: '33333333-3333-4333-a333-333333333333',
      account_id: account.account_id,
      items: normalized.items,
    }),
  );
});
test('large Arabic descriptions remain byte-bounded in every canonical batch', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    ...video('local' + String(i).padStart(6, '0')),
    snippet: { ...video().snippet, description: 'ع'.repeat(8000) },
  }));
  const r = normalizeYoutubeApiResult(rows, { account });
  const batches = require('../normalizers/youtubeApi.js').youtubeHelpers.youtubeBatches(r.items);
  assert.ok(batches.length > 1);
  assert.equal(batches.flat().length, 100);
  assert.ok(
    batches.every(
      (b) =>
        Buffer.byteLength(
          JSON.stringify({
            version: 1,
            requestId: '33333333-3333-4333-a333-333333333333',
            operation: 'm05.ingest',
            args: {
              run_id: '44444444-4444-4444-a444-444444444444',
              account_id: account.account_id,
              items: b,
            },
          }),
        ) <= 1048576,
    ),
  );
  assert.ok(r.items.every((i) => i.credits_text.length <= 1500));
});
test('byte chunking reserves the fixed gateway envelope and rejects a near-limit single item', () => {
  const batches = require('../normalizers/youtubeApi.js').youtubeHelpers.youtubeBatches;
  const nearLimit = { padding: 'x'.repeat(1048400) };
  assert.ok(Buffer.byteLength(JSON.stringify([nearLimit])) < 1048576);
  assert.throws(() => batches([nearLimit]), /youtube_item_byte_bound/);
});
test('owner mismatch, nonpublic rows and unsafe thumbnails are not accepted as public owned source', () => {
  const wrong = video();
  wrong.snippet.channelId = 'UC9999999999999999999999';
  assert.equal(normalizeYoutubeApiResult([wrong], { account }).errors.length, 1);
  const hidden = video();
  hidden.status.privacyStatus = 'private';
  assert.equal(normalizeYoutubeApiResult([hidden], { account }).items.length, 0);
  const unsafe = video();
  unsafe.snippet.thumbnails.high.url = 'https://127.0.0.1/private';
  assert.equal(normalizeYoutubeApiResult([unsafe], { account }).items[0].thumbnail_url, null);
});
test('quota day follows Pacific DST, not UTC or Cairo', () => {
  assert.equal(youtubeQuotaDay('2026-10-28T06:59:59Z'), '2026-10-27');
  assert.equal(youtubeQuotaDay('2026-10-28T07:00:00Z'), '2026-10-28');
  assert.equal(youtubeQuotaDay('2026-12-01T07:59:59Z'), '2026-11-30');
});
test('resolver uses exact public channel selectors and never guesses a /c username', () => {
  assert.equal(youtubeEndpoint({ ...account, uploads_playlist_id: null }).resolve.id, channel);
  assert.equal(
    youtubeEndpoint({ ...account, external_id: null, uploads_playlist_id: null }).resolve.forHandle,
    '@local-fixture',
  );
  assert.throws(
    () =>
      youtubeEndpoint({
        ...account,
        url: 'https://www.youtube.com/c/alias',
        external_id: null,
        uploads_playlist_id: null,
      }),
    /unresolved_legacy/,
  );
  assert.throws(
    () => youtubeEndpoint({ ...account, url: 'https://youtube.com.evil.test/@local-fixture' }),
    /invalid_account/,
  );
  assert.throws(
    () => youtubeEndpoint({ ...account, uploads_playlist_id: 'unsafe/playlist' }),
    /invalid_account/,
  );
  assert.throws(
    () => youtubeEndpoint({ ...account, url: 'https://www.youtube.com/playlist/foreign' }),
    /invalid_account/,
  );
});
test('resolution preserves an opaque returned uploads playlist without deriving a channel suffix', async () => {
  const opaqueUploads = 'PLopaque_Returned-uploads_987';
  const io = requests([
    { items: [{ id: channel, contentDetails: { relatedPlaylists: { uploads: opaqueUploads } } }] },
    page([]),
  ]);
  const r = await collectYoutubeAccount(
    { ...account, uploads_playlist_id: null },
    { ...config, mode: 'backfill' },
    io,
  );
  assert.equal(r.status, 'success');
  assert.equal(r.resolvedExternalId, channel);
  assert.equal(r.resolvedUploadsPlaylistId, opaqueUploads);
  assert.equal(new URL(io.calls[1].url).searchParams.get('playlistId'), opaqueUploads);
  assert.equal(r.quotaUnits, 2);
  assert.equal(r.backfillDone, true);
});
test('a saved verified opaque uploads pair is reused while its cursor remains channel-bound', async () => {
  const opaqueUploads = 'ActualUploadedPlaylist_42',
    saved = { ...account, uploads_playlist_id: opaqueUploads },
    io = requests([page([])]);
  assert.equal(youtubeEndpoint(saved).playlistId, opaqueUploads);
  const accepted = await collectYoutubeAccount(saved, config, io);
  assert.equal(accepted.status, 'success');
  assert.equal(accepted.apiRequestCount, 1);
  assert.equal(new URL(io.calls[0].url).searchParams.get('playlistId'), opaqueUploads);
  const denied = await collectYoutubeAccount(
    {
      ...saved,
      backfill_cursor: {
        channel_id: 'UC9999999999999999999999',
        playlist_id: opaqueUploads,
        page_token: 'foreign-token',
        page_size: 50,
      },
    },
    { ...config, mode: 'backfill' },
    requests([]),
  );
  assert.equal(denied.error, 'youtube_invalid_cursor');
  assert.equal(denied.apiRequestCount, 0);
});
test('one real API-shaped local page joins owned videos, includes known IDs for metrics and counts both calls', async () => {
  const io = requests([page([['local000001', '2026-10-27T00:00:00Z']]), { items: [video()] }]);
  const r = await collectYoutubeAccount({ ...account, watermark_external_id: 'local000001' }, config, io);
  assert.equal(r.status, 'success');
  assert.equal(r.complete, true);
  assert.equal(r.normalizedItems.length, 1);
  assert.equal(r.apiRequestCount, 2);
  assert.equal(r.quotaUnits, 2);
  assert.equal(io.calls.length, 2);
});
test('an old first page does not prove order or history; cursor width and channel are bound', async () => {
  const io = requests([
    page([['local000001', '2023-01-01T00:00:00Z']], 'next-token'),
    { items: [video('local000001', '2023-01-01T00:00:00Z')] },
  ]);
  const r = await collectYoutubeAccount(account, { ...config, mode: 'backfill', maxPages: 1 }, io);
  assert.equal(r.status, 'partial');
  assert.equal(r.backfillDone, false);
  assert.equal(r.cursor.page_token, 'next-token');
  assert.equal(r.cursor.channel_id, channel);
  assert.equal(r.cursor.page_size, 50);
  const denied = await collectYoutubeAccount(
    { ...account, backfill_cursor: { ...r.cursor, playlist_id: 'UU9999999999999999999999' } },
    { ...config, mode: 'backfill' },
    requests([]),
  );
  assert.equal(denied.error, 'youtube_invalid_cursor');
  assert.equal(denied.apiRequestCount, 0);
});
test('resumption preserves opaque token and rejects a repeated token rather than claiming exhaustion', async () => {
  const cursor = { channel_id: channel, playlist_id: playlist, page_token: 'token-with-_%', page_size: 50 };
  const io = requests([
    page([['local000001', '2026-10-27T00:00:00Z']], 'token-with-_%'),
    { items: [video()] },
  ]);
  const r = await collectYoutubeAccount(
    { ...account, backfill_cursor: cursor },
    { ...config, mode: 'backfill' },
    io,
  );
  assert.equal(new URL(io.calls[0].url).searchParams.get('pageToken'), cursor.page_token);
  assert.equal(r.error, 'youtube_repeated_page_token');
  assert.equal(r.backfillDone, false);
});
test('API quota/auth failures and quota floor never start or propose an enabled fallback', async () => {
  for (const code of [401, 403, 429]) {
    const io = requests([
      () => ({ status: code, body: { error: { errors: [{ reason: 'quotaExceeded' }] } } }),
    ]);
    const r = await collectYoutubeAccount(account, config, io);
    assert.equal(r.status, 'failed');
    assert.equal(r.quotaUnits, 1);
    assert.equal(r.fallback.blocked, true);
  }
  const none = requests([]);
  const r = await collectYoutubeAccount(account, { ...config, quotaRemaining: 0 }, none);
  assert.equal(r.status, 'partial');
  assert.equal(none.calls.length, 0);
});
test('unknown omitted video data and capped daily listing remain incomplete', async () => {
  const missing = await collectYoutubeAccount(
    account,
    config,
    requests([page([['local000001', '2026-10-27T00:00:00Z']]), { items: [] }]),
  );
  assert.equal(missing.status, 'partial');
  assert.equal(missing.complete, false);
  assert.deepEqual(missing.unavailableIds, ['local000001']);
  const capped = await collectYoutubeAccount(
    account,
    { ...config, maxPages: 1 },
    requests([page([['local000001', '2026-10-27T00:00:00Z']], 'another-page'), { items: [video()] }]),
  );
  assert.equal(capped.status, 'partial');
  assert.equal(capped.normalizedItems.length, 1);
  assert.equal(capped.complete, false);
  assert.equal(capped.backfillDone, false);
});
test('failed transport is charged conservatively, raw error remains private and no blind retry occurs', async () => {
  const io = requests([
    () => {
      throw Error('credential-bearing-private-diagnostic');
    },
  ]);
  const r = await collectYoutubeAccount(account, config, io);
  assert.equal(r.quotaUnits, 1);
  assert.equal(r.error, 'youtube_transport_failed');
  assert.equal(JSON.stringify(r).includes('credential-bearing'), false);
  assert.equal(io.calls.length, 1);
});
test('fallback normalizer is pure, ownership-bound and labels the actor short type', () => {
  const row = {
    id: 'local000001',
    url: 'https://www.youtube.com/shorts/local000001',
    date: '2026-10-27T00:00:00Z',
    channelId: channel,
    type: 'shorts',
    title: 'Synthetic actor-shaped fixture',
    text: 'fixture',
    duration: '00:00:45',
    viewCount: 4,
  };
  const r = normalizeYoutubeScraperResult([row], { account });
  assert.equal(r.items[0].item_type, 'reel');
  assert.equal(r.items[0].payload.shorts_classification, 'actor_type');
  assert.equal(
    normalizeYoutubeScraperResult([{ ...row, channelId: 'UC9999999999999999999999' }], { account }).items
      .length,
    0,
  );
});
test('connected local lifecycle reports ingests, quota costs and completion; unchanged re-observation is delegated to canonical upsert', async () => {
  const seen = new Set(),
    events = [];
  let starts = 0;
  const gateway = {
    start: async () => ({ run_id: `${String(++starts).padStart(8, '0')}-0000-4000-8000-000000000000` }),
    claim: async () => [account],
    quota: async (args) => ({ quota_day: args.quota_day, used_units: 0, permitted: true }),
    resolve: async () => {},
    ingest: async (args) => {
      events.push(['ingest', args.items]);
      const count = args.items.filter((i) => !seen.has(i.external_id)).length;
      args.items.forEach((i) => seen.add(i.external_id));
      return { inserted: count, duplicates: args.items.length - count };
    },
    report: async (a) => events.push(['report', a]),
    cost: async (a) => events.push(['cost', a]),
    finish: async (a) => {
      events.push(['finish', a]);
      return { state: 'completed', summary: { run_id: a.run_id, status: a.status } };
    },
  };
  for (let n = 1; n <= 2; n++) {
    const io = requests([page([['local000001', '2026-10-27T00:00:00Z']]), { items: [video()] }]);
    const r = await runYoutubeCollector(
      { env: 'dev', mode: 'daily', limit: 1, accountIds: [account.account_id], executionId: String(n) },
      { ...io, gateway, now: () => config.now },
    );
    assert.equal(r.state, 'completed');
    assert.equal(r.items_new, n === 1 ? 1 : 0);
    assert.equal(r.quota_units, 2);
  }
  assert.equal(events.filter(([k]) => k === 'ingest').length, 2);
  assert.equal(events.filter(([k]) => k === 'finish').length, 2);
  assert.ok(
    events
      .filter(([k]) => k === 'cost')
      .every(([, a]) => a.entries[0].cost_usd === 0 && a.entries[0].unit === 'quota_unit'),
  );
});
test('lost atomic quota reservation receipt causes reconciliation before source I/O or guessed claim release', async () => {
  const events = [],
    gateway = {
      start: async () => ({ run_id: '33333333-3333-4333-a333-333333333333' }),
      claim: async () => [account],
      quota: async (args) => {
        if (args.quantity === 1) throw Error('private DB diagnostic');
        return { quota_day: args.quota_day, used_units: 0, permitted: true };
      },
      resolve: async () => {},
      ingest: async () => events.push('ingest'),
      report: async () => events.push('report'),
      cost: async () => events.push('cost'),
      finish: async () => events.push('finish'),
    };
  const r = await runYoutubeCollector(
    { env: 'dev', mode: 'daily', limit: 1, accountIds: [account.account_id], executionId: 'lost-quota' },
    {
      gateway,
      now: () => config.now,
      request: async () => {
        assert.fail('no source request before confirmed reservation');
      },
    },
  );
  assert.equal(r.state, 'reconciliation_required');
  assert.equal(r.api_requests, 0);
  assert.deepEqual(events, []);
  assert.equal(JSON.stringify(r).includes('private'), false);
});
test('lost ingestion receipt retains logged API cost and does not guess finish or release', async () => {
  const events = [],
    gateway = {
      start: async () => ({ run_id: '33333333-3333-4333-a333-333333333333' }),
      claim: async () => [account],
      quota: async (args) => ({ quota_day: args.quota_day, used_units: 1, permitted: true }),
      resolve: async () => {},
      ingest: async () => {
        events.push('ingest');
        throw Error('lost response');
      },
      report: async () => events.push('report'),
      cost: async () => events.push('cost'),
      finish: async () => events.push('finish'),
    };
  const io = requests([page([['local000001', '2026-10-27T00:00:00Z']]), { items: [video()] }]);
  const r = await runYoutubeCollector(
    { env: 'dev', mode: 'daily', limit: 1, accountIds: [account.account_id], executionId: 'lost-ingest' },
    { ...io, gateway, now: () => config.now },
  );
  assert.equal(r.state, 'reconciliation_required');
  assert.equal(r.stage, 'ingest');
  assert.deepEqual(events, ['cost', 'ingest']);
  assert.equal(r.quota_units, 2);
});

test('a Pacific-day rollover prevents another reservation or HTTP call and truthfully reports partial', async () => {
  let clock = 0;
  const reservations = [];
  const gateway = {
    start: async () => ({ run_id: '33333333-3333-4333-a333-333333333333' }),
    claim: async () => [account],
    quota: async (a) => {
      reservations.push(a);
      return { quota_day: a.quota_day, used_units: 0, permitted: true };
    },
    resolve: async () => {},
    ingest: async () => assert.fail('no items'),
    cost: async () => assert.fail('no API calls'),
    report: async () => {},
    finish: async (a) => ({ state: 'completed', summary: { run_id: a.run_id, status: 'failed' } }),
  };
  const r = await runYoutubeCollector(
    { env: 'dev', mode: 'daily', limit: 1, accountIds: [account.account_id], executionId: 'midnight' },
    {
      gateway,
      now: () => (clock++ === 0 ? '2026-10-28T06:59:59Z' : '2026-10-28T07:00:00Z'),
      request: async () => assert.fail('no new-day API under prior-day budget'),
    },
  );
  assert.equal(r.state, 'completed');
  assert.equal(r.status, 'failed');
  assert.equal(r.api_requests, 0);
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0].quantity, 0);
});
