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

-- Read-only owned parent, account, metrics, queue and actual-cost projection.
with parents as (select r.id run_id,r.n8n_execution_id execution_id from ops.scrape_runs r
 where r.env='dev' and r.workflow in ('WF-10','WF-11') and r.started_at>='2026-10-27T15:24:25.740Z'::timestamptz
 and (exists(select 1 from ops.collector_launches l where l.run_id=r.id and l.approval_id='123e88b6-5920-4e54-832a-ad6d87c22675'::uuid)
 or (r.workflow='WF-10' and exists(select 1 from ops.collector_accounts ca where ca.run_id=r.id)
 and not exists(select 1 from ops.collector_accounts ca where ca.run_id=r.id and ca.account_id not in
 (select x::uuid from jsonb_array_elements_text($m04_cb3a133d7a7289a3$["985a57dd-7934-422d-9d18-4e8ca59fc197","8fefa9a1-3637-43db-843d-97caa9afcc79","fda97004-0b26-40aa-baf5-d961277302fe","4cf4fd24-c266-4246-941f-c5f9c4e23c2d","85bc33c7-25b0-44e7-b7e7-037bd8343e84","962c9c7e-aa0f-46ae-911b-3265859e0577","bed82782-753f-4ba9-91ca-691ef36f75c6","46149fb9-8905-4b76-9834-4b38f668a2e2","2d42d451-ac9a-42ac-a879-8760d63c8108","3ca3befa-abe6-4540-a389-0cf16115c581"]$m04_cb3a133d7a7289a3$::jsonb) x))))),
selected as (select * from app.competitor_accounts where id in (select x::uuid from jsonb_array_elements_text($m04_cb3a133d7a7289a3$["985a57dd-7934-422d-9d18-4e8ca59fc197","8fefa9a1-3637-43db-843d-97caa9afcc79","fda97004-0b26-40aa-baf5-d961277302fe","4cf4fd24-c266-4246-941f-c5f9c4e23c2d","85bc33c7-25b0-44e7-b7e7-037bd8343e84","962c9c7e-aa0f-46ae-911b-3265859e0577","bed82782-753f-4ba9-91ca-691ef36f75c6","46149fb9-8905-4b76-9834-4b38f668a2e2","2d42d451-ac9a-42ac-a879-8760d63c8108","3ca3befa-abe6-4540-a389-0cf16115c581"]$m04_cb3a133d7a7289a3$::jsonb) x)),
items as (select i.id,i.account_id,i.platform,i.external_id,i.status,i.ai_status,i.duplicate_of,i.published_at,i.metrics,i.metrics_updated_at,i.locked_fields,i.last_extraction_id,i.created_at
 from app.items i where i.account_id in (select id from selected))
select jsonb_build_object('accounts',(select jsonb_agg(to_jsonb(a) order by a.id) from selected a),
 'runs',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('expected_execution_id',p.execution_id) order by r.started_at),'[]'::jsonb) from ops.scrape_runs r join parents p on p.run_id=r.id),
 'accountResults',(select coalesce(jsonb_agg(to_jsonb(a) order by a.run_id,a.account_id),'[]'::jsonb) from ops.scrape_run_accounts a where run_id in (select run_id from parents)),
 'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) from items i),
 'rawItems',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'account_id',r.account_id,'run_id',r.run_id,'actor',r.actor,'external_id',r.external_id,'fetched_at',r.fetched_at) order by r.id),'[]'::jsonb)
   from ingest.raw_items r where r.account_id in (select id from selected)),
 'costs',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'provider',c.provider,'quantity',c.quantity,'cost_usd',c.cost_usd,'run_id',c.run_id,'apify_run_id',c.meta->>'apify_run_id') order by c.id),'[]'::jsonb)
   from ops.cost_ledger c where c.run_id in (select run_id from parents)),
 'actorRuns',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',a.apify_run_id,'run_id',a.run_id,'actor_id',a.actor_id,'account_ids',a.account_ids,'status',a.status,'usage_usd',a.usage_usd,'processed_at',a.processed_at) order by a.apify_run_id),'[]'::jsonb)
   from ops.apify_runs a where a.run_id in (select run_id from parents)),
 'launches',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at),'[]'::jsonb) from ops.collector_launches l where l.approval_id='123e88b6-5920-4e54-832a-ad6d87c22675'::uuid),
 'passes',(select coalesce(jsonb_agg(to_jsonb(p) order by p.run_id,p.account_id,p.pass),'[]'::jsonb) from ops.collector_passes p where p.run_id in (select run_id from parents)),
 'collectorRuns',(select coalesce(jsonb_agg(to_jsonb(r) order by r.run_id),'[]'::jsonb) from ops.collector_runs r where r.run_id in (select run_id from parents)),
 'aiQueueCounts',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'count',(select count(*) from pgmq.q_ai_extract q where q.message->>'item_id'=i.id::text)) order by i.id),'[]'::jsonb) from items i),
 'mediaQueueCounts',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'count',(select count(*) from pgmq.q_media q where q.message->>'item_id'=i.id::text)) order by i.id),'[]'::jsonb) from items i),
 'duplicateExternalIds',(select count(*) from (select platform,external_id from items group by platform,external_id having count(*)>1) d),
 'selectedLiveClaims',(select count(*) from selected where locked_until is not null),
 'selectedRunningParents',(select count(*) from ops.scrape_runs r where r.id in (select run_id from parents) and r.status='running'),
 'selectedUnprocessedActors',(select count(*) from ops.apify_runs a where a.processed_at is null and exists(select 1 from selected s where s.id=any(a.account_ids)))) as incremental_assertions;

with owned as(select id from ops.scrape_runs where id in ('87b63677-ef54-49e9-a7f9-aa9a3778fa6a','5191b37f-e7e3-4567-acfe-91d81385d564','74fae456-a34c-4460-a5ea-6ab66ecec431','8fd7bed3-7915-4d87-92bb-d6a61aaca9c5','040b255f-2331-4c1b-95bc-ecbd40c74ee4')),
selected as(select a.id from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where c.company_code in ('C000','C001','C130','C226','C270') and a.platform in ('vimeo','instagram'))
select jsonb_build_object('costAllocation',(select jsonb_agg(jsonb_build_object('id',l.id,'company_code',c.company_code,'competitor_id',l.competitor_id,'platform',l.platform,'quantity',l.quantity,'unit',l.unit,'cost_usd',l.cost_usd,'actorRunId',l.meta->>'apify_run_id') order by l.id) from ops.cost_ledger l left join app.competitors c on c.id=l.competitor_id where l.run_id in(select id from owned)),
'sourceTypes',(select jsonb_agg(to_jsonb(t)) from(select platform,item_type,count(*) count,count(*) filter(where caption_original is not null) captions,count(*) filter(where cardinality(hashtags)>0) hashtags,count(*) filter(where cardinality(mentions)>0) mentions,count(*) filter(where cardinality(tagged_accounts)>0) tagged,count(*) filter(where duration_seconds is not null) durations,count(*) filter(where metrics<>'{}'::jsonb) metrics from app.items where account_id in(select id from selected) group by platform,item_type order by platform,item_type)t),
'pinnedExamples',(select count(*) from ingest.raw_items r where r.account_id in(select id from selected) and (r.payload->>'isPinned')='true'),
'errorAudits',(select jsonb_agg(jsonb_build_object('id',id,'workflow',entity_id,'execution_id',after->>'execution_id','message',after->>'message','created_at',created_at) order by id) from ops.audit_log where action='workflow_error' and entity_id='WF-19' and after->>'execution_id'='31166'),
'uncertainLaunches',(select count(*) from ops.collector_launches where approval_id='123e88b6-5920-4e54-832a-ad6d87c22675' and apify_run_id is null)) as incremental_source_cost_audit;
