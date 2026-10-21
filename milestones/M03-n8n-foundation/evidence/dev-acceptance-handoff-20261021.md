# Approved A–D dev batch: credential delivery

The owner approved the reviewed PR8 head
`f42930f90c2de43c84f61ad6d966d0ee6074d70e` on21October2026 Cairo. The immutable
packet hash and limits are in `dev-acceptance-authorization-20261021.json`.
This is credential delivery for that approval. No repeat general dev approval,
new Machine token, password reset, production password or Supabase secret key
is needed. The existing retained Machine handoff is preserved.

Wait until the concrete consumers pass review and their public CheckOnly before
running these commands. Both helpers use hidden prompts and same-account
Windows DPAPI, refuse preexisting handoffs and create two-hour purpose leases.
The coordinator requires at least75minutes remaining on the administrator lease
and70minutes on each runtime lease before consuming any runtime value.

## Exact owner action

Use the EXISTING saved values for:

1. emr-dev / `zmotjsbzhzjvpelxvxlf` administrator database password. It enters
   only the sealed database subprocess for exact approved migrations/readbacks,
   the owned C999 fixture and new Preview/window binding. It never enters n8n,
   the web runtime or the Node coordinator.
2. `muhhammedsayed.app.n8n.cloud` management API key. It is used only for this
   bounded owned-workflow runtime/control batch.
3. emr-dev `n8n_writer` password saved in M01. It is used for the approved
   restricted gateway runtime; the saved n8n Postgres credential is not read or
   changed. Do not substitute postgres, api_agent or production credentials.
4. An Apify token belonging to the SAME account as the existing native Apify
   credential, with READ access for Actor runs, Datasets and Key-value stores.
   Reuse a suitable saved read-scoped token. Only if absent, use Apify Console
   → Settings → API & Integrations → create a named token → Limit token
   permissions → the three READ groups above. No Run, Write or Manage access.
   Do not extract or duplicate the native n8n credential. This token verifies
   original run/INPUT/dataset facts; it cannot authorize an actor start.

Apify documents the console path and token-permission restriction in its
[official API integration guide](https://docs.apify.com/integrations/api).
If the console cannot grant exactly those read operations, report that access
gap rather than broadening the token.

Open **Windows PowerShell under this same Windows account** and run:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\New-M03FoundationMigrationHandoff.ps1'
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03AcceptanceHandoff.ps1' -Kind All
```

First command: enter only the existing emr-dev administrator database password.
Second command: enter, in order, existing n8n Management key, existing dev Writer
password, and same-owner Apify READ token. Expected non-secret output prefixes:

```text
M03_FOUNDATION_MIGRATION_ADMIN_READY
M03_ACCEPTANCE_HANDOFF_READY: All.
```

Close that PowerShell window, keep the originals in your password manager, and
reply **M03 A–D handoffs ready**. Send no values, URLs or file contents.
If only some runtime values are available, the second helper also supports
`-Kind Management`, `-Kind Writer` or `-Kind ApifyRead`; report only which kinds
are ready. Do not recreate an already-saved temporary kind.

## Custody and execution boundary

The separate admin pair is
`%LOCALAPPDATA%\Temp\emr-m03-foundation-dev-migration-password.{dpapi,lease.json}`.
The runtime pairs are
`%LOCALAPPDATA%\Temp\emr-m03-acceptance-{management,writer,apifyread}.{dpapi,lease.json}`.
Presence is not authentication. No helper authenticates, deploys, migrates or
starts a workflow. There is no automatic renewal or credential rotation.

The reviewed coordinator validates the complete public source/dependency
closure and administrator public preflight before runtime decryption. Its
private initial packet uses stdin, never command arguments or secret-bearing
environment variables. Each CLI child has a filtered environment; only approved
database operations receive private PGPASSWORD. The parent VS Code process is
not cleared by child cleanup.

The new owned Preview bypass is generated privately by the consumer. It is
removed only after verified environment cleanup/physical child closure. An
ambiguous outcome retains its encrypted handoff for explicit recovery and is
reported as residual, not success. Consumed runtime/admin handoffs and private
scratch are removed after their respective children close. The retained pending
Machine handoff and the owner's saved originals are preserved.

Actual saved versions, native permission/version/body linkage, terminal work,
provider/SQL settlement and DELETE+404 cleanup must pass PhaseB before actors.
The Machine domain-denial check is an additional gated native control. Neither
these local instructions nor a successful private delivery prove acceptance.
Production, recurring schedules, notifications, PRmerge, M03closure and M04
remain excluded. The completed GW01 trial stays closed.

## Zero-setup continuation after the actual transport failure

The initial four-input instructions above remain historical. Do not run the
administrator helper again: that pair was never consumed. Three runtime pairs
were consumed and verified deleted after physical child closure. No prepare or
remote request occurred. See [the actual receipt](dev-acceptance-transport-20261021.md).
Wait for corrected checks/seal readiness before creating replacements.

In Windows PowerShell under this same Windows account, first remove only the
unused encrypted local bypass left by that attempt:

```powershell
Remove-Item -LiteralPath "$env:LOCALAPPDATA\Temp\emr-m03-acceptance-protection-bypass.dpapi" -ErrorAction Stop
Test-Path -LiteralPath "$env:LOCALAPPDATA\Temp\emr-m03-acceptance-protection-bypass.dpapi"
```

Expected result: `False`. It was never installed remotely. Keep all saved
original credentials. Then replenish only the three existing runtime inputs:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03AcceptanceHandoff.ps1' -Kind All
```

Hidden prompts: existing n8n Management key, existing emr-dev n8n_writer password,
then same-owner Apify READ token. No reset/newkey/Admin/Machine/production input.
Expected prefix: `M03_ACCEPTANCE_HANDOFF_READY: All.` Close PowerShell and reply
**M03 runtime replenished; unused bypass deleted**. Send no values or file contents.

Continuation is explicit `-ResumeZeroSetup` over a verified interactive transport.
It preserves original stop-new11:50:23.481/actiondeadline12:00:23.481 UTC on
21October2026, counters and source. It does not restart an hour. If the cutoff
has passed, do not create new handoffs for this closed window.

Automatic approval review rejected Codex's exact temporary bypass deletion
before execution with “blocked by policy.” That is why the owner cleanup command
is required; no deletion or alternative route was performed by Codex.
