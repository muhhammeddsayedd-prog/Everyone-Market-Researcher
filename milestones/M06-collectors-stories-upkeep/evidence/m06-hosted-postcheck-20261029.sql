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
), wanted(signature,writer_expected) as (values
 ('ops.get_media_targets(uuid[])',true),('ops.save_media_asset(uuid,text,text,text,integer,integer)',true),
 ('ops.claim_media_batch(text,integer)',true),('ops.record_media_outcome(text,jsonb)',true),
 ('ops.ack_media_batch(text,bigint[])',true),('ops.finish_media_batch(text)',true),
 ('ops.set_stories_cadence(boolean)',true),('ops.daily_health()',true),('private.assert_media_session(text)',false)
), functions as (
 select w.signature,w.writer_expected,p.oid is not null present,p.prosecdef definer,
   p.proconfig @> array['search_path=""'] empty_search_path,
   has_function_privilege('n8n_writer',p.oid,'EXECUTE') writer_execute,
   has_function_privilege('api_agent',p.oid,'EXECUTE') agent_execute,
   has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
   has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
   coalesce((select bool_or(x.grantee=0 and x.privilege_type='EXECUTE') from
     aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x),false) public_execute
 from wanted w left join pg_proc p on p.oid=to_regprocedure(w.signature)
), health as (select ops.daily_health() value), heads as (
 select q.msg_id,q.read_ct,q.enqueued_at,q.vt,
   case when jsonb_typeof(q.message)='object' and jsonb_typeof(q.message->'item_id')='string'
     and q.message->>'item_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     then (q.message->>'item_id')::uuid end item_id
 from pgmq.q_media q where q.vt<=now() order by q.msg_id limit 10
)
select jsonb_build_object(
 'version',1,'observed_at',clock_timestamp(),
 'identity',jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database()),
 'history',jsonb_build_object('count',(select count(*) from actual),
   'original19_unchanged',(select count(*)=19 from actual where version<='20261028020745') and not exists(
     select 1 from expected e full join (select * from actual where version<='20261028020745') a using(version)
     where e.version is null or a.version is null or a.name is distinct from e.name or a.history_sha256 is distinct from e.history_sha256),
   'exact21_shape',(select count(*)=21 from actual) and
     (select count(*)=1 from actual where version='20261028190835' and name='m06_media_contracts' and statement_count>0 and history_sha256 ~ '^[a-f0-9]{64}$') and
     (select count(*)=1 from actual where version='20261028223330' and name='m06_cadence_health' and statement_count>0 and history_sha256 ~ '^[a-f0-9]{64}$'),
   'rows',(select jsonb_agg(to_jsonb(a) order by a.version) from actual a)),
 'functions',(select jsonb_agg(to_jsonb(f) order by f.signature) from functions f),
 'function_security_pass',(select count(*)=9 and bool_and(present and definer and empty_search_path and writer_execute=writer_expected
   and not agent_execute and not anon_execute and not authenticated_execute and not public_execute) from functions),
 'rls',jsonb_build_object('tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname in ('app','ingest','ops') and c.relkind in ('r','p')),
   'without_rls',(select coalesce(jsonb_agg(n.nspname||'.'||c.relname order by n.nspname,c.relname),'[]'::jsonb)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname in ('app','ingest','ops') and c.relkind in ('r','p') and not c.relrowsecurity),
   'writer_direct_media_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where ((n.nspname='app' and c.relname in ('items','media_assets','competitor_accounts')) or (n.nspname='ops' and c.relname in ('audit_log','settings')))
     and has_table_privilege('n8n_writer',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')),
   'views_without_security_invoker',(select coalesce(jsonb_agg(n.nspname||'.'||c.relname order by n.nspname,c.relname),'[]'::jsonb)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app','api') and c.relkind='v'
       and not coalesce(c.reloptions @> array['security_invoker=true'],false))),
 'health',(select jsonb_build_object('field_count',(select count(*) from jsonb_object_keys(h.value)),
   'legacy_fields_preserved',h.value ?& array['failing_accounts','stale_accounts','queues','items_new_yesterday','cost_yesterday','budget','month_to_date_usd','forecast_month_usd','workflow_errors_24h'],
   'new_fields_present',h.value ?& array['zero_item_streaks','story_capture_gap','media_missing_24h'],
   'zero_item_streaks_type',jsonb_typeof(h.value->'zero_item_streaks'),
   'zero_item_streaks_count',jsonb_array_length(h.value->'zero_item_streaks'),
   'story_capture_gap',h.value->'story_capture_gap',
   'story_capture_gap_valid',case when jsonb_typeof(h.value->'story_capture_gap')='null' then true
     when jsonb_typeof(h.value->'story_capture_gap')='number' then (h.value->>'story_capture_gap')::numeric between 0 and 1 else false end,
   'media_missing_24h',h.value->'media_missing_24h',
   'media_missing_24h_valid',jsonb_typeof(h.value->'media_missing_24h')='number' and h.value->>'media_missing_24h' ~ '^(0|[1-9][0-9]*)$') from health h),
 'fifo_visible_first10',(select coalesce(jsonb_agg(jsonb_build_object('msg_id',h.msg_id::text,'read_ct',h.read_ct,'item_id',h.item_id,
   'company_code',c.company_code,'account_id',i.account_id,'platform',i.platform,'external_id',i.external_id,
   'source_present',nullif(btrim(i.thumbnail_source_url),'') is not null,'has_thumbnail',i.thumbnail_path is not null,
   'thumbnail_locked','thumbnail_path'=any(i.locked_fields)) order by h.msg_id),'[]'::jsonb)
   from heads h left join app.items i on i.id=h.item_id left join app.competitors c on c.id=i.competitor_id),
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
     where n.nspname='ops' and p.proname='daily_health')),
 'quiescence',jsonb_build_object('unfinished_media_batches',(select count(*) from ops.audit_log a where a.entity_type='media_batch' and a.action='media_batch_claim'
     and not exists(select 1 from ops.audit_log f where f.entity_type='media_batch' and f.entity_id=a.entity_id and f.action='media_batch_finish')),
   'media_session_locks',(select count(*) from pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted),
   'active_media_sessions',(select count(*) from pg_stat_activity where application_name='emr-m06-media-dev' and state<>'idle' and pid<>pg_backend_pid()),
   'live_account_claims',(select count(*) from app.competitor_accounts where locked_until>clock_timestamp()),
   'running_parents',(select count(*) from ops.scrape_runs where status='running'),
   'unprocessed_actors',(select count(*) from ops.apify_runs where processed_at is null))
) as m06_postcheck;
commit;