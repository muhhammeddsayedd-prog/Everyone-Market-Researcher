# M04 history capability and completion decision — 27 October 2026

**Local review from accepted head 6dea884. No new collection or hosted change. M04 remains open and PR13 stays draft.** The completed sample and increment remain accepted bounded observations. This review neither spends their unused allowance nor changes any acceptance criterion without approval.

## Result and recommended decision

Everyone Vimeo needs a small, correctly bound continuation, not a provider exception. Instagram has a verified collection path but no retained per-profile history-stop evidence for either pass. Two local completion inferences were unsafe and are repaired below. Neither a higher result limit nor a drained dataset establishes complete January2024 history.

**Recommend HC-01 (pending owner approval):** allow bounded recent Instagram monitoring independently of history for ONLY the five selected dev accounts with verified retained watermarks. Defer only the Instagram-completeness portion of dev AC2 to the named [HC-01-F1 source-capability follow-up](#hc-01-f1--instagram-history-follow-up), recorded as deferred, never passed. Keep January2024 as the history target and preserve incomplete status/cursors. Do not change production AC6, Vimeo AC2, the other criteria, spending or recurring authorization.

The exception is bound to these five immutable selected Instagram identities from [accepted selection at6dea884](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/blob/6dea884e7a0f59bed7067acf34272c6100b3032c/milestones/M04-collectors-vimeo-instagram/evidence/incremental-selection-20261027.json), not whatever a future mutable selector contains. The [accepted final readback](incremental-final-readback-20261027.json) retains a non-null watermark for all five; revalidate identity/state before any future change.

| Company | Exact dev Instagram account UUID |
| --- | --- |
| C000 everyone. | `962c9c7e-aa0f-46ae-911b-3265859e0577` |
| C001 Good People | `bed82782-753f-4ba9-91ca-691ef36f75c6` |
| C130 Bigfoot Films | `46149fb9-8905-4b76-9834-4b38f668a2e2` |
| C270 The Talkies | `2d42d451-ac9a-42ac-a879-8760d63c8108` |
| C226 Big Kahuna Films | `3ca3befa-abe6-4540-a389-0cf16115c581` |

If approved, implement one forward dev function migration for the existing fixed M04 daily selector: active exact-selected Instagram accounts may use their verified watermark despite incomplete history. The general scheduled selector remains gated on completed history; schedules stay off. This intentional fixed-selector-only exception must have regression tests showing general eligibility is unchanged. No new column, actor, credential system or acceptance helper is needed. The migration is NOT created or applied in this slice; all17 migration files/hashes remain untouched.

Retain the joint posts/reels claim and registration barrier, no simultaneous history/daily ownership, monotonic primary watermark, reels watermark preservation, delayed/replayed-callback ownership checks and truthful cap failures. Daily reports must preserve incomplete history/cursors. Recent monitoring means bounded observations, not an assertion that every recent or historical post was seen. A saturated or otherwise unverified daily result still reports incomplete coverage under the existing safeguards.

Exact proposed decision: **“Approve M04 HC-01: permit fixed-selector recent Instagram monitoring for the five watermarked dev accounts while history remains incomplete, and defer only Instagram January2024 completeness in dev AC2 as an explicit follow-up; keep every other criterion, production boundary and live-spending gate unchanged.”**

This decision permits the local eligibility implementation; it does not authorize another live start, production, recurrence, notifications, merge or M05, and does not by itself close M04. Without it, keep the present daily gate.

## Everyone Vimeo: smallest correct future continuation

The accepted continuation execution31176 / parent `74fae456-a34c-4460-a5ea-6ab66ecec431` retained:

- C000 account `985a57dd-7934-422d-9d18-4e8ca59fc197`; competitor `94928d31-8983-403c-bdbd-f5f44613d631`; external user `157330576`.
- Cursor `{endpoint:"users",resourcePath:"/users/157330576",page:4,page_size:5}` in [before-restoration evidence](incremental-before-restoration-20261027.json). Width5 is part of its identity. Using page4 at width20/100 would skip content.
- [Final readback](incremental-final-readback-20261027.json) records restored operational selection at pending/null cursor. This is historical evidence, not a fresh current database assertion. Do not assume page4 is still in the database.

A future approved sequence must freshly verify dev identity, the exact account/owner/path and full operational snapshot, accepted terminal parent/closed registration, last-run binding, and global/linked claim/lease/actor quiescence. If any legitimate newer state differs, stop and reconcile. Restore ONLY the retained cursor with a compare-and-set against that verified snapshot (plus updated_at); do not rewind content, watermark, status or scheduling to manufacture eligibility.

Reuse the existing native manual collector entry for this one UUID: backfill, max_pages1, page_size5, results_limit5, max_actor_starts1 (the existing adapter minimum; this user-profile path starts zero actors and gains no paid-start authority). User-profile official backfill uses no actor fallback. Source-only bound: one intended listing GET, at most four GETs with the existing429 retry policy; at most five observed rows, zero actor starts, official API provider fee USD0. These are NOT whole-session setup/shutdown or infrastructure estimates and are not new live authority.

Interpret the result honestly: paging.next===null or verified descending traversal strictly earlier than2024-01-01 can finish the approved window; another capped page retains page5/width5 as incomplete. Do not extend the old closed three-account/width20 resume packet or add an attempt wrapper. The pure helper's width100 rejection of a width5 cursor is intentional; the existing native path supports the retained width.

[Official pagination format](https://developer.vimeo.com/api/common-formats) and [video listing reference](https://developer.vimeo.com/api/reference/videos#get_videos) describe the provider path. No Vimeo provider restriction was established here.

## Instagram: exact contract, separate passes

The retained [provider preflight](incremental-provider-preflight-20261027.json) pins actor `shu8hvrXbJbY3Eb9W` (apify/instagram-scraper), build `0.0.831`, build ID `yvA3PQRWe95APBdIh`. This slice read that saved contract and current public documentation; it made no authenticated provider request and captured no new source data.

The saved schema accepts posts/reels result types, directUrls, a per-URL resultsLimit (minimum1; no3000 maximum in that schema) and onlyPostsNewerThan. It exposes no older-than or resume-cursor input. Our3000 ceiling, escalation waves, limit_exhausted stop and resume_supported:false are local policy/interface state, NOT proof of a provider-wide prohibition. An absent exposed cursor does not prevent the actor from internally paginating. Do not invent a cursor parameter.

| Pass | What is established | What would establish January2024 coverage or public-source exhaustion | Present classification |
| --- | --- | --- | --- |
| Posts | The pinned input has a lower date filter; current README documents post date/pinned handling. Accepted real rows and captured output were ingested. | Attributable per-profile traversal evidence reaching the cutoff or genuine public-source EOF, bound to this run/build/input and complete output, with no result/charge/time truncation. Because the lower-date filter may exclude older rows, an old row is not mandatory or sufficient. A supported per-profile native log/summary could supply the fact ONLY if actually emitted and retained; otherwise the exact source-stop boundary remains unproved. | Approved runs used a bounded latest limit50. That cap and missing stop evidence explain incomplete acceptance; no global provider impossibility is demonstrated. Local false-completion inferences are fixed. |
| Reels | Same approved build accepts reels and actual reel metadata was ingested. Local normalization enforces the target dates. | Separate reels traversal/stop evidence for each profile, including the effective date-filter behavior or complete public reels exhaustion, with the same identity/output/non-truncation checks. Posts coverage does not prove reels coverage; overlap or aggregate counts do not substitute. | Source-stop and equivalent reels date-filter guarantees remain unproved. The implementation deliberately does not assert reels backfill_done. This is a missing capability/evidence contract, not a documented inability to collect older public reels. |

A successful process plus dataset EOF proves only that captured output was drained. Dataset offset/limit is not a source cursor, and a short per-profile result can have other causes. Larger latest-result captures and repeated identical pages are not completeness evidence. Limits/budget stop semantics must be checked if a future observation is authorized; no pinned-build budget-stop defect was reproduced here. A zero-row result without account evidence also cannot distinguish an empty profile from missing source evidence.

The saved input schema does not expose skipPinnedPosts, although it was used in the reviewed INPUT and current README documents it for posts. There were zero real pinned examples; no build-specific pinned guarantee is claimed. Current documentation/change logs are not immutable proof of this retained build's traversal behavior.

Sources checked locally/publicly: [actor README and date/pinned FAQ](https://apify.com/apify/instagram-scraper), [15October ordering correction](https://apify.com/apify/instagram-scraper/changelog#2026-10-15), [dataset paging contract](https://docs.apify.com/api/v2/dataset-items-get), [run status contract](https://docs.apify.com/api/v2/actor-run-get) and [pay-per-event limits](https://docs.apify.com/sdk/js/docs/concepts/pay-per-event). No broader provider exception follows from these pages.

## HC-01-F1 — Instagram history follow-up

Open source-capability follow-up for each of the five identities above, separately for posts and reels: obtain a supported attributable traversal/stop contract, then prove January2024 cutoff coverage or true public-source exhaustion without result/charge/time truncation. Resolve only with that evidence, or another explicit criterion-level owner decision. It is not a collection order. Before HC-01 approval dev AC2 remains unmet; after approval only this named Instagram portion is deferred, not passed. Production AC6 is not deferred. Do not raise latest limits or repeat paid captures merely to chase this proof.

## Why daily is currently blocked

Both existing selectors require history done/not_applicable: `20261017172937_rpc_pipeline_core.sql` get_due_accounts and the fixed claim path in `20261027092832_m04_collector_product_contracts.sql`. Joint finalization requires BOTH passes' backfill_done. Reels has no verified completion signal, and all five restored operational selections are pending. This is intentional behavior, not a missing credential or an actor-start failure. Do not force done/not_applicable or bypass the claim to run daily.

The present fields can support independent recent monitoring for these already-watermarked accounts: daily false/null reports preserve history/cursor, primary watermarks advance monotonically, reels does not advance that watermark, and the same account claim spans both passes. HC-01 changes eligibility, not historical truth. Unwatermarked accounts and general scheduled selection are outside the proposed exception.

## Concrete local fixes and qualification

1. Removed the normalizer's inference that any old unpinned row in a full result proves history coverage. An unordered capped result can contain an old row while missing newer ones. Both source-order variants now remain incomplete. The pure normalizer's short-post result remains only a provisional candidate; it cannot authorize final completion.
2. Removed final callback inference that resultsLimit>=1500 plus short captured output establishes complete posts history. No current input/output field attests source EOF. Successful ingestion, actual cost, ownership, replay and daily-cap behavior are preserved; final backfill remains incomplete until coverage evidence exists. This is a conservative contract guard, not a new verifier or an acceptance-criterion waiver.
3. Regenerated local WF10/WF11 blueprints through the existing generator; saved native exports and accepted receipts are unchanged. No Vimeo interface defect was found, so no Vimeo code change was manufactured.

Both new regressions first failed against the old inference. Final focused local results: Instagram normalizer48/48 + callback26/26; generated native builder33/33; retained real projected fixtures5/5. Targeted ESLint, root/workspace TypeScript and formatting pass. The public-only local process had no development secrets. Vimeo/source-focused54 tests and query10 tests also passed in the audit; two opt-in query checks were skipped, not passed, and three native-transition probes used an explicitly synthetic page4 envelope around retained metadata. These are not new hosted/provider evidence or a new SQL integration run.

Independent read-only source and policy reviews found no blocking defect; exact recipe bounds, immutable five-account scope and named HC-01-F1 were tightened from review. Indexed tracked-file secret scan reports zero violations.

Changed-head hosted CI is pending; the accepted checkpoint's historical CI is preserved, not attributed to these edits. This slice is held locally to avoid starting a new automatic Preview under the no-activation instruction.

## Closure map and next path

See the updated [criterion map](criteria-mapping-20261027.md) for AC1–AC9. Accepted orchestration, joint claims/settlement, Vimeo daily repeat, fixed automatic error audit, cost, restoration and shutdown remain preserved. The missing native parent/error-execution pairing remains explicitly unproved; no retention/deletion machinery is rebuilt.

| Category | Disposition |
| --- | --- |
| Completed implementation / accepted evidence | Connected collectors/callback/RPC ownership and replay, required real types, bounded history observations, costs and safely closed runtime. Four actors/USD0.8395 and236 selected rows stay accepted. |
| Local fixes | The two unsafe completion inferences are repaired/tested in this slice. No eligibility migration before HC-01 approval. No other defect is asserted from absent examples. |
| Targeted future observations | Everyone exact page4/width5; Instagram joint daily/repeat and a retained recent item metrics update after eligibility qualification; named old-pinned example only if an actual example is available. Native parent/error pairing remains unproved. No repeated collection solely to manufacture a missing fixture. |
| History/coverage decision | HC-01 is recommended, pending. Requiring complete Instagram2024 history instead means first obtaining a supported per-profile traversal/stop contract for BOTH passes; another high-limit capture alone cannot close it. |
| Separate gates | AC6 production pilot and production cost comparison, seven-day recurring overlap, external health email, PR13 merge and M05 remain unchanged. Unsupported fallback/missing source examples remain visible. |

Next path: decide HC-01 once, implement/test its narrow local eligibility change if approved, then prepare ONE separately approved targeted live packet covering Everyone continuation plus the outstanding recent-monitoring observations, setup, provider use, retries, recovery and shutdown. No live request or funding increase is requested by this review. Even with HC-01, the other criteria and separate gates remain open; M04 cannot be declared Done by changing labels.

## Preservation

No hosted request, activation, credential read, migration change or collected-data rewrite occurred. All17 migration files,236 selected source rows, four actors/USD0.8395 and cumulative193Management/775Control/968Combined/Vercel73 (12 native actions) retain their accepted checkpoint values. Counts/runtime state here are reused recorded evidence, not a fresh hosted readback. Infrastructure charges remain unmeasured and separate from actor cost. Persistent encrypted originals, M03, privateR2 and the original worktree dirt are untouched.
