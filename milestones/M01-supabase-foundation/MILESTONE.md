# M01 — Supabase foundation

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first.

## 1. Goal and outcome

When M01 is done, Supabase is the working source of truth, with:
- **Projects:** `emr-dev` and `emr-prod` (Pro). Both are linked to the repo and carry the same baseline schema, applied by migrations.
- **Schemas:** `app` (exposed, RLS), `ingest`, `ops`, `api` and `private` (not exposed). Each has its tables, enums, indexes, triggers and RLS policies.
- **Machine roles:** `n8n_writer` and `api_agent`, both LOGIN, with least-privilege grants, passwords set by the owner, and connections tested through the Supavisor pooler.
- **Core pipeline RPCs:** run log, due list with claim, per-account result, the single writer path `ingest.upsert_raw_items`, queue wrappers, and website diff.
- **App RPCs:** `app.me`, a first clean `app.search`, `app.similar`, and the scope helper for agents.
- **Data services:**
  - Supabase Queues (pgmq) `ai_extract`, `embed` and `media`;
  - `pg_cron` housekeeping jobs;
  - the Storage bucket `media`;
  - taxonomies, settings, price-book placeholders and the owner's invite, all seeded.
- **Auth:** the Google provider is configured on dev (prod after the owner's OK). The trigger that turns invites into memberships works.
- **Quality:**
  - pgTAP tests prove RLS, privileges, idempotency, claim/lock, failure counting and watermark advance;
  - `supabase db advisors` reports no security issues;
  - generated TS types are in `packages/shared/src/db.types.ts`;
  - a CI `db-tests` job runs it all.

## 2. Context you need

- **T-01:** Supabase Pro is the single source of truth, with separate dev and prod projects.
- **T-09:** n8n writes only through RPCs, as the LOGIN role `n8n_writer`. Never the secret/service key.
- **T-12:** agents read through `api_agent` (via the Next.js API), never the service key.
- **T-11:** invite-only Google sign-in. A trigger on `auth.users` creates `app.members` from `app.member_invites`. The domain auto-join (`app.allowed_domains`) is **off** by default (Q-01).
- **T-13, AGENTS hard rule 6:**
  - RLS on every table in every schema;
  - views `WITH (security_invoker = true)`;
  - `SECURITY DEFINER` only in non-exposed schemas (`private`, `ingest`, `ops`, `api`), with `SET search_path = ''`, fully-qualified names, `REVOKE EXECUTE … FROM PUBLIC`, and GRANT only to the one role that needs it;
  - no `user_metadata` in authorization;
  - `auth.uid()` is wrapped as `(select auth.uid())` for RLS performance.
- **Data API exposure:** only the `app` schema (plus Supabase defaults). `ingest`, `ops`, `api` and `private` are **not** exposed.
- **Connections** (TECHNICAL §7): n8n uses the Supavisor **session** pooler (port 5432, IPv4); the Vercel API uses the **transaction** pooler (port 6543, prepared statements off). The pooler username format is `<role>.<project-ref>`.
- **Draft SQL** (apply order): `reference/sql/001_extensions_schemas_roles.sql` → `002_core_tables.sql` → `003_auth_rls_views.sql` → `004_rpc_pipeline.sql` → `005_rpc_app_api_search.sql` → `006_seed_taxonomies_settings.sql`. It is a starting point; known issues are listed in §12 and must be fixed.
- **Key tables** (DATA_SCHEMA §3–4):
  - **app:** `members`, `member_invites`, `allowed_domains`, `competitors`, `competitor_accounts`, `organizations`, `org_aliases`, `people`, `person_aliases`, `items`, `item_credits`, `media_assets`, `campaigns`, `campaign_items`, `website_pages`, `employee_snapshots`, `news_articles`, `news_mentions`, `briefs`, `review_tasks`, `taxonomy_terms`, `alert_rules`, `saved_views`, `embeddings`, `stats_daily`.
  - **ingest:** `raw_items`.
  - **ops:** `scrape_runs`, `scrape_run_accounts`, `apify_runs`, `ai_extractions`, `price_book`, `cost_ledger`, `api_keys`, `api_calls`, `audit_log`, `settings`.
- **Settings seeded** (`ops.settings`):

  | Key | Value |
  |---|---|
  | `auto_publish_threshold` | 0.80 |
  | `campaign_window_days` | 45 |
  | `campaign_similarity_min` | 0.82 |
  | `alias_trgm_min` | 0.6 |
  | `alias_embedding_min` | 0.85 |
  | `daily_budget_usd` | 150 (backfill days; ~25 steady state — Q-07, MA-13) |
  | `metrics_refresh_days` | 30 |
  | `removal_window_days` | 90 |
  | `stories_twice_daily` | false |
  | `ai_batch_size` | 20 |
  | `vision_max_share` | 0.3 |
  | `stats_daily_enabled` | false (switched on in M10) |
  | `ai_batch_mode` | false (optional Batch API path, M07) |

- **Embeddings:** `vector(1536)` with an HNSW cosine index (`text-embedding-3-small`).

## 3. Prerequisites

| Item | Needed when |
|---|---|
| M00 Done (monorepo, CI with a placeholder `db-tests` job) | Start |
| Docker running locally (for `supabase start`) | T1 |
| Supabase CLI, latest; check with `supabase --version` (≥ 2.81.3 for `db advisors`, otherwise use MCP `get_advisors`) | T1 |
| **MA-03**: dev and prod projects created; refs sent | T2 |
| **MA-04**: scoped access token(s) | T2 |
| **MA-05**: `n8n_writer` and `api_agent` passwords set on dev (and on prod after T13) | T12 / T13 |
| **MA-06**: Google OAuth client + Supabase Google provider on dev | T11 |

## 4. Scope

**In:**
- Local Supabase setup and links to dev and prod.
- Migrations for every table, enum, index, trigger, policy, view and core RPC.
- Queues, cron housekeeping, the Storage bucket and seeds.
- pgTAP tests, advisors, generated types and the CI DB job.
- Pooler connection tests for both machine roles.
- The Google provider.
- Applying the prod baseline after the owner's OK.

**Out:**
- Competitor and account seed data (M02).
- The pipeline RPCs owned by later milestones:
  - M03: `ops.log_cost`, `ops.register_apify_run`, `ops.complete_apify_run`, `ops.daily_health`, `ops.accrue_fixed_costs`.
  - M05/M06: website, employee and removal writers.
  - M06: media v1 (`ops.get_media_targets`, `ops.save_media_asset`, the `/api/internal/media-upload-url` route).
  - M07: `ops.apply_extraction` and embeddings.
  - M08: linker.
  - M11: review and admin RPCs.
  - M13: news, briefs and digest.
- Web app auth UI (M09).
- `api.*` write RPCs (M14).

## 5. References

- `docs/DATA_SCHEMA.md`: all sections, especially §1 (schemas and access), §5 (RPC catalog) and §8 (rules).
- `docs/TECHNICAL.md` §5.1–5.3 (due list, watermarks, ingest RPC), §7 (Supabase design), §9 (media), §12 (security checklist), §14 (performance).
- `reference/sql/001…006` (draft SQL); `reference/n8n/normalized_item.schema.json` (the payload that `upsert_raw_items` receives).
- `docs/TESTING.md` §1 (pgTAP layer), §3 (rules).
- `docs/ENVIRONMENT.md` §2 (pooler URLs, role names), §3 (generating passwords).
- `docs/TAXONOMIES.md` (seed lists).
- Supabase docs (fetch as `.md`):
  - `https://supabase.com/changelog.md` (check for breaking changes first);
  - "Securing your API" / Data API exposed schemas;
  - Queues (pgmq);
  - pg_cron;
  - Database testing (pgTAP);
  - Connecting to Postgres (Supavisor);
  - Login with Google;
  - Storage buckets.

## 6. Deliverables

| Path | What |
|---|---|
| `supabase/config.toml` | Created by `supabase init`. `[api] schemas` includes `app`; `[auth]` site URL `http://localhost:3000`; Google provider block with `env(...)` secrets for local (optional) |
| `supabase/migrations/<ts>_extensions_schemas_roles.sql` | From 001 |
| `supabase/migrations/<ts>_core_tables.sql` | From 002 (tables, indexes, settings, queues) |
| `supabase/migrations/<ts>_auth_rls_views.sql` | From 003 + the missing search_tsv triggers |
| `supabase/migrations/<ts>_rpc_pipeline_core.sql` | From 004: implemented core functions only |
| `supabase/migrations/<ts>_rpc_app_search.sql` | From 005: `app.me`, a clean `app.search`, `app.similar`, `private.require_api_scope` |
| `supabase/migrations/<ts>_storage_cron.sql` | The `media` bucket + cron jobs |
| `supabase/migrations/<ts>_seed_taxonomies.sql` | From 006 (taxonomies, price book, owner invite). Production data, so a migration, not `seed.sql` |
| `supabase/seed.sql` | Local/CI only: one fake competitor (`C999`, slug `test-house`) with 3 accounts and 10 items, plus test helpers |
| `supabase/tests/*.test.sql` | pgTAP suites (§10) |
| `packages/shared/src/db.types.ts` | Generated types |
| `.github/workflows/ci.yml` | `db-tests` job enabled |
| `scripts/db/check-pooler.sh` | Connection test for both roles (reads URLs from env; prints only OK/FAIL) |
| `supabase/README.md` | How to run locally, create migrations, test, push to dev/prod |

## 7. Tasks

### T1: Local Supabase
1. Run `supabase init` at the repo root.
2. In `supabase/config.toml`, add the `app` schema to the API config. Check the current key name; it is usually:
   ```toml
   [api]
   schemas = ["public", "graphql_public", "app"]
   extra_search_path = ["public", "extensions"]
   ```
   Also set `[db] major_version` to match the hosted projects (check the dashboard; Postgres 17 expected).
3. Run `supabase start` and record the local URLs in `supabase/README.md`. Never record keys.

**Done when:** `supabase status` shows the stack running.

### T2: Link dev (needs MA-03, MA-04)
1. `export SUPABASE_ACCESS_TOKEN=<scoped token>` (from the owner, in your env, never committed).
2. `supabase link --project-ref $SUPABASE_PROJECT_REF_DEV`.
3. Confirm the region, plan (Pro) and Postgres version, and record them in PROGRESS.md (Q-12).
4. In the dashboard (or via the Management API, if your token allows), make sure the Data API's exposed schemas include `app` and exclude `ingest`, `ops`, `api` and `private`.

**Done when:** `supabase projects list` shows dev as linked.

### T3: Migration 1, extensions/schemas/roles
1. `supabase migration new extensions_schemas_roles`, then paste `reference/sql/001_extensions_schemas_roles.sql` and adapt it.
2. Check the extension availability and schema placement on the current Supabase:
   - `vector`, `pg_trgm`, `unaccent` and `pgcrypto` go in schema `extensions`;
   - `pgmq` is enabled through the Queues integration, which may need the dashboard toggle on hosted. Document this.
   - `pg_cron` lives in schema `cron` / the `pg_catalog` default.
3. Keep `create role … login noinherit nobypassrls` without passwords; the owner sets passwords (MA-05).
4. Keep `alter role … set search_path = ''`. Every query from n8n must therefore be schema-qualified; note this in `n8n/README.md` later (M03).
5. Grants: `usage` on `ingest` and `ops` for `n8n_writer`; `usage` on `api` for `api_agent`; `usage` on `extensions` for both.

**Done when:** `supabase db reset` applies cleanly locally.

### T4: Migration 2, core tables
1. `supabase migration new core_tables` from `002_core_tables.sql`.
2. Keep every FK index. Keep the partial and keyset indexes: `items_feed`, `items_competitor_published`, `items_platform_published`, `competitor_accounts_due`, `review_open`.
3. Keep the unique expression index `competitor_accounts_platform_handle (platform, lower(handle))`. Upserts must target it as `on conflict (platform, (lower(handle)))`, or use a named unique constraint on a generated column `handle_norm`. **Recommended:** add `handle_norm text generated always as (lower(handle)) stored` with `unique (platform, handle_norm)`, so `on conflict (platform, handle_norm)` is simple for M02.
4. Keep `ops.settings` inserts (including `vision_max_share`) and the `pgmq.create('ai_extract' | 'embed' | 'media')` calls.

**Done when:** `supabase db reset` passes and `\dt app.*` lists 25 tables.

### T5: Migration 3, auth, RLS, views, search triggers
1. `supabase migration new auth_rls_views` from `003_auth_rls_views.sql`.
2. Write the missing search triggers with the same pattern as `private.items_tsv()`. Use `to_tsvector('simple', extensions.unaccent(...))` with weights A/B/C:

   | Trigger function | Table | A | B | C |
   |---|---|---|---|---|
   | `private.campaigns_tsv()` | `app.campaigns` | `title` | `summary_en` + `summary_ar` | `occasion` |
   | `private.organizations_tsv()` | `app.organizations` | `name` + `name_ar` | `industry` | — |
   | `private.people_tsv()` | `app.people` | `name` + `name_ar` | `primary_role` | — |
   | `private.competitors_tsv()` | `app.competitors` | `name` + `name_ar` | `array_to_string(aliases)` | `categories` + `in_house` |
   | `private.news_tsv()` | `app.news_articles` | `title` | `summary_en` | `snippet` + `source_name` |

   Each sets `updated_at = now()` where the column exists. All use `set search_path = ''` and are SECURITY INVOKER (triggers don't need DEFINER).
3. The RLS loop enables RLS on every table in `app`, `ingest` and `ops`. Add an assertion test (T10) that no table in those schemas has `relrowsecurity = false`.
4. Policies: members read `app.*` (`to authenticated using ((select private.is_member()))`); owner-only CRUD on `saved_views`; admins read invites and domains; `api_agent` read policies; **no** insert/update/delete policies for users (writes go through RPCs).
5. Views (`security_invoker = true`): `app.feed_v`, `app.campaigns_v` (both granted to `authenticated` and `api_agent`), `api.items_v`, `api.competitors_v`, `api.campaigns_v`, `api.organizations_v`, `api.people_v`, `api.briefs_v`, `api.news_v`.
6. Grant `private` helpers: `revoke all … from public`, `grant execute on private.is_member(), private.has_role(app.member_role) to authenticated`. The `handle_new_user` trigger function stays callable only by the trigger (no grants).

**Done when:** `supabase db reset` passes and RLS tests (T10) pass.

### T6: Migration 4, core pipeline RPCs
1. `supabase migration new rpc_pipeline_core` from `004_rpc_pipeline.sql`.
2. Implement and test **only** these:
   - `ops.start_run(p_workflow text, p_platform app.platform, p_mode text, p_env text, p_execution_id text) returns uuid`
   - `ops.finish_run(p_run_id uuid, p_status text, p_error text default null) returns jsonb`. Implement it **returning jsonb** now, not the draft's `void`: `{run_id, status, accounts_total, accounts_ok, accounts_failed, items_seen, items_new, cost_usd}`. n8n can't read `ops.scrape_runs` directly (`docs/N8N_WORKFLOWS.md` §5 SUB · Finish run).
   - `ops.get_due_accounts(p_platform app.platform, p_limit int, p_run_id uuid, p_mode text default 'daily') returns table(...)`. **Fix the plpgsql name clash:** add `#variable_conflict use_column` at the top of the body, or rename the OUT columns with an `out_` prefix and alias them in the RETURNING list.
   - `ops.report_account_result(p_run_id uuid, p_account_id uuid, p_status text, p_items_seen int, p_items_new int, p_error text default null, p_backfill_done boolean default false, p_backfill_cursor jsonb default null) returns void`. **Fix `next_due_at`:** use `now() + a.cadence - interval '4 hours'` (not a midnight-anchored time). This way tomorrow's run at the same Cairo clock time always finds the account due, whatever the DST offset. Failure retry stays `now() + interval '6 hours'`.
   - `ingest.upsert_raw_items(p_run_id uuid, p_account_id uuid, p_items jsonb) returns jsonb`. Extend the recordset with `credits_text text, media_urls text[]` so they survive into `normalized`. It returns `{inserted, duplicates, metrics_updated, new_item_ids}`.
   - `ops.claim_queue_batch(p_queue text, p_n int, p_vt_seconds int default 600) returns table(msg_id bigint, read_ct int, message jsonb)`
   - `ops.ack_queue(p_queue text, p_msg_ids bigint[]) returns void`
   - `ops.get_items_for_ai(p_item_ids uuid[]) returns jsonb`
   - `ops.diff_website_urls(p_account_id uuid, p_urls text[]) returns text[]`
3. Every function: `security definer`, `set search_path = ''`, fully-qualified names (`pgmq.send_batch`, `extensions.digest`). End the migration with:
   ```sql
   revoke execute on all functions in schema ops, ingest from public;
   grant execute on all functions in schema ops, ingest to n8n_writer;
   ```
   Also set `alter default privileges in schema ops, ingest revoke execute on functions from public;` so later migrations stay safe. Re-grant to `n8n_writer` in every later migration that adds functions.
4. Leave the SKETCH signatures as comments. Do **not** create stub functions for later milestones.

**Done when:** the pipeline tests in T10 pass.

### T7: Migration 5, app RPCs and first search
1. `supabase migration new rpc_app_search`.
2. `app.me() returns jsonb`: SECURITY INVOKER, `grant execute … to authenticated`.
3. `app.search(p_query text, p_embedding extensions.vector(1536) default null, p_types text[] default …, p_filters jsonb default '{}', p_limit int default 30) returns table(entity_type text, entity_id uuid, title text, subtitle text, score double precision)`. **Rewrite the draft cleanly**:
   - one CTE per source, each returning `(t text, id uuid, rk bigint)`: items keyword (tsvector rank), campaigns keyword, organizations (trigram `%` + tsvector), people (trigram), competitors (trigram + tsvector), news keyword, semantic (`app.embeddings` ordered by `<=>`);
   - union them;
   - fuse with reciprocal rank `sum(1.0/(60+rk))`;
   - join back for title and subtitle.

   Apply `p_filters` (`country`, `platform`, `competitor_id`, `brand_id`, `from`, `to`, `content_type`, `occasion`) to items consistently. The function is SECURITY INVOKER, so RLS applies to callers. Grant to `authenticated` and `api_agent`. M11 tunes it; M01 must make it correct and tested.
4. `app.similar(p_entity_type text, p_entity_id uuid, p_limit int default 12)`: as in the draft. Grant to `authenticated` and `api_agent`.
5. `private.require_api_scope(p_scope text)`: as in the draft. Grant usage on `private` and execute to `api_agent`.

**Done when:** the search test (T10) returns the seeded item for a keyword query, and RLS hides it from a non-member.

### T8: Migration 6, Storage and cron
1. `supabase migration new storage_cron`.
2. Bucket:
   ```sql
   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
   on conflict (id) do nothing;
   ```
   It is public-read by unguessable path (TECHNICAL §9). **No** insert/update/delete policies for `anon` or `authenticated`. Uploads arrive later through signed upload URLs created server-side (M02 seed script as owner; M06 `/api/internal/media-upload-url`). Path convention: `media/{competitor_slug}/{platform}/{external_id}/thumb.jpg`, logos at `media/logos/{slug}.{ext}`.
3. pg_cron jobs. Check the current `cron.schedule` signature and the pgmq archive table names (`pgmq.a_<queue>`).
   ```sql
   select cron.schedule('emr-unlock-stale-accounts', '15 * * * *',
     $$update app.competitor_accounts set locked_until = null where locked_until < now()$$);
   select cron.schedule('emr-archive-queue-cleanup', '30 3 * * *',
     $$delete from pgmq.a_ai_extract where archived_at < now() - interval '30 days';
       delete from pgmq.a_embed where archived_at < now() - interval '30 days';
       delete from pgmq.a_media where archived_at < now() - interval '30 days'$$);
   ```
   (`stats_daily` refresh is added in M10.)

**Done when:** `select jobname from cron.job` lists both jobs, and the bucket exists.

### T9: Migration 7, seed taxonomies, settings, price book, owner invite
1. `supabase migration new seed_taxonomies` from `006_seed_taxonomies_settings.sql`: 120 taxonomy terms, the price-book placeholders, and `member_invites ('mohamed.abdelrahman@everyone.film','admin')`. The domain auto-join stays commented out (Q-01).
2. `supabase/seed.sql` (local/CI only):
   - a fake competitor `C999 test-house` (tier `pilot`);
   - 3 accounts (instagram `testhouse`, vimeo `testhouse`, website_work_page `https://example.com/work`);
   - 10 items, one with title "Ramadan telecom film" and brand org "Test Telecom";
   - one org alias.

**Done when:** `select taxonomy, count(*) from app.taxonomy_terms group by 1` returns:

| taxonomy | count |
|---|---|
| industry | 23 |
| content_format | 15 |
| occasion | 11 |
| competitor_category | 13 |
| credit_role | 31 |
| in_house_capability | 27 |

### T10: pgTAP tests
Each file starts with `begin; create extension if not exists pgtap with schema extensions; select plan(n);` and ends with `select * from finish(); rollback;`.

To simulate users:
```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
```
Create the users in the test with `insert into auth.users (id, email, …)`. The `handle_new_user` trigger creates members from invites.

| File | Asserts |
|---|---|
| `supabase/tests/00_schema.test.sql` | Schemas exist; `n8n_writer` and `api_agent` exist and are `nobypassrls`; every table in `app`/`ingest`/`ops` has RLS enabled (count of `relrowsecurity = false` = 0); every view in `app`/`api` has `security_invoker = true`; no `SECURITY DEFINER` function in schema `app` |
| `supabase/tests/01_membership.test.sql` | An invited email gets a member with the invite role and the invite is deleted; a non-invited email gets no member; `app.me()` returns the role |
| `supabase/tests/02_rls_members.test.sql` | A member reads `app.competitors`, `app.items`, `app.feed_v` (> 0 rows); a non-member reads 0 rows from each; `anon` gets permission denied; a member cannot `insert into app.items` (error); `saved_views` is owner-only |
| `supabase/tests/03_api_agent.test.sql` | `set local role api_agent`: `select from api.competitors_v` > 0; `insert into app.items` fails; `select from ops.cost_ledger` fails; `private.require_api_scope('write')` raises without `app.api_scope` and passes with `set_config('app.api_scope','read,write',true)` |
| `supabase/tests/04_n8n_writer.test.sql` | `set local role n8n_writer`: `select ops.start_run(...)` works; `select from app.items` fails (no table grant); `ingest.upsert_raw_items` works |
| `supabase/tests/05_upsert_raw_items.test.sql` | First call with 3 normalized items → `inserted = 3`; same call again → `inserted = 0`, raw_items count unchanged, `pgmq.metrics('ai_extract')` queue length unchanged; a fourth item with the same caption + thumbnail as an existing one → `duplicates = 1`, `ai_status = 'duplicate'`, not queued; changed metrics on a known item → `metrics_updated = 1`; account watermark = max `published_at`, `last_external_id` = newest |
| `supabase/tests/06_due_accounts.test.sql` | Due accounts are returned ordered by tier; returned accounts get `locked_until` > now; a second call in the same transaction returns none of them; paused competitors and `backfill_status = 'pending'` accounts are excluded in `daily` mode and included in `backfill` mode |
| `supabase/tests/07_report_account_result.test.sql` | 3 failures in a row → `status = 'failing'`, `consecutive_failures = 3`; then success → `active`, `0`, `locked_until` null, `next_due_at` between now+19h and now+21h for cadence 1 day |
| `supabase/tests/08_search.test.sql` | `search_tsv` populated on insert for items, campaigns, orgs, people, competitors and news; `app.search('ramadan')` returns the seeded item for a member and nothing for a non-member |
| `supabase/tests/09_queues_cron_storage.test.sql` | Queues exist; `ops.claim_queue_batch` reads and `ops.ack_queue` archives; cron jobs exist; the `media` bucket exists and is public |

**Done when:** `supabase test db` passes all suites locally.

### T11: Google provider (needs MA-06)
1. The owner creates the OAuth client and enables the Google provider on dev, with the redirect `https://<dev-ref>.supabase.co/auth/v1/callback`.
2. You confirm in the dashboard (or via the Management API) that the provider is enabled, and add the local config block (optional, using `env()` secrets) to `config.toml` for local testing.
3. End-to-end sign-in is tested in M09. Here, just record "provider enabled" in PROGRESS.

**Done when:** the owner has confirmed and Codex has checked the auth settings.

### T12: Push to dev, types, advisors, pooler test (needs MA-05 on dev)
1. `supabase db push` (dev).
2. `supabase db advisors` (or MCP `get_advisors`, type `security` and `performance`). Fix every security finding. Performance findings either get fixed or justified in PROGRESS.
3. Generate types into the shared package:
   ```bash
   supabase gen types typescript --project-id $SUPABASE_PROJECT_REF_DEV \
     --schema app --schema api --schema ops --schema ingest > packages/shared/src/db.types.ts
   ```
   Check the current flag names. Commit the output.
4. The owner sets the role passwords on dev (MA-05).
5. Run `scripts/db/check-pooler.sh`. It connects twice and prints only `OK` or `FAIL`:
   - with `N8N_WRITER_URL` (session pooler, port 5432, user `n8n_writer.<ref>`): runs `select ops.start_run('M01-conn-test', null, 'manual', 'dev', 'cli')`, then `select ops.finish_run(<id>, 'success')`;
   - with `API_AGENT_URL` (transaction pooler, port 6543, user `api_agent.<ref>`): runs `select count(*) from api.competitors_v`.

   Delete the test run row afterwards as the owner, or leave it (`workflow = 'M01-conn-test'`).

**Done when:** advisors are clean, types are committed, and both pooler checks print OK.

### T13: CI DB job and prod baseline (prod needs the owner's OK + MA-05 on prod)
1. Enable the `db-tests` job in `.github/workflows/ci.yml`:
   - `supabase/setup-cli` action (pinned);
   - `supabase start` (with `-x` to exclude unneeded services, for speed);
   - `supabase db reset`;
   - `supabase test db`.
2. Ask the owner in PROGRESS: "Apply baseline schema to prod? (no data, same migrations)". After the OK:
   - `supabase link --project-ref $SUPABASE_PROJECT_REF_PROD`;
   - `supabase db push`;
   - re-link dev.
3. The owner sets the prod role passwords (MA-05 prod).
4. Run `check-pooler.sh` against prod.
5. Re-run the advisors on prod.

**Done when:** CI `db-tests` is green and prod has the same migration list (`supabase migration list`).

### T14: Docs and hand-off
1. `supabase/README.md`: local workflow, migration rules (`supabase migration new` only), test commands, how to push dev/prod, pooler URL formats (no secrets).
2. Update `docs/DATA_SCHEMA.md` and `docs/DECISIONS.md` → Changes for any deviation (e.g. the `handle_norm` column, the `next_due_at` formula).
3. Fill in the PROGRESS hand-off and update the root board.

**Done when:** the PR is merged.

## 8. Interfaces & contracts touched

| Contract | Detail |
|---|---|
| Normalized item | `reference/n8n/normalized_item.schema.json`: the `p_items` element shape for `ingest.upsert_raw_items` |
| `ingest.upsert_raw_items` result | `{"inserted": int, "duplicates": int, "metrics_updated": int, "new_item_ids": [uuid]}`; new IDs are queued to `ai_extract` and `media` |
| Due list row | `account_id, competitor_id, competitor_slug, handle, url, external_id, uploads_playlist_id, watermark_published_at, watermark_external_id, backfill_from, backfill_cursor` |
| Queue message | `{"item_id": "<uuid>"}` on `ai_extract`, `media`; `{"entity_type": "...", "entity_id": "<uuid>"}` on `embed` (from M07) |
| Roles | `n8n_writer` (EXECUTE on `ops.*`, `ingest.*` only), `api_agent` (SELECT on `api.*` views + app read policies; EXECUTE on `app.search`, `app.similar`, `private.require_api_scope`) |
| Pooler URLs (no secrets in repo) | n8n: `postgresql://n8n_writer.<ref>:<pw>@<pooler-host>:5432/postgres?sslmode=require`; API: `postgresql://api_agent.<ref>:<pw>@<pooler-host>:6543/postgres?sslmode=require` |
| Generated types | `packages/shared/src/db.types.ts` |
| Storage | Bucket `media` (public read); path conventions above |

## 9. Acceptance criteria

| # | Criterion | Check |
|---|---|---|
| AC1 | Migrations apply cleanly from zero | `supabase db reset` exits 0 locally; `supabase migration list` shows the same 7 migrations on local, dev and prod |
| AC2 | All tables exist | `select count(*) from pg_tables where schemaname='app'` = 25; `ingest` = 1; `ops` = 10 |
| AC3 | RLS everywhere | `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app','ingest','ops') and c.relkind='r' and not c.relrowsecurity` = 0 |
| AC4 | pgTAP passes | `supabase test db` → all 10 files pass locally and in CI |
| AC5 | Advisors clean | `supabase db advisors` (dev + prod): 0 security errors or warnings; performance items fixed or justified in PROGRESS |
| AC6 | Seeds present | Taxonomy counts as in T9 (total 120); `ops.settings` has 13 keys; owner invite present; `ops.price_book` ≥ 17 rows |
| AC7 | Queues, cron, Storage | `select queue_name from pgmq.list_queues()` → `ai_extract`, `embed`, `media`; 2 `emr-*` cron jobs; bucket `media` public |
| AC8 | Machine roles connect through the pooler | `scripts/db/check-pooler.sh` prints `n8n_writer: OK` and `api_agent: OK` on dev and prod |
| AC9 | Data API exposure correct | The REST endpoint `/rest/v1/` with header `Accept-Profile: ops` is rejected; `Accept-Profile: app` works for a signed-in member (verified via `curl` with a test user JWT on local) |
| AC10 | Types generated | `packages/shared/src/db.types.ts` exists and `pnpm typecheck` passes |
| AC11 | Google provider enabled on dev | Owner confirmed (MA-06); dashboard setting verified |
| AC12 | No secrets committed | `git grep -nE 'sb_secret_|service_role|password' -- ':!*.md' ':!reference/**'` → nothing sensitive |

## 10. Tests to write

The `supabase/tests/00…09_*.test.sql` files listed in T10, plus `scripts/db/check-pooler.sh`. A shell test is not run in CI, because it needs secrets; record its output in PROGRESS.

## 11. Manual actions from the owner

| MA | What | When | How Codex verifies |
|---|---|---|---|
| MA-03 | Create `emr-dev` and `emr-prod` (Pro, same region); send the project refs | Before T2 | `supabase projects list` shows both |
| MA-04 | Scoped access token(s) for Codex | Before T2 | `supabase link` works |
| MA-05 | `alter role n8n_writer password '…'; alter role api_agent password '…';` on dev (T12), later on prod (T13); store the passwords for n8n/Vercel | T12, T13 | `check-pooler.sh` OK |
| MA-06 | Google OAuth client + enable the Supabase Google provider (dev; prod at T13) | T11 | Auth settings show Google enabled |
| (approval) | "Apply baseline schema to prod" | T13 | The owner writes "approved" in PROGRESS |

## 12. Risks & gotchas

- **Verify current docs first:**
  - `https://supabase.com/changelog.md` for breaking changes (API keys are now publishable/secret; check Queues, cron and Data API exposure settings);
  - the CLI flags for `gen types`, `db advisors` and `test db`.
- **Draft SQL issues you must fix:**
  1. `ops.get_due_accounts`: OUT-column names clash with table columns in plpgsql (`handle`, `url`, `external_id`, …). Use `#variable_conflict use_column` or rename.
  2. `ops.report_account_result`: the `next_due_at` formula (use `now() + cadence - interval '4 hours'`).
  3. `ingest.upsert_raw_items`: add `credits_text` and `media_urls` to the recordset; make sure the `shells` CTE and the later `UPDATE` don't conflict (they touch different rows); test it.
  4. `app.search`: the draft UNION is illustrative only. Rewrite it as in T7.
  5. The expression-index upsert target for accounts. Prefer a `handle_norm` generated column.
- **pgmq on hosted** may need enabling via Integrations → Queues. **pg_cron** may need enabling via Database → Extensions. Document what you clicked or asked the owner to click.
- **Triggers on `auth.users`** are allowed on Supabase. Keep the function in `private` with `security definer set search_path = ''`, and never read `raw_user_meta_data` for authorization (display name only).
- **`search_path = ''` on the machine roles** means every query must be schema-qualified, including enum casts (`'instagram'::app.platform`).
- **`supabase test db`** runs as a superuser-like role. Use `set local role …` inside each test to exercise RLS for real.
- **Supavisor** usernames are `<role>.<project-ref>`. Transaction mode doesn't support prepared statements (postgres.js `prepare: false`, in M14).
- **Don't put competitor data in `seed.sql`.** That is M02's job, via scripts.

## 13. Cost & budget notes

Supabase Pro covers two projects at the plan price per project; the owner confirms the plan. There are no paid API calls in this milestone. Enable "Spend cap" on Pro unless the owner decides otherwise.

## 14. Definition of done & hand-off

- All ACs pass, with the evidence in PROGRESS.md; the PR is merged; root PROGRESS.md shows M01 Done and M02 current.
- **M02 expects:**
  - empty `app.competitors` and `app.competitor_accounts` tables, with the `handle_norm` (or equivalent) unique upsert target;
  - the `media` bucket, for logos;
  - a seed connection (`SEED_DATABASE_URL`, owner-run) or the secret key for scripts;
  - generated types for `app.platform`, `app.priority_tier` and `app.account_status`;
  - the documented pooler URLs, for n8n in M03.
