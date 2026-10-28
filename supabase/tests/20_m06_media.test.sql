begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();

-- The native local postgres is NOSUPERUSER with ADMIN but no SET membership.
-- Permit only this rollback fixture to assume the tested roles; application
-- grants and actual hosted restricted-login evidence are unchanged.
grant n8n_writer,api_agent to postgres with inherit false;
grant n8n_writer,api_agent to postgres with set true;

select extensions.ok(has_function_privilege('n8n_writer','ops.get_media_targets(uuid[])','EXECUTE'),'writer can read bounded media targets');
select extensions.ok(has_function_privilege('n8n_writer','ops.save_media_asset(uuid,text,text,text,integer,integer)','EXECUTE'),'writer can save a thumbnail receipt');
select extensions.ok(not has_function_privilege('api_agent','ops.save_media_asset(uuid,text,text,text,integer,integer)','EXECUTE')
  and not has_function_privilege('anon','ops.get_media_targets(uuid[])','EXECUTE')
  and not has_function_privilege('authenticated','ops.get_media_targets(uuid[])','EXECUTE'),'public and read-only roles cannot execute media RPCs');
select extensions.ok(not has_table_privilege('n8n_writer','app.media_assets','INSERT,UPDATE,DELETE'),'writer has no direct asset DML');
select extensions.ok((select relrowsecurity from pg_class where oid='app.media_assets'::regclass),'existing media assets keep RLS');
select extensions.ok((select count(*)=2 and bool_and(prosecdef and proconfig=array['search_path=""'])
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='ops' and p.proname in ('get_media_targets','save_media_asset')),'media definers pin an empty search path');

-- Synthetic local-only fixtures. No provider content or Storage object exists.
insert into app.competitors(id,company_code,slug,name,priority_tier)
values ('20000000-0000-4000-8000-000000000001','TESTM06','m06-local','M06 local synthetic','pilot'),
 ('20000000-0000-4000-8000-000000000002','TESTM06B','m06-other','M06 other synthetic','pilot');
insert into app.items(id,competitor_id,platform,item_type,external_id,url,thumbnail_source_url)
values ('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','vimeo','video','media01','https://vimeo.com/101','https://i.vimeocdn.com/video/local.jpg'),
 ('20000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000001','instagram_stories','story','media02','https://www.instagram.com/stories/m06local/102/','https://scontent.cdninstagram.com/local.jpg'),
 ('20000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000001','youtube','video','no-source','https://www.youtube.com/watch?v=no-source',null),
 ('20000000-0000-4000-8000-000000000014','20000000-0000-4000-8000-000000000001','linkedin','linkedin_post','locked','https://www.linkedin.com/posts/local','https://media.licdn.com/local.jpg'),
 ('20000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000001','news','news_article','unsupported','https://news.example.test/local','https://news.example.test/local.jpg'),
 ('20000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000002','vimeo','video','other','https://vimeo.com/106','https://i.vimeocdn.com/video/other.jpg'),
 ('20000000-0000-4000-8000-000000000018','20000000-0000-4000-8000-000000000001','vimeo','video','.','https://vimeo.com/unsafe-local','https://i.vimeocdn.com/video/local.jpg');
update app.items set locked_fields=array['thumbnail_path'],thumbnail_path='human/owned.jpg'
 where id='20000000-0000-4000-8000-000000000014';
insert into app.media_assets(item_id,competitor_id,kind,storage_path,source_url,width,height)
values ('20000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000002','thumbnail',
 'm06-local/instagram_stories/media02/thumb.jpg','https://i.vimeocdn.com/video/other.jpg',800,600);
select set_config('test.m06_items_before',(select count(*)::text from app.items),true);
select set_config('test.m06_raw_before',(select count(*)::text from ingest.raw_items),true);
select set_config('test.m06_ai_before',(select queue_length::text from pgmq.metrics('ai_extract')),true);
select set_config('test.m06_media_before',(select queue_length::text from pgmq.metrics('media')),true);
select set_config('test.m06_item_immutable',(select (to_jsonb(i)-'thumbnail_path'-'updated_at')::text from app.items i where id='20000000-0000-4000-8000-000000000011'),true);

select extensions.is(ops.get_media_targets('{}'::uuid[]),'[]'::jsonb,'empty target request returns no work');
select extensions.throws_ok($q$select ops.get_media_targets(null)$q$,'22023',null,'null target array is rejected');
select extensions.throws_ok($q$select ops.get_media_targets(array[null]::uuid[])$q$,'22023',null,'null target element is rejected');
select extensions.throws_ok($q$select ops.get_media_targets(array['20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000011']::uuid[])$q$,'22023',null,'duplicate target IDs are rejected');
select extensions.throws_ok($q$select ops.get_media_targets(array(select gen_random_uuid() from generate_series(1,51)))$q$,'22023',null,'target requests are bounded to fifty items');
select extensions.is(ops.get_media_targets(array['20000000-0000-4000-8000-000000009999']::uuid[]),'[]'::jsonb,'unknown item is not fabricated');
select extensions.is(ops.get_media_targets(array['20000000-0000-4000-8000-000000000015']::uuid[]),'[]'::jsonb,'unsupported source gets no upload target');
select extensions.is(ops.get_media_targets(array['20000000-0000-4000-8000-000000000018']::uuid[]),'[]'::jsonb,'URL-normalizing single-dot identity gets no upload target');
select extensions.is(ops.get_media_targets(array['20000000-0000-4000-8000-000000000012']::uuid[])->0->>'storage_path','m06-local/instagram_stories/media02/thumb.jpg','story path derives from stored owner and source identity');
select extensions.is(ops.get_media_targets(array['20000000-0000-4000-8000-000000000011']::uuid[])->0->>'thumbnail_source_url','https://i.vimeocdn.com/video/local.jpg','source comes from the stored item');
select extensions.is((ops.get_media_targets(array['20000000-0000-4000-8000-000000000014']::uuid[])->0->>'thumbnail_locked')::boolean,true,'human thumbnail lock is visible for a worker skip');
select extensions.is((ops.get_media_targets(array['20000000-0000-4000-8000-000000000013']::uuid[])->0->'thumbnail_source_url'),'null'::jsonb,'missing source remains null');

set local role n8n_writer;
select extensions.lives_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000011','thumbnail','m06-local/vimeo/media01/thumb.jpg','https://i.vimeocdn.com/video/local.jpg',1280,720)$q$,'restricted writer saves a valid thumbnail receipt');
select extensions.lives_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000011','thumbnail','m06-local/vimeo/media01/thumb.jpg','https://i.vimeocdn.com/video/local.jpg',1280,720)$q$,'exact same thumbnail receipt is idempotent');
select extensions.throws_ok($q$insert into app.media_assets(item_id,kind,storage_path) values('20000000-0000-4000-8000-000000000011','thumbnail','untrusted/path')$q$,'42501',null,'writer cannot bypass media RPC with table DML');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000014','thumbnail','m06-local/linkedin/locked/thumb.jpg','https://media.licdn.com/local.jpg',800,600)$q$,'42501',null,'writer cannot overwrite a human-locked thumbnail');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000011','key_frame','m06-local/vimeo/media01/frame-01.jpg','https://i.vimeocdn.com/video/local.jpg',800,600)$q$,'22023',null,'later key-frame access is not added to this slice');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000011','thumbnail','m06-other/vimeo/other/thumb.jpg','https://i.vimeocdn.com/video/local.jpg',800,600)$q$,'42501',null,'another owner path cannot be substituted');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000012','thumbnail','m06-local/instagram_stories/media02/thumb.jpg','https://scontent.cdninstagram.com/local.jpg',800,600)$q$,'55000',null,'a conflicting unique-path winner cannot be silently adopted');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000011','thumbnail','m06-local/vimeo/../thumb.jpg','https://i.vimeocdn.com/video/local.jpg',800,600)$q$,'22023',null,'path traversal is rejected');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000018','thumbnail','m06-local/vimeo/./thumb.jpg','https://i.vimeocdn.com/video/local.jpg',800,600)$q$,'22023',null,'single-dot path cannot be normalized into another storage object');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000011','thumbnail','m06-local/vimeo/media01/thumb.jpg','https://i.vimeocdn.com/video/changed.jpg',1280,720)$q$,'55000',null,'unconfirmed source change cannot rewrite a receipt');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000011','thumbnail','m06-local/vimeo/media01/thumb.jpg','https://i.vimeocdn.com/video/local.jpg',640,360)$q$,'55000',null,'conflicting dimensions do not silently overwrite prior receipt');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000012','thumbnail','m06-local/instagram_stories/media02/thumb.jpg','https://scontent.cdninstagram.com/local.jpg',1281,720)$q$,'22023',null,'resize width cap is enforced');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000013','thumbnail','m06-local/youtube/no-source/thumb.jpg',null,800,600)$q$,'22023',null,'a missing source cannot fabricate a stored asset');
reset role;
select extensions.is((select count(*)::int from app.media_assets where item_id='20000000-0000-4000-8000-000000000011'),1,'same item/path has one asset');
select extensions.is((select thumbnail_path from app.items where id='20000000-0000-4000-8000-000000000011'),'m06-local/vimeo/media01/thumb.jpg','thumbnail pointer follows the saved receipt');
select extensions.is((select (to_jsonb(i)-'thumbnail_path'-'updated_at') from app.items i where id='20000000-0000-4000-8000-000000000011'),current_setting('test.m06_item_immutable')::jsonb,'media save preserves content, AI, metrics and human fields');
select extensions.is((select thumbnail_path from app.items where id='20000000-0000-4000-8000-000000000014'),'human/owned.jpg','human thumbnail remains intact');
select extensions.is((select count(*)::text from app.items),current_setting('test.m06_items_before'),'media adds no collected item');
select extensions.is((select count(*)::text from ingest.raw_items),current_setting('test.m06_raw_before'),'media adds no raw collection');
select extensions.is((select queue_length::text from pgmq.metrics('ai_extract')),current_setting('test.m06_ai_before'),'media adds no AI queue work');
select extensions.is((select queue_length::text from pgmq.metrics('media')),current_setting('test.m06_media_before'),'save does not acknowledge or duplicate queue messages');
select extensions.is((ops.get_media_targets(array['20000000-0000-4000-8000-000000000011']::uuid[])->0->>'has_thumbnail')::boolean,true,'worker sees persisted thumbnail on retry');

set local role api_agent;
select extensions.throws_ok($q$select ops.get_media_targets('{}'::uuid[])$q$,'42501',null,'read-only agent cannot invoke media worker context');
select extensions.throws_ok($q$select ops.save_media_asset('20000000-0000-4000-8000-000000000011','thumbnail','m06-local/vimeo/media01/thumb.jpg','https://i.vimeocdn.com/video/local.jpg',1280,720)$q$,'42501',null,'read-only agent cannot mutate media');
reset role;
select * from extensions.finish();
rollback;
