# M03 owned inactive foundation provisioning

The local `All` consumer saves the 25 complete generated foundation definitions
under existing M03 development authorization. It does not start live acceptance.
GW-01 remains closed; its unused allowance and credentials are never reused.
This delivery uses distinct identifier `df4f29ec-e2dc-4d82-a276-62a4e695e6f9`.

The public delivery packet now records the verified immutable dev Preview
`dpl_9unUfg4bApFVsuSfzdSEocZ4tKfb`, source
`9719cc849f35f7a0e19dc826a022f4a845192433`, at
`https://everyone-market-researcher-8f7sa5lox-muhammed-abdelrahman.vercel.app`.
Its recorded deployment metadata is distinct from source-seal readiness and
any future authenticated runtime acceptance. No synthetic or fallback audience
fills this input; `activationAuthorized` remains false.

## Finite phases

| Phase   |                                        Maximum management requests | Result                                                                                                |
| ------- | -----------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------- |
| Shells  |        53: project GET, two scoped-list GETs, 25 POSTs and 25 GETs | Actual owned workflow IDs, inactive credential-free noOp shells                                       |
| Tags    |                28: two list GETs, 13 missing-tag POSTs and 13 GETs | Reuse canonical existing tags; create missing canonical names only                                    |
| Machine |                4: schema GET, absent-ID GET, POST and metadata GET | One new owned `httpCustomAuth`, `EmrFoundationMachine19`, display name `M03 foundation machine [dev]` |
| Binding | 100: pre-read, graph PUT, tag PUT and final GET for each of 25 IDs | Actual inactive full definitions and matching sanitized source projections                            |
| Total   |                                                            **185** | Zero executions, activation, provider requests or environment mutations                               |

Tag association has its own PUT because workflow tags are read-only in the graph
PUT schema. Existing canonical tags and completed stages reduce actual requests.
Calls are sequential, without HTTP retries. Before decrypting, the consumer
requires at least 41 minutes remaining on the two-hour Management lease. The
child has a 40-minute deadline, and every HTTPS request also observes the
absolute lease expiry; use a polled process session for progress.
Native socket completion, native child closure and hosted acceptance are distinct.

The exact target is Personal `pHvQjDmjxVZ3KQLT` on
`muhhammedsayed.app.n8n.cloud`. Existing provider credential IDs/types are reused
from `n8n/foundation/bindings.dev.json`. No provider credential is renamed,
duplicated, tested or altered. Final graphs use the fixed HTTPS transport, not
native Postgres, and WF-99's functional launch path remains guarded false.

## Public preparation before the single existing-key request

Root/independent review and a fresh source seal are required before private use.
The PowerShell consumer verifies all 32 public source/configuration inputs,
the complete physical pinned Zod tree and its one reviewed resolution junction,
and the exact selected Node executable path/hash before a private read. The
public runtime module is itself hash-checked before dot-sourcing it. An explicit
reviewed `New-M03FoundationPublicSeal.ps1 -ReplaceReviewedSeal` builds the seal;
the private consumer never regenerates it. `foundation-provision-seal.json` also pins the public delivery
packet by `packetSha256`. A missing packet is represented by null, not a guessed
deployment; `All` stops before reading the handoff in that state.

The public packet is `scripts/n8n/foundation-delivery-packet.json`, with exact
fields: version 1; the distinct identifier; actual immutable Preview audience;
actual source SHA and deployment ID; environment `preview`; and
`activationAuthorized: false`. Root fills it from actual deployment readback
after source delivery. No value or runtime activation is implied by this packet.

```powershell
node --test scripts/n8n/foundation-*.test.mjs
node scripts/n8n/foundation-provision-cli.mjs CheckOnly
& '.\scripts\n8n\windows\Invoke-M03FoundationProvision.ps1' -CheckOnly
```

Expected public checks: no private read/network; complete source preparation;
maximum 185; and final binding readiness only when the actual sealed packet
exists. They do not authenticate or prove current API/project/workflow state.

Only after source, packet and review are ready, the owner can deliver the
**existing** saved management key with one command under the same Windows account:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03FoundationHandoff.ps1'
```

The hidden prompt needs the existing key for this exact n8n instance. No writer,
postgres, production or provider credential is needed. Expected output starts
`M03_FOUNDATION_MANAGEMENT_READY`. Close that PowerShell window, preserve the
original saved key and reply `M03 foundation Management ready`; send no value.
This creates only `emr-m03-foundation-management.dpapi` and its `.lease.json`
companion under `%LOCALAPPDATA%\Temp`, for two hours and the fixed purpose.

Then the reviewed bounded consumer is:

```powershell
& '.\scripts\n8n\windows\Invoke-M03FoundationProvision.ps1' -Mode All
```

It strips unrelated child environment variables, sends secrets only through the
owned child's stdin, suppresses raw errors, returns fixed stage/HTTP diagnostics
and removes the consumed Management handoff/lease after child closure. It does
not clear a parent's environment or remove the owner's saved original key.

## Dedicated pending Machine storage

For `All`, the bounded PowerShell child generates a new random Machine token or
reuses the exact previously generated pending token after metadata checks. It
never extracts a shared n8n credential. The token is DPAPI-encrypted at:

`%LOCALAPPDATA%\Everyone-Market-Radar-Private\foundation\df4f29ec-e2dc-4d82-a276-62a4e695e6f9\machine.dpapi`

`pending-runtime.json` binds that private store to the exact audience, source,
dedicated credential ID and pending-inactive-runtime-delivery purpose. This is
controlled pending runtime storage, distinct from the expiring temporary
Management handoff. It is retained for the separate approved runtime delivery;
no database admission window or active authority exists merely because it is
saved. A mismatch, partial store or unverified credential outcome stops rather
than regenerating/rotating a token. The final acceptance packet must explicitly
cover its delivery and removal, or revocation/removal if that packet is declined.
Do not silently leave an orphan credential/store or delete the token before an
ambiguous creation has been reconciled. No plaintext/token hash enters Git,
arguments, receipts, exports or logs.

## Durable ownership and unknown outcomes

An exclusive owned operation lock is acquired before private handoff reads and
held through pending-store access, child completion and temporary cleanup. A
second consumer fails before decrypting or deleting the first consumer's handoff.
Both append-only journals under `scripts/n8n/out/foundation` are fsynced before
every mutation. Source identifier, canonical keys and ID/hash transitions must
validate. Do not reconstruct/reset a missing ledger or adopt an unknown workflow.

- A same-name workflow without original local intent blocks provisioning.
- Ambiguous shell POST leaves its original intent. `Reconcile` is GET-only and
  requires one exact owned match; zero or duplicate matches stay blocked.
- Tag creation ambiguity is reconciled by complete bounded canonical metadata
  readback. A still-missing name does not authorize another POST.
- The dedicated credential's original intent is reconciled by exact-ID metadata
  GET only. Unsupported/forbidden metadata, missing ID or a data-bearing response
  blocks; there is no extraction, password reset or blind second create. The
  fresh POST explicitly targets Personal; metadata readback proves ID/type/time,
  not independent current credential-project ownership if the API omits it.
- Graph/tag PUT intents bind the exact source hash and actual owned workflow ID.
  Fresh readback reconciles unknown outcomes. A changed graph/project/publication/
  retention state blocks before overwrite; a negative read is not a retry permit.
- Pagination beyond two pages, scope mismatch, compressed/ambiguous HTTP framing,
  malformed UTF-8, secret reflection or unknown cleanup stays explicit failure.

Actual successful outputs are the receipt, 25 source-matched sanitized exports in
`n8n/workflows/<key>.json`, completed actual workflow/tag refs in
`n8n/foundation/bindings.dev.json`, and the separate actual inactive transport
binding. Updating these public output refs changes an input hash; review and
refresh the public seal before any later private use. No extra key is requested
just to repeat a successful delivery.

## Evidence boundaries

Local tests use synthetic API data and isolated Windows fake handoffs only. They
verify all 25 generated graphs through the same closed request allowlist, reject
extra executable node flags/settings, require the actual TLS socket to close,
block near-expiry leases before decrypting, serialize simultaneous consumers, and resume
without POST/PUT, stop on unknown edits, preserve intents, reject secret-bearing
extras and close the local credential consumer. They do not prove a saved Cloud
definition, an endpoint result, an actor run or full foundation acceptance.

The current official [workflow API schema](https://docs.n8n.io/connect/n8n-api/workflow.md)
supports explicit create project, inactive readback and separate tag association.
[Tags](https://docs.n8n.io/connect/n8n-api/tags) provide metadata/create operations.
The restricted credential shape reuses the previously verified n8n 2.43.5
metadata-only create/read path. Documentation/source knowledge is distinct from
the instance's current authenticated API scope. Existing failures remain in the
evidence; no discovery/login loop is introduced.

The next live-acceptance packet retains separate authority for new dev migrations,
runtime/window configuration, actor/multi-workflow executions and full cleanup.
This inactive provisioning does not approve those actions, production, merge or
M04. Unknown subscription fees remain unknown.
