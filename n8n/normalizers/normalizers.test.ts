import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

type CommonHelpers = {
  lc: (value: string | null | undefined) => string;
  noAt: (value: string | null | undefined) => string;
  iso: (value: string | number | null | undefined) => string | null;
  tags: (value: string | null | undefined) => string[];
  ats: (value: string | null | undefined) => string[];
  int: (value: string | number | null | undefined) => number | null;
  isoDur: (value: string | null | undefined) => number | null;
  hms: (value: string | null | undefined) => number | null;
  trim8k: (value: string | null | undefined) => string;
};

// Load the same plain JavaScript that is pasted into n8n Code nodes.
const require = createRequire(import.meta.url);
const common = require('./_common.js') as CommonHelpers;

type NormalizedItem = {
  platform: string;
  external_id: string;
  actor: string;
  item_type: string;
  url: string;
  published_at: string | null;
  payload: Record<string, unknown>;
  title?: string | null;
  caption?: string;
  metrics?: Record<string, number | null>;
};
type PreparedGroup = {
  account_id: string;
  status: 'success' | 'failed' | 'skipped';
  error: string | null;
  items_seen: number;
  items_dropped: number;
  items: NormalizedItem[];
  batches: NormalizedItem[][];
  backfill_done: boolean;
  backfill_cursor: Record<string, unknown> | null;
};
const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/website-content-crawler/synthetic-smoke-contract.json', import.meta.url),
    'utf8',
  ),
) as { fixtureProvenance: { actualActorCapture: boolean; kind: string }; row: Record<string, unknown> };
const website = require('./smoke_website_stub.js') as {
  canonicalWebsiteUrl: (input: unknown) => string;
  normalizeSmokeWebsite: (row: unknown) => { json: NormalizedItem; matchKey: string };
};
const ingestion = require('./prepare_ingest_groups.js') as {
  prepareIngestGroups: (input: unknown) => PreparedGroup[];
};
const accountId = 'b7fa1fc1-5464-46c9-9cb0-7666d02a4cf3';
const item = () => website.normalizeSmokeWebsite(fixture.row).json;
const group = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  account_id: accountId,
  items,
  status: 'success',
  error: null,
  backfill_done: false,
  backfill_cursor: null,
  ...extra,
});

describe('M03 synthetic website crawler contract, not hosted capture', () => {
  it('labels the local fixture as synthetic and maps the exact minimal ingest fields', () => {
    expect(fixture.fixtureProvenance).toMatchObject({
      actualActorCapture: false,
      kind: 'synthetic_local_contract',
    });
    const normalized = website.normalizeSmokeWebsite(fixture.row);
    expect(normalized.matchKey).toBe('https://everyone.film/about-everyone');
    expect(normalized.json).toEqual({
      platform: 'website_work_page',
      external_id: createHash('sha256')
        .update('https://everyone.film/about-everyone')
        .digest('hex')
        .slice(0, 32),
      actor: 'apify/website-content-crawler',
      item_type: 'project_page',
      url: normalized.matchKey,
      published_at: null,
      title: 'Synthetic everyone. smoke contract',
      caption: fixture.row.markdown,
      metrics: {},
      payload: {
        url: normalized.matchKey,
        markdown: fixture.row.markdown,
        metadata: { title: 'Synthetic everyone. smoke contract' },
      },
    });
  });
  it('uses stable SHA256 identity and retains case-sensitive paths', () => {
    expect(
      website.normalizeSmokeWebsite({ ...fixture.row, url: 'http://EVERYONE.FILM/about-everyone?other=1#x' })
        .json.external_id,
    ).toBe(item().external_id);
    expect(
      website.normalizeSmokeWebsite({ ...fixture.row, url: 'https://everyone.film/About-everyone' }).json
        .external_id,
    ).not.toBe(item().external_id);
    expect(item().external_id).toMatch(/^[a-f0-9]{32}$/);
  });
  it('matches the actual atomic M03 processor required keys before producing a callback DTO', () => {
    const sql = readFileSync(
      new URL('../../supabase/migrations/20261018034220_rpc_n8n_foundation.sql', import.meta.url),
      'utf8',
    );
    const requiredKeys = /not\(\(v_items->0\)\s*\?&\s*array\[([\s\S]*?)\]\)/.exec(sql);
    expect(requiredKeys, 'actual M03 processor key contract must be reviewable').not.toBeNull();
    const keys = [...requiredKeys![1]!.matchAll(/'([^']+)'/g)].map((match) => match[1]!);
    const prepared = ingestion.prepareIngestGroups([group([item()])])[0]!;
    expect(Object.keys(prepared.items[0]!).sort()).toEqual(keys.sort());
    expect(prepared.items[0]!.metrics).toEqual({});
  });
  it('ignores untrusted metadata canonical URL and keeps only the M03 public snapshot', () => {
    const row = {
      ...fixture.row,
      metadata: { canonicalUrl: 'https://unrelated.film/other', title: 'Raw title | retained' },
    };
    expect(website.normalizeSmokeWebsite(row).json).toMatchObject({
      url: 'https://everyone.film/about-everyone',
      title: 'Raw title | retained',
      payload: {
        url: 'https://everyone.film/about-everyone',
        markdown: fixture.row.markdown,
        metadata: { title: 'Raw title | retained' },
      },
    });
  });
  it('caps Markdown at8000 and defaults unavailable text fields without invented dates', () => {
    expect(
      website.normalizeSmokeWebsite({ ...fixture.row, markdown: 'x'.repeat(8001) }).json.caption,
    ).toHaveLength(8000);
    expect(website.normalizeSmokeWebsite({ url: 'https://everyone.film/page' }).json).toMatchObject({
      title: null,
      caption: '',
      published_at: null,
    });
  });
  it('excludes request/header/cookie credentials and query-bearing raw URLs from the public snapshot', () => {
    const marker = 'synthetic-private-marker';
    const result = website.normalizeSmokeWebsite({
      ...fixture.row,
      request: { headers: { Authorization: marker } },
      headers: { 'set-cookie': marker },
      unknownCredential: marker,
    });
    expect(JSON.stringify(result)).not.toContain(marker);
    expect(result.json.payload).toEqual({
      url: result.json.url,
      markdown: result.json.caption,
      metadata: { title: result.json.title },
    });
    expect(JSON.stringify(result)).not.toContain('synthetic=1');
  });
  it('caps snapshot and normalized titles consistently at2000', () => {
    const result = website.normalizeSmokeWebsite({
      ...fixture.row,
      metadata: { title: 't'.repeat(2001) },
    }).json;
    expect(result.title).toHaveLength(2000);
    expect((result.payload.metadata as { title: string }).title).toBe(result.title);
  });
  it('does not split a Unicode surrogate pair at the title/caption truncation boundary', () => {
    const result = website.normalizeSmokeWebsite({
      ...fixture.row,
      markdown: `${'a'.repeat(7999)}😀`,
      metadata: { title: `${'t'.repeat(1999)}😀` },
    }).json;
    expect(result.caption).toBe('a'.repeat(7999));
    expect(result.title).toBe('t'.repeat(1999));
  });
  it.each([
    null,
    [],
    {},
    { url: 'https://everyone.film/page', markdown: 7 },
    { url: 'https://everyone.film/page', metadata: { title: [] } },
    { url: 'https://everyone.film/page', error: 'private-raw-error' },
  ])('rejects malformed actor data without reflecting values (%j)', (row) => {
    expect(() => website.normalizeSmokeWebsite(row)).toThrow('contract_drift: invalid website crawler row');
    try {
      website.normalizeSmokeWebsite(row);
    } catch (error) {
      expect((error as Error).message).not.toContain('private-raw-error');
    }
  });
  it.each([
    'file:///private',
    'javascript:alert(1)',
    'https://user:password@everyone.film/a',
    'https://@everyone.film/a',
    'https:everyone.film/a',
    'https:///everyone.film/a',
    'https://localhost/a',
    'https://127.0.0.1/a',
    'https://[::1]/a',
    'https://10.1.2.3/a',
    'https://0x7f000001/a',
    'https://private.internal/a',
    'https://a.local/a',
    'https://everyone.film:444/a',
    'https://everyone.film/a\\b',
    'https://everyone.film/a\nnext',
  ])('rejects unsafe/nonpublic lexical URL %s', (url) => {
    expect(() => website.normalizeSmokeWebsite({ url })).toThrow(
      'contract_drift: invalid website crawler row',
    );
  });
  it('loads without CommonJS globals and never silently replaces SHA256 with another hash', () => {
    const source = readFileSync(new URL('./smoke_website_stub.js', import.meta.url), 'utf8');
    const context = { URL };
    expect(() => runInNewContext(source, context)).not.toThrow();
    expect(() => runInNewContext(`normalizeSmokeWebsite(${JSON.stringify(fixture.row)})`, context)).toThrow(
      'sha256_unavailable',
    );
  });
  it.each(['access_token', 'API_KEY', 'password', 'signature', 'token', 'auth'])(
    'rejects credential query key%s before preparing the M03 public snapshot',
    (key) => {
      expect(() =>
        website.normalizeSmokeWebsite({
          ...fixture.row,
          url: `https://everyone.film/about-everyone?${key}=synthetic-local-value`,
        }),
      ).toThrow('contract_drift: invalid website crawler row');
    },
  );
  it.each([
    { crawl: { loadedUrl: 'https://everyone.film/about-everyone?token=synthetic-local-value' } },
    { crawl: { referrerUrl: 'https://everyone.film/?password=synthetic-local-value' } },
    { metadata: { canonicalUrl: 'https://everyone.film/about-everyone?api_key=synthetic-local-value' } },
  ])('rejects credential query keys in documented input URL fields %j', (fields) => {
    expect(() => website.normalizeSmokeWebsite({ ...fixture.row, ...fields })).toThrow(
      'contract_drift: invalid website crawler row',
    );
  });
  it.each(['client_secret', '%256bey', '%25256bey'])(
    'rejects additional bounded credential key encoding%s',
    (key) => {
      expect(() =>
        website.normalizeSmokeWebsite({
          ...fixture.row,
          url: `https://everyone.film/about-everyone?${key}=synthetic-local-value`,
        }),
      ).toThrow('contract_drift: invalid website crawler row');
    },
  );
});

describe('M03 pure ingestion group preparation', () => {
  it('uses the same query guard when canonical sources are composed without CommonJS globals', () => {
    const source =
      readFileSync(new URL('./smoke_website_stub.js', import.meta.url), 'utf8') +
      '\n' +
      readFileSync(new URL('./prepare_ingest_groups.js', import.meta.url), 'utf8');
    const unsafeGroup = group([
      { ...item(), url: 'https://everyone.film/?client_secret=synthetic-local-value' },
    ]);
    const result = runInNewContext(`${source}\nprepareIngestGroups(${JSON.stringify([unsafeGroup])});`, {
      URL,
    });
    expect(result[0]).toMatchObject({ status: 'failed', batches: [] });
  });
  it.each([0, 1, 500, 501, 1001])('prepares%d validitems in chunks no larger than500', (count) => {
    const rows = Array.from({ length: count }, (_, index) => ({ ...item(), external_id: String(index) }));
    const prepared = ingestion.prepareIngestGroups([group(rows)])[0]!;
    expect(prepared.items_seen).toBe(count);
    expect(prepared.items_dropped).toBe(0);
    expect(prepared.batches.flat()).toEqual(rows);
    expect(prepared.batches.every((batch) => batch.length <= 500)).toBe(true);
    expect(prepared.batches).toHaveLength(Math.ceil(count / 500));
  });
  it('accepts exactly20 percent drops, and isolates a group above20 percent without ingest batches', () => {
    const [boundary, drift] = ingestion.prepareIngestGroups([
      group([item(), item(), item(), item(), {}]),
      group([item(), item(), item(), {}, {}], { account_id: '4f1c9393-0545-44b2-80d9-bc77b526b3b8' }),
    ]);
    expect(boundary).toMatchObject({ status: 'success', items_seen: 5, items_dropped: 1 });
    expect(boundary!.batches.flat()).toHaveLength(4);
    expect(drift).toMatchObject({
      status: 'failed',
      items_seen: 5,
      items_dropped: 2,
      backfill_done: false,
      items: [],
      batches: [],
    });
    expect(drift!.error).toMatch(/^contract_drift:/);
  });
  it.each(['external_id', 'url', 'platform', 'actor', 'item_type', 'published_at', 'payload'])(
    'drops an item missing required%s',
    (field) => {
      const invalid: Record<string, unknown> = { ...item() };
      delete invalid[field];
      expect(ingestion.prepareIngestGroups([group([invalid])])[0]).toMatchObject({
        status: 'failed',
        items_dropped: 1,
        batches: [],
      });
    },
  );
  it.each([
    { platform: 'facebook' },
    { url: 'http://127.0.0.1/' },
    { url: 'https://@everyone.film/' },
    { url: 'https:everyone.film/' },
    { url: 'https://everyone.film/?client_secret=synthetic-local-value' },
    { url: 'https://everyone.film/?%256bey=synthetic-local-value' },
    { item_type: 'out_of_scope' },
    { caption: 7 },
    { payload: [] },
    { metrics: { plays: -1 } },
    { metrics: { secret: 1 } },
    { duration_seconds: 0.1 },
    { duration_seconds: 2147483648 },
    { published_at: 'not-a-date' },
    { published_at: '0000-01-01T00:00:00Z' },
    { published_at: '2026-01-01T00:00:00+20:00' },
    { published_at: '2026-01-01T00:00:00-14:01' },
    { hashtags: [1] },
    { unsupported_field: 'private-value' },
  ])('drops malformed normalized fields %j', (fields) => {
    expect(ingestion.prepareIngestGroups([group([{ ...item(), ...fields }])])[0]).toMatchObject({
      status: 'failed',
      items_dropped: 1,
      batches: [],
    });
  });
  it('preserves original inputs and backfill cursor, but never completes backfill for a failed group', () => {
    const original = group([item()], { backfill_done: true, backfill_cursor: { page: 2 } });
    const before = JSON.stringify(original);
    const [prepared] = ingestion.prepareIngestGroups([original]);
    expect(prepared).toMatchObject({ backfill_done: true, backfill_cursor: { page: 2 } });
    expect(JSON.stringify(original)).toBe(before);
    expect(
      ingestion.prepareIngestGroups([
        group([item()], { status: 'failed', error: 'source_failed', backfill_done: true }),
      ])[0],
    ).toMatchObject({ status: 'failed', error: 'source_failed', backfill_done: false, batches: [] });
  });
  it('does not ingest explicitly skipped groups or log arbitrary payload keys/values in drift errors', () => {
    expect(ingestion.prepareIngestGroups([group([item()], { status: 'skipped' })])[0]!.batches).toEqual([]);
    const prepared = ingestion.prepareIngestGroups([
      group([{ 'credential-looking-field': 'private-value' }]),
    ])[0]!;
    expect(prepared.error).not.toContain('credential');
    expect(prepared.error).not.toContain('private-value');
  });
  it('rejects duplicate accounts rather than scheduling two result writes for one account', () => {
    expect(() => ingestion.prepareIngestGroups([group([]), group([])])).toThrow('Invalid ingest groups');
  });
  it('drops non-JSON payloads before producing an unserializable RPC batch', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(ingestion.prepareIngestGroups([group([{ ...item(), payload: cyclic }])])[0]).toMatchObject({
      status: 'failed',
      batches: [],
    });
    expect(
      ingestion.prepareIngestGroups([group([{ ...item(), payload: { notJson: Number.NaN } }])])[0],
    ).toMatchObject({ status: 'failed', batches: [] });
  });
  it('validates calendar dates while accepting supported optional metrics and lists', () => {
    expect(
      ingestion.prepareIngestGroups([group([{ ...item(), published_at: '2026-02-31T10:00:00Z' }])])[0],
    ).toMatchObject({ status: 'failed', batches: [] });
    const valid = {
      ...item(),
      published_at: '2024-02-29T10:00:00+02:00',
      metrics: { plays: 0, views: null },
      duration_seconds: 0,
      hashtags: ['film'],
      mentions: [],
      tagged_accounts: [],
      media_urls: [],
    };
    expect(ingestion.prepareIngestGroups([group([valid])])[0]!.batches).toEqual([[valid]]);
  });
  it.each([
    null,
    {},
    [group([], { account_id: 'not-uuid' })],
    [group([], { status: 'unknown' })],
    [group([], { backfill_cursor: [] })],
    [group([], { items: 'not-array' })],
  ])('rejects malformed group envelope before producing RPC work (%j)', (value) => {
    expect(() => ingestion.prepareIngestGroups(value)).toThrow('Invalid ingest groups');
  });
});

describe('canonical n8n common helpers', () => {
  it('also loads without CommonJS globals for pasting into a Code node', () => {
    const source = readFileSync(new URL('./_common.js', import.meta.url), 'utf8');

    expect(() => runInNewContext(source, {})).not.toThrow();
  });

  it('loads the complete helper set', () => {
    expect(Object.keys(common).sort()).toEqual([
      'ats',
      'hms',
      'int',
      'iso',
      'isoDur',
      'lc',
      'noAt',
      'tags',
      'trim8k',
    ]);
  });

  it.each([1700000000, 1700000000000, '2023-11-14T22:13:20Z'])(
    'normalizes supported timestamp input %j',
    (value) => {
      expect(common.iso(value)).toBe('2023-11-14T22:13:20.000Z');
    },
  );

  it.each([null, undefined, '', 'not-a-date'])('returns null for unavailable or invalid date %j', (value) => {
    expect(common.iso(value)).toBeNull();
  });

  it('accepts the Unix epoch instead of treating zero as a missing date', () => {
    expect(common.iso(0)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('normalizes handles and strips repeated leading at signs', () => {
    expect(common.noAt('@Foo')).toBe('foo');
    expect(common.noAt('  @@Everyone.Film  ')).toBe('everyone.film');
    expect(common.noAt(null)).toBe('');
  });

  it('normalizes and deduplicates Latin and Arabic hashtags in first-seen order', () => {
    expect(common.tags('#Ramadan')).toEqual(['ramadan']);
    expect(common.tags('#Ramadan #رمضان #RAMADAN #film_2026')).toEqual(['ramadan', 'رمضان', 'film_2026']);
    expect(common.tags(undefined)).toEqual([]);
  });

  it('normalizes and deduplicates mentions', () => {
    expect(common.ats('By @Foo and @everyone.film with @FOO')).toEqual(['foo', 'everyone.film']);
  });

  it('rounds available non-negative metric counts and keeps missing values null', () => {
    expect(common.int('3.7')).toBe(4);
    expect(common.int(0)).toBe(0);
    expect(common.int(-1)).toBeNull();
    expect(common.int(null)).toBeNull();
  });

  it('converts supported duration formats to seconds', () => {
    expect(common.isoDur('P1DT2H3M4S')).toBe(93784);
    expect(common.hms('1:02:03')).toBe(3723);
    expect(common.isoDur('not-a-duration')).toBeNull();
    expect(common.hms('')).toBeNull();
  });

  it('caps captions at the documented 8000-character limit', () => {
    expect(common.trim8k('a'.repeat(8001))).toHaveLength(8000);
    expect(common.trim8k(null)).toBe('');
  });
});
