# M05 — Collectors II: Websites, YouTube, LinkedIn (posts + employees) · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Not started — development authorized after essential M04 development acceptance at a CI-green head; production and paid/live M05 work remain separately gated.**

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-28 |
| Finished | — |
| Branch / PR | `m05-collectors-web-youtube-linkedin` / — |
| Current task | — |
| Next step | After M04 essential development checks and staged validation pass, branch separately from its accepted CI-green head; implement source contracts locally using official examples/retained data/labeled fixtures, test and deliver a stacked draft PR targeting M04. Prepare one complete M05 live packet before new paid captures or hosted work. |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [ ] T1 — Fixtures (dev)
- [ ] T2 — Dev account set
- [ ] T3 — Migration
- [ ] T4 — Normalizers + tests
- [ ] T5 — WF-21 · Websites (dev)
- [ ] T6 — WF-13 · YouTube (dev)
- [ ] T7 — WF-18 · LinkedIn posts (dev)
- [ ] T8 — WF-18b · LinkedIn employees (dev, weekly)
- [ ] T9 — Estimate (MA-15) + prod backfill
- [ ] T10 — Daily check (dev, ≥ 3 days)
- [ ] T11 — Export, docs, hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md §9; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Website backfill (dev) — evidence:
- [ ] AC2 — Only new URLs — evidence:
- [ ] AC3 — Project-page quality — evidence:
- [ ] AC4 — YouTube — evidence:
- [ ] AC5 — LinkedIn posts — evidence:
- [ ] AC6 — Employees — evidence:
- [ ] AC7 — Prod backfill — evidence:
- [ ] AC8 — Cost — evidence:
- [ ] AC9 — Scope and security — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- none

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. Steps: docs/MANUAL_ACTIONS.md + MILESTONE.md §11. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-08 | YouTube Data API key in n8n credential "YouTube Data API key" | WF-13 | Not requested yet |
| MA-15 | Firecrawl key in n8n (dev + prod); approve websites/YouTube/LinkedIn backfill + weekly employee cost; prod migration push | WF-21; before the prod backfill (T9) | Not requested yet |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Planned: same prod-backfill default as M04 (confirm in MA-15).
- 28 October owner decision separates M04 development acceptance from deferred coverage and rollout. See [binding decision](../../docs/DECISIONS.md#m04-development-acceptance-and-m05-sequencing--28-october-2026); M05 is not started by this record. Once its prerequisite actually passes, M05 local implementation, migrations/tests, documentation, scoped commits, required CI, protected Previews and a separate stacked draft PR are authorized. Keep M05 changes out of PR13. No M04 spending authority transfers to M05.
- Planned: website `external_id` hash function (sha256 vs FNV fallback) is fixed forever after the first backfill — record which one is used here.

## Risks / notes for the owner
- none yet

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. See MILESTONE.md §14 for the required items. -->
- —
