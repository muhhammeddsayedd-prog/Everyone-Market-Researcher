-- M03 foundation acceptance source only. NO active window is provisioned here.
-- Separate tables/UUID preserve every original GW-01 window/receipt/lease.
-- An owner must approve/provision this distinct bounded lifecycle before use.
create table ops.foundation_gateway_rate_windows (
  namespace text primary key check (namespace = 'm03-foundation-dev'),
  window_id uuid not null unique check (window_id = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
  project_ref text not null check (project_ref = 'zmotjsbzhzjvpelxvxlf'),
  environment text not null check (environment = 'dev'),
  bound_audience text,
  bound_commit_sha text,
  bound_deployment_id text,
  starts_at timestamptz,
  expires_at timestamptz,
  closed_at timestamptz,
  admitted_count integer not null default 0 check (admitted_count between 0 and 256),
  close_count integer not null default 0 check (close_count between 0 and 1),
  minute_start timestamptz,
  minute_count integer not null default 0 check (minute_count between 0 and 30),
  day_start date,
  day_count integer not null default 0 check (day_count between 0 and 500),
  constraint foundation_gateway_binding_shape check ((bound_audience is null and bound_commit_sha is null and bound_deployment_id is null) or
    (bound_audience ~ '^https://[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$'
      and bound_commit_sha ~ '^[0-9a-f]{40}$' and bound_deployment_id ~ '^dpl_[A-Za-z0-9_-]{1,100}$'
      and bound_audience is not null and bound_commit_sha is not null and bound_deployment_id is not null)),
  check ((starts_at is null and expires_at is null) or
    (starts_at is not null and expires_at = starts_at + interval '60 minutes'))
);
create table ops.foundation_gateway_requests (
  window_id uuid not null references ops.foundation_gateway_rate_windows(window_id),
  request_id uuid not null,
  operation text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('reserved','completed','rejected')),
  created_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz not null,
  read_started boolean not null default false,
  read_launch_id uuid,
  read_apify_run_id text,
  completed_at timestamptz,
  result jsonb,
  error_code text check (error_code is null or error_code in ('execution_failed','window_expired')),
  primary key (window_id,request_id),
  check ((state = 'reserved' and completed_at is null and result is null and error_code is null)
    or (state = 'completed' and completed_at is not null and result is not null and error_code is null)
    or (state = 'rejected' and completed_at is not null and result is null and error_code is not null)),
  check (result is null or octet_length(result::text) <= 524288)
);
create table ops.foundation_gateway_leases (
  window_id uuid not null references ops.foundation_gateway_rate_windows(window_id),
  slot smallint not null check (slot between 1 and 2),
  request_id uuid,
  expires_at timestamptz,
  primary key (window_id,slot),
  foreign key (window_id,request_id) references ops.foundation_gateway_requests(window_id,request_id),
  check ((request_id is null and expires_at is null) or (request_id is not null and expires_at is not null))
);
create index foundation_gateway_leases_request_idx on ops.foundation_gateway_leases(window_id,request_id);
alter table ops.foundation_gateway_rate_windows enable row level security;
alter table ops.foundation_gateway_requests enable row level security;
alter table ops.foundation_gateway_leases enable row level security;
revoke all on ops.foundation_gateway_rate_windows,ops.foundation_gateway_requests,ops.foundation_gateway_leases
  from public,anon,authenticated,api_agent,n8n_writer;
create table ops.foundation_gateway_run_bindings (
  window_id uuid not null references ops.foundation_gateway_rate_windows(window_id),
  run_id uuid not null references ops.scrape_runs(id),
  primary key(window_id,run_id), unique(run_id)
);
alter table ops.foundation_gateway_run_bindings enable row level security;
revoke all on ops.foundation_gateway_run_bindings from public,anon,authenticated,api_agent,n8n_writer;

create function ops.foundation_gateway_provision(p jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_keys text[]; v_now timestamptz:=clock_timestamp(); v_window constant uuid:='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
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
revoke all on function ops.foundation_gateway_provision(jsonb) from public,anon,authenticated,api_agent,n8n_writer;
-- Owner-only implementation helpers; the writer receives only three wrappers.
create function ops.foundation_gateway_response(p_window_id uuid,p_operation text,p_state text,p_code text,p_result jsonb,p_replayed boolean default false)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('state',p_state,'code',p_code,'result',p_result,'replayed',p_replayed,'operation',p_operation,'window',
    jsonb_build_object('id',w.window_id,'startsAt',w.starts_at,'expiresAt',w.expires_at,
      'closed',w.closed_at is not null or (w.expires_at is not null and w.expires_at <= clock_timestamp()),
      'totalAdmitted',w.admitted_count,'boundAudience',w.bound_audience,
      'boundCommitSha',w.bound_commit_sha,'boundDeploymentId',w.bound_deployment_id))
  from ops.foundation_gateway_rate_windows w where w.window_id = p_window_id;
$$;
create function ops.foundation_gateway_workflow(p text)
returns boolean language sql immutable set search_path='' as $$
  select p=any(array['WF-00','WF-10','WF-11','WF-12','WF-13','WF-18','WF-18b','WF-19','WF-21','WF-22','WF-23',
    'WF-30','WF-32','WF-40','WF-50','WF-70','WF-80','WF-90','WF-91','WF-99',
    'SUB-START','SUB-FINISH','SUB-INGEST','SUB-COST','SUB-NOTIFY']);
$$;
create function ops.foundation_gateway_validate(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb)
returns void language plpgsql set search_path='' as $$
declare v_keys text[]; v_expected text[]; v_entry jsonb;
begin
  if session_user<>'n8n_writer' or current_setting('role',true) not in ('none','n8n_writer') then
    raise exception using errcode='42501',message='foundation_identity_denied';
  end if;
  if p_window_id is distinct from 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'::uuid or p_request_id is null
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
end;
$$;

create function ops.foundation_gateway_admit(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb,p_mode text default 'admit')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_window ops.foundation_gateway_rate_windows%rowtype;
  v_request ops.foundation_gateway_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_day date := (clock_timestamp() at time zone 'Africa/Cairo')::date;
  v_digest text;
  v_slot smallint;
  v_keys text[];
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
  select * into strict v_window from ops.foundation_gateway_rate_windows where window_id=p_window_id for update;
  v_now := clock_timestamp();
  v_day := (v_now at time zone 'Africa/Cairo')::date;
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
        admitted_count=least(256,admitted_count+1) where window_id=p_window_id;
    end if;
    update ops.apify_launch_approvals set closed_at=coalesce(closed_at,v_now) where window_id=p_window_id;
    return ops.foundation_gateway_response(p_window_id,p_operation,'closed','window_closed',null);
  end if;
  if v_window.closed_at is not null then
    return ops.foundation_gateway_response(p_window_id,p_operation,'closed','window_closed',null);
  end if;
  if v_window.bound_audience is null then
    return ops.foundation_gateway_response(p_window_id,p_operation,'rejected','operation_not_permitted',null);
  end if;
  if v_window.expires_at is not null and v_window.expires_at <= v_now then
    update ops.foundation_gateway_rate_windows set closed_at=v_now where window_id=p_window_id;
    update ops.apify_launch_approvals set closed_at=coalesce(closed_at,v_now) where window_id=p_window_id;
    return ops.foundation_gateway_response(p_window_id,p_operation,'closed','window_expired',null);
  end if;
  if v_window.admitted_count >= 256 then
    return ops.foundation_gateway_response(p_window_id,p_operation,'limited','request_limit',null);
  end if;
  if (v_window.minute_start = date_trunc('minute',v_now) and v_window.minute_count >= 30)
    or (v_window.day_start=v_day and v_window.day_count >=500) then
    return ops.foundation_gateway_response(p_window_id,p_operation,'limited','rate_limited',null);
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

-- Unknown run IDs return null for the exact rejection path. Existing unrelated
-- registrations are never exposed or processed through this acceptance window.
create function ops.foundation_gateway_registered(p_window_id uuid,p_apify_run_id text)
returns jsonb language plpgsql stable set search_path='' as $$
begin
  if not exists(select 1 from ops.apify_runs r where r.apify_run_id=p_apify_run_id) then return null; end if;
  if not exists(select 1 from ops.apify_launch_admissions l join ops.foundation_gateway_run_bindings b using(window_id,run_id)
    where l.window_id=p_window_id and l.apify_run_id=p_apify_run_id) then
    raise exception using errcode='22023',message='foundation_registered_scope_denied'; end if;
  return ops.get_apify_run(p_apify_run_id);
end;
$$;

create function ops.foundation_gateway_execute(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb)
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
        if not exists(select 1 from ops.foundation_gateway_run_bindings b where b.window_id=p_window_id and b.run_id=(p_args->>'runId')::uuid) then
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
      when 'apify.process' then
        v_registered:=ops.foundation_gateway_registered(p_window_id,p_args->>'apifyRunId');
        if v_registered is null then raise exception using errcode='22023',message='foundation_run_unregistered'; end if;
        v_result:=jsonb_build_object('r',ops.process_apify_run(p_args->>'apifyRunId',p_args->>'status',p_args->>'datasetId',
          (p_args->>'usageUsd')::numeric,p_args->'groups'));
      when 'cost.log' then
        for v_entry in select e.value from jsonb_array_elements(p_args->'entries') e loop
          if v_entry->>'provider' is distinct from 'apify' or not exists(select 1 from ops.apify_launch_admissions l
            where l.window_id=p_window_id and l.run_id=(v_entry->>'run_id')::uuid and l.apify_run_id=v_entry->'meta'->>'apify_run_id') then
            raise exception using errcode='22023',message='foundation_cost_scope_denied'; end if;
        end loop;
        v_result:=jsonb_build_object('inserted',ops.log_cost(p_args->'entries'));
      when 'error.log' then perform ops.log_workflow_error(p_args->'entry'); v_result:=jsonb_build_object('logged',null);
      when 'error.count' then v_result:=jsonb_build_object('error_count',ops.error_count_24h(p_args->>'workflow',(p_args->>'claimNotify')::boolean));
      when 'callback.reject' then v_result:=ops.reject_apify_callback(jsonb_build_object('execution_id',p_args->>'executionId','apify_run_id',p_args->>'apifyRunId','reason',p_args->>'reason'));
      when 'launch.authorize' then
        if p_args->'launch'->>'window_id' is distinct from p_window_id::text or not exists(select 1 from ops.foundation_gateway_run_bindings b
          where b.window_id=p_window_id and b.run_id=(p_args->'launch'->>'run_id')::uuid) then raise exception using errcode='22023',message='foundation_launch_scope_denied'; end if;
        v_result:=ops.authorize_apify_launch(p_args->'launch');
      when 'launch.read' then
        v_result:=ops.get_apify_launch((p_args->>'launchId')::uuid);
        if v_result is not null and v_result->>'window_id' is distinct from p_window_id::text then raise exception using errcode='22023',message='foundation_launch_scope_denied'; end if;
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

-- External reads keep their reservation unresolved until the fixed authenticated
-- reader supplies its bounded result. A lost response is read back by request ID;
-- it is never treated as permission to download the same dataset again.
create function ops.foundation_gateway_read_context(p_window_id uuid,p_request_id uuid,p_apify_run_id text)
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
    if v_registered is null or v_registered->>'window_id' is distinct from p_window_id::text
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

create function ops.foundation_gateway_complete_read(p_window_id uuid,p_request_id uuid,p_apify_run_id text,p_result jsonb)
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
    if v_registered is null or v_registered->>'window_id' is distinct from p_window_id::text then
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

create function ops.foundation_gateway_status(p_window_id uuid,p_target_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_window ops.foundation_gateway_rate_windows%rowtype;
  v_request ops.foundation_gateway_requests%rowtype;
begin
  -- This wrapper takes only the target. Fresh correlation-ID validation belongs
  -- to the separate admission call; use an internal distinct validation UUID.
  perform ops.foundation_gateway_validate(p_window_id,
    case when p_target_request_id='00000000-0000-0000-0000-000000000000'::uuid
      then '00000000-0000-0000-0000-000000000001'::uuid else '00000000-0000-0000-0000-000000000000'::uuid end,'request.status',
    jsonb_build_object('targetRequestId',p_target_request_id));
  select * into strict v_window from ops.foundation_gateway_rate_windows where window_id=p_window_id;
  if v_window.closed_at is not null or v_window.expires_at is null or v_window.expires_at<=clock_timestamp() then
    return ops.foundation_gateway_response(p_window_id,coalesce(v_request.operation,'request.status'),'closed',case when v_window.closed_at is not null then 'window_closed' else 'window_expired' end,null,true);
  end if;
  select * into v_request from ops.foundation_gateway_requests where window_id=p_window_id and request_id=p_target_request_id;
  if not found then
    return ops.foundation_gateway_response(p_window_id,coalesce(v_request.operation,'request.status'),'absent','not_found',null,true);
  elsif v_request.state='completed' then
    return ops.foundation_gateway_response(p_window_id,coalesce(v_request.operation,'request.status'),'completed',null,v_request.result,true);
  elsif v_request.state='rejected' then
    return ops.foundation_gateway_response(p_window_id,coalesce(v_request.operation,'request.status'),'rejected',v_request.error_code,null,true);
  elsif v_request.lease_expires_at<=clock_timestamp() then
    return ops.foundation_gateway_response(p_window_id,coalesce(v_request.operation,'request.status'),'reconciliation_required','reconciliation_required',null,true);
  end if;
  return ops.foundation_gateway_response(p_window_id,coalesce(v_request.operation,'request.status'),'in_flight',null,null,true);
end;
$$;
revoke all on function ops.foundation_gateway_response(uuid,text,text,text,jsonb,boolean),ops.foundation_gateway_validate(uuid,uuid,text,jsonb)
  from public,anon,authenticated,api_agent,n8n_writer;
revoke all on function ops.foundation_gateway_workflow(text),ops.foundation_gateway_registered(uuid,text)
  from public,anon,authenticated,api_agent,n8n_writer;
revoke all on function ops.foundation_gateway_admit(uuid,uuid,text,jsonb,text),
  ops.foundation_gateway_execute(uuid,uuid,text,jsonb),ops.foundation_gateway_status(uuid,uuid),
  ops.foundation_gateway_read_context(uuid,uuid,text),ops.foundation_gateway_complete_read(uuid,uuid,text,jsonb)
  from public,anon,authenticated,api_agent;
grant execute on function ops.foundation_gateway_admit(uuid,uuid,text,jsonb,text),
  ops.foundation_gateway_execute(uuid,uuid,text,jsonb),ops.foundation_gateway_status(uuid,uuid),
  ops.foundation_gateway_read_context(uuid,uuid,text),ops.foundation_gateway_complete_read(uuid,uuid,text,jsonb) to n8n_writer;
