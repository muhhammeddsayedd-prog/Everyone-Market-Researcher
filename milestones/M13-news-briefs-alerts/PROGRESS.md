# M13 — News, briefs, alerts · PROGRESS

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
| Next step | Start T1: create migration m13_news_briefs_alerts (news/brief/alert RPCs, ops.alert_log, default alert rules) |

## Task checklist
- [ ] T1 — Database: news, briefs and alert RPCs
- [ ] T2 — WF-22 News (weekly, Sunday 07:00)
- [ ] T3 — WF-23 Awards (weekly, Sunday 07:30)
- [ ] T4 — WF-50 Weekly briefs (Monday 08:00)
- [ ] T5 — WF-30 / collectors → instant rules and specific revalidation tags
- [ ] T6 — WF-80 Alerts
- [ ] T7 — Settings → Alerts UI
- [ ] T8 — `/news`, `/briefs`, `/briefs/[week]` and the News tabs
- [ ] T9 — Go live in prod

## Acceptance criteria
- [ ] AC1 — WF-22 and WF-23 run in prod on schedule (Sunday 07:00 / 07:30 Cairo) — evidence:
- [ ] AC2 — The first Monday after go-live, 4 briefs (EG, KSA, UAE, ALL) exist in `app.briefs` — evidence:
- [ ] AC3 — The weekly brief email reaches mohamed.abdelrahman@everyone.film with links to the 4 briefs — evidence:
- [ ] AC4 — The daily digest arrives at 09:00 Cairo (±10 min) — evidence:
- [ ] AC5 — A test item that meets the instant rule produces exactly one instant email — evidence:
- [ ] AC6 — Budget and failing-sources emails trigger from WF-91 when forced in dev (set the budget to $0.01; set a test account to failing) — evidence:
- [ ] AC7 — After a pipeline run, the affected pages (`/feed`, `/competitors/<slug>`, `/campaigns/<id>`, `/news`, `/briefs`) show new data within 2 minutes without a red… — evidence:
- [ ] AC8 — `/settings/alerts` works as specified (admin edits rules; members self-subscribe only), with the e2e tests green — evidence:
- [ ] AC9 — pgTAP, Vitest and Playwright tests for this milestone pass in CI — evidence:

## Blockers
- none

## Manual actions needed from the owner
| # | Action | Why | Status |
|---|---|---|---|
| MA-23 | Choose email provider (default Resend), verify sending domain (SPF/DKIM), add credential in n8n, confirm recipients | Alerts and briefs are sent by email (D-21) | Not requested yet |
| MA-24 | Create SerpAPI account + plan (~140 searches/week pilot, ~620 full), add key to n8n | News and awards come from SerpAPI (D-09) | Not requested yet |
| — | Confirm/adjust instant-launch rule (Q-06) after the first week | Default rule may be too noisy or too quiet | Not requested yet |
| — | Review email template previews | Brand quality of emails | Not requested yet |

## Decisions & deviations
- none

## Risks / notes for the owner
- none

## Session log
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
- —
