import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, request as httpRequest, type Server, type IncomingMessage } from 'node:http';
import {
  boundedApifyJson,
  publicApifyAddresses,
  readFoundationDataset,
  readFoundationLaunch,
  projectFoundationInput,
  pinnedInputDefaults,
} from './apify-reader';
import { foundationSmokeInput } from '@emr/shared';
vi.mock('server-only', () => ({}));
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
async function local(body: string, headers: Record<string, string> = {}, code = 200) {
  const server = createServer((_req, res) => {
    res.writeHead(code, { 'content-type': 'application/json', ...headers });
    res.end(body);
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('fixture');
  const observed: unknown[] = [];
  const transport = ((options: unknown, callback: (res: IncomingMessage) => void) => {
    observed.push(options);
    return httpRequest(
      {
        ...(options as object),
        host: '127.0.0.1',
        hostname: '127.0.0.1',
        port: address.port,
        protocol: 'http:',
        lookup: undefined,
      },
      callback,
    );
  }) as Parameters<typeof boundedApifyJson>[3];
  return { transport, observed };
}
describe('bounded fixed Apify reader', () => {
  it('rejects private, mapped and mixed DNS answers instead of falling back to a public address', () => {
    for (const rows of [
      [{ address: '127.0.0.1', family: 4 }],
      [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
      [{ address: '::ffff:127.0.0.1', family: 6 }],
      [{ address: '2001:db8::1', family: 6 }],
      [],
    ])
      expect(() => publicApifyAddresses(rows)).toThrow('EMR_APIFY_RESPONSE_REJECTED');
    expect(publicApifyAddresses([{ address: '8.8.8.8', family: 4 }])).toEqual({
      address: '8.8.8.8',
      family: 4,
    });
  });
  it('propagates a parent abort before DNS/request and during streaming, waiting for its socket to close', async () => {
    const stopped = new AbortController();
    stopped.abort();
    const never = vi.fn(async () => [{ address: '8.8.8.8', family: 4 }]);
    await expect(
      boundedApifyJson('/v2/actor-runs/Original1', 'synthetic', 65536, undefined, stopped.signal, never),
    ).rejects.toThrow('EMR_APIFY_RESPONSE_REJECTED');
    expect(never).not.toHaveBeenCalled();
    const running = new AbortController();
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{');
      setTimeout(() => running.abort(), 5);
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('fixture');
    const transport = ((options: object, cb: (res: IncomingMessage) => void) =>
      httpRequest(
        { ...options, hostname: '127.0.0.1', port: address.port, protocol: 'http:', lookup: undefined },
        cb,
      )) as Parameters<typeof boundedApifyJson>[3];
    await expect(
      boundedApifyJson(
        '/v2/actor-runs/Original1',
        'synthetic',
        65536,
        transport,
        running.signal,
        async () => [{ address: '8.8.8.8', family: 4 }],
      ),
    ).rejects.toThrow('EMR_APIFY_RESPONSE_REJECTED');
  });
  it('stops before downloading a declared oversized response and closes its child socket', async () => {
    const f = await local('tiny', { 'content-length': '262145' });
    await expect(
      boundedApifyJson('/v2/actor-runs/Original1', 'synthetic', 262144, f.transport, undefined, async () => [
        { address: '8.8.8.8', family: 4 },
      ]),
    ).rejects.toThrow('EMR_APIFY_RESPONSE_REJECTED');
  });
  it('enforces streamed bytes when content-length is absent, with no retries', async () => {
    const f = await local(JSON.stringify({ long: 'x'.repeat(500) }));
    await expect(
      boundedApifyJson('/v2/actor-runs/Original1', 'synthetic', 64, f.transport, undefined, async () => [
        { address: '8.8.8.8', family: 4 },
      ]),
    ).rejects.toThrow('EMR_APIFY_RESPONSE_REJECTED');
    expect(f.observed).toHaveLength(1);
  });
  it('uses a fixed TLS host, no redirects/compression/keepalive and returns only parsed completed JSON', async () => {
    const f = await local('{"ok":true}');
    await expect(
      boundedApifyJson('/v2/actor-runs/Original1', 'synthetic', 64, f.transport, undefined, async () => [
        { address: '8.8.8.8', family: 4 },
      ]),
    ).resolves.toEqual({ ok: true });
    expect(f.observed[0]).toMatchObject({
      hostname: 'api.apify.com',
      port: 443,
      method: 'GET',
      rejectUnauthorized: true,
      agent: false,
      headers: { 'accept-encoding': 'identity' },
    });
  });
  it('rejects redirects, compressed data, invalid/truncated JSON and caller supplied hosts without leaking errors', async () => {
    for (const [body, headers, status] of [
      ['{}', {}, 302],
      ['{}', { 'content-encoding': 'gzip' }, 200],
      ['{', {}, 200],
    ] as const) {
      const f = await local(body, headers, status);
      await expect(
        boundedApifyJson('/v2/actor-runs/Original1', 'synthetic', 64, f.transport, undefined, async () => [
          { address: '8.8.8.8', family: 4 },
        ]),
      ).rejects.toThrow('EMR_APIFY_RESPONSE_REJECTED');
    }
    const f = await local('{}');
    await expect(
      boundedApifyJson('https://unrelated.invalid/', 'synthetic', 64, f.transport, undefined, async () => [
        { address: '8.8.8.8', family: 4 },
      ]),
    ).rejects.toThrow('EMR_APIFY_READER_INPUT_INVALID');
    expect(f.observed).toHaveLength(0);
  });
  it('never accepts a dataset id from a caller and filters data before it reaches n8n', async () => {
    const calls: { path: string; limit: number }[] = [];
    const registry = {
      apify_run_id: 'Original1',
      actor_id: 'aYG0l9s7dbB7j3gbS',
      run_id: '01111111-1111-4111-8111-111111111111',
      account_ids: ['02222222-2222-4222-8222-222222222222'],
      purpose: 'daily',
      processed_at: null,
    };
    const get = async (path: string, _token: string, limit: number) => {
      calls.push({ path, limit });
      return calls.length === 1
        ? {
            data: {
              id: 'Original1',
              actId: 'aYG0l9s7dbB7j3gbS',
              status: 'SUCCEEDED',
              buildId: 'BdKJRCYsnmlzPfH3n',
              buildNumber: '0.3.99',
              defaultDatasetId: 'TrustedDataset',
              usageTotalUsd: 0.01,
              finishedAt: '2026-10-19T01:00:00Z',
            },
          }
        : [
            {
              url: 'https://everyone.film/about-everyone',
              markdown: 'public',
              metadata: { title: 'Public', unrelated: 'discard' },
              crawl: { loadedUrl: 'https://everyone.film/about-everyone' },
              unrelated: 'discard',
            },
          ];
    };
    const result = await readFoundationDataset(registry, 'synthetic', get);
    expect(calls[0]?.limit).toBe(65536);
    expect(calls[1]?.limit).toBe(262144);
    expect(calls[1]?.path).toContain('/v2/datasets/TrustedDataset/items?');
    expect(JSON.stringify(result)).not.toContain('discard');
    expect(result.rows).toHaveLength(1);
    expect(result.terminal.accountId).toBe(registry.account_ids[0]);
  });
  it('projects an empty title to the existing normalizer null representation before trusted SQL equality', async () => {
    const registry = {
      apify_run_id: 'Original1',
      actor_id: 'aYG0l9s7dbB7j3gbS',
      run_id: '01111111-1111-4111-8111-111111111111',
      account_ids: ['02222222-2222-4222-8222-222222222222'],
      purpose: 'daily',
      processed_at: null,
    };
    const get = async (path: string) =>
      path.includes('actor-runs')
        ? {
            data: {
              id: 'Original1',
              actId: 'aYG0l9s7dbB7j3gbS',
              status: 'SUCCEEDED',
              buildId: 'BdKJRCYsnmlzPfH3n',
              buildNumber: '0.3.99',
              defaultDatasetId: 'Dataset1',
              usageTotalUsd: 0.01,
              finishedAt: '2026-10-19T01:00:00Z',
            },
          }
        : [{ url: 'https://everyone.film/about-everyone', markdown: 'public', metadata: { title: '' } }];
    const result = await readFoundationDataset(registry, 'synthetic', get);
    expect(result.rows[0]?.metadata.title).toBeNull();
  });
  it('reconciles only the exact original authenticated run and INPUT against the server-owned admission', async () => {
    const input = structuredClone(foundationSmokeInput),
      saved = {
        launch_id: '01111111-1111-4111-8111-111111111111',
        actor_id: 'aYG0l9s7dbB7j3gbS',
        actor_build: '0.3.99',
        input,
        post_intent_at: '2026-10-19T01:00:00Z',
        apify_run_id: null,
        max_total_charge_usd: 1,
      };
    const d = {
      id: 'Original1',
      actId: 'aYG0l9s7dbB7j3gbS',
      buildNumber: '0.3.99',
      buildId: 'BdKJRCYsnmlzPfH3n',
      startedAt: '2026-10-19T01:00:01Z',
      defaultKeyValueStoreId: 'OriginalKvs',
      options: { memoryMbytes: 1024, timeoutSecs: 300, maxTotalChargeUsd: 1 },
    };
    const calls: { path: string; limit: number }[] = [];
    const get = async (path: string, _token: string, limit: number) => {
      calls.push({ path, limit });
      return path.includes('actor-runs') ? { data: d } : input;
    };
    const result = await readFoundationLaunch({ launch: saved, apify_run_id: 'Original1' }, 'synthetic', get);
    expect(result.launch).toEqual({
      launch_id: saved.launch_id,
      apify_run_id: 'Original1',
      actor_id: d.actId,
      actor_build: '0.3.99',
      started_at: d.startedAt,
      input,
    });
    expect(calls.map((c) => c.limit)).toEqual([65536, 4096]);
    expect(calls[1]?.path).toBe('/v2/key-value-stores/OriginalKvs/records/INPUT');
    for (const changed of [
      { ...d, id: 'Different' },
      { ...d, buildNumber: '0.3.98' },
      { ...d, options: { ...d.options, memoryMbytes: 2048 } },
      { ...d, startedAt: '2026-10-19T02:00:00Z' },
    ])
      await expect(
        readFoundationLaunch({ launch: saved, apify_run_id: 'Original1' }, 'synthetic', async () => ({
          data: changed,
        })),
      ).rejects.toThrow('EMR_APIFY_LAUNCH_RECONCILIATION_REQUIRED');
    await expect(
      readFoundationLaunch({ launch: saved, apify_run_id: 'Original1' }, 'synthetic', async (path) =>
        path.includes('actor-runs') ? { data: d } : { ...input, extra: 'changed' },
      ),
    ).rejects.toThrow('EMR_APIFY_LAUNCH_RECONCILIATION_REQUIRED');
  });
  it('permits only exact pinned schema defaults in addition to the seventeen exact submitted constraints', () => {
    const defaults = { ...pinnedInputDefaults, ...foundationSmokeInput };
    expect(projectFoundationInput(defaults)).toEqual(foundationSmokeInput);
    expect(Buffer.byteLength(JSON.stringify(defaults), 'utf8')).toBeLessThan(4096);
    expect(Buffer.byteLength(JSON.stringify(defaults, null, 2), 'utf8')).toBeLessThan(4096);
    for (const input of [
      { ...defaults, customHttpHeaders: { authorization: 'synthetic-disallowed' } },
      { ...defaults, pageFunction: 'nonempty code' },
      { ...defaults, initialCookies: [] },
      { ...defaults, maxCrawlPages: 2 },
      { ...defaults, unknown: false },
      { ...defaults, debugLog: true },
    ])
      expect(() => projectFoundationInput(input)).toThrow('EMR_APIFY_LAUNCH_RECONCILIATION_REQUIRED');
  });
});
