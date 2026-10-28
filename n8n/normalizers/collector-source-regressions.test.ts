import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { collectVimeoAccount } from '../collectors/vimeo.mjs';
import { buildInstagramBatches } from '../collectors/instagram.mjs';
import {
  advanceCollectorGateway,
  advanceVimeoNative,
  initializeCollector,
  type NativeCollectorState,
} from '../collectors/native-runtime.mjs';

type Row = Record<string, unknown>;
type Fixture = { accounts: Row[]; samples: { account_id: string; raw_metadata: Row }[] };
type InstagramResult = {
  groups: {
    status: string;
    items: Row[];
    backfill_done: boolean;
    backfill_cursor: Row | null;
  }[];
  dropped: { pinned_before_watermark: number };
  coverage_complete: boolean;
  limitations: string[];
};
const require = createRequire(import.meta.url);
const { normalizeVimeoApiResult } = require('./vimeoApi.js');
const { prepareInstagramResults } = require('./instagramScraper.js') as {
  prepareInstagramResults: (rows: unknown[], context: Row) => InstagramResult;
};
const firstGroup = (result: InstagramResult) => {
  const group = result.groups[0];
  if (!group) throw Error('Expected the selected Instagram account group');
  return group;
};
const fixture: Fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/vimeo-api/actual-dev-public-projection-20261027.json', import.meta.url),
    'utf8',
  ),
);
const selected = fixture.accounts.find((a) => a.handle === 'everyonefilms');
if (!selected) throw Error('Retained everyonefilms account is missing');
const account = {
  ...selected,
  account_id: String(selected.id),
  competitor_id: String(selected.competitor_id),
  handle: String(selected.handle),
  url: 'https://vimeo.com/everyonefilms',
  external_id: '123',
  watermark_published_at: '2026-10-26T00:00:00Z',
};
const rows = fixture.samples
  .filter((s) => s.account_id === selected.id)
  .map((s) => s.raw_metadata)
  .sort((a, b) => Date.parse(String(b.release_time)) - Date.parse(String(a.release_time)));
const page = (next: string | null, metadata: Row = {}) => ({
  data: rows,
  paging: { next },
  ...metadata,
});

const igFixture: Fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/instagram-scraper/actual-dev-public-projection-20261027.json', import.meta.url),
    'utf8',
  ),
);
const igAccount = igFixture.accounts.find((a) => a.handle === 'everyone.film');
if (!igAccount) throw Error('Retained everyone.film account is missing');
const igRows = igFixture.samples.filter((s) => s.account_id === igAccount.id).map((s) => s.raw_metadata);
const igClaim = { ...igAccount, last_item_published_at: '2026-10-26T00:00:00Z' };
const igContext = (overrides: Row = {}) => ({
  accounts: [igClaim],
  mode: 'daily',
  result_type: 'posts',
  resultsLimit: 30,
  now: '2026-10-27T10:00:00Z',
  ...overrides,
});

describe('Instagram retained public rows with explicit local time and historical coverage boundaries', () => {
  it('plans daily source retrieval through the older 30-day metrics horizon', () => {
    const batch = buildInstagramBatches([igClaim], {
      mode: 'daily',
      result_type: 'posts',
      now: '2026-10-27T10:00:00Z',
    })[0];
    expect(batch?.input).toMatchObject({ onlyPostsNewerThan: '2026-09-26', resultsLimit: 30 });
  });

  it('keeps existing source IDs inside the metrics horizon for duplicate-upsert and drops older rows', () => {
    const result = prepareInstagramResults(igRows, igContext());
    expect(firstGroup(result).items.map((item: Row) => item.external_id)).toEqual(
      igRows.map((row) => row.shortCode),
    );
    expect(
      firstGroup(result).items.every((item: Row) => !('ai_status' in item) && !('locked_fields' in item)),
    ).toBe(true);
    const older = igRows.map((row) => ({ ...row, timestamp: '2026-09-27T09:59:59Z' }));
    expect(firstGroup(prepareInstagramResults(older, igContext())).items).toEqual([]);
  });

  it('retains daily pinned-before-watermark exclusion even inside the metrics horizon', () => {
    const result = prepareInstagramResults(
      igRows.map((row) => ({ ...row, isPinned: true })),
      igContext(),
    );
    expect(firstGroup(result).items).toEqual([]);
    expect(result.dropped.pinned_before_watermark).toBe(igRows.length);
  });

  it('keeps a stale watermark catch-up window when it is older than the metrics horizon', () => {
    const account = { ...igClaim, last_item_published_at: '2026-08-01T09:00:00Z' };
    expect(
      buildInstagramBatches([account], {
        mode: 'daily',
        result_type: 'reels',
        now: '2026-10-27T10:00:00Z',
      })[0]?.input.onlyPostsNewerThan,
    ).toBe('2026-07-02');
    expect(
      firstGroup(prepareInstagramResults(igRows, igContext({ accounts: [account] }))).items,
    ).toHaveLength(igRows.length);
  });

  it('never claims that a capped daily result proves complete metrics coverage', () => {
    const result = prepareInstagramResults([igRows[0]], igContext({ resultsLimit: 1 }));
    expect(firstGroup(result)).toMatchObject({ status: 'success', backfill_done: false });
    expect(result.coverage_complete).toBe(false);
    expect(result.limitations).toContain('daily_results_limit_reached');
  });

  it('preserves each pass counter from the joint checkpoint, without inventing a history cursor', () => {
    const accounts = [
      { ...igClaim, backfill_cursor: { posts: { full_waves: 2 }, reels: { full_waves: 4 } } },
    ];
    const posts = prepareInstagramResults(
      [igRows[0]],
      igContext({ accounts, mode: 'backfill', resultsLimit: 1 }),
    );
    const reels = prepareInstagramResults(
      [igRows[0]],
      igContext({ accounts, mode: 'backfill', result_type: 'reels', resultsLimit: 1 }),
    );
    expect(firstGroup(posts).backfill_cursor).toMatchObject({ full_waves: 3 });
    expect(firstGroup(reels).backfill_cursor).toMatchObject({
      full_waves: 5,
      strategy: 'latest_limit_escalation',
      resume_supported: false,
    });
    expect(firstGroup(reels).backfill_done).toBe(false);
    expect(reels.limitations).toContain('historical_cursor_unsupported');
    expect(
      buildInstagramBatches(accounts, { mode: 'backfill', result_type: 'posts' })[0]?.input.resultsLimit,
    ).toBe(1500);
    expect(
      buildInstagramBatches(accounts, { mode: 'backfill', result_type: 'reels' })[0]?.input.resultsLimit,
    ).toBe(3000);
  });

  it('does not complete reels history after repeated capped newest-page runs', () => {
    let cursor: Row | null = null;
    for (let wave = 0; wave < 5; wave++) {
      const result = prepareInstagramResults(
        [igRows[0]],
        igContext({
          mode: 'backfill',
          result_type: 'reels',
          resultsLimit: 1,
          accounts: [{ ...igClaim, backfill_cursor: { reels: cursor } }],
        }),
      );
      expect(firstGroup(result).backfill_done).toBe(false);
      cursor = firstGroup(result).backfill_cursor;
      expect(cursor).toMatchObject({ full_waves: wave + 1, resume_supported: false });
    }
  });

  it('stops a historical pass after the supported 3000-result expansion remains capped', () => {
    const source = igRows[0];
    if (!source) throw Error('Retained Instagram row is missing');
    const capped = Array.from({ length: 3000 }, (_, index) => ({ ...source, shortCode: `Bounded${index}` }));
    const result = prepareInstagramResults(
      capped,
      igContext({
        mode: 'backfill',
        result_type: 'reels',
        resultsLimit: 3000,
        accounts: [{ ...igClaim, backfill_cursor: { reels: { full_waves: 3 } } }],
      }),
    );
    const checkpoint = firstGroup(result).backfill_cursor;
    expect(checkpoint).toMatchObject({
      full_waves: 4,
      results_limit: 3000,
      history_state: 'limit_exhausted',
      resume_supported: false,
    });
    expect(result.limitations).toContain('historical_results_limit_exhausted');
    expect(firstGroup(result).backfill_done).toBe(false);
    expect(() =>
      buildInstagramBatches([{ ...igClaim, backfill_cursor: { reels: checkpoint } }], {
        mode: 'backfill',
        result_type: 'reels',
      }),
    ).toThrow('ig_backfill_history_unsupported');
    // An exhausted reels checkpoint never suppresses the still-independent posts pass.
    expect(
      buildInstagramBatches([{ ...igClaim, backfill_cursor: { reels: checkpoint } }], {
        mode: 'backfill',
        result_type: 'posts',
      }),
    ).toHaveLength(1);
  });

  it.each(['2026-02-30T00:00:00Z', '2026-10-27T24:00:00Z', 'invalid'])(
    'rejects an explicit invalid reference time (%s)',
    (now) => {
      expect(() => buildInstagramBatches([igClaim], { mode: 'daily', result_type: 'posts', now })).toThrow(
        'ig_reference_time_invalid',
      );
      expect(() => prepareInstagramResults(igRows, igContext({ now }))).toThrow('ig_reference_time_invalid');
    },
  );
});
const plan = () => [];
const ack = (state: NativeCollectorState, result: unknown) => ({
  statusCode: 200,
  body: {
    version: 1,
    requestId: state.request.requestId,
    operation: state.request.operation,
    replayed: false,
    result,
  },
});
const gateway = (state: NativeCollectorState, result: unknown) =>
  advanceCollectorGateway(state, ack(state, result), plan);
function native(claim: Row = account, input: Row = {}) {
  let state = initializeCollector(
    { mode: 'backfill', limit: 1, account_ids: [account.account_id], ...input },
    'vimeo',
    '99124',
    '2026-10-27T10:00:00Z',
  );
  state = gateway(state, { run_id: '11111111-1111-4111-a111-111111111111' });
  return gateway(state, [claim]);
}

describe('collector transitions using retained source projections with synthetic pagination envelopes', () => {
  it.each([
    { page: 4 },
    { page: 4, endpoint: 'groups', resourcePath: '/users/123', page_size: 100 },
    { page: 4, endpoint: 'users', resourcePath: '/users/999', page_size: 100 },
    { page: 4, endpoint: 'users', resourcePath: '/users/123' },
    { page: 4, endpoint: 'users', resourcePath: '/users/123', page_size: 5 },
  ])('native Vimeo refuses an unbound or foreign resume cursor before a list request (%j)', (cursor) => {
    expect(() => native({ ...account, backfill_cursor: cursor })).toThrow('M04_VIMEO_ACCOUNT_INVALID');
  });

  it('resumes only at the saved Vimeo page width and persists that width in the next checkpoint', () => {
    let state = native(
      {
        ...account,
        backfill_cursor: { page: 2, endpoint: 'users', resourcePath: '/users/123', page_size: 5 },
      },
      { page_size: 5, max_pages: 1 },
    );
    expect(state.providerUrl).toContain('per_page=5&page=2&');
    state = advanceVimeoNative(
      state,
      { statusCode: 200, body: page('/users/123/videos?page=3&per_page=5') },
      normalizeVimeoApiResult,
    );
    state = gateway(state, { inserted: 0, duplicates: rows.length });
    expect(state.request.args.backfill_cursor).toEqual({
      page: 3,
      endpoint: 'users',
      resourcePath: '/users/123',
      page_size: 5,
    });
  });

  it.each([undefined, 5])(
    'the fixed-width pure collector refuses a legacy or changed-width resume (%j)',
    async (page_size) => {
      const requests: unknown[] = [];
      const result = await collectVimeoAccount(
        {
          ...account,
          backfill_cursor: {
            page: 2,
            endpoint: 'users',
            resourcePath: '/users/123',
            ...(page_size === undefined ? {} : { page_size }),
          },
        },
        { mode: 'backfill', now: '2026-10-27T10:00:00Z' },
        {
          request: async () => {
            requests.push(true);
            return { status: 200, body: page(null) };
          },
          wait: async () => undefined,
        },
      );
      expect(result).toMatchObject({ status: 'failed', error: 'vimeo_invalid_cursor', apiRequestCount: 0 });
      expect(requests).toEqual([]);
    },
  );

  it('native Vimeo checks a resumed path against the freshly resolved numeric identity', () => {
    let state = native({
      ...account,
      external_id: null,
      backfill_cursor: { page: 4, endpoint: 'users', resourcePath: '/users/123', page_size: 100 },
    });
    expect(state.providerUrl).toBe('https://api.vimeo.com/users/everyonefilms?fields=uri');
    state = advanceVimeoNative(
      state,
      { statusCode: 200, body: { uri: '/users/123' } },
      normalizeVimeoApiResult,
    );
    expect(state.request.operation).toBe('resolve');
    state = gateway(state, { ok: true });
    expect(state.providerUrl).toContain('/users/123/videos?');
    expect(state.providerUrl).toContain('&page=4&');
  });

  it('native Vimeo rejects a mismatched resolved cursor before the next list request', () => {
    let state = native({
      ...account,
      external_id: null,
      backfill_cursor: { page: 4, endpoint: 'users', resourcePath: '/users/999', page_size: 100 },
    });
    state = advanceVimeoNative(
      state,
      { statusCode: 200, body: { uri: '/users/123' } },
      normalizeVimeoApiResult,
    );
    expect(state.request.operation).toBe('report');
    expect(state.request.args).toMatchObject({
      status: 'failed',
      backfill_done: false,
      error: 'vimeo_invalid_cursor',
    });
  });

  it('the pure Vimeo collector rejects changed pagination page size instead of skipping records', async () => {
    const result = await collectVimeoAccount(
      account,
      { mode: 'backfill', now: '2026-10-27T10:00:00Z' },
      {
        request: async () => ({ status: 200, body: page('/users/123/videos?page=2&per_page=5') }),
        wait: async () => undefined,
      },
    );
    expect(result).toMatchObject({
      status: 'failed',
      error: 'vimeo_invalid_pagination',
      backfillDone: false,
    });
  });

  it.each(['daily', 'backfill'])(
    'both Vimeo paths reject an empty nonterminal page without ingesting or advancing (%s)',
    async (mode) => {
      const body = { data: [], paging: { next: '/users/123/videos?page=2' } };
      const state = advanceVimeoNative(
        native(account, { mode }),
        { statusCode: 200, body },
        normalizeVimeoApiResult,
      );
      expect(state.action).toBe('gateway');
      expect(state.request.operation).toBe('report');
      expect(state.request.args).toMatchObject({
        status: 'failed',
        error: 'vimeo_pagination_invalid',
        backfill_done: false,
        backfill_cursor: null,
        items_seen: 0,
        items_new: 0,
      });
      const pure = await collectVimeoAccount(
        account,
        { mode, now: '2026-10-27T10:00:00Z' },
        {
          request: async () => ({ status: 200, body }),
          wait: async () => undefined,
        },
      );
      expect(pure).toMatchObject({
        status: 'failed',
        error: 'vimeo_invalid_pagination',
        normalizedItems: [],
        backfillDone: false,
        cursor: null,
      });
    },
  );

  it.each(['daily', 'backfill'])(
    'both Vimeo paths accept a legitimate empty terminal page (%s)',
    async (mode) => {
      const body = { data: [], paging: { next: null } };
      const state = advanceVimeoNative(
        native(account, { mode }),
        { statusCode: 200, body },
        normalizeVimeoApiResult,
      );
      expect(state.request.operation).toBe('report');
      expect(state.request.args).toMatchObject({
        status: 'success',
        error: null,
        backfill_done: mode === 'backfill',
        backfill_cursor: null,
        items_seen: 0,
        items_new: 0,
      });
      const pure = await collectVimeoAccount(
        account,
        { mode, now: '2026-10-27T10:00:00Z' },
        {
          request: async () => ({ status: 200, body }),
          wait: async () => undefined,
        },
      );
      expect(pure).toMatchObject({
        status: 'success',
        normalizedItems: [],
        backfillDone: mode === 'backfill',
        cursor: null,
        complete: true,
      });
    },
  );

  it.each([{ page: 2 }, { per_page: 5 }])(
    'both Vimeo paths reject mismatched optional response metadata (%j)',
    async (metadata) => {
      const body = page(null, metadata);
      const pure = await collectVimeoAccount(
        account,
        { mode: 'backfill', now: '2026-10-27T10:00:00Z' },
        {
          request: async () => ({ status: 200, body }),
          wait: async () => undefined,
        },
      );
      expect(pure).toMatchObject({ status: 'failed', error: 'vimeo_invalid_response', backfillDone: false });
      const state = advanceVimeoNative(native(), { statusCode: 200, body }, normalizeVimeoApiResult);
      expect(state.request.args).toMatchObject({
        status: 'failed',
        error: 'vimeo_contract_drift',
        backfill_done: false,
      });
    },
  );

  it('a daily native page cap preserves valid metrics rows but reports incomplete traversal explicitly', () => {
    let state = native(account, { mode: 'daily', max_pages: 1 });
    state = advanceVimeoNative(
      state,
      { statusCode: 200, body: page('/users/123/videos?page=2') },
      normalizeVimeoApiResult,
    );
    expect(state.request.operation).toBe('ingest');
    expect((state.request.args.items as Row[]).map((item) => item.external_id)).toEqual(
      rows.map((row) => String(row.uri).split('/').pop()),
    );
    state = gateway(state, { inserted: 0, duplicates: rows.length });
    expect(state.request.args).toMatchObject({
      status: 'failed',
      error: 'vimeo_daily_page_cap',
      backfill_done: false,
      items_new: 0,
    });
  });

  it('a capped pure daily batch is explicitly incomplete and never presented as a finished daily collection', async () => {
    const result = await collectVimeoAccount(
      account,
      { mode: 'daily', maxPages: 1, now: '2026-10-27T10:00:00Z' },
      {
        request: async () => ({ status: 200, body: page('/users/123/videos?page=2') }),
        wait: async () => undefined,
      },
    );
    expect(result).toMatchObject({
      status: 'failed',
      error: 'vimeo_daily_page_cap',
      complete: false,
      backfillDone: false,
    });
    expect(result.normalizedItems.map((item) => item.external_id)).toEqual(
      rows.map((row) => String(row.uri).split('/').pop()),
    );
  });
});
