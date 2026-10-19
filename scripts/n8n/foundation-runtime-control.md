# M03 finite runtime transition

This is local source and synthetic verification for a **future separately
approved dev batch**. It does not replay the completed inactive provisioner,
authenticate, publish, execute, deliver a credential or mutate a database. The
existing 25 staging exports and their versions/hashes remain unchanged.

`foundation-runtime-checkpoint.mjs` pins the actual `da8fd3` checkpoint: all 25
owned IDs, version IDs and staging-record hashes, plus the one owned Machine
identity. `createFoundationRuntimePlan({bindings,transport,records,setup})`
rejects changed records or IDs, checks that the existing compiler still produces
their exact staged hashes, then compiles the proposed runtime graphs with the
new immutable audience. Every proposed graph disables every Schedule Trigger.

The future `setup` output must contain exactly: `version:1`, the fixed Vercel
project `prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu`, branch `m03-n8n-foundation`, the
approved 40-character source SHA, deployment ID, immutable Preview audience,
`environment:"preview"`, `readyState:"READY"`, protection
`"all_except_custom_domains"`, `protectionVerified:true`,
`protectionTransportVerified:true` and
`sqlAudienceBindingVerified:true`. The audience must differ from the completed
inactive packet's Preview. These fields are outputs from the future trusted
metadata/SQL setup checks; validating this structure is not itself a deployment
or SQL receipt. The factory deeply freezes the output and the plan. It never
fabricates a deployment ID that cannot yet be known.

## Native path and publication order

The pinned 2.43.5 credential controller supports
`PATCH /api/v1/credentials/EmrM03Machine19`, owner-only, with API/project
`credential:update`. The exact patch has `isPartialData:true`,
`data.allowedHttpRequestDomains:"domains"`, `data.allowedDomains` set to
the new Preview hostname, and a prepared `json` field. The new
`foundation-runtime-machine.mjs` builder uses the **existing retained encrypted
pending Machine token** and a **new dedicated private Vercel bypass** delivered
only inside the future bounded child. Its exact two headers are `Authorization`
and `x-vercel-protection-bypass`; no cookies, query strings or arbitrary headers.
The bearer value stays the same. The native credential is never read with data
or used as the token source. There is no rotation, creation, shared credential
change or second credential-management framework. Metadata GET cannot reveal
or prove the saved domain/header: PATCH/readback is
saved-configuration evidence; actual domain/identity enforcement belongs to the
zero-actor preflight. An ambiguous PATCH stops because metadata cannot establish
its domain outcome.

The retained staging receipt pins creation time but not `updatedAt` or encrypted
data. The first GET must therefore return `updatedAt ===` the pinned creation
time; any later saved edit stops before PATCH rather than adopting an unknown
owner edit. This is a future fail-closed precondition, not a claim that the
current stored domain has been read. Shutdown returns the original **intended**
domain from the reviewed create request and the original bearer-only JSON;
the temporary bypass header is removed in the same final PATCH. No secret-data
GET parity is claimed. Domain rebinding alone would not provide Vercel bypass;
the new preparation port supplies it in the same PATCH, avoiding a second prior
credential edit. The trusted zero-actor protected-runtime readback supplies
`protectionTransportVerified`; full native Machine identity/domain/header
enforcement still must pass before actors. The closed GW-01 bypass is never
reused. Actual private delivery/decryption is a guarded future setup operation;
these source tests use synthetic values only.

The exact seven unique publications are:

1. Save and publish SUB Notify without an error link; save and publish WF-90.
2. Unpublish SUB Notify before changing its settings, install its canonical
   WF-90 error link, then republish it. No execution is allowed during setup.
3. Save the other 23 runtime graphs with their canonical error links, except
   WF-90 itself. This includes all 24 deferred links in total.
4. Publish WF-30, WF-70 and WF-80, then SUB Finish, then WF-19.

Notify therefore has two publish actions and one temporary unpublish. WF-00,
WF-99, WF-91 and the other direct manual children are not published. Native
manual mode loads the first child draft; nested integrated calls load published
children. The seven-workflow closure covers WF-90 → Notify, the manual health
path's nested WF-70/WF-80/Notify, and WF-99 → WF-19 → Finish → WF-30/WF-70.
The guarded zero-actor phase must verify the selected MCP manual-mode contract
before any paid start. This module supplies no native execution/completion API.

Changed error references use the native write-time validation path: readable,
published WF-90, enabled Error Trigger, compatible caller policy. Publish calls
use `POST /api/v1/workflows/{ownedId}/publish` and the exact just-observed
`versionId`; unpublish uses the corresponding `/unpublish`. Every graph PUT has
`?publishIfActive=false`. Public PUT uses native `forceSave:true`, so GET checks
are **not compare-and-swap**. A single-operator window is required. Any observed
version, content, owner/project, tags, active-version or behavioral drift stops
before a write. Settings changes on a published workflow may affect live
behavior; only the explicitly unpublished Notify has settings changed during
bootstrap. Later manual case drafts can change MCP visibility on an already
published dependency; those changes are part of the approved exact case, not a
claim that `publishIfActive=false` makes all settings inert.

## Finite ports, journal and restoration

The new controller accepts `send(method,path,body)`, its separate durable runtime
journal, `prepareMachinePatch({audience,restore})`, and
`admitManagementAttempt()`. Preparation must synchronously return the new
builder's already-built branded exact body; thenables are handled and rejected
without waiting. Arbitrary JSON or header objects are rejected. The trusted
private caller completes purpose-bound DPAPI reads for the retained pending token
and new bypass earlier inside the bounded child, before entering this operation.
The preparation port performs no asynchronous work. The body and private strings are never added to the public
plan, journal, hashes or diagnostics. That admission port is the
batch's shared durable **512 management-attempt** counter, including any other
runtime/control preflight or recovery API requests. Admission and a durable
request row precede every request. Durable mutation intent precedes a write;
only exact GET verification records completion. The transport caller must retain
the existing strict TLS, bounded body, all-address DNS screening, fixed instance,
deadline, no-retry and socket-closure controls. No network transport is started
by importing these modules.

Journal persistence and the shared admission port must synchronously complete
their reviewed full-write/fsync and return `undefined`; thenable/async returns
are handled and rejected before the corresponding Cloud request. The journal is
factory-branded. A same-journal in-process guard excludes overlapping setup,
case, reconciliation and restoration operations. The future bounded private
caller must additionally hold its reviewed cross-process operation lock through
final child/network closure; the in-process guard is not a machine-wide lock.
The journal requires an explicit persistence function (tests supply explicit
fake persistence); no default no-op can authorize a real run. Its mutable rows
are private and only frozen snapshots are exposed.

`materializeFoundationRuntimeCase(plan,caseId,options)` calls the finite reviewed
case factory. It produces a branded immutable draft with `availableInMCP:true`,
exactly one enabled Manual Trigger and other entry triggers disabled. Only this
factory's objects are accepted by `saveFoundationRuntimeCase`; arbitrary code,
graphs and case IDs are rejected. Case saves do not publish or execute them.
Successful exact-GET case receipts are frozen and privately branded;
`assertFoundationRuntimeCaseReceipt` rejects copied/invented receipts and binds
the case ID, workflow ID, saved version and source body hash for the separate
execution controller.
The existing MCP control must independently prove actual execution correlation,
terminal state and cancellation/closure. Retention `none` and an empty execution
list cannot provide that proof.

Lost acknowledgement, timeout or failed post-write verification leaves its
intent pending. Setup, case saves and restoration do not replay it or adopt an
unknown version. `reconcileFoundationRuntimeReadOnly` permits one exact target
GET and reports matching-before, matching-target-unattributed, unknown drift or
unavailable readback. It does not clear the intent or authorize another write.
The independent gateway Close and credential/process shutdown must still run on
this stop path; an unresolved native publication remains an explicit cleanup
failure, never a completed restoration claim.

Restoration unpublishes every actually verified owned publication in reverse
dependency order, restores only changed bodies to the exact 25 original staging
definitions, returns the Machine's domain to its original disabled audience,
then GET-verifies all 25 inactive/unpublished definitions. Restoring an absent
error link sends `settings.errorWorkflow:"DEFAULT"`: native settings merge would
otherwise retain the link. Native cleanup removes that sentinel, and readback
must match the original omission. Unknown concurrent edits are preserved by
stopping; collected data, tags, unrelated credentials and historical exports are untouched.

Restoration creates new native draft version IDs. Original version IDs and
hashes remain preserved in the immutable checkpoint and historical exports;
the controller does not fabricate a return to an old generated version ID.

## Proposed management ledger

For the current 23 recommended cases:

| Operation                                             | Attempts |
| ----------------------------------------------------- | -------: |
| Initial exact 25-workflow preflight                   |       25 |
| Machine schema / GET / PATCH / GET                    |        4 |
| 26 graph transitions, each GET / PUT / GET            |       78 |
| 8 publication actions, each GET / POST / GET          |       24 |
| Bootstrap Notify unpublish, GET / POST / GET          |        3 |
| **Setup**                                             |  **134** |
| Final 7 unpublishes, GET / POST / GET                 |       21 |
| Up to 25 staging restorations, GET / PUT / GET        |       75 |
| Machine restore GET / PATCH / GET                     |        3 |
| **Restoration**                                       |   **99** |
| Final all-25 audit                                    |       25 |
| 23 finite case drafts, GET / PUT / GET                |       69 |
| **Nominal runtime-management upper bound**            |  **327** |
| Conditional preflight/reconciliation/shutdown reserve |      185 |
| **Shared maximum**                                    |  **512** |

Other explicitly proposed runtime checks consume this reserve (for example a
three-request zero-actor control probe makes 330, leaving 182). MCP tool calls,
gateway requests, native executions and provider requests have their own packet
ledgers; none is hidden in this management-only count. Historical foundation
provisioning 188 and the separate private incident's 35 GETs are not replenished
or charged to this new proposed window.

### M03-C01 approved local policy, separate live decision

The owner approved the exact eee9a27 inventory for local implementation, tests
and review. The historical pure proposal remains unchanged. A separate branded
approved-policy factory pins its approval/inventory hashes; this runtime plan
applies21integrated success/error and five manual-root deltas, WF91 overlapping,
progress false, to the existing setup and case bodies. Exact original fields
remain in baseline bodies for restoration. No additional workflow, migration,
publication or save step is added:327nominal/512ceiling. Generated future bodies
carry the approved design; actual Cloud settings remain untouched.

The supported public API supplies native workflowVersionId, but published-child
loading can retain a draft entity version while replacing nodes/connections.
Require fresh draftVersionId==activeVersionId and exact body/source fencing for
every published dependency until its owned executions settle. Mismatch remains
unknown; version alone is not universal executed-body proof.

The packet replaces the old416control cap with a separately proposed2048 budget
for metadata polling, private native-link reads, candidate discovery, exact stop,
terminal deletion and absence verification. Combined ceiling2560, not928.
Both counters and the bounded private execution adapter are now local source;
neither ceiling grants live authority. Native
stop acknowledges canceled state before all work settles. Restore changes saved
settings, not already-running snapshots or existing execution payloads. Unknown
children/providers/cleanup remain pending beyond admission close if necessary;
no physical erasure-by-minute60 promise. See the exact single packet and native
source/reproduction evidence before any future live decision.

The existing execution-controller entry takes `nativeReader`, `bindingFor`,
`settlementReader`, `nativeTransport`, `controlBudget` and complete owned
baseline-ID lists for its private native branch. Compose the real transport
with a closure over `controller.authorizeExecution`: GET only known claimed
IDs, stop only causally owned IDs, DELETE only same-case genuine closures.
Factories perform no network action on construction. The future private caller
must bind reviewed MCP methods, the exact SQL-only read ports and physical
transport counters, hold the existing cross-process operation lock, and provide
synchronous flushed journal persistence. Test substitutes never become live
receipts by matching a JSON shape.

`foundation-native-reader.mjs` enforces8MiB streaming/strict framing, fatal UTF-8,
complete native fields, private sensitive-reflection checks, exact draft/active/
executed body fences and actual parent/child metadata. Its outputs are only
technical metadata and fixed diagnostic failures. Thrown-child discovery uses
the native backlink; automatic errors use fresh actual Webhook trace correlation.
Detached actor callbacks require actual validator/Webhook original-ID agreement
plus authenticated SQL launch/registry ownership. None is sender authentication.

`foundation-native-settlement.mjs` performs fixed parameterized read-only SQL,
checks all derived request receipts and uncleared lease pointers, and validates
the actual original provider registry. Two authenticated terminal observations
at least10seconds apart must agree; the final SQL read compares actual provider
cost using PostgreSQL numeric rounding. No shared workflow Code or rounding
implementation is changed. Waiting/canceled/crashed/unknown, incomplete native
trees, in-flight private ports and unresolved physical sockets do not settle.

`foundation-native-cleanup.mjs` first flushes safe projected evidence and an
exact-ID intent, then requires matching DELETE acknowledgement and subsequent 404. A lost acknowledgement plus404 stays ambiguous with no DELETE retry.
Factory-branded cleanup receipts are tied to the exact closure/native receipt;
copied JSON cannot satisfy the controller's Phase B gate. Both actor cases
require the selected root/child success and four automatic-error groups, all11
records independently settled and acknowledged deleted/absent first.

Five fixed callback cases use only a SQL-confirmed synthetic unknown ID or the
actual processed first original, tiny terminal event/run-ID bodies, fresh trace
and the existing owned callback route. The concurrent pair is actually issued
as two calls; both native traces must map bijectively. Processed no-op races do
not prove first-ingestion contention. The fifth case deliberately withholds an
already privately checked HTTP response to exercise same-ID reconciliation;
it is a controlled response-loss drill, not proof of a real I/O outage.

Credential-free source inventory:

```powershell
node --input-type=module -e "import {foundationRuntimePreparationInventory} from './scripts/n8n/foundation-runtime-plan.mjs'; console.log(JSON.stringify(foundationRuntimePreparationInventory(23)))"
node --test scripts/n8n/foundation-runtime-plan.test.mjs scripts/n8n/foundation-runtime-control.test.mjs scripts/n8n/foundation-runtime-machine.test.mjs
```

The tests use public checked-in records and a fake native service. They cover
native error-target/dependency validation, partial credential merge without
token access, exact restoration, DEFAULT clearing, drift, ambiguous save/PATCH,
durable-write refusal, shared budget refusal, partial bootstrap and unauthorized
case/publication denial. They are local evidence, not current Cloud receipts.

## Pinned primary sources

- [Credential PATCH and partial-data merge](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/controllers/credentials.public.controller.ts), [update DTO](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/%40n8n/api-types/src/dto/credentials/credential-public.dto.ts).
- [Workflow update/publish/unpublish API](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/controllers/workflows.public.controller.ts), [write-time Error Workflow validation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflows/error-workflow-validation.service.ts), [DEFAULT cleanup](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflow-helpers.ts).
- [Manual versus production child lookup](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflow-execute-additional-data.ts), [Execute Workflow mode](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts), [context mode forwarding](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/core/src/execution-engine/node-execution-context/base-execute-context.ts).
