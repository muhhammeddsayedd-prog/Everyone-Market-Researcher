# M06 — Collectors III: Instagram stories + upkeep (removal, metrics, health, media v1)

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first, then the root `PROGRESS.md`.

## 1. Goal and outcome

**28 October owner sequencing exception:** implement the independent local stories/media slice before remaining M05 website checks. This does not start T1 live captures or mark M05 accepted. Local synthetic source contracts, thumbnail queue engine, actual codec, authenticated route and media-only migration are in scope. Shared callbacks/schedulers, hosted migrations, captures, comparison, uploads, email, production and merges remain outside this slice; see `PROGRESS.md` and the dated decision. Historical full-milestone tasks/AC below remain required and unverified where not observed.

Finish the collection layer:

1. **WF-12 · Instagram stories collector:** stories without login. Primary actor: `data-slayer/instagram-stories-scraper`.
2. **A 7-day stories actor bake-off** on 20 pilot accounts, so the owner can pick the primary (MA-16).
3. **WF-31 · Media v1:** saves thumbnails to Supabase Storage the same day. Story and Instagram CDN URLs expire. It includes the minimal internal route `POST /api/internal/media-upload-url` in `apps/web`.
4. **WF-40 · Removal check:** weekly. Items that disappear are marked `removed`, never deleted.
5. **Metrics refresh policy, verified:** latest snapshot for items from the last 30 days (D-13).
6. **Account health surfacing:** failing, stale, zero-item streaks and story capture gaps appear in the WF-91 daily health email.
7. **Scheduling fix:** `ops.report_account_result` now schedules by each row's `cadence` (12 h stories).

When M06 is done, every in-scope source collects on schedule, with thumbnails stored and the upkeep jobs running. The pipeline is ready for AI (M07).

## 2. Context you need (read before T1)

- **Patterns from M04/M05.** The writer path, due list, WF-19 async pattern, the dev-first then prod-backfill default, and prod daily schedules stay **off until M08**. Read both hand-offs first.
- **Stories exist for 24 hours only. There is no backfill (D-10).**
  - Each Instagram account has a second row, `platform = 'instagram_stories'`, with the same handle. Its `backfill_status` must be `not_applicable` (check M02; fix it in dev and prod if not), otherwise daily mode never picks it.
  - Items: `item_type = 'story'`, `external_id` = story id/pk, `published_at` = `taken_at`, `metrics = {}` (no public metrics).
  - Schedule: 06:00 Cairo daily. A second run at 18:00 happens only when `ops.settings.stories_twice_daily = true` (Q-08). The default is `false` and is decided by pilot data.
- **Public data only (D-24).** All three story actors claim "no login":
  - **`data-slayer/instagram-stories-scraper`.** Input `{"usernames": [...]}`, batch ≤ 100. $2.17/1k results on Starter + $0.0005/start. Output (44 keys): `id`, `code`, `creator_username`, `taken_at_ts`, `taken_at_date`, `caption_text`, `thumbnail_url`, `image_versions`, `video_url`, `video_duration`, `story_link_url`, `reel_mentions`, `story_permalink`, `media_type`, `is_video`, `status`, `stories_count`. Rows without `id` are per-user summary rows ("no stories").
  - **`igview-owner/instagram-story-viewer`.** Input `{"usernames": [...]}` (1–50). The README's legacy form is `{"username": "x"}`; test both. $5/1k results on paid plans ($20/1k on Free) + $0.01–0.05/start. Output: `story_id`, `username`, `taken_at` (Unix s), `image_url`, `image_thumbnail`, `video_url`, `mentions[]` (`username`, position), `shared_media[]`.
  - **`louisdeconinck/instagram-story-details-scraper`.** **Paid Apify plan only**, priced per **profile**: $7–10/1k profiles; the store header says "from $17/1k" (conflict). Input `{"usernames": [...]}`. Output is the raw IG media object: `pk`, `id`, `code`, `taken_at`, `expiring_at`, `image_versions2.candidates[].url`, `video_versions[]`, `user.username`. **Never pass cookies**, even though one field description mentions them.
- **Media.**
  - CDN URLs (Instagram especially) are signed and expire within hours to days. Stories must have their thumbnails stored **the same day**.
  - The full media/AI wiring is in M07, but the risk is real now, so this milestone builds **WF-31 v1** and its upload route. M07 then only extends it (vision use, the WF-30 trigger). *This moves WF-31 from M07 to M06. Log it in "Decisions & deviations" and in `docs/DATA_SCHEMA.md` §5 milestone columns for `ops.save_media_asset` / `ops.get_media_targets`.*
  - Storage path: `media/{competitor_slug}/{platform}/{external_id}/thumb.jpg`, bucket `media` (created in M01; verify). Max width 1280, JPEG quality 80.
  - Upload auth (`docs/TECHNICAL.md` §9): n8n calls `POST {app_url}/api/internal/media-upload-url` with header `x-emr-secret: <INTERNAL_WEBHOOK_SECRET>` (credential `EMR internal secret`). The route creates a **signed upload URL** with the Supabase secret key. This route is the only runtime use of `SUPABASE_SECRET_KEY`. n8n then `PUT`s the binary to that URL.
- **Removal.**
  - Never delete; set `status='removed'` and `removed_detected_at`. If an item reappears, restore it to `active`.
  - A removal check is only valid when the listing covered that item's date range. Daily runs only ask for items since the watermark − 1 day, so the absence of an older item from daily runs proves nothing.
  - Stories are **never** removal-checked: they expire by design.
- **Metrics refresh.**
  - **Free APIs (Vimeo, YouTube):** the daily run's page window extends to `min(watermark − 1 day, today − 30 days)`. This costs nothing beyond a few extra pages and refreshes 30-day metrics daily.
  - **Paid actors (Instagram, LinkedIn):** a daily 30-day window would multiply cost about 10×. Instead, the weekly WF-40 listing run (`onlyPostsNewerThan`/`postedLimitDate` = today − 30 days) refreshes metrics and checks removals in one call.
  - So paid-source metrics refresh **weekly**, and the paid removal window is **30 days** (new setting `removal_window_days_paid = 30`; free sources keep `removal_window_days = 90`).
  - *Deviation from `docs/SCRAPING_SOURCES.md` §0 rule 2 / FR-S4 wording ("in the same calls"). Log it and update both docs. The owner can raise the paid window later (cost scales linearly).*

## 3. Prerequisites

| Item | Needed for | Check |
|---|---|---|
| M05 Done | All collectors, WF-19 branches, prod copies | root board |
| MA-10 Apify plan | `louisdeconinck` needs a **paid** Apify plan | plan tier in M04 PROGRESS; if Free, run the bake-off with two actors and note it |
| MA-20 (part, early): Vercel env for the media route | WF-31 | Vercel Preview (dev Supabase) and Production (prod Supabase) have `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `INTERNAL_WEBHOOK_SECRET`; n8n credential `EMR internal secret` holds the same secret |
| Storage bucket `media` | WF-31 | `select id, public from storage.buckets where id='media'` in dev and prod |
| MA-16 | Choose the stories actor | after T5 |

## 4. Scope

**In scope**
- WF-12 (daily + optional 18:00 run).
- Bake-off: `ops.bakeoff_results` table, a WF-19 bake-off branch, and a comparison report.
- WF-31 v1:
  - the `media` queue drain;
  - download → resize → signed upload → `ops.save_media_asset`;
  - triggers: after every collector run with new items (from `SUB · Finish run`) **and** a 2-hourly schedule fallback, until WF-30 calls it in M07.
- `apps/web/app/api/internal/media-upload-url/route.ts` (minimal; the full app comes in M09).
- WF-40 + `ops.get_removal_targets`, `ops.mark_removed`.
- Metrics refresh window changes in WF-10/WF-13; weekly paid listing in WF-40.
- `ops.report_account_result` cadence fix.
- Health checks added to `ops.daily_health()`.

**Out of scope:**
- Story highlights: no approved actor returns them without login. Skip them.
- AI on stories (M07). Key frames (M07, Vimeo/YouTube only).
- Turning on prod daily schedules (M08).

## 5. References

- `docs/SCRAPING_SOURCES.md` §3 (stories), §9 (health)
- `docs/N8N_WORKFLOWS.md` §2 (stories 06:00 / 18:00, removal Sat 04:00), §6 WF-12 / WF-19 / WF-31 / WF-40 / WF-91, §7.4 (stories normalizer), §8 (`ops.get_removal_targets`, `ops.bakeoff_results`)
- `reference/apify_actor_research_2026-10-17.md` §4–6 (story actors)
- `docs/TECHNICAL.md` §5.5 (removal), §9 (media); `docs/DATA_SCHEMA.md` (`app.media_assets`, `app.items.status`)
- `reference/sql/004_rpc_pipeline.sql` (`report_account_result`, the `mark_removed` sketch)

## 6. Deliverables

| Path | What |
|---|---|
| `supabase/migrations/<ts>_m06_stories_upkeep.sql` | `ops.bakeoff_results`; `ops.get_removal_targets`; `ops.mark_removed`; `ops.get_media_targets`; `ops.save_media_asset`; new `report_account_result` scheduling; extended `ops.daily_health()`; new setting `removal_window_days_paid` |
| `supabase/tests/m06_*.sql` | pgTAP for all of the above |
| `n8n/normalizers/storiesDataSlayer.js`, `storiesIgview.js`, `storiesLouisdeconinck.js` | Normalizers (the bake-off ones write to `ops.bakeoff_results`, not items) |
| `n8n/normalizers/fixtures/instagram-stories-*/` | Real fixtures (one per actor, plus a "no stories" row) |
| `apps/web/app/api/internal/media-upload-url/route.ts` + test | Minimal secured route |
| `n8n/workflows/WF-12-instagram-stories.json`, `WF-31-media.json`, `WF-40-removal-check.json`, updated `WF-10`, `WF-13`, `WF-19`, `WF-00`, `WF-91` | Exports |
| `scripts/bakeoff-report.ts` | Produces the bake-off table from `ops.bakeoff_results` + `ops.cost_ledger` |
| `scripts/assert/m06.sql` | AC SQL |

## 7. Tasks

### T1: Fixtures (dev)
1. Pick 3 test accounts that post stories often. Check `everyone.film`; otherwise pick pilot accounts.
2. Run each story actor once (Apify console, dev token):
   - `data-slayer`: `{"usernames": ["everyone.film","goodpeoplefilms","bigfootfilms"]}`.
   - `igview-owner`: `{"usernames": [...]}`; if rejected, try `{"username": "..."}`.
   - `louisdeconinck`: `{"usernames": [...]}`, only if the plan allows.
3. Save the outputs, including one account with **no** stories (to capture the summary-row shape), under `n8n/normalizers/fixtures/instagram-stories-<actor>/`.
4. Confirm there is no login prompt or error.

**Stop rule:** if an actor fails with a login, checkpoint or challenge error, mark it **excluded** (D-24) and record that.

### T2: Migration
1. **`ops.bakeoff_results`:**
   - Columns: `id` bigint identity pk; `day` date; `actor` text; `account_id` uuid FK → `app.competitor_accounts`; `story_key` text; `raw_id` text; `taken_at` timestamptz; `has_thumbnail` bool; `has_mentions` bool; `has_link` bool; `apify_run_id` text; `created_at` timestamptz default now().
   - Unique `(actor, account_id, story_key)`.
   - RLS enabled, no policies (ops is private). EXECUTE-only access via an RPC `ops.save_bakeoff_rows(p_rows jsonb)`.
   - `story_key` = the numeric media pk (the part before `_` in `id`/`story_id`, or `pk`), so stories match across actors. If it is missing, use `account_id || floor(epoch(taken_at)/60)`.
2. **`ops.get_removal_targets(p_platform app.platform, p_window_days int) returns jsonb`:**
   - Returns, per active account of that platform, `{account_id, handle, external_id, uploads_playlist_id, url, since: now()::date - p_window_days, known_external_ids: [...]}`.
   - The known IDs are those of items with `status='active'` and `published_at >= since`, or of any `status='removed'` item in the window, so they can be restored.
   - Excludes `instagram_stories`, `linkedin_employees` and `news` (raise if one is passed).
3. **`ops.mark_removed(p_account_id uuid, p_seen_external_ids text[], p_since date) returns jsonb`:**
   - Sets items of the account with `published_at >= p_since` and `status='active'` whose `external_id` isn't in the seen list to `status='removed', removed_detected_at=now()`.
   - Restores items of the account that are in the seen list with `status='removed'`: `status='active', removed_detected_at=null`.
   - Returns `{removed, restored}`.
   - Guard: if the seen list is empty while known items exist, do **nothing** and return `{skipped: 'empty_listing'}`. An empty listing is far more likely an outage than a mass deletion.
   - Writes an `ops.audit_log` row (`actor_type 'n8n'`, action `mark_removed`, with the counts).
   - *Signature note:* this replaces the sketch's `p_window_days int` with `p_since date`, which is clearer. Update `docs/DATA_SCHEMA.md` §5.
4. **`ops.get_media_targets(p_item_ids uuid[]) returns jsonb`:** `[{item_id, competitor_slug, platform, external_id, thumbnail_source_url, has_thumbnail}]`, where `has_thumbnail` is true when `thumbnail_path` is already set.
5. **`ops.save_media_asset(p_item_id uuid, p_kind text, p_path text, p_source_url text, p_w int, p_h int) returns void`:**
   - Inserts an immutable `app.media_assets` receipt on `storage_path`; exact replay is a no-op and conflicting ownership/source/dimensions stop. Preserve human thumbnail locks and recheck the current stored source.
   - When `p_kind = 'thumbnail'`, sets `app.items.thumbnail_path = p_path`.
6. **`ops.report_account_result`:** keep the M01 `next_due_at` rule unchanged — `now() + cadence − interval '4 hours'` on success, `now() + 6 hours` on failure (pgTAP `07_report_account_result` from M01 stays as is). It already works for stories: with `cadence = '12 hours'`, a 06:00 success is due at 14:00 and is picked by the 18:00 run. Do **not** switch to a Cairo-midnight anchor.
   - Keep the M04 `p_secondary` behaviour.
   - Add a setting-driven cadence switch: an RPC `ops.set_stories_cadence(p_twice_daily boolean)` sets `ops.settings.stories_twice_daily` and updates `cadence` for all `instagram_stories` rows to `12 hours` or `1 day`.
7. **`ops.daily_health()`:** extend the jsonb with these keys:
   - `stale_accounts`: `last_success_at` older than 48 h for daily cadences, 9 days for weekly;
   - `zero_item_streaks`: active, not `instagram_stories`, 0 new items in the last 30 days while the same competitor got new items on another platform;
   - `story_capture_gap`: share of stories in the last 7 days whose `first_seen_at - published_at > interval '18 hours'`;
   - `media_missing_24h`: items created in the last 24 h without `thumbnail_path` that have a source URL.
8. Add the setting `('removal_window_days_paid','30')`.
9. Grants: all the RPCs above to `n8n_writer`.
10. pgTAP tests (T9). Then advisors → dev push → types.

### T3: Media route (`apps/web`)
1. `apps/web/app/api/internal/media-upload-url/route.ts` (Node runtime):
   - Accepts only `POST`, with header `x-emr-secret` equal to `INTERNAL_WEBHOOK_SECRET`. Use a constant-time compare; any mismatch → 401.
   - Body: `{ path: string }`, validated with the shared canonical identity schema; thumb paths only in this slice. No dot segments, leading slash or unsafe identity. Frames remain M07.
   - Creates a Supabase server client with `SUPABASE_SECRET_KEY` (server-only module, never imported by client code) and calls `storage.from('media').createSignedUploadUrl(path, { upsert: false })`. Immutable collision/uncertain save requires reconciliation; do not overwrite a human-protected object.
   - Returns `{ signedUrl, token, path }`.
   - Logs no secrets.
2. Vitest:
   - 401 without the header;
   - 400 on a bad path;
   - 200 with a mocked Supabase client.
3. Deploy via a PR to Preview (dev) and smoke-test with curl. Production follows the merge.

### T4: WF-31 · Media v1 (dev)
1. **Triggers:**
   - an Execute Workflow Trigger, called by `SUB · Finish run` when `items_new > 0` (add the call in the SUB, "don't wait");
   - a Schedule Trigger every 2 h as a fallback (until M07 makes WF-30 the caller).
2. **Claim:** `select * from ops.claim_queue_batch('media', 50, 600);` If it returns nothing → end.
3. **Targets:** `ops.get_media_targets(item_ids)`. Skip any with `has_thumbnail = true` or no source URL, and ack them.
4. **Loop (batch 5):**
   1. HTTP GET the `thumbnail_source_url` as binary, with a 20 s timeout and a browser-like `User-Agent`. A 403/404/410 response means the link expired: ack the message, record the failure in the run log, and count it as `media_expired`.
   2. Edit Image: resize to a maximum width of 1280, JPEG quality 80, and read the width and height.
   3. HTTP POST `{app_url}/api/internal/media-upload-url` (credential `EMR internal secret`) with body `{path}` → HTTP PUT the binary to `signedUrl` (`Content-Type: image/jpeg`).
   4. `ops.save_media_asset(item_id, 'thumbnail', path, source_url, w, h)`.
   5. Ack.
5. **Stories priority:** WF-12 calls WF-31 **directly** right after its WF-19 ingest completes (via `SUB · Finish run`), so story thumbnails are stored within minutes.
6. **Logging:** run start/finish (`WF-31`, platform null, mode `daily`), bytes for visibility and actual reconciled Storage charges when available. The local port outcome leaves cost unknown (`null`); do not fabricate USD0 or claim hosted cost persistence.

### T5: WF-12 · Stories collector + bake-off (dev → prod)
1. **WF-12:**
   - Start the run (`WF-12`, `instagram_stories`, `daily`) and get the due accounts for `instagram_stories`.
   - Chunk 100 usernames per run.
   - Start async `data-slayer~instagram-stories-scraper` runs with `{"usernames": [...]}` and register them (`emr.platform='instagram_stories'`).
2. **WF-19 branch `instagram_stories`:**
   - Normalize with `storiesDataSlayer.js` (`docs/N8N_WORKFLOWS.md` §7.4):
     - `external_id = String(id || code)`;
     - `url = story_permalink || https://www.instagram.com/stories/{user}/{id}/`;
     - `published_at = taken_at_ts` (Unix s) `?? taken_at_date`;
     - `caption = caption_text`;
     - `mentions` = `reel_mentions[].user.username` ∪ `@` handles in the caption (verify the `reel_mentions` shape on the fixture);
     - `media_urls = [story_link_url]`;
     - `thumbnail_url = thumbnail_url ?? image_versions[0].url`;
     - `duration_seconds = video_duration`.
   - Summary rows without an `id` → the account counts as success with 0 items.
   - After ingest and Finish run → call WF-31 directly.
3. **Bake-off (7 days):**
   - Pick 20 pilot accounts known to post stories (look at the Instagram activity in M04 data; list them in PROGRESS).
   - Each day at the 06:00 slot, start `igview-owner~instagram-story-viewer` (≤ 50 usernames) and, if the plan allows, `louisdeconinck~instagram-story-details-scraper` (`usernames`) for those 20, with `emr.bakeoff = true`.
   - The WF-19 bake-off branch normalizes with the actor-specific normalizer → `ops.save_bakeoff_rows(...)`, and **does not ingest items**.
   - The data-slayer rows for the same 20 accounts are written to `ops.bakeoff_results` as well (actor `data-slayer`), so all three compare like for like.
   - Costs are logged per actor (`meta.bakeoff = true`).
4. **Report:** `scripts/bakeoff-report.ts` produces this table:

   | actor | days run | runs failed | stories found | coverage vs union (by `story_key`) | thumbnail rate | mentions rate | link rate | cost USD | cost per 1k stories | login/cookie prompts (must be 0) |
   |---|---|---|---|---|---|---|---|---|---|---|

   Post it in PROGRESS and request **MA-16**.
   - **Recommendation rule:** highest coverage among the actors with 0 login prompts. A tie within 3 points goes to the cheapest.
   - If the winner isn't `data-slayer`, switch WF-12's actor (normalizer + input) after the owner's choice.
5. **Capture-gap check:** compute `story_capture_gap` from `ops.daily_health()`. If more than 10% of stories were first seen more than 18 h after they were posted, recommend `stories_twice_daily = true` (Q-08) in the same MA-16 message. Apply it with `ops.set_stories_cadence(true)` and enable the WF-00 `stories_pm` slot.
6. **Prod:** after MA-16, create a prod copy of WF-12, WF-31, WF-40 and the updated WF-19. Daily slots stay off until M08. *Stories have no backfill, so prod captures nothing until M08 switches the schedules on. That's expected.*

### T6: WF-40 · Removal check + weekly paid metrics refresh (dev)
1. **Trigger:** Saturday 04:00 slot (`removal`) in WF-00, plus a Manual Trigger.
2. Start the run (`WF-40`, null, `removal_check`).
3. **Per platform:**
   - **`vimeo`:** `ops.get_removal_targets('vimeo', 90)` → Vimeo API pages (`sort=date desc`) until `release_time < since` → seen IDs → `ops.mark_removed(account_id, seen, since)`. Free.
   - **`youtube`:** `get_removal_targets('youtube', 90)` → `playlistItems` pages until `< since` → `mark_removed`.
   - **`website_work_page`:** no listing call. A page counts as removed when `app.website_pages.last_seen_at < now() - interval '7 days'` (the daily map no longer returns it). Add the RPC `ops.mark_website_removals(p_account_id)`: it sets those pages to `status='removed'` and their items to `status='removed'`, and restores pages that reappear (the `diff_website_urls` touch updates `last_seen_at`; restore the item when its page is seen again).
   - **`instagram`:** `get_removal_targets('instagram', removal_window_days_paid)` → one async `apify~instagram-scraper` run per 50 accounts with `{"directUrls": [...], "resultsType": "posts", "resultsLimit": 60, "onlyPostsNewerThan": "<since>", "skipPinnedPosts": false}`. Pinned posts are included so they aren't wrongly marked removed. Register with `emr.purpose = 'removal_check'`.
     - **WF-19 `removal_check` branch:** normalize → **ingest** (this refreshes metrics for known items and catches any missed new items, at no extra cost) → group the seen `external_id`s by account → `ops.mark_removed(account_id, seen, since)`.
     - Reels: one extra run with `resultsType: "reels"` and the same window, so reels that aren't on the grid aren't marked removed. Union the seen IDs from both runs before calling `mark_removed`. WF-19 waits until both runs for the account are processed: use `ops.apify_runs_pending(run_id) = 0`, then a Code node merges the seen sets stored per run in `ops.apify_runs` `meta`. Add a `seen_ids` jsonb column to `ops.apify_runs` for this, or a tiny `ops.removal_seen(run_id, account_id, external_id)` table. Pick one and document it.
   - **`linkedin`:** the same pattern with `harvestapi~linkedin-company-posts` and `{"targetUrls": [...], "postedLimitDate": "<since>", "maxPosts": 0, "includeReposts": true, "includeQuotePosts": true}`.
4. Finish the run → WF-70 is not available yet. Skip the publish call until M09/M13 (leave a disabled node with a note).
5. **Vimeo and YouTube daily windows:** update WF-10 and WF-13 so the daily cutoff for **metrics** is `today − metrics_refresh_days` (30). Ingest still drops known IDs, and metrics update. The **stop-on-known-ID rule now applies only to new-item detection**: page until the 30-day cutoff, max 3 pages daily. Re-test idempotency (AC: still 0 new on a second run).

### T7: Health surfacing (WF-91)
1. Extend the WF-91 health email with these sections:
   - failing accounts (`status='failing'`), with the platform, handle, last error and since when;
   - stale accounts;
   - zero-item streaks;
   - story capture gap;
   - media missing;
   - queue depths (`ai_extract`, `media`, `embed`).
2. Keep the email short and in plain English, with the counts first and up to 20 rows per section.
3. **Test in dev:** force an account to fail 3× (bad handle) → it appears as failing; fix the handle → after one success it goes back to `active` (existing `report_account_result` logic).

### T8: Prod copies + verification
- After MA-16, apply the M06 migration to prod (owner approval in MA-16's reply).
- Create prod copies of the changed workflows; prod schedules stay off.
- In prod, run WF-31 once manually to store thumbnails for the M04/M05 backfill items. This is a **one-off media backfill**:
  - prioritize items from the last 30 days, because older CDN URLs may have expired;
  - accept `media_expired` for old Instagram items;
  - log the counts.
- Estimate first: Storage size ≈ items × ~150 KB. Post the estimate; it is small (e.g. 30k × 150 KB ≈ 4.5 GB, within the Pro plan's included storage — verify the current quota).

### T9: Tests + export + hand-off
- Export the workflows, update the docs (SCRAPING_SOURCES §0/§3/§9, N8N_WORKFLOWS WF-31 milestone, DATA_SCHEMA §5), fill in PROGRESS, and open PR `m06-collectors-stories-upkeep`.

## 8. Interfaces & contracts

| Interface | Contract |
|---|---|
| `ops.get_removal_targets(platform, window_days) → jsonb` | New; excludes stories, employees and news |
| `ops.mark_removed(account_id, seen_external_ids text[], since date) → jsonb` | New; never deletes; restores reappearing items; skips empty listings |
| `ops.mark_website_removals(account_id) → jsonb` | New |
| `ops.get_media_targets(item_ids uuid[]) → jsonb`, `ops.save_media_asset(item_id, kind, path, source_url, w, h)` | New (moved from M07) |
| `ops.save_bakeoff_rows(rows jsonb)`, table `ops.bakeoff_results` | New (temporary; drop after M12 or keep for audit) |
| `ops.set_stories_cadence(twice_daily boolean)` | New |
| `ops.report_account_result(...)` | Cadence-aware `next_due_at` |
| `POST /api/internal/media-upload-url` | Header `x-emr-secret`; body `{path}` → `{signedUrl, token, path}`; 401/400 otherwise |
| Storage | Bucket `media`, path `{competitor_slug}/{platform}/{external_id}/thumb.jpg`; JPEG, width ≤ 1280 |

## 9. Acceptance criteria

The SQL is in `scripts/assert/m06.sql`; paste the results.

- **AC1: Stories captured (dev, 7 days, bake-off accounts).**
  ```sql
  select count(distinct account_id) from app.items where platform='instagram_stories' and first_seen_at > now()-interval '7 days';
  ```
  This must be ≥ 90% of the bake-off accounts that posted any story in the window, using the union across the three actors as the truth (`ops.bakeoff_results`). Every story item has `item_type='story'` and a non-null `published_at`.
- **AC2: Same-day thumbnails.** ≥ 95% of story items have `thumbnail_path` set within 6 h of `first_seen_at`:
  ```sql
  select avg((m.created_at - i.first_seen_at) < interval '6 hours')::numeric
  from app.items i join app.media_assets m on m.item_id = i.id and m.kind='thumbnail'
  where i.platform='instagram_stories';
  ```
  The objects exist in the Storage bucket (spot-check 5 public URLs).
- **AC3: Bake-off report** is posted with all columns. No actor needed login (the "login prompts" column is 0 for every actor kept). MA-16 is answered and the decision is recorded in `docs/DECISIONS.md` → Changes.
- **AC4: Removal check.**
  - In dev, delete or unlist nothing real. Instead, simulate removal by calling `ops.mark_removed` with a seen list that omits one known Vimeo video ID → that item is `removed` with `removed_detected_at` set and the row still exists.
  - Calling it again with the ID included restores it to `active`.
  - An empty seen list → `{skipped:'empty_listing'}` and nothing changes.
  - Stories are never touched by WF-40.
- **AC5: Metrics refresh.**
  - For Vimeo and YouTube items with `published_at > now()-30 days`, ≥ 95% have `metrics_updated_at > now()-36 hours` after a daily run.
  - For Instagram and LinkedIn, after one WF-40 run, ≥ 90% of items with `published_at > now()-30 days` have `metrics_updated_at` within the last 24 h.
  - `ai_status` is unchanged by refreshes.
- **AC6: Idempotency.** After the WF-10/WF-13 window change, a second daily run still inserts 0 new items and queues 0 AI messages.
- **AC7: Health.** The WF-91 email in dev lists a forced-failing account, the stale accounts, the queue depths and the story capture gap. A recovered account returns to `active`.
- **AC8: Media route security.** 401 without or with a wrong secret; 400 for a path with `..` or a wrong pattern; the secret key never appears in client bundles (`grep -r SUPABASE_SECRET_KEY apps/web/.next/static` → none).
- **AC9: Scheduling.** With `cadence = '12 hours'`, a story account that succeeded at 06:00 Cairo is due before 18:00. A daily account that succeeded at 02:00 is due at 22:00 the same day (19–21 h window), so the next 02:00 run picks it up (pgTAP, same rule as M01).

## 10. Tests to write

- **pgTAP:**
  - `mark_removed`: remove, restore, empty-skip, and the window boundary — items older than `since` are untouched;
  - `get_removal_targets` rejects stories;
  - `mark_website_removals`;
  - `save_media_asset` sets `thumbnail_path` and is idempotent;
  - `report_account_result` cadence rule (daily and 12 h);
  - `save_bakeoff_rows` uniqueness;
  - grants.
- **Vitest:** the 3 story normalizers (incl. the summary row → 0 items, and `story_key` derivation); the media route (401/400/200).
- **SQL assertions** in `scripts/assert/m06.sql` (AC1, AC2, AC5).
- **Manual:** the WF-31 expired-URL path (use a fake URL → `media_expired`, acked).

## 11. Manual actions from the owner

| ID | What | When | How Codex verifies |
|---|---|---|---|
| MA-20 (part, early) | Add `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `INTERNAL_WEBHOOK_SECRET` to Vercel Preview (dev values) and Production (prod values); put the same `INTERNAL_WEBHOOK_SECRET` in the n8n credential `EMR internal secret` | Before T3 deploy | curl the route with/without the secret → 200/401 |
| MA-16 | Pick the stories actor from the bake-off table; answer twice-daily yes/no (Q-08); approve the prod migration push | After T5 (day 7) | Choice + date in PROGRESS; DECISIONS updated |
| (MA-10 check) | Confirm the paid Apify plan if `louisdeconinck` should join the bake-off | Before T5 | Plan tier in PROGRESS |

## 12. Risks & gotchas

- **Story URLs expire.** WF-31 must run right after WF-12. If WF-31 fails, story thumbnails are lost for good; WF-90 alerts on WF-31 failures.
- **No story metrics** are public. Don't try to get them.
- **`story_key` matching across actors** can fail if the ID formats differ. Use the `taken_at` minute fallback and report unmatched rows separately.
- **`igview-owner` input-name conflict** (`usernames` vs `username`). The bake-off normalizer must handle both output shapes.
- **`louisdeconinck`'s price is per profile**, charged even when the profile has no stories. Its cost per 1k stories can therefore be high; show it in the report.
- **False removals.** A partial listing (actor timeout, rate limit) would mark items removed. Guards:
  - the empty-listing skip;
  - only call `mark_removed` for accounts whose listing run `SUCCEEDED`;
  - skip if the returned count is < 50% of the known count in the window and the run hit `resultsLimit`. Log it as `suspect_partial_listing`.
- **Pinned posts** must be included in removal listings (`skipPinnedPosts: false`), or they look removed.
- **Media route:** never accept arbitrary paths or buckets (path regex). The secret key stays server-only.
- **Storage growth:** keep JPEGs ≤ 1280 px, quality 80, and only one thumbnail per item (key frames come in M07, Vimeo/YouTube only).

## 13. Cost & budget notes

Starter-tier prices. Pilot: 49 Instagram accounts including the baseline.

| Item | Pilot estimate |
|---|---|
| Stories, data-slayer (~1.5 stories/account/day → ~75/day × $2.17/1k + starts) | ≈ **$0.17/day** (×2 if twice daily) |
| Bake-off, 7 days × 20 accounts: igview (~30 stories/day × $5/1k + $0.03 × 7 starts) + louisdeconinck (20 profiles/day × $9/1k + starts) + data-slayer share | ≈ **$1–4 total** |
| WF-40 weekly, Instagram 30-day listing (49 accounts × ~15 posts × 2 runs ≈ 1.5k results × $2.30/1k) | ≈ **$3.4/week** |
| WF-40 weekly, LinkedIn 30-day listing (42 × ~8 posts × $2/1k) | ≈ **$0.7/week** |
| WF-40 Vimeo/YouTube/websites | **$0** |
| Storage (thumbnails ~150 KB × ~30k pilot items ≈ 4.5 GB) | within the Supabase Pro included storage; verify the current quota and egress |

Post the actual bake-off cost and the first WF-40 cost in PROGRESS. If the weekly paid listing costs more than $10/week at pilot scale, propose lowering `removal_window_days_paid` to 14.

## 14. Definition of done & hand-off

- AC1–AC9 pass, with the evidence pasted.
- The stories actor is chosen (MA-16), and the twice-daily decision is recorded.
- Prod copies exist (schedules off). The prod media backfill has run, with counts.
- Docs are updated, including the deviations: WF-31 moved into M06, and the paid metrics refresh is weekly.
- The PR is merged.
- The hand-off lists:
  - the bake-off result;
  - the story capture gap;
  - media expired counts;
  - removal check results (removed/restored counts);
  - the queue depths (`ai_extract`, `media`, `embed`), which make up the **AI backlog** for M07.
- Next: **M07** (AI understanding).
