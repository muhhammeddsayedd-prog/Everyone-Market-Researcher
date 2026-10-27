# M04 approved setup correction — 27 October 2026

Owner approval at reviewed head2c450f40557e7582525d96b5dd63bba2338baa0d includes the temporary sole/default bypass and temporary publication of ONLY the new owned log-only WF-90-M04. [Exact approval](incremental-dev-approval-20261027.json) preserves historical usage and sets the unchanged fresh/cumulative limits.

## Pinned save contract

n8n2.43.5 validates a changed errorWorkflow reference during save. Its error-workflow validator requires a published version containing an enabled Error Trigger and compatible caller permissions. The historical blanket statement that no publication is needed is superseded for this runtime. The current generated public create schema/controller supports projectId; the legacy workflow.yml is not the current create route.

- [Error workflow validation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflows/error-workflow-validation.service.ts#L106)
- [Changed-reference save validation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflows/workflow.service.ts#L145)
- [Published error execution](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflows/workflow-execution.service.ts#L531)
- [Current create controller](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/controllers/workflows.public.controller.ts#L284)
- [Manual child draft selection](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflow-execute-additional-data.ts#L289)

Order: create/read back the one marked owned handler; publish/read back its exact version; save/read back four inactive consumers bound to its actual ID; publish only WF-19's callback endpoint. WF-00/10/11 remain unpublished and are run manually through supported draft/subworkflow behavior. Shutdown reverses the dependency: unpublish WF-19, restore all four original inactive definitions, then unpublish and retain the dedicated handler. Restore Machine audience and revoke/read back exact owned bypass/env entries independently. No schedule, notification or old foundation dependency is enabled.

## Narrow reuse and local review

The existing runtime wrapper takes Incremental and uses incremental-state.dpapi, preserving closed state.dpapi unchanged. It reads only the required persistent entries per task. The existing append-only usage journal retains its complete historical prefix; request guards use the approved cumulative ceilings and historical-plus-increment category limits. No new credential store, supervisor, time window or helper family is introduced.

The existing Query consumer is dev-only. Incremental denies migration operations, read-only preflight is enforced in PostgreSQL, and operational mutations use exact identity/row compare-and-set with terminal owned parent checks. Only backfill_status/cursor/next_due_at/updated_at change; collected rows, watermarks, human fields and all17 migration versions/hashes are preserved. Generated enum casts and case-insensitive Scope binding are checked locally before writes.

Actual read-only preflight:17 migration fingerprints match, ten exact active accounts bind uniquely, global claims/running parents/unprocessed actors are zero. One bounded administrator read authenticated and closed. Four fresh provider metadata GETs pin Instagram0.0.831 and the published PPE quote; quoted rates range0.0005–0.0027/result, so250 requested rows/actor fit USD1 across published tiers. Scale/SILVER0.0019 matches the dated dev price book; exact future billed tier is not independently established. Actual terminal usage remains authoritative. Seven native metadata GETs verify four owned inactive definitions and existing credential IDs/types; two native Vercel GETs verify protection/no existing bypass/env conflicts. No live write or new actor has yet occurred.

## Counts and functional evidence

Corrected n8n plan:97 planned +47 recovery/shutdown reserve =144. Vercel:51 worst-case planned +13 reserve =64. Error publication/unpublication is included. Gateway512 includes96 possible automatic callback error logs, leaving56 additional recovery operations after the456 allocated bound. Before each actor reserve36 gateway,48 trusted provider and12 incoming callback operations, plus shutdown; no paid POST retry or replacement of an uncertain start.

The one malformed maintained-WF19 webhook probe fails before provider access and may demonstrate automatic handler delivery. Only exact native execution correlation plus a deduplicated fixed database error audit proves that delivery; HTTP500 alone does not. Unknown valid run rejection and the accepted sample's replay remain distinct. Native actions, actor starts and money are tracked separately from request guards. Production-build conflict reads inspect current queued/building activity only and cannot prove no concurrent build ever started; no Production operation is initiated.
