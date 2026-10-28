// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import type { LookupAddress } from 'node:dns';
vi.mock('server-only', () => ({}));
import { createClient } from '@supabase/supabase-js';
import { createMediaHttpPorts, type MediaAddressResolver } from './media-http';

const origin = 'https://everyone-market-researcher-m06-preview.vercel.app';
const secret = 'synthetic-internal-secret-for-local-contract-only';
const path = 'everyone/instagram_stories/123/thumb.jpg';
const storage = 'https://zmotjsbzhzjvpelxvxlf.supabase.co';
const capability = {
  path,
  token: 'synthetic-token',
  signedUrl: `${storage}/storage/v1/object/upload/sign/media/${path}?token=synthetic-token`,
};
const signal = () => new AbortController().signal;
const downloadOptions = {
  maxBytes: 5 * 1024 * 1024,
  timeoutMs: 20000,
  redirect: 'error',
  accept: 'image/jpeg,image/png,image/webp',
} as const;
const jpeg = new Uint8Array([255, 216, 255, 10, 255, 217]);
type Fixture = {
  status?: number;
  headers?: Record<string, string>;
  chunks?: Buffer[];
  body?: string | Uint8Array;
  hold?: boolean;
  error?: boolean;
  incomplete?: boolean;
};
function mocked(specs: Fixture[]) {
  const calls: { options: RequestOptions; body: Buffer | undefined; closed: boolean }[] = [];
  const transport = (options: RequestOptions, listener: (r: IncomingMessage) => void) => {
    const spec = specs.shift() ?? {};
    const observed = { options, body: undefined as Buffer | undefined, closed: false };
    calls.push(observed);
    const req = new EventEmitter(),
      socket = new EventEmitter(),
      res = new EventEmitter();
    let destroyed = false,
      responseDestroyed = false;
    Object.assign(res, {
      statusCode: spec.status ?? 200,
      headers: { 'content-type': 'image/png', ...spec.headers },
      complete: false,
      destroy: () => {
        if (!responseDestroyed) {
          responseDestroyed = true;
          res.emit('close');
        }
      },
    });
    Object.assign(req, {
      socket,
      setTimeout: () => req,
      destroy: () => {
        if (destroyed) return req;
        destroyed = true;
        (res as unknown as IncomingMessage).destroy();
        queueMicrotask(() => {
          observed.closed = true;
          socket.emit('close');
          req.emit('close');
        });
        return req;
      },
      end: (body?: Uint8Array) => {
        observed.body = body ? Buffer.from(body) : undefined;
        queueMicrotask(() => {
          req.emit('socket', socket);
          if (destroyed) return;
          if (spec.error) {
            req.emit('error', Error('raw sensitive native failure'));
            (req as unknown as ClientRequest).destroy();
            return;
          }
          listener(res as IncomingMessage);
          if (responseDestroyed) return;
          for (const chunk of spec.chunks ?? [Buffer.from(spec.body ?? 'image')]) {
            if (responseDestroyed) return;
            res.emit('data', chunk);
          }
          if (spec.hold || responseDestroyed) return;
          Object.assign(res, { complete: !spec.incomplete });
          res.emit('end');
          res.emit('close');
        });
        return req;
      },
    });
    return req as unknown as ClientRequest;
  };
  const resolver = vi.fn<MediaAddressResolver>(async () => [{ address: '8.8.8.8', family: 4 }]);
  return {
    calls,
    resolver,
    ports: createMediaHttpPorts({
      previewOrigin: origin,
      webhookSecret: secret,
      protectionBypass: 'synthetic-vercel-bypass-for-local-only',
      transport,
      resolver,
    }),
  };
}
afterEach(() => vi.useRealTimers());
describe('M06 concrete bounded media HTTP ports', () => {
  it('pins public DNS, hostname/SNI and strict TLS, returns binary and closes its socket', async () => {
    const f = mocked([{ body: jpeg, headers: { 'content-type': 'image/jpeg' } }]);
    const r = await f.ports.download('https://cdn.instagram.com/thumb.jpg', downloadOptions, signal());
    expect(r).toEqual({ status: 200, bytes: jpeg, contentType: 'image/jpeg' });
    expect(f.calls[0]?.options).toMatchObject({
      hostname: 'cdn.instagram.com',
      servername: 'cdn.instagram.com',
      port: 443,
      method: 'GET',
      agent: false,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      headers: { 'accept-encoding': 'identity' },
    });
    expect(f.calls[0]?.closed).toBe(true);
    expect(JSON.stringify(f.calls[0]?.options)).not.toContain(secret);
    expect(JSON.stringify(f.calls[0]?.options)).not.toMatch(
      /x-emr-secret|x-vercel-protection-bypass|authorization|cookie|apikey/i,
    );
  });
  it.each([
    'http://cdn.instagram.com/x',
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'https://user:pass@cdn.instagram.com/x',
    'https://private.local/x',
    'https://cdn.instagram.com/x#frag',
    'https://cdn.instagram.com:444/x',
  ])('rejects unsafe source %s before DNS', async (url) => {
    const f = mocked([]);
    await expect(f.ports.download(url, downloadOptions, signal())).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    expect(f.resolver).not.toHaveBeenCalled();
    expect(f.calls).toHaveLength(0);
  });
  it.each(
    (
      [
        [{ address: '127.0.0.1', family: 4 }],
        [{ address: '10.0.0.1', family: 4 }],
        [{ address: '169.254.169.254', family: 4 }],
        [{ address: '100.64.0.1', family: 4 }],
        [{ address: '::1', family: 6 }],
        [{ address: 'fc00::1', family: 6 }],
        [{ address: 'fe80::1', family: 6 }],
        [{ address: '::ffff:8.8.8.8', family: 6 }],
        [{ address: '2001:db8::1', family: 6 }],
        [
          { address: '8.8.8.8', family: 4 },
          { address: '192.168.1.1', family: 4 },
        ],
        [],
      ] satisfies LookupAddress[][]
    ).map((rows) => ({ rows })),
  )('rejects every unsafe or mixed DNS answer before HTTPS', async ({ rows }) => {
    const f = mocked([]);
    f.resolver.mockResolvedValue(rows);
    await expect(f.ports.download('https://cdn.instagram.com/x', downloadOptions, signal())).rejects.toThrow(
      'EMR_MEDIA_HTTP_REJECTED',
    );
    expect(f.calls).toHaveLength(0);
  });
  it.each<Fixture>([
    { status: 302, headers: { location: 'https://another.example.com/x' } },
    { headers: { 'content-type': 'video/mp4' } },
    { headers: { 'content-type': 'text/html' } },
    { headers: { 'content-encoding': 'gzip' } },
    { headers: { 'content-length': String(5 * 1024 * 1024 + 1) } },
    { headers: { 'content-length': '5', 'transfer-encoding': 'chunked' } },
    { headers: { 'content-length': '999999999999999999999999999' } },
    { chunks: [Buffer.alloc(3 * 1024 * 1024), Buffer.alloc(3 * 1024 * 1024)] },
    { incomplete: true },
  ])('refuses redirect, unsupported or unbounded response %# and closes', async (spec) => {
    const f = mocked([spec]);
    await expect(f.ports.download('https://cdn.instagram.com/x', downloadOptions, signal())).rejects.toThrow(
      'EMR_MEDIA_HTTP_REJECTED',
    );
    expect(f.calls[0]?.closed).toBe(true);
    expect(f.calls).toHaveLength(1);
  });
  it.each([403, 404, 410, 429, 500, 503])(
    'returns source HTTP%s without reading error bodies or signing',
    async (status) => {
      const f = mocked([{ status, body: 'not an image', headers: { 'content-type': 'text/html' } }]);
      expect(await f.ports.download('https://cdn.instagram.com/x', downloadOptions, signal())).toEqual({
        status,
        bytes: new Uint8Array(),
        contentType: '',
      });
      expect(f.calls[0]?.closed).toBe(true);
    },
  );
  it('aborts pending DNS and never starts an HTTP request after later resolution', async () => {
    const f = mocked([]),
      c = new AbortController();
    let release: (v: LookupAddress[]) => void = () => {};
    f.resolver.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const operation = f.ports.download('https://cdn.instagram.com/x', downloadOptions, c.signal);
    const rejected = expect(operation).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    c.abort();
    await rejected;
    release([{ address: '8.8.8.8', family: 4 }]);
    await Promise.resolve();
    expect(f.calls).toHaveLength(0);
  });
  it('cancels a streaming response and waits for native socket closure', async () => {
    const f = mocked([{ hold: true }]),
      c = new AbortController();
    const result = f.ports.download('https://cdn.instagram.com/x', downloadOptions, c.signal);
    const rejected = expect(result).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    await vi.waitFor(() => expect(f.calls).toHaveLength(1));
    c.abort();
    await rejected;
    expect(f.calls[0]?.closed).toBe(true);
  });
  it('bounds the whole request including a stalled stream', async () => {
    vi.useFakeTimers();
    const f = mocked([{ hold: true }]);
    const rejected = expect(
      f.ports.download('https://cdn.instagram.com/x', downloadOptions, signal()),
    ).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    await vi.advanceTimersByTimeAsync(20001);
    await rejected;
    expect(f.calls[0]?.closed).toBe(true);
  });
  it('bounds DNS without issuing an HTTPS request after expiry', async () => {
    vi.useFakeTimers();
    const f = mocked([]);
    let release: (rows: LookupAddress[]) => void = () => {};
    f.resolver.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const rejected = expect(
      f.ports.download('https://cdn.instagram.com/x', downloadOptions, signal()),
    ).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    await vi.advanceTimersByTimeAsync(20001);
    await rejected;
    release([{ address: '8.8.8.8', family: 4 }]);
    await Promise.resolve();
    expect(f.calls).toHaveLength(0);
  });
  it('signs only through exact authenticated Preview then PUTs actual immutable JPEG without auth leakage', async () => {
    const f = mocked([
      { body: JSON.stringify(capability), headers: { 'content-type': 'application/json' } },
      { status: 200, body: '{}', headers: { 'content-type': 'application/json' } },
    ]);
    expect(await f.ports.sign(path, signal())).toEqual(capability);
    expect(
      await f.ports.upload(
        capability.signedUrl,
        jpeg,
        { contentType: 'image/jpeg', upsert: false },
        signal(),
      ),
    ).toEqual({ status: 200 });
    expect(f.calls[0]?.options).toMatchObject({
      hostname: 'everyone-market-researcher-m06-preview.vercel.app',
      method: 'POST',
      path: '/api/internal/media-upload-url',
      headers: {
        'x-emr-secret': secret,
        'x-vercel-protection-bypass': 'synthetic-vercel-bypass-for-local-only',
      },
    });
    expect(JSON.parse(f.calls[0]!.body!.toString())).toEqual({ path });
    expect(f.calls[1]?.options).toMatchObject({
      hostname: 'zmotjsbzhzjvpelxvxlf.supabase.co',
      method: 'PUT',
      path: `/storage/v1/object/upload/sign/media/${path}?token=synthetic-token`,
      headers: { 'content-type': 'image/jpeg', 'content-length': String(jpeg.byteLength) },
    });
    expect(f.calls[1]?.body).toEqual(Buffer.from(jpeg));
    expect(JSON.stringify(f.calls[1]?.options)).not.toMatch(
      /x-upsert|x-emr-secret|x-vercel-protection-bypass|apikey|authorization/i,
    );
    await expect(
      f.ports.upload(capability.signedUrl, jpeg, { contentType: 'image/jpeg', upsert: false }, signal()),
    ).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    expect(f.calls).toHaveLength(2);
  });
  it.each([
    { ...capability, path: 'everyone/instagram_stories/456/thumb.jpg' },
    { ...capability, token: 'different' },
    { ...capability, signedUrl: capability.signedUrl + '&token=synthetic-token' },
    { ...capability, signedUrl: capability.signedUrl.replace(storage, 'https://other.supabase.co') },
    { ...capability, signedUrl: capability.signedUrl.replace('/123/', '/456/') },
  ])('rejects mismatched signed capabilities %# without upload', async (cap) => {
    const f = mocked([{ body: JSON.stringify(cap), headers: { 'content-type': 'application/json' } }]);
    await expect(f.ports.sign(path, signal())).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    await expect(
      f.ports.upload(cap.signedUrl, jpeg, { contentType: 'image/jpeg', upsert: false }, signal()),
    ).rejects.toThrow();
    expect(f.calls).toHaveLength(1);
  });
  it('preserves immutable409 and consumes uncertain upload capabilities without automatic retry', async () => {
    for (const spec of [
      { status: 409, body: '{}', headers: { 'content-type': 'application/json' } },
      { error: true },
    ]) {
      const f = mocked([
        { body: JSON.stringify(capability), headers: { 'content-type': 'application/json' } },
        spec,
      ]);
      await f.ports.sign(path, signal());
      const result = f.ports.upload(
        capability.signedUrl,
        jpeg,
        { contentType: 'image/jpeg', upsert: false },
        signal(),
      );
      if (spec.error) await expect(result).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
      else expect(await result).toEqual({ status: 409 });
      await expect(
        f.ports.upload(capability.signedUrl, jpeg, { contentType: 'image/jpeg', upsert: false }, signal()),
      ).rejects.toThrow();
      expect(f.calls).toHaveLength(2);
      expect(f.calls[1]?.closed).toBe(true);
    }
  });
  it('fails missing or invalid bindings before every I/O', () => {
    for (const options of [
      { previewOrigin: origin, webhookSecret: '', protectionBypass: '' },
      { previewOrigin: 'https://evil.example.com', webhookSecret: secret, protectionBypass: '' },
      { previewOrigin: origin + '/path', webhookSecret: secret, protectionBypass: '' },
      { previewOrigin: origin, webhookSecret: secret, protectionBypass: 'bad\nvalue' },
    ])
      expect(() => createMediaHttpPorts(options)).toThrow('EMR_MEDIA_HTTP_BINDING_INVALID');
  });
  it('preflights only authenticated HEAD204 and neither signs nor uploads', async () => {
    const f = mocked([{ status: 204, body: '', headers: { 'content-length': '0' } }]);
    await expect(f.ports.preflight(signal())).resolves.toBeUndefined();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.options).toMatchObject({
      method: 'HEAD',
      path: '/api/internal/media-upload-url',
      headers: {
        'x-emr-secret': secret,
        'x-vercel-protection-bypass': 'synthetic-vercel-bypass-for-local-only',
      },
    });
    expect(f.calls[0]?.body).toBeUndefined();
    expect(f.calls[0]?.closed).toBe(true);
    await expect(
      f.ports.upload(capability.signedUrl, jpeg, { contentType: 'image/jpeg', upsert: false }, signal()),
    ).rejects.toThrow();
    expect(f.calls).toHaveLength(1);
  });
  it.each([200, 302, 401, 403, 404, 500])('does not follow or accept preflight HTTP%s', async (status) => {
    const f = mocked([{ status, body: '', headers: { location: origin + '/elsewhere' } }]);
    await expect(f.ports.preflight(signal())).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.closed).toBe(true);
  });
  it('rejects a HEAD body even when response status is204', async () => {
    const f = mocked([{ status: 204, body: 'unexpected' }]);
    await expect(f.ports.preflight(signal())).rejects.toThrow();
    expect(f.calls[0]?.closed).toBe(true);
  });
  it('bounds a stalled authenticated preflight to eight seconds and closes it', async () => {
    vi.useFakeTimers();
    const f = mocked([{ status: 204, body: '', hold: true }]);
    const rejected = expect(f.ports.preflight(signal())).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    await vi.advanceTimersByTimeAsync(8001);
    await rejected;
    expect(f.calls[0]?.closed).toBe(true);
  });
  it('rejects cancellation before DNS for every port', async () => {
    const f = mocked([]),
      c = new AbortController();
    c.abort();
    await expect(f.ports.preflight(c.signal)).rejects.toThrow();
    await expect(
      f.ports.download('https://cdn.instagram.com/x', downloadOptions, c.signal),
    ).rejects.toThrow();
    await expect(f.ports.sign(path, c.signal)).rejects.toThrow();
    expect(f.resolver).not.toHaveBeenCalled();
    expect(f.calls).toHaveLength(0);
  });
  it('pins a permitted global IPv6 result without another resolver lookup', async () => {
    const f = mocked([{ body: jpeg, headers: { 'content-type': 'image/jpeg' } }]);
    f.resolver.mockResolvedValue([{ address: '2001:4860:4860::8888', family: 6 }]);
    await f.ports.download('https://cdn.instagram.com/x', downloadOptions, signal());
    expect(f.calls[0]?.options.family).toBe(6);
    expect(f.resolver).toHaveBeenCalledExactlyOnceWith('cdn.instagram.com');
    const pin = f.calls[0]?.options.lookup as (
      host: string,
      options: object,
      callback: (error: null, address: string, family: number) => void,
    ) => void;
    const callback = vi.fn();
    pin('cdn.instagram.com', {}, callback);
    expect(callback).toHaveBeenCalledExactlyOnceWith(null, '2001:4860:4860::8888', 6);
  });
  it.each<Fixture>([
    { body: '{', headers: { 'content-type': 'application/json' } },
    { body: Buffer.from([255]), headers: { 'content-type': 'application/json' } },
    { body: JSON.stringify(capability), headers: { 'content-type': 'text/html' } },
    {
      body: JSON.stringify(capability),
      headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
    },
    { body: 'x'.repeat(8193), headers: { 'content-type': 'application/json' } },
  ])('rejects malformed, encoded or oversized signing responses %#', async (spec) => {
    const f = mocked([spec]);
    await expect(f.ports.sign(path, signal())).rejects.toThrow('EMR_MEDIA_HTTP_REJECTED');
    expect(f.calls[0]?.closed).toBe(true);
    expect(f.calls).toHaveLength(1);
  });
  it('matches the installed Supabase SDK signed-upload method, path and binary body contract', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const client = createClient(storage, 'synthetic-public-sdk-contract-only', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (url, init) => {
          calls.push({ url: String(url), init });
          return Response.json({ Key: `media/${path}` });
        },
      },
    });
    const result = await client.storage
      .from('media')
      .uploadToSignedUrl(path, capability.token, jpeg, { contentType: 'image/jpeg', upsert: false });
    expect(result.error).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(capability.signedUrl);
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(calls[0]?.init?.body).toEqual(jpeg);
    // The signed token was issued immutable; our direct transport additionally
    // avoids SDK account/API authorization headers and all overwrite headers.
  });
});
