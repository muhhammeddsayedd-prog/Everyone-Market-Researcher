-- M04 product delivery contracts. No M03 RPC, migration receipt or launch
-- allowance is changed. All caller-visible effects are fixed operations.
-- https://supabase.com/docs/guides/database/functions
-- https://www.postgresql.org/docs/17/explicit-locking.html

create table ops.collector_runs (
  run_id uuid primary key references ops.scrape_runs(id),
  registration_closed boolean not null default false,
  created_at timestamptz not null default now()
);
create table ops.collector_accounts (
  run_id uuid not null references ops.collector_runs(run_id),
  account_id uuid not null references app.competitor_accounts(id),
  context jsonb not null,
  primary key (run_id,account_id)
);
create index collector_accounts_account on ops.collector_accounts(account_id);
create table ops.collector_launches (
  launch_id uuid primary key,
  run_id uuid not null references ops.collector_runs(run_id),
  actor_id text not null,
  pass text not null check(pass in ('primary','posts','reels')),
  account_ids uuid[] not null,
  purpose text not null check(purpose in ('daily','backfill')),
  results_limit int not null check(results_limit between 1 and 3000),
  approval_id uuid not null,
  max_actor_starts int not null check(max_actor_starts between 1 and 40),
  max_actor_usd numeric(12,6) not null check(max_actor_usd>0),
  max_total_usd numeric(12,6) not null check(max_total_usd>0),
  apify_run_id text unique references ops.apify_runs(apify_run_id),
  next_offset int not null default 0,
  dataset_complete boolean not null default false,
  created_at timestamptz not null default now()
);
create index collector_launches_run on ops.collector_launches(run_id);
create index collector_launches_approval on ops.collector_launches(approval_id);
create table ops.collector_pages (
  launch_id uuid not null references ops.collector_launches(launch_id),
  page_offset int not null,
  args_sha256 text not null,
  result jsonb not null,
  primary key(launch_id,page_offset)
);
create table ops.collector_passes (
  run_id uuid not null,
  account_id uuid not null,
  pass text not null check(pass in ('primary','posts','reels')),
  launch_id uuid references ops.collector_launches(launch_id),
  status text not null default 'pending' check(status in ('pending','success','failed')),
  items_seen int not null default 0 check(items_seen>=0),
  items_new int not null default 0 check(items_new>=0 and items_new<=items_seen),
  stage_status text not null default 'success' check(stage_status in ('success','failed')),
  source_evidence boolean not null default false,
  error text,
  backfill_done boolean not null default false,
  backfill_cursor jsonb,
  primary key(run_id,account_id,pass),
  foreign key(run_id,account_id) references ops.collector_accounts(run_id,account_id)
);
create index collector_passes_account on ops.collector_passes(account_id);
create index collector_passes_launch on ops.collector_passes(launch_id);
create table ops.collector_requests (
  request_id uuid primary key,
  operation text not null,
  args_sha256 text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table ops.collector_runs enable row level security;
alter table ops.collector_accounts enable row level security;
alter table ops.collector_launches enable row level security;
alter table ops.collector_passes enable row level security;
alter table ops.collector_requests enable row level security;
alter table ops.collector_pages enable row level security;
revoke all on ops.collector_runs,ops.collector_accounts,ops.collector_launches,
  ops.collector_passes,ops.collector_requests,ops.collector_pages from public,anon,authenticated,api_agent,n8n_writer;

-- Called only after the parent row is locked. A callback may finish while new
-- batches are still registering, but cannot release the account's other pass.
create function ops.collector_finalize(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_account uuid; v_sum record; v_summary jsonb;
begin
  for v_account in select a.account_id from ops.collector_accounts a
    where a.run_id=p_run_id order by a.account_id loop
    if not exists(select 1 from ops.collector_passes p where p.run_id=p_run_id
        and p.account_id=v_account and p.status='pending')
       and not exists(select 1 from ops.scrape_run_accounts a where a.run_id=p_run_id and a.account_id=v_account) then
      select bool_and(p.status='success') ok,sum(p.items_seen)::int seen,sum(p.items_new)::int new,
        bool_and(p.backfill_done) done,string_agg(distinct p.error,'; ' order by p.error) error,
        jsonb_object_agg(p.pass,p.backfill_cursor) filter(where p.backfill_cursor is not null) cursors
        into v_sum from ops.collector_passes p where p.run_id=p_run_id and p.account_id=v_account;
      perform ops.report_account_result(p_run_id,v_account,case when v_sum.ok then 'success' else 'failed' end,
        v_sum.seen,v_sum.new,v_sum.error,coalesce(v_sum.done,false),v_sum.cursors);
      -- The two passes are one account outcome, so this uses the single core
      -- failure increment. Disable a private/login-walled source immediately
      -- after both owned passes settle; never repair it with a login.
      if position('ig_private_or_login' in coalesce(v_sum.error,''))>0 then
        update app.competitor_accounts set status='invalid',updated_at=clock_timestamp()
          where id=v_account and platform='instagram' and last_run_id=p_run_id
            and locked_until is null;
      end if;
    end if;
  end loop;
  if (select c.registration_closed from ops.collector_runs c where c.run_id=p_run_id)
     and not exists(select 1 from ops.collector_passes p where p.run_id=p_run_id and p.status='pending') then
    select count(*) total,count(*) filter(where a.status='failed') failed into v_sum
      from ops.scrape_run_accounts a where a.run_id=p_run_id;
    v_summary:=ops.finish_run(p_run_id,case when v_sum.failed=0 then 'success'
      when v_sum.failed=v_sum.total then 'failed' else 'partial' end,null);
  end if;
  return v_summary;
end;
$$;
revoke all on function ops.collector_finalize(uuid) from public,anon,authenticated,api_agent,n8n_writer;

create function ops.collector_execute(p_request_id uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_digest text; v_request ops.collector_requests%rowtype; v_result jsonb;
  v_run ops.scrape_runs%rowtype; v_run_id uuid; v_account_id uuid;
  v_args_keys text[]; v_required_keys text[]; v_account app.competitor_accounts%rowtype;
  v_ids uuid[]; v_launch ops.collector_launches%rowtype; v_apify ops.apify_runs%rowtype;
  v_pass text; v_group jsonb; v_items jsonb; v_ingested jsonb; v_groups_digest text;
  v_summary jsonb; v_seen int:=0; v_new int:=0; v_count int; v_index int:=0; v_page ops.collector_pages%rowtype;
  v_usage numeric(12,6); v_share numeric(12,6); v_allocated numeric(12,6):=0;
  v_costs jsonb:='[]'; v_error text; v_status text; v_backfill_done boolean;
begin
  if p_request_id is null or p_operation is null or p_operation not in
      ('start','claim','resolve','ingest','report','cost','finish','launch','register',
       'close_registration','settle','stage','lookup','status','classify')
     or p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>4194304 then
    raise exception using errcode='22023',message='invalid collector request';
  end if;
  v_args_keys:=case p_operation
    when 'start' then array['workflow','platform','mode','env','execution_id']
    when 'claim' then array['platform','limit','run_id','mode','account_ids']
    when 'resolve' then array['account_id','external_id','uploads_playlist_id']
    when 'ingest' then array['run_id','account_id','items']
    when 'report' then array['run_id','account_id','status','items_seen','items_new','error','backfill_done','backfill_cursor']
    when 'cost' then array['entries']
    when 'finish' then array['run_id','status','error']
    when 'launch' then array['run_id','actor_id','pass','account_ids','purpose','launch_id','results_limit',
      'approval_id','max_actor_starts','max_actor_usd','max_total_usd']
    when 'register' then array['run_id','actor_id','pass','account_ids','purpose','launch_id','apify_run_id']
    when 'close_registration' then array['run_id']
    when 'settle' then array['apify_run_id','status','dataset_id','usage_usd','groups']
    when 'stage' then array['apify_run_id','offset','raw_count','has_more','groups']
    when 'lookup' then array['apify_run_id']
    when 'classify' then array['apify_run_id']
    when 'status' then array['request_id'] end;
  if exists(select 1 from jsonb_object_keys(p_args) k where k<>all(v_args_keys)) then
    raise exception using errcode='22023',message='unsupported collector argument';
  end if;
  v_required_keys:=case p_operation
    when 'claim' then array['platform','limit','run_id','mode']
    when 'resolve' then array['account_id','external_id']
    when 'report' then array['run_id','account_id','status','items_seen','items_new','backfill_done']
    when 'finish' then array['run_id','status'] else v_args_keys end;
  if not(p_args ?& v_required_keys) or exists(select 1 from unnest(v_required_keys) k
    where jsonb_typeof(p_args->k)='null' and not(p_operation='resolve' and k='external_id')
      and not(p_operation='settle' and k='dataset_id')) then
    raise exception using errcode='22023',message='missing required collector argument';
  end if;
  if p_operation='status' then
    select r.* into v_request from ops.collector_requests r where r.request_id=(p_args->>'request_id')::uuid;
    if found and v_request.operation='launch' then
      v_request.result:=v_request.result||jsonb_build_object('permit',false,'apify_run_id',
        (select l.apify_run_id from ops.collector_launches l where l.launch_id=(v_request.result->>'launch_id')::uuid));
    end if;
    return jsonb_build_object('replayed',false,'result',case when found then
      jsonb_build_object('found',true,'operation',v_request.operation,'args_sha256',v_request.args_sha256,'result',v_request.result)
      else jsonb_build_object('found',false) end);
  end if;
  if p_operation in ('lookup','classify') then
    select l.* into v_launch from ops.collector_launches l where l.apify_run_id=p_args->>'apify_run_id';
    if p_operation='classify' then
      return jsonb_build_object('replayed',false,'result',jsonb_build_object('scope',case when found then 'm04'
        when exists(select 1 from ops.apify_runs a join ops.scrape_runs r on r.id=a.run_id
          where a.apify_run_id=p_args->>'apify_run_id' and r.env='dev' and r.workflow='WF-99'
          and r.mode='manual' and r.platform='website_work_page') then 'foundation' else 'unknown' end));
    end if;
    if not found then raise exception using errcode='42501',message='unknown collector actor run'; end if;
    select a.* into v_apify from ops.apify_runs a where a.apify_run_id=v_launch.apify_run_id;
    select jsonb_build_object('apify_run_id',v_apify.apify_run_id,'actor_id',v_launch.actor_id,
      'run_id',v_launch.run_id,'account_ids',to_jsonb(v_launch.account_ids),'purpose',v_launch.purpose,'pass',v_launch.pass,
      'launch_created_at',v_launch.created_at,'approval_id',v_launch.approval_id,'max_actor_usd',v_launch.max_actor_usd,
      'results_limit',v_launch.results_limit,'next_offset',v_launch.next_offset,'dataset_complete',v_launch.dataset_complete,
      'pass_results',(select jsonb_agg(to_jsonb(p) order by p.account_id) from ops.collector_passes p where p.launch_id=v_launch.launch_id),
      'accounts',(select jsonb_agg(c.context order by c.account_id) from ops.collector_accounts c
        where c.run_id=v_launch.run_id and c.account_id=any(v_launch.account_ids)),
      'status',v_apify.status,'processed_at',v_apify.processed_at,'processing_result',v_apify.processing_result)
      into v_result;
    return jsonb_build_object('replayed',false,'result',v_result);
  end if;
  -- A transaction-scoped request lock serializes an ambiguous retry. Results
  -- commit atomically with product effects and survive a lost HTTP response.
  perform pg_advisory_xact_lock(hashtextextended('m04-request:'||p_request_id::text,0));
  v_digest:=encode(extensions.digest(p_args::text,'sha256'),'hex');
  select r.* into v_request from ops.collector_requests r where r.request_id=p_request_id;
  if found then
    if v_request.operation<>p_operation or v_request.args_sha256<>v_digest then
      raise exception using errcode='55000',message='collector request identity conflict';
    end if;
    v_result:=v_request.result;
    -- A paid POST permit is deliberately NOT replayable. Reconcile the known
    -- launch instead of starting another actor after an ambiguous response.
    if p_operation='launch' then
      v_result:=v_result||jsonb_build_object('permit',false,'apify_run_id',
        (select l.apify_run_id from ops.collector_launches l where l.launch_id=(p_args->>'launch_id')::uuid));
    end if;
    return jsonb_build_object('replayed',true,'result',v_result);
  end if;

  if p_operation='start' then
    if p_args->>'env' is distinct from 'dev' or p_args->>'mode' not in ('daily','backfill')
       or not ((p_args->>'workflow'='WF-10' and p_args->>'platform'='vimeo')
         or (p_args->>'workflow'='WF-11' and p_args->>'platform'='instagram'))
       or coalesce(p_args->>'execution_id','')!~'^[A-Za-z0-9:_-]{1,200}$' then
      raise exception using errcode='42501',message='dev collector identity required';
    end if;
    v_run_id:=ops.start_run(p_args->>'workflow',(p_args->>'platform')::app.platform,p_args->>'mode','dev',p_args->>'execution_id');
    insert into ops.collector_runs(run_id) values(v_run_id);
    v_result:=jsonb_build_object('run_id',v_run_id);
  else
    if p_operation in ('settle','stage') then
      select l.* into v_launch from ops.collector_launches l where l.apify_run_id=p_args->>'apify_run_id';
      if not found then raise exception using errcode='42501',message='unknown collector actor run'; end if;
      v_run_id:=v_launch.run_id;
    elsif p_operation='resolve' then
      select a.last_run_id into v_run_id from app.competitor_accounts a where a.id=(p_args->>'account_id')::uuid;
    elsif p_operation='cost' then
      if jsonb_typeof(p_args->'entries') is distinct from 'array' or jsonb_array_length(p_args->'entries')>100 then
        raise exception using errcode='22023',message='invalid collector costs';
      end if;
      if jsonb_array_length(p_args->'entries')=0 then
        v_result:=jsonb_build_object('inserted',0);
      else v_run_id:=(p_args->'entries'->0->>'run_id')::uuid; end if;
    else v_run_id:=(p_args->>'run_id')::uuid; end if;
    if v_result is null then
      select r.* into v_run from ops.scrape_runs r join ops.collector_runs c on c.run_id=r.id
        where r.id=v_run_id for update of r;
      if not found or v_run.env<>'dev' or not((v_run.workflow='WF-10' and v_run.platform='vimeo')
          or (v_run.workflow='WF-11' and v_run.platform='instagram')) then
        raise exception using errcode='42501',message='owned dev collector required';
      end if;
      -- A terminal callback receipt is recoverable even after account claims
      -- expired or another run legitimately claimed the account.
      if p_operation='settle' then
        select a.* into v_apify from ops.apify_runs a where a.apify_run_id=v_launch.apify_run_id for update;
        v_groups_digest:=encode(extensions.digest(coalesce(p_args->'groups','null')::text,'sha256'),'hex');
        if v_apify.processed_at is not null then
          if v_apify.status is distinct from p_args->>'status' or v_apify.dataset_id is distinct from p_args->>'dataset_id'
             or v_apify.usage_usd is distinct from (p_args->>'usage_usd')::numeric
             or v_apify.processing_result->>'groups_sha256' is distinct from v_groups_digest then
            raise exception using errcode='55000',message='collector callback receipt conflict';
          end if;
          v_result:=v_apify.processing_result||jsonb_build_object('updated',false,'finished_now',false);
        end if;
      end if;
      if v_result is null and v_run.status<>'running' then
        raise exception using errcode='55000',message='collector is not running';
      end if;
    end if;

    if v_result is null and p_operation='claim' then
      if p_args->>'platform' is distinct from v_run.platform::text or p_args->>'mode' is distinct from v_run.mode
        or (p_args->>'limit')::int not between 1 and 100
        or (select c.registration_closed from ops.collector_runs c where c.run_id=v_run_id)
        or exists(select 1 from ops.collector_accounts c where c.run_id=v_run_id) then
        raise exception using errcode='22023',message='collector claim context conflict';
      end if;
      v_result:='[]';
      if p_args ? 'account_ids' then
        if jsonb_typeof(p_args->'account_ids') is distinct from 'array' then
          raise exception using errcode='22023',message='invalid exact account selection';
        end if;
        select array_agg(x::uuid order by x::uuid) into v_ids from jsonb_array_elements_text(p_args->'account_ids') x;
        if v_ids is null or cardinality(v_ids)<>(p_args->>'limit')::int
           or cardinality(v_ids)<>(select count(distinct x) from unnest(v_ids) x) then
          raise exception using errcode='22023',message='exact account selection must match limit';
        end if;
        -- No global account pause is needed for a representative test. Lock
        -- and claim only this exact eligible set, or roll the whole call back.
        perform a.id from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
          where a.id=any(v_ids) and a.platform=v_run.platform and a.status in ('active','failing') and c.status='active'
            and (a.locked_until is null or a.locked_until<=clock_timestamp())
            and case when v_run.mode='backfill' then a.backfill_status in ('pending','running')
                and (a.consecutive_failures=0 or a.next_due_at<=now())
              else a.next_due_at<=now() and a.backfill_status in ('done','not_applicable') end
          order by a.id for update of a skip locked;
        get diagnostics v_count=row_count;
        if v_count<>cardinality(v_ids) then raise exception using errcode='55000',message='exact account selection is not fully eligible'; end if;
        update app.competitor_accounts set locked_until=now()+interval '2 hours',last_run_id=v_run_id,
          backfill_status=case when v_run.mode='backfill' then 'running'::app.backfill_status else backfill_status end,
          updated_at=now() where id=any(v_ids);
      end if;
      if v_ids is null then
        select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result
          from ops.get_due_accounts(v_run.platform,(p_args->>'limit')::int,v_run_id,v_run.mode) x;
      else
        select coalesce(jsonb_agg(jsonb_build_object('account_id',a.id,'competitor_id',a.competitor_id,
          'competitor_slug',c.slug,'handle',a.handle,'url',a.url,'external_id',a.external_id,
          'uploads_playlist_id',a.uploads_playlist_id,'watermark_published_at',a.last_item_published_at,
          'watermark_external_id',a.last_external_id,'backfill_from',a.backfill_from,'backfill_cursor',a.backfill_cursor)
          order by a.id),'[]') into v_result
          from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where a.id=any(v_ids);
      end if;
      for v_group in select e.value from jsonb_array_elements(v_result) e loop
        v_account_id:=(v_group->>'account_id')::uuid;
        insert into ops.collector_accounts(run_id,account_id,context) values(v_run_id,v_account_id,v_group);
        insert into ops.collector_passes(run_id,account_id,pass)
          select v_run_id,v_account_id,x from unnest(case when v_run.platform='instagram'
            then array['posts','reels'] else array['primary'] end) x;
      end loop;
    elsif v_result is null and p_operation in ('resolve','ingest','report') then
      v_account_id:=(p_args->>'account_id')::uuid;
      if v_run.platform<>'vimeo' or not exists(select 1 from ops.collector_accounts c
          where c.run_id=v_run_id and c.account_id=v_account_id)
        or exists(select 1 from ops.collector_launches l where l.run_id=v_run_id and v_account_id=any(l.account_ids)) then
        raise exception using errcode='42501',message='owned synchronous Vimeo claim required';
      end if;
      if p_operation='resolve' then
        perform ops.set_account_external_id(v_account_id,p_args->>'external_id',p_args->>'uploads_playlist_id');
        v_result:=jsonb_build_object('ok',true);
      elsif p_operation='ingest' then
        if jsonb_typeof(p_args->'items') is distinct from 'array' or jsonb_array_length(p_args->'items')>500
           or exists(select 1 from ops.collector_passes p where p.run_id=v_run_id and p.account_id=v_account_id and p.status<>'pending') then
          raise exception using errcode='22023',message='invalid collector ingest batch';
        end if;
        v_result:=ingest.upsert_raw_items(v_run_id,v_account_id,p_args->'items');
        update ops.collector_passes set items_seen=items_seen+jsonb_array_length(p_args->'items'),
          items_new=items_new+(v_result->>'inserted')::int where run_id=v_run_id and account_id=v_account_id and pass='primary';
      else
        if not exists(select 1 from ops.collector_passes p where p.run_id=v_run_id and p.account_id=v_account_id
          and p.items_seen=(p_args->>'items_seen')::int and p.items_new=(p_args->>'items_new')::int) then
          raise exception using errcode='22023',message='collector result counts conflict';
        end if;
        perform ops.report_account_result(v_run_id,v_account_id,p_args->>'status',(p_args->>'items_seen')::int,
          (p_args->>'items_new')::int,p_args->>'error',(p_args->>'backfill_done')::boolean,p_args->'backfill_cursor');
        update ops.collector_passes set status=case when p_args->>'status'='success' then 'success' else 'failed' end,
          error=p_args->>'error',backfill_done=(p_args->>'backfill_done')::boolean,backfill_cursor=p_args->'backfill_cursor'
          where run_id=v_run_id and account_id=v_account_id and pass='primary';
        v_result:=jsonb_build_object('ok',true);
      end if;
    elsif v_result is null and p_operation='cost' then
      if v_run.platform<>'vimeo' or exists(select 1 from jsonb_array_elements(p_args->'entries') e
        where e.value->>'provider' is distinct from 'vimeo' or e.value->>'run_id' is distinct from v_run_id::text
          or (e.value->>'cost_usd')::numeric is distinct from 0::numeric or e.value->>'unit' is distinct from 'call'
          or e.value->>'category' is distinct from 'scrape' or not exists(select 1 from ops.collector_accounts c
            where c.run_id=v_run_id and c.account_id::text=e.value->'meta'->>'account_id'
              and e.value->'meta'->>'cost_key'='vimeo:'||v_run_id::text||':'||c.account_id::text
              and e.value->>'competitor_id'=c.context->>'competitor_id' and e.value->>'platform'='vimeo')) then
        raise exception using errcode='42501',message='only owned zero-dollar Vimeo API costs allowed';
      end if;
      v_result:=jsonb_build_object('inserted',ops.log_cost(p_args->'entries'));
    elsif v_result is null and p_operation='finish' then
      if exists(select 1 from ops.collector_passes p where p.run_id=v_run_id and p.status='pending')
         or exists(select 1 from ops.collector_launches l where l.run_id=v_run_id and l.apify_run_id is null)
         or (v_run.platform='instagram' and not(select c.registration_closed from ops.collector_runs c where c.run_id=v_run_id)) then
        raise exception using errcode='55000',message='collector has unfinished work';
      end if;
      update ops.collector_runs set registration_closed=true where run_id=v_run_id;
      v_result:=ops.finish_run(v_run_id,p_args->>'status',p_args->>'error');
    elsif v_result is null and p_operation in ('launch','register') then
      v_pass:=p_args->>'pass';
      select array_agg(x::uuid order by x::uuid) into v_ids from jsonb_array_elements_text(p_args->'account_ids') x;
      if v_ids is null or cardinality(v_ids)>50 or cardinality(v_ids)<>(select count(distinct x) from unnest(v_ids) x)
         or p_args->>'purpose' is distinct from v_run.mode
         or (select c.registration_closed from ops.collector_runs c where c.run_id=v_run_id)
         or not((v_run.platform='instagram' and v_pass in ('posts','reels') and p_args->>'actor_id'='apify/instagram-scraper'
             and cardinality(v_ids)<=(case when v_run.mode='daily' then 50 else 10 end))
           or (v_run.platform='vimeo' and v_pass='primary' and cardinality(v_ids)=1
             and ((p_args->>'actor_id'='goat255/vimeo-scraper' and v_run.mode='daily')
               or p_args->>'actor_id'='dltik/vimeo-scraper')))
         or (select count(*) from ops.collector_passes p where p.run_id=v_run_id and p.account_id=any(v_ids) and p.pass=v_pass)<>cardinality(v_ids) then
        raise exception using errcode='42501',message='actor launch does not match claimed collector pass';
      end if;
      if p_operation='launch' and (jsonb_typeof(p_args->'results_limit') is distinct from 'number'
        or (p_args->>'results_limit')::int not between 1 and 3000
        or (p_args->>'actor_id'='apify/instagram-scraper' and v_run.mode='daily' and (p_args->>'results_limit')::int>30)
        or (p_args->>'actor_id'='goat255/vimeo-scraper' and (p_args->>'results_limit')::int>60)
        or (p_args->>'actor_id'='dltik/vimeo-scraper' and (p_args->>'results_limit')::int>(case when v_run.mode='daily' then 50 else 1000 end))) then
        raise exception using errcode='22023',message='invalid actor result bound';
      end if;
      if p_operation='launch' then
        if p_args->>'approval_id' is null or jsonb_typeof(p_args->'max_actor_starts') is distinct from 'number'
          or (p_args->>'max_actor_starts')::int not between 1 and 40
          or jsonb_typeof(p_args->'max_actor_usd') is distinct from 'number' or (p_args->>'max_actor_usd')::numeric<=0
          or jsonb_typeof(p_args->'max_total_usd') is distinct from 'number' or (p_args->>'max_total_usd')::numeric<=0
          or (p_args->>'max_actor_usd')::numeric>(p_args->>'max_total_usd')::numeric then
          raise exception using errcode='22023',message='approved actor allocation required';
        end if;
        perform pg_advisory_xact_lock(hashtextextended('m04-approval:'||(p_args->>'approval_id'),0));
        if exists(select 1 from ops.collector_launches l where l.approval_id=(p_args->>'approval_id')::uuid
          and (l.max_actor_starts<>(p_args->>'max_actor_starts')::int
            or l.max_actor_usd<>(p_args->>'max_actor_usd')::numeric or l.max_total_usd<>(p_args->>'max_total_usd')::numeric)) then
          raise exception using errcode='55000',message='approved actor allocation changed';
        end if;
      end if;
      -- Following core ingestion lock order, verify all exact owned accounts.
      perform c.id from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
        where a.id=any(v_ids) order by c.id for update of c;
      for v_account in select a.* from app.competitor_accounts a where a.id=any(v_ids) order by a.id for update loop
        if v_account.last_run_id is distinct from v_run_id or v_account.locked_until is null or v_account.locked_until<=clock_timestamp()
          or v_account.status not in ('active','failing') or not exists(select 1 from app.competitors c where c.id=v_account.competitor_id and c.status='active') then
          raise exception using errcode='55000',message='actor launch has no live owned claim';
        end if;
      end loop;
      select l.* into v_launch from ops.collector_launches l where l.launch_id=(p_args->>'launch_id')::uuid;
      if found then
        if v_launch.run_id<>v_run_id or v_launch.actor_id<>p_args->>'actor_id' or v_launch.pass<>v_pass
          or v_launch.account_ids<>v_ids or v_launch.purpose<>p_args->>'purpose'
          or (p_operation='launch' and v_launch.results_limit<>(p_args->>'results_limit')::int) then
          raise exception using errcode='55000',message='actor launch identity conflict';
        end if;
      elsif p_operation='register' then
        raise exception using errcode='42501',message='actor launch intent required';
      end if;
      if p_operation='launch' then
        if found then
          v_result:=jsonb_build_object('permit',false,'launch_id',v_launch.launch_id,'apify_run_id',v_launch.apify_run_id);
        else
          if exists(select 1 from ops.collector_passes p where p.run_id=v_run_id and p.account_id=any(v_ids)
            and p.pass=v_pass and (p.launch_id is not null or p.status<>'pending')) then
            raise exception using errcode='55000',message='collector pass already has launch authority';
          end if;
          if (select count(*) from ops.collector_launches l where l.approval_id=(p_args->>'approval_id')::uuid)>=(p_args->>'max_actor_starts')::int
            or (select coalesce(sum(greatest(l.max_actor_usd,coalesce(a.usage_usd,0))),0)
              from ops.collector_launches l left join ops.apify_runs a on a.apify_run_id=l.apify_run_id
              where l.approval_id=(p_args->>'approval_id')::uuid)
              +(p_args->>'max_actor_usd')::numeric>(p_args->>'max_total_usd')::numeric then
            raise exception using errcode='54000',message='approved actor allocation exhausted';
          end if;
          insert into ops.collector_launches(launch_id,run_id,actor_id,pass,account_ids,purpose,results_limit,
            approval_id,max_actor_starts,max_actor_usd,max_total_usd)
            values((p_args->>'launch_id')::uuid,v_run_id,p_args->>'actor_id',v_pass,v_ids,v_run.mode,(p_args->>'results_limit')::int,
              (p_args->>'approval_id')::uuid,(p_args->>'max_actor_starts')::int,(p_args->>'max_actor_usd')::numeric,(p_args->>'max_total_usd')::numeric);
          update ops.collector_passes set launch_id=(p_args->>'launch_id')::uuid
            where run_id=v_run_id and account_id=any(v_ids) and pass=v_pass;
          v_result:=jsonb_build_object('permit',true,'launch_id',(p_args->>'launch_id')::uuid,'apify_run_id',null);
        end if;
      else
        if coalesce(p_args->>'apify_run_id','')!~'^[A-Za-z0-9_-]{1,128}$' then
          raise exception using errcode='22023',message='invalid actor run identity';
        end if;
        if v_launch.apify_run_id is not null then
          if v_launch.apify_run_id<>p_args->>'apify_run_id' then raise exception using errcode='55000',message='actor registration identity conflict'; end if;
        else
          insert into ops.apify_runs(apify_run_id,actor_id,run_id,account_ids,purpose)
            values(p_args->>'apify_run_id',v_launch.actor_id,v_run_id,v_ids,v_launch.purpose);
          update ops.collector_launches set apify_run_id=p_args->>'apify_run_id' where launch_id=v_launch.launch_id;
        end if;
        v_result:=jsonb_build_object('registered',true,'apify_run_id',p_args->>'apify_run_id','run_id',v_run_id);
      end if;
    elsif v_result is null and p_operation='close_registration' then
      if exists(select 1 from ops.collector_passes p left join ops.collector_launches l on l.launch_id=p.launch_id
        where p.run_id=v_run_id and p.status='pending' and (l.apify_run_id is null)) then
        raise exception using errcode='55000',message='collector registration is incomplete';
      end if;
      update ops.collector_runs set registration_closed=true where run_id=v_run_id;
      v_summary:=ops.collector_finalize(v_run_id);
      v_result:=jsonb_build_object('registration_closed',true,'pending_passes',
        (select count(*) from ops.collector_passes p where p.run_id=v_run_id and p.status='pending'),
        'finished_now',v_summary is not null,'summary',v_summary);
    elsif v_result is null and p_operation in ('stage','settle') then
      if p_operation='stage' then
        select l.* into v_launch from ops.collector_launches l where l.launch_id=v_launch.launch_id;
        select p.* into v_page from ops.collector_pages p where p.launch_id=v_launch.launch_id and p.page_offset=(p_args->>'offset')::int;
        if found then
          if v_page.args_sha256<>v_digest then raise exception using errcode='55000',message='collector dataset page conflict'; end if;
          v_result:=v_page.result;
        elsif v_launch.dataset_complete or (p_args->>'offset')::int is distinct from v_launch.next_offset
          or jsonb_typeof(p_args->'offset') is distinct from 'number'
          or jsonb_typeof(p_args->'raw_count') is distinct from 'number'
          or (p_args->>'raw_count')::int not between 0 and 500
          or jsonb_typeof(p_args->'has_more') is distinct from 'boolean'
          or ((p_args->>'has_more')::boolean and (p_args->>'raw_count')::int<>500)
          or v_launch.next_offset+(p_args->>'raw_count')::int>v_launch.results_limit*cardinality(v_launch.account_ids)
          or exists(select 1 from ops.apify_runs a where a.apify_run_id=v_launch.apify_run_id and a.processed_at is not null) then
          raise exception using errcode='55000',message='collector dataset page is outside its checkpoint or bound';
        end if;
      end if;
      if v_result is null then
      if (p_operation='settle' and (p_args->>'status' not in ('SUCCEEDED','FAILED','TIMED_OUT','ABORTED')
         or jsonb_typeof(p_args->'usage_usd') is distinct from 'number'
         or (p_args->>'usage_usd')::numeric not between 0 and 999999.999999
         or (p_args->>'status'='SUCCEEDED' and (not v_launch.dataset_complete
           or coalesce(p_args->>'dataset_id','')!~'^[A-Za-z0-9_-]{1,128}$'))))
         or jsonb_typeof(p_args->'groups') is distinct from 'array'
         or jsonb_array_length(p_args->'groups')<>cardinality(v_launch.account_ids)
         or (select count(distinct e.value->>'account_id') from jsonb_array_elements(p_args->'groups') e)<>cardinality(v_launch.account_ids) then
        raise exception using errcode='22023',message='invalid collector callback metadata';
      end if;
      if p_operation='stage' and (select coalesce(sum(jsonb_array_length(e.value->'items')),0) from jsonb_array_elements(p_args->'groups') e)>(p_args->>'raw_count')::int then
        raise exception using errcode='22023',message='normalized dataset page exceeds its provider row count';
      end if;
      v_usage:=case when p_operation='settle' then (p_args->>'usage_usd')::numeric else 0 end;
      -- Lock all competitor/account rows before ingesting any chunk. SQL below
      -- either persists every account, allocated cost and receipt or none.
      perform c.id from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
        where a.id=any(v_launch.account_ids) order by c.id for update of c;
      perform a.id from app.competitor_accounts a where a.id=any(v_launch.account_ids) order by a.id for update;
      for v_group in select e.value from jsonb_array_elements(p_args->'groups') e order by e.value->>'account_id' loop
        if jsonb_typeof(v_group)<>'object' or not(v_group ?& array['account_id','items','normalizer_version','status','backfill_done'])
           or exists(select 1 from jsonb_object_keys(v_group) k where k<>all(array['account_id','items','normalizer_version','status','error','backfill_done','backfill_cursor','source_evidence']))
           or (v_group ? 'source_evidence' and jsonb_typeof(v_group->'source_evidence')<>'boolean')
           or not((v_group->>'account_id')::uuid=any(v_launch.account_ids))
           or jsonb_typeof(v_group->'items') is distinct from 'array'
           or jsonb_array_length(v_group->'items')>(case when p_operation='stage' then 500 else 0 end)
           or v_group->>'status' not in ('success','failed') or jsonb_typeof(v_group->'backfill_done') is distinct from 'boolean'
           or v_group->>'normalizer_version' is distinct from (case when v_run.platform='instagram' then 'instagram-scraper.v1'
             when v_launch.actor_id='goat255/vimeo-scraper' then 'goat255.v1' else 'dltik.v1' end)
           or (p_operation='settle' and p_args->>'status'<>'SUCCEEDED' and v_group->>'status'<>'failed')
           or (v_group->>'status'='failed' and jsonb_array_length(v_group->'items')<>0)
           or (v_group->>'status'<>'success' and (v_group->>'backfill_done')::boolean) then
          raise exception using errcode='22023',message='invalid collector normalized account group';
        end if;
        v_account_id:=(v_group->>'account_id')::uuid;
        select a.* into v_account from app.competitor_accounts a where a.id=v_account_id;
        if v_account.last_run_id is distinct from v_run_id or v_account.locked_until is null
          or v_account.locked_until<=clock_timestamp() or v_account.status not in ('active','failing')
          or not exists(select 1 from app.competitors c where c.id=v_account.competitor_id and c.status='active') then
          raise exception using errcode='55000',message='callback has no live owned account claim';
        end if;
        if exists(select 1 from ops.collector_passes p where p.run_id=v_run_id and p.account_id=v_account_id
          and p.pass=v_launch.pass and (p.launch_id is distinct from v_launch.launch_id or p.status<>'pending')) then
          raise exception using errcode='55000',message='collector pass receipt conflict';
        end if;
        if exists(select 1 from jsonb_array_elements(v_group->'items') i where i.value->>'actor' is distinct from v_launch.actor_id
          or i.value->>'platform' is distinct from v_run.platform::text
          or (v_run.platform='instagram' and i.value->>'item_type' not in ('post','video','carousel','reel'))) then
          raise exception using errcode='22023',message='normalized item does not match registered actor pass';
        end if;
        v_count:=0;
        for v_index in 0..((jsonb_array_length(v_group->'items')-1)/500) loop
          select coalesce(jsonb_agg(e.value order by e.ord),'[]') into v_items
            from jsonb_array_elements(v_group->'items') with ordinality e(value,ord)
            where e.ord>v_index*500 and e.ord<=v_index*500+500;
          if jsonb_array_length(v_items)>0 then
            v_ingested:=ingest.upsert_raw_items(v_run_id,v_account_id,v_items);
            v_count:=v_count+(v_ingested->>'inserted')::int;
          end if;
        end loop;
        -- Reels is the secondary pass. Keep its items/metrics, while preserving
        -- the primary watermark; only the aggregate report changes cadence.
        if v_launch.pass='reels' then
          update app.competitor_accounts set last_item_published_at=v_account.last_item_published_at,
            last_external_id=v_account.last_external_id where id=v_account_id;
        end if;
        if p_operation='stage' then
          update ops.collector_passes set items_seen=items_seen+jsonb_array_length(v_group->'items'),items_new=items_new+v_count,
            source_evidence=source_evidence or coalesce((v_group->>'source_evidence')::boolean,false)
              or jsonb_array_length(v_group->'items')>0,
            stage_status=case when stage_status='failed' or v_group->>'status'='failed' then 'failed' else 'success' end,
            error=case when error='ig_private_or_login' or v_group->>'error'='ig_private_or_login'
              then 'ig_private_or_login' else coalesce(error,v_group->>'error') end,
            -- Page checkpoints preserve the earliest observed source date.
            -- full_waves belongs to final settlement, never individual pages.
            backfill_cursor=case when v_group->'backfill_cursor'->>'oldest_seen' is null then backfill_cursor
              else jsonb_build_object('oldest_seen',least((backfill_cursor->>'oldest_seen')::timestamptz,
                (v_group->'backfill_cursor'->>'oldest_seen')::timestamptz)) end
            where run_id=v_run_id and account_id=v_account_id and pass=v_launch.pass;
        else
          update ops.collector_passes set status=case when stage_status='failed' then 'failed' else v_group->>'status' end,
            error=case when error='ig_private_or_login' or v_group->>'error'='ig_private_or_login'
              then 'ig_private_or_login' else coalesce(error,v_group->>'error') end,
            backfill_done=(v_group->>'backfill_done')::boolean and stage_status='success',
            backfill_cursor=nullif(v_group->'backfill_cursor','null')
            where run_id=v_run_id and account_id=v_account_id and pass=v_launch.pass;
        end if;
        v_seen:=v_seen+jsonb_array_length(v_group->'items'); v_new:=v_new+v_count;
      end loop;
      if p_operation='stage' then
        update ops.collector_launches set next_offset=next_offset+(p_args->>'raw_count')::int,
          dataset_complete=not (p_args->>'has_more')::boolean where launch_id=v_launch.launch_id;
        v_result:=jsonb_build_object('next_offset',v_launch.next_offset+(p_args->>'raw_count')::int,
          'dataset_complete',not (p_args->>'has_more')::boolean,'items_seen',v_seen,'items_new',v_new);
        insert into ops.collector_pages(launch_id,page_offset,args_sha256,result)
          values(v_launch.launch_id,(p_args->>'offset')::int,v_digest,v_result);
      else
      select coalesce(sum(p.items_seen),0),coalesce(sum(p.items_new),0) into v_seen,v_new
        from ops.collector_passes p where p.launch_id=v_launch.launch_id;
      -- Equal per-account attribution, with the exact rounding remainder on
      -- the final sorted account. The sum equals observed provider usage.
      v_index:=0;
      foreach v_account_id in array v_launch.account_ids loop
        v_index:=v_index+1;
        v_share:=case when v_index=cardinality(v_launch.account_ids) then v_usage-v_allocated
          else trunc(v_usage/cardinality(v_launch.account_ids),6) end;
        v_allocated:=v_allocated+v_share;
        v_costs:=v_costs||jsonb_build_array(jsonb_build_object('provider','apify','category','scrape','quantity',
          (select p.items_seen from ops.collector_passes p where p.run_id=v_run_id and p.account_id=v_account_id and p.pass=v_launch.pass),
          'unit','result','cost_usd',v_share,'run_id',v_run_id,'platform',v_run.platform,
          'meta',jsonb_build_object('actor',v_launch.actor_id,'apify_run_id',v_launch.apify_run_id,'account_id',v_account_id,
            'cost_key','apify:'||v_launch.apify_run_id||':'||v_account_id::text)));
      end loop;
      perform ops.log_cost(v_costs);
      v_result:=jsonb_build_object('updated',true,'finished_now',false,'apify_run_id',v_launch.apify_run_id,
        'run_id',v_run_id,'status',p_args->>'status','dataset_id',p_args->>'dataset_id','cost_usd',v_usage,
        'groups_sha256',v_groups_digest,'items_seen',v_seen,'items_new',v_new,'summary',null);
      update ops.apify_runs set status=p_args->>'status',dataset_id=p_args->>'dataset_id',usage_usd=v_usage,
        finished_at=clock_timestamp(),processed_at=clock_timestamp(),processing_result=v_result
        where apify_run_id=v_launch.apify_run_id;
      v_summary:=ops.collector_finalize(v_run_id);
      v_result:=v_result||jsonb_build_object('finished_now',v_summary is not null,'summary',v_summary);
      update ops.apify_runs set processing_result=v_result where apify_run_id=v_launch.apify_run_id;
      end if;
      end if;
    end if;
  end if;
  if v_result is null then raise exception using errcode='22023',message='unsupported collector state'; end if;
  insert into ops.collector_requests(request_id,operation,args_sha256,result) values(p_request_id,p_operation,v_digest,v_result);
  return jsonb_build_object('replayed',false,'result',v_result);
end;
$$;
revoke all on function ops.collector_execute(uuid,text,jsonb) from public,anon,authenticated,api_agent;
grant execute on function ops.collector_execute(uuid,text,jsonb) to n8n_writer;
