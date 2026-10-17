# M02 — Seed data & account resolution

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first.

## 1. Goal and outcome

When M02 is done, dev (and, after the owner's OK, prod) Supabase holds:
- **Competitors:** all **284 competitors + the Everyone Films baseline (C000)** in `app.competitors`, with markets, categories, in-house capabilities, tier, pilot rank, notes and logo.
- **Accounts:** every tracked account in `app.competitor_accounts`:
  - 261 `website`, 199 `website_work_page`, 256 `instagram`, 202 `vimeo`, 128 `youtube` and 226 `linkedin` rows from `data/competitor_accounts.csv`;
  - plus derived rows: 256 `instagram_stories` (one per Instagram account) and 226 `linkedin_employees` (one per LinkedIn account, cadence 7 days).
- **Resolved accounts:** Vimeo numeric user IDs and YouTube channel IDs + uploads playlists, stored in `external_id` / `uploads_playlist_id`. Handles are normalized for Instagram, LinkedIn and websites. Unreachable or wrong links are flagged.
- **Pilot gating:** only the **pilot (tier `pilot`, ranks 1–50) + baseline** accounts are `active`; all others are `paused`. Pilot + baseline accounts are `active`/`pending` per T3 (content accounts `backfill_status = 'pending'`, `backfill_from = 2024-01-01`; stories and employees `not_applicable`; website roots as in T3).
- **Logos:** competitor logos are copied into Storage (`media/logos/{slug}.{ext}`), with the source URL kept (Q-10 default).
- **Review list:** a list of unresolved or suspect accounts, which the owner has reviewed (MA-09).

The scripts are **idempotent**: re-running changes nothing unless the CSV changed.

## 2. Context you need

- **Seed files** (`data/README.md`):
  - `data/competitors.csv`: 285 rows. Columns: `company_id`, `slug`, `name`, `markets` (pipe-separated `EG|KSA|UAE`), `hq_country_guess`, `is_baseline`, `pilot_rank`, `priority_tier`, `categories` (pipe), `in_house_capabilities` (pipe), `logo_url`, `website`, `work_url`, `instagram`, `vimeo`, `youtube`, `linkedin`, reference-only `facebook`, `tiktok`, `behance`, `x_twitter`, `threads`, `snapchat`, `pinterest`, `dribbble`, `link_hub`, `news_blog`, `notes`, `sheet_row`.
  - `data/competitor_accounts.csv`: 1,272 rows. Columns: `company_id`, `competitor_slug`, `platform` (`website` | `website_work_page` | `instagram` | `vimeo` | `youtube` | `linkedin`), `url`, `handle` (derived; normalize again), `tracked`, `pilot`.
  - `data/pilot_50.csv`: ranks 1–50. `data/test_accounts.csv`: 25 rows (5 per platform), used by M03–M06 dev tests.
- **Tier mapping:**

  | `priority_tier` in CSV | `app.priority_tier` |
  |---|---|
  | `A · Pilot` | `pilot` |
  | `B · Next wave` | `next_wave` |
  | `C · Adjacent` | `adjacent` |
  | `Baseline` | `baseline` |

  Expected counts: 50 / 174 / 60 / 1.
- **Markets:** `EG`, `KSA` and `UAE` map to `app.country_code`. `hq_country` = `hq_country_guess`; the owner can correct it later.
- **Categories:** keep the 13 competitor-category labels as `code`s from `docs/TAXONOMIES.md` (e.g. `Production` → `production`, `Post-production` → `post_production`, `VFX / CGI` → `vfx_cgi`). In-house capabilities map to `in_house_capability` codes. Any value not in the taxonomy (e.g. "Podcast studios (13)") maps to `other`, with the original text appended to `notes` as `In-house (other): …`.
- **Platforms tracked** (D-07): only these. Reference-only URLs (facebook, tiktok, behance, …) are **not** turned into accounts. They can stay in `notes` or be dropped. Never scrape them.
- **Public data only** (D-24): resolution uses public endpoints and official APIs only.
- **DB rules:**
  - The scripts run from the owner's machine or Codex with `SEED_DATABASE_URL` (owner/postgres connection) or the secret key. **Never** from n8n or the web app.
  - Upsert on `company_code` and on `(platform, handle_norm)` (or `(platform, lower(handle))`, whichever M01 implemented).
- **Account status values:** `active`, `paused`, `failing`, `invalid`, `disabled`. `resolve_status`: `pending`, `resolved`, `failed`, `not_needed`.

## 3. Prerequisites

| Item | Needed when |
|---|---|
| M01 Done (tables, `media` bucket, types) | Start |
| `SEED_DATABASE_URL` for dev (owner connection string, local only) | T2 |
| **MA-07**: `VIMEO_TOKEN` (Vimeo developer app, scope `public`) | T5 |
| **MA-08**: `YOUTUBE_API_KEY` (restricted to YouTube Data API v3) | T6 |
| **MA-09**: owner review of the unresolved/suspect list | T9 |
| Owner OK to seed prod | T10 |

## 4. Scope

**In:**
- Seed script for competitors and accounts.
- Handle normalization.
- Resolution script (Vimeo, YouTube, LinkedIn/Instagram/website normalization + reachability).
- Logo copy to Storage.
- Pilot gating.
- Reports.
- Seeding prod after the owner's OK.

**Out:**
- Any collection of content (M04+).
- n8n (M03).
- Admin UI for editing competitors (M11).
- WF-60 onboarding (M15).

## 5. References

- `data/README.md`, `data/*.csv`
- `docs/DATA_SCHEMA.md` §3 (`competitors`, `competitor_accounts`), §6 (seed data rules)
- `docs/SCRAPING_SOURCES.md` §0 (account rows per platform), §1.1 (Vimeo resolve), §6.1 (YouTube resolve), Common rule 7 (handle/URL canonical form)
- `docs/TAXONOMIES.md` (`competitor_category`, `in_house_capability` codes)
- `docs/TECHNICAL.md` §9 (media paths), `docs/OPEN_QUESTIONS.md` Q-10
- `packages/shared/src/slug.ts` (M00), `packages/shared/src/db.types.ts` (M01)

## 6. Deliverables

| Path | What |
|---|---|
| `packages/shared/src/handles.ts` (+ `handles.test.ts`) | Pure functions: `normalizeInstagram(url)`, `normalizeVimeo(url)` → `{kind:'user'\|'channel'\|'showcase'\|'group', handle}`, `normalizeYouTube(url)` → `{kind:'handle'\|'channel'\|'user'\|'c', value}`, `normalizeLinkedIn(url)` → `{kind:'company'\|'showcase'\|'school', slug}`, `normalizeWebsite(url)` → `{domain, url}`, `canonicalUrl(url)` |
| `scripts/seed/seed-competitors.ts` | Idempotent upsert of competitors + accounts (+ derived stories/employees rows) |
| `scripts/seed/resolve-accounts.ts` | Vimeo/YouTube ID resolution; reachability checks; writes `external_id`, `uploads_playlist_id`, `resolve_status`, `status` |
| `scripts/seed/copy-logos.ts` | Downloads logo URLs, resizes (max 256 px, keeps SVG as-is), uploads to `media/logos/{slug}.{ext}`, sets `logo_path` |
| `scripts/seed/report.ts` | Prints counts per tier/platform/status, and writes `scripts/seed/out/unresolved.csv` (git-ignored) plus a markdown summary for PROGRESS |
| `scripts/README.md` | How to run each script and which env vars it needs (names only) |
| `scripts/assert/m02_counts.sql` | SQL assertions used for the ACs |

Script runtime: Node 24 with `tsx`. Dependencies: `postgres` (postgres.js) for the DB, `csv-parse`, `sharp` for resizing, and `@supabase/supabase-js` (Storage upload with the secret key, or signed upload URLs). All run as `pnpm --filter scripts <name>`, or add `scripts/package.json` as a workspace package `@emr/scripts`.

## 7. Tasks

### T1: Handle normalization library
Rules (lowercase handles, no `@`, canonical https URL without query or tracking params):

| Platform | Accepts | Output `handle` | Account `url` |
|---|---|---|---|
| instagram | `instagram.com/<user>/`, `…/<user>?hl=en`, `@user` | `<user>` (lowercase; strip `reels/`, `p/…` → invalid) | `https://www.instagram.com/<user>/` |
| vimeo | `vimeo.com/<vanity>`, `vimeo.com/user123`, `vimeo.com/channels/<x>`, `vimeo.com/showcase/<id>`, `vimeo.com/groups/<x>` | `<vanity>` or `channels/<x>` / `showcase/<id>` / `groups/<x>` | canonical `https://vimeo.com/...` (drop `?fl=…&fe=…`) |
| youtube | `youtube.com/@h`, `/channel/UC…`, `/user/u`, `/c/name` (+ `/videos`, `/featured`) | `@h` / `channel/UC…` / `user/u` / `c/name` | `https://www.youtube.com/<form>` |
| linkedin | `linkedin.com/company/<slug>/`, `/showcase/<slug>`, `/school/<slug>`; locale subdomains | `<slug>` | `https://www.linkedin.com/company/<slug>/` (keep the kind) |
| website | any URL | domain without `www.` | the URL as given, normalized (https, no fragment) |
| website_work_page | any URL | the full canonical URL (unique per page) | the same |

`instagram_stories` rows reuse the Instagram handle. `linkedin_employees` rows reuse the LinkedIn slug. Both are separate rows, because the unique key includes `platform`.

Write ≥ 25 table-driven tests in `handles.test.ts` using real URLs from `data/competitor_accounts.csv` (e.g. `https://vimeo.com/everyonefilms?fl=pp&fe=sh` → `everyonefilms`; `https://www.youtube.com/user/telfaz11` → `user/telfaz11`).

**Done when:** `pnpm --filter @emr/shared test` passes.

### T2: Seed competitors
In `scripts/seed/seed-competitors.ts`:
1. Read `data/competitors.csv`.
2. Map each row:
   - `company_code` = `company_id`;
   - `slug`;
   - `name`;
   - `markets[]`;
   - `hq_country`;
   - `categories[]` → codes;
   - `in_house[]` → codes;
   - `logo_url`;
   - `website_url`;
   - `priority_tier` (mapped);
   - `pilot_rank` (int or null);
   - `is_baseline`;
   - `status = 'active'`;
   - `notes`;
   - `source_sheet_row`.
3. Upsert with `insert … on conflict (company_code) do update set …`. Only update columns whose values changed, and keep human edits: skip a field if it was changed in the app later. In M02 there are no app edits yet, so a plain upsert is fine; record the M11+ rule "seed never overwrites admin-edited fields" in `scripts/README.md`.

**Done when:** `select count(*) from app.competitors` = 285 and the tier counts are 50/174/60/1.

### T3: Seed accounts (+ derived rows, pilot gating)
1. Read `data/competitor_accounts.csv`, join to competitors by `company_id`, and normalize with T1.
2. For each row, create a `competitor_accounts` row:
   - `platform`, `handle`, `url`;
   - `cadence = '1 day'`;
   - `backfill_from = '2024-01-01'`, `backfill_status = 'pending'`;
   - `resolve_status`: `pending` for vimeo/youtube, `not_needed` for the rest;
   - `next_due_at = now()`;
   - `status`: `active` when the competitor tier is pilot or baseline, else `paused`.
3. Derived rows:
   - For each `instagram` row, an `instagram_stories` row with the same handle, cadence 1 day, and `backfill_status = 'not_applicable'` (stories have no history, D-10).
   - For each `linkedin` row, a `linkedin_employees` row with the same slug, cadence 7 days, and `backfill_status = 'not_applicable'` (a snapshot, not history).
4. Website accounts:
   - `website` (root, used for the Firecrawl map only when the competitor has **no** work page): when the competitor **has** a `website_work_page` row, the root row is `status = 'paused'` permanently (it is never claimed); otherwise it follows pilot gating (`active` for pilot + baseline, else `paused`) with `backfill_status = 'pending'`.
   - `website_work_page` (the page that is mapped and diffed daily) has `backfill_status = 'pending'`.
5. Upsert on the unique key. If two competitors share a handle, the second fails with a unique violation; catch it, report it, and don't overwrite.

**Done when:** the counts below match (AC2/AC3).

### T4: Report script
`scripts/seed/report.ts` prints:
- the counts by `priority_tier`;
- the counts by `platform` × `status`;
- the counts by `resolve_status`;
- the list of duplicates and invalid URLs.

It writes `scripts/seed/out/report-<date>.md`; paste a copy into PROGRESS.

**Done when:** the report runs after T2/T3.

### T5: Resolve Vimeo (needs MA-07)
For each `vimeo` account (all tiers; resolution is cheap):
1. By kind:
   - `user` kind: `GET https://api.vimeo.com/users/{handle}?fields=uri,name,link` with header `Authorization: bearer $VIMEO_TOKEN` and `Accept: application/vnd.vimeo.*+json;version=3.4`. Set `external_id` = the last segment of `uri`.
   - `channels/x`: `GET /channels/{x}?fields=uri,name`.
   - `showcase/id`: `GET /albums/{id}?fields=uri,name` (showcases are albums in the API).
   - `groups/x`: `GET /groups/{x}?fields=uri,name`.
   - For non-user kinds, store `backfill_cursor = {"endpoint": "channels"|"albums"|"groups"}`.
2. Results: 200 → `resolve_status = 'resolved'`. 404 → `resolve_status = 'failed'`, `status = 'invalid'`, `last_error = 'vimeo_404'`.
3. Respect `X-RateLimit-Remaining`; wait until `X-RateLimit-Reset` when it is below 10. On 429, wait 60 s and retry up to 3 times.
4. Concurrency 2.

The live Vimeo docs could not be machine-read during research. Verify the endpoints and the `public` scope at developer.vimeo.com, and record any difference.

**Done when:** ≥ 95% of pilot Vimeo accounts are `resolved` (target: 47 of 48 incl. baseline).

### T6: Resolve YouTube (needs MA-08)
For each `youtube` account:
1. By kind (cost: 1 quota unit each):
   - `@h`: `GET https://www.googleapis.com/youtube/v3/channels?part=id,contentDetails,snippet&forHandle=@h&key=$YOUTUBE_API_KEY`.
   - `channel/UC…`: `…&id=UC…`.
   - `user/u`: `…&forUsername=u`.
   - `c/name`: try `forHandle=@name`. If empty, mark `resolve_status = 'failed'` with `last_error = 'yt_custom_url_unresolved'`; it is resolved later via the actor in M05, or by the owner.
2. Store `external_id = items[0].id` and `uploads_playlist_id = items[0].contentDetails.relatedPlaylists.uploads`.
3. An empty `items` array means not found: `status = 'invalid'`.

This uses about 130 units of the 10,000/day quota. Never use `search.list`.

**Done when:** ≥ 90% of YouTube accounts are resolved (pilot: all 11).

### T7: Instagram, LinkedIn, website checks (no APIs)
1. **Instagram:** handle-format validation only (`^[a-z0-9._]{1,30}$`). There is no network check: IG blocks anonymous requests, and the real check happens in M04 with the actor. Invalid format → `status = 'invalid'`.
2. **LinkedIn:** slug format; `kind` must be `company` or `showcase`. School pages or personal `/in/` URLs → `invalid` (they should not be in the CSV; report any).
3. **Websites:** an HTTP `HEAD` (or `GET` if HEAD isn't allowed) with a 10 s timeout and a desktop UA. Follow redirects and store the final URL in `url` if the domain is the same.
   - Results: 2xx/3xx → ok. 4xx/5xx/timeout → keep `active` but set `last_error = 'unreachable_<code>'` and add to the report (don't mark invalid on a single failure).
   - Respect a polite rate: concurrency 5.

**Done when:** the report lists all invalid and unreachable rows.

### T8: Copy logos to Storage (Q-10 default)
1. For each competitor with a `logo_url`:
   - download it (10 s timeout, max 5 MB);
   - rasters (png/jpg/webp) → resize with sharp to max 256 px width, as `webp`;
   - SVG → keep it as-is, after a basic sanitize: reject files containing `<script` or `on*=` attributes.
2. Upload to `media/logos/{slug}.webp` (or `.svg`) with the secret key, owner-run, or signed upload URLs. Set `logo_path`.
3. A failure leaves `logo_path` null and is listed in the report. The app falls back to the competitor's initials tile.
4. Also insert into `app.media_assets` (`kind = 'logo'`, `competitor_id`, `storage_path`, `source_url`).

Note for the owner: some logos are white-on-transparent. The UI shows logos on dark tiles (DESIGN.md), so that's fine.

For the baseline (C000, which has no `logo_url`), upload `assets/brand/everyone-logotype.svg` as `media/logos/everyone-films.svg`.

**Done when:** ≥ 95% of the 267 competitors with a `logo_url` have `logo_path`, plus the baseline. The remaining 17 rows have no logo URL and show the initials tile.

### T9: Owner review (MA-09)
1. Post the report summary in PROGRESS:
   - counts;
   - unresolved Vimeo/YouTube accounts;
   - invalid handles;
   - unreachable websites;
   - duplicate handles across competitors;
   - logos missing.
2. The owner marks each item `fix: <new url>`, `invalid`, or `ok` in the PROGRESS table, or in `scripts/seed/overrides.csv` (committed; no secrets).
3. The seed script applies `overrides.csv` (columns `company_id`, `platform`, `url`, `action` = `replace` | `invalid` | `add`) on every run, so fixes survive re-seeds.
4. Re-run seed + resolve + report.

**Done when:** the owner has signed off, and the pilot has no unresolved Vimeo/YouTube accounts and no invalid accounts without a decision.

### T10: Seed prod (owner OK)
1. After the owner writes "approved: seed prod", run T2–T8 against prod with `SEED_DATABASE_URL` for prod.
2. Run `scripts/assert/m02_counts.sql` on both projects and paste the results.

**Done when:** prod counts = dev counts.

### T11: Docs and hand-off
1. Update `data/README.md` if any counts changed after the overrides.
2. Note the deviations in DECISIONS → Changes (e.g. accounts dropped).
3. Fill in the hand-off and update the root board.

## 8. Interfaces & contracts touched

| Contract | Detail |
|---|---|
| `app.competitors` | `company_code` C000–C284 stable forever (referenced by sheet + app) |
| `app.competitor_accounts` | Unique `(platform, handle_norm)`; `external_id` (Vimeo numeric id / YouTube UC id), `uploads_playlist_id` (UU…), `backfill_cursor.endpoint` for Vimeo non-user kinds |
| Pilot gating | Active = tier `pilot` or `baseline`; everything else `paused` until M15 waves |
| Storage | `media/logos/{slug}.{webp\|svg}` |
| Overrides | `scripts/seed/overrides.csv` (company_id, platform, url, action) |
| Env (names only) | `SEED_DATABASE_URL`, `SUPABASE_SECRET_KEY` (scripts only), `NEXT_PUBLIC_SUPABASE_URL` (for Storage client), `VIMEO_TOKEN`, `YOUTUBE_API_KEY` |

## 9. Acceptance criteria

Write these as SQL in `scripts/assert/m02_counts.sql`. Expected values are from the CSVs; any deviation must be explained by `overrides.csv`.

| # | Criterion | Check (expected) |
|---|---|---|
| AC1 | Competitors loaded | `select count(*) from app.competitors` = **285**; by tier: pilot 50, next_wave 174, adjacent 60, baseline 1; exactly one `is_baseline` (`C000` Everyone Films) |
| AC2 | Primary accounts loaded | `select platform, count(*) … group by 1` → website **261**, website_work_page **199**, instagram **256**, vimeo **202**, youtube **128**, linkedin **226** (total 1,272) |
| AC3 | Derived accounts | instagram_stories **256**, linkedin_employees **226** (cadence `7 days`); total accounts **1,754** |
| AC4 | Pilot gating | `status='active'` only where the competitor tier is pilot/baseline: primary-platform active ≈ **161 + 38 work pages** (website roots 11 — the other 38 pilot roots are `paused` because those competitors have a work page — instagram 49, vimeo 48, linkedin 42, youtube 11, website_work_page 38) + stories 49 + employees 42; every other account `paused` (or `invalid`) |
| AC5 | Resolution | Pilot Vimeo resolved ≥ 95%; pilot YouTube resolved 100% (11/11); all Vimeo/YouTube rows have `resolve_status` ≠ `pending` |
| AC6 | Backfill flags | Primary content accounts (vimeo, instagram, youtube, linkedin, website_work_page) `backfill_status='pending'`, `backfill_from='2024-01-01'`; stories and employees `not_applicable`; `website` roots `paused` when the competitor has a work page, else `pending` (and active only for pilot + baseline) |
| AC7 | Idempotent | Running `seed-competitors.ts` a second time reports `0 inserted, 0 updated` and the counts are unchanged |
| AC8 | Logos | ≥ 95% of competitors with a source `logo_url` have `logo_path`; files are visible at the public Storage URL |
| AC9 | Owner sign-off | MA-09 ticked in PROGRESS; overrides applied |
| AC10 | Prod mirrors dev | AC1–AC6 queries return the same numbers on prod |
| AC11 | Tests | `handles.test.ts` ≥ 25 cases pass; CI green |

## 10. Tests to write

- `packages/shared/src/handles.test.ts`: normalization (≥ 25 cases, real URLs).
- `scripts/seed/seed-competitors.test.ts` (Vitest, against local Supabase): seeding a 5-row CSV fixture twice gives the same counts; tier mapping; derived rows; the overrides `replace`/`invalid`.
- `scripts/assert/m02_counts.sql`: AC queries (run manually; results pasted).

## 11. Manual actions from the owner

| MA | What | When | How Codex verifies |
|---|---|---|---|
| MA-07 | Vimeo developer app + access token (scope **public**) → give `VIMEO_TOKEN` to Codex's local env; it goes into n8n in M03 | Before T5 | `GET /users/everyonefilms` returns 200 |
| MA-08 | Google Cloud: enable YouTube Data API v3, create an API key restricted to it → `YOUTUBE_API_KEY` | Before T6 | `channels.list forHandle=@AflamProductions` returns 1 item |
| MA-09 | Review the unresolved/suspect list; reply `ok` / `invalid` / `fix: <url>` per row | T9 | `overrides.csv` committed; re-run report clean |
| (approval) | "approved: seed prod" | T10 | Written in PROGRESS |

## 12. Risks & gotchas

- **`hq_country_guess` is the first listed market.** Some multi-market houses will be wrong. Leave it for the owner to fix in admin (M11). Briefs use the item's `country`, not the HQ.
- **Shared handles:** some competitors share parent-company accounts. The earlier research excluded those, but the unique key will catch any left. Report them; don't merge them silently.
- **Vimeo `/user123` vanity:** works with `/users/user123`.
- **Vimeo showcase/channel URLs:** use the album/channel endpoints. M04 handles listing with `backfill_cursor.endpoint`.
- **YouTube `/c/` custom URLs** often can't be resolved via the API. Flag them for the M05 actor fallback.
- **Don't call Instagram anonymously** from scripts. It rate-limits and blocks; validation happens through the actor in M04.
- **Logos:** some URLs are hot-link protected (403). Retry once with a `Referer` header set to the competitor's site. If it still fails, report it. Never scrape logos from other sites.
- **Secrets:** `SEED_DATABASE_URL` and the secret key stay local. Never put them in CI unless the owner sets up a protected environment.
- **Verify current docs:** Vimeo API endpoints and scopes; YouTube `channels.list` `forHandle` (documented 2026-10-17).

## 13. Cost & budget notes

Everything here is free: the Vimeo API, about 130 YouTube quota units of the 10,000/day free quota, and HTTP HEADs. Storage for about 270 logos is under 10 MB.

## 14. Definition of done & hand-off

- All ACs pass on dev and prod, with the evidence in PROGRESS; the PR is merged; root PROGRESS.md shows M02 Done and M03 current.
- **M03 expects:**
  - active pilot accounts claimable by `ops.get_due_accounts` in `backfill` mode (`backfill_status = 'pending'`);
  - `data/test_accounts.csv` handles present in the DB;
  - Vimeo/YouTube IDs ready for the M04/M05 collectors;
  - `VIMEO_TOKEN` and `YOUTUBE_API_KEY` ready to add as n8n credentials.
