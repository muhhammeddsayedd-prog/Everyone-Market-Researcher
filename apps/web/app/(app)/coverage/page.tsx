import type { Metadata } from 'next';
import { PageHeader } from '@/components/features/page-header';
import { MARKET_NAME, TIER_LABEL } from '@/components/ui/badges';
import { requireMember } from '@/lib/auth/viewer';
import type { CoverageScope } from '@/lib/sources/coverage-summary';
import { getCoverageSummary } from '@/lib/data/coverage';
import { MARKETS, TIERS } from '@/lib/directory/params';
import { formatCount } from '@/lib/view/format';
import { COLLECTION_TYPE_LABEL } from '@/lib/view/sources';

export const metadata: Metadata = { title: 'Coverage' };

function ScopeTable({
  id,
  title,
  description,
  scope,
}: {
  id: string;
  title: string;
  description: string;
  scope: CoverageScope;
}) {
  const columns = [
    { key: 'configured', label: 'Configured' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'eligible', label: 'In scope (active)' },
    { key: 'collected', label: 'Collected' },
    { key: 'paused', label: 'Paused' },
    { key: 'invalid', label: 'Invalid' },
    { key: 'failing', label: 'Failing' },
    { key: 'flagged', label: 'Flagged' },
  ] as const;
  const value = (row: CoverageScope['platforms'][number], key: (typeof columns)[number]['key']) => {
    if (key === 'paused' || key === 'invalid' || key === 'failing') return row.byStatus[key];
    return row[key];
  };
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="type-h3">
          {title}
        </h2>
        <p className="mt-1 max-w-[72ch] type-body text-fg-muted">
          {description} {formatCount(scope.companies)} companies · {formatCount(scope.sources)} source
          records.
        </p>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label={`${title} (scrollable)`}
        className="scroll-fade relative overflow-x-auto rounded-md border border-border"
      >
        <table className="w-full min-w-[820px] border-collapse text-left">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-surface-2">
            <tr className="type-micro text-fg-label">
              <th scope="col" className="px-4 py-3">
                Collection type
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-4 py-3 text-right">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface-1 type-small">
            {scope.platforms.map((row) => (
              <tr key={row.platform} className="border-t border-border">
                <th scope="row" className="px-4 py-3 font-medium text-fg">
                  {COLLECTION_TYPE_LABEL[row.platform]}
                  {row.reviewedExclusions ? (
                    <span className="block type-small text-fg-muted">
                      {formatCount(row.reviewedExclusions)} reviewed{' '}
                      {row.reviewedExclusions === 1 ? 'exclusion' : 'exclusions'} (D-27)
                    </span>
                  ) : null}
                </th>
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-right tabular text-fg-secondary">
                    {formatCount(value(row, column.key))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function CoveragePage() {
  await requireMember();
  const summary = await getCoverageSummary();
  const { companies } = summary;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        kicker="Market"
        title="Coverage"
        meta="Counted from the records your account can read. Nothing here is estimated."
      />

      <section aria-labelledby="companies-coverage" className="flex flex-col gap-4">
        <h2 id="companies-coverage" className="type-h3">
          Companies
        </h2>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4">
          {[
            { label: 'Companies', value: companies.total },
            { label: 'Stored logos', value: companies.storedLogos },
            { label: 'Initials fallback', value: companies.initialsFallback },
            { label: 'Paused companies', value: companies.byStatus.paused ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface-1 p-4">
              <dt className="type-micro text-fg-label">{stat.label}</dt>
              <dd className="mt-2 type-h2 tabular">{formatCount(stat.value)}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border border-border bg-surface-1 p-4">
            <h3 className="type-micro text-fg-label">By tier</h3>
            <ul className="mt-3 flex flex-col gap-1.5 type-body">
              {TIERS.map((tier) => (
                <li key={tier} className="flex justify-between">
                  <span className="text-fg-secondary">{TIER_LABEL[tier]}</span>
                  <span className="tabular">{formatCount(companies.byTier[tier])}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-border bg-surface-1 p-4">
            <h3 className="type-micro text-fg-label">By market (a company can cover several)</h3>
            <ul className="mt-3 flex flex-col gap-1.5 type-body">
              {MARKETS.map((market) => (
                <li key={market} className="flex justify-between">
                  <span className="text-fg-secondary">{MARKET_NAME[market]}</span>
                  <span className="tabular">{formatCount(companies.byMarket[market])}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ScopeTable
        id="pilot-coverage"
        title="Pilot and baseline sources"
        description="The current collection scope. Paused rows are recorded but not collected; reviewed exclusions stay invalid with their observed reason."
        scope={summary.pilot}
      />
      <ScopeTable
        id="all-coverage"
        title="All sources"
        description="Every recorded source across all tiers."
        scope={summary.all}
      />

      <p className="max-w-[72ch] type-small text-fg-muted">
        Configured: a source row exists. Resolved: the account identity is confirmed or needs no lookup. In
        scope: status is active, so it is scheduled for collection. Collected: a successful collection has
        been observed. Flagged: an error was recorded on a source that is still configured. Smoke-test
        fixtures are excluded from every count.
      </p>
    </div>
  );
}
