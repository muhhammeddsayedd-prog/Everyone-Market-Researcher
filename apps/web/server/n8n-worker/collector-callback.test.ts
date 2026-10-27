// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createCollectorCallback } from './collector-callback';
import type { CollectorConfig, CollectorDispatch } from './collectors';
const id = '27000000-0000-4000-8000-000000000001';
const approval = '27000000-0000-4000-8000-000000000009';
const config = {
  accountIds: [id],
  apifyReadToken: 'synthetic',
  policy: {
    approval_id: approval,
    max_actor_starts: 4,
    max_actor_usd: 1,
    max_total_usd: 4,
    max_results_per_profile: 5,
    actors: {
      'apify/instagram-scraper': {
        owner_id: 'syntheticOwner',
        actorId: 'syntheticActor',
        build: '1.2.3',
        buildId: 'syntheticBuild',
      },
    },
  },
} as CollectorConfig;
const input = {
  version: 1 as const,
  requestId: id,
  operation: 'callback.process' as const,
  args: { apify_run_id: 'syntheticRun' },
};
const row = {
  shortCode: 'M04Synthetic',
  type: 'Image',
  ownerUsername: 'synthetic',
  timestamp: '2026-10-25T00:00:00Z',
  caption: 'Synthetic local fixture',
};
const metadata = {
  data: {
    id: 'syntheticRun',
    actId: 'syntheticActor',
    userId: 'syntheticOwner',
    buildId: 'syntheticBuild',
    buildNumber: '1.2.3',
    status: 'SUCCEEDED',
    defaultDatasetId: 'syntheticDataset',
    defaultKeyValueStoreId: 'syntheticInput',
    usageTotalUsd: 0.0019,
    startedAt: '2026-10-27T00:00:01Z',
    finishedAt: '2026-10-27T00:01:00Z',
    options: { memoryMbytes: 1024, timeoutSecs: 600, maxTotalChargeUsd: 1, maxItems: 5 },
  },
};
const actorInput = {
  directUrls: ['https://www.instagram.com/synthetic/'],
  resultsType: 'posts',
  resultsLimit: 5,
  onlyPostsNewerThan: '2024-01-01',
  skipPinnedPosts: true,
  addParentData: false,
};
type TestAccount = {
  account_id: string;
  handle: string;
  url?: string;
  backfill_from?: string;
  watermark_published_at?: string;
  backfill_cursor: Record<string, unknown> | null;
};
type TestPass = {
  account_id: string;
  items_seen: number;
  items_new: number;
  stage_status: string;
  source_evidence: boolean;
  error: string | null;
  backfill_cursor: Record<string, unknown> | null;
};
function setup() {
  let clock = 0;
  const r = {
    apify_run_id: 'syntheticRun',
    actor_id: 'apify/instagram-scraper',
    account_ids: [id],
    accounts: [
      { account_id: id, handle: 'synthetic', backfill_from: '2024-01-01', backfill_cursor: null },
    ] as TestAccount[],
    purpose: 'backfill' as 'daily' | 'backfill',
    pass: 'posts' as 'posts' | 'reels' | 'primary',
    results_limit: 5,
    next_offset: 0,
    dataset_complete: false,
    processed_at: null as string | null,
    processing_result: null as unknown,
    approval_id: approval,
    max_actor_usd: 1,
    launch_created_at: '2026-10-27T00:00:00Z',
    pass_results: [
      {
        account_id: id,
        items_seen: 0,
        items_new: 0,
        stage_status: 'success',
        source_evidence: false,
        error: null,
        backfill_cursor: null,
      },
    ] as TestPass[],
  };
  const calls: { operation: string; args: Record<string, unknown> }[] = [];
  const dispatch: CollectorDispatch = async (_request, operation, args) => {
    calls.push({ operation, args });
    if (operation === 'lookup') return { replayed: false, result: structuredClone(r) };
    if (operation === 'stage') {
      r.next_offset += Number(args.raw_count);
      r.dataset_complete = !args.has_more;
      for (const g of args.groups as Array<{
        account_id: string;
        items: unknown[];
        status: string;
        error: string | null;
        source_evidence: boolean;
        backfill_cursor: Record<string, unknown> | null;
      }>) {
        const pass = r.pass_results.find((p) => p.account_id === g.account_id);
        if (!pass) throw Error('unexpected test account');
        pass.items_seen += g.items.length;
        if (g.status === 'failed') pass.stage_status = 'failed';
        pass.source_evidence ||= g.source_evidence;
        pass.error ??= g.error;
        // Match the SQL page-stage boundary: only the earliest source date
        // persists here; final settlement must reconstruct coverage fields.
        const oldest = g.backfill_cursor?.oldest_seen;
        if (typeof oldest === 'string') {
          const prior = pass.backfill_cursor?.oldest_seen;
          pass.backfill_cursor = {
            oldest_seen: typeof prior === 'string' && prior < oldest ? prior : oldest,
          };
        }
      }
      return {
        replayed: false,
        result: { next_offset: r.next_offset, dataset_complete: r.dataset_complete },
      };
    }
    if (operation === 'settle')
      return { replayed: false, result: { updated: true, cost_usd: args.usage_usd, finished_now: true } };
    throw Error('unexpected');
  };
  const get = vi.fn(async (path: string): Promise<unknown> =>
    path.includes('actor-runs') ? metadata : path.includes('records/INPUT') ? actorInput : [row],
  );
  const handler = createCollectorCallback({
    dispatch,
    get,
    now: () => clock,
    wait: async (ms) => {
      clock += ms;
    },
  });
  return { r, calls, get, dispatch, handler };
}
describe('M04 private callback source verification and bounded settlement', () => {
  it('verifies two settled snapshots and original INPUT, then stages and settles one page', async () => {
    const t = setup();
    expect(await t.handler(input, config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      updated: true,
      cost_usd: 0.0019,
    });
    expect(t.get).toHaveBeenCalledTimes(4);
    expect(t.calls.map((c) => c.operation)).toEqual(['lookup', 'stage', 'lookup', 'settle']);
    expect(t.calls.find((c) => c.operation === 'settle')?.args).toMatchObject({
      usage_usd: 0.0019,
      groups: [{ items: [], status: 'success', backfill_done: false }],
    });
  });
  it('rejects an unknown run before any provider request', async () => {
    const t = setup();
    const handler = createCollectorCallback({
      dispatch: async () => {
        throw Error('unregistered');
      },
      get: t.get,
    });
    await expect(handler(input, config, new AbortController().signal)).rejects.toThrow();
    expect(t.get).not.toHaveBeenCalled();
  });
  it('returns an existing terminal receipt without provider calls or further ingestion', async () => {
    const t = setup();
    t.r.processed_at = '2026-10-27T01:00:00Z';
    t.r.processing_result = { updated: true, items_new: 1 };
    expect(await t.handler(input, config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      updated: false,
      items_new: 1,
    });
    expect(t.get).not.toHaveBeenCalled();
    expect(t.calls).toHaveLength(1);
  });
  it.each(['userId', 'actId', 'buildId'])('rejects mismatched trusted %s before staging', async (key) => {
    const t = setup();
    t.get.mockImplementation(async () => ({ data: { ...metadata.data, [key]: 'foreign' } }));
    await expect(t.handler(input, config, new AbortController().signal)).rejects.toThrow();
    expect(t.calls).toHaveLength(1);
  });
  it('rejects a different provider billing/result cap before staging', async () => {
    const t = setup();
    t.get.mockImplementation(async () => ({
      data: { ...metadata.data, options: { ...metadata.data.options, maxItems: 500 } },
    }));
    await expect(t.handler(input, config, new AbortController().signal)).rejects.toThrow();
    expect(t.calls).toHaveLength(1);
  });
  it.each([
    'cookies',
    'login',
    'auth',
    'apiKey',
    'clientSecret',
    'accessToken',
    'downloadVideo',
    'transcribe',
  ])('rejects nested %s even in reviewed defaults', async (key) => {
    const t = setup(),
      extra = { advanced: { [key]: 'synthetic-forbidden' } };
    const altered = structuredClone(config);
    altered.policy!.actors['apify/instagram-scraper']!.inputDefaults = extra;
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs') ? metadata : { ...actorInput, ...extra },
    );
    await expect(t.handler(input, altered, new AbortController().signal)).rejects.toThrow();
    expect(t.calls).toHaveLength(1);
  });
  it('accepts matched old content as successful zero-item evidence without ingesting it', async () => {
    const t = setup();
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs')
        ? metadata
        : path.includes('records/INPUT')
          ? actorInput
          : [{ ...row, timestamp: '2023-01-01T00:00:00Z' }],
    );
    await t.handler(input, config, new AbortController().signal);
    expect(t.calls.find((c) => c.operation === 'stage')?.args).toMatchObject({
      groups: [{ items: [], source_evidence: true, status: 'success' }],
    });
    expect(t.calls.find((c) => c.operation === 'settle')?.args).toMatchObject({
      groups: [{ status: 'success' }],
    });
  });
  it('attests native goat255 concurrency and recognizes a matched old public video without ingesting it', async () => {
    const t = setup(),
      altered = structuredClone(config);
    altered.policy!.actors = {
      'goat255/vimeo-scraper': {
        owner_id: 'syntheticOwner',
        actorId: 'syntheticActor',
        build: '1.2.3',
        buildId: 'syntheticBuild',
      },
    };
    Object.assign(t.r, {
      actor_id: 'goat255/vimeo-scraper',
      pass: 'primary',
      accounts: [
        { account_id: id, url: 'https://vimeo.com/synthetic', handle: 'synthetic', backfill_cursor: null },
      ],
    });
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs')
        ? metadata
        : path.includes('records/INPUT')
          ? {
              videoUrls: [],
              users: ['https://vimeo.com/synthetic'],
              maxVideosPerUser: 5,
              includeProfile: false,
              concurrency: 1,
            }
          : [
              {
                type: 'video',
                id: '123',
                url: 'https://vimeo.com/123',
                ownerUrl: 'https://vimeo.com/synthetic',
                uploadDate: '2023-01-01 00:00:00',
                privacy: 'anybody',
              },
            ],
    );
    await expect(t.handler(input, altered, new AbortController().signal)).resolves.toMatchObject({
      state: 'completed',
    });
    expect(t.calls.find((c) => c.operation === 'stage')?.args).toMatchObject({
      groups: [{ items: [], source_evidence: true, status: 'success' }],
    });
    expect(t.calls.find((c) => c.operation === 'settle')?.args).toMatchObject({
      groups: [{ status: 'success' }],
    });
  });
  it('rejects an unrelated original actor input even when actor/build match', async () => {
    const t = setup();
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs')
        ? metadata
        : { ...actorInput, directUrls: ['https://www.instagram.com/another/'] },
    );
    await expect(t.handler(input, config, new AbortController().signal)).rejects.toThrow();
    expect(t.calls).toHaveLength(1);
  });
  it('contains provider output above the independent approved result bound, with actual cost retained', async () => {
    const t = setup();
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs')
        ? metadata
        : path.includes('records/INPUT')
          ? actorInput
          : Array.from({ length: 6 }, (_, n) => ({ ...row, shortCode: 'Synthetic' + n })),
    );
    expect(await t.handler(input, config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      cost_usd: 0.0019,
    });
    expect(t.calls.find((c) => c.operation === 'stage')?.args).toMatchObject({
      raw_count: 0,
      has_more: false,
      groups: [{ items: [], status: 'failed', error: 'collector_dataset_limit_exceeded' }],
    });
  });
  it('rejects a daily INPUT using only watermark-minus-one instead of the stable thirty-day listing', async () => {
    const t = setup();
    t.r.purpose = 'daily';
    t.r.accounts[0]!.watermark_published_at = '2026-10-20T12:00:00Z';
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs') ? metadata : { ...actorInput, onlyPostsNewerThan: '2026-10-19' },
    );
    await expect(t.handler(input, config, new AbortController().signal)).rejects.toThrow(
      'provider_reconciliation_required',
    );
    expect(t.calls.map((c) => c.operation)).toEqual(['lookup']);
  });
  it.each(['2026-10-28T00:02:00Z', '2026-11-15T12:00:00Z'])(
    'normalizes daily metrics against the trusted launch horizon when delivered at %s',
    async (deliveredAt) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(deliveredAt));
      try {
        const t = setup();
        t.r.purpose = 'daily';
        t.r.launch_created_at = '2026-10-27T23:59:50Z';
        t.r.accounts[0]!.watermark_published_at = '2026-10-27T23:00:00Z';
        const terminal = {
          data: {
            ...metadata.data,
            startedAt: '2026-10-27T23:59:51Z',
            finishedAt: '2026-10-28T00:01:00Z',
          },
        };
        t.get.mockImplementation(async (path) =>
          path.includes('actor-runs')
            ? terminal
            : path.includes('records/INPUT')
              ? { ...actorInput, onlyPostsNewerThan: '2026-09-27' }
              : [
                  { ...row, shortCode: 'InsideLaunchHorizon', timestamp: '2026-09-27T23:59:55Z' },
                  { ...row, shortCode: 'BeforeLaunchHorizon', timestamp: '2026-09-27T23:59:49Z' },
                ],
        );
        await expect(t.handler(input, config, new AbortController().signal)).resolves.toMatchObject({
          state: 'completed',
          cost_usd: 0.0019,
        });
        expect(t.calls.find((c) => c.operation === 'stage')?.args).toMatchObject({
          raw_count: 2,
          groups: [
            {
              items: [{ external_id: 'InsideLaunchHorizon' }],
              source_evidence: true,
              status: 'success',
            },
          ],
        });
        const staged = t.calls.find((c) => c.operation === 'stage')?.args.groups as Array<{
          items: unknown[];
        }>;
        expect(staged[0]!.items).toHaveLength(1);
        expect(t.calls.find((c) => c.operation === 'settle')?.args).toMatchObject({
          usage_usd: 0.0019,
          groups: [{ status: 'success', error: null }],
        });
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it('keeps the 3000-row history cap exhausted after seven pages even when all source rows normalize away', async () => {
    const t = setup(),
      altered = structuredClone(config);
    altered.policy!.max_results_per_profile = 3000;
    t.r.results_limit = 3000;
    t.r.pass = 'reels';
    t.r.accounts[0]!.backfill_cursor = {
      posts: { full_waves: 99 },
      reels: { full_waves: 3 },
    };
    t.get.mockImplementation(async (path) => {
      if (path.includes('actor-runs'))
        return { data: { ...metadata.data, options: { ...metadata.data.options, maxItems: 3000 } } };
      if (path.includes('records/INPUT')) {
        return {
          directUrls: actorInput.directUrls,
          resultsType: 'reels',
          resultsLimit: 3000,
          onlyPostsNewerThan: actorInput.onlyPostsNewerThan,
          addParentData: false,
        };
      }
      const offset = Number(new URL('https://api.apify.com' + path).searchParams.get('offset'));
      return offset < 3000
        ? Array.from({ length: 500 }, (_, n) => ({
            ...row,
            shortCode: 'FilteredSource' + (offset + n),
            timestamp: '2023-12-31T23:59:00Z',
          }))
        : [];
    });
    for (let page = 0; page < 7; page++) {
      const result = await t.handler(
        { ...input, requestId: `27000000-0000-4000-8000-${String(page + 10).padStart(12, '0')}` },
        altered,
        new AbortController().signal,
      );
      expect(result).toMatchObject({ state: page < 6 ? 'pending' : 'completed' });
    }
    expect(t.r.next_offset).toBe(3000);
    expect(t.r.pass_results[0]).toMatchObject({
      items_seen: 0,
      source_evidence: true,
      stage_status: 'success',
    });
    expect(t.r.pass_results[0]!.backfill_cursor).toEqual({ oldest_seen: '2023-12-31T23:59:00.000Z' });
    expect(t.calls.filter((c) => c.operation === 'settle')).toHaveLength(1);
    expect(t.calls.find((c) => c.operation === 'settle')?.args).toMatchObject({
      usage_usd: 0.0019,
      groups: [
        {
          status: 'success',
          backfill_done: false,
          backfill_cursor: {
            oldest_seen: '2023-12-31T23:59:00.000Z',
            full_waves: 4,
            results_limit: 3000,
            history_state: 'limit_exhausted',
            strategy: 'latest_limit_escalation',
            resume_supported: false,
          },
        },
      ],
    });
  });
  it('never declares either posts profile complete from filtered counts when the batch raw total reaches one profile limit', async () => {
    const t = setup(),
      altered = structuredClone(config),
      secondId = '27000000-0000-4000-8000-000000000002';
    altered.accountIds.push(secondId);
    altered.policy!.max_results_per_profile = 1500;
    t.r.results_limit = 1500;
    t.r.account_ids.push(secondId);
    t.r.accounts.push({ account_id: secondId, handle: 'secondsynthetic', backfill_cursor: null });
    t.r.pass_results.push({ ...t.r.pass_results[0]!, account_id: secondId });
    t.r.dataset_complete = true;
    t.r.next_offset = 1500;
    for (const pass of t.r.pass_results) {
      pass.items_seen = 1;
      pass.source_evidence = true;
    }
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs')
        ? { data: { ...metadata.data, options: { ...metadata.data.options, maxItems: 3000 } } }
        : {
            ...actorInput,
            directUrls: [
              'https://www.instagram.com/synthetic/',
              'https://www.instagram.com/secondsynthetic/',
            ],
            resultsLimit: 1500,
          },
    );
    await t.handler(input, altered, new AbortController().signal);
    expect(t.get).toHaveBeenCalledTimes(3);
    const groups = t.calls.find((c) => c.operation === 'settle')?.args.groups;
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account_id: id, backfill_done: false }),
        expect.objectContaining({ account_id: secondId, backfill_done: false }),
      ]),
    );
    expect(t.calls.find((c) => c.operation === 'settle')?.args).toMatchObject({ usage_usd: 0.0019 });
  });
  it('keeps source history unverified when a larger requested limit only yields a short completed dataset', async () => {
    const t = setup(),
      altered = structuredClone(config);
    altered.policy!.max_results_per_profile = 1500;
    t.r.results_limit = 1500;
    t.r.dataset_complete = true;
    t.r.next_offset = 1;
    t.r.pass_results[0]!.items_seen = 1;
    t.r.pass_results[0]!.source_evidence = true;
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs')
        ? { data: { ...metadata.data, options: { ...metadata.data.options, maxItems: 1500 } } }
        : { ...actorInput, resultsLimit: 1500 },
    );
    await t.handler(input, altered, new AbortController().signal);
    expect(t.get).toHaveBeenCalledTimes(3);
    expect(t.calls.find((c) => c.operation === 'settle')?.args).toMatchObject({
      usage_usd: 0.0019,
      groups: [
        {
          status: 'success',
          backfill_done: false,
          backfill_cursor: { results_limit: 1500, history_state: 'incomplete', resume_supported: false },
        },
      ],
    });
  });
  it('settles saturated daily output as incomplete coverage while retaining actual cost and matched source evidence', async () => {
    const t = setup();
    t.r.purpose = 'daily';
    t.r.accounts[0]!.watermark_published_at = '2026-10-25T00:00:00Z';
    t.get.mockImplementation(async (path) =>
      path.includes('actor-runs')
        ? metadata
        : path.includes('records/INPUT')
          ? { ...actorInput, onlyPostsNewerThan: '2026-09-25' }
          : Array.from({ length: 5 }, (_, n) => ({
              ...row,
              shortCode: 'DailyFiltered' + n,
              timestamp: '2026-09-01T00:00:00Z',
            })),
    );
    await expect(t.handler(input, config, new AbortController().signal)).resolves.toMatchObject({
      state: 'completed',
      cost_usd: 0.0019,
    });
    expect(t.calls.find((c) => c.operation === 'stage')?.args).toMatchObject({
      raw_count: 5,
      groups: [{ items: [], status: 'success', source_evidence: true }],
    });
    expect(t.calls.find((c) => c.operation === 'settle')?.args).toMatchObject({
      usage_usd: 0.0019,
      groups: [
        {
          status: 'failed',
          error: 'collector_daily_coverage_capped',
          backfill_done: false,
          backfill_cursor: null,
        },
      ],
    });
  });
});
