begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select extensions.plan(40);

create temporary table ingest_results (label text primary key, result jsonb);
create function pg_temp.normalized_item(p_id text, p_caption text, p_published timestamptz,
  p_thumbnail text default null, p_metrics jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('platform', 'instagram', 'external_id', p_id, 'actor', 'test-fixture',
    'item_type', 'post', 'url', 'https://example.com/' || p_id, 'published_at', p_published,
    'caption', p_caption, 'thumbnail_url', p_thumbnail, 'metrics', p_metrics, 'payload', jsonb_build_object('id', p_id),
    'credits_text', 'Director: Fixture Person', 'media_urls', jsonb_build_array('https://vimeo.com/123'));
$$;
insert into app.competitors (id, company_code, slug, name, priority_tier)
values ('05000000-0000-4000-8000-000000000001', 'TEST05', 'ingest-contract-test', 'Ingest contract test', 'pilot');
select set_config('test.ingest_run', ops.start_run('M01-test05', 'instagram', 'daily', 'dev', 'test05')::text, true);
insert into app.competitor_accounts
  (id, competitor_id, platform, handle, url, backfill_status, last_run_id, locked_until)
values
  ('05000000-0000-4000-8000-000000000002', '05000000-0000-4000-8000-000000000001',
   'instagram', 'ingest-contract-test', 'https://example.com/ingest', 'done', current_setting('test.ingest_run')::uuid, now() + interval '2 hours'),
  ('05000000-0000-4000-8000-000000000003', '05000000-0000-4000-8000-000000000001',
   'instagram', 'ingest-empty-test', 'https://example.com/empty', 'done', current_setting('test.ingest_run')::uuid, now() + interval '2 hours');
select set_config('test.ai_queue_before', (select queue_length::text from pgmq.metrics('ai_extract')), true);
select set_config('test.media_queue_before', (select queue_length::text from pgmq.metrics('media')), true);
select set_config('test.ingest_batch', jsonb_build_array(
  pg_temp.normalized_item('test05-one', 'First caption', now() - interval '2 hours', 'https://example.com/one.jpg'),
  pg_temp.normalized_item('test05-two', 'Second caption', now() - interval '1 hour', 'https://example.com/two.jpg', '{"likes":1}'),
  pg_temp.normalized_item('test05-three', 'Third caption', now() - interval '3 hours', 'https://example.com/three.jpg'))::text, true);
insert into ingest_results values ('first', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', current_setting('test.ingest_batch')::jsonb));

select extensions.is((select (result->>'inserted')::int from ingest_results where label='first'), 3, 'three unique items are inserted');
select extensions.is((select jsonb_array_length(result->'new_item_ids') from ingest_results where label='first'), 3, 'all three new IDs are returned');
select extensions.is((select count(*)::int from ingest.raw_items where account_id='05000000-0000-4000-8000-000000000002'), 3, 'three immutable raw records exist');
select extensions.is((select count(*)::int from app.items where account_id='05000000-0000-4000-8000-000000000002'), 3, 'three clean shells exist');
select extensions.is((select queue_length from pgmq.metrics('ai_extract')), current_setting('test.ai_queue_before')::bigint + 3, 'new items enqueue AI once');
select extensions.is((select queue_length from pgmq.metrics('media')), current_setting('test.media_queue_before')::bigint + 3, 'new items enqueue media once');
select extensions.is((select normalized->>'credits_text' from ingest.raw_items where external_id='test05-one'), 'Director: Fixture Person', 'credits survive in normalized source');
select extensions.is((select normalized->'media_urls' from ingest.raw_items where external_id='test05-one'), '["https://vimeo.com/123"]'::jsonb, 'media links survive in normalized source');
select extensions.is((ops.get_items_for_ai(array(select id from app.items where external_id='test05-one'))#>>'{0,item,credits_text}'), 'Director: Fixture Person', 'AI context includes original credits');
select extensions.is((ops.get_items_for_ai(array(select id from app.items where external_id='test05-one'))#>'{0,item,media_urls}'), '["https://vimeo.com/123"]'::jsonb, 'AI context includes original media links');
select extensions.is((select last_item_published_at from app.competitor_accounts where id='05000000-0000-4000-8000-000000000002'), now() - interval '1 hour', 'watermark takes the newest date');
select extensions.is((select last_external_id from app.competitor_accounts where id='05000000-0000-4000-8000-000000000002'), 'test05-two', 'external watermark matches that date');

insert into ingest_results values ('repeat', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', current_setting('test.ingest_batch')::jsonb));
select extensions.is((select (result->>'inserted')::int from ingest_results where label='repeat'), 0, 'a replay inserts no new items');
select extensions.is((select count(*)::int from ingest.raw_items where account_id='05000000-0000-4000-8000-000000000002'), 3, 'replay preserves raw count');
select extensions.is((select queue_length from pgmq.metrics('ai_extract')), current_setting('test.ai_queue_before')::bigint + 3, 'replay adds no AI work');
select extensions.is((select queue_length from pgmq.metrics('media')), current_setting('test.media_queue_before')::bigint + 3, 'replay adds no media work');

insert into ingest_results values ('duplicate', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', jsonb_build_array(
  pg_temp.normalized_item('test05-four', 'First caption', now() - interval '30 minutes', 'https://example.com/one.jpg'))));
select extensions.is((select (result->>'duplicates')::int from ingest_results where label='duplicate'), 1, 'matching content is a duplicate');
select extensions.is((select (result->>'inserted')::int from ingest_results where label='duplicate'), 0, 'a content duplicate is not new AI work');
select extensions.ok((select ai_status='duplicate' and duplicate_of is not null from app.items where external_id='test05-four'), 'duplicate points at the canonical item');
select extensions.is((select queue_length from pgmq.metrics('ai_extract')), current_setting('test.ai_queue_before')::bigint + 3, 'content duplicate is not queued');
select extensions.is((select items_count from app.competitor_accounts where id='05000000-0000-4000-8000-000000000002'), 4, 'account count includes stored duplicate shells once');

insert into ingest_results values ('metrics', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', jsonb_build_array(pg_temp.normalized_item('test05-two', 'Changed source caption', now() - interval '1 hour', null, '{"likes":2}'))));
select extensions.is((select (result->>'metrics_updated')::int from ingest_results where label='metrics'), 1, 'recent known item gets a latest metric snapshot');
update app.items set published_at=now()-interval '31 days' where external_id='test05-three';
insert into ingest_results values ('old-metrics', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', jsonb_build_array(pg_temp.normalized_item('test05-three', 'Third caption', now()-interval '31 days', null, '{"likes":99}'))));
select extensions.is((select (result->>'metrics_updated')::int from ingest_results where label='old-metrics'), 0, 'items older than thirty days are not refreshed');
update app.items set caption_original='Human correction', locked_fields=array['caption_original','metrics'] where external_id='test05-two';
insert into ingest_results values ('locked', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', jsonb_build_array(pg_temp.normalized_item('test05-two', 'Source rewrite', now() - interval '1 hour', null, '{"likes":3}'))));
select extensions.is((select (result->>'metrics_updated')::int from ingest_results where label='locked'), 0, 'human-locked metrics are not refreshed');
select extensions.is((select caption_original from app.items where external_id='test05-two'), 'Human correction', 'human caption is preserved');
select extensions.is((select metrics from app.items where external_id='test05-two'), '{"likes":2}'::jsonb, 'human-locked metrics remain unchanged');

select ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid, '05000000-0000-4000-8000-000000000003', '[]');
select extensions.ok((select last_item_published_at is null and last_external_id is null from app.competitor_accounts where id='05000000-0000-4000-8000-000000000003'), 'empty batch preserves null watermarks');
select ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid, '05000000-0000-4000-8000-000000000002',
  jsonb_build_array(pg_temp.normalized_item('test05-null', 'Undated fixture', null)));
select extensions.is((select last_external_id from app.competitor_accounts where id='05000000-0000-4000-8000-000000000002'), 'test05-four', 'undated item does not corrupt a dated watermark');

insert into ingest_results values ('same-batch', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', jsonb_build_array(
  pg_temp.normalized_item('test05-batch-a', 'Same batch content', now(), 'https://example.com/batch.jpg'),
  pg_temp.normalized_item('test05-batch-b', 'Same batch content', now(), 'https://example.com/batch.jpg'))));
select extensions.is((select (result->>'inserted')::int from ingest_results where label='same-batch'), 1, 'same-batch matching content queues one canonical item');
select extensions.is((select (result->>'duplicates')::int from ingest_results where label='same-batch'), 1, 'same-batch matching sibling is a duplicate');
select extensions.is((select last_external_id from app.competitor_accounts where id='05000000-0000-4000-8000-000000000002'), 'test05-batch-b', 'tied publication times have a deterministic external watermark');
insert into ingest_results values ('same-key', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', jsonb_build_array(
  pg_temp.normalized_item('test05-same-key', 'Earlier input copy', now()),
  pg_temp.normalized_item('test05-same-key', 'Last input copy', now()))));
select extensions.is((select (result->>'inserted')::int from ingest_results where label='same-key'), 1, 'a repeated natural key within one batch is inserted once');
select extensions.is((select normalized->>'caption' from ingest.raw_items where external_id='test05-same-key'), 'Last input copy', 'the last repeated source key wins deterministically');
insert into ingest_results values ('no-fingerprint', ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', jsonb_build_array(
  pg_temp.normalized_item('test05-empty-a', null, now()) || '{"media_urls":[]}'::jsonb,
  pg_temp.normalized_item('test05-empty-b', null, now()) || '{"media_urls":[]}'::jsonb)));
select extensions.is((select (result->>'inserted')::int from ingest_results where label='no-fingerprint'), 2, 'missing text and media do not collapse unrelated items');

select extensions.throws_ok($$select ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', jsonb_build_array(pg_temp.normalized_item('test05-wrong-platform','Bad fixture',now()) || '{"platform":"vimeo"}'::jsonb))$$,
  '22023', null, 'normalized platform must belong to the claimed collection');
select extensions.throws_ok($$select ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000003', jsonb_build_array(pg_temp.normalized_item('test05-one','Other account',now())))$$,
  '22023', null, 'global item identity cannot be reassigned to a different account');
select set_config('test.employee_run',ops.start_run('M01-test05-employees','linkedin_employees','weekly','dev','employees')::text,true);
insert into app.competitor_accounts
 (id,competitor_id,platform,handle,url,backfill_status,last_run_id,locked_until)
values ('05000000-0000-4000-8000-000000000004','05000000-0000-4000-8000-000000000001',
 'linkedin_employees','ingest-employee-boundary','https://example.com/employees','done',current_setting('test.employee_run')::uuid,now()+interval '2 hours');
select extensions.throws_ok($$select ingest.upsert_raw_items(current_setting('test.employee_run')::uuid,
 '05000000-0000-4000-8000-000000000004',jsonb_build_array(pg_temp.normalized_item('test05-employee-item','Invalid item collection',now()) || '{"platform":"linkedin_employees"}'::jsonb))$$,
 '22023',null,'employee snapshots cannot enter the normalized item pipeline');
select set_config('test.other_run', ops.start_run('M01-test05-new-owner','instagram','daily','dev','new-owner')::text, true);
update app.competitor_accounts set last_run_id=current_setting('test.other_run')::uuid where id='05000000-0000-4000-8000-000000000002';
select extensions.throws_ok($$select ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000002', '[]')$$, '55000', null, 'stale run cannot ingest after a newer claim');
update app.competitor_accounts set locked_until=now()-interval '1 second' where id='05000000-0000-4000-8000-000000000003';
select extensions.throws_ok($$select ingest.upsert_raw_items(current_setting('test.ingest_run')::uuid,
  '05000000-0000-4000-8000-000000000003', '[]')$$, '55000', null, 'expired claim cannot ingest');
select extensions.is((select count(*)::int from ingest.raw_items where external_id='test05-wrong-platform'), 0, 'rejected input leaves no raw side effects');

select * from extensions.finish();
rollback;
