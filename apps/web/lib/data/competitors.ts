import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePublicEnv } from '@/lib/env';
import {
  combineClauses,
  decodeCursor,
  encodeCursor,
  keysetClause,
  searchClause,
  SORT_SPECS,
} from '@/lib/directory/keyset';
import { PAGE_SIZE, type DirectoryParams } from '@/lib/directory/params';
import { logoSrc } from '@/lib/view/logo';
import { familyHealth, type FamilyHealth } from '@/lib/view/sources';
import { DataReadError } from './errors';
import { excludeFixtures } from './fixtures';

const MARKET = z.enum(['EG', 'KSA', 'UAE', 'OTHER']);
const TIER = z.enum(['baseline', 'pilot', 'next_wave', 'adjacent']);
const PLATFORM = z.enum([
  'vimeo',
  'instagram',
  'instagram_stories',
  'website',
  'website_work_page',
  'linkedin',
  'linkedin_employees',
  'youtube',
  'news',
]);
const ACCOUNT_STATUS = z.enum(['active', 'paused', 'failing', 'invalid', 'disabled']);

/** Columns the directory needs; nothing else leaves the server. */
const LIST_SELECT =
  'id,company_code,slug,name,name_ar,markets,categories,priority_tier,pilot_rank,is_baseline,status,logo_path,updated_at,competitor_accounts(platform,status,items_count,last_item_published_at)';

const listRowSchema = z.object({
  id: z.guid(),
  company_code: z.string(),
  slug: z.string(),
  name: z.string(),
  name_ar: z.string().nullable(),
  markets: z.array(MARKET),
  categories: z.array(z.string()),
  priority_tier: TIER,
  pilot_rank: z.number().int().nullable(),
  is_baseline: z.boolean(),
  status: z.string(),
  logo_path: z.string().nullable(),
  updated_at: z.string(),
  competitor_accounts: z.array(
    z.object({
      platform: PLATFORM,
      status: ACCOUNT_STATUS,
      items_count: z.number().int(),
      last_item_published_at: z.string().nullable(),
    }),
  ),
});

type ListRow = z.infer<typeof listRowSchema>;

export type CompanyListItem = {
  id: string;
  companyCode: string;
  slug: string;
  name: string;
  nameAr: string | null;
  markets: z.infer<typeof MARKET>[];
  categories: string[];
  tier: z.infer<typeof TIER>;
  pilotRank: number | null;
  isBaseline: boolean;
  status: string;
  logoSrc: string | null;
  sourceCount: number;
  health: FamilyHealth[];
  itemsRecorded: number;
  lastItemAt: string | null;
};

export type DirectoryPage = {
  items: CompanyListItem[];
  baseline: CompanyListItem | null;
  total: number;
  page: number;
  nextCursor: string | null;
  prevCursor: string | null;
};

function toListItem(row: ListRow, supabaseUrl: string): CompanyListItem {
  let itemsRecorded = 0;
  let lastItemAt: string | null = null;
  for (const account of row.competitor_accounts) {
    itemsRecorded += account.items_count;
    if (account.last_item_published_at && (!lastItemAt || account.last_item_published_at > lastItemAt))
      lastItemAt = account.last_item_published_at;
  }
  return {
    id: row.id,
    companyCode: row.company_code,
    slug: row.slug,
    name: row.name,
    nameAr: row.name_ar,
    markets: row.markets,
    categories: row.categories,
    tier: row.priority_tier,
    pilotRank: row.pilot_rank,
    isBaseline: row.is_baseline,
    status: row.status,
    logoSrc: logoSrc(supabaseUrl, row.logo_path),
    sourceCount: row.competitor_accounts.length,
    health: familyHealth(row.competitor_accounts),
    itemsRecorded,
    lastItemAt,
  };
}

function parseRows(data: unknown, area: string): ListRow[] {
  const parsed = z.array(listRowSchema).safeParse(data);
  if (!parsed.success) throw new DataReadError(area, { code: 'shape_mismatch' });
  return parsed.data;
}

type FilterableQuery<Q> = {
  not(column: string, operator: string, value: string): Q;
  contains(column: string, value: string[]): Q;
  eq(column: string, value: string): Q;
};

function applyFilters<Q extends FilterableQuery<Q>>(query: Q, params: DirectoryParams): Q {
  let next = excludeFixtures(query);
  if (params.market) next = next.contains('markets', [params.market]);
  if (params.tier) next = next.eq('priority_tier', params.tier);
  if (params.category) next = next.contains('categories', [params.category]);
  if (params.capability) next = next.contains('in_house', [params.capability]);
  if (params.status) next = next.eq('status', params.status);
  return next;
}

/**
 * One page of the directory under the signed-in user's RLS. The baseline company is
 * read separately and pinned on the first page when it matches the filters.
 */
export async function listCompetitors(params: DirectoryParams): Promise<DirectoryPage> {
  const supabase = await createClient();
  const { supabaseUrl } = requirePublicEnv();
  const spec = SORT_SPECS[params.sort];
  const cursor = decodeCursor(params.cursor, params.sort);
  const search = params.q ? searchClause(params.q) : null;
  const keyset = cursor ? keysetClause(spec, cursor) : null;
  const orderAscending = keyset ? keyset.orderAscending : spec.ascending;

  let rowsQuery = applyFilters(supabase.from('competitors').select(LIST_SELECT), params).eq(
    'is_baseline',
    false,
  );
  const rowsFilter = combineClauses([search, keyset?.filter].filter((c): c is string => Boolean(c)));
  if (rowsFilter) rowsQuery = rowsQuery.or(rowsFilter);
  const rowsRequest = rowsQuery
    .order(spec.column, { ascending: orderAscending })
    .order('id', { ascending: orderAscending })
    .limit(PAGE_SIZE + 1);

  let countQuery = applyFilters(
    supabase.from('competitors').select('id', { count: 'exact', head: true }),
    params,
  );
  if (search) countQuery = countQuery.or(search);

  const firstPage = !cursor;
  let baselineQuery = applyFilters(supabase.from('competitors').select(LIST_SELECT), params).eq(
    'is_baseline',
    true,
  );
  if (search) baselineQuery = baselineQuery.or(search);

  const [rowsResult, countResult, baselineResult] = await Promise.all([
    rowsRequest,
    countQuery,
    firstPage ? baselineQuery.limit(1) : Promise.resolve(null),
  ]);
  if (rowsResult.error) throw new DataReadError('competitors.list', rowsResult.error);
  if (countResult.error) throw new DataReadError('competitors.count', countResult.error);
  if (baselineResult?.error) throw new DataReadError('competitors.baseline', baselineResult.error);

  const rows = parseRows(rowsResult.data, 'competitors.list');
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);
  if (cursor?.direction === 'prev') pageRows.reverse();

  const movingBack = cursor?.direction === 'prev';
  const hasNext = movingBack ? true : hasMore;
  const hasPrev = movingBack ? hasMore : Boolean(cursor);
  const boundary = (row: ListRow | undefined, direction: 'next' | 'prev') =>
    row ? encodeCursor({ sort: params.sort, key: String(row[spec.column]), id: row.id, direction }) : null;

  const baselineRows = baselineResult ? parseRows(baselineResult.data, 'competitors.baseline') : [];

  return {
    items: pageRows.map((row) => toListItem(row, supabaseUrl)),
    baseline: baselineRows[0] ? toListItem(baselineRows[0], supabaseUrl) : null,
    total: countResult.count ?? 0,
    page: cursor ? params.page : 1,
    nextCursor: hasNext ? boundary(pageRows.at(-1), 'next') : null,
    prevCursor: hasPrev ? boundary(pageRows[0], 'prev') : null,
  };
}

/* ───────────── Profile ───────────── */

const PROFILE_SELECT =
  'id,company_code,slug,name,name_ar,markets,hq_country,categories,in_house,priority_tier,pilot_rank,is_baseline,status,notes,logo_path,website_url,updated_at,competitor_accounts(id,platform,handle,url,resolve_status,status,cadence,next_due_at,last_success_at,last_error_at,last_error,consecutive_failures,backfill_status,items_count,last_item_published_at)';

const accountSchema = z.object({
  id: z.guid(),
  platform: PLATFORM,
  handle: z.string(),
  url: z.string(),
  resolve_status: z.string(),
  status: ACCOUNT_STATUS,
  cadence: z.string(),
  next_due_at: z.string(),
  last_success_at: z.string().nullable(),
  last_error_at: z.string().nullable(),
  last_error: z.string().nullable(),
  consecutive_failures: z.number().int(),
  backfill_status: z.enum(['pending', 'running', 'done', 'failed', 'not_applicable']),
  items_count: z.number().int(),
  last_item_published_at: z.string().nullable(),
});

const profileSchema = z.object({
  id: z.guid(),
  company_code: z.string(),
  slug: z.string(),
  name: z.string(),
  name_ar: z.string().nullable(),
  markets: z.array(MARKET),
  hq_country: MARKET.nullable(),
  categories: z.array(z.string()),
  in_house: z.array(z.string()),
  priority_tier: TIER,
  pilot_rank: z.number().int().nullable(),
  is_baseline: z.boolean(),
  status: z.string(),
  notes: z.string().nullable(),
  logo_path: z.string().nullable(),
  website_url: z.string().nullable(),
  updated_at: z.string(),
  competitor_accounts: z.array(accountSchema),
});

export type SourceAccount = z.infer<typeof accountSchema>;

export type CompanyProfile = Omit<z.infer<typeof profileSchema>, 'competitor_accounts' | 'logo_path'> & {
  logoSrc: string | null;
  hasStoredLogo: boolean;
  accounts: SourceAccount[];
};

const PLATFORM_ORDER = PLATFORM.options;

/** A single company with its recorded sources, or null when absent, hidden by RLS or a fixture. */
export const getCompanyProfile = cache(async (slug: string): Promise<CompanyProfile | null> => {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) return null;
  const supabase = await createClient();
  const { supabaseUrl } = requirePublicEnv();
  const { data, error } = await excludeFixtures(
    supabase.from('competitors').select(PROFILE_SELECT).eq('slug', slug),
  ).maybeSingle();
  if (error) throw new DataReadError('competitors.profile', error);
  if (!data) return null;
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) throw new DataReadError('competitors.profile', { code: 'shape_mismatch' });
  const { competitor_accounts, logo_path, ...company } = parsed.data;
  const src = logoSrc(supabaseUrl, logo_path);
  return {
    ...company,
    logoSrc: src,
    hasStoredLogo: src !== null,
    accounts: competitor_accounts.toSorted(
      (a, b) =>
        PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform) ||
        a.handle.localeCompare(b.handle),
    ),
  };
});
