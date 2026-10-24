-- M03 forward-only dev technical continuation. The fourteen applied versions,
-- closed window rows and all request/launch/audit IDs remain unchanged.
-- Existing fixed-family table only; no registry, seeded row, active window,
-- fixture mutation, credential, schedule or paid start is created here.
-- First reviewed manifest UUID:38b3708d-61b0-41d2-8170-5ed91c66b4dc.
-- One active owner-registered window; SUM256 includes Close, two sequential
-- USD1 starts/USD2 lifetime reserve, shared rates and one distinct item.
-- https://www.postgresql.org/docs/17/explicit-locking.html

do $prior_closed$
begin
  if exists(select 1 from ops.foundation_gateway_rate_windows where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and (closed_at is null or close_count<>1 or admitted_count<>2)) then
    raise exception using errcode='55000',message='foundation_prior_window_not_closed';
  end if;
end;
$prior_closed$;

alter table ops.foundation_gateway_rate_windows
  drop constraint foundation_gateway_rate_windows_pkey,
  drop constraint foundation_gateway_rate_windows_window_id_check;
alter table ops.foundation_gateway_rate_windows add primary key(namespace,window_id);
-- The original fixed namespace/dev/project checks, unique UUID/FKs and RLS stay.
-- Legacy ops.foundation_gateway_provision(jsonb) is intentionally unchanged.

create or replace function ops.foundation_gateway_provision(p_window_id uuid,p jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_keys text[]; v_now timestamptz:=clock_timestamp(); v_window uuid:=p_window_id;
begin
  if session_user not in ('postgres','supabase_admin') or jsonb_typeof(p) is distinct from 'object' then
    raise exception using errcode='42501',message='foundation_owner_control_denied';
  end if;
  select array_agg(k order by k) into v_keys from jsonb_object_keys(p) k;
  if v_keys<>array['actorBuild','approvalReference','audience','batchMaxUsd','commitSha','deploymentId','maxTotalChargeUsd']
    or p->>'audience' is null or p->>'audience' !~ '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$'
    or p->>'commitSha' is null or p->>'commitSha' !~ '^[0-9a-f]{40}$'
    or p->>'deploymentId' is null or p->>'deploymentId' !~ '^dpl_[A-Za-z0-9_-]{1,100}$'
    or p->>'actorBuild' is distinct from '0.3.99'
    or p->>'approvalReference' is null or p->>'approvalReference' !~ '^[A-Za-z0-9_./:-]{1,200}$'
    or jsonb_typeof(p->'maxTotalChargeUsd') is distinct from 'number' or jsonb_typeof(p->'batchMaxUsd') is distinct from 'number' then
    raise exception using errcode='22023',message='foundation_invalid_owner_packet';
  end if;
  -- The existing fixed dev-family table is the sole registration authority.
  -- One active logical window; closed rows and old manifests are never updated.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('m03-foundation-gateway-family-v1',0));
  if v_window is null or v_window='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'::uuid or v_window='76c2ad42-c094-4ba4-9a0b-566e19b97780'::uuid
    or exists(select 1 from ops.foundation_gateway_rate_windows where window_id=v_window)
    or p->'maxTotalChargeUsd' is distinct from '1'::jsonb or p->'batchMaxUsd' is distinct from '2'::jsonb
    or p->>'approvalReference' is distinct from 'M03-A-D-f42930f-20261021'
    or not exists(select 1 from ops.foundation_gateway_rate_windows w join ops.apify_launch_approvals a using(window_id)
      where w.window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and w.closed_at is not null and w.close_count=1 and w.admitted_count=2 and a.closed_at is not null)
    or exists(select 1 from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and (closed_at is null or close_count<>1))
    or (select coalesce(sum(admitted_count),0) from ops.foundation_gateway_rate_windows where window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev'))>=255
    or exists(select 1 from ops.foundation_gateway_requests where window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and (state='reserved' or completed_at is null))
    or exists(select 1 from ops.foundation_gateway_leases where window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and request_id is not null)
    or exists(select 1 from ops.apify_launch_admissions l left join ops.apify_runs r using(apify_run_id)
      where l.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and (l.apify_run_id is null or r.processed_at is null or r.usage_usd is null or r.usage_usd<0 or r.usage_usd>l.max_total_charge_usd))
    or exists(select 1 from ops.scrape_runs r join ops.foundation_gateway_run_bindings b on b.run_id=r.id where b.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and r.status='running')
    or exists(select 1 from ops.apify_runs r where not exists(select 1 from ops.apify_launch_admissions l where l.apify_run_id=r.apify_run_id and l.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev')))
    or (select count(*) from ops.apify_launch_admissions where window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev'))>2
    or (select coalesce(sum(max_total_charge_usd),0) from ops.apify_launch_admissions where window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev'))>2
    or (select count(*) from app.items)>1
    or exists(select 1 from app.items where competitor_id is distinct from 'd51a39f6-fe87-4d17-aee9-3070c45693aa'::uuid)
    or not exists(select 1 from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
      where c.id='d51a39f6-fe87-4d17-aee9-3070c45693aa' and c.company_code='C999' and c.slug='emr-smoke-test' and c.status='archived'
        and a.id='bd23314c-591f-4fb7-92fd-b7450634eeb6' and a.status='paused' and a.platform='website_work_page'
        and a.url='https://everyone.film/about-everyone' and (a.locked_until is null or a.locked_until<=v_now)
        and (a.last_run_id is null or not exists(select 1 from ops.scrape_runs r where r.id=a.last_run_id and r.status='running')) and a.items_count<=1
        and (select count(*) from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_setup.v1'
          and l.action='m03_smoke_fixture_created' and l.entity_type='competitor' and l.entity_id=c.id::text
          and l.after->>'fixture_version'='1' and l.after->>'project_ref'='zmotjsbzhzjvpelxvxlf'
          and l.after->>'competitor_id'=c.id::text and l.after->>'account_id'=a.id::text
          and l.after->'competitor_identity'=to_jsonb(c)-array['status','created_at','updated_at','search_tsv']
          and l.after->'account_identity'=jsonb_build_object('platform',a.platform,'handle',a.handle,'url',a.url,
            'external_id',a.external_id,'uploads_playlist_id',a.uploads_playlist_id,'resolve_status',a.resolve_status,
            'cadence',a.cadence,'backfill_from',a.backfill_from))=1) then
    raise exception using errcode='55000',message='foundation_continuation_prior_state_required';
  end if;
  -- No ON CONFLICT update: an existing prepared, opened, expired or closed
  -- window is never re-provisioned, reset or given another execution allowance.
  insert into ops.foundation_gateway_rate_windows(namespace,window_id,project_ref,environment,
    bound_audience,bound_commit_sha,bound_deployment_id)
  values('m03-foundation-dev',v_window,'zmotjsbzhzjvpelxvxlf','dev',p->>'audience',p->>'commitSha',p->>'deploymentId');
  insert into ops.foundation_gateway_leases(window_id,slot) values(v_window,1),(v_window,2);
  insert into ops.apify_launch_approvals(window_id,approval_reference,project_ref,actor_build,
    max_total_charge_usd,batch_max_usd,not_before,expires_at)
  values(v_window,p->>'approvalReference','zmotjsbzhzjvpelxvxlf',p->>'actorBuild',
    (p->>'maxTotalChargeUsd')::numeric,(p->>'batchMaxUsd')::numeric,v_now,v_now+interval '60 minutes');
end;
$$;

revoke all on function ops.foundation_gateway_provision(uuid,jsonb) from public,anon,authenticated,api_agent,n8n_writer,service_role;

create or replace function ops.foundation_gateway_validate(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb)
returns void language plpgsql set search_path='' as $$
declare v_keys text[]; v_expected text[]; v_entry jsonb;
begin
  if session_user<>'n8n_writer' or current_setting('role',true) not in ('none','n8n_writer') then
    raise exception using errcode='42501',message='foundation_identity_denied';
  end if;
  if not exists(select 1 from ops.foundation_gateway_rate_windows where window_id=p_window_id and namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') or p_request_id is null
    or jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text)>1048576 then
    raise exception using errcode='22023',message='foundation_invalid_request';
  end if;
  select coalesce(array_agg(k order by k),'{}') into v_keys from jsonb_object_keys(p_args) k;
  v_expected:=case p_operation
    when 'identity.read' then '{}'::text[] when 'prices.read' then '{}'::text[]
    when 'health.guard' then '{}'::text[] when 'health.read' then '{}'::text[]
    when 'request.status' then array['targetRequestId'] when 'settings.read' then array['key']
    when 'run.start' then array['env','executionId','mode','platform','workflow']
    when 'run.finish' then array['apifyRunId','error','runId','status']
    when 'apify.read' then array['apifyRunId'] when 'apify.terminal.read' then array['apifyRunId']
    when 'apify.dataset.read' then array['apifyRunId']
    when 'apify.completion.read' then array['apifyRunId','runId']
    when 'apify.process' then array['apifyRunId','datasetId','groups','status','usageUsd']
    when 'cost.log' then array['entries'] when 'error.log' then array['entry']
    when 'error.count' then array['claimNotify','workflow'] when 'fees.accrue' then array['day']
    when 'launch.authorize' then array['launch'] when 'launch.reconcile' then array['apifyRunId','launchId']
    when 'launch.read' then array['launchId']
    when 'callback.reject' then array['apifyRunId','executionId','reason'] else null end;
  if v_expected is null or v_keys<>v_expected then
    raise exception using errcode='22023',message='foundation_invalid_request';
  end if;
  if p_args ? 'apifyRunId' and p_args->'apifyRunId'<>'null'::jsonb and
    (jsonb_typeof(p_args->'apifyRunId') is distinct from 'string' or p_args->>'apifyRunId' !~ '^[A-Za-z0-9_-]{1,128}$') then
    raise exception using errcode='22023',message='foundation_invalid_request';
  end if;
  if p_args ? 'runId' and (jsonb_typeof(p_args->'runId') is distinct from 'string' or
    p_args->>'runId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then
    raise exception using errcode='22023',message='foundation_invalid_request';
  end if;
  case p_operation
  when 'request.status' then
    if jsonb_typeof(p_args->'targetRequestId') is distinct from 'string' or
      p_args->>'targetRequestId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or
      (p_args->>'targetRequestId')::uuid=p_request_id then raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'settings.read' then
    if p_args->>'key' is null or p_args->>'key' not in ('daily_budget_usd','stories_twice_daily','stats_daily_enabled') then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'run.start' then
    if ops.foundation_gateway_workflow(p_args->>'workflow') is distinct from true or p_args->>'env' is distinct from 'dev'
      or jsonb_typeof(p_args->'executionId') is distinct from 'string' or p_args->>'executionId' !~ '^[A-Za-z0-9_-]{1,128}$'
      or p_args->>'mode' is null or p_args->>'mode' not in ('daily','backfill','weekly','manual','removal_check')
      or (p_args->'platform'<>'null'::jsonb and (p_args->>'platform' is null or p_args->>'platform' not in
        ('vimeo','instagram','instagram_stories','website','website_work_page','linkedin','linkedin_employees','youtube','news'))) then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'run.finish' then
    if p_args->>'status' is null or p_args->>'status' not in ('success','partial','failed') or
      (p_args->'error'<>'null'::jsonb and (p_args->>'error' is null or p_args->>'error' not in
        ('workflow_failed','callback_retryable','apify_failed','unexpected_error'))) then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'apify.process' then
    if p_args->>'status' is null or p_args->>'status' not in ('SUCCEEDED','FAILED','TIMED_OUT','ABORTED')
      or jsonb_typeof(p_args->'usageUsd') is distinct from 'number' or (p_args->>'usageUsd')::numeric<0
      or (p_args->>'usageUsd')::numeric>999999.999999
      or jsonb_typeof(p_args->'groups') is distinct from 'array' or jsonb_array_length(p_args->'groups')<>1
      or (p_args->'datasetId'<>'null'::jsonb and (jsonb_typeof(p_args->'datasetId') is distinct from 'string'
        or p_args->>'datasetId' !~ '^[A-Za-z0-9_-]{1,128}$')) then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'cost.log' then
    if jsonb_typeof(p_args->'entries') is distinct from 'array' or jsonb_array_length(p_args->'entries')>2 then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'error.log' then
    v_entry:=p_args->'entry';
    if jsonb_typeof(v_entry) is distinct from 'object' or
      (select array_agg(k order by k) from jsonb_object_keys(v_entry) k)<>array['execution_id','kind','message','node','workflow']
      or ops.foundation_gateway_workflow(v_entry->>'workflow') is distinct from true
      or v_entry->>'kind' is null or v_entry->>'kind' not in ('error','notify')
      or v_entry->>'execution_id' is null or v_entry->>'execution_id' !~ '^[A-Za-z0-9_-]{1,128}$'
      or v_entry->>'node' is null or v_entry->>'node' not in ('Workflow','Trigger activation','Notify','Unknown schedule slot')
      or v_entry->>'message' is null or v_entry->>'message' not in
        ('workflow_failed','callback_retryable','apify_failed','notify_threshold_reached','unexpected_error') then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'error.count' then
    if ops.foundation_gateway_workflow(p_args->>'workflow') is distinct from true or jsonb_typeof(p_args->'claimNotify') is distinct from 'boolean' then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'fees.accrue' then
    if p_args->>'day' is distinct from ((clock_timestamp() at time zone 'Africa/Cairo')::date-1)::text then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'launch.authorize' then
    if jsonb_typeof(p_args->'launch') is distinct from 'object' or octet_length((p_args->'launch')::text)>4096 then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'launch.read','launch.reconcile' then
    if jsonb_typeof(p_args->'launchId') is distinct from 'string' or
      p_args->>'launchId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  when 'callback.reject' then
    if p_args->>'executionId' is null or p_args->>'executionId' !~ '^[A-Za-z0-9_-]{1,128}$' or p_args->>'reason' is null
      or p_args->>'reason' not in ('unregistered','actor_mismatch','registry_mismatch','unsettled','unsupported_input','registration_race','metadata_unavailable') then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  else null;
  end case;
  if p_operation not in ('run.finish') and p_args ? 'apifyRunId' and jsonb_typeof(p_args->'apifyRunId') is distinct from 'string' then
    raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  if p_operation='callback.reject' and (jsonb_typeof(p_args->'executionId') is distinct from 'string'
    or jsonb_typeof(p_args->'reason') is distinct from 'string') then
    raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  if p_operation='error.log' then
    if exists(select 1 from jsonb_each(p_args->'entry') e where jsonb_typeof(e.value)<>'string') then
      raise exception using errcode='22023',message='foundation_invalid_request'; end if;
  end if;
  if p_operation='cost.log' then
    for v_entry in select e.value from jsonb_array_elements(p_args->'entries') e loop
      if jsonb_typeof(v_entry) is distinct from 'object' or not(v_entry ?& array['provider','category','quantity','unit','cost_usd','run_id','meta'])
        or exists(select 1 from jsonb_object_keys(v_entry) k where k<>all(array['provider','category','quantity','unit','cost_usd','run_id','competitor_id','platform','item_id','meta','day']))
        or v_entry->>'provider' is distinct from 'apify' or v_entry->>'category' is distinct from 'scrape' or v_entry->>'unit' is distinct from 'result'
        or jsonb_typeof(v_entry->'quantity') is distinct from 'number' or (v_entry->>'quantity')::numeric not in (0,1)
        or jsonb_typeof(v_entry->'cost_usd') is distinct from 'number' or (v_entry->>'cost_usd')::numeric<0 or (v_entry->>'cost_usd')::numeric>999999.999999
        or jsonb_typeof(v_entry->'run_id') is distinct from 'string' or v_entry->>'run_id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        or jsonb_typeof(v_entry->'meta') is distinct from 'object'
        or (select array_agg(k order by k) from jsonb_object_keys(v_entry->'meta') k)<>array['account_id','actor','apify_run_id','cost_key']
        or exists(select 1 from jsonb_each(v_entry->'meta') e where jsonb_typeof(e.value)<>'string')
        or v_entry->'meta'->>'actor' is null or v_entry->'meta'->>'actor' not in ('apify/website-content-crawler','aYG0l9s7dbB7j3gbS')
        or v_entry->'meta'->>'apify_run_id' is null or v_entry->'meta'->>'apify_run_id' !~ '^[A-Za-z0-9_-]{1,128}$'
        or v_entry->'meta'->>'account_id' is null or v_entry->'meta'->>'account_id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        or v_entry->'meta'->>'cost_key' is distinct from 'apify:'||(v_entry->'meta'->>'apify_run_id')||':'||(v_entry->'meta'->>'account_id') then
        raise exception using errcode='22023',message='foundation_invalid_request'; end if;
      if exists(select 1 from jsonb_each(v_entry) e where e.key in ('competitor_id','item_id') and jsonb_typeof(e.value)<>'null'
        and (jsonb_typeof(e.value)<>'string' or e.value#>>'{}' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'))
        or (v_entry ? 'platform' and v_entry->'platform'<>'null'::jsonb and v_entry->>'platform' is distinct from 'website_work_page')
        or (v_entry ? 'day' and v_entry->'day'<>'null'::jsonb and (jsonb_typeof(v_entry->'day')<>'string' or v_entry->>'day' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) then
        raise exception using errcode='22023',message='foundation_invalid_request'; end if;
    end loop;
  end if;
end;
$$;

create or replace function ops.foundation_gateway_admit(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb,p_mode text default 'admit')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_window ops.foundation_gateway_rate_windows%rowtype;
  v_request ops.foundation_gateway_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_day date := (clock_timestamp() at time zone 'Africa/Cairo')::date;
  v_digest text;
  v_slot smallint;
  v_keys text[];
  v_family_total integer;
  v_family_minute integer;
  v_family_day integer;
begin
  if p_mode in ('bind','inspect') then
    perform ops.foundation_gateway_validate(p_window_id,p_request_id,'identity.read','{}');
    if p_operation is distinct from 'identity.read' or jsonb_typeof(p_args) is distinct from 'object' then
      raise exception using errcode='22023',message='gateway_invalid_request';
    end if;
    select coalesce(array_agg(k order by k),'{}') into v_keys from jsonb_object_keys(p_args) k;
    if (p_mode='inspect' and v_keys<>'{}'::text[]) or (p_mode='bind' and
      (v_keys<>array['audience','commitSha','deploymentId'] or
        jsonb_typeof(p_args->'audience') is distinct from 'string' or
        jsonb_typeof(p_args->'commitSha') is distinct from 'string' or
        jsonb_typeof(p_args->'deploymentId') is distinct from 'string' or
        p_args->>'audience' !~ '^https://[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$' or
        p_args->>'commitSha' !~ '^[0-9a-f]{40}$' or
        p_args->>'deploymentId' !~ '^dpl_[A-Za-z0-9_-]{1,100}$')) then
      raise exception using errcode='22023',message='gateway_invalid_request';
    end if;
    if p_mode='inspect' then
      -- Read-only control: no row lock, reservation, counters or clock mutation.
      select * into strict v_window from ops.foundation_gateway_rate_windows where window_id=p_window_id;
      return ops.foundation_gateway_response(p_window_id,p_operation,
        case when v_window.closed_at is not null or v_window.expires_at<=v_now then 'closed' else 'admitted' end,
        case when v_window.closed_at is not null then 'window_closed' when v_window.expires_at<=v_now then 'window_expired' else null end,null);
    end if;
  else
    perform ops.foundation_gateway_validate(p_window_id,p_request_id,p_operation,p_args);
  end if;
  if p_mode is null or p_mode not in ('admit','close','bind') then
    raise exception using errcode='22023',message='gateway_invalid_request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('m03-foundation-gateway-family-v1',0));
  select * into strict v_window from ops.foundation_gateway_rate_windows where window_id=p_window_id for update;
  v_now := clock_timestamp();
  v_day := (v_now at time zone 'Africa/Cairo')::date;
  -- Closed records are immutable, including repeated Close/bind calls.
  if v_window.closed_at is not null then
    return ops.foundation_gateway_response(p_window_id,p_operation,'closed','window_closed',null);
  end if;
  select coalesce(sum(admitted_count),0),
    coalesce(sum(minute_count) filter(where minute_start=date_trunc('minute',v_now)),0),
    coalesce(sum(day_count) filter(where day_start=v_day),0)
  into v_family_total,v_family_minute,v_family_day
  from ops.foundation_gateway_rate_windows where window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev');
  if p_mode='bind' then
    if v_window.bound_audience is not null then
      if v_window.bound_audience<>p_args->>'audience' or v_window.bound_commit_sha<>p_args->>'commitSha'
        or v_window.bound_deployment_id<>p_args->>'deploymentId' then
        return ops.foundation_gateway_response(p_window_id,p_operation,'conflict','args_conflict',null);
      end if;
      return ops.foundation_gateway_response(p_window_id,p_operation,case when v_window.closed_at is null and
        (v_window.expires_at is null or v_window.expires_at>v_now) then 'admitted' else 'closed' end,
        case when v_window.closed_at is not null then 'window_closed' when v_window.expires_at<=v_now then 'window_expired' else null end,null);
    end if;
    if v_window.starts_at is not null or v_window.closed_at is not null then
      return ops.foundation_gateway_response(p_window_id,p_operation,'closed','window_closed',null);
    end if;
    update ops.foundation_gateway_rate_windows set bound_audience=p_args->>'audience',bound_commit_sha=p_args->>'commitSha',
      bound_deployment_id=p_args->>'deploymentId' where window_id=p_window_id;
    return ops.foundation_gateway_response(p_window_id,p_operation,'admitted',null,null);
  end if;
  if p_mode='close' then
    -- Closing is always safe, including exhausted/expired/prepared windows.
    -- It is counted once if capacity remains, never increments to101/reopens.
    if v_window.closed_at is null then
      update ops.foundation_gateway_rate_windows set closed_at=v_now,close_count=1,
        admitted_count=admitted_count+case when v_family_total<256 then 1 else 0 end where window_id=p_window_id;
    end if;
    update ops.apify_launch_approvals set closed_at=coalesce(closed_at,v_now) where window_id=p_window_id;
    update ops.foundation_gateway_requests set state='rejected',error_code=case when v_window.expires_at<=v_now then 'window_expired' else 'window_closed' end,completed_at=v_now
      where window_id=p_window_id and state='reserved';
    update ops.foundation_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id;
    return ops.foundation_gateway_response(p_window_id,p_operation,'closed','window_closed',null);
  end if;
  if v_window.closed_at is not null then
    return ops.foundation_gateway_response(p_window_id,p_operation,'closed','window_closed',null);
  end if;
  if v_window.bound_audience is null then
    return ops.foundation_gateway_response(p_window_id,p_operation,'rejected','operation_not_permitted',null);
  end if;
  if v_window.expires_at is not null and v_window.expires_at <= v_now then
    update ops.foundation_gateway_rate_windows set closed_at=v_now,close_count=1,
      admitted_count=admitted_count+case when v_family_total<256 then 1 else 0 end where window_id=p_window_id;
    update ops.apify_launch_approvals set closed_at=coalesce(closed_at,v_now) where window_id=p_window_id;
    update ops.foundation_gateway_requests set state='rejected',error_code=case when v_window.expires_at<=v_now then 'window_expired' else 'window_closed' end,completed_at=v_now
      where window_id=p_window_id and state='reserved';
    update ops.foundation_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id;
    return ops.foundation_gateway_response(p_window_id,p_operation,'closed','window_expired',null);
  end if;
  -- Keep the final admission available for physical cleanup.
  if v_family_total >=255 then
    return ops.foundation_gateway_response(p_window_id,p_operation,'limited','request_limit',null);
  end if;
  if v_family_minute >=30 or v_family_day >=500 then
    return ops.foundation_gateway_response(p_window_id,p_operation,'limited','rate_limited',null);
  end if;
  if v_window.starts_at is null then
    update ops.apify_launch_approvals set not_before=v_now,expires_at=v_now+interval '60 minutes'
      where window_id=p_window_id and closed_at is null;
  end if;
  update ops.foundation_gateway_rate_windows set
    starts_at=coalesce(starts_at,v_now),expires_at=coalesce(expires_at,v_now+interval '60 minutes'),
    admitted_count=admitted_count+1,
    minute_count=case when minute_start=date_trunc('minute',v_now) then minute_count+1 else 1 end,
    minute_start=date_trunc('minute',v_now),
    day_count=case when day_start=v_day then day_count+1 else 1 end,day_start=v_day
    where window_id=p_window_id;
  -- Status correlation IDs are not business keys and cannot reserve a target.
  if p_operation='request.status' then
    return ops.foundation_gateway_response(p_window_id,p_operation,'admitted',null,null);
  end if;
  v_digest := encode(extensions.digest(convert_to(jsonb_build_object('operation',p_operation,'args',p_args)::text,'UTF8'),'sha256'),'hex');
  select * into v_request from ops.foundation_gateway_requests where window_id=p_window_id and request_id=p_request_id;
  if found then
    if v_request.operation <> p_operation or v_request.payload_sha256 <> v_digest then
      return ops.foundation_gateway_response(p_window_id,p_operation,'conflict','args_conflict',null);
    elsif v_request.state='completed' then
      return ops.foundation_gateway_response(p_window_id,p_operation,'completed',null,v_request.result,true);
    elsif v_request.state='rejected' then
      return ops.foundation_gateway_response(p_window_id,p_operation,'rejected',v_request.error_code,null);
    elsif v_request.lease_expires_at <= v_now then
      return ops.foundation_gateway_response(p_window_id,p_operation,'reconciliation_required','reconciliation_required',null);
    end if;
    return ops.foundation_gateway_response(p_window_id,p_operation,'in_flight',null,null);
  end if;
  select slot into v_slot from ops.foundation_gateway_leases where window_id=p_window_id
    and (request_id is null or expires_at <= v_now) order by slot limit 1 for update;
  if v_slot is null then
    return ops.foundation_gateway_response(p_window_id,p_operation,'limited','concurrency_limit',null);
  end if;
  insert into ops.foundation_gateway_requests(window_id,request_id,operation,payload_sha256,state,lease_expires_at,read_launch_id,read_apify_run_id)
    values(p_window_id,p_request_id,p_operation,v_digest,'reserved',v_now+interval '30 seconds',
      case when p_operation='launch.reconcile' then (p_args->>'launchId')::uuid else null end,
      case when p_operation in ('launch.reconcile','apify.terminal.read','apify.dataset.read') then p_args->>'apifyRunId' else null end);
  update ops.foundation_gateway_leases set request_id=p_request_id,expires_at=v_now+interval '30 seconds'
    where window_id=p_window_id and slot=v_slot;
  return ops.foundation_gateway_response(p_window_id,p_operation,'admitted',null,null);
end;
$$;

create or replace function ops.authorize_apify_launch(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_window uuid;
  v_launch uuid;
  v_run uuid;
  v_account uuid;
  v_keys text[];
  v_approval ops.apify_launch_approvals%rowtype;
  v_parent ops.scrape_runs%rowtype;
  v_existing ops.apify_launch_admissions%rowtype;
  v_source app.competitor_accounts%rowtype;
  v_count int;
  v_now timestamptz;
begin
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>4096 then
    raise exception using errcode='22023',message='invalid M03 launch request';
  end if;
  select array_agg(k order by k) into v_keys from jsonb_object_keys(p) k;
  if v_keys<>array['account_id','actor_build','actor_id','execution_id','input','launch_id','max_total_charge_usd','memory_mb','run_id','timeout_seconds','window_id']
     or p->>'actor_id' is distinct from 'aYG0l9s7dbB7j3gbS'
     or jsonb_typeof(p->'actor_build') is distinct from 'string'
     or p->>'actor_build' !~ '^([0-9]|[1-9][0-9])\.([0-9]|[1-9][0-9])\.[1-9][0-9]{0,4}$'
     or jsonb_typeof(p->'execution_id') is distinct from 'string' or p->>'execution_id' !~ '^[A-Za-z0-9_-]{1,128}$'
     or p->'input' is distinct from ops.m03_smoke_launch_input()
     or p->'memory_mb' is distinct from '1024'::jsonb or p->'timeout_seconds' is distinct from '300'::jsonb
     or jsonb_typeof(p->'max_total_charge_usd') is distinct from 'number'
     or jsonb_typeof(p->'window_id') is distinct from 'string' or jsonb_typeof(p->'launch_id') is distinct from 'string'
     or jsonb_typeof(p->'run_id') is distinct from 'string' or jsonb_typeof(p->'account_id') is distinct from 'string' then
    raise exception using errcode='22023',message='invalid M03 launch request';
  end if;
  begin
    v_window:=(p->>'window_id')::uuid; v_launch:=(p->>'launch_id')::uuid;
    v_run:=(p->>'run_id')::uuid; v_account:=(p->>'account_id')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode='22023',message='invalid M03 launch identity';
  end;
  if v_window not in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') then
    raise exception using errcode='22023',message='foundation_launch_window_denied';
  end if;
  -- Separate actor-family mutex avoids rate/window lock inversion. All
  -- registered technical windows consume the same two paid-start slots.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('m03-foundation-actor-family-v1',0));
  -- Same global ordering as registration and atomic processing: parent before
  -- launch approval/receipt, competitor and account. The approval row serializes
  -- both quota decisions, including distinct concurrent parent runs.
  select r.* into v_parent from ops.scrape_runs r where r.id=v_run for update;
  if not found then raise exception using errcode='22023',message='unknown M03 parent run'; end if;
  select a.* into v_approval from ops.apify_launch_approvals a where a.window_id=v_window for update;
  if not found then raise exception using errcode='55000',message='M03 launch approval missing'; end if;
  select l.* into v_existing from ops.apify_launch_admissions l where l.launch_id=v_launch;
  if found then
    if v_existing.window_id is distinct from v_window or v_existing.run_id is distinct from v_run
       or v_existing.account_id is distinct from v_account or v_existing.execution_id is distinct from p->>'execution_id'
       or v_existing.actor_build is distinct from p->>'actor_build'
       or v_existing.max_total_charge_usd is distinct from (p->>'max_total_charge_usd')::numeric then
      raise exception using errcode='55000',message='M03 launch identity has different receipt';
    end if;
    -- A returned/replayed grant is NEVER a second permission to issue POST.
    return jsonb_build_object('authorized',false,'reason','reconciliation_required','launch',ops.get_apify_launch(v_launch));
  end if;
  v_now:=clock_timestamp();
  if v_approval.closed_at is not null or v_now<v_approval.not_before or v_now>=v_approval.expires_at
     or v_approval.actor_build is distinct from p->>'actor_build'
     or v_approval.max_total_charge_usd is distinct from (p->>'max_total_charge_usd')::numeric then
    raise exception using errcode='55000',message='M03 launch approval inactive or mismatched';
  end if;
  if v_parent.env<>'dev' or v_parent.workflow<>'WF-99' or v_parent.mode<>'manual'
     or v_parent.platform is distinct from 'website_work_page'::app.platform or v_parent.status<>'running'
     or exists(select 1 from ops.apify_runs r where r.run_id=v_run)
     or exists(select 1 from ops.apify_launch_admissions l where l.run_id=v_run) then
    raise exception using errcode='55000',message='M03 parent run cannot launch';
  end if;
  select count(*) into v_count from ops.apify_launch_admissions l where l.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev');
  if v_count>=2 or (select coalesce(sum(l.max_total_charge_usd),0) from ops.apify_launch_admissions l where l.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev'))+v_approval.max_total_charge_usd>2 or exists(select 1 from ops.apify_launch_admissions l left join ops.apify_runs r using(apify_run_id)
      where l.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and (l.apify_run_id is null or r.processed_at is null or r.usage_usd is null or r.usage_usd<0 or r.usage_usd>l.max_total_charge_usd))
     or (select coalesce(sum(r.usage_usd),0) from ops.apify_launch_admissions l join ops.apify_runs r using(apify_run_id)
         where l.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev'))+v_approval.max_total_charge_usd>v_approval.batch_max_usd then
    raise exception using errcode='55000',message='M03 launch quota or previous outcome unresolved';
  end if;
  perform c.id from app.competitors c where c.id=(select a.competitor_id from app.competitor_accounts a where a.id=v_account) for update;
  select a.* into v_source from app.competitor_accounts a where a.id=v_account for update;
  if not found or v_source.platform<>'website_work_page' or v_source.url is distinct from 'https://everyone.film/about-everyone'
     or v_source.status not in ('active','failing')
     or not exists(select 1 from app.competitors c where c.id=v_source.competitor_id and c.company_code='C999'
       and c.slug='emr-smoke-test' and c.status='active')
     or (select count(*)=1 and bool_and(l.after->>'fixture_version'='1'
       and l.after->>'project_ref'='zmotjsbzhzjvpelxvxlf'
       and l.after->>'competitor_id'=v_source.competitor_id::text and l.after->>'account_id'=v_account::text)
       from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_setup.v1'
         and l.action='m03_smoke_fixture_created' and l.entity_type='competitor'
         and l.entity_id=v_source.competitor_id::text) is distinct from true
     or (v_source.locked_until>v_now and v_source.last_run_id is distinct from v_run) then
    raise exception using errcode='55000',message='M03 launch requires the free owned dev fixture';
  end if;
  update app.competitor_accounts set last_run_id=v_run,locked_until=v_now+interval '2 hours',updated_at=v_now where id=v_account;
  insert into ops.apify_launch_admissions(launch_id,window_id,ordinal,run_id,account_id,execution_id,actor_id,actor_build,input,max_total_charge_usd)
  values(v_launch,v_window,v_count+1,v_run,v_account,p->>'execution_id','aYG0l9s7dbB7j3gbS',p->>'actor_build',
    ops.m03_smoke_launch_input(),v_approval.max_total_charge_usd);
  return jsonb_build_object('authorized',true,'reason','first_post_only','launch',ops.get_apify_launch(v_launch));
end;
$$;

create or replace function ops.foundation_gateway_registered(p_window_id uuid,p_apify_run_id text)
returns jsonb language plpgsql stable set search_path='' as $$
begin
  if p_window_id is null or p_window_id not in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') then return null; end if;
  if not exists(select 1 from ops.apify_runs r where r.apify_run_id=p_apify_run_id) then return null; end if;
  if not exists(select 1 from ops.apify_launch_admissions l join ops.foundation_gateway_run_bindings b using(window_id,run_id)
    where l.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and l.apify_run_id=p_apify_run_id) then
    return null; end if;
  return ops.get_apify_run(p_apify_run_id);
end;
$$;

create or replace function ops.foundation_gateway_process(p_window_id uuid,p_args jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare v_registered jsonb; v_proven boolean; v_result jsonb;
begin
  v_registered:=ops.foundation_gateway_registered(p_window_id,p_args->>'apifyRunId');
  if v_registered is null then raise exception using errcode='22023',message='foundation_run_unregistered'; end if;
  select exists(select 1 from ops.foundation_gateway_requests first_read join ops.foundation_gateway_requests second_read
      on second_read.window_id=first_read.window_id and second_read.request_id<>first_read.request_id
      and second_read.result->'terminal'=first_read.result->'terminal'
      and second_read.completed_at>=first_read.completed_at+interval '10 seconds'
      and second_read.completed_at<=first_read.completed_at+interval '180 seconds'
    where first_read.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and first_read.operation='apify.terminal.read' and first_read.state='completed'
      and second_read.operation='apify.terminal.read' and second_read.state='completed'
      and second_read.result->'terminal'->>'apifyRunId'=p_args->>'apifyRunId'
      and second_read.result->'terminal'->>'parentRunId'=v_registered->>'run_id'
      and second_read.result->'terminal'->>'accountId'=v_registered->'account_ids'->>0
      and second_read.result->'terminal'->>'status'=p_args->>'status'
      and second_read.result->'terminal'->'datasetId'=p_args->'datasetId'
      and second_read.result->'terminal'->'usageTotalUsd'=p_args->'usageUsd'
      and (p_args->>'status'<>'SUCCEEDED' or exists(select 1 from ops.foundation_gateway_requests data_read
        where data_read.window_id=first_read.window_id and data_read.operation='apify.dataset.read' and data_read.state='completed'
          and data_read.completed_at>=second_read.completed_at
          and data_read.result->'terminal'=second_read.result->'terminal'
          and jsonb_array_length(p_args->'groups'->0->'items')=1
          and p_args->'groups'->0->'items'->0->'payload'=data_read.result->'rows'->0))) into v_proven;
  if not v_proven then raise exception using errcode='55000',message='foundation_trusted_reads_required'; end if;
  -- A second distinct item rolls back the complete atomic processing call.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('m03-foundation-item-family-v1',0));
  if (select count(*) from app.items)>1 then
    raise exception using errcode='55000',message='foundation_distinct_item_limit';
  end if;
  v_result:=ops.process_apify_run(p_args->>'apifyRunId',p_args->>'status',p_args->>'datasetId',
    (p_args->>'usageUsd')::numeric,p_args->'groups');
  if (select count(*) from app.items)>1 then
    raise exception using errcode='55000',message='foundation_distinct_item_limit';
  end if;
  return v_result;
end;
$$;

create or replace function ops.foundation_gateway_execute(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_window ops.foundation_gateway_rate_windows%rowtype;
  v_request ops.foundation_gateway_requests%rowtype;
  v_result jsonb;
  v_registered jsonb;
  v_entry jsonb;
  v_run uuid;
  v_digest text;
  v_slot smallint;
  v_now timestamptz := clock_timestamp();
  v_expired boolean := false;
begin
  perform ops.foundation_gateway_validate(p_window_id,p_request_id,p_operation,p_args);
  -- Lock order matches admission/close: parent window, request, then lease.
  -- Close cannot acknowledge while an earlier executing transaction is open.
  select * into strict v_window from ops.foundation_gateway_rate_windows where window_id=p_window_id for share;
  v_now := clock_timestamp();
  if v_window.bound_audience is null then
    return ops.foundation_gateway_response(p_window_id,p_operation,'rejected','operation_not_permitted',null);
  end if;
  if v_window.closed_at is not null or v_window.expires_at is null or v_window.expires_at <= v_now then
    return ops.foundation_gateway_response(p_window_id,p_operation,'closed',case when v_window.closed_at is not null then 'window_closed' else 'window_expired' end,null);
  end if;
  -- No waiting duplicate may execute after a canceled/unknown previous call.
  select * into v_request from ops.foundation_gateway_requests where window_id=p_window_id and request_id=p_request_id for update nowait;
  if not found then
    return ops.foundation_gateway_response(p_window_id,p_operation,'absent','not_found',null);
  end if;
  v_digest := encode(extensions.digest(convert_to(jsonb_build_object('operation',p_operation,'args',p_args)::text,'UTF8'),'sha256'),'hex');
  if v_request.operation<>p_operation or v_request.payload_sha256<>v_digest then
    return ops.foundation_gateway_response(p_window_id,p_operation,'conflict','args_conflict',null);
  elsif v_request.state='completed' then
    return ops.foundation_gateway_response(p_window_id,p_operation,'completed',null,v_request.result,true);
  elsif v_request.state='rejected' then
    return ops.foundation_gateway_response(p_window_id,p_operation,'rejected',v_request.error_code,null);
  elsif v_request.lease_expires_at<=v_now then
    return ops.foundation_gateway_response(p_window_id,p_operation,'reconciliation_required','reconciliation_required',null);
  end if;
  select slot into v_slot from ops.foundation_gateway_leases where window_id=p_window_id and request_id=p_request_id
    and expires_at>v_now for update;
  -- Leases bound reservations. A transaction-scoped lock additionally prevents
  -- expiry/replacement of a slow lease from admitting a third executing call.
  if v_slot is null or not pg_try_advisory_xact_lock(817404,v_slot::integer) then
    return ops.foundation_gateway_response(p_window_id,p_operation,'limited','concurrency_limit',null);
  end if;
  begin
    if v_window.expires_at<=clock_timestamp() then
      v_expired := true;
      raise exception using errcode='22023',message='gateway_deadline';
    end if;
    case p_operation
      when 'identity.read' then
        v_result:=jsonb_build_object('sessionUser',session_user,'database',current_database(),'projectRef','zmotjsbzhzjvpelxvxlf',
          'connectionCount',(select count(*) from pg_stat_activity where usename=session_user));
      when 'settings.read' then v_result:=jsonb_build_object('key',p_args->>'key','value',ops.get_setting(p_args->>'key'));
      when 'prices.read' then v_result:=jsonb_build_object('prices',ops.get_price_book());
      when 'health.guard' then
        if ops.get_setting('stats_daily_enabled') is distinct from 'false'::jsonb then raise exception using errcode='55000',message='foundation_stats_disabled_required'; end if;
        v_result:=jsonb_build_object('stats_daily_enabled',false,'cairo_yesterday',((now() at time zone 'Africa/Cairo')::date-1)::text);
      when 'health.read' then
        if ops.get_setting('stats_daily_enabled') is distinct from 'false'::jsonb then raise exception using errcode='55000',message='foundation_stats_disabled_required'; end if;
        v_result:=jsonb_build_object('h',ops.daily_health(),'cairo_yesterday',((now() at time zone 'Africa/Cairo')::date-1)::text);
      when 'fees.accrue' then v_result:=jsonb_build_object('accrued',ops.accrue_fixed_costs((p_args->>'day')::date));
      when 'run.start' then
        v_run:=ops.start_run(p_args->>'workflow',(p_args->>'platform')::app.platform,p_args->>'mode','dev',p_args->>'executionId');
        insert into ops.foundation_gateway_run_bindings(window_id,run_id) values(p_window_id,v_run);
        v_result:=jsonb_build_object('run_id',v_run);
      when 'run.finish' then
        if not exists(select 1 from ops.foundation_gateway_run_bindings b where b.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and b.run_id=(p_args->>'runId')::uuid) then
          raise exception using errcode='22023',message='foundation_run_scope_denied'; end if;
        if p_args->>'apifyRunId' is null then
          v_result:=jsonb_build_object('r',ops.finish_run((p_args->>'runId')::uuid,p_args->>'status',p_args->>'error'),'durable',null);
        else
          v_registered:=ops.foundation_gateway_registered(p_window_id,p_args->>'apifyRunId');
          if v_registered is null or v_registered->>'run_id' is distinct from p_args->>'runId' or v_registered->'processed_at'='null'::jsonb then
            raise exception using errcode='55000',message='foundation_completion_not_durable'; end if;
          v_result:=jsonb_build_object('r',v_registered->'processing_result'->'run_summary','durable',v_registered->'processing_result');
        end if;
      when 'apify.read' then v_result:=jsonb_build_object('registered',ops.foundation_gateway_registered(p_window_id,p_args->>'apifyRunId'));
      when 'apify.completion.read' then
        v_registered:=ops.foundation_gateway_registered(p_window_id,p_args->>'apifyRunId');
        if v_registered is null or v_registered->>'run_id' is distinct from p_args->>'runId' then raise exception using errcode='22023',message='foundation_run_scope_denied'; end if;
        v_result:=jsonb_build_object('registered',v_registered,'pending',ops.apify_runs_pending((p_args->>'runId')::uuid));
      when 'apify.process' then v_result:=jsonb_build_object('r',ops.foundation_gateway_process(p_window_id,p_args));
      when 'cost.log' then v_result:=jsonb_build_object('inserted',ops.foundation_gateway_replay_costs(p_window_id,p_args->'entries'));
      when 'error.log' then perform ops.log_workflow_error(p_args->'entry'); v_result:=jsonb_build_object('logged',null);
      when 'error.count' then v_result:=jsonb_build_object('error_count',ops.error_count_24h(p_args->>'workflow',(p_args->>'claimNotify')::boolean));
      when 'callback.reject' then v_result:=ops.reject_apify_callback(jsonb_build_object('execution_id',p_args->>'executionId','apify_run_id',p_args->>'apifyRunId','reason',p_args->>'reason'));
      when 'launch.authorize' then
        if p_args->'launch'->>'window_id' is distinct from p_window_id::text or not exists(select 1 from ops.foundation_gateway_run_bindings b
          where b.window_id=p_window_id and b.run_id=(p_args->'launch'->>'run_id')::uuid) then raise exception using errcode='22023',message='foundation_launch_scope_denied'; end if;
        v_result:=ops.authorize_apify_launch(p_args->'launch');
      when 'launch.read' then
        v_result:=ops.get_apify_launch((p_args->>'launchId')::uuid);
        if v_result is not null and not exists(select 1 from ops.foundation_gateway_rate_windows where window_id=(v_result->>'window_id')::uuid and namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') then raise exception using errcode='22023',message='foundation_launch_scope_denied'; end if;
        v_result:=jsonb_build_object('launch',v_result);
      else raise exception using errcode='22023',message='foundation_operation_not_permitted';
    end case;
    if v_window.expires_at<=clock_timestamp() then
      v_expired := true;
      raise exception using errcode='22023',message='gateway_deadline';
    end if;
    if v_result is null or octet_length(v_result::text)>524288 then
      raise exception using errcode='22023',message='gateway_result_rejected';
    end if;
    -- Business side effect and saved outcome commit or roll back together.
    update ops.foundation_gateway_requests set state='completed',result=v_result,completed_at=clock_timestamp()
      where window_id=p_window_id and request_id=p_request_id;
  exception when others then
    -- The nested transaction rolls back the operation first. Never save SQLERRM,
    -- SQLSTATE detail, parameters or the caller's raw input as an error receipt.
    update ops.foundation_gateway_requests set state='rejected',error_code=case when v_expired then 'window_expired' else 'execution_failed' end,completed_at=clock_timestamp()
      where window_id=p_window_id and request_id=p_request_id;
    update ops.foundation_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id and slot=v_slot;
    return ops.foundation_gateway_response(p_window_id,p_operation,case when v_expired then 'closed' else 'rejected' end,
      case when v_expired then 'window_expired' else 'execution_failed' end,null);
  end;
  update ops.foundation_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id and slot=v_slot;
  return ops.foundation_gateway_response(p_window_id,p_operation,'completed',null,v_result);
exception when lock_not_available then
  return ops.foundation_gateway_response(p_window_id,p_operation,'in_flight',null,null);
end;
$$;

-- Retained family results keep their original physical window IDs. Only
-- registered owned records may be read/reconciled/replayed from a new window.
create or replace function ops.foundation_gateway_read_context(p_window_id uuid,p_request_id uuid,p_apify_run_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_window ops.foundation_gateway_rate_windows%rowtype; v_request ops.foundation_gateway_requests%rowtype; v_registered jsonb;
begin
  perform ops.foundation_gateway_validate(p_window_id,p_request_id,'apify.dataset.read',jsonb_build_object('apifyRunId',p_apify_run_id));
  select * into strict v_window from ops.foundation_gateway_rate_windows where window_id=p_window_id for share;
  select * into v_request from ops.foundation_gateway_requests where window_id=p_window_id and request_id=p_request_id for update nowait;
  if not found or v_request.operation not in ('apify.dataset.read','apify.terminal.read','launch.reconcile') or v_request.state<>'reserved'
    or v_request.read_started or v_request.read_apify_run_id is distinct from p_apify_run_id
    or v_request.lease_expires_at<=clock_timestamp() or v_window.closed_at is not null
    or v_window.expires_at is null or v_window.expires_at<=clock_timestamp()
    or not exists(select 1 from ops.foundation_gateway_leases l where l.window_id=p_window_id
      and l.request_id=p_request_id and l.expires_at>clock_timestamp()) then
    raise exception using errcode='55000',message='foundation_read_unresolved';
  end if;
  if v_request.operation='launch.reconcile' then
    v_registered:=ops.get_apify_launch(v_request.read_launch_id);
    if v_registered is null or not exists(select 1 from ops.foundation_gateway_rate_windows where window_id=(v_registered->>'window_id')::uuid and namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev')
      or (v_registered->>'apify_run_id' is not null and v_registered->>'apify_run_id' is distinct from p_apify_run_id) then
      raise exception using errcode='55000',message='foundation_read_unregistered'; end if;
    v_registered:=jsonb_build_object('launch',v_registered,'apify_run_id',p_apify_run_id);
  else
    v_registered:=ops.foundation_gateway_registered(p_window_id,p_apify_run_id);
    if v_registered is null then raise exception using errcode='55000',message='foundation_read_unregistered'; end if;
  end if;
  update ops.foundation_gateway_requests set read_started=true where window_id=p_window_id and request_id=p_request_id;
  return v_registered;
end;
$$;

create or replace function ops.foundation_gateway_complete_read(p_window_id uuid,p_request_id uuid,p_apify_run_id text,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_window ops.foundation_gateway_rate_windows%rowtype; v_request ops.foundation_gateway_requests%rowtype;
  v_registered jsonb; v_terminal jsonb; v_keys text[]; v_row jsonb; v_expected text[]; v_result jsonb;
begin
  perform ops.foundation_gateway_validate(p_window_id,p_request_id,'apify.dataset.read',jsonb_build_object('apifyRunId',p_apify_run_id));
  select * into strict v_window from ops.foundation_gateway_rate_windows where window_id=p_window_id for share;
  select * into v_request from ops.foundation_gateway_requests where window_id=p_window_id and request_id=p_request_id for update nowait;
  if not found or v_request.operation not in ('apify.dataset.read','apify.terminal.read','launch.reconcile') then
    raise exception using errcode='55000',message='foundation_read_unresolved'; end if;
  if v_window.closed_at is not null or v_window.expires_at is null or v_window.expires_at<=clock_timestamp() then
    raise exception using errcode='55000',message='foundation_read_unresolved'; end if;
  if v_request.state='completed' then
    if v_request.result is distinct from p_result then raise exception using errcode='55000',message='foundation_read_receipt_conflict'; end if;
    return ops.foundation_gateway_response(p_window_id,v_request.operation,'completed',null,v_request.result,true);
  end if;
  if v_request.state<>'reserved' or not v_request.read_started or v_request.read_apify_run_id is distinct from p_apify_run_id or v_request.lease_expires_at<=clock_timestamp()
    or v_window.closed_at is not null or v_window.expires_at is null or v_window.expires_at<=clock_timestamp()
    or not exists(select 1 from ops.foundation_gateway_leases l where l.window_id=p_window_id
      and l.request_id=p_request_id and l.expires_at>clock_timestamp()) then
    raise exception using errcode='55000',message='foundation_read_unresolved'; end if;
  if v_request.operation='launch.reconcile' then
    if jsonb_typeof(p_result) is distinct from 'object' or octet_length(p_result::text)>8192
      or (select array_agg(k order by k) from jsonb_object_keys(p_result) k)<>array['launch','transport']
      or p_result->'transport' is distinct from '{"requests":2,"retries":0,"socketsClosed":true,"runBytesMax":65536,"inputBytesMax":4096}'::jsonb
      or p_result->'launch'->>'launch_id' is distinct from v_request.read_launch_id::text
      or p_result->'launch'->>'apify_run_id' is distinct from p_apify_run_id then
      raise exception using errcode='22023',message='foundation_read_result_rejected'; end if;
    v_registered:=ops.get_apify_launch(v_request.read_launch_id);
    if v_registered is null or not exists(select 1 from ops.foundation_gateway_rate_windows where window_id=(v_registered->>'window_id')::uuid and namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') then
      raise exception using errcode='22023',message='foundation_launch_scope_denied'; end if;
    v_result:=ops.reconcile_apify_launch(p_result->'launch');
    update ops.foundation_gateway_requests set state='completed',result=v_result,completed_at=clock_timestamp()
      where window_id=p_window_id and request_id=p_request_id;
    update ops.foundation_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id and request_id=p_request_id;
    return ops.foundation_gateway_response(p_window_id,v_request.operation,'completed',null,v_result,false);
  end if;
  v_registered:=ops.foundation_gateway_registered(p_window_id,p_apify_run_id);
  if v_registered is null or v_request.payload_sha256 is distinct from encode(extensions.digest(convert_to(jsonb_build_object(
    'operation',v_request.operation,'args',jsonb_build_object('apifyRunId',p_apify_run_id))::text,'UTF8'),'sha256'),'hex')
    or jsonb_typeof(p_result) is distinct from 'object' or octet_length(p_result::text)>524288 then
    raise exception using errcode='22023',message='foundation_read_result_rejected'; end if;
  select array_agg(k order by k) into v_keys from jsonb_object_keys(p_result) k;
  v_expected:=case when v_request.operation='apify.dataset.read' then array['rows','terminal','transport'] else array['terminal','transport'] end;
  v_terminal:=p_result->'terminal';
  if v_keys<>v_expected or jsonb_typeof(v_terminal) is distinct from 'object' then
    raise exception using errcode='22023',message='foundation_read_result_rejected'; end if;
  select array_agg(k order by k) into v_keys from jsonb_object_keys(v_terminal) k;
  if v_keys<>array['accountId','actorId','apifyRunId','datasetId','finishedAt','parentRunId','status','usageTotalUsd','wireStatus']
    or v_terminal->>'apifyRunId' is distinct from p_apify_run_id or v_terminal->>'actorId' is distinct from 'aYG0l9s7dbB7j3gbS'
    or v_terminal->>'parentRunId' is distinct from v_registered->>'run_id'
    or v_terminal->>'accountId' is distinct from v_registered->'account_ids'->>0
    or v_terminal->>'wireStatus' is null or v_terminal->>'wireStatus' not in ('SUCCEEDED','FAILED','TIMED-OUT','ABORTED')
    or v_terminal->>'status' is distinct from (case when v_terminal->>'wireStatus'='TIMED-OUT' then 'TIMED_OUT' else v_terminal->>'wireStatus' end)
    or jsonb_typeof(v_terminal->'usageTotalUsd') is distinct from 'number' or (v_terminal->>'usageTotalUsd')::numeric<0
    or (v_terminal->>'usageTotalUsd')::numeric>999999.999999
    or jsonb_typeof(v_terminal->'finishedAt') is distinct from 'string'
    or v_terminal->>'finishedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
    or (v_terminal->'datasetId'<>'null'::jsonb and (jsonb_typeof(v_terminal->'datasetId') is distinct from 'string'
      or v_terminal->>'datasetId' !~ '^[A-Za-z0-9_-]{1,128}$'))
    or (v_terminal->>'status'='SUCCEEDED' and v_terminal->>'datasetId' is null) then
    raise exception using errcode='22023',message='foundation_read_result_rejected'; end if;
  perform (v_terminal->>'finishedAt')::timestamptz;
  if v_request.operation='apify.terminal.read' then
    if p_result->'transport' is distinct from '{"runBytesMax":65536,"requests":1,"retries":0,"socketsClosed":true}'::jsonb then
      raise exception using errcode='22023',message='foundation_read_result_rejected'; end if;
  else
    if v_terminal->>'status'<>'SUCCEEDED' or p_result->'transport' is distinct from
      '{"runBytesMax":65536,"datasetBytesMax":262144,"requests":2,"retries":0,"socketsClosed":true}'::jsonb
      or jsonb_typeof(p_result->'rows') is distinct from 'array' or jsonb_array_length(p_result->'rows')<>1 then
      raise exception using errcode='22023',message='foundation_read_result_rejected'; end if;
    v_row:=p_result->'rows'->0;
    if jsonb_typeof(v_row) is distinct from 'object'
      or (select array_agg(k order by k) from jsonb_object_keys(v_row) k)<>array['markdown','metadata','url']
      or v_row->>'url' is distinct from 'https://everyone.film/about-everyone'
      or jsonb_typeof(v_row->'markdown') is distinct from 'string' or length(v_row->>'markdown')>8000
      or jsonb_typeof(v_row->'metadata') is distinct from 'object'
      or (select array_agg(k order by k) from jsonb_object_keys(v_row->'metadata') k)<>array['title']
      or coalesce(jsonb_typeof(v_row->'metadata'->'title'),'missing') not in ('string','null')
      or length(v_row->'metadata'->>'title')>2000 then
      raise exception using errcode='22023',message='foundation_read_result_rejected'; end if;
  end if;
  update ops.foundation_gateway_requests set state='completed',result=p_result,completed_at=clock_timestamp()
    where window_id=p_window_id and request_id=p_request_id;
  update ops.foundation_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id and request_id=p_request_id;
  return ops.foundation_gateway_response(p_window_id,v_request.operation,'completed',null,p_result,false);
end;
$$;

create or replace function ops.foundation_gateway_replay_costs(p_window_id uuid,p_entries jsonb)
returns int language plpgsql set search_path='' as $$
declare v_entry jsonb; v_meta jsonb; v_keys text[];
begin
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries)>2 then
    raise exception using errcode='22023',message='foundation_cost_scope_denied'; end if;
  for v_entry in select e.value from jsonb_array_elements(p_entries) e loop
    v_meta:=v_entry->'meta';
    if jsonb_typeof(v_meta) is distinct from 'object' then raise exception using errcode='22023',message='foundation_cost_scope_denied'; end if;
    select array_agg(k order by k) into v_keys from jsonb_object_keys(v_meta) k;
    if v_keys<>array['account_id','actor','apify_run_id','cost_key']
      or v_entry->>'provider' is distinct from 'apify' or v_entry->>'category' is distinct from 'scrape'
      or v_entry->>'unit' is distinct from 'result' or not exists(
        select 1 from ops.apify_launch_admissions l join ops.apify_runs r using(apify_run_id)
        join ops.cost_ledger c on c.provider='apify' and c.run_id=l.run_id and c.meta->>'apify_run_id'=l.apify_run_id
          and c.meta->>'account_id'=l.account_id::text and c.meta->>'cost_key'=v_meta->>'cost_key'
        where l.window_id in (select window_id from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev') and r.processed_at is not null and l.run_id::text=v_entry->>'run_id'
          and l.account_id::text=v_meta->>'account_id' and l.apify_run_id=v_meta->>'apify_run_id'
          and c.meta is not distinct from v_meta) then
      raise exception using errcode='22023',message='foundation_cost_scope_denied'; end if;
  end loop;
  -- The original atomic receipt already exists. Its complete amount/day/units/
  -- attribution equality is independently checked by the existing log_cost RPC;
  -- this path can acknowledge only equal replay and cannot invent a new cost.
  return ops.log_cost(p_entries);
end;
$$;
