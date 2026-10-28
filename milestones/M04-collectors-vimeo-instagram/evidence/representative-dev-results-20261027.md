# M04 representative dev results — 27 October 2026

**Real collection, replay/rejection and safe shutdown are verified. M04 remains open.** These are actual emr-dev (`zmotjsbzhzjvpelxvxlf`) native/provider/database results, separate from synthetic/local tests and required PR CI. The [approved packet](live-test-approval-20261027.json) covers this sample only; no production, recurring activity, external notification, merge or M05 is authorized here.

## Actual collection and integrity

| Path                      | Native/database identity                                               | Actual result                                                                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vimeo official API        | WF-10 execution `31158`; parent `f77352da-6efb-4d33-bacb-2e2f8826dd37` | `everyonefilms` and `goodpeoplefilms`:10 seen,8 new, two successful account results;10 stored source item IDs include two content-duplicate rows. API cost USD0.                                              |
| Vimeo same-content repeat | WF-10 execution `31163`; parent `f468793d-5bae-430b-909e-a6aed4de7e26` | 10 seen,0 new; same ten item IDs, unchanged AI/media queues, two actual API calls/USD0. Only the terminal owned accounts' operational first-page selection was rewound; content and watermarks stayed intact. |
| Instagram posts + reels   | WF-11 execution `31159`; parent `d0c86952-df68-48ff-8f41-132500e2e90b` | `everyone.film` and `goodpeoplefilms`: both passes registered and processed; parent `success`,16 seen,11 unique new items, two successful account results.                                                    |
| Actual actors and cost    | Posts `Wo1flJIBKg7bk07IJ`; reels `upaQMg5GMmwBdNMq4`                   | Both registered under approval `3f3aed72-4f14-4cc4-aefe-4999038efe27`, terminal `SUCCEEDED` and processed. Actual usage USD0.023 each; four account allocations sum to parent USD0.046.                       |
| Valid callback replay     | Same completed posts actor, existing WF-19 webhook                     | HTTP200, `replayed:true`; no paid start.                                                                                                                                                                      |
| Unknown-run callback      | New synthetic unknown ID, same webhook                                 | HTTP403, `rejected:true`; no account/item/cost ingestion.                                                                                                                                                     |

Sources: [first Vimeo](live-vimeo-first-assertions-20261027.json), [Vimeo repeat comparison](live-vimeo-replay-comparison-20261027.json), [Instagram assertions](live-instagram-first-assertions-20261027.json), [valid replay](live-callback-replay-20261027.json), [unknown rejection](live-callback-unknown-20261027.json).

The [before/after callback comparison](live-callback-integrity-comparison-20261027.json) passes for **all twelve** projections: runs, costs, items, accounts, launches, raw items, actor runs, AI queue counts, account results, media queue counts, passes and pages. It records zero selected live claims, running parents or unprocessed actors. The21 retained source rows are11 Instagram and10 Vimeo; the first Vimeo run's8-new result excludes its two content duplicates. Do not add repeated reads/runs to unique item counts.

## Security and source evidence

- [Dev preflight](hosted-dev-preflight-20261027.md) verified strict session-pooler TLS, the exact dev target and original15 migration fingerprints. Only the two approved M04 migrations were applied; current history17 remains preserved. Catalog/RLS/grants and both hosted advisors pass. Hosted type generation was not attempted; fixed hosted catalog was compared with reviewed locally generated contracts.
- [Protected access checks](live-access-checks-20261027.json) pass: valid restricted request200; missing Machine401/`unauthorized`; cookie403/`forbidden`; arbitrary operation400/`invalid_request`; unselected account403/`account_not_permitted`. Responses are matched to the request envelope/error code.
- Existing native Vimeo Header Auth and Apify `apifyApi` credentials were reused. The callback processor's registered actor/build/owner/options/INPUT checks and two stable terminal snapshots supplied actual usage; callback-supplied status/content/cost were not ingestion authority. The real callback/database success is stronger than a metadata-only execution list, which remains labeled as such.
- [Sanitized public sample projection](live-public-fixture-projection-20261027.json) contains real metadata only. Instagram examples include Video/clips and Sidecar/carousel metadata. This does not prove every required type/field, pinned-post behavior, showcase ownership, source completeness or either Vimeo fallback. No video download/transcription, login/cookie scraping or AI call occurred.
- Sanitized saved native definitions are retained in `native-saved-WF-10.json`, `native-saved-WF-11.json` and the historical/corrected `native-saved-WF-19*.json` records. They describe the temporary tested revision, not the restored currently inactive baseline.

## Stopping, retention and cleanup

The [selected-account restoration](live-selected-restoration-20261027.json) completed through the bounded database client with native0, `childrenClosed:true` and `databaseClientClosed:true`. All four accounts' snapshotted operational selection was restored after ownership/quiescence checks. Items, raw metadata, run/cost history, successful watermarks and human-corrected fields were retained; nothing collected was deleted.

[Native restoration](live-native-restoration-20261027.json) completed15 requests: all three owned definitions are inactive/unpublished with recorded original graph hashes, Machine binding restored, `pendingMutation:false`, `machineRebound:false`. Persistent encrypted originals remain outside Git; no administrator credential entered n8n or the web runtime.

[Final closeout](live-closeout-20261027.json) is `closed_verified`: zero selected live claims, running parents, unprocessed actors and other administrator sessions; bounded children closed and scratch deleted. [Vercel cleanup](live-vercel-cleanup-20261027.json) used18 requests to remove all seven owned project environment entries and verify the owned default bypass absent. The immutable Preview `dpl_FM5qAL13kxUQVba8A57mFoVmpQUL` remains protected and retained. Deleting project environment entries does **not** erase values from that existing deployment or prove its endpoint disabled; no such claim is made.

| Final charged category                    | Retained charge |
| ----------------------------------------- | --------------: |
| n8n Management                            |              52 |
| Vercel Management, included in Management |              36 |
| **Management total**                      |     **88 /160** |
| Database commands/sessions                |              21 |
| Provider HTTP bound                       |             134 |
| Gateway HTTP bound                        |             101 |
| Callback delivery/probe bound             |              26 |
| **Control total**                         |    **282 /472** |
| **Combined operations**                   |    **370 /632** |
| Deliberate native actions                 |            5 /6 |
| Actual actors / measured actor usage      |     2 /USD0.046 |

The [append-only ledger](live-usage-20261027.jsonl) retains all charges, including conservative nested request and retry precharges. These are **not** measured counts of every HTTP request, and no unused charge was refunded. Measured actor usage remains separate from unmeasured automatic execution count, n8n/Vercel/database/CI infrastructure USD and unknown fixed subscription fees.

## Preserved failures and narrow corrections

- Initial database preflight stopped before private read/authentication because the worktree's public output directory was absent. Its failed receipt and the later successful preflight both remain.
- A CLI Query attempt exited1 with no verified authentication; [its native failure receipt](live-selected-pre-execution-20261027.json) is preserved. A bounded supported `pg` Query child with the existing strict CA/TLS and reviewed SQL replaced that unsupported failing path; no password rejection is inferred from the failed CLI receipt.
- The original four-command hosted postcheck succeeded remotely, then hit a local bare-`false` PowerShell bookkeeping error. [Offline reconciliation](live-db-postcheck-offline-reconciliation-20261027.json) preserves the original blocked receipt, proves the corrected Boolean locally and performs zero hosted retries. Migration/advisor success was not replayed.
- The first Instagram assertion capture exceeded its local16000-byte stdout buffer; [the incomplete-capture record](live-instagram-first-assertions-capture-failure-20261027.json) explicitly does not establish authentication or closure from truncated output. The complete later read-only assertion receipt is separate.
- Initial WF-19 publication returned400 and left an uncertain mutation recorded. Native readback established it remained inactive; an inherited dispatch to inactive `SUB-FINISH` was observed, without claiming the API exposed an activation diagnostic. The scoped [corrective staging](live-callback-corrective-staging-20261027.json) disabled that closed-foundation dispatch only for this temporary M04 definition; [corrected publication](live-callback-corrected-publish-20261027.json) then succeeded. No M03 dependency/window was activated. The original complete baseline is now restored.
- One existing task wrapper handles scoped persistent credentials and private rollback state; one pure receipt-binding function permits replay only for the verified owned completed Instagram run. Focused tests cover ownership, terminal processing, cost parity, native phase contracts and safe error output. No new acceptance-supervisor/helper family, credential handoff cycle or paid retry mechanism was added.

## Remaining milestone requirements

The protected Preview application's tested commit is `ffa957d8186f2e054179bf81aae0e69600232818`; its CI40508929266 passed all five jobs. Later bounded-consumer and temporary closed-SUB native staging adaptations were locally reviewed/tested and are included in the current meaningful change batch. That earlier CI does not cover those newer helpers/graphs. [Actual native export](live-native-m04-export-20261027.json) graph hashes/versions identify the tested Cloud definitions; normal changed-head CI/review must cover the batched source before merge, without a separate CI-announcement commit.

This proves one representative connected collection path, not M04 completion. Keep the full milestone gates open: five-account dev coverage; complete history from2024; Instagram reels exhaustion and pinned posts; required real fixture/type/field regressions; Vimeo fallback/showcase membership; daily watermarks and30-day metrics refresh; WF-00 explicit-selection wiring; compatible global error logging; complete pilot cost estimate; production migration/pilot authorization; seven-day overlap/recurring measurement; final sanitized exports, review and required CI. Production launch, PR13 merge and M05 remain separate decisions.

### Batched local qualification

The [affected qualification record](local-qualification-20261027.json) reports60 passing bounded-consumer checks with one opt-in local test skipped in that run; the separate public-local PostgreSQL query suite passed7/7 with no skips. Five actual projected-fixture contract checks, affected lint/format and tracked-file secret scanning pass. These overlapping suites are not added together. The existing CI unit step now includes the new pure query regressions; all five required jobs remain.
