import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
type InstagramBatch = {
  actor: string;
  account_ids: string[];
  result_type: string;
  input: Record<string, unknown>;
};
const { buildInstagramBackfillPasses, buildInstagramBatches } = (await import(
  new URL('../collectors/instagram.mjs', import.meta.url).href
)) as {
  buildInstagramBatches: (accounts: unknown[], options: unknown) => InstagramBatch[];
  buildInstagramBackfillPasses: (accounts: unknown[]) => { posts: InstagramBatch[]; reels: InstagramBatch[] };
};

const require = createRequire(import.meta.url);
// This canonical schema uses common draft7 keywords only. Reuse the already
// locked ESLint-owned AJV6 for this exact schema, not as general 2020-12 support.
const Ajv = createRequire(require.resolve('eslint/package.json'))('ajv');
const schema = JSON.parse(
  readFileSync(new URL('../../reference/n8n/normalized_item.schema.json', import.meta.url), 'utf8'),
);
delete schema.$schema;
const schemaValid = new Ajv({ allErrors: true }).compile(schema);
const { normalizeInstagramScraper, prepareInstagramResults } = require('./instagramScraper.js');
const { prepareIngestGroups } = require('./prepare_ingest_groups.js');
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/instagram-scraper/synthetic-contract.json', import.meta.url), 'utf8'),
);
const account = (index = 1, overrides = {}) => ({
  id: `90000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  platform: 'instagram',
  handle: index === 1 ? '@Synthetic_Studio' : `synthetic_${index}`,
  last_item_published_at: '2026-10-24T09:00:00.000Z',
  ...overrides,
});
const context = (overrides = {}) => ({
  accounts: [account()],
  mode: 'daily',
  result_type: 'posts',
  resultsLimit: 30,
  ...overrides,
});
const row = (overrides = {}) => ({ ...fixture.rows[0], ...overrides });

describe('Instagram synthetic normalization; no captured-provider acceptance', () => {
  it('keeps provenance and emits only ingestable normalized items, with raw payload untouched', () => {
    expect(fixture.fixtureProvenance.actualActorCapture).toBe(false);
    const items = normalizeInstagramScraper(fixture.rows, { result_type: 'posts' });
    expect(items.map((item: { item_type: string }) => item.item_type)).toEqual([
      'post',
      'carousel',
      'reel',
      'video',
    ]);
    expect(items[0]).toMatchObject({
      platform: 'instagram',
      actor: 'apify/instagram-scraper',
      external_id: 'SyntheticImage01',
      payload: fixture.rows[0],
    });
    for (const item of items) expect(schemaValid(item), JSON.stringify(schemaValid.errors)).toBe(true);
    const prepared = prepareIngestGroups([{ account_id: account().id, items }])[0];
    expect(prepared.items_dropped).toBe(0);
    expect(prepared.items).toHaveLength(4);
    expect(items.every((item: Record<string, unknown>) => !('matchKey' in item))).toBe(true);
  });
  it('maps only Video rows in the reels pass to reel and keeps Sidecar carousel', () => {
    expect(
      normalizeInstagramScraper(fixture.rows, { result_type: 'reels' }).map(
        (item: { item_type: string }) => item.item_type,
      ),
    ).toEqual(['post', 'carousel', 'reel', 'reel']);
  });
  it('preserves zero, hidden likes and documented views/share fallbacks', () => {
    const items = normalizeInstagramScraper(fixture.rows);
    expect(items[0].metrics).toMatchObject({ likes: null, comments: 0 });
    expect(items[2].metrics).toMatchObject({ views: 12, shares: 0 });
    expect(items[3].metrics).toMatchObject({ views: 0, shares: 2 });
    expect(normalizeInstagramScraper([row({ videoPlayCount: null, igPlayCount: 20 })])[0].metrics.views).toBe(
      20,
    );
  });
  it('bounds integers/text and normalizes tags, mentions and tagged coauthors', () => {
    const item = normalizeInstagramScraper([
      row({
        videoDuration: Infinity,
        commentsCount: 'not a count',
        caption: fixture.rows[0].caption + ' ' + 'x'.repeat(9000),
      }),
    ])[0];
    expect(item.caption).toHaveLength(8000);
    expect(item.duration_seconds).toBeNull();
    expect(item.metrics.comments).toBeNull();
    expect(item.hashtags).toEqual(['film', 'إنتاج']);
    expect(item.mentions).toEqual(['synthetic_agency']);
    expect(item.tagged_accounts).toEqual(['synthetic_client', 'synthetic_agency']);
    expect(item.media_urls).toEqual([]);
  });
  it.each([
    null,
    {},
    { error: 'private' },
    row({ errorDescription: 'login required' }),
    row({ type: 'Unknown' }),
    row({ shortCode: '' }),
    row({ timestamp: '2026-02-30T10:00:00Z' }),
    row({ timestamp: '2026-10-24T24:00:00Z' }),
    row({ timestamp: 'not-a-date' }),
  ])('drops malformed/error row without emitting an ingest error object (%j)', (value) => {
    expect(normalizeInstagramScraper([value])).toEqual([]);
  });
  it('does not rely on URL or imports when composed in a Cloud Code sandbox', () => {
    const source = readFileSync(new URL('./instagramScraper.js', import.meta.url), 'utf8');
    const vm = runInNewContext(
      `${source}\nnormalizeInstagramScraper(${JSON.stringify(fixture.rows)}, {result_type:'posts'});`,
      { URL: undefined },
    );
    expect(JSON.parse(JSON.stringify(vm))).toEqual(normalizeInstagramScraper(fixture.rows));
  });
  it('allows public Instagram CDN thumbnails and their ordinary signed parameters', () => {
    for (const url of [
      'https://scontent.cdninstagram.com/image.jpg?stp=dst-jpg&_nc_cat=101&_nc_ohc=public&oh=public-signature&oe=public-expiry',
      'https://scontent.xx.fbcdn.net/image.jpg?ccb=1-7&_nc_sid=public',
      'https://cdninstagram.com/image.jpg',
      'https://fbcdn.net/image.jpg',
    ]) {
      expect(normalizeInstagramScraper([row({ displayUrl: url })])[0].thumbnail_url).toBe(url);
    }
  });
  it.each([
    'https://127.0.0.1/private',
    'https://[::1]/private',
    'https://10.0.0.1/private',
    'https://internal.local/private',
    'https://cdninstagram.com.evil.invalid/image.jpg',
    'https://evilcdninstagram.com/image.jpg',
    'https://user:password@cdninstagram.com/image.jpg',
    'https://cdninstagram.com:443/image.jpg',
    'http://cdninstagram.com/image.jpg',
    'https://cdninstagram.com/image.jpg\\extra',
    'https://cdninstagram.com/image.jpg\nextra',
    'https://cdninstagram.com/image.jpg?access_token=not-a-real-token',
    'https://cdninstagram.com/image.jpg?API-KEY=not-a-real-key',
    'https://cdninstagram.com/image.jpg?%61ccess%5Ftoken=not-a-real-token',
    'https://cdninstagram.com/image.jpg?%2561ccess_token=not-a-real-token',
    'https://cdninstagram.com/image.jpg?%25%25=malformed',
  ])('nulls an unsafe thumbnail without mutating the retained raw source (%s)', (url) => {
    const source = row({ displayUrl: url });
    const item = normalizeInstagramScraper([source])[0];
    expect(item.thumbnail_url).toBeNull();
    // This adapter does not fetch any URL. Raw payload remains source evidence;
    // downstream media fetch must use thumbnail_url and validate DNS/redirects.
    expect(item.payload).toBe(source);
    expect(source.displayUrl).toBe(url);
  });
});

describe('Instagram pure account results and explicit limits', () => {
  it('matches owner case but does not infer renamed ownership from the input URL', () => {
    const result = prepareInstagramResults(
      [
        ...fixture.rows,
        row({ ownerUsername: 'renamed_studio', inputUrl: 'https://www.instagram.com/synthetic_studio/' }),
      ],
      context(),
    );
    expect(result.groups[0].items).toHaveLength(4);
    expect(result.unmatched).toEqual({ count: 1, owner_usernames: ['renamed_studio'] });
  });
  it('drops daily old pinned rows and enforces each account 30-day metrics cutoff', () => {
    const result = prepareInstagramResults(
      [
        row({ shortCode: 'OldPinned', timestamp: '2026-10-24T08:00:00Z', isPinned: true }),
        row({ shortCode: 'OldOrdinary', timestamp: '2026-09-24T08:59:59Z' }),
        row({ shortCode: 'Overlap', timestamp: '2026-09-24T09:00:00Z' }),
      ],
      context(),
    );
    expect(result.groups[0].items.map((item: { external_id: string }) => item.external_id)).toEqual([
      'Overlap',
    ]);
    expect(result.dropped).toMatchObject({ pinned_before_watermark: 1, older_than_cutoff: 1 });
  });
  it('backfills from the fixed cutoff and reports the secondary pass without schedule fields', () => {
    const result = prepareInstagramResults(
      [
        row({ shortCode: 'BeforeCutoff', timestamp: '2023-12-31T23:59:59Z' }),
        row({ shortCode: 'AtCutoff', timestamp: '2024-01-01T00:00:00Z' }),
      ],
      context({ mode: 'backfill', result_type: 'reels', resultsLimit: 1500 }),
    );
    expect(result.groups[0].items.map((item: { external_id: string }) => item.external_id)).toEqual([
      'AtCutoff',
    ]);
    expect(result.secondary).toBe(true);
    expect(result.groups[0].backfill_done).toBe(false);
    expect(result.limitations).toContain('reels_backfill_exhaustion_unverified');
    expect(JSON.stringify(result)).not.toMatch(/next_due_at|last_success_at|locked_until/);
  });
  it('separates private/login failures from items and flags the third consecutive result for the owner', () => {
    const result = prepareInstagramResults(
      [row({ error: 'Challenge', errorDescription: 'checkpoint required' })],
      context({ accounts: [account(1, { consecutive_failures: 2 })] }),
    );
    expect(result.groups[0]).toMatchObject({
      status: 'failed',
      error: 'ig_private_or_login',
      items: [],
      backfill_done: false,
    });
    expect(result.errors).toEqual([
      {
        account_id: account().id,
        matchKey: 'synthetic_studio',
        error: 'ig_private_or_login',
        invalidation_required: true,
      },
    ]);
  });
  it('retains the third private/login invalidation flag when a later generic error shares the account', () => {
    const result = prepareInstagramResults(
      [row({ error: 'private profile' }), row({ error: 'temporary source failure' })],
      context({ accounts: [account(1, { consecutive_failures: 2 })] }),
    );
    expect(result.errors[0]).toMatchObject({ error: 'ig_private_or_login', invalidation_required: true });
  });
  it('does not silently claim a missing profile succeeded or completed backfill', () => {
    const result = prepareInstagramResults([], context({ mode: 'backfill' }));
    expect(result.groups[0]).toMatchObject({
      status: 'failed',
      error: 'ig_no_account_evidence',
      items: [],
      backfill_done: false,
    });
  });
  it('uses the existing get_due_accounts account_id and watermark_published_at contract', () => {
    const claimed = {
      account_id: account().id,
      handle: 'synthetic_studio',
      watermark_published_at: '2026-10-24T09:00:00Z',
    };
    const result = prepareInstagramResults([row()], context({ accounts: [claimed] }));
    expect(result.groups[0]).toMatchObject({ account_id: claimed.account_id, status: 'success' });
    expect(buildInstagramBatches([claimed], { mode: 'daily', result_type: 'posts' })[0]?.account_ids).toEqual(
      [claimed.account_id],
    );
  });
  it('a full posts page leaves a cursor; a smaller evidenced page can complete posts', () => {
    const full = prepareInstagramResults([row()], context({ mode: 'backfill', resultsLimit: 1 }));
    expect(full.groups[0]).toMatchObject({
      backfill_done: false,
      backfill_cursor: { oldest_seen: fixture.rows[0].timestamp },
    });
    expect(
      prepareInstagramResults([row()], context({ mode: 'backfill', resultsLimit: 2 })).groups[0]
        .backfill_done,
    ).toBe(true);
  });
  it('never completes a full posts result from an old unpinned row in either source order', () => {
    const rows = [
      row({ shortCode: 'RecentFullPost', timestamp: '2026-10-20T00:00:00Z', isPinned: false }),
      row({ shortCode: 'OldFullPost', timestamp: '2023-12-31T23:59:00Z', isPinned: false }),
    ];
    for (const raw of [rows, [...rows].reverse()]) {
      const result = prepareInstagramResults(raw, context({ mode: 'backfill', resultsLimit: 2 }));
      expect(result.groups[0]).toMatchObject({
        status: 'success',
        backfill_done: false,
        backfill_cursor: {
          oldest_seen: '2023-12-31T23:59:00.000Z',
          full_waves: 1,
          results_limit: 2,
          history_state: 'incomplete',
        },
      });
      expect(result.groups[0].items.map((item: { external_id: string }) => item.external_id)).toEqual([
        'RecentFullPost',
      ]);
    }
  });
  it('fails a matched account on schema drift rather than ingesting a partial result', () => {
    const result = prepareInstagramResults([row(), row({ shortCode: 'Bad', timestamp: null })], context());
    expect(result.groups[0]).toMatchObject({ status: 'failed', error: 'ig_contract_drift', items: [] });
  });
});

describe('Instagram pure asynchronous batch inputs', () => {
  it('groups daily watermarks by UTC date, sorts oldest first, chunks at 50, preserves zero network behavior', () => {
    const input = Array.from({ length: 52 }, (_, index) => account(index + 1));
    const copy = structuredClone(input);
    const batches = buildInstagramBatches(input, { mode: 'daily', result_type: 'posts' });
    expect(batches.map((batch: { account_ids: string[] }) => batch.account_ids.length)).toEqual([50, 2]);
    expect(batches[0]).toMatchObject({
      actor: 'apify/instagram-scraper',
      result_type: 'posts',
      input: {
        resultsType: 'posts',
        resultsLimit: 30,
        onlyPostsNewerThan: '2026-09-24',
        skipPinnedPosts: true,
        addParentData: false,
      },
    });
    expect(input).toEqual(copy);
    expect(JSON.stringify(batches)).not.toMatch(/cookie|session|token|password|download/);
  });
  it('does not mix very different watermarks or silently omit an unknown daily watermark', () => {
    const batches = buildInstagramBatches(
      [account(1), account(2, { last_item_published_at: '2026-09-01T00:00:00Z' })],
      { mode: 'daily', result_type: 'posts' },
    );
    expect(batches.map((batch) => batch.input.onlyPostsNewerThan)).toEqual(['2026-08-02', '2026-09-24']);
    expect(() =>
      buildInstagramBatches([account(1, { last_item_published_at: null })], {
        mode: 'daily',
        result_type: 'posts',
      }),
    ).toThrow('ig_daily_watermark_required');
  });
  it('builds posts plus reels for exactly the same claimed backfill accounts, at most 10 per batch', () => {
    const passes = buildInstagramBackfillPasses(Array.from({ length: 11 }, (_, index) => account(index + 1)));
    expect(passes.posts.map((batch: { account_ids: string[] }) => batch.account_ids.length)).toEqual([10, 1]);
    expect(passes.posts.map((batch: { account_ids: string[] }) => batch.account_ids)).toEqual(
      passes.reels.map((batch: { account_ids: string[] }) => batch.account_ids),
    );
    expect(passes.reels[0]?.input).toMatchObject({
      resultsType: 'reels',
      resultsLimit: 1500,
      onlyPostsNewerThan: '2024-01-01',
    });
    expect(passes.reels[0]?.input).not.toHaveProperty('skipPinnedPosts');
  });
  it('isolates the larger result limit after three full backfill waves and preserves its counter', () => {
    const escalated = account(2, { backfill_cursor: { oldest_seen: '2026-10-24T10:00:00Z', full_waves: 3 } });
    const batches = buildInstagramBatches([account(), escalated], { mode: 'backfill', result_type: 'posts' });
    expect(batches.map((batch) => batch.input.resultsLimit).sort()).toEqual([1500, 3000]);
    const result = prepareInstagramResults(
      [row()],
      context({
        mode: 'backfill',
        resultsLimit: 1,
        accounts: [account(1, { backfill_cursor: { full_waves: 2 } })],
      }),
    );
    expect(result.groups[0].backfill_cursor.full_waves).toBe(3);
  });
  it.each([
    { mode: 'other', result_type: 'posts' },
    { mode: 'daily', result_type: 'stories' },
  ])('fails closed for unsupported mode or result type', (options) => {
    expect(() => buildInstagramBatches([account()], options)).toThrow('ig_batch_context_invalid');
  });
  it('rejects duplicate accounts and profile-path injection', () => {
    expect(() =>
      buildInstagramBatches([account(), account()], { mode: 'backfill', result_type: 'posts' }),
    ).toThrow('ig_accounts_invalid');
    expect(() =>
      buildInstagramBatches([account(1, { handle: 'synthetic/p/ABC' })], {
        mode: 'backfill',
        result_type: 'posts',
      }),
    ).toThrow('ig_accounts_invalid');
  });
});
