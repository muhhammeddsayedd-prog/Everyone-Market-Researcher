# Approved remaining M03 dev acceptance — saved-input delivery

The owner replied **Approve exact remaining packet** to the exact packet at
reviewed PR8 head `a04d7c4b8835c0ae3f8136e9095d0e3e775b9151`.
[Actual approval](dev-acceptance-remaining-approval-20261022.json) pins the
unchanged [packet](dev-acceptance-remaining-packet-20261022.md) and checkpoint.
This delivery does not start its one-use clock. All prior attempts remain spent;
all14 successful dev migrations remain applied and must never be replayed.

Use these commands only after Codex confirms approved-source review, affected
tests, actual public seal/CheckOnly and current PR CI. No password reset, new key,
Machine delivery, production credential or further development approval is needed.

## Exact owner action

Open **Windows PowerShell under the same Windows account** and run:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\New-M03FoundationMigrationHandoff.ps1' -RemainingContinuation
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03AcceptanceHandoff.ps1' -Kind All
```

At the hidden prompts, enter the same four saved values, in this order:

1. **EXISTING emr-dev postgres database password** for
   `zmotjsbzhzjvpelxvxlf`. The separate administrator child uses it only for
   fresh14-version/critical-catalog/global-vacancy readbacks, exact retained-C999
   reactivation, exact Preview binding and Close. No migration command, advisor
   rerun or type regeneration; it never enters n8n or the web runtime.
2. **EXISTING n8n Management API key** for
   `muhhammedsayed.app.n8n.cloud`, for the approved bounded dev operations.
3. **EXISTING emr-dev `n8n_writer` password** saved from M01. It authenticates
   the restricted writer through the verified session pooler on5432. This is
   distinct from postgres, `api_agent` and any Supabase Secret key.
4. **EXISTING same-owner Apify READ token** used in the previous attempt,
   with Actor runs, Datasets and Key-value stores READ permissions. No new token
   creation or extraction from the native shared n8n credential is requested.

Expected non-secret output prefixes:

```text
M03_FOUNDATION_MIGRATION_ADMIN_READY
M03_ACCEPTANCE_HANDOFF_READY: All.
```

Close that PowerShell window, keep the saved originals and reply:
**M03 remaining-window handoffs ready**.
Send no values, URLs, file contents, environment dumps or credential screenshots.

## Bounded custody and admission

These helpers create new two-hour DPAPI deliveries, not new credentials, under
`%LOCALAPPDATA%\Temp`. The eight exact temporary names are:

```text
emr-m03-foundation-dev-migration-password.dpapi
emr-m03-foundation-dev-migration-password.lease.json
emr-m03-acceptance-management.dpapi
emr-m03-acceptance-management.lease.json
emr-m03-acceptance-writer.dpapi
emr-m03-acceptance-writer.lease.json
emr-m03-acceptance-apifyread.dpapi
emr-m03-acceptance-apifyread.lease.json
```

Their presence is not authentication. Actual lease metadata must cover75 minutes,
the interactive transport/provenance/source checks must pass, and only then may
the reviewed consumer admit segment `e8035391-dba8-48c9-97e0-139ba980d86e`.
Stop-new is minute50, actions60, physical closure70; no automatic renewal.
Management4/control101/combined105 are carried without refill. Actor limits stay
two sequential starts, USD1each/USD2total reserve, at most one new distinct item;
zero-actor Phase B and native domain-denial/cleanup must pass before either start.

The consumed temporary inputs/private SQL are removed after credential-bearing
children close; saved originals/Machine are retained. Clearing a child shell
does not clear a parent VS Code process. These hidden-prompt helpers do not ask
the owner to put credentials in that parent environment or in Git/configuration.
Production, recurring activation, external notifications, shared credential
changes, private incident execution, PR8 merge, M03 closure and M04 stay excluded.
