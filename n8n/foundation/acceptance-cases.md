# Finite M03 manual acceptance cases

`materialize-acceptance-case.mjs` is pure local preparation. It does not save,
publish, execute, read credentials, call a provider or open a gateway window. The
canonical builders remain unchanged. A materialized workflow has kind
`proposed-native-manual-case`, remains inactive, keeps execution retention off,
and records `executionAuthorized:false`.

The helper adds one fixed Code node between the existing Manual Trigger and its
original successor. Every Schedule Trigger is disabled in that proposed variant.
Other input branches, settings, credentials, actor limits and guards are retained.
No arbitrary JSON, SQL, URL, input expression or workflow key is accepted.

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

This 19-case selection is a **subset of the final acceptance batch**, not a
complete M03 acceptance plan. It totals at most **64 native executions, 55 business
operations / 110 gateway HTTP attempts, 20 provider GET attempts and two actor
POSTs**. Using the existing conservative 20 fixed SQL commands per gateway
attempt gives an upper allocation of 2,200 commands for these cases. Error Trigger,
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

The subset does not establish all five SUB workflows' native acceptance. WF-19
uses the atomic processor directly, so SUB Ingest and SUB Cost need separately
mapped native checks using only the original actual registered run, item/group
and measured-cost receipts. These must create no additional actor run or
fabricated cost. Their exact inputs, operation/execution allocations and expected
idempotent receipts belong in the final ordered packet; publishing a SUB alone
does not prove it executed.

The two launch UUIDs are fixed by the existing deterministic `nodeId` helper and
remain identical on rematerialization. Only the exact actual
`M03_SMOKE_FIXTURE_READY` result from `scripts/assert/m03_smoke_setup.sql` can
supply the C999 account UUID. No fixture is invented. Receipt shape validation
is not proof of hosted ownership; the existing SQL launch guard establishes that
separately. Launch stays disabled by default. Only the builder's existing exact
`{launchEnabled:true}` source option can propose an enabled variant; it still
does not authorize saving or execution. First run allows at most one item;
second genuine run must add zero items and retain its separate measured cost.

## Native control and publication prerequisites

The plugin's manual execution version selector is not a generic JSON input
channel: supported input kinds are chat, form and webhook. These variants solve
the fixed Manual Trigger input problem in source. Actual supported native
manual-execution control, selected saved version, projected completion readback,
request counters and cleanup still need verification before the final packet is
executable. This factory alone is not MCP access or hosted acceptance.
The final exact ordered plan is still blocked by that actual manual-control
capability, a current hosted price-book read, and verified source/runtime/saved
bindings. No hosted authority follows from this subset. The second genuine
launch must wait for the first original run's registered, processed and measured
cost receipt, regardless of the catalog's display order.

Under the separately approved live packet, publish only owned dependencies in
this order:

1. Publish the staged log-only SUB Notify without its deferred error link.
2. Publish WF-90, whose SUB Notify dependency is now published.
3. Install the 24 canonical error links using draft-only PUTs with
   `publishIfActive=false`.
4. Republish canonical SUB Notify, SUB Start, SUB Cost and SUB Ingest; publish the
   15 explicit stubs, then SUB Finish, WF-91 and the temporary WF-19 callback.
5. Save/use only the reviewed manual WF-99 and WF-00 variants, with all schedules
   disabled. A production-mode parent needs its static sub-workflows published;
   Manual Trigger execution behavior must still be verified with the actual
   supported control.

At shutdown, unpublish only the owned temporary publications, restore canonical
inactive/launch-disabled/retention-off definitions and verify saved state. Keep
durable admissions and collected smoke evidence. GW-01 remains closed.

The native publication constraints and primary pinned-source links are in the
[native API audit](../../milestones/M03-n8n-foundation/evidence/native-api-contract-audit-20261019.md).
