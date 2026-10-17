-- Read-only local acceptance inventory. No credentials or user records selected.
select jsonb_build_object(
  'postgres_version',current_setting('server_version'),
  'tables',(select jsonb_object_agg(s,n) from
    (select schemaname s,count(*) n from pg_tables where schemaname in ('app','ingest','ops') group by 1) counts),
  'tables_without_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('app','ingest','ops') and c.relkind='r' and not c.relrowsecurity),
  'views_without_invoker',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('app','api') and c.relkind='v' and not coalesce(c.reloptions @> array['security_invoker=true'],false)),
  'app_definers',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.prosecdef),
  'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'taxonomies',(select jsonb_object_agg(t,n) from (select taxonomy t,count(*) n from app.taxonomy_terms group by 1) counts),
  'settings',(select count(*) from ops.settings),
  'price_placeholders',(select count(*) from ops.price_book),
  'owner_invite_present',exists(select 1 from app.member_invites where email='mohamed.abdelrahman@everyone.film' and role='admin'),
  'domain_autojoin_entries',(select count(*) from app.allowed_domains),
  'local_fake_competitors',(select count(*) from app.competitors),
  'local_fake_accounts',(select count(*) from app.competitor_accounts),
  'local_fake_items',(select count(*) from app.items),
  'queues',(select jsonb_agg(queue_name order by queue_name) from pgmq.list_queues()),
  'cron_jobs',(select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active) order by jobname)
    from cron.job where jobname like 'emr-%'),
  'media_bucket',(select jsonb_build_object('public',public,'limit',file_size_limit,'mimes',allowed_mime_types) from storage.buckets where id='media'),
  'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'inherit',rolinherit,'bypass_rls',rolbypassrls) order by rolname)
    from pg_roles where rolname in ('n8n_writer','api_agent'))
) as inventory;
