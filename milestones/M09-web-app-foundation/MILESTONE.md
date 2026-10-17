# M09 — Web app foundation

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first, then the root `PROGRESS.md`.
> **Parallel-OK:** this milestone runs while the 14-day pilot collects data (M08). In every working session, also run the daily pilot check and log it in `milestones/M08-campaign-linker-pilot-launch/PROGRESS.md` → Pilot monitoring log.

## 1. Goal and outcome

Ship the signed-in shell of everyone. Market Radar on Vercel: brand-true dark UI, invite-only Google sign-in, the app shell, and the first two real pages built on pilot data:
- **Market pulse** (`/`)
- **Live feed** (`/feed`), with the item drawer and the full item page `/items/[id]`

When M09 is done:
- **Sign-in:** the owner signs in with Google. Someone who isn't invited lands on `/no-access`.
- **Pages:** the owner sees today's pilot items with thumbnails, filters, a grid/list toggle and infinite scroll, and every item opens at its source.
- **Freshness:** pages refresh when n8n publishes (WF-70 → `/api/revalidate`).
- **Quality:** Lighthouse ≥ 90 for performance and accessibility on `/` and `/feed`, with no serious axe violations.

## 2. Context you need

**Stack** (`docs/TECHNICAL.md` §3 and §10). Verify the current versions and pin them exactly:
- Next.js (latest stable, App Router, RSC) with TypeScript strict;
- Tailwind CSS v4 mapped to `assets/brand/tokens.css`;
- Radix primitives restyled per `DESIGN.md` (shadcn-style components copied into `apps/web/components/ui/`, not imported as a kit);
- TanStack Table, Recharts, lucide-react (1.5 px stroke), `next-intl` (en only), zod, and `@supabase/ssr` + `@supabase/supabase-js`.

**Design:** `DESIGN.md` is the build spec.
- **Look:**
  - black stage `#000`;
  - surfaces `#0b0b0c`, `#141416`, `#1c1c1f`;
  - hairline borders `#26262a` and `#3a3a40`;
  - text `#fff`, `#c4c4c4`, and muted `#8e9094`;
  - **one green accent** `#00cd6d`.
- **Glass chips over imagery:** `rgba(245,245,245,.72)` + 12 px blur, black text, radius 8.
- **Fonts:** General Sans (Medium 500 / Semibold 600 / Bold Italic 700) and IBM Plex Sans Arabic for Arabic.
- **Rules:** no shadows except popovers and dialogs; skeletons, not spinners.
- **Routes and components:** see DESIGN.md §5–§8.

**Shell** (DESIGN.md §5):
- Left sidebar, 248 px, collapsible to 72 px (⌘\). It holds the wordmark + "Market Radar" and the groups RADAR · MARKET · WORK · ADMIN; the ADMIN group is shown to admins only.
- Top bar, 64 px. It holds:
  - the ⌘K search trigger (SearchCommand shell; real search comes in M11);
  - the **MarketSwitcher** EG · KSA · UAE · All (`?market=` + localStorage);
  - the **DateRangePicker** with presets;
  - a **pipeline status dot** (from `app.pipeline_summary(1)`: green "Up to date hh:mm" / warning "Running" / danger "n sources failing"; links to `/admin/pipeline` for admins);
  - the user menu.
- On mobile: a bottom nav (Pulse, Feed, Search, Review, Menu) where Menu is the site's white rounded-square three-dot button.

**Auth** (`docs/DECISIONS.md` T-11, `reference/sql/003_auth_rls_views.sql`):
- Invite-only. A trigger on `auth.users` turns an `app.member_invites` row into an `app.members` row.
- `app.me()` returns `{user_id, email, full_name, role, status}`, or null when there is no membership. No membership means `/no-access`.
- Roles: viewer < analyst < admin.
- Never authorize using `user_metadata`.

**Data:**
- **Feed:** `app.feed_v`, a security-invoker view over `app.items` + competitors + organizations + `campaign_items`, which excludes duplicates. Keyset pagination on `(published_at desc, id desc)`.
- **Pulse:** `app.stats_daily`, `app.campaigns`, `app.review_tasks` (open). `app.stats_daily` is filled by `ops.refresh_stats_daily`. If M10 hasn't implemented it yet, compute the M09 tiles directly from `app.items` (good enough for pilot volume) and switch in M10.

**Caching** (TECHNICAL §10, API_SPEC §6.1):
- **Cache tags:** `feed`, `stats`, `item:{id}`, `competitor:{slug}`, `campaign:{id}`, `brand:{slug}`, `agency:{slug}`, `person:{slug}`, `brief:{week}`, `campaigns`, `news`, `briefs`.
- **Revalidation:** `POST /api/revalidate` with header `x-emr-secret` = `INTERNAL_WEBHOOK_SECRET` and body `{tags:[…]}` (≤ 50, regex `^[a-z0-9:_-]{1,80}$`) → `revalidateTag` each tag → `200 {revalidated:[…]}`.
- **Debounce:** WF-70 calls `ops.should_publish(tags)` first (5-minute debounce; this RPC is added in this milestone).
- **Note:** `/api/revalidate` and every `/api/internal/*` route use the single secret `INTERNAL_WEBHOOK_SECRET` (header `x-emr-secret`), as in API_SPEC §6.1 and ENVIRONMENT.

**Caching with RLS (decide in T4):** members all see the same data, but RLS-scoped per-user reads can't share a cache. Approach:
- **Option A (recommended):**
  - Check membership once per request in the `(app)` layout (`app.me()` with the user's session).
  - Then do the cacheable list/detail reads through a **server-only shared reader**: postgres.js connected as `api_agent` via `API_AGENT_DATABASE_URL` (Supavisor transaction mode, port 6543, `prepare: false`). This role has RLS read policies on `app.*` (003 SQL).
  - Wrap the reads in the current Next.js cache API (verify `'use cache'` + `cacheTag`/`cacheLife` vs `unstable_cache`) with tags.
  - The reader module lives in `apps/web/lib/db/reader.ts`, carries `import 'server-only'`, is lint-restricted to `lib/data/*`, and never runs before the membership check.
- **Option B (fallback):** per-user `@supabase/ssr` reads, dynamic rendering, no cross-user cache.
- **Record the choice** in `docs/DECISIONS.md` → Changes. Option A moves `API_AGENT_DATABASE_URL` from M14 to M09, which needs MA-20.

**Images:**
- `next/image` with `remotePatterns` for the Supabase Storage public URL of the `media` bucket (`/storage/v1/object/public/media/**`) and for the source CDNs only as a fallback when `thumbnail_path` is null.
- Set `sizes` per grid.
- Alt text: "{format} by {competitor} for {brand} on {platform}".

**Arabic:** content elements (captions, titles, `summary_ar`, `name_ar`) use `dir="auto"` and `lang="ar"` when known. Arabic gets line height +0.15. The font stack falls back to IBM Plex Sans Arabic via `unicode-range`.

**Environments:**
- **Preview:** Vercel preview → **dev** Supabase.
- **Production:** Vercel production → **prod** Supabase, which holds the pilot data. Production is behind invite-only auth.
- **Dev data:** load a pilot slice into dev (T13) so previews look real.

## 3. Prerequisites

- **Milestones:**
  - M00, for the monorepo with `apps/web` and CI;
  - M01, for the schema, `app.me`, `app.feed_v` and RLS;
  - M08 Done (pilot live) for real data. With dev fixtures, M09 can start once M08 is in its 3-clean-days wait.
- **Manual actions:**
  - MA-06 Google OAuth provider (done in M01);
  - **MA-19** auth redirect URLs + first users;
  - **MA-20** Vercel env vars (Preview = dev, Production = prod).

## 4. Scope

**In:**
- the `apps/web` app;
- self-hosted fonts;
- tokens → Tailwind v4 theme;
- UI primitives;
- the app shell (desktop, tablet and mobile);
- Google sign-in + `/auth/callback` + session refresh;
- `/login`, `/no-access` and role-aware nav;
- `/` Market pulse, `/feed`, the item drawer and `/items/[id]`;
- `/api/revalidate` + `ops.should_publish` + a real WF-70;
- `next-intl` scaffolding;
- the global 404 and 500 pages;
- `/dev/components` (dev only);
- Playwright e2e for the sign-in gate and the feed;
- axe and Lighthouse checks;
- Vercel preview and production deploys.

**Out:**
- competitor, campaign, brand, agency, people, compare and markets pages (M10);
- real search, review and admin pages (M11);
- briefs, news and alerts pages (M13; nav entries may exist and link to a "Coming soon" placeholder);
- the REST API and MCP (M14).

## 5. References

- `DESIGN.md` §1–§8 (in particular §5 shell, §6 components, §8.1 login, §8.2 no-access, §8.3 pulse, §8.4 feed, §8.5 item detail, §8.26 errors) and §9–§11
- `docs/DESIGN_STYLE.md` (voice, logo rules, contrast table)
- `assets/brand/tokens.css`, `tokens.json`, `everyone-logotype.svg` (currentColor), `everyone-menu-dots.svg`, `everyone-wordmark-on-black.png`
- `docs/TECHNICAL.md` §10, §12 (security checklist), §14 (performance)
- `docs/API_SPEC.md` §6.1 (`/api/revalidate`)
- `docs/N8N_WORKFLOWS.md` WF-70 (+ `ops.should_publish` in §8)
- `docs/DATA_SCHEMA.md` §3, §5, plus `reference/sql/003_auth_rls_views.sql` (`app.feed_v`, `app.me`)
- `docs/ENVIRONMENT.md` §2 (Vercel)
- `docs/TESTING.md`
- Supabase SSR docs (verify the current recommended middleware/proxy pattern and `getClaims()` vs `getUser()`: `https://supabase.com/docs/guides/auth/server-side/nextjs.md`)

## 6. Deliverables

1. `apps/web` Next.js app:
   - `app/(auth)/login`
   - `app/no-access`
   - `app/auth/callback/route.ts`
   - `app/(app)/layout.tsx` (membership gate + shell)
   - `app/(app)/page.tsx` (pulse)
   - `app/(app)/feed/page.tsx`
   - `app/(app)/@drawer/(.)items/[id]` (intercepting route drawer)
   - `app/(app)/items/[id]/page.tsx`
   - `app/api/revalidate/route.ts`
   - `not-found.tsx`, `error.tsx`, `global-error.tsx`
   - `app/dev/components` (dev only)
2. Fonts in `apps/web/public/fonts/`, loaded with `next/font/local`:
   - `GeneralSans-Medium.woff2`, `GeneralSans-Semibold.woff2`, `GeneralSans-BoldItalic.woff2`
   - `IBMPlexSansArabic-Regular.woff2`, `IBMPlexSansArabic-Medium.woff2`, `IBMPlexSansArabic-SemiBold.woff2`
   - plus `apps/web/public/fonts/LICENSES.md`.
3. `apps/web/styles/tokens.css` (copied from `assets/brand/tokens.css`) + `globals.css` with the Tailwind v4 `@theme` mapping.
4. `components/ui/*`: Button, IconButton, Chip/FilterChip, GlassLabel, PlatformBadge, CountryBadge, ConfidenceMeter, StatusPill, LogoTile, Avatar, Tabs, Sheet/Drawer, Dialog, Toast, Skeleton, EmptyState, KeyValue, ViewToggle, MarketSwitcher, DateRangePicker, Tooltip, DropdownMenu, CodeBlock.
5. `components/features/*`:
   - `shell/` (Sidebar, Topbar, BottomNav, MobileMenuSheet, PipelineStatusDot, UserMenu, SearchCommand shell)
   - `feed/` (ItemCard, ItemRow, FeedGrid, FeedList, FilterBar, InfiniteList, NewItemsPill, ItemDrawer, ItemDetail)
   - `pulse/` (StatTile, BigLaunches, MostActiveBar, NewClientsList, OutputByPlatformArea, FormatsShare, PipelineStrip)
   - chart wrappers (`charts/`: LineChart, BarChart, AreaSpark, ShareBar), each with "View as table".
6. Libraries:
   - `lib/supabase/{server,client,middleware}.ts`
   - `lib/auth/requireMember.ts`
   - `lib/db/reader.ts` (if Option A)
   - `lib/data/{feed,pulse,items,pipeline}.ts` (typed, cached, tagged)
   - `lib/cache/tags.ts`
   - `lib/format/{date,number,platform}.ts`
   - `lib/i18n/` + `messages/en.json`
7. Migration `web_foundation` (`supabase migration new web_foundation`):
   - `ops.should_publish(p_tags text[]) → text[]`
   - `app.pipeline_summary(p_days int) → jsonb` (simplified fields for all members, full fields for admins; private worker)
   - any feed helper index found by EXPLAIN
   - pgTAP tests.
8. **WF-70 · Publish [dev]/[prod]** made real (finish the stub if one exists) and exported to `n8n/workflows/WF-70-publish.json`.
9. Tests: `apps/web/e2e/{auth.spec.ts, feed.spec.ts, a11y.spec.ts}`, unit tests for the formatters and components, and `apps/web/tests/api/revalidate.test.ts`.
10. `scripts/copy-pilot-slice.ts` (owner-run): copies about 2 weeks of pilot data, without raw payloads, from prod to dev for previews.
11. `apps/web/README.md`: how to run locally, env vars, auth setup, caching approach.

## 7. Tasks

### T1 — Extend the M00 app (`apps/web`)

**Steps:**
1. **Extend** the Next.js app that M00 scaffolded (do not re-create it). Keep the existing `app/api/internal/*` routes from M06 (media upload) untouched. Check the pinned Next.js version is still the latest stable (`npm view next version`); bump and pin exactly if needed. TypeScript strict, App Router, no `src/` dir.
2. Add Tailwind v4, ESLint (with `no-restricted-imports` to keep `lib/db/reader.ts` and `lib/supabase/admin.ts` out of client code), Prettier, Vitest and Playwright.
3. Wire `packages/shared` (generated `db.types.ts`, zod schemas, taxonomy enums).
4. Add `apps/web/.env.example` mirroring `templates/.env.example`.

**Done when:** `pnpm --filter web dev` serves a blank page; CI lint, typecheck and build are green.

### T2 — Fonts, tokens, theme

**Steps:**
1. Download the fonts:
   - **General Sans** Medium, Semibold and Bold Italic (woff2) from Fontshare (`https://www.fontshare.com/fonts/general-sans`, ITF Free Font License, which allows commercial use and self-hosting);
   - **IBM Plex Sans Arabic** Regular, Medium and SemiBold (woff2; OFL, from Google Fonts or the IBM Plex GitHub release).

   Put them in `apps/web/public/fonts/` and record the sources and licences in `public/fonts/LICENSES.md`. If downloading is blocked from Codex's environment, add a manual action "download fonts" with the exact URLs, and use a temporary system-font fallback.
2. Load them with `next/font/local` (`display: swap`, preload Medium only). The Arabic face gets a `unicode-range` covering U+0600–06FF, U+0750–077F and U+08A0–08FF, plus the FB50–FDFF / FE70–FEFF presentation forms.
3. Copy `assets/brand/tokens.css` to `apps/web/styles/tokens.css` and map it to the Tailwind v4 `@theme`:
   - colours, spacing, radii, z-index, durations and easing;
   - a `[data-theme="light"]` variant.
4. Add the `:lang(ar)` line-height rule.
5. Set `font-variant-numeric: tabular-nums` utilities.
6. Default to the dark theme, with a theme switch in the user menu (Dark / Light / System, stored in localStorage and applied before paint with a tiny inline script to avoid a flash).

**Done when:** `/dev/components` shows the type scale (DESIGN.md §4) and every token renders correctly in both themes.

### T3 — UI primitives

**Steps:**
1. Build the primitives in Deliverable 4 per the DESIGN.md §6 table: anatomy, variants, states, a focus ring on `:focus-visible`, at least 24 px targets (36 px buttons, 44 px on mobile), and `aria-label` on IconButtons.
2. Use Radix (Dialog, Popover, DropdownMenu, Tabs, Tooltip, ToggleGroup) and `cmdk` for the SearchCommand shell.
3. Every component gets a `/dev/components` example (dev-only route, 404 in production) and a smoke unit test.

**Done when:** the primitives render all their states and Vitest passes.

### T4 — Data access + caching decision

**Steps:**
1. Implement `lib/supabase/server.ts` and `client.ts` per the current `@supabase/ssr` docs:
   - `createServerClient` with the cookies API;
   - publishable key `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Implement the session refresh in `middleware.ts` (or the current Next.js "proxy" equivalent; verify the name in the Next.js version you pin). Use `supabase.auth.getClaims()` (JWT verified locally with the project's signing keys) if the current docs recommend it, else `getUser()`. Never trust `getSession()` on the server.
3. Make the caching decision, Option A vs B (see §2):
   - **Option A:** implement `lib/db/reader.ts` with postgres.js:
     - `max: 5`, `prepare: false`, `idle_timeout: 20`;
     - a `statement_timeout` per role (already set for `api_agent`);
     - every reader function in `lib/data/*` wraps the query in the cache API with tags from `lib/cache/tags.ts`.
   - **Option B:** per-user server client and `export const dynamic = 'force-dynamic'`.
4. Record the choice in `docs/DECISIONS.md` → Changes and `apps/web/README.md`.

**Done when:** `lib/data/feed.ts#getFeedPage({filters, cursor, limit})` returns typed rows from `app.feed_v` with the keyset cursor `(published_at, id)`, and a unit/integration test runs against local Supabase.

### T5 — Auth: login, callback, membership gate, no-access

**Steps:**
1. `/login` per DESIGN.md §8.1:
   - wordmark 160 px;
   - the display line "If it's not everyone— / it's no one.", revealing gray → white;
   - "Sign in with Google" (secondary, lg);
   - "Invite-only. Ask Mohamed for access.";
   - the error message on an OAuth failure.

   The button calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${SITE_URL}/auth/callback?next=…` } })`.
2. `/auth/callback/route.ts`: exchange the code for a session, then redirect to `next` (validated relative path only, to prevent an open redirect).
3. `(app)/layout.tsx`:
   - call `app.me()` with the user's session;
   - null or `status != 'active'` → redirect to `/no-access`;
   - no session → `/login?next=…`.
   - Provide `{role, email, name}` to the shell through a server-to-client context.
4. `/no-access` per §8.2 with "Sign out".
5. Role-aware nav:
   - the ADMIN group only for admin;
   - Review only for analyst+;
   - viewers get Search and Feed but not Review.

   Also guard routes server-side: `/review` needs analyst+, `/admin/*` needs admin. Otherwise return the 404 page, not a leak.
6. Update `app.members.last_seen_at` at most once per hour (server action or RPC `app.touch_last_seen()`; add it to the migration if missing, SECURITY INVOKER updating only own row, plus an RLS update policy on own row limited to `last_seen_at` via the RPC).

**Done when:**
- e2e: unauthenticated → `/login`;
- a signed-in non-member → `/no-access`;
- a member → `/`;
- a viewer hitting `/admin/pipeline` → 404.

### T6 — App shell

**Steps:**
1. Build the Sidebar, Topbar and BottomNav, plus the MobileMenuSheet (three-dot button), per DESIGN.md §5.
2. The **MarketSwitcher** writes `?market=` and localStorage; a small `useMarket()` hook reads it and every data function accepts `market`.
3. The **DateRangePicker** presets (Today, 7 days, 30 days, 90 days, This year, Since 1 Jan 2024, Custom) are encoded as `?from=&to=`; the default is 7 days.
4. **PipelineStatusDot** reads `lib/data/pipeline.ts` → `app.pipeline_summary(1)` (cached, tag `stats`).
5. The **SearchCommand** (⌘K) shell opens a dialog with "Search is coming in M11" and page shortcuts (G F, G C…). M11 makes it real.
6. Nav entries for pages not built yet (Campaigns, Briefs, News, Competitors, Brands, Agencies, People, Markets, Compare, Review, Admin) link to a shared `ComingSoon` page that names the milestone that delivers it.
7. Add "Skip to content" as the first link, with `scroll-margin-top` = topbar + filter bar.

**Done when:** the shell works at 375, 768, 1024 and 1440 px with no horizontal scroll; sidebar collapse persists; keyboard navigation works.

### T7 — Live feed `/feed`

**Steps:**
1. Build it per DESIGN.md §8.4:
   - the H1 "Feed" + count;
   - the FilterBar (URL-synced via `nuqs` or `useSearchParams`) with the facets market, date, platform (multi), competitor (multi, searchable), tier, brand, agency, industry, format, occasion, status, AI status, confidence (≥ 0.8 / < 0.8), commercial only (default on) and has campaign;
   - active chips and Clear all;
   - the ViewToggle GRID/LIST (localStorage per page).
2. **Grid:** ItemCards with `repeat(auto-fill,minmax(280px,1fr))` (240 in dense mode). Card details:
   - aspect 16:9 for Vimeo/YouTube/website and 4:5 for Instagram/stories;
   - the title bottom-left, white on a scrim;
   - the GlassLabel with the competitor name top-left and the PlatformBadge top-right;
   - footer: competitor LogoTile 24, brand link, relative date, key metric, and the mini ConfidenceMeter;
   - a "New" accent dot when `first_seen_at` < 24 h;
   - removed items in grayscale + a "Removed" pill;
   - review items get a warning pill.
3. **List:** ItemRows (DataTable, 72 px rows, ↑/↓ + Enter).
4. **Data:**
   - default `ai_status in ('published','review')`; "Show processing" adds `pending`;
   - keyset pages of 48;
   - InfiniteList with an IntersectionObserver plus a "Load more" fallback;
   - the end message "You're all caught up · since 1 Jan 2024".
5. **Facet options:** competitors from `app.competitors`; brands and agencies from `app.organizations` (top 200 by `seen_count` + typeahead via a server action); taxonomy labels from `app.taxonomy_terms`.
6. **NewItemsPill:** after revalidation, a lightweight poll every 60 s of `getFeedHead()` (count of items newer than the first shown) shows "n new items · Show". The view never jumps by itself.
7. **Empty states:** "No items match these filters." (+ Clear filters) and "Nothing collected yet. First runs start after setup."

**Done when:**
- filters change the URL and the results;
- back/forward restores the state;
- 3 pages load with infinite scroll without duplicates;
- e2e passes.

### T8 — Item drawer + `/items/[id]`

**Steps:**
1. The intercepting route `(.)items/[id]` opens a 560 px right Sheet (a bottom sheet on mobile) and changes the URL. A hard load of `/items/[id]` renders the full page (8+4 columns).
2. Content per DESIGN.md §8.4/§8.5:
   - media, with "Open on {platform}" (`target=_blank rel=noopener`);
   - the original caption (`dir=auto`) and the English translation;
   - `summary_en` and `summary_ar`;
   - fields with links (competitor, brand, agency and campaign link; pages arrive in M10, and until then they link to ComingSoon or the feed filtered by that entity);
   - format, occasion, country, the credits list and tags;
   - metrics + "updated {time}";
   - per-field confidence with evidence (`field_confidence`, `evidence`);
   - source facts (published, first seen, platform, external id).
3. Actions:
   - "Similar items" calls `app.similar('item', id, 12)`. Embeddings exist from M07.
   - "Report a correction" (analyst+) is a placeholder that opens a dialog "Corrections arrive in M11". M11 makes it real.
   - "Copy link".
4. Cache tag `item:{id}`.

**Done when:** the drawer and the full page render real pilot items, including Arabic captions rendered RTL; Esc closes the drawer and returns focus.

### T9 — Market pulse `/`

**Steps:**
1. Build it per DESIGN.md §8.3:
   - KPI StatTiles: new items, commercial works, new campaigns, new clients, needs review. Each has a delta vs the previous equal period and links to the filtered feed.
   - Big launches: one wide 16:9 card + 2 half cards (the site rhythm). Selection: `is_commercial_work` and `content_type in ('tvc_brand_film','digital_film_online_video')` and a tier pilot/baseline competitor, plus campaigns with ≥ 3 items, ranked by recency × views.
   - Most active competitors (bar, 7 days).
   - New & returning clients: the first item of the brand × competitor in the period, or a previous one more than 90 days earlier.
   - Output by platform (stacked area, 30 days).
   - Formats & occasions (ShareBars).
   - Latest: 8 dense ItemCards.
   - The PipelineStrip.
2. Use the chart palette from DESIGN.md §3.4 / tokens `--chart-1…8`, with the baseline always as series 1, labelled "everyone.".
3. The market and date range apply. Cache tags `stats` and `feed`.
4. Implement `lib/data/pulse.ts` with SQL against `app.items`/`app.campaigns`/`app.review_tasks` (or `app.stats_daily` once M10 fills it). Use `EXPLAIN ANALYZE` on prod-size data and add indexes in the `web_foundation` migration if needed.

**Done when:** the tiles match SQL counts (paste the comparison into PROGRESS); the empty state reads "Nothing new in {market} this week.".

### T10 — Revalidation: `/api/revalidate`, `ops.should_publish`, WF-70

**Steps:**
1. Route handler: POST only, constant-time compare of `x-emr-secret` with `INTERNAL_WEBHOOK_SECRET`, zod-validated body `{tags: string[]}` (≤ 50, regex), then `revalidateTag(tag)` for each → `200 {revalidated}`. Errors: 401 for a missing or bad secret, 400 for a bad body.
2. Migration: `ops.should_publish(p_tags text[]) → text[]` records the tags in `ops.publish_log(tag text primary key, last_published_at timestamptz)` (new small table, RLS enabled, no policies) and returns only the tags not published in the last 5 minutes. EXECUTE to `n8n_writer` only.
3. WF-70 · Publish:
   - Execute Workflow Trigger `{tags}`;
   - Code dedupe;
   - Postgres `select ops.should_publish($1::text[])`;
   - IF empty → stop;
   - HTTP POST `{app_url}/api/revalidate` (credential `EMR internal secret`).

   Build the [dev] copy (→ the preview URL configured in the dev Config node) and the [prod] copy (→ the production URL), and export both.

**Done when:** a collector run in prod → the feed shows new items without a redeploy; calling twice within 5 minutes revalidates once; a bad secret → 401 (API test).

### T11 — i18n scaffolding, formatters, errors

**Steps:**
1. `next-intl` with `en` only. All UI strings go in `messages/en.json`; no hard-coded strings in components.
2. Formatters (`lib/format`):
   - dates "16 Oct 2026";
   - relative times ("3 h ago");
   - numbers 12.4K / 1.2M;
   - durations;
   - platform labels.

   The time zone for display is `Africa/Cairo`, unless the user picks another one later.
3. Global `not-found.tsx` ("This page isn't on the radar.") and `error.tsx` ("Something broke on our side. Retry" + request id), using the three-dot mark.
4. Every page has a skeleton (shown after 150 ms), an empty state and an error state.

**Done when:** unit tests for the formatters pass; the 404 and 500 pages render.

### T12 — Quality gates: e2e, axe, Lighthouse

**Steps:**
1. Playwright against the local stack (`supabase start` + seeded fixture data from `supabase/seed.sql` + test users created in setup):
   - `auth.spec.ts`: login redirect, non-member, member, viewer on an admin route;
   - `feed.spec.ts`: filter, toggle, infinite scroll, drawer open/close via keyboard, an Arabic caption with `dir=rtl`;
   - `a11y.spec.ts`: `@axe-core/playwright` on `/login`, `/`, `/feed` and `/items/[id]`, with zero serious or critical violations.
2. Lighthouse (CLI or CI action) on the preview: `/` and `/feed` must score ≥ 90 for Performance and Accessibility (mobile profile). Paste the scores.
3. Performance: thumbnails are lazy, `sizes` is set, the first-row images are `priority`, no layout shift on cards (aspect boxes), and the JS for the feed page is under 200 KB gzip (check `next build` output).

**Done when:** CI runs the e2e and a11y suites green; the scores are pasted.

### T13 — Deploy: preview (dev) and production (prod)

**Steps:**
1. Vercel project root `apps/web`.
2. Env vars per `docs/ENVIRONMENT.md` §2 (MA-20):
   - Preview → dev Supabase;
   - Production → prod Supabase;
   - `INTERNAL_WEBHOOK_SECRET`, `API_AGENT_DATABASE_URL` (Option A), `NEXT_PUBLIC_SITE_URL`.
3. Supabase Auth URL config + Google redirect (MA-19). Invite the first users via `app.member_invites`:
   - Codex prepares the SQL, or a tiny admin script `scripts/invite.ts email role` until M11 ships the UI;
   - the owner already has an admin invite from the seed.
4. `scripts/copy-pilot-slice.ts` (owner runs it with both DB URLs): copies competitors, accounts, the last 14 days of items, credits, organizations, campaigns, media paths and embeddings from prod to dev. Raw payloads, cost, API keys and members are **not** copied. The script is idempotent.
5. Production deploy behind auth. The owner signs in on production and sees the live pilot feed.

**Done when:** the preview and production URLs work; the owner signs in on both (MA-19 ticked).

## 8. Interfaces & contracts

| Interface | Contract |
|---|---|
| `app.me() → jsonb` | `{user_id, email, full_name, role, status}`, or null |
| `app.feed_v` | Columns per `reference/sql/003_auth_rls_views.sql`; keyset `(published_at desc, id desc)`; filter `duplicate_of is null` inside the view |
| `app.similar(entity_type, entity_id, limit)` | `(entity_type, entity_id, distance)` |
| `app.pipeline_summary(p_days int) → jsonb` | `{status:'ok'\|'running'\|'failing', last_success_at, per_platform:[{platform, last_run_at, status, accounts_ok, accounts_failed, items_new, next_run_at}], failing_accounts:int, queues:{ai_extract, embed, media}}`; admins also get the run list (M11 uses it fully) |
| `ops.should_publish(p_tags text[]) → text[]` | 5-minute debounce; `n8n_writer` only |
| `POST /api/revalidate` | Header `x-emr-secret: INTERNAL_WEBHOOK_SECRET`; body `{tags}`; `200 {revalidated}` / 400 / 401 |
| Cache tags | `feed`, `stats`, `item:{id}`, `campaigns`, `campaign:{id}`, `competitor:{slug}`, `brand:{slug}`, `agency:{slug}`, `person:{slug}`, `news`, `briefs`, `brief:{week}`, defined once in `lib/cache/tags.ts` |
| URL params | `?market=EG\|KSA\|UAE\|ALL`, `?from=YYYY-MM-DD&to=YYYY-MM-DD`, feed facets `platform=`, `competitor=` (slugs, comma), `brand=`, `agency=`, `format=`, `occasion=`, `industry=`, `tier=`, `status=`, `ai=`, `conf=hi\|lo`, `commercial=1\|0`, `campaign=1\|0`, `view=grid\|list`, `cursor=` |
| Routes (this milestone) | `/login`, `/no-access`, `/auth/callback`, `/`, `/feed`, `/items/[id]` (+ drawer), `/api/revalidate`, `/dev/components` (dev only); placeholders for the M10–M13 routes |

## 9. Acceptance criteria

- **AC1** CI green: lint, typecheck, unit tests, DB tests, build, Playwright e2e and the a11y suite.
- **AC2** Auth gate:
  - unauthenticated → `/login`;
  - a non-invited Google account → `/no-access`;
  - an invited member → `/`;
  - a viewer on `/admin/*` or `/review` → 404.

  Proven by e2e.
- **AC3** No secret is in client bundles: grep `.next/static` for `sb_secret`, `INTERNAL_WEBHOOK_SECRET` values and `api_agent` and find none. Only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key are public.
- **AC4** `/feed` shows real pilot items on production with thumbnails from Storage. Filters are URL-synced; grid/list works; infinite scroll loads ≥ 3 pages with no duplicate IDs.
- **AC5** The item drawer and `/items/[id]` show all fields, including RTL Arabic captions; "Open on {platform}" opens the source; Similar items returns results.
- **AC6** The pulse tiles equal the SQL counts for the same market and period. The comparison table is pasted.
- **AC7** Revalidation works end to end:
  - a WF-70 call after a collector run makes new items appear without a redeploy;
  - a bad secret → 401;
  - debounce: 2 calls within 5 minutes → 1 revalidation.
- **AC8** Responsive at 375 / 768 / 1024 / 1440 px with no horizontal page scroll. The mobile bottom nav and three-dot menu sheet work. Screenshots are saved to `apps/web/e2e/__screenshots__/` and listed in PROGRESS.
- **AC9** Lighthouse mobile ≥ 90 for Performance and Accessibility on `/` and `/feed`; axe finds 0 serious or critical issues on the 4 key pages.
- **AC10** The caching choice (A/B) is recorded in DECISIONS → Changes. If A: the reader module is server-only and lint-restricted, and the membership check runs before any reader call (a code review note is in PROGRESS).
- **AC11** The owner has signed in on production (MA-19, MA-20 ticked).

## 10. Tests to write

- **Vitest:** `lib/format/*`, `lib/cache/tags.ts`, the URL ↔ filter (de)serialisers, ItemCard states (removed, review, new, RTL), ConfidenceMeter thresholds.
- **API:** `tests/api/revalidate.test.ts` (401, 400, 200, tag regex).
- **pgTAP:** `ops.should_publish` (debounce, grants), `app.pipeline_summary` (member vs admin fields), `app.me` (null for a non-member).
- **Playwright:** `auth.spec.ts`, `feed.spec.ts`, `a11y.spec.ts`, plus a visual smoke at 4 widths.
- **Integration:** `lib/data/feed.ts` keyset pagination against local Supabase (no gaps or duplicates across pages with equal `published_at`).

## 11. Manual actions from the owner

| ID | Action | When |
|---|---|---|
| MA-19 | Supabase → Auth → URL configuration: Site URL + redirect URLs (`http://localhost:3000/**`, the Vercel preview pattern `https://*-<team>.vercel.app/**`, the production URL). Google OAuth client: the same callback domains. Confirm who to invite first (you are already admin via the seed). | Before T5 e2e on preview / T13 |
| MA-20 | Vercel → Project → Settings → Environment Variables. Preview = dev values, Production = prod values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `INTERNAL_WEBHOOK_SECRET`, `API_AGENT_DATABASE_URL` (if Option A; uses the `api_agent` password from MA-05). | T13 |
| — | Run `scripts/copy-pilot-slice.ts` with the prod and dev DB URLs (Codex gives the command) | T13 |
| — | (Only if Codex can't download the fonts) Download the General Sans and IBM Plex Sans Arabic woff2 files from the URLs in PROGRESS and drop them in `apps/web/public/fonts/` | T2 |

## 12. Risks & gotchas

- **`@supabase/ssr` API changes.** Follow the current docs exactly (cookie `getAll`/`setAll`). A wrong middleware matcher logs users out at random. Exclude static assets and `/api/revalidate` from the session middleware.
- **Caching user-specific data by mistake.** With Option A, never cache anything that depends on the user (role, saved views, own alerts). Those are read per request via the user client.
- **Feed counts are expensive.** For "2,431 items", use a capped estimate (`count(*)` over the filtered keyset with a `limit 10001`, shown as "10,000+") or the stats table, not an unbounded count on every page load.
- **Thumbnails missing** (WF-31 not done yet for some items). Fall back to `thumbnail_source_url`, then to a neutral surface-2 tile with the platform glyph. Instagram CDN URLs expire, which is why Storage paths are preferred.
- **Intercepting routes + parallel routes** can be tricky with `searchParams`. Keep the feed filters in the URL of the underlying page, and test back/forward.
- **Vercel preview auth.** Supabase redirect URLs must include the preview wildcard, or sign-in fails on previews.
- **Pilot data lives in prod.** Previews use dev plus the copied slice. Don't point previews at prod.

## 13. Cost & budget notes

- Vercel: the Pro plan is recommended (team access, analytics). Usage at pilot scale is negligible.
- No new OpenAI or Apify cost in this milestone (similar items use existing embeddings).
- Lighthouse and Playwright run in CI minutes only.

## 14. Definition of done & hand-off

**Done when:**
- AC1–AC11 pass with evidence in PROGRESS;
- the PR `m09-web-app-foundation` is merged;
- WF-70 is exported;
- the root board is updated.

**Hand-off to M10** (fill in PROGRESS):
- the component inventory (what exists in `components/ui` and `features`);
- how `lib/data/*` functions are written and tagged (the pattern to copy);
- the chosen caching option;
- known performance hot spots;
- which placeholder routes M10 must replace.
