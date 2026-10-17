# Apify actors and official APIs: research report (checked 2026-10-17)

## How this was checked
- **Sources:** each actor's public apify.com pages: the README, `/input-schema`, `/output-schema` and `/pricing`. No sign-in was used.
- **What could not be reached:** the Apify REST API (`api.apify.com`) is blocked from this environment. So build JSON, prefill values and editor types were not available.
- **Field names:** the `/input-schema` pages are the most reliable source, because they show the current build's JSON keys. Where a README disagrees with the schema, both are given.
- **Markings:** "unverified" means a public page did not confirm the item. "Conflict" means two pages on the same actor disagree.
- **Prices:** shown per 1,000 events unless stated. The four Apify plan tiers are Free ($0/mo, $5 credit), Starter ($19), Scale ($199) and Business ($999).

---

## Summary

| # | Actor | Pricing model | Built-in "newer than" filter | Needs login/cookies | Rating (count) / last modified |
|---|---|---|---|---|---|
| 1 | goat255/vimeo-scraper | Pay per event: $0.50–0.58 per 1k videos | **No** (at most the latest 60 per user) | No | 0.0 (0) / ~2026-09-05 |
| 2 | dltik/vimeo-scraper | Pay per event: $0.50 per 1k (conflict: README says $2 per 1k) | **No** | No (password field only for protected videos) | 0.0 (0) / ~2026-06-28 |
| 3 | apify/instagram-scraper | Pay per result: $1.50–2.70 per 1k | **Yes**: `onlyPostsNewerThan` | No | 4.7 (602) / hours ago |
| 4 | data-slayer/instagram-stories-scraper | Pay per result: $1.50–2.50 per 1k, plus $0.0005 per start | No (stories are only the live last 24h) | **No** ("No cookies. No login") | 5.0 (1) / 8 days ago |
| 5 | igview-owner/instagram-story-viewer | Pay per event: $5 per 1k on paid plans ($20 per 1k on Free), plus a $0.01–0.05 start fee | No (24h) | **No** | 4.7 (5) / ~1 month ago |
| 6 | louisdeconinck/instagram-story-details-scraper | Pay per event: per **profile**, $7–10 per 1k, plus a start fee; paying Apify users only | No (24h) | **No** (cookies optional, unverified) | 4.2 (8) / 22 days ago |
| 7 | apify/website-content-crawler | Pay per usage (compute units) | Partly: `onlyCrawlPagesModifiedSince` (experimental) | No (optional `initialCookies`) | 4.6 (235) / 2026-10-15 |
| 8 | harvestapi/linkedin-company-employees | Pay per event: $1.50–12 per 1k profiles, plus $0.015–0.02 per start | **No** (people, not dated items) | **No** | 4.0 (49) / 10 days ago |
| 9 | harvestapi/linkedin-company-posts | Pay per event: $1.50–2 per 1k posts | **Yes**: `postedLimitDate` / `postedLimit` | **No** | 5.0 (21) / 21 days ago |
| 10 | streamers/youtube-scraper | Pay per event: $2.40–4 per 1k videos, plus a date-range add-on | **Yes**: `oldestPostDate` (channel URLs only) | No | 4.8 (196) / hours ago |

---

## 1. goat255/vimeo-scraper

- **ID / title:** `goat255/vimeo-scraper`, "Vimeo Scraper". Internal ID `PjP9s7Jpwa3w0tNV4`. Developer: Goutam Soni (community).
- **Usage:** 6 users in total, 1 monthly active. Rating 0.0 (0 ratings).
- **Pricing:** pay per event.

| Event | Free | Starter | Scale | Business |
|---|---|---|---|---|
| Video (primary) | $0.58 / 1k | $0.55 / 1k | $0.53 / 1k | $0.50 / 1k |
| Actor start | $0.00115 | $0.0011 | $0.00105 | $0.001 |

Platform usage is included.

### Input (from `/input-schema`; all fields optional)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `videoUrls` | array of strings | `["https://vimeo.com/76979871"]` | Video URLs or numeric IDs ("video mode") |
| `users` | array of strings | `["staff"]` | Usernames or profile URLs, e.g. `staff` or `https://vimeo.com/staff` ("channel mode") |
| `maxVideosPerUser` | integer, 1–60 | 60 | Cap per user. Values above 60 return the same 60. |
| `includeProfile` | boolean | true | Adds one `type:"profile"` row per user before that user's videos |
| `concurrency` | integer, 1–20 | 5 | Sources processed in parallel |
| `proxyConfig` | object | `{"useApifyProxy": false}` | Optional. The page says no proxy is needed. |

- There is no date filter, no sort option and no cookie input. No login or API key is needed.
- Because the defaults are non-empty, send `videoUrls: []` when you only want user mode. Otherwise the default video is also scraped (inferred from the defaults, not tested).

### Output

| Row type | Keys |
|---|---|
| Video (`type:"video"`) | `type`, `id`, `url`, `ownerName`, `ownerUrl`, `ownerId`, `title`, `description`, `tags`, `thumbnail`, `duration` (seconds), `width`, `height`, `fps`, `uploadDate` (e.g. `"2026-06-01 12:00:00"`), `privacy`, `scrapedAt` (ISO) |
| Profile (`type:"profile"`) | `type`, `id`, `url`, `username`, `displayName`, `videosCount`, `followersCount`, `likesCount`, `bio`, `location`, `portrait`, `scrapedAt` |

Fields the source doesn't publish come back as `null`, or `[]` for `tags`.

- **Incremental:** no. The public listing returns at most the 60 most recent videos per user. Filter client-side on `uploadDate`, or dedupe on `id`.
- **Limitations:** public data only. Single-video lookups and user listings expose slightly different fields, so some values are null.

**Example (newer than 2026-10-01): no date filter, so filter after the run.**
```json
{ "videoUrls": [], "users": ["https://vimeo.com/someuser"], "maxVideosPerUser": 60, "includeProfile": false }
```
Then keep items where `uploadDate >= "2026-10-01"`.

---

## 2. dltik/vimeo-scraper

- **ID / title:** `dltik/vimeo-scraper`, "Vimeo Downloader & Scraper - HD/4K MP4 + Metadata". Internal ID `mvLHuBVBJRM0DbJeY`. Developer: Walid (community).
- **Usage:** 65 users in total, 14 monthly active. Rating 0.0. Published 2026-03-28, modified around 2026-06-28.
- **Pricing (conflict):**
  - The pricing page lists "Video scraped" at **$0.50 per 1k** on all tiers, plus Actor start at $0.00005.
  - The README body says **$0.002 per video ($2 per 1k)** and that failed fetches are not charged.
  - Budget for $2 per 1k to be safe.

### Input (from `/input-schema`; the descriptions are in French)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `url` | string | — | One video, showcase, channel or group URL |
| `urls` | array of strings | — | Batch list of Vimeo URLs |
| `videoPassword` | string (secret) | — | Password for protected videos |
| `maxResults` | integer, 1–1000 | 50 | Maximum number of videos returned |

- Showcase, channel and group URLs are expanded into their videos, e.g. `https://vimeo.com/channels/staffpicks`.
- **User profile URLs (`vimeo.com/username`) are not documented. Unverified.**
- There is no date filter, no sort option, no proxy field and no cookies. The actor is HTTP-only.

### Output
- Keys: `id`, `url`, `title`, `duration`, `view_count`, `like_count`, `uploader`, `uploader_url`, `upload_date`, `privacy`, `qualities_available`, `download_url`, `download_hd`, `download_4k`, `download_formats`, `thumbnail`, `tags`.
- `upload_date` is a `YYYYMMDD` string, e.g. `"20260322"`.
- Each `download_formats` entry has `quality`, `height`, `ext`, `filesize`, `direct`, `download_url`.
- The README mentions a description, but no description key appears in the sample. Unverified.
- `/output-schema` could not be fetched.

### Notes
- **Incremental:** no.
- Download URLs are signed and expire quickly, so re-run to refresh them.
- `direct:false` means a DASH/HLS stream, not a single MP4.
- `download_4k` is null when the video has no 4K rendition.
- Ordering of channel results is not documented.

**Example (newer than 2026-10-01): no date filter.**
```json
{ "url": "https://vimeo.com/channels/somechannel", "maxResults": 50 }
```
Then keep items where `upload_date >= "20261001"`. Only use this actor if the account is a showcase, channel or group. Otherwise use goat255 or the official API.

---

## 3. apify/instagram-scraper

- **ID / title:** `apify/instagram-scraper`, "Instagram Scraper". Internal ID `shu8hvrXbJbY3Eb9W`. Maintained by Apify.
- **Usage:** 434K users, 53K monthly active. Rating 4.7 (602). Modified hours before the check. Issue response time is 2.4 days.
- **Pricing:** pay per result, event "Result (primary)": Free $2.70, Starter $2.30, Scale $1.90, Business $1.50 per 1k. No start fee or add-ons are listed.

### Input (from `/input-schema`)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `resultsType` | string enum | `posts` | One of `posts`, `details`, `comments`, `reels`, `mentions`, `stories`. One content type per run. |
| `directUrls` | array of strings | — | Profile URLs `https://www.instagram.com/<username>/`, post URLs `/p/`, reel URLs `/reel/`, hashtag or place URLs. Story URLs are reduced to the username. |
| `resultsLimit` | integer ≥1 | — | Maximum results **per URL** |
| `onlyPostsNewerThan` | string | — | `YYYY-MM-DD`, ISO datetime (UTC, with `Z` and/or milliseconds allowed), or relative (`"1 day"`, `"2 months"`). Pinned posts may still appear. |
| `search` | string | — | Hashtag, profile or place search (`#tag`). URLs override search; the two can't be combined. |
| `searchType` | string enum | `hashtag` | `hashtag`, `profile`, `place`, `user` |
| `searchLimit` | integer, 1–250 | — | Number of search hits |
| `addParentData` | boolean | false | Adds `dataSource` (`profile` or `hashtag`) to feed items |
| `skipPinnedPosts` | boolean | (README only) | Excludes pinned posts in posts mode |
| `isNewestComments` | boolean | (README only) | Newest comments first. Paid plans only. |
| `includeNestedComments` | boolean | (README only) | Returns replies as separate items. Paid plans only. |
| `addProfileStatistics` | boolean | (README only) | Adds a `statistics` object to details results |

- No cookie, login or proxy input is exposed. Public data only; no Business account or OAuth needed.
- The schema lists `resultsType: "stories"`, but the README does not document it, so login needs and output for stories are **unverified**.

### Output (posts and reels, from `/output-schema`)
- **Post keys:** `inputUrl`, `id`, `type` (Image/Video/Sidecar), `shortCode`, `caption`, `hashtags`, `mentions`, `url`, `commentsCount`, `firstComment`, `latestComments`, `dimensionsHeight`, `dimensionsWidth`, `originalHeight`, `originalWidth`, `displayUrl`, `images`, `videoUrl`, `audioUrl`, `alt`, `likesCount` (-1 if likes are hidden), `videoViewCount`, `videoPlayCount`, `igPlayCount`, `fbLikeCount`, `fbPlayCount`, `reshareCount`, `sharesCount`, `timestamp` (ISO), `childPosts`, `ownerUsername`, `ownerId`, `ownerFullName`, `isPinned`, `productType`, `videoDuration`, `paidPartnership`, `affiliate`, `sponsors`, `taggedUsers`, `musicInfo`, `coauthorProducers`, `locationName`, `locationId`, `pk`, `redirectedFromUrl`, `isCommentsDisabled`, `metaData`.
- **Profile ("details") keys:** `username`, `fullName`, `biography`, `followersCount`, `followsCount`, `postsCount`, `verified`, `private`, `profilePicUrl`, `profilePicUrlHD`, `latestPosts`, `hasPublicStory`, `isBusinessAccount`, `businessCategoryName`, `externalUrl(s)`, `relatedProfiles`, and more.
- **Error keys:** `error`, `errorDescription`, `requestErrorMessages`.

### Notes
- **Incremental:** yes, through `onlyPostsNewerThan`. Whether the actor stops paginating early is not stated. Pinned posts can still appear unless `skipPinnedPosts` is true.
- Private profiles can't be scraped.
- Numeric post IDs in URLs aren't supported; use shortCodes.
- Counts are logged-out snapshots.
- Free plan: about 15 comments per post and about 21 mentions.
- "No fixed cap" on posts per profile.

**Example (newer than 2026-10-01):**
```json
{
  "directUrls": ["https://www.instagram.com/natgeo/"],
  "resultsType": "posts",
  "resultsLimit": 100,
  "onlyPostsNewerThan": "2026-10-01",
  "skipPinnedPosts": true,
  "addParentData": false
}
```
Use `"resultsType": "reels"` in a separate run for reels.

---

## 4. data-slayer/instagram-stories-scraper

- **ID / title:** `data-slayer/instagram-stories-scraper`, "Instagram Stories Scraper · No Login". Internal ID `z1rvDd9bJrnT4LVee`.
- **Usage:** 563 users, 328 monthly active. Rating 5.0 (1). Modified 8 days before the check. Issue response time is 2.5 hours.
- **Pricing:** pay per result, "Result": Free $2.50, Starter $2.17, Scale $1.83, Business $1.50 per 1k.
  - Actor start costs $0.0005 per event, charged one event per GB of memory (minimum one).
  - Platform usage is free. Billing is per row returned.

### Input

| Key | Type | Default | Meaning |
|---|---|---|---|
| `usernames` | array of strings (required) | `["nike"]` | Instagram usernames |

- **Login:** none. "No cookies. No login required… no account, no browser automation."
- No cookie, session or proxy fields are shown. The captured schema may be incomplete (unverified).

### Output (from `/output-schema`: 44 keys, all optional)
`creator_username`, `creator_id`, `creator_full_name`, `creator_verified`, `creator_profile_pic_url`, `caption_text`, `media_url`, `story_type`, `thumbnail_url`, `story_link_url`, `has_link`, `story_permalink`, `id`, `code`, `taken_at`, `taken_at_ts`, `taken_at_date`, `expiring_at`, `expires_at_date`, `media_type`, `media_name`, `media_format`, `product_type`, `is_video`, `is_reel_media`, `original_width`, `original_height`, `is_paid_partnership`, `video_url`, `video_duration`, `video_versions`, `has_audio`, `user`, `caption`, `image_versions`, `location`, `story_link_stickers`, `story_music_stickers`, `reel_mentions`, `story_polls`, `story_feed_media`, `username`, `stories_count`, `status`

- No example JSON is published. The values of `status` and `stories_count` are undocumented; they likely form a per-user summary or "no stories" row (unverified).

### Notes
- **Incremental:** not applicable. It captures only live stories (last 24h). Dedupe on `id` / `code`.
- Public profiles only. Highlights need a separate actor.
- Media URL expiry is not documented, but Instagram CDN URLs are signed, so download promptly.

**Example (newer than 2026-10-01): no date filter needed.** Stories are always under 24h old. Filter on `taken_at` if required.
```json
{ "usernames": ["nike"] }
```

---

## 5. igview-owner/instagram-story-viewer

- **ID / title:** `igview-owner/instagram-story-viewer`, "Instagram Story Viewer" (page title: "Anonymous Instagram Story Viewer"). Developer: Sachin Kumar Yadav.
- **Usage:** 806 users, 124 monthly active. Rating 4.7 (5). Modified about a month before the check. Issue response time is 0.62 hours.
- **Pricing:** pay per event.

| Event | Free | Starter | Scale | Business |
|---|---|---|---|---|
| Result | **$20.00 / 1k** | $5.00 / 1k | $5.00 / 1k | $5.00 / 1k |
| Actor start | $0.05 | $0.03 | $0.02 | $0.01 |

### Input (conflict between the schema and the README)

| Key | Type | Default | Meaning | Source |
|---|---|---|---|---|
| `usernames` | array of strings, 1–50 items (required) | `["instagram"]` | Usernames without `@` | `/input-schema` (current build) |
| `username` | string (required) | — | A single username | README examples, possibly outdated |
| `includeUserInfo` | boolean | true | Adds `user_info` | README |
| `includeStickers` | boolean | true | Adds `mentions` and `shared_media` with position data | README |

- **Login:** none ("without requiring any Instagram login or authentication").
- No cookie or proxy fields.
- Use `usernames` (array). Test once, because `includeUserInfo` and `includeStickers` are not visible in the captured schema (unverified).

### Output (README sample)
- Keys: `source`, `story_id`, `username`, `user_id`, `taken_at` (Unix seconds), `taken_at_date` (ISO), `has_audio`, `original_width`, `original_height`, `media_type` ("video" or "image"), `image_url`, `image_url_hd`, `image_thumbnail`, `video_url`, `video_width`, `video_height`.
- `user_info` contains `id`, `username`, `is_private`, `profile_pic_url`.
- Each `mentions[]` entry contains `username`, `full_name`, `account_id`, `profile_pic_url`, `position{x,y,width,height,rotation}`.
- Each `shared_media[]` entry contains `media_id`, `media_code`, `media_type`, `product_type`, `position`.

### Notes
- **Incremental:** not applicable (24h window). Dedupe on `story_id`.
- Public accounts only; private accounts return an error or nothing. No highlights.
- Media URLs expire.
- An account with no stories returns an empty result plus a message.
- Rate limits exist; the page mentions "retry logic and key rotation" without details.

**Example:**
```json
{ "usernames": ["instagram"] }
```
The legacy form is `{"username":"instagram"}`.

---

## 6. louisdeconinck/instagram-story-details-scraper

- **ID / title:** `louisdeconinck/instagram-story-details-scraper`, "Instagram Story Details Scraper". Internal ID `9pQFsbs9nqUI64rDQ`.
- **Usage:** 1.8K users, 259 monthly active. Rating 4.2 (8). Modified 22 days before the check. **Issue response time is 19 days.**
- **Availability:** only for paying Apify users.

### Pricing (conflict)
The pricing page shows pay per event:

| Event | Free | Starter | Scale | Business |
|---|---|---|---|---|
| Profiles (per scraped profile; stories not charged) | $10 / 1k | $9 / 1k | $8 / 1k | $7 / 1k |
| Actor start | $0.01 | $0.009 | $0.008 | $0.007 |

- The Starter and Scale prices were derived from the general discount table.
- The store header says "from $17.00 / 1,000 profiles".
- The README says "$0.0002 per story". This contradicts the pricing table.

### Input

| Key | Type | Default | Meaning |
|---|---|---|---|
| `usernames` | array of strings (required) | — | Example: `["zuck","therock"]`. The README says profile URLs also work (unverified). |

- **Login:** "Does not require authentication or login."
- The `is_viewer_mentioned` description mentions "if cookies are provided", but no cookie input is documented. No proxy field.

### Output
- This is the raw Instagram private-API media object, with 94 top-level keys.
- **Key fields:** `pk`, `id`, `code`, `taken_at` (Unix seconds), `expiring_at` (Unix seconds, +24h), `media_type` (1 = photo, 2 = video), `video_versions[]` (`url`, `width`, `height`, `bandwidth`, `type`), `image_versions2` (candidates with `url`, `width`, `height`), `video_duration`, `has_audio`, `original_width`, `original_height`, `caption`, `product_type`, `is_paid_partnership`, `music_metadata`, `story_music_stickers`, `story_feed_media`, `user` (`pk`, `username`, `full_name`, `is_private`, `is_verified`, `profile_pic_url`), `can_reply`, `can_reshare`, `is_viewer_mentioned`, `video_dash_manifest`, `crosspost`.

### Notes
- **Incremental:** not applicable (24h). Dedupe on `pk`.
- Behaviour for private profiles and for accounts with no stories is not documented.
- The "No rate limits" claim is marketing only.

**Example:**
```json
{ "usernames": ["zuck"] }
```

---

## 7. apify/website-content-crawler

- **ID / title:** `apify/website-content-crawler`, "Website Content Crawler". Internal ID `aYG0l9s7dbB7j3gbS`. Maintained by Apify.
- **Usage:** 169K users, 14K monthly active. Rating 4.6 (235). Modified 2026-10-15.

### Pricing: pay per usage (compute units)
- The Actor itself is free; you pay for platform compute.
- The README gives $0.25 per compute unit as a baseline. The general Apify pricing page fetched lists $0.20 per CU on Free and Starter, $0.16 on Scale and $0.13 on Business.
- Estimates from the README:
  - Headless browser: about $0.5–5 per 1k pages.
  - Raw HTTP (`cheerio`): about $0.2 per 1k pages.
  - Optional AI `summarize`: about $2–3 per 1k pages.
- Proxy is billed separately. Residential proxy is $7–8 per GB.

### Input (52 fields; the important ones)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `startUrls` | array of `{url}` (required) | — | Crawls sub-pages under the same path |
| `crawlerType` | enum | `playwright:firefox` (README calls `playwright:adaptive` recommended) | `playwright:adaptive`, `playwright:firefox`, `cheerio`, `jsdom` (deprecated), `playwright:chrome` (deprecated) |
| `includeUrlGlobs` / `excludeUrlGlobs` | array | `[]` | Glob patterns |
| `maxCrawlDepth` | int | 20 | 0 means only the start URLs |
| `maxCrawlPages` | int | 9999999 | Page cap |
| `maxResults` | int | 9999999 | Cap on stored items |
| `useSitemaps` | bool | false | Enqueue URLs from sitemaps |
| `onlyCrawlPagesModifiedSince` | string | — | Experimental. `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`. |
| `useLlmsTxt` | bool | false | Crawl `/llms.txt` and linked Markdown files |
| `respectRobotsTxtFile` | bool | false | Check robots.txt |
| `proxyConfiguration` | object (required) | `{"useApifyProxy": true}` | Proxy |
| `initialCookies` | array of `{name,value,domain?,path?}` | — | For sites behind a login |
| `customHttpHeaders` | object | `{}` | Extra request headers |
| `maxConcurrency` | int | 200 | Parallel browsers or clients |
| `requestTimeoutSecs` | int | 60 | Request timeout |
| `maxRequestRetries` | int | 3 | Retries on errors |
| `dynamicContentWaitSecs` | int | 10 | Wait for dynamic content |
| `waitForSelector` / `softWaitForSelector` | string | — | CSS selector to wait for |
| `removeCookieWarnings` | bool | true | Remove cookie dialogs |
| `clickElementsCssSelector` | string | `[aria-expanded="false"]` | Elements to click open |
| `keepElementsCssSelector` / `removeElementsCssSelector` | string | (long default remove list) | Content pruning |
| `htmlTransformer` | enum | `readableText` | `readableTextIfPossible`, `readableText`, `extractus`, `defuddle`, `none` |
| `saveMarkdown` | bool | true | Adds the `markdown` field |
| `saveHtmlAsFile` | bool | false | Saves HTML to the key-value store and adds `htmlUrl` |
| `saveScreenshots` | bool | false | Adds `screenshotUrl` |
| `saveContentTypes` | string | — | Download linked files (PDF and others) |
| `summarize` | bool | false | Paid. Adds `summary`. |
| `pageFunction` | string | — | Custom JavaScript run in the browser |

### Output
- Keys: `url`, `crawl{loadedUrl, loadedTime, referrerUrl, depth}`, `metadata{canonicalUrl, title, description, author, keywords, languageCode, openGraph, headers}`, `screenshotUrl`, `text`, `html`, `markdown`, `summary`, and optionally `htmlUrl`.

### Incremental: partial
- `onlyCrawlPagesModifiedSince` skips sitemap URLs whose `<lastmod>` is older than the date, and sends conditional requests.
- Unchanged pages produce no item, so the output is a delta.
- URLs without `<lastmod>` are always crawled, and start URLs are always crawled.
- This filters by **page modified date, not by publish date**.

### Limitations
- Canonical duplicates count toward `maxCrawlPages`.
- File downloads are capped at 1 hour each.
- The run fails if the crawler crashes more than 3 times per minute.
- For single URLs, Apify recommends the RAG Web Browser actor instead.

**Example (newer than 2026-10-01):**
```json
{
  "startUrls": [{ "url": "https://www.example.com/blog/" }],
  "crawlerType": "cheerio",
  "useSitemaps": true,
  "onlyCrawlPagesModifiedSince": "2026-10-01",
  "maxCrawlDepth": 2,
  "maxCrawlPages": 200,
  "saveMarkdown": true,
  "proxyConfiguration": { "useApifyProxy": true }
}
```

---

## 8. harvestapi/linkedin-company-employees

- **ID / title:** `harvestapi/linkedin-company-employees`, "LinkedIn Company Employees Scraper (No Cookies)". Internal ID `Vb6LZkh4EqRlR0Ka9`. Developer: HarvestAPI (Apify Partner).
- **Usage:** 34K users, 6.2K monthly active. Rating 4.0 (49). Modified 10 days before the check.

### Pricing: pay per event (per 1k unless stated)

| Event | Free | Starter | Scale | Business |
|---|---|---|---|---|
| Basic profile | $3 | $3 | $2.50 | $1.50 |
| Full profile | $8 | $8 | $6 | $4 |
| Full profile + email search | $12 | $12 | $10 | $8 |
| Actor start (per start) | $0.02 | $0.02 | $0.02 | $0.015 |

- In `one_by_one` mode, each company query incurs a start fee.
- The README quotes Short at $4 per 1k, which differs from the pricing page.
- The Free tier is limited to 10 runs in total.

### Input (from `/input-schema`; all fields optional)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `companies` | array, max 1000 items | — | Company URLs such as `https://www.linkedin.com/company/google` (preferred) or names |
| `profileScraperMode` | enum | `Full ($8 per 1k)` | `Short ($4 per 1k)`, `Full ($8 per 1k)`, `Full + email search ($12 per 1k)`. These are the display labels; the stored values were not shown, but the README example uses the label string `"Full ($8 per 1k)"`. |
| `maxItems` | int | — | Total profile cap. 0 means all, up to 2,500 per query. |
| `companyBatchMode` | enum | `all_at_once` | `all_at_once` (≤10 companies recommended) or `one_by_one` (≤1000 companies) |
| `maxItemsPerCompany` | int | — | Only in `one_by_one` mode |
| `startPage` | int, 0–100 | — | Search page to start from; use it to resume a run |
| `takePages` | int, 0–100 | — | Number of pages to scrape (25 profiles per page) |
| `searchQuery` | string, ≤300 chars | — | Fuzzy search; LinkedIn operators supported |
| `locations` / `excludeLocations` | array, ≤50 | — | LinkedIn location names, e.g. "United Kingdom" rather than "UK" |
| `jobTitles` / `pastJobTitles` / `excludeCurrentJobTitles` / `excludePastJobTitles` | array, ≤50 | — | Title filters |
| `schools` / `excludeSchools` | array | — | School filters |
| `industryIds` / `excludeIndustryIds` | array | — | e.g. 4 = Software Development |
| `yearsAtCurrentCompanyIds`, `yearsOfExperienceIds` | string[] | — | 1 = <1 yr, 2 = 1–2, 3 = 3–5, 4 = 6–10, 5 = >10 |
| `seniorityLevelIds` / `excludeSeniorityLevelIds` | string[] | — | 100–320 (e.g. 120 Senior, 220 Director, 310 CXO) |
| `functionIds` / `excludeFunctionIds` | string[] | — | 1–26 (e.g. 8 Engineering, 15 Marketing) |
| `companyHeadcount` | string[] | — | Values not listed |
| `excludePastCompanies` | array | — | Company URLs |
| `recentlyChangedJobs` | boolean | — | Only people who recently changed jobs |

**Login:** none ("No cookies or account required").

### Output (Full mode)
- Keys: `id`, `publicIdentifier`, `linkedinUrl`, `firstName`, `lastName`, `headline`, `about`, `openToWork`, `hiring`, `photo`, `premium`, `influencer`, `location{linkedinText,countryCode,parsed{city,state,country}}`, `verified`, `registeredAt`, `topSkills`, `connectionsCount`, `followerCount`, `currentPosition[]`, `experience[]`, `education`, `certifications`, `projects`, `volunteering`, `receivedRecommendations`, `skills`, `courses`, `publications`, `patents`, `honorsAndAwards`, `languages`, `featured`, `moreProfiles`.
- Each `experience[]` entry has `position`, `companyName`, `companyLinkedinUrl`, `companyId`, `duration`, `description`, `skills`, `startDate{month,year,text}`, `endDate`.

### Notes
- **Incremental:** not applicable; there is no date filter. `recentlyChangedJobs` is the closest equivalent. Diff on `id` / `publicIdentifier` between runs.
- Maximum 2,500 results per search query; split queries to get more.
- Emails are not guaranteed.
- LinkedIn may misread location text (e.g. "UK" resolves to Ukraine).
- Very large volumes (200K+ profiles) may hit hourly LinkedIn rate limits.

**Example ("newer than" is not possible):**
```json
{
  "companies": ["https://www.linkedin.com/company/google"],
  "profileScraperMode": "Short ($4 per 1k)",
  "maxItems": 100
}
```

---

## 9. harvestapi/linkedin-company-posts

- **ID / title:** `harvestapi/linkedin-company-posts`, "LinkedIn Company Posts Scraper (No Cookies)". Internal ID `WI0tj4Ieb5Kq458gB`.
- **Usage:** 15K users, 4.8K monthly active. Rating 5.0 (21). Modified 21 days before the check. Issue response time is 3.7 hours.

### Pricing: pay per event

| Event | Free | Starter | Scale | Business |
|---|---|---|---|---|
| Post | $2.00 / 1k | $2.00 / 1k | $1.75 / 1k | $1.50 / 1k |
| Reaction | $2.00 / 1k | $2.00 / 1k | $1.75 / 1k | $1.50 / 1k |
| Comment | $2.00 / 1k | $2.00 / 1k | $1.75 / 1k | $1.50 / 1k |
| 0-result query | $1.00 / 1k | $1.00 / 1k | $1.00 / 1k | $1.00 / 1k |
| Actor start | $0.00005 | $0.00005 | $0.00005 | $0.00005 |

### Input (from `/input-schema`: 14 fields, all optional, no sort field)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `targetUrls` | array, max 10,000 | — | Company URLs (`https://www.linkedin.com/company/<slug>/`) or profile URLs |
| `maxPosts` | int | 10 | Per input. 0 means all. Overrides pagination. |
| `postedLimit` | enum | `any` | `any`, `1h`, `24h`, `week`, `month`, `3months`, `6months`, `year` |
| `postedLimitDate` | string | — | Posts from now back to and including this date. Accepts `"2011-10-10"`, `"2011-10-10T14:48:00.000+09:00"`, or a millisecond timestamp string. |
| `includeQuotePosts` | bool | true | Include quote posts |
| `includeReposts` | bool | true | Include reposts |
| `scrapeReactions` / `maxReactions` | bool / int | false / 5 | Reactions are billed as separate items |
| `scrapeComments` / `maxComments` | bool / int | false / 5 | Comments are billed as separate items |
| `commentsPostedLimit` | enum | `any` | `any`, `1h`, `24h`, `week`, `month` |
| `postNestedReactions` / `postNestedComments` | bool | — | Legacy; not recommended because of item size limits |
| `contextCountry` | enum | — | `any`, `US`, `GB`, `DE`, `FR` |

**Login:** none. The actor processes 6 targets concurrently.

### Output (README sample, which is a profile post)
- Keys: `type` ("post"), `id`, `linkedinUrl`, `content`.
- `author` contains `universalName`, `publicIdentifier`, `type`, `name`, `linkedinUrl`, `info`, `website`, `websiteLabel`, `avatar{url,width,height,expiresAt}`.
- `postedAt` contains `timestamp` (ms), `date` (ISO), `postedAgoShort`, `postedAgoText`.
- Also: `postImages[]`, `document{title,transcribedDocumentUrl,coverPages,totalPageCount}`, `socialContent{…shareUrl…}`, `engagement{likes,comments,shares,reactions[{type,count}]}`.
- A video field (e.g. `postVideo`) is **unverified**, and `/output-schema` could not be fetched.

### Notes
- **Incremental:** yes, through `postedLimitDate` (exact date) or `postedLimit` (relative window). Dedupe on `id`.
- Several labels on the page mix up "profile" and "company".
- The quote-post and repost descriptions are self-contradictory, but the schema defaults are `true`.

**Example (newer than 2026-10-01):**
```json
{
  "targetUrls": ["https://www.linkedin.com/company/google/"],
  "postedLimitDate": "2026-10-01",
  "maxPosts": 0,
  "includeReposts": true,
  "includeQuotePosts": true,
  "scrapeReactions": false,
  "scrapeComments": false
}
```
Set `maxPosts` to something like 50 as a cost guard.

---

## 10. streamers/youtube-scraper

- **ID / title:** `streamers/youtube-scraper`, "YouTube Scraper". Internal ID `h7sDV53CddomktSi5`. Maintained by Apify.
- **Usage:** 169K users, 19K monthly active. Rating 4.8 (196). Modified hours before the check.

### Pricing: pay per event (per 1k)

| Event | Free | Starter | Scale | Business |
|---|---|---|---|---|
| Video | $4.00 | $3.00 | $2.60 | $2.40 |
| Add-on: date range for channels | $1.30 | $1.00 | $0.80 | $0.60 |
| AI description | $15 | $10 | $8.50 | $7 |
| AI summary | $15 | $10 | $8.50 | $7 |
| Transcript minute | $48 | $41 | $33 | $27 |

No start fee is listed.

### Input (from `/input-schema`)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `startUrls` | array of `{url}` | `[]` | Video, channel, playlist or search URLs. Channel examples: `https://www.youtube.com/@Handle/videos` (also `/shorts`, `/streams`). Search terms are ignored when this is set. |
| `searchQueries` | array of strings | — | YouTube search terms |
| `maxResults` | int, 0–999999 | 0 | Regular videos per search term; "for channels, it limits regular videos" |
| `maxResultsShorts` | int | 0 | Shorts limit |
| `maxResultStreams` | int | 0 | Streams limit |
| `oldestPostDate` | string | — | `YYYY-MM-DD` or relative (`"1 day"`). **Channel URLs only.** Forces sorting to NEWEST. Charged as the date-range add-on. |
| `sortVideosBy` | enum | — | `NEWEST`, `POPULAR`, `OLDEST` (channel tabs) |
| `sortingOrder` | enum | — | Search only: `relevance`, `rating`, `date`, `views` |
| `dateFilter` | enum | — | Search only: `hour`, `today`, `week`, `month`, `year` |
| `videoType`, `lengthFilter`, `isHD`, `hasSubtitles`, `hasCC`, `is3D`, `isLive`, `isBought`, `is4K`, `is360`, `hasLocation`, `isHDR`, `isVR180` | various | — | Search filters |
| `transcriptionAndSubtitle` | enum | `NONE` | `NONE`, `ALWAYS_SUBTITLES`, `TRANSCRIPTION_AS_FALLBACK`, `ALWAYS_TRANSCRIBE` |
| `subtitlesLanguage` | enum | `en` | `any`, `en`, `de`, `es`, `fr`, `it`, `ja`, `ko`, `nl`, `pt`, `ru` |
| `subtitlesFormat` | enum | `srt` | `srt`, `vtt`, `xml`, `plaintext` |
| `saveSubsToKVS`, `preferAutoGeneratedSubtitles` | bool | — | Subtitle options |
| `aiVideoDescription`, `aiVideoSummary` | bool | false | Paid add-ons |

- **Proxy:** no proxy field in the schema. The README says Apify Proxy is the default and datacenter proxies are recommended.
- **Login:** not needed. Age-restricted content returns an `AGE_RESTRICTED` error.
- **Possible conflict:** the README says the per-type limits apply only to search terms, while the schema says `maxResults` also limits regular videos for channels.

### Output (from `/output-schema`: 42 keys)
- Keys: `title`, `id`, `url`, `viewCount`, `date`, `duration` ("HH:MM:SS"), `type` (`video` / `shorts` / `stream`), `thumbnailUrl`, `input`, `channelName`, `channelUrl`, `channelUsername`, `channelId`, `translatedTitle`, `translatedText`, `likes`, `location`, `commentsCount`, `text` (description), `descriptionLinks[{url,text}]`, `subtitles[{srtUrl,type,language,srt}]`, `aiVideoDescription`, `aiVideoSummary`, `transcriptionUrl`, `fromYTUrl`, `order`, `commentsTurnedOff`, `isMonetized`, `hashtags`, `isMembersOnly`, `collaborators`, `isPaidContent`, `numberOfSubscribers`, `channelTotalVideos`, `channelDescription`, `channelLocation`, `channelJoinedDate`, `channelTotalViews`, `isChannelVerified`, `channelBannerUrl`, `channelAvatarUrl`, `isAgeRestricted`.
- Error items contain `url`, `input`, `error`, `note`. Codes include `CHANNEL_DOES_NOT_EXIST`, `VIDEO_UNAVAILABLE`, `AGE_RESTRICTED`, `DATE_FILTER_TOO_STRICT`, `NO_RESULTS`, `INVALID_INPUT`.

### Notes
- **Incremental:** yes for channels, through `oldestPostDate`. There is no stop-at-known-ID option. A `DATE_FILTER_TOO_STRICT` error item means nothing new was found; treat it as "no new videos", not as a failure.
- Up to about 20K videos per URL.
- Dislikes are not available.
- Comments, Shorts and channel-level data are handled by separate actors.

**Example (newer than 2026-10-01):**
```json
{
  "startUrls": [{ "url": "https://www.youtube.com/@GoogleDevelopers/videos" }],
  "oldestPostDate": "2026-10-01",
  "sortVideosBy": "NEWEST",
  "maxResults": 50,
  "maxResultsShorts": 0,
  "maxResultStreams": 0
}
```

---

## Official APIs

### Vimeo API
The live docs on `developer.vimeo.com` load with JavaScript, so they could not be read. The details below come from prior knowledge and are **unverified against the live docs**. Only the 429 behaviour was confirmed (Vimeo Help Center).

- **Endpoint:** `GET https://api.vimeo.com/users/{user_id}/videos`. `{user_id}` can be a numeric ID or a vanity username; `/me/videos` returns your own videos.
- **Query parameters:**
  - `sort`: `alphabetical`, `date`, `default`, `duration`, `last_user_action_event_date`, `likes`, `modified_time`, `plays`
  - `direction`: `asc`, `desc`
  - `per_page`: maximum 100
  - `page`
  - `filter`: e.g. `embeddable`, `playable`, `app_only`, `featured`
  - `query`, `containing_uri`
  - Example: `?sort=date&direction=desc&per_page=25`
- **`fields` parameter:** a comma-separated JSON field filter that reduces the payload, e.g. `fields=uri,name,link,created_time,release_time,duration,pictures.sizes`.
- **Pagination:** the `paging{next,previous,first,last}` object.
- **Auth:** `Authorization: bearer <token>`. A personal access token (or an unauthenticated client-credentials token) with the `public` scope can read public videos. Recommended header: `Accept: application/vnd.vimeo.*+json;version=3.4`.
- **Rate limits:** response headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (the reset value is a UTC timestamp).
  - **Verified (Help Center):** exceeding the limit returns HTTP 429, and the app is "temporarily prevented from making requests for up to a minute". Apps that keep exceeding the limit may be blocked. AI endpoints are limited to 10 requests per minute per endpoint.
- The dltik README claims Vimeo's API is "gated (Pro account + app approval)". This was not verified.
- The GitHub OpenAPI spec (`vimeo/openapi`) was too large for the fetch tool to reach the `/users` section.

### YouTube Data API v3 (verified on developers.google.com, 2026-10-17)
1. **Resolve a @handle:** call `channels.list` with `part=id,contentDetails&forHandle=@Handle`.
   - `forHandle` accepts the value with or without `@`.
   - Use exactly one filter: `id`, `forHandle`, `forUsername`, `mine`, `managedByMe` (or `categoryId`, which is deprecated).
   - Cost: **1 unit**.
2. **Get the uploads playlist:** read `items[0].contentDetails.relatedPlaylists.uploads`. The docs define it as "The ID of the playlist that contains the channel's uploaded videos." It is usually the channel ID with the `UC` prefix replaced by `UU`; that is a known convention, not stated on the page.
3. **List new uploads:** call `playlistItems.list` with `part=snippet,contentDetails&playlistId=UU…&maxResults=50`. Cost: **1 unit**.
   - `maxResults` ranges from 0 to 50 (default 5). Page with `pageToken` / `nextPageToken`.
   - `contentDetails.videoPublishedAt` is "The date and time that the video was published to YouTube" (ISO 8601).
   - `snippet.publishedAt` is the date the item was added to the playlist.
   - Use `contentDetails.videoId` or `snippet.resourceId.videoId` for the video ID.
   - The docs don't state an order. In practice the uploads playlist is newest-first, so stop paging at the first `videoPublishedAt` older than your cutoff (unverified).
4. **Optional details:** call `videos.list` with `id=<up to 50 comma-separated IDs>&part=snippet,statistics,contentDetails` for stats and duration. Cost: **1 unit**.

**Quota (current docs):**
- Default allocation is **10,000 units per day** for all endpoints combined, except two.
- **`search.list` and `videos.insert` each have their own cap of 100 calls per day, at 1 unit per call.** This is a change from the older 100-units-per-search model.
- Quotas reset at midnight Pacific Time.
- An API key is enough for public channels and playlists. That is standard behaviour, not re-checked.
- The cheapest poll is therefore 1 `playlistItems.list` call per channel (1 unit), plus 1 `videos.list` call if stats are needed. Avoid `search.list`.

---

## Things I couldn't verify
- **igview-owner input key:** the README uses `username` (a string); the current schema uses `usernames` (an array, 1–50). Test before relying on either.
- **louisdeconinck pricing:** $10 per 1k profiles on the pricing page, "from $17 per 1k" in the store header, and "$0.0002 per story" in the README.
- **dltik pricing:** $0.50 per 1k on the pricing page, $2 per 1k in the README. User-profile URL support is also undocumented.
- **apify/instagram-scraper stories:** `resultsType: "stories"` is in the schema but not in the README. Login needs and output are unknown.
- **harvestapi employees mode values:** the stored values for `profileScraperMode` were not shown. Pass the display label, as the README example does.
- **harvestapi company posts:** the output schema could not be fetched, so the video field name is unknown.
- **Vimeo API:** all details except the 429 behaviour come from prior knowledge, not the live docs.

## Sources
- https://apify.com/goat255/vimeo-scraper (+ `/input-schema`, `/pricing`)
- https://apify.com/dltik/vimeo-scraper (+ `/input-schema`, `/pricing`)
- https://apify.com/apify/instagram-scraper (+ `/input-schema`, `/output-schema`, `/pricing`)
- https://apify.com/data-slayer/instagram-stories-scraper (+ `/input-schema`, `/output-schema`, `/pricing`)
- https://apify.com/igview-owner/instagram-story-viewer (+ `/input-schema`, `/pricing`)
- https://apify.com/louisdeconinck/instagram-story-details-scraper (+ `/input-schema`, `/pricing`)
- https://apify.com/apify/website-content-crawler (+ `/input-schema`); general compute pricing from https://apify.com/website-content-crawler/pricing (a URL without the owner prefix, so it may show Apify's general pricing rather than this actor's)
- https://apify.com/harvestapi/linkedin-company-employees (+ `/input-schema`, `/pricing`)
- https://apify.com/harvestapi/linkedin-company-posts (+ `/input-schema`, `/pricing`)
- https://apify.com/streamers/youtube-scraper (+ `/input-schema`, `/output-schema`, `/pricing`)
- https://help.vimeo.com/hc/en-us/articles/12427783954065-Rate-limits
- https://developer.vimeo.com/api/reference/videos and https://developer.vimeo.com/guidelines/rate-limiting (both load with JavaScript; content could not be read)
- https://raw.githubusercontent.com/vimeo/openapi/master/api.yaml (partially read)
- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/channels
- https://developers.google.com/youtube/v3/docs/playlistItems/list
- https://developers.google.com/youtube/v3/docs/playlistItems
- https://developers.google.com/youtube/v3/determine_quota_cost