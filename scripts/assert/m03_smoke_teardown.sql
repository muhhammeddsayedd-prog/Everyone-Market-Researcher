-- Archive/pause only the receipt-owned dev smoke fixture. Never delete data.
-- -v emr_project_ref=zmotjsbzhzjvpelxvxlf; optional -v emr_smoke_rollback=true.
\set ON_ERROR_STOP on
\if :{?emr_project_ref}
\else
  do $admission$ begin raise exception using errcode='22023', message='M03_SMOKE_PROJECT_REF_REQUIRED'; end; $admission$;
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
set local emr.smoke_rollback = :'emr_smoke_rollback';

do $smoke_teardown$
declare
  v_comp app.competitors%rowtype;
  v_account app.competitor_accounts%rowtype;
  v_marker ops.audit_log%rowtype;
begin
  if current_setting('emr.smoke_project_ref', true) is distinct from 'zmotjsbzhzjvpelxvxlf'
     or current_database()<>'postgres' or session_user<>'postgres' or current_user<>'postgres' then
    raise exception using errcode='42501', message='M03 smoke teardown requires the reviewed dev postgres owner context';
  end if;
  if current_setting('emr.smoke_rollback') not in ('true','false') then
    raise exception using errcode='22023', message='Smoke rollback mode must be exactly true or false';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-m03-smoke-fixture-v1',0));
  select c.* into v_comp from app.competitors c where c.company_code='C999' or c.slug='emr-smoke-test' for update;
  if not found or v_comp.company_code<>'C999' or v_comp.slug<>'emr-smoke-test' then
    raise exception using errcode='55000', message='No exact owned M03 fixture is available to archive';
  end if;
  if (select count(*) from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_setup.v1'
    and l.action='m03_smoke_fixture_created' and l.entity_type='competitor' and l.entity_id=v_comp.id::text)<>1 then
    raise exception using errcode='55000', message='Existing C999 has no unique owned M03 creation receipt';
  end if;
  select l.* into v_marker from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_setup.v1'
    and l.action='m03_smoke_fixture_created' and l.entity_type='competitor' and l.entity_id=v_comp.id::text;
  select a.* into v_account from app.competitor_accounts a where a.competitor_id=v_comp.id for update;
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
     or v_comp.status not in ('active','archived') or v_account.status not in ('active','failing','paused') then
    raise exception using errcode='55000', message='Owned smoke fixture changed; no source or human fields were overwritten';
  end if;
  if (v_account.locked_until is not null and v_account.locked_until>now())
     or exists(select 1 from ops.scrape_runs r where r.id=v_account.last_run_id and r.status='running')
     or exists(select 1 from ops.apify_runs r where v_account.id=any(r.account_ids) and r.processed_at is null) then
    raise exception using errcode='55000', message='Smoke work is still pending; reconcile before archiving';
  end if;
  update app.competitors set status='archived' where id=v_comp.id and status<>'archived';
  update app.competitor_accounts set status='paused' where id=v_account.id and status<>'paused';
end;
$smoke_teardown$;

select jsonb_build_object('result','M03_SMOKE_FIXTURE_ARCHIVED','company_code',c.company_code,
  'competitor_id',c.id,'account_id',a.id,'competitor_status',c.status,'account_status',a.status,
  'retained_items',(select count(*) from app.items i where i.account_id=a.id)) as m03_smoke_teardown
from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
where c.company_code='C999' and c.slug='emr-smoke-test';

\if :emr_smoke_rollback
  rollback;
  \echo 'M03_SMOKE_TEARDOWN_ROLLED_BACK_NOT_HOSTED_ACCEPTANCE'
\else
  commit;
\endif
