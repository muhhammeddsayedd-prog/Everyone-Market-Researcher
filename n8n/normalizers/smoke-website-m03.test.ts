import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const exactUrl = 'https://everyone.film/about-everyone';
const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/website-content-crawler/synthetic-smoke-contract.json', import.meta.url),
    'utf8',
  ),
) as { row: Record<string, unknown> };
const row = (extra: Record<string, unknown> = {}) => ({ ...fixture.row, url: exactUrl, ...extra });
type Normalizer = (input: unknown) => { json: Record<string, unknown>; matchKey: string };

function adapter() {
  return require('./smoke_website_m03.js') as {
    normalizeM03SmokeWebsite: Normalizer;
    createM03SmokeWebsiteNormalizer: (...helpers: unknown[]) => Normalizer;
  };
}

describe('M03 exact-page Cloud adapter', () => {
  it('keeps the generic snapshot and stable hash for the same validated page', () => {
    const generic = require('./smoke_website_stub.js') as { normalizeSmokeWebsite: Normalizer };
    const actual = adapter().normalizeM03SmokeWebsite(row());
    expect(actual).toEqual(generic.normalizeSmokeWebsite(row()));
    expect(Object.keys(actual.json).sort()).toEqual([
      'actor',
      'caption',
      'external_id',
      'item_type',
      'metrics',
      'payload',
      'platform',
      'published_at',
      'title',
      'url',
    ]);
    expect(actual.json.external_id).toBe(
      createHash('sha256').update(exactUrl, 'utf8').digest('hex').slice(0, 32),
    );
  });

  it.each([
    `${exactUrl}/`,
    `${exactUrl}?public=1`,
    `${exactUrl}#public`,
    'http://everyone.film/about-everyone',
    'https://EVERYONE.film/about-everyone',
    'https://everyone.film/About-everyone',
    'https://www.everyone.film/about-everyone',
    'https://everyone.film:443/about-everyone',
    'https://public@everyone.film/about-everyone',
    'https://everyone.film/about-%65veryone',
    `${exactUrl} `,
    ` ${exactUrl}`,
    `${exactUrl}\n`,
    'https://everyone.film/',
    'https://other.film/about-everyone',
  ])('rejects a nonexact requested page without parsing: %s', (url) => {
    expect(() => adapter().normalizeM03SmokeWebsite(row({ url }))).toThrow(
      'contract_drift: invalid website crawler row',
    );
  });

  it('allows only explicit own-root/about associated URL literals', () => {
    for (const associated of [
      undefined,
      null,
      '',
      'https://everyone.film',
      'https://everyone.film/',
      exactUrl,
    ]) {
      expect(
        adapter().normalizeM03SmokeWebsite(
          row({
            crawl: { loadedUrl: associated, referrerUrl: associated },
            metadata: { title: 'Synthetic', canonicalUrl: associated },
          }),
        ).matchKey,
      ).toBe(exactUrl);
    }
  });

  it('screens every associated URL, including otherwise public credential-free alternatives', () => {
    for (const associated of [
      `${exactUrl}/`,
      `${exactUrl}?public=1`,
      `${exactUrl}#public`,
      'https://other.film/',
      3,
      {},
      [],
    ]) {
      for (const extra of [
        { crawl: { loadedUrl: associated } },
        { crawl: { referrerUrl: associated } },
        { metadata: { title: 'Synthetic', canonicalUrl: associated } },
      ]) {
        expect(() => adapter().normalizeM03SmokeWebsite(row(extra))).toThrow(
          'contract_drift: invalid website crawler row',
        );
      }
    }
  });

  it('preserves row rejection, Unicode caps, and the minimized snapshot', () => {
    const normalize = adapter().normalizeM03SmokeWebsite;
    for (const value of [
      null,
      [],
      row({ error: 'synthetic' }),
      row({ markdown: 4 }),
      row({ metadata: [] }),
      row({ metadata: { title: 3 } }),
    ]) {
      expect(() => normalize(value)).toThrow('contract_drift: invalid website crawler row');
    }
    const actual = normalize(
      row({
        markdown: `${'x'.repeat(7999)}😀`,
        metadata: { title: `${'t'.repeat(1999)}😀` },
        request: { synthetic: true },
        headers: { synthetic: true },
      }),
    ).json;
    expect(actual.caption).toBe('x'.repeat(7999));
    expect(actual.title).toBe('t'.repeat(1999));
    expect(actual.metrics).toEqual({});
    expect(actual.payload).toEqual({
      url: exactUrl,
      markdown: 'x'.repeat(7999),
      metadata: { title: 't'.repeat(1999) },
    });
  });

  it('runs pasted function declarations without URL or module globals and only crypto access', () => {
    const sharedSource = readFileSync(new URL('./smoke_website_stub.js', import.meta.url), 'utf8').split(
      "if (typeof module !== 'undefined')",
    )[0];
    const adapterSource = readFileSync(new URL('./smoke_website_m03.js', import.meta.url), 'utf8').split(
      "if (typeof module !== 'undefined')",
    )[0];
    const actual = runInNewContext(
      `${sharedSource}\n${adapterSource}\nconst normalize=createM03SmokeWebsiteNormalizer(validateSmokeWebsiteRow,buildSmokeWebsiteSnapshot,invalidWebsiteRow); normalize(input);`,
      {
        input: row({ crawl: undefined, metadata: { title: 'Synthetic' } }),
        require: (name: string) => {
          expect(name).toBe('crypto');
          return { createHash };
        },
      },
    ) as ReturnType<Normalizer>;
    expect(actual.matchKey).toBe(exactUrl);
    expect(actual.json.external_id).toBe('e4d69e3fb0d821183258d75248f9df24');
  });

  it('fails closed if the composed public helpers are missing', () => {
    expect(() => adapter().createM03SmokeWebsiteNormalizer()).toThrow('smoke_adapter_helpers_unavailable');
  });
});
