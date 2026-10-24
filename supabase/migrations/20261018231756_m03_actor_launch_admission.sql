-- M03 dev-only actor admission. This source creates no approval or live window.
-- It never alters the ten applied files or GW-01's permanently closed window.
-- https://www.postgresql.org/docs/17/explicit-locking.html
-- https://docs.apify.com/api/v2/actors-runs-post (immutable build number;
-- waitForFinish=0, restartOnError=false and maxTotalChargeUsd are wire controls).
create table ops.apify_launch_approvals (
  window_id uuid primary key,
  approval_reference text not null check (approval_reference ~ '^[A-Za-z0-9_./:-]{1,200}$'),
  project_ref text not null check (project_ref='zmotjsbzhzjvpelxvxlf'),
  actor_build text not null check (actor_build='0.3.99'),
  max_total_charge_usd numeric(12,6) not null check (max_total_charge_usd>0 and max_total_charge_usd<=1),
  batch_max_usd numeric(12,6) not null check (batch_max_usd>=max_total_charge_usd*2 and batch_max_usd<=2),
  not_before timestamptz not null,
  expires_at timestamptz not null,
  closed_at timestamptz,
  check (expires_at>not_before and expires_at<=not_before+interval '2 hours'),
  check (window_id<>'76c2ad42-c094-4ba4-9a0b-566e19b97780'::uuid)
);
create table ops.apify_launch_admissions (
  launch_id uuid primary key,
  window_id uuid not null references ops.apify_launch_approvals(window_id),
  ordinal smallint not null check (ordinal between 1 and 2),
  run_id uuid not null unique references ops.scrape_runs(id),
  account_id uuid not null references app.competitor_accounts(id),
  execution_id text not null check (execution_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  actor_id text not null check (actor_id='aYG0l9s7dbB7j3gbS'),
  actor_build text not null,
  input jsonb not null,
  max_total_charge_usd numeric(12,6) not null,
  post_intent_at timestamptz not null default clock_timestamp(),
  apify_run_id text unique references ops.apify_runs(apify_run_id),
  reconciled_at timestamptz,
  unique(window_id,ordinal),
  check ((apify_run_id is null and reconciled_at is null) or (apify_run_id is not null and reconciled_at is not null))
);
create index apify_launch_admissions_account_idx on ops.apify_launch_admissions(account_id);
alter table ops.apify_launch_approvals enable row level security;
alter table ops.apify_launch_admissions enable row level security;
revoke all on ops.apify_launch_approvals,ops.apify_launch_admissions from public,anon,authenticated,api_agent,n8n_writer;

-- The fixed body is constructed inside the database, never taken from a URL,
-- arbitrary actor, schema/RPC name or general crawler request.
create function ops.m03_smoke_launch_input()
returns jsonb language sql immutable set search_path='' as $$
  select '{"startUrls":[{"url":"https://everyone.film/about-everyone"}],"crawlerType":"cheerio","maxCrawlDepth":0,"maxCrawlPages":1,"saveMarkdown":true,"proxyConfiguration":{"useApifyProxy":true},"saveFiles":false,"saveContentTypes":"","summarize":false,"useSitemaps":false,"useLlmsTxt":false,"maxRequestRetries":0,"maxSessionRotations":0,"maxResults":1,"maxConcurrency":1,"ignoreHttpsErrors":false,"respectRobotsTxtFile":true}'::jsonb;
$$;
revoke all on function ops.m03_smoke_launch_input() from public,anon,authenticated,api_agent,n8n_writer;

create function ops.get_apify_launch(p_launch_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('launch_id',l.launch_id,'window_id',l.window_id,'ordinal',l.ordinal,
    'run_id',l.run_id,'account_id',l.account_id,'execution_id',l.execution_id,'actor_id',l.actor_id,
    'actor_build',l.actor_build,'input',l.input,'memory_mb',1024,'timeout_seconds',300,
    'max_total_charge_usd',l.max_total_charge_usd,'post_intent_at',l.post_intent_at,
    'apify_run_id',l.apify_run_id,'reconciled_at',l.reconciled_at)
  from ops.apify_launch_admissions l where l.launch_id=p_launch_id;
$$;

create function ops.authorize_apify_launch(p jsonb)
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
  select count(*) into v_count from ops.apify_launch_admissions l where l.window_id=v_window;
  if v_count>=2 or exists(select 1 from ops.apify_launch_admissions l left join ops.apify_runs r using(apify_run_id)
      where l.window_id=v_window and (l.apify_run_id is null or r.processed_at is null or r.usage_usd>l.max_total_charge_usd))
     or (select coalesce(sum(r.usage_usd),0) from ops.apify_launch_admissions l join ops.apify_runs r using(apify_run_id)
         where l.window_id=v_window)+v_approval.max_total_charge_usd>v_approval.batch_max_usd then
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

create function ops.reconcile_apify_launch(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_launch uuid;
  v_run uuid;
  v_started timestamptz;
  v_receipt ops.apify_launch_admissions%rowtype;
  v_keys text[];
begin
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>4096 then
    raise exception using errcode='22023',message='invalid M03 reconciliation';
  end if;
  select array_agg(k order by k) into v_keys from jsonb_object_keys(p) k;
  if v_keys<>array['actor_build','actor_id','apify_run_id','input','launch_id','started_at']
     or jsonb_typeof(p->'launch_id') is distinct from 'string'
     or jsonb_typeof(p->'apify_run_id') is distinct from 'string' or p->>'apify_run_id' !~ '^[A-Za-z0-9_-]{1,128}$'
     or p->>'actor_id' is distinct from 'aYG0l9s7dbB7j3gbS'
     or jsonb_typeof(p->'actor_build') is distinct from 'string'
     or jsonb_typeof(p->'started_at') is distinct from 'string'
     or p->>'started_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
     or p->'input' is distinct from ops.m03_smoke_launch_input() then
    raise exception using errcode='22023',message='invalid M03 reconciliation';
  end if;
  begin v_launch:=(p->>'launch_id')::uuid; v_started:=(p->>'started_at')::timestamptz;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode='22023',message='invalid M03 reconciliation identity';
  end;
  select l.run_id into v_run from ops.apify_launch_admissions l where l.launch_id=v_launch;
  if not found then raise exception using errcode='55000',message='M03 launch receipt missing'; end if;
  perform r.id from ops.scrape_runs r where r.id=v_run for update;
  select l.* into strict v_receipt from ops.apify_launch_admissions l where l.launch_id=v_launch for update;
  if v_receipt.actor_build is distinct from p->>'actor_build'
     or v_started<v_receipt.post_intent_at-interval '5 seconds'
     or v_started>v_receipt.post_intent_at+interval '5 minutes'
     or v_started>clock_timestamp()+interval '5 seconds'
     or (v_receipt.apify_run_id is not null and v_receipt.apify_run_id is distinct from p->>'apify_run_id') then
    raise exception using errcode='55000',message='original M03 launch metadata mismatch';
  end if;
  -- Read-only authenticated provider metadata/input must precede this RPC.
  -- An absent run ID never becomes proof that the original POST did not start.
  perform ops.register_apify_run(p->>'apify_run_id','apify/website-content-crawler',v_receipt.run_id,
    array[v_receipt.account_id],'daily');
  update ops.apify_launch_admissions set apify_run_id=p->>'apify_run_id',
    reconciled_at=coalesce(reconciled_at,clock_timestamp()) where launch_id=v_launch;
  return jsonb_build_object('registered',true,'launch',ops.get_apify_launch(v_launch));
end;
$$;

create function ops.reject_apify_callback(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_keys text[];
  v_before jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>1024 then
    raise exception using errcode='22023',message='invalid callback rejection audit';
  end if;
  select array_agg(k order by k) into v_keys from jsonb_object_keys(p) k;
  if v_keys<>array['apify_run_id','execution_id','reason']
     or jsonb_typeof(p->'execution_id') is distinct from 'string' or p->>'execution_id' !~ '^[A-Za-z0-9_-]{1,128}$'
     or jsonb_typeof(p->'apify_run_id') is distinct from 'string' or p->>'apify_run_id' !~ '^[A-Za-z0-9_-]{1,128}$'
     or p->>'reason' is null or p->>'reason' not in ('unregistered','actor_mismatch','registry_mismatch',
       'unsettled','unsupported_input','registration_race','metadata_unavailable') then
    raise exception using errcode='22023',message='invalid callback rejection audit';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-callback-rejection:'||(p->>'execution_id'),0));
  select a.after into v_before from ops.audit_log a where a.actor_type='n8n' and a.action='apify_callback_rejected'
    and a.entity_type='workflow' and a.entity_id='WF-19' and a.after->>'execution_id'=p->>'execution_id';
  if found then
    if v_before is distinct from p then raise exception using errcode='55000',message='callback rejection already has different receipt'; end if;
    return jsonb_build_object('recorded',false,'action','apify_callback_rejected');
  end if;
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
  values('n8n','apify_callback_rejected','workflow','WF-19',p);
  return jsonb_build_object('recorded',true,'action','apify_callback_rejected');
end;
$$;

revoke all on function ops.get_apify_launch(uuid),ops.authorize_apify_launch(jsonb),
  ops.reconcile_apify_launch(jsonb),ops.reject_apify_callback(jsonb) from public,anon,authenticated,api_agent;
grant execute on function ops.get_apify_launch(uuid),ops.authorize_apify_launch(jsonb),
  ops.reconcile_apify_launch(jsonb),ops.reject_apify_callback(jsonb) to n8n_writer;
