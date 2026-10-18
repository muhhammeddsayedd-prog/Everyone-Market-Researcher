# M02 — Seed data & account resolution · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status

**Blocked: waiting on owner — MA-08 / Database+YouTube handoffs**

| Field        | Value                                                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Started      | 2026-10-18 Cairo                                                                                                                                                                                                                                               |
| Last updated | 2026-10-18 Cairo                                                                                                                                                                                                                                               |
| Finished     | —                                                                                                                                                                                                                                                              |
| Branch / PR  | m02-seed-data; [PR6 draft](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/6), published head27b4390ef6c5e59aa37ef9ae9f7a43f2d35e453a; CI39085545138 all five jobs/Vercel PASS. Earlier35990bd andb88f193 receipts remain historical. |
| Current task | Reconciliation32/32 PASS; original failed receipt preserved; report recovered separately. Exact original write gate released01:50UTC after review, permanent initial-budget record retained. Corrected continuation reviewed/rebuilt/sealed.                   |
| Next step    | Await ONLY Database+YouTube handoffs, verify actual presence, then consumer resolve CheckOnly followed by one resolve. No successful stage replay. Finish MA-09 from final results; production/merge/M03 remain gated.                                         |

The owner instructed **Proceed with the next milestone** after M01 merged.
Started from clean main a74459d082ba5d1f0445652d7d12f8d2079da945 and preserved
M01's seven versions/hashes, hosted acceptance and credential cleanup. M02
development and dev seeding are in scope. Production seeding needs its later
specific approval; collection, paid providers, n8n and M03 remain unstarted.

## Task checklist

<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->

- [x] T1 — Handle normalization library — 135 shared tests pass; strict typecheck passes (local).
- [x] T2 — Seed competitors — dev285; tiers50/174/60/1; C000 baseline1; second seed0 inserts/updates.
- [ ] T3 — Seed accounts (+ derived rows, pilot gating) — dev1,754 and all platform/derived/cadence counts pass. Pilot YouTube10 active vs11 awaits C102 owner decision.
- [x] T4 — Report script — original native1/report validation failure preserved. Fixed lossless bigint validation (25 tests); separate credential-free report from actual dev MCP readback succeeded native0.
- [x] T5 — Resolve Vimeo (MA-07) — actual202/202 resolved, pilot/baseline48/48. No rerun needed.
- [ ] T6 — Resolve YouTube (MA-08) — known-account probe passed; batch stopped on C142 yt_bad_response after70 account attempts; buffered YouTube patches were discarded.125 pending/3 initial invalid; original response shape unestablished.
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
- [ ] AC4 — Pilot gating — plan289 active /1,462 paused /3 invalid. Pilot YouTube active10 rather than11 because C102's legacy URL needs MA-09; no silent URL guess.
- [ ] AC5 — Vimeo dev202/202 and pilot48/48 PASS. YouTube dev125 pending/3 initial invalid/0 committed resolutions; pilot0/11. Continue only the reviewed bounded YouTube stage; no successful stage replay.
- [x] AC6 — Dev backfill/cadence/root gating assertions report0 violations. Primary1,272 pending; derived482 not_applicable. [Actual assertions](evidence/dev-counts-after-batch-20261018.json).
- [x] AC7 — Idempotent (dev) — actual full dev second seed reports competitorsInserted0 / competitorsUpdated0 / accountsInserted0 / accountsUpdated0; root independently confirms285 competitors/1,754 accounts after commit. The ongoing batch's final native/cleanup result remains separate; prod is not seeded.
- [x] AC8 — Dev256/267 source logos (95.88%) plus baseline1; actual257 public-byte hashes verified. Fresh [Storage readback](evidence/dev-storage-readback-20261018.json):257 matching objects/1,560,325 bytes, media bucket public; no other media objects. Production separate.
- [ ] AC9 — Owner sign-off — MA-09 awaits the actual post-check review list.
- [ ] AC10 — Prod mirrors dev — production seeding unapproved and unperformed.
- [x] AC11 — Tests — shared135 / scripts236 historical local tests pass;15 PG tests separately executed15/15 PASS against the verified local stack. Prior35990bd/CI39084190118 andb88f193/CI39084641029 passing receipts remain historical. Current [CI39085545138](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39085545138) all five jobs/Vercel PASS at27b4390, PR6 OPEN/DRAFT; its credential-free TLS regression step reports12/12 PASS. The runtime TLS fix also passed focused tests/typecheck, independent review, strict public handshake and sealed rebuild before the current authenticated run. [TLS/CI delivery](evidence/tls-ci-delivery-20261018.json). Local/CI checks and the ongoing hosted dev stages remain separate.

## Actual dev report — interim, owner sign-off pending

Actual MCP snapshot observed01:38:11UTC; separate local render01:38:31UTC/native0.
The [recovery receipt](evidence/dev-report-recovery-20261018.json) carries the
full tier/platform/status/backfill counts. This does not replace the original
batch's failed native completion.

| Check                          | Actual dev result                                                            |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Competitors / accounts         | 285 / 1,754; primary1,272 + stories256 + employees226                        |
| Tiers                          | pilot50 / next_wave174 / adjacent60 / baseline1                              |
| Vimeo                          | 202/202 resolved, pilot/baseline48/48                                        |
| YouTube                        | 125 pending /3 initial invalid; no committed resolutions                     |
| Backfill                       | primary1,272 pending; derived482 not_applicable;0 cadence/flag violations    |
| Logos                          | 256/267 source copied (95.88%) + baseline1;257 actual public hashes verified |
| Duplicates / collected content | 0 duplicate keys;0 items /0 raw items                                        |

The interim report contains185 review rows, **not185 separate owner fixes**:
125 are the technical YouTube continuation; the three original invalid URLs
appear under several report reasons. MA-09 will use a deduplicated final list
after that continuation. Current independent findings are23 website reachability
flags and11 missing remote logos;17 competitors have no source logo and retain
the expected initials fallback. C102 (pilot), C245 and C283 require an explicit
owner decision for their legacy YouTube URLs; no replacement handle is guessed.

## Blockers

<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->

- The approved batch ended native1 at report validation, after successful seed/Vimeo/website/logo effects. Its failed receipt remains unchanged. A separate read-only MCP snapshot report now succeeds; do not label the original batch successful.
- YouTube stopped on C142 yt_bad_response; not a key rejection. Original HTTP200 body shape remains unestablished. A guarded one-attempt YouTube-only continuation is under review, within the original approved request ceilings; no API retry yet.
- At01:43:14UTC all four consumed temporary handoffs are absent and original child7492 is closed. Owner-saved originals remain intact. The global write-pending marker is retained until actual effects are reconciled and the recovery decision reviewed; no blind replay.
- Populated-schema dev advisors at01:17:24UTC return security11 INFO and performance69 INFO, zero WARN/ERROR. These results do not establish provider or logo acceptance. [Post-seed advisors](evidence/dev-post-seed-advisors-20261018.json).
- Exact bounded dev approval remains recorded with `approved:true`; no repeated general/bulk approval is needed within its reviewed seals and bounds.
- MA-09 awaits the concrete unresolved/suspect report. Production seed approval will be requested only with a reviewed dev result and exact packet.

## Manual actions needed from the owner

<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. -->

| #                 | Action                                                                                                                        | Why                                                     | Status                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| MA-07             | Retain the original public-only Vimeo token; no new handoff needed.                                                           | T5 Vimeo resolution                                     | Verified actual202/202 resolved, pilot48/48                                         |
| MA-08             | Existing YouTube key passed the actual known-account probe;125 rows need the corrected bounded continuation.                  | T6 YouTube resolution                                   | Await reviewed continuation and granular replenishment, no reset                    |
| MA-09             | Review the unresolved/suspect accounts list                                                                                   | T9 sign-off                                             | Not requested yet                                                                   |
| dev seed handoff  | All four consumed handoffs deleted; original child closed. Only Database+YouTube will be needed after review/rebuild.         | Remaining YouTube-only run                              | Cleanup verified01:43UTC; no writer/admin role reset or Vimeo/Storage replenishment |
| dev bulk approval | Owner replied **Approve M02 dev batch** for the exact packet linked below; approval reference recorded in its machine packet. | AGENTS rule9; USD0 provider estimate,20MiB upload bound | Approved18October2026; no repeated approval requested                               |
| public dev CA     | Owner copied the public CA and supplied its SHA256 pin; scoped password-free verification subsequently passed.                | Preserve exact-hostname TLS verification                | Supplied; final strict TLS, review and sealed rebuild pass                          |
| approval          | "approved: seed prod"                                                                                                         | T10                                                     | Not requested yet                                                                   |

Exact [dev batch packet](evidence/dev-batch-packet-20261018.md),
[private setup/consumer guide](../../scripts/seed/README.md) and
[reviewed helper](../../scripts/seed/windows/New-M02DevHandoff.ps1).
The replacement delivery completed and the batch ran01:12:05–01:33:25UTC.
Actual dev postgres identity/seven versions passed,285 competitors/1,754 accounts
were inserted, and the second seed made zero inserts/updates. Vimeo202 resolved;
website and logo stages completed. The original report failed; a separate
credential-free report recovery succeeded from actual MCP readback. Original
native1 and failed receipt remain preserved. All four handoffs were deleted and
the child closed. No successful stage should be repeated.

The correction is independently reviewed, rebuilt and source-sealed. Actual
presence check confirms the new YouTube handoff is missing, before decryption;
both remaining inputs were absent in the final cleanup check. The exact
[recovery decision](evidence/dev-recovery-decision-20261018.json) records32/32
actual-state checks and release of only the reconciled original gate01:50UTC.
The permanent initial-budget record remains and prevents replay.

In Windows PowerShell under the same Windows account, run:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\New-M02DevHandoff.ps1' -Kind Database
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\New-M02DevHandoff.ps1' -Kind YouTube
```

At the hidden prompts enter the EXISTING emr-dev database password and existing
YouTube-restricted key respectively. Expected final lines include
`M02 encrypted dev handoffs saved: Database.` and
`M02 encrypted dev handoffs saved: YouTube.` Close the PowerShell window and
reply **M02 Database and YouTube ready**. Do not send values or file contents.
Only the reviewed `resolve` continuation follows: one attempt per lookup, at most
129 additional requests/USD0 within the original approved ceilings. The original
dev packet remains approved; no reset, Vimeo/Storage handoff, production or new
general approval is needed. The first TLS failure remains in the
[historical failure record](evidence/dev-first-run-failure-20261018.json).

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
