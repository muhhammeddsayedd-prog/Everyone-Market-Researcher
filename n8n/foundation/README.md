# M03 native workflow preparation

These modules build **inactive native JSON blueprints**, using the observed
n8n 2.43.5 node versions and pinned official source. They do not call n8n, run
SQL, authenticate providers or write actual exports. The actual capability
probe is recorded separately in M03 evidence. That original unused probe was
archived without execution; later credential checks have their own receipts.

- `buildCollectorStubs`: the 15 named T8 collector/AI/publish/alert stubs.
- `buildSharedWorkflows`: Start, Finish, bounded atomic Ingest, keyed Log cost
  and log-only Notify.
- `buildErrorHandler`: WF-90, safe classification and six-hour log-only
  notification claim.
- `buildOrchestrator`: WF-00, all Cairo clocks, static child references and
  disabled PM/backfill gates. The workflow remains inactive.
- `buildHealthWorkflow`: WF-91, Cairo-yesterday accrual, checked health output,
  log-only notifications and publish/alert stubs. Stats refresh fails closed
  while its later RPC is unavailable.

Full WF-19 and WF-99 workflows remain incomplete. The readback component and
launch descriptor below are source preparation, with explicit remaining gates.

## Binding and output boundary

Every builder accepts a manifest validated by
`packages/shared/src/n8n-bindings.ts`: fixed dev instance/project/runtime,
canonical workflow and tag names, actual non-secret reference IDs, and logical
credential references where needed. Credentials retain their actual ID, display
name and type: native `apifyApi` and `openAiApi` use predefined HTTP authentication;
existing Vimeo/YouTube Header Auth stays `httpHeaderAuth`. Do not rename,
duplicate or convert native credentials to satisfy a canonical display name.
No production bindings or credential values are accepted. Schema validation
does not establish that a reference exists on the server; actual UI/API readback
must supply and verify those IDs. Synthetic IDs occur only in unit tests, never
in prepared import artifacts.

There is no real `bindings.dev.json` yet. Do not invent one to get a build.
These are preparation functions, not a deployment CLI. Native API deployment
must project the allowed API request shape and apply tags separately as required
by the pinned API; do not blindly POST this blueprint wrapper. Save only actual
changed, read-back hosted workflow exports under `../workflows/`.

## Temporary credential probes

`buildCredentialProbe` creates separate manual-only, inactive probes for the
five logical credentials. The files in `prepared/credential-probe-*.dev.json`
contain the authorized credential references supplied by actual UI readback.
They have no saved workflow IDs and are prepared imports, not hosted exports.
The explicit temporary-probe exception omits WF-90 routing and external
notifications; it does not close a foundation acceptance criterion.

Each execution permits one identity SELECT or one fixed metadata GET, with no
automatic retry. HTTP requests use a 60-second timeout, certificate verification,
no redirects and no body. The final Code node emits only fixed verification and
failure flags. A workflow that continues after a native error can show Success
while its receipt says `authenticationVerified:false`; inspect the receipt.
Postgres additionally requires both native identities to be `n8n_writer` and
database `postgres` on PostgreSQL 17. That identity alone does not attest the
saved host/project, which must be checked separately.

Apify uses authenticated [`/v2/users/me/limits`](https://docs.apify.com/api/v2/users-me-limits-get)
because the full profile endpoint can return a proxy password. OpenAI reads
`/v1/models`; Vimeo and YouTube read the fixed public account/channel metadata
endpoints from T3. Their projected results contain no profile, model list,
financial metadata, response headers or raw error text. These probes do not
start actors, call inference, collect content or establish a project spend cap.

## Source-only Apify slice

`packages/shared/src/n8n-apify-contracts.ts` is also exported through the shared
package index. It validates the notified run ID, the registered single-account
smoke context and the authenticated terminal response. Callback-supplied
accounts, actor, dataset, status and cost are discarded. Only the documented wire
status `TIMED-OUT` is mapped to SQL `TIMED_OUT`; intermediate statuses and a
missing `usageTotalUsd` fail closed. Anonymous run reads can omit that cost.

`settledTerminalRun` requires two matching snapshots at least ten seconds apart.
This follows the provider's settling guidance; it does not guarantee that a
provider can never adjust billing later. `smokeLaunchDescriptor` describes one
async POST with `waitForFinish:0`, explicit build, timeout, memory, ad-hoc webhook
and a supplied two-run cap policy. It makes no request and always reports
`spendAdmissionVerified:false`. A nonblank reference or an `approved:true` field
is not owner approval. Verify the actual actor build, cap support/minimum,
current price book, total ceiling and durable run admission before any paid use;
the descriptor does not invent those facts or replace an ambiguous POST.

`buildCallbackReadbackComponent` emits native nodes for notification validation,
registered-run lookup and one authenticated first terminal GET. Its output is a
component with `runnableWorkflow:false`, not a runnable WF-19 export. Unknown
runs stop before provider reads. Already processed runs stop for the still
missing saved-receipt replay branch. The component does not ingest, log costs,
complete a run or claim callback acceptance.

The remaining full-workflow gates are:

- Native webhook/response contracts and the required durable
  `apify_callback_rejected` audit path. The current generic logger produces a
  different action and is not substituted as AC7 evidence.
- A bounded delayed reread, saved-receipt replay and bounded dataset projection
  wired to the verified exact-page adapter below. The general URL parser has no
  Cloud runtime pass.
- Atomic persistence/finish wiring, original-run registration-race recovery and
  the reviewed paid batch admission. No automatic POST retry is permitted.
- Strict restricted Postgres access, actual saved bindings/exports and native
  end-to-end verification.

## Safety corrections

Start has no automatic retry because the existing M01 `ops.start_run` inserts
a new run on every call. A lost response requires reconciliation. Notification
claims also have no automatic retry because a second claim can return zero
after a successful but unacknowledged first claim. Keyed cost logging and
atomic receipt persistence retain their idempotent boundaries.

Ingest wraps `ops.process_apify_run` for the one-account, one-page M03 dev smoke
contract. It does not split ingest/report/cost/completion into independently
retryable nodes. It cannot prove that the caller authenticated Apify readback.
Later collectors need their own durable chunk/dispatch design. Log cost accepts
only `meta.cost_key`; arbitrary request/provider context is rejected. The atomic
processor and fixed-cost accrual create their own reviewed database metadata.

Finish with a completion reads its saved registry receipt and compares all
durable fields; a matching first-transition receipt permits downstream stubs.
A replay receipt with `finished_now:false` does not dispatch. Supplying the same
original first receipt again is still an at-least-once delivery boundary;
neither a flag nor a sub-workflow call is an exactly-once external outbox.

WF-90 maps only known source workflow IDs and drops raw messages/stacks. Normal
errors use the actual originating execution ID. Trigger/activation errors lack
that ID; they use `handler-<actual error-handler execution ID>` and node
`Trigger activation`, explicitly identifying handler correlation. No parent
run ID is guessed or terminally failed from unverified payload data. Manual
Error Trigger mock data does not prove automatic error routing.

The native schedule uses separate Sunday 07:00 news and 07:30 awards triggers,
avoiding an assumed 30-minute Wait inside a 15-minute workflow. Manual `news`
tests WF-22; manual `awards` tests WF-23. The shared logical planner still
records a 30-minute delayed awards call. One daily 04:00 trigger lets the Code
adapter select both LinkedIn and Saturday removal without duplicate dispatch.
PM/backfill nodes and Config flags remain disabled regardless of database flags.

## Targeted local checks

`bindings.dev.json` contains the five actual, reviewed dev credential bindings.
It intentionally has no invented workflow/tag IDs; it is not a full deployment
manifest. Builders requiring foundation references continue to fail closed.
Saved settings, successful provider metadata and strict native database login
remain separate evidence in M03 progress.

```powershell
node --test n8n/foundation/*.test.mjs
pnpm.cmd exec vitest run packages/shared/src/n8n-bindings.test.ts packages/shared/src/n8n-apify-contracts.test.ts
```

The foundation package's `test` script discovers its local tests. CI's unit job
already includes `n8n/foundation/*.test.mjs`, so the credential-probe and Apify
preflight regressions run with normal PR CI; these tests make no API calls.

The tests execute generated validation/dispatch Code and inspect native graph,
mapper and query contracts with synthetic inputs. They do not execute the real
Postgres, Set, Switch, Schedule, Error Trigger or Execute Workflow nodes. Hosted
import, references, TLS, RPC login, callback, automatic errors and actual child
dispatch remain separate M03 acceptance gates.

## Observed Cloud normalizer boundary

The archived temporary runtime probe has three saved manual executions. Global
URL parsing and both `url`/`node:url` constructor imports failed. Crypto SHA-256,
Buffer, TextEncoder and the common helpers passed. Its native success status
means the diagnostic returned fixed booleans; the general website normalizer
did not pass. The original diagnostic's incorrect 33-character expected item
ID is preserved separately and was corrected before the follow-up.

`normalizers/smoke_website_m03.js` supplies a separate exact-page adapter for
`https://everyone.film/about-everyone`. It rejects every nonexact requested URL
and permits associated URLs only from the explicit Everyone root/about list.
It adds no parser, shim, dependency or security exception. Compose its factory
with the shared `validateSmokeWebsiteRow`, `buildSmokeWebsiteSnapshot` and
`invalidWebsiteRow` function declarations; omit the local CommonJS export blocks
from pasted Code. The adapter preserves the existing ten-field snapshot, caps,
SHA-256 identity and `smoke_website_stub.v1` output contract. The same reviewed
source passed one Cloud execution with synthetic public input and six fixed
positive/denial/bounds booleans; 21 local adapter tests and the existing 103
normalizer tests pass.

The generic `prepare_ingest_groups.js` helper still uses a URL constructor. The
native SUB Ingest builder does not call that helper: it validates bounded JSON
and submits the atomic RPC. Neither this distinction nor the exact-page probe
establishes native database execution, real actor capture or full callback
acceptance. The three `M03-runtime-capability-probe.*.dev.json` files are actual
temporary probe exports, kept inactive and archived with recoverable history.
Their default saved settings are diagnostic evidence, not foundation settings
acceptance. See the milestone's `runtime-capability-20261018.json` receipt.

## Local callback and original-run recovery

`packages/shared/src/n8n-apify-recovery.ts` is a pure, dependency-free runtime
factory after TypeScript erasure. Generated Code uses that same factory; local
tests cross-check its terminal projection against the existing Zod contract.
It validates the single registered M03 account, exact normalized page, delayed
cost settlement and complete atomic SQL receipt. It performs no requests,
timers, database calls, actor launches, audits or notification delivery.

A processed registry returns its saved receipt with both transition flags false
before any provider read. An ambiguous atomic response requires actual registry
readback. A saved-only result suppresses dispatch and explicitly reports
`payloadEqualityVerified:false`: the PostgreSQL JSONB digest establishes the
saved receipt, but it cannot independently prove the attempted groups matched.
An observed native SQL receipt must match that durable receipt before its first
transition can remain eligible for downstream stubs. SQL already finishes the
parent in the atomic transaction; recovery never issues another finish write.

Registration recovery uses the original returned actor-run ID and the known
parent/account context. It can describe registering that same original ID after
a proven absent readback, or processing an already matching registration. An
ambiguous actor POST without its original ID stops; it never launches a
replacement. This handles the callback-before-registration race through
collector recovery, without trusting metadata from the rejected webhook.

The pure settlement planner allows at most four terminal observations within
180 seconds. The native callback blueprint deliberately uses two authenticated
GETs separated by a ten-second Wait and stops if cost or identity changes.
Neither a stable pair nor local tests establish final provider billing forever.

The new callback/smoke builders produce inactive source blueprints only. Real
workflow/tag IDs remain required. WF99 is recovery-only while durable spend
admission is unavailable. Unknown callbacks stop at the missing exact rejection
audit gate; a generic WF90 error is not that audit. The success dataset path has
a throwing release gate until actual actor output and execution-storage privacy
are reviewed. Its top-level projection and post-response byte check do not prove
a streaming transport bound or that raw nested metadata contains no secrets.
Webhook, Wait and Respond node versions have pinned-source provenance, separate
from actual native import/execution verification. No foundation export, actor
execution, complete callback acceptance or AC7 pass follows from these builders.

Focused local checks (synthetic input only):

```powershell
pnpm.cmd --filter @emr/shared exec vitest run src/n8n-apify-contracts.test.ts src/n8n-apify-recovery.test.ts
node --test n8n/foundation/build-apify-callback.test.mjs n8n/foundation/build-apify-smoke.test.mjs
```
