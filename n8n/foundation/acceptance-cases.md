# Finite M03 manual acceptance cases

`materialize-acceptance-case.mjs` is pure local preparation. It does not save,
publish, execute, read credentials, call a provider or open a gateway window. The
canonical builders remain unchanged. A materialized workflow has kind
`proposed-native-manual-case`, remains inactive, keeps execution retention off,
and records `executionAuthorized:false`.

The helper adds one fixed Code node between the Manual Trigger and its original
successor. The four SUB replay variants add that fixed manual branch while
preserving the canonical When Called branch. Each proposed variant has exactly
one Manual Trigger, every Schedule Trigger disabled and `availableInMCP:true`;
the canonical builders and staged exports remain unchanged. Other credentials,
actor limits, guards and child wait flags are retained. No arbitrary JSON, SQL,
URL, input expression or workflow key is accepted.

## Cases and normal-path upper bounds

Every business operation sends its original request and one durable status read.
These are conservative source bounds, not runtime receipts or provider quotas.

| Fixed case                                                                                                                                                                                         | Recommended live selection                                                           | Native executions maximum | Business operations / gateway HTTP maximum | Provider GET / actor POST maximum |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------ | --------------------------------- |
| `dispatch.web_map`, `vimeo`, `ig_posts`, `ig_reels`, `youtube`, `li_posts`, `removal`, `li_employees`, `stories_am`, `linker`, `news`, `awards`, `briefs`, `digest` (each with `dispatch.` prefix) | Yes, 14 individual fixed slots                                                       | 2 each                    | 0 / 0                                      | 0 / 0                             |
| `dispatch.health`                                                                                                                                                                                  | Yes; counts as first WF-91 proof                                                     | 8                         | 6 / 12                                     | 0 / 0                             |
| `dispatch.unknown`                                                                                                                                                                                 | Yes; fixed sanitized audit                                                           | 1                         | 1 / 2                                      | 0 / 0                             |
| `dispatch.stories_pm`, `dispatch.backfill_wave`                                                                                                                                                    | Local by default; optional live only if included in the final packet                 | 1 each                    | 0 / 0                                      | 0 / 0                             |
| `dispatch.saturday04`                                                                                                                                                                              | Local by default; two individual live slot cases already cover the target references | 3                         | 0 / 0                                      | 0 / 0                             |
| `health.first`                                                                                                                                                                                     | Local/optional; avoid a third WF-91 execution                                        | 7                         | 6 / 12                                     | 0 / 0                             |
| `health.second`                                                                                                                                                                                    | Yes; verify second accrual adds zero                                                 | 7                         | 6 / 12                                     | 0 / 0                             |
| `smoke.first`, `smoke.second`                                                                                                                                                                      | Yes, sequential and only after separate live approval                                | 10 each                   | 21 / 42 each                               | 10 / 1 each                       |
| `sub.ingest.replay_a`, `sub.ingest.replay_b`                                                                                                                                                       | Exact first original run/group; may run concurrently within two admitted operations  | 1 each                    | 1 / 2 each                                 | 0 / 0 each                        |
| `sub.cost.replay_a`, `sub.cost.replay_b`                                                                                                                                                           | Exact first original measured cost; sequential                                       | 1 each                    | 1 / 2 each                                 | 0 / 0 each                        |

This 23-case selection is a **subset of the final acceptance batch**, not a
complete M03 acceptance plan. It totals at most **68 native executions, 59 business
operations / 118 gateway HTTP attempts, 20 provider GET attempts and two actor
POSTs**. Using the existing conservative 20 fixed SQL commands per gateway
attempt gives an upper allocation of 2,360 commands for these cases. The original
group acquisition below separately reserves **one business operation / two
gateway HTTP attempts and two provider GETs**. With that acquisition, the subset
allocates 120 gateway HTTP attempts and 22 provider GETs. Error Trigger,
forged/replayed callbacks, native management publication/readback, preflight and
shutdown remain separate work in the existing whole-batch reserve. Additional
provider webhook deliveries consume that reserve and may require stopping; they
are not bounded by this source helper.

Health allows all existing conditional log-only notifications and stubs, with
`stats_daily_enabled=false`. Each smoke allocation includes its native recovery
call plus one provider webhook visit; conservatively both visits include the
union of rejection and successful-processing branches, although those branches
are mutually exclusive. There are no graph cycles or automatic HTTP retries.
An unexpected callback or failed assertion stops the planned batch instead of
silently increasing these counts.

All five SUB workflows now have source case and evidence mappings below. That
mapping does not establish native acceptance: publication, a different workflow
succeeding, unchanged SQL state and an empty execution list are insufficient.

The two launch UUIDs are fixed by the existing deterministic `nodeId` helper and
remain identical on rematerialization. Only the exact actual
`M03_SMOKE_FIXTURE_READY` result from `scripts/assert/m03_smoke_setup.sql` can
supply the C999 account UUID. No fixture is invented. Receipt shape validation
is not proof of hosted ownership; the existing SQL launch guard establishes that
separately. Launch stays disabled by default. Only the builder's existing exact
`{launchEnabled:true}` source option can propose an enabled variant; it still
does not authorize saving or execution. First run allows at most one item;
second genuine run must add zero items and retain its separate measured cost.

## First-original SUB replay inputs and evidence

After the first genuine run is registered, processed and costed, acquire its
original group through the existing bounded `apify.dataset.read` operation and
the existing narrow normalizer. This adds two authenticated provider GETs and
two gateway HTTP attempts, no new actor. Preserve the actual launch ID, parent
run/account, dataset ID, processing receipt, measured provider usage and SQL
keyed-cost entry. The strict `firstRunEvidence` input accepts only that first
launch's fixed ID and ordinal, reviewed actor/build and C999 receipt. An unrelated
execution export, second launch, changed account or fabricated cost is rejected.
The first original receipt must show one newly inserted item; otherwise stop and
reconcile that actual result rather than inventing one.

Each SUB Ingest variant passes the original run/status/dataset/provider-usage
and normalized group to the existing atomic RPC. SQL verifies its stored
canonical JSONB `groups_sha256`; JavaScript never creates that proof by hashing
a differently serialized group. Require the original saved receipt with
`updated:false` and `finished_now:false`. Its historical `items_new:1` and
`new_item_ids` remain the original values: they do **not** mean the replay added
an item. Compare authoritative scoped before/after counts and digests of items,
raw snapshots, all three queues and keyed costs to establish zero new work.

Each SUB Cost variant passes one original measured entry: provider Apify,
category scrape, quantity one, unit result, original rounded cost/parent/
competitor/platform and exact four-field actor/run/account/cost-key metadata.
It omits `item_id` and `day`, preserving the actual original keyed row even
across the Cairo date boundary. Require `{inserted:0}` twice and unchanged
scoped projections. No fee, replacement price, second item or new actor is used.

`verifyFoundationSubReplay` checks that strict output and before/after projection
locally. Its result deliberately reports `hostedAcceptance:false` and
`nativeCompletionVerified:false`: an actual supported native completion and
correlation receipt must accompany the real duplicate RPC/status receipts.
Synthetic test values are not accepted as hosted evidence.

| SUB    | Native cases                                                            | Durable evidence and required boundary                                                                                                                                                                                     |
| ------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start  | Both genuine WF-99 launches                                             | Actual own child execution linked to its WF-99 parent; original `run.start` request/status and `scrape_runs.execution_id`. Unknown acknowledgement reconciles the same ID.                                                 |
| Ingest | `sub.ingest.replay_a` and `replay_b`                                    | Both own terminal executions; same first-run group accepted against SQL's original digest, original receipt with update/finish false, zero item/snapshot/queue/cost delta.                                                 |
| Cost   | `sub.cost.replay_a` and `replay_b`                                      | Both own terminal executions; same measured keyed entry, both `inserted:0`, zero scoped row/amount/digest delta.                                                                                                           |
| Finish | Eligible original transitions in both genuine runs                      | Own child execution from WF-19, original durable finish summary and original processing receipt; duplicate transition suppresses replacement finish/dispatch. Async downstream starts are separate from terminal evidence. |
| Notify | First health dispatch, second health, automatic Error Trigger threshold | Own log-only child executions and originating correlation; actual third-error claim gives one notify audit, fourth gives none. `sent:false` and no external delivery.                                                      |

Known fees stay dated and attributable. Live unknown or absent fee rows prove
only safe no-row behavior; they cannot prove positive hosted accrual. Keep the
existing synthetic local positive-fee/idempotency test separate. No invented
subscription fee or renewed billing questionnaire is needed.

## Native control and publication prerequisites

The plugin's manual execution version selector is not a generic JSON input
channel: supported input kinds are chat, form and webhook. These variants solve
the fixed Manual Trigger input problem in source. The proposed control selects
the unpublished draft/manual version with no inputs and exactly one enabled
Manual Trigger. Actual tool access, selected saved version, native terminal and
parent/child correlation readback, request counters and cleanup still need
verification before the final packet is executable. This factory alone is not
MCP access or hosted acceptance. Retention remains off; a missing/empty execution
read is not successful completion, and no identity-marker business operation or
broad execution-payload retention is added.
The final exact ordered plan is still blocked by that actual manual-control
capability, a current hosted price-book read, and verified source/runtime/saved
bindings. No hosted authority follows from this subset. The second genuine
launch must wait for the first original run's registered, processed and measured
cost receipt, regardless of the catalog's display order.

Pinned n8n 2.43.5 source selects a draft for the direct child of a manual parent.
That child runs in integrated mode; its Execute Workflow node passes integrated
through unchanged, so its own child loads a published definition. Thus direct
and nested calls have different publication requirements. Do not assume either
that every child must be published or that all nested manual calls use drafts.
Under the separately approved live packet, seven unique owned publications
(eight publication actions because Notify is published twice) are sufficient
for this fixed case selection, in this order:

1. Publish the staged log-only SUB Notify without its deferred error link.
2. Publish WF-90, whose SUB Notify dependency is now published.
3. Install the 24 canonical error links using draft-only PUTs with
   `publishIfActive=false`.
4. Republish canonical SUB Notify, then publish the three nested stubs WF-30,
   WF-70 and WF-80, then SUB Finish and the temporary WF-19 callback. WF-00 manual
   dispatch to WF-91 reaches integrated calls to Notify/WF-70/WF-80. WF-99 manual
   recovery to WF-19 reaches integrated SUB Finish and its WF-30/WF-70 children.
5. Save/use only the reviewed unpublished manual WF-99, WF-00, WF-91, SUB Ingest
   and SUB Cost variants, with all schedules disabled. **Never publish WF-00**.
   The remaining direct WF-00 child stubs and SUB Start load saved drafts on
   these exact manual paths; publication is not needed to route to them.

This is pinned source reasoning, not a completed native engine test. Canonical
asynchronous child wait flags are preserved; no awaited test variant is silently
substituted for that delivery behavior. Child metadata and native completion
must be obtained through a supported narrow control. A waiting execution is not
terminal, and a provider callback or stopped parent alone does not close an
in-flight child or external actor.

At shutdown, unpublish only the owned temporary publications, restore canonical
inactive/launch-disabled/retention-off definitions and verify saved state. Keep
durable admissions and collected smoke evidence. GW-01 remains closed.

The native publication constraints and primary pinned-source links are in the
[native API audit](../../milestones/M03-n8n-foundation/evidence/native-api-contract-audit-20261019.md).
The exact mode propagation is in the pinned [Execute Workflow node](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts),
[draft/published loader and integrated execution construction](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflow-execute-additional-data.ts),
and [BaseExecuteContext forwarding](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/core/src/execution-engine/node-execution-context/base-execute-context.ts).
