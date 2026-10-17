# PROGRESS — everyone. Market Radar

> The project board. Codex updates it whenever a milestone changes status. The owner checks it first to see where we stand.
> Details for each milestone are in `milestones/Mxx-*/PROGRESS.md`.

## Now
| | |
|---|---|
| **Current milestone** | M00 — Repo bootstrap & tooling |
| **Status** | In progress |
| **Next step** | Complete M00 bootstrap on m00-bootstrap; owner actions MA-01/MA-02 pending |
| **Waiting on owner** | MA-01 (repo access), MA-02 (Vercel project) |
| **Pilot** | Not started (begins at the end of M08; runs 14 days) |
| **Last updated** | 2026-10-17 (M00 implementation authorized and started) |

## Milestone board

| ID | Milestone | Status | Started | Done | Blockers / owner actions | PR |
|---|---|---|---|---|---|---|
| M00 | Repo bootstrap & tooling | In progress | 2026-10-17 | | MA-01, MA-02 | |
| M01 | Supabase foundation | Not started | | | MA-03…MA-06 | |
| M02 | Seed data & account resolution | Not started | | | MA-07…MA-09 | |
| M03 | n8n foundation | Not started | | | MA-10…MA-13 | |
| M04 | Collectors I: Vimeo + Instagram | Not started | | | MA-14 | |
| M05 | Collectors II: Websites, YouTube, LinkedIn | Not started | | | MA-15 | |
| M06 | Collectors III: Stories + upkeep | Not started | | | MA-16, MA-20 (first Vercel env vars for the media route) | |
| M07 | AI understanding | Not started | | | MA-17 | |
| M08 | Campaign linker + pilot launch | Not started | | | MA-04 (prod token), MA-18 | |
| M09 | Web app foundation | Not started | | | MA-19, MA-20 | |
| M10 | Web app entities | Not started | | | — | |
| M11 | Search, review, admin | Not started | | | MA-20, MA-21 | |
| M12 | Pilot review & tuning (gate) | Not started | | | MA-22 (go/no-go) | |
| M13 | News, briefs, alerts | Not started | | | MA-23, MA-24 | |
| M14 | Agent API + MCP | Not started | | | MA-20, MA-25 | |
| M15 | Scale & launch | Not started | | | MA-26…MA-28 | |

Status values: `Not started` · `In progress` · `Blocked: <reason>` · `In review` · `Done` · `Parallel-OK`

## Key dates
| Event | Date |
|---|---|
| Handoff pack created | 2026-10-17 |
| Pilot day 1 | — |
| Pilot review (day 14) | — |
| Production launch | — |

## Log (newest first)
- 2026-10-17 · Added Taste as `design-taste-frontend`, pinned to `f624f37a8c650b9cc550253104925efe4c8de246`, for every frontend task alongside the existing engineering/design rules. Local-only installation now has 29 skills; helper syntax/local fixtures passed, with native discovery and integrity receipts in `.agents/skill-receipts/`. Everyone design remains authoritative; no app milestone, hosted or global action. n8n remains pending.
- 2026-10-17 · Skill setup only: 28 pinned upstream skills in `.agents/skills/`; n8n release integrity verified but installation pending the M03 Cloud runtime/typeVersion check. See `SKILLS_SETUP.md` and `SKILLS_LOCK.json`. No application milestone started; no hosted or global configuration changed. This folder is not yet a Git repository, so no commit or PR was made.
- 2026-10-17 · Handoff pack created: PRD, technical design, data schema, design system, workflows, API, milestones M00–M15.
