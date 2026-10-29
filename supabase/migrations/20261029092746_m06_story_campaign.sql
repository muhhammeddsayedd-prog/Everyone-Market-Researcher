-- Finite development comparison. No campaign, runtime credential or schedule is
-- installed by this migration. The owner installs one verified immutable roster
-- after qualification. Existing22 and historical workflow contracts remain.
create table ops.m06_story_campaigns (
  id uuid primary key,
  starts_on date not null,
  ends_on date not null,
  stop_new_at timestamptz not null,
  shutdown_at timestamptz not null,
  configuration jsonb not null,
  protected_archive_ids bigint[] not null default '{}',
  stopped_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check(ends_on=starts_on+6),
  check(stop_new_at=(ends_on+time '12:00') at time zone 'Africa/Cairo'),
  check(shutdown_at=((ends_on+time '18:00') at time zone 'Africa/Cairo')+interval '24 hours'),
  check(jsonb_typeof(configuration)='object')
);
create table ops.m06_story_campaign_slots (
  campaign_id uuid not null references ops.m06_story_campaigns(id),
  day date not null,
  group_key text not null check(group_key ~ '^[a-z0-9_-]{1,60}$'),
  ordinal int not null check(ordinal between 1 and 100),
  selection jsonb not null,
  run_id uuid unique references ops.scrape_runs(id),
  state text not null default 'planned' check(state in ('planned','dispatched','failed','skipped')),
  error_code text check(error_code is null or error_code ~ '^[a-z][a-z0-9_]{0,79}$'),
  allocated_at timestamptz,
  primary key(campaign_id,day,group_key),
  unique(campaign_id,day,ordinal)
);
create index m06_campaign_slots_run on ops.m06_story_campaign_slots(run_id) where run_id is not null;
alter table ops.m06_story_campaigns enable row level security;
alter table ops.m06_story_campaign_slots enable row level security;
revoke all on ops.m06_story_campaigns,ops.m06_story_campaign_slots from public,anon,authenticated,n8n_writer,api_agent;

create function ops.m06_campaign_install(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c ops.m06_story_campaigns%rowtype; ids uuid[]; group_ids uuid[]; primary_ids uuid[]:='{}';
  v_id uuid; first_day date; g jsonb; pin jsonb; i int:=0; d int; actor text;
begin
  if session_user not in ('postgres','supabase_admin') then
    raise exception using errcode='42501',message='campaign owner installation required'; end if;
  if jsonb_typeof(p) is distinct from 'object' or not(p ?& array['campaign_id','starts_on','account_ids','groups','actor_pins','max_actor_starts','max_actor_usd','max_total_usd'])
    or exists(select 1 from jsonb_object_keys(p) k where k<>all(array['campaign_id','starts_on','account_ids','groups','actor_pins','max_actor_starts','max_actor_usd','max_total_usd']))
    or jsonb_typeof(p->'account_ids') is distinct from 'array' or jsonb_array_length(p->'account_ids')<>20
    or jsonb_typeof(p->'groups') is distinct from 'array' or jsonb_array_length(p->'groups') not between 2 and 3
    or jsonb_typeof(p->'actor_pins') is distinct from 'object'
    or jsonb_typeof(p->'max_actor_starts') is distinct from 'number'
    or jsonb_typeof(p->'max_actor_usd') is distinct from 'number'
    or jsonb_typeof(p->'max_total_usd') is distinct from 'number' then
    raise exception using errcode='22023',message='exact finite campaign configuration required'; end if;
  v_id:=(p->>'campaign_id')::uuid; first_day:=(p->>'starts_on')::date;
  select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p->'account_ids') x;
  if cardinality(ids)<>20 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
    or (p->>'max_actor_starts')::numeric<>trunc((p->>'max_actor_starts')::numeric)
    or (p->>'max_actor_starts')::numeric not between jsonb_array_length(p->'groups')*7 and 2147483647
    or (p->>'max_actor_usd')::numeric not between 0.000001 and 999999.999999
    or (p->>'max_total_usd')::numeric not between 0.000001 and 999999.999999
    or (p->>'max_actor_usd')::numeric> (p->>'max_total_usd')::numeric
    or (p->>'max_actor_usd')::numeric<>trunc((p->>'max_actor_usd')::numeric,6)
    or (p->>'max_total_usd')::numeric<>trunc((p->>'max_total_usd')::numeric,6)
    or exists(select 1 from unnest(ids) x where not exists(select 1 from app.competitor_accounts a
      where a.id=x and a.platform='instagram_stories' and a.status='active' and a.backfill_status='not_applicable')) then
    raise exception using errcode='22023',message='verified20 account roster and finite options required'; end if;
  for g in select value from jsonb_array_elements(p->'groups') loop
    i:=i+1;actor:=g->>'actor_id';pin:=p->'actor_pins'->actor;
    if jsonb_typeof(g) is distinct from 'object' or not(g ?& array['group_key','actor_id','collection_mode','account_ids','results_limit'])
      or exists(select 1 from jsonb_object_keys(g) k where k<>all(array['group_key','actor_id','collection_mode','account_ids','results_limit']))
      or coalesce(g->>'group_key','')!~'^[a-z0-9_-]{1,60}$'
      or actor not in ('data-slayer/instagram-stories-scraper','igview-owner/instagram-story-viewer','louisdeconinck/instagram-story-details-scraper')
      or g->>'collection_mode' is distinct from (case when actor='data-slayer/instagram-stories-scraper' then 'ingest' else 'bakeoff' end)
      or jsonb_typeof(g->'account_ids') is distinct from 'array'
      or jsonb_typeof(g->'results_limit') is distinct from 'number'
      or (g->>'results_limit')::numeric not between 1 and 50 or (g->>'results_limit')::numeric<>trunc((g->>'results_limit')::numeric)
      or jsonb_typeof(pin) is distinct from 'object' or coalesce(pin->>'buildId','')!~'^[A-Za-z0-9_-]{1,128}$'
      or coalesce(pin->>'build','')!~'^[0-9]+\.[0-9]+\.[0-9]+$'
      or jsonb_typeof(pin->'memoryMbytes') is distinct from 'number' or jsonb_typeof(pin->'timeoutSecs') is distinct from 'number'
      or (pin->>'memoryMbytes')::int not between 128 and 32768 or ((pin->>'memoryMbytes')::int & ((pin->>'memoryMbytes')::int-1))<>0
      or (pin->>'timeoutSecs')::int not between 30 and 600 then
      raise exception using errcode='22023',message='supported pinned campaign group required'; end if;
    select array_agg(x::uuid order by x::uuid) into group_ids from jsonb_array_elements_text(g->'account_ids') x;
    if group_ids is null or cardinality(group_ids)<>(select count(distinct x) from unnest(group_ids) x)
      or not(group_ids<@ids) or cardinality(group_ids)*(g->>'results_limit')::int>1000
      or (actor='data-slayer/instagram-stories-scraper' and (g->>'results_limit')::int>30)
      or group_ids<>ids then
      raise exception using errcode='22023',message='bounded full roster primary and comparison groups required'; end if;
    if actor='data-slayer/instagram-stories-scraper' then primary_ids:=primary_ids||group_ids; end if;
  end loop;
  if (select array_agg(x order by x) from unnest(primary_ids) x) is distinct from ids
    or (select count(*) from jsonb_array_elements(p->'groups') grp where grp->>'actor_id'='igview-owner/instagram-story-viewer')>1
    or (select count(*) from jsonb_array_elements(p->'groups') grp where grp->>'actor_id'='louisdeconinck/instagram-story-details-scraper')>1
    or (select count(distinct grp->>'group_key') from jsonb_array_elements(p->'groups') grp)<>i then
    raise exception using errcode='22023',message='each primary account once and unique comparison groups required'; end if;
  select * into c from ops.m06_story_campaigns where id=v_id for update;
  if found then
    if c.configuration<>p then raise exception using errcode='55000',message='campaign configuration immutable'; end if;
  else
    if first_day<(clock_timestamp() at time zone 'Africa/Cairo')::date then
      raise exception using errcode='22023',message='campaign cannot backdate observation days'; end if;
    insert into ops.m06_story_campaigns(id,starts_on,ends_on,stop_new_at,shutdown_at,configuration,protected_archive_ids)
      values(v_id,first_day,first_day+6,((first_day+6)+time '12:00') at time zone 'Africa/Cairo',
      (((first_day+6)+time '18:00') at time zone 'Africa/Cairo')+interval '24 hours',p,
      coalesce((select array_agg(msg_id order by msg_id) from pgmq.a_media_stories),'{}')) returning * into c;
    for d in 0..6 loop
      i:=0;
      for g in select value from jsonb_array_elements(p->'groups') loop
        i:=i+1;
        insert into ops.m06_story_campaign_slots(campaign_id,day,group_key,ordinal,selection)
          values(c.id,first_day+d,g->>'group_key',i,g);
      end loop;
    end loop;
  end if;
  return jsonb_build_object('campaign_id',c.id,'starts_on',c.starts_on,'ends_on',c.ends_on,
    'stop_new_at',c.stop_new_at,'shutdown_at',c.shutdown_at,'slots',(select count(*) from ops.m06_story_campaign_slots where campaign_id=c.id));
end $$;
revoke all on function ops.m06_campaign_install(jsonb) from public,anon,authenticated,n8n_writer,api_agent;

-- The reviewed22 implementation is retained byte-for-byte by moving it rather
-- than copying or rewriting it. Only campaign launch admissions are intercepted.
alter function ops.m06_execute(uuid,text,jsonb) set schema private;
alter function private.m06_execute(uuid,text,jsonb) rename to m06_execute_v22;
revoke all on function private.m06_execute_v22(uuid,text,jsonb) from public,anon,authenticated,n8n_writer,api_agent;

create function private.m06_campaign_assert_launch(p_args jsonb,p_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare c ops.m06_story_campaigns%rowtype; s ops.m06_story_campaign_slots%rowtype; pin jsonb; ids uuid[]; at timestamptz:=p_at;
begin
  if at is null then raise exception using errcode='22023',message='server time required'; end if;
    select * into s from ops.m06_story_campaign_slots where run_id=(p_args->>'run_id')::uuid for update;
    if found then
      select * into c from ops.m06_story_campaigns where id=s.campaign_id;
      if not exists(select 1 from ops.collector_launches l where l.launch_id=(p_args->>'launch_id')::uuid) then
        if c.stopped_at is not null or at>=c.stop_new_at or (at at time zone 'Africa/Cairo')::date<>s.day
          or (at at time zone 'Africa/Cairo')::time<time '06:00' or (at at time zone 'Africa/Cairo')::time>=time '12:00'
          or exists(select 1 from ops.collector_launches l where l.run_id=s.run_id) then
          raise exception using errcode='42501',message='campaign new launch cutoff or slot consumed'; end if;
        pin:=c.configuration->'actor_pins'->(s.selection->>'actor_id');
        select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(s.selection->'account_ids') x;
        if p_args->>'approval_id' is distinct from c.id::text or p_args->>'actor_id' is distinct from s.selection->>'actor_id'
          or p_args->>'collection_mode' is distinct from s.selection->>'collection_mode'
          or (select array_agg(x::uuid order by x::uuid) from jsonb_array_elements_text(p_args->'account_ids') x) is distinct from ids
          or (p_args->>'results_limit')::int is distinct from (s.selection->>'results_limit')::int
          or p_args->>'build_id' is distinct from pin->>'buildId'
          or (p_args->>'memory_mbytes')::int is distinct from (pin->>'memoryMbytes')::int
          or (p_args->>'timeout_secs')::int is distinct from (pin->>'timeoutSecs')::int
          or (p_args->>'max_actor_starts')::numeric is distinct from (c.configuration->>'max_actor_starts')::numeric
          or (p_args->>'max_actor_usd')::numeric is distinct from (c.configuration->>'max_actor_usd')::numeric
          or (p_args->>'max_total_usd')::numeric is distinct from (c.configuration->>'max_total_usd')::numeric then
          raise exception using errcode='42501',message='campaign launch differs from installed group and pin'; end if;
      end if;
    elsif exists(select 1 from ops.m06_story_campaigns where id=(p_args->>'approval_id')::uuid) then
      raise exception using errcode='42501',message='campaign launch requires its allocated slot';
    end if;
end $$;
revoke all on function private.m06_campaign_assert_launch(jsonb,timestamptz) from public,anon,authenticated,n8n_writer,api_agent;

create function ops.m06_execute(p_request_id uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_operation='m06.launch' then perform private.m06_campaign_assert_launch(p_args,clock_timestamp()); end if;
  return private.m06_execute_v22(p_request_id,p_operation,p_args);
end $$;
revoke all on function ops.m06_execute(uuid,text,jsonb) from public,anon,authenticated,api_agent;
grant execute on function ops.m06_execute(uuid,text,jsonb) to n8n_writer;

create function private.m06_campaign_tick_at(p_request_id uuid,p_campaign_id uuid,p_execution_id text,p_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c ops.m06_story_campaigns%rowtype; s ops.m06_story_campaign_slots%rowtype; r ops.scrape_runs%rowtype;
  l ops.collector_launches%rowtype; result jsonb; contexts jsonb; ids uuid[]; first_id uuid; previous ops.collector_requests%rowtype;
  digest text; media_claim ops.audit_log%rowtype; msg jsonb; outcome jsonb; message_ids bigint[]; safe_media boolean; lock_owned boolean:=false;
  digest_count int; at timestamptz:=p_at; today date:=(p_at at time zone 'Africa/Cairo')::date;
  local_time time:=(p_at at time zone 'Africa/Cairo')::time; phase text; recovered boolean:=false;
begin
  if p_at is null or p_request_id is null or p_campaign_id is null or coalesce(p_execution_id,'')!~'^[0-9]{1,15}$' then
    raise exception using errcode='22023',message='native campaign tick identity required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('m06-campaign:'||p_campaign_id::text,0));
  select * into c from ops.m06_story_campaigns where id=p_campaign_id for update;
  if not found then raise exception using errcode='42501',message='installed development campaign required'; end if;
  digest:=encode(extensions.digest(jsonb_build_object('campaign_id',p_campaign_id,'execution_id',p_execution_id)::text,'sha256'),'hex');
  select * into previous from ops.collector_requests where request_id=p_request_id;
  if found then
    if previous.operation<>'m06.campaign_tick' or previous.args_sha256<>digest then
      raise exception using errcode='55000',message='campaign request identity conflict'; end if;
    return jsonb_build_object('replayed',true,'result',jsonb_build_object('action','idle','campaign_id',c.id,'reason','tick_already_consumed'));
  end if;
  if c.stopped_at is not null or at>=c.shutdown_at then
    result:=jsonb_build_object('action','closed','campaign_id',c.id,'reason','campaign_stopped_or_shutdown');
  else
    -- Record missed slots truthfully; never manufacture observations or move a
    -- fixed date forward. A failed daily slot is not a permit for replacement.
    update ops.m06_story_campaign_slots set state='skipped',error_code='campaign_observation_missed'
      where campaign_id=c.id and state='planned' and (day<today or (day=today and local_time>=time '12:00'));
    update ops.m06_story_campaign_slots s0 set state='skipped',error_code='stories_actor_login_excluded'
      where s0.campaign_id=c.id and s0.state='planned' and exists(
        select 1 from ops.bakeoff_observations o join ops.apify_runs a using(apify_run_id)
        join ops.m06_story_campaign_slots s1 on s1.run_id=a.run_id where s1.campaign_id=c.id
          and o.login_prompt and o.actor=s0.selection->>'actor_id');
    select sr.* into r from ops.scrape_runs sr join ops.m06_story_campaign_slots sl on sl.run_id=sr.id
      where sl.campaign_id=c.id and sr.status='running' order by sr.started_at limit 1 for update of sr;
    if found then
      select * into l from ops.collector_launches where run_id=r.id order by created_at limit 1;
      if found and l.apify_run_id is null then
        result:=jsonb_build_object('action','blocked','campaign_id',c.id,'reason','actor_start_reconciliation_required');
      elsif found then
        if not(select registration_closed from ops.collector_runs where run_id=r.id) then
          perform private.m06_execute_v22(extensions.gen_random_uuid(),'m06.close_registration',jsonb_build_object('run_id',r.id));
        end if;
        if exists(select 1 from ops.m06_story_jobs where launch_id=l.launch_id and not settled) then
          select count(*) into digest_count from ops.audit_log a where a.action='m06_campaign_callback_recovery'
            and a.entity_type='campaign_job' and a.entity_id=l.apify_run_id and a.after->>'campaign_id'=c.id::text;
          if digest_count>=2 then result:=jsonb_build_object('action','blocked','campaign_id',c.id,'reason','callback_recovery_exhausted');
          else
            insert into ops.audit_log(actor_type,action,entity_type,entity_id,after) values('n8n','m06_campaign_callback_recovery','campaign_job',l.apify_run_id,
              jsonb_build_object('campaign_id',c.id,'attempt',digest_count+1));
            result:=jsonb_build_object('action','recover','campaign_id',c.id,'apify_run_id',l.apify_run_id,'run_id',r.id,'registration_closed',true);
          end if;
        end if;
      elsif r.started_at>at-interval '10 minutes' then
        result:=jsonb_build_object('action','idle','campaign_id',c.id,'reason','dispatch_in_progress');
      else
        -- No launch allocation means no paid start could have been issued.
        -- Close the failed run through the existing claim/finalize contract.
        perform private.m06_execute_v22(extensions.gen_random_uuid(),'m06.close_registration',jsonb_build_object('run_id',r.id));
        update ops.m06_story_campaign_slots set state='failed',error_code='campaign_dispatch_incomplete' where run_id=r.id;
      end if;
    end if;
    if result is null then
      select * into media_claim from ops.audit_log a where a.action='story_media_batch_claim' and
        not exists(select 1 from ops.audit_log f where f.entity_id=a.entity_id and f.action='story_media_batch_finish') order by a.id limit 1;
      if found then
        if media_claim.created_at>at-interval '10 minutes'
          or exists(select 1 from pg_catalog.pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted)
          or exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and application_name='emr-m06-media-dev' and state<>'idle') then
          result:=jsonb_build_object('action','idle','campaign_id',c.id,'reason','media_in_progress');
        else
        safe_media:=media_claim.created_at<=at-interval '10 minutes' and jsonb_array_length(media_claim.after->'held')=0
          and jsonb_array_length(media_claim.after->'messages') between 1 and 5
          and not exists(select 1 from pg_catalog.pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted)
          and not exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and application_name='emr-m06-media-dev' and state<>'idle');
        message_ids:='{}';
        for msg in select value from jsonb_array_elements(media_claim.after->'messages') loop
          if not exists(select 1 from ingest.raw_items raw join ops.m06_story_campaign_slots sl on sl.run_id=raw.run_id
            join app.items i on i.platform=raw.platform and i.account_id=raw.account_id and i.external_id=raw.external_id
            where sl.campaign_id=c.id and i.id::text=msg->'message'->>'item_id') then safe_media:=false; end if;
          select a.after into outcome from ops.audit_log a where a.action='story_media_message_outcome' and a.entity_id=msg->>'msg_id'
            and a.after->>'execution_id'=media_claim.entity_id and a.after->>'read_ct'=msg->>'read_ct' order by a.id desc limit 1;
          if outcome is null or outcome->>'outcome' not in ('stored','skipped','media_expired') then safe_media:=false; end if;
          if outcome->>'outcome'='stored' and not exists(select 1 from app.items i join app.media_assets ma
            on ma.item_id=i.id and ma.kind='thumbnail' and ma.storage_path=i.thumbnail_path and ma.source_url=i.thumbnail_source_url
            join storage.objects o on o.bucket_id='media' and o.name=ma.storage_path where i.id::text=msg->'message'->>'item_id') then safe_media:=false; end if;
          if not exists(select 1 from ops.audit_log a where a.action='story_media_message_ack' and a.entity_id=msg->>'msg_id'
            and a.after->>'execution_id'=media_claim.entity_id) then
            if not exists(select 1 from pgmq.q_media_stories q where q.msg_id=(msg->>'msg_id')::bigint and q.read_ct=(msg->>'read_ct')::int
              and q.message=msg->'message') then safe_media:=false; end if;
            message_ids:=array_append(message_ids,(msg->>'msg_id')::bigint);
          end if;
        end loop;
        select count(*) into digest_count from ops.audit_log a where a.action='m06_campaign_media_recovery'
          and a.entity_type='campaign_media' and a.entity_id=media_claim.entity_id and a.after->>'campaign_id'=c.id::text;
        if safe_media and digest_count<2 then
          lock_owned:=pg_catalog.pg_try_advisory_lock(73106,31);
          if lock_owned then
            begin
              -- Renew only the unchanged owned delivery with a durable safe
              -- outcome. Missing outcomes can conceal a PUT and never enter.
              for msg in select value from jsonb_array_elements(media_claim.after->'messages') where (value->>'msg_id')::bigint=any(message_ids) loop
                perform pgmq.set_vt('media_stories',(msg->>'msg_id')::bigint,600);
              end loop;
              if cardinality(message_ids)>0 then perform ops.ack_story_media_batch(media_claim.entity_id,message_ids); end if;
              perform ops.finish_story_media_batch(media_claim.entity_id);
              insert into ops.audit_log(actor_type,action,entity_type,entity_id,after) values('n8n','m06_campaign_media_recovery','campaign_media',media_claim.entity_id,
                jsonb_build_object('campaign_id',c.id,'attempt',digest_count+1));
            exception when others then
              perform pg_catalog.pg_advisory_unlock(73106,31);lock_owned:=false;raise;
            end;
            perform pg_catalog.pg_advisory_unlock(73106,31);lock_owned:=false;
          end if;
        end if;
        if not safe_media or digest_count>=2 or exists(select 1 from ops.audit_log a where a.action='story_media_batch_claim'
          and a.entity_id=media_claim.entity_id and not exists(select 1 from ops.audit_log f where f.entity_id=a.entity_id and f.action='story_media_batch_finish')) then
          result:=jsonb_build_object('action','blocked','campaign_id',c.id,'reason','media_reconciliation_required');
        end if;
        end if;
      end if;
    end if;
    if result is null and exists(select 1 from pgmq.q_media_stories) then
      if exists(select 1 from pgmq.q_media_stories q where not exists(select 1 from ingest.raw_items raw
        join ops.m06_story_campaign_slots sl on sl.run_id=raw.run_id join app.items i on i.platform=raw.platform
          and i.account_id=raw.account_id and i.external_id=raw.external_id
        where sl.campaign_id=c.id and i.id::text=q.message->>'item_id')) then
        result:=jsonb_build_object('action','blocked','campaign_id',c.id,'reason','unowned_story_work');
      else result:=jsonb_build_object('action','media','campaign_id',c.id,'max_batches',6); end if;
    end if;
    if result is null and (at>=c.stop_new_at or today<c.starts_on or today>c.ends_on or local_time<time '06:00' or local_time>=time '12:00') then
      result:=jsonb_build_object('action',case when at>=c.stop_new_at then 'closed' else 'idle' end,
        'campaign_id',c.id,'reason','outside_campaign_launch_window');
    end if;
    if result is null then
      select * into s from ops.m06_story_campaign_slots where campaign_id=c.id and day=today and state='planned'
        order by ordinal limit 1 for update;
      if not found then result:=jsonb_build_object('action','idle','campaign_id',c.id,'reason','daily_groups_complete');
      else
        select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(s.selection->'account_ids') x;
        if exists(select 1 from app.competitor_accounts a where a.id=any(ids) and
          (a.status<>'active' or a.backfill_status<>'not_applicable' or a.locked_until>at
            or (s.selection->>'collection_mode'='ingest' and a.next_due_at>at))) then
          result:=jsonb_build_object('action','idle','campaign_id',c.id,'reason','group_not_eligible');
        else
          first_id:=extensions.gen_random_uuid();
          result:=private.m06_execute_v22(first_id,'m06.start',jsonb_build_object('workflow','WF-12','platform','instagram_stories',
            'mode','daily','env','dev','execution_id',p_execution_id,'collection_mode',s.selection->>'collection_mode'));
          first_id:=(result->'result'->>'run_id')::uuid;
          contexts:=private.m06_execute_v22(extensions.gen_random_uuid(),'m06.claim',jsonb_build_object('run_id',first_id,
            'platform','instagram_stories','mode','daily','limit',cardinality(ids),'account_ids',to_jsonb(ids)))->'result';
          update ops.m06_story_campaign_slots set run_id=first_id,state='dispatched',allocated_at=at
            where campaign_id=c.id and day=s.day and group_key=s.group_key;
          result:=jsonb_build_object('action','launch','campaign_id',c.id,'day',s.day,'group_key',s.group_key,'run_id',first_id,
            'accounts',contexts,'selection',jsonb_build_object('env','dev','mode','daily','actor_id',s.selection->>'actor_id',
              'collection_mode',s.selection->>'collection_mode','account_ids',to_jsonb(ids),'results_limit',(s.selection->>'results_limit')::int,'max_actor_starts',1));
        end if;
      end if;
    end if;
  end if;
  insert into ops.collector_requests(request_id,operation,args_sha256,result) values(p_request_id,'m06.campaign_tick',digest,result);
  return jsonb_build_object('replayed',false,'result',result);
end $$;
revoke all on function private.m06_campaign_tick_at(uuid,uuid,text,timestamptz) from public,anon,authenticated,n8n_writer,api_agent;

create function ops.m06_campaign_tick(p_request_id uuid,p_campaign_id uuid,p_execution_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  return private.m06_campaign_tick_at(p_request_id,p_campaign_id,p_execution_id,clock_timestamp());
end $$;
revoke all on function ops.m06_campaign_tick(uuid,uuid,text) from public,anon,authenticated,api_agent;
grant execute on function ops.m06_campaign_tick(uuid,uuid,text) to n8n_writer;

create function ops.m06_campaign_stop(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare stopped timestamptz;
begin
  if session_user not in ('postgres','supabase_admin') then
    raise exception using errcode='42501',message='campaign owner stop required'; end if;
  update ops.m06_story_campaigns set stopped_at=coalesce(stopped_at,clock_timestamp()) where id=p_campaign_id returning stopped_at into stopped;
  if not found then raise exception using errcode='42501',message='installed campaign required'; end if;
  return jsonb_build_object('campaign_id',p_campaign_id,'stopped_at',stopped,'new_starts_allowed',false);
end $$;
revoke all on function ops.m06_campaign_stop(uuid) from public,anon,authenticated,n8n_writer,api_agent;

-- Called only by the server's verified project-scoped deployment webhook. It
-- can stop this development campaign, never resume it or mutate Production.
create function ops.m06_campaign_conflict(p_campaign_id uuid,p_event_id text,p_deployment_id text,p_observed_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c ops.m06_story_campaigns%rowtype; prior ops.audit_log%rowtype;
begin
  if p_campaign_id is null or coalesce(p_event_id,'')!~'^[A-Za-z0-9_-]{1,200}$'
    or coalesce(p_deployment_id,'')!~'^dpl_[A-Za-z0-9]{1,100}$' or p_observed_at is null then
    raise exception using errcode='22023',message='verified project deployment event identity required'; end if;
  select * into c from ops.m06_story_campaigns where id=p_campaign_id for update;
  if not found or p_observed_at<c.created_at or p_observed_at>c.shutdown_at or p_observed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='42501',message='event outside installed campaign lifetime'; end if;
  select * into prior from ops.audit_log a where a.action='m06_campaign_production_conflict'
    and a.entity_type='story_campaign' and a.entity_id=c.id::text and a.after->>'event_id'=p_event_id order by a.id limit 1;
  if found then
    if prior.after->>'deployment_id'<>p_deployment_id or (prior.after->>'observed_at')::timestamptz<>p_observed_at then
      raise exception using errcode='55000',message='campaign event identity conflict'; end if;
  else
    update ops.m06_story_campaigns set stopped_at=coalesce(stopped_at,clock_timestamp()) where id=c.id;
    insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
      values('system','m06_campaign_production_conflict','story_campaign',c.id::text,
      jsonb_build_object('event_id',p_event_id,'deployment_id',p_deployment_id,'observed_at',p_observed_at));
  end if;
  return jsonb_build_object('paused',true);
end $$;
revoke all on function ops.m06_campaign_conflict(uuid,text,text,timestamptz) from public,anon,authenticated,api_agent;
grant execute on function ops.m06_campaign_conflict(uuid,text,text,timestamptz) to n8n_writer;

-- Queue archive rows are operational receipts, not collected source data. This
-- campaign keeps every delivery through shutdown+30days. Only its own oldest
-- archived deliveries are eligible; the accepted pre-campaign13 are excluded
-- by ownership. No item/raw/comparison/audit row or generic queue is touched.
create function ops.m06_campaign_housekeeping(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c ops.m06_story_campaigns%rowtype; n int;
begin
  select * into c from ops.m06_story_campaigns where id=p_campaign_id;
  if not found then raise exception using errcode='42501',message='owned story campaign required'; end if;
  if clock_timestamp()<=c.shutdown_at+interval '30 days' then return jsonb_build_object('deleted',0,'retention','campaign_shutdown_plus30days'); end if;
  with candidates as (select q.msg_id from pgmq.a_media_stories q where q.archived_at<c.shutdown_at and not(q.msg_id=any(c.protected_archive_ids)) and exists(
    select 1 from ingest.raw_items raw join ops.m06_story_campaign_slots s on s.run_id=raw.run_id
    join app.items i on i.platform=raw.platform and i.account_id=raw.account_id and i.external_id=raw.external_id
    where s.campaign_id=c.id and i.id::text=q.message->>'item_id') order by q.msg_id limit 500),
  removed as (delete from pgmq.a_media_stories q using candidates c0 where q.msg_id=c0.msg_id returning q.msg_id)
  select count(*) into n from removed;
  return jsonb_build_object('deleted',n,'retention','campaign_shutdown_plus30days');
end $$;
revoke all on function ops.m06_campaign_housekeeping(uuid) from public,anon,authenticated,api_agent;
grant execute on function ops.m06_campaign_housekeeping(uuid) to n8n_writer;

create function ops.m06_campaign_snapshot(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c ops.m06_story_campaigns%rowtype; ids uuid[];
begin
  select * into c from ops.m06_story_campaigns where id=p_campaign_id;
  if not found then raise exception using errcode='42501',message='installed campaign required'; end if;
  select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(c.configuration->'account_ids') x;
  return jsonb_build_object('campaign_id',c.id,'from_day',c.starts_on,'to_day',c.ends_on,'stop_new_at',c.stop_new_at,'shutdown_at',c.shutdown_at,
    'accounts',to_jsonb(ids),'actors',(select jsonb_agg(a order by a) from(select distinct g->>'actor_id' a from jsonb_array_elements(c.configuration->'groups') g) t),
    'run_ids',(select coalesce(jsonb_agg(run_id order by day,ordinal),'[]') from ops.m06_story_campaign_slots where campaign_id=c.id and run_id is not null),
    'actor_run_ids',(select coalesce(jsonb_agg(a.apify_run_id order by s.day,s.ordinal,a.apify_run_id),'[]') from ops.apify_runs a
      join ops.m06_story_campaign_slots s on s.run_id=a.run_id where s.campaign_id=c.id),
    'slots',(select coalesce(jsonb_agg(jsonb_build_object('day',s.day,'group_key',s.group_key,'selection',s.selection,'run_id',s.run_id,'state',s.state,
      'error_code',s.error_code,'allocated_at',s.allocated_at,'run_status',r.status) order by s.day,s.ordinal),'[]') from ops.m06_story_campaign_slots s
      left join ops.scrape_runs r on r.id=s.run_id where s.campaign_id=c.id),
    'observations',(select coalesce(jsonb_agg(jsonb_build_object('day',o.day,'actor',o.actor,'account_id',o.account_id,'apify_run_id',o.apify_run_id,
      'status',o.status,'login_prompt',o.login_prompt,'story_keys',o.story_keys,'error_code',o.error_code) order by o.day,o.actor,o.account_id),'[]')
      from ops.bakeoff_observations o join ops.apify_runs a using(apify_run_id) join ops.m06_story_campaign_slots s on s.run_id=a.run_id where s.campaign_id=c.id),
    'rows',(select coalesce(jsonb_agg(jsonb_build_object('day',o.day,'actor',o.actor,'account_id',o.account_id,'apify_run_id',o.apify_run_id,
      'story_key',b.story_key,'raw_id',b.raw_id,'taken_at',b.taken_at,'has_thumbnail',b.has_thumbnail,'has_mentions',b.has_mentions,'has_link',b.has_link)
      order by o.day,o.actor,o.account_id,b.story_key),'[]') from ops.bakeoff_observations o join ops.apify_runs a using(apify_run_id)
      join ops.m06_story_campaign_slots s on s.run_id=a.run_id join ops.bakeoff_results b on b.actor=o.actor and b.account_id=o.account_id and b.story_key=any(o.story_keys)
      where s.campaign_id=c.id),
    'costs',(select coalesce(jsonb_agg(jsonb_build_object('actor',a.actor_id,'apify_run_id',a.apify_run_id,'usd',a.usage_usd) order by a.apify_run_id),'[]')
      from ops.apify_runs a join ops.m06_story_campaign_slots s on s.run_id=a.run_id where s.campaign_id=c.id),
    'thumbnail_items',(select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'account_id',i.account_id,'external_id',i.external_id,
      'first_seen_at',i.first_seen_at,'published_at',i.published_at,'has_source',i.thumbnail_source_url is not null,'eligible',i.thumbnail_source_url is not null,
      'apify_run_id',(select l.apify_run_id from ops.collector_launches l join ingest.raw_items raw on raw.run_id=l.run_id
        join ops.m06_story_campaign_slots cs on cs.run_id=l.run_id where cs.campaign_id=c.id and raw.platform=i.platform
          and raw.account_id=i.account_id and raw.external_id=i.external_id order by l.created_at limit 1),
      'thumbnail_path',i.thumbnail_path,'stored_at',ma.created_at,'discovery_lag_seconds',extract(epoch from i.first_seen_at-i.published_at),
      'within_six_hours',coalesce(ma.created_at<=i.first_seen_at+interval '6 hours',false)) order by i.id),'[]')
      from app.items i left join app.media_assets ma on ma.item_id=i.id and ma.kind='thumbnail' and ma.storage_path=i.thumbnail_path
      where exists(select 1 from ingest.raw_items raw join ops.m06_story_campaign_slots s on s.run_id=raw.run_id
        where s.campaign_id=c.id and raw.platform=i.platform and raw.account_id=i.account_id and raw.external_id=i.external_id)),
    'media_outcomes',(select coalesce(jsonb_agg(jsonb_build_object('action',a.action,'execution_id',a.after->>'execution_id','item_id',a.after->>'item_id',
      'outcome',a.after->>'outcome','created_at',a.created_at) order by a.id),'[]') from ops.audit_log a where a.entity_type='story_media_message'
      and exists(select 1 from ingest.raw_items raw join ops.m06_story_campaign_slots s on s.run_id=raw.run_id
        join app.items i on i.platform=raw.platform and i.account_id=raw.account_id and i.external_id=raw.external_id
        where s.campaign_id=c.id and i.id::text=a.after->>'item_id')));
end $$;
revoke all on function ops.m06_campaign_snapshot(uuid) from public,anon,authenticated,api_agent;
grant execute on function ops.m06_campaign_snapshot(uuid) to n8n_writer;
