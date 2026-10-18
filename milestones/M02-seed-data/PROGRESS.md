# M02 — Seed data & account resolution · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**In progress — exact dev batch approved; owner reports handoffs ready; presence/authentication checks next**

| Field | Value |
|---|---|
| Started | 2026-10-18 Cairo |
| Last updated | 2026-10-18 Cairo |
| Finished | — |
| Branch / PR | m02-seed-data; [PR6 draft](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/6), code head35990bd27e762de21714b719c78e72210636c7f7 |
| Current task | Exact dev packet approved; source-sealed CheckOnly confirms all four handoffs present. Authentication remains untested; bounded dev execution next. PR6 draft/unmerged. |
| Next step | Run the reviewed consumer's accept-dev action once. Inspect sanitized receipt and independent MCP readback before any retry. Complete available dev counts/IDs/logo/advisor checks and MA-09 report; preserve separate production/merge gates. |

The owner instructed **Proceed with the next milestone** after M01 merged.
Started from clean main a74459d082ba5d1f0445652d7d12f8d2079da945 and preserved
M01's seven versions/hashes, hosted acceptance and credential cleanup. M02
development and dev seeding are in scope. Production seeding needs its later
specific approval; collection, paid providers, n8n and M03 remain unstarted.

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [x] T1 — Handle normalization library — 135 shared tests pass; strict typecheck passes (local).
- [ ] T2 — Seed competitors — implemented; real local rollback checks pass; hosted import pending.
- [ ] T3 — Seed accounts (+ derived rows, pilot gating) — implemented; actual CSV plan exact; hosted checks pending.
- [ ] T4 — Report script — 15 local tests pass; actual post-seed dev report pending.
- [ ] T5 — Resolve Vimeo (needs MA-07) — tested public adapter/probe and independent provider gate; live receipt pending.
- [ ] T6 — Resolve YouTube (needs MA-08) — tested channels-only adapter/probe; live receipt pending.
- [ ] T7 — Instagram, LinkedIn, website checks (no APIs) — pure social validation / bounded website adapter implemented; live checks pending.
- [ ] T8 — Copy logos to Storage (Q-10 default) — 55 local processing/ownership tests pass; actual SDK contract uses fake transport; live copy/public bytes pending.
- [ ] T9 — Owner review (MA-09)
- [ ] T10 — Seed prod (owner OK)
- [ ] T11 — Docs and hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Competitors loaded — plan285, tiers50/174/60/1; hosted dev still0 before import, not acceptance.
- [ ] AC2 — Primary accounts loaded — plan1,272 with exact platform totals; hosted pending.
- [ ] AC3 — Derived accounts — plan256 stories /226 employees /1,754 total; hosted pending.
- [ ] AC4 — Pilot gating — plan289 active /1,462 paused /3 invalid. Pilot YouTube active10 rather than11 because C102's legacy URL needs MA-09; no silent URL guess.
- [ ] AC5 — Resolution — zero live provider requests so far. Current docs do not independently establish Vimeo vanity/album lookup acceptance; actual authorized probes remain required.
- [ ] AC6 — Backfill flags — local planner/actual rollback checks pass; hosted pending.
- [ ] AC7 — Idempotent — actual local five-company fixture second run0 inserted/updated and unchanged timestamps; full dev second-run receipt pending.
- [ ] AC8 — Logos — local processing/ownership/actual SDK fake-transport checks pass; hosted Storage/public byte visibility pending.
- [ ] AC9 — Owner sign-off — MA-09 awaits the actual post-check review list.
- [ ] AC10 — Prod mirrors dev — production seeding unapproved and unperformed.
- [x] AC11 — Tests — shared135 / scripts236 local tests pass;15 PG tests skipped in ordinary unit invocation and separately executed15/15 PASS against the verified local stack. [CI39084190118](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39084190118) all five jobs PASS at35990bd; Vercel SUCCESS. CI DB:242 pgTAP +15 mandatory M02 rollback assertions. [Delivery receipt](evidence/ci-delivery-20261018.json). No hosted acceptance inferred.

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- Live dev seed needs its own bounded owner-database credential delivery; M01 handoffs remain deleted and restricted application-role credentials cannot seed these tables.
- MA-07/08 provider credentials are not verified. No API authorization or hosted acceptance is inferred from file presence or intent.
- The exact bounded dev packet is pending owner approval under AGENTS rule9. Its runtime `approved:false` gate remains intact.
- MA-09 awaits the concrete unresolved/suspect report. Production seed approval will be requested only with a reviewed dev result and exact packet.

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-07 | Vimeo apps → intended app → Authentication / Generate access token → Public only. Save privately; hidden helper prompt below. | T5 Vimeo resolution | Requested; not verified |
| MA-08 | Google Cloud → intended project → APIs & Services → Library → enable YouTube Data API v3; Credentials → API key → API restrictions → Restrict key → YouTube Data API v3 → Save. Save privately; helper below. | T6 YouTube resolution | Requested; not verified |
| MA-09 | Review the unresolved/suspect accounts list | T9 sign-off | Not requested yet |
| dev seed handoff | Existing emr-dev database password plus emr-dev → Settings → API Keys → Secret key; retain originals and use the reviewed hidden helper below. | Owner seed and logo upload; no role/password reset | Requested; not verified |
| dev bulk approval | Reply **Approve M02 dev batch** after reviewing the exact packet linked below. | AGENTS rule9; USD0 provider estimate,20MiB upload bound | Requested; pending |
| approval | "approved: seed prod" | T10 | Not requested yet |

Exact [dev batch packet](evidence/dev-batch-packet-20261018.md),
[private setup/consumer guide](../../scripts/seed/README.md) and
[reviewed helper](../../scripts/seed/windows/New-M02DevHandoff.ps1).
In Windows PowerShell under this Windows account:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\seed\windows\New-M02DevHandoff.ps1' -Kind All
```

Enter the existing **dev** DB password, **public-only** Vimeo token,
YouTube-restricted key and **dev** Supabase secret key at the four hidden prompts.
Expected result begins `M02 encrypted dev handoffs saved: All.` Close that window
and reply **M02 dev handoffs ready**. Send no credentials or file contents.
Granular `-Kind Database`, `Vimeo`, `YouTube`, `Storage` can supply available
credentials independently without replacing existing files. Consumed temporary
files are removed after the bounded runner; separately saved originals remain.
No M02 real handoff has been consumed or authentication attempted yet.
The actual sealed consumer's presence-only check found all four handoffs absent:
DB, Vimeo, YouTube and Storage. It stopped before private reads/authentication.

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- CSV preflight matches285 competitors, tiers50/174/60/1 and1,272 primary rows at expected platform counts; canonical collisions0. Three legacy YouTube URLs are invalid/reportable, not guessed: C102 `/mvmpro`, C245 `/firstandtenproductions`, C283 `/wonderfulprodbeirut`.
- Owner-run scripts form a pinned @emr/scripts workspace; installation hooks remain blocked. No schema migration is planned unless a concrete incompatibility is found.
- Seed-owned fields use compare-and-swap against a target-bound local manifest; operational state and human corrections are preserved, and missing ownership fails closed. Explicit URL replacement must not reuse stale external IDs after identity changes.
- Missing ownership protects ALL existing fields, including initially equal ones. An explicit fresh/uncollected owner replacement can restore a managed invalid account to planned gating; human paused/disabled state remains preserved. Exact case-sensitive YouTube identity changes clear stale IDs.
- Provider/API-source deviations and limits are recorded in [source review](evidence/provider-source-review-20261018.md). Google keys use an origin-bound header rather than a query URL; numeric Vimeo profile IDs use `/users/<id>`. Vanity/showcase acceptance remains live-unverified.
- Every write action holds an exclusive durable pending marker through DB shutdown and final receipt persistence. Source/data/baseline/packet seals and exact managed identities bound live work; ambiguous operations stop for actual-state reconciliation. No reset, history repair or blind replay.
- Existing M01 tooling advisory remains open for24October; no fresh dependency-audit-clean claim is made.

## Risks / notes for the owner
- A valid credential, local test or native completion is not hosted acceptance. Provider/Storage blockers are independent; remaining stages can complete without turning missing credentials into account failures.
- Production and PR merge approvals remain separate. M03/collectors/paid providers/n8n remain unstarted.

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
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
