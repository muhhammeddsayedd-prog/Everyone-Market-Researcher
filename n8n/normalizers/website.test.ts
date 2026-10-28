import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildWebsiteMapRequest,
  parseWebsiteMapResponse,
  buildWebsiteCrawlerBatches,
} from '../collectors/website.mjs';
import { runWebsiteCollector } from '../collectors/website-run.mjs';
import { m05Args } from '../../packages/shared/src/n8n-m05-contracts';

const account = {
  account_id: '51000000-0000-4000-8000-000000000001',
  competitor_id: '51000000-0000-4000-8000-000000000002',
  platform: 'website_work_page',
  url: 'https://studio.film/Work/',
};
const rootAccount = {
  ...account,
  account_id: '51000000-0000-4000-8000-000000000003',
  platform: 'website',
  url: 'https://studio.film/',
};
const pageUrl = 'https://studio.film/Work/A-Film';
const require = createRequire(import.meta.url);
const { normalizeWebsitePage, prepareWebsiteResults } = require('./websiteContentCrawler.js');
const body =
  '# A Film\n\n' +
  'A public campaign production for a client. '.repeat(10) +
  '\n## Credits\nDirector: Fixture Person';
const row = {
  url: pageUrl,
  crawl: { loadedUrl: pageUrl },
  metadata: {
    title: 'A Film | Studio',
    canonicalUrl: pageUrl,
    openGraph: [{ property: 'og:image', content: 'https://studio.film/cover.jpg' }],
  },
  markdown: body,
};
const context = {
  account,
  mode: 'backfill',
  requestedUrls: [pageUrl],
  crawlerType: 'cheerio',
  retryAttempt: 0,
  now: '2026-10-28T00:00:00Z',
};

describe('M05 website source contracts — labelled local examples, no provider evidence', () => {
  it('runs the checked-in labelled local fixture without treating it as a provider capture', () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL('./fixtures/website-content-crawler/m05-local-contract.json', import.meta.url),
        'utf8',
      ),
    );
    expect(fixture.provider_capture).toBe(false);
    expect(fixture.observed_at).toBeNull();
    const prepared = prepareWebsiteResults(fixture.rows, { ...context, account: fixture.account });
    expect(prepared.complete).toBe(true);
    expect(prepared.items).toHaveLength(1);
    expect(prepared.items[0].published_at).toBeNull();
  });
  it('builds one explicit v2 map request without an implicit source expansion or credentials', () => {
    expect(buildWebsiteMapRequest(account, { mode: 'daily' })).toEqual({
      method: 'POST',
      url: 'https://api.firecrawl.dev/v2/map',
      timeoutMs: 60000,
      body: {
        url: 'https://studio.film/Work',
        limit: 500,
        includeSubdomains: false,
        sitemap: 'include',
        ignoreQueryParameters: true,
        timeout: 60000,
      },
    });
    expect(buildWebsiteMapRequest(account, { mode: 'backfill' }).body.limit).toBe(2000);
  });
  it('parses v2 link objects, scopes by path boundary and preserves path case', () => {
    const result = parseWebsiteMapResponse(
      {
        statusCode: 200,
        body: {
          success: true,
          links: [
            { url: pageUrl + '/?utm_source=fixture#top' },
            { url: pageUrl },
            { url: 'https://studio.film/Workshop/not-owned' },
            { url: 'https://other.film/Work/A' },
            { url: 'https://studio.film/Work/tag/foo' },
            { url: 'https://studio.film/Work/cover.jpg' },
          ],
        },
      },
      account,
      { mode: 'daily' },
    );
    expect(result.urls).toEqual([pageUrl]);
    expect(result.coverage).toBe('observed_map_only');
    expect(result.mapCapped).toBe(false);
  });
  it('filters a domain-root account without inventing a work path or allowing sibling origins', () => {
    const result = parseWebsiteMapResponse(
      {
        statusCode: 200,
        body: {
          success: true,
          links: [
            { url: 'https://studio.film/ar/projects/film' },
            { url: 'https://studio.film/about' },
            { url: 'https://studio.film/projects/tag/film' },
            { url: 'https://cdn.studio.film/projects/film' },
          ],
        },
      },
      rootAccount,
      { mode: 'daily' },
    );
    expect(result.urls).toEqual(['https://studio.film/ar/projects/film']);
  });
  it.each([
    { statusCode: 200, body: { success: true, links: [pageUrl] } },
    { statusCode: 200, body: { success: false, links: [] } },
    { statusCode: 429, body: { success: true, links: [] } },
    {
      statusCode: 200,
      body: { success: true, links: [{ url: 'https://studio.film/Work/A?token=private' }] },
    },
  ])('rejects contract drift, API failure or credential-bearing map output', (response) => {
    expect(() => parseWebsiteMapResponse(response, account, { mode: 'daily' })).toThrow();
  });
  it.each([
    'https://127.0.0.1/Work',
    'https://studio.local/Work',
    'https://user:pass@studio.film/Work',
    'https://studio.film:444/Work',
    'http://studio.film/Work',
  ])('refuses an unsafe target %s', (url) => {
    expect(() => buildWebsiteMapRequest({ ...account, url }, { mode: 'daily' })).toThrow();
  });
  it('keeps cap saturation explicit and never reports map discovery as exhaustive backfill', () => {
    const result = parseWebsiteMapResponse(
      {
        statusCode: 200,
        body: {
          success: true,
          links: Array.from({ length: 500 }, (_, i) => ({ url: `https://studio.film/Work/${i}` })),
        },
      },
      account,
      { mode: 'daily' },
    );
    expect(result.mapCapped).toBe(true);
    expect(result.coverage).toBe('partial');
    expect(result.backfillDone).toBe(false);
  });
  it('bounds crawler batches and explicitly disables login, CAPTCHA rotation, downloads and paid AI', () => {
    const urls = Array.from({ length: 201 }, (_, i) => `https://studio.film/Work/${i}`);
    const plans = buildWebsiteCrawlerBatches(account, urls, { crawlerType: 'cheerio' });
    expect(plans.map((p: { urls: string[] }) => p.urls.length)).toEqual([200, 1]);
    const first = plans[0];
    if (!first) throw Error('expected_first_crawler_batch');
    expect(first.input).toMatchObject({
      maxCrawlDepth: 0,
      maxCrawlPages: 200,
      maxResults: 200,
      respectRobotsTxtFile: true,
      useSitemaps: false,
      useLlmsTxt: false,
      maxSessionRotations: 0,
      ignoreHttpsErrors: false,
      saveFiles: false,
      saveContentTypes: '',
      summarize: false,
      blockMedia: true,
    });
    expect(first.input).not.toHaveProperty('initialCookies');
    expect(first.input).not.toHaveProperty('customHttpHeaders');
    expect(() =>
      buildWebsiteCrawlerBatches(account, ['https://other.film/Work/A'], { crawlerType: 'cheerio' }),
    ).toThrow();
  });
  it('accepts a narrower explicit map limit while refusing any default-cap expansion', () => {
    expect(buildWebsiteMapRequest(account, { mode: 'backfill', map_limit: 100 }).body.limit).toBe(100);
    expect(() => buildWebsiteMapRequest(account, { mode: 'daily', map_limit: 501 })).toThrow();
  });
  it('uses the stable SHA256 first32 requested-URL identity and a null unknown publication date', () => {
    const result = normalizeWebsitePage(row, context);
    expect(result.outcome).toBe('crawled');
    expect(result.item.external_id).toBe(createHash('sha256').update(pageUrl).digest('hex').slice(0, 32));
    expect(result.item.published_at).toBeNull();
    expect(result.item.payload.backfill).toBe(true);
    expect(result.item.title).toBe('A Film');
    expect(result.item.credits_text).toContain('Director: Fixture Person');
    expect(result.item.payload).not.toHaveProperty('html');
    expect(result.item.payload).not.toHaveProperty('headers');
  });
  it('extracts validated metadata dates and public media references without treating fetch time as publication', () => {
    const result = normalizeWebsitePage(
      {
        ...row,
        metadata: {
          ...row.metadata,
          openGraph: [{ property: 'article:published_time', content: '2025-04-01T10:00:00Z' }],
        },
        markdown:
          body +
          '\nhttps://player.vimeo.com/video/12345 https://www.youtube.com/watch?v=abcdefghijk https://youtube.com.attacker.invalid/watch?v=bad',
      },
      context,
    );
    expect(result.item.published_at).toBe('2025-04-01T10:00:00.000Z');
    expect(result.item.media_urls).toEqual([
      'https://vimeo.com/12345',
      'https://www.youtube.com/watch?v=abcdefghijk',
    ]);
  });
  it('does not infer a date from an unrelated year deep in the body or accept invalid calendar dates', () => {
    const result = normalizeWebsitePage(
      { ...row, markdown: body + '\n2024-02-30', metadata: { ...row.metadata, datePublished: '2024-02-30' } },
      context,
    );
    expect(result.item.published_at).toBeNull();
  });
  it('rejects canonical or loaded URL ownership drift instead of changing item identity', () => {
    expect(
      normalizeWebsitePage(
        { ...row, metadata: { ...row.metadata, canonicalUrl: 'https://other.film/Work/A' } },
        context,
      ).outcome,
    ).toBe('failed');
    expect(
      normalizeWebsitePage({ ...row, crawl: { loadedUrl: 'https://studio.film/Work/B' } }, context).outcome,
    ).toBe('failed');
  });
  it('ignores non-project pages and retries only thin public pages once', () => {
    const privacy = 'https://studio.film/Work/privacy';
    expect(
      normalizeWebsitePage(
        { ...row, url: privacy, crawl: { loadedUrl: privacy }, metadata: { title: 'Privacy policy' } },
        { ...context, requestedUrls: [privacy] },
      ).outcome,
    ).toBe('ignored');
    expect(
      normalizeWebsitePage({ ...row, markdown: 'Public project shell', metadata: {} }, context),
    ).toMatchObject({ outcome: 'thin', retryable: true });
    expect(
      normalizeWebsitePage(
        { ...row, markdown: 'Public project shell', metadata: {} },
        { ...context, crawlerType: 'playwright:adaptive', retryAttempt: 1 },
      ),
    ).toMatchObject({ outcome: 'failed', retryable: false });
    expect(
      normalizeWebsitePage({ ...row, markdown: 'CAPTCHA: verify you are human', metadata: {} }, context),
    ).toMatchObject({ outcome: 'failed', retryable: false });
    expect(
      normalizeWebsitePage(
        { ...row, markdown: '', html: '<html><div class="g-recaptcha">challenge</div></html>', metadata: {} },
        context,
      ),
    ).toMatchObject({ outcome: 'failed', retryable: false });
  });
  it('requires one evidenced result per requested URL and keeps thin retry ownership explicit', () => {
    const prepared = prepareWebsiteResults(
      [{ ...row, markdown: 'Public project shell', metadata: {} }],
      context,
    );
    expect(prepared.retryUrls).toEqual([pageUrl]);
    expect(prepared.complete).toBe(false);
    expect(prepared.group).toMatchObject({
      account_id: account.account_id,
      status: 'success',
      pages: [{ url: pageUrl, status: 'thin' }],
      retry_urls: [pageUrl],
    });
    expect(prepareWebsiteResults([], context).outcomes[0]).toMatchObject({
      outcome: 'failed',
      error: 'website_result_missing',
    });
    expect(() => prepareWebsiteResults([row, row], context)).toThrow();
    expect(() => prepareWebsiteResults([], { ...context, retryAttempt: 2 })).toThrow();
  });
  it('preserves valid pages when a sibling result is missing and matches the real gateway item contract', () => {
    const second = 'https://studio.film/Work/Another-Film';
    const prepared = prepareWebsiteResults([{ ...row, markdown: 'A public film campaign. '.repeat(30) }], {
      ...context,
      requestedUrls: [pageUrl, second],
    });
    expect(prepared.group).toMatchObject({
      status: 'failed',
      pages: [
        { url: pageUrl, status: 'crawled' },
        { url: second, status: 'failed' },
      ],
    });
    expect(prepared.items).toHaveLength(1);
    expect(
      m05Args['m05.ingest'].safeParse({
        run_id: '51000000-0000-4000-8000-000000000010',
        account_id: account.account_id,
        items: prepared.items,
      }).success,
    ).toBe(true);
  });
});

describe('M05 website injected lifecycle — local contract only', () => {
  function ports(overrides: Record<string, unknown> = {}) {
    const calls: { operation: string; args: Record<string, unknown> }[] = [];
    const run = '51000000-0000-4000-8000-000000000010';
    const gateway = Object.fromEntries(
      ['start', 'claim', 'diff', 'cost', 'launch', 'register', 'close_registration', 'report', 'finish'].map(
        (operation) => [
          operation,
          async (args: Record<string, unknown>) => {
            calls.push({ operation, args });
            if (operation === 'start') return { run_id: run };
            if (operation === 'claim')
              return args.platform === 'website_work_page' ? [account] : [rootAccount];
            if (operation === 'diff') return args.account_id === account.account_id ? [pageUrl] : [];
            if (operation === 'launch')
              return {
                replayed: false,
                permit: true,
                launch_id: args.launch_id,
                descriptor: {
                  actorPath: 'apify~website-content-crawler',
                  build: '1.0.0',
                  memory: 1024,
                  timeout: 600,
                  billingModel: 'PPU',
                  maxItems: (args.urls as string[]).length,
                  maxTotalChargeUsd: 0.4,
                },
              };
            if (operation === 'register')
              return { registered: true, run_id: run, apify_run_id: args.apify_run_id };
            if (operation === 'close_registration') {
              if (calls.some((c) => c.operation === 'register'))
                return {
                  state: 'awaiting_callbacks',
                  registration_closed: true,
                  finished_now: false,
                  summary: null,
                };
              const reports = calls.filter((c) => c.operation === 'report');
              const failed = reports.filter((c) => c.args.status === 'failed').length;
              return {
                state: 'completed',
                registration_closed: true,
                finished_now: true,
                summary: {
                  run_id: run,
                  status: failed === 0 ? 'success' : failed === reports.length ? 'failed' : 'partial',
                },
              };
            }
            return { ok: true };
          },
        ],
      ),
    );
    return {
      calls,
      deps: {
        gateway,
        now: () => '2026-10-28T00:00:00Z',
        firecrawlCreditUsd: 0.00083,
        map: async () => ({ statusCode: 200, body: { success: true, links: [{ url: pageUrl }] } }),
        startActor: async (_plan: unknown, descriptor: { maxTotalChargeUsd: number }) => ({
          id: 'localActor',
          options: { maxTotalChargeUsd: descriptor.maxTotalChargeUsd, isMaxTotalChargeUsdSetByUser: true },
        }),
        ...overrides,
      },
    };
  }
  const input = {
    env: 'dev',
    mode: 'backfill',
    limit: 2,
    executionId: 'local-web-1',
    max_actor_starts: 2,
    account_ids: { website_work_page: [account.account_id], website: [rootAccount.account_id] },
  };
  it('connects both claim partitions, map/diff/cost and one async registered launch without early finish', async () => {
    const t = ports();
    const result = await runWebsiteCollector(input, t.deps);
    expect(result.state).toBe('awaiting_callbacks');
    expect(t.calls.filter((c) => c.operation === 'claim').map((c) => c.args.platform)).toEqual([
      'website_work_page',
      'website',
    ]);
    expect(t.calls.filter((c) => c.operation === 'cost')).toHaveLength(2);
    expect(t.calls.filter((c) => c.operation === 'report').map((c) => c.args.account_id)).toEqual([
      rootAccount.account_id,
    ]);
    expect(t.calls.some((c) => c.operation === 'finish')).toBe(false);
    const launched = t.calls.find((c) => c.operation === 'launch')!.args;
    expect(launched).toMatchObject({
      urls: [pageUrl],
      crawler_type: 'cheerio',
      actor_input: { maxCrawlDepth: 0 },
    });
    expect(t.calls.findIndex((c) => c.operation === 'launch')).toBeLessThan(
      t.calls.findIndex((c) => c.operation === 'register'),
    );
    expect(t.calls.at(-1)?.operation).toBe('close_registration');
    for (const { operation, args } of t.calls)
      expect(m05Args[('m05.' + operation) as keyof typeof m05Args].safeParse(args).success).toBe(true);
  });
  it('does not repeat an uncertain paid start or release its claims', async () => {
    let starts = 0;
    const t = ports({
      startActor: async () => {
        starts++;
        throw Error('uncertain');
      },
    });
    expect(await runWebsiteCollector(input, t.deps)).toMatchObject({
      state: 'reconciliation_required',
      stage: 'actor_start',
    });
    expect(starts).toBe(1);
    expect(t.calls.some((c) => ['register', 'close_registration', 'finish'].includes(c.operation))).toBe(
      false,
    );
  });
  it('rejects an actor descriptor that contradicts the measured-usage callback contract before a start', async () => {
    let starts = 0;
    const t = ports({
      startActor: async () => {
        starts++;
        return { id: 'mustNotStart' };
      },
    });
    t.deps.gateway.launch = async (args) => ({
      replayed: false,
      permit: true,
      launch_id: args.launch_id,
      descriptor: {
        actorPath: 'apify~website-content-crawler',
        build: '1.0.0',
        memory: 1024,
        timeout: 600,
        billingModel: 'PPE',
        maxItems: 1,
        maxTotalChargeUsd: 0.4,
      },
    });
    expect(await runWebsiteCollector(input, t.deps)).toMatchObject({
      state: 'reconciliation_required',
      stage: 'launch',
      actor_starts: 0,
    });
    expect(starts).toBe(0);
  });
  it('stops daily redesigns over 80 percent and 30 new pages without any actor start', async () => {
    const urls = Array.from({ length: 31 }, (_, i) => `https://studio.film/Work/${i}`);
    let starts = 0;
    const t = ports({
      map: async () => ({ statusCode: 200, body: { success: true, links: urls.map((url) => ({ url })) } }),
      startActor: async () => {
        starts++;
        return { id: 'mustNotStart' };
      },
    });
    t.deps.gateway.diff = async (args) => {
      t.calls.push({ operation: 'diff', args });
      return urls;
    };
    const result = await runWebsiteCollector({ ...input, mode: 'daily' }, t.deps);
    expect(result).toMatchObject({ state: 'completed', status: 'failed', actor_starts: 0 });
    expect(starts).toBe(0);
    expect(
      t.calls.filter((c) => c.operation === 'report').every((c) => c.args.error === 'web_redesign_guard'),
    ).toBe(true);
  });
  it('chunks the existing 1000-URL diff contract and enforces the whole planned start bound before starting', async () => {
    const urls = Array.from({ length: 1001 }, (_, i) => `https://studio.film/Work/film-${i}`);
    let starts = 0;
    const t = ports({
      map: async () => ({ statusCode: 200, body: { success: true, links: urls.map((url) => ({ url })) } }),
      startActor: async () => {
        starts++;
        return { id: 'mustNotStart' };
      },
    });
    t.deps.gateway.diff = async (args) => {
      t.calls.push({ operation: 'diff', args });
      return args.urls as string[];
    };
    const result = await runWebsiteCollector(
      { ...input, limit: 1, account_ids: { website_work_page: [account.account_id], website: [] } },
      t.deps,
    );
    expect(result).toMatchObject({
      state: 'reconciliation_required',
      stage: 'actor_allowance',
      actor_starts: 0,
    });
    expect(
      t.calls.filter((c) => c.operation === 'diff').map((c) => (c.args.urls as string[]).length),
    ).toEqual([1000, 1]);
    expect(starts).toBe(0);
    expect(
      t.calls.some((c) => ['launch', 'register', 'close_registration', 'finish'].includes(c.operation)),
    ).toBe(false);
  });
  it('finishes an actual no-new source plan and retains a map failure without a guessed re-map', async () => {
    const t = ports();
    t.deps.gateway.diff = async (args) => {
      t.calls.push({ operation: 'diff', args });
      return [];
    };
    expect(await runWebsiteCollector(input, t.deps)).toMatchObject({
      state: 'completed',
      status: 'success',
      actor_starts: 0,
    });
    expect(t.calls.some((c) => c.operation === 'finish')).toBe(false);
    expect(t.calls.filter((c) => c.operation === 'report').every((c) => c.args.backfill_done === false)).toBe(
      true,
    );
    let maps = 0;
    const lost = ports({
      map: async () => {
        maps++;
        throw Error('outcome unknown');
      },
    });
    expect(await runWebsiteCollector(input, lost.deps)).toMatchObject({
      state: 'reconciliation_required',
      stage: 'map',
      map_requests: 1,
    });
    expect(maps).toBe(1);
    expect(
      lost.calls.some((c) => ['launch', 'register', 'close_registration', 'finish'].includes(c.operation)),
    ).toBe(false);
  });
  it('diffs every observed owned page before a bounded representative three-page selection', async () => {
    const urls = Array.from({ length: 7 }, (_, i) => `https://studio.film/Work/film-${i}`);
    const t = ports({
      map: async () => ({ statusCode: 200, body: { success: true, links: urls.map((url) => ({ url })) } }),
    });
    t.deps.gateway.diff = async (args) => {
      t.calls.push({ operation: 'diff', args });
      return args.urls as string[];
    };
    const result = await runWebsiteCollector(
      {
        ...input,
        limit: 1,
        account_ids: { website_work_page: [account.account_id], website: [] },
        source_options: { map_limit: 100, max_new_urls_per_account: 3 },
      },
      t.deps,
    );
    expect(result).toMatchObject({ state: 'awaiting_callbacks', actor_starts: 1 });
    expect(t.calls.find((c) => c.operation === 'diff')?.args.urls).toEqual(urls);
    expect(t.calls.find((c) => c.operation === 'launch')?.args.urls).toEqual(urls.slice(0, 3));
    expect(result).toMatchObject({
      coverage_records: [
        {
          account_id: account.account_id,
          pending_urls: 7,
          selected_urls: 3,
          deferred_urls: 4,
          backfill_done: false,
        },
      ],
    });
    const repeat = ports({
      map: async () => ({ statusCode: 200, body: { success: true, links: urls.map((url) => ({ url })) } }),
    });
    repeat.deps.gateway.diff = async (args) => {
      repeat.calls.push({ operation: 'diff', args });
      return urls.slice(3);
    };
    const repeated = await runWebsiteCollector(
      {
        ...input,
        executionId: 'local-web-repeat',
        limit: 1,
        account_ids: { website_work_page: [account.account_id], website: [] },
        source_options: { map_limit: 100, max_new_urls_per_account: 3 },
      },
      repeat.deps,
    );
    expect(repeated).toMatchObject({
      state: 'completed',
      actor_starts: 0,
      coverage_records: [{ selected_urls: 0, deferred_urls: 4 }],
    });
    expect(repeat.calls.some((c) => c.operation === 'launch')).toBe(false);
  });
  it('reports the actual closed parent result rather than a requested or inferred status', async () => {
    const t = ports();
    t.deps.gateway.diff = async () => [];
    t.deps.gateway.close_registration = async () => ({
      state: 'completed',
      registration_closed: true,
      finished_now: true,
      summary: { run_id: '51000000-0000-4000-8000-000000000010', status: 'failed' },
    });
    expect(await runWebsiteCollector(input, t.deps)).toMatchObject({
      state: 'completed',
      status: 'failed',
      actor_starts: 0,
    });
    t.deps.gateway.close_registration = async () => ({
      state: 'completed',
      registration_closed: true,
      finished_now: true,
      summary: { run_id: '51000000-0000-4000-8000-000000000099', status: 'success' },
    });
    expect(await runWebsiteCollector(input, t.deps)).toMatchObject({
      state: 'reconciliation_required',
      stage: 'close_registration',
    });
  });
  it.each([undefined, 0.1])(
    'preserves the acknowledged actor ID and stops before another start when its USD cap acknowledgment is %s',
    async (cap) => {
      let starts = 0;
      let sentOptions: unknown;
      const t = ports({
        startActor: async (plan: { start_options: unknown }) => {
          starts++;
          sentOptions = plan.start_options;
          return {
            id: 'knownUnverifiedCapRun',
            options: cap === undefined ? {} : { maxTotalChargeUsd: cap, isMaxTotalChargeUsdSetByUser: true },
          };
        },
      });
      t.deps.gateway.diff = async (args) => {
        t.calls.push({ operation: 'diff', args });
        return [pageUrl];
      };
      const result = await runWebsiteCollector(input, t.deps);
      expect(result).toMatchObject({
        state: 'reconciliation_required',
        stage: 'actor_cap_ack',
        actor_starts: 1,
        launches: [{ apify_run_id: 'knownUnverifiedCapRun', cap_acknowledged: false }],
      });
      expect(sentOptions).toMatchObject({
        waitForFinish: 0,
        restartOnError: false,
        maxTotalChargeUsd: 0.4,
        timeout: 600,
        memory: 1024,
      });
      expect(sentOptions).not.toHaveProperty('maxItems');
      expect(starts).toBe(1);
      expect(t.calls.filter((c) => c.operation === 'register')).toHaveLength(1);
      expect(t.calls.some((c) => ['close_registration', 'finish'].includes(c.operation))).toBe(false);
    },
  );
});
