-- M05 local forward migration. No source data, account activation or schedules.
-- Definers are private, use an empty search_path, and retain existing ingestion
-- ownership/human-lock/queue behavior. M04 definitions and history are untouched.
-- https://supabase.com/docs/guides/database/functions
-- https://www.postgresql.org/docs/17/explicit-locking.html

alter table app.employee_snapshots add column coverage jsonb not null
  default '{"complete":false,"reason":"legacy_unattested"}'::jsonb;
alter table ops.collector_launches drop constraint collector_launches_purpose_check;
alter table ops.collector_launches add constraint collector_launches_purpose_check check(purpose in ('daily','backfill','weekly'));
-- M05 allocations use positive PostgreSQL integers as a technical capacity.
-- The historical M04 RPC still independently enforces its original 1..40 rule.
alter table ops.collector_launches drop constraint collector_launches_max_actor_starts_check;
alter table ops.collector_launches add constraint collector_launches_max_actor_starts_check check(max_actor_starts>0);
create table ops.m05_jobs (
  launch_id uuid primary key references ops.collector_launches(launch_id),
  actor_input jsonb not null,
  urls text[] not null default '{}',
  crawler_type text,
  snapshot_date date,
  retry_of uuid references ops.m05_jobs(launch_id),
  max_website_urls_per_account int not null default 0 check(max_website_urls_per_account between 0 and 2000),
  settled boolean not null default false,
  retry_pending boolean not null default false,
  result jsonb,
  unique(retry_of)
);
create table ops.m05_quota (
  quota_day date primary key,
  used_units int not null default 0 check(used_units between 0 and 8000)
);
alter table ops.m05_jobs enable row level security;
alter table ops.m05_quota enable row level security;
revoke all on ops.m05_jobs,ops.m05_quota from public,anon,authenticated,api_agent,n8n_writer;

create function ops.m05_assert_claim(p_run_id uuid,p_account_id uuid)
returns app.competitor_accounts language plpgsql security definer set search_path='' as $$
declare r ops.scrape_runs%rowtype; a app.competitor_accounts%rowtype; s text;
begin
  select x.* into r from ops.scrape_runs x join ops.collector_runs c on c.run_id=x.id
    where x.id=p_run_id for update of x;
  if not found or r.env<>'dev' or r.status<>'running' or not
    ((r.workflow='WF-21' and r.platform='website_work_page') or
     (r.workflow='WF-13' and r.platform='youtube') or
     (r.workflow='WF-18' and r.platform='linkedin') or
     (r.workflow='WF-18b' and r.platform='linkedin_employees')) then
    raise exception using errcode='42501',message='owned M05 dev run required';
  end if;
  select c.status into s from app.competitors c join app.competitor_accounts x on x.competitor_id=c.id
    where x.id=p_account_id for share of c;
  select x.* into a from app.competitor_accounts x where x.id=p_account_id for update;
  if not found or s<>'active' or a.status not in ('active','failing')
    or a.last_run_id is distinct from p_run_id or a.locked_until is null or a.locked_until<=clock_timestamp()
    or not(a.platform=r.platform or (a.platform='website' and r.platform='website_work_page'))
    or not exists(select 1 from ops.collector_accounts c where c.run_id=p_run_id and c.account_id=p_account_id) then
    raise exception using errcode='42501',message='live owned M05 claim required';
  end if;
  return a;
end $$;

create function ops.mark_website_page(p_url text,p_status text,p_item_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare p app.website_pages%rowtype; a app.competitor_accounts%rowtype;
begin
  if p_status is null or p_status not in ('crawled','ignored','failed') then
    raise exception using errcode='22023',message='invalid website settlement status';
  end if;
  select x.* into p from app.website_pages x where x.url=p_url;
  if not found then raise exception using errcode='42501',message='owned discovered website page required'; end if;
  select x.* into a from app.competitor_accounts x where x.id=p.account_id;
  a:=ops.m05_assert_claim(a.last_run_id,p.account_id);
  if p_status='crawled' then
    if p_item_id is null or not exists(select 1 from app.items i where i.id=p_item_id
      and i.account_id=p.account_id and i.competitor_id=p.competitor_id and i.platform='website_work_page'
      and i.external_id=substr(encode(extensions.digest(p_url,'sha256'),'hex'),1,32)) then
      raise exception using errcode='42501',message='website item ownership mismatch';
    end if;
  elsif p_item_id is not null then
    raise exception using errcode='22023',message='non-crawled page cannot link an item';
  end if;
  -- Ignored/removed decisions are not undone by a later crawler result.
  update app.website_pages set status=p_status,item_id=p_item_id,
    crawled_at=case when p_status='crawled' then clock_timestamp() else crawled_at end
    where id=p.id and status in ('new','failed','crawled');
end $$;

create function ops.save_employee_snapshot(p_account_id uuid,p_snapshot_date date,p_people jsonb,
  p_coverage jsonb default '{"complete":false,"reason":"unattested"}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a app.competitor_accounts%rowtype; prior app.employee_snapshots%rowtype;
  existing app.employee_snapshots%rowtype; joined jsonb:='[]'; departed jsonb:='[]'; p jsonb; k text; capture_day date;
begin
  select x.* into a from app.competitor_accounts x where x.id=p_account_id;
  a:=ops.m05_assert_claim(a.last_run_id,p_account_id);
  if a.platform<>'linkedin_employees' then raise exception using errcode='42501',message='employee claim required'; end if;
  select (r.started_at at time zone 'Africa/Cairo')::date into capture_day from ops.scrape_runs r where r.id=a.last_run_id;
  if p_snapshot_date is null or p_snapshot_date<>capture_day
    or p_people is null or jsonb_typeof(p_people)<>'array' or jsonb_array_length(p_people)>200
    or p_coverage is null or jsonb_typeof(p_coverage)<>'object'
    or not(p_coverage ?& array['complete','reason']) or jsonb_typeof(p_coverage->'complete')<>'boolean'
    or p_coverage->>'complete'<>'false'
    or jsonb_typeof(p_coverage->'reason')<>'string' or coalesce(p_coverage->>'reason','')!~'^[A-Za-z0-9_:-]{1,100}$'
    or (p_coverage ? 'capped' and jsonb_typeof(p_coverage->'capped')<>'boolean')
    or (p_coverage ? 'observed_count' and (jsonb_typeof(p_coverage->'observed_count')<>'number' or p_coverage->>'observed_count'!~'^[0-9]{1,3}$' or (p_coverage->>'observed_count')::int<>jsonb_array_length(p_people)))
    or (p_coverage ? 'membership_evidence' and p_coverage->>'membership_evidence'<>'registered_company_query')
    or exists(select 1 from jsonb_object_keys(p_coverage) x where x not in ('complete','reason','capped','observed_count','membership_evidence')) then
    raise exception using errcode='22023',message='invalid projected employee snapshot';
  end if;
  for p in select x.value from jsonb_array_elements(p_people) x loop
    if jsonb_typeof(p)<>'object' or not(p ?& array['public_id','name','title','location']) then
      raise exception using errcode='22023',message='employee projection required';
    end if;
    for k in select jsonb_object_keys(p) loop
      if k not in ('public_id','name','title','location') then
        raise exception using errcode='22023',message='employee field forbidden';
      end if;
    end loop;
    if jsonb_typeof(p->'public_id')<>'string' or coalesce(p->>'public_id','')!~'^[[:alnum:]_.%-]{1,200}$' or coalesce(p->>'name','')=''
      or length(p->>'name')>300 or jsonb_typeof(p->'name')<>'string'
      or jsonb_typeof(p->'title') not in ('string','null') or length(p->>'title')>500
      or jsonb_typeof(p->'location') not in ('string','null') or length(p->>'location')>300 then
      raise exception using errcode='22023',message='invalid employee projection';
    end if;
  end loop;
  if (select count(distinct x->>'public_id') from jsonb_array_elements(p_people) x)<>jsonb_array_length(p_people) then
    raise exception using errcode='22023',message='duplicate employee identity';
  end if;
  -- Stable set order makes exact same-day replay independent of dataset order.
  select coalesce(jsonb_agg(x order by x->>'public_id'),'[]') into p_people from jsonb_array_elements(p_people) x;
  perform pg_advisory_xact_lock(hashtextextended('m05-snapshot:'||a.competitor_id::text,0));
  select x.* into existing from app.employee_snapshots x where x.competitor_id=a.competitor_id and x.snapshot_date=p_snapshot_date;
  if found then
    if existing.account_id is distinct from p_account_id or existing.people is distinct from p_people or existing.coverage is distinct from p_coverage then
      raise exception using errcode='55000',message='same-day employee snapshot conflict';
    end if;
    return jsonb_build_object('headcount',existing.headcount_listed,'joined_count',jsonb_array_length(existing.joined),
      'left_count',jsonb_array_length(existing.left_company),'replayed',true,'coverage',existing.coverage);
  end if;
  select x.* into prior from app.employee_snapshots x where x.competitor_id=a.competitor_id
    and x.snapshot_date<p_snapshot_date order by x.snapshot_date desc limit 1;
  if found and p_coverage->>'complete'='true' and prior.coverage->>'complete'='true' then
    select coalesce(jsonb_agg(x),'[]') into joined from jsonb_array_elements(p_people) x
      where not exists(select 1 from jsonb_array_elements(prior.people) y where y->>'public_id'=x->>'public_id');
    -- Missing from a capped sample does not prove left_company. Both captures
    -- need source-attested complete coverage before a departure is inferred.
    if p_coverage->>'complete'='true' and prior.coverage->>'complete'='true' then
      select coalesce(jsonb_agg(x),'[]') into departed from jsonb_array_elements(prior.people) x
        where not exists(select 1 from jsonb_array_elements(p_people) y where y->>'public_id'=x->>'public_id');
    end if;
  end if;
  insert into app.employee_snapshots(competitor_id,account_id,snapshot_date,headcount_listed,people,joined,left_company,coverage)
    values(a.competitor_id,p_account_id,p_snapshot_date,jsonb_array_length(p_people),p_people,joined,departed,p_coverage);
  insert into app.people(name,slug,primary_role,linkedin_public_id,status)
    select e->>'name','linkedin-'||substr(encode(extensions.digest(e->>'public_id','sha256'),'hex'),1,32),
      e->>'title',e->>'public_id','unconfirmed' from jsonb_array_elements(p_people) e
      where e->>'title' ~* 'director|head of|executive producer|producer|dop|cinematographer|founder|ceo|partner'
    on conflict do nothing;
  return jsonb_build_object('headcount',jsonb_array_length(p_people),'joined_count',jsonb_array_length(joined),
    'left_count',jsonb_array_length(departed),'replayed',false,'coverage',p_coverage);
end $$;

-- Existing Vimeo resolver behavior is retained; YouTube gets its own exact,
-- claimed identifier pair, never a fabricated uploads playlist.
create function ops.m05_resolve_youtube(p_account_id uuid,p_external_id text,p_uploads_playlist_id text)
returns void language plpgsql security definer set search_path='' as $$
declare a app.competitor_accounts%rowtype;
begin
  select x.* into a from app.competitor_accounts x where x.id=p_account_id;
  a:=ops.m05_assert_claim(a.last_run_id,p_account_id);
  if a.platform<>'youtube' then raise exception using errcode='42501',message='YouTube claim required'; end if;
  if p_external_id is null then
    update app.competitor_accounts set resolve_status='failed',last_error='youtube_external_id_unresolved',updated_at=now() where id=p_account_id;
  else
    if p_external_id!~'^UC[A-Za-z0-9_-]{22}$' or coalesce(p_uploads_playlist_id,'')!~'^[A-Za-z0-9_-]{1,128}$' then
      raise exception using errcode='22023',message='invalid YouTube identifier pair';
    end if;
    update app.competitor_accounts set external_id=p_external_id,uploads_playlist_id=p_uploads_playlist_id,
      resolve_status='resolved',updated_at=now() where id=p_account_id;
  end if;
end $$;

revoke all on function ops.m05_assert_claim(uuid,uuid),ops.mark_website_page(text,text,uuid),
  ops.save_employee_snapshot(uuid,date,jsonb,jsonb),ops.m05_resolve_youtube(uuid,text,text)
  from public,anon,authenticated,api_agent,n8n_writer;
grant execute on function ops.mark_website_page(text,text,uuid),ops.save_employee_snapshot(uuid,date,jsonb,jsonb) to n8n_writer;

create function ops.m05_finalize(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_claim record; s record; j jsonb; g jsonb; seen int; added int; ok boolean; cursor jsonb; summary jsonb;
begin
  -- Registration must close before ANY asynchronous account is released: a
  -- callback can race another batch registration or a bounded thin-page retry.
  if not(select registration_closed from ops.collector_runs where run_id=p_run_id) then return null; end if;
  for v_claim in select account_id from ops.collector_accounts where run_id=p_run_id order by account_id loop
    if exists(select 1 from ops.scrape_run_accounts x where x.run_id=p_run_id and x.account_id=v_claim.account_id) then continue; end if;
    if not exists(select 1 from ops.collector_launches l where l.run_id=p_run_id and v_claim.account_id=any(l.account_ids))
      or exists(select 1 from ops.collector_launches l join ops.m05_jobs m using(launch_id)
        where l.run_id=p_run_id and v_claim.account_id=any(l.account_ids) and (not m.settled or m.retry_pending)) then continue; end if;
    seen:=0;added:=0;ok:=true;cursor:=null;
    for j in select m.result from ops.collector_launches l join ops.m05_jobs m using(launch_id)
      where l.run_id=p_run_id and v_claim.account_id=any(l.account_ids) order by l.created_at,l.launch_id loop
      for g in select x.value from jsonb_array_elements(j->'groups') x where x.value->>'account_id'=v_claim.account_id::text loop
        seen:=seen+coalesce((g->>'items_seen')::int,0);added:=added+coalesce((g->>'items_new')::int,0);
        ok:=ok and g->>'status'='success';
        if g->'backfill_cursor' is not null and g->'backfill_cursor'<>'null' then cursor:=g->'backfill_cursor'; end if;
      end loop;
    end loop;
    perform ops.report_account_result(p_run_id,v_claim.account_id,case when ok then 'success' else 'failed' end,
      seen,added,case when ok then null else 'm05_source_incomplete_or_failed' end,false,cursor);
    update ops.collector_passes set status=case when ok then 'success' else 'failed' end,
      items_seen=seen,items_new=added,backfill_cursor=cursor,source_evidence=ok
      where run_id=p_run_id and account_id=v_claim.account_id;
  end loop;
  if not exists(select 1 from ops.collector_accounts c where c.run_id=p_run_id and not exists
      (select 1 from ops.scrape_run_accounts a where a.run_id=p_run_id and a.account_id=c.account_id))
    and not exists(select 1 from ops.collector_launches l join ops.m05_jobs m using(launch_id) where l.run_id=p_run_id and (not m.settled or m.retry_pending)) then
    select count(*) total,count(*) filter(where status='failed') failed into s from ops.scrape_run_accounts where run_id=p_run_id;
    summary:=ops.finish_run(p_run_id,case when s.failed=0 then 'success' when s.failed=s.total then 'failed' else 'partial' end,null);
  end if;
  return summary;
end $$;

create function ops.m05_execute(p_request_id uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare op text:=replace(p_operation,'m05.',''); digest text; previous ops.collector_requests%rowtype;
  r ops.scrape_runs%rowtype; a app.competitor_accounts%rowtype; run_id uuid; account_id uuid; ids uuid[];
  result jsonb; context jsonb; group_row jsonb; row_item jsonb; job ops.m05_jobs%rowtype; launch ops.collector_launches%rowtype;
  counts jsonb; groups jsonb:='[]'; entries jsonb:='[]'; item_id uuid; n int; seen int; inserted int; usage numeric;
  keys text[]; required text[]; expected_platform text; expected_workflow text; quota_date date; units int; price numeric;
  allocation_starts_number numeric; allocation_starts int; allocation_actor_usd numeric; allocation_total_usd numeric;
begin
  if p_request_id is null or p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>4194304
    or op not in ('start','claim','resolve','ingest','report','finish','diff','quota','cost','launch','register',
      'close_registration','lookup','classify','settle','snapshot') then
    raise exception using errcode='22023',message='invalid M05 operation';
  end if;
  keys:=case op
    when 'start' then array['workflow','platform','mode','env','execution_id']
    when 'claim' then array['run_id','platform','mode','limit','account_ids']
    when 'resolve' then array['account_id','external_id','uploads_playlist_id']
    when 'ingest' then array['run_id','account_id','items']
    when 'report' then array['run_id','account_id','status','items_seen','items_new','error','backfill_done','backfill_cursor']
    when 'finish' then array['run_id','status','error']
    when 'diff' then array['run_id','account_id','urls']
    when 'quota' then array['quota_day','quantity']
    when 'cost' then array['entries']
    when 'launch' then array['run_id','launch_id','actor_id','pass','account_ids','purpose','results_limit','actor_input',
      'urls','crawler_type','snapshot_date','retry_of','approval_id','max_actor_starts','max_actor_usd','max_total_usd','max_website_urls_per_account']
    when 'register' then array['run_id','launch_id','apify_run_id','actor_id','pass','account_ids','purpose']
    when 'close_registration' then array['run_id']
    when 'lookup' then array['apify_run_id'] when 'classify' then array['apify_run_id']
    when 'snapshot' then array['run_id','account_id','snapshot_date','people','coverage']
    when 'settle' then array['apify_run_id','status','dataset_id','usage_usd','groups'] end;
  if exists(select 1 from jsonb_object_keys(p_args) x where x<>all(keys)) then
    raise exception using errcode='22023',message='unsupported M05 argument';
  end if;
  required:=case op when 'launch' then array['run_id','launch_id','actor_id','pass','account_ids','purpose','results_limit','actor_input',
    'approval_id','max_actor_starts','max_actor_usd','max_total_usd'] else keys end;
  if not(p_args ?& required) then raise exception using errcode='22023',message='missing M05 argument'; end if;
  if op='launch' then
    -- JSON strings such as "NaN" must never be cast into PostgreSQL numeric:
    -- numeric NaN can otherwise satisfy an ordinary CHECK(amount>0). Reject
    -- null/coercion first, then require exact numeric(12,6) storage with no
    -- silent rounding. These are protocol capacities, not owner USD ceilings.
    if jsonb_typeof(p_args->'max_actor_starts') is distinct from 'number'
      or jsonb_typeof(p_args->'max_actor_usd') is distinct from 'number'
      or jsonb_typeof(p_args->'max_total_usd') is distinct from 'number' then
      raise exception using errcode='22023',message='finite M05 launch allocation required';
    end if;
    allocation_starts_number:=(p_args->>'max_actor_starts')::numeric;
    allocation_actor_usd:=(p_args->>'max_actor_usd')::numeric;
    allocation_total_usd:=(p_args->>'max_total_usd')::numeric;
    if allocation_starts_number not between 1 and 2147483647
      or allocation_starts_number<>trunc(allocation_starts_number)
      or allocation_actor_usd not between 0.000001 and 999999.999999
      or allocation_total_usd not between 0.000001 and 999999.999999
      or allocation_actor_usd<>trunc(allocation_actor_usd,6)
      or allocation_total_usd<>trunc(allocation_total_usd,6)
      or allocation_actor_usd>allocation_total_usd then
      raise exception using errcode='22023',message='finite M05 launch allocation required';
    end if;
    allocation_starts:=allocation_starts_number::int;
  end if;
  if op='classify' then
    return jsonb_build_object('replayed',false,'result',jsonb_build_object('scope',case when exists
      (select 1 from ops.collector_launches l join ops.m05_jobs m using(launch_id) where l.apify_run_id=p_args->>'apify_run_id')
      then 'm05' else 'unknown' end));
  end if;
  if op='lookup' then
    select l.* into launch from ops.collector_launches l join ops.m05_jobs m using(launch_id) where l.apify_run_id=p_args->>'apify_run_id';
    if not found then raise exception using errcode='42501',message='unknown M05 actor run'; end if;
    select m.* into job from ops.m05_jobs m where m.launch_id=launch.launch_id;
    return jsonb_build_object('replayed',false,'result',to_jsonb(launch)||to_jsonb(job)||jsonb_build_object('accounts',
      (select jsonb_agg(c.context order by c.account_id) from ops.collector_accounts c where c.run_id=launch.run_id and c.account_id=any(launch.account_ids))));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('m04-request:'||p_request_id::text,0));
  digest:=encode(extensions.digest(p_args::text,'sha256'),'hex');
  select x.* into previous from ops.collector_requests x where x.request_id=p_request_id;
  if found then
    if previous.operation is distinct from 'm05.'||op or previous.args_sha256<>digest then
      raise exception using errcode='55000',message='M05 request identity conflict';
    end if;
    result:=previous.result;
    if op='launch' then result:=result||jsonb_build_object('permit',false); end if;
    return jsonb_build_object('replayed',true,'result',result);
  end if;
  if op='quota' then
    quota_date:=(p_args->>'quota_day')::date;
    if quota_date<>(clock_timestamp() at time zone 'America/Los_Angeles')::date or (p_args->>'quantity')::int not in (0,1) then
      raise exception using errcode='22023',message='current Pacific quota day required';
    end if;
    insert into ops.m05_quota(quota_day) values(quota_date) on conflict do nothing;
    select used_units into units from ops.m05_quota where quota_day=quota_date for update;
    if units+(p_args->>'quantity')::int<=8000 then
      update ops.m05_quota set used_units=used_units+(p_args->>'quantity')::int where quota_day=quota_date returning used_units into units;
      result:=jsonb_build_object('quota_day',quota_date,'used_units',units,'permitted',true);
    else result:=jsonb_build_object('quota_day',quota_date,'used_units',units,'permitted',false); end if;
  elsif op='start' then
    expected_workflow:=case p_args->>'platform' when 'website_work_page' then 'WF-21' when 'youtube' then 'WF-13'
      when 'linkedin' then 'WF-18' when 'linkedin_employees' then 'WF-18b' end;
    if p_args->>'env' is distinct from 'dev' or expected_workflow is null or p_args->>'workflow' is distinct from expected_workflow
      or p_args->>'mode' not in ('daily','backfill','weekly') or (p_args->>'platform'='linkedin_employees')<>(p_args->>'mode'='weekly')
      or coalesce(p_args->>'execution_id','')!~'^[A-Za-z0-9_-]{1,200}$' then
      raise exception using errcode='42501',message='M05 dev workflow identity required';
    end if;
    run_id:=ops.start_run(expected_workflow,(p_args->>'platform')::app.platform,p_args->>'mode','dev',p_args->>'execution_id');
    insert into ops.collector_runs(run_id) values(run_id);
    result:=jsonb_build_object('run_id',run_id);
  else
    if op='resolve' then select last_run_id into run_id from app.competitor_accounts where id=(p_args->>'account_id')::uuid;
    elsif op='settle' then select l.run_id into run_id from ops.collector_launches l join ops.m05_jobs m using(launch_id)
      where l.apify_run_id=p_args->>'apify_run_id';
    elsif op='cost' then run_id:=(p_args->'entries'->0->>'run_id')::uuid;
    else run_id:=(p_args->>'run_id')::uuid; end if;
    select x.* into r from ops.scrape_runs x join ops.collector_runs c on c.run_id=x.id where x.id=run_id for update of x;
    if not found or r.env<>'dev' or r.workflow not in ('WF-21','WF-13','WF-18','WF-18b') then
      raise exception using errcode='42501',message='owned M05 run required';
    end if;
    if op='settle' then
      select l.* into launch from ops.collector_launches l where l.apify_run_id=p_args->>'apify_run_id';
      select m.* into job from ops.m05_jobs m where m.launch_id=launch.launch_id for update;
      if job.settled then
        if job.result->>'settlement_sha256'<>digest then raise exception using errcode='55000',message='M05 settlement conflict'; end if;
        result:=job.result||jsonb_build_object('updated',false);
      end if;
    end if;
    if result is null and r.status<>'running' then raise exception using errcode='55000',message='M05 run is terminal'; end if;
    if result is null and op='claim' then
      expected_platform:=p_args->>'platform';
      select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_args->'account_ids') x;
      if ids is null or cardinality(ids) not between 1 and 20 or cardinality(ids)<>(p_args->>'limit')::int
        or cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
        or not(expected_platform=r.platform::text or (expected_platform='website' and r.platform='website_work_page'))
        or p_args->>'mode'<>r.mode or (select registration_closed from ops.collector_runs where collector_runs.run_id=r.id) then
        raise exception using errcode='22023',message='invalid exact M05 selection';
      end if;
      perform x.id from app.competitor_accounts x join app.competitors c on c.id=x.competitor_id
        where x.id=any(ids) and x.platform::text=expected_platform and x.status in ('active','failing') and c.status='active'
          and (x.locked_until is null or x.locked_until<=clock_timestamp())
          and case when r.mode='backfill' then x.backfill_status in ('pending','running')
            else x.next_due_at<=now() and x.backfill_status in ('done','not_applicable') end
          and not exists(select 1 from ops.collector_accounts ca where ca.run_id=r.id and ca.account_id=x.id)
        order by x.id for update of x skip locked;
      get diagnostics n=row_count;
      if n<>cardinality(ids) then raise exception using errcode='55000',message='M05 selection not fully eligible'; end if;
      update app.competitor_accounts set last_run_id=r.id,locked_until=now()+interval '2 hours',updated_at=now(),
        backfill_status=case when r.mode='backfill' then 'running'::app.backfill_status else backfill_status end where id=any(ids);
      select jsonb_agg(jsonb_build_object('account_id',x.id,'competitor_id',x.competitor_id,'platform',x.platform,
        'handle',x.handle,'url',x.url,'external_id',x.external_id,'uploads_playlist_id',x.uploads_playlist_id,
        'watermark_published_at',x.last_item_published_at,'watermark_external_id',x.last_external_id,
        'backfill_from',x.backfill_from,'backfill_cursor',x.backfill_cursor) order by x.id) into result
        from app.competitor_accounts x where x.id=any(ids);
      insert into ops.collector_accounts(run_id,account_id,context) select r.id,(x->>'account_id')::uuid,x from jsonb_array_elements(result) x;
      insert into ops.collector_passes(run_id,account_id,pass) select r.id,unnest(ids),'primary';
    elsif result is null and op in ('resolve','ingest','report','diff','snapshot') then
      account_id:=(p_args->>'account_id')::uuid;a:=ops.m05_assert_claim(r.id,account_id);
      if op='resolve' then
        perform ops.m05_resolve_youtube(account_id,p_args->>'external_id',p_args->>'uploads_playlist_id');result:='{"ok":true}';
      elsif op='diff' then
        if a.platform not in ('website','website_work_page') or exists(select 1 from jsonb_array_elements_text(p_args->'urls') u
          where lower(split_part(u,'/',3))<>lower(split_part(a.url,'/',3)) or u!~'^https://') then
          raise exception using errcode='42501',message='website URL outside claimed origin'; end if;
        result:=to_jsonb(ops.diff_website_urls(account_id,array(select jsonb_array_elements_text(p_args->'urls'))));
      elsif op='snapshot' then
        result:=ops.save_employee_snapshot(account_id,(p_args->>'snapshot_date')::date,p_args->'people',p_args->'coverage');
      elsif op='ingest' then
        if a.platform<>'youtube' then raise exception using errcode='42501',message='synchronous YouTube ingestion only'; end if;
        result:=ingest.upsert_raw_items(r.id,account_id,p_args->'items');
        update ops.collector_passes set items_seen=items_seen+jsonb_array_length(p_args->'items'),items_new=items_new+(result->>'inserted')::int
          where collector_passes.run_id=r.id and collector_passes.account_id=a.id;
      else
        if exists(select 1 from ops.collector_launches l where l.run_id=r.id and a.id=any(l.account_ids)) then
          raise exception using errcode='55000',message='asynchronous account awaits settlement'; end if;
        if a.platform='youtube' and not exists(select 1 from ops.collector_passes p where p.run_id=r.id and p.account_id=a.id
          and p.items_seen=(p_args->>'items_seen')::int and p.items_new=(p_args->>'items_new')::int) then
          raise exception using errcode='22023',message='M05 result count mismatch'; end if;
        perform ops.report_account_result(r.id,a.id,p_args->>'status',(p_args->>'items_seen')::int,(p_args->>'items_new')::int,
          p_args->>'error',(p_args->>'backfill_done')::boolean,p_args->'backfill_cursor');result:='{"ok":true}';
        update ops.collector_passes set status=case when p_args->>'status'='success' then 'success' else 'failed' end,
          items_seen=(p_args->>'items_seen')::int,items_new=(p_args->>'items_new')::int,
          backfill_done=(p_args->>'backfill_done')::boolean,backfill_cursor=p_args->'backfill_cursor'
          where collector_passes.run_id=r.id and collector_passes.account_id=a.id;
      end if;
    elsif result is null and op='cost' then
      for context in select x.value from jsonb_array_elements(p_args->'entries') x loop
        select x.* into a from app.competitor_accounts x join ops.collector_accounts c on c.account_id=x.id
          where c.run_id=r.id and x.id=(context->'meta'->>'account_id')::uuid;
        if not found then raise exception using errcode='42501',message='M05 cost account not owned'; end if;
        if context->>'run_id'<>r.id::text or context->>'competitor_id'<>a.competitor_id::text or context->>'category'<>'scrape'
          or (context->>'quantity')::int<0 or context->>'platform'<>r.platform::text then
          raise exception using errcode='22023',message='M05 cost ownership mismatch'; end if;
        if context->>'provider'='youtube' and a.platform='youtube' and context->>'unit'='quota_unit' and (context->>'cost_usd')::numeric=0 then
          null;
        elsif context->>'provider'='firecrawl' and a.platform in ('website','website_work_page') and context->>'unit'='credit' and (context->>'quantity')::int=1 then
          select usd_per_unit into price from ops.price_book where provider='firecrawl' and sku='credit'
            and valid_from<=current_date order by valid_from desc limit 1;
          if price is null or price is distinct from (context->>'cost_usd')::numeric then
            raise exception using errcode='22023',message='current Firecrawl price required'; end if;
        else raise exception using errcode='42501',message='M05 provider cost denied'; end if;
        if context->'meta'->>'cost_key'<>context->>'provider'||':'||r.id::text||':'||a.id::text then
          raise exception using errcode='22023',message='M05 cost key mismatch'; end if;
      end loop;
      result:=jsonb_build_object('inserted',ops.log_cost(p_args->'entries'));
    elsif result is null and op in ('launch','register') then
      select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_args->'account_ids') x;
      if ids is null or cardinality(ids) not between 1 and 20 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
        or p_args->>'pass' is distinct from 'primary' or p_args->>'purpose'<>r.mode
        or not((r.platform='website_work_page' and p_args->>'actor_id'='apify/website-content-crawler' and cardinality(ids)=1)
          or (r.platform='linkedin' and p_args->>'actor_id'='harvestapi/linkedin-company-posts')
          or (r.platform='linkedin_employees' and p_args->>'actor_id'='harvestapi/linkedin-company-employees' and cardinality(ids)=1)) then
        raise exception using errcode='42501',message='M05 actor does not match owned source';
      end if;
      foreach account_id in array ids loop a:=ops.m05_assert_claim(r.id,account_id); end loop;
      select l.* into launch from ops.collector_launches l where l.launch_id=(p_args->>'launch_id')::uuid;
      if op='launch' then
        if found then
          select m.* into job from ops.m05_jobs m where m.launch_id=launch.launch_id;
          if launch.run_id<>r.id or launch.actor_id<>p_args->>'actor_id' or launch.account_ids<>ids or job.actor_input<>p_args->'actor_input'
            or launch.approval_id is distinct from (p_args->>'approval_id')::uuid
            or launch.max_actor_starts is distinct from allocation_starts
            or launch.max_actor_usd is distinct from allocation_actor_usd
            or launch.max_total_usd is distinct from allocation_total_usd then
            raise exception using errcode='55000',message='M05 launch identity conflict'; end if;
      result:=jsonb_build_object('permit',false,'replayed',true,'launch_id',launch.launch_id,'apify_run_id',launch.apify_run_id);
        else
          if (p_args->>'results_limit')::int not between 1 and 1000 or
            (r.platform<>'linkedin' and (p_args->>'results_limit')::int>200) or jsonb_typeof(p_args->'actor_input')<>'object'
            or p_args->>'approval_id' is null then
            raise exception using errcode='22023',message='bounded M05 source input required'; end if;
          if p_args ? 'retry_of' then
            select m.* into job from ops.m05_jobs m join ops.collector_launches l using(launch_id)
              where m.launch_id=(p_args->>'retry_of')::uuid and l.run_id=r.id and l.account_ids=ids for update of m;
            if not found or not job.retry_pending or r.platform<>'website_work_page'
              or p_args->>'crawler_type'<>'playwright:adaptive'
              or (select array_agg(x order by x) from jsonb_array_elements_text(job.result->'retry_urls') x)
                is distinct from (select array_agg(x order by x) from jsonb_array_elements_text(p_args->'urls') x) then
              raise exception using errcode='42501',message='exact owned thin retry required'; end if;
          elsif (select registration_closed from ops.collector_runs where collector_runs.run_id=r.id) then
            raise exception using errcode='55000',message='M05 registration already closed';
          end if;
          if r.platform='website_work_page' then
            if not(p_args ?& array['urls','crawler_type','max_website_urls_per_account']) or jsonb_typeof(p_args->'urls')<>'array' or jsonb_array_length(p_args->'urls') not between 1 and 200
              or p_args->>'crawler_type' not in ('cheerio','playwright:adaptive') or exists
              (select 1 from jsonb_array_elements_text(p_args->'urls') u where not exists
                (select 1 from app.website_pages p where p.url=u and p.account_id=ids[1] and p.status in ('new','failed')))
              or (not(p_args ? 'retry_of') and exists(select 1 from ops.collector_launches l join ops.m05_jobs m using(launch_id)
                where l.run_id=r.id and l.account_ids=ids and m.urls && array(select jsonb_array_elements_text(p_args->'urls')))) then
              raise exception using errcode='42501',message='owned undispatched website URLs required'; end if;
            if coalesce((p_args->>'max_website_urls_per_account')::int,0) not between 1 and 2000
              or exists(select 1 from ops.collector_launches l join ops.m05_jobs m using(launch_id)
                where l.approval_id=(p_args->>'approval_id')::uuid and l.actor_id='apify/website-content-crawler'
                  and m.max_website_urls_per_account<>(p_args->>'max_website_urls_per_account')::int)
              or (not(p_args ? 'retry_of') and (select count(distinct u) from
                (select unnest(m.urls) u from ops.collector_launches l join ops.m05_jobs m using(launch_id)
                  where l.approval_id=(p_args->>'approval_id')::uuid and ids[1]=any(l.account_ids) and m.retry_of is null
                 union select jsonb_array_elements_text(p_args->'urls')) selected_urls)
                >(p_args->>'max_website_urls_per_account')::int) then
              raise exception using errcode='55000',message='approved website URL selection exhausted or changed'; end if;
            if exists(select 1 from jsonb_object_keys(p_args->'actor_input') k where k<>all(array[
              'startUrls','crawlerType','maxCrawlDepth','maxCrawlPages','maxResults','useSitemaps','useLlmsTxt',
              'respectRobotsTxtFile','ignoreHttpsErrors','maxSessionRotations','maxRequestRetries','requestTimeoutSecs',
              'maxConcurrency','saveMarkdown','htmlTransformer','removeCookieWarnings','blockMedia','saveFiles',
              'saveContentTypes','saveHtml','saveHtmlAsFile','saveScreenshots','summarize','signHttpRequests','proxyConfiguration']))
              or (select array_agg(x->>'url' order by x->>'url') from jsonb_array_elements(p_args->'actor_input'->'startUrls') x)
                is distinct from (select array_agg(x order by x) from jsonb_array_elements_text(p_args->'urls') x)
              or exists(select 1 from jsonb_array_elements(p_args->'actor_input'->'startUrls') u
                where jsonb_typeof(u)<>'object' or not(u ? 'url') or exists(select 1 from jsonb_object_keys(u) k where k<>'url'))
              or p_args->'actor_input'->'proxyConfiguration' is distinct from '{"useApifyProxy":true}'::jsonb
              or not(p_args->'actor_input' @> jsonb_build_object('crawlerType',p_args->>'crawler_type','maxCrawlDepth',0,
                'maxCrawlPages',jsonb_array_length(p_args->'urls'),'maxResults',jsonb_array_length(p_args->'urls'),
                'useSitemaps',false,'useLlmsTxt',false,'respectRobotsTxtFile',true,'ignoreHttpsErrors',false,
                'maxSessionRotations',0,'maxRequestRetries',1,'requestTimeoutSecs',60,'maxConcurrency',3,
                'saveMarkdown',true,'htmlTransformer','readableText','removeCookieWarnings',true,'blockMedia',true,
                'saveFiles',false,'saveContentTypes','','saveHtml',false,'saveHtmlAsFile',false,
                'saveScreenshots',false,'summarize',false,'signHttpRequests',false)) then
              raise exception using errcode='42501',message='strict public website actor input required'; end if;
          elsif r.platform='linkedin_employees' and (p_args->>'snapshot_date' is null or (p_args->>'snapshot_date')::date<>(r.started_at at time zone 'Africa/Cairo')::date
            or p_args->'actor_input'->>'profileScraperMode' is distinct from 'Short ($4 per 1k)') then
            raise exception using errcode='22023',message='short public employee snapshot required';
          elsif r.platform='linkedin' and exists(select 1 from ops.collector_launches l where l.run_id=r.id and l.account_ids && ids) then
            raise exception using errcode='55000',message='LinkedIn account already dispatched';
          end if;
          if r.platform='linkedin' then
            if not(p_args->'actor_input' ?& array['targetUrls','postedLimitDate','maxPosts','includeReposts','includeQuotePosts','scrapeReactions','scrapeComments'])
              or exists(select 1 from jsonb_object_keys(p_args->'actor_input') k where k<>all(array['targetUrls','postedLimitDate','maxPosts','includeReposts','includeQuotePosts','scrapeReactions','scrapeComments']))
              or not(p_args->'actor_input' @> '{"includeReposts":true,"includeQuotePosts":true,"scrapeReactions":false,"scrapeComments":false}')
              or (p_args->'actor_input'->>'maxPosts')::int is distinct from (p_args->>'results_limit')::int
              or (select array_agg(lower(rtrim(x,'/')) order by lower(rtrim(x,'/'))) from jsonb_array_elements_text(p_args->'actor_input'->'targetUrls') x)
                is distinct from (select array_agg(lower(rtrim(c.context->>'url','/')) order by lower(rtrim(c.context->>'url','/'))) from ops.collector_accounts c where c.run_id=r.id and c.account_id=any(ids))
              or (p_args->'actor_input'->>'postedLimitDate')::date<'2024-01-01'::date then
              raise exception using errcode='42501',message='strict owned LinkedIn posts input required'; end if;
          elsif r.platform='linkedin_employees' then
            if not(p_args->'actor_input' ?& array['companies','profileScraperMode','companyBatchMode','maxItems','maxItemsPerCompany','startPage','takePages'])
              or exists(select 1 from jsonb_object_keys(p_args->'actor_input') k where k<>all(array['companies','profileScraperMode','companyBatchMode','maxItems','maxItemsPerCompany','startPage','takePages']))
              or p_args->'actor_input'->>'companyBatchMode' is distinct from 'one_by_one'
              or (p_args->'actor_input'->>'maxItems')::int is distinct from (p_args->>'results_limit')::int
              or (p_args->'actor_input'->>'maxItemsPerCompany')::int is distinct from (p_args->>'results_limit')::int
              or (p_args->'actor_input'->>'startPage')::int not between 1 and 100
              or (p_args->'actor_input'->>'takePages')::int not between 1 and 8
              or (p_args->'actor_input'->>'startPage')::int+(p_args->'actor_input'->>'takePages')::int>101
              or (select array_agg(lower(rtrim(x,'/'))) from jsonb_array_elements_text(p_args->'actor_input'->'companies') x)
                is distinct from (select array_agg(lower(rtrim(c.context->>'url','/'))) from ops.collector_accounts c where c.run_id=r.id and c.account_id=any(ids)) then
              raise exception using errcode='42501',message='strict owned employee query required'; end if;
          end if;
          perform pg_advisory_xact_lock(hashtextextended('m04-approval:'||(p_args->>'approval_id'),0));
          if exists(select 1 from ops.collector_launches l where l.approval_id=(p_args->>'approval_id')::uuid and
            (l.max_actor_starts<>allocation_starts or l.max_actor_usd<>allocation_actor_usd or l.max_total_usd<>allocation_total_usd))
            or (select count(*) from ops.collector_launches l where l.approval_id=(p_args->>'approval_id')::uuid)>=allocation_starts
            or (select coalesce(sum(greatest(l.max_actor_usd,coalesce(x.usage_usd,0))),0) from ops.collector_launches l
              left join ops.apify_runs x on x.apify_run_id=l.apify_run_id where l.approval_id=(p_args->>'approval_id')::uuid)
              +allocation_actor_usd>allocation_total_usd then
            raise exception using errcode='55000',message='M05 approved actor allocation exhausted or changed'; end if;
          insert into ops.collector_launches(launch_id,run_id,actor_id,pass,account_ids,purpose,results_limit,approval_id,max_actor_starts,max_actor_usd,max_total_usd)
            values((p_args->>'launch_id')::uuid,r.id,p_args->>'actor_id','primary',ids,r.mode,(p_args->>'results_limit')::int,
              (p_args->>'approval_id')::uuid,allocation_starts,allocation_actor_usd,allocation_total_usd);
          insert into ops.m05_jobs(launch_id,actor_input,urls,crawler_type,snapshot_date,retry_of,max_website_urls_per_account)
            values((p_args->>'launch_id')::uuid,p_args->'actor_input',array(select jsonb_array_elements_text(coalesce(p_args->'urls','[]'))),
              p_args->>'crawler_type',(p_args->>'snapshot_date')::date,(p_args->>'retry_of')::uuid,coalesce((p_args->>'max_website_urls_per_account')::int,0));
          if p_args ? 'retry_of' then update ops.m05_jobs set retry_pending=false where launch_id=(p_args->>'retry_of')::uuid; end if;
          result:=jsonb_build_object('permit',true,'replayed',false,'launch_id',p_args->>'launch_id');
        end if;
      else
        if not found or launch.run_id<>r.id or launch.account_ids<>ids or launch.actor_id<>p_args->>'actor_id'
          or coalesce(p_args->>'apify_run_id','')!~'^[A-Za-z0-9_-]{1,128}$' then
          raise exception using errcode='42501',message='owned M05 launch intent required'; end if;
        if launch.apify_run_id is not null and launch.apify_run_id<>p_args->>'apify_run_id' then
          raise exception using errcode='55000',message='M05 actor registration conflict'; end if;
        if exists(select 1 from ops.apify_runs x where x.apify_run_id=p_args->>'apify_run_id'
          and (x.actor_id<>launch.actor_id or x.run_id<>r.id or x.account_ids<>ids or x.purpose<>r.mode)) then
          raise exception using errcode='55000',message='M05 actor already registered elsewhere'; end if;
        insert into ops.apify_runs(apify_run_id,actor_id,run_id,account_ids,purpose)
          values(p_args->>'apify_run_id',launch.actor_id,r.id,ids,r.mode) on conflict do nothing;
        update ops.collector_launches set apify_run_id=p_args->>'apify_run_id' where launch_id=launch.launch_id;
        result:=jsonb_build_object('registered',true,'apify_run_id',p_args->>'apify_run_id','run_id',r.id);
      end if;
    elsif result is null and op='settle' then
      if p_args->>'status' not in ('SUCCEEDED','FAILED','TIMED_OUT','ABORTED') or launch.apify_run_id is null
        or jsonb_typeof(p_args->'groups')<>'array' or jsonb_array_length(p_args->'groups')<>cardinality(launch.account_ids)
        or (select count(distinct x->>'account_id') from jsonb_array_elements(p_args->'groups') x)<>cardinality(launch.account_ids)
        or exists(select 1 from jsonb_array_elements(p_args->'groups') x where (x->>'account_id')::uuid<>all(launch.account_ids)) then
        raise exception using errcode='22023',message='exact M05 settlement groups required'; end if;
      usage:=(p_args->>'usage_usd')::numeric;
      if usage is null or usage<0 or usage>999999.999999 then raise exception using errcode='22023',message='invalid measured actor usage'; end if;
      foreach account_id in array launch.account_ids loop a:=ops.m05_assert_claim(r.id,account_id); end loop;
      for group_row in select x.value from jsonb_array_elements(p_args->'groups') x loop
        account_id:=(group_row->>'account_id')::uuid;a:=ops.m05_assert_claim(r.id,account_id);inserted:=0;
        if p_args->>'status'='SUCCEEDED' and (group_row->>'status'='success' or r.platform='website_work_page') then
          if r.platform='linkedin_employees' then
            begin
              counts:=ops.save_employee_snapshot(a.id,job.snapshot_date,group_row->'people',group_row->'coverage');
            exception when sqlstate '55000' then
              -- A different same-date observation is a preserved, failed
              -- observation, not permission to overwrite the prior snapshot.
              -- Its verified terminal actor usage must still be costed once.
              group_row:=group_row||'{"status":"failed","error":"employee_snapshot_conflict"}'::jsonb;
            end;
            seen:=jsonb_array_length(group_row->'people');
          else
            counts:=ingest.upsert_raw_items(r.id,a.id,group_row->'items');
            inserted:=(counts->>'inserted')::int;seen:=jsonb_array_length(group_row->'items');
            if r.platform='website_work_page' then
              for row_item in select x.value from jsonb_array_elements(group_row->'pages') x loop
                if row_item->>'url'<>all(job.urls) then raise exception using errcode='42501',message='crawler page outside registered URLs'; end if;
                item_id:=null;
                if row_item->>'status'='crawled' then
                  select i.id into item_id from app.items i where i.account_id=a.id and i.platform='website_work_page'
                    and i.external_id=substr(encode(extensions.digest(row_item->>'url','sha256'),'hex'),1,32);
                end if;
                if row_item->>'status'<>'thin' then perform ops.mark_website_page(row_item->>'url',row_item->>'status',item_id); end if;
              end loop;
            end if;
          end if;
        else seen:=0; end if;
        groups:=groups||jsonb_build_array(jsonb_build_object('account_id',a.id,'status',case when p_args->>'status'='SUCCEEDED' then group_row->>'status' else 'failed' end,
          'items_seen',seen,'items_new',inserted,'error',case when group_row->>'error' ~ '^[a-z0-9_]{1,100}$' then group_row->>'error' else null end,
          'backfill_cursor',group_row->'backfill_cursor'));
        entries:=entries||jsonb_build_array(jsonb_build_object('provider','apify','category','scrape','quantity',1,'unit','run',
          'cost_usd',case when a.id=launch.account_ids[cardinality(launch.account_ids)] then usage-(trunc(usage/cardinality(launch.account_ids),6)*(cardinality(launch.account_ids)-1))
            else trunc(usage/cardinality(launch.account_ids),6) end,'run_id',r.id,'competitor_id',a.competitor_id,'platform',r.platform,
          'meta',jsonb_build_object('actor',launch.actor_id,'account_id',a.id,'apify_run_id',launch.apify_run_id,
            'cost_key','apify:'||launch.apify_run_id||':'||a.id::text)));
      end loop;
      perform ops.log_cost(entries);
      update ops.apify_runs set status=p_args->>'status',dataset_id=p_args->>'dataset_id',usage_usd=usage,
        processed_at=clock_timestamp(),finished_at=clock_timestamp() where apify_run_id=launch.apify_run_id;
      result:=jsonb_build_object('updated',true,'groups',groups,'settlement_sha256',digest,'retry_urls',coalesce(p_args->'groups'->0->'retry_urls','[]'));
      if r.platform='website_work_page' and jsonb_array_length(result->'retry_urls')>0 then
        if job.retry_of is not null or job.crawler_type<>'cheerio' or exists(select 1 from jsonb_array_elements_text(result->'retry_urls') u where u<>all(job.urls)) then
          raise exception using errcode='22023',message='invalid thin-page retry request'; end if;
      end if;
      update ops.m05_jobs set settled=true,result=result,retry_pending=jsonb_array_length(result->'retry_urls')>0 where launch_id=job.launch_id;
      result:=result||jsonb_build_object('finished',ops.m05_finalize(r.id));
    elsif result is null and op in ('finish','close_registration') then
      if exists(select 1 from ops.collector_launches l where l.run_id=r.id and l.apify_run_id is null) then
        raise exception using errcode='55000',message='M05 launch registration unresolved'; end if;
      update ops.collector_runs set registration_closed=true where collector_runs.run_id=r.id;
      result:=ops.m05_finalize(r.id);
      if result is null and op='finish' then raise exception using errcode='55000',message='M05 unfinished work'; end if;
      result:=jsonb_build_object('state',case when result is null then 'awaiting_callbacks' else 'completed' end,
        'registration_closed',true,'finished_now',result is not null,'summary',result);
    end if;
  end if;
  if result is null then raise exception using errcode='22023',message='M05 operation not implemented'; end if;
  insert into ops.collector_requests(request_id,operation,args_sha256,result) values(p_request_id,'m05.'||op,digest,result);
  return jsonb_build_object('replayed',false,'result',result);
end $$;
revoke all on function ops.m05_finalize(uuid),ops.m05_execute(uuid,text,jsonb) from public,anon,authenticated,api_agent,n8n_writer;
grant execute on function ops.m05_execute(uuid,text,jsonb) to n8n_writer;
