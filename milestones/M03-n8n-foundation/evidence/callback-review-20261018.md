# M03 callback architecture and security review

Reviewed 18 October 2026 against base `dc146f8c41e22f0e2d8624d96d2f5082296ece18` and the current M03 handoff. This is a static review and proposed correction, not a database test, hosted callback receipt or migration approval. No database, hosted/provider, workflow or credential operation was performed for this review.

The proposed correction is sound **only when all persistence for the bounded M03 callback commits in one transaction**. Moving `processed_at` to the end of separate workflow nodes does not by itself preserve counts or make recovery safe.

## Existing behavior that constrains the correction

- `ingest.upsert_raw_items(uuid, uuid, jsonb)` in `20261017172937_rpc_pipeline_core.sql:148` requires the run to be running and the account's current, unexpired claim to belong to it. Its returned `inserted` and `new_item_ids` describe the current invocation. A repeated source identity does not create another shell or queue message, but its earlier insertion count is not returned again.
- `ops.report_account_result(uuid, uuid, text, int, int, text, boolean, jsonb)` at line97 records the first `(run_id, account_id)` result and releases that account's lease. An identical status/count/error replay returns early; a different result is rejected. Cursor/done arguments cannot overwrite the first accepted progress. A retry after a successful report therefore cannot safely start ingestion again.
- `ops.finish_run(uuid, text, text)` at line22 locks the parent, computes persisted account/cost aggregates and returns a summary. An identical final-result replay returns the summary again. Its return value has no first-transition flag, so it does not by itself deduplicate a later notification or sub-workflow dispatch.
- `ops.apify_runs` and `ops.cost_ledger` in `20261017172931_core_tables.sql:491` and `:532` have a run primary key and ordinary cost rows respectively; the M01 ledger has no callback cost idempotency key. The original handoff's `complete_apify_run`/`log_cost` sketches are not implemented M01 guarantees.

## Required corrections before live callback acceptance

| Risk | Concrete failure | Smallest safe correction |
| --- | --- | --- |
| P1: early processed marker | The handoff completes the Apify row before fetching/ingesting/logging. A later failure makes replay stop permanently. | Write `processed_at` only after account effects and cost are durable, in the same transaction. |
| P1: aggregate replay | Chunk1 commits5 inserts; the workflow fails before reporting. Replay sees0 inserts for those5 and reports a smaller `items_new`. Alternatively, a report already committed and repeat ingestion fails because its claim was released. | For M03's one-account/one-page bound, fetch/normalize outside SQL, then atomically ingest, report, log cost, persist the stable receipt and complete. Do not reconstruct prior counts by summing current replay results. |
| P1: concurrent check-then-act | Two callbacks both see unprocessed and enter separate node sequences; row deduplication alone does not serialize account reporting or cost. | Serialize the atomic processor with database row locks and reread the processed state after acquiring them. A replay returns the saved receipt with `updated:false`. |
| P1: webhook metadata spoofing | A caller supplies a registered ID but changes `emr.account_ids`, parent run, platform, actor, status, usage or dataset. Existence of that ID is insufficient if the remaining body is trusted. | Treat only the validated run ID as a lookup hint. Use immutable registered context and the authenticated Apify run response; compare the response ID and canonical actor identity, require a final status, and fetch only its default dataset. |
| P1: acknowledged but lost work | Returning200 before processing means Apify will not retry an internal downstream failure. The real callback can also arrive before registration. | After the start response is registered, the collector must reconcile that known returned run ID independently of whether its webhook was accepted. Unknown callback IDs must never create registrations, launch actors or trigger speculative dataset reads. Persist/recover registered unprocessed runs; do not rely on delivery retries after200. |
| P1: cost replay | Retrying an ordinary ledger insert double-charges the internal ledger even though Apify ran once. | A stable database-enforced cost identity, for example provider/category/Apify-run/account, inserts once and rejects differing values under the same identity. M03 has one account, so its one cost row must equal the verified usage total exactly. |
| P1: premature or repeated finish | `pending=0` can be true before a collector finishes registering later actor runs; a finish summary replay can emit repeated effects. | Enforce exactly one actor registration for M03 and finish from persisted state within the atomic processor. Return/store `finished_now` and do not dispatch on a duplicate result. A launch-closed barrier is required before later milestones permit multiple actor runs per parent. |

## Recommended bounded contract

Add `ops.process_apify_run(p_apify_run_id text, p_status text, p_dataset_id text, p_usage_usd numeric, p_groups jsonb) returns jsonb`, preserving the existing M01 RPC signatures. This is a proposed M03 contract; its implementation and tests still need review.

1. Parse bounded inputs before writes. Locate the registered parent, lock the parent first and the registry row second, then recheck their immutable binding. Keep this lock order consistent with registration/completion. The parent lock also makes later aggregate/finish decisions serialize.
2. Require the registered M03 actor and exactly one `website_work_page` account belonging to that parent; require the correct environment/purpose and current claim. Unsupported platforms, extra accounts, duplicate registrations with changed bindings, oversized or malformed groups fail closed. A successful empty result still supplies one explicit group with zero items. The smoke test's dedicated account must have a legitimate live claim; an arbitrary account UUID is not a claim.
3. Compare the authoritative final status/dataset/usage supplied by the verified caller with the registered identity. The SQL processor cannot attest that an HTTP response was authenticated; that remains an explicit workflow boundary. No HTTP operation belongs inside this transaction.
4. On the first attempt, invoke the existing ingestion and report primitives, write the keyed cost, and persist a stable `ops.apify_runs.processing_result` JSONB receipt. Include counts, new item IDs, account outcome, final metadata, cost identity and a deterministic normalized-input/contract digest. Failure rolls all of this back, including queue sends.
5. Complete the Apify row last. A standalone `complete_apify_run` call must not be able to bypass the processor and mark an unpersisted result processed. Prefer a guard requiring its matching persisted processing receipt; granting an unguarded completion primitive would leave the original failure path available.
6. A processed replay returns the saved aggregate rather than invoking ingestion/report/cost again. A conflicting replay is rejected without changing the first receipt. A lost success response can therefore be reconciled accurately.
7. Finish only from persisted parent/account/registry state, with no outstanding registered work and M03's single-registration guard. Derive success/failure from those persisted outcomes, not the callback body. A retryable verification/network/persistence failure must not be blindly routed into a terminal parent failure that would fence all later recovery.

This avoids a new chunk-receipt framework for the one-page smoke path. Later multi-page/multi-actor collectors must add their own durable chunk/dispatch barrier design before extending this bound; they cannot inherit an exactly-once claim from the smoke test.

## Notifications and recovery boundary

For M03, `SUB · Notify` remains log-only and later collector/AI/publish paths remain stubs. Any logged notification still needs a stable event key and insert-once behavior if acceptance counts it. A `finished_now` flag prevents ordinary duplicate dispatch, but a crash after committing that flag and before the downstream action can lose the action. Real external notifications or later job dispatch require a durable keyed outbox/claim-and-ack path; do not describe a returned boolean as exactly-once delivery.

The post-registration recovery uses the run ID returned by the original start call and must not launch another actor. An ambiguous start response must be reconciled separately rather than retried blindly. An immediate200 unknown callback can be dropped safely only because that independent registered-run recovery exists; it is not itself proof that the later callback was processed.

Apify's current official [webhook actions documentation](https://docs.apify.com/integrations/webhooks/actions) says non-2xx responses receive bounded exponential retries, requests time out after two minutes and duplicate deliveries can occur. It recommends immediate acknowledgement plus an internal queue/recovery mechanism for long work. Its [Get run endpoint](https://docs.apify.com/api/v2/actor-run-get) and [dataset-items endpoint](https://docs.apify.com/api/v2/dataset-items-get) support the authenticated re-fetch path; no such provider call was made here.

## Required evidence for the implementation

- Local database tests: fail after ingestion/report/cost but before completion and prove complete rollback; lost-response replay preserves original counts/IDs/cost and creates no new queues; conflicting replay is rejected; concurrent calls produce one persisted result; direct premature completion is denied.
- Identity/authorization cases: registered ID with spoofed metadata, wrong actor/dataset context, unsupported branch, extra/unclaimed account, expired/newer claim and non-final actor status perform no persistence. Denial SQLSTATEs and boundaries must be asserted explicitly.
- Recovery cases: callback before registration, callback lost after200, failure after registration and collector recovery with the original actor-run ID; none may relaunch the actor.
- Finish/effect cases: exactly one M03 registered run; replay does not add account/cost/notify rows; finishing derives counts from durable receipts. Multi-actor support remains explicitly deferred.
- Hosted smoke proof remains separate: direct restricted `n8n_writer` credential, actual deployed workflow exports, verified Apify response/dataset, callback and replay receipts, native completion and cleanup. Local fixtures or pgTAP do not establish that hosted journey.
