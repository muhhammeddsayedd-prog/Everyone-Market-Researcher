import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

type Row = Record<string, unknown>;
type Item = {
  platform: string;
  actor: string;
  external_id: string;
  item_type: string;
  url: string;
  published_at: string;
  title: string | null;
  caption: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  metrics: Record<string, number | null>;
  payload: Row;
};
type Fixture = {
  provenance: {
    kind: string;
    environment: string;
    project_ref: string;
    observed_at: string;
    source_query_sha256: string;
    actor: string;
    parent_run_id: string;
    projection_note: string;
    limitations: string[];
  };
  accounts: { id: string; handle: string; platform: string; company_code: string }[];
  samples: { account_id: string; external_id: string; raw_metadata: Row }[];
};
type Group = { account_id: string; status: string; items: Item[] };
const require = createRequire(import.meta.url);
const { normalizeVimeoApiResult } = require('./vimeoApi.js') as {
  normalizeVimeoApiResult: (rows: Row[], context: Row) => { items: Item[]; errors: Row[] };
};
const { normalizeInstagramScraper, prepareInstagramResults } = require('./instagramScraper.js') as {
  normalizeInstagramScraper: (rows: Row[], context: Row) => Item[];
  prepareInstagramResults: (
    rows: Row[],
    context: Row,
  ) => { groups: Group[]; errors: Row[]; unmatched: { count: number } };
};
const { prepareIngestGroups } = require('./prepare_ingest_groups.js') as {
  prepareIngestGroups: (groups: Group[]) => (Group & { items_dropped: number })[];
};
// Reuse the already-locked AJV6 for this schema's shared draft7 keywords only.
const Ajv = createRequire(require.resolve('eslint/package.json'))('ajv');
const schema = JSON.parse(
  readFileSync(new URL('../../reference/n8n/normalized_item.schema.json', import.meta.url), 'utf8'),
);
delete schema.$schema;
const schemaValid = new Ajv({ allErrors: true }).compile(schema);
const fixture = (folder: string): Fixture =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/${folder}/actual-dev-public-projection-20261027.json`, import.meta.url),
      'utf8',
    ),
  );
const vimeo = fixture('vimeo-api');
const instagram = fixture('instagram-scraper');

describe('M04 actual persisted public metadata projections — local contract replay only', () => {
  it('retains bounded source provenance and minimizes captions and URL fields', () => {
    for (const source of [vimeo, instagram]) {
      expect(source.provenance).toMatchObject({
        kind: 'actual_raw_metadata_projection',
        environment: 'dev',
        project_ref: 'zmotjsbzhzjvpelxvxlf',
        observed_at: '2026-10-27T13:51:48.4054960Z',
        source_query_sha256: '62860b8efc35ccf767e2f53b76f677643d5a96b1a5ffc5e873ce5e1cfc3545a7',
      });
      expect(source.provenance.parent_run_id).toMatch(/^[a-f0-9-]{36}$/);
      expect(source.provenance.projection_note).toContain('not a full');
      expect(source.provenance.limitations.length).toBeGreaterThan(0);
      expect(source.samples).toHaveLength(4);
      expect(source.accounts.map(({ company_code }) => company_code)).toEqual(['C000', 'C001']);
      expect(new Set(source.samples.map(({ account_id }) => account_id)).size).toBe(2);
      for (const { raw_metadata: row } of source.samples) {
        expect(row).not.toHaveProperty('displayUrl');
        expect(row).not.toHaveProperty('description');
        expect(row).not.toHaveProperty('mentions');
        expect(row).not.toHaveProperty('videoUrl');
        expect(row).not.toHaveProperty('download');
        for (const value of Object.values(row)) {
          if (typeof value === 'string' && value.startsWith('https://')) {
            const url = new URL(value);
            expect(['vimeo.com', 'www.instagram.com']).toContain(url.hostname);
            expect(url.search + url.hash + url.username + url.password).toBe('');
          }
        }
        if (typeof row.caption === 'string') {
          expect(row.caption.length).toBeLessThanOrEqual(80);
          expect(row.caption).not.toMatch(/@|https?:|\r|\n/);
        }
      }
    }
  });

  it('normalizes official Vimeo API fields from both actual account contexts into valid ingest groups', () => {
    const groups = vimeo.accounts.map((account) => {
      const samples = vimeo.samples.filter(({ account_id }) => account_id === account.id);
      const result = normalizeVimeoApiResult(
        samples.map(({ raw_metadata }) => raw_metadata),
        { account, cutoff: '2024-01-01T00:00:00.000Z' },
      );
      expect(result.errors).toEqual([]);
      expect(result.items).toHaveLength(2);
      result.items.forEach((item, index) => {
        const sample = samples[index];
        if (!sample) throw new Error('Actual Vimeo item has no matching projected sample');
        expect(schemaValid(item), JSON.stringify(schemaValid.errors)).toBe(true);
        expect(item).toMatchObject({
          platform: 'vimeo',
          actor: 'vimeo-api',
          item_type: 'video',
          external_id: sample.external_id,
          url: sample.raw_metadata.link,
          title: sample.raw_metadata.name,
          duration_seconds: sample.raw_metadata.duration,
          published_at: new Date(String(sample.raw_metadata.release_time)).toISOString(),
        });
        // These fields are absent from this projection, not proven absent at Vimeo.
        expect(item.thumbnail_url).toBeNull();
        expect(item.metrics).toEqual({ plays: null, likes: null, comments: null });
      });
      return { account_id: account.id, status: 'success', items: result.items };
    });
    const prepared = prepareIngestGroups(groups);
    expect(
      prepared.map(({ account_id, status, items_dropped }) => ({ account_id, status, items_dropped })),
    ).toEqual(vimeo.accounts.map(({ id }) => ({ account_id: id, status: 'success', items_dropped: 0 })));
    expect(prepared.flatMap(({ items }) => items)).toHaveLength(4);
  });

  it('maps the actual Instagram Video/clips and Sidecar cases without fabricating omitted media metadata', () => {
    const items = normalizeInstagramScraper(
      instagram.samples.map(({ raw_metadata }) => raw_metadata),
      { result_type: 'posts' },
    );
    expect(items.map(({ item_type }) => item_type)).toEqual(['reel', 'carousel', 'reel', 'reel']);
    items.forEach((item, index) => {
      const sample = instagram.samples[index];
      if (!sample) throw new Error('Actual Instagram item has no matching projected sample');
      expect(schemaValid(item), JSON.stringify(schemaValid.errors)).toBe(true);
      expect(item).toMatchObject({
        platform: 'instagram',
        actor: 'apify/instagram-scraper',
        external_id: sample.external_id,
        url: sample.raw_metadata.url,
        published_at: sample.raw_metadata.timestamp,
        caption: sample.raw_metadata.caption,
        metrics: {
          likes: sample.raw_metadata.likesCount,
          comments: sample.raw_metadata.commentsCount,
          views: sample.raw_metadata.videoPlayCount ?? null,
          shares: null,
        },
      });
      expect(item.thumbnail_url).toBeNull();
      expect(item.duration_seconds).toBeNull();
    });
    expect(items[3]?.caption).toBe('');
  });

  it('assigns the mixed actual Instagram owners to the two exact selected account IDs', () => {
    // Partial fixtures are not evidence of exhausted provider history. Only the
    // ownership/items projection is asserted, never its backfill flags or costs.
    const result = prepareInstagramResults(
      [...instagram.samples].reverse().map(({ raw_metadata }) => raw_metadata),
      { accounts: instagram.accounts, mode: 'backfill', result_type: 'posts', resultsLimit: 5 },
    );
    expect(result.errors).toEqual([]);
    expect(result.unmatched.count).toBe(0);
    for (const group of result.groups) {
      expect(group.status).toBe('success');
      expect(group.items.map(({ external_id }) => external_id).sort()).toEqual(
        instagram.samples
          .filter(({ account_id }) => account_id === group.account_id)
          .map(({ external_id }) => external_id)
          .sort(),
      );
    }
    const prepared = prepareIngestGroups(result.groups);
    expect(prepared.every(({ status, items_dropped }) => status === 'success' && items_dropped === 0)).toBe(
      true,
    );
    expect(prepared.flatMap(({ items }) => items)).toHaveLength(4);
  });

  it('keeps stable IDs/permalinks for these observed rows across posts and reels normalization', () => {
    const rows = instagram.samples.map(({ raw_metadata }) => raw_metadata);
    const identity = (result_type: string) =>
      normalizeInstagramScraper(rows, { result_type }).map(({ external_id, url, item_type }) => ({
        external_id,
        url,
        item_type,
      }));
    expect(identity('posts')).toEqual(identity('reels'));
    // This is a local normalization assertion, not a callback/DB replay receipt.
  });
});
