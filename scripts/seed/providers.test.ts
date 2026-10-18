import { describe, expect, it, vi } from 'vitest';
import { createProviderResolvers, validateInstagram, validateLinkedIn, checkWebsite } from './providers';
import type { SafeRequest } from './network';
import { normalizeVimeo } from '@emr/shared';

const jsonReply = (value: unknown, status = 200, headers: Record<string, string> = {}) => ({
  status,
  headers: new Headers(headers),
  body: new TextEncoder().encode(JSON.stringify(value)),
  url: 'https://example.com/',
});
const vimeoUser = { uri: '/users/123', name: 'Test Public Studio', link: 'https://vimeo.com/teststudio' };
const youtubeChannel = {
  items: [
    { id: `UC${'a'.repeat(22)}`, contentDetails: { relatedPlaylists: { uploads: `UU${'a'.repeat(22)}` } } },
  ],
};

describe('Vimeo public resolution', () => {
  it('converts public user123 paths to the numeric endpoint and validates canonical returned ID', async () => {
    const request = vi.fn<SafeRequest>().mockResolvedValue(jsonReply(vimeoUser));
    const { resolveVimeo } = createProviderResolvers({ request });
    expect(await resolveVimeo({ kind: 'user', handle: 'user123' }, 'TEST_ONLY_TOKEN')).toMatchObject({
      resolve_status: 'resolved',
      external_id: '123',
      last_error: null,
    });
    expect(new URL(request.mock.calls[0]![0]).pathname).toBe('/users/123');
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      allowedOrigins: ['https://api.vimeo.com'],
      maxRedirects: 0,
    });
  });

  it.each([
    ['channel', 'staffpicks', '/channels/42', 'channels'],
    ['showcase', '123', '/users/99/albums/123', 'albums'],
    ['group', 'test', '/groups/17', 'groups'],
  ] as const)('retains the %s endpoint cursor', async (kind, handle, uri, endpoint) => {
    const { resolveVimeo } = createProviderResolvers({
      request: async () => jsonReply({ uri, name: 'Test' }),
    });
    expect(await resolveVimeo({ kind, handle }, 'TEST_ONLY_TOKEN')).toMatchObject({
      resolve_status: 'resolved',
      backfill_cursor: { endpoint },
    });
  });

  it.each([
    ['channels/staffpicks', '/channels/42'],
    ['showcase/123', '/users/99/albums/123'],
    ['groups/test', '/groups/17'],
  ])('consumes the shared normalized Vimeo resource %s', async (path, uri) => {
    const request = vi.fn<SafeRequest>().mockResolvedValue(jsonReply({ uri, name: 'Test' }));
    const { resolveVimeo } = createProviderResolvers({ request });
    expect(
      (await resolveVimeo(normalizeVimeo(`https://vimeo.com/${path}`), 'TEST_ONLY_TOKEN')).resolve_status,
    ).toBe('resolved');
    expect(request.mock.calls[0]?.[0]).not.toContain('%2F');
  });

  it('rejects a mismatched returned numeric user identity', async () => {
    const { resolveVimeo } = createProviderResolvers({ request: async () => jsonReply(vimeoUser) });
    expect((await resolveVimeo({ kind: 'user', handle: 'user456' }, 'TEST_ONLY_TOKEN')).last_error).toBe(
      'vimeo_bad_response',
    );
  });

  it('marks only a real not-found response invalid; auth, forbidden, malformed and server failures stay retryable', async () => {
    for (const [status, error] of [
      [404, 'vimeo_404'],
      [401, 'vimeo_auth'],
      [403, 'vimeo_forbidden'],
      [500, 'vimeo_http_500'],
    ] as const) {
      const { resolveVimeo } = createProviderResolvers({
        request: async () => jsonReply({}, status),
        sleep: async () => undefined,
      });
      const result = await resolveVimeo({ kind: 'user', handle: 'teststudio' }, 'TEST_ONLY_TOKEN');
      expect(result.last_error).toBe(error);
      expect(result.status).toBe(status === 404 ? 'invalid' : undefined);
    }
    const { resolveVimeo } = createProviderResolvers({
      request: async () => jsonReply({ ...vimeoUser, uri: '/videos/123' }),
    });
    expect((await resolveVimeo({ kind: 'user', handle: 'teststudio' }, 'TEST_ONLY_TOKEN')).last_error).toBe(
      'vimeo_bad_response',
    );
  });

  it('honors the reset and retries 429 at most three times with <=60 second cancellable waits', async () => {
    let time = 0;
    const sleep = vi.fn(async (ms: number) => {
      time += ms;
    });
    const request = vi
      .fn<SafeRequest>()
      .mockResolvedValue(jsonReply({}, 429, { 'x-ratelimit-reset': new Date(90_000).toISOString() }));
    const { resolveVimeo } = createProviderResolvers({ request, sleep, now: () => time, maxWaitMs: 300_000 });
    const result = await resolveVimeo({ kind: 'user', handle: 'teststudio' }, 'TEST_ONLY_TOKEN');
    expect(result.last_error).toBe('vimeo_rate_limited');
    expect(result.status).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.every(([ms]) => ms <= 60_000)).toBe(true);
    expect(time).toBeGreaterThanOrEqual(90_000);
  });

  it('defers a long reset without an early retry or an unbounded wait', async () => {
    const request = vi
      .fn<SafeRequest>()
      .mockResolvedValue(jsonReply({}, 429, { 'x-ratelimit-reset': new Date(600_000).toISOString() }));
    const sleep = vi.fn(async () => undefined);
    const { resolveVimeo } = createProviderResolvers({ request, sleep, now: () => 0 });
    expect((await resolveVimeo({ kind: 'user', handle: 'teststudio' }, 'TEST_ONLY_TOKEN')).last_error).toBe(
      'vimeo_rate_limit_deferred',
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('defers the next call after low remaining quota without losing a successful resolution', async () => {
    let time = 0;
    const sleep = vi.fn(async (ms: number) => {
      time += ms;
    });
    const request = vi
      .fn<SafeRequest>()
      .mockResolvedValueOnce(
        jsonReply(vimeoUser, 200, {
          'x-ratelimit-remaining': '9',
          'x-ratelimit-reset': new Date(30_000).toISOString(),
        }),
      )
      .mockResolvedValueOnce(jsonReply(vimeoUser));
    const resolver = createProviderResolvers({ request, sleep, now: () => time });
    expect(
      (await resolver.resolveVimeo({ kind: 'user', handle: 'teststudio' }, 'TEST_ONLY_TOKEN')).resolve_status,
    ).toBe('resolved');
    await resolver.resolveVimeo({ kind: 'user', handle: 'teststudio' }, 'TEST_ONLY_TOKEN');
    expect(time).toBe(30_000);
  });

  it('caps concurrent Vimeo calls at two', async () => {
    let active = 0;
    let peak = 0;
    const { resolveVimeo } = createProviderResolvers({
      request: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return jsonReply(vimeoUser);
      },
    });
    await Promise.all(
      Array.from({ length: 7 }, () =>
        resolveVimeo({ kind: 'user', handle: 'teststudio' }, 'TEST_ONLY_TOKEN'),
      ),
    );
    expect(peak).toBe(2);
  });

  it('cancels cooldown without another provider call or exposing an exception', async () => {
    const abort = new AbortController();
    const request = vi.fn<SafeRequest>().mockResolvedValue(jsonReply({}, 429));
    const { resolveVimeo } = createProviderResolvers({
      request,
      signal: abort.signal,
      sleep: async () => {
        abort.abort();
        throw new Error('not emitted');
      },
    });
    expect((await resolveVimeo({ kind: 'user', handle: 'teststudio' }, 'TEST_ONLY_TOKEN')).last_error).toBe(
      'vimeo_aborted',
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('YouTube one-unit channels lookup', () => {
  it.each([
    ['handle', 'teststudio', 'forHandle', '@teststudio'],
    ['channel', `UC${'a'.repeat(22)}`, 'id', `UC${'a'.repeat(22)}`],
    ['user', 'teststudio', 'forUsername', 'teststudio'],
    ['c', 'teststudio', 'forHandle', '@teststudio'],
  ] as const)(
    'resolves %s without search.list and without a credential in the URL',
    async (kind, value, filter, expected) => {
      const request = vi.fn<SafeRequest>().mockResolvedValue(jsonReply(youtubeChannel));
      const { resolveYouTube } = createProviderResolvers({ request });
      expect(await resolveYouTube({ kind, value }, 'TEST_ONLY_KEY')).toMatchObject({
        resolve_status: 'resolved',
        external_id: youtubeChannel.items[0]!.id,
        uploads_playlist_id: youtubeChannel.items[0]!.contentDetails.relatedPlaylists.uploads,
      });
      const url = new URL(request.mock.calls[0]![0]);
      expect(url.pathname).toBe('/youtube/v3/channels');
      expect(url.searchParams.get(filter)).toBe(expected);
      expect(url.searchParams.has('key')).toBe(false);
      expect(request.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-goog-api-key': 'TEST_ONLY_KEY' });
    },
  );

  it('accepts only a valid empty success as not-found; never converts an HTTP/API/shape failure to empty', async () => {
    const { resolveYouTube } = createProviderResolvers({ request: async () => jsonReply({ items: [] }) });
    expect(await resolveYouTube({ kind: 'c', value: 'missing' }, 'TEST_ONLY_KEY')).toMatchObject({
      resolve_status: 'failed',
      status: 'invalid',
      last_error: 'yt_custom_url_unresolved',
    });
    for (const [status, body, last_error] of [
      [403, { error: { errors: [{ reason: 'quotaExceeded' }] } }, 'yt_quota'],
      [401, {}, 'yt_auth'],
      [429, {}, 'yt_rate_limited'],
      [503, {}, 'yt_http_503'],
      [200, {}, 'yt_bad_response'],
    ] as const) {
      const resolver = createProviderResolvers({
        request: async () => jsonReply(body, status),
        sleep: async () => undefined,
      });
      expect(await resolver.resolveYouTube({ kind: 'handle', value: 'teststudio' }, 'TEST_ONLY_KEY')).toEqual(
        { resolve_status: 'failed', last_error },
      );
    }
  });

  it('requires channel and uploads IDs and rejects unexpectedly multiple or malformed items', async () => {
    for (const body of [
      { items: [{ id: 'anything' }] },
      { items: [youtubeChannel.items[0], youtubeChannel.items[0]] },
    ]) {
      const { resolveYouTube } = createProviderResolvers({ request: async () => jsonReply(body) });
      expect(
        (await resolveYouTube({ kind: 'handle', value: 'teststudio' }, 'TEST_ONLY_KEY')).last_error,
      ).toBe('yt_bad_response');
    }
  });

  it('rejects a mismatched returned channel for an explicit channel-ID lookup', async () => {
    const { resolveYouTube } = createProviderResolvers({ request: async () => jsonReply(youtubeChannel) });
    expect(
      (await resolveYouTube({ kind: 'channel', value: `UC${'b'.repeat(22)}` }, 'TEST_ONLY_KEY')).last_error,
    ).toBe('yt_bad_response');
  });
});

describe('format-only social checks and bounded website reachability', () => {
  it('checks Instagram/LinkedIn formats without network calls', () => {
    expect(validateInstagram('studio.name')).toBe(true);
    expect(validateInstagram('bad/name')).toBe(false);
    expect(validateLinkedIn({ kind: 'company', slug: 'test-studio' })).toBe(true);
    expect(validateLinkedIn({ kind: 'showcase', slug: 'test-studio' })).toBe(true);
    expect(validateLinkedIn({ kind: 'company', slug: 'studio.name' })).toBe(true);
    expect(validateLinkedIn({ kind: 'company', slug: 'فيلم' })).toBe(true);
    expect(validateLinkedIn({ kind: 'school', slug: 'school' })).toBe(false);
  });

  it('uses HEAD then GET only for 405/501 and preserves same-domain final URL', async () => {
    const request = vi
      .fn<SafeRequest>()
      .mockResolvedValueOnce(jsonReply({}, 405))
      .mockResolvedValueOnce({ ...jsonReply({}, 200), url: 'https://www.example.com/work/' });
    expect(await checkWebsite('https://example.com/work', { request })).toEqual({
      resolve_status: 'not_needed',
      last_error: null,
      url: 'https://www.example.com/work/',
    });
    expect(request.mock.calls.map(([, options]) => options?.method)).toEqual(['HEAD', 'GET']);
  });

  it('reports HTTP/network failures without setting invalid or changing gating status', async () => {
    expect(await checkWebsite('https://example.com/', { request: async () => jsonReply({}, 503) })).toEqual({
      resolve_status: 'not_needed',
      last_error: 'unreachable_503',
    });
    expect(
      await checkWebsite('https://example.com/', {
        request: async () => {
          throw new Error('secret-value');
        },
      }),
    ).toEqual({ resolve_status: 'not_needed', last_error: 'unreachable_network' });
  });
});
