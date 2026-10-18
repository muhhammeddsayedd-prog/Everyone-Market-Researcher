# M10 — Web app entities · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.
> **Parallel-OK while the pilot runs:** also run the daily pilot check each working session and log it in `milestones/M08-campaign-linker-pilot-launch/PROGRESS.md` → Pilot monitoring log.

## Status
**Not started** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-18 |
| Finished | — |
| Branch / PR | `m10-web-app-entities` / — |
| Current task | — |
| Next step | Start T1: migration `entity_views` part 1 — `stats_daily` PK fix (add country), `ops.refresh_stats_daily`, pg_cron hourly job, WF-91 check, backfill from 2024-01-01 |

## Early parallel frontend track (18 Oct 2026)

Built ahead of the normal milestone order on branch `m09-frontend-company-browsing`. Evidence and
open dependencies are in `milestones/M09-web-app-foundation/PROGRESS.md`.

- **T3 `/competitors`: partial.**
  - Done: grid and list views, search, filters (tier, category, capability, status, market),
    keyset pages, baseline pinned, health dots.
  - Waiting for `stats_daily` / `app.competitor_overview_v`: activity sort, sparkline, period
    columns and the "active in period" filter.
- **T4 profile: partial.**
  - Done: EntityHeader, Overview facts, Sources (`/accounts`) and In-house (`/capabilities`).
  - The seven other tabs show explicit unavailable states.
  - Not done: sticky compact header, alias 308.
- **Also built:** `/coverage`, derived from records.
- **Status:** this milestone's migrations (T1/T2) are not started. No AC here is claimed.
- **Conflict to fix (Codex/owner):** DESIGN.md §3.3 account-status colours win over this
  milestone's T4 line ("warning failing … danger invalid").

## Task checklist
- [ ] T1 `stats_daily` key fix + `ops.refresh_stats_daily` + pg_cron hourly + WF-91 daily + backfill (dev, prod)
- [ ] T2 Entity views + `app.compare_competitors` + `app.market_dashboard` + indexes (EXPLAIN < 300 ms)
- [ ] T3 `/competitors` list (grid/list, filters, health dots, baseline pinned)
- [ ] T4 `/competitors/[slug]` + 10 tabs (overview, campaigns, posts, clients, agencies, people, team, news, accounts, capabilities)
- [ ] T5 `/campaigns` list + `/campaigns/[id]` detail (cuts, timeline, credits, similar)
- [ ] T6 Brands, agencies, people lists + details (merged 308, unknown 404)
- [ ] T7 `/compare` (picker, baseline toggle, sections, table views)
- [ ] T8 `/markets/eg|ksa|uae`
- [ ] T9 Chart wrappers: Heatmap, Timeline, stable colours, table parity
- [ ] T10 (SHOULD) Saved views + CSV export — or deferred
- [ ] T11 e2e per page family, axe, Lighthouse, responsive check

## Acceptance criteria
- [ ] AC1 Migration on dev + prod; pgTAP green; advisors clean — evidence:
- [ ] AC2 `stats_daily` backfilled; spot totals match raw counts; hourly cron + WF-91 running — evidence:
- [ ] AC3 `/competitors` lists 285, baseline first, filters/sort/health dots OK — evidence:
- [ ] AC4 Profile renders all 10 tabs for 3 pilot competitors + baseline; Team tab has data for ≥ 1 — evidence:
- [ ] AC5 Campaign list/detail incl. multi-platform cuts, timeline, credits, similar — evidence:
- [ ] AC6 Brand/agency/person pages; merged 308; unknown 404; drill-down e2e — evidence:
- [ ] AC7 Compare 2–4 + baseline; table parity; < 1.5 s p75 — evidence:
- [ ] AC8 Markets EG/KSA/UAE render; switcher behaviour — evidence:
- [ ] AC9 EXPLAIN ANALYZE < 300 ms for heavy queries — timings:
- [ ] AC10 e2e green; axe 0 serious/critical; Lighthouse a11y ≥ 90 on profile + campaign — scores:
- [ ] AC11 (SHOULD) Saved views + CSV export working, or deferred note on root board — evidence:

## Blockers
- none

## Manual actions needed from the owner
| # | Action | Why | Status |
|---|---|---|---|
| — | Run `select ops.refresh_stats_daily('2024-01-01');` in the prod SQL editor (only if Codex has no prod token) | One-time dashboard backfill | Not requested yet |
| — | (Optional) Review 2–3 competitor profiles on production and leave comments here | Early feedback during the pilot | Not requested yet |

## Decisions & deviations
- none yet (expected: `app.stats_daily` PK gains `country`; EG dashboard = items with country EG only, unknown shown under All)

## Risks / notes for the owner
- Edit, merge and pause buttons are visible but disabled until M11 (Review & admin).
- The News tab stays empty until weekly news & awards go live in M13.

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: stubbed edit/merge/split buttons for M11, reusable data functions/views, slow queries left, deferred SHOULD items. -->
- —
