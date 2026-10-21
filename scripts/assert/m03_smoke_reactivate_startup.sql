-- Proposed dev-only retained-fixture operation; this file grants no live/time
-- authority and is not reachable from the existing setup/migration consumers.
-- Requires the separately approved consumer's exact history/catalog/window,
-- connection identity, durable one-attempt intent and deadline preflight.
-- PostgreSQL17 row/advisory locks: https://www.postgresql.org/docs/17/explicit-locking.html
-- Required psql -v emr_project_ref=zmotjsbzhzjvpelxvxlf
--   -v emr_smoke_reactivation_segment=e8035391-dba8-48c9-97e0-139ba980d86e
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

begin;
set local search_path = pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local emr.smoke_project_ref = :'emr_project_ref';
set local emr.smoke_reactivation_segment = :'emr_smoke_reactivation_segment';
set local emr.smoke_rollback = :'emr_smoke_rollback';

do $smoke_reactivate$
declare
  v_comp app.competitors%rowtype;
  v_account app.competitor_accounts%rowtype;
  v_marker ops.audit_log%rowtype;
  v_comp_id constant uuid := 'd51a39f6-fe87-4d17-aee9-3070c45693aa';
  v_account_id constant uuid := 'bd23314c-591f-4fb7-92fd-b7450634eeb6';
  v_segment constant text := '1c69c89e-7807-46d5-b7b8-ca28285ff2b4';
  v_url constant text := 'https://everyone.film/about-everyone';
  v_changed integer;
begin
  -- A supplied project ref is a guard, not independent hosted-server proof.
  if current_setting('emr.smoke_project_ref', true) is distinct from 'zmotjsbzhzjvpelxvxlf'
     or current_setting('emr.smoke_reactivation_segment', true) is distinct from v_segment
     or current_database() <> 'postgres' or session_user <> 'postgres' or current_user <> 'postgres' then
    raise exception using errcode='42501', message='M03_REACTIVATION_OWNER_CONTEXT_REQUIRED';
  end if;
  if current_setting('emr.smoke_rollback', true) is null
     or current_setting('emr.smoke_rollback', true) not in ('true','false') then
    raise exception using errcode='22023', message='M03_REACTIVATION_ROLLBACK_MODE_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-m03-smoke-fixture-v1',0));
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
  if v_marker.after->>'fixture_version' is distinct from '1'
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
  -- These rows have no locked_fields/locked_by_human columns. Preserve every
  -- identity field, refuse any other audit on their IDs, and refuse associated
  -- content/campaigns rather than touching any human-locked fields elsewhere.
  if exists(select 1 from ops.audit_log l where l.id<>v_marker.id
       and l.entity_id in (v_comp_id::text,v_account_id::text))
     or exists(select 1 from ops.audit_log l where l.action='m03_smoke_fixture_reactivated'
       and l.after->>'segment_id'=v_segment) then
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
