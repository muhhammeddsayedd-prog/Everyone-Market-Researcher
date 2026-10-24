-- Final source-review hardening, not yet applied locally or hosted at creation.
-- Strict JSON types precede admission; Close fences unresolved work; processing
-- requires the bounded server reader's durable settled metadata and exact page.
alter table ops.foundation_gateway_requests drop constraint foundation_gateway_requests_error_code_check;
alter table ops.foundation_gateway_requests add constraint foundation_gateway_requests_error_code_check
  check(error_code is null or error_code in ('execution_failed','window_expired','window_closed'));
create or replace function ops.foundation_gateway_validate(p_window_id uuid,p_request_id uuid,p_operation text,p_args jsonb)
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
    update ops.foundation_gateway_rate_windows set closed_at=v_now where window_id=p_window_id;
    update ops.apify_launch_approvals set closed_at=coalesce(closed_at,v_now) where window_id=p_window_id;
    update ops.foundation_gateway_requests set state='rejected',error_code=case when v_window.expires_at<=v_now then 'window_expired' else 'window_closed' end,completed_at=v_now
      where window_id=p_window_id and state='reserved';
    update ops.foundation_gateway_leases set request_id=null,expires_at=null where window_id=p_window_id;
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

create function ops.foundation_gateway_process(p_window_id uuid,p_args jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare v_registered jsonb; v_proven boolean;
begin
  v_registered:=ops.foundation_gateway_registered(p_window_id,p_args->>'apifyRunId');
  if v_registered is null then raise exception using errcode='22023',message='foundation_run_unregistered'; end if;
  select exists(select 1 from ops.foundation_gateway_requests first_read join ops.foundation_gateway_requests second_read
      on second_read.window_id=first_read.window_id and second_read.request_id<>first_read.request_id
      and second_read.result->'terminal'=first_read.result->'terminal'
      and second_read.completed_at>=first_read.completed_at+interval '10 seconds'
      and second_read.completed_at<=first_read.completed_at+interval '180 seconds'
    where first_read.window_id=p_window_id and first_read.operation='apify.terminal.read' and first_read.state='completed'
      and second_read.operation='apify.terminal.read' and second_read.state='completed'
      and second_read.result->'terminal'->>'apifyRunId'=p_args->>'apifyRunId'
      and second_read.result->'terminal'->>'parentRunId'=v_registered->>'run_id'
      and second_read.result->'terminal'->>'accountId'=v_registered->'account_ids'->>0
      and second_read.result->'terminal'->>'status'=p_args->>'status'
      and second_read.result->'terminal'->'datasetId'=p_args->'datasetId'
      and second_read.result->'terminal'->'usageTotalUsd'=p_args->'usageUsd'
      and (p_args->>'status'<>'SUCCEEDED' or exists(select 1 from ops.foundation_gateway_requests data_read
        where data_read.window_id=p_window_id and data_read.operation='apify.dataset.read' and data_read.state='completed'
          and data_read.completed_at>=second_read.completed_at
          and data_read.result->'terminal'=second_read.result->'terminal'
          and jsonb_array_length(p_args->'groups'->0->'items')=1
          and p_args->'groups'->0->'items'->0->'payload'=data_read.result->'rows'->0))) into v_proven;
  if not v_proven then raise exception using errcode='55000',message='foundation_trusted_reads_required'; end if;
  return ops.process_apify_run(p_args->>'apifyRunId',p_args->>'status',p_args->>'datasetId',
    (p_args->>'usageUsd')::numeric,p_args->'groups');
end;
$$;
revoke all on function ops.foundation_gateway_process(uuid,jsonb) from public,anon,authenticated,api_agent,n8n_writer;

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
