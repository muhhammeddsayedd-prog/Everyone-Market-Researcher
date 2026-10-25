-- Dev-only retained-fixture operation under standing M03 authority. This file
-- itself grants no hosted access or permission to reopen a closed attempt.
-- Requires the reviewed consumer's exact history/catalog/window,
-- connection identity, durable one-attempt intent and deadline preflight.
-- PostgreSQL17 row/advisory locks: https://www.postgresql.org/docs/17/explicit-locking.html
-- Required psql -v emr_project_ref=zmotjsbzhzjvpelxvxlf
--   -v emr_smoke_reactivation_segment=20275b22-b7fe-4737-a9a4-c50c2feadb74
-- Optional -v emr_smoke_technical_ordinal=1 (consumer derives it from the
-- immutable selected admission; later attempts require every exact prior audit).
-- Optional -v emr_smoke_rollback=true (all table changes roll back).
\set ON_ERROR_STOP on
\if :{?emr_project_ref}
\else
  do $admission$ begin raise exception using errcode='22023', message='M03_SMOKE_PROJECT_REF_REQUIRED'; end; $admission$;
\endif
\if :{?emr_smoke_reactivation_segment}
\else
  do $admission$ begin raise exception using errcode='22023', message='M03_SMOKE_REACTIVATION_SEGMENT_REQUIRED'; end; $admission$;
\endif
\if :{?emr_smoke_rollback}
\else
  \set emr_smoke_rollback false
\endif
\if :{?emr_smoke_technical_ordinal}
\else
  \set emr_smoke_technical_ordinal 1
\endif

begin;
set local search_path = pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local emr.smoke_project_ref = :'emr_project_ref';
set local emr.smoke_reactivation_segment = :'emr_smoke_reactivation_segment';
set local emr.smoke_rollback = :'emr_smoke_rollback';
set local emr.smoke_technical_ordinal = :'emr_smoke_technical_ordinal';

do $smoke_reactivate$
declare
  v_comp app.competitors%rowtype;
  v_account app.competitor_accounts%rowtype;
  v_marker ops.audit_log%rowtype;
  v_previous ops.audit_log%rowtype;
  v_previous_segment text;
  v_known_audit_ids bigint[];
  v_previous_id bigint;
  v_previous_at timestamptz;
  v_technical_text text;
  v_technical integer;
  v_index integer;
  v_comp_id constant uuid := 'd51a39f6-fe87-4d17-aee9-3070c45693aa';
  v_account_id constant uuid := 'bd23314c-591f-4fb7-92fd-b7450634eeb6';
  v_family_segment constant text := '20275b22-b7fe-4737-a9a4-c50c2feadb74';
  v_segment text;
  v_url constant text := 'https://everyone.film/about-everyone';
  v_changed integer;
begin
  -- A supplied project ref is a guard, not independent hosted-server proof.
  if current_setting('emr.smoke_project_ref', true) is distinct from 'zmotjsbzhzjvpelxvxlf'
     or current_setting('emr.smoke_reactivation_segment', true) is distinct from v_family_segment
     or current_database() <> 'postgres' or session_user <> 'postgres' or current_user <> 'postgres' then
    raise exception using errcode='42501', message='M03_REACTIVATION_OWNER_CONTEXT_REQUIRED';
  end if;
  v_technical_text:=coalesce(nullif(current_setting('emr.smoke_technical_ordinal',true),''),'1');
  if v_technical_text !~ '^[1-9][0-9]{0,3}$' then
    raise exception using errcode='22023', message='M03_REACTIVATION_TECHNICAL_ORDINAL_REQUIRED';
  end if;
  if v_technical_text::integer>1023 then
    raise exception using errcode='22023', message='M03_REACTIVATION_TECHNICAL_ORDINAL_REQUIRED';
  end if;
  v_technical:=v_technical_text::integer;
  -- Technical14 stopped at browser discovery before any database child or
  -- fixture operation. The reviewed native consumer verifies its immutable
  -- closed/cleanup receipts before supplying this one fixed missing-audit proof.
  if v_technical in (15,16,17,18,19,20,21) and current_setting('emr.smoke_technical14_no_reactivation',true)
     is distinct from '6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960' then
    raise exception using errcode='55000', message='M03_REACTIVATION_TECHNICAL14_PROOF_REQUIRED';
  end if;
  if v_technical in (16,17,18,19,20,21) and current_setting('emr.smoke_technical15_no_reactivation',true)
     is distinct from '59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd' then
    raise exception using errcode='55000', message='M03_REACTIVATION_TECHNICAL15_PROOF_REQUIRED';
  end if;
  if v_technical in (18,19,20,21) and current_setting('emr.smoke_technical17_no_reactivation',true)
     is distinct from 'd16198186698ddefdad06902f4c39d50ac51e46e87686d77bb3d0f3429f491ac' then
    raise exception using errcode='55000', message='M03_REACTIVATION_TECHNICAL17_PROOF_REQUIRED';
  end if;
  if v_technical in (19,20,21) and current_setting('emr.smoke_technical18_no_reactivation',true)
     is distinct from '92a5976dbce66210abbdd76655afaf71a98c9c48f29c8c15422831a85f3737d9' then
    raise exception using errcode='55000', message='M03_REACTIVATION_TECHNICAL18_PROOF_REQUIRED';
  end if;
  if v_technical=21 and current_setting('emr.smoke_technical20_no_reactivation',true)
     is distinct from 'd5f4353439ff6a3254f71609048ff43aa1d453308b5708bd968182ce959bf983' then
    raise exception using errcode='55000', message='M03_REACTIVATION_TECHNICAL20_PROOF_REQUIRED';
  end if;
  v_segment:=v_family_segment||case when v_technical=1 then '' else ':technical-'||v_technical end;
  if current_setting('emr.smoke_rollback', true) is null
     or current_setting('emr.smoke_rollback', true) not in ('true','false') then
    raise exception using errcode='22023', message='M03_REACTIVATION_ROLLBACK_MODE_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-m03-smoke-fixture-v1',0));
  -- Block concurrent edits/audit inserts while validating the retained lifecycle
  -- and baseline. Collection tables stay read-only under short shared locks.
  lock table app.competitors, app.competitor_accounts, ops.audit_log in share row exclusive mode;
  lock table app.items, app.campaigns, app.website_pages, app.employee_snapshots,
    app.stats_daily, ops.scrape_runs, ops.scrape_run_accounts, ops.apify_runs,
    ops.cost_ledger, ingest.raw_items, pgmq.q_ai_extract, pgmq.a_ai_extract,
    pgmq.q_embed, pgmq.a_embed, pgmq.q_media, pgmq.a_media in share mode;
  if v_technical in (18,19,20,21) and exists(select 1 from ops.audit_log l
       where l.actor_id='m03_smoke_reactivate.v1:'||v_family_segment||':technical-17'
          or l.after->>'segment_id'=v_family_segment||':technical-17') then
    raise exception using errcode='55000', message='M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT';
  end if;
  select c.* into v_comp from app.competitors c where c.id=v_comp_id for update;
  if not found or v_comp.company_code<>'C999' or v_comp.slug<>'emr-smoke-test' or v_comp.status<>'archived'
     or (select count(*) from app.competitors where company_code='C999' or slug='emr-smoke-test')<>1 then
    raise exception using errcode='55000', message='M03_REACTIVATION_EXACT_ARCHIVED_COMPETITOR_REQUIRED';
  end if;
  select a.* into v_account from app.competitor_accounts a
    where a.id=v_account_id and a.competitor_id=v_comp_id for update;
  if not found or v_account.status<>'paused'
     or (select count(*) from app.competitor_accounts where competitor_id=v_comp_id)<>1
     or v_account.platform<>'website_work_page' or v_account.url<>v_url or v_account.handle<>v_url
     or exists(select 1 from app.competitor_accounts a where a.id<>v_account_id
       and (a.url=v_url or (a.platform='website_work_page' and a.handle_norm=lower(v_url)))) then
    raise exception using errcode='55000', message='M03_REACTIVATION_EXACT_PAUSED_ACCOUNT_REQUIRED';
  end if;
  if (select count(*) from ops.audit_log l where l.actor_type='system'
    and l.actor_id='m03_smoke_setup.v1' and l.action='m03_smoke_fixture_created'
    and l.entity_type='competitor' and l.entity_id=v_comp_id::text)<>1 then
    raise exception using errcode='55000', message='M03_REACTIVATION_UNIQUE_CREATION_RECEIPT_REQUIRED';
  end if;
  select l.* into v_marker from ops.audit_log l where l.actor_type='system'
    and l.actor_id='m03_smoke_setup.v1' and l.action='m03_smoke_fixture_created'
    and l.entity_type='competitor' and l.entity_id=v_comp_id::text for share;
  if jsonb_typeof(v_marker.after) is distinct from 'object' then
    raise exception using errcode='55000', message='M03_REACTIVATION_ORIGINAL_IDENTITIES_CHANGED';
  end if;
  if v_marker.before is not null
     or (select count(*) from jsonb_object_keys(v_marker.after))<>7
     or v_marker.after->'fixture_version' is distinct from '1'::jsonb
     or v_marker.after->>'project_ref' is distinct from 'zmotjsbzhzjvpelxvxlf'
     or v_marker.after->>'competitor_id' is distinct from v_comp_id::text
     or v_marker.after->>'account_id' is distinct from v_account_id::text
     or v_marker.after->'competitor_identity' is distinct from
       (to_jsonb(v_comp)-array['status','created_at','updated_at','search_tsv'])
     or v_marker.after->'account_identity' is distinct from jsonb_build_object(
       'platform',v_account.platform,'handle',v_account.handle,'url',v_account.url,
       'external_id',v_account.external_id,'uploads_playlist_id',v_account.uploads_playlist_id,
       'resolve_status',v_account.resolve_status,'cadence',v_account.cadence,'backfill_from',v_account.backfill_from) then
    raise exception using errcode='55000', message='M03_REACTIVATION_ORIGINAL_IDENTITIES_CHANGED';
  end if;
  -- The immutable native admission selects the ordinal. Require the exact
  -- known committed lifecycle: startup, original20275 and technical2.
  -- The coordinator pins closed attempts3..8, the pre-private failure9 and
  -- the authenticated catalog refusal10 and no-Admin admission refusal11,
  -- all before fixture reactivation,
  -- with no committed fixture reactivation. Skip only that fixed gap after
  -- the validated reconciliation; never fabricate its audits.
  -- Unknown edits/audits below remain denied, and later ordinals stay contiguous.
  -- Archives have no SQL audit: the coordinator separately pins their actual
  -- receipts. SQL proves current archived state/order, not archive-process identity.
  v_known_audit_ids:=array[v_marker.id];
  v_previous_id:=v_marker.id;v_previous_at:=v_marker.created_at;
  for v_index in 0..v_technical-1 loop
    continue when (v_technical>=9 and v_index between 3 and 11)
      or (v_technical in (15,16,17,18,19,20,21) and v_index=14 and current_setting('emr.smoke_technical14_no_reactivation',true)
        ='6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960')
      or (v_technical in (16,17,18,19,20,21) and v_index=15 and current_setting('emr.smoke_technical15_no_reactivation',true)
        ='59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd')
      or (v_technical in (18,19,20,21) and v_index=17 and current_setting('emr.smoke_technical17_no_reactivation',true)
        ='d16198186698ddefdad06902f4c39d50ac51e46e87686d77bb3d0f3429f491ac')
      or (v_technical in (19,20,21) and v_index=18 and current_setting('emr.smoke_technical18_no_reactivation',true)
        ='92a5976dbce66210abbdd76655afaf71a98c9c48f29c8c15422831a85f3737d9')
      or (v_technical=21 and v_index=20 and current_setting('emr.smoke_technical20_no_reactivation',true)
        ='d5f4353439ff6a3254f71609048ff43aa1d453308b5708bd968182ce959bf983');
    v_previous_segment:=case when v_index=0 then '1c69c89e-7807-46d5-b7b8-ca28285ff2b4'
      when v_index=1 then v_family_segment else v_family_segment||':technical-'||v_index end;
    if (select count(*) from ops.audit_log l
      where l.actor_id='m03_smoke_reactivate.v1:'||v_previous_segment
         or (l.action='m03_smoke_fixture_reactivated' and l.after->>'segment_id'=v_previous_segment))<>1 then
      raise exception using errcode='55000', message='M03_REACTIVATION_UNIQUE_PRIOR_REACTIVATION_REQUIRED';
    end if;
    select l.* into v_previous from ops.audit_log l
      where l.actor_id='m03_smoke_reactivate.v1:'||v_previous_segment for share;
    if not found or v_previous.actor_type<>'system'
     or v_previous.action<>'m03_smoke_fixture_reactivated'
     or v_previous.entity_type is distinct from 'competitor'
     or v_previous.entity_id is distinct from v_comp_id::text
     or v_previous.before is distinct from jsonb_build_object('competitor_status','archived','account_status','paused')
     or v_previous.after is distinct from jsonb_build_object(
       'fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf','segment_id',v_previous_segment,
       'competitor_id',v_comp_id,'account_id',v_account_id,'competitor_status','active','account_status','active',
       'original_creation_audit_id',v_marker.id)
     or v_previous.id<=v_previous_id or v_previous.created_at<=v_previous_at then
      raise exception using errcode='55000', message='M03_REACTIVATION_PRIOR_LIFECYCLE_CHANGED';
    end if;
    v_known_audit_ids:=array_append(v_known_audit_ids,v_previous.id);
    v_previous_id:=v_previous.id;v_previous_at:=v_previous.created_at;
  end loop;
  if v_comp.created_at is distinct from v_marker.created_at
     or v_account.created_at is distinct from v_marker.created_at
     or v_account.updated_at is distinct from v_account.created_at
     or v_comp.updated_at<=v_previous_at or v_comp.updated_at>transaction_timestamp() then
    raise exception using errcode='55000', message='M03_REACTIVATION_PRIOR_LIFECYCLE_CHANGED';
  end if;
  -- Reject unknown/human/API edits, including fixture references hidden behind
  -- a different entity_id. Preserve every known audit row byte-for-byte.
  if exists(select 1 from ops.audit_log l where l.id<>all(v_known_audit_ids)
       and (l.entity_id in (v_comp_id::text,v_account_id::text)
         or l.before->>'competitor_id'=v_comp_id::text or l.after->>'competitor_id'=v_comp_id::text
         or l.before->>'account_id'=v_account_id::text or l.after->>'account_id'=v_account_id::text
         or l.actor_id='m03_smoke_reactivate.v1:'||v_family_segment
         or l.actor_id like 'm03_smoke_reactivate.v1:'||v_family_segment||':technical-%'
         or l.after->>'segment_id'=v_family_segment
         or l.after->>'segment_id' like v_family_segment||':technical-%'))
     or exists(select 1 from ops.audit_log l
       where l.actor_id='m03_smoke_reactivate.v1:'||v_segment or l.after->>'segment_id'=v_segment) then
    raise exception using errcode='55000', message='M03_REACTIVATION_PRIOR_EDIT_OR_ATTEMPT_PRESENT';
  end if;
  if v_account.locked_until is not null or v_account.last_run_id is not null
     or v_account.last_success_at is not null or v_account.last_error_at is not null or v_account.last_error is not null
     or v_account.consecutive_failures<>0 or v_account.last_item_published_at is not null
     or v_account.last_external_id is not null or v_account.backfill_status<>'pending'
     or v_account.backfill_cursor is not null or v_account.items_count<>0
     or v_account.next_due_at is distinct from v_account.created_at then
    raise exception using errcode='55000', message='M03_REACTIVATION_ACCOUNT_PROGRESS_PRESENT';
  end if;
  if exists(select 1 from app.items) or exists(select 1 from ingest.raw_items)
     or exists(select 1 from ops.scrape_runs) or exists(select 1 from ops.apify_runs)
     or exists(select 1 from ops.scrape_run_accounts where account_id=v_account_id)
     or exists(select 1 from app.campaigns where production_competitor_id=v_comp_id)
     or exists(select 1 from app.website_pages where competitor_id=v_comp_id or account_id=v_account_id)
     or exists(select 1 from app.employee_snapshots where competitor_id=v_comp_id or account_id=v_account_id)
     or exists(select 1 from app.stats_daily where competitor_id=v_comp_id)
     or exists(select 1 from ops.cost_ledger where competitor_id=v_comp_id or meta->>'account_id'=v_account_id::text)
     or exists(select 1 from pgmq.q_ai_extract) or exists(select 1 from pgmq.a_ai_extract)
     or exists(select 1 from pgmq.q_embed) or exists(select 1 from pgmq.a_embed)
     or exists(select 1 from pgmq.q_media) or exists(select 1 from pgmq.a_media) then
    raise exception using errcode='55000', message='M03_REACTIVATION_COLLECTION_EFFECTS_PRESENT';
  end if;
  if (select count(*) from app.competitors)<>286 or (select count(*) from app.competitor_accounts)<>1755
     or (select count(*) from app.competitors where id<>v_comp_id)<>285
     or (select count(*) from app.competitor_accounts where competitor_id<>v_comp_id)<>1754
     or v_marker.after->'baseline'->>'competitors' is distinct from '285'
     or v_marker.after->'baseline'->>'accounts' is distinct from '1754'
     or v_marker.after->'baseline'->>'competitors_sha256' is distinct from encode(extensions.digest(
       (select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb)::text from app.competitors c where c.id<>v_comp_id),'sha256'),'hex')
     or v_marker.after->'baseline'->>'accounts_sha256' is distinct from encode(extensions.digest(
       (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)::text from app.competitor_accounts a where a.competitor_id<>v_comp_id),'sha256'),'hex') then
    raise exception using errcode='55000', message='M03_REACTIVATION_ORIGINAL_BASELINE_CHANGED';
  end if;

  -- Only statuses change explicitly. Existing competitors_tsv owns its normal
  -- updated_at/search_tsv maintenance; no account timestamp trigger is invented.
  update app.competitors set status='active' where id=v_comp_id and status='archived';
  get diagnostics v_changed = row_count;
  if v_changed<>1 then raise exception using errcode='55000', message='M03_REACTIVATION_COMPETITOR_CONFLICT';end if;
  update app.competitor_accounts set status='active' where id=v_account_id and status='paused';
  get diagnostics v_changed = row_count;
  if v_changed<>1 then raise exception using errcode='55000', message='M03_REACTIVATION_ACCOUNT_CONFLICT';end if;
  insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,before,after)
    values('system','m03_smoke_reactivate.v1:'||v_segment,'m03_smoke_fixture_reactivated','competitor',v_comp_id::text,
      jsonb_build_object('competitor_status','archived','account_status','paused'),
      jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf','segment_id',v_segment,
        'competitor_id',v_comp_id,'account_id',v_account_id,'competitor_status','active','account_status','active',
        'original_creation_audit_id',v_marker.id));
end;
$smoke_reactivate$;

select jsonb_build_object('result','M03_SMOKE_FIXTURE_READY','company_code',c.company_code,
  'competitor_id',c.id,'account_id',a.id,'platform',a.platform,'url',a.url,
  'competitor_status',c.status,'account_status',a.status) as m03_smoke_reactivate
from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
where c.id='d51a39f6-fe87-4d17-aee9-3070c45693aa' and a.id='bd23314c-591f-4fb7-92fd-b7450634eeb6';

\if :emr_smoke_rollback
  rollback;
  \echo 'M03_SMOKE_REACTIVATION_ROLLED_BACK_NOT_HOSTED_ACCEPTANCE'
\else
  commit;
\endif
