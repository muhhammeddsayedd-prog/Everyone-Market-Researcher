-- everyone. Market Radar — core tables, indexes, settings and queues.
-- Created with the Supabase CLI; adapted from reference/sql/002 (preserved).
-- Conventions: uuid PKs (gen_random_uuid()) for entities, bigint identity for logs/ledgers,
-- timestamptz everywhere, every FK indexed, lowercase snake_case.

-- ═════════════════════════════ app: people using the app ═════════════════════════════
create table app.members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text,
  role         app.member_role not null default 'viewer',
  status       app.member_status not null default 'active',
  invited_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);
create index on app.members (invited_by);

create table app.member_invites (            -- pre-approved emails before first login
  email       text primary key check (email = lower(email)),
  role        app.member_role not null default 'viewer',
  invited_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index on app.member_invites (invited_by);

create table app.allowed_domains (           -- any verified Google account on these domains may join as viewer
  domain     text primary key check (domain = lower(domain)),
  created_at timestamptz not null default now()
);

-- ═════════════════════════════ app: competitors and accounts ═════════════════════════════
create table app.competitors (
  id                 uuid primary key default gen_random_uuid(),
  company_code       text not null unique,                     -- 'C000' (baseline) … 'C284'
  slug               text not null unique,
  name               text not null,
  name_ar            text,
  aliases            text[] not null default '{}',
  markets            app.country_code[] not null default '{}',
  hq_country         app.country_code,
  categories         text[] not null default '{}',             -- taxonomy 'competitor_category' codes/labels
  in_house           text[] not null default '{}',             -- taxonomy 'in_house_capability'
  logo_url           text,
  logo_path          text,                                     -- Storage copy (media/logos/…)
  website_url        text,
  priority_tier      app.priority_tier not null,
  pilot_rank         int check (pilot_rank between 1 and 50),
  is_baseline        boolean not null default false,
  status             text not null default 'active' check (status in ('active','paused','archived')),
  notes              text,
  source_sheet_row   int,
  search_tsv         tsvector,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index competitors_one_baseline on app.competitors (is_baseline) where is_baseline;
create index on app.competitors using gin (search_tsv);
create index on app.competitors using gin (name extensions.gin_trgm_ops);

create table app.competitor_accounts (
  id                      uuid primary key default gen_random_uuid(),
  competitor_id           uuid not null references app.competitors(id) on delete cascade,
  platform                app.platform not null,
  handle                  text not null,          -- username / slug / domain / channel handle / work-page URL
  handle_norm             text generated always as (lower(handle)) stored,
  url                     text not null,
  external_id             text,                   -- Vimeo user id, YouTube channel id (UC…), LinkedIn company id
  uploads_playlist_id     text,                   -- YouTube UU… playlist
  resolve_status          text not null default 'pending' check (resolve_status in ('pending','resolved','failed','not_needed')),
  status                  app.account_status not null default 'active',
  cadence                 interval not null default interval '1 day',
  next_due_at             timestamptz not null default now(),
  locked_until            timestamptz,
  last_run_id             uuid,
  last_success_at         timestamptz,
  last_error_at           timestamptz,
  last_error              text,
  consecutive_failures    int not null default 0,
  last_item_published_at  timestamptz,            -- watermark
  last_external_id        text,                   -- watermark
  backfill_from           date not null default date '2024-01-01',
  backfill_status         app.backfill_status not null default 'pending',
  backfill_cursor         jsonb,                  -- page token / oldest date reached
  items_count             int not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
alter table app.competitor_accounts add constraint competitor_accounts_platform_handle unique (platform, handle_norm);  -- usable as ON CONFLICT target
create index on app.competitor_accounts (competitor_id);
create index on app.competitor_accounts (last_run_id);
create index competitor_accounts_due on app.competitor_accounts (platform, next_due_at)
  where status in ('active','failing');

-- ═════════════════════════════ app: organizations, people ═════════════════════════════
create table app.organizations (
  id           uuid primary key default gen_random_uuid(),
  kind         app.org_kind not null,
  name         text not null,
  name_ar      text,
  slug         text not null unique,
  industry     text,                              -- taxonomy 'industry' code (brands)
  country      app.country_code,
  website      text,
  logo_url     text,
  status       app.entity_status not null default 'unconfirmed',
  merged_into  uuid references app.organizations(id),
  seen_count   int not null default 0,
  search_tsv   tsvector,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on app.organizations (kind, status);
create index on app.organizations (merged_into);
create index on app.organizations using gin (search_tsv);
create index on app.organizations using gin (name extensions.gin_trgm_ops);

create table app.org_aliases (
  id                bigint generated always as identity primary key,
  org_id            uuid not null references app.organizations(id) on delete cascade,
  alias             text not null,                -- as seen: "@vodafoneegypt", "Vodafone Egypt", "فودافون"
  alias_normalized  text not null,                -- lower(unaccent(alias)) without @ # spaces/punct
  source            text not null default 'ai' check (source in ('ai','human','seed','handle')),
  created_at        timestamptz not null default now(),
  unique (alias_normalized, org_id)
);
create index on app.org_aliases (org_id);
create index on app.org_aliases using gin (alias_normalized extensions.gin_trgm_ops);

create table app.people (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  name_ar            text,
  slug               text not null unique,
  primary_role       text,                        -- taxonomy 'credit_role'
  linkedin_public_id text unique,                 -- public identifier only, for dedupe of employee snapshots
  status             app.entity_status not null default 'unconfirmed',
  merged_into        uuid references app.people(id),
  search_tsv         tsvector,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on app.people (merged_into);
create index on app.people using gin (name extensions.gin_trgm_ops);
create index on app.people using gin (search_tsv);

create table app.person_aliases (
  id               bigint generated always as identity primary key,
  person_id        uuid not null references app.people(id) on delete cascade,
  alias            text not null,
  alias_normalized text not null,
  source           text not null default 'ai',
  unique (alias_normalized, person_id)
);
create index on app.person_aliases (person_id);
create index on app.person_aliases using gin (alias_normalized extensions.gin_trgm_ops);

-- ═════════════════════════════ app: items (the core) ═════════════════════════════
create table app.items (
  id                    uuid primary key default gen_random_uuid(),
  competitor_id         uuid not null references app.competitors(id),
  account_id            uuid references app.competitor_accounts(id),
  platform              app.platform not null,
  item_type             app.item_type not null,
  external_id           text not null,
  url                   text not null,
  published_at          timestamptz,
  first_seen_at         timestamptz not null default now(),
  title                 text,
  caption_original      text,
  caption_en            text,
  language              text check (language in ('ar','en','mixed','other')),
  hashtags              text[] not null default '{}',
  mentions              text[] not null default '{}',
  tagged_accounts       text[] not null default '{}',
  duration_seconds      int,
  thumbnail_source_url  text,
  thumbnail_path        text,                     -- Storage path once WF-31 saved it
  metrics               jsonb not null default '{}',   -- {views, likes, comments, plays, shares} latest snapshot
  metrics_updated_at    timestamptz,
  status                app.item_status not null default 'active',
  removed_detected_at   timestamptz,
  content_hash          text,
  duplicate_of          uuid references app.items(id),
  -- AI fields
  ai_status             app.ai_status not null default 'pending',
  is_commercial_work    boolean,
  content_type          text,                     -- taxonomy 'content_format'
  brand_id              uuid references app.organizations(id),
  agency_id             uuid references app.organizations(id),
  production_competitor_id uuid references app.competitors(id),  -- usually = competitor_id; may credit another house
  country               app.country_code,
  occasion              text,                     -- taxonomy 'occasion'
  campaign_title        text,
  summary_en            text,
  summary_ar            text,
  tags                  text[] not null default '{}',
  confidence            numeric(4,3),
  field_confidence      jsonb not null default '{}',
  evidence              jsonb not null default '{}',
  locked_fields         text[] not null default '{}',  -- fields a human corrected; AI never overwrites
  last_extraction_id    bigint,
  search_tsv            tsvector,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (platform, external_id)
);
create index items_competitor_published on app.items (competitor_id, published_at desc, id desc);
create index items_platform_published   on app.items (platform, published_at desc, id desc);
create index items_feed                 on app.items (published_at desc, id desc) where status = 'active' and ai_status = 'published';
create index items_ai_status            on app.items (ai_status, created_at);
create index on app.items (account_id);
create index on app.items (brand_id);
create index on app.items (agency_id);
create index on app.items (production_competitor_id);
create index on app.items (duplicate_of);
create index on app.items (last_extraction_id);
create index on app.items (content_hash);
create index on app.items using gin (search_tsv);

create table app.item_credits (
  id              bigint generated always as identity primary key,
  item_id         uuid not null references app.items(id) on delete cascade,
  person_id       uuid references app.people(id),
  person_name_raw text not null,
  role            text not null,                  -- taxonomy 'credit_role'
  organization_id uuid references app.organizations(id),
  competitor_id   uuid references app.competitors(id),  -- when the credited org is a tracked competitor
  source          text not null default 'ai' check (source in ('ai','human','website')),
  confidence      numeric(4,3),
  created_at      timestamptz not null default now(),
  unique (item_id, person_name_raw, role)
);
create index on app.item_credits (item_id);
create index on app.item_credits (person_id);
create index on app.item_credits (organization_id);
create index on app.item_credits (competitor_id);

create table app.media_assets (
  id           bigint generated always as identity primary key,
  item_id      uuid references app.items(id) on delete cascade,
  competitor_id uuid references app.competitors(id) on delete cascade,
  kind         text not null check (kind in ('thumbnail','key_frame','logo')),
  storage_path text not null unique,
  source_url   text,
  width        int,
  height       int,
  created_at   timestamptz not null default now()
);
create index on app.media_assets (item_id);
create index on app.media_assets (competitor_id);

-- ═════════════════════════════ app: campaigns ═════════════════════════════
create table app.campaigns (
  id                        uuid primary key default gen_random_uuid(),
  brand_id                  uuid references app.organizations(id),
  production_competitor_id  uuid references app.competitors(id),
  agency_id                 uuid references app.organizations(id),
  title                     text not null,
  occasion                  text,
  country                   app.country_code,
  first_seen_at             timestamptz not null,
  last_seen_at              timestamptz not null,
  item_count                int not null default 0,
  platforms                 app.platform[] not null default '{}',
  summary_en                text,
  summary_ar                text,
  confidence                numeric(4,3),
  status                    text not null default 'active' check (status in ('active','review','merged')),
  merged_into               uuid references app.campaigns(id),
  locked_by_human           boolean not null default false,
  search_tsv                tsvector,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index on app.campaigns (brand_id, last_seen_at desc);
create index on app.campaigns (production_competitor_id, last_seen_at desc);
create index on app.campaigns (agency_id);
create index on app.campaigns (merged_into);
create index on app.campaigns (last_seen_at desc);
create index on app.campaigns using gin (search_tsv);

create table app.campaign_items (
  campaign_id uuid not null references app.campaigns(id) on delete cascade,
  item_id     uuid not null unique references app.items(id) on delete cascade,  -- one campaign per item
  added_by    text not null default 'ai' check (added_by in ('ai','human')),
  similarity  numeric(4,3),
  created_at  timestamptz not null default now(),
  primary key (campaign_id, item_id)
);

-- ═════════════════════════════ app: websites, LinkedIn employees, news, briefs ═════════════════════════════
create table app.website_pages (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references app.competitor_accounts(id) on delete cascade,
  competitor_id uuid not null references app.competitors(id) on delete cascade,
  url           text not null unique,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  crawled_at    timestamptz,
  status        text not null default 'new' check (status in ('new','crawled','ignored','removed','failed')),
  item_id       uuid references app.items(id)
);
create index on app.website_pages (account_id, status);
create index on app.website_pages (competitor_id);
create index on app.website_pages (item_id);

create table app.employee_snapshots (
  id               bigint generated always as identity primary key,
  competitor_id    uuid not null references app.competitors(id) on delete cascade,
  account_id       uuid references app.competitor_accounts(id),
  snapshot_date    date not null,
  headcount_listed int not null,
  people           jsonb not null default '[]',   -- [{public_id, name, title, location}]
  joined           jsonb not null default '[]',   -- vs previous snapshot
  left_company     jsonb not null default '[]',
  created_at       timestamptz not null default now(),
  unique (competitor_id, snapshot_date)
);
create index on app.employee_snapshots (account_id);

create table app.news_articles (
  id           uuid primary key default gen_random_uuid(),
  url          text not null unique,
  kind         text not null check (kind in ('news','award')),
  title        text not null,
  source_name  text,
  published_at timestamptz,
  snippet      text,
  language     text,
  summary_en   text,
  query        text,                              -- SerpAPI query that found it
  search_tsv   tsvector,
  created_at   timestamptz not null default now()
);
create index on app.news_articles (published_at desc);
create index on app.news_articles using gin (search_tsv);

create table app.news_mentions (
  article_id    uuid not null references app.news_articles(id) on delete cascade,
  entity_type   text not null check (entity_type in ('competitor','organization','person','campaign')),
  entity_id     uuid not null,
  primary key (article_id, entity_type, entity_id)
);
create index on app.news_mentions (entity_type, entity_id);

create table app.briefs (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null,                       -- Monday
  scope       text not null check (scope in ('EG','KSA','UAE','ALL')),
  title       text not null,
  body_md     text not null,
  highlights  jsonb not null default '[]',         -- [{claim, item_ids[]}]
  source_item_ids uuid[] not null default '{}',
  model       text,
  prompt_version text,
  created_at  timestamptz not null default now(),
  unique (week_start, scope)
);

-- ═════════════════════════════ app: review, taxonomies, alerts, views, embeddings ═════════════════════════════
create table app.review_tasks (
  id           bigint generated always as identity primary key,
  kind         app.review_kind not null,
  entity_type  text not null,                      -- 'item' | 'organization' | 'person' | 'campaign' | 'account'
  entity_id    text not null,
  reason       text,
  suggestion   jsonb not null default '{}',
  status       app.review_status not null default 'open',
  priority     int not null default 100,
  assigned_to  uuid references auth.users(id),
  resolved_by  uuid references auth.users(id),
  resolved_at  timestamptz,
  resolution   jsonb,
  created_at   timestamptz not null default now()
);
create index review_open on app.review_tasks (status, priority, created_at) where status = 'open';
create index on app.review_tasks (entity_type, entity_id);
create index on app.review_tasks (assigned_to);
create index on app.review_tasks (resolved_by);

create table app.taxonomy_terms (
  id        bigint generated always as identity primary key,
  taxonomy  text not null check (taxonomy in ('industry','content_format','occasion','competitor_category',
                                               'credit_role','in_house_capability')),
  code      text not null,
  label_en  text not null,
  label_ar  text,
  sort      int not null default 100,
  active    boolean not null default true,
  unique (taxonomy, code)
);

create table app.alert_rules (
  id          bigint generated always as identity primary key,
  name        text not null,
  kind        text not null check (kind in ('daily_digest','instant_launch','new_client','budget','failing_sources','weekly_brief')),
  filters     jsonb not null default '{}',
  recipients  text[] not null,
  active      boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index on app.alert_rules (created_by);

create table app.saved_views (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  path       text not null,
  filters    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on app.saved_views (user_id);

create table app.embeddings (
  id           bigint generated always as identity primary key,
  entity_type  text not null check (entity_type in ('item','campaign','competitor','organization','brief')),
  entity_id    uuid not null,
  model        text not null,
  content_hash text not null,                      -- re-embed only when content changes
  embedding    extensions.vector(1536) not null,
  updated_at   timestamptz not null default now(),
  unique (entity_type, entity_id)
);
create index embeddings_hnsw on app.embeddings using hnsw (embedding extensions.vector_cosine_ops);

create table app.stats_daily (                     -- refreshed by WF-91 / pg_cron
  day             date not null,
  competitor_id   uuid not null references app.competitors(id) on delete cascade,
  platform        app.platform not null,
  country         app.country_code,
  items_new       int not null default 0,
  commercial_new  int not null default 0,
  campaigns_new   int not null default 0,
  primary key (day, competitor_id, platform)
);
create index on app.stats_daily (competitor_id, day desc);

-- ═════════════════════════════ ingest ═════════════════════════════
create table ingest.raw_items (
  id           bigint generated always as identity primary key,
  platform     app.platform not null,
  external_id  text not null,
  account_id   uuid references app.competitor_accounts(id),
  run_id       uuid,
  actor        text,                               -- e.g. 'apify/instagram-scraper', 'vimeo-api'
  payload      jsonb not null,                     -- untouched source object
  normalized   jsonb not null,                     -- normalized item contract
  content_hash text,
  fetched_at   timestamptz not null default now(),
  unique (platform, external_id)
);
create index on ingest.raw_items (account_id);
create index on ingest.raw_items (run_id);

-- ═════════════════════════════ ops ═════════════════════════════
create table ops.scrape_runs (
  id                uuid primary key default gen_random_uuid(),
  workflow          text not null,                 -- 'WF-11'
  platform          app.platform,
  mode              text not null default 'daily' check (mode in ('daily','backfill','weekly','manual','removal_check')),
  env               text not null check (env in ('dev','prod')),
  n8n_execution_id  text,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running' check (status in ('running','success','partial','failed')),
  accounts_total    int not null default 0,
  accounts_ok       int not null default 0,
  accounts_failed   int not null default 0,
  items_seen        int not null default 0,
  items_new         int not null default 0,
  cost_usd          numeric(12,6) not null default 0,
  error             text
);
create index on ops.scrape_runs (started_at desc);
create index on ops.scrape_runs (workflow, started_at desc);

create table ops.scrape_run_accounts (
  run_id      uuid not null references ops.scrape_runs(id) on delete cascade,
  account_id  uuid not null references app.competitor_accounts(id) on delete cascade,
  status      text not null check (status in ('success','failed','skipped')),
  items_seen  int not null default 0,
  items_new   int not null default 0,
  error       text,
  finished_at timestamptz not null default now(),
  primary key (run_id, account_id)
);
create index on ops.scrape_run_accounts (account_id, finished_at desc);

create table ops.apify_runs (
  apify_run_id  text primary key,
  actor_id      text not null,
  run_id        uuid references ops.scrape_runs(id),
  account_ids   uuid[] not null,
  purpose       text not null check (purpose in ('daily','backfill','removal_check','weekly')),
  status        text not null default 'RUNNING',
  dataset_id    text,
  usage_usd     numeric(12,6),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  processed_at  timestamptz
);
create index on ops.apify_runs (run_id);

create table ops.ai_extractions (
  id             bigint generated always as identity primary key,
  item_id        uuid not null references app.items(id) on delete cascade,
  schema_version text not null,
  prompt_version text not null,
  model          text not null,
  input_tokens   int,
  output_tokens  int,
  cost_usd       numeric(12,6),
  used_vision    boolean not null default false,
  latency_ms     int,
  output         jsonb not null,
  confidence     numeric(4,3),
  created_at     timestamptz not null default now()
);
create index on ops.ai_extractions (item_id, created_at desc);

create table ops.price_book (
  provider     text not null,
  sku          text not null,                      -- 'gpt-…:input', 'apify:instagram-scraper:result', 'serpapi:search'
  unit         text not null,                      -- '1M tokens', '1k results', 'search', 'credit', 'month'
  usd_per_unit numeric(14,8) not null,
  valid_from   date not null default current_date,
  primary key (provider, sku, valid_from)
);

create table ops.cost_ledger (
  id            bigint generated always as identity primary key,
  day           date not null default current_date,
  provider      text not null check (provider in ('apify','openai','serpapi','firecrawl','vimeo','youtube','n8n','supabase','vercel','email','other')),
  category      text not null,                     -- 'scrape','ai_extract','embed','brief','news','fixed_fee'
  quantity      numeric(14,4) not null default 1,
  unit          text not null,
  cost_usd      numeric(12,6) not null,
  run_id        uuid references ops.scrape_runs(id),
  item_id       uuid references app.items(id) on delete set null,
  competitor_id uuid references app.competitors(id) on delete set null,
  platform      app.platform,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index on ops.cost_ledger (day, provider);
create index on ops.cost_ledger (run_id);
create index on ops.cost_ledger (item_id);
create index on ops.cost_ledger (competitor_id, day);

create table ops.api_keys (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  prefix             text not null unique,         -- shown in UI: emr_ab12cd
  key_hash           text not null,                -- sha256(secret || pepper), hex
  scopes             text[] not null check (scopes <@ array['read','write','admin']),
  rate_limit_per_min int not null default 120,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz,
  revoked_at         timestamptz
);
create index on ops.api_keys (created_by);

create table ops.api_calls (
  id          bigint generated always as identity primary key,
  key_id      uuid references ops.api_keys(id),
  transport   text not null check (transport in ('rest','mcp')),
  tool        text not null,
  status      int not null,
  duration_ms int,
  created_at  timestamptz not null default now()
);
create index on ops.api_calls (key_id, created_at desc);

create table ops.audit_log (
  id          bigint generated always as identity primary key,
  actor_type  text not null check (actor_type in ('user','api_key','n8n','system')),
  actor_id    text,
  action      text not null,
  entity_type text,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index on ops.audit_log (entity_type, entity_id);
create index on ops.audit_log (created_at desc);

create table ops.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into ops.settings (key, value) values
  ('auto_publish_threshold', '0.80'),
  ('campaign_window_days', '45'),
  ('campaign_similarity_min', '0.82'),
  ('alias_trgm_min', '0.6'),
  ('alias_embedding_min', '0.85'),
  ('daily_budget_usd', '150'),            -- during backfill; lower to ~25 for steady state (Q-07)
  ('metrics_refresh_days', '30'),
  ('removal_window_days', '90'),
  ('stories_twice_daily', 'false'),
  ('ai_batch_size', '20'),
  ('vision_max_share', '0.3'),
  ('stats_daily_enabled', 'false'),      -- switched on in M10
  ('ai_batch_mode', 'false');            -- optional OpenAI Batch API path (M07)

-- ── Queues (Supabase Queues / pgmq) ──
select pgmq.create('ai_extract');
select pgmq.create('embed');
select pgmq.create('media');

-- Cross-schema references follow table creation to avoid dependency cycles.
alter table app.competitor_accounts add constraint competitor_accounts_last_run_id_fkey
  foreign key (last_run_id) references ops.scrape_runs(id);
alter table ingest.raw_items add constraint raw_items_run_id_fkey
  foreign key (run_id) references ops.scrape_runs(id);
alter table app.items add constraint items_last_extraction_id_fkey
  foreign key (last_extraction_id) references ops.ai_extractions(id);

-- RLS and ACLs are applied in the same migration as the tables. Policies and
-- read-only grants follow in migration 3; machines never receive table writes.
do $$ declare r record; begin
  for r in select schemaname, tablename from pg_tables
    where schemaname in ('app','ingest','ops') loop
    execute format('alter table %I.%I enable row level security',r.schemaname,r.tablename);
  end loop;
end $$;
revoke all on all tables in schema app, ingest, ops from public, anon, authenticated, n8n_writer, api_agent;
revoke all on all sequences in schema app, ingest, ops from public, anon, authenticated, n8n_writer, api_agent;
