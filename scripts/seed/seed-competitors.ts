import { parse } from 'csv-parse/sync';
import type { Sql, TransactionSql } from 'postgres';
import {
  normalizeInstagram,
  normalizeVimeo,
  normalizeYouTube,
  normalizeLinkedIn,
  normalizeWebsite,
} from '@emr/shared';
import {
  accountCsvSchema,
  competitorCsvSchema,
  overrideCsvSchema,
  taxonomySchema,
  seedManifestSchema,
  emptySeedManifest,
  type AccountSeed,
  type CompetitorSeed,
  type PrimaryPlatform,
  type SeedInput,
  type SeedIssue,
  type SeedManifest,
  type SeedPlan,
  type SeedStats,
} from './model';
import type { z } from 'zod';

function readCsv<T>(text: string, schema: z.ZodType<T>, label: string): T[] {
  try {
    const rows: unknown[] = parse(text, { columns: true, bom: true, skip_empty_lines: true, trim: true });
    return rows.map((row) => schema.parse(row));
  } catch {
    throw new Error(`Invalid ${label} CSV; check its headers, columns and field values`);
  }
}

/** Parse caller-supplied public source data. This module never reads credentials or runs itself. */
export function loadSeedInput(files: {
  competitorsCsv: string;
  accountsCsv: string;
  taxonomiesJson: string;
  overridesCsv?: string;
}): SeedInput {
  let taxonomies: SeedInput['taxonomies'];
  try {
    taxonomies = taxonomySchema.parse(JSON.parse(files.taxonomiesJson));
  } catch {
    throw new Error('Invalid seed taxonomy JSON');
  }
  const input = {
    competitors: readCsv(files.competitorsCsv, competitorCsvSchema, 'competitors'),
    accounts: readCsv(files.accountsCsv, accountCsvSchema, 'accounts'),
    overrides: files.overridesCsv?.trim() ? readCsv(files.overridesCsv, overrideCsvSchema, 'overrides') : [],
    taxonomies,
  };
  // Invalid public links stay reviewable, but credential-bearing source URLs never enter a plan/report.
  for (const value of [
    ...input.accounts.map((row) => row.url),
    ...input.overrides.map((row) => row.url),
    ...input.competitors.flatMap((row) => [row.logo_url, row.website]),
  ]) {
    const authority = value.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split(/[/?#]/, 1)[0] ?? '';
    if (authority.includes('@') && !/^@[\p{L}\p{M}\p{N}_.-]+$/u.test(authority))
      throw new Error('Source data contains a credential-bearing URL; remove it privately');
    const query = value.split('?', 2)[1]?.split('#', 1)[0] ?? '';
    for (const pair of query.split('&')) {
      let key = pair.split('=', 1)[0] ?? '';
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const decoded = decodeURIComponent(key.replaceAll('+', ' '));
          if (decoded === key) break;
          key = decoded;
        } catch {
          throw new Error('Source data contains an invalid private URL query; remove it privately');
        }
      }
      if (
        /^(?:key|apikey|accesstoken|token|password|secret|clientsecret|authorization)$/.test(
          key.toLowerCase().replace(/[^a-z0-9]/g, ''),
        )
      )
        throw new Error('Source data contains a credential-bearing URL; remove it privately');
    }
    if (/^[a-z][a-z\d+.-]*:\/\/[^/\s]*@/i.test(value))
      throw new Error('Source data contains a credential-bearing URL; remove it privately');
    try {
      const url = new URL(value);
      if (
        [...url.searchParams.keys()].some((key) =>
          /^(?:key|api[_-]?key|access[_-]?token|token|password|secret|authorization)$/i.test(key),
        )
      ) {
        throw new Error('credential-query');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'credential-query')
        throw new Error('Source data contains a credential-bearing URL; remove it privately');
      // A malformed non-secret URL is handled as an explicit invalid row by the planner.
    }
  }
  return input;
}

const tierMap = {
  'A · Pilot': 'pilot',
  'B · Next wave': 'next_wave',
  'C · Adjacent': 'adjacent',
  Baseline: 'baseline',
} as const;
const countries = new Set(['EG', 'KSA', 'UAE']);
const split = (value: string) => [
  ...new Set(
    value
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean),
  ),
];
const blank = (value: string) => value || null;
function integer(value: string, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  if (!value) return null;
  if (!/^\d+$/.test(value) || Number(value) < minimum || Number(value) > maximum)
    throw new Error(`Invalid ${label}`);
  return Number(value);
}
function count(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

type SourceAccount = SeedInput['accounts'][number] & {
  sourceKey: string;
  invalid: boolean;
  ownerReplaced: boolean;
};
function normalize(
  platform: PrimaryPlatform,
  raw: string,
): { handle: string; url: string; invalid?: boolean } {
  switch (platform) {
    case 'instagram': {
      const handle = normalizeInstagram(raw);
      return { handle, url: `https://www.instagram.com/${handle}/` };
    }
    case 'vimeo': {
      const { handle } = normalizeVimeo(raw);
      return { handle, url: `https://vimeo.com/${handle}` };
    }
    case 'youtube': {
      const { kind, value } = normalizeYouTube(raw);
      const handle = kind === 'handle' ? `@${value}` : `${kind}/${value}`;
      return { handle, url: `https://www.youtube.com/${handle}` };
    }
    case 'linkedin': {
      const { kind, slug } = normalizeLinkedIn(raw);
      return { handle: slug, url: `https://www.linkedin.com/${kind}/${slug}/`, invalid: kind === 'school' };
    }
    case 'website': {
      const { domain, url } = normalizeWebsite(raw);
      return { handle: domain, url };
    }
    case 'website_work_page': {
      const { url } = normalizeWebsite(raw);
      return { handle: url, url };
    }
  }
}

/** Deterministic plan; invalid and colliding rows are explicit issues rather than silent count changes. */
export function planSeed(input: SeedInput): SeedPlan {
  const issues: SeedIssue[] = [];
  const categoryMap = new Map(input.taxonomies.competitor_category.map((t) => [t.label_en, t.code]));
  const capabilityMap = new Map(input.taxonomies.in_house_capability.map((t) => [t.label_en, t.code]));
  if (![...capabilityMap.values()].includes('other')) throw new Error('Missing other in-house taxonomy');
  const companyCodes = new Set<string>();
  const slugs = new Set<string>();
  const competitors: CompetitorSeed[] = input.competitors.map((row) => {
    if (companyCodes.has(row.company_id) || slugs.has(row.slug))
      throw new Error('Duplicate competitor code or slug');
    companyCodes.add(row.company_id);
    slugs.add(row.slug);
    const tier = tierMap[row.priority_tier as keyof typeof tierMap];
    if (!tier) throw new Error('Unknown priority tier');
    const markets = split(row.markets);
    if (
      markets.some((v) => !countries.has(v)) ||
      (row.hq_country_guess && !countries.has(row.hq_country_guess))
    )
      throw new Error('Unknown market/country');
    const categories = split(row.categories).map((label) => {
      const code = categoryMap.get(label);
      if (!code) throw new Error('Unknown competitor category');
      return code;
    });
    const unknown = split(row.in_house_capabilities).filter((label) => !capabilityMap.has(label));
    const inHouse = [
      ...new Set(split(row.in_house_capabilities).map((label) => capabilityMap.get(label) ?? 'other')),
    ];
    const pilotRank = integer(row.pilot_rank, 'pilot rank', 1, 50);
    if ((tier === 'pilot') !== (pilotRank !== null) || (row.is_baseline === 'true') !== (tier === 'baseline'))
      throw new Error('Tier/rank/baseline mismatch');
    return {
      company_code: row.company_id,
      slug: row.slug,
      name: row.name,
      markets: markets as ('EG' | 'KSA' | 'UAE')[],
      hq_country: blank(row.hq_country_guess) as 'EG' | 'KSA' | 'UAE' | null,
      categories,
      in_house: inHouse,
      logo_url: blank(row.logo_url),
      website_url: blank(row.website),
      priority_tier: tier,
      pilot_rank: pilotRank,
      is_baseline: row.is_baseline === 'true',
      status: 'active',
      notes: blank(
        [row.notes, ...(unknown.length ? [`In-house (other): ${unknown.join('; ')}`] : [])]
          .filter(Boolean)
          .join('\n'),
      ),
      source_sheet_row: integer(row.sheet_row, 'sheet row', 1),
    };
  });
  const competitorByCode = new Map(competitors.map((row) => [row.company_code, row]));
  const baselines = competitors.filter((c) => c.is_baseline);
  if (baselines.length !== 1 || baselines[0]?.company_code !== 'C000')
    throw new Error('Expected exactly one C000 baseline');
  const ranks = competitors.filter((c) => c.pilot_rank !== null).map((c) => c.pilot_rank);
  if (new Set(ranks).size !== ranks.length) throw new Error('Duplicate pilot rank');
  const ordinals = new Map<string, number>();
  const source: SourceAccount[] = [];
  for (const row of input.accounts) {
    const competitor = competitorByCode.get(row.company_id);
    if (!competitor || competitor.slug !== row.competitor_slug)
      throw new Error('Account references unknown competitor or mismatched slug');
    if (row.tracked === 'false') {
      issues.push({
        code: 'untracked_source',
        company_code: row.company_id,
        platform: row.platform,
        url: row.url,
        detail: 'Explicit tracked=false row excluded',
      });
      continue;
    }
    const key = `${row.company_id}:${row.platform}`;
    const ordinal = ordinals.get(key) ?? 0;
    ordinals.set(key, ordinal + 1);
    source.push({ ...row, sourceKey: `${key}:${ordinal}`, invalid: false, ownerReplaced: false });
  }
  const terminalOverrides = new Set<string>();
  for (const override of input.overrides) {
    const competitor = competitorByCode.get(override.company_id);
    if (!competitor) throw new Error('Override references unknown competitor');
    const key = `${override.company_id}:${override.platform}`;
    const candidates = source.filter(
      (a) => a.company_id === override.company_id && a.platform === override.platform,
    );
    if (override.action === 'add') {
      if (!override.url) throw new Error('Add override requires URL');
      const normalized = normalize(override.platform, override.url);
      const sourceKey = `override:${key}:${normalized.handle.toLowerCase()}`;
      if (source.some((a) => a.sourceKey === sourceKey)) throw new Error('Conflicting override');
      source.push({
        company_id: override.company_id,
        competitor_slug: competitor.slug,
        platform: override.platform,
        url: override.url,
        handle: normalized.handle,
        tracked: 'true',
        pilot: 'false',
        sourceKey,
        invalid: false,
        ownerReplaced: false,
      });
      continue;
    }
    if (terminalOverrides.has(key)) throw new Error('Conflicting override');
    terminalOverrides.add(key);
    const target =
      override.action === 'invalid' && override.url
        ? candidates.find((a) => a.url === override.url)
        : candidates.length === 1
          ? candidates[0]
          : undefined;
    if (!target) throw new Error('Override target is missing or ambiguous');
    if (override.action === 'replace') {
      if (!override.url) throw new Error('Replace override requires URL');
      target.url = override.url;
      target.handle = normalize(override.platform, override.url).handle;
      target.ownerReplaced = true;
    } else target.invalid = true;
  }
  const hasWorkPage = new Set(
    source.filter((a) => a.platform === 'website_work_page').map((a) => a.company_id),
  );
  const accounts: AccountSeed[] = [];
  const keys = new Map<string, string>();
  for (const row of source) {
    let normalized: { handle: string; url: string; invalid?: boolean };
    try {
      normalized = normalize(row.platform, row.url);
    } catch {
      normalized = { handle: row.handle.trim().toLowerCase(), url: row.url, invalid: true };
      issues.push({
        code: 'invalid_url',
        company_code: row.company_id,
        platform: row.platform,
        url: row.url,
        detail: 'Platform URL/handle failed normalization; retained invalid for owner review',
      });
    }
    const competitor = competitorByCode.get(row.company_id)!;
    const invalid = row.invalid || normalized.invalid === true;
    if (row.invalid || (row.platform === 'linkedin' && normalized.invalid))
      issues.push({
        code: row.invalid ? 'owner_invalid' : 'unsupported_linkedin_kind',
        company_code: row.company_id,
        platform: row.platform,
        url: row.url,
        detail: 'Account retained as invalid; no collection',
      });
    const active = competitor.priority_tier === 'pilot' || competitor.priority_tier === 'baseline';
    const account: AccountSeed = {
      sourceKey: row.sourceKey,
      company_code: row.company_id,
      platform: row.platform,
      handle: normalized.handle,
      url: normalized.url,
      cadence: '1 day',
      status: invalid
        ? 'invalid'
        : active && !(row.platform === 'website' && hasWorkPage.has(row.company_id))
          ? 'active'
          : 'paused',
      resolve_status: invalid
        ? 'failed'
        : ['vimeo', 'youtube'].includes(row.platform)
          ? 'pending'
          : 'not_needed',
      backfill_from: '2024-01-01',
      backfill_status: 'pending',
      ownerReplaced: row.ownerReplaced,
    };
    const proposed = [account];
    if (row.platform === 'instagram' || row.platform === 'linkedin')
      proposed.push({
        ...account,
        sourceKey: `${row.sourceKey}:derived`,
        platform: row.platform === 'instagram' ? 'instagram_stories' : 'linkedin_employees',
        cadence: row.platform === 'instagram' ? '1 day' : '7 days',
        backfill_status: 'not_applicable',
      });
    for (const candidate of proposed) {
      const key = `${candidate.platform}:${candidate.handle.toLowerCase()}`;
      const existing = keys.get(key);
      if (existing) {
        issues.push({
          code: 'duplicate_handle',
          company_code: candidate.company_code,
          platform: candidate.platform,
          url: candidate.url,
          detail: `Key already belongs to ${existing}; row excluded, never reassigned`,
        });
      } else {
        keys.set(key, candidate.company_code);
        accounts.push(candidate);
      }
    }
  }
  return {
    competitors,
    accounts,
    issues,
    counts: {
      inputCompetitors: input.competitors.length,
      inputAccounts: input.accounts.length,
      plannedCompetitors: competitors.length,
      plannedAccounts: accounts.length,
      tiers: count(competitors.map((c) => c.priority_tier)),
      platforms: count(accounts.map((a) => a.platform)),
      statuses: count(accounts.map((a) => a.status)),
    },
  };
}

type SeedValue = string | number | boolean | null | string[];
type SeedValues = Record<string, SeedValue>;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** A changed seed may update its last value, while every divergent app edit becomes protected. */
export function mergeSeedFields(
  current: Record<string, unknown>,
  previous: SeedValues | undefined,
  desired: SeedValues,
  protectedFields: string[] = [],
) {
  const patch: SeedValues = {};
  const preserved: string[] = [];
  // Equal data proves no ownership. A lost/missing receipt cannot grant future overwrite rights.
  if (!previous) return { patch, preserved: Object.keys(desired) };
  for (const [field, value] of Object.entries(desired)) {
    if (protectedFields.includes(field)) {
      preserved.push(field);
      continue;
    }
    if (equal(current[field], value)) continue;
    if (previous && equal(current[field], previous[field])) patch[field] = value;
    else preserved.push(field);
  }
  return { patch, preserved };
}

/** Pure guard for an explicit owner correction; collected accounts need a reviewed migration path. */
export function canReplaceAccountIdentity(
  current: Record<string, unknown>,
  receipt: SeedManifest['accounts'][string],
  ownerReplaced: boolean,
): boolean {
  return (
    ownerReplaced &&
    !current.has_collection &&
    !current.locked_until &&
    !current.last_run_id &&
    !current.last_success_at &&
    !current.last_item_published_at &&
    !current.last_external_id &&
    !current.backfill_cursor &&
    !current.last_error_at &&
    Number(current.items_count) === 0 &&
    Number(current.consecutive_failures) === 0 &&
    ['pending', 'not_applicable'].includes(String(current.backfill_status)) &&
    current.handle === receipt.values.handle &&
    current.platform === receipt.values.platform &&
    current.url === receipt.values.url &&
    !receipt.protectedFields.some((f) => ['handle', 'platform', 'url'].includes(f))
  );
}

const competitorColumns = [
  'company_code',
  'slug',
  'name',
  'markets',
  'hq_country',
  'categories',
  'in_house',
  'logo_url',
  'website_url',
  'priority_tier',
  'pilot_rank',
  'is_baseline',
  'status',
  'notes',
  'source_sheet_row',
] as const;
const accountColumns = [
  'competitor_id',
  'platform',
  'handle',
  'url',
  'cadence',
  'status',
  'resolve_status',
  'backfill_from',
  'backfill_status',
] as const;

/** Owner-run fixed-schema transaction. Caller owns connection lifecycle and atomic manifest storage. */
export async function seedWithinTransaction(
  tx: TransactionSql,
  plan: SeedPlan,
  options: { target: string; manifest?: SeedManifest },
) {
  const previous = options.manifest
    ? seedManifestSchema.parse(options.manifest)
    : emptySeedManifest(options.target);
  if (previous.target !== options.target)
    throw new Error('Seed manifest target does not match selected database');
  const manifest = structuredClone(previous);
  const issues = [...plan.issues];
  const plannedCompanyCodes = new Set(plan.competitors.map((c) => c.company_code));
  const plannedSourceKeys = new Set(plan.accounts.map((a) => a.sourceKey));
  for (const code of Object.keys(previous.competitors)) {
    if (!plannedCompanyCodes.has(code))
      issues.push({
        code: 'source_removed_preserved',
        company_code: code,
        detail:
          'Previously seeded competitor is absent from this plan; database row preserved for owner review',
      });
  }
  for (const sourceKey of Object.keys(previous.accounts)) {
    if (!plannedSourceKeys.has(sourceKey))
      issues.push({
        code: 'source_removed_preserved',
        company_code: sourceKey.match(/(?:^|:)(C\d{3}):/)?.[1] ?? 'unknown',
        detail: `Previously seeded account source ${sourceKey} is absent from this plan; database row preserved for owner review`,
      });
  }
  const stats: SeedStats = {
    competitorsInserted: 0,
    competitorsUpdated: 0,
    accountsInserted: 0,
    accountsUpdated: 0,
  };
  {
    await tx`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr:m02-seed', 0))`;
    const existingCompetitors = await tx`select * from app.competitors for update`;
    const existingAccounts =
      await tx`select a.*, cadence = interval '1 day' as cadence_is_day, cadence = interval '7 days' as cadence_is_week,
      exists(select 1 from app.items i where i.account_id = a.id) or
      exists(select 1 from ingest.raw_items r where r.account_id = a.id) or
      exists(select 1 from app.website_pages w where w.account_id = a.id) or
      exists(select 1 from app.employee_snapshots e where e.account_id = a.id) or
      exists(select 1 from ops.scrape_run_accounts s where s.account_id = a.id) as has_collection
      from app.competitor_accounts a for update`;
    const byCode = new Map(existingCompetitors.map((c) => [String(c.company_code), c]));
    const accountById = new Map(existingAccounts.map((a) => [String(a.id), a]));
    const accountByKey = new Map(existingAccounts.map((a) => [`${a.platform}:${a.handle_norm}`, a]));
    for (const desired of plan.competitors) {
      const values = Object.fromEntries(
        competitorColumns.map((key) => [key, desired[key] ?? null]),
      ) as SeedValues;
      let current = byCode.get(desired.company_code);
      if (!current) {
        if (existingCompetitors.some((c) => c.slug === desired.slug)) {
          issues.push({
            code: 'duplicate_slug',
            company_code: desired.company_code,
            detail: 'Slug already belongs to a different company; preserved',
          });
          continue;
        }
        [current] =
          await tx`insert into app.competitors ${tx(values, ...competitorColumns)} on conflict (company_code) do nothing returning *`;
        if (!current)
          throw new Error('Concurrent competitor insert; transaction rolled back, inspect before retry');
        byCode.set(desired.company_code, current);
        stats.competitorsInserted++;
        manifest.competitors[desired.company_code] = { id: String(current.id), values, protectedFields: [] };
      } else {
        const receipt = previous.competitors[desired.company_code];
        if (receipt && receipt.id !== current.id) throw new Error('Competitor manifest identity mismatch');
        const { patch, preserved } = mergeSeedFields(
          current,
          receipt?.values,
          values,
          receipt?.protectedFields,
        );
        if (Object.keys(patch).length) {
          await tx`update app.competitors set ${tx(patch)} where id = ${current.id}`;
          stats.competitorsUpdated++;
        }
        if (preserved.length)
          issues.push({
            code: receipt ? 'human_fields_preserved' : 'unmanaged_competitor',
            company_code: desired.company_code,
            detail: `Preserved fields: ${preserved.join(', ')}`,
          });
        manifest.competitors[desired.company_code] = {
          id: String(current.id),
          values,
          protectedFields: preserved,
        };
      }
    }
    for (const desired of plan.accounts) {
      const competitor = byCode.get(desired.company_code);
      if (!competitor) {
        issues.push({
          code: 'missing_competitor',
          company_code: desired.company_code,
          platform: desired.platform,
          detail: 'Account not written because competitor is unavailable',
        });
        continue;
      }
      const values: SeedValues = {
        competitor_id: String(competitor.id),
        platform: desired.platform,
        handle: desired.handle,
        url: desired.url,
        cadence: desired.cadence,
        status: desired.status,
        resolve_status: desired.resolve_status,
        backfill_from: desired.backfill_from,
        backfill_status: desired.backfill_status,
      };
      const key = `${desired.platform}:${desired.handle.toLowerCase()}`;
      const receipt = previous.accounts[desired.sourceKey];
      const byKey = accountByKey.get(key);
      let current = receipt ? accountById.get(receipt.id) : byKey;
      if (receipt && !current) throw new Error('Account manifest identity missing; inspect before retry');
      if (
        (byKey && byKey.competitor_id !== competitor.id) ||
        (current && current.competitor_id !== competitor.id)
      ) {
        issues.push({
          code: 'duplicate_handle',
          company_code: desired.company_code,
          platform: desired.platform,
          url: desired.url,
          detail: 'Database key belongs to a different competitor; never reassigned',
        });
        continue;
      }
      const identityChanged =
        receipt &&
        current &&
        (current.handle !== desired.handle ||
          current.platform !== desired.platform ||
          (['linkedin', 'linkedin_employees'].includes(desired.platform) && current.url !== desired.url));
      let resetResolution = false;
      if (identityChanged && current && receipt) {
        const untouched = canReplaceAccountIdentity(current, receipt, desired.ownerReplaced);
        if (!desired.ownerReplaced || !untouched || (byKey && byKey.id !== current.id)) {
          issues.push({
            code: 'identity_change_requires_review',
            company_code: desired.company_code,
            platform: desired.platform,
            url: desired.url,
            detail:
              'Account identity change lacks explicit owner replacement or has collection/concurrency evidence; existing data preserved',
          });
          continue;
        }
        resetResolution = true;
      }
      if (!current) {
        [current] =
          await tx`insert into app.competitor_accounts ${tx(values, ...accountColumns)} on conflict (platform, handle_norm) do nothing returning *`;
        if (!current)
          throw new Error('Concurrent account insert; transaction rolled back, inspect before retry');
        accountByKey.set(key, current);
        accountById.set(String(current.id), current);
        stats.accountsInserted++;
        manifest.accounts[desired.sourceKey] = { id: String(current.id), values, protectedFields: [] };
      } else {
        const comparable = {
          ...current,
          cadence: current.cadence_is_day
            ? '1 day'
            : current.cadence_is_week
              ? '7 days'
              : String(current.cadence),
          backfill_from:
            current.backfill_from instanceof Date
              ? current.backfill_from.toISOString().slice(0, 10)
              : String(current.backfill_from),
        };
        const { patch, preserved } = mergeSeedFields(
          comparable,
          receipt?.values,
          values,
          receipt?.protectedFields,
        );
        // Resolution/collector progress is never part of a seed UPDATE, even when a CSV changes.
        for (const field of ['resolve_status', 'backfill_status', 'backfill_from']) delete patch[field];
        if (resetResolution) {
          patch.resolve_status = desired.resolve_status;
          patch.external_id = null;
          patch.uploads_playlist_id = null;
          patch.last_error = null;
          patch.last_error_at = null;
          patch.consecutive_failures = 0;
          // An explicit replacement supersedes an invalid decision for this old identity.
          // Human paused/disabled decisions still stay protected by normal field ownership.
          if (current.status === 'invalid') {
            patch.status = desired.status;
            const index = preserved.indexOf('status');
            if (index !== -1) preserved.splice(index, 1);
          }
        }
        if (Object.keys(patch).length) {
          await tx`update app.competitor_accounts set ${tx(patch)} where id = ${current.id}`;
          stats.accountsUpdated++;
          if (resetResolution) {
            accountByKey.delete(`${current.platform}:${current.handle_norm}`);
            current = { ...current, ...patch, handle_norm: desired.handle.toLowerCase() };
            accountByKey.set(key, current);
            accountById.set(String(current.id), current);
          }
        }
        if (preserved.length)
          issues.push({
            code: receipt ? 'human_fields_preserved' : 'unmanaged_account',
            company_code: desired.company_code,
            platform: desired.platform,
            url: desired.url,
            detail: `Preserved fields: ${preserved.join(', ')}`,
          });
        manifest.accounts[desired.sourceKey] = { id: String(current.id), values, protectedFields: preserved };
      }
    }
  }
  return { manifest, stats, issues };
}

export async function seedCompetitors(
  sql: Sql,
  plan: SeedPlan,
  options: { target: string; manifest?: SeedManifest },
) {
  return sql.begin((tx) => seedWithinTransaction(tx, plan, options));
}
