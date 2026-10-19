# M03 foundation workflow source

`buildFoundationGatewayWorkflows(bindings, transport)` is the current preparation entry point. It builds exactly 25 inactive workflows: five SUBs, WF-00/19/90/91/99 and 15 explicit stubs. It performs no network request, credential read, deployment or execution. All generated workflows disable successful/error/manual execution storage and progress storage. GW-01 remains closed and is never an input to this builder.

`bindings.dev.json` retains the five actual provider/role references and records 25 actual workflow IDs and all 13 native tag IDs. The reviewed continuation completed native0/child closed after118 requests and saved/read back all25 inactive staged definitions. Their actual version IDs, intended/staged hashes and deferred-error metadata are exported under `n8n/workflows/`. `transport.dev.json` records the dedicated `EmrM03Machine19` / `httpCustomAuth` reference with `activationAuthorized:false`. [Actual completion](../../milestones/M03-n8n-foundation/evidence/inactive-foundation-completion-20261019.json) is distinct from the preserved [earlier partial inventory](../../milestones/M03-n8n-foundation/evidence/inactive-foundation-partial-20261019.json). Twenty-four error links remain deferred; canonical parity/error routing and live execution are not accepted. Unit tests use synthetic references; proposed release variants stay separate from actual exports.

## Fixed HTTPS transport

`build-foundation-gateway.mjs` compiles a closed list of reviewed legacy database-node definitions into fixed operations on `/api/internal/n8n/foundation`. Final graphs contain no SQL, RPC/schema/role selector, Postgres node or Postgres credential. The old native builders remain local source/contract history, not a runtime fallback. A changed or unknown source query/replacement is rejected at compilation.

The proposed source profile is `df4f29ec-e2dc-4d82-a276-62a4e695e6f9`, with a maximum 256 admitted requests, 60 minutes and two concurrent requests. This constant creates no hosted authority or approval. It is distinct from the closed 100-request GW-01 window; unused GW-01 allowance cannot transfer.

Each fixed operation sends one original request and then one durable status read with deterministic, distinct UUIDs derived from the actual native execution and fixed node identity. There are no automatic HTTP retries. Responses must match the original operation, new window, exact audience, open lifetime and durable-replay marker. Unknown writes stop or reconcile the original registry; they do not get new business IDs. Launch additionally requires a fresh native first-authorization response, equality with its durable receipt and at least six minutes remaining. A cached authorization or status read alone never permits an actor POST.

The protected Preview and new dedicated machine credential are future acceptance bindings. They are not GW-01's removed credential/bypass or either old deployment. The default source has all workflows inactive and both launch controls disabled. The third local-builder argument `{launchEnabled:true}` can materialize a reviewable release graph; it is not approval to save, activate or execute that graph.

## Workflow readiness

Every row below has local source coverage and an actual inactive staged export at `../workflows/<key>.json`; the completion inventory records its exact Cloud ID/version/hash. Live proof in the last column remains pending. All25 Cloud IDs now identify complete-node staged definitions, with one dedicated Machine credential;24 canonical error links remain deferred. Actual probe and GW-01 exports retain their historical scopes.

### Native inactive staging constraints

The installed 2.43.5 API limits tag names to 24 characters and new credential
IDs to 16. The logical platform taxonomy stays unchanged; three native tag labels
use `platform:ig_stories`, `platform:li_employees` and `platform:web_work`.
Seven already-created tags are preserved. The new dedicated Machine's proposed
ID becomes `EmrM03Machine19`; no Cloud credential existed under the earlier
overlong proposed ID. Its pending token is preserved, with a separately reviewed
non-secret metadata transition inside the bounded consumer.

Native saves assign IDs to webhook-bearing nodes. Source therefore pins
deterministic Webhook/Wait IDs, while strict actual projection stays intact.
Graph PUT must include `publishIfActive=false` and use fresh pre/post readback;
it is not an optimistic-locking guarantee.

n8n rejects a changed `errorWorkflow` link to an unpublished target. Canonical
full graphs retain their intended WF-90 links. A separately marked inactive
native staging projection defers only those links; actual staged exports must
record that exact delta and cannot establish error-routing acceptance or full
canonical parity. Publishing the owned log-only WF-90 and installing those links
belongs to the separately approved final live packet. No implicit activation,
workflow recreation or validation bypass is permitted.

| Workflow                      | Fixed operations / behavior                                                                                                                          | Local coverage                                                                                         | Remaining actual proof                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| SUB Start                     | `run.start`; fixed caller/environment, typed platform/mode, stable acknowledgement                                                                   | Legacy input tests plus compiled gateway graph/status tests                                            | Restricted writer RPC through the distinct foundation runtime                     |
| SUB Finish                    | `run.finish`; compares original durable completion before downstream stub dispatch                                                                   | Completion/replay tests, typed graph compilation                                                       | Actual first dispatch and replay suppression                                      |
| SUB Ingest                    | `apify.process`; one original registered account/page, atomic item/account/cost/result/finish                                                        | Existing recovery/atomic tests and compiled transport                                                  | Approved first item, second genuine run adds zero items with separate actual cost |
| SUB Log cost                  | `cost.log`; at most two known actual Apify ledger entries, four safe attribution fields                                                              | Positive actual-entry shape and invalid metadata/provider tests                                        | Idempotent replay of the actual callback cost, not a fabricated row               |
| SUB Notify                    | `error.log` with notify; log only, no delivery credentials                                                                                           | Existing safe input and compiled transport                                                             | Actual audit row, no external notification                                        |
| WF-00                         | Cairo slots and static references; unknown slot uses `error.log`; PM/backfill stay disabled                                                          | Existing schedule/dispatch tests and complete final graph references                                   | Manual slot dispatch readback, including both Saturday 04:00 jobs                 |
| WF-19                         | `apify.read`, two `apify.terminal.read`, bounded `apify.dataset.read`, `apify.process`, `apify.completion.read`, SUB Finish; exact `callback.reject` | Callback/recovery/normalizer tests, all denial branches and ambiguous-write routing                    | Actual webhook, settlement, replay/forgery/race/interruption and atomic receipts  |
| WF-90                         | `error.log`, `error.count` with atomic cooldown claim, log-only Notify                                                                               | Existing error classification and new fixed transport                                                  | Automatically triggered dev Error Trigger; a manual mock is insufficient          |
| WF-91                         | `health.guard`, `fees.accrue`, `health.read`; Cairo yesterday, log-only notifications/stubs                                                          | Existing health/idempotency tests and compiled graph                                                   | Actual repeated accrual and health result; stats flag remains false               |
| WF-99                         | Pre-read original launch, SUB Start, `launch.authorize`, exactly one async native actor POST, `launch.reconcile`, `launch.read`, WF-19 recovery      | Exact build/input/limits, disabled controls, ambiguous POST, original-ID and first-authorization tests | Separate approval and actual two sequential actor starts                          |
| WF-10 / WF-11 / WF-12 / WF-13 | Vimeo / Instagram posts-reels / Stories / YouTube explicit stubs                                                                                     | Existing stub validation, fixed child references                                                       | Actual dispatch only; no collector behavior claimed                               |
| WF-18 / WF-18b / WF-21        | LinkedIn posts / employees / website stubs                                                                                                           | Same local stub/graph checks                                                                           | Actual dispatch only                                                              |
| WF-22 / WF-23                 | News / awards stubs; separate Sunday 07:00/07:30 clocks                                                                                              | Existing schedule/stub checks                                                                          | Actual dispatch only                                                              |
| WF-30 / WF-32 / WF-50         | AI / linker / briefs stubs                                                                                                                           | Existing stub checks                                                                                   | Actual dispatch only; no model calls                                              |
| WF-40 / WF-70 / WF-80         | Removal / publish / alert stubs; publish tags and alert kind typed                                                                                   | Existing stub checks                                                                                   | Actual dispatch only; no media, removal or notification consumer                  |

SUB Ingest uses one atomic bounded processor instead of independently retryable chunks. This is the exact single-page M03 smoke, not a general crawler or a later-collector chunk/outbox implementation. SQL already finishes the parent; completion recovery never issues a replacement finish write. Stored replay receipts suppress downstream dispatch. First-transition delivery to stubs is at least once, not an exactly-once external outbox.

## Actor and ingestion bounds

The disabled async POST reuses existing `Apify account` / `EYmaOt0rd45ysq0J` / native `apifyApi` through HTTP Request Predefined Credential Type. It does not extract or duplicate that credential. Actor `aYG0l9s7dbB7j3gbS` / `apify/website-content-crawler` is pinned to successful immutable build `0.3.99` / `BdKJRCYsnmlzPfH3n`. Public build readback at 18 October 2026 23:24:21.499 UTC had a 1 MiB streaming ceiling and started no actor.

The exact input is the Everyone-owned `https://everyone.film/about-everyone`, Cheerio, depth 0, one page/result/concurrent request, Markdown on, files/linked content/sitemaps/llms.txt/summarization off, zero request retries/session rotations, valid HTTPS and robots.txt respected. Run options are async (`waitForFinish=0`), no restart, memory 1024 MiB, timeout 300 seconds and `maxTotalChargeUsd=1`. Current [Run Actor API](https://docs.apify.com/api/v2/actors-runs-post) documents the charge option; its actual enforcement and eventual invoice are not established by this source. The separate two-run application approval/reserve remains required.

The existing installed native integrations cannot impose a pre-download byte ceiling: pinned [n8n 2.43.5 HTTP parameters](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/HttpRequest/V3/Description.ts) and [execution code](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts) expose no response-byte option. Native [Apify 0.6.10 dataset parameters](https://github.com/apify/n8n-nodes-apify/blob/8edec8b87b811c0e85286b6f56e0124c021e26b5/nodes/Apify/resources/datasets/get-items/properties.ts) offer row/field selection, not byte bounds. That package's helper retries HTTP 429/5xx, including POST, so it is not the bounded launch implementation. Top-level field selection and a post-download size check would not close this gap.

The new server reader therefore requires a separate dev read-only provider token at the next approval boundary. It never extracts the existing n8n token. It uses only fixed `api.apify.com` HTTPS GETs, all-answer public DNS screening with a pinned selected address, normal hostname/certificate validation, no redirects/compression/retry and closed sockets. Limits before concatenation/parsing: run metadata 64 KiB, original `INPUT` 4 KiB, dataset 256 KiB. An external abort cancels the owned request and waits for socket closure; the absolute deadline also bounds DNS/slow streaming. The actor POST itself remains the native predefined-credential request with a 15-second timeout and no retries; n8n does not expose a byte limit for its small run-start acknowledgement. This distinction remains explicit in the live packet.

Registration readback authenticates the exact original actor ID, build ID/number, start time, memory/timeout/charge options and original INPUT. A POST acknowledgement without its original ID remains unresolved and forbids a replacement actor; no candidate is guessed from a time window. Callback processing reads only registered context, obtains two authenticated terminal snapshots at least ten seconds apart and compares the dataset reader's third snapshot against that settled context. The bounded reader projects one exact-page row before n8n receives it; Cloud normalizer Code uses the proven narrow adapter and no global URL constructor. Metadata can never supply arbitrary accounts, datasets, URLs or SQL.

Unknown/mismatched callback paths durably invoke the exact `apify_callback_rejected` audit alias with bounded execution/run-ID/reason fields. They do not ingest, charge, update accounts or notify. Unknown atomic acknowledgements proceed to the original registry/completion readback; no new run, actor or business ID is used.

## Verification and saved definitions

### Local acceptance controls, 19 October

The new `scripts/n8n/foundation-runtime-*` modules pin the actual staged25 IDs,
versions and hashes, validate a future immutable protected runtime readback,
rebind only the owned Machine's domain/auth fields using its retained pending
token and a new purpose-bound Preview bypass, install24canonical error links,
save fixed manual-case variants and restore every owned temporary publication.
They do not replay the completed inactive provisioner or mutate Cloud on import.
The audited minimal publication closure is seven owned dependencies/eight publish
actions; WF00 and WF99 remain unpublished and all schedules disabled. Readbacks
are not CAS. Durable intents and drift checks prevent blind overwrite/replay.

`materialize-acceptance-case.mjs` now includes first-original-run Ingest/Cost
replay A/B and a distinct evidence map for all five SUBs. See
[exact cases and source allocations](acceptance-cases.md).

`scripts/n8n/foundation-execution-control.mjs` uses the installed MCP manual-start
and metadata schemas, fixed saved-case receipts, exact IDs, bounded calls/polls,
full nested upper reservations and durable uncertain-start fences. Its mocks
prove local control behavior only. **M03-C01 remains:** the native save hooks can
remove terminal rows/child metadata under retention-off settings. The controller
rejects absent completion and caller-labelled child IDs. A safe native terminal
envelope is still needed; no broad retention, fake completion or known-failing
paid preflight is accepted. The [single packet](../../milestones/M03-n8n-foundation/evidence/live-acceptance-outline-20261018.md)
contains the four hashes, A-D scope, count ledger and precise remaining capability.
No new handoff or hosted action is requested by this source preparation.

Focused commands, all local and synthetic/localhost only:

```powershell
node --test n8n/foundation/build-foundation-gateway.test.mjs n8n/foundation/build-foundation-completion.test.mjs
pnpm.cmd --filter web exec vitest run server/n8n-worker/apify-reader.test.ts --maxWorkers=1
pnpm.cmd --filter @emr/shared exec vitest run src/n8n-apify-recovery.test.ts
```

CI already discovers `n8n/foundation/*.test.mjs` and web/shared Vitest tests. Tests execute generated Code without a URL global and inspect graph/HTTP contracts. The bounded reader tests use actual local HTTP sockets with injected transport, plus synthetic DNS/abort/provider data. They do not establish live Apify authentication, deployed TLS, actual n8n node execution, saved definitions or final acceptance.

Provisioning must use the reviewed supported API consumer with allowlisted projections, ledger-backed owned IDs and inactive readback. No broad editor/context snapshot, screenshot, autocomplete/Variables-value enumeration, browser-storage read or raw credential-bearing export is permitted. Store only actual read-back sanitized definitions under `n8n/workflows/`; blueprints stay source preparation. Unknown fees remain unknown, the $25/day default remains, `stats_daily_enabled=false`, and the 24 October tooling follow-up is preserved.
