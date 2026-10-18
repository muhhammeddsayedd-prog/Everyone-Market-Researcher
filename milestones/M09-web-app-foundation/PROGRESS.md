# M09 — Web app foundation · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.
> **Parallel-OK while the pilot runs:** also run the daily pilot check each working session and log it in `milestones/M08-campaign-linker-pilot-launch/PROGRESS.md` → Pilot monitoring log.

## Status
**In progress — early parallel frontend track** (owner-authorized 18 Oct 2026; not complete) <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | 2026-10-18 (early parallel frontend track) |
| Last updated | 2026-10-18 |
| Finished | — |
| Branch / PR | `m09-frontend-company-browsing` (frontend track, draft PR) |
| Current task | Company-browsing journey built and tested on an isolated local stack; real dev reads blocked on MA-19 (local) |
| Next step | Owner completes MA-19 (local) below; then verify the journey on dev and record observed counts; then the next frontend group |
| Caching option (A shared reader / B per-user) | **B per-user** for the frontend track (owner: no `api_agent`/service role for app reads). Codex to record in DECISIONS. |

## Early parallel frontend track (owner-authorized 18 Oct 2026)

The owner authorized an early, bounded frontend track. It covers parts of M09, M10 and M11 while
Codex continues M03. Milestone numbers and acceptance criteria are unchanged. **Nothing below
closes M09, M10 or M11.** Codex owns the root board and the DECISIONS entry for this
parallel scope.

**What it delivers:** "Frontend foundation with authenticated dev company browsing". The journey is
sign in → browse → filter → open a company → sources → open original → back to the preserved list.

### Built (branch `m09-frontend-company-browsing`, from `main` dc146f8)

**Configuration and auth**

- **Fail-closed configuration.** Missing or invalid public config makes every route return 503 with
  `private, no-store`. A secret key placed in the publishable slot is rejected.
- **Session handling:**
  - `proxy.ts` (Next 16 Proxy, Node runtime) refreshes the session with `getClaims()`.
  - The `(app)` layout **and** every page check `getClaims()` and then `app.me()`. A missing,
    disabled or never-invited membership goes to `/no-access`.
  - Admin and review routes return a server-side 404 below their role.
- **Sign-in flow:** `/login` → Google OAuth (PKCE, via a server action) → `/auth/callback`.
  - The callback accepts only a validated relative `next`.
  - Sign-out is a server action that ends the local session.
  - There is no password path and no bypass.

**Shell and design**

- **App shell** per DESIGN.md §5:
  - 248 px sidebar on desktop, collapsible (Ctrl/⌘ + \); 72 px rail on tablet; bottom nav plus
    menu sheet on phones.
  - Skip link, ⌘K notice ("Search is coming in M11"; no search calls), URL-kept market switcher,
    user menu with theme.
- **Tokens, fonts, motion:**
  - Everyone tokens and the wordmark. IBM Plex Sans Arabic is self-hosted.
  - General Sans is used only when provisioned (see the font action below).
  - Motion uses the token durations. Under reduced motion all durations are 0, with no shimmer and
    no scale.

**Company screens**

- **`/competitors`:**
  - Grid and list views; search by name, slug or code.
  - Filters: tier, category, in-house capability, status and market.
  - Four sorts, each with an id tiebreak; keyset Prev/Next with opaque cursors (never OFFSET).
  - The baseline is pinned on page 1.
  - Per company: 5-platform status dots and recorded activity, or "No activity collected yet".
  - Coverage strip; every state lives in the URL.
- **`/competitors/[slug]`:**
  - Header: logo or initials fallback, Arabic name, links to the original sources.
  - Overview: facts, notes and a sources summary.
  - **Sources** tab: configuration, resolution, eligibility and observed collection as separate
    columns. Profiles shared between collection types are grouped. The D-27 reviewed exclusions and
    `unreachable_*` flags are shown as recorded.
  - **In-house** tab: grouped capabilities.
  - The seven other tabs show explicit "Not available yet" states naming their dependency.
- **`/coverage`:** counted from records for pilot+baseline and for all tiers, with fixtures excluded.
- **Every planned page** (Pulse, Feed, Campaigns, …, Admin) shows a ComingSoon page naming its
  milestone and dependency. No fake buttons and no sample data.
- **Page and dependency map:** `apps/web/README.md`, generated from `apps/web/lib/nav/registry.ts`.

### Real data status

- **Isolated local Supabase stack: verified.**
  - Real migrations from `main` and real RLS.
  - Labelled fixtures: 59 companies plus C999, which is excluded.
  - Genuine local sessions for member, admin, disabled and outsider.
- **Dev (`zmotjsbzhzjvpelxvxlf`): BLOCKED, not verified.** It needs MA-19 (local) below and the
  owner's own Google sign-in. The expected baseline (285 companies including Everyone, 1,754
  sources, 257 stored logos, seven D-27 exclusions) is **not** hard-coded anywhere. It will be read
  and recorded once a dev session exists.

### Verification (local, 18 Oct 2026)

| Check | Result |
|---|---|
| `pnpm lint`, `format:check`, `typecheck` | Pass |
| `check:secrets` | 909 tracked files, 0 violations |
| Web unit and component tests (Vitest) | 65/65 pass |
| Fail-closed e2e (no configuration) at 4 viewports | 12/12 pass |
| Authenticated e2e on the isolated stack | 76 pass, 0 fail (88 desktop-only cases skipped on other viewports) |
| GitHub CI on PR #9 head `1cb83b2` | quality, unit, build, e2e, db-tests and the new web-auth-e2e all pass (run 39109220989) |

The authenticated suite covers:

- all four sorts walking every page with no missing or duplicate rows;
- the full journey, including a popup to a stubbed original source;
- signed-out, outsider, disabled and viewer-on-admin denial;
- the OAuth PKCE redirect, forged callbacks and open-redirect attempts;
- axe at 0 serious/critical on 9 pages × 4 viewports;
- no horizontal overflow, keyboard focus traps and reduced motion.

Screenshots are in `apps/web/e2e/__screenshots__/`.

`pnpm test` at the root shows 13 failures in `scripts/seed/youtube-diagnostic-runner.test.ts`. That
is an M02 Windows-runner test on the local machine, in a file this branch does not touch. It is not
caused by this track. CI's Linux `unit` job passes.

### Not done yet (still open in M09)

- Date-range picker, pipeline status dot, `/dev/components`, `last_seen_at` (needs
  `app.touch_last_seen()`), feed, drawer, pulse.
- `/api/revalidate` and WF-70.
- next-intl (strings are centralised in typed modules for now).
- Lighthouse.
- Sticky compact entity header.
- Vercel preview.

### Backend contracts still missing (Codex)

- **Fixture classification:** a column or view to replace the `company_code='C999'`/slug convention.
- **`app.competitor_overview_v` (M10):** period activity and an accounts-health summary.
- **Activity data:** `stats_daily` must be populated before activity sort and sparklines can work.
- **Pipeline:** `app.pipeline_summary(1)`.
- **Last seen:** `app.touch_last_seen()`.
- **Review and admin mutation RPCs (M11).**

## Task checklist
- [ ] T1 Extend the M00 `apps/web` (keep `api/internal/*`; Next.js pinned, TS strict, Tailwind v4, lint rules, Vitest, Playwright, shared package wired)
- [ ] T2 Fonts downloaded (General Sans Medium/Semibold/BoldItalic from Fontshare; IBM Plex Sans Arabic Regular/Medium/SemiBold) + LICENSES.md; tokens → Tailwind `@theme`; dark/light themes
- [ ] T3 UI primitives per DESIGN.md §6 + `/dev/components`
- [ ] T4 Supabase SSR clients + session refresh (getClaims vs getUser verified) + caching decision (A/B) recorded
- [ ] T5 `/login`, `/auth/callback`, membership gate via `app.me()`, `/no-access`, role-aware nav + server-side route guards, `last_seen_at`
- [ ] T6 App shell: sidebar, top bar (⌘K shell, MarketSwitcher `?market=`, DateRangePicker, pipeline status dot, user menu), mobile bottom nav + three-dot menu sheet, ComingSoon placeholders
- [ ] T7 `/feed`: FilterBar (URL-synced), grid/list, keyset infinite scroll on `app.feed_v`, NewItemsPill, empty states
- [ ] T8 Item drawer (intercepting route) + `/items/[id]` full page + Similar items
- [ ] T9 `/` Market pulse: KPI tiles, big launches, charts, latest, pipeline strip (counts verified vs SQL)
- [ ] T10 `/api/revalidate` + `ops.should_publish` (+ `ops.publish_log`) + WF-70 real [dev]/[prod], exported
- [ ] T11 next-intl scaffolding, formatters, 404/500, skeleton/empty/error states
- [ ] T12 e2e (auth, feed), axe a11y, Lighthouse ≥ 90 on `/` and `/feed`
- [ ] T13 Vercel preview (dev) + production (prod), env vars, auth URLs, first users, pilot slice copied to dev

## Acceptance criteria
- [ ] AC1 CI green incl. e2e + a11y — evidence:
- [ ] AC2 Auth gate (unauth → login, non-member → no-access, member → /, viewer on admin/review → 404) — evidence:
- [ ] AC3 No secrets in client bundles (grep result) — evidence:
- [ ] AC4 `/feed` on production shows real pilot items; filters/toggle/infinite scroll OK, no duplicate IDs — evidence:
- [ ] AC5 Drawer + `/items/[id]` complete, RTL Arabic OK, Open on source, Similar items — evidence:
- [ ] AC6 Pulse tiles equal SQL counts (table) — evidence:
- [ ] AC7 Revalidation end to end; 401 on bad secret; debounce — evidence:
- [ ] AC8 Responsive 375/768/1024/1440, mobile nav + menu sheet (screenshots) — evidence:
- [ ] AC9 Lighthouse ≥ 90 perf/a11y (mobile) on `/` and `/feed`; axe 0 serious/critical — scores:
- [ ] AC10 Caching choice recorded in DECISIONS; reader server-only + gated (if A) — evidence:
- [ ] AC11 Owner signed in on production — evidence:

## Blockers
- none

## Manual actions needed from the owner
| # | Action | Why | Status |
|---|---|---|---|
| MA-19 | Supabase Auth URL configuration (Site URL + redirect URLs for localhost, Vercel previews, production) + matching Google OAuth redirect domains; confirm first users to invite | Google sign-in on preview and production | **Local part requested 18 Oct** (next row); preview/prod parts later |
| MA-19 (local) | 1) Supabase dashboard → project **emr-dev** (`zmotjsbzhzjvpelxvxlf`) → Authentication → URL Configuration → Redirect URLs → **Add URL** `http://localhost:3000/**` → Save. Do not change the Site URL, providers or users. 2) Project Settings → API Keys → copy the **publishable** key (`sb_publishable_…`; it is safe for browsers and is not a secret). 3) In the frontend worktree, create `apps/web/.env.local` with `NEXT_PUBLIC_SUPABASE_URL=https://zmotjsbzhzjvpelxvxlf.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<that key>` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (or send Claude the publishable key to do it). 4) Run `pnpm dev`, open `http://localhost:3000` and sign in with your invited Google account. The existing invite trigger creates your membership; no policy changes. 5) Reply **"Dev sign-in done"**. | Real authenticated dev reads for the company journey. Google already redirects to the Supabase callback, so nothing changes in Google Cloud. | Requested 18 Oct |
| Font (no MA id yet; Codex to assign) | Decide how General Sans reaches builds: (a) a build step downloads it from Fontshare into `apps/web/public/fonts/` (gitignored); or (b) keep it in a private store. Until then the app uses system fonts. | The ITF licence forbids redistributing the files through this **public** repository | Requested 18 Oct |
| MA-20 | Vercel env vars: Preview = dev, Production = prod (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `INTERNAL_WEBHOOK_SECRET`, `API_AGENT_DATABASE_URL` if Option A) | Builds and data access | Not requested yet |
| — | Run `scripts/copy-pilot-slice.ts` (prod → dev, no raw payloads/costs/keys/members) | Realistic previews | Not requested yet |

## Decisions & deviations
- 2026-10-18 · **Option B (per-user reads)** for the frontend track: the owner forbade `api_agent`, `n8n_writer` or the service role as a stand-in for the app user. All responses are `private, no-store`. Codex records this in DECISIONS.
- 2026-10-18 · **Next 16 `proxy.ts`** instead of `middleware.ts`, per current Next docs (middleware is deprecated). `getClaims()` is used everywhere on the server.
- 2026-10-18 · **General Sans is not committed.** The repository is public and the ITF FFL forbids repository redistribution. The build detects a provisioned file. IBM Plex Sans Arabic (OFL) is committed.
- 2026-10-18 · **next-intl deferred.** UI strings live in typed modules (`lib/view/*`, `lib/nav/registry.ts`). T11 stays open.
- 2026-10-18 · **Account-status colours: DESIGN.md §3.3 wins** over M10 MILESTONE T4 (DESIGN failing = danger, invalid = warning; M10 says the reverse). `disabled` maps to muted. The losing M10 line is flagged for Codex/owner and was not edited here.
- 2026-10-18 · **Fixtures:** C999 (`emr-smoke-test` on dev, `test-house` locally) is excluded from every query and count until a fixture column exists.
- 2026-10-18 · **Default directory sort is name.** Activity sort waits for `stats_daily`. Pilot-rank sort is not offered yet (keyset with nulls).
- 2026-10-18 · **Mobile bottom nav** is Pulse · Competitors · Search · Review (analyst+) or Coverage (viewer) · Menu, so the delivered journey is one tap away.
- 2026-10-18 · **`.gitignore` gotcha:** the root rule `coverage/` hides any folder with that name. `apps/web/.gitignore` re-includes the `/coverage` route; libraries use other names.

## Risks / notes for the owner
- Pages not built yet (feed, campaigns, review, admin…) show a ComingSoon page naming the milestone and what it waits for, so the navigation is complete from day one.
- The authenticated e2e suite needs Docker. It starts its own isolated stack on ports 613xx and never touches the M03 stack (603xx) or any hosted project.

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-18 · Fixed an Arabic-text fallback that requested the unprovisioned General Sans file (failed only in CI). PR #9 CI is all green at `1cb83b2` (run 39109220989). The Vercel preview is behind the existing SSO deployment protection; it was not changed.
- 2026-10-18 · Early frontend track (Claude): shell, auth gate, company directory/profile/sources/coverage, fail-closed config, isolated-stack e2e plus CI job `web-auth-e2e` · `apps/web/**`, `.github/workflows/ci.yml` · lint/format/typecheck/secrets pass; web unit 65/65; fail-closed e2e 12/12; authenticated e2e 76 pass / 0 fail. Real dev reads blocked on MA-19 (local).
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: component inventory, lib/data pattern, caching option, perf hot spots, placeholders M10 must replace. -->
- —
