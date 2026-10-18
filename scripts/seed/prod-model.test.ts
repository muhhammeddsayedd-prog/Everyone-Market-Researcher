import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadSeedInput, planSeed } from './seed-competitors';
import { seedSourceFiles } from './files';
import {
  assertProdPayload,
  assertProdPacket,
  assertProdLogos,
  prodTarget,
  prodExcludedYouTube,
} from './prod-model';

const root = fileURLToPath(new URL('../..', import.meta.url));
const sources = await seedSourceFiles(root);
const plan = planSeed(loadSeedInput(sources));
let websiteIndex = 0;
const payload = {
  version: 1,
  sourceProjectRef: 'zmotjsbzhzjvpelxvxlf',
  observedAt: '2026-10-18T02:00:00Z',
  sourceSha256: sources.sourceSha256,
  accounts: plan.accounts.map((row, index) => ({
    sourceKey: row.sourceKey,
    company_code: row.company_code,
    platform: row.platform,
    sourceHandle: row.handle,
    sourceUrl: row.url,
    handle: row.handle,
    url: row.url,
    status: row.status,
    resolve_status:
      row.platform === 'vimeo'
        ? 'resolved'
        : row.platform === 'youtube'
          ? row.status === 'invalid'
            ? 'failed'
            : 'resolved'
          : 'not_needed',
    external_id:
      row.platform === 'vimeo'
        ? String(index + 1)
        : row.platform === 'youtube' && row.status !== 'invalid'
          ? row.handle.startsWith('channel/')
            ? row.handle.slice(8)
            : `UC${String(index).padStart(22, '0')}`
          : null,
    uploads_playlist_id:
      row.platform === 'youtube' && row.status !== 'invalid'
        ? row.handle.startsWith('channel/')
          ? `UU${row.handle.slice(10)}`
          : `UU${String(index).padStart(22, '0')}`
        : null,
    backfill_cursor: null,
    last_error:
      ['website', 'website_work_page'].includes(row.platform) && websiteIndex++ < 23
        ? 'unreachable_timeout'
        : null,
  })),
};
const packet = {
  version: 1,
  target: prodTarget.ref,
  approved: true,
  approvalReference: 'owner: approved: seed prod',
  sourceSha256: sources.sourceSha256,
  payloadSha256: 'a'.repeat(64),
  logoManifestSha256: 'b'.repeat(64),
  baselineSvgSha256: 'c'.repeat(64),
  limits: {
    competitors: 285,
    accounts: 1754,
    logos: 257,
    uploadedBytes: 1560325,
    devPublicGets: 257,
    prodPublicGets: 257,
    storageUploads: 257,
  },
  expectedIncrementalUsd: 0,
  paidProviderCalls: 0,
  externalProviderCalls: 0,
};
describe('frozen production configuration', () => {
  it('accepts exact source-bound public identities and preserves all seven explicit invalids', () => {
    const accepted = assertProdPayload(payload, plan, sources.sourceSha256);
    expect(accepted.accounts).toHaveLength(1754);
    expect(
      accepted.accounts
        .filter((row) => row.platform === 'youtube' && row.status === 'invalid')
        .map((row) => row.company_code)
        .sort(),
    ).toEqual([...prodExcludedYouTube]);
  });
  it.each(['sourceKey', 'company_code', 'sourceHandle', 'sourceUrl', 'handle'])(
    'rejects changed %s binding',
    (field) => {
      const bad = structuredClone(payload);
      Object.assign(bad.accounts[0]!, { [field]: 'changed' });
      expect(() => assertProdPayload(bad, plan, sources.sourceSha256)).toThrow('M02_PROD_PAYLOAD_REJECTED');
    },
  );
  it('rejects unknown operational data, missing/extra accounts, invalid identifiers and undisclosed exclusions', () => {
    for (const mutate of [
      (value: typeof payload) => Object.assign(value.accounts[0]!, { id: 'dev-uuid' }),
      (value: typeof payload) => value.accounts.pop(),
      (value: typeof payload) => value.accounts.push(value.accounts[0]!),
      (value: typeof payload) => {
        value.accounts.find((row) => row.platform === 'vimeo')!.external_id = 'not-numeric';
      },
      (value: typeof payload) => {
        value.accounts.find((row) => row.platform === 'youtube' && row.status === 'invalid')!.external_id =
          'UC123';
      },
    ]) {
      const bad = structuredClone(payload);
      mutate(bad);
      expect(() => assertProdPayload(bad, plan, sources.sourceSha256)).toThrow('M02_PROD_PAYLOAD_REJECTED');
    }
  });
  it('rejects cross-origin website redirects and credential-bearing final URLs', () => {
    const privateUrl = new URL('https://original.example/');
    privateUrl.username = 'user';
    privateUrl.password = 'synthetic-test-only';
    for (const url of ['https://elsewhere.example/', privateUrl.href]) {
      const bad = structuredClone(payload);
      bad.accounts.find((row) => row.platform === 'website')!.url = url;
      expect(() => assertProdPayload(bad, plan, sources.sourceSha256)).toThrow('M02_PROD_PAYLOAD_REJECTED');
    }
  });
  it('rejects normalized and repeatedly encoded private query keys on same-domain final URLs', () => {
    for (const key of ['client_secret', 'clientsecret', '%256bey', '%2563lient_secret']) {
      const bad = structuredClone(payload);
      const row = bad.accounts.find((value) => value.platform === 'website')!;
      const url = new URL(row.url);
      url.searchParams.set(key, 'synthetic-test-only');
      row.url = url.href;
      expect(() => assertProdPayload(bad, plan, sources.sourceSha256)).toThrow('M02_PROD_PAYLOAD_REJECTED');
    }
  });
  it('binds explicit channel URLs to that exact channel ID', () => {
    const bad = structuredClone(payload);
    const row = bad.accounts.find(
      (value) => value.platform === 'youtube' && value.sourceHandle.startsWith('channel/'),
    )!;
    row.external_id = 'UC' + '0'.repeat(22);
    row.uploads_playlist_id = 'UU' + '0'.repeat(22);
    expect(() => assertProdPayload(bad, plan, sources.sourceSha256)).toThrow('M02_PROD_PAYLOAD_REJECTED');
  });
  it.each(['0', '00', '0123'])('rejects noncanonical Vimeo ID %s before authentication', (id) => {
    const bad = structuredClone(payload);
    bad.accounts.find((row) => row.platform === 'vimeo')!.external_id = id;
    expect(() => assertProdPayload(bad, plan, sources.sourceSha256)).toThrow('M02_PROD_PAYLOAD_REJECTED');
  });
  it('rejects missing approval, wrong target, hash and budget drift', () => {
    expect(
      assertProdPacket(packet, {
        source: sources.sourceSha256,
        payload: 'a'.repeat(64),
        logos: 'b'.repeat(64),
        baseline: 'c'.repeat(64),
      }).target,
    ).toBe(prodTarget.ref);
    for (const bad of [
      { ...packet, approved: false },
      { ...packet, target: 'zmotjsbzhzjvpelxvxlf' },
      { ...packet, payloadSha256: 'd'.repeat(64) },
      { ...packet, limits: { ...packet.limits, logos: 258 } },
    ])
      expect(() =>
        assertProdPacket(bad, {
          source: sources.sourceSha256,
          payload: 'a'.repeat(64),
          logos: 'b'.repeat(64),
          baseline: 'c'.repeat(64),
        }),
      ).toThrow(/^M02_PROD_/);
  });
  it('checked-in packet keeps approval and reference consistent', async () => {
    const actual = JSON.parse(await readFile(join(root, 'scripts/seed/prod-seed-packet.json'), 'utf8'));
    expect(typeof actual.approved).toBe('boolean');
    expect(actual.approved).toBe(
      typeof actual.approvalReference === 'string' && actual.approvalReference.trim().length > 0,
    );
  });
  it('preflight rejects approved without a nonblank reference', () => {
    for (const approvalReference of [null, '', '   '])
      expect(() =>
        assertProdPacket(
          { ...packet, approvalReference },
          {
            source: sources.sourceSha256,
            payload: 'a'.repeat(64),
            logos: 'b'.repeat(64),
            baseline: 'c'.repeat(64),
          },
          false,
        ),
      ).toThrow(/^M02_PROD_/);
  });
  it('accepts the actual frozen public payload and257-entry byte manifest without a network call', async () => {
    const actual = assertProdPayload(
      JSON.parse(await readFile(join(root, 'scripts/seed/prod-payload.json'), 'utf8')),
      plan,
      sources.sourceSha256,
    );
    const logos = assertProdLogos(
      JSON.parse(await readFile(join(root, 'scripts/seed/prod-logo-manifest.json'), 'utf8')),
      plan,
    );
    expect(actual.accounts).toHaveLength(1754);
    expect(logos.logos.reduce((sum, row) => sum + row.byteLength, 0)).toBe(1560325);
  });
});
