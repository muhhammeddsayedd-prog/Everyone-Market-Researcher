# M03 additive dev database packet

Target: **emr-dev / zmotjsbzhzjvpelxvxlf** only. Production is excluded.
Authorization: owner's 18 October **Proceed with the next milestone**. This is
the reviewed implementation/credential-delivery record, not a new general dev
approval request.

## Completed dev deployment — do not replay

The corrected bounded consumer completed native0 as
`03a85d53-9ad2-4d42-abb0-08945872e707`. Exact two-version dry-run, push and
nine-version history match passed. Independent dev MCP verifies12 restricted
RPCs, receipt/indexes,17 reviewed prices, daily alert budget25, preserved
285 competitors/1754 accounts/seven owner exclusions/257 logos and no smoke
fixture or collection. Fresh advisors report0 WARN/ERROR. The handoff/scratch
were deleted, credential-bearing children closed, successful admission retained.
No further database handoff or execution is needed. [Completion](dev-migration-completion-20261018.json),
[schema/type coverage](dev-post-migration-schema-20261018.json),
[advisors](dev-post-migration-advisors-20261018.json).

Both earlier failed attempts remain in [the actual history](dev-migration-attempt-20261018.json).
The pinned CLI output-flag conflict and command-specific correction have
[source reproduction and review](cli-output-protocol-20261018.json). The first
discarded failure remains unknown; successful completion does not rewrite it.

## Exact changes

The [public machine packet](../../../scripts/db/m03-dev-migration-packet.json)
seals all nine migration files, the seven existing hosted statement digests,
the two new locally verified statement digests, both PowerShell helpers, the
pinned native CLI 2.121.0 executable and the public TLS dependencies.

| Pending version | Name | Source SHA256 |
| --- | --- | --- |
| `20261018034220` | `rpc_n8n_foundation` | `457ad4351b08c47b996ae67062ed701efb7d5ef63ea7658d20931f2d5dc5d3fd` |
| `20261018035417` | `price_book_plan` | `779f55b29db698f89d64bab6b099b29b3c7485d8d021d14b0bb2e15488e680cd` |

The first adds 12 private worker RPCs, a durable callback receipt column and a
keyed-cost index. It does not expose RPCs to the Data API or grant application
roles direct table access. The atomic callback is bounded to the later owned,
one-page dev smoke fixture; applying the migration does not create that fixture
or execute any collector. The second records reviewed Apify Scale prices,
explicitly marks unknown prices/fees and moves the known budget default from
150 to the Q-07 steady-state alert threshold of USD25. That alert is not a
provider spending cap.

The seven M01 versions/files remain unchanged. `seed.sql`, the C999/Test House
fixtures, real competitor/account data, production, provider calls, workflow
execution and schedules are excluded. No seed/role script is part of this push.

## Evidence before hosted use

The two migrations were applied once to the owned local stack without reset or
seed. Actual native CLI testing passed all **379 assertions in 11 SQL files**;
both advisors reported zero WARN/ERROR. Types for app/api/ops/ingest were
regenerated and workspace typecheck passed. Existing local data was preserved.
See [local application evidence](local-applied-db-20261018.json),
[RPC review](rpc-review-20261018.md) and [price regressions](local-price-regressions-20261018.json).
Those are local results, not hosted deployment acceptance.

The new credential consumer has independent source review and synthetic Windows
process tests. It uses the installed native executable directly, an OS-only
child environment and a sealed public scratch workdir; no package loader,
install script, repository `.env` or Vault load receives the password. Public
TLS verifies the exact pooler hostname with the pinned CA before decryption.
The public seal check completed and found the **new M03 handoff absent**; no
decryption or authentication occurred. Old milestone handoffs remain untouched.

## Historical private delivery reference — already completed

In **Windows PowerShell under the same Windows account**, run:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\New-M03DevMigrationHandoff.ps1'
```

At the hidden prompt enter the **existing emr-dev administrator database
password** for `zmotjsbzhzjvpelxvxlf`, from your password manager. Use no
production password, n8n_writer/api_agent password or Supabase API secret key.
No reset is needed. This writes only the new temporary DPAPI file
`%LOCALAPPDATA%\Temp\emr-m03-dev-migration-password.dpapi` and refuses to
overwrite an existing file.

Expected result starts **M03 dev migration encrypted handoff saved.** Close
that PowerShell window and reply **M03 dev migration handoff ready**. Send no
password, ciphertext, file contents or raw errors. Keep your saved original.

## Bounded execution and reconciliation

Codex first runs:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\Invoke-M03DevMigrations.ps1' -CheckOnly
```

Expected `M03 CHECK_ONLY_READY` proves public seals/target and handoff presence
only. The bounded consumer is then invoked once without `-CheckOnly` under the
existing M03 dev authorization. It uses the password-free URI for
`postgres.zmotjsbzhzjvpelxvxlf` at
`aws-1-eu-central-1.pooler.supabase.com:5432/postgres`, `sslmode=verify-full`,
and private child-only `PGPASSWORD`. No password appears in arguments.

Before writing, it checks actual current/session identity and exact hosted
history. The dry-run must list exactly the two pending files and no seeds or
role scripts. It records a durable exclusive push admission, performs one
push, then reads actual history again even after a nonzero/ambiguous native
result. A marker is never automatically removed to permit replay. Unexpected
history, a partial apply or an ambiguous response requires read-only
reconciliation and an explicitly reviewed continuation; never reset, fabricate
history, rename versions or blindly repeat the push. An already complete
history is verified without replay.

Consumed temporary ciphertext is deleted in `finally`, credential-bearing
children are closed and only the owned scratch directory is removed. Cleanup
failure is a failure even if SQL succeeded. Fixed public receipts are written
under ignored `scripts/db/out/`; raw stdout/stderr/private values are withheld.
This consumer does not put the password in the parent environment. Closing its
child cannot clear a password separately inherited by VS Code; no such parent
configuration is requested here.

After deployment, dev-scoped MCP readback verifies exact history, private RPC
ACLs, receipt/index presence, reviewed price/settings values and unchanged
285/1,754 baseline with zero items/actor runs. Hosted advisors and generated
schema coverage are recorded separately. If a defect appears, stop writes and
use a new reviewed forward migration; do not drop receipt data or undo migration
history. No production recovery action or production deployment is authorized.
