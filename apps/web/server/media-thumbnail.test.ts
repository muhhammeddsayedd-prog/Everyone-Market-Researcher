// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
vi.mock('server-only', () => ({}));
import { createMediaThumbnail } from './media-thumbnail';

describe('actual local JPEG thumbnail conversion', () => {
  it('resizes a synthetic PNG, strips metadata and emits a valid bounded JPEG', async () => {
    const input = await sharp({ create: { width: 2560, height: 720, channels: 3, background: '#123456' } })
      .png()
      .toBuffer();
    const result = await createMediaThumbnail(input, new AbortController().signal);
    const actual = await sharp(result.bytes).metadata();
    expect([result.width, result.height, actual.format]).toEqual([1280, 360, 'jpeg']);
    expect(actual.exif).toBeUndefined();
    expect(result.bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
  });
  it('does not enlarge a small synthetic image', async () => {
    const input = await sharp({ create: { width: 8, height: 4, channels: 3, background: '#abcdef' } })
      .png()
      .toBuffer();
    const result = await createMediaThumbnail(input, new AbortController().signal);
    expect([result.width, result.height]).toEqual([8, 4]);
  });
  it('rejects corrupt input without exposing decoder errors', async () => {
    await expect(
      createMediaThumbnail(new Uint8Array([1, 2, 3]), new AbortController().signal),
    ).rejects.toThrow('thumbnail_conversion_failed');
  });
  it('rejects an aborted conversion before work', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createMediaThumbnail(new Uint8Array([1]), controller.signal)).rejects.toThrow();
  });
  it('rejects SVG disguised by an image MIME header before rasterizing it', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    await expect(createMediaThumbnail(svg, new AbortController().signal)).rejects.toThrow(
      'thumbnail_conversion_failed',
    );
  });
});
