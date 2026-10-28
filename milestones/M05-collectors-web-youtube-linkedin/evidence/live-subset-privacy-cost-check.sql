-- Bounded actual-data assertions. Emit counts/booleans, never employee values.
with selected as (
 select id from app.competitor_accounts where id in (
  'df405b78-eb07-4347-af97-6b62522bab8f','3dbf4ea2-3eae-4369-89cb-85df8fcd2e03',
  '21e51070-6857-4dbd-873d-3a9feba72831','22db994a-8b44-4a57-996a-60c80cd7a640',
  '258f2013-1ca6-4794-830c-6f49efbea0b2')),
 runs as (select * from ops.scrape_runs where env='dev'
  and workflow in ('WF-13','WF-18','WF-18b') and started_at>='2026-10-28T16:22:04Z'),
 actors as (select a.* from ops.apify_runs a join runs r on r.id=a.run_id),
 snapshots as (select e.* from app.employee_snapshots e join selected s on s.id=e.account_id)
select jsonb_build_object(
 'employeeSnapshotCount',(select count(*) from snapshots),
 'employeeProjectionViolations',(select count(*) from snapshots e cross join lateral jsonb_array_elements(e.people) p
   where jsonb_typeof(p)<>'object' or not(p ?& array['public_id','name','title','location'])
    or exists(select 1 from jsonb_object_keys(p) k where k not in ('public_id','name','title','location'))),
 'employeeUnsupportedCompleteClaims',(select count(*) from snapshots where coverage->>'complete' is distinct from 'false'),
 'employeeUnprovedMembershipChanges',(select count(*) from snapshots where joined<>'[]'::jsonb or left_company<>'[]'::jsonb),
 'parentCostMismatches',(select count(*) from runs r where r.cost_usd is distinct from
   (select coalesce(sum(c.cost_usd),0) from ops.cost_ledger c where c.run_id=r.id)),
 'actorCostMismatches',(select count(*) from actors a where a.processed_at is not null and
   a.usage_usd is distinct from (select coalesce(sum(c.cost_usd),0) from ops.cost_ledger c
     where c.run_id=a.run_id and c.meta->>'cost_key' like 'apify:'||a.apify_run_id||':%')),
 'duplicateActorAccountCostKeys',(select count(*) from (select c.meta->>'cost_key' from ops.cost_ledger c join runs r on r.id=c.run_id
   group by c.meta->>'cost_key' having count(*)>1) d),
 'unfinishedParents',(select count(*) from runs where status='running'),
 'unfinishedActorReceipts',(select count(*) from actors where processed_at is null),
 'openRegistrations',(select count(*) from ops.collector_runs c join runs r on r.id=c.run_id where not c.registration_closed),
 'unfinishedJobs',(select count(*) from ops.m05_jobs j join ops.collector_launches l using(launch_id) join runs r on r.id=l.run_id
   where not j.settled or j.retry_pending),
 'selectedClaims',(select count(*) from app.competitor_accounts a join selected s using(id) where a.locked_until is not null),
 'websiteActorStarts',(select count(*) from ops.collector_launches where approval_id='a946c93c-1bf4-4d1d-82c5-ccbe2a44b3c1'
   and actor_id='apify/website-content-crawler'),
 'appliedMigrations',(select count(*) from supabase_migrations.schema_migrations),
 'actorStarts',(select count(*) from actors),
 'actorUsageUsd',(select coalesce(sum(usage_usd),0) from actors),
 'recordedRunCostUsd',(select coalesce(sum(cost_usd),0) from runs)
) as m05_integrity;
