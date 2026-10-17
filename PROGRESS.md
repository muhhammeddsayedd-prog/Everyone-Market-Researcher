# PROGRESS — everyone. Market Radar

> The project board. Codex updates it whenever a milestone changes status. The owner checks it first to see where we stand.
> Details for each milestone are in `milestones/Mxx-*/PROGRESS.md`.

## Now

|                       |                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Current milestone** | M01 — Supabase foundation                                                                                                              |
| **Status**            | Blocked: MA-04 — private dev migration password                                                                                        |
| **Next step**         | Dev OAuth works. Privately configure existing PGPASSWORD, then exact-version CLI dry-run/push and hosted acceptance. See M01 evidence. |
| **Waiting on owner**  | MA-04 migration credential; MA-05 role passwords after push; MA-06 Google client. Separate prod baseline/PR4 merge gates remain open.  |
| **Pilot**             | Not started (begins at the end of M08; runs 14 days)                                                                                   |
| **Last updated**      | 2026-10-17 (live dev MCP/PG17.11 verified; Email disabled; no hosted migrations)                                                       |

## Milestone board

| ID  | Milestone                                  | Status         | Started    | Done       | Blockers / owner actions                                            | PR                                                                                      |
| --- | ------------------------------------------ | -------------- | ---------- | ---------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| M00 | Repo bootstrap & tooling                   | Done           | 2026-10-17 | 2026-10-17 | —                                                                   | [#1 merged](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/1) |
| M01 | Supabase foundation                        | Blocked: MA-04 | 2026-10-17 |            | Exact-version migration credential; MA-05/06; prod/merge gates open | [#4 draft](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/4)  |
| M02 | Seed data & account resolution             | Not started    |            |            | MA-07…MA-09                                                         |                                                                                         |
| M03 | n8n foundation                             | Not started    |            |            | MA-10…MA-13                                                         |                                                                                         |
| M04 | Collectors I: Vimeo + Instagram            | Not started    |            |            | MA-14                                                               |                                                                                         |
| M05 | Collectors II: Websites, YouTube, LinkedIn | Not started    |            |            | MA-15                                                               |                                                                                         |
| M06 | Collectors III: Stories + upkeep           | Not started    |            |            | MA-16, MA-20 (first Vercel env vars for the media route)            |                                                                                         |
| M07 | AI understanding                           | Not started    |            |            | MA-17                                                               |                                                                                         |
| M08 | Campaign linker + pilot launch             | Not started    |            |            | MA-04 (prod token), MA-18                                           |                                                                                         |
| M09 | Web app foundation                         | Not started    |            |            | MA-19, MA-20                                                        |                                                                                         |
| M10 | Web app entities                           | Not started    |            |            | —                                                                   |                                                                                         |
| M11 | Search, review, admin                      | Not started    |            |            | MA-20, MA-21                                                        |                                                                                         |
| M12 | Pilot review & tuning (gate)               | Not started    |            |            | MA-22 (go/no-go)                                                    |                                                                                         |
| M13 | News, briefs, alerts                       | Not started    |            |            | MA-23, MA-24                                                        |                                                                                         |
| M14 | Agent API + MCP                            | Not started    |            |            | MA-20, MA-25                                                        |                                                                                         |
| M15 | Scale & launch                             | Not started    |            |            | MA-26…MA-28                                                         |                                                                                         |

Status values: `Not started` · `In progress` · `Blocked: <reason>` · `In review` · `Done` · `Parallel-OK`

## Key dates

| Event                 | Date       |
| --------------------- | ---------- |
| Handoff pack created  | 2026-10-17 |
| Pilot day 1           | —          |
| Pilot review (day 14) | —          |
| Production launch     | —          |

## Log (newest first)

- 2026-10-17 · M01 resume: live dev-scoped MCP OAuth reads now work through fresh official App Server client; native chat catalogue remains stale. Dev PostgreSQL17.11/empty migrations verified, both Git auto-deploy controls OFF. Email provider disabled/rechecked; Google still disabled. Exact seven-version CLI route needs private existing PGPASSWORD (MA-04); machine-role and Google prerequisites remain. Pre-migration security0/performance1 INFO; lagged usage and spend cap recorded. Source8a65025/CI39057325483 green; PR4 stays draft. No hosted schema, prod migration, reset or M02 work. [M01 receipt](milestones/M01-supabase-foundation/evidence/hosted-resume-20261017.json).
- 2026-10-17 · M01 local foundation delivered in draft PR#4 (504b54a/041d971). Seven migrations,242 pgTAP assertions, REST/Auth, four actual concurrency scenarios and18 script checks pass. CI39057026434 passed all five jobs plus Vercel. Owner-created dev/prod verified Pro/Frankfurt; requested dev-scoped MCP added and OAuth succeeded, but active tools require reconnect/session refresh (MA-04). No hosted migration or M02 work. Remaining gates are explicit in M01 PROGRESS.

- 2026-10-17 · Owner authorized the next milestone, M01. Branch m01-supabase-foundation from verified main d06dcd9; existing worktree clean. Docker installed but daemon stopped; no scoped Supabase token/project refs in runtime and no connected Supabase tools. CLI/local setup, source review and access discovery started. Production/billing gates remain unapproved.

- 2026-10-17 · M00 Done: owner authorized protection and merge; main requires PRs plus quality/unit/build (admins included). PR #1 merged to 0b71ea9; main CI39052887942 passed quality/unit/build/e2e (39 unit tests, 4 browser/axe checks). All AC1–AC9 pass. Final records published through protected PR workflow. M01 remains Not started and needs a new instruction. No M00 manual action remains.

- 2026-10-17 · M00 implemented on m00-bootstrap, PR#1 open: clean frozen install, quality tooling,39 unit tests,4 browser/axe checks and separate dev smoke pass; independent review and token parity regression recorded. Git-linked Vercel preview verified. Corrected PR CI run 39052213057 is green; final evidence-only update reruns checks. MA-01 owner protection, explicit merge approval and main CI keep M00 In review. M01 not started. See M00 PROGRESS/evidence.

- 2026-10-17 · Added Taste as `design-taste-frontend`, pinned to `f624f37a8c650b9cc550253104925efe4c8de246`, for every frontend task alongside the existing engineering/design rules. Local-only installation now has 29 skills; helper syntax/local fixtures passed, with native discovery and integrity receipts in `.agents/skill-receipts/`. Everyone design remains authoritative; no app milestone, hosted or global action. n8n remains pending.
- 2026-10-17 · Skill setup only: 28 pinned upstream skills in `.agents/skills/`; n8n release integrity verified but installation pending the M03 Cloud runtime/typeVersion check. See `SKILLS_SETUP.md` and `SKILLS_LOCK.json`. No application milestone started; no hosted or global configuration changed. This folder is not yet a Git repository, so no commit or PR was made.
- 2026-10-17 · Handoff pack created: PRD, technical design, data schema, design system, workflows, API, milestones M00–M15.
