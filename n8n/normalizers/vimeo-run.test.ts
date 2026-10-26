import { describe, expect, it } from 'vitest';
import { runVimeoCollector, type VimeoGateway } from '../collectors/vimeo-run.mjs';

const runId = '12d333ac-3fb8-4f9b-aea6-50605cf915b0';
const accountId = '7ba994d1-65f1-4b82-bd69-fa0f65864d8a';
const account = {
  account_id: accountId,
  competitor_id: 'c548e57d-5741-46a1-8c4d-782da15be1d0',
  url: 'https://vimeo.com/everyonefilms',
  handle: 'everyonefilms',
  external_id: '123',
  backfill_from: '2024-01-01',
  watermark_published_at: null,
};
const input = { env: 'dev', mode: 'backfill', limit: 1, executionId: 'synthetic-m04-1' } as const;
const response = {
  status: 200,
  headers: {},
  body: {
    data: [
      {
        uri: '/videos/321',
        link: 'https://vimeo.com/321',
        privacy: { view: 'anybody' },
        release_time: '2026-10-01T00:00:00Z',
      },
    ],
    paging: { next: null },
  },
};
function setup(accounts = [account], inserted = 1) {
  const calls: { method: string; value: unknown }[] = [];
  const record = (method: string, value: unknown) => {
    calls.push({ method, value });
  };
  const gateway: VimeoGateway = {
    start: async (value) => {
      record('start', value);
      return { run_id: runId };
    },
    claim: async (value) => {
      record('claim', value);
      return accounts;
    },
    resolve: async (value) => {
      record('resolve', value);
    },
    ingest: async (value) => {
      record('ingest', value);
      return { inserted, duplicates: value.items.length - inserted, metrics_updated: 0, new_item_ids: [] };
    },
    report: async (value) => {
      record('report', value);
    },
    cost: async (value) => {
      record('cost', value);
    },
    finish: async (value) => {
      record('finish', value);
    },
  };
  return {
    calls,
    gateway,
    deps: { gateway, request: async () => response, wait: async () => {}, now: () => '2026-10-26T00:00:00Z' },
  };
}
describe('Vimeo official API lifecycle through fixed gateway ports, synthetic integration', () => {
  it('claims, collects, ingests, records zero-dollar API usage and settles a run', async () => {
    const t = setup();
    const result = await runVimeoCollector(input, t.deps);
    expect(result).toMatchObject({
      state: 'completed',
      run_id: runId,
      status: 'success',
      items_new: 1,
      api_requests: 1,
    });
    expect(t.calls.map((c) => c.method)).toEqual(['start', 'claim', 'ingest', 'report', 'cost', 'finish']);
    expect(t.calls.find((c) => c.method === 'report')?.value).toMatchObject({
      account_id: accountId,
      items_seen: 1,
      items_new: 1,
      backfill_done: true,
    });
    expect(t.calls.find((c) => c.method === 'cost')?.value).toMatchObject({
      entries: [
        {
          provider: 'vimeo',
          category: 'scrape',
          quantity: 1,
          unit: 'call',
          cost_usd: 0,
          meta: { cost_key: `vimeo:${runId}:${accountId}` },
        },
      ],
    });
  });
  it('uses the actual eight-argument reporting contract without a secondary flag', async () => {
    const t = setup();
    await runVimeoCollector(input, t.deps);
    expect(Object.keys(t.calls.find((c) => c.method === 'report')!.value as object).sort()).toEqual(
      [
        'run_id',
        'account_id',
        'status',
        'items_seen',
        'items_new',
        'error',
        'backfill_done',
        'backfill_cursor',
      ].sort(),
    );
  });
  it('preserves zero insert counts reported by an idempotent database ingestion', async () => {
    const t = setup([account], 0);
    expect(await runVimeoCollector(input, t.deps)).toMatchObject({ state: 'completed', items_new: 0 });
    expect(t.calls.find((c) => c.method === 'report')?.value).toMatchObject({ items_new: 0 });
  });
  it('reports an API failure without starting a paid fallback or ingesting', async () => {
    const t = setup();
    t.deps.request = async () => ({ ...response, status: 403 });
    expect(await runVimeoCollector(input, t.deps)).toMatchObject({
      state: 'completed',
      status: 'failed',
      items_new: 0,
    });
    expect(t.calls.some((c) => c.method === 'ingest')).toBe(false);
    expect(t.calls.find((c) => c.method === 'report')?.value).toMatchObject({
      status: 'failed',
      error: 'vimeo_api_403',
    });
  });
  it('stops on ambiguous ingestion without retrying or releasing/finishing the account', async () => {
    const t = setup();
    t.gateway.ingest = async () => {
      throw Error('synthetic transport failure');
    };
    expect(await runVimeoCollector(input, t.deps)).toMatchObject({
      state: 'reconciliation_required',
      run_id: runId,
      stage: 'ingest',
    });
    expect(t.calls.some((c) => ['report', 'finish'].includes(c.method))).toBe(false);
  });
  it('refuses duplicate or excessive claim rows before making provider requests', async () => {
    const t = setup([account, account]);
    let requests = 0;
    t.deps.request = async () => {
      requests++;
      return response;
    };
    expect(await runVimeoCollector(input, t.deps)).toMatchObject({
      state: 'reconciliation_required',
      stage: 'claim',
    });
    expect(requests).toBe(0);
  });
  it('finishes an empty due list without provider/cost activity', async () => {
    const t = setup([]);
    expect(await runVimeoCollector(input, t.deps)).toMatchObject({
      state: 'completed',
      status: 'success',
      api_requests: 0,
    });
    expect(t.calls.map((c) => c.method)).toEqual(['start', 'claim', 'finish']);
  });
  it('rejects production and malformed inputs before creating a run', async () => {
    const t = setup();
    await expect(runVimeoCollector({ ...input, env: 'prod' }, t.deps)).rejects.toThrow(
      'vimeo_invalid_run_input',
    );
    await expect(runVimeoCollector({ ...input, limit: 11 }, t.deps)).rejects.toThrow(
      'vimeo_invalid_run_input',
    );
    expect(t.calls).toEqual([]);
  });
});
