import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import postgres, { type TransactionSql } from 'postgres';
import {
  applyAccountPatch,
  commitLogoWithinTransaction,
  readAccounts,
  readLogoInputs,
  readLogoAsset,
} from './database';
import { loadSeedInput, planSeed, seedWithinTransaction } from './seed-competitors';
import { copyLogo, type LogoRecord } from './copy-logos';

const configured = process.env.M02_TEST_DATABASE_URL;
let sql: ReturnType<typeof postgres> | undefined;
if (configured !== undefined) {
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('Invalid explicit M02 local integration target');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '60322' ||
    url.username !== 'postgres' ||
    url.password ||
    url.pathname !== '/postgres' ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid explicit M02 local integration target');
  sql = postgres(configured, { password: 'postgres', max: 1, prepare: false, onnotice: () => {} });
}
const files = {
  competitorsCsv: readFileSync(new URL('./fixtures/competitors.csv', import.meta.url), 'utf8'),
  accountsCsv: readFileSync(new URL('./fixtures/accounts.csv', import.meta.url), 'utf8'),
  taxonomiesJson: readFileSync(new URL('./fixtures/taxonomies.json', import.meta.url), 'utf8'),
};
const plan = planSeed(loadSeedInput(files));
const codes = plan.competitors.map((c) => c.company_code);
async function rollback(run: (tx: TransactionSql) => Promise<void>) {
  if (!sql) throw new Error('Explicit verified local integration target required');
  expect(await sql`select id from app.competitors where company_code in ${sql(codes)}`).toHaveLength(0);
  const baseline = await sql`select to_jsonb(c) as row from app.competitors c where company_code='C999'`;
  const sentinel = new Error('M02_DATABASE_TEST_ROLLBACK');
  let failure: unknown;
  let ids: string[] = [];
  try {
    await sql.begin(async (tx) => {
      try {
        await seedWithinTransaction(tx, plan, { target: 'local:127.0.0.1:60322:postgres' });
        await run(tx);
        ids = (
          await tx`select a.id from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where c.company_code in ${tx(codes)}`
        ).map((r) => String(r.id));
      } catch (error) {
        failure = error;
      }
      throw sentinel;
    });
  } catch (error) {
    if (error !== sentinel) throw error;
  }
  expect(await sql`select id from app.competitors where company_code in ${sql(codes)}`).toHaveLength(0);
  if (ids.length)
    expect(await sql`select id from app.competitor_accounts where id in ${sql(ids)}`).toHaveLength(0);
  expect(await sql`select to_jsonb(c) as row from app.competitors c where company_code='C999'`).toEqual(
    baseline,
  );
  if (failure) throw failure;
}
afterAll(async () => {
  if (sql) await sql.end({ timeout: 5 });
});

describe.skipIf(!sql)('actual local PostgreSQL resolution CAS and logo metadata rollback acceptance', () => {
  it('executes a resolution CAS with SQL NULL cursor and rejects a stale snapshot', async () => {
    await rollback(async (tx) => {
      const rows = await readAccounts(tx);
      const row = rows.find((r) => r.company_code === 'C003' && r.platform === 'vimeo')!;
      expect(rows.filter((r) => codes.includes(r.company_code))).toHaveLength(11);
      expect(
        await applyAccountPatch(tx, row, {
          resolve_status: 'resolved',
          external_id: '123',
          last_error: null,
          backfill_cursor: { endpoint: 'channels' },
        }),
      ).toBe('updated');
      expect(
        await applyAccountPatch(tx, row, {
          resolve_status: 'failed',
          last_error: 'vimeo_404',
          status: 'invalid',
        }),
      ).toBe('preserved');
      expect(
        await tx`select external_id,resolve_status,status,backfill_cursor from app.competitor_accounts where id=${row.id}`,
      ).toMatchObject([
        {
          external_id: '123',
          resolve_status: 'resolved',
          status: 'paused',
          backfill_cursor: { endpoint: 'channels' },
        },
      ]);
    });
  });
  it('preserves human identity and collector scheduling changes observed after the snapshot', async () => {
    await rollback(async (tx) => {
      const rows = await readAccounts(tx);
      const row = rows.find((r) => r.company_code === 'C003' && r.platform === 'vimeo')!;
      await tx`update app.competitor_accounts set next_due_at='2031-01-01T00:00:00Z' where id=${row.id}`;
      expect(
        await applyAccountPatch(tx, row, {
          resolve_status: 'resolved',
          external_id: '123',
          last_error: null,
        }),
      ).toBe('preserved');
      const fresh = (await readAccounts(tx)).find((r) => r.id === row.id)!;
      await tx`update app.competitor_accounts set handle='human-choice',url='https://vimeo.com/human-choice' where id=${row.id}`;
      expect(
        await applyAccountPatch(tx, fresh, {
          resolve_status: 'resolved',
          external_id: '123',
          last_error: null,
        }),
      ).toBe('preserved');
    });
  });
  it('commits logo path and a single same-owner asset atomically and idempotently', async () => {
    await rollback(async (tx) => {
      const input = (await readLogoInputs(tx)).find((r) => r.company_code === 'C000')!;
      const record: LogoRecord = {
        competitorId: input.competitorId,
        kind: 'logo',
        expectedLogoPath: null,
        storagePath: 'logos/everyone-films.svg',
        sourceUrl: null,
        sha256: '0'.repeat(64),
        width: 128,
        height: 32,
      };
      await commitLogoWithinTransaction(tx, record);
      await commitLogoWithinTransaction(tx, { ...record, expectedLogoPath: record.storagePath });
      expect(await tx`select logo_path from app.competitors where id=${input.competitorId}`).toMatchObject([
        { logo_path: 'logos/everyone-films.svg' },
      ]);
      expect(
        await tx`select competitor_id,kind,source_url,width,height from app.media_assets where storage_path=${record.storagePath}`,
      ).toEqual([
        { competitor_id: input.competitorId, kind: 'logo', source_url: null, width: 128, height: 32 },
      ]);
    });
  });
  it('preserves unmanaged asset ownership and concurrent human logo changes', async () => {
    await rollback(async (tx) => {
      const inputs = await readLogoInputs(tx),
        baseline = inputs.find((r) => r.company_code === 'C000')!,
        other = inputs.find((r) => r.company_code === 'C001')!;
      const record: LogoRecord = {
        competitorId: baseline.competitorId,
        kind: 'logo',
        expectedLogoPath: null,
        storagePath: 'logos/everyone-films.svg',
        sourceUrl: null,
        sha256: '0'.repeat(64),
        width: 128,
        height: 32,
      };
      await tx`insert into app.media_assets(competitor_id,kind,storage_path,source_url) values(${other.competitorId},'logo',${record.storagePath},null)`;
      await expect(commitLogoWithinTransaction(tx, record)).rejects.toThrow('asset_collision');
      expect(await tx`select logo_path from app.competitors where id=${baseline.competitorId}`).toMatchObject(
        [{ logo_path: null }],
      );
      expect(
        await tx`select competitor_id from app.media_assets where storage_path=${record.storagePath}`,
      ).toMatchObject([{ competitor_id: other.competitorId }]);
      await tx`update app.competitors set logo_path='logos/owner-choice.svg' where id=${baseline.competitorId}`;
      await expect(commitLogoWithinTransaction(tx, record)).rejects.toThrow('logo_cas_conflict');
    });
  });
  it('rejects an item-linked logo asset even on the unchanged owned-logo path', async () => {
    await rollback(async (tx) => {
      const baseline = (await readLogoInputs(tx)).find((r) => r.company_code === 'C000')!;
      const [item] =
        await tx`insert into app.items(competitor_id,platform,item_type,external_id,url) values(${baseline.competitorId},'vimeo','video','m02-logo-ownership-fixture','https://vimeo.com/123') returning id`;
      await tx`update app.competitors set logo_path='logos/everyone-films.svg' where id=${baseline.competitorId}`;
      await tx`insert into app.media_assets(competitor_id,item_id,kind,storage_path,source_url) values(${baseline.competitorId},${item!.id},'logo','logos/everyone-films.svg',null)`;
      expect(await readLogoAsset(tx, 'logos/everyone-films.svg')).toMatchObject({
        competitorId: baseline.competitorId,
        itemId: item!.id,
        kind: 'logo',
        sourceUrl: null,
      });
      await expect(
        copyLogo(
          { ...baseline, currentLogoPath: 'logos/everyone-films.svg' },
          {
            readAsset: (path) => readLogoAsset(tx, path),
            readStored: async () => {
              throw new Error('Unchanged item-linked asset must be rejected before public-byte reads');
            },
            upload: async () => {
              throw new Error('Unexpected upload');
            },
            commit: async () => {
              throw new Error('Unexpected metadata commit');
            },
          },
          { storagePath: 'logos/everyone-films.svg', sourceUrl: null, sha256: '0'.repeat(64) },
        ),
      ).rejects.toThrow('storage_collision');
      expect(
        await tx`select item_id from app.media_assets where storage_path='logos/everyone-films.svg'`,
      ).toMatchObject([{ item_id: item!.id }]);
    });
  });
});
