begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select extensions.plan(31);
-- Local test membership is rolled back, as in the existing writer RPC tests.
grant n8n_writer to postgres with inherit false;
grant n8n_writer to postgres with set true;

select extensions.ok(has_function_privilege('n8n_writer','ops.set_account_external_id(uuid,text,text)','execute'),
  'writer can execute the resolver');
select extensions.ok(not has_function_privilege('authenticated','ops.set_account_external_id(uuid,text,text)','execute'),
  'members cannot execute the resolver');
select extensions.ok(not has_function_privilege('anon','ops.set_account_external_id(uuid,text,text)','execute'),
  'anonymous callers cannot execute the resolver');
select extensions.ok(not has_function_privilege('api_agent','ops.set_account_external_id(uuid,text,text)','execute'),
  'read agents cannot execute the resolver');
select extensions.ok(not exists(select 1 from pg_proc p,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='ops.set_account_external_id(uuid,text,text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),
  'PUBLIC has no resolver execution privilege');
select extensions.ok((select p.prosecdef and 'search_path=""'=any(p.proconfig)
  from pg_proc p where p.oid='ops.set_account_external_id(uuid,text,text)'::regprocedure),
  'resolver uses SECURITY DEFINER with an empty search path');

insert into app.competitors(id,company_code,slug,name,priority_tier,status,notes) values
 ('15000000-0000-4000-8000-000000000001','TEST15','m04-resolution','Human name','pilot','active','Human note'),
 ('15000000-0000-4000-8000-000000000002','TEST15P','m04-resolution-paused','Paused owner','pilot','paused',null);
insert into app.competitor_accounts(id,competitor_id,platform,handle,url,next_due_at,backfill_status,
  last_item_published_at,last_external_id,backfill_cursor,consecutive_failures,status) values
 ('15000000-0000-4000-8000-000000000011','15000000-0000-4000-8000-000000000001','vimeo','resolution-main','https://vimeo.com/resolution-main','2000-01-01','done','2026-10-01','old-item','{"page":3}',1,'active'),
 ('15000000-0000-4000-8000-000000000012','15000000-0000-4000-8000-000000000001','instagram','resolution-ig','https://www.instagram.com/resolution-ig/','2000-01-01','done',null,null,null,0,'active'),
 ('15000000-0000-4000-8000-000000000013','15000000-0000-4000-8000-000000000002','vimeo','resolution-owner-paused','https://vimeo.com/resolution-owner-paused','2000-01-01','done',null,null,null,0,'active'),
 ('15000000-0000-4000-8000-000000000014','15000000-0000-4000-8000-000000000001','vimeo','resolution-paused','https://vimeo.com/resolution-paused','2000-01-01','done',null,null,null,0,'paused');
select set_config('test.resolver_run',ops.start_run('WF-10','vimeo','daily','dev','m04-resolver-test')::text,true);
select * from ops.get_due_accounts('vimeo',1,current_setting('test.resolver_run')::uuid,'daily');
create temporary table resolver_original as select to_jsonb(a) as account,
  (select to_jsonb(c) from app.competitors c where c.id=a.competitor_id) as competitor
  from app.competitor_accounts a where a.id='15000000-0000-4000-8000-000000000011';

set local role n8n_writer;
select extensions.lives_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','123456')$$,
  'writer resolves a live owned dev Vimeo claim with the default playlist argument');
reset role;
select extensions.ok((select external_id='123456' and uploads_playlist_id is null and resolve_status='resolved'
  from app.competitor_accounts where id='15000000-0000-4000-8000-000000000011'),
  'resolution saves the returned external ID');
select extensions.is((select to_jsonb(a)-array['external_id','uploads_playlist_id','resolve_status','updated_at']
  from app.competitor_accounts a where a.id='15000000-0000-4000-8000-000000000011'),
  (select account-array['external_id','uploads_playlist_id','resolve_status','updated_at'] from resolver_original),
  'successful resolution preserves the claim, schedule, watermark, failure count and other account fields');
select extensions.is((select to_jsonb(c) from app.competitors c where c.id='15000000-0000-4000-8000-000000000001'),
  (select competitor from resolver_original),'resolution preserves human-controlled competitor fields');
select extensions.lives_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','123456')$$,
  'identical resolution can be repeated');
select extensions.lives_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011',null)$$,
  'an unresolved public account records a bounded failure');
select extensions.ok((select resolve_status='failed' and last_error='vimeo_external_id_unresolved'
  and last_error_at is not null and external_id='123456' from app.competitor_accounts
  where id='15000000-0000-4000-8000-000000000011'),
  'failed resolution preserves the saved ID and records a fixed non-secret error');
select extensions.is((select to_jsonb(a)-array['external_id','uploads_playlist_id','resolve_status','last_error','last_error_at','updated_at']
  from app.competitor_accounts a where a.id='15000000-0000-4000-8000-000000000011'),
  (select account-array['external_id','uploads_playlist_id','resolve_status','last_error','last_error_at','updated_at'] from resolver_original),
  'failed resolution preserves lease, schedule, watermarks and failure accounting');
select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','123456');
select extensions.ok((select resolve_status='resolved' and last_error is null from app.competitor_accounts
  where id='15000000-0000-4000-8000-000000000011'),'later resolution clears only its own fixed resolver error');

update app.competitor_accounts set locked_until=clock_timestamp()-interval '1 second'
  where id='15000000-0000-4000-8000-000000000011';
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','999')$$,
  '42501',null,'expired claims cannot resolve');
update app.competitor_accounts set locked_until=clock_timestamp()+interval '1 hour',last_run_id=null
  where id='15000000-0000-4000-8000-000000000011';
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','999')$$,
  '42501',null,'unclaimed accounts cannot resolve');
update app.competitor_accounts set last_run_id=current_setting('test.resolver_run')::uuid
  where id='15000000-0000-4000-8000-000000000011';
update ops.scrape_runs set status='success' where id=current_setting('test.resolver_run')::uuid;
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','999')$$,
  '42501',null,'finished runs cannot resolve');
update ops.scrape_runs set status='running',env='prod' where id=current_setting('test.resolver_run')::uuid;
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','999')$$,
  '42501',null,'production runs cannot use the dev resolver');
update ops.scrape_runs set env='dev',platform='instagram' where id=current_setting('test.resolver_run')::uuid;
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','999')$$,
  '42501',null,'non-Vimeo runs cannot resolve');
update ops.scrape_runs set platform=null where id=current_setting('test.resolver_run')::uuid;
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','999')$$,
  '42501',null,'runs without an explicit Vimeo platform cannot resolve');
update ops.scrape_runs set platform='vimeo' where id=current_setting('test.resolver_run')::uuid;
update app.competitor_accounts set last_run_id=current_setting('test.resolver_run')::uuid,locked_until=clock_timestamp()+interval '1 hour'
  where id in ('15000000-0000-4000-8000-000000000012','15000000-0000-4000-8000-000000000013','15000000-0000-4000-8000-000000000014');
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000012','999')$$,
  '42501',null,'non-Vimeo accounts cannot resolve');
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000013','999')$$,
  '42501',null,'paused competitors cannot resolve');
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000014','999')$$,
  '42501',null,'paused accounts cannot resolve');
update app.competitor_accounts set status='failing' where id='15000000-0000-4000-8000-000000000011';
select extensions.lives_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','123456')$$,
  'a legitimately claimed failing account can recover resolution');
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000099','999')$$,
  '42501',null,'unknown account IDs do not grant arbitrary writes');
select extensions.throws_ok($$select ops.set_account_external_id(null,'999')$$,'22023',null,'null account ID is rejected');
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','')$$,
  '22023',null,'blank external IDs are rejected');
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','https://vimeo.com/999')$$,
  '22023',null,'URLs are not stored as external IDs');
select extensions.throws_ok($$select ops.set_account_external_id('15000000-0000-4000-8000-000000000011','123456',E'bad\nplaylist')$$,
  '22023',null,'invalid playlist IDs are rejected');
set local role n8n_writer;
select extensions.throws_ok($$update app.competitor_accounts set external_id='999'$$,
  '42501',null,'resolver grants do not permit direct account-table updates');
reset role;
select * from extensions.finish();
rollback;
