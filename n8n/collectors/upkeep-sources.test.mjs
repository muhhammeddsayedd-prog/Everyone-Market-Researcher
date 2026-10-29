import assert from 'node:assert/strict';
import test from 'node:test';
import { readUpkeepListing, UPKEEP_SOURCE_REFERENCES } from './upkeep-sources.mjs';
import { evaluateRemovalListing } from './upkeep.mjs';

// Controlled official-response and actor-output examples. No provider capture,
// live account, credentials, network, source launch or database mutation occurs.
const id = '11111111-1111-4111-a111-111111111111';
const competitor = '22222222-2222-4222-a222-222222222222';
const options = { now: '2026-10-29T12:00:00Z', maxPages: 3, maxItems: 1000 };
const common = {
  account_id: id,
  competitor_id: competitor,
  since: '2026-09-29',
  metrics_since: '2026-09-29',
  known_external_ids: ['101', '102'],
};
const vimeoTarget = {
  ...common,
  platform: 'vimeo',
  pass: 'videos',
  handle: 'fixturefilms',
  url: 'https://vimeo.com/fixturefilms',
  external_id: '42',
};
const channel = 'UC1234567890123456789012';
const youtubeTarget = {
  ...common,
  platform: 'youtube',
  pass: 'videos',
  handle: 'fixture',
  url: 'https://www.youtube.com/@fixture',
  external_id: channel,
  uploads_playlist_id: 'UU1234567890123456789012',
};
const ref = (run_id) => ({ run_id, actor_id: 'approvedActor', build_id: 'approvedBuild' });
const instagramTarget = {
  ...common,
  platform: 'instagram',
  pass: 'posts_and_reels',
  handle: 'fixture.films',
  url: 'https://www.instagram.com/fixture.films/',
  source_runs: { posts: ref('knownPosts'), reels: ref('knownReels') },
};
const linkedinTarget = {
  ...common,
  platform: 'linkedin',
  pass: 'posts',
  handle: 'fixture-films',
  url: 'https://www.linkedin.com/company/fixture-films/',
  source_runs: { posts: ref('knownLinkedIn') },
};
const vimeoVideo = (n = '101', date = '2026-10-28T00:00:00Z') => ({
  uri: '/videos/' + n,
  link: 'https://vimeo.com/' + n,
  privacy: { view: 'anybody' },
  release_time: date,
  created_time: date,
  duration: 30,
  name: 'Controlled public-metadata fixture',
  user: { uri: '/users/42' },
  stats: { plays: 100 },
  metadata: { connections: { likes: { total: 5 }, comments: { total: 2 } } },
});
const vimeoPage = (rows, next = null, page = 1) => ({ data: rows, page, per_page: 100, paging: { next } });
const nextVimeo = '/users/42/videos?page=2&per_page=100&sort=date&direction=desc';
const youtubeVideo = (videoId = 'fixture0001', date = '2026-10-28T00:00:00Z') => ({
  id: videoId,
  snippet: { channelId: channel, publishedAt: date, title: 'Controlled fixture', description: '' },
  status: { privacyStatus: 'public' },
  statistics: { viewCount: '100', likeCount: '5' },
  contentDetails: { duration: 'PT30S' },
});
const youtubePage = (ids, next) => ({
  items: ids.map((videoId) => ({ snippet: { videoOwnerChannelId: channel }, contentDetails: { videoId } })),
  ...(next ? { nextPageToken: next } : {}),
});
function requests(bodies) {
  const calls = [];
  return {
    calls,
    request: async (request) => {
      calls.push(request);
      assert.equal(request.method, 'GET');
      assert.equal(new URL(request.url).searchParams.has('key'), false);
      const next = bodies.shift();
      assert.notEqual(next, undefined, 'unexpected source request');
      if (typeof next === 'function') return next(request);
      return { status: 200, body: next };
    },
  };
}
const igRow = (shortCode, date = '2026-10-28T00:00:00Z', extra = {}) => ({
  type: 'Image',
  shortCode,
  ownerUsername: 'fixture.films',
  timestamp: date,
  likesCount: 5,
  commentsCount: 2,
  ...extra,
});
const liRow = () => ({
  type: 'post',
  id: '123456789012345',
  linkedinUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:123456789012345/',
  author: { type: 'company', universalName: 'fixture-films', linkedinUrl: linkedinTarget.url },
  postedAt: { date: '2026-10-28T00:00:00Z' },
  content: 'Controlled example',
  engagement: { likes: 8, comments: 2, shares: 1 },
});
function snapshot(target, pass, rows, extra = {}) {
  return {
    verified_actor: { actor_id: 'approvedActor', build_id: 'approvedBuild' },
    run: {
      id: target.source_runs[pass].run_id,
      actId: 'approvedActor',
      buildId: 'approvedBuild',
      status: 'SUCCEEDED',
      defaultDatasetId: 'knownDataset',
      finishedAt: '2026-10-29T10:00:00Z',
    },
    input:
      target.platform === 'instagram'
        ? {
            directUrls: [target.url],
            resultsType: pass,
            resultsLimit: 100,
            onlyPostsNewerThan: '2026-10-28',
            addParentData: false,
            ...(pass === 'posts' ? { skipPinnedPosts: false } : {}),
          }
        : {
            targetUrls: [target.url],
            maxPosts: 100,
            postedLimitDate: '2026-10-28',
            scrapeComments: false,
            scrapeReactions: false,
          },
    dataset: { id: 'knownDataset', offset: 0, limit: 100, itemCount: rows.length, items: rows },
    ...extra,
  };
}

test('Vimeo derives exhaustion from the exact owned official list response', async () => {
  const ports = requests([vimeoPage([vimeoVideo()])]);
  const receipt = await readUpkeepListing(vimeoTarget, ports, options);
  assert.equal(receipt.range_complete, true);
  assert.equal(receipt.source_exhausted, true);
  assert.equal(receipt.status, 'SUCCEEDED');
  assert.equal(receipt.api_request_count, 1);
  assert.equal(receipt.entries[0].metrics.plays, 100);
  assert.equal(evaluateRemovalListing(vimeoTarget, receipt).eligible, true);
  assert.equal(new URL(ports.calls[0].url).pathname, '/users/42/videos');
});

test('Vimeo sorted traversal crosses requested date without borrowing a continuation', async () => {
  const ports = requests([
    vimeoPage([vimeoVideo()], nextVimeo),
    vimeoPage([vimeoVideo('99', '2026-09-28T23:59:59Z')], '/users/42/videos?page=3', 2),
  ]);
  const receipt = await readUpkeepListing(vimeoTarget, ports, options);
  assert.equal(receipt.pages_observed, 2);
  assert.equal(receipt.reached_since, true);
  assert.equal(receipt.source_exhausted, false);
  assert.equal(receipt.next_cursor, null);
  assert.deepEqual(
    receipt.entries.map((r) => r.external_id),
    ['101'],
  );
  assert.equal(evaluateRemovalListing(vimeoTarget, receipt).eligible, true);
});

test('empty/capped Vimeo cannot mark removed; option complete is never evidence', async () => {
  const empty = await readUpkeepListing(vimeoTarget, requests([vimeoPage([])]), options);
  assert.equal(evaluateRemovalListing(vimeoTarget, empty).reason, 'empty_listing');
  const capped = await readUpkeepListing(vimeoTarget, requests([vimeoPage([vimeoVideo()], nextVimeo)]), {
    ...options,
    maxPages: 1,
    complete: true,
  });
  assert.equal(capped.range_complete, false);
  assert.equal(capped.hit_limit, true);
  assert.equal(evaluateRemovalListing(vimeoTarget, capped).eligible, false);
});

test('interrupted listing retains already validated metrics and blocks removal', async () => {
  const ports = requests([
    vimeoPage([vimeoVideo()], nextVimeo),
    () => {
      throw Error('credential-bearing private transport text');
    },
  ]);
  const receipt = await readUpkeepListing(vimeoTarget, ports, options);
  assert.equal(receipt.status, 'FAILED');
  assert.equal(receipt.reason, 'M06_UPKEEP_SOURCE_TRANSPORT_FAILED');
  assert.equal(receipt.api_request_count, 2);
  assert.equal(JSON.stringify(receipt).includes('credential-bearing'), false);
  const policy = evaluateRemovalListing(vimeoTarget, receipt);
  assert.equal(policy.eligible, false);
  assert.deepEqual(policy.metrics_external_ids, ['101']);
});

test('foreign pagination, owner, redirect and unsorted responses fail closed', async () => {
  const cases = [
    [vimeoPage([vimeoVideo()], 'https://evil.invalid/users/42/videos?page=2')],
    [vimeoPage([vimeoVideo()], '/users/999/videos?page=2')],
    [vimeoPage([{ ...vimeoVideo(), user: { uri: '/users/999' } }])],
    [() => ({ status: 302, body: {} })],
    [vimeoPage([vimeoVideo('102', '2026-10-27T00:00:00Z'), vimeoVideo('101', '2026-10-28T00:00:00Z')])],
    [vimeoPage([], nextVimeo)],
  ];
  for (const bodies of cases) {
    const receipt = await readUpkeepListing(vimeoTarget, requests(bodies), options);
    assert.equal(receipt.status, 'FAILED');
    assert.equal(receipt.range_complete, false);
    assert.equal(receipt.entries.length, 0);
  }
});

test('YouTube verifies playlist owner/details and follows the actual page tokens to exhaustion', async () => {
  const ports = requests([
    youtubePage(['fixture0001'], 'next'),
    { items: [youtubeVideo()] },
    youtubePage(['fixture0002']),
    { items: [youtubeVideo('fixture0002')] },
  ]);
  const receipt = await readUpkeepListing(youtubeTarget, ports, options);
  assert.equal(receipt.range_complete, true);
  assert.equal(receipt.source_exhausted, true);
  assert.equal(receipt.pages_observed, 2);
  assert.equal(ports.calls.length, 4);
  assert.equal(receipt.api_request_count, 4);
  assert.equal(new URL(ports.calls[2].url).searchParams.get('pageToken'), 'next');
  assert.equal(evaluateRemovalListing(youtubeTarget, receipt).eligible, true);
});

test('YouTube page cap, unavailable detail and token cycle never prove absence', async () => {
  const cap = await readUpkeepListing(
    youtubeTarget,
    requests([youtubePage(['fixture0001'], 'next'), { items: [youtubeVideo()] }]),
    { ...options, maxPages: 1 },
  );
  assert.equal(cap.hit_limit, true);
  assert.equal(cap.range_complete, false);
  const missing = await readUpkeepListing(
    youtubeTarget,
    requests([youtubePage(['fixture0001']), { items: [] }]),
    options,
  );
  assert.equal(missing.range_complete, false);
  assert.equal(missing.reason, 'unavailable_video');
  const cycle = await readUpkeepListing(
    youtubeTarget,
    requests([
      youtubePage(['fixture0001'], 'again'),
      { items: [youtubeVideo()] },
      youtubePage(['fixture0002'], 'again'),
      { items: [youtubeVideo('fixture0002')] },
    ]),
    options,
  );
  assert.equal(cycle.status, 'FAILED');
  assert.equal(cycle.reason, 'M06_UPKEEP_PAGINATION_CYCLE');
});

test('YouTube owner drift, duplicate IDs and nonterminal empty page fail closed', async () => {
  for (const bodies of [
    [
      {
        items: [
          {
            snippet: { videoOwnerChannelId: 'UC9999999999999999999999' },
            contentDetails: { videoId: 'fixture0001' },
          },
        ],
      },
    ],
    [youtubePage(['fixture0001', 'fixture0001'])],
    [youtubePage([], 'next')],
    [
      youtubePage(['fixture0001']),
      {
        items: [
          {
            ...youtubeVideo(),
            snippet: { ...youtubeVideo().snippet, channelId: 'UC9999999999999999999999' },
          },
        ],
      },
    ],
  ]) {
    const receipt = await readUpkeepListing(youtubeTarget, requests(bodies), options);
    assert.equal(receipt.status, 'FAILED');
    assert.equal(receipt.range_complete, false);
    assert.equal(receipt.entries.length, 0);
  }
});

test('Instagram known posts/reels inputs yield metrics, never invented source EOF', async () => {
  const calls = [];
  const ports = {
    actorSnapshot: async (r) => {
      calls.push(r);
      const rows =
        r.pass === 'posts'
          ? [igRow('Pinned', '2026-09-01T00:00:00Z', { isPinned: true }), igRow('Recent')]
          : [igRow('Reel', undefined, { type: 'Video' })];
      return { ...snapshot(instagramTarget, r.pass, rows), complete: true, source_exhausted: true };
    },
  };
  const receipt = await readUpkeepListing(instagramTarget, ports, options);
  assert.deepEqual(
    calls.map((r) => r.run_id),
    ['knownPosts', 'knownReels'],
  );
  assert.deepEqual(
    receipt.entries.map((r) => r.external_id),
    ['Recent', 'Reel'],
  );
  assert.equal(receipt.passes[0].pinned_included, true);
  assert.equal(receipt.entries[0].observed_at, '2026-10-29T10:00:00.000Z');
  assert.equal(receipt.reason, 'paid_source_exhaustion_unverified');
  assert.equal(receipt.range_complete, false);
  const policy = evaluateRemovalListing(instagramTarget, receipt);
  assert.equal(policy.eligible, false);
  assert.deepEqual(policy.metrics_external_ids, ['Recent', 'Reel']);
});

test('Instagram capped results still refresh observed metrics without absence claims', async () => {
  const receipt = await readUpkeepListing(
    instagramTarget,
    {
      actorSnapshot: async (r) => {
        const value = snapshot(instagramTarget, r.pass, [igRow('Cap' + r.pass)]);
        value.input.resultsLimit = 1;
        return value;
      },
    },
    options,
  );
  assert.equal(
    receipt.passes.every((r) => r.hit_limit),
    true,
  );
  assert.equal(receipt.entries.length, 2);
  assert.equal(evaluateRemovalListing(instagramTarget, receipt).eligible, false);
});

test('Instagram rejects wrong run/build/owner or login inputs and retains independent safe pass metrics', async () => {
  for (const mutate of [
    (s) => {
      s.run.id = 'unknown';
    },
    (s) => {
      s.run.buildId = 'unreviewed';
    },
    (s) => {
      s.dataset.items[0].ownerUsername = 'unrelated.company';
    },
    (s) => {
      s.input.cookies = [];
    },
    (s) => {
      s.input.directUrls = ['https://www.instagram.com/unrelated.company/'];
    },
  ]) {
    const receipt = await readUpkeepListing(
      instagramTarget,
      {
        actorSnapshot: async (r) => {
          const value = snapshot(instagramTarget, r.pass, [igRow(r.pass)]);
          if (r.pass === 'posts') mutate(value);
          return value;
        },
      },
      options,
    );
    assert.equal(receipt.status, 'FAILED');
    assert.deepEqual(
      receipt.entries.map((r) => r.external_id),
      ['reels'],
    );
    assert.equal(evaluateRemovalListing(instagramTarget, receipt).eligible, false);
  }
});

test('LinkedIn known public snapshot refreshes only its company metrics without pretending exhaustion', async () => {
  const receipt = await readUpkeepListing(
    linkedinTarget,
    { actorSnapshot: async () => snapshot(linkedinTarget, 'posts', [liRow()]) },
    options,
  );
  assert.equal(receipt.entries.length, 1);
  assert.deepEqual(receipt.entries[0].metrics, { likes: 8, comments: 2, shares: 1 });
  assert.equal(receipt.range_complete, false);
  assert.equal(receipt.source_exhausted, false);
});

test('actual registered actor slugs and unknown historical build use separately verified current pins', async () => {
  const target = structuredClone(instagramTarget);
  for (const value of Object.values(target.source_runs)) {
    value.actor_id = 'apify/instagram-scraper';
    value.build_id = null;
  }
  const receipt = await readUpkeepListing(
    target,
    { actorSnapshot: async (r) => snapshot(target, r.pass, [igRow(r.pass)]) },
    options,
  );
  assert.equal(receipt.status, 'SUCCEEDED');
  assert.equal(receipt.entries.length, 2);
  const mismatch = await readUpkeepListing(
    target,
    {
      actorSnapshot: async (r) => {
        const value = snapshot(target, r.pass, [igRow(r.pass)]);
        value.verified_actor.build_id = 'differentQualifiedPin';
        return value;
      },
    },
    options,
  );
  assert.equal(mismatch.status, 'FAILED');
  assert.equal(mismatch.entries.length, 0);
});

test('multi-account registered Instagram datasets refresh exactly the selected owner', async () => {
  const receipt = await readUpkeepListing(
    instagramTarget,
    {
      actorSnapshot: async (r) => {
        const value = snapshot(instagramTarget, r.pass, [
          igRow(r.pass),
          igRow('Other', undefined, { ownerUsername: 'other.films' }),
        ]);
        value.input.directUrls.push('https://www.instagram.com/other.films/');
        return value;
      },
    },
    options,
  );
  assert.equal(receipt.status, 'SUCCEEDED');
  assert.deepEqual(
    receipt.entries.map((r) => r.external_id),
    ['posts', 'reels'],
  );
  assert.equal(
    receipt.entries.every((r) => r.account_id === id),
    true,
  );
  assert.equal(receipt.range_complete, false);
});

test('multi-account LinkedIn INPUT never transfers another company metrics', async () => {
  const receipt = await readUpkeepListing(
    linkedinTarget,
    {
      actorSnapshot: async () => {
        const other = liRow();
        other.id = '223456789012345';
        other.linkedinUrl = 'https://www.linkedin.com/feed/update/urn:li:activity:223456789012345/';
        other.author.universalName = 'other-films';
        other.author.linkedinUrl = 'https://www.linkedin.com/company/other-films/';
        const value = snapshot(linkedinTarget, 'posts', [liRow(), other]);
        value.input.targetUrls.push(other.author.linkedinUrl);
        return value;
      },
    },
    options,
  );
  assert.equal(receipt.entries.length, 1);
  assert.equal(receipt.entries[0].external_id, '123456789012345');
});

test('source validation enforces target windows and cancellation before another request', async () => {
  const controller = new AbortController();
  const ports = requests([
    () => {
      controller.abort();
      return { status: 200, body: vimeoPage([vimeoVideo()], nextVimeo) };
    },
  ]);
  const receipt = await readUpkeepListing(vimeoTarget, ports, options, controller.signal);
  assert.equal(receipt.status, 'FAILED');
  assert.equal(receipt.reason, 'M06_UPKEEP_CANCELLED');
  assert.equal(ports.calls.length, 1);
  for (const target of [
    { ...vimeoTarget, since: '2026-02-30' },
    { ...vimeoTarget, metrics_since: '2026-09-01' },
    { ...vimeoTarget, pass: 'posts' },
  ])
    await assert.rejects(() => readUpkeepListing(target, requests([]), options), /SOURCE_CONTEXT_INVALID/);
  const pre = new AbortController();
  pre.abort();
  await assert.rejects(() => readUpkeepListing(vimeoTarget, requests([]), options, pre.signal), /CANCELLED/);
});

test('current references distinguish official API exhaustion from capped actor datasets', () => {
  assert.match(UPKEEP_SOURCE_REFERENCES.youtube, /developers.google.com/);
  assert.match(UPKEEP_SOURCE_REFERENCES.paidLimitation, /Dataset EOF.*do not prove source EOF/);
});
