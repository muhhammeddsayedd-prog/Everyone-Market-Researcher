import type { Market, Tier } from '@/lib/directory/params';
import { FAMILY_LABEL, PLATFORM_FAMILY, type Platform, type PlatformFamily } from '@/lib/view/sources';
import { cx } from './cx';
import { PlatformGlyph } from './platform-glyph';

export const TIER_LABEL: Record<Tier, string> = {
  baseline: 'Baseline',
  pilot: 'Pilot',
  next_wave: 'Next wave',
  adjacent: 'Adjacent',
};

export const MARKET_NAME: Record<Market, string> = {
  EG: 'Egypt',
  KSA: 'Saudi Arabia',
  UAE: 'UAE',
  OTHER: 'Other markets',
};

export function CountryBadge({ market }: { market: Market }) {
  return (
    <span
      title={MARKET_NAME[market]}
      className="inline-flex h-5 items-center rounded-[6px] bg-surface-2 px-1.5 type-micro text-fg-secondary"
    >
      <span className="sr-only">{MARKET_NAME[market]}</span>
      <span aria-hidden="true">{market}</span>
    </span>
  );
}

export function TierPill({ tier }: { tier: Tier }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center rounded-full px-2.5 type-small whitespace-nowrap',
        tier === 'baseline'
          ? 'bg-accent-soft text-accent'
          : tier === 'pilot'
            ? 'border border-border-strong text-fg'
            : 'border border-border text-fg-muted',
      )}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

const PLATFORM_TEXT: Record<PlatformFamily, string> = {
  vimeo: 'text-vimeo border-vimeo',
  instagram: 'text-instagram border-instagram',
  website: 'text-website border-website',
  linkedin: 'text-linkedin border-linkedin',
  youtube: 'text-youtube border-youtube',
  news: 'text-news border-news',
};

/** Platform colour only as the glyph and its 1 px outline (DESIGN.md §3.2). */
export function PlatformBadge({ platform, label }: { platform: Platform; label?: string }) {
  const family = PLATFORM_FAMILY[platform];
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 type-micro',
        PLATFORM_TEXT[family],
      )}
    >
      <PlatformGlyph family={family} className="size-3" />
      <span className="text-fg-secondary normal-case">{label ?? FAMILY_LABEL[family]}</span>
    </span>
  );
}

export function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 max-w-full items-center truncate rounded-full bg-surface-2 px-2.5 type-small text-fg-secondary">
      {label}
    </span>
  );
}
