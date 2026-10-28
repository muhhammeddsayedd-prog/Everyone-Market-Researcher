begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
grant n8n_writer to postgres with inherit false;
grant n8n_writer to postgres with set true;
select extensions.ok(has_function_privilege('n8n_writer','ops.collector_execute(uuid,text,jsonb)','execute'),'writer can execute fixed collector contracts');
select extensions.ok(not has_function_privilege('api_agent','ops.collector_execute(uuid,text,jsonb)','execute'),'agent cannot mutate collector contracts');
select extensions.ok(not has_function_privilege('authenticated','ops.collector_execute(uuid,text,jsonb)','execute'),'members cannot mutate collector contracts');
select extensions.ok(not has_function_privilege('anon','ops.collector_execute(uuid,text,jsonb)','execute'),'anonymous callers cannot mutate collectors');
select extensions.ok(not has_function_privilege('n8n_writer','ops.collector_finalize(uuid)','execute'),'internal finalizer is not a separate writer escape');
select extensions.is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='ops' and c.relname in ('collector_runs','collector_accounts','collector_passes','collector_launches','collector_pages','collector_requests') and c.relrowsecurity),6,'all six new product tables have RLS');
set local role n8n_writer;
select extensions.throws_ok($$select * from ops.collector_requests$$,'42501',null,'writer cannot read product tables directly');
select extensions.throws_ok($$insert into ops.collector_runs(run_id) values(gen_random_uuid())$$,'42501',null,'writer cannot write product tables directly');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'arbitrary_sql','{}')$$,'22023',null,'unknown operations are rejected');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-10","platform":"vimeo","env":"prod","mode":"daily","execution_id":"test16"}')$$,'42501',null,'production cannot be started');
reset role;

-- All TEST16 fixtures and product definitions are rolled back by the test.
insert into app.competitors(id,company_code,slug,name,priority_tier,status) values
 ('16000000-0000-4000-8000-000000000001','TEST16','m04-collector-contracts','M04 contracts','pilot','active');
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,next_due_at,backfill_status,last_item_published_at,last_external_id) values
 ('16000000-0000-4000-8000-000000000011','16000000-0000-4000-8000-000000000001','vimeo','test16-vimeo','https://vimeo.com/test16','2000-01-01','done','2026-10-01','v-old'),
 ('16000000-0000-4000-8000-000000000021','16000000-0000-4000-8000-000000000001','instagram','test16-a','https://www.instagram.com/test16-a/','2000-01-01','done','2026-10-01','ig-old'),
 ('16000000-0000-4000-8000-000000000022','16000000-0000-4000-8000-000000000001','instagram','test16-b','https://www.instagram.com/test16-b/','2000-01-01','done','2026-10-01','ig-old'),
 ('16000000-0000-4000-8000-000000000023','16000000-0000-4000-8000-000000000001','instagram','test16-c','https://www.instagram.com/test16-c/','2000-01-01','done','2026-10-01','ig-old'),
 ('16000000-0000-4000-8000-000000000024','16000000-0000-4000-8000-000000000001','instagram','test16-unselected','https://www.instagram.com/test16-unselected/','2000-01-01','done','2026-10-01','ig-old');

-- Session settings carry only synthetic UUIDs/public fixture data.
select set_config('test16.start_args','{"workflow":"WF-10","platform":"vimeo","env":"dev","mode":"daily","execution_id":"m04-local-vimeo"}',true);
set local role n8n_writer;
select set_config('test16.vimeo',ops.collector_execute('16000000-0000-4000-8000-000000000100','start',current_setting('test16.start_args')::jsonb)->'result'->>'run_id',true);
select extensions.is(ops.collector_execute('16000000-0000-4000-8000-000000000100','start',current_setting('test16.start_args')::jsonb)->>'replayed','true','lost start response returns the same durable run');
select extensions.throws_ok($$select ops.collector_execute('16000000-0000-4000-8000-000000000100','start',current_setting('test16.start_args')::jsonb||'{"execution_id":"different"}')$$,'55000',null,'request identity cannot change arguments');
select extensions.is(ops.collector_execute(gen_random_uuid(),'status','{"request_id":"16000000-0000-4000-8000-000000000100"}')->'result'->>'found','true','status recovers committed result without replaying side effects');
select extensions.is(jsonb_array_length(ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('test16.vimeo'),'platform','vimeo','mode','daily','limit',1,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000011')))->'result'),1,'exact Vimeo fixture claim returns one account');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'resolve','{"account_id":"16000000-0000-4000-8000-000000000011","external_id":"123456","uploads_playlist_id":null}')$$,'claimed Vimeo identifier resolves through the fixed operation');
select extensions.is(ops.collector_execute('16000000-0000-4000-8000-000000000101','ingest',jsonb_build_object('run_id',current_setting('test16.vimeo'),'account_id','16000000-0000-4000-8000-000000000011','items',jsonb_build_array(jsonb_build_object('platform','vimeo','actor','vimeo-api','external_id','test16-v1','item_type','video','url','https://vimeo.com/123456','published_at','2026-10-20T00:00:00Z','payload','{}'::jsonb))))->'result'->>'inserted','1','Vimeo normalized item reaches actual ingestion');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'report',jsonb_build_object('run_id',current_setting('test16.vimeo'),'account_id','16000000-0000-4000-8000-000000000011','status','success','items_seen',1,'items_new',1,'error',null,'backfill_done',false,'backfill_cursor',null))$$,'Vimeo uses the actual eight-argument reporting contract');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'cost',jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('provider','vimeo','category','scrape','quantity',2,'unit','call','cost_usd',0,'run_id',current_setting('test16.vimeo'),'competitor_id','16000000-0000-4000-8000-000000000001','platform','vimeo','meta',jsonb_build_object('account_id','16000000-0000-4000-8000-000000000011','cost_key','vimeo:'||current_setting('test16.vimeo')||':16000000-0000-4000-8000-000000000011')))))$$,'zero-dollar API request cost is recorded');
select extensions.is(ops.collector_execute(gen_random_uuid(),'finish',jsonb_build_object('run_id',current_setting('test16.vimeo'),'status','success','error',null))->'result'->>'items_new','1','complete Vimeo lifecycle finishes with one real local item');
reset role;
select extensions.is((select count(*)::int from ops.scrape_runs where n8n_execution_id='m04-local-vimeo'),1,'start replay made exactly one parent');

set local role n8n_writer;
select set_config('test16.ig',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"dev","mode":"daily","execution_id":"m04-local-instagram"}')->'result'->>'run_id',true);
select extensions.is(jsonb_array_length(ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('test16.ig'),'platform','instagram','mode','daily','limit',3,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000021','16000000-0000-4000-8000-000000000022','16000000-0000-4000-8000-000000000023')))->'result'),3,'one claim owns the exact three Instagram accounts');
reset role;
select extensions.ok((select locked_until is null and last_run_id is null from app.competitor_accounts where id='16000000-0000-4000-8000-000000000024'),'unselected due account is untouched');
select extensions.is((select count(*)::int from ops.collector_passes where run_id=current_setting('test16.ig')::uuid),6,'both posts and reels expected before any actor launches');

select set_config('test16.launchposts',jsonb_build_object('run_id',current_setting('test16.ig'),'actor_id','apify/instagram-scraper','pass','posts','account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000021','16000000-0000-4000-8000-000000000022'),'purpose','daily','launch_id','16000000-0000-4000-8000-000000000201','results_limit',5,'approval_id','16000000-0000-4000-8000-000000000999','max_actor_starts',4,'max_actor_usd',1,'max_total_usd',4)::text,true);
select set_config('test16.launchreels',(current_setting('test16.launchposts')::jsonb||'{"pass":"reels","launch_id":"16000000-0000-4000-8000-000000000202"}')::text,true);
set local role n8n_writer;
select extensions.is(ops.collector_execute('16000000-0000-4000-8000-000000000301','launch',current_setting('test16.launchposts')::jsonb)->'result'->>'permit','true','first launch owns a single actor POST permit');
select extensions.is(ops.collector_execute('16000000-0000-4000-8000-000000000301','launch',current_setting('test16.launchposts')::jsonb)->'result'->>'permit','false','same request never replays a paid POST permit');
select extensions.is(ops.collector_execute(gen_random_uuid(),'status','{"request_id":"16000000-0000-4000-8000-000000000301"}')->'result'->'result'->>'permit','false','status readback also cannot recreate a paid POST permit');
select extensions.is(ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.launchposts')::jsonb)->'result'->>'permit','false','new request cannot re-permit the same launch');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.launchposts')::jsonb||'{"launch_id":"16000000-0000-4000-8000-000000000299"}')$$,'55000',null,'another launch cannot take an already owned pass');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'close_registration',jsonb_build_object('run_id',current_setting('test16.ig')))$$,'55000',null,'unknown POST outcome blocks registration closure');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.launchposts')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-posts-ab"}')$$,'first multi-account actor registers');
select extensions.is(ops.collector_execute(gen_random_uuid(),'lookup','{"apify_run_id":"test16-posts-ab"}')->'result'->>'results_limit','5','trusted callback sees the exact saved collection limit');
select extensions.is(ops.collector_execute(gen_random_uuid(),'classify','{"apify_run_id":"test16-posts-ab"}')->'result'->>'scope','m04','WF19 can route only the owned registered collector');
select extensions.is(ops.collector_execute(gen_random_uuid(),'classify','{"apify_run_id":"not-registered"}')->'result'->>'scope','unknown','unknown callback is classified without provider access');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'lookup','{"apify_run_id":"not-registered"}')$$,'42501',null,'unknown callback cannot retrieve account context');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'settle','{"apify_run_id":"not-registered","status":"SUCCEEDED","dataset_id":"test16-dataset","usage_usd":0,"groups":[]}')$$,'42501',null,'unknown callback cannot ingest or charge costs');
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where run_id=current_setting('test16.ig')::uuid),0,'unknown callback left costs empty');

-- A real local normalized dataset page, two accounts and one item each.
select set_config('test16.groupsposts',jsonb_build_array(
 jsonb_build_object('account_id','16000000-0000-4000-8000-000000000021','normalizer_version','instagram-scraper.v1','status','success','backfill_done',false,'items',jsonb_build_array(jsonb_build_object('platform','instagram','actor','apify/instagram-scraper','external_id','test16-a-post','item_type','post','url','https://www.instagram.com/p/test16-a/','published_at','2026-10-20T00:00:00Z','payload','{}'::jsonb))),
 jsonb_build_object('account_id','16000000-0000-4000-8000-000000000022','normalizer_version','instagram-scraper.v1','status','success','backfill_done',false,'items',jsonb_build_array(jsonb_build_object('platform','instagram','actor','apify/instagram-scraper','external_id','test16-b-post','item_type','reel','url','https://www.instagram.com/p/test16-b/','published_at','2026-10-20T00:00:00Z','payload','{}'::jsonb))))::text,true);
select set_config('test16.stageposts',jsonb_build_object('apify_run_id','test16-posts-ab','offset',0,'raw_count',2,'has_more',false,'groups',(select jsonb_agg(e.value||'{"backfill_cursor":{"oldest_seen":"2026-10-20T00:00:00Z","full_waves":99}}') from jsonb_array_elements(current_setting('test16.groupsposts')::jsonb) e))::text,true);
select set_config('test16.finalposts',jsonb_build_object('apify_run_id','test16-posts-ab','status','SUCCEEDED','dataset_id','test16-dataset-posts','usage_usd',0.000005,'groups',(select jsonb_agg(e.value||'{"items":[]}') from jsonb_array_elements(current_setting('test16.groupsposts')::jsonb) e))::text,true);
set local role n8n_writer;
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'settle',current_setting('test16.finalposts')::jsonb)$$,'22023',null,'successful settlement requires actual end-of-dataset staging');
select extensions.is(ops.collector_execute('16000000-0000-4000-8000-000000000401','stage',current_setting('test16.stageposts')::jsonb)->'result'->>'items_new','2','staged normalized page inserts two local database items');
reset role;
select extensions.ok((select (backfill_cursor->>'oldest_seen')::timestamptz='2026-10-20T00:00:00Z'::timestamptz and not(backfill_cursor?'full_waves') from ops.collector_passes where run_id=current_setting('test16.ig')::uuid and account_id='16000000-0000-4000-8000-000000000021' and pass='posts'),'page checkpoint retains oldest source date without incrementing final wave count');
set local role n8n_writer;
select extensions.is(ops.collector_execute(gen_random_uuid(),'stage',current_setting('test16.stageposts')::jsonb)->'result'->>'items_new','2','same page returns its prior receipt without re-ingestion');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'stage',current_setting('test16.stageposts')::jsonb||'{"raw_count":3}')$$,'55000',null,'conflicting page receipt is rejected');
select extensions.is(ops.collector_execute(gen_random_uuid(),'settle',current_setting('test16.finalposts')::jsonb)->'result'->>'finished_now','false','posts callback cannot finish before reels or registration closure');
reset role;
select extensions.is((select count(*)::int from ops.scrape_run_accounts where run_id=current_setting('test16.ig')::uuid),0,'posts completion does not release a reels account claim');
select extensions.ok((select bool_and(locked_until>clock_timestamp()) from app.competitor_accounts where id in ('16000000-0000-4000-8000-000000000021','16000000-0000-4000-8000-000000000022')),'both primary claims remain live across the second pass');
select extensions.is((select sum(cost_usd)::text from ops.cost_ledger where meta->>'apify_run_id'='test16-posts-ab'),'0.000005','allocated per-account costs sum exactly to observed provider usage');
select extensions.is((select count(*)::int from app.items where account_id in ('16000000-0000-4000-8000-000000000021','16000000-0000-4000-8000-000000000022')),2,'dataset page replay did not add an item');
select extensions.is((select item_type::text from app.items where external_id='test16-b-post'),'reel','a posts actor batch can contain a normalized clips reel');

set local role n8n_writer;
select extensions.is(ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.launchreels')::jsonb)->'result'->>'permit','true','reels receives its own pass launch authority');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.launchreels')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-reels-ab"}')$$,'reels batch registers under the same parent');
reset role;
select set_config('test16.groupsreels',(select jsonb_agg(e.value||jsonb_build_object('items',jsonb_build_array((e.value->'items'->0)||jsonb_build_object('external_id',(e.value->'items'->0->>'external_id')||'-reel','item_type','carousel','published_at','2026-10-25T00:00:00Z')))) from jsonb_array_elements(current_setting('test16.groupsposts')::jsonb) e)::text,true);
set local role n8n_writer;
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','test16-reels-ab','offset',0,'raw_count',2,'has_more',false,'groups',current_setting('test16.groupsreels')::jsonb))$$,'secondary reels items are ingested while the primary lease is held');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'settle',current_setting('test16.finalposts')::jsonb||'{"apify_run_id":"test16-reels-ab","dataset_id":"test16-dataset-reels"}')$$,'reels settles its own pass without releasing a third account');
reset role;
select extensions.is((select last_item_published_at::text from app.competitor_accounts where id='16000000-0000-4000-8000-000000000021'),'2026-10-20 00:00:00+00','secondary reels do not advance the primary watermark');
select extensions.is((select item_type::text from app.items where external_id='test16-a-post-reel'),'carousel','secondary actor output preserves a normalized carousel classification');
select extensions.is((select count(*)::int from ops.scrape_run_accounts where run_id=current_setting('test16.ig')::uuid),2,'both settled passes produce exactly one report per account');
select extensions.is((select status from ops.scrape_runs where id=current_setting('test16.ig')::uuid),'running','parent remains running while later account chunks are unregistered');
set local role n8n_writer;
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'close_registration',jsonb_build_object('run_id',current_setting('test16.ig')))$$,'55000',null,'later unregistered account chunks keep the barrier open');
reset role;

-- The next independent account batch can register after the first batch has
-- already completed. Two failed actors still carry their real measured costs.
do $$ declare p text; l uuid; a jsonb; g jsonb; begin
  foreach p in array array['posts','reels'] loop
    l:=case when p='posts' then '16000000-0000-4000-8000-000000000203'::uuid else '16000000-0000-4000-8000-000000000204'::uuid end;
    a:=current_setting('test16.launchposts')::jsonb||jsonb_build_object('pass',p,'launch_id',l,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000023'));
    perform ops.collector_execute(gen_random_uuid(),'launch',a);
    perform ops.collector_execute(gen_random_uuid(),'register',(a-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||jsonb_build_object('apify_run_id','test16-'||p||'-c'));
    g:=jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000023','normalizer_version','instagram-scraper.v1','status','failed','error','apify_failed','backfill_done',false,'items','[]'::jsonb));
    perform ops.collector_execute(gen_random_uuid(),'settle',jsonb_build_object('apify_run_id','test16-'||p||'-c','status','FAILED','dataset_id',null,'usage_usd',0.01,'groups',g));
  end loop;
end $$;
select extensions.is((select count(*)::int from ops.apify_runs where run_id=current_setting('test16.ig')::uuid),4,'four actor batches share the same parent without changing M03 registry limits');
select extensions.is((select status from ops.scrape_runs where id=current_setting('test16.ig')::uuid),'running','all callbacks completed but parent still awaits registration closure');
set local role n8n_writer;
select extensions.is(ops.collector_execute(gen_random_uuid(),'close_registration',jsonb_build_object('run_id',current_setting('test16.ig')))->'result'->'summary'->>'status','partial','closing the barrier finishes the aggregate partial run');
select extensions.is(ops.collector_execute(gen_random_uuid(),'settle',current_setting('test16.finalposts')::jsonb)->'result'->>'updated','false','valid callback replay recovers its terminal receipt');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'settle',current_setting('test16.finalposts')::jsonb||'{"usage_usd":1}')$$,'55000',null,'changed callback usage cannot rewrite cost');
reset role;
select extensions.is((select items_new from ops.scrape_runs where id=current_setting('test16.ig')::uuid),4,'parent counts aggregate all four inserted posts and reels once');
select extensions.is((select cost_usd::text from ops.scrape_runs where id=current_setting('test16.ig')::uuid),'0.020010','parent cost includes measured successful and failed actor usage once');
select extensions.is((select count(*)::int from ops.cost_ledger where run_id=current_setting('test16.ig')::uuid),6,'replayed callback did not create another cost allocation');
select extensions.ok((select bool_and(locked_until is null) from app.competitor_accounts where id in ('16000000-0000-4000-8000-000000000021','16000000-0000-4000-8000-000000000022','16000000-0000-4000-8000-000000000023')),'every terminal account was released exactly once');
select extensions.ok((select consecutive_failures=1 and status<>'invalid' from app.competitor_accounts where id='16000000-0000-4000-8000-000000000023'),'two generic pass failures count once and do not invalidate a public profile');

-- A replay must preserve a subsequently acquired account lease.
update app.competitor_accounts set last_run_id=current_setting('test16.vimeo')::uuid,locked_until=clock_timestamp()+interval '1 hour' where id='16000000-0000-4000-8000-000000000021';
set local role n8n_writer;
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'settle',current_setting('test16.finalposts')::jsonb)$$,'terminal callback replay does not need or steal a new live claim');
reset role;
select extensions.ok((select last_run_id=current_setting('test16.vimeo')::uuid and locked_until>clock_timestamp() from app.competitor_accounts where id='16000000-0000-4000-8000-000000000021'),'callback replay left newer account ownership unchanged');

set local role n8n_writer;
select set_config('test16.extra',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"dev","mode":"daily","execution_id":"m04-local-extra"}')->'result'->>'run_id',true);
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('test16.extra'),'platform','instagram','mode','daily','limit',1,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000024')))$$,'a later parent can claim the previously unselected fixture');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.launchposts')::jsonb||jsonb_build_object('run_id',current_setting('test16.extra'),'launch_id','16000000-0000-4000-8000-000000000205','account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000024')))$$,'54000',null,'approved actor count remains cumulative across distinct parents');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.launchposts')::jsonb||jsonb_build_object('run_id',current_setting('test16.extra'),'launch_id','16000000-0000-4000-8000-000000000205','account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000024'),'max_actor_starts',5))$$,'55000',null,'an existing approval cannot silently increase its allocation');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'finish',jsonb_build_object('run_id',current_setting('test16.extra'),'status','failed','error','unfinished'))$$,'55000',null,'shutdown cannot falsely finish an unsettled account');
reset role;

-- A malformed page must leave ingestion, checkpoints and successful-request
-- receipts unchanged; an expired claim must fail closed before ingestion.
select set_config('test16.extra_launch',(current_setting('test16.launchposts')::jsonb||jsonb_build_object('run_id',current_setting('test16.extra'),'launch_id','16000000-0000-4000-8000-000000000205','account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000024'),'approval_id','16000000-0000-4000-8000-000000000998'))::text,true);
set local role n8n_writer;
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.extra_launch')::jsonb)$$,'a different synthetic approval has its own unchanged counter');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.extra_launch')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-extra"}')$$,'extra owned fixture actor is registered');
select extensions.throws_ok($$select ops.collector_execute('16000000-0000-4000-8000-000000000402','stage',jsonb_build_object('apify_run_id','test16-extra','offset',1,'raw_count',1,'has_more',false,'groups',jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000024','normalizer_version','instagram-scraper.v1','status','success','backfill_done',false,'items','[]'::jsonb))))$$,'55000',null,'out-of-order dataset offset cannot skip source content');
select extensions.throws_ok($$select ops.collector_execute('16000000-0000-4000-8000-000000000403','stage',jsonb_build_object('apify_run_id','test16-extra','offset',0,'raw_count',1,'has_more',false,'groups',jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000024','normalizer_version','instagram-scraper.v1','status','success','backfill_done',false,'items',jsonb_build_array(jsonb_build_object('platform','instagram','actor','apify/instagram-scraper','external_id','test16-malformed','item_type','post','url','bad-url','published_at',null,'payload','{}'::jsonb))))))$$,'22023',null,'invalid normalized content is rejected by the actual ingest boundary');
reset role;
select extensions.is((select next_offset from ops.collector_launches where apify_run_id='test16-extra'),0,'invalid page did not advance the dataset checkpoint');
select extensions.is((select count(*)::int from ops.collector_requests where request_id in ('16000000-0000-4000-8000-000000000402','16000000-0000-4000-8000-000000000403')),0,'failed page operations left no successful durable receipt');
select extensions.is((select count(*)::int from app.items where external_id='test16-malformed'),0,'invalid page left no item or partial data');
update app.competitor_accounts set locked_until=clock_timestamp()-interval '1 second' where id='16000000-0000-4000-8000-000000000024';
set local role n8n_writer;
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','test16-extra','offset',0,'raw_count',0,'has_more',false,'groups',jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000024','normalizer_version','instagram-scraper.v1','status','success','backfill_done',false,'items','[]'::jsonb))))$$,'55000',null,'an expired account claim cannot ingest or settle from a late page');
reset role;
update app.competitor_accounts set consecutive_failures=2,locked_until=clock_timestamp()+interval '1 hour' where id='16000000-0000-4000-8000-000000000024';
set local role n8n_writer;
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','test16-extra','offset',0,'raw_count',1,'has_more',false,'groups',jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000024','normalizer_version','instagram-scraper.v1','status','failed','error','ig_source_error','backfill_done',false,'items','[]'::jsonb))))$$,'a source error can be staged without releasing another pass');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'settle',jsonb_build_object('apify_run_id','test16-extra','status','SUCCEEDED','dataset_id','test16-private-data','usage_usd',0.01,'groups',jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000024','normalizer_version','instagram-scraper.v1','status','failed','error','ig_private_or_login','backfill_done',false,'items','[]'::jsonb))))$$,'private/login error overrides an earlier generic staged error');
reset role;
select extensions.ok((select consecutive_failures=2 and status<>'invalid' and locked_until>clock_timestamp() from app.competitor_accounts where id='16000000-0000-4000-8000-000000000024'),'private posts outcome waits for reels before the single failure increment');
select set_config('test16.extra_reels',(current_setting('test16.extra_launch')::jsonb||'{"pass":"reels","launch_id":"16000000-0000-4000-8000-000000000206"}')::text,true);
set local role n8n_writer;
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.extra_reels')::jsonb)$$,'private posts result has not stolen the reels pass claim');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.extra_reels')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-extra-reels"}')$$,'second pass registers before aggregate invalidation');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'settle',jsonb_build_object('apify_run_id','test16-extra-reels','status','FAILED','dataset_id',null,'usage_usd',0,'groups',jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000024','normalizer_version','instagram-scraper.v1','status','failed','error','ig_source_error','backfill_done',false,'items','[]'::jsonb))))$$,'both terminal passes produce the third combined account failure');
reset role;
select extensions.ok((select consecutive_failures=3 and status='invalid' and locked_until is null and last_error like '%ig_private_or_login%' from app.competitor_accounts where id='16000000-0000-4000-8000-000000000024'),'third private/login run becomes invalid with no login bypass or doubled failure count');

insert into app.competitor_accounts(id,competitor_id,platform,handle,url,next_due_at,backfill_status) values
 ('16000000-0000-4000-8000-000000000025','16000000-0000-4000-8000-000000000001','instagram','test16-paging','https://www.instagram.com/test16-paging/','2000-01-01','pending');
set local role n8n_writer;
select set_config('test16.pagedrun',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"dev","mode":"backfill","execution_id":"m04-local-paging"}')->'result'->>'run_id',true);
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('test16.pagedrun'),'platform','instagram','mode','backfill','limit',1,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000025')))$$,'paging fixture is claimed in backfill mode');
reset role;
select set_config('test16.pagedlaunch',(current_setting('test16.extra_launch')::jsonb||jsonb_build_object('run_id',current_setting('test16.pagedrun'),'launch_id','16000000-0000-4000-8000-000000000207','account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000025'),'approval_id','16000000-0000-4000-8000-000000000997','purpose','backfill','results_limit',1000))::text,true);
select set_config('test16.pagedgroup','[{"account_id":"16000000-0000-4000-8000-000000000025","normalizer_version":"instagram-scraper.v1","status":"success","backfill_done":false,"source_evidence":true,"items":[],"backfill_cursor":{"oldest_seen":"2026-10-20T00:00:00Z","full_waves":99}}]',true);
set local role n8n_writer;
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.pagedlaunch')::jsonb)$$,'bounded backfill actor gets one launch intent');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.pagedlaunch')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-paging"}')$$,'paging actor metadata is registered');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','test16-paging','offset',0,'raw_count',500,'has_more',true,'groups',jsonb_build_array((current_setting('test16.pagedgroup')::jsonb->0)||'{"source_evidence":"true"}')))$$,'22023',null,'source evidence must be an actual private boolean');
select extensions.is(ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','test16-paging','offset',0,'raw_count',500,'has_more',true,'groups',current_setting('test16.pagedgroup')::jsonb))->'result'->>'next_offset','500','full dataset page advances exactly one checkpoint');
select extensions.is(ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','test16-paging','offset',0,'raw_count',500,'has_more',true,'groups',current_setting('test16.pagedgroup')::jsonb))->'result'->>'next_offset','500','empty matched-source page replay preserves its checkpoint without collecting data');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','test16-paging','offset',600,'raw_count',0,'has_more',false,'groups',current_setting('test16.pagedgroup')::jsonb))$$,'55000',null,'later page cannot skip an unfinished source offset');
select extensions.is(ops.collector_execute(gen_random_uuid(),'stage',jsonb_build_object('apify_run_id','test16-paging','offset',500,'raw_count',1,'has_more',false,'groups',jsonb_build_array((current_setting('test16.pagedgroup')::jsonb->0)||'{"source_evidence":false,"backfill_cursor":{"oldest_seen":"2024-01-01T00:00:00Z","full_waves":100}}')))->'result'->>'dataset_complete','true','short final page establishes the staged end of dataset');
reset role;
select extensions.ok((select (backfill_cursor->>'oldest_seen')::timestamptz='2024-01-01T00:00:00Z'::timestamptz and not(backfill_cursor?'full_waves') from ops.collector_passes where run_id=current_setting('test16.pagedrun')::uuid and pass='posts'),'resumed page keeps the minimum observed source date and no page-based wave increments');
select extensions.ok((select source_evidence and items_seen=0 and items_new=0 from ops.collector_passes where run_id=current_setting('test16.pagedrun')::uuid and pass='posts'),'matched source evidence survives later empty pages while retaining zero collected items');
select extensions.is((select count(*)::int from ops.scrape_run_accounts where run_id=current_setting('test16.pagedrun')::uuid),0,'dataset pages alone cannot release either account pass');
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,next_due_at,backfill_status) values
 ('16000000-0000-4000-8000-000000000026','16000000-0000-4000-8000-000000000001','vimeo','test16-no-goat-backfill','https://vimeo.com/test16-backfill','2000-01-01','pending');
set local role n8n_writer;
select set_config('test16.vimeobackfill',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-10","platform":"vimeo","env":"dev","mode":"backfill","execution_id":"m04-local-vimeo-backfill"}')->'result'->>'run_id',true);
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('test16.vimeobackfill'),'platform','vimeo','mode','backfill','limit',1,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000026')))$$,'Vimeo backfill fixture uses an owned exact claim');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.pagedlaunch')::jsonb||jsonb_build_object('run_id',current_setting('test16.vimeobackfill'),'launch_id','16000000-0000-4000-8000-000000000208','actor_id','goat255/vimeo-scraper','pass','primary','account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000026')))$$,'42501',null,'latest-only goat255 cannot be used as Vimeo history backfill');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.pagedlaunch')::jsonb||jsonb_build_object('run_id',current_setting('test16.vimeobackfill'),'launch_id','16000000-0000-4000-8000-000000000208','actor_id','dltik/vimeo-scraper','pass','primary','results_limit',1001,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000026')))$$,'22023',null,'dltik backfill rejects more than1000 requested results');
select extensions.is(ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.pagedlaunch')::jsonb||jsonb_build_object('run_id',current_setting('test16.vimeobackfill'),'launch_id','16000000-0000-4000-8000-000000000208','actor_id','dltik/vimeo-scraper','pass','primary','results_limit',1000,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000026')))->'result'->>'permit','true','one claimed dltik backfill source permits its1000-result bound');
reset role;

insert into app.competitor_accounts(id,competitor_id,platform,handle,url,next_due_at,backfill_status) values
 ('16000000-0000-4000-8000-000000000027','16000000-0000-4000-8000-000000000001','vimeo','test16-goat-daily','https://vimeo.com/test16-goat','2000-01-01','done'),
 ('16000000-0000-4000-8000-000000000028','16000000-0000-4000-8000-000000000001','vimeo','test16-dltik-daily','https://vimeo.com/test16-dltik','2000-01-01','done');
set local role n8n_writer;
select set_config('test16.vimeodaily',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-10","platform":"vimeo","env":"dev","mode":"daily","execution_id":"m04-local-vimeo-actor-bounds"}')->'result'->>'run_id',true);
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('test16.vimeodaily'),'platform','vimeo','mode','daily','limit',2,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000027','16000000-0000-4000-8000-000000000028')))$$,'Vimeo daily bounds use only their two owned fixture accounts');
reset role;
select set_config('test16.dailygoat',(current_setting('test16.launchposts')::jsonb||jsonb_build_object('run_id',current_setting('test16.vimeodaily'),'launch_id','16000000-0000-4000-8000-000000000209','actor_id','goat255/vimeo-scraper','pass','primary','results_limit',60,'account_ids',jsonb_build_array('16000000-0000-4000-8000-000000000027'),'approval_id','16000000-0000-4000-8000-000000000996'))::text,true);
select set_config('test16.dailydltik',(current_setting('test16.dailygoat')::jsonb||'{"launch_id":"16000000-0000-4000-8000-000000000210","actor_id":"dltik/vimeo-scraper","results_limit":50,"account_ids":["16000000-0000-4000-8000-000000000028"]}')::text,true);
set local role n8n_writer;
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.dailygoat')::jsonb||'{"results_limit":61}')$$,'22023',null,'goat daily rejects more than60 results');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.dailygoat')::jsonb||'{"account_ids":["16000000-0000-4000-8000-000000000027","16000000-0000-4000-8000-000000000028"]}')$$,'42501',null,'goat launch cannot combine multiple account sources');
select extensions.is(ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.dailygoat')::jsonb)->'result'->>'permit','true','one goat daily source permits its60-result bound');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.dailygoat')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"account_ids":["16000000-0000-4000-8000-000000000027","16000000-0000-4000-8000-000000000028"],"apify_run_id":"test16-goat-bounds"}')$$,'42501',null,'registration also rejects a multi-source goat batch');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.dailygoat')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-goat-bounds"}')$$,'single-source goat daily registration matches the intent');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.dailydltik')::jsonb||'{"results_limit":51}')$$,'22023',null,'dltik daily rejects more than50 results');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.dailydltik')::jsonb||'{"account_ids":["16000000-0000-4000-8000-000000000027","16000000-0000-4000-8000-000000000028"]}')$$,'42501',null,'dltik also requires exactly one account source');
select extensions.is(ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.dailydltik')::jsonb)->'result'->>'permit','true','one dltik daily source permits its50-result bound');
reset role;

-- Instagram backfill permits ten sources and3000 results per source. Eleven
-- claimed sources remain a valid parent claim, but cannot form one actor batch.
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,next_due_at,backfill_status)
select ('16000000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid,'16000000-0000-4000-8000-000000000001',
  'instagram','test16-bound-'||x,'https://www.instagram.com/test16-bound-'||x||'/','2000-01-01','pending'
  from generate_series(31,41) x;
select set_config('test16.ig_bound_ids',(select jsonb_agg(('16000000-0000-4000-8000-'||lpad(x::text,12,'0')))::text from generate_series(31,41) x),true);
set local role n8n_writer;
select set_config('test16.ig_bound_run',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"dev","mode":"backfill","execution_id":"m04-local-ig-actor-bounds"}')->'result'->>'run_id',true);
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('test16.ig_bound_run'),'platform','instagram','mode','backfill','limit',11,'account_ids',current_setting('test16.ig_bound_ids')::jsonb))$$,'a parent can own more accounts than one bounded backfill actor batch');
reset role;
select set_config('test16.ig_bound_launch',(current_setting('test16.pagedlaunch')::jsonb||jsonb_build_object('run_id',current_setting('test16.ig_bound_run'),'launch_id','16000000-0000-4000-8000-000000000211','results_limit',3000,'account_ids',current_setting('test16.ig_bound_ids')::jsonb,'approval_id','16000000-0000-4000-8000-000000000995'))::text,true);
set local role n8n_writer;
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.ig_bound_launch')::jsonb)$$,'42501',null,'Instagram backfill rejects eleven sources in one actor batch');
reset role;
select set_config('test16.ig_bound_launch',(current_setting('test16.ig_bound_launch')::jsonb||jsonb_build_object('account_ids',(current_setting('test16.ig_bound_ids')::jsonb)-10))::text,true);
set local role n8n_writer;
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.ig_bound_launch')::jsonb||'{"results_limit":3001}')$$,'22023',null,'Instagram backfill rejects more than3000 results per source');
select extensions.is(ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.ig_bound_launch')::jsonb)->'result'->>'permit','true','ten Instagram backfill sources accept3000 results per source');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.ig_bound_launch')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||jsonb_build_object('account_ids',current_setting('test16.ig_bound_ids')::jsonb,'apify_run_id','test16-ig-backfill-bound'))$$,'42501',null,'registration also enforces the ten-source Instagram backfill limit');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.ig_bound_launch')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-ig-backfill-bound"}')$$,'ten-source backfill registration retains the approved intent');
reset role;

select set_config('test16.privatefirstposts',(current_setting('test16.ig_bound_launch')::jsonb||'{"launch_id":"16000000-0000-4000-8000-000000000212","account_ids":["16000000-0000-4000-8000-000000000041"]}')::text,true);
select set_config('test16.privatefirstreels',(current_setting('test16.privatefirstposts')::jsonb||'{"launch_id":"16000000-0000-4000-8000-000000000213","pass":"reels"}')::text,true);
set local role n8n_writer;
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.privatefirstposts')::jsonb)$$,'unregistered account chunk can launch its exact owned posts pass');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.privatefirstposts')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-private-first-posts"}')$$,'private-source fixture registers its posts result');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'settle',jsonb_build_object('apify_run_id','test16-private-first-posts','status','FAILED','dataset_id',null,'usage_usd',0,'groups',jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000041','normalizer_version','instagram-scraper.v1','status','failed','error','ig_private_or_login','backfill_done',false,'items','[]'::jsonb))))$$,'first private/login pass records failure without another account report');
reset role;
select extensions.ok((select consecutive_failures=0 and status='active' and locked_until>clock_timestamp() from app.competitor_accounts where id='16000000-0000-4000-8000-000000000041'),'posts-only privacy result does not release the other owned pass');
set local role n8n_writer;
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.privatefirstreels')::jsonb)$$,'already-owned reels pass retains launch authority until settlement');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.privatefirstreels')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-private-first-reels"}')$$,'second owned pass registers without creating another primary claim');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'settle',jsonb_build_object('apify_run_id','test16-private-first-reels','status','FAILED','dataset_id',null,'usage_usd',0,'groups',jsonb_build_array(jsonb_build_object('account_id','16000000-0000-4000-8000-000000000041','normalizer_version','instagram-scraper.v1','status','failed','error','ig_source_error','backfill_done',false,'items','[]'::jsonb))))$$,'second pass completes the single private account outcome');
reset role;
select extensions.ok((select consecutive_failures=1 and status='invalid' and locked_until is null and last_error like '%ig_private_or_login%' from app.competitor_accounts where id='16000000-0000-4000-8000-000000000041'),'first combined private/login failure disables the source immediately with one failure increment');
select extensions.is((select status from ops.scrape_runs where id=current_setting('test16.ig_bound_run')::uuid),'running','disabling a private source cannot finish another unfinished account batch');

insert into app.competitor_accounts(id,competitor_id,platform,handle,url,next_due_at,backfill_status)
select ('16000000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid,'16000000-0000-4000-8000-000000000001',
  'instagram','test16_daily_'||x,'https://www.instagram.com/test16_daily_'||x||'/','2000-01-01','done'
  from generate_series(101,151) x;
select set_config('test16.ig_daily_ids',(select jsonb_agg(('16000000-0000-4000-8000-'||lpad(x::text,12,'0')))::text from generate_series(101,151) x),true);
set local role n8n_writer;
select set_config('test16.ig_daily_run',ops.collector_execute(gen_random_uuid(),'start','{"workflow":"WF-11","platform":"instagram","env":"dev","mode":"daily","execution_id":"m04-local-ig-daily-bounds"}')->'result'->>'run_id',true);
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'claim',jsonb_build_object('run_id',current_setting('test16.ig_daily_run'),'platform','instagram','mode','daily','limit',51,'account_ids',current_setting('test16.ig_daily_ids')::jsonb))$$,'daily parent can own multiple future actor batches without overlapping claims');
reset role;
select set_config('test16.ig_daily_launch',(current_setting('test16.launchposts')::jsonb||jsonb_build_object('run_id',current_setting('test16.ig_daily_run'),'launch_id','16000000-0000-4000-8000-000000000214','results_limit',30,'account_ids',current_setting('test16.ig_daily_ids')::jsonb,'approval_id','16000000-0000-4000-8000-000000000994'))::text,true);
set local role n8n_writer;
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.ig_daily_launch')::jsonb)$$,'42501',null,'Instagram daily rejects51 sources in one actor batch');
reset role;
select set_config('test16.ig_daily_launch',(current_setting('test16.ig_daily_launch')::jsonb||jsonb_build_object('account_ids',(current_setting('test16.ig_daily_ids')::jsonb)-50))::text,true);
set local role n8n_writer;
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.ig_daily_launch')::jsonb||'{"results_limit":31}')$$,'22023',null,'Instagram daily rejects more than30 results per source');
select extensions.is(ops.collector_execute(gen_random_uuid(),'launch',current_setting('test16.ig_daily_launch')::jsonb)->'result'->>'permit','true','50 daily Instagram sources accept30 results per source');
select extensions.throws_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.ig_daily_launch')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||jsonb_build_object('account_ids',current_setting('test16.ig_daily_ids')::jsonb,'apify_run_id','test16-ig-daily-bound'))$$,'42501',null,'registration also rejects more than50 daily Instagram sources');
select extensions.lives_ok($$select ops.collector_execute(gen_random_uuid(),'register',(current_setting('test16.ig_daily_launch')::jsonb-array['results_limit','approval_id','max_actor_starts','max_actor_usd','max_total_usd'])||'{"apify_run_id":"test16-ig-daily-bound"}')$$,'50-source daily registration retains the exact approved intent');
reset role;
select * from extensions.finish();
rollback;
