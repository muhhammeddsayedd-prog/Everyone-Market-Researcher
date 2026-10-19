# M03-C01 native interface and privacy investigation

19 October 2026. Local engineering only; Market Radar dev Cloud was not executed,
published, mutated or queried for raw execution data. No real credential handoff
was read/decrypted. PR8 stays draft. The 54-test checkpoint at `dd8f646` and
CI39195709369 remain historical passing source evidence.

## Exact native producers, pinned to 2.43.5

Official tag source commit: `d811f5e87dfc164999f34d75b17017876d41a54a`.
The links below are native implementation evidence, not proof of Cloud access.

| Fact | Producer and lifecycle boundary | What it cannot establish |
| --- | --- | --- |
| Execution identity | MCP start calls WorkflowRunner and returns its actual execution ID immediately. Public exact-ID GET returns id/workflowId/mode/status/times | Start acknowledgement is not terminal execution |
| Version | Persistence creates the execution with workflowData.versionId; public GET includes workflowVersionId even with includeData=false; installed MCP metadata omits it | Published-child loading can replace nodes/connections while retaining the draft entity versionId. Require fresh draft==activeVersionId plus exact body/source fencing for each published dependency; native version alone is not universal executed-body proof |
| End status/time | WorkflowExecute.processSuccessExecution determines success/error/canceled/waiting, awaits close functions, then captures stoppedAt before after-hooks | Not asynchronous Error Workflow dispatch, actor completion, all detached children or client socket closure |
| Child link | Successful ExecuteWorkflow once-mode saves metadata.subExecution; child creation attaches data.parentExecution with native executionId/workflowId/shouldResume. Engine moves task metadata into resultData.runData[knownCall][run].metadata | A waiting return is not a terminal child. Thrown failure may omit parent-side metadata entirely; use bounded candidate discovery plus native child backlink and exact body/case binding. Continued failures can place metadata on output items; never infer links from error text |
| Automatic error child | Error Workflow dispatch passes native parentExecution; dispatch is detached/asynchronous | No parent-side error-child ID or public dispatch-drained event. Require expected positive child receipt for each eligible failure; empty scans do not prove absence |
| Stop | Public POST /api/v1/executions/{id}/stop checks execution:stop/workflow access, requests/broadcasts stop and records canceled/stoppedAt | Does not await worker/children/provider/socket settlement. Installed MCP has no cancel tool; earlier wording denying a public stop endpoint is corrected |
| Native record cleanup | Exact public DELETE hard-deletes row plus binary/JSON-store objects; native service rejects running, but allows waiting | Adapter must add exact ownership, terminal and independent settlement gates. Lost DELETE acknowledgement plus404 is ambiguous storage cleanup, not a successful deletion receipt |
| External settlement | Existing original-run provider snapshots, durable gateway/SQL receipt and owned socket/process closure | Neither SQL zero leases nor n8n stoppedAt is a substitute for the other layers |

Native positive digit-string IDs only. Public lists have workflow/status/time
filters, not a parent filter. Discovery supplies candidates, not identity proof.
StartedAt can be null for queued/new work; a time-filtered empty result misses
that work. Bound pagination and refuse an incomplete view instead of calling it
drained. Error/callback roots require their own native origin/correlation proof.

Native list DTOs omit creation time and may omit workflow version; discovery
records those as unknown and never creates an exact-ID proof from a candidate.
Fresh exact-ID metadata remains strict. The persisted workflow snapshot contains
id/name/nodes/connections/settings/nodeGroups, not `activeVersionId` or a usable
snapshot version field. Executed-body hashing therefore uses those actual saved
fields; current draft/published fencing uses the separate fresh workflow GET,
and the exact-ID execution's top-level `workflowVersionId` remains mandatory.
Absent snapshot fields are not manufactured or treated as evidence. Actual
executed pin evidence is `data.resultData.pinData`; optional snapshot/current
pin checks are defensive and do not substitute for that native run-data check.

The pinned MCP producer supplies one native no-input ManualTrigger seed:
`{[manualTrigger.name]:[{json:{}}]}`. This is accepted only in manual mode,
for the exact bound sole enabled MCP-supported ManualTrigger; it is not a
caller-controlled business/output pin exception. The eligible MCP triggers
are manual/schedule/webhook/form/chat, not ExecuteWorkflowTrigger/ErrorTrigger.
All other execution pins, including webhook data, remain refused. This matches
[the native MCP producer](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/modules/mcp/tools/execute-workflow.tool.ts)
and [its supported trigger set](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/modules/mcp/mcp.constants.ts).
[Public DTO mapper](https://github.com/n8n-io/n8n/blob/d811f5e87dfc164999f34d75b17017876d41a54a/packages/cli/src/public-api/v1/controllers/executions.public.controller.ts),
[persisted snapshot type](https://github.com/n8n-io/n8n/blob/d811f5e87dfc164999f34d75b17017876d41a54a/packages/cli/src/executions/execution-data/types.ts).

### Why the current-policy bridge stops here

The final save hook soft-deletes manual executions with manual storage disabled;
nonmanual success/error retention `none` deletes in-flight records. Initial
execution creation and waiting checkpoints can still write serialized input,
workflow snapshots and full runData. Hence terminal retention-off is not proof
that payload never touched native storage.

Retaining an ordinary wrapper stores intermediate child outputs/errors before
its final safe projection. MCP test_workflow waits a postExecute promise but
returns only executionId/status, pins root external nodes, and supplies no safe
complete child/version/stop envelope. It cannot replace native business runs.
Last-node Webhook responses are also not a general queue-mode escape: the
runner's full-result response path needs persisted execution data.

MCP includeData=true with selected nodeNames is not a private metadata reducer:
it prunes runData/pinData but leaves other error/context fields. Never expose
that full response to model context. Native read-time redaction is not a
field-selective storage policy. HTTP Request sanitizes some request options,
but NodeApiError and continued-failure paths can copy response data/errors.
No source guarantee excludes credential reflection.

The resolved policy alternative is the existing packet's temporary
21 integrated success/error + five manual-root retention deltas (WF91 overlap,
25 unique IDs). The owner approved the exact inventory at eee9a27 for local
implementation/tests/review. The historical pure proposal stays unchanged;
the runtime plan now consumes a separately branded approved policy and keeps
the exact original settings for restoration. This is source behavior, not a
Cloud application receipt or live-batch approval. No new orchestration framework,
migration, actor permission or workflow is introduced.

### Approved private reducer and correlation boundary

`foundation-native-reader.mjs` handles full native responses only in the private
technical process, with strict8MiB streaming refusal before parsing, fatal UTF-8,
framing/JSON/native-redaction checks and raw/decoded sensitive-value scanning.
Only checked native metadata, exact bound child/parent links, deterministic
gateway request IDs/operations and narrowly validated callback context leave it.
No body, headers, node data, workflow snapshot, original error or credential is
included in its projected receipts. Injected scripted ports are local tests;
they do not establish Cloud permission or native lifecycle acceptance.

For the four already-budgeted automatic errors, the fixed credentialless wire
operation sends valid JSON `{}` and one fresh standard `traceparent`. The native
Webhook node copies actual request headers into its output; a full retained
execution with the exact unpinned bound Webhook output and trace can correlate
the request to its native ID. The ordinary response-node path supplies no native
execution ID, and a500 response alone proves none. The controller must also read
the actual linked mode:error WF-90 child and its descendants. Trace is request
correlation only, not completion. No extra graph, response node or publication
is introduced. [Webhook output producer](https://github.com/n8n-io/n8n/blob/d811f5e87dfc164999f34d75b17017876d41a54a/packages/nodes-base/nodes/Webhook/Webhook.node.ts),
[response lifecycle and trace propagation](https://github.com/n8n-io/n8n/blob/d811f5e87dfc164999f34d75b17017876d41a54a/packages/cli/src/webhooks/webhook-helpers.ts).

A genuine actor callback is a detached external WF-19 root, not an invented
native child of WF-99. Its actual unpinned Webhook body and executed bound
`Validate callback source` output must agree on the original provider run ID;
the fixed authenticated SQL projection must tie that ID to this batch's actual
WF-99 native execution. This proves registered-original correlation, not
cryptographic webhook sender identity. Discover only known owned workflows;
missing, duplicate, old or unlinked candidates remain unresolved.

### Primary implementation references

- [MCP manual start](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/modules/mcp/tools/execute-workflow.tool.ts), [metadata projection/filter](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/modules/mcp/tools/get-execution.tool.ts), [test workflow](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/modules/mcp/tools/test-workflow.tool.ts).
- [Public execution API](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/controllers/executions.public.controller.ts), [execution service](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/executions/execution.service.ts), [persistence](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/executions/execution-persistence.ts).
- [Engine final status/stoppedAt/metadata](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/core/src/execution-engine/workflow-execute.ts#L2933), [save hooks](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/execution-lifecycle/execution-lifecycle-hooks.ts#L587).
- [Native child parent creation and draft/published body lookup](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflow-execute-additional-data.ts), [ExecuteWorkflow child metadata](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts), [Error Workflow parent creation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflows/workflow-execution.service.ts), [detached error dispatch](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/execution-lifecycle/execute-error-workflow.ts).
- [Queue full-data response](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflow-runner.ts), [HTTP Request handling](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts), [NodeApiError response context](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/workflow/src/errors/node-api.error.ts).

## Evidence boundaries

The pure proposal tests exercise inventory validation, immutable deltas and
preservation. Existing 54 tests use synthetic ports and remain source/control
evidence. The isolated engine reproduction has separate runtime results and
privacy inspection; it cannot establish Cloud queue-worker behavior, installed
connector access, provider authentication, production or full M03 acceptance.
Future live setup must first prove the supported interface and privacy behavior
with zero actors. No live credential action is requested by this record.

## Actual isolated engine observations

Official image `n8nio/n8n:2.43.5`, digest
`sha256:4fc4c67bf5fb990201a71d94c7070abf8dd0619cb8af1d059877a447f3640392`,
bundled Node26.7.0, isolated SQLite. One new labeled internal Docker network and
container,1CPU/1024MiB/256PIDs, no successful outbound access. Existing containers
were untouched. Local internal REST started manual fixtures; a local registered
public webhook exercised automatic ErrorTrigger. This does not validate the
Cloud MCP/queue deployment or justify using an internal endpoint on Cloud.
Actual Docker image inspection verified both imageId and RepoDigests (bceb94);
the matching bytes are recorded separately, not inferred from the tag.

[Projected actual runtime receipt](c01-native-local-repro-20261019.json),
[guarded reproduction instructions](../../../scripts/n8n/foundation-native-repro.md)
and archived synthetic sources retain identities, causal links, direct canary
paths, versions/times, failed attempts and cleanup status. Raw execution payloads
and local synthetic auth values are excluded. The archive adds explicit local
guards/native-package resolution; those deltas passed syntax/argument checks,
not another engine run. Nine guard checks created zero native executions.

The run created **38 local native executions:14invalid fixture executions and
24valid executions (12pairs)**. Three earlier pre-execution schema failures and
the first seven invalid fixture pairs are preserved as failures, not acceptance.
The synthetic child initially declared no schema fields; correction was native
`inputSource:'passthrough'`, then all valid scenarios below. No project credential,
Cloud workflow, provider API, actor, model or real business payload was used.

| Actual local scenario | Observation |
| --- | --- |
| Retention-none success root15/child16 | Public root metadata404; soft-deleted rows retain stale running/null-stop state. Initial native parent context can survive privately, but no authoritative public terminal tuple is obtained |
| Safe-final retained parent17 | Parent success/version/stop are readable, and actual intermediate child output persists despite a safe final checkpoint |
| Caught failure19; uncaught21 | Caught parent can be success with safe final output while native task output retains the child exception. Uncaught parent retains resultData.error.message. Independent review checked those runtime fields, excluding embedded source literals |
| Detached23/24 | Parent stopped04:10:24.675UTC; child stopped04:10:28.686UTC. Parent terminal did not close child |
| Timeout25/26 | Parent recorded canceled04:10:30.301UTC; child canceled04:10:39.669UTC. Cancellation did not establish simultaneous child settlement |
| Waiting/resume29/30 and proposed35/36 | Both native waiting records had stoppedAt and persisted synthetic payload before resume. Waiting+stoppedAt is not terminal; resuming the original IDs continued those executions |
| Same workflow rerun17 then27 | Native IDs were distinct; querying17 still returned17, not27. No actual server-ID reuse occurred. Existing controller tests separately simulate/reject reused acknowledgements |
| Proposed retained success31/32 | Both terminal tuples/native versions and reciprocal successful-call/child-parent links available |
| Proposed retained failure33/34 | Both terminal tuples available; child34 native parentExecution points to33. Parent33 has no subExecution metadata because the call threw; discovery plus the child's native backlink is required |
| Automatic webhook error37/handler38 | Root37 webhook/error stopped04:12:34.155UTC; native error-mode handler38 began04:12:34.283UTC and succeeded. Handler's native parent link identifies37, demonstrating delayed dispatch after parent stop |

The SQLite inspector examined execution_entity and decoded execution_data,
including intermediate outputs/errors, independently of the final output. Privacy
projection excludes workflow snapshots/node source literals; it emits metadata,
native causal links and canary booleans, not raw business/error values. Initial
none-policy context persistence is not labelled terminal completion or payload
privacy proof. These synthetic results disprove a safe-final wrapper guarantee;
they do not prove that real provider responses cannot reflect credentials.

The proposed one-page maximum/failure8MiB private-response bound still needs its
own representative local validation before final live approval. No reader,
native DELETE adapter or retention exception has been enabled by these tests.
The nonmanual fixtures also had manual-save=true, unused in integrated/error
modes. Results are mode-equivalent field evidence, not exact25settings parity.

### Actual local cleanup and remaining owner action

Container stopped with exit0, removed; owned internal network removed; loopback
port56794 verified free. All credential-bearing **synthetic local** children
closed. Existing Docker resources and real handoffs were untouched.
Automatic approval review rejected the exact owned raw-state deletion before
execution (“blocked by policy”); no alternate deletion was attempted. The ignored
`.c01-repro.local/state` database/local auth/snapshots remain, so raw cleanup is
**incomplete**. No real credentials are in that state. The exact verified-target
owner command and expected `False` result are in M03 PROGRESS under MA-11 /
M03-C01 local cleanup. Source archives/projected evidence are preserved; no
parent-app environment clearing, backup erasure or Cloud cleanup is claimed.
