-- Synthetic local product fixtures. Source HTTP is controlled in the composed
-- application tests; these tests prove the actual restricted SQL boundary.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
grant n8n_writer,api_agent to postgres with inherit false;
grant n8n_writer,api_agent to postgres with set true;

insert into app.competitors(id,company_code,slug,name,priority_tier) values
 ('24000000-0000-4000-8000-000000000001','TEST24','m06-upkeep-local','M06 upkeep synthetic','pilot'),
 ('24000000-0000-4000-8000-000000000002','TEST24OTHER','m06-upkeep-other','M06 unrelated synthetic','pilot');
insert into app.competitor_accounts(id,competitor_id,platform,url,handle,external_id,uploads_playlist_id,backfill_status) values
 ('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000001','vimeo','https://vimeo.com/upkeep','upkeep','123456',null,'done'),
 ('24000000-0000-4000-8000-000000000102','24000000-0000-4000-8000-000000000002','vimeo','https://vimeo.com/upkeepother','upkeepother','654321',null,'done'),
 ('24000000-0000-4000-8000-000000000201','24000000-0000-4000-8000-000000000001','instagram','https://www.instagram.com/upkeep/','upkeep',null,null,'done'),
 ('24000000-0000-4000-8000-000000000301','24000000-0000-4000-8000-000000000001','youtube','https://www.youtube.com/@upkeep','upkeep','UC0000000000000000000001','UU0000000000000000000001','done'),
 ('24000000-0000-4000-8000-000000000401','24000000-0000-4000-8000-000000000001','linkedin','https://www.linkedin.com/company/upkeep/','upkeep',null,null,'not_applicable'),
 ('24000000-0000-4000-8000-000000000501','24000000-0000-4000-8000-000000000001','instagram_stories','https://www.instagram.com/upkeep/','upkeep',null,null,'not_applicable');
select set_config('test.upkeep.since',((clock_timestamp() at time zone 'UTC')::date-30)::text,true);
insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,published_at,title,metrics,ai_status,locked_fields,status,removed_detected_at)
select ('24000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000101','vimeo','video','upkeep'||n,
  'https://vimeo.com/'||n,
  case when n=4 then current_setting('test.upkeep.since')::date::timestamp at time zone 'UTC'-interval '1 millisecond'
    when n=5 then current_setting('test.upkeep.since')::date::timestamp at time zone 'UTC'
    when n=14 then null else now()-interval '1 day' end,
  'Preserve human title',jsonb_build_object('plays',10,'likes',4,'unknown_preserved',7),'published',
  case when n=6 then array['status'] when n=7 then array['removed_detected_at'] when n=8 then array['metrics.plays'] else '{}'::text[] end,
  case when n=3 then 'removed'::app.item_status else 'active'::app.item_status end,
  case when n=3 then now()-interval '1 hour' else null end
from unnest(array[1,2,3,4,5,6,7,8,10,14]) n;
insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,published_at)
values('24000000-0000-4000-8000-000000000009','24000000-0000-4000-8000-000000000002',
  '24000000-0000-4000-8000-000000000102','vimeo','video','foreign24','https://vimeo.com/9',now()-interval '1 day');

select extensions.ok(has_function_privilege('n8n_writer','ops.apply_upkeep_observation(uuid,uuid,date,date,jsonb,text[],text,timestamptz)','EXECUTE'),'writer can execute atomic upkeep');
select extensions.ok(not has_function_privilege('api_agent','ops.apply_upkeep_observation(uuid,uuid,date,date,jsonb,text[],text,timestamptz)','EXECUTE')
  and not has_function_privilege('anon','ops.mark_removed(uuid,uuid,text[],date)','EXECUTE')
  and not has_function_privilege('authenticated','ops.refresh_item_metrics(uuid,uuid,jsonb,date)','EXECUTE'),'public and agent cannot mutate upkeep');
select extensions.ok(not has_function_privilege('n8n_writer','private.m06_upkeep_remove(uuid,text[],date,timestamptz)','EXECUTE')
  and not has_function_privilege('n8n_writer','private.m06_upkeep_replay(uuid,text,jsonb)','EXECUTE'),'private mutation helpers are inaccessible');
select extensions.ok(not has_table_privilege('n8n_writer','app.items','UPDATE,DELETE,INSERT') and not has_table_privilege('n8n_writer','ops.audit_log','INSERT'),'writer cannot bypass RPCs');
select extensions.ok((select bool_and(prosecdef and proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname in('get_removal_targets','get_upkeep_source_runs','mark_removed','refresh_item_metrics','apply_upkeep_observation','upkeep_request_status')),'upkeep definers have empty search path');
select extensions.throws_ok($$select ops.get_removal_targets('instagram_stories',30)$$,'22023',null,'stories never removal targets');
select extensions.throws_ok($$select ops.get_removal_targets('linkedin_employees',30)$$,'22023',null,'employee snapshots never removal targets');
select extensions.throws_ok($$select ops.get_removal_targets('website_work_page',30)$$,'22023',null,'unsupported website coverage stays explicit');
select extensions.throws_ok($$select ops.get_removal_targets('vimeo',0)$$,'22023',null,'invalid date window rejected');
select set_config('test.upkeep.target',(select t::text from jsonb_array_elements(ops.get_removal_targets('vimeo',30)) t where t->>'account_id'='24000000-0000-4000-8000-000000000101'),true);
select extensions.is(current_setting('test.upkeep.target')::jsonb->>'competitor_id','24000000-0000-4000-8000-000000000001','target carries stored owner');
select extensions.is(current_setting('test.upkeep.target')::jsonb->>'since',current_setting('test.upkeep.since'),'requested UTC date boundary is exact');
select extensions.ok((current_setting('test.upkeep.target')::jsonb->'known_external_ids')?'upkeep3','removed items remain targets for restoration');
select extensions.ok(not((current_setting('test.upkeep.target')::jsonb->'known_external_ids')?'upkeep4'),'item before requested boundary excluded');
select extensions.ok((current_setting('test.upkeep.target')::jsonb->'known_external_ids')?'upkeep5','item exactly on boundary included');
select extensions.ok(not((current_setting('test.upkeep.target')::jsonb->'known_external_ids')?'foreign24'),'other owner not in target');
select extensions.is(ops.get_upkeep_source_runs('24000000-0000-4000-8000-000000000201'),'[]'::jsonb,'no paid run fabricated');
insert into ops.scrape_runs(id,workflow,platform,mode,env,status) values
 ('24000000-0000-4000-8000-000000000601','WF-11','instagram','backfill','dev','success');
insert into ops.collector_runs(run_id,registration_closed) values('24000000-0000-4000-8000-000000000601',true);
insert into ops.collector_accounts(run_id,account_id,context) values('24000000-0000-4000-8000-000000000601','24000000-0000-4000-8000-000000000201','{}');
insert into ops.apify_runs(apify_run_id,actor_id,run_id,account_ids,purpose,status,dataset_id,finished_at,processed_at) values
 ('LocalUpkeepPosts24','apify/instagram-scraper','24000000-0000-4000-8000-000000000601',array['24000000-0000-4000-8000-000000000201']::uuid[],'backfill','SUCCEEDED','LocalUpkeepPostsDataset24',now()-interval '1 hour',now()),
 ('LocalUpkeepReels24','apify/instagram-scraper','24000000-0000-4000-8000-000000000601',array['24000000-0000-4000-8000-000000000201']::uuid[],'backfill','SUCCEEDED','LocalUpkeepReelsDataset24',now()-interval '1 hour',now());
insert into ops.collector_launches(launch_id,run_id,actor_id,pass,account_ids,purpose,results_limit,approval_id,max_actor_starts,max_actor_usd,max_total_usd,apify_run_id,dataset_complete)
select ('24000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'24000000-0000-4000-8000-000000000601','apify/instagram-scraper',
  case when n=701 then 'posts' else 'reels' end,array['24000000-0000-4000-8000-000000000201']::uuid[],'backfill',30,
  '24000000-0000-4000-8000-000000000099',2,1,2,case when n=701 then 'LocalUpkeepPosts24' else 'LocalUpkeepReels24' end,true
from unnest(array[701,702]) n;
select extensions.is(jsonb_array_length(ops.get_upkeep_source_runs('24000000-0000-4000-8000-000000000201')),2,'paid metadata requires registered processed posts and reels');
select extensions.is(ops.get_upkeep_source_runs('24000000-0000-4000-8000-000000000201')->0->'build_id','null'::jsonb,'historical absent build identity remains unknown');
select extensions.is(ops.get_upkeep_source_runs('24000000-0000-4000-8000-000000000201')->0->>'run_id','LocalUpkeepPosts24','paid reader receives only known registered run identity');
update ops.apify_runs set status='FAILED' where apify_run_id='LocalUpkeepReels24';
select extensions.is(jsonb_array_length(ops.get_upkeep_source_runs('24000000-0000-4000-8000-000000000201')),1,'provider failure is not eligible retained data');
update app.competitor_accounts set status='paused' where id='24000000-0000-4000-8000-000000000102';
select extensions.ok(not exists(select 1 from jsonb_array_elements(ops.get_removal_targets('vimeo',30)) t where t->>'account_id'='24000000-0000-4000-8000-000000000102'),'paused account excluded');
update app.competitor_accounts set status='active',locked_until=now()+interval '1 hour' where id='24000000-0000-4000-8000-000000000102';
select extensions.ok(not exists(select 1 from jsonb_array_elements(ops.get_removal_targets('vimeo',30)) t where t->>'account_id'='24000000-0000-4000-8000-000000000102'),'claimed account excluded');
update app.competitor_accounts set locked_until=null where id='24000000-0000-4000-8000-000000000102';
select set_config('test.upkeep.rows_before',(select jsonb_agg(to_jsonb(i)-array['status','removed_detected_at','updated_at'] order by i.id)::text from app.items i where account_id='24000000-0000-4000-8000-000000000101'),true);
select set_config('test.upkeep.ai_before',(select count(*)::text from pgmq.q_ai_extract),true);
set local role n8n_writer;
select extensions.throws_ok($$update app.items set status='removed' where external_id='upkeep1'$$,'42501',null,'writer cannot directly remove');
select extensions.is(ops.mark_removed('24000000-0000-4000-8000-000000001001','24000000-0000-4000-8000-000000000101','{}',current_setting('test.upkeep.since')::date)->'result'->>'skipped','empty_listing','empty listing never mass-removes');
select extensions.is(ops.mark_removed('24000000-0000-4000-8000-000000001002','24000000-0000-4000-8000-000000000101',array['upkeep1','upkeep3','upkeep8','upkeep10'],current_setting('test.upkeep.since')::date)->'result',
  '{"removed":2,"restored":1,"skipped":null}'::jsonb,'complete listing removes absence and restores observed item');
select extensions.is(ops.mark_removed('24000000-0000-4000-8000-000000001002','24000000-0000-4000-8000-000000000101',array['upkeep1','upkeep3','upkeep8','upkeep10'],current_setting('test.upkeep.since')::date)->>'replayed','true','same request is replayed');
select extensions.throws_ok($$select ops.mark_removed('24000000-0000-4000-8000-000000001002','24000000-0000-4000-8000-000000000101',array['upkeep2'],current_setting('test.upkeep.since')::date)$$,'55000',null,'request reuse with different listing rejected');
select extensions.throws_ok($$select ops.mark_removed(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',array['foreign24'],current_setting('test.upkeep.since')::date)$$,'42501',null,'foreign seen identity rejected');
select extensions.throws_ok($$select ops.mark_removed(gen_random_uuid(),'24000000-0000-4000-8000-000000000501',array['upkeep1'],current_setting('test.upkeep.since')::date)$$,'42501',null,'story account rejected at mutation boundary');
select extensions.throws_ok($$select ops.mark_removed(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',array['upkeep1'],current_date+1)$$,'22023',null,'future date rejected');
select extensions.throws_ok($$select ops.mark_removed(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',array['upkeep1','upkeep1'],current_setting('test.upkeep.since')::date)$$,'22023',null,'duplicate identities rejected');
reset role;
select extensions.is((select count(*)::int from ops.audit_log where actor_id='24000000-0000-4000-8000-000000001002'),1,'replay adds no audit');
select extensions.is((select status::text from app.items where external_id='upkeep4'),'active','before-date item preserved');
select extensions.is((select status::text from app.items where external_id='upkeep5'),'removed','exact date boundary removal is permitted');
select extensions.is((select status::text from app.items where external_id='upkeep6'),'active','human status lock preserved');
select extensions.is((select status::text from app.items where external_id='upkeep7'),'active','human removal timestamp lock preserved');
select extensions.is((select status::text from app.items where external_id='upkeep3'),'active','seen removed item restored');
select extensions.ok((select removed_detected_at is null from app.items where external_id='upkeep3'),'restoration clears removal marker');
select extensions.is((select status::text from app.items where external_id='upkeep14'),'active','unknown publication date cannot prove absence');
select extensions.is((select jsonb_agg(to_jsonb(i)-array['status','removed_detected_at','updated_at'] order by i.id) from app.items i where account_id='24000000-0000-4000-8000-000000000101'),current_setting('test.upkeep.rows_before')::jsonb,'removal preserves every unrelated field and all rows');

select set_config('test.upkeep.metrics',jsonb_build_array(
  jsonb_build_object('external_id','upkeep1','metrics',jsonb_build_object('plays',31,'likes',null),'observed_at',clock_timestamp()),
  jsonb_build_object('external_id','upkeep8','metrics',jsonb_build_object('plays',32),'observed_at',clock_timestamp()))::text,true);
set local role n8n_writer;
select extensions.is(ops.refresh_item_metrics('24000000-0000-4000-8000-000000001003','24000000-0000-4000-8000-000000000101',current_setting('test.upkeep.metrics')::jsonb,current_setting('test.upkeep.since')::date)->'result',
  '{"updated":1,"skipped":1}'::jsonb,'metrics update observed item and preserve metric lock');
select extensions.is(ops.refresh_item_metrics('24000000-0000-4000-8000-000000001003','24000000-0000-4000-8000-000000000101',current_setting('test.upkeep.metrics')::jsonb,current_setting('test.upkeep.since')::date)->>'replayed','true','metric replay avoids another update');
select extensions.is(ops.upkeep_request_status('24000000-0000-4000-8000-000000001003')->>'operation','refresh_metrics','uncertain committed metrics can be reconciled by status');
select extensions.is(ops.upkeep_request_status('24000000-0000-4000-8000-000000001004')->>'state','missing','missing request does not pretend a commit');
select extensions.throws_ok($$select ops.refresh_item_metrics(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',jsonb_build_array(jsonb_build_object('external_id','upkeep1','metrics',jsonb_build_object('plays',-1),'observed_at',clock_timestamp())),current_setting('test.upkeep.since')::date)$$,'22023',null,'negative metric rejected');
select extensions.throws_ok($$select ops.refresh_item_metrics(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',jsonb_build_array(jsonb_build_object('external_id','upkeep1','metrics',jsonb_build_object('plays','Infinity'),'observed_at',clock_timestamp())),current_setting('test.upkeep.since')::date)$$,'22023',null,'non-numeric metric rejected');
select extensions.throws_ok($$select ops.refresh_item_metrics(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',jsonb_build_array(jsonb_build_object('external_id','foreign24','metrics',jsonb_build_object('plays',1),'observed_at',clock_timestamp())),current_setting('test.upkeep.since')::date)$$,'42501',null,'metric cannot cross account ownership');
reset role;
select extensions.is((select metrics->>'plays' from app.items where external_id='upkeep1'),'31','actual metric updated');
select extensions.is((select metrics->>'likes' from app.items where external_id='upkeep1'),'4','unknown source value does not erase known metric');
select extensions.is((select metrics->>'unknown_preserved' from app.items where external_id='upkeep1'),'7','unrelated metric field preserved');
select extensions.is((select metrics->>'plays' from app.items where external_id='upkeep8'),'10','human metric lock honored');
select extensions.is((select ai_status::text from app.items where external_id='upkeep1'),'published','metric refresh preserves AI state');
select extensions.is((select count(*)::text from pgmq.q_ai_extract),current_setting('test.upkeep.ai_before'),'upkeep never enqueues AI');
select extensions.is(ops.refresh_item_metrics(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',jsonb_build_array(jsonb_build_object('external_id','upkeep1','metrics',jsonb_build_object('plays',2),'observed_at',clock_timestamp()-interval '1 hour')),current_setting('test.upkeep.since')::date)->'result'->>'updated','0','old observation cannot roll metrics backward');

-- One atomic apply receipt is the actual Node adapter's mutation boundary.
-- Protect an item arriving while the external listing is being read.
select set_config('test.upkeep.snapshot',clock_timestamp()::text,true);
update app.items set created_at=clock_timestamp() where external_id='upkeep10';
select set_config('test.upkeep.applyrows',jsonb_build_array(jsonb_build_object('external_id','upkeep1','metrics',jsonb_build_object('plays',45),'observed_at',clock_timestamp()))::text,true);
set local role n8n_writer;
select extensions.is(ops.apply_upkeep_observation('24000000-0000-4000-8000-000000001005','24000000-0000-4000-8000-000000000101',current_setting('test.upkeep.since')::date,current_setting('test.upkeep.since')::date,
  current_setting('test.upkeep.applyrows')::jsonb,null,'range_not_covered',current_setting('test.upkeep.snapshot')::timestamptz)->'result'->>'metrics_updated','1','partial listing refreshes valid metrics atomically');
select extensions.is(ops.upkeep_request_status('24000000-0000-4000-8000-000000001005')->'result'->>'eligible','false','partial apply records no removal eligibility');
select extensions.is(ops.upkeep_request_status('24000000-0000-4000-8000-000000001005')->'result'->'removal','null'::jsonb,'partial listing does not remove');
select extensions.is(ops.apply_upkeep_observation('24000000-0000-4000-8000-000000001007','24000000-0000-4000-8000-000000000101',current_setting('test.upkeep.since')::date,current_setting('test.upkeep.since')::date,
  '[]','{}',null,current_setting('test.upkeep.snapshot')::timestamptz)->'result'->'removal','null'::jsonb,'empty complete claim produces null removal receipt');
select extensions.is(ops.upkeep_request_status('24000000-0000-4000-8000-000000001007')->'result'->>'reason','empty_listing','empty atomic observation preserves exact skip reason');
select extensions.is(ops.apply_upkeep_observation('24000000-0000-4000-8000-000000001006','24000000-0000-4000-8000-000000000101',current_setting('test.upkeep.since')::date,current_setting('test.upkeep.since')::date,
  '[]',array['upkeep1','upkeep3','upkeep8'],null,current_setting('test.upkeep.snapshot')::timestamptz)->'result'->>'eligible','true','complete derived listing applies removal');
select extensions.is(ops.apply_upkeep_observation('24000000-0000-4000-8000-000000001006','24000000-0000-4000-8000-000000000101',current_setting('test.upkeep.since')::date,current_setting('test.upkeep.since')::date,
  '[]',array['upkeep1','upkeep3','upkeep8'],null,current_setting('test.upkeep.snapshot')::timestamptz)->>'replayed','true','atomic receipt replayed without another mutation');
select extensions.is(ops.upkeep_request_status('24000000-0000-4000-8000-000000001006')->>'operation','apply_observation','atomic uncertain outcome has a durable status');
select extensions.throws_ok($$select ops.apply_upkeep_observation(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',current_setting('test.upkeep.since')::date,current_setting('test.upkeep.since')::date,
  jsonb_build_array(jsonb_build_object('external_id','upkeep1','metrics',jsonb_build_object('plays',99),'observed_at',clock_timestamp())),array['foreign24'],null,current_setting('test.upkeep.snapshot')::timestamptz)$$,'42501',null,'foreign removal rolls back the composed metrics update');
select extensions.throws_ok($$select ops.apply_upkeep_observation(gen_random_uuid(),'24000000-0000-4000-8000-000000000101',current_setting('test.upkeep.since')::date,current_setting('test.upkeep.since')::date,
  '[]',null,'range_not_covered',clock_timestamp()+interval '1 day')$$,'22023',null,'caller cannot claim a future observation cutoff');
reset role;
select extensions.is((select metrics->>'plays' from app.items where external_id='upkeep1'),'45','failed atomic apply leaves metrics at prior committed observation');
select extensions.is((select status::text from app.items where external_id='upkeep10'),'active','new item after listing snapshot is not removed');
select extensions.is((select count(*)::text from pgmq.q_ai_extract),current_setting('test.upkeep.ai_before'),'atomic apply and replay add no AI');
select extensions.ok(not exists(select 1 from app.items where account_id='24000000-0000-4000-8000-000000000101' and title<>'Preserve human title'),'all human titles preserved');
select extensions.is((select count(*)::int from app.items where account_id='24000000-0000-4000-8000-000000000101'),10,'all collected rows retained');
select * from extensions.finish();
rollback;
