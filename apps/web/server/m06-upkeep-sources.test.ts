// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, request as httpRequest, type Server, type IncomingMessage } from 'node:http';
vi.mock('server-only', () => ({}));
import { readUpkeepSourceJson, upkeepSourcePorts } from './m06-upkeep-sources';
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((r) => {
          s.closeAllConnections();
          s.close(() => r());
        }),
    ),
  );
});
const env = { EMR_UPKEEP_VIMEO_TOKEN: 'synthetic-vimeo', EMR_UPKEEP_YOUTUBE_API_KEY: 'synthetic-youtube' };
const endpoint = 'https://api.vimeo.com/users/42/videos?page=1&per_page=100&sort=date&direction=desc';
const dns = async () => [{ address: '8.8.8.8', family: 4 }];
async function local(body: string, status = 200, headers: Record<string, string> = {}) {
  const server = createServer((_q, r) => {
    r.writeHead(status, { 'content-type': 'application/json', ...headers });
    r.end(body);
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('fixture');
  const observed: Record<string, unknown>[] = [];
  const transport = ((options: Record<string, unknown>, cb: (r: IncomingMessage) => void) => {
    observed.push(options);
    return httpRequest(
      {
        ...options,
        hostname: '127.0.0.1',
        host: '127.0.0.1',
        port: address.port,
        protocol: 'http:',
        lookup: undefined,
      },
      cb,
    );
  }) as Parameters<typeof readUpkeepSourceJson>[4];
  return { transport, observed };
}
describe('restricted upkeep source transport', () => {
  it('uses only exact official GET origins and strict TLS options with server-selected credentials', async () => {
    const f = await local('{"data":[]}');
    await expect(
      readUpkeepSourceJson('vimeo', endpoint, env, undefined, f.transport, dns),
    ).resolves.toMatchObject({ status: 200, body: { data: [] } });
    expect(f.observed[0]).toMatchObject({
      hostname: 'api.vimeo.com',
      method: 'GET',
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      headers: { authorization: 'Bearer synthetic-vimeo' },
    });
    const g = await local('{"items":[]}');
    await readUpkeepSourceJson(
      'youtube',
      'https://www.googleapis.com/youtube/v3/videos?id=fixture0001&part=statistics',
      env,
      undefined,
      g.transport,
      dns,
    );
    expect(g.observed[0]!.path).toContain('key=synthetic-youtube');
    expect((g.observed[0]!.headers as Record<string, unknown>).authorization).toBeUndefined();
  });
  it('rejects unsafe/mixed DNS and external-origin/credential overrides before network', async () => {
    const f = await local('{}');
    for (const addresses of [
      [{ address: '127.0.0.1', family: 4 }],
      [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
    ])
      await expect(
        readUpkeepSourceJson('vimeo', endpoint, env, undefined, f.transport, async () => addresses),
      ).rejects.toThrow();
    for (const url of [
      'https://example.com/users/42/videos',
      'https://api.vimeo.com/users/42/videos?token=caller',
      'http://api.vimeo.com/users/42/videos',
    ])
      await expect(readUpkeepSourceJson('vimeo', url, env, undefined, f.transport, dns)).rejects.toThrow();
    expect(f.observed).toHaveLength(0);
  });
  it('refuses redirects, compression and streamed oversize without retrying', async () => {
    for (const f of [
      await local('{}', 302, { location: 'https://example.com/' }),
      await local('{}', 200, { 'content-encoding': 'gzip' }),
      await local(JSON.stringify({ large: 'x'.repeat(2097153) })),
    ]) {
      await expect(
        readUpkeepSourceJson('vimeo', endpoint, env, undefined, f.transport, dns),
      ).rejects.toThrow();
      expect(f.observed).toHaveLength(1);
    }
  });
  it('cancels before DNS, fails missing bindings and never starts an actor', async () => {
    const f = await local('{}'),
      resolve = vi.fn(dns),
      controller = new AbortController();
    controller.abort();
    await expect(
      readUpkeepSourceJson('vimeo', endpoint, env, controller.signal, f.transport, resolve),
    ).rejects.toThrow();
    expect(resolve).not.toHaveBeenCalled();
    await expect(
      readUpkeepSourceJson('vimeo', endpoint, {}, undefined, f.transport, resolve),
    ).rejects.toThrow('M06_UPKEEP_SOURCE_BINDING_REQUIRED');
    expect(f.observed).toHaveLength(0);
    await expect(
      upkeepSourcePorts({}).actorSnapshot!({
        actor: 'apify/instagram-scraper',
        account_id: 'synthetic',
        pass: 'posts',
        since: '2026-10-01',
        run_id: 'known',
        actor_id: 'apify/instagram-scraper',
        build_id: null,
      }),
    ).rejects.toThrow('M06_UPKEEP_SOURCE_PIN_REQUIRED');
  });
});
