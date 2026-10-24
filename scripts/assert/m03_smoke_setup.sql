-- Dev-only owner setup. Reviewed dev URI/preflight is required before psql.
-- -v emr_project_ref=zmotjsbzhzjvpelxvxlf; optional -v emr_smoke_rollback=true.
-- The supplied ref is an admission guard, not independent server identity proof.
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

do $smoke_setup$
declare
  v_comp app.competitors%rowtype;
  v_account app.competitor_accounts%rowtype;
  v_marker ops.audit_log%rowtype;
  v_baseline jsonb;
  v_url constant text := 'https://everyone.film/about-everyone';
begin
  if current_setting('emr.smoke_project_ref', true) is distinct from 'zmotjsbzhzjvpelxvxlf'
     or current_database() <> 'postgres' or session_user <> 'postgres' or current_user <> 'postgres' then
    raise exception using errcode='42501', message='M03 smoke requires the reviewed dev postgres owner context';
  end if;
  if current_setting('emr.smoke_rollback') not in ('true','false') then
    raise exception using errcode='22023', message='Smoke rollback mode must be exactly true or false';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-m03-smoke-fixture-v1',0));
  select c.* into v_comp from app.competitors c
    where c.company_code='C999' or c.slug='emr-smoke-test' for update;
  if found then
    if v_comp.company_code<>'C999' or v_comp.slug<>'emr-smoke-test' then
      raise exception using errcode='55000', message='C999 or smoke slug belongs to another fixture';
    end if;
    if (select count(*) from ops.audit_log l where l.actor_type='system'
      and l.actor_id='m03_smoke_setup.v1' and l.action='m03_smoke_fixture_created'
      and l.entity_type='competitor' and l.entity_id=v_comp.id::text)<>1 then
      raise exception using errcode='55000', message='Existing C999 has no unique owned M03 creation receipt';
    end if;
    select l.* into v_marker from ops.audit_log l where l.actor_type='system'
      and l.actor_id='m03_smoke_setup.v1' and l.action='m03_smoke_fixture_created'
      and l.entity_type='competitor' and l.entity_id=v_comp.id::text;
    select a.* into v_account from app.competitor_accounts a
      where a.competitor_id=v_comp.id for update;
    if not found or (select count(*) from app.competitor_accounts a where a.competitor_id=v_comp.id)<>1
       or v_marker.after->>'fixture_version' is distinct from '1'
       or v_marker.after->>'project_ref' is distinct from 'zmotjsbzhzjvpelxvxlf'
       or v_marker.after->>'account_id' is distinct from v_account.id::text
       or v_marker.after->>'competitor_id' is distinct from v_comp.id::text
       or v_marker.after->'competitor_identity' is distinct from
         (to_jsonb(v_comp)-array['status','created_at','updated_at','search_tsv'])
       or v_marker.after->'account_identity' is distinct from jsonb_build_object(
         'platform',v_account.platform,'handle',v_account.handle,'url',v_account.url,
         'external_id',v_account.external_id,'uploads_playlist_id',v_account.uploads_playlist_id,
         'resolve_status',v_account.resolve_status,'cadence',v_account.cadence,'backfill_from',v_account.backfill_from)
       or v_comp.status<>'active' or v_account.status not in ('active','failing') then
      raise exception using errcode='55000', message='Owned smoke fixture changed or is archived; no fields were overwritten';
    end if;
    -- Existing owned active fixture is returned unchanged, including all progress.
    return;
  end if;

  if exists(select 1 from app.competitor_accounts a where a.url=v_url
    or (a.platform='website_work_page' and a.handle_norm=lower(v_url))) then
    raise exception using errcode='55000', message='Smoke source is already owned by another account';
  end if;
  if (select count(*) from app.competitors)<>285
     or (select count(*) from app.competitor_accounts)<>1754
     or exists(select 1 from app.items) then
    raise exception using errcode='55000', message='M03 initial fixture requires the reviewed 285/1754 empty-item dev baseline';
  end if;
  select jsonb_build_object(
    'competitors',285,'accounts',1754,
    'competitors_sha256',encode(extensions.digest(
      (select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb)::text from app.competitors c),'sha256'),'hex'),
    'accounts_sha256',encode(extensions.digest(
      (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)::text from app.competitor_accounts a),'sha256'),'hex'))
    into v_baseline;
  insert into app.competitors(company_code,slug,name,priority_tier,status,website_url,notes)
    values('C999','emr-smoke-test','emr-smoke-test','adjacent','active',
      'https://everyone.film','Owned dev-only M03 foundation smoke fixture; retain all collected data.')
    returning * into v_comp;
  insert into app.competitor_accounts(competitor_id,platform,handle,url,resolve_status,status,backfill_status)
    values(v_comp.id,'website_work_page',v_url,v_url,'not_needed','active','pending')
    returning * into v_account;
  insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,after)
    values('system','m03_smoke_setup.v1','m03_smoke_fixture_created','competitor',v_comp.id::text,
      jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf',
        'competitor_id',v_comp.id,'account_id',v_account.id,
        'competitor_identity',to_jsonb(v_comp)-array['status','created_at','updated_at','search_tsv'],
        'account_identity',jsonb_build_object('platform',v_account.platform,'handle',v_account.handle,
          'url',v_account.url,'external_id',v_account.external_id,'uploads_playlist_id',v_account.uploads_playlist_id,
          'resolve_status',v_account.resolve_status,'cadence',v_account.cadence,'backfill_from',v_account.backfill_from),
        'baseline',v_baseline));
end;
$smoke_setup$;

select jsonb_build_object('result','M03_SMOKE_FIXTURE_READY','company_code',c.company_code,
  'competitor_id',c.id,'account_id',a.id,'platform',a.platform,'url',a.url,
  'competitor_status',c.status,'account_status',a.status) as m03_smoke_setup
from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
where c.company_code='C999' and c.slug='emr-smoke-test';

\if :emr_smoke_rollback
  rollback;
  \echo 'M03_SMOKE_SETUP_ROLLED_BACK_NOT_HOSTED_ACCEPTANCE'
\else
  commit;
\endif
