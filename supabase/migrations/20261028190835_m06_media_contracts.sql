-- M06 local slice: thumbnail metadata RPCs only. This migration performs no
-- Storage upload, source capture, callback publication or schedule change.
-- The object must be saved by the bounded media worker before recording it.

create function ops.get_media_targets(p_item_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_item_ids is null or coalesce(array_ndims(p_item_ids),1)<>1
    or cardinality(p_item_ids)>50 or exists(select 1 from unnest(p_item_ids) x where x is null)
    or (select count(distinct x) from unnest(p_item_ids) x)<>cardinality(p_item_ids) then
    raise exception using errcode='22023',message='invalid bounded media target IDs';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id',i.id,'competitor_slug',c.slug,'platform',i.platform,'external_id',i.external_id,
    'thumbnail_source_url',i.thumbnail_source_url,'has_thumbnail',i.thumbnail_path is not null,
    'thumbnail_locked','thumbnail_path'=any(i.locked_fields),
    'storage_path',c.slug||'/'||i.platform::text||'/'||i.external_id||'/thumb.jpg'
  ) order by array_position(p_item_ids,i.id)),'[]'::jsonb) into result
  from app.items i join app.competitors c on c.id=i.competitor_id
  where i.id=any(p_item_ids)
    and i.platform in ('vimeo','instagram','instagram_stories','website_work_page','linkedin','youtube')
    and length(c.slug) between 1 and 120 and c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and length(i.external_id) between 1 and 200 and i.external_id ~ '^[A-Za-z0-9_.-]+$'
    and i.external_id<>'.' and position('..' in i.external_id)=0
    and (i.thumbnail_source_url is null or length(i.thumbnail_source_url)<=8192);
  return result;
end $$;

create function ops.save_media_asset(p_item_id uuid,p_kind text,p_path text,p_source_url text,p_w int,p_h int)
returns void language plpgsql security definer set search_path='' as $$
declare item app.items%rowtype; asset app.media_assets%rowtype; owner_slug text; expected_path text;
begin
  if p_item_id is null or p_kind is distinct from 'thumbnail'
    or p_path is null or length(p_path)>512 or position('..' in p_path)>0 or p_path like '%/./%'
    or p_path !~ '^[a-z0-9]+(-[a-z0-9]+)*/(vimeo|instagram|instagram_stories|website_work_page|linkedin|youtube)/[A-Za-z0-9_.-]+/thumb\.jpg$'
    or p_source_url is null or length(p_source_url)>8192
    or p_source_url !~ '^https://[^/?#@[:space:]]+([/?][^#[:space:]]*)?$'
    or p_w is null or p_w<1 or p_w>1280 or p_h is null or p_h<1 or p_h>16384 then
    raise exception using errcode='22023',message='invalid thumbnail metadata';
  end if;
  select i.* into item from app.items i where i.id=p_item_id for update;
  if not found then raise exception using errcode='22023',message='unknown media item'; end if;
  select c.slug into owner_slug from app.competitors c where c.id=item.competitor_id for share;
  if item.platform not in ('vimeo','instagram','instagram_stories','website_work_page','linkedin','youtube')
    or length(owner_slug) not between 1 and 120 or owner_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(item.external_id) not between 1 and 200 or item.external_id !~ '^[A-Za-z0-9_.-]+$'
    or item.external_id='.' or position('..' in item.external_id)>0 then
    raise exception using errcode='42501',message='eligible stored media identity required';
  end if;
  expected_path:=owner_slug||'/'||item.platform::text||'/'||item.external_id||'/thumb.jpg';
  if p_path is distinct from expected_path then
    raise exception using errcode='42501',message='media path must match stored item owner';
  end if;
  if 'thumbnail_path'=any(item.locked_fields) then
    raise exception using errcode='42501',message='human thumbnail lock must be preserved';
  end if;
  if p_source_url is distinct from item.thumbnail_source_url then
    raise exception using errcode='55000',message='thumbnail source changed before settlement';
  end if;
  if item.thumbnail_path is not null and item.thumbnail_path is distinct from p_path then
    raise exception using errcode='55000',message='existing thumbnail pointer must be preserved';
  end if;
  -- A concurrent unique-key winner is checked below, never silently adopted.
  -- Existing metadata is immutable: identical retries succeed; conflicts stop.
  insert into app.media_assets(item_id,competitor_id,kind,storage_path,source_url,width,height)
    values(item.id,item.competitor_id,'thumbnail',p_path,p_source_url,p_w,p_h)
    on conflict(storage_path) do nothing;
  select m.* into asset from app.media_assets m where m.storage_path=p_path for update;
  if asset.item_id is distinct from item.id or asset.competitor_id is distinct from item.competitor_id
    or asset.kind is distinct from 'thumbnail' or asset.source_url is distinct from p_source_url
    or asset.width is distinct from p_w or asset.height is distinct from p_h then
    raise exception using errcode='55000',message='thumbnail receipt ownership or content conflict';
  end if;
  if item.thumbnail_path is distinct from p_path then
    update app.items set thumbnail_path=p_path,updated_at=now() where id=item.id;
  end if;
end $$;

revoke execute on function ops.get_media_targets(uuid[]) from public,anon,authenticated,api_agent;
revoke execute on function ops.save_media_asset(uuid,text,text,text,int,int) from public,anon,authenticated,api_agent;
grant execute on function ops.get_media_targets(uuid[]) to n8n_writer;
grant execute on function ops.save_media_asset(uuid,text,text,text,int,int) to n8n_writer;

comment on function ops.get_media_targets(uuid[]) is
  'M06 bounded thumbnail context; private writer RPC, no object upload or browser access.';
comment on function ops.save_media_asset(uuid,text,text,text,int,int) is
  'M06 immutable thumbnail receipt after upload; exact stored source/path owner, human locks preserved.';

-- WF-31 runtime receipts use the existing product audit log. These records
-- contain only IDs, controlled outcome codes and byte counts, never URLs/tokens.
-- Session-pooler callers hold this one fixed media lock until all I/O closes.
create function private.assert_media_session(p_execution_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_execution_id is null or p_execution_id !~ '^[1-9][0-9]{0,19}$' then
    raise exception using errcode='22023',message='invalid media execution identity';
  end if;
  if not exists(select 1 from pg_catalog.pg_locks where locktype='advisory'
    and pid=pg_catalog.pg_backend_pid() and classid=73106 and objid=31 and objsubid=2
    and mode='ExclusiveLock' and granted) then
    raise exception using errcode='42501',message='owned media session required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-media:'||p_execution_id,0));
end $$;

create function ops.claim_media_batch(p_execution_id text,p_limit int default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare claim ops.audit_log%rowtype; terminal jsonb; q record; prior jsonb; prior_outcome jsonb;
  messages jsonb:='[]'; held jsonb:='[]'; msg jsonb; item_id uuid; safe_skip boolean; reason text;
begin
  perform private.assert_media_session(p_execution_id);
  select * into claim from ops.audit_log where action='media_batch_claim'
    and entity_type='media_batch' and entity_id=p_execution_id order by id limit 1 for update;
  if found then
    select a.after into terminal from ops.audit_log a where a.action='media_batch_finish'
      and a.entity_type='media_batch' and a.entity_id=p_execution_id order by a.id desc limit 1;
    return jsonb_build_object('replayed',true,'state',case when terminal is null then 'reconciliation_required' else 'finished' end,
      'messages','[]'::jsonb,'held_count',coalesce(jsonb_array_length(claim.after->'held'),0),'result',terminal);
  end if;
  if p_limit is null or p_limit not between 1 and 50 then raise exception using errcode='22023',message='invalid bounded media batch size'; end if;
  for q in select * from ops.claim_queue_batch('media',p_limit,600) loop
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
      select a.after into prior from ops.audit_log a where a.action='media_message_claim'
        and a.entity_type='media_message' and a.entity_id=q.msg_id::text order by a.id desc limit 1;
      if prior is not null and not safe_skip then
        select a.after into prior_outcome from ops.audit_log a where a.action='media_message_outcome'
          and a.entity_type='media_message' and a.entity_id=q.msg_id::text
          and a.after->>'execution_id'=prior->>'execution_id'
          and a.after->>'read_ct'=prior->>'read_ct' order by a.id desc limit 1;
        if prior_outcome is null then reason:='uncertain_prior_batch';
        elsif prior_outcome->>'outcome'='reconciliation_required' then reason:='prior_reconciliation_required'; end if;
      end if;
    end if;
    if reason is not null then
      held:=held||jsonb_build_array(jsonb_build_object('msg_id',q.msg_id::text,'reason',reason));
      insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
        values('n8n','media_message_held','media_message',q.msg_id::text,
          jsonb_build_object('execution_id',p_execution_id,'reason',reason,'cost_usd',null));
    else
      messages:=messages||jsonb_build_array(msg);
      insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
        values('n8n','media_message_claim','media_message',q.msg_id::text,
          jsonb_build_object('execution_id',p_execution_id,'item_id',item_id,'read_ct',q.read_ct));
    end if;
  end loop;
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
    values('n8n','media_batch_claim','media_batch',p_execution_id,
      jsonb_build_object('messages',messages,'held',held,'batch_limit',p_limit,'cost_usd',null));
  return jsonb_build_object('replayed',false,'state','running','messages',messages,'held_count',jsonb_array_length(held));
end $$;

create function ops.record_media_outcome(p_execution_id text,p_outcome jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare claim jsonb; msg jsonb; id text; v_item_id uuid; item app.items%rowtype; ids text[]; outcome text; code text;
  q_claim pgmq.q_media%rowtype;
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
  select a.after into claim from ops.audit_log a where a.action='media_batch_claim'
    and a.entity_type='media_batch' and a.entity_id=p_execution_id order by a.id limit 1;
  if claim is null or exists(select 1 from ops.audit_log a where a.action='media_batch_finish'
    and a.entity_type='media_batch' and a.entity_id=p_execution_id) then
    raise exception using errcode='55000',message='open owned media batch required';
  end if;
  foreach id in array ids loop
    select x into msg from jsonb_array_elements(claim->'messages') x where x->>'msg_id'=id;
    select * into q_claim from pgmq.q_media q where q.msg_id::text=id for update;
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
  if exists(select 1 from ops.audit_log a where a.action='media_outcome' and a.entity_type='media_batch_item'
    and a.entity_id=p_execution_id||':'||v_item_id::text and a.after=p_outcome) then return; end if;
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
    values('n8n','media_outcome','media_batch_item',p_execution_id||':'||v_item_id::text,p_outcome);
  foreach id in array ids loop
    select x into msg from jsonb_array_elements(claim->'messages') x where x->>'msg_id'=id;
    insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
      values('n8n','media_message_outcome','media_message',id,jsonb_build_object('execution_id',p_execution_id,
        'item_id',v_item_id,'read_ct',msg->'read_ct','outcome',outcome,'code',code));
  end loop;
end $$;

create function ops.ack_media_batch(p_execution_id text,p_msg_ids bigint[])
returns void language plpgsql security definer set search_path='' as $$
declare claim jsonb; msg jsonb; v_msg_id bigint; outcome jsonb; q_claim pgmq.q_media%rowtype;
begin
  perform private.assert_media_session(p_execution_id);
  if p_msg_ids is null or coalesce(array_ndims(p_msg_ids),1)<>1 or cardinality(p_msg_ids) not between 1 and 50
    or exists(select 1 from unnest(p_msg_ids) x where x is null or x<1)
    or cardinality(p_msg_ids)<>(select count(distinct x) from unnest(p_msg_ids) x) then
    raise exception using errcode='22023',message='invalid media acknowledgment IDs';
  end if;
  select a.after into claim from ops.audit_log a where a.action='media_batch_claim'
    and a.entity_type='media_batch' and a.entity_id=p_execution_id order by a.id limit 1;
  if claim is null then raise exception using errcode='42501',message='owned media batch required'; end if;
  foreach v_msg_id in array p_msg_ids loop
    select x into msg from jsonb_array_elements(claim->'messages') x where x->>'msg_id'=v_msg_id::text;
    if msg is null then raise exception using errcode='42501',message='owned media message required'; end if;
    if exists(select 1 from ops.audit_log a where a.action='media_message_ack' and a.entity_type='media_message'
      and a.entity_id=v_msg_id::text and a.after->>'execution_id'=p_execution_id) then continue; end if;
    if exists(select 1 from ops.audit_log a where a.action='media_batch_finish' and a.entity_type='media_batch'
      and a.entity_id=p_execution_id) then
      raise exception using errcode='55000',message='finished media batch cannot release more work';
    end if;
    select a.after into outcome from ops.audit_log a where a.action='media_message_outcome'
      and a.entity_type='media_message' and a.entity_id=v_msg_id::text and a.after->>'execution_id'=p_execution_id order by a.id desc limit 1;
    select * into q_claim from pgmq.q_media q where q.msg_id=v_msg_id for update;
    if outcome is null or outcome->>'outcome' not in ('stored','skipped','media_expired') or q_claim.msg_id is null
      or q_claim.read_ct<>(msg->>'read_ct')::int or q_claim.message->>'item_id'<>msg->'message'->>'item_id' or q_claim.vt<=now() then
      raise exception using errcode='42501',message='durable safe outcome and current claim required';
    end if;
    perform ops.ack_queue('media',array[v_msg_id]);
    insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
      values('n8n','media_message_ack','media_message',v_msg_id::text,jsonb_build_object('execution_id',p_execution_id,'cost_usd',null));
  end loop;
end $$;

create function ops.finish_media_batch(p_execution_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare claim jsonb; result jsonb; n_claimed int; n_held int; n_acked int; n_items int; n_reconciliation int; n_bytes bigint;
  n_stored int; n_skipped int; n_expired int; n_retryable int; n_expected int;
begin
  perform private.assert_media_session(p_execution_id);
  select a.after into result from ops.audit_log a where a.action='media_batch_finish'
    and a.entity_type='media_batch' and a.entity_id=p_execution_id order by a.id desc limit 1;
  if result is not null then return result; end if;
  select a.after into claim from ops.audit_log a where a.action='media_batch_claim'
    and a.entity_type='media_batch' and a.entity_id=p_execution_id order by a.id limit 1;
  if claim is null then raise exception using errcode='42501',message='owned media batch required'; end if;
  n_claimed:=jsonb_array_length(claim->'messages'); n_held:=jsonb_array_length(claim->'held');
  select count(distinct x->'message'->>'item_id')::int into n_expected from jsonb_array_elements(claim->'messages') x;
  select count(*)::int into n_acked from ops.audit_log a where a.action='media_message_ack'
    and a.entity_type='media_message' and a.after->>'execution_id'=p_execution_id;
  select count(*)::int,coalesce(sum(bytes),0),count(*) filter(where outcome='reconciliation_required')::int,
    count(*) filter(where outcome='stored')::int,count(*) filter(where outcome='skipped')::int,
    count(*) filter(where outcome='media_expired')::int,count(*) filter(where outcome='retryable')::int
    into n_items,n_bytes,n_reconciliation,n_stored,n_skipped,n_expired,n_retryable from (
      select distinct on(a.entity_id) a.entity_id,a.after->>'outcome' outcome,
        max((a.after->>'bytes')::int) over(partition by a.entity_id) bytes
      from ops.audit_log a where a.action='media_outcome' and a.entity_type='media_batch_item'
        and a.entity_id like p_execution_id||':%' order by a.entity_id,a.id desc) outcomes;
  result:=jsonb_build_object('state',case when n_held>0 or n_reconciliation>0 or n_items<n_expected then 'reconciliation_required'
    when n_acked<n_claimed then 'partial' else 'completed' end,'claimed',n_claimed+n_held,'held',n_held,
    'processed',n_items,'stored',n_stored,'skipped',n_skipped,'expired',n_expired,'retryable',n_retryable,
    'reconciliation_required',n_reconciliation,'bytes',n_bytes,'infrastructure_cost_usd',null);
  insert into ops.audit_log(actor_type,action,entity_type,entity_id,after)
    values('n8n','media_batch_finish','media_batch',p_execution_id,result);
  return result;
end $$;

revoke all on function private.assert_media_session(text) from public,anon,authenticated,n8n_writer,api_agent;
revoke all on function ops.claim_media_batch(text,int),ops.record_media_outcome(text,jsonb),
  ops.ack_media_batch(text,bigint[]),ops.finish_media_batch(text) from public,anon,authenticated,api_agent;
grant execute on function ops.claim_media_batch(text,int),ops.record_media_outcome(text,jsonb),
  ops.ack_media_batch(text,bigint[]),ops.finish_media_batch(text) to n8n_writer;
