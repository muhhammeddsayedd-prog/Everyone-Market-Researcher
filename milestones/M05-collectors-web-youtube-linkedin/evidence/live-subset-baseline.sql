-- Public read-only identity, ownership and account-selection receipt. No fixtures
-- or settings are changed. The bounded owner child provides BEGIN/READ ONLY.
with selected as (
 select a.*,c.company_code,c.status as competitor_status from app.competitor_accounts a
 join app.competitors c on c.id=a.competitor_id
 where a.id in (
  'df405b78-eb07-4347-af97-6b62522bab8f','3dbf4ea2-3eae-4369-89cb-85df8fcd2e03',
  '21e51070-6857-4dbd-873d-3a9feba72831','22db994a-8b44-4a57-996a-60c80cd7a640',
  '258f2013-1ca6-4794-830c-6f49efbea0b2'))
select jsonb_build_object(
 'current_user',current_user,'session_user',session_user,'database',current_database(),
 'accounts',(select jsonb_agg(to_jsonb(s) order by s.platform,s.company_code) from selected s),
 'selectedLiveClaims',(select count(*) from selected where locked_until is not null),
 'selectedRunningParents',(select count(distinct r.id) from ops.scrape_runs r
   join ops.collector_accounts a on a.run_id=r.id join selected s on s.id=a.account_id where r.status='running'),
 'selectedUnprocessedActors',(select count(*) from ops.apify_runs a where a.processed_at is null and a.account_ids && array(select id from selected)),
 'globalCounts',jsonb_build_object('items',(select count(*) from app.items),'raw',(select count(*) from ingest.raw_items),
   'competitors',(select count(*) from app.competitors),'accounts',(select count(*) from app.competitor_accounts),
   'costEntries',(select count(*) from ops.cost_ledger),'employeeSnapshots',(select count(*) from app.employee_snapshots)),
 'selectedCounts',(select coalesce(jsonb_agg(jsonb_build_object('account_id',s.id,'items',(select count(*) from app.items i where i.account_id=s.id),'raw',(select count(*) from ingest.raw_items i where i.account_id=s.id))),'[]'::jsonb) from selected s),
 'priceBook',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from ops.price_book p where provider in ('youtube','apify','firecrawl'))
) as m05_subset;
