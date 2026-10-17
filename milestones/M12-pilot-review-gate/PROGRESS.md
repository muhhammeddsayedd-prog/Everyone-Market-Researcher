# M12 — Pilot review & tuning (gate) · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Not started**

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | — |
| Current task | — |
| Next step | Start T1: confirm the pilot window (≥ 14 days of prod daily runs) once M11 is Done |

## Task checklist
- [ ] T1 — Confirm pilot window and freeze a snapshot
- [ ] T2 — Coverage and collector reliability
- [ ] T3 — Collector decisions (stories, reels, LinkedIn employees, fallbacks)
- [ ] T4 — Cost actuals and full-scale forecast
- [ ] T5 — Fresh 200-item accuracy audit
- [ ] T6 — Calibration and threshold choice
- [ ] T7 — Prompt v2 and resolver/linker fixes (only for clusters that miss targets)
- [ ] T8 — Fix the pilot's top issues
- [ ] T9 — Performance numbers
- [ ] T10 — Daily audit sample job
- [ ] T11 — Write the pilot report
- [ ] T12 — Owner gate (MA-22) and apply decisions

## Acceptance criteria
- [ ] AC1 — `docs/reports/pilot-report.md` exists with all 12 sections, every number traceable to `scripts/pilot/*.sql` or `eval/*` outputs — evidence:
- [ ] AC2 — Coverage: the share of pilot accounts with a successful run in the last 48 h is reported per platform — evidence:
- [ ] AC3 — Accuracy: 200 labeled audit items are committed — evidence:
- [ ] AC4 — A threshold is chosen by the rule (lowest value with ≥ 93% accuracy of auto-published items) or kept with justification, and approved by the owner — evidence:
- [ ] AC5 — Costs: actuals by provider, platform and category; estimate-vs-actual table; full-scale monthly forecast (p50/p90) and a backfill estimate for the remaining … — evidence:
- [ ] AC6 — Collector decisions (stories actor and cadence, reels pass, LinkedIn employees cap) are made with numbers and recorded in DECISIONS → Changes — evidence:
- [ ] AC7 — Daily audit sample job: running in prod and creating 10 tasks per day; pgTAP tests green; the audit-accuracy tile visible on `/admin/pipeline` — evidence:
- [ ] AC8 — No open Sev-1 issues — evidence:
- [ ] AC9 — The owner's go/no-go (MA-22) is recorded in `docs/DECISIONS.md` → Changes — evidence:
- [ ] AC10 — OPEN_QUESTIONS Q-07/08/09 are resolved (struck, with answers moved to DECISIONS) — evidence:

## Blockers
- none

## Manual actions needed from the owner
| # | Action | Why | Status |
|---|---|---|---|
| MA-16 | Pick the stories actor (if still open after M06) | Bake-off data decides the primary story actor (no login, D-24) | Not requested yet |
| — | Label/confirm the 200 audit items | Accuracy audit needs human truth | Not requested yet |
| — | Approve cost of v2 re-extraction on 200 audit items | AGENTS rule 9: estimate before spend | Not requested yet |
| MA-22 | Pilot go/no-go: answer each row of "Decisions needed" in the pilot report | The gate for M13–M15 | Not requested yet |

## Decisions & deviations
- none

## Risks / notes for the owner
- none

## Session log
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
- —
