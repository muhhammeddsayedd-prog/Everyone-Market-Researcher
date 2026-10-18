import { z } from 'zod';
import type { Database } from '@emr/shared';
import type { SeedIssue } from './model';

type Tables = Database['app']['Tables'];
export type ReportCompetitor = Pick<
  Tables['competitors']['Row'],
  | 'id'
  | 'company_code'
  | 'slug'
  | 'name'
  | 'priority_tier'
  | 'is_baseline'
  | 'pilot_rank'
  | 'logo_url'
  | 'logo_path'
>;
export type ReportAccount = Pick<
  Tables['competitor_accounts']['Row'],
  | 'id'
  | 'competitor_id'
  | 'platform'
  | 'handle'
  | 'handle_norm'
  | 'url'
  | 'status'
  | 'resolve_status'
  | 'external_id'
  | 'uploads_playlist_id'
  | 'backfill_status'
  | 'backfill_from'
  | 'cadence'
  | 'last_error'
>;
export type ReportMediaAsset = Pick<
  Tables['media_assets']['Row'],
  'id' | 'competitor_id' | 'kind' | 'storage_path' | 'source_url'
>;
export interface ReportSnapshot {
  competitors: readonly ReportCompetitor[];
  accounts: readonly ReportAccount[];
  mediaAssets: readonly ReportMediaAsset[];
}
export interface ReportOptions {
  environment: 'local' | 'dev' | 'prod';
  /** Non-secret fixture identity or Supabase project ref; never a connection URL. */
  target: string;
  issues?: readonly SeedIssue[];
  observedAt?: string;
}
export interface ReviewItem {
  company_code: string;
  platform: string;
  url: string;
  reason: string;
  owner_decision: '';
}
export interface ResolutionCounts {
  total: number;
  resolved: number;
  pending: number;
  failed: number;
  missingIdentifiers: number;
  pilot: { total: number; resolved: number };
}
export interface ReportCounts {
  competitors: number;
  accounts: number;
  tiers: Record<string, number>;
  platforms: Record<string, number>;
  platformStatuses: Record<string, Record<string, number>>;
  resolveStatuses: Record<string, number>;
  backfillStatuses: Record<string, number>;
  providerErrors: Record<string, number>;
  resolution: { vimeo: ResolutionCounts; youtube: ResolutionCounts };
  logos: {
    sourceTotal: number;
    sourceCopied: number;
    missingSourceCopy: number;
    baselineTotal: number;
    baselineCopied: number;
    noSource: number;
    mediaMetadataMissing: number;
  };
  duplicateKeys: number;
  sourceIssues: number;
  reviewItems: number;
}

const text = z.string().max(8192);
const id = z.string().uuid();
const nullableText = text.nullable();
const snapshotSchema = z.object({
  competitors: z.array(
    z.object({
      id,
      company_code: text,
      slug: text,
      name: text,
      priority_tier: z.enum(['pilot', 'next_wave', 'adjacent', 'baseline']),
      is_baseline: z.boolean(),
      pilot_rank: z.number().int().min(1).max(50).nullable(),
      logo_url: nullableText,
      logo_path: nullableText,
    }),
  ),
  accounts: z.array(
    z.object({
      id,
      competitor_id: id,
      platform: z.enum([
        'vimeo',
        'instagram',
        'instagram_stories',
        'website',
        'website_work_page',
        'linkedin',
        'linkedin_employees',
        'youtube',
        'news',
      ]),
      handle: text,
      handle_norm: nullableText,
      url: text,
      status: z.enum(['active', 'paused', 'failing', 'invalid', 'disabled']),
      resolve_status: z.enum(['pending', 'resolved', 'failed', 'not_needed']),
      external_id: nullableText,
      uploads_playlist_id: nullableText,
      backfill_status: z.enum(['pending', 'running', 'done', 'failed', 'not_applicable']),
      backfill_from: text,
      cadence: text,
      last_error: nullableText,
    }),
  ),
  mediaAssets: z.array(
    z.object({
      id: z.number().int().nonnegative(),
      competitor_id: id.nullable(),
      kind: text,
      storage_path: text,
      source_url: nullableText,
    }),
  ),
});
const optionsSchema = z.object({
  environment: z.enum(['local', 'dev', 'prod']),
  target: z.string().regex(/^[a-zA-Z0-9_.:-]{1,100}$/),
  observedAt: z.iso.datetime({ offset: true }).optional(),
  issues: z
    .array(
      z.object({
        code: text,
        company_code: text,
        platform: text.optional(),
        url: text.optional(),
        detail: text,
      }),
    )
    .optional(),
});

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}
function sortedEntries<T>(record: Record<string, T>): Array<[string, T]> {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
/** Spreadsheet formula neutralization is separate from normal CSV quoting. */
export function csvCell(input: string): string {
  const value = /^[\s\u0000-\u001f]*[=+\-@]/u.test(input) ? `'${input}` : input;
  return `"${value.replaceAll('"', '""')}"`;
}
/** Cells are plain text: never permit HTML, links or new table rows from source data. */
export function markdownCell(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/[\r\n\t\u0000-\u001f]+/g, ' ')
    .replace(/([\\|`\[\]()])/g, '\\$1');
}
function safeUrl(input: string | null | undefined): string {
  if (!input) return '';
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return '[redacted or invalid URL]';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '[invalid URL; see source CSV]';
  }
}
function publicDetail(input: string): string {
  return input
    .replace(/https?:\/\/[^\s<>]+/gi, (url) => safeUrl(url))
    .replace(
      /(?:password|token|secret|authorization|api[_-]?key)\s*[:=]\s*\S+/gi,
      '[redacted credential field]',
    );
}
function errorCode(input: string): string {
  return /^(?:vimeo|yt|unreachable|logo)_[a-z0-9_]{1,80}$/.test(input) ? input : 'account_error_redacted';
}
function emptyResolution(): ResolutionCounts {
  return {
    total: 0,
    resolved: 0,
    pending: 0,
    failed: 0,
    missingIdentifiers: 0,
    pilot: { total: 0, resolved: 0 },
  };
}
function identifierValid(account: ReportAccount): boolean {
  if (account.platform === 'youtube')
    return (
      /^UC[A-Za-z0-9_-]{22}$/.test(account.external_id ?? '') &&
      /^UU[A-Za-z0-9_-]{22}$/.test(account.uploads_playlist_id ?? '')
    );
  if (/^(?:channels|groups|showcase)\//.test(account.handle))
    return /^[A-Za-z0-9_-]+$/.test(account.external_id ?? '') && account.external_id !== '0';
  return /^[1-9]\d*$/.test(account.external_id ?? '');
}

/** Snapshot rendering only: this function never fetches, writes or infers owner approval. */
export function buildReport(snapshot: ReportSnapshot, options: ReportOptions) {
  const parsedSnapshot = snapshotSchema.safeParse(snapshot);
  if (!parsedSnapshot.success) throw new Error('Invalid report snapshot');
  const parsedOptions = optionsSchema.safeParse(options);
  if (!parsedOptions.success) throw new Error('Invalid report options');
  const input = parsedSnapshot.data;
  const context = parsedOptions.data;
  const observedAt = context.observedAt ?? new Date().toISOString();
  const competitors = new Map(input.competitors.map((row) => [row.id, row]));
  const counts: ReportCounts = {
    competitors: input.competitors.length,
    accounts: input.accounts.length,
    tiers: {},
    platforms: {},
    platformStatuses: {},
    resolveStatuses: {},
    backfillStatuses: {},
    providerErrors: {},
    resolution: { vimeo: emptyResolution(), youtube: emptyResolution() },
    logos: {
      sourceTotal: 0,
      sourceCopied: 0,
      missingSourceCopy: 0,
      baselineTotal: 0,
      baselineCopied: 0,
      noSource: 0,
      mediaMetadataMissing: 0,
    },
    duplicateKeys: 0,
    sourceIssues: context.issues?.length ?? 0,
    reviewItems: 0,
  };
  const review = new Map<string, ReviewItem>();
  const add = (company_code: string, platform: string, url: string | null | undefined, reason: string) => {
    const row: ReviewItem = {
      company_code,
      platform,
      url: safeUrl(url),
      reason: publicDetail(reason),
      owner_decision: '',
    };
    review.set(JSON.stringify(row), row);
  };
  for (const company of input.competitors) {
    increment(counts.tiers, company.priority_tier);
    if (company.logo_url) {
      counts.logos.sourceTotal += 1;
      if (company.logo_path) counts.logos.sourceCopied += 1;
      else {
        counts.logos.missingSourceCopy += 1;
        add(company.company_code, 'logo', company.logo_url, 'missing_logo');
      }
    } else if (!company.is_baseline) {
      counts.logos.noSource += 1;
      add(company.company_code, 'logo', '', 'no_logo_source');
    }
    if (company.is_baseline) {
      counts.logos.baselineTotal += 1;
      if (company.logo_path) counts.logos.baselineCopied += 1;
      else add(company.company_code, 'logo', '', 'missing_baseline_logo');
    }
    if (
      company.logo_path &&
      !input.mediaAssets.some(
        (asset) =>
          asset.kind === 'logo' &&
          asset.competitor_id === company.id &&
          asset.storage_path === company.logo_path,
      )
    ) {
      counts.logos.mediaMetadataMissing += 1;
      add(company.company_code, 'logo', company.logo_url, 'missing_logo_media_asset');
    }
  }
  const handleOwners = new Map<string, typeof input.accounts>();
  for (const account of input.accounts) {
    const company = competitors.get(account.competitor_id);
    const code = company?.company_code ?? '[missing competitor]';
    increment(counts.platforms, account.platform);
    const statuses = (counts.platformStatuses[account.platform] ??= {});
    increment(statuses, account.status);
    increment(counts.resolveStatuses, account.resolve_status);
    increment(counts.backfillStatuses, account.backfill_status);
    const key = `${account.platform}:${(account.handle_norm ?? account.handle).toLowerCase()}`;
    const owners = handleOwners.get(key) ?? [];
    owners.push(account);
    handleOwners.set(key, owners);
    if (!company) add(code, account.platform, account.url, 'missing_competitor');
    if (account.status === 'invalid') add(code, account.platform, account.url, 'invalid_account');
    if (account.last_error) {
      const error = errorCode(account.last_error);
      if (error.startsWith('vimeo_') || error.startsWith('yt_')) increment(counts.providerErrors, error);
      add(code, account.platform, account.url, error);
    }
    if (account.platform === 'vimeo' || account.platform === 'youtube') {
      const resolution = counts.resolution[account.platform];
      const valid = account.resolve_status === 'resolved' && identifierValid(account as ReportAccount);
      resolution.total += 1;
      if (valid) resolution.resolved += 1;
      if (account.resolve_status === 'pending') resolution.pending += 1;
      if (account.resolve_status === 'failed') resolution.failed += 1;
      if (company && ['pilot', 'baseline'].includes(company.priority_tier)) {
        resolution.pilot.total += 1;
        if (valid) resolution.pilot.resolved += 1;
      }
      if (account.resolve_status === 'resolved' && !valid) {
        resolution.missingIdentifiers += 1;
        add(code, account.platform, account.url, 'resolved_missing_identifier');
      } else if (!valid)
        add(code, account.platform, account.url, `${account.platform}_resolve_${account.resolve_status}`);
    }
  }
  for (const accounts of handleOwners.values()) {
    if (new Set(accounts.map((row) => row.competitor_id)).size < 2) continue;
    counts.duplicateKeys += 1;
    const codes = [
      ...new Set(
        accounts.map((row) => competitors.get(row.competitor_id)?.company_code ?? '[missing competitor]'),
      ),
    ]
      .sort()
      .join(', ');
    for (const account of accounts)
      add(
        competitors.get(account.competitor_id)?.company_code ?? '[missing competitor]',
        account.platform,
        account.url,
        `duplicate_handle: ${codes}`,
      );
  }
  for (const issue of context.issues ?? [])
    add(
      issue.company_code,
      issue.platform ?? 'competitor',
      issue.url,
      `${issue.code}${issue.detail ? `: ${issue.detail}` : ''}`,
    );
  const reviewItems = [...review.values()].sort((a, b) => {
    const left = `${a.company_code}\0${a.platform}\0${a.reason}\0${a.url}`;
    const right = `${b.company_code}\0${b.platform}\0${b.reason}\0${b.url}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  counts.reviewItems = reviewItems.length;
  const csvColumns = ['company_code', 'platform', 'url', 'reason', 'owner_decision'] as const;
  const unresolvedCsv =
    [
      csvColumns.map(csvCell).join(','),
      ...reviewItems.map((row) => csvColumns.map((column) => csvCell(row[column])).join(',')),
    ].join('\r\n') + '\r\n';
  const md = (cells: (string | number)[]) =>
    `| ${cells.map((cell) => markdownCell(String(cell))).join(' | ')} |`;
  const summaryMarkdown = [
    '# M02 seed/account snapshot',
    '',
    `Environment: **${context.environment}**. Target: \`${context.target}\`. Observed: ${observedAt}.`,
    '',
    context.environment === 'local'
      ? 'Local/fixture evidence only; this is not hosted acceptance.'
      : 'This report describes the supplied hosted snapshot only; local and CI checks are separate.',
    '',
    `Competitors: ${counts.competitors}. Accounts: ${counts.accounts}. Review rows: ${counts.reviewItems}.`,
    '',
    '## Competitor tiers',
    '',
    md(['Tier', 'Count']),
    '| --- | ---: |',
    ...sortedEntries(counts.tiers).map(([tier, value]) => md([tier, value])),
    '',
    '## Platforms and statuses',
    '',
    md(['Platform', 'Status', 'Count']),
    '| --- | --- | ---: |',
    ...sortedEntries(counts.platformStatuses).flatMap(([platform, statuses]) =>
      sortedEntries(statuses).map(([status, value]) => md([platform, status, value])),
    ),
    '',
    '## Resolution',
    '',
    md([
      'Platform',
      'Valid IDs / total',
      'Pilot + baseline valid / total',
      'Pending',
      'Failed',
      'Missing identifiers',
    ]),
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(counts.resolution).map(([platform, value]) =>
      md([
        platform,
        `${value.resolved}/${value.total}`,
        `${value.pilot.resolved}/${value.pilot.total}`,
        value.pending,
        value.failed,
        value.missingIdentifiers,
      ]),
    ),
    '',
    md(['Resolve status', 'Count']),
    '| --- | ---: |',
    ...sortedEntries(counts.resolveStatuses).map(([status, value]) => md([status, value])),
    '',
    '## Backfill flags',
    '',
    md(['Backfill status', 'Count']),
    '| --- | ---: |',
    ...sortedEntries(counts.backfillStatuses).map(([status, value]) => md([status, value])),
    '',
    '## Logos',
    '',
    `Source-logo paths: ${counts.logos.sourceCopied}/${counts.logos.sourceTotal}. Missing source copies: ${counts.logos.missingSourceCopy}. Baseline paths: ${counts.logos.baselineCopied}/${counts.logos.baselineTotal}. No source: ${counts.logos.noSource}. Missing matching media metadata: ${counts.logos.mediaMetadataMissing}.`,
    '',
    'Public logo HTTP visibility requires a separate live check. Paths and media metadata do not prove visibility.',
    '',
    '## Provider errors',
    '',
    md(['Error category', 'Count']),
    '| --- | ---: |',
    ...sortedEntries(counts.providerErrors).map(([error, value]) => md([error, value])),
    '',
    '## Owner review',
    '',
    'Owner review is pending. Blank decisions never mean approval. Production/dev parity and idempotency require separate observed receipts.',
    '',
    md(['Company', 'Platform', 'URL', 'Reason', 'Owner decision']),
    '| --- | --- | --- | --- | --- |',
    ...reviewItems.map((row) =>
      md([row.company_code, row.platform, row.url, row.reason, row.owner_decision]),
    ),
    '',
  ].join('\n');
  return { summaryMarkdown, unresolvedCsv, counts, reviewItems };
}
