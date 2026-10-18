import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { prodPublicRead, prodUploadFetch } from './prod-storage';
import { storageHooks } from './storage';
import { sha256 } from './files';
import type { ProdLogos } from './prod-model';
import type { SafeRequest } from './network';
const bytes = Uint8Array.from([1, 2, 3]);
const entry = {
  company_code: 'C001',
  slug: 'sample',
  storagePath: 'logos/sample.webp',
  sourceUrl: 'https://sample.example/logo.png',
  mime: 'image/webp' as const,
  width: 1,
  height: 1,
  byteLength: 3,
  sha256: sha256(bytes),
};
const logos: ProdLogos = { version: 1, sourceProjectRef: 'zmotjsbzhzjvpelxvxlf', logos: [entry] };
const signal = new AbortController().signal;
const base = 'https://hkiafqrcxaafdbcvjlzv.supabase.co';
describe('bounded production Storage transport', () => {
  it('actual pinned SDK uploads unchanged Uint8Array through strict one-attempt fetch', async () => {
    let calls = 0;
    const request: typeof fetch = async (_input, init) => {
      calls++;
      expect(init?.body).toEqual(bytes);
      expect(new Headers(init?.headers).get('content-type')).toBe('image/webp');
      expect(init?.redirect).toBe('error');
      return new Response(JSON.stringify({ Key: 'media/logos/sample.webp', Id: 'test-only' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = createClient(base, 'synthetic-test-only', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: prodUploadFetch(logos, signal, request) },
    });
    const hooks = storageHooks(client, base, { signal, maxUploadBytes: 3 });
    const prepared = {
      bytes,
      mime: entry.mime,
      ext: 'webp' as const,
      width: 1,
      height: 1,
      sha256: entry.sha256,
    };
    await expect(hooks.upload(entry.storagePath, prepared)).resolves.toBe('created');
    await expect(hooks.upload(entry.storagePath, prepared)).rejects.toThrow();
    expect(calls).toBe(1);
    expect(hooks.uploadedBytes()).toBe(3);
  });
  it('rejects unsealed upload bytes, paths and retry without reaching fetch', async () => {
    let calls = 0;
    const upload = prodUploadFetch(logos, signal, async () => {
      calls++;
      return new Response('{}');
    });
    const options = { method: 'POST', body: bytes, headers: { 'content-type': entry.mime } };
    await expect(upload(`${base}/storage/v1/object/media/logos/other.webp`, options)).rejects.toThrow(
      'M02_PROD_UPLOAD_REJECTED',
    );
    await expect(
      upload(`${base}/storage/v1/object/media/${entry.storagePath}`, {
        ...options,
        body: Uint8Array.from([9, 9, 9]),
      }),
    ).rejects.toThrow('M02_PROD_UPLOAD_REJECTED');
    expect(calls).toBe(0);
    await upload(`${base}/storage/v1/object/media/${entry.storagePath}`, options);
    await expect(upload(`${base}/storage/v1/object/media/${entry.storagePath}`, options)).rejects.toThrow(
      'M02_PROD_UPLOAD_REJECTED',
    );
    expect(calls).toBe(1);
  });
  it('caps production public read to exact manifest size, MIME/hash and single request', async () => {
    let calls = 0;
    const request: SafeRequest = async (url, options) => {
      calls++;
      expect(options?.maxBytes).toBe(3);
      expect(options?.maxRedirects).toBe(0);
      return { status: 200, headers: new Headers({ 'content-type': 'image/webp' }), body: bytes, url };
    };
    const read = prodPublicRead(logos, signal, request);
    await expect(read(entry.storagePath)).resolves.toEqual(bytes);
    await expect(read(entry.storagePath)).rejects.toThrow('M02_PROD_PUBLIC_READ_REJECTED');
    expect(calls).toBe(1);
  });
  it('rejects changed production public bytes instead of accepting stored path', async () => {
    const request: SafeRequest = async (url) => ({
      status: 200,
      headers: new Headers({ 'content-type': 'image/webp' }),
      body: Uint8Array.from([9, 9, 9]),
      url,
    });
    await expect(prodPublicRead(logos, signal, request)(entry.storagePath)).rejects.toThrow(
      'M02_PROD_PUBLIC_READ_REJECTED',
    );
  });
});
