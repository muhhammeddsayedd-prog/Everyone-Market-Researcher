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

M03's dedicated C999 setup/assert/teardown scripts and actual captured actor
fixture are not ready yet. Do not use the local M01 C999/Test House fixture or
seeded pilot accounts to make hosted acceptance pass. Teardown must archive
the owned smoke competitor/pause its account and retain collected data.
