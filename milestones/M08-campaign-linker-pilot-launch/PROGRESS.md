# M08 — Campaign linker + pilot launch · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Not started** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | `m08-campaign-linker-pilot` / — |
| Current task | — |
| Next step | Start T1: write `ops.campaign_candidates` / `ops.campaign_candidates_since` in a new migration `campaign_linker` (`supabase migration new campaign_linker`) with pgTAP fixtures |
| Pilot day 1 | — |
| Pilot review (day 14) | — |

## Task checklist
- [ ] T1 Candidate SQL (`ops.campaign_candidates`, `ops.campaign_candidates_since`)
- [ ] T2 Attach/create RPC (`ops.attach_to_campaign`) + aggregates + audit + embed queue
- [ ] T3 Cross-platform link by media URL (`ops.link_by_media_urls`)
- [ ] T4 WF-32 Campaign linker [dev] built (Execute Workflow Trigger only; scheduled by WF-00), tested, exported
- [ ] T5 Campaign summary prompt `campaign_summary.v1` + 5 samples pasted
- [ ] T6 Pilot backlog linked in prod (M08 migrations on prod → estimate posted → approved → run → counts pasted)
- [ ] T7 Spot-check 30 campaigns (wrong merges / splits)
- [ ] T8 Prod readiness checklist (`docs/runbooks/PILOT.md`) complete + MA-18 requested
- [ ] T9 Go live after MA-18: prod schedules on, pilot dates recorded on root board
- [ ] T10 Three clean daily runs in prod
- [ ] T11 Pilot monitoring routine documented, first log line written, root board updated (M09–M11 Parallel-OK)

## Acceptance criteria
- [ ] AC1 pgTAP for new RPCs pass (idempotency, grants) — evidence:
- [ ] AC2 10-item cross-platform fixture → 1 campaign, 3 platforms, item_count 10 — evidence:
- [ ] AC3 Same brand × house 90+ days later → new campaign; other house → other campaign — evidence:
- [ ] AC4 Website page embedding a known Vimeo video links without an OpenAI call — evidence:
- [ ] AC5 Re-run creates 0 new links/campaigns — evidence:
- [ ] AC6 Pilot backlog 100% linked or in `campaign_merge` review — counts:
- [ ] AC7 Spot-check: wrong merges ≤ 10%, wrong splits ≤ 15% — table:
- [ ] AC8 Prod readiness checklist fully ticked — evidence:
- [ ] AC9 MA-18 approved; pilot day 1 + day 14 on root board — evidence:
- [ ] AC10 Three consecutive clean prod days — daily check rows:
- [ ] AC11 Root board: M08 Done, M09–M11 Parallel-OK, M12 wait condition; `docs/runbooks/PILOT.md` exists — evidence:
- [ ] AC12 Workflows exported without credentials — evidence:

## Blockers
- none

## Manual actions needed from the owner
| # | Action | Why | Status |
|---|---|---|---|
| MA-11 (prod) | Confirm prod n8n credentials (Postgres prod `n8n_writer`, Apify, OpenAI, Vimeo, YouTube, Firecrawl, Notify) | Prod copies of workflows need them | Not requested yet |
| MA-13 | Confirm daily budget for prod (default per OPEN_QUESTIONS Q-07: 150 USD/day during backfill, 25 USD/day steady) | Budget alert in WF-91 | Not requested yet |
| — | Prod-scoped Supabase token, or run `supabase db push` + seed against prod yourself (Codex supplies the commands) | Bring prod schema + seed up to date | Not requested yet |
| MA-04 | Prod-scoped Supabase token (or owner runs `supabase db push` on prod) | Needed for T6/T8 prod migrations | Not requested yet |
| MA-18 | Approve pilot start (readiness checklist) — reply "approved, start on <date>" | Switches prod schedules on; starts the 14-day pilot clock (backfill already done in M04–M07) | Not requested yet |

## Decisions & deviations
- none yet (expected: 120-day max campaign span guard, risk R2)

## Risks / notes for the owner
- The pilot clock starts only after you approve MA-18. During the 14 days Codex won't change thresholds, prompts or actors in prod unless something is broken (any hotfix is logged below with its date).

## Pilot monitoring log
<!-- During M09–M11 Codex runs scripts/assert/pilot_daily_check.sql on prod once per working day and appends one line here (newest first):
date · runs ok % · accounts ok % · failing accounts (n, top handles) · new items by platform · ai/embed/media queue · review open · cost yesterday / budget · MTD / forecast · notes/hotfixes -->
- —

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: pilot dates, how to run the daily check, which Supabase project web previews use, known data gaps. -->
- —
