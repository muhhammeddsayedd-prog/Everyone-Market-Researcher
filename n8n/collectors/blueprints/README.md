# M04 native workflow blueprints

These generated JSON files are local, inactive definitions. They are **not saved
Cloud exports or native/provider acceptance receipts**. `n8n/workflows/` retains
the actual previously saved definitions until the reviewed M04 dev delivery.

Regenerate with:

```powershell
node n8n/collectors/generate-native-collectors.mjs
```

The gateway audience deliberately contains `m04-binding-pending`. Rebuild with
the exact protected dev Preview and the existing dedicated machine credential
when the complete live packet is approved. No secret value belongs in a graph,
node parameter or generated JSON file. The existing Vimeo Header Auth and native
Apify API credential references retain their real IDs and types.

Collector entry requires an explicit, nonempty `account_ids` array whose size
equals `limit`; missing selection fails before creating a run. WF-00 supplies
the exact four-account selection in `../selection.dev.json` through typed
Execute Sub-workflow inputs to the real WF-10/WF-11 IDs. It calls Instagram once
with `result_type:both`; posts and reels retain their shared primary claim.
Trigger data cannot override the embedded selection, limits or workflow IDs.
The HTTP gateway separately verifies the current dev account allowlist.

The four selected UUIDs come from the verified 27 October dev snapshot for
everyone. and Good People on Vimeo and Instagram. Their reuse here is a local
configuration choice, not refreshed account-state evidence or new collection
authority. This inactive orchestrator has no schedule nodes. Editing the plan
requires regeneration and review; it never widens a failed selection to other
due accounts.

WF-90-M04 is a dedicated maintained Error Trigger definition. It sends only
the mapped workflow ID, originating execution ID and a fixed classification
to `execution.error` on the M04 gateway. Trigger failures without an originating
execution use `handler-<actual handler execution ID>` and `workflow_failed`.
It logs only: it never guesses a scrape run, releases claims, aborts an actor,
retries a paid start or sends an external notification. Raw messages, stacks,
URLs, node names and custom execution data are omitted from its request.

The dedicated handler is **not installed**. All generated consumers record
`errorWorkflowBinding.state:unresolved` and omit `settings.errorWorkflow` until
a real dedicated Cloud ID is supplied explicitly. Builders reject the closed
M03 WF-90 ID and the not-installed placeholder. Local bound-ID tests prove
definition wiring only. Handled API/source failures still use the connected
account reports and terminal callback processing. The existing saved WF-90
and WF-19 foundation definitions remain unchanged.

- WF-00: fixed selected-account wiring to both real collectors with explicit
  typed inputs and no recurring trigger.
- WF-10: bounded native Vimeo API HTTP collection, public metadata normalization,
  restricted ingestion, exact account report, zero-dollar API cost and finish.
  Eligible public-page failures may plan approved goat255 daily or dltik
  collection fallbacks through one-use asynchronous launch/register controls.
  Those fallbacks hold their primary claim and use the registration barrier;
  they cannot run under the representative Instagram-only paid policy.
- WF-11: one claim owner plans both posts and reels, starts bounded account
  batches asynchronously and closes registration after every planned batch is
  registered. It never releases a second pass's claim.
- WF-19: maintained product graph that classifies the registered run before
  provider access. Only M04 runs enter the trusted server-side verification,
  normalization and atomic processor. Unknown and foundation webhooks receive 403. It has no dependency on the closed M03 gateway, manual test path,
  AI stub dispatch or SUB-FINISH. The historical foundation export and the
  compatibility extension helper remain unchanged.
- WF-90-M04: privacy-preserving error classification and M04 logging, with
  unresolved installation metadata and no automatic cleanup side effect.

The input mapping and node versions were checked against the official
[Execute Sub-workflow documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow/),
[ExecuteWorkflow 2.43.5 source](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts)
and [Trigger 2.43.5 source](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflowTrigger/ExecuteWorkflowTrigger.node.ts).
The [Error Trigger documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.errortrigger.md)
and [2.43.5 source](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ErrorTrigger/ErrorTrigger.node.ts)
establish the error payload, workflow-setting link and automatic-execution
requirement. Manual runs cannot establish native Error Trigger acceptance.

Real-source fixture coverage, native Cloud save/execution, exact protected
Preview binding and live cost reconciliation remain separate evidence. No
schedule or external notification is added. An ambiguous paid POST never gets
an automatic retry.
