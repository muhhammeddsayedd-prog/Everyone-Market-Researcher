import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type CommonHelpers = {
  lc: (value: string | null | undefined) => string;
  noAt: (value: string | null | undefined) => string;
  iso: (value: string | number | null | undefined) => string | null;
  tags: (value: string | null | undefined) => string[];
  ats: (value: string | null | undefined) => string[];
  int: (value: string | number | null | undefined) => number | null;
  isoDur: (value: string | null | undefined) => number | null;
  hms: (value: string | null | undefined) => number | null;
  trim8k: (value: string | null | undefined) => string;
};

// Load the same plain JavaScript that is pasted into n8n Code nodes.
const require = createRequire(import.meta.url);
const common = require('./_common.js') as CommonHelpers;

describe('canonical n8n common helpers', () => {
  it('also loads without CommonJS globals for pasting into a Code node', () => {
    const source = readFileSync(new URL('./_common.js', import.meta.url), 'utf8');

    expect(() => runInNewContext(source, {})).not.toThrow();
  });

  it('loads the complete helper set', () => {
    expect(Object.keys(common).sort()).toEqual([
      'ats',
      'hms',
      'int',
      'iso',
      'isoDur',
      'lc',
      'noAt',
      'tags',
      'trim8k',
    ]);
  });

  it.each([1700000000, 1700000000000, '2023-11-14T22:13:20Z'])(
    'normalizes supported timestamp input %j',
    (value) => {
      expect(common.iso(value)).toBe('2023-11-14T22:13:20.000Z');
    },
  );

  it.each([null, undefined, '', 'not-a-date'])('returns null for unavailable or invalid date %j', (value) => {
    expect(common.iso(value)).toBeNull();
  });

  it('accepts the Unix epoch instead of treating zero as a missing date', () => {
    expect(common.iso(0)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('normalizes handles and strips repeated leading at signs', () => {
    expect(common.noAt('@Foo')).toBe('foo');
    expect(common.noAt('  @@Everyone.Film  ')).toBe('everyone.film');
    expect(common.noAt(null)).toBe('');
  });

  it('normalizes and deduplicates Latin and Arabic hashtags in first-seen order', () => {
    expect(common.tags('#Ramadan')).toEqual(['ramadan']);
    expect(common.tags('#Ramadan #رمضان #RAMADAN #film_2026')).toEqual(['ramadan', 'رمضان', 'film_2026']);
    expect(common.tags(undefined)).toEqual([]);
  });

  it('normalizes and deduplicates mentions', () => {
    expect(common.ats('By @Foo and @everyone.film with @FOO')).toEqual(['foo', 'everyone.film']);
  });

  it('rounds available non-negative metric counts and keeps missing values null', () => {
    expect(common.int('3.7')).toBe(4);
    expect(common.int(0)).toBe(0);
    expect(common.int(-1)).toBeNull();
    expect(common.int(null)).toBeNull();
  });

  it('converts supported duration formats to seconds', () => {
    expect(common.isoDur('P1DT2H3M4S')).toBe(93784);
    expect(common.hms('1:02:03')).toBe(3723);
    expect(common.isoDur('not-a-duration')).toBeNull();
    expect(common.hms('')).toBeNull();
  });

  it('caps captions at the documented 8000-character limit', () => {
    expect(common.trim8k('a'.repeat(8001))).toHaveLength(8000);
    expect(common.trim8k(null)).toBe('');
  });
});
