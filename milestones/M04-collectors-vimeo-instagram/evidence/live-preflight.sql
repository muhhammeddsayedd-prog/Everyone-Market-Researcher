-- Read-only M04 dev identity/history/account snapshot. Public metadata only;
-- no payloads, saved credentials, other project queries or state changes.
with selected as (
  select a.*, c.company_code, c.slug as competitor_slug,
    c.status as competitor_status
  from app.competitor_accounts a
  join app.competitors c on c.id=a.competitor_id
  where (c.company_code='C000' and a.platform='vimeo' and lower(a.handle)='everyonefilms')
    or (c.company_code='C001' and a.platform='vimeo' and lower(a.handle)='goodpeoplefilms')
    or (c.company_code='C000' and a.platform='instagram' and lower(a.handle)='everyone.film')
    or (c.company_code='C001' and a.platform='instagram' and lower(a.handle)='goodpeoplefilms')
)
select jsonb_build_object(
  'current_user',current_user,'session_user',session_user,
  'database',current_database(),
  'migrations',(select coalesce(jsonb_agg(jsonb_build_object(
    'version',version,'name',name,
    'historySha256',encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex'))
    order by version),'[]'::jsonb) from supabase_migrations.schema_migrations),
  'selectedCount',(select count(*) from selected),
  'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.company_code,a.platform),'[]'::jsonb) from selected a),
  'selectedLiveClaims',(select count(*) from selected a where a.locked_until>clock_timestamp()),
  'selectedRunningParents',(select coalesce(jsonb_agg(jsonb_build_object(
    'run_id',r.id,'workflow',r.workflow,'platform',r.platform,'env',r.env,
    'execution_id',r.n8n_execution_id,'started_at',r.started_at)),'[]'::jsonb)
    from ops.scrape_runs r where r.status='running' and exists(
      select 1 from selected a where a.last_run_id=r.id)),
  'selectedUnprocessedActors',(select coalesce(jsonb_agg(jsonb_build_object(
    'apify_run_id',r.apify_run_id,'run_id',r.run_id,'actor_id',r.actor_id,
    'status',r.status,'account_ids',r.account_ids,'started_at',r.started_at)),'[]'::jsonb)
    from ops.apify_runs r where r.processed_at is null and exists(
      select 1 from selected a where a.id=any(r.account_ids))),
  'priceBook',(select coalesce(jsonb_agg(to_jsonb(p) order by p.provider,p.sku,p.valid_from),'[]'::jsonb)
    from ops.price_book p where p.provider='vimeo'
      or (p.provider='apify' and p.sku like 'apify/instagram-scraper:%')),
  'baseline',jsonb_build_object(
    'competitors',(select count(*) from app.competitors),
    'accounts',(select count(*) from app.competitor_accounts),
    'items',(select count(*) from app.items),
    'rawItems',(select count(*) from ingest.raw_items),
    'costRows',(select count(*) from ops.cost_ledger),
    'costUsd',(select coalesce(sum(cost_usd),0) from ops.cost_ledger),
    'selectedItems',(select count(*) from app.items i where i.account_id in (select id from selected))),
  'm04ProductTablesPresent',to_regclass('ops.collector_runs') is not null
) as receipt;
