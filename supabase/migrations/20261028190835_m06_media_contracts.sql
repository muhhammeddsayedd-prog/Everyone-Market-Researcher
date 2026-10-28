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
