import { describe, expect, it } from 'vitest';
import { isReviewedYouTubeExclusion, REVIEWED_YOUTUBE_EXCLUSIONS } from './data/exclusions';
import { isFixtureCompany } from './data/fixtures';
import { navFor, PAGES } from './nav/registry';
import { summarizeCoverage, type CoverageAccount, type CoverageCompany } from './sources/coverage-summary';
import { CAPABILITY_GROUP_ORDER, capabilityGroupOf, groupCapabilities } from './taxonomy/groups';
import { formatCompact, formatDate, formatDateTime, formatPercent, formatRelative } from './view/format';
import { describeSourceError, familyHealth } from './view/sources';

const company = (overrides: Partial<CoverageCompany>): CoverageCompany => ({
  id: crypto.randomUUID(),
  company_code: 'C001',
  slug: 'c-001',
  priority_tier: 'pilot',
  status: 'active',
  markets: ['EG'],
  logo_path: null,
  ...overrides,
});

const account = (competitorId: string, overrides: Partial<CoverageAccount>): CoverageAccount => ({
  competitor_id: competitorId,
  platform: 'instagram',
  status: 'active',
  resolve_status: 'not_needed',
  last_success_at: null,
  last_error: null,
  ...overrides,
});

describe('fixtures and exclusions', () => {
  it('classifies the smoke fixtures by code or slug', () => {
    expect(isFixtureCompany({ company_code: 'C999', slug: 'anything' })).toBe(true);
    expect(isFixtureCompany({ company_code: 'C100', slug: 'emr-smoke-test' })).toBe(true);
    expect(isFixtureCompany({ company_code: 'C100', slug: 'test-house' })).toBe(true);
    expect(isFixtureCompany({ company_code: 'C100', slug: 'good-people' })).toBe(false);
  });

  it('exempts only the seven reviewed YouTube identities (D-27)', () => {
    expect(REVIEWED_YOUTUBE_EXCLUSIONS).toHaveLength(7);
    expect(isReviewedYouTubeExclusion('C283', 'youtube', 'invalid')).toBe(true);
    expect(isReviewedYouTubeExclusion('C283', 'vimeo', 'invalid')).toBe(false);
    expect(isReviewedYouTubeExclusion('C001', 'youtube', 'invalid')).toBe(false);
    expect(isReviewedYouTubeExclusion('C283', 'youtube', 'active')).toBe(false);
  });
});

describe('summarizeCoverage', () => {
  it('separates configured, resolved, eligible and collected, and excludes fixtures', () => {
    const pilot = company({ company_code: 'C102', logo_path: 'logos/a.svg', markets: ['EG', 'KSA'] });
    const adjacent = company({
      company_code: 'C200',
      slug: 'c-200',
      priority_tier: 'adjacent',
      status: 'paused',
    });
    const fixture = company({ company_code: 'C999', slug: 'emr-smoke-test' });
    const summary = summarizeCoverage(
      [pilot, adjacent, fixture],
      [
        account(pilot.id, { last_success_at: '2026-10-17T06:00:00Z' }),
        account(pilot.id, { platform: 'instagram_stories' }),
        account(pilot.id, {
          platform: 'youtube',
          status: 'invalid',
          resolve_status: 'failed',
          last_error: 'yt_not_found',
        }),
        account(pilot.id, { platform: 'website', last_error: 'unreachable_timeout' }),
        account(adjacent.id, { platform: 'vimeo', status: 'paused', resolve_status: 'pending' }),
        account(fixture.id, { platform: 'vimeo', last_success_at: '2026-10-17T06:00:00Z' }),
      ],
    );
    expect(summary.excludedFixtures).toBe(1);
    expect(summary.companies).toMatchObject({ total: 2, storedLogos: 1, initialsFallback: 1 });
    expect(summary.companies.byMarket).toEqual({ EG: 2, KSA: 1, UAE: 0, OTHER: 0 });
    expect(summary.all.sources).toBe(5);
    expect(summary.pilot.sources).toBe(4);

    const row = (platform: string) => summary.all.platforms.find((p) => p.platform === platform)!;
    expect(row('instagram')).toMatchObject({ configured: 1, resolved: 1, eligible: 1, collected: 1 });
    expect(row('youtube')).toMatchObject({
      configured: 1,
      resolved: 0,
      resolutionFailed: 1,
      eligible: 0,
      reviewedExclusions: 1,
      flagged: 0,
    });
    expect(row('website')).toMatchObject({ flagged: 1, eligible: 1 });
    expect(row('vimeo')).toMatchObject({ configured: 1, resolutionPending: 1, eligible: 0, collected: 0 });
    expect(summary.pilot.platforms.find((p) => p.platform === 'vimeo')).toBeUndefined();
  });
});

describe('source presentation', () => {
  it('describes recorded error codes without inventing causes', () => {
    expect(describeSourceError('yt_custom_url_unresolved')).toBe('Custom YouTube URL could not be resolved');
    expect(describeSourceError('unreachable_404')).toBe('Website unreachable (HTTP 404)');
    expect(describeSourceError('unreachable_network')).toBe('Website unreachable (network)');
    expect(describeSourceError('Something new')).toBe('Something new');
    expect(describeSourceError(null)).toBeNull();
  });

  it('reports the worst status per platform family, or no source', () => {
    const health = familyHealth([
      { platform: 'instagram', status: 'active' },
      { platform: 'instagram_stories', status: 'failing' },
      { platform: 'linkedin_employees', status: 'paused' },
    ]);
    expect(health).toEqual([
      { family: 'vimeo', status: null },
      { family: 'instagram', status: 'failing' },
      { family: 'website', status: null },
      { family: 'linkedin', status: 'paused' },
      { family: 'youtube', status: null },
    ]);
  });
});

describe('capability groups', () => {
  it('maps every seeded capability code and hides "not stated"', () => {
    expect(capabilityGroupOf('directors_roster')).toBe('pre_production');
    expect(capabilityGroupOf('drone_aerial')).toBe('shoot');
    expect(capabilityGroupOf('colour_grading')).toBe('post');
    expect(capabilityGroupOf('film_distribution')).toBe('distribution');
    expect(capabilityGroupOf('brand_new_code')).toBe('other');
    const groups = groupCapabilities(['editing', 'casting', 'not_stated_on_own_site', 'unknown']);
    expect(groups.map((g) => g.group)).toEqual(['pre_production', 'post', 'other']);
    expect(CAPABILITY_GROUP_ORDER).toHaveLength(5);
  });
});

describe('formatters (DESIGN.md §10, Cairo time)', () => {
  it('formats dates, times and relative times', () => {
    expect(formatDate('2026-10-16T21:30:00Z')).toBe('17 Oct 2026');
    expect(formatDateTime('2026-10-16T06:12:00Z')).toBe('16 Oct 2026, 09:12');
    expect(formatDate(null)).toBe('—');
    const now = new Date('2026-10-18T12:00:00Z');
    expect(formatRelative('2026-10-18T11:59:30Z', now)).toBe('just now');
    expect(formatRelative('2026-10-18T11:48:00Z', now)).toBe('12 min ago');
    expect(formatRelative('2026-10-18T07:00:00Z', now)).toBe('5 h ago');
    expect(formatRelative('2026-10-17T12:00:00Z', now)).toBe('1 day ago');
    expect(formatRelative('2026-10-01T12:00:00Z', now)).toBe('1 Oct 2026');
  });

  it('abbreviates big numbers and percentages', () => {
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(1234)).toBe('1.2K');
    expect(formatCompact(12_400)).toBe('12.4K');
    expect(formatCompact(1_200_000)).toBe('1.2M');
    expect(formatCompact(2000)).toBe('2K');
    expect(formatPercent(3, 40)).toBe('7.5%');
    expect(formatPercent(17, 40)).toBe('43%');
    expect(formatPercent(1, 0)).toBe('—');
  });
});

describe('navigation registry', () => {
  it('hides admin and review pages from viewers', () => {
    const viewer = navFor('viewer').map((page) => page.path);
    expect(viewer).not.toContain('/admin/costs');
    expect(viewer).not.toContain('/review');
    expect(navFor('admin').map((page) => page.path)).toContain('/admin/costs');
  });

  it('names a dependency for every planned page', () => {
    for (const page of PAGES.filter((p) => p.state === 'planned')) expect(page.needs, page.path).toBeTruthy();
  });
});
