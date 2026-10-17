begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
-- Test-only membership options; rollback restores the production role graph.
-- https://www.postgresql.org/docs/17/sql-grant.html
grant n8n_writer to postgres with inherit false;
grant n8n_writer to postgres with set true;
select extensions.plan(10);

insert into app.competitors (id, company_code, slug, name, priority_tier)
values ('04000000-0000-4000-8000-000000000001', 'TEST04', 'rpc-writer-test', 'RPC writer test', 'pilot');
insert into app.competitor_accounts (id, competitor_id, platform, handle, url, next_due_at, backfill_status)
values ('04000000-0000-4000-8000-000000000002', '04000000-0000-4000-8000-000000000001',
        'instagram', 'rpc-writer-test', 'https://example.com/writer', '-infinity', 'done');

select extensions.ok(has_function_privilege('n8n_writer', 'ops.start_run(text,app.platform,text,text,text)', 'execute'),
  'writer has only the intended executable pipeline entry point');
set local role n8n_writer;
select extensions.lives_ok($$select set_config('test.writer_run',
  ops.start_run('M01-test04', 'instagram'::app.platform, 'daily', 'dev', 'test04')::text, true)$$,
  'writer starts a run using a qualified enum cast');
select extensions.lives_ok($$select * from ops.get_due_accounts('instagram', 1,
  current_setting('test.writer_run')::uuid, 'daily')$$, 'writer claims the account through the RPC');
select extensions.throws_ok($$select * from app.items$$, '42501', null, 'writer cannot read clean tables directly');
select extensions.throws_ok($$select * from ingest.raw_items$$, '42501', null, 'writer cannot read raw tables directly');
select extensions.throws_ok($$insert into app.items (platform) values ('instagram')$$, '42501', null,
  'writer cannot insert directly into the clean table');
select extensions.lives_ok($$select ingest.upsert_raw_items(current_setting('test.writer_run')::uuid,
  '04000000-0000-4000-8000-000000000002', jsonb_build_array(jsonb_build_object(
    'platform', 'instagram', 'external_id', 'test04-item', 'actor', 'test-fixture', 'item_type', 'post',
    'url', 'https://example.com/test04-item', 'published_at', to_jsonb(now()), 'payload', '{}'::jsonb,
    'caption', 'Writer permission fixture')))$$, 'writer ingests only through the single writer RPC');
select extensions.lives_ok($$select ops.report_account_result(current_setting('test.writer_run')::uuid,
  '04000000-0000-4000-8000-000000000002', 'success', 1, 1)$$, 'writer reports its claimed result');
select extensions.is((ops.finish_run(current_setting('test.writer_run')::uuid, 'success')->>'items_new')::int,
  1, 'finish_run returns the summary to the writer without a table read');
reset role;
select extensions.is((select status from ops.scrape_runs where id = current_setting('test.writer_run')::uuid),
  'success', 'the completed writer run is stored');

select * from extensions.finish();
rollback;
