-- Synthetic local-only cadence/health fixtures. Everything, including role
-- membership used to exercise the restricted writer, rolls back.
begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
grant n8n_writer,api_agent to postgres with inherit false;
grant n8n_writer,api_agent to postgres with set true;

select extensions.ok(has_function_privilege('n8n_writer','ops.set_stories_cadence(boolean)','EXECUTE'),'writer can call the narrow cadence switch');
select extensions.ok(not has_function_privilege('anon','ops.set_stories_cadence(boolean)','EXECUTE')
  and not has_function_privilege('authenticated','ops.set_stories_cadence(boolean)','EXECUTE')
  and not has_function_privilege('api_agent','ops.set_stories_cadence(boolean)','EXECUTE'),'public and agent roles cannot mutate cadence');
select extensions.ok(not has_function_privilege('anon','ops.daily_health()','EXECUTE')
  and not has_function_privilege('authenticated','ops.daily_health()','EXECUTE')
  and not has_function_privilege('api_agent','ops.daily_health()','EXECUTE')
  and has_function_privilege('n8n_writer','ops.daily_health()','EXECUTE'),'existing health RPC ACL remains writer-only');
select extensions.ok((select bool_and(prosecdef and proconfig=array['search_path=""']) from pg_proc
  where oid in ('ops.set_stories_cadence(boolean)'::regprocedure,'ops.daily_health()'::regprocedure)),'both RPCs use private-schema definers with an empty search path');
select extensions.ok(not has_table_privilege('n8n_writer','ops.settings','INSERT,UPDATE,DELETE')
  and not has_table_privilege('n8n_writer','app.competitor_accounts','INSERT,UPDATE,DELETE'),'writer cannot bypass cadence RPC with table DML');
select extensions.ok((select relrowsecurity from pg_class where oid='ops.settings'::regclass)
  and (select relrowsecurity from pg_class where oid='app.competitor_accounts'::regclass),'existing account/setting RLS stays enabled');
select set_config('test.m06_report_definition',(select md5(string_agg(pg_get_functiondef(p.oid),',' order by p.oid))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ops' and p.proname='report_account_result'),true);

-- A null choice fails without changing a setting or adding an audit entry.
select set_config('test.m06_setting_before',(select to_jsonb(s)::text from ops.settings s where key='stories_twice_daily'),true);
select set_config('test.m06_audit_before',(select count(*)::text from ops.audit_log where action='stories_cadence_changed'),true);
set local role n8n_writer;
select extensions.throws_ok($q$select ops.set_stories_cadence(null)$q$,'22023',null,'null cadence choice is rejected');
reset role;
select extensions.is((select to_jsonb(s) from ops.settings s where key='stories_twice_daily'),current_setting('test.m06_setting_before')::jsonb,'invalid choice preserves setting value and timestamp');
select extensions.is((select count(*)::text from ops.audit_log where action='stories_cadence_changed'),current_setting('test.m06_audit_before'),'invalid choice creates no audit record');
select extensions.is(ops.daily_health()->'story_capture_gap','null'::jsonb,'no observed stories is unknown rather than a zero capture gap');

insert into app.competitors(id,company_code,slug,name,priority_tier,status) values
 ('21000000-0000-4000-8000-000000000001','TEST21-A','m06-health-active','M06 health active','pilot','active'),
 ('21000000-0000-4000-8000-000000000002','TEST21-N','m06-health-noactivity','M06 health no other activity','pilot','active'),
 ('21000000-0000-4000-8000-000000000003','TEST21-R','m06-health-archived','M06 health archived','pilot','archived'),
 ('21000000-0000-4000-8000-000000000004','TEST21-P','m06-health-paused','M06 health paused','pilot','paused'),
 ('21000000-0000-4000-8000-000000000005','TEST21-S','m06-health-sameplatform','M06 health same platform only','pilot','active');
create temporary table m06_health_accounts(n int,company int,platform app.platform,status app.account_status,backfill app.backfill_status,age interval,zero_expected boolean,label text);
insert into m06_health_accounts values
 (1,1,'vimeo','active','done','31 days',true,'old eligible empty account with other-platform activity is flagged'),
 (2,1,'youtube','active','done','31 days',false,'own recent item excludes a zero-item flag'),
 (3,1,'instagram','active','done','31 days',false,'own item at exactly thirty days is included'),
 (4,1,'linkedin','active','done','31 days',true,'future own observation is not accepted as recent activity'),
 (5,1,'website_work_page','active','pending','31 days',false,'incomplete backfill is not eligible'),
 (6,1,'vimeo','paused','done','31 days',false,'paused account is excluded'),
 (7,1,'instagram_stories','active','not_applicable','31 days',false,'ephemeral stories do not get zero-item streak flags'),
 (8,1,'linkedin_employees','active','not_applicable','31 days',false,'employee snapshots are not item-producing accounts'),
 (9,1,'website','active','done','31 days',false,'website root identity is not a work-page account'),
 (10,1,'linkedin','active','done','29 days 23:59:59',false,'new account has not observed a full thirty-day window'),
 (11,1,'vimeo','active','not_applicable','30 days',true,'exact thirty-day account age is eligible'),
 (12,1,'news','active','done','31 days',false,'removed content still proves a new row was observed'),
 (13,3,'vimeo','active','done','31 days',false,'archived parent is excluded'),
 (14,2,'vimeo','active','done','31 days',false,'old or future other-platform rows do not prove recent activity'),
 (15,4,'vimeo','active','done','31 days',false,'paused parent is excluded'),
 (16,5,'vimeo','active','done','31 days',false,'same-platform rows alone do not prove other-platform activity'),
 (17,1,'vimeo','failing','done','31 days',false,'only active accounts receive a zero-item flag'),
 (18,1,'vimeo','active','done','31 days',true,'own observation just outside thirty days is excluded'),
 (19,1,'instagram_stories','paused','not_applicable','31 days',false,'paused story cadence can change without activation'),
 (20,3,'instagram_stories','active','not_applicable','31 days',false,'archived-parent story cadence is still a global setting');
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status,backfill_status,created_at,cadence,last_success_at,
  locked_until,last_item_published_at,last_error,consecutive_failures)
select ('21010000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('21000000-0000-4000-8000-'||lpad(company::text,12,'0'))::uuid,platform,'m06-health-'||n,'https://example.test/m06-health/'||n,
 status,backfill,now()-age,interval '1 day',case when n=4 then null else now()-interval '3 days' end,
 now()+interval '3 hours','2026-01-01T12:00:00Z','synthetic preserved error',2 from m06_health_accounts;

insert into app.items(competitor_id,account_id,platform,item_type,external_id,url,first_seen_at,status)
select '21000000-0000-4000-8000-000000000001',('21010000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 platform,'post','m06-health-own-'||n,'https://example.test/m06-health-own/'||n,now()+offset_age,status::app.item_status
from(values(2,'youtube'::app.platform,interval '-1 day','active'),(3,'instagram',interval '-30 days','active'),
 (4,'linkedin',interval '1 second','active'),(12,'news',interval '-5 days','removed'),(18,'vimeo',interval '-30 days -0.000001 seconds','active'))x(n,platform,offset_age,status);
insert into app.items(competitor_id,platform,item_type,external_id,url,first_seen_at) values
 ('21000000-0000-4000-8000-000000000002','youtube','video','m06-health-old-other','https://example.test/old-other',now()-interval '30 days 0.000001 seconds'),
 ('21000000-0000-4000-8000-000000000002','instagram','post','m06-health-future-other','https://example.test/future-other',now()+interval '0.000001 seconds'),
 ('21000000-0000-4000-8000-000000000005','vimeo','video','m06-health-same-only','https://example.test/same-only',now());
select set_config('test.m06_zero_health',ops.daily_health()::text,true);
select extensions.is(current_setting('test.m06_zero_health')::jsonb->'zero_item_streaks' @>
 jsonb_build_array(jsonb_build_object('account_id',('21010000-0000-4000-8000-'||lpad(n::text,12,'0')))),zero_expected,label)
 from m06_health_accounts order by n;
select extensions.is((select array_agg(k order by k) from jsonb_object_keys(current_setting('test.m06_zero_health')::jsonb->'zero_item_streaks'->0) k),
 array['account_id','competitor','handle','last_success_at','platform'],'zero-item rows have exactly the stable five-field shape');
select extensions.is((select x->'last_success_at' from jsonb_array_elements(current_setting('test.m06_zero_health')::jsonb->'zero_item_streaks') x
 where x->>'account_id'='21010000-0000-4000-8000-000000000004'),'null'::jsonb,'unknown success timestamp remains null');

-- Valid story observations: two strictly late of four, with exact lower/upper
-- observation edges. Bad/future/missing timestamps and inactive content excluded.
create temporary table m06_story_cases(n int,company int,platform app.platform,item_type app.item_type,status app.item_status,seen timestamptz,published timestamptz);
insert into m06_story_cases values
 (1,1,'instagram_stories','story','active',now()-interval '1 day',now()-interval '1 day 18 hours 0.000001 seconds'),
 (2,1,'instagram_stories','story','active',now()-interval '2 days',now()-interval '2 days 18 hours'),
 (3,1,'instagram_stories','story','active',now()-interval '7 days',now()-interval '7 days 1 hour'),
 (4,1,'instagram_stories','story','active',now(),now()-interval '20 hours'),
 (5,1,'instagram_stories','story','active',now()-interval '7 days 0.000001 seconds',now()-interval '8 days'),
 (6,1,'instagram_stories','story','active',now()+interval '0.000001 seconds',now()-interval '1 day'),
 (7,1,'instagram_stories','story','active',now()-interval '1 day',null),
 (8,1,'instagram_stories','story','active',now()-interval '1 day',now()-interval '1 day'+interval '0.000001 seconds'),
 (9,1,'instagram_stories','story','removed',now(),now()-interval '1 day'),
 (10,3,'instagram_stories','story','active',now(),now()-interval '1 day'),
 (11,1,'instagram_stories','post','active',now(),now()-interval '1 day'),
 (12,4,'instagram_stories','story','active',now(),now()-interval '1 day'),
 (13,1,'instagram','story','active',now(),now()-interval '1 day');
insert into app.items(competitor_id,platform,item_type,status,external_id,url,first_seen_at,published_at)
select ('21000000-0000-4000-8000-'||lpad(company::text,12,'0'))::uuid,platform,item_type,status,
 'm06-health-story-'||n,'https://example.test/story/'||n,seen,published from m06_story_cases;
select extensions.is((ops.daily_health()->>'story_capture_gap')::numeric,0.5::numeric,'strictly over eighteen hours is late; valid seven-day boundaries count');
select extensions.ok((ops.daily_health()->>'story_capture_gap')::numeric between 0 and 1,'capture-gap result is a fraction');

create temporary table m06_media_cases(n int,company int,status app.item_status,created timestamptz,source text,path text);
insert into m06_media_cases values
 (1,1,'active',now(),'https://cdn.example.test/pause.jpg',null),
 (2,1,'active',now()-interval '24 hours','https://cdn.example.test/lower.jpg',null),
 (3,1,'active',now(),'   ',null),(4,1,'active',now(),null,null),
 (5,1,'active',now(),'https://cdn.example.test/stored.jpg','stored/thumb.jpg'),
 (6,1,'removed',now(),'https://cdn.example.test/removed.jpg',null),
 (7,3,'active',now(),'https://cdn.example.test/archived.jpg',null),
 (8,4,'active',now(),'https://cdn.example.test/parent-paused.jpg',null),
 (9,1,'active',now()-interval '24 hours 0.000001 seconds','https://cdn.example.test/old.jpg',null),
 (10,1,'active',now()+interval '0.000001 seconds','https://cdn.example.test/future.jpg',null),
 (11,1,'active',now(),'https://cdn.example.test/blank-path.jpg',''),
 (12,1,'active',now(),'https://cdn.example.test/no-account.jpg',null);
insert into app.items(competitor_id,account_id,platform,item_type,status,external_id,url,created_at,first_seen_at,thumbnail_source_url,thumbnail_path)
select ('21000000-0000-4000-8000-'||lpad(company::text,12,'0'))::uuid,
 case when n=1 then '21010000-0000-4000-8000-000000000006'::uuid else null end,
 'vimeo','video',status,'m06-health-media-'||n,'https://example.test/media/'||n,created,
 case when n=12 then now()-interval '40 days' else now() end,source,path from m06_media_cases;
select extensions.is((ops.daily_health()->>'media_missing_24h')::int,4,'media count uses created_at, nonempty source/no path, active item and parent; account pause does not erase retained work');
select extensions.is(jsonb_typeof(ops.daily_health()->'media_missing_24h'),'number','media missing is a numeric integer count');

-- The switch touches only cadence and its one setting, even for paused or
-- archived-parent story identities. It never turns scheduling on itself.
select set_config('test.m06_accounts_preserved',(select md5(string_agg((to_jsonb(a)-'cadence')::text,',' order by a.id)) from app.competitor_accounts a),true);
select set_config('test.m06_nonstories',(select md5(string_agg(to_jsonb(a)::text,',' order by a.id)) from app.competitor_accounts a where platform<>'instagram_stories'),true);
select set_config('test.m06_items_preserved',(select md5(string_agg(to_jsonb(i)::text,',' order by i.id)) from app.items i),true);
select set_config('test.m06_legacy_health',(ops.daily_health()-array['zero_item_streaks','story_capture_gap','media_missing_24h'])::text,true);
select set_config('test.m06_audit_before',(select count(*)::text from ops.audit_log where action='stories_cadence_changed'),true);
set local role n8n_writer;
select set_config('test.m06_switch_on',ops.set_stories_cadence(true)::text,true);
reset role;
select extensions.is(current_setting('test.m06_switch_on')::jsonb,jsonb_build_object('changed',true,'twice_daily',true,'cadence_seconds',43200,'accounts_changed',3),'switch atomically records actual setting and three changed story accounts');
select extensions.is((select value from ops.settings where key='stories_twice_daily'),'true'::jsonb,'twice-daily setting is saved as boolean');
select extensions.ok(not exists(select 1 from app.competitor_accounts where platform='instagram_stories' and cadence<>interval '12 hours'),'all story accounts use twelve hours, independent of status');
select extensions.is((select md5(string_agg((to_jsonb(a)-'cadence')::text,',' order by a.id)) from app.competitor_accounts a),current_setting('test.m06_accounts_preserved'),'switch preserves due times, locks, watermarks, timestamps and account state');
select extensions.is((select md5(string_agg(to_jsonb(a)::text,',' order by a.id)) from app.competitor_accounts a where platform<>'instagram_stories'),current_setting('test.m06_nonstories'),'non-story accounts are byte-for-byte unchanged');
select extensions.is((select md5(string_agg(to_jsonb(i)::text,',' order by i.id)) from app.items i),current_setting('test.m06_items_preserved'),'source content and human fields remain unchanged');
select extensions.is(ops.daily_health()-array['zero_item_streaks','story_capture_gap','media_missing_24h'],current_setting('test.m06_legacy_health')::jsonb,'legacy health sections retain their exact values');
select extensions.is((select count(*)::bigint from ops.audit_log where action='stories_cadence_changed'),current_setting('test.m06_audit_before')::bigint+1,'one real cadence change adds exactly one audit event');
select extensions.is(jsonb_array_length((select before->'accounts' from ops.audit_log where action='stories_cadence_changed' order by id desc limit 1)),3,'audit identifies the three actual account changes');
select set_config('test.m06_replay_setting',(select to_jsonb(s)::text from ops.settings s where key='stories_twice_daily'),true);
set local role n8n_writer;
select extensions.is(ops.set_stories_cadence(true),jsonb_build_object('changed',false,'twice_daily',true,'cadence_seconds',43200,'accounts_changed',0),'same choice replays as a no-op');
reset role;
select extensions.is((select to_jsonb(s) from ops.settings s where key='stories_twice_daily'),current_setting('test.m06_replay_setting')::jsonb,'no-op replay does not bump setting timestamp');
select extensions.is((select count(*)::bigint from ops.audit_log where action='stories_cadence_changed'),current_setting('test.m06_audit_before')::bigint+1,'replay adds no duplicate audit event');

-- Existing scheduling rule stays now()+cadence-4h, or now()+6h on failure.
select set_config('test.m06_story_run',ops.start_run('WF-12','instagram_stories','daily','dev','m06-cadence-local-success')::text,true);
update app.competitor_accounts set last_run_id=current_setting('test.m06_story_run')::uuid,locked_until=now()+interval '1 hour' where id='21010000-0000-4000-8000-000000000007';
select ops.report_account_result(current_setting('test.m06_story_run')::uuid,'21010000-0000-4000-8000-000000000007','success',0,0);
select extensions.is((select next_due_at from app.competitor_accounts where id='21010000-0000-4000-8000-000000000007'),now()+interval '8 hours','twelve-hour story success keeps the existing eight-hour due rule');
select set_config('test.m06_due_before',(select next_due_at::text from app.competitor_accounts where id='21010000-0000-4000-8000-000000000007'),true);
set local role n8n_writer;
select extensions.is((ops.set_stories_cadence(false)->>'accounts_changed')::int,3,'daily choice switches the same three story cadences back');
reset role;
select extensions.is((select next_due_at::text from app.competitor_accounts where id='21010000-0000-4000-8000-000000000007'),current_setting('test.m06_due_before'),'changing cadence never reschedules an existing due time');
select set_config('test.m06_story_run',ops.start_run('WF-12','instagram_stories','daily','dev','m06-cadence-local-daily')::text,true);
update app.competitor_accounts set last_run_id=current_setting('test.m06_story_run')::uuid,locked_until=now()+interval '1 hour' where id='21010000-0000-4000-8000-000000000007';
select ops.report_account_result(current_setting('test.m06_story_run')::uuid,'21010000-0000-4000-8000-000000000007','success',0,0);
select extensions.is((select next_due_at from app.competitor_accounts where id='21010000-0000-4000-8000-000000000007'),now()+interval '20 hours','daily story success retains the twenty-hour due rule');
select set_config('test.m06_story_run',ops.start_run('WF-12','instagram_stories','daily','dev','m06-cadence-local-failed')::text,true);
update app.competitor_accounts set last_run_id=current_setting('test.m06_story_run')::uuid,locked_until=now()+interval '1 hour' where id='21010000-0000-4000-8000-000000000007';
select ops.report_account_result(current_setting('test.m06_story_run')::uuid,'21010000-0000-4000-8000-000000000007','failed',0,0,'fixture_failure');
select extensions.is((select next_due_at from app.competitor_accounts where id='21010000-0000-4000-8000-000000000007'),now()+interval '6 hours','failed story capture still retries in six hours');
select extensions.is((select md5(string_agg(pg_get_functiondef(p.oid),',' order by p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ops' and p.proname='report_account_result'),current_setting('test.m06_report_definition'),'cadence switch never replaces or alters report_account_result');
set local role api_agent;
select extensions.throws_ok($q$select ops.set_stories_cadence(true)$q$,'42501',null,'agent cannot change cadence');
select extensions.throws_ok($q$select ops.daily_health()$q$,'42501',null,'agent cannot read private operational health');
reset role;
select * from extensions.finish();
rollback;
