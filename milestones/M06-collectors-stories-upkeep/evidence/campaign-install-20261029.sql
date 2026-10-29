-- Approved finite M06 campaign installation. PUBLIC CONFIGURATION ONLY.
-- This is a deliberate administrative write, not a read-only preflight.
-- Target identity/TLS must also be verified by the bounded emr-dev consumer.
-- No actor starts, claims, media work, credentials or schedules are created here.
begin;
set local statement_timeout='20s';
set local lock_timeout='2s';
do $preflight$
declare actual jsonb;
begin
  if current_database()<>'postgres' or session_user not in ('postgres','supabase_admin') then
    raise exception using errcode='42501',message='approved development administrative identity required'; end if;
  select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) into actual
    from supabase_migrations.schema_migrations;
  if actual is distinct from '[{"version":"20261017172928","name":"extensions_schemas_roles"},{"version":"20261017172931","name":"core_tables"},{"version":"20261017172934","name":"auth_rls_views"},{"version":"20261017172937","name":"rpc_pipeline_core"},{"version":"20261017172940","name":"rpc_app_search"},{"version":"20261017172943","name":"storage_cron"},{"version":"20261017172945","name":"seed_taxonomies"},{"version":"20261018034220","name":"rpc_n8n_foundation"},{"version":"20261018035417","name":"price_book_plan"},{"version":"20261018070042","name":"n8n_worker_gateway_admission"},{"version":"20261018231756","name":"m03_actor_launch_admission"},{"version":"20261018232014","name":"m03_foundation_gateway"},{"version":"20261018232922","name":"m03_foundation_safety_receipts"},{"version":"20261018233338","name":"m03_foundation_boundary_hardening"},{"version":"20261023163755","name":"m03_foundation_window_continuation"},{"version":"20261026013910","name":"m04_vimeo_account_resolution"},{"version":"20261027092832","name":"m04_collector_product_contracts"},{"version":"20261027192743","name":"m04_recent_instagram_dev_eligibility"},{"version":"20261028020745","name":"m05_web_youtube_linkedin"},{"version":"20261028190835","name":"m06_media_contracts"},{"version":"20261028223330","name":"m06_cadence_health"},{"version":"20261029005731","name":"m06_story_collection_bakeoff"},{"version":"20261029092746","name":"m06_story_campaign"}]'::jsonb then raise exception using errcode='55000',message='exact23version history required'; end if;
  if exists(select 1 from ops.scrape_runs where status='running')
    or exists(select 1 from ops.collector_launches where apify_run_id is null)
    or exists(select 1 from ops.m06_story_jobs where not settled)
    or exists(select 1 from pgmq.q_media_stories)
    or (select count(*) from pgmq.a_media_stories)<>13
    or (select count(*) from pgmq.q_media)<>267
    or (select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q)
      <>'72eac5883b5e49c9d4e4d379c68d2bca37073a7d03193fad0b2178c8a37c7ada' then
    raise exception using errcode='55000',message='accepted story and generic queue baseline changed'; end if;
end $preflight$;
do $install$
declare receipt jsonb;
begin
  receipt:=ops.m06_campaign_install($public_config$
{
  "campaign_id": "451d4e89-d32f-412a-84f7-ddb5528f4539",
  "starts_on": "2026-10-31",
  "account_ids": [
    "62a5fef9-78c3-418a-9010-d5ea54f29e45",
    "094f3df4-8467-4805-abb7-d2c12991a1fe",
    "aee74605-1714-4620-9e6c-95e0229db7ae",
    "34b95d90-12e6-42da-84f8-3fd78cd19103",
    "5105a7d9-282c-49dc-87be-dfe8034f6fdb",
    "93277ab3-f5d9-4f1d-b936-8bf4b84adb73",
    "5afae789-690b-40a0-a143-bd6c447920e9",
    "539f213a-6d96-4770-a964-0f32fadd9562",
    "f63b965d-b30c-4f0b-8e45-93d1b581f09f",
    "f665e025-29f4-4d57-97c7-3c81d1e2500f",
    "ca308821-eb96-439f-83b3-e868799bbac1",
    "6c7c9eaa-5ce8-4ae1-b288-d61890d845ad",
    "1c585991-c16b-499b-bded-aa333cdac1f4",
    "44c98fd0-7f85-4f40-bf5f-e2930cfd0ece",
    "26c61574-6217-4fd5-b2c3-1ac32a4f358c",
    "34a466f4-9863-48df-b290-1c1b94286a6c",
    "3c909586-932b-4f87-99ae-1eba86a0740d",
    "a1576f93-83ec-4b02-86c7-eb727a6b79db",
    "7d3e3de8-e820-4e69-a247-764893a769a3",
    "64a8412d-00c0-403f-a24d-1db785770e65"
  ],
  "groups": [
    {
      "group_key": "a_igview",
      "actor_id": "igview-owner/instagram-story-viewer",
      "collection_mode": "bakeoff",
      "account_ids": [
        "62a5fef9-78c3-418a-9010-d5ea54f29e45",
        "094f3df4-8467-4805-abb7-d2c12991a1fe",
        "aee74605-1714-4620-9e6c-95e0229db7ae",
        "34b95d90-12e6-42da-84f8-3fd78cd19103",
        "5105a7d9-282c-49dc-87be-dfe8034f6fdb",
        "93277ab3-f5d9-4f1d-b936-8bf4b84adb73",
        "5afae789-690b-40a0-a143-bd6c447920e9",
        "539f213a-6d96-4770-a964-0f32fadd9562",
        "f63b965d-b30c-4f0b-8e45-93d1b581f09f",
        "f665e025-29f4-4d57-97c7-3c81d1e2500f",
        "ca308821-eb96-439f-83b3-e868799bbac1",
        "6c7c9eaa-5ce8-4ae1-b288-d61890d845ad",
        "1c585991-c16b-499b-bded-aa333cdac1f4",
        "44c98fd0-7f85-4f40-bf5f-e2930cfd0ece",
        "26c61574-6217-4fd5-b2c3-1ac32a4f358c",
        "34a466f4-9863-48df-b290-1c1b94286a6c",
        "3c909586-932b-4f87-99ae-1eba86a0740d",
        "a1576f93-83ec-4b02-86c7-eb727a6b79db",
        "7d3e3de8-e820-4e69-a247-764893a769a3",
        "64a8412d-00c0-403f-a24d-1db785770e65"
      ],
      "results_limit": 50
    },
    {
      "group_key": "b_louis",
      "actor_id": "louisdeconinck/instagram-story-details-scraper",
      "collection_mode": "bakeoff",
      "account_ids": [
        "62a5fef9-78c3-418a-9010-d5ea54f29e45",
        "094f3df4-8467-4805-abb7-d2c12991a1fe",
        "aee74605-1714-4620-9e6c-95e0229db7ae",
        "34b95d90-12e6-42da-84f8-3fd78cd19103",
        "5105a7d9-282c-49dc-87be-dfe8034f6fdb",
        "93277ab3-f5d9-4f1d-b936-8bf4b84adb73",
        "5afae789-690b-40a0-a143-bd6c447920e9",
        "539f213a-6d96-4770-a964-0f32fadd9562",
        "f63b965d-b30c-4f0b-8e45-93d1b581f09f",
        "f665e025-29f4-4d57-97c7-3c81d1e2500f",
        "ca308821-eb96-439f-83b3-e868799bbac1",
        "6c7c9eaa-5ce8-4ae1-b288-d61890d845ad",
        "1c585991-c16b-499b-bded-aa333cdac1f4",
        "44c98fd0-7f85-4f40-bf5f-e2930cfd0ece",
        "26c61574-6217-4fd5-b2c3-1ac32a4f358c",
        "34a466f4-9863-48df-b290-1c1b94286a6c",
        "3c909586-932b-4f87-99ae-1eba86a0740d",
        "a1576f93-83ec-4b02-86c7-eb727a6b79db",
        "7d3e3de8-e820-4e69-a247-764893a769a3",
        "64a8412d-00c0-403f-a24d-1db785770e65"
      ],
      "results_limit": 50
    },
    {
      "group_key": "c_primary",
      "actor_id": "data-slayer/instagram-stories-scraper",
      "collection_mode": "ingest",
      "account_ids": [
        "62a5fef9-78c3-418a-9010-d5ea54f29e45",
        "094f3df4-8467-4805-abb7-d2c12991a1fe",
        "aee74605-1714-4620-9e6c-95e0229db7ae",
        "34b95d90-12e6-42da-84f8-3fd78cd19103",
        "5105a7d9-282c-49dc-87be-dfe8034f6fdb",
        "93277ab3-f5d9-4f1d-b936-8bf4b84adb73",
        "5afae789-690b-40a0-a143-bd6c447920e9",
        "539f213a-6d96-4770-a964-0f32fadd9562",
        "f63b965d-b30c-4f0b-8e45-93d1b581f09f",
        "f665e025-29f4-4d57-97c7-3c81d1e2500f",
        "ca308821-eb96-439f-83b3-e868799bbac1",
        "6c7c9eaa-5ce8-4ae1-b288-d61890d845ad",
        "1c585991-c16b-499b-bded-aa333cdac1f4",
        "44c98fd0-7f85-4f40-bf5f-e2930cfd0ece",
        "26c61574-6217-4fd5-b2c3-1ac32a4f358c",
        "34a466f4-9863-48df-b290-1c1b94286a6c",
        "3c909586-932b-4f87-99ae-1eba86a0740d",
        "a1576f93-83ec-4b02-86c7-eb727a6b79db",
        "7d3e3de8-e820-4e69-a247-764893a769a3",
        "64a8412d-00c0-403f-a24d-1db785770e65"
      ],
      "results_limit": 30
    }
  ],
  "actor_pins": {
    "data-slayer/instagram-stories-scraper": {
      "billingModel": "PPE",
      "owner_id": "nAuPNiU41ZLSsmcVx",
      "actorId": "z1rvDd9bJrnT4LVee",
      "build": "1.0.32",
      "buildId": "LbkXerigrUUa2dxt6",
      "memoryMbytes": 1024,
      "timeoutSecs": 180
    },
    "igview-owner/instagram-story-viewer": {
      "billingModel": "PPE",
      "owner_id": "nAuPNiU41ZLSsmcVx",
      "actorId": "7eNb0Yr5dLwy1jfPS",
      "build": "1.0.16",
      "buildId": "jhZNplLsVKuGelTTm",
      "memoryMbytes": 4096,
      "timeoutSecs": 180
    },
    "louisdeconinck/instagram-story-details-scraper": {
      "billingModel": "PPE",
      "owner_id": "nAuPNiU41ZLSsmcVx",
      "actorId": "9pQFsbs9nqUI64rDQ",
      "build": "0.0.10",
      "buildId": "4QpIiw2A9YDJ2aneN",
      "memoryMbytes": 256,
      "timeoutSecs": 180
    }
  },
  "max_actor_starts": 40,
  "max_actor_usd": 6,
  "max_total_usd": 240
}
$public_config$::jsonb);
  perform set_config('emr.m06_campaign_install_receipt',receipt::text,true);
end $install$;
select jsonb_build_object('observed_at',clock_timestamp(),'campaign_id','451d4e89-d32f-412a-84f7-ddb5528f4539',
  'installation',current_setting('emr.m06_campaign_install_receipt')::jsonb,
  'snapshot',ops.m06_campaign_snapshot('451d4e89-d32f-412a-84f7-ddb5528f4539')) as campaign_install;
commit;