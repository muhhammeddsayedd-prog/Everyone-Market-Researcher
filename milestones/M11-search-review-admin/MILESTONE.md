# M11 — Search, review, admin

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first, then the root `PROGRESS.md`.
> **Parallel-OK while the pilot runs:** also run the daily pilot check each working session and log it in `milestones/M08-campaign-linker-pilot-launch/PROGRESS.md` → Pilot monitoring log.

## 1. Goal and outcome

Make the app something the team can work in, not just read. This milestone adds:
- **Search:** a hybrid keyword + semantic search page plus the ⌘K command, and "find similar" from any item or campaign.
- **The review queue:** where analysts approve, correct, merge and reject what the AI was unsure about. Every correction is locked and teaches the alias tables.
- **Admin:** competitors and accounts (add, edit, pause, onboarding trigger), taxonomies, the pipeline, costs, users, API keys, settings, and the alert rules UI.

When M11 is done:
- The owner can complete the walkthrough checklist (MA-21) end to end on production.
- The review queue is empty or being worked.
- The Costs page answers "what does it cost to run?" from real numbers (D-25).
- M12 (the pilot gate) can start as soon as pilot day 14 is reached.

## 2. Context you need

**Search** (`reference/sql/005_rpc_app_api_search.sql`, DESIGN.md §6 SearchCommand, §8.17):
- `app.search(p_query, p_embedding, p_types, p_filters, p_limit)` fuses keyword ranks (`search_tsv` with `simple` + `unaccent`, plus `pg_trgm` for names) and semantic ranks (pgvector HNSW cosine on `app.embeddings`) with reciprocal rank fusion `1/(60+rank)`.
- The draft has a messy UNION. **Rewrite it cleanly:**
  - one CTE per source, each returning `(t, id, rk)`;
  - keyword branches for items, campaigns, organizations, people, competitors and news;
  - one semantic branch;
  - consistent filters (`country`, `platform`, `competitor_id`, `brand_id`, `from`, `to`, `content_type`, `occasion`);
  - Arabic works because `unaccent` + `simple` tokenise Arabic words as-is. Add `private.norm()` for handles.
- **Query embedding:**
  - computed **server-side** in Next.js with `OPENAI_API_KEY` + `OPENAI_MODEL_EMBED` (`text-embedding-3-small`, 1536 dims);
  - cached per normalized query (sha256) in `ops.query_embeddings` (new small table; 30-day TTL; RLS on, no policies; written through a private `SECURITY DEFINER` worker) or an in-memory LRU. Pick one and log it.
  - Cost: about $0.02 per 1M tokens, which is negligible.
- **Performance target:** < 800 ms DB time over 100k items (`docs/TECHNICAL.md` §7, PRD §7). Prove it with `EXPLAIN ANALYZE` on synthetic data.
- **"Find similar":** `app.similar(entity_type, entity_id, limit)`.

**Review** (`docs/AI_PIPELINE.md` §5, `reference/sql/002` `app.review_tasks`, DESIGN.md §8.18 + ReviewCard):
- **Task kinds:** `item_low_confidence`, `new_brand`, `new_agency`, `new_person`, `campaign_merge`, `entity_merge`, `account_suggestion`. Statuses: `open`, `approved`, `corrected`, `rejected`, `snoozed`.
- **Locked fields:** every human change adds the field names to `app.items.locked_fields`, or sets `campaigns.locked_by_human`. AI never overwrites locked fields (AGENTS rule 7).
- **Teaching:** approvals and corrections add aliases (`org_aliases` / `person_aliases`, source `human`).
- **Audit:** every action writes `ops.audit_log` (actor_type `user`, before/after).
- **Writes:** only through RPCs. The `app.*` RPC is `SECURITY INVOKER`. It calls a `private.*_worker` that is `SECURITY DEFINER`, uses `search_path = ''`, re-checks `private.has_role('analyst')`, and has EXECUTE revoked from PUBLIC and granted to `authenticated`.

**Admin** (DESIGN.md §8.20–§8.24, PRD FR-W14, `reference/sql/005` admin RPC sketches):
- **Competitors:** add/edit/pause.
  - **Adding a competitor** sets its accounts to `backfill_status = 'pending'`. The **WF-00 backfill wave** (hourly) picks them up.
  - **WF-60 onboarding is built in M15.** In M11, after `app.admin_upsert_competitor` succeeds, the server action may call `POST ${N8N_WEBHOOK_BASE}/webhook/emr-onboarding` with header `x-emr-secret: N8N_WEBHOOK_SECRET` and body `{competitor_id, account_ids}` (API_SPEC §6.3–§6.4):
    - only if both env vars are set;
    - 3 s timeout;
    - failures are ignored and logged.
  - Until M15 that webhook does nothing (or 404s). That's fine: the backfill wave still runs.
  - **Unresolved external IDs** (Vimeo user id, YouTube channel id) are resolved by the collectors' resolution step (`ops.set_account_external_id`, M04/M05).
- **Pilot guard:** while the pilot runs, a new competitor's accounts are created `paused` unless the admin ticks "Start tracking now" (that adds cost and changes the pilot scope). The dialog says this plainly.
- **Out-of-scope platforms** (TikTok, Facebook, Behance, X…) are not trackable. The form explains why (D-07).
- **Costs:** `ops.cost_ledger` + `ops.price_book` via `app.costs_summary(from, to)` (private worker, admin only).
  - **Breakdowns:** per day, month, provider, platform, competitor and category.
  - **Cost per new item:** 30-day cost ÷ new items.
  - **Month forecast:** `spend_to_date / days_elapsed × days_in_month`, refined with fixed fees.
  - **Budget remaining today** (`ops.settings.daily_budget_usd`).
- **Pipeline:** `app.pipeline_summary(p_days)` (the M09 version, extended with the full admin fields) over `ops.scrape_runs`, `ops.scrape_run_accounts`, queue depths and backfill progress. Re-scrape uses `app.admin_request_rescrape(account_id, mode)` (sets `next_due_at = now()`; mode `backfill` resets `backfill_status = 'pending'` and clears `backfill_cursor`).
- **Users:**
  - **Invite:** `app.admin_invite_member(email, role)` inserts into `app.member_invites`. If an `auth.users` row already exists for that email, create the member directly.
  - **Change role/status:** `app.admin_set_member(user_id, role, status)`.
  - **Safety:** an admin cannot remove the last admin.
- **API keys:**
  - The server action generates `emr_<prefix8>_<secret32>` (crypto-random, base62). It stores `sha256(secret + API_KEY_PEPPER)` (hex) via `app.admin_store_api_key(name, prefix, hash, scopes)` and shows the secret **once** in a CodeBlock.
  - Scopes: `read` / `write` / `admin`. Revoke via `app.admin_revoke_api_key`.
  - **Keys become usable when the REST API and MCP ship in M14.** The page says "Keys work once the Agent API is live (M14)."
  - `API_KEY_PEPPER` is therefore needed **now** (MA-20 addition), not only in M14.
- **Settings:** `app.admin_set_setting(key, value)` with an allowlist and validation:

| Key | Allowed values |
|---|---|
| `auto_publish_threshold` | 0.50–0.95 |
| `campaign_window_days` | 14–120 |
| `campaign_similarity_min` | 0.70–0.95 |
| `daily_budget_usd` | > 0 |
| `stories_twice_daily` | bool |
| `ai_batch_size` | 5–50 |
| `vision_max_share` | 0–1 |

  Every change is audited. **During the pilot, changing `auto_publish_threshold` or the campaign settings needs a confirm dialog** ("This changes pilot measurements") and is logged in the M08 PROGRESS pilot log.
- **Alert rules UI** (`/settings/alerts`, DESIGN.md §8.19):
  - Admins write `app.alert_rules` via `app.admin_upsert_alert_rule`.
  - Non-admins can only add or remove **their own email** on existing rules, via `app.alert_subscribe(rule_id, subscribe bool)`.
  - Kinds: `daily_digest`, `instant_launch`, `new_client`, `weekly_brief`, `failing_sources` (admin), `budget` (admin).
  - **Emails are sent by WF-80 in M13.** The page says "Emails start once alerts are live (M13)."
  - Do **not** seed rules here: M13 seeds the default rules for the owner (D-21). M11 only builds the UI; with no rules it shows an empty state.

**Pages and buttons wired in this milestone** (M10 left them disabled):
- the item drawer "Report a correction";
- campaign detail: edit title/occasion, split, merge;
- brand / agency / person "Merge with…" and "Edit";
- competitor profile Accounts tab: Pause / Resume / Re-scrape;
- the competitor header: Edit / Pause.

## 3. Prerequisites

- **Milestones:**
  - M10 Done (entity pages, views, `lib/data` pattern);
  - M09 (shell, auth, caching option);
  - M07 (review tasks created by the AI, embeddings);
  - M08 (`campaign_merge` tasks, linker RPCs).
- **Manual actions:**
  - MA-20 addition: `OPENAI_API_KEY`, `OPENAI_MODEL_EMBED`, `API_KEY_PEPPER`, `N8N_WEBHOOK_BASE`, `N8N_WEBHOOK_SECRET` in Vercel (Preview = dev, Production = prod);
  - **MA-21** owner acceptance walkthrough (at the end).

## 4. Scope

**In:**
- the migration `review_admin_search`: the clean `app.search`, `ops.query_embeddings`, all review/correction/merge/split RPCs + workers, all admin RPCs + workers, `app.alert_subscribe`, the `'rejected'` entity status, and pgTAP;
- `/search` + ⌘K + find-similar;
- `/review`;
- the correction dialog everywhere;
- `/admin/competitors` (+ `/new`, `/[slug]`), `/admin/taxonomies`, `/admin/pipeline`, `/admin/costs`, `/admin/users`, `/admin/api-keys`;
- the settings card;
- `/settings/alerts` and `/settings/profile`;
- the onboarding webhook call (best-effort);
- e2e + a11y;
- the MA-21 checklist.

**Out:**
- sending emails (M13);
- WF-60 itself (M15);
- REST/MCP use of API keys (M14);
- briefs and news pages (M13);
- threshold tuning based on the pilot (M12; M11 only provides the control).

## 5. References

- `DESIGN.md` §6 (SearchCommand, ReviewCard, DataTable, Dialog, Toast, CodeBlock), §7 (keyboard: ⌘K, J/K, A, E, R, S, `?`), §8.17–§8.24
- `docs/AI_PIPELINE.md` §5 (resolution cascade, locked fields), §8 (audit sample → review)
- `docs/DATA_SCHEMA.md` §5 (app RPC catalog); `reference/sql/003` (helpers `private.is_member`, `has_role`), `005` (search, admin sketches)
- `docs/API_SPEC.md` §6.3–§6.4 (onboarding call), the key format section (for consistent prefix and hashing)
- `docs/TECHNICAL.md` §11–§13
- `docs/ENVIRONMENT.md` §2
- `docs/TAXONOMIES.md` (codes permanent, labels editable)
- `docs/TESTING.md`

## 6. Deliverables

1. **Migration `review_admin_search`** (`supabase migration new review_admin_search`):
   - **Search:**
     - `app.search` rewritten;
     - `ops.query_embeddings(hash text pk, embedding vector(1536), created_at)` + `private.get_or_put_query_embedding` worker (if the DB cache is chosen);
     - supporting indexes (GIN trigram on `competitors.name`, `people.name`, `org_aliases.alias_normalized` already exist; check the `news_articles` tsv).
   - **Enum:** `alter type app.entity_status add value 'rejected'`.
   - **Review:**
     - `app.review_resolve(p_task_id bigint, p_action text, p_payload jsonb) → jsonb` + `private.review_resolve_worker`;
     - `app.correct_item(p_item_id uuid, p_patch jsonb)`;
     - `app.merge_organizations(p_keep uuid, p_merge uuid)`;
     - `app.merge_people(p_keep uuid, p_merge uuid)`;
     - `app.split_campaign(p_campaign_id uuid, p_item_ids uuid[]) → uuid`;
     - `app.merge_campaigns(p_keep uuid, p_merge uuid)`;
     - `app.edit_campaign(p_campaign_id uuid, p_patch jsonb)`;
     - `app.edit_organization(p_id uuid, p_patch jsonb)`;
     - `app.edit_person(p_id uuid, p_patch jsonb)`.
   - **Admin:**
     - `app.admin_upsert_competitor(p jsonb) → uuid`;
     - `app.admin_set_account_status`;
     - `app.admin_request_rescrape`;
     - `app.admin_invite_member`;
     - `app.admin_set_member`;
     - `app.admin_store_api_key`;
     - `app.admin_revoke_api_key`;
     - `app.admin_list_api_keys() → jsonb` (no hashes);
     - `app.admin_api_calls(p_key_id uuid, p_limit int) → jsonb`;
     - `app.admin_upsert_taxonomy_term`;
     - `app.admin_upsert_alert_rule`;
     - `app.admin_set_setting`;
     - `app.get_settings() → jsonb` (members read the allowlisted keys);
     - `app.costs_summary(p_from date, p_to date) → jsonb`;
     - `app.price_book() → jsonb` (admin);
     - `app.admin_update_price(p jsonb)`;
     - `app.pipeline_summary(p_days int)` (extended);
     - `app.pipeline_run_detail(p_run_id uuid) → jsonb`;
     - `app.alert_subscribe(p_rule_id bigint, p_subscribe boolean)`.

     Each has a matching `private.*_worker` where it writes to tables users can't write directly.
   - pgTAP: `supabase/tests/review_admin_search.test.sql`.
2. **Pages:**
   - `/search`;
   - the ⌘K SearchCommand (real);
   - `/review`;
   - `/admin/competitors`, `/admin/competitors/new`, `/admin/competitors/[slug]`;
   - `/admin/taxonomies`, `/admin/pipeline`, `/admin/costs`, `/admin/users`, `/admin/api-keys`;
   - `/settings/alerts`, `/settings/profile`.
3. **Components:**
   - `features/search/*`: SearchResults, TypeTabs, ResultGroup;
   - `features/review/*`: ReviewList, ReviewCard, EntityMergePicker, CampaignMergePicker, KeyboardHints;
   - `features/corrections/CorrectionDialog`, used by the item drawer, campaign page and entity pages;
   - `features/admin/*`: CompetitorForm with an AccountsRepeater, TaxonomyEditor (sortable), PipelineStatusGrid, RunDrawer, CostsCharts, PriceBookTable, UsersTable, InviteDialog, ApiKeysTable, CreateKeyDialog, KeyRevealBlock, SettingsCard;
   - `features/settings/*`: AlertRuleCard, RecipientsInput.
4. **Server actions and route handlers** for every write. Each one:
   - validates with zod;
   - calls one RPC;
   - shows an optimistic UI with an undo toast where DESIGN.md says so;
   - revalidates the affected cache tags directly with `revalidateTag` (no WF-70 needed for user actions).
5. **Libraries:**
   - `lib/search/embedQuery.ts` (server-only);
   - `lib/apikeys/generate.ts` (server-only: generate + hash);
   - `lib/onboarding/notifyN8n.ts` (best-effort).
6. `docs/runbooks/ADMIN.md`: how to add a competitor, review fast, read the Costs page, invite a user and create a key.
7. `milestones/M11-search-review-admin/ACCEPTANCE_WALKTHROUGH.md`: the MA-21 checklist.
8. **Tests:** pgTAP, Vitest, and the Playwright specs listed in §10.

## 7. Tasks

### T1 — Clean `app.search` + query-embedding cache + performance proof

**Steps:**
1. Rewrite `app.search`:
   - CTEs `kw_items`, `kw_campaigns`, `kw_orgs`, `kw_people`, `kw_competitors`, `kw_news` and `sem`, each `(t text, id uuid, rk int)` with a limit of 100;
   - `fused` = `sum(1.0/(60+rk))` grouped by `(t, id)`;
   - the final join for title/subtitle (+ `thumbnail_path`, `platform` for items; `logo` for entities);
   - filters applied consistently to the item and campaign branches;
   - `p_types` respected;
   - `security invoker`, so RLS applies;
   - granted to `authenticated` and `api_agent`.
2. Add the query-embedding cache (DB table via a private worker, or an in-memory LRU of 500 entries). Record the choice.
3. Build a synthetic data script `scripts/perf/seed-synthetic.sql`: 100k items + embeddings (random unit vectors) in a **local** DB only.
4. Run `EXPLAIN (ANALYZE, BUFFERS)` for 5 representative queries:
   - an English keyword;
   - an Arabic keyword;
   - a brand name with a typo;
   - semantic-only;
   - mixed + filters.

   The target is < 800 ms each. Tune `hnsw.ef_search`, the limits and the indexes as needed.

**Done when:** pgTAP passes (types filter, RLS negative, Arabic match, handle match); the timings are pasted.

### T2 — `/search` page + ⌘K + find-similar

**Steps:**
1. `/search?q=&type=&market=&from=&to=&platform=` per DESIGN.md §8.17:
   - a big input with the "Semantic" chip;
   - type tabs All · Items · Campaigns · Competitors · Brands · Agencies · People · News;
   - in the All tab, results grouped with "See all n";
   - items as cards, entities as rows;
   - a "Find similar" action on items and campaigns, which opens a strip/drawer from `app.similar`.
2. ⌘K SearchCommand (cmdk):
   - debounce 200 ms, min 2 characters, the top 5 per group;
   - recent searches (localStorage);
   - "Search all results for '…'" → `/search?q=`;
   - page shortcuts.

   Keyboard: ↑/↓/Enter, Esc.
3. Embedding: `lib/search/embedQuery.ts` calls OpenAI embeddings server-side only, with a 3 s timeout. On error, fall back to keyword-only (`p_embedding = null`) and show a muted note "Showing keyword matches only".
4. Empty state: "No matches for '…'. Try fewer words or switch market to All."

**Done when:**
- e2e: "Ramadan telecom" returns items; an Arabic query returns Arabic items; a typo'd brand finds the brand;
- ⌘K works from every page;
- no OpenAI key appears in the client bundle.

### T3 — Review RPCs: resolve, correct, merge, split

Implement `private.review_resolve_worker(task_id, action, payload, actor uuid)` with the semantics below. It also:
- locks the task row (`for update`);
- rejects anything not `open`/`snoozed`;
- writes the audit log;
- sets `resolved_by`/`resolved_at`/`resolution`;
- enqueues `embed` when content changed.

| Kind | approve | correct (payload = patch) | reject | merge (payload `{into}`) | snooze |
|---|---|---|---|---|---|
| `item_low_confidence` | `ai_status='published'`, lock all AI fields shown | apply the patch (brand_id/agency_id/content_type/occasion/country/campaign_title/credits/is_commercial_work), add fields to `locked_fields`, teach aliases from brand/agency names + handles, `ai_status='published'` | `ai_status='skipped'`, `is_commercial_work=false`, locked | — | `status='snoozed'`, `priority += 50` |
| `new_brand` / `new_agency` | org `status='confirmed'` | `app.edit_organization` (name, industry, country, website) then confirm | org `status='rejected'`; affected items: `brand_id`/`agency_id` → null, add field to `locked_fields`, item → review | `app.merge_organizations(into, org)` | ↑ |
| `new_person` | `status='confirmed'` | edit name/AR name/primary role | `status='rejected'`, credits keep `person_name_raw` with `person_id=null` | `app.merge_people` | ↑ |
| `campaign_merge` | attach the item to the suggested campaign (`added_by='human'`) | payload `{campaign_id}` or `{new:{title, occasion}}` | leave unlinked, mark the item so the linker skips it (`locked_fields` += `campaign`) | `app.merge_campaigns` when the task is about two campaigns | ↑ |
| `entity_merge` | perform the suggested merge | pick a different target | keep both | — | ↑ |
| `account_suggestion` | create the account via `admin_upsert_competitor` accounts path (status paused during the pilot unless told otherwise) | edit the URL then create | reject | — | ↑ |

**Merges** (`merge_organizations` / `merge_people` / `merge_campaigns`):
- re-point all FKs (items, item_credits, campaigns, news_mentions, embeddings, aliases);
- set `status='merged'` and `merged_into`;
- move the aliases;
- recompute the campaign aggregates.
- Merges are **never deletes**.

**`split_campaign`:** creates a new campaign from the selected items (`locked_by_human = true` on both).

**Guards:**
- Analyst+ for all of the above.
- Viewers get `42501`.
- Every write appends `ops.audit_log`.

**Done when:** pgTAP covers every kind × action, plus locked-field persistence (a later `ops.apply_extraction` on the same item doesn't overwrite a locked field, tested by calling it), merge FK re-pointing, and the viewer denial.

### T4 — `/review` UI + correction dialog everywhere

**Steps:**
1. The `/review` page per DESIGN.md §8.18:
   - **Left list (360 px):**
     - queue tabs All · Low confidence · New brands · New agencies · New people · Campaign merges · Account suggestions;
     - rows with thumbnail/icon, reason, competitor and age;
     - sorted by priority, then oldest.
   - **ReviewCard on the right:**
     - thumbnail + caption original + EN + source link;
     - the AI suggestion form with each field's confidence and evidence snippet;
     - the credits editor;
     - EntityMergePicker (search existing via `app.search` types organization/person);
     - CampaignMergePicker.
2. **Keyboard:**
   - J/K next/prev;
   - A approve;
   - E edit (⌘Enter saves);
   - R reject;
   - S snooze;
   - `?` shows the shortcut sheet.
3. **Behaviour:**
   - optimistic resolve with a 5 s undo toast; undo calls `app.review_reopen(task_id)`, which you add: only within 10 minutes, by the same user;
   - the sidebar Review badge count updates.
4. **Empty state:** "Queue is clear. Nice." + the last resolved time.
5. **CorrectionDialog** (re-uses the ReviewCard form), opened from:
   - the item drawer "Report a correction" (creates or uses an open task, then `app.correct_item`);
   - campaign detail "Edit" / "Split" / "Merge";
   - brand/agency/person "Edit" / "Merge with…".
6. **Revalidate** the affected tags in the server action: `item:{id}`, `campaign:{id}`, `brand:{slug}`, `feed`, `campaigns`.
7. **Audit sample** (AI_PIPELINE §11): tasks with reason `audit_sample` show an "Audit" pill. They're resolved the same way and counted for M12 accuracy.

**Done when:** e2e: an analyst resolves one task of each kind by keyboard; a viewer can't see `/review` (404); undo works; the corrected value survives a re-extraction (integration test via the RPC).

### T5 — Admin RPCs + workers

**Steps:**
1. Implement the admin RPCs in Deliverable 1. Each worker:
   - checks `private.has_role('admin')`;
   - uses `search_path = ''`;
   - audits;
   - validates its input (`raise exception … using errcode '22023'` on bad input).
2. **`admin_upsert_competitor`:**
   - creates or updates the competitor (slug unique, `company_code` = next free `C###`);
   - inserts accounts per URL: the handle is derived in SQL with the same rules as `scripts/seed-competitors.ts` (keep one implementation: `private.derive_handle(platform, url)`);
   - creates derived accounts automatically (`instagram_stories` for instagram, `linkedin_employees` for linkedin with cadence 7 days, `website` root for `website_work_page`);
   - sets `backfill_status = 'pending'` and `status` = `active`/`paused` per the "Start tracking now" flag;
   - rejects out-of-scope platforms;
   - returns `{competitor_id, account_ids}`.
3. **Settings:** `admin_set_setting` validates against the allowlist table in §2.
4. **Users:** `admin_set_member` refuses to demote or disable the last active admin.
5. **API keys:** `admin_store_api_key` stores the prefix, hash and scopes only. `admin_list_api_keys` never returns the hash.
6. **Costs:** `costs_summary(from, to)` returns:
   - by_day_provider;
   - by_platform;
   - by_competitor_top20;
   - by_category;
   - totals;
   - cost_per_new_item_30d;
   - month_to_date;
   - forecast_month (formula in §2);
   - budget_today `{limit, spent, remaining}`.

**Done when:** pgTAP: admin-only (analyst/viewer denied); validation errors; last-admin guard; handle derivation parity with the seed script (the same 20 test URLs).

### T6 — `/admin/competitors` (+ new, edit) + onboarding trigger + account actions

**Steps:**
1. **List:**
   - a DataTable with the columns Name · Code · Tier · Pilot rank · Markets · Status · Accounts (count + health dots) · Backfill status · Last run;
   - bulk actions Pause / Resume / Set tier (each bulk action is one RPC call per row inside one server action, with a progress toast).
2. **New/Edit form** (DESIGN.md §8.20):
   - the fields name, name_ar, slug (auto, editable on create only), markets, tier, pilot rank, categories (taxonomy multi), in-house (taxonomy multi), website, logo URL + the LogoTile tone toggle;
   - an AccountsRepeater (platform select + URL) with live handle derivation and the badges "Will track daily" / "Weekly snapshot" / "Not tracked — platform out of scope";
   - the "Start tracking now" checkbox (shows the pilot-scope + cost warning);
   - on save, the dialog: "Onboarding started: accounts are validated, then backfill from 1 Jan 2024 runs. You'll get an email when it's done." While WF-60 doesn't exist yet (until M15), the dialog text says "Backfill starts within the hour."
3. After a successful save, `lib/onboarding/notifyN8n.ts` POSTs to `${N8N_WEBHOOK_BASE}/webhook/emr-onboarding`. It is best-effort, with a 3 s timeout; failure is logged to the console and audit, never shown as an error.
4. Wire the competitor-profile Accounts tab buttons (Pause / Resume / Re-scrape → `admin_set_account_status`, `admin_request_rescrape`) and the header Edit/Pause (they were disabled in M10).
5. **Account suggestions:** a link to `/review?kind=account_suggestion`.

**Done when:**
- e2e: create a test competitor in **dev** with 2 accounts → rows exist with `backfill_status='pending'`;
- the next WF-00 backfill wave in dev picks them up (paste the run ID);
- pause/resume works;
- the out-of-scope URL is refused with an explanation.

### T7 — `/admin/taxonomies`

**Steps:**
1. Tabs per taxonomy: industry, content_format, occasion, competitor_category, credit_role, in_house_capability.
2. A sortable list (drag handle; keyboard reorder with Alt+↑/↓). Each row has:
   - the code (read-only after creation);
   - label EN;
   - label AR (`dir=rtl`);
   - the active toggle.
3. "Add term". The code is auto-slugged from the EN label and can be edited before the first save.
4. The warning line: "Codes are permanent. Labels can change. AI uses the active list from the next batch."
5. Saves through `app.admin_upsert_taxonomy_term`. Revalidate tag `taxonomies`, and add that tag to `lib/cache/tags.ts`.

**Done when:** e2e: add a term, deactivate it and reorder; WF-30's `ops.get_taxonomy_snapshot()` returns the new active list (SQL check).

### T8 — `/admin/pipeline` + settings card

**Steps:**
1. **Top:**
   - a status grid per platform (last run, status, accounts ok/failed, items new, next run);
   - queue depths (`ai_extract`, `embed`, `media`);
   - the failing accounts count;
   - backfill progress bars per platform (accounts done/total).
2. **Runs table:** workflow · platform · mode · started · duration · status · accounts · items seen/new · cost, with keyset pagination and filters (workflow, status, date). Clicking a row opens the RunDrawer (`app.pipeline_run_detail`): per-account results and errors.
3. **Failing accounts list:** Re-scrape and Pause buttons.
4. **SettingsCard:**
   - an auto-publish threshold slider (0.50–0.95, step 0.01, shows the current value and the default 0.80);
   - the stories-twice-daily toggle;
   - daily budget (USD);
   - campaign window days;
   - campaign similarity.

   Save via `app.admin_set_setting`. During the pilot, show the confirm dialog "This changes pilot measurements" and append a line to the M08 PROGRESS pilot log (Codex does this when it sees the audit entry; also show a reminder in the UI).
5. The top-bar pipeline status dot links here for admins.

**Done when:** the run list matches `ops.scrape_runs` (count check); the drawer shows per-account errors for a known failed run; a settings change is audited (SQL).

### T9 — `/admin/costs`

**Steps:**
1. **KPI tiles:** today, month to date, month forecast, cost per new item (30 days), budget remaining today.
2. **Charts:**
   - stacked bars by day per provider (Apify, OpenAI, SerpAPI, Firecrawl, fixed fees);
   - by platform;
   - by competitor (top 20 table);
   - by category (scrape, ai_extract, embed, brief, news, fixed_fee).

   Every chart has a table view.
3. **Price book table:** read-only, with an admin "Edit prices" dialog (`app.admin_update_price`) that inserts a new dated row; it never edits history.
4. **Budget setting:** a shortcut to the SettingsCard value.
5. Copy at the top: "What does it cost to run? {forecast} this month at the current pace." (D-25).

**Done when:** the totals equal `select sum(cost_usd) from ops.cost_ledger where day between …` (pasted); the forecast formula is unit-tested.

### T10 — `/admin/users` + `/admin/api-keys`

**Steps:**
1. **Users:**
   - a table of invited and active members (email, name, role select, status, last seen);
   - the Invite dialog (email + role) with the note "They sign in with Google using this email.";
   - disable/enable;
   - the last-admin guard error is shown nicely.
2. **API keys:**
   - a table (name, prefix `emr_xxxxxxxx`, scope chips, rate limit, created by, last used, status);
   - the Create dialog (name, scopes, rate limit default 120/min);
   - on create, the KeyRevealBlock shows `emr_<prefix>_<secret>` **once** with "Copy it now — it won't be shown again.";
   - Revoke needs a confirm that names the key;
   - a call log for the selected key (`app.admin_api_calls`, empty until M14);
   - the banner "Keys work once the Agent API is live (M14)."
3. **Key generation** (`lib/apikeys/generate.ts`, server-only): `crypto.getRandomValues`, base62, prefix 8, secret 32; `hash = sha256(secret + API_KEY_PEPPER)` hex. Unit tests check the format and that the same input gives the same hash. **The plaintext secret is never logged.**

**Done when:** e2e (dev):
- invite a test email → it appears as invited;
- create a key → the secret is shown once, and a reload doesn't show it;
- the DB has only the hash;
- revoke sets `revoked_at`.

### T11 — `/settings/alerts` + `/settings/profile`

**Steps:**
1. **Alerts:** a card per rule kind with:
   - an active toggle;
   - filters (market, tiers, competitors, formats);
   - recipients (a chip input, validated emails).

   Admin saves go through `app.admin_upsert_alert_rule`. Non-admins see the rules, and a "Send to me" toggle per rule (`app.alert_subscribe`).
2. Seed the default rules if missing: daily_digest, instant_launch, budget, failing_sources and weekly_brief, all → `mohamed.abdelrahman@everyone.film` (D-21).
3. The banner: "Emails start once alerts are live (M13)."
4. **Profile:** name (display only), theme (Dark/Light/System), default market, density. Store these in localStorage. Named filter sets go in `app.saved_views` (from M10, if done).

**Done when:** an admin edits recipients and a viewer subscribes/unsubscribes themselves (SQL check); the viewer can't edit other recipients (RPC denial test).

### T12 — Tests, a11y, runbook, MA-21 walkthrough

**Steps:**
1. Playwright:
   - `search.spec.ts`
   - `command.spec.ts`
   - `review.spec.ts` (each kind by keyboard)
   - `corrections.spec.ts`
   - `admin-competitors.spec.ts`
   - `admin-taxonomies.spec.ts`
   - `admin-pipeline.spec.ts`
   - `admin-costs.spec.ts`
   - `admin-users-keys.spec.ts`
   - `alerts.spec.ts`
   - `role-guards.spec.ts` (viewer / analyst / admin access matrix for every route)
2. axe on `/search`, `/review`, `/admin/competitors/new` and `/admin/costs`: 0 serious or critical issues.
3. Write `docs/runbooks/ADMIN.md`.
4. Write `ACCEPTANCE_WALKTHROUGH.md`: a click-by-click checklist for the owner, about 20 steps:
   - sign in;
   - search EN and AR;
   - open an item;
   - report a correction;
   - review 5 tasks by keyboard;
   - merge two brands;
   - split a campaign;
   - add a test competitor (paused);
   - pause/re-scrape an account;
   - edit a taxonomy label;
   - read the costs forecast;
   - invite a user;
   - create + revoke a key;
   - edit alert recipients.

   Each step has an expected result and a ☐ for the owner.
5. Request MA-21.

**Done when:** CI is green; the walkthrough is completed by the owner with notes; any issues found are fixed or logged as follow-ups.

## 8. Interfaces & contracts

| Interface | Contract |
|---|---|
| `app.search(p_query text, p_embedding vector(1536), p_types text[], p_filters jsonb, p_limit int)` | Returns `(entity_type, entity_id, title, subtitle, score, thumbnail_path, platform, logo_url)` (extended columns allowed: update the types). RRF k = 60. Security invoker. |
| `app.similar(entity_type, entity_id, limit)` | Unchanged |
| `app.review_resolve(p_task_id bigint, p_action text, p_payload jsonb) → jsonb` | Actions `approve\|correct\|reject\|merge\|snooze`; returns `{task_id, status, changed:{entity_type, entity_id, fields[]}}`; analyst+ |
| `app.review_reopen(p_task_id bigint)` | Same user, within 10 min (undo) |
| `app.correct_item(p_item_id uuid, p_patch jsonb)` | Patch keys: `brand_id`, `agency_id`, `production_competitor_id`, `content_type`, `occasion`, `country`, `campaign_title`, `is_commercial_work`, `credits[]`, `summary_en`, `summary_ar`; adds keys to `locked_fields`; analyst+ |
| `app.merge_organizations(keep, merge)`, `app.merge_people(keep, merge)`, `app.merge_campaigns(keep, merge)`, `app.split_campaign(campaign_id, item_ids[]) → uuid`, `app.edit_campaign`, `app.edit_organization`, `app.edit_person` | Analyst+; never delete; audit |
| `app.admin_upsert_competitor(p jsonb) → jsonb` | `p = {id?, name, name_ar?, slug?, markets[], tier, pilot_rank?, categories[], in_house[], website_url?, logo_url?, logo_tone?, start_tracking:boolean, accounts:[{platform, url}]}` → `{competitor_id, account_ids[], rejected:[{url, reason}]}` |
| Onboarding call (best-effort) | `POST ${N8N_WEBHOOK_BASE}/webhook/emr-onboarding`, header `x-emr-secret: ${N8N_WEBHOOK_SECRET}`, body `{competitor_id, account_ids}`, 3 s timeout, expect 202 (WF-60 arrives in M15) |
| `app.admin_request_rescrape(p_account_id uuid, p_mode text)` | `daily` → `next_due_at = now()`; `backfill` → `backfill_status='pending'`, `backfill_cursor = null` |
| `app.admin_set_setting(p_key text, p_value jsonb)` / `app.get_settings()` | Allowlist + ranges in §2 |
| `app.costs_summary(p_from date, p_to date) → jsonb` | Keys in T5; admin |
| `app.pipeline_summary(p_days int) → jsonb`, `app.pipeline_run_detail(p_run_id uuid) → jsonb` | Member: simplified; admin: full |
| API key format | `emr_<prefix8>_<secret32>` (base62); stored `prefix` + `sha256(secret+pepper)` hex; scopes ⊆ {read, write, admin} |
| `app.alert_subscribe(p_rule_id bigint, p_subscribe boolean)` | Adds/removes the caller's email in `recipients` |
| Cache tags revalidated by user actions | `item:{id}`, `campaign:{id}`, `campaigns`, `feed`, `brand:{slug}`, `agency:{slug}`, `person:{slug}`, `competitor:{slug}`, `taxonomies`, `stats` |
| Routes added | `/search`, `/review`, `/admin/competitors`, `/admin/competitors/new`, `/admin/competitors/[slug]`, `/admin/taxonomies`, `/admin/pipeline`, `/admin/costs`, `/admin/users`, `/admin/api-keys`, `/settings/alerts`, `/settings/profile` |

## 9. Acceptance criteria

- **AC1** The migration is applied to dev and prod. pgTAP is green for search, every review kind × action, merges/splits, locked-field persistence against `ops.apply_extraction`, all admin RPCs (role denials, validation, last-admin guard), and `alert_subscribe`. Advisors are clean.
- **AC2** Search: the 5 benchmark queries return relevant results (English, Arabic, typo'd brand, semantic-only, filtered), each with < 800 ms DB time on 100k synthetic items (EXPLAIN pasted). The keyword-only fallback works when OpenAI is unreachable (simulated).
- **AC3** ⌘K works from every page. `/search` tabs, groups and "find similar" work. No OpenAI key is in client bundles (grep).
- **AC4** Review: an analyst resolves one task of every kind by keyboard. Undo works. A corrected field is still corrected after a forced re-extraction. Aliases are taught (SQL shows a new `org_aliases` row with source `human`).
- **AC5** Corrections from the item drawer, campaign detail (edit/split/merge) and entity pages (edit/merge) work and are audited.
- **AC6** Admin competitors: a test competitor added in dev gets accounts with `backfill_status='pending'`; the dev WF-00 backfill wave processes them (run ID pasted). Out-of-scope URLs are refused. Pause/resume/re-scrape work. The best-effort onboarding call is logged.
- **AC7** Taxonomies CRUD works and WF-30's snapshot reflects it. The pipeline page matches `ops.scrape_runs`. A settings change is audited and the pilot confirm dialog appears.
- **AC8** Costs: the totals equal the ledger SQL. The forecast formula is unit-tested. The top line answers "what does it cost to run?".
- **AC9** Users and API keys: invite, role change, last-admin guard; a key's secret is shown once and only its hash is stored; revoke works.
- **AC10** Alerts UI: admins edit rules; viewers subscribe themselves only. The default owner rules exist.
- **AC11** Role guard matrix e2e passes (viewer / analyst / admin across all routes). axe has 0 serious or critical issues on the 4 key pages.
- **AC12** The owner completed `ACCEPTANCE_WALKTHROUGH.md` (MA-21) and the notes are recorded. Blocking issues are fixed.

## 10. Tests to write

- **pgTAP:** `supabase/tests/review_admin_search.test.sql` (split per area if large: `search.test.sql`, `review.test.sql`, `admin.test.sql`).
- **Vitest:** `lib/apikeys/generate.ts`, `lib/search/embedQuery.ts` (timeout + fallback with a mocked fetch), the cost forecast function, `derive_handle` parity fixtures (shared JSON of 20 URLs → expected handles, used by both the pgTAP and TS tests), the review keyboard reducer.
- **Playwright:** the specs in T12 plus `role-guards.spec.ts`.
- **Perf:** `scripts/perf/search_bench.sql` (5 queries, prints the timings).

## 11. Manual actions from the owner

| ID | Action | When |
|---|---|---|
| MA-20 (addition) | Add to Vercel (Preview = dev, Production = prod): `OPENAI_API_KEY`, `OPENAI_MODEL_EMBED=text-embedding-3-small`, `API_KEY_PEPPER` (`openssl rand -base64 48`; keep it forever, since rotating invalidates all keys), `N8N_WEBHOOK_BASE`, `N8N_WEBHOOK_SECRET` | Before T2 / T6 / T10 on preview |
| — | Run the prod migration if Codex has no prod token (Codex gives the command) | Before AC1 prod |
| MA-21 | Do the acceptance walkthrough on production (`milestones/M11-search-review-admin/ACCEPTANCE_WALKTHROUGH.md`) and tick each step; write notes in PROGRESS | End of milestone |

## 12. Risks & gotchas

- **SECURITY DEFINER sprawl.** Keep every definer function in `private` with `search_path = ''`, the role check first, fully-qualified names and EXECUTE granted only to `authenticated`. Run `supabase db advisors` after the migration.
- **Merges touch many tables.** Wrap each one in one transaction. Re-point `embeddings` and `news_mentions` too, and re-enqueue embeddings for the survivor. Test with an org that has items, credits, campaigns and aliases.
- **Locked fields vs the linker/extractor.** Verify that `ops.apply_extraction` (M07) and `ops.attach_to_campaign` (M08) both honour `locked_fields` / `locked_by_human`. Fix them here if they don't, with a regression test.
- **Pilot integrity.** Settings changes, competitor additions with "Start tracking now", and bulk tier changes alter the pilot. Make them deliberate (confirm dialogs) and logged.
- **The API key pepper is a one-way door.** Losing or rotating it invalidates every key. Document this in ADMIN.md.
- **Search relevance in Arabic.** `simple` + `unaccent` doesn't stem Arabic. Semantic search compensates. Add trigram on `caption_original` only if the benchmark shows misses, and watch the index size.
- **Cost of the query embedding** is negligible. Still cache it, and never call OpenAI from the client.

## 13. Cost & budget notes

- OpenAI query embeddings: about 10–50 tokens per search, so fractions of a cent per day.
- Re-scrape buttons and "Start tracking now" can create Apify cost. The button tooltips show "Uses provider credits", and every use is audited.
- No other new external cost.

## 14. Definition of done & hand-off

**Done when:**
- AC1–AC12 pass with evidence in PROGRESS;
- the PR `m11-search-review-admin` is merged;
- the root board is updated (M11 Done; M12 → `Not started — starts on pilot day 14 (<date>)`, or `In progress` if the date has passed).

**Hand-off to M12** (fill in PROGRESS):
- how to pull review and audit-sample stats for the accuracy report;
- where the costs data and forecast live;
- which settings the owner may tune at the gate;
- the open review backlog size;
- any UI issues from the MA-21 walkthrough that are still open.
