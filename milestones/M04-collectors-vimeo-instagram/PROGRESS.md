# M04 — Collectors I: Vimeo + Instagram (posts & reels) · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Not started** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | `m04-collectors-vimeo-instagram` / — |
| Current task | — |
| Next step | Start T1: capture real Vimeo API, goat255 and instagram-scraper fixtures in dev (2 accounts each). |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [ ] T1 — Capture real fixtures (dev, 2 accounts each)
- [ ] T2 — Dev account set
- [ ] T3 — Migration with the new RPCs
- [ ] T4 — Normalizers + contract tests
- [ ] T5 — WF-10 · Vimeo collector (dev)
- [ ] T6 — WF-11 · Instagram posts/reels collector (dev)
- [ ] T7 — WF-00 wiring (dev)
- [ ] T8 — Backfill estimate (MA-14)
- [ ] T9 — Prod copies + pilot backfill (after MA-14)
- [ ] T10 — Daily mode check + overlap measurement (dev, 7 days)
- [ ] T11 — Export, docs, hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md §9; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Contract — evidence:
- [ ] AC2 — Dev backfill — evidence:
- [ ] AC3 — Idempotency — evidence:
- [ ] AC4 — Item types — evidence:
- [ ] AC5 — Watermarks and metrics — evidence:
- [ ] AC6 — Pilot backfill (prod) — evidence:
- [ ] AC7 — Cost logged — evidence:
- [ ] AC8 — Failure path — evidence:
- [ ] AC9 — Security — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- none

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. Steps: docs/MANUAL_ACTIONS.md + MILESTONE.md §11. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-07 | Vimeo token (scope public) in n8n credential "Vimeo token" | WF-10 Vimeo API | Not requested yet |
| MA-10 | Apify plan tier + token in n8n credential "Apify API" | WF-11 and fallbacks; price book tier | Not requested yet |
| MA-11 | Prod credential "Supabase Postgres · n8n_writer · prod" in n8n | Prod copies for the pilot backfill | Not requested yet |
| MA-14 | Approve the Vimeo + Instagram backfill estimate, prod target, prod migration push, backfill-day budget | Before any paid backfill (T9) | Not requested yet |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Planned (confirm in MA-14): the paid pilot backfill runs once into **prod** (prod copies of SUBs/WF-19/WF-90/WF-10/WF-11, daily slots off until M08) instead of dev — avoids paying twice. Exception to DEVELOPMENT_PLAN §7 "prod only in M01/M08/M15".
- Planned: `ops.report_account_result` gains `p_secondary boolean default false` (reels pass must not move the schedule).

## Risks / notes for the owner
- none yet

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. See MILESTONE.md §14 for the required items. -->
- —
