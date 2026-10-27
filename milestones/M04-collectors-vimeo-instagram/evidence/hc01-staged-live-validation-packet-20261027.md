# HC-01 staged dev validation — one pending live decision

Prepared 27 October 2026 from implementation `1bedc536d6f2c6e9a596356e40bbcc904daa24a8`, preserving `c8454b3` and accepted `6dea884`. This is a human-readable estimate and approval packet, not an executable input file or a new checking framework. **No live approval is recorded here.**

## Delivered qualification and unchanged boundaries

- HC-01 behavior is already approved. Only Instagram January2024 completeness in **dev AC2** is deferred to HC-01-F1; history remains incomplete. Other criteria, including Vimeo history and production AC6, are unchanged.
- PR13 remains draft. Implementation head `1bedc53` was pushed; [CI40576627357](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/40576627357) passed quality, unit, build, e2e and db-tests. Vercel built the ordinary branch Preview successfully. A single unauthenticated, redirect-disabled request at `2026-10-27T20:26:31.797Z` returned302 to `vercel.com/sso-api`; no bypass or application secret was sent.
- Normal CI replayed the entire checked-in **18-migration chain**, including `20261027192743_m04_recent_instagram_dev_eligibility.sql`, SHA256 `635b8303d69ab32560d5acda903fee4c4555a9b3f6f35923d4d7b3655513f61d`. Foundation176, seeded590 across14 suites, GW01102 assertions and the connected generated-native/HTTP/actual-SQL test passed. CI security advisors found no warnings/errors; performance checks found no errors. These are CI-local results, not hosted application.
- [Prior local qualification](hc01-local-qualification-20261027.json) remains separate: new rollback SQL48/48, preserved collector132/132, generated-native/HTTP/SQL1/1 and safety16/16. This turn's native workflow tests passed33/33 and pure native grouping matched the planner. These overlapping results are not added together.
- Hosted dev still has the accepted **17 applied versions**. This continuation applied no migration and read no persistent secret. The eventual staged packet must first revalidate hosted state; accepted historical runtime closure is not a fresh readback.
- Generic scheduled eligibility is deliberately unchanged. The explicit selector forwards the same account IDs through start/claim; gateway validation and the SQL exception retain exact identities. The exception still requires active/due/unlocked accounts, valid nonfuture watermarks/IDs and fenced joint posts/reels ownership. SQL's `dev` label does not attest a physical project: pinned dev strict TLS plus project/branch/application-auth guards remain necessary.

## Exact accounts, groups and native inputs

Retained final readback gives the following distinct date buckets. These are evidence-derived first-invocation examples, not dates to force onto newer state.

| Company | Exact Instagram account UUID | Retained watermark UTC | Derived `onlyPostsNewerThan` |
| --- | --- | --- | --- |
| Everyone / C000 | `962c9c7e-aa0f-46ae-911b-3265859e0577` | 2026-10-12T15:01:56Z | 2026-09-12 |
| Good People / C001 | `bed82782-753f-4ba9-91ca-691ef36f75c6` | 2026-06-28T16:55:05Z | 2026-05-29 |
| Bigfoot Films / C130 | `46149fb9-8905-4b76-9834-4b38f668a2e2` | 2026-10-17T13:01:23Z | 2026-09-17 |
| Big Kahuna Films / C226 | `3ca3befa-abe6-4540-a389-0cf16115c581` | 2026-07-18T14:10:39Z | 2026-06-18 |
| The Talkies / C270 | `2d42d451-ac9a-42ac-a879-8760d63c8108` | 2026-10-27T14:03:28Z | 2026-09-27 |

Each singleton input uses its canonical public profile (`everyone.film`, `goodpeoplefilms`, `bigfootfilms`, `bigkahunafilms`, `thetalkies`), `resultsType: posts` or `reels`, `resultsLimit:30`, the actual watermark-derived date and `addParentData:false`. Posts additionally uses `skipPinnedPosts:true`; reels omits it. Recompute the second invocation from the genuine then-current watermark. Do not combine date buckets, alter watermarks or replace these inputs with the old five-result sample override.

| Stage | Actual grouping | Planned new starts | Requested observations |
| --- | --- | ---: | ---: |
| 1: Everyone twice | One date bucket, posts + reels, two sequential parent invocations | 4 | 120 |
| 2: remaining four twice, conditional | Four distinct date buckets, posts + reels, two sequential parent invocations | 16 further | 480 |
| Planned Instagram total | Four parent invocations | **20** | **600** |
| Recovery only after terminal reconciliation | At most one selected account's joint posts/reels invocation | 2 reserved | 60 |
| Absolute Instagram ceiling | No substitute account/source or uncertain paid-start retry | **22** | **660** |

Allow only a reviewed compare-and-set of **next_due_at** to make the immediate repeat eligible, after the prior parent's terminal result, released claims and ownership/quiescence checks. Preserve watermarks, cursors, all rows and incomplete history. Restore operational selections at shutdown; do not restore old watermarks over legitimate new observations. If natural watermark advancement changes grouping, use actual groups; unused capacity cannot expand scope.

Stage1 must establish both passes complete on both invocations, no early parent finish/foreign claim release, second-run zero new items and unchanged AI/media queues, monotonic watermarks, actual cost parity and released claims. Name retained Everyone candidate `DeZgi_rDHGi` / item `bd4b0ff3-73b1-4c7f-a6e3-19a325e86a94` before admission. Its recorded metrics timestamp is `2026-10-27T13:47:37.471148Z`; metrics acceptance needs actual reappearance and timestamp advance with AI state unchanged. Reappearance is not guaranteed. Failure, cap saturation or missing required evidence stops Stage2; do not repeat identical collection to hunt for examples. Accepted replay, unknown-callback and automatic-error evidence is reused.

## Everyone Vimeo continuation

Use only C000 account `985a57dd-7934-422d-9d18-4e8ca59fc197`, competitor `94928d31-8983-403c-bdbd-f5f44613d631`, external user `157330576`. Accepted parent `74fae456-a34c-4460-a5ea-6ab66ecec431` / native31176 retained `{endpoint:"users",resourcePath:"/users/157330576",page:4,page_size:5}`. Operational restoration may have left the DB cursor null; do not assume it is present.

Fresh identity, last-run, closed registration, actor/run/lease and global quiescence checks precede an exact cursor/updated_at compare-and-set. Preserve all content/history evidence. Run one intended official API page4/width5 listing, at most four GETs with existing429 retries and at most five observations. **Zero actors; API fee USD0.** No fallback actor. Completion requires real `paging.next:null` or verified descending date strictly earlier than2024-01-01. Otherwise retain page5/width5 and incomplete history; spare allowance does not buy another page.

## Migration, setup and safe closure included in this request

1. Reuse persistent dev credentials through existing bounded paths. Verify physical `zmotjsbzhzjvpelxvxlf`, strict TLS/restricted writer and exact17 fingerprints, no uncertain work and the five identities/real watermarks. Dry-run must list only the reviewed eighteenth migration. Apply it once, then verify18-version parity, grants/RLS/contracts, generated schema coverage and hosted advisors. No reset, seed, migration replay or production operation.
2. Reuse existing WF00/WF10/WF11/WF19 and owned log-only handler `AwxhktgJdvLXE0FZ`; stage only the selected dev cohorts through existing supported builders. Old sample consumers are pinned to closed cohorts/17 versions: they must not be invoked unchanged. Narrow reviewed inputs/manifest updates are permitted after approval, not a replacement wrapper family. Keep all schedules/notifications off; no old M03 dependency is activated.
3. Include one protected exact dev Preview, the existing seven branch-scoped runtime bindings and narrowly scoped Machine audience. Include a **new temporary sole/default automation-bypass exception**: Vercel requires default; future builds could inherit it. Avoid conflicting Production builds, use it only for the exact dev Preview, retain application authentication, then revoke the exact owned bypass and verify absence. No production request, build or deployment is authorized.
4. Temporarily publish only owned callback/error definitions when required by the pinned native save contract, verify bindings and restore all original definitions/audience/settings to inactive/unpublished. Preserve encrypted rollback snapshots outside Git; do not alter unrelated workflows/shared credentials.
5. Execute Stage1, the conditional Stage2, and the single Vimeo page with supported native records and DB assertions. Before each paid start retain callback, terminal/abort, restoration and shutdown capacity. On an ambiguous paid response, reconcile provider identity/state before any further start. Recovery is at most one known-terminal, repaired, selected-account joint invocation, not a blind replacement.
6. Reconcile actual terminal provider usage/cost rows, per-account runs/claims/registration, item/raw/AI/media arrays and retained incomplete history/cursors. Stop new admissions before runtime coverage expires. Close/abort owned work where supported, drain/reconcile callbacks, restore selections/definitions/Machine, remove owned runtime entries, revoke owned bypass and verify zero unfinished linked work. Retain collected data, audit records and protected immutable Preview evidence; removal of project env entries does not erase immutable deployment values. Close bounded children/scratch and disposable copies; retain persistent encrypted originals.

## One complete operation allowance

Frozen accepted collection charges remain193 Management /775 Control /968 Combined /Vercel73, four actors/USD0.8395 and12 deliberate native actions. This delivery adds **one** ordinary unauthenticated Preview protection GET, charged once as Management/Vercel. Thus the approval baseline is **194 /775 /969 /Vercel74**. GitHub delivery/CI reads are outside the collector ledger. No collector/provider/setup operation was performed while estimating.

| Exclusive category | Planned/bounded operations | Additional recovery/shutdown reserve | New ceiling | Charged baseline | Proposed cumulative ceiling |
| --- | ---: | ---: | ---: | ---: | ---: |
| n8n Management | 162 | 62 | 224 | 120 | 344 |
| Vercel Management | 47 | 17 | 64 | 74 | 138 |
| Restricted gateway | 597 | 171 | 768 | 398 | 1166 |
| Provider HTTP | 1240 | 40 | 1280 | 288 | 1568 |
| Incoming callbacks | 264 | Included in delivery bound | 264 | 52 | 316 |
| Bounded database commands | 45 | 19 | 64 | 37 | 101 |
| **Management subtotal** | | | **288** | **194** | **482** |
| **Control subtotal** | | | **2376** | **775** | **3151** |
| **Combined** | | | **2664** | **969** | **3633** |

Vercel is included in Management once; native actions are separate. Database entries are bounded commands/sessions, not HTTP requests. Incoming callbacks and the outgoing gateway/provider calls they cause are different operations. The new total contains2600 HTTP operations and64 DB commands. These are conservative ceilings, not measured usage or precise predictions.

Derivation and closure reserve:

- n8n162:7 baseline reads +7 existing-handler verification/save/publication +12 consumer save/readbacks +3 Machine +3 WF19 publication/readbacks +5 exports +16 cohort staging/readbacks +88 execution/detail reads +21 restoration. Extra62 covers recovery/closure.
- Gateway597:59 Instagram parent/claim/registration lifecycle calls for four planned parents plus one recovery +528 classify/process calls (`22 ×12 deliveries ×2`) +6 Vimeo lifecycle +4 access checks. Extra171 covers bounded lookup/error/chunking and closure.
- Provider1240:14 metadata +22 actor POSTs +4 Vimeo GETs +1056 trusted callback reads (`22 ×12 ×4`, including terminal/INPUT/dataset evidence) +44 owned abort/terminal reads. Extra40 covers targeted recovery. The actor budget is not increased by HTTP retry capacity.
- Incoming264 includes up to12 deliveries for every possible actor; no extra callback/security-test batch. DB45 covers parity/preflight/dry-run/push/postchecks/advisors/types, exact selectors/cursor/due-only CAS, per-stage assertions and restoration; extra19 is reserved.
- At most **7 new deliberate native actions /19 cumulative**: four Instagram parents, one Vimeo invocation, one bounded access check and one conditional recovery. Automatic child/callback executions are recorded separately.

Current closed allowance is not new authority. Approval replaces M04 cumulative operation ceilings only as listed above, preserving every historical charge and all other boundaries. Frozen M032078/2000/4078/V358 is separate and untouched. Before each admission reconcile real used counters against this complete remaining envelope, including shutdown. An unmet preflight or exhausted reserve is a stop, not permission for unbudgeted retries.

## Price basis, actual settlement and infrastructure

Use only approved Instagram actor `shu8hvrXbJbY3Eb9W`, retained build `0.0.831` / `yvA3PQRWe95APBdIh`. Verify the exact build/schema/PPE/account pricing within the allocated metadata reads; no silent build/source substitution. Each actual singleton requests30 results and binds `maxItems:30`,1024MiB,600seconds, `restartOnError:false`, and **USD1 maxTotalCharge**. `maxItems` is not independent proof of a raw provider-output limit: oversized output must stop/contain processing at the reviewed acceptance bound, with actual usage reconciled rather than extra scope admitted. Four planned parents are bounded2/2/8/8 starts; the optional one-account recovery is bounded2.

The retained price book is USD1.90/1000 results, valid2026-10-18, consistent with owner-reported Scale. [Current official pricing](https://apify.com/apify/instagram-scraper/pricing) lists Scale USD1.90, Free USD2.70, Starter USD2.30 and Business USD1.50 per1000 result events, with platform costs included. Actual account-tier applicability still requires preflight. Duplicates can bill; terminal measured usage is settlement authority.

| Stage | Requested results | Scale arithmetic | Free-tier sensitivity | Hard actor reserve |
| --- | ---: | ---: | ---: | ---: |
| First account twice | 120 | USD0.228 | USD0.324 | USD4 |
| Other four twice, conditional | 480 | USD0.912 | USD1.296 | USD16 |
| Planned total,20 starts | 600 | **USD1.140** | **USD1.620** | **USD20** |
| One recovery invocation,2 starts | 60 | USD0.114 | USD0.162 | USD2 |
| New maximum,22 starts | **660** | **USD1.254** | **USD1.782** | **USD22** |

Vimeo adds at most5 observations at USD0 official-API fee, for665 requested source observations including recovery (660 Instagram plus5 Vimeo), not a guarantee about raw provider output. Historical four actors/USD0.8395 remain charged: **24 planned /26 maximum cumulative actors**, with **USD22.8395 cumulative actor spending ceiling**. A reserve is not an expected invoice. Unused recovery/conditional capacity grants no expanded scope. n8n/Vercel/Supabase marginal compute/storage and subscription fees remain unknown and separate; no fabricated zero-infrastructure-cost claim. No AI inference/media-worker execution is included, although legitimate ingestion queues remain retained.

## Enforced restriction and missing observations

Automatic approval review rejected a local `exec_command` at CreateProcess before execution: an inline pure-planner command whose sole write was `hc01-staged-live-inputs-20261027.json` in this evidence directory. The fixed reason was **“blocked by policy”**, with no further scope explanation. No process started or file was created, and no alternate-route generation was attempted. That optional JSON artifact is absent; this prose estimate does not recreate it. If that exact artifact is required later, the supported path is approval-policy permission restoration for the named action, not another shell/tool.

Actual HC-01 hosted application, fresh restricted identity, five-account daily/metrics repeat and Everyone page4 source-stop observations remain pending. No native error-execution pairing, pinned/fallback example, complete Instagram history, production pilot or recurring overlap is claimed. Do not manufacture examples or spend unused allowance on collection beyond this packet. M04 stays open and PR13 draft.

## Single exact owner decision

> Approve the HC-01 staged dev packet at the reviewed PR13 head: apply only migration20261027192743; Everyone Vimeo page4/width5; Everyone Instagram posts/reels twice (4 starts), then the other four accounts twice only after Stage1 succeeds (16 further), plus at most one reconciled two-start recovery. Approve22 maximum new starts atUSD1 each/USD22 total,7 new deliberate native actions, new operation limits Management288/Control2376/Combined2664/Vercel64 and cumulative Management482/Control3151/Combined3633/Vercel138. Include the exact protected dev setup, temporary sole/default bypass and required owned callback/log-only-handler publication, recovery, restoration and shutdown. Retain all prior charges, incomplete history and all other scope/security limits. No production, recurrence, notifications, merge or M05.
