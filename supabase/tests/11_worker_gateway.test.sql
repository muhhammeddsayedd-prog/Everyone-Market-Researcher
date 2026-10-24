-- Local-only rollback fixtures. Session authorization below simulates the SQL
-- boundary; it is deliberately not a hosted restricted-login/TLS receipt.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select extensions.no_plan();
select extensions.has_function('ops','worker_gateway_admit',array['uuid','uuid','text','jsonb','text'],'gateway admission exists');
select extensions.has_function('ops','worker_gateway_execute',array['uuid','uuid','text','jsonb'],'gateway execution exists');
select extensions.has_function('ops','worker_gateway_status',array['uuid','uuid'],'gateway status exists');
select extensions.has_table('ops','worker_gateway_requests','durable requests exist');
select extensions.has_table('ops','worker_gateway_rate_windows','persistent one-trial limits exist');
select extensions.has_table('ops','worker_gateway_leases','bounded leases exist');
select extensions.is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='ops' and c.relname like 'worker_gateway_%' and c.relkind='r' and c.relrowsecurity),3,'all gateway tables enforce RLS');
select extensions.throws_ok($$select ops.worker_gateway_admit('76c2ad42-c094-4ba4-9a0b-566e19b97780','40000000-0000-4000-8000-000000000001','identity.read','{}','admit')$$,'42501',null,'owner session is not a restricted login');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname in ('worker_gateway_admit','worker_gateway_execute','worker_gateway_status')
    and p.prosecdef and 'search_path=""'=any(p.proconfig)),3,'all entry points are hardened definers');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname like 'worker_gateway_%' and
    (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')
      or has_function_privilege('api_agent',p.oid,'execute') or exists
      (select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'))),0,'browser/agent/PUBLIC cannot execute gateway functions');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname like 'worker_gateway_%' and has_function_privilege('n8n_writer',p.oid,'execute')),3,'only three gateway functions are callable by writer');
select extensions.is((select count(*)::int from information_schema.columns where table_schema='ops'
  and table_name='worker_gateway_requests' and column_name in ('args','payload','password','secret')),0,'ledger does not store caller args or secrets');
select extensions.is((select count(*)::int from ops.worker_gateway_rate_windows),1,'one immutable trial window is prepared');
select extensions.ok((select starts_at is null and expires_at is null and closed_at is null and admitted_count=0
  from ops.worker_gateway_rate_windows),'migration does not start the trial clock');
select extensions.is((select count(*)::int from information_schema.columns where table_schema='ops'
  and table_name='worker_gateway_rate_windows' and column_name in ('bound_audience','bound_commit_sha','bound_deployment_id')),3,'window durably pins exactly one deployment');
create temporary table gateway_test_results(label text primary key,value jsonb);
grant all on gateway_test_results to n8n_writer;
insert into gateway_test_results select 'audit_baseline',to_jsonb(count(*)::int) from ops.audit_log;
create function pg_temp.gateway_admit(p_id integer,p_operation text default 'identity.read',p_args jsonb default '{}',p_mode text default 'admit')
returns jsonb language sql as $$ select ops.worker_gateway_admit('76c2ad42-c094-4ba4-9a0b-566e19b97780',
  ('40000000-0000-4000-8000-'||lpad(p_id::text,12,'0'))::uuid,p_operation,p_args,p_mode); $$;
create function pg_temp.gateway_execute(p_id integer,p_operation text default 'identity.read',p_args jsonb default '{}')
returns jsonb language sql as $$ select ops.worker_gateway_execute('76c2ad42-c094-4ba4-9a0b-566e19b97780',
  ('40000000-0000-4000-8000-'||lpad(p_id::text,12,'0'))::uuid,p_operation,p_args); $$;
create function pg_temp.gateway_status(p_id integer)
returns jsonb language sql as $$ select ops.worker_gateway_status('76c2ad42-c094-4ba4-9a0b-566e19b97780',
  ('40000000-0000-4000-8000-'||lpad(p_id::text,12,'0'))::uuid); $$;
grant n8n_writer to postgres with inherit false;
grant n8n_writer to postgres with set true;
set local role n8n_writer;
select extensions.throws_ok($$select pg_temp.gateway_admit(1)$$,'42501',null,'postgres plus SET ROLE is not the actual writer session');
reset role;
-- This superuser-controlled local simulation exercises guards, not login/TLS.
set local session authorization n8n_writer;
select extensions.throws_ok($$select * from ops.worker_gateway_requests$$,'42501',null,'writer cannot read business ledger');
select extensions.throws_ok($$update ops.worker_gateway_requests set state='completed'$$,'42501',null,'writer cannot directly update business ledger');
select extensions.throws_ok($$select * from ops.worker_gateway_rate_windows$$,'42501',null,'writer cannot read private limit records');
select extensions.throws_ok($$select * from ops.worker_gateway_leases$$,'42501',null,'writer cannot read private lease records');
select extensions.throws_ok($$insert into ops.worker_gateway_rate_windows(namespace) values ('other')$$,'42501',null,'writer cannot create another window');
select extensions.throws_ok($$update ops.worker_gateway_rate_windows set admitted_count=0$$,'42501',null,'writer cannot reset counters');
select extensions.throws_ok($$delete from ops.worker_gateway_leases$$,'42501',null,'writer cannot delete leases');
select extensions.throws_ok($$select ops.worker_gateway_response('76c2ad42-c094-4ba4-9a0b-566e19b97780','completed',null,'{}')$$,'42501',null,'writer cannot bypass wrappers through private helper');
select extensions.throws_ok($$select ops.worker_gateway_admit(null,null,'identity.read','{}','admit')$$,'22023',null,'null boundaries fail closed');
select extensions.throws_ok($$select ops.worker_gateway_admit('76c2ad42-c094-4ba4-9a0b-566e19b97781','40000000-0000-4000-8000-000000000001','identity.read','{}','admit')$$,'22023',null,'different window cannot replenish budget');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'query','{}')$$,'22023',null,'arbitrary operation rejected');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'identity.read','{"sql":"select 1"}')$$,'22023',null,'unknown read argument rejected');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'settings.read','{"key":"m03_price_verification"}')$$,'22023',null,'unapproved setting rejected');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'request.status','{"targetRequestId":null}')$$,'22023',null,'null target UUID rejected');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'error.count','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","claimNotify":true}')$$,'22023',null,'trial cannot claim notifications');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'error.log','{"workflow":"foreign","kind":"notify","message":"gateway_acceptance","executionId":"40000000-0000-4000-8000-000000000001"}')$$,'22023',null,'foreign workflow denied');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'error.log','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","kind":"notify","message":"raw synthetic body","executionId":"40000000-0000-4000-8000-000000000001"}')$$,'22023',null,'arbitrary message denied');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'request.status','{"targetRequestId":"40000000-0000-4000-8000-000000000001"}')$$,'22023',null,'status correlation cannot reuse target business ID');
select extensions.lives_ok($$select pg_temp.gateway_admit(1,'identity.read','{}','inspect')$$,'inspect is a read-only prepared-state control');
select extensions.is(pg_temp.gateway_admit(1)->>'code','operation_not_permitted','unbound trial cannot start');
insert into gateway_test_results values ('binding',pg_temp.gateway_admit(1,'identity.read',
  '{"audience":"https://everyone-market-researcher-gw01-fixture.vercel.app","commitSha":"0000000000000000000000000000000000000000","deploymentId":"dpl_GW01LocalFixture"}','bind'));
select extensions.is((select value#>>'{window,boundDeploymentId}' from gateway_test_results where label='binding'),'dpl_GW01LocalFixture','first bind pins designated synthetic local deployment');
select extensions.is((select value#>'{window,startsAt}' from gateway_test_results where label='binding'),'null'::jsonb,'binding never starts trial clock');
select extensions.is((select value#>>'{window,totalAdmitted}' from gateway_test_results where label='binding'),'0','binding never consumes admission');
select extensions.is(pg_temp.gateway_admit(1,'identity.read',
  '{"audience":"https://everyone-market-researcher-gw01-fixture.vercel.app","commitSha":"0000000000000000000000000000000000000000","deploymentId":"dpl_GW01LocalFixture"}','bind'),
  (select value from gateway_test_results where label='binding'),'identical bind is idempotent');
select extensions.is(pg_temp.gateway_admit(1,'identity.read',
  '{"audience":"https://different.vercel.app","commitSha":"0000000000000000000000000000000000000000","deploymentId":"dpl_GW01Other"}','bind')->>'code','args_conflict','bound deployment cannot be overwritten');
select extensions.throws_ok($$select pg_temp.gateway_admit(1,'identity.read','{"audience":"https://example.com","commitSha":"0000000000000000000000000000000000000000","deploymentId":"dpl_GW01LocalFixture"}','bind')$$,'22023',null,'bind refuses foreign deployment origin');
insert into gateway_test_results values ('first',pg_temp.gateway_admit(1));
select extensions.is((select value->>'state' from gateway_test_results where label='first'),'admitted','first request admitted');
select extensions.is((select (value#>>'{window,totalAdmitted}')::int from gateway_test_results where label='first'),1,'first request consumes one counter');
select extensions.is((select (value#>>'{window,expiresAt}')::timestamptz-(value#>>'{window,startsAt}')::timestamptz from gateway_test_results where label='first'),interval '30 minutes','first admission starts exactly one bounded window');
select extensions.is(pg_temp.gateway_admit(1)->>'state','in_flight','duplicate reserved work is not admitted again');
insert into gateway_test_results values ('identity',pg_temp.gateway_execute(1));
select extensions.is((select value->>'state' from gateway_test_results where label='identity'),'completed','safe identity operation completes');
select extensions.is((select value#>>'{result,sessionUser}' from gateway_test_results where label='identity'),'n8n_writer','SQL reports actual session principal');
select extensions.ok((select not(value->'result' ? 'currentUser') from gateway_test_results where label='identity'),'definer does not invent a writer current_user');
select extensions.is(pg_temp.gateway_execute(1),(select value from gateway_test_results where label='identity'),'same execution key returns identical saved result');
select extensions.is(pg_temp.gateway_admit(1)->>'state','completed','same admitted key reuses completion');
select extensions.is(pg_temp.gateway_admit(1,'settings.read','{"key":"daily_budget_usd"}')->>'code','args_conflict','changed operation cannot reuse request ID');
select extensions.is(pg_temp.gateway_admit(2,'settings.read','{"key":"daily_budget_usd"}')->>'state','admitted','setting operation admitted');
select extensions.is(pg_temp.gateway_admit(2,'settings.read','{"key":"stats_daily_enabled"}')->>'code','args_conflict','changed valid args conflict');
select extensions.is(pg_temp.gateway_execute(2,'settings.read','{"key":"daily_budget_usd"}')#>'{result,value}','25'::jsonb,'allowed setting read actually executes');
select extensions.is(pg_temp.gateway_admit(3,'request.status','{"targetRequestId":"40000000-0000-4000-8000-000000000001"}')->>'state','admitted','status correlation admitted separately');
select extensions.is(pg_temp.gateway_status(1)->>'state','completed','status returns durable saved receipt');
select extensions.is(pg_temp.gateway_status(3)->>'state','absent','status correlation never becomes business request');
select extensions.is(pg_temp.gateway_status(999)->>'state','absent','missing target stays absent');
select extensions.is(pg_temp.gateway_execute(999)->>'state','absent','execute cannot invent absent admission');
select extensions.is(pg_temp.gateway_execute(2,'settings.read','{"key":"stats_daily_enabled"}')->>'state','conflict','execute independently verifies DB JSONB digest');
select extensions.ok((select bool_and((pg_temp.gateway_admit(100+x::int,op)->>'code')='operation_not_permitted')
  from unnest(array['run.start','run.finish','apify.register','apify.read','apify.pending','apify.process','cost.log','fees.accrue']) with ordinality a(op,x)),'all future actor/run/cost/fee aliases explicitly denied');
select extensions.is(pg_temp.gateway_admit(4,'error.log','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","kind":"notify","message":"gateway_acceptance","executionId":"40000000-0000-4000-8000-000000000004"}')->>'state','admitted','designated retained log acknowledgment admitted');
select extensions.is(pg_temp.gateway_execute(4,'error.log','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","kind":"notify","message":"gateway_acceptance","executionId":"40000000-0000-4000-8000-000000000004"}')#>'{result,acknowledged}','true'::jsonb,'designated log acknowledgment actually executes');
select extensions.is(pg_temp.gateway_execute(4,'error.log','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","kind":"notify","message":"gateway_acceptance","executionId":"40000000-0000-4000-8000-000000000004"}')->>'state','completed','same audit key reuses completion');
reset session authorization;
select extensions.is((select count(*)::int from ops.audit_log)-(select value::text::int from gateway_test_results where label='audit_baseline'),1,'audit side effect occurs exactly once in rollback fixture');
select extensions.is((select count(*)::int from ops.worker_gateway_requests),3,'status/missing/denied operations never reserve business rows');
select extensions.ok((select payload_sha256=encode(extensions.digest(convert_to(jsonb_build_object('operation','settings.read','args','{"key":"daily_budget_usd"}'::jsonb)::text,'UTF8'),'sha256'),'hex')
  from ops.worker_gateway_requests where request_id='40000000-0000-4000-8000-000000000002'),'stored digest is actual PostgreSQL JSONB canonical text');
-- Reset ONLY this transaction's test clock/counters as owner to isolate limits.
update ops.worker_gateway_rate_windows set minute_count=0;
set local session authorization n8n_writer;
select extensions.is(pg_temp.gateway_admit(5,'prices.read')->>'state','admitted','price read admitted');
select extensions.ok(pg_temp.gateway_execute(5,'prices.read')#>'{result,prices}' ? 'apify/instagram-scraper:result','price read uses actual approved map');
select extensions.is(pg_temp.gateway_admit(6,'health.read')->>'state','admitted','health read admitted');
select extensions.ok(pg_temp.gateway_execute(6,'health.read')->'result' ?& array['budget','queues','workflow_errors_24h'],'health read returns actual required sections');
select extensions.is(pg_temp.gateway_admit(7,'error.count','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","claimNotify":false}')->>'state','admitted','nonclaiming error count admitted');
select extensions.ok((pg_temp.gateway_execute(7,'error.count','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","claimNotify":false}')#>>'{result,count}')::int>=0,'error count actually executes');
select extensions.is(pg_temp.gateway_admit(8)->>'state','admitted','first reserved lease admitted');
select extensions.is(pg_temp.gateway_admit(9)->>'state','admitted','second reserved lease admitted');
select extensions.is(pg_temp.gateway_admit(10)->>'code','concurrency_limit','third reserved operation denied');
reset session authorization;
select extensions.is((select count(*)::int from ops.worker_gateway_leases where request_id is not null),2,'exactly two leased business reservations');
update ops.worker_gateway_requests set lease_expires_at=clock_timestamp()-interval '1 second' where request_id='40000000-0000-4000-8000-000000000008';
update ops.worker_gateway_leases set expires_at=clock_timestamp()-interval '1 second' where request_id='40000000-0000-4000-8000-000000000008';
set local session authorization n8n_writer;
select extensions.is(pg_temp.gateway_status(8)->>'state','reconciliation_required','expired reservation is not success');
select extensions.is(pg_temp.gateway_execute(8)->>'state','reconciliation_required','expired reservation never blindly reexecutes');
select extensions.is(pg_temp.gateway_admit(8)->>'state','reconciliation_required','same expired ID never receives fresh lease');
select extensions.is(pg_temp.gateway_admit(10)->>'state','admitted','new different work can use expired slot');
select extensions.is(pg_temp.gateway_execute(10)->>'state','completed','reused slot still executes only current owner');
select extensions.is(pg_temp.gateway_execute(9)->>'state','completed','second slot releases on completion');
reset session authorization;
-- Simulate a business write failure. The operation subtransaction must roll it
-- back and save a fixed rejection without leaking the database exception.
create function pg_temp.gateway_reject_audit() returns trigger language plpgsql as $$
begin raise exception 'synthetic_private_sql_error'; end; $$;
create trigger gateway_test_failure before insert on ops.audit_log for each row execute function pg_temp.gateway_reject_audit();
set local session authorization n8n_writer;
select extensions.is(pg_temp.gateway_admit(11,'error.log','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","kind":"notify","message":"gateway_acceptance","executionId":"40000000-0000-4000-8000-000000000011"}')->>'state','admitted','failing business request reserves independently');
select extensions.is(pg_temp.gateway_execute(11,'error.log','{"workflow":"M03-GATEWAY-ACCEPTANCE-DEV","kind":"notify","message":"gateway_acceptance","executionId":"40000000-0000-4000-8000-000000000011"}')->>'code','execution_failed','business error returns fixed sanitized rejection');
select extensions.is(pg_temp.gateway_status(11)->>'state','rejected','rejection is a durable terminal outcome');
reset session authorization;
drop trigger gateway_test_failure on ops.audit_log;
select extensions.is((select count(*)::int from ops.audit_log)-(select value::text::int from gateway_test_results where label='audit_baseline'),1,'failed operation created no audit row');
select extensions.is((select count(*)::int from ops.worker_gateway_leases where request_id is not null),0,'success and rejection release owned leases');
select extensions.ok((select admitted_count>20 from ops.worker_gateway_rate_windows),'duplicates/denials/status/failures all consume persisted admission counters');
update ops.worker_gateway_rate_windows set minute_count=30,minute_start=date_trunc('minute',clock_timestamp());
set local session authorization n8n_writer;
select extensions.is(pg_temp.gateway_admit(12)->>'code','rate_limited','thirty-per-minute limit enforced');
reset session authorization;
update ops.worker_gateway_rate_windows set minute_start=date_trunc('minute',clock_timestamp())-interval '1 minute';
set local session authorization n8n_writer;
select extensions.is(pg_temp.gateway_admit(12,'request.status','{"targetRequestId":"40000000-0000-4000-8000-000000000001"}')->>'state','admitted','next minute starts new bounded bucket');
reset session authorization;
update ops.worker_gateway_rate_windows set day_count=500,day_start=(clock_timestamp() at time zone 'Africa/Cairo')::date;
set local session authorization n8n_writer;
select extensions.is(pg_temp.gateway_admit(13)->>'code','rate_limited','five-hundred-per-day limit enforced');
reset session authorization;
update ops.worker_gateway_rate_windows set day_count=0,admitted_count=100;
set local session authorization n8n_writer;
select extensions.is(pg_temp.gateway_admit(13)->>'code','request_limit','one hundred trial calls cannot be replenished');
select extensions.is(pg_temp.gateway_admit(14,'identity.read','{}','close')->>'state','closed','safety close succeeds even with exhausted budget');
select extensions.is((pg_temp.gateway_admit(14,'identity.read','{}','close')#>>'{window,totalAdmitted}')::int,100,'repeated close never increments counter101');
select extensions.is(pg_temp.gateway_admit(15)->>'code','window_closed','closed window cannot reopen');
select extensions.is(pg_temp.gateway_execute(1)->>'state','closed','old execution route cannot bypass persistent closure');
select extensions.is(pg_temp.gateway_status(1)->>'state','closed','old status route cannot bypass persistent closure');
reset session authorization;
select extensions.is((select close_count from ops.worker_gateway_rate_windows),1,'durable explicit close recorded exactly once');
-- Isolate the wall-clock expiry boundary inside rollback; not a public reset.
update ops.worker_gateway_rate_windows set admitted_count=0,closed_at=null,close_count=0,
  starts_at=statement_timestamp()-interval '31 minutes',expires_at=statement_timestamp()-interval '1 minute';
set local session authorization n8n_writer;
select extensions.is(pg_temp.gateway_admit(16)->>'code','window_expired','expired window rejected');
reset session authorization;
select extensions.ok((select closed_at is not null from ops.worker_gateway_rate_windows),'expiry persists closure on next admission');
select * from extensions.finish();
rollback;
