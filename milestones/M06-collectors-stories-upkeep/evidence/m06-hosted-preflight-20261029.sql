-- Approved M06 preflight: read-only projections only; never claims or drains a queue.
-- Admin identity/strict TLS are independently verified by the bounded consumer.
-- This returns source HOST only, never a signed source URL, raw payload or secret.
begin read only;
set local statement_timeout='25s';
set local lock_timeout='2s';
with expected(version,name,history_sha256) as (values
 ('20261017172928','extensions_schemas_roles','d5c1a3c8b821bb14919c32d722042e15aa8775c966b3eade572531f066db093b'),
 ('20261017172931','core_tables','0d7587a24dc96c35e639729369dd1650952381c356e5ed1ba867934669e1abcc'),
 ('20261017172934','auth_rls_views','bb7713ce9dd0bfb4de0cc0bc98ae5f558d39807375b86f46b1bdbd002d7f0aad'),
 ('20261017172937','rpc_pipeline_core','ed23d0424c7c16cf325feceaa141baecf26f4f281725e28be1286fd6e76b196d'),
 ('20261017172940','rpc_app_search','2b36ed94ddfdc674e1097b4dee4141faf6e0912120c22e83c9b91b3353ec20b2'),
 ('20261017172943','storage_cron','50b6a9aacfbf530783ba2defc23183293b1acfd6ce8a8612e871f5bb104c33ee'),
 ('20261017172945','seed_taxonomies','3cb258773590c0225732727ea2701ad2dfc3ede8d9b62cc1d522bab3e4e9b61b'),
 ('20261018034220','rpc_n8n_foundation','dedf2cae9d1cfb7d7c5cb996d4c871a55c2628af868ee57fcb6df4598582a6d6'),
 ('20261018035417','price_book_plan','3086cac77d3e68ecd0695b00a62c883e0cf706605432ff153b25b0c27e43a6d2'),
 ('20261018070042','n8n_worker_gateway_admission','53ceb5deb54eef53750aa70064820343797474d8b1b28696a559d71f4db40373'),
 ('20261018231756','m03_actor_launch_admission','7487eb33d708fa70b8a43e7695fb730bb383b15382342e587e83e0de321a0d71'),
 ('20261018232014','m03_foundation_gateway','4f6b99a52756fcedca93fdb78fdbbe43f2b03d46b3eeea80a943657cb0bb61f2'),
 ('20261018232922','m03_foundation_safety_receipts','bfe2f0be429f93c9fe850ab3c4c457dfab8c0731edbed980cfad04c05da6479b'),
 ('20261018233338','m03_foundation_boundary_hardening','39273bad21ca92b485c759d65a670056d2d6264010b90e899f6d0b0401e721be'),
 ('20261023163755','m03_foundation_window_continuation','12e313d1c6337209cf7657d6d076b101f446b567033c2d2b3e65c38dbbe7ed18'),
 ('20261026013910','m04_vimeo_account_resolution','9391ae1b1f029e2ea9aa93b812a80b46f9f5abd8fe6245c05da1703bfcf2b56c'),
 ('20261027092832','m04_collector_product_contracts','7f036a391743189b3e8031070aa4f18fbd893df7619aab92b02f6a5996b4db7f'),
 ('20261027192743','m04_recent_instagram_dev_eligibility','4d2d43165f9159354a8ef5c5c34214b9d880b134fec45edbe2a22f63d65c0f72'),
 ('20261028020745','m05_web_youtube_linkedin','509275a6b8732557a00d5a64829f1cca56070744887b385b7e6b8317119976d0')
), actual as (
 select version,name,cardinality(statements) statement_count,
   encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex') history_sha256
 from supabase_migrations.schema_migrations
), head as (
 select q.msg_id,q.read_ct,q.enqueued_at,q.vt,q.message,
   case when jsonb_typeof(q.message)='object' then
     (select count(*)=1 from jsonb_object_keys(q.message))
     and jsonb_typeof(q.message->'item_id')='string'
     and q.message->>'item_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   else false end as message_valid
 from pgmq.q_media q where q.vt<=now() order by q.msg_id limit 1
), target as (
 select h.msg_id,h.read_ct,h.enqueued_at,h.vt,h.message_valid,
   i.id item_id,i.competitor_id,i.account_id,i.platform,i.external_id,i.status item_status,
   i.thumbnail_source_url,i.thumbnail_path,i.locked_fields,i.first_seen_at,i.created_at,
   c.company_code,c.slug,c.status competitor_status,a.status account_status,
   a.platform account_platform,a.competitor_id account_competitor_id,
   c.slug||'/'||i.platform::text||'/'||i.external_id||'/thumb.jpg' expected_path,
   r.id raw_id,r.actor,r.run_id,r.fetched_at,s.workflow,s.env run_environment,s.status run_status
 from head h left join app.items i on i.id=(case when h.message_valid then (h.message->>'item_id')::uuid end)
 left join app.competitors c on c.id=i.competitor_id
 left join app.competitor_accounts a on a.id=i.account_id
 left join ingest.raw_items r on r.platform=i.platform and r.external_id=i.external_id and r.account_id=i.account_id
 left join ops.scrape_runs s on s.id=r.run_id
), batch_claims as (
 select a.entity_id,min(a.id) claim_audit_id,min(a.created_at) claimed_at
 from ops.audit_log a where a.entity_type='media_batch' and a.action='media_batch_claim'
 group by a.entity_id
), unfinished_media as (
 select b.* from batch_claims b where not exists(select 1 from ops.audit_log f
   where f.entity_type='media_batch' and f.entity_id=b.entity_id and f.action='media_batch_finish')
), recent_media as (
 select a.id,a.action,a.entity_type,
   case when a.entity_type='media_batch' and a.entity_id ~ '^[1-9][0-9]{0,19}$' then a.entity_id
     when a.entity_type='media_message' and a.entity_id ~ '^[1-9][0-9]{0,19}$' then a.entity_id
     when a.entity_type='media_batch_item' and a.entity_id ~ '^[1-9][0-9]{0,19}:[0-9a-fA-F-]{36}$' then a.entity_id end entity_id,
   a.created_at,
   case when a.after->>'execution_id' ~ '^[1-9][0-9]{0,19}$' then a.after->>'execution_id' end execution_id,
   case when a.after->>'item_id' ~ '^[0-9a-fA-F-]{36}$' then a.after->>'item_id' end item_id,
   case when a.after->>'state' in ('completed','partial','reconciliation_required') then a.after->>'state' end state,
   case when a.after->>'outcome' in ('stored','skipped','media_expired','retryable','reconciliation_required') then a.after->>'outcome' end outcome
 from ops.audit_log a where a.action in ('media_batch_claim','media_batch_finish','media_outcome',
   'media_message_claim','media_message_outcome','media_message_ack','media_message_held')
 order by a.id desc limit 50
)
select jsonb_build_object(
 'version',1,'observed_at',clock_timestamp(),
 'identity',jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database()),
 'history',jsonb_build_object('count',(select count(*) from actual),
   'exact19',(select count(*)=19 from actual) and not exists(
     select 1 from expected e full join actual a using(version)
     where e.version is null or a.version is null or a.name is distinct from e.name or a.history_sha256 is distinct from e.history_sha256),
   'rows',(select jsonb_agg(to_jsonb(a) order by a.version) from actual a),
   'pending20Absent',to_regprocedure('ops.claim_media_batch(text,integer)') is null,
   'pending21Absent',to_regprocedure('ops.set_stories_cadence(boolean)') is null),
 'media_head',(select jsonb_build_object(
   'msg_id',t.msg_id::text,'read_ct',t.read_ct,'enqueued_at',t.enqueued_at,'visible_at',t.vt,'message_valid',t.message_valid,
   'item_id',t.item_id,'competitor_id',t.competitor_id,'company_code',t.company_code,'competitor_slug',t.slug,
   'account_id',t.account_id,'platform',t.platform,'external_id',t.external_id,
   'item_status',t.item_status,'competitor_status',t.competitor_status,'account_status',t.account_status,
   'account_identity_matches',t.account_competitor_id=t.competitor_id and t.account_platform=t.platform,
   'source_present',nullif(btrim(t.thumbnail_source_url),'') is not null,
   'source_https',t.thumbnail_source_url ~ '^https://',
   'source_host',case when t.thumbnail_source_url ~ '^https://[A-Za-z0-9.-]+(:443)?([/?#]|$)'
     then lower(substring(t.thumbnail_source_url from '^https://([A-Za-z0-9.-]+)')) end,
   'source_length_allowed',length(t.thumbnail_source_url)<=8192,
   'has_thumbnail',t.thumbnail_path is not null,'thumbnail_locked','thumbnail_path'=any(t.locked_fields),
   'target_contract_matches',t.platform in ('vimeo','instagram','instagram_stories','website_work_page','linkedin','youtube')
     and length(t.slug) between 1 and 120 and t.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and length(t.external_id) between 1 and 200 and t.external_id ~ '^[A-Za-z0-9_.-]+$'
     and t.external_id<>'.' and position('..' in t.external_id)=0,
   'new_io_read_count_allowed',t.read_ct between 0 and 2,
   'raw_id',t.raw_id,'source_actor',t.actor,'source_run_id',t.run_id,'source_workflow',t.workflow,
   'source_run_environment',t.run_environment,'source_run_status',t.run_status,'source_fetched_at',t.fetched_at,
   'real_corpus_candidate',t.company_code ~ '^C(000|001|[0-2][0-9]{2})$' and t.company_code<>'C999'
     and t.raw_id is not null and t.run_environment='dev' and t.run_status in ('success','partial')
     and t.workflow in ('WF-10','WF-11','WF-13','WF-18') and t.fetched_at>='2026-10-26T00:00:00Z'::timestamptz,
   'expected_storage_path',t.expected_path,
   'storage_object_exists',exists(select 1 from storage.objects o where o.bucket_id='media' and o.name=t.expected_path),
   'asset_receipt_exists',exists(select 1 from app.media_assets m where m.item_id=t.item_id or m.storage_path=t.expected_path),
   'prior_media_message_audits',(select count(*) from ops.audit_log x where x.entity_type='media_message' and x.entity_id=t.msg_id::text)
 ) from target t),
 'bucket',(select jsonb_build_object('id',b.id,'public',b.public,'file_size_limit',b.file_size_limit,'allowed_mime_types',b.allowed_mime_types)
   from storage.buckets b where b.id='media'),
 'unfinished',jsonb_build_object(
   'media_batches',(select count(*) from unfinished_media),
   'media_batch_ids',(select coalesce(jsonb_agg(u.entity_id order by u.claim_audit_id),'[]'::jsonb) from unfinished_media u),
   'media_session_locks',(select count(*) from pg_catalog.pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted),
   'media_sessions',(select count(*) from pg_catalog.pg_stat_activity where application_name='emr-m06-media-dev' and pid<>pg_backend_pid()),
   'live_account_claims',(select count(*) from app.competitor_accounts where locked_until>clock_timestamp()),
   'running_parents',(select count(*) from ops.scrape_runs where status='running'),
   'unprocessed_actors',(select count(*) from ops.apify_runs where processed_at is null),
   'unsettled_m05_jobs',(select count(*) from ops.m05_jobs where not settled),
   'foundation_reserved',(select count(*) from ops.foundation_gateway_requests where state='reserved'),
   'foundation_held_lease_slots',(select count(*) from ops.foundation_gateway_leases where request_id is not null),
   'media_visible',(select count(*) from pgmq.q_media where vt<=now()),
   'media_leased',(select count(*) from pgmq.q_media where vt>now())),
 'recent_media_audits',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from recent_media a),
 'baseline',jsonb_build_object(
   'competitors',(select count(*) from app.competitors),'accounts',(select count(*) from app.competitor_accounts),
   'items',(select count(*) from app.items),'raw_items',(select count(*) from ingest.raw_items),
   'media_assets',(select count(*) from app.media_assets),'ai_extractions',(select count(*) from ops.ai_extractions),
   'cost_rows',(select count(*) from ops.cost_ledger),'cost_usd',(select coalesce(sum(cost_usd),0) from ops.cost_ledger),
   'media_queue',(select count(*) from pgmq.q_media),'ai_queue',(select count(*) from pgmq.q_ai_extract),'embed_queue',(select count(*) from pgmq.q_embed),
   'audit_max_id',(select coalesce(max(id),0) from ops.audit_log),
   'stories_setting',(select value from ops.settings where key='stories_twice_daily'),
   'story_accounts',(select count(*) from app.competitor_accounts where platform='instagram_stories'),
   'story_cadence_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(a.id,extract(epoch from a.cadence)) order by a.id),'[]'::jsonb)::text,'sha256'),'hex')
     from app.competitor_accounts a where a.platform='instagram_stories'),
   'account_contract_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(a.id,a.status,a.cadence::text,a.next_due_at,a.locked_until,a.last_run_id,
     a.last_success_at,a.last_error_at,a.consecutive_failures,a.last_item_published_at,a.last_external_id,a.backfill_from,a.backfill_status,a.backfill_cursor,a.items_count) order by a.id),'[]'::jsonb)::text,'sha256'),'hex')
     from app.competitor_accounts a),
   'items_except_thumbnail_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(i)-'thumbnail_path'-'updated_at' order by i.id),'[]'::jsonb)::text,'sha256'),'hex') from app.items i),
   'raw_contract_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(r.id,r.platform,r.external_id,r.account_id,r.run_id,r.actor,r.content_hash,r.fetched_at) order by r.id),'[]'::jsonb)::text,'sha256'),'hex') from ingest.raw_items r),
   'report_account_result_sha256',(select encode(extensions.digest(pg_get_functiondef(p.oid),'sha256'),'hex') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='ops' and p.proname='report_account_result'),
   'daily_health_acl',(select coalesce(jsonb_agg(jsonb_build_array(x.grantee,x.privilege_type,x.is_grantable) order by x.grantee,x.privilege_type),'[]'::jsonb)
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
     where n.nspname='ops' and p.proname='daily_health'))
) as m06_preflight;
commit;
