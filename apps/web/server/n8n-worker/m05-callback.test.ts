// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createM05Callback } from './m05-callback';
import type { CollectorConfig } from './collectors';
import type { CollectorRequest } from '@emr/shared';

const id = '28000000-0000-4000-a000-000000000001',
  run = '28000000-0000-4000-a000-000000000002';
const actorId = 'localActor',
  providerRun = 'localProviderRun';
function fixture(
  actor:
    | 'apify/website-content-crawler'
    | 'harvestapi/linkedin-company-employees' = 'harvestapi/linkedin-company-employees',
) {
  const isWeb = actor === 'apify/website-content-crawler',
    url = isWeb ? 'https://m05.example.com/work/film' : 'https://www.linkedin.com/company/m05local/';
  const actor_input = isWeb
    ? {
        startUrls: [{ url }],
        crawlerType: 'cheerio',
        ignoreHttpsErrors: false,
        maxSessionRotations: 0,
        maxCrawlPages: 1,
        maxResults: 1,
      }
    : {
        companies: [url],
        profileScraperMode: 'Short ($4 per 1k)',
        companyBatchMode: 'one_by_one',
        maxItems: 1,
        maxItemsPerCompany: 1,
        startPage: 1,
        takePages: 1,
      };
  const job = {
    launch_id: id,
    run_id: run,
    apify_run_id: providerRun,
    actor_id: actor,
    account_ids: [id],
    accounts: [
      {
        account_id: id,
        competitor_id: run,
        platform: isWeb ? 'website_work_page' : 'linkedin_employees',
        url: isWeb ? 'https://m05.example.com/work' : url,
        handle: 'm05local',
        backfill_cursor: null,
      },
    ],
    actor_input,
    results_limit: 1,
    settled: false,
    retry_of: null,
    crawler_type: 'cheerio',
    urls: [url],
    purpose: isWeb ? 'backfill' : 'weekly',
    snapshot_date: '2026-10-28',
    approval_id: id,
    max_actor_usd: 1,
    created_at: '2026-10-28T00:00:00Z',
  };
  const config: CollectorConfig = {
    scope: 'm05',
    audience: 'https://everyone-market-researcher-local.vercel.app',
    password: 'synthetic',
    verifier: 'a'.repeat(64),
    commitSha: 'a'.repeat(40),
    deploymentId: 'dpl_local',
    apifyReadToken: 'synthetic',
    accountIds: [id],
    policy: {
      approval_id: id,
      max_actor_starts: 2,
      max_actor_usd: 1,
      max_total_usd: 2,
      max_results_per_profile: 10,
      actors: {
        [actor]: {
          owner_id: 'localOwner',
          actorId,
          build: '1.0.0',
          buildId: 'localBuild',
          ...(isWeb ? { billingModel: 'PPU' as const } : {}),
        },
      },
    },
  };
  const input: CollectorRequest = {
    version: 1,
    requestId: id,
    operation: 'callback.process',
    args: { apify_run_id: providerRun },
  };
  let clock = 0;
  const dispatch = vi.fn(async (_rid: string, op: string, args: Record<string, unknown>) => {
    if (op === 'm05.lookup') return { replayed: false, result: job };
    if (op === 'm05.settle')
      return {
        replayed: false,
        result: {
          updated: true,
          groups: args.groups,
          retry_urls: (args.groups as { retry_urls?: unknown[] }[])[0]?.retry_urls ?? [],
        },
      };
    throw Error('unexpected');
  });
  const get = vi.fn(async (path: string): Promise<unknown> => {
    if (path.startsWith('/v2/actor-runs/'))
      return {
        data: {
          id: providerRun,
          actId: actorId,
          userId: 'localOwner',
          buildId: 'localBuild',
          buildNumber: '1.0.0',
          status: 'SUCCEEDED',
          usageTotalUsd: 0.012,
          defaultKeyValueStoreId: 'localKvs',
          defaultDatasetId: 'localDataset',
          startedAt: '2026-10-28T00:01:00Z',
          finishedAt: '2026-10-28T00:02:00Z',
          options: {
            memoryMbytes: 1024,
            timeoutSecs: 600,
            maxItems: 1,
            maxTotalChargeUsd: 1,
            isMaxTotalChargeUsdSetByUser: true,
          },
        },
      };
    if (path.includes('/records/INPUT')) return actor_input;
    return isWeb
      ? [{ url, markdown: 'thin text', metadata: { title: 'Local film' }, crawl: { httpStatusCode: 200 } }]
      : [
          {
            publicIdentifier: 'person-1',
            firstName: 'Person',
            lastName: '1',
            headline: 'Director',
            location: { linkedinText: 'Cairo' },
            email: 'discarded@example.com',
            photo: 'https://example.com/private-photo',
            about: 'Never stored',
            skills: ['Never stored'],
          },
        ];
  });
  const process = createM05Callback({
    dispatch,
    get,
    now: () => clock,
    wait: async (ms) => {
      clock += ms;
    },
    wallTime: () => '2026-10-28T00:03:00Z',
  });
  return { job, config, input, dispatch, get, process, actor_input };
}
describe('M05 registered async callback, local provider contracts', () => {
  it.each([256, 512])(
    'accepts an authenticated lower PPE memory envelope of %s MiB with the exact recorded charge option',
    async (memoryMbytes) => {
      const t = fixture(),
        original = t.get.getMockImplementation()!;
      t.get.mockImplementation(async (path) => {
        const value = await original(path);
        if (path.startsWith('/v2/actor-runs/')) {
          const d = (value as { data: { options: object } }).data;
          return { data: { ...d, options: { ...d.options, memoryMbytes } } };
        }
        return value;
      });
      expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
        state: 'completed',
        requires_review: false,
      });
      expect(t.dispatch.mock.calls.find((c) => c[1] === 'm05.settle')![2]).toMatchObject({
        usage_usd: 0.012,
        groups: [
          {
            status: 'success',
            people: [{ public_id: 'person-1', name: 'Person 1', title: 'Director', location: 'Cairo' }],
          },
        ],
      });
      expect(t.job.max_actor_usd).toBe(1);
    },
  );
  it.each([0, 64, 384, 2048, '512', null, NaN, Infinity])(
    'still costs and rejects invalid or larger PPE memory %s before content reads',
    async (memoryMbytes) => {
      const t = fixture(),
        original = t.get.getMockImplementation()!;
      t.get.mockImplementation(async (path) => {
        const value = await original(path);
        if (path.startsWith('/v2/actor-runs/')) {
          const d = (value as { data: { options: object } }).data;
          return { data: { ...d, options: { ...d.options, memoryMbytes } } };
        }
        return value;
      });
      expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
        state: 'completed',
        requires_review: true,
      });
      expect(t.get.mock.calls.some((c) => c[0].startsWith('/v2/datasets/'))).toBe(false);
      expect(t.dispatch.mock.calls.find((c) => c[1] === 'm05.settle')![2]).toMatchObject({
        usage_usd: 0.012,
        groups: [{ status: 'failed', error: 'm05_actor_cap_unacknowledged' }],
      });
    },
  );
  it('preserves the independent website memory rule', async () => {
    const t = fixture('apify/website-content-crawler'),
      original = t.get.getMockImplementation()!;
    t.get.mockImplementation(async (path) => {
      const value = await original(path);
      if (path.startsWith('/v2/actor-runs/')) {
        const d = (value as { data: { options: object } }).data;
        return { data: { ...d, options: { ...d.options, memoryMbytes: 512 } } };
      }
      return value;
    });
    expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      requires_review: true,
    });
    expect(t.get.mock.calls.some((c) => c[0].startsWith('/v2/datasets/'))).toBe(false);
  });
  it('projects employees to four public fields and measured cost; no raw profile is ingested', async () => {
    const t = fixture();
    const out = await t.process(t.input, t.config, new AbortController().signal);
    expect(out.state).toBe('completed');
    const args = t.dispatch.mock.calls.find((c) => c[1] === 'm05.settle')![2];
    expect(args.usage_usd).toBe(0.012);
    const serialized = JSON.stringify(args);
    for (const field of ['email', 'photo', 'about', 'skills', 'Never stored'])
      expect(serialized).not.toContain(field);
    expect((args.groups as { people: unknown[] }[])[0]!.people).toEqual([
      { public_id: 'person-1', name: 'Person 1', title: 'Director', location: 'Cairo' },
    ]);
    expect((args.groups as { coverage: unknown }[])[0]!.coverage).toMatchObject({
      complete: false,
      membership_evidence: 'registered_company_query',
    });
  });
  it('returns one exact owned thin retry; the server starts no paid actor', async () => {
    const t = fixture('apify/website-content-crawler');
    const out = await t.process(t.input, t.config, new AbortController().signal);
    expect(out.state).toBe('retry_required');
    expect('retry' in out && out.retry).toMatchObject({
      retry_of: id,
      account_ids: [id],
      urls: t.job.urls,
      crawler_type: 'playwright:adaptive',
    });
    expect(t.dispatch.mock.calls.map((c) => c[1])).toEqual(['m05.lookup', 'm05.settle']);
    expect(t.get.mock.calls.every((c) => c[0].startsWith('/v2/'))).toBe(true);
  });
  it('rejects an unknown run before provider reads or ingestion', async () => {
    const t = fixture();
    t.dispatch.mockRejectedValueOnce(Error('unknown'));
    await expect(t.process(t.input, t.config, new AbortController().signal)).rejects.toThrow();
    expect(t.get).not.toHaveBeenCalled();
  });
  it('rejects changed INPUT and foreign provider identity without settlement', async () => {
    for (const mismatch of ['input', 'owner']) {
      const t = fixture(),
        original = t.get.getMockImplementation()!;
      t.get.mockImplementation(async (path) => {
        const data = await original(path);
        if (mismatch === 'input' && path.includes('/records/INPUT'))
          return { ...t.actor_input, companies: ['https://www.linkedin.com/company/foreign/'] };
        if (mismatch === 'owner' && path.startsWith('/v2/actor-runs/'))
          return { data: { ...(data as { data: object }).data, userId: 'foreign' } };
        return data;
      });
      await expect(t.process(t.input, t.config, new AbortController().signal)).rejects.toMatchObject({
        code: 'm05_provider_reconciliation_required',
      });
      expect(t.dispatch.mock.calls.some((c) => c[1] === 'm05.settle')).toBe(false);
    }
  });
  it('replays a saved terminal receipt with no provider work', async () => {
    const t = fixture();
    Object.assign(t.job, { settled: true, result: { updated: true, retry_urls: [], groups: [] } });
    expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      updated: false,
    });
    expect(t.get).not.toHaveBeenCalled();
  });
  it('records a failed actor as terminal measured usage, without content ingestion', async () => {
    const t = fixture(),
      original = t.get.getMockImplementation()!;
    t.get.mockImplementation(async (path) => {
      const v = await original(path);
      return path.startsWith('/v2/actor-runs/')
        ? { data: { ...(v as { data: object }).data, status: 'FAILED' } }
        : v;
    });
    await t.process(t.input, t.config, new AbortController().signal);
    expect(t.dispatch.mock.calls.find((c) => c[1] === 'm05.settle')![2]).toMatchObject({
      status: 'FAILED',
      usage_usd: 0.012,
      groups: [{ status: 'failed', items: [] }],
    });
  });
  it('costs verified over-output as a failed observation without ingesting it', async () => {
    const t = fixture(),
      original = t.get.getMockImplementation()!;
    t.get.mockImplementation(async (path) => (path.startsWith('/v2/datasets/') ? [{}, {}] : original(path)));
    expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      requires_review: true,
    });
    expect(t.dispatch.mock.calls.find((c) => c[1] === 'm05.settle')![2]).toMatchObject({
      usage_usd: 0.012,
      groups: [{ status: 'failed', items: [], error: 'm05_dataset_limit_exceeded' }],
    });
  });
  it('replaying a primary after its retry intent was reserved cannot launch again', async () => {
    const t = fixture('apify/website-content-crawler');
    Object.assign(t.job, {
      settled: true,
      retry_pending: false,
      result: { retry_urls: t.job.urls, groups: [] },
    });
    const out = await t.process(t.input, t.config, new AbortController().signal);
    expect(out).toMatchObject({ state: 'completed', updated: false, retry_intent_reserved: true });
    expect('retry' in out).toBe(false);
    expect(t.get).not.toHaveBeenCalled();
  });
  it('costs a known terminal actor with an unacknowledged charge cap without reading content', async () => {
    const t = fixture('apify/website-content-crawler'),
      original = t.get.getMockImplementation()!;
    t.get.mockImplementation(async (path) => {
      const v = await original(path);
      if (path.startsWith('/v2/actor-runs/')) {
        const d = (v as { data: Record<string, unknown> }).data;
        return {
          data: {
            ...d,
            options: {
              ...(d.options as object),
              maxTotalChargeUsd: undefined,
              isMaxTotalChargeUsdSetByUser: false,
            },
          },
        };
      }
      return v;
    });
    expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      requires_review: true,
    });
    expect(t.get.mock.calls.some((c) => c[0].startsWith('/v2/datasets/'))).toBe(false);
    expect(t.dispatch.mock.calls.find((c) => c[1] === 'm05.settle')![2]).toMatchObject({
      usage_usd: 0.012,
      groups: [{ items: [], status: 'failed', error: 'm05_actor_cap_unacknowledged' }],
    });
  });
  it('reconciles usage beyond the admitted execution option while preserving measured cost and suppressing ingestion', async () => {
    const t = fixture(),
      original = t.get.getMockImplementation()!;
    t.get.mockImplementation(async (path) => {
      const v = await original(path);
      return path.startsWith('/v2/actor-runs/')
        ? { data: { ...(v as { data: object }).data, usageTotalUsd: 1.000001 } }
        : v;
    });
    expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      requires_review: true,
    });
    expect(t.get.mock.calls.some((c) => c[0].startsWith('/v2/datasets/'))).toBe(false);
    expect(t.dispatch.mock.calls.find((c) => c[1] === 'm05.settle')![2]).toMatchObject({
      usage_usd: 1.000001,
      groups: [{ status: 'failed', items: [], error: 'm05_actor_charge_option_exceeded' }],
    });
  });
  it('replays a persisted charge-option violation as requiring review without another provider read or cost', async () => {
    const t = fixture();
    Object.assign(t.job, {
      settled: true,
      result: {
        retry_urls: [],
        groups: [{ account_id: id, status: 'failed', error: 'm05_actor_charge_option_exceeded' }],
      },
    });
    expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      updated: false,
      requires_review: true,
    });
    expect(t.get).not.toHaveBeenCalled();
    expect(t.dispatch.mock.calls.map((c) => c[1])).toEqual(['m05.lookup']);
  });
  it('uses the recorded admitted option for terminal reconciliation when a subsequent configured amount differs', async () => {
    const t = fixture();
    t.config.policy!.max_actor_usd = 25;
    t.config.policy!.max_total_usd = 100;
    expect(await t.process(t.input, t.config, new AbortController().signal)).toMatchObject({
      state: 'completed',
      requires_review: false,
    });
    expect(t.dispatch.mock.calls.find((c) => c[1] === 'm05.settle')![2]).toMatchObject({ usage_usd: 0.012 });
    expect(t.job.max_actor_usd).toBe(1);
  });
});
