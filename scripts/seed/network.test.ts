import { describe, expect, it, vi } from 'vitest';
import { isPublicAddress, safeRequest, type NetworkDependencies } from './network';

const publicLookup: NetworkDependencies['lookup'] = async () => [{ address: '93.184.216.34', family: 4 }];
const reply = (status = 200, headers: Record<string, string> = {}, body = '') => ({
  status,
  headers: new Headers(headers),
  body: new TextEncoder().encode(body),
});

describe('public network boundary', () => {
  it.each([
    '127.0.0.1',
    '0.0.0.0',
    '10.0.0.1',
    '172.31.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.1.1',
    '192.0.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '2001:db8::1',
    '64:ff9b::a00:1',
  ])('denies non-public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111'])('accepts public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    'http://example.com/',
    'https://a:b@example.com/',
    'https://localhost/',
    'https://127.1/',
    'https://example.com:444/',
  ])('rejects unsafe URL %s before transport', async (url) => {
    const transport = vi.fn(async () => reply());
    await expect(safeRequest(url, {}, { lookup: publicLookup, transport })).rejects.toThrow('unsafe_url');
    expect(transport).not.toHaveBeenCalled();
  });

  it('denies a host when even one DNS answer is private', async () => {
    const transport = vi.fn(async () => reply());
    await expect(
      safeRequest(
        'https://example.com',
        {},
        {
          lookup: async () => [
            { address: '93.184.216.34', family: 4 },
            { address: '10.0.0.1', family: 4 },
          ],
          transport,
        },
      ),
    ).rejects.toThrow('unsafe_address');
    expect(transport).not.toHaveBeenCalled();
  });

  it('passes only the validated pinned address to the transport', async () => {
    const transport = vi.fn<NetworkDependencies['transport']>(async () => reply());
    await safeRequest('https://example.com/path', {}, { lookup: publicLookup, transport });
    expect(transport.mock.calls[0]?.[0]).toMatchObject({ address: { address: '93.184.216.34', family: 4 } });
  });

  it('blocks a cross-origin redirect before forwarding an authorization header', async () => {
    const transport = vi.fn(async () => reply(302, { location: 'https://other.example/' }));
    await expect(
      safeRequest(
        'https://api.vimeo.com/users/a',
        {
          headers: { authorization: 'bearer TEST_ONLY_TOKEN' },
          allowedOrigins: ['https://api.vimeo.com'],
        },
        { lookup: publicLookup, transport },
      ),
    ).rejects.toThrow('redirect_blocked');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('revalidates DNS before a same-host redirect', async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }]);
    const transport = vi.fn(async () => reply(302, { location: '/next' }));
    await expect(
      safeRequest('https://example.com/', { maxRedirects: 2 }, { lookup, transport }),
    ).rejects.toThrow('unsafe_address');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('allows bare/www website redirects but refuses unrelated subdomains', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(reply(301, { location: 'https://www.example.com/work' }))
      .mockResolvedValueOnce(reply());
    const result = await safeRequest(
      'https://example.com/',
      { sameDomainRedirects: true },
      { lookup: publicLookup, transport },
    );
    expect(result.url).toBe('https://www.example.com/work');
    await expect(
      safeRequest(
        'https://example.com/',
        { sameDomainRedirects: true },
        {
          lookup: publicLookup,
          transport: async () => reply(302, { location: 'https://admin.example.com/' }),
        },
      ),
    ).rejects.toThrow('redirect_blocked');
  });

  it('bounds redirect loops, response bytes, DNS time and cancellation', async () => {
    await expect(
      safeRequest(
        'https://example.com',
        { maxRedirects: 1 },
        {
          lookup: publicLookup,
          transport: async () => reply(302, { location: '/again' }),
        },
      ),
    ).rejects.toThrow('too_many_redirects');
    await expect(
      safeRequest(
        'https://example.com',
        { maxBytes: 2 },
        {
          lookup: publicLookup,
          transport: async () => reply(200, {}, 'abc'),
        },
      ),
    ).rejects.toThrow('response_too_large');
    await expect(
      safeRequest(
        'https://example.com',
        { timeoutMs: 5 },
        {
          lookup: () => new Promise(() => undefined),
          transport: async () => reply(),
        },
      ),
    ).rejects.toThrow('timeout');
    await expect(
      safeRequest(
        'https://example.com',
        { signal: AbortSignal.abort() },
        {
          lookup: publicLookup,
          transport: async () => reply(),
        },
      ),
    ).rejects.toThrow('aborted');
  });

  it('withholds raw transport errors and refuses cookies', async () => {
    await expect(
      safeRequest(
        'https://example.com',
        {},
        {
          lookup: publicLookup,
          transport: async () => {
            throw new Error('credential-bearing-raw-error');
          },
        },
      ),
    ).rejects.toThrow(/^network$/);
    await expect(
      safeRequest(
        'https://example.com',
        { headers: { cookie: 'session=private' } },
        {
          lookup: publicLookup,
          transport: async () => reply(),
        },
      ),
    ).rejects.toThrow('unsafe_headers');
  });

  it('allows a provided public website Referer only as its origin, then drops it across origins', async () => {
    const transport = vi
      .fn<NetworkDependencies['transport']>()
      .mockResolvedValueOnce(reply(302, { location: 'https://images.example.com/logo' }))
      .mockResolvedValueOnce(reply());
    await safeRequest(
      'https://cdn.example.com/logo',
      {
        headers: { referer: 'https://studio.example.com/work?tracking=discard' },
        refererOrigin: 'https://studio.example.com',
        allowedOrigins: ['https://cdn.example.com', 'https://images.example.com'],
      },
      { lookup: publicLookup, transport },
    );
    expect(transport.mock.calls[0]?.[0].headers.referer).toBe('https://studio.example.com/');
    expect(transport.mock.calls[1]?.[0].headers.referer).toBeUndefined();
  });

  it('derives a sanitized Referer from the explicit website origin without raw header input', async () => {
    const transport = vi.fn<NetworkDependencies['transport']>(async () => reply());
    await safeRequest(
      'https://cdn.example.com/logo',
      { refererOrigin: 'https://studio.example.com/work?discard=yes' },
      { lookup: publicLookup, transport },
    );
    expect(transport.mock.calls[0]?.[0].headers.referer).toBe('https://studio.example.com/');
  });

  it.each([
    { headers: { referer: 'https://studio.example.com/' } },
    { headers: { referer: 'https://evil.example.com/' }, refererOrigin: 'https://studio.example.com' },
    { headers: { referer: 'http://studio.example.com/' }, refererOrigin: 'https://studio.example.com' },
    { headers: { referer: 'https://a:b@studio.example.com/' }, refererOrigin: 'https://studio.example.com' },
    { headers: { referer: 'https://127.0.0.1/' }, refererOrigin: 'https://127.0.0.1' },
  ])('rejects an unauthorized Referer configuration', async (options) => {
    const transport = vi.fn<NetworkDependencies['transport']>(async () => reply());
    await expect(
      safeRequest('https://cdn.example.com/logo', options, { lookup: publicLookup, transport }),
    ).rejects.toThrow('unsafe_headers');
    expect(transport).not.toHaveBeenCalled();
  });
});
