import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planUpkeepWindow,
  planPaidRemovalBatches,
  evaluateRemovalListing,
  runRemovalAccount,
} from './upkeep.mjs';

// Local synthetic listing contracts. These are not provider captures or a live
// removal receipt, and the injected write ports below never contact a database.
const account = {
  account_id: '11111111-1111-4111-a111-111111111111',
  competitor_id: '22222222-2222-4222-a222-222222222222',
  platform: 'instagram',
  handle: 'fixture.films',
  url: 'https://www.instagram.com/fixture.films/',
};
const known = ['one', 'two', 'three', 'four'];
const target = {
  account_id: account.account_id,
  platform: 'linkedin',
  pass: 'posts',
  since: '2026-09-29',
  metrics_since: '2026-09-29',
  known_external_ids: known,
};
const entry = (external_id = 'one', published_at = '2026-10-28T00:00:00Z') => ({
  account_id: account.account_id,
  platform: 'linkedin',
  external_id,
  published_at,
});
const listing = (extra = {}) => ({
  account_id: account.account_id,
  platform: 'linkedin',
  pass: 'posts',
  requested_since: '2026-09-29',
  status: 'SUCCEEDED',
  range_complete: true,
  source_exhausted: true,
  reached_since: false,
  hit_limit: false,
  next_cursor: null,
  pinned_included: true,
  entries: [entry('one'), entry('two')],
  ...extra,
});

test('free removal uses90days and daily metrics30days; paid uses weekly30days', () => {
  const v = planUpkeepWindow('vimeo', '2026-10-29T12:00:00Z');
  assert.equal(v.removal_since, '2026-07-31');
  assert.equal(v.metrics_since, '2026-09-29');
  assert.equal(v.metrics_cadence, 'daily');
  const ig = planUpkeepWindow('instagram', '2026-10-29T12:00:00Z');
  assert.equal(ig.removal_since, '2026-09-29');
  assert.equal(ig.metrics_cadence, 'weekly');
  assert.equal(ig.metrics_since, '2026-09-29');
});

test('window derives from current UTC day, never mutates a source watermark', () => {
  assert.equal(planUpkeepWindow('linkedin', '2026-03-01T02:00:00Z').removal_since, '2026-01-30');
  assert.equal(
    planUpkeepWindow('youtube', '2026-10-29T12:00:00Z', { freeDays: 60, paidDays: 14 }).removal_since,
    '2026-08-30',
  );
  for (const p of ['instagram_stories', 'linkedin_employees', 'news', 'website', 'website_work_page']) {
    assert.throws(() => planUpkeepWindow(p, '2026-10-29T12:00:00Z'), /M06_UPKEEP_PLATFORM_UNSUPPORTED/);
  }
  assert.throws(() => planUpkeepWindow('vimeo', 'not-a-date'), /M06_UPKEEP_CONTEXT_INVALID/);
  assert.throws(() => planUpkeepWindow('vimeo', '2026-02-30T00:00:00Z'), /M06_UPKEEP_CONTEXT_INVALID/);
});

test('weekly Instagram posts include pinned content; reels never invent that input', () => {
  const original = structuredClone(account);
  const options = { platform: 'instagram', pass: 'posts', now: '2026-10-29T12:00:00Z', resultsLimit: 1500 };
  const posts = planPaidRemovalBatches([account], options)[0];
  assert.equal(posts.input.onlyPostsNewerThan, '2026-09-29');
  assert.equal(posts.input.skipPinnedPosts, false);
  assert.deepEqual(posts.account_ids, [account.account_id]);
  assert.equal(posts.purpose, 'removal_check');
  assert.equal(posts.coverage.complete, false);
  const reels = planPaidRemovalBatches([account], { ...options, pass: 'reels' })[0];
  assert.equal(reels.input.resultsType, 'reels');
  assert.equal(Object.hasOwn(reels.input, 'skipPinnedPosts'), false);
  assert.deepEqual(account, original);
  for (const wrong of [
    { ...account, platform: undefined },
    { ...account, competitor_id: undefined },
    { ...account, url: 'https://www.instagram.com/another.company/' },
  ]) {
    assert.throws(() => planPaidRemovalBatches([wrong], options), /M06_UPKEEP_CONTEXT_INVALID/);
  }
});

test('LinkedIn listing reuses supported public input and preserves reposts', () => {
  const li = {
    ...account,
    platform: 'linkedin',
    handle: 'fixture-films',
    url: 'https://www.linkedin.com/company/fixture-films/',
  };
  const b = planPaidRemovalBatches([li], {
    platform: 'linkedin',
    pass: 'posts',
    now: '2026-10-29T12:00:00Z',
    resultsLimit: 500,
  })[0];
  assert.equal(b.actor, 'harvestapi/linkedin-company-posts');
  assert.deepEqual(b.input, {
    targetUrls: [li.url],
    postedLimitDate: '2026-09-29',
    maxPosts: 500,
    includeReposts: true,
    includeQuotePosts: true,
    scrapeReactions: false,
    scrapeComments: false,
  });
  assert.throws(
    () =>
      planPaidRemovalBatches([li], {
        platform: 'linkedin',
        pass: 'reels',
        now: '2026-10-29T12:00:00Z',
        resultsLimit: 500,
      }),
    /M06_UPKEEP_CONTEXT_INVALID/,
  );
});

test('a verified complete listing produces only exact account/window SQL arguments', () => {
  const p = evaluateRemovalListing(target, listing());
  assert.deepEqual(p, {
    eligible: true,
    reason: null,
    metrics_external_ids: ['one', 'two'],
    mark_removed_args: {
      p_account_id: account.account_id,
      p_seen_external_ids: ['one', 'two'],
      p_since: '2026-09-29',
    },
  });
});

test('provider failure is not empty-listing evidence and cannot update metrics/removal', () => {
  const p = evaluateRemovalListing(target, listing({ status: 'FAILED', entries: [] }));
  assert.equal(p.eligible, false);
  assert.equal(p.reason, 'source_run_not_successful');
  assert.deepEqual(p.metrics_external_ids, []);
  assert.equal(p.mark_removed_args, null);
});

test('empty successful output never marks known content removed', () => {
  assert.equal(evaluateRemovalListing(target, listing({ entries: [] })).reason, 'empty_listing');
});

test('duplicate rows do not make a capped suspicious listing look sufficiently large', () => {
  const p = evaluateRemovalListing(
    target,
    listing({ entries: [entry('one'), entry('one'), entry('one')], hit_limit: true, range_complete: false }),
  );
  assert.equal(p.reason, 'suspect_partial_listing');
  assert.deepEqual(p.metrics_external_ids, ['one']);
  assert.equal(p.mark_removed_args, null);
});

test('a partial page never proves absence even when it exceeds half the known count', () => {
  for (const extra of [
    { range_complete: false },
    { source_exhausted: false, reached_since: false },
    { hit_limit: true },
    { next_cursor: 'page2' },
  ]) {
    const p = evaluateRemovalListing(target, listing(extra));
    assert.equal(p.eligible, false);
    assert.equal(p.reason, 'range_not_covered');
    assert.equal(p.mark_removed_args, null);
  }
});

test('range crossing is enough without source exhaustion; omitted pinned posts block posts', () => {
  assert.equal(
    evaluateRemovalListing(target, listing({ source_exhausted: false, reached_since: true })).eligible,
    true,
  );
  const t = { ...target, platform: 'instagram' };
  const r = listing({
    platform: 'instagram',
    pinned_included: false,
    entries: [{ ...entry(), platform: 'instagram' }],
  });
  assert.equal(evaluateRemovalListing(t, r).reason, 'pinned_posts_not_covered');
});

test('receipt account, pass, platform, requested window and every source row must agree', () => {
  for (const extra of [
    { account_id: account.competitor_id },
    { platform: 'youtube' },
    { pass: 'reels' },
    { requested_since: '2026-10-01' },
    { entries: [entry('one'), { ...entry('two'), account_id: account.competitor_id }] },
  ]) {
    assert.throws(() => evaluateRemovalListing(target, listing(extra)), /M06_UPKEEP_LISTING_INVALID/);
  }
});

test('metrics window includes boundary and known IDs, while removal range may be wider', () => {
  const p = evaluateRemovalListing(
    { ...target, platform: 'vimeo', pass: 'videos', since: '2026-07-31' },
    listing({
      platform: 'vimeo',
      pass: 'videos',
      requested_since: '2026-07-31',
      entries: [
        { ...entry('old', '2026-08-01T00:00:00Z'), platform: 'vimeo' },
        { ...entry('edge', '2026-09-29T00:00:00Z'), platform: 'vimeo' },
      ],
    }),
  );
  assert.equal(p.eligible, true);
  assert.deepEqual(p.metrics_external_ids, ['edge']);
  assert.deepEqual(p.mark_removed_args.p_seen_external_ids, ['edge', 'old']);
  const offset = evaluateRemovalListing(
    target,
    listing({
      entries: [entry('before', '2026-09-29T00:30:00+02:00'), entry('after', '2026-09-29T02:00:00+02:00')],
    }),
  );
  assert.deepEqual(offset.metrics_external_ids, ['after']);
});

test('Instagram posts cannot remove reels: both owned complete passes are required', () => {
  const t = { ...target, platform: 'instagram' };
  const post = listing({ platform: 'instagram', entries: [{ ...entry('post'), platform: 'instagram' }] });
  const reel = listing({
    platform: 'instagram',
    pass: 'reels',
    entries: [{ ...entry('reel'), platform: 'instagram' }],
  });
  assert.equal(evaluateRemovalListing(t, post).reason, 'instagram_other_pass_pending');
  const joint = {
    account_id: t.account_id,
    platform: 'instagram',
    pass: 'posts_and_reels',
    requested_since: t.since,
    passes: [post, reel],
  };
  const p = evaluateRemovalListing({ ...t, pass: 'posts_and_reels' }, joint);
  assert.equal(p.eligible, true);
  assert.deepEqual(p.mark_removed_args.p_seen_external_ids, ['post', 'reel']);
  assert.equal(
    evaluateRemovalListing(
      { ...t, pass: 'posts_and_reels' },
      { ...joint, passes: [post, { ...reel, range_complete: false }] },
    ).eligible,
    false,
  );
  assert.throws(
    () => evaluateRemovalListing({ ...t, pass: 'posts_and_reels' }, { ...joint, passes: [post, post] }),
    /M06_UPKEEP_LISTING_INVALID/,
  );
});

test('an explicitly complete empty reels pass can join posts, but two empty passes never mass-remove', () => {
  const t = { ...target, platform: 'instagram', pass: 'posts_and_reels' };
  const post = listing({ platform: 'instagram', entries: [{ ...entry('post'), platform: 'instagram' }] });
  const reel = listing({ platform: 'instagram', pass: 'reels', entries: [] });
  const joint = {
    account_id: t.account_id,
    platform: 'instagram',
    pass: 'posts_and_reels',
    requested_since: t.since,
    passes: [post, reel],
  };
  assert.equal(evaluateRemovalListing(t, joint).eligible, true);
  assert.equal(
    evaluateRemovalListing(t, { ...joint, passes: [{ ...post, entries: [] }, reel] }).reason,
    'empty_listing',
  );
});

test('coordinator refreshes observed metrics before guarded removal and returns actual receipt', async () => {
  const calls = [];
  const r = await runRemovalAccount(target, listing(), {
    refreshMetrics: async (ids) => {
      calls.push(['metrics', ids]);
      return { updated: ids.length };
    },
    markRemoved: async (args) => {
      calls.push(['removal', args]);
      return { removed: 2, restored: 1 };
    },
  });
  assert.equal(r.metrics_updated, 2);
  assert.deepEqual(r.removal, { removed: 2, restored: 1 });
  assert.deepEqual(
    calls.map((x) => x[0]),
    ['metrics', 'removal'],
  );
});

test('partial listing can refresh known observations but never calls markRemoved', async () => {
  const calls = [];
  const r = await runRemovalAccount(target, listing({ range_complete: false }), {
    refreshMetrics: async (ids) => {
      calls.push(ids);
      return { updated: 1 };
    },
    markRemoved: async () => {
      throw Error('must not be called');
    },
  });
  assert.equal(r.removal, null);
  assert.equal(r.reason, 'range_not_covered');
  assert.equal(r.metrics_updated, 1);
  assert.equal(calls.length, 1);
});

test('cancelled/uncertain metrics or malformed mutation receipts stop without blind retry', async () => {
  let marks = 0;
  await assert.rejects(
    runRemovalAccount(target, listing(), {
      refreshMetrics: async () => {
        throw Error('uncertain write');
      },
      markRemoved: async () => {
        marks++;
      },
    }),
    /M06_UPKEEP_METRICS_RECONCILIATION_REQUIRED/,
  );
  assert.equal(marks, 0);
  await assert.rejects(
    runRemovalAccount(target, listing(), {
      refreshMetrics: async () => ({ updated: 99 }),
      markRemoved: async () => {
        marks++;
      },
    }),
    /M06_UPKEEP_METRICS_RECONCILIATION_REQUIRED/,
  );
  assert.equal(marks, 0);
  await assert.rejects(
    runRemovalAccount(target, listing(), {
      refreshMetrics: async () => ({ updated: 2 }),
      markRemoved: async () => {
        marks++;
        throw Error('private transport diagnostic');
      },
    }),
    /M06_UPKEEP_REMOVAL_RECONCILIATION_REQUIRED/,
  );
  assert.equal(marks, 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runRemovalAccount(
      target,
      listing(),
      {
        refreshMetrics: async () => {
          throw Error('must not run');
        },
        markRemoved: async () => {
          marks++;
        },
      },
      controller.signal,
    ),
    /M06_UPKEEP_CANCELLED/,
  );
});
