import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const oldWindow = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
const freshWindow = '38b3708d-61b0-41d2-8170-5ed91c66b4dc';
const thirdWindow = '00000000-0000-4000-8000-000000000099';
const competitor = 'd51a39f6-fe87-4d17-aee9-3070c45693aa';
const account = 'bd23314c-591f-4fb7-92fd-b7450634eeb6';
const migration = new URL(
  '../../supabase/migrations/20261023163755_m03_foundation_window_continuation.sql',
  import.meta.url,
);
const source = (name) => readFileSync(new URL('../../supabase/migrations/' + name, import.meta.url), 'utf8');
const packet = {
  audience: 'https://everyone-market-researcher-synthetic-forward.vercel.app',
  commitSha: 'a'.repeat(40),
  deploymentId: 'dpl_SyntheticForward',
  actorBuild: '0.3.99',
  approvalReference: 'M03-A-D-f42930f-20261021',
  maxTotalChargeUsd: 1,
  batchMaxUsd: 2,
};
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
function nativeRemainingStateQuery() {
  const file = new URL('./windows/Foundation-AdminControl.ps1', import.meta.url).pathname;
  const nativePath = process.platform === 'win32' ? decodeURIComponent(file.slice(1)) : file;
  const code = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${literal(nativePath)},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'NATIVE_SOURCE_PARSE_FAILED'}
foreach($name in @('Foundation-ForwardWindowId','Assert-FoundationForwardWindowState')){
 $found=@($ast.FindAll({param($v)$v -is [Management.Automation.Language.FunctionDefinitionAst] -and $v.Name -ceq $name},$true));if($found.Count -ne 1){throw 'FUNCTION_NOT_EXACT'};Invoke-Expression $found[0].Extent.Text
}
$ForwardWindow=$true;$ProjectVerifiedContinuation=$true;$projectVerifiedForwardWindowId='eda4fae1-1e19-47db-81b8-beac1a4ed883';$projectVerifiedForwardSource='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803';$script:query=$null
function Read-FoundationForwardPrior{}
function Invoke-FoundationQuery($Sql,$Field){if($Field -cne 'registered_preflight'){throw 'WRONG_PROJECTION'};$script:query=$Sql;throw 'QUERY_CAPTURED'}
try{Assert-FoundationForwardWindowState $false}catch{if($_.Exception.Message -cne 'QUERY_CAPTURED'){throw}}
if($script:query -isnot [string]){throw 'QUERY_NOT_CAPTURED'};Write-Output $script:query
`;
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')],
    { env: env(), encoding: 'utf8', windowsHide: true, timeout: 15000 },
  );
  assert.equal(result.status, 0, 'NATIVE_REMAINING_SQL_GENERATION');
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

test('forward-window migration exists independently of closed-window history', () => {
  const sql = readFileSync(migration, 'utf8');
  assert.ok(sql.includes(oldWindow) && sql.includes(freshWindow));
  assert.equal(
    /\b(?:grant|create\s+role|alter\s+role|truncate)\b/i.test(sql.replace(/--[^\n]*/g, '')),
    false,
  );
});

// Real local PostgreSQL17, no ports/volumes/network or saved application secrets.
// Relevant table/function definitions are loaded verbatim from reviewed SQL.
// This is neither a hosted migration receipt nor a full Supabase-schema test.
describe(
  'isolated PostgreSQL17 forward-window cumulative safety',
  {
    skip: process.env.EMR_M03_FORWARD_LOCAL_SQL_TEST !== 'true',
  },
  () => {
    const image = 'postgres@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73';
    const name = 'emr-m03-forward-test-' + randomUUID();
    let owned = false;
    function docker(args, input, timeout = 15000) {
      const r = spawnSync('docker', args, {
        input,
        env: env(),
        encoding: 'utf8',
        timeout,
        maxBuffer: 2097152,
        windowsHide: true,
      });
      assert.equal(r.error, undefined, 'LOCAL_DOCKER_PROCESS');
      const state = r.stderr?.match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5})\b/)?.[1];
      assert.equal(r.status, 0, 'LOCAL_DOCKER_NATIVE' + (state ? '_SQLSTATE_' + state : ''));
      return r.stdout.trim();
    }
    const args = (user = 'postgres') => [
      'exec',
      '-i',
      name,
      'psql',
      '-X',
      '-U',
      user,
      '-d',
      'postgres',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      'VERBOSITY=verbose',
    ];
    const psql = (sql, user = 'postgres') => docker(args(user), sql);
    const table = (sql, name) => {
      const match = sql.match(
        new RegExp('create table ' + name.replaceAll('.', '\\.') + ' \\([\\s\\S]*?\\n\\);'),
      );
      assert.ok(match, 'ACTUAL_TABLE_' + name);
      return match[0];
    };
    const fn = (sql, name) => {
      const match = sql.match(
        new RegExp('create (?:or replace )?function ops\\.' + name + '\\([\\s\\S]*?\\n\\$\\$;'),
      );
      assert.ok(match, 'ACTUAL_FUNCTION_' + name);
      return match[0];
    };
    const control = (
      mode = 'admit',
      window = freshWindow,
      id = randomUUID(),
      operation = 'identity.read',
      value = {},
    ) =>
      `select ops.foundation_gateway_admit('${window}','${id}',${literal(operation)},${literal(JSON.stringify(value))}::jsonb,${literal(mode)});`;
    const provision = (id = freshWindow) =>
      psql(
        `select ops.foundation_gateway_provision('${id}'::uuid,${literal(JSON.stringify(packet))}::jsonb);`,
      );
    const oldRow = () =>
      JSON.parse(
        psql(`select to_jsonb(w) from ops.foundation_gateway_rate_windows w where window_id='${oldWindow}';`),
      );
    function denial(sql, code, user = 'postgres') {
      const q = `do $denial$begin begin ${sql} raise exception using errcode='P9999',message='EXPECTED_DENIAL'; exception when others then if SQLSTATE<>${literal(code)} then raise exception using errcode='P9998',message='WRONG_DENIAL_STATE';end if;end;end;$denial$;`;
      psql(q, user);
    }
    const activate = () =>
      psql(
        `update app.competitors set status='active' where id='${competitor}';update app.competitor_accounts set status='active' where id='${account}';`,
      );
    before(async () => {
      assert.ok(
        !process.env.DOCKER_HOST || /^(?:unix:\/\/\/|npipe:\/\/)/.test(process.env.DOCKER_HOST),
        'LOCAL_DOCKER_ONLY',
      );
      assert.match(
        JSON.parse(docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'])),
        /^(?:unix:\/\/\/|npipe:\/\/)/,
      );
      assert.ok(
        JSON.parse(docker(['image', 'inspect', '--format', '{{json .RepoDigests}}', image])).includes(image),
        'PINNED_PUBLIC_REPOSITORY_DIGEST',
      );
      docker([
        'run',
        '--detach',
        '--pull=never',
        '--name',
        name,
        '--label',
        'emr.m03.owner=forward-window-test',
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
      const readyDeadline = Date.now() + 20000;
      while (Date.now() < readyDeadline) {
        // The official entrypoint briefly starts a socket-only bootstrap server.
        // Schema writes must wait until PID1 has exec'ed the final PostgreSQL.
        const principal = spawnSync('docker', ['exec', name, 'cat', '/proc/1/comm'], {
          env: env(),
          encoding: 'utf8',
          timeout: 2000,
          windowsHide: true,
        });
        if (principal.status === 0 && principal.stdout.trim() === 'postgres') {
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
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal(ready, true, 'LOCAL_POSTGRES_FINAL_SERVER_READY');
      const types = source('20261017172928_extensions_schemas_roles.sql');
      const core = source('20261017172931_core_tables.sql');
      const actor = source('20261018231756_m03_actor_launch_admission.sql');
      const gateway = source('20261018232014_m03_foundation_gateway.sql');
      const boundary = source('20261018233338_m03_foundation_boundary_hardening.sql');
      const foundation = source('20261018034220_rpc_n8n_foundation.sql');
      psql(`create schema app;create schema ops;create schema ingest;create schema extensions;create schema private;create schema pgmq;
    create extension pgcrypto with schema extensions;
    ${types.match(/create type app\.[\s\S]*?;/g).join('\n')}
    create role anon;create role authenticated;create role api_agent;create role service_role;create role n8n_writer login;
    ${table(core, 'app.competitors')}${table(core, 'app.competitor_accounts')}
    create table app.items(id uuid primary key,account_id uuid,competitor_id uuid);
    ${table(core, 'ops.scrape_runs')}${table(core, 'ops.apify_runs')}${table(core, 'ops.cost_ledger')}${table(core, 'ops.audit_log')}
    ${actor}
    ${['foundation_gateway_rate_windows', 'foundation_gateway_requests', 'foundation_gateway_leases', 'foundation_gateway_run_bindings'].map((n) => table(gateway, 'ops.' + n)).join('\n')}
    ${boundary.slice(0, boundary.indexOf('create or replace function'))}
    ${fn(gateway, 'foundation_gateway_provision')}${fn(gateway, 'foundation_gateway_response')}${fn(gateway, 'foundation_gateway_workflow')}
    ${fn(boundary, 'foundation_gateway_validate')}${fn(boundary, 'foundation_gateway_admit')}
    ${fn(foundation, 'get_apify_run')}
    alter table ops.foundation_gateway_rate_windows enable row level security;
    alter table ops.foundation_gateway_requests enable row level security;
    alter table ops.foundation_gateway_leases enable row level security;
    alter table ops.foundation_gateway_run_bindings enable row level security;
    grant usage on schema ops to n8n_writer;
    revoke all on function ops.foundation_gateway_provision(jsonb),ops.foundation_gateway_response(uuid,text,text,text,jsonb,boolean),ops.foundation_gateway_workflow(text),ops.foundation_gateway_validate(uuid,uuid,text,jsonb),ops.foundation_gateway_admit(uuid,uuid,text,jsonb,text) from public;
    grant execute on function ops.foundation_gateway_admit(uuid,uuid,text,jsonb,text) to n8n_writer;`);
      reset();
      const prior = oldRow(),
        legacy = psql("select pg_get_functiondef('ops.foundation_gateway_provision(jsonb)'::regprocedure);");
      psql(readFileSync(migration, 'utf8'));
      assert.deepEqual(oldRow(), prior, 'FORWARD_MIGRATION_PRESERVES_CLOSED_ROW');
      assert.equal(
        psql("select pg_get_functiondef('ops.foundation_gateway_provision(jsonb)'::regprocedure);"),
        legacy,
        'LEGACY_RPC_BODY_UNCHANGED',
      );
    });
    after(() => {
      if (owned) {
        assert.equal(
          docker(['inspect', '--format', '{{index .Config.Labels "emr.m03.owner"}}', name]),
          'forward-window-test',
        );
        docker(['rm', '--force', name]);
        owned = false;
      }
    });
    function reset() {
      psql(`truncate ops.apify_launch_admissions,ops.apify_runs,ops.scrape_runs,ops.foundation_gateway_requests,ops.foundation_gateway_leases,ops.foundation_gateway_run_bindings,ops.foundation_gateway_rate_windows,ops.apify_launch_approvals,app.competitor_accounts,app.competitors,ops.audit_log,ops.cost_ledger,app.items restart identity cascade;
      insert into app.competitors(id,company_code,slug,name,priority_tier,status,website_url,notes)values('${competitor}','C999','emr-smoke-test','emr-smoke-test','adjacent','archived','https://everyone.film','Owned dev-only M03 foundation smoke fixture; retain all collected data.');
      insert into app.competitor_accounts(id,competitor_id,platform,handle,url,resolve_status,status)values('${account}','${competitor}','website_work_page','https://everyone.film/about-everyone','https://everyone.film/about-everyone','not_needed','paused');
      insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)select 'system','m03_smoke_setup.v1','m03_smoke_fixture_created','competitor',c.id::text,
       jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf','competitor_id',c.id,'account_id',a.id,'competitor_identity',to_jsonb(c)-array['status','created_at','updated_at','search_tsv'],'account_identity',jsonb_build_object('platform',a.platform,'handle',a.handle,'url',a.url,'external_id',a.external_id,'uploads_playlist_id',a.uploads_playlist_id,'resolve_status',a.resolve_status,'cadence',a.cadence,'backfill_from',a.backfill_from))
       from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where c.id='${competitor}';
      with t as(select clock_timestamp() as n) insert into ops.foundation_gateway_rate_windows(namespace,window_id,project_ref,environment,bound_audience,bound_commit_sha,bound_deployment_id,starts_at,expires_at,closed_at,admitted_count,close_count)
       select 'm03-foundation-dev','${oldWindow}','zmotjsbzhzjvpelxvxlf','dev',${literal(packet.audience)},${literal(packet.commitSha)},${literal(packet.deploymentId)},n-interval '2 hours',n-interval '1 hour',n,2,1 from t;
      insert into ops.foundation_gateway_requests(window_id,request_id,operation,payload_sha256,state,lease_expires_at,completed_at,result)
       values('${oldWindow}','00000000-0000-4000-8000-000000000001','identity.read',repeat('0',64),'completed',clock_timestamp(),clock_timestamp(),'{}');
      insert into ops.foundation_gateway_leases(window_id,slot)values('${oldWindow}',1),('${oldWindow}',2);
      insert into ops.apify_launch_approvals(window_id,approval_reference,project_ref,actor_build,max_total_charge_usd,batch_max_usd,not_before,expires_at,closed_at)
       values('${oldWindow}',${literal(packet.approvalReference)},'zmotjsbzhzjvpelxvxlf','0.3.99',1,2,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour',clock_timestamp());`);
    }
    beforeEach(reset);

    test('actual Admin forward-state query parses and returns only the finite read-only projection', () => {
      const admin = readFileSync(new URL('./windows/Foundation-AdminControl.ps1', import.meta.url), 'utf8');
      const sql = admin.match(
        /function Assert-FoundationForwardWindowState\([\s\S]*?\$stateSql=@'\r?\n([\s\S]*?)\r?\n'@/,
      )?.[1];
      assert.ok(sql, 'ACTUAL_ADMIN_FORWARD_STATE_QUERY');
      const before = oldRow();
      const value = JSON.parse(psql('begin read only;\n' + sql + '\nrollback;'));
      const booleans = ['identity', 'legacyClosed', 'freshPrepared'];
      const counts = [
        'windows',
        'freshWindows',
        'globalAdmitted',
        'requests',
        'activeLeases',
        'launches',
        'bindings',
        'progress',
      ];
      assert.deepEqual(Object.keys(value).sort(), [...booleans, ...counts].sort());
      for (const key of booleans) assert.equal(typeof value[key], 'boolean', key);
      for (const key of counts) assert.ok(Number.isSafeInteger(value[key]) && value[key] >= 0, key);
      assert.equal(value.identity, true);
      assert.equal(value.windows, 1);
      assert.equal(value.freshWindows, 0);
      assert.equal(value.globalAdmitted, 2);
      assert.deepEqual(oldRow(), before);
    });

    test(
      'actual native remaining-window query verifies both closed predecessors before and after owner registration',
      { skip: process.platform !== 'win32' },
      () => {
        const next = 'eda4fae1-1e19-47db-81b8-beac1a4ed883';
        const sql = nativeRemainingStateQuery();
        assert.equal(/\b(update|insert|delete|truncate|grant|revoke)\b/i.test(sql), false);
        psql(`update ops.foundation_gateway_rate_windows set bound_commit_sha='f42930f90c2de43c84f61ad6d966d0ee6074d70e',closed_at='2026-10-23T16:25:54.94722+00:00' where window_id='${oldWindow}';
      insert into ops.foundation_gateway_rate_windows(namespace,window_id,project_ref,environment,bound_audience,bound_commit_sha,bound_deployment_id,closed_at,admitted_count,close_count)
      values('m03-foundation-dev','${freshWindow}','zmotjsbzhzjvpelxvxlf','dev','https://everyone-market-researcher-j94yqflt0-muhammed-abdelrahman.vercel.app','a5e746736893d5040e93032ae740a0878f748837','dpl_HPq8ot1nNvBZRLTyAoEnXHXuhTPF',clock_timestamp(),1,1);
      insert into ops.apify_launch_approvals(window_id,approval_reference,project_ref,actor_build,max_total_charge_usd,batch_max_usd,not_before,expires_at,closed_at)
      select '${freshWindow}',approval_reference,project_ref,actor_build,max_total_charge_usd,batch_max_usd,not_before,expires_at,closed_at from ops.apify_launch_approvals where window_id='${oldWindow}';`);
        const snapshot = () =>
          psql(
            `select jsonb_agg(to_jsonb(w) order by window_id) from ops.foundation_gateway_rate_windows w where window_id in ('${oldWindow}','${freshWindow}');`,
          );
        const before = snapshot();
        const read = () => JSON.parse(psql('begin read only;\n' + sql + '\nrollback;'));
        assert.deepEqual(read(), {
          identity: true,
          legacyClosed: true,
          intermediateClosed: true,
          windows: 2,
          freshWindows: 0,
          freshPrepared: false,
          globalAdmitted: 3,
          requests: 1,
          activeLeases: 0,
          launches: 0,
          bindings: 0,
          progress: 0,
        });
        const nextPacket = { ...packet, commitSha: 'aff94f2b2d8055cf93b5405e6b11d4e7d9c86803' };
        psql(
          `select ops.foundation_gateway_provision('${next}',${literal(JSON.stringify(nextPacket))}::jsonb);`,
        );
        assert.deepEqual(read(), {
          identity: true,
          legacyClosed: true,
          intermediateClosed: true,
          windows: 3,
          freshWindows: 1,
          freshPrepared: true,
          globalAdmitted: 3,
          requests: 1,
          activeLeases: 0,
          launches: 0,
          bindings: 0,
          progress: 0,
        });
        assert.equal(snapshot(), before);
        psql(
          `update ops.foundation_gateway_rate_windows set bound_deployment_id='dpl_other' where window_id='${freshWindow}';`,
        );
        assert.equal(read().intermediateClosed, false);
      },
    );

    test('actual restricted login provisions no owner state and retains the closed old row byte-for-byte', () => {
      const before = oldRow();
      provision();
      assert.deepEqual(oldRow(), before);
      const identity = psql("select current_user||'/'||session_user;", 'n8n_writer');
      assert.equal(identity, 'n8n_writer/n8n_writer');
      denial(
        `perform ops.foundation_gateway_provision('${freshWindow}'::uuid,${literal(JSON.stringify(packet))}::jsonb);`,
        '42501',
        'n8n_writer',
      );
      const r = JSON.parse(psql(control('inspect', oldWindow), 'n8n_writer'));
      assert.equal(r.state, 'closed');
      assert.equal(r.code, 'window_closed');
      psql(control('admit', oldWindow), 'n8n_writer');
      psql(control('close', oldWindow), 'n8n_writer');
      assert.deepEqual(oldRow(), before);
    });

    test('unregistered UUID and administrator SET ROLE are not restricted-login admission', () => {
      denial(
        `perform ops.foundation_gateway_admit('${thirdWindow}','${randomUUID()}','identity.read','{}','inspect');`,
        '22023',
        'n8n_writer',
      );
      psql(
        `set role n8n_writer;do $denial$begin begin perform ops.foundation_gateway_admit('${oldWindow}','${randomUUID()}','identity.read','{}','inspect');raise exception using errcode='P9999';exception when others then if SQLSTATE<>'42501' then raise exception using errcode='P9998';end if;end;end;$denial$;reset role;`,
      );
      assert.equal(
        psql(`select count(*) from ops.foundation_gateway_rate_windows where window_id='${thirdWindow}';`),
        '0',
      );
      for (const role of ['anon', 'authenticated', 'api_agent', 'service_role', 'n8n_writer'])
        assert.equal(
          psql(
            `select has_function_privilege('${role}','ops.foundation_gateway_provision(uuid,jsonb)','execute');`,
          ),
          'f',
        );
      assert.equal(
        psql(
          "select bool_and(relrowsecurity) from pg_class where oid in ('ops.foundation_gateway_rate_windows'::regclass,'ops.foundation_gateway_requests'::regclass,'ops.foundation_gateway_leases'::regclass,'ops.foundation_gateway_run_bindings'::regclass);",
        ),
        't',
      );
    });

    test('owner registration refuses dirty prior state and active or human-edited fixture without a partial fresh row', () => {
      const faults = [
        `update ops.foundation_gateway_rate_windows set closed_at=null,close_count=0 where window_id='${oldWindow}';`,
        `update ops.apify_launch_approvals set closed_at=null;`,
        `update ops.foundation_gateway_requests set state='reserved',completed_at=null,result=null;`,
        `update app.competitors set status='active' where id='${competitor}';`,
        `update app.competitor_accounts set status='active' where id='${account}';`,
        `update app.competitors set name='Synthetic human correction' where id='${competitor}';`,
      ];
      for (const [index, change] of faults.entries()) {
        try {
          psql(
            `begin;${change}do $denial$begin begin perform ops.foundation_gateway_provision('${freshWindow}'::uuid,${literal(JSON.stringify(packet))}::jsonb);raise exception using errcode='P9999';exception when others then if SQLSTATE<>'55000' then raise exception using errcode='P9998';end if;end;if exists(select 1 from ops.foundation_gateway_rate_windows where window_id='${freshWindow}') then raise exception 'PARTIAL_WINDOW';end if;end;$denial$;rollback;`,
          );
        } catch {
          throw Error('OWNER_REGISTRATION_GUARD_' + index);
        }
      }
    });

    test('family total includes historical admissions and the one counted Close; replay cannot reopen or reset', () => {
      provision();
      psql(
        `update ops.foundation_gateway_rate_windows set admitted_count=254 where window_id='${oldWindow}';`,
      );
      const old = oldRow();
      assert.equal(JSON.parse(psql(control(), 'n8n_writer')).state, 'admitted');
      assert.equal(JSON.parse(psql(control('close'), 'n8n_writer')).code, 'window_closed');
      assert.equal(psql('select sum(admitted_count) from ops.foundation_gateway_rate_windows;'), '256');
      assert.equal(JSON.parse(psql(control('close'), 'n8n_writer')).code, 'window_closed');
      assert.equal(psql('select sum(admitted_count) from ops.foundation_gateway_rate_windows;'), '256');
      assert.deepEqual(oldRow(), old);
      denial(
        `perform ops.foundation_gateway_provision('${freshWindow}'::uuid,${literal(JSON.stringify(packet))}::jsonb);`,
        '55000',
      );
      assert.equal(psql('select sum(admitted_count) from ops.foundation_gateway_rate_windows;'), '256');
    });

    test('minute and Cairo-day rate ceilings are shared with the historical row', () => {
      provision();
      psql(
        `update ops.foundation_gateway_rate_windows set minute_start=date_trunc('minute',clock_timestamp()),minute_count=30 where window_id='${oldWindow}';`,
      );
      assert.equal(JSON.parse(psql(control(), 'n8n_writer')).code, 'rate_limited');
      psql(
        `update ops.foundation_gateway_rate_windows set minute_count=0,day_start=(clock_timestamp() at time zone 'Africa/Cairo')::date,day_count=500 where window_id='${oldWindow}';`,
      );
      assert.equal(JSON.parse(psql(control(), 'n8n_writer')).code, 'rate_limited');
      assert.equal(
        psql(
          `select admitted_count from ops.foundation_gateway_rate_windows where window_id='${freshWindow}';`,
        ),
        '0',
      );
    });

    test('implicit expiration permanently counts closure once and old rows stay unchanged', () => {
      provision();
      const old = oldRow();
      psql(
        `with t as(select clock_timestamp() n)update ops.foundation_gateway_rate_windows w set starts_at=n-interval '2 hours',expires_at=n-interval '1 hour' from t where window_id='${freshWindow}';`,
      );
      assert.equal(JSON.parse(psql(control(), 'n8n_writer')).code, 'window_expired');
      assert.equal(
        psql(
          `select close_count||'/'||admitted_count||'/'||(closed_at is not null)::text from ops.foundation_gateway_rate_windows where window_id='${freshWindow}';`,
        ),
        '1/1/true',
      );
      assert.equal(JSON.parse(psql(control('close'), 'n8n_writer')).code, 'window_closed');
      assert.equal(
        psql(
          `select close_count||'/'||admitted_count from ops.foundation_gateway_rate_windows where window_id='${freshWindow}';`,
        ),
        '1/1',
      );
      assert.deepEqual(oldRow(), old);
    });

    function queryChild(sql, user = 'n8n_writer') {
      return new Promise((resolve, reject) => {
        const child = spawn('docker', args(user), {
          env: env(),
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
        let out = '',
          error = '',
          settled = false;
        const timer = setTimeout(() => {
          child.kill();
        }, 12000);
        child.stdout.on('data', (bytes) => {
          out += bytes;
          if (out.length > 1048576) child.kill();
        });
        child.stderr.on('data', (bytes) => {
          error += bytes;
          if (error.length > 1048576) child.kill();
        });
        child.on('error', () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(Error('LOCAL_QUERY_CHILD'));
          }
        });
        child.on('close', (code) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve({ code, out: out.trim(), error });
          }
        });
        child.stdin.end('\\set VERBOSITY verbose\n' + sql);
      });
    }

    test('two concurrent real writer sessions cannot spend the final ordinary family slot twice', async () => {
      provision();
      psql(
        `update ops.foundation_gateway_rate_windows set admitted_count=254 where window_id='${oldWindow}';`,
      );
      const result = await Promise.all([
        queryChild('select pg_sleep(0.1);' + control()),
        queryChild('select pg_sleep(0.1);' + control()),
      ]);
      assert.deepEqual(
        result.map((r) => r.code),
        [0, 0],
      );
      const replies = result.map((r) => JSON.parse(r.out));
      assert.equal(replies.filter((r) => r.state === 'admitted').length, 1);
      assert.equal(replies.filter((r) => r.state === 'limited' && r.code === 'request_limit').length, 1);
      assert.equal(psql('select sum(admitted_count) from ops.foundation_gateway_rate_windows;'), '255');
      psql(control('close'), 'n8n_writer');
      assert.equal(psql('select sum(admitted_count) from ops.foundation_gateway_rate_windows;'), '256');
    });

    test('two concurrent owner registrations create only one active technical window', async () => {
      const result = await Promise.all(
        [freshWindow, thirdWindow].map((id) =>
          queryChild(
            `select pg_sleep(0.1);select ops.foundation_gateway_provision('${id}'::uuid,${literal(JSON.stringify(packet))}::jsonb);`,
            'postgres',
          ),
        ),
      );
      assert.equal(result.filter((r) => r.code === 0).length, 1);
      assert.equal(result.filter((r) => r.code !== 0 && /55000/.test(r.error)).length, 1);
      assert.equal(
        psql('select count(*) from ops.foundation_gateway_rate_windows where closed_at is null;'),
        '1',
      );
      assert.equal(psql('select count(*) from ops.foundation_gateway_rate_windows;'), '2');
    });

    test('registration cannot replenish an exhausted family or assign another namespace', () => {
      psql(
        `update ops.foundation_gateway_rate_windows set admitted_count=255 where window_id='${oldWindow}';`,
      );
      denial(
        `perform ops.foundation_gateway_provision('${freshWindow}'::uuid,${literal(JSON.stringify(packet))}::jsonb);`,
        '55000',
      );
      denial(
        `insert into ops.foundation_gateway_rate_windows(namespace,window_id,project_ref,environment)values('unapproved-family','${freshWindow}','zmotjsbzhzjvpelxvxlf','dev');`,
        '23514',
      );
      assert.equal(psql('select count(*) from ops.foundation_gateway_rate_windows;'), '1');
      assert.equal(psql('select sum(admitted_count) from ops.foundation_gateway_rate_windows;'), '255');
    });

    function parentRun(window = freshWindow) {
      const id = randomUUID();
      psql(
        `insert into ops.scrape_runs(id,workflow,platform,mode,env,n8n_execution_id)values('${id}','WF-99','website_work_page','manual','dev','SyntheticForward');insert into ops.foundation_gateway_run_bindings(window_id,run_id)values('${window}','${id}');`,
      );
      return id;
    }
    function launchPacket(run, window = freshWindow) {
      return {
        window_id: window,
        launch_id: randomUUID(),
        run_id: run,
        account_id: account,
        execution_id: 'SyntheticForward',
        actor_id: 'aYG0l9s7dbB7j3gbS',
        actor_build: '0.3.99',
        input: JSON.parse(psql('select ops.m03_smoke_launch_input();')),
        memory_mb: 1024,
        timeout_seconds: 300,
        max_total_charge_usd: 1,
      };
    }
    const launchSql = (p) => `select ops.authorize_apify_launch(${literal(JSON.stringify(p))}::jsonb);`;
    function settleLaunch(p, usage = 1) {
      const providerId = 'Synthetic_' + p.launch_id.replaceAll('-', '');
      psql(`insert into ops.apify_runs(apify_run_id,actor_id,run_id,account_ids,purpose,status,usage_usd,processed_at)values('${providerId}','aYG0l9s7dbB7j3gbS','${p.run_id}',array['${account}'::uuid],'daily','SUCCEEDED',${usage},clock_timestamp());
      update ops.apify_launch_admissions set apify_run_id='${providerId}',reconciled_at=clock_timestamp() where launch_id='${p.launch_id}';
      update ops.scrape_runs set status='success',finished_at=clock_timestamp() where id='${p.run_id}';
      update app.competitor_accounts set locked_until=null where id='${account}';
      insert into ops.cost_ledger(provider,category,quantity,unit,cost_usd,run_id,competitor_id,platform,meta)values('apify','scrape',1,'result',${usage},'${p.run_id}','${competitor}','website_work_page',jsonb_build_object('apify_run_id','${providerId}','account_id','${account}','actor','aYG0l9s7dbB7j3gbS','cost_key','apify:${providerId}:${account}'));`);
    }

    test('unsettled or ambiguously acknowledged launch cannot authorize the next start or replay a POST grant', () => {
      provision();
      activate();
      const first = launchPacket(parentRun());
      assert.equal(JSON.parse(psql(launchSql(first), 'n8n_writer')).authorized, true);
      const replay = JSON.parse(psql(launchSql(first), 'n8n_writer'));
      assert.equal(replay.authorized, false);
      assert.equal(replay.reason, 'reconciliation_required');
      const second = launchPacket(parentRun());
      denial(
        `perform ops.authorize_apify_launch(${literal(JSON.stringify(second))}::jsonb);`,
        '55000',
        'n8n_writer',
      );
      assert.equal(psql('select count(*) from ops.apify_launch_admissions;'), '1');
    });

    test('two concurrent actual writer launch calls produce one durable first-start admission', async () => {
      provision();
      activate();
      const packets = [launchPacket(parentRun()), launchPacket(parentRun())];
      const result = await Promise.all(
        packets.map((p) => queryChild('select pg_sleep(0.1);' + launchSql(p))),
      );
      assert.equal(result.filter((r) => r.code === 0).length, 1);
      assert.equal(result.filter((r) => r.code !== 0 && /55000/.test(r.error)).length, 1);
      assert.equal(JSON.parse(result.find((r) => r.code === 0).out).authorized, true);
      assert.equal(psql('select count(*) from ops.apify_launch_admissions;'), '1');
    });

    test('each start retains the exact USD1 cap and uncertain or overspent prior usage blocks a later start', () => {
      provision();
      activate();
      const first = launchPacket(parentRun());
      const altered = { ...first, max_total_charge_usd: 1.01 };
      denial(
        `perform ops.authorize_apify_launch(${literal(JSON.stringify(altered))}::jsonb);`,
        '55000',
        'n8n_writer',
      );
      assert.equal(psql('select count(*) from ops.apify_launch_admissions;'), '0');
      assert.equal(JSON.parse(psql(launchSql(first), 'n8n_writer')).authorized, true);
      settleLaunch(first);
      const second = launchPacket(parentRun());
      for (const value of ['1.01', 'null']) {
        psql(`update ops.apify_runs set usage_usd=${value};`);
        denial(
          `perform ops.authorize_apify_launch(${literal(JSON.stringify(second))}::jsonb);`,
          '55000',
          'n8n_writer',
        );
        psql('update ops.apify_runs set usage_usd=1;');
      }
      assert.equal(psql('select count(*) from ops.apify_launch_admissions;'), '1');
    });

    test('a later owner-registered window retains the first settled USD1 start and the USD2/two-start ceiling', () => {
      provision();
      activate();
      const first = launchPacket(parentRun());
      assert.equal(JSON.parse(psql(launchSql(first), 'n8n_writer')).authorized, true);
      settleLaunch(first);
      psql(control('close'), 'n8n_writer');
      psql(
        `update app.competitors set status='archived' where id='${competitor}';update app.competitor_accounts set status='paused' where id='${account}';`,
      );
      const preserved = psql(
        `select jsonb_build_object('windows',(select jsonb_agg(to_jsonb(w) order by window_id) from ops.foundation_gateway_rate_windows w),'launches',(select jsonb_agg(to_jsonb(l)) from ops.apify_launch_admissions l),'costs',(select jsonb_agg(to_jsonb(c)) from ops.cost_ledger c));`,
      );
      provision(thirdWindow);
      assert.equal(psql(`select count(*) from ops.apify_launch_admissions;`), '1');
      assert.equal(psql(`select sum(max_total_charge_usd) from ops.apify_launch_admissions;`), '1.000000');
      assert.equal(psql(`select sum(cost_usd) from ops.cost_ledger;`), '1.000000');
      assert.equal(
        psql(
          `select jsonb_build_object('windows',(select jsonb_agg(to_jsonb(w) order by window_id) from ops.foundation_gateway_rate_windows w where window_id<>'${thirdWindow}'),'launches',(select jsonb_agg(to_jsonb(l)) from ops.apify_launch_admissions l),'costs',(select jsonb_agg(to_jsonb(c)) from ops.cost_ledger c));`,
        ),
        preserved,
      );
      activate();
      const second = launchPacket(parentRun(thirdWindow), thirdWindow);
      assert.equal(JSON.parse(psql(launchSql(second), 'n8n_writer')).authorized, true);
      settleLaunch(second);
      const third = launchPacket(parentRun(thirdWindow), thirdWindow);
      denial(
        `perform ops.authorize_apify_launch(${literal(JSON.stringify(third))}::jsonb);`,
        '55000',
        'n8n_writer',
      );
      assert.equal(psql('select count(*) from ops.apify_launch_admissions;'), '2');
      assert.equal(psql('select sum(max_total_charge_usd) from ops.apify_launch_admissions;'), '2.000000');
      assert.equal(psql('select sum(cost_usd) from ops.cost_ledger;'), '2.000000');
    });

    function itemProof(itemId) {
      const launch = launchPacket(parentRun());
      assert.equal(JSON.parse(psql(launchSql(launch), 'n8n_writer')).authorized, true);
      settleLaunch(launch);
      const apifyRunId = 'Synthetic_' + launch.launch_id.replaceAll('-', '');
      const terminal = {
        apifyRunId,
        parentRunId: launch.run_id,
        accountId: account,
        status: 'SUCCEEDED',
        datasetId: 'SyntheticDataset',
        usageTotalUsd: 1,
      };
      const payload = { id: itemId };
      for (const [operation, offset, result] of [
        ['apify.terminal.read', 30, { terminal }],
        ['apify.terminal.read', 20, { terminal }],
        ['apify.dataset.read', 10, { terminal, rows: [payload] }],
      ])
        psql(
          `insert into ops.foundation_gateway_requests(window_id,request_id,operation,payload_sha256,state,lease_expires_at,completed_at,result)values('${freshWindow}','${randomUUID()}',${literal(operation)},repeat('1',64),'completed',clock_timestamp(),clock_timestamp()-interval '${offset} seconds',${literal(JSON.stringify(result))}::jsonb);`,
        );
      return {
        apifyRunId,
        status: 'SUCCEEDED',
        datasetId: 'SyntheticDataset',
        usageUsd: 1,
        groups: [{ account_id: account, normalizer_version: 'synthetic.v1', items: [{ payload }] }],
      };
    }
    test('actual transaction item guard preserves equal replay and rolls back a second distinct business item', () => {
      provision();
      activate();
      // The real guard and its trusted-read proof are under test. Only the nested
      // atomic business RPC is a fixture-only effect; this is no ingestion claim.
      psql(`create or replace function ops.process_apify_run(p_run text,p_status text,p_dataset text,p_usage numeric,p_groups jsonb)returns jsonb language plpgsql set search_path='' as $effect$begin
      insert into app.items(id,competitor_id,account_id)values((p_groups->0->'items'->0->'payload'->>'id')::uuid,'${competitor}','${account}')on conflict(id)do nothing;
      return jsonb_build_object('syntheticEffect',true);end;$effect$;`);
      const firstId = randomUUID(),
        first = itemProof(firstId);
      psql(
        `select ops.foundation_gateway_process('${freshWindow}',${literal(JSON.stringify(first))}::jsonb);`,
      );
      assert.equal(psql('select count(*) from app.items;'), '1');
      psql(
        `select ops.foundation_gateway_process('${freshWindow}',${literal(JSON.stringify(first))}::jsonb);`,
      );
      assert.equal(psql('select count(*) from app.items;'), '1');
      const second = itemProof(randomUUID());
      denial(
        `perform ops.foundation_gateway_process('${freshWindow}',${literal(JSON.stringify(second))}::jsonb);`,
        '55000',
      );
      assert.equal(psql('select count(*) from app.items;'), '1');
      assert.equal(psql(`select id from app.items;`), firstId);
      assert.equal(psql('select count(*) from ops.apify_launch_admissions;'), '2');
    });
  },
);
