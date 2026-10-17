# M05 — Collectors II: Websites, YouTube, LinkedIn (posts + employees)

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first, then the root `PROGRESS.md`.

## 1. Goal and outcome

Build four collectors and backfill the pilot from **1 Jan 2024** (websites: all current work pages):

| Workflow | What it does |
|---|---|
| **WF-21 · Websites** | Firecrawl URL map → diff → `apify/website-content-crawler` on new project pages only |
| **WF-13 · YouTube** | YouTube Data API v3 primary, `streamers/youtube-scraper` fallback |
| **WF-18 · LinkedIn posts** | `harvestapi/linkedin-company-posts` |
| **WF-18b · LinkedIn employees (weekly)** | `harvestapi/linkedin-company-employees`, writing snapshots, not items |

When M05 is done, all five in-scope sources except stories are collecting daily. Every pilot website's existing project pages, YouTube uploads and LinkedIn posts since 2024 are in `app.items`. Every pilot LinkedIn company has a first employee snapshot.

## 2. Context you need (read before T1)

- Same foundation as M04. Read M04's hand-off and its `MILESTONE.md` §2 first: the single writer path, due list, WF-19 async pattern, dev-then-prod-backfill default, and the prod schedules that stay off until M08.
- **Websites have two account rows per competitor.** `website` is the domain root. `website_work_page` is the "Our work / Portfolio" URL from the sheet, present for 38 pilot accounts including the baseline. Items use `platform = 'website_work_page'`, `item_type = 'project_page'`. The known URLs live in `app.website_pages` (url unique, status `new|crawled|ignored|removed|failed`).
  - `ops.diff_website_urls(account_id, urls[]) → text[]` already exists in the draft (`reference/sql/004_rpc_pipeline.sql`). It marks seen URLs and returns **only unseen URLs**.
  - `ops.mark_website_page(url, status, item_id)` is this milestone's job.
- **Websites have no reliable publish date.** `published_at` comes from page metadata (`article:published_time`, JSON-LD `datePublished`, or a date near the title), else `null`. Backfilled pages get `payload.backfill = true`, so the feed doesn't show them as "new today".
- **YouTube** needs `external_id` (UC…) and `uploads_playlist_id` (UU…). M02 resolved them where it could; WF-13 resolves the rest via `channels.list` and `ops.set_account_external_id` (added in M04).
  - **Quota:** 10,000 units/day. Each call (`channels.list`, `playlistItems.list`, `videos.list`) costs 1 unit, so about 2–3 units per channel per day.
  - **Never use `search.list`.** It has its own cap of 100 calls/day.
- **LinkedIn job postings are OUT of scope (D-08).** The employee snapshot is the hiring signal. Privacy rule (Q-05): store only `publicIdentifier`, the name, the headline/title and the location text. No photos, emails, about, skills or experience lists.
- **LinkedIn employees are not items.** WF-19's `linkedin_employees` branch calls `ops.save_employee_snapshot(account_id, snapshot_date, people)`, which you implement here. It stores the snapshot and computes `joined` / `left_company` against the previous snapshot by `public_id`.
- **Public data only (D-24).** Never pass `initialCookies` to the crawler, and no cookies or sessions to the harvestapi actors. They are "no cookies" actors.
- **Firecrawl** is the only tool in this milestone billed outside Apify. Log 1 credit per map call (`ops.price_book` `firecrawl:credit`).

## 3. Prerequisites

| Item | Needed for | Check |
|---|---|---|
| M04 Done | Patterns, `ops.set_account_external_id`, WF-19 branches, prod copies of SUBs/WF-19/WF-90 | root board |
| MA-08 YouTube API key | WF-13 | n8n credential `YouTube Data API key`; `channels.list?forHandle=@AflamProductions` → 200 |
| MA-15 Firecrawl key + backfill approval | WF-21; T9 | n8n credential `Firecrawl`; `POST /v2/map` on `https://everyone.film/by-everyone` → URLs |
| MA-10 Apify token | crawler, harvestapi, youtube fallback | already verified in M04 |

## 4. Scope

**In scope**
- **WF-21:**
  - daily Firecrawl map;
  - glob filtering and canonicalization;
  - URL diff;
  - an async crawler run for new URLs (cheerio, then a playwright:adaptive retry for thin pages);
  - backfill of all current work pages;
  - `ops.mark_website_page`;
  - a project-page heuristic that ignores non-project pages.
- **WF-13:** Data API path; handle resolution; stats via `videos.list`; actor fallback; quota logging.
- **WF-18:** company posts, daily + backfill. Reposts and quote posts are included and flagged.
- **WF-18b:** weekly employees (Sunday 05:00 Cairo); `ops.save_employee_snapshot`.
- **Normalizers:** `websiteContentCrawler.js`, `youtubeApi.js`, `youtubeScraper.js`, `linkedinPosts.js`, `linkedinEmployees.js`, each with fixtures and contract tests.
- **Prod:** apply the migration (with approval); create prod copies; run the backfill waves for these platforms; daily slots stay off.

**Out of scope:** LinkedIn jobs; LinkedIn reactions/comments (`scrapeReactions`/`scrapeComments` false); YouTube transcripts and AI add-ons (D-08); stories (M06); AI (M07); news/awards (M13).

## 5. References

- `docs/SCRAPING_SOURCES.md` §4 (websites), §5 (LinkedIn), §6 (YouTube), §8 (costs), §9 (health)
- `docs/N8N_WORKFLOWS.md` §2 schedule (websites 01:00, YouTube 03:30, LinkedIn posts 04:00, employees Sun 05:00), §4, §6 WF-13 / WF-18 / WF-18b / WF-19 / WF-21, §7.5–7.9 normalizers
- `reference/apify_actor_research_2026-10-17.md` §7 website-content-crawler, §8 employees, §9 company posts, §10 youtube-scraper, YouTube Data API section
- `docs/DATA_SCHEMA.md` (`app.website_pages`, `app.employee_snapshots`), `reference/sql/002_core_tables.sql`, `004_rpc_pipeline.sql`

## 6. Deliverables

| Path | What |
|---|---|
| `supabase/migrations/<ts>_m05_web_yt_li.sql` | `ops.mark_website_page`, `ops.save_employee_snapshot`, grants |
| `supabase/tests/m05_*.sql` | pgTAP for both RPCs (joined/left diff, idempotent re-save same date) and `diff_website_urls` |
| `n8n/normalizers/websiteContentCrawler.js`, `youtubeApi.js`, `youtubeScraper.js`, `linkedinPosts.js`, `linkedinEmployees.js` | Normalizers |
| `n8n/normalizers/fixtures/website-content-crawler/`, `youtube-api/`, `youtube-scraper/`, `linkedin-company-posts/`, `linkedin-company-employees/` | Real fixtures (trimmed; employee fixtures anonymised: replace names with "Person N") |
| `n8n/normalizers/normalizers.test.ts` | Contract tests, extended |
| `n8n/workflows/WF-21-websites.json`, `WF-13-youtube.json`, `WF-18-linkedin-posts.json`, `WF-18b-linkedin-employees.json`, updated `WF-19`, `WF-00` | Exports |
| `scripts/estimate-backfill.ts` | Extended to websites/YouTube/LinkedIn |
| `scripts/assert/m05.sql` | AC SQL |

## 7. Tasks

### T1: Fixtures (dev)
1. **Firecrawl:** `POST https://api.firecrawl.dev/v2/map` with `{"url": "https://goodpeople.film/works/", "limit": 100, "includeSubdomains": false, "sitemap": "include"}`. Verify the current endpoint and version on docs.firecrawl.dev and note any change.
2. **`apify/website-content-crawler`** on 3 project URLs from two test sites (one plain HTML, one JS-heavy):
   ```json
   {"startUrls": [{"url": "<project url>"}], "crawlerType": "cheerio", "maxCrawlDepth": 0, "maxCrawlPages": 10,
    "saveMarkdown": true, "htmlTransformer": "readableText", "removeCookieWarnings": true,
    "respectRobotsTxtFile": true, "proxyConfiguration": {"useApifyProxy": true}}
   ```
   Repeat with `"crawlerType": "playwright:adaptive"` for the JS-heavy site.
3. **YouTube API**, using the test channels from `data/test_accounts.csv`:
   - `channels.list?part=id,contentDetails&forHandle=@AflamProductions`;
   - `playlistItems.list?part=snippet,contentDetails&playlistId=UU…&maxResults=10`;
   - `videos.list?part=snippet,statistics,contentDetails&id=…`.
4. **`streamers/youtube-scraper`** on one channel:
   ```json
   {"startUrls": [{"url": "https://www.youtube.com/@hekka_sa/videos"}], "oldestPostDate": "2026-09-01",
    "sortVideosBy": "NEWEST", "maxResults": 10, "maxResultsShorts": 5, "maxResultStreams": 0,
    "transcriptionAndSubtitle": "NONE", "aiVideoDescription": false, "aiVideoSummary": false}
   ```
5. **`harvestapi/linkedin-company-posts`:**
   ```json
   {"targetUrls": ["https://www.linkedin.com/company/everyonefilms/", "https://www.linkedin.com/company/goodpeoplefilms"],
    "postedLimitDate": "2026-08-01", "maxPosts": 10, "includeReposts": true, "includeQuotePosts": true,
    "scrapeReactions": false, "scrapeComments": false}
   ```
   Capture the real company-post shape, including the video and thumbnail field names (unverified in the research).
6. **`harvestapi/linkedin-company-employees`:**
   ```json
   {"companies": ["https://www.linkedin.com/company/everyonefilms/"], "profileScraperMode": "Short ($4 per 1k)",
    "companyBatchMode": "one_by_one", "maxItemsPerCompany": 20, "maxItems": 0}
   ```
   Confirm the accepted `profileScraperMode` value (label vs enum). Anonymise before committing.
7. Log the deviations against SCRAPING_SOURCES and fix the doc.

*Done when* the fixtures are committed.

### T2: Dev account set
In dev, activate the 5 test accounts each for `website_work_page`, `youtube` and `linkedin` from `data/test_accounts.csv`. Also activate the matching `linkedin_employees` rows, which use the same handles; their `backfill_status` must be `not_applicable` (M02). Pause the rest.

### T3: Migration
1. `ops.mark_website_page(p_url text, p_status text, p_item_id uuid default null) returns void`:
   - updates `app.website_pages` by `url`;
   - sets `status`, `crawled_at = now()` when the status is `crawled`, and `item_id`;
   - raises if the status isn't in the allowed set.
2. `ops.save_employee_snapshot(p_account_id uuid, p_snapshot_date date, p_people jsonb) returns jsonb`:
   - Find `competitor_id` from the account.
   - Load the previous snapshot (latest `snapshot_date < p_snapshot_date`).
   - Compute `joined` = people whose `public_id` isn't in the previous snapshot, and `left_company` = previous people not in the current one. Both are empty on the first snapshot.
   - Insert or update `app.employee_snapshots` on `(competitor_id, snapshot_date)`, with `headcount_listed = jsonb_array_length(p_people)`.
   - Upsert `app.people` for anyone with a senior title, matching any of these case-insensitive patterns: `director|head of|executive producer|producer|dop|cinematographer|creative director|founder|ceo|partner`. Use `linkedin_public_id` unique, `status 'unconfirmed'`, no other personal data.
   - Return `{headcount, joined_count, left_count}`.
   - Write it as SECURITY DEFINER, `search_path=''`, and grant it to `n8n_writer`.
3. pgTAP tests:
   - A first snapshot gives empty diffs.
   - A second snapshot with +2/−1 people gives the right lists.
   - Re-saving the same date is idempotent.
   - `mark_website_page` sets `crawled_at`.
   - `diff_website_urls` returns only unseen URLs, and `last_seen_at` updates for the seen ones.
4. Run advisors → dev push → types.

### T4: Normalizers + tests
Port these from `docs/N8N_WORKFLOWS.md` §7.5–7.9 into `n8n/normalizers/*.js`.

**Websites:**
- `external_id` = sha256(lowercase canonical URL), the first 32 hex characters. Canonical URL = `metadata.canonicalUrl ?? url`, without query or fragment. If `crypto` isn't available in the n8n Cloud Code node, use the FNV fallback, and record which one you used; it must never change afterwards, because changing it would duplicate every page.
- `title`: `metadata.title`, cut at ` | `, ` – ` or ` - `.
- `caption`: the markdown, at most 8,000 characters.
- `credits_text`: the section starting at a heading or line with Credits, Director, Client or Agency, up to 1,500 characters.
- `media_urls`: every Vimeo or YouTube URL in the markdown or html.
- `thumbnail_url`: `og:image`.
- `published_at`: from the page metadata, else `null`.
- `thin` flag: text under 300 characters.

**YouTube API:**
- ISO 8601 duration → seconds.
- Duration ≤ 60 s or a `/shorts/` URL → `reel`.
- Stop at the watermark ID or the cutoff date.
- Thumbnail order: `maxres → high → medium → default`.

**YouTube scraper:**
- `DATE_FILTER_TOO_STRICT` and `NO_RESULTS` → zero items, success.
- `CHANNEL_DOES_NOT_EXIST` → return `{error:'channel_missing', matchKey}`.
- `"HH:MM:SS"` → seconds.
- `type === 'shorts'` → `reel`.

**LinkedIn posts:**
- `published_at` from `postedAt.date` (else `postedAt.timestamp` in ms).
- Hashtags parsed from `content`.
- A repost or quote post sets `payload.is_repost = true` and puts the original author in `tagged_accounts`.
- Metrics: `engagement.likes` (else the sum of reactions), comments and shares.
- `matchKey`: the company slug from `author.universalName` or `author.linkedinUrl`; for reposts, fall back to the input URL field you confirmed in T1.

**LinkedIn employees:**
- Keep `{public_id, name, title, location}` and nothing else.
- Group by the slug of the current company's URL. Unmatched people are dropped, with a count.

Contract tests: website (plain + JS page, thin flag, media_urls), YouTube (Shorts rule, stop rule), LinkedIn (repost flag, date), employees (no forbidden keys present: assert that `email`, `photo`, `about` and `skills` are absent).

### T5: WF-21 · Websites (dev)
Build it as in `docs/N8N_WORKFLOWS.md` §6 WF-21:
1. **Start the run:** `SUB · Start run` (`WF-21`, `website_work_page`, mode). Get the due accounts for `website_work_page`, then for `website`. No filtering is needed: M02 keeps `website` roots `paused` whenever the competitor has a work page, so only roots of competitors **without** a work page are ever claimed (every claimed row must be reported back with `report_account_result`, never dropped).
2. **Map each account:**
   - Firecrawl map: `limit` 500 daily, 2000 backfill.
   - Filter (Code). For `website_work_page` accounts, keep links under the work-page path. For `website` accounts, keep URLs matching `**/work/**`, `**/works/**`, `**/project*/**`, `**/portfolio/**`, `**/case-stud*/**`, `**/films/**`, `**/campaigns/**`, `**/clients/**`, `**/news/**`, `**/blog/**` (and `/ar/` variants), and drop `**/tag/**`, `**/category/**`, `**/page/**`, `wp-json`, `feed` and media files.
   - Canonicalize: lowercase the host, strip query and fragment, and apply one consistent trailing-slash rule (document it).
3. **Diff:** call `ops.diff_website_urls(account_id, urls)` to get the new URLs. Accounts with 0 new URLs → `report_account_result(success, seen=len(urls), new=0)`.
   - A map with 0 URLs → failed, `error='web_map_empty'` (3× → failing).
4. **Crawl:** start an async `apify~website-content-crawler` run on all new URLs, ≤ 200 per run, with `crawlerType` = the account's `backfill_cursor.crawler` or else `cheerio`. Register it with `emr.platform='website_work_page'`.
5. **Log cost** (Firecrawl, 1 credit per map). Finish the run here if no crawler run started; otherwise WF-19 finishes it.
6. **WF-19 branch `website_work_page`:**
   - Normalize, then split the pages:
     - **thin pages** (< 300 characters): start one retry run with `crawlerType: "playwright:adaptive"` for those URLs, and set `backfill_cursor.crawler = 'playwright:adaptive'` for their accounts via `report_account_result`'s cursor parameter;
     - **non-project pages:** title or URL matches `privacy|terms|contact|careers|about|team|cookie|404`, or the text has no project signal. Call `ops.mark_website_page(url, 'ignored')` and don't ingest them;
     - **the rest:** ingest them (in backfill mode, set `payload.backfill = true`), then `ops.mark_website_page(url, 'crawled', item_id)`, mapping external IDs to the `new_item_ids` returned by `upsert_raw_items`. Extend the RPC response to return `[{external_id, item_id}]` pairs if the ID order isn't reliable; record that in the deviations.
   - Pages the crawler failed on → `ops.mark_website_page(url,'failed')`. They are retried on the next daily run only if they reappear as new; to retry them, add `status='failed'` URLs back into the diff in the next run's Code node (they are returned by a small query, `ops.get_failed_pages(account_id)`, which you add if needed).
7. **Backfill:** the first run on an account treats every mapped URL as new, so it is the backfill. Set `backfill_done=true` once all its URLs are crawled, ignored or failed.

*Done when* AC1–AC3 pass on dev.

### T6: WF-13 · YouTube (dev)
1. Start the run (`WF-13`, `youtube`, mode) and get the due accounts.
2. **Per account:**
   - If `uploads_playlist_id` is missing:
     - `@handle` → `channels.list?part=id,contentDetails&forHandle=@handle`;
     - `/channel/UC…` → `id=UC…`;
     - `/user/x` → `forUsername=x`.
     - Then `ops.set_account_external_id(account_id, UC…, UU…)`. If the channel can't be resolved, add it to the fallback list.
   - `playlistItems.list?part=snippet,contentDetails&playlistId=UU…&maxResults=50`, paginating on `pageToken`. Complete when the last `videoPublishedAt` < cutoff or there is no next page. Max pages: daily 2, backfill 40. The cutoff is as in M04 (watermark − 1 day / `backfill_from`); stop at `watermark_external_id`. Backfill saves `backfill_cursor = {pageToken}` after each page.
   - `videos.list?part=snippet,statistics,contentDetails&id=<≤50 ids>` for the new IDs and for known IDs from the last 30 days on the same page (metrics refresh).
   - Normalize (`youtubeApi.js`).
3. **Fallback list (daily mode):** start an async `streamers~youtube-scraper` run (≤ 20 channels) with `oldestPostDate` = watermark − 1 day and the rest of the input from T1. The WF-19 branch `youtube` does the normalizing. In backfill mode the fallback can also backfill (`oldestPostDate: "2024-01-01"`, `maxResults: 500`), but only with the owner's OK in MA-15, because the add-on cost applies.
4. Ingest → log cost (provider `youtube`, `cost_usd 0`, quantity = quota units, unit `quota_unit`) → Finish the run.
5. **Quota guard:** sum the units used today from `ops.cost_ledger` (provider `youtube`). If the sum is > 8,000 → stop and finish `partial`.

### T7: WF-18 · LinkedIn posts (dev)
1. Start the run (`WF-18`, `linkedin`, mode) and get the due accounts.
2. Chunk: daily ≤ 50, backfill ≤ 10. Daily input per chunk:
   ```json
   {"targetUrls": ["https://www.linkedin.com/company/<slug>/", "…"], "postedLimitDate": "<oldest watermark − 1 day, YYYY-MM-DD>",
    "maxPosts": 50, "includeReposts": true, "includeQuotePosts": true, "scrapeReactions": false, "scrapeComments": false}
   ```
   The backfill input is the same with `"postedLimitDate": "2024-01-01", "maxPosts": 0`.
3. Start async `harvestapi~linkedin-company-posts` runs and register them. **WF-19 branch `linkedin`:** normalize → match by slug → ingest → `backfill_done` when the oldest returned post is ≤ 2024-01-01, or fewer posts came back than a page (the actor returns everything back to the date when `maxPosts=0`, so one backfill run per account is normally enough).

### T8: WF-18b · LinkedIn employees (dev, weekly)
1. Start the run (`WF-18b`, `linkedin_employees`, `weekly`). Get the due accounts for `linkedin_employees`; their cadence must be `7 days` (check M02, and fix it in dev if needed).
2. Start one async run of `harvestapi~linkedin-company-employees` with all companies:
   ```json
   {"companies": ["https://www.linkedin.com/company/<slug>", "…"], "profileScraperMode": "Short ($4 per 1k)",
    "companyBatchMode": "one_by_one", "maxItemsPerCompany": 200, "maxItems": 0}
   ```
   Use whichever `profileScraperMode` value T1 showed is accepted.
3. **WF-19 branch `linkedin_employees`:**
   - Normalize → per company: `ops.save_employee_snapshot(account_id, current_date, people)`, then `report_account_result(success, seen=headcount, new=joined_count)`.
   - A company with 0 people → success with an empty snapshot only if the run succeeded. Otherwise failed.
4. Add the Sunday 05:00 slot to WF-00 (dev).

### T9: Estimate (MA-15) + prod backfill
1. Extend `scripts/estimate-backfill.ts`:
   - **websites:** mapped project URLs per sample site × pilot sites × crawler $/page;
   - **YouTube:** $0;
   - **LinkedIn posts:** posts in the last 90 days per sample company → extrapolate;
   - **employees:** average people per sample company (max 200) × companies × $4/1k + start fees, per week.
2. Post the table. MA-15: the owner approves it and confirms the Firecrawl key is in prod n8n.
3. After approval:
   - apply the migration to prod;
   - create prod copies of WF-21, WF-13, WF-18 and WF-18b, plus the updated WF-19 and WF-00 (only the `backfill_wave` rule enabled for the M05 platforms);
   - run the waves;
   - run WF-18b once manually in prod for the first snapshot;
   - disable the wave when done.

### T10: Daily check (dev, ≥ 3 days)
- Activate the dev daily slots for the M05 platforms on the test accounts.
- Verify idempotency: the second run on the same day inserts 0.
- Verify only new URLs are crawled: day 2 crawls only URLs added since day 1. A test page added to a known site can't be forced, so check on the baseline site if everyone.film publishes something, or check the `new_urls` counts in the logs.

### T11: Export, docs, hand-off
- Export the workflows.
- Update `docs/SCRAPING_SOURCES.md` with the deviations, and `docs/DATA_SCHEMA.md` §5.
- Fill in PROGRESS.
- Open PR `m05-collectors-web-youtube-linkedin`.

## 8. Interfaces & contracts

| Interface | Contract |
|---|---|
| `ops.diff_website_urls(account_id uuid, urls text[]) → text[]` | Returns unseen URLs; touches `last_seen_at` on known URLs |
| `ops.mark_website_page(url text, status text, item_id uuid)` | New |
| `ops.save_employee_snapshot(account_id uuid, snapshot_date date, people jsonb) → jsonb` | New; `people` = `[{public_id, name, title, location}]` |
| `ops.set_account_external_id(account_id, channel_id, uploads_playlist_id)` | From M04 |
| Firecrawl map | `POST /v2/map {url, limit, includeSubdomains:false, sitemap:'include'}` → `links[]` (verify the response shape) |
| YouTube API | `channels.list`, `playlistItems.list`, `videos.list`, all with `key=` (Query Auth credential `YouTube Data API key`) |
| Normalized items | `platform`: `website_work_page`, `youtube`, `linkedin`; `item_type`: `project_page`, `video`/`reel`, `linkedin_post` |

## 9. Acceptance criteria

The SQL is in `scripts/assert/m05.sql`; paste the results.

- **AC1: Website backfill (dev).** For each of the 5 test sites:
  ```sql
  select a.handle, count(*) filter (where p.status='crawled') crawled, count(*) filter (where p.status='ignored') ignored,
         count(*) filter (where p.status='failed') failed, count(*) total
  from app.website_pages p join app.competitor_accounts a on a.id=p.account_id group by 1;
  ```
  `crawled` > 0 for each site with a work page; `failed` ≤ 10% of the total.
- **AC2: Only new URLs.** A second daily run on the same day: `new_urls` = 0 for every site, no crawler run started, and `items_new = 0`.
- **AC3: Project-page quality.** On a manual sample of 20 crawled pages, ≥ 18 are real project or work pages; `media_urls` is filled on ≥ 50% of the pages that embed video; JS-heavy sites produce text ≥ 300 characters after the adaptive retry.
- **AC4: YouTube.** All test channels have `external_id` (UC…) and `uploads_playlist_id` (UU…). The backfill reaches 2024-01-01 or the channel's start. Shorts → `reel`. The second run → 0 new. Quota units are logged and are < 100 for the test set.
- **AC5: LinkedIn posts.** The backfill puts posts since 2024-01-01 in `app.items` (`item_type='linkedin_post'`) for each test company that posts. Reposts carry `payload.is_repost = true`. The second run → 0 new.
- **AC6: Employees.** One `app.employee_snapshots` row per test company. Running WF-18b again on the same day doesn't add a second row:
  ```sql
  select count(*) from app.employee_snapshots group by competitor_id, snapshot_date having count(*)>1
  ```
  returns 0 rows. No forbidden keys are stored:
  ```sql
  select count(*) from app.employee_snapshots, jsonb_array_elements(people) p
  where p ?| array['email','photo','about','skills']
  ```
  returns 0.
- **AC7: Prod backfill.** ≥ 98% of **active** pilot `website_work_page`, `website` (active only for competitors without a work page), `youtube` and `linkedin` accounts are `done` (`backfill_status`). The exceptions are listed with reasons. A first employee snapshot exists for ≥ 95% of pilot LinkedIn companies.
- **AC8: Cost.** The ledger sums by provider (`apify`, `firecrawl`, `youtube`) for the backfill window are within ±30% of the MA-15 estimate, and Apify spend matches `ops.apify_runs.usage_usd`.
- **AC9: Scope and security.** No workflow or actor input requests jobs, reactions, comments, transcripts, cookies or `initialCookies` (grep the exports).

## 10. Tests to write

- **Vitest** contract tests for the 5 new normalizers, including the forbidden-keys test for employees.
- **pgTAP:**
  - `mark_website_page`;
  - `save_employee_snapshot` (first snapshot, diff, idempotent re-save);
  - `diff_website_urls`;
  - grants (`n8n_writer` only).
- **SQL assertions** in `scripts/assert/m05.sql`.
- **Manual:** the WF-21 thin-page retry path; the WF-13 quota guard (set a fake 8,001 units in dev → the run stops `partial`).

## 11. Manual actions from the owner

| ID | What | When | How Codex verifies |
|---|---|---|---|
| MA-08 | YouTube Data API key (restricted to YouTube Data API v3) in n8n | Before T1 (should exist from M02) | `channels.list` → 200 |
| MA-15 | Firecrawl key in n8n (dev + prod); approve the backfill estimate (web, YouTube, LinkedIn posts, first employee snapshot, the weekly employee cost) and the prod migration push | T1 / T9 | Map call → 200; "approved" in PROGRESS |

## 12. Risks & gotchas

- **Website redesigns** change URLs, so every page looks new. If an account's diff returns > 80% new URLs on a daily run (and > 30 URLs), pause the crawl for that account and ask the owner. This guard prevents a surprise re-crawl bill.
- **The canonical-URL rule must never change after the backfill.** Changing it duplicates pages, because `external_id` is the hash of the URL.
- **Website dates** are often missing. Don't invent them; use `null`, plus the `backfill` flag.
- **Firecrawl map limits:** large sites can exceed `limit`. Paths outside the filters are dropped, and that's fine.
- **The YouTube uploads playlist order** isn't documented. The stop rule checks dates, so a wrong order costs at most one extra page.
- **LinkedIn company pages with very few employees** may return 0 people. That's still a success.
- **The `profileScraperMode` value** may need the label string. Verify it in T1.
- **harvestapi employee search is capped at 2,500 per query.** We cap at 200 per company, so headcount displays as "200+" when the cap is reached.
- **Privacy:** never store employee emails, photos or about text, even if the actor returns them (Short mode shouldn't).
- **Never pass cookies to the crawler (D-24).** A login-walled site → the page goes `failed` and the account is noted.

## 13. Cost & budget notes

Starter-tier prices from the research. Pilot account counts: web 48 (+ baseline), YouTube 11, LinkedIn 41 (+ baseline).

| Item | Pilot estimate |
|---|---|
| Firecrawl map, daily (≈ 49 maps × ~$0.00083) | ≈ **$0.04/day** |
| Crawler backfill (~40 pages/site × ~49 sites ≈ 2k pages; cheerio ≈ $0.2/1k, playwright ≈ $5/1k) | **$1–10** one-time |
| Crawler, daily new pages (~3/day) | < **$0.01/day** |
| YouTube Data API | **$0** (≈ 2–3 quota units per channel per day; 11 channels ≈ 33 units) |
| YouTube actor fallback | $3/1k videos + the $1/1k date add-on, failures only |
| LinkedIn posts backfill (~200 posts/company × 42 ≈ 8.4k × $2/1k) | ≈ **$17** |
| LinkedIn posts, daily (~45 results) | ≈ **$0.09/day** |
| LinkedIn employees, weekly (42 companies × ~60 people × $4/1k + 42 × $0.02 start) | ≈ **$11/week** (≈ $1.5/day); the biggest recurring item. Levers: `maxItemsPerCompany` 100, or biweekly (decided in M12) |

**Estimate method:** as in M04. Sample 5 accounts per platform for items over the last 90 days → items/month → extrapolate to 2024-01-01 → × price. Post it in PROGRESS before T9.

## 14. Definition of done & hand-off

- AC1–AC9 pass, with the evidence pasted in PROGRESS.
- Prod copies exist, with the daily slots off.
- The backfill wave is disabled after completion.
- The docs are updated.
- The PR is merged.
- The hand-off lists:
  - accounts failing or invalid;
  - sites that needed playwright;
  - redesign alerts;
  - the YouTube quota per day;
  - the employee cost per week;
  - the `ai_extract` backlog size now.
- Next: **M06** (stories + upkeep).
