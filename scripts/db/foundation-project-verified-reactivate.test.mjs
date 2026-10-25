import assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const path = new URL('../assert/m03_smoke_reactivate_project_verified.sql', import.meta.url);
const competitor = 'd51a39f6-fe87-4d17-aee9-3070c45693aa';
const account = 'bd23314c-591f-4fb7-92fd-b7450634eeb6';
const segment = '20275b22-b7fe-4737-a9a4-c50c2feadb74';
const auditSegment = segment + ':technical-2';
const source = () => readFileSync(path, 'utf8');
const body = () => source().match(/do \$smoke_reactivate\$[\s\S]*?\$smoke_reactivate\$;/)?.[0];
function nativeArchiveBody() {
  const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
  const consumer = fileURLToPath(new URL('./windows/Invoke-M03FoundationMigrations.ps1', import.meta.url));
  const control = fileURLToPath(new URL('./windows/Foundation-AdminControl.ps1', import.meta.url));
  const code = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
$repo=${quote(process.cwd())};$PostcheckContinuation=$false;$RemainingContinuation=$false;$StartupReplacement=$false;$ProjectVerifiedContinuation=$false
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
foreach($entry in @(@{File=${quote(control)};Names=@('Foundation-Literal','Foundation-FixtureSql')},@{File=${quote(consumer)};Names=@('Foundation-ArchiveFixtureSql')})){
 $errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($entry.File,[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'ARCHIVE_SOURCE_PARSE'}
 foreach($name in $entry.Names){$matches=@($ast.FindAll({param($item)$item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true));if($matches.Count -ne 1){throw 'ARCHIVE_SOURCE_FUNCTION'};Invoke-Expression $matches[0].Extent.Text}
}
$expected=[pscustomobject]@{audience='https://everyone-market-researcher-synthetic.vercel.app';commitSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';deploymentId='dpl_synthetic';closedAt='2026-10-23T16:25:54.94722+00:00'}
Write-Output (Foundation-ArchiveFixtureSql $expected)
`;
  const result = spawnSync(
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')],
    { env: env(), encoding: 'utf8', timeout: 15000, windowsHide: true, maxBuffer: 131072 },
  );
  assert.equal(result.status, 0, 'NATIVE_ARCHIVE_CONVERTER');
  assert.equal(result.stderr, '');
  return result.stdout.trim();
}
function nativeTechnical14ReadbackQuery(ordinal = 14) {
  const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
  const consumer = fileURLToPath(new URL('./windows/Invoke-M03FoundationMigrations.ps1', import.meta.url));
  const control = fileURLToPath(new URL('./windows/Foundation-AdminControl.ps1', import.meta.url));
  const code = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
foreach($entry in @(@{File=${quote(control)};Names=@('Foundation-Literal','Foundation-ForwardWindowId','Read-FoundationProjectVerifiedContinuationReactivatedFixture')},@{File=${quote(consumer)};Names=@('Foundation-Technical13AuditPredicate')})){
 $errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($entry.File,[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'READBACK_SOURCE_PARSE'}
 foreach($name in $entry.Names){$matches=@($ast.FindAll({param($item)$item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -ceq $name},$true));if($matches.Count -ne 1){throw 'READBACK_SOURCE_FUNCTION'};Invoke-Expression $matches[0].Extent.Text}
}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$projectVerifiedForwardWindowId='${[20, 21].includes(ordinal) ? 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a' : [17, 18, 19].includes(ordinal) ? 'edbc6d11-7c1f-43a7-b745-1ded06deb29f' : '4c602549-2c42-4ec3-9328-714d7cb66a77'}';$projectVerifiedForwardSource='${[20, 21].includes(ordinal) ? '5f256ce915f930481b0d31ac38b919c0a7692cd1' : [17, 18, 19].includes(ordinal) ? 'effa3de9e1fee6c3f3c08fc347a5e3175db14c80' : '5087d4d93d2f6ffdca0bc0096b365723005446fc'}';$script:captured=$null
function Foundation-ProjectVerifiedTechnicalIdentity{return [pscustomobject]@{ordinal=${ordinal};auditSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-${ordinal}'}}
function Read-FoundationTechnical14NoAdmin{return '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
function Invoke-FoundationQuery($Sql,$Field){if($Field -cne 'fixture'){throw 'READBACK_FIELD'};$script:captured=$Sql;throw 'READBACK_CAPTURED'}
try{$null=Read-FoundationProjectVerifiedContinuationReactivatedFixture}catch{if($_.Exception.Message -cne 'READBACK_CAPTURED'){throw}}
if($script:captured -isnot [string]){throw 'READBACK_NOT_CAPTURED'};Write-Output $script:captured
`;
  const result = spawnSync(
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')],
    { env: env(), encoding: 'utf8', timeout: 15000, windowsHide: true, maxBuffer: 131072 },
  );
  assert.equal(result.status, 0, 'NATIVE_TECHNICAL14_READBACK');
  assert.equal(result.stderr, '');
  return result.stdout.trim();
}
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
    const settings = `set local search_path=pg_catalog;set local statement_timeout='5s';set local lock_timeout='100ms';set local emr.smoke_project_ref='zmotjsbzhzjvpelxvxlf';set local emr.smoke_reactivation_segment='${segment}';set local emr.smoke_technical_ordinal='2';set local emr.smoke_rollback='true';`;
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
      const gateway = readFileSync(
        new URL('../../supabase/migrations/20261018232014_m03_foundation_gateway.sql', import.meta.url),
        'utf8',
      );
      const boundary = readFileSync(
        new URL(
          '../../supabase/migrations/20261018233338_m03_foundation_boundary_hardening.sql',
          import.meta.url,
        ),
        'utf8',
      );
      const gatewayTable = (n) => {
        const match = gateway.match(new RegExp('create table ops\\.' + n + ' \\([\\s\\S]*?\\n\\);'));
        assert.ok(match, n);
        return match[0];
      };
      const gatewayFunction = (sql, n) => {
        const match = sql.match(
          new RegExp('create (?:or replace )?function ops\\.' + n + '\\([\\s\\S]*?\\n\\$\\$;'),
        );
        assert.ok(match, n);
        return match[0];
      };
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
      create role synthetic_denied;create role n8n_writer login;
      create table app.items(id uuid,competitor_id uuid,account_id uuid,locked_fields text[]);
      create table app.campaigns(id uuid,production_competitor_id uuid,locked_by_human boolean);
      create table app.website_pages(account_id uuid,competitor_id uuid);
      create table app.employee_snapshots(account_id uuid,competitor_id uuid);
      create table app.stats_daily(competitor_id uuid);
      create table ops.scrape_runs(id uuid,status text);create table ops.scrape_run_accounts(run_id uuid,account_id uuid);
      create table ops.apify_runs(apify_run_id text,account_ids uuid[],processed_at timestamptz);
      create table ops.cost_ledger(competitor_id uuid,meta jsonb not null default '{}',cost_usd numeric not null default 0);
      ${gatewayTable('foundation_gateway_rate_windows')}
      ${gatewayTable('foundation_gateway_requests')}
      ${gatewayTable('foundation_gateway_leases')}
      create table ops.apify_launch_approvals(window_id uuid,closed_at timestamptz,expires_at timestamptz,actor_build text,max_total_charge_usd numeric,batch_max_usd numeric);
      create table ops.apify_launch_admissions(window_id uuid);
      ${gatewayFunction(gateway, 'foundation_gateway_response')}
      ${gatewayFunction(boundary, 'foundation_gateway_validate')}
      ${gatewayFunction(boundary, 'foundation_gateway_admit')}
      revoke all on function ops.foundation_gateway_response(uuid,text,text,text,jsonb,boolean),ops.foundation_gateway_validate(uuid,uuid,text,jsonb),ops.foundation_gateway_admit(uuid,uuid,text,jsonb,text) from public;
      grant usage on schema ops to n8n_writer;
      grant execute on function ops.foundation_gateway_admit(uuid,uuid,text,jsonb,text) to n8n_writer;
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
      // Actually execute the successful original20275 reactivation and archive
      // before testing its technical continuation. Do not fabricate a prior audit.
      psql(
        '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n\\set emr_smoke_reactivation_segment ' +
          segment +
          '\n' +
          source(),
      );
      psql('\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' + teardownSql);
      baseline = JSON.parse(psql(snapshot));
      assert.equal(baseline.competitors, 286);
      assert.equal(baseline.accounts, 1755);
      assert.equal(baseline.audit, 3);
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
    test('fixed reconciliation SELECT executes under PostgreSQL READ ONLY and leaves the actual baseline unchanged', () => {
      const inspection = readFileSync(new URL('./foundation-inspect.sql', import.meta.url), 'utf8');
      assert.equal(
        /\b(?:insert|update|delete|truncate|alter|grant|revoke|call|do)\b/i.test(
          inspection.replace(/--[^\n]*/g, ''),
        ),
        false,
      );
      const result = psql(`begin read only;${inspection}rollback;${snapshot}`).split('\n');
      const value = JSON.parse(result[0]);
      assert.equal(value.kind, 'm03_foundation_inspection');
      assert.equal(value.identity, true);
      assert.equal(value.window, null);
      assert.equal(value.approval, null);
      assert.equal(value.requestCount, 0);
      assert.equal(value.costUsd, 0);
      assert.equal(value.fixture.competitorArchived, true);
      assert.equal(value.audits.creationCount, 1);
      assert.equal(value.audits.technical2Count, 0);
      assert.deepEqual(JSON.parse(result.at(-1)), baseline);
      // This is an actual server SQLSTATE assertion, not a generic failure.
      psql(
        `begin read only;do $deny$begin begin update app.competitors set name=name;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'25006' then raise exception 'WRONG_READ_ONLY_DENIAL';end if;end;end;$deny$;rollback;`,
      );
      assert.deepEqual(JSON.parse(psql(snapshot)), baseline);
    });
    test('actual restricted writer session closes the fixed window once; owner SET ROLE is denied by SQLSTATE42501', () => {
      const windowId = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
      const rpc = (mode) =>
        `ops.foundation_gateway_admit('${windowId}','00000000-0000-4000-8000-000000000021','identity.read','{}','${mode}')`;
      for (const expired of [false, true]) {
        const starts = expired
          ? "transaction_timestamp()-interval '61 minutes'"
          : "transaction_timestamp()-interval '1 minute'";
        const expires = expired
          ? "transaction_timestamp()-interval '1 minute'"
          : "transaction_timestamp()+interval '59 minutes'";
        psql(`insert into ops.foundation_gateway_rate_windows(namespace,window_id,project_ref,environment,bound_audience,bound_commit_sha,bound_deployment_id,starts_at,expires_at,admitted_count)values('m03-foundation-dev','${windowId}','zmotjsbzhzjvpelxvxlf','dev','https://everyone-market-researcher-synthetic.vercel.app','f42930f90c2de43c84f61ad6d966d0ee6074d70e','dpl_synthetic',${starts},${expires},1);
      insert into ops.apify_launch_approvals(window_id,expires_at,actor_build,max_total_charge_usd,batch_max_usd) values('${windowId}',${expires},'0.3.99',1,2);
      insert into ops.foundation_gateway_leases(window_id,slot) values('${windowId}',1),('${windowId}',2);`);
        try {
          psql(`do $deny$begin begin perform ${rpc('close')};raise exception using errcode='P9999';exception when others then if SQLSTATE<>'42501' then raise exception 'OWNER_IDENTITY_DENIAL_WRONG';end if;end;end;$deny$;
        begin;set local role n8n_writer;do $deny$begin begin perform ${rpc('close')};raise exception using errcode='P9999';exception when others then if SQLSTATE<>'42501' then raise exception 'SET_ROLE_IDENTITY_DENIAL_WRONG';end if;end;end;$deny$;rollback;`);
          const writer = docker(
            [
              'exec',
              '-i',
              name,
              'psql',
              '-X',
              '-U',
              'n8n_writer',
              '-d',
              'postgres',
              '-qAt',
              '-v',
              'ON_ERROR_STOP=1',
            ],
            `begin;
        select jsonb_build_object('currentUser',current_user,'sessionUser',session_user,'control',${rpc('inspect')});
        do $deny$begin begin update ops.foundation_gateway_rate_windows set admitted_count=admitted_count;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'42501' then raise exception 'DIRECT_WRITER_DML_DENIAL_WRONG';end if;end;end;$deny$;
        select ${rpc('close')};select ${rpc('close')};select ${rpc('inspect')};commit;`,
          )
            .split('\n')
            .map((line) => JSON.parse(line));
          assert.equal(writer[0].currentUser, 'n8n_writer');
          assert.equal(writer[0].sessionUser, 'n8n_writer');
          assert.equal(writer[0].control.window.totalAdmitted, 1);
          assert.equal(writer[0].control.window.closed, expired);
          assert.equal(writer[0].control.state, expired ? 'closed' : 'admitted');
          assert.equal(writer[0].control.code, expired ? 'window_expired' : null);
          for (const close of writer.slice(1)) {
            assert.equal(close.state, 'closed');
            assert.equal(close.code, 'window_closed');
            assert.equal(close.window.closed, true);
            assert.equal(close.window.totalAdmitted, 2);
          }
          const owner = JSON.parse(
            psql(
              `select jsonb_build_object('count',admitted_count,'closeCount',close_count,'closed',closed_at is not null,'approvalClosed',(select closed_at is not null from ops.apify_launch_approvals where window_id='${windowId}')) from ops.foundation_gateway_rate_windows where window_id='${windowId}';`,
            ),
          );
          assert.deepEqual(owner, { count: 2, closeCount: 1, closed: true, approvalClosed: true });
        } finally {
          psql(
            `delete from ops.foundation_gateway_leases where window_id='${windowId}';delete from ops.apify_launch_approvals where window_id='${windowId}';delete from ops.foundation_gateway_rate_windows where window_id='${windowId}';`,
          );
        }
      }
      assert.deepEqual(JSON.parse(psql(snapshot)), baseline);
    });
    test('exact archived fixture becomes active with one separate audit; only status/normal competitor timestamp changes', () =>
      runCase(
        `create temporary table saved_audits as select to_jsonb(l) as value from ops.audit_log l;create temporary table saved as select to_jsonb(c) as c,to_jsonb(a) as a from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where c.id='${competitor}';`,
        'pass',
        `
    do $verify$begin
      if (select jsonb_agg(value order by value->>'id') from saved_audits) is distinct from
         (select jsonb_agg(to_jsonb(l) order by to_jsonb(l)->>'id') from ops.audit_log l where l.actor_id<>'m03_smoke_reactivate.v1:${auditSegment}') then raise exception 'PRIOR_AUDIT_DRIFT';end if;
      if (select status from app.competitors where id='${competitor}')<>'active' or (select status from app.competitor_accounts where id='${account}')<>'active' then raise exception 'NOT_ACTIVE';end if;
      if (select count(*) from ops.audit_log)<>4 or not exists(select 1 from ops.audit_log where action='m03_smoke_fixture_reactivated' and after->>'segment_id'='${auditSegment}') then raise exception 'AUDIT_MISSING';end if;
      if (select c-array['status','updated_at','search_tsv'] from saved) is distinct from (select to_jsonb(c)-array['status','updated_at','search_tsv'] from app.competitors c where id='${competitor}') or
        (select a-'status' from saved) is distinct from (select to_jsonb(a)-'status' from app.competitor_accounts a where id='${account}') then raise exception 'NON_STATUS_DRIFT';end if;
    end;$verify$;`,
      ));
    test('the preserved prior gate rejects this legitimate three-audit lifecycle', () => {
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
        "do $verify$begin if (select count(*) from ops.audit_log)<>5 or not exists(select 1 from ops.audit_log where actor_id='unrelated-owner') then raise exception 'UNRELATED_AUDIT_LOST';end if;end;$verify$;",
      ));
    const previous = "actor_id='m03_smoke_reactivate.v1:1c69c89e-7807-46d5-b7b8-ca28285ff2b4'";
    const marker = "actor_id='m03_smoke_setup.v1'";
    const cases = [
      ['wrong project', "set local emr.smoke_project_ref='not-dev';", '42501'],
      [
        'missing intermediate original20275 audit',
        `delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}';`,
      ],
      [
        'changed intermediate original20275 audit',
        `update ops.audit_log set after=after||'{"extra":true}' where actor_id='m03_smoke_reactivate.v1:${segment}';`,
      ],
      [
        'duplicate intermediate original20275 audit',
        `insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,before,after,created_at)select actor_type,actor_id,action,entity_type,entity_id,before,after,created_at from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}';`,
      ],
      [
        'partial future technical actor audit under another entity',
        `insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','m03_smoke_reactivate.v1:${segment}:technical-3','unknown','other','unrelated','{}');`,
      ],
      [
        'partial future technical segment audit under another actor',
        `insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','other','unknown','other','unrelated',jsonb_build_object('segment_id','${segment}:technical-3'));`,
      ],
      ['skipped technical ordinal', "set local emr.smoke_technical_ordinal='3';"],
      ['noncanonical technical ordinal', "set local emr.smoke_technical_ordinal='02';", '22023'],
      ['malformed technical ordinal', "set local emr.smoke_technical_ordinal='not-an-ordinal';", '22023'],
      ['zero technical ordinal', "set local emr.smoke_technical_ordinal='0';", '22023'],
      ['unbounded technical ordinal', "set local emr.smoke_technical_ordinal='1024';", '22023'],
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
        `insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','m03_smoke_reactivate.v1:${auditSegment}','m03_smoke_fixture_reactivated','other','unrelated','{}');`,
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
          'emr_smoke_technical_ordinal=2',
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
    test('a later technical attempt requires the actually committed contiguous audit chain and preserves it', () => {
      const wrapper =
        '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n\\set emr_smoke_reactivation_segment ' + segment + '\n';
      psql(wrapper + '\\set emr_smoke_technical_ordinal 2\n' + source());
      psql(
        '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' +
          readFileSync(new URL('../assert/m03_smoke_teardown.sql', import.meta.url), 'utf8'),
      );
      const afterSecond = JSON.parse(psql(snapshot));
      assert.equal(afterSecond.audit, 4);
      psql(`begin;${settings}set local emr.smoke_technical_ordinal='3';${body()}
        do $verify$begin if (select count(*) from ops.audit_log)<>5 or not exists(select 1 from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-3') then raise exception 'CONTIGUOUS_TECHNICAL_AUDIT_MISSING';end if;end;$verify$;rollback;`);
      assert.deepEqual(JSON.parse(psql(snapshot)), afterSecond);
    });
    test('ordinal9 preserves the actual four-audit lifecycle across closed attempts3to8 and rejects any unexpected gap audit', () => {
      const wrapper =
        '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n\\set emr_smoke_reactivation_segment ' + segment + '\n';
      const technical2 = Number(
        psql(`select count(*) from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${auditSegment}';`),
      );
      assert.ok(technical2 === 0 || technical2 === 1);
      if (technical2 === 0) {
        psql(wrapper + '\\set emr_smoke_technical_ordinal 2\n' + source());
        psql(
          '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' +
            readFileSync(new URL('../assert/m03_smoke_teardown.sql', import.meta.url), 'utf8'),
        );
      }
      const before = JSON.parse(psql(snapshot));
      assert.equal(before.audit, 4);
      psql(`begin;${settings}set local emr.smoke_technical_ordinal='9';
        create temporary table retained_audits as select to_jsonb(l) as value from ops.audit_log l;
        ${body()}
        do $verify$begin
          if (select status from app.competitors where id='${competitor}')<>'active' or (select status from app.competitor_accounts where id='${account}')<>'active'
            or (select count(*) from ops.audit_log)<>5 or not exists(select 1 from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-9') then raise exception 'NEW_FIXTURE_AUDIT_NOT_EXACT';end if;
          if (select jsonb_agg(value order by value->>'id') from retained_audits) is distinct from
            (select jsonb_agg(to_jsonb(l) order by to_jsonb(l)->>'id') from ops.audit_log l where actor_id<>'m03_smoke_reactivate.v1:${segment}:technical-9') then raise exception 'PRIOR_AUDIT_DRIFT';end if;
          if exists(select 1 from ops.audit_log where actor_id in (${[3, 4, 5, 6, 7, 8].map((n) => `'m03_smoke_reactivate.v1:${segment}:technical-${n}'`).join(',')})) then raise exception 'CLOSED_ATTEMPT_AUDIT_FABRICATED';end if;
        end;$verify$;rollback;`);
      assert.deepEqual(JSON.parse(psql(snapshot)), before);
      for (const ordinal of [3, 4, 5, 6, 7, 8]) {
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='9';
          insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,before,after)
            select actor_type,'m03_smoke_reactivate.v1:${segment}:technical-${ordinal}',action,entity_type,entity_id,before,jsonb_set(after,'{segment_id}',to_jsonb('${segment}:technical-${ordinal}'::text))
            from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${auditSegment}';
          do $deny$begin begin execute $under_test$${body()}$under_test$;
            raise exception using errcode='P9999',message='UNKNOWN_GAP_AUDIT_ACCEPTED';
          exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'GAP_DENIAL_NOT_EXACT';end if;end;end;$deny$;rollback;`);
        assert.deepEqual(JSON.parse(psql(snapshot)), before);
      }
      // Only the known closed3..11 gap is covered. A missing successful
      // technical12 lifecycle is still a denial at a later ordinal.
      psql(`begin;${settings}set local emr.smoke_technical_ordinal='13';do $deny$begin begin execute $under_test$${body()}$under_test$;
        raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED' then raise exception 'UNKNOWN_LATER_GAP_ACCEPTED';end if;end;end;$deny$;rollback;`);
      assert.deepEqual(JSON.parse(psql(snapshot)), before);
    });

    test('ordinals10to12 skip only proven no-reactivation gaps, preserve prior audits and require technical12 before13', () => {
      const wrapper =
        '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n\\set emr_smoke_reactivation_segment ' + segment + '\n';
      const technical2 = Number(
        psql(`select count(*) from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${auditSegment}';`),
      );
      if (technical2 === 0) {
        psql(wrapper + '\\set emr_smoke_technical_ordinal 2\n' + source());
        psql(
          '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' +
            readFileSync(new URL('../assert/m03_smoke_teardown.sql', import.meta.url), 'utf8'),
        );
      }
      const before = JSON.parse(psql(snapshot));
      assert.equal(before.audit, 4);
      for (const ordinal of [10, 11, 12]) {
        const outcome = JSON.parse(
          psql(`begin;${settings}set local emr.smoke_technical_ordinal='${ordinal}';
        create temporary table retained_audits as select to_jsonb(l) as value from ops.audit_log l;
        create temporary table reactivation_outcome(state text,message text);
        do $case$begin begin execute $under_test$${body()}$under_test$;
          insert into reactivation_outcome values('00000',null);
        exception when others then insert into reactivation_outcome values(SQLSTATE,SQLERRM);end;end;$case$;
        select jsonb_build_object('state',o.state,'message',o.message,
          'competitor_active',(select status='active' from app.competitors where id='${competitor}'),
          'account_active',(select status='active' from app.competitor_accounts where id='${account}'),
          'audit_count',(select count(*) from ops.audit_log),
          'prior_audits_preserved',(select jsonb_agg(value order by value->>'id') from retained_audits) is not distinct from
            (select jsonb_agg(to_jsonb(l) order by to_jsonb(l)->>'id') from ops.audit_log l where actor_id<>'m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'),
          'gap_audits_absent',not exists(select 1 from ops.audit_log where actor_id in (${Array.from(
            { length: ordinal - 3 },
            (_, i) => i + 3,
          )
            .map((n) => `'m03_smoke_reactivate.v1:${segment}:technical-${n}'`)
            .join(',')})))
          from reactivation_outcome o;rollback;`),
        );
        assert.deepEqual(outcome, {
          state: '00000',
          message: null,
          competitor_active: true,
          account_active: true,
          audit_count: 5,
          prior_audits_preserved: true,
          gap_audits_absent: true,
        });
        assert.deepEqual(JSON.parse(psql(snapshot)), before);
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='${ordinal}';
        insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,before,after)
          select actor_type,'m03_smoke_reactivate.v1:${segment}:technical-${ordinal - 1}',action,entity_type,entity_id,before,jsonb_set(after,'{segment_id}',to_jsonb('${segment}:technical-${ordinal - 1}'::text))
          from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${auditSegment}';
        do $deny$begin begin execute $under_test$${body()}$under_test$;
          raise exception using errcode='P9999',message='UNEXPECTED_NINTH_AUDIT_ACCEPTED';
        exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'NINTH_AUDIT_DENIAL_NOT_EXACT';end if;end;end;$deny$;rollback;`);
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='13';
        do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';
        exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED' then raise exception 'UNPROVEN_TENTH_LIFECYCLE_ACCEPTED';end if;end;end;$deny$;rollback;`);
        assert.deepEqual(JSON.parse(psql(snapshot)), before);
      }
    });

    test('native converted archive preserves data and refuses changed closure, work or audit state before status updates', () => {
      const archive = nativeArchiveBody();
      const saved = JSON.parse(psql(snapshot));
      const window = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
      const setup = `begin;update app.competitors set status='active' where id='${competitor}';update app.competitor_accounts set status='active' where id='${account}';
      insert into ops.foundation_gateway_rate_windows(namespace,window_id,project_ref,environment,bound_audience,bound_commit_sha,bound_deployment_id,starts_at,expires_at,closed_at,admitted_count,close_count)values('m03-foundation-dev','${window}','zmotjsbzhzjvpelxvxlf','dev','https://everyone-market-researcher-synthetic.vercel.app','f42930f90c2de43c84f61ad6d966d0ee6074d70e','dpl_synthetic','2026-10-23T15:47:55.265665+00:00','2026-10-23T16:47:55.265665+00:00','2026-10-23T16:25:54.94722+00:00',2,1);
      insert into ops.apify_launch_approvals(window_id,closed_at,expires_at,actor_build,max_total_charge_usd,batch_max_usd)values('${window}','2026-10-23T16:25:54.94722+00:00','2026-10-23T16:47:55.265665+00:00','0.3.99',1,2);
      insert into ops.foundation_gateway_leases(window_id,slot)values('${window}',1),('${window}',2);
      insert into ops.foundation_gateway_requests(window_id,request_id,operation,payload_sha256,state,lease_expires_at,completed_at,result)values('${window}','00000000-0000-4000-8000-000000000001','identity.read',repeat('0',64),'completed',clock_timestamp(),clock_timestamp(),'{}');`;
      const changes = [
        ['pass', ''],
        ['55000', `update ops.foundation_gateway_rate_windows set closed_at=null,close_count=0;`],
        ['55000', `update ops.foundation_gateway_rate_windows set bound_deployment_id='dpl_other';`],
        [
          '55000',
          `update ops.foundation_gateway_requests set state='reserved',completed_at=null,result=null;`,
        ],
        [
          '55000',
          `insert into ops.apify_runs(apify_run_id,account_ids)values('synthetic',array['${account}'::uuid]);`,
        ],
        [
          '55000',
          `insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id)values('user','synthetic-human','edit','competitor','${competitor}');`,
        ],
      ];
      for (const [expected, change] of changes) {
        const verify =
          expected === 'pass'
            ? `if (select status from app.competitors where id='${competitor}')<>'archived' or (select status from app.competitor_accounts where id='${account}')<>'paused' or (select count(*) from ops.audit_log)<>4 or (select count(*) from app.items)<>0 then raise exception 'ARCHIVE_EXPECTATION';end if;`
            : 'null;';
        const result = psql(
          `${setup}${change}do $archive_case$begin begin execute $archive_body$${archive}$archive_body$;${expected === 'pass' ? 'null;' : "raise exception using errcode='P9999';"}exception when others then ${expected === 'pass' ? 'raise;' : `if SQLSTATE<>'${expected}' then raise exception 'ARCHIVE_DENIAL_STATE_%',SQLSTATE;end if;`}end;${verify}end;$archive_case$;rollback;${snapshot}`,
        );
        assert.deepEqual(JSON.parse(result), saved, 'ARCHIVE_ROLLBACK_PRESERVES_ALL_DATA');
      }
    });

    test('technical13 and14 require typed prior audits and qualified15to21 skip only proven absent audits', () => {
      const wrapper =
        '\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n\\set emr_smoke_reactivation_segment ' + segment + '\n';
      const teardown = readFileSync(new URL('../assert/m03_smoke_teardown.sql', import.meta.url), 'utf8');
      if (
        Number(
          psql(
            `select count(*) from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${auditSegment}';`,
          ),
        ) === 0
      ) {
        psql(wrapper + '\\set emr_smoke_technical_ordinal 2\n' + source());
        psql('\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' + teardown);
      }
      assert.equal(
        Number(
          psql(
            `select count(*) from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${auditSegment}';`,
          ),
        ),
        1,
        'actual technical2 lifecycle exists',
      );
      const before = JSON.parse(psql(snapshot));
      psql(`begin;${settings}set local emr.smoke_technical_ordinal='13';do $deny$begin begin execute $under_test$${body()}$under_test$;
      raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED' then raise exception 'MISSING_TECHNICAL12_NOT_DENIED';end if;end;end;$deny$;rollback;`);
      assert.deepEqual(JSON.parse(psql(snapshot)), before);
      // Execute the actual12 mutation and real status-only archive in distinct
      // transactions so their native audit/timestamp lifecycle is preserved.
      psql(wrapper + '\\set emr_smoke_technical_ordinal 12\n' + source());
      psql('\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' + teardown);
      const afterTwelve = JSON.parse(psql(snapshot));
      assert.equal(afterTwelve.audit, before.audit + 1);
      const twelveActor = 'm03_smoke_reactivate.v1:' + segment + ':technical-12';
      const prior = psql('select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l;');
      const output = JSON.parse(
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='13';${body()}
      select jsonb_build_object('auditCount',(select count(*) from ops.audit_log),'newAudit',(select count(*)=1 from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-13'),
       'gapAbsent',not exists(select 1 from ops.audit_log where actor_id in (${Array.from(
         { length: 9 },
         (_, i) => i + 3,
       )
         .map((n) => `'m03_smoke_reactivate.v1:${segment}:technical-${n}'`)
         .join(',')})),
       'prior',(select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l where actor_id<>'m03_smoke_reactivate.v1:${segment}:technical-13'));
      rollback;`),
      );
      assert.equal(output.auditCount, afterTwelve.audit + 1);
      assert.equal(output.newAudit, true);
      assert.equal(output.gapAbsent, true);
      assert.deepEqual(output.prior, JSON.parse(prior));
      assert.deepEqual(JSON.parse(psql(snapshot)), afterTwelve);
      for (const change of [
        `delete from ops.audit_log where actor_id='${twelveActor}'`,
        `update ops.audit_log set after=jsonb_set(after,'{segment_id}','"wrong-segment"') where actor_id='${twelveActor}'`,
      ]) {
        psql(`begin;${settings}${change};set local emr.smoke_technical_ordinal='13';do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';
        exception when others then if SQLSTATE<>'55000' or SQLERRM not in ('M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED','M03_REACTIVATION_PRIOR_LIFECYCLE_CHANGED') then raise exception 'MISSING_OR_CHANGED_TECHNICAL12_ACCEPTED';end if;end;end;$deny$;rollback;`);
        assert.deepEqual(JSON.parse(psql(snapshot)), afterTwelve);
      }
      psql(wrapper + '\\set emr_smoke_technical_ordinal 13\n' + source());
      psql('\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' + teardown);
      const afterThirteen = JSON.parse(psql(snapshot)),
        priorThirteen = psql('select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l;'),
        readback = nativeTechnical14ReadbackQuery();
      assert.equal(afterThirteen.audit, 6);
      const missing14Proof =
          "set local emr.smoke_technical14_no_reactivation='6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960';",
        missing15Proof =
          "set local emr.smoke_technical15_no_reactivation='59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd';",
        readback15 = nativeTechnical14ReadbackQuery(15),
        readback16 = nativeTechnical14ReadbackQuery(16);
      for (const proofSetting of ['', "set local emr.smoke_technical14_no_reactivation='unverified';"]) {
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='15';${proofSetting}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED' then raise exception 'MISSING14_PROOF_NOT_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterThirteen);
      }
      const fifteen = JSON.parse(
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='15';${missing14Proof}${body()}${readback15}rollback;`,
        ),
      );
      assert.equal(fifteen.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(fifteen.competitor_id, competitor);
      for (const [proofSettings, message] of [
        ['', 'M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED'],
        [missing15Proof, 'M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED'],
        [missing14Proof, 'M03_REACTIVATION_TECHNICAL15_PROOF_REQUIRED'],
        [
          missing14Proof + "set local emr.smoke_technical15_no_reactivation='unverified';",
          'M03_REACTIVATION_TECHNICAL15_PROOF_REQUIRED',
        ],
        [
          "set local emr.smoke_technical14_no_reactivation='unverified';" + missing15Proof,
          'M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED',
        ],
      ]) {
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='16';${proofSettings}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'${message}' then raise exception 'BOTH_GAP_PROOFS_NOT_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterThirteen);
      }
      const sixteen = JSON.parse(
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='16';${missing14Proof}${missing15Proof}${body()}${readback16}rollback;`,
        ),
      );
      assert.equal(sixteen.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(sixteen.competitor_id, competitor);
      assert.equal(sixteen.account_id, account);
      for (const ordinal of [12, 13]) {
        psql(
          `begin;${settings}delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}';set local emr.smoke_technical_ordinal='15';${missing14Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' then raise exception 'TECHNICAL15_PRIOR_NOT_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterThirteen);
        psql(
          `begin;${settings}delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}';set local emr.smoke_technical_ordinal='16';${missing14Proof}${missing15Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED' then raise exception 'TECHNICAL16_PRIOR_NOT_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterThirteen);
      }
      psql(`begin;${settings}set local emr.smoke_technical_ordinal='14';${body()}
update app.competitors set status='archived' where id='${competitor}';update app.competitor_accounts set status='paused' where id='${account}';
set local emr.smoke_technical_ordinal='15';${missing14Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'UNEXPECTED14_AUDIT_IGNORED';end if;end;end;$deny$;rollback;`);
      assert.deepEqual(JSON.parse(psql(snapshot)), afterThirteen);
      for (const unexpectedOrdinal of [14, 15]) {
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='${unexpectedOrdinal}';${unexpectedOrdinal === 15 ? missing14Proof : ''}${body()}
update app.competitors set status='archived' where id='${competitor}';update app.competitor_accounts set status='paused' where id='${account}';
set local emr.smoke_technical_ordinal='16';${missing14Proof}${missing15Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'UNEXPECTED_GAP_AUDIT_IGNORED';end if;end;end;$deny$;rollback;`);
        assert.deepEqual(JSON.parse(psql(snapshot)), afterThirteen);
      }
      const fourteen = JSON.parse(
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='14';${body()}${readback}rollback;`),
      );
      assert.equal(fourteen.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(fourteen.competitor_id, competitor);
      assert.equal(fourteen.account_id, account);
      for (const ordinal of [12, 13]) {
        for (const change of [
          `delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
          `update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
        ]) {
          psql(
            `begin;${settings}${change};set local emr.smoke_technical_ordinal='14';do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' then raise exception 'TECHNICAL14_PRIOR_NOT_DENIED';end if;end;end;$deny$;rollback;`,
          );
          assert.deepEqual(JSON.parse(psql(snapshot)), afterThirteen);
        }
      }
      assert.equal(
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='14';${body()}
update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-14';${readback}rollback;`),
        '',
        'native14 readback rejects a string substituted for the numeric creation audit ID',
      );
      assert.equal(
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='16';${missing14Proof}${missing15Proof}${body()}
update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-16';${readback16}rollback;`),
        '',
        'native16 readback rejects a string substituted for the numeric creation audit ID',
      );
      assert.equal(psql('select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l;'), priorThirteen);
      assert.deepEqual(JSON.parse(psql(snapshot)), afterThirteen);
      // Technical17 must preserve the real16 lifecycle; the two verified
      // no-Admin gaps never authorize skipping the completed16 audit.
      psql(
        `begin;${settings}set local emr.smoke_technical_ordinal='16';${missing14Proof}${missing15Proof}${body()}commit;`,
      );
      psql('\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' + teardown);
      const afterSixteen = JSON.parse(psql(snapshot)),
        priorSixteen = psql('select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l;'),
        readback17 = nativeTechnical14ReadbackQuery(17);
      assert.equal(afterSixteen.audit, 7);
      for (const [proofSettings, message] of [
        ['', 'M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED'],
        [missing15Proof, 'M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED'],
        [missing14Proof, 'M03_REACTIVATION_TECHNICAL15_PROOF_REQUIRED'],
        [
          missing14Proof + "set local emr.smoke_technical15_no_reactivation='unverified';",
          'M03_REACTIVATION_TECHNICAL15_PROOF_REQUIRED',
        ],
      ]) {
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='17';${proofSettings}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'${message}' then raise exception 'TECHNICAL17_GAP_PROOFS_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
      }
      for (const ordinal of [12, 13, 16]) {
        for (const change of [
          `delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
          `update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
        ]) {
          psql(
            `begin;${settings}${change};set local emr.smoke_technical_ordinal='17';${missing14Proof}${missing15Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM not in ('M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED','M03_REACTIVATION_PRIOR_LIFECYCLE_CHANGED') then raise exception 'TECHNICAL17_REAL_PRIOR_REQUIRED';end if;end;end;$deny$;rollback;`,
          );
          assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
        }
      }
      for (const unexpectedOrdinal of [14, 15]) {
        psql(`begin;${settings}insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','m03_smoke_reactivate.v1:${segment}:technical-${unexpectedOrdinal}','m03_smoke_fixture_reactivated','competitor','${competitor}',jsonb_build_object('segment_id','${segment}:technical-${unexpectedOrdinal}'));
set local emr.smoke_technical_ordinal='17';${missing14Proof}${missing15Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'TECHNICAL17_UNEXPECTED_GAP_AUDIT_IGNORED';end if;end;end;$deny$;rollback;`);
        assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
      }
      const seventeen = JSON.parse(
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='17';${missing14Proof}${missing15Proof}${body()}${readback17}rollback;`,
        ),
      );
      assert.equal(seventeen.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(seventeen.competitor_id, competitor);
      assert.equal(seventeen.account_id, account);
      assert.equal(
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='17';${missing14Proof}${missing15Proof}${body()}
update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-17';${readback17}rollback;`),
        '',
        'native17 readback rejects a string creation audit ID',
      );
      assert.equal(psql('select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l;'), priorSixteen);
      assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);

      // The qualified pre-Ready17 attempt never reached a database command.
      // Only18 may omit that audit, and every committed prior audit is required.
      const missing17Proof =
        "set local emr.smoke_technical17_no_reactivation='d16198186698ddefdad06902f4c39d50ac51e46e87686d77bb3d0f3429f491ac';";
      for (const proofSetting of ['', "set local emr.smoke_technical17_no_reactivation='unverified';"]) {
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='18';${missing14Proof}${missing15Proof}${proofSetting}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_TECHNICAL17_PROOF_REQUIRED' then raise exception 'TECHNICAL18_PROOF_NOT_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
      }
      for (const ordinal of [12, 13, 16]) {
        for (const change of [
          `delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
          `update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
        ]) {
          psql(
            `begin;${settings}${change};set local emr.smoke_technical_ordinal='18';${missing14Proof}${missing15Proof}${missing17Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM not in ('M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED','M03_REACTIVATION_PRIOR_LIFECYCLE_CHANGED') then raise exception 'TECHNICAL18_REAL_PRIOR_REQUIRED';end if;end;end;$deny$;rollback;`,
          );
          assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
        }
      }
      psql(`begin;${settings}insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','m03_smoke_reactivate.v1:${segment}:technical-17','m03_smoke_fixture_reactivated','competitor','${competitor}',jsonb_build_object('segment_id','${segment}:technical-17'));
set local emr.smoke_technical_ordinal='18';${missing14Proof}${missing15Proof}${missing17Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'UNEXPECTED17_AUDIT_IGNORED';end if;end;end;$deny$;rollback;`);
      assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
      const readback18 = nativeTechnical14ReadbackQuery(18),
        eighteen = JSON.parse(
          psql(
            `begin;${settings}set local emr.smoke_technical_ordinal='18';${missing14Proof}${missing15Proof}${missing17Proof}${body()}${readback18}rollback;`,
          ),
        );
      assert.equal(eighteen.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(eighteen.competitor_id, competitor);
      assert.equal(eighteen.account_id, account);
      assert.equal(
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='18';${missing14Proof}${missing15Proof}${missing17Proof}${body()}
update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-18';${readback18}rollback;`),
        '',
        'native18 readback rejects a string creation audit ID',
      );
      assert.equal(psql('select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l;'), priorSixteen);
      assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
      // Actual18 authenticated/read back the archived baseline but never wrote
      // a provision or reactivation intent. Only the exact qualified19 marker
      // may omit18; the actual17 proof and every committed lifecycle remain.
      const missing18Proof =
        "set local emr.smoke_technical18_no_reactivation='92a5976dbce66210abbdd76655afaf71a98c9c48f29c8c15422831a85f3737d9';";
      for (const [proofSettings, message] of [
        [missing14Proof + missing15Proof + missing17Proof, 'M03_REACTIVATION_TECHNICAL18_PROOF_REQUIRED'],
        [
          missing14Proof +
            missing15Proof +
            missing17Proof +
            "set local emr.smoke_technical18_no_reactivation='unverified';",
          'M03_REACTIVATION_TECHNICAL18_PROOF_REQUIRED',
        ],
        [missing14Proof + missing15Proof + missing18Proof, 'M03_REACTIVATION_TECHNICAL17_PROOF_REQUIRED'],
      ]) {
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='19';${proofSettings}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'${message}' then raise exception 'TECHNICAL19_GAP_PROOFS_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
      }
      for (const ordinal of [12, 13, 16]) {
        for (const change of [
          `delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
          `update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
        ]) {
          psql(
            `begin;${settings}${change};set local emr.smoke_technical_ordinal='19';${missing14Proof}${missing15Proof}${missing17Proof}${missing18Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM not in ('M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED','M03_REACTIVATION_PRIOR_LIFECYCLE_CHANGED') then raise exception 'TECHNICAL19_REAL_PRIOR_REQUIRED';end if;end;end;$deny$;rollback;`,
          );
          assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
        }
      }
      for (const unexpectedOrdinal of [17, 18]) {
        psql(`begin;${settings}insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','m03_smoke_reactivate.v1:${segment}:technical-${unexpectedOrdinal}','m03_smoke_fixture_reactivated','competitor','${competitor}',jsonb_build_object('segment_id','${segment}:technical-${unexpectedOrdinal}'));
set local emr.smoke_technical_ordinal='19';${missing14Proof}${missing15Proof}${missing17Proof}${missing18Proof}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'TECHNICAL19_UNEXPECTED_GAP_AUDIT_IGNORED';end if;end;end;$deny$;rollback;`);
        assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
      }
      const readback19 = nativeTechnical14ReadbackQuery(19),
        nineteen = JSON.parse(
          psql(
            `begin;${settings}set local emr.smoke_technical_ordinal='19';${missing14Proof}${missing15Proof}${missing17Proof}${missing18Proof}${body()}${readback19}rollback;`,
          ),
        );
      assert.equal(nineteen.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(nineteen.competitor_id, competitor);
      assert.equal(nineteen.account_id, account);
      assert.equal(
        psql(`begin;${settings}set local emr.smoke_technical_ordinal='19';${missing14Proof}${missing15Proof}${missing17Proof}${missing18Proof}${body()}
update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-19';${readback19}rollback;`),
        '',
        'native19 readback rejects a string creation audit ID',
      );
      assert.equal(psql('select jsonb_agg(to_jsonb(l) order by id) from ops.audit_log l;'), priorSixteen);
      assert.deepEqual(JSON.parse(psql(snapshot)), afterSixteen);
      // Unlike17/18, actual19 reactivated the retained fixture. Commit that
      // exact synthetic lifecycle, then use the real status-only archive.
      const gapProofs = missing14Proof + missing15Proof + missing17Proof + missing18Proof;
      psql(`begin;${settings}set local emr.smoke_technical_ordinal='19';${gapProofs}${body()}commit;`);
      psql('\\set emr_project_ref zmotjsbzhzjvpelxvxlf\n' + teardown);
      const afterNineteen = JSON.parse(psql(snapshot));
      assert.equal(afterNineteen.audit, 8);
      const readback20 = nativeTechnical14ReadbackQuery(20);
      const twenty = JSON.parse(
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='20';${gapProofs}${body()}${readback20}rollback;`,
        ),
      );
      assert.equal(twenty.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(twenty.competitor_id, competitor);
      assert.equal(twenty.account_id, account);
      for (const ordinal of [19, 20])
        assert.equal(
          psql(`begin;${settings}set local emr.smoke_technical_ordinal='20';${gapProofs}${body()}
update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}';${readback20}rollback;`),
          '',
          'native20 readback rejects string creation audit IDs for current20 and real19',
        );
      for (const [proof, message] of [
        [missing14Proof, 'M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED'],
        [missing15Proof, 'M03_REACTIVATION_TECHNICAL15_PROOF_REQUIRED'],
        [missing17Proof, 'M03_REACTIVATION_TECHNICAL17_PROOF_REQUIRED'],
        [missing18Proof, 'M03_REACTIVATION_TECHNICAL18_PROOF_REQUIRED'],
      ]) {
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='20';${gapProofs.replace(proof, '')}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'${message}' then raise exception 'TECHNICAL20_GAP_PROOF_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
      }
      for (const ordinal of [12, 13, 16, 19]) {
        for (const change of [
          `delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
          `update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
        ]) {
          psql(
            `begin;${settings}${change};set local emr.smoke_technical_ordinal='20';${gapProofs}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM not in ('M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED','M03_REACTIVATION_PRIOR_LIFECYCLE_CHANGED') then raise exception 'TECHNICAL20_REAL19_NOT_OPTIONAL';end if;end;end;$deny$;rollback;`,
          );
          assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
        }
      }
      for (const ordinal of [17, 18]) {
        psql(
          `begin;${settings}insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','m03_smoke_reactivate.v1:${segment}:technical-${ordinal}','m03_smoke_fixture_reactivated','competitor','${competitor}',jsonb_build_object('segment_id','${segment}:technical-${ordinal}'));set local emr.smoke_technical_ordinal='20';${gapProofs}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'TECHNICAL20_GAP_AUDIT_NOT_OPTIONAL';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
      }
      // Actual20 never started an administrator or created a SQL audit. Only
      // the immutable native proof permits21 to omit that one nonexistent row.
      const missing20Proof =
        "set local emr.smoke_technical20_no_reactivation='d5f4353439ff6a3254f71609048ff43aa1d453308b5708bd968182ce959bf983';";
      const gap21Proofs = gapProofs + missing20Proof,
        readback21 = nativeTechnical14ReadbackQuery(21);
      const twentyOne = JSON.parse(
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='21';${gap21Proofs}${body()}${readback21}rollback;`,
        ),
      );
      assert.equal(twentyOne.result, 'M03_SMOKE_FIXTURE_READY');
      assert.equal(twentyOne.competitor_id, competitor);
      assert.equal(twentyOne.account_id, account);
      assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
      for (const proof20 of ['', "set local emr.smoke_technical20_no_reactivation='unverified';"]) {
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='21';${gapProofs}${proof20}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_TECHNICAL20_PROOF_REQUIRED' then raise exception 'TECHNICAL21_EXACT20_PROOF_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
      }
      for (const [proof, message] of [
        [missing14Proof, 'M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED'],
        [missing15Proof, 'M03_REACTIVATION_TECHNICAL15_PROOF_REQUIRED'],
        [missing17Proof, 'M03_REACTIVATION_TECHNICAL17_PROOF_REQUIRED'],
        [missing18Proof, 'M03_REACTIVATION_TECHNICAL18_PROOF_REQUIRED'],
      ]) {
        psql(
          `begin;${settings}set local emr.smoke_technical_ordinal='21';${gap21Proofs.replace(proof, '')}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'${message}' then raise exception 'TECHNICAL21_PRIOR_GAP_PROOF_REQUIRED';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
      }
      for (const ordinal of [12, 13, 16, 19])
        for (const change of [
          `delete from ops.audit_log where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
          `update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}'`,
        ]) {
          psql(
            `begin;${settings}${change};set local emr.smoke_technical_ordinal='21';${gap21Proofs}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM not in ('M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED','M03_REACTIVATION_PRIOR_LIFECYCLE_CHANGED') then raise exception 'TECHNICAL21_REAL_PRIOR_NOT_OPTIONAL';end if;end;end;$deny$;rollback;`,
          );
          assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
        }
      for (const ordinal of [17, 18, 20]) {
        psql(
          `begin;${settings}insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)values('system','m03_smoke_reactivate.v1:${segment}:technical-${ordinal}','m03_smoke_fixture_reactivated','competitor','${competitor}',jsonb_build_object('segment_id','${segment}:technical-${ordinal}'));set local emr.smoke_technical_ordinal='21';${gap21Proofs}do $deny$begin begin execute $under_test$${body()}$under_test$;raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' or SQLERRM<>'M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT' then raise exception 'TECHNICAL21_GAP_AUDIT_NOT_OPTIONAL';end if;end;end;$deny$;rollback;`,
        );
        assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
      }
      for (const ordinal of [19, 21])
        assert.equal(
          psql(
            `begin;${settings}set local emr.smoke_technical_ordinal='21';${gap21Proofs}${body()}update ops.audit_log set after=jsonb_set(after,'{original_creation_audit_id}',to_jsonb(after->>'original_creation_audit_id')) where actor_id='m03_smoke_reactivate.v1:${segment}:technical-${ordinal}';${readback21}rollback;`,
          ),
          '',
          'native21 readback requires numeric creation IDs for real19 and current21',
        );
      assert.deepEqual(JSON.parse(psql(snapshot)), afterNineteen);
    });
  },
);
