import assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const path = new URL('../assert/m03_smoke_reactivate_project_verified.sql', import.meta.url);
const competitor = 'd51a39f6-fe87-4d17-aee9-3070c45693aa';
const account = 'bd23314c-591f-4fb7-92fd-b7450634eeb6';
const segment = '20275b22-b7fe-4737-a9a4-c50c2feadb74';
const source = () => readFileSync(path, 'utf8');
const body = () => source().match(/do \$smoke_reactivate\$[\s\S]*?\$smoke_reactivate\$;/)?.[0];
const env = () =>
  Object.fromEntries(
    [
      'PATH',
      'Path',
      'SystemRoot',
      'WINDIR',
      'USERPROFILE',
      'APPDATA',
      'LOCALAPPDATA',
      'TEMP',
      'TMP',
      'DOCKER_CONTEXT',
      'DOCKER_HOST',
    ].flatMap((k) => (process.env[k] === undefined ? [] : [[k, process.env[k]]])),
  );
test('reactivation is fixed-ID/segment, status-only SQL behind owner/context guards', () => {
  const sql = body();
  assert.equal(typeof sql, 'string');
  for (const value of [
    competitor,
    account,
    segment,
    "session_user <> 'postgres'",
    "current_user <> 'postgres'",
    "'archived'",
    "'paused'",
    'pg_advisory_xact_lock',
    'for update',
  ])
    assert.ok(sql.includes(value));
  assert.equal((sql.match(/for update/g) || []).length, 2);
  const statements = sql.replace(/--[^\n]*/g, '');
  assert.equal(/\b(?:delete|truncate|grant|revoke|alter role|create function)\b/i.test(statements), false);
  assert.equal((statements.match(/update app\./g) || []).length, 2);
  assert.equal((statements.match(/set status='active'/g) || []).length, 2);
  assert.ok(sql.indexOf('pg_advisory_xact_lock') < sql.indexOf('select c.* into v_comp'));
});
test('full psql wrapper requires exact source/segment settings and retains explicit rollback mode', () => {
  const sql = source();
  for (const value of [
    '\\set ON_ERROR_STOP on',
    '\\if :{?emr_project_ref}',
    '\\if :{?emr_smoke_reactivation_segment}',
    "set local emr.smoke_project_ref = :'emr_project_ref'",
    "set local emr.smoke_reactivation_segment = :'emr_smoke_reactivation_segment'",
    '\\if :emr_smoke_rollback',
    'rollback;',
    'commit;',
  ])
    assert.ok(sql.includes(value));
});

// Opt-in only. A cached PostgreSQL17 image runs in one disposable network:none
// tmpfs container, with no ports, volumes, project databases or real passwords.
// Competitor/account/audit definitions and enums come verbatim from migrations;
// the other query-only tables are minimal synthetic relational shapes, not a
// full-schema/RLS/advisor/hosted acceptance claim.
describe(
  'isolated PostgreSQL17 project-verified reactivation guards',
  {
    skip: process.env.EMR_M03_PROJECT_VERIFIED_LOCAL_SQL_TEST !== 'true',
  },
  () => {
    const image = 'sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73';
    const name = 'emr-m03-project-reactivate-' + randomUUID();
    let owned = false,
      baseline;
    function docker(args, input, timeout = 15000) {
      const r = spawnSync('docker', args, {
        input,
        env: env(),
        encoding: 'utf8',
        timeout,
        maxBuffer: 1048576,
        windowsHide: true,
      });
      assert.equal(r.error, undefined, 'ISOLATED_DOCKER_PROCESS');
      assert.equal(r.status, 0, 'ISOLATED_DOCKER_NATIVE');
      return r.stdout.trim();
    }
    const psql = (sql) =>
      docker(
        [
          'exec',
          '-i',
          name,
          'psql',
          '-X',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-qAt',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        sql,
      );
    const snapshot = `select jsonb_build_object('database',current_database(),'principal',current_user,'competitors',(select count(*) from app.competitors),'accounts',(select count(*) from app.competitor_accounts),'audit',(select count(*) from ops.audit_log),
    'hash',encode(extensions.digest(jsonb_build_object('c',(select jsonb_agg(to_jsonb(c) order by id) from app.competitors c),'a',(select jsonb_agg(to_jsonb(a) order by id) from app.competitor_accounts a),'audit',(select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l))::text,'sha256'),'hex'));`;
    const settings = `set local search_path=pg_catalog;set local statement_timeout='5s';set local lock_timeout='100ms';set local emr.smoke_project_ref='zmotjsbzhzjvpelxvxlf';set local emr.smoke_reactivation_segment='${segment}';set local emr.smoke_rollback='true';`;
    before(async () => {
      assert.ok(
        !process.env.DOCKER_HOST || /^(?:unix:\/\/\/|npipe:\/\/)/.test(process.env.DOCKER_HOST),
        'LOCAL_DOCKER_ONLY',
      );
      const context = JSON.parse(
        docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']),
      );
      assert.match(context, /^(?:unix:\/\/\/|npipe:\/\/)/);
      assert.equal(docker(['image', 'inspect', '--format', '{{.Id}}', image]), image);
      docker([
        'run',
        '--detach',
        '--pull=never',
        '--name',
        name,
        '--label',
        'emr.m03.owner=project-verified-reactivate-test',
        '--network',
        'none',
        '--memory',
        '256m',
        '--cpus',
        '1',
        '--pids-limit',
        '128',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,nosuid,nodev,size=128m',
        '--env',
        'POSTGRES_HOST_AUTH_METHOD=trust',
        image,
      ]);
      owned = true;
      let ready = false;
      for (let i = 0; i < 40; i++) {
        const r = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], {
          env: env(),
          encoding: 'utf8',
          timeout: 2000,
          windowsHide: true,
        });
        if (r.status === 0) {
          ready = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal(ready, true, 'ISOLATED_POSTGRES_READY');
      const typeSql = readFileSync(
        new URL('../../supabase/migrations/20261017172928_extensions_schemas_roles.sql', import.meta.url),
        'utf8',
      );
      const core = readFileSync(
        new URL('../../supabase/migrations/20261017172931_core_tables.sql', import.meta.url),
        'utf8',
      );
      const auth = readFileSync(
        new URL('../../supabase/migrations/20261017172934_auth_rls_views.sql', import.meta.url),
        'utf8',
      );
      const table = (n) => {
        const match = core.match(
          new RegExp('create table ' + n.replace('.', '\\.') + ' \\([\\s\\S]*?\\n\\);'),
        );
        assert.ok(match, n);
        return match[0];
      };
      const trigger = auth.match(
        /create function private\.competitors_tsv\(\)[\s\S]*?for each row execute function private\.competitors_tsv\(\);/,
      )[0];
      psql(`begin;create schema app;create schema ops;create schema ingest;create schema extensions;create schema private;create schema pgmq;
      create extension pgcrypto with schema extensions;create extension unaccent with schema extensions;
      ${typeSql.match(/create type app\.[\s\S]*?;/g).join('\n')}
      ${table('app.competitors')}${table('app.competitor_accounts')}${table('ops.audit_log')}${trigger}
      create role synthetic_denied;
      create table app.items(id uuid,competitor_id uuid,account_id uuid,locked_fields text[]);
      create table app.campaigns(id uuid,production_competitor_id uuid,locked_by_human boolean);
      create table app.website_pages(account_id uuid,competitor_id uuid);
      create table app.employee_snapshots(account_id uuid,competitor_id uuid);
      create table app.stats_daily(competitor_id uuid);
      create table ops.scrape_runs(id uuid,status text);create table ops.scrape_run_accounts(run_id uuid,account_id uuid);
      create table ops.apify_runs(apify_run_id text,account_ids uuid[],processed_at timestamptz);
      create table ops.cost_ledger(competitor_id uuid,meta jsonb not null default '{}');
      create table ingest.raw_items(account_id uuid);
      ${['q_ai_extract', 'a_ai_extract', 'q_embed', 'a_embed', 'q_media', 'a_media'].map((n) => `create table pgmq.${n}(msg_id bigint,message jsonb);`).join('\n')}
      insert into app.competitors(company_code,slug,name,priority_tier)select 'C'||lpad(n::text,3,'0'),'baseline-'||n,'Synthetic baseline '||n,'adjacent' from generate_series(0,284)n;
      insert into app.competitor_accounts(competitor_id,platform,handle,url,resolve_status)select (select id from app.competitors where company_code='C'||lpad((n%285)::text,3,'0')),'website_work_page','https://baseline'||n||'.example.test','https://baseline'||n||'.example.test','not_needed' from generate_series(1,1754)n;
      insert into app.competitors(id,company_code,slug,name,priority_tier,status,website_url,notes)values('${competitor}','C999','emr-smoke-test','emr-smoke-test','adjacent','archived','https://everyone.film','Owned dev-only M03 foundation smoke fixture; retain all collected data.');
      insert into app.competitor_accounts(id,competitor_id,platform,handle,url,resolve_status,status)values('${account}','${competitor}','website_work_page','https://everyone.film/about-everyone','https://everyone.film/about-everyone','not_needed','paused');
      insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)select 'system','m03_smoke_setup.v1','m03_smoke_fixture_created','competitor',c.id::text,
        jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf','competitor_id',c.id,'account_id',a.id,
          'competitor_identity',to_jsonb(c)-array['status','created_at','updated_at','search_tsv'],
          'account_identity',jsonb_build_object('platform',a.platform,'handle',a.handle,'url',a.url,'external_id',a.external_id,'uploads_playlist_id',a.uploads_playlist_id,'resolve_status',a.resolve_status,'cadence',a.cadence,'backfill_from',a.backfill_from),
          'baseline',jsonb_build_object('competitors',285,'accounts',1754,'competitors_sha256',encode(extensions.digest((select jsonb_agg(to_jsonb(x) order by id)::text from app.competitors x where id<>'${competitor}'),'sha256'),'hex'),
          'accounts_sha256',encode(extensions.digest((select jsonb_agg(to_jsonb(x) order by id)::text from app.competitor_accounts x where competitor_id<>'${competitor}'),'sha256'),'hex')))
        from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where c.id='${competitor}';commit;`);
      const priorSql = readFileSync(
        new URL('../assert/m03_smoke_reactivate_startup.sql', import.meta.url),
        'utf8',
      );
      const teardownSql = readFileSync(new URL('../assert/m03_smoke_teardown.sql', import.meta.url), 'utf8');
      psql(
        '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n\\set emr_smoke_reactivation_segment 1c69c89e-7807-46d5-b7b8-ca28285ff2b4\n' +
          priorSql,
      );
      psql('\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' + teardownSql);
      baseline = JSON.parse(psql(snapshot));
      assert.equal(baseline.competitors, 286);
      assert.equal(baseline.accounts, 1755);
      assert.equal(baseline.audit, 2);
    });
    after(() => {
      if (owned) {
        assert.equal(
          docker(['inspect', '--format', '{{index .Config.Labels "emr.m03.owner"}}', name]),
          'project-verified-reactivate-test',
        );
        docker(['rm', '--force', name]);
        owned = false;
      }
    });
    function runCase(change = '', expected = '55000', verification = '', sql = body()) {
      assert.equal(typeof sql, 'string');
      const result = psql(`begin;${settings}${change}
      do $case$begin begin execute $under_test$${sql}$under_test$;
        ${expected === 'pass' ? 'null;' : "raise exception using errcode='P9999',message='EXPECTED_REACTIVATION_REFUSAL';"}
      exception when others then ${expected === 'pass' ? 'raise;' : `if SQLSTATE<>'${expected}' then raise exception 'UNEXPECTED_REACTIVATION_STATE_%',SQLSTATE;end if;`}end;end;$case$;
      ${verification}rollback;${snapshot}`);
      assert.deepEqual(JSON.parse(result), baseline, 'ROLLBACK_PRESERVES_BASELINE');
    }
    test('exact archived fixture becomes active with one separate audit; only status/normal competitor timestamp changes', () =>
      runCase(
        `create temporary table saved_audits as select to_jsonb(l) as value from ops.audit_log l;create temporary table saved as select to_jsonb(c) as c,to_jsonb(a) as a from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where c.id='${competitor}';`,
        'pass',
        `
    do $verify$begin
      if (select jsonb_agg(value order by value->>'id') from saved_audits) is distinct from
         (select jsonb_agg(to_jsonb(l) order by to_jsonb(l)->>'id') from ops.audit_log l where l.actor_id<>'m03_smoke_reactivate.v1:${segment}') then raise exception 'PRIOR_AUDIT_DRIFT';end if;
      if (select status from app.competitors where id='${competitor}')<>'active' or (select status from app.competitor_accounts where id='${account}')<>'active' then raise exception 'NOT_ACTIVE';end if;
      if (select count(*) from ops.audit_log)<>3 or not exists(select 1 from ops.audit_log where action='m03_smoke_fixture_reactivated' and after->>'segment_id'='${segment}') then raise exception 'AUDIT_MISSING';end if;
      if (select c-array['status','updated_at','search_tsv'] from saved) is distinct from (select to_jsonb(c)-array['status','updated_at','search_tsv'] from app.competitors c where id='${competitor}') or
        (select a-'status' from saved) is distinct from (select to_jsonb(a)-'status' from app.competitor_accounts a where id='${account}') then raise exception 'NON_STATUS_DRIFT';end if;
    end;$verify$;`,
      ));
    test('the preserved prior gate rejects this legitimate two-audit lifecycle', () => {
      const old = readFileSync(
        new URL('../assert/m03_smoke_reactivate_startup.sql', import.meta.url),
        'utf8',
      ).match(/do \$smoke_reactivate\$[\s\S]*?\$smoke_reactivate\$;/)?.[0];
      runCase(
        "set local emr.smoke_reactivation_segment='1c69c89e-7807-46d5-b7b8-ca28285ff2b4';",
        '55000',
        '',
        old,
      );
    });
    test('unrelated audit records are preserved without claiming archive-actor proof', () =>
      runCase(
        "insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id)values('system','unrelated-owner','unrelated','other','unrelated');",
        'pass',
        "do $verify$begin if (select count(*) from ops.audit_log)<>4 or not exists(select 1 from ops.audit_log where actor_id='unrelated-owner') then raise exception 'UNRELATED_AUDIT_LOST';end if;end;$verify$;",
      ));
    const previous = "actor_id='m03_smoke_reactivate.v1:1c69c89e-7807-46d5-b7b8-ca28285ff2b4'";
    const marker = "actor_id='m03_smoke_setup.v1'";
    const cases = [
      ['wrong project', "set local emr.smoke_project_ref='not-dev';", '42501'],
      ['creation audit scalar after', `update ops.audit_log set after='42' where ${marker};`],
      ['creation audit array after', `update ops.audit_log set after='[]' where ${marker};`],
      ['creation audit null after', `update ops.audit_log set after=null where ${marker};`],
      ['prior audit scalar after', `update ops.audit_log set after='42' where ${previous};`],
      ['prior audit null before', `update ops.audit_log set before=null where ${previous};`],
      [
        'future archive timestamp',
        `alter table app.competitors disable trigger user;update app.competitors set updated_at=now()+interval '1 day' where id='${competitor}';`,
      ],

      ['missing prior reactivation audit', `delete from ops.audit_log where ${previous};`],
      [
        'duplicate prior reactivation audit',
        `insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,before,after,created_at)select actor_type,actor_id,action,entity_type,entity_id,before,after,created_at from ops.audit_log where ${previous};`,
      ],
      ['prior audit changed before', `update ops.audit_log set before='{}' where ${previous};`],
      [
        'prior audit extra after key',
        `update ops.audit_log set after=after||'{"extra":true}' where ${previous};`,
      ],
      [
        'prior audit changed creation link',
        `update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}','99999') where ${previous};`,
      ],
      [
        'prior audit changed status',
        `update ops.audit_log set after=jsonb_set(after,'{competitor_status}','"archived"') where ${previous};`,
      ],
      ['prior audit changed actor', `update ops.audit_log set actor_type='n8n' where ${previous};`],
      ['prior audit changed action', `update ops.audit_log set action='unknown' where ${previous};`],
      ['prior audit changed entity', `update ops.audit_log set entity_id='unknown' where ${previous};`],
      [
        'prior audit noncausal timestamp',
        `update ops.audit_log set created_at=(select created_at from ops.audit_log where ${marker}) where ${previous};`,
      ],
      [
        'missing subsequent archive ordering',
        `alter table app.competitors disable trigger user;update app.competitors set updated_at=(select created_at from ops.audit_log where ${previous}) where id='${competitor}';`,
      ],
      [
        'changed competitor creation date',
        `update app.competitors set created_at=created_at-interval '1 day' where id='${competitor}';`,
      ],
      [
        'changed account creation date',
        `update app.competitor_accounts set created_at=created_at-interval '1 day' where id='${account}';`,
      ],
      [
        'changed account update date',
        `update app.competitor_accounts set updated_at=clock_timestamp() where id='${account}';`,
      ],
      ['creation audit changed before', `update ops.audit_log set before='{}' where ${marker};`],
      ['creation audit extra key', `update ops.audit_log set after=after||'{"extra":true}' where ${marker};`],
      [
        'hidden fixture edit reference',
        `insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)values('api_key','edited','other','unrelated',jsonb_build_object('account_id','${account}'));`,
      ],
      [
        'new-segment replay under other entity',
        `insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','m03_smoke_reactivate.v1:${segment}','m03_smoke_fixture_reactivated','other','unrelated','{}');`,
      ],
      [
        'baseline account drift',
        `update app.competitor_accounts set cadence='2 days' where id=(select id from app.competitor_accounts where competitor_id<>'${competitor}' order by id limit 1);`,
      ],
      [
        'fixture campaign',
        `insert into app.campaigns(id,production_competitor_id,locked_by_human)values(gen_random_uuid(),'${competitor}',true);`,
      ],
      [
        'fixture website page',
        `insert into app.website_pages(account_id,competitor_id)values('${account}','${competitor}');`,
      ],
      [
        'fixture employee snapshot',
        `insert into app.employee_snapshots(account_id,competitor_id)values('${account}','${competitor}');`,
      ],
      ['fixture stats', `insert into app.stats_daily(competitor_id)values('${competitor}');`],

      [
        'wrong pending segment',
        "set local emr.smoke_reactivation_segment='00000000-0000-4000-8000-000000000001';",
        '42501',
      ],
      ['wrong principal', 'set local role synthetic_denied;', '42501'],
      [
        'missing exact account',
        `update app.competitor_accounts set id='00000000-0000-4000-8000-000000000002' where id='${account}';`,
      ],
      [
        'namespace collision',
        `update app.competitors set slug='changed' where id='${competitor}';insert into app.competitors(company_code,slug,name,priority_tier)values('C888','emr-smoke-test','collision','adjacent');`,
      ],
      ['missing marker', 'delete from ops.audit_log;'],
      [
        'duplicate marker',
        'insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)select actor_type,actor_id,action,entity_type,entity_id,after from ops.audit_log;',
      ],
      [
        'wrong marker identity',
        `update ops.audit_log set after=jsonb_set(after,'{account_id}','"00000000-0000-4000-8000-000000000002"');`,
      ],
      [
        'competitor identity drift',
        `update app.competitors set notes='human correction' where id='${competitor}';`,
      ],
      [
        'account identity drift',
        `update app.competitor_accounts set cadence='2 days' where id='${account}';`,
      ],
      ['competitor already active', `update app.competitors set status='active' where id='${competitor}';`],
      ['account already active', `update app.competitor_accounts set status='active' where id='${account}';`],
      [
        'human audit',
        `insert into ops.audit_log(actor_type,action,entity_type,entity_id)values('user','edited','account','${account}');`,
      ],
      [
        'API edit audit',
        `insert into ops.audit_log(actor_type,action,entity_type,entity_id)values('api_key','edited','competitor','${competitor}');`,
      ],
      [
        'unrelated system audit',
        `insert into ops.audit_log(actor_type,action,entity_type,entity_id)values('system','unknown','account','${account}');`,
      ],
      [
        'dirty lease',
        `update app.competitor_accounts set locked_until=now()+interval '1 minute' where id='${account}';`,
      ],
      ['dirty progress', `update app.competitor_accounts set last_success_at=now() where id='${account}';`],
      [
        'dirty backfill cursor',
        `update app.competitor_accounts set backfill_cursor='{"next":"synthetic"}' where id='${account}';`,
      ],
      [
        'human-locked item',
        `insert into app.items(id,competitor_id,account_id,locked_fields)values(gen_random_uuid(),'${competitor}','${account}',array['title']);`,
      ],
      ['raw content', `insert into ingest.raw_items(account_id)values('${account}');`],
      ['unknown scrape run', 'insert into ops.scrape_runs(id)values(gen_random_uuid());'],
      [
        'registered actor',
        `insert into ops.apify_runs(apify_run_id,account_ids)values('SyntheticOriginal',array['${account}'::uuid]);`,
      ],
      ['fixture cost', `insert into ops.cost_ledger(competitor_id)values('${competitor}');`],
      ['live queue', `insert into pgmq.q_ai_extract(msg_id,message)values(1,'{}');`],
      ['archived queue', `insert into pgmq.a_media(msg_id,message)values(1,'{}');`],
      [
        'unrelated baseline drift',
        "update app.competitors set name='changed baseline' where company_code='C000';",
      ],
    ];
    for (const [name, sql, state] of cases)
      test('rejects ' + name + ' and rolls back without reactivation', () => runCase(sql, state ?? '55000'));
    test('same-segment second attempt refuses rather than duplicating reactivation or creation history', () =>
      runCase(body(), '55000'));
    test('full psql wrapper returns the same eight-field receipt then rolls back all table changes', () => {
      const result = docker(
        [
          'exec',
          '-i',
          name,
          'psql',
          '-X',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-qAt',
          '-v',
          'ON_ERROR_STOP=1',
          '-v',
          'emr_project_ref=zmotjsbzhzjvpelxvxlf',
          '-v',
          'emr_smoke_reactivation_segment=' + segment,
          '-v',
          'emr_smoke_rollback=true',
        ],
        source(),
      );
      const lines = result.split(/\r?\n/);
      const receipt = JSON.parse(lines[0]);
      assert.equal(Object.keys(receipt).length, 8);
      assert.equal(receipt.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(receipt.competitor_id, competitor);
      assert.equal(receipt.account_id, account);
      assert.equal(receipt.competitor_status, 'active');
      assert.equal(receipt.account_status, 'active');
      assert.equal(lines[1], 'M03_SMOKE_REACTIVATION_ROLLED_BACK_NOT_HOSTED_ACCEPTANCE');
      assert.deepEqual(JSON.parse(psql(snapshot)), baseline);
    });
    test('a concurrent audit writer refuses before partial fixture updates', async () => {
      const child = spawn(
        'docker',
        [
          'exec',
          '-i',
          name,
          'psql',
          '-X',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-qAt',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        { env: env(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
      );
      child.stderr.resume();
      const ready = new Promise((resolve, reject) => {
        let text = '';
        child.stdout.on('data', (bytes) => {
          text += bytes;
          if (text.includes('AUDIT_WRITER_HELD')) resolve();
        });
        child.on('error', reject);
        setTimeout(() => reject(Error('LOCAL_AUDIT_BARRIER')), 5000).unref();
      });
      const closed = new Promise((resolve, reject) => {
        child.on('close', (code) => (code === 0 ? resolve() : reject(Error('LOCAL_AUDIT_CHILD'))));
        child.on('error', reject);
      });
      child.stdin.end(
        "begin;update ops.audit_log set action=action;select 'AUDIT_WRITER_HELD';select pg_sleep(1);rollback;",
      );
      await ready;
      try {
        runCase('', '55P03');
      } finally {
        await closed;
      }
      assert.deepEqual(JSON.parse(psql(snapshot)), baseline);
    });
    test('a foreign row lock refuses within the local lock budget without partial updates', async () => {
      const child = spawn(
        'docker',
        [
          'exec',
          '-i',
          name,
          'psql',
          '-X',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-qAt',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        { env: env(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
      );
      const ready = new Promise((resolve, reject) => {
        let text = '';
        child.stdout.on('data', (b) => {
          text += b;
          if (text.includes('ROW_LOCK_HELD')) resolve();
        });
        child.on('error', reject);
        setTimeout(() => reject(Error('LOCAL_LOCK_BARRIER')), 5000).unref();
      });
      child.stdin.end(
        `begin;select id from app.competitors where id='${competitor}' for update;select 'ROW_LOCK_HELD';select pg_sleep(1);rollback;`,
      );
      const closed = new Promise((resolve, reject) => {
        child.on('close', (c) => (c === 0 ? resolve() : reject(Error('LOCAL_LOCK_CHILD'))));
        child.on('error', reject);
      });
      await ready;
      try {
        runCase('', '55P03');
      } finally {
        await closed;
      }
      assert.deepEqual(JSON.parse(psql(snapshot)), baseline);
    });
  },
);
