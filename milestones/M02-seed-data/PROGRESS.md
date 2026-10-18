# M02 — Seed data & account resolution · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**In progress — development authorized; implementation and local verification**

| Field | Value |
|---|---|
| Started | 2026-10-18 Cairo |
| Last updated | 2026-10-18 Cairo |
| Finished | — |
| Branch / PR | m02-seed-data; PR not yet opened |
| Current task | T1 normalization, T2/T3 idempotent seed planner/executor and T5/T6/T7 tested provider/network adapters in parallel. No hosted import or provider calls yet. |
| Next step | Finish scripts, real CSV preflight and local tests; prepare executable private dev credentials and a bounded live-run estimate. MA-07/08 credentials, MA-09 report review and separate production seeding remain gates. |

The owner instructed **Proceed with the next milestone** after M01 merged.
Started from clean main a74459d082ba5d1f0445652d7d12f8d2079da945 and preserved
M01's seven versions/hashes, hosted acceptance and credential cleanup. M02
development and dev seeding are in scope. Production seeding needs its later
specific approval; collection, paid providers, n8n and M03 remain unstarted.

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [x] T1 — Handle normalization library — 135 shared tests pass; strict typecheck passes (local).
- [ ] T2 — Seed competitors
- [ ] T3 — Seed accounts (+ derived rows, pilot gating)
- [ ] T4 — Report script
- [ ] T5 — Resolve Vimeo (needs MA-07)
- [ ] T6 — Resolve YouTube (needs MA-08)
- [ ] T7 — Instagram, LinkedIn, website checks (no APIs)
- [ ] T8 — Copy logos to Storage (Q-10 default)
- [ ] T9 — Owner review (MA-09)
- [ ] T10 — Seed prod (owner OK)
- [ ] T11 — Docs and hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Competitors loaded — evidence:
- [ ] AC2 — Primary accounts loaded — evidence:
- [ ] AC3 — Derived accounts — evidence:
- [ ] AC4 — Pilot gating — evidence:
- [ ] AC5 — Resolution — evidence:
- [ ] AC6 — Backfill flags — evidence:
- [ ] AC7 — Idempotent — evidence:
- [ ] AC8 — Logos — evidence:
- [ ] AC9 — Owner sign-off — evidence:
- [ ] AC10 — Prod mirrors dev — evidence:
- [ ] AC11 — Tests — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- Live dev seed needs its own bounded owner-database credential delivery; M01 handoffs remain deleted and restricted application-role credentials cannot seed these tables.
- MA-07/08 provider credentials are not verified. No API authorization or hosted acceptance is inferred from file presence or intent.
- MA-09 awaits the concrete unresolved/suspect report. Production seed approval will be requested only with a reviewed dev result and exact packet.

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-07 | Vimeo developer app token (scope public) → `VIMEO_TOKEN` | T5 Vimeo resolution | Not requested yet |
| MA-08 | YouTube Data API v3 key → `YOUTUBE_API_KEY` | T6 YouTube resolution | Not requested yet |
| MA-09 | Review the unresolved/suspect accounts list | T9 sign-off | Not requested yet |
| approval | "approved: seed prod" | T10 | Not requested yet |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- CSV preflight matches 285 competitors, tiers50/174/60/1 and1,272 primary rows at expected platform counts; raw handle keys have no duplicates. Canonical collisions and invalid URL decisions remain a separate normalization check.
- Owner-run scripts form a pinned @emr/scripts workspace; installation hooks remain blocked. No schema migration is planned unless a concrete incompatibility is found.
- Seed-owned fields use compare-and-swap against a target-bound local manifest; operational state and human corrections are preserved, and missing ownership fails closed. Explicit URL replacement must not reuse stale external IDs after identity changes.

## Risks / notes for the owner
- none

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-18 Cairo · T1 implemented in shared handles library: synchronous platform/host/URL validation, canonicalization and real CSV cases; 135 shared tests and strict typecheck PASS. Digit-leading Vimeo vanity profiles retained; numeric clip URLs rejected. Full plan remains 285 competitors / 1,754 accounts, zero canonical collisions, 289 active / 1,462 paused / three invalid legacy YouTube URLs (C102 pilot, C245, C283). No provider or hosted write performed.
- 2026-10-18 Cairo · M02 authorized after M01 closure. Clean main a74459d verified; created m02-seed-data without resetting any work. Loaded milestone/CSV/schema/skills; dispatched independent normalization, seed and provider work. Real input counts match; current dependency/API sources checked. No hosted import, credential decryption, production seeding, paid calls, collector or n8n action.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. -->
- —
