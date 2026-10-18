import {
  directoryHref,
  parseDirectoryParams,
  toSearchParams,
  type DirectoryParams,
  type RawSearchParams,
} from './params';

/**
 * Profiles carry the list state they were opened from (`?from=`), so "Back to competitors"
 * restores the same filters, sort, view and page. The value is re-parsed and re-serialized
 * through the directory schema, so it can never become an arbitrary URL.
 */
export function profileHref(slug: string, params: DirectoryParams, tab = ''): string {
  const from = toSearchParams(params).toString();
  const path = `/competitors/${encodeURIComponent(slug)}${tab ? `/${tab}` : ''}`;
  return from ? `${path}?${new URLSearchParams({ from }).toString()}` : path;
}

export function listParamsFromProfile(searchParams: RawSearchParams): DirectoryParams | null {
  const raw = searchParams.from;
  const from = Array.isArray(raw) ? raw[0] : raw;
  if (!from || from.length > 1024) return null;
  return parseDirectoryParams(Object.fromEntries(new URLSearchParams(from)));
}

export function backToListHref(searchParams: RawSearchParams): string {
  const params = listParamsFromProfile(searchParams);
  return params ? directoryHref(params) : '/competitors';
}

/** Query suffix that keeps the list context when moving between profile tabs. */
export function fromSuffix(searchParams: RawSearchParams): string {
  const params = listParamsFromProfile(searchParams);
  if (!params) return '';
  const from = toSearchParams(params).toString();
  return from ? `?${new URLSearchParams({ from }).toString()}` : '';
}
