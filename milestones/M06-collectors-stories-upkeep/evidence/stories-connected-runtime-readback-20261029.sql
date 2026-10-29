-- First connected M06 operation only. Reuse after settlement, valid replay,
-- unknown-run rejection and final shutdown; compare the invariants object.
-- No mutation, claim, ACK, lease, retry, provider request or Storage request.
-- All collected/media detail is scoped through the exact approved launch UUID.
-- Full-row invariants are digested inside SQL; no payload, source URL, token,
-- credential, arbitrary error text or raw audit JSON is returned.
-- History21 parity/migration22 hash use the existing common preflight separately.
begin read only;
set local statement_timeout='25s';
set local lock_timeout='2s';
with operation(approval_id) as (values('f42df40f-c325-4a3a-9f99-4da5616d95e3'::uuid)),
launches as materialized (
 select l.* from ops.collector_launches l join operation o using(approval_id)
), parents as materialized (
 select distinct r.* from ops.scrape_runs r join launches l on l.run_id=r.id
), accounts as materialized (
 select distinct a.* from app.competitor_accounts a where exists(select 1 from launches l where a.id=any(l.account_ids))
), actor_runs as materialized (
 select a.* from ops.apify_runs a join launches l using(apify_run_id)
), jobs as materialized (
 select j.* from ops.m06_story_jobs j join launches l using(launch_id)
), raw as materialized (
 select r.* from ingest.raw_items r join parents p on p.id=r.run_id where r.platform='instagram_stories'
), items as materialized (
 select distinct i.* from app.items i join raw r on r.platform=i.platform and r.external_id=i.external_id and r.account_id=i.account_id
), assets as materialized (
 select a.* from app.media_assets a join items i on i.id=a.item_id
), object_contracts as materialized (
 select o.id,o.bucket_id,o.name,o.version,o.created_at,o.updated_at,
   case when o.metadata->>'size' ~ '^[0-9]{1,15}$' then (o.metadata->>'size')::bigint end bytes,
   case when o.metadata->>'mimetype'='image/jpeg' then 'image/jpeg' end mime_type,
   case when trim(both '"' from o.metadata->>'eTag') ~ '^[A-Fa-f0-9-]{1,128}$'
     then trim(both '"' from o.metadata->>'eTag') end etag
 from storage.objects o where o.bucket_id='media' and exists(select 1 from assets a where a.storage_path=o.name)
), observations as materialized (
 select b.* from ops.bakeoff_observations b join actor_runs a using(apify_run_id)
), comparison as materialized (
 select b.* from ops.bakeoff_results b join actor_runs a using(apify_run_id)
), costs as materialized (
 select c.* from ops.cost_ledger c where c.provider='apify' and
   (c.run_id in(select id from parents) or c.meta->>'apify_run_id' in(select apify_run_id from actor_runs))
), deliveries as materialized (
 select 'queued'::text location,q.msg_id,q.read_ct,q.enqueued_at,q.vt,null::timestamptz archived_at,q.message->>'item_id' item_id
 from pgmq.q_media_stories q where q.message->>'item_id' in(select id::text from items)
 union all
 select 'archived',q.msg_id,q.read_ct,q.enqueued_at,q.vt,q.archived_at,q.message->>'item_id'
 from pgmq.a_media_stories q where q.message->>'item_id' in(select id::text from items)
), execution_ids as materialized (
 select distinct a.after->>'execution_id' execution_id from ops.audit_log a
 where a.action in ('story_media_message_claim','story_media_message_outcome','story_media_message_ack','story_media_message_held')
   and (a.entity_id in(select msg_id::text from deliveries) or a.after->>'item_id' in(select id::text from items))
 union
 select distinct split_part(a.entity_id,':',1) from ops.audit_log a
 where a.action='story_media_outcome' and a.after->>'item_id' in(select id::text from items)
), audits as materialized (
 select a.* from ops.audit_log a where
   (a.entity_type='story_media_batch' and a.action in ('story_media_batch_claim','story_media_batch_finish') and a.entity_id in(select execution_id from execution_ids))
   or (a.entity_type='story_media_batch_item' and a.action='story_media_outcome' and a.after->>'item_id' in(select id::text from items))
   or (a.entity_type='story_media_message' and a.action in ('story_media_message_claim','story_media_message_outcome','story_media_message_ack','story_media_message_held')
     and a.entity_id in(select msg_id::text from deliveries))
), audit_projection as (
 select a.id,a.action,a.entity_type,a.entity_id,a.created_at,
   case when a.entity_type='story_media_batch' then a.entity_id
     when a.entity_type='story_media_batch_item' then split_part(a.entity_id,':',1) else a.after->>'execution_id' end execution_id,
   coalesce(a.after->>'item_id',(select d.item_id from deliveries d where d.msg_id::text=a.entity_id limit 1)) item_id,
   case when a.after->>'outcome' in ('stored','skipped','media_expired','retryable','reconciliation_required') then a.after->>'outcome' end outcome,
   case when a.after->>'state' in ('completed','partial','reconciliation_required') then a.after->>'state' end state,
   case when jsonb_typeof(a.after->'bytes')='number' then a.after->'bytes' end bytes,
   case when jsonb_typeof(a.after->'claimed')='number' then a.after->'claimed' end claimed,
   case when jsonb_typeof(a.after->'processed')='number' then a.after->'processed' end processed,
   case when jsonb_typeof(a.after->'held')='number' then a.after->'held' end held,
   case when jsonb_typeof(a.after->'stored')='number' then a.after->'stored' end stored,
   case when jsonb_typeof(a.after->'skipped')='number' then a.after->'skipped' end skipped,
   case when jsonb_typeof(a.after->'expired')='number' then a.after->'expired' end expired,
   case when jsonb_typeof(a.after->'retryable')='number' then a.after->'retryable' end retryable,
   case when jsonb_typeof(a.after->'reconciliation_required')='number' then a.after->'reconciliation_required' end reconciliation_required,
   (select coalesce(jsonb_agg(x->>'msg_id' order by x->>'msg_id'),'[]') from jsonb_array_elements(coalesce(a.after->'messages','[]')) x
     where x->>'msg_id' in(select msg_id::text from deliveries)) claimed_owned_message_ids,
   case when a.action='story_media_batch_claim' then
     (select count(*) from jsonb_array_elements(a.after->'messages') x where x->>'msg_id' not in(select msg_id::text from deliveries)) end unowned_claimed_messages,
   (select coalesce(jsonb_agg(x order by x),'[]') from jsonb_array_elements_text(coalesce(a.after->'msg_ids','[]')) x
     where x in(select msg_id::text from deliveries)) outcome_owned_message_ids
 from audits a
), cost_projection as (
 select a.apify_run_id,a.actor_id,a.run_id,a.status,a.usage_usd,a.processed_at,
   cardinality(a.account_ids) expected_cost_rows,
   (select count(*) from costs c where c.meta->>'apify_run_id'=a.apify_run_id) cost_rows,
   (select coalesce(sum(c.cost_usd),0) from costs c where c.meta->>'apify_run_id'=a.apify_run_id) recorded_usd,
   a.processed_at is not null and a.usage_usd is not null and
     (select count(*) from costs c where c.meta->>'apify_run_id'=a.apify_run_id)=cardinality(a.account_ids) and
     not exists(select 1 from costs c where c.meta->>'apify_run_id'=a.apify_run_id and c.run_id is distinct from a.run_id) and
     (select coalesce(sum(c.cost_usd),0) from costs c where c.meta->>'apify_run_id'=a.apify_run_id)=a.usage_usd and
     not exists(select 1 from unnest(a.account_ids) account_id where
       (select count(*) from costs c where c.meta->>'apify_run_id'=a.apify_run_id and c.meta->>'account_id'=account_id::text
         and c.meta->>'cost_key'='apify:'||a.apify_run_id||':'||account_id::text)<>1) exact_measured_cost_once
 from actor_runs a
)
select jsonb_build_object(
 'version',1,'observed_at',clock_timestamp(),'approval_id',(select approval_id from operation),
 'identity',jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database()),
 'parents',(select coalesce(jsonb_agg(jsonb_build_object('run_id',p.id,'workflow',p.workflow,'environment',p.env,'mode',p.mode,
   'n8n_execution_id',p.n8n_execution_id,'status',p.status,'started_at',p.started_at,'finished_at',p.finished_at,
   'registration_closed',(select registration_closed from ops.collector_runs c where c.run_id=p.id)) order by p.id),'[]') from parents p),
 'launches',(select coalesce(jsonb_agg(jsonb_build_object('launch_id',l.launch_id,'run_id',l.run_id,'apify_run_id',l.apify_run_id,
   'actor_id',l.actor_id,'account_ids',l.account_ids,'pass',l.pass,'purpose',l.purpose,'results_limit',l.results_limit,
   'created_at',l.created_at,'max_actor_usd',l.max_actor_usd,'build_id',j.build_id,'memory_mbytes',j.memory_mbytes,'timeout_secs',j.timeout_secs,
   'collection_mode',j.collection_mode,'settled',j.settled) order by l.created_at,l.launch_id),'[]') from launches l join jobs j using(launch_id)),
 'actors',(select coalesce(jsonb_agg(to_jsonb(c) order by c.apify_run_id),'[]') from cost_projection c),
 'registration_requests',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',a.apify_run_id,
   'count',(select count(*) from ops.collector_requests r where r.operation='m06.register' and r.result->>'apify_run_id'=a.apify_run_id),
   'rows',(select coalesce(jsonb_agg(jsonb_build_object('request_id',r.request_id,'created_at',r.created_at) order by r.created_at,r.request_id),'[]')
     from ops.collector_requests r where r.operation='m06.register' and r.result->>'apify_run_id'=a.apify_run_id)) order by a.apify_run_id),'[]') from actor_runs a),
 'accounts',(select coalesce(jsonb_agg(jsonb_build_object('account_id',a.id,'competitor_id',a.competitor_id,'platform',a.platform,
   'handle',a.handle,'status',a.status,'cadence',a.cadence::text,'last_run_id',a.last_run_id,'locked_until',a.locked_until,'next_due_at',a.next_due_at,
   'last_success_at',a.last_success_at,'last_item_published_at',a.last_item_published_at,'last_external_id',a.last_external_id,
   'items_count',a.items_count,'backfill_status',a.backfill_status) order by a.id),'[]') from accounts a),
 'account_results',(select coalesce(jsonb_agg(jsonb_build_object('run_id',r.run_id,'account_id',r.account_id,'status',r.status,
   'items_seen',r.items_seen,'items_new',r.items_new) order by r.run_id,r.account_id),'[]') from ops.scrape_run_accounts r where r.run_id in(select id from parents)),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'account_id',i.account_id,'competitor_id',i.competitor_id,
   'platform',i.platform,'external_id',i.external_id,'status',i.status,'published_at',i.published_at,'first_seen_at',i.first_seen_at,
   'thumbnail_path',i.thumbnail_path,'thumbnail_locked','thumbnail_path'=any(i.locked_fields),'ai_status',i.ai_status,
   'asset_count',(select count(*) from assets a where a.item_id=i.id)) order by i.account_id,i.external_id),'[]') from items i),
 'media_assets',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',a.id,'item_id',a.item_id,'kind',a.kind,'storage_path',a.storage_path,
   'width',a.width,'height',a.height,'source_matches',a.source_url=i.thumbnail_source_url,'pointer_matches',a.storage_path=i.thumbnail_path,
   'owner_matches',a.competitor_id=i.competitor_id,'object',(select to_jsonb(o) from object_contracts o where o.name=a.storage_path))
   order by a.item_id,a.storage_path),'[]') from assets a join items i on i.id=a.item_id),
 'observations',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',o.apify_run_id,'account_id',o.account_id,'day',o.day,
   'actor',o.actor,'status',o.status,'login_prompt',o.login_prompt,'story_keys',o.story_keys,'observed_at',o.observed_at)
   order by o.apify_run_id,o.account_id),'[]') from observations o),
 'media_audits',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from audit_projection a),
 'story_delivery',(select coalesce(jsonb_agg(to_jsonb(d) order by d.msg_id,d.location),'[]') from deliveries d),
 'counts',jsonb_build_object('parents',(select count(*) from parents),'launches',(select count(*) from launches),
   'registered_actors',(select count(*) from actor_runs),'settled_jobs',(select count(*) from jobs where settled),
   'raw_items',(select count(*) from raw),'items',(select count(*) from items),'observations',(select count(*) from observations),
   'comparison_rows',(select count(*) from comparison),'media_assets',(select count(*) from assets),'storage_objects',(select count(*) from object_contracts),
   'story_queued_owned',(select count(*) from deliveries where location='queued'),'story_archived_owned',(select count(*) from deliveries where location='archived'),
   'story_queued_other',(select count(*) from pgmq.q_media_stories q where not exists(select 1 from items i where i.id::text=q.message->>'item_id')),
   'new_ai_messages',(select count(*) from pgmq.q_ai_extract q where q.message->>'item_id' in(select id::text from items)),
   'owned_embed_messages',(select count(*) from pgmq.q_embed q where q.message->>'item_id' in(select id::text from items)),
   'cost_rows',(select count(*) from costs),'recorded_actor_usd',(select coalesce(sum(cost_usd),0) from costs),
   'unattributed_actor_cost_rows',(select count(*) from costs c where not exists(select 1 from actor_runs a where
     c.meta->>'apify_run_id'=a.apify_run_id and c.run_id=a.run_id and c.meta->>'account_id'=any(array(select x::text from unnest(a.account_ids) x)))),
   'infrastructure_cost_usd',null),
 'quiescence',jsonb_build_object('running_parents',(select count(*) from parents where status='running'),
   'unregistered_launches',(select count(*) from launches where apify_run_id is null),'unsettled_jobs',(select count(*) from jobs where not settled),
   'unprocessed_actors',(select count(*) from actor_runs where processed_at is null),'live_account_claims',(select count(*) from accounts where locked_until>clock_timestamp()),
   'unfinished_media_batches',(select count(*) from audits a where a.action='story_media_batch_claim' and not exists(select 1 from audits f where f.action='story_media_batch_finish' and f.entity_id=a.entity_id)),
   'media_session_locks',(select count(*) from pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted),
   'active_m06_sessions',(select count(*) from pg_stat_activity where pid<>pg_backend_pid() and application_name in ('emr-m06-media-dev','emr-m06-collectors-dev') and state<>'idle')),
 'generic_media',jsonb_build_object('count',(select count(*) from pgmq.q_media),
   'identity_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(msg_id,message) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media),
   'delivery_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q)),
 -- Global counts/digests catch work outside the expected operation, including
 -- empty media children and a parent that stopped before allocating a launch.
 -- These are comparison evidence, not ownership or provider-terminal proof.
 'global',jsonb_build_object(
   'items',jsonb_build_object('count',(select count(*) from app.items),
     'sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]')::text,'sha256'),'hex') from app.items i)),
   'raw_items',jsonb_build_object('count',(select count(*) from ingest.raw_items),
     'sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]')::text,'sha256'),'hex') from ingest.raw_items r)),
   'cost_ledger',jsonb_build_object('count',(select count(*) from ops.cost_ledger),
     'usd',(select coalesce(sum(cost_usd),0) from ops.cost_ledger),
     'sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]')::text,'sha256'),'hex') from ops.cost_ledger c)),
   'registered_actors',jsonb_build_object('count',(select count(*) from ops.apify_runs),
     'sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(a) order by a.apify_run_id),'[]')::text,'sha256'),'hex') from ops.apify_runs a)),
   'story_registration_requests',jsonb_build_object('count',(select count(*) from ops.collector_requests where operation='m06.register'),
     'sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_object('request_id',r.request_id,'created_at',r.created_at,'result',r.result) order by r.request_id),'[]')::text,'sha256'),'hex')
       from ops.collector_requests r where r.operation='m06.register')),
   'media_audits',jsonb_build_object('count',(select count(*) from ops.audit_log where entity_type in ('media_batch','media_batch_item','media_message','story_media_batch','story_media_batch_item','story_media_message')),
     'sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]')::text,'sha256'),'hex') from ops.audit_log a
       where a.entity_type in ('media_batch','media_batch_item','media_message','story_media_batch','story_media_batch_item','story_media_message'))),
   'vacancy',jsonb_build_object('running_parents',(select count(*) from ops.scrape_runs where status='running'),
     'unregistered_launches',(select count(*) from ops.collector_launches where apify_run_id is null),
     'unprocessed_actors',(select count(*) from ops.apify_runs where processed_at is null),
     'unsettled_story_jobs',(select count(*) from ops.m06_story_jobs where not settled),
     'live_account_claims',(select count(*) from app.competitor_accounts where locked_until>clock_timestamp()),
     'unfinished_media_batches',(select count(*) from ops.audit_log a where a.action in ('media_batch_claim','story_media_batch_claim')
       and not exists(select 1 from ops.audit_log f where f.entity_type=a.entity_type and f.entity_id=a.entity_id and f.action in ('media_batch_finish','story_media_batch_finish'))),
     'media_session_locks',(select count(*) from pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted),
     'active_m06_sessions',(select count(*) from pg_stat_activity where pid<>pg_backend_pid() and application_name in ('emr-m06-media-dev','emr-m06-collectors-dev') and state<>'idle'))),
 'invariants',jsonb_build_object(
   'cost_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]')::text,'sha256'),'hex') from costs c),
   'raw_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]')::text,'sha256'),'hex') from raw r),
   'items_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]')::text,'sha256'),'hex') from items i),
   'comparison_sha256',(select encode(extensions.digest(jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from comparison c),
     'observations',(select coalesce(jsonb_agg(to_jsonb(o) order by o.apify_run_id,o.account_id),'[]') from observations o))::text,'sha256'),'hex')),
   'assets_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]')::text,'sha256'),'hex') from assets a),
   'objects_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]')::text,'sha256'),'hex') from object_contracts o),
   'media_audit_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]')::text,'sha256'),'hex') from audits a),
   'story_deliveries_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(d) order by d.msg_id,d.location),'[]')::text,'sha256'),'hex') from deliveries d),
   'ai_deliveries_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by q.msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_ai_extract q where q.message->>'item_id' in(select id::text from items)),
   'registration_rows_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_object('request_id',r.request_id,'created_at',r.created_at,'result',r.result) order by r.request_id),'[]')::text,'sha256'),'hex')
     from ops.collector_requests r where r.operation='m06.register' and r.result->>'apify_run_id' in(select apify_run_id from actor_runs)))
) as m06_stories_runtime;
commit;
