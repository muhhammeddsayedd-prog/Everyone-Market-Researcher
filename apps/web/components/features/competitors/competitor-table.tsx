import Link from 'next/link';
import { CountryBadge, TierPill } from '@/components/ui/badges';
import { LogoTile } from '@/components/ui/logo-tile';
import type { CompanyListItem } from '@/lib/data/competitors';
import { formatCount, formatRelative } from '@/lib/view/format';
import { HealthDots } from './health-dots';

/**
 * List view. A semantic table on tablet and desktop; stacked label/value rows on phones
 * (DESIGN.md §5.3). Period metrics (items/campaigns in period) wait for stats_daily.
 */
export function CompetitorTable({
  companies,
  hrefFor,
  categoryLabel,
}: {
  companies: CompanyListItem[];
  hrefFor: (slug: string) => string;
  categoryLabel: (code: string) => string;
}) {
  return (
    <>
      <div
        tabIndex={0}
        role="region"
        aria-label="Competitors table (scrollable)"
        className="scroll-fade relative hidden overflow-x-auto rounded-md border border-border md:block"
      >
        <table className="w-full min-w-[880px] border-collapse text-left">
          <caption className="sr-only">Competitors</caption>
          <thead className="bg-surface-2">
            <tr className="type-micro text-fg-label">
              <th scope="col" className="w-14 px-4 py-3">
                <span className="sr-only">Logo</span>
              </th>
              <th scope="col" className="px-4 py-3">
                Name
              </th>
              <th scope="col" className="px-4 py-3">
                Markets
              </th>
              <th scope="col" className="px-4 py-3">
                Tier
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Pilot rank
              </th>
              <th scope="col" className="px-4 py-3">
                Categories
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Items recorded
              </th>
              <th scope="col" className="px-4 py-3">
                Last post
              </th>
              <th scope="col" className="px-4 py-3">
                Sources
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface-1">
            {companies.map((company) => (
              <tr
                key={company.id}
                data-company-code={company.companyCode}
                className="border-t border-border type-small motion-colors hover:bg-surface-2"
              >
                <td className="px-4 py-2.5">
                  <LogoTile src={company.logoSrc} name={company.name} size={32} />
                </td>
                <th scope="row" className="max-w-[260px] px-4 py-2.5 font-medium">
                  <Link
                    href={hrefFor(company.slug)}
                    className="block truncate rounded-sm type-body text-fg hover:underline"
                    dir="auto"
                  >
                    {company.name}
                  </Link>
                  <span className="type-small text-fg-label tabular">{company.companyCode}</span>
                </th>
                <td className="px-4 py-2.5">
                  <span className="flex flex-wrap gap-1">
                    {company.markets.map((market) => (
                      <CountryBadge key={market} market={market} />
                    ))}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <TierPill tier={company.tier} />
                </td>
                <td className="px-4 py-2.5 text-right tabular text-fg-secondary">
                  {company.pilotRank ?? '—'}
                </td>
                <td className="max-w-[240px] truncate px-4 py-2.5 text-fg-secondary">
                  {company.categories.length ? company.categories.map(categoryLabel).join(', ') : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-fg-secondary">
                  {company.itemsRecorded ? formatCount(company.itemsRecorded) : '—'}
                </td>
                <td className="px-4 py-2.5 text-fg-secondary">{formatRelative(company.lastItemAt)}</td>
                <td className="px-4 py-2.5">
                  <HealthDots health={company.health} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label="Competitors">
        {companies.map((company) => (
          <li key={company.id} className="rounded-md border border-border bg-surface-1 p-4">
            <div className="flex items-center gap-3">
              <LogoTile src={company.logoSrc} name={company.name} size={40} />
              <Link
                href={hrefFor(company.slug)}
                className="min-w-0 flex-1 truncate rounded-sm type-body text-fg"
                dir="auto"
              >
                {company.name}
              </Link>
              <TierPill tier={company.tier} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 type-small">
              <dt className="type-micro text-fg-label">Markets</dt>
              <dd className="text-fg-secondary">{company.markets.join(' · ') || '—'}</dd>
              <dt className="type-micro text-fg-label">Pilot rank</dt>
              <dd className="text-fg-secondary tabular">{company.pilotRank ?? '—'}</dd>
              <dt className="type-micro text-fg-label">Last post</dt>
              <dd className="text-fg-secondary">{formatRelative(company.lastItemAt)}</dd>
              <dt className="type-micro text-fg-label">Sources</dt>
              <dd>
                <HealthDots health={company.health} />
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
