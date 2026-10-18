# M02 — Seed data & account resolution · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status

**Blocked: waiting on owner — MA-09 decisions; dev technical batch complete**

| Field        | Value                                                                                                                                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Started      | 2026-10-18 Cairo                                                                                                                                                                                                                                                                                   |
| Last updated | 2026-10-18 Cairo                                                                                                                                                                                                                                                                                   |
| Finished     | —                                                                                                                                                                                                                                                                                                  |
| Branch / PR  | m02-seed-data; PR6 OPEN/DRAFT. Code head d5171fe9f119e1703cc9e9371579f0b29a0becad; CI39088023934 all five jobs/Vercel PASS. Documentation-only delivery follows normal CI.                                                                                                                         |
| Current task | YouTube-only continuation completed native0 at01:53UTC;121/128 resolved,0 pending,7 failed/invalid. Independent22/22 preservation checks pass. Report completed; handoffs removed/child closed. MA-09 review issued.                                                                               |
| Next step    | Wait for exact MA-09 decisions in the linked Markdown/CSV or chat. C283 Wonderful Productions (pilot rank47) needs a correct public YouTube URL or explicit exception. Review/apply only approved corrections; no batch replay or new credentials now. Production and merge remain separate gates. |

The owner instructed **Proceed with the next milestone** after M01 merged.
Started from clean main a74459d082ba5d1f0445652d7d12f8d2079da945 and preserved
M01's seven versions/hashes, hosted acceptance and credential cleanup. M02
development and dev seeding are in scope. Production seeding needs its later
specific approval; collection, paid providers, n8n and M03 remain unstarted.

## Task checklist

<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->

- [x] T1 — Handle normalization library — 135 shared tests pass; strict typecheck passes (local).
- [x] T2 — Seed competitors — dev285; tiers50/174/60/1; C000 baseline1; second seed0 inserts/updates.
- [ ] T3 — Seed accounts/gating — all1,754 identities/platform/derived/cadence counts pass. Pilot YouTube10 active vs11 requires C283 owner correction or explicit documented exception.
- [x] T4 — Report script — original native1/report validation failure preserved. Fixed lossless bigint validation (25 tests); separate credential-free report from actual dev MCP readback succeeded native0.
- [x] T5 — Resolve Vimeo (MA-07) — actual202/202 resolved, pilot/baseline48/48. No rerun needed.
- [ ] T6 — YouTube — actual continuation completed native0:121/128 resolved (94.53%),0 pending,7 failed/invalid. Pilot10/11; C283 Wonderful Productions remains for MA-09. Six non-pilot failures need explicit owner decisions.
- [x] T7 — Instagram, LinkedIn, website checks — actual1,424 format/reachability checks,44 updates,1,380 unchanged;23 unreachable website flags retained without changing gating.
- [x] T8 — Copy logos — actual257 public-byte hashes verified,1,560,325 bytes;256/267 source logos (95.88%) plus baseline1.11 source failures use fallback tiles;17 have no source.
- [ ] T9 — Owner review (MA-09)
- [ ] T10 — Seed prod (owner OK)
- [ ] T11 — Docs and hand-off

## Acceptance criteria

<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->

- [x] AC1 — Dev285; tiers50/174/60/1; C000 baseline1. Independent [actual assertions](evidence/dev-counts-after-batch-20261018.json).
- [x] AC2 — Dev primary1,272: website261, work pages199, Instagram256, Vimeo202, YouTube128, LinkedIn226. Same actual assertions.
- [x] AC3 — Dev stories256/employees226; total1,754; derived cadence/backfill checks pass. Same actual assertions.
- [ ] AC4 — Dev gating violations0; all active-platform targets pass except YouTube10 vs11. Actual unresolved pilot is C283 Wonderful Productions, not C102; see the correction below.
- [ ] AC5 — Dev Vimeo202/202, pilot48/48 PASS. YouTube121/128 (94.53%),0 pending, valid UC/UU IDs; pilot10/11 FAIL pending C283 correction/explicit exception. [Fresh actual assertions](evidence/dev-counts-after-youtube-20261018.json).
- [x] AC6 — Dev backfill/cadence/root gating assertions report0 violations. Primary1,272 pending; derived482 not_applicable. [Actual assertions](evidence/dev-counts-after-batch-20261018.json).
- [x] AC7 — Idempotent (dev) — actual full second seed reports competitorsInserted0 / competitorsUpdated0 / accountsInserted0 / accountsUpdated0. Independent before/after continuation counts remain285/1,754. The original batch native1 and later successful resolution are separate receipts; prod is unseeded.
- [x] AC8 — Dev256/267 source logos (95.88%) plus baseline1; actual257 public-byte hashes verified. Fresh [Storage readback](evidence/dev-storage-readback-20261018.json):257 matching objects/1,560,325 bytes, media bucket public; no other media objects. Production separate.
- [ ] AC9 — Owner sign-off — actual41-row MA-09 list is issued and independently verified against the72 raw report reasons. All41 decisions remain blank; await explicit owner decisions, then apply/review any approved corrections.
- [ ] AC10 — Prod mirrors dev — production seeding unapproved and unperformed.
- [x] AC11 — Historical local/CI evidence preserved. Recovery code d5171fe / CI39088023934 all five jobs and Vercel PASS; focused local/parser/report/budget/Windows checks reviewed separately. Actual dev continuation native0 plus independent22/22 preservation checks; these are distinct from CI. [CI delivery](evidence/dev-recovery-ci-delivery-20261018.json).

## Actual dev report — MA-09 pending

The final report observed01:53:59.364UTC was generated by the corrected driver
against actual dev after the successful continuation. Its full counts and72
raw reason rows are preserved in [the actual report](evidence/dev-final-report-20261018.json).
The original batch native1 and separate report recovery remain historical.

| Check                          | Actual dev result                                                         |
| ------------------------------ | ------------------------------------------------------------------------- |
| Competitors / accounts         | 285 / 1,754; primary1,272 + stories256 + employees226                     |
| Tiers                          | pilot50 / next_wave174 / adjacent60 / baseline1                           |
| Vimeo                          | 202/202 resolved, pilot/baseline48/48                                     |
| YouTube                        | 121/128 resolved (94.53%);0 pending;7 failed/invalid; pilot10/11          |
| Backfill                       | primary1,272 pending; derived482 not_applicable;0 cadence/flag violations |
| Logos                          | 256/267 source copied (95.88%) + baseline1;257 public hashes verified     |
| Duplicates / collected content | 0 duplicate keys;0 items /0 raw items                                     |

The [MA-09 Markdown](evidence/ma09-owner-review-20261018.md) and
[editable CSV](evidence/ma09-owner-review-20261018.csv) deduplicate72 raw reasons
into41 decisions:7 YouTube /23 website flags /11 missing source-logo copies.
The17 no-source logos use the expected initials fallback.

**Factual correction:** direct source and hosted readback identify **C283
Wonderful Productions, pilot rank47**, as the only unresolved pilot. C102
MultiVision and C245 FTEN are next wave. Earlier prose in the initial packet and
session log mislabeled C102; the CSV hashes, actual data, gating code and approved
request bounds did not change. [Independent22-check readback](evidence/dev-youtube-continuation-reconciliation-20261018.json).

## Blockers

- MA-09 is the remaining dev gate: seven YouTube decisions,23 website flags and11 missing-logo decisions. C283 needs a correct supported public URL for the existing11/11 pilot criterion, or an explicit documented owner exception; invalid alone does not pass AC4/AC5.
- No technical batch is running. All consumed Database/YouTube handoffs and the earlier Vimeo/Storage handoffs are absent; the credential child closed with native0. No new credential handoff or reset is needed.
- Original report failure is preserved; separate recovery succeeded. The exact reconciled original global lock was released after32/32 checks. The successful YouTube continuation released its own global write lock, while permanent initial/continuation admission records remain to prevent another invocation.
- Independent22/22 post-continuation checks preserve all285 competitors,1,626 non-YouTube rows, three pre-invalid YouTube rows,257 assets/Storage paths, original7 migrations, empty collected tables and fixture exclusions. [Receipt](evidence/dev-youtube-continuation-receipt-20261018.json), [cleanup](evidence/dev-youtube-continuation-cleanup-20261018.json), [preservation](evidence/dev-youtube-continuation-reconciliation-20261018.json).
- Populated dev advisors remain11 security INFO /69 performance INFO, zero WARN/ERROR. No schema migration or generated-type change was made. The24October M01 tooling follow-up stays open.
- M02 production seeding and merge approvals are separate and unrequested until dev/MA-09 pass. M03, collection, paid provider calls and n8n remain unstarted.

## Manual actions needed from the owner

| ID                | Exact action                                                                                      | Status / expected result                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| MA-07             | Retain the original public-only Vimeo token for later integration. No new handoff.                | Actual202/202 resolved, pilot48/48; completed                                              |
| MA-08             | Retain the existing YouTube-restricted key for later integration. No new handoff.                 | Known-account probe and remaining125-row continuation completed;121/128 resolved,0 pending |
| MA-09             | Review the linked41-row Markdown/CSV and record decisions below.                                  | Pending explicit decisions; blank is not approval                                          |
| dev handoffs      | Keep saved originals; all temporary handoffs have been deleted and the bounded child closed.      | Verified01:54:34UTC; no owner action                                                       |
| dev bulk approval | Existing exact USD0 dev packet remains the authority; permanent admission records prevent replay. | Approved18October; both bounded invocations consumed                                       |
| public dev CA     | Supplied public certificate/pin; strict scoped TLS passed before decryption.                      | Complete; no global trust change                                                           |
| production        | Separate exact M02 packet and `approved: seed prod` after dev acceptance.                         | Not requested or performed                                                                 |
| merge             | Separate PR6 merge approval after all milestone gates.                                            | PR6 remains OPEN/DRAFT                                                                     |

Open this exact file in your editor:
`D:\Everyone\everyone Market Research\everyone-market-radar\milestones\M02-seed-data\evidence\ma09-owner-review-20261018.csv`
(or its Markdown companion). Fill `owner_decision` with `fix: https://...`,
`invalid` or `ok`, or reply with company code + platform + decision in chat.
Read the linked public URL/reason for each row. A batch reply
`All listed website flags: ok; all11 missing logos: ok` accepts retained flags
and initials fallback, not successful HTTP checks.

Seven YouTube decisions are needed: C102 MultiVision, C142 Gearbox, C218 Action
Filmz, C231 CityFilms, C233 Create Production, C245 FTEN, and **C283 Wonderful
Productions (pilot)**. For C283 supply the correct supported public YouTube URL;
if none exists, say `C283 invalid; request pilot exception` explicitly. That
requires a documented criterion exception, not a fabricated resolved ID.

Expected non-secret result: all41 deduplicated rows have explicit decisions.
After file edits reply **MA-09 decisions ready**. Codex will record/apply only
the approved corrections, review their bounded verification and regenerate the
report. **Do not run seed/resolve or deliver more credentials now.** No
production or merge approval is inferred from MA-09.

## Decisions & deviations

<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->

- CSV preflight matches285 competitors, tiers50/174/60/1 and1,272 primary rows at expected platform counts; canonical collisions0. Three legacy YouTube URLs are invalid/reportable, not guessed: C102 `/mvmpro`, C245 `/firstandtenproductions`, C283 `/wonderfulprodbeirut`.
- Owner-run scripts form a pinned @emr/scripts workspace; installation hooks remain blocked. No schema migration is planned unless a concrete incompatibility is found.
- Seed-owned fields use compare-and-swap against a target-bound local manifest; operational state and human corrections are preserved, and missing ownership fails closed. Explicit URL replacement must not reuse stale external IDs after identity changes.
- Missing ownership protects ALL existing fields, including initially equal ones. An explicit fresh/uncollected owner replacement can restore a managed invalid account to planned gating; human paused/disabled state remains preserved. Exact case-sensitive YouTube identity changes clear stale IDs.
- Provider/API-source deviations and limits are recorded in [source review](evidence/provider-source-review-20261018.md). Google keys use an origin-bound header rather than a query URL; numeric Vimeo profiles use `/users/<id>`. Actual input Vimeo202/202 resolved. YouTube's documented totalResults is now requested; omitted items is accepted only with explicit zero total and no contradictions. C142's original body shape was not retained, so that specific cause is unestablished.
- Every write action holds an exclusive durable pending marker through DB shutdown and final receipt persistence. Source/data/baseline/packet seals and exact managed identities bound live work; ambiguous operations stop for actual-state reconciliation. No reset, history repair or blind replay.
- Existing M01 tooling advisory remains open for24October; no fresh dependency-audit-clean claim is made.

## Risks / notes for the owner

- A valid credential, local test or native completion is not hosted acceptance. Provider/Storage blockers are independent; remaining stages can complete without turning missing credentials into account failures.
- Production and PR merge approvals remain separate. M03/collectors/paid providers/n8n remain unstarted.

## Session log

<!-- Newest first. One line per meaningful step: date · what · files · result. -->

- 2026-10-18 Cairo · Owner replenished only Database+YouTube; actual sealed presence check passed with Vimeo/Storage absent. Invoked resolve once at01:53:27.873UTC; strict TLS/dev postgres identity and seven versions passed. Actual125 attempted/125 updated,121 resolved/four new terminal invalid;205 skipped (202 resolved Vimeo+three pre-invalid). Native0/success, report completed, no bad-response blockers. Fresh dev assertions confirm121/128 YouTube,0 pending,10/11pilot. Independent22/22 checks preserve every competitor/non-YouTube row, three old invalids, logos/Storage/migrations and empty collected tables. All handoffs absent01:54:34UTC; child closed; global write lock absent, permanent budget records retained. Direct pilot readback corrects earlier prose: only C283 Wonderful Productions rank47 is unresolved; C102/C245 are next wave. MA-09 packet issued:41 deduplicated decisions (7YT/23web/11logos),17 expected no-source fallbacks. Code d5171fe / CI39088023934 all five jobs/Vercel PASS. No further credentials, run, production, merge, M03, collection, paid calls or n8n. [Actual continuation](evidence/dev-youtube-continuation-receipt-20261018.json), [preservation](evidence/dev-youtube-continuation-reconciliation-20261018.json), [owner review](evidence/ma09-owner-review-20261018.md).

- 2026-10-18 Cairo · Approved batch finished native1 at report validation after successful285/1,754 seed, real no-change second seed,202 Vimeo resolutions,1,424 website/format checks and257 public-byte-verified logos. YouTube stopped on C142 yt_bad_response, leaving125 pending/3 original invalid and no committed YouTube patches; this is not a key rejection. Fixed lossless bigint report input (25 tests) and rendered a separate report from actual dev MCP snapshot native0 without DB/provider/Storage operations or changing the original receipt. Fresh Storage readback matches257 objects/1,560,325 bytes, public bucket, original7 versions, items/raw/fixtures0. All four consumed handoffs absent and original child7492 closed01:43UTC. Initial global gate retained for reconciliation; bounded YouTube continuation under review. No production, merge, M03, collection, paid calls or n8n.

- 2026-10-18 Cairo · Owner replenished all four handoffs; sealed presence and strict TLS preflight passed. Resumed accept-dev started01:12:05.595UTC, actual current_user/session_userpostgres and seven original versions verified. Sanitized receipt now records seed_and_idempotency complete: first285 competitor/1,754 account inserts with0 updates; second all four insert/update counters0; issues3. Root's independent dev MCP confirms285/1,754 and items/raw0. Post-seed hosted advisors at01:17:24UTC: security11 INFO/performance69 INFO,0 WARN/ERROR. Provider resolution is running; MA-07/08 results and website/logo/report stages remain pending. Four replacement handoffs are loaded by the active child; native completion/removal/closure not yet claimed. Current27b4390 / CI39085545138 all five jobs/Vercel PASS; PR6 draft. No production seed, merge, M03, collection, paid calls or n8n. [Post-seed advisors](evidence/dev-post-seed-advisors-20261018.json), [TLS/CI delivery](evidence/tls-ci-delivery-20261018.json).

- 2026-10-18 Cairo · Final scoped public TLS probe at01:09:26.295UTC passes native0 with exact hostname, verified CA and closed sockets; no StartupMessage/authentication. Fixed diagnostic TLS socket ownership, added strict scoped CA to postgres.js, sealed public certificate/metadata and pre-decryption fail-closed preflight.73 focused Vitest checks plus two new Windows failure-preservation checks and12 Node TLS tests PASS; strict typecheck/ESLint/format PASS; independent review has no remaining P0/P1/P2. Credential-free rebuild native0, subsequent seal/presence check confirms all four handoffs absent before any private read. Requested the exact existing helper with saved originals; no reset or repeated batch approval. [Final public probe](evidence/dev-tls-handshake-final-20261018.json); PR6 stays draft and hosted ACs remain incomplete.

- 2026-10-18 Cairo · Later password-free scoped-CA probe passed01:06:31.376UTC: pinned public certificate verified, exact dev hostname/TLS verification enabled, native0 and sockets closed. No Postgres startup message or authentication. Retained initial TLS failure and abnormal native-exit evidence; current fix review/sealed rebuild must finish before fresh bounded handoffs. Published b88f193 / CI39084641029 all five jobs/Vercel PASS remain distinct from these later runtime changes and still-pending hosted acceptance.
- 2026-10-18 Cairo · First approved accept-dev attempt exited1 at00:56:44.765UTC with only database_identity blocked/M02_DATABASE_IDENTITY_FAILED; seed/provider/logo stages never began. Preserved byte-identical original/latest sanitized receipts and their `not_attempted` initializer as an unestablished authentication outcome, not a rejection or proof that no auth was attempted. Four consumed encrypted handoffs and both pending markers confirmed absent; native credential child exited. Root's fresh read-only dev MCP at01:05:06UTC confirms competitor/account/media/object counts0 and the original seven migration versions. Separate public TLS probe failed SELF_SIGNED_CERT_IN_CHAIN before Postgres startup; owner copied the public CA/pin, then password-free CA probe exited -1073741819 with its phase and socket cleanup unestablished. Locally diagnose before new secrets/retry; exact dev approval retained, hosted ACs open, PR6 draft. No production seed, merge, M03, collection, paid calls or n8n. [Failure and reconciliation](evidence/dev-first-run-failure-20261018.json).
- 2026-10-18 Cairo · Owner replied **Approve M02 dev batch** and **M02 dev handoffs ready**. Recorded the exact previously reviewed USD0/285competitor/1,754account/20MiB dev packet approval; production and merge gates unchanged. Reconfirmed MCP dev project, original seven migration versions and still-empty competitor/account/item/media baseline. Handoff readiness is owner-reported until the sealed consumer's presence check and actual independent credential checks pass. No credential consumed or hosted write yet.
- 2026-10-18 Cairo · Code head35990bd / CI39084190118 all five jobs PASS, Vercel SUCCESS. Isolated CI DB reports10pgTAP files/242assertions and15 mandatory M02 rollback assertions; no warning/error security advisor and no error performance advisor. AC11 complete within local/CI scope. Documentation-only receipt uses normal PR CI; hosted AC1–10 remain unaccepted. No credential or bulk approval reply yet, so runtime `approved:false` stays; no dev/production write, provider/collector/n8n action or merge. M02 blocked on exact owner steps above.
- 2026-10-18 Cairo · Published draft PR6 at35990bd; CI39084190118 running. Final727-file index scan initially flagged a synthetic password URL in a negative report test; fixture now uses the URL API, targeted report15/15 and unchanged scanner0 PASS. Credential-free sealed build/native0; actual consumer CheckOnly verified source seal and found all four handoffs absent, no private read or authentication. Owner steps/approval remain pending; no hosted or provider action.
- 2026-10-18 Cairo · Completed tested T2–T8 implementation and bounded private runner; [independent review](evidence/independent-review-20261018.md) found preservation, recovery, source-binding and credential-boundary issues, all fixed with focused regressions before live use. Shared135 / scripts236 tests PASS, separate actual local PG15/15 PASS with rollback+no C999 changes, CI safety9/9 PASS, root typecheck/lint/format PASS. [Windows/credential review](evidence/private-runner-review-20261018.json) uses synthetic handoffs only. Requested exact dev packet approval and executable MA-07/08/dev-owner credential delivery; no real handoff consumed, hosted import or provider request. Normal PR CI pending.
- 2026-10-18 Cairo · Reused working dev-scoped MCP; project URL confirmed zmotjsbzhzjvpelxvxlf. Seven original versions and empty baseline preserved. [Read-only count assertions](evidence/dev-preflight-20261018.json) execute semantically against dev but seeded ACs remain false before import;17 price-book rows read, no direct free-API SKU/paid usage. No migration or schema change.
- 2026-10-18 Cairo · T1 implemented in shared handles library: synchronous platform/host/URL validation, canonicalization and real CSV cases; 135 shared tests and strict typecheck PASS. Digit-leading Vimeo vanity profiles retained; numeric clip URLs rejected. Full plan remains 285 competitors / 1,754 accounts, zero canonical collisions, 289 active / 1,462 paused / three invalid legacy YouTube URLs (C102 pilot, C245, C283). No provider or hosted write performed.
- 2026-10-18 Cairo · M02 authorized after M01 closure. Clean main a74459d verified; created m02-seed-data without resetting any work. Loaded milestone/CSV/schema/skills; dispatched independent normalization, seed and provider work. Real input counts match; current dependency/API sources checked. No hosted import, credential decryption, production seeding, paid calls, collector or n8n action.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone

<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. -->

- —
