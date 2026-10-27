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
equals `limit`; missing selection fails before creating a run. The HTTP gateway
also enforces the dev account allowlist. Existing WF-00 does not yet supply this
new selection contract, so its collector wiring remains pending. Representative
checks call WF-10/WF-11 directly with the exact approved IDs; no implicit claim
of all dev accounts occurs.

WF-10/WF-11 also preserve the existing inactive staging boundary for their
global error handler. Their actual `settings.errorWorkflow` link is omitted;
`deferredErrorWorkflowId` records the existing WF-90 ID as intended metadata.
WF-90's saved gateway still belongs to a closed M03 window, so automatic binding
waits for a verified compatible M04 logging path. Handled API/source failures
still use the connected account reports and terminal callback processing.
WF-90 and the existing WF-19 foundation settings are unchanged.

- WF-10: bounded native Vimeo API HTTP collection, public metadata normalization,
  restricted ingestion, exact account report, zero-dollar API cost and finish.
  Eligible public-page failures may plan approved goat255 daily or dltik
  collection fallbacks through one-use asynchronous launch/register controls.
  Those fallbacks hold their primary claim and use the registration barrier;
  they cannot run under the representative Instagram-only paid policy.
- WF-11: one claim owner plans both posts and reels, starts bounded account
  batches asynchronously and closes registration after every planned batch is
  registered. It never releases a second pass's claim.
- WF-19: classifies the registered run before provider access. Only M04 runs
  enter the trusted server-side verification/normalization/atomic processor.
  Unknown webhooks receive403. The foundation branch's existing nodes and saved
  provenance are preserved, without reopening its historical windows.

Real-source fixture coverage, native Cloud save/execution, exact protected
Preview binding and live cost reconciliation remain separate evidence. No
schedule or external notification is added. An ambiguous paid POST never gets
an automatic retry.
