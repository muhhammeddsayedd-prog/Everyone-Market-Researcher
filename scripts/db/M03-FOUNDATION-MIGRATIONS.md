# Approved M03 dev database entry

The owner approved A–D on 21 October 2026 at reviewed PR8 head
`f42930f90c2de43c84f61ad6d966d0ee6074d70e`. This new entry preserves the ten
applied versions, the permanently closed GW-01 lifecycle, M02 data and all four
reviewed pending migration files. It creates no new migration.

The public packet is `m03-foundation-dev-migration-packet.json`. Its fourteen
file/history digests are immutable inputs. The ten original statement digests
were checked against the prior reviewed packet before the four new digests
were derived with the unchanged public CLI2.121.0 SQL splitter. This offline
derivation is source preparation, not hosted history verification.

The new hidden-input helper is:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\db\windows\New-M03FoundationMigrationHandoff.ps1'
```

Run it in Windows PowerShell under the same Windows account only after the
reviewed consumer/public seals are ready. Enter the existing emr-dev postgres
password at its hidden prompt. No reset, writer password, production password,
PAT or new MCP setup is needed. Expected output begins
`M03_FOUNDATION_MIGRATION_ADMIN_READY`. Close that PowerShell window and retain
the saved original. The owner delivers only readiness, never file contents.

It creates the distinct temporary pair
`%LOCALAPPDATA%\Temp\emr-m03-foundation-dev-migration-password.dpapi` and
`emr-m03-foundation-dev-migration-password.lease.json`. The explicit purpose is
`m03-foundation-phase-a-dev`, approved-source SHA fixed above, with a two-hour
delivery lease. It refuses either preexisting file. Presence proves no login.

Public `Invoke-M03FoundationMigrations.ps1 -CheckOnly` validates packet/source,
physical executables, CA, purpose/lease and presence without private reads or
network. The parent coordinator uses `startFoundationAdminClient()` from
`foundation-admin-client.mjs`, which starts that new consumer with
`-PhaseAControl`. Node never reads or receives the administrator password.

The sealed PowerShell parent verifies strict TLS without a password, decrypts
only this new handoff, then supplies PGPASSWORD only to its approved CLI DB
children. The fixed URI targets
`postgres.zmotjsbzhzjvpelxvxlf@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
with verify-full and the pinned public CA. The URI has no password component.
Every child has an OS-only environment plus its private DB password. Raw native
errors/stdout never reach the public receipt.

The migration stage accepts only exact ten-version history or already-complete
fourteen-version history, including original CLI statement digests. From ten,
it requires an exact four-file dry-run, no roles/seeds, one durable push intent,
one push, then readback. Query retains both JSON flags; push uses structured
`--output-format json` alone. An ambiguous response triggers history readback,
never another push. Partial/mismatched history blocks continuation.

The bounded persistent parent exposes only these fixed JSON-line commands:

| Command                 | Fixed effect                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `postcheck`             | Catalogue/RLS/ACL/invoker/closed-GW01/baseline checks; direct security/performance advisors; actual four-schema type generation plus AST equivalence to checked-in types |
| `preflight`             | Actual price book, unchanged budget/statistics settings, WF19 error count and cooldown readback                                                                          |
| `fixture`               | The reviewed C999 setup DO body and its ownership/baseline assertions; no conflicting fixture adoption                                                                   |
| `provision`             | One durable owner intent; existing owner RPC with exact new Preview/deployment/source, fixed distinct foundation window/build/USD1+2 limits; actual matching readback    |
| `settlement`            | Exact canonical read-only SQL, fixed window, at most256 request UUIDs/120 native IDs/two actual terminal-cost samples                                                    |
| `unknownCallbackAbsent` | Fixed synthetic unknown-run absence check                                                                                                                                |
| `firstOriginalContext`  | Only ordinal1 original launch/registry, its durable bounded dataset read and actual keyed cost entry                                                                     |
| `verifyAtomicInput`     | Read-only PostgreSQL JSONB digest/scalar parity against that original processing receipt                                                                                 |
| `replaySnapshot`        | Scoped fixture items/raw rows/queues/original-cost counts and hashes                                                                                                     |
| `smokeAssert`           | Existing smoke assertions for exact run/original IDs and expected item delta0/1; no webhook-delivery claim                                                               |
| `close`                 | Existing permanent foundation Close, separate from GW-01                                                                                                                 |
| `archive`               | Reviewed ownership-checked pause/archive, retaining all test/business rows                                                                                               |
| `end`                   | Close the bounded parent and verify cleanup; provisioned windows must already be closed                                                                                  |

Commands accept no SQL, filenames, roles or CLI arguments. CLI2.121.0 uses one
prepared statement for `db query`; the fixture/assert DO body therefore runs as
one implicit transaction with its fixed local settings inside, followed by a
separate fixed readback. No psql control syntax is sent to the CLI.

The private parent has a70-minute maximum lifetime, a60-minute action deadline
and a stop-new-work boundary at minute50. The delivery lease must have75 minutes
remaining for this mode. Existing-outcome readback, Close/archive/end are safety
operations within the parent ceiling. The gateway's separately enforced clock,
attempt/lease/actor limits are not extended. No inactive setup or connection
trial is replayed.

The client sends EOF on failure/abort so the reviewed parent can finish its
bounded current CLI call and run cleanup; it does not kill only the parent and
orphan a password-bearing child. Closure is accepted only from native completion
and the final cleanup receipt. Consumed encrypted pair and owned scratch are
removed. Parent VS Code credentials/environment are not cleared by child cleanup.

New test commands (synthetic isolated Windows DPAPI/native CLI, never hosted):

```powershell
node --test scripts/db/m03-foundation-migrations.test.mjs
node --test scripts/db/foundation-admin-client.test.mjs
```

Public CLI contract sources are the pinned
[advisor handler](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/advisors/advisors.handler.ts),
[query handler](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/query/query.handler.ts)
and [output layer](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/shared/output/output.layer.ts).
Local SQL syntax/catalogue checks remain separate from hosted acceptance. No
production operation, recurring activation, merge or M04 is included.
