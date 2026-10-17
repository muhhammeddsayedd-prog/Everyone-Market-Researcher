-- everyone. Market Radar — DRAFT schema, part 5: RPCs for app users (authenticated) and agents (api_agent),
-- plus hybrid search. Reference only (see 001 header).
-- App RPCs live in schema app (exposed) and are SECURITY INVOKER by default; where they must write to tables
-- users cannot write directly, they call a private SECURITY DEFINER worker that re-checks the role.

-- ── Who am I ────────────────────────────────────────────────────────────────
create or replace function app.me()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('user_id', m.user_id, 'email', m.email, 'full_name', m.full_name, 'role', m.role, 'status', m.status)
  from app.members m where m.user_id = (select auth.uid());
$$;
grant execute on function app.me() to authenticated;

-- ── Review and corrections (analyst+) — SKETCH bodies, implement in M11 ──
-- app.review_resolve(p_task_id bigint, p_action text /* approve|correct|reject|snooze|merge */, p_payload jsonb) returns jsonb
--   → private.review_resolve_worker(...) SECURITY DEFINER: checks private.has_role('analyst');
--     applies the change (item fields + locked_fields, org/person merge, campaign merge/split),
--     teaches aliases (source 'human'), writes ops.audit_log, sets task status, enqueues 'embed' when content changed.
-- app.correct_item(p_item_id uuid, p_patch jsonb) returns void           -- analyst+, sets locked_fields
-- app.merge_organizations(p_keep uuid, p_merge uuid) returns void         -- analyst+
-- app.merge_people(p_keep uuid, p_merge uuid) returns void                -- analyst+
-- app.split_campaign(p_campaign_id uuid, p_item_ids uuid[]) returns uuid  -- analyst+

-- ── Admin (admin only) — SKETCH, implement in M11 ──
-- app.admin_upsert_competitor(p jsonb) returns uuid        -- creates competitor + accounts, sets backfill_status 'pending'
-- app.admin_set_account_status(p_account_id uuid, p_status app.account_status) returns void
-- app.admin_request_rescrape(p_account_id uuid, p_mode text) returns void   -- sets next_due_at = now() (and backfill reset if asked)
-- app.admin_invite_member(p_email text, p_role app.member_role) returns void
-- app.admin_set_member(p_user_id uuid, p_role app.member_role, p_status app.member_status) returns void
-- app.admin_store_api_key(p_name text, p_prefix text, p_hash text, p_scopes text[]) returns uuid  -- secret generated server-side
-- app.admin_revoke_api_key(p_id uuid) returns void
-- app.admin_upsert_taxonomy_term(p jsonb) returns bigint
-- app.admin_upsert_alert_rule(p jsonb) returns bigint
-- app.admin_set_setting(p_key text, p_value jsonb) returns void   -- e.g. auto_publish_threshold, daily_budget_usd
-- app.costs_summary(p_from date, p_to date) returns jsonb        -- admin; reads ops.cost_ledger via private worker
-- app.pipeline_summary(p_days int) returns jsonb                 -- admin; reads ops.scrape_runs via private worker

-- ── Hybrid search (keyword + semantic, reciprocal rank fusion) ──────────────
-- Called by the web app (as the signed-in user; RLS applies through security_invoker views/tables)
-- and by the API (as api_agent). The query embedding is computed in the app/API layer (OpenAI) and passed in.
create or replace function app.search(
  p_query text,
  p_embedding extensions.vector(1536) default null,
  p_types text[] default array['item','campaign','organization','person','competitor','news'],
  p_filters jsonb default '{}',          -- {country, platform, competitor_id, brand_id, from, to, content_type, occasion}
  p_limit int default 30
) returns table (entity_type text, entity_id uuid, title text, subtitle text, score double precision)
language sql stable set search_path = '' as $$
  with q as (select websearch_to_tsquery('simple', extensions.unaccent(coalesce(p_query, ''))) tsq),
  kw_items as (
    select 'item'::text t, i.id, coalesce(i.title, left(i.caption_original, 120)) title, i.summary_en sub,
           row_number() over (order by ts_rank_cd(i.search_tsv, q.tsq) desc) rk
    from app.items i, q
    where 'item' = any (p_types) and i.search_tsv @@ q.tsq and i.status = 'active' and i.duplicate_of is null
      and (p_filters->>'country' is null or i.country::text = p_filters->>'country')
      and (p_filters->>'platform' is null or i.platform::text = p_filters->>'platform')
      and (p_filters->>'competitor_id' is null or i.competitor_id = (p_filters->>'competitor_id')::uuid)
      and (p_filters->>'from' is null or i.published_at >= (p_filters->>'from')::timestamptz)
      and (p_filters->>'to' is null or i.published_at < (p_filters->>'to')::timestamptz)
    limit 100
  ),
  kw_orgs as (
    select 'organization'::text, o.id, o.name, o.kind::text,
           row_number() over (order by extensions.similarity(o.name, p_query) desc)
    from app.organizations o
    where 'organization' = any (p_types) and o.status <> 'merged'
      and (o.name operator(extensions.%) p_query or o.search_tsv @@ (select tsq from q))
    limit 50
  ),
  kw_campaigns as (
    select 'campaign'::text, c.id, c.title, c.summary_en,
           row_number() over (order by ts_rank_cd(c.search_tsv, q.tsq) desc)
    from app.campaigns c, q
    where 'campaign' = any (p_types) and c.status <> 'merged' and c.search_tsv @@ q.tsq
    limit 50
  ),
  sem as (
    select e.entity_type t, e.entity_id id,
           row_number() over (order by e.embedding operator(extensions.<=>) p_embedding) rk
    from app.embeddings e
    where p_embedding is not null and e.entity_type = any (p_types)
    order by e.embedding operator(extensions.<=>) p_embedding
    limit 100
  ),
  fused as (
    select t, id, sum(1.0 / (60 + rk)) score from (
      select t, id, rk from kw_items union all
      select * from (select "text" t, id, row_number rk from (select * from kw_orgs) x(text, id, name, kind, row_number)) y union all
      select * from (select "text" t, id, row_number rk from (select * from kw_campaigns) x(text, id, title, sub, row_number)) z union all
      select t, id, rk from sem
    ) u group by t, id
  )
  select f.t, f.id,
         coalesce(i.title, left(i.caption_original, 120), o.name, cp.title, p.name, cm.name, n.title),
         coalesce(i.summary_en, o.kind::text, cp.summary_en, p.primary_role, cm.hq_country::text, n.source_name),
         f.score
  from fused f
  left join app.items i          on f.t = 'item' and i.id = f.id
  left join app.organizations o  on f.t = 'organization' and o.id = f.id
  left join app.campaigns cp     on f.t = 'campaign' and cp.id = f.id
  left join app.people p         on f.t = 'person' and p.id = f.id
  left join app.competitors cm   on f.t = 'competitor' and cm.id = f.id
  left join app.news_articles n  on f.t = 'news' and n.id = f.id
  order by f.score desc
  limit p_limit;
$$;
-- NOTE: THIS DRAFT DOES NOT COMPILE AS-IS and MUST be rewritten in M11. The UNION column juggling above is illustrative; Codex should rewrite it cleanly (one CTE per source
-- returning (t, id, rk)), keep filters consistent, add people/competitor/news keyword branches, and test with
-- EXPLAIN ANALYZE on 100k synthetic rows (target < 800 ms).
grant execute on function app.search(text, extensions.vector, text[], jsonb, int) to authenticated, api_agent;

-- "Find similar" for an item or campaign
create or replace function app.similar(p_entity_type text, p_entity_id uuid, p_limit int default 12)
returns table (entity_type text, entity_id uuid, distance double precision)
language sql stable set search_path = '' as $$
  select e2.entity_type, e2.entity_id, e2.embedding operator(extensions.<=>) e1.embedding
  from app.embeddings e1
  join app.embeddings e2 on e2.entity_type = e1.entity_type and e2.entity_id <> e1.entity_id
  where e1.entity_type = p_entity_type and e1.entity_id = p_entity_id
  order by e2.embedding operator(extensions.<=>) e1.embedding
  limit p_limit;
$$;
grant execute on function app.similar(text, uuid, int) to authenticated, api_agent;

-- ── Agent write RPCs (api schema; executed by api_agent; scope set by the API layer) ──
-- The Next.js API runs: begin; select set_config('app.api_key_id', $1, true), set_config('app.api_scope', $2, true); … commit;
create or replace function private.require_api_scope(p_scope text)
returns void language plpgsql stable set search_path = '' as $$
begin
  if current_setting('app.api_scope', true) is null
     or not (p_scope = any (string_to_array(current_setting('app.api_scope', true), ','))
             or 'admin' = any (string_to_array(current_setting('app.api_scope', true), ','))) then
    raise exception 'insufficient_scope: % required', p_scope using errcode = '42501';
  end if;
end $$;
grant execute on function private.require_api_scope(text) to api_agent;
grant usage on schema private to api_agent;

-- api.add_competitor(p jsonb) returns uuid               -- requires 'write'; same worker as app.admin_upsert_competitor
-- api.resolve_review(p_task_id bigint, p_action text, p_payload jsonb) returns jsonb  -- requires 'write'
-- api.request_rescrape(p_account_id uuid, p_mode text) returns void                   -- requires 'admin'
-- api.market_stats(p_filters jsonb, p_group_by text[], p_from date, p_to date) returns jsonb  -- read
-- All api.* write functions: SECURITY DEFINER in schema api (not exposed via PostgREST), search_path = '',
-- first line `perform private.require_api_scope('write')`, then audit to ops.audit_log with actor_type 'api_key'.
