-- M01 core pipeline only. Reference drafts remain unchanged.
-- Sources: https://supabase.com/docs/guides/database/functions
-- https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE
-- https://supabase.com/docs/guides/queues/pgmq

create function ops.start_run(p_workflow text, p_platform app.platform, p_mode text,
  p_env text, p_execution_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if nullif(btrim(p_workflow), '') is null or p_mode is null
     or p_mode not in ('daily','backfill','weekly','manual','removal_check')
     or p_env is null or p_env not in ('dev','prod') then
    raise exception using errcode='22023', message='invalid run parameters';
  end if;
  insert into ops.scrape_runs (workflow, platform, mode, env, n8n_execution_id)
  values (p_workflow, p_platform, p_mode, p_env, p_execution_id) returning id into v_id;
  return v_id;
end;
$$;

create function ops.finish_run(p_run_id uuid, p_status text, p_error text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run ops.scrape_runs%rowtype;
begin
  if p_status is null or p_status not in ('success','partial','failed') then
    raise exception using errcode='22023', message='invalid final run status';
  end if;
  select r.* into v_run from ops.scrape_runs r where r.id=p_run_id for update;
  if not found then raise exception using errcode='22023', message='unknown run'; end if;
  if v_run.status <> 'running' then
    if v_run.status <> p_status or v_run.error is distinct from p_error then
      raise exception using errcode='55000', message='run already finished with a different result';
    end if;
  else
    update ops.scrape_runs r set finished_at=now(), status=p_status, error=p_error,
      accounts_total=s.total, accounts_ok=s.ok, accounts_failed=s.failed,
      items_seen=s.seen, items_new=s.new,
      cost_usd=coalesce((select sum(l.cost_usd) from ops.cost_ledger l where l.run_id=p_run_id),0)
    from (select count(*)::int total, count(*) filter (where a.status='success')::int ok,
      count(*) filter (where a.status='failed')::int failed, coalesce(sum(a.items_seen),0)::int seen,
      coalesce(sum(a.items_new),0)::int new from ops.scrape_run_accounts a where a.run_id=p_run_id) s
    where r.id=p_run_id returning r.* into v_run;
  end if;
  return jsonb_build_object('run_id',v_run.id,'status',v_run.status,'accounts_total',v_run.accounts_total,
    'accounts_ok',v_run.accounts_ok,'accounts_failed',v_run.accounts_failed,
    'items_seen',v_run.items_seen,'items_new',v_run.items_new,'cost_usd',v_run.cost_usd);
end;
$$;

create function ops.get_due_accounts(p_platform app.platform, p_limit int, p_run_id uuid,
  p_mode text default 'daily')
returns table (account_id uuid, competitor_id uuid, competitor_slug text, handle text, url text,
  external_id text, uploads_playlist_id text, watermark_published_at timestamptz,
  watermark_external_id text, backfill_from date, backfill_cursor jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v_run ops.scrape_runs%rowtype;
begin
  if p_platform is null or p_limit is null or p_limit < 1 or p_limit > 1000
     or p_mode is null or p_mode not in ('daily','backfill','weekly','manual','removal_check') then
    raise exception using errcode='22023', message='invalid account claim parameters';
  end if;
  select r.* into v_run from ops.scrape_runs r where r.id=p_run_id for share;
  if not found then raise exception using errcode='22023', message='unknown run'; end if;
  if v_run.platform is distinct from
      (case when p_platform='website' then 'website_work_page'::app.platform else p_platform end) then
    raise exception using errcode='22023', message='run platform does not own this collection';
  end if;
  if v_run.status <> 'running' then raise exception using errcode='55000', message='run is not running'; end if;
  return query
  with due as (
    select a.id from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
    where a.platform=p_platform and a.status in ('active','failing') and c.status='active'
      and (a.locked_until is null or a.locked_until<=now())
      and (case when p_mode='backfill' then a.backfill_status in ('pending','running')
        and (a.consecutive_failures=0 or a.next_due_at<=now())
        else a.next_due_at<=now() and a.backfill_status in ('done','not_applicable') end)
      and not exists (select 1 from ops.scrape_run_accounts s where s.run_id=p_run_id and s.account_id=a.id)
    order by case c.priority_tier when 'baseline' then 0 when 'pilot' then 1 when 'next_wave' then 2 else 3 end,
      a.next_due_at, a.id
    limit p_limit for update of a skip locked
  ), claimed as (
    update app.competitor_accounts a set locked_until=now()+interval '2 hours',last_run_id=p_run_id,
      backfill_status=case when p_mode='backfill' then 'running'::app.backfill_status else a.backfill_status end,
      updated_at=now()
    from due d where a.id=d.id returning a.*
  )
  select a.id,a.competitor_id,c.slug,a.handle,a.url,a.external_id,a.uploads_playlist_id,
    a.last_item_published_at,a.last_external_id,a.backfill_from,a.backfill_cursor
  from claimed a join app.competitors c on c.id=a.competitor_id
  order by case c.priority_tier when 'baseline' then 0 when 'pilot' then 1 when 'next_wave' then 2 else 3 end,
    a.next_due_at,a.id;
end;
$$;

create function ops.report_account_result(p_run_id uuid, p_account_id uuid, p_status text,
  p_items_seen int, p_items_new int, p_error text default null, p_backfill_done boolean default false,
  p_backfill_cursor jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_run ops.scrape_runs%rowtype; v_account app.competitor_accounts%rowtype;
  v_result ops.scrape_run_accounts%rowtype;
begin
  if p_status is null or p_status not in ('success','failed','skipped')
     or p_items_seen is null or p_items_new is null or p_items_seen<0 or p_items_new<0
     or p_items_new>p_items_seen or p_backfill_done is null
     or (p_backfill_done and p_status<>'success') then
    raise exception using errcode='22023', message='invalid account result';
  end if;
  select r.* into v_run from ops.scrape_runs r where r.id=p_run_id for share;
  if not found then raise exception using errcode='22023', message='unknown run'; end if;
  select a.* into v_account from app.competitor_accounts a where a.id=p_account_id for update;
  if not found then raise exception using errcode='22023', message='unknown account'; end if;
  select s.* into v_result from ops.scrape_run_accounts s where s.run_id=p_run_id and s.account_id=p_account_id;
  if found then
    if v_result.status is distinct from p_status or v_result.items_seen is distinct from p_items_seen
       or v_result.items_new is distinct from p_items_new or v_result.error is distinct from p_error then
      raise exception using errcode='22023', message='account result already recorded with different values';
    end if;
    -- An identical receipt replay must not release a newer run's lease.
    return;
  end if;
  if v_run.platform is distinct from (case when v_account.platform='website'
      then 'website_work_page'::app.platform else v_account.platform end) then
    raise exception using errcode='22023', message='run platform does not own this collection';
  end if;
  if v_run.status<>'running' or v_account.last_run_id is distinct from p_run_id
     or v_account.locked_until is null or v_account.locked_until<=now() then
    raise exception using errcode='55000', message='account claim is absent, expired or owned by another run';
  end if;
  insert into ops.scrape_run_accounts (run_id,account_id,status,items_seen,items_new,error)
  values (p_run_id,p_account_id,p_status,p_items_seen,p_items_new,p_error);
  update app.competitor_accounts a set locked_until=null,
    last_success_at=case when p_status='success' then now() else a.last_success_at end,
    last_error_at=case when p_status='failed' then now() else a.last_error_at end,
    last_error=case when p_status='failed' then p_error when p_status='success' then null else a.last_error end,
    consecutive_failures=case when p_status='failed' then a.consecutive_failures+1
      when p_status='success' then 0 else a.consecutive_failures end,
    status=case when p_status='failed' and a.consecutive_failures+1>=3 and a.status='active' then 'failing'::app.account_status
      when p_status='success' and a.status='failing' then 'active'::app.account_status else a.status end,
    next_due_at=case when p_status='success' then now()+a.cadence-interval '4 hours' else now()+interval '6 hours' end,
    backfill_status=case when p_backfill_done then 'done'::app.backfill_status else a.backfill_status end,
    backfill_cursor=coalesce(nullif(p_backfill_cursor,'null'::jsonb),a.backfill_cursor),updated_at=now()
  where a.id=p_account_id;
end;
$$;

create function ingest.upsert_raw_items(p_run_id uuid, p_account_id uuid, p_items jsonb)
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
    perform pgmq.send_batch('media',array(select jsonb_build_object('item_id',x) from unnest(v_new) x));
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

create function ops.claim_queue_batch(p_queue text,p_n int,p_vt_seconds int default 600)
returns table (msg_id bigint,read_ct int,message jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if p_queue is null or p_queue not in ('ai_extract','embed','media') or p_n is null or p_n<1 or p_n>1000
    or p_vt_seconds is null or p_vt_seconds<1 or p_vt_seconds>86400 then
    raise exception using errcode='22023', message='invalid queue claim parameters';
  end if;
  return query select q.msg_id,q.read_ct,q.message from pgmq.read(p_queue,p_vt_seconds,p_n) q;
end;
$$;

create function ops.ack_queue(p_queue text,p_msg_ids bigint[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_queue is null or p_queue not in ('ai_extract','embed','media') or p_msg_ids is null
    or cardinality(p_msg_ids)>1000 or exists (select 1 from unnest(p_msg_ids) x where x is null or x<1) then
    raise exception using errcode='22023', message='invalid queue acknowledgement parameters';
  end if;
  if cardinality(p_msg_ids)>0 then perform pgmq.archive(p_queue,p_msg_ids); end if;
end;
$$;

create function ops.get_items_for_ai(p_item_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_item_ids is null or cardinality(p_item_ids)>1000 then
    raise exception using errcode='22023', message='invalid AI context item IDs';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'item',(to_jsonb(i)-'search_tsv')||jsonb_build_object('credits_text',r.normalized->'credits_text',
      'media_urls',coalesce(r.normalized->'media_urls','[]'::jsonb)),
    'competitor',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,'markets',c.markets,'categories',c.categories),
    'account',jsonb_build_object('platform',a.platform,'handle',a.handle),
    'alias_hints',(select coalesce(jsonb_agg(distinct jsonb_build_object('alias',oa.alias,'org_id',oa.org_id,
      'kind',o.kind,'name',o.name)),'[]'::jsonb) from app.org_aliases oa join app.organizations o on o.id=oa.org_id
      where oa.alias_normalized=any(select private.norm(m) from unnest(i.mentions||i.tagged_accounts||i.hashtags) m))
    ) order by array_position(p_item_ids,i.id)),'[]'::jsonb) into v_result
  from app.items i join app.competitors c on c.id=i.competitor_id
  left join app.competitor_accounts a on a.id=i.account_id
  left join ingest.raw_items r on r.platform=i.platform and r.external_id=i.external_id
  where i.id=any(p_item_ids);
  return v_result;
end;
$$;

create function ops.diff_website_urls(p_account_id uuid,p_urls text[])
returns text[] language plpgsql security definer set search_path = '' as $$
declare v_account app.competitor_accounts%rowtype; v_run ops.scrape_runs%rowtype; v_urls text[];
begin
  if p_urls is null or cardinality(p_urls)>1000 or exists
    (select 1 from unnest(p_urls) u where u is null or u!~*'^https?://[^[:space:]]+$') then
    raise exception using errcode='22023', message='invalid website URL list';
  end if;
  select a.* into v_account from app.competitor_accounts a where a.id=p_account_id for update;
  if not found then raise exception using errcode='22023', message='unknown account'; end if;
  if v_account.platform not in ('website','website_work_page') then
    raise exception using errcode='22023', message='account is not a website collection';
  end if;
  select r.* into v_run from ops.scrape_runs r where r.id=v_account.last_run_id for share;
  if not found or v_run.status<>'running' or v_run.platform is distinct from 'website_work_page'::app.platform
    or v_account.locked_until is null or v_account.locked_until<=now() then
    raise exception using errcode='55000', message='website account has no active collection claim';
  end if;
  if exists (select 1 from app.website_pages p where p.url=any(p_urls) and p.account_id<>p_account_id) then
    raise exception using errcode='22023', message='website URL belongs to another account';
  end if;
  update app.website_pages p set last_seen_at=now() where p.account_id=p_account_id and p.url=any(p_urls);
  insert into app.website_pages (account_id,competitor_id,url)
    select p_account_id,v_account.competitor_id,u from (select distinct unnest(p_urls) u) s order by u
    on conflict (url) do nothing;
  -- A concurrent account may win the global URL after the precheck. Re-read
  -- after the unique-key wait instead of silently reporting an empty diff.
  if exists (select 1 from app.website_pages p where p.url=any(p_urls) and p.account_id<>p_account_id) then
    raise exception using errcode='22023', message='website URL belongs to another account';
  end if;
  -- Discovery is not successful crawling. Retry pending/failed pages until the
  -- owning M05 writer records completion; preserve ignored/removed decisions.
  select coalesce(array_agg(p.url order by p.url),'{}') into v_urls from app.website_pages p
    where p.account_id=p_account_id and p.url=any(p_urls)
      and ((p.status='new' and p.crawled_at is null) or p.status='failed');
  return v_urls;
end;
$$;

-- Later-milestone writers (AI application, media, costs, removal, linking,
-- employee snapshots and website completion) deliberately have no stubs.
alter default privileges in schema ops,ingest revoke execute on functions from public;
-- Schema-specific defaults do not cancel a global default PUBLIC grant.
-- Every migration must explicitly revoke its new function privileges as here.
revoke execute on all functions in schema ops,ingest from public,anon,authenticated,api_agent;
grant execute on all functions in schema ops,ingest to n8n_writer;
