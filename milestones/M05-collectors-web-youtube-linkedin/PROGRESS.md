# M05 — Collectors II: Websites, YouTube, LinkedIn (posts + employees) · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**In progress — local source contracts, restricted integration and tests. M04 development accepted at CI-green `d7daebe`; coverage and rollout obligations remain open. M05 hosted/live and production work remain separately gated.**

| Field | Value |
|---|---|
| Started | 2026-10-28 |
| Last updated | 2026-10-28 |
| Finished | — |
| Branch / PR | `m05-collectors-web-youtube-linkedin` / — |
| Current task | Local collector integration delivered for review; stacked draft PR and changed-head CI qualification |
| Next step | Verify actual pushed-head CI/ordinary protected Preview; present the single representative dev packet. Do not apply the pending migration, bind secrets, publish workflows or capture providers until that separate approval. |

## Task checklist
<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->
- [ ] T1 — Fixtures (dev)
- [ ] T2 — Dev account set
- [ ] T3 — Migration
- [ ] T4 — Normalizers + tests
- [ ] T5 — WF-21 · Websites (dev)
- [ ] T6 — WF-13 · YouTube (dev)
- [ ] T7 — WF-18 · LinkedIn posts (dev)
- [ ] T8 — WF-18b · LinkedIn employees (dev, weekly)
- [ ] T9 — Estimate (MA-15) + prod backfill
- [ ] T10 — Daily check (dev, ≥ 3 days)
- [ ] T11 — Export, docs, hand-off

## Acceptance criteria
<!-- Mirror of MILESTONE.md §9; paste evidence (command + output summary, counts, screenshot paths). -->
- [ ] AC1 — Website backfill (dev) — evidence:
- [ ] AC2 — Only new URLs — evidence:
- [ ] AC3 — Project-page quality — evidence:
- [ ] AC4 — YouTube — evidence:
- [ ] AC5 — LinkedIn posts — evidence:
- [ ] AC6 — Employees — evidence:
- [ ] AC7 — Prod backfill — evidence:
- [ ] AC8 — Cost — evidence:
- [ ] AC9 — Scope and security — evidence:

## Blockers
<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->
- Real M05 source/Cloud observations are not authorized yet. Unknown company repost/video and Short current-company shapes remain fail-closed source boundaries; no cookie/full-profile workaround. Firecrawl binding/billing is unverified, not assumed absent. Local development is not blocked by those live gates.

## Manual actions needed from the owner
<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. Steps: docs/MANUAL_ACTIONS.md + MILESTONE.md §11. -->
| # | Action | Why | Status |
|---|---|---|---|
| MA-08 | Reuse the existing YouTube Header Auth credential ID/type; make no new key. Actual metadata/endpoint checks belong to approved dev preflight. | WF-13 | Existing integration reused in code; no new input requested |
| MA-15 | Review the [single representative dev packet](evidence/live-dev-packet-20261028.md). It includes selected sources, the one dev migration, protected Preview/default bypass, costs/caps, recovery and shutdown. Firecrawl credential/plan metadata is checked before spending; request a private input only if genuinely absent. Production migration/backfill and recurring weekly operation remain separate. | One next live decision, after review-head qualification | Proposed; unapproved; no new credentials requested |

## Decisions & deviations
<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->
- Original prod-backfill default remains a separate owner gate; no M05 production authority is granted.
- Actual28October [M04 development acceptance](../M04-collectors-vimeo-instagram/evidence/hc01-dev-results-20261028.md) passed the essential five-account/metrics/ownership/cost/closure checks on application948e618 with all five CI jobs passing. Final M04 result-head CI remains the next branch-delivery gate; M05 implementation is not started by this note.
- 28 October owner decision separates M04 development acceptance from deferred coverage and rollout. See [binding decision](../../docs/DECISIONS.md#m04-development-acceptance-and-m05-sequencing--28-october-2026); M05 is not started by this record. Once its prerequisite actually passes, M05 local implementation, migrations/tests, documentation, scoped commits, required CI, protected Previews and a separate stacked draft PR are authorized. Keep M05 changes out of PR13. No M04 spending authority transfers to M05.
- Actual M04 final result head `d7daebe` passed all five CI40617832325 jobs and Vercel, satisfying the sequencing prerequisite. The preceding two dated planning notes are preserved history; the separate M05 branch is now implemented.
- Website identity is the existing SHA256-first32 canonical URL rule, lowercase host/case-preserved path, no query/fragment/trailing slash (root `/` retained), with no FNV fallback. Unknown dates stay null; backfill discovery is not exhaustive site history.
- YouTube uses source EOF, not undocumented ordering, as completion proof. The duration≤60 classification is explicitly heuristic; fallback execution stays disabled. LinkedIn latest-result bounds stay incomplete; employee observations stay partial with no inferred joins/departures until a supported source-attestation contract exists. These are explicit original acceptance gaps, not waived criteria.

## Local implementation and actual evidence

See [the complete local record](evidence/local-implementation-20261028.md) and source-specific official-contract notes beside it.

| Task | Completed local work | Remaining original gate |
|---|---|---|
| T1/T4 | Five normalizers; labelled synthetic/official example fixtures and source regressions | New real fixtures and unverified repost/media/employee shapes |
| T3 | CLI-created pending migration `20261028020745`; actual rollback-only SQL integration; 15 pgTAP assertions; regenerated local types; security/performance advisors zero findings | Approved hosted dev application/readback; production separate |
| T5–T8 | All four I/O-injected collector paths and native HTTP builders, typed restricted adapter/callback, truthful paging/coverage, costs and completion | Actual native/source delivery and coverage |
| T9 | Offline price-book estimator and complete representative dev proposal | Approval, current non-secret provider billing qualification; full pilot/prod estimate later |
| T11 | Inactive local collector/shared blueprints, maintained docs and focused review | Saved sanitized Cloud exports, full milestone handoff/merge |

Actual focused checks: 59 source/estimator Vitest tests; 46 serialized native/YouTube Node tests; 25 SQL/callback/gateway Vitest tests (includes one actual rollback-only PostgreSQL test with multiple assertions); fifteen pgTAP security assertions. Counts are separate command results, not additive coverage claims. Lint, workspace TypeScript and formatting checks run before delivery. Required changed-head CI is separate; no M05 native/provider result is inferred from it.

## Risks / notes for the owner
- PPU website billing cannot use a PPE invoice cap; proxy/storage/transfer and infrastructure USD remain unknown until qualified. Do not claim a guaranteed USD0 or spend through an unresolved billing boundary.
- Original AC1–AC9 stay unchecked for their missing live, coverage, scope or rollout observations. No production, recurrence, notifications, M06 or PR merge is authorized.

## Session log
<!-- Newest first. One line per meaningful step: date · what · files · result. -->
- 2026-10-28 · Implemented the four source paths, native typed HTTP blueprints and restricted SQL/callback integration with preserved M04 behavior. Targeted review fixed source INPUT privacy/TLS guards, cross-midnight employee capture, costed immutable snapshot conflict, byte envelopes, retry/account barriers and actual terminal summary reporting. The owned schema-only local type/advisor database is disposable; existing local fixtures are verified restored by rollback. No M05 hosted/provider/credential operation occurred. Required CI/Preview qualification is next, not claimed complete by these local results.
- 2026-10-28 · M04 final `d7daebe75341904fa62d04e911b8ea810992a2bb`: all five CI40617832325 jobs and Vercel passed. Created separate M05 branch/worktree from that exact head; original worktrees and protected root/M03 records untouched. Cached frozen dependency install completed offline, no package additions/lifecycle scripts. Source contracts are being implemented with labeled local examples; no M05 provider request, credential read, hosted migration, activation or production change.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. See MILESTONE.md §14 for the required items. -->
- —

## 28 October continuation — independently authorized non-website subset

This new track does not perform the earlier denied website edits. Their original evidence and the older text above remain preserved pending a supported narrow review. No permanent filename restriction has been established.

- Continuing draft PR14 from `e374257`; existing green CI40712613477 is preserved. The bounded native, Preview and database adapters now have an isolated M05 subset scope, separate encrypted state and request ledger. The original M04 scopes, charges, applied versions and evidence remain unchanged.
- Actual dev preflight:18 matching applied migrations; `20261028020745` still pending, source SHA256 `f3ff025065106733f7c76aec963e465a045270876c642db69e131df72f6d865e`. Exact five catalog accounts verified, zero selected claims/running parents/unfinished actors;242 items/raw preserved. Existing Admin and Apify read credentials worked. Two HarvestAPI metadata/build reads succeeded; no website capability enters the subset policy.
- Authenticated native Chrome shows WF-13 and its Execute control. Machine allowed host was inspected without reading its JSON or saving. The workflow-details connector's `-32603` is retained; it does not establish missing credentials.
- Current Vercel native metadata reports actual expiry with zero authentication/network activity. Exact existing-account `vercel.cmd login` instructions have been requested once; other preparation continues. No collection, hosted migration push, workflow mutation, Preview binding or bypass activation has occurred.
- [Subset execution record](evidence/subset-validation-20261028.md): direct WF-13/WF-18/WF-18b, existing selections, bounded first/repeat observations, cost/ownership reconciliation and exact shutdown. Website and overall M05 acceptance remain open. No production, schedules, notifications, merge or M06.
- [Draft support report](evidence/review-capability-support-20261028.md) is prepared, not submitted. Observed runtime remains `approval_policy=never`; local saved config/startup flags do not explain its source, managed/cloud origin is unknown, and this client exposes no narrow review endpoint. The owner already found `/approve` unavailable; it is not requested again.

Next: finish changed-head checks/review and push, use the existing exact-version M05 database path once, then execute the selected subset after native/provider/Preview readiness. Keep the website retry validation unperformed until a supported review mechanism permits the revised action. No fresh budget or general development decision is needed.

Native fallback now verified all four reviewed inactive workflow baselines and the three saved credential IDs/types through seven successful GETs. This resolves the connector-operation failure without replacing credentials. Focused review added a native Machine-version comparison against its actual UI host observation before any rebind; current metadata is compared again before each mutation. Targeted native/transport tests and local SQL parsing pass. PR14 remains draft; changed-head CI40727703596 is in progress at `829317e`, with its ordinary protected Preview green. No collection or migration push yet.

### Actual selected-source checkpoint and current next step

The preceding preparation status is historical. All five CI40728183715 jobs passed at `13b2fcb`. Dev migration `20261028020745` applied once;19-version history, hosted catalog/grants/RLS coverage and advisors passed. Six gateway probes plus unknown-callback data/cost/queue invariants passed. WF-13 run31214 ingested31 Hekka items; Aflam0 in the approved window; USD0 official API cost. No eligible fixed-pair daily repeat was forced.

The two selected LinkedIn actors succeeded but the callback rejected lower256/512MiB footprints as unacknowledged, while correctly preserving terminal failed outcomes and measured costs USD0.01505/0.08. They are fully reconciled, no claims or unregistered starts remain, and the first runtime is restored/closed (workflows/Machine/env/bypass). Original credentials, all19 migrations,273 retained items/raw and prior M04 data/charges are preserved.

The product fix retains the1024MiB ceiling and exact monetary/ownership guards, with website behavior unchanged. Retained-source normalization now accepts7 Everyone posts/0 GoodPeople; employee parsing supports the observed plural positions/public profile identity. Numeric employer IDs require a verified existing catalog external ID; Everyone94868239 is evidenced by its owned company-post query/author, with a one-row guarded dev resolution. Partial coverage and old failed receipts stay explicit. New source/callback tests and regenerated LinkedIn blueprints are being qualified; native corrected ingestion/replay is still unproved. The website retry edit remains separately blocked by the unavailable narrow review route.

Continue the corrected selected-source validation after actual changed-head CI and safe runtime readiness, retaining the same allocation/charges and first closed attempt. Do not repeat accepted YouTube collection, reopen M03/M04, replay migrations, create credentials, reset failed settlements, start website collection or request another financial approval. Keep PR14 draft and overall M05 open.
