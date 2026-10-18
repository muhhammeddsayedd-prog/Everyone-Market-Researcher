# Owner-run public seal and CheckOnly

This procedure is for Mohamed in Windows PowerShell under the same Windows
account. Codex has not run it against this workstation's installed dependencies
or handoffs. Automatic approval review rejected the earlier non-secret local
dependency-link diagnostic with `blocked by policy`; it was not executed. This
is an inspection boundary, not an authentication failure. The rejected command
and the unperformed actual guard are preserved in
[`local-gw01-gateway-consumer-20261018.json`](../../../milestones/M03-n8n-foundation/evidence/local-gw01-gateway-consumer-20261018.json).

Run this only after the existing GW-01 coordinator has recorded all three CloudA
privacy checks and confirms that the new, dedicated ProtectionBypass encrypted
handoff is ready. The reviewed Preview manifest and existing trial journal must
already be present. Do not create proof files, change flags, recreate the
journal, deliver a Writer/Admin/Machine password, or put a value in this command.

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03GW01GatewayPublicSeal.ps1'
$LASTEXITCODE
```

The helper takes no path or secret arguments. It checks the pinned reviewed
source, reads the consumer's fixed inventory without evaluating it, verifies
the installed physical Zod4.6.7 and Vercel56.5.0 runtimes, checks the permitted
shared-Zod junction target, and writes the public
`scripts/n8n/gw01-gateway-seal.json`. A differing existing seal stops the helper;
an identical seal is retained. It then launches only the existing
`Invoke-M03GW01Gateway.ps1 -Mode Probe -CheckOnly` in a bounded child with a
limited operating-system environment. It does not decrypt the handoff, call the
gateway, read platform logs, start the trial clock or reserve an HTTP attempt.

Expected output is `PUBLIC_SEAL_READY`, followed by this safe CheckOnly receipt,
then `0` from `$LASTEXITCODE`:

```json
{
  "version": 1,
  "mode": "Probe",
  "status": "check_only_ready",
  "privateRead": false,
  "rootChildClosed": true,
  "nativeExit": null,
  "handoffsRetained": true,
  "result": null
}
```

Reply **GW-01 public seal and CheckOnly ready; privateRead false; exit0**. Send no
handoff file, credential, environment output or connection string. This proves
only public sealing, dependency guards and handoff presence. It does not prove
private credential authentication or a gateway request.

If the output is `PUBLIC_SEAL_BLOCKED` or `PUBLIC_CHECK_ONLY_BLOCKED`, stop and
reply with only that fixed code and the exit code. A public seal may have been
created before CheckOnly discovers a missing prerequisite. Keep it and the
existing journal/handoffs; do not delete or replace a differing seal, edit
dependency targets, weaken assertions or repeat a private request to force a
pass. The coordinator will reconcile the public state first.
