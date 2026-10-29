-- M07 immutable text/embedding preparation. Forward local definitions only.
-- No provider, schedule, hosted queue or campaign operation is performed here.
create table ops.m07_ai_snapshots (
  attempt_id uuid primary key references ops.m07_ai_attempts(id),
  snapshot jsonb not null,
  request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
  prepared_at timestamptz not null default clock_timestamp()
);
alter table ops.m07_ai_snapshots enable row level security;
revoke all on ops.m07_ai_snapshots from public,anon,authenticated,n8n_writer,api_agent;

create function ops.m07_frozen_ai(p_attempt_id uuid,p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype; s ops.m07_ai_snapshots%rowtype;
begin
  select * into a from ops.m07_ai_attempts where id=p_attempt_id;
  if not found or a.owner_id is distinct from p_owner_id then
    raise exception using errcode='42501',message='AI attempt owner mismatch'; end if;
  select * into s from ops.m07_ai_snapshots where attempt_id=a.id;
  return private.m07_attempt_receipt(a)||jsonb_build_object('snapshot',s.snapshot,'request_hash',s.request_hash);
end $$;

create function ops.m07_freeze_ai(p_attempt_id uuid,p_owner_id uuid,p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype; h text; threshold numeric;
begin
  select * into a from ops.m07_ai_attempts where id=p_attempt_id for update;
  if not found or a.owner_id is distinct from p_owner_id then
    raise exception using errcode='42501',message='AI attempt owner mismatch'; end if;
  -- Repeated preparation returns the original bytes/context, even when the
  -- operator's environment, source content or taxonomy changed afterwards.
  if exists(select 1 from ops.m07_ai_snapshots where attempt_id=a.id) then
    return ops.m07_frozen_ai(a.id,p_owner_id); end if;
  if a.state<>'prepared' or a.lease_until<=now() then
    raise exception using errcode='55000',message='AI attempt not ready for immutable preparation'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object'
    or not(p_snapshot ?& array['version','kind','provider_request','context','taxonomy','prompt','schema','config','prices'])
    or exists(select 1 from jsonb_object_keys(p_snapshot) k where k<>all(array['version','kind','provider_request','context','taxonomy','prompt','schema','config','prices']))
    or p_snapshot->'version' is distinct from '1'::jsonb or p_snapshot->>'kind' is distinct from 'extraction'
    or jsonb_typeof(p_snapshot->'provider_request') is distinct from 'object'
    or jsonb_typeof(p_snapshot->'context') is distinct from 'object'
    or p_snapshot#>>'{context,item,id}' is distinct from a.item_id::text
    or jsonb_typeof(p_snapshot->'taxonomy') is distinct from 'object'
    or p_snapshot#>>'{prompt,version}' is distinct from a.prompt_version
    or jsonb_typeof(p_snapshot#>'{prompt,content}') is distinct from 'string'
    or length(p_snapshot#>>'{prompt,content}') not between 1 and 100000
    or p_snapshot#>>'{schema,version}' is distinct from a.schema_version
    or jsonb_typeof(p_snapshot#>'{schema,content}') is distinct from 'object'
    or p_snapshot#>>'{config,model}' is distinct from a.model
    or p_snapshot#>>'{provider_request,model}' is distinct from a.model
    or jsonb_typeof(p_snapshot#>'{config,max_output_tokens}') is distinct from 'number'
    or (p_snapshot#>>'{config,max_output_tokens}')::numeric not between 1 and 8192
    or trunc((p_snapshot#>>'{config,max_output_tokens}')::numeric)<>(p_snapshot#>>'{config,max_output_tokens}')::numeric
    or p_snapshot#>'{provider_request,max_output_tokens}' is distinct from p_snapshot#>'{config,max_output_tokens}'
    or coalesce(p_snapshot#>>'{config,accounting_mode}','') not in('simulated','provider')
    or p_snapshot#>'{provider_request,store}' is distinct from 'false'::jsonb
    or p_snapshot#>'{provider_request,stream}' is distinct from 'false'::jsonb
    or p_snapshot#>'{provider_request,text,format,strict}' is distinct from 'true'::jsonb
    or p_snapshot#>>'{provider_request,text,format,type}' is distinct from 'json_schema'
    or p_snapshot#>'{provider_request,text,format,schema}' is distinct from p_snapshot#>'{schema,content}'
    or p_snapshot->'prices' is distinct from a.price_snapshot
    or octet_length(p_snapshot::text)>1048576 then
    raise exception using errcode='22023',message='invalid immutable AI snapshot'; end if;
  threshold:=coalesce((ops.get_setting('auto_publish_threshold')#>>'{}')::numeric,0.8);
  if not(threshold between 0 and 1) then raise exception using errcode='22023',message='invalid AI routing threshold';end if;
  p_snapshot:=p_snapshot||jsonb_build_object('routing',jsonb_build_object('auto_publish_threshold',threshold));
  h:=encode(extensions.digest(p_snapshot::text,'sha256'),'hex');
  insert into ops.m07_ai_snapshots(attempt_id,snapshot,request_hash) values(a.id,p_snapshot,h);
  return ops.m07_frozen_ai(a.id,p_owner_id);
end $$;

create function private.m07_require_ai_snapshot(p_attempt_id uuid,p_owner_id uuid,p_hash text) returns jsonb
language plpgsql stable set search_path='' as $$
declare s jsonb;
begin
  s:=ops.m07_frozen_ai(p_attempt_id,p_owner_id);
  if s->'snapshot'='null'::jsonb or s->>'request_hash' is distinct from p_hash or p_hash is null then
    raise exception using errcode='42501',message='AI snapshot mismatch'; end if;
  return s;
end $$;

create function ops.m07_dispatch_frozen_ai(p_attempt_id uuid,p_owner_id uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; r jsonb;
begin
  s:=private.m07_require_ai_snapshot(p_attempt_id,p_owner_id,p_hash);
  r:=ops.m07_dispatch_ai(p_attempt_id,p_owner_id);
  return r||jsonb_build_object('snapshot',s->'snapshot','request_hash',p_hash);
end $$;

create function ops.m07_apply_frozen_ai(p_item_id uuid,p_result jsonb,p_meta jsonb,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;
begin
  s:=private.m07_require_ai_snapshot((p_meta->>'attempt_id')::uuid,(p_meta->>'owner_id')::uuid,p_hash);
  if p_meta->>'accounting_mode' is distinct from s#>>'{snapshot,config,accounting_mode}' then
    raise exception using errcode='22023',message='AI accounting configuration changed'; end if;
  return ops.apply_extraction(p_item_id,p_result,p_meta);
end $$;

create function ops.m07_fail_frozen_ai(p_attempt_id uuid,p_owner_id uuid,p_outcome text,p_meta jsonb,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;
begin
  s:=private.m07_require_ai_snapshot(p_attempt_id,p_owner_id,p_hash);
  if p_meta->>'accounting_mode' is distinct from s#>>'{snapshot,config,accounting_mode}' then
    raise exception using errcode='22023',message='AI accounting configuration changed'; end if;
  return ops.m07_fail_ai(p_attempt_id,p_owner_id,p_outcome,p_meta);
end $$;

create table ops.m07_embed_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  state text not null default 'claimed' check(state in('claimed','prepared','dispatched','unknown','completed','failed')),
  lease_until timestamptz not null,
  snapshot jsonb,
  request_hash text,
  response_hash text,
  accepted_response jsonb,
  result jsonb,
  usage_known boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  prepared_at timestamptz,
  dispatched_at timestamptz,
  settled_at timestamptz,
  acked_at timestamptz
);
-- The current finite worker intentionally serializes provider batches. A lost
-- outcome holds this lane until its known batch is reconciled, never retried.
create unique index m07_embed_one_unsettled on ops.m07_embed_batches((true))
  where state in('claimed','prepared','dispatched','unknown');
alter table ops.m07_embed_batches enable row level security;
revoke all on ops.m07_embed_batches from public,anon,authenticated,n8n_writer,api_agent;

create table ops.m07_embed_members (
  batch_id uuid not null references ops.m07_embed_batches(id),
  msg_id bigint not null,
  read_ct integer not null,
  message jsonb not null,
  entity_type text,
  entity_id uuid,
  outcome text not null default 'claimed',
  input_index integer,
  content_hash text,
  primary key(batch_id,msg_id)
);
create index on ops.m07_embed_members(msg_id);
create index on ops.m07_embed_members(entity_type,entity_id);
alter table ops.m07_embed_members enable row level security;
revoke all on ops.m07_embed_members from public,anon,authenticated,n8n_writer,api_agent;

alter table app.embeddings add column dimensions integer not null default 1536 check(dimensions=1536),
  add column input_contract_version text not null default 'legacy',
  add column source_prepared_at timestamptz,
  add column source_batch_id uuid references ops.m07_embed_batches(id);
create index on app.embeddings(source_batch_id);
create unique index cost_ledger_embed_request_unique on ops.cost_ledger((meta->>'embed_batch_id'))
  where provider='openai' and category='embed' and meta ? 'embed_batch_id';

create function private.m07_utf8_prefix(p_text text,p_bytes integer) returns text
language plpgsql immutable set search_path='' as $$
declare lo int:=0; hi int; mid int; t text;
begin
  if p_bytes is null or p_bytes<1 or p_bytes>8192 then
    raise exception using errcode='22023',message='invalid embedding text bound'; end if;
  t:=left(coalesce(p_text,''),p_bytes);hi:=length(t);
  while lo<hi loop
    mid:=(lo+hi+1)/2;
    if octet_length(left(t,mid))<=p_bytes then lo:=mid;else hi:=mid-1;end if;
  end loop;
  return left(t,lo);
end $$;

create function private.m07_embedding_input(p_type text,p_id uuid,p_bytes integer) returns jsonb
language plpgsql stable set search_path='' as $$
declare t text; reason text;
begin
  if p_type='item' then
    select concat_ws(E'\n',nullif(i.title,''),nullif(i.summary_en,''),
      nullif(coalesce(nullif(i.caption_en,''),i.caption_original),''),nullif(o.name,''),c.name,
      nullif(i.content_type,''),nullif(i.occasion,''),
      (select string_agg(tag,', ' order by tag) from(select distinct unnest(i.tags) tag)s))
      into t from app.items i join app.competitors c on c.id=i.competitor_id
      left join app.organizations o on o.id=i.brand_id
      where i.id=p_id and i.status='active' and i.duplicate_of is null and c.status='active';
  elsif p_type='competitor' then
    select concat_ws(E'\n',c.name,
      (select string_agg(v,', ' order by v) from(select distinct unnest(c.categories) v)s),
      (select string_agg(v,', ' order by v) from(select distinct unnest(c.in_house) v)s),
      (select string_agg(s.summary_en,E'\n' order by s.published_at desc nulls last,s.id desc)
        from(select i.summary_en,i.published_at,i.id from app.items i
          where i.competitor_id=c.id and i.status='active' and i.duplicate_of is null and nullif(i.summary_en,'') is not null
          order by i.published_at desc nulls last,i.id desc limit 20)s))
      into t from app.competitors c where c.id=p_id and c.status='active';
  elsif p_type='organization' then
    select concat_ws(E'\n',o.name,nullif(o.industry,''),
      (select string_agg(s.alias,E'\n' order by s.alias_normalized,s.alias)
        from(select distinct a.alias_normalized,a.alias from app.org_aliases a where a.org_id=o.id)s))
      into t from app.organizations o where o.id=p_id and o.status<>'merged';
  else reason:='deferred_entity_type';end if;
  t:=private.m07_utf8_prefix(t,p_bytes);
  if t='' then reason:=coalesce(reason,'unavailable_entity');end if;
  return jsonb_build_object('entity_type',p_type,'entity_id',p_id,'text',t,
    'content_hash',encode(extensions.digest(t,'sha256'),'hex'),'reason',reason);
end $$;

create function private.m07_embed_receipt(b ops.m07_embed_batches) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('batch_id',b.id,'owner_id',b.owner_id,'state',b.state,
    'messages',(select coalesce(jsonb_agg(jsonb_build_object('msg_id',m.msg_id,'read_ct',m.read_ct,
      'entity_type',m.entity_type,'entity_id',m.entity_id) order by m.msg_id),'[]'::jsonb)
      from ops.m07_embed_members m where m.batch_id=b.id),
    'snapshot',b.snapshot,'request_hash',b.request_hash,'result',b.result,'acked',b.acked_at is not null,
    'usage_known',b.usage_known);
$$;

-- Retain only the validated provider body required for exact same-request
-- replay. It is private readback evidence, never part of a runtime receipt.
create function private.m07_embedding_response(p_response jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('object',p_response->'object','model',p_response->'model',
    'data',case when jsonb_typeof(p_response->'data')='array' then
      (select coalesce(jsonb_agg(jsonb_build_object('object',r.value->'object','index',r.value->'index',
        'embedding',r.value->'embedding') order by r.ordinality),'[]'::jsonb)
       from jsonb_array_elements(p_response->'data') with ordinality r(value,ordinality))
      else p_response->'data' end,
    'usage',jsonb_build_object('prompt_tokens',p_response#>'{usage,prompt_tokens}',
      'total_tokens',p_response#>'{usage,total_tokens}'));
$$;

create function ops.m07_embed_status(p_batch_id uuid,p_owner_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b ops.m07_embed_batches%rowtype;
begin
  select * into b from ops.m07_embed_batches where id=p_batch_id;
  if not found or b.owner_id is distinct from p_owner_id then
    raise exception using errcode='42501',message='embedding batch owner mismatch'; end if;
  return private.m07_embed_receipt(b);
end $$;

create function ops.m07_claim_embed(p_owner_id uuid,p_limit integer default 20,p_visibility_seconds integer default 600,p_entities jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b ops.m07_embed_batches%rowtype; q record; n int:=0; typ text; eid uuid; prior text;
begin
  if p_owner_id is null or p_limit is null or p_limit not between 1 and 100 or p_visibility_seconds is null
    or p_visibility_seconds not between 120 and 3600 then
    raise exception using errcode='22023',message='invalid embedding claim'; end if;
  if p_entities is not null then
    if jsonb_typeof(p_entities)<>'array' or jsonb_array_length(p_entities) not between 1 and 20 then
      raise exception using errcode='22023',message='invalid selected embedding entities';end if;
    if exists(select 1 from jsonb_array_elements(p_entities) e where jsonb_typeof(e)<>'object'
      or not(e ?& array['entity_type','entity_id']) or exists(select 1 from jsonb_object_keys(e) k where k<>all(array['entity_type','entity_id']))
      or coalesce(e->>'entity_type','') not in('item','competitor','organization')
      or coalesce(e->>'entity_id','')!~'^[a-fA-F0-9-]{36}$') then
      raise exception using errcode='22023',message='invalid selected embedding entities';end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('m07-embedding-lane',0));
  select * into b from ops.m07_embed_batches where owner_id=p_owner_id;
  if found then return private.m07_embed_receipt(b)||jsonb_build_object('replayed',true);end if;
  select * into b from ops.m07_embed_batches where state in('claimed','prepared','dispatched','unknown');
  if found then return jsonb_build_object('batch_id',b.id,'owner_id',b.owner_id,'state','held','messages','[]'::jsonb,'snapshot',null,'request_hash',null,'result',null,'acked',false);end if;
  insert into ops.m07_embed_batches(owner_id,lease_until) values(p_owner_id,clock_timestamp()+make_interval(secs=>p_visibility_seconds)) returning * into b;
  for q in with chosen as (
      select e.msg_id from pgmq.q_embed e where e.vt<=clock_timestamp() and (p_entities is null or exists(
        select 1 from jsonb_array_elements(p_entities) allowed where allowed->>'entity_type'=e.message->>'entity_type'
          and allowed->>'entity_id'=e.message->>'entity_id'))
      order by e.msg_id for update skip locked limit p_limit
    ) update pgmq.q_embed e set vt=clock_timestamp()+make_interval(secs=>p_visibility_seconds),read_ct=e.read_ct+1
      from chosen c where e.msg_id=c.msg_id returning e.* loop
    typ:=q.message->>'entity_type';eid:=null;
    if coalesce(q.message->>'entity_id','')~'^[a-fA-F0-9-]{36}$' then eid:=(q.message->>'entity_id')::uuid;end if;
    select x.state into prior from ops.m07_embed_members m join ops.m07_embed_batches x on x.id=m.batch_id
      where m.msg_id=q.msg_id order by x.created_at desc,x.id desc limit 1;
    insert into ops.m07_embed_members(batch_id,msg_id,read_ct,message,entity_type,entity_id,outcome)
      values(b.id,q.msg_id,q.read_ct,q.message,typ,eid,case when prior in('completed','failed') then 'prior_delivery' else 'claimed' end);
    n:=n+1;
  end loop;
  if n=0 then
    -- No external intent exists; do not retain a phantom active owner batch.
    delete from ops.m07_embed_batches where id=b.id;
    return jsonb_build_object('batch_id',null,'owner_id',p_owner_id,'state','empty','messages','[]'::jsonb,
      'snapshot',null,'request_hash',null,'result',null,'acked',false);
  end if;
  return private.m07_embed_receipt(b);
end $$;

create function ops.m07_prepare_embed(p_batch_id uuid,p_owner_id uuid,p_model text,p_dimensions integer,
  p_input_version text,p_settings jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b ops.m07_embed_batches%rowtype; m record; x jsonb; prior record; mapping jsonb:='[]'; inputs jsonb:='[]'; skipped jsonb:='[]';
  price jsonb; price_sku text; max_bytes int; max_total int; total int:=0; idx int:=0; v_snapshot jsonb; mode text;
begin
  select * into b from ops.m07_embed_batches where id=p_batch_id for update;
  if not found or b.owner_id is distinct from p_owner_id then
    raise exception using errcode='42501',message='embedding batch owner mismatch'; end if;
  if b.snapshot is not null then return private.m07_embed_receipt(b);end if;
  if b.state<>'claimed' or b.lease_until<=now() then
    raise exception using errcode='55000',message='embedding claim unavailable';end if;
  if p_model is null or p_model!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$' or p_dimensions is distinct from 1536
    or p_input_version is distinct from 'embedding_input.v1' or p_settings is null or jsonb_typeof(p_settings)<>'object'
    or not(p_settings ?& array['max_input_bytes','max_total_bytes','accounting_mode'])
    or exists(select 1 from jsonb_object_keys(p_settings) k where k<>all(array['max_input_bytes','max_total_bytes','accounting_mode']))
    or jsonb_typeof(p_settings->'max_input_bytes') is distinct from 'number'
    or jsonb_typeof(p_settings->'max_total_bytes') is distinct from 'number'
    or (p_settings->>'max_input_bytes')::numeric not between 1 and 8192
    or trunc((p_settings->>'max_input_bytes')::numeric)<>(p_settings->>'max_input_bytes')::numeric
    or (p_settings->>'max_total_bytes')::numeric not between 1 and 300000
    or trunc((p_settings->>'max_total_bytes')::numeric)<>(p_settings->>'max_total_bytes')::numeric
    or coalesce(p_settings->>'accounting_mode','') not in('simulated','provider') then
    raise exception using errcode='22023',message='invalid embedding configuration';end if;
  max_bytes:=(p_settings->>'max_input_bytes')::int;max_total:=(p_settings->>'max_total_bytes')::int;mode:=p_settings->>'accounting_mode';
  price_sku:=case when ops.get_price_book() ? ('openai/'||p_model||':input') then p_model||':input' else p_model end;
  price:=ops.get_price_book()->('openai/'||price_sku);
  if price is null or jsonb_typeof(price->'usd') is distinct from 'number' or (price->>'usd')::numeric<0
    or coalesce(price->>'unit','') not in('1M tokens','1000000 tokens') then
    raise exception using errcode='22023',message='embedding price unavailable';end if;
  for m in select entity_type,entity_id,array_agg(msg_id order by msg_id) msg_ids,
    bool_or(outcome='prior_delivery') prior_delivery from ops.m07_embed_members where batch_id=b.id
    group by entity_type,entity_id order by min(msg_id) loop
    x:=private.m07_embedding_input(m.entity_type,m.entity_id,max_bytes);
    if m.prior_delivery then x:=x||'{"reason":"prior_delivery"}'::jsonb;end if;
    select * into prior from app.embeddings e where e.entity_type=m.entity_type and e.entity_id=m.entity_id;
    if x->>'reason' is null and prior.content_hash=x->>'content_hash' and prior.model=p_model and prior.dimensions=p_dimensions
      and prior.input_contract_version=p_input_version then x:=x||'{"reason":"unchanged"}'::jsonb;end if;
    if x->>'reason' is not null then
      update ops.m07_embed_members set outcome=x->>'reason' where batch_id=b.id and msg_id=any(m.msg_ids);
      skipped:=skipped||jsonb_build_array(jsonb_build_object('entity_type',m.entity_type,'entity_id',m.entity_id,'msg_ids',m.msg_ids,'reason',x->>'reason'));
    else
      total:=total+octet_length(x->>'text');
      if total>max_total then raise exception using errcode='22023',message='embedding aggregate input exceeds configured bound';end if;
      inputs:=inputs||jsonb_build_array(x->>'text');
      mapping:=mapping||jsonb_build_array(jsonb_build_object('index',idx,'entity_type',m.entity_type,'entity_id',m.entity_id,
        'content_hash',x->>'content_hash','text',x->>'text','msg_ids',m.msg_ids));
      update ops.m07_embed_members set outcome='prepared',input_index=idx,content_hash=x->>'content_hash' where batch_id=b.id and msg_id=any(m.msg_ids);
      idx:=idx+1;
    end if;
  end loop;
  v_snapshot:=jsonb_build_object('provider_request',jsonb_build_object('model',p_model,'input',inputs,'dimensions',p_dimensions,'encoding_format','float'),
    'mapping',mapping,'input_contract_version',p_input_version,'dimensions',p_dimensions,'price',price,'price_source_sku',price_sku,
    'settings',jsonb_build_object('max_input_bytes',max_bytes,'max_total_bytes',max_total,'accounting_mode',mode),
    'config',jsonb_build_object('model',p_model,'dimensions',p_dimensions,'input_contract_version',p_input_version,'accounting_mode',mode));
  update ops.m07_embed_batches set snapshot=v_snapshot,request_hash=encode(extensions.digest(v_snapshot::text,'sha256'),'hex'),
    prepared_at=clock_timestamp(),state=case when idx=0 then 'completed' else 'prepared' end,
    settled_at=case when idx=0 then clock_timestamp() else null end,
    result=jsonb_build_object('stored',0,'skipped',skipped,'stale','[]'::jsonb,'cost_usd',null,'usage_known',false)
    where id=b.id returning * into b;
  return private.m07_embed_receipt(b);
end $$;

create function ops.m07_dispatch_embed(p_batch_id uuid,p_owner_id uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b ops.m07_embed_batches%rowtype; admitted boolean:=false;
begin
  select * into b from ops.m07_embed_batches where id=p_batch_id for update;
  if not found or b.owner_id is distinct from p_owner_id then
    raise exception using errcode='42501',message='embedding batch owner mismatch'; end if;
  if p_hash is null or b.request_hash is distinct from p_hash or b.snapshot is null then
    raise exception using errcode='42501',message='embedding snapshot mismatch';end if;
  if b.state='prepared' then
    if b.lease_until<=now() then raise exception using errcode='55000',message='embedding claim expired';end if;
    update ops.m07_embed_batches set state='dispatched',dispatched_at=clock_timestamp() where id=b.id returning * into b;
    admitted:=true;
  end if;
  return private.m07_embed_receipt(b)||jsonb_build_object('admitted',admitted);
end $$;

create function ops.m07_unknown_embed(p_batch_id uuid,p_owner_id uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b ops.m07_embed_batches%rowtype;
begin
  select * into b from ops.m07_embed_batches where id=p_batch_id for update;
  if not found or b.owner_id is distinct from p_owner_id then
    raise exception using errcode='42501',message='embedding batch owner mismatch';end if;
  if p_hash is null or b.request_hash is distinct from p_hash or b.snapshot is null then
    raise exception using errcode='42501',message='embedding snapshot mismatch';end if;
  if b.state in('completed','failed','unknown') then return private.m07_embed_receipt(b);end if;
  if b.state<>'dispatched' then raise exception using errcode='55000',message='embedding request not dispatched';end if;
  update ops.m07_embed_batches set state='unknown',result=jsonb_build_object('held',true,'usage_known',false,'cost_usd',null,
    'reason','provider_outcome_unknown'),settled_at=clock_timestamp() where id=b.id returning * into b;
  return private.m07_embed_receipt(b);
end $$;

create function ops.m07_settle_embed(p_batch_id uuid,p_owner_id uuid,p_response jsonb,p_accounting_mode text,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b ops.m07_embed_batches%rowtype; digest text; tokens numeric; usage_known boolean:=false; valid boolean:=true;
  reason text; n int; r jsonb; v jsonb; idx int; seen int[]:='{}'; price numeric; cost numeric; m jsonb; current_input jsonb;
  stored jsonb:='[]'; stale jsonb:='[]'; skipped jsonb; vector_value extensions.vector; prior app.embeddings%rowtype; projection jsonb;
begin
  select * into b from ops.m07_embed_batches where id=p_batch_id for update;
  if not found or b.owner_id is distinct from p_owner_id then
    raise exception using errcode='42501',message='embedding batch owner mismatch';end if;
  if p_hash is null or b.request_hash is distinct from p_hash or b.snapshot is null then
    raise exception using errcode='42501',message='embedding snapshot mismatch';end if;
  if p_accounting_mode is distinct from b.snapshot#>>'{settings,accounting_mode}' then
    raise exception using errcode='22023',message='embedding accounting configuration changed';end if;
  projection:=case when b.accepted_response is not null then private.m07_embedding_response(p_response) else null end;
  digest:=encode(extensions.digest(coalesce(projection,p_response,'null'::jsonb)::text,'sha256'),'hex');
  if b.state in('completed','failed') then
    if b.response_hash is distinct from digest then raise exception using errcode='22023',message='embedding response changed';end if;
    return private.m07_embed_receipt(b)||jsonb_build_object('replayed',true);
  end if;
  if b.state not in('dispatched','unknown') then raise exception using errcode='55000',message='embedding request not dispatched';end if;
  -- Model identity and actual aggregate usage must be known before any cost or
  -- vector can settle. Missing metadata never becomes a fabricated zero bill.
  if jsonb_typeof(p_response)='object' and p_response->>'model'=b.snapshot#>>'{config,model}'
    and jsonb_typeof(p_response#>'{usage,prompt_tokens}')='number'
    and jsonb_typeof(p_response#>'{usage,total_tokens}')='number' then
    tokens:=(p_response#>>'{usage,total_tokens}')::numeric;
    usage_known:=tokens between 0 and 300000 and trunc(tokens)=tokens
      and tokens=(p_response#>>'{usage,prompt_tokens}')::numeric;
  end if;
  if not coalesce(usage_known,false) then return ops.m07_unknown_embed(p_batch_id,p_owner_id,p_hash);end if;
  price:=(b.snapshot#>>'{price,usd}')::numeric;cost:=round(tokens*price/1000000,6);
  n:=jsonb_array_length(b.snapshot->'mapping');
  if p_response->>'object' is distinct from 'list' or jsonb_typeof(p_response->'data') is distinct from 'array' then
    valid:=false;reason:='invalid_embedding_response';
  elsif jsonb_array_length(p_response->'data')<>n then valid:=false;reason:='incomplete_embedding_response';
  else
    for r in select value from jsonb_array_elements(p_response->'data') loop
      if r->>'object' is distinct from 'embedding' or jsonb_typeof(r->'index') is distinct from 'number'
        or (r->>'index')::numeric not between 0 and n-1 or trunc((r->>'index')::numeric)<>(r->>'index')::numeric
        or jsonb_typeof(r->'embedding') is distinct from 'array' then valid:=false;exit;end if;
      idx:=(r->>'index')::int;
      if idx=any(seen) or jsonb_array_length(r->'embedding')<>1536 then valid:=false;exit;end if;
      seen:=array_append(seen,idx);
      if exists(select 1 from jsonb_array_elements(r->'embedding') e where jsonb_typeof(e)<>'number') then valid:=false;exit;end if;
      -- pgvector stores float4; values outside its finite range are invalid,
      -- even if the provider's JSON parser represented them as large numeric.
      if exists(select 1 from jsonb_array_elements(r->'embedding') e
          where abs((e#>>'{}')::numeric)>3.4028234663852886e38)
        or (select sum(abs((e#>>'{}')::numeric)) from jsonb_array_elements(r->'embedding') e)=0 then valid:=false;exit;end if;
      begin
        vector_value:=(r->'embedding')::text::extensions.vector;
        if not exists(select 1 from unnest(vector_value::real[]) x where x<>0) then valid:=false;exit;end if;
      exception when data_exception then valid:=false;exit;end;
    end loop;
    if not valid then reason:='invalid_embedding_vectors';end if;
  end if;
  skipped:=coalesce(b.result->'skipped','[]'::jsonb);
  if valid then
    projection:=private.m07_embedding_response(p_response);
    digest:=encode(extensions.digest(projection::text,'sha256'),'hex');

    for m in select value from jsonb_array_elements(b.snapshot->'mapping') order by (value->>'index')::int loop
      perform pg_advisory_xact_lock(hashtextextended('m07-embed:'||(m->>'entity_type')||':'||(m->>'entity_id'),0));
      current_input:=private.m07_embedding_input(m->>'entity_type',(m->>'entity_id')::uuid,(b.snapshot#>>'{settings,max_input_bytes}')::int);
      select * into prior from app.embeddings e where e.entity_type=m->>'entity_type' and e.entity_id=(m->>'entity_id')::uuid for update;
      if current_input->>'reason' is not null or current_input->>'content_hash' is distinct from m->>'content_hash'
        or (coalesce(prior.source_prepared_at,prior.updated_at)>b.prepared_at) then
        stale:=stale||jsonb_build_array(jsonb_build_object('entity_type',m->>'entity_type','entity_id',m->>'entity_id','reason','source_changed_or_newer_embedding'));
        update ops.m07_embed_members set outcome='stale' where batch_id=b.id and input_index=(m->>'index')::int;
        continue;
      end if;
      select value->'embedding' into v from jsonb_array_elements(p_response->'data') where (value->>'index')::int=(m->>'index')::int;
      vector_value:=v::text::extensions.vector;
      insert into app.embeddings(entity_type,entity_id,model,content_hash,embedding,dimensions,input_contract_version,source_prepared_at,source_batch_id)
        values(m->>'entity_type',(m->>'entity_id')::uuid,b.snapshot#>>'{config,model}',m->>'content_hash',vector_value,1536,
          b.snapshot->>'input_contract_version',b.prepared_at,b.id)
        on conflict(entity_type,entity_id) do update set model=excluded.model,content_hash=excluded.content_hash,
          embedding=excluded.embedding,dimensions=excluded.dimensions,input_contract_version=excluded.input_contract_version,
          source_prepared_at=excluded.source_prepared_at,source_batch_id=excluded.source_batch_id,updated_at=clock_timestamp()
        where coalesce(app.embeddings.source_prepared_at,app.embeddings.updated_at)<=excluded.source_prepared_at;
      stored:=stored||jsonb_build_array(jsonb_build_object('entity_type',m->>'entity_type','entity_id',m->>'entity_id','content_hash',m->>'content_hash'));
      update ops.m07_embed_members set outcome='stored' where batch_id=b.id and input_index=(m->>'index')::int;
    end loop;
  else
    update ops.m07_embed_members set outcome='failed' where batch_id=b.id and outcome='prepared';
  end if;
  insert into ops.cost_ledger(provider,category,quantity,unit,cost_usd,meta)
    values('openai','embed',tokens,'token',cost,jsonb_build_object('embed_batch_id',b.id,'request_hash',b.request_hash,
      'model',b.snapshot#>>'{config,model}','dimensions',1536,'input_contract_version',b.snapshot->>'input_contract_version',
      'accounting_mode',p_accounting_mode,'aggregate_prompt_tokens',tokens,'vector_count',n,'output_valid',valid));
  update ops.m07_embed_batches set state=case when valid then 'completed' else 'failed' end,response_hash=digest,
    accepted_response=case when valid then projection else null end,usage_known=true,settled_at=clock_timestamp(),result=jsonb_build_object('stored',jsonb_array_length(stored),'stored_entities',stored,
      'stale',stale,'skipped',skipped,'usage_known',true,'total_tokens',tokens,'cost_usd',cost,
      'accounting_mode',p_accounting_mode,'reason',reason) where id=b.id returning * into b;
  return private.m07_embed_receipt(b)||jsonb_build_object('replayed',false);
end $$;

create function ops.m07_ack_embed(p_batch_id uuid,p_owner_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b ops.m07_embed_batches%rowtype; m record;
begin
  select * into b from ops.m07_embed_batches where id=p_batch_id for update;
  if not found or b.owner_id is distinct from p_owner_id then
    raise exception using errcode='42501',message='embedding batch owner mismatch';end if;
  if b.state<>'completed' then raise exception using errcode='55000',message='embedding batch not completed';end if;
  if b.acked_at is not null then return private.m07_embed_receipt(b)||jsonb_build_object('replayed',true);end if;
  for m in select * from ops.m07_embed_members where batch_id=b.id order by msg_id loop
    if exists(select 1 from pgmq.q_embed q where q.msg_id=m.msg_id) then
      if not exists(select 1 from pgmq.q_embed q where q.msg_id=m.msg_id and q.message=m.message) then
        raise exception using errcode='55000',message='embedding delivery missing or changed';end if;
      perform pgmq.archive('embed',m.msg_id);
    elsif not exists(select 1 from pgmq.a_embed q where q.msg_id=m.msg_id and q.message=m.message) then
      raise exception using errcode='55000',message='embedding delivery missing or changed';
    end if;
  end loop;
  update ops.m07_embed_batches set acked_at=clock_timestamp() where id=b.id returning * into b;
  return private.m07_embed_receipt(b)||jsonb_build_object('replayed',false);
end $$;

create function ops.enqueue_competitor_embeddings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare c record; queued int:=0; existing int:=0;
begin
  perform pg_advisory_xact_lock(hashtextextended('m07-enqueue-competitors',0));
  for c in select id from app.competitors where status='active' order by id loop
    if exists(select 1 from pgmq.q_embed q where q.message->>'entity_type'='competitor' and q.message->>'entity_id'=c.id::text) then
      existing:=existing+1;
    else
      perform pgmq.send('embed',jsonb_build_object('entity_type','competitor','entity_id',c.id));queued:=queued+1;
    end if;
  end loop;
  return jsonb_build_object('enqueued',queued,'already_queued',existing);
end $$;


create function ops.m07_claim_ai_selected(p_owner_id uuid,p_item_ids uuid[],p_limit integer default 1,p_visibility_seconds integer default 600)
returns jsonb language plpgsql security definer set search_path='' as $$
declare messages jsonb; q record; old ops.m07_ai_attempts%rowtype; a ops.m07_ai_attempts%rowtype; item uuid; nonce uuid;
begin
  if p_item_ids is null then return ops.m07_claim_ai(p_owner_id,p_limit,p_visibility_seconds);end if;
  if cardinality(p_item_ids) not between 1 and 20 or array_position(p_item_ids,null) is not null then
    raise exception using errcode='22023',message='invalid selected AI items';end if;
  if exists(select 1 from ops.m07_ai_attempts where owner_id=p_owner_id and not(item_id=any(p_item_ids))) then
    raise exception using errcode='42501',message='AI owner outside selected items';end if;
  if p_owner_id is null or p_limit is null or p_limit<1 or p_limit>20 or p_visibility_seconds is null
    or p_visibility_seconds<120 or p_visibility_seconds>3600 then
    raise exception using errcode='22023',message='invalid AI claim'; end if;
  perform pg_advisory_xact_lock(hashtextextended('m07-owner:'||p_owner_id::text,0));
  select jsonb_agg(private.m07_attempt_receipt(x) order by x.msg_id) into messages
    from ops.m07_ai_attempts x where owner_id=p_owner_id;
  if messages is not null then return jsonb_build_object('owner_id',p_owner_id,'messages',messages,'replayed',true); end if;
  messages:='[]'::jsonb;
  for q in with chosen as (
      select e.msg_id from pgmq.q_ai_extract e where e.vt<=clock_timestamp()
        and e.message->>'item_id'=any(array(select u::text from unnest(p_item_ids) u))
      order by e.msg_id for update skip locked limit p_limit
    ) update pgmq.q_ai_extract e set vt=clock_timestamp()+make_interval(secs=>p_visibility_seconds),read_ct=e.read_ct+1
      from chosen c where e.msg_id=c.msg_id returning e.* loop
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


-- Unlabelled semantic query vectors cannot be compared to an arbitrary model.
create or replace function app.search(
  p_query text,
  p_embedding extensions.vector(1536) default null,
  p_types text[] default array['item','campaign','organization','person','competitor','news'],
  p_filters jsonb default '{}',
  p_limit int default 30
) returns table(entity_type text, entity_id uuid, title text, subtitle text, score double precision)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select websearch_to_tsquery('pg_catalog.simple',extensions.unaccent(coalesce(p_query,''))) tsq
  ), eligible_items as (
    select i.* from app.items i
    where i.status = 'active' and i.duplicate_of is null
      and (p_filters->>'country' is null or i.country::text = p_filters->>'country')
      and (p_filters->>'platform' is null or i.platform::text = p_filters->>'platform')
      and (p_filters->>'competitor_id' is null or i.competitor_id = (p_filters->>'competitor_id')::uuid)
      and (p_filters->>'brand_id' is null or i.brand_id = (p_filters->>'brand_id')::uuid)
      and (p_filters->>'from' is null or i.published_at >= (p_filters->>'from')::timestamptz)
      and (p_filters->>'to' is null or i.published_at < (p_filters->>'to')::timestamptz)
      and (p_filters->>'content_type' is null or i.content_type = p_filters->>'content_type')
      and (p_filters->>'occasion' is null or i.occasion = p_filters->>'occasion')
  ), entities as (
    select 'item'::text t, i.id, coalesce(i.title,left(i.caption_original,120)) title, i.summary_en subtitle
      from eligible_items i
    union all select 'campaign',c.id,c.title,c.summary_en from app.campaigns c where c.status <> 'merged'
    union all select 'organization',o.id,o.name,o.kind::text from app.organizations o where o.status <> 'merged'
    union all select 'person',p.id,p.name,p.primary_role from app.people p where p.status <> 'merged'
    union all select 'competitor',c.id,c.name,c.hq_country::text from app.competitors c where c.status = 'active'
    union all select 'news',n.id,n.title,n.source_name from app.news_articles n
  ), kw_items as (
    select 'item'::text t,i.id,row_number() over(order by ts_rank_cd(i.search_tsv,q.tsq) desc,i.id) rk
    from eligible_items i cross join q
    where 'item' = any(p_types) and i.search_tsv @@ q.tsq
    order by rk limit 100
  ), kw_campaigns as (
    select 'campaign'::text t,c.id,row_number() over(order by ts_rank_cd(c.search_tsv,q.tsq) desc,c.id) rk
    from app.campaigns c cross join q
    where 'campaign' = any(p_types) and c.status <> 'merged' and c.search_tsv @@ q.tsq
    order by rk limit 100
  ), kw_organizations as (
    select 'organization'::text t,o.id,
      row_number() over(order by (ts_rank_cd(o.search_tsv,q.tsq) + extensions.similarity(o.name,coalesce(p_query,''))) desc,o.id) rk
    from app.organizations o cross join q
    where 'organization' = any(p_types) and o.status <> 'merged'
      and (o.name operator(extensions.%) p_query or o.search_tsv @@ q.tsq)
    order by rk limit 100
  ), kw_people as (
    select 'person'::text t,p.id,
      row_number() over(order by (ts_rank_cd(p.search_tsv,q.tsq) + extensions.similarity(p.name,coalesce(p_query,''))) desc,p.id) rk
    from app.people p cross join q
    where 'person' = any(p_types) and p.status <> 'merged'
      and (p.name operator(extensions.%) p_query or p.search_tsv @@ q.tsq)
    order by rk limit 100
  ), kw_competitors as (
    select 'competitor'::text t,c.id,
      row_number() over(order by (ts_rank_cd(c.search_tsv,q.tsq) + extensions.similarity(c.name,coalesce(p_query,''))) desc,c.id) rk
    from app.competitors c cross join q
    where 'competitor' = any(p_types) and c.status = 'active'
      and (c.name operator(extensions.%) p_query or c.search_tsv @@ q.tsq)
    order by rk limit 100
  ), kw_news as (
    select 'news'::text t,n.id,row_number() over(order by ts_rank_cd(n.search_tsv,q.tsq) desc,n.id) rk
    from app.news_articles n cross join q
    where 'news' = any(p_types) and n.search_tsv @@ q.tsq
    order by rk limit 100
  ), semantic as (
    select e.entity_type t,e.entity_id id,
      row_number() over(order by e.embedding operator(extensions.<=>) p_embedding,e.entity_type,e.entity_id) rk
    from app.embeddings e join entities x on x.t = e.entity_type and x.id = e.entity_id
    where p_embedding is not null and e.entity_type = any(p_types)
      and e.model=p_filters->>'embedding_model'
      and e.dimensions::text=p_filters->>'embedding_dimensions'
      and e.input_contract_version=p_filters->>'embedding_input_version'
    order by e.embedding operator(extensions.<=>) p_embedding,e.entity_type,e.entity_id limit 100
  ), fused as (
    select t,id,sum(1.0/(60+rk))::double precision score from (
      select * from kw_items union all select * from kw_campaigns
      union all select * from kw_organizations union all select * from kw_people
      union all select * from kw_competitors union all select * from kw_news
      union all select * from semantic
    ) candidates group by t,id
  )
  select f.t,f.id,x.title,x.subtitle,f.score
  from fused f join entities x on x.t = f.t and x.id = f.id
  order by f.score desc,f.t,f.id limit greatest(0,least(coalesce(p_limit,30),100));
$$;

create or replace function app.similar(p_entity_type text,p_entity_id uuid,p_limit int default 12)
returns table(entity_type text,entity_id uuid,distance double precision)
language sql stable security invoker set search_path = '' as $$
  with entities as (
    select 'item'::text t,id from app.items where status = 'active' and duplicate_of is null
    union all select 'campaign',id from app.campaigns where status <> 'merged'
    union all select 'organization',id from app.organizations where status <> 'merged'
    union all select 'competitor',id from app.competitors where status = 'active'
    union all select 'brief',id from app.briefs
  )
  select e2.entity_type,e2.entity_id,(e2.embedding operator(extensions.<=>) e1.embedding)::double precision
  from app.embeddings e1
  join entities source on source.t = e1.entity_type and source.id = e1.entity_id
  join app.embeddings e2 on e2.entity_type = e1.entity_type and e2.entity_id <> e1.entity_id
    and e2.model=e1.model and e2.dimensions=e1.dimensions and e2.input_contract_version=e1.input_contract_version
  join entities target on target.t = e2.entity_type and target.id = e2.entity_id
  where e1.entity_type = p_entity_type and e1.entity_id = p_entity_id
  order by e2.embedding operator(extensions.<=>) e1.embedding,e2.entity_id
  limit greatest(0,least(coalesce(p_limit,12),100));
$$;


revoke all on function private.m07_require_ai_snapshot(uuid,uuid,text),private.m07_utf8_prefix(text,integer),
  private.m07_embedding_input(text,uuid,integer),private.m07_embed_receipt(ops.m07_embed_batches)
  from public,anon,authenticated,n8n_writer,api_agent;
revoke all on function ops.m07_frozen_ai(uuid,uuid),ops.m07_freeze_ai(uuid,uuid,jsonb),
  ops.m07_dispatch_frozen_ai(uuid,uuid,text),ops.m07_apply_frozen_ai(uuid,jsonb,jsonb,text),
  ops.m07_fail_frozen_ai(uuid,uuid,text,jsonb,text),ops.m07_claim_ai_selected(uuid,uuid[],integer,integer),
  ops.m07_embed_status(uuid,uuid),ops.m07_claim_embed(uuid,integer,integer,jsonb),
  ops.m07_prepare_embed(uuid,uuid,text,integer,text,jsonb),ops.m07_dispatch_embed(uuid,uuid,text),
  ops.m07_settle_embed(uuid,uuid,jsonb,text,text),ops.m07_unknown_embed(uuid,uuid,text),
  ops.m07_ack_embed(uuid,uuid),ops.enqueue_competitor_embeddings()
  from public,anon,authenticated,n8n_writer,api_agent;
grant execute on function ops.m07_frozen_ai(uuid,uuid),ops.m07_freeze_ai(uuid,uuid,jsonb),
  ops.m07_dispatch_frozen_ai(uuid,uuid,text),ops.m07_apply_frozen_ai(uuid,jsonb,jsonb,text),
  ops.m07_fail_frozen_ai(uuid,uuid,text,jsonb,text),ops.m07_claim_ai_selected(uuid,uuid[],integer,integer),
  ops.m07_embed_status(uuid,uuid),ops.m07_claim_embed(uuid,integer,integer,jsonb),
  ops.m07_prepare_embed(uuid,uuid,text,integer,text,jsonb),ops.m07_dispatch_embed(uuid,uuid,text),
  ops.m07_settle_embed(uuid,uuid,jsonb,text,text),ops.m07_unknown_embed(uuid,uuid,text),
  ops.m07_ack_embed(uuid,uuid),ops.enqueue_competitor_embeddings()
  to n8n_writer;

-- Frozen validation/routing does not follow later taxonomy/settings edits.
create function private.m07_validate_result(r jsonb,p_taxonomy jsonb) returns void
language plpgsql stable set search_path='' as $$
declare k text; credit jsonb; allowed text[]:=array['is_commercial_work','content_type','brand','agency','production_house','credits',
  'campaign_title','country','language','occasion','summary_en','summary_ar','caption_en','tags','needs_vision','confidence','evidence'];
begin
  if p_taxonomy is null then perform private.m07_validate_result(r);return;end if;
  if r is null or jsonb_typeof(r)<>'object' or not(r ?& allowed) or (select count(*) from jsonb_object_keys(r))<>cardinality(allowed)
    or jsonb_typeof(r->'is_commercial_work') not in('boolean','null') or jsonb_typeof(r->'needs_vision')<>'boolean'
    or jsonb_typeof(r->'content_type')<>'string' or jsonb_typeof(r->'summary_en')<>'string' or jsonb_typeof(r->'summary_ar')<>'string'
    or jsonb_typeof(r->'tags')<>'array' or jsonb_array_length(r->'tags')>8 or jsonb_typeof(r->'credits')<>'array'
    or jsonb_array_length(r->'credits')>100 or jsonb_typeof(r->'confidence')<>'object' or jsonb_typeof(r->'evidence')<>'object'
    or jsonb_typeof(r->'production_house')<>'object' then raise exception using errcode='22023',message='invalid extraction schema'; end if;
  foreach k in array array['campaign_title','caption_en','occasion','country','language'] loop
    if jsonb_typeof(r->k) not in('string','null') then raise exception using errcode='22023',message='invalid extraction text'; end if;
  end loop;
  if not coalesce((p_taxonomy->'content_format') ? (r->>'content_type'),false)
    or (r->>'occasion' is not null and not coalesce((p_taxonomy->'occasion') ? (r->>'occasion'),false))
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
        or (r#>>'{brand,industry}' is not null and not coalesce((p_taxonomy->'industry') ? (r#>>'{brand,industry}'),false))) then
        raise exception using errcode='22023',message='invalid brand taxonomy'; end if;
    end if;
  end loop;
  for credit in select value from jsonb_array_elements(r->'credits') loop
    if jsonb_typeof(credit)<>'object' or not(credit ?& array['person_name','role','organization'])
      or (select count(*) from jsonb_object_keys(credit))<>3 or jsonb_typeof(credit->'person_name')<>'string'
      or private.norm_alias(credit->>'person_name')='' or length(credit->>'person_name')>300
      or jsonb_typeof(credit->'organization') not in('string','null') or jsonb_typeof(credit->'role')<>'string' or not coalesce((p_taxonomy->'credit_role') ? (credit->>'role'),false) then
      raise exception using errcode='22023',message='invalid extraction credit'; end if;
  end loop;
end $$;


create or replace function ops.apply_extraction(p_item_id uuid,p_result jsonb,p_meta jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ops.m07_ai_attempts%rowtype; i app.items%rowtype; digest text; cost numeric; extraction bigint;
  brand uuid; agency uuid; production uuid; person uuid; organization uuid; competitor uuid; c jsonb;
  v_status app.ai_status; reason text; threshold numeric; v_confidence numeric; reviews jsonb; v_result jsonb; snapshot jsonb;
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
  select s.snapshot into snapshot from ops.m07_ai_snapshots s where s.attempt_id=a.id;
  perform private.m07_validate_result(p_result,snapshot->'taxonomy');
  cost:=private.m07_known_cost(a,p_meta);
  select * into i from app.items where id=p_item_id for update;
  if i.status<>'active' or i.ai_status='duplicate' then raise exception using errcode='42501',message='AI item unavailable'; end if;
  v_confidence:=(p_result#>>'{confidence,overall}')::numeric;
  threshold:=case when snapshot is not null then (snapshot#>>'{routing,auto_publish_threshold}')::numeric else coalesce((ops.get_setting('auto_publish_threshold')#>>'{}')::numeric,0.8) end;
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


revoke all on function private.m07_validate_result(jsonb,jsonb) from public,anon,authenticated,n8n_writer,api_agent;

revoke all on function private.m07_embedding_response(jsonb) from public,anon,authenticated,n8n_writer,api_agent;
