import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { loadSeedInput, planSeed } from './seed-competitors';

// Every case executes the production acceptance SELECT over JSON/CTE rows, never table fixtures.
// This client can only reach the existing owned local stack; no hosted credentials are accepted.
const localTarget = 'postgresql://postgres@127.0.0.1:60322/postgres';
const configuredTarget = process.env.M02_TEST_DATABASE_URL;
if (configuredTarget !== undefined && configuredTarget !== localTarget)
  throw new Error('M02 owner-exclusion tests require the exact password-free local endpoint');
const sql = configuredTarget
  ? postgres(localTarget, { password: 'postgres', max: 1, prepare: false, onnotice: () => {} })
  : undefined;

const source = (name: string) => readFileSync(new URL(`../../data/${name}`, import.meta.url), 'utf8');
const ownerExcludedCodes = ['C102', 'C142', 'C218', 'C231', 'C233', 'C245', 'C283'];
const plan = planSeed(
  loadSeedInput({
    competitorsCsv: source('competitors.csv'),
    accountsCsv: source('competitor_accounts.csv'),
    taxonomiesJson: readFileSync(new URL('../../reference/taxonomies.json', import.meta.url), 'utf8'),
    overridesCsv:
      'company_id,platform,url,action\n' +
      ownerExcludedCodes.map((code) => `${code},youtube,,invalid`).join('\n'),
  }),
);
type FixtureAccount = {
  id: string;
  competitor_id: string;
  platform: string;
  handle: string;
  handle_norm: string;
  url: string;
  status: string;
  resolve_status: string;
  external_id: string | null;
  uploads_playlist_id: string | null;
  backfill_status: string;
  backfill_from: string;
  cadence: string;
};
const fixtureCompetitors = plan.competitors.map((row) => ({ ...row, id: row.company_code }));
function fixtureAccounts(): FixtureAccount[] {
  return plan.accounts.map((row, index) => {
    const resolved = ['vimeo', 'youtube'].includes(row.platform) && row.status !== 'invalid';
    return {
      ...row,
      id: String(index),
      competitor_id: row.company_code,
      handle_norm: row.handle.toLowerCase(),
      resolve_status: resolved ? 'resolved' : row.resolve_status,
      external_id: resolved ? (row.platform === 'vimeo' ? '123' : `UC${'a'.repeat(22)}`) : null,
      uploads_playlist_id: resolved && row.platform === 'youtube' ? `UU${'a'.repeat(22)}` : null,
    };
  });
}

const acceptanceSql = readFileSync(new URL('../assert/m02_counts.sql', import.meta.url), 'utf8');
const fixtureSql = acceptanceSql
  .replaceAll('app.competitors', 'fixture_competitors')
  .replaceAll('app.competitor_accounts', 'fixture_accounts')
  .replaceAll('app.media_assets', 'fixture_media_assets')
  .replaceAll('storage.objects', 'fixture_objects')
  .replace(
    /\bwith\s*\r?\n/,
    `with
fixture_competitors as (
  select * from jsonb_to_recordset($1::jsonb) as c(
    id text, company_code text, slug text, priority_tier text, is_baseline boolean,
    logo_url text, logo_path text)
),
fixture_accounts as (
  select * from jsonb_to_recordset($2::jsonb) as a(
    id text, competitor_id text, platform text, handle text, handle_norm text, url text,
    status text, resolve_status text, external_id text, uploads_playlist_id text,
    backfill_status text, backfill_from date, cadence interval)
),
fixture_media_assets as (
  select null::text as kind, null::text as competitor_id, null::text as storage_path where false
),
fixture_objects as (
  select null::text as bucket_id, null::text as name where false
),
`,
  );
if (!fixtureSql.includes('fixture_competitors as (') || /\b(?:app|storage)\./.test(fixtureSql))
  throw new Error('Owner-exclusion tests must substitute every project table with read-only CTE input');

type Assertion = { criterion: string; actual: unknown; expected: unknown; passed: boolean | null };
async function assertions(accounts = fixtureAccounts(), competitors = fixtureCompetitors) {
  if (!sql) throw new Error('Explicit verified local test endpoint is required');
  return sql.begin('read only', async (tx) => {
    const [state] = await tx`select current_setting('transaction_read_only') as read_only`;
    expect(state?.read_only).toBe('on');
    return tx.unsafe<Assertion[]>(fixtureSql, [tx.json(competitors), tx.json(accounts)]);
  });
}
function criterion(rows: Assertion[], name: string) {
  const row = rows.find((item) => item.criterion === name);
  expect(row, name).toBeDefined();
  return row!;
}
function youtubeRow(accounts: FixtureAccount[], code: string) {
  const row = accounts.find((item) => item.platform === 'youtube' && item.competitor_id === code);
  expect(row, code).toBeDefined();
  return row!;
}
function eligibleRow(accounts: FixtureAccount[]) {
  return accounts.find((row) => row.platform === 'youtube' && row.status === 'active')!;
}

afterAll(async () => {
  if (sql) await sql.end({ timeout: 5 });
});

describe.skipIf(!sql)('M02 owner exclusions — actual PostgreSQL read-only acceptance', () => {
  it('preserves source totals while passing only the seven approved exclusions and ten eligible pilots', async () => {
    const rows = await assertions();
    expect(criterion(rows, 'AC2_primary_youtube').passed).toBe(true);
    expect(criterion(rows, 'AC3_total_accounts').passed).toBe(true);
    expect(criterion(rows, 'AC4_active_youtube').passed).toBe(true);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(true);
    expect(criterion(rows, 'AC5_youtube_resolution')).toMatchObject({
      passed: true,
      actual: {
        total: 128,
        resolved: 121,
        pilot_total: 11,
        pilot_resolved: 10,
        owner_excluded: 7,
        owner_excluded_pilot: 1,
        eligible_total: 121,
        eligible_resolved: 121,
        eligible_pilot_total: 10,
        eligible_pilot_resolved: 10,
      },
    });
  });

  it('does not exempt an additional invalid source outside the seven owner decisions', async () => {
    const accounts = fixtureAccounts();
    const row = eligibleRow(accounts);
    Object.assign(row, {
      status: 'invalid',
      resolve_status: 'failed',
      external_id: null,
      uploads_playlist_id: null,
    });
    const rows = await assertions(accounts);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
  });

  it.each(['url', 'handle_norm'] as const)('rejects %s drift in an excluded identity', async (field) => {
    const accounts = fixtureAccounts();
    youtubeRow(accounts, 'C283')[field] += '-different';
    const rows = await assertions(accounts);
    expect(criterion(rows, 'AC4_active_youtube').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
  });

  it('rejects re-enabling an excluded source even if its unresolved state is unchanged', async () => {
    const accounts = fixtureAccounts();
    youtubeRow(accounts, 'C283').status = 'active';
    const rows = await assertions(accounts);
    expect(criterion(rows, 'AC4_active_youtube').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
  });

  it.each(['pending', 'resolved', 'not_needed'])(
    'rejects an excluded source whose resolution state changes to %s',
    async (state) => {
      const accounts = fixtureAccounts();
      youtubeRow(accounts, 'C283').resolve_status = state;
      const rows = await assertions(accounts);
      expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
      expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
    },
  );

  it.each(['external_id', 'uploads_playlist_id'] as const)(
    'rejects a stale %s on an excluded source',
    async (field) => {
      const accounts = fixtureAccounts();
      youtubeRow(accounts, 'C283')[field] = 'stale';
      const rows = await assertions(accounts);
      expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
      expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
    },
  );

  it.each(['external_id', 'uploads_playlist_id'] as const)(
    'requires an excluded %s to be null rather than an empty string',
    async (field) => {
      const accounts = fixtureAccounts();
      youtubeRow(accounts, 'C283')[field] = '';
      const rows = await assertions(accounts);
      expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
      expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
    },
  );

  it('rejects a disabled non-pilot source outside the approved exclusions even if its IDs are valid', async () => {
    const accounts = fixtureAccounts();
    accounts.find((row) => row.platform === 'youtube' && row.status === 'paused')!.status = 'disabled';
    const rows = await assertions(accounts);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
  });

  it.each(['external_id', 'uploads_playlist_id'] as const)(
    'rejects a missing %s on a supposedly resolved eligible source',
    async (field) => {
      const accounts = fixtureAccounts();
      eligibleRow(accounts)[field] = null;
      expect(criterion(await assertions(accounts), 'AC5_youtube_resolution').passed).toBe(false);
    },
  );

  it('rejects malformed identifiers without counting them as resolved', async () => {
    const accounts = fixtureAccounts();
    eligibleRow(accounts).external_id = 'not-a-channel-id';
    expect(criterion(await assertions(accounts), 'AC5_youtube_resolution').passed).toBe(false);
  });

  it('rejects an eligible source returned to pending', async () => {
    const accounts = fixtureAccounts();
    eligibleRow(accounts).resolve_status = 'pending';
    expect(criterion(await assertions(accounts), 'AC5_youtube_resolution').passed).toBe(false);
  });

  it('rejects removal of an excluded source instead of silently shrinking the denominator', async () => {
    const accounts = fixtureAccounts().filter(
      (row) => !(row.platform === 'youtube' && row.competitor_id === 'C283'),
    );
    const rows = await assertions(accounts);
    expect(criterion(rows, 'AC2_primary_youtube').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
  });

  it('rejects a duplicated excluded source even if all seven approved identities remain', async () => {
    const accounts = fixtureAccounts();
    accounts.push({ ...youtubeRow(accounts, 'C283'), id: 'duplicate' });
    const rows = await assertions(accounts);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
  });

  it('rejects changing the approved pilot exclusion into a different tier', async () => {
    const competitors = structuredClone(fixtureCompetitors);
    competitors.find((row) => row.company_code === 'C283')!.priority_tier = 'next_wave';
    const rows = await assertions(fixtureAccounts(), competitors);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
  });

  it('does not let a fabricated resolution of an excluded source erase its decision', async () => {
    const accounts = fixtureAccounts();
    Object.assign(youtubeRow(accounts, 'C283'), {
      status: 'active',
      resolve_status: 'resolved',
      external_id: `UC${'a'.repeat(22)}`,
      uploads_playlist_id: `UU${'a'.repeat(22)}`,
    });
    const rows = await assertions(accounts);
    expect(criterion(rows, 'AC5_youtube_owner_exclusions').passed).toBe(false);
    expect(criterion(rows, 'AC5_youtube_resolution').passed).toBe(false);
  });
});
