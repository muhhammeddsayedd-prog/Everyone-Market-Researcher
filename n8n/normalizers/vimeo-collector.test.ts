import { describe, expect, it } from 'vitest';
import { collectVimeoAccount, vimeoEndpoint } from '../collectors/vimeo.mjs';
type Row = Record<string, unknown>;
const account = {
  url: 'https://vimeo.com/everyone',
  handle: 'everyone',
  external_id: '123',
  backfill_from: '2024-01-01',
  last_item_published_at: '2026-10-20T00:00:00Z',
};
const config = { mode: 'daily', now: '2026-10-26T00:00:00Z' };
const raw = (id: string, date = '2026-10-20T00:00:00Z') => ({
  uri: `/videos/${id}`,
  link: `https://vimeo.com/${id}`,
  privacy: { view: 'anybody' },
  release_time: date,
});
const response = (data: Row[], next: string | null = null, headers = {}) => ({
  status: 200,
  headers,
  body: { data, paging: { next } },
});
function transport(responses: unknown[]) {
  const requests: { method: string; url: string }[] = [],
    waits: number[] = [];
  return {
    requests,
    waits,
    deps: {
      request: async (r: { method: string; url: string }) => {
        requests.push(r);
        return responses.shift();
      },
      wait: async (ms: number) => {
        waits.push(ms);
      },
    },
  };
}
describe('official Vimeo collector with injected transport — no live calls', () => {
  it('resolves an unresolved official API user then lists and normalizes once', async () => {
    const t = transport([{ status: 200, body: { uri: '/users/123' } }, response([raw('999')])]);
    const r = await collectVimeoAccount({ ...account, external_id: null }, config, t.deps);
    expect(r).toMatchObject({
      status: 'success',
      apiRequestCount: 2,
      resolvedExternalId: '123',
      complete: true,
    });
    expect(r.normalizedItems).toHaveLength(1);
    expect(t.requests[0]?.url).toBe('https://api.vimeo.com/users/everyone?fields=uri,name,link');
    expect(new URL(t.requests[1]?.url ?? '').searchParams.get('per_page')).toBe('100');
  });
  it('uses collection-specific endpoints and refuses guessed showcase ownership or foreign URLs', () => {
    expect(vimeoEndpoint({ url: 'https://vimeo.com/channels/staffpicks' })).toMatchObject({
      resourcePath: '/channels/staffpicks',
    });
    expect(vimeoEndpoint({ url: 'https://vimeo.com/groups/films' })).toMatchObject({
      resourcePath: '/groups/films',
    });
    expect(() => vimeoEndpoint({ url: 'https://vimeo.com/showcase/42' })).toThrow(
      'vimeo_showcase_owner_required',
    );
    expect(
      vimeoEndpoint({
        url: 'https://vimeo.com/showcase/42',
        backfill_cursor: { resourcePath: '/users/123/albums/42' },
      }),
    ).toMatchObject({ resourcePath: '/users/123/albums/42' });
    expect(() => vimeoEndpoint({ url: 'https://vimeo.com.evil.invalid/everyone' })).toThrow();
  });
  it('refreshes metrics on known items across 30 days rather than stopping at watermark', async () => {
    const t = transport([
      response(
        [raw('999'), raw('998', '2026-10-01T00:00:00Z'), raw('997', '2026-09-01T00:00:00Z')],
        '/users/123/videos?page=2',
      ),
    ]);
    const r = await collectVimeoAccount(account, config, t.deps);
    expect(r.normalizedItems).toHaveLength(2);
    expect(r.complete).toBe(true);
    expect(t.requests).toHaveLength(1);
  });
  it('resumes backfill and returns an incomplete cursor at the page cap', async () => {
    const t = transport([response([raw('999')], '/users/123/videos?page=5')]);
    const r = await collectVimeoAccount(
      { ...account, backfill_cursor: { page: 4, endpoint: 'users', resourcePath: '/users/123' } },
      { ...config, mode: 'backfill', maxPages: 1 },
      t.deps,
    );
    expect(new URL(t.requests[0]?.url ?? '').searchParams.get('page')).toBe('4');
    expect(r).toMatchObject({
      status: 'success',
      backfillDone: false,
      complete: false,
      cursor: { page: 5, endpoint: 'users' },
    });
  });
  it('rejects a cursor bound to another resolved user before a page request or completion', async () => {
    const t = transport([response([])]);
    const r = await collectVimeoAccount(
      { ...account, backfill_cursor: { endpoint: 'users', resourcePath: '/users/999', page: 4 } },
      { ...config, mode: 'backfill' },
      t.deps,
    );
    expect(r).toMatchObject({
      status: 'failed',
      error: 'vimeo_invalid_cursor',
      backfillDone: false,
      apiRequestCount: 0,
    });
    expect(t.requests).toEqual([]);
  });
  it('validates the cursor against a freshly resolved identity before fetching a page', async () => {
    const t = transport([{ status: 200, body: { uri: '/users/123' } }, response([])]);
    const r = await collectVimeoAccount(
      {
        ...account,
        external_id: null,
        backfill_cursor: { endpoint: 'users', resourcePath: '/users/999', page: 4 },
      },
      { ...config, mode: 'backfill' },
      t.deps,
    );
    expect(r).toMatchObject({
      status: 'failed',
      error: 'vimeo_invalid_cursor',
      backfillDone: false,
      apiRequestCount: 1,
    });
    expect(t.requests).toHaveLength(1);
    expect(t.requests[0]?.url).toContain('/users/everyone?');
  });
  it('waits 60 seconds and performs at most three 429 retries, counting every API call', async () => {
    const t = transport(Array.from({ length: 4 }, () => ({ status: 429 })));
    const r = await collectVimeoAccount(account, config, t.deps);
    expect(r).toMatchObject({ status: 'failed', error: 'vimeo_rate_limited', apiRequestCount: 4 });
    expect(t.waits).toEqual([60000, 60000, 60000]);
  });
  it('honors bounded reset headers before fetching the next page', async () => {
    const t = transport([
      response([raw('999')], '/users/123/videos?page=2', {
        'X-RateLimit-Remaining': '9',
        'X-RateLimit-Reset': '2026-10-26T00:01:00Z',
      }),
      response([]),
    ]);
    expect((await collectVimeoAccount(account, config, t.deps)).status).toBe('success');
    expect(t.waits).toEqual([60000]);
  });
  it('honors the resolver cooldown too and stops before a wait beyond ten minutes', async () => {
    const t = transport([
      {
        status: 200,
        body: { uri: '/users/123' },
        headers: { 'X-RateLimit-Remaining': '9', 'X-RateLimit-Reset': '2026-10-26T00:11:00Z' },
      },
    ]);
    const r = await collectVimeoAccount({ ...account, external_id: null }, config, t.deps);
    expect(r).toMatchObject({ status: 'failed', error: 'vimeo_rate_limited', apiRequestCount: 1 });
    expect(t.requests).toHaveLength(1);
    expect(t.waits).toEqual([]);
  });
  it('rejects malicious pagination without forwarding credentials or requesting that URL', async () => {
    for (const next of [
      'https://evil.invalid/users/123/videos?page=2',
      '/users/123/videos?page=2&access_token=never',
      '/users/999/videos?page=2',
      '/users/123/videos?page=1',
    ]) {
      const t = transport([response([raw('999')], next)]);
      expect((await collectVimeoAccount(account, config, t.deps)).error).toBe('vimeo_invalid_pagination');
      expect(t.requests).toHaveLength(1);
    }
  });
  it('does not claim completion or retain uncommitted items after a later page failure', async () => {
    const t = transport([response([raw('999')], '/users/123/videos?page=2'), { status: 404 }]);
    const r = await collectVimeoAccount(account, config, t.deps);
    expect(r).toMatchObject({
      status: 'failed',
      error: 'vimeo_api_404',
      backfillDone: false,
      cursor: null,
      normalizedItems: [],
      fallback: { actor: 'goat255/vimeo-scraper', blocked: true },
    });
  });
  it('does not mark a truncated or unsorted response backfilled', async () => {
    const t = transport([response([raw('999', '2026-10-01T00:00:00Z'), raw('998', '2026-10-20T00:00:00Z')])]);
    expect((await collectVimeoAccount(account, { ...config, mode: 'backfill' }, t.deps)).error).toBe(
      'vimeo_unsorted_page',
    );
  });
  it('refuses an invalid configured history cutoff before any request', async () => {
    const t = transport([]);
    const r = await collectVimeoAccount({ ...account, backfill_from: '2024-02-30' }, config, t.deps);
    expect(r).toMatchObject({ status: 'failed', error: 'vimeo_invalid_config', apiRequestCount: 0 });
    expect(t.requests).toEqual([]);
  });
  it('redacts a thrown native credential/network error to one fixed diagnostic', async () => {
    const r = await collectVimeoAccount(account, config, {
      request: async () => {
        throw new Error('credential=never-print');
      },
      wait: async () => undefined,
    });
    expect(r.error).toBe('vimeo_transport_failed');
    expect(JSON.stringify(r)).not.toContain('never-print');
  });
});
