# M01 — Supabase foundation · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Not started** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | — |
| Last updated | — |
| Finished | — |
| Branch / PR | — |
| Current task | — |
| Next step | Start T1: Local Supabase |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [ ] T1 — Local Supabase
- [ ] T2 — Link dev (needs MA-03, MA-04)
- [ ] T3 — Migration 1, extensions/schemas/roles
- [ ] T4 — Migration 2, core tables
- [ ] T5 — Migration 3, auth, RLS, views, search triggers
- [ ] T6 — Migration 4, core pipeline RPCs
- [ ] T7 — Migration 5, app RPCs and first search
- [ ] T8 — Migration 6, Storage and cron
- [ ] T9 — Migration 7, seed taxonomies, settings, price book, owner invite
- [ ] T10 — pgTAP tests
- [ ] T11 — Google provider (needs MA-06)
- [ ] T12 — Push to dev, types, advisors, pooler test (needs MA-05 on dev)
- [ ] T13 — CI DB job and prod baseline (prod needs the owner's OK + MA-05 on prod)
- [ ] T14 — Docs and hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Migrations apply cleanly from zero — evidence:
- [ ] AC2 — All tables exist — evidence:
- [ ] AC3 — RLS everywhere — evidence:
- [ ] AC4 — pgTAP passes — evidence:
- [ ] AC5 — Advisors clean — evidence:
- [ ] AC6 — Seeds present — evidence:
- [ ] AC7 — Queues, cron, Storage — evidence:
- [ ] AC8 — Machine roles connect through the pooler — evidence:
- [ ] AC9 — Data API exposure correct — evidence:
- [ ] AC10 — Types generated — evidence:
- [ ] AC11 — Google provider enabled on dev — evidence:
- [ ] AC12 — No secrets committed — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- none

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-03 | Create Supabase `emr-dev` + `emr-prod` (Pro, same region); send refs | T2 link | Not requested yet |
| MA-04 | Scoped Supabase access token(s) for Codex | T2 CLI/MCP | Not requested yet |
| MA-05 | Set `n8n_writer` / `api_agent` passwords (dev at T12, prod at T13) | Pooler connection tests | Not requested yet |
| MA-06 | Google OAuth client + enable Supabase Google provider | T11 auth | Not requested yet |
| approval | Approve applying the baseline schema to prod | T13 | Not requested yet |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- none

## Risks / notes for the owner
- none

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. -->
- —
