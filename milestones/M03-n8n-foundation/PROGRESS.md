# M03 — n8n foundation · PROGRESS

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
| Next step | Start T1: Verify the n8n Cloud plan facts |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [ ] T1 — Verify the n8n Cloud plan facts
- [ ] T2 — n8n MCP/API access + repo conventions (needs MA-11)
- [ ] T3 — Credentials (MA-10, MA-11, MA-12)
- [ ] T4 — Migration: M03 RPCs + price book (needs MA-10, MA-13, fixed fees)
- [ ] T5 — Shared sub-workflows (dev)
- [ ] T6 — WF-90 · Error handler (dev)
- [ ] T7 — WF-19 · Apify run callback (dev)
- [ ] T8 — WF-00 · Orchestrator + collector stubs (dev, inactive)
- [ ] T9 — WF-91 · Health & cost + WF-99 smoke test (dev)
- [ ] T10 — Export, document, hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Plan facts recorded — evidence:
- [ ] AC2 — Credentials work — evidence:
- [ ] AC3 — RPCs implemented and tested — evidence:
- [ ] AC4 — Price book + budget set — evidence:
- [ ] AC5 — Smoke path end to end — evidence:
- [ ] AC6 — Idempotency — evidence:
- [ ] AC7 — Forged callback rejected — evidence:
- [ ] AC8 — Error routing — evidence:
- [ ] AC9 — Orchestrator dispatch — evidence:
- [ ] AC10 — Health — evidence:
- [ ] AC11 — Exports clean — evidence:
- [ ] AC12 — Budget documented — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- none

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-10 | Confirm Apify plan tier + API token → `Apify API` credential | T3/T4 prices | Not requested yet |
| MA-11 | Create n8n credentials (canonical names) + connect Codex n8n MCP/API | T2/T3 | Not requested yet |
| MA-12 | OpenAI project key with budget limit → `OpenAI API` credential | T3 | Not requested yet |
| MA-13 | Daily budget USD (`daily_budget_usd`) | T4 budget alert | Not requested yet |
| info | Monthly fees: n8n plan, Supabase Pro ×2, Vercel plan | T4 fixed costs | Not requested yet |
| optional | Temporary SMTP credential `Email (SMTP temp)` | T5 Notify emails before M13 | Not requested yet |

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
