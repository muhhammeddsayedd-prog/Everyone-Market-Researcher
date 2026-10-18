const ORIGIN = 'http://next-path.invalid';
const BLOCKED_PREFIXES = ['/login', '/auth/', '/no-access', '/unavailable'];

/**
 * Returns a same-origin relative path for post-sign-in redirects, or the fallback.
 * Rejects absolute URLs, protocol-relative and backslash tricks, control characters
 * and auth pages (which would loop).
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || raw.length > 1024) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  // Raw or percent-encoded control characters, and encoded slashes/backslashes, are refused.
  if (/[\u0000-\u001f\u007f]|%(?:[01][0-9a-f]|7f|2f|5c)/i.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== ORIGIN) return fallback;
  if (BLOCKED_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix)))
    return fallback;
  return `${url.pathname}${url.search}`;
}
