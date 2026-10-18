import { describe, expect, it } from 'vitest';
import {
  combineClauses,
  decodeCursor,
  encodeCursor,
  keysetClause,
  quoteFilterValue,
  searchClause,
  SORT_SPECS,
} from './keyset';
import {
  activeFilterCount,
  directoryHref,
  normalizeSearch,
  parseDirectoryParams,
  toSearchParams,
} from './params';
import { backToListHref, fromSuffix, profileHref } from './return-to';

const ID = '3f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('directory URL params', () => {
  it('keeps only known values and drops malformed ones', () => {
    const params = parseDirectoryParams({
      q: '  Good   People ',
      market: 'KSA',
      tier: 'gold',
      category: 'film_and_tv',
      capability: 'DROP TABLE',
      status: 'paused',
      sort: 'updated',
      view: 'list',
      cursor: 'abc_-1',
      page: '3',
    });
    expect(params).toEqual({
      q: 'Good People',
      market: 'KSA',
      tier: null,
      category: 'film_and_tv',
      capability: null,
      status: 'paused',
      sort: 'updated',
      view: 'list',
      cursor: 'abc_-1',
      page: 3,
    });
    expect(activeFilterCount(params)).toBe(4);
  });

  it('falls back to defaults for arrays, junk and out-of-range pages', () => {
    const params = parseDirectoryParams({
      sort: ['-name', 'name'],
      view: 'tiles',
      page: '-2',
      cursor: 'a b',
    });
    expect(params.sort).toBe('-name');
    expect(params.view).toBe('grid');
    expect(params.page).toBe(1);
    expect(params.cursor).toBeNull();
  });

  it('strips PostgREST and LIKE metacharacters from search', () => {
    expect(normalizeSearch('a,b(c)*d%e_f"g\\h:i')).toBe('a b c d e f g h i');
    expect(normalizeSearch("electriclime° & O'Neil-Films")).toBe("electriclime° & O'Neil-Films");
    expect(normalizeSearch('أفلام')).toBe('أفلام');
    expect(normalizeSearch('x'.repeat(200))).toHaveLength(80);
  });

  it('serializes without defaults and restarts paging when the list changes', () => {
    const params = parseDirectoryParams({ tier: 'pilot', cursor: 'abc', page: '2', view: 'list' });
    expect(toSearchParams(params).toString()).toBe('tier=pilot&view=list&cursor=abc&page=2');
    expect(directoryHref(params, { market: 'EG' })).toBe('/competitors?market=EG&tier=pilot&view=list');
    expect(directoryHref(params, { view: 'grid' })).toBe('/competitors?tier=pilot&cursor=abc&page=2');
    expect(directoryHref(parseDirectoryParams({}))).toBe('/competitors');
  });
});

describe('keyset cursor', () => {
  it('round-trips and rejects tampering or a different sort', () => {
    const token = encodeCursor({
      sort: 'name',
      key: 'Fixture, "Comma" (Parens) أفلام',
      id: ID,
      direction: 'next',
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(token, 'name')).toEqual({
      sort: 'name',
      key: 'Fixture, "Comma" (Parens) أفلام',
      id: ID,
      direction: 'next',
    });
    expect(decodeCursor(token, '-name')).toBeNull();
    expect(decodeCursor(`${token}x`, 'name')).toBeNull();
    expect(decodeCursor('not-a-cursor', 'name')).toBeNull();
    expect(decodeCursor(null, 'name')).toBeNull();
  });

  it('builds forward and backward comparisons with an id tiebreak', () => {
    const cursor = { sort: 'name' as const, key: 'B', id: ID, direction: 'next' as const };
    expect(keysetClause(SORT_SPECS.name, cursor)).toEqual({
      filter: `or(name.gt."B",and(name.eq."B",id.gt."${ID}"))`,
      orderAscending: true,
    });
    expect(keysetClause(SORT_SPECS.name, { ...cursor, direction: 'prev' })).toEqual({
      filter: `or(name.lt."B",and(name.eq."B",id.lt."${ID}"))`,
      orderAscending: false,
    });
    expect(keysetClause(SORT_SPECS.updated, { ...cursor, sort: 'updated' }).filter).toContain(
      'updated_at.lt.',
    );
  });

  it('quotes values so punctuation cannot change the filter tree', () => {
    expect(quoteFilterValue('a,b) or(id.gt.0')).toBe('"a,b) or(id.gt.0"');
    expect(quoteFilterValue('say "hi" \\ bye')).toBe('"say \\"hi\\" \\\\ bye"');
    expect(searchClause('good people')).toBe(
      'or(name.ilike."*good people*",slug.ilike."*good people*",company_code.ilike."*good people*")',
    );
    expect(combineClauses([])).toBeNull();
    expect(combineClauses(['x'])).toBe('x');
    expect(combineClauses(['x', 'y'])).toBe('and(x,y)');
  });
});

describe('return to the preserved list', () => {
  it('carries list state through profile links and back', () => {
    const params = parseDirectoryParams({ tier: 'pilot', q: 'comma', view: 'list' });
    const href = profileHref('fixture-comma', params);
    expect(href).toBe('/competitors/fixture-comma?from=q%3Dcomma%26tier%3Dpilot%26view%3Dlist');
    const from = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(backToListHref(from)).toBe('/competitors?q=comma&tier=pilot&view=list');
    expect(fromSuffix(from)).toBe('?from=q%3Dcomma%26tier%3Dpilot%26view%3Dlist');
  });

  it('cannot be turned into an arbitrary destination', () => {
    expect(backToListHref({ from: 'https://evil.example' })).toBe('/competitors');
    expect(backToListHref({ from: 'tier=pilot&next=//evil.example' })).toBe('/competitors?tier=pilot');
    expect(backToListHref({})).toBe('/competitors');
    expect(fromSuffix({})).toBe('');
  });
});
