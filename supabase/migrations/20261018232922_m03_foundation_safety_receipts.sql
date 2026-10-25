-- Forward local-review corrections; never rewrite either previously applied
-- local version or any of the ten hosted versions. No hosted/window activation.
-- Outside-window callbacks get exact safe rejection, all foundation deadlines
-- share the first-admission clock, and SUB cost accepts only durable equal replay.
create or replace function ops.foundation_gateway_registered(p_window_id uuid,p_apify_run_id text)
returns jsonb language plpgsql stable set search_path='' as $$
begin
  if not exists(select 1 from ops.apify_runs r where r.apify_run_id=p_apify_run_id) then return null; end if;
  if not exists(select 1 from ops.apify_launch_admissions l join ops.foundation_gateway_run_bindings b using(window_id,run_id)
    where l.window_id=p_window_id and l.apify_run_id=p_apify_run_id) then
    return null; end if;
  return ops.get_apify_run(p_apify_run_id);
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

create function ops.foundation_gateway_replay_costs(p_window_id uuid,p_entries jsonb)
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
        where l.window_id=p_window_id and r.processed_at is not null and l.run_id::text=v_entry->>'run_id'
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
revoke all on function ops.foundation_gateway_replay_costs(uuid,jsonb) from public,anon,authenticated,api_agent,n8n_writer;

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
