begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select extensions.plan(13);
insert into app.competitors (id,company_code,slug,name,priority_tier)
values ('07000000-0000-4000-8000-000000000001','TEST07','report-test','Report test','pilot');
insert into app.competitor_accounts (id,competitor_id,platform,handle,url,backfill_status,cadence)
values ('07000000-0000-4000-8000-000000000002','07000000-0000-4000-8000-000000000001','news','report-test','https://example.com/report','done','1 day');

select set_config('test.report_run',ops.start_run('M01-test07','news','daily','dev','failure1')::text,true);
update app.competitor_accounts set last_run_id=current_setting('test.report_run')::uuid,locked_until=now()+interval '2 hours' where handle='report-test';
select ops.report_account_result(current_setting('test.report_run')::uuid,'07000000-0000-4000-8000-000000000002','failed',0,0,'fixture failure');
select ops.report_account_result(current_setting('test.report_run')::uuid,'07000000-0000-4000-8000-000000000002','failed',0,0,'fixture failure');
select extensions.is((select consecutive_failures from app.competitor_accounts where handle='report-test'),1,'replayed failure receipt increments only once');
select extensions.is((select next_due_at from app.competitor_accounts where handle='report-test'),now()+interval '6 hours','failed collection retries in six hours');

select set_config('test.report_run',ops.start_run('M01-test07','news','daily','dev','failure2')::text,true);
update app.competitor_accounts set last_run_id=current_setting('test.report_run')::uuid,locked_until=now()+interval '2 hours' where handle='report-test';
select ops.report_account_result(current_setting('test.report_run')::uuid,'07000000-0000-4000-8000-000000000002','failed',0,0,'fixture failure');
select set_config('test.report_run',ops.start_run('M01-test07','news','daily','dev','failure3')::text,true);
update app.competitor_accounts set last_run_id=current_setting('test.report_run')::uuid,locked_until=now()+interval '2 hours' where handle='report-test';
select ops.report_account_result(current_setting('test.report_run')::uuid,'07000000-0000-4000-8000-000000000002','failed',0,0,'fixture failure');
select extensions.is((select consecutive_failures from app.competitor_accounts where handle='report-test'),3,'three separate failed attempts count three failures');
select extensions.is((select status::text from app.competitor_accounts where handle='report-test'),'failing','third failure marks the account failing');
select extensions.throws_ok($$select ops.report_account_result(current_setting('test.report_run')::uuid,
 '07000000-0000-4000-8000-000000000002','success',0,0)$$,'22023',null,'a completed account receipt cannot be rewritten');

select set_config('test.stale_report_run',current_setting('test.report_run'),true);
select set_config('test.report_run',ops.start_run('M01-test07','news','daily','dev','success')::text,true);
update app.competitor_accounts set last_run_id=current_setting('test.report_run')::uuid,locked_until=now()+interval '2 hours' where handle='report-test';
select ops.report_account_result(current_setting('test.stale_report_run')::uuid,'07000000-0000-4000-8000-000000000002','failed',0,0,'fixture failure');
select extensions.ok((select locked_until>now() and last_run_id=current_setting('test.report_run')::uuid from app.competitor_accounts where handle='report-test'),'old receipt replay does not release a newer claim');
select ops.report_account_result(current_setting('test.report_run')::uuid,'07000000-0000-4000-8000-000000000002','success',2,1);
select extensions.is((select status::text from app.competitor_accounts where handle='report-test'),'active','success restores a failing account');
select extensions.is((select consecutive_failures from app.competitor_accounts where handle='report-test'),0,'success resets consecutive failures');
select extensions.ok((select locked_until is null from app.competitor_accounts where handle='report-test'),'success releases its claim');
select extensions.ok((select next_due_at between now()+interval '19 hours' and now()+interval '21 hours' from app.competitor_accounts where handle='report-test'),'daily success becomes due in the next scheduled cycle');
select extensions.is((ops.finish_run(current_setting('test.report_run')::uuid,'success')->>'accounts_ok')::int,1,'finish_run reports successful account count');
select extensions.is((ops.finish_run(current_setting('test.report_run')::uuid,'success')->>'items_new')::int,1,'finish_run replay returns the same stored summary');
select extensions.throws_ok($$select ops.report_account_result(current_setting('test.report_run')::uuid,
 '07000000-0000-4000-8000-000000000002','success',-1,0)$$,'22023',null,'negative result counts are rejected');
select * from extensions.finish();
rollback;
