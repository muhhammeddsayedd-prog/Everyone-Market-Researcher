# M03 bounded live acceptance packet — current preparation checkpoint

## 19 October: canonical source complete; native staging and live control pending

**HOLD — not an execution approval request.** The current entry point is
`n8n/foundation/build-foundation-gateway.mjs`, with 25 inactive definitions.
[Per-workflow source/readiness](../../../n8n/foundation/README.md) records the
fixed operations, tests and precise remaining native proof for each workflow.
The older outline below is historical and is superseded by this section.

**Latest actual delivery:** sealed continuation from `2865845` completed
native0/child closed with118 management requests,25 verified inactive staged
definitions and25 persisted actual exports,13 tags and one owned Machine
credential. Consumed Management pair deleted; pending Machine remains encrypted
locally. Historical cumulative management requests are188 (2+68+118), not a new
gateway allowance. [Actual completion](inactive-foundation-completion-20261019.json)
records real version IDs/hashes and the24 deferred error links.
`inactiveDefinitionsSaved:true`, `finalGraphsBound:false`,
`errorRoutingAccepted:false`; zero executions/actor calls/window activation.
The older partial delivery description below preserves the preceding failure.

Actual inactive delivery is partial: attempt `44cc22` created and GET-verified
25 owned inactive noOp shells and seven tags, then stopped at tag POST409. It
made 68 requests; the earlier `f20045` made two GETs with no mutations. The
cumulative historical count is 70, separate from each consumer's unchanged
185-request maximum. Both consumed Management pairs were deleted and children
closed. [Actual IDs and partial receipt](inactive-foundation-partial-20261019.json)
preserve all 75 shell events and 15 binding events. No complete graph, Cloud
Machine credential, execution or gateway admission has been saved by those runs.

The [pinned native audit](native-api-contract-audit-20261019.md) identifies native
24-character tag labels, a 16-character credential ID, deterministic Webhook/Wait
routing IDs, draft-only graph updates and published error-handler dependencies.
The three explicit native tag aliases preserve the logical taxonomy and seven
created tags. `EmrM03Machine19` replaces only the invalid pending metadata ID,
retaining the encrypted token. Reconciliation precedes any further mutation.

Inactive delivery must use the explicit `inactive_native_staging` profile:
all nodes and references are saved, but 24 `settings.errorWorkflow` links are
deferred because their WF-90 target cannot pass native validation unpublished.
Each actual export records intended/staged hashes and its deferred target.
`inactiveDefinitionsSaved:true` is not `finalGraphsBound:true` or
`errorRoutingAccepted:true`. No publication is authorized by inactive delivery.

The owner authorized this local completion and safe owned inactive dev
provisioning. No new hosted window, forward migration push, actor start,
multi-workflow execution, production change, merge or M04 was authorized.
GW-01 remains permanently closed: 23 coordinated attempts, 16 gateway SQL
admissions plus one Close. Its unused 77 attempts cannot transfer.

### Source, environments and migration boundary

- Repository/branch/PR: `Everyone-Market-Researcher`, `m03-n8n-foundation`, draft
  [#8](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/8).
- Native instance: `https://muhhammedsayed.app.n8n.cloud`, Personal project
  `pHvQjDmjxVZ3KQLT`, observed runtime 2.43.5, allowance 50K. Existing actual
  provider credential IDs/types remain in `n8n/foundation/bindings.dev.json`.
  No name change, shared credential edit, extraction or duplicate provider token.
- Database: emr-dev / `zmotjsbzhzjvpelxvxlf`, exact session pooler
  `aws-1-eu-central-1.pooler.supabase.com:5432`, database `postgres`, actual
  `n8n_writer` login. Pinned public Supabase CA and ordinary hostname validation;
  no administrator/service credential, SSL bypass or native Postgres fallback.
- The ten previously applied hosted versions/hashes are preserved. These four
  new versions have only local application/test evidence and require explicit
  inclusion in the eventual dev batch approval:
  `20261018231756_m03_actor_launch_admission.sql`,
  `20261018232014_m03_foundation_gateway.sql`,
  `20261018232922_m03_foundation_safety_receipts.sql`,
  `20261018233338_m03_foundation_boundary_hardening.sql`.
  Later versions preserve the successful earlier local applications instead of
  silently rewriting their history. No hosted application was performed.
- Proposed route `/api/internal/n8n/foundation` uses a new protected immutable
  Preview from the reviewed source; production and mutable aliases are denied.
  Actual read-only CLI metadata verified source
  `9719cc849f35f7a0e19dc826a022f4a845192433`, branch
  `m03-n8n-foundation`, project `prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu`, READY Preview
  `dpl_9unUfg4bApFVsuSfzdSEocZ4tKfb` at
  `https://everyone-market-researcher-8f7sa5lox-muhammed-abdelrahman.vercel.app`.
  [CI39177818722](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39177818722)
  passed all five jobs. The connector metadata read returned403; the documented
  scoped read-only CLI fallback supplied the metadata. This public inactive
  delivery packet has `activationAuthorized:false`; runtime secrets, SQL binding
  and admission remain absent. A later runtime delivery creates another exact
  immutable snapshot, which must be read back and bound before any admission.

### Distinct proposed window and hard limits

The new source identifier is `df4f29ec-e2dc-4d82-a276-62a4e695e6f9`. Source creates
**zero** active windows/launch approvals. Owner-only provisioning later binds
the exact reviewed deployment and creates the distinct approval. First admitted
request starts the shared 60-minute gateway/actor-approval clock, once only.
Close is permanent, fences unresolved persistence and clears leases. A cached
grant/status receipt never grants another POST. An unknown original POST ID
stops for reconciliation; absence of an ID does not authorize replacement.

| Resource | Proposed whole-batch limit / boundary |
| --- | --- |
| Gateway HTTP attempts | 200 planned + 56 recovery/shutdown reserve = **256 total**, including retries, replays, rejected auth, status and shutdown; no automatic retry or reset |
| SQL admission | 256 maximum, 30/minute, 500/day and 2 concurrent business leases; one connection per function instance; brief identity/admission connections are separate from executing leases |
| SQL commands | At most 20 fixed bound commands per admitted external-read request; conservative ceiling 5,120 transaction/timeout/SELECT commands for 256 attempts, plus separately enumerated owner setup/readback/Close |
| Native executions | Application stop at **120** coordinated executions; includes child SUB/stubs/callback/error handlers. This is not an n8n provider-enforced quota or a bound on unsolicited incoming webhooks |
| Duration | 60-minute SQL lifecycle; finish planned checks by minute 50, then cleanup/reconciliation reserve; source launch requires at least 6 minutes remaining |
| Actor starts | **2 maximum, sequential**, same fixed actor/build/page; second requires the first registered and processed with actual cost retained |
| Actor runtime | 1,024 MiB, timeout 300s, async `waitForFinish=0`, `restartOnError=false`, zero POST retries |
| Actor input | Exact Everyone About page; Cheerio; depth 0; one page/result/concurrent request; no files, linked content, summarization, sitemaps or llms.txt; zero retries/session rotations; normal HTTPS and robots rules |
| Provider reads | Per normal successful run: original run + INPUT (2 GETs), two terminal samples + third dataset-associated sample (3 run GETs), one dataset GET = 6 GETs/run; budget **32 total** GET attempts including bounded recovery, zero automatic retries |
| Provider callbacks | Success/replay/forgery/race cases explicitly enumerated below; provider webhook retries are separate incoming delivery attempts, not additional actor starts; unpublish the owned callback at shutdown |
| Response/body limits | Incoming gateway JSON 1 MiB; outgoing validated JSON 512 KiB; run GET 64 KiB, INPUT 4 KiB, dataset 256 KiB enforced while streaming before full download; 1 accepted page row, Markdown 8,000/title 2,000 chars |
| Server deadline | 20s whole operation with propagated cancellation; individual provider GET 15s including DNS, no redirects/compression/keepalive/retries, wait for socket closure; function maximum 30s |
| Spend | Request `maxTotalChargeUsd=1` for each actor, application reserve **USD 2 total**. No model, embedding, media or competitor collection; fixed subscription fees stay unknown |

Actor `apify/website-content-crawler` / `aYG0l9s7dbB7j3gbS` is pinned to build
`0.3.99` / `BdKJRCYsnmlzPfH3n`, successful public readback at
`2026-10-18T23:24:21.499Z`, without starting it. The immutable build input schema
was also read to validate its exact safe default fields before any credential
request. The reader accepts only posted constraints plus equal pinned defaults,
then projects the posted fields for registration; arbitrary cookies, headers,
code, URLs and nondefault values are rejected.

[Current Run Actor documentation](https://docs.apify.com/api/v2/actors-runs-post)
documents `maxTotalChargeUsd` across pricing models. Transmitting that option is
not observed enforcement or invoice proof. Authenticated original-run options
must report the exact build, memory, timeout and charge ceiling before processing.
Using the historical Scale compute price, two full 1-GiB/300s limits imply about
0.167 CU; proxy/storage/transfer may add cost. The **USD 2 reserve/maximum request**
is the approval basis, not a fabricated few-cent invoice. A fresh actual price-book
read is still required. A single scoped MCP read failed at OAuth refresh before
SQL; it did not establish current prices and was not retried as a setup loop.

### Exact acceptance cases to execute only after separate approval

The pure `n8n/foundation/materialize-acceptance-case.mjs` supplies finite source
variants for manual cases. Native Manual Trigger has no generic JSON-input
transport in the installed execution tool. The variant inserts one fixed Code
input on the Manual Trigger branch, keeps the graph inactive, disables **every**
Schedule Trigger, retains execution-data restrictions and keeps actor launch
disabled unless an explicit future release option is supplied. It neither saves
nor executes a graph. Smoke materialization requires the actual guarded C999
setup receipt; a matching receipt shape is not proof of hosted ownership.

The recommended 19 source cases cover 15 individual dispatch slots, one unknown
slot, a second direct health call (the health dispatch supplies the first), and
two genuine smoke launches. PM/backfill guards and the Saturday collision remain
exhaustive local/CI checks; individual live dispatches already include both
Saturday targets. The normal-case conservative union is 64 native executions,
55 business operations / 110 gateway attempts, 20 provider GETs and two actor
starts. Automatic error tests, forged/replayed callbacks, setup, additional
incoming webhooks, readback and shutdown consume the separate whole-batch
reserve. These are source upper bounds, not actual executions or provider quotas.
This subset does not prove all five SUBs executed: SUB Ingest and SUB Cost still
need explicit idempotent native cases using the original actual run/item-group
and measured-cost receipts, with no extra actor or invented cost. Their exact
inputs/allocations belong in the final ordered control plan. The second genuine
launch must wait for the first registered, processed and measured-cost receipt;
the source catalog's display order is not an execution script.

Native dependency publication must be explicitly covered by the final decision:
publish log-only SUB Notify first, then WF-90; install the 24 canonical error
links with draft-only PUT; republish SUB Notify and required SUBs/stubs in
dependency order; temporarily publish WF-19 for callbacks. Any WF-00 case variant
must retain all Schedule Triggers disabled. Publication and canonical error-link
acceptance have not occurred. The staged graph PUT uses
`?publishIfActive=false`; pre/post reads are not native compare-and-swap locking.

| Case | Required receipt / stop rule |
| --- | --- |
| First actor run | Guarded C999 fixture only; one distinct item maximum, actual separate run/cost, registered atomic completion; no real seeded account touched |
| Second genuine run | Same natural page identity; **zero new items**, original item/queue count unchanged, a second measured run/cost retained; not a callback replay |
| Callback success/replay | Authenticated registered actor/build/status/dataset/cost; two equal samples 10–180s apart; third dataset snapshot agrees; replay uses durable receipt, no new charge/item/dispatch |
| Forged/unrelated callback | Exact durable `apify_callback_rejected`; bounded run/execution/reason only, no item/account/cost/run-context or notification mutation |
| Registration race | Early unregistered callback safely rejects; original-ID registration/recovery path then processes the same run. Exhaustive race interleavings remain local/CI fixtures; do not buy another actor merely to force a race |
| Interrupted atomic acknowledgement | Fresh status/registry read of the original request/run before continuing; no new business ID, replacement POST, reset or successful-operation replay |
| Error Trigger/cooldown | Exactly four sequential JSON `{}` POSTs to the owned WF-19 callback, no provider ID/token/retries. Validate callback source fails before registry/provider work; correlate each real failed WF-19 execution to automatic WF-90. With a verified clean count/cooldown baseline, third produces one log-only notification, fourth produces none. Nine native executions and nine business operations/eighteen gateway attempts are included in whole-batch caps; a manually mocked handler is not proof |
| Dispatch | Every documented slot to its exact stub; separate Sunday news/awards clocks, both Saturday 04:00 jobs, disabled PM/backfill and one unknown-slot audit; no collector functionality claimed |
| Health/accrual | WF-91 twice, all health keys, Cairo yesterday, stable fixed-fee key/no second accrual, unknown fees preserved, `stats_daily_enabled=false` |
| Privacy/saved state | Sanitized actual exports for all 25, credential references only, retention/progress off; synthetic privacy canary via bounded projected API read, never whole editor/context/Variables/storage |

Use the existing guarded `m03_smoke_setup.sql`, assertion and teardown. Refuse
any different C999, including local TestHouse. Preserve 285 real competitors,
1,754 real accounts, 257 logos and seven exclusions using before/after digests.
Pause/archive only the owned fixture after acceptance; retain and label its
item/raw snapshot/queue/cost/audit evidence. Never delete collected data.

The Error Trigger case preflight must verify zero owned WF-19 errors in the
24-hour count and no claimed/logged notification within six hours. If that
baseline is not clean, stop/wait for review; never delete audit to manufacture
it. Verify the saved WF-19 error-workflow points to the actual owned WF-90 and
retention is off. POST only `Content-Type: application/json` with exact body
`{}` (two bytes) to `/webhook/emr-apify-callback` after the separately approved
temporary native callback publication. Wait for each failure and its automatic
handler before the next POST. Expected audit delta is four `workflow_error`,
one `workflow_notify_claimed` and one `notify_logged`; no actor, provider,
ingest, account, run or cost effect. HTTP failure alone does not prove a native
Error Trigger. These nine executions comprise four WF-19, four WF-90 and one
SUB-NOTIFY; each business operation includes the unconditional status read.

### Shutdown and unknown outcomes — prepared before credentials

Stop new launches at the minute-50 application cutoff or any failed assertion.
Reconcile each original provider ID and its durable SQL status. Up to two abort
operations on those known original IDs may be required by the eventual approved
shutdown plan; no replacement run or new scope is implied. Wait for actual
native execution and owned HTTP completion/cancellation before claiming no
in-flight work: SQL zero leases alone does not prove external socket closure.
Record every owned temporary publication's actual ID/version and pre-window
inactive state in the setup ledger. Restore owned definitions to inactive,
launch disabled and retention off; unpublish **every actually published owned
dependency**, including callback, health, stubs, SUBs and error handler, in reverse
dependency order. A callback-only unpublish is incomplete. Preserve unrelated
workflow state. Close once and verify final saved/publication state through
projected API readback. No recurring schedule is activated.

Remove the dedicated foundation n8n machine credential, owned bypass and
branch-specific sensitive environment entries after use; delete consumed
temporary credentials/private scratch and close children. Clearing a child does
not clear the owner's parent application or password-manager originals. Record
the new immutable deployment snapshots and verify both authentication denial
and closed-window rejection. Deleting project environment entries does not
erase previous deployment snapshots; the permanent SQL fence and credential/
bypass revocation remain necessary. Unknown outcomes preserve ledgers and stop
for exact-ID readback, never an automatic replay or a replacement window.

### Precise remaining prerequisites before this packet becomes approval-ready

1. **Inactive delivery completed:** reviewed native correction/public seal and
   actual continuation `da8fd3` native0/118requests/25staged exports, all13tags/
   oneMachine. Original25IDs/seven tags/failed intents preserved; complete GET
   reconciliation preceded native alias creation. Management pair deleted and
   child closed, pending token retained encrypted. Independent public graph/hash
   verification passed. No further handoff or successful inactive-packet replay.
2. Record exact source SHA, pending migration hashes, actual saved graph hashes,
   inactive flags and current CI/Preview references. The protected source Preview
   is not evidence of an enabled runtime or an open window.
3. Complete the executable live-control plan against supported native execution
   access and the finalized saved graphs, with request IDs/counters and bounded
   shutdown/conditional abort operations. Current source/local coverage does
   not claim a successful live multi-workflow test.
   The inactive All consumer is not a runtime updater: its graph-intent hashes,
   selected audience and Machine body are immutable. It must reject a changed
   runtime packet or canonical graph rather than overwrite/adopt them. A separate
   reviewed finite owned-ID procedure must cover domain/audience rebinding,
   canonical links/manual variants, dependency publication and restoration with
   durable intent and exact pre/post readback. That engineering control and its
   actual supported execution access remain prerequisites; no new credential
   request or broader authority follows from this note.
4. Present the **single final approval decision** covering the exact four dev
   forward versions, fresh protected runtime delivery/binding, distinct lifecycle,
   dev-only restricted runtime credentials and read-scoped Apify token, and the
   above bounded USD 2/two-run batch. Do not request administrator/Writer/provider
   passwords just to reproduce prior successful work or before that decision.

One safe connector metadata read of the known owned WF-99 shell
`qTjioYmBUVMIERVz` on 19 October returned no usable workflow metadata. No execution
was attempted; raw responses were suppressed and no login/discovery loop followed.
Consequently a supported actual manual-execution control with projected completion
and cancellation readback is still an engineering prerequisite, independently of
Management API saves. The public management API does not supply a generic manual
execution endpoint; simulation or workflow access alone cannot replace that proof.

Runtime setup also needs a new immutable Preview **after** its narrowly scoped
environment is delivered. The inactive source Preview above cannot receive later
environment snapshots in place. The final approved setup must read back that new
deployment, update only the owned Machine domain/audience and pending metadata,
recompile/save its exact fixed-route graphs and bind the distinct SQL window to
that deployment before opening admission. This is conditional future setup, not
authority to enable the existing Preview or silently reuse its binding.

The read-scoped provider token is a genuine new transport prerequisite: installed
n8n HTTP/Apify nodes cannot stream-enforce the byte ceiling and the existing native
token must not be extracted. It needs only same-owner Actor-run, dataset and
key-value-store **Read** access, no Actor Run/Write/Manage. Keep resources
restricted; anonymous links or changing shared storage privacy is not a substitute.
Actual authentication to this new reader remains a later bounded check.

The private incident R2 decision is maintained separately outside Git. Its known
set, private-canary capability and horizon **None** are preserved; the earlier
maintenance window is expired. No production remediation is authorized here.
PR #8 remains draft, M03 open, GW-01 closed and M04 unstarted. The 24 October
tooling follow-up and unknown fees remain unchanged.

## Historical outline — superseded preparation and preserved failures

Preparation only — not an approved execution packet. No paid actor starts or
live provider requests were performed by this reviewer. The root agent must
fill exact workflow/binding IDs, final source seals, current hosted price-book
receipt and dollar caps before presenting the executable batch for approval.
This outline does not authorize production, schedules, M04 collection or merge.

## Post-GW-01 draft checkpoint, 18 October 2026

This remains a source-only draft, with no paid execution approval requested.
The bounded connection trial now has actual gateway HTTP identity and one
native n8n HTTP-node identity receipt as `n8n_writer` on emr-dev. Replay,
same-ID/different-args conflict, two concurrent duplicates, status recovery
after two deliberately unknown client outcomes and missing/invalid-auth
denials were checked. The same window is closed, the dedicated bypass was
revoked and both known immutable deployments rejected public unauthenticated
POSTs. The owned canary/machine credentials and temporary handoffs were removed.
The initial owned Environment cleanup failed before confirmed deletion and
GET-only reconciliation still found both sensitive entries. The independently
reviewed one-time ResumeCleanup then verified both entries absent and enabled
false at 10:30:38.409 UTC, preserving the failed intent and readback. All owned
connection-trial closeout is now complete, separate from full M03 preparation.
[Connection trial and closeout](gw01-trial-closeout-20261018.json).

The native n8n Postgres-node certificate-chain failure remains historical and
unresolved. GW-01 was a temporary seven-operation connection exception, now
closed; it does not provide a reusable full-backbone transport. Full manual
workflow completion was not independently classified: only the native HTTP
node's successful typed response is claimed. No actor, model, provider billing,
foundation smoke or production result follows from the connection trial.

The next concrete packet must resolve these technical gates before owner
approval or any paid start:

| Gate | Current evidence | Required next proof |
| --- | --- | --- |
| Full backbone transport | Native Postgres TLS failed; the separately approved GW-01 safe connection trial succeeded and closed | Select and approve any continued architecture scope, then prove verified hostname/chain, actual restricted identity, complete required RPC surface and bounded pooling for that exact route. Do not reopen or repurpose the closed GW-01 window. |
| Durable actor-spend admission | `build-apify-smoke.mjs` generates original-run recovery only; no start POST while admission is absent | Implement and test an atomic spend/window claim plus ambiguity-safe original-run registration before a reviewed actor-launch path. |
| Exact unknown-callback audit | `build-apify-callback.mjs` stops at the missing durable rejection-audit gate | A fixed, durable rejection record and tests proving unknown callback produces no item, run-context, cost or notification mutation. Generic workflow-error logging is insufficient. |
| Live dataset privacy and bounds | The local success path has an unconditional release gate; top-level field selection and post-response byte checks are not streaming/storage proof | Review actual supported native schemas, enforce a real bounded transport and retention/privacy policy, then obtain the first sanitized actual actor fixture under the separately approved smoke. No fabricated live capture. |
| Actual native foundation bindings | Existing provider credential IDs are recorded, but `bindings.dev.json` still has empty workflow/tag maps; generated graphs are inactive blueprints | Create/import only the owned inactive dev graphs after transport decisions, read back exact real IDs/node versions/settings/retention and export credential-reference-only saved JSON. Preserve shared credentials. |
| Settlement, replay and interrupted processing | Local SQL/planner/generator tests and unchanged hosted schema evidence exist | Prove actual callback-before-registration recovery, terminal usage settlement, atomic receipt and interruption recovery with the original actor/run IDs; no replacement actor POST after ambiguity. |
| Full acceptance batch counts and caps | Exact saved graph/request IDs and actor caps remain unset in this draft | Fill all workflow IDs/source seals; enumerate every launch, provider read, webhook, SQL call and n8n execution; read current price/cap support and state the two-run estimate plus hard supported ceiling before a distinct batch approval. |

The proposed smoke uses only the already approved actor on the exact Everyone
about page below, with two sequential runs and at most one distinct new item.
The temporary connection
proposal's USD1 reserve is neither an invoiced cost nor a verified billing cap.
No actor/model calls have been made by GW-01. Unknown fixed fees remain unknown;
the USD25 daily value is an alert threshold. Preserve the existing 24 October
tooling-advisory follow-up. INC-M03-20261018-01 remains a separate production
gate; no private incident content belongs in this packet.

## Prerequisites that must pass before a paid start

1. Confirm intended dev n8n instance/runtime and saved actual workflow IDs;
   preserve every unrelated workflow and shared credential. Use existing native
   Apify/OpenAI credentials by ID without extracting or duplicating secrets.
2. Resolve the restricted `n8n_writer` PostgreSQL certificate-chain failure with
   certificate and hostname verification enabled. Verify direct restricted
   identity and required RPC signatures. Preserve all ten current dev migration
   versions/hashes, including the additive GW-01 migration; do not replay them.
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
