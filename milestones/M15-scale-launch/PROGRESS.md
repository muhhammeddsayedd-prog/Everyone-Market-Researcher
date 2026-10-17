# M15 — Scale & launch · PROGRESS

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
| Next step | Start T1: create migration m15_onboarding_scale (ops.get_onboarding_accounts, ops.set_account_status) and build WF-60 |

## Task checklist
- [ ] T1 — Onboarding RPCs and WF-60
- [ ] T2 — App onboarding wiring and backfill progress
- [ ] T3 — Scale-up plan and estimates (MA-26)
- [ ] T4 — Wave activation mechanics
- [ ] T5 — Run the waves (prod)
- [ ] T6 — Full-scale steady state (7 clean days)
- [ ] T7 — Production hardening and security review
- [ ] T8 — Load tests and domain
- [ ] T9 — User guide and runbook
- [ ] T10 — Final docs sync
- [ ] T11 — Launch and onboarding (MA-28)

## Acceptance criteria
- [ ] AC1 — Adding a competitor in `/admin/competitors/new` and via `POST /api/v1/competitors` both trigger WF-60 — evidence:
- [ ] AC2 — The scale-up plan is approved (MA-26) — evidence:
- [ ] AC3 — After the waves, 100% of tracked accounts have `backfill_status` `done`, `failed` (with reason) or `not_applicable`, or the account is `invalid` with a reason — evidence:
- [ ] AC4 — **7 consecutive clean daily runs at full scale**, as defined in T6, with the 7-day table in PROGRESS — evidence:
- [ ] AC5 — n8n executions at full scale stay within the quota (actual daily executions × 30 ≤ 50,000) and are recorded — evidence:
- [ ] AC6 — Launch readiness: every item in T7 has evidence — evidence:
- [ ] AC7 — The load-test targets (PRD §7) are met or the gaps are explicitly accepted by the owner — evidence:
- [ ] AC8 — `docs/USER_GUIDE.md` and `docs/RUNBOOK.md` exist, are reviewed by the owner, and are linked in the app — evidence:
- [ ] AC9 — The owner's security sign-off and launch (MA-28) are recorded in DECISIONS → Changes — evidence:
- [ ] AC10 — Root `PROGRESS.md`: every milestone is `Done`, the key dates are filled in, the post-launch backlog is listed, and OPEN_QUESTIONS is resolved or moved to the… — evidence:

## Blockers
- none

## Manual actions needed from the owner
| # | Action | Why | Status |
|---|---|---|---|
| MA-26 | Approve scale-up waves (sizes, dates, per-wave cost) and temporary daily budget | Paid backfill for 234 competitors | Not requested yet |
| — | Approve paid add-ons (PITR, Vercel Analytics) if proposed | Hardening may need add-ons | Not requested yet |
| MA-27 | (Optional) add custom domain DNS in Vercel; confirm domain name (Q-04) | Production URL for auth, emails, MCP | Not requested yet |
| — | Review zero-items list after each wave | Wrong or inactive handles | Not requested yet |
| MA-28 | Review launch readiness, security sign-off, invite team with roles | Launch | Not requested yet |

## Decisions & deviations
- none

## Risks / notes for the owner
- none

## Session log
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
- —
