# M05 representative dev packet — 28 October 2026

**Proposed; not approved or executed.** This is one bounded representative source/collection check, including preparation, repeat observations, recovery and shutdown. It does not authorize the full pilot/history backfill or establish M05 acceptance. The coordinator must attach the reviewed head, green required CI, exact migration hash, verified account UUIDs and pinned actor/build/price metadata before admission. Missing facts below are gates, not assumed successes. No M04 allowance transfers to M05.

## Exact selected sources

These identities come from `data/test_accounts.csv` and the checked-in M02 `scripts/seed/prod-payload.json`, not a new provider lookup. The local checkout has no `dev-seed-manifest.json`; therefore **every hosted account UUID/competitor UUID remains unverified** until one bounded dev readback matches the source key, platform and exact saved URL. The source keys below are selectors for that readback, not UUID substitutes. Preserve genuine saved URLs, watermarks, cursors and human locks.

| Source key / company | Exact catalog source | First observation | Repeat treatment |
| --- | --- | --- | --- |
| `C000:website_work_page:0` — Everyone | `https://everyone.film/by-everyone` | Map limit100; fixed first3 owned project candidates; one primary crawl if unseen | Map again with the identical candidate-window policy; crawl no already-crawled candidate. No advance to the next deferred three. |
| `C001:website_work_page:0` — Good People | `https://goodpeople.film/works/` | Same bounds | Same bounds |
| `C173:youtube:0` — Aflam Productions | `https://www.youtube.com/@aflamproductions`; retained channel `UCynpzoM54-YMsKUQ6cPoYdQ`, uploads `UUynpzoM54-YMsKUQ6cPoYdQ` | Official API only; at most2 uploads pages ×50; reuse verified saved IDs | A second native collection only if the first actually establishes EOF/backfill completion and an eligible real watermark. Otherwise **skip** it; preserve the new continuation and use retained-payload/SQL replay evidence separately. |
| `C186:youtube:0` — Hekka | `https://www.youtube.com/@hekka_sa`; retained channel `UCYOM_-vZX82oFfS9L0bGBQg`, uploads `UUYOM_-vZX82oFfS9L0bGBQg` | Same bounds | Same conditional rule |
| `C000:linkedin:0` — Everyone | `https://www.linkedin.com/company/everyonefilms/` | Posts: one singleton company input, maximum20, genuine backfill cutoff `2024-01-01` when history is pending | Same source/input bounds. Distinguish same-ID replay from a genuinely newly published post; do not assert zero new solely because this is the second invocation. |
| `C001:linkedin:0` — Good People | `https://www.linkedin.com/company/goodpeoplefilms/` | Same bounds; separate singleton company input | Same bounds |
| `C000:linkedin:0:derived` — Everyone employees | `https://www.linkedin.com/company/everyonefilms/` | One company, Short mode, maximum20, first page only | One same-Cairo-capture-date invocation after the first settles. Exact projection replay must be a no-op; changed same-date observations must conflict safely instead of overwriting. |

No `website` root account is selected. No additional company, source, URL batch or fallback is authorized by this packet. Stored channel IDs above are historical M02 evidence; they are not a fresh current-channel assertion.

Website `source_options` are `{map_limit:100,max_new_urls_per_account:3}`. The implemented planner diffs the observed owned URLs, then intersects pending URLs with a stable three-candidate window. Coverage stays `candidate_subset` / `backfill_done:false`. The server policy must enforce the cumulative **three distinct primary URLs/account/approval** boundary, including changed maps; adaptive retries reuse that same set. Defaults500/2000 outside this packet remain unchanged. The new option and policy tests must pass before this packet is executable.

LinkedIn posts use `harvestapi/linkedin-company-posts`, finite `maxPosts:20`, `includeReposts:true`, `includeQuotePosts:true`, `scrapeReactions:false`, `scrapeComments:false`. The planner must not widen a genuine daily date bucket or alter a real watermark to combine inputs. Two singleton inputs are the conservative per-round bound; if both real cutoffs permit a supported common batch, fewer starts may be used without spending the saving elsewhere. A capped response never proves January2024 coverage.

Employees use only `harvestapi/linkedin-company-employees` with `profileScraperMode:"Short ($4 per 1k)"`, `companyBatchMode:"one_by_one"`, `maxItems:20`, `maxItemsPerCompany:20`, `startPage:1`, `takePages:1`. Persist exactly `{public_id,name,title,location}` through the snapshot RPC, not raw employee items. Coverage remains partial; the observed count is not company headcount, and neither joins nor departures may be inferred from capped/partial snapshots. No Full/email mode, jobs, reactions, comments, cookies or login is permitted. These fields follow the current [posts input](https://apify.com/harvestapi/linkedin-company-posts/input-schema) and [employees input](https://apify.com/harvestapi/linkedin-company-employees/input-schema).

## Starts, observations and data bounds

| Work | Planned upper bound | Conditional/recovery bound | Absolute bound |
| --- | ---: | ---: | ---: |
| Website primary actors | 2 | 0 | 2 |
| Website adaptive actors | 0 | 2, only verified thin URLs from those primary runs, once/site | 2 |
| LinkedIn post actors | 4: two companies ×first/repeat | Within the shared2-start recovery reserve below | 4 successful logical company-rounds |
| LinkedIn employee actors | 2: first/same-date repeat | Within the shared2-start recovery reserve below | 2 successful logical rounds |
| Reconciled paid recovery | 0 | 2 total, only a definitively failed/uncommitted selected LinkedIn logical round | 2 |
| **All actor starts** | **8** | **2 adaptive +2 recovery** | **12** |
| Firecrawl maps | 4: two sites ×first/repeat | 2 reconciled recovery calls, no automatic retry of uncertain paid outcome | 6 calls/credits |
| YouTube list calls / quota units | 16 for both full first/repeat rounds, using saved IDs | At most4 resolution calls +8 known-outcome recovery calls | 28; also respect the existing atomic8000/day guard |

Eight is a conservative target, not an obligation to start unnecessary actors. For example, an empty website diff skips its primary actor. A skipped second YouTube collection does not free authority for a third history page. No YouTube fallback actor is included. The two recovery starts replace failed/uncommitted logical rounds; they are not a third successful observation, a new company or an opportunity to seek a missing repost/JS example. A successful but unsupported source shape is retained/reported as a limitation; do not repeatedly scrape until a desired example appears.

The maximum admitted canonical-content observations are **486**:6 distinct website URLs +400 YouTube results (2 accounts ×2 conditional rounds ×2 pages ×50) +80 LinkedIn posts (2 accounts ×2 rounds ×20). This is a conservative upper bound on potentially distinct item identities, not a prediction that486 new rows will be inserted. Website adaptive work cannot add distinct URLs. Definite-failure recovery may add paid raw observations but must not add another successful logical round or expand the486 bound. Employee results are separate: up to40 observations over the two successful logical rounds, plus at most40 charged recovery observations if both recovery starts are used there; at most one same-date snapshot may persist. Public IDs may repeat. Queue only newly inserted content; replay must not duplicate items, costs or AI work. Do not run AI or media-download workers for this packet.

## Pricing and monetary reserve

Planning assumes the owner's recorded **Apify Scale** plan. Confirm its actual applicability, pinned builds, event prices and current `ops.price_book` before the first paid start; preserve both the planning quote and measured provider usage. If they differ beyond this packet's reserve, stop before spending and report the exact discrepancy.

| Component | Calculation at the public Scale price | Estimated bound |
| --- | --- | ---: |
| LinkedIn posts, planned |80 result events ×USD0.00175 +4 possible infrequent-start events ×USD0.00005 +conservative4 empty-query events ×USD0.001 | USD0.1442 |
| Employees, planned |40 basic profiles ×USD0.00250 +2 company-start events ×USD0.020 | USD0.1400 |
| Two LinkedIn recovery starts | Worst selected alternative:2 employee queries ×(20 ×USD0.00250 +USD0.020) | USD0.1400 |
| Website compute, planned primary |2 ×1024MiB ×600s =1/3 CU; Scale USD0.16/CU | USD0.053334 |
| Conditional website adaptive compute |2 additional identical resource/time ceilings =1/3 CU | USD0.053334 |
| Firecrawl |4 planned /6 maximum maps;1 credit/call. Dated book USD0.00083/credit gives USD0.00332 /0.00498 | Actual billing unknown; reserve USD0.05 |
| YouTube official API | At most28 quota units | USD0 |

The conservative quoted sum is about **USD0.5309 before Firecrawl** and before website proxy/data-transfer/storage charges (rounding the CU subtotal upward); expected two-primary/no-recovery actor subtotal is about **USD0.3376**. These are estimates, not historical usage. The proposed **aggregate provider spending reserve is USD5: Apify USD4.95 plus Firecrawl USD0.05**, including the conditional starts and recovery. It does not authorize buying/upgrading a subscription. Each PPE launch retains a finite server-approved per-run limit and the cumulative reserve; website PPU must not be represented as having an enforceable PPE invoice cap.

The [posts Scale table](https://apify.com/harvestapi/linkedin-company-posts/pricing) lists USD1.75/1000 posts; the [employees table](https://apify.com/harvestapi/linkedin-company-employees/pricing) lists USD2.50/1000 basic profiles and USD0.020/query, with platform costs included. The embedded `$4` in the Short enum is not the applicable price. The [website PPU table](https://apify.com/apify/website-content-crawler/pricing) currently lists Scale USD0.16/CU. Memory/time ceilings give at most2/3 CU over its four allowed runs; they do not bound proxy/transfer/storage invoice components. [Apify's resource documentation](https://docs.apify.com/actors/running/usage-and-resources) explains these separate usage components. Attest the proxy configuration and current account pricing before launch; retain actual usage and stop/reconcile rather than treat `maxTotalChargeUsd` as a PPU hard cap.

[Firecrawl Map](https://docs.firecrawl.dev/features/map) documents one credit/call regardless of returned URL count. The USD0.00083 book rate matches the public annual Standard allocation quotient, not an established owner plan. Current [Firecrawl billing](https://www.firecrawl.dev/pricing) has plan/overage differences; actual key, plan, credit balance and effective rate remain unknown. Record the real non-secret billing basis before spending. Do not sign up, upgrade or enable pay-as-you-go to pass this check.

**Infrastructure is separate.** Vercel function/build/egress, n8n executions and Supabase database/storage/network charges are possible and their incremental USD amount is unknown. Native action/request limits below bound activity, not invoice amounts. Keep unknown fixed fees unknown; no subscription questionnaire or shared budget change is included. Record measured infrastructure usage where available without fabricating USD0 or adding it to the actor ledger twice.

## Complete request allocation proposal

This is a conservative allocation derived from the existing finite code paths, not measured usage or a claim that all maxima will be needed. **M05 baseline:0 hosted requests,0 native actions,0 actors/USD0 at drafting.** Preserve the closed M04 record300 Management /2609 Control /2909 combined /Vercel111 /native18 /24 actors /USD1.0695 unchanged; it is historical, not this packet's starting balance or remaining authority.

| Exclusive category | Normal/source and worst bounded repeat work | Recovery/shutdown reserve included | Proposed M05 cumulative ceiling |
| --- | ---: | ---: | ---: |
| n8n Management |120: inventory/snapshots, seven definition saves/readbacks, narrow log-handler publication/binding if required, credential metadata and native execution observations/restoration |72 | **192** |
| Vercel Management |40: project/session/readiness, exact Preview environment/deployment/bypass setup and observations |24 for failed setup, owned removal/revocation and final readback | **64** |
| **Management subtotal** | **160** | **96** | **256, including Vercel64** |
| Restricted gateway Control |800: lifecycle/claims, URL diff/costs, quota reservations, at most400 YouTube byte batches, actor registration and callback lookup/settlement |224 for callback duplicates, reconciliation, read/security assertions and close | **1024** |
| Provider Control |640: at most12 actor POSTs,6 maps,28 YouTube calls, pinned metadata and at most576 callback verification reads |64 for permitted non-start reconciliation/status/abort reads and shutdown | **704** |
| Callback ingress Control |120 |24 | **144**, no more than12 deliveries/start |
| Bounded DB administrative/readback Control |32 |32 | **64** |
| **Control subtotal** | **1592** | **344** | **1936** |
| Unassigned Control shutdown reserve |0 |112; no new sources, starts or data scope | **112** |
| **Control total** | **1592** | **456** | **2048** |
| **Combined** | **1752** | **552** | **2304 =256 Management +2048 Control** |
| Deliberate native actions, separately counted |8 source invocations +1 restricted identity/security action |7 for conditional invocation/reconciliation/safe stop | **16** |

Vercel is a subset of Management. Callback ingress, its provider reads and its restricted-gateway operations are different HTTP requests and are counted once in their respective Control categories. SQL executed inside a charged gateway request is not charged again as a separate administrative request. Provider cost events/YouTube quota units are not request counters. Native actions are separate deliberate invocations, not an additional total to add to HTTP requests.

The callback read ceiling conservatively allows12 starts ×12 deliveries ×4 reads (two stable terminal-state reads, immutable INPUT and one bounded dataset page); settled callback replays normally use only lookup and no provider reads. Any actual additional page/read consumes the same704 pool and must fit its remaining shutdown reserve; the selected outputs are below500 rows/run. YouTube ingestion is conservatively allowed one byte-batch/item,400 batches, instead of assuming one large gateway request will fit. The proposed1280-style historical M04 provider ceiling and its arithmetic are irrelevant here.

The coordinator must check the final supported save/publication and deployment paths against this allocation before admission. If an unimplemented setup path cannot be bounded, identify it and finish local work; do not start a partial batch and leave cleanup unbudgeted. Once this complete packet is approved, ordinary reconciled continuations within its unchanged remaining scope/counters do not need a time-only or general development approval.

## Preparation, execution and restoration

1. Verify the exact dev project `zmotjsbzhzjvpelxvxlf`, eighteen applied migration identities/hashes, original data counts and global vacancy. Snapshot the seven selected account identities/operational fields and the exact owned workflow/Machine state. Preserve all M03/M04 rows, items, claims/history and retained exceptions; do not revive their closed fixtures or allowances.
2. Apply **only** pending `20261028020745_m05_web_youtube_linkedin.sql`, once, through the separate bounded administrative path after exact-version preflight/dry-run. The reviewed hash is attached at final qualification. Reconcile history/schema before any retry of an ambiguous response. Postcheck the nineteen-version chain, least-privilege grants, constraints/advisors and generated-type coverage. Runtime uses only the existing restricted strict-TLS gateway/writer path; the administrator password never enters n8n or the web runtime.
3. Reuse existing CurrentUser-DPAPI dev entries, the dedicated Machine integration and existing Apify/YouTube credential IDs/types. Read only required metadata. **Firecrawl credential/billing availability is unverified**; use an already valid integration first. If genuinely absent, request exactly that input privately through the existing initialization path, without recreating any valid credential. No secret values, tokens or raw employee profile payloads may appear in logs/exports.
4. Preserve rollback snapshots and drift-check before owned saves. Stage the **four** collector definitions WF-21/WF-13/WF-18/WF-18b plus shared WF-00, WF-19 and a new owned log-only M05 error handler: seven definitions, not five distinct collectors. Schedules remain off. If the pinned n8n validator requires publication to bind the Error Trigger, temporarily publish **only** the owned log-only handler, bind/read back its exact ID, and return it inactive/unpublished during shutdown. Do not bind old M03 dependencies or a notifier. Sanitize actual saved exports; local blueprints are not Cloud receipts.
5. Build/use only the exact protected branch dev Preview. The proposed temporary **sole/default automation-bypass exception requires explicit owner approval with this packet**, because Vercel may place a default bypass in future builds. Restrict use to the exact dev Preview, retain application/Machine authentication and prevent conflicting Production builds while it exists. Do not request Production or deploy there. Revoke the exact owned bypass and verify it absent; remove only owned temporary environment entries and verify original configuration restored.
6. Configure fixed dev selection and operational due fields only where the reviewed claim contract requires them. Do not fabricate history completion, reset cursors, widen account eligibility or rewrite real source watermarks. First complete each source's bounded first observation and settlement; then admit its conditional repeat only when honest eligibility and remaining counts permit. Wait for all registrations and callbacks, including an owned thin retry, before parent completion/account release. Preserve supported native records and database assertions.
7. For successful captured identities, replay the retained callback/content through the existing supported path to prove cost/item/queue no-op. Prove unknown-run rejection without ingestion/cost changes. Do not represent a separately collected new public post as a failed replay. Retain source-contract failures as measured, costed observations, with no guessed media/repost/employee ownership or coverage.
8. Stop new work before shutdown reserves are endangered. A paid POST with a lost/ambiguous response is **never** replaced blindly: establish its exact actor/launch/registration state with supported records first. No overlapping unresolved round; no automatic renewal or counter reset. Up to two explicitly counted recovery starts require definite failed/uncommitted status and the same selected logical round. A success with missing examples is not recovery authority. If source prices/configurations no longer fit USD5, stop before another start.
9. Settle/abort only exact owned work as appropriate, verify no unfinished runs/claims/actors, restore account status/selection/due settings while preserving genuine new cursors/watermarks, restore original Machine/workflow graphs/settings, and leave all owned definitions inactive/unpublished. Preserve all collected rows and document retained test records/queues; do not delete them to make a pass. Close credential-bearing children and delete disposable runtime copies/scratch; persistent encrypted originals remain. Record final costs, counters, remaining allowance, native identities, cleanup and exact evidence limitations.

## What this can and cannot establish

| Fact | Intended proof | Still separate/open |
| --- | --- | --- |
| Restricted runtime and callback safety | Verified dev identities, current strict TLS, exact ownership/claim barriers, replay and unknown-run rejection | Production access/rollout; no broadened grants |
| Websites | Two real maps, up to6 project pages, actual thin/adaptive case only if it occurs, same-candidate repeat | Five-site breadth,20-page quality sample, full map coverage, missing HTML/JS/error examples, a naturally new next-day URL |
| YouTube | Exact channels, official list output, quota/cost accounting, truthful EOF/cursor, eligible repeat if possible | Full five-channel2024 history, actual Shorts identity, fallback actor/source examples |
| LinkedIn posts | Real company-owned source shape and two bounded company rounds; actual repost only if naturally present and safely recognized | January2024 completeness, missing real repost/video/thumbnail contract examples; no invented fallback |
| Employees | Real Short projection, partial coverage, privacy, exact same-date replay/conflict | Complete roster/headcount and departures/joins; four remaining test companies; weekly operation |
| Costs/shutdown | Measured provider totals, cost-once, no pending owned work, restored settings/bypass, retained data inventory | Unknown fixed fees and actual infrastructure USD; production/backfill, three-day recurring observation, notifications and merge |

No criterion is waived or marked passed by approval. Full M05 Done, production pilot/backfill, recurrence, external notifications, private R2 work, merge and M06 remain excluded.

## Single approval wording after qualification

> Approve the reviewed M05 representative dev packet, its one dev migration and temporary sole/default Preview-bypass exception: Management256 including Vercel64, Control2048, Combined2304, sixteen deliberate native actions; target eight / maximum twelve actor starts, USD5 aggregate provider reserve, at most486 canonical-content observations and the bounded partial employee snapshots. Include the described conditional repeats, two definite-failure recovery starts, restoration and shutdown. Preserve all prior charges/data and all excluded production, recurring, notification and merge boundaries.

This wording is **proposed**, not an owner answer. The final reviewed head/hash/IDs and locally qualified setup allocation must be attached before presenting it. No credential delivery, paid request, hosted migration or activation occurred in preparing this packet.
