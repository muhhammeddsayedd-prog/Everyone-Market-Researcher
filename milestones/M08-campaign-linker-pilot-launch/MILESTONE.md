# M08 — Campaign linker + pilot launch

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first, then the root `PROGRESS.md`.

## 1. Goal and outcome

Group published commercial items into **campaigns**, then **launch the 14-day pilot** in production on the top 50 competitors plus the Everyone Films baseline.

When M08 is done:
- WF-32 runs every day at 06:30 Cairo. It attaches each newly published commercial item to an existing campaign or creates a new one; uncertain cases go to the review queue.
- The pilot backlog (everything backfilled since 1 Jan 2024, which M04–M07 already ran **once in prod** after MA-14/MA-15/MA-17) is linked into campaigns in prod.
- In **prod**: migrations applied, seed loaded, credentials set, every pilot collector scheduled, WF-90/WF-91 active, cost ledger live, daily budget alert on.
- The owner has approved the start (MA-18). **Pilot day 1** is recorded in the root `PROGRESS.md` → Key dates.
- Three clean daily runs in a row have completed in prod.
- M09–M11 are marked `Parallel-OK` on the root board, so the web app is built while the pilot collects data. Codex runs a short daily pilot check during those milestones.

## 2. Context you need

- **Campaign rule (D-16):** same brand + same production house + close in time = one campaign. The same client returning later = a new campaign.
- **Linker spec:** `docs/AI_PIPELINE.md` §9.
  - **Candidate search (SQL):** a newly published commercial item that is not yet in a campaign is matched against campaigns with the same `brand_id` and the same `production_competitor_id`, whose `last_seen_at` is within `campaign_window_days` (default **45**) of the item's `published_at`. Candidates are ranked by embedding similarity (item vs campaign vector) and title trigram.
  - **Decision thresholds**, read from `ops.settings`, never hard-coded:
    - top similarity ≥ `campaign_similarity_min` (default **0.82**) with a single clear winner → **attach**;
    - no candidate, or top similarity < `0.75` → **new campaign**;
    - top similarity in `[0.75, 0.82)`, or two candidates within `0.03` of each other → **tie-breaker** prompt `reference/prompts/campaign_link.v1.md` (fast model, strict JSON). If the tie-breaker's confidence is < 0.80 → review task `campaign_merge`, and the item stays unlinked until the review is resolved.
- **New campaign title:** the item's `campaign_title` if present, else `"{brand} · {occasion label or content_type label} · {Mon YYYY}"`.
- **Cross-platform (AI_PIPELINE §9.3):**
  - Website project pages carry `media_urls` (Vimeo/YouTube embeds) in `ingest.raw_items.normalized`. If a `media_url` matches a known Vimeo or YouTube item URL/ID, attach the page to **that item's campaign** directly (similarity 1.0, `added_by = 'ai'`), no AI call.
  - Otherwise the normal brand + house + time + similarity rule merges Vimeo/IG/website cuts of the same film.
- **Campaign upkeep on attach:**
  - update `first_seen_at`, `last_seen_at`, `item_count` and `platforms[]`;
  - regenerate `summary_en`/`summary_ar` (short prompt, fast model) when items are added (debounced: once per campaign per linker run);
  - `pgmq.send('embed', {entity_type:'campaign', entity_id})`.
- **Human locks:** `campaigns.locked_by_human = true` means the linker may **add** items but never removes or re-assigns items. `campaign_items.added_by = 'human'` rows are never touched.
- **Tables:** `app.campaigns`, `app.campaign_items` (an item belongs to at most one campaign: `item_id` unique), `app.review_tasks` (kind `campaign_merge`), `app.embeddings` (entity_type `campaign`/`item`). See `reference/sql/002_core_tables.sql`.
- **Pilot scope (D-05):**
  - **Who:** the 50 competitors with `priority_tier = 'pilot'` (sheet ranks 1–50: 19 EG, 15 KSA, 16 UAE) plus the baseline `C000` Everyone Films.
  - **Accounts:** about 195 pilot accounts (48 websites, 48 Instagram, 47 Vimeo, 41 LinkedIn, 11 YouTube), plus the baseline's, plus the derived `instagram_stories` and `linkedin_employees` rows. Every other competitor's accounts stay `paused`.
- **Prod first time:** M01 applied the baseline schema to prod. M08 is the milestone that brings prod fully up to date and switches schedules on (AGENTS.md rule 8).
- **Execution budget:** about 160 n8n executions per day in total for the pilot (`docs/N8N_WORKFLOWS.md` §3 budget table) against 50K per month.

## 3. Prerequisites

- **Milestones:** M04, M05, M06 and M07 Done. The collectors were built and tested in dev; the pilot backfill (M04–M06) and the AI backlog (M07) already ran **once in prod** after the owner approved each estimate (DECISIONS → Changes). Prod schedules are still off.
- **Embeddings:** item embeddings must exist for published items. The linker depends on WF-33 (M07).
- **Manual actions:**
  - MA-11: prod n8n credentials exist (Postgres prod with `n8n_writer`, Apify, OpenAI, Vimeo, YouTube, Firecrawl, email placeholder).
  - MA-13: daily budget value.
  - MA-18: pilot start approval (requested in this milestone).

## 4. Scope

**In:**
- `ops.campaign_candidates`, `ops.campaign_candidates_since`, `ops.attach_to_campaign`, and `ops.get_campaign_summary_inputs`/`ops.save_campaign_summary` (or summary regeneration inside the n8n flow).
- WF-32 in dev, then prod.
- The cross-platform `media_urls` link.
- Backfill linking of the pilot backlog.
- Pilot readiness in prod: migrations, seed, credentials, schedules, error/health workflows, cost ledger, budget alert.
- The go-live switch, pilot day 1, and 3 clean daily runs.
- The pilot monitoring routine (checklist + log format) used during M09–M11.

**Out:**
- Any web UI for campaigns (M10).
- The review UI (M11): until M11, review tasks are inspected with SQL.
- Briefs and alerts (M13).
- Onboarding new competitors (M15).
- Scaling beyond the pilot (M15).
- Changing thresholds based on pilot data (M12).

## 5. References

- `docs/AI_PIPELINE.md` §5 (statuses), §7 (embeddings), §9 (linker)
- `reference/prompts/campaign_link.v1.md`
- `docs/N8N_WORKFLOWS.md`: schedule table, WF-00, WF-32, WF-33, WF-70, WF-90, WF-91, executions budget, dev/prod handling, export rules
- `docs/DATA_SCHEMA.md` §3–5, plus `reference/sql/002_core_tables.sql` and `004_rpc_pipeline.sql`
- `docs/TECHNICAL.md` §4 (environments), §6 (n8n conventions), §13 (cost)
- `docs/ENVIRONMENT.md` §2 (n8n credentials)
- `docs/MANUAL_ACTIONS.md` MA-18
- `docs/TESTING.md` §1 (n8n workflow tests, idempotency rule)

## 6. Deliverables

1. A migration `campaign_linker`, created with `supabase migration new campaign_linker`, adding:
   - `ops.campaign_candidates(p_item_ids uuid[]) → jsonb`
   - `ops.campaign_candidates_since(p_since timestamptz, p_limit int default 500) → jsonb`
   - `ops.attach_to_campaign(p_item_id uuid, p_campaign_id uuid, p_new_campaign jsonb, p_similarity numeric) → uuid`
   - `ops.get_campaigns_needing_summary(p_run_started timestamptz) → jsonb`
   - `ops.save_campaign_summary(p_campaign_id uuid, p_summary jsonb)`
   - `ops.link_by_media_urls(p_item_ids uuid[]) → jsonb`
   - `ops.last_successful_run_at(p_workflow text) → timestamptz` (if it does not exist yet)
   - pgTAP tests in `supabase/tests/campaign_linker.test.sql`.
2. **WF-32 · Campaign linker [dev] / [prod]**: built via n8n MCP and exported to `n8n/workflows/WF-32-campaign-linker.json`.
3. `scripts/link-backlog.ts`, or a WF-32 manual mode `{mode:'backlog', from:'2024-01-01'}`, to link the pilot backlog in chunks.
4. `n8n/prompts/campaign_link.v1.md` (copied from `reference/prompts/`) and `n8n/prompts/campaign_summary.v1.md` (new, short).
5. `docs/runbooks/PILOT.md`: the readiness checklist, the go-live steps, the daily monitoring routine and the rollback steps.
6. `scripts/assert/pilot_daily_check.sql`: one query returning the daily pilot health row (used by the monitoring routine).
7. Root `PROGRESS.md` updated:
   - pilot day 1 date;
   - M08 Done;
   - M09, M10 and M11 marked `Parallel-OK`;
   - M12 `Not started (waits for pilot day 14 + M11)`.

## 7. Tasks

### T1 — Candidate SQL (`ops.campaign_candidates`, `ops.campaign_candidates_since`)

**Steps:**
1. **Input:** item IDs, or "since" = the last successful WF-32 run (`ops.last_successful_run_at('WF-32')`, falling back to `now() - interval '2 days'`).
2. **Select items** where:
   - `ai_status = 'published'`
   - `is_commercial_work = true`
   - `duplicate_of is null`
   - `status = 'active'`
   - `brand_id is not null`
   - no row in `app.campaign_items`
3. **Items with no brand** are not linked. They stay unlinked; they are not reviewed again here because M07 already routes them.
4. **Find candidates** per item, using a lateral join on `app.campaigns` where:
   - `status <> 'merged'`
   - same `brand_id`
   - same `production_competitor_id` (`coalesce(item.production_competitor_id, item.competitor_id)`)
   - `item.published_at between c.first_seen_at - window and c.last_seen_at + window`
5. **Score each candidate:**
   - `sim = 1 - (item_emb <=> campaign_emb)` from `app.embeddings`;
   - `title_sim = similarity(c.title, coalesce(item.campaign_title, item.title, ''))`;
   - `score = greatest(sim, 0.6*sim + 0.4*title_sim)`.
   - Return the top 3 per item.
6. **Output:** jsonb `[{item:{id, brand_id, production_competitor_id, published_at, campaign_title, title, summary_en, tags, occasion, content_type, country, agency_id}, candidates:[{campaign_id, title, summary_en, first_seen_at, last_seen_at, item_titles[], similarity, score}]}]`.
7. **Reading settings:** read `campaign_window_days` and `campaign_similarity_min` from `ops.settings` inside the function. Return them in the output (`settings` key), so the n8n Code node never hard-codes them.

**Files:** `supabase/migrations/<ts>_campaign_linker.sql`.

**Done when:** pgTAP returns the expected candidates for fixtures (same brand+house within 45 days → candidate; 3 months later → none; different house → none).

### T2 — Attach/create RPC (`ops.attach_to_campaign`)

**Inputs:**
- `p_campaign_id` (attach), or `p_new_campaign` jsonb `{title, occasion, country, agency_id}` (create);
- `p_similarity`.

**Steps:**
1. Lock the item row (`for update`). If it's already in `campaign_items`, return the existing campaign ID (**idempotent**).
2. **Create:**
   - insert `app.campaigns` with `brand_id`, `production_competitor_id`, `agency_id`, `title`, `occasion`, `country` and `confidence`;
   - set `first_seen_at` = `last_seen_at` = `published_at` and `platforms` = `{platform}`.
3. **Attach:** insert `campaign_items (campaign_id, item_id, added_by 'ai', similarity)` and update the campaign aggregates:
   - `first_seen_at = least(...)`
   - `last_seen_at = greatest(...)`
   - `item_count = (select count(*))`
   - `platforms = array(select distinct platform …)`
   - `updated_at`
   - `agency_id`: fill only if null.
4. Never modify a campaign whose `status = 'merged'`. Follow `merged_into` instead.
5. `pgmq.send('embed', {entity_type:'campaign', entity_id})`.
6. Write `ops.audit_log` (`actor_type 'n8n'`, action `campaign_attach` / `campaign_create`).
7. **Grants:** `SECURITY DEFINER`, `search_path = ''`, EXECUTE only to `n8n_writer`.

**Done when:** pgTAP shows that calling it twice for the same item creates one link; aggregates are correct; `locked_by_human` campaigns accept new items; a merged campaign redirects.

### T3 — Cross-platform link by media URL (`ops.link_by_media_urls`)

**Steps:**
1. For the given item IDs, look for website `project_page` items whose `ingest.raw_items.normalized->'media_urls'` contains Vimeo/YouTube URLs.
2. Extract the video IDs with a regex for `vimeo.com/(\d+)`, `player.vimeo.com/video/(\d+)`, `youtu.be/([\w-]{11})` and `youtube.com/watch?v=([\w-]{11})`.
3. Find `app.items` with platform `vimeo`/`youtube` and that `external_id` from the **same competitor**. If that item has a campaign, attach the page to it with similarity 1.0.
4. **Reverse direction:** a Vimeo/YouTube item published later than a page that embeds it. Run the same check when linking the video.

**Done when:** the fixture page embedding a known Vimeo video lands in that video's campaign without an AI call.

### T4 — WF-32 · Campaign linker (dev)

**Build** via n8n MCP, following the N8N_WORKFLOWS conventions:
- name `WF-32 · Campaign linker [dev]`;
- tags `env:dev`, `layer:ai`;
- timezone `Africa/Cairo`;
- error workflow = WF-90.

**Trigger:** an Execute Workflow Trigger only. WF-00 schedules it daily at 06:30 Cairo (`linker` slot); manual/backlog mode passes `{mode, from, to}`. Do **not** add a Schedule Trigger to WF-32 (it would run twice a day).

**Steps:**
1. `SUB · Start run` (`WF-32`, platform null, mode `daily`|`manual`).
2. Postgres: `select ops.link_by_media_urls(...)` for website items since the last run.
3. Postgres: `select ops.campaign_candidates_since($1::timestamptz, 500) as c;`
4. **Code node** decision per item, using `settings` from the RPC output:
   - no candidates, or top < 0.75 → `new`
   - top ≥ `campaign_similarity_min` and (second is missing or top − second ≥ 0.03) → `attach`
   - otherwise → `tiebreak`
5. **Tie-break branch:** HTTP to OpenAI (fast model `OPENAI_MODEL_EXTRACT`, strict JSON schema with the fields from `campaign_link.v1.md` plus `"decision": "attach"|"new"`). If `confidence < 0.80`, insert a review task via Postgres `select ops.create_review_task('campaign_merge', 'item', $1, $2::jsonb, $3);`. Add that RPC if M07 didn't. The suggestion holds the candidates and the model's reason. Skip the attach for that item.
6. Postgres per item: `select ops.attach_to_campaign($1::uuid, $2::uuid, $3::jsonb, $4);` (batched in a Loop of 50).
7. **Summary regeneration:**
   - Postgres `select ops.get_campaigns_needing_summary($1)` (campaigns touched this run, max 100);
   - OpenAI (fast model, prompt `campaign_summary.v1`, JSON `{summary_en, summary_ar}`) for campaigns with ≥ 2 items. A single-item campaign copies the item summary inside SQL;
   - Postgres `select ops.save_campaign_summary($1, $2::jsonb)`.
8. `SUB · Log cost` (OpenAI tokens × `ops.get_price_book()`).
9. `SUB · Finish run`.
10. Execute WF-33 (embeddings, don't wait) and WF-70 `{tags:["campaigns","feed","stats"]}` (don't wait). If WF-70 is still a stub, that's fine: M09 makes it real.

**Then:**
- Fix the WF-32 thresholds text in `docs/N8N_WORKFLOWS.md` to match AI_PIPELINE §9.
- Export the JSON to `n8n/workflows/WF-32-campaign-linker.json` with no credentials.

**Done when:** the dev fixture set passes:
- 10 items across platforms for one brand × house within 2 weeks → 1 campaign;
- the same brand 3 months later → a new campaign;
- an ambiguous case → a tie-break call, or a review task;
- re-run → 0 new links.

### T5 — Campaign summary prompt

**Write** `n8n/prompts/campaign_summary.v1.md`:
- input: up to 10 item summaries + the brand, house, agency, occasion and dates;
- output: `summary_en` (≤ 2 sentences) and `summary_ar` (≤ 2 sentences, MSA);
- facts only.

**Version** it as `prompt_version` in the cost/audit meta.

**Done when:** 5 sample campaigns produce sensible summaries (paste them into PROGRESS).

### T6 — Link the pilot backlog (prod)

The backlog lives in prod (backfilled once in M04–M07). Link it there.

**Steps:**
0. Apply the M08 migrations to prod (owner's prod-scoped token, MA-04) and create `WF-32 · Campaign linker [prod]` with schedules **off**.
1. Run WF-32 [prod] in backlog mode (or `scripts/link-backlog.ts`, which calls the same RPCs month by month from 2024-01 to today), oldest month first, so campaigns grow forward in time.
2. **Before running,** post the estimate in PROGRESS: tie-break calls ≈ 10–15% of items, summary calls ≈ number of campaigns, cost from `ops.price_book`. The cost is small, but AGENTS rule 9 still applies, so wait for the owner's OK in PROGRESS (or for the owner's standing approval from MA-14/MA-15 if it covers AI cost; log which).

**Done when:**
- every eligible item is in a campaign or has an open `campaign_merge` review task;
- the SQL counts are pasted: campaigns created, items linked, review tasks, average items per campaign, and the share of multi-platform campaigns.

### T7 — Spot-check quality

**Steps:**
1. Sample 30 campaigns (stratified by country). Check:
   - wrong merges (two different films in one campaign);
   - wrong splits (the same film in two campaigns).
2. Record the counts in PROGRESS.
3. If wrong merges are > 10% or wrong splits are > 15%: adjust only `campaign_window_days` / `campaign_similarity_min` in `ops.settings` (dev first, then prod), re-run on a test month, and log the change as a Decision & deviation (final tuning happens in M12).

**Done when:** the spot-check table is in PROGRESS.

### T8 — Prod readiness

Work through the checklist in `docs/runbooks/PILOT.md` (write it first) and tick every item with evidence:

1. **Migrations:** all migrations M01–M08 applied to **prod** (`supabase db push` against prod with the owner's prod-scoped token (MA-04), which the owner provides or runs). Advisors clean on prod.
2. **Seed:** prod seed loaded (`scripts/seed-competitors.ts` against prod, run by the owner or with owner approval). Counts are 285 competitors and 1,272 + derived accounts. Pilot accounts `active`, the rest `paused` (verify with SQL).
3. **Account resolution:** account resolution (M02 script) run on prod. ≥ 95% of pilot Vimeo/YouTube accounts resolved.
4. **Taxonomies and settings:** taxonomies, settings and price book present in prod; `daily_budget_usd` set from MA-13.
5. **Credentials:** prod n8n credentials exist and test OK (Postgres prod `n8n_writer` connection test, Apify, OpenAI, Vimeo, YouTube, Firecrawl, SerpAPI not needed yet, email/notify).
6. **Workflows:** prod copies of SUBs, WF-00, WF-10, WF-11, WF-12, WF-13, WF-18, WF-18b, WF-19, WF-21, WF-30, WF-31, WF-32, WF-33, WF-40, WF-70 (stub OK), WF-90 and WF-91:
   - tagged `env:prod`;
   - pointing at the prod credentials;
   - error workflow = WF-90 [prod];
   - **schedules still inactive**.
7. **Backfill check:** verify — do not re-run — the prod backfill done in M04–M06 and the AI backlog from M07: every pilot account has `backfill_status = 'done'` (or a logged reason), `ai_extract` queue depth ≈ 0, and per-platform item counts from 2024-01-01 are pasted. Any gaps are re-run only for the affected accounts, with a small estimate posted first.
8. **Cost ledger:** receiving rows in prod (`select count(*) from ops.cost_ledger` > 0 after a manual WF-91 run).
9. **Budget alert:** WF-91 sends the health email to the owner; the budget alert is tested by temporarily setting `daily_budget_usd = 0.01` in prod and then restoring it.
10. **Storage:** the bucket `media` exists in prod, and `/api/internal/media-upload-url` is reachable. If the web app isn't deployed to prod yet, WF-31 runs against a prod preview deployment of the upload route. See risk R4.

**Done when:** the checklist is complete with evidence, and MA-18 has been requested.

### T9 — Go live (after MA-18)

**Steps:**
1. Activate the prod schedules from the N8N_WORKFLOWS §2 schedule table: WF-00 (all daily/weekly slots: collectors, stories, LinkedIn employees, linker WF-32, removal check WF-40, health WF-91; the `backfill_wave` rule stays off — the backfill already ran) and the own-schedule exceptions WF-30 (30 min), WF-31 (2 h) and WF-33 (hourly + weekly). WF-32 has no trigger of its own.
2. Record in the root `PROGRESS.md` → Key dates: **Pilot day 1 = <date>** and **Pilot review (day 14) = <date + 13>**.
3. Log the exact activation time per workflow in the M08 PROGRESS file.

**Done when:** all pilot schedules are active in prod and the dates are recorded.

### T10 — Three clean daily runs

**Steps:**
1. For three consecutive days after go-live, run `scripts/assert/pilot_daily_check.sql` on prod and paste the row into PROGRESS.
2. A day is **clean** when:
   - every scheduled workflow finished (`ops.scrape_runs.status in ('success','partial')`, no `failed`);
   - ≥ 95% of due pilot accounts succeeded;
   - no duplicate items (`select platform, external_id, count(*) … having count(*) > 1` = 0);
   - the AI queue is drained by 10:00 Cairo (`ai_extract` depth < 50);
   - the cost is within the daily budget;
   - WF-90 sent no failure email.
3. If a day isn't clean, fix it and restart the count.

**Done when:** 3 consecutive clean days are logged.

### T11 — Pilot monitoring routine + board update

**Steps:**
1. Write the "Daily pilot check" in `docs/runbooks/PILOT.md` (a 5-minute routine) and the log format.
2. The `pilot_daily_check.sql` output columns:
   - date
   - runs_total, runs_ok, runs_ok_pct
   - accounts_due, accounts_ok_pct
   - failing_accounts (list of top 10 handles)
   - items_new_by_platform (jsonb)
   - ai_queue_depth, embed_queue_depth, media_queue_depth
   - review_open (by kind)
   - published_share_24h
   - cost_yesterday_usd, budget_usd, month_to_date_usd, forecast_usd
   - n8n_executions_yesterday (from `ops.scrape_runs` count; the n8n UI count is entered manually once a week)
3. **During M09–M11,** Codex runs it once per working session (at least once per calendar day it works) and appends **one line** to `milestones/M08-campaign-linker-pilot-launch/PROGRESS.md` → "Pilot monitoring log" (this keeps M09–M11 logs clean). Anything red → fix it immediately as a hotfix branch `m08-hotfix-<slug>`, and note it there.
4. Root board:
   - M08 → Done;
   - M09, M10 and M11 → `Parallel-OK` (status `Not started` + the Parallel-OK flag);
   - M12 → `Not started — waits for pilot day 14 (<date>) and M11 Done`.

**Done when:** the routine is documented, the first log line is written and the board is updated.

## 8. Interfaces & contracts

| Interface | Contract |
|---|---|
| `ops.campaign_candidates_since(p_since timestamptz, p_limit int) → jsonb` | `{settings:{window_days, similarity_min}, items:[{item:{…}, candidates:[{campaign_id, title, summary_en, first_seen_at, last_seen_at, item_titles, similarity, score}]}]}` |
| `ops.attach_to_campaign(p_item_id uuid, p_campaign_id uuid, p_new_campaign jsonb, p_similarity numeric) → uuid` | Exactly one of `p_campaign_id` or `p_new_campaign` is non-null. Returns the campaign ID. Idempotent. |
| `ops.link_by_media_urls(p_item_ids uuid[]) → jsonb` | `{linked:[{item_id, campaign_id, via_item_id}], unmatched:int}` |
| `ops.get_campaigns_needing_summary(p_since timestamptz) → jsonb` | `[{campaign_id, brand, house, agency, occasion, first_seen_at, last_seen_at, item_summaries[]}]` |
| `ops.save_campaign_summary(p_campaign_id uuid, p_summary jsonb)` | Sets `summary_en`/`summary_ar`; skipped when `locked_by_human` and the summary was edited by a human (`ops.audit_log`) |
| `ops.create_review_task(p_kind app.review_kind, p_entity_type text, p_entity_id text, p_suggestion jsonb, p_reason text) → bigint` | Shared with M07; dedupes on (kind, entity, status open) |
| WF-32 tie-break output (strict JSON) | `{decision:"attach"\|"new", campaign_id:string\|null, new_campaign_title:string\|null, confidence:number, reason:string}` |
| `pgmq` | `embed` messages `{entity_type:'campaign', entity_id}` |
| WF-70 call | `{tags:["campaigns","feed","stats"]}` |
| Settings used | `campaign_window_days` (45), `campaign_similarity_min` (0.82), `daily_budget_usd` |

## 9. Acceptance criteria

- **AC1** pgTAP tests for all new RPCs pass (`supabase test db`), including idempotency (a second attach of the same item is a no-op) and grants (only `n8n_writer` can execute; `authenticated` gets a permission error).
- **AC2** Dev fixture: 10 items for one brand × house spread over 14 days across Vimeo, Instagram and the website → exactly **1** campaign with `platforms` containing all three and `item_count = 10`.
- **AC3** Dev fixture: the same brand × house 90+ days later → a **new** campaign. A different house in the same week → a different campaign.
- **AC4** A website page embedding a known Vimeo video is attached to that video's campaign via `link_by_media_urls`, with no OpenAI call for that item (check `ops.cost_ledger`).
- **AC5** Re-running WF-32 over the same window creates 0 new `campaign_items` and 0 new campaigns.
- **AC6** The pilot backlog is linked: 100% of eligible items are either in a campaign or have an open `campaign_merge` task. The counts are pasted.
- **AC7** The spot-check of 30 campaigns is recorded, with wrong merges ≤ 10% and wrong splits ≤ 15%. If not met, the tuning is logged and the re-check passes.
- **AC8** The prod readiness checklist (T8) is fully ticked with evidence.
- **AC9** MA-18 is approved by the owner in PROGRESS; pilot day 1 and day 14 dates are in the root `PROGRESS.md`.
- **AC10** Three consecutive clean daily runs in prod, as defined in T10, with the daily check rows pasted.
- **AC11** The root board shows M08 Done, M09–M11 Parallel-OK, and the M12 wait condition. `docs/runbooks/PILOT.md` exists.
- **AC12** All new and changed workflows are exported to `n8n/workflows/` with no credentials (grep for `password|apiKey|token` returns nothing).

## 10. Tests to write

- `supabase/tests/campaign_linker.test.sql`:
  - candidates (window, house, brand);
  - attach idempotency;
  - aggregates;
  - `locked_by_human` behaviour;
  - merged redirect;
  - grants.
- `packages/shared/src/linker/decide.ts` + `decide.test.ts`: the pure decision function (same as the n8n Code node logic; keep them identical and paste the function into the Code node) with the threshold edge cases 0.749 / 0.75 / 0.819 / 0.82 and the two-candidate gap of 0.029 / 0.03.
- `scripts/assert/linker_fixtures.sql`: inserts the fixtures into dev, runs the assertions, and cleans up.
- `scripts/assert/pilot_daily_check.sql`: the daily health query (read-only).

## 11. Manual actions from the owner

| ID | Action | When |
|---|---|---|
| MA-11 (prod part) | Make sure the prod credentials exist in n8n (Postgres prod `n8n_writer`, Apify, OpenAI, Vimeo, YouTube, Firecrawl, Notify email) | Before T8 |
| MA-13 | Confirm the daily budget for prod (default per OPEN_QUESTIONS Q-07: USD 150/day during backfill, 25/day steady) | Before T8 |
| MA-04 | Provide the prod-scoped Supabase token, or run `supabase db push` against prod yourself (Codex gives the exact commands) | T6 / T8 |
| MA-18 | **Approve the pilot start:** read the readiness checklist, then reply "approved, start on <date>" in this milestone's PROGRESS. This approves switching the prod schedules on (no backfill — it already ran in M04–M07). | T8 → T9 |

## 12. Risks & gotchas

- **R1 Missing brand on many items.** Items without `brand_id` are never linked. If more than 30% of commercial items lack a brand, that's an M07 extraction issue: log it for M12, and don't force links.
- **R2 Over-merging an always-on brand.** A brand like a telecom posts continuously with one house, so a 45-day rolling window could chain months together. Guard: never attach when the candidate campaign already spans more than 120 days (`last_seen_at - first_seen_at`). Create a new campaign instead, and record this guard in AI_PIPELINE §9 as a deviation.
- **R3 Embedding gaps.** If the campaign or item embedding is missing, similarity is null. Fall back to `title_sim` only, and send the item to tie-break, never straight to attach.
- **R4 Prod web app not yet deployed.** WF-31 media upload and WF-70 revalidate need the web app's internal routes. If prod Vercel isn't live yet:
  - deploy the minimal `apps/web` API routes to Vercel production (the route handlers exist from M06; UI pages can be placeholders);
  - or point WF-31 [prod] at the preview URL temporarily and log it.
  - Do not use the secret key anywhere else.
- **R5 Schedules overlap.** Keep the staggered times. The due-list claim (`SKIP LOCKED`) prevents double processing, but overlaps waste executions.
- **R6 Prod vs dev confusion.** Every prod workflow must use the `– prod` credential. Check this by listing each workflow's credentials via MCP before activation.
- **R7 Pilot clock.** Don't change thresholds, prompts or actors in prod during the 14 days unless something is broken. Log any hotfix with its date, so M12 can interpret the data.

## 13. Cost & budget notes

- **Linker:** tie-breaks ≈ 10–15% of new commercial items × about 1–2K tokens; summaries ≈ one call per touched campaign per day. Expect cents per day for the pilot.
- **No backfill cost here:** the pilot backfill and AI backlog were paid once in M04–M07. Only gap re-runs (if any) need a small estimate.
- **Daily steady state:** the estimate from `docs/SCRAPING_SOURCES.md` for about 195 accounts, plus AI per new item. The budget alert is the safety net.

## 14. Definition of done & hand-off

**Done when:**
- AC1–AC12 pass with evidence in PROGRESS;
- the PR `m08-campaign-linker-pilot` is merged;
- the workflows are exported;
- the board is updated.

**Hand-off to M09** (fill in PROGRESS):
- the pilot dates;
- how to run the daily check;
- where the pilot data lives (prod);
- which Supabase project the web app preview uses (**dev**, with a copy of a pilot slice: run `scripts/copy-pilot-slice.ts` if needed, or point previews at prod read-only only with the owner's OK);
- known data gaps (stories coverage, missing brands).
