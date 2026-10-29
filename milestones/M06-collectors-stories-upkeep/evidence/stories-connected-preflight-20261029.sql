-- Read-only common preflight/postcheck for the first connected M06 story run.
-- Expected transport: emr-dev/zmotjsbzhzjvpelxvxlf, verified externally by the
-- existing bounded strict-TLS consumer. Database name/role alone do NOT prove
-- project identity or the client-to-session-pooler certificate validation.
-- Never claims, hides, drains or reorders either media queue; no source URLs,
-- raw payloads, credentials, current query text or native workflow bodies leave SQL.
-- The prior21 history hashes below are native statement-array hashes, distinct
-- from file SHA256. Verify migration22's approved FILE SHA256 externally:
-- 1811fef97bb381baa928583e4197725d56acc719d36079e54d211afd41fe578f.
-- Record migration22's newly observed native history hash after its exact
-- one-file push, then compare it unchanged at final postcheck; do not fabricate
-- or equate that statement-array hash with the approved file hash.
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
 ('20261028020745','m05_web_youtube_linkedin','509275a6b8732557a00d5a64829f1cca56070744887b385b7e6b8317119976d0'),
 ('20261028190835','m06_media_contracts','0d87e141666a640ead3e79e9b758b01aee148c199167a1f30f489027358e68d7'),
 ('20261028223330','m06_cadence_health','91292e103bc48804009ca66f1ff5b824471f44b8796e4d4624bfaadbceff0fc3')
), actual as (
 select version,name,cardinality(statements) statement_count,
   encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex') history_sha256
 from supabase_migrations.schema_migrations
), selected(account_id,competitor_id,company_code,handle) as (values
 ('7c70141b-bb1e-4d0b-a54c-f957413400e1'::uuid,'94928d31-8983-403c-bdbd-f5f44613d631'::uuid,'C000','everyone.film'),
 ('62a5fef9-78c3-418a-9010-d5ea54f29e45'::uuid,'9a0dba8a-b946-45a1-bd53-933216f1fc4d'::uuid,'C001','goodpeoplefilms'),
 ('34b95d90-12e6-42da-84f8-3fd78cd19103'::uuid,'7ba084a1-52a1-49d5-b3a9-e488289cb504'::uuid,'C130','bigfootfilms')
), accounts as (
 select s.*,a.id is not null and a.competitor_id=s.competitor_id and c.company_code=s.company_code
   and a.platform='instagram_stories' and a.handle=s.handle and a.url='https://www.instagram.com/'||s.handle||'/' identity_matches,
   a.status,a.backfill_status,a.cadence::text,a.next_due_at,a.locked_until,a.last_run_id,
   a.last_success_at,a.last_error_at,a.consecutive_failures,a.last_item_published_at,a.last_external_id,a.items_count,
   c.status competitor_status,a.next_due_at<=now() due,
   a.locked_until is null or a.locked_until<=clock_timestamp() claim_free
 from selected s left join app.competitor_accounts a on a.id=s.account_id left join app.competitors c on c.id=a.competitor_id
), wanted(signature,writer_expected) as (values
 ('ops.daily_health()',true),('ops.set_stories_cadence(boolean)',true),
 ('ops.m06_execute(uuid,text,jsonb)',true),('ops.save_bakeoff_rows(jsonb)',true),('ops.story_bakeoff_snapshot(date,date,uuid[])',true),
 ('ops.claim_story_media_batch(text,integer)',true),('ops.record_story_media_outcome(text,jsonb)',true),
 ('ops.ack_story_media_batch(text,bigint[])',true),('ops.finish_story_media_batch(text)',true),
 ('private.m06_assert_claim(uuid,uuid)',false),('private.m06_finalize(uuid)',false)
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
), health as (select ops.daily_health() value), role_state as (
 select rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole
 from pg_roles where rolname in ('n8n_writer','api_agent')
), story_lane as (
 -- Fixed SELECT only, needed so one file also works before the queue exists.
 -- No caller-selected SQL, identifier, literal or payload is interpolated.
 select case when to_regclass('pgmq.q_media_stories') is null then null else
   ((xpath('/table/row/projection/text()',query_to_xml($lane$
     select jsonb_build_object('queued',count(*),'visible',count(*) filter(where vt<=now()),
       'leased',count(*) filter(where vt>now()),
       'delivery_sha256',encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex'),
       'archived',(select count(*) from pgmq.a_media_stories)) projection from pgmq.q_media_stories q
   $lane$,false,false,'')))[1]::text)::jsonb end value
), story_jobs as (
 select case when to_regclass('ops.m06_story_jobs') is null then null else
   ((xpath('/table/row/projection/text()',query_to_xml($jobs$
     select jsonb_build_object('pending',count(*) filter(where not j.settled),'settled',count(*) filter(where j.settled),
       'observations',(select count(*) from ops.bakeoff_observations),
       'comparison_rows',(select count(*) from ops.bakeoff_results),
       'work',(select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at,w.launch_id),'[]') from
         (select j.launch_id,l.run_id,l.apify_run_id,l.actor_id,l.account_ids,j.settled,j.created_at
          from ops.m06_story_jobs j join ops.collector_launches l using(launch_id) order by j.created_at desc,j.launch_id limit 50) w))
       projection from ops.m06_story_jobs j
   $jobs$,false,false,'')))[1]::text)::jsonb end value
)
select jsonb_build_object(
 'version',1,'observed_at',clock_timestamp(),
 'target',jsonb_build_object('expected_project_ref','zmotjsbzhzjvpelxvxlf','transport_identity_required',true,
   'current_user',current_user,'session_user',session_user,'database',current_database(),
   'sql_identity_is_not_project_or_client_tls_proof',true),
 'history',jsonb_build_object('count',(select count(*) from actual),
   'prior21_exact',not exists(select 1 from expected e full join (select * from actual where version<='20261028223330') a using(version)
     where e.version is null or a.version is null or a.name is distinct from e.name or a.history_sha256 is distinct from e.history_sha256),
   'preflight21_only',(select count(*)=21 from actual) and not exists(select 1 from actual where version>'20261028223330'),
   'postcheck22_shape',(select count(*)=22 from actual) and
     (select count(*)=1 from actual where version='20261029005731' and name='m06_story_collection_bakeoff' and statement_count>0),
   'unexpected_versions',(select coalesce(jsonb_agg(a.version order by a.version),'[]') from actual a where not exists(select 1 from expected e where e.version=a.version) and a.version<>'20261029005731'),
   'rows',(select jsonb_agg(to_jsonb(a) order by a.version) from actual a)),
 'selected_accounts',(select jsonb_agg(to_jsonb(a) order by a.company_code) from accounts a),
 'selected_ready',(select count(*)=3 and bool_and(identity_matches and status='active' and competitor_status='active'
   and backfill_status='not_applicable' and due and claim_free) from accounts),
 'quiescence',jsonb_build_object(
   'selected_running_parents',(select count(distinct r.id) from ops.scrape_runs r join ops.collector_accounts a on a.run_id=r.id join selected s on s.account_id=a.account_id where r.status='running'),
   'selected_unprocessed_actors',(select count(*) from ops.apify_runs a where a.processed_at is null and exists(select 1 from selected s where s.account_id=any(a.account_ids))),
   'selected_unregistered_launches',(select count(*) from ops.collector_launches a where a.apify_run_id is null and exists(select 1 from selected s where s.account_id=any(a.account_ids))),
   'unfinished_media_batches',(select count(*) from ops.audit_log a where a.action in ('media_batch_claim','story_media_batch_claim')
     and not exists(select 1 from ops.audit_log f where f.entity_type=a.entity_type and f.entity_id=a.entity_id and f.action in ('media_batch_finish','story_media_batch_finish'))),
   'media_session_locks',(select count(*) from pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted),
   'active_m06_sessions',(select count(*) from pg_stat_activity where pid<>pg_backend_pid() and application_name in ('emr-m06-media-dev','emr-m06-collectors-dev') and state<>'idle')),
 'generic_media',jsonb_build_object('count',(select count(*) from pgmq.q_media),
   'checkpoint267_count_matches',(select count(*)=267 from pgmq.q_media),
   'ids',(select coalesce(jsonb_agg(msg_id::text order by msg_id),'[]') from pgmq.q_media),
   'identity_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(msg_id,message) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media),
   'delivery_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q)),
 'story_lane',(select value from story_lane),'story_jobs',(select value from story_jobs),
 'request_ledger',(select coalesce(jsonb_agg(jsonb_build_object('request_id',r.request_id,'operation',r.operation,'created_at',r.created_at,
   'registered',r.result->'registered','run_id',r.result->'run_id','apify_run_id',r.result->'apify_run_id','updated',r.result->'updated')
   order by r.created_at,r.request_id),'[]') from
   (select request_id,operation,result,created_at from ops.collector_requests where operation in ('m06.register','m06.settle')
     order by created_at desc,request_id limit 100) r),
 'roles',(select jsonb_agg(to_jsonb(r) order by r.rolname) from role_state r),
 'functions',(select jsonb_agg(to_jsonb(f) order by f.signature) from functions f),
 'new_tables',(select coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'rls',c.relrowsecurity,
   'writer_direct',has_table_privilege('n8n_writer',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
   'agent_direct',has_table_privilege('api_agent',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) order by n.nspname,c.relname),'[]')
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and
     ((n.nspname='ops' and c.relname in ('m06_story_runs','m06_story_jobs','bakeoff_observations','bakeoff_results')) or (n.nspname='pgmq' and c.relname in ('q_media_stories','a_media_stories')))),
 'health21',jsonb_build_object('field_names',(select jsonb_agg(k order by k) from health h,jsonb_object_keys(h.value) k),
   'm06_fields_present',(select value ?& array['zero_item_streaks','story_capture_gap','media_missing_24h'] from health),
   'function_sha256',(select encode(extensions.digest(pg_get_functiondef(to_regprocedure('ops.daily_health()')),'sha256'),'hex')),
   'observed_active_database_consumers',(select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'application_name',application_name,'state',state)),'[]')
     from pg_stat_activity where pid<>pg_backend_pid() and state='active' and query ~ 'daily_health[[:space:]]*\('),
   'wf91_inactive_requires_native_readback',true,'database_activity_is_not_workflow_inventory',true),
 'baseline',jsonb_build_object('items',(select count(*) from app.items),'raw_items',(select count(*) from ingest.raw_items),
   'media_assets',(select count(*) from app.media_assets),'cost_rows',(select count(*) from ops.cost_ledger),
   'cost_usd',(select coalesce(sum(cost_usd),0) from ops.cost_ledger),
   'stories_setting',(select value from ops.settings where key='stories_twice_daily'),
   'story_cadence_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(a.id,extract(epoch from a.cadence)) order by a.id),'[]')::text,'sha256'),'hex') from app.competitor_accounts a where a.platform='instagram_stories'),
   'ai_queue',(select count(*) from pgmq.q_ai_extract),'embed_queue',(select count(*) from pgmq.q_embed))
) as m06_stories_preflight;
commit;
