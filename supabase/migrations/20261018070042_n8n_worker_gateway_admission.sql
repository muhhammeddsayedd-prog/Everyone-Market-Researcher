-- GW-01 connection trial only. The singleton is never reset or re-opened.
-- No external actor, collected item, fake provider cost or C999 is created.
create table ops.worker_gateway_rate_windows (
  namespace text primary key check (namespace = 'gw01-dev'),
  window_id uuid not null unique check (window_id = '76c2ad42-c094-4ba4-9a0b-566e19b97780'),
  project_ref text not null check (project_ref = 'zmotjsbzhzjvpelxvxlf'),
  environment text not null check (environment = 'dev'),
  bound_audience text,
  bound_commit_sha text,
  bound_deployment_id text,
  starts_at timestamptz,
  expires_at timestamptz,
  closed_at timestamptz,
  admitted_count integer not null default 0 check (admitted_count between 0 and 100),
  close_count integer not null default 0 check (close_count between 0 and 1),
  minute_start timestamptz,
  minute_count integer not null default 0 check (minute_count between 0 and 30),
  day_start date,
  day_count integer not null default 0 check (day_count between 0 and 500),
  constraint worker_gateway_binding_shape check ((bound_audience is null and bound_commit_sha is null and bound_deployment_id is null) or
    (bound_audience ~ '^https://[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$'
      and bound_commit_sha ~ '^[0-9a-f]{40}$' and bound_deployment_id ~ '^dpl_[A-Za-z0-9_-]{1,100}$'
      and bound_audience is not null and bound_commit_sha is not null and bound_deployment_id is not null)),
  check ((starts_at is null and expires_at is null) or
    (starts_at is not null and expires_at = starts_at + interval '30 minutes'))
);
create table ops.worker_gateway_requests (
  window_id uuid not null references ops.worker_gateway_rate_windows(window_id),
  request_id uuid not null,
  operation text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('reserved','completed','rejected')),
  created_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz not null,
  completed_at timestamptz,
  result jsonb,
  error_code text check (error_code is null or error_code in ('execution_failed','window_expired')),
  primary key (window_id,request_id),
  check ((state = 'reserved' and completed_at is null and result is null and error_code is null)
    or (state = 'completed' and completed_at is not null and result is not null and error_code is null)
    or (state = 'rejected' and completed_at is not null and result is null and error_code is not null)),
  check (result is null or octet_length(result::text) <= 524288)
);
create table ops.worker_gateway_leases (
  window_id uuid not null references ops.worker_gateway_rate_windows(window_id),
  slot smallint not null check (slot between 1 and 2),
  request_id uuid,
  expires_at timestamptz,
  primary key (window_id,slot),
  foreign key (window_id,request_id) references ops.worker_gateway_requests(window_id,request_id),
  check ((request_id is null and expires_at is null) or (request_id is not null and expires_at is not null))
);
create index worker_gateway_leases_request_idx on ops.worker_gateway_leases(window_id,request_id);
alter table ops.worker_gateway_rate_windows enable row level security;
alter table ops.worker_gateway_requests enable row level security;
alter table ops.worker_gateway_leases enable row level security;
revoke all on ops.worker_gateway_rate_windows,ops.worker_gateway_requests,ops.worker_gateway_leases
  from public,anon,authenticated,api_agent,n8n_writer;
insert into ops.worker_gateway_rate_windows(namespace,window_id,project_ref,environment)
values ('gw01-dev','76c2ad42-c094-4ba4-9a0b-566e19b97780','zmotjsbzhzjvpelxvxlf','dev');
insert into ops.worker_gateway_leases(window_id,slot) values
  ('76c2ad42-c094-4ba4-9a0b-566e19b97780',1),
  ('76c2ad42-c094-4ba4-9a0b-566e19b97780',2);

-- Owner-only implementation helpers; the writer receives only three wrappers.
create function ops.worker_gateway_response(p_window_id uuid,p_state text,p_code text,p_result jsonb)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('state',p_state,'code',p_code,'result',p_result,'window',
    jsonb_build_object('id',w.window_id,'startsAt',w.starts_at,'expiresAt',w.expires_at,
      'closed',w.closed_at is not null or (w.expires_at is not null and w.expires_at <= clock_timestamp()),
      'totalAdmitted',w.admitted_count,'boundAudience',w.bound_audience,
      'boundCommitSha',w.bound_commit_sha,'boundDeploymentId',w.bound_deployment_id))
  from ops.worker_gateway_rate_windows w where w.window_id = p_window_id;
$$;
create function ops.worker_gateway_validate(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  v_keys text[];
begin
  -- Inside SECURITY DEFINER current_user is the owner. This checks the actual
  -- session principal and denies postgres+SET ROLE; the route separately checks
  -- both identities BEFORE any definer call, never synthesizing current_user.
  if session_user <> 'n8n_writer' or current_setting('role',true) not in ('none','n8n_writer') then
    raise exception using errcode='42501',message='gateway_identity_denied';
  end if;
  if p_window_id is distinct from '76c2ad42-c094-4ba4-9a0b-566e19b97780'::uuid or p_request_id is null
    or jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text) > 1048576
    or p_operation is null or p_operation not in ('identity.read','request.status','run.start','run.finish',
      'apify.register','apify.read','apify.pending','apify.process','cost.log','settings.read','prices.read',
      'error.log','error.count','health.read','fees.accrue') then
    raise exception using errcode='22023',message='gateway_invalid_request';
  end if;
  select coalesce(array_agg(k order by k),'{}') into v_keys from jsonb_object_keys(p_args) k;
  if p_operation in ('identity.read','prices.read','health.read') and v_keys <> '{}'::text[] then
    raise exception using errcode='22023',message='gateway_invalid_request';
  elsif p_operation = 'settings.read' and (v_keys <> array['key'] or
    jsonb_typeof(p_args->'key') is distinct from 'string' or
    p_args->>'key' not in ('daily_budget_usd','stories_twice_daily','stats_daily_enabled')) then
    raise exception using errcode='22023',message='gateway_invalid_request';
  elsif p_operation = 'request.status' and (v_keys <> array['targetRequestId'] or
    jsonb_typeof(p_args->'targetRequestId') is distinct from 'string' or
    p_args->>'targetRequestId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then
    raise exception using errcode='22023',message='gateway_invalid_request';
  elsif p_operation = 'error.log' and (v_keys <> array['executionId','kind','message','workflow'] or
    p_args->>'workflow' is distinct from 'M03-GATEWAY-ACCEPTANCE-DEV' or
    p_args->>'kind' is distinct from 'notify' or p_args->>'message' is distinct from 'gateway_acceptance' or
    jsonb_typeof(p_args->'executionId') is distinct from 'string' or
    p_args->>'executionId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then
    raise exception using errcode='22023',message='gateway_invalid_request';
  elsif p_operation = 'error.count' and (v_keys <> array['claimNotify','workflow'] or
    p_args->>'workflow' is distinct from 'M03-GATEWAY-ACCEPTANCE-DEV' or
    p_args->'claimNotify' is distinct from 'false'::jsonb) then
    raise exception using errcode='22023',message='gateway_invalid_request';
  end if;
  if p_operation='request.status' and (p_args->>'targetRequestId')::uuid=p_request_id then
    raise exception using errcode='22023',message='gateway_invalid_request';
  end if;
end;
$$;

create function ops.worker_gateway_admit(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb,p_mode text default 'admit')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_window ops.worker_gateway_rate_windows%rowtype;
  v_request ops.worker_gateway_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_day date := (clock_timestamp() at time zone 'Africa/Cairo')::date;
  v_digest text;
  v_slot smallint;
  v_keys text[];
begin
  if p_mode in ('bind','inspect') then
    perform ops.worker_gateway_validate(p_window_id,p_request_id,'identity.read','{}');
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
      select * into strict v_window from ops.worker_gateway_rate_windows where window_id=p_window_id;
      return ops.worker_gateway_response(p_window_id,
        case when v_window.closed_at is not null or v_window.expires_at<=v_now then 'closed' else 'admitted' end,
        case when v_window.closed_at is not null then 'window_closed' when v_window.expires_at<=v_now then 'window_expired' else null end,null);
    end if;
  else
    perform ops.worker_gateway_validate(p_window_id,p_request_id,p_operation,p_args);
  end if;
  if p_mode is null or p_mode not in ('admit','close','bind') then
    raise exception using errcode='22023',message='gateway_invalid_request';
  end if;
  select * into strict v_window from ops.worker_gateway_rate_windows where window_id=p_window_id for update;
  v_now := clock_timestamp();
  v_day := (v_now at time zone 'Africa/Cairo')::date;
  if p_mode='bind' then
    if v_window.bound_audience is not null then
      if v_window.bound_audience<>p_args->>'audience' or v_window.bound_commit_sha<>p_args->>'commitSha'
        or v_window.bound_deployment_id<>p_args->>'deploymentId' then
        return ops.worker_gateway_response(p_window_id,'conflict','args_conflict',null);
      end if;
      return ops.worker_gateway_response(p_window_id,case when v_window.closed_at is null and
        (v_window.expires_at is null or v_window.expires_at>v_now) then 'admitted' else 'closed' end,
        case when v_window.closed_at is not null then 'window_closed' when v_window.expires_at<=v_now then 'window_expired' else null end,null);
    end if;
    if v_window.starts_at is not null or v_window.closed_at is not null then
      return ops.worker_gateway_response(p_window_id,'closed','window_closed',null);
    end if;
    update ops.worker_gateway_rate_windows set bound_audience=p_args->>'audience',bound_commit_sha=p_args->>'commitSha',
      bound_deployment_id=p_args->>'deploymentId' where window_id=p_window_id;
    return ops.worker_gateway_response(p_window_id,'admitted',null,null);
  end if;
  if p_mode='close' then
    -- Closing is always safe, including exhausted/expired/prepared windows.
    -- It is counted once if capacity remains, never increments to101/reopens.
    if v_window.closed_at is null then
      update ops.worker_gateway_rate_windows set closed_at=v_now,close_count=1,
        admitted_count=least(100,admitted_count+1) where window_id=p_window_id;
    end if;
    return ops.worker_gateway_response(p_window_id,'closed','window_closed',null);
  end if;
  if v_window.closed_at is not null then
    return ops.worker_gateway_response(p_window_id,'closed','window_closed',null);
  end if;
  if v_window.bound_audience is null then
    return ops.worker_gateway_response(p_window_id,'rejected','operation_not_permitted',null);
  end if;
  if v_window.expires_at is not null and v_window.expires_at <= v_now then
    update ops.worker_gateway_rate_windows set closed_at=v_now where window_id=p_window_id;
    return ops.worker_gateway_response(p_window_id,'closed','window_expired',null);
  end if;
  if v_window.admitted_count >= 100 then
    return ops.worker_gateway_response(p_window_id,'limited','request_limit',null);
  end if;
  if (v_window.minute_start = date_trunc('minute',v_now) and v_window.minute_count >= 30)
    or (v_window.day_start=v_day and v_window.day_count >=500) then
    return ops.worker_gateway_response(p_window_id,'limited','rate_limited',null);
  end if;
  update ops.worker_gateway_rate_windows set
    starts_at=coalesce(starts_at,v_now),expires_at=coalesce(expires_at,v_now+interval '30 minutes'),
    admitted_count=admitted_count+1,
    minute_count=case when minute_start=date_trunc('minute',v_now) then minute_count+1 else 1 end,
    minute_start=date_trunc('minute',v_now),
    day_count=case when day_start=v_day then day_count+1 else 1 end,day_start=v_day
    where window_id=p_window_id;
  -- Status correlation IDs are not business keys and cannot reserve a target.
  if p_operation='request.status' then
    return ops.worker_gateway_response(p_window_id,'admitted',null,null);
  end if;
  -- All other aliases are known but disabled by this connection-only approval.
  if p_operation in ('run.start','run.finish','apify.register','apify.read','apify.pending',
    'apify.process','cost.log','fees.accrue') then
    return ops.worker_gateway_response(p_window_id,'rejected','operation_not_permitted',null);
  end if;
  v_digest := encode(extensions.digest(convert_to(jsonb_build_object('operation',p_operation,'args',p_args)::text,'UTF8'),'sha256'),'hex');
  select * into v_request from ops.worker_gateway_requests where window_id=p_window_id and request_id=p_request_id;
  if found then
    if v_request.operation <> p_operation or v_request.payload_sha256 <> v_digest then
      return ops.worker_gateway_response(p_window_id,'conflict','args_conflict',null);
    elsif v_request.state='completed' then
      return ops.worker_gateway_response(p_window_id,'completed',null,v_request.result);
    elsif v_request.state='rejected' then
      return ops.worker_gateway_response(p_window_id,'rejected',v_request.error_code,null);
    elsif v_request.lease_expires_at <= v_now then
      return ops.worker_gateway_response(p_window_id,'reconciliation_required','reconciliation_required',null);
    end if;
    return ops.worker_gateway_response(p_window_id,'in_flight',null,null);
  end if;
  select slot into v_slot from ops.worker_gateway_leases where window_id=p_window_id
    and (request_id is null or expires_at <= v_now) order by slot limit 1 for update;
  if v_slot is null then
    return ops.worker_gateway_response(p_window_id,'limited','concurrency_limit',null);
  end if;
  insert into ops.worker_gateway_requests(window_id,request_id,operation,payload_sha256,state,lease_expires_at)
    values(p_window_id,p_request_id,p_operation,v_digest,'reserved',v_now+interval '30 seconds');
  update ops.worker_gateway_leases set request_id=p_request_id,expires_at=v_now+interval '30 seconds'
    where window_id=p_window_id and slot=v_slot;
  return ops.worker_gateway_response(p_window_id,'admitted',null,null);
end;
$$;

create function ops.worker_gateway_execute(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_window ops.worker_gateway_rate_windows%rowtype;
  v_request ops.worker_gateway_requests%rowtype;
  v_result jsonb;
  v_digest text;
  v_slot smallint;
  v_now timestamptz := clock_timestamp();
  v_expired boolean := false;
begin
  perform ops.worker_gateway_validate(p_window_id,p_request_id,p_operation,p_args);
  -- Lock order matches admission/close: parent window, request, then lease.
  -- Close cannot acknowledge while an earlier executing transaction is open.
  select * into strict v_window from ops.worker_gateway_rate_windows where window_id=p_window_id for share;
  v_now := clock_timestamp();
  if v_window.bound_audience is null then
    return ops.worker_gateway_response(p_window_id,'rejected','operation_not_permitted',null);
  end if;
  if v_window.closed_at is not null or v_window.expires_at is null or v_window.expires_at <= v_now then
    return ops.worker_gateway_response(p_window_id,'closed',case when v_window.closed_at is not null then 'window_closed' else 'window_expired' end,null);
  end if;
  if p_operation in ('request.status','run.start','run.finish','apify.register','apify.read','apify.pending',
    'apify.process','cost.log','fees.accrue') then
    return ops.worker_gateway_response(p_window_id,'rejected','operation_not_permitted',null);
  end if;
  -- No waiting duplicate may execute after a canceled/unknown previous call.
  select * into v_request from ops.worker_gateway_requests where window_id=p_window_id and request_id=p_request_id for update nowait;
  if not found then
    return ops.worker_gateway_response(p_window_id,'absent','not_found',null);
  end if;
  v_digest := encode(extensions.digest(convert_to(jsonb_build_object('operation',p_operation,'args',p_args)::text,'UTF8'),'sha256'),'hex');
  if v_request.operation<>p_operation or v_request.payload_sha256<>v_digest then
    return ops.worker_gateway_response(p_window_id,'conflict','args_conflict',null);
  elsif v_request.state='completed' then
    return ops.worker_gateway_response(p_window_id,'completed',null,v_request.result);
  elsif v_request.state='rejected' then
    return ops.worker_gateway_response(p_window_id,'rejected',v_request.error_code,null);
  elsif v_request.lease_expires_at<=v_now then
    return ops.worker_gateway_response(p_window_id,'reconciliation_required','reconciliation_required',null);
  end if;
  select slot into v_slot from ops.worker_gateway_leases where window_id=p_window_id and request_id=p_request_id
    and expires_at>v_now for update;
  -- Leases bound reservations. A transaction-scoped lock additionally prevents
  -- expiry/replacement of a slow lease from admitting a third executing call.
  if v_slot is null or not pg_try_advisory_xact_lock(817403,v_slot::integer) then
    return ops.worker_gateway_response(p_window_id,'limited','concurrency_limit',null);
  end if;
  begin
    if v_window.expires_at<=clock_timestamp() then
      v_expired := true;
      raise exception using errcode='22023',message='gateway_deadline';
    end if;
    case p_operation
      when 'identity.read' then
        -- current_user here is the definer, not the connection principal. The
        -- route's separate pre-wrapper SELECT supplies actual currentUser.
        v_result := jsonb_build_object('sessionUser',session_user,'database',current_database(),
          'projectRef','zmotjsbzhzjvpelxvxlf','connectionCount',
          (select count(*) from pg_stat_activity where usename=session_user));
      when 'settings.read' then
        v_result := jsonb_build_object('key',p_args->>'key','value',ops.get_setting(p_args->>'key'));
      when 'prices.read' then
        v_result := jsonb_build_object('prices',ops.get_price_book());
      when 'health.read' then
        v_result := ops.daily_health();
      when 'error.log' then
        perform ops.log_workflow_error(jsonb_build_object('kind','notify','workflow','M03-GATEWAY-ACCEPTANCE-DEV',
          'execution_id',p_args->>'executionId','node','Gateway','message','gateway_acceptance','stack',''));
        v_result := jsonb_build_object('acknowledged',true);
      when 'error.count' then
        v_result := jsonb_build_object('count',ops.error_count_24h('M03-GATEWAY-ACCEPTANCE-DEV',false));
      else
        raise exception using errcode='22023',message='gateway_operation_not_permitted';
    end case;
    if v_window.expires_at<=clock_timestamp() then
      v_expired := true;
      raise exception using errcode='22023',message='gateway_deadline';
    end if;
    if v_result is null or octet_length(v_result::text)>524288 then
      raise exception using errcode='22023',message='gateway_result_rejected';
    end if;
    -- Business side effect and saved outcome commit or roll back together.
    update ops.worker_gateway_requests set state='completed',result=v_result,completed_at=clock_timestamp()
      where window_id=p_window_id and request_id=p_request_id;
  exception when others then
    -- The nested transaction rolls back the operation first. Never save SQLERRM,
    -- SQLSTATE detail, parameters or the caller's raw input as an error receipt.
    update ops.worker_gateway_requests set state='rejected',error_code=case when v_expired then 'window_expired' else 'execution_failed' end,completed_at=clock_timestamp()
      where window_id=p_window_id and request_id=p_request_id;
    update ops.worker_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id and slot=v_slot;
    return ops.worker_gateway_response(p_window_id,case when v_expired then 'closed' else 'rejected' end,
      case when v_expired then 'window_expired' else 'execution_failed' end,null);
  end;
  update ops.worker_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id and slot=v_slot;
  return ops.worker_gateway_response(p_window_id,'completed',null,v_result);
exception when lock_not_available then
  return ops.worker_gateway_response(p_window_id,'in_flight',null,null);
end;
$$;

create function ops.worker_gateway_status(p_window_id uuid,p_target_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_window ops.worker_gateway_rate_windows%rowtype;
  v_request ops.worker_gateway_requests%rowtype;
begin
  -- This wrapper takes only the target. Fresh correlation-ID validation belongs
  -- to the separate admission call; use an internal distinct validation UUID.
  perform ops.worker_gateway_validate(p_window_id,
    case when p_target_request_id='00000000-0000-0000-0000-000000000000'::uuid
      then '00000000-0000-0000-0000-000000000001'::uuid else '00000000-0000-0000-0000-000000000000'::uuid end,'request.status',
    jsonb_build_object('targetRequestId',p_target_request_id));
  select * into strict v_window from ops.worker_gateway_rate_windows where window_id=p_window_id;
  if v_window.closed_at is not null or v_window.expires_at is null or v_window.expires_at<=clock_timestamp() then
    return ops.worker_gateway_response(p_window_id,'closed',case when v_window.closed_at is not null then 'window_closed' else 'window_expired' end,null);
  end if;
  select * into v_request from ops.worker_gateway_requests where window_id=p_window_id and request_id=p_target_request_id;
  if not found then
    return ops.worker_gateway_response(p_window_id,'absent','not_found',null);
  elsif v_request.state='completed' then
    return ops.worker_gateway_response(p_window_id,'completed',null,v_request.result);
  elsif v_request.state='rejected' then
    return ops.worker_gateway_response(p_window_id,'rejected',v_request.error_code,null);
  elsif v_request.lease_expires_at<=clock_timestamp() then
    return ops.worker_gateway_response(p_window_id,'reconciliation_required','reconciliation_required',null);
  end if;
  return ops.worker_gateway_response(p_window_id,'in_flight',null,null);
end;
$$;
revoke all on function ops.worker_gateway_response(uuid,text,text,jsonb),ops.worker_gateway_validate(uuid,uuid,text,jsonb)
  from public,anon,authenticated,api_agent,n8n_writer;
revoke all on function ops.worker_gateway_admit(uuid,uuid,text,jsonb,text),
  ops.worker_gateway_execute(uuid,uuid,text,jsonb),ops.worker_gateway_status(uuid,uuid)
  from public,anon,authenticated,api_agent;
grant execute on function ops.worker_gateway_admit(uuid,uuid,text,jsonb,text),
  ops.worker_gateway_execute(uuid,uuid,text,jsonb),ops.worker_gateway_status(uuid,uuid) to n8n_writer;
