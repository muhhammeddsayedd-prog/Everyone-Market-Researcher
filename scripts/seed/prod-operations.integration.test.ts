import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import postgres, { type TransactionSql } from 'postgres';
import { loadSeedInput, planSeed, seedWithinTransaction } from './seed-competitors';
import { applyAccountPatch, readAccounts, type ResolutionAccount } from './database';
import { assertFrozenAccount, commitFreshProdLogo, frozenAccountPatch } from './prod-operations';
import type { ProdPayload } from './prod-model';
import type { SeedPlan } from './model';

// This component rehearsal is exclusively the existing owned local PostgreSQL
// stack. It never authenticates to a hosted project or calls Storage/providers.
const localTarget = 'postgresql://postgres@127.0.0.1:60322/postgres';
const configuredTarget = process.env.M02_TEST_DATABASE_URL;
if (configuredTarget !== undefined && configuredTarget !== localTarget)
  throw new Error('M02 production component tests require the exact password-free local endpoint');
const sql = configuredTarget
  ? postgres(localTarget, { password: 'postgres', max: 1, prepare: false, onnotice: () => {} })
  : undefined;
const target = 'local:127.0.0.1:60322:postgres';
const fixtureCodes = ['C000', 'C001', 'C002', 'C003', 'C004'];
const files = {
  competitorsCsv: readFileSync(new URL('./fixtures/competitors.csv', import.meta.url), 'utf8'),
  accountsCsv: readFileSync(new URL('./fixtures/accounts.csv', import.meta.url), 'utf8'),
  taxonomiesJson: readFileSync(new URL('./fixtures/taxonomies.json', import.meta.url), 'utf8'),
};
const fixturePlan = () => planSeed(loadSeedInput(files));

async function preservedRows() {
  if (!sql) throw new Error('Explicit verified local endpoint is required');
  return {
    competitors: await sql`select to_jsonb(c) as row from app.competitors c order by c.id`,
    accounts: await sql`select to_jsonb(a) as row from app.competitor_accounts a order by a.id`,
    assets: await sql`select to_jsonb(m) as row from app.media_assets m order by m.id`,
  };
}
async function rollbackOnly(run: (tx: TransactionSql, plan: SeedPlan) => Promise<void>) {
  if (!sql) throw new Error('Explicit verified local endpoint is required');
  const before = await preservedRows();
  expect(await sql`select id from app.competitors where company_code in ${sql(fixtureCodes)}`).toHaveLength(
    0,
  );
  const rollback = new Error('M02_PROD_COMPONENT_ROLLBACK_ONLY');
  let failure: unknown;
  try {
    await sql.begin(async (tx) => {
      try {
        await run(tx, fixturePlan());
      } catch (error) {
        failure = error;
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  // All previous rows, including C999 and any existing metadata, must remain
  // byte-for-byte equivalent as JSON values. Never remove a fixture to pass.
  expect(await preservedRows()).toEqual(before);
  if (failure) throw failure;
}
async function ownedAccount(tx: TransactionSql, id: string): Promise<ResolutionAccount> {
  const row = (await readAccounts(tx)).find((item) => item.id === id);
  expect(row).toBeDefined();
  return row!;
}
function frozenEntry(plan: SeedPlan, key: string): ProdPayload['accounts'][number] {
  const row = plan.accounts.find((item) => item.sourceKey === key);
  if (!row) throw new Error('Missing public fixture account');
  return {
    sourceKey: row.sourceKey,
    company_code: row.company_code,
    platform: row.platform,
    sourceHandle: row.handle,
    sourceUrl: row.url,
    handle: row.handle,
    url: row.url,
    status: row.status,
    resolve_status: row.platform === 'youtube' ? 'resolved' : 'not_needed',
    external_id: row.platform === 'youtube' ? `UC${'a'.repeat(22)}` : null,
    uploads_playlist_id: row.platform === 'youtube' ? `UU${'a'.repeat(22)}` : null,
    backfill_cursor: null,
    last_error: null,
  };
}
const logoRecord = (competitorId: string) => ({
  competitorId,
  kind: 'logo' as const,
  storagePath: 'logos/everyone-films.svg',
  sourceUrl: null,
  sha256: 'a'.repeat(64),
  expectedLogoPath: null,
  width: 100,
  height: 20,
});
afterAll(async () => {
  if (sql) await sql.end({ timeout: 5 });
});

describe.skipIf(!sql)('M02 production components — actual local PostgreSQL with mandatory rollback', () => {
  it('imports frozen YouTube fields, repeats seed with zero changes and leaves exact reapplication unchanged', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      expect(first.stats).toEqual({
        competitorsInserted: 5,
        competitorsUpdated: 0,
        accountsInserted: 11,
        accountsUpdated: 0,
      });
      const entry = frozenEntry(plan, 'C002:youtube:0');
      const id = first.manifest.accounts[entry.sourceKey]!.id;
      const row = await ownedAccount(tx, id);
      expect(await applyAccountPatch(tx, row, frozenAccountPatch(row, entry, id))).toBe('updated');
      expect(
        await tx`select resolve_status,external_id,uploads_playlist_id from app.competitor_accounts where id=${id}`,
      ).toMatchObject([
        {
          resolve_status: 'resolved',
          external_id: entry.external_id,
          uploads_playlist_id: entry.uploads_playlist_id,
        },
      ]);
      await tx`lock table app.competitors,app.competitor_accounts in share row exclusive mode`;
      assertFrozenAccount(await ownedAccount(tx, id), entry, id);
      const second = await seedWithinTransaction(tx, plan, { target, manifest: first.manifest });
      expect(second.stats).toEqual({
        competitorsInserted: 0,
        competitorsUpdated: 0,
        accountsInserted: 0,
        accountsUpdated: 0,
      });
      const resolved = await ownedAccount(tx, id);
      assertFrozenAccount(resolved, entry, id);
      expect(await applyAccountPatch(tx, resolved, frozenAccountPatch(resolved, entry, id))).toBe(
        'unchanged',
      );
    });
  });
  it.each(['youtube_failed', 'website_error_cleared'] as const)(
    'detects human %s before a second seed/import and preserves that exact row',
    async (change) => {
      await rollbackOnly(async (tx, plan) => {
        const first = await seedWithinTransaction(tx, plan, { target });
        const entry = frozenEntry(plan, change === 'youtube_failed' ? 'C002:youtube:0' : 'C002:website:0');
        if (change === 'website_error_cleared') entry.last_error = 'unreachable_network';
        const id = first.manifest.accounts[entry.sourceKey]!.id;
        const row = await ownedAccount(tx, id);
        expect(await applyAccountPatch(tx, row, frozenAccountPatch(row, entry, id))).toBe('updated');
        assertFrozenAccount(await ownedAccount(tx, id), entry, id);
        if (change === 'youtube_failed')
          await tx`update app.competitor_accounts set resolve_status='failed',external_id=null,uploads_playlist_id=null where id=${id}`;
        else await tx`update app.competitor_accounts set last_error=null where id=${id}`;
        const human = await tx`select to_jsonb(a) as row from app.competitor_accounts a where id=${id}`;
        let secondSeedReached = false;
        await expect(
          (async () => {
            await tx`lock table app.competitors,app.competitor_accounts in share row exclusive mode`;
            const current = await ownedAccount(tx, id);
            assertFrozenAccount(current, entry, id);
            secondSeedReached = true;
            await seedWithinTransaction(tx, plan, { target, manifest: first.manifest });
            await applyAccountPatch(tx, current, frozenAccountPatch(current, entry, id));
          })(),
        ).rejects.toThrow('M02_PROD_FINAL_ACCOUNT_MISMATCH');
        expect(secondSeedReached).toBe(false);
        expect(await tx`select to_jsonb(a) as row from app.competitor_accounts a where id=${id}`).toEqual(
          human,
        );
      });
    },
  );
  it('commits fresh logo metadata through the actual ownership CAS without Storage calls', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      const id = first.manifest.competitors.C000!.id;
      await commitFreshProdLogo(tx, logoRecord(id));
      expect(
        await tx`select competitor_id,kind,storage_path,source_url,width,height from app.media_assets where storage_path='logos/everyone-films.svg'`,
      ).toMatchObject([
        {
          competitor_id: id,
          kind: 'logo',
          storage_path: 'logos/everyone-films.svg',
          source_url: null,
          width: 100,
          height: 20,
        },
      ]);
      expect(await tx`select logo_path from app.competitors where id=${id}`).toMatchObject([
        { logo_path: 'logos/everyone-films.svg' },
      ]);
    });
  });
  it('rejects duplicate and wrong-owner logo metadata without replacing either existing value', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      const id = first.manifest.competitors.C000!.id;
      await commitFreshProdLogo(tx, logoRecord(id));
      const before =
        await tx`select to_jsonb(m) as row from app.media_assets m where storage_path='logos/everyone-films.svg'`;
      await expect(commitFreshProdLogo(tx, logoRecord(id))).rejects.toThrow(
        'M02_PROD_LOGO_METADATA_COLLISION',
      );
      await expect(commitFreshProdLogo(tx, logoRecord(first.manifest.competitors.C001!.id))).rejects.toThrow(
        'M02_PROD_LOGO_METADATA_COLLISION',
      );
      expect(
        await tx`select to_jsonb(m) as row from app.media_assets m where storage_path='logos/everyone-films.svg'`,
      ).toEqual(before);
      expect(await tx`select logo_path from app.competitors where company_code='C001'`).toMatchObject([
        { logo_path: null },
      ]);
    });
  });
  it('preserves a human logo path instead of overwriting it during a fresh metadata commit', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      const id = first.manifest.competitors.C000!.id;
      await tx`update app.competitors set logo_path='logos/human-choice.svg' where id=${id}`;
      await expect(commitFreshProdLogo(tx, logoRecord(id))).rejects.toThrow('logo_cas_conflict');
      expect(await tx`select logo_path from app.competitors where id=${id}`).toMatchObject([
        { logo_path: 'logos/human-choice.svg' },
      ]);
      expect(
        await tx`select id from app.media_assets where storage_path='logos/everyone-films.svg'`,
      ).toHaveLength(0);
    });
  });
});
