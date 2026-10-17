import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';
import { parseEnv } from './env';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('parseEnv', () => {
  it('returns typed values, defaults and transformations from the supplied schema', () => {
    vi.stubEnv('EMR_TEST_PORT', '3000');
    vi.stubEnv('EMR_TEST_MODE', undefined);

    const env = parseEnv(
      z.object({
        EMR_TEST_PORT: z.coerce.number().int().positive(),
        EMR_TEST_MODE: z.enum(['local', 'test']).default('local'),
      }),
    );

    expect(env).toEqual({ EMR_TEST_PORT: 3000, EMR_TEST_MODE: 'local' });
    expectTypeOf(env.EMR_TEST_PORT).toEqualTypeOf<number>();
    expectTypeOf(env.EMR_TEST_MODE).toEqualTypeOf<'local' | 'test'>();
  });

  it('names all invalid fields and issue codes without including their values', () => {
    vi.stubEnv('EMR_TEST_TOKEN', 'private-test-value');
    vi.stubEnv('EMR_TEST_REQUIRED', undefined);
    const schema = z.object({
      EMR_TEST_TOKEN: z.string().refine(() => false, {
        error: 'Rejected private-test-value',
      }),
      EMR_TEST_REQUIRED: z.string(),
    });

    let thrown: unknown;
    try {
      parseEnv(schema);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('EMR_TEST_TOKEN (custom)');
    expect((thrown as Error).message).toContain('EMR_TEST_REQUIRED (invalid_type)');
    expect(String(thrown)).not.toContain('private-test-value');
    expect(JSON.stringify(thrown)).not.toContain('private-test-value');
    expect(thrown).not.toHaveProperty('cause');
  });

  it('does not forward exceptions thrown by a schema that could contain an environment value', () => {
    vi.stubEnv('EMR_TEST_TOKEN', 'private-test-value');
    const schema = z.object({
      EMR_TEST_TOKEN: z.string().transform((value) => {
        throw new Error(`Rejected ${value}`);
      }),
    });

    expect(() => parseEnv(schema)).toThrow('Server environment validation failed; check the schema.');
  });

  it('refuses browser calls before reading environment variables', () => {
    vi.stubGlobal('window', {});

    expect(() => parseEnv(z.object({}))).toThrow('parseEnv can only be called on the server.');
  });

  it('can be imported without validating credentials', async () => {
    vi.stubEnv('EMR_TEST_REQUIRED', undefined);

    await expect(import('./index')).resolves.toHaveProperty('parseEnv');
  });
});
