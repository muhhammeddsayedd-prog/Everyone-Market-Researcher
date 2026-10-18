import { describe, expect, it } from 'vitest';
import { databaseConfig, parseCommand, seedTargets, SeedRuntimeError } from './config';

const url =
  'postgresql://postgres.zmotjsbzhzjvpelxvxlf@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';
describe('owner-run seed command boundaries', () => {
  it('defaults to a credential-free plan and to the dev target', () => {
    expect(parseCommand([])).toEqual({ action: 'plan', target: 'dev', apply: false });
    expect(parseCommand(['report'])).toEqual({ action: 'report', target: 'dev', apply: false });
  });
  it.each(['seed', 'resolve', 'websites', 'logos', 'accept-dev'])(
    'requires explicit apply for %s',
    (action) => {
      expect(() => parseCommand([action])).toThrow(SeedRuntimeError);
      expect(parseCommand([action, '--target', 'dev', '--apply']).apply).toBe(true);
    },
  );
  it.each([
    ['seed', '--apply', '--target', 'prod'],
    ['report', '--target', 'local'],
    ['unknown'],
    ['plan', '--token', 'sentinel'],
    ['plan', '--target', 'wrong'],
    ['seed', '--apply', '--apply'],
    ['report', '--target', 'dev', '--target', 'dev'],
    ['plan', '--target'],
    ['plan', '--apply'],
  ])('rejects unapproved or unknown command arguments without echoing them: %j', (...args) => {
    expect(() => parseCommand(args)).toThrow(/^M02_/);
  });
  it('uses a password-free URI plus the private child password', () => {
    const config = databaseConfig('dev', { SEED_DATABASE_URL: url, PGPASSWORD: 'test-only-sentinel' });
    expect(config.target).toBe('supabase:zmotjsbzhzjvpelxvxlf:postgres');
    expect(config.options).toMatchObject({
      host: seedTargets.dev.host,
      port: 5432,
      database: 'postgres',
      username: 'postgres.zmotjsbzhzjvpelxvxlf',
      max: 1,
      prepare: false,
      ssl: { rejectUnauthorized: true },
      password: 'test-only-sentinel',
    });
  });
  it.each([
    url.replace('5432', '6543'),
    url.replace('zmotjsbzhzjvpelxvxlf', 'hkiafqrcxaafdbcvjlzv'),
    url.replace('postgres.zmotjsbzhzjvpelxvxlf@', 'api_agent.zmotjsbzhzjvpelxvxlf@'),
    url.replace('@aws-1', ':secret-sentinel@aws-1'),
    url.replace('sslmode=require', 'sslmode=disable'),
    url.replace('/postgres?', '/template1?'),
    `${url}&password=sentinel`,
    `${url}#fragment`,
    url.replace('aws-1-eu-central-1.pooler.supabase.com', 'example.com'),
    'not a URL',
  ])('rejects a mismatched or credential-bearing connection without reflecting it', (candidate) => {
    try {
      databaseConfig('dev', { SEED_DATABASE_URL: candidate, PGPASSWORD: 'test-only-sentinel' });
    } catch (error) {
      expect((error as Error).message).toBe('M02_DATABASE_TARGET_REJECTED');
      return;
    }
    throw new Error('Unsafe configuration accepted');
  });
  it('distinguishes missing private password from database authentication', () => {
    expect(() => databaseConfig('dev', { SEED_DATABASE_URL: url })).toThrow('M02_PASSWORD_NOT_PRESENT');
    expect(() => databaseConfig('dev', {})).toThrow('M02_DATABASE_URL_NOT_PRESENT');
  });
  it('rejects production even when databaseConfig is called directly', () => {
    expect(() =>
      databaseConfig('prod', {
        SEED_DATABASE_URL: url.replace('zmotjsbzhzjvpelxvxlf', 'hkiafqrcxaafdbcvjlzv'),
        PGPASSWORD: 'test-only-sentinel',
      }),
    ).toThrow('M02_PRODUCTION_NOT_APPROVED');
  });
});
