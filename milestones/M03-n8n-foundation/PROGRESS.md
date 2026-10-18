# M03 — n8n foundation · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Blocked: waiting on owner — MA-04 (M03 dev), MA-11, MA-12**

| Field | Value |
|---|---|
| Started | 2026-10-18 Cairo |
| Last updated | 2026-10-18 Cairo |
| Finished | — |
| Branch / PR | `m03-n8n-foundation` from main `dc146f8`; [PR #8](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/8), draft and unmerged |
| Current task | T1 and AC12 complete. Local database, 23 inactive native blueprints and bounded GET-only API consumer are reviewed; actual dev database/n8n credentials and IDs are the next gates. |
| Next step | Verify the new M03 dev migration handoff when supplied, apply the two pending versions once, then hosted readback/advisors/types. Independently verify canonical n8n credentials and finish the foundation. |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [x] T1 — Five plan facts recorded below; actual UI capability evidence and current official plan/billing rules are distinguished. No execution/billing experiment claimed.
- [ ] T2 — n8n MCP/API access + repo conventions (needs MA-11)
- [ ] T3 — Credentials (MA-10, MA-11, MA-12)
- [ ] T4 — Migration: local complete (12 RPCs incl atomic callback,137 new/379 total SQL tests, advisors/types); hosted dev pending. Known Scale prices/budget25 local; fixed fees explicitly unknown.
- [ ] T5 — Shared sub-workflows (dev)
- [ ] T6 — WF-90 · Error handler (dev)
- [ ] T7 — WF-19 · Apify run callback (dev)
- [ ] T8 — WF-00 · Orchestrator + collector stubs (dev, inactive)
- [ ] T9 — WF-91 · Health & cost + WF-99 smoke test (dev)
- [ ] T10 — Export, document, hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->
- [x] AC1 — Plan facts recorded — actual n8n 2.43.5, paid Cloud plan, upgraded 50,000 allowance; the five facts and evidence boundaries are recorded below.
- [ ] AC2 — Credentials work — evidence:
- [ ] AC3 — RPCs implemented and tested — evidence:
- [ ] AC4 — Price book + budget set — evidence:
- [ ] AC5 — Smoke path end to end — evidence:
- [ ] AC6 — Idempotency — evidence:
- [ ] AC7 — Forged callback rejected — evidence:
- [ ] AC8 — Error routing — evidence:
- [ ] AC9 — Orchestrator dispatch — evidence:
- [ ] AC10 — Health — evidence:
- [ ] AC11 — Exports clean — evidence:
- [x] AC12 — Budget documented — conservative steady-state estimate 160/day pilot and 181/day full scope, both below 200/day; shared quota and billing-rule boundaries below.

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- Browser sign-in is RESOLVED: after owner replied “Workflows visible in Person1”, root observed the actual Overview, Personal project and n8n2.43.5/Pro Monthly/Cairo/community-nodes ON. Earlier failed observations remain historical. SDK/suggested-node/project calls still return `-32603` after actual authenticated verification; this is an independent connector failure. Do not request another sign-in or repeat MCP setup. [Readback](evidence/n8n-runtime-access-20261018.json).
- The new M03 dev migration handoff and the separate n8n API handoff were absent when their reviewed consumers performed public seal/presence checks. No private file was read, authentication attempted or hosted M03 migration applied. Exact commands are below. Actual canonical credential tests and bindings also remain pending; local native blueprints are not hosted exports. WF-19/WF-99 provider/launch work remains gated by that verified connection and bounded live-smoke preparation.
- Owner upgraded the plan during this work. Actual Cloud Dashboard subsequently shows 11,001/50,000 October executions and Online 2.43.5. Prior 10,000/10,000 is historical; the difference is not attributed to M03. The temporary unused node probe encountered Connection lost during the upgrade; its first JSON export was downloaded despite an observer timeout and reconciled before any retry. The probe is now archived recoverably, with a fresh Archived/Unarchive readback. It was never executed or published. [Capability and cleanup evidence](evidence/n8n-node-capability-20261018.json).
- MA-10 tier is owner-reported Scale; provider credential metadata/test calls and MA-12 remain unverified. Exact monthly fees are unknown; owner said tool costs do not matter, so do not keep requesting them or fabricate fees. Use Q-07 steady-state USD25/day default for the pending plan migration; current hosted budget remains150 until applied/read back. No old handoff was requested or consumed.

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-10 | Scale already supplied. Follow the exact `Apify API` Header Auth fields in [the owner steps](evidence/credential-owner-steps-20261018.md). | T3/T4 prices | Private entry requested; authentication pending |
| MA-11 | Personal → Credentials → Add credential; create the five exact dev names using [the reviewed fields](evidence/credential-owner-steps-20261018.md). Postgres uses the existing M01 dev writer password, SSL Require, Ignore SSL Issues off, max 5. Header Auth uses explicit allowed domains. Reply `M03 credentials saved` with any missing names. No further sign-in or shared-credential changes. | T3; saved credentials are separate from actual endpoint checks. Connector internal errors remain an independent T2 gate. | Exact action requested; no private values read |
| MA-11 (API) | Settings → n8n API at the verified instance; reuse a saved valid key or create `Market Radar M03 temporary` with short expiry. In Windows PowerShell run `& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03N8nApiHandoff.ps1'`, enter that key at the hidden prompt, close the window, then reply `M03 n8n API handoff ready`. Expected output starts `M03 n8n encrypted handoff saved.` [Exact fields, bounds and cleanup](evidence/n8n-api-owner-steps-20261018.md). | Read-only public-API fallback; at most seven fixed-instance GETs, no provider calls or workflow writes. Pro key is account-wide; consumer is narrowly constrained. | Public seal verified; new handoff absent, no API request |
| MA-12 | market-radar project API key → `OpenAI API`; Models read suffices for M03. Project settings → Limits → Spend → Edit spend limit → choose monthly USD cap → Enforce a hard limit → Save. See [exact steps](evidence/credential-owner-steps-20261018.md); report only the non-secret cap. | T3; no paid model call or Vercel secret yet | Private entry requested; actual test pending |
| MA-13 | Documented Q-07 USD25/day steady-state default selected after owner deprioritized fees. It is an alert threshold, not a provider cap. | T4 budget alert | Local migration/readback25 complete; hosted150 unchanged |
| MA-04 (M03 dev) | In Windows PowerShell run `& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\New-M03DevMigrationHandoff.ps1'`; enter the existing emr-dev administrator database password at the hidden prompt, close the window and reply `M03 dev migration handoff ready`. Expected output starts `M03 dev migration encrypted handoff saved.` [Exact packet and recovery steps](evidence/dev-migration-packet-20261018.md). | Credential delivery for the already-authorized two additive dev migrations; no old handoff, reset or general dev approval | Public packet/seals checked; new handoff absent, no decryption/authentication |
| info | Examples were not actual fees. Preserve unknown monthly fees rather than writing zero/example values. Record verified fees later if visible; no further questionnaire requested. | Honest fixed-cost reporting | Owner deprioritized fees; AC4 fixed-cost coverage remains explicitly incomplete |
| optional | Use log-only notification for M03; SMTP is not required. | T5 Notify | No owner action needed |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Callback spec correction under review: marking `processed_at` before ingest loses work after partial failure. Reordering alone is insufficient because chunk inserts, account receipts and costs need a durable atomic callback receipt. M03 will use a bounded atomic persistence RPC for the one-page website smoke branch; unsupported later collector branches fail closed. Existing M01 interfaces/seven migration versions remain intact.
- Default callback verification is option (b), registered-run lookup plus authenticated Apify run readback. Callback-supplied context, dataset IDs, actor/status/usage are never trusted for persistence.
- Official documentation supplements actual plan facts but does not establish the owner's tier/runtime. Pending n8n skill remains outside discovery until its actual-runtime/schema gate passes.
- One-page M03 payload minimizes the generic raw-source contract to canonical URL, capped markdown and title; synthetic request/header/cookie fields are omitted. Raw provider HTTP/SQL error messages/stacks are likewise replaced by fixed classified summaries before audit logging. These changes prevent credential-bearing context from reaching logs/storage; they do not assert generic secret redaction.

## Verified plan facts (T1)

Actual browser identity: owner-confirmed `muhhammedsayed.app.n8n.cloud`, Personal
project `pHvQjDmjxVZ3KQLT`, runtime 2.43.5, Africa/Cairo. Cloud Manage showed Pro
(Monthly); after the owner's upgrade its dashboard showed 11,001/50,000 used.
This is the shared instance allowance, not a dedicated Market Radar reservation.

| Fact | Answer and evidence boundary |
| --- | --- |
| Execution timeout | The actual unused workflow saved 900 seconds successfully. Current [Cloud pricing](https://n8n.io/pricing/) documents 40 minutes for Pro/Enterprise; the instance's hard maximum was not experimentally tested. M03 keeps 15 minutes. |
| Sub-workflow quota | Current [execution documentation](https://docs.n8n.io/build/understand-workflows/understand-executions.md#how-executions-count-towards-quotas) says Execute Sub-workflow calls do not count separately; only the top-level production execution counts. Manual and error executions are also excluded by the documented rule. This is the rule for the observed paid plan, not an independently measured billing experiment. |
| Variables | Personal Variables page shows Create variable and Edit/Delete controls. Names/values were not read; no variable was changed. |
| Verified Apify node | Actual picker shows installed/verified Apify package version 0.6.10 (Legacy), update available. No install/update or actor execution occurred. HTTP Request remains the reviewed API path; a current Apify node schema is not assumed. |
| Postgres parameters | Actual Postgres 2.7 offers Options → Query Parameters (`options.queryReplacement`) and `$1/$2/$3` help. No connection was made. |

The [live capability receipt](evidence/n8n-node-capability-20261018.json) records
12 exported node versions and the archived unused probe. It is not a foundation
execution or successful API-access receipt. The pending n8n skill remains
unpromoted; complete relevant schema/restriction mapping is a separate gate.

## Execution estimate (AC12)

The existing [workflow budget](../../docs/N8N_WORKFLOWS.md#3-executions-budget)
estimates about **160 executions/day for the pilot** and **181/day at full
scope**, both below 200/day. Retaining those conservative totals gives 4,960
and 5,611 executions in a 31-day month, respectively (at most about 11.3% of the
verified 50,000 allowance). The old estimate includes about 27 daily SUB calls;
current documented paid-plan billing excludes those separate calls. These are
planning estimates, not measured production usage or a reserved quota.

Approved backfill weeks were estimated separately at about 150 additional
executions/day; they are excluded from steady state and remain unstarted.
Other projects share this instance and consume its allowance. The observed
11,001 used is shared account usage; no part is attributed to the unused M03
probe. The upgrade alone does not prove Cloud queue-mode entitlement. M03 uses
ordinary Cloud execution with asynchronous actor callbacks; no queue-mode or
concurrency setting was changed.

## Risks / notes for the owner
- none

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-18 · Local native preparation now covers 15 stubs, five SUBs, WF-90, WF-00 and WF-91 (23 blueprints), all inactive and requiring actual bindings. Root's combined changed-code check passed 48/48: 30 foundation/graph/clock/cross-adapter checks plus 18 API-reader checks; binding tests separately 15/15. Targeted lint/format passed. No actual bindings file, hosted workflow export or execution is claimed. Independent review caught/fixed blind Start/claim retries, key reflection, credential project metadata, Cost context and activation-error correlation before live use. [Native review](evidence/native-foundation-review-20261018.json), [API local receipt](evidence/local-n8n-inventory-consumer-20261018.json).
- 2026-10-18 · [CI39096921840](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39096921840) passed all five jobs on `41d1aad2ae39be179436749039cc5454713bea72`. Its new actual PostgreSQL tests observed the required lock barriers: equal-key receipts 1+0/one row; reversed two-key batches 0+2/two rows with no later advisory locks held before the first key. Cleanup passed and retained catalog/Test House data matched. This covers keyed-cost contention, not an atomic-callback two-session race or hosted acceptance. [Actual CI receipt](evidence/ci-41d1aad-20261018.json).
- 2026-10-18 · T1 five plan facts recorded from actual UI plus current official documentation. Own 12-node probe exported, sanitized and archived recoverably; no executions, saved credentials, node update or unrelated workflow changes. Header Auth domain controls and Postgres fields were checked in cancelled empty drafts. Exact five-name credential action requested. New dev migration consumer source independently reviewed; 16 synthetic Windows tests passed, then a reporting-guard regression passed its three affected cases (17 unique cases total). Public packet seals the installed native CLI, both helpers, TLS dependencies and nine migration files. Actual CheckOnly reached HANDOFF_MISSING after public verification; no private file was opened or authentication attempted. New M03-only delivery command requested; existing authorization covers the two pending dev versions.
- 2026-10-18 · Commit `cba296fcef692ad3d29d25a06cdfdf4b15a38f15` pushed to draft PR #8. Actual [CI39096684492](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39096684492) passed quality, unit, build, e2e and db-tests; Vercel preview is green. [Checkpoint receipt](evidence/ci-cba296f-20261018.json). The secret scan initially flagged a nonstandard synthetic URI password in a SQL test; changed that dummy to the scanner's reserved-host synthetic convention, then affected native CLI pgTAP 137/137 passed and the scanner reported zero findings. No actual credential was involved. New concurrency coverage and native blueprints are later work, not covered by this checkpoint.
- 2026-10-18 · Local reviewed migrations20261018034220/20261018035417 applied ONCE through pinnedCLI migration up --local, native0, no reset/seed. Actual ledger9versions; retained1competitor/3accounts/10items/C999test-house and0runs/cost/audit rows preserved. ActualCLI pgTAP11files379/379PASS; security/performance advisor WARN/ERROR lists empty; four-schema types regenerated and root/workspace typecheck0. Independent RPC review clear; actual synthetic normalizer output passes atomic SQL persistence/replay. Separate7 price regressions cover retained/same-day/future replay and exact55000 conflicts. [Applied evidence](evidence/local-applied-db-20261018.json), [rollback suite](evidence/local-rollback-pgtap-20261018.json), [price regressions](evidence/local-price-regressions-20261018.json). Hosted dev still original7, verified history statement digests; no hosted write/prod action.
- 2026-10-18 · Local contracts committedadeb82a; later compatible metrics{} regression now103/103 normalizer tests, and shared+normalizers258 before that final one-test addition. Dev schedule21/21 and CI safety13/13 PASS. Old10-file CI guard correctly failed under11-file regression before update. Native n8n JSON blueprint generator is being built from actual exported node versions and official source, not fabricated exports. Credential-free dev migration consumer uses sealed public scratch to avoid CLI dotenv/Vault autoload; no private credential requested/read yet.
- 2026-10-18 · Actual n8n browser sign-in verified;47 unrelated workflows/14 credentials inventoried and preserved. Version2.43.5, Pro Monthly, Cairo, verified community nodes ON. Owner subsequently upgraded execution quota to50K; actual Dashboard11,001/50,000/Online observed. No subscription/instance settings were changed by Codex; API/SDK connector still internal-error. Own unused probe12nodes/unpublished/timeout900s is separate from foundation execution and queued for cleanup; first export download reconciled after observer timeout/upgrade offline state.
- 2026-10-18 · Local normalizer/pre-RPC contracts GREEN96/96 (16 prior/80 new), targeted lint/typecheck/format PASS; fixture explicitly synthetic, no actor capture. Independent review found/fixed int4/date/offset/query/snapshot edge cases. Shared dev-only Cairo dispatch plan GREEN21/21 after a redaction regression; no workflow execution. CI wrapper guard updated to require all11 SQL suites; safety mocks RED under old10-file guard then GREEN13/13. Database migration remains uncommitted under independent review; no hosted mutation/provider call/production action. [Normalizer receipt](evidence/local-normalizers-20261018.json).
- 2026-10-18 · Dev-scoped MCP reconfirmed actual dev URL and seven original migration versions. Read-only baseline285 competitors/1,754 accounts/0 items/0 actor runs; existing17 price placeholders and budget150/statsfalse/storiesPMfalse preserved. Initial nonexistent-column read and last-result-only tool behavior corrected before aggregate readback. [Preflight](evidence/dev-preflight-20261018.json). User supplied intended n8n URL and Scale tier; readiness replies remain distinct from observed login/connector errors. No credential handoffs read.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. -->
- —
