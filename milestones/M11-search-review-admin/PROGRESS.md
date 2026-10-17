# M11 — Search, review, admin · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.
> **Parallel-OK while the pilot runs:** also run the daily pilot check each working session and log it in `milestones/M08-campaign-linker-pilot-launch/PROGRESS.md` → Pilot monitoring log.

## Status
**Not started** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | `m11-search-review-admin` / — |
| Current task | — |
| Next step | Start T1: rewrite `app.search` cleanly (one CTE per source, RRF k=60) in migration `review_admin_search`, add the query-embedding cache, and benchmark 5 queries on 100k synthetic items locally (< 800 ms) |
| Query-embedding cache (DB table / LRU) | — (decide in T1) |

## Task checklist
- [ ] T1 Clean `app.search` + query-embedding cache + EXPLAIN on 100k synthetic items
- [ ] T2 `/search` page + ⌘K command + find-similar + keyword-only fallback
- [ ] T3 Review RPCs (resolve all kinds × actions, correct, merge orgs/people/campaigns, split, edit, reopen) + workers + pgTAP
- [ ] T4 `/review` UI (keyboard, undo, audit pill) + CorrectionDialog wired in drawer, campaign and entity pages
- [ ] T5 Admin RPCs + workers (competitor upsert + derive_handle, account status, rescrape, members, API keys, taxonomy, alert rules, settings, costs, price book, pipeline)
- [ ] T6 `/admin/competitors` (+ new, edit) + best-effort onboarding webhook + profile account buttons wired
- [ ] T7 `/admin/taxonomies`
- [ ] T8 `/admin/pipeline` + settings card (pilot confirm dialog)
- [ ] T9 `/admin/costs` (KPIs, charts, price book, forecast)
- [ ] T10 `/admin/users` + `/admin/api-keys` (secret shown once, hash only)
- [ ] T11 `/settings/alerts` (admin rules, self-subscribe, default owner rules) + `/settings/profile`
- [ ] T12 e2e + role-guard matrix + axe + `docs/runbooks/ADMIN.md` + `ACCEPTANCE_WALKTHROUGH.md` + MA-21

## Acceptance criteria
- [ ] AC1 Migration on dev + prod; pgTAP green (search, review kinds × actions, merges, locks vs re-extraction, admin guards, subscribe); advisors clean — evidence:
- [ ] AC2 5 benchmark queries relevant and < 800 ms on 100k synthetic; keyword-only fallback — timings:
- [ ] AC3 ⌘K everywhere; `/search` tabs/groups/find-similar; no OpenAI key in client bundle — evidence:
- [ ] AC4 Every review kind resolved by keyboard; undo; locked field survives re-extraction; human alias taught — evidence:
- [ ] AC5 Corrections from drawer, campaign (edit/split/merge), entities (edit/merge) work + audited — evidence:
- [ ] AC6 Test competitor in dev → pending backfill picked up by WF-00 (run id); out-of-scope refused; pause/resume/rescrape; onboarding call logged — evidence:
- [ ] AC7 Taxonomy CRUD reflected in WF-30 snapshot; pipeline page = `ops.scrape_runs`; settings audited + pilot confirm — evidence:
- [ ] AC8 Costs totals = ledger SQL; forecast unit-tested; top line answers the cost question — evidence:
- [ ] AC9 Invite, role change, last-admin guard; key shown once, hash only; revoke — evidence:
- [ ] AC10 Alerts UI: admin edits, viewer self-subscribes only; default owner rules exist — evidence:
- [ ] AC11 Role guard matrix e2e; axe 0 serious/critical on 4 key pages — evidence:
- [ ] AC12 Owner completed ACCEPTANCE_WALKTHROUGH.md (MA-21); blocking issues fixed — notes:

## Blockers
- none

## Manual actions needed from the owner
| # | Action | Why | Status |
|---|---|---|---|
| MA-20 (addition) | Vercel env (Preview = dev, Production = prod): `OPENAI_API_KEY`, `OPENAI_MODEL_EMBED`, `API_KEY_PEPPER` (generate once, keep forever), `N8N_WEBHOOK_BASE`, `N8N_WEBHOOK_SECRET` | Search embeddings, API key hashing, onboarding call | Not requested yet |
| — | Run the prod migration if Codex has no prod token (command supplied) | Ship to production | Not requested yet |
| MA-21 | Acceptance walkthrough on production (`ACCEPTANCE_WALKTHROUGH.md`), tick each step, write notes here | Owner sign-off on review + admin flows | Not requested yet |

## Decisions & deviations
- none yet (expected: query-embedding cache choice; `app.entity_status` gains `rejected`; `API_KEY_PEPPER` needed from M11 instead of M14; new competitors default to paused during the pilot)

## Risks / notes for the owner
- New competitors added during the pilot are **paused by default** so the pilot stays clean; tick "Start tracking now" only if you want them in immediately (adds cost).
- API keys can be created now but only work once the Agent API ships (M14). Alert emails start in M13.

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: review/audit-sample stats queries, cost data + forecast location, tunable settings for the gate, review backlog size, open walkthrough issues. -->
- —
