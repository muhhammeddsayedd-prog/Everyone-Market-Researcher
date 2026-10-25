# Temporary inputs for the approved M03 postcheck continuation

The owner approved the exact remaining-window packet at d834968. The four dev
migrations are already applied and must never be replayed. This delivery is for
the new no-push database child and remaining bounded A-D checks, not a new scope
or spending approval. Admission starts only after reviewed source, public seals,
CI, transport and lease checks; entering a password does not start the clock.

All eight temporary input files from the failed attempt were consumed and
deleted. Keep saved originals and the retained dedicated Machine unchanged.
Use this delivery only after the ready-consumer request; no reset, rotation,
new key, administrator substitution for Writer, Machine token or production
credential is needed.

In **Windows PowerShell under the same Windows account**, run:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\New-M03FoundationMigrationHandoff.ps1' -PostcheckContinuation
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03AcceptanceHandoff.ps1' -Kind All
```

Enter the **same saved existing values**, at the hidden prompts in this order:

1. emr-dev postgres database password for `zmotjsbzhzjvpelxvxlf`. Only the
   separate database child uses it for14-version readback, postchecks, the owned
   C999 fixture and exact Preview binding/Close. No migration push, n8n or web
   runtime receives it.
2. n8n Management API key for `muhhammedsayed.app.n8n.cloud`.
3. emr-dev `n8n_writer` password saved from M01. Do not use the postgres,
   api_agent, production or Supabase Secret key here.
4. Same-owner Apify READ token used in the previous attempt, for Actor runs,
   Datasets and Key-value stores readback. Do not extract the saved native n8n
   credential or create/rotate a token merely for this delivery.

Expected non-secret output prefixes:

```text
M03_FOUNDATION_MIGRATION_ADMIN_READY
M03_ACCEPTANCE_HANDOFF_READY: All.
```

Close that PowerShell window, preserve saved originals, and reply:

**M03 postcheck-continuation handoffs ready**

Send no passwords, keys, URLs, ciphertext or file contents. The helper creates
two-hour DPAPI handoffs; actual metadata and75-minute coverage will be verified
before decryption/admission. A readiness reply alone is not authentication or
acceptance. The child removes consumed temporary files/private scratch after
physical closure. Child cleanup does not clear a parent VS Code environment;
this workflow supplies credentials through scoped handoffs rather than setting
them in that parent.

Production, schedules, external notifications, shared credential changes, PR8
merge, M03 closure, private incident R2 and M04 remain outside this delivery.
