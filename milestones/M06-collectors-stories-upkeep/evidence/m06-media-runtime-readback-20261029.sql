-- M06 owned FIFO1..10 runtime receipts and same-execution replay invariants.
-- Read-only: no queue read/claim/ACK, RPC mutation, source URL, token or raw payload.
begin read only;
set local statement_timeout='25s';
set local lock_timeout='2s';
with selected as (
 select '6eb65041-b629-4c12-aa06-9899ab22ac60'::uuid item_id,
   'everyone-films/instagram/DdHVn45MQub/thumb.jpg'::text storage_path
), media as (
 select a.* from ops.audit_log a where a.action in ('media_batch_claim','media_batch_finish','media_outcome',
   'media_message_claim','media_message_outcome','media_message_ack','media_message_held')
), execution_ids as (
 select distinct a.after->>'execution_id' execution_id from media a
 where a.entity_type='media_message' and a.entity_id in ('1','2','3','4','5','6','7','8','9','10')
   and a.after->>'execution_id' ~ '^[1-9][0-9]{0,19}$'
 union
 select a.entity_id from media a where a.entity_type='media_batch' and a.action='media_batch_claim'
   and a.entity_id ~ '^[1-9][0-9]{0,19}$' and exists(
     select 1 from jsonb_array_elements(a.after->'messages') m where m->>'msg_id' in ('1','2','3','4','5','6','7','8','9','10'))
), claims as (
 select a.id,a.entity_id execution_id,a.created_at,a.after->'batch_limit' batch_limit,
   (select coalesce(jsonb_agg(jsonb_build_object('msg_id',m->>'msg_id','read_ct',m->'read_ct',
     'item_id',m->'message'->>'item_id') order by m->>'msg_id'),'[]'::jsonb)
     from jsonb_array_elements(a.after->'messages') m) messages,
   (select coalesce(jsonb_agg(jsonb_build_object('msg_id',h->>'msg_id','reason',h->>'reason') order by h->>'msg_id'),'[]'::jsonb)
     from jsonb_array_elements(a.after->'held') h) held
 from media a join execution_ids e on e.execution_id=a.entity_id
 where a.action='media_batch_claim' and a.entity_type='media_batch'
), finishes as (
 select a.id,a.entity_id execution_id,a.created_at,
   jsonb_build_object('state',a.after->'state','claimed',a.after->'claimed','processed',a.after->'processed',
     'held',a.after->'held','stored',a.after->'stored','skipped',a.after->'skipped','expired',a.after->'expired',
     'retryable',a.after->'retryable','reconciliation_required',a.after->'reconciliation_required',
     'bytes',a.after->'bytes','infrastructure_cost_usd',a.after->'infrastructure_cost_usd') result
 from media a join execution_ids e on e.execution_id=a.entity_id
 where a.action='media_batch_finish' and a.entity_type='media_batch'
), item_outcomes as (
 select a.id,split_part(a.entity_id,':',1) execution_id,a.created_at,a.after->>'item_id' item_id,
   a.after->'msg_ids' msg_ids,a.after->>'outcome' outcome,a.after->>'code' code,
   a.after->'bytes' attempted_jpeg_body_bytes,a.after->'cost_usd' infrastructure_cost_usd
 from media a join execution_ids e on e.execution_id=split_part(a.entity_id,':',1)
 where a.action='media_outcome' and a.entity_type='media_batch_item'
), message_events as (
 select a.id,a.entity_id msg_id,a.action,a.created_at,a.after->>'execution_id' execution_id,
   a.after->>'item_id' item_id,a.after->'read_ct' read_ct,a.after->>'outcome' outcome,a.after->>'code' code
 from media a where a.entity_type='media_message' and a.entity_id in ('1','2','3','4','5','6','7','8','9','10')
), target as (
 select i.id,i.account_id,i.competitor_id,i.platform,i.external_id,i.status,i.thumbnail_path,i.locked_fields,
   i.thumbnail_source_url,c.company_code,c.slug,c.status competitor_status
 from selected s left join app.items i on i.id=s.item_id left join app.competitors c on c.id=i.competitor_id
)
select jsonb_build_object(
 'version',1,'observed_at',clock_timestamp(),
 'identity',jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database()),
 'batch_execution_ids',(select coalesce(jsonb_agg(e.execution_id order by e.execution_id),'[]'::jsonb) from execution_ids e),
 'claims',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb) from claims c),
 'item_outcomes',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from item_outcomes o),
 'message_events',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from message_events m),
 'finishes',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]'::jsonb) from finishes f),
 'target',(select jsonb_build_object('item_id',t.id,'company_code',t.company_code,'competitor_slug',t.slug,
   'competitor_id',t.competitor_id,'account_id',t.account_id,'platform',t.platform,'external_id',t.external_id,
   'item_status',t.status,'competitor_status',t.competitor_status,'thumbnail_path',t.thumbnail_path,
   'expected_path_matches',t.thumbnail_path=(select storage_path from selected),'locked_fields',t.locked_fields,
   'source_present',nullif(btrim(t.thumbnail_source_url),'') is not null) from target t),
 'asset_receipts',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',m.id,'item_id',m.item_id,
   'competitor_id',m.competitor_id,'kind',m.kind,'storage_path',m.storage_path,'width',m.width,'height',m.height,
   'created_at',m.created_at,'source_matches_item',m.source_url=t.thumbnail_source_url,
   'owner_matches_item',m.item_id=t.id and m.competitor_id=t.competitor_id,
   'path_matches_expected',m.storage_path=(select storage_path from selected)) order by m.id),'[]'::jsonb)
   from app.media_assets m join target t on m.item_id=t.id or m.storage_path=(select storage_path from selected)),
 'storage_object',(select jsonb_build_object('id',o.id,'bucket_id',o.bucket_id,'name',o.name,
   'created_at',o.created_at,'updated_at',o.updated_at,'size',o.metadata->'size','mimetype',o.metadata->'mimetype')
   from storage.objects o join selected s on o.bucket_id='media' and o.name=s.storage_path),
 'queue',jsonb_build_object('messages_1_to_10',(select jsonb_agg(jsonb_build_object('msg_id',n::text,
   'queued',exists(select 1 from pgmq.q_media q where q.msg_id=n),
   'archived',exists(select 1 from pgmq.a_media q where q.msg_id=n),
   'ack_count',(select count(*) from media a where a.action='media_message_ack' and a.entity_type='media_message' and a.entity_id=n::text)) order by n) from generate_series(1,10) n),
   'remaining',(select count(*) from pgmq.q_media),
   'visible',(select count(*) from pgmq.q_media where vt<=now()),
   'leased',(select count(*) from pgmq.q_media where vt>now()),
   'next_visible_msg_id',(select min(msg_id)::text from pgmq.q_media where vt<=now()),
   'message11',(select jsonb_build_object('msg_id',q.msg_id::text,'read_ct',q.read_ct,'visible',q.vt<=now(),
     'item_id',q.message->>'item_id','media_audits',(select count(*) from media a where a.entity_type='media_message' and a.entity_id='11'))
     from pgmq.q_media q where q.msg_id=11),
   'media_message_audits_after_10',(select count(*) from media a where case when a.entity_type='media_message'
     and a.entity_id ~ '^[1-9][0-9]{0,18}$' then a.entity_id::numeric>10 else false end),
   'queue_after_10_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(q.msg_id,q.read_ct,q.enqueued_at,q.vt,q.message) order by q.msg_id),'[]'::jsonb)::text,'sha256'),'hex') from pgmq.q_media q where q.msg_id>10)),
 'replay_invariants',jsonb_build_object(
   'media_audit_rows',(select count(*) from media),
   'media_audit_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(a.id,a.action,a.entity_type,a.entity_id,a.after,a.created_at) order by a.id),'[]'::jsonb)::text,'sha256'),'hex') from media a),
   'media_assets',(select count(*) from app.media_assets),
   'target_asset_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(m.id,m.item_id,m.competitor_id,m.kind,m.storage_path,m.width,m.height,m.created_at) order by m.id),'[]'::jsonb)::text,'sha256'),'hex')
     from app.media_assets m where m.item_id=(select item_id from selected) or m.storage_path=(select storage_path from selected)),
   'media_queue',(select count(*) from pgmq.q_media),
   'media_queue_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(q.msg_id,q.read_ct,q.enqueued_at,q.vt,q.message) order by q.msg_id),'[]'::jsonb)::text,'sha256'),'hex') from pgmq.q_media q),
   'items',(select count(*) from app.items),'raw_items',(select count(*) from ingest.raw_items),
   'cost_rows',(select count(*) from ops.cost_ledger),'cost_usd',(select coalesce(sum(cost_usd),0) from ops.cost_ledger),
   'ai_extractions',(select count(*) from ops.ai_extractions),'ai_queue',(select count(*) from pgmq.q_ai_extract),'embed_queue',(select count(*) from pgmq.q_embed)),
 'preservation',jsonb_build_object(
   'baseline_items_280',(select count(*)=280 from app.items),'baseline_raw_280',(select count(*)=280 from ingest.raw_items),
   'baseline_ai_queue_277',(select count(*)=277 from pgmq.q_ai_extract),
   'baseline_ai_extractions_0',(select count(*)=0 from ops.ai_extractions),
   'baseline_cost_rows_58',(select count(*)=58 from ops.cost_ledger),
   'baseline_cost_usd_1_355284',(select coalesce(sum(cost_usd),0)=1.355284::numeric from ops.cost_ledger),
   'stories_setting',(select value from ops.settings where key='stories_twice_daily'),
   'story_cadence_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(a.id,extract(epoch from a.cadence)) order by a.id),'[]'::jsonb)::text,'sha256'),'hex')
     from app.competitor_accounts a where a.platform='instagram_stories'),
   'account_contract_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(a.id,a.status,a.cadence::text,a.next_due_at,a.locked_until,a.last_run_id,
     a.last_success_at,a.last_error_at,a.consecutive_failures,a.last_item_published_at,a.last_external_id,a.backfill_from,a.backfill_status,a.backfill_cursor,a.items_count) order by a.id),'[]'::jsonb)::text,'sha256'),'hex') from app.competitor_accounts a),
   'items_except_thumbnail_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(i)-'thumbnail_path'-'updated_at' order by i.id),'[]'::jsonb)::text,'sha256'),'hex') from app.items i),
   'raw_contract_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(r.id,r.platform,r.external_id,r.account_id,r.run_id,r.actor,r.content_hash,r.fetched_at) order by r.id),'[]'::jsonb)::text,'sha256'),'hex') from ingest.raw_items r),
   'report_account_result_sha256',(select encode(extensions.digest(pg_get_functiondef(p.oid),'sha256'),'hex') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ops' and p.proname='report_account_result')),
 'quiescence',jsonb_build_object(
   'unfinished_media_batches',(select count(*) from media c where c.action='media_batch_claim' and c.entity_type='media_batch'
     and not exists(select 1 from media f where f.action='media_batch_finish' and f.entity_type='media_batch' and f.entity_id=c.entity_id)),
   'noncompleted_media_batches',(select count(*) from finishes f where f.result->>'state'<>'completed'),
   'media_lock_count',(select count(*) from pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted),
   'active_media_sessions',(select count(*) from pg_stat_activity where application_name='emr-m06-media-dev' and state<>'idle' and pid<>pg_backend_pid()),
   'idle_media_sessions',(select count(*) from pg_stat_activity where application_name='emr-m06-media-dev' and state='idle' and pid<>pg_backend_pid()),
   'live_account_claims',(select count(*) from app.competitor_accounts where locked_until>clock_timestamp()),
   'running_parents',(select count(*) from ops.scrape_runs where status='running'),
   'unprocessed_actors',(select count(*) from ops.apify_runs where processed_at is null),
   'unsettled_m05_jobs',(select count(*) from ops.m05_jobs where not settled))
) as m06_media_runtime;
commit;
