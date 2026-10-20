# M03 finite dev acceptance packet — 19 October 2026

## Current decision: A–D dev batch approved on21October2026

The owner approved this exact packet at reviewed PR8 head
`f42930f90c2de43c84f61ad6d966d0ee6074d70e`. Its immutable Git-blob SHA256 is
`009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712`;
[the authorization record](dev-acceptance-authorization-20261021.json) preserves
the caps and exclusions. No repeat general dev/batch approval is needed.
Concrete setup/runtime consumers and purpose-bound delivery were missing from
the earlier source factories and are completed under this approval, with
review/local checks before any private delivery or hosted action. Their local
results do not establish PhaseB or actor acceptance.

The runtime512 maximum is unchanged. The concrete allocation is now
**332n8n +45Vercel planned =377, with135reserve**: the prior327n8n plan plus
three saved domain-probe draft operations and two exact Machine-metadata reads
before the two conditional actor starts. Vercel's own subcap50/reserved cleanup
is inside512. Its CLI transport disables auxiliary account/auth/update calls,
retry and redirects; one counted attempt permits one exact API request.
The special native domain control uses the existing one-record reserve within
120; it does not add a business case or raise any batch limit. Direct provider
verification is capped10, plus22 reserved workflow/original acquisition reads,
inside32total. The shared control2048/combined2560 remains unchanged.

[Exact credential-delivery commands](dev-acceptance-handoff-20261021.md) are
provided only after the concrete consumers/public seals pass review. Historical
preapproval statements below remain the reviewed19October design context; they
do not reopen the approved decision. Production, PRmerge and M04 remain excluded.

## Reviewed19October policy and packet context

**Policy decision resolved:** the owner approved the exact temporary dev
retention inventory at `eee9a277c6a7d63fffe967811c92a7fd50c15b14` for local
implementation, tests and review. That approval accepts the storage/privacy
exception below, not this live batch. The private reader/controller/cleanup
implementation uses that approved policy. No Cloud retention setting or other
hosted state has changed. The single remaining owner decision is the complete
bounded A–D batch below, after its final local review and normal PR CI.

The pure `scripts/n8n/foundation-retention-proposal.mjs` inventory pins the
existing 25 actual IDs, versions and record hashes. It performs no writes.
[Exact approved design ID/version/hash and field inventory](m03-c01-retention-proposal-20261019.json).
The original pure proposal remains historical (`approved:false`); the separate
branded approved-policy factory pins its file/canonical hashes and approval SHA.

| Exact owned set | Approved design field change; future live application only |
| --- | --- |
| WF-00, WF-91, WF-99, SUB-INGEST, SUB-COST (five manual roots) | `saveManualExecutions:false` to `true` |
| All pinned25 except WF-00, WF-99, SUB-INGEST, SUB-COST (21 integrated/error-capable graphs) | `saveDataSuccessExecution:'none'` to `'all'`; `saveDataErrorExecution:'none'` to `'all'` |
| All25, with WF91 in both sets | Keep `saveExecutionProgress:false`; preserve every other retention mode |

Union25, not26. No instance defaults, shared workflow, new wrapper, migration or
credential change. Restore all four retention fields to their exact baselines
through the existing runtime restoration. Seven dependency publications/eight
actions and all disabled schedules remain unchanged. This is not authorization
to save those proposed settings or request credentials now.

**Accepted retention boundary; live application still pending:** this native policy stores full
intermediate inputs/outputs, workflow snapshots and errors, including the owned
public-page item and gateway responses. It is not metadata-only storage.
Response/error reflection can retain credentials; source review cannot promise
their absence. A safe final node/read-time redaction cannot sanitize earlier
stored data. Webhook input headers/bodies may persist before validation,
including unsolicited deliveries; workflow-level retention cannot select only
batch IDs or allowlisted stored fields. Current retention-off is terminal retention off, not proof that
transient initial/waiting payloads are never written.

The bounded exact-ID private API reducer handles full data in private RAM, never
raw model-visible exports/logs. Its fixed full-response streaming refusal ceiling is8MiB; oversize,
dataTooLargeToDisplay, incomplete JSON or unavailable native fields stays unknown.
Local fixtures exercise realistic one-page maximum/nested/failure data under
that fixed ceiling; do not silently increase it or bypass native
data-size protection. Emit only native identity/version/mode/status/times and known
ExecuteWorkflow subExecution where produced and each child's native parent link.
Thrown child failures can omit parent-side subExecution metadata; use bounded
discovery plus the child's native parentExecution and exact case/body binding,
not an invented reciprocal edge. Require every expected
child, separately settled provider/SQL work and closed transports. Unexpected,
missing or unlinked error children remain unknown; an empty scan is not proof
that asynchronous error dispatch drained.

Delete only exact owned causally bound temporary native execution records that
are terminal AND independently settled (children/provider/SQL/transports),
require matching acknowledged DELETE and absence read. A lost DELETE ack plus404
does not prove blob cleanup. Keep application/provider data and journals.
Restoring settings does not change captured running settings or erase records.
The60minute window bounds admissions/operations, not guaranteed physical erasure;
unknown work may leave retained data pending cleanup beyond it. Native120 is an
application admission ceiling, not a provider-enforced webhook retention quota.

Future Cloud zero-actor checks must first prove native version/terminal/child
coverage and synthetic success/error/header-reflection privacy. Any reflection,
missing signal, extra child or ambiguity stops before paid work. Local source,
mock-port and actual isolated engine evidence remain distinct in
[the native-interface record](m03-c01-native-interface-20261019.md).

### Resolved historical capability constraint

The earlier retention-off controller could not reliably read native terminal/
child-link evidence. The approved temporary retention design and private native
reader address that source capability; no further wrapper investigation or
repeat policy approval is requested. Actual Cloud support/permissions/privacy
remain guarded zero-actor checks in this batch. New deployment identity,
credential delivery, fresh price read and runtime checks are future setup
outputs, not requirements to have an already-enabled environment today.

At the19October checkpoint no credentials were requested. No Cloud migration, runtime activation,
publication, execution, actor/model call, production mutation, notification or merge occurred.
GW-01 remains closed. PR8 stays draft; M03 open; M04 unstarted.

### Completed checkpoint and local implementation

- Preserve actual25 inactive staged definitions/exports and their exact IDs,
  versions/hashes,13tags, `EmrM03Machine19` / `httpCustomAuth`, encrypted pending
  token and24deferred error links. Nothing is recreated or re-exported as a live
  result. Historical foundation management usage remains **188 =2+68+118**.
- `scripts/n8n/foundation-runtime-{checkpoint,plan,control}.mjs` is a new finite
  runtime procedure. It does not repurpose the completed inactive provisioner.
  Its checkpoint pins actual25 saved records; its plan seals future source,
  protected immutable deployment, exact audience and allowed case bodies.
- `scripts/n8n/foundation-execution-control.mjs` binds the installed MCP schemas:
  `get_workflow_details`, `execute_workflow` with `executionMode:'manual'` and
  **no inputs**, then `get_execution` with `includeData:false`. There is no
  invented public `/run` or broad execution export. Installed MCP exposes no
  cancellation operation. Correction: the supported public exact-ID
  `POST /api/v1/executions/{id}/stop` exists; its canceled-state acknowledgement
  does not await worker, child, provider or transport settlement.
- The controller verifies the case's exact draft version, execution permission,
  MCP flag, exactly one enabled Manual Trigger and no other eligible trigger.
  It journals before starting, admits one case at a time, reserves the full
  nested case upper bound, times each tool call at15seconds and polls a known
  execution ID at most8times/15seconds. A timed-out tool can still be pending;
  that is explicitly recorded, never described as cancellation or closure.
  Unknown acknowledgement never receives a replacement case/execution ID.
- The materializer now defines27 fixed source cases,23 selected: **68 native,
  59 business /118 gateway HTTP,20 provider GETs,2 actor starts**. Four new SUB
  replay cases use the first actual run's original account/item and measured
  keyed cost. [Exact inputs and five-SUB map](../../../n8n/foundation/acceptance-cases.md).
  These are source/test allocations, not native execution receipts.

### M03-C01: exact supported path and precise limitation

Pinned n8n2.43.5 supports an **unpublished manual draft** when
`settings.availableInMCP=true`. The installed connector omits
`triggerNodeName`, so each case must have one eligible Manual Trigger and omit
tool `inputs`. The API getter proves neither execution access nor completion.
[Native access validation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/modules/mcp/tools/workflow-validation.utils.ts),
[manual execution](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/modules/mcp/tools/execute-workflow.tool.ts).

The native save hook soft-deletes a manual execution when manual storage is off;
non-manual success/error storage `none` deletes the in-flight execution. The
metadata getter reads the database row, not a retained terminal promise; its
installed projection also omits the executed workflow version. Native
ExecuteWorkflow child IDs live in node metadata, which those settings do not
preserve. Thus missing rows, empty lists, a final gateway business marker, a
successful different workflow or SQL zero leases cannot prove engine completion
or child linkage. A caller-supplied child ID/source label is rejected by the
controller. [Save hook](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/execution-lifecycle/execution-lifecycle-hooks.ts#L587),
[metadata getter](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/modules/mcp/tools/get-execution.tool.ts#L101).

**Resolved source investigation:** a single safe native envelope containing all
these facts is not exposed under the current policy. Public exact-ID metadata
provides workflowVersionId; full retained data supplies native child/parent links.
Published-child lookup may replace nodes/connections without replacing the draft
entity version. Require fresh draftVersionId==activeVersionId and exact body/
source fencing for each published dependency until its known executions settle;
the version field alone is not universal executed-body proof.
Native stoppedAt precedes after-hooks/asynchronous error dispatch. Expected
positive linked child terminal receipts are required; parent terminal, empty
scan, zero leases or caller-labelled IDs cannot prove drain. Actor settlement
and transport closure require their own evidence. The exact scoped-retention
alternative above is approved for local implementation; live use remains part
of this separate finite decision.

### Phase A — exact dev setup, only after the completed packet is approved

Target only emr-dev `zmotjsbzhzjvpelxvxlf`, session pooler
`aws-1-eu-central-1.pooler.supabase.com:5432`, database `postgres`. Preserve the
ten applied versions and all M02 data/exclusions/logos. Inspect current history;
dry-run must contain exactly these four still-pending files/hashes, then one
push and actual parity/advisor/type/ACL verification. No seed replay/reset.

| Pending migration | SHA256 of actual file bytes, reverified19Oct |
| --- | --- |
| `20261018231756_m03_actor_launch_admission.sql` | `fc6955938bba3d08b6a1140258a1db2d0569a5f441c8cc5c934847eb84116600` |
| `20261018232014_m03_foundation_gateway.sql` | `ea1385b734e243bed4dea0030f4975a81d38d41338cb8d94d6086dd83916d334` |
| `20261018232922_m03_foundation_safety_receipts.sql` | `dffa2c23d0102bb7382106c9800e05b5806a1eee89580794aa87bdd63a7f05a5` |
| `20261018233338_m03_foundation_boundary_hardening.sql` | `bf930602b402ef0b4649e9399ed2dcb9d6f2bf576a08d9313f352ccfab4d6c90` |

[Preserved local DB application/advisor/type evidence](local-foundation-db-20261019.json)
and CI39182073955 are local/CI evidence, not hosted application.

After scoped private environment delivery, create a **new immutable protected
Preview** in project `prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu`, branch
`m03-n8n-foundation`, from the final reviewed SHA. Read back READY/project/SHA/
branch/immutable URL/protection before SQL audience binding. Final deployment
ID/URL cannot be known now. The setup-output validator checks the trusted
readback's shape; a supplied object is not itself a Vercel/SQL receipt.

Runtime credentials remain restricted dev writer + the existing dedicated
Machine token + a **separate same-owner read-scoped Apify token**, never the
administrator password in runtime or an extracted native launch token. Validate
Actor-run/dataset/key-value-store Read scopes and exact private delivery before
requesting that new reader after approval; no Run/Write/Manage by default.
Private delivery helpers/leases require their own reviewed purpose, exact
inputs and non-secret result before use. No completed handoff is requested now.

New runtime plan: initial25owned/version/hash/owner/tag reads; one partial PATCH
of the owned Machine's domain fields and exact auth JSON. A bounded private
preparation port rebuilds only Authorization from the retained original pending
token plus the **new owned Preview bypass header**; it never reads the saved
native token or reuses GW-01's revoked bypass. Its public journal contains only
metadata intents/method/path, never credential bodies or their hashes. Restoring
removes only that added header and restores the original intended domain/auth.
Saved PATCH acknowledgement is not proof of endpoint/domain enforcement.
Change only sealed approved graph bodies. GET/PUT/GET checks are **not CAS**. A concurrent
edit, version/hash/tag/owner drift or uncertain mutation fences later writes.
One exact-ID read may classify the state; it never silently adopts an unknown
version or blindly replays the mutation.

Pinned2.43.5 dependency order for these cases is **seven unique publications**:
bootstrap log-only SUB Notify → WF90; unpublish Notify while changing settings;
install24canonical error links; republish Notify; publish WF30/WF70/WF80 →
SUB Finish → WF19. Notify is published twice, so eight publish actions. A direct
manual root child uses its draft, but a nested integrated child uses a published
version. This is the audited call tree, not a universal publication rule.
**Never publish WF00 or WF99.** Every saved/published variant disables every
Schedule Trigger, including canonical retained schedules. No execution during
setup; availableInMCP is enabled only for exact fixed case drafts.

### Phase B — zero-actor proof before either paid start

Proceed only after the separate A–D live approval and reviewed implementation.
Prove the fixed controller's native ID/version/terminal/child linkage,
unknown-start fencing, bounded calls and shutdown on a zero-actor case.
Under the proposed exception, full native payload retention is explicit, not a
metadata-only claim. First verify synthetic success/failure/header-reflection
privacy, private technical projection and acknowledged exact-ID record cleanup.
Use the already-selected `dispatch.vimeo` root/child for the first supported
interface/linkage proof, then the already-allocated four WF19 automatic-error
cases below for failure/handler/privacy proof BEFORE either actor. These move
earlier; they are not extra cases. The one additional zero-actor-control reserve
does not stand in for all nested success/failure tests. Local timeout/wait/detach
results are not a Cloud receipt. Missing Cloud proof stops paid work.
If that proof fails, stop before any actor launch; do not keep retrying a known
retention failure. Verify restricted writer identity, audience/protection,
machine-domain enforcement, endpoint denial cases, current price book/budget,
clean error/cooldown baseline and all actor source/charge constraints.

Public actor/build metadata re-read19Oct03:20–03:21UTC:
`aYG0l9s7dbB7j3gbS` / `apify/website-content-crawler`, build
`BdKJRCYsnmlzPfH3n` / `0.3.99`, SUCCEEDED. The actor's public response supplied
no pricing rows. The one scoped dev price-book read failed OAuth refresh before
SQL. No login loop or repeated four-provider checks. Fresh price-book read is a
guarded read in the future approved dev setup; unknown prices remain unknown.
The existing USD25/day alert default is not a provider spending cap.

### Phase C — ordered two-run matrix, only if B passes

1. Fixed individual WF00 dispatch cases cover all15slots, including health
   (first accrual), then the unknown-slot audit and second health case. Exact
   native child linkage is required; stubs prove dispatch only. Deterministic
   Saturday/PM/backfill guards remain local/CI. Live unknown/no-row fixed-fee
   result is labeled honestly; positive synthetic local accrual tests remain.
2. Genuine `smoke.first` on the guarded C999 fixture only. Preserve original
   launch/run/account/item and actual native IDs. Authenticate original run and
   INPUT, exact pinned actor/build/options, stable terminal/cost samples and
   bounded original dataset; trusted original-run recovery may use only its
   actual durable receipt. Register/normalize/process/finish atomically and
   settle the exact measured keyed cost. No guessed run ID or replacement POST.
3. Acquire the same original group through one bounded original-run dataset
   read+normalizer if necessary (one extra operation/two gateway HTTP/two provider
   GETs). Native SUB Ingest replay A/B uses that first account/item group;
   SQL verifies its original digest. SUB Cost replay A/B uses the actual first
   measured keyed entry. Assert unchanged owned item/raw snapshot/AI/embed/media
   queue/cost identities/hashes/counts. Duplicate Ingest returns the ORIGINAL
   `items_new`/IDs with `updated:false,finished_now:false`; it need not say0.
4. Only after the first terminal/durable/measured result, genuine `smoke.second`
   on the same natural page identity: zero new items/queue work, separate actual
   run and cost. No actor solely for SUB coverage and no fabricated nonzero fee.
5. Forged unknown callback → exact durable rejection audit and no business
   mutation. Equal replay/concurrent original-run processing → no new item,
   queued work or duplicate charge. Reconcile lost atomic acknowledgements only
   through the original registry/result; no SQL JSONB digest invented in JS.
   The five fixed native requests are `callback.unknown`, `callback.equal_replay`,
   `callback.concurrent_a`, `callback.concurrent_b` and `callback.recovery_drill`.
   Unknown uses only `M03AcceptanceUnknown0001` after fixed read-only SQL proves
   it absent from both registry and launch admissions. Other payloads derive
   terminal event/original ID from the first genuine processed settlement proof,
   never arbitrary callback metadata. The concurrent pair is two overlapping
   requests; both actual unpinned native traces must match bijectively. A race
   between processed replays proves no-op boundaries, not first-ingestion
   contention. The fifth request privately checks/closes its response and then
   deliberately withholds its ACK to exercise same-trace/native-ID reconciliation;
   this is a controlled response-loss drill, not a real I/O outage or proof of
   a registration/first-ingestion race. Actual unexpected lost atomic ACKs still
   require their original durable SQL outcome; no replacement POST is allowed.
6. Already completed in Phase B: four WF19 production-webhook calls with fixed **valid JSON `{}`** (not a
   transport-level invalid-JSON rejection), sequential after each actual
   automatic WF90 completes: four workflow-error audits, one threshold/cooldown
   claim and one log-only SUB Notify. Four WF19+four WF90+one Notify=9native,
   9business/18gatewayHTTP. Editor-manual or mocked errors do not count. No email
   or other notification delivery. Requires clean owned baseline before test.
   Do not repeat this batch after paid work to claim another cooldown result.

| Whole proposed envelope | Explicit allocation; no allowance is approved |
| --- | --- |
| Lifecycle | Distinct `df4f29ec-e2dc-4d82-a276-62a4e695e6f9`,60minutes; stop planned work/start requests by minute50; actor guard requires6minutes remaining; no reset/reopen |
| Native | 68selected cases +9automatic-error +5fixed callback requests +1zero-actor control =83normal planned upper. Ten of37reserve are earmarked for possible callback WF90/Notify descendants (each callback reserves3native):93reserved planning/27remaining =120total. No extra target cases or POSTs; actual children still require proof; not a provider-enforced quota |
| Gateway | 118selected +2original group read +18errors +4forgery +24additional replay/race +24zero-actor preflight +10shutdown =200planned;56reserve =256HTTP attempts, including denials/status/Close/recovery;2business leases |
| SQL | Up to20fixed commands/admitted attempt =5,120gateway commands; owner CLI migration/setup/readback/Close operations separately logged, never hidden as native calls |
| Provider | 20selected +2original group read +4independent control-settlement terminal samples =26planned;6reserve (including any new public metadata/recovery reads) =32GET attempts; no automatic GET/POST retry |
| Actor | At most2sequential starts, one page/result each,1024MiB/300seconds,async waitForFinish0,restart off, requested USD1 each,USD2actor reserve; no AI/embedding/media/competitor collection |
| Runtime management | 134setup +69(23case draft transitions×3) +99restore +25final audit =327planned;185reserve =512requests. Approved retention fields share the same graph saves, with exact baseline restoration; no extra workflow/publication. Cloud remains retention-off until approval |
| Native execution control (replaces416) | Separate2048maximum MCP/public-API attempts:208details/start/body fencing +800metadata planning allocation +120private full-data reads +120exact stop attempts +120DELETE +120post-delete GET +200baseline/final owned-list audits +128four-error discovery +64two-original callback discovery +160five-fixture callback discovery +8reconciliation reserve. Runtime+control cap2560; at most8metadata polls per exact ID; no extra starts/cases |

The2048 shared durable control ledger is implemented locally, not a live
allowance. The old416 did not cover native child
reads/private projection/deletion and is superseded, not silently supplemented.
208details/start/fencing covers23manual details+23starts+23preflight body checks,
nine wire preflights+nine wire starts and120private-read body fences =207
(the concurrent pair may share one preflight). The original allocation is
redistributed within the same2048 to include both genuine and fixture callback
discovery explicitly. Categories are planning allocations within one immutable
shared counter, not independently refillable allowances. Eight metadata polls
per ID remains the hard per-ID limit;120IDs×8=960 is a theoretical maximum that
competes for unused capacity in this same2048, not800+960. Exhaustion stops and
leaves unresolved work inventoried; no claim that every worst case fits at once.
Metadata8polls is TOTAL per exact ID, not8per phase. Each of120IDs reserves one
private linkage read, one stop attempt, one DELETE and one absence read; stopping
does not prove completion. Two all25owned sweeps, each default+explicit-running
filter and at most2pages, cost200. Four expected automatic errors each reserve
8discovery rounds×2filters×2pages=128; two genuine callbacks reserve another64,
and five fixed fixture callbacks another160 (pair scans can share pages).
Additional unexpected discovery consumes only remaining shared capacity and
stops on exhaustion; no waiting on empty lists forever.
List candidates require native causal parent verification before adoption.
Include queued/new rows with null startedAt; timestamp-only filtering is unsafe.
At most2pages is a refusal bound, not a completeness claim if more pages exist.
Reserve is for reconciliation/cleanup, never extra business starts.
Before any new case or wire start the controller also protects460control
attempts for120stops+120DELETEs+120absence reads+100final owned-list calls,
plus the case's native read/fencing and expected discovery upper allocation.
This conservative admission floor does not reset counters or extend the clock.

Native/MCP allocations are source/proposal ceilings, not a claim of current
execution visibility or a way to bound unsolicited webhook deliveries. Stop on
unplanned deliveries, count exhaustion, assertion failure, expiry, ambiguous
start/write or charge mismatch. Do not spend the shutdown reserve on more cases.
Actor USD2 reserve excludes infrastructure/subscriptions; unknown fees stay
unknown. The fixed safe input/streamed byte bounds in the preserved section
below remain unchanged.

### Phase D — recovery, restoration and immutable denial

Stop new work; record actual known native/provider IDs. Bounded terminal
confirmation must establish every owned native execution and both original
actors settled. A socket/tool timeout is not cancellation, and zero SQL leases
does not prove no external work. Do not add an unreviewed abort API or issue a
replacement POST. Unknown original actor ID is an unresolved stop, not a guessed
candidate from timestamps. Any extra abort mechanism needs supported exact-ID
semantics and a disclosed count before approval.

Close the SQL window once (permanent fence), reconcile original outcomes, and
unpublish **every actually published owned dependency** in reverse verified
order. Restore all25exact baseline staged graphs, disabled launch/retention,
MCP off and deferred error links. Native settings merge requires the explicit
`errorWorkflow:'DEFAULT'` clear; omitted fields would retain installed links.
Verify the GET result matches the original omission/body, ownership and tags.
Restoration saves new native draft version IDs; it does not rewind history to
the original immutable version IDs. Preserve both in the durable journal.
Restore the owned Machine's old domain fields and original bearer-only JSON from
the same retained pending token, removing the new bypass header without extracting
or rotating the saved native token. Preserve its credential/encrypted token at this
stage; deletion is a separately specified destructive retirement, not hidden in
the new runtime restore consumer. Any pending mutation/drift prevents blind
restoration; Close and external-work reconciliation remain independent.

Remove only the new purpose-bound handoffs/private scratch after their actual
children close. Revoke the owned bypass/remove temporary branch-scoped sensitive
environment entries; verify old/new immutable endpoints deny and the SQL window
is closed. Environment deletion does not erase deployment snapshots. Record
pending transports honestly; clearing a child does not clear its parent app.
Keep password-manager originals, unrelated workflows/credentials and collected
dev data; archive/pause C999 through the reviewed teardown, never delete data.

### Private incident and delivery boundary

Private R2 remains outside Git:35GETs completed, two verified published graphs,
28empty pending-status queries, no proof of full execution visibility/version
coverage/drain. Known set/canary ability/horizon None remain recorded; old window
expired. The targeted private decision concerns absent local relay/canary/drain
controls only. No new scan/key/window request or production implementation.

Preserve the24October tooling follow-up. No merge, M03 closure or M04. The
current source/tests and exact remaining capability are recorded in the existing
progress records; no live acceptance criterion is ticked by this preparation.

### Single final owner decision

Review the current PR8 head, focused local evidence and this entire current
A–D section (the sections below are explicitly historical). Reply:

`Approve M03 dev acceptance A–D at the reviewed PR #8 head`.

Approval covers the exact four dev migrations above; owned C999 setup; a new
protected immutable branch Preview and purpose-bound private delivery; the
25owned runtime/settings/Machine transitions with seven unique/eight publication
actions; zero-actor native success/error/privacy/cleanup proof; only then the
two sequential fixed-page actors and finite replay/SUB/health cases; permanent
Close, exact-record cleanup, baseline restoration and endpoint denial checks.
The caps above apply to all attempts, denials, discovery and shutdown. Unknown
prices/identity/permissions, reflection, ambiguous native/provider outcomes,
drift or pending sockets stop the batch before dependent work. A failed B
means zero actor starts. No new credential handoff is requested before approval.

Expected result is actual per-environment native/SQL/provider/cleanup evidence
or a precise unresolved stop with residual inventory and Mohamed Abdelrahman
responsible for follow-up after admission closes. The expected cleanup point is
the end of this60minute window; unresolved work may require later bounded
follow-up. Never delete unsettled evidence to meet that time or claim backup/
provider physical erasure. Approval excludes production, recurring schedules,
external notification, unrelated data/credentials, PR8 merge, M03 closure and M04.

## Superseded 19 October preparation — preserved checkpoint

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
