import Link from 'next/link';
import { CategoryChip, CountryBadge, TierPill } from '@/components/ui/badges';
import { LogoTile } from '@/components/ui/logo-tile';
import type { CompanyListItem } from '@/lib/data/competitors';
import { ActivityNote } from './activity-note';
import { HealthDots } from './health-dots';

const MAX_CHIPS = 3;

/** DESIGN.md §6 CompetitorCard: the logo leads; the whole card links to the profile. */
export function CompetitorCard({
  company,
  href,
  categoryLabel,
}: {
  company: CompanyListItem;
  href: string;
  categoryLabel: (code: string) => string;
}) {
  const extra = company.categories.length - MAX_CHIPS;
  return (
    <article
      data-company-code={company.companyCode}
      className="card-link group relative flex h-full flex-col gap-4 rounded-md border border-border bg-surface-1 p-4 motion-colors hover:border-border-strong"
    >
      <div className="flex items-start gap-4">
        <LogoTile src={company.logoSrc} name={company.name} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="type-h3 line-clamp-2 text-fg" dir="auto">
            <Link
              href={href}
              className="rounded-sm after:absolute after:inset-0 after:rounded-md focus-visible:after:shadow-[var(--focus-ring)] focus-visible:shadow-none"
            >
              {company.name}
            </Link>
          </h2>
          {company.nameAr ? (
            <p className="mt-1 truncate type-small text-fg-muted">
              <span lang="ar" dir="rtl">
                {company.nameAr}
              </span>
            </p>
          ) : null}
          <p className="mt-1 type-small text-fg-label tabular">{company.companyCode}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TierPill tier={company.tier} />
        {company.status !== 'active' ? (
          <span className="inline-flex h-6 items-center rounded-full bg-surface-3 px-2.5 type-small text-fg-muted capitalize">
            {company.status}
          </span>
        ) : null}
        {company.markets.map((market) => (
          <CountryBadge key={market} market={market} />
        ))}
      </div>
      {company.categories.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Categories">
          {company.categories.slice(0, MAX_CHIPS).map((code) => (
            <li key={code} className="max-w-full">
              <CategoryChip label={categoryLabel(code)} />
            </li>
          ))}
          {extra > 0 ? (
            <li className="inline-flex h-6 items-center px-1 type-small text-fg-muted">+{extra}</li>
          ) : null}
        </ul>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <ActivityNote itemsRecorded={company.itemsRecorded} lastItemAt={company.lastItemAt} />
        <HealthDots health={company.health} />
      </div>
    </article>
  );
}
