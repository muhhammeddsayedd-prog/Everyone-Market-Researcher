-- M06 upkeep: a narrow restricted product path, not a collection/approval ledger.
-- Source completeness is derived by the maintained server adapter, never an HTTP
-- caller flag. These RPCs additionally fence account/date/field ownership.
-- https://supabase.com/docs/guides/database/functions
-- https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS

create unique index m06_upkeep_request_unique on ops.audit_log(actor_id)
  where actor_type='n8n' and action in ('m06_mark_removed','m06_refresh_metrics','m06_apply_observation');

create function private.m06_upkeep_replay(p_request_id uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare prior ops.audit_log%rowtype; fingerprint text;
begin
  if p_request_id is null then raise exception using errcode='22023',message='upkeep request identity required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('m06_upkeep:'||p_request_id::text,0));
  fingerprint:=encode(extensions.digest(p_args::text,'sha256'),'hex');
  select * into prior from ops.audit_log where actor_type='n8n' and actor_id=p_request_id::text
    and action in ('m06_mark_removed','m06_refresh_metrics','m06_apply_observation');
  if found then
    if prior.action<>'m06_'||p_operation or prior.before->>'payload_sha256' is distinct from fingerprint then
      raise exception using errcode='55000',message='upkeep request payload changed'; end if;
    return jsonb_build_object('replayed',true,'result',prior.after);
  end if;
  return null;
end $$;

create function private.m06_upkeep_account(p_account_id uuid,p_since date,p_observed_before timestamptz)
returns app.competitor_accounts language plpgsql set search_path='' as $$
declare account app.competitor_accounts%rowtype; today date:=(clock_timestamp() at time zone 'UTC')::date;
begin
  if p_account_id is null or p_since is null or p_since<today-365 or p_since>today
    or p_observed_before is null or p_observed_before>clock_timestamp()
    or p_observed_before<clock_timestamp()-interval '24 hours' then
    raise exception using errcode='22023',message='bounded upkeep observation required'; end if;
  select a.* into account from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
    where a.id=p_account_id and a.status='active' and c.status='active' for update of a;
  if not found or account.platform not in ('vimeo','youtube','instagram','linkedin') then
    raise exception using errcode='42501',message='active supported upkeep account required'; end if;
  if account.locked_until>clock_timestamp() then
    raise exception using errcode='55000',message='upkeep account is claimed by collection'; end if;
  return account;
end $$;

create function ops.get_upkeep_source_runs(p_account_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare account app.competitor_accounts%rowtype; result jsonb;
begin
  select a.* into account from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
    where a.id=p_account_id and a.status='active' and c.status='active';
  if not found or account.platform not in ('vimeo','youtube','instagram','linkedin') then
    raise exception using errcode='42501',message='active supported upkeep account required'; end if;
  -- Dataset completion is NOT source exhaustion. Historical M04/M05 launch
  -- allocations do not store build IDs: leave that value unknown; the source
  -- adapter reads the known provider run and verifies actor/INPUT attribution.
  select coalesce(jsonb_agg(r.value order by r.pass),'[]'::jsonb) into result from (
    select distinct on(l.pass) l.pass,jsonb_build_object('run_id',a.apify_run_id,'apify_run_id',a.apify_run_id,'parent_run_id',l.run_id,'actor_id',l.actor_id,
      'build_id',null,'pass',l.pass,'purpose',l.purpose,'results_limit',l.results_limit,
      'account_ids',l.account_ids,'dataset_id',a.dataset_id,'status',a.status,
      'started_at',a.started_at,'finished_at',a.finished_at,'dataset_complete',l.dataset_complete) value
    from ops.collector_launches l join ops.apify_runs a on a.apify_run_id=l.apify_run_id
      join ops.collector_accounts ca on ca.run_id=l.run_id and ca.account_id=p_account_id
      join ops.scrape_runs p on p.id=l.run_id
    where p_account_id=any(l.account_ids) and p_account_id=any(a.account_ids) and a.run_id=l.run_id
      and a.actor_id=l.actor_id and a.status='SUCCEEDED' and a.processed_at is not null
      and a.finished_at is not null and a.dataset_id is not null and p.platform=account.platform and p.env='dev'
      and ((account.platform='instagram' and p.workflow='WF-11') or (account.platform='linkedin' and p.workflow='WF-18'))
      and ((account.platform='instagram' and l.actor_id='apify/instagram-scraper' and l.pass in ('posts','reels'))
        or (account.platform='linkedin' and l.actor_id='harvestapi/linkedin-company-posts' and l.pass='primary'))
    order by l.pass,a.finished_at desc,l.launch_id
  ) r;
  return result;
end $$;

create function ops.get_removal_targets(p_platform app.platform,p_window_days int)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; observed_before timestamptz:=clock_timestamp(); since date;
begin
  if p_platform is null or p_platform not in ('vimeo','youtube','instagram','linkedin')
    or p_window_days is null or p_window_days not between 1 and 365 then
    raise exception using errcode='22023',message='supported bounded upkeep platform required'; end if;
  since:=(observed_before at time zone 'UTC')::date-p_window_days;
  if exists(select 1 from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
    where a.platform=p_platform and a.status='active' and c.status='active'
      and (a.locked_until is null or a.locked_until<=observed_before)
      and (select count(*) from app.items i where i.account_id=a.id and i.competitor_id=a.competitor_id
        and i.platform=a.platform and i.published_at>=since::timestamp at time zone 'UTC'
        and i.published_at<=observed_before)>10000) then
    raise exception using errcode='54000',message='upkeep target exceeds bounded identity list'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('account_id',a.id,'competitor_id',a.competitor_id,
    'platform',a.platform,'handle',a.handle,'url',a.url,'external_id',a.external_id,
    'uploads_playlist_id',a.uploads_playlist_id,'since',since,
    'metrics_since',greatest(since,(observed_before at time zone 'UTC')::date-30),
    'observed_before',observed_before,'source_runs',coalesce((select jsonb_object_agg(
      case when r->>'pass'='primary' then 'posts' else r->>'pass' end,r)
      from jsonb_array_elements(ops.get_upkeep_source_runs(a.id)) r),'{}'::jsonb),'known_external_ids',coalesce((select jsonb_agg(i.external_id order by i.external_id)
      from app.items i where i.account_id=a.id and i.competitor_id=a.competitor_id and i.platform=a.platform
        and i.published_at>=since::timestamp at time zone 'UTC' and i.published_at<=observed_before),'[]'::jsonb))
    order by a.id),'[]'::jsonb) into result
    from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
    where a.platform=p_platform and a.status='active' and c.status='active'
      and (a.locked_until is null or a.locked_until<=observed_before);
  if jsonb_array_length(result)>1000 or octet_length(result::text)>4194304 then
    raise exception using errcode='54000',message='upkeep target response exceeds bound'; end if;
  return result;
end $$;

create function private.m06_upkeep_metrics(p_account_id uuid,p_rows jsonb,p_since date,p_observed_before timestamptz)
returns jsonb language plpgsql set search_path='' as $$
declare account app.competitor_accounts%rowtype; source jsonb; clean jsonb; observed_at timestamptz; item app.items%rowtype; updated int:=0; skipped int:=0;
begin
  account:=private.m06_upkeep_account(p_account_id,p_since,p_observed_before);
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10000
    or octet_length(p_rows::text)>2097152 then raise exception using errcode='22023',message='bounded upkeep metric rows required'; end if;
  if (select count(distinct value->>'external_id') from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) then
    raise exception using errcode='22023',message='unique observed metric identities required'; end if;
  for source in select value from jsonb_array_elements(p_rows) order by value->>'external_id' loop
    if jsonb_typeof(source)<>'object' or not(source ?& array['external_id','metrics','observed_at'])
      or exists(select 1 from jsonb_object_keys(source) k where k<>all(array['external_id','metrics','observed_at']))
      or coalesce(source->>'external_id','')!~'^[A-Za-z0-9_-]{1,200}$'
      or coalesce(source->>'observed_at','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
      or jsonb_typeof(source->'metrics') is distinct from 'object'
      or exists(select 1 from jsonb_each(source->'metrics') e where e.key<>all(array['views','plays','likes','comments','shares','reactions','saves'])
        or (e.value<>'null'::jsonb and not(case when jsonb_typeof(e.value)='number' and e.value::text~'^[0-9]+(\.0+)?$'
          then (e.value::text)::numeric<=9007199254740991 else false end))) then
      raise exception using errcode='22023',message='valid finite observed metrics required'; end if;
    begin observed_at:=(source->>'observed_at')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode='22023',message='valid metric observation timestamp required'; end;
    if observed_at>clock_timestamp() or observed_at<p_since::timestamp at time zone 'UTC' then
      raise exception using errcode='22023',message='bounded metric observation timestamp required'; end if;
    select * into item from app.items i where i.platform=account.platform and i.external_id=source->>'external_id' for update;
    if not found then skipped:=skipped+1; continue; end if;
    if item.account_id is distinct from account.id or item.competitor_id<>account.competitor_id then
      raise exception using errcode='42501',message='observed metric identity belongs to another account'; end if;
    select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into clean from jsonb_each(source->'metrics') e where e.value<>'null'::jsonb;
    if item.published_at is null or item.published_at<p_since::timestamp at time zone 'UTC'
      or item.published_at>p_observed_before or item.created_at>p_observed_before
      or item.metrics_updated_at>observed_at
      or clean='{}'::jsonb or exists(select 1 from unnest(item.locked_fields) f where f='metrics' or f like 'metrics.%') then
      skipped:=skipped+1; continue; end if;
    update app.items set metrics=metrics||clean,metrics_updated_at=observed_at where id=item.id;
    updated:=updated+1;
  end loop;
  return jsonb_build_object('updated',updated,'skipped',skipped);
end $$;

create function private.m06_upkeep_remove(p_account_id uuid,p_seen_external_ids text[],p_since date,p_observed_before timestamptz)
returns jsonb language plpgsql set search_path='' as $$
declare account app.competitor_accounts%rowtype; removed int:=0; restored int:=0;
begin
  account:=private.m06_upkeep_account(p_account_id,p_since,p_observed_before);
  if p_seen_external_ids is null or cardinality(p_seen_external_ids)>10000
    or exists(select 1 from unnest(p_seen_external_ids) s where s is null or s!~'^[A-Za-z0-9_-]{1,200}$')
    or (select count(distinct s) from unnest(p_seen_external_ids) s)<>cardinality(p_seen_external_ids) then
    raise exception using errcode='22023',message='bounded unique seen identities required'; end if;
  if exists(select 1 from app.items i where i.platform=account.platform and i.external_id=any(p_seen_external_ids)
      and (i.account_id is distinct from account.id or i.competitor_id<>account.competitor_id)) then
    raise exception using errcode='42501',message='seen identity belongs to another account'; end if;
  if cardinality(p_seen_external_ids)=0 then return jsonb_build_object('removed',0,'restored',0,'skipped','empty_listing'); end if;
  -- Lock candidate identities in stable order; source ingestion follows the
  -- same account/global-identity order. Fresh rows created after lookup do not
  -- become absence candidates for an older network observation.
  perform 1 from app.items i where i.account_id=account.id and i.competitor_id=account.competitor_id and i.platform=account.platform
    and i.published_at>=p_since::timestamp at time zone 'UTC' and i.published_at<=p_observed_before
    and i.created_at<=p_observed_before order by i.external_id for update;
  update app.items i set status='removed',removed_detected_at=clock_timestamp()
    where i.account_id=account.id and i.competitor_id=account.competitor_id and i.platform=account.platform
      and i.published_at>=p_since::timestamp at time zone 'UTC' and i.published_at<=p_observed_before
      and i.created_at<=p_observed_before and i.status='active' and not(i.external_id=any(p_seen_external_ids))
      and not('status'=any(i.locked_fields) or 'removed_detected_at'=any(i.locked_fields));
  get diagnostics removed=row_count;
  update app.items i set status='active',removed_detected_at=null
    where i.account_id=account.id and i.competitor_id=account.competitor_id and i.platform=account.platform
      and i.published_at>=p_since::timestamp at time zone 'UTC' and i.published_at<=p_observed_before
      and i.created_at<=p_observed_before and i.status='removed' and i.external_id=any(p_seen_external_ids)
      and not('status'=any(i.locked_fields) or 'removed_detected_at'=any(i.locked_fields));
  get diagnostics restored=row_count;
  return jsonb_build_object('removed',removed,'restored',restored,'skipped',null);
end $$;

create function ops.mark_removed(p_request_id uuid,p_account_id uuid,p_seen_external_ids text[],p_since date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare args jsonb:=jsonb_build_object('account_id',p_account_id,'seen_external_ids',p_seen_external_ids,'since',p_since); prior jsonb; result jsonb;
begin
  prior:=private.m06_upkeep_replay(p_request_id,'mark_removed',args); if prior is not null then return prior; end if;
  result:=private.m06_upkeep_remove(p_account_id,p_seen_external_ids,p_since,clock_timestamp());
  insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,before,after)
    values('n8n',p_request_id::text,'m06_mark_removed','account',p_account_id::text,
      jsonb_build_object('payload_sha256',encode(extensions.digest(args::text,'sha256'),'hex')),result);
  return jsonb_build_object('replayed',false,'result',result);
end $$;

create function ops.refresh_item_metrics(p_request_id uuid,p_account_id uuid,p_rows jsonb,p_since date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare args jsonb:=jsonb_build_object('account_id',p_account_id,'rows',p_rows,'since',p_since); prior jsonb; result jsonb;
begin
  prior:=private.m06_upkeep_replay(p_request_id,'refresh_metrics',args); if prior is not null then return prior; end if;
  result:=private.m06_upkeep_metrics(p_account_id,p_rows,p_since,clock_timestamp());
  insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,before,after)
    values('n8n',p_request_id::text,'m06_refresh_metrics','account',p_account_id::text,
      jsonb_build_object('payload_sha256',encode(extensions.digest(args::text,'sha256'),'hex')),result);
  return jsonb_build_object('replayed',false,'result',result);
end $$;

create function ops.apply_upkeep_observation(p_request_id uuid,p_account_id uuid,p_since date,p_metrics_since date,
  p_rows jsonb,p_seen_external_ids text[],p_skip_reason text,p_observed_before timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare args jsonb:=jsonb_build_object('account_id',p_account_id,'since',p_since,'metrics_since',p_metrics_since,
  'rows',p_rows,'seen_external_ids',p_seen_external_ids,'skip_reason',p_skip_reason,'observed_before',p_observed_before);
  prior jsonb; result jsonb; metrics jsonb; removal jsonb; account app.competitor_accounts%rowtype;
begin
  prior:=private.m06_upkeep_replay(p_request_id,'apply_observation',args); if prior is not null then return prior; end if;
  account:=private.m06_upkeep_account(p_account_id,p_since,p_observed_before);
  if p_metrics_since is null or p_metrics_since<p_since or p_metrics_since>(clock_timestamp() at time zone 'UTC')::date
    or (p_seen_external_ids is null and (p_skip_reason is null or p_skip_reason!~'^[a-z][a-z0-9_]{0,99}$'))
    or (p_seen_external_ids is not null and p_skip_reason is not null) then
    raise exception using errcode='22023',message='consistent bounded upkeep observation required'; end if;
  metrics:=private.m06_upkeep_metrics(p_account_id,p_rows,p_metrics_since,p_observed_before);
  if p_seen_external_ids is not null then removal:=private.m06_upkeep_remove(p_account_id,p_seen_external_ids,p_since,p_observed_before); end if;
  result:=jsonb_build_object('account_id',account.id,'platform',account.platform,'since',p_since,'metrics_since',p_metrics_since,
    'metrics_updated',(metrics->>'updated')::int,'eligible',p_seen_external_ids is not null and removal->>'skipped' is null,
    'reason',coalesce(p_skip_reason,removal->>'skipped'),'removal',case when removal->>'skipped' is null then removal else null end);
  insert into ops.audit_log(actor_type,actor_id,action,entity_type,entity_id,before,after)
    values('n8n',p_request_id::text,'m06_apply_observation','account',p_account_id::text,
      jsonb_build_object('payload_sha256',encode(extensions.digest(args::text,'sha256'),'hex')),result);
  return jsonb_build_object('replayed',false,'result',result);
end $$;

create function ops.upkeep_request_status(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare prior ops.audit_log%rowtype;
begin
  if p_request_id is null then raise exception using errcode='22023',message='upkeep request identity required'; end if;
  select * into prior from ops.audit_log where actor_type='n8n' and actor_id=p_request_id::text
    and action in ('m06_mark_removed','m06_refresh_metrics','m06_apply_observation');
  return jsonb_build_object('state',case when found then 'completed' else 'missing' end,
    'operation',case when found then substr(prior.action,5) else null end,'result',prior.after);
end $$;

revoke all on function private.m06_upkeep_replay(uuid,text,jsonb),private.m06_upkeep_account(uuid,date,timestamptz),
  private.m06_upkeep_metrics(uuid,jsonb,date,timestamptz),private.m06_upkeep_remove(uuid,text[],date,timestamptz)
  from public,anon,authenticated,n8n_writer,api_agent;
revoke all on function ops.get_upkeep_source_runs(uuid),ops.get_removal_targets(app.platform,int),ops.mark_removed(uuid,uuid,text[],date),
  ops.refresh_item_metrics(uuid,uuid,jsonb,date),ops.apply_upkeep_observation(uuid,uuid,date,date,jsonb,text[],text,timestamptz),
  ops.upkeep_request_status(uuid) from public,anon,authenticated,n8n_writer,api_agent;
grant execute on function ops.get_upkeep_source_runs(uuid),ops.get_removal_targets(app.platform,int),ops.mark_removed(uuid,uuid,text[],date),
  ops.refresh_item_metrics(uuid,uuid,jsonb,date),ops.apply_upkeep_observation(uuid,uuid,date,date,jsonb,text[],text,timestamptz),
  ops.upkeep_request_status(uuid) to n8n_writer;
