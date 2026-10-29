-- Read-only hosted catalog matrix; no generated container, data rows or secrets.
-- Field/name coverage complements accepted local21 type qualification; it does
-- not claim complete hosted TypeScript regeneration or scalar type equivalence.
begin read only;
set local statement_timeout='25s';
set local lock_timeout='2s';
select jsonb_build_object(
 'version',1,'observed_at',clock_timestamp(),
 'identity',jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database()),
 'schemas',jsonb_build_array('api','app','ingest','ops'),
 'relations',(select coalesce(jsonb_agg(jsonb_build_object(
   'schema',n.nspname,'name',c.relname,'section',case when c.relkind in ('v','m') then 'Views' else 'Tables' end,
   'columns',(select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
     'nullable',not a.attnotnull) order by a.attname),'[]'::jsonb)
     from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)
   ) order by n.nspname,c.relname),'[]'::jsonb)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('app','api','ops','ingest') and c.relkind in ('r','p','f','v','m')),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object(
   'schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),
   'input_argument_names',(select coalesce(jsonb_agg(a.name order by a.name),'[]'::jsonb)
     from unnest(p.proargnames) with ordinality a(name,ordinality)
     where coalesce(p.proargmodes[a.ordinality],'i') in ('i','b','v')),
   'returns',format_type(p.prorettype,null),'returns_set',p.proretset,
   'service_role_execute',has_function_privilege('service_role',p.oid,'EXECUTE')
   ) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('app','api','ops','ingest') and p.prokind='f'
     and p.prorettype not in ('pg_catalog.trigger'::regtype,'pg_catalog.event_trigger'::regtype))
) as m06_type_coverage;
commit;
