-- One configured dev identity, attested by the already-owned company-post
-- dataset: registered query everyonefilms + company author universalName
-- everyonefilms + author.companyId94868239. The employee dataset uses that
-- exact numeric company URL. No fuzzy name match or new source capture.
-- Proof: live-subset-company-id-observation-20261028.json.
do $identity$
declare a app.competitor_accounts%rowtype;
begin
 select * into a from app.competitor_accounts
 where id='258f2013-1ca6-4794-830c-6f49efbea0b2' for update;
 if not found or a.competitor_id<>'94928d31-8983-403c-bdbd-f5f44613d631'
   or a.platform<>'linkedin_employees' or a.handle<>'everyonefilms'
   or a.url<>'https://www.linkedin.com/company/everyonefilms/'
   or a.status not in ('active','failing') or a.locked_until is not null
   or (a.external_id is not null and a.external_id<>'94868239') then
  raise exception using errcode='42501',message='exact unclaimed dev company identity required';
 end if;
 if exists(select 1 from ops.apify_runs x where a.id=any(x.account_ids) and x.processed_at is null)
   or exists(select 1 from ops.collector_accounts c join ops.scrape_runs r on r.id=c.run_id
    where c.account_id=a.id and r.status='running')
   or not exists(select 1 from ops.apify_runs x join ops.collector_launches l on l.apify_run_id=x.apify_run_id
     where x.apify_run_id='VTAMD1cHlRUaIzYvg' and x.actor_id='harvestapi/linkedin-company-posts'
       and x.status='SUCCEEDED' and x.processed_at is not null
       and l.approval_id='a946c93c-1bf4-4d1d-82c5-ccbe2a44b3c1'
       and '21e51070-6857-4dbd-873d-3a9feba72831'::uuid=any(x.account_ids)) then
  raise exception using errcode='42501',message='verified terminal source and dev quiescence required';
 end if;
 update app.competitor_accounts set external_id='94868239',resolve_status='resolved',updated_at=clock_timestamp()
 where id=a.id and (external_id is distinct from '94868239' or resolve_status<>'resolved');
end $identity$;
select jsonb_build_object('account_id',id,'platform',platform,'external_id',external_id,
 'resolve_status',resolve_status,'collectedDataModified',false,'watermarkPreserved',last_item_published_at,
 'backfill_status',backfill_status) as resolved_company
from app.competitor_accounts where id='258f2013-1ca6-4794-830c-6f49efbea0b2';
