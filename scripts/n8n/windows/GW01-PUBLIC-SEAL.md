# Public seal, reviewed advancement and CheckOnly

This is a public-only procedure for the same Windows account, run only when the
coordinator requests an exact reviewed checkpoint. No public seal run is
requested now: the actual initial CheckOnly and subsequent reviewed advances
are already recorded. Writer/Machine handoffs are ready; current local
runtime-phase/public-config work is recorded in
[M03 progress](../../../milestones/M03-n8n-foundation/PROGRESS.md). No repeat
handoff creation or public seal run is requested here.

The earlier standalone dependency-link diagnostic was rejected before execution
with `blocked by policy`. It remains historical; do not use this helper as an
alternate wrapper to retry a rejected action. After the later explicit owner
request, the unchanged reviewed helper ran through the accepted normal tool and
passed actual public CheckOnly. The owner-reported error was not reproduced and
its cause remains unknown. See the
[historical local record](../../../milestones/M03-n8n-foundation/evidence/local-gw01-gateway-consumer-20261018.json)
and [actual workstation receipt](../../../milestones/M03-n8n-foundation/evidence/gw01-workstation-check-20261018.json).

The reviewed Preview, actual CloudA proof, dedicated ProtectionBypass handoff and
existing journal must be present. Do not fabricate proof, alter flags, recreate
the journal, change counters or put a secret in a command. The helper takes no
path or secret arguments. It checks pinned source before AST inventory parsing,
the physical Zod4.6.7/Vercel56.5.0 runtime files, the permitted shared-Zod
junction, and the registered deployment identity.

For an initial seal or exact identical reuse, the command is:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03GW01GatewayPublicSeal.ps1'
$LASTEXITCODE
```

A differing seal normally stops. Only after separate review of a concrete
public transition, the fixed advancement command is:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03GW01GatewayPublicSeal.ps1' -AdvanceReviewedConfig
$LASTEXITCODE
```

The coordinator prepares the ignored fixed file
`scripts/n8n/gw01-gateway-transition.json`; no user-selected packet path exists.
Its exact fields are `version:1`, the fixed `windowId`, `previousSealSha256`, and
`newFiles`. The latter accepts only reviewed hashes for
`scripts/n8n/gw01-reviewed-preview.json` and
`scripts/n8n/gw01-cloud-privacy.json`. It cannot nominate source or runtime paths.
The helper separately compiles only the current reviewed old-to-new pair for
`gw01-gateway-transport.mjs` and `windows/Invoke-M03GW01Gateway.ps1`.
Every other file/runtime hash and original
trial config must remain unchanged. Old digests require strings of64 lowercase
hex characters before comparison; the old runtime baseline is verified before
executing any public runtime code.

The initial deployment tuple is compiled. A later target must already have a
validated append-only deployment event containing its exact
`{audience,commitSha,deploymentId,projectId,branch}`. Register only a separately
reviewed actual deployment while prepared/closed. An unknown or changed tuple
blocks before seal installation or private use. Registration neither resets
attempts nor starts or extends the clock.

An advance preserves predecessor bytes, an immutable transition intent and the
atomic replacement backup under
`scripts/n8n/out/gw01/public-seals/<previousSealSha256>.json`,
`<previousSealSha256>.transition.json` and
`<previousSealSha256>.replace-backup.json`. Stale hashes, differing runtime,
reparse paths, collisions or partial artifacts stop. The live inventory
`scripts/n8n/gw01-gateway-seal.json`, packet and archives stay local/ignored.
An intent alone never proves completion. Reconcile actual old/new hashes and
read-only CheckOnly after an ambiguous return; never replay an installation or
remove evidence to force success.

After successful sealing, the helper launches only
`Invoke-M03GW01Gateway.ps1 -Mode Probe -CheckOnly` in a bounded child with a
limited operating-system environment. This performs no DPAPI read/decryption,
gateway POST, platform log read, attempt reservation or clock start. Expected
output is `PUBLIC_SEAL_READY`, followed by the safe receipt below, then `0`:

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

If requested in a future reviewed phase, reply **GW-01 public seal and CheckOnly
ready; privateRead false; exit0**. Send no credential, file content, environment
output or connection string. Fixed `PUBLIC_SEAL_BLOCKED` or
`PUBLIC_CHECK_ONLY_BLOCKED` means stop and report only that code/exit code; retain
the existing seal, journal, archives and handoffs. Do not weaken a guard or
repeat a private request.

Actual source advancement completed native0 with public CheckOnly. The second
proof/config advancement's original native completion was not captured; its
expected current seal/archive/backup and fresh read-only CheckOnly native0 were
then independently reconciled without reinstalling. See
[actual transitions](../../../milestones/M03-n8n-foundation/evidence/gw01-public-seal-transitions-20261018.json).
Neither this public procedure nor its completion proves restricted database
authentication or a live trial result.
