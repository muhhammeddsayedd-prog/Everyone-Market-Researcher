# M03 verification

Run from the repository root:

```powershell
pnpm.cmd test --project normalizers
pnpm.cmd --filter @emr/shared exec vitest run src/n8n-schedule.test.ts
pnpm.cmd typecheck
```

These are local contract checks. The website fixture explicitly says
`synthetic_local_contract` and `actualActorCapture: false`; do not relabel it
as live output. The pure schedule planner does not create or run workflows.
Use the regular PR CI for the changed code and database suite; never point the
CI reset script at a developer or hosted database.

Hosted M03 acceptance still requires actual instance/node-schema/credential
verification, reviewed dev migrations and types/advisors, sanitized exports,
and the bounded WF-99 → Apify → WF-19 → atomic persistence journey. Run only the
one-page dev smoke after its current price/estimate gate is satisfied. Keep
WF-00 inactive, all later collectors as stubs, and production untouched.

Capture native completion, verified actor/run/dataset identity, saved receipt,
one cost row equal to actual usage, replay with unchanged item/queue/cost
counts, unknown-run rejection, post-registration recovery, error throttle,
manual slot dispatch and health output. An immediate200 is acknowledgement,
not ingestion proof; local pgTAP or pinned workflows are separate evidence.

M03's dedicated `scripts/assert/m03_smoke_setup.sql`, `m03_smoke_assert.sql`
and `m03_smoke_teardown.sql` have tested refusal/admission guards. Positive
fixture/receipt/archive rehearsal and an actual captured actor fixture remain
pending. Run only with an independently verified dev connection; the supplied
`emr_project_ref` psql variable is an admission guard, not server identity proof.
Setup/teardown take `-v emr_project_ref=zmotjsbzhzjvpelxvxlf` and optional
`-v emr_smoke_rollback=true`. Assertions also require `emr_run_id`,
`emr_apify_run_id` and `emr_expected_items_new` (1 first insert,0 a separate
second run of the same page). A replay of the first saved receipt still reports
its original1. No field should be guessed from an acknowledgement response.

Never use the local M01 C999/Test House fixture or seeded pilot accounts to
make hosted acceptance pass. Setup refuses an existing unowned C999; teardown
only archives/pauses the receipt-owned fixture and retains all collected rows.
See the [local refusal receipt](../../milestones/M03-n8n-foundation/evidence/local-smoke-sql-20261018.json).

Native inactive blueprints and their targeted local checks are documented in
[`foundation/README.md`](../foundation/README.md). They are not hosted exports.

For AC8, use a reviewed, bounded **automatic dev failure** path. Current
[Error Trigger documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.errortrigger/)
says manual workflow runs do not invoke the error workflow. The node's manual
example payload and direct manual WF-90 invocation can test mapping, but cannot
prove error routing, a native originating execution or the third/fourth-error
throttle. No automatic failure probe has been published or run yet. Keep any
future test isolated to owned dev workflows, close its trigger after testing,
and leave WF-00 inactive and all unrelated workflows unchanged.
