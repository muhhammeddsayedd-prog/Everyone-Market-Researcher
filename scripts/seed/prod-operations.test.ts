import { describe, expect, it } from 'vitest';
import { readFrozenLogo, assertEmptyProdState, frozenAccountPatch } from './prod-operations';
import { sha256 } from './files';
import type { ResolutionAccount } from './database';
import type { ProdPayload } from './prod-model';
import type { SafeRequest } from './network';
const bytes = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20"><path d="M0 0"/></svg>',
);
const logo = {
  company_code: 'C000',
  slug: 'everyone-films',
  storagePath: 'logos/everyone-films.svg',
  sourceUrl: null,
  mime: 'image/svg+xml' as const,
  width: 100,
  height: 20,
  byteLength: bytes.length,
  sha256: sha256(bytes),
};
const entry: ProdPayload['accounts'][number] = {
  sourceKey: 'C001:youtube:0',
  company_code: 'C001',
  platform: 'youtube',
  sourceHandle: '@test',
  sourceUrl: 'https://www.youtube.com/@test',
  handle: '@test',
  url: 'https://www.youtube.com/@test',
  status: 'active',
  resolve_status: 'resolved',
  external_id: 'UC' + '0'.repeat(22),
  uploads_playlist_id: 'UU' + '0'.repeat(22),
  backfill_cursor: null,
  last_error: null,
};
const row = {
  id: 'prod-owned-id',
  company_code: 'C001',
  platform: 'youtube',
  handle: '@test',
  handle_norm: '@test',
  url: entry.url,
  status: 'active',
  resolve_status: 'pending',
  external_id: null,
  uploads_playlist_id: null,
  backfill_cursor: null,
  last_error: null,
  has_collection: false,
  locked_until: null,
  last_run_id: null,
  last_success_at: null,
  last_external_id: null,
  last_item_published_at: null,
  items_count: 0,
  backfill_status: 'pending',
} as unknown as ResolutionAccount;
describe('production promotion boundaries', () => {
  it('fetches only the fixed public dev Storage object, once, with no auth or redirects and no re-encoding', async () => {
    const calls: unknown[] = [];
    const request: SafeRequest = async (url, options) => {
      calls.push({ url, options });
      return { status: 200, headers: new Headers({ 'content-type': 'image/svg+xml' }), body: bytes, url };
    };
    const prepared = await readFrozenLogo(logo, request);
    expect(Buffer.from(prepared.bytes).equals(bytes)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'https://zmotjsbzhzjvpelxvxlf.supabase.co/storage/v1/object/public/media/logos/everyone-films.svg',
      options: { maxRedirects: 0, maxBytes: bytes.length },
    });
    expect((calls[0] as { options: unknown }).options).not.toHaveProperty('headers');
  });
  it.each(['hash', 'size', 'mime', 'status'])('rejects %s drift before any upload', async (kind) => {
    const request: SafeRequest = async (url) => ({
      status: kind === 'status' ? 404 : 200,
      headers: new Headers({ 'content-type': kind === 'mime' ? 'text/html' : 'image/svg+xml' }),
      body:
        kind === 'size'
          ? Buffer.concat([bytes, Buffer.from(' ')])
          : kind === 'hash'
            ? Buffer.from(bytes.toString().replace('100', '101'))
            : bytes,
      url,
    });
    await expect(readFrozenLogo(logo, request)).rejects.toThrow('M02_PROD_FROZEN_LOGO_REJECTED');
  });
  it('rejects any nonempty or incomplete production preflight', () => {
    expect(() => assertEmptyProdState([{ name: 'competitors', count: 1 }])).toThrow('M02_PROD_NOT_EMPTY');
    expect(() => assertEmptyProdState([])).toThrow('M02_PROD_NOT_EMPTY');
  });
  it('patches only owned fresh identities, preserves unchanged values and rejects operational/human divergence', () => {
    expect(frozenAccountPatch(row, entry, 'prod-owned-id')).toMatchObject({
      external_id: entry.external_id,
      uploads_playlist_id: entry.uploads_playlist_id,
      resolve_status: 'resolved',
    });
    for (const changed of [
      { id: 'dev-id' },
      { has_collection: true },
      { locked_until: '2030-01-01' },
      { external_id: 'another-id' },
      { status: 'paused' as const },
      { url: 'https://www.youtube.com/@someone-else' },
      { last_error: 'human_changed' },
    ])
      expect(() => frozenAccountPatch({ ...row, ...changed }, entry, 'prod-owned-id')).toThrow(
        'M02_PROD_OWNERSHIP_CHANGED',
      );
  });
});
