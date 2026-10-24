import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, linkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
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

test('continuation CLI checks only its UUID-owned fresh candidate and refuses aliases, hardlinks and linked ancestors', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-foundation-types-cli-'));
  const runId = '12345678-1234-4234-8234-123456789abc';
  const put = (name, bytes) => {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes, { flag: 'wx' });
    return path;
  };
  try {
    const entry = put(
      'scripts/db/check-foundation-types.mjs',
      readFileSync(new URL('./check-foundation-types.mjs', import.meta.url)),
    );
    put(
      'node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js',
      readFileSync(
        new URL(
          '../../node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js',
          import.meta.url,
        ),
      ),
    );
    put('packages/shared/src/db.types.ts', reference);
    const candidate = put(`scripts/db/out/m03-foundation-continuation-${runId}-db.types.ts`, reference);
    const original = put('scripts/db/out/m03-foundation-hosted-db.types.ts', 'preserved-original-candidate');
    const run = (...args) =>
      spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    const success = run('Continuation', runId);
    assert.equal(success.status, 0, success.stdout + success.stderr);
    assert.equal(JSON.parse(success.stdout).astEquivalent, true);
    assert.equal(readFileSync(original, 'utf8'), 'preserved-original-candidate');
    for (const args of [
      ['Continuation', '../other'],
      ['Continuation', runId, 'extra'],
      ['Other', runId],
      ['Continuation', runId.toUpperCase()],
    ]) {
      const blocked = run(...args);
      assert.equal(blocked.status, 1);
      assert.equal(blocked.stdout, 'FOUNDATION_TYPES_BLOCKED\n');
      assert.equal(blocked.stderr, '');
    }
    const alias = join(root, 'candidate-alias');
    linkSync(candidate, alias);
    assert.equal(run('Continuation', runId).status, 1);
    rmSync(alias);
    const out = join(root, 'scripts/db/out');
    const linked = join(root, 'linked-out');
    mkdirSync(linked);
    writeFileSync(join(linked, `m03-foundation-continuation-${runId}-db.types.ts`), reference);
    rmSync(out, { recursive: true });
    symlinkSync(linked, out, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(run('Continuation', runId).status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
