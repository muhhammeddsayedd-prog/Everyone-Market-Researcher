begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

select has_schema('app');
select has_schema('ingest');
select has_schema('ops');
select has_schema('api');
select has_schema('private');
select has_role('n8n_writer');
select has_role('api_agent');
select ok((select rolcanlogin and not rolbypassrls and not rolsuper and not rolcreaterole
  and not rolcreatedb from pg_roles where rolname = 'n8n_writer'), 'writer is a bounded login role');
select ok((select rolcanlogin and not rolbypassrls and not rolsuper and not rolcreaterole
  and not rolcreatedb from pg_roles where rolname = 'api_agent'), 'agent is a bounded login role');
select is((select count(*)::int from pg_tables where schemaname = 'app'), 25, '25 app tables');
select is((select count(*)::int from pg_tables where schemaname = 'ingest'), 1, 'one ingest table');
select is((select count(*)::int from pg_tables where schemaname = 'ops'), 35, '35 ops tables including private M06 campaign and replay-safe M07 extraction tables');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('app','ingest','ops') and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every project table has RLS');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('app','api') and c.relkind = 'v'
    and not coalesce(c.reloptions @> array['security_invoker=true'], false)),
  0, 'every app and API view uses caller RLS');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.prosecdef), 0, 'no definer function in exposed app schema');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('private','ops','ingest','api') and p.prosecdef
    and (not coalesce(p.proconfig @> array['search_path=""'], false)
      or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'))),
  0, 'all definers have an empty search path and no PUBLIC execution');
select is((select count(*)::int from pg_constraint fk
  join pg_class c on c.oid = fk.conrelid join pg_namespace n on n.oid = c.relnamespace
  where fk.contype = 'f' and n.nspname in ('app','ingest','ops') and not exists (
    select 1 from pg_index i where i.indrelid = fk.conrelid and i.indisvalid
      and i.indpred is null and i.indkey::smallint[] @> fk.conkey
      and (i.indkey::smallint[])[0:cardinality(fk.conkey)-1] @> fk.conkey)),
  0, 'every foreign key has a usable leading-column index');
select is((select count(*)::int from pg_tables t cross join (values ('n8n_writer'),('api_agent')) r(name)
  where t.schemaname in ('app','ingest','ops')
    and has_table_privilege(r.name, format('%I.%I', t.schemaname, t.tablename),
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')), 0, 'machines have no direct write grants');
select ok(not has_schema_privilege('anon','app','USAGE')
  and not has_schema_privilege('authenticated','app','CREATE'), 'clients cannot create app objects; anon has no usage');
select is((select count(*)::int from pg_roles where rolname in ('n8n_writer','api_agent') and rolinherit),
  0, 'machine roles do not inherit privileges');
select ok((select coalesce(array_to_string(rolconfig, ',') like '%search_path=""%', false)
  from pg_roles where rolname = 'n8n_writer') and
  (select coalesce(array_to_string(rolconfig, ',') like '%search_path=""%', false)
  from pg_roles where rolname = 'api_agent'), 'machine login search paths are empty');

select * from finish();
rollback;
