import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { canonicalUrl } from '@emr/shared';
import { safeRequest, type SafeRequest } from './network';

const maxBytes = 5 * 1024 * 1024;
const maxPixels = 16_000_000;

export type PreparedLogo = {
  bytes: Uint8Array;
  mime: 'image/webp' | 'image/svg+xml';
  ext: 'webp' | 'svg';
  width: number | null;
  height: number | null;
  sha256: string;
};
export type LogoInput = {
  competitorId: string;
  slug: string;
  sourceUrl: string | null;
  currentLogoPath: string | null;
  baselineBytes?: Uint8Array;
  /** Public competitor website, used only for one explicit 403 origin-Referer retry. */
  websiteUrl?: string | null;
};
export type LogoOwnership = { storagePath: string; sourceUrl: string | null; sha256: string };
export type LogoRecord = LogoOwnership & {
  competitorId: string;
  kind: 'logo';
  expectedLogoPath: string | null;
  width: number | null;
  height: number | null;
};
export type LogoAdapter = {
  request?: SafeRequest;
  readAsset(
    path: string,
  ): Promise<{ competitorId: string; itemId: string | null; kind: string; sourceUrl: string | null } | null>;
  /** Read actual public stored bytes through a bounded, DNS-pinned request. */
  readStored(path: string): Promise<Uint8Array | null>;
  /** Create only: SDK upload must use upsert:false; report a duplicate as exists. */
  upload(path: string, prepared: PreparedLogo): Promise<'created' | 'exists'>;
  /** Atomic logo_path compare-and-set and same-owner/kind/source media-asset insert/repair. */
  commit(record: LogoRecord): Promise<void>;
};
export type LogoResult = {
  status: 'copied' | 'recovered' | 'unchanged' | 'skipped';
  reason?: 'unmanaged_logo_path' | 'missing_source';
  record?: LogoRecord;
  ownership?: LogoOwnership;
};

type LogoFailure =
  | 'invalid_input'
  | 'too_large'
  | 'invalid_mime'
  | 'invalid_image'
  | 'invalid_svg'
  | 'storage_collision'
  | 'download_failed'
  | 'adapter_failed';
export class LogoError extends Error {
  constructor(readonly code: LogoFailure) {
    super(code);
    this.name = 'LogoError';
  }
}
function fail(code: LogoFailure): never {
  throw new LogoError(code);
}
function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const svgTags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'defs',
  'title',
  'desc',
]);
const numberAttributes = new Set([
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'stroke-width',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
]);
const enumAttributes: Record<string, readonly string[]> = {
  'fill-rule': ['nonzero', 'evenodd'],
  'clip-rule': ['nonzero', 'evenodd'],
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
};

function validSvgAttribute(name: string, value: string, root: boolean): boolean {
  if (name === 'xmlns') return root && value === 'http://www.w3.org/2000/svg';
  if (name === 'version') return root && ['1.0', '1.1', '2.0'].includes(value);
  if (name === 'id') return /^[a-zA-Z_][\w.-]*$/.test(value);
  if (name === 'viewBox') return /^[\d.eE+\s,-]+$/.test(value) && value.trim().split(/[\s,]+/).length === 4;
  if (name === 'd') return /^[\sMmZzLlHhVvCcSsQqTtAaEe\d+.,-]*$/.test(value);
  if (name === 'points') return /^[\d.eE+\s,-]+$/.test(value);
  if (name === 'transform')
    return /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([\d.eE+\s,-]+\)\s*)+$/.test(value);
  if (name === 'fill' || name === 'stroke') {
    return /^(?:#[\da-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([\d.%\s,+/-]+\))$/.test(value);
  }
  if (name === 'preserveAspectRatio')
    return /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/.test(value);
  if (Object.hasOwn(enumAttributes, name)) return enumAttributes[name]!.includes(value);
  if (numberAttributes.has(name)) return /^(?:none|[\d.eE+\s,%()-]+(?:px)?)$/.test(value);
  return false;
}

/** Accept a deliberately small static SVG subset, retaining the original bytes.
 * Unknown XML/SVG/CSS features fail closed rather than being stripped or rendered.
 */
function inspectSvg(bytes: Uint8Array): { width: number | null; height: number | null } {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return fail('invalid_svg');
  }
  text = text.replace(/^\s*<\?xml\s+version=(['"])1\.0\1(?:\s+encoding=(['"])UTF-8\2)?\s*\?>/i, '');
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f&]/u.test(text) ||
    /<!|<\?|url\s*\(|@import|javascript:|data:/i.test(text)
  )
    return fail('invalid_svg');
  const stack: string[] = [];
  let rootSeen = false;
  let rootClosed = false;
  let consumed = 0;
  const rootAttributes: Record<string, string> = {};
  for (const match of text.matchAll(/<[^>]*>|[^<]+/g)) {
    if (match.index !== consumed) return fail('invalid_svg');
    const token = match[0];
    consumed += token.length;
    if (!token.startsWith('<')) {
      if (token.trim() && !['title', 'desc'].includes(stack.at(-1) ?? '')) return fail('invalid_svg');
      continue;
    }
    const close = /^<\/([a-zA-Z]+)\s*>$/.exec(token);
    if (close) {
      if (stack.pop() !== close[1]) return fail('invalid_svg');
      if (stack.length === 0) rootClosed = true;
      continue;
    }
    const open = /^<([a-zA-Z]+)([\s\S]*?)(\/?)>$/.exec(token);
    if (!open || !svgTags.has(open[1]!) || rootClosed) return fail('invalid_svg');
    const tag = open[1]!;
    const root = !rootSeen;
    if (root ? tag !== 'svg' : tag === 'svg') return fail('invalid_svg');
    if (stack.length === 0 && rootSeen) return fail('invalid_svg');
    rootSeen = true;
    const attributes = open[2]!;
    const seen = new Set<string>();
    let offset = 0;
    while (attributes.slice(offset).trim()) {
      const attribute = /^\s+([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attributes.slice(offset));
      if (!attribute) return fail('invalid_svg');
      const name = attribute[1]!;
      const value = attribute[2] ?? attribute[3] ?? '';
      if (seen.has(name.toLowerCase()) || !validSvgAttribute(name, value, root)) return fail('invalid_svg');
      seen.add(name.toLowerCase());
      offset += attribute[0].length;
      if (root) rootAttributes[name] = value;
    }
    if (root && rootAttributes.xmlns !== 'http://www.w3.org/2000/svg') return fail('invalid_svg');
    if (!open[3]) stack.push(tag);
    else if (root) rootClosed = true;
  }
  if (consumed !== text.length || !rootSeen || !rootClosed || stack.length) return fail('invalid_svg');
  const dimension = (value: string | undefined) =>
    value && /^\d+(?:\.\d+)?(?:px)?$/.test(value) ? Number.parseFloat(value) : null;
  const box = rootAttributes.viewBox
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box && (box.some((n) => !Number.isFinite(n)) || box[2]! <= 0 || box[3]! <= 0))
    return fail('invalid_svg');
  const width = dimension(rootAttributes.width) ?? box?.[2] ?? null;
  const height = dimension(rootAttributes.height) ?? box?.[3] ?? null;
  if (
    (width !== null && (width <= 0 || width > maxPixels)) ||
    (height !== null && (height <= 0 || height > maxPixels)) ||
    (width !== null && height !== null && width * height > maxPixels)
  )
    return fail('invalid_svg');
  return {
    width: width === null ? null : Math.ceil(width),
    height: height === null ? null : Math.ceil(height),
  };
}

export async function prepareLogo(bytes: Uint8Array, contentType: string): Promise<PreparedLogo> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || typeof contentType !== 'string')
    return fail('invalid_input');
  if (bytes.byteLength > maxBytes) return fail('too_large');
  const mime = contentType.split(';')[0]?.trim().toLowerCase();
  if (mime === 'image/svg+xml') {
    const dimensions = inspectSvg(bytes);
    return { bytes: Uint8Array.from(bytes), ext: 'svg', mime, ...dimensions, sha256: digest(bytes) };
  }
  const buffer = Buffer.from(bytes);
  const format = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'png'
    : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      ? 'jpeg'
      : buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
        ? 'webp'
        : null;
  if (!format || mime !== `image/${format}`) return fail('invalid_mime');
  try {
    const image = sharp(buffer, { failOn: 'warning', limitInputPixels: maxPixels, animated: false });
    const metadata = await image.metadata();
    if (
      metadata.format !== format ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > maxPixels
    )
      return fail('invalid_image');
    const output = await image
      .rotate()
      .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: output.data,
      ext: 'webp',
      mime: 'image/webp',
      width: output.info.width,
      height: output.info.height,
      sha256: digest(output.data),
    };
  } catch {
    return fail('invalid_image');
  }
}

const logoInputSchema = z.object({
  competitorId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sourceUrl: z.string().min(1).nullable(),
  currentLogoPath: z.string().min(1).nullable(),
  baselineBytes: z.instanceof(Uint8Array).optional(),
  websiteUrl: z.string().min(1).max(8192).nullable().optional(),
});
const ownershipSchema = z.object({
  storagePath: z.string().min(1),
  sourceUrl: z.string().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

function assetMatches(asset: Awaited<ReturnType<LogoAdapter['readAsset']>>, input: LogoInput): boolean {
  return (
    asset !== null &&
    asset.competitorId === input.competitorId &&
    asset.itemId === null &&
    asset.kind === 'logo' &&
    asset.sourceUrl === input.sourceUrl
  );
}

/** Hooks isolate private DB/Storage credentials. This function never deletes or overwrites an object. */
export async function copyLogo(
  input: LogoInput,
  adapter: LogoAdapter,
  owned?: LogoOwnership,
): Promise<LogoResult> {
  if (!logoInputSchema.safeParse(input).success || (owned && !ownershipSchema.safeParse(owned).success))
    return fail('invalid_input');
  let refererOrigin: string | undefined;
  if (input.websiteUrl != null) {
    try {
      const website = new URL(input.websiteUrl);
      if (website.protocol !== 'https:') return fail('invalid_input');
      canonicalUrl(input.websiteUrl);
      refererOrigin = website.origin;
    } catch {
      return fail('invalid_input');
    }
  }
  if (input.sourceUrl !== null) {
    try {
      const url = new URL(input.sourceUrl);
      if (url.protocol !== 'https:' || input.baselineBytes) return fail('invalid_input');
      canonicalUrl(input.sourceUrl); // Validate without discarding functional source query parameters.
    } catch {
      return fail('invalid_input');
    }
  }
  if (
    input.currentLogoPath &&
    (!owned ||
      owned.storagePath !== input.currentLogoPath ||
      !new RegExp(`^logos/${input.slug}\\.(?:svg|webp)$`).test(owned.storagePath))
  ) {
    return { status: 'skipped', reason: 'unmanaged_logo_path' };
  }
  try {
    if (owned && input.currentLogoPath === owned.storagePath && input.sourceUrl === owned.sourceUrl) {
      const asset = await adapter.readAsset(owned.storagePath);
      if (!assetMatches(asset, input)) return fail('storage_collision');
      const stored = await adapter.readStored(owned.storagePath);
      if (!stored || stored.byteLength > maxBytes || digest(stored) !== owned.sha256)
        return fail('storage_collision');
      return { status: 'unchanged', ownership: owned };
    }
    let prepared: PreparedLogo;
    if (input.baselineBytes && input.sourceUrl === null)
      prepared = await prepareLogo(input.baselineBytes, 'image/svg+xml');
    else if (input.sourceUrl) {
      let response;
      try {
        response = await (adapter.request ?? safeRequest)(input.sourceUrl, {
          method: 'GET',
          timeoutMs: 10_000,
          maxBytes,
          sameDomainRedirects: true,
        });
        if (response.status === 403 && refererOrigin) {
          response = await (adapter.request ?? safeRequest)(input.sourceUrl, {
            method: 'GET',
            timeoutMs: 10_000,
            maxBytes,
            sameDomainRedirects: true,
            refererOrigin,
          });
        }
      } catch {
        return fail('download_failed');
      }
      if (response.status < 200 || response.status >= 300) return fail('download_failed');
      prepared = await prepareLogo(response.body, response.headers.get('content-type') ?? '');
    } else return { status: 'skipped', reason: 'missing_source' };
    const storagePath = `logos/${input.slug}.${prepared.ext}`;
    const asset = await adapter.readAsset(storagePath);
    if (asset && !assetMatches(asset, input)) return fail('storage_collision');
    let stored = await adapter.readStored(storagePath);
    let status: LogoResult['status'] = 'recovered';
    if (stored === null) {
      if (asset) return fail('storage_collision');
      const uploaded = await adapter.upload(storagePath, prepared);
      status = uploaded === 'created' ? 'copied' : 'recovered';
      stored = await adapter.readStored(storagePath);
    }
    if (!stored || stored.byteLength > maxBytes || digest(stored) !== prepared.sha256)
      return fail('storage_collision');
    const ownership: LogoOwnership = { storagePath, sourceUrl: input.sourceUrl, sha256: prepared.sha256 };
    const record: LogoRecord = {
      ...ownership,
      competitorId: input.competitorId,
      kind: 'logo',
      expectedLogoPath: input.currentLogoPath,
      width: prepared.width,
      height: prepared.height,
    };
    await adapter.commit(record);
    return { status, record, ownership };
  } catch (error) {
    if (error instanceof LogoError) throw error;
    return fail('adapter_failed');
  }
}
