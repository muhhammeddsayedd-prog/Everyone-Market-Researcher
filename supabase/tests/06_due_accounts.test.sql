begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select extensions.plan(22);
create temporary table claimed_accounts (account_id uuid, competitor_id uuid, competitor_slug text, handle text,
  url text, external_id text, uploads_playlist_id text, watermark_published_at timestamptz,
  watermark_external_id text, backfill_from date, backfill_cursor jsonb,
  claim_order bigint generated always as identity);
insert into app.competitors (id, company_code, slug, name, priority_tier, status) values
 ('06000000-0000-4000-8000-000000000001','TEST06B','due-baseline','Due baseline','baseline','active'),
 ('06000000-0000-4000-8000-000000000002','TEST06P','due-pilot','Due pilot','pilot','active'),
 ('06000000-0000-4000-8000-000000000003','TEST06N','due-next','Due next','next_wave','active'),
 ('06000000-0000-4000-8000-000000000004','TEST06X','due-paused','Due paused','pilot','paused');
insert into app.competitor_accounts (id, competitor_id, platform, handle, url, next_due_at, backfill_status, status) values
 ('06000000-0000-4000-8000-000000000011','06000000-0000-4000-8000-000000000001','news','due-baseline','https://example.com/b','2000-01-01','done','active'),
 ('06000000-0000-4000-8000-000000000012','06000000-0000-4000-8000-000000000002','news','due-pilot','https://example.com/p','2000-01-01','done','active'),
 ('06000000-0000-4000-8000-000000000013','06000000-0000-4000-8000-000000000003','news','due-next','https://example.com/n','2000-01-01','done','active'),
 ('06000000-0000-4000-8000-000000000014','06000000-0000-4000-8000-000000000004','news','due-paused','https://example.com/x','2000-01-01','pending','active'),
 ('06000000-0000-4000-8000-000000000015','06000000-0000-4000-8000-000000000002','news','due-backfill','https://example.com/f','2000-01-01','pending','active'),
 ('06000000-0000-4000-8000-000000000016','06000000-0000-4000-8000-000000000002','news','due-future','https://example.com/future',now()+interval '1 day','done','active'),
 ('06000000-0000-4000-8000-000000000017','06000000-0000-4000-8000-000000000002','news','due-disabled','https://example.com/d','2000-01-01','done','disabled');
select set_config('test.due_run', ops.start_run('M01-test06','news','daily','dev','test06')::text,true);
insert into claimed_accounts select * from ops.get_due_accounts('news',10,current_setting('test.due_run')::uuid,'daily');
select extensions.is((select count(*)::int from claimed_accounts),3,'daily claims only the three eligible accounts');
select extensions.results_eq($$select competitor_slug from claimed_accounts order by claim_order$$,
  $$values ('due-baseline'::text),('due-pilot'),('due-next')$$,'due list preserves priority order');
select extensions.ok((select bool_and(a.locked_until>now()) from app.competitor_accounts a join claimed_accounts c on c.account_id=a.id),'every returned account has a lease');
select extensions.ok((select bool_and(a.last_run_id=current_setting('test.due_run')::uuid) from app.competitor_accounts a join claimed_accounts c on c.account_id=a.id),'claims record their owning run');
select extensions.is((select count(*)::int from ops.get_due_accounts('news',10,current_setting('test.due_run')::uuid,'daily')),0,'another claim cannot return the leased accounts');
select extensions.ok((select locked_until is null from app.competitor_accounts where handle='due-backfill'),'daily mode excludes unfinished backfill');
select extensions.ok((select locked_until is null from app.competitor_accounts where handle='due-future'),'daily mode excludes future due times');
select extensions.ok((select locked_until is null from app.competitor_accounts where handle='due-disabled'),'disabled accounts cannot be claimed');
select extensions.is((select count(*)::int from ops.get_due_accounts('news',10,current_setting('test.due_run')::uuid,'backfill')),1,'backfill mode claims eligible pending backfill');
select extensions.ok((select locked_until is null from app.competitor_accounts where handle='due-paused'),'paused competitors stay excluded even in backfill mode');
select extensions.throws_ok($$select * from ops.get_due_accounts('news',10,'06000000-0000-4000-8000-000000000099','daily')$$,'22023',null,'unknown run cannot claim');
select extensions.throws_ok($$select * from ops.get_due_accounts('vimeo',10,current_setting('test.due_run')::uuid,'daily')$$,'22023',null,'run platform must own the collection');
select extensions.throws_ok($$select * from ops.get_due_accounts('news',0,current_setting('test.due_run')::uuid,'daily')$$,'22023',null,'claim limit must be positive');
select ops.report_account_result(current_setting('test.due_run')::uuid,
 '06000000-0000-4000-8000-000000000015','failed',0,0,'backfill fixture failure');
select set_config('test.retry_run',ops.start_run('M01-test06-retry','news','backfill','dev','retry')::text,true);
select extensions.is((select count(*)::int from ops.get_due_accounts('news',10,current_setting('test.retry_run')::uuid,'backfill')),0,'failed backfill respects the six-hour retry delay');
-- Move only this owned fixture's retry timestamp past due; production time is not changed.
update app.competitor_accounts set next_due_at=now()-interval '1 second',locked_until=null
 where id='06000000-0000-4000-8000-000000000015';
select extensions.is((select count(*)::int from ops.get_due_accounts('news',10,current_setting('test.retry_run')::uuid,'backfill')),1,'failed backfill becomes eligible after the retry delay');
select ops.report_account_result(current_setting('test.retry_run')::uuid,
 '06000000-0000-4000-8000-000000000015','success',1,1);
select set_config('test.next_page_run',ops.start_run('M01-test06-page','news','backfill','dev','page')::text,true);
select extensions.is((select count(*)::int from ops.get_due_accounts('news',10,current_setting('test.next_page_run')::uuid,'backfill')),1,'successful unfinished backfill can continue in the next scheduler slot');
insert into app.competitor_accounts (id,competitor_id,platform,handle,url,next_due_at,backfill_status)
values ('06000000-0000-4000-8000-000000000018','06000000-0000-4000-8000-000000000002',
 'website','due-root-fallback','https://example.com','2000-01-01','done');
select set_config('test.site_run',ops.start_run('M01-test06-site','website_work_page','daily','dev','site')::text,true);
select extensions.is((select count(*)::int from ops.get_due_accounts('website',10,current_setting('test.site_run')::uuid,'daily')),1,'website work-page run can claim its documented root fallback');
select extensions.is(ops.diff_website_urls('06000000-0000-4000-8000-000000000018',array['https://example.com/work/a','https://example.com/work/b']),array['https://example.com/work/a','https://example.com/work/b'],'first discovery returns uncrawled URLs');
select extensions.is(ops.diff_website_urls('06000000-0000-4000-8000-000000000018',array['https://example.com/work/a','https://example.com/work/b']),array['https://example.com/work/a','https://example.com/work/b'],'discovered but uncrawled URLs remain retryable');
-- Only the fixture owner simulates the M05 completion writer here.
update app.website_pages set status='crawled',crawled_at=now() where account_id='06000000-0000-4000-8000-000000000018' and url='https://example.com/work/a';
select extensions.is(ops.diff_website_urls('06000000-0000-4000-8000-000000000018',array['https://example.com/work/a','https://example.com/work/b']),array['https://example.com/work/b'],'completed pages are excluded from retry');
update app.website_pages set status='ignored' where account_id='06000000-0000-4000-8000-000000000018' and url='https://example.com/work/b';
select extensions.is(ops.diff_website_urls('06000000-0000-4000-8000-000000000018',array['https://example.com/work/b']),array[]::text[],'human-ignored pages stay excluded');
select extensions.is((select count(*)::int from app.website_pages where account_id='06000000-0000-4000-8000-000000000018'),2,'URL rediscovery never duplicates stored pages');
select * from extensions.finish();
rollback;
