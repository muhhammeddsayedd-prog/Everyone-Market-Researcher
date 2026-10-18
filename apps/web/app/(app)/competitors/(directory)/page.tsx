import type { Metadata } from 'next';
import { CompetitorCard } from '@/components/features/competitors/competitor-card';
import { CompetitorTable } from '@/components/features/competitors/competitor-table';
import {
  ActiveFilters,
  DirectoryPagination,
  ViewToggle,
  type ActiveFilter,
} from '@/components/features/competitors/directory-controls';
import { DirectoryFilters } from '@/components/features/competitors/directory-filters';
import { CoverageStrip } from '@/components/features/source-coverage/coverage-strip';
import { PageHeader } from '@/components/features/page-header';
import { TIER_LABEL, MARKET_NAME } from '@/components/ui/badges';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { requireMember } from '@/lib/auth/viewer';
import { listCompetitors } from '@/lib/data/competitors';
import { getCoverageSummary } from '@/lib/data/coverage';
import { getTaxonomyLabels, labelFor } from '@/lib/data/taxonomy';
import {
  activeFilterCount,
  directoryHref,
  parseDirectoryParams,
  type DirectoryParams,
  type RawSearchParams,
} from '@/lib/directory/params';
import { profileHref } from '@/lib/directory/return-to';
import { formatCount } from '@/lib/view/format';

export const metadata: Metadata = { title: 'Competitors' };

type Props = { searchParams: Promise<RawSearchParams> };

const STATUS_LABEL: Record<string, string> = { active: 'Active', paused: 'Paused', archived: 'Archived' };

export default async function CompetitorsPage({ searchParams }: Props) {
  await requireMember();
  const params = parseDirectoryParams(await searchParams);
  const [page, taxonomy, coverage] = await Promise.all([
    listCompetitors(params),
    getTaxonomyLabels(),
    getCoverageSummary(),
  ]);

  const categoryLabel = (code: string) => labelFor(taxonomy.categories, code);
  const capabilityLabel = (code: string) => labelFor(taxonomy.capabilities, code);
  const hrefFor = (slug: string) => profileHref(slug, params);
  const rows = page.baseline ? [page.baseline, ...page.items] : page.items;
  const filters = describeFilters(params, categoryLabel, capabilityLabel);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker="Market"
        title="Competitors"
        meta={
          <span className="tabular">
            {filters.length === 0
              ? `${formatCount(page.total)} companies`
              : `${formatCount(page.total)} of ${formatCount(coverage.companies.total)} companies match`}
          </span>
        }
      />

      <CoverageStrip summary={coverage} />

      <DirectoryFilters
        params={params}
        activeCount={activeFilterCount(params)}
        categories={taxonomy.categories.map((term) => ({ value: term.code, label: term.label }))}
        capabilities={taxonomy.capabilities
          .filter((term) => term.code !== 'not_stated_on_own_site')
          .map((term) => ({ value: term.code, label: term.label }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActiveFilters params={params} filters={filters} />
        <div className="ml-auto">
          <ViewToggle params={params} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filters.length ? 'No companies match these filters.' : 'No companies are visible.'}
          hint={
            filters.length
              ? 'Try removing a filter or searching for a shorter name.'
              : 'Your account can read the directory, but no company records were returned.'
          }
          action={
            filters.length ? (
              <ButtonLink
                href={directoryHref(params, {
                  q: '',
                  market: null,
                  tier: null,
                  category: null,
                  capability: null,
                  status: null,
                })}
              >
                Clear filters
              </ButtonLink>
            ) : undefined
          }
        />
      ) : params.view === 'list' ? (
        <CompetitorTable companies={rows} hrefFor={hrefFor} categoryLabel={categoryLabel} />
      ) : (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4"
          aria-label="Competitors"
        >
          {rows.map((company) => (
            <li key={company.id}>
              <CompetitorCard company={company} href={hrefFor(company.slug)} categoryLabel={categoryLabel} />
            </li>
          ))}
        </ul>
      )}

      {page.total > 0 ? (
        <DirectoryPagination
          params={params}
          page={page.page}
          total={page.total}
          shown={rows.length}
          nextCursor={page.nextCursor}
          prevCursor={page.prevCursor}
        />
      ) : null}
    </div>
  );
}

function describeFilters(
  params: DirectoryParams,
  categoryLabel: (code: string) => string,
  capabilityLabel: (code: string) => string,
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  if (params.q) filters.push({ key: 'q', label: `“${params.q}”` });
  if (params.market) filters.push({ key: 'market', label: MARKET_NAME[params.market] });
  if (params.tier) filters.push({ key: 'tier', label: TIER_LABEL[params.tier] });
  if (params.category) filters.push({ key: 'category', label: categoryLabel(params.category) });
  if (params.capability) filters.push({ key: 'capability', label: capabilityLabel(params.capability) });
  if (params.status) filters.push({ key: 'status', label: STATUS_LABEL[params.status] ?? params.status });
  return filters;
}
