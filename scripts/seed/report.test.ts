import { describe, expect, it } from 'vitest';
import {
  buildReport,
  csvCell,
  markdownCell,
  type ReportAccount,
  type ReportCompetitor,
  type ReportSnapshot,
} from './report';
import { validateMcpReportEnvelope } from './render-mcp-report';

const competitor = (changes: Partial<ReportCompetitor> = {}): ReportCompetitor => ({
  id: '00000000-0000-4000-8000-000000000001',
  company_code: 'C000',
  slug: 'everyone-films',
  name: 'Everyone Films',
  priority_tier: 'baseline',
  pilot_rank: null,
  is_baseline: true,
  logo_url: null,
  logo_path: 'logos/everyone-films.svg',
  ...changes,
});
const account = (changes: Partial<ReportAccount> = {}): ReportAccount => ({
  id: '00000000-0000-4000-8000-000000000011',
  competitor_id: '00000000-0000-4000-8000-000000000001',
  platform: 'vimeo',
  handle: 'everyonefilms',
  handle_norm: 'everyonefilms',
  url: 'https://vimeo.com/everyonefilms',
  status: 'active',
  resolve_status: 'resolved',
  external_id: '123',
  uploads_playlist_id: null,
  last_error: null,
  backfill_status: 'pending',
  backfill_from: '2024-01-01',
  cadence: '1 day',
  ...changes,
});
const snapshot = (changes: Partial<ReportSnapshot> = {}): ReportSnapshot => ({
  competitors: [competitor()],
  accounts: [account()],
  mediaAssets: [
    {
      id: 1,
      competitor_id: competitor().id,
      kind: 'logo',
      storage_path: 'logos/everyone-films.svg',
      source_url: null,
    },
  ],
  ...changes,
});
const options = { environment: 'local' as const, target: 'fixture-only', observedAt: '2026-10-18T00:00:00Z' };

describe('M02 snapshot report', () => {
  it.each([
    { projectRef: 'hkiafqrcxaafdbcvjlzv', source: 'dev_scoped_supabase_mcp_readback' },
    { projectRef: 'zmotjsbzhzjvpelxvxlf', source: 'local_fixture' },
  ])('rejects recovery metadata from another target or source', ({ projectRef, source }) => {
    expect(() =>
      validateMcpReportEnvelope({
        environment: 'dev',
        projectRef,
        source,
        observedAt: options.observedAt,
        snapshot: snapshot(),
        issues: [{}, {}, {}],
      }),
    ).toThrow('M02_MCP_REPORT_ENVELOPE_REJECTED');
  });
  it('groups tiers, platform statuses, resolution/backfill and actual pilot denominators', () => {
    const result = buildReport(
      snapshot({
        competitors: [
          competitor(),
          competitor({
            id: '00000000-0000-4000-8000-000000000002',
            company_code: 'C001',
            slug: 'test',
            name: 'Test',
            priority_tier: 'pilot',
            is_baseline: false,
            pilot_rank: 1,
            logo_path: null,
          }),
        ],
        accounts: [
          account(),
          account({
            id: '00000000-0000-4000-8000-000000000012',
            competitor_id: '00000000-0000-4000-8000-000000000002',
            status: 'invalid',
            resolve_status: 'failed',
            external_id: null,
            last_error: 'vimeo_404',
          }),
          account({
            id: '00000000-0000-4000-8000-000000000013',
            platform: 'instagram_stories',
            handle: 'everyone.film',
            handle_norm: 'everyone.film',
            url: 'https://www.instagram.com/everyone.film/',
            resolve_status: 'not_needed',
            external_id: null,
            backfill_status: 'not_applicable',
          }),
        ],
      }),
      options,
    );
    expect(result.counts.competitors).toBe(2);
    expect(result.counts.tiers).toEqual({ baseline: 1, pilot: 1 });
    expect(result.counts.platformStatuses.vimeo).toEqual({ active: 1, invalid: 1 });
    expect(result.counts.resolveStatuses).toEqual({ resolved: 1, failed: 1, not_needed: 1 });
    expect(result.counts.backfillStatuses).toEqual({ pending: 2, not_applicable: 1 });
    expect(result.counts.resolution.vimeo.pilot).toEqual({ total: 2, resolved: 1 });
    expect(result.summaryMarkdown).toContain('local');
    expect(result.summaryMarkdown).toContain('fixture-only');
    expect(result.summaryMarkdown).toContain('Owner review is pending');
    expect(result.reviewItems.every((row) => row.owner_decision === '')).toBe(true);
  });

  it.each([null, '', '0', 'not-an-id'])(
    'does not count Vimeo resolved with external ID %s as successful',
    (external_id) => {
      const result = buildReport(snapshot({ accounts: [account({ external_id })] }), options);
      expect(result.counts.resolution.vimeo.resolved).toBe(0);
      expect(result.reviewItems.some((row) => row.reason === 'resolved_missing_identifier')).toBe(true);
    },
  );

  it('requires both valid YouTube channel and uploads identifiers', () => {
    const result = buildReport(
      snapshot({
        accounts: [
          account({ platform: 'youtube', external_id: `UC${'a'.repeat(22)}`, uploads_playlist_id: null }),
        ],
      }),
      options,
    );
    expect(result.counts.resolution.youtube.resolved).toBe(0);
    expect(result.counts.resolution.youtube.missingIdentifiers).toBe(1);
  });

  it('reports low-rate/auth/transient errors separately and keeps pending rows unresolved', () => {
    const result = buildReport(
      snapshot({
        accounts: [
          account({ resolve_status: 'pending', external_id: null, last_error: 'vimeo_rate_limit_deferred' }),
          account({
            id: '00000000-0000-4000-8000-000000000012',
            platform: 'youtube',
            resolve_status: 'pending',
            external_id: null,
            last_error: 'yt_quota',
          }),
        ],
      }),
      options,
    );
    expect(result.counts.providerErrors).toEqual({ vimeo_rate_limit_deferred: 1, yt_quota: 1 });
    expect(result.counts.resolution.vimeo.pending).toBe(1);
    expect(result.reviewItems.some((row) => row.reason.includes('vimeo_rate_limit_deferred'))).toBe(true);
  });

  it('reports missing source and baseline logos with media metadata coverage', () => {
    const result = buildReport(
      snapshot({
        competitors: [
          competitor({ logo_path: null }),
          competitor({
            id: '00000000-0000-4000-8000-000000000002',
            company_code: 'C001',
            slug: 'studio',
            name: 'Studio',
            is_baseline: false,
            priority_tier: 'adjacent',
            logo_url: 'https://images.example.com/a.png',
            logo_path: null,
          }),
        ],
        mediaAssets: [],
      }),
      options,
    );
    expect(result.counts.logos).toMatchObject({
      sourceTotal: 1,
      sourceCopied: 0,
      missingSourceCopy: 1,
      baselineTotal: 1,
      baselineCopied: 0,
    });
    expect(result.reviewItems.map((row) => row.reason)).toContain('missing_baseline_logo');
    expect(result.reviewItems.map((row) => row.reason)).toContain('missing_logo');
  });

  it('does not treat a logo_path as a matching media asset or public HTTP receipt', () => {
    const result = buildReport(snapshot({ mediaAssets: [] }), options);
    expect(result.counts.logos.mediaMetadataMissing).toBe(1);
    expect(result.reviewItems.map((row) => row.reason)).toContain('missing_logo_media_asset');
    expect(result.summaryMarkdown).toContain('Public logo HTTP visibility requires a separate live check');
  });
  it('accepts the lossless decimal-string bigint IDs returned by the native PostgreSQL adapter', () => {
    const input = snapshot();
    const native = { ...input, mediaAssets: input.mediaAssets.map((asset) => ({ ...asset, id: '1' })) };
    const result = buildReport(native, options);
    expect(result.counts.logos.mediaMetadataMissing).toBe(0);
    expect(result.counts.logos.baselineCopied).toBe(1);
  });
  it('keeps maximum PostgreSQL bigint identifiers lossless instead of converting them to Number', () => {
    const input = snapshot();
    const native = {
      ...input,
      mediaAssets: input.mediaAssets.map((asset) => ({ ...asset, id: '9223372036854775807' })),
    };
    expect(buildReport(native, options).counts.logos.mediaMetadataMissing).toBe(0);
    expect(native.mediaAssets[0]?.id).toBe('9223372036854775807');
  });
  it.each(['-1', '1.2', '1e3', '9223372036854775808', 'not-an-id', Number.MAX_SAFE_INTEGER + 1])(
    'rejects malformed, overflow or imprecise media identifiers: %s',
    (id) => {
      const input = snapshot();
      const native = { ...input, mediaAssets: input.mediaAssets.map((asset) => ({ ...asset, id })) };
      expect(() => buildReport(native, options)).toThrow('Invalid report snapshot');
    },
  );

  it('finds cross-owner duplicates using the actual case-insensitive key without merging owners', () => {
    const other = competitor({
      id: '00000000-0000-4000-8000-000000000002',
      company_code: 'C001',
      slug: 'other',
      name: 'Other',
      is_baseline: false,
      priority_tier: 'next_wave',
      logo_path: null,
    });
    const result = buildReport(
      snapshot({
        competitors: [competitor(), other],
        accounts: [
          account(),
          account({
            id: '00000000-0000-4000-8000-000000000012',
            competitor_id: other.id,
            handle: 'EveryoneFilms',
            handle_norm: 'everyonefilms',
          }),
        ],
      }),
      options,
    );
    expect(result.counts.duplicateKeys).toBe(1);
    expect(
      result.reviewItems
        .filter((row) => row.reason.startsWith('duplicate_handle'))
        .map((row) => row.company_code),
    ).toEqual(['C000', 'C001']);
  });

  it('lists invalid/unreachable/source issues and does not expose URL credentials or raw error bodies', () => {
    const result = buildReport(
      snapshot({
        accounts: [
          account({
            platform: 'website',
            url: 'https://user:secret@example.com/?token=private',
            resolve_status: 'not_needed',
            status: 'active',
            last_error: 'unreachable_503',
          }),
          account({
            id: '00000000-0000-4000-8000-000000000012',
            status: 'invalid',
            resolve_status: 'failed',
            last_error: 'raw credential-bearing stack trace',
          }),
        ],
      }),
      {
        ...options,
        issues: [
          {
            company_code: 'C001',
            platform: 'instagram',
            url: 'https://www.instagram.com/invalid/',
            code: 'invalid_url',
            detail: 'Check source CSV',
          },
        ],
      },
    );
    expect(result.reviewItems.map((row) => row.reason)).toContain('unreachable_503');
    expect(result.reviewItems.map((row) => row.reason)).toContain('invalid_account');
    expect(result.unresolvedCsv).toContain('invalid_url');
    expect(result.unresolvedCsv).not.toContain('secret');
    expect(result.unresolvedCsv).not.toContain('token=private');
    expect(result.unresolvedCsv).not.toContain('stack trace');
  });

  it('escapes CSV formulas, quotes and multiline values, and Markdown/HTML table input', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell(' \t@SUM(1)')).toBe('"\' \t@SUM(1)"');
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(markdownCell('<script>|[link](url)\nnext')).toBe('&lt;script&gt;\\|\\[link\\]\\(url\\) next');
    const report = buildReport(snapshot(), {
      ...options,
      issues: [{ company_code: 'C001', code: 'issue', detail: '<img onerror=bad>|next', url: '' }],
    });
    expect(report.summaryMarkdown).not.toContain('<img');
  });

  it('rejects a credential-bearing target and malformed snapshot without reflecting its contents', () => {
    const target = new URL('postgresql://fixture@db.example.invalid/test');
    target.password = 'test-only-fixture';
    expect(() => buildReport(snapshot(), { ...options, target: target.href })).toThrow(
      'Invalid report options',
    );
    expect(() =>
      buildReport({ ...snapshot(), accounts: [{ id: 'bad' }] } as unknown as ReportSnapshot, options),
    ).toThrow('Invalid report snapshot');
  });

  it('rejects non-enum grouping keys before they can alter object prototypes', () => {
    const input = snapshot({ accounts: [account({ platform: '__proto__' as ReportAccount['platform'] })] });
    expect(() => buildReport(input, options)).toThrow('Invalid report snapshot');
    expect(Object.prototype).not.toHaveProperty('active');
  });

  it('preserves input order and values and deterministically sorts review rows', () => {
    const input = snapshot({ accounts: [account({ resolve_status: 'pending', external_id: null })] });
    const before = JSON.stringify(input);
    expect(buildReport(input, options)).toEqual(buildReport(input, options));
    expect(JSON.stringify(input)).toBe(before);
  });
});
