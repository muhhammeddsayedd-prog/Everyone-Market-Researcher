import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
// Reuse ESLint's already-locked AJV6, with no package/dependency change. This
// particular schema uses only keywords shared with draft7; remove its dialect
// declaration for this local checker. Production still enforces the ingest RPC.
const Ajv = createRequire(require.resolve('eslint/package.json'))('ajv');
const schema = JSON.parse(
  readFileSync(new URL('../../reference/n8n/normalized_item.schema.json', import.meta.url), 'utf8'),
);
delete schema.$schema;
const schemaValid = new Ajv({ allErrors: true }).compile(schema);
type Row = Record<string, unknown>;
type Result = { items: Row[]; errors: { error: string; matchKey: string }[] };
const api = require('./vimeoApi.js') as {
  normalizeVimeoApi: (rows: Row[], ctx?: Row) => Row[];
  normalizeVimeoApiResult: (rows: Row[], ctx?: Row) => Result;
};
const goat = require('./goat255.js') as { normalizeGoat255: (rows: Row[], ctx?: Row) => Row[] };
const dltik = require('./dltik.js') as { normalizeDltik: (rows: Row[], ctx?: Row) => Row[] };
const ingestion = require('./prepare_ingest_groups.js') as {
  prepareIngestGroups: (groups: Row[]) => { status: string; items: Row[] }[];
};
// Deliberately synthetic. These rows are not a real provider capture or proof of live access.
const video = (extra: Row = {}): Row => ({
  uri: '/videos/123456789',
  link: 'https://vimeo.com/123456789',
  name: 'Synthetic public film',
  release_time: '2026-10-01T12:00:00Z',
  created_time: '2026-09-01T12:00:00Z',
  privacy: { view: 'anybody' },
  description: '#FILM with @Everyone.Film',
  tags: [{ name: 'FILM' }],
  duration: 62,
  pictures: {
    sizes: [
      { width: 1920, link: 'https://i.vimeocdn.com/large.jpg' },
      { width: 640, link: 'https://i.vimeocdn.com/small.jpg' },
      { width: 1280, link: 'https://i.vimeocdn.com/chosen.jpg' },
    ],
  },
  stats: { plays: 11 },
  metadata: { connections: { likes: { total: 4 }, comments: { total: 2 } } },
  ...extra,
});
describe('M04 Vimeo normalizers — synthetic contracts only', () => {
  it('maps the public date, largest ≤1280 thumbnail, description, and finite metrics', () => {
    const item = api.normalizeVimeoApi([video()])[0];
    expect(item).toMatchObject({
      platform: 'vimeo',
      external_id: '123456789',
      actor: 'vimeo-api',
      published_at: '2026-10-01T12:00:00.000Z',
      thumbnail_url: 'https://i.vimeocdn.com/chosen.jpg',
      hashtags: ['film'],
      mentions: ['everyone.film'],
      metrics: { plays: 11, likes: 4, comments: 2 },
      credits_text: '#FILM with @Everyone.Film',
    });
    const [group] = ingestion.prepareIngestGroups([
      { account_id: 'b7fa1fc1-5464-46c9-9cb0-7666d02a4cf3', items: [item] },
    ]);
    expect(group?.status).toBe('success');
    expect(group?.items).toHaveLength(1);
  });
  it('fails closed for missing privacy and all nonpublic privacy values', () => {
    expect(
      api.normalizeVimeoApi([
        video({ privacy: undefined }),
        video({ privacy: { view: 'unlisted' } }),
        video({ privacy: { view: 'password' } }),
      ]),
    ).toEqual([]);
  });
  it('keeps error diagnostics separate and rejects invalid identity/date without copying source errors', () => {
    const result = api.normalizeVimeoApiResult(
      [
        video({ uri: '/videos/not-an-id' }),
        video({ release_time: '2026-02-30T00:00:00Z' }),
        { error: 'secret-bearing-provider-detail' },
      ],
      { account: { handle: 'Everyone' } },
    );
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([
      { error: 'vimeo_contract_drift', matchKey: 'everyone' },
      { error: 'vimeo_contract_drift', matchKey: 'everyone' },
      { error: 'vimeo_provider_error', matchKey: 'everyone' },
    ]);
    expect(JSON.stringify(result)).not.toContain('secret-bearing');
  });
  it('rejects rolled-over clock times while preserving valid timezone offsets', () => {
    expect(api.normalizeVimeoApi([video({ release_time: '2026-10-24T24:00:00Z' })])).toEqual([]);
    expect(api.normalizeVimeoApi([video({ release_time: '2026-10-24T23:59:59+14:01' })])).toEqual([]);
    expect(api.normalizeVimeoApi([video({ release_time: '2026-10-24T23:59:59+14:00' })])[0]).toMatchObject({
      published_at: '2026-10-24T09:59:59.000Z',
    });
  });
  it('does not keep download/file fields or nested non-finite metric values', () => {
    const item = api.normalizeVimeoApi([
      video({
        files: [{ link: 'https://download.invalid/private' }],
        download: ['never'],
        stats: { plays: Infinity },
        pictures: { sizes: [{ width: 1920, link: 'https://i.vimeocdn.com/no.jpg' }] },
      }),
    ])[0];
    expect(item?.thumbnail_url).toBeNull();
    expect(item?.metrics).toMatchObject({ plays: null });
    expect(JSON.stringify(item)).not.toContain('download');
  });
  it('filters below cutoff while preserving an explicit metrics overlap past watermark ID', () => {
    const rows = [
      video(),
      video({
        uri: '/videos/123456788',
        link: 'https://vimeo.com/123456788',
        release_time: '2026-09-20T00:00:00Z',
      }),
    ];
    expect(api.normalizeVimeoApi(rows, { cutoff: '2026-09-25T00:00:00Z' })).toHaveLength(1);
    expect(
      api.normalizeVimeoApi(rows, {
        cutoff: '2026-09-25T00:00:00Z',
        metricsCutoff: '2026-09-01T00:00:00Z',
        account: { watermark_external_id: '123456789' },
      }),
    ).toHaveLength(2);
  });
  it('maps goat UTC dates, drops profiles/private rows, and matches only the selected owner', () => {
    const rows = [
      { type: 'profile' },
      {
        type: 'video',
        id: '123456789',
        url: 'https://vimeo.com/123456789',
        ownerUrl: 'https://vimeo.com/Everyone',
        privacy: 'anybody',
        uploadDate: '2026-10-01 12:00:00',
        title: 'Synthetic goat',
        description: '#FILM',
        tags: ['FILM'],
      },
    ];
    expect(goat.normalizeGoat255(rows, { account: { handle: '@EVERYONE' } })[0]).toMatchObject({
      published_at: '2026-10-01T12:00:00.000Z',
      actor: 'goat255/vimeo-scraper',
      hashtags: ['film'],
    });
    expect(goat.normalizeGoat255(rows, { account: { handle: 'other' } })).toEqual([]);
  });
  it('maps dltik calendar date and recursively excludes download_* payload keys', () => {
    const row = {
      id: '123456789',
      url: 'https://vimeo.com/123456789',
      uploader_url: 'https://vimeo.com/everyone',
      privacy: 'public',
      upload_date: '20260322',
      view_count: 24,
      like_count: 3,
      download_url: 'never',
      download_hd: 'never',
      download_4k: 'never',
      download_formats: [{ download_url: 'never' }],
      metadata: { download_url: 'never' },
    };
    const item = dltik.normalizeDltik([row], { account: { handle: 'everyone' } })[0];
    expect(item).toMatchObject({
      external_id: '123456789',
      published_at: '2026-03-22T00:00:00.000Z',
      metrics: { views: 24, likes: 3 },
    });
    expect(JSON.stringify(item)).not.toContain('download_');
    expect(row.download_url).toBe('never');
    expect(dltik.normalizeDltik([{ ...row, privacy: 'unlisted' }])).toEqual([]);
  });
  it('validates every source shape against the checked-in normalized-item JSON schema and strict ingest boundary', () => {
    const items = [
      ...api.normalizeVimeoApi([video()]),
      ...goat.normalizeGoat255([
        {
          type: 'video',
          id: '123456789',
          url: 'https://vimeo.com/123456789',
          ownerUrl: 'https://vimeo.com/everyone',
          privacy: 'anybody',
          uploadDate: '2026-10-01 12:00:00',
        },
      ]),
      ...dltik.normalizeDltik([
        {
          id: '123456789',
          url: 'https://vimeo.com/123456789',
          uploader_url: 'https://vimeo.com/everyone',
          privacy: 'public',
          upload_date: '20261001',
        },
      ]),
    ];
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(schemaValid(item), JSON.stringify(schemaValid.errors)).toBe(true);
      const [group] = ingestion.prepareIngestGroups([
        { account_id: 'b7fa1fc1-5464-46c9-9cb0-7666d02a4cf3', items: [item] },
      ]);
      expect(group).toMatchObject({ status: 'success', items: [item] });
      expect(schemaValid({ ...item, extraUnknownField: true })).toBe(false);
    }
  });
});
