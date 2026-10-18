/** Display formatting per DESIGN.md §10. Dates render in Cairo time. */
const TIME_ZONE = 'Africa/Cairo';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
});

const countFormat = new Intl.NumberFormat('en-GB');

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "16 Oct 2026", or the em dash for a missing value. */
export function formatDate(value: string | null | undefined): string {
  const date = parse(value);
  return date ? dateFormat.format(date).replace(/,/g, '') : '—';
}

/** "16 Oct 2026, 08:12" in Cairo time. */
export function formatDateTime(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return '—';
  const parts = dateTimeFormat.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}`;
}

/** "just now", "12 min ago", "5 h ago", "3 days ago", then the absolute date. */
export function formatRelative(value: string | null | undefined, now: Date = new Date()): string {
  const date = parse(value);
  if (!date) return '—';
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return formatDate(value);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86_400) {
    const days = Math.floor(seconds / 86_400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  return formatDate(value);
}

/** 1,234 → 1.2K; 12,400 → 12.4K; 1,200,000 → 1.2M. Below 1,000 the exact value. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const scale = (divisor: number, suffix: string) =>
    `${(Math.round((value / divisor) * 10) / 10).toFixed(1).replace(/\.0$/, '')}${suffix}`;
  if (abs >= 1_000_000) return scale(1_000_000, 'M');
  if (abs >= 1_000) return scale(1_000, 'K');
  return countFormat.format(value);
}

export function formatCount(value: number): string {
  return Number.isFinite(value) ? countFormat.format(value) : '—';
}

/** Integers unless under 10% (one decimal). */
export function formatPercent(part: number, whole: number): string {
  if (!whole) return '—';
  const pct = (part / whole) * 100;
  return pct < 10 && pct > 0 ? `${pct.toFixed(1).replace(/\.0$/, '')}%` : `${Math.round(pct)}%`;
}
