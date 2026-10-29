-- M07 text extraction. Local-only migration; no schedule, provider or hosted IO.
-- An attempt is the durable ownership/cost identity. A replay is not a new call.
create table ops.m07_ai_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  item_id uuid not null references app.items(id),
  msg_id bigint not null,
  reextract_nonce uuid,
  read_ct integer not null check(read_ct>0),
  lease_until timestamptz not null,
  state text not null default 'claimed' check(state in('claimed','prepared','dispatched','completed','failed','unknown')),
  model text,
  prompt_version text,
  schema_version text,
  price_snapshot jsonb,
  previous_ai_status app.ai_status,
  provider_response_id text,
  usage_known boolean not null default false,
  outcome text,
  payload_hash text,
  result jsonb,
  acked_at timestamptz,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  settled_at timestamptz
);
create index on ops.m07_ai_attempts(owner_id);
create index on ops.m07_ai_attempts(item_id);
create index on ops.m07_ai_attempts(msg_id);
create unique index m07_ai_reextract_nonce on ops.m07_ai_attempts(item_id,reextract_nonce) where reextract_nonce is not null;
create unique index m07_ai_one_unsettled_item on ops.m07_ai_attempts(item_id)
  where state in('claimed','prepared','dispatched','unknown');
create unique index m07_ai_provider_response_unique on ops.m07_ai_attempts(provider_response_id)
  where provider_response_id is not null;
alter table ops.m07_ai_attempts enable row level security;
revoke all on ops.m07_ai_attempts from public,anon,authenticated,n8n_writer,api_agent;

alter table ops.ai_extractions add column attempt_id uuid references ops.m07_ai_attempts(id);
create unique index ai_extractions_attempt_unique on ops.ai_extractions(attempt_id);
create unique index cost_ledger_ai_attempt_unique on ops.cost_ledger((meta->>'ai_attempt_id'))
  where provider='openai' and category='ai_extract' and meta ? 'ai_attempt_id';

-- Distinct items, rather than attempts, establish entity sightings.
create table ops.m07_entity_sightings (
  entity_type text not null check(entity_type in('organization','person')),
  entity_id uuid not null,
  item_id uuid not null references app.items(id),
  confidence numeric not null check(confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key(entity_type,entity_id,item_id)
);
create index on ops.m07_entity_sightings(item_id);
alter table ops.m07_entity_sightings enable row level security;
revoke all on ops.m07_entity_sightings from public,anon,authenticated,n8n_writer,api_agent;

create function private.norm_alias(t text) returns text
language sql immutable set search_path='' as $$
  select regexp_replace(translate(regexp_replace(lower(extensions.unaccent(coalesce(t,''))),
    '[ً-ٰٟـ]','','g'),'أإآةى','اااهي'),'[^[:alnum:]ء-ي]+','','g');
$$;

create function private.m07_review(p_kind app.review_kind,p_type text,p_id text,p_reason text,p_suggestion jsonb,p_priority int)
returns bigint language plpgsql set search_path='' as $$
declare result bigint;
begin
  select r.id into result from app.review_tasks r where r.kind=p_kind and r.entity_type=p_type
    and r.entity_id=p_id and r.status='open' order by r.id limit 1 for update;
  if result is null then
    insert into app.review_tasks(kind,entity_type,entity_id,reason,suggestion,priority)
      values(p_kind,p_type,p_id,p_reason,p_suggestion,p_priority) returning id into result;
  end if;
  return result;
end $$;

create function private.resolve_org(p_kind app.org_kind,p_name text,p_handle text,p_country app.country_code,
 p_industry text,p_confidence numeric,p_item_id uuid) returns uuid
language plpgsql set search_path='' as $$
declare result uuid; next_id uuid; n text:=private.norm_alias(p_name); h text:=private.norm_alias(p_handle);
  seen int; inserted int; depth int:=0; alias_text text; threshold numeric;
begin
  if n='' or length(p_name)>300 or p_confidence is null or p_confidence not between 0 and 1
    or not exists(select 1 from app.items where id=p_item_id) then
    raise exception using errcode='22023',message='invalid organization context'; end if;
  perform pg_advisory_xact_lock(hashtextextended('m07-org:'||p_kind::text||':'||coalesce(nullif(h,''),n),0));
  if h<>'' then
    select o.id into result from app.organizations o join app.org_aliases a on a.org_id=o.id
    where o.kind=p_kind and a.alias_normalized=h order by (o.status='confirmed') desc,o.id limit 1;
  end if;
  if result is null then
    select o.id into result from app.organizations o where o.kind=p_kind and
      (private.norm_alias(o.name)=n or private.norm_alias(o.name_ar)=n or exists(select 1 from app.org_aliases a where a.org_id=o.id and a.alias_normalized=n))
      order by (o.status='confirmed') desc,o.id limit 1;
  end if;
  if result is null then
    threshold:=coalesce((ops.get_setting('alias_trgm_min')#>>'{}')::numeric,0.6);
    select o.id into result from app.organizations o where o.kind=p_kind and
      extensions.similarity(private.norm_alias(o.name),n)>=threshold
      order by extensions.similarity(private.norm_alias(o.name),n) desc,o.id limit 1;
  end if;
  if result is null then
    result:=gen_random_uuid();
    insert into app.organizations(id,kind,name,slug,industry,country,status)
      values(result,p_kind,btrim(p_name),'ai-'||replace(result::text,'-',''),p_industry,p_country,'unconfirmed');
    perform private.m07_review(case when p_kind='brand' then 'new_brand'::app.review_kind else 'new_agency'::app.review_kind end,
      'organization',result::text,'new_ai_entity',jsonb_build_object('name',p_name,'handle',p_handle,'industry',p_industry,
      'country',p_country,'item_id',p_item_id,'kind',p_kind),case when p_kind='brand' then 50 else 80 end);
  end if;
  loop
    select merged_into into next_id from app.organizations where id=result for update;
    exit when next_id is null;
    result:=next_id; depth:=depth+1;
    if depth>16 then raise exception using errcode='22023',message='organization merge cycle'; end if;
  end loop;
  if (select kind from app.organizations where id=result)<>p_kind then
    raise exception using errcode='22023',message='organization merge kind mismatch'; end if;
  insert into ops.m07_entity_sightings(entity_type,entity_id,item_id,confidence)
    values('organization',result,p_item_id,p_confidence) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
    update app.organizations set seen_count=seen_count+1 where id=result returning seen_count into seen;
    if seen>=2 and p_confidence>=0.9 and exists(select 1 from ops.m07_entity_sightings where entity_type='organization' and entity_id=result and item_id<>p_item_id) then
      update app.organizations set status='confirmed' where id=result and status='unconfirmed';
      update app.review_tasks set status='approved',resolution=jsonb_build_object('auto',true),resolved_at=now()
        where entity_type='organization' and entity_id=result::text and kind in('new_brand','new_agency') and status='open'
          and exists(select 1 from app.organizations where id=result and status='confirmed');
    end if;
  end if;
  foreach alias_text in array array[p_name,p_handle] loop
    if private.norm_alias(alias_text)<>'' then
      insert into app.org_aliases(org_id,alias,alias_normalized,source)
        values(result,alias_text,private.norm_alias(alias_text),'ai') on conflict do nothing;
    end if;
  end loop;
  return result;
end $$;

create function private.resolve_person(p_name text,p_role text,p_item_id uuid) returns uuid
language plpgsql set search_path='' as $$
declare result uuid; next_id uuid; n text:=private.norm_alias(p_name); depth int:=0; threshold numeric;
begin
  if n='' or length(p_name)>300 or not exists(select 1 from app.items where id=p_item_id) then
    raise exception using errcode='22023',message='invalid person context'; end if;
  perform pg_advisory_xact_lock(hashtextextended('m07-person:'||n,0));
  select p.id into result from app.people p where private.norm_alias(p.name)=n or private.norm_alias(p.name_ar)=n or exists
    (select 1 from app.person_aliases a where a.person_id=p.id and a.alias_normalized=n)
    order by (p.status='confirmed') desc,p.id limit 1;
  if result is null then
    threshold:=coalesce((ops.get_setting('alias_trgm_min')#>>'{}')::numeric,0.6);
    select p.id into result from app.people p where extensions.similarity(private.norm_alias(p.name),n)>=threshold
      order by extensions.similarity(private.norm_alias(p.name),n) desc,p.id limit 1;
  end if;
  if result is null then
    result:=gen_random_uuid();
    insert into app.people(id,name,slug,primary_role) values(result,btrim(p_name),'ai-'||replace(result::text,'-',''),p_role);
    perform private.m07_review('new_person','person',result::text,'new_ai_person',
      jsonb_build_object('name',p_name,'role',p_role,'item_id',p_item_id),120);
  end if;
  loop
    select merged_into into next_id from app.people where id=result for update;
    exit when next_id is null;
    result:=next_id; depth:=depth+1;
    if depth>16 then raise exception using errcode='22023',message='person merge cycle'; end if;
  end loop;
  insert into app.person_aliases(person_id,alias,alias_normalized,source) values(result,p_name,n,'ai') on conflict do nothing;
  insert into ops.m07_entity_sightings(entity_type,entity_id,item_id,confidence) values('person',result,p_item_id,1) on conflict do nothing;
  return result;
end $$;

create function ops.get_taxonomy_snapshot() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(t.taxonomy,t.codes),'{}'::jsonb) from
    (select taxonomy,jsonb_agg(code order by sort,code) codes from app.taxonomy_terms where active group by taxonomy) t;
$$;

create or replace function ops.get_items_for_ai(p_item_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_item_ids is null or cardinality(p_item_ids)>1000 or array_position(p_item_ids,null) is not null then
    raise exception using errcode='22023',message='invalid AI context item IDs'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('item',(to_jsonb(i)-'search_tsv')||jsonb_build_object(
      'caption_original',left(i.caption_original,6000),'credits_text',left(r.normalized->>'credits_text',6000),
      'markdown',left(coalesce(r.normalized->>'markdown',r.normalized->>'description'),6000),
      'media_urls',coalesce(r.normalized->'media_urls','[]'::jsonb)),
    'competitor',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,'markets',c.markets,'categories',c.categories),
    'account',jsonb_build_object('id',a.id,'platform',a.platform,'handle',a.handle),
    'alias_hints',(select coalesce(jsonb_agg(distinct jsonb_build_object('alias',oa.alias,'org_id',o.id,
      'kind',o.kind,'name',o.name)),'[]'::jsonb) from app.org_aliases oa join app.organizations o on o.id=oa.org_id
      where oa.alias_normalized=any(select private.norm_alias(m) from unnest(i.mentions||i.tagged_accounts||i.hashtags) m))
    ) order by array_position(p_item_ids,i.id)),'[]'::jsonb) into result
  from app.items i join app.competitors c on c.id=i.competitor_id
  left join app.competitor_accounts a on a.id=i.account_id
  left join ingest.raw_items r on r.platform=i.platform and r.external_id=i.external_id
  where i.id=any(p_item_ids);
  return result;
end $$;

create function private.m07_attempt_receipt(a ops.m07_ai_attempts) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('attempt_id',a.id,'owner_id',a.owner_id,'item_id',a.item_id,'msg_id',a.msg_id,
   'read_ct',a.read_ct,'state',a.state,'result',a.result,'acked',a.acked_at is not null,
   'usage_known',a.usage_known,'outcome',a.outcome,
   'config',jsonb_build_object('model',a.model,'prompt_version',a.prompt_version,'schema_version',a.schema_version));
$$;

create function ops.m07_claim_ai(p_owner_id uuid,p_limit integer default 1,p_visibility_seconds integer default 600)
returns jsonb language plpgsql security definer set search_path='' as $$
declare messages jsonb; q record; old ops.m07_ai_attempts%rowtype; a ops.m07_ai_attempts%rowtype; item uuid; nonce uuid;
begin
  if p_owner_id is null or p_limit is null or p_limit<1 or p_limit>20 or p_visibility_seconds is null
    or p_visibility_seconds<120 or p_visibility_seconds>3600 then
    raise exception using errcode='22023',message='invalid AI claim'; end if;
  perform pg_advisory_xact_lock(hashtextextended('m07-owner:'||p_owner_id::text,0));
  select jsonb_agg(private.m07_attempt_receipt(x) order by x.msg_id) into messages
    from ops.m07_ai_attempts x where owner_id=p_owner_id;
  if messages is not null then return jsonb_build_object('owner_id',p_owner_id,'messages',messages,'replayed',true); end if;
  messages:='[]'::jsonb;
  for q in select * from pgmq.read('ai_extract',p_visibility_seconds,p_limit) loop
    if jsonb_typeof(q.message)<>'object' or coalesce(q.message->>'item_id','')!~'^[0-9a-fA-F-]{36}$' then
      raise exception using errcode='22023',message='invalid AI delivery'; end if;
    item:=(q.message->>'item_id')::uuid;
    nonce:=null;
    if q.message ? 'reextract' or q.message ? 'reextract_nonce' then
      if q.message->'reextract' is distinct from 'true'::jsonb or coalesce(q.message->>'reextract_nonce','')!~'^[0-9a-fA-F-]{36}$' then
        raise exception using errcode='22023',message='explicit AI re-extraction intent missing'; end if;
      nonce:=(q.message->>'reextract_nonce')::uuid;
    end if;
    perform pg_advisory_xact_lock(hashtextextended('m07-item:'||item::text,0));
    select * into old from ops.m07_ai_attempts x where (x.msg_id=q.msg_id and x.state in('completed','failed')) or
      (x.item_id=item and (x.state in('claimed','prepared','dispatched','unknown') or
        (nonce is null and x.state in('completed','failed')) or (nonce is not null and x.reextract_nonce=nonce)))
      order by x.created_at desc,x.id limit 1 for update;
    if found then
      if old.state='completed' then
        perform pgmq.archive('ai_extract',q.msg_id);
        if old.msg_id=q.msg_id then update ops.m07_ai_attempts set acked_at=coalesce(acked_at,now()) where id=old.id; end if;
        messages:=messages||jsonb_build_array(private.m07_attempt_receipt(old)||jsonb_build_object('state','reconciled','acked',true));
      else
        messages:=messages||jsonb_build_array(jsonb_build_object('attempt_id',old.id,'owner_id',old.owner_id,'item_id',item,
          'msg_id',q.msg_id,'read_ct',q.read_ct,'state','held','result',old.result,'acked',false));
      end if;
      continue;
    end if;
    if not exists(select 1 from app.items i join app.competitors c on c.id=i.competitor_id where i.id=item
      and i.status='active' and i.ai_status<>'duplicate' and c.status='active') then
      raise exception using errcode='42501',message='AI delivery item unavailable'; end if;
    insert into ops.m07_ai_attempts(owner_id,item_id,msg_id,read_ct,lease_until,reextract_nonce)
      values(p_owner_id,item,q.msg_id,q.read_ct,now()+make_interval(secs=>p_visibility_seconds),nonce) returning * into a;
    messages:=messages||jsonb_build_array(private.m07_attempt_receipt(a));
  end loop;
  return jsonb_build_object('owner_id',p_owner_id,'messages',messages,'replayed',false);
end $$;

create function ops.m07_prepare_ai(p_attempt_id uuid,p_owner_id uuid,p_model text,p_prompt_version text,p_schema_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype; context jsonb; prices jsonb;
begin
  select * into a from ops.m07_ai_attempts where id=p_attempt_id for update;
  if not found or a.owner_id is distinct from p_owner_id then raise exception using errcode='42501',message='AI attempt owner mismatch'; end if;
  if p_model is null or p_model!~'^[A-Za-z0-9_.:-]{1,120}$' or p_prompt_version is distinct from 'extract_item.v1'
    or p_schema_version is distinct from 'item_extraction.v1' then raise exception using errcode='22023',message='invalid AI configuration'; end if;
  if a.model is not null and (a.model<>p_model or a.prompt_version<>p_prompt_version or a.schema_version<>p_schema_version) then
    raise exception using errcode='22023',message='AI attempt configuration changed'; end if;
  if a.state='claimed' then
    if a.lease_until<=now() then raise exception using errcode='55000',message='AI claim expired before dispatch'; end if;
    prices:=ops.get_price_book();
    if not (prices ? ('openai/'||p_model||':input')) or not (prices ? ('openai/'||p_model||':output')) or exists(
      select 1 from unnest(array['input','output','cached_input']) sku where prices ? ('openai/'||p_model||':'||sku)
      and (jsonb_typeof(prices->('openai/'||p_model||':'||sku)->'usd') is distinct from 'number'
        or (prices->('openai/'||p_model||':'||sku)->>'usd')::numeric<0
        or coalesce(prices->('openai/'||p_model||':'||sku)->>'unit','') not in('1M tokens','1000000 tokens'))) then
      raise exception using errcode='22023',message='AI price unavailable'; end if;
    update ops.m07_ai_attempts set model=p_model,prompt_version=p_prompt_version,schema_version=p_schema_version,
      price_snapshot=prices,previous_ai_status=(select ai_status from app.items where id=a.item_id),state='prepared'
      where id=a.id returning * into a;
    update app.items set ai_status='processing' where id=a.item_id and not ('ai_status'=any(locked_fields));
  end if;
  context:=ops.get_items_for_ai(array[a.item_id])->0;
  return private.m07_attempt_receipt(a)||jsonb_build_object('context',context,'taxonomy',ops.get_taxonomy_snapshot(),'prices',a.price_snapshot);
end $$;

create function ops.m07_dispatch_ai(p_attempt_id uuid,p_owner_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype; admitted boolean:=false;
begin
  select * into a from ops.m07_ai_attempts where id=p_attempt_id for update;
  if not found or a.owner_id is distinct from p_owner_id then raise exception using errcode='42501',message='AI attempt owner mismatch'; end if;
  if a.state='prepared' then
    if a.lease_until<=now() then raise exception using errcode='55000',message='AI claim expired before dispatch'; end if;
    update ops.m07_ai_attempts set state='dispatched',dispatched_at=now() where id=a.id returning * into a;admitted:=true;
  end if;
  return jsonb_build_object('attempt_id',a.id,'state',a.state,'admitted',admitted);
end $$;

create function ops.m07_ai_status(p_attempt_id uuid,p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype;
begin
  select * into a from ops.m07_ai_attempts where id=p_attempt_id;
  if not found or a.owner_id is distinct from p_owner_id then raise exception using errcode='42501',message='AI attempt owner mismatch'; end if;
  return private.m07_attempt_receipt(a);
end $$;

create function private.m07_known_cost(a ops.m07_ai_attempts,m jsonb) returns numeric
language plpgsql stable set search_path='' as $$
declare tin int; tout int; cached int; ip numeric; op numeric; cp numeric; result numeric;
begin
  if m is null or jsonb_typeof(m)<>'object' or not(m ?& array['attempt_id','owner_id','model','prompt_version','schema_version',
      'provider_response_id','input_tokens','output_tokens','cached_tokens','cost_usd','usage_known','used_vision','latency_ms','accounting_mode'])
    or exists(select 1 from jsonb_object_keys(m) k where k<>all(array['attempt_id','owner_id','model','prompt_version','schema_version',
      'provider_response_id','input_tokens','output_tokens','cached_tokens','cost_usd','usage_known','used_vision','latency_ms','accounting_mode']))
    or m->>'model' is distinct from a.model or m->>'prompt_version' is distinct from a.prompt_version
    or m->>'schema_version' is distinct from a.schema_version or m->>'attempt_id' is distinct from a.id::text
    or m->>'owner_id' is distinct from a.owner_id::text or m->'usage_known' is distinct from 'true'::jsonb
    or m->'used_vision' is distinct from 'false'::jsonb or coalesce(m->>'accounting_mode','') not in('simulated','provider')
    or coalesce(m->>'provider_response_id','')!~'^[A-Za-z0-9_-]{1,200}$'
    or exists(select 1 from unnest(array['input_tokens','output_tokens','cached_tokens','cost_usd','latency_ms']) k
      where jsonb_typeof(m->k)<>'number' or not(m ? k)) then
    raise exception using errcode='22023',message='invalid AI usage metadata'; end if;
  if (m->>'input_tokens')::numeric not between 0 and 2147483647 or (m->>'output_tokens')::numeric not between 0 and 2147483647
    or (m->>'cached_tokens')::numeric not between 0 and (m->>'input_tokens')::numeric
    or (m->>'latency_ms')::numeric not between 0 and 86400000
    or exists(select 1 from unnest(array['input_tokens','output_tokens','cached_tokens','latency_ms']) k
      where trunc((m->>k)::numeric)<>(m->>k)::numeric) then
    raise exception using errcode='22023',message='invalid AI usage quantities'; end if;
  tin:=(m->>'input_tokens')::int;tout:=(m->>'output_tokens')::int;cached:=(m->>'cached_tokens')::int;
  ip:=(a.price_snapshot->('openai/'||a.model||':input')->>'usd')::numeric;
  op:=(a.price_snapshot->('openai/'||a.model||':output')->>'usd')::numeric;
  cp:=(a.price_snapshot->('openai/'||a.model||':cached_input')->>'usd')::numeric;
  if ip is null or op is null or ip<0 or op<0 or (cached>0 and(cp is null or cp<0)) then
    raise exception using errcode='22023',message='AI price unavailable'; end if;
  result:=round(((tin-cached)*ip+cached*coalesce(cp,0)+tout*op)/1000000,6);
  if round((m->>'cost_usd')::numeric,6)<>result then raise exception using errcode='22023',message='AI cost mismatch'; end if;
  return result;
end $$;

create function private.m07_validate_result(r jsonb) returns void
language plpgsql stable set search_path='' as $$
declare k text; credit jsonb; allowed text[]:=array['is_commercial_work','content_type','brand','agency','production_house','credits',
  'campaign_title','country','language','occasion','summary_en','summary_ar','caption_en','tags','needs_vision','confidence','evidence'];
begin
  if r is null or jsonb_typeof(r)<>'object' or not(r ?& allowed) or (select count(*) from jsonb_object_keys(r))<>cardinality(allowed)
    or jsonb_typeof(r->'is_commercial_work') not in('boolean','null') or jsonb_typeof(r->'needs_vision')<>'boolean'
    or jsonb_typeof(r->'content_type')<>'string' or jsonb_typeof(r->'summary_en')<>'string' or jsonb_typeof(r->'summary_ar')<>'string'
    or jsonb_typeof(r->'tags')<>'array' or jsonb_array_length(r->'tags')>8 or jsonb_typeof(r->'credits')<>'array'
    or jsonb_array_length(r->'credits')>100 or jsonb_typeof(r->'confidence')<>'object' or jsonb_typeof(r->'evidence')<>'object'
    or jsonb_typeof(r->'production_house')<>'object' then raise exception using errcode='22023',message='invalid extraction schema'; end if;
  foreach k in array array['campaign_title','caption_en','occasion','country','language'] loop
    if jsonb_typeof(r->k) not in('string','null') then raise exception using errcode='22023',message='invalid extraction text'; end if;
  end loop;
  if not exists(select 1 from app.taxonomy_terms where taxonomy='content_format' and code=r->>'content_type' and active)
    or (r->>'occasion' is not null and not exists(select 1 from app.taxonomy_terms where taxonomy='occasion' and code=r->>'occasion' and active))
    or (r->>'country' is not null and r->>'country' not in('EG','KSA','UAE','OTHER'))
    or (r->>'language' is not null and r->>'language' not in('ar','en','mixed','other')) then
    raise exception using errcode='22023',message='invalid extraction taxonomy'; end if;
  if exists(select 1 from jsonb_array_elements(r->'tags') x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>200)
    or length(r->>'summary_en')>6000 or length(r->>'summary_ar')>6000 or length(r->>'caption_en')>6000 then
    raise exception using errcode='22023',message='invalid extraction bounds'; end if;
  allowed:=array['overall','is_commercial_work','brand','agency','production_house','credits','content_type','country','occasion'];
  if not(r->'confidence' ?& allowed) or (select count(*) from jsonb_object_keys(r->'confidence'))<>cardinality(allowed)
    or exists(select 1 from jsonb_each(r->'confidence') e where jsonb_typeof(e.value)<>'number' or (e.value#>>'{}')::numeric not between 0 and 1) then
    raise exception using errcode='22023',message='invalid extraction confidence'; end if;
  if not(r->'evidence' ?& array['brand','agency','credits','production_house']) or
    (select count(*) from jsonb_object_keys(r->'evidence'))<>4 or exists(select 1 from jsonb_each(r->'evidence') e where jsonb_typeof(e.value) not in('string','null')) then
    raise exception using errcode='22023',message='invalid extraction evidence'; end if;
  if not(r->'production_house' ?& array['is_posting_competitor','other_name']) or
    (select count(*) from jsonb_object_keys(r->'production_house'))<>2 or jsonb_typeof(r#>'{production_house,is_posting_competitor}')<>'boolean'
    or jsonb_typeof(r#>'{production_house,other_name}') not in('string','null') then
    raise exception using errcode='22023',message='invalid production context'; end if;
  foreach k in array array['brand','agency'] loop
    if r->k<>'null'::jsonb then
      allowed:=case when k='brand' then array['name','handle','industry','country'] else array['name','handle'] end;
      if jsonb_typeof(r->k)<>'object' or not(r->k ?& allowed) or (select count(*) from jsonb_object_keys(r->k))<>cardinality(allowed)
        or jsonb_typeof(r#>array[k,'name'])<>'string' or private.norm_alias(r#>>array[k,'name'])=''
        or length(r#>>array[k,'name'])>300 or jsonb_typeof(r#>array[k,'handle']) not in('string','null') then
        raise exception using errcode='22023',message='invalid extraction entity'; end if;
      if k='brand' and (jsonb_typeof(r#>'{brand,country}') not in('string','null') or jsonb_typeof(r#>'{brand,industry}') not in('string','null')
        or (r#>>'{brand,country}' is not null and r#>>'{brand,country}' not in('EG','KSA','UAE','OTHER'))
        or (r#>>'{brand,industry}' is not null and not exists(select 1 from app.taxonomy_terms where taxonomy='industry' and code=r#>>'{brand,industry}' and active))) then
        raise exception using errcode='22023',message='invalid brand taxonomy'; end if;
    end if;
  end loop;
  for credit in select value from jsonb_array_elements(r->'credits') loop
    if jsonb_typeof(credit)<>'object' or not(credit ?& array['person_name','role','organization'])
      or (select count(*) from jsonb_object_keys(credit))<>3 or jsonb_typeof(credit->'person_name')<>'string'
      or private.norm_alias(credit->>'person_name')='' or length(credit->>'person_name')>300
      or jsonb_typeof(credit->'organization') not in('string','null') or jsonb_typeof(credit->'role')<>'string' or not exists(select 1 from app.taxonomy_terms
        where taxonomy='credit_role' and code=credit->>'role' and active) then
      raise exception using errcode='22023',message='invalid extraction credit'; end if;
  end loop;
end $$;

create function ops.apply_extraction(p_item_id uuid,p_result jsonb,p_meta jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype; i app.items%rowtype; digest text; cost numeric; extraction bigint;
  brand uuid; agency uuid; production uuid; person uuid; organization uuid; competitor uuid; c jsonb;
  v_status app.ai_status; reason text; threshold numeric; v_confidence numeric; reviews jsonb; v_result jsonb;
begin
  select * into a from ops.m07_ai_attempts where id=(p_meta->>'attempt_id')::uuid for update;
  if not found or a.owner_id::text is distinct from p_meta->>'owner_id' or a.item_id is distinct from p_item_id then
    raise exception using errcode='42501',message='AI attempt ownership mismatch'; end if;
  digest:=encode(extensions.digest(jsonb_build_object('result',p_result,'meta',p_meta)::text,'sha256'),'hex');
  if a.state='completed' then
    if a.payload_hash<>digest then raise exception using errcode='22023',message='AI attempt payload changed'; end if;
    return jsonb_build_object('attempt_id',a.id,'state',a.state,'replayed',true,'result',a.result);
  end if;
  if a.state not in('dispatched','unknown') then raise exception using errcode='55000',message='AI attempt not dispatched'; end if;
  perform private.m07_validate_result(p_result);
  cost:=private.m07_known_cost(a,p_meta);
  select * into i from app.items where id=p_item_id for update;
  if i.status<>'active' or i.ai_status='duplicate' then raise exception using errcode='42501',message='AI item unavailable'; end if;
  v_confidence:=(p_result#>>'{confidence,overall}')::numeric;
  threshold:=coalesce((ops.get_setting('auto_publish_threshold')#>>'{}')::numeric,0.8);
  v_status:=case when (p_result->>'needs_vision')::boolean then 'review'::app.ai_status
    when v_confidence>=threshold and p_result->'is_commercial_work'='true'::jsonb then 'published'::app.ai_status
    when v_confidence>=threshold and p_result->'is_commercial_work'='false'::jsonb then 'skipped'::app.ai_status
    else 'review'::app.ai_status end;
  if v_status='review' then
    reason:=case when (p_result->>'needs_vision')::boolean then 'vision_pending' else
      (select key from jsonb_each(p_result->'confidence') e order by (value#>>'{}')::numeric,key limit 1) end;
    perform private.m07_review('item_low_confidence','item',p_item_id::text,reason,
      jsonb_build_object('attempt_id',a.id,'confidence',p_result->'confidence'),100);
  end if;
  brand:=i.brand_id;agency:=i.agency_id;production:=i.production_competitor_id;
  if not('brand_id'=any(i.locked_fields)) then
    brand:=null;
    if p_result->'brand'<>'null'::jsonb then brand:=private.resolve_org('brand',p_result#>>'{brand,name}',p_result#>>'{brand,handle}',
      (p_result#>>'{brand,country}')::app.country_code,p_result#>>'{brand,industry}',(p_result#>>'{confidence,brand}')::numeric,p_item_id);end if;
  end if;
  if not('agency_id'=any(i.locked_fields)) then
    agency:=null;
    if p_result->'agency'<>'null'::jsonb then agency:=private.resolve_org('agency',p_result#>>'{agency,name}',p_result#>>'{agency,handle}',
      null,null,(p_result#>>'{confidence,agency}')::numeric,p_item_id);end if;
  end if;
  if not('production_competitor_id'=any(i.locked_fields)) then
    production:=i.competitor_id;
    if not (p_result#>>'{production_house,is_posting_competitor}')::boolean then
      select x.id into competitor from app.competitors x where x.status='active' and
        (private.norm_alias(x.name)=private.norm_alias(p_result#>>'{production_house,other_name}')
        or private.norm_alias(x.name_ar)=private.norm_alias(p_result#>>'{production_house,other_name}')
        or exists(select 1 from unnest(x.aliases) alias where private.norm_alias(alias)=private.norm_alias(p_result#>>'{production_house,other_name}')))
        order by x.id limit 1;
      if competitor is not null then production:=competitor;
      else perform private.m07_review('item_low_confidence','item',p_item_id::text,'production_house_unresolved',
        jsonb_build_object('name',p_result#>>'{production_house,other_name}','attempt_id',a.id),100);end if;
    end if;
  end if;
  if not(i.locked_fields&&array['credits','item_credits']) then
    if production is not null and production<>i.competitor_id then
      insert into app.item_credits(item_id,person_name_raw,role,competitor_id,source,confidence)
        values(p_item_id,(select name from app.competitors where id=production),'production_company',production,'ai',
        (p_result#>>'{confidence,production_house}')::numeric) on conflict(item_id,person_name_raw,role) do nothing;
    end if;
    for c in select value from jsonb_array_elements(p_result->'credits') loop
      person:=private.resolve_person(c->>'person_name',c->>'role',p_item_id);organization:=null;competitor:=null;
      if private.norm_alias(c->>'organization')<>'' then
        select x.id into competitor from app.competitors x where private.norm_alias(x.name)=private.norm_alias(c->>'organization')
          or exists(select 1 from unnest(x.aliases) alias where private.norm_alias(alias)=private.norm_alias(c->>'organization')) order by x.id limit 1;
        if competitor is null then organization:=private.resolve_org(case when c->>'role' in('editor','colourist','post_production_house','vfx_cgi_studio')
          then 'post_house'::app.org_kind else 'other'::app.org_kind end,c->>'organization',null,null,null,
          (p_result#>>'{confidence,credits}')::numeric,p_item_id);end if;
      end if;
      insert into app.item_credits(item_id,person_id,person_name_raw,role,organization_id,competitor_id,source,confidence)
        values(p_item_id,person,c->>'person_name',c->>'role',organization,competitor,'ai',(p_result#>>'{confidence,credits}')::numeric)
        on conflict(item_id,person_name_raw,role) do update set person_id=excluded.person_id,organization_id=excluded.organization_id,
          competitor_id=excluded.competitor_id,confidence=excluded.confidence where app.item_credits.source='ai';
    end loop;
  end if;
  insert into ops.ai_extractions(item_id,schema_version,prompt_version,model,input_tokens,output_tokens,cost_usd,used_vision,latency_ms,output,confidence,attempt_id)
    values(p_item_id,a.schema_version,a.prompt_version,a.model,(p_meta->>'input_tokens')::int,(p_meta->>'output_tokens')::int,cost,false,
      (p_meta->>'latency_ms')::int,p_result,v_confidence,a.id) returning id into extraction;
  update app.items set
    is_commercial_work=case when 'is_commercial_work'=any(locked_fields) then is_commercial_work else (p_result->>'is_commercial_work')::boolean end,
    content_type=case when 'content_type'=any(locked_fields) then content_type else p_result->>'content_type' end,
    brand_id=brand,agency_id=agency,production_competitor_id=production,
    country=case when 'country'=any(locked_fields) then country else (p_result->>'country')::app.country_code end,
    language=case when 'language'=any(locked_fields) then language else p_result->>'language' end,
    occasion=case when 'occasion'=any(locked_fields) then occasion else p_result->>'occasion' end,
    campaign_title=case when 'campaign_title'=any(locked_fields) then campaign_title else p_result->>'campaign_title' end,
    summary_en=case when 'summary_en'=any(locked_fields) then summary_en else p_result->>'summary_en' end,
    summary_ar=case when 'summary_ar'=any(locked_fields) then summary_ar else p_result->>'summary_ar' end,
    caption_en=case when 'caption_en'=any(locked_fields) then caption_en else p_result->>'caption_en' end,
    tags=case when 'tags'=any(locked_fields) then tags else array(select jsonb_array_elements_text(p_result->'tags')) end,
    confidence=case when 'confidence'=any(locked_fields) then app.items.confidence else v_confidence end,
    field_confidence=case when 'field_confidence'=any(locked_fields) then field_confidence else p_result->'confidence' end,
    evidence=case when 'evidence'=any(locked_fields) then evidence else p_result->'evidence' end,
    ai_status=case when 'ai_status'=any(locked_fields) then ai_status else v_status end,
    last_extraction_id=case when 'last_extraction_id'=any(locked_fields) then last_extraction_id else extraction end
    where id=p_item_id;
  insert into ops.cost_ledger(provider,category,quantity,unit,cost_usd,item_id,competitor_id,platform,meta)
    values('openai','ai_extract',(p_meta->>'input_tokens')::numeric+(p_meta->>'output_tokens')::numeric,'token',cost,p_item_id,i.competitor_id,i.platform,
      p_meta||jsonb_build_object('ai_attempt_id',a.id,'extraction_id',extraction));
  perform pgmq.send('embed',jsonb_build_object('entity_type','item','entity_id',p_item_id,'attempt_id',a.id));
  select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into reviews from app.review_tasks where status='open' and
    ((entity_type='item' and entity_id=p_item_id::text) or (entity_type='organization' and entity_id in(brand::text,agency::text))
      or exists(select 1 from ops.m07_entity_sightings s where s.item_id=p_item_id
        and s.entity_type=app.review_tasks.entity_type and s.entity_id::text=app.review_tasks.entity_id));
  select jsonb_build_object('attempt_id',a.id,'extraction_id',extraction,'ai_status',ai_status,'brand_id',brand_id,'agency_id',agency_id,
    'production_competitor_id',production_competitor_id,'review_task_ids',reviews,'confidence',app.items.confidence,'cost_usd',cost,
    'accounting_mode',p_meta->>'accounting_mode') into v_result from app.items where id=p_item_id;
  update ops.m07_ai_attempts set state='completed',provider_response_id=p_meta->>'provider_response_id',usage_known=true,
    outcome='applied',payload_hash=digest,result=v_result,settled_at=now() where id=a.id;
  return jsonb_build_object('attempt_id',a.id,'state','completed','replayed',false,'result',v_result);
end $$;

create function ops.m07_fail_ai(p_attempt_id uuid,p_owner_id uuid,p_outcome text,p_meta jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype; digest text; cost numeric; i app.items%rowtype; v_result jsonb;
begin
  select * into a from ops.m07_ai_attempts where id=p_attempt_id for update;
  if not found or a.owner_id is distinct from p_owner_id then raise exception using errcode='42501',message='AI attempt owner mismatch'; end if;
  if p_outcome is null or p_outcome not in('invalid_response','refused','incomplete','unknown') or p_meta is null
    or jsonb_typeof(p_meta)<>'object' or not(p_meta ?& array['attempt_id','owner_id','model','prompt_version','schema_version',
      'provider_response_id','input_tokens','output_tokens','cached_tokens','cost_usd','usage_known','used_vision','latency_ms','accounting_mode'])
    or exists(select 1 from jsonb_object_keys(p_meta) k where k<>all(array['attempt_id','owner_id','model','prompt_version','schema_version',
      'provider_response_id','input_tokens','output_tokens','cached_tokens','cost_usd','usage_known','used_vision','latency_ms','accounting_mode']))
    or p_meta->>'attempt_id' is distinct from a.id::text
    or p_meta->>'owner_id' is distinct from a.owner_id::text or p_meta->>'model' is distinct from a.model
    or p_meta->>'prompt_version' is distinct from a.prompt_version or p_meta->>'schema_version' is distinct from a.schema_version
    or p_meta->'used_vision' is distinct from 'false'::jsonb or coalesce(p_meta->>'accounting_mode','') not in('simulated','provider') then
    raise exception using errcode='22023',message='invalid AI failure'; end if;
  digest:=encode(extensions.digest(jsonb_build_object('outcome',p_outcome,'meta',p_meta)::text,'sha256'),'hex');
  if a.state in('failed','completed') or (a.state='unknown' and a.payload_hash is not null) then
    if a.payload_hash<>digest then raise exception using errcode='22023',message='AI attempt payload changed'; end if;
    return jsonb_build_object('attempt_id',a.id,'state',a.state,'replayed',true,'result',a.result);
  end if;
  if a.state not in('dispatched','unknown') then raise exception using errcode='55000',message='AI attempt not dispatched'; end if;
  select * into i from app.items where id=a.item_id for update;
  if p_outcome<>'unknown' and p_meta->'usage_known'='true'::jsonb then
    cost:=private.m07_known_cost(a,p_meta);
    insert into ops.cost_ledger(provider,category,quantity,unit,cost_usd,item_id,competitor_id,platform,meta)
      values('openai','ai_extract',(p_meta->>'input_tokens')::numeric+(p_meta->>'output_tokens')::numeric,'token',cost,a.item_id,i.competitor_id,i.platform,
        p_meta||jsonb_build_object('ai_attempt_id',a.id,'outcome',p_outcome));
  elsif p_meta->'usage_known' is distinct from 'false'::jsonb then
    raise exception using errcode='22023',message='AI unknown usage must be explicit';
  elsif exists(select 1 from unnest(array['input_tokens','output_tokens','cached_tokens','cost_usd','provider_response_id']) k
      where not(p_meta ? k) or p_meta->k is distinct from 'null'::jsonb) then
    raise exception using errcode='22023',message='AI unknown usage cannot claim quantities';
  end if;
  v_result:=jsonb_build_object('attempt_id',a.id,'outcome',p_outcome,'usage_known',cost is not null,'cost_usd',cost,
    'accounting_mode',p_meta->>'accounting_mode','held',p_outcome='unknown' or cost is null);
  update ops.m07_ai_attempts set state=case when p_outcome='unknown' or cost is null then 'unknown' else 'failed' end,
    provider_response_id=case when cost is not null then p_meta->>'provider_response_id' else null end,
    usage_known=cost is not null,outcome=p_outcome,payload_hash=digest,result=v_result,settled_at=now() where id=a.id;
  if p_outcome<>'unknown' and cost is not null then
    update app.items set ai_status=coalesce(a.previous_ai_status,'pending') where id=a.item_id and not('ai_status'=any(locked_fields));
  end if;
  return jsonb_build_object('attempt_id',a.id,'state',case when p_outcome='unknown' or cost is null then 'unknown' else 'failed' end,
    'replayed',false,'result',v_result);
end $$;

create function ops.m07_ack_ai(p_attempt_id uuid,p_owner_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype;
begin
  select * into a from ops.m07_ai_attempts where id=p_attempt_id for update;
  if not found or a.owner_id is distinct from p_owner_id then raise exception using errcode='42501',message='AI attempt owner mismatch'; end if;
  if a.state<>'completed' then raise exception using errcode='55000',message='AI attempt not settled'; end if;
  if a.acked_at is not null then return jsonb_build_object('attempt_id',a.id,'acked',true,'replayed',true); end if;
  if not exists(select 1 from pgmq.q_ai_extract q where q.msg_id=a.msg_id and q.message->>'item_id'=a.item_id::text) then
    raise exception using errcode='55000',message='AI delivery missing or changed'; end if;
  perform pgmq.archive('ai_extract',a.msg_id);
  update ops.m07_ai_attempts set acked_at=now() where id=a.id;
  return jsonb_build_object('attempt_id',a.id,'acked',true,'replayed',false);
end $$;

create function ops.fail_ai_items(p_item_ids uuid[],p_msg_ids bigint[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n int; a ops.m07_ai_attempts%rowtype;
begin
  if p_item_ids is null or p_msg_ids is null or cardinality(p_item_ids)<>cardinality(p_msg_ids) or cardinality(p_item_ids)>20 then
    raise exception using errcode='22023',message='invalid failed AI deliveries'; end if;
  for n in 1..coalesce(cardinality(p_item_ids),0) loop
    select * into a from ops.m07_ai_attempts where item_id=p_item_ids[n] and msg_id=p_msg_ids[n] order by created_at desc limit 1 for update;
    if not found or a.read_ct<=3 or a.state not in('claimed','prepared','failed') or not exists
      (select 1 from pgmq.q_ai_extract q where q.msg_id=a.msg_id and q.message->>'item_id'=a.item_id::text) then
      raise exception using errcode='42501',message='failed AI delivery not safely owned'; end if;
    update app.items set ai_status='failed' where id=a.item_id and not('ai_status'=any(locked_fields));
    perform pgmq.archive('ai_extract',a.msg_id);
    update ops.m07_ai_attempts set state='failed',outcome='retry_exhausted',acked_at=now() where id=a.id;
  end loop;
  return jsonb_build_object('failed',cardinality(p_item_ids));
end $$;

-- Internal operations are deliberately not part of Data API exposure.
revoke all on function private.norm_alias(text),private.m07_review(app.review_kind,text,text,text,jsonb,int),
  private.resolve_org(app.org_kind,text,text,app.country_code,text,numeric,uuid),private.resolve_person(text,text,uuid),
  private.m07_attempt_receipt(ops.m07_ai_attempts),private.m07_known_cost(ops.m07_ai_attempts,jsonb),private.m07_validate_result(jsonb)
  from public,anon,authenticated,n8n_writer,api_agent;
revoke all on function ops.get_taxonomy_snapshot(),ops.get_items_for_ai(uuid[]),ops.m07_claim_ai(uuid,int,int),
  ops.m07_prepare_ai(uuid,uuid,text,text,text),ops.m07_dispatch_ai(uuid,uuid),ops.m07_ai_status(uuid,uuid),
  ops.apply_extraction(uuid,jsonb,jsonb),ops.m07_fail_ai(uuid,uuid,text,jsonb),ops.m07_ack_ai(uuid,uuid),ops.fail_ai_items(uuid[],bigint[])
  from public,anon,authenticated,n8n_writer,api_agent;
grant execute on function ops.get_taxonomy_snapshot(),ops.get_items_for_ai(uuid[]),ops.m07_claim_ai(uuid,int,int),
  ops.m07_prepare_ai(uuid,uuid,text,text,text),ops.m07_dispatch_ai(uuid,uuid),ops.m07_ai_status(uuid,uuid),
  ops.apply_extraction(uuid,jsonb,jsonb),ops.m07_fail_ai(uuid,uuid,text,jsonb),ops.m07_ack_ai(uuid,uuid),ops.fail_ai_items(uuid[],bigint[])
  to n8n_writer;
