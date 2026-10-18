import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateDevCa } from './database-ca';

const bytes = readFileSync(new URL('./certs/supabase-root-2021.crt', import.meta.url));
const metadata: unknown = JSON.parse(
  readFileSync(new URL('./certs/supabase-root-2021.json', import.meta.url), 'utf8'),
);

describe('scoped public Supabase CA', () => {
  it('accepts the pinned owner-delivered public certificate bytes', () => {
    expect(validateDevCa(bytes, metadata)).toBe(bytes.toString('utf8'));
  });
  it('rejects changed bytes and oversized input with only a fixed error', () => {
    for (const candidate of [Buffer.concat([bytes, Buffer.from('\n')]), Buffer.alloc(100_001)])
      expect(() => validateDevCa(candidate, metadata)).toThrow('M02_PUBLIC_CA_REJECTED');
  });
  it.each([
    null,
    {},
    { ...(metadata as object), sha256: null },
    { ...(metadata as object), projectRef: 'hkiafqrcxaafdbcvjlzv' },
    { ...(metadata as object), host: 'example.com' },
    { ...(metadata as object), sourceUrl: 'https://example.com/untrusted.crt' },
    { ...(metadata as object), extra: true },
  ])('rejects unreviewed metadata without reflecting its contents', (candidate) => {
    expect(() => validateDevCa(bytes, candidate)).toThrow('M02_PUBLIC_CA_REJECTED');
  });
});
