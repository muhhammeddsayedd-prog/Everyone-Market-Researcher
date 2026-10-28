// @vitest-environment node
// Synthetic request/storage responses only. No credential or network access.
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createMediaUploadHandler, type MediaUploadSigner } from './media-upload';
import { createSupabaseMediaSigner } from './media-upload-storage';

const supabaseUrl = 'https://zmotjsbzhzjvpelxvxlf.supabase.co';
const origin = 'https://everyone-market-researcher-local.vercel.app';
const path = 'everyone/instagram_stories/12345/thumb.jpg';
const secret = 'synthetic-internal-secret-for-local-contract-only';
const secretKey = 'synthetic-storage-secret-never-used-for-network';
const token = 'synthetic-upload-token';
const environment = {
  NODE_ENV: 'test',
  EMR_MEDIA_UPLOAD_ENABLED: 'true',
  INTERNAL_WEBHOOK_SECRET: secret,
  SUPABASE_SECRET_KEY: secretKey,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
};
const signed = (name = path) => ({
  signedUrl: `${supabaseUrl}/storage/v1/object/upload/sign/media/${name}?token=${token}`,
  token,
  path: name,
});
function request(
  body = JSON.stringify({ path }),
  headers: Record<string, string> = {},
  options: { method?: string; url?: string; signal?: AbortSignal } = {},
) {
  return new Request(options.url ?? `${origin}/api/internal/media-upload-url`, {
    method: options.method ?? 'POST',
    headers: { 'x-emr-secret': secret, 'content-type': 'application/json', ...headers },
    ...(options.method === 'GET' ? {} : { body }),
    signal: options.signal,
  });
}
function setup(patch: Record<string, string | undefined> = {}) {
  const signUpload = vi.fn<MediaUploadSigner>(async (name) => signed(name));
  const handler = createMediaUploadHandler({
    environment: () => ({ ...environment, ...patch }),
    signUpload,
  });
  return { handler, signUpload };
}

describe('authenticated media signed-upload route', () => {
  it('returns only a same-project media capability and prevents caching', async () => {
    const s = setup();
    const result = await s.handler(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(signed());
    expect(result.headers.get('cache-control')).toBe('no-store, private');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    expect(s.signUpload).toHaveBeenCalledTimes(1);
    expect(s.signUpload.mock.calls[0]?.[0]).toBe(path);
    expect(s.signUpload.mock.calls[0]?.[1].supabaseUrl).toBe(supabaseUrl);
  });

  it.each(['', 'wrong', `${secret},${secret}`, 'x'.repeat(1000)])(
    'rejects an absent, incorrect or duplicate credential without storage access',
    async (value) => {
      const s = setup();
      const result = await s.handler(request(undefined, { 'x-emr-secret': value }));
      expect(result.status).toBe(401);
      expect(s.signUpload).not.toHaveBeenCalled();
      expect(await result.json()).toEqual({ error: { code: 'unauthorized' } });
    },
  );

  it.each<Record<string, string>>([{ origin }, { cookie: 'session=synthetic' }])(
    'rejects browser-origin and cookie-bearing requests',
    async (headers) => {
      const s = setup();
      expect((await s.handler(request(undefined, headers))).status).toBe(403);
      expect(s.signUpload).not.toHaveBeenCalled();
    },
  );

  it.each([
    { EMR_MEDIA_UPLOAD_ENABLED: 'false' },
    { INTERNAL_WEBHOOK_SECRET: undefined },
    { INTERNAL_WEBHOOK_SECRET: 'too-short' },
    { SUPABASE_SECRET_KEY: undefined },
    { VERCEL_ENV: 'production' },
    { NODE_ENV: 'production' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://hkiafqrcxaafdbcvjlzv.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_URL: 'http://zmotjsbzhzjvpelxvxlf.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_URL: `${supabaseUrl}/unexpected` },
    { NEXT_PUBLIC_SUPABASE_URL: `${supabaseUrl}?override=1` },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://user:synthetic@zmotjsbzhzjvpelxvxlf.supabase.co' },
  ])('fails closed for unconfigured or out-of-scope deployment settings', async (patch) => {
    const s = setup(patch);
    const result = await s.handler(request());
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: { code: 'unavailable' } });
    expect(s.signUpload).not.toHaveBeenCalled();
  });

  it('supports explicitly enabled protected Preview configuration without enabling Production', async () => {
    const s = setup({ NODE_ENV: 'production', VERCEL_ENV: 'preview' });
    expect((await s.handler(request())).status).toBe(200);
  });

  it.each([
    '../everyone/instagram/123/thumb.jpg',
    '/everyone/instagram/123/thumb.jpg',
    'everyone/instagram/a..b/thumb.jpg',
    'everyone/instagram/%2e%2e/thumb.jpg',
    'everyone/instagram/123%2fother/thumb.jpg',
    'media/everyone/instagram/123/thumb.jpg',
    'everyone/tiktok/123/thumb.jpg',
    'everyone/instagram/123/frame-01.jpg',
    'everyone/instagram/123/thumb.png',
    'everyone/instagram/123/thumb.jpg?overwrite=1',
    'EVERYONE/instagram/123/thumb.jpg',
    `everyone/instagram/${'a'.repeat(600)}/thumb.jpg`,
  ])('rejects noncanonical or out-of-scope paths', async (name) => {
    const s = setup();
    expect((await s.handler(request(JSON.stringify({ path: name })))).status).toBe(400);
    expect(s.signUpload).not.toHaveBeenCalled();
  });

  it.each([
    '{}',
    'null',
    '[]',
    '{',
    JSON.stringify({ path, bucket: 'other' }),
    JSON.stringify({ path, upsert: false }),
    JSON.stringify({ path: 7 }),
  ])('enforces the closed request shape', async (body) => {
    const s = setup();
    expect((await s.handler(request(body))).status).toBe(400);
    expect(s.signUpload).not.toHaveBeenCalled();
  });

  it('enforces a streamed body limit even without Content-Length', async () => {
    const s = setup();
    expect((await s.handler(request(JSON.stringify({ path, extra: 'x'.repeat(5000) })))).status).toBe(413);
    expect((await s.handler(request(undefined, { 'content-length': '5000' }))).status).toBe(413);
    expect((await s.handler(request(undefined, { 'content-length': '1' }))).status).toBe(400);
    expect(s.signUpload).not.toHaveBeenCalled();
  });

  it('rejects unsupported methods, encodings, content types and alternate route URLs', async () => {
    const s = setup();
    expect((await s.handler(request(undefined, {}, { method: 'GET' }))).status).toBe(405);
    expect((await s.handler(request(undefined, { 'content-encoding': 'gzip' }))).status).toBe(415);
    expect((await s.handler(request(undefined, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await s.handler(request(undefined, {}, { url: `${origin}/api/internal/other` }))).status).toBe(
      403,
    );
    expect(
      (await s.handler(request(undefined, {}, { url: `${origin}/api/internal/media-upload-url?q=1` })))
        .status,
    ).toBe(403);
    expect(s.signUpload).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...signed(), path: 'other/instagram/123/thumb.jpg' },
    { ...signed(), token: 'other-token' },
    { ...signed(), signedUrl: 'https://attacker.invalid/storage/v1/object/upload/sign/media/path' },
    { ...signed(), signedUrl: `${signed().signedUrl}&other=1` },
    { ...signed(), signedUrl: signed().signedUrl.replace('/media/', '/other-bucket/') },
    { ...signed(), secret: secretKey },
  ])('rejects malformed or foreign signed capabilities', async (value) => {
    const s = setup();
    s.signUpload.mockResolvedValue(value);
    const result = await s.handler(request());
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ error: { code: 'storage_unavailable' } });
  });

  it('never reflects a storage error or credentials in the response', async () => {
    const s = setup();
    s.signUpload.mockRejectedValue(new Error(`synthetic private error ${secretKey} ${secret}`));
    const result = await s.handler(request());
    expect(result.status).toBe(502);
    const body = await result.text();
    expect(body).not.toContain(secretKey);
    expect(body).not.toContain(secret);
    expect(body).not.toContain('synthetic private error');
  });

  it('honors caller cancellation before storage access', async () => {
    const s = setup();
    const controller = new AbortController();
    controller.abort();
    expect((await s.handler(request(undefined, {}, { signal: controller.signal }))).status).toBe(503);
    expect(s.signUpload).not.toHaveBeenCalled();
  });
});

describe('actual pinned Supabase SDK with a synthetic HTTP transport', () => {
  it('issues one immutable same-project signed-upload POST and no upload', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.redirect).toBe('error');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${secretKey}`);
      expect(headers.get('apikey')).toBe(secretKey);
      expect(headers.get('x-upsert')).toBeNull();
      expect(init?.body).toBe('{}');
      return Response.json({ url: `/object/upload/sign/media/${path}?token=${token}` });
    });
    const handler = createMediaUploadHandler({
      environment: () => environment,
      signUpload: createSupabaseMediaSigner({ fetch }),
    });
    const result = await handler(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(signed());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      `${supabaseUrl}/storage/v1/object/upload/sign/media/${path}`,
    );
  });

  it('redacts an actual SDK error response and caps its response body', async () => {
    for (const response of [
      Response.json(
        { message: `synthetic private ${secretKey}`, statusCode: '403', error: 'Forbidden' },
        { status: 403 },
      ),
      Response.json({ url: 'x'.repeat(10000) }),
    ]) {
      const fetch = vi.fn<typeof globalThis.fetch>(async () => response);
      const handler = createMediaUploadHandler({
        environment: () => environment,
        signUpload: createSupabaseMediaSigner({ fetch }),
      });
      const result = await handler(request());
      expect(result.status).toBe(502);
      expect(await result.json()).toEqual({ error: { code: 'storage_unavailable' } });
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it('waits for the bounded fetch to close on timeout and returns no capability', async () => {
    let closed = false;
    const fetch = vi.fn<typeof globalThis.fetch>(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              closed = true;
              reject(new Error('synthetic canceled storage request'));
            },
            { once: true },
          );
        }),
    );
    const handler = createMediaUploadHandler({
      environment: () => environment,
      signUpload: createSupabaseMediaSigner({ fetch }),
      deadlineMs: 10,
    });
    const result = await handler(request());
    expect(result.status).toBe(503);
    expect(closed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
