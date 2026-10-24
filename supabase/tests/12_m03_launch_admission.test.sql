begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
select extensions.has_function('ops','authorize_apify_launch',array['jsonb'],'durable atomic launch admission exists');
select extensions.has_function('ops','reconcile_apify_launch',array['jsonb'],'original launch registration exists');
select extensions.has_function('ops','get_apify_launch',array['uuid'],'launch readback exists');
select extensions.has_function('ops','reject_apify_callback',array['jsonb'],'exact callback rejection audit exists');
select extensions.is((select count(*)::int from ops.apify_launch_approvals),0,'migration enables no actor approval');
select extensions.is((select count(*)::int from ops.apify_launch_admissions),0,'migration creates no launch receipt');
create temporary table m03_original_gateway as select jsonb_build_object(
  'windows',(select jsonb_agg(to_jsonb(w) order by window_id) from ops.worker_gateway_rate_windows w),
  'requests',(select jsonb_agg(to_jsonb(r) order by request_id) from ops.worker_gateway_requests r),
  'leases',(select jsonb_agg(to_jsonb(l) order by slot) from ops.worker_gateway_leases l)) as value;
select extensions.is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='ops' and c.relname in ('apify_launch_approvals','apify_launch_admissions') and c.relrowsecurity),2,'both new tables enforce RLS');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname in ('authorize_apify_launch','reconcile_apify_launch','get_apify_launch','reject_apify_callback')
  and p.prosecdef and 'search_path=""'=any(p.proconfig)),4,'all exposed RPCs use definer with empty search path');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname in ('authorize_apify_launch','reconcile_apify_launch','get_apify_launch','reject_apify_callback')
  and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')
    or has_function_privilege('api_agent',p.oid,'EXECUTE')
    or exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'))),0,'browser, agent and PUBLIC cannot execute');
grant n8n_writer to postgres with inherit false;
grant n8n_writer to postgres with set true;
create temporary table m03_launch_results(label text primary key,value jsonb);
grant all on m03_launch_results to n8n_writer;
create function pg_temp.launch_input() returns jsonb language sql as $$
  select '{"startUrls":[{"url":"https://everyone.film/about-everyone"}],"crawlerType":"cheerio","maxCrawlDepth":0,"maxCrawlPages":1,"saveMarkdown":true,"proxyConfiguration":{"useApifyProxy":true},"saveFiles":false,"saveContentTypes":"","summarize":false,"useSitemaps":false,"useLlmsTxt":false,"maxRequestRetries":0,"maxSessionRotations":0,"maxResults":1,"maxConcurrency":1,"ignoreHttpsErrors":false,"respectRobotsTxtFile":true}'::jsonb;
$$;
create function pg_temp.launch_args(p_ordinal int default 1) returns jsonb language sql as $$
  select jsonb_build_object('window_id','20000000-0000-4000-8000-000000000011',
    'launch_id',case p_ordinal when 1 then '20000000-0000-4000-8000-000000000001'
      when 2 then '20000000-0000-4000-8000-000000000002' else '20000000-0000-4000-8000-000000000003' end,
    'run_id',current_setting('test.m03_launch_run_'||p_ordinal),'account_id','20000000-0000-4000-8000-000000000012',
    'actor_id','aYG0l9s7dbB7j3gbS','actor_build','0.3.99','input',pg_temp.launch_input(),
    'memory_mb',1024,'timeout_seconds',300,'max_total_charge_usd',0.1,'execution_id','launch-'||p_ordinal);
$$;
create function pg_temp.reconcile_args() returns jsonb language sql as $$
  select jsonb_build_object('launch_id','20000000-0000-4000-8000-000000000001',
    'apify_run_id','M03LaunchOriginal','actor_id','aYG0l9s7dbB7j3gbS','actor_build','0.3.99',
    'started_at',ops.get_apify_launch('20000000-0000-4000-8000-000000000001')->'post_intent_at',
    'input',pg_temp.launch_input());
$$;
create function pg_temp.launch_group() returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('account_id','20000000-0000-4000-8000-000000000012',
    'normalizer_version','smoke_website_stub.v1','items',jsonb_build_array(jsonb_build_object(
      'platform','website_work_page','external_id',left(encode(extensions.digest('https://everyone.film/about-everyone','sha256'),'hex'),32),
      'actor','apify/website-content-crawler','item_type','project_page','url','https://everyone.film/about-everyone',
      'published_at',null,'title','Everyone film','caption','# Everyone film','metrics','{}'::jsonb,
      'payload',jsonb_build_object('url','https://everyone.film/about-everyone','markdown','# Everyone film',
        'metadata',jsonb_build_object('title','Everyone film'))))));
$$;
-- LOCAL rollback fixtures only. No provider request, active approval or hosted data.
insert into app.competitors(company_code,slug,name,priority_tier)
values('C999','emr-smoke-test','M03 launch rollback fixture','adjacent')
on conflict(company_code) do update set slug=excluded.slug,status='active';
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,backfill_status)
select '20000000-0000-4000-8000-000000000012',id,'website_work_page','m03-launch-fixture','https://everyone.film/about-everyone','pending'
from app.competitors where company_code='C999';
insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)
select 'system','m03_smoke_setup.v1','m03_smoke_fixture_created','competitor',id::text,
  jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf','competitor_id',id,
    'account_id','20000000-0000-4000-8000-000000000012') from app.competitors where company_code='C999';
select set_config('test.m03_launch_run_1',ops.start_run('WF-99','website_work_page','manual','dev','launch-1')::text,true);
select set_config('test.m03_launch_run_2',ops.start_run('WF-99','website_work_page','manual','dev','launch-2')::text,true);
select set_config('test.m03_launch_run_3',ops.start_run('WF-99','website_work_page','manual','dev','launch-3')::text,true);
set local role n8n_writer;
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args())$$,'22023',null,'unregistered foundation window cannot authorize an actor');
reset role;
-- SQL15 requires an owner-registered fixed dev-family window independently of
-- actor approval. This rollback-only fixture intentionally leaves approval
-- absent, so the retained missing-approval assertion still tests that boundary.
do $local_registration$
begin
  if session_user not in ('postgres','supabase_admin') or current_user not in ('postgres','supabase_admin') then
    raise exception using errcode='42501',message='LOCAL_TEST_OWNER_REQUIRED';
  end if;
end;
$local_registration$;
insert into ops.foundation_gateway_rate_windows(namespace,window_id,project_ref,environment)
values('m03-foundation-dev','20000000-0000-4000-8000-000000000011','zmotjsbzhzjvpelxvxlf','dev');
set local role n8n_writer;
select extensions.throws_ok($$select * from ops.apify_launch_approvals$$,'42501',null,'writer cannot read approvals directly');
select extensions.throws_ok($$insert into ops.apify_launch_approvals default values$$,'42501',null,'writer cannot create actor approval');
select extensions.throws_ok($$select * from ops.apify_launch_admissions$$,'42501',null,'writer cannot read admissions directly');
select extensions.throws_ok($$select ops.m03_smoke_launch_input()$$,'42501',null,'internal input helper is not granted');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args())$$,'55000',null,'missing owner approval blocks every actor');
reset role;
insert into ops.apify_launch_approvals(window_id,approval_reference,project_ref,actor_build,max_total_charge_usd,batch_max_usd,not_before,expires_at)
values('20000000-0000-4000-8000-000000000011','local-rollback-only','zmotjsbzhzjvpelxvxlf','0.3.99',0.1,0.2,
  clock_timestamp()-interval '1 minute',clock_timestamp()+interval '30 minutes');
select extensions.throws_ok($$insert into ops.apify_launch_approvals(window_id,approval_reference,project_ref,actor_build,max_total_charge_usd,batch_max_usd,not_before,expires_at)
  values('76c2ad42-c094-4ba4-9a0b-566e19b97780','local-only','zmotjsbzhzjvpelxvxlf','0.3.99',0.1,0.2,now(),now()+interval '30 minutes')$$,
  '23514',null,'closed GW-01 window can never become an actor approval');
update ops.apify_launch_approvals set closed_at=clock_timestamp();
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args())$$,'55000',null,'closed approval blocks launch');
update ops.apify_launch_approvals set closed_at=null,not_before=clock_timestamp()-interval '31 minutes',expires_at=clock_timestamp()-interval '1 minute';
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args())$$,'55000',null,'expired approval blocks launch');
update ops.apify_launch_approvals set not_before=clock_timestamp()+interval '1 minute',expires_at=clock_timestamp()+interval '31 minutes';
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args())$$,'55000',null,'future approval blocks launch');
update ops.apify_launch_approvals set not_before=clock_timestamp()-interval '1 minute',expires_at=clock_timestamp()+interval '30 minutes';
set local role n8n_writer;
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"actor_build":"latest"}')$$,'22023',null,'mutable build tags cannot launch');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"actor_build":"0.0.124"}')$$,'55000',null,'different immutable build cannot launch');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"input":{"startUrls":[{"url":"https://example.test"}]}}')$$,'22023',null,'different public URL cannot launch');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"memory_mb":2048}')$$,'22023',null,'memory cannot increase');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"timeout_seconds":3600}')$$,'22023',null,'timeout cannot increase');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"max_total_charge_usd":0.2}')$$,'55000',null,'charge ceiling must match owner approval exactly');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"authorization":"synthetic"}')$$,'22023',null,'unknown launch fields rejected');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"run_id":true}')$$,'22023',null,'non-string identity rejected');
insert into m03_launch_results values('first',ops.authorize_apify_launch(pg_temp.launch_args()));
select extensions.is((select value->>'authorized' from m03_launch_results where label='first'),'true','first exact launch receives one permit');
select extensions.is((select value#>>'{launch,ordinal}' from m03_launch_results where label='first'),'1','first receipt consumes slot one');
select extensions.is(ops.authorize_apify_launch(pg_temp.launch_args())->>'authorized','false','same exact authorization is not a second POST permit');
select extensions.is(ops.authorize_apify_launch(pg_temp.launch_args())->>'reason','reconciliation_required','ambiguous original requires reconciliation');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args()||'{"execution_id":"different"}')$$,'55000',null,'launch ID cannot acquire changed execution');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args(2))$$,'55000',null,'unknown first POST prevents second actor start');
select extensions.throws_ok($$select ops.reconcile_apify_launch(pg_temp.reconcile_args()||'{"actor_build":"0.0.124"}')$$,'55000',null,'wrong original build rejected');
select extensions.throws_ok($$select ops.reconcile_apify_launch(pg_temp.reconcile_args()||'{"actor_id":"different"}')$$,'22023',null,'wrong actor rejected');
select extensions.throws_ok($$select ops.reconcile_apify_launch(pg_temp.reconcile_args()||'{"input":{}}')$$,'22023',null,'wrong original input rejected');
select extensions.throws_ok($$select ops.reconcile_apify_launch(pg_temp.reconcile_args()||'{"started_at":"2000-01-01T00:00:00Z"}')$$,'55000',null,'older unrelated actor cannot fill ambiguous launch');
select extensions.throws_ok($$select ops.reconcile_apify_launch(pg_temp.reconcile_args()||'{"started_at":"tomorrow"}')$$,'22023',null,'non-ISO provider timestamp rejected');
select extensions.is(ops.reconcile_apify_launch(pg_temp.reconcile_args())->>'registered','true','authenticated original projection registers exact original');
select extensions.is(ops.get_apify_launch('20000000-0000-4000-8000-000000000001')->>'apify_run_id','M03LaunchOriginal','original actor ID retained durably');
select extensions.is(ops.reconcile_apify_launch(pg_temp.reconcile_args())->>'registered','true','same original readback registers idempotently');
select extensions.throws_ok($$select ops.reconcile_apify_launch(pg_temp.reconcile_args()||'{"apify_run_id":"M03Replacement"}')$$,'55000',null,'a replacement actor never overwrites original');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args(2))$$,'55000',null,'registered but unsettled original still blocks second start');
insert into m03_launch_results values('processed-first',ops.process_apify_run('M03LaunchOriginal','SUCCEEDED','M03LaunchDataset',0.01,pg_temp.launch_group()));
select extensions.is((select value->>'items_new' from m03_launch_results where label='processed-first'),'1','first atomic callback inserts one distinct item');
insert into m03_launch_results values('second',ops.authorize_apify_launch(pg_temp.launch_args(2)));
select extensions.is((select value->>'authorized' from m03_launch_results where label='second'),'true','settled original permits the second sequential actor');
select extensions.is((select value#>>'{launch,ordinal}' from m03_launch_results where label='second'),'2','second actor consumes a distinct slot');
select extensions.throws_ok($$select ops.authorize_apify_launch(pg_temp.launch_args(3))$$,'55000',null,'third actor is prohibited');
select extensions.lives_ok($$select ops.reconcile_apify_launch(jsonb_build_object('launch_id','20000000-0000-4000-8000-000000000002',
  'apify_run_id','M03LaunchSecond','actor_id','aYG0l9s7dbB7j3gbS','actor_build','0.3.99','input',pg_temp.launch_input(),
  'started_at',ops.get_apify_launch('20000000-0000-4000-8000-000000000002')->'post_intent_at'))$$,'second genuine original registers separately');
insert into m03_launch_results values('processed-second',ops.process_apify_run('M03LaunchSecond','SUCCEEDED','M03LaunchDataset2',0.02,pg_temp.launch_group()));
select extensions.is((select value->>'items_new' from m03_launch_results where label='processed-second'),'0','second genuine actor imports zero new items');
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'apify_run_id' in ('M03LaunchOriginal','M03LaunchSecond')),2,'two genuine actors retain two costs');
select extensions.is((select sum(cost_usd) from ops.cost_ledger where meta->>'apify_run_id' in ('M03LaunchOriginal','M03LaunchSecond')),0.03::numeric,'different actual costs both retained');
select extensions.is((select count(*)::int from ops.apify_launch_admissions),2,'replays do not consume extra start quota');
select extensions.is((select count(*)::int from ops.apify_runs where apify_run_id='M03Replacement'),0,'rejected replacement never registered');
-- Exact rejection auditing changes only its durable audit record, not an item,
-- parent/account, cost receipt, queue or notification/cooldown state.
insert into m03_launch_results values('before-rejection',jsonb_build_object(
  'items',(select count(*) from app.items),'costs',(select count(*) from ops.cost_ledger),
  'runs',(select jsonb_agg(to_jsonb(r) order by id) from ops.scrape_runs r),
  'accounts',(select jsonb_agg(to_jsonb(a) order by id) from app.competitor_accounts a),
  'notify',(select count(*) from ops.audit_log where action in ('notify_logged','workflow_notify_claimed','workflow_error')),
  'ai',(select queue_length from pgmq.metrics('ai_extract')),'media',(select queue_length from pgmq.metrics('media'))));
set local role n8n_writer;
select extensions.is(ops.reject_apify_callback('{"execution_id":"reject-one","apify_run_id":"M03Forged","reason":"unregistered"}')->>'recorded','true','unknown callback records exact rejection once');
select extensions.is(ops.reject_apify_callback('{"execution_id":"reject-one","apify_run_id":"M03Forged","reason":"unregistered"}')->>'recorded','false','same callback rejection replay is idempotent');
select extensions.throws_ok($$select ops.reject_apify_callback('{"execution_id":"reject-one","apify_run_id":"M03Forged","reason":"actor_mismatch"}')$$,'55000',null,'same rejection key cannot change reason');
select extensions.throws_ok($$select ops.reject_apify_callback('{"execution_id":"reject-extra","apify_run_id":"M03Forged","reason":"unregistered","secret":"synthetic"}')$$,'22023',null,'rejection excludes arbitrary sensitive fields');
select extensions.throws_ok($$select ops.reject_apify_callback('{"execution_id":"reject-bad","apify_run_id":"M03Forged","reason":"Bearer synthetic"}')$$,'22023',null,'rejection reason must be a fixed enum');
select extensions.throws_ok($$select ops.reject_apify_callback('{"execution_id":"reject-bad","apify_run_id":"https://example.test","reason":"unregistered"}')$$,'22023',null,'rejection cannot store arbitrary URLs');
reset role;
select extensions.is((select count(*)::int from ops.audit_log where action='apify_callback_rejected' and after->>'execution_id'='reject-one'),1,'exact durable action exists once');
select extensions.is((select after from ops.audit_log where action='apify_callback_rejected' and after->>'execution_id'='reject-one'),
  '{"execution_id":"reject-one","apify_run_id":"M03Forged","reason":"unregistered"}'::jsonb,'rejection stores only bounded correlation metadata');
select extensions.is(jsonb_build_object(
  'items',(select count(*) from app.items),'costs',(select count(*) from ops.cost_ledger),
  'runs',(select jsonb_agg(to_jsonb(r) order by id) from ops.scrape_runs r),
  'accounts',(select jsonb_agg(to_jsonb(a) order by id) from app.competitor_accounts a),
  'notify',(select count(*) from ops.audit_log where action in ('notify_logged','workflow_notify_claimed','workflow_error')),
  'ai',(select queue_length from pgmq.metrics('ai_extract')),'media',(select queue_length from pgmq.metrics('media'))),
  (select value from m03_launch_results where label='before-rejection'),'forged callback has no item/cost/run/account/queue/notify mutation');
select extensions.is(jsonb_build_object(
  'windows',(select jsonb_agg(to_jsonb(w) order by window_id) from ops.worker_gateway_rate_windows w),
  'requests',(select jsonb_agg(to_jsonb(r) order by request_id) from ops.worker_gateway_requests r),
  'leases',(select jsonb_agg(to_jsonb(l) order by slot) from ops.worker_gateway_leases l)),
  (select value from m03_original_gateway),'all original GW-01 window/request/lease state remains unchanged');
select * from extensions.finish();
rollback;
