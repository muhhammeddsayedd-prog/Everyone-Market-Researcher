import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const real = JSON.parse(
  readFileSync(
    new URL('./fixtures/instagram-stories-data-slayer/real-capture-20261029.json', import.meta.url),
    'utf8',
  ),
);
const accounts = [
  {
    id: '7c70141b-bb1e-4d0b-a54c-f957413400e1',
    competitor_id: '94928d31-8983-403c-bdbd-f5f44613d631',
    platform: 'instagram_stories',
    handle: 'everyone.film',
  },
  {
    id: '62a5fef9-78c3-418a-9010-d5ea54f29e45',
    competitor_id: '9a0dba8a-b946-45a1-bd53-933216f1fc4d',
    platform: 'instagram_stories',
    handle: 'goodpeoplefilms',
  },
  {
    id: '34b95d90-12e6-42da-84f8-3fd78cd19103',
    competitor_id: '7ba084a1-52a1-49d5-b3a9-e488289cb504',
    platform: 'instagram_stories',
    handle: 'bigfootfilms',
  },
];
const { prepareStoriesDataSlayerResults: prepare } = require('./storiesDataSlayer.js');
const { prepareIngestGroups } = require('./prepare_ingest_groups.js');
const Ajv = createRequire(require.resolve('eslint/package.json'))('ajv');
const ingestSchema = JSON.parse(
  readFileSync(new URL('../../reference/n8n/normalized_item.schema.json', import.meta.url), 'utf8'),
);
delete ingestSchema.$schema;
const validIngest = new Ajv({ allErrors: true }).compile(ingestSchema);
const context = { accounts, now: real.provenance.finishedAt };
const igviewReal = JSON.parse(
  readFileSync(
    new URL('./fixtures/instagram-stories-igview/real-capture-20261029.json', import.meta.url),
    'utf8',
  ),
);
const { prepareStoriesIgviewResults: prepareIgview } = require('./storiesIgview.js');
const louisReal = JSON.parse(
  readFileSync(
    new URL('./fixtures/instagram-stories-louisdeconinck/real-capture-20261029.json', import.meta.url),
    'utf8',
  ),
);
const { prepareStoriesLouisdeconinckResults: prepareLouis } = require('./storiesLouisdeconinck.js');
describe('Data Slayer build1.0.32 real public capture T1A54M5kriDsFKnVM', () => {
  it('preserves real provenance and attributes twelve stories plus two explicit empty results', () => {
    expect(real.provenance).toMatchObject({
      kind: 'sanitized_real_actor_capture',
      actor: 'data-slayer/instagram-stories-scraper',
      runId: 'T1A54M5kriDsFKnVM',
      buildId: 'LbkXerigrUUa2dxt6',
      usageTotalUsd: 0.03088,
    });
    const before = structuredClone(real);
    const result = prepare(real.rows, context);
    expect(real).toEqual(before);
    expect(result.errors).toEqual([]);
    expect(result.unmatched_count).toBe(0);
    expect(
      result.groups.map((g: { status: string; items: unknown[] }) => [g.status, g.items.length]),
    ).toEqual([
      ['success', 0],
      ['success', 12],
      ['success', 0],
    ]);
    expect(result.coverage_complete).toBe(false);
  });
  it('retains observed nested mention handles without copying mentioned profiles', () => {
    const result = prepare(real.rows, context);
    const first = result.groups[1].items[0];
    expect(first.external_id).toBe('4017811773010771928');
    expect(first.mentions).toContain('theseify');
    expect(first.mentions).toContain('impactbbdo');
    expect(first.mentions).toHaveLength(16);
    expect(first.metrics).toEqual({});
    expect(first.media_urls).toEqual([]);
    expect(first.payload.mentions).toEqual(first.mentions);
    expect(first.payload).not.toHaveProperty('reel_mentions');
  });
  it('qualifies every actual story against the existing ingest schema without dropping source records', () => {
    const result = prepare(real.rows, context);
    const group = result.groups[1];
    expect(group.items).toHaveLength(12);
    for (const item of group.items) {
      expect(validIngest(item), JSON.stringify(validIngest.errors)).toBe(true);
      expect(typeof item.external_id).toBe('string');
      expect(item.platform).toBe('instagram_stories');
      expect(item.item_type).toBe('story');
    }
    const prepared = prepareIngestGroups([{ account_id: accounts[1]!.id, items: group.items }]);
    expect(prepared[0]).toMatchObject({ account_id: accounts[1]!.id, items_dropped: 0 });
    expect(prepared[0].items).toHaveLength(12);
  });
  it('uses the actual image_versions.items shape when its top-level thumbnail is unavailable', () => {
    const row = structuredClone(
      real.rows.find((r: Record<string, unknown>) => r.id === '4017811773010771928'),
    );
    delete row.thumbnail_url;
    const result = prepare([row], { ...context, accounts: [accounts[1]] });
    expect(result.groups[0].items[0].thumbnail_url).toBe(row.image_versions.items[0].url);
  });
  it('does not borrow summary username for a story with missing authoritative creator identity', () => {
    const row = structuredClone(
      real.rows.find((r: Record<string, unknown>) => r.id === '4017811773010771928'),
    );
    delete row.creator_username;
    row.username = 'goodpeoplefilms';
    const result = prepare([row], { ...context, accounts: [accounts[1]] });
    expect(result.groups[0]).toMatchObject({ status: 'failed', items: [] });
  });
  it('keeps provider errors distinct from the observed no_active_stories summary', () => {
    const empty = structuredClone(real.rows[0]);
    empty.error = 'upstream_request_failed';
    expect(prepare([empty], { ...context, accounts: [accounts[0]] }).groups[0]).toMatchObject({
      status: 'failed',
      items: [],
    });
    empty.error = 'checkpoint_required';
    expect(prepare([empty], { ...context, accounts: [accounts[0]] }).groups[0].error).toBe(
      'stories_private_or_login',
    );
  });
  it('executes the same actual fixture in serialized Cloud Code without imports or URL globals', () => {
    const source = ['_common.js', '_stories.js', 'storiesDataSlayer.js']
      .map((file) => readFileSync(new URL('./' + file, import.meta.url), 'utf8'))
      .join('\n');
    const result = runInNewContext(
      source + `\nprepareStoriesDataSlayerResults(${JSON.stringify(real.rows)},${JSON.stringify(context)});`,
      { URL: undefined },
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(prepare(real.rows, context));
  });
});

describe('igview build1.0.16 real public capture b2ORwCMqJZ7z8Ywri', () => {
  const ctx = { accounts, now: igviewReal.provenance.finishedAt };
  it('qualifies current camelCase stories and exact successful none summaries', () => {
    expect(igviewReal.provenance).toMatchObject({
      kind: 'sanitized_real_actor_capture',
      runId: 'b2ORwCMqJZ7z8Ywri',
      buildId: 'jhZNplLsVKuGelTTm',
      usageTotalUsd: 0.19,
    });
    const before = structuredClone(igviewReal);
    const result = prepareIgview(igviewReal.rows, ctx);
    expect(igviewReal).toEqual(before);
    expect(result.errors).toEqual([]);
    expect(result.unmatched_count).toBe(0);
    expect(
      result.groups.map((g: { status: string; items: unknown[] }) => [g.status, g.items.length]),
    ).toEqual([
      ['success', 0],
      ['success', 12],
      ['success', 0],
    ]);
    expect(result.groups[1].items[0]).toMatchObject({
      external_id: '4017811773010771928',
      published_at: '2026-10-28T09:41:47.000Z',
      platform: 'instagram_stories',
      metrics: {},
      media_urls: [],
    });
    expect(result.groups[1].items[0].mentions).toHaveLength(16);
    expect(result.groups[1].items[0].mentions).toContain('impactbbdo');
    for (const item of result.groups[1].items)
      expect(validIngest(item), JSON.stringify(validIngest.errors)).toBe(true);
  });
  it('matches all twelve numeric story keys to the independently captured Data Slayer results', () => {
    const one = prepare(real.rows, context),
      two = prepareIgview(igviewReal.rows, ctx);
    expect(two.groups[1].bakeoff_rows.map((r: { story_key: string }) => r.story_key).sort()).toEqual(
      one.groups[1].bakeoff_rows.map((r: { story_key: string }) => r.story_key).sort(),
    );
  });
  it('requires source success for the observed none result and never treats errors/private rows as empty', () => {
    for (const extra of [
      { success: false },
      { success: 'true' },
      { isPrivate: true },
      { error: 'upstream_request_failed' },
      { error: 'checkpoint_required' },
    ]) {
      const row = { ...igviewReal.rows[0], ...extra };
      const group = prepareIgview([row], { ...ctx, accounts: [accounts[0]] }).groups[0];
      expect(group).toMatchObject({ status: 'failed', items: [] });
    }
    expect(prepareIgview([], { ...ctx, accounts: [accounts[0]] }).groups[0]).toMatchObject({
      status: 'failed',
      items: [],
    });
  });
  it('rejects contradictory numeric ID aliases and timestamps in mixed-version output', () => {
    const base = igviewReal.rows.find((r: Record<string, unknown>) => r.storyId === '4017811773010771928');
    for (const extra of [{ story_id: '4017811773010771929' }, { taken_at_date: '2026-10-27T09:41:47Z' }])
      expect(
        prepareIgview([{ ...base, ...extra }], { ...ctx, accounts: [accounts[1]] }).groups[0].status,
      ).toBe('failed');
  });
  it('uses current allImages fallback and drops video/profile payload fields', () => {
    const row = structuredClone(
      igviewReal.rows.find((r: Record<string, unknown>) => r.storyId === '4017811773010771928'),
    );
    delete row.imageUrl;
    row.videoUrl = 'https://instagram.fsjk2-1.fna.fbcdn.net/video.mp4';
    const item = prepareIgview([row], { ...ctx, accounts: [accounts[1]] }).groups[0].items[0];
    expect(item.thumbnail_url).toBe(row.allImages[0].url);
    expect(item.payload).not.toHaveProperty('allImages');
    expect(item.payload).not.toHaveProperty('videoUrl');
    expect(item.media_urls).toEqual([]);
  });
  it('runs current fixtures through serialized native Code without Node imports', () => {
    const source = ['_common.js', '_stories.js', 'storiesIgview.js']
      .map((file) => readFileSync(new URL('./' + file, import.meta.url), 'utf8'))
      .join('\n');
    const result = runInNewContext(
      source + `\nprepareStoriesIgviewResults(${JSON.stringify(igviewReal.rows)},${JSON.stringify(ctx)});`,
      { URL: undefined },
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(prepareIgview(igviewReal.rows, ctx));
  });
});

describe('Louis build0.0.10 real public capture a6QclwQACLHDrgGcI', () => {
  const ctx = { accounts, now: louisReal.provenance.finishedAt };
  it('uses the exact string media id and preserves missing account evidence as unknown failures', () => {
    expect(louisReal.provenance).toMatchObject({
      kind: 'sanitized_real_actor_capture',
      runId: 'a6QclwQACLHDrgGcI',
      buildId: '4QpIiw2A9YDJ2aneN',
      usageTotalUsd: 0.109,
    });
    const before = structuredClone(louisReal),
      result = prepareLouis(louisReal.rows, ctx);
    expect(louisReal).toEqual(before);
    expect(
      result.groups.map((g: { status: string; items: unknown[] }) => [g.status, g.items.length]),
    ).toEqual([
      ['failed', 0],
      ['success', 12],
      ['failed', 0],
    ]);
    expect(result.groups[0].error).toBe('stories_no_account_evidence');
    expect(result.groups[2].error).toBe('stories_no_account_evidence');
    expect(result.unmatched_count).toBe(0);
    expect(result.groups[1].items[0]).toMatchObject({
      external_id: '4017811773010771928',
      published_at: '2026-10-28T09:41:47.000Z',
    });
    expect(result.groups[1].bakeoff_rows[0]).toMatchObject({
      story_key: '4017811773010771928',
      raw_id: '4017811773010771928_2882260693',
    });
    expect(result.limitations).toContain('unsafe_numeric_pk_alias_ignored_for_exact_string_id');
    expect(result.groups[1].items[0].payload).not.toHaveProperty('pk');
  });
  it('qualifies all twelve exact cross-actor identities and canonical ingest fields', () => {
    const result = prepareLouis(louisReal.rows, ctx),
      known = prepare(real.rows, context);
    expect(result.groups[1].bakeoff_rows.map((r: { story_key: string }) => r.story_key).sort()).toEqual(
      known.groups[1].bakeoff_rows.map((r: { story_key: string }) => r.story_key).sort(),
    );
    expect(result.groups[1].items[0].mentions).toHaveLength(16);
    for (const item of result.groups[1].items)
      expect(validIngest(item), JSON.stringify(validIngest.errors)).toBe(true);
  });
  it('never repairs a conflicting PK bucket or a missing/unsafe string id', () => {
    const row = louisReal.rows[0];
    for (const change of [
      { id: undefined },
      { id: 4017811773010772000 },
      { pk: 4017811773010772500 },
      { pk: '4017811773010772000' },
      { id: 'another_code' },
      { pk: Infinity },
    ]) {
      const result = prepareLouis([{ ...row, ...change }], { ...ctx, accounts: [accounts[1]] });
      expect(result.groups[0]).toMatchObject({ status: 'failed', items: [] });
    }
  });
  it('executes the same capture projection in serialized Cloud Code without coercing numeric media identity', () => {
    const source = ['_common.js', '_stories.js', 'storiesLouisdeconinck.js']
      .map((file) => readFileSync(new URL('./' + file, import.meta.url), 'utf8'))
      .join('\n');
    const result = runInNewContext(
      source +
        `\nprepareStoriesLouisdeconinckResults(${JSON.stringify(louisReal.rows)},${JSON.stringify(ctx)});`,
      { URL: undefined },
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(prepareLouis(louisReal.rows, ctx));
  });
});
