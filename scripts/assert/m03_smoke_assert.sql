-- Read-only SQL state proof after an actual WF-99 callback or its replay.
-- Required psql vars: emr_project_ref, emr_run_id, emr_apify_run_id,
-- emr_expected_items_new (1 for first collection; 0 for a new run of the same page).
-- An unchanged DB snapshot alone does not prove a webhook replay was received.
\set ON_ERROR_STOP on
\if :{?emr_project_ref}
\else
  do $admission$ begin raise exception using errcode='22023', message='M03_SMOKE_PROJECT_REF_REQUIRED'; end; $admission$;
\endif
\if :{?emr_run_id}
\else
  do $admission$ begin raise exception using errcode='22023', message='M03_SMOKE_RUN_ID_REQUIRED'; end; $admission$;
\endif
\if :{?emr_apify_run_id}
\else
  do $admission$ begin raise exception using errcode='22023', message='M03_SMOKE_APIFY_RUN_ID_REQUIRED'; end; $admission$;
\endif
\if :{?emr_expected_items_new}
\else
  do $admission$ begin raise exception using errcode='22023', message='M03_SMOKE_EXPECTED_ITEMS_NEW_REQUIRED'; end; $admission$;
\endif

begin isolation level repeatable read read only;
set local search_path = pg_catalog;
set local statement_timeout = '30s';
set local emr.smoke_project_ref = :'emr_project_ref';
set local emr.smoke_run_id = :'emr_run_id';
set local emr.smoke_apify_run_id = :'emr_apify_run_id';
set local emr.smoke_expected_items_new = :'emr_expected_items_new';

do $smoke_assert$
declare
  v_comp app.competitors%rowtype;
  v_account app.competitor_accounts%rowtype;
  v_marker ops.audit_log%rowtype;
  v_run ops.scrape_runs%rowtype;
  v_actor ops.apify_runs%rowtype;
  v_result ops.scrape_run_accounts%rowtype;
  v_receipt jsonb;
  v_expected int;
  v_cost numeric;
  v_item_id uuid;
  v_url constant text := 'https://everyone.film/about-everyone';
begin
  if current_setting('emr.smoke_project_ref', true) is distinct from 'zmotjsbzhzjvpelxvxlf'
     or current_database()<>'postgres' or session_user<>'postgres' or current_user<>'postgres' then
    raise exception using errcode='42501', message='M03 smoke assertions require the reviewed dev postgres owner context';
  end if;
  if to_regprocedure('ops.process_apify_run(text,text,text,numeric,jsonb)') is null
     or not exists(select 1 from information_schema.columns where table_schema='ops'
       and table_name='apify_runs' and column_name='processing_result') then
    raise exception using errcode='55000', message='M03 atomic callback RPC/receipt is not deployed';
  end if;
  if current_setting('emr.smoke_expected_items_new') not in ('0','1') then
    raise exception using errcode='22023', message='Expected new items must be explicitly 0 or 1';
  end if;
  v_expected:=current_setting('emr.smoke_expected_items_new')::int;
  select c.* into v_comp from app.competitors c where c.company_code='C999' and c.slug='emr-smoke-test';
  if not found then raise exception using errcode='55000', message='Owned M03 competitor is absent';end if;
  if (select count(*) from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_setup.v1'
    and l.action='m03_smoke_fixture_created' and l.entity_type='competitor' and l.entity_id=v_comp.id::text)<>1 then
    raise exception using errcode='55000', message='Owned M03 creation receipt is absent or ambiguous';
  end if;
  select l.* into v_marker from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_setup.v1'
    and l.action='m03_smoke_fixture_created' and l.entity_type='competitor' and l.entity_id=v_comp.id::text;
  select a.* into v_account from app.competitor_accounts a where a.competitor_id=v_comp.id;
  if not found or (select count(*) from app.competitor_accounts a where a.competitor_id=v_comp.id)<>1
     or v_marker.after->>'fixture_version' is distinct from '1'
     or v_marker.after->>'project_ref' is distinct from 'zmotjsbzhzjvpelxvxlf'
     or v_marker.after->>'competitor_id' is distinct from v_comp.id::text
     or v_marker.after->>'account_id' is distinct from v_account.id::text
     or v_marker.after->'competitor_identity' is distinct from
       (to_jsonb(v_comp)-array['status','created_at','updated_at','search_tsv'])
     or v_marker.after->'account_identity' is distinct from jsonb_build_object(
       'platform',v_account.platform,'handle',v_account.handle,'url',v_account.url,
       'external_id',v_account.external_id,'uploads_playlist_id',v_account.uploads_playlist_id,
       'resolve_status',v_account.resolve_status,'cadence',v_account.cadence,'backfill_from',v_account.backfill_from)
     or v_account.platform<>'website_work_page' or v_account.url<>v_url or v_account.handle<>v_url then
    raise exception using errcode='55000', message='M03 source ownership differs from the creation receipt';
  end if;
  select r.* into v_run from ops.scrape_runs r where r.id=current_setting('emr.smoke_run_id')::uuid;
  if not found or v_run.workflow<>'WF-99' or v_run.env<>'dev' or v_run.mode<>'manual'
     or v_run.platform<>'website_work_page' or v_run.status<>'success' or v_run.finished_at is null
     or v_run.accounts_total<>1 or v_run.accounts_ok<>1 or v_run.accounts_failed<>0
     or v_run.items_seen<>1 or v_run.items_new<>v_expected or v_run.cost_usd<=0 then
    raise exception using errcode='55000', message='WF-99 final run aggregate does not match the expected actual smoke result';
  end if;
  select r.* into v_actor from ops.apify_runs r where r.apify_run_id=current_setting('emr.smoke_apify_run_id');
  if not found or v_actor.run_id is distinct from v_run.id or v_actor.account_ids is distinct from array[v_account.id]
     or v_actor.actor_id not in ('apify/website-content-crawler','aYG0l9s7dbB7j3gbS') or v_actor.purpose<>'daily'
     or v_actor.status<>'SUCCEEDED' or v_actor.processed_at is null or v_actor.finished_at is null
     or nullif(v_actor.dataset_id,'') is null or v_actor.usage_usd is distinct from v_run.cost_usd
     or (select count(*) from ops.apify_runs r where r.run_id=v_run.id)<>1 then
    raise exception using errcode='55000', message='Verified registered actor final state is missing or inconsistent';
  end if;
  v_receipt:=to_jsonb(v_actor)->'processing_result';
  if v_receipt is null or v_receipt->>'run_id' is distinct from v_run.id::text
     or v_receipt->>'apify_run_id' is distinct from v_actor.apify_run_id
     or v_receipt->'account_ids' is distinct from to_jsonb(array[v_account.id])
     or v_receipt->>'status' is distinct from 'SUCCEEDED'
     or v_receipt->>'dataset_id' is distinct from v_actor.dataset_id
     or v_receipt->>'normalizer_version' is distinct from 'smoke_website_stub.v1'
     or coalesce(v_receipt->>'groups_sha256','')!~'^[0-9a-f]{64}$'
     or (v_receipt->>'items_seen')::int is distinct from 1
     or (v_receipt->>'items_new')::int is distinct from v_expected
     or (v_receipt->>'accounts_ok')::int is distinct from 1
     or (v_receipt->>'accounts_failed')::int is distinct from 0
     or (v_receipt->>'cost_usd')::numeric is distinct from v_run.cost_usd
     or v_receipt->'cost_keys' is distinct from jsonb_build_array('apify:'||v_actor.apify_run_id||':'||v_account.id::text)
     or v_receipt->'run_summary'->>'status' is distinct from 'success'
     or v_receipt->'run_summary'->>'run_id' is distinct from v_run.id::text
     or jsonb_typeof(v_receipt->'new_item_ids') is distinct from 'array'
     or jsonb_array_length(v_receipt->'new_item_ids')<>v_expected then
    raise exception using errcode='55000', message='Atomic processing receipt does not match durable smoke aggregates';
  end if;
  select r.* into v_result from ops.scrape_run_accounts r where r.run_id=v_run.id and r.account_id=v_account.id;
  if not found or v_result.status<>'success' or v_result.items_seen<>1 or v_result.items_new<>v_expected
     or v_result.error is not null or (select count(*) from ops.scrape_run_accounts r where r.run_id=v_run.id)<>1 then
    raise exception using errcode='55000', message='Atomic smoke account result is missing or inconsistent';
  end if;
  if (select count(*) from ops.cost_ledger l where l.run_id=v_run.id)<>1 then
    raise exception using errcode='55000', message='Smoke requires exactly one cost row for this run';
  end if;
  select l.cost_usd into v_cost from ops.cost_ledger l where l.run_id=v_run.id and l.provider='apify'
    and l.category='scrape' and l.competitor_id=v_comp.id and l.platform='website_work_page'
    and l.meta->>'apify_run_id'=v_actor.apify_run_id and l.meta->>'account_id'=v_account.id::text
    and l.meta->>'cost_key'='apify:'||v_actor.apify_run_id||':'||v_account.id::text;
  if not found or v_cost is distinct from v_run.cost_usd then
    raise exception using errcode='55000', message='Stable keyed smoke cost differs from the verified actor usage';
  end if;
  if (select count(*) from app.items i where i.account_id=v_account.id)<>1 then
    raise exception using errcode='55000', message='Smoke item cardinality is not exactly one';
  end if;
  select i.id into v_item_id from app.items i where i.account_id=v_account.id and i.competitor_id=v_comp.id
    and i.platform='website_work_page' and i.item_type='project_page' and i.url=v_url
    and i.external_id=left(encode(extensions.digest(v_url,'sha256'),'hex'),32);
  if not found or (v_expected=1 and v_receipt->'new_item_ids' is distinct from jsonb_build_array(v_item_id))
     or (select count(*) from ingest.raw_items r where r.account_id=v_account.id)<>1
     or not exists(select 1 from ingest.raw_items r where r.account_id=v_account.id
       and r.platform='website_work_page' and r.actor='apify/website-content-crawler'
       and r.external_id=left(encode(extensions.digest(v_url,'sha256'),'hex'),32)
       and r.normalized->>'url'=v_url and r.normalized->>'item_type'='project_page'
       and r.payload->>'url'=v_url and jsonb_typeof(r.payload->'markdown')='string'
       and char_length(r.payload->>'markdown')<=8000
       and r.payload ?& array['url','markdown','metadata']
       and jsonb_typeof(r.payload->'metadata')='object'
       and not exists(select 1 from jsonb_object_keys(r.payload->'metadata') k where k<>'title')
       and (jsonb_typeof(r.payload->'metadata'->'title')='null'
         or (jsonb_typeof(r.payload->'metadata'->'title')='string'
           and char_length(r.payload->'metadata'->>'title')<=2000))
       and not exists(select 1 from jsonb_object_keys(r.payload) k where k not in ('url','markdown','metadata'))) then
    raise exception using errcode='55000', message='Smoke item identity/raw cardinality differs from the dedicated source';
  end if;
  if (select count(*) from app.competitors c where c.id<>v_comp.id)<>285
     or (select count(*) from app.competitor_accounts a where a.competitor_id<>v_comp.id)<>1754
     or exists(select 1 from app.items i where i.account_id is distinct from v_account.id)
     or v_marker.after->'baseline'->>'competitors_sha256' is distinct from encode(extensions.digest(
       (select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb)::text from app.competitors c where c.id<>v_comp.id),'sha256'),'hex')
     or v_marker.after->'baseline'->>'accounts_sha256' is distinct from encode(extensions.digest(
       (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)::text from app.competitor_accounts a where a.competitor_id<>v_comp.id),'sha256'),'hex') then
    raise exception using errcode='55000', message='Unrelated seeded competitors/accounts changed since smoke setup';
  end if;
end;
$smoke_assert$;

select jsonb_build_object('result','M03_SMOKE_SQL_STATE_PASS',
  'run_id',current_setting('emr.smoke_run_id'),
  'apify_run_id',current_setting('emr.smoke_apify_run_id'),
  'expected_items_new',current_setting('emr.smoke_expected_items_new')::int,
  'webhook_delivery_or_replay_proven',false) as m03_smoke_assert;
commit;
