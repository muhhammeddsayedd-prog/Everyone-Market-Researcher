begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select extensions.no_plan();
select extensions.has_function('ops','log_cost',array['jsonb'],'cost logging RPC exists');
select extensions.has_function('ops','register_apify_run',array['text','text','uuid','uuid[]','text'],'Apify registration RPC exists');
select extensions.has_function('ops','complete_apify_run',array['text','text','text','numeric'],'guarded Apify completion RPC exists');
select extensions.has_function('ops','get_apify_run',array['text'],'registered-run read RPC exists');
select extensions.has_function('ops','apify_runs_pending',array['uuid'],'pending-run count RPC exists');
select extensions.has_function('ops','get_setting',array['text'],'setting read RPC exists');
select extensions.has_function('ops','get_price_book',array[]::text[],'dated price read RPC exists');
select extensions.has_function('ops','log_workflow_error',array['jsonb'],'workflow error RPC exists');
select extensions.has_function('ops','error_count_24h',array['text','boolean'],'error count with optional atomic notification claim exists');
select extensions.has_function('ops','accrue_fixed_costs',array['date'],'fixed cost accrual RPC exists');
select extensions.has_function('ops','daily_health',array[]::text[],'health read RPC exists');
select extensions.has_function('ops','process_apify_run',array['text','text','text','numeric','jsonb'],'bounded atomic callback RPC exists');

-- Every fixture and any existing C999 adjustment are inside this rollback.
-- No hosted API or provider request is made by this test.
grant n8n_writer to postgres with inherit false;
grant n8n_writer to postgres with set true;
create temporary table m03_results (label text primary key, value jsonb);
grant all on m03_results to n8n_writer;
create function pg_temp.m03_group(p_markdown text default '# Everyone film')
returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'account_id','10000000-0000-4000-8000-000000000002',
    'normalizer_version','smoke_website_stub.v1',
    'items',jsonb_build_array(jsonb_build_object(
      'platform','website_work_page',
      'external_id',left(encode(extensions.digest('https://everyone.film/about-everyone','sha256'),'hex'),32),
      'actor','apify/website-content-crawler','item_type','project_page',
      'url','https://everyone.film/about-everyone','published_at',null,
      'title','Everyone film','caption',p_markdown,'metrics','{}'::jsonb,
      'payload',jsonb_build_object('url','https://everyone.film/about-everyone',
        'markdown',p_markdown,'metadata',jsonb_build_object('title','Everyone film'))))));
$$;
create function pg_temp.m03_empty_group()
returns jsonb language sql as $$
  select jsonb_set(pg_temp.m03_group(),'{0,items}','[]');
$$;
create function pg_temp.m03_cost(p_key text,p_cost numeric default 0.25)
returns jsonb language sql as $$
  select jsonb_build_object('provider','other','category','test','quantity',1,'unit','result',
    'cost_usd',p_cost,'meta',jsonb_build_object('cost_key',p_key));
$$;

select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname=any(array['log_cost','register_apify_run','complete_apify_run',
    'get_apify_run','apify_runs_pending','get_setting','get_price_book','log_workflow_error',
    'error_count_24h','accrue_fixed_costs','daily_health','process_apify_run'])
    and p.prosecdef and 'search_path=""'=any(p.proconfig)),12,'all twelve RPCs use definer with an empty search path');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname=any(array['log_cost','register_apify_run','complete_apify_run',
    'get_apify_run','apify_runs_pending','get_setting','get_price_book','log_workflow_error',
    'error_count_24h','accrue_fixed_costs','daily_health','process_apify_run'])
    and has_function_privilege('n8n_writer',p.oid,'execute')),12,'writer may execute all twelve entry points');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname=any(array['log_cost','register_apify_run','complete_apify_run',
    'get_apify_run','apify_runs_pending','get_setting','get_price_book','log_workflow_error',
    'error_count_24h','accrue_fixed_costs','daily_health','process_apify_run'])
    and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')
      or has_function_privilege('api_agent',p.oid,'execute')
      or exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'))),
  0,'PUBLIC, browser roles and agent have no worker execution privilege');
set local role n8n_writer;
select extensions.throws_ok($$select * from ops.cost_ledger$$,'42501',null,'writer cannot read cost ledger directly');
select extensions.throws_ok($$select * from ops.apify_runs$$,'42501',null,'writer cannot read registry directly');
select extensions.is(ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-first'))),1,'writer records one keyed cost');
select extensions.is(ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-first'))),0,'same keyed cost replay inserts zero');
select extensions.throws_ok($$select ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-first',0.5)))$$,
  '55000',null,'changed receipt cannot reuse a cost key');
select extensions.throws_ok($$select ops.log_cost('{}')$$,'22023',null,'cost batch must be an array');
select extensions.throws_ok($$select ops.log_cost('[{"provider":"other","category":"test","unit":"result","quantity":1,"cost_usd":1,"meta":{}}]')$$,
  '22023',null,'cost requires a stable key');
select extensions.throws_ok($$select ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-negative',-1)))$$,
  '22023',null,'negative cost is rejected');
select extensions.throws_ok($$select ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-tiny-negative',-0.0000001)))$$,
  '22023',null,'negative sub-scale cost is rejected before rounding');
select extensions.throws_ok($$select ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-tiny-quantity')||'{"quantity":-0.00001}'))$$,
  '22023',null,'negative sub-scale quantity is rejected before rounding');
select extensions.throws_ok($$select ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-empty-day')||'{"day":""}'))$$,
  '22023',null,'an empty explicit cost date is rejected');
select extensions.throws_ok($$select ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-infinity')||'{"day":"infinity"}'))$$,
  '22023',null,'non-ISO infinite date is rejected');
select extensions.throws_ok($$select ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-batch-good'),pg_temp.m03_cost('m03-batch-bad',-1)))$$,
  '22023',null,'invalid entry rolls back the whole cost batch');
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'cost_key' like 'm03-batch-%'),0,'invalid batch leaves no earlier cost');
update ops.cost_ledger set day=(now() at time zone 'Africa/Cairo')::date-1 where meta->>'cost_key'='m03-first';
select extensions.is(ops.log_cost(jsonb_build_array(pg_temp.m03_cost('m03-first'))),0,'omitted day retains the first receipt across Cairo midnight');
select extensions.is(ops.get_setting('auto_publish_threshold'),'0.8'::jsonb,'setting RPC returns seeded JSON value');
select extensions.is(ops.get_setting('m03-missing-setting'),null::jsonb,'missing setting returns SQL null');
select extensions.ok(ops.get_price_book() ? 'apify/instagram-scraper:result','price RPC keeps the documented actor lookup key');
select extensions.is(ops.get_price_book()#>>'{apify/instagram-scraper:result,usd}','1.90000000','latest dated Scale price supersedes the preserved baseline price');
select extensions.is(ops.get_setting('daily_budget_usd'),'25'::jsonb,'price-plan migration selects the documented steady-state alert budget');
select extensions.is(ops.get_setting('m03_price_verification')->>'fixed_fee_coverage_complete','false','unknown real fixed fees remain explicitly incomplete');
select extensions.is((select count(*)::int from ops.price_book where provider='apify' and valid_from='2026-10-18'
  and sku<>'goat255/vimeo-scraper:video'),17,'plan records seventeen reviewed dated price components');
insert into ops.price_book(provider,sku,unit,usd_per_unit,valid_from) values
  ('other','m03-future','result',999,(now() at time zone 'Africa/Cairo')::date+1),
  ('n8n','m03-test-plan','month',29,'2024-01-01'),
  ('n8n','m03-test-plan','month',58,'2024-03-01'),
  ('supabase','m03-test-plan','month',58,'2024-01-01'),
  ('vercel','m03-test-plan','month',87,'2024-01-01');
select extensions.ok(not(ops.get_price_book() ? 'other/m03-future'),'price RPC excludes future prices');
select extensions.is(ops.accrue_fixed_costs('2024-02-10'),3,'fixed accrual uses three historical month plans');
select extensions.is(ops.accrue_fixed_costs('2024-02-10'),0,'fixed accrual is idempotent');
select extensions.is((select cost_usd from ops.cost_ledger where provider='n8n' and meta->>'cost_key'='fixed:m03-test-plan:2024-02-10'),
  1::numeric,'leap February divides the as-of fee by twenty-nine');
select extensions.is((select sum(cost_usd) from ops.cost_ledger where day='2024-02-10'),6::numeric,'fixed cost total uses historical prices');
select extensions.throws_ok($$select ops.accrue_fixed_costs((now() at time zone 'Africa/Cairo')::date+1)$$,
  '22023',null,'future fixed-cost accrual is rejected');

-- Error logging never persists raw HTTP/SQL text or stack content.
select extensions.lives_ok($$select ops.log_workflow_error('{"kind":"error","workflow":"M03-ERROR","execution_id":"one","node":"Fetch","message":"https://public.film/?api_key=synthetic-value Authorization: Basic synthetic-value","stack":"postgresql://postgres:synthetic-password@example.test/postgres"}')$$,
  'raw error input is reduced to a fixed safe classification');
select extensions.is((select after->>'message' from ops.audit_log where entity_id='M03-ERROR'),'workflow_failed','raw message is replaced');
select extensions.ok((select not(after ? 'stack') and after::text not like '%synthetic%' from ops.audit_log where entity_id='M03-ERROR'),
  'neither stack nor synthetic credential text is stored');
select extensions.lives_ok($$select ops.log_workflow_error('{"kind":"error","workflow":"M03-ERROR","execution_id":"one","node":"Fetch","message":"workflow_failed"}')$$,
  'sanitized equivalent event replay is idempotent');
select extensions.is(ops.error_count_24h('M03-ERROR'),1,'replayed event counts once');
select extensions.throws_ok($$select ops.log_workflow_error('{"kind":"error","workflow":"M03-ERROR","execution_id":"one","node":"Fetch","message":"apify_failed"}')$$,
  '55000',null,'changed classified receipt is rejected');
select extensions.throws_ok($$select ops.log_workflow_error('{"kind":"error","workflow":{},"execution_id":"bad","message":"workflow_failed"}')$$,
  '22023',null,'workflow identity must be a string');
select extensions.throws_ok($$select ops.log_workflow_error('{"kind":"error","workflow":"M03-ERROR","execution_id":"bad","message":"workflow_failed","meta":{"client_secret":"synthetic"}}')$$,
  '22023',null,'arbitrary metadata cannot carry secrets');
select extensions.lives_ok($$select ops.log_workflow_error('{"kind":"error","workflow":"M03-ERROR","execution_id":"two","message":"callback_retryable"}')$$,'second error is recorded');
select extensions.is(ops.error_count_24h('M03-ERROR',true),0,'below three errors cannot reserve a notification');
select extensions.lives_ok($$select ops.log_workflow_error('{"kind":"error","workflow":"M03-ERROR","execution_id":"three","message":"callback_retryable"}')$$,'third error is recorded');
select extensions.is(ops.error_count_24h('M03-ERROR',true),3,'third error atomically reserves notification');
select extensions.is(ops.error_count_24h('M03-ERROR',true),0,'repeated threshold query cannot reserve twice');
select extensions.is(ops.error_count_24h('M03-ERROR'),3,'ordinary error count remains literal');
update ops.audit_log set created_at=now()-interval '7 hours' where entity_id='M03-ERROR' and action='workflow_notify_claimed';
select extensions.is(ops.error_count_24h('M03-ERROR',true),3,'notification can be claimed again after six hours');
update ops.audit_log set created_at=now()-interval '25 hours' where entity_id='M03-ERROR' and after->>'execution_id'='two';
select extensions.is(ops.error_count_24h('M03-ERROR'),2,'twenty-four-hour count excludes older errors');

-- Reuse an existing C999 only inside this rollback; old data is restored.
insert into app.competitors(company_code,slug,name,priority_tier)
values('C999','emr-smoke-test','M03 rollback fixture','pilot')
on conflict(company_code) do update set slug=excluded.slug,status='active';
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,backfill_status)
select '10000000-0000-4000-8000-000000000002',id,'website_work_page','m03-atomic-fixture',
  'https://everyone.film/about-everyone','pending' from app.competitors where company_code='C999';
insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)
select 'system','m03_smoke_setup.v1','m03_smoke_fixture_created','competitor',id::text,
  jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf',
    'competitor_id',id,'account_id','10000000-0000-4000-8000-000000000002')
from app.competitors where company_code='C999';
do $$begin
  perform set_config('test.m03_run',ops.start_run('WF-99','website_work_page','manual','dev','m03-atomic')::text,true);
  perform set_config('test.m03_ai_before',(select queue_length::text from pgmq.metrics('ai_extract')),true);
  perform set_config('test.m03_media_before',(select queue_length::text from pgmq.metrics('media')),true);
end$$;
set local role n8n_writer;
select extensions.lives_ok($$select ops.register_apify_run('M03Atomic','apify/website-content-crawler',
  current_setting('test.m03_run')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'daily')$$,
  'writer registers and claims the exact free owned dev smoke account');
select extensions.lives_ok($$select ops.register_apify_run('M03Atomic','apify/website-content-crawler',
  current_setting('test.m03_run')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'daily')$$,
  'identical registration is idempotent');
select extensions.is(ops.get_apify_run('M03Atomic')->>'actor_id','apify/website-content-crawler','registry read returns trusted actor');
select extensions.is(ops.apify_runs_pending(current_setting('test.m03_run')::uuid),1,'one registered actor is pending');
select extensions.throws_ok($$select ops.register_apify_run('M03Atomic','unapproved/actor',
  current_setting('test.m03_run')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'daily')$$,
  '55000',null,'registration cannot replace actor metadata');
select extensions.throws_ok($$select ops.register_apify_run('M03SecondActor','apify/website-content-crawler',
  current_setting('test.m03_run')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'daily')$$,
  '55000',null,'a second actor is gated until a launch barrier is implemented');
select extensions.throws_ok($$select ops.complete_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01)$$,
  '55000',null,'standalone completion cannot preempt durable ingest and cost');
select extensions.throws_ok($$select ops.process_apify_run('M03Unknown','SUCCEEDED','dataset-one',0.01,pg_temp.m03_group())$$,
  '22023',null,'unknown actor callback is rejected');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,account_id}','"10000000-0000-4000-8000-000000000099"'))$$,
  '22023',null,'callback cannot substitute an unregistered account');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,normalizer_version}','"future.v2"'))$$,
  '22023',null,'unknown normalizer version fails closed');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,items,0,url}','"https://everyone.film/other"'))$$,
  '22023',null,'callback cannot ingest another public page');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,items,0,external_id}','"wrong-id"'))$$,
  '22023',null,'callback canonical external ID is verified');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,items}',(pg_temp.m03_group()#>'{0,items}')||(pg_temp.m03_group()#>'{0,items}')))$$,
  '22023',null,'two-page callback exceeds the one-page gate');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,items,0,payload,headers}','{"Authorization":"synthetic"}'))$$,
  '22023',null,'raw request context is excluded from the public snapshot');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,items,0,caption}',to_jsonb(repeat('x',8001))))$$,
  '22023',null,'outer caption cannot bypass bounded public snapshot');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,items,0,credits_text}','"unbounded side channel"'))$$,
  '22023',null,'extra normalized raw text is not accepted for M03');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,
  jsonb_set(pg_temp.m03_group(),'{0,items,0,metrics}','{"likes":1}'))$$,
  '22023',null,'M03 does not accept nonempty optional metrics');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one','NaN',pg_temp.m03_group())$$,
  '22023',null,'non-finite actor usage is rejected');
reset role;
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,backfill_status)
select '10000000-0000-4000-8000-000000000003',id,'website_work_page','m03-forbidden-fixture',
  'https://example.test/not-the-smoke-page','pending' from app.competitors where company_code='C999';
do $$begin
  perform set_config('test.m03_other_parent',ops.start_run('WF-99','website_work_page','manual','dev','m03-other-parent')::text,true);
  perform set_config('test.m03_wrong_workflow',ops.start_run('WF-OTHER','website_work_page','manual','dev','m03-wrong-workflow')::text,true);
  perform set_config('test.m03_prod_parent',ops.start_run('WF-99','website_work_page','manual','prod','m03-prod-parent')::text,true);
end$$;
select extensions.throws_ok($$select ops.register_apify_run('M03WrongPage','apify/website-content-crawler',
  current_setting('test.m03_other_parent')::uuid,array['10000000-0000-4000-8000-000000000003']::uuid[],'daily')$$,
  '22023',null,'manual registration refuses another public page before claiming it');
select extensions.ok((select last_run_id is null and locked_until is null from app.competitor_accounts
  where id='10000000-0000-4000-8000-000000000003'),'refused manual account keeps its original unclaimed state');
select extensions.throws_ok($$select ops.register_apify_run('M03LeaseTheft','apify/website-content-crawler',
  current_setting('test.m03_other_parent')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'daily')$$,
  '55000',null,'manual fallback cannot steal another live lease');
select extensions.throws_ok($$select ops.register_apify_run('M03WrongWorkflow','apify/website-content-crawler',
  current_setting('test.m03_wrong_workflow')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'daily')$$,
  '22023',null,'manual fallback is restricted to WF-99');
select extensions.throws_ok($$select ops.register_apify_run('M03ProdClaim','apify/website-content-crawler',
  current_setting('test.m03_prod_parent')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'daily')$$,
  '22023',null,'manual fallback cannot claim a production account');
select extensions.throws_ok($$select ops.register_apify_run('M03MultiAccount','apify/website-content-crawler',
  current_setting('test.m03_other_parent')::uuid,array['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003']::uuid[],'daily')$$,
  '22023',null,'manual fallback is limited to one account');
select extensions.throws_ok($$select ops.register_apify_run('M03WrongPurpose','apify/website-content-crawler',
  current_setting('test.m03_other_parent')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'backfill')$$,
  '22023',null,'manual smoke uses the existing daily purpose without changing its enum');
update ops.scrape_runs set env='prod' where id=current_setting('test.m03_run')::uuid;
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,pg_temp.m03_group())$$,
  '22023',null,'M03 processing explicitly excludes production');
update ops.scrape_runs set env='dev' where id=current_setting('test.m03_run')::uuid;
update ops.audit_log set after=jsonb_set(after,'{fixture_version}','2')
  where actor_id='m03_smoke_setup.v1' and action='m03_smoke_fixture_created';
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,pg_temp.m03_group())$$,
  '55000',null,'matching labels alone cannot replace the owned creation receipt');
select extensions.throws_ok($$select ops.register_apify_run('M03UnownedLabels','apify/website-content-crawler',
  current_setting('test.m03_other_parent')::uuid,array['10000000-0000-4000-8000-000000000002']::uuid[],'daily')$$,
  '22023',null,'registration checks owned creation receipt before any manual claim');
update ops.audit_log set after=jsonb_set(after,'{fixture_version}','1')
  where actor_id='m03_smoke_setup.v1' and action='m03_smoke_fixture_created';
update app.competitor_accounts set locked_until=now()-interval '1 second' where id='10000000-0000-4000-8000-000000000002';
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,pg_temp.m03_group())$$,
  '55000',null,'expired account claim cannot ingest');
update app.competitor_accounts set locked_until=now()+interval '2 hours' where id='10000000-0000-4000-8000-000000000002';

-- Inject a local conflicting keyed cost so failure occurs AFTER ingest/report.
-- throws_ok uses a subtransaction; every preceding callback write must unwind.
insert into ops.cost_ledger(provider,category,quantity,unit,cost_usd,run_id,competitor_id,platform,meta)
select 'apify','scrape',1,'result',999,current_setting('test.m03_run')::uuid,competitor_id,'website_work_page',
  jsonb_build_object('cost_key','apify:M03Atomic:10000000-0000-4000-8000-000000000002')
from app.competitor_accounts where id='10000000-0000-4000-8000-000000000002';
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,pg_temp.m03_group())$$,
  '55000',null,'late cost conflict rolls back the complete callback transaction');
select extensions.is((select count(*)::int from app.items where account_id='10000000-0000-4000-8000-000000000002'),0,'failed callback leaves no clean item');
select extensions.is((select count(*)::int from ingest.raw_items where account_id='10000000-0000-4000-8000-000000000002'),0,'failed callback leaves no raw item');
select extensions.is((select count(*)::int from ops.scrape_run_accounts where run_id=current_setting('test.m03_run')::uuid),0,'failed callback leaves no account receipt');
select extensions.is((select queue_length from pgmq.metrics('ai_extract')),current_setting('test.m03_ai_before')::bigint,'failed callback leaves AI queue unchanged');
select extensions.is((select queue_length from pgmq.metrics('media')),current_setting('test.m03_media_before')::bigint,'failed callback leaves media queue unchanged');
select extensions.ok((select locked_until>now() and last_run_id=current_setting('test.m03_run')::uuid from app.competitor_accounts
  where id='10000000-0000-4000-8000-000000000002'),'failed callback retains its live claim');
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m03_run')::uuid),'running','failed callback leaves parent recoverable');
select extensions.ok((select processed_at is null and processing_result is null from ops.apify_runs where apify_run_id='M03Atomic'),'failed callback does not consume registry marker');
-- This deletes only the synthetic conflicting cost fixture, never collected data.
delete from ops.cost_ledger where meta->>'cost_key'='apify:M03Atomic:10000000-0000-4000-8000-000000000002';
set local role n8n_writer;
insert into m03_results values('first',ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,pg_temp.m03_group()));
insert into m03_results values('repeat',ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,pg_temp.m03_group()));
select extensions.is((select (value->>'items_new')::int from m03_results where label='first'),1,'successful callback saves original new-item count');
select extensions.is((select value->'new_item_ids' from m03_results where label='repeat'),
  (select value->'new_item_ids' from m03_results where label='first'),'replay returns the durable original new IDs');
select extensions.is((select (value->>'items_new')::int from m03_results where label='repeat'),1,'replay preserves original counts rather than per-call inserted zero');
select extensions.ok((select (value->>'updated')::boolean and (value->>'finished_now')::boolean from m03_results where label='first'),'first callback reports its actual completion transition');
select extensions.ok((select not(value->>'updated')::boolean and not(value->>'finished_now')::boolean from m03_results where label='repeat'),'replay never reports a new transition or notification');
select extensions.is(ops.apify_runs_pending(current_setting('test.m03_run')::uuid),0,'durable callback consumes pending registry');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.02,pg_temp.m03_group())$$,
  '55000',null,'replay cannot change billed usage');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-two',0.01,pg_temp.m03_group())$$,
  '55000',null,'replay cannot change dataset');
select extensions.throws_ok($$select ops.process_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01,pg_temp.m03_group('changed'))$$,
  '55000',null,'replay cannot change normalized content digest');
select extensions.is(ops.complete_apify_run('M03Atomic','SUCCEEDED','dataset-one',0.01)->>'updated','false','standalone completion replay returns false');
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'apify_run_id'='M03Atomic'),1,'first and replay charge exactly one cost row');
select extensions.is((select count(*)::int from app.items where account_id='10000000-0000-4000-8000-000000000002'),1,'first and replay persist one clean shell');
select extensions.is((select queue_length from pgmq.metrics('ai_extract')),current_setting('test.m03_ai_before')::bigint+1,'first and replay enqueue AI once');
select extensions.is((select queue_length from pgmq.metrics('media')),current_setting('test.m03_media_before')::bigint+1,'first and replay enqueue media once');
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m03_run')::uuid),'success','parent finishes only after durable processing');
select extensions.is((select cost_usd from ops.scrape_runs where id=current_setting('test.m03_run')::uuid),0.01::numeric,'finished parent includes the actor cost');
select extensions.is((select value#>>'{run_summary,items_new}' from m03_results where label='first'),'1','durable result includes finished summary');
select extensions.ok((select value ?& array['groups_sha256','cost_keys','normalizer_version','account_ids','accounts_ok','accounts_failed'] from m03_results where label='first'),'saved receipt includes version, digest, costs and account aggregate');

-- A later paid run can observe the page again without replacing human changes.
update app.items set title='Human title',caption_original='Human caption',metrics='{"likes":99}',
  locked_fields=array['title','caption_original','metrics'] where account_id='10000000-0000-4000-8000-000000000002';
do $$begin
  perform set_config('test.m03_run2',ops.start_run('WF-99','website_work_page','manual','dev','m03-update')::text,true);
  perform ops.register_apify_run('M03Later','apify/website-content-crawler',current_setting('test.m03_run2')::uuid,
    array['10000000-0000-4000-8000-000000000002']::uuid[],'daily');
end$$;
insert into m03_results values('later',ops.process_apify_run('M03Later','SUCCEEDED','dataset-later',0.02,pg_temp.m03_group('Updated public source')));
select extensions.is((select (value->>'items_new')::int from m03_results where label='later'),0,'later collection returns no new item');
select extensions.ok((select title='Human title' and caption_original='Human caption' and metrics='{"likes":99}'::jsonb
  from app.items where account_id='10000000-0000-4000-8000-000000000002'),'human-corrected fields survive the later collection');
select extensions.is((select queue_length from pgmq.metrics('ai_extract')),current_setting('test.m03_ai_before')::bigint+1,'later known page does not enqueue AI again');
do $$begin
  perform set_config('test.m03_failed',ops.start_run('WF-99','website_work_page','manual','dev','m03-failed')::text,true);
  perform ops.register_apify_run('M03Failed','apify/website-content-crawler',current_setting('test.m03_failed')::uuid,
    array['10000000-0000-4000-8000-000000000002']::uuid[],'daily');
end$$;
insert into m03_results values('failed',ops.process_apify_run('M03Failed','FAILED',null,0.005,pg_temp.m03_empty_group()));
insert into m03_results values('failed-repeat',ops.process_apify_run('M03Failed','FAILED',null,0.005,pg_temp.m03_empty_group()));
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m03_failed')::uuid),'partial','failed actor finishes with a failed-account aggregate');
select extensions.is((select consecutive_failures from app.competitor_accounts where id='10000000-0000-4000-8000-000000000002'),1,'failed replay increments account failures only once');
select extensions.is((select value->>'items_seen' from m03_results where label='failed'),'0','failed actor records zero content');
do $$begin
  perform set_config('test.m03_empty',ops.start_run('WF-99','website_work_page','manual','dev','m03-empty')::text,true);
  perform ops.register_apify_run('M03Empty','apify/website-content-crawler',current_setting('test.m03_empty')::uuid,
    array['10000000-0000-4000-8000-000000000002']::uuid[],'daily');
end$$;
select extensions.lives_ok($$select ops.process_apify_run('M03Empty','SUCCEEDED','empty-dataset',0,pg_temp.m03_empty_group())$$,'explicit zero-row success is valid');
select extensions.is((select items_new from ops.scrape_runs where id=current_setting('test.m03_empty')::uuid),0,'empty success stores no invented new rows');

-- WF-90 terminal versus retryable correlation behavior is explicit.
do $$begin
  perform set_config('test.m03_terminal',ops.start_run('M03-TERMINAL',null,'manual','dev','terminal')::text,true);
  perform set_config('test.m03_retry',ops.start_run('M03-RETRY',null,'manual','dev','retry')::text,true);
  perform ops.log_workflow_error(jsonb_build_object('kind','error','workflow','M03-TERMINAL','execution_id','terminal',
    'message','arbitrary raw SQL text','run_id',current_setting('test.m03_terminal')));
  perform ops.log_workflow_error(jsonb_build_object('kind','error','workflow','M03-RETRY','execution_id','retry',
    'message','callback_retryable','meta',jsonb_build_object('run_id',current_setting('test.m03_retry'))));
end$$;
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m03_terminal')::uuid),'failed','top-level run_id records terminal failure');
select extensions.is((select error from ops.scrape_runs where id=current_setting('test.m03_terminal')::uuid),'workflow_failed','terminal parent stores only a fixed classification');
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m03_retry')::uuid),'running','retryable metadata correlation leaves parent recoverable');

-- Daily health respects Cairo boundaries, cadence and current persisted facts.
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,backfill_status,status,cadence,last_success_at)
select x.id,c.id,x.platform,x.handle,'https://example.test/'||x.handle,'done',x.status::app.account_status,x.cadence,x.last_success
from app.competitors c cross join(values
  ('10000000-0000-4000-8000-000000000010'::uuid,'news'::app.platform,'m03-stale-daily','active',interval '1 day',now()-interval '49 hours'),
  ('10000000-0000-4000-8000-000000000011'::uuid,'news'::app.platform,'m03-fresh-weekly','active',interval '7 days',now()-interval '8 days'),
  ('10000000-0000-4000-8000-000000000012'::uuid,'news'::app.platform,'m03-stale-weekly','active',interval '7 days',now()-interval '10 days'),
  ('10000000-0000-4000-8000-000000000013'::uuid,'news'::app.platform,'m03-failing','failing',interval '1 day',now())
)x(id,platform,handle,status,cadence,last_success) where company_code='C999';
insert into app.items(competitor_id,platform,item_type,external_id,url,first_seen_at)
select id,'news','news_article','m03-cairo-yesterday','https://example.test/yesterday',
  ((now() at time zone 'Africa/Cairo')::date-1)::timestamp at time zone 'Africa/Cairo'
from app.competitors where company_code='C999';
insert into app.items(competitor_id,platform,item_type,external_id,url,first_seen_at)
select id,'news','news_article','m03-cairo-today','https://example.test/today',
  (now() at time zone 'Africa/Cairo')::date::timestamp at time zone 'Africa/Cairo'
from app.competitors where company_code='C999';
insert into m03_results values('health',ops.daily_health());
select extensions.ok((select value ?& array['failing_accounts','stale_accounts','queues','items_new_yesterday',
  'cost_yesterday','budget','month_to_date_usd','forecast_month_usd','workflow_errors_24h'] from m03_results where label='health'),'health returns all documented sections');
select extensions.ok((select value->'stale_accounts' @> '[{"account_id":"10000000-0000-4000-8000-000000000010"}]' from m03_results where label='health'),'daily account older than forty-eight hours is stale');
select extensions.ok((select not(value->'stale_accounts' @> '[{"account_id":"10000000-0000-4000-8000-000000000011"}]') from m03_results where label='health'),'weekly account within nine days is not stale');
select extensions.ok((select value->'stale_accounts' @> '[{"account_id":"10000000-0000-4000-8000-000000000012"}]' from m03_results where label='health'),'weekly account older than nine days is stale');
select extensions.ok((select value->'failing_accounts' @> '[{"account_id":"10000000-0000-4000-8000-000000000013"}]' from m03_results where label='health'),'failing account is visible');
select extensions.is((select value#>>'{items_new_yesterday,news}' from m03_results where label='health'),'1','Cairo midnight includes yesterday and excludes today');
select extensions.is((select (value#>>'{cost_yesterday,total}')::numeric from m03_results where label='health'),
  (select sum(cost_usd) from ops.cost_ledger where day=(now() at time zone 'Africa/Cairo')::date-1),'health cost matches yesterday ledger');
select extensions.is((select value#>'{budget,daily_budget_usd}' from m03_results where label='health'),ops.get_setting('daily_budget_usd'),'health uses the actual budget setting');
select extensions.is((select value#>>'{workflow_errors_24h,M03-ERROR}' from m03_results where label='health'),'2','health uses twenty-four-hour error counts');
select extensions.is((select (value#>>'{queues,ai_extract}')::bigint from m03_results where label='health'),
  (select queue_length from pgmq.metrics('ai_extract')),'health reports actual queue length');
select extensions.ok((select (value->>'forecast_month_usd')::numeric>=0 from m03_results where label='health'),'forecast is a nonnegative persisted-cost projection');
select * from extensions.finish();
rollback;
