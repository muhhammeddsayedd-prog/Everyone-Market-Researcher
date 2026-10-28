import 'server-only';
import sharp from 'sharp';

/** Local codec for the injected media-worker port; no fetch, credentials or upload. */
export async function createMediaThumbnail(bytes: Uint8Array, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > 5 * 1024 * 1024)
    throw Error('invalid_thumbnail_input');
  const signature = (values: number[], offset = 0) =>
    values.every((value, index) => bytes[offset + index] === value);
  if (
    !signature([255, 216, 255]) &&
    !signature([137, 80, 78, 71, 13, 10, 26, 10]) &&
    !(signature([82, 73, 70, 70]) && signature([87, 69, 66, 80], 8))
  )
    throw Error('thumbnail_conversion_failed');
  const image = sharp(bytes, { limitInputPixels: 25000000, failOn: 'error', animated: false });
  const abort = () => image.destroy();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const metadata = await image.metadata();
    signal.throwIfAborted();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) throw Error('unsupported_thumbnail_format');
    const { data, info } = await image
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true });
    signal.throwIfAborted();
    if (info.width > 1280 || info.height > 16384 || data.byteLength > 2 * 1024 * 1024)
      throw Error('thumbnail_bounds');
    return { bytes: new Uint8Array(data), width: info.width, height: info.height };
  } catch {
    throw Error('thumbnail_conversion_failed');
  } finally {
    signal.removeEventListener('abort', abort);
    image.destroy();
  }
}
