import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { copyLogo, prepareLogo, type LogoAdapter, type LogoInput } from './copy-logos';

const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><path d="M0 0H100V50H0Z" fill="currentColor"/></svg>',
);
const input: LogoInput = {
  competitorId: '00000000-0000-4000-8000-000000000001',
  slug: 'everyone-films',
  sourceUrl: null,
  currentLogoPath: null,
  baselineBytes: svg,
};
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function adapter() {
  const assets = new Map<
    string,
    { competitorId: string; itemId: string | null; kind: string; sourceUrl: string | null }
  >();
  const objects = new Map<string, Uint8Array>();
  const calls: string[] = [];
  const hooks: LogoAdapter = {
    async readAsset(path) {
      calls.push('asset');
      return assets.get(path) ?? null;
    },
    async readStored(path) {
      calls.push('stored');
      return objects.get(path) ?? null;
    },
    async upload(path, prepared) {
      calls.push('upload');
      if (objects.has(path)) return 'exists';
      objects.set(path, prepared.bytes);
      return 'created';
    },
    async commit(record) {
      calls.push('commit');
      assets.set(record.storagePath, {
        competitorId: record.competitorId,
        itemId: null,
        kind: 'logo',
        sourceUrl: record.sourceUrl,
      });
    },
  };
  return { hooks, assets, objects, calls };
}

describe('prepareLogo', () => {
  it.each(['png', 'jpeg', 'webp'] as const)('sniffs and converts %s to bounded WebP', async (format) => {
    const bytes = await sharp({ create: { width: 600, height: 300, channels: 4, background: '#ffffff' } })
      .toFormat(format)
      .toBuffer();
    const result = await prepareLogo(bytes, `image/${format}`);
    expect({ ext: result.ext, mime: result.mime, width: result.width, height: result.height }).toEqual({
      ext: 'webp',
      mime: 'image/webp',
      width: 256,
      height: 128,
    });
    expect((await sharp(result.bytes).metadata()).format).toBe('webp');
    expect(result.sha256).toBe(hash(result.bytes));
  });

  it('does not enlarge small rasters', async () => {
    const bytes = await sharp({ create: { width: 24, height: 48, channels: 3, background: '#f00' } })
      .png()
      .toBuffer();
    const result = await prepareLogo(bytes, 'image/png');
    expect([result.width, result.height]).toEqual([24, 48]);
  });

  it('records integer pixel bounds for fractional SVG dimensions without rewriting it', async () => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24.5" height="18.2"/>');
    const result = await prepareLogo(bytes, 'image/svg+xml');
    expect([result.width, result.height]).toEqual([25, 19]);
    expect(Buffer.from(result.bytes)).toEqual(bytes);
  });

  it('keeps the actual baseline SVG bytes unchanged', async () => {
    const bytes = await readFile(new URL('../../assets/brand/everyone-logotype.svg', import.meta.url));
    const result = await prepareLogo(bytes, 'image/svg+xml');
    expect(Buffer.from(result.bytes)).toEqual(bytes);
    expect([result.ext, result.width, result.height]).toEqual(['svg', 519, 87]);
  });

  it('rejects a raster over the 16 million input-pixel limit', async () => {
    const bytes = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: '#000' } })
      .png()
      .toBuffer();
    await expect(prepareLogo(bytes, 'image/png')).rejects.toThrow('invalid_image');
  });

  it.each([
    ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml'],
    ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', 'image/svg+xml'],
    ['<svg xmlns="http://www.w3.org/2000/svg" OnLoad = "alert(1)"/>', 'image/svg+xml'],
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>unsafe</div></foreignObject></svg>',
      'image/svg+xml',
    ],
    [
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>',
      'image/svg+xml',
    ],
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/private"/></svg>',
      'image/svg+xml',
    ],
    ['<svg xmlns="http://www.w3.org/2000/svg"><use href="data:image/svg+xml,evil"/></svg>', 'image/svg+xml'],
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(https://example.com/x)"/></svg>',
      'image/svg+xml',
    ],
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "https://example.com/x";</style></svg>',
      'image/svg+xml',
    ],
    ['<svg xmlns="http://www.w3.org/2000/svg"><path fill="url(#shape)"/></svg>', 'image/svg+xml'],
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="href" values="javascript:alert(1)"/></svg>',
      'image/svg+xml',
    ],
    ['<svg xmlns="http://www.w3.org/2000/svg"><path fill="&#x72;ed"/></svg>', 'image/svg+xml'],
    ['<svg xmlns="http://www.w3.org/2000/svg"><path></svg>', 'image/svg+xml'],
    ['<svg xmlns="http://www.w3.org/2000/svg" width="5" width="6"/>', 'image/svg+xml'],
    ['<svg xmlns="http://www.w3.org/2000/svg" width=100/>', 'image/svg+xml'],
    ['<svg xmlns="http://www.w3.org/2000/svg"/><svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml'],
    [
      '<?xml-stylesheet href="https://example.com/x"?><svg xmlns="http://www.w3.org/2000/svg"/>',
      'image/svg+xml',
    ],
    ['<html><script>alert(1)</script></html>', 'image/svg+xml'],
    ['GIF89a', 'image/gif'],
    ['<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/png'],
  ])('rejects unsafe/unsupported payload %#', async (text, mime) => {
    await expect(prepareLogo(Buffer.from(text), mime)).rejects.toThrow();
  });

  it('rejects bytes beyond 5 MiB before image processing', async () => {
    await expect(prepareLogo(new Uint8Array(5 * 1024 * 1024 + 1), 'image/png')).rejects.toThrow('too_large');
  });

  it('rejects a prototype-named SVG attribute with the same safe validation error', async () => {
    await expect(
      prepareLogo(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" constructor="unexpected"/>'),
        'image/svg+xml',
      ),
    ).rejects.toThrow('invalid_svg');
  });
});

describe('copyLogo ownership and recovery', () => {
  it('accepts an absent database website as null without a Referer fallback', async () => {
    const state = adapter();
    expect((await copyLogo({ ...input, websiteUrl: null }, state.hooks)).status).toBe('copied');
  });
  it('uploads a fresh baseline and commits its exact storage metadata', async () => {
    const state = adapter();
    const result = await copyLogo(input, state.hooks);
    expect(result.status).toBe('copied');
    expect(result.record).toMatchObject({
      storagePath: 'logos/everyone-films.svg',
      competitorId: input.competitorId,
      expectedLogoPath: null,
      sourceUrl: null,
      kind: 'logo',
      width: 100,
      height: 50,
    });
    expect(state.calls).toEqual(['asset', 'stored', 'upload', 'stored', 'commit']);
  });

  it('skips an owned unchanged logo after verifying its asset and actual stored bytes', async () => {
    const state = adapter();
    const first = await copyLogo(input, state.hooks);
    state.calls.length = 0;
    const result = await copyLogo(
      { ...input, currentLogoPath: first.record!.storagePath },
      state.hooks,
      first.ownership,
    );
    expect(result.status).toBe('unchanged');
    expect(state.calls).toEqual(['asset', 'stored']);
  });

  it('preserves an unmanaged or human-edited logo without source fetch/storage calls', async () => {
    const state = adapter();
    const result = await copyLogo({ ...input, currentLogoPath: 'manual/logo.svg' }, state.hooks);
    expect(result).toMatchObject({ status: 'skipped', reason: 'unmanaged_logo_path' });
    expect(state.calls).toEqual([]);
  });

  it('recovers the DB metadata after an earlier upload without overwriting the object', async () => {
    const state = adapter();
    state.objects.set('logos/everyone-films.svg', svg);
    const result = await copyLogo(input, state.hooks);
    expect(result.status).toBe('recovered');
    expect(state.calls).not.toContain('upload');
    expect(state.calls.at(-1)).toBe('commit');
  });

  it('rejects an existing object with different bytes, retaining it unchanged', async () => {
    const state = adapter();
    state.objects.set('logos/everyone-films.svg', Buffer.from('other-owner-bytes'));
    await expect(copyLogo(input, state.hooks)).rejects.toThrow('storage_collision');
    expect(state.calls).not.toContain('upload');
    expect(state.calls).not.toContain('commit');
    expect(Buffer.from(state.objects.get('logos/everyone-films.svg')!).toString()).toBe('other-owner-bytes');
  });

  it('rejects storage metadata belonging to another competitor even for identical bytes', async () => {
    const state = adapter();
    state.assets.set('logos/everyone-films.svg', {
      competitorId: 'another-competitor',
      itemId: null,
      kind: 'logo',
      sourceUrl: null,
    });
    state.objects.set('logos/everyone-films.svg', svg);
    await expect(copyLogo(input, state.hooks)).rejects.toThrow('storage_collision');
    expect(state.calls).toEqual(['asset']);
  });

  it('fails closed if owned existing bytes have changed', async () => {
    const state = adapter();
    const first = await copyLogo(input, state.hooks);
    state.objects.set('logos/everyone-films.svg', Buffer.from('tampered'));
    await expect(
      copyLogo({ ...input, currentLogoPath: first.record!.storagePath }, state.hooks, first.ownership),
    ).rejects.toThrow('storage_collision');
  });

  it('rejects an owned unchanged path if its media metadata was linked to a content item', async () => {
    const state = adapter();
    const first = await copyLogo(input, state.hooks);
    const asset = state.assets.get('logos/everyone-films.svg')!;
    asset.itemId = '00000000-0000-4000-8000-000000000002';
    await expect(
      copyLogo({ ...input, currentLogoPath: first.record!.storagePath }, state.hooks, first.ownership),
    ).rejects.toThrow('storage_collision');
  });

  it('verifies bytes after a raced upload exists response before DB repair', async () => {
    const state = adapter();
    state.hooks.upload = async (path) => {
      state.objects.set(path, svg);
      return 'exists';
    };
    expect((await copyLogo(input, state.hooks)).status).toBe('recovered');
  });

  it('never commits metadata after an upload whose public readback differs', async () => {
    const state = adapter();
    state.hooks.upload = async (path) => {
      state.objects.set(path, Buffer.from('wrong'));
      return 'created';
    };
    await expect(copyLogo(input, state.hooks)).rejects.toThrow('storage_collision');
    expect(state.calls).not.toContain('commit');
  });

  it('uses the injected safe request with a bounded anonymous GET', async () => {
    const state = adapter();
    let observed: unknown;
    state.hooks.request = async (url, options) => {
      observed = { url, options };
      return { status: 200, headers: new Headers({ 'content-type': 'image/svg+xml' }), body: svg, url };
    };
    const sourceUrl = 'https://example.com/logo.svg';
    const result = await copyLogo({ ...input, sourceUrl, baselineBytes: undefined }, state.hooks);
    expect(result.record?.sourceUrl).toBe(sourceUrl);
    expect(observed).toMatchObject({
      url: sourceUrl,
      options: { method: 'GET', timeoutMs: 10000, maxBytes: 5 * 1024 * 1024, sameDomainRedirects: true },
    });
  });

  it('retries only one 403 at the same source with an explicit website-origin Referer', async () => {
    const state = adapter();
    const attempts: { url: string; options: unknown }[] = [];
    state.hooks.request = async (url, options) => {
      attempts.push({ url, options });
      return {
        status: attempts.length === 1 ? 403 : 200,
        headers: new Headers({ 'content-type': 'image/svg+xml' }),
        body: svg,
        url,
      };
    };
    const sourceUrl = 'https://cdn.example.com/logo.svg?variant=logo';
    const result = await copyLogo(
      {
        ...input,
        sourceUrl,
        baselineBytes: undefined,
        websiteUrl: 'https://www.example.com/work?private_tracking=1#top',
      },
      state.hooks,
    );
    expect(result.status).toBe('copied');
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({ url: sourceUrl });
    expect(attempts[0]!.options).not.toHaveProperty('refererOrigin');
    expect(attempts[1]).toMatchObject({
      url: sourceUrl,
      options: { refererOrigin: 'https://www.example.com' },
    });
  });

  it.each([403, 429, 500])('does not retry without a known website origin: %i', async (status) => {
    const state = adapter();
    let attempts = 0;
    state.hooks.request = async (url) => {
      attempts++;
      return { status, headers: new Headers(), body: new Uint8Array(), url };
    };
    await expect(
      copyLogo(
        { ...input, sourceUrl: 'https://example.com/logo.svg', baselineBytes: undefined },
        state.hooks,
      ),
    ).rejects.toThrow('download_failed');
    expect(attempts).toBe(1);
  });

  it('stops after the second 403 without storage writes', async () => {
    const state = adapter();
    let attempts = 0;
    state.hooks.request = async (url) => {
      attempts++;
      return { status: 403, headers: new Headers(), body: new Uint8Array(), url };
    };
    await expect(
      copyLogo(
        {
          ...input,
          sourceUrl: 'https://cdn.example.com/logo.svg',
          websiteUrl: 'https://example.com',
          baselineBytes: undefined,
        },
        state.hooks,
      ),
    ).rejects.toThrow('download_failed');
    expect(attempts).toBe(2);
    expect(state.calls).toEqual([]);
  });

  it.each([
    'http://example.com/',
    'https://127.0.0.1/',
    'https://user:password@example.com/',
    'https://localhost/',
  ])('rejects unsafe optional website %s before requests', async (websiteUrl) => {
    const state = adapter();
    let attempts = 0;
    state.hooks.request = async (url) => {
      attempts++;
      return { status: 200, headers: new Headers({ 'content-type': 'image/svg+xml' }), body: svg, url };
    };
    await expect(
      copyLogo(
        { ...input, sourceUrl: 'https://cdn.example.com/logo.svg', websiteUrl, baselineBytes: undefined },
        state.hooks,
      ),
    ).rejects.toThrow('invalid_input');
    expect(attempts).toBe(0);
    expect(state.calls).toEqual([]);
  });

  it.each(['../escape', 'a/b', 'a.svg', ''])(
    'rejects unsafe slug %j before any adapter call',
    async (slug) => {
      const state = adapter();
      await expect(copyLogo({ ...input, slug }, state.hooks)).rejects.toThrow('invalid_input');
      expect(state.calls).toEqual([]);
    },
  );

  it('rejects invalid competitor identity before any adapter call', async () => {
    const state = adapter();
    await expect(copyLogo({ ...input, competitorId: 'not-a-uuid' }, state.hooks)).rejects.toThrow(
      'invalid_input',
    );
    expect(state.calls).toEqual([]);
  });
});
