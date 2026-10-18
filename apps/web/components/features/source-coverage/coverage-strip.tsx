import Link from 'next/link';
import type { CoverageSummary } from '@/lib/sources/coverage-summary';
import { formatCount } from '@/lib/view/format';

/** Compact stat row derived from the visible records (never hard-coded totals). */
export function CoverageStrip({ summary }: { summary: CoverageSummary }) {
  const eligible = summary.all.platforms.reduce((sum, row) => sum + row.eligible, 0);
  const collected = summary.all.platforms.reduce((sum, row) => sum + row.collected, 0);
  const stats = [
    { label: 'Companies', value: formatCount(summary.companies.total) },
    { label: 'Source records', value: formatCount(summary.all.sources) },
    { label: 'In collection scope', value: formatCount(eligible) },
    { label: 'Collected so far', value: formatCount(collected) },
    { label: 'Stored logos', value: formatCount(summary.companies.storedLogos) },
  ];
  return (
    <section aria-labelledby="coverage-strip" className="rounded-md border border-border bg-surface-1">
      <h2 id="coverage-strip" className="sr-only">
        Coverage summary
      </h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t-md bg-border lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface-1 p-4 last:col-span-2 lg:last:col-span-1">
            <dt className="type-micro text-fg-label">{stat.label}</dt>
            <dd className="mt-2 type-h2 tabular text-fg">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <p className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 type-small text-fg-muted">
        <span>
          {formatCount(summary.companies.initialsFallback)} companies show initials where no logo is stored.
        </span>
        <Link href="/coverage" className="text-fg-secondary underline-offset-4 hover:text-fg hover:underline">
          See coverage by platform
        </Link>
      </p>
    </section>
  );
}
