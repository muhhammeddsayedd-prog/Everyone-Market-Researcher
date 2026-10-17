# M06 — Collectors III: Instagram stories + upkeep · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Not started** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | `m06-collectors-stories-upkeep` / — |
| Current task | — |
| Next step | Start T1: run the three story actors once in dev (no login) and save fixtures, incl. a "no stories" account. |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [ ] T1 — Fixtures (dev)
- [ ] T2 — Migration
- [ ] T3 — Media route (`apps/web`)
- [ ] T4 — WF-31 · Media v1 (dev)
- [ ] T5 — WF-12 · Stories collector + bake-off (dev → prod)
- [ ] T6 — WF-40 · Removal check + weekly paid metrics refresh (dev)
- [ ] T7 — Health surfacing (WF-91)
- [ ] T8 — Prod copies + verification
- [ ] T9 — Tests + export + hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md §9; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Stories captured (dev, 7 days, bake-off accounts) — evidence:
- [ ] AC2 — Same-day thumbnails — evidence:
- [ ] AC3 — Bake-off report — evidence:
- [ ] AC4 — Removal check — evidence:
- [ ] AC5 — Metrics refresh — evidence:
- [ ] AC6 — Idempotency — evidence:
- [ ] AC7 — Health — evidence:
- [ ] AC8 — Media route security — evidence:
- [ ] AC9 — Scheduling — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- none

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. Steps: docs/MANUAL_ACTIONS.md + MILESTONE.md §11. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-20 (part, early) | Vercel env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, INTERNAL_WEBHOOK_SECRET (Preview=dev, Production=prod); same secret in n8n credential "EMR internal secret" | Media upload route for WF-31 (T3) | Not requested yet |
| MA-10 (check) | Confirm a paid Apify plan if louisdeconinck should join the bake-off | Bake-off (T5) | Not requested yet |
| MA-16 | Pick the stories actor from the bake-off table; answer twice-daily yes/no (Q-08); approve prod migration push | After the 7-day bake-off (T5) | Not requested yet |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Planned: WF-31 v1, `/api/internal/media-upload-url`, `ops.get_media_targets` and `ops.save_media_asset` move from M07 to M06 (story/IG CDN URLs expire).
- Planned: paid-source (Instagram, LinkedIn) metrics refresh weekly via the WF-40 30-day listing (`removal_window_days_paid = 30`); free APIs (Vimeo, YouTube) refresh daily over 30 days. Update SCRAPING_SOURCES §0 rule 2 and FR-S4 wording.
- Planned: `ops.mark_removed` signature uses `p_since date` instead of `p_window_days int`.

## Risks / notes for the owner
- none yet

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. See MILESTONE.md §14 for the required items. -->
- —
