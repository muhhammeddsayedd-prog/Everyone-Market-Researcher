begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
grant n8n_writer,api_agent to postgres with inherit false;
grant n8n_writer,api_agent to postgres with set true;

-- Synthetic rollback fixtures; none is a real actor capture or Storage object.
insert into app.competitors(id,company_code,slug,name,priority_tier)
values('22000000-0000-4000-8000-000000000001','TESTM06ST','m06-stories-local','M06 stories synthetic','pilot');
insert into app.competitor_accounts(id,competitor_id,platform,url,handle,backfill_status,next_due_at)
values('22000000-0000-4000-8000-000000000011','22000000-0000-4000-8000-000000000001','instagram_stories','https://www.instagram.com/m06storiesa/','m06storiesa','not_applicable',now()-interval '1 day'),
 ('22000000-0000-4000-8000-000000000012','22000000-0000-4000-8000-000000000001','instagram_stories','https://www.instagram.com/m06storiesb/','m06storiesb','not_applicable',now()-interval '1 day');
insert into app.items(id,competitor_id,platform,item_type,external_id,url)
values('22000000-0000-4000-8000-000000000021','22000000-0000-4000-8000-000000000001','vimeo','video','m06-backlog','https://vimeo.com/220001');
select pgmq.send_batch('media',array(select jsonb_build_object('item_id','22000000-0000-4000-8000-000000000021') from generate_series(1,267)));
select set_config('test.m06.media_backlog',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q),true);
select set_config('test.m06.cost_before',(select coalesce(sum(cost_usd),0)::text from ops.cost_ledger),true);
create function pg_temp.m06_call(op text,args jsonb,request_id uuid default gen_random_uuid())
returns jsonb language sql as $$select ops.m06_execute(request_id,'m06.'||op,args)$$;
create function pg_temp.m06_launch(parent uuid,identity uuid,accounts jsonb,names jsonb,mode text default 'ingest',actor text default 'data-slayer/instagram-stories-scraper')
returns jsonb language sql as $$select jsonb_build_object('run_id',parent,'launch_id',identity,'actor_id',actor,'pass','primary',
 'account_ids',accounts,'purpose','daily','results_limit',20,'actor_input',jsonb_build_object('usernames',names),
 'approval_id','22000000-0000-4000-8000-000000000099','max_actor_starts',41,'max_actor_usd',1,'max_total_usd',20,'build_id','LocalStoryBuild22','collection_mode',mode,'memory_mbytes',1024,'timeout_secs',600)$$;
create function pg_temp.m06_register(parent uuid,identity uuid,provider text,accounts jsonb,actor text default 'data-slayer/instagram-stories-scraper')
returns jsonb language sql as $$select jsonb_build_object('run_id',parent,'launch_id',identity,'apify_run_id',provider,'actor_id',actor,'pass','primary','account_ids',accounts,'purpose','daily')$$;
select set_config('test.m06.item',jsonb_build_object('platform','instagram_stories','external_id','22001001','actor','data-slayer/instagram-stories-scraper',
 'item_type','story','url','https://www.instagram.com/stories/m06storiesa/22001001/','published_at',to_char(now()-interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
 'caption','Synthetic local story','thumbnail_url','https://images.example.com/m06-story.jpg','payload','{}'::jsonb,'metrics','{}'::jsonb)::text,true);
select set_config('test.m06.row',jsonb_build_object('actor','data-slayer/instagram-stories-scraper','account_id','22000000-0000-4000-8000-000000000011',
 'story_key','22001001','raw_id','22001001','taken_at',to_char(now()-interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
 'has_thumbnail',true,'has_mentions',false,'has_link',false)::text,true);
select extensions.ok((select count(*)=4 and bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='ops' and c.relname in ('m06_story_runs','m06_story_jobs','bakeoff_observations','bakeoff_results')),'all new product tables have RLS');
select extensions.ok(not has_table_privilege('n8n_writer','ops.bakeoff_results','INSERT,UPDATE,DELETE')
 and not has_table_privilege('api_agent','ops.bakeoff_observations','SELECT'),'machine roles cannot directly modify/read private comparison tables');
select extensions.ok((select c.relowner=p.proowner from pg_class c cross join pg_proc p where c.oid='pgmq.q_media_stories'::regclass and p.oid='ingest.upsert_raw_items(uuid,uuid,jsonb)'::regprocedure),
 'RLS story queue owner matches the original ingest definer across administrative migration principals');
select extensions.ok(has_function_privilege('n8n_writer','ops.m06_execute(uuid,text,jsonb)','EXECUTE')
 and not has_function_privilege('anon','ops.m06_execute(uuid,text,jsonb)','EXECUTE')
 and not has_function_privilege('api_agent','ops.story_bakeoff_snapshot(date,date,uuid[])','EXECUTE'),'story RPC privileges remain restricted');
select extensions.ok((select bool_and(prosecdef and proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('ops','private') and p.proname in ('m06_execute','m06_assert_claim','m06_finalize','save_bakeoff_rows','story_bakeoff_snapshot',
 'claim_story_media_batch','record_story_media_outcome','ack_story_media_batch','finish_story_media_batch')),'story definers pin an empty search path');
set local role n8n_writer;
select extensions.throws_ok($$select pg_temp.m06_call('start','{"workflow":"WF-12","platform":"instagram_stories","mode":"daily","env":"prod","execution_id":"22","collection_mode":"ingest"}')$$,'42501',null,'story executor rejects production');
select set_config('test.m06.run',(pg_temp.m06_call('start','{"workflow":"WF-12","platform":"instagram_stories","mode":"daily","env":"dev","execution_id":"22","collection_mode":"ingest"}')->'result'->>'run_id'),true);
select extensions.is(jsonb_array_length(pg_temp.m06_call('claim',jsonb_build_object('run_id',current_setting('test.m06.run'),'platform','instagram_stories','mode','daily','limit',2,
 'account_ids','["22000000-0000-4000-8000-000000000011","22000000-0000-4000-8000-000000000012"]'::jsonb))->'result'),2,'explicit story identities are claimed');
select extensions.is(pg_temp.m06_call('launch',pg_temp.m06_launch(current_setting('test.m06.run')::uuid,'22000000-0000-4000-8000-000000000031',
 '["22000000-0000-4000-8000-000000000011"]','["m06storiesa"]'),'22000000-0000-4000-8000-000000000041')->'result'->>'permit','true','first launch permit is admitted once');
select extensions.is(pg_temp.m06_call('launch',pg_temp.m06_launch(current_setting('test.m06.run')::uuid,'22000000-0000-4000-8000-000000000031',
 '["22000000-0000-4000-8000-000000000011"]','["m06storiesa"]'),'22000000-0000-4000-8000-000000000041')->'result'->>'permit','false','paid launch permit is not replayable');
select extensions.throws_ok($$select pg_temp.m06_call('launch',pg_temp.m06_launch(current_setting('test.m06.run')::uuid,'22000000-0000-4000-8000-000000000039',
 '["22000000-0000-4000-8000-000000000012"]','["wrong-owner"]'))$$,'42501',null,'launch input must match claimed account identities');
select extensions.throws_ok($$select pg_temp.m06_call('launch',pg_temp.m06_launch(current_setting('test.m06.run')::uuid,'22000000-0000-4000-8000-000000000039',
 '["22000000-0000-4000-8000-000000000012"]','["m06storiesb"]')||'{"max_actor_usd":"NaN"}')$$,'22023',null,'non-numeric launch charge is rejected');
select extensions.throws_ok($$select pg_temp.m06_call('close_registration',jsonb_build_object('run_id',current_setting('test.m06.run')))$$,'55000',null,'unregistered uncertain start prevents parent close');
select pg_temp.m06_call('register',pg_temp.m06_register(current_setting('test.m06.run')::uuid,'22000000-0000-4000-8000-000000000031','LocalStoryA22','["22000000-0000-4000-8000-000000000011"]'));
select pg_temp.m06_call('launch',pg_temp.m06_launch(current_setting('test.m06.run')::uuid,'22000000-0000-4000-8000-000000000032','["22000000-0000-4000-8000-000000000012"]','["m06storiesb"]'));
select pg_temp.m06_call('register',pg_temp.m06_register(current_setting('test.m06.run')::uuid,'22000000-0000-4000-8000-000000000032','LocalStoryB22','["22000000-0000-4000-8000-000000000012"]'));
select extensions.is(pg_temp.m06_call('lookup','{"apify_run_id":"LocalStoryA22"}')->'result'->>'build_id','LocalStoryBuild22','callback lookup retains exact build identity');
select extensions.throws_ok($$select pg_temp.m06_call('lookup','{"apify_run_id":"UnknownStory22"}')$$,'42501',null,'unknown actor never receives callback ownership');
select set_config('test.m06.settle',jsonb_build_object('apify_run_id','LocalStoryA22','status','SUCCEEDED','dataset_id','LocalDataset22','usage_usd',0.012345,'observed_at',now(),
 'groups',jsonb_build_array(jsonb_build_object('account_id','22000000-0000-4000-8000-000000000011','status','success','error',null,'items',jsonb_build_array(current_setting('test.m06.item')::jsonb),
 'bakeoff_rows',jsonb_build_array(current_setting('test.m06.row')::jsonb),'observation','stories','source_evidence',true)))::text,true);
select extensions.throws_ok($$select pg_temp.m06_call('settle',jsonb_set(current_setting('test.m06.settle')::jsonb,'{groups,0,account_id}','"22000000-0000-4000-8000-000000000012"'))$$,'42501',null,'callback groups cannot move to a different account');
select extensions.throws_ok($$select pg_temp.m06_call('settle',jsonb_set(current_setting('test.m06.settle')::jsonb,'{groups,0,bakeoff_rows,0,raw_id}','"99999999"'))$$,'42501',null,'comparison identity cannot diverge from the normalized story');
select extensions.throws_ok($$select pg_temp.m06_call('settle',jsonb_set(current_setting('test.m06.settle')::jsonb,'{groups,0,bakeoff_rows,0,story_key}','"99999999"'))$$,'42501',null,'comparison key must match the story or documented minute fallback');
select extensions.is(pg_temp.m06_call('settle',current_setting('test.m06.settle')::jsonb)->'result'->'groups'->0->>'items_new','1','primary story ingests once');
reset role;
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m06.run')::uuid),'running','callback cannot finish an open registration parent');
select extensions.ok((select locked_until>now() and last_run_id=current_setting('test.m06.run')::uuid from app.competitor_accounts where id='22000000-0000-4000-8000-000000000011'),'first completed account claim stays owned until every batch settles');
select extensions.is((select count(*)::int from pgmq.q_media_stories q join app.items i on i.id=(q.message->>'item_id')::uuid where i.external_id='22001001'),1,'new story is enqueued in the dedicated expiring-media lane');
select extensions.is((select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q),current_setting('test.m06.media_backlog'),'267-message generic FIFO remains byte-for-byte untouched');
select extensions.is((select count(*)::int from ops.bakeoff_results where account_id='22000000-0000-4000-8000-000000000011'),1,'comparison rows persist alongside primary ingestion');
set local role n8n_writer;
select extensions.is(pg_temp.m06_call('close_registration',jsonb_build_object('run_id',current_setting('test.m06.run')))->'result'->>'state','awaiting_callbacks','registration close waits for every registered batch');
select extensions.is(pg_temp.m06_call('settle',current_setting('test.m06.settle')::jsonb)->'result'->>'updated','false','same content/cost settlement replays without new effects');
select extensions.throws_ok($$select pg_temp.m06_call('settle',jsonb_build_object('apify_run_id','LocalStoryB22','status','FAILED','dataset_id',null,'usage_usd',0.001,'observed_at',now(),
 'groups',jsonb_build_array(jsonb_build_object('account_id','22000000-0000-4000-8000-000000000012','status','success','error',null,'items','[]'::jsonb,'bakeoff_rows','[]'::jsonb,'observation','no_stories','source_evidence',true))))$$,'22023',null,'provider failure cannot become no-stories success');
select pg_temp.m06_call('settle',jsonb_build_object('apify_run_id','LocalStoryB22','status','SUCCEEDED','dataset_id','LocalEmpty22','usage_usd',0.001,'observed_at',now(),
 'groups',jsonb_build_array(jsonb_build_object('account_id','22000000-0000-4000-8000-000000000012','status','success','error',null,'items','[]'::jsonb,'bakeoff_rows','[]'::jsonb,'observation','no_stories','source_evidence',true))));
reset role;
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m06.run')::uuid),'success','parent finishes only after all callbacks and registration closure');
select extensions.is((select count(*)::int from app.items where external_id='22001001'),1,'replay creates no duplicate story');
select extensions.is((select count(*)::int from ops.bakeoff_observations where status='no_stories' and apify_run_id='LocalStoryB22'),1,'explicit empty observation is retained separately from failure');
select extensions.is((select sum(cost_usd) from ops.cost_ledger)-current_setting('test.m06.cost_before')::numeric,0.013345::numeric,'actual actor cost is recorded once with no replay charge');
select extensions.ok((select bool_and(locked_until is null and last_success_at is not null and backfill_status='not_applicable') from app.competitor_accounts where id in ('22000000-0000-4000-8000-000000000011','22000000-0000-4000-8000-000000000012')),'owned claims settle without fabricating historical completeness');

-- An independent comparison can run after primary capture, with next_due in
-- the future. It must never advance primary health, watermark or cadence.
select set_config('test.m06.health',(select jsonb_agg(to_jsonb(a)-'locked_until'-'last_run_id'-'updated_at' order by id)::text from app.competitor_accounts a where id in('22000000-0000-4000-8000-000000000011','22000000-0000-4000-8000-000000000012')),true);
set local role n8n_writer;
select set_config('test.m06.compare',(pg_temp.m06_call('start','{"workflow":"WF-12","platform":"instagram_stories","mode":"daily","env":"dev","execution_id":"23","collection_mode":"bakeoff"}')->'result'->>'run_id'),true);
select pg_temp.m06_call('claim',jsonb_build_object('run_id',current_setting('test.m06.compare'),'platform','instagram_stories','mode','daily','limit',2,'account_ids','["22000000-0000-4000-8000-000000000011","22000000-0000-4000-8000-000000000012"]'::jsonb));
select pg_temp.m06_call('launch',pg_temp.m06_launch(current_setting('test.m06.compare')::uuid,'22000000-0000-4000-8000-000000000033','["22000000-0000-4000-8000-000000000011","22000000-0000-4000-8000-000000000012"]','["m06storiesa","m06storiesb"]','bakeoff','igview-owner/instagram-story-viewer'));
select pg_temp.m06_call('register',pg_temp.m06_register(current_setting('test.m06.compare')::uuid,'22000000-0000-4000-8000-000000000033','LocalCompare22','["22000000-0000-4000-8000-000000000011","22000000-0000-4000-8000-000000000012"]','igview-owner/instagram-story-viewer'));
select pg_temp.m06_call('close_registration',jsonb_build_object('run_id',current_setting('test.m06.compare')));
select pg_temp.m06_call('settle',jsonb_build_object('apify_run_id','LocalCompare22','status','SUCCEEDED','dataset_id','LocalCompareData22','usage_usd',0.002,'observed_at',now(),
 'groups',jsonb_build_array(jsonb_build_object('account_id','22000000-0000-4000-8000-000000000011','status','success','error',null,'items','[]'::jsonb,'bakeoff_rows','[]'::jsonb,'observation','no_stories','source_evidence',true),
 jsonb_build_object('account_id','22000000-0000-4000-8000-000000000012','status','failed','error','story_source_error','items','[]'::jsonb,'bakeoff_rows','[]'::jsonb,'observation','error','source_evidence',false))));
reset role;
select extensions.is((select jsonb_agg(to_jsonb(a)-'locked_until'-'last_run_id'-'updated_at' order by id)::text from app.competitor_accounts a where id in('22000000-0000-4000-8000-000000000011','22000000-0000-4000-8000-000000000012')),current_setting('test.m06.health'),'comparison preserves primary health/watermark/due/cadence and item counts');
select extensions.ok((select bool_and(locked_until is null and last_run_id=current_setting('test.m06.run')::uuid) from app.competitor_accounts where id in('22000000-0000-4000-8000-000000000011','22000000-0000-4000-8000-000000000012')),'comparison releases only its own claims and restores prior run ownership');
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m06.compare')::uuid),'partial','a real per-account provider error remains a partial comparison');
select extensions.is((select count(*)::int from app.items where external_id='22001001'),1,'comparison never ingests another item');
select extensions.is((select count(*)::int from ops.bakeoff_observations where apify_run_id='LocalCompare22' and status='failed'),1,'failed source is not stored as no stories');

select pg_advisory_lock(73106,31);
set local role n8n_writer;
select set_config('test.m06.media_claim',ops.claim_story_media_batch('220001',5)::text,true);
select extensions.is(jsonb_array_length(current_setting('test.m06.media_claim')::jsonb->'messages'),1,'story media claim bypasses no generic backlog work');
select extensions.throws_ok($$select ops.ack_story_media_batch('220001',array[(current_setting('test.m06.media_claim')::jsonb->'messages'->0->>'msg_id')::bigint])$$,'42501',null,'story queue ACK requires durable safe outcome');
select ops.save_media_asset((current_setting('test.m06.media_claim')::jsonb->'messages'->0->'message'->>'item_id')::uuid,'thumbnail',
 'm06-stories-local/instagram_stories/22001001/thumb.jpg','https://images.example.com/m06-story.jpg',640,480);
select ops.record_story_media_outcome('220001',jsonb_build_object('item_id',current_setting('test.m06.media_claim')::jsonb->'messages'->0->'message'->>'item_id',
 'msg_ids',jsonb_build_array(current_setting('test.m06.media_claim')::jsonb->'messages'->0->>'msg_id'),'outcome','stored','code','thumbnail_saved','bytes',1000,'cost_usd',null));
select ops.ack_story_media_batch('220001',array[(current_setting('test.m06.media_claim')::jsonb->'messages'->0->>'msg_id')::bigint]);
select extensions.is(ops.finish_story_media_batch('220001')->>'state','completed','story lane settles through the accepted receipt/ACK contract');
select extensions.is(ops.claim_story_media_batch('220001',5)->>'replayed','true','completed story media execution replays without new queue work');
select extensions.throws_ok($$select ops.claim_media_batch('220001',5)$$,'23505',null,'an execution identity cannot be reused across media lanes');
reset role;
select extensions.is((select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q),current_setting('test.m06.media_backlog'),'story processing and rejected cross-lane replay leave the entire generic backlog unchanged');
select extensions.is((select count(*)::int from pgmq.q_media_stories),0,'only the dedicated story delivery was archived');
select extensions.is((select count(*)::int from pgmq.a_media_stories),1,'story queue retains its archived delivery');
select extensions.ok(pg_advisory_unlock(73106,31),'media lock released');
select * from extensions.finish();
rollback;
