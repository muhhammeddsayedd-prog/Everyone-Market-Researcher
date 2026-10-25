# Remaining M03 dev request allocation after snapshot diagnosis

**Proposed only. Not approved or consumable.** This changes four cumulative request ceilings for the existing remaining A–D batch and its cleanup. It requests no new credential, time window or general development approval.

## Retained actual state

The immutable [technical16 failure](dev-acceptance-technical16-reconciliation-20261024.json), its [cleanup](dev-acceptance-technical16-cleanup-20261024.json), [DB inspection](technical16-postclose-db-readback-20261024.json) and separate native diagnostics remain historical evidence. The original masked reader fault is unknown. UI success and metadata readback do not establish complete native acceptance.

The current charged baseline is **827 Management / 958 Control / 1785 combined / 184 Vercel**, including the first snapshot diagnostic. Three native executions are already reserved/charged; actors and provider reads remain zero. Every later qualified request also stays charged against these same cumulative pools. No record, counter or allowance restarts.

| Pool                           | Charged baseline | Current ceiling | Proposed ceiling |
| ------------------------------ | ---------------: | --------------: | ---------------: |
| Management, including Vercel   |              827 |            1024 |         **1408** |
| Control                        |              958 |            2048 |         **3456** |
| Combined Management + Control  |             1785 |            2560 |         **4864** |
| Vercel, included in Management |              184 |             224 |          **256** |

## Bounded work and capacity

Reserve **up to 160 Management and 160 Control** for remaining forensic reads and exact owned-record cleanup. This includes the category diagnostic charged as request 828 after the baseline below; it is not another pool added after that request. The bounded plan is 100 list calls across all 25 workflows, 25 fresh restored canonical-definition/version guards, 20 exact-ID metadata/body/full reads for the two known executions, 4 DELETE/absence calls and 4 reconciliation calls: **153**, plus 7 reserve. Actual request classification and durable charges govern; unused capacity is not charged or replenished. This reserve grants no deletion while ownership, executed body or settlement is unresolved.

The unchanged full Management plan is **377**, including Vercel:

| Remaining full-batch work                             | Maximum further Management |
| ----------------------------------------------------- | -------------------------: |
| Fresh saved-definition baseline, all 25 workflows     |                         25 |
| Protected dev Preview setup, verification and cleanup |                         44 |
| Runtime setup, including fresh Machine conflict read  |                        110 |
| 24 case drafts, each with fresh GET/PUT/GET           |                         72 |
| Two Machine readbacks                                 |                          2 |
| Restoration, including final all 25-workflow audit    |                        124 |
| **Full batch**                                        |                    **377** |

This is 377, not 376: the second qualified Machine GET remains required. The source calculation is [the existing CLI preparation reserve](../../../scripts/n8n/foundation-live-runtime-cli.mjs), `25 + 44 + 308`, with `308 = 110 + 72 + 2 + 124`. All25 actual restored versions must be qualified; the older two-version override alone is insufficient after technical16.

The full conservative Control capacity is **2238**:

| Capacity retained for the full batch                                                       | Maximum further Control |
| ------------------------------------------------------------------------------------------ | ----------------------: |
| Initial all 25-workflow lists, default/running, at most 2 pages each                       |                     100 |
| Browser-control preflight                                                                  |                       1 |
| 24 manual case preflights × 4;4 error preflights × 2; callback preflights 6+ 3             |                     113 |
| Up to 8 metadata polls × 93 reserved native executions                                     |                     744 |
| One fresh executed-body fence and one full read per native execution                       |                     186 |
| 14 mandatory discovery scans × 8 rounds × 2 filters × 2 pages                              |                     448 |
| One DELETE and absence read per successfully qualified native execution                    |                     186 |
| Existing shutdown floor:120 stops + 120 DELETEs + 120 absence reads + 100 final-list calls |                     460 |
| **Full-batch capacity**                                                                    |                **2238** |

The [native controller](../../../scripts/n8n/foundation-native-controller.mjs) supplies the 8-round observation/discovery bounds, case preflights and 460 shutdown floor; the [reader](../../../scripts/n8n/foundation-native-reader.mjs) limits each list filter to 2 pages. Mandatory discovery covers8 automatic-error root/handler scans, 2 genuine callbacks and 4 fixture scans, including the shared concurrent-pair scan. The [cleanup helper](../../../scripts/n8n/foundation-native-cleanup.mjs) separately admits DELETE and absence requests. The460 floor remains protected before new work even after earlier successful-case cleanup has consumed requests; it is deliberately not treated as a refilled pool.

These are capacities for the enumerated normal path at maximum polling, not a promise that arbitrary unexpected children, incomplete inventories or ambiguous effects become acceptable. Those conditions still stop work and require reconciliation. No extra target case or paid start is licensed by reserve capacity.

| After forensic reserve and full batch | Conservative total | Proposed ceiling | Capacity left |
| ------------------------------------- | -----------------: | ---------------: | ------------: |
| Management:827 + 160 + 377            |           **1364** |             1408 |        **44** |
| Control:958 + 160 + 2238              |           **3356** |             3456 |       **100** |
| Combined                              |           **4720** |             4864 |       **144** |
| Vercel:184 + 44                       |            **228** |              256 |        **28** |

Vercel is already included in Management and is not added again to combined. The proposed combined ceiling equals 1408 + 3456, so both individual ceilings fit together. All consumers must enforce the approved counters reciprocally before each durable intent.

Current limits cannot fit this plan: the full Management plan alone reaches 1204, exceeding 1024 by 180; Vercel reaches 228, exceeding 224 by 4. At 1204 Management, combined2560 would permit only 1356 total Control, leaving 398 from 958—less than the unchanged460 shutdown floor before further case work. Control has only 1090 requests left under 2048, below the 2238 full capacity. Raising only Management/Vercel would conceal these other exhausted boundaries.

## Other limits stay unchanged

- The [pure case plan](../../../n8n/foundation/materialize-acceptance-case.mjs) contains23 recommended cases with 68 native executions reserved. Add 1 domain control, 9 automatic-error executions, 9 for three callback cases and 6 for the concurrent pair:93 further reserved native executions. Retain 3 already charged: **96 of 120**, leaving 24. No acceptance credit is silently assigned to 31130.
- Fresh DB inspection established 9 global SQL admissions. Conservatively treating every one of the existing200 planned gateway HTTP attempts as a new admission reaches **209 of 256**, leaving 47; denials and replays normally admit fewer. The256 limit governs SQL admissions, not a new HTTP allowance. Prior non-admitted HTTP attempts remain recorded.
- Provider planning remains **26 of 32 GETs**:20 selected-case reads, 2 original-group reads and 4 terminal samples, with 6 existing reserve. Native forensic calls consume no provider allowance. No provider or actor use is reset.
- Actors remain **0 used of 2**, sequential, USD 1 maximum each and **USD 2 existing total reserve**; at most 1 new distinct collected item. This request-ceiling change adds **USD 0 provider-spending authority**. No inference, embedding or unapproved collection is added.
- Preserve all 15 existing dev migration versions/hashes, M02 rows/exclusions/logos, audit chains, retention conditions, side-effect IDs and paid-start fences. No migration replay or new migration is included.

## Gates before continuation

The root 31130 executed-body mismatch and complete native settlement are still unresolved hard gates. Exact root/child source, version and parent links must be independently qualified before cleanup; generic diagnostic booleans, UI success, physical child closure or SQL vacancy cannot substitute. Inventory remains GET-only. Any exact native deletion must use the reviewed write-capable consumer, satisfy the existing retention/ownership/settlement conditions, record one durable intent and verify acknowledgement plus absence. A lost acknowledgement is not permission to replay.

All five existing SQL windows remain permanently closed. The sixth UUID `edbc6d11-7c1f-43a7-b745-1ded06deb29f` is local source compatibility only; it has no SQL registration, deployment or admission from this packet. Required cleanup, all 25 restored-version qualification, exact source/CI/Vercel checks, native contract tests, independent review and sealed public preflight precede one remaining bounded A–D batch through the existing owner-only registration path.

Standing M03 authorization permits safely closed failure continuations within this same scope and cumulative capacity. Preserve every prior attempt; do not reopen a closed window, overlap uncertain work, redo completed setup, regenerate launch IDs or blindly repeat a paid start. Technical shutdown reserves/timeouts remain mandatory. Persistent dev credentials and native integrations are reused; actual expiry, revoked access or required MFA/consent remain genuine boundaries.

Production, R2, recurring schedules, external notifications, shared credential rotation, PR #8 merge and M04 remain excluded. PR #8 stays draft while acceptance is incomplete. Approval changes capacity only; it does not claim acceptance, admit a batch or authorize an unresolved unsafe side effect.

Exact owner decision:

**Approve cumulative Management 1408, Control 3456, Combined 4864 and Vercel 256; retain all charges and all other existing limits.**
