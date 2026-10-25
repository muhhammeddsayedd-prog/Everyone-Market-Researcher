# M03 closed-window repair — forward-only dev change

The actual restricted Writer Close and independent Admin readback permanently
closed window `df4f29ec-e2dc-4d82-a276-62a4e695e6f9`: close count1, admitted2.
C999 is separately verified archived/paused, with four original audits and zero
items. Those receipts and all failed attempts remain unchanged. Reopening that
row would contradict the owner's standing development instructions.

The applied schema still permits only that original window. This dev repair
uses the existing fixed-family table and consumers. It adds one CLI-created
migration, `20261023163755_m03_foundation_window_continuation`, without editing
any of the14 applied migration files or history entries. Its file SHA256 is
`08400005da4b595d7d1222ff77c31ba745968c3ab3d9dc1d7353f5531c7c8fde`;
the actual CLI2.121.0 statements-history SHA256 from isolated replay is
`12e313d1c6337209cf7657d6d076b101f446b567033c2d2b3e65c38dbbe7ed18`.
These are public source/history fingerprints, not credential hashes.

The schema allows an owner-only registration of a fresh dev window after
verified closure, quiescence and exact fixture identity checks. It cannot reopen
or update an existing window. One active window is allowed. Gateway counts,
rates, two sequential actor admissions, USD1 per start/USD2 total reserve and
the one-distinct-item guard apply cumulatively across the fixed dev family.
RLS, invoker views and restricted machine-role access remain required. No new
credential system, general registry or replacement-window script is introduced.

## Local evidence

The isolated PostgreSQL17 suite passed15/15 actual cases, including restricted
logins, permission denials, unknown UUIDs, dirty/human-edited fixture rejection,
concurrent registration/admission, shared request/rate limits, Close/expiry,
retained actor spending, NULL usage rejection and atomic item-limit rollback.
The nested ingest effect is a synthetic transaction stub in that focused suite;
it is not proof of the full hosted collection pipeline.

An independent full replay used actual pinned CLI2.121.0 and all15 migrations
against an owned disposable Supabase PostgreSQL17 image. Dry-run/push native0
listed15 migrations and zero seed/role files. All14 original source and ledger
fingerprints matched. Both local advisors returned zero findings. Four-schema
type generation changed only the provision function's overload; local catalog,
ACL, RLS and composite-key checks passed. The empty reference database correctly
failed fixture-specific baseline/GW01/prior-window checks, which are required on
hosted dev instead. No real credentials or hosted database were used.

The reference container and network were removed, and the unrelated healthy
local stack was read back unchanged. Automatic approval review blocked deletion
of the owned reference folder with the generic reason `blocked by policy`.
No alternate deletion was attempted. Its public/vendor/reference files and
synthetic local authentication context remain at
`C:\Users\iway\AppData\Local\Temp\emr-m03-full-ref-408a41a0694a`;
there are no real credential handoffs there.

The [retained SQL suites](forward-continuation-retained-sql-20261023.json) also passed176 actual pgTAP assertions on an empty isolated full15 replay. Their owner-only rollback fixtures now distinguish registration from argument/approval denials, and the existing CI runs them before its seeded test-house phase. Native CI safety tests verify that order and failure stops. A separate retained-TAP reference folder, `C:\Users\iway\AppData\Local\Temp\emr-m03-retained-tap-7c0f28e5`, also remains after policy-blocked cleanup; its owned container is removed and it contains no real handoffs. Exact optional cleanup commands are in current M03 progress.

## Exact hosted procedure and recovery

The existing `scripts/db/windows/Invoke-M03FoundationMigrations.ps1` has one
exclusive `-ForwardMigration` mode. Its separate14-baseline/one-pending packet
preserves the original packet's migration arrays. The coordinator runs:

```powershell
& '.\scripts\db\windows\Invoke-M03FoundationMigrations.ps1' -ForwardMigration -CheckOnly
& '.\scripts\db\windows\Invoke-M03FoundationMigrations.ps1' -ForwardMigration
```

The public check opens no credentials. The bounded administrative child selects
only the persistent dev Admin entry, verifies the exact dev session-pooler and
strict public CA, and uses a password-free URI with private PGPASSWORD. It reads
actual history and exact archived/closed state, matches an exact one-version
dry-run, rechecks state, writes a durable one-use push intent and applies only
the fifteenth migration. No seed.sql, fixture mutation, window registration,
Preview change, workflow execution or actor/provider call is part of this mode.

An ambiguous push response requires actual history/schema reconciliation before
anything else. An existing intent with only14 versions blocks another push;
15 verified versions continue with read-only postchecks. Never fabricate
history, reset, replay successful operations or roll back by deleting data.
Postchecks require15-version parity, closed/archive preservation, all catalog
checks, both hosted advisors and generated-type equivalence. Originals persist;
the administrative child and private scratch must close before completion.

The existing generic `-ForwardWindow` profile is a separate later acceptance
path, derived only from the reviewed project proof. Its selected application
source is `a5e746736893d5040e93032ae740a0878f748837` / CI39990446858, with all
five jobs and Vercel verified successful; original authorization/Machine custody
remain `f42930f`/`df4f29ec`. The next known active UUID is
`38b3708d-61b0-41d2-8170-5ed91c66b4dc`. Registration precedes the separately
audited fixture reactivation. It does not grant any new allowance.

[Actual hosted dev application](forward-continuation-hosted-20261023.json) now passed native0: exact one-version dry-run/push,15-version parity, all catalog checks, both hosted advisors0/0 and generated-type equivalence. All14 originals, closed/archive state and persistent Admin custody are preserved; private child/scratch/lock closed. No new window was registered. Fresh A–D acceptance remains
blocked by the unresolved WF-00 definition choice and the documented Vercel
request subcap. Production, merge, recurring activation and M04 remain untouched.
