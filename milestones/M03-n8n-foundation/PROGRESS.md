# M03 — n8n foundation · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**In progress — completed dev evidence preserved; GW-01 dev implementation/trial approved; local gateway verified; new dev migration applied; Cloud privacy and restricted trial pending**

| Field | Value |
| --- | --- |
| Started | 2026-10-18 Cairo |
| Last updated | 2026-10-18 Cairo |
| Finished | — |
| Branch / PR | `m03-n8n-foundation`, [PR #8](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/8), draft and unmerged; preserved reviewed `100290a291530d30d0387269c1a0805ad4f86fcc` and earlier evidence, no reset |
| Prior CI checkpoint | Reviewed `e529576ac50f08e22ca8773dae9617e315da034e`, [CI39101964206](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39101964206), all five jobs and Vercel passed. Current changes receive normal CI; no extra documentation commit solely to announce its result. |
| Current task | Implement the approved fixed gateway, one new admission migration, inactive adapter and private delivery tools. Current24local HTTP/DB/TLS tests pass; independent review hardens close/expiry, physical connection cleanup and one-time deployment binding. New dev migration20261018070042 applied once/native0; exact9?10history and Admin cleanup verified. Management presence/lease only; no gateway requests. |
| Next step | Complete reviewed implementation/helper/SQL tests, seal delivery against the disabled Preview, prove synthetic Cloud privacy, then direct writer/protected-preview trial. Do not restart native TLS, replay existing migrations or use the incident entry. |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [x] T1 — Five plan facts recorded below; actual UI capability evidence and current official plan/billing rules are distinguished. No execution/billing experiment claimed.
- [ ] T2 — Historical API authentication/discovery/Personal list200 retained; later workflow failure stage remains unknown. New safe stage diagnostics44 Node/17 isolated Windows fixtures pass; helper resealed after independent review. No live inventory retry/key request. [Local receipt](evidence/local-api-stage-diagnostics-20261018.json).
- [ ] T3 — All five actual IDs/types reused; four provider metadata GETs pass. Writer saved settings match but native TLS/identity remain open; OpenAI cap is not inferred from Models access.
- [ ] T4 — Exact two dev migrations applied/native0:12 restricted RPCs, receipt/indexes,17 Apify prices, budget25, fresh advisors0 WARN/ERROR and schema/type coverage verified. Local379 unchanged-source SQL results preserved. Fixed-fee/unknown-price coverage stays explicitly unknown, with no questionnaire.
- [ ] T5 — Shared sub-workflows (dev)
- [ ] T6 — WF-90 · Error handler (dev)
- [ ] T7 — Local inactive WF19 generator and deterministic recovery/settlement implemented/tested; hosted deployment/audit/privacy/transport gates remain. [Local callback receipt](evidence/local-callback-recovery-20261018.json).
- [ ] T8 — WF-00 · Orchestrator + collector stubs (dev, inactive)
- [ ] T9 — Existing local WF91 preserved. New WF99 generator is original-run recovery only; paid launch is absent until durable spend admission and the exact live packet. No hosted smoke acceptance.
- [ ] T10 — Export, document, hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->
- [x] AC1 — Plan facts recorded — actual n8n 2.43.5, paid Cloud plan, upgraded 50,000 allowance; the five facts and evidence boundaries are recorded below.
- [ ] AC2 — Credentials work — four actual provider metadata GETs pass using existing native/Header Auth IDs; saved dev Postgres port5432/security exact, but credential Retry and native SELECT fail TLS chain validation, so current_user/session_user are unverified. [Actual readback](evidence/credential-readback-20261018.json).
- [x] AC3 — Reused actual local379 pgTAP assertions in11 files on unchanged SQL; hosted nine-version/statement-hash parity,12 restricted RPCs and fresh advisors0 WARN/ERROR verified. [Schema](evidence/dev-post-migration-schema-20261018.json), [advisors](evidence/dev-post-migration-advisors-20261018.json). No hosted pgTAP or native n8n writer login claim.
- [ ] AC4 — Actual dev17 reviewed Apify prices and daily alert budget25 verified. Three fixed-fee amounts and other documented unknown prices remain unknown under the owner's instruction; no false zero fees or shared-service budget change. [Readback](evidence/dev-post-migration-schema-20261018.json).
- [ ] AC5 — End-to-end smoke remains unrun. Local graph9/9 and shared80/80 (55 new recovery cases) pass; new generator source is not an actual saved Cloud export or actor receipt.
- [ ] AC6 — Local saved replay, early registration, stable cost and ambiguous-write recovery pass. Saved-only recovery reports payloadEqualityVerified:false and suppresses dispatch; no fake SQL JSONB digest or exactly-once external delivery. Hosted duplicate/interruption acceptance remains pending.
- [ ] AC7 — Unknown callback fails closed at the missing exact durable-audit gate. Generic workflow_error logging is not apify_callback_rejected or AC7 proof.
- [ ] AC8 — Error routing — evidence:
- [ ] AC9 — Orchestrator dispatch — evidence:
- [ ] AC10 — Health — evidence:
- [ ] AC11 — Actual inactive credential/runtime probe snapshots retained, reviewed without credentials/pinned execution data and recoverably archived. Full foundation exports remain pending. Current index secret scan passes; final delivery receipt records new-head checks.
- [x] AC12 — Budget documented — conservative steady-state estimate 160/day pilot and 181/day full scope, both below 200/day; shared quota and billing-rule boundaries below.

## Blockers

- Strict n8n Postgres TLS remains unresolved. Actual saved host/session port5432/user/database/max5/SSL Require/Ignore SSL off/SSH off match. One credential Retry and one native Postgres2.7 SELECT encounter a self-signed-chain error; restricted current_user/session_user are not established. Preserve password/security. The owner declined the support-contact path; no contact action or new writer credential is requested. [Actual receipt](evidence/credential-readback-20261018.json), [retained source review](evidence/postgres-cloud-ca-review-20261018.md).
- [GW-01](evidence/strict-tls-connection-proposal-20261018.md) dev exception is APPROVED by owner for reviewed100290a with bounded-trial clarifications. [Authorization](evidence/gw01-authorization-20261018.json). Implementation and local review are underway; new20261018070042 applied once to dev/native0 with exact9?10history; nine old files/history preserved. Management is not decrypted and no gateway request/clock started. Gateway restricted-login acceptance remains distinct from native Postgres failure.
- INC-M03-20261018-01: open private remediation approval gate. Owner identification and safe metadata checks are recorded privately; no rotation, erasure or absence-of-misuse claim. No details in this public repository beyond reference/status.
- M03 database deployment is RESOLVED. The third bounded attempt completed native0 with exact dry-run/push/history parity; two earlier failures remain accurately preserved. The second established native0+invalid_json; immutable CLI source reproduced conflicting output flags and the corrected command-specific helper passed regression/review. All nine versions/hashes match,12 RPC ACLs and receipt/indexes pass, budget25,17 Apify prices,285 competitors/1754 accounts/257 logos/seven owner exclusions unchanged, no collected items/runs or fixtures. Fresh hosted advisors have0 WARN/ERROR. Public-only MCP types were not substituted for the checked-in four-schema types. [Completion](evidence/dev-migration-completion-20261018.json), [schema](evidence/dev-post-migration-schema-20261018.json). Preserve the durable successful admission; never replay this packet.
- API DNS is RESOLVED by bounded OS lookup with every-address screening/pinning/strict TLS. A credential-free401/socket-close test passed. The next keyed attempt authenticated, discovery advertised capabilities and Personal list returned200; workflow-list transport failed before a complete inventory, and the credential-list resource was not attempted. Both consumed API handoffs were deleted/children closed. Exact later transport cause remains unestablished; no further key/discovery loop is requested. Browser sign-in is already verified and connector errors do not invalidate it. [Actual API attempts](evidence/n8n-api-attempt-20261018.json), [DNS](evidence/n8n-dns-boundary-20261018.json).
- All five existing provider/database credential IDs and native types are mapped in [actual partial bindings](../../n8n/foundation/bindings.dev.json); no fake workflow/tag IDs. Apify/OpenAI use HTTP Predefined Credential Type; Vimeo/YouTube reuse Header Auth. All four actual provider metadata GETs pass, with no actor/inference/embeddings. Shared names/passwords/domain settings were preserved. No credential recreation, login/MCP setup or billing questionnaire is needed.
- The original general URL-dependent smoke normalizer fails in actual Cloud Code2 because URL is unavailable. A separately reviewed M03 exact-owned-page adapter passes a pure Cloud execution without adding dependencies or weakening validation. General URL/generic grouping support remains separate; the current native atomic SUB Ingest input Code itself does not use URL. Full callback/rejection-audit/replay/settlement/recovery/paid admission and actual foundation graphs remain incomplete; local components are not runnable WF19/WF99 exports.
- OpenAI Models access does not establish its project spend cap. Unknown fees/prices remain unknown; USD25/day is an alert threshold, not a provider cap. The owner deprioritized fee reporting, so no further questionnaire. Shared plan allowance50K/runtime facts and the historical code/local/CI evidence are preserved.

## Manual actions needed from the owner

| ID | Current state | Owner action |
| --- | --- | --- |
| MA-04 M03 dev | Both approved versions applied successfully; independent history/schema/advisor/data readback passes. Handoff/scratch deleted; children closed; successful admission retained. | None. No new database handoff or replay. |
| MA-10 / MA-11 providers | Existing Apify/OpenAI/Vimeo/YouTube ID/type bindings and four metadata tests verified. Saved writer port5432 is correct; strict native TLS remains open. | No credential recreation/reset/rename, no writer handoff, no SSL weakening. Owner declined contact; do not request it again. |
| MA-11 / INC-M03-20261018-01 | Open; private identification and targeted remediation packet prepared. | Review the private owner packet, confirm remaining consumer coverage and maintenance/canary scope, then give specific remediation approval. No secret values or blanket rotation. |
| MA-11 / GW-01 | Owner approved exact100290a packet plus clarifications; authorization in evidence/gw01-authorization-20261018.json. | No further internal task approval. Management is present/leased, not decrypted. New dev migration/Admin cleanup complete. Writer/Machine only after Cloud privacy. One immutable100-total-attempt/two-concurrent/30-minute dev window, cleanup included. |
| MA-11 API | Existing key authenticated; Personal list200; later workflow transport incomplete. Consumed key handoffs deleted. | None now. Do not request another key or repeat login/discovery to rediscover the transport failure. |
| MA-12 | Authorized existing OpenAI credential works for Models read. Project cap is unverified; no model calls. | No new credential requested; keep cap evidence distinct. |
| MA-13 / fees | Actual dev alert budget25. Subscription/other unknown prices remain unknown. | None; do not restart billing questions or alter shared budgets. |
| M03 live acceptance | [Outline](evidence/live-acceptance-outline-20261018.md) remains preparation only until exact graph IDs/source seals/request counts/price/caps are filled and technical gates pass. | No batch approval requested yet. Present the concrete packet before any actor/multi-workflow test batch. |

### Current exact Management handoff (no new key)

In Windows PowerShell under this Windows account, run:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03GW01Handoff.ps1' -Kind Management
```

Enter the existing saved management API key for muhhammedsayed.app.n8n.cloud at the hidden prompt. Expected result: `GW01_ENCRYPTED_HANDOFF_READY: Management.` Close that PowerShell window, retain the original and reply `GW-01 management handoff ready`; send no values/files. The new encrypted temporary handoff has a two-hour lease for bounded owned-trial credential/workflow/privacy operations. The old inventory consumer remains GET-only. Creation is not authentication or readiness proof; consume only after complete consumer review/seal. Management presence and valid lease were verified after owner readiness; this remains distinct from authentication. Admin was delivered/consumed only for the completed new migration and deleted; Writer/Machine wait for actual Cloud privacy.

### Current exact administrator handoff (ONE new migration only)

Run in Windows PowerShell under the same account:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03GW01Handoff.ps1' -Kind Admin
```

Hidden input: EXISTING emr-dev postgres password, only for the approved exact migration20261018070042. Expected `GW01_ENCRYPTED_HANDOFF_READY: Admin.` Close the shell and reply `GW-01 Admin ready`. No value/file contents, reset, writer/admin substitution or runtime delivery. Consumer review and17 isolated DPAPI/native-CLI cases pass; exact9+1packet is sealed. Do not rerun the spent old two-migration consumer.

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Callback spec correction under review: marking `processed_at` before ingest loses work after partial failure. Reordering alone is insufficient because chunk inserts, account receipts and costs need a durable atomic callback receipt. M03 will use a bounded atomic persistence RPC for the one-page website smoke branch; unsupported later collector branches fail closed. Existing M01 interfaces/seven migration versions remain intact.
- Default callback verification is option (b), registered-run lookup plus authenticated Apify run readback. Callback-supplied context, dataset IDs, actor/status/usage are never trusted for persistence.
- Official documentation supplements actual plan facts but does not establish the owner's tier/runtime. Pending n8n skill remains outside discovery until its actual-runtime/schema gate passes.
- One-page M03 payload minimizes the generic raw-source contract to canonical URL, capped markdown and title; synthetic request/header/cookie fields are omitted. Raw provider HTTP/SQL error messages/stacks are likewise replaced by fixed classified summaries before audit logging. These bounded projections exclude known context from persistence descriptors; raw native HTTP/webhook execution-storage privacy remains unverified. They do not assert generic secret redaction.

## Verified plan facts (T1)

Actual browser identity: owner-confirmed `muhhammedsayed.app.n8n.cloud`, Personal
project `pHvQjDmjxVZ3KQLT`, runtime 2.43.5, Africa/Cairo. Cloud Manage showed Pro
(Monthly); after the owner's upgrade its dashboard showed 11,001/50,000 used.
This is the shared instance allowance, not a dedicated Market Radar reservation.

| Fact | Answer and evidence boundary |
| --- | --- |
| Execution timeout | The actual unused workflow saved 900 seconds successfully. Current [Cloud pricing](https://n8n.io/pricing/) documents 40 minutes for Pro/Enterprise; the instance's hard maximum was not experimentally tested. M03 keeps 15 minutes. |
| Sub-workflow quota | Current [execution documentation](https://docs.n8n.io/build/understand-workflows/understand-executions.md#how-executions-count-towards-quotas) says Execute Sub-workflow calls do not count separately; only the top-level production execution counts. Manual and error executions are also excluded by the documented rule. This is the rule for the observed paid plan, not an independently measured billing experiment. |
| Variables | Initial T1 controls verified. Incident INC-M03-20261018-01 remains open; identification/remediation is tracked privately outside this repository. |
| Verified Apify node | Actual picker shows installed/verified Apify package version 0.6.10 (Legacy), update available. No install/update or actor execution occurred. HTTP Request remains the reviewed API path; a current Apify node schema is not assumed. |
| Postgres parameters | Initial capability inspection found Postgres 2.7 Options → Query Parameters (`options.queryReplacement`) and `$1/$2/$3` help without connecting. The later native identity attempt failed strict TLS, as recorded separately above. |

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
- INC-M03-20261018-01: open private identification/remediation gate. No disposition, revocation or erasure is claimed. Details remain outside the public repository.

## Session log

- 18 October2026 Cairo ? Resumed clean100290a/CI39104226437; owner approved exact GW-01 dev packet plus isolation/privacy/cleanup clarifications. Nine prior migrations/data/provider receipts preserved. Root local22gateway/DB/TLS tests pass; initial failed assertions and fixture fixes retained in tool receipts. New CLI-generated20261018070042 local-only source/pgTAP/types/advisors and multiprocess tests are under review; further binding/close-race hardening is in progress before dev seal. Source/core/helper work continues; no real credential handoff consumed, hosted change or trial clock started. INC-M03-20261018-01 private decision updated separately; no production authority.

- 2026-10-18 Cairo · Resumed from clean reviewed e529576/CI39101964206 without reset, baseline replay or provider reprobe. INC-M03-20261018-01 addressed first with a private record and owner identification; safe metadata and targeted owner steps remain private, remediation still unapproved. GW-01 proposal reviewed with no remaining P0/P1/P2 in proposal scope; no gateway implementation or decision amendment. Local callback/recovery graph9 and shared80 checks pass, including stable cost, original-run registration and durable ambiguous-write recovery with limited equality proof. GET-only diagnostics44/17 fixtures pass; root combined94 Node and80 shared tests, typecheck/lint pass. All nine migration file hashes match; historical provider/dev/runtime receipts preserved. New Node diagnostics are included in normal CI. No new credential handoff, live TLS/API retry, production writes, rotation, actor/model calls, external notification, recurring activation, merge or M04. Current delivery uses normal CI once; no documentation-only CI-announcement loop.

- 2026-10-18 Cairo · Actual [CI39101756910](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39101756910) completed success on head1995fd3: quality/unit/build/e2e/db-tests, Vercel success. Final index scan920 files/0 findings, all public JSON parses and actual probe export seals/privacy shape verified. [CI receipt](evidence/ci-1995fd3-20261018.json). This later documentation-only commit receives normal CI separately. Draft/unmerged/open M03; prior local/CI and new hosted boundaries preserved. No new handoff or declined contact action.

- 2026-10-18 Cairo · Delivery code checkpoint954d9ef: targeted71 Node and42 shared contract tests pass; later exact-page mapper124 affected tests pass, root/workspace typecheck and affected ESLint native0. Independent artifact/source review clear after provenance corrections. All nine migration file hashes reconfirmed unchanged. Temporary dev DB/API handoffs and successful private scratch absent at05:45:10UTC; durable successful push admission retained. [Local receipt](evidence/local-resume-validation-20261018.json), [runtime receipt](evidence/runtime-capability-20261018.json). Final evidence/index scan and normal PR CI follow; no full unchanged local suite rerun.

- 2026-10-18 Cairo · Current resumption: preserved ab9c3c6 and successful CI39097738601; actual clean branch inspected before changes. Existing five credential IDs/types mapped; four actual metadata GETs pass, native writer still fails strict TLS on saved5432. Actual probes exported/archived; no shared credential mutation. Both temporary handoffs initially ready; first DB dry-run rejection preserved, secondnative0/invalid_json preserved; exact pinned CLI source reveals legacy output flag precedence. Corrected command-specific flags pass RED→GREEN/review, actual third once-only run03a85d53 native0 and exact nine-history parity. Independent schema/advisor/type/data/exclusion/logo readback passes (links above); local379 unchanged SQL tests remain separate from hosted metadata/advisors. Daily dev budget25, unknown fees not fabricated. API DNS fixed/tested/reviewed; actual key authenticates and Personal list200, later workflow resource transport fails; no credential-list/full-inventory pass claimed. All consumed handoffs/scratch deleted/children closed; keep durable push admission and owner originals. Source-only Apify trust/async/spend boundaries tested; fullWF19/WF99 incomplete. Pure Cloud probe proves globalURL/modules unsupported; strict exact-owned-page adapter passes separately, general/grouping support not claimed. Root targeted71Node+42Vitest, lint/typecheck pass before the later mapper change; its affected checks are recorded separately. No replay, production, activation, actor/model/paid call, notification, merge or M04. Owner declined contact; no further credential action is needed. Final delivery checks/normal PR CI pending.
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-18 · Local native preparation now covers 15 stubs, five SUBs, WF-90, WF-00 and WF-91 (23 blueprints), all inactive and requiring actual bindings. Root's combined changed-code check passed 48/48: 30 foundation/graph/clock/cross-adapter checks plus 18 API-reader checks; binding tests separately 15/15. Targeted lint/format passed. No actual bindings file, hosted workflow export or execution is claimed. Independent review caught/fixed blind Start/claim retries, key reflection, credential project metadata, Cost context and activation-error correlation before live use. [Native review](evidence/native-foundation-review-20261018.json), [API local receipt](evidence/local-n8n-inventory-consumer-20261018.json).
- 2026-10-18 · Code head `6e6db7ead293f7835d165c8ae574c8888ba7c41a` passed actual CI39097436130: quality, unit (including the 48 native/API checks), build, e2e and db-tests; Vercel preview SUCCESS. [CI receipt](evidence/ci-6e6db7e-20261018.json), [root local check](evidence/local-native-api-20261018.json). Both temporary M03 handoffs remain unconsumed and no hosted credential/provider/migration/workflow result is claimed. Three exact owner actions are pending above; no further sign-in, reset, general dev or merge approval is requested. Production, schedules and M04 stay untouched.
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

- 2026-10-18 Cairo ? GW-01 implementation checkpoint:24 scoped gateway tests including5 real local TLS cases,17 isolated migration-consumer cases,102 gateway pgTAP assertions,19 real local process/concurrency checks and8 checker regressions pass. Build/type/lint and traced public CA verified. Offline pinned CLI parser matches all9 existing history digests and derives18 statements/new digest53ceb5? without a ledger edit. [Gateway evidence](evidence/local-gw01-gateway-20261018.json), [DB evidence](evidence/local-gw01-db-20261018.json). Management presence/lease only; Admin requested for one new migration. Trial0requests/clock stopped; no hosted role acceptance or production change.24October tooling follow-up retained.

- 2026-10-18 Cairo ? Approved GW-01 migration run e3693aa9-be79-4f24-be54-bf743045c77d completed07:31:09UTC: actual devpostgres authentication, exact9baseline?10complete fingerprint parity, matching one-filedryrun/native0 and onepush/native0. Only20261018070042; no seeds/roles/replay. Credential-bearing children closed; consumed Admin DPAPI and private scratch deleted. [Completion](evidence/dev-gw01-migration-completion-20261018.json). Independent scoped MCP confirms10digests, RLS/ACL/type parity, preparedunbound0admission and unchanged baseline; advisors0WARN/ERROR. [Hosted readback](evidence/dev-gw01-post-migration-20261018.json). Gateway trial0requests/clock stopped; Management remained encrypted.
