# M04 — Collectors I: Vimeo + Instagram (posts & reels)

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first, then the root `PROGRESS.md`.

> **Owner kickoff26October2026:** M04 is authorized after merged M03. Use focused local/integration tests and representative native/database evidence; no general-purpose acceptance framework. Before any paid fixture or live collector batch, present one complete new M04 estimate including accounts, provider use, retries and shutdown. Production pilot, recurring schedules, notifications and merge remain separate decisions. The first official-API implementation and current source corrections are in PROGRESS.md and SCRAPING_SOURCES.md; historical examples below are not proof of current API/actor contracts.

> **HC-01 approved27October2026:** the owner approved fixed-selector recent Instagram monitoring for the five identified watermarked dev accounts while history remains incomplete, and deferred only Instagram January2024 completeness in dev AC2 to HC-01-F1. This narrow exception supersedes the original daily-history gate below only for the exact five identities and fixed selector recorded in [DECISIONS.md](../../docs/DECISIONS.md#m04-collector-integration--27-october-2026). The general scheduled selector, Vimeo AC2, production AC6 and all other criteria/gates are unchanged. Local implementation/qualification does not prove hosted application, daily collection or complete history; no new live collection is approved.

## 1. Goal and outcome

Build the first two production collectors on top of the M03 foundation, then backfill the pilot from **1 Jan 2024**:

- **WF-10 · Vimeo collector**: the official Vimeo API is the primary source, with Apify fallbacks.
- **WF-11 · Instagram posts/reels collector**: uses `apify/instagram-scraper`.

When M04 is done:

- every active pilot Vimeo and Instagram account has its history from 2024-01-01 in `app.items`;
- a daily run inserts only genuinely new items, and a re-run on the same day inserts **zero**;
- watermarks advance;
- metrics on items from the last 30 days refresh as a side effect;
- every run and every dollar is logged.

No AI yet: items wait in the `ai_extract` queue for M07.

## 2. Context you need (read before T1)

> **Current integration27October:** the owner's multi-batch/joint-ownership
> instruction and DECISIONS.md's M04 entry supersede the draft independent
> secondary-pass and one-run-per-parent examples below. WF-11 claims the exact
> selected set once for posts+reels; the new fixed product RPC tracks every
> registration/page/pass and reports only after registration closes and all
> passes settle. The eight-argument report RPC is preserved; there is no new
> independently unlocked `p_secondary` path. Both M04 migrations were applied to
> emr-dev on27October (17 total, original15 fingerprints preserved); production remains untouched. Do not implement the obsolete draft T3 selector/signature change.
> Representative dev setup snapshots/restores only the four explicitly selected
> accounts in the single live packet; broad pause-all-account mutation in the
> draft T2 is not authorized by that packet. The full five-account/backfill and
> production criteria remain open.

- **Priorities.** Vimeo and Instagram are the top two sources (with websites). Most competitor commercials are posted on Vimeo, often with full credits in the description. Instagram carries the social cut-downs, reels and client tags.
- **Single writer path.** Collectors never write tables. They normalize every source object to the **normalized item contract** (`reference/n8n/normalized_item.schema.json`, `docs/DATA_SCHEMA.md` §7) and call `ingest.upsert_raw_items(run_id, account_id, items jsonb)` through `SUB · Ingest items`. That RPC does all of this:
  - inserts new rows only (`ON CONFLICT (platform, external_id) DO NOTHING`);
  - links re-posts with the same `content_hash` as duplicates;
  - creates `app.items` shells;
  - queues new IDs to `ai_extract` and `media`;
  - updates metrics of already-known items in the batch;
  - advances the account watermark.
- **Due list and claiming.**
  - `ops.get_due_accounts(platform, limit, run_id, mode)` claims accounts with `FOR UPDATE SKIP LOCKED` and returns:
    - `account_id`, `competitor_id`, `competitor_slug`, `handle`, `url`, `external_id`, `uploads_playlist_id`;
    - `watermark_published_at`, `watermark_external_id`;
    - `backfill_from` (2024-01-01), `backfill_cursor`.
  - Mode `backfill` picks accounts with `backfill_status in ('pending','running')`.
  - Mode `daily` picks only accounts with `backfill_status in ('done','not_applicable')` and `next_due_at <= now()`.
  - The general daily rotation therefore requires completed backfill. HC-01 permits a narrow fixed-selector-only dev exception for the five approved, watermarked Instagram identities; it does not enable recurring rotation or assert completed history. Joint claims/barriers, watermarks, replay safety and incomplete history/cursors must be preserved.
- **Per-account result.** `ops.report_account_result(run_id, account_id, status, items_seen, items_new, error, backfill_done, backfill_cursor)` unlocks the account and schedules `next_due_at`. It counts failures and sets the account to `failing` after 3 consecutive failures.
- **Apify pattern (M03).** Every Apify actor runs **asynchronously** with an ad-hoc webhook to **WF-19 · Apify run callback** (`docs/N8N_WORKFLOWS.md` §4, §6 WF-19):
  - The collector starts the run and calls `ops.register_apify_run(...)`.
  - WF-19 verifies the run against the Apify API and `ops.apify_runs`, pages the dataset, normalizes, ingests, logs cost (`usageTotalUsd`), and finishes the scrape run when `ops.apify_runs_pending(run_id) = 0`.
  - M04 adds the **`vimeo` (goat255 / dltik)** and **`instagram` (posts/reels)** branches to WF-19's Switch.
- **Official APIs run inline** (no Apify, no WF-19). WF-10 calls the Vimeo API directly with the n8n HTTP Request node (pagination), then `SUB · Ingest items` → `SUB · Log cost` → `SUB · Finish run`.
- **Where data goes.** This exception to the plan is a pre-set default; confirm it with the owner in MA-14.
  - Develop and test in **dev** with the 5 test accounts per platform (`data/test_accounts.csv`).
  - Run the paid **pilot backfill once, into prod**: create prod copies of the needed workflows (SUBs, WF-19, WF-90, WF-10, WF-11) with prod credentials.
  - Keep every prod **daily schedule OFF** until M08 (WF-00 prod copy is not activated).
  - This avoids paying for the backfill twice (dev and again in M08), and gives M07 real pilot data for the eval.
  - Prod migrations needed by this milestone's new RPCs are applied with the owner's approval in the same MA-14 reply.
  - If the owner prefers the dev-only route, backfill into dev and note that M08 repeats the prod backfill at the same cost.
- **Public data only (D-24).** Never pass cookies, sessions or passwords to any actor. A private or login-walled Instagram profile → account `invalid`; never "fixed" with a login.
- **Pilot gating.** Only baseline + pilot (top 50) accounts are `active` in prod; the rest are `paused` (done in M02). In dev, activate only the test accounts (T2).

## 3. Prerequisites

| Item | Needed for | Check |
|---|---|---|
| M03 Done | SUB workflows, WF-00 (dev), WF-19 generic path, WF-90, WF-91, `ops.register_apify_run`, `ops.complete_apify_run`, `ops.get_apify_run`, `ops.apify_runs_pending`, `ops.log_cost`, `ops.get_setting`, `ops.get_price_book` | root `PROGRESS.md` board |
| M02 Done | Accounts seeded; Vimeo `external_id` resolved where possible (`resolve_status`) | `select platform, resolve_status, count(*) from app.competitor_accounts where platform='vimeo' group by 1,2;` |
| MA-07 Vimeo token (scope `public`) | WF-10 | n8n credential `Vimeo token` exists; `GET https://api.vimeo.com/me` → 200 |
| MA-10 Apify plan + token | WF-11, fallbacks | n8n credential `Apify API`; `GET https://api.apify.com/v2/users/me` → 200; plan tier noted in `ops.price_book` |
| MA-11 n8n credentials (`Supabase Postgres · n8n_writer · prod`) | Prod copies for backfill | prod credential test connection OK |
| MA-14 Approve backfill estimate + prod target | T9 | Owner writes "approved" in this PROGRESS |

## 4. Scope

**In scope**
- WF-10 Vimeo:
  - API primary;
  - goat255 daily fallback;
  - dltik only for showcase/channel/group URLs;
  - external-ID resolution;
  - rate-limit handling;
  - backfill cursor.
- WF-11 Instagram:
  - `resultsType: posts` run and `resultsType: reels` run (secondary pass);
  - daily and backfill;
  - batching;
  - WF-19 branch.
- Normalizers (`vimeoApi`, `goat255`, `dltik`, `instagramScraper`): fixtures and contract tests.
- New RPCs:
  - `ops.set_account_external_id(account_id, external_id, uploads_playlist_id)`;
  - `ops.get_accounts_for_secondary_pass(platform, run_id)`.
- Prod copies of the M03 + M04 workflows (schedules off) for the pilot backfill.
- Reels-vs-posts overlap measurement (Q-09), first 7 days of data.
- Backfill cost estimate and the actual cost report.

**Out of scope**
- Stories (M06), websites/YouTube/LinkedIn (M05) and AI (M07).
- Thumbnails to Storage (M06/M07). `thumbnail_source_url` is stored now.
- Turning on prod daily schedules (M08).
- Any other social platform (D-07).
- Video downloads (D-19): never use dltik's `download_*` fields.

## 5. References

- `docs/SCRAPING_SOURCES.md` §0 (common rules), §1 Vimeo, §2 Instagram, §8 costs, §9 health checks
- `docs/N8N_WORKFLOWS.md` §1 conventions, §2 schedule (Vimeo 02:00, IG posts 02:30, IG reels 03:00, backfill wave hourly 10:00–23:00), §4 Apify async pattern, §5 SUBs, §6 WF-10 / WF-11 / WF-19, §7.1–7.3 normalizer snippets, §8 RPCs
- `reference/apify_actor_research_2026-10-17.md` §1 goat255, §2 dltik, §3 instagram-scraper, Vimeo API section
- `docs/DATA_SCHEMA.md` §5 (RPC catalog), §7 (normalized contract); `reference/sql/004_rpc_pipeline.sql`
- `docs/TESTING.md` (fixtures, idempotency rule); `data/test_accounts.csv`

## 6. Deliverables

| Path | What |
|---|---|
| `supabase/migrations/<ts>_m04_collectors_vimeo_ig.sql` | `ops.set_account_external_id`, `ops.get_accounts_for_secondary_pass`; grants to `n8n_writer` |
| `supabase/tests/m04_*.sql` | pgTAP: new RPCs; idempotency of `upsert_raw_items` with IG/Vimeo fixtures; watermark advance; reels pass doesn't change `next_due_at` |
| `n8n/normalizers/_common.js`, `vimeoApi.js`, `goat255.js`, `dltik.js`, `instagramScraper.js` | Canonical normalizer code (pure functions; the same code is pasted into the n8n Code nodes) |
| `n8n/normalizers/fixtures/vimeo-api/*.json`, `fixtures/goat255/*.json`, `fixtures/dltik/*.json` (if a showcase account exists), `fixtures/instagram-scraper/{posts,reels}/*.json` | Real outputs captured in dev (trimmed) |
| `n8n/normalizers/normalizers.test.ts` (Vitest, run by root `pnpm test`) | Contract tests: each fixture → valid normalized items (ajv against `normalized_item.schema.json`), item_type rules, dates, metrics |
| `n8n/workflows/WF-10-vimeo.json`, `WF-11-instagram.json`, updated `WF-19-apify-callback.json`, updated `WF-00-orchestrator.json` | Exports (dev); prod copies identical except the `Config` node and credentials |
| `scripts/estimate-backfill.ts` | Samples 5 accounts per platform → items/month → extrapolates to 2024-01-01..today for all active pilot accounts → items + USD (uses `ops.price_book`) |
| `scripts/assert/m04.sql` | The SQL checks in §9 (copy-paste ready) |
| `milestones/M04-…/PROGRESS.md` | Evidence, cost report, overlap numbers |

## 7. Tasks

### T1: Capture real fixtures (dev, 2 accounts each)
1. Vimeo API:
   ```
   GET https://api.vimeo.com/users/{id}/videos?sort=date&direction=desc&per_page=5
       &fields=uri,name,description,link,created_time,release_time,duration,pictures.sizes,tags.name,stats.plays,metadata.connections.likes.total,metadata.connections.comments.total,privacy.view,user.name,user.link
   ```
   Use `everyonefilms` and `goodpeoplefilms`. Send `Accept: application/vnd.vimeo.*+json;version=3.4`.
2. In the Apify console (dev token), run `goat255/vimeo-scraper` with this input:
   ```json
   {"videoUrls": [], "users": ["https://vimeo.com/everyonefilms"], "maxVideosPerUser": 5, "includeProfile": false}
   ```
3. Run `apify/instagram-scraper` twice on `https://www.instagram.com/everyone.film/` and `https://www.instagram.com/goodpeoplefilms/`, once with `resultsType: "posts"` and once with `resultsType: "reels"`, both with `resultsLimit: 10`.
4. Trim (≤ 10 items per file), save under `n8n/normalizers/fixtures/<actor>/`, and commit.
5. Note every field that differs from `docs/SCRAPING_SOURCES.md` in "Decisions & deviations" and fix the doc.

*Done when* the fixtures are committed and the deviations are logged.

### T2: Dev account set
1. In **dev** SQL:
   - set every account `status='paused'`;
   - then set the 5 `vimeo` and 5 `instagram` accounts from `data/test_accounts.csv` to `active` with `backfill_status='pending'` (match on `lower(handle)`).
2. Confirm `external_id` for the 5 Vimeo test accounts. If any is missing, resolve it in T4.

*Done when* `select platform, status, count(*) …` shows 5 active per platform in dev.

### T3: Migration with the new RPCs
1. Run `supabase migration new m04_collectors_vimeo_ig`.
2. `ops.set_account_external_id(p_account_id uuid, p_external_id text, p_uploads_playlist_id text default null) returns void`: sets `external_id`, `uploads_playlist_id` and `resolve_status='resolved'`, plus `resolve_status='failed'` and `last_error` when `p_external_id` is null. Write it as SECURITY DEFINER, `search_path=''`, and grant EXECUTE to `n8n_writer` only.
3. `ops.get_accounts_for_secondary_pass(p_platform app.platform, p_run_id uuid) returns table (account_id, competitor_id, competitor_slug, handle, url, watermark_published_at)`: returns active accounts of that platform whose `last_success_at::date = current_date` (in the Africa/Cairo day) and whose `backfill_status = 'done'`.
   - It does **not** lock the accounts or change `next_due_at`.
   - It inserts `ops.scrape_run_accounts` rows only via `report_account_result` called by WF-19 with a flag. Add a parameter `p_secondary boolean default false` to `ops.report_account_result`: when true, it records the run row and failures but **does not change** `next_due_at`, `locked_until` or the watermark columns. Update the function and its test.
4. pgTAP tests (`supabase/tests/m04_rpcs.sql`):
   - `n8n_writer` can execute both new RPCs; `authenticated` cannot.
   - The secondary pass returns only today's successful accounts.
   - With `p_secondary=true`, `next_due_at` is unchanged.
5. Run `supabase db advisors`, fix the findings, apply to dev with `supabase db push`, and regenerate the types.

*Done when* `supabase test db` is green.

### T4: Normalizers + contract tests
1. Write `n8n/normalizers/_common.js` with the helpers from `docs/N8N_WORKFLOWS.md` §7 (`lc`, `noAt`, `iso`, `tags`, `ats`, `int`, `trim8k`).
2. Write `vimeoApi.js`, `goat255.js`, `dltik.js` and `instagramScraper.js` as pure functions `(rawItems, ctx) → normalized[]`, ported from §7.1–7.3. dltik maps:
   - `id` → `external_id`;
   - `upload_date` `YYYYMMDD` → ISO date at 00:00Z;
   - `view_count` / `like_count` → metrics;
   - **never copies the `download_*` fields** into the normalized item (the full object stays in `payload` but is stripped of `download_url`, `download_hd`, `download_4k` and `download_formats` before ingest).
3. Rules to implement and test:
   - **Instagram item_type:**
     - `Sidecar` → `carousel`;
     - `Video` + (`productType === 'clips'` or the reels run) → `reel`;
     - other `Video` → `video`;
     - `Image` → `post`.
   - Instagram `likesCount === -1` → `likes: null`. Views = `videoViewCount ?? videoPlayCount ?? igPlayCount`. Shares = `reshareCount ?? sharesCount`.
   - Rows with `error` are never ingested, but they are returned as `{error, matchKey}` so the branch can mark that account failed.
   - Vimeo: `published_at = release_time ?? created_time`; keep only `privacy.view === 'anybody'`; thumbnail = the largest size with width ≤ 1280; `credits_text = description`.
   - goat255 `uploadDate` `"YYYY-MM-DD HH:mm:ss"` is treated as UTC. Drop `type === 'profile'` rows. Match accounts by the last path segment of `ownerUrl`.
   - Handles are lowercase without `@`; hashtags are lowercase.
4. Vitest (`n8n/normalizers/normalizers.test.ts`): every fixture item validates against `reference/n8n/normalized_item.schema.json` (ajv, with `payload` allowed), plus one test per rule above.

*Done when* `pnpm test` is green in CI.

### T5: WF-10 · Vimeo collector (dev)
Build it exactly as in `docs/N8N_WORKFLOWS.md` §6 WF-10:

1. **Trigger:** Execute Workflow Trigger `{mode, limit}` plus a Manual Trigger with defaults `{mode:'backfill', limit:10}`.
2. **Start the run:** `SUB · Start run` (`WF-10`, `vimeo`, mode), then `ops.get_due_accounts('vimeo', $1, $2::uuid, $3)`.
3. **Per account (Loop Over Items, batch 1):**
   - **External ID.** If `external_id` is empty, call `GET https://api.vimeo.com/users/{handle}?fields=uri,name,link` → the ID is the last segment of `uri` → `ops.set_account_external_id`.
     - URLs with `/channels/{x}` or `/groups/{x}` use those collections. Showcase listing needs a verified owner-scoped `/users/{owner}/albums/{x}` path; do not guess a global `/albums/{x}`. Record `backfill_cursor.endpoint`. If the API refuses → dltik list.
   - **Cutoff:** daily → `watermark_published_at − 1 day` (or `backfill_from` if null); backfill → `backfill_from` (`2024-01-01`), resuming from `backfill_cursor.page` if set.
   - **List videos:**
     - HTTP Request `GET https://api.vimeo.com/users/{external_id}/videos?sort=date&direction=desc&per_page=100&page={n}&fields=<as T1>`.
     - Use n8n pagination "Response contains next URL" → `'https://api.vimeo.com' + $response.body.paging.next`.
     - Complete when the last item's date < cutoff or there is no `paging.next`.
     - Max pages: daily 3, backfill 50.
   - **Rate limit:**
     - Read `x-ratelimit-remaining` and `x-ratelimit-reset`. If remaining < 10 → Wait until the reset time (max 10 min, else stop the account with `status='failed'`, `error='vimeo_rate_limited'`).
     - HTTP 429 → Wait 60 s, retry up to 3 times.
   - **Normalize:** Code "Normalize Vimeo API" (from `n8n/normalizers/vimeoApi.js`). It includes known IDs through the 30-day metrics horizon (AC5); stop after the older applicable horizon, exhaustion or the explicit page cap. A bounded incomplete cursor is not a finished backfill.
   - **Errors:** HTTP 401/403/404 → group `status='failed'`, `error='vimeo_api_<code>'`; add the account to the fallback list.
   - **Backfill state:** `backfill_done = true` when verified descending traversal is strictly earlier than the cutoff or `paging.next` is null. Otherwise save `backfill_cursor = {endpoint, resourcePath, page: next_page, page_size}` so a timeout or next wave resumes with the same verified path/width.
4. **Fallback (daily mode only):** if the fallback list is not empty, start `goat255~vimeo-scraper` async (≤ 50 users per run) with this input:
   ```json
   {"videoUrls": [], "users": ["https://vimeo.com/<handle>", "…"], "maxVideosPerUser": 20, "includeProfile": false, "concurrency": 5}
   ```
   Register it with `emr = {run_id, platform:'vimeo', actor:'goat255/vimeo-scraper', purpose:'daily', account_ids}`.
   - goat255 cannot backfill (latest 60 only). In backfill mode, a failing account goes `failed` with `error='vimeo_api_<code>_no_backfill_fallback'` and is listed for the owner.
5. **dltik:** for accounts whose URL is a showcase/channel/group that the API cannot list, start `dltik~vimeo-scraper` with `{"urls": ["<url>"], "maxResults": 50}` (daily) or `maxResults: 1000` (backfill), purpose as the mode.
6. **Finish:** `SUB · Ingest items` (all API groups) → `SUB · Log cost` (provider `vimeo`, `cost_usd 0`, quantity = number of API calls, unit `call`) → `SUB · Finish run`, with `partial` if any account failed; skip Finish when Apify fallback runs are pending (WF-19 finishes it).
7. **WF-19 branch `vimeo`:** normalizer goat255 or dltik selected by `emr.actor` → ingest → cost (`usageTotalUsd`).
8. **Settings:** timezone Africa/Cairo, error workflow WF-90, workflow timeout 15 min.

*Done when* the backfill on 5 dev test accounts completes and a second run (daily mode) inserts 0 (see AC2, AC3).

### T6: WF-11 · Instagram posts/reels collector (dev)
1. **Trigger:** Execute Workflow Trigger `{mode, limit, result_type: 'posts'|'reels'}`; Manual Trigger defaults `{mode:'backfill', limit:10, result_type:'posts'}`.
2. **Start the run:** `SUB · Start run` (`WF-11`, `instagram`, mode).
3. **Accounts:**
   - `result_type = 'posts'` → `ops.get_due_accounts('instagram', limit, run_id, mode)`.
   - `result_type = 'reels'`:
     - daily → `ops.get_accounts_for_secondary_pass('instagram', run_id)`;
     - backfill → the same accounts the posts backfill claimed (run the reels backfill right after posts, in the same execution, for the same claimed accounts, as a second actor run).
4. **Batch (Code):**
   - Sort by watermark.
   - Chunk: daily ≤ 50 profiles, backfill ≤ 10.
   - Per chunk: `onlyPostsNewerThan` = (oldest watermark in chunk − 1 day) as `YYYY-MM-DD` (daily) or `"2024-01-01"` (backfill).
   - `resultsLimit`: 30 daily, 1500 backfill.
   - Group accounts with similar watermarks.
5. **Start one async run per chunk:** `apify~instagram-scraper`.
   - Daily input:
     ```json
     {"directUrls": ["https://www.instagram.com/<handle>/", "…"], "resultsType": "posts", "resultsLimit": 30,
      "onlyPostsNewerThan": "2026-10-15", "skipPinnedPosts": true, "addParentData": false}
     ```
   - Backfill input:
     ```json
     {"directUrls": ["https://www.instagram.com/<handle>/"], "resultsType": "posts", "resultsLimit": 1500,
      "onlyPostsNewerThan": "2024-01-01", "skipPinnedPosts": true}
     ```
   - The same input with `"resultsType": "reels"` for the reels pass.
   - Register with `emr = {run_id, platform:'instagram', result_type, purpose: mode, account_ids}`.
   - Do not call Finish run here; WF-19 does it.
6. **WF-19 branch `instagram`:**
   - Normalize (`instagramScraper.js`, with `result_type` from `emr`).
   - Group by `matchKey` = `lower(ownerUsername)` against the run's accounts. Drop unmatched rows and log the count.
   - Error rows:
     - a private profile or `errorDescription` containing private, login, challenge or checkpoint → the account fails with `error='ig_private_or_login'`;
     - after 3 such runs the account goes `invalid` (handled by the consecutive-failures logic plus a check in the branch: on the 3rd, call `ops.set_account_status` if it exists, else log for the owner).
   - **`backfill_done` implementation correction (27 October):** the draft short-output/oldest-row heuristic is insufficient source-coverage evidence. Final callback settlement keeps history incomplete until each posts/reels pass has attributable cutoff or public-source-exhaustion proof. Dataset EOF, one out-of-order old row and a higher result limit are not that proof. See [history review](evidence/history-capability-decision-20261027.md). This corrects an unsafe implementation prescription; the full-history target remains. The subsequent HC-01 approval defers only Instagram January2024 completeness in dev AC2 to HC-01-F1, not passed; it does not authorize a false `backfill_done` result.
     - Keep per-pass `oldest_seen`, raw cap/escalation evidence and `backfill_done=false`; existing 3000-result saturation is a local stop, not a provider-wide prohibition.
     - Repeating the same lower-date latest query can add new IDs idempotently but does not prove history or authorize another wave. No repeated capture is ordered by this note.
   - Reels pass → `report_account_result(..., p_secondary := true)`.
7. Settings as in T5.

*Done when* AC4 and AC5 pass on the dev test accounts.

### T7: WF-00 wiring (dev)
- Add the slots `vimeo` 02:00, `ig_posts` 02:30, `ig_reels` 03:00 and the `backfill_wave` (hourly 10:00–23:00, `{mode:'backfill', limit:10}` per platform per slot, ≈ 140 accounts/day per platform, for WF-10 and WF-11 posts + reels) per `docs/N8N_WORKFLOWS.md` §2.
- Keep the dev WF-00 **inactive** except during tests. Use the slot-override input to test.

*Done when* each slot dispatches the right workflow.

### T8: Backfill estimate (MA-14)
1. `scripts/estimate-backfill.ts`:
   - For 5 sample pilot accounts per platform, count the items in the last 90 days, using:
     - the Vimeo API (`per_page=100`, count by `release_time`);
     - for Instagram, a small posts run (`resultsLimit: 100`, `onlyPostsNewerThan` = today − 90 d) in dev, already captured in T5/T6.
   - Compute items/month and extrapolate to (today − 2024-01-01) × active pilot accounts (Vimeo ≈ 48, Instagram ≈ 49 incl. the baseline).
   - Multiply Instagram results by 2 for the reels pass (the overlap is still unknown) and by the `ops.price_book` prices.
2. Post the table to PROGRESS, with these columns:
   - platform;
   - accounts;
   - est. items;
   - est. Apify results;
   - est. USD;
   - wall-clock hours at 10 accounts/platform/hour (14 hourly slots → ≈ 140 accounts/day per platform).
3. Add MA-14 with the prod-target choice (§2).

*Done when* the owner approves it in PROGRESS.

### T9: Prod copies + pilot backfill (after MA-14)
1. Apply the M04 migration to **prod** (owner-approved): `supabase db push --linked` with the prod ref.
2. Create prod copies, with the prod `Config` node and prod credentials:
   - `SUB · *`, `WF-90`, `WF-19`, `WF-10`, `WF-11`;
   - `WF-00 [prod]`, with **only** the `backfill_wave` rule enabled (Vimeo + IG). Disable all daily slots.
3. Set `ops.settings.daily_budget_usd` to the backfill-day budget agreed in MA-14 (default 150, per `docs/SCRAPING_SOURCES.md` §8).
4. Let the waves run. Monitor `ops.scrape_runs`, `ops.apify_runs` and WF-90 emails.
5. After the backfill completes, disable the `backfill_wave` rule in prod (it re-enables in M05 for the other platforms).

*Done when* AC6 and AC7 pass in prod.

### T10: Daily mode check + overlap measurement (dev, 7 days)
1. Activate the dev WF-00 daily slots for Vimeo and IG on the test accounts for 7 days. Prod daily stays off until M08.
2. Measure the reels-vs-posts overlap: % of reels-pass `external_id`s already inserted by that day's posts run. In SQL:
   - count `ops.scrape_run_accounts` new items per pass, or
   - query `ingest.raw_items` by `run_id` and `normalized->>'item_type'`.
3. Log daily numbers in PROGRESS. Q-09 is decided in M12, but record the M04 numbers.

*Done when* there are 7 daily rows of numbers. M04 can be marked Done after 3 days if everything else passes; the remaining days continue during M05. Note this in the hand-off.

### T11: Export, docs, hand-off
- Export the workflow JSON (dev).
- Update `docs/SCRAPING_SOURCES.md` with the real field deviations, and `docs/DATA_SCHEMA.md` §5 with the new RPCs.
- Fill in the PROGRESS evidence and hand-off; update the root board; open PR `m04-collectors-vimeo-instagram`.

## 8. Interfaces & contracts

| Interface | Contract |
|---|---|
| `ops.get_due_accounts('vimeo'\|'instagram', limit, run_id, 'daily'\|'backfill')` | Claims rows; 2 h lock |
| `ingest.upsert_raw_items(run_id, account_id, items jsonb)` | ≤ 500 items per call; returns `{inserted, duplicates, metrics_updated, new_item_ids}` |
| `ops.report_account_result(run_id, account_id, status, seen, new, error, backfill_done, backfill_cursor, p_secondary default false)` | New `p_secondary` parameter in this milestone |
| `ops.set_account_external_id(account_id, external_id, uploads_playlist_id)` | New |
| `ops.get_accounts_for_secondary_pass(platform, run_id)` | New |
| Apify run start | `POST https://api.apify.com/v2/acts/{owner}~{name}/runs?memory=1024&timeout=3600&webhooks=<base64>` |
| WF-19 `emr` payload | `{run_id, platform, actor?, result_type?, purpose, env, account_ids[]}` |
| Normalized item | `reference/n8n/normalized_item.schema.json`, `external_id`: Vimeo numeric id string, Instagram `shortCode` |

## 9. Acceptance criteria

Run the SQL in `scripts/assert/m04.sql` and paste the results in PROGRESS.

- **AC1: Contract.** `pnpm test` is green. Every fixture normalizes to schema-valid items, and every item_type rule is covered.
- **AC2: Dev backfill.** Original criterion: all 5 dev test accounts per platform have `backfill_status='done'`. **HC-01 approved27October2026 defers only the Instagram January2024-completeness component to HC-01-F1, not passed.** Keep those histories truthfully incomplete; recent monitoring is not a substitute completion signal. The five-account Vimeo requirement and the original history target remain unchanged. Production AC6 is not deferred. The following aggregate query remains an observation, not proof of per-account source traversal or completion:
  ```sql
  select a.platform, min(i.published_at)::date as oldest, count(*) as items
  from app.items i join app.competitor_accounts a on a.id = i.account_id
  where a.platform in ('vimeo','instagram') group by 1;
  ```
  `oldest` is ≥ 2024-01-01 and close to it for accounts that posted then; `items` > 0 for each platform.
- **AC3: Idempotency.** Run WF-10 and WF-11 (posts + reels) twice in a row in daily mode. The second run has `items_new = 0` in `ops.scrape_runs` for each.
  ```sql
  select count(*) from ingest.raw_items group by platform, external_id having count(*) > 1;
  ```
  → 0 rows. No AI messages are queued by the second run: `pgmq.metrics('ai_extract')` total messages are unchanged.
- **AC4: Item types.** In dev data there is ≥ 1 `carousel`, ≥ 1 `reel` and ≥ 1 `post` (or `video`) for Instagram. Pinned posts older than the watermark are not ingested on a daily run (check one known pinned post).
- **AC5: Watermarks and metrics.** After a daily run, `last_item_published_at` equals the max `published_at` for that account. Metrics: re-run on an item from the last 30 days → `metrics_updated_at` changes, `ai_status` unchanged.
- **AC6: Pilot backfill (prod).**
  ```sql
  select platform, status, backfill_status, count(*) from app.competitor_accounts
  where platform in ('vimeo','instagram') and status in ('active','failing','invalid') group by 1,2,3;
  ```
  → ≥ 98% of active pilot accounts `done`. The rest are listed in PROGRESS with reasons (private, no API access, invalid URL).
- **AC7: Cost logged.**
  ```sql
  select provider, sum(cost_usd) from ops.cost_ledger where day >= '<backfill start>' group by 1;
  ```
  Apify spend matches the sum of `ops.apify_runs.usage_usd` (± $0.01) and is within ±30% of the MA-14 estimate; explain any gap.
- **AC8: Failure path.** Simulate a 404 Vimeo account (dev). The account gets `failed`; after 3 runs it is `failing`; WF-90 and the WF-91 health email list it.
- **AC9: Security.** No cookies or credentials appear in any actor input (grep the workflow exports for `cookie` and `session` → none). Exports contain only credential references.

## 10. Tests to write

- Vitest: the normalizer contract tests (T4).
- pgTAP:
  - the new RPC grants and behaviour;
  - `p_secondary` leaves the schedule untouched;
  - `upsert_raw_items` twice → one row;
  - a duplicate `content_hash` within 30 days → `ai_status='duplicate'`, not queued.
- SQL assertions `scripts/assert/m04.sql` (AC2–AC7).
- Manual n8n tests: slot override for WF-00; a forged WF-19 POST with an unknown run id ingests nothing (re-check the M03 guard on the new branches).

## 11. Manual actions from the owner

| ID | What | When | How Codex verifies |
|---|---|---|---|
| MA-07 | Vimeo token (scope `public`) in n8n (credential `Vimeo token`) | Before T1 (should already exist from M02) | `GET /me` → 200 from n8n |
| MA-10 | Apify plan tier + token in n8n | Before T1 | `GET /v2/users/me` → 200; plan tier recorded; `ops.price_book` updated if not Starter |
| MA-11 | Prod Postgres credential `Supabase Postgres · n8n_writer · prod` in n8n | Before T9 | Test connection in the prod copy |
| MA-14 | Approve the backfill estimate (Vimeo + IG), the prod target (§2), the prod migration push, and the backfill-day budget | T8 → T9 | "approved" + date in PROGRESS |

## 12. Risks & gotchas

- **Vimeo API access.** The research flagged an unverified claim that the API is "gated". If `GET /users/{id}/videos` with a `public`-scope token fails, stop and report. goat255 cannot backfill: it returns the latest 60 videos only.
- **Vimeo `release_time` vs `created_time`.** Use `release_time` (the public date) and fall back to `created_time`.
- **Unlisted or private Vimeo videos** are skipped (`privacy.view !== 'anybody'`). Public data only.
- **Instagram reels pass** returns items that are already captured. That's expected: the DB drops them, and the cost is logged. That cost is what Q-09 measures.
- **`onlyPostsNewerThan` with batches** uses the oldest watermark in the chunk. Chunk by similar watermarks to limit wasted results.
- **Pinned posts** ignore date filters. Keep `skipPinnedPosts: true`.
- **Private profiles and login walls:** mark the account invalid. Never pass cookies (D-24).
- **`likesCount = -1`** means likes are hidden → null.
- **Account matching:** Instagram `ownerUsername` may differ in case from the handle; normalize both to lowercase. A renamed account shows a different owner. Log unmatched rows with a sample.
- **Apify run timeout:** 3600 s per run. For huge backfill accounts, lower the chunk to 1 profile.
- **Every new function** needs EXECUTE granted to `n8n_writer` and revoked from PUBLIC (re-run the grant lines).
- **`backfill_status` for stories rows** must be `not_applicable`; that is M06's concern, but check M02 set it, or daily runs will skip them.

## 13. Cost & budget notes

Prices: Apify Starter tier (research report). Replace them with the owner's tier from MA-10.

| Item | Pilot estimate |
|---|---|
| Vimeo API (≈ 48 accounts incl. baseline) | **$0** (API). goat255 fallback $0.55/1k videos ≈ $0.033 per user at 60 videos, only on failures |
| dltik (rare) | budget $2/1k videos |
| Instagram backfill, posts + reels (≈ 49 accounts × ~450 results incl. overlap) | ≈ 22k results × $2.30/1k ≈ **$50** |
| Instagram daily, posts + reels (≈ 100 results/day) | ≈ **$0.23/day** |
| Dev testing (5 accounts, a few runs) | < $3 |

**Estimate method** (`scripts/estimate-backfill.ts`): sample 5 accounts per platform → items in the last 90 days → items/month → × months since 2024-01-01 × active accounts → × price; Instagram × 2 for the reels pass. Post it in PROGRESS before T9 and compare with the actuals (AC7).

## 14. Definition of done & hand-off

- AC1–AC9 pass, with the evidence pasted in PROGRESS.
- Migrations are applied to dev, and to prod with MA-14 approval.
- Workflows are exported, prod copies exist with the daily slots **off**, and the backfill wave is disabled after completion.
- Docs are updated (SCRAPING_SOURCES deviations, DATA_SCHEMA §5 RPCs).
- PR merged.
- The hand-off lists:
  - pilot accounts still failing or invalid, with reasons;
  - the measured items per account per month (feeds M05/M07 estimates);
  - the reels overlap so far;
  - the real cost vs the estimate;
  - the number of items waiting in `ai_extract` (the M07 backlog).
- Next: **M05** (websites, YouTube, LinkedIn).
