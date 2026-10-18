import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import postgres, { type TransactionSql } from 'postgres';
import { loadSeedInput, planSeed, seedWithinTransaction } from './seed-competitors';
import type { SeedPlan } from './model';
import { applyAccountPatch, readAccounts } from './database';
import { resolveAccounts } from './resolve-accounts';

// Deliberately limited to the independently verified local M01 stack, never a hosted project.
const configuredUrl = process.env.M02_TEST_DATABASE_URL;
function validateLocalTestUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('M02 integration target must be the verified local PostgreSQL endpoint');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '60322' ||
    url.pathname !== '/postgres' ||
    url.username !== 'postgres' ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('M02 integration target must be the password-free verified local PostgreSQL endpoint');
  }
  return value;
}
const safeUrl = configuredUrl === undefined ? undefined : validateLocalTestUrl(configuredUrl);
const sql = safeUrl
  ? postgres(safeUrl, { password: 'postgres', max: 1, prepare: false, onnotice: () => {} })
  : undefined;
const target = 'local:127.0.0.1:60322:postgres';
const files = {
  competitorsCsv: readFileSync(new URL('./fixtures/competitors.csv', import.meta.url), 'utf8'),
  accountsCsv: readFileSync(new URL('./fixtures/accounts.csv', import.meta.url), 'utf8'),
  taxonomiesJson: readFileSync(new URL('./fixtures/taxonomies.json', import.meta.url), 'utf8'),
};
const fixturePlan = (overridesCsv?: string) => planSeed(loadSeedInput({ ...files, overridesCsv }));
const fixtureCodes = ['C000', 'C001', 'C002', 'C003', 'C004'];

async function rollbackOnly(run: (tx: TransactionSql, plan: SeedPlan) => Promise<void>) {
  if (!sql) throw new Error('Explicit local database target is required');
  const baseline = await sql`select to_jsonb(c) as row from app.competitors c where company_code = 'C999'`;
  const before = await sql`select id from app.competitors where company_code in ${sql(fixtureCodes)}`;
  expect(before).toHaveLength(0);
  const rollback = new Error('M02_LOCAL_ROLLBACK_ONLY');
  let failure: unknown;
  let ownedAccountIds: string[] = [];
  try {
    await sql.begin(async (tx) => {
      try {
        await run(tx, fixturePlan());
        const owned =
          await tx`select a.id from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where c.company_code in ${tx(fixtureCodes)}`;
        ownedAccountIds = owned.map((row) => String(row.id));
      } catch (error) {
        failure = error;
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  const after = await sql`select id from app.competitors where company_code in ${sql(fixtureCodes)}`;
  expect(after).toHaveLength(0);
  if (ownedAccountIds.length)
    expect(
      await sql`select id from app.competitor_accounts where id in ${sql(ownedAccountIds)}`,
    ).toHaveLength(0);
  expect(await sql`select to_jsonb(c) as row from app.competitors c where company_code = 'C999'`).toEqual(
    baseline,
  );
  if (failure) throw failure;
}

afterAll(async () => {
  if (sql) await sql.end({ timeout: 5 });
});

describe.skipIf(!safeUrl)('M02 actual local PostgreSQL rollback-only seed acceptance', () => {
  it('seeds five competitors / eleven accounts twice with a true second-run no-op', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      expect(first.stats).toEqual({
        competitorsInserted: 5,
        competitorsUpdated: 0,
        accountsInserted: 11,
        accountsUpdated: 0,
      });
      const before = await tx`select id, updated_at from app.competitor_accounts order by id`;
      const second = await seedWithinTransaction(tx, plan, { target, manifest: first.manifest });
      expect(second.stats).toEqual({
        competitorsInserted: 0,
        competitorsUpdated: 0,
        accountsInserted: 0,
        accountsUpdated: 0,
      });
      expect(second.issues).toEqual([]);
      expect(await tx`select id, updated_at from app.competitor_accounts order by id`).toEqual(before);
      expect(
        await tx`select platform, count(*)::int as count from app.competitor_accounts where competitor_id in (select id from app.competitors where company_code in ${tx(fixtureCodes)}) group by platform`,
      ).toHaveLength(8);
    });
  });

  it('preserves human edits and operational/resolution state across changed and unchanged seeds', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      await tx`update app.competitors set name = 'Human correction' where company_code = 'C001'`;
      await tx`update app.competitor_accounts set external_id='123', resolve_status='resolved', status='disabled', backfill_status='running',
        backfill_cursor='{"page":3}'::jsonb, locked_until='2030-01-01Z', next_due_at='2031-01-01Z', last_external_id='watermark'
        where id=${first.manifest.accounts['C003:vimeo:0']!.id}`;
      const operational =
        await tx`select * from app.competitor_accounts where id=${first.manifest.accounts['C003:vimeo:0']!.id}`;
      const changed = structuredClone(plan);
      changed.competitors[1]!.name = 'Changed CSV name';
      changed.competitors[1]!.notes = 'Changed CSV note';
      const second = await seedWithinTransaction(tx, changed, { target, manifest: first.manifest });
      expect(second.stats.accountsUpdated).toBe(0);
      expect(
        await tx`select * from app.competitor_accounts where id=${first.manifest.accounts['C003:vimeo:0']!.id}`,
      ).toEqual(operational);
      expect(await tx`select name, notes from app.competitors where company_code='C001'`).toMatchObject([
        { name: 'Human correction', notes: 'Changed CSV note' },
      ]);
      const third = await seedWithinTransaction(tx, changed, { target, manifest: second.manifest });
      expect(third.stats).toEqual({
        competitorsInserted: 0,
        competitorsUpdated: 0,
        accountsInserted: 0,
        accountsUpdated: 0,
      });
      expect(await tx`select name from app.competitors where company_code='C001'`).toMatchObject([
        { name: 'Human correction' },
      ]);
    });
  });

  it('applies explicit owner replacement to an uncollected account and clears stale resolution IDs', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      const id = first.manifest.accounts['C003:vimeo:0']!.id;
      await tx`update app.competitor_accounts set external_id='123', uploads_playlist_id='stale', resolve_status='resolved' where id=${id}`;
      const corrected = fixturePlan(
        'company_id,platform,url,action\nC003,vimeo,https://vimeo.com/corrected,replace',
      );
      const second = await seedWithinTransaction(tx, corrected, { target, manifest: first.manifest });
      expect(second.stats.accountsUpdated).toBe(1);
      expect(
        await tx`select handle, external_id, uploads_playlist_id, resolve_status from app.competitor_accounts where id=${id}`,
      ).toMatchObject([
        { handle: 'corrected', external_id: null, uploads_playlist_id: null, resolve_status: 'pending' },
      ]);
      expect(
        (await seedWithinTransaction(tx, corrected, { target, manifest: second.manifest })).stats
          .accountsUpdated,
      ).toBe(0);
    });
  });

  it('blocks a collected account replacement and preserves its old identity and content', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      const id = first.manifest.accounts['C003:vimeo:0']!.id;
      await tx`update app.competitor_accounts set backfill_cursor='{"page":2}'::jsonb where id=${id}`;
      const corrected = fixturePlan(
        'company_id,platform,url,action\nC003,vimeo,https://vimeo.com/corrected,replace',
      );
      const second = await seedWithinTransaction(tx, corrected, { target, manifest: first.manifest });
      expect(second.issues.some((issue) => issue.code === 'identity_change_requires_review')).toBe(true);
      expect(
        await tx`select handle, backfill_cursor from app.competitor_accounts where id=${id}`,
      ).toMatchObject([{ handle: 'nextwave', backfill_cursor: { page: 2 } }]);
    });
  });

  it('reports a database collision without reassigning the account to another competitor', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      const corrected = fixturePlan(
        'company_id,platform,url,action\nC004,instagram,https://www.instagram.com/pilot.one/,replace',
      );
      const second = await seedWithinTransaction(tx, corrected, { target, manifest: first.manifest });
      expect(second.issues.some((issue) => issue.code === 'duplicate_handle')).toBe(true);
      expect(
        await tx`select c.company_code from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where a.platform='instagram' and a.handle_norm='pilot.one'`,
      ).toMatchObject([{ company_code: 'C001' }]);
      expect(
        await tx`select count(*)::int as count from app.competitor_accounts where competitor_id in (select id from app.competitors where company_code in ${tx(fixtureCodes)})`,
      ).toMatchObject([{ count: 11 }]);
    });
  });

  it('does not overwrite existing rows when the ownership manifest is unavailable', async () => {
    await rollbackOnly(async (tx, plan) => {
      await seedWithinTransaction(tx, plan, { target });
      await tx`update app.competitors set name='Human without manifest' where company_code='C001'`;
      const result = await seedWithinTransaction(tx, plan, { target });
      expect(result.stats).toEqual({
        competitorsInserted: 0,
        competitorsUpdated: 0,
        accountsInserted: 0,
        accountsUpdated: 0,
      });
      expect(result.issues.some((issue) => issue.code === 'unmanaged_competitor')).toBe(true);
      expect(await tx`select name from app.competitors where company_code='C001'`).toMatchObject([
        { name: 'Human without manifest' },
      ]);
    });
  });
  it('never gains future ownership from initially equal unmanaged fields', async () => {
    await rollbackOnly(async (tx, plan) => {
      await seedWithinTransaction(tx, plan, { target });
      const recovered = await seedWithinTransaction(tx, plan, { target });
      expect(recovered.stats.competitorsUpdated).toBe(0);
      const changed = structuredClone(plan);
      changed.competitors[1]!.name = 'Changed CSV must not take over';
      const next = await seedWithinTransaction(tx, changed, { target, manifest: recovered.manifest });
      expect(next.stats.competitorsUpdated).toBe(0);
      expect(await tx`select name from app.competitors where company_code='C001'`).toMatchObject([
        { name: 'Pilot One' },
      ]);
    });
  });
  it('lets an explicit owner replacement recover an invalid uncollected identity and resolve it', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      const row = (await readAccounts(tx)).find((r) => r.company_code === 'C003' && r.platform === 'vimeo')!;
      expect(
        await applyAccountPatch(tx, row, {
          resolve_status: 'failed',
          status: 'invalid',
          last_error: 'vimeo_404',
        }),
      ).toBe('updated');
      const afterFailure = await seedWithinTransaction(tx, plan, { target, manifest: first.manifest });
      const corrected = fixturePlan(
        'company_id,platform,url,action\nC003,vimeo,https://vimeo.com/corrected,replace',
      );
      await seedWithinTransaction(tx, corrected, { target, manifest: afterFailure.manifest });
      const ready = (await readAccounts(tx)).find((r) => r.id === row.id)!;
      expect(ready).toMatchObject({
        status: 'paused',
        resolve_status: 'pending',
        handle: 'corrected',
        external_id: null,
      });
      const result = await resolveAccounts(
        tx,
        [ready],
        { vimeoToken: 'fixture' },
        {
          probe: { vimeo: { status: 'passed' }, youtube: { status: 'unneeded' } },
          resolvers: {
            resolveVimeo: async () => ({ resolve_status: 'resolved', external_id: '456', last_error: null }),
            resolveYouTube: async () => {
              throw new Error('Unexpected YouTube call');
            },
          },
        },
      );
      expect(result.updated).toBe(1);
      expect(
        await tx`select status,resolve_status,external_id from app.competitor_accounts where id=${row.id}`,
      ).toMatchObject([{ status: 'paused', resolve_status: 'resolved', external_id: '456' }]);
    });
  });
  it('preserves human paused and disabled decisions during an explicit identity correction', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      await tx`update app.competitor_accounts set status='paused' where id=${first.manifest.accounts['C001:instagram:0']!.id}`;
      await tx`update app.competitor_accounts set status='disabled' where id=${first.manifest.accounts['C001:linkedin:0']!.id}`;
      const corrected = fixturePlan(
        'company_id,platform,url,action\nC001,instagram,https://www.instagram.com/corrected/,replace\nC001,linkedin,https://www.linkedin.com/company/corrected/,replace',
      );
      await seedWithinTransaction(tx, corrected, { target, manifest: first.manifest });
      expect(
        await tx`select platform,status,handle from app.competitor_accounts where id in ${tx([first.manifest.accounts['C001:instagram:0']!.id, first.manifest.accounts['C001:linkedin:0']!.id])} order by platform`,
      ).toEqual([
        { platform: 'instagram', status: 'paused', handle: 'corrected' },
        { platform: 'linkedin', status: 'disabled', handle: 'corrected' },
      ]);
    });
  });
  it('treats a case-only YouTube UC ID replacement as a new identity despite handle_norm equality', async () => {
    await rollbackOnly(async (tx, plan) => {
      const first = await seedWithinTransaction(tx, plan, { target });
      const id = first.manifest.accounts['C002:youtube:0']!.id;
      await tx`update app.competitor_accounts set external_id='old-channel',uploads_playlist_id='old-uploads',resolve_status='resolved' where id=${id}`;
      const corrected = fixturePlan(
        'company_id,platform,url,action\nC002,youtube,https://www.youtube.com/channel/UCIhEH7Bk23zVkIYMCBqvjgQ,replace',
      );
      await seedWithinTransaction(tx, corrected, { target, manifest: first.manifest });
      expect(
        await tx`select handle,external_id,uploads_playlist_id,resolve_status from app.competitor_accounts where id=${id}`,
      ).toMatchObject([
        {
          handle: 'channel/UCIhEH7Bk23zVkIYMCBqvjgQ',
          external_id: null,
          uploads_playlist_id: null,
          resolve_status: 'pending',
        },
      ]);
    });
  });
});
