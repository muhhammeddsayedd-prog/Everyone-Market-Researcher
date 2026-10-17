# M07 — AI understanding · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Not started** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | `m07-ai-understanding` / — |
| Current task | — |
| Next step | Start T1: copy prompt + schema to n8n/prompts/ and build n8n/normalizers/aiResult.js with tests. |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [ ] T1 — Prompts, schema, request builder
- [ ] T2 — SQL: helpers and `ops.apply_extraction`
- [ ] T3 — WF-30 · AI extractor (dev)
- [ ] T4 — WF-31 · Media v2 (dev)
- [ ] T5 — WF-33 · Embeddings (dev)
- [ ] T6 — Dev end-to-end test
- [ ] T7 — Eval set (MA-17)
- [ ] T8 — Eval run + model choice
- [ ] T9 — Backlog estimate + processing (prod)
- [ ] T10 — Prices, reporting, export, hand-off
- [ ] T11 — Tests (alongside T2–T5)

## Acceptance criteria
<!-- Mirror of MILESTONE.md §9; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Eval targets met — evidence:
- [ ] AC2 — Queue drained (prod) — evidence:
- [ ] AC3 — Routing — evidence:
- [ ] AC4 — Locked fields are respected — evidence:
- [ ] AC5 — Resolution — evidence:
- [ ] AC6 — Cost known — evidence:
- [ ] AC7 — Embeddings — evidence:
- [ ] AC8 — Media — evidence:
- [ ] AC9 — Safety — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- none

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. Steps: docs/MANUAL_ACTIONS.md + MILESTONE.md §11. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-12 | OpenAI key in n8n (dev + prod) and Vercel (server-only); project budget limit + alert | WF-30 / WF-33 (T3) | Not requested yet |
| MA-17 | Confirm/correct the 200 eval labels; approve the extraction model; approve backlog cost + standard vs Batch path | Eval (T7–T8) and prod backlog (T9) | Not requested yet |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Planned: AI backlog runs in prod after MA-17 (WF-30/31/33 queue-draining schedules on; collector schedules stay off until M08).
- Option for owner: WF-30b Batch path for the backlog (~50% cheaper tokens, 24 h turnaround).

## Risks / notes for the owner
- none yet

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. See MILESTONE.md §14 for the required items. -->
- —
