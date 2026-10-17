begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);
-- PostgreSQL 17 CREATEROLE does not itself permit SET ROLE. This membership is
-- scoped to the rolled-back test transaction and confers no inherited grants.
grant api_agent to postgres with inherit false, set true;

insert into app.competitors(id,company_code,slug,name,priority_tier) values
  ('30000000-0000-0000-0000-000000000001','M01-API','m01-api','API fixture','pilot');
set local role api_agent;
select ok((select count(*) > 0 from api.competitors_v),'agent reads the competitors invoker view');
select throws_ok($$insert into app.items(id) values (gen_random_uuid())$$,'42501',null,'agent has no direct item writes');
select throws_ok($$update app.items set title = 'tampered'$$,'42501',null,'agent cannot update items');
select throws_ok($$delete from app.items$$,'42501',null,'agent cannot delete items');
select throws_ok($$select * from ops.cost_ledger$$,'42501',null,'agent cannot access cost ledger');
select throws_ok($$select * from ingest.raw_items$$,'42501',null,'agent cannot access raw source payloads');
select throws_ok($$select * from app.members$$,'42501',null,'agent cannot access membership PII');
select throws_ok($$select private.require_api_scope('write')$$,'42501',null,'missing scope is denied');
select set_config('app.api_scope','read',true);
select throws_ok($$select private.require_api_scope('write')$$,'42501',null,'read scope does not permit writes');
select set_config('app.api_scope','read,write',true);
select lives_ok($$select private.require_api_scope('write')$$,'trusted transaction context can authorize write scope');

select * from finish();
rollback;
