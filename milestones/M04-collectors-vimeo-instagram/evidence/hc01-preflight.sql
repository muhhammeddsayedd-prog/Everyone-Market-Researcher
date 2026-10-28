-- Read-only exact incremental catalog binding; no account or schema mutation.
with selectors(key,company_code,platform,handle,url) as (values ('C000:vimeo:0','C000','vimeo','everyonefilms','https://vimeo.com/everyonefilms'),
('C001:vimeo:0','C001','vimeo','goodpeoplefilms','https://vimeo.com/goodpeoplefilms'),
('C130:vimeo:0','C130','vimeo','bigfootfilmseg','https://vimeo.com/bigfootfilmseg'),
('C270:vimeo:0','C270','vimeo','thetalkiesproductionsleb','https://vimeo.com/thetalkiesproductionsleb'),
('C226:vimeo:0','C226','vimeo','bigkahunafilms','https://vimeo.com/bigkahunafilms'),
('C000:instagram:0','C000','instagram','everyone.film','https://www.instagram.com/everyone.film/'),
('C001:instagram:0','C001','instagram','goodpeoplefilms','https://www.instagram.com/goodpeoplefilms/'),
('C130:instagram:0','C130','instagram','bigfootfilms','https://www.instagram.com/bigfootfilms/'),
('C270:instagram:0','C270','instagram','thetalkies','https://www.instagram.com/thetalkies/'),
('C226:instagram:0','C226','instagram','bigkahunafilms','https://www.instagram.com/bigkahunafilms/')),
matched as (select s.key,s.company_code,c.status as competitor_status,a.*
 from selectors s join app.competitors c on c.company_code=s.company_code
 join app.competitor_accounts a on a.competitor_id=c.id and a.platform::text=s.platform
 and a.handle_norm=s.handle and a.url=s.url)
select jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database(),
 'migrations',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'historySha256',
   encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex')) order by version),'[]'::jsonb)
   from supabase_migrations.schema_migrations),
 'selectorCounts',(select jsonb_agg(jsonb_build_object('key',s.key,'count',(select count(*) from matched m where m.key=s.key)) order by s.key) from selectors s),
 'accounts',(select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object(
   'account',to_jsonb(m)-'key'-'company_code'-'competitor_status') order by m.key),'[]'::jsonb) from matched m),
 'selectedCount',(select count(*) from matched),
 'selectedLiveClaims',(select count(*) from matched where locked_until>clock_timestamp()),
 'selectedRunningParents',(select coalesce(jsonb_agg(jsonb_build_object('run_id',r.id,'workflow',r.workflow,'execution_id',r.n8n_execution_id)),'[]'::jsonb)
   from ops.scrape_runs r where r.status='running' and exists(select 1 from matched m where m.last_run_id=r.id)),
 'selectedUnprocessedActors',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',r.apify_run_id,'run_id',r.run_id,'status',r.status)),'[]'::jsonb)
   from ops.apify_runs r where r.processed_at is null and exists(select 1 from matched m where m.id=any(r.account_ids))),
 'priceBook',(select coalesce(jsonb_agg(to_jsonb(p) order by p.provider,p.sku,p.valid_from),'[]'::jsonb) from ops.price_book p
   where p.provider='vimeo' or (p.provider='apify' and (p.sku like 'apify/instagram-scraper:%' or p.sku like 'goat255/vimeo-scraper%'))),
 'globalUnfinished',jsonb_build_object('liveClaims',(select count(*) from app.competitor_accounts where locked_until>clock_timestamp()),
   'runningParents',(select count(*) from ops.scrape_runs where status='running'),
   'unprocessedActors',(select count(*) from ops.apify_runs where processed_at is null)),
 'm04ProductTablesPresent',to_regclass('ops.collector_runs') is not null and to_regclass('ops.collector_accounts') is not null and to_regclass('ops.collector_passes') is not null and to_regclass('ops.collector_launches') is not null,
 'baseline',jsonb_build_object('competitors',(select count(*) from app.competitors),'accounts',(select count(*) from app.competitor_accounts),
   'items',(select count(*) from app.items),'rawItems',(select count(*) from ingest.raw_items),
   'costRows',(select count(*) from ops.cost_ledger),'costUsd',(select coalesce(sum(cost_usd),0) from ops.cost_ledger))) as incremental_preflight;
