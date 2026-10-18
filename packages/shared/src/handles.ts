import { z } from 'zod';

export type VimeoAccount = {
  kind: 'user' | 'channel' | 'showcase' | 'group';
  /** Non-user identities retain their channels/, showcase/ or groups/ prefix. */
  handle: string;
};

export type YouTubeAccount = {
  kind: 'handle' | 'channel' | 'user' | 'c';
  /** No @ or path prefix; opaque channel IDs retain their original case. */
  value: string;
};

export type LinkedInAccount = {
  kind: 'company' | 'showcase' | 'school';
  slug: string;
};

export type WebsiteAccount = { domain: string; url: string };

const inputSchema = z.string().trim().min(1).max(8192);
const instagramHandle = /^[a-z0-9._]{1,30}$/;
const simpleHandle = /^[\p{L}\p{M}\p{N}_.-]+$/u;
const reservedInstagramPaths = new Set(['accounts', 'direct', 'explore', 'p', 'reel', 'reels', 'stories']);
const reservedVimeoPaths = new Set([
  'categories',
  'channels',
  'groups',
  'join',
  'log_in',
  'manage',
  'ondemand',
  'search',
  'showcase',
  'upload',
]);
const privateSuffixes = new Set([
  'arpa',
  'example',
  'home',
  'internal',
  'invalid',
  'lan',
  'local',
  'localdomain',
  'localhost',
  'onion',
  'test',
]);

function invalid(): never {
  // Do not reflect arbitrary input, including any supplied credentials, in errors.
  throw new Error('Invalid public account URL or handle');
}

function readInput(input: string): string {
  const result = inputSchema.safeParse(input);
  if (!result.success) return invalid();
  if (/[\s\u0000-\u001f\u007f\\]/u.test(result.data)) return invalid();
  return result.data;
}

function parsePublicUrl(input: string): URL {
  const value = readInput(input);
  const withProtocol = value.startsWith('//')
    ? `https:${value}`
    : /^[a-z][a-z\d+.-]*:/i.test(value)
      ? value
      : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return invalid();
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    return invalid();
  }
  const labels = url.hostname.split('.');
  const suffix = labels.at(-1) ?? '';
  // This is lexical validation only. Callers making requests must also validate
  // resolved addresses and every redirect; a public-looking name can resolve privately.
  if (
    labels.length < 2 ||
    /^[\d.]+$/.test(url.hostname) ||
    privateSuffixes.has(suffix) ||
    !/^[a-z][a-z\d-]*$/i.test(suffix) ||
    labels.some((label) => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
  ) {
    return invalid();
  }
  url.protocol = 'https:';
  url.search = '';
  url.hash = '';
  return url;
}

function socialPath(input: string, hostPattern: RegExp): string[] {
  const value = readInput(input);
  const withoutTracking = value.split(/[?#]/, 1)[0] ?? '';
  // WHATWG URL resolves dot segments before exposing pathname. Reject them first
  // so content URLs cannot turn into apparent profile URLs through traversal.
  if (/(?:^|\/)(?:\.|%2e){1,2}(?=\/|$)/i.test(withoutTracking) || /%2f|%5c/i.test(withoutTracking)) {
    return invalid();
  }
  const url = parsePublicUrl(value);
  if (!hostPattern.test(url.hostname)) return invalid();
  const path = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (!path) return invalid();
  try {
    const segments = path.split('/').map((segment) => decodeURIComponent(segment));
    if (segments.some((segment) => !segment || /[\s\u0000-\u001f\u007f/%\\]/u.test(segment))) {
      return invalid();
    }
    return segments;
  } catch {
    return invalid();
  }
}

/** Canonical public HTTP(S) URL: HTTPS, no query/fragment, path and slash preserved. */
export function canonicalUrl(input: string): string {
  return parsePublicUrl(input).href;
}

export function normalizeWebsite(input: string): WebsiteAccount {
  const url = parsePublicUrl(input);
  return { domain: url.hostname.replace(/^www\./, ''), url: url.href };
}

export function normalizeInstagram(input: string): string {
  const value = readInput(input);
  const segments = value.startsWith('@') ? [value.slice(1)] : socialPath(value, /^(?:www\.)?instagram\.com$/);
  const handle = segments[0]?.toLowerCase() ?? '';
  if (
    segments.length !== 1 ||
    !instagramHandle.test(handle) ||
    ['.', '..'].includes(handle) ||
    reservedInstagramPaths.has(handle)
  ) {
    return invalid();
  }
  return handle;
}

export function normalizeVimeo(input: string): VimeoAccount {
  const segments = socialPath(input, /^(?:www\.)?vimeo\.com$/);
  const first = segments[0]?.toLowerCase() ?? '';
  if (
    segments.length === 1 &&
    /^[a-z\d][a-z\d_-]*$/.test(first) &&
    /[a-z]/.test(first) &&
    !reservedVimeoPaths.has(first)
  ) {
    return { kind: 'user', handle: first };
  }
  const handle = segments[1]?.toLowerCase() ?? '';
  if (segments.length !== 2 || !/^[a-z\d][a-z\d_-]*$/.test(handle)) return invalid();
  if (first === 'channels') return { kind: 'channel', handle: `channels/${handle}` };
  if (first === 'groups') return { kind: 'group', handle: `groups/${handle}` };
  if (first === 'showcase' && /^\d+$/.test(handle)) {
    return { kind: 'showcase', handle: `showcase/${handle}` };
  }
  return invalid();
}

export function normalizeYouTube(input: string): YouTubeAccount {
  const segments = socialPath(input, /^(?:www\.|m\.)?youtube\.com$/);
  const hasAccountSuffix = segments[0]?.startsWith('@') ? segments.length === 2 : segments.length === 3;
  if (hasAccountSuffix && ['videos', 'featured'].includes(segments.at(-1) ?? '')) segments.pop();
  const first = segments[0] ?? '';
  if (segments.length === 1 && first.startsWith('@') && simpleHandle.test(first.slice(1))) {
    return { kind: 'handle', value: first.slice(1).toLowerCase() };
  }
  const value = segments[1] ?? '';
  if (segments.length !== 2) return invalid();
  if (first === 'channel' && /^UC[a-zA-Z\d_-]{22}$/.test(value)) return { kind: 'channel', value };
  if ((first === 'user' || first === 'c') && simpleHandle.test(value)) {
    return { kind: first, value: value.toLowerCase() };
  }
  return invalid();
}

export function normalizeLinkedIn(input: string): LinkedInAccount {
  const segments = socialPath(input, /^(?:(?:www|[a-z]{2})\.)?linkedin\.com$/);
  const kind = segments[0];
  const slug = segments[1]?.toLowerCase() ?? '';
  if (
    segments.length !== 2 ||
    !['company', 'showcase', 'school'].includes(kind ?? '') ||
    !/^[\p{L}\p{N}][\p{L}\p{M}\p{N}._&-]*$/u.test(slug)
  ) {
    return invalid();
  }
  return { kind: kind as LinkedInAccount['kind'], slug };
}
