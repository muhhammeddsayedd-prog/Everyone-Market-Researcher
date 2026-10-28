import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { estimateM05Backfill, m05RepresentativePlan } from '../estimate-backfill';

// Explicit non-live example of dated rows, matching the public Scale quote in
// M05's proposed packet. No current provider/DB read or billing claim is made.
const prices = [
  {
    provider: 'apify',
    sku: 'apify/website-content-crawler:cu',
    unit: 'compute unit',
    usd_per_unit: 0.16,
    valid_from: '2026-10-18',
  },
  {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-posts:post',
    unit: '1k posts',
    usd_per_unit: 1.75,
    valid_from: '2026-10-18',
  },
  {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-posts:start',
    unit: 'run',
    usd_per_unit: 0.00005,
    valid_from: '2026-10-18',
  },
  {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-posts:empty_query',
    unit: '1k queries',
    usd_per_unit: 1,
    valid_from: '2026-10-18',
  },
  {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-employees:short_profile',
    unit: '1k profiles',
    usd_per_unit: 2.5,
    valid_from: '2026-10-18',
  },
  {
    provider: 'apify',
    sku: 'harvestapi/linkedin-company-employees:query_start',
    unit: '1k queries',
    usd_per_unit: 20,
    valid_from: '2026-10-18',
  },
  { provider: 'firecrawl', sku: 'credit', unit: 'credit', usd_per_unit: 0.00083, valid_from: '2026-10-18' },
];
const input = () => ({
  plan: structuredClone(m05RepresentativePlan),
  price_book: { as_of: '2026-10-28', rows: structuredClone(prices) },
  provider_extras_usd: { website_proxy: null, website_storage: null, website_transfer: null },
  infrastructure_usd: { vercel: null, n8n: null, supabase: null },
});

describe('M05 offline explicit-count cost estimate', () => {
  it('counts target8/max12 once, with adaptive and shared recovery starts separate from HTTP/quota work', () => {
    const estimate = estimateM05Backfill(input());
    expect(estimate.actors).toEqual({ target: 8, conditional_adaptive: 2, recovery: 2, maximum: 12 });
    expect(estimate.source_usage.firecrawl).toEqual({ planned_credits: 4, maximum_credits: 6 });
    expect(estimate.source_usage.youtube).toEqual({ planned_quota_units: 16, maximum_quota_units: 28 });
    expect(estimate.source_usage.website.planned_compute_units).toBeCloseTo(1 / 3, 12);
    expect(estimate.source_usage.website.maximum_compute_units).toBeCloseTo(2 / 3, 12);
    expect(estimate.history_coverage).toBe('not_established_by_estimate');
    expect(estimate.spending_authority).toBe(false);
  });
  it('calculates actual unit conversions and the packet quote with upward six-decimal rounding', () => {
    const estimate = estimateM05Backfill(input());
    const line = (id: string) => estimate.line_items.find((x) => x.id === id)!;
    expect(line('linkedin_post_results').planned_usd).toBe(0.14); // 80 /1000 *1.75
    expect(line('linkedin_post_start_events').planned_usd).toBe(0.0002);
    expect(line('linkedin_post_empty_queries').planned_usd).toBe(0.004);
    expect(line('linkedin_employee_profiles').planned_usd).toBe(0.1);
    expect(line('linkedin_employee_queries').planned_usd).toBe(0.04);
    expect(line('website_primary_compute').planned_usd).toBe(0.053334);
    expect(line('website_adaptive_compute').planned_usd).toBe(0);
    expect(line('website_adaptive_compute').maximum_usd).toBe(0.053334);
    expect(line('youtube_quota').maximum_usd).toBe(0);
    expect(line('firecrawl_maps').maximum_usd).toBe(0.00498);
    expect(estimate.recovery.maximum_usd).toBe(0.14);
    expect(estimate.providers.planned_known_base_usd).toBe(0.340854);
    expect(estimate.providers.maximum_known_base_usd).toBe(0.535848);
    expect(estimate.providers.maximum_total_usd).toBeNull();
  });
  it('uses a shared recovery maximum rather than adding mutually exclusive post and employee alternatives', () => {
    const estimate = estimateM05Backfill(input());
    expect(estimate.recovery.linkedin_posts_usd).toBe(0.0721);
    expect(estimate.recovery.linkedin_employees_usd).toBe(0.14);
    expect(estimate.recovery.quote_source).toBe('linkedin_employees');
    const expensivePosts = input();
    expensivePosts.price_book.rows.find((x) => x.sku.endsWith(':post'))!.usd_per_unit = 1000;
    const quote = estimateM05Backfill(expensivePosts);
    expect(quote.recovery.maximum_usd).toBe(40.0021);
    expect(quote.recovery.quote_source).toBe('linkedin_posts');
    expect(quote.recovery.maximum_usd).not.toBe(40.1421);
  });
  it('preserves a null or missing nonzero price as unknown instead of pretending it is free', () => {
    const missing = input();
    missing.price_book.rows = missing.price_book.rows.filter((x) => x.provider !== 'firecrawl');
    const quote = estimateM05Backfill(missing);
    expect(quote.line_items.find((x) => x.id === 'firecrawl_maps')?.maximum_usd).toBeNull();
    expect(quote.providers.maximum_base_usd).toBeNull();
    expect(quote.providers.maximum_known_base_usd).toBe(0.530868);
    const unknown: unknown = {
      ...input(),
      price_book: {
        as_of: '2026-10-28',
        rows: prices.map((x) => ({ ...x, usd_per_unit: x.provider === 'firecrawl' ? null : x.usd_per_unit })),
      },
    };
    expect(estimateM05Backfill(unknown).providers.unknown_components).toContain('firecrawl_maps');
  });
  it('selects the latest applicable price, excludes future rows and does not fall back through a newer unknown', () => {
    const dated = input();
    dated.price_book.rows.push({
      provider: 'firecrawl',
      sku: 'credit',
      unit: 'credit',
      usd_per_unit: 10,
      valid_from: '2026-10-29',
    });
    expect(estimateM05Backfill(dated).line_items.find((x) => x.id === 'firecrawl_maps')?.maximum_usd).toBe(
      0.00498,
    );
    const newerUnknown = {
      ...dated,
      price_book: {
        ...dated.price_book,
        rows: [
          ...dated.price_book.rows,
          {
            provider: 'firecrawl',
            sku: 'credit',
            unit: 'credit',
            usd_per_unit: null,
            valid_from: '2026-10-28',
          },
        ],
      },
    };
    expect(estimateM05Backfill(newerUnknown).providers.maximum_base_usd).toBeNull();
  });
  it('keeps proxy/storage/transfer and infrastructure separate, and adds each known charge only once', () => {
    const known = {
      ...input(),
      provider_extras_usd: { website_proxy: 0.1, website_storage: 0.2, website_transfer: 0.3 },
      infrastructure_usd: { vercel: 1, n8n: 2, supabase: 3 },
    };
    const quote = estimateM05Backfill(known);
    expect(quote.providers.maximum_total_usd).toBe(1.135848);
    expect(quote.infrastructure.total_usd).toBe(6);
    expect(quote.combined_maximum_usd).toBe(7.135848);
    expect(quote.providers.maximum_known_base_usd).toBe(0.535848);
    expect(estimateM05Backfill(input()).infrastructure.total_usd).toBeNull();
  });
  it('returns zero for deliberately unused components without inventing their unknown unit prices', () => {
    const none = {
      plan: {
        website: { primary_starts: 0, adaptive_starts: 0 },
        linkedin_posts: { planned_starts: 0, results_per_start: 20, start_events: 0, empty_query_events: 0 },
        linkedin_employees: { planned_starts: 0, profiles_per_start: 20 },
        recovery_actor_starts: 0,
        firecrawl: { planned_maps: 0, recovery_maps: 0 },
        youtube: { planned_quota_units: 5, resolution_quota_units: 0, recovery_quota_units: 0 },
      },
      price_book: { as_of: '2026-10-28', rows: [] },
      provider_extras_usd: { website_proxy: 0, website_storage: 0, website_transfer: 0 },
      infrastructure_usd: { vercel: 0, n8n: 0, supabase: 0 },
    };
    const quote = estimateM05Backfill(none);
    expect(quote.providers.maximum_total_usd).toBe(0);
    expect(quote.line_items.find((x) => x.id === 'website_primary_compute')?.rate_usd_per_unit).toBeNull();
    expect(quote.actors.maximum).toBe(0);
  });
  it('rejects malformed units, duplicate dated rows and impossible adaptive/event counts with a fixed non-secret error', () => {
    const wrongUnit = input();
    wrongUnit.price_book.rows[0]!.unit = '1k results';
    const duplicate = input();
    duplicate.price_book.rows.push({ ...duplicate.price_book.rows[0]! });
    const extraAdaptive = input();
    extraAdaptive.plan.website.adaptive_starts = 3;
    const extraEvents = input();
    extraEvents.plan.linkedin_posts.empty_query_events = 5;
    for (const bad of [
      wrongUnit,
      duplicate,
      extraAdaptive,
      extraEvents,
      { ...input(), raw_secret: 'NEVER_ECHO_THIS_INPUT' },
    ]) {
      expect(() => estimateM05Backfill(bad)).toThrow('M05_ESTIMATE_INPUT_INVALID');
      try {
        estimateM05Backfill(bad);
      } catch (error) {
        expect(String(error)).not.toContain('NEVER_ECHO');
      }
    }
  });
  it('runs directly through native Node24 on a non-secret JSON file without requiring a TS runtime installer', () => {
    const dir = mkdtempSync(join(tmpdir(), 'emr-m05-public-estimate-'));
    const path = join(dir, 'input.json');
    try {
      writeFileSync(path, JSON.stringify(input()));
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('../estimate-backfill.ts', import.meta.url)), path],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 10000,
          env: {
            SystemRoot: process.env.SystemRoot ?? 'C:\\Windows',
            WINDIR: process.env.WINDIR ?? 'C:\\Windows',
            PATH: 'C:\\Windows\\System32;C:\\Program Files\\nodejs',
          },
        },
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout).actors.maximum).toBe(12);
      expect(readFileSync(path, 'utf8')).toBe(JSON.stringify(input()));
    } finally {
      unlinkSync(path);
      rmdirSync(dir);
    }
  });
});
