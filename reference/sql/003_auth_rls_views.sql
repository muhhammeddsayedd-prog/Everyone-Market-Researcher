-- everyone. Market Radar — DRAFT schema, part 3: membership, RLS, triggers, read views.
-- Reference only (see 001 header).

-- ── Helper functions (private, SECURITY DEFINER, never exposed) ──
create or replace function private.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.members m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function private.has_role(p_min app.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.members m
    where m.user_id = (select auth.uid()) and m.status = 'active'
      and (case m.role when 'admin' then 3 when 'analyst' then 2 else 1 end)
          >= (case p_min when 'admin' then 3 when 'analyst' then 2 else 1 end)
  );
$$;
revoke all on function private.is_member() from public;
revoke all on function private.has_role(app.member_role) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;
grant execute on function private.has_role(app.member_role) to authenticated;

-- ── New Google sign-in → membership if invited or allowed domain ──
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_role app.member_role; v_email text := lower(new.email);
begin
  select i.role into v_role from app.member_invites i where i.email = v_email;
  if v_role is null and exists (
       select 1 from app.allowed_domains d where d.domain = split_part(v_email, '@', 2)) then
    v_role := 'viewer';
  end if;
  if v_role is not null then
    insert into app.members (user_id, email, full_name, role, status)
    values (new.id, v_email, new.raw_user_meta_data->>'full_name', v_role, 'active')
    on conflict (user_id) do nothing;
    delete from app.member_invites where email = v_email;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
-- NOTE: role decisions never use user_metadata; full_name is display only.

-- ── Search vectors (trigger, because unaccent() is not immutable) ──
create or replace function private.norm(t text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(coalesce(t, ''), '[@#_\-\.\,\:;!\?\(\)\[\]"''`]+', ' ', 'g'));
$$;

create or replace function private.items_tsv()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_tsv :=
      setweight(to_tsvector('simple', extensions.unaccent(coalesce(new.title, '') || ' ' || coalesce(new.campaign_title, ''))), 'A')
   || setweight(to_tsvector('simple', extensions.unaccent(coalesce(new.summary_en, '') || ' ' || coalesce(new.summary_ar, ''))), 'B')
   || setweight(to_tsvector('simple', extensions.unaccent(coalesce(new.caption_original, '') || ' ' || coalesce(new.caption_en, '')
                 || ' ' || array_to_string(new.hashtags, ' ') || ' ' || array_to_string(new.mentions, ' ')
                 || ' ' || array_to_string(new.tags, ' '))), 'C');
  new.updated_at := now();
  return new;
end $$;
create trigger items_tsv before insert or update on app.items
  for each row execute function private.items_tsv();
-- Same pattern for app.campaigns, app.organizations, app.people, app.competitors, app.news_articles
-- (title/name weight A, summary/aliases B, other text C). Codex writes these in M01.

-- ── RLS: enable on EVERY table ──
do $$ declare r record; begin
  for r in select schemaname, tablename from pg_tables where schemaname in ('app','ingest','ops') loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;

-- app: members read everything; writes only through RPCs (no insert/update/delete policies)
do $$ declare t text; begin
  foreach t in array array['competitors','competitor_accounts','organizations','org_aliases','people','person_aliases',
    'items','item_credits','media_assets','campaigns','campaign_items','website_pages','employee_snapshots',
    'news_articles','news_mentions','briefs','taxonomy_terms','stats_daily','embeddings'] loop
    execute format('create policy "members read %1$s" on app.%1$I for select to authenticated using ((select private.is_member()))', t);
    execute format('grant select on app.%I to authenticated', t);
  end loop;
end $$;

-- review tasks: members read; analysts resolve via RPC only
create policy "members read review" on app.review_tasks for select to authenticated using ((select private.is_member()));
grant select on app.review_tasks to authenticated;

-- members table: everyone sees the team list; only admins via RPC change it
create policy "members read members" on app.members for select to authenticated using ((select private.is_member()));
grant select on app.members to authenticated;
-- invites, allowed_domains, alert_rules: admins only
create policy "admins read invites"  on app.member_invites  for select to authenticated using ((select private.has_role('admin')));
create policy "admins read domains"  on app.allowed_domains for select to authenticated using ((select private.has_role('admin')));
create policy "members read alerts"  on app.alert_rules     for select to authenticated using ((select private.is_member()));
grant select on app.member_invites, app.allowed_domains, app.alert_rules to authenticated;

-- saved views: owner only (full CRUD)
create policy "own views select" on app.saved_views for select to authenticated using ((select auth.uid()) = user_id);
create policy "own views insert" on app.saved_views for insert to authenticated with check ((select auth.uid()) = user_id and (select private.is_member()));
create policy "own views update" on app.saved_views for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own views delete" on app.saved_views for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on app.saved_views to authenticated;

-- ingest/ops: no policies for authenticated (deny all). Machine roles use SECURITY DEFINER RPCs only.
-- api_agent reads app tables through api.* views; give it RLS read policies too:
do $$ declare t text; begin
  foreach t in array array['competitors','competitor_accounts','organizations','org_aliases','people','person_aliases',
    'items','item_credits','media_assets','campaigns','campaign_items','employee_snapshots','news_articles','news_mentions',
    'briefs','taxonomy_terms','stats_daily','embeddings','review_tasks'] loop
    execute format('create policy "api agent read %1$s" on app.%1$I for select to api_agent using (true)', t);
    execute format('grant select on app.%I to api_agent', t);
  end loop;
end $$;
grant usage on schema app to api_agent;

-- ── Read views for the web app and API (security_invoker → RLS of the caller applies) ──
create or replace view app.feed_v with (security_invoker = true) as
select i.id, i.published_at, i.platform, i.item_type, i.url, i.title, i.caption_original, i.caption_en,
       i.summary_en, i.summary_ar, i.thumbnail_path, i.thumbnail_source_url, i.metrics, i.content_type, i.occasion,
       i.country, i.confidence, i.ai_status, i.status, i.is_commercial_work,
       c.id as competitor_id, c.slug as competitor_slug, c.name as competitor_name, c.logo_path as competitor_logo_path,
       c.priority_tier, b.id as brand_id, b.slug as brand_slug, b.name as brand_name, b.industry as brand_industry,
       a.id as agency_id, a.slug as agency_slug, a.name as agency_name,
       ci.campaign_id
from app.items i
join app.competitors c on c.id = i.competitor_id
left join app.organizations b on b.id = i.brand_id
left join app.organizations a on a.id = i.agency_id
left join app.campaign_items ci on ci.item_id = i.id
where i.duplicate_of is null;
grant select on app.feed_v to authenticated, api_agent;

-- Campaign list view for the web app (app schema) — api.campaigns_v selects from it.
create or replace view app.campaigns_v with (security_invoker = true) as
  select cp.*, b.name as brand_name, b.slug as brand_slug, c.name as competitor_name, c.slug as competitor_slug,
         c.logo_path as competitor_logo_path, a.name as agency_name, a.slug as agency_slug
  from app.campaigns cp
  left join app.organizations b on b.id = cp.brand_id
  left join app.competitors c on c.id = cp.production_competitor_id
  left join app.organizations a on a.id = cp.agency_id
  where cp.status <> 'merged';
grant select on app.campaigns_v to authenticated, api_agent;

create or replace view api.items_v       with (security_invoker = true) as select * from app.feed_v;
create or replace view api.competitors_v with (security_invoker = true) as
  select id, company_code, slug, name, name_ar, markets, hq_country, categories, in_house, logo_url, logo_path,
         website_url, priority_tier, pilot_rank, is_baseline, status from app.competitors;
create or replace view api.campaigns_v   with (security_invoker = true) as select * from app.campaigns_v;
create or replace view api.organizations_v with (security_invoker = true) as
  select id, kind, name, name_ar, slug, industry, country, website, logo_url, status, seen_count
  from app.organizations where status <> 'merged';
create or replace view api.people_v with (security_invoker = true) as
  select id, name, name_ar, slug, primary_role, status from app.people where status <> 'merged';
create or replace view api.briefs_v with (security_invoker = true) as select * from app.briefs;
create or replace view api.news_v   with (security_invoker = true) as select * from app.news_articles;
grant select on all tables in schema api to api_agent;
