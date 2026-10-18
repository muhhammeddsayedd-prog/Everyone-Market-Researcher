# M03 native workflow preparation

These modules build **inactive native JSON blueprints**, using the observed
n8n 2.43.5 node versions and pinned official source. They do not call n8n, run
SQL, authenticate providers or write actual exports. The actual capability
probe is recorded separately in M03 evidence and was archived without execution.

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

WF-19 and WF-99 remain unbuilt. Their authenticated provider and launch/recovery
contracts must be completed against the verified credential/API connection;
no fictional provider output or successful journey is represented here.

## Binding and output boundary

Every builder accepts a manifest validated by
`packages/shared/src/n8n-bindings.ts`: fixed dev instance/project/runtime,
canonical workflow and tag names, actual non-secret reference IDs, and the
restricted dev Postgres credential reference where needed. No production
bindings, credential values or placeholder IDs are accepted. Schema validation
does not establish that a reference exists on the server; actual UI/API readback
must supply and verify those IDs. Synthetic IDs occur only in unit tests.

There is no real `bindings.dev.json` yet. Do not invent one to get a build.
These are preparation functions, not a deployment CLI. Native API deployment
must project the allowed API request shape and apply tags separately as required
by the pinned API; do not blindly POST this blueprint wrapper. Save only actual
changed, read-back hosted workflow exports under `../workflows/`.

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

```powershell
node --test n8n/foundation/build-foundation.test.mjs n8n/foundation/build-orchestrator.test.mjs n8n/foundation/build-health.test.mjs n8n/foundation/health-orchestrator.test.mjs
pnpm.cmd exec vitest run packages/shared/src/n8n-bindings.test.ts
```

The tests execute generated validation/dispatch Code and inspect native graph,
mapper and query contracts with synthetic inputs. They do not execute the real
Postgres, Set, Switch, Schedule, Error Trigger or Execute Workflow nodes. Hosted
import, references, TLS, RPC login, callback, automatic errors and actual child
dispatch remain separate M03 acceptance gates.
