import { describe, expect, it } from 'vitest';
import { toSlug } from './slug';

describe('toSlug', () => {
  // Names and slugs from data/competitors.csv; keep seed identifiers stable.
  it.each([
    ['Good People', 'good-people'],
    ['Aroma Designs & Solutions / Aroma Studios', 'aroma-designs-and-solutions-aroma-studios'],
    ['Blue Studio for Voice Over & Dubbing', 'blue-studio-for-voice-over-and-dubbing'],
    ['CONTENT.plus', 'content-plus'],
    [
      'Tarek Nour Communications (TNP / The Kitchen / TN Content)',
      'tarek-nour-communications-tnp-the-kitchen-tn-content',
    ],
    ['CCP|DXB', 'ccp-dxb'],
    ['PIQUÉ Production', 'piqu-production'],
    ['2Pure Studios', '2pure-studios'],
  ])('matches the CSV slug for %s', (name, expected) => {
    expect(toSlug(name)).toBe(expected);
  });

  it('collapses repeated separators and trims them from both ends', () => {
    expect(toSlug('  -- A / B...C --  ')).toBe('a-b-c');
  });

  it('separates an ampersand even without surrounding spaces', () => {
    expect(toSlug('Film&TV')).toBe('film-and-tv');
  });

  it.each(['', '  ', '!!!'])('returns an empty slug when no letters or digits remain: %j', (name) => {
    expect(toSlug(name)).toBe('');
  });

  it('keeps an existing seed slug stable', () => {
    expect(toSlug('rhino-and-oxpecker-productions')).toBe('rhino-and-oxpecker-productions');
  });
});
