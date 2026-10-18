import { z } from 'zod';
import type { Sort } from './params';

/**
 * Keyset pagination (never OFFSET). The cursor is an opaque base64url token holding the
 * sort key and id of the boundary row plus the direction, so each page is fetched with
 * a stable (sort column, id) comparison and rows are never skipped or repeated.
 */
export type SortSpec = {
  column: 'name' | 'company_code' | 'updated_at';
  ascending: boolean;
};

export const SORT_SPECS: Record<Sort, SortSpec> = {
  name: { column: 'name', ascending: true },
  '-name': { column: 'name', ascending: false },
  code: { column: 'company_code', ascending: true },
  updated: { column: 'updated_at', ascending: false },
};

export type Direction = 'next' | 'prev';

const cursorSchema = z.object({
  s: z.enum(['name', '-name', 'code', 'updated']),
  k: z.string().max(400),
  i: z.guid(),
  d: z.enum(['next', 'prev']),
});

export type Cursor = { sort: Sort; key: string; id: string; direction: Direction };

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function encodeCursor(cursor: Cursor): string {
  return toBase64Url(JSON.stringify({ s: cursor.sort, k: cursor.key, i: cursor.id, d: cursor.direction }));
}

/** Returns null for tampered, malformed or stale (different sort) cursors; the list restarts. */
export function decodeCursor(token: string | null, sort: Sort): Cursor | null {
  if (!token) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(fromBase64Url(token)));
    if (!parsed.success || parsed.data.s !== sort) return null;
    return { sort: parsed.data.s, key: parsed.data.k, id: parsed.data.i, direction: parsed.data.d };
  } catch {
    return null;
  }
}

/** Quotes a value for a PostgREST logic tree so commas, dots and parentheses stay literal. */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * PostgREST `or` expression selecting rows strictly after (or before) the boundary row
 * in the requested order, plus the ordering to apply to the query.
 */
export function keysetClause(spec: SortSpec, cursor: Cursor): { filter: string; orderAscending: boolean } {
  // Walking backwards flips both the comparison and the order; results are reversed after.
  const ascending = cursor.direction === 'next' ? spec.ascending : !spec.ascending;
  const op = ascending ? 'gt' : 'lt';
  const key = quoteFilterValue(cursor.key);
  const id = quoteFilterValue(cursor.id);
  return {
    filter: `or(${spec.column}.${op}.${key},and(${spec.column}.eq.${key},id.${op}.${id}))`,
    orderAscending: ascending,
  };
}

/** Case-insensitive name/slug/code match for an already-normalized query. */
export function searchClause(normalizedQuery: string): string {
  const pattern = quoteFilterValue(`*${normalizedQuery}*`);
  return `or(name.ilike.${pattern},slug.ilike.${pattern},company_code.ilike.${pattern})`;
}

/** Combines optional logic-tree clauses into one value for a single top-level `or=()` param. */
export function combineClauses(clauses: string[]): string | null {
  if (clauses.length === 0) return null;
  return clauses.length === 1 ? clauses[0]! : `and(${clauses.join(',')})`;
}
