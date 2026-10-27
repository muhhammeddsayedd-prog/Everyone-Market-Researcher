# Scraping sources — everyone. Market Radar

Per-platform collection spec. Source research (public actor pages, checked 2026-10-17): `reference/apify_actor_research_2026-10-17.md`.
Binding rules: `docs/DECISIONS.md` (D-07 platforms, D-08 out of scope, D-10 history, D-11 cadence, D-12 only-new, D-24 public data only).
Workflow wiring: `docs/N8N_WORKFLOWS.md`. Writer path and contract: `docs/DATA_SCHEMA.md` §5 and §7, `reference/n8n/normalized_item.schema.json`.

> **Verify before you build.** Actor inputs change between builds. Before wiring a collector, open the actor's `/input-schema` page, run it once on 2 known accounts in the Apify console (dev token), save the raw output to `n8n/normalizers/fixtures/<actor>/` and write the normalizer contract test against that fixture. Record any field that differs from this doc in the milestone PROGRESS.md and update this doc.

---

## 0. Summary

| Platform (account rows) | Primary | Fallback | Watermark method | Cadence |
|---|---|---|---|---|
| Vimeo (`vimeo`) | **Vimeo API** (`/users/{id}/videos`, sort=date desc) | `goat255/vimeo-scraper` (latest 60, daily only); `dltik/vimeo-scraper` only for showcase/channel/group URLs | API cutoff plus 30-day metrics horizon; include known IDs | Daily |
| Instagram posts + reels (`instagram`) | `apify/instagram-scraper` (`resultsType: posts` and a second run `reels`) | — (retry next day; flag account) | Actor filter `onlyPostsNewerThan` = watermark − 1 day; dedupe on shortCode | Daily |
| Instagram stories (`instagram_stories`) | `data-slayer/instagram-stories-scraper` | Pilot bake-off: `igview-owner/instagram-story-viewer`, `louisdeconinck/instagram-story-details-scraper` | Not applicable (24 h window); dedupe on story ID | Daily (12 h if pilot shows misses) |
| Websites (`website` + `website_work_page`) | **Firecrawl `/map`** daily → `ops.diff_website_urls` → `apify/website-content-crawler` on new URLs only | Firecrawl `/scrape` for single URLs | URL diff (set of known URLs) | Daily |
| LinkedIn posts (`linkedin`) | `harvestapi/linkedin-company-posts` | — | Actor filter `postedLimitDate` = watermark date; dedupe on post ID | Daily |
| LinkedIn employees (`linkedin_employees`) | `harvestapi/linkedin-company-employees` (Short mode) | — | Snapshot diff on `publicIdentifier` | Weekly (Sun) |
| YouTube (`youtube`) | **YouTube Data API v3** (uploads playlist) | `streamers/youtube-scraper` (`oldestPostDate`) | API paging stop-on-older-than-watermark + stop-on-known-ID | Daily |
| News & awards (`news`) | **SerpAPI** (`google_news`, `google` with `site:` filters) | — | `published_at` ≥ last run − 7 days; dedupe on URL | Weekly (Sun) |

**Out of scope (D-08):** ad libraries (Meta Ad Library, Google Ads Transparency, TikTok ads) and LinkedIn job postings. TikTok, Facebook, Behance, X, Threads, Snapchat, Pinterest, Dribbble links are stored for reference only and are never scraped. Do not add actors or workflows for them.

**Public data only (D-24):** never pass `initialCookies`, session IDs, passwords, `videoPassword`, logged-in proxies or any account credentials to any actor. If an actor fails without login, the source is disabled for that account (status `invalid`) and logged — it is never "fixed" with a login.

### Common rules for every collector
1. Get due accounts with `ops.get_due_accounts(platform, limit, run_id, mode)`; mode `backfill` for accounts with `backfill_status in ('pending','running')`, else `daily`.
2. **Overlap window:** request from `watermark_published_at − 1 day` (catches late-indexed posts); duplicates are free to drop because `ingest.upsert_raw_items` is `ON CONFLICT DO NOTHING`. Metrics of overlapping known items update as a side effect. Metrics refresh policy (FR-S4): free APIs (Vimeo, YouTube) refresh the last 30 days daily; paid sources (Instagram, LinkedIn) refresh weekly through the WF-40 30-day listing that also runs the removal check (`removal_window_days_paid` = 30).
3. **API traversal:** include known IDs while refreshing the required 30-day metrics horizon. A known watermark ID alone must not suppress that refresh. Stop only once the applicable cutoff/metrics horizon is crossed, the source is exhausted, or the bounded page cap is reached; a cap is incomplete, not proof of exhaustion.
4. Normalize with the platform normalizer (`SUB · Normalize <platform>`, JS in `docs/N8N_WORKFLOWS.md` §7) → call `SUB · Ingest items` per account (≤ 500 items per RPC call).
5. Report each account with `ops.report_account_result(...)`; log provider cost with `ops.log_cost(...)` (Apify: run `usageTotalUsd` split evenly across the run's accounts unless the actor returns per-input counts).
6. Timestamps are stored UTC (`timestamptz`); convert actor strings explicitly (formats per actor below).
7. Handles are stored lowercase without `@`; URLs canonical (https, no query string, no trailing tracking params; keep trailing slash as the platform emits it).

---

## 1. Vimeo

### 1.1 Primary — Vimeo API (official)
- **Auth:** personal access token with `public` scope (owner creates a Vimeo developer app — manual action MA-07 in M02). Header `Authorization: bearer <VIMEO_TOKEN>`, `Accept: application/vnd.vimeo.*+json;version=3.4`.
- **Resolve once (M02/M04):** for each `vimeo` account, `GET https://api.vimeo.com/users/{vanity}?fields=uri,name,link` → numeric id from `uri` (`/users/123456`) → store in `competitor_accounts.external_id`, `resolve_status='resolved'`. A URL like `vimeo.com/channels/x`, `/showcase/…`, `/groups/…` or `vimeo.com/user123` is handled: `/channels/{id}/videos`, verified owner-scoped `/users/{owner}/albums/{id}/videos` (showcase), `/groups/{id}/videos`; record endpoint, resourcePath and next page in the cursor. A showcase without a verified owner path fails explicitly.
- **List (daily and backfill):**
  ```
  GET https://api.vimeo.com/users/{external_id}/videos
      ?sort=date&direction=desc&per_page=100&page={n}
      &fields=uri,name,description,link,created_time,release_time,duration,pictures.sizes,tags.name,stats.plays,metadata.connections.likes.total,metadata.connections.comments.total,privacy.view,user.name,user.link
  ```
  - Daily: page1..3, include public items within the overlap cutoff or the last30days metrics horizon. Do not stop merely at a known ID. Stop after the older applicable horizon, exhaustion or the page cap; report incomplete traversal explicitly.
  - Backfill: page until `release_time < backfill_from` (2024-01-01) or `paging.next` is null. Save `{endpoint, resourcePath, page}` in `backfill_cursor` at a successful bounded page boundary. Resume only when endpoint/resourcePath match the current account; never skip pages using a foreign cursor. Ambiguous failed attempts require reconciliation rather than a guessed checkpoint.
  - Skip `privacy.view` not in (`anybody`, `unlisted`?) → **only `anybody`** (public data only).
- **Rate limits:** respect `X-RateLimit-Remaining`; when < 10, Wait until `X-RateLimit-Reset`. HTTP 429 → wait 60 s, retry (max 3). Current official guidance was checked26October2026; see the implementation note below. Bound total waits to10minutes/account and stop on quota/access failure; never use scraping to evade a rate limit or access restriction.
- **Cost:** free (cost ledger row with `cost_usd = 0`, `quantity = calls` for visibility).

| Vimeo API field | Normalized field |
|---|---|
| `uri` → last path segment | `external_id` |
| constant | `platform: "vimeo"`, `actor: "vimeo-api"`, `item_type: "video"` |
| `link` | `url` |
| `release_time` ?? `created_time` (ISO) | `published_at` |
| `name` | `title` |
| `description` | `caption` (also copied to `credits_text` — Vimeo descriptions usually carry credits) |
| `tags[].name` | `hashtags` (lowercased) |
| — | `mentions`: `@handles` parsed from description |
| `duration` | `duration_seconds` |
| `pictures.sizes` largest width ≤ 1280 → `link` | `thumbnail_url` |
| `stats.plays`, `metadata.connections.likes.total`, `metadata.connections.comments.total` | `metrics.plays`, `metrics.likes`, `metrics.comments` |
| Metadata-only field projection (no download URLs/files or unknown nested data) | `payload` |

### 1.2 Fallback — `goat255/vimeo-scraper` (daily only)
Planned daily fallback for an otherwise public account whose API access is unavailable; verify public accessibility and the approved source conditions first. Never use fallback to evade private/login/access controls or rate limits. It is not enabled by the first M04 slice. **Returns at most the latest 60 videos per user — cannot backfill.** No date filter: filter client-side.

Daily input (batch up to 50 users per run):
```json
{ "videoUrls": [], "users": ["https://vimeo.com/handle1", "https://vimeo.com/handle2"],
  "maxVideosPerUser": 20, "includeProfile": false, "concurrency": 5 }
```
`videoUrls: []` is required (the default would scrape a sample video). `maxVideosPerUser: 20` is enough for daily; raise to 60 after an outage.

| goat255 field | Normalized |
|---|---|
| `id` | `external_id` |
| `url` | `url` |
| `uploadDate` (`"YYYY-MM-DD HH:mm:ss"`, treat as UTC) | `published_at` |
| `title` / `description` | `title` / `caption` + `credits_text` |
| `tags` | `hashtags` |
| `duration` (s) | `duration_seconds` |
| `thumbnail` | `thumbnail_url` |
| — (no stats) | `metrics: {}` |
| `ownerUrl` | used to match the account (input order not guaranteed) |

Client-side filter: keep `published_at ≥ watermark − 1 day`; drop rows with `type = "profile"`.

### 1.3 Special case — `dltik/vimeo-scraper`
Only for accounts whose URL is a **showcase, channel or group** that the API cannot list (rare). Input `{ "urls": ["https://vimeo.com/channels/x"], "maxResults": 50 }`. Fields: `id, url, title, upload_date ("YYYYMMDD"), view_count, like_count, thumbnail, tags, duration`. **Never use its download URLs** (D-19). Price conflict ($0.50 vs $2 per 1k) — budget $2/1k.

---

### 1.4 M04 implementation verification — 26 October 2026

The first slice implements the official API in `n8n/collectors/vimeo.mjs` and a local lifecycle in `vimeo-run.mjs`. Transport is injected; native HTTP credential binding, restricted M04 gateway operations and live provider fixtures remain pending. Fallback normalizers exist, but no actor is started. Tests use synthetic source examples and do not establish live coverage or an approved spend.

Primary sources: [Vimeo common formats](https://developer.vimeo.com/api/common-formats), [rate limiting](https://developer.vimeo.com/guidelines/rate-limiting), [API reference](https://developer.vimeo.com/api/reference), [native n8n HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/), [goat255 actor](https://apify.com/goat255/vimeo-scraper), [dltik actor](https://apify.com/dltik/vimeo-scraper). The native adapter must preserve strict TLS, reject redirects and bound response size/time. The Vimeo helper uses Node's URL API; it is not yet a verified Cloud Code paste-in.

## 2. Instagram posts and reels — `apify/instagram-scraper`

- Profiles are batched: **up to 50 `directUrls` per run** (one run per 50 accounts). `resultsLimit` is per URL.
- Two runs per batch per day during the pilot: `resultsType: "posts"` and `resultsType: "reels"`. Both dedupe on `shortCode` (same `external_id`) in the DB. **Pilot measurement (M06/M12):** overlap % = reels-run items already captured by the posts run. If overlap ≥ 95% for 7 days, drop the reels run (decision recorded in DECISIONS → Changes).
- Watermark: `onlyPostsNewerThan` = `(watermark_published_at − 1 day)` as `YYYY-MM-DD`; with a batch of accounts, use the **oldest** watermark in the batch (the DB drops the duplicates). Group accounts with similar watermarks into the same batch to limit wasted results.
- `skipPinnedPosts: true` (pinned posts ignore the date filter).

Daily input:
```json
{
  "directUrls": ["https://www.instagram.com/handle1/", "https://www.instagram.com/handle2/"],
  "resultsType": "posts",
  "resultsLimit": 30,
  "onlyPostsNewerThan": "2026-10-15",
  "skipPinnedPosts": true,
  "addParentData": false
}
```
Backfill input (one profile per run or ≤ 10 per run; async with webhook, see N8N §4):
```json
{
  "directUrls": ["https://www.instagram.com/handle1/"],
  "resultsType": "posts",
  "resultsLimit": 1500,
  "onlyPostsNewerThan": "2024-01-01",
  "skipPinnedPosts": true
}
```
Run the same with `"resultsType": "reels"` only after its complete dev-batch estimate is approved.

M04 source check26October2026: the [current input schema](https://apify.com/apify/instagram-scraper/input-schema) supports reels; the [actor documentation](https://apify.com/apify/instagram-scraper) describes date/pinned-post filtering for posts. Equivalent reels guarantees are unverified. The local adapter filters reels by date and reports `reels_backfill_exhaustion_unverified`; it does not mark reels backfill complete from a short result page. Posts/reels share account ownership and must use the complete reviewed secondary/settlement path before native execution. Current fixtures are explicitly synthetic.

| instagram-scraper field | Normalized |
|---|---|
| `shortCode` | `external_id` |
| `url` (else `https://www.instagram.com/p/{shortCode}/`) | `url` |
| `timestamp` (ISO) | `published_at` |
| — | `title: null` |
| `caption` | `caption` |
| `hashtags` | `hashtags` (lowercase) |
| `mentions` | `mentions` (lowercase, no @) |
| `taggedUsers[].username` + `coauthorProducers[].username` | `tagged_accounts` |
| `videoDuration` (s, round) | `duration_seconds` |
| `displayUrl` (else `images[0]`) | `thumbnail_url` |
| `likesCount` (−1 → null), `commentsCount`, `videoViewCount` ?? `videoPlayCount` ?? `igPlayCount`, `reshareCount` ?? `sharesCount` | `metrics.likes`, `.comments`, `.views`, `.shares` |
| `ownerUsername` | account match (lowercase) |
| whole object | `payload` |

**item_type rules:**
| Source | item_type |
|---|---|
| `type = "Sidecar"` | `carousel` |
| `type = "Video"` and (`productType = "clips"` or run was `reels`) | `reel` |
| `type = "Video"` otherwise | `video` |
| `type = "Image"` | `post` |

**Quirks:** private profiles return an error item (`error`, `errorDescription`) → mark account `invalid` after 3 runs. Rows with `error` are never ingested. Counts are logged-out snapshots. `paidPartnership`, `sponsors` → keep in payload; the AI uses them as brand evidence.

---

## 3. Instagram stories

Stories exist only 24 h; there is **no backfill** (D-10). One `instagram_stories` account row per Instagram account. Schedule 06:00 Cairo daily; switch on the 18:00 run (`ops.settings.stories_twice_daily = true`) if the pilot shows stories posted and expired between runs (measured by comparing `taken_at` distribution).

### 3.1 Primary — `data-slayer/instagram-stories-scraper`
No login, no cookies. Input (batch up to 100 usernames):
```json
{ "usernames": ["handle1", "handle2"] }
```
| data-slayer field | Normalized |
|---|---|
| `id` (else `code`) | `external_id` |
| `story_permalink` (else `https://www.instagram.com/stories/{username}/{id}/`) | `url` |
| `taken_at_ts` (Unix s) → ISO, else `taken_at_date` | `published_at` |
| `caption_text` | `caption` |
| `reel_mentions[].user.username` (shape unverified; also parse `@` in caption) | `mentions` |
| `story_link_url` | appended to `media_urls` |
| `is_video` / `media_type` | `item_type: "story"` always |
| `video_duration` | `duration_seconds` |
| `thumbnail_url` ?? `image_versions` first `url` | `thumbnail_url` |
| — | `metrics: {}` (no public metrics) |
| `creator_username` ?? `username` | account match |

Rows with `status` / `stories_count` and no `id` are per-user summary rows ("no stories") → count as success with 0 items. Media URLs are signed and expire: WF-31 must save the thumbnail **within the same day**.

### 3.2 Bake-off (pilot, M06)
Run all three on the same 20 pilot accounts for 7 days (once a day, same hour). Compare: stories found, missing vs. union, fields (mentions/stickers), failures, cost per 1k. Pick the winner by coverage, then cost; record in DECISIONS → Changes.
- `igview-owner/instagram-story-viewer`: input `{ "usernames": ["handle1", "handle2"] }` (schema says `usernames` array 1–50; README shows legacy `username` string — test both). Output `story_id`, `taken_at` (Unix s), `image_url`, `image_thumbnail`, `video_url`, `mentions[]` (`username`, position). $5/1k + start fee; $20/1k on the Free plan.
- `louisdeconinck/instagram-story-details-scraper`: **paid Apify plan only**; priced per **profile** ($7–10/1k profiles, page header says from $17/1k), not per story. Input `{ "usernames": ["zuck"] }`. Output raw IG media: `pk`, `code`, `taken_at`, `expiring_at`, `image_versions2.candidates[0].url`, `video_versions`, `user.username`. No cookies even though a field description mentions them.

---

## 4. Websites

Two account rows per competitor: `website` (root domain, used for the URL map) and `website_work_page` (the "Our work / Portfolio" URL from the sheet, when present).

### 4.1 Daily diff — Firecrawl `/map` → DB diff
```
POST https://api.firecrawl.dev/v2/map        (verify current version path)
Authorization: Bearer <FIRECRAWL_API_KEY>
{ "url": "https://competitor.com/work/", "limit": 500, "includeSubdomains": false, "sitemap": "include" }
```
- If the account is `website_work_page`: map that URL and keep links that start with the work-page path (e.g. `/work/`, `/projects/`, `/portfolio/`).
- If only `website` exists: map the root and keep URLs matching globs `**/work/**`, `**/works/**`, `**/project*/**`, `**/portfolio/**`, `**/case-stud*/**`, `**/films/**`, `**/campaigns/**`, `**/clients/**`, `**/news/**`, `**/blog/**`, `**/ar/**` variants of the same. Exclude `**/tag/**`, `**/category/**`, `**/page/**`, `**/*.jpg|png|pdf`, `**/wp-json/**`, `**/feed/**`.
- Canonicalize (lowercase host, strip query/fragment, strip trailing slash consistently) → `ops.diff_website_urls(account_id, urls[])` returns **only unseen URLs**.
- If the map returns 0 URLs for 3 days → account `failing` (site redesign or block).

### 4.2 Crawl new pages — `apify/website-content-crawler`
Only the new URLs, no link following:
```json
{
  "startUrls": [{ "url": "https://competitor.com/work/new-project/" }],
  "crawlerType": "cheerio",
  "maxCrawlDepth": 0,
  "maxCrawlPages": 50,
  "saveMarkdown": true,
  "htmlTransformer": "readableText",
  "removeCookieWarnings": true,
  "respectRobotsTxtFile": true,
  "proxyConfiguration": { "useApifyProxy": true }
}
```
- Batch: all new URLs of all accounts in one run (≤ 200 start URLs).
- If a page returns < 300 chars of text (JS-rendered site), re-run that URL with `"crawlerType": "playwright:adaptive"`; remember per account (`backfill_cursor.crawler = "playwright:adaptive"`) and use it directly next time.
- Never pass `initialCookies` (D-24).
- **Backfill:** run the map once with `limit: 2000`, insert all URLs (they are all "new"), crawl them in batches of 200 (async with webhook). Website pages have no reliable publish date → `published_at` = date found in page metadata (`metadata.openGraph` `article:published_time`, JSON-LD `datePublished`, or a date pattern near the title) else `null` and `first_seen_at` is used for ordering. For the backfill, pages with no date are kept but flagged `payload.backfill = true` so the feed does not show them as "new today".

| website-content-crawler field | Normalized |
|---|---|
| canonical `metadata.canonicalUrl` ?? `url` → sha256 (hex, first 32) | `external_id` |
| `url` | `url` |
| date extraction (see above) | `published_at` |
| `metadata.title` (strip " – Site name") | `title` |
| `markdown` ?? `text` (max 8,000 chars) | `caption` |
| section after "Credits"/"Director"/"Client" headings, if found | `credits_text` |
| Vimeo/YouTube URLs found in `html`/`markdown` (iframes, links) | `media_urls` (links the page to platform items) |
| `metadata.openGraph` `og:image` | `thumbnail_url` |
| constant | `platform: "website_work_page"`, `item_type: "project_page"`, `actor: "apify/website-content-crawler"`, `metrics: {}` |

After ingest, `ops.mark_website_page(url, 'crawled', item_id)`; non-project pages (privacy, contact) → `ignored` by a simple rule (title/URL keywords) or by the AI (`is_commercial_work = false`, `content_type = other`).

---

## 5. LinkedIn

### 5.1 Company posts — `harvestapi/linkedin-company-posts`
No cookies. Batch **up to 50 `targetUrls` per run** (actor processes 6 targets concurrently).

Daily input:
```json
{
  "targetUrls": ["https://www.linkedin.com/company/slug1/", "https://www.linkedin.com/company/slug2/"],
  "postedLimitDate": "2026-10-15",
  "maxPosts": 50,
  "includeReposts": true,
  "includeQuotePosts": true,
  "scrapeReactions": false,
  "scrapeComments": false
}
```
Backfill input (≤ 10 targets per run, async):
```json
{ "targetUrls": ["https://www.linkedin.com/company/slug1/"], "postedLimitDate": "2024-01-01", "maxPosts": 0,
  "includeReposts": true, "includeQuotePosts": true, "scrapeReactions": false, "scrapeComments": false }
```
Decision: **include reposts and quote posts**, but mark them (`payload` keeps the flag; normalizer sets `tagged_accounts` to the original author and the AI treats a repost of a client's post as brand evidence, not as the competitor's own work unless credits say so). `maxPosts: 50` is a daily cost guard. `0-result query` events cost $1/1k — negligible.

| harvestapi posts field | Normalized |
|---|---|
| `id` | `external_id` |
| `linkedinUrl` ?? `socialContent.shareUrl` | `url` |
| `postedAt.date` (ISO) else `postedAt.timestamp` (ms) | `published_at` |
| — | `title: null` |
| `content` | `caption` |
| `#tags` parsed from `content` | `hashtags` |
| `@`-mentions parsed from `content` (LinkedIn mentions appear as names; keep raw) | `mentions` |
| original author of a repost (`author.name` when ≠ company) | `tagged_accounts` |
| `postImages[0].url` ?? `document.coverPages[0]` ?? video thumbnail (field name unverified, e.g. `postVideo.thumbnailUrl`) | `thumbnail_url` |
| `engagement.likes` ?? sum(`engagement.reactions[].count`), `engagement.comments`, `engagement.shares` | `metrics.likes`, `.comments`, `.shares` |
| constant | `platform: "linkedin"`, `item_type: "linkedin_post"`, `actor: "harvestapi/linkedin-company-posts"` |
| `author.universalName` / `author.linkedinUrl` | account match |

Quirk: the README sample is a profile post; company output may differ slightly — capture a real fixture first.

### 5.2 Company employees — `harvestapi/linkedin-company-employees` (weekly)
No cookies. Snapshot of who lists the company as current employer — a growth/hiring signal (LinkedIn **job postings are out of scope**, D-08).
```json
{
  "companies": ["https://www.linkedin.com/company/slug1", "https://www.linkedin.com/company/slug2"],
  "profileScraperMode": "Short ($4 per 1k)",
  "companyBatchMode": "one_by_one",
  "maxItemsPerCompany": 200,
  "maxItems": 0
}
```
- Pass the **display label** for `profileScraperMode` (stored enum values were not visible; verify on first run).
- `one_by_one` charges a start fee per company ($0.015–0.02) — acceptable weekly.
- Output per person (keep only): `publicIdentifier`, `firstName` + `lastName`, `headline`, `currentPosition[0].position` (title), `location.linkedinText`. **Do not store emails, photos, about, skills** (privacy, PRD §7).
- WF-18b calls `ops.save_employee_snapshot(account_id, snapshot_date, people)`, which stores the snapshot and computes `joined` / `left_company` vs. the previous snapshot by `publicIdentifier`. Headcount = people returned (capped at 200 → shown as "200+").
- Not an item: snapshots are not sent through `ingest.upsert_raw_items`. Notable joiners (titles matching Director, Head, Executive Producer, DOP, Creative Director) feed the weekly brief.

---

## 6. YouTube

### 6.1 Primary — YouTube Data API v3 (official key)
- **Resolve once (M02/M05):** `GET https://www.googleapis.com/youtube/v3/channels?part=id,contentDetails&forHandle=@handle&key=…` (1 unit). For `/channel/UC…` URLs use `id=UC…`; for `/c/name` or `/user/name` try `forUsername`, else resolve via the actor once. Store `external_id = UC…`, `uploads_playlist_id = contentDetails.relatedPlaylists.uploads` (UU…).
- **List:** `GET …/playlistItems?part=snippet,contentDetails&playlistId=UU…&maxResults=50&pageToken=…` (1 unit/page). Newest first in practice (not documented — the stop rule also checks dates, so order bugs only cost an extra page). Stop at `contentDetails.videoPublishedAt < watermark − 1 day` or `videoId = watermark_external_id`. Backfill: page until `< 2024-01-01`.
- **Stats:** `GET …/videos?part=snippet,statistics,contentDetails&id=<≤50 ids>` (1 unit) for new + last-30-day items.
- **Quota:** ~2–3 units per channel per day → 128 channels ≈ 400 units/day of 10,000. Never use `search.list` (separate 100/day cap).

| YouTube API field | Normalized |
|---|---|
| `contentDetails.videoId` | `external_id` |
| `https://www.youtube.com/watch?v={id}` | `url` |
| `contentDetails.videoPublishedAt` | `published_at` |
| `snippet.title` | `title` |
| `snippet.description` | `caption` (+ `credits_text`) |
| `snippet.tags` (videos.list) | `hashtags` |
| `contentDetails.duration` (ISO 8601 `PT1M30S` → seconds) | `duration_seconds` |
| `snippet.thumbnails.maxres ?? high ?? medium .url` | `thumbnail_url` |
| `statistics.viewCount`, `likeCount`, `commentCount` | `metrics.views`, `.likes`, `.comments` |
| duration ≤ 60 s (or `/shorts/` URL) → `reel`, else `video` | `item_type` |
| constant | `platform: "youtube"`, `actor: "youtube-api"` |

### 6.2 Fallback — `streamers/youtube-scraper`
When the API key is missing/over quota or a channel can't be resolved.
```json
{ "startUrls": [{ "url": "https://www.youtube.com/@handle/videos" }],
  "oldestPostDate": "2026-10-15", "sortVideosBy": "NEWEST",
  "maxResults": 50, "maxResultsShorts": 20, "maxResultStreams": 0,
  "transcriptionAndSubtitle": "NONE", "aiVideoDescription": false, "aiVideoSummary": false }
```
- `oldestPostDate` adds the date-range add-on ($0.60–1.30/1k). Keep transcripts and AI add-ons **off** (D-08 no transcription).
- Error item `DATE_FILTER_TOO_STRICT` = **no new videos** → success with 0 items. `CHANNEL_DOES_NOT_EXIST` → account `invalid`.
- Mapping: `id`→external_id, `url`, `date`→published_at, `title`, `text`→caption, `hashtags`, `duration` ("HH:MM:SS"→s), `thumbnailUrl`, `viewCount`/`likes`/`commentsCount`→metrics, `type` (`shorts`→reel, else video).

---

## 7. News and awards — SerpAPI (weekly)

Not social scraping (D-09). Sunday 07:00 Cairo. Results go to `app.news_articles` + `app.news_mentions` via `ops.upsert_news(articles)` (not via `upsert_raw_items`).

Queries:
1. **Per competitor (news):** `engine=google_news`, `q="<competitor name>"` (+ Arabic name when known), `gl=eg|sa|ae` by HQ market, `hl=en` (and a second `hl=ar` run for Arabic names). Pilot: 50 + baseline; scale: 284. Keep results with `date` in the last 8 days (first run: since 2024-01-01 where the engine returns it; Google News returns ~100 recent results, so backfill depth is limited — accepted).
2. **Per top brand (news):** top 30 brands by item count in the last 90 days: `q="<brand> commercial OR campaign OR إعلان"`.
3. **Awards / trade (`engine=google`):** one query per site per week: `site:adsoftheworld.com (Egypt OR Saudi OR UAE OR Dubai OR Riyadh OR Cairo)`, same for `lbbonline.com`, `campaignme.com`, `dubailynx.com`, `effie-mena.com` (verify domain), `shots.net`, `arabad.net`, `arabianbusiness.com`, with `tbs=qdr:w` (past week). Then match titles/snippets to competitor names/aliases and brands.

Normalizer: `link`→`url` (unique), `title`, `source.name` ?? `source`→`source_name`, `date` (SerpAPI returns relative/absolute strings; parse with `iso_date` when present)→`published_at`, `snippet`, `kind = 'award'` for award-site queries else `'news'`, `query` stored. Mentions resolved by exact alias match on competitor names and `org_aliases`; unmatched articles from competitor queries are still linked to that competitor.

Cost: 1 search = 1 SerpAPI credit (~$0.015 on the default plan — confirm the owner's plan in M13).

---

## 8. Cost estimates (verify in the pilot)

Prices: Apify **Starter** tier from the research report (Free tier is more expensive, Scale/Business cheaper). OpenAI cost is separate (`docs/AI_PIPELINE.md`). Volumes are assumptions until the pilot measures them; the cost ledger replaces them.

Assumptions per account per day: Instagram 0.4 posts + overlap ≈ 1 result/run × 2 runs; stories 1.5/day; LinkedIn 0.3 posts + overlap ≈ 1 result; Vimeo/YouTube via official APIs (free); websites 0.05 new pages; LinkedIn employees avg 60 profiles/company/week (cap 200).

### Daily (steady state)
| Source | Pilot (195 primary accts) | All 284 (≈1,070 primary accts; 1,272 rows incl. 199 work pages + baseline) |
|---|---|---|
| IG posts + reels (`$2.30/1k results`) | 48 × 2 ≈ 100 results → **$0.23** | 255 × 2 ≈ 510 → **$1.17** |
| IG stories data-slayer (`$2.17/1k` + $0.0005/start) | ~75 stories → **$0.17** | ~380 → **$0.83** |
| LinkedIn posts (`$2/1k`) | ~45 → **$0.09** | ~230 → **$0.46** |
| LinkedIn employees weekly (`$4/1k` short + $0.02/start), per day | 41 × 60 / 7 ≈ 350 → **$1.52** | 225 × 60 / 7 ≈ 1,930 → **$8.36** |
| Websites: Firecrawl map (1 credit/map, ~$0.00083) + crawler (~$0.2–2/1k pages) | 48 maps + ~3 pages → **$0.05** | 260 maps + ~15 pages → **$0.25** |
| Vimeo API / YouTube API | **$0** | **$0** |
| SerpAPI weekly, per day (51 + 30 brands + 8 award queries ≈ 90/wk ×2 lang for comps) | ~140/wk → **$0.30** | ~620/wk → **$1.33** |
| **Total scraping/day** | **≈ $2.4** | **≈ $12.4** |
| Fallback spikes (goat255 60 videos/user ≈ $0.033/user; YouTube actor $3/1k) | only on API failure | only on API failure |

LinkedIn employees dominate. Levers: `maxItemsPerCompany` 100, or bi-weekly — owner decision after the pilot.

### One-time backfill (from 2024-01-01)
| Source | Pilot | All 284 |
|---|---|---|
| IG posts + reels (~450 results/account incl. reels overlap) | 48 × 450 = 21.6k → **≈ $50** | 255 × 450 = 115k → **≈ $265** |
| LinkedIn posts (~200/account) | 41 × 200 = 8.2k → **≈ $16** | 225 × 200 = 45k → **≈ $90** |
| Websites (~40 pages/site; cheerio ≈ $0.2/1k, playwright ≈ $5/1k) | ~2k pages → **$1–10** | ~10k pages → **$5–50** |
| Vimeo / YouTube API | $0 | $0 |
| **Total** | **≈ $70–80** | **≈ $360–410** |

Backfill runs in waves (10 accounts per platform per hourly slot, 10:00–23:00 Cairo ≈ 140 accounts per platform per day) so the daily budget alert (`ops.settings.daily_budget_usd`) can stop it — set the budget to $150 during backfill days and $25 after.

---

## 9. Health checks

M04 integration27October: representative collection is accepted and safely
closed; see the current milestone's actual source and cost receipts. The
private callback path attests actual run `userId` against a pinned
non-secret owner ID, actor/build IDs, configured memory/timeout/charge/result
options and the original public INPUT before ingestion. Input defaults require
explicit build review; credential/download/transcription fields are rejected
at every nesting level. Two authenticated terminal snapshots at least ten
seconds apart must agree before logging usage. `maxItems` equality proves the
configured parameter, **not** an actual PPE output/spend cap; independent
result bounds and `maxTotalChargeUsd` remain required. Provider fields/defaults
and native behavior must be verified during the proposed preflight before any
paid start. Missing/unexpected metadata fails closed.

One fixed500-row dataset page per gateway call preserves the real raw offset
(`skipHidden=true`, without row-filtering query switches). Excess approved
output is contained as a failed empty ingestion result with actual cost retained.
Matched valid old public content is success with zero selected items; absence
of account/collection ownership is not. Dltik uploader identity alone does not
prove collection membership, and a short representative run/reels response
does not establish full backfill. Native fallback and pinned-post/reels source
coverage remain live-only gaps; the closed representative packet approved no fallback.

Post-sample source review27October: Vimeo cursors retain the original page
width and resource path; resumed legacy pages without that width fail closed.
An empty page with a next-page link is a contract failure, not history progress.
The maintained daily path includes known IDs for thirty-day metric upserts and
reports a daily page cap as incomplete. Instagram daily INPUT is deterministic
from the claimed watermark minus thirty days; normalization uses the trusted
launch timestamp. Its result cap can leave daily coverage incomplete. The
current [Instagram input schema](https://apify.com/apify/instagram-scraper/input-schema)
and [actor documentation](https://apify.com/apify/instagram-scraper) provide no
verified upper-date/historical cursor. Count escalation remains latest-page
retrieval; 3,000-result saturation stops further starts and never proves reels
exhaustion. The callback persists that limitation using conservative batch raw
counts because stored per-account counts are normalized. Current primary
[Vimeo pagination formats](https://developer.vimeo.com/api/common-formats)
and the actor schema were checked for this local implementation. New native
source cases remain gated by the one incremental dev packet.

| Check | Rule | Action |
|---|---|---|
| Account freshness | `last_success_at` older than 48 h (daily) / 9 days (weekly) | Listed in WF-91 health email |
| Consecutive failures | ≥ 3 → `status = 'failing'` (in `ops.report_account_result`) | Health email; admin page badge |
| Zero-items streak | Active account with 0 new items for 30 days while its competitor posts elsewhere | Health email ("check handle") |
| Actor contract drift | Normalizer validation fails (missing `external_id`/`published_at`) for > 20% of a run | Run marked `partial`, WF-90 email with sample payload |
| Login wall | Actor error mentions login/challenge/checkpoint | Account `invalid`, never retried with credentials (D-24) |
| Private account | IG `private: true` / error "private" | Account `invalid` |
| API quota | YouTube quota > 80% or Vimeo `X-RateLimit-Remaining` low | Wait/retry next day; switch to fallback only if > 2 days |
| Cost anomaly | Run cost > 3× its 7-day average | WF-91 flags; budget alert if daily total > budget |
| Story capture gap | Stories with `taken_at` > 18 h before capture | Suggest `stories_twice_daily = true` |
