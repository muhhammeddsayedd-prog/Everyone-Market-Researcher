# Fresh delivery for the approved single admission window

The owner approved the single clock amendment. Its concrete consumer must pass
independent review, affected checks and actual public seal/CheckOnly before this
delivery is requested. No new general dev/batch/clock approval is needed.

Actual metadata-only read310117 at13:23:09 UTC shows the old administrator lease
expired; the three runtime leases are still unexpired but none covers the new
75-minute admission floor. All four ciphertexts remain untouched/unconsumed.
Do not edit or extend any lease. Only these four existing-secret deliveries need
refresh. The saved originals, Machine handoff and unrelated files are preserved.

## Exact owner action after consumer readiness

In **Windows PowerShell under this same Windows account**, paste this block.
It replaces only the eight named temporary DPAPI/lease files. It does not
authenticate or start the admission clock.

```powershell
$emrM03TempDirectory = Join-Path $env:LOCALAPPDATA 'Temp'
if (Test-Path -LiteralPath (Join-Path $emrM03TempDirectory 'emr-m03-acceptance-parent.operation.lock')) {
  throw 'An M03 acceptance child owns these handoffs; stop.'
}
$emrM03Admission = 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\out\foundation\live\clock-amendment-30e75d0d-7e4c-46c6-9a07-556f90b63859.json'
if (Test-Path -LiteralPath $emrM03Admission) {
  throw 'The single clock segment is already recorded; stop.'
}
$emrM03TemporaryFiles = @(
  'emr-m03-foundation-dev-migration-password.dpapi',
  'emr-m03-foundation-dev-migration-password.lease.json',
  'emr-m03-acceptance-management.dpapi',
  'emr-m03-acceptance-management.lease.json',
  'emr-m03-acceptance-writer.dpapi',
  'emr-m03-acceptance-writer.lease.json',
  'emr-m03-acceptance-apifyread.dpapi',
  'emr-m03-acceptance-apifyread.lease.json'
)
foreach ($emrM03TemporaryFile in $emrM03TemporaryFiles) {
  $emrM03TemporaryPath = Join-Path $emrM03TempDirectory $emrM03TemporaryFile
  if (Test-Path -LiteralPath $emrM03TemporaryPath) {
    Remove-Item -LiteralPath $emrM03TemporaryPath -ErrorAction Stop
  }
}
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\New-M03FoundationMigrationHandoff.ps1'
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03AcceptanceHandoff.ps1' -Kind All
```

Hidden prompts, in order:

1. Existing emr-dev postgres database password for zmotjsbzhzjvpelxvxlf. Separate
   bounded DB child only; never n8n, web runtime, installation or production.
2. Existing n8n Management key for muhhammedsayed.app.n8n.cloud.
3. Existing emr-dev n8n_writer password saved from M01.
4. Existing same-owner Apify READ token for Actor runs/Datasets/Key-value stores.

Use no production, Machine, api_agent, Supabase secret key or new credentials.
No reset or rotation. Expected non-secret prefixes:

```text
M03_FOUNDATION_MIGRATION_ADMIN_READY
M03_ACCEPTANCE_HANDOFF_READY: All.
```

Close that PowerShell window, retain your password-manager originals and reply
**M03 amended-window handoffs ready**. Send no values, URLs, ciphertexts or file
contents. Presence is not authentication. Temporary delivery is valid for two
hours; the actual75-minute admission coverage is rechecked before decryption.

## Consumer and cleanup boundary

The reviewed real entry is `Invoke-M03Acceptance.ps1 -ClockAmendment`, over the
verified interactive public nonce/ACK transport. Its public `-CheckOnly
-ClockAmendment` never admits or decrypts. The actual single CreateNew admission
and runtime claim are durable before any business operation; no automatic retry,
clock refill or second child is allowed. Waiting for owner inputs/public checks
does not start this clock. Original expired header/counters/receipts remain.

Consumed temporary files/private scratch are removed after physical credential
children close. Partial/unknown admission or claim records are retained as a
fence. Saved originals and retained Machine remain. Clearing/closing a child
does not clear the parent VS Code environment.

Same original dev scope/caps/actor reserve; PhaseB/domain gates precede actors.
Production, schedules, notifications, shared credentials, private incidentR2,
PRmerge/M03closure and M04 stay excluded. GW01 remains closed.
