-- Local rollback/session-authorization simulation, not a hosted login receipt.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
select extensions.has_function('ops','foundation_gateway_admit',array['uuid','uuid','text','jsonb','text'],'separate foundation admission exists');
select extensions.has_function('ops','foundation_gateway_execute',array['uuid','uuid','text','jsonb'],'fixed foundation dispatcher exists');
select extensions.has_function('ops','foundation_gateway_status',array['uuid','uuid'],'durable foundation readback exists');
select extensions.has_function('ops','foundation_gateway_read_context',array['uuid','uuid','text'],'external read has a durable one-shot context');
select extensions.has_function('ops','foundation_gateway_complete_read',array['uuid','uuid','text','jsonb'],'external read has atomic completion');
select extensions.is((select count(*)::int from ops.foundation_gateway_rate_windows),0,'source creates no active foundation window');
select extensions.is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='ops' and c.relname like 'foundation_gateway_%' and c.relkind='r' and c.relrowsecurity),4,'all four new tables enforce RLS');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname like 'foundation_gateway_%' and
    (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')
      or has_function_privilege('api_agent',p.oid,'execute') or exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'))),0,'no foundation helper is browser/agent/PUBLIC callable');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname like 'foundation_gateway_%' and has_function_privilege('n8n_writer',p.oid,'execute')),5,'writer has exactly five bounded wrappers');
create temporary table foundation_results(label text primary key,value jsonb);
grant all on foundation_results to n8n_writer;
insert into foundation_results select 'original-gw01',jsonb_build_object(
  'windows',(select jsonb_agg(to_jsonb(w) order by window_id) from ops.worker_gateway_rate_windows w),
  'requests',(select jsonb_agg(to_jsonb(r) order by request_id) from ops.worker_gateway_requests r),
  'leases',(select jsonb_agg(to_jsonb(l) order by slot) from ops.worker_gateway_leases l));
create function pg_temp.foundation_id(p int) returns uuid language sql as $$
  select ('30000000-0000-4000-8000-'||lpad(p::text,12,'0'))::uuid;
$$;
create function pg_temp.foundation_admit(p_id int,p_operation text default 'identity.read',p_args jsonb default '{}',p_mode text default 'admit')
returns jsonb language sql as $$ select ops.foundation_gateway_admit('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(p_id),p_operation,p_args,p_mode); $$;
create function pg_temp.foundation_execute(p_id int,p_operation text default 'identity.read',p_args jsonb default '{}')
returns jsonb language sql as $$ select ops.foundation_gateway_execute('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(p_id),p_operation,p_args); $$;
create function pg_temp.foundation_call(p_id int,p_operation text,p_args jsonb default '{}')
returns jsonb language plpgsql as $$ declare a jsonb; begin a:=pg_temp.foundation_admit(p_id,p_operation,p_args); if a->>'state'<>'admitted' then return a; end if;
  return pg_temp.foundation_execute(p_id,p_operation,p_args); end; $$;
create function pg_temp.foundation_status(p_id int) returns jsonb language sql as $$
  select ops.foundation_gateway_status('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(p_id));
$$;
select extensions.throws_ok($$select pg_temp.foundation_admit(1)$$,'42501',null,'administrator session is not a restricted writer login');
grant n8n_writer to postgres with inherit false;
grant n8n_writer to postgres with set true;
set local role n8n_writer;
select extensions.throws_ok($$select pg_temp.foundation_admit(1)$$,'42501',null,'administrator plus SET ROLE is not a restricted login');
select extensions.throws_ok($$select ops.foundation_gateway_provision('{}')$$,'42501',null,'writer cannot provision or reset a window');
reset role;
select extensions.lives_ok($$select ops.foundation_gateway_provision('{"audience":"https://everyone-market-researcher-local-fixture.vercel.app","commitSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","deploymentId":"dpl_M03LocalFixture","approvalReference":"local-rollback-only","actorBuild":"0.3.99","maxTotalChargeUsd":0.1,"batchMaxUsd":0.2}')$$,'owner provisions exact local rollback window only');
select extensions.throws_ok($$select ops.foundation_gateway_provision('{"audience":"https://everyone-market-researcher-local-fixture.vercel.app","commitSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","deploymentId":"dpl_M03LocalFixture","approvalReference":"local-rollback-only","actorBuild":"0.3.99","maxTotalChargeUsd":0.1,"batchMaxUsd":0.2}')$$,'23505',null,'owner cannot re-provision the same allowance');
select extensions.ok((select starts_at is null and expires_at is null and admitted_count=0 from ops.foundation_gateway_rate_windows),'provisioning does not start the gateway clock');
set local session authorization n8n_writer;
select extensions.throws_ok($$select * from ops.foundation_gateway_requests$$,'42501',null,'actual writer principal cannot read raw request ledger');
select extensions.throws_ok($$select ops.foundation_gateway_validate('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(1),'identity.read','{}')$$,'42501',null,'actual writer cannot call internal validator');
select extensions.throws_ok($$select pg_temp.foundation_admit(1,'identity.read','{"sql":"select 1"}')$$,'22023',null,'no arbitrary SQL field');
select extensions.throws_ok($$select pg_temp.foundation_admit(1,'arbitrary.rpc','{}')$$,'22023',null,'no arbitrary RPC alias');
select extensions.throws_ok($$select pg_temp.foundation_admit(1,'settings.read','{"key":"domain_autojoin"}')$$,'22023',null,'only three approved settings are visible');
select extensions.throws_ok($$select pg_temp.foundation_admit(1,'run.start','{"env":"prod","executionId":"one","mode":"manual","platform":null,"workflow":"WF-99"}')$$,'22023',null,'production environment rejected');
select extensions.throws_ok($$select pg_temp.foundation_admit(1,'run.start','{"env":"dev","executionId":"one","mode":"manual","platform":null,"workflow":"UNRELATED"}')$$,'22023',null,'unknown workflow rejected');
select extensions.throws_ok($$select pg_temp.foundation_admit(1,'error.log','{"entry":{"kind":"error","workflow":"WF-99","execution_id":"one","node":"Workflow","message":"workflow_failed","secret":"synthetic"}}')$$,'22023',null,'error audit excludes arbitrary fields');
select extensions.is(pg_temp.foundation_admit(1)->>'state','admitted','first request starts separate foundation clock');
select extensions.is(pg_temp.foundation_execute(1)#>>'{result,sessionUser}','n8n_writer','execution observes simulated restricted session principal');
reset session authorization;
select extensions.ok((select w.starts_at=a.not_before and w.expires_at=a.expires_at
  from ops.foundation_gateway_rate_windows w join ops.apify_launch_approvals a using(window_id)),
  'first gateway admission starts exactly the same actor-approval clock');
insert into ops.apify_runs(apify_run_id,actor_id,account_ids,purpose)
values('FoundationUnrelated','apify/website-content-crawler',array['30000000-0000-4000-8000-000000000999']::uuid[],'daily');
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_call(33,'apify.read','{"apifyRunId":"FoundationUnrelated"}')#>'{result,registered}','null'::jsonb,
  'outside-window known callback is safely unregistered for exact rejection auditing');
select extensions.is(pg_temp.foundation_admit(1)->>'replayed','true','cached admission is explicitly replayed');
select extensions.is(pg_temp.foundation_execute(1)->>'replayed','true','cached execution is explicitly replayed');
select extensions.is(pg_temp.foundation_status(1)->>'operation','identity.read','status carries original operation type');
select extensions.is(pg_temp.foundation_status(1)->>'replayed','true','status is always a durable replay receipt');
select extensions.is(pg_temp.foundation_status(999)->>'state','absent','unknown target is absent');
select extensions.is(pg_temp.foundation_status(999)->>'operation','request.status','absent receipt does not invent an original operation');
select extensions.is(pg_temp.foundation_call(2,'settings.read','{"key":"daily_budget_usd"}')#>>'{result,value}','25','documented daily budget retained');
select extensions.is(pg_temp.foundation_call(3,'health.guard')#>>'{result,stats_daily_enabled}','false','stats guard stays off');
select extensions.ok(pg_temp.foundation_call(4,'prices.read')#>'{result,prices}' ? 'apify/instagram-scraper:result','price book is callable with a known existing key');
select extensions.is(pg_temp.foundation_call(5,'cost.log','{"entries":[]}')#>>'{result,inserted}','0','log cost proves empty batch without fabricating charges');
insert into foundation_results values('run',pg_temp.foundation_call(6,'run.start','{"env":"dev","executionId":"foundation-local","mode":"manual","platform":null,"workflow":"WF-99"}'));
select extensions.is((select value->>'state' from foundation_results where label='run'),'completed','typed start creates a bounded local run');
select extensions.is(pg_temp.foundation_call(7,'run.finish',jsonb_build_object('runId',(select value#>>'{result,run_id}' from foundation_results where label='run'),'status','success','error',null,'apifyRunId',null))#>>'{result,r,status}','success','typed finish returns actual run summary');
select extensions.is(pg_temp.foundation_call(8,'run.finish','{"runId":"30000000-0000-4000-8000-999999999999","status":"success","error":null,"apifyRunId":null}')->>'code','execution_failed','unbound parent mutation is denied');
select extensions.is(pg_temp.foundation_call(9,'callback.reject','{"executionId":"foundation-forged","apifyRunId":"FoundationUnknown","reason":"unregistered"}')#>>'{result,action}','apify_callback_rejected','callback rejection uses exact action through gateway');
select extensions.is(pg_temp.foundation_call(10,'apify.read','{"apifyRunId":"FoundationUnknown"}')#>'{result,registered}','null'::jsonb,'unknown callback registration remains null');
select extensions.is(pg_temp.foundation_call(11,'error.log','{"entry":{"kind":"error","workflow":"WF-99","execution_id":"foundation-error-1","node":"Workflow","message":"workflow_failed"}}')#>'{result,logged}','null'::jsonb,'classified error preserves void RPC result');
select extensions.is(pg_temp.foundation_call(12,'error.count','{"workflow":"WF-99","claimNotify":false}')#>>'{result,error_count}','1','classified error counts once');
select extensions.is(pg_temp.foundation_call(13,'error.count','{"workflow":"WF-99","claimNotify":true}')#>>'{result,error_count}','0','below threshold no notification claim');
select extensions.ok(pg_temp.foundation_call(14,'health.read')#>'{result,h}' ? 'queues','health keeps full bounded health structure');
select extensions.is(pg_temp.foundation_call(15,'fees.accrue',jsonb_build_object('day',((now() at time zone 'Africa/Cairo')::date-1)::text))->>'state','completed','dated fee accrual executes without unknown-fee invention');
select extensions.is(pg_temp.foundation_call(16,'fees.accrue',jsonb_build_object('day',((now() at time zone 'Africa/Cairo')::date-1)::text))#>>'{result,accrued}','0','same fee day accrues zero again');
reset session authorization;
update ops.foundation_gateway_rate_windows set minute_start=date_trunc('minute',clock_timestamp())-interval '1 minute';
-- Create only the guarded local fixture and use the full gateway launch path.
insert into app.competitors(company_code,slug,name,priority_tier) values('C999','emr-smoke-test','M03 foundation rollback fixture','adjacent')
on conflict(company_code) do update set slug=excluded.slug,status='active';
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,backfill_status)
select '30000000-0000-4000-8000-000000000901',id,'website_work_page','m03-foundation-fixture','https://everyone.film/about-everyone','pending' from app.competitors where company_code='C999';
insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)
select 'system','m03_smoke_setup.v1','m03_smoke_fixture_created','competitor',id::text,
  jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf','competitor_id',id,'account_id','30000000-0000-4000-8000-000000000901') from app.competitors where company_code='C999';
set local session authorization n8n_writer;
insert into foundation_results values('actor-parent',pg_temp.foundation_call(17,'run.start','{"env":"dev","executionId":"foundation-actor","mode":"manual","platform":"website_work_page","workflow":"WF-99"}'));
reset session authorization;
insert into foundation_results values('launch-args',jsonb_build_object('launch',jsonb_build_object('window_id','df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  'launch_id','30000000-0000-4000-8000-000000000902','run_id',(select value#>>'{result,run_id}' from foundation_results where label='actor-parent'),
  'account_id','30000000-0000-4000-8000-000000000901','execution_id','foundation-actor','actor_id','aYG0l9s7dbB7j3gbS','actor_build','0.3.99',
  'input',ops.m03_smoke_launch_input(),'memory_mb',1024,'timeout_seconds',300,'max_total_charge_usd',0.1)));
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_call(18,'launch.authorize',(select value from foundation_results where label='launch-args'))#>>'{result,authorized}','true','new foundation grant authorizes exactly one local POST intent');
select extensions.is(pg_temp.foundation_admit(18,'launch.authorize',(select value from foundation_results where label='launch-args'))->>'replayed','true','cached true grant is explicitly not a fresh POST permission');
select extensions.is(pg_temp.foundation_call(19,'launch.authorize',(select value from foundation_results where label='launch-args'))#>>'{result,authorized}','false','fresh request for same launch is reconciliation-only');
select extensions.is(pg_temp.foundation_call(20,'launch.read','{"launchId":"30000000-0000-4000-8000-000000000902"}')#>>'{result,launch,ordinal}','1','launch read preserves original slot');
select extensions.is(pg_temp.foundation_admit(21,'launch.reconcile','{"launchId":"30000000-0000-4000-8000-000000000902","apifyRunId":"FoundationOriginal"}')->>'state','admitted','original registration reserves a bounded external-read request');
select extensions.is(ops.foundation_gateway_read_context('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(21),'FoundationOriginal')#>>'{launch,launch_id}',
  '30000000-0000-4000-8000-000000000902','original provider read context uses stored launch receipt');
select extensions.is(ops.foundation_gateway_complete_read('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(21),'FoundationOriginal',
  jsonb_build_object('launch',jsonb_build_object('launch_id','30000000-0000-4000-8000-000000000902','apify_run_id','FoundationOriginal','actor_id','aYG0l9s7dbB7j3gbS',
  'actor_build','0.3.99','started_at',ops.get_apify_launch('30000000-0000-4000-8000-000000000902')->'post_intent_at',
  'input',(select value#>'{launch,input}' from foundation_results where label='launch-args')),
  'transport','{"requests":2,"retries":0,"socketsClosed":true,"runBytesMax":65536,"inputBytesMax":4096}'::jsonb))#>>'{result,registered}','true','authenticated original projection registers atomically through external-read completion');
select extensions.is(pg_temp.foundation_call(22,'apify.completion.read',jsonb_build_object('apifyRunId','FoundationOriginal',
  'runId',(select value#>>'{result,run_id}' from foundation_results where label='actor-parent')))#>>'{result,pending}','1','registered original pending count is window-scoped');
select extensions.lives_ok($test$do $body$begin
  if pg_temp.foundation_call(35,'cost.log',jsonb_build_object('entries',jsonb_build_array(jsonb_build_object(
    'provider','apify','category','scrape','quantity',1,'unit','result','cost_usd',0.25,
    'run_id',(select value#>>'{result,run_id}' from foundation_results where label='actor-parent'),
    'meta',jsonb_build_object('actor','apify/website-content-crawler','apify_run_id','FoundationOriginal',
      'account_id','30000000-0000-4000-8000-000000000901','cost_key','apify:FoundationOriginal:30000000-0000-4000-8000-000000000901')))))->>'state'<>'rejected' then
    raise exception 'synthetic_cost_without_durable_receipt_accepted';
  end if;
end $body$ $test$,'cost helper cannot invent a charge before actual atomic completion');
select extensions.is(pg_temp.foundation_admit(23,'apify.dataset.read','{"apifyRunId":"FoundationOriginal"}')->>'state','admitted','bounded dataset request reserves its durable business ID');
select extensions.is(ops.foundation_gateway_read_context('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(23),'FoundationOriginal')->>'apify_run_id','FoundationOriginal','fixed reader receives only registered owned run context');
select extensions.throws_ok($$select ops.foundation_gateway_read_context('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(23),'FoundationOriginal')$$,'55000',null,'same read context cannot issue duplicate provider GETs');
reset session authorization;
insert into foundation_results values('dataset-result',jsonb_build_object('terminal',jsonb_build_object('apifyRunId','FoundationOriginal',
  'parentRunId',(select value#>>'{result,run_id}' from foundation_results where label='actor-parent'),
  'accountId','30000000-0000-4000-8000-000000000901','actorId','aYG0l9s7dbB7j3gbS','wireStatus','SUCCEEDED','status','SUCCEEDED',
  'datasetId','FoundationDataset','usageTotalUsd',0.01,'finishedAt',clock_timestamp()),
  'rows',jsonb_build_array(jsonb_build_object('url','https://everyone.film/about-everyone','markdown','# Everyone','metadata',jsonb_build_object('title','Everyone'))),
  'transport','{"runBytesMax":65536,"datasetBytesMax":262144,"requests":2,"retries":0,"socketsClosed":true}'::jsonb));
set local session authorization n8n_writer;
select extensions.throws_ok($$select ops.foundation_gateway_complete_read('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(23),'FoundationOriginal',
  jsonb_set((select value from foundation_results where label='dataset-result'),'{rows,0,url}','"https://example.test"'))$$,'22023',null,'download cannot substitute another page');
select extensions.throws_ok($$select ops.foundation_gateway_complete_read('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(23),'FoundationOriginal',
  jsonb_set((select value from foundation_results where label='dataset-result'),'{transport,retries}','1'))$$,'22023',null,'download transport cannot claim retry permission');
select extensions.is(ops.foundation_gateway_complete_read('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(23),'FoundationOriginal',
  (select value from foundation_results where label='dataset-result'))->>'state','completed','bounded synthetic external-read receipt completes durably');
select extensions.is(pg_temp.foundation_status(23)#>>'{result,rows,0,url}','https://everyone.film/about-everyone','status returns durable read data without repeating a provider GET');
select extensions.is(ops.foundation_gateway_complete_read('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(23),'FoundationOriginal',
  (select value from foundation_results where label='dataset-result'))->>'replayed','true','same completion replay cannot download again');
reset session authorization;
update ops.foundation_gateway_rate_windows set minute_start=date_trunc('minute',clock_timestamp())-interval '1 minute';
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_admit(24,'apify.terminal.read','{"apifyRunId":"FoundationOriginal"}')->>'state','admitted','terminal metadata read has distinct bounded reservation');
select extensions.is(ops.foundation_gateway_read_context('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(24),'FoundationOriginal')->>'apify_run_id','FoundationOriginal','terminal read uses same registered context guard');
select extensions.is(ops.foundation_gateway_complete_read('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(24),'FoundationOriginal',
  jsonb_build_object('terminal',(select value->'terminal' from foundation_results where label='dataset-result'),'transport',
  '{"runBytesMax":65536,"requests":1,"retries":0,"socketsClosed":true}'::jsonb))->>'state','completed','one-request bounded terminal receipt completes');
reset session authorization;
create function pg_temp.foundation_process_args() returns jsonb language sql as $$ select jsonb_build_object('apifyRunId','FoundationOriginal','status','SUCCEEDED',
  'datasetId','FoundationDataset','usageUsd',0.01,'groups',jsonb_build_array(jsonb_build_object(
    'account_id','30000000-0000-4000-8000-000000000901','normalizer_version','smoke_website_stub.v1',
    'items',jsonb_build_array(jsonb_build_object('platform','website_work_page','external_id',
      left(encode(extensions.digest('https://everyone.film/about-everyone','sha256'),'hex'),32),'actor','apify/website-content-crawler',
      'item_type','project_page','url','https://everyone.film/about-everyone','published_at',null,'title','Everyone','caption','# Everyone',
      'metrics','{}'::jsonb,'payload',(select value#>'{rows,0}' from foundation_results where label='dataset-result')))))); $$;
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_call(37,'apify.process',pg_temp.foundation_process_args())->>'state','rejected',
  'one terminal sample cannot authorize processing or cost settlement');
select extensions.is(pg_temp.foundation_admit(36,'apify.terminal.read','{"apifyRunId":"FoundationOriginal"}')->>'state','admitted','second settling sample has a distinct bounded request');
select extensions.is(ops.foundation_gateway_read_context('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(36),'FoundationOriginal')->>'apify_run_id','FoundationOriginal','second sample uses registered context');
select extensions.is(ops.foundation_gateway_complete_read('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',pg_temp.foundation_id(36),'FoundationOriginal',
  jsonb_build_object('terminal',(select value->'terminal' from foundation_results where label='dataset-result'),'transport',
  '{"runBytesMax":65536,"requests":1,"retries":0,"socketsClosed":true}'::jsonb))->>'state','completed','second settling sample completes');
reset session authorization;
-- Controlled rollback time fixture, not an observed ten-second network wait.
update ops.foundation_gateway_requests set completed_at=clock_timestamp()-interval '12 seconds' where request_id=pg_temp.foundation_id(24);
update ops.foundation_gateway_requests set completed_at=clock_timestamp()-interval '1 second' where request_id=pg_temp.foundation_id(36);
update ops.foundation_gateway_requests set completed_at=clock_timestamp() where request_id=pg_temp.foundation_id(23);
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_call(31,'apify.process',pg_temp.foundation_process_args())#>>'{result,r,items_new}',
  '1','typed atomic callback processes exactly the bounded owned local page after trusted proof');
reset session authorization;
insert into foundation_results select 'recorded-cost',jsonb_build_object('entries',jsonb_build_array(to_jsonb(l)-'id'-'created_at'))
from ops.cost_ledger l where l.provider='apify' and l.meta->>'apify_run_id'='FoundationOriginal';
select set_config('test.foundation_cost_count',(select count(*)::text from ops.cost_ledger),true);
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_call(32,'cost.log',(select value from foundation_results where label='recorded-cost'))#>>'{result,inserted}',
  '0','SUB cost replays a real durable atomic receipt without charging again');
select extensions.is(pg_temp.foundation_call(34,'cost.log',jsonb_set((select value from foundation_results where label='recorded-cost'),'{entries,0,cost_usd}','0.02'))->>'state',
  'rejected','SUB cost cannot change a recorded actual amount');
reset session authorization;
select extensions.is((select count(*)::text from ops.cost_ledger),current_setting('test.foundation_cost_count'),'cost helper leaves actual ledger row count unchanged');
update ops.foundation_gateway_rate_windows set minute_start=date_trunc('minute',clock_timestamp())-interval '1 minute';
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_admit(25)->>'state','admitted','first simultaneous reservation admitted');
select extensions.is(pg_temp.foundation_admit(26)->>'state','admitted','second simultaneous reservation admitted');
select extensions.is(pg_temp.foundation_admit(27)->>'code','concurrency_limit','third simultaneous reservation denied');
select extensions.is(pg_temp.foundation_execute(25)->>'state','completed','first reservation releases after execution');
select extensions.is(pg_temp.foundation_execute(26)->>'state','completed','second reservation releases after execution');
select extensions.is(pg_temp.foundation_admit(38)->>'state','admitted','unresolved request is left for safe-close fencing');
reset session authorization;
update ops.foundation_gateway_rate_windows set minute_start=date_trunc('minute',clock_timestamp()),minute_count=30;
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_admit(28)->>'code','rate_limited','minute limit is enforced');
reset session authorization;
update ops.foundation_gateway_rate_windows set minute_start=date_trunc('minute',clock_timestamp())-interval '1 minute',admitted_count=256;
set local session authorization n8n_writer;
select extensions.is(pg_temp.foundation_admit(28)->>'code','request_limit','256 admitted attempts cannot be replenished');
select extensions.is(pg_temp.foundation_admit(29,'identity.read','{}','close')->>'state','closed','safe close succeeds at exhausted allowance');
select extensions.is(pg_temp.foundation_admit(29,'identity.read','{}','close')#>>'{window,totalAdmitted}','256','repeated close never increments to 257');
select extensions.is(pg_temp.foundation_admit(30)->>'code','window_closed','closed foundation window never reopens');
select extensions.is(pg_temp.foundation_execute(1)->>'state','closed','old foundation execution cannot bypass closure');
reset session authorization;
select extensions.ok((select closed_at is not null from ops.apify_launch_approvals),'gateway close atomically closes actor admission');
select extensions.is((select error_code from ops.foundation_gateway_requests where request_id=pg_temp.foundation_id(38)),'window_closed','Close durably fences the unresolved request');
select extensions.is((select count(*)::int from ops.foundation_gateway_leases where request_id is not null),0,'all test leases released');
select extensions.is(jsonb_build_object(
  'windows',(select jsonb_agg(to_jsonb(w) order by window_id) from ops.worker_gateway_rate_windows w),
  'requests',(select jsonb_agg(to_jsonb(r) order by request_id) from ops.worker_gateway_requests r),
  'leases',(select jsonb_agg(to_jsonb(l) order by slot) from ops.worker_gateway_leases l)),
  (select value from foundation_results where label='original-gw01'),'closed original GW-01 state is byte-equivalent throughout');
select * from extensions.finish();
rollback;
