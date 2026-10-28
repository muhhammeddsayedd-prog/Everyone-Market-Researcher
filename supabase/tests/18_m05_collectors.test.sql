begin;
set local search_path=public,extensions;
select extensions.no_plan();
select extensions.ok(has_function_privilege('n8n_writer','ops.m05_execute(uuid,text,jsonb)','EXECUTE'),'writer has fixed M05 entrypoint');
select extensions.ok(not has_function_privilege('api_agent','ops.m05_execute(uuid,text,jsonb)','EXECUTE'),'agent cannot execute M05 mutations');
select extensions.ok(not has_function_privilege('anon','ops.m05_execute(uuid,text,jsonb)','EXECUTE') and not has_function_privilege('authenticated','ops.m05_execute(uuid,text,jsonb)','EXECUTE'),'web public roles cannot execute M05 mutations');
select extensions.ok(not has_function_privilege('n8n_writer','ops.m05_assert_claim(uuid,uuid)','EXECUTE'),'claim helper remains private');
select extensions.ok(not has_function_privilege('n8n_writer','ops.m05_finalize(uuid)','EXECUTE'),'finalizer remains private');
select extensions.ok(not has_table_privilege('n8n_writer','ops.m05_jobs','SELECT,INSERT,UPDATE,DELETE'),'writer has no job-table grants');
select extensions.ok(not has_table_privilege('api_agent','ops.m05_quota','SELECT,INSERT,UPDATE,DELETE'),'agent has no quota-table grants');
select extensions.is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ops' and c.relname in ('m05_jobs','m05_quota') and c.relrowsecurity),2,'both new private tables enable RLS');
select extensions.ok((select bool_and(prosecdef and proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ops' and p.proname in ('m05_execute','m05_assert_claim','m05_finalize','mark_website_page','save_employee_snapshot','m05_resolve_youtube')),'all new definers retain empty search path');
select extensions.throws_ok($q$select ops.m05_execute(gen_random_uuid(),'m05.arbitrary','{}')$q$,'22023','invalid M05 operation','arbitrary operation denied');
select extensions.throws_ok($q$select ops.m05_execute(gen_random_uuid(),'m05.start','{"workflow":"WF-21","platform":"website_work_page","mode":"backfill","env":"prod","execution_id":"local"}')$q$,'42501','M05 dev workflow identity required','production start denied');
select extensions.throws_ok($q$select ops.m05_execute(gen_random_uuid(),'m05.start','{"workflow":"WF-18","platform":"youtube","mode":"backfill","env":"dev","execution_id":"local"}')$q$,'42501','M05 dev workflow identity required','source/workflow mismatch denied');
select extensions.throws_ok($q$select ops.mark_website_page('https://m05.example.com/unknown','crawled',null)$q$,'42501','owned discovered website page required','unknown website page denied');
select extensions.throws_ok($q$select ops.mark_website_page('https://m05.example.com/unknown','removed',null)$q$,'22023','invalid website settlement status','collector cannot remove or restore human decisions');
select extensions.ok(exists(select 1 from information_schema.columns where table_schema='app' and table_name='employee_snapshots' and column_name='coverage' and is_nullable='NO'),'employee coverage explicitly stored');
select extensions.ok((select count(*)=2 and bool_and(numeric_precision=12 and numeric_scale=6)
  from information_schema.columns where table_schema='ops' and table_name='collector_launches'
    and column_name in ('max_actor_usd','max_total_usd')),'allocation amounts retain exact numeric(12,6) storage');
select extensions.is((select data_type from information_schema.columns where table_schema='ops'
  and table_name='collector_launches' and column_name='max_actor_starts'),'integer','start allocation retains PostgreSQL integer capacity');
-- Invalid monetary input must be rejected before any allocation/claim lookup;
-- these are public synthetic identities, never a real provider launch.
with base(args) as (values ('{"run_id":"18000000-0000-4000-8000-000000000001","launch_id":"18000000-0000-4000-8000-000000000002","actor_id":"apify/website-content-crawler","pass":"primary","account_ids":["18000000-0000-4000-8000-000000000003"],"purpose":"backfill","results_limit":1,"actor_input":{},"approval_id":"18000000-0000-4000-8000-000000000004","max_actor_starts":2,"max_actor_usd":1,"max_total_usd":2}'::jsonb)),
cases(patch,label) as (values
 ('{"max_actor_usd":"NaN","max_total_usd":"NaN"}'::jsonb,'numeric NaN strings cannot allocate'),
 ('{"max_actor_usd":"Infinity","max_total_usd":"Infinity"}'::jsonb,'infinite strings cannot allocate'),
 ('{"max_actor_usd":"1"}'::jsonb,'numeric-looking strings cannot allocate'),
 ('{"max_actor_usd":null}'::jsonb,'null amount cannot allocate'),
 ('{"max_actor_usd":0}'::jsonb,'zero amount cannot allocate'),
 ('{"max_actor_usd":-1}'::jsonb,'negative amount cannot allocate'),
 ('{"max_actor_usd":0.00000001}'::jsonb,'round-to-zero amount cannot allocate'),
 ('{"max_actor_usd":0.1234567}'::jsonb,'fractional amount cannot round silently'),
 ('{"max_total_usd":2.0000001}'::jsonb,'total amount cannot round silently'),
 ('{"max_total_usd":1000000}'::jsonb,'storage overflow cannot allocate'),
 ('{"max_total_usd":0.5}'::jsonb,'per-run amount cannot exceed its allocation total'),
 ('{"max_actor_starts":"2"}'::jsonb,'string start count cannot allocate'),
 ('{"max_actor_starts":1.5}'::jsonb,'fractional start count cannot allocate'),
 ('{"max_actor_starts":2147483648}'::jsonb,'integer overflow cannot allocate'))
select extensions.throws_ok(format($q$select ops.m05_execute(gen_random_uuid(),'m05.launch',%L::jsonb)$q$,(base.args||cases.patch)::text),
  '22023','finite M05 launch allocation required',cases.label) from base cross join cases;
select * from extensions.finish();
rollback;
