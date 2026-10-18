import type { Market, Tier } from '@/lib/directory/params';
import { isReviewedYouTubeExclusion } from '@/lib/data/exclusions';
import { isFixtureCompany } from '@/lib/data/fixtures';
import { resolveStatusOf, type AccountStatus, type Platform } from '@/lib/view/sources';

/**
 * Coverage derived from recorded rows only. Four separate questions per collection type:
 *  - configured:   a source row exists
 *  - resolved:     the account identity is resolved or needs no resolution
 *  - eligible:     status is active, so it is in the current collection scope
 *  - collected:    a successful collection has actually been observed (last_success_at)
 * Paused, invalid, failing and disabled are reported as recorded, never inferred.
 */
export type CoverageCompany = {
  id: string;
  company_code: string;
  slug: string;
  priority_tier: Tier;
  status: string;
  markets: Market[];
  logo_path: string | null;
};

export type CoverageAccount = {
  competitor_id: string;
  platform: Platform;
  status: AccountStatus;
  resolve_status: string;
  last_success_at: string | null;
  last_error: string | null;
};

export type PlatformCoverage = {
  platform: Platform;
  configured: number;
  resolved: number;
  resolutionFailed: number;
  resolutionPending: number;
  eligible: number;
  collected: number;
  byStatus: Record<AccountStatus, number>;
  flagged: number;
  reviewedExclusions: number;
};

export type CoverageScope = {
  companies: number;
  sources: number;
  platforms: PlatformCoverage[];
};

export type CoverageSummary = {
  companies: {
    total: number;
    byTier: Record<Tier, number>;
    byStatus: Record<string, number>;
    byMarket: Record<Market, number>;
    storedLogos: number;
    initialsFallback: number;
  };
  all: CoverageScope;
  /** Pilot and baseline companies: the current collection scope. */
  pilot: CoverageScope;
  excludedFixtures: number;
};

const PLATFORMS: Platform[] = [
  'vimeo',
  'instagram',
  'instagram_stories',
  'website',
  'website_work_page',
  'linkedin',
  'linkedin_employees',
  'youtube',
  'news',
];

function emptyPlatform(platform: Platform): PlatformCoverage {
  return {
    platform,
    configured: 0,
    resolved: 0,
    resolutionFailed: 0,
    resolutionPending: 0,
    eligible: 0,
    collected: 0,
    byStatus: { active: 0, paused: 0, failing: 0, invalid: 0, disabled: 0 },
    flagged: 0,
    reviewedExclusions: 0,
  };
}

function scope(
  companies: CoverageCompany[],
  accounts: CoverageAccount[],
  codeById: Map<string, string>,
): CoverageScope {
  const ids = new Set(companies.map((company) => company.id));
  const byPlatform = new Map(PLATFORMS.map((platform) => [platform, emptyPlatform(platform)]));
  let sources = 0;
  for (const account of accounts) {
    if (!ids.has(account.competitor_id)) continue;
    const row = byPlatform.get(account.platform);
    if (!row) continue;
    sources += 1;
    row.configured += 1;
    const resolution = resolveStatusOf(account.resolve_status);
    if (resolution === 'resolved' || resolution === 'not_needed') row.resolved += 1;
    else if (resolution === 'failed') row.resolutionFailed += 1;
    else row.resolutionPending += 1;
    if (account.status === 'active') row.eligible += 1;
    if (account.last_success_at) row.collected += 1;
    row.byStatus[account.status] += 1;
    if (account.last_error && account.status !== 'invalid') row.flagged += 1;
    const code = codeById.get(account.competitor_id) ?? '';
    if (isReviewedYouTubeExclusion(code, account.platform, account.status)) row.reviewedExclusions += 1;
  }
  return {
    companies: companies.length,
    sources,
    platforms: PLATFORMS.map((platform) => byPlatform.get(platform)!).filter((row) => row.configured > 0),
  };
}

export function summarizeCoverage(
  allCompanies: CoverageCompany[],
  accounts: CoverageAccount[],
): CoverageSummary {
  const companies = allCompanies.filter((company) => !isFixtureCompany(company));
  const codeById = new Map(companies.map((company) => [company.id, company.company_code]));
  const byTier: Record<Tier, number> = { baseline: 0, pilot: 0, next_wave: 0, adjacent: 0 };
  const byStatus: Record<string, number> = {};
  const byMarket: Record<Market, number> = { EG: 0, KSA: 0, UAE: 0, OTHER: 0 };
  let storedLogos = 0;
  for (const company of companies) {
    byTier[company.priority_tier] += 1;
    byStatus[company.status] = (byStatus[company.status] ?? 0) + 1;
    for (const market of company.markets) byMarket[market] += 1;
    if (company.logo_path) storedLogos += 1;
  }
  const pilotCompanies = companies.filter(
    (company) => company.priority_tier === 'pilot' || company.priority_tier === 'baseline',
  );
  return {
    companies: {
      total: companies.length,
      byTier,
      byStatus,
      byMarket,
      storedLogos,
      initialsFallback: companies.length - storedLogos,
    },
    all: scope(companies, accounts, codeById),
    pilot: scope(pilotCompanies, accounts, codeById),
    excludedFixtures: allCompanies.length - companies.length,
  };
}
