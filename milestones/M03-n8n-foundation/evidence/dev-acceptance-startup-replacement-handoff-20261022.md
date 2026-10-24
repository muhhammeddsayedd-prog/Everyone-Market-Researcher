# Approved M03 startup-replacement credential delivery

The owner approved the exact packet at reviewed PR8 head
`7262f6459e2b04713dda8d2912970c496585b4f3`. The actual reply is preserved in
[the approval record](dev-acceptance-startup-replacement-approval-20261022.json).
This is saved-value delivery for that approval, not a new time decision.

Run these commands only after Codex confirms the approval-pinned consumer,
public seal/readiness and final delivery CI pass. No clock starts here.

Actual metadata check `2de0da` at 09:14:23 UTC found the Admin pair expired and
the Management, Writer and ApifyRead pairs absent. Bounded cleanup `effe3b`
at 09:16:21 UTC removed only the two expired temporary Admin leaves, without
reading/decrypting the password. All four input pairs therefore need fresh
temporary delivery; keep the same saved originals. No reset or new key is needed.
The original nine-leaf cleanup and historical Admin-pair observation stay intact.

## Exact owner action

Open Windows PowerShell under the same Windows account and run:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\New-M03FoundationMigrationHandoff.ps1' -StartupReplacement
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03AcceptanceHandoff.ps1' -Kind All
```

The four hidden prompts, in order, require:

1. The EXISTING emr-dev postgres database password for
   `zmotjsbzhzjvpelxvxlf`. Its separate bounded child performs only fourteen-version,
   critical catalog/global-vacancy readbacks, the exact retained-C999 operation,
   exact dev Preview binding and Close. No migration operation; it never enters
   n8n or the web runtime.
2. The EXISTING n8n Management API key for `muhhammedsayed.app.n8n.cloud`.
3. The EXISTING emr-dev `n8n_writer` password saved from M01.
4. The EXISTING same-owner Apify READ token used previously, for Actor runs,
   Datasets and Key-value stores READ. Do not extract the native n8n credential.

Expected output prefixes:

```text
M03_FOUNDATION_MIGRATION_ADMIN_READY
M03_ACCEPTANCE_HANDOFF_READY: All.
```

Close that PowerShell window, keep your saved originals, then reply:
**M03 startup-replacement handoffs ready**.
Send no password, key, URL or file contents. No Machine token, production value,
Vimeo/YouTube credential, password reset or key rotation is requested.

The temporary pairs have two-hour leases. Codex must verify at least 75 minutes
of actual coverage, current source/transport/provenance and the absence of any
new admission before using them. Delivery does not start the one approved clock.
Original attempts and aggregate ceilings remain; no automatic renewal, migration
replay, production, recurring schedules, external notification, merge or M04.
