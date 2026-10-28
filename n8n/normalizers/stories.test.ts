import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
type Row = Record<string, unknown>;
type Prepared = {
  groups: { account_id: string; status: string; error: string | null; items: Row[]; bakeoff_rows: Row[] }[];
  errors: Row[];
  unmatched_count: number;
  coverage_complete: boolean;
  limitations: string[];
};
type Adapter = { name: string; file: string; normalize: string; prepare: string };
function first<T>(values: readonly T[]): T {
  expect(values).not.toHaveLength(0);
  const value = values[0];
  if (value === undefined) throw new Error('Expected a first test result');
  return value;
}
const adapters: Adapter[] = [
  {
    name: 'data-slayer',
    file: 'storiesDataSlayer',
    normalize: 'normalizeStoriesDataSlayer',
    prepare: 'prepareStoriesDataSlayerResults',
  },
  {
    name: 'igview',
    file: 'storiesIgview',
    normalize: 'normalizeStoriesIgview',
    prepare: 'prepareStoriesIgviewResults',
  },
  {
    name: 'louisdeconinck',
    file: 'storiesLouisdeconinck',
    normalize: 'normalizeStoriesLouisdeconinck',
    prepare: 'prepareStoriesLouisdeconinckResults',
  },
];
const now = '2026-10-28T12:00:00.000Z';
const account = (n = 1) => ({
  id: `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  competitor_id: '80000000-0000-4000-8000-000000000001',
  platform: 'instagram_stories',
  handle: n === 1 ? '@Synthetic_Studio' : 'synthetic_empty',
});
const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/instagram-stories-${name}/synthetic-contract.json`, import.meta.url),
      'utf8',
    ),
  );
const { prepareIngestGroups } = require('./prepare_ingest_groups.js');
const Ajv = createRequire(require.resolve('eslint/package.json'))('ajv');
const schema = JSON.parse(
  readFileSync(new URL('../../reference/n8n/normalized_item.schema.json', import.meta.url), 'utf8'),
);
delete schema.$schema;
const schemaValid = new Ajv({ allErrors: true }).compile(schema);

describe.each(adapters)('$name story adapter — synthetic local contracts only', (adapter) => {
  const api = require(`./${adapter.file}.js`);
  const prepare = (rows: unknown[], overrides = {}) =>
    api[adapter.prepare](rows, { accounts: [account(), account(2)], now, ...overrides }) as Prepared;
  const story = () => structuredClone(fixture(adapter.name).rows[0]);

  it('labels fixtures and yields canonical owned story items plus explicit empty summary', () => {
    const f = fixture(adapter.name);
    expect(f.fixtureProvenance.actualActorCapture).toBe(false);
    const input = structuredClone(f.rows),
      result = prepare(input);
    expect(input).toEqual(f.rows);
    expect(result.unmatched_count).toBe(0);
    expect(result.coverage_complete).toBe(false);
    expect(result.groups.map((g) => [g.status, g.items.length])).toEqual([
      ['success', 1],
      ['success', 0],
    ]);
    const group = first(result.groups);
    const item = first(group.items);
    expect(item).toMatchObject({
      platform: 'instagram_stories',
      item_type: 'story',
      external_id: '3773069825095106469',
      published_at: '2026-10-28T10:30:00.000Z',
      metrics: {},
      media_urls: [],
    });
    expect(schemaValid(item), JSON.stringify(schemaValid.errors)).toBe(true);
    expect(prepareIngestGroups([{ account_id: account().id, items: [item] }])[0]).toMatchObject({
      items_dropped: 0,
      items: [item],
    });
    expect(first(group.bakeoff_rows)).toMatchObject({
      account_id: account().id,
      story_key: '3773069825095106469',
      taken_at: '2026-10-28T10:30:00.000Z',
      has_thumbnail: true,
    });
  });
  it('never stores profile/private/video fields or invented story metrics', () => {
    const row = story();
    row.user_info = {
      username: 'synthetic_studio',
      about: 'not retained',
      email: 'not-retained',
      profile_pic_url: 'https://irrelevant.invalid/x',
    };
    row.video_url = 'https://scontent.cdninstagram.com/video.mp4';
    row.video_versions = [{ url: 'https://scontent.cdninstagram.com/video.mp4' }];
    row.views = 999;
    const item = first(first(prepare([row], { accounts: [account()] }).groups).items);
    expect(item.metrics).toEqual({});
    expect(item.media_urls).toEqual([]);
    expect(JSON.stringify(item.payload)).not.toMatch(
      /about|email|profile_pic|video_url|video_versions|not-retained|views/,
    );
  });
  it('fails closed for unregistered owners and missing account evidence', () => {
    const unknown = story();
    unknown.creator_username = 'foreign';
    unknown.username = 'foreign';
    unknown.user = { username: 'foreign' };
    const result = prepare([unknown]);
    expect(result.unmatched_count).toBe(1);
    expect(result.groups.every((g) => g.status === 'failed' && g.items.length === 0)).toBe(true);
    expect(prepare([]).groups.every((g) => g.status === 'failed')).toBe(true);
  });
  it('does not borrow a full-profile alias when the documented source owner field is missing', () => {
    const missing = story();
    delete missing.creator_username;
    delete missing.username;
    delete missing.user;
    missing.user_info = { username: 'synthetic_studio' };
    const result = prepare([missing], { accounts: [account()] });
    expect(result.unmatched_count).toBe(1);
    expect(first(result.groups)).toMatchObject({ status: 'failed', items: [] });
  });
  it.each(['login_required', 'checkpoint', 'challenge', 'captcha', 'private'])(
    'does not turn %s into a no-stories success',
    (error) => {
      const row = story();
      row.error = error;
      row.status = 'no_stories';
      row.stories_count = 0;
      const group = first(prepare([row], { accounts: [account()] }).groups);
      expect(group.status).toBe('failed');
      expect(group.items).toEqual([]);
      expect(group.error).toBe('stories_private_or_login');
    },
  );
  it('rejects future/invalid timestamps and unsafe numeric identities', () => {
    const row = story();
    for (const bad of [0, -1, Infinity, 1835344800, 'not-a-date']) {
      const candidate = { ...row, taken_at_ts: bad, taken_at: bad, taken_at_date: undefined };
      expect(first(prepare([candidate], { accounts: [account()] }).groups).status).toBe('failed');
    }
    const unsafe = {
      ...row,
      id: 3773069825095106469,
      story_id: 3773069825095106469,
      pk: 3773069825095106469,
    };
    expect(first(prepare([unsafe], { accounts: [account()] }).groups).status).toBe('failed');
  });
  it('rejects conflicting aliases, permalink ownership and false empty summaries', () => {
    const row = story();
    const timestamp = { ...row, taken_at_date: '2026-10-27T10:30:00Z' };
    expect(first(prepare([timestamp], { accounts: [account()] }).groups).status).toBe('failed');
    expect(
      first(
        prepare(
          [{ ...row, story_permalink: 'https://www.instagram.com/stories/foreign/3773069825095106469/' }],
          { accounts: [account()] },
        ).groups,
      ).status,
    ).toBe('failed');
    const summary = { ...fixture(adapter.name).rows[1], status: 'unknown' };
    expect(first(prepare([summary], { accounts: [account(2)] }).groups).status).toBe('failed');
  });
  it('keeps batch order and deduplicates identical rows but rejects conflicting content', () => {
    const row = story();
    const result = prepare([row, structuredClone(row)], { accounts: [account()] });
    expect(first(result.groups).items).toHaveLength(1);
    const changed = { ...row, caption_text: 'different', caption: 'different' };
    expect(first(prepare([row, changed], { accounts: [account()] }).groups)).toMatchObject({
      status: 'failed',
      items: [],
    });
  });
  it('uses only safe public thumbnail hosts and preserves null when absent', () => {
    const row = story();
    for (const bad of [
      'http://cdninstagram.com/x.jpg',
      'https://127.0.0.1/x.jpg',
      'https://cdninstagram.com.attacker.invalid/x.jpg',
      'https://u:p@cdninstagram.com/x.jpg',
      'https://cdninstagram.com/x.jpg?access_token=no',
    ]) {
      const candidate = {
        ...row,
        thumbnail_url: bad,
        image_thumbnail: bad,
        image_url: bad,
        image_versions: [{ url: bad }],
        image_versions2: { candidates: [{ url: bad }] },
      };
      const item = first(first(prepare([candidate], { accounts: [account()] }).groups).items);
      expect(item.thumbnail_url).toBeNull();
    }
  });
  it('validates registered identities and deterministic explicit reference time', () => {
    for (const accounts of [
      [{ ...account(), platform: 'instagram' }],
      [account(), account()],
      [{ ...account(), id: 'invalid' }],
      [{ ...account(), handle: '../bad' }],
      [{ ...account(), handle_norm: 'foreign' }],
      [{ ...account(), url: 'https://www.instagram.com/foreign/' }],
    ])
      expect(() => prepare([], { accounts })).toThrow('stories_accounts_invalid');
    expect(() => prepare([], { now: '2026-02-30T12:00:00Z' })).toThrow('stories_context_invalid');
    expect(() => prepare([], { now: undefined })).toThrow('stories_context_invalid');
  });
  it('rejects numeric-PK alias conflicts and credential-bearing rows', () => {
    const row = story();
    const conflicting = {
      ...row,
      id: '1111111111111111111',
      pk: '2222222222222222222',
      story_id: '3333333333333333333',
    };
    // Data-slayer and igview have one documented ID field; conflicting public
    // permalink must still reject it. Louis additionally compares pk/id.
    conflicting.story_permalink = 'https://www.instagram.com/stories/synthetic_studio/9999999999999999999/';
    expect(first(prepare([conflicting], { accounts: [account()] }).groups).status).toBe('failed');
    expect(
      first(
        prepare([{ ...row, initialCookies: [{ name: 'sessionid', value: 'synthetic-never-retained' }] }], {
          accounts: [account()],
        }).groups,
      ),
    ).toMatchObject({ status: 'failed', items: [], error: 'stories_private_or_login' });
  });
  it('rejects contradictory empty evidence, unknown source status and unsafe timestamp rollovers', () => {
    const row = story();
    expect(
      first(
        prepare(
          [
            row,
            {
              ...fixture(adapter.name).rows[1],
              creator_username: 'synthetic_studio',
              username: 'synthetic_studio',
              user: { username: 'synthetic_studio' },
            },
          ],
          { accounts: [account()] },
        ).groups,
      ),
    ).toMatchObject({ status: 'failed', items: [] });
    expect(first(prepare([{ ...row, status: 'unavailable' }], { accounts: [account()] }).groups).status).toBe(
      'failed',
    );
    expect(
      first(
        prepare(
          [{ ...row, taken_at_ts: undefined, taken_at: undefined, taken_at_date: '2026-02-30T10:30:00Z' }],
          { accounts: [account()] },
        ).groups,
      ).status,
    ).toBe('failed');
  });
  it('composes with canonical common helpers in an n8n Code sandbox without imports/URL', () => {
    const source = ['_common.js', '_stories.js', `${adapter.file}.js`]
      .map((file) => readFileSync(new URL('./' + file, import.meta.url), 'utf8'))
      .join('\n');
    const rows = fixture(adapter.name).rows,
      ctx = { accounts: [account(), account(2)], now };
    const actual = runInNewContext(
      source + `\n${adapter.prepare}(${JSON.stringify(rows)},${JSON.stringify(ctx)});`,
      { URL: undefined },
    );
    expect(JSON.parse(JSON.stringify(actual))).toEqual(prepare(rows));
  });
});

it('derives the same string-safe numeric story key across all three actors', () => {
  const keys = adapters.map(
    (a) =>
      require(`./${a.file}.js`)[a.prepare](fixture(a.name).rows, { accounts: [account(), account(2)], now })
        .groups[0].bakeoff_rows[0].story_key,
  );
  expect(keys).toEqual(Array(3).fill('3773069825095106469'));
});

it('keeps the explicit account-minute fallback outside canonical items and labels its ambiguity', () => {
  const api = require('./storiesDataSlayer.js');
  const result = api.prepareStoriesDataSlayerResults(
    [{ creator_username: 'synthetic_studio', code: 'SyntheticStoryCode', taken_at_ts: 1793183400 }],
    { accounts: [account()], now },
  ) as Prepared;
  const group = first(result.groups);
  expect(group.status).toBe('success');
  expect(first(group.bakeoff_rows).story_key).toBe(
    `${account().id}:${Math.floor(Date.parse('2026-10-28T10:30:00Z') / 60000)}`,
  );
  expect(first(group.items)).not.toHaveProperty('story_key');
  expect(result.limitations).toContain('story_key_minute_fallback_collision_possible');
});
