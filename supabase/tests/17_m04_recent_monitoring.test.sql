-- HC-01 uses accepted dev IDs only as public identity fixtures; every row is synthetic and rolled back.
begin;
set local statement_timeout='10s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
grant n8n_writer to postgres with inherit false;
grant n8n_writer to postgres with set true;
create temporary table hc01_identity(account_id uuid,competitor_id uuid,company_code text,handle text,url text);
insert into hc01_identity values
 ('962c9c7e-aa0f-46ae-911b-3265859e0577','94928d31-8983-403c-bdbd-f5f44613d631','C000','everyone.film','https://www.instagram.com/everyone.film/'),
 ('bed82782-753f-4ba9-91ca-691ef36f75c6','9a0dba8a-b946-45a1-bd53-933216f1fc4d','C001','goodpeoplefilms','https://www.instagram.com/goodpeoplefilms/'),
 ('46149fb9-8905-4b76-9834-4b38f668a2e2','7ba084a1-52a1-49d5-b3a9-e488289cb504','C130','bigfootfilms','https://www.instagram.com/bigfootfilms/'),
 ('2d42d451-ac9a-42ac-a879-8760d63c8108','db652794-e33e-4723-ab48-cf75e0b8ae68','C270','thetalkies','https://www.instagram.com/thetalkies/'),
 ('3ca3befa-abe6-4540-a389-0cf16115c581','1cd50dba-b2de-4740-b28c-6d53ebd2b08d','C226','bigkahunafilms','https://www.instagram.com/bigkahunafilms/');
do $$ begin
 if exists(select 1 from app.competitor_accounts a join hc01_identity h on a.id=h.account_id)
 or exists(select 1 from app.competitors c join hc01_identity h on c.id=h.competitor_id or c.company_code=h.company_code)
 then raise exception 'HC01 local fixture collision; preserve existing rows'; end if;
end $$;
insert into app.competitors(id,company_code,slug,name,priority_tier,status)
 select competitor_id,company_code,'test-hc01-'||lower(company_code),'Synthetic HC01 '||company_code,'pilot','active' from hc01_identity;
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status,next_due_at,backfill_status,last_item_published_at,last_external_id,backfill_cursor)
 select account_id,competitor_id,'instagram',handle,url,'active','2000-01-01',
 case when company_code in ('C001','C226') then 'running'::app.backfill_status else 'pending'::app.backfill_status end,
 '2026-10-01','hc01-old',
 '{"posts":{"oldest_seen":"2026-01-01","history_state":"incomplete","results_limit":50},"reels":{"history_state":"incomplete","resume_supported":false}}'::jsonb
 from hc01_identity;
select set_config('hc01.ids',(select jsonb_agg(account_id order by account_id)::text from hc01_identity),true);
set local role n8n_writer;
select set_config('hc01.run',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"dev","mode":"daily","execution_id":"hc01-local-daily"}')->'result'->>'run_id',true);
select set_config('hc01.claim',jsonb_build_object('run_id',current_setting('hc01.run'),'platform','instagram','mode','daily','limit',5,'account_ids',current_setting('hc01.ids')::jsonb)::text,true);
reset role;
select extensions.ok(has_function_privilege('n8n_writer','ops.collector_execute(uuid,text,jsonb)','EXECUTE'),'restricted writer keeps fixed RPC access');
select extensions.ok(not has_function_privilege('api_agent','ops.collector_execute(uuid,text,jsonb)','EXECUTE'),'read agent cannot call mutating RPC');
select extensions.ok(not has_function_privilege('anon','ops.collector_execute(uuid,text,jsonb)','EXECUTE') and not has_function_privilege('authenticated','ops.collector_execute(uuid,text,jsonb)','EXECUTE'),'public application roles remain denied');
select extensions.ok((select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid='ops.collector_execute(uuid,text,jsonb)'::regprocedure),'replacement retains empty-path definer security');
select extensions.ok(not has_table_privilege('n8n_writer','ops.collector_accounts','INSERT') and not has_table_privilege('n8n_writer','app.competitor_accounts','UPDATE'),'no direct DML grants introduced');
select set_config('hc01.before',(select jsonb_object_agg(a.id,jsonb_build_object('status',a.backfill_status,'cursor',a.backfill_cursor,'watermark',a.last_item_published_at))::text from app.competitor_accounts a join hc01_identity h on h.account_id=a.id),true);
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"prod","mode":"daily","execution_id":"hc01-forbidden-prod"}')$test$,'42501',null,'production run labels are still denied');
select set_config('hc01.generic',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"dev","mode":"daily","execution_id":"hc01-generic-stays-gated"}')->'result'->>'run_id',true);
select set_config('hc01.generic_result',(ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('hc01.generic'),'platform','instagram','mode','daily','limit',100))->'result')::text,true);
reset role;
select extensions.is((select count(*)::int from jsonb_array_elements(current_setting('hc01.generic_result')::jsonb) e join hc01_identity h on h.account_id=(e.value->>'account_id')::uuid),0,'omitting exact IDs keeps the general history gate for all five accounts');

-- Every denial must roll back the whole exact-set claim, not partially claim four accounts.
update app.competitor_accounts set last_item_published_at=null where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects missing watermark in an exact set');
reset role;
update app.competitor_accounts set last_item_published_at='2026-10-01' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set last_item_published_at='infinity' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects nonfinite watermark in an exact set');
reset role;
update app.competitor_accounts set last_item_published_at='2026-10-01' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set last_item_published_at=now()+interval '1 day' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects future watermark in an exact set');
reset role;
update app.competitor_accounts set last_item_published_at='2026-10-01' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set last_external_id='' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects missing watermark ID in an exact set');
reset role;
update app.competitor_accounts set last_external_id='hc01-old' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set status='paused' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects paused account in an exact set');
reset role;
update app.competitor_accounts set status='active' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set status='invalid' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects invalid account in an exact set');
reset role;
update app.competitor_accounts set status='active' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set status='failing' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects failing incomplete account in an exact set');
reset role;
update app.competitor_accounts set status='active' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set next_due_at=now()+interval '1 day' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects not-yet-due account in an exact set');
reset role;
update app.competitor_accounts set next_due_at='2000-01-01' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set locked_until=now()+interval '1 hour' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects another live claim in an exact set');
reset role;
update app.competitor_accounts set locked_until=null where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set handle='unapproved_hc01_handle' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects public handle drift in an exact set');
reset role;
update app.competitor_accounts set handle='everyone.film' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set url='https://www.instagram.com/other_hc01/' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects public URL drift in an exact set');
reset role;
update app.competitor_accounts set url='https://www.instagram.com/everyone.film/' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitor_accounts set competitor_id='9a0dba8a-b946-45a1-bd53-933216f1fc4d' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'HC01 rejects competitor identity drift in an exact set');
reset role;
update app.competitor_accounts set competitor_id='94928d31-8983-403c-bdbd-f5f44613d631' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
update app.competitors set status='paused' where id='94928d31-8983-403c-bdbd-f5f44613d631';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'inactive competitor cannot use the exception');
reset role;
update app.competitors set status='active' where id='94928d31-8983-403c-bdbd-f5f44613d631';
update app.competitors set company_code='HC01-DRIFT' where id='94928d31-8983-403c-bdbd-f5f44613d631';
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.claim')::jsonb)$test$,'55000',null,'company-code drift cannot remap an approved identity');
reset role;
update app.competitors set company_code='C000' where id='94928d31-8983-403c-bdbd-f5f44613d631';
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status,next_due_at,backfill_status,last_item_published_at,last_external_id) values
 ('17000000-0000-4000-8000-000000000021','94928d31-8983-403c-bdbd-f5f44613d631','instagram','hc01_unapproved','https://www.instagram.com/hc01_unapproved/','active','2000-01-01','pending','2026-10-01','hc01-old'),
 ('985a57dd-7934-422d-9d18-4e8ca59fc197','94928d31-8983-403c-bdbd-f5f44613d631','vimeo','everyonefilms','https://vimeo.com/everyonefilms','active','2000-01-01','pending','2026-10-01','hc01-old');
select set_config('hc01.mixed',jsonb_set(current_setting('hc01.claim')::jsonb,'{account_ids,0}','"17000000-0000-4000-8000-000000000021"'::jsonb)::text,true);
set local role n8n_writer;
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',current_setting('hc01.mixed')::jsonb)$test$,'55000',null,'a sixth watermarked account cannot replace an approved member');
reset role;
select extensions.is((select count(*)::int from app.competitor_accounts a join hc01_identity h on a.id=h.account_id where a.last_run_id is not null or a.locked_until is not null),0,'every failed mixed selection left all five approved accounts unclaimed');
select extensions.is((select count(*)::int from ops.collector_accounts where run_id=current_setting('hc01.run')::uuid),0,'denials left no partial collector membership');
set local role n8n_writer;
select set_config('hc01.vimeo',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-10","platform":"vimeo","env":"dev","mode":"daily","execution_id":"hc01-vimeo-stays-gated"}')->'result'->>'run_id',true);
select extensions.throws_ok($test$select ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('hc01.vimeo'),'platform','vimeo','mode','daily','limit',1,'account_ids',jsonb_build_array('985a57dd-7934-422d-9d18-4e8ca59fc197')))$test$,'55000',null,'selected Vimeo pending history does not gain daily eligibility');
select extensions.is(jsonb_array_length(ops.collector_execute('17000000-0000-4000-8000-000000000100','claim',current_setting('hc01.claim')::jsonb)->'result'),5,'all five approved watermarked accounts claim successfully despite pending/running history');
select extensions.is(ops.collector_execute('17000000-0000-4000-8000-000000000100','claim',current_setting('hc01.claim')::jsonb)->>'replayed','true','an identical claim returns its durable receipt');
reset role;
select extensions.is((select count(*)::int from ops.collector_passes where run_id=current_setting('hc01.run')::uuid),10,'one claim registers both posts and reels for each selected account');
select extensions.ok((select bool_and(a.backfill_status::text=(current_setting('hc01.before')::jsonb->a.id::text->>'status') and a.backfill_cursor=(current_setting('hc01.before')::jsonb->a.id::text->'cursor')) from app.competitor_accounts a join hc01_identity h on a.id=h.account_id),'claim does not mark history done or rewrite its nested cursor');

-- Synthetic local actor registry only: no provider start or request occurs.
select set_config('hc01.approval',gen_random_uuid()::text,true);
select set_config('hc01.groups',(select jsonb_agg(jsonb_build_object('account_id',account_id,'normalizer_version','instagram-scraper.v1','status','success','source_evidence',true,'backfill_done',false,'backfill_cursor',null,'items',jsonb_build_array(jsonb_build_object('platform','instagram','actor','apify/instagram-scraper','external_id','hc01-post-'||account_id::text,'item_type','post','url','https://www.instagram.com/p/hc01_local_fixture/','published_at','2026-10-20T00:00:00Z','payload','{}'::jsonb))) order by account_id)::text from hc01_identity),true);
set local role n8n_writer;
do $$ declare p text; args jsonb; begin
 foreach p in array array['posts','reels'] loop
  args:=jsonb_build_object('run_id',current_setting('hc01.run'),'actor_id','apify/instagram-scraper','pass',p,'account_ids',current_setting('hc01.ids')::jsonb,'purpose','daily','launch_id',gen_random_uuid(),'results_limit',30,'approval_id',current_setting('hc01.approval'),'max_actor_starts',2,'max_actor_usd',1,'max_total_usd',2);
  perform ops.collector_execute(gen_random_uuid(),'launch',args);
  perform ops.collector_execute(gen_random_uuid(),'register',(args-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||jsonb_build_object('apify_run_id','hc01-local-'||p));
 end loop;
end $$;
select extensions.lives_ok($test$select ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','hc01-local-posts','offset',0,'raw_count',5,'has_more',false,'groups',current_setting('hc01.groups')::jsonb))$test$,'daily posts stage uses the existing restricted ingestion path');
select set_config('hc01.posts_final',jsonb_build_object('apify_run_id','hc01-local-posts','status','SUCCEEDED','dataset_id','hc01-local-posts-dataset','usage_usd',0.01,'groups',(select jsonb_agg(e.value||'{"items":[]}'::jsonb) from jsonb_array_elements(current_setting('hc01.groups')::jsonb) e))::text,true);
select extensions.is(ops.collector_execute(gen_random_uuid(),'settle',current_setting('hc01.posts_final')::jsonb)->'result'->>'finished_now','false','posts cannot finish the parent while reels is pending');
reset role;
select extensions.is((select count(*)::int from ops.scrape_run_accounts where run_id=current_setting('hc01.run')::uuid),0,'posts do not release any account before its reels pass');
select extensions.ok((select bool_and(a.locked_until>now() and a.last_run_id=current_setting('hc01.run')::uuid) from app.competitor_accounts a join hc01_identity h on a.id=h.account_id),'both passes retain the same live account ownership');
select set_config('hc01.reels_groups',(select jsonb_agg(e.value||jsonb_build_object('items',jsonb_build_array((e.value->'items'->0)||jsonb_build_object('external_id','hc01-reel-'||(e.value->>'account_id'),'item_type','reel','published_at','2026-10-25T00:00:00Z')))) from jsonb_array_elements(current_setting('hc01.groups')::jsonb) e)::text,true);
set local role n8n_writer;
select extensions.lives_ok($test$select ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','hc01-local-reels','offset',0,'raw_count',5,'has_more',false,'groups',current_setting('hc01.reels_groups')::jsonb))$test$,'reels stage shares the same claim and ingestion contract');
select set_config('hc01.reels_final',(current_setting('hc01.posts_final')::jsonb||'{"apify_run_id":"hc01-local-reels","dataset_id":"hc01-local-reels-dataset"}'::jsonb)::text,true);
select extensions.is(ops.collector_execute(gen_random_uuid(),'settle',current_setting('hc01.reels_final')::jsonb)->'result'->>'finished_now','false','both callbacks still wait for parent registration closure');
select extensions.is(ops.collector_execute(gen_random_uuid(),'close_registration',jsonb_build_object('run_id',current_setting('hc01.run')))->'result'->'summary'->>'status','success','closing registration finishes the one joint daily parent');
reset role;
select extensions.ok((select bool_and(a.backfill_status::text=(current_setting('hc01.before')::jsonb->a.id::text->>'status') and a.backfill_cursor=(current_setting('hc01.before')::jsonb->a.id::text->'cursor')) from app.competitor_accounts a join hc01_identity h on a.id=h.account_id),'daily settlement preserves every pending/running history status and cursor');
select extensions.ok((select bool_and(a.last_item_published_at='2026-10-20T00:00:00Z'::timestamptz) from app.competitor_accounts a join hc01_identity h on a.id=h.account_id),'primary watermark advances and newer secondary reels do not replace it');
select extensions.ok((select bool_and(a.locked_until is null) from app.competitor_accounts a join hc01_identity h on a.id=h.account_id),'joint completion releases all five claims once');
select extensions.is((select count(*)::int from app.items where external_id like 'hc01-post-%' or external_id like 'hc01-reel-%'),10,'ten synthetic local posts/reels items reached SQL');
select extensions.is((select sum(cost_usd)::numeric from ops.cost_ledger where run_id=current_setting('hc01.run')::uuid),0.02::numeric,'two synthetic measured actor costs allocate exactly once');

-- A terminal callback must not release a subsequent recent-monitoring claim.
update app.competitor_accounts set next_due_at='2000-01-01' where id='962c9c7e-aa0f-46ae-911b-3265859e0577';
set local role n8n_writer;
select set_config('hc01.new_run',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"dev","mode":"daily","execution_id":"hc01-new-claim"}')->'result'->>'run_id',true);
select extensions.is(jsonb_array_length(ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('hc01.new_run'),'platform','instagram','mode','daily','limit',1,'account_ids',jsonb_build_array('962c9c7e-aa0f-46ae-911b-3265859e0577')))->'result'),1,'a later due daily run can claim an approved account while history stays incomplete');
select extensions.is(ops.collector_execute(gen_random_uuid(),'settle',current_setting('hc01.posts_final')::jsonb)->'result'->>'updated','false','old posts callback recovers only its terminal receipt');
select extensions.is(ops.collector_execute(gen_random_uuid(),'settle',current_setting('hc01.reels_final')::jsonb)->'result'->>'updated','false','old reels callback recovers only its terminal receipt');
reset role;
select extensions.ok((select last_run_id=current_setting('hc01.new_run')::uuid and locked_until>now() from app.competitor_accounts where id='962c9c7e-aa0f-46ae-911b-3265859e0577'),'old callbacks leave the new account claim intact');
select extensions.is((select count(*)::int from app.items where external_id like 'hc01-post-%' or external_id like 'hc01-reel-%'),10,'callback replay creates no duplicate item');
select extensions.is((select sum(cost_usd)::numeric from ops.cost_ledger where run_id=current_setting('hc01.run')::uuid),0.02::numeric,'callback replay creates no duplicate cost');
select extensions.is((select count(*)::int from ops.scrape_run_accounts where run_id=current_setting('hc01.run')::uuid),5,'replay retains one completed account result per account');
select * from extensions.finish();
rollback;
