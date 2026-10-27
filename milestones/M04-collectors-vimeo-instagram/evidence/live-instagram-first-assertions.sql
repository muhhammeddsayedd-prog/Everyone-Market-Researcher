-- Read-only public metadata. Bind only recorded owned parent UUIDs and the
-- one actual M04 approval UUID before use. No raw payload/message contents.
with parents as (
  select x::uuid id from jsonb_array_elements_text($m04_parents$["f77352da-6efb-4d33-bacb-2e2f8826dd37","d0c86952-df68-48ff-8f41-132500e2e90b"]$m04_parents$::jsonb) x
), selected as (
  select * from app.competitor_accounts where id in (
    '985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79',
    '962c9c7e-aa0f-46ae-911b-3265859e0577','bed82782-753f-4ba9-91ca-691ef36f75c6')
), items as (
  select i.id,i.account_id,i.platform,i.external_id,i.status,i.ai_status,i.duplicate_of,i.created_at,i.last_extraction_id
  from app.items i where i.account_id in (select id from selected)
)
select jsonb_build_object(
  'accounts',(select jsonb_agg(to_jsonb(a) order by a.id) from selected a),
  'runs',(select coalesce(jsonb_agg(to_jsonb(r) order by r.started_at),'[]'::jsonb)
    from ops.scrape_runs r where r.id in (select id from parents) and r.env='dev' and r.workflow in ('WF-10','WF-11')),
  'accountResults',(select coalesce(jsonb_agg(to_jsonb(a) order by a.run_id,a.account_id),'[]'::jsonb)
    from ops.scrape_run_accounts a where a.run_id in (select id from parents)),
  'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) from items i),
  'rawItems',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'platform',r.platform,'external_id',r.external_id,
    'account_id',r.account_id,'run_id',r.run_id,'actor',r.actor,'fetched_at',r.fetched_at) order by r.id),'[]'::jsonb)
    from ingest.raw_items r where r.account_id in (select id from selected)),
  'costs',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'provider',c.provider,'category',c.category,
    'quantity',c.quantity,'unit',c.unit,'cost_usd',c.cost_usd,'run_id',c.run_id,'platform',c.platform,
    'cost_key',c.meta->>'cost_key','apify_run_id',c.meta->>'apify_run_id') order by c.id),'[]'::jsonb)
    from ops.cost_ledger c where c.run_id in (select id from parents)),
  'actorRuns',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',r.apify_run_id,'actor_id',r.actor_id,
    'run_id',r.run_id,'account_ids',r.account_ids,'purpose',r.purpose,'status',r.status,'dataset_id',r.dataset_id,
    'usage_usd',r.usage_usd,'started_at',r.started_at,'finished_at',r.finished_at,'processed_at',r.processed_at)
    order by r.started_at),'[]'::jsonb) from ops.apify_runs r where r.run_id in (select id from parents)),
  'launches',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at),'[]'::jsonb)
    from ops.collector_launches l where l.approval_id='3f3aed72-4f14-4cc4-aefe-4999038efe27'::uuid),
  'aiQueueCounts',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'count',
    (select count(*) from pgmq.q_ai_extract q where q.message->>'item_id'=i.id::text)) order by i.id),'[]'::jsonb) from items i),
  'mediaQueueCounts',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'count',
    (select count(*) from pgmq.q_media q where q.message->>'item_id'=i.id::text)) order by i.id),'[]'::jsonb) from items i),
  'duplicateExternalIds',(select count(*) from (select platform,external_id from items group by platform,external_id having count(*)>1) d),
  'selectedLiveClaims',(select count(*) from selected where locked_until>clock_timestamp()),
  'selectedUnprocessedActors',(select count(*) from ops.apify_runs r where r.processed_at is null
    and exists(select 1 from selected a where a.id=any(r.account_ids)))
) as collector_assertions;
