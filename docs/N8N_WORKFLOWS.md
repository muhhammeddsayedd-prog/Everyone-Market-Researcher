# n8n workflows — everyone. Market Radar

Every workflow the pipeline needs, node by node. Platform inputs and field mappings: `docs/SCRAPING_SOURCES.md`. RPCs: `docs/DATA_SCHEMA.md` §5 and `reference/sql/004_rpc_pipeline.sql`. AI prompts and schemas: `docs/AI_PIPELINE.md`.

> **Verify on the owner's n8n Cloud plan before building (M03):** (1) the execution timeout per plan (assume 40 min max; our design keeps every execution < 10 min), (2) whether **sub-workflow executions count** against the monthly execution quota (our design calls sub-workflows once per run, not per account, so the budget holds either way), (3) whether **Variables** (`$vars`) are available on the plan, (4) that the verified community node `@apify/n8n-nodes-apify` is installable on Cloud (otherwise use HTTP Request to `https://api.apify.com/v2`), (5) the Postgres node's support for query parameters (`$1`, `$2` with "Query Parameters" option). Record results in `milestones/M03-n8n-foundation/PROGRESS.md`.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Name | `WF-XX · Name [dev]` / `WF-XX · Name [prod]`; sub-workflows `SUB · Name [env]` |
| Tags | `env:dev` or `env:prod`; `layer:collector` / `layer:ai` / `layer:ops` / `layer:sub`; `platform:<name>` |
| Timezone | Every workflow: Settings → Timezone = **Africa/Cairo** (cron times below are Cairo time) |
| Error workflow | Every workflow: Settings → Error workflow = `WF-90 · Error handler [env]` |
| Retries | HTTP / Apify / Postgres nodes: "Retry on fail" 3 tries, wait 5 000 ms (Apify/OpenAI 429: 30 000 ms) |
| Timeouts | HTTP nodes 60 s (OpenAI 120 s); workflow timeout 15 min (Settings → Timeout) |
| Batching | One execution handles a whole platform batch. Sub-workflows are called **once per run**, never per account or per item |
| Writes | Only via Postgres node calling RPCs as `n8n_writer`. Never table INSERT/UPDATE nodes |
| Secrets | Only in n8n credentials. Never in Set nodes, Code nodes or workflow JSON |
| Data size | Pass IDs between workflows, not full payloads (> 1 MB items slow n8n down) |
| Pinning | Use pinned data for development only; unpin before export |
| Export | After every change: Download → strip `credentials` ids/names if needed (n8n exports credential *references*, not secrets — keep references, they are safe) → save as `n8n/workflows/WF-XX-name.json` → commit `chore(n8n): export WF-XX` |
| Import order | SUBs first, then WF-90, then collectors, then WF-00 |

### 1.1 Environments
- **dev:** development and tests against Supabase **dev** with 3–5 test accounts. Workflows tagged `env:dev`, credentials `… · dev`.
- **prod:** the pilot runs in **prod** (real data from M08 on). Prod copies are created from dev exports in M08 and kept in sync after every change.
- **Config:** if Variables exist on the plan, set `EMR_ENV`, `EMR_APP_URL`, `EMR_N8N_WEBHOOK_BASE`. Otherwise every workflow starts with a **Set node "Config"** (`env`, `app_url`, `webhook_base`) — the only node that differs between dev and prod copies. Never point a dev workflow at prod credentials.

### 1.2 Credential bindings (reuse compatible existing credentials)

The names below describe logical bindings. Use actual credential IDs/types;
display names may differ. The M03 owner authorized reuse of `Apify account`
(`apifyApi`), `OpenAI account` (`openAiApi`), `Vimeo Token` and the existing
YouTube Header Auth credential. HTTP Request supports native credentials via
Predefined Credential Type. Preserve shared credential values/domain settings;
constrain the Market Radar request origins instead. Never duplicate a native
token as Header Auth or replace asynchronous Apify launches with synchronous
native-node operations. Actual IDs and test results are in M03 evidence.

| Credential name | Type | Used by |
|---|---|---|
| `Supabase Postgres · n8n_writer · dev` / `· prod` | Postgres: Supavisor **session** pooler host (IPv4), port 5432, database `postgres`, user `n8n_writer.<project-ref>`, SSL `require`, max connections 5 | all |
| `Apify API` | Native `apifyApi` through HTTP Request Predefined Credential Type, or a compatible existing Header Auth | collectors, WF-19 |
| `OpenAI API` | Native `openAiApi` through HTTP Request Predefined Credential Type, or a compatible existing Header Auth | WF-30, 32, 33, 50 |
| `Vimeo token` | Header Auth `Authorization: bearer …` | WF-10 |
| `YouTube Data API key` | Header Auth `X-Goog-Api-Key`; fixed `www.googleapis.com` requests, no redirects; preserve shared settings | WF-13 |
| `Firecrawl` | Header Auth `Authorization: Bearer …` | WF-21 |
| `SerpAPI` | Query Auth `api_key=…` | WF-22, 23 |
| `Email (Resend)` | Header Auth `Authorization: Bearer …` (or SMTP credential) | WF-80, 90, 91 |
| `EMR internal secret` | Header Auth `x-emr-secret: <INTERNAL_WEBHOOK_SECRET>` (outbound to the web app) | WF-31, WF-70 |
| `EMR webhook in · Apify` | Header Auth (Webhook node authentication) `x-emr-secret: <APIFY_WEBHOOK_SECRET>` | WF-19 |
| `EMR webhook in · App` | Header Auth `x-emr-secret: <N8N_WEBHOOK_SECRET>` | WF-60 |

### 1.3 Removed workflows
- **WF-20 Ad libraries — removed** (D-08, ads out of scope). Do not build.
- **WF-14 TikTok, WF-15 Facebook, WF-16 Behance, WF-17 X — removed** (D-07). Do not build.
- LinkedIn **jobs** — removed from WF-18 (D-08).

### 1.4 Valid workflow IDs, dev-only and optional workflows
Valid IDs: WF-00, WF-10, WF-11, WF-12, WF-13, WF-18, WF-18b, WF-19, WF-21, WF-22, WF-23, WF-30, WF-30b, WF-31, WF-32, WF-33, WF-40, WF-50, WF-60, WF-70, WF-80, WF-90, WF-91, WF-99, plus the `SUB · …` sub-workflows.
- **WF-99 · Foundation smoke test [dev]** — dev only, never copied to prod (M03). Manual Trigger; runs `apify/website-content-crawler` on one page of everyone.film through a dedicated test competitor `C999` (set up and archived by `scripts/assert/m03_smoke_*.sql`), so it exercises Start run → Apify async → WF-19 → Ingest → Log cost → Finish run without touching seeded accounts.
- **WF-30b · AI extractor, Batch API path [env]** — optional (M07, enabled only when `ops.settings.ai_batch_mode = true` after the owner approves it). Sends backfill items to the OpenAI Batch API (`ops.register_ai_batch`, `ops.ai_batches`), polls hourly, then applies results with the same `ops.apply_extraction` as WF-30.

---

## 2. Schedule (Africa/Cairo)

All schedules live in **one place**: WF-00's Schedule Trigger rules (exception: WF-30's 30-minute fallback trigger). Collectors only have an "Execute Workflow Trigger" (+ Manual Trigger for tests).

| Time (Cairo) | Days | Slot key | Calls | Mode |
|---|---|---|---|---|
| 01:00 | daily | `web_map` | WF-21 Websites | daily |
| 02:00 | daily | `vimeo` | WF-10 Vimeo | daily |
| 02:30 | daily | `ig_posts` | WF-11 Instagram (`resultsType: posts`) | daily |
| 03:00 | daily | `ig_reels` | WF-11 Instagram (`resultsType: reels`) | daily |
| 03:30 | daily | `youtube` | WF-13 YouTube | daily |
| 04:00 | daily | `li_posts` | WF-18 LinkedIn posts | daily |
| 04:00 | Sat | `removal` | WF-40 Removal check | weekly |
| 05:00 | Sun | `li_employees` | WF-18b LinkedIn employees | weekly |
| 06:00 | daily | `stories_am` | WF-12 Instagram stories | daily |
| 06:30 | daily | `linker` | WF-32 Campaign linker | daily |
| 07:00 | Sun | `news` | WF-22 News, then WF-23 Awards (07:30) | weekly |
| 08:00 | Mon | `briefs` | WF-50 Weekly briefs | weekly |
| 09:00 | daily | `digest` | WF-80 Alerts (digest) | daily |
| 09:15 | daily | `health` | WF-91 Health & cost | daily |
| 18:00 | daily | `stories_pm` | WF-12 stories — only if `ops.settings.stories_twice_daily = true` | daily |
| hourly 10:00–23:00 | during backfill | `backfill_wave` | WF-10/11/13/18/21 with `mode: backfill`, `limit: 10` accounts per platform per slot (≈ 140/day per platform) | backfill |

**Own-schedule exceptions** (the only workflows with their own Schedule Trigger besides WF-00; each exits immediately when its queue is empty):

| Trigger | Workflow | Why |
|---|---|---|
| every 30 min | WF-30 AI extractor (fallback) | Drains leftovers without executing WF-00 48 extra times |
| every 2 h | WF-31 Media (fallback; also called by `SUB · Finish run` and WF-30) | Thumbnails must be saved before CDN URLs expire (M06) |
| hourly | WF-33 Embeddings (fallback; also called by WF-30) | Drains the `embed` queue (M07) |
| Sun 06:00 | WF-33 weekly competitor refresh (`ops.enqueue_competitor_embeddings()`) | Competitor profile vectors (M07) |
| hourly, only while `ops.settings.ai_batch_mode = true` | WF-30b Batch API path (optional) | Polls OpenAI batch jobs (M07) |

WF-32 has **no** own trigger: WF-00 calls it in the `linker` slot.

The backfill wave rule is enabled **in prod in M04–M06** (pilot backfill, after MA-14/MA-15 approval) and again in M15 (scale-up waves). It is disabled when `ops.get_due_accounts(..., 'backfill')` returns nothing for 24 h.

## 3. Executions budget

| Workflow | Per day (pilot) | Per day (all 284) |
|---|---|---|
| WF-00 orchestrator (one execution per slot) | 12 | 12 |
| Collectors (WF-10/11×2/12/13/18/21 + weekly averaged) | 9 | 9 |
| WF-19 Apify callbacks (1 per Apify run) | ~7 | ~22 |
| SUB calls (start/finish/log cost/notify ≈ 3 per collector run) | ~27 | ~27 |
| WF-30 AI (7 collector-triggered + 48 fallback) | 55 | 55 |
| WF-31 media (2-hourly fallback + calls) + WF-33 embeddings (hourly fallback + calls + weekly) | ~36 | ~40 |
| WF-32 linker, WF-70 publish, WF-80, WF-91, WF-90 | ~14 | ~16 |
| **Total** | **≈ 160** | **≈ 181** |
| Monthly | **≈ 4,800** of 50,000 | **≈ 5,400** of 50,000 |
| Backfill weeks (hourly waves ×5 platforms + callbacks) | +≈ 150/day temporarily | +≈ 150/day temporarily |

If sub-workflow executions do **not** count on the plan, the totals drop by ~27/day.

## 4. Apify pattern (all actors run asynchronously)

Every Apify actor run is started asynchronously with an **ad-hoc webhook**; WF-19 processes the dataset. This avoids n8n execution timeouts and makes cost capture uniform.

**Start (in the collector):** HTTP Request
```
POST https://api.apify.com/v2/acts/{actorId with "/" replaced by "~"}/runs?memory=1024&timeout=3600&webhooks={base64(webhooksJson)}
Authorization: Bearer {{Apify token credential}}
Content-Type: application/json
Body: <actor input JSON from docs/SCRAPING_SOURCES.md>
```
`webhooksJson` (build in a Code node, then `Buffer.from(JSON.stringify(arr)).toString('base64')`):
```json
[{
  "eventTypes": ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
  "requestUrl": "{{webhook_base}}/webhook/emr-apify-callback",
  "headersTemplate": "{\"x-emr-secret\": \"<APIFY_WEBHOOK_SECRET — read from credential via expression in an HTTP header param, never hard-coded>\"}",
  "payloadTemplate": "{\"eventType\": {{eventType}}, \"resource\": {{resource}}, \"emr\": {\"run_id\": \"<run_id>\", \"platform\": \"instagram\", \"result_type\": \"posts\", \"purpose\": \"daily\", \"env\": \"prod\", \"account_ids\": [\"<uuid>\", \"…\"]}}"
}]
```
> The webhook secret cannot be read from an n8n credential inside a Code node. Options (pick in M03, document in PROGRESS): (a) store `APIFY_WEBHOOK_SECRET` as an n8n Variable (if available) and reference `$vars`; (b) instead of a secret header, verify the callback by re-fetching the run from the Apify API (`GET /v2/actor-runs/{resource.id}`) with the Apify credential and checking that `ops.apify_runs` contains that run ID — **this is the default** (no secret needed in the payload, and a forged callback cannot inject data because WF-19 only reads datasets of runs it registered).

Then: `ops.register_apify_run(apify_run_id, actor_id, run_id, account_ids, purpose)`.

**Callback (WF-19):** see §6.6.

**Batch sizes:** IG posts/reels ≤ 50 profiles/run daily, ≤ 10 backfill; stories ≤ 100 usernames; LinkedIn posts ≤ 50 daily, ≤ 10 backfill; employees all companies, `one_by_one`; website crawler ≤ 200 URLs; goat255 ≤ 50 users; YouTube actor ≤ 20 channels.

---

## 5. Shared sub-workflows

All have an **Execute Workflow Trigger** with defined input fields ("Define using fields") and return one item.

### SUB · Start run
- Input: `workflow`, `platform`, `mode`, `env`.
- Postgres: `select ops.start_run($1, $2::app.platform, $3, $4, $5) as run_id;` params `[workflow, platform, mode, env, $execution.id]`.
- Output: `{ run_id }`.

### SUB · Finish run
- Input: `run_id`, `status` (`success` | `partial` | `failed`), `error`.
- Postgres: `select ops.finish_run($1::uuid, $2, $3);`
- Then Execute Workflow **WF-70 Publish** (don't wait) with `{ tags: ["feed","stats"] }` when status ≠ failed and the run had new items, and **WF-30** (don't wait) when `items_new > 0`.
- Output: run summary (`select * from ops.scrape_runs where id = $1` is not allowed — no table grants; return what `finish_run` returns: extend `ops.finish_run` to `returns jsonb` with the totals).

### SUB · Ingest items
- Input: `run_id`, `groups` = array of `{ account_id, items: [normalized…], status, error, backfill_done, backfill_cursor }` (one entry per account).
- Loop Over Items (one per group):
  1. If `items.length > 0`: split into chunks of 500 → Postgres `select ingest.upsert_raw_items($1::uuid, $2::uuid, $3::jsonb) as r;` params `[run_id, account_id, JSON.stringify(chunk)]`. Sum `inserted`.
  2. Postgres `select ops.report_account_result($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb);` params `[run_id, account_id, status, items_seen, items_new, error, backfill_done, backfill_cursor]`.
- Output: `{ items_seen, items_new, accounts_ok, accounts_failed }`.
- Validation before RPC (Code node): drop items missing `external_id`, `url` or `platform`; count drops; if drops > 20% of a group → that group `status = failed`, `error = 'contract_drift: <sample keys>'`.

### SUB · Log cost
- Input: `entries` = array of `{ provider, category, quantity, unit, cost_usd, run_id, competitor_id?, platform?, item_id?, meta }`.
- Postgres: `select ops.log_cost($1::jsonb);`

### SUB · Normalize <platform>
Optional wrapper: the normalizer JS (§7) lives in a Code node **inside** each collector/WF-19 branch to save executions. Keep the canonical copy of each normalizer in `n8n/normalizers/<actor>.js` in the repo, paste it into the Code node, and cover it with Vitest contract tests (`n8n/normalizers/normalizers.test.ts` loads the same file and runs it on fixtures).

### SUB · Notify
- Input: `to[]`, `subject`, `html`, `text`.
- HTTP Request → Resend `POST https://api.resend.com/emails` `{ from: "everyone. Market Radar <radar@<verified-domain>>", to, subject, html, text }` (or Send Email node with SMTP).
- From address and domain are a manual action in M13 (until then WF-90/91 use the n8n built-in email or the owner's SMTP).

---

## 6. Workflow specs

### WF-00 · Orchestrator
- **Purpose:** single place for all schedules; dispatches collectors.
- **Trigger:** Schedule Trigger with one rule per slot in §2 (cron expressions, Cairo time). The AI fallback is **not** here — it is WF-30's own Schedule Trigger.
- **Steps:** `Config` → Code node "Which slot?" (maps the trigger's timestamp to the slot key; for multi-rule triggers use `$json.timestamp` hour/minute/day) → Switch on slot → Execute Workflow (mode "don't wait for completion") with input `{ mode, limit, result_type?, env }`:
  - `ig_posts` → WF-11 `{ mode: "daily", result_type: "posts", limit: 500 }`; `ig_reels` → WF-11 `{ result_type: "reels" }`.
  - `stories_pm`: first Postgres `select value from ops.settings where key='stories_twice_daily'` — **not allowed** (no grants): use RPC `ops.get_setting($1)` (add in M03, returns jsonb) → IF true → WF-12.
  - `backfill_wave` → for each of WF-10/11/13/18/21: Execute Workflow `{ mode: "backfill", limit: 10 }` (10 accounts per platform per hourly slot, 14 slots 10:00–23:00 ≈ 140/day per platform).
- **Idempotency:** collectors claim accounts with `SKIP LOCKED`, so a double trigger never double-processes.
- **Acceptance:** each slot dispatches the right workflow (test with Manual Trigger + a "slot override" input); no slot overlaps; executions/day ≤ budget.

### WF-10 · Vimeo collector
- **Trigger:** Execute Workflow Trigger `{ mode, limit }` (+ Manual Trigger with defaults).
- **Steps:**
  1. `SUB · Start run` (`WF-10`, `vimeo`, mode).
  2. Postgres: `select * from ops.get_due_accounts('vimeo'::app.platform, $1, $2::uuid, $3);` params `[limit, run_id, mode]`.
  3. IF no accounts → `SUB · Finish run (success)` → end.
  4. Loop Over Items (batch size 1) per account:
     - IF `external_id` empty → HTTP `GET https://api.vimeo.com/users/{handle}?fields=uri` → Code: extract id → Postgres `select ops.set_account_external_id($1::uuid, $2, $3);` (add RPC in M04: sets `external_id`, `uploads_playlist_id` null, `resolve_status`).
     - HTTP Request (Vimeo token) `GET https://api.vimeo.com/users/{external_id}/videos` with query from SCRAPING_SOURCES §1.1, **Pagination** option: "Response contains next URL" → `{{$response.body.paging.next ? 'https://api.vimeo.com' + $response.body.paging.next : ''}}`, "Complete when" expression: last item date < cutoff (cutoff = mode daily ? watermark − 1 day : backfill_from) or no next page; max pages 50 (daily: 3).
     - Code "Normalize Vimeo API" (§7.1) → filter by cutoff, drop non-`anybody` privacy, stop at `watermark_external_id`.
     - On HTTP 401/403/404 → mark group `status = failed`, `error = 'vimeo_api_<code>'`; collect account for fallback list.
  5. If fallback list non-empty and mode = daily → start **goat255** async run (≤ 50 users; §4) with `purpose: daily`, `platform: vimeo`.
  6. `SUB · Ingest items` with all groups (backfill: `backfill_done = true` when the last page reached `backfill_from`; else save `backfill_cursor = {page}`).
  7. `SUB · Log cost` (Vimeo API: `cost_usd 0`, quantity = API calls).
  8. `SUB · Finish run` (`partial` if any account failed).
- **Rate limit:** Code node reads `x-ratelimit-remaining` from the last response; if < 10, Wait node until `x-ratelimit-reset`.
- **Acceptance:** 3 dev accounts: first run backfills to 2024-01-01; second run same day inserts 0 new items; a new upload appears next day; metrics of last-30-day items update; watermark advances.

### WF-11 · Instagram posts/reels collector
- **Trigger:** Execute Workflow Trigger `{ mode, limit, result_type: "posts" | "reels" }`.
- **Steps:**
  1. Start run (`WF-11`, `instagram`, mode).
  2. `ops.get_due_accounts('instagram', limit, run_id, mode)`.
     - Note: posts and reels runs share the same account row; the posts run claims and reports normally. For the reels run, use RPC `ops.get_accounts_for_secondary_pass('instagram', run_id)` (add in M04: returns active instagram accounts whose `last_success_at` is today, without changing `next_due_at`) so the reels pass doesn't fight the due list.
  3. Code "Batch": sort by watermark, chunk into groups of 50 (daily) / 10 (backfill); per chunk `onlyPostsNewerThan` = oldest watermark − 1 day (daily) or `2024-01-01` (backfill); `resultsLimit` 30 (daily) / 1500 (backfill).
  4. Per chunk: HTTP start actor run `apify~instagram-scraper` (§4) with input from SCRAPING_SOURCES §2; payloadTemplate `emr` = `{ run_id, platform: "instagram", result_type, purpose: mode, account_ids }` → `ops.register_apify_run(...)`.
  5. End (WF-19 completes the run). Do **not** call Finish run here; WF-19 finishes it when all registered Apify runs for `run_id` are processed.
- **Acceptance:** pinned post not ingested; a carousel → `carousel`, reel → `reel`; 2nd run same day → 0 new; private profile → error row ignored, account counted failed.

### WF-12 · Instagram stories collector
- **Trigger:** Execute Workflow Trigger `{ mode: "daily", limit }`.
- **Steps:** Start run (`WF-12`, `instagram_stories`) → `ops.get_due_accounts('instagram_stories', …)` → chunk 100 usernames → start `data-slayer~instagram-stories-scraper` async (`{ usernames }`) → register. During the bake-off (M06) the same chunk also starts `igview-owner~instagram-story-viewer` and `louisdeconinck~instagram-story-details-scraper` for the 20 bake-off accounts with `purpose: "daily"` and `emr.bakeoff = true`; WF-19 stores bake-off results with `actor` set to the bake-off actor and writes them to `ops.bakeoff_results` (temporary table created in M06) instead of ingesting duplicates.
- **Cadence:** `report_account_result` schedules next due +1 day (or +12 h when `stories_twice_daily`) — extend the RPC in M06 to use `cadence` per row (`instagram_stories` cadence `12 hours` when twice daily).
- **Acceptance:** stories ingested with `item_type = story`; thumbnails saved the same day by WF-31; "no stories" summary rows count as success.

### WF-13 · YouTube collector
- **Trigger:** Execute Workflow Trigger `{ mode, limit }`.
- **Steps:**
  1. Start run (`WF-13`, `youtube`).
  2. Due accounts.
  3. Per account: IF no `uploads_playlist_id` → HTTP `GET https://www.googleapis.com/youtube/v3/channels?part=id,contentDetails&forHandle={handle}` (or `id=`/`forUsername=`) → `ops.set_account_external_id(account_id, channel_id, uploads_playlist_id)`; unresolvable → fallback list.
  4. HTTP `playlistItems.list` with pagination (`pageToken`), complete when last `videoPublishedAt` < cutoff or no `nextPageToken`; max pages daily 2, backfill 40.
  5. Batch new + last-30-day video IDs (from the page) into groups of 50 → HTTP `videos.list?part=snippet,statistics,contentDetails&id=…`.
  6. Code "Normalize YouTube API" (§7.8).
  7. Fallback list (mode daily) → start `streamers~youtube-scraper` async (≤ 20 channels).
  8. Ingest → Log cost (quota units as quantity, $0) → Finish run.
- **Acceptance:** handle resolution stored once; quota per run logged; Shorts → `reel`; 0 new on second run.

### WF-18 · LinkedIn posts collector
- **Trigger:** Execute Workflow Trigger `{ mode, limit }`.
- **Steps:** Start run (`WF-18`, `linkedin`) → due accounts → chunk 50 (daily) / 10 (backfill) → per chunk `postedLimitDate` = oldest watermark date − 1 day (daily) / `2024-01-01` (backfill), `maxPosts` 50 / 0 → start `harvestapi~linkedin-company-posts` async → register. WF-19 finishes.
- **Acceptance:** reposts flagged in payload; 0 new on second run; account matching by `author.universalName` or input URL.

### WF-18b · LinkedIn employees (weekly)
- **Trigger:** Execute Workflow Trigger `{ mode: "weekly", limit }` (Sunday slot).
- **Steps:** Start run (`WF-18b`, `linkedin_employees`, `weekly`) → due accounts (`linkedin_employees`, cadence 7 days) → one async run of `harvestapi~linkedin-company-employees` with all companies, `companyBatchMode: one_by_one`, `maxItemsPerCompany: 200`, `profileScraperMode: "Short ($4 per 1k)"` → register. WF-19 branch `linkedin_employees`: group by company (match via `currentPosition[].companyLinkedinUrl` / input order) → Code keep only `publicIdentifier`, name, title, location → Postgres `select ops.save_employee_snapshot($1::uuid, current_date, $2::jsonb);` per account → `report_account_result`.
- **Acceptance:** snapshot row per company per week; `joined`/`left_company` computed on the second week; no emails/photos stored.

### WF-19 · Apify run callback
- **Trigger:** Webhook `POST /webhook/emr-apify-callback`, Respond: "Immediately" with 200 (Apify retries non-2xx; process after responding).
- **M03 safety correction:** the early-completion sequence below is superseded
  for the foundation smoke path. A processed flag around separate ingestion,
  report and cost nodes is insufficient: a partial retry can lose item counts,
  release a lease before retry or double-log cost. M03 uses one bounded atomic
  `ops.process_apify_run` transaction plus `apify_runs.processing_result`. See
  `DECISIONS.md` → M03 callback persistence correction and `DATA_SCHEMA.md` §5.
- **Foundation contract / local implementation and deployment gated:**
  1. Accept only a syntactically valid run-ID hint from the callback. Lookup the
     registered row first; unknown IDs log a fixed rejection and perform no
     actor/dataset reads or registration. Use its stored parent/accounts/purpose.
  2. Authenticated Apify GET of that exact run must match its ID/actor and have
     final status. Use only this response's status, default dataset and usage;
     callback-supplied `emr`/actor/dataset/usage never authorize persistence.
  3. For M03 only, fetch and normalize the one-page approved website crawler
     result for the dedicated dev C999 account/own-page URL. Empty results are
     an explicit empty group; malformed/unsupported branches fail closed. Other
     collector normalizers below are future milestone specifications.
  4. One Postgres call to `ops.process_apify_run` atomically ingests/reports,
     records keyed actual cost, saves its stable receipt, completes the actor
     registry and finishes the single-actor parent. It serializes concurrent
     attempts; replay returns the saved counts with `updated:false` and
     `finished_now:false`. A differing replay is rejected.
  5. First-transition output may call the M03 AI/publish stubs. It is not a
     durable external-delivery guarantee; real later dispatch needs an outbox.
     Retryable callback failures must preserve the running parent for recovery
     (diagnostic parent ID in metadata, not terminal-error `run_id`).
  6. After registering the original start response, the collector independently
     reconciles that same known run ID. This recovers early/lost callbacks and
     work failing after HTTP200. Ambiguous launch responses are reconciled
     before any retry; unknown callbacks never launch work.
- **Future multi-account/multi-actor collector outline:** requires durable
  per-chunk receipts and a launch-closed barrier before extending M03's bound.
  Do not implement the following early `complete_apify_run` call as written.
- **Steps:**
  1. Code: parse `eventType`, `resource.id` (run id), `resource.defaultDatasetId`, `resource.actId`, `resource.usageTotalUsd`, `resource.status`, `emr` context.
  2. Verify: HTTP `GET https://api.apify.com/v2/actor-runs/{resource.id}` (Apify credential) → must exist, status final; Postgres `select ops.get_apify_run($1)` (add in M03: returns the registered row or null) → must exist and `processed_at is null`. Else stop (log to WF-90 as `security`).
  3. Postgres `select ops.complete_apify_run($1, $2, $3, $4);` (status, dataset id, usage USD).
  4. IF status ≠ `SUCCEEDED` → for each `account_ids` → `report_account_result(..., 'failed', 0, 0, 'apify_<status>')` → go to 8.
  5. HTTP `GET https://api.apify.com/v2/datasets/{datasetId}/items?clean=true&format=json&offset={o}&limit=1000` with pagination until fewer than 1000 items.
  6. Switch on `emr.platform` (+ `actor`) → Code normalizer (§7.2–7.10) → group by account (match by owner username / input URL / company URL against the run's accounts; unmatched rows dropped and counted).
  7. Branch: `linkedin_employees` → snapshot path (WF-18b); `website_work_page` → also `ops.mark_website_page(url, 'crawled', item_id)` after ingest using `new_item_ids` (match by external_id); others → `SUB · Ingest items` (`backfill_done` true when mode backfill and the actor returned fewer than `resultsLimit` per account or the oldest item ≤ `backfill_from`).
  8. `SUB · Log cost`: provider `apify`, category `scrape`, `cost_usd = usageTotalUsd`, split per account evenly (quantity = results for that account), `meta = {actor, apify_run_id}`.
  9. Postgres `select ops.apify_runs_pending($1::uuid);` (add in M03: count of registered, unprocessed runs for `run_id`) → if 0 → `SUB · Finish run`.
- **Idempotency:** M03 uses the atomic saved receipt described above. The
  historical early `processed_at` guard in the future outline is not a safe
  implementation or an acceptance claim.
- **Acceptance:** a forged POST with an unknown run id ingests nothing; a retried webhook is ignored; failed run marks accounts failed; cost row equals Apify usage.

### WF-21 · Websites collector
- **Trigger:** Execute Workflow Trigger `{ mode, limit }`.
- **Steps:**
  1. Start run (`WF-21`, `website_work_page`).
  2. Due accounts for `website_work_page`, then for `website` — two Postgres calls. Website roots of competitors that have a work page are `paused` (M02), so they are never claimed; every claimed account is reported back.
  3. Per account: HTTP Firecrawl `POST /v2/map` (`{ url, limit: mode==='backfill' ? 2000 : 500, includeSubdomains: false, sitemap: 'include' }`) → Code: filter globs + canonicalize (SCRAPING_SOURCES §4.1).
  4. Postgres `select ops.diff_website_urls($1::uuid, $2::text[]) as new_urls;`
  5. Collect all new URLs (≤ 200 per crawler run) → start `apify~website-content-crawler` async (`crawlerType` per account: default `cheerio`) → register with `platform: website_work_page`.
  6. Accounts with 0 new URLs → `report_account_result(success, 0, 0)` directly.
  7. `SUB · Log cost` (Firecrawl: 1 credit per map call).
  8. If no crawler run started → Finish run; else WF-19 finishes.
- **WF-19 branch:** pages with < 300 chars text → re-queue those URLs with `crawlerType: playwright:adaptive` (one retry run) and set the account's `backfill_cursor.crawler`.
- **Acceptance:** first run inserts all current pages (backfill); next day only new URLs are crawled; removed pages untouched (WF-40 marks them).

### WF-22 · News (weekly)
- **Trigger:** Execute Workflow Trigger (Sunday 07:00 slot).
- **Steps:** Start run (`WF-22`, `news`, `weekly`) → Postgres `select ops.get_news_queries('news', $1);` (add in M13: returns competitors in scope with names/aliases + top 30 brands by recent items) → Loop: HTTP SerpAPI `GET https://serpapi.com/search.json?engine=google_news&q=…&gl=…&hl=…` → Code normalize (§7.10) → accumulate → Postgres `select ops.upsert_news($1::jsonb);` (chunks of 200) → Log cost (searches × price) → Finish run → WF-70 `{ tags: ["news"] }`.
- **Acceptance:** duplicate URLs across queries stored once; mentions linked to the queried competitor; cost logged per search.

### WF-23 · Awards and trade (weekly)
- Same as WF-22 with `engine=google`, one query per award/trade site with `tbs=qdr:w` (SCRAPING_SOURCES §7 item 3), `kind = 'award'` for award sites, then name matching against competitors/brands in `ops.upsert_news`.

### WF-30 · AI extractor
- **Trigger:** Execute Workflow Trigger (from SUB · Finish run) **and** its own Schedule Trigger every 30 min (fallback).
- **Steps:**
  1. Postgres `select * from ops.claim_queue_batch('ai_extract', $1, 600);` with `$1 = ai_batch_size` (20).
  2. IF empty → end (cheap execution).
  3. Code: collect `item_id`s; messages with `read_ct > 3` → Postgres `select ops.fail_ai_items($1::uuid[], $2::bigint[]);` (add in M07: sets `ai_status='failed'`, archives) and continue with the rest.
  4. Postgres `select ops.get_items_for_ai($1::uuid[]) as ctx;` + `select ops.get_taxonomy_snapshot() as tax;` (add in M07: active codes per taxonomy).
  5. Loop Over Items (batch size 5, parallel via "Execute Once" off): Code builds the request per item from `reference/prompts/extract_item.v1.md` + `reference/json-schemas/item_extraction.v1.json` (taxonomy enums injected) → HTTP `POST https://api.openai.com/v1/responses` with `text.format = { type: "json_schema", strict: true, schema }`, model `OPENAI_MODEL_EXTRACT`; include the thumbnail as `input_image` only when `needs_vision` (caption < 40 chars and no brand mention/tag).
  6. Code: parse `output_text` JSON, re-validate (Ajv-lite checks: required keys, enums), compute cost from `usage` × price book (passed in from `ops.get_price_book()`), build `meta = {model, prompt_version, schema_version, input_tokens, output_tokens, cost_usd, used_vision, latency_ms}`.
  7. Postgres `select ops.apply_extraction($1::uuid, $2::jsonb, $3::jsonb);` per item.
  8. Postgres `select ops.ack_queue('ai_extract', $1::bigint[]);` (only successfully applied messages).
  9. If any processed → Execute Workflow WF-31 (don't wait) and WF-33 (don't wait); if the queue still has items (`processed = batch_size`) → re-call WF-30 once (don't wait), max chain depth 10 per hour (guard via a counter in the input).
  10. Execute WF-70 `{ tags: ["feed", "stats"] }` when ≥ 1 published.
- **Errors:** OpenAI 429/5xx → retry node-level; parse/validation failure → leave message unacked (re-delivered after 600 s; fails after 3 reads).
- **Acceptance:** 20 fixture items → all `published` or `review` per threshold; tokens and cost in `ops.ai_extractions` and `ops.cost_ledger`; locked fields untouched.

### WF-31 · Media (thumbnails)
- **Trigger:** Execute Workflow Trigger — called by `SUB · Finish run` when a collector (incl. WF-12 stories) inserted new items (M06) and by WF-30 after each batch (M07) — plus its own Schedule Trigger every 2 h as a fallback (§2 own-schedule exceptions). Built in **M06** (media v1) because story/Instagram CDN URLs expire; M07 adds vision reads and key frames.
- **Steps:** `ops.claim_queue_batch('media', 50, 600)` → `ops.get_media_targets($1::uuid[])` (add in M06: item id, competitor slug, platform, external_id, thumbnail_source_url) → Loop: HTTP GET image (binary, timeout 20 s; 403/expired → skip, ack) → Edit Image (resize to max width 1280, JPEG quality 80) → HTTP `POST {app_url}/api/internal/media-upload-url` (credential `EMR internal secret`) `{ path }` → HTTP `PUT` signed URL with binary → Postgres `select ops.save_media_asset($1::uuid, 'thumbnail', $2, $3, $4, $5);` → ack.
- **Acceptance:** stories thumbnails saved within the same day; re-run does not duplicate (`storage_path` unique, upsert).

### WF-32 · Campaign linker (daily 06:30)
- **Steps:** Start run (`WF-32`, null, `daily`) → Postgres `select ops.campaign_candidates_since($1::timestamptz) as c;` (add in M08: newly published commercial items since the last linker run, each with candidate campaigns: same brand + same production house + `|published_at − last_seen_at| ≤ campaign_window_days` + embedding similarity) → Code decision (thresholds from `ops.settings`, authoritative spec `docs/AI_PIPELINE.md` §9):
  - best candidate similarity ≥ `campaign_similarity_min` (0.82) and no second candidate within 0.03 → attach;
  - no candidate, or best similarity < 0.75 → new campaign (title from `campaign_title` or `brand + occasion/content_type + month`);
  - ambiguous (0.75–0.82, or two candidates within 0.03) → OpenAI tie-break (`reference/prompts/campaign_link.v1.md`, strict JSON `{decision: attach|new|review, campaign_id?, confidence}`); confidence < 0.80 → review task `campaign_merge`.
  → Postgres `select ops.attach_to_campaign($1::uuid, $2::uuid, $3::jsonb, $4);` per item → `pgmq.send('embed', campaign)` inside the RPC → Finish run → WF-70 `{ tags: ["campaigns"] }`.
- **Acceptance:** fixture set of 10 items across platforms for one brand/house in 2 weeks → one campaign; same brand 3 months later → new campaign.

### WF-33 · Embeddings
- **Trigger:** Execute Workflow Trigger (from WF-30/WF-32/WF-50).
- **Steps:** `ops.claim_queue_batch('embed', 100, 600)` → `ops.get_embedding_inputs($1::jsonb)` (add in M07: builds the text per entity — item: title + summary_en + caption_en + brand + format + tags; campaign: title + summary + brand + house; competitor: name + categories + in_house + recent summaries; brief: body excerpt — and its `content_hash`; skips unchanged) → HTTP `POST https://api.openai.com/v1/embeddings` (`model: text-embedding-3-small`, input array ≤ 100) → Postgres `select ops.upsert_embeddings($1::jsonb);` → Log cost → ack.
- **Acceptance:** unchanged content is not re-embedded; HNSW query returns the item itself as nearest neighbour.

### WF-40 · Removal check (Saturday 04:00)
- **Steps:** Start run (`WF-40`, null, `removal_check`) → per platform: Postgres `select ops.get_removal_targets($1::app.platform, $2);` (add in M06: active items from the last 90 days grouped by account, plus IDs seen in successful runs in the last 7 days) → for each account: a light listing call over the last 30 days — Vimeo/YouTube API pages 1–3 (free); **Instagram and LinkedIn: one weekly Apify listing run** (`apify/instagram-scraper` with `onlyPostsNewerThan` = today − 30 days; `harvestapi/linkedin-company-posts` with `postedLimitDate` = today − 30 days), which also refreshes their metrics (D-13, `removal_window_days_paid` = 30); websites: the Firecrawl map result (`ops.mark_website_removals`) → Postgres `select ops.mark_removed($1::uuid, $2::text[], $3::date);` (`p_since` = the start of the listed window, so items older than the requested range are never marked) → Finish run → WF-70 `{ tags: ["feed"] }`.
- **Acceptance:** a deleted test video is marked `removed`, never deleted; no false positives on items older than the requested date range.

### WF-50 · Weekly briefs (Monday 08:00)
- **Steps:** Start run (`WF-50`, null, `weekly`) → Postgres `select ops.get_brief_inputs($1::date, $2);` per scope EG, KSA, UAE, ALL (add in M13: last week's published items, campaigns new/updated, new/returning clients, agency–house pairings, employee joiners, news; each with IDs) → HTTP OpenAI Responses (`OPENAI_MODEL_BRIEF`, prompt `reference/prompts/weekly_brief.v1.md`, strict schema `reference/json-schemas/weekly_brief.v1.json`) → Code validate that every `highlights[].item_ids` exist in the input → Postgres `select ops.save_brief($1::date, $2, $3::jsonb);` → `pgmq.send('embed', brief)` in RPC → Log cost → Execute WF-80 `{ kind: "weekly_brief" }` → WF-70 `{ tags: ["briefs"] }` → Finish run.
- **Acceptance:** 4 briefs per week; every claim cites ≥ 1 item; re-run the same week overwrites (unique `(week_start, scope)`).

### WF-60 · Competitor onboarding (webhook from app)
- **Trigger:** Webhook `POST /webhook/emr-onboarding` (Header Auth credential `EMR webhook in · App`), body `{ competitor_id, account_ids[] }`, respond immediately 202.
- **Steps:** Postgres `select ops.get_onboarding_accounts($1::uuid);` (add in M15) → per platform resolve IDs (Vimeo user id, YouTube channel id), validate reachability (HTTP HEAD/GET public URL; IG via one `details` run of instagram-scraper is optional) → set `status` active/invalid via `ops.set_account_status` (add in M15) → accounts stay `backfill_status = 'pending'` → the hourly `backfill_wave` picks them up → Notify owner "Competitor X onboarded: n accounts valid, m invalid".
- **Acceptance:** adding a competitor in the app leads to backfilled items within 24 h.

### WF-70 · Publish / revalidate
- **Trigger:** Execute Workflow Trigger `{ tags: string[] }`.
- **Steps:** Code dedupe tags; debounce: Postgres `select ops.should_publish($1::text[]);` (add in M09: returns tags not published in the last 5 minutes and records them) → HTTP `POST {app_url}/api/revalidate` (credential `EMR internal secret`) `{ tags }` → 200 expected.
- **Acceptance:** after a run, the feed page shows new items without a redeploy.

### WF-80 · Alerts
- **Trigger:** Execute Workflow Trigger `{ kind }` from WF-00 (`daily_digest` 09:00), WF-50 (`weekly_brief`), WF-91 (`budget`, `failing_sources`), and from `ops.apply_extraction` results via WF-30 (`instant_launch` — WF-30 passes item IDs that matched the instant rule).
- **Steps:** Postgres `select ops.get_alert_payload($1, $2::jsonb);` (add in M13: active rules of that kind, recipients, and the content: digest = last 24 h counts + top 10 launches + new clients; instant = the item card; brief = links to 4 briefs) → Code render HTML email (brand styles from `DESIGN.md` §12 email template: black header with white wordmark PNG, General Sans fallback to Arial, green accent for links) → `SUB · Notify` per rule → Postgres `select ops.log_alert_sent($1, $2::jsonb);` (add in M13).
- **Defaults (seeded in M13):** daily digest, instant launch, budget, failing sources, weekly brief → `mohamed.abdelrahman@everyone.film` (D-21).
- **Acceptance:** digest arrives 09:00 Cairo with correct counts; no email when there is nothing new (digest says "quiet day" only if the rule's `filters.send_empty = true`).

### WF-90 · Error handler
- **Trigger:** Error Trigger.
- **Steps:** Code build `{ workflow, execution_id, node, message, stack (first 2 KB), mode }` → Postgres `select ops.log_workflow_error($1::jsonb);` (add in M03: writes `ops.audit_log` action `workflow_error` and marks the run `failed` if `run_id` is in the execution data) → IF same workflow failed ≥ 3 times in 24 h (`ops.error_count_24h($1)`) → `SUB · Notify` to the owner (subject `[Market Radar] WF-XX failing`).
- **Acceptance:** a forced error writes an audit row; the 3rd failure sends one email (not one per failure after that — throttle 1 email per workflow per 6 h).

### WF-91 · Health & cost (daily 09:15)
- **Steps:** Postgres `select ops.accrue_fixed_costs(current_date - 1);` → `select ops.refresh_stats_daily(current_date - 2);` → `select ops.daily_health() as h;` (failing accounts, stale accounts, queue depths, items new per platform yesterday, cost yesterday vs `daily_budget_usd`, month-to-date + forecast) → IF cost > budget → WF-80 `{ kind: "budget" }`; IF failing accounts > 0 → WF-80 `{ kind: "failing_sources" }` → `SUB · Notify` daily health summary to the owner (short) → WF-70 `{ tags: ["stats"] }`.
- **Acceptance:** the health email lists the exact failing accounts; the forecast matches `app.costs_summary`.

---

## 7. Normalizer snippets (Code node, "Run Once for All Items", JavaScript)

Common helpers (paste at the top of each normalizer; canonical copy `n8n/normalizers/_common.js`):
```js
const lc = (s) => (s || '').toString().trim().toLowerCase();
const noAt = (s) => lc(s).replace(/^@+/, '');
const iso = (v) => { if (v === null || v === undefined || v === '') return null;
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return isNaN(d) ? null : d.toISOString(); };
const tags = (text) => [...new Set(((text || '').match(/#([\p{L}\p{N}_]+)/gu) || []).map(t => lc(t.slice(1))))];
const ats  = (text) => [...new Set(((text || '').match(/@([A-Za-z0-9._]+)/g) || []).map(t => noAt(t)))];
const int = (v) => (v === null || v === undefined || v === '' || Number(v) < 0) ? null : Math.round(Number(v));
const isoDur = (s) => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ''); if (!m) return null;
  return (+m[1]||0)*86400 + (+m[2]||0)*3600 + (+m[3]||0)*60 + (+m[4]||0); };
const hms = (s) => { if (!s) return null; const p = s.split(':').map(Number); return p.reduce((a, n) => a * 60 + n, 0); };
const trim8k = (s) => (s || '').slice(0, 8000);
```
Each normalizer outputs `{ json: normalizedItem, matchKey }` where `matchKey` identifies the account (owner username, channel id, company slug, page URL).

### 7.1 Vimeo API
```js
const cutoff = new Date($('Config').first().json.cutoff); // set per account upstream
const stopId = $('Account').first().json.watermark_external_id;
const out = [];
for (const v of $input.first().json.data || []) {
  const id = (v.uri || '').split('/').pop();
  if (stopId && id === stopId) break;
  const pub = iso(v.release_time || v.created_time);
  if (pub && new Date(pub) < cutoff) break;
  if (v.privacy && v.privacy.view !== 'anybody') continue;
  const sizes = (v.pictures && v.pictures.sizes) || [];
  const thumb = sizes.filter(s => s.width <= 1280).sort((a, b) => b.width - a.width)[0] || sizes[sizes.length - 1];
  out.push({ json: {
    platform: 'vimeo', external_id: id, actor: 'vimeo-api', item_type: 'video', url: v.link, published_at: pub,
    title: v.name || null, caption: trim8k(v.description), credits_text: trim8k(v.description),
    hashtags: (v.tags || []).map(t => lc(t.name)), mentions: ats(v.description), tagged_accounts: [],
    duration_seconds: int(v.duration), thumbnail_url: thumb ? thumb.link : null,
    metrics: { plays: int(v.stats && v.stats.plays), likes: int(v.metadata?.connections?.likes?.total),
               comments: int(v.metadata?.connections?.comments?.total) },
    media_urls: [], payload: v } });
}
return out;
```

### 7.2 goat255/vimeo-scraper
```js
const accounts = $('Run accounts').all().map(a => a.json); // [{account_id, handle, watermark_published_at}]
const byHandle = Object.fromEntries(accounts.map(a => [lc(a.handle), a]));
return $input.all().filter(i => i.json.type === 'video').map(({ json: v }) => {
  const handle = lc((v.ownerUrl || '').split('/').filter(Boolean).pop());
  const pub = iso((v.uploadDate || '').replace(' ', 'T') + 'Z');
  return { json: {
    platform: 'vimeo', external_id: String(v.id), actor: 'goat255/vimeo-scraper', item_type: 'video', url: v.url,
    published_at: pub, title: v.title || null, caption: trim8k(v.description), credits_text: trim8k(v.description),
    hashtags: (v.tags || []).map(lc), mentions: ats(v.description), tagged_accounts: [],
    duration_seconds: int(v.duration), thumbnail_url: v.thumbnail || null, metrics: {}, media_urls: [], payload: v },
    matchKey: handle };
}).filter(i => { const a = byHandle[i.matchKey]; if (!a) return false;
  const wm = a.watermark_published_at ? new Date(a.watermark_published_at) : new Date('2024-01-01');
  return !i.json.published_at || new Date(i.json.published_at) >= new Date(wm - 86400000); });
```

### 7.3 apify/instagram-scraper (posts / reels)
```js
const resultType = $('Callback').first().json.emr.result_type; // 'posts' | 'reels'
return $input.all().filter(i => !i.json.error && i.json.shortCode).map(({ json: p }) => {
  let type = 'post';
  if (p.type === 'Sidecar') type = 'carousel';
  else if (p.type === 'Video') type = (p.productType === 'clips' || resultType === 'reels') ? 'reel' : 'video';
  const tagged = [...(p.taggedUsers || []).map(u => noAt(u.username)), ...(p.coauthorProducers || []).map(u => noAt(u.username))];
  return { json: {
    platform: 'instagram', external_id: p.shortCode, actor: 'apify/instagram-scraper', item_type: type,
    url: p.url || `https://www.instagram.com/p/${p.shortCode}/`, published_at: iso(p.timestamp), title: null,
    caption: trim8k(p.caption), hashtags: (p.hashtags || []).map(lc), mentions: (p.mentions || []).map(noAt),
    tagged_accounts: [...new Set(tagged)], duration_seconds: int(p.videoDuration),
    thumbnail_url: p.displayUrl || (p.images && p.images[0]) || null,
    metrics: { likes: int(p.likesCount), comments: int(p.commentsCount),
               views: int(p.videoViewCount ?? p.videoPlayCount ?? p.igPlayCount), shares: int(p.reshareCount ?? p.sharesCount) },
    media_urls: [], payload: p }, matchKey: lc(p.ownerUsername) };
});
```

### 7.4 data-slayer/instagram-stories-scraper
```js
return $input.all().filter(i => i.json.id || i.json.code).map(({ json: s }) => {
  const user = lc(s.creator_username || s.username);
  const id = String(s.id || s.code);
  const mentions = [...new Set([...(s.reel_mentions || []).map(m => noAt(m.user?.username || m.username)).filter(Boolean),
                                ...ats(s.caption_text)])];
  const thumb = s.thumbnail_url || (Array.isArray(s.image_versions) ? (s.image_versions[0]?.url) : s.image_versions?.candidates?.[0]?.url) || null;
  return { json: {
    platform: 'instagram_stories', external_id: id, actor: 'data-slayer/instagram-stories-scraper', item_type: 'story',
    url: s.story_permalink || `https://www.instagram.com/stories/${user}/${id}/`,
    published_at: iso(s.taken_at_ts ?? s.taken_at_date ?? s.taken_at), title: null, caption: trim8k(s.caption_text),
    hashtags: tags(s.caption_text), mentions, tagged_accounts: [], duration_seconds: int(s.video_duration),
    thumbnail_url: thumb, metrics: {}, media_urls: s.story_link_url ? [s.story_link_url] : [], payload: s },
    matchKey: user };
});
// Rows with no id (per-user summary, e.g. status/stories_count) are treated as "account checked, 0 stories" upstream.
```

### 7.5 apify/website-content-crawler
```js
const crypto = require('crypto'); // allowed in n8n Cloud Code node? If not, use a simple FNV hash below.
const h = (s) => { try { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32); }
  catch { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); } };
const pickDate = (m, md) => iso(m?.openGraph?.find?.(o => o.property === 'article:published_time')?.content)
  || iso((md || '').match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]) || null;
const media = (s) => [...new Set(((s || '').match(/https?:\/\/(?:player\.)?(?:vimeo\.com|youtu\.be|(?:www\.)?youtube\.com)\/[^\s)"'<>]+/g) || []))];
return $input.all().filter(i => i.json.url && (i.json.text || '').length >= 1).map(({ json: p }) => {
  const canon = (p.metadata?.canonicalUrl || p.url).split('#')[0].split('?')[0];
  const body = p.markdown || p.text || '';
  const credits = (body.match(/(?:^|\n)#*\s*(credits|director|client|agency)[\s\S]{0,1500}/i) || [])[0] || null;
  return { json: {
    platform: 'website_work_page', external_id: h(canon.toLowerCase()), actor: 'apify/website-content-crawler',
    item_type: 'project_page', url: canon, published_at: pickDate(p.metadata, body),
    title: (p.metadata?.title || '').split(/\s[|–-]\s/)[0] || null, caption: trim8k(body), credits_text: credits,
    hashtags: [], mentions: ats(body).slice(0, 20), tagged_accounts: [], duration_seconds: null,
    thumbnail_url: p.metadata?.openGraph?.find?.(o => o.property === 'og:image')?.content || null,
    metrics: {}, media_urls: media(body + ' ' + (p.html || '')), payload: { ...p, html: undefined } },
    matchKey: canon, thin: body.length < 300 };
});
```

### 7.6 harvestapi/linkedin-company-posts
```js
return $input.all().filter(i => i.json.id).map(({ json: p }) => {
  const reactions = (p.engagement?.reactions || []).reduce((a, r) => a + (r.count || 0), 0);
  const authorSlug = lc(p.author?.universalName || (p.author?.linkedinUrl || '').split('/company/')[1]?.split('/')[0]);
  return { json: {
    platform: 'linkedin', external_id: String(p.id), actor: 'harvestapi/linkedin-company-posts', item_type: 'linkedin_post',
    url: p.linkedinUrl || p.socialContent?.shareUrl, published_at: iso(p.postedAt?.date ?? p.postedAt?.timestamp),
    title: null, caption: trim8k(p.content), hashtags: tags(p.content), mentions: [],
    tagged_accounts: p.repostedBy || p.reshared ? [lc(p.author?.name)] : [], duration_seconds: null,
    thumbnail_url: p.postImages?.[0]?.url || p.document?.coverPages?.[0] || p.postVideo?.thumbnailUrl || null,
    metrics: { likes: int(p.engagement?.likes ?? reactions), comments: int(p.engagement?.comments), shares: int(p.engagement?.shares) },
    media_urls: [], payload: p }, matchKey: authorSlug };
});
// Account matching: compare matchKey with the account handle (company slug); for reposts the author is the original
// poster — fall back to the input URL echoed in the item (verify the field name on the first fixture).
```

### 7.7 harvestapi/linkedin-company-employees (snapshot, not items)
```js
const keep = (p) => ({ public_id: p.publicIdentifier, name: [p.firstName, p.lastName].filter(Boolean).join(' '),
  title: p.currentPosition?.[0]?.position || p.headline || null, location: p.location?.linkedinText || null,
  company_url: lc(p.currentPosition?.[0]?.companyLinkedinUrl || '') });
const people = $input.all().map(i => keep(i.json)).filter(p => p.public_id);
const groups = {};
for (const p of people) { const slug = (p.company_url.split('/company/')[1] || '').split('/')[0]; (groups[slug] ||= []).push(p); }
return Object.entries(groups).map(([slug, list]) => ({ json: { matchKey: slug, people: list.map(({ company_url, ...r }) => r) } }));
```

### 7.8 YouTube Data API (playlistItems + videos)
```js
const videos = Object.fromEntries(($('videos.list').all().flatMap(i => i.json.items || [])).map(v => [v.id, v]));
const cutoff = new Date($('Account').first().json.cutoff); const stopId = $('Account').first().json.watermark_external_id;
const out = [];
for (const it of $('playlistItems').all().flatMap(i => i.json.items || [])) {
  const id = it.contentDetails.videoId; if (id === stopId) break;
  const pub = iso(it.contentDetails.videoPublishedAt); if (pub && new Date(pub) < cutoff) break;
  const v = videos[id] || {}; const sn = v.snippet || it.snippet || {}; const dur = isoDur(v.contentDetails?.duration);
  const th = sn.thumbnails || {};
  out.push({ json: {
    platform: 'youtube', external_id: id, actor: 'youtube-api', item_type: dur !== null && dur <= 60 ? 'reel' : 'video',
    url: `https://www.youtube.com/watch?v=${id}`, published_at: pub, title: sn.title || null,
    caption: trim8k(sn.description), credits_text: trim8k(sn.description), hashtags: (sn.tags || []).map(lc),
    mentions: ats(sn.description), tagged_accounts: [], duration_seconds: dur,
    thumbnail_url: (th.maxres || th.high || th.medium || th.default || {}).url || null,
    metrics: { views: int(v.statistics?.viewCount), likes: int(v.statistics?.likeCount), comments: int(v.statistics?.commentCount) },
    media_urls: [], payload: { item: it, video: v } } });
}
return out;
```

### 7.9 streamers/youtube-scraper
```js
const okErrors = ['DATE_FILTER_TOO_STRICT', 'NO_RESULTS'];
return $input.all().filter(i => !i.json.error || !okErrors.includes(i.json.error)).filter(i => !i.json.error).map(({ json: v }) => ({ json: {
  platform: 'youtube', external_id: v.id, actor: 'streamers/youtube-scraper', item_type: v.type === 'shorts' ? 'reel' : 'video',
  url: v.url, published_at: iso(v.date), title: v.title || null, caption: trim8k(v.text), credits_text: trim8k(v.text),
  hashtags: (v.hashtags || []).map(h => lc(h).replace(/^#/, '')), mentions: ats(v.text), tagged_accounts: [],
  duration_seconds: hms(v.duration), thumbnail_url: v.thumbnailUrl || null,
  metrics: { views: int(v.viewCount), likes: int(v.likes), comments: int(v.commentsCount) }, media_urls: [], payload: v },
  matchKey: v.channelId || lc(v.channelUsername) }));
// Error items CHANNEL_DOES_NOT_EXIST → account invalid (handled in the branch before this node).
```

### 7.10 SerpAPI (news / awards)
```js
const q = $('Query').first().json; // {query, kind, competitor_id?, org_id?, engine}
const rows = q.engine === 'google_news' ? ($input.first().json.news_results || []).flatMap(r => r.stories ? r.stories : [r])
                                        : ($input.first().json.organic_results || []);
return rows.filter(r => r.link).map(r => ({ json: {
  url: r.link.split('#')[0], kind: q.kind, title: r.title, source_name: r.source?.name || r.source || r.displayed_link || null,
  published_at: iso(r.iso_date || r.date), snippet: r.snippet || null, language: /[؀-ۿ]/.test(r.title || '') ? 'ar' : 'en',
  query: q.query, mentions: q.competitor_id ? [{ entity_type: 'competitor', entity_id: q.competitor_id }]
                           : q.org_id ? [{ entity_type: 'organization', entity_id: q.org_id }] : [] } }));
```

---

## 8. RPCs added by these workflows (mirror in DATA_SCHEMA §5 when implementing)

| RPC | Milestone | Purpose |
|---|---|---|
| `ops.get_setting(key) → jsonb` | M03 | Read a tunable (n8n has no table grants) |
| `ops.get_price_book() → jsonb` | M03 | Prices for cost calc in Code nodes |
| `ops.get_apify_run(apify_run_id) → jsonb`, `ops.apify_runs_pending(run_id) → int` | M03 | WF-19 guard and completion |
| `ops.log_workflow_error(jsonb)`, `ops.error_count_24h(workflow) → int` | M03 | WF-90 |
| `ops.set_account_external_id(account_id, external_id, uploads_playlist_id)` | M04 | Vimeo/YouTube resolution |
| `ops.get_accounts_for_secondary_pass(platform, run_id)` | M04 | IG reels pass |
| `ops.get_removal_targets(platform, window_days)` | M06 | WF-40 |
| `ops.get_media_targets(ids)`, `ops.save_media_asset(...)` | M06 | WF-31 (media v1 moved to M06 because story/Instagram CDN URLs expire) |
| `ops.fail_ai_items(item_ids, msg_ids)`, `ops.get_taxonomy_snapshot()`, `ops.get_embedding_inputs(jsonb)` | M07 | WF-30/33 |
| `ops.campaign_candidates_since(ts)` | M08 | WF-32 (wraps `ops.campaign_candidates`) |
| `ops.should_publish(tags)` | M09 | WF-70 debounce |
| `ops.get_news_queries(kind, limit)`, `ops.get_brief_inputs(week_start, scope)`, `ops.get_alert_payload(kind, ctx)`, `ops.log_alert_sent(kind, ctx)` | M13 | WF-22/23/50/80 |
| `ops.get_onboarding_accounts(competitor_id)`, `ops.set_account_status(account_id, status, reason)` | M15 | WF-60 |
