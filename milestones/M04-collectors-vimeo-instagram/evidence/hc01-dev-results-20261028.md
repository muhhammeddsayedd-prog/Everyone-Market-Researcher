# HC-01 actual dev acceptance — 28 October 2026

**M04 development accepted; coverage and rollout obligations open.** This is the owner-approved development gate, not original full milestone Done, production readiness or merge. PR13 remains draft/unmerged. M05 has not started in this record; its separate stacked branch follows final record-head CI.

Actual application code: `948e61822694af6a2e9cbe5f69c6a97c9a751c37`; [CI40612074064](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/40612074064) passed quality/unit/build/e2e/db-tests before staging. The ordinary protected Preview was READY. Final result/documentation-head normal CI remains required before M05 branch creation. The [28October decision](../../../docs/DECISIONS.md#m04-development-acceptance-and-m05-sequencing--28-october-2026) and [recorded packet approval](hc01-dev-approval-20261028.json) govern this run; prior samples and charges remain unchanged.

## Hosted contract and executed stages

Only `20261027192743_m04_recent_instagram_dev_eligibility.sql` was applied once to emr-dev `zmotjsbzhzjvpelxvxlf`, after exact original17-version/hash preflight and a one-version dry-run. [Migration receipt](hc01-db-migration-20261028.json), [postchecks](hc01-db-postcheck-20261028.json) and [final readback](hc01-final-readback-20261028.json) establish18 versions, preserved fingerprints, reviewed contract/RLS/grants and zero security/performance advisor warnings/errors. Catalog coverage matches the locally generated contract; no hosted full-types generation is claimed. The five-account development exception is unchanged; generic scheduled eligibility still requires completed history.

| Stage | Native execution | Actual result | Actor starts / USD |
| --- | --- | --- | --- |
| Everyone first posts/reels | 31179 | Performed/passed: both passes settled,4 normalized seen,0 new | 2 /0.0276 |
| Everyone repeat | 31184 | Performed/passed:4 seen,0 new, no redundant queues | 2 /0.0276 |
| Other four first posts/reels | 31187 | Performed/passed: all4 accounts settled,21 seen,0 new | 8 /0.0874 |
| Other four repeat | 31202 | Performed/passed: all4 accounts settled,21 seen,0 new, no redundant queues | 8 /0.0874 |
| Everyone Vimeo page4/width5 | 31211 | Performed/passed:5 seen/5 new, correct retained next cursor; not complete history | 0 /0 |
| Recovery invocation | — | Unperformed; unnecessary | 0 /0 |

All five planned Instagram account checks were performed twice through actual native/provider/callback/DB paths. [Everyone settlement](hc01-first-settlement-20261028.json), [Everyone repeat](hc01-repeat-observation-20261028.json), [remaining first](hc01-remaining-first-settlement-20261028.json) and [remaining repeat](hc01-remaining-repeat-observation-20261028.json) preserve the real results. All20 actors SUCCEEDED/processed, all four Instagram parent registrations closed and all owned claims settled. Inputs retained genuine per-account watermark/date groups; no common-date forcing or real watermark rewind occurred.

| Account | Both Instagram invocations | Actual allocated USD |
| --- | --- | ---: |
| Everyone / C000 | Performed/passed | 0.0552 |
| Good People / C001 | Performed/passed | 0.0506 |
| Bigfoot Films / C130 | Performed/passed | 0.0552 |
| Big Kahuna Films / C226 | Performed/passed | 0.0598 |
| The Talkies / C270 | Performed/passed | 0.0092 |
| **Total** | **20 starts;100 raw launch observations,50 normalized observations,0 new Instagram items** | **0.2300** |

Twenty unique actor cost rows, actor usage and four parent totals reconcile. Raw dataset EOF was below the requested30-result bound for every pass; no capped recent output was mislabeled complete. All five Instagram histories remain pending with their original null cursors and unchanged primary watermarks. Canonical non-metrics/AI/extraction fields, raw identity projections and AI/media queue arrays for the existing236 selected records remain unchanged. Legitimate metrics deltas below mean the entire item arrays are not byte-identical.

## Actual recent metrics and focused failure proof

Natural provider re-observation supplied representative **within30days** metrics proof. The nominated `DeZgi_rDHGi` appeared with unchanged metrics; other retained items supplied the actual updates. Comparing retained baseline and settlement receipts:

| Public item | Published UTC | Actual metrics change | Metrics timestamp UTC |
| --- | --- | --- | --- |
| Everyone `DeEq2JLscE1` | 2026-10-04T12:53:50Z | Views11412→11420 | Oct27T16:05:19.674633Z→Oct28T01:10:03.663798Z |
| Bigfoot `DeMu7dwNbUR` | 2026-10-07T15:59:30Z | Views36299→36327 | Oct27T16:05:19.674633Z→Oct28T01:22:26.676354Z |
| Bigfoot `DemI2yDNmKR` | 2026-10-17T12:45:46Z | Views4062→4096 | Oct27T16:05:19.674633Z→Oct28T01:22:26.676354Z |
| Talkies `De__YlMobVD` | 2026-10-27T14:03:28Z | Views1135→2306→2309; likes43→62, comments5→7 | Oct27T16:06:53.939802Z→Oct28T01:22:34.509029Z→Oct28T01:28:11.237026Z |

Each retained AI status stays pending, extraction ID stays null and each existing AI/media queue count stays1. These are actual normalized ingestion/DB observations, not mocked timestamp assignments. The focused retained-data normalization→writer-RPC→actual-local-SQL test separately passes1/1, including a DB-generated metrics timestamp update, exact repeat/no duplicate work and rollback preservation. That fixture proof stays local; it is not counted as another provider run.

Failure coverage reuses accepted actual automatic error audit/replay/unknown-run evidence. Affected callback tests pass30/30, including verified FAILED/TIMED-OUT/ABORTED usage settlement without dataset ingestion and RUNNING lookup-only retry. Existing normal-CI SQL07 failure escalation/retry/claim fencing and SQL16 joint registration/failed-actor/cost-once coverage remain. No new live failure campaign, notification or M03 retention/deletion work was performed.

## Vimeo continuation and retained data

[Native31211 settlement](hc01-vimeo-settlement-20261028.json) consumed exactly `/users/157330576`, page4, width5 through the official API: five new canonical/raw rows, USD0, no actor/fallback. The rows are June2026 public videos; the primary watermark remains2026-10-15T11:11:11Z /`1236174183`. Everyone Vimeo remains **running/incomplete**, with retained next cursor `{endpoint:"users",resourcePath:"/users/157330576",page:5,page_size:5}`. No EOF/January2024 completeness is claimed. Further history acquisition is the approved follow-up; cursor correctness passed now.

Each new nonduplicate row has pending AI and one AI/media message. Existing236 selected rows/raw projections, human locks and queues are preserved; selected totals are now241 item/raw rows. Global totals are242 item/raw rows, preserving the pre-existing unselected row. Final global competitors/accounts are286/1755, including retained C999. No collected data was deleted.

## Restoration, accounting and final runtime

[Due restoration](hc01-db-restoration-20261028.json) changed only next_due_at/updated_at for the five Instagram accounts and Everyone Vimeo; every original due value returned while actual watermarks, new rows and Vimeo page5/running state remained. [Native restoration](hc01-native-restoration-20261028.json) read back all five definitions inactive/unpublished with their exact initial graph hashes; Machine binding was restored and no mutation remained pending. [Vercel cleanup](hc01-vercel-cleanup-20261028.json) completed with19 requests, seven owned env entries removed and the exact owned bypass verified absent. The protected immutable Preview is retained; env removal does not erase its immutable deployed values.

[Final DB assertions](hc01-final-assertions-20261028.json) and [final readback](hc01-final-readback-20261028.json) show five owned parents terminal, all20 new actors processed, zero global live claims/running parents/unprocessed actors and no duplicate external IDs. Bounded DB children and scratch closed; persistent encrypted originals remain reusable. Production, schedules, notifications, private R2 and merge were untouched.

| Exclusive category | Prior delivery-inclusive charge | New charge | Cumulative |
| --- | ---: | ---: | ---: |
| n8n Management | 120 | 69 | 189 |
| Vercel Management | 74 | 37 | 111 |
| Restricted gateway | 398 | 540 | 938 |
| Provider HTTP | 288 | 1028 | 1316 |
| Incoming callbacks | 52 | 240 | 292 |
| Bounded DB commands | 37 | 26 | 63 |
| **Management** | **194** | **106** | **300 /482** |
| **Control** | **775** | **1834** | **2609 /3151** |
| **Combined** | **969** | **1940** | **2909 /3633** |

The [aggregate closeout](hc01-closeout-20261028.json) binds these checks and charges to their actual receipts. Vercel111/138 is included in Management, not added again. Deliberate native actions are18/19 cumulative (6 new); actors24/26 cumulative (20 new), actual actor USD1.0695 including historical USD0.8395 and new USD0.2300. Conservative callback/gateway/provider precharges remain charged even where observed network work was smaller. No reset/refund or transfer to M05 occurs; unused conditional/recovery capacity grants no collection scope. Infrastructure compute/storage/subscriptions remain separately unmeasured, not zero.

The approved estimate's provider derivation had an arithmetic presentation error:14 metadata+22 starts+4 Vimeo+1056 callback reads+44 abort/terminal =1140, not1240. The approved1280 provider ceiling is unchanged:140 reserve comprises40 explicit recovery plus100 previously unitemized headroom. No new scope, operation or charge is created by this clarification; the historical packet is preserved.

## Remaining obligations and next delivery boundary

The [current criteria map](criteria-mapping-20261027.md) retains HC-01-F1 Instagram January2024 history; Everyone Vimeo residual page5 history; real old-pinned and unexercised fallback/source examples; full-five Vimeo daily-repeat breadth; native parent/error UI pairing and live consecutive-failure demonstration; production AC6/production AC7/copies/backfill; recurring overlap and health-email delivery. Unverified fallbacks stay disabled/unreachable. General scheduled Instagram while history is incomplete remains an explicit production-launch issue; HC-01 is development-only. Representative natural recent-metrics observation is now performed/passed, so its unavailable-observation deferral is not used.

The optional staged-input JSON generation/probe remains unperformed after its enforced denial; no renamed/tool-routed substitute was created. Independent existing execution paths supplied the required evidence. Protected stale root/M03 records remain unchanged. After normal final record-head CI, branch M05 separately from that accepted CI-green M04 head and open a stacked draft PR targeting M04. No M05 changes belong in PR13; M05 live/spending/hosted operations still require their own later packet.

Executed SQL evidence retains its exact source bytes, including whitespace-only blank lines emitted by the existing builder, so each receipt's query SHA256 remains verifiable. Local diff whitespace diagnostics for those immutable SQL artifacts are recorded as a cosmetic exception; other-file whitespace, secret scanning and all required CI checks remain unchanged.
