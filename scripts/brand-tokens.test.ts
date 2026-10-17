import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type TokenGroups = Record<string, Record<string, string>>;

const brandCss = readFileSync(new URL('../assets/brand/tokens.css', import.meta.url), 'utf8');
const tokenDocument = JSON.parse(
  readFileSync(new URL('../assets/brand/tokens.json', import.meta.url), 'utf8'),
) as { themes: { dark: TokenGroups; light_overrides: TokenGroups } };

function cssTokens(selector: RegExp): Record<string, string> {
  // Strip comments first: comments contain custom-property examples, not declarations.
  const uncommented = brandCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = uncommented.match(selector)?.[1];
  if (!block) throw new Error(`Missing token rule: ${selector}`);

  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (!name || value === undefined) throw new Error('Invalid custom property');
    expect(tokens).not.toHaveProperty(name);
    tokens[name] = value.trim();
  }
  return tokens;
}

function jsonTokens(groups: TokenGroups): Record<string, string> {
  const entries = Object.values(groups).flatMap((group) => Object.entries(group));
  const tokens = Object.fromEntries(entries);
  expect(Object.keys(tokens)).toHaveLength(entries.length);
  return tokens;
}

describe('brand token mirrors', () => {
  it('mirrors every dark CSS custom property with exactly the same value', () => {
    const expected = cssTokens(/:root\s*\{([^}]+)\}/);
    expect(Object.keys(expected).length).toBeGreaterThan(100);
    expect(jsonTokens(tokenDocument.themes.dark)).toStrictEqual(expected);
  });

  it('mirrors every light override with exactly the same value', () => {
    const expected = cssTokens(/:root\[data-theme="light"\]\s*\{([^}]+)\}/);
    expect(Object.keys(expected).length).toBeGreaterThan(20);
    expect(jsonTokens(tokenDocument.themes.light_overrides)).toStrictEqual(expected);
  });

  it('keeps the app stylesheet identical to the canonical brand stylesheet', () => {
    const appCss = readFileSync(new URL('../apps/web/styles/tokens.css', import.meta.url), 'utf8');
    expect(appCss.replace(/\r\n/g, '\n')).toBe(brandCss.replace(/\r\n/g, '\n'));
  });
});
