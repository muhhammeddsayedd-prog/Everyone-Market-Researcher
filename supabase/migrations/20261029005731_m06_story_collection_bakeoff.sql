-- M06 story-only collector and comparison contracts. Local qualification only;
-- applying this migration to hosted dev remains a separate authorized operation.
-- https://supabase.com/docs/guides/queues/pgmq
-- https://www.postgresql.org/docs/current/explicit-locking.html

create table ops.m06_story_runs (
  run_id uuid primary key references ops.collector_runs(run_id),
  collection_mode text not null check(collection_mode in ('ingest','bakeoff'))
);
create table ops.m06_story_jobs (
  launch_id uuid primary key references ops.collector_launches(launch_id),
  build_id text not null check(build_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  memory_mbytes int not null check(memory_mbytes between 128 and 32768 and (memory_mbytes & (memory_mbytes-1))=0),
  timeout_secs int not null check(timeout_secs between 30 and 600),
  actor_input jsonb not null check(jsonb_typeof(actor_input)='object'),
  collection_mode text not null check(collection_mode in ('ingest','bakeoff')),
  settled boolean not null default false,
  result jsonb,
  created_at timestamptz not null default now()
);
create table ops.bakeoff_observations (
  apify_run_id text not null references ops.apify_runs(apify_run_id),
  account_id uuid not null references app.competitor_accounts(id),
  day date not null,
  actor text not null check(actor in ('data-slayer/instagram-stories-scraper',
    'igview-owner/instagram-story-viewer','louisdeconinck/instagram-story-details-scraper')),
  status text not null check(status in ('success','no_stories','failed','excluded')),
  login_prompt boolean not null default false,
  error_code text check(error_code is null or error_code ~ '^[a-z][a-z0-9_]{0,79}$'),
  story_keys text[] not null default '{}',
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key(apify_run_id,account_id),
  check((status='success' and cardinality(story_keys)>0 and error_code is null and not login_prompt)
    or (status='no_stories' and cardinality(story_keys)=0 and error_code is null and not login_prompt)
    or (status in ('failed','excluded') and cardinality(story_keys)=0 and error_code is not null)),
  check(not login_prompt or status='excluded')
);
create index bakeoff_observations_account_day on ops.bakeoff_observations(account_id,day);
create table ops.bakeoff_results (
  id bigint generated always as identity primary key,
  day date not null,
  actor text not null,
  account_id uuid not null references app.competitor_accounts(id),
  story_key text not null check(length(story_key) between 1 and 200),
  raw_id text not null check(length(raw_id) between 1 and 200),
  taken_at timestamptz not null,
  has_thumbnail boolean not null,
  has_mentions boolean not null,
  has_link boolean not null,
  apify_run_id text not null,
  created_at timestamptz not null default now(),
  foreign key(apify_run_id,account_id) references ops.bakeoff_observations(apify_run_id,account_id),
  unique(actor,account_id,story_key)
);
create index bakeoff_results_account on ops.bakeoff_results(account_id);
create index bakeoff_results_observation on ops.bakeoff_results(apify_run_id,account_id);
alter table ops.m06_story_jobs enable row level security;
alter table ops.m06_story_runs enable row level security;
alter table ops.bakeoff_observations enable row level security;
alter table ops.bakeoff_results enable row level security;
revoke all on ops.m06_story_runs,ops.m06_story_jobs,ops.bakeoff_observations,ops.bakeoff_results from public,anon,authenticated,n8n_writer,api_agent;

-- Each observed account-day retains its exact keys, even when a story appears
-- again tomorrow. Global immutable rows supply feature metadata without losing
-- a recapture day's union/coverage membership.
create function ops.save_bakeoff_rows(p_rows jsonb)
returns int language plpgsql security definer set search_path='' as $$
declare v jsonb; observation ops.bakeoff_observations%rowtype; prior ops.bakeoff_results%rowtype; inserted int:=0;
begin
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10000
    or octet_length(p_rows::text)>4194304 then raise exception using errcode='22023',message='bounded comparison rows required'; end if;
  for v in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v)<>'object' or not(v ?& array['day','actor','account_id','story_key','raw_id','taken_at','has_thumbnail','has_mentions','has_link','apify_run_id'])
      or exists(select 1 from jsonb_object_keys(v) k where k<>all(array['day','actor','account_id','story_key','raw_id','taken_at','has_thumbnail','has_mentions','has_link','apify_run_id']))
      or jsonb_typeof(v->'has_thumbnail') is distinct from 'boolean'
      or jsonb_typeof(v->'has_mentions') is distinct from 'boolean'
      or jsonb_typeof(v->'has_link') is distinct from 'boolean'
      or coalesce(v->>'raw_id','')='' or length(v->>'raw_id')>200
      or coalesce(v->>'story_key','')='' or length(v->>'story_key')>200 then
      raise exception using errcode='22023',message='invalid comparison row'; end if;
    select * into observation from ops.bakeoff_observations o
      where o.apify_run_id=v->>'apify_run_id' and o.account_id=(v->>'account_id')::uuid;
    if not found or observation.status<>'success' or observation.actor<>v->>'actor'
      or observation.day<>(v->>'day')::date or not(v->>'story_key'=any(observation.story_keys))
      or (v->>'taken_at')::timestamptz>observation.observed_at+interval '5 minutes'
      or (v->>'taken_at')::timestamptz<observation.observed_at-interval '2 days' then
      raise exception using errcode='42501',message='registered story observation required'; end if;
    select * into prior from ops.bakeoff_results b where b.actor=observation.actor
      and b.account_id=observation.account_id and b.story_key=v->>'story_key' for update;
    if found then
      if prior.raw_id is distinct from v->>'raw_id' or prior.taken_at is distinct from (v->>'taken_at')::timestamptz then
        raise exception using errcode='55000',message='comparison story identity conflict'; end if;
    else
      insert into ops.bakeoff_results(day,actor,account_id,story_key,raw_id,taken_at,has_thumbnail,has_mentions,has_link,apify_run_id)
      values(observation.day,observation.actor,observation.account_id,v->>'story_key',v->>'raw_id',
        (v->>'taken_at')::timestamptz,(v->>'has_thumbnail')::boolean,(v->>'has_mentions')::boolean,(v->>'has_link')::boolean,observation.apify_run_id);
      inserted:=inserted+1;
    end if;
  end loop;
  return inserted;
end $$;

create function private.m06_assert_claim(p_run_id uuid,p_account_id uuid)
returns app.competitor_accounts language plpgsql security definer set search_path='' as $$
declare a app.competitor_accounts%rowtype;
begin
  select x.* into a from app.competitor_accounts x join ops.collector_accounts c on c.account_id=x.id
    where c.run_id=p_run_id and x.id=p_account_id for update of x;
  if not found or a.platform<>'instagram_stories' or a.last_run_id is distinct from p_run_id
    or a.locked_until is null or a.locked_until<=now() then
    raise exception using errcode='42501',message='current owned story account claim required'; end if;
  return a;
end $$;

create function private.m06_finalize(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r ops.scrape_runs%rowtype; c record; g jsonb; j record; failures int:=0; comparisons_failed boolean; mode text; seen int; state text;
begin
  select * into r from ops.scrape_runs where id=p_run_id for update;
  if r.status<>'running' then return to_jsonb(r); end if;
  if not(select registration_closed from ops.collector_runs where run_id=p_run_id)
    or exists(select 1 from ops.collector_launches l join ops.m06_story_jobs m using(launch_id)
      where l.run_id=p_run_id and (l.apify_run_id is null or not m.settled)) then return null; end if;
  select collection_mode into mode from ops.m06_story_runs where run_id=p_run_id;
  for c in select account_id,context from ops.collector_accounts where run_id=p_run_id order by account_id loop
    if exists(select 1 from ops.scrape_run_accounts where run_id=p_run_id and account_id=c.account_id) then continue; end if;
    perform private.m06_assert_claim(p_run_id,c.account_id);
    if mode='bakeoff' then
      select case when bool_and(o.status in ('success','no_stories')) then 'success' else 'failed' end,
        coalesce(sum(cardinality(o.story_keys)),0)::int into state,seen
        from ops.bakeoff_observations o join ops.apify_runs x using(apify_run_id)
        where x.run_id=p_run_id and o.account_id=c.account_id;
      state:=coalesce(state,'failed');
      insert into ops.scrape_run_accounts(run_id,account_id,status,items_seen,items_new,error)
        values(p_run_id,c.account_id,state,seen,0,case when state='failed' then 'story_comparison_incomplete' end);
      update app.competitor_accounts set locked_until=null,last_run_id=(c.context->>'prior_last_run_id')::uuid
        where id=c.account_id and last_run_id=p_run_id;
      continue;
    end if;
    select m.result into j from ops.collector_launches l join ops.m06_story_jobs m using(launch_id)
      where l.run_id=p_run_id and c.account_id=any(l.account_ids) and m.collection_mode='ingest';
    g:=null;
    if found then select value into g from jsonb_array_elements(j.result->'groups') where value->>'account_id'=c.account_id::text; end if;
    if g is null then g:=jsonb_build_object('status','failed','items_seen',0,'items_new',0,'error','missing_primary_registration'); end if;
    perform ops.report_account_result(p_run_id,c.account_id,g->>'status',(g->>'items_seen')::int,(g->>'items_new')::int,
      g->>'error',false,null);
  end loop;
  select count(*) filter(where status='failed') into failures from ops.scrape_run_accounts where run_id=p_run_id;
  select exists(select 1 from ops.bakeoff_observations o join ops.apify_runs a using(apify_run_id)
    where a.run_id=p_run_id and o.status in ('failed','excluded')) into comparisons_failed;
  return ops.finish_run(p_run_id,case when failures=0 and not comparisons_failed then 'success'
    when failures=(select count(*) from ops.collector_accounts where run_id=p_run_id) and failures>0 then 'failed' else 'partial' end,null);
end $$;

create function ops.story_bakeoff_snapshot(p_from_day date,p_to_day date,p_account_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_from_day is null or p_to_day is null or p_to_day<p_from_day or p_to_day-p_from_day>31
    or p_account_ids is null or cardinality(p_account_ids) not between 1 and 100
    or array_position(p_account_ids,null) is not null
    or cardinality(p_account_ids)<>(select count(distinct a) from unnest(p_account_ids) a)
    or exists(select 1 from unnest(p_account_ids) a where not exists(select 1 from app.competitor_accounts c where c.id=a and c.platform='instagram_stories')) then
    raise exception using errcode='22023',message='bounded story comparison window required'; end if;
  return jsonb_build_object('from_day',p_from_day,'to_day',p_to_day,'accounts',to_jsonb(p_account_ids),
    'actors',jsonb_build_array('data-slayer/instagram-stories-scraper','igview-owner/instagram-story-viewer','louisdeconinck/instagram-story-details-scraper'),
    'observations',(select coalesce(jsonb_agg(jsonb_build_object('day',o.day,'actor',o.actor,'account_id',o.account_id,
      'apify_run_id',o.apify_run_id,'status',o.status,'login_prompt',o.login_prompt,'story_keys',o.story_keys)
      order by o.day,o.actor,o.account_id),'[]') from ops.bakeoff_observations o
      where o.day between p_from_day and p_to_day and o.account_id=any(p_account_ids)),
    'rows',(select coalesce(jsonb_agg(to_jsonb(b) - 'id' - 'created_at' order by b.actor,b.account_id,b.story_key),'[]')
      from ops.bakeoff_results b where b.account_id=any(p_account_ids) and exists(select 1 from ops.bakeoff_observations o
        where o.day between p_from_day and p_to_day and o.actor=b.actor and o.account_id=b.account_id and b.story_key=any(o.story_keys))),
    'costs',(select coalesce(jsonb_agg(jsonb_build_object('actor',a.actor_id,'apify_run_id',a.apify_run_id,'usd',a.usage_usd) order by a.apify_run_id),'[]')
      from ops.apify_runs a where exists(select 1 from ops.bakeoff_observations o where o.apify_run_id=a.apify_run_id
        and o.day between p_from_day and p_to_day and o.account_id=any(p_account_ids))));
end $$;

revoke all on function private.m06_assert_claim(uuid,uuid),private.m06_finalize(uuid) from public,anon,authenticated,api_agent,n8n_writer;
revoke all on function ops.save_bakeoff_rows(jsonb),ops.story_bakeoff_snapshot(date,date,uuid[]) from public,anon,authenticated,api_agent;
grant execute on function ops.save_bakeoff_rows(jsonb),ops.story_bakeoff_snapshot(date,date,uuid[]) to n8n_writer;

create function ops.m06_execute(p_request_id uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare op text:=replace(p_operation,'m06.',''); digest text; previous ops.collector_requests%rowtype;
  r ops.scrape_runs%rowtype; a app.competitor_accounts%rowtype; run_id uuid; account_id uuid; ids uuid[];
  result jsonb; contexts jsonb; g jsonb; item jsonb; job ops.m06_story_jobs%rowtype; launch ops.collector_launches%rowtype;
  counts jsonb; groups jsonb:='[]'; rows jsonb; row_item jsonb; entries jsonb:='[]'; n int; seen int; inserted int; usage numeric;
  keys text[]; required text[]; names text[]; expected_names text[]; observed timestamptz; observation_status text;
  observation_keys text[]; observation_error text; login boolean; alloc_starts numeric; alloc_actor numeric; alloc_total numeric;
begin
  if p_request_id is null or p_operation is null or left(p_operation,4)<>'m06.'
    or p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>4194304
    or op not in ('start','claim','launch','register','close_registration','lookup','classify','settle','status') then
    raise exception using errcode='22023',message='invalid M06 operation'; end if;
  keys:=case op
    when 'start' then array['workflow','platform','mode','env','execution_id','collection_mode']
    when 'claim' then array['run_id','platform','mode','limit','account_ids']
    when 'launch' then array['run_id','launch_id','actor_id','pass','account_ids','purpose','results_limit','actor_input',
      'approval_id','max_actor_starts','max_actor_usd','max_total_usd','build_id','collection_mode','memory_mbytes','timeout_secs']
    when 'register' then array['run_id','launch_id','apify_run_id','actor_id','pass','account_ids','purpose']
    when 'close_registration' then array['run_id']
    when 'lookup' then array['apify_run_id'] when 'classify' then array['apify_run_id']
    when 'status' then array['request_id']
    when 'settle' then array['apify_run_id','status','dataset_id','usage_usd','groups','observed_at'] end;
  if exists(select 1 from jsonb_object_keys(p_args) x where x<>all(keys)) or not(p_args ?& keys) then
    raise exception using errcode='22023',message='unsupported or missing M06 argument'; end if;
  if op='status' then
    select * into previous from ops.collector_requests q where q.request_id=(p_args->>'request_id')::uuid and q.operation like 'm06.%';
    result:=case when found then jsonb_build_object('found',true,'operation',previous.operation,'args_sha256',previous.args_sha256,
      'result',case when previous.operation='m06.launch' then previous.result||jsonb_build_object('permit',false,'apify_run_id',
        (select l.apify_run_id from ops.collector_launches l where l.launch_id=(previous.result->>'launch_id')::uuid)) else previous.result end)
      else jsonb_build_object('found',false) end;
    return jsonb_build_object('replayed',false,'result',result);
  end if;
  if op in ('lookup','classify') then
    select l.* into launch from ops.collector_launches l join ops.m06_story_jobs m using(launch_id) where l.apify_run_id=p_args->>'apify_run_id';
    if op='classify' then return jsonb_build_object('replayed',false,'result',jsonb_build_object('scope',case when found then 'm06' else 'unknown' end)); end if;
    if not found then raise exception using errcode='42501',message='unknown story actor run'; end if;
    select * into job from ops.m06_story_jobs m where m.launch_id=launch.launch_id;
    select jsonb_build_object('apify_run_id',launch.apify_run_id,'actor_id',launch.actor_id,'account_ids',to_jsonb(launch.account_ids),
      'accounts',(select jsonb_agg(c.context order by c.account_id) from ops.collector_accounts c where c.run_id=launch.run_id and c.account_id=any(launch.account_ids)),
      'actor_input',job.actor_input,'results_limit',launch.results_limit,'run_id',launch.run_id,'launch_id',launch.launch_id,
      'settled',job.settled,'processing_result',job.result,'build_id',job.build_id,'memory_mbytes',job.memory_mbytes,'timeout_secs',job.timeout_secs,'max_actor_usd',launch.max_actor_usd,
      'collection_mode',job.collection_mode,'approval_id',launch.approval_id,'launch_created_at',launch.created_at) into result;
    return jsonb_build_object('replayed',false,'result',result);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('m04-request:'||p_request_id::text,0));
  digest:=encode(extensions.digest(p_args::text,'sha256'),'hex');
  select * into previous from ops.collector_requests q where q.request_id=p_request_id;
  if found then
    if previous.operation<>'m06.'||op or previous.args_sha256<>digest then raise exception using errcode='55000',message='M06 request identity conflict'; end if;
    result:=previous.result;
    if op='launch' then result:=result||jsonb_build_object('permit',false,'apify_run_id',
      (select apify_run_id from ops.collector_launches where launch_id=(result->>'launch_id')::uuid)); end if;
    return jsonb_build_object('replayed',true,'result',result);
  end if;
  if op='start' then
    if p_args->>'workflow' is distinct from 'WF-12' or p_args->>'platform' is distinct from 'instagram_stories'
      or p_args->>'mode' is distinct from 'daily' or p_args->>'env' is distinct from 'dev'
      or coalesce(p_args->>'execution_id','')!~'^[A-Za-z0-9_-]{1,200}$'
      or p_args->>'collection_mode' not in ('ingest','bakeoff') then
      raise exception using errcode='42501',message='exact dev story workflow required'; end if;
    run_id:=ops.start_run('WF-12','instagram_stories','daily','dev',p_args->>'execution_id');
    insert into ops.collector_runs(run_id) values(run_id);
    insert into ops.m06_story_runs(run_id,collection_mode) values(run_id,p_args->>'collection_mode');
    result:=jsonb_build_object('run_id',run_id);
  else
    if op='settle' then select l.run_id into run_id from ops.collector_launches l join ops.m06_story_jobs m using(launch_id)
      where l.apify_run_id=p_args->>'apify_run_id'; else run_id:=(p_args->>'run_id')::uuid; end if;
    select x.* into r from ops.scrape_runs x join ops.collector_runs c on c.run_id=x.id where x.id=run_id for update of x;
    if not found or r.env<>'dev' or r.workflow<>'WF-12' or r.platform<>'instagram_stories' or r.mode<>'daily' then
      raise exception using errcode='42501',message='owned dev story run required'; end if;
    if op='settle' then
      select * into launch from ops.collector_launches l where l.apify_run_id=p_args->>'apify_run_id';
      select * into job from ops.m06_story_jobs m where m.launch_id=launch.launch_id for update;
      if job.settled then
        if job.result->>'settlement_sha256'<>digest then raise exception using errcode='55000',message='story settlement conflict'; end if;
        result:=job.result||jsonb_build_object('updated',false);
      end if;
    end if;
    if result is null and r.status<>'running' then raise exception using errcode='55000',message='story run already terminal'; end if;
    if result is null and op='claim' then
      if p_args->>'platform' is distinct from 'instagram_stories' or p_args->>'mode' is distinct from 'daily'
        or jsonb_typeof(p_args->'limit') is distinct from 'number' or (p_args->>'limit')::int not between 1 and 100
        or jsonb_typeof(p_args->'account_ids') is distinct from 'array' then
        raise exception using errcode='22023',message='bounded explicit story selection required'; end if;
      select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_args->'account_ids') x;
      if ids is null or cardinality(ids) not between 1 and (p_args->>'limit')::int
        or cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
        or exists(select 1 from ops.collector_accounts c where c.run_id=r.id) then
        raise exception using errcode='22023',message='unique first story selection required'; end if;
      perform c.id from app.competitors c where c.id in(select x.competitor_id from app.competitor_accounts x where x.id=any(ids)) order by c.id for update;
      perform x.id from app.competitor_accounts x where x.id=any(ids) order by x.id for update;
      select count(*) into n from app.competitor_accounts x join app.competitors c on c.id=x.competitor_id
        where x.id=any(ids) and x.platform='instagram_stories' and x.status in ('active','failing') and c.status='active'
          and x.backfill_status='not_applicable'
          and (x.next_due_at<=now() or (select collection_mode from ops.m06_story_runs where m06_story_runs.run_id=r.id)='bakeoff')
          and (x.locked_until is null or x.locked_until<=now())
          and coalesce(x.handle,'')~'^[A-Za-z0-9_.]{1,30}$';
      if n<>cardinality(ids) then raise exception using errcode='55000',message='story selection not fully eligible'; end if;
      select jsonb_agg(jsonb_build_object('account_id',x.id,'competitor_id',x.competitor_id,'platform',x.platform,
        'handle',x.handle,'url',x.url,'external_id',x.external_id,'uploads_playlist_id',x.uploads_playlist_id,
        'watermark_published_at',x.last_item_published_at,'watermark_external_id',x.last_external_id,
        'backfill_from',x.backfill_from,'backfill_cursor',x.backfill_cursor,'prior_last_run_id',x.last_run_id) order by x.id) into contexts
        from app.competitor_accounts x where x.id=any(ids);
      update app.competitor_accounts set last_run_id=r.id,locked_until=now()+interval '2 hours',updated_at=now() where id=any(ids);
      insert into ops.collector_accounts(run_id,account_id,context) select r.id,(x->>'account_id')::uuid,x from jsonb_array_elements(contexts) x;
      select jsonb_agg(x-'prior_last_run_id' order by x->>'account_id') into result from jsonb_array_elements(contexts) x;
      insert into ops.collector_passes(run_id,account_id,pass) select r.id,unnest(ids),'primary';
    elsif result is null and op in ('launch','register') then
      if jsonb_typeof(p_args->'account_ids') is distinct from 'array' then raise exception using errcode='22023',message='story account IDs required'; end if;
      select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_args->'account_ids') x;
      if ids is null or cardinality(ids) not between 1 and 100 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
        or p_args->>'purpose' is distinct from 'daily' or p_args->>'pass' is distinct from 'primary'
        or p_args->>'actor_id' not in ('data-slayer/instagram-stories-scraper','igview-owner/instagram-story-viewer','louisdeconinck/instagram-story-details-scraper')
        or (p_args->>'actor_id'='igview-owner/instagram-story-viewer' and cardinality(ids)>50) then
        raise exception using errcode='42501',message='approved owned story actor required'; end if;
      foreach account_id in array ids loop a:=private.m06_assert_claim(r.id,account_id); end loop;
      select * into launch from ops.collector_launches l where l.launch_id=(p_args->>'launch_id')::uuid;
      if op='launch' then
        if found then
          select * into job from ops.m06_story_jobs m where m.launch_id=launch.launch_id;
          if launch.run_id<>r.id or launch.actor_id<>p_args->>'actor_id' or launch.account_ids<>ids
            or job.actor_input is distinct from p_args->'actor_input' or job.build_id is distinct from p_args->>'build_id'
            or job.memory_mbytes is distinct from (p_args->>'memory_mbytes')::int or job.timeout_secs is distinct from (p_args->>'timeout_secs')::int
            or job.collection_mode is distinct from p_args->>'collection_mode'
            or launch.results_limit is distinct from (p_args->>'results_limit')::int
            or launch.approval_id is distinct from (p_args->>'approval_id')::uuid
            or launch.max_actor_starts is distinct from (p_args->>'max_actor_starts')::int
            or launch.max_actor_usd is distinct from (p_args->>'max_actor_usd')::numeric
            or launch.max_total_usd is distinct from (p_args->>'max_total_usd')::numeric then
            raise exception using errcode='55000',message='story launch identity conflict'; end if;
          result:=jsonb_build_object('permit',false,'replayed',true,'launch_id',launch.launch_id,'apify_run_id',launch.apify_run_id);
        else
          if jsonb_typeof(p_args->'max_actor_starts') is distinct from 'number'
            or jsonb_typeof(p_args->'max_actor_usd') is distinct from 'number'
            or jsonb_typeof(p_args->'max_total_usd') is distinct from 'number'
            or jsonb_typeof(p_args->'results_limit') is distinct from 'number'
            or jsonb_typeof(p_args->'memory_mbytes') is distinct from 'number'
            or jsonb_typeof(p_args->'timeout_secs') is distinct from 'number'
            or coalesce(p_args->>'build_id','')!~'^[A-Za-z0-9_-]{1,128}$'
            or p_args->>'collection_mode' not in ('ingest','bakeoff')
            or p_args->>'collection_mode' is distinct from (select collection_mode from ops.m06_story_runs where m06_story_runs.run_id=r.id)
            or (p_args->>'collection_mode'='ingest' and p_args->>'actor_id'<>'data-slayer/instagram-stories-scraper')
            or jsonb_typeof(p_args->'actor_input') is distinct from 'object'
            or not(p_args->'actor_input' ? 'usernames')
            or exists(select 1 from jsonb_object_keys(p_args->'actor_input') k where k<>'usernames')
            or jsonb_typeof(p_args->'actor_input'->'usernames') is distinct from 'array'
            or (select registration_closed from ops.collector_runs where collector_runs.run_id=r.id) then
            raise exception using errcode='22023',message='bounded registered story launch required'; end if;
          alloc_starts:=(p_args->>'max_actor_starts')::numeric;alloc_actor:=(p_args->>'max_actor_usd')::numeric;alloc_total:=(p_args->>'max_total_usd')::numeric;
          if alloc_starts not between 1 and 2147483647 or alloc_starts<>trunc(alloc_starts)
            or alloc_actor not between 0.000001 and 999999.999999 or alloc_actor<>trunc(alloc_actor,6)
            or alloc_total not between 0.000001 and 999999.999999 or alloc_total<>trunc(alloc_total,6)
            or alloc_actor>alloc_total or (p_args->>'results_limit')::numeric not between 1 and 1000
            or (p_args->>'results_limit')::numeric*cardinality(ids)>1000
            or (p_args->>'memory_mbytes')::numeric not between 128 and 32768
            or (p_args->>'memory_mbytes')::numeric<>trunc((p_args->>'memory_mbytes')::numeric)
            or (((p_args->>'memory_mbytes')::int & ((p_args->>'memory_mbytes')::int-1))<>0)
            or (p_args->>'timeout_secs')::numeric not between 30 and 600
            or (p_args->>'timeout_secs')::numeric<>trunc((p_args->>'timeout_secs')::numeric)
            or (p_args->>'results_limit')::numeric<>trunc((p_args->>'results_limit')::numeric) then
            raise exception using errcode='22023',message='finite story execution settings required'; end if;
          select array_agg(lower(x) order by lower(x)) into names from jsonb_array_elements_text(p_args->'actor_input'->'usernames') x;
          select array_agg(lower(c.context->>'handle') order by lower(c.context->>'handle')) into expected_names
            from ops.collector_accounts c where c.run_id=r.id and c.account_id=any(ids);
          if names is distinct from expected_names or cardinality(names)<>cardinality(ids)
            or exists(select 1 from ops.collector_launches l join ops.m06_story_jobs m using(launch_id)
              where l.run_id=r.id and l.account_ids&&ids and (l.actor_id=p_args->>'actor_id'
                or (m.collection_mode='ingest' and p_args->>'collection_mode'='ingest'))) then
            raise exception using errcode='42501',message='exact story identities and nonoverlapping actor pass required'; end if;
          perform pg_advisory_xact_lock(hashtextextended('m04-approval:'||(p_args->>'approval_id'),0));
          if exists(select 1 from ops.collector_launches l where l.approval_id=(p_args->>'approval_id')::uuid and
            (l.max_actor_starts<>alloc_starts::int or l.max_actor_usd<>alloc_actor or l.max_total_usd<>alloc_total))
            or (select count(*) from ops.collector_launches l where l.approval_id=(p_args->>'approval_id')::uuid)>=alloc_starts
            or (select coalesce(sum(greatest(l.max_actor_usd,coalesce(x.usage_usd,0))),0) from ops.collector_launches l
              left join ops.apify_runs x on x.apify_run_id=l.apify_run_id where l.approval_id=(p_args->>'approval_id')::uuid)+alloc_actor>alloc_total then
            raise exception using errcode='55000',message='finite story allocation consumed or changed'; end if;
          insert into ops.collector_launches(launch_id,run_id,actor_id,pass,account_ids,purpose,results_limit,approval_id,max_actor_starts,max_actor_usd,max_total_usd)
            values((p_args->>'launch_id')::uuid,r.id,p_args->>'actor_id','primary',ids,'daily',(p_args->>'results_limit')::int,
              (p_args->>'approval_id')::uuid,alloc_starts::int,alloc_actor,alloc_total);
          insert into ops.m06_story_jobs(launch_id,build_id,memory_mbytes,timeout_secs,actor_input,collection_mode)
            values((p_args->>'launch_id')::uuid,p_args->>'build_id',(p_args->>'memory_mbytes')::int,(p_args->>'timeout_secs')::int,p_args->'actor_input',p_args->>'collection_mode');
          result:=jsonb_build_object('permit',true,'replayed',false,'launch_id',p_args->>'launch_id');
        end if;
      else
        if not found or launch.run_id<>r.id or launch.actor_id<>p_args->>'actor_id' or launch.account_ids<>ids
          or coalesce(p_args->>'apify_run_id','')!~'^[A-Za-z0-9_-]{1,128}$' then
          raise exception using errcode='42501',message='owned story launch intent required'; end if;
        if launch.apify_run_id is not null and launch.apify_run_id<>p_args->>'apify_run_id'
          or exists(select 1 from ops.apify_runs x where x.apify_run_id=p_args->>'apify_run_id' and
            (x.actor_id<>launch.actor_id or x.run_id<>r.id or x.account_ids<>ids or x.purpose<>'daily')) then
          raise exception using errcode='55000',message='story actor registration conflict'; end if;
        insert into ops.apify_runs(apify_run_id,actor_id,run_id,account_ids,purpose)
          values(p_args->>'apify_run_id',launch.actor_id,r.id,ids,'daily') on conflict(apify_run_id) do nothing;
        update ops.collector_launches set apify_run_id=p_args->>'apify_run_id' where launch_id=launch.launch_id;
        result:=jsonb_build_object('registered',true,'apify_run_id',p_args->>'apify_run_id','run_id',r.id);
      end if;
    elsif result is null and op='close_registration' then
      if exists(select 1 from ops.collector_launches l where l.run_id=r.id and l.apify_run_id is null) then
        raise exception using errcode='55000',message='story launch registration unresolved'; end if;
      update ops.collector_runs set registration_closed=true where collector_runs.run_id=r.id;
      counts:=private.m06_finalize(r.id);
      result:=jsonb_build_object('state',case when counts is null then 'awaiting_callbacks' else 'completed' end,
        'registration_closed',true,'finished_now',counts is not null,'summary',counts);
    elsif result is null and op='settle' then
      if p_args->>'status' not in ('SUCCEEDED','FAILED','TIMED_OUT','ABORTED')
        or jsonb_typeof(p_args->'usage_usd') is distinct from 'number'
        or jsonb_typeof(p_args->'groups') is distinct from 'array'
        or jsonb_array_length(p_args->'groups')<>cardinality(launch.account_ids)
        or (p_args->>'status'='SUCCEEDED' and coalesce(p_args->>'dataset_id','')!~'^[A-Za-z0-9_-]{1,128}$') then
        raise exception using errcode='22023',message='terminal story provider evidence required'; end if;
      usage:=(p_args->>'usage_usd')::numeric;observed:=(p_args->>'observed_at')::timestamptz;
      if usage<0 or usage<>trunc(usage,6) or usage>999999.999999 or observed is null
        or observed<launch.created_at-interval '5 minutes' or observed>clock_timestamp()+interval '5 minutes' then
        raise exception using errcode='22023',message='finite measured story cost and observation time required'; end if;
      select array_agg((x->>'account_id')::uuid order by (x->>'account_id')::uuid) into ids from jsonb_array_elements(p_args->'groups') x;
      if ids is distinct from launch.account_ids then raise exception using errcode='42501',message='exact registered story groups required'; end if;
      foreach account_id in array launch.account_ids loop a:=private.m06_assert_claim(r.id,account_id); end loop;
      for g in select value from jsonb_array_elements(p_args->'groups') order by value->>'account_id' loop
        account_id:=(g->>'account_id')::uuid;a:=private.m06_assert_claim(r.id,account_id);
        if jsonb_typeof(g)<>'object' or not(g ?& array['account_id','status','error','items','bakeoff_rows','observation','source_evidence'])
          or exists(select 1 from jsonb_object_keys(g) k where k<>all(array['account_id','status','error','items','bakeoff_rows','observation','source_evidence']))
          or g->>'status' not in ('success','failed') or g->>'observation' not in ('stories','no_stories','error')
          or jsonb_typeof(g->'source_evidence') is distinct from 'boolean'
          or jsonb_typeof(g->'items') is distinct from 'array' or jsonb_typeof(g->'bakeoff_rows') is distinct from 'array'
          or jsonb_array_length(g->'items')>launch.results_limit or jsonb_array_length(g->'items')<>jsonb_array_length(g->'bakeoff_rows')
          or (g->>'status'='failed' and (g->>'observation'<>'error' or jsonb_array_length(g->'items')<>0 or coalesce(g->>'error','')!~'^[a-z][a-z0-9_]{0,79}$'))
          or (g->>'status'='success' and (g->'error'<>'null'::jsonb or not(g->>'source_evidence')::boolean or g->>'observation'='error'
            or (g->>'observation'='no_stories')<>(jsonb_array_length(g->'items')=0)))
          or (p_args->>'status'<>'SUCCEEDED' and g->>'status'<>'failed') then
          raise exception using errcode='22023',message='story errors are not no-stories evidence'; end if;
        rows:='[]';observation_keys:='{}';
        for row_item,item in select b.value,i.value from jsonb_array_elements(g->'bakeoff_rows') with ordinality b(value,position)
          join jsonb_array_elements(g->'items') with ordinality i(value,position) using(position) loop
          if row_item->>'actor' is distinct from launch.actor_id or row_item->>'account_id' is distinct from a.id::text then
            raise exception using errcode='42501',message='comparison row owner mismatch'; end if;
          if item->>'platform' is distinct from 'instagram_stories' or item->>'actor' is distinct from launch.actor_id
            or item->>'item_type' is distinct from 'story' or coalesce(item->>'external_id','')=''
            or (row_item->>'taken_at')::timestamptz is distinct from (item->>'published_at')::timestamptz
            or not(coalesce(row_item->>'raw_id','')=item->>'external_id'
              or (row_item->>'raw_id' ~ '^[1-9][0-9]{0,29}_[1-9][0-9]{0,29}$'
                and split_part(row_item->>'raw_id','_',1)=item->>'external_id'))
            or not(coalesce(row_item->>'story_key','')=a.id::text||':'||floor(extract(epoch from (item->>'published_at')::timestamptz)/60)::bigint::text
              or (item->>'external_id' ~ '^[1-9][0-9]{0,29}$' and row_item->>'story_key'=item->>'external_id')) then
            raise exception using errcode='42501',message='comparison and normalized story identity mismatch'; end if;
          observation_keys:=array_append(observation_keys,row_item->>'story_key');
          rows:=rows||jsonb_build_array(row_item||jsonb_build_object('day',(observed at time zone 'Africa/Cairo')::date,'apify_run_id',launch.apify_run_id));
        end loop;
        if cardinality(observation_keys)<>(select count(distinct x) from unnest(observation_keys) x) or array_position(observation_keys,null) is not null then
          raise exception using errcode='22023',message='unique comparison story identities required'; end if;
        observation_error:=g->>'error';login:=coalesce(observation_error ~ '(login|cookie|checkpoint|challenge)',false);
        observation_status:=case when login then 'excluded' when g->>'status'='failed' then 'failed'
          when g->>'observation'='no_stories' then 'no_stories' else 'success' end;
        insert into ops.bakeoff_observations(apify_run_id,account_id,day,actor,status,login_prompt,error_code,story_keys,observed_at)
          values(launch.apify_run_id,a.id,(observed at time zone 'Africa/Cairo')::date,launch.actor_id,observation_status,login,observation_error,observation_keys,observed);
        perform ops.save_bakeoff_rows(rows);
        inserted:=0;seen:=jsonb_array_length(g->'items');
        if job.collection_mode='ingest' and g->>'status'='success' then
          if exists(select 1 from jsonb_array_elements(g->'items') x where x->>'platform' is distinct from 'instagram_stories'
            or x->>'actor' is distinct from launch.actor_id or x->>'item_type' is distinct from 'story') then
            raise exception using errcode='42501',message='owned story-only ingestion required'; end if;
          counts:=ingest.upsert_raw_items(r.id,a.id,g->'items');inserted:=(counts->>'inserted')::int;
        end if;
        groups:=groups||jsonb_build_array(jsonb_build_object('account_id',a.id,'status',g->>'status','items_seen',seen,'items_new',inserted,'error',g->>'error'));
        entries:=entries||jsonb_build_array(jsonb_build_object('provider','apify','category','scrape','quantity',1,'unit','run','run_id',r.id,
          'competitor_id',a.competitor_id,'platform','instagram_stories',
          'cost_usd',case when a.id=launch.account_ids[cardinality(launch.account_ids)] then usage-(trunc(usage/cardinality(launch.account_ids),6)*(cardinality(launch.account_ids)-1)) else trunc(usage/cardinality(launch.account_ids),6) end,
          'meta',jsonb_build_object('actor',launch.actor_id,'account_id',a.id,'apify_run_id',launch.apify_run_id,'bakeoff',true,
            'collection_mode',job.collection_mode,'cost_key','apify:'||launch.apify_run_id||':'||a.id::text)));
      end loop;
      perform ops.log_cost(entries);
      update ops.apify_runs set status=p_args->>'status',dataset_id=p_args->>'dataset_id',usage_usd=usage,
        processed_at=clock_timestamp(),finished_at=clock_timestamp() where apify_run_id=launch.apify_run_id;
      result:=jsonb_build_object('updated',true,'groups',groups,'settlement_sha256',digest);
      update ops.m06_story_jobs set settled=true,result=result where launch_id=job.launch_id;
      counts:=private.m06_finalize(r.id);result:=result||jsonb_build_object('finished',counts);
    end if;
  end if;
  if result is null then raise exception using errcode='22023',message='M06 operation not implemented'; end if;
  insert into ops.collector_requests(request_id,operation,args_sha256,result) values(p_request_id,'m06.'||op,digest,result);
  return jsonb_build_object('replayed',false,'result',result);
end $$;
revoke all on function ops.m06_execute(uuid,text,jsonb) from public,anon,authenticated,api_agent;
grant execute on function ops.m06_execute(uuid,text,jsonb) to n8n_writer;

-- Separate expiring-story lane. No existing message is moved, drained or
-- reordered. The existing media RPCs and default profile remain unchanged.
select pgmq.create('media_stories');
-- Forward migrations can be executed by a different local administrative
-- principal. The existing ingest definer still runs as its original owner;
-- keep the new RLS queue owned by that same trusted schema owner, not writer.
do $$declare owner_name text; begin
  select pg_get_userbyid(proowner) into owner_name from pg_proc where oid='ingest.upsert_raw_items(uuid,uuid,jsonb)'::regprocedure;
  execute format('alter table pgmq.q_media_stories owner to %I',owner_name);
  execute format('alter table pgmq.a_media_stories owner to %I',owner_name);
end $$;
alter table pgmq.q_media_stories enable row level security;
alter table pgmq.a_media_stories enable row level security;
revoke all on pgmq.q_media_stories,pgmq.a_media_stories from public,anon,authenticated,n8n_writer,api_agent;
create unique index media_execution_lane_identity on ops.audit_log(entity_id)
  where action in ('media_batch_claim','story_media_batch_claim') and entity_type in ('media_batch','story_media_batch');

create or replace function ingest.upsert_raw_items(p_run_id uuid, p_account_id uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run ops.scrape_runs%rowtype; v_account app.competitor_accounts%rowtype; v_existing app.items%rowtype;
  v_comp uuid; v_collection app.platform; v_item jsonb; v_key text; v_value jsonb; v_source record;
  v_raw_id bigint; v_item_id uuid; v_duplicate uuid; v_hash text; v_normalized jsonb; v_media text;
  v_new uuid[]:='{}'; v_duplicates int:=0; v_metrics int:=0; v_created int:=0;
  v_pub timestamptz; v_max_pub timestamptz; v_max_ext text;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' then
    raise exception using errcode='22023', message='items must be a JSON array';
  end if;
  if jsonb_array_length(p_items)>1000 then raise exception using errcode='22023', message='item batch exceeds 1000'; end if;
  select r.* into v_run from ops.scrape_runs r where r.id=p_run_id for share;
  if not found then raise exception using errcode='22023', message='unknown run'; end if;
  -- Serialize canonical selection across this competitor's accounts, before
  -- locking its account row. Subsequent SQL statements see earlier loop inserts.
  select c.id into v_comp from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
    where a.id=p_account_id for update of c;
  if not found then raise exception using errcode='22023', message='unknown account'; end if;
  select a.* into v_account from app.competitor_accounts a where a.id=p_account_id for update;
  if v_account.competitor_id is distinct from v_comp then
    raise exception using errcode='55000', message='account ownership changed; retry claim';
  end if;
  v_collection:=case when v_account.platform='website' then 'website_work_page'::app.platform else v_account.platform end;
  if v_run.platform is distinct from v_collection then
    raise exception using errcode='22023', message='run platform does not own this collection';
  end if;
  if v_run.status<>'running' or v_account.last_run_id is distinct from p_run_id
     or v_account.locked_until is null or v_account.locked_until<=now() then
    raise exception using errcode='55000', message='account claim is absent, expired or owned by another run';
  end if;

  -- Validate every boundary before writes; errors omit input values and payloads.
  for v_item in select e.value from jsonb_array_elements(p_items) e loop
    if jsonb_typeof(v_item)<>'object' or not (v_item ?& array['platform','external_id','actor','item_type','url','published_at','payload']) then
      raise exception using errcode='22023', message='normalized item is missing required fields';
    end if;
    for v_key in select jsonb_object_keys(v_item) loop
      if v_key<>all(array['platform','external_id','actor','item_type','url','published_at','payload','title','caption',
        'hashtags','mentions','tagged_accounts','duration_seconds','thumbnail_url','metrics','credits_text','media_urls']) then
        raise exception using errcode='22023', message='normalized item has an unsupported field';
      end if;
    end loop;
    foreach v_key in array array['platform','external_id','actor','item_type','url'] loop
      if jsonb_typeof(v_item->v_key)<>'string' or nullif(btrim(v_item->>v_key),'') is null then
        raise exception using errcode='22023', message='normalized item has an invalid required string';
      end if;
    end loop;
    if v_item->>'platform'<>v_collection::text or v_item->>'platform' not in
      ('vimeo','instagram','instagram_stories','website_work_page','linkedin','youtube','news')
      or v_item->>'item_type' not in
      ('video','post','reel','carousel','story','project_page','linkedin_post','news_article','award_entry')
      or (v_item->>'url')!~*'^https?://[^[:space:]]+$' or jsonb_typeof(v_item->'payload')<>'object' then
      raise exception using errcode='22023', message='normalized collection, URL, type or payload is invalid';
    end if;
    foreach v_key in array array['title','caption','thumbnail_url','credits_text'] loop
      if v_item ? v_key and jsonb_typeof(v_item->v_key) not in ('string','null') then
        raise exception using errcode='22023', message='normalized text field is invalid';
      end if;
    end loop;
    foreach v_key in array array['hashtags','mentions','tagged_accounts','media_urls'] loop
      if v_item ? v_key then
        if jsonb_typeof(v_item->v_key)<>'array' then raise exception using errcode='22023', message='normalized list field is invalid'; end if;
        if exists (select 1 from jsonb_array_elements(v_item->v_key) e where jsonb_typeof(e.value)<>'string') then
          raise exception using errcode='22023', message='normalized list entries must be strings';
        end if;
      end if;
    end loop;
    if v_item ? 'metrics' then
      if jsonb_typeof(v_item->'metrics')<>'object' then raise exception using errcode='22023', message='metrics must be an object'; end if;
      for v_key,v_value in select m.key,m.value from jsonb_each(v_item->'metrics') m loop
        if v_key<>all(array['views','plays','likes','comments','shares'])
          or (jsonb_typeof(v_value)<>'null' and (jsonb_typeof(v_value)<>'number' or v_value::text!~'^[0-9]+$')) then
          raise exception using errcode='22023', message='metric keys and non-negative integer values must match the contract';
        end if;
      end loop;
    end if;
    if v_item ? 'duration_seconds' and jsonb_typeof(v_item->'duration_seconds')<>'null'
       and (jsonb_typeof(v_item->'duration_seconds')<>'number' or (v_item->>'duration_seconds')!~'^[0-9]+$') then
      raise exception using errcode='22023', message='duration must be a non-negative integer or null';
    end if;
    if jsonb_typeof(v_item->'published_at')<>'null' then
      if jsonb_typeof(v_item->'published_at')<>'string' or (v_item->>'published_at')!~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
        raise exception using errcode='22023', message='published timestamp must be ISO 8601 or null';
      end if;
      begin
        v_pub:=(v_item->>'published_at')::timestamptz;
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception using errcode='22023', message='published timestamp is invalid';
      end;
    end if;
  end loop;

  -- Last occurrence of each source key wins; lexical key order also keeps
  -- concurrent global-identity inserts in a consistent order across competitors.
  for v_item in
    select s.value from (select distinct on (e.value->>'external_id') e.value,e.ord
      from jsonb_array_elements(p_items) with ordinality e(value,ord)
      order by e.value->>'external_id',e.ord desc) s order by s.value->>'external_id'
  loop
    select x.* into v_source from jsonb_to_record(v_item) as x(platform text,external_id text,actor text,
      payload jsonb,url text,item_type text,published_at timestamptz,title text,caption text,hashtags text[],
      mentions text[],tagged_accounts text[],duration_seconds int,thumbnail_url text,metrics jsonb,
      credits_text text,media_urls text[]);
    v_pub:=v_source.published_at;
    if v_pub is not null and (v_max_pub is null or v_pub>v_max_pub
      or (v_pub=v_max_pub and v_source.external_id collate "C">v_max_ext collate "C")) then
      v_max_pub:=v_pub; v_max_ext:=v_source.external_id;
    end if;
    select i.* into v_existing from app.items i
      where i.platform=v_collection and i.external_id=v_source.external_id for update;
    if found and (v_existing.account_id is distinct from p_account_id or v_existing.competitor_id<>v_comp) then
      raise exception using errcode='22023', message='item identity belongs to a different account';
    end if;
    v_media:=coalesce(nullif(v_source.thumbnail_url,''),v_source.media_urls[1],'');
    v_hash:=case when coalesce(v_source.caption,'')<>'' or v_media<>''
      then encode(extensions.digest(lower(coalesce(v_source.caption,''))||'|'||v_media,'sha256'),'hex') else null end;
    v_normalized:=(to_jsonb(v_source)-'payload')||jsonb_build_object(
      'hashtags',coalesce(to_jsonb(v_source.hashtags),'[]'::jsonb),'mentions',coalesce(to_jsonb(v_source.mentions),'[]'::jsonb),
      'tagged_accounts',coalesce(to_jsonb(v_source.tagged_accounts),'[]'::jsonb),
      'media_urls',coalesce(to_jsonb(v_source.media_urls),'[]'::jsonb),'metrics',coalesce(v_source.metrics,'{}'::jsonb));
    insert into ingest.raw_items as r (platform,external_id,account_id,run_id,actor,payload,normalized,content_hash)
    values (v_collection,v_source.external_id,p_account_id,p_run_id,v_source.actor,v_source.payload,v_normalized,v_hash)
    on conflict (platform,external_id) do nothing returning r.id into v_raw_id;
    if v_raw_id is null and exists (select 1 from ingest.raw_items r where r.platform=v_collection
      and r.external_id=v_source.external_id and r.account_id is distinct from p_account_id) then
      raise exception using errcode='22023', message='raw item identity belongs to a different account';
    end if;
    if v_existing.id is not null then
      if v_source.metrics is not null and v_existing.metrics is distinct from v_source.metrics
        and coalesce(v_existing.published_at,v_existing.first_seen_at)>=now()-interval '30 days'
        and not exists (select 1 from unnest(v_existing.locked_fields) f where f='metrics' or f like 'metrics.%') then
        update app.items i set metrics=v_source.metrics,metrics_updated_at=now() where i.id=v_existing.id;
        v_metrics:=v_metrics+1;
      end if;
      continue;
    end if;
    if v_raw_id is null then raise exception using errcode='55000', message='raw item is missing its clean shell'; end if;
    v_duplicate:=null;
    if v_hash is not null then
      select i.id into v_duplicate from app.items i where i.competitor_id=v_comp and i.content_hash=v_hash
        and i.first_seen_at>=now()-interval '30 days' and i.duplicate_of is null order by i.first_seen_at,i.id limit 1;
    end if;
    insert into app.items (competitor_id,account_id,platform,item_type,external_id,url,published_at,title,
      caption_original,hashtags,mentions,tagged_accounts,duration_seconds,thumbnail_source_url,metrics,
      metrics_updated_at,content_hash,duplicate_of,ai_status)
    values (v_comp,p_account_id,v_collection,v_source.item_type::app.item_type,v_source.external_id,v_source.url,
      v_pub,v_source.title,v_source.caption,coalesce(v_source.hashtags,'{}'),coalesce(v_source.mentions,'{}'),
      coalesce(v_source.tagged_accounts,'{}'),v_source.duration_seconds,v_source.thumbnail_url,
      coalesce(v_source.metrics,'{}'),now(),v_hash,v_duplicate,
      case when v_duplicate is null then 'pending'::app.ai_status else 'duplicate'::app.ai_status end)
    returning id into v_item_id;
    v_created:=v_created+1;
    if v_duplicate is null then v_new:=array_append(v_new,v_item_id); else v_duplicates:=v_duplicates+1; end if;
  end loop;

  if cardinality(v_new)>0 then
    perform pgmq.send_batch('ai_extract',array(select jsonb_build_object('item_id',x) from unnest(v_new) x));
    perform pgmq.send_batch(case when v_collection='instagram_stories' then 'media_stories' else 'media' end,array(select jsonb_build_object('item_id',x) from unnest(v_new) x));
  end if;
  update app.competitor_accounts a set items_count=a.items_count+v_created,
    last_item_published_at=case when v_max_pub is not null and
      (a.last_item_published_at is null or v_max_pub>a.last_item_published_at) then v_max_pub else a.last_item_published_at end,
    last_external_id=case when v_max_pub is not null and (a.last_item_published_at is null
      or v_max_pub>a.last_item_published_at or (v_max_pub=a.last_item_published_at
        and (a.last_external_id is null or v_max_ext collate "C">a.last_external_id collate "C")))
      then v_max_ext else a.last_external_id end,updated_at=now()
  where a.id=p_account_id;
  return jsonb_build_object('inserted',cardinality(v_new),'duplicates',v_duplicates,
    'metrics_updated',v_metrics,'new_item_ids',to_jsonb(v_new));
end;
$$;

create function ops.claim_story_media_batch(p_execution_id text,p_limit int default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare claim ops.audit_log%rowtype; terminal jsonb; q record; prior jsonb; prior_outcome jsonb;
  messages jsonb:='[]'; held jsonb:='[]'; msg jsonb; item_id uuid; safe_skip boolean; reason text;
begin
  perform private.assert_media_session(p_execution_id);
  select * into claim from ops.audit_log where action='story_media_batch_claim'
    and entity_type='story_media_batch' and entity_id=p_execution_id order by id limit 1 for update;
  if found then
    select a.after into terminal from ops.audit_log a where a.action='story_media_batch_finish'
      and a.entity_type='story_media_batch' and a.entity_id=p_execution_id order by a.id desc limit 1;
    return jsonb_build_object('replayed',true,'state',case when terminal is null then 'reconciliation_required' else 'finished' end,
      'messages','[]'::jsonb,'held_count',coalesce(jsonb_array_length(claim.after->'held'),0),'result',terminal);
  end if;
  if p_limit is null or p_limit not between 1 and 50 then raise exception using errcode='22023',message='invalid bounded media batch size'; end if;
  for q in select * from pgmq.read('media_stories',600,p_limit) loop
    reason:=null; prior:=null; prior_outcome:=null; item_id:=null; safe_skip:=false;
    msg:=jsonb_build_object('msg_id',q.msg_id::text,'read_ct',q.read_ct,'message',q.message);
    if jsonb_typeof(q.message) is distinct from 'object' then
      reason:='invalid_queue_message';
    elsif jsonb_typeof(q.message->'item_id') is distinct from 'string'
      or q.message->>'item_id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or (select count(*) from jsonb_object_keys(q.message))<>1 then
      reason:='invalid_queue_message';
    else
      item_id:=(q.message->>'item_id')::uuid;
      select i.thumbnail_path is not null or 'thumbnail_path'=any(i.locked_fields) or i.thumbnail_source_url is null
        into safe_skip from app.items i where i.id=item_id;
      safe_skip:=coalesce(safe_skip,true);
      select a.after into prior from ops.audit_log a where a.action='story_media_message_claim'
        and a.entity_type='story_media_message' and a.entity_id=q.msg_id::text order by a.id desc limit 1;
      if prior is not null and not safe_skip then
        select a.after into prior_outcome from ops.audit_log a where a.action='story_media_message_outcome'
          and a.entity_type='story_media_message' and a.entity_id=q.msg_id::text
          and a.after->>'execution_id'=prior->>'execution_id'
          and a.after->>'read_ct'=prior->>'read_ct' order by a.id desc limit 1;
        if prior_outcome is null then reason:='uncertain_prior_batch';
        elsif prior_outcome->>'outcome'='reconciliation_required' then reason:='prior_reconciliation_required'; end if;
      end if;
    end if;
    if reason is not null then
      held:=held||jsonb_build_array(jsonb_build_object('msg_id',q.msg_id::text,'reason',reason));
      insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
        values('n8n','story_media_message_held','story_media_message',q.msg_id::text,
          jsonb_build_object('execution_id',p_execution_id,'reason',reason,'cost_usd',null));
    else
      messages:=messages||jsonb_build_array(msg);
      insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
        values('n8n','story_media_message_claim','story_media_message',q.msg_id::text,
          jsonb_build_object('execution_id',p_execution_id,'item_id',item_id,'read_ct',q.read_ct));
    end if;
  end loop;
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
    values('n8n','story_media_batch_claim','story_media_batch',p_execution_id,
      jsonb_build_object('messages',messages,'held',held,'batch_limit',p_limit,'cost_usd',null));
  return jsonb_build_object('replayed',false,'state','running','messages',messages,'held_count',jsonb_array_length(held));
end $$;

create function ops.record_story_media_outcome(p_execution_id text,p_outcome jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare claim jsonb; msg jsonb; id text; v_item_id uuid; item app.items%rowtype; ids text[]; outcome text; code text;
  q_claim pgmq.q_media_stories%rowtype;
begin
  perform private.assert_media_session(p_execution_id);
  if p_outcome is null or jsonb_typeof(p_outcome)<>'object'
    or not(p_outcome ?& array['item_id','msg_ids','outcome','code','bytes','cost_usd'])
    or (select count(*) from jsonb_object_keys(p_outcome))<>6
    or jsonb_typeof(p_outcome->'item_id')<>'string'
    or p_outcome->>'item_id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or jsonb_typeof(p_outcome->'msg_ids')<>'array' or jsonb_array_length(p_outcome->'msg_ids') not between 1 and 50
    or jsonb_typeof(p_outcome->'outcome')<>'string' or jsonb_typeof(p_outcome->'code')<>'string'
    or p_outcome->'cost_usd' is distinct from 'null'::jsonb
    or jsonb_typeof(p_outcome->'bytes')<>'number' or p_outcome->>'bytes' !~ '^(0|[1-9][0-9]{0,6})$'
    or (p_outcome->>'bytes')::int>2097152
    or exists(select 1 from jsonb_array_elements(p_outcome->'msg_ids') x
      where jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^[1-9][0-9]{0,18}$') then
    raise exception using errcode='22023',message='invalid controlled media outcome';
  end if;
  select array_agg(x order by x) into ids from jsonb_array_elements_text(p_outcome->'msg_ids') x;
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then
    raise exception using errcode='22023',message='duplicate media message identity';
  end if;
  v_item_id:=(p_outcome->>'item_id')::uuid; outcome:=p_outcome->>'outcome'; code:=p_outcome->>'code';
  if outcome is null or outcome not in ('stored','skipped','media_expired','retryable','reconciliation_required')
    or code is null or code<>all(array['thumbnail_saved','missing_target','human_locked','already_stored','no_source',
      'source_expired','media_transport_failed','media_download_failed','media_resize_failed','media_sign_failed',
      'media_upload_failed','media_save_failed','media_ack_failed','media_retry_exhausted','unsafe_media_source','immutable_object_exists'])
    or (outcome in ('skipped','media_expired','retryable') and (p_outcome->>'bytes')::int<>0)
    or (outcome='retryable' and code<>all(array['media_transport_failed','media_download_failed','media_resize_failed']))
    or (outcome='reconciliation_required' and code<>all(array['media_sign_failed','media_upload_failed','media_save_failed',
      'media_ack_failed','media_retry_exhausted','unsafe_media_source','immutable_object_exists'])) then
    raise exception using errcode='22023',message='unknown media outcome code';
  end if;
  select a.after into claim from ops.audit_log a where a.action='story_media_batch_claim'
    and a.entity_type='story_media_batch' and a.entity_id=p_execution_id order by a.id limit 1;
  if claim is null or exists(select 1 from ops.audit_log a where a.action='story_media_batch_finish'
    and a.entity_type='story_media_batch' and a.entity_id=p_execution_id) then
    raise exception using errcode='55000',message='open owned media batch required';
  end if;
  foreach id in array ids loop
    select x into msg from jsonb_array_elements(claim->'messages') x where x->>'msg_id'=id;
    select * into q_claim from pgmq.q_media_stories q where q.msg_id::text=id for update;
    if msg is null or (msg->'message'->>'item_id')::uuid<>v_item_id or q_claim.msg_id is null
      or q_claim.read_ct<>(msg->>'read_ct')::int or q_claim.message->>'item_id'<>v_item_id::text or q_claim.vt<=now() then
      raise exception using errcode='42501',message='current media message ownership required';
    end if;
  end loop;
  select * into item from app.items where app.items.id=v_item_id;
  if outcome='stored' and (code<>'thumbnail_saved' or (p_outcome->>'bytes')::int<1 or item.thumbnail_path is null
    or not exists(select 1 from app.media_assets a where a.item_id=v_item_id and a.storage_path=item.thumbnail_path)) then
    raise exception using errcode='42501',message='confirmed media receipt required';
  elsif outcome='skipped' and not (
    (code='missing_target' and (item.id is null or not exists(select 1 from jsonb_array_elements(ops.get_media_targets(array[v_item_id])))))
    or (code='human_locked' and 'thumbnail_path'=any(item.locked_fields))
    or (code='already_stored' and item.thumbnail_path is not null)
    or (code='no_source' and item.thumbnail_source_url is null)) then
    raise exception using errcode='42501',message='stored media skip proof required';
  elsif outcome='media_expired' and code<>'source_expired' then
    raise exception using errcode='22023',message='invalid media expiry outcome';
  end if;
  if exists(select 1 from ops.audit_log a where a.action='story_media_outcome' and a.entity_type='story_media_batch_item'
    and a.entity_id=p_execution_id||':'||v_item_id::text and a.after=p_outcome) then return; end if;
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
    values('n8n','story_media_outcome','story_media_batch_item',p_execution_id||':'||v_item_id::text,p_outcome);
  foreach id in array ids loop
    select x into msg from jsonb_array_elements(claim->'messages') x where x->>'msg_id'=id;
    insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
      values('n8n','story_media_message_outcome','story_media_message',id,jsonb_build_object('execution_id',p_execution_id,
        'item_id',v_item_id,'read_ct',msg->'read_ct','outcome',outcome,'code',code));
  end loop;
end $$;

create function ops.ack_story_media_batch(p_execution_id text,p_msg_ids bigint[])
returns void language plpgsql security definer set search_path='' as $$
declare claim jsonb; msg jsonb; v_msg_id bigint; outcome jsonb; q_claim pgmq.q_media_stories%rowtype;
begin
  perform private.assert_media_session(p_execution_id);
  if p_msg_ids is null or coalesce(array_ndims(p_msg_ids),1)<>1 or cardinality(p_msg_ids) not between 1 and 50
    or exists(select 1 from unnest(p_msg_ids) x where x is null or x<1)
    or cardinality(p_msg_ids)<>(select count(distinct x) from unnest(p_msg_ids) x) then
    raise exception using errcode='22023',message='invalid media acknowledgment IDs';
  end if;
  select a.after into claim from ops.audit_log a where a.action='story_media_batch_claim'
    and a.entity_type='story_media_batch' and a.entity_id=p_execution_id order by a.id limit 1;
  if claim is null then raise exception using errcode='42501',message='owned media batch required'; end if;
  foreach v_msg_id in array p_msg_ids loop
    select x into msg from jsonb_array_elements(claim->'messages') x where x->>'msg_id'=v_msg_id::text;
    if msg is null then raise exception using errcode='42501',message='owned media message required'; end if;
    if exists(select 1 from ops.audit_log a where a.action='story_media_message_ack' and a.entity_type='story_media_message'
      and a.entity_id=v_msg_id::text and a.after->>'execution_id'=p_execution_id) then continue; end if;
    if exists(select 1 from ops.audit_log a where a.action='story_media_batch_finish' and a.entity_type='story_media_batch'
      and a.entity_id=p_execution_id) then
      raise exception using errcode='55000',message='finished media batch cannot release more work';
    end if;
    select a.after into outcome from ops.audit_log a where a.action='story_media_message_outcome'
      and a.entity_type='story_media_message' and a.entity_id=v_msg_id::text and a.after->>'execution_id'=p_execution_id order by a.id desc limit 1;
    select * into q_claim from pgmq.q_media_stories q where q.msg_id=v_msg_id for update;
    if outcome is null or outcome->>'outcome' not in ('stored','skipped','media_expired') or q_claim.msg_id is null
      or q_claim.read_ct<>(msg->>'read_ct')::int or q_claim.message->>'item_id'<>msg->'message'->>'item_id' or q_claim.vt<=now() then
      raise exception using errcode='42501',message='durable safe outcome and current claim required';
    end if;
    perform pgmq.archive('media_stories',array[v_msg_id]);
    insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
      values('n8n','story_media_message_ack','story_media_message',v_msg_id::text,jsonb_build_object('execution_id',p_execution_id,'cost_usd',null));
  end loop;
end $$;

create function ops.finish_story_media_batch(p_execution_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare claim jsonb; result jsonb; n_claimed int; n_held int; n_acked int; n_items int; n_reconciliation int; n_bytes bigint;
  n_stored int; n_skipped int; n_expired int; n_retryable int; n_expected int;
begin
  perform private.assert_media_session(p_execution_id);
  select a.after into result from ops.audit_log a where a.action='story_media_batch_finish'
    and a.entity_type='story_media_batch' and a.entity_id=p_execution_id order by a.id desc limit 1;
  if result is not null then return result; end if;
  select a.after into claim from ops.audit_log a where a.action='story_media_batch_claim'
    and a.entity_type='story_media_batch' and a.entity_id=p_execution_id order by a.id limit 1;
  if claim is null then raise exception using errcode='42501',message='owned media batch required'; end if;
  n_claimed:=jsonb_array_length(claim->'messages'); n_held:=jsonb_array_length(claim->'held');
  select count(distinct x->'message'->>'item_id')::int into n_expected from jsonb_array_elements(claim->'messages') x;
  select count(*)::int into n_acked from ops.audit_log a where a.action='story_media_message_ack'
    and a.entity_type='story_media_message' and a.after->>'execution_id'=p_execution_id;
  select count(*)::int,coalesce(sum(bytes),0),count(*) filter(where outcome='reconciliation_required')::int,
    count(*) filter(where outcome='stored')::int,count(*) filter(where outcome='skipped')::int,
    count(*) filter(where outcome='media_expired')::int,count(*) filter(where outcome='retryable')::int
    into n_items,n_bytes,n_reconciliation,n_stored,n_skipped,n_expired,n_retryable from (
      select distinct on(a.entity_id) a.entity_id,a.after->>'outcome' outcome,
        max((a.after->>'bytes')::int) over(partition by a.entity_id) bytes
      from ops.audit_log a where a.action='story_media_outcome' and a.entity_type='story_media_batch_item'
        and a.entity_id like p_execution_id||':%' order by a.entity_id,a.id desc) outcomes;
  result:=jsonb_build_object('state',case when n_held>0 or n_reconciliation>0 or n_items<n_expected then 'reconciliation_required'
    when n_acked<n_claimed then 'partial' else 'completed' end,'claimed',n_claimed+n_held,'held',n_held,
    'processed',n_items,'stored',n_stored,'skipped',n_skipped,'expired',n_expired,'retryable',n_retryable,
    'reconciliation_required',n_reconciliation,'bytes',n_bytes,'infrastructure_cost_usd',null);
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
    values('n8n','story_media_batch_finish','story_media_batch',p_execution_id,result);
  return result;
end $$;


revoke all on function ops.claim_story_media_batch(text,int),ops.record_story_media_outcome(text,jsonb),ops.ack_story_media_batch(text,bigint[]),ops.finish_story_media_batch(text) from public,anon,authenticated,api_agent;
grant execute on function ops.claim_story_media_batch(text,int),ops.record_story_media_outcome(text,jsonb),ops.ack_story_media_batch(text,bigint[]),ops.finish_story_media_batch(text) to n8n_writer;
