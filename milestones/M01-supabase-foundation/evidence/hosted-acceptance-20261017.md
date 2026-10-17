# M01 hosted acceptance resume

## 18 October production baseline acceptance

The approved production packet was applied **once** to
`emr-prod / hkiafqrcxaafdbcvjlzv`, completing at
**2026-10-17T23:31:23.5015037Z** (18 October Cairo). Actual native authentication
through the verified session pooler succeeded as postgres; the initial SQL
catalogue/history was empty. The dry-run matched all seven original sealed
files, with no local seed or roles file. A fresh reviewed gate bound the target,
approval, recovery disposition, source hashes and current state before the
single-use push. Native exit0 and post-push SQL readback confirm exactly the
seven original versions/names with statement counts40/120/55/12/10/3/4.
The consumed push plan and exclusive attempt sentinel prevent blind replay.
[Database preflight](prod-database-preflight-20261018.json),
[dry-run](prod-dry-run-20261018.json), [reviewed gate](prod-reviewed-push-gate-20261018.json),
[push and history](prod-push-20261018.json),
[single-attempt receipt](prod-single-push-attempt-20261018.json).

Production catalogue readback verifies36 RLS tables, nine invoker views,
23 project functions/12 sealed definers, expected grants, all required FK
indexes, baseline120/13/17 seeds and the owner invite, domain-autojoin0 and
empty competitor/account/item/raw/member tables. Three queues, both exact
housekeeping jobs and the public media bucket's5MiB/four-MIME bounds with no
client writes match the packet. No seed.sql, C999/test-house, real competitors,
accounts or later-milestone fixtures were imported.
[Native inventory](prod-readback-20261018.json) and
[independent scoped review](prod-inventory-review-20261018.json) separate
catalogue assertions from actual restricted-role authentication.

Actual post-migration production CLI advisors exited0 at warning-failure
threshold: security11 intentional deny-all INFO; performance72 unused-index
INFO; **zero WARN/ERROR**. The production CLI report has no Auth-allocation
row; the historical dev MCP report has73 performance INFO. Required indexes
remain. [Security](prod-securityadvisors-20261018.json),
[performance](prod-performanceadvisors-20261018.json).
Production-generated types parse without errors and cover app/api/ops/ingest,
36 tables/nine views/12 generated RPCs. Their complete normalized AST matches
the checked-in types, whose bytes were preserved. The initial canonical
comparison rejected formatter-only parentheses; that failed verifier receipt
is retained separately from the corrected AST PASS.
[Native generation](prod-generatetypes-20261018.json),
[AST verification](prod-type-verification-20261018.json).
After the credential-bearing native children exited, a targeted fresh
`corepack pnpm typecheck` completed successfully for both workspace packages
and the root project. The unchanged full local suite was not repeated.

Saved production Google configuration now passes an explicit reload at
23:30:21Z: Google enabled, Email disabled, valid Google OAuth-format client ID
and occupied masked secret field, exact prod callback, nonce checking retained
and users without email disallowed. Signup remains ON; anonymous/manual linking
remain OFF. No client secret value was read. The earlier Google-disabled
readback and cancelled invalid autofill remain in the receipt. Google Cloud
client-type/redirect-list metadata and an OAuth exchange are not independently
claimed; full browser sign-in remains M09.
[Google readback](prod-google-config-20261018.json),
[authorized Email correction](prod-auth-security-20261018.json).

The Data API exposed-schema list was saved once and explicitly reloaded at
23:33:54Z as exactly public/graphql_public/app, with all five internal schemas
excluded and other API settings preserved. This is dashboard configuration
evidence. Production HTTP checks were not run: the browser tools provide no
documented private bridge for the public API key. AC9's positive member-JWT
proof remains the existing local/CI receipt, separate from production settings.
[Saved allowlist](prod-data-api-20261018.json).

**MA-05 production PASS:** the owner set/supplied distinct role credentials;
both native restricted logins completed at23:39:48–53Z. Writer session5432
asserted current_user/session_user n8n_writer, absent direct table privileges,
four exact42501 denials and start_run/finish_run with a forced nested rollback.
Agent transaction6543 asserted current_user/session_user api_agent, set and
verified transaction-local read-only mode first, executed the permitted
api.competitors_v COUNT read, found no direct project-table DML or ops/ingest
EXECUTE privileges, and passed all four exact42501 denials. The DO command does
not emit the scalar count; no nonzero result or fixture is required. Other
error classes are not accepted as authorization proof. Each native exit was0
with the exact DO command tag. Owner-postgres plus SET ROLE is not used as a
restricted-login receipt. Dev probes were not repeated.
[Actual role completion](prod-role-pooler-completion-20261018.json),
[reviewed consumer/local validation](prod-role-helper-review-20261018.json),
[independent role acceptance](prod-role-acceptance-20261018.json).

The final production security-detail SELECT and native identity assertions
also completed with exit0; its expanded sequence/column/default ACL, trigger,
policy and queue/cron paths are recorded separately from role authentication.
[Security detail](prod-security-detail-20261018.json) and
[independent fifteen-contract review](prod-security-detail-review-20261018.json).
All owned credential-bearing children exited. Independent checks find zero
native CLI processes and no consumed administrator/writer/agent handoff or
generated role SQL file. The first compound administrator cleanup command was
rejected by automatic approval review before execution without a specific
reason; the owner removed that handoff using the exact provided command, and
its absence was independently verified. The blocked attempt remains in
[credential cleanup](prod-admin-credential-cleanup-20261018.json).
Saved owner passwords are untouched. No parent VS Code environment was modified;
clearing a child cannot clear an independently configured parent environment.

M01 stays open and PR4 draft/unmerged pending final checks and separate merge
approval. The next approval is **Approve merging PR #4** only after current PR
checks pass; production-baseline approval is already consumed.
M02, collection, paid calls, application promotion and n8n activation remain
unstarted.

## 18 October production approval and preflight

The owner explicitly approved the exact packet for
`emr-prod / hkiafqrcxaafdbcvjlzv`, adding full authorization for those actions.
[Approval receipt](prod-authorization-20261018.json) and M01 PROGRESS record
the decision before production writes. No new general approval is required.
The approval covers the seven sealed migrations, documented baseline seeds,
queues, housekeeping, media bucket and bounded verification/recovery. PR4 merge,
application promotion, fixtures/imports, collection, paid calls, workflows and
M02 remain outside this packet.

Resumed clean source688ec9d; CI39077278495 all five jobs and Vercel verified.
Dev schema/advisor/type and both restricted-role receipts are preserved. The
dev MCP remains fixed to dev. Production uses the supported explicit-target
CLI route; no CLI link, new MCP setup, OAuth material extraction or service key.
The fresh production-only encrypted handoff was absent at preflight; no
production database authentication or write had occurred at that point. The
[exact credential command](../../../supabase/README.md#production-credential-handoff)
uses only the existing prod database password and has a non-secret readiness
reply. Approval and credential readiness are separate facts.

Fresh read-only dashboard observations establish the production identity,
empty application schema/history, required extension availability, Git controls
OFF and a physical backup listed with a Restore action; availability does not
prove an exercised restore. Details and limitations are recorded separately in
[production preflight](prod-preflight-20261018.json). Do not infer successful
authentication, a dry-run or migration application from browser observations.
The existing dev runner is not simply retargeted: production requires explicit
history/schema reads, consumed one-use push planning, fail-closed errors and
verified cleanup. Exact plan/source seals and recovery review precede any push.

## Historical 18 October dev-gate completion — before production approval

This section retains the earlier as-of checkpoint and its now-completed
production-approval request. The approval/application above supersedes that
pending gate; do not request it again.

Resumed clean branch `m01-supabase-foundation` at
`7aaa2a146f11af03ebe8e9fcad6cf8fa2228ad64`, draft PR4. CI39072134552 passed all
five jobs and Vercel at that source. Dev MCP reconfirmed the exact project and
seven original versions/names; local SHA256 seals still match the table below.
No migration or writer probe was replayed. Existing hosted schema/advisor/type
and local/CI evidence is preserved rather than relabelled as a fresh run.

Before decryption, the actual consumer and its exact embedded/generated SQL
were reviewed and exercised on the verified owned local PostgreSQL17 instance.
That full check caught a qualified-name-text table-privilege lookup which
required schema USAGE that api_agent correctly lacks. Switching only that
lookup to the relation-OID overload preserves all write-privilege assertions.
The corrected full SQL completed locally; wrong identity, read-only `25006`,
missing-object `42P01` and omitted-setting negative checks all failed as required.
These are local validation results, not hosted authentication. The final helper
SHA256 was checked again before the actual agent-only invocation.
[Preflight details](agent-probe-preflight-20261018.json).

**api_agent PASS**, actual transaction pooler6543, at22:55:34–37 UTC17 October
(01:55 Cairo18 October). Both `current_user` and `session_user` matched.
The first DO operation applies transaction-local read-only mode, then asserts
it before the permitted `api.competitors_v` count read. That read executed;
the DO command did not emit its scalar count. No fixture was added. OID-based
catalogue assertions found no direct project-table DML or ops/ingest execution
privileges. All four expected `42501` denials passed: internal ops table read,
writer RPC, queue table and scheduler table. Other error classes are not
accepted as permission evidence. Native exit0 and exact DO tag are required.
[Native receipt](agent-pooler-completion-20261018.json),
[combined role acceptance](role-pooler-acceptance-20261018.json).

The consumed agent handoff and generated private SQL were deleted; all owned
credential-bearing children exited, with zero native CLI processes remaining.
The writer/admin handoffs remain absent. Saved owner passwords are unchanged;
no password reset, grants or role/database defaults changed. No password was
injected into parent VS Code; clearing a child does not clear any independently
configured parent. MCP readback confirms zero probe runs, competitors/accounts
and domain-autojoin entries; zero members, owner admin invite present, enabled
membership trigger and expected RLS/restricted execution remain intact.

**Google saved Supabase configuration PASS**, at22:54:58 UTC: enabled after
explicit reload, configured Google OAuth-format client ID, occupied masked
secret field and exact dev callback. Email remains disabled; signup ON,
anonymous/manual linking OFF, confirmEmail ON, nonce checking preserved and
users without email disallowed. No secret value was accessed. The
[provider receipt](provider-config-completion-20261018.json) separates any
Google Cloud client-metadata limitation from saved Supabase settings. Neither
configuration nor client metadata proves an OAuth exchange; full signin is M09.
The earlier disabled-provider and incomplete agent attempts remain below.

AC8 **dev** and AC11 saved-provider configuration are closed. Dev MA-05/06 need
no further credential handoff or setup action. M01 remains open: production
baseline approval/acceptance and PR4 merge approval are separate outstanding
gates. Review the **existing exact production packet below** and reply
**Approve the M01 production baseline packet for hkiafqrcxaafdbcvjlzv** to
authorize only that baseline. PR4 stays draft/unmerged; M02, collection,
paid provider calls and workflows remain unstarted. The existing M00 tooling
advisory/ESLint follow-up due24October is retained, without a new audit claim.

## Earlier 18 October continuation — before the completed retry

The existing branch and draft PR4 still point to reviewed head
`41d4801eedf92219688dbfaf13fd49388b9ef318`. CI39062273290 passed all five jobs
and Vercel; those results belong to that head. The working dev MCP reconfirmed
`zmotjsbzhzjvpelxvxlf` and the same seven applied versions/names. No migration,
seed, fixture or administrator credential was replayed or requested.

The two owner-supplied Windows-encrypted role handoffs were present under the
expected Windows account. The actual consumer was reviewed before decryption;
it uses only the pinned native CLI, fixed dev host/users/ports/database/TLS,
passwordless argv, child-only PGPASSWORD and bounded cleanup. Its single DO
asserts both `current_user` and `session_user`; owner-postgres plus SET ROLE is
not used as a restricted-login receipt.

- **n8n_writer PASS**, session5432, observed21:37:14–18 UTC on17 October
  (00:37 on18 October Cairo). Both identities matched, start/finish RPCs worked,
  the exact custom exception forced subtransaction rollback, and four expected
  `42501` denials passed: direct ops read, direct app write, queue and scheduler
  reads. The direct-table privilege check also passed.
- **api_agent authenticated; acceptance INCOMPLETE**, transaction6543,
  observed21:37:18–20 UTC. Both identity assertions passed before the probe's
  extra `transaction_read_only` assertion failed. Safe server-log projection
  identifies api_agent / DO / `P0001` / inline line9. The startup setting did
  not take effect; the precise layer that ignored/overrode it is unproven. This
  is not a password rejection. View and denial checks were not reached.
  The reviewed correction sets read-only mode through live SQL as the first DO
  operation, transaction-local: `set_config('transaction_read_only','on',true)`.
  The identity, privilege, read and four-denial assertions remain intact. A
  bounded dev-MCP compatibility check passed; it is not role acceptance.

[Original role attempt](role-pooler-attempt-20261018.json) and
[current role acceptance/recovery](role-pooler-acceptance-20261018.json) preserve
separate results. Both consumed handoffs and generated private SQL files were
deleted. All owned CLI children exited; independent inspection found zero
remaining native CLI processes. The administrator handoff remains absent.
No password was put into parent VS Code; clearing a child cannot clear any
separately configured parent. The owner's saved role passwords are untouched.
MCP readback finds zero retained probe runs, competitors, accounts and domain
autojoin entries. No grants, passwords or database defaults changed.

At21:35 UTC, independent browser readback found **Google DISABLED**, **Email
DISABLED**, exact dev callback
`https://zmotjsbzhzjvpelxvxlf.supabase.co/auth/v1/callback`, signupON,
anonymous/manual linkingOFF. Both Git auto controls remain OFF on both projects.
[Provider receipt](provider-config-20261018.json). No client secret was read,
configuration saved or OAuth exchange attempted. Full browser signin stays M09.

At this earlier checkpoint, MA-05 needed an agent-only handoff. The following
historical action is now completed and its handoff deleted; do not repeat it:

```powershell
& "$env:LOCALAPPDATA\Temp\emr-m01-store-role-urls.ps1" -Role api_agent
```

Enter the existing saved agent password at the hidden prompt. Expected output:
**Encrypted dev role handoffs saved**. Close that window; reply **Agent handoff
ready**. Do not reset passwords or repeat the successful writer check.
MA-06 exact screens/fields/result and readiness reply **Google saved on emr-dev**
are in [Supabase README](../../../supabase/README.md#owner-actions-for-the-dev-pooler-checks).

M01 remains open at AC8 agent read/denial checks and AC11 Google configuration;
the completed migration/advisor/type/local/CI evidence below is preserved.
After both dev gates pass, present the existing exact production-baseline
packet below for separate approval. Its approval and PR4 merge are not inferred
from credentials or this continuation. Production writes, merge, M02,
collection and paid provider calls remain untouched.

## 17 October hosted dev baseline result

The owner completed the encrypted handoff. Actual native-CLI PGPASSWORD presence
and authentication succeeded; dry-run matched the seven sealed files, then push
applied them at19:12UTC with their original versions. [Final dev receipt](dev-acceptance-20261017.json),
[catalogue and advisors](dev-inventory-20261017.json), and
[detailed privilege matrix](dev-security-detail-20261017.json) contain the results.

Dev now has36 RLS tables, nine invoker views,23 restricted project functions,
three queues, two housekeeping jobs, the media bucket and baseline seeds.
Competitors/accounts/items/raw-items remain empty and domain autojoin is off.
Post-migration advisors have zero WARN/ERROR;11 deny-all security INFO and73
performance INFO (72 unused required indexes, one Auth connection allocation)
are retained with justification. All FK leading indexes exist. Extension ACLs
do not expose a direct machine/client queue or scheduler path: their schemas
deny USAGE to all four restricted roles.

The dev Data API allowlist was saved/reloaded as public,graphql_public,app.
Actual HTTP gives app anon401/42501 and all five internal schemas406/PGRST106;
Auth settings confirm Email/Google disabled. A read-only authenticated SQL probe
with no user identity returns zero taxonomy/search rows and null me, then rolls
back. This adds no fixtures, users or role membership; positive membership and
concurrency proofs remain clearly labelled local/CI evidence.

CLI generated all four requested schemas without Docker or API credentials.
An initial text-format guard rejected valid raw formatting; TypeScript AST
inspection confirmed all36 tables, nine views and12 project RPCs across those
schemas. Hosted types match the checked-in AST; original file bytes were kept
to avoid formatting-only churn. Workspace and root typecheck passed.

The encrypted postgres handoff was deleted and all credential-bearing children
exited. No password was injected into parent VS Code. MA-04 is resolved. MA-05
restricted-role pooler authentication and MA-06 Google remain pending; neither
uses the postgres password. Production-baseline and PR4 merge gates stay open,
PR4 stays draft, and M02 has not started. The earlier sections below preserve
the diagnostic sequence; their empty-state observations are historical.

## Historical credential handoff follow-up — completed, do not repeat

The next resume verified source/PR head55738124f4e31931d1ad8528b537fc6ed49d8acf,
green CI39059459113 and all seven unchanged migration seals. Native dev MCP tools
are now active directly. Fresh URL/history/catalogue reads still show dev17.11
with no migrations or project objects. Browser reconfirmed the session pooler,
Email disabled, Google disabled, default-only Data API exposure and both Git
automation controls OFF. No migration command reached authentication.

The exact migration shell reported PGPASSWORD absent, including without a login
profile; user/machine environment and an independent runtime child also lacked
it. No local Codex filter explained this. The owner then clarified that the
password had **not** been configured and requested an exact command. The
diagnosis is missing credential delivery, not failed authentication or a proven
filter problem. [Receipt](credential-delivery-20261017.json).

Completed owner action (historical command, do not run again):

```powershell
$emrPasswordFile = Join-Path $env:LOCALAPPDATA 'Temp\emr-m01-dev-password.dpapi'
Read-Host 'emr-dev database password' -AsSecureString |
  ConvertFrom-SecureString |
  Set-Content -LiteralPath $emrPasswordFile -Encoding ASCII
```

Enter the existing dev DB password at the hidden prompt and report readiness
only. Do not send the value or the file contents. This creates a temporary,
Windows current-user encrypted handoff outside the repository/configuration;
it does not set a global environment variable or require restarting VS Code.
The password-entry PowerShell can close after the command completes.

Codex consumes it only inside an owned dev database child, sets that child's
PGPASSWORD, verifies presence in the exact environment passed to the pinned
native CLI, then follows the same passwordless-URI dry-run/push below. The
installed native2.121.0 binary is invoked directly so no package-manager or
installation process receives the password. CLI output/errors remain in memory;
only allowlisted statuses and migration filenames are reported. Types use a
separate stdout candidate and stderr buffer. Never use this credential for
role-pooler authentication, prod, unrelated tests, installations or other
projects. Remove the encrypted file when dev DB operations finish; clear and
close owned credential children. Child cleanup does not clear a separately
credential-bearing parent VS Code process. This handoff does not put the secret
in that parent.

The historical receipt below remains unchanged in meaning; empty-database
advisors and local types still do not establish hosted baseline acceptance.

Observed 17 October 2026. [Structured receipt](hosted-resume-20261017.json)
separates database reads, dashboard settings, historical local/CI evidence and
unperformed acceptance. Earlier `mcp-setup.json` and `hosted-preflight.json`
remain unchanged historical records.

## Access and actual state

The existing dev-scoped OAuth works. A fresh official Codex App Server client
initialized an ephemeral thread, listed the `supabase` tools and directly
called `get_project_url`, `list_migrations`, `list_extensions`, `list_tables`,
`execute_sql`, `list_branches` and both advisor types. No `turn/start`, login,
credential-store read, scope override or API-key request occurred. This starts
no model turn. The native catalogue retained by this chat still lacks Supabase;
the successful fresh client is a separate, verified connection.

The retained Codex host started before the MCP configuration changed. This
supports a stale-host explanation; configuration alone was not accepted as
proof. App Server methods were checked against its installed protocol schemas
and [official documentation](https://learn.chatgpt.com/docs/app-server).

Live dev URL is `https://zmotjsbzhzjvpelxvxlf.supabase.co`. PostgreSQL is 17.11,
matching the recorded local major/minor. All six required extensions are
available; only pgcrypto is already installed. There are no baseline migrations,
project relations, machine roles, preview branches or media bucket. No baseline
DDL/DML or fixture import ran. Pre-migration advisors have zero security findings
and one performance INFO (`auth_db_connections_absolute`, maximum10). Retain
that setting for later scaling review; it is not baseline acceptance.

Both projects link this repository at root `.`. Automatic branching and deploy
to production are OFF; their production-branch fields are disabled and empty.
No integration setting was changed. Dev Data API currently exposes only
`public,graphql_public`. After baseline creation, add `app` and verify that
`ingest,ops,api,private,pgmq` remain excluded. Do not equate an unset SQL runtime
setting with verified API exposure; the actual list was read in the dashboard.

The authorized dev Email-provider change was saved and independently verified
after reload: DISABLED. Google remains DISABLED. Global account signup remains
ON for Google invite onboarding; anonymous signin and manual identity linking
remain OFF. Site URL is `http://localhost:3000`, with no additional redirects.
The Google web-client callback was verified in the provider drawer as the dev `/auth/v1/callback`, distinct
from the application's later post-login redirect. M09 owns full browser signin.
Domain autojoin cannot yet be checked: `app.allowed_domains` does not exist.
The Google client fields were initially empty. Unrelated browser autofill then
appeared; it was cancelled without saving and is not accepted as existing
Google client configuration. No credential contents were reported.

## Preserve the seven migration versions

Source/PR head inspected before changes:
`8a6502503a0b3108e65c1bfbf6a2a272e2022ebc`, clean worktree,
`m01-supabase-foundation`, draft PR4. [CI39057325483](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39057325483)
passed quality, unit, build, e2e and db-tests at that exact head; Vercel passed.
Those checks include the existing local242 assertions and concurrency/REST
coverage. They do not establish hosted deployment. This resume changes evidence
and instructions only; the seven reviewed SQL files remain byte-for-byte intact.

| Version        | Name                     | SHA-256                                                          |
| -------------- | ------------------------ | ---------------------------------------------------------------- |
| 20261017172928 | extensions_schemas_roles | 478c9272e785b6bbe76824077fb2c6f574caaa2bd7f58d1941af051ce778080d |
| 20261017172931 | core_tables              | 4f1be3f6191885add916b164975ba10a8697069a0373a05df4e03fa53ea7cba3 |
| 20261017172934 | auth_rls_views           | 8986d801f5a85ea40a620911cd59c88ac44414a1b7fde11fd469b6bff96282f9 |
| 20261017172937 | rpc_pipeline_core        | 978c144abf780d520f9b7303ba129ee5336f50ce4a81292ce48b5be9a6dd8803 |
| 20261017172940 | rpc_app_search           | 6111c5291e9c305e3e713180c0441ff5ffbf52b3b88f589d5d16fee55769171c |
| 20261017172943 | storage_cron             | 859466fadfd940445ffe4b457e7250a179c93731e1f34736a629fe20df6e9c68 |
| 20261017172945 | seed_taxonomies          | af0880dd9f92d0ba05938e55f3c0b48b162b4437a8add8a133ca37b1d7971234 |

MCP0.14.0 `apply_migration` accepts only `name,query`, with no version parameter.
The [pinned implementation](https://github.com/supabase/mcp/blob/f46b3d2996d93baad25cce1b94b46440dcc44ecb/packages/mcp-server-supabase/src/platform/api-platform.ts#L237)
and [Management API](https://supabase.com/docs/reference/api/v1-apply-a-migration)
provide no supported version override. Prefixing the name with a timestamp does
not preserve the separate version field. No apply call was attempted.

The supported exact-version route is installed CLI2.121.0 `db push --db-url`.
It uses the observed session pooler and a passwordless URI, with the existing
database password supplied privately as `PGPASSWORD`. This path makes no
Management API calls and needs no PAT, CLI link or service key. The URI must
have `user@host`, with no password component or colon after the username.
Sources: [explicit URL path](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/db-config.layer.ts#L566),
[libpq password handling](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/db-config.parse.ts#L263),
[version recorded after successful SQL](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/migration-apply.ts#L414).

Future commands, not execution receipts (PowerShell, repository root):

```powershell
# Require a nonempty private password; never print it or put it in arguments.
if ([string]::IsNullOrEmpty($env:PGPASSWORD)) { throw 'Private dev password missing' }
$devDbUri = 'postgresql://postgres.zmotjsbzhzjvpelxvxlf@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'
corepack pnpm exec supabase migration list --db-url $devDbUri
corepack pnpm exec supabase db push --db-url $devDbUri --dry-run --skip-vault
# Review the seven versions/hashes and current remote state before this write.
corepack pnpm exec supabase db push --db-url $devDbUri --skip-vault --yes
corepack pnpm exec supabase migration list --db-url $devDbUri
```

Do not pass `--project-ref`, `--include-seed`, `--include-roles`, a password flag
or debug logging. Do not extract MCP OAuth material for the CLI. Require the
explicit private password before launching; do not fall back to unrelated saved
credentials. Retain raw output privately and publish only reviewed outcomes.
`SUPABASE_DB_PASSWORD` belongs to linked resolution; this explicit URL path uses
`PGPASSWORD`. In this session both are absent, as are the machine-role URLs,
Google client environment variables and expected repository real env files.

After push, read back actual ledger and catalogues before further action. On
failure or ambiguous transport response, reconcile first and continue only the
missing migrations. Never use ad-hoc SQL plus ledger repair, reset, dropped
objects or renamed history to conceal a mismatch. Verify RLS, grants, invoker
views, RPC restrictions, queues, cron, bucket and baseline seeds without hosted
fixtures. Regenerate hosted types and inspect their schema coverage before
replacing local types; run workspace typecheck. The MCP type tool has no schema
selector, so do not assume its default output includes all four project schemas.
Run post-migration advisors; the pre-migration report cannot substitute for them.

## Historical owner prerequisites before the completed dev baseline

This list records the earlier state. MA-04 is resolved and its temporary file
was deleted. Use the current 18 October continuation and M01 PROGRESS for
remaining actions; do not recreate the administrator handoff or replay push.

- MA-04: privately configure the existing dev database password as `PGPASSWORD`
  in the Codex environment, or run the exact CLI workflow privately and share a
  non-secret result. This is a precise migration credential gap; MCP works.
- MA-05: after migration creates the roles, use the dev SQL editor to set strong
  passwords for `n8n_writer` and `api_agent` as described in MANUAL_ACTIONS.
  Privately supply `N8N_WRITER_URL` at observed host5432 and `API_AGENT_URL` at
  observed host6543, with their respective `<role>.zmotjsbzhzjvpelxvxlf` users,
  database `postgres` and TLS. Run the existing rollback-only pooler script;
  password creation/rotation remains owner-controlled. No successful role
  authentication is claimed from OAuth or synthetic script tests.
- MA-06: complete the existing Google web-client setup, or create a client if
  none exists, with callback
  `https://zmotjsbzhzjvpelxvxlf.supabase.co/auth/v1/callback`. Privately configure
  it in dev Authentication > Sign In / Providers > Google. Then verify enabled
  state, callback, Email disabled and domain autojoin off after migrations.
  Full browser signin stays in M09.

## Production approval packet — prepared, gate still open

This historical heading is retained for existing packet links. The owner
explicitly approved this exact T13 packet for `emr-prod / hkiafqrcxaafdbcvjlzv`;
preflight, credential delivery, one seven-version push and bounded production
acceptance are now complete as recorded above. Do not replay this packet or
request its approval again. PR4 merge remains a separate unapproved action.

The baseline creates36 project tables with RLS, restricted machine roles and
RPCs, invoker views and indexes; ensures the six extensions; creates queues
`ai_extract,embed,media`; and seeds120 taxonomy terms,13 settings,17 price-book
placeholders and the owner admin invite. Domain autojoin remains empty. The
`media` bucket is public-read, fiveMiB, allowing JPEG/PNG/WebP/SVG, with no client
write policies. Two active internal housekeeping jobs are created:
`emr-unlock-stale-accounts` (`15 * * * *`) and `emr-archive-queue-cleanup`
(`30 3 * * *`). They clear expired locks and queue archives older than30 days;
they do not activate collectors, AI, workflows or paid backfills.

Exclude `supabase/seed.sql`, all tests, concurrency/signup fixtures, C999,
test-house and real competitors/accounts. Before any approved prod write,
verify fresh identity, history, objects, extension compatibility, backup/recovery
availability and both Git integration controls again. Do not repoint dev MCP.
Dry-run the exact production-targeted CLI route with private credentials, review
the seven files, then apply once. On failure stop, read history/catalogues and
continue missing work only; use a reviewed forward fix if needed. Never reset,
drop collected data or fabricate an applied receipt. Verify prod migration/hash
parity, catalogue/grants/RLS, queues/cron/bucket/seeds and zero competitors,
advisors, Data API exclusions and owner-supplied role pooler connections. Keep
dev the default afterward. PR4 merge is a further separate open approval gate.

## Usage boundary

The dashboard showed Everyone Pro with spend cap enabled, one Micro compute
hour and twoGB provisioned disk per project. Upcoming log-query metrics showed
2.312GB dev and1.589GB prod. These are project totals, may lag one hour or24 hours
for activity, and are not costs attributable to this work. Rounded zeroGB
egress coexisted with nonzeroKB in the chart. Exact USD charges are unknown.
No billing setting, production setting, paid provider call, local reset,
unrelated Docker project or M02 task changed during this resume.
