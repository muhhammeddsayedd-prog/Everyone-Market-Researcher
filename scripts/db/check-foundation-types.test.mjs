import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { format } from 'prettier';
import { verifyFoundationTypes } from './check-foundation-types.mjs';

const reference = readFileSync(new URL('../../packages/shared/src/db.types.ts', import.meta.url), 'utf8');

test('raw generated array spelling and its deterministic formatter output have the same type shape', async () => {
  const raw = reference.replaceAll('string[]', '(string)[]');
  assert.notEqual(raw, reference);
  const formatted = await format(raw, { parser: 'typescript' });
  assert.equal(verifyFoundationTypes(raw, formatted).astEquivalent, true);
});

test('formatter-added parentheses in generic conditional constraints do not change type meaning', async () => {
  const raw =
    reference +
    '\nexport type FormattingConstraint<T, K extends T extends string ? string : number = never> = K;\n';
  const formatted = await format(raw, { parser: 'typescript' });
  assert.notEqual(raw, formatted);
  assert.equal(verifyFoundationTypes(raw, formatted).astEquivalent, true);
});

test('removing a grouping wrapper never removes the underlying array/union precedence', () => {
  const grouped = reference + '\nexport type Grouping = (string | number)[];\n';
  const other = reference + '\nexport type Grouping = string | number[];\n';
  assert.throws(() => verifyFoundationTypes(grouped, other), /FOUNDATION_TYPES_BLOCKED/);
});

test('real scalar, nullability, optionality, literal and RPC changes remain blocked', () => {
  const changed = [
    reference.replace('body_md: string | null', 'body_md: number | null'),
    reference.replace('source_item_ids: string[] | null', 'source_item_ids: string[]'),
    reference.replace('body_md: string | null', 'body_md?: string | null'),
    reference.replace("'baseline'", "'a_different_tier'"),
    reference.replace('foundation_gateway_complete_read:', 'missing_foundation_complete_read:'),
  ];
  for (const candidate of changed) {
    assert.notEqual(candidate, reference);
    assert.throws(() => verifyFoundationTypes(candidate, reference), /FOUNDATION_TYPES_BLOCKED/);
  }
});

test('malformed types and missing schemas remain blocked', () => {
  assert.throws(
    () => verifyFoundationTypes('export type Database = {', reference),
    /FOUNDATION_TYPES_BLOCKED/,
  );
  assert.throws(
    () => verifyFoundationTypes(reference.replace('api: {', 'unexpected: {'), reference),
    /FOUNDATION_TYPES_BLOCKED/,
  );
});
