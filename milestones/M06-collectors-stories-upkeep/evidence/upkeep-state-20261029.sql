-- Read-only preflight/final snapshot for the exact authorized M06 upkeep scope.
-- Transport/project/TLS verification belongs to the separately reviewed bounded
-- admin child. No RPC invocation, claim, actor start, queue read/ACK or mutation.
-- The same query is used before and after, so snapshots have identical meaning.
begin read only;
set local statement_timeout='20s';
set local lock_timeout='2s';
with expected_history(version,name,history_sha256) as (values
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
 ('20261028020745','m05_web_youtube_linkedin','509275a6b8732557a00d5a64829f1cca56070744887b385b7e6b8317119976d0'),
 ('20261028190835','m06_media_contracts','0d87e141666a640ead3e79e9b758b01aee148c199167a1f30f489027358e68d7'),
 ('20261028223330','m06_cadence_health','91292e103bc48804009ca66f1ff5b824471f44b8796e4d4624bfaadbceff0fc3'),
 ('20261029005731','m06_story_collection_bakeoff','6cc5b27c7fbb25860bfa9f027ccfd74a8d439ccb44ca774d555ca09b6a65adeb'),
 ('20261029092746','m06_story_campaign','83e6a74ba2abf0f4ab8bc69122b5f31686aee48f4885b319b503bcaf58243e8e')
), selected_ids(id,platform,handle,external_id) as (values
 ('985a57dd-7934-422d-9d18-4e8ca59fc197'::uuid,'vimeo','everyonefilms','157330576'),
 ('3dbf4ea2-3eae-4369-89cb-85df8fcd2e03'::uuid,'youtube','hekka_sa','UCYOM_-vZX82oFfS9L0bGBQg'),
 ('962c9c7e-aa0f-46ae-911b-3265859e0577'::uuid,'instagram','everyone.film',null)
), accounts as materialized (
 select a.*,c.company_code,c.name as competitor_name,c.status as competitor_status,
 s.platform as expected_platform,s.handle as expected_handle,s.external_id as expected_external_id
 from selected_ids s join app.competitor_accounts a on a.id=s.id
 join app.competitors c on c.id=a.competitor_id
), selected_items as materialized (
 select i.* from app.items i join accounts a on a.id=i.account_id
 where i.competitor_id=a.competitor_id and i.platform=a.platform
), campaign as materialized (
 select * from ops.m06_story_campaigns where id='451d4e89-d32f-412a-84f7-ddb5528f4539'
), campaign_parents as materialized (
 select r.* from ops.scrape_runs r join ops.m06_story_campaign_slots s on s.run_id=r.id
 join campaign c on c.id=s.campaign_id
), campaign_launches as materialized (
 select l.* from ops.collector_launches l join campaign_parents p on p.id=l.run_id
), campaign_jobs as materialized (
 select j.* from ops.m06_story_jobs j join campaign_launches l using(launch_id)
), campaign_actors as materialized (
 select a.* from ops.apify_runs a join campaign_parents p on p.id=a.run_id
), source_runs as materialized (
 select distinct l.launch_id,l.run_id,l.actor_id,l.pass,l.account_ids,l.results_limit,
 l.apify_run_id,l.dataset_complete,a.dataset_id,a.status,a.started_at,a.finished_at,a.processed_at,
 p.workflow,p.platform,p.env
 from ops.collector_launches l join ops.apify_runs a on a.apify_run_id=l.apify_run_id
 join ops.scrape_runs p on p.id=l.run_id
 where exists(select 1 from accounts x where x.id=any(l.account_ids))
), migrations as materialized (
 select version,name,encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex') as history_sha256
 from supabase_migrations.schema_migrations
), functions as materialized (
 select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,
 pg_get_function_result(p.oid) as returns,p.prosecdef as security_definer,p.proconfig as settings,
 has_function_privilege('n8n_writer',p.oid,'EXECUTE') as writer_execute,
 has_function_privilege('api_agent',p.oid,'EXECUTE') as agent_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
 encode(extensions.digest(pg_get_functiondef(p.oid),'sha256'),'hex') as definition_sha256
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='ops' and p.proname in ('get_upkeep_source_runs','get_removal_targets','mark_removed',
 'refresh_item_metrics','apply_upkeep_observation','upkeep_request_status'))
 or (n.nspname='private' and p.proname like 'm06_upkeep_%')
)
select jsonb_build_object(
 'observed_at',clock_timestamp(),'phase','m06_upkeep_readonly_state',
 'target',jsonb_build_object('expected_project_ref','zmotjsbzhzjvpelxvxlf','database',current_database(),
 'current_user',current_user,'session_user',session_user,'transport_identity_required',true),
 'history',jsonb_build_object('count',(select count(*) from migrations),
 'prior23_exact',(select count(*)=23 from migrations m join expected_history e using(version,name,history_sha256)),
 'preflight23_exact',(select count(*)=23 from migrations) and (select count(*)=23 from migrations m join expected_history e using(version,name,history_sha256)),
 'postcheck24_shape',(select count(*)=24 from migrations) and exists(select 1 from migrations where version='20261029114814' and name='m06_upkeep_contracts'),
 'rows',(select jsonb_agg(to_jsonb(m) order by version) from migrations m)),
 'scope',jsonb_build_object('expected_accounts',3,'actual_accounts',(select count(*) from accounts),
 'free_since',((clock_timestamp() at time zone 'UTC')::date-90),
 'paid_metrics_since',((clock_timestamp() at time zone 'UTC')::date-30),
 'accounts',(select jsonb_agg(jsonb_build_object('id',a.id,'company_code',a.company_code,
 'name',a.competitor_name,'competitor_id',a.competitor_id,'platform',a.platform,'handle',a.handle,
 'handle_norm',a.handle_norm,'url',a.url,'external_id',a.external_id,'uploads_playlist_id',a.uploads_playlist_id,
 'status',a.status,'competitor_status',a.competitor_status,'locked_until',a.locked_until,
 'last_run_id',a.last_run_id,'next_due_at',a.next_due_at,'last_success_at',a.last_success_at,
 'backfill_status',a.backfill_status,'backfill_cursor',a.backfill_cursor,
 'last_external_id',a.last_external_id,'last_item_published_at',a.last_item_published_at,
 'expected_platform',a.expected_platform,'expected_handle',a.expected_handle,
 'expected_external_id',a.expected_external_id,
 'row_sha256',encode(extensions.digest((to_jsonb(a)-'company_code'-'competitor_name'-'competitor_status'
 -'expected_platform'-'expected_handle'-'expected_external_id')::text,'sha256'),'hex')) order by a.id) from accounts a),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'account_id',i.account_id,'platform',i.platform,
 'external_id',i.external_id,'published_at',i.published_at,'created_at',i.created_at,'item_type',i.item_type,
 'in_free_window',i.published_at>=((clock_timestamp() at time zone 'UTC')::date-90)::timestamp at time zone 'UTC',
 'in_metrics_window',i.published_at>=((clock_timestamp() at time zone 'UTC')::date-30)::timestamp at time zone 'UTC',
 'metrics',i.metrics,'metrics_updated_at',i.metrics_updated_at,'status',i.status,
 'removed_detected_at',i.removed_detected_at,'locked_fields',i.locked_fields,
 'ai_status',i.ai_status,'thumbnail_path',i.thumbnail_path,
 'protected_fields_sha256',encode(extensions.digest((to_jsonb(i)-'metrics'-'metrics_updated_at'-'status'-'removed_detected_at')::text,'sha256'),'hex'),
 'full_row_sha256',encode(extensions.digest(to_jsonb(i)::text,'sha256'),'hex')) order by i.id),'[]') from selected_items i),
 'source_runs',(select coalesce(jsonb_agg(to_jsonb(s) order by s.launch_id),'[]') from source_runs s),
 'raw_count',(select count(*) from ingest.raw_items r join accounts a on a.id=r.account_id),
 'raw_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]')::text,'sha256'),'hex')
 from ingest.raw_items r join accounts a on a.id=r.account_id),
 'ai_count',(select count(*) from ops.ai_extractions x join selected_items i on i.id=x.item_id),
 'ai_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')::text,'sha256'),'hex')
 from ops.ai_extractions x join selected_items i on i.id=x.item_id),
 'media_count',(select count(*) from app.media_assets x join selected_items i on i.id=x.item_id),
 'media_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')::text,'sha256'),'hex')
 from app.media_assets x join selected_items i on i.id=x.item_id)),
 'catalog',jsonb_build_object('functions',(select coalesce(jsonb_agg(to_jsonb(f) order by f.schema,f.name),'[]') from functions f),
 'writer_direct_item_dml',has_table_privilege('n8n_writer','app.items','INSERT,UPDATE,DELETE'),
 'agent_direct_item_dml',has_table_privilege('api_agent','app.items','INSERT,UPDATE,DELETE'),
 'items_rls',(select relrowsecurity from pg_class where oid='app.items'::regclass),
 'audit_rls',(select relrowsecurity from pg_class where oid='ops.audit_log'::regclass),
 'request_unique_index',(select indexdef from pg_indexes where schemaname='ops' and indexname='m06_upkeep_request_unique')),
 'upkeep_audits',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'request_id',actor_id,'action',action,
 'entity_id',entity_id,'before',before,'after',after,'created_at',created_at) order by id),'[]') from ops.audit_log
 where action in('m06_apply_observation','m06_mark_removed','m06_refresh_metrics')),
 'youtube_quota',(select coalesce(jsonb_agg(to_jsonb(q) order by quota_day),'[]') from ops.m05_quota q),
 'campaign',jsonb_build_object('row_sha256',(select encode(extensions.digest(to_jsonb(c)::text,'sha256'),'hex') from campaign c),
 'configuration_sha256',(select encode(extensions.digest(c.configuration::text,'sha256'),'hex') from campaign c),
 'dates',(select jsonb_build_object('starts_on',starts_on,'ends_on',ends_on,'stop_new_at',stop_new_at,
 'shutdown_at',shutdown_at,'stopped_at',stopped_at) from campaign),
 'slots_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(s) order by s.day,s.ordinal),'[]')::text,'sha256'),'hex')
 from ops.m06_story_campaign_slots s join campaign c on c.id=s.campaign_id),
 'protected_archive_count',(select count(*) from pgmq.a_media_stories q where exists(select 1 from campaign c where q.msg_id=any(c.protected_archive_ids))),
 'protected_archives_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex')
 from pgmq.a_media_stories q where exists(select 1 from campaign c where q.msg_id=any(c.protected_archive_ids)))),
 'queues',jsonb_build_object('generic_count',(select count(*) from pgmq.q_media),
 'generic_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q),
 'story_count',(select count(*) from pgmq.q_media_stories),
 'story_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media_stories q),
 'ai_count',(select count(*) from pgmq.q_ai_extract),
 'ai_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_ai_extract q)),
 'quiescence',jsonb_build_object('selected_live_claims',(select count(*) from accounts where locked_until>clock_timestamp()),
 'selected_running_parents',(select count(distinct r.id) from ops.scrape_runs r join ops.collector_accounts ca on ca.run_id=r.id
 join accounts a on a.id=ca.account_id where r.status='running'),
 'campaign_running_parents',(select count(*) from campaign_parents where status='running'),
 'campaign_unregistered_launches',(select count(*) from campaign_launches where apify_run_id is null),
 'campaign_unsettled_jobs',(select count(*) from campaign_jobs where not settled),
 'campaign_unprocessed_actors',(select count(*) from campaign_actors where processed_at is null),
 'global_media_session_locks',(select count(*) from pg_catalog.pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted),
 'active_other_m06_sessions',(select count(*) from pg_stat_activity where pid<>pg_backend_pid()
 and application_name in ('emr-m06-media-dev','emr-m06-collectors-dev','emr-m06-upkeep-dev') and state<>'idle'))
) as upkeep_state;
commit;
