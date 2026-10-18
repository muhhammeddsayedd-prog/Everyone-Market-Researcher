import { describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { restrictedStorageFetch, storageHooks } from './storage';
import type { SafeRequest } from './network';
import type { PreparedLogo } from './copy-logos';

const base = 'https://zmotjsbzhzjvpelxvxlf.supabase.co';
const prepared: PreparedLogo = {
  bytes: new Uint8Array([1, 2, 3]),
  mime: 'image/webp',
  ext: 'webp',
  width: 1,
  height: 1,
  sha256: 'a'.repeat(64),
};
const client = (result: unknown) => {
  const upload = vi.fn(async (...args: unknown[]) => {
    void args;
    return result;
  });
  return { upload, sdk: { storage: { from: () => ({ upload }) } } as unknown as SupabaseClient };
};
const request =
  (status: number, body: string): SafeRequest =>
  async (url) => ({ status, body: new TextEncoder().encode(body), headers: new Headers(), url });
describe('owner logo Storage boundary', () => {
  it('uses the actual pinned SDK through the restricted upload contract with no HTTP', async () => {
    const fakeFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"Key":"media/logos/test.svg","Id":"test-only-id"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const sdk = createClient(base, 'test-only-fake-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: restrictedStorageFetch(base, new AbortController().signal, fakeFetch) },
    });
    const response = await sdk.storage
      .from('media')
      .upload('logos/test.svg', new Uint8Array([1, 2, 3]), { contentType: 'image/svg+xml', upsert: false });
    expect(response.error).toBeNull();
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(String(fakeFetch.mock.calls[0]?.[0])).toBe(`${base}/storage/v1/object/media/logos/test.svg`);
    expect(fakeFetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      redirect: 'error',
      credentials: 'omit',
    });
  });
  it('forbids SDK redirect following and transmits only to the verified upload endpoint', async () => {
    const fakeFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const request = restrictedStorageFetch(base, new AbortController().signal, fakeFetch);
    await request(`${base}/storage/v1/object/media/logos/test.webp`, {
      method: 'POST',
      redirect: 'follow',
      headers: { apikey: 'test-only-sentinel' },
    });
    expect(fakeFetch.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error', credentials: 'omit' });
    await expect(
      request('https://other.supabase.co/storage/v1/object/media/logos/test.webp', { method: 'POST' }),
    ).rejects.toThrow('M02_STORAGE_REQUEST_REJECTED');
    await expect(request(`${base}/auth/v1/token`, { method: 'POST' })).rejects.toThrow(
      'M02_STORAGE_REQUEST_REJECTED',
    );
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [404, ''],
    [400, '{"statusCode":"404","error":"not_found"}'],
  ])('recognizes explicit missing object %s', async (status, body) => {
    expect(
      await storageHooks(client({ error: null }).sdk, base, {
        request: request(status as number, body as string),
      }).readStored('logos/test.webp'),
    ).toBeNull();
  });
  it.each([
    ['invalid json'],
    ['{"statusCode":400,"error":"invalid_request"}'],
    ['{"statusCode":404,"error":"wrong"}'],
  ])('does not turn an unrelated 400 into absence', async (body) => {
    await expect(
      storageHooks(client({ error: null }).sdk, base, { request: request(400, body) }).readStored(
        'logos/test.webp',
      ),
    ).rejects.toThrow('M02_PUBLIC_STORAGE_READ_FAILED');
  });
  it('uploads without overwrite and enforces cumulative byte budget before another call', async () => {
    const fake = client({ error: null });
    const hooks = storageHooks(fake.sdk, base, { maxUploadBytes: 5 });
    expect(await hooks.upload('logos/test.webp', prepared)).toBe('created');
    await expect(hooks.upload('logos/other.webp', prepared)).rejects.toThrow('M02_LOGO_BYTE_BUDGET_REACHED');
    expect(fake.upload).toHaveBeenCalledTimes(1);
    expect(fake.upload.mock.calls[0]?.[2]).toMatchObject({ upsert: false });
    expect(hooks.uploadedBytes()).toBe(3);
  });
  it.each([{ statusCode: 409 }, { statusCode: '400', error: 'Duplicate' }])(
    'requires subsequent byte verification for duplicates',
    async (error) => {
      const hooks = storageHooks(client({ error }).sdk, base);
      expect(await hooks.upload('logos/test.webp', prepared)).toBe('exists');
      expect(hooks.uploadedBytes()).toBe(0);
    },
  );
  it('withholds arbitrary SDK error details', async () => {
    await expect(
      storageHooks(
        client({ error: { statusCode: 401, message: 'sentinel-private-value' } }).sdk,
        base,
      ).upload('logos/test.webp', prepared),
    ).rejects.toThrow(/^M02_STORAGE_UPLOAD_FAILED$/);
  });
  it.each(['../other', 'logos/a.webp?key=sentinel', 'logos/other.svg/child'])(
    'rejects invalid object paths before I/O',
    async (path) => {
      const fake = client({ error: null });
      const network = vi.fn(request(200, ''));
      const hooks = storageHooks(fake.sdk, base, { request: network });
      await expect(hooks.readStored(path)).rejects.toThrow('M02_STORAGE_PATH_REJECTED');
      await expect(hooks.upload(path, prepared)).rejects.toThrow('M02_STORAGE_PATH_REJECTED');
      expect(network).not.toHaveBeenCalled();
      expect(fake.upload).not.toHaveBeenCalled();
    },
  );
});
