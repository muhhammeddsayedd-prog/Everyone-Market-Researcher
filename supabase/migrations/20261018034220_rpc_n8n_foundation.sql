-- M03 worker-only RPCs. Provider fees/budget values remain owner-controlled.
-- Sources: https://supabase.com/docs/guides/database/functions
-- https://www.postgresql.org/docs/17/explicit-locking.html
-- https://www.postgresql.org/docs/17/plpgsql-control-structures.html
-- The original complete-before-ingest workflow loses callbacks after a crash.
-- M03 uses process_apify_run for one atomic dev/one-page callback instead.
alter table ops.apify_runs add column processing_result jsonb;
create unique index cost_ledger_cost_key on ops.cost_ledger (provider,(meta->>'cost_key'))
  where meta ? 'cost_key';
create index audit_log_workflow_error_time on ops.audit_log (entity_id,created_at desc)
  where actor_type='n8n' and action in ('workflow_error','notify_logged','workflow_notify_claimed');

create function ops.log_cost(p_entries jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_entry jsonb;
  v_meta jsonb;
  v_key text;
  v_provider text;
  v_category text;
  v_unit text;
  v_day date;
  v_quantity numeric(14,4);
  v_cost numeric(12,6);
  v_run_id uuid;
  v_competitor_id uuid;
  v_item_id uuid;
  v_platform app.platform;
  v_account_id uuid;
  v_account app.competitor_accounts%rowtype;
  v_apify ops.apify_runs%rowtype;
  v_existing ops.cost_ledger%rowtype;
  v_count int := 0;
  v_prepared jsonb := '[]';
begin
  if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>500
     or octet_length(p_entries::text)>1048576 then
    raise exception using errcode='22023',message='invalid cost batch';
  end if;
  -- Stable lock order also covers multi-entry ledger batches.
  for v_entry in
    select e.value from jsonb_array_elements(p_entries) e
    order by e.value->>'provider', e.value->'meta'->>'cost_key'
  loop
    if jsonb_typeof(v_entry)<>'object' or not(v_entry ?& array['provider','category','quantity','unit','cost_usd','meta'])
       or exists(select 1 from jsonb_object_keys(v_entry) k where k<>all(array['provider','category','quantity','unit','cost_usd','run_id','competitor_id','platform','item_id','meta','day']))
       or jsonb_typeof(v_entry->'meta')<>'object'
       or jsonb_typeof(v_entry->'quantity')<>'number' or jsonb_typeof(v_entry->'cost_usd')<>'number'
       or (v_entry ? 'day' and jsonb_typeof(v_entry->'day') is distinct from 'null'
         and (jsonb_typeof(v_entry->'day') is distinct from 'string'
           or v_entry->>'day' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) then
      raise exception using errcode='22023',message='invalid cost entry';
    end if;
    v_provider := v_entry->>'provider';
    v_category := v_entry->>'category';
    v_unit := v_entry->>'unit';
    v_meta := v_entry->'meta';
    if v_provider is null or v_provider not in ('apify','openai','serpapi','firecrawl','vimeo','youtube','n8n','supabase','vercel','email','other')
       or jsonb_typeof(v_entry->'provider')<>'string' or jsonb_typeof(v_entry->'category')<>'string'
       or jsonb_typeof(v_entry->'unit')<>'string' or nullif(btrim(v_category),'') is null
       or length(v_category)>64 or nullif(btrim(v_unit),'') is null or length(v_unit)>64
       or jsonb_typeof(v_meta->'cost_key') is distinct from 'string'
       or nullif(btrim(v_meta->>'cost_key'),'') is null or length(v_meta->>'cost_key')>256 then
      raise exception using errcode='22023',message='invalid cost identity or units';
    end if;
    v_key := v_meta->>'cost_key';
    if (v_entry->>'quantity')::numeric<0 or (v_entry->>'cost_usd')::numeric<0 then
      raise exception using errcode='22023',message='invalid cost amount or day';
    end if;
    begin
      v_quantity := (v_entry->>'quantity')::numeric(14,4);
      v_cost := (v_entry->>'cost_usd')::numeric(12,6);
      v_day := coalesce(nullif(v_entry->>'day','')::date,(now() at time zone 'Africa/Cairo')::date);
      v_run_id := (v_entry->>'run_id')::uuid;
      v_competitor_id := (v_entry->>'competitor_id')::uuid;
      v_item_id := (v_entry->>'item_id')::uuid;
      v_platform := (v_entry->>'platform')::app.platform;
    exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
      raise exception using errcode='22023',message='invalid cost field type or range';
    end;
    if v_quantity<0 or v_cost<0 or v_day>(now() at time zone 'Africa/Cairo')::date then
      raise exception using errcode='22023',message='invalid cost amount or day';
    end if;
    if v_provider='apify' then
      begin
        v_account_id := (v_meta->>'account_id')::uuid;
      exception when invalid_text_representation then raise exception using errcode='22023',message='invalid Apify cost account';
      end;
      select r.* into v_apify from ops.apify_runs r where r.apify_run_id=v_meta->>'apify_run_id';
      if not found or v_account_id is null or not(v_account_id=any(v_apify.account_ids))
         or v_run_id is distinct from v_apify.run_id or v_category<>'scrape'
         or v_key is distinct from 'apify:'||v_apify.apify_run_id||':'||v_account_id::text then
        raise exception using errcode='22023',message='Apify cost does not match its registered account and run';
      end if;
      select a.* into v_account from app.competitor_accounts a where a.id=v_account_id;
      if not found or (v_competitor_id is not null and v_competitor_id<>v_account.competitor_id)
         or (v_platform is not null and v_platform<>(case when v_account.platform='website' then 'website_work_page'::app.platform else v_account.platform end)) then
        raise exception using errcode='22023',message='Apify cost attribution mismatch';
      end if;
      v_competitor_id := v_account.competitor_id;
      v_platform := case when v_account.platform='website' then 'website_work_page'::app.platform else v_account.platform end;
    end if;
    if v_item_id is not null and not exists(select 1 from app.items i where i.id=v_item_id
      and (v_competitor_id is null or i.competitor_id=v_competitor_id) and (v_platform is null or i.platform=v_platform)) then
      raise exception using errcode='22023',message='cost item attribution mismatch';
    end if;
    if (v_run_id is not null and not exists(select 1 from ops.scrape_runs r where r.id=v_run_id))
       or (v_competitor_id is not null and not exists(select 1 from app.competitors c where c.id=v_competitor_id)) then
      raise exception using errcode='22023',message='unknown cost attribution';
    end if;
    v_prepared := v_prepared||jsonb_build_array(jsonb_build_object(
      'day',v_day,'day_omitted',v_entry->>'day' is null,'provider',v_provider,
      'category',v_category,'quantity',v_quantity,'unit',v_unit,'cost_usd',v_cost,
      'run_id',v_run_id,'competitor_id',v_competitor_id,'item_id',v_item_id,
      'platform',v_platform,'meta',v_meta));
  end loop;

  -- Foreign-key row locks precede cost-key advisory locks. Otherwise a direct
  -- log_cost can hold a key while waiting on the callback's parent row, while
  -- the callback waits on that key. Use the callback's same global row order.
  perform r.id from ops.scrape_runs r where r.id in
    (select (e.value->>'run_id')::uuid from jsonb_array_elements(v_prepared) e)
    order by r.id for share;
  perform r.apify_run_id from ops.apify_runs r where r.apify_run_id in
    (select e.value->'meta'->>'apify_run_id' from jsonb_array_elements(v_prepared) e where e.value->>'provider'='apify')
    order by r.apify_run_id for share;
  perform c.id from app.competitors c where c.id in
    (select (e.value->>'competitor_id')::uuid from jsonb_array_elements(v_prepared) e)
    order by c.id for share;
  perform a.id from app.competitor_accounts a where a.id in
    (select (e.value->'meta'->>'account_id')::uuid from jsonb_array_elements(v_prepared) e where e.value->>'provider'='apify')
    order by a.id for share;
  perform i.id from app.items i where i.id in
    (select (e.value->>'item_id')::uuid from jsonb_array_elements(v_prepared) e)
    order by i.id for share;

  for v_entry in
    select e.value from jsonb_array_elements(v_prepared) e
    order by e.value->>'provider',e.value->'meta'->>'cost_key'
  loop
    v_provider := v_entry->>'provider';
    v_category := v_entry->>'category';
    v_quantity := (v_entry->>'quantity')::numeric;
    v_unit := v_entry->>'unit';
    v_cost := (v_entry->>'cost_usd')::numeric;
    v_day := (v_entry->>'day')::date;
    v_run_id := (v_entry->>'run_id')::uuid;
    v_competitor_id := (v_entry->>'competitor_id')::uuid;
    v_item_id := (v_entry->>'item_id')::uuid;
    v_platform := (v_entry->>'platform')::app.platform;
    v_meta := v_entry->'meta';
    v_key := v_meta->>'cost_key';
    if v_provider='apify' and not exists(
      select 1 from ops.apify_runs r join app.competitor_accounts a
        on a.id=(v_meta->>'account_id')::uuid
      where r.apify_run_id=v_meta->>'apify_run_id' and r.run_id=v_run_id
        and a.id=any(r.account_ids) and a.competitor_id=v_competitor_id
        and (case when a.platform='website' then 'website_work_page'::app.platform else a.platform end)=v_platform) then
      raise exception using errcode='55000',message='cost attribution changed; retry safely';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-cost:'||v_provider||':'||v_key,0));
    select l.* into v_existing from ops.cost_ledger l where l.provider=v_provider and l.meta ? 'cost_key' and l.meta->>'cost_key'=v_key;
    if found then
      -- An omitted day defaults only on the first insert; a retry after Cairo
      -- midnight retains that first receipt's day instead of creating a charge.
      if (v_entry->>'day_omitted')::boolean then
        v_day := v_existing.day;
      end if;
      if v_existing.day is distinct from v_day or v_existing.category is distinct from v_category
         or v_existing.quantity is distinct from v_quantity or v_existing.unit is distinct from v_unit
         or v_existing.cost_usd is distinct from v_cost or v_existing.run_id is distinct from v_run_id
         or v_existing.competitor_id is distinct from v_competitor_id or v_existing.item_id is distinct from v_item_id
         or v_existing.platform is distinct from v_platform or v_existing.meta is distinct from v_meta then
        raise exception using errcode='55000',message='cost key already has a different receipt';
      end if;
    else
      insert into ops.cost_ledger(day,provider,category,quantity,unit,cost_usd,run_id,competitor_id,item_id,platform,meta)
      values(v_day,v_provider,v_category,v_quantity,v_unit,v_cost,v_run_id,v_competitor_id,v_item_id,v_platform,v_meta);
      v_count := v_count+1;
    end if;
  end loop;
  return v_count;
end;
$$;

create function ops.register_apify_run(p_apify_run_id text,p_actor_id text,p_run_id uuid,p_account_ids uuid[],p_purpose text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_parent ops.scrape_runs%rowtype;
  v_existing ops.apify_runs%rowtype;
  v_account app.competitor_accounts%rowtype;
  v_accounts uuid[];
begin
  if p_apify_run_id is null or p_apify_run_id!~'^[A-Za-z0-9_-]{1,128}$'
     or nullif(btrim(p_actor_id),'') is null or length(p_actor_id)>200 or p_run_id is null
     or p_account_ids is null or cardinality(p_account_ids)<1 or cardinality(p_account_ids)>500
     or array_position(p_account_ids,null) is not null or p_purpose is null
     or p_purpose not in ('daily','backfill','removal_check','weekly') then
    raise exception using errcode='22023',message='invalid Apify registration';
  end if;
  select array_agg(a order by a) into v_accounts from unnest(p_account_ids) a;
  if cardinality(v_accounts)<>(select count(distinct a) from unnest(p_account_ids) a) then
    raise exception using errcode='22023',message='duplicate Apify accounts';
  end if;
  -- Global lock order: parent, registry, competitor, account.
  select r.* into v_parent from ops.scrape_runs r where r.id=p_run_id for update;
  if not found then
    raise exception using errcode='22023',message='unknown parent run';
  end if;
  select r.* into v_existing from ops.apify_runs r where r.apify_run_id=p_apify_run_id for update;
  if found then
    if v_existing.actor_id is distinct from p_actor_id or v_existing.run_id is distinct from p_run_id
       or v_existing.account_ids is distinct from v_accounts or v_existing.purpose is distinct from p_purpose then
      raise exception using errcode='55000',message='Apify run already has different registration';
    end if;
    return;
  end if;
  if v_parent.status<>'running' then
    raise exception using errcode='55000',message='parent run is not running';
  end if;
  -- M03 launches one actor only. A future collector needs a reviewed launch barrier.
  if exists(select 1 from ops.apify_runs r where r.run_id=p_run_id) then
    raise exception using errcode='55000',message='M03 permits one actor per parent run';
  end if;
  if v_parent.mode<>'manual' and p_purpose<>v_parent.mode then
    raise exception using errcode='22023',message='Apify purpose does not match parent run';
  end if;
  if v_parent.mode='manual' and (v_parent.env<>'dev' or v_parent.workflow<>'WF-99'
     or p_purpose<>'daily' or cardinality(v_accounts)<>1) then
    raise exception using errcode='22023',message='manual Apify claims are dev daily smoke only';
  end if;
  perform c.id from app.competitors c where c.id in
    (select a.competitor_id from app.competitor_accounts a where a.id=any(v_accounts)) order by c.id for update;
  for v_account in select a.* from app.competitor_accounts a where a.id=any(v_accounts) order by a.id for update loop
    if not exists(select 1 from app.competitors c where c.id=v_account.competitor_id and c.status='active')
       or v_account.status not in ('active','failing')
       or v_parent.platform is distinct from (case when v_account.platform='website' then 'website_work_page'::app.platform else v_account.platform end) then
      raise exception using errcode='22023',message='registered account does not match the parent collection';
    end if;
    if v_parent.mode='manual' and (v_account.platform<>'website_work_page'
       or v_account.url is distinct from 'https://everyone.film/about-everyone'
       or not exists(select 1 from app.competitors c where c.id=v_account.competitor_id
         and c.company_code='C999' and c.slug='emr-smoke-test')
       or (select count(*)=1 and bool_and(
           l.after->>'fixture_version'='1'
           and l.after->>'project_ref'='zmotjsbzhzjvpelxvxlf'
           and l.after->>'competitor_id'=v_account.competitor_id::text
           and l.after->>'account_id'=v_account.id::text)
         from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_setup.v1'
           and l.action='m03_smoke_fixture_created' and l.entity_type='competitor'
           and l.entity_id=v_account.competitor_id::text) is distinct from true) then
      raise exception using errcode='22023',message='manual Apify claim is not the owned smoke account';
    end if;
    if v_account.last_run_id is distinct from p_run_id or v_account.locked_until is null or v_account.locked_until<=now() then
      if v_parent.mode<>'manual' or (v_account.locked_until is not null and v_account.locked_until>now()) then
        raise exception using errcode='55000',message='registered account has no live owned claim';
      end if;
      update app.competitor_accounts set last_run_id=p_run_id,locked_until=now()+interval '2 hours',updated_at=now() where id=v_account.id;
    end if;
  end loop;
  if (select count(*) from app.competitor_accounts a where a.id=any(v_accounts))<>cardinality(v_accounts) then
    raise exception using errcode='22023',message='unknown registered account';
  end if;
  insert into ops.apify_runs(apify_run_id,actor_id,run_id,account_ids,purpose)
  values(p_apify_run_id,p_actor_id,p_run_id,v_accounts,p_purpose);
end;
$$;

create function ops.get_apify_run(p_apify_run_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(r) from ops.apify_runs r where r.apify_run_id=p_apify_run_id;
$$;

create function ops.apify_runs_pending(p_run_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from ops.apify_runs r where r.run_id=p_run_id and r.processed_at is null;
$$;

create function ops.complete_apify_run(p_apify_run_id text,p_status text,p_dataset_id text,p_usage_usd numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run_id uuid;
  v_row ops.apify_runs%rowtype;
  v_updated boolean := false;
  v_usage numeric(12,6);
begin
  if p_status is null or p_status not in ('SUCCEEDED','FAILED','TIMED_OUT','ABORTED') or p_usage_usd is null
     or p_usage_usd::text in ('NaN','Infinity','-Infinity') or p_usage_usd<0 or p_usage_usd>999999.999999
     or (p_status='SUCCEEDED' and nullif(btrim(p_dataset_id),'') is null) or length(p_dataset_id)>200 then
    raise exception using errcode='22023',message='invalid final Apify metadata';
  end if;
  v_usage := p_usage_usd;
  select r.run_id into v_run_id from ops.apify_runs r where r.apify_run_id=p_apify_run_id;
  if not found then
    raise exception using errcode='22023',message='unknown Apify run';
  end if;
  perform r.id from ops.scrape_runs r where r.id=v_run_id for update;
  select r.* into v_row from ops.apify_runs r where r.apify_run_id=p_apify_run_id for update;
  if v_row.run_id is distinct from v_run_id then
    raise exception using errcode='55000',message='Apify parent binding changed';
  end if;
  if v_row.processed_at is not null then
    if v_row.status is distinct from p_status or v_row.dataset_id is distinct from p_dataset_id or v_row.usage_usd is distinct from v_usage then
      raise exception using errcode='55000',message='Apify completion already has a different receipt';
    end if;
  else
    -- A separate node may not mark an unpersisted callback complete.
    if v_row.processing_result is null or v_row.processing_result->>'status' is distinct from p_status
       or v_row.processing_result->>'dataset_id' is distinct from p_dataset_id
       or (v_row.processing_result->>'cost_usd')::numeric is distinct from v_usage
       or (select count(*) from ops.scrape_run_accounts a where a.run_id=v_run_id and a.account_id=any(v_row.account_ids))<>cardinality(v_row.account_ids)
       or (select count(*) from ops.cost_ledger l where l.provider='apify' and l.run_id=v_run_id and l.meta->>'apify_run_id'=p_apify_run_id)<>cardinality(v_row.account_ids)
       or (select sum(l.cost_usd) from ops.cost_ledger l where l.provider='apify' and l.run_id=v_run_id and l.meta->>'apify_run_id'=p_apify_run_id) is distinct from v_usage then
      raise exception using errcode='55000',message='Apify callback has no complete durable account and cost receipt';
    end if;
    update ops.apify_runs set status=p_status,dataset_id=p_dataset_id,usage_usd=v_usage,finished_at=now(),processed_at=now()
    where apify_run_id=p_apify_run_id returning * into v_row;
    v_updated := true;
  end if;
  return jsonb_build_object('updated',v_updated,'row',to_jsonb(v_row));
end;
$$;

create function ops.get_setting(p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select s.value from ops.settings s where s.key=p_key;
$$;

create function ops.get_price_book()
returns jsonb language sql stable security definer set search_path = '' as $$
  -- Actor SKUs already contain owner/name; do not produce apify/apify/...
  select coalesce(jsonb_object_agg(case when p.provider='apify' then p.sku else p.provider||'/'||p.sku end,
    jsonb_build_object('unit',p.unit,'usd',p.usd_per_unit)),'{}'::jsonb)
  from (select distinct on(provider,sku) provider,sku,unit,usd_per_unit from ops.price_book
    where valid_from<=(now() at time zone 'Africa/Cairo')::date order by provider,sku,valid_from desc) p;
$$;

create function ops.log_workflow_error(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
  v_workflow text;
  v_execution text;
  v_node text;
  v_action text;
  v_run_id uuid;
  v_safe jsonb;
  v_previous jsonb;
begin
  if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32768
     or p->>'kind' not in ('error','notify') or p->>'kind' is null
     or jsonb_typeof(p->'kind') is distinct from 'string'
     or jsonb_typeof(p->'workflow') is distinct from 'string'
     or jsonb_typeof(p->'execution_id') is distinct from 'string'
     or p->>'workflow' !~ '^[A-Za-z0-9_-]{1,200}$'
     or p->>'execution_id' !~ '^[A-Za-z0-9_-]{1,200}$'
     or (p ? 'node' and jsonb_typeof(p->'node') not in ('string','null'))
     or (p ? 'stack' and jsonb_typeof(p->'stack') not in ('string','null'))
     or jsonb_typeof(p->'message') is distinct from 'string' or length(p->>'message')>4096
     or (p ? 'meta' and (jsonb_typeof(p->'meta')<>'object'
       or exists(select 1 from jsonb_object_keys(p->'meta') k where k<>'run_id')))
     or exists(select 1 from jsonb_object_keys(p) k where k<>all(array['kind','workflow','execution_id','node','message','stack','run_id','meta']))
     then
    raise exception using errcode='22023',message='invalid or sensitive workflow error payload';
  end if;
  begin
    v_run_id := (p->>'run_id')::uuid;
    if p->'meta' ? 'run_id' then
      perform (p->'meta'->>'run_id')::uuid;
    end if;
  exception when invalid_text_representation then raise exception using errcode='22023',message='invalid workflow error run';
  end;
  v_kind := p->>'kind';
  v_workflow := p->>'workflow';
  v_execution := p->>'execution_id';
  v_node := coalesce(p->>'node','');
  if v_node !~ '^[A-Za-z0-9 _.-]{0,200}$' then
    raise exception using errcode='22023',message='invalid workflow error node';
  end if;
  v_action := case when v_kind='error' then 'workflow_error' else 'notify_logged' end;
  -- Node/HTTP/SQL messages and stacks can carry credentials. Store a fixed
  -- classification only, never the original text or stack. Meta allows only a
  -- UUID correlation reference. WF-90 sends these same fixed classifications.
  v_safe := (p-'stack')||jsonb_build_object('message',case
    when p->>'message' in ('workflow_failed','callback_retryable','apify_failed',
      'notify_threshold_reached','unexpected_error') then p->>'message'
    when v_kind='notify' then 'notify_threshold_reached' else 'workflow_failed' end);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-error:'||v_workflow||':'||v_execution||':'||v_node||':'||v_action,0));
  select a.after into v_previous from ops.audit_log a where a.actor_type='n8n' and a.action=v_action
    and a.entity_type='workflow' and a.entity_id=v_workflow and a.after->>'execution_id'=v_execution
    and coalesce(a.after->>'node','')=v_node order by a.id limit 1;
  if found then
    if v_previous is distinct from v_safe then
      raise exception using errcode='55000',message='workflow event already has a different receipt';
    end if;
    return;
  end if;
  if v_kind='error' and v_run_id is not null then
    -- WF-19 transient callback failures omit run_id and retain it in meta, so a
    -- retryable HTTP/SQL fault does not fence the parent before callback retry.
    update ops.scrape_runs set status='failed',finished_at=now(),error=v_safe->>'message' where id=v_run_id and status='running';
  end if;
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
  values('n8n',v_action,'workflow',v_workflow,v_safe);
end;
$$;

create function ops.error_count_24h(p_workflow text,p_claim_notify boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  if nullif(btrim(p_workflow),'') is null or length(p_workflow)>200 or p_claim_notify is null then
    raise exception using errcode='22023',message='invalid workflow error query';
  end if;
  if p_claim_notify then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-notify:'||p_workflow,0));
  end if;
  select count(*)::int into v_count from ops.audit_log a where a.actor_type='n8n' and a.action='workflow_error'
    and a.entity_type='workflow' and a.entity_id=p_workflow and a.created_at>=now()-interval '24 hours';
  if not p_claim_notify then
    return v_count;
  end if;
  -- Optional claim mode returns count only to the one six-hour window winner;
  -- zero means do not notify, not the literal error count. Log-only reservation
  -- is not an exactly-once external email delivery guarantee.
  if v_count<3 or exists(select 1 from ops.audit_log a where a.actor_type='n8n' and a.entity_type='workflow'
    and a.entity_id=p_workflow and a.action in ('notify_logged','workflow_notify_claimed') and a.created_at>=now()-interval '6 hours') then
    return 0;
  end if;
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
  values('n8n','workflow_notify_claimed','workflow',p_workflow,jsonb_build_object('workflow',p_workflow,'window_hours',6));
  return v_count;
end;
$$;

create function ops.accrue_fixed_costs(p_day date)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_price record;
  v_days numeric;
  v_count int := 0;
begin
  if p_day is null or p_day>(now() at time zone 'Africa/Cairo')::date then
    raise exception using errcode='22023',message='invalid fixed-cost day';
  end if;
  v_days := extract(day from (date_trunc('month',p_day::timestamp)+interval '1 month - 1 day'));
  for v_price in select distinct on(provider,sku) provider,sku,unit,usd_per_unit from ops.price_book
    where provider in ('n8n','supabase','vercel') and valid_from<=p_day order by provider,sku,valid_from desc loop
    if v_price.unit<>'month' then
      continue;
    end if;
    if v_price.usd_per_unit<0 then
      raise exception using errcode='22023',message='invalid fixed fee';
    end if;
    v_count := v_count+ops.log_cost(jsonb_build_array(jsonb_build_object('provider',v_price.provider,'category','fixed_fee',
      'quantity',1,'unit','day','cost_usd',round(v_price.usd_per_unit/v_days,6),'day',p_day,
      'meta',jsonb_build_object('sku',v_price.sku,'cost_key','fixed:'||v_price.sku||':'||p_day::text))));
  end loop;
  return v_count;
end;
$$;

create function ops.daily_health()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_yesterday date;
  v_month date;
  v_start timestamptz;
  v_end timestamptz;
  v_budget numeric;
  v_total numeric;
  v_mtd numeric;
  v_days numeric;
begin
  v_yesterday := v_today-1;
  v_month := date_trunc('month',v_today::timestamp)::date;
  v_start := v_yesterday::timestamp at time zone 'Africa/Cairo';
  v_end := v_today::timestamp at time zone 'Africa/Cairo';
  if jsonb_typeof(ops.get_setting('daily_budget_usd'))='number' then
    v_budget := (ops.get_setting('daily_budget_usd')#>>'{}')::numeric;
  end if;
  select coalesce(sum(l.cost_usd),0) into v_total from ops.cost_ledger l where l.day=v_yesterday;
  select coalesce(sum(l.cost_usd),0) into v_mtd from ops.cost_ledger l where l.day>=v_month and l.day<=v_today;
  v_days := extract(day from (date_trunc('month',v_today::timestamp)+interval '1 month - 1 day'));
  return jsonb_build_object(
    'failing_accounts',coalesce((select jsonb_agg(jsonb_build_object('account_id',a.id,'competitor',c.name,'platform',a.platform,
      'handle',a.handle,'last_error',a.last_error,'consecutive_failures',a.consecutive_failures) order by a.id)
      from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where a.status='failing' and c.status='active'),'[]'::jsonb),
    'stale_accounts',coalesce((select jsonb_agg(jsonb_build_object('account_id',a.id,'competitor',c.name,'platform',a.platform,
      'handle',a.handle,'last_success_at',a.last_success_at) order by a.id)
      from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where a.status='active' and c.status='active'
      and a.backfill_status in ('done','not_applicable') and coalesce(a.last_success_at,a.created_at)<now()-
        case when a.cadence>=interval '7 days' then interval '9 days' else interval '48 hours' end),'[]'::jsonb),
    'queues',jsonb_build_object('ai_extract',(select queue_length from pgmq.metrics('ai_extract')),
      'embed',(select queue_length from pgmq.metrics('embed')),'media',(select queue_length from pgmq.metrics('media'))),
    'items_new_yesterday',coalesce((select jsonb_object_agg(platform,n) from (select i.platform,count(*) n from app.items i
      where i.first_seen_at>=v_start and i.first_seen_at<v_end group by i.platform) counts),'{}'::jsonb),
    'cost_yesterday',jsonb_build_object('total',v_total,'by_provider',coalesce((select jsonb_object_agg(provider,n) from
      (select l.provider,sum(l.cost_usd) n from ops.cost_ledger l where l.day=v_yesterday group by l.provider) costs),'{}'::jsonb)),
    'budget',jsonb_build_object('daily_budget_usd',v_budget,'over_budget',coalesce(v_total>v_budget,false)),
    'month_to_date_usd',v_mtd,'forecast_month_usd',round(v_mtd/extract(day from v_today)*v_days,6),
    'workflow_errors_24h',coalesce((select jsonb_object_agg(entity_id,n) from (select a.entity_id,count(*) n from ops.audit_log a
      where a.actor_type='n8n' and a.entity_type='workflow' and a.action='workflow_error' and a.created_at>=now()-interval '24 hours'
      group by a.entity_id) errors),'{}'::jsonb));
end;
$$;

create function ops.process_apify_run(p_apify_run_id text,p_status text,p_dataset_id text,p_usage_usd numeric,p_groups jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run_id uuid;
  v_parent ops.scrape_runs%rowtype;
  v_apify ops.apify_runs%rowtype;
  v_account app.competitor_accounts%rowtype;
  v_group jsonb;
  v_items jsonb;
  v_digest text;
  v_ingested jsonb;
  v_result jsonb;
  v_completion jsonb;
  v_summary jsonb;
  v_seen int;
  v_new int;
  v_error text;
  v_receipt_status text;
  v_cost numeric(12,6);
  v_cost_key text;
begin
  -- Caller must re-fetch final status/dataset/usage through its Apify credential.
  -- SQL binds persistence to registered context; it cannot attest that HTTP call.
  if p_status is null or p_status not in ('SUCCEEDED','FAILED','TIMED_OUT','ABORTED') or p_usage_usd is null
     or p_usage_usd::text in ('NaN','Infinity','-Infinity') or p_usage_usd<0 or p_usage_usd>999999.999999
     or (p_status='SUCCEEDED' and nullif(btrim(p_dataset_id),'') is null) or length(p_dataset_id)>200
     or p_groups is null or jsonb_typeof(p_groups)<>'array' or jsonb_array_length(p_groups)<>1
     or octet_length(p_groups::text)>1048576 then
    raise exception using errcode='22023',message='invalid bounded callback payload';
  end if;
  v_cost := p_usage_usd;
  v_group := p_groups->0;
  if jsonb_typeof(v_group)<>'object' or not(v_group ?& array['account_id','items','normalizer_version'])
     or exists(select 1 from jsonb_object_keys(v_group) k where k<>all(array['account_id','items','normalizer_version']))
     or v_group->>'normalizer_version' is distinct from 'smoke_website_stub.v1'
     or jsonb_typeof(v_group->'items') is distinct from 'array' or jsonb_array_length(v_group->'items')>1
     or (p_status<>'SUCCEEDED' and jsonb_array_length(v_group->'items')<>0) then
    raise exception using errcode='22023',message='M03 callback requires one bounded versioned account group';
  end if;
  v_items := v_group->'items';
  v_digest := encode(extensions.digest(p_groups::text,'sha256'),'hex');
  select r.run_id into v_run_id from ops.apify_runs r where r.apify_run_id=p_apify_run_id;
  if not found then
    raise exception using errcode='22023',message='unknown Apify run';
  end if;
  select r.* into v_parent from ops.scrape_runs r where r.id=v_run_id for update;
  select r.* into v_apify from ops.apify_runs r where r.apify_run_id=p_apify_run_id for update;
  if v_apify.run_id is distinct from v_run_id then
    raise exception using errcode='55000',message='Apify parent binding changed';
  end if;
  if v_apify.processed_at is not null then
    if v_apify.processing_result is null or v_apify.status is distinct from p_status
       or v_apify.dataset_id is distinct from p_dataset_id or v_apify.usage_usd is distinct from v_cost
       or v_apify.processing_result->>'groups_sha256' is distinct from v_digest then
      raise exception using errcode='55000',message='callback replay conflicts with its durable receipt';
    end if;
    return v_apify.processing_result||jsonb_build_object('updated',false,'finished_now',false);
  end if;
  if v_parent.status<>'running' or v_parent.env<>'dev' or v_parent.mode<>'manual' or v_parent.workflow<>'WF-99'
     or v_parent.platform<>'website_work_page' or v_apify.purpose<>'daily'
     or v_apify.actor_id not in ('apify/website-content-crawler','aYG0l9s7dbB7j3gbS')
     or cardinality(v_apify.account_ids)<>1 or (select count(*) from ops.apify_runs r where r.run_id=v_run_id)<>1
     or v_group->>'account_id' is distinct from v_apify.account_ids[1]::text then
    raise exception using errcode='22023',message='callback is outside the registered M03 dev collection';
  end if;
  perform c.id from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where a.id=v_apify.account_ids[1] for update of c;
  select a.* into v_account from app.competitor_accounts a where a.id=v_apify.account_ids[1] for update;
  if v_account.platform<>'website_work_page' or v_account.status not in ('active','failing')
     or v_account.url is distinct from 'https://everyone.film/about-everyone'
     or not exists(select 1 from app.competitors c where c.id=v_account.competitor_id
       and c.company_code='C999' and c.slug='emr-smoke-test' and c.status='active')
     or (select count(*)=1 and bool_and(
         l.after->>'fixture_version'='1'
         and l.after->>'project_ref'='zmotjsbzhzjvpelxvxlf'
         and l.after->>'competitor_id'=v_account.competitor_id::text
         and l.after->>'account_id'=v_account.id::text)
       from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_setup.v1'
         and l.action='m03_smoke_fixture_created' and l.entity_type='competitor'
         and l.entity_id=v_account.competitor_id::text) is distinct from true
     or v_account.last_run_id is distinct from v_run_id or v_account.locked_until is null or v_account.locked_until<=now() then
    raise exception using errcode='55000',message='callback has no live registered account claim';
  end if;
  if jsonb_array_length(v_items)=1 then
    if jsonb_typeof(v_items->0) is distinct from 'object'
       or not((v_items->0) ?& array['platform','external_id','actor','item_type','url','published_at','title','caption','metrics','payload'])
       or exists(select 1 from jsonb_object_keys(v_items->0) k where k<>all(array[
         'platform','external_id','actor','item_type','url','published_at','title','caption','metrics','payload']))
       or (v_items->0)->>'platform' is distinct from 'website_work_page'
       or jsonb_typeof((v_items->0)->'published_at') is distinct from 'null'
       or (v_items->0)->'metrics' is distinct from '{}'::jsonb
       or (v_items->0)->>'actor' is distinct from 'apify/website-content-crawler'
       or (v_items->0)->>'url' is distinct from v_account.url or (v_items->0)->>'item_type' is distinct from 'project_page'
       or (v_items->0)->>'external_id' is distinct from left(encode(extensions.digest('https://everyone.film/about-everyone','sha256'),'hex'),32)
       or jsonb_typeof((v_items->0)->'payload') is distinct from 'object'
       or not((v_items->0)->'payload' ?& array['url','markdown','metadata'])
       or exists(select 1 from jsonb_object_keys((v_items->0)->'payload') k where k<>all(array['url','markdown','metadata']))
       or (v_items->0)->'payload'->>'url' is distinct from v_account.url
       or jsonb_typeof((v_items->0)->'payload'->'markdown') is distinct from 'string'
       or length((v_items->0)->'payload'->>'markdown')>8000
       or jsonb_typeof((v_items->0)->'payload'->'metadata') is distinct from 'object'
       or not((v_items->0)->'payload'->'metadata' ? 'title')
       or exists(select 1 from jsonb_object_keys((v_items->0)->'payload'->'metadata') k where k<>'title')
       or coalesce(jsonb_typeof((v_items->0)->'payload'->'metadata'->'title'),'missing') not in ('string','null')
       or length((v_items->0)->'payload'->'metadata'->>'title')>2000
       or (v_items->0)->'title' is distinct from (v_items->0)->'payload'->'metadata'->'title'
       or (v_items->0)->'caption' is distinct from (v_items->0)->'payload'->'markdown' then
      raise exception using errcode='22023',message='callback page does not match its registered bounded public source';
    end if;
  end if;
  v_seen := jsonb_array_length(v_items);
  v_new := 0;
  if p_status='SUCCEEDED' then
    v_ingested := ingest.upsert_raw_items(v_run_id,v_account.id,v_items);
    v_new := (v_ingested->>'inserted')::int;
    v_receipt_status := 'success';
    v_error := null;
  else
    v_ingested := jsonb_build_object('new_item_ids','[]'::jsonb);
  v_receipt_status := 'failed';
  v_error := 'apify_'||lower(p_status);
  end if;
  perform ops.report_account_result(v_run_id,v_account.id,v_receipt_status,v_seen,v_new,v_error,false,null);
  v_cost_key := 'apify:'||p_apify_run_id||':'||v_account.id::text;
  perform ops.log_cost(jsonb_build_array(jsonb_build_object('provider','apify','category','scrape','quantity',v_seen,
    'unit','result','cost_usd',v_cost,'run_id',v_run_id,'competitor_id',v_account.competitor_id,'platform',v_account.platform,
    'meta',jsonb_build_object('actor',v_apify.actor_id,'apify_run_id',p_apify_run_id,'account_id',v_account.id,'cost_key',v_cost_key))));
  v_result := jsonb_build_object('updated',true,'finished_now',true,'apify_run_id',p_apify_run_id,'run_id',v_run_id,
    'account_ids',to_jsonb(v_apify.account_ids),'status',p_status,'dataset_id',p_dataset_id,'cost_usd',v_cost,
    'groups_sha256',v_digest,'normalizer_version',v_group->>'normalizer_version','cost_keys',jsonb_build_array(v_cost_key),
    'items_seen',v_seen,'items_new',v_new,'new_item_ids',coalesce(v_ingested->'new_item_ids','[]'::jsonb),
    'accounts_ok',case when v_receipt_status='success' then 1 else 0 end,'accounts_failed',case when v_receipt_status='failed' then 1 else 0 end);
  update ops.apify_runs set processing_result=v_result where apify_run_id=p_apify_run_id;
  v_completion := ops.complete_apify_run(p_apify_run_id,p_status,p_dataset_id,v_cost);
  if (v_completion->>'updated')::boolean is distinct from true then
    raise exception using errcode='55000',message='callback completion transition was lost';
  end if;
  v_summary := ops.finish_run(v_run_id,case when v_receipt_status='success' then 'success' else 'partial' end);
  v_result := v_result||jsonb_build_object('run_summary',v_summary);
  update ops.apify_runs set processing_result=v_result where apify_run_id=p_apify_run_id;
  return v_result;
end;
$$;

revoke all on function ops.log_cost(jsonb),ops.register_apify_run(text,text,uuid,uuid[],text),
  ops.complete_apify_run(text,text,text,numeric),ops.get_apify_run(text),ops.apify_runs_pending(uuid),
  ops.get_setting(text),ops.get_price_book(),ops.log_workflow_error(jsonb),ops.error_count_24h(text,boolean),
  ops.accrue_fixed_costs(date),ops.daily_health(),ops.process_apify_run(text,text,text,numeric,jsonb)
  from public,anon,authenticated,api_agent;
grant execute on function ops.log_cost(jsonb),ops.register_apify_run(text,text,uuid,uuid[],text),
  ops.complete_apify_run(text,text,text,numeric),ops.get_apify_run(text),ops.apify_runs_pending(uuid),
  ops.get_setting(text),ops.get_price_book(),ops.log_workflow_error(jsonb),ops.error_count_24h(text,boolean),
  ops.accrue_fixed_costs(date),ops.daily_health(),ops.process_apify_run(text,text,text,numeric,jsonb)
  to n8n_writer;
