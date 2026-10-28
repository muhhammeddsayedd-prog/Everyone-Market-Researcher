import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  executeSimpleQuery,
  strictAdminConfig,
  incrementalSelectors,
  buildIncrementalPreflightSql,
  bindIncrementalAccounts,
  buildIncrementalSetupSql,
  buildIncrementalResumeSql,
  buildIncrementalRestoreSql,
  buildIncrementalAssertionsSql,
} from './m04-query.mjs';

function syntheticIncrementalPreflight() {
  const old = JSON.parse(
    readFileSync(resolve('scripts/db/m03-foundation-forward-dev-migration-packet.json'), 'utf8'),
  );
  const migrations = [
    ...old.baseline,
    ...old.pending,
    {
      version: '20261026013910',
      name: 'm04_vimeo_account_resolution',
      historySha256: '9391ae1b1f029e2ea9aa93b812a80b46f9f5abd8fe6245c05da1703bfcf2b56c',
    },
    {
      version: '20261027092832',
      name: 'm04_collector_product_contracts',
      historySha256: '7f036a391743189b3e8031070aa4f18fbd893df7619aab92b02f6a5996b4db7f',
    },
  ].map(({ version, name, historySha256 }) => ({ name, historySha256, version }));
  const accounts = incrementalSelectors.map((s, index) => {
    const account = {
      id: s.knownId ?? `90000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      competitor_id: `80000000-0000-4000-8000-${s.company_code.slice(1).padStart(12, '0')}`,
      platform: s.platform,
      handle: s.handle,
      handle_norm: s.handle,
      url: s.url,
      status: 'active',
      backfill_from: '2024-01-01',
      backfill_status: 'pending',
      backfill_cursor: null,
      next_due_at: '2026-10-18T00:00:00Z',
      locked_until: null,
      last_run_id: null,
      updated_at: '2026-10-27T00:00:00Z',
    };
    return { key: s.key, company_code: s.company_code, competitor_status: 'active', ...account, account };
  });
  return {
    current_user: 'postgres',
    session_user: 'postgres',
    database: 'postgres',
    migrations,
    selectorCounts: incrementalSelectors.map((s) => ({ key: s.key, count: 1 })),
    accounts,
    m04ProductTablesPresent: true,
    selectedCount: 10,
    selectedLiveClaims: 0,
    selectedRunningParents: [],
    selectedUnprocessedActors: [],
    globalUnfinished: { liveClaims: 0, runningParents: 0, unprocessedActors: 0 },
  };
}

function syntheticHc01Preflight() {
  const fixture = syntheticIncrementalPreflight();
  fixture.migrations.push({
    version: '20261027192743',
    name: 'm04_recent_instagram_dev_eligibility',
    historySha256: 'a'.repeat(64),
  });
  const ids = {
    C000: '962c9c7e-aa0f-46ae-911b-3265859e0577',
    C001: 'bed82782-753f-4ba9-91ca-691ef36f75c6',
    C130: '46149fb9-8905-4b76-9834-4b38f668a2e2',
    C270: '2d42d451-ac9a-42ac-a879-8760d63c8108',
    C226: '3ca3befa-abe6-4540-a389-0cf16115c581',
  };
  for (const entry of fixture.accounts) {
    if (entry.account.platform === 'instagram') {
      entry.id = entry.account.id = ids[entry.company_code];
      entry.account.last_item_published_at = '2026-10-12T15:01:56Z';
      entry.account.last_external_id = 'retained-public-id';
    } else if (entry.company_code === 'C000') {
      entry.account.external_id = '157330576';
      entry.account.last_run_id = '74fae456-a34c-4460-a5ea-6ab66ecec431';
    }
  }
  return fixture;
}

test('HC01 binding requires all original17 fingerprints plus exact eighteenth identity and five fixed Instagram UUIDs', () => {
  const fixture = syntheticHc01Preflight();
  assert.equal(bindIncrementalAccounts(fixture, { scope: 'hc01' }).length, 10);
  assert.throws(() => bindIncrementalAccounts(fixture), /incremental_preflight_blocked/);
  for (const mutate of [
    (p) => {
      p.migrations[0].historySha256 = '0'.repeat(64);
    },
    (p) => {
      p.migrations[17].version = '20261027192744';
    },
    (p) => {
      p.migrations[17].name = 'foreign_migration';
    },
    (p) => {
      p.migrations[17].historySha256 = 'not-a-history-hash';
    },
    (p) => {
      p.accounts[7].account.id = '90000000-0000-4000-8000-000000000077';
    },
    (p) => {
      p.accounts[5].account.last_external_id = '';
    },
    (p) => {
      p.accounts[5].account.last_item_published_at = 'infinity';
    },
    (p) => {
      p.accounts[5].account.backfill_status = 'done';
    },
  ]) {
    const changed = syntheticHc01Preflight();
    mutate(changed);
    assert.throws(
      () => bindIncrementalAccounts(changed, { scope: 'hc01' }),
      /incremental_(?:preflight|selection)_blocked/,
    );
  }
  assert.throws(() => bindIncrementalAccounts(fixture, { scope: 'prod' }), /incremental_scope_blocked/);
});

test('HC01 binding accepts the retained actual ten-account projection with only a synthetic eighteenth history receipt', () => {
  const fixture = JSON.parse(
    readFileSync(
      resolve('milestones/M04-collectors-vimeo-instagram/evidence/incremental-final-readback-20261027.json'),
      'utf8',
    ),
  ).queryResult[0].incremental_preflight;
  fixture.migrations.push({
    version: '20261027192743',
    name: 'm04_recent_instagram_dev_eligibility',
    historySha256: 'a'.repeat(64),
  });
  const bound = bindIncrementalAccounts(fixture, { scope: 'hc01' });
  assert.equal(bound.length, 10);
  for (const entry of bound.filter((e) => e.account.platform === 'instagram')) {
    assert.equal(typeof entry.account.last_external_id, 'string');
    assert.equal(Object.hasOwn(entry.account, 'last_item_external_id'), false);
  }
});

test('HC01 first/rest daily setup and repeat rearm change only due time, preserving history and watermarks', () => {
  const bound = bindIncrementalAccounts(syntheticHc01Preflight(), { scope: 'hc01' });
  for (const [cohort, expected] of [
    ['first-instagram', 1],
    ['remaining-instagram', 4],
  ]) {
    const sql = buildIncrementalSetupSql(bound, cohort, { scope: 'hc01' });
    assert.equal((sql.match(/"selection":\{\}/g) ?? []).length, expected * 2);
    assert.doesNotMatch(sql, /set\s+backfill_status|backfill_cursor\s*=/);
    assert.match(sql, /to_jsonb\(a\) is distinct from e->'account'/);
    assert.match(sql, /M04 HC01 global unfinished work changed/);
  }
  const entry = bound.find((e) => e.key === 'C000:instagram:0');
  const owner = { run_id: '70000000-0000-4000-8000-000000000001', execution_id: '99200' };
  const repeat = buildIncrementalResumeSql(entry, owner, 'daily-due', { scope: 'hc01' });
  assert.match(repeat, /2026-10-28T00:43:24Z/);
  assert.match(repeat, /1cf8406c-1142-445e-a237-6d0fd7a67b22/);
  assert.doesNotMatch(repeat, /123e88b6-5920-4e54-832a-ad6d87c22675/);
  assert.doesNotMatch(repeat, /set\s+backfill_status|backfill_cursor\s*=/);
  assert.throws(
    () => buildIncrementalResumeSql(entry, null, 'daily-due', { scope: 'hc01' }),
    /incremental_owner_blocked/,
  );
  assert.throws(
    () => buildIncrementalSetupSql(bound, 'instagram-history', { scope: 'hc01' }),
    /incremental_cohort_blocked/,
  );
  assert.throws(
    () => buildIncrementalResumeSql(bound[2], owner, 'vimeo-cursor', { scope: 'hc01' }),
    /incremental_resume_blocked/,
  );
});

test('HC01 Vimeo continuation is pinned to recorded31176 page4 width5 and rechecks historical parent closure in SQL', () => {
  const bound = bindIncrementalAccounts(syntheticHc01Preflight(), { scope: 'hc01' });
  const sql = buildIncrementalSetupSql(bound, 'vimeo-continuation', { scope: 'hc01' });
  assert.match(sql, /"page":4/);
  assert.match(sql, /"page_size":5/);
  assert.match(sql, /\/users\/157330576/);
  assert.match(sql, /31176/);
  assert.match(sql, /accepted Vimeo parent ownership or closure changed/);
  assert.doesNotMatch(sql, /backfill_status\s*=/);
  const entry = bound.find((e) => e.key === 'C000:vimeo:0');
  for (const mutate of [
    (a) => {
      a.external_id = '49236950';
    },
    (a) => {
      a.last_run_id = null;
    },
    (a) => {
      a.backfill_status = 'done';
    },
    (a) => {
      a.backfill_cursor = { page: 5, page_size: 5, endpoint: 'users', resourcePath: '/users/157330576' };
    },
  ]) {
    const altered = structuredClone(bound);
    mutate(altered.find((e) => e.key === entry.key).account);
    assert.throws(
      () => buildIncrementalSetupSql(altered, 'vimeo-continuation', { scope: 'hc01' }),
      /incremental_accepted_cursor_blocked/,
    );
  }
});

test('HC01 restore retains legitimately advanced Vimeo cursor/history and uses scoped launch assertions', () => {
  const bound = bindIncrementalAccounts(syntheticHc01Preflight(), { scope: 'hc01' });
  const original = bound.find((e) => e.key === 'C000:vimeo:0');
  const current = structuredClone(original);
  current.account.backfill_status = 'running';
  current.account.backfill_cursor = {
    endpoint: 'users',
    resourcePath: '/users/157330576',
    page: 5,
    page_size: 5,
  };
  current.owner = { run_id: '70000000-0000-4000-8000-000000000001', execution_id: '99200' };
  const sql = buildIncrementalRestoreSql(bound, [current], { scope: 'hc01' });
  assert.doesNotMatch(sql, /backfill_status\s*=|backfill_cursor\s*=/);
  assert.match(sql, /"next_due_at":"2026-10-18T00:00:00Z"/);
  assert.match(
    buildIncrementalAssertionsSql(bound, [current.owner], { scope: 'hc01' }),
    /1cf8406c-1142-445e-a237-6d0fd7a67b22/,
  );
  const unrelated = structuredClone(bound.find((e) => e.key === 'C001:vimeo:0'));
  unrelated.owner = current.owner;
  assert.throws(
    () => buildIncrementalRestoreSql(bound, [unrelated], { scope: 'hc01' }),
    /incremental_snapshot_blocked/,
  );
});

test('incremental catalog query contains exactly the approved selectors, no invented six UUIDs or mutations', () => {
  const sql = buildIncrementalPreflightSql();
  assert.equal(incrementalSelectors.length, 10);
  assert.equal(incrementalSelectors.filter((s) => s.knownId === null).length, 6);
  assert.match(sql, /as incremental_preflight/);
  assert.match(sql, /'account',to_jsonb\(m\)-'key'-'company_code'-'competitor_status'/);
  assert.doesNotMatch(sql, /\b(?:update|insert|delete|alter|create|drop)\b/i);
  for (const selector of incrementalSelectors) assert.ok(sql.includes(selector.url));
});

test('incremental binding uses actual projected six UUIDs and is independent of JSON property order', () => {
  const fixture = syntheticIncrementalPreflight();
  const bound = bindIncrementalAccounts(fixture);
  assert.equal(bound.length, 10);
  assert.deepEqual(
    bound.map((e) => e.account.id),
    fixture.accounts.map((e) => e.account.id),
  );
  assert.notEqual(bound[0].account, fixture.accounts[0].account);
});

test('incremental binding rejects unknown ownership, ambiguous selectors, changed history and unfinished work', () => {
  for (const mutate of [
    (p) => {
      p.migrations[0].historySha256 = '0'.repeat(64);
    },
    (p) => {
      p.selectorCounts[0].count = 2;
    },
    (p) => {
      p.accounts[0].account.id = p.accounts[2].account.id;
    },
    (p) => {
      p.accounts[2].account.url = 'https://vimeo.com/other';
    },
    (p) => {
      p.accounts[2].account.status = 'paused';
    },
    (p) => {
      p.accounts[2].account.locked_until = '2026-10-27T01:00:00Z';
    },
    (p) => {
      p.accounts[7].account.competitor_id = p.accounts[0].account.competitor_id;
    },
    (p) => {
      p.globalUnfinished.unprocessedActors = 1;
    },
  ]) {
    const fixture = syntheticIncrementalPreflight();
    mutate(fixture);
    assert.throws(() => bindIncrementalAccounts(fixture), /incremental_(?:preflight|selection)_blocked/);
  }
});

test('incremental operational planning preserves historical width and refuses fabricated daily eligibility or cursor widths', () => {
  const bound = bindIncrementalAccounts(syntheticIncrementalPreflight());
  bound[0].account.external_id = '157330576';
  bound[1].account.external_id = '49236950';
  const accepted = buildIncrementalSetupSql(bound, 'accepted-vimeo');
  assert.match(accepted, /"page_size":5/);
  assert.doesNotMatch(accepted, /"page_size":20/);
  const entry = bound[2],
    owner = { run_id: '70000000-0000-4000-8000-000000000001', execution_id: '99124' };
  assert.throws(() => buildIncrementalResumeSql(entry, owner, 'daily-due'), /incremental_daily_ineligible/);
  entry.account.backfill_status = 'running';
  entry.account.external_id = '19672181';
  entry.account.backfill_cursor = {
    page: 3,
    endpoint: 'users',
    resourcePath: '/users/19672181',
    page_size: 5,
  };
  assert.throws(() => buildIncrementalResumeSql(entry, owner, 'vimeo-cursor'), /incremental_resume_blocked/);
  entry.account.backfill_cursor.page_size = 20;
  assert.match(
    buildIncrementalResumeSql(entry, owner, 'vimeo-cursor'),
    /recorded parent ownership or closure changed/,
  );
  assert.doesNotMatch(
    buildIncrementalAssertionsSql(bound),
    /\b(?:update|insert|delete|alter|create|drop)\b/i,
  );
});

test(
  'actual local rollback executes generated setup, cursor resume, daily due, HC01 due/cursor containment and restoration ownership paths',
  { skip: process.env.EMR_M04_QUERY_LOCAL_TEST !== 'true' },
  async () => {
    const { Client } = createRequire(import.meta.url)(
      resolve('node_modules/.pnpm/pg@8.23.1/node_modules/pg'),
    );
    const client = new Client({
      host: '127.0.0.1',
      port: 60322,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
      ssl: false,
      connectionTimeoutMillis: 3000,
    });
    const targets = {
      'app.competitor_accounts': 'pg_temp.m04_accounts',
      'app.competitors': 'pg_temp.m04_competitors',
      'ops.scrape_runs': 'pg_temp.m04_runs',
      'ops.scrape_run_accounts': 'pg_temp.m04_run_accounts',
      'ops.apify_runs': 'pg_temp.m04_apify',
      'ops.collector_accounts': 'pg_temp.m04_collector_accounts',
      'ops.collector_runs': 'pg_temp.m04_collector_runs',
      'ops.collector_passes': 'pg_temp.m04_passes',
      'ops.collector_launches': 'pg_temp.m04_launches',
    };
    const local = (sql) =>
      Object.entries(targets).reduce((value, [from, to]) => value.replaceAll(from, to), sql);
    const snapshot = async (id) =>
      (await client.query('select to_jsonb(a) account from pg_temp.m04_accounts a where id=$1', [id])).rows[0]
        .account;
    const owner = { run_id: '70000000-0000-4000-8000-000000000001', execution_id: '99124' };
    await client.connect();
    const preservationSql = `select jsonb_build_object(
 'migrations',(select coalesce(jsonb_agg(version order by version),'[]'::jsonb) from supabase_migrations.schema_migrations),
 'competitors',(select count(*) from app.competitors),'accounts',(select count(*) from app.competitor_accounts),
 'items',(select count(*) from app.items),'rawItems',(select count(*) from ingest.raw_items),
 'costRows',(select count(*) from ops.cost_ledger)) baseline`;
    const preservedBefore = (await client.query(preservationSql)).rows[0].baseline;
    try {
      await client.query(`begin;
create temporary table m04_accounts (like app.competitor_accounts including all);
create temporary table m04_competitors (like app.competitors including all);
create temporary table m04_runs (like ops.scrape_runs including all);
create temporary table m04_run_accounts (like ops.scrape_run_accounts including all);
create temporary table m04_apify (like ops.apify_runs including all);
create temporary table m04_collector_accounts(run_id uuid,account_id uuid);
create temporary table m04_collector_runs(run_id uuid,registration_closed boolean);
create temporary table m04_passes(run_id uuid,status text);
create temporary table m04_launches(run_id uuid,apify_run_id text,approval_id uuid);`);
      const fixture = syntheticHc01Preflight(),
        companies = new Set();
      const baseline = [];
      for (const entry of fixture.accounts) {
        if (!companies.has(entry.company_code)) {
          await client.query(
            `insert into pg_temp.m04_competitors(id,company_code,slug,name,priority_tier) values($1,$2,$2,$2,(enum_range(null::app.priority_tier))[1])`,
            [entry.account.competitor_id, entry.company_code],
          );
          companies.add(entry.company_code);
        }
        const external =
          entry.key === 'C000:vimeo:0'
            ? '157330576'
            : entry.key === 'C001:vimeo:0'
              ? '49236950'
              : entry.account.platform === 'vimeo'
                ? '19672181'
                : null;
        await client.query(
          `insert into pg_temp.m04_accounts(id,competitor_id,platform,handle,url,external_id,next_due_at,last_item_published_at,last_external_id) values($1,$2,$3,$4,$5,$6,'2026-10-18','2026-10-20','retained-public-id')`,
          [
            entry.account.id,
            entry.account.competitor_id,
            entry.account.platform,
            entry.account.handle,
            entry.account.url,
            external,
          ],
        );
        baseline.push({
          key: entry.key,
          company_code: entry.company_code,
          account: await snapshot(entry.account.id),
        });
      }
      for (const cohort of ['new-vimeo', 'instagram-history', 'accepted-vimeo'])
        await client.query(local(buildIncrementalSetupSql(baseline, cohort)));
      const original = baseline[2];
      const setupRow = await snapshot(original.account.id);
      assert.equal(setupRow.last_item_published_at, original.account.last_item_published_at);
      assert.equal(setupRow.last_run_id, original.account.last_run_id);
      const accepted = await snapshot(baseline[0].account.id);
      assert.equal(accepted.backfill_cursor.page_size, 5);
      assert.equal(accepted.backfill_cursor.page, 2);
      await client.query(
        local(
          buildIncrementalRestoreSql(baseline, [{ ...original, account: setupRow, setup_account: setupRow }]),
        ),
      );
      let current = await snapshot(original.account.id);
      assert.equal(current.next_due_at, original.account.next_due_at);
      await client.query(
        `insert into pg_temp.m04_runs(id,workflow,platform,mode,env,n8n_execution_id,status,finished_at) values($1,'WF-10','vimeo','backfill','dev',$2,'success',now())`,
        [owner.run_id, owner.execution_id],
      );
      await client.query('insert into pg_temp.m04_collector_runs values($1,true)', [owner.run_id]);
      await client.query('insert into pg_temp.m04_collector_accounts values($1,$2)', [
        owner.run_id,
        current.id,
      ]);
      await client.query(
        "insert into pg_temp.m04_run_accounts(run_id,account_id,status) values($1,$2,'success')",
        [owner.run_id, current.id],
      );
      await client.query(
        `update pg_temp.m04_accounts set last_run_id=$1,backfill_status='running',backfill_cursor='{"page":3,"endpoint":"users","resourcePath":"/users/19672181","page_size":20}',next_due_at=now()+interval '1 day' where id=$2`,
        [owner.run_id, current.id],
      );
      current = await snapshot(current.id);
      await client.query(
        local(buildIncrementalResumeSql({ ...original, account: current }, owner, 'vimeo-cursor')),
      );
      current = await snapshot(current.id);
      assert.equal(current.backfill_cursor.page, 3);
      await client.query(
        `update pg_temp.m04_accounts set backfill_status='done',next_due_at=now()+interval '1 day' where id=$1`,
        [current.id],
      );
      current = await snapshot(current.id);
      await client.query(
        local(buildIncrementalResumeSql({ ...original, account: current }, owner, 'daily-due')),
      );
      current = await snapshot(current.id);
      await client.query(
        local(buildIncrementalRestoreSql(baseline, [{ ...original, account: current, owner }])),
      );
      const restored = await snapshot(current.id);
      assert.equal(restored.backfill_status, original.account.backfill_status);
      assert.equal(restored.next_due_at, original.account.next_due_at);
      assert.equal(restored.last_run_id, owner.run_id);
      assert.equal(restored.last_item_published_at, original.account.last_item_published_at);
      await client.query('savepoint wrong_owner');
      await assert.rejects(
        client.query(
          local(
            buildIncrementalRestoreSql(baseline, [
              { ...original, account: restored, owner: { ...owner, execution_id: '99999' } },
            ]),
          ),
        ),
        (error) => error.code === '55000',
      );
      await client.query('rollback to savepoint wrong_owner');

      const hc = { scope: 'hc01' };
      const freshBound = async () => {
        const rows = [];
        for (const entry of baseline) rows.push({ ...entry, account: await snapshot(entry.account.id) });
        return rows;
      };
      let hcBound = await freshBound();
      const ig = hcBound.find((entry) => entry.key === 'C000:instagram:0');
      const igHistory = {
        status: ig.account.backfill_status,
        cursor: ig.account.backfill_cursor,
        watermark: ig.account.last_item_published_at,
        external: ig.account.last_external_id,
      };
      await client.query(local(buildIncrementalSetupSql(hcBound, 'first-instagram', hc)));
      const firstIg = await snapshot(ig.account.id);
      assert.deepEqual(
        {
          status: firstIg.backfill_status,
          cursor: firstIg.backfill_cursor,
          watermark: firstIg.last_item_published_at,
          external: firstIg.last_external_id,
        },
        igHistory,
      );
      assert.ok(Date.parse(firstIg.next_due_at) <= Date.now());
      await client.query(local(buildIncrementalSetupSql(await freshBound(), 'remaining-instagram', hc)));

      const hcOwner = { run_id: '70000000-0000-4000-8000-000000000002', execution_id: '99200' };
      await client.query(
        `insert into pg_temp.m04_runs(id,workflow,platform,mode,env,n8n_execution_id,status,started_at,finished_at)
 values($1,'WF-11','instagram','daily','dev',$2,'success','2026-10-28T00:44:24Z','2026-10-28T00:45:24Z')`,
        [hcOwner.run_id, hcOwner.execution_id],
      );
      await client.query('insert into pg_temp.m04_collector_runs values($1,true)', [hcOwner.run_id]);
      await client.query('insert into pg_temp.m04_collector_accounts values($1,$2)', [
        hcOwner.run_id,
        ig.account.id,
      ]);
      await client.query(
        "insert into pg_temp.m04_run_accounts(run_id,account_id,status) values($1,$2,'success')",
        [hcOwner.run_id, ig.account.id],
      );
      await client.query(
        "insert into pg_temp.m04_launches values($1,'owned-synthetic-actor','1cf8406c-1142-445e-a237-6d0fd7a67b22')",
        [hcOwner.run_id],
      );
      await client.query(
        "update pg_temp.m04_accounts set last_run_id=$1,next_due_at=clock_timestamp()+interval '1 day' where id=$2",
        [hcOwner.run_id, ig.account.id],
      );
      let igCurrent = { ...ig, account: await snapshot(ig.account.id) };
      await client.query(local(buildIncrementalResumeSql(igCurrent, hcOwner, 'daily-due', hc)));
      igCurrent = { ...ig, account: await snapshot(ig.account.id), owner: hcOwner };
      await client.query(local(buildIncrementalRestoreSql(baseline, [igCurrent], hc)));
      const igRestored = await snapshot(ig.account.id);
      assert.equal(igRestored.next_due_at, baseline.find((e) => e.key === ig.key).account.next_due_at);
      assert.equal(igRestored.last_run_id, hcOwner.run_id);
      assert.deepEqual(
        {
          status: igRestored.backfill_status,
          cursor: igRestored.backfill_cursor,
          watermark: igRestored.last_item_published_at,
          external: igRestored.last_external_id,
        },
        igHistory,
      );

      await client.query('savepoint foreign_hc_approval');
      await client.query(
        "update pg_temp.m04_launches set approval_id='123e88b6-5920-4e54-832a-ad6d87c22675' where run_id=$1",
        [hcOwner.run_id],
      );
      await assert.rejects(
        client.query(
          local(buildIncrementalResumeSql({ ...ig, account: igRestored }, hcOwner, 'daily-due', hc)),
        ),
        (error) => error.code === '55000',
      );
      await client.query('rollback to savepoint foreign_hc_approval');
      await client.query('savepoint hc_global_work');
      await client.query(
        "insert into pg_temp.m04_runs(id,workflow,platform,mode,env,status) values('70000000-0000-4000-8000-000000000099','WF-11','instagram','daily','dev','running')",
      );
      await assert.rejects(
        client.query(local(buildIncrementalSetupSql(await freshBound(), 'remaining-instagram', hc))),
        (error) => error.code === '55000',
      );
      await client.query('rollback to savepoint hc_global_work');

      const acceptedOwner = { run_id: '74fae456-a34c-4460-a5ea-6ab66ecec431', execution_id: '31176' };
      const vimeoOriginal = baseline.find((entry) => entry.key === 'C000:vimeo:0');
      await client.query(
        `insert into pg_temp.m04_runs(id,workflow,platform,mode,env,n8n_execution_id,status,started_at,finished_at)
 values($1,'WF-10','vimeo','backfill','dev',$2,'success','2026-10-27T16:08:00Z','2026-10-27T16:08:35Z')`,
        [acceptedOwner.run_id, acceptedOwner.execution_id],
      );
      await client.query('insert into pg_temp.m04_collector_runs values($1,true)', [acceptedOwner.run_id]);
      await client.query('insert into pg_temp.m04_collector_accounts values($1,$2)', [
        acceptedOwner.run_id,
        vimeoOriginal.account.id,
      ]);
      await client.query(
        "insert into pg_temp.m04_run_accounts(run_id,account_id,status) values($1,$2,'success')",
        [acceptedOwner.run_id, vimeoOriginal.account.id],
      );
      await client.query(
        "update pg_temp.m04_accounts set last_run_id=$1,backfill_status='pending',backfill_cursor=null where id=$2",
        [acceptedOwner.run_id, vimeoOriginal.account.id],
      );
      hcBound = await freshBound();
      await client.query('savepoint changed_vimeo_source');
      await client.query("update pg_temp.m04_runs set n8n_execution_id='31177' where id=$1", [
        acceptedOwner.run_id,
      ]);
      await assert.rejects(
        client.query(local(buildIncrementalSetupSql(hcBound, 'vimeo-continuation', hc))),
        (error) => error.code === '55000',
      );
      await client.query('rollback to savepoint changed_vimeo_source');
      await client.query(local(buildIncrementalSetupSql(hcBound, 'vimeo-continuation', hc)));
      const resumedVimeo = await snapshot(vimeoOriginal.account.id);
      assert.deepEqual(resumedVimeo.backfill_cursor, {
        endpoint: 'users',
        resourcePath: '/users/157330576',
        page: 4,
        page_size: 5,
      });
      assert.equal(resumedVimeo.backfill_status, 'pending');
      const newVimeoOwner = { run_id: '70000000-0000-4000-8000-000000000003', execution_id: '99201' };
      await client.query(
        `insert into pg_temp.m04_runs(id,workflow,platform,mode,env,n8n_execution_id,status,started_at,finished_at)
 values($1,'WF-10','vimeo','backfill','dev',$2,'success','2026-10-28T00:44:24Z','2026-10-28T00:45:24Z')`,
        [newVimeoOwner.run_id, newVimeoOwner.execution_id],
      );
      await client.query('insert into pg_temp.m04_collector_runs values($1,true)', [newVimeoOwner.run_id]);
      await client.query('insert into pg_temp.m04_collector_accounts values($1,$2)', [
        newVimeoOwner.run_id,
        vimeoOriginal.account.id,
      ]);
      await client.query(
        "insert into pg_temp.m04_run_accounts(run_id,account_id,status) values($1,$2,'success')",
        [newVimeoOwner.run_id, vimeoOriginal.account.id],
      );
      await client.query(
        `update pg_temp.m04_accounts set last_run_id=$1,backfill_status='running',backfill_cursor='{"endpoint":"users","resourcePath":"/users/157330576","page":5,"page_size":5}' where id=$2`,
        [newVimeoOwner.run_id, vimeoOriginal.account.id],
      );
      await client.query(
        local(
          buildIncrementalRestoreSql(
            baseline,
            [{ ...vimeoOriginal, account: await snapshot(vimeoOriginal.account.id), owner: newVimeoOwner }],
            hc,
          ),
        ),
      );
      const closedVimeo = await snapshot(vimeoOriginal.account.id);
      assert.equal(closedVimeo.backfill_cursor.page, 5);
      assert.equal(closedVimeo.backfill_status, 'running');
      assert.equal(closedVimeo.next_due_at, vimeoOriginal.account.next_due_at);
      assert.equal(closedVimeo.last_item_published_at, vimeoOriginal.account.last_item_published_at);
    } finally {
      try {
        await client.query('rollback');
        assert.deepEqual((await client.query(preservationSql)).rows[0].baseline, preservedBefore);
        assert.equal(
          (await client.query("select to_regclass('pg_temp.m04_accounts') absent")).rows[0].absent,
          null,
        );
      } finally {
        await client.end();
      }
    }
  },
);

class FakeClient extends EventEmitter {
  password = 'synthetic-only';
  connectionParameters = { password: 'synthetic-only' };
  ended = false;
  async connect() {}
  async query(text) {
    assert.equal(typeof text, 'string');
    assert.match(text, /begin;/);
    return [
      { command: 'BEGIN', rows: [] },
      { command: 'SELECT', rows: [{ proof: true }] },
      { command: 'COMMIT', rows: [] },
    ];
  }
  async end() {
    this.ended = true;
  }
}

test('dev Admin config fixes target and strict certificate identity independently of URLs', () => {
  const ca = readFileSync(resolve('scripts/seed/certs/supabase-root-2021.crt'));
  const config = strictAdminConfig('synthetic-only', ca);
  assert.equal(config.host, 'aws-1-eu-central-1.pooler.supabase.com');
  assert.equal(config.port, 5432);
  assert.equal(config.user, 'postgres.zmotjsbzhzjvpelxvxlf');
  assert.equal(config.database, 'postgres');
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.servername, config.host);
  assert.equal(config.ssl.minVersion, 'TLSv1.2');
  assert.equal(typeof config.ssl.checkServerIdentity, 'function');
  assert.throws(
    () => strictAdminConfig('synthetic-only', Buffer.from('untrusted CA')),
    /query_config_blocked/,
  );
});

test('one native simple-protocol call flattens only result rows and closes its client', async () => {
  const client = new FakeClient();
  const result = await executeSimpleQuery(client, 'begin; do $$begin null;end$$;select true proof;commit;');
  assert.deepEqual(result, {
    status: 'query_complete',
    sqlstate: null,
    clientClosed: true,
    rows: [{ proof: true }],
  });
  assert.equal(client.ended, true);
  assert.equal(client.password, undefined);
  assert.equal(client.connectionParameters.password, undefined);
});

test('authorization failure exposes only SQLSTATE and never its raw credential-bearing error', async () => {
  const client = new FakeClient();
  client.query = async () => {
    throw Object.assign(Error('postgresql://private-password@private-host secret-token'), { code: '42501' });
  };
  const result = await executeSimpleQuery(client, 'begin;select 1;commit;');
  assert.deepEqual(result, { status: 'query_failed', sqlstate: '42501', clientClosed: true, rows: [] });
  assert.equal(client.ended, true);
  assert.doesNotMatch(JSON.stringify(result), /private-password|private-host|secret-token/);
});

test('network error details are suppressed and failed client closes', async () => {
  const client = new FakeClient();
  client.connect = async () => {
    throw Object.assign(Error('secret connection diagnostic'), { code: 'ECONNREFUSED' });
  };
  assert.deepEqual(await executeSimpleQuery(client, 'begin;select 1;commit;'), {
    status: 'query_failed',
    sqlstate: null,
    clientClosed: true,
    rows: [],
  });
  assert.equal(client.ended, true);
});

test('query deadline ends the client without retrying SQL', async () => {
  const client = new FakeClient();
  let queries = 0;
  client.query = async () => {
    queries++;
    return await new Promise(() => {});
  };
  const result = await executeSimpleQuery(client, 'begin;select 1;commit;', 20);
  assert.equal(queries, 1);
  assert.equal(client.ended, true);
  assert.equal(result.status, 'query_failed');
  assert.equal(result.clientClosed, true);
});

test('unverified socket closure is reported rather than claimed complete', async () => {
  const client = new FakeClient();
  let destroyed = false;
  client.end = async () => await new Promise(() => {});
  client.connection = {
    stream: {
      destroy() {
        destroyed = true;
      },
    },
  };
  const result = await executeSimpleQuery(client, 'begin;select 1;commit;');
  assert.equal(result.status, 'query_closure_unverified');
  assert.equal(result.clientClosed, false);
  assert.equal(destroyed, true);
  assert.deepEqual(result.rows, []);
});

test(
  'actual public local PostgreSQL accepts the native multi-statement transaction',
  { skip: process.env.EMR_M04_QUERY_LOCAL_TEST !== 'true' },
  async () => {
    // This public local default is never loaded from the persistent dev store.
    const { Client } = createRequire(import.meta.url)(
      resolve('node_modules/.pnpm/pg@8.23.1/node_modules/pg'),
    );
    const client = new Client({
      host: '127.0.0.1',
      port: 60322,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
      ssl: false,
      connectionTimeoutMillis: 3000,
      application_name: 'emr-m04-public-local-contract',
    });
    const result = await executeSimpleQuery(
      client,
      `begin;
set local lock_timeout='5s';set local statement_timeout='25s';
do $m04_identity$ begin
 if current_user<>'postgres' or session_user<>'postgres' or current_database()<>'postgres' then
  raise exception using errcode='42501',message='Local owner identity required';
 end if;
end $m04_identity$;
select current_user::text as current_user,session_user::text as session_user,current_database()::text as database,true as transaction_contract;
rollback;`,
    );
    assert.deepEqual(result, {
      status: 'query_complete',
      sqlstate: null,
      clientClosed: true,
      rows: [
        {
          current_user: 'postgres',
          session_user: 'postgres',
          database: 'postgres',
          transaction_contract: true,
        },
      ],
    });
  },
);
