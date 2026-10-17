# PROGRESS — everyone. Market Radar

> The project board. Codex updates it whenever a milestone changes status. The owner checks it first to see where we stand.
> Details for each milestone are in `milestones/Mxx-*/PROGRESS.md`.

## Now

|                       |                                                                       |
| --------------------- | --------------------------------------------------------------------- |
| **Current milestone** | M01 — Supabase foundation (not started; awaiting instruction)         |
| **Status**            | Not started                                                           |
| **Next step**         | M00 complete. Stop and await the owner's next instruction before M01. |
| **Waiting on owner**  | New instruction for M01; no M00 owner actions remain                  |
| **Pilot**             | Not started (begins at the end of M08; runs 14 days)                  |
| **Last updated**      | 2026-10-17 (M00 completed; M01 not started)                           |

## Milestone board

| ID  | Milestone                                  | Status      | Started    | Done       | Blockers / owner actions                                 | PR                                                                                      |
| --- | ------------------------------------------ | ----------- | ---------- | ---------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| M00 | Repo bootstrap & tooling                   | Done        | 2026-10-17 | 2026-10-17 | —                                                        | [#1 merged](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/1) |
| M01 | Supabase foundation                        | Not started |            |            | MA-03…MA-06                                              |                                                                                         |
| M02 | Seed data & account resolution             | Not started |            |            | MA-07…MA-09                                              |                                                                                         |
| M03 | n8n foundation                             | Not started |            |            | MA-10…MA-13                                              |                                                                                         |
| M04 | Collectors I: Vimeo + Instagram            | Not started |            |            | MA-14                                                    |                                                                                         |
| M05 | Collectors II: Websites, YouTube, LinkedIn | Not started |            |            | MA-15                                                    |                                                                                         |
| M06 | Collectors III: Stories + upkeep           | Not started |            |            | MA-16, MA-20 (first Vercel env vars for the media route) |                                                                                         |
| M07 | AI understanding                           | Not started |            |            | MA-17                                                    |                                                                                         |
| M08 | Campaign linker + pilot launch             | Not started |            |            | MA-04 (prod token), MA-18                                |                                                                                         |
| M09 | Web app foundation                         | Not started |            |            | MA-19, MA-20                                             |                                                                                         |
| M10 | Web app entities                           | Not started |            |            | —                                                        |                                                                                         |
| M11 | Search, review, admin                      | Not started |            |            | MA-20, MA-21                                             |                                                                                         |
| M12 | Pilot review & tuning (gate)               | Not started |            |            | MA-22 (go/no-go)                                         |                                                                                         |
| M13 | News, briefs, alerts                       | Not started |            |            | MA-23, MA-24                                             |                                                                                         |
| M14 | Agent API + MCP                            | Not started |            |            | MA-20, MA-25                                             |                                                                                         |
| M15 | Scale & launch                             | Not started |            |            | MA-26…MA-28                                              |                                                                                         |

Status values: `Not started` · `In progress` · `Blocked: <reason>` · `In review` · `Done` · `Parallel-OK`

## Key dates

| Event                 | Date       |
| --------------------- | ---------- |
| Handoff pack created  | 2026-10-17 |
| Pilot day 1           | —          |
| Pilot review (day 14) | —          |
| Production launch     | —          |

## Log (newest first)

- 2026-10-17 · M00 Done: owner authorized protection and merge; main requires PRs plus quality/unit/build (admins included). PR #1 merged to 0b71ea9; main CI39052887942 passed quality/unit/build/e2e (39 unit tests, 4 browser/axe checks). All AC1–AC9 pass. Final records published through protected PR workflow. M01 remains Not started and needs a new instruction. No M00 manual action remains.

- 2026-10-17 · M00 implemented on m00-bootstrap, PR#1 open: clean frozen install, quality tooling,39 unit tests,4 browser/axe checks and separate dev smoke pass; independent review and token parity regression recorded. Git-linked Vercel preview verified. Corrected PR CI run 39052213057 is green; final evidence-only update reruns checks. MA-01 owner protection, explicit merge approval and main CI keep M00 In review. M01 not started. See M00 PROGRESS/evidence.

- 2026-10-17 · Added Taste as `design-taste-frontend`, pinned to `f624f37a8c650b9cc550253104925efe4c8de246`, for every frontend task alongside the existing engineering/design rules. Local-only installation now has 29 skills; helper syntax/local fixtures passed, with native discovery and integrity receipts in `.agents/skill-receipts/`. Everyone design remains authoritative; no app milestone, hosted or global action. n8n remains pending.
- 2026-10-17 · Skill setup only: 28 pinned upstream skills in `.agents/skills/`; n8n release integrity verified but installation pending the M03 Cloud runtime/typeVersion check. See `SKILLS_SETUP.md` and `SKILLS_LOCK.json`. No application milestone started; no hosted or global configuration changed. This folder is not yet a Git repository, so no commit or PR was made.
- 2026-10-17 · Handoff pack created: PRD, technical design, data schema, design system, workflows, API, milestones M00–M15.
