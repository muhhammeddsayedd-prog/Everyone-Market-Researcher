-- M01: invoker RPCs keep every search branch behind the caller's RLS.
create function app.me()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('user_id',m.user_id,'email',m.email,'full_name',m.full_name,
    'role',m.role,'status',m.status)
  from app.members m where m.user_id = (select auth.uid());
$$;

create function app.search(
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

create function app.similar(p_entity_type text,p_entity_id uuid,p_limit int default 12)
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
  join entities target on target.t = e2.entity_type and target.id = e2.entity_id
  where e1.entity_type = p_entity_type and e1.entity_id = p_entity_id
  order by e2.embedding operator(extensions.<=>) e1.embedding,e2.entity_id
  limit greatest(0,least(coalesce(p_limit,12),100));
$$;

create function private.require_api_scope(p_scope text)
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if not coalesce(p_scope = any(string_to_array(current_setting('app.api_scope',true),','))
    or 'admin' = any(string_to_array(current_setting('app.api_scope',true),',')),false) then
    raise exception 'insufficient_scope: % required',p_scope using errcode = '42501';
  end if;
end $$;

revoke execute on function app.me(),app.search(text,extensions.vector,text[],jsonb,int),
  app.similar(text,uuid,int),private.require_api_scope(text) from public,anon;
grant execute on function app.me() to authenticated;
grant execute on function app.search(text,extensions.vector,text[],jsonb,int),app.similar(text,uuid,int)
  to authenticated,api_agent;
grant usage on schema private to api_agent;
grant execute on function private.require_api_scope(text) to api_agent;

-- Later review/admin/agent-write RPCs are deliberately absent (M11/M14).
