/**
 * URL state for the company directory. Every filter, sort, view and page position lives
 * in the query string so back/forward, reloads and shared links restore the same list.
 * Unknown or malformed values are dropped rather than passed to the database.
 */
export const MARKETS = ['EG', 'KSA', 'UAE', 'OTHER'] as const;
export const TIERS = ['baseline', 'pilot', 'next_wave', 'adjacent'] as const;
export const COMPANY_STATUSES = ['active', 'paused', 'archived'] as const;
export const SORTS = ['name', '-name', 'code', 'updated'] as const;
export const VIEWS = ['grid', 'list'] as const;

export type Market = (typeof MARKETS)[number];
export type Tier = (typeof TIERS)[number];
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];
export type Sort = (typeof SORTS)[number];
export type View = (typeof VIEWS)[number];

export type DirectoryParams = {
  q: string;
  market: Market | null;
  tier: Tier | null;
  category: string | null;
  capability: string | null;
  status: CompanyStatus | null;
  sort: Sort;
  view: View;
  cursor: string | null;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_SORT: Sort = 'name';
export const DEFAULT_VIEW: View = 'grid';
export const PAGE_SIZE = 24;
const MAX_QUERY_LENGTH = 80;
const TAXONOMY_CODE = /^[a-z0-9_]{1,64}$/;
const CURSOR = /^[A-Za-z0-9_-]{1,512}$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined): T | null {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Keeps letters, numbers and common name punctuation; removes PostgREST and LIKE metacharacters. */
export function normalizeSearch(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\p{M} &'.°+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

export function parseDirectoryParams(searchParams: RawSearchParams): DirectoryParams {
  const category = first(searchParams.category);
  const capability = first(searchParams.capability);
  const cursor = first(searchParams.cursor);
  const page = Number.parseInt(first(searchParams.page) ?? '1', 10);
  return {
    q: normalizeSearch(first(searchParams.q)),
    market: oneOf(MARKETS, first(searchParams.market)),
    tier: oneOf(TIERS, first(searchParams.tier)),
    category: category && TAXONOMY_CODE.test(category) ? category : null,
    capability: capability && TAXONOMY_CODE.test(capability) ? capability : null,
    status: oneOf(COMPANY_STATUSES, first(searchParams.status)),
    sort: oneOf(SORTS, first(searchParams.sort)) ?? DEFAULT_SORT,
    view: oneOf(VIEWS, first(searchParams.view)) ?? DEFAULT_VIEW,
    cursor: cursor && CURSOR.test(cursor) ? cursor : null,
    page: Number.isFinite(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/** Number of active filters (for the mobile "Filters (n)" button and the clear action). */
export function activeFilterCount(params: DirectoryParams): number {
  return [params.q, params.market, params.tier, params.category, params.capability, params.status].filter(
    Boolean,
  ).length;
}

/** Serializes params, omitting defaults, so URLs stay short and stable. */
export function toSearchParams(params: DirectoryParams): URLSearchParams {
  const out = new URLSearchParams();
  if (params.q) out.set('q', params.q);
  if (params.market) out.set('market', params.market);
  if (params.tier) out.set('tier', params.tier);
  if (params.category) out.set('category', params.category);
  if (params.capability) out.set('capability', params.capability);
  if (params.status) out.set('status', params.status);
  if (params.sort !== DEFAULT_SORT) out.set('sort', params.sort);
  if (params.view !== DEFAULT_VIEW) out.set('view', params.view);
  if (params.cursor) out.set('cursor', params.cursor);
  if (params.page > 1 && params.cursor) out.set('page', String(params.page));
  return out;
}

export function directoryHref(params: DirectoryParams, changes: Partial<DirectoryParams> = {}): string {
  const next = { ...params, ...changes };
  // Changing what is listed restarts paging; only explicit cursor moves keep a position.
  const listChanged = (Object.keys(changes) as (keyof DirectoryParams)[]).some(
    (key) => key !== 'view' && key !== 'cursor' && key !== 'page',
  );
  if (listChanged) {
    next.cursor = null;
    next.page = 1;
  }
  const query = toSearchParams(next).toString();
  return query ? `/competitors?${query}` : '/competitors';
}
