# M03 bounded live acceptance outline

Preparation only — not an approved execution packet. No paid actor starts or
live provider requests were performed by this reviewer. The root agent must
fill exact workflow/binding IDs, final source seals, current hosted price-book
receipt and dollar caps before presenting the executable batch for approval.
This outline does not authorize production, schedules, M04 collection or merge.

## Prerequisites that must pass before a paid start

1. Confirm intended dev n8n instance/runtime and saved actual workflow IDs;
   preserve every unrelated workflow and shared credential. Use existing native
   Apify/OpenAI credentials by ID without extracting or duplicating secrets.
2. Resolve the restricted `n8n_writer` PostgreSQL certificate-chain failure with
   certificate and hostname verification enabled. Verify direct restricted
   identity, required RPC signatures and the exact nine dev migration versions.
   Do not replace it with postgres or service-role access.
3. Complete bounded manual GET-only credential probes. Use Apify
   `/v2/users/me/limits`, OpenAI `/v1/models`, official Vimeo and YouTube
   credential checks. Persist only projected non-secret receipts. A provider
   configuration or synthetic test does not establish a successful exchange.
4. Read actual `ops.get_price_book()`, budget, and actor minimum/cap support.
   Preserve unknown subscription fees and the USD25/day alert-default decision;
   do not restart the deprioritized fee questionnaire or alter shared budgets.
   Record the estimate and the exact maximum before AGENTS rule 9 approval.
5. Create/update only the owned inactive M03 dev workflows. Read back their
   native parameters/bindings and export sanitized actual saved JSON. No
   schedules or backfill flags are enabled. The callback alone needs a bounded
   live URL during the approved smoke and must be unpublished afterwards.

## Proposed bounded smoke

The paid scope is **two** sequential async runs of the already approved
`apify/website-content-crawler`: the initial smoke and its required independent
WF-99 rerun. Each targets only `https://everyone.film/about-everyone`, uses
`cheerio`, `maxCrawlDepth: 0`, `maxCrawlPages: 1`, Markdown enabled and the
reviewed Apify proxy setting. No competitor or seeded source is dispatched.
Maximum new distinct item: one. The second run must insert zero new items.

Use the existing guarded setup/assert/teardown SQL for the dedicated owned
`C999 / emr-smoke-test` fixture. Refuse an existing different C999, including
M01's local TestHouse. Preserve the original 285 competitors and 1754 accounts
with before/after catalog digests. Archive/pause only the owned smoke fixture
afterwards. Retain collected items, raw snapshots, queues, cost and audit rows.

Each actor POST is a single attempt with `waitForFinish=0`,
`restartOnError=false`, explicit run timeout/memory/build, webhooks and the
approved per-run `maxTotalChargeUsd`. The dollar values remain **unset** here:
do not guess a minimum or use an estimated few cents as a hard cap. The final
packet must state the two-run estimate, total ceiling and exact bounded GET,
callback, database and n8n execution counts derived from the saved graph.

## Required durable processing order

1. Start once; preserve the returned actual run ID. Register it with the
   trusted single smoke-account context. An ambiguous response stops for
   reconciliation; it does not authorize a replacement POST.
2. Accept only a registered run. An unknown callback produces a fixed audit
   classification and no item/cost mutation. Callback fields cannot supply
   trusted account IDs, actor, dataset, cost or status.
3. Authenticate GET of the registered run; verify actor identity, terminal
   wire status and dataset ID. Normalize only `TIMED-OUT` to `TIMED_OUT`.
   Reread the same terminal run after approximately ten seconds and require
   stable status/dataset/cost. Bound polling; exhaustion leaves pending work
   visible and stops rather than recording a false zero cost.
4. Fetch only that verified final dataset, within the reviewed row/response
   bound. Validate public URL and the narrow normalizer; retain only the
   approved public snapshot shape, never arbitrary crawler headers/cookies.
5. Call the atomic processor: lock registered context, idempotent upsert,
   account result, stable keyed cost, durable saved result, completion last,
   finish only when pending is zero. The same callback replay must return the
   saved receipt with no second cost/item/notification mutation.
6. Recover a callback-before-registration race by checking the original run
   after registration and invoking the same registered processing path. Do
   not blindly retry the unknown webhook or launch another actor.

## Independent acceptance checks

- First actual smoke: success, one item, exact measured actor cost, processed
  registry receipt. Second actual smoke: same natural item identity and count,
  zero new items, one cost entry for each distinct actor run.
- Replay the known callback and send one unknown-ID callback. Verify durable
  duplicate result and unknown audit respectively, with no extra ingestion or
  cost. Do not reuse a forged callback's metadata as trusted context.
- Run the owned force-error branch three times: one notification at the
  threshold. A fourth within the cooldown produces no extra notification.
  Use log mode; no SMTP or external message is assumed authorized.
- Dispatch each documented manual orchestrator slot to its correct inactive
  stub; verify actual execution linkage. Disabled PM/backfill paths remain
  disabled. News 07:00 and awards 07:30 are separate clocks; the logical
  shared schedule contract remains distinct from this native adapter.
- Run WF-91 twice and verify required health keys and one accrual per fixed
  provider/day key; the second accrual adds zero. Stats refresh stays false.
- Keep local, CI, saved native export, credential GET, actual hosted SQL and
  actor/callback receipts separate. Save a sanitized public crawler fixture
  from the first actual run and test its normalizer. Refresh populated dev
  advisors and generated types only for changes that require them.

## Stop and recovery

Stop for strict TLS failure, identity/schema mismatch, missing price/cap,
credential failure, unexpected workflow state, an ambiguous actor POST,
nonterminal/stale usage, unsupported callback branch or any assertion failure.
Reconcile actual registered run/dataset/cost/item history before continuing.
Never replay successful side effects or delete collected data to restore a
clean test. Unpublish only the owned callback when the bounded check ends;
leave WF-00 inactive and preserve owner passwords and unrelated resources.

Local WF19 and recovery-only WF99 generators now have reviewed synthetic tests;
they are inactive source blueprints with explicit blocking gates, not hosted
exports or a complete actor-launch path. Native settlement uses exactly two
GETs ten seconds apart; the separate pure planner allows at most four terminal
observations in180s. Dataset fields are top-level only: the proposed local
path selects url,markdown,metadata,crawl,error to retain associated-URL and
failed-row checks. Raw response/execution-storage privacy and an actual
streaming transport byte bound remain unverified, so its live gate throws.

Before this becomes approval-ready: finish durable spend admission and exact
unknown-callback audit, resolve the separately proposed strict-TLS design,
verify native schemas/bindings and actual output/privacy/transport behavior,
fill exact saved-graph execution/request limits and real host IDs, run the
price-book/cap preflight, seal sources, then obtain distinct batch approval.
The Everyone exact-page adapter does not establish general URL support. No
paid start, architecture approval or hosted acceptance follows from local tests.
