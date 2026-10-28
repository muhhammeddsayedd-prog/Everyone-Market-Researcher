-- Restricted public-source readback; excludes employee identities and INPUT/data.
-- Native execution IDs and returned launch/allocation IDs are correlated with
-- the coordinator's actual actions; this query alone is not an ownership claim.
with selected as (
 select a.*,c.company_code from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
 where a.id in ('df405b78-eb07-4347-af97-6b62522bab8f','3dbf4ea2-3eae-4369-89cb-85df8fcd2e03',
  '21e51070-6857-4dbd-873d-3a9feba72831','22db994a-8b44-4a57-996a-60c80cd7a640','258f2013-1ca6-4794-830c-6f49efbea0b2')),
 runs as (select r.* from ops.scrape_runs r where r.env='dev' and r.workflow in ('WF-13','WF-18','WF-18b')
  and r.started_at >= '2026-10-28T16:22:04Z'),
 launches as (select l.* from ops.collector_launches l join runs r on r.id=l.run_id),
 actors as (select a.* from ops.apify_runs a join runs r on r.id=a.run_id),
 costs as (select c.* from ops.cost_ledger c join runs r on r.id=c.run_id)
select jsonb_build_object(
 'current_user',current_user,'session_user',session_user,'database',current_database(),
 'accounts',(select jsonb_agg(to_jsonb(s) order by s.platform,s.company_code) from selected s),
 'runs',(select coalesce(jsonb_agg(to_jsonb(r) order by r.started_at),'[]'::jsonb) from runs r),
 'registration',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from ops.collector_runs c join runs r on r.id=c.run_id),
 'results',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from ops.scrape_run_accounts c join runs r on r.id=c.run_id),
 'launches',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at),'[]'::jsonb) from launches l),
 'actorRuns',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',a.apify_run_id,'actor_id',a.actor_id,
   'run_id',a.run_id,'account_ids',a.account_ids,'status',a.status,'dataset_id',a.dataset_id,
   'usage_usd',a.usage_usd,'processed_at',a.processed_at,'finished_at',a.finished_at)),'[]'::jsonb) from actors a),
 'jobs',(select coalesce(jsonb_agg(jsonb_build_object('launch_id',m.launch_id,'settled',m.settled,'retry_pending',m.retry_pending,
   'retry_of',m.retry_of,'snapshot_date',m.snapshot_date,'result',m.result)),'[]'::jsonb) from ops.m05_jobs m join launches l using(launch_id)),
 'costs',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb) from costs c),
 'totals',jsonb_build_object('items',(select count(*) from app.items),'raw',(select count(*) from ingest.raw_items),
   'costEntries',(select count(*) from ops.cost_ledger),'costUsd',(select coalesce(sum(cost_usd),0) from costs),
   'actorUsageUsd',(select coalesce(sum(usage_usd),0) from actors),
   'selectedLiveClaims',(select count(*) from selected where locked_until is not null),
   'runningParents',(select count(*) from runs where status='running'),
   'unprocessedActors',(select count(*) from actors where processed_at is null),
   'unregisteredStarts',(select count(*) from launches where apify_run_id is null)),
 'selectedCounts',(select jsonb_agg(jsonb_build_object('account_id',s.id,'items',(select count(*) from app.items i where i.account_id=s.id),
   'raw',(select count(*) from ingest.raw_items i where i.account_id=s.id))) from selected s),
 'snapshots',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'account_id',e.account_id,'snapshot_date',e.snapshot_date,
   'headcount_listed',e.headcount_listed,'peopleCount',jsonb_array_length(e.people),'joinedCount',jsonb_array_length(e.joined),
   'leftCount',jsonb_array_length(e.left_company),'coverage',e.coverage)),'[]'::jsonb) from app.employee_snapshots e
   join selected s on s.id=e.account_id),
 'quota',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from ops.m05_quota q),
 'queueCounts',jsonb_build_object('ai_extract',(select count(*) from pgmq.q_ai_extract),
   'embed',(select count(*) from pgmq.q_embed),'media',(select count(*) from pgmq.q_media))
) as m05_subset;
