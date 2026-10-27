# M04 incremental development results — 27 October 2026

**The approved incremental development sequence completed and shutdown passed. M04 remains open and PR13 remains draft.** This report records actual native/provider/dev-database results for the [approved packet](incremental-dev-approval-20261027.json), approval `123e88b6-5920-4e54-832a-ad6d87c22675`. Executed source head `376f9ddc03b9c9a3a6f7d921ddeab8d8c6eca2f6` passed all five [CI40535634604](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/40535634604) jobs and Vercel before staging. [Setup qualification](incremental-setup-qualification-20261027.json) records separate local tests and repaired native/publication contracts. No hosted request was made to write this report.

## Actual collection and daily results

The ten exact UUIDs were bound from the [fresh database preflight](incremental-db-preflight-20261027.json). The [native action journal](incremental-native-actions-20261027.jsonl) records seven new deliberate actions: restricted-access check, malformed callback, unknown callback, one fixed-selector WF-00 invocation, the accepted Vimeo pair continuation, and two Talkies daily invocations. Automatic child/callback executions are separate from this deliberate-action count.

| Actual path                                       | Native execution / database parent                                                                       | Result                                                                                                                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WF-00 → three additional Vimeo accounts           | WF-10 `31170` / `87b63677-ef54-49e9-a7f9-aa9a3778fa6a`                                                   | 3/3 succeeded; 23 seen, 23 nonduplicate additions, USD 0. C130/C226/C270 used at most two pages of width 20 and all reported source exhaustion.                                  |
| Same WF-00 → five-account joint Instagram history | WF-11 `31171` / `5191b37f-e7e3-4567-acfe-91d81385d564`                                                   | 5/5 succeeded; both passes settled, 294 seen, 182 nonduplicate additions, USD 0.7935. Two actors, limit 50/profile/pass. Every history remains incomplete.                       |
| Accepted Vimeo pair continuation                  | WF-10 `31176` / `74fae456-a34c-4460-a5ea-6ab66ecec431`                                                   | 2/2 succeeded; 10 seen, 9 nonduplicate additions, USD 0. Original page width 5 preserved; Good People reported done, everyone. retained next-page 4.                             |
| Eligible Talkies daily, then same-day repeat      | WF-10 `31177` / `8fd7bed3-7915-4d87-92bb-d6a61aaca9c5`; `31178` / `040b255f-2331-4c1b-95bc-ecbd40c74ee4` | Each succeeded with 1 seen, 0 new and USD 0. Item/raw-item/AI-queue/media-queue arrays match between settled snapshots. The second run adds its own zero-dollar API cost record. |

Actual snapshots: [history settled, 16:07:26Z](incremental-history-settled-20261027.json), [Vimeo pair settled, 16:08:52Z](incremental-vimeo-pair-settled-20261027.json), [daily first settled, 16:09:58Z](incremental-daily-first-settled-20261027.json), and [before restoration, 16:11:10Z](incremental-before-restoration-20261027.json). Seen counts are observations across passes/runs, not distinct stored-row counts.

This table describes **settlement evidence before operational restoration**. All ten temporary scheduling/backfill selections were subsequently restored to baseline; final operational `pending` values do not erase source observations or establish completed history.

| Company          | Vimeo handle: retained rows / observed history                                                           | Instagram handle: retained rows / observed history |
| ---------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| C000 everyone.   | `everyonefilms`: 13, including 2 content duplicates; incomplete, `/users/157330576`, next page 4/width 5 | `everyone.film`: 54; incomplete                    |
| C001 Good People | `goodpeoplefilms`: 7, including 1 content duplicate; reported done after width 5 continuation            | `goodpeoplefilms`: 24; incomplete                  |
| C130 Bigfoot     | `bigfootfilmseg`: 5; exhausted/reported done                                                             | `bigfootfilms`: 74; incomplete                     |
| C226 Big Kahuna  | `bigkahunafilms`: 0; exhausted/reported done, no invented item                                           | `bigkahunafilms`: 19; incomplete                   |
| C270 Talkies     | `thetalkiesproductionsleb`: 18; exhausted/reported done, daily twice verified                            | `thetalkies`: 22; incomplete                       |

All five Instagram posts/reels checkpoints retain `history_state:incomplete`, `results_limit:50`, `resume_supported:false` and latest-limit escalation. Successful bounded account/run results are not exhaustion claims. The conditional continuation of one new Vimeo account was skipped because all three new sources exhausted. The four conditional Instagram daily actor starts were skipped because none became genuinely eligible; no artificial `done` selection or resumable cursor was introduced. No eligible official-API failure occurred for goat255, and its current price/build pin was unverified. Dltik remained excluded for lack of a verified showcase/channel/group URL. No reserve actor or substitute collection ran.

## Stored data, types and cost

The increment retained **215 new item/raw rows, including 214 nonduplicate additions**. The ten selected accounts now have **236 stored rows: 43 Vimeo and 193 Instagram**, including 3 content duplicates. Each of 233 nonduplicates has exactly one AI queue message and one media queue message; each duplicate has zero. There are zero duplicate `(platform,external_id)` groups. The accepted sample's 21 selected rows and its two original content duplicates are preserved.

The [final readback](incremental-final-readback-20261027.json), `queryResult[2].incremental_source_cost_audit`, verifies Instagram **6 posts, 139 reels and 48 carousels**; all 193 have caption and metrics fields, and all 139 reels have duration. The 43 Vimeo videos have caption, metrics and duration fields. Hashtag, mention and tagged-account examples occur in Instagram data. **Zero pinned examples were observed**; old pinned-post daily omission remains unproved. The Talkies daily snapshots do not demonstrate a recent-item `metrics_updated_at` change; no 30-day metrics-refresh acceptance is claimed.

| Paid actor          | Pass  | Terminal status / processed | Actual USD | Allocation across five exact companies |
| ------------------- | ----- | --------------------------- | ---------: | -------------------------------------: |
| `9vvqGr2sFvbqWFDAQ` | posts | SUCCEEDED / yes             |     0.4232 |                           0.08464 each |
| `D9QTgPLLep5EP4MqI` | reels | SUCCEEDED / yes             |     0.3703 |                           0.07406 each |
| Increment           | both  | two actors, both settled    | **0.7935** |                 **0.1587 per company** |

Actor totals equal ten account allocations and the Instagram parent total. Vimeo API usage is logged at USD 0. Cumulative M04 paid collection is **four actors/USD 0.8395**, preserving the first sample's two actors/USD 0.046 unchanged. Global database cost also includes preserved older evidence and must not replace this M04 actor total. Infrastructure charges, fixed subscriptions and automatic execution counts remain unmeasured.

## Access, automatic error path and closure

The current [restricted identity check returned 200 and missing-Machine returned 401](incremental-access-20261027.json). Maintained WF-19 [malformed callback returned 500](incremental-malformed-callback-20261027.json) with zero provider calls; automatic error handling wrote fixed audit 21, workflow `WF-19`, execution `31166`, classification `callback_retryable`. The [audit receipt](incremental-callback-audit-20261027.json) and final source/cost audit retain that result. No execution history payload was saved, so the exact parent/error execution relationship is unavailable in retained UI history. This is automatic fixed database logging evidence; it does not establish three-run 404→`failing` or a sent health email. The [unknown callback returned 403/rejected](incremental-unknown-callback-20261027.json). Earlier accepted replay/security evidence is retained without another identical test.

The [16:23:35Z final readback](incremental-final-readback-20261027.json), [operational restoration](incremental-restore-selection-20261027.json), [native restoration](incremental-native-restored-20261027.json) and [Preview cleanup](incremental-preview-cleanup-20261027.json) establish closure. The five [sanitized native exports](../../../n8n/workflows/m04-incremental/README.md) preserve the staging publication state separately from the restored current state:

- All 17 migration history hashes match fresh preflight. Global 286 competitors and 1755 accounts, including retained C999, are unchanged. Global 237 item/raw rows include one preserved row outside the 236 selected rows.
- Ten temporary operational selections match baseline, while collected rows, costs, watermarks, queues and run history remain. Selected and global live claims/running parents/unprocessed actors are zero; uncertain launches are zero.
- Four original definitions and Machine audience are restored. All five owned definitions are inactive/unpublished with no pending mutation. New log-only handler `AwxhktgJdvLXE0FZ` is retained inactive with definition/audit history; original foundation WF-90 is unchanged.
- Seven owned project environment entries were removed and the owned default bypass is absent. Setup/cleanup reads found no active Production build; they do not prove continuous absence of builds by others during the interval. No Production operation was initiated. Protected immutable Preview `dpl_Gzr1tfmLmZBh45YY1yUhj4zFT1Vx` is retained; project-env deletion does not erase deployed values or prove the endpoint disabled. Persistent encrypted originals remain; bounded database children/scratch closed.

The [coordinator closeout](incremental-closeout-20261027.json) retains conservative charges without refunds. Categories are exclusive: Management = n8n + Vercel; Control = gateway + provider + callbacks + database commands.

| Charged category                    |    Closed sample |         Increment |    Cumulative M04 |
| ----------------------------------- | ---------------: | ----------------: | ----------------: |
| n8n                                 |               52 |                68 |               120 |
| Vercel                              |               36 |                37 |                73 |
| Gateway                             |              101 |               297 |               398 |
| Provider                            |              134 |               154 |               288 |
| Callback                            |               26 |                26 |                52 |
| Database commands                   |               21 |                16 |                37 |
| **Management / Control / Combined** | **88 /282 /370** | **105 /493 /598** | **193 /775 /968** |
| Deliberate native actions           |                5 |                 7 |                12 |

These are charged bounds/precharges, not a claim that every reserved nested HTTP request occurred. Cumulative limits remain 296 Management/1446 Control/1742 Combined/V100, 17 native actions, 10 actors/USD8.046. Frozen M03 charges are unchanged.

## Preserved failures and remaining gates

The [first final-readback attempt](incremental-final-readback-failed-20261027.json) failed read-only with SQLSTATE42703 because its draft referenced a nonexistent `status` column. The corrected predicate is `apify_run_id is null`; subsequent final readback succeeded. No mutation or successful query was replayed to repair that failure. A local restoration-SQL draft syntax defect was repaired before any network call. Both boundaries remain recorded; successful collection, billing and shutdown receipts are unchanged.

| Category                       | Remaining boundary                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coding defects / qualification | Earlier cursor, capped-daily, SQL-case/CAS and publication-order defects were repaired before execution and have focused local tests plus changed-head CI. Actual native integration does not prove every synthetic failure branch.              |
| Provider/history limitation    | everyone. Vimeo remains incomplete at page 4/width 5. All five Instagram histories remain incomplete at limit 50, with no verified resumable cursor/reels exhaustion. Bounded success does not establish full 2024 history.                      |
| Missing actual source examples | Old pinned-post omission, recent-item daily metrics change, goat255/dltik metadata and exact native error-history relationship remain unobserved. Retained data supports further fixture/field analysis without repeating identical collections. |
| Separate gates                 | Full-five daily acceptance, production pilot/estimate/MA-14, seven-day recurring overlap, 404 failure cadence/health email, merge and M05 remain open. No production writes, recurring schedules or external notifications occurred.             |

See the [AC1–AC9 mapping](criteria-mapping-20261027.md). This completed increment does not close M04 or renew/transfer unused paid allowance to another scope.
