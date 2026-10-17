# M09 — Web app foundation · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.
> **Parallel-OK while the pilot runs:** also run the daily pilot check each working session and log it in `milestones/M08-campaign-linker-pilot-launch/PROGRESS.md` → Pilot monitoring log.

## Status
**Not started** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | `m09-web-app-foundation` / — |
| Current task | — |
| Next step | Start T1: extend the M00 `apps/web` (keep `api/internal/*`; confirm pinned Next.js is latest stable; Tailwind v4, ESLint restricted imports, Vitest, Playwright) |
| Caching option (A shared reader / B per-user) | — (decide in T4) |

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
| MA-19 | Supabase Auth URL configuration (Site URL + redirect URLs for localhost, Vercel previews, production) + matching Google OAuth redirect domains; confirm first users to invite | Google sign-in on preview and production | Not requested yet |
| MA-20 | Vercel env vars: Preview = dev, Production = prod (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `INTERNAL_WEBHOOK_SECRET`, `API_AGENT_DATABASE_URL` if Option A) | Builds and data access | Not requested yet |
| — | Run `scripts/copy-pilot-slice.ts` (prod → dev, no raw payloads/costs/keys/members) | Realistic previews | Not requested yet |
| — | Only if Codex can't download fonts: place the woff2 files in `apps/web/public/fonts/` | Brand typography | Not requested yet |

## Decisions & deviations
- none yet (expected: caching option A/B; `ops.publish_log` table added for WF-70 debounce; revalidate uses `INTERNAL_WEBHOOK_SECRET` per API_SPEC §6.1)

## Risks / notes for the owner
- Pages not built yet (campaigns, competitors, review, admin…) show a "Coming in Mxx" placeholder so the navigation is complete from day one.

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: component inventory, lib/data pattern, caching option, perf hot spots, placeholders M10 must replace. -->
- —
