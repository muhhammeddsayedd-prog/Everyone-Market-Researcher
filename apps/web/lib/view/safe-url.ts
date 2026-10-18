export type ExternalLink = { href: string; host: string };

/**
 * Source URLs come from collected data and are untrusted. Only plain http(s) URLs without
 * embedded credentials are rendered as links; anything else is shown as unavailable.
 */
export function safeExternalUrl(raw: string | null | undefined): ExternalLink | null {
  if (!raw || raw.length > 2048) return null;
  const trimmed = raw.trim();
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || !url.hostname.includes('.')) return null;
  return { href: url.toString(), host: url.hostname.replace(/^www\./, '') };
}

/** Attributes for every link that leaves the app. */
export const EXTERNAL_LINK_PROPS = {
  target: '_blank',
  rel: 'noopener noreferrer nofollow',
  referrerPolicy: 'no-referrer',
} as const;
