import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertNoProdRunState, loadProdInputs } from './prod-inputs';
import { prodDatabaseConfig } from './prod-model';
const root = fileURLToPath(new URL('../..', import.meta.url));
describe('production local admission and credential boundary', () => {
  it('validates actual sealed public inputs offline and enforces current approval/reference state', async () => {
    const { packet } = await loadProdInputs(root, false);
    expect(typeof packet.approved).toBe('boolean');
    if (packet.approved) expect((await loadProdInputs(root, true)).packet.approvalReference).toBeTruthy();
    else await expect(loadProdInputs(root, true)).rejects.toThrow('M02_PROD_APPROVAL_PENDING');
  });
  it('rejects every existing durable state, including null/false/zero JSON, without adopting it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emr-m02-prod-state-'));
    try {
      await assertNoProdRunState(directory);
      for (const filename of [
        'prod-seed-admission.json',
        'prod-write-pending.json',
        'prod-seed-manifest.json',
        'prod-logo-manifest.json',
      ])
        for (const value of [null, false, 0, {}]) {
          const path = join(directory, filename);
          await writeFile(path, JSON.stringify(value), { flag: 'wx' });
          try {
            await expect(assertNoProdRunState(directory)).rejects.toThrow('M02_PROD_RECONCILIATION_REQUIRED');
          } finally {
            await unlink(path);
          }
        }
    } finally {
      await rmdir(directory);
    }
  });
  it('rejects dev credentials/ports/password-bearing URI and retains strict TLS options for prod', () => {
    const url =
      'postgresql://postgres.hkiafqrcxaafdbcvjlzv@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';
    const env = {
      SEED_DATABASE_URL: url,
      PGPASSWORD: 'synthetic-test-only',
      SUPABASE_SECRET_KEY: 'synthetic-storage-only',
    };
    expect(prodDatabaseConfig(env, 'public-ca').ssl).toMatchObject({
      rejectUnauthorized: true,
      servername: 'aws-1-eu-central-1.pooler.supabase.com',
    });
    for (const wrong of [
      url.replace('hkiafqrcxaafdbcvjlzv', 'zmotjsbzhzjvpelxvxlf'),
      url.replace(':5432', ':6543'),
      url.replace('?sslmode=require', '?sslmode=disable'),
      url.replace('@', ':test-only@'),
    ])
      expect(() => prodDatabaseConfig({ ...env, SEED_DATABASE_URL: wrong }, 'public-ca')).toThrow(
        'M02_PROD_DATABASE_TARGET_REJECTED',
      );
  });
});
