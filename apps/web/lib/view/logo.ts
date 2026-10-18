/**
 * Logos are served only from the project's public Storage bucket (`media/logos/<slug>.<ext>`,
 * copied and hash-verified at seed time). The original third-party `logo_url` is provenance
 * and is never used as an image source. Anything else falls back to initials.
 */
const LOGO_PATH = /^logos\/[a-z0-9][a-z0-9-]{0,95}\.(svg|webp|png|jpe?g)$/;

export function logoSrc(supabaseUrl: string, logoPath: string | null | undefined): string | null {
  if (!logoPath || !LOGO_PATH.test(logoPath)) return null;
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/media/${logoPath}`;
}

/** Up to two initials from the company name, falling back to the first two letters. */
export function initialsFor(name: string): string {
  const words = name
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return Array.from(words[0]!).slice(0, 2).join('').toUpperCase();
  return (Array.from(words[0]!)[0]! + Array.from(words[1]!)[0]!).toUpperCase();
}
