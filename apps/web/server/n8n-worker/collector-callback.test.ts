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
function setup() {
  let clock = 0;
  const r = {
    apify_run_id: 'syntheticRun',
    actor_id: 'apify/instagram-scraper',
    account_ids: [id],
    accounts: [{ account_id: id, handle: 'synthetic', backfill_from: '2024-01-01', backfill_cursor: null }],
    purpose: 'backfill',
    pass: 'posts',
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
    ],
  };
  const calls: { operation: string; args: Record<string, unknown> }[] = [];
  const dispatch: CollectorDispatch = async (_request, operation, args) => {
    calls.push({ operation, args });
    if (operation === 'lookup') return { replayed: false, result: structuredClone(r) };
    if (operation === 'stage') {
      const g = (
        args.groups as Array<{ items: unknown[]; status: string; error: null; source_evidence: boolean }>
      )[0]!;
      r.next_offset += Number(args.raw_count);
      r.dataset_complete = !args.has_more;
      r.pass_results[0]!.items_seen += g.items.length;
      r.pass_results[0]!.stage_status = g.status;
      r.pass_results[0]!.source_evidence ||= g.source_evidence;
      r.pass_results[0]!.error = g.error;
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
});
