# Supabase foundation

M01 owns the seven migrations, local fake fixtures, RLS/role tests, private
pipeline RPCs, invoker search, queues, cron and Storage. Hosted acceptance is
tracked in [M01 progress](../milestones/M01-supabase-foundation/PROGRESS.md).

M01 is complete. The owner separately approved PR4's merge, and GitHub confirms
the exact reviewed head4ffca85 merged as4702a31 at02:56:30 Cairo on18October2026.
[Merge receipt](../milestones/M01-supabase-foundation/evidence/merge-closure-20261018.json).
M02 is also complete (PR6 and protected closure PR7). M03 is in progress. The
completed M01/M02 password handoffs/probes below are historical and must not be
reused or replayed.

M03 adds CLI-generated `20261018034220_rpc_n8n_foundation` and
`20261018035417_price_book_plan`. They have been applied **locally only** with
`supabase migration up --local`, preserving all seven original versions and
the existing Test House rows. Local11-suite pgTAP379/379, both advisors with no
WARN/ERROR, generated four-schema types and workspace typecheck pass. Hosted
dev still has the original seven versions at the current readback; production
is untouched. See [M03 progress](../milestones/M03-n8n-foundation/PROGRESS.md).
Never run reset or seed to apply these changes, and do not treat local types as
proof of hosted deployment. A new bounded M03 dev-only consumer is being
prepared; its private credential step will follow review, not an old handoff.

## Local development

Use Node24, pnpm10 and Docker. The exact CLI 2.121.0 is a root dev dependency;
`corepack pnpm install --frozen-lockfile` keeps the project install-hook block.
From the repository root:

```sh
corepack pnpm exec supabase start --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
corepack pnpm exec supabase db reset --local
corepack pnpm exec supabase test db --local
corepack pnpm exec supabase db advisors --local --type security --level warn --fail-on warn
corepack pnpm exec supabase db advisors --local --type performance --level info --fail-on error
node scripts/db/check-data-api.mjs
```

`start` and `status` can print local keys. Keep their output private; never copy
it into Git, CI logs, chat or progress files. CI uses a wrapper that withholds
raw output. Do not use `db reset --linked`, `stop --all` or `stop --no-backup`.
Stop this stack with `supabase stop --project-id everyone-market-radar` only.

| Surface                  | Local address                          |
| ------------------------ | -------------------------------------- |
| API/Auth/Storage gateway | `http://127.0.0.1:60321`               |
| REST                     | `http://127.0.0.1:60321/rest/v1/`      |
| PostgreSQL               | `127.0.0.1:60322`, database `postgres` |
| Auth site URL            | `http://localhost:3000`                |

Project ID is `everyone-market-radar`. Ports were selected after checking both
Docker bindings and host listeners; they preserve unrelated local stacks. The
minimum stack contains DB, Kong, Auth, PostgREST and Storage. Optional Studio,
Realtime, analytics, mail and edge services are disabled. PostgreSQL17 is the
local baseline; both hosted projects are verified on PostgreSQL17.11. Both
production restricted-role login/operation/denial checks now pass.

The Data API exposes `public`, `graphql_public` and `app`; never expose `ingest`,
`ops`, `api`, `private` or `pgmq`. Machine roles have empty search paths and no
table-write grants. Qualify schema names, including `'instagram'::app.platform`.
Google-only invite authorization is the intended hosted setup. Local email
signup is disabled so an unverified email cannot consume the admin invite;
OAuth credentials remain private and Google is not simulated as enabled.

`seed.sql` runs only for local reset/CI: fake C999, three accounts, Test Telecom
and ten synthetic items. Hosted migration7 seeds only taxonomies, settings,
price placeholders and the owner invite. It leaves real competitor tables
empty for M02. Do not use `db push --include-seed`.

## Migration workflow

Create filenames only with the CLI:

```sh
corepack pnpm exec supabase migration new descriptive_name
```

Edit that generated file, replay locally, run pgTAP and advisors, then regenerate
types before committing. Do not rename/rewrite applied hosted history or edit
the original drafts in `reference/sql/`. Generated types include `app,api,ops,ingest`:

```sh
corepack pnpm exec supabase gen types --local --lang typescript --schema app,api,ops,ingest
```

Save stdout as UTF-8 `packages/shared/src/db.types.ts`, keeping stderr separate;
format it and run `corepack pnpm typecheck`. For hosted dev, use the verified
passwordless database-URL generation below; it needs no PAT or CLI link. Local
types are not evidence of hosted deployment.

## Hosted dev and production

Targets: dev `zmotjsbzhzjvpelxvxlf`, prod `hkiafqrcxaafdbcvjlzv`. Both owner-created
projects were verified on Everyone Pro in Frankfurt with GitHub integration.
Their automatic branching and production deployment controls are OFF and were
preserved. Initial empty-database observations remain historical evidence.

On 17 October 2026 at 19:12:36 UTC, pinned CLI 2.121.0 applied all seven reviewed files
to dev, preserving the original versions and SQL seals. Remote history matches.
Post-migration catalogue checks verified app 25 / ingest 1 / ops 10 tables with RLS,
nine invoker views, 23 functions / 12 definers in non-exposed schemas with no PUBLIC execution,
expected grants, three queues, two housekeeping jobs, the media bucket and
120 taxonomy terms/13 settings/17 price placeholders plus the owner invite.
Domain autojoin and competitor/account/item/raw-item counts are 0; no local
fixtures, C999/test-house or M02 data were imported.

Hosted dev advisors report zero warnings/errors. Security retains 11 deny-all
INFO findings; performance retains 72 unused-index INFO findings and one Auth
connection-allocation INFO. Preserve required indexes and assess usage again
when real data exists. Dev Data API was explicitly saved/reloaded to
`public,graphql_public,app` at 19:13:55 UTC. Anonymous app access returns 401/42501;
all five internal schemas return 406/PGRST106. At that initial 17 October dev
HTTP checkpoint, Auth settings returned200 with Email and Google disabled;
the later saved Google-enabled readback below supersedes that provider state.
These are bounded hosted checks;
positive member-JWT/full browser signin is not claimed.

Native project-scoped MCP tools now work directly using the existing OAuth.
MCP 0.14.0 apply cannot select migration versions, so the reviewed CLI database-URL
path preserved history. No PAT, CLI link, OAuth extraction or service key was
used. See [dev inventory/advisors](../milestones/M01-supabase-foundation/evidence/dev-inventory-20261017.json)
and [final dev acceptance](../milestones/M01-supabase-foundation/evidence/dev-acceptance-20261017.json)
and the [hosted history/procedure](../milestones/M01-supabase-foundation/evidence/hosted-acceptance-20261017.md).

MA-04 is resolved. The owner supplied the existing dev database password through
Windows current-user encryption in the temporary file
`%LOCALAPPDATA%\Temp\emr-m01-dev-password.dpapi`, outside Git and configuration.
The reviewed private runner decrypted it only inside owned dev DB children,
verified the exact native process environment and withheld raw output/errors.
It did not place a password in argv or the parent VS Code environment. The
encrypted handoff was deleted after dev DB operations and all owned CLI
children exited. Machine-role authentication uses separate role passwords.

The observed dev session-pooler host is
`aws-1-eu-central-1.pooler.supabase.com:5432`. Future migration commands must
reconcile actual history first; this baseline is already applied and needs no
replay. The supported command shape is:

```powershell
# Only inside an owned DB child with its private PGPASSWORD supplied.
$devDbUri = 'postgresql://postgres.zmotjsbzhzjvpelxvxlf@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'
corepack pnpm exec supabase migration list --db-url $devDbUri
corepack pnpm exec supabase db push --db-url $devDbUri --dry-run --skip-vault

# Apply only the reviewed pending changes after the dry-run; never include local seed.
corepack pnpm exec supabase db push --db-url $devDbUri --skip-vault --yes
corepack pnpm exec supabase gen types --db-url $devDbUri --lang typescript --schema 'app,api,ops,ingest'
```

The URI has no password component or colon after the username; its password is
read from child PGPASSWORD. Omit `--project-ref` with `--db-url`, and omit seed,
roles and debug flags. Capture generated stdout as a UTF-8 candidate with stderr
separate. The CLI generates TypeScript in-process without Docker or Management
API authentication. Unformatted quoted keys defeated earlier regex guards;
TypeScript AST verification confirmed all four schemas, 36 tables / nine views /
12 functions and zero parse errors. The result is AST-equivalent to existing
checked-in types, whose exact bytes were retained; workspace/root typecheck
passed. Retain failed verification receipts; do not accept incomplete output or manually
construct missing generated types. Source references are in the hosted procedure.

CLI 2.121.0 `link` reads revealed API keys and probes with the service-role key;
M01 uses explicit targets instead of linking or fabricating `.temp` receipts.
MCP advisors continue with dev as the default. No access broadening is needed.

The owner approved the exact production baseline on 18 October Cairo.
The [approval receipt](../milestones/M01-supabase-foundation/evidence/prod-authorization-20261018.json)
records target/scope before any production write. Production-only credential
delivery, fresh identity/history/recovery checks and the single exact-version
push and actual restricted-role login checks are now completed.
The [production packet](../milestones/M01-supabase-foundation/evidence/hosted-acceptance-20261017.md)
identifies prod `hkiafqrcxaafdbcvjlzv`, the same seven versions/hashes,
seeds/queues/cron/public bucket, fixture exclusions, recovery and verification.
No repeated baseline approval is needed. The separate PR4 merge approval was
later granted and the approved head merged; see the merge receipt above.
No collection, paid provider calls,
workflow activation, application production promotion or M02 work is authorized.

## Poolers and verification boundaries

n8n uses session port 5432; the Vercel API uses transaction port 6543 with prepared
statements disabled. Usernames are `n8n_writer.<ref>` and `api_agent.<ref>`.
Privately configure `N8N_WRITER_URL` and `API_AGENT_URL` after MA-05; use
`sslmode=require` or stronger. [Verification scripts](../scripts/db/README.md)
document the secret-safe connection checks and their synthetic regressions.

### Owner actions for the dev pooler checks

On 18 October (Cairo), the two supplied role handoffs were consumed separately.
The session-pooler `n8n_writer` login passed both `current_user` and
`session_user`, start/finish RPCs with forced rollback, absent direct table
privileges and four expected `42501` denial boundaries. Do not repeat it.

The transaction-pooler `api_agent` retry also **passed**, at 01:55 Cairo on
18 October. Direct login at the fixed dev host/port6543 verified both
`current_user` and `session_user`. The first DO operation sets transaction-local
read-only mode and verifies it; the permitted `api.competitors_v` count read
executed successfully. The scalar count was not emitted by DO. Empty-baseline
reads are valid; no fixture was added. Catalogue checks prove absent direct
project-table DML and ops/ingest execution privileges. All four expected
`42501` denials passed: ops table read, writer RPC, queue and scheduler reads.
The native CLI exited0 with the exact DO command tag.

The earlier authenticated attempt remains recorded as incomplete: it stopped
at the extra startup-read-only assertion before its read/denial checks. The
layer that ignored/overrode that option remains unestablished. Before consuming
the retry handoff, full owned-local PG17 validation found and fixed a further
name-based privilege lookup that required schema USAGE the role correctly
lacks. The OID lookup preserves all assertions and grants. The exact corrected
SQL and four negative checks passed locally before actual hosted execution.
Local simulation is separate from the real restricted login receipt. See
[role acceptance](../milestones/M01-supabase-foundation/evidence/role-pooler-acceptance-20261018.json),
[preflight](../milestones/M01-supabase-foundation/evidence/agent-probe-preflight-20261018.json)
and [native completion](../milestones/M01-supabase-foundation/evidence/agent-pooler-completion-20261018.json).

Both consumed handoffs and private probe SQL files were removed; owned native
CLI children exited. Keep the separately saved role passwords for later
n8n/Vercel setup. No password reset or administrator password is needed.

MA-05 is resolved **on dev only**. No further dev handoff or password action is
needed. The reviewed runner decrypted the DPAPI handoff only in its bounded
role-check subprocess and supplied only the native CLI child's PGPASSWORD.
The host remained `aws-1-eu-central-1.pooler.supabase.com`, database `postgres`
and TLS; the credential URL/password never entered argv, logs or Git. The
consumed retry handoff/private SQL were deleted and the owned child exited;
independent inspection found zero remaining native CLI processes. The existing
`scripts/db/check-pooler.sh` requires psql, which is currently absent from PATH;
a reviewed bounded CLI-query alternative can verify the same direct logins.
Writer acceptance was preserved without rerunning it; agent acceptance is now complete.
OAuth, owner-postgres access, catalogue grants and synthetic script tests do not
replace restricted-role authentication. This method does not inject a password
into parent VS Code; clearing a child cannot clear a separately configured
parent environment.
Production credentials stay separate; T13's exact baseline packet is approved.

MA-06's saved Supabase provider configuration passed independent readback:
**Google ENABLED after reload**, one configured Google OAuth-format client ID,
occupied masked secret field, exact callback
`https://zmotjsbzhzjvpelxvxlf.supabase.co/auth/v1/callback`, nonce checking
preserved and users without email disallowed. **Email remains DISABLED**,
signup ON, anonymous/manual linking OFF, confirmEmail ON. MCP readback confirms
domain autojoin empty, owner invite present and membership trigger/RLS guards
intact. No client secret value was accessed. The browser/provider receipt states
the separate Google Cloud client-metadata verification boundary; saved settings
do not prove an OAuth exchange. Full browser signin remains M09.
[Provider configuration receipt](../milestones/M01-supabase-foundation/evidence/provider-config-completion-20261018.json).

The [existing exact production-baseline packet](../milestones/M01-supabase-foundation/evidence/hosted-acceptance-20261017.md)
is approved. Production role/provider setup and acceptance follow that approval.
The owner later gave the separate **Approve merging PR #4** decision after
acceptance and fresh checks. PR4 is merged, M01 is Done and M02 remains unstarted.

### Production credential handoff

**Completed for this baseline. Do not repeat this administrator-password
handoff or replay migrations.** The production native login and exact dry-run
succeeded; all seven original migrations were applied once at23:31UTC17October
(18October Cairo). History, catalogue/advisors and generated-type AST checks
pass. Both actual restricted-role checks pass. Saved Google is enabled/Email
disabled, and Data API exposure is exactly public/graphql_public/app. All three
temporary encrypted handoffs and generated role SQL are absent, with zero native
CLI processes remaining. The owner removed the administrator handoff after the
automatic cleanup rejection; its absence was independently verified. See the
[current production result](../milestones/M01-supabase-foundation/evidence/hosted-acceptance-20261017.md#18-october-production-baseline-acceptance).
The command below is retained as the historical delivery procedure, not a new
owner action. Administrator and machine-role credentials are separate.

The currently connected MCP remains dev-scoped. The approved exact-version
production CLI path uses the existing **emr-prod database password**, never a
dev or application-role password. No production authentication is implied by
the approval or file presence. No new PAT, MCP login, password reset or global
security change is needed.

Open **Windows PowerShell under the same Windows account**, then run:

```powershell
$emrProdPasswordFile = Join-Path $env:LOCALAPPDATA 'Temp\emr-m01-prod-password.dpapi'
$emrProdPassword = Read-Host 'Existing emr-prod database password' -AsSecureString
try {
  $emrProdPassword | ConvertFrom-SecureString | Set-Content -LiteralPath $emrProdPasswordFile -Encoding ASCII -ErrorAction Stop
  Write-Output 'emr-prod encrypted handoff saved'
} finally {
  $emrProdPassword.Dispose()
  $emrProdPassword = $null
}
```

Expected result: **emr-prod encrypted handoff saved**. Close that PowerShell
window, then reply **Prod database handoff ready**. Do not send the value or file
contents. The Windows current-user encrypted file is outside Git/configuration.
The reviewed production DB consumer alone may decrypt it, passing PGPASSWORD
only to its owned pinned native CLI child with a fixed passwordless prod URI.
Each credential-bearing process must close; remove the handoff after the
approved DB batch or a blocking stop. No dev credential is reused for prod.
This method does not inject passwords into parent VS Code; clearing a child
does not clear any independently configured parent environment.

### Production machine-role handoff

**Completed: do not repeat these password/handoff steps.** Actual production
`n8n_writer` session5432 and `api_agent` transaction6543 checks both passed at
23:39UTC17October (18October Cairo), including current/session identities,
permitted RPC rollback/read, absent direct privileges and four42501 denials
each. Agent read-only mode was transaction-local and asserted first. Consumed
handoffs/private SQL were deleted and all owned native children exited. Keep
the separately saved production role passwords for later integration.
[Native role receipt](../milestones/M01-supabase-foundation/evidence/prod-role-pooler-completion-20261018.json).

The following is the completed historical delivery procedure. The migrations created
`n8n_writer` and `api_agent` without passwords. In **Supabase > emr-prod
(hkiafqrcxaafdbcvjlzv) > SQL Editor > New query**, privately run:

```sql
alter role n8n_writer password '<distinct prod writer password>';
alter role api_agent password '<distinct prod agent password>';
```

Replace the placeholders with two different strong passwords saved in your
password manager for later MA-11/MA-20. If already set, retain those existing
production role passwords and skip the SQL. Use neither the postgres password
nor dev passwords. Expected SQL result: **Success / no rows returned**. Avoid
saving or sharing the credential-bearing query; do not send it in chat.

Open **Windows PowerShell under the same Windows account** and run the reviewed
project-specific private helper:

```powershell
& "$env:LOCALAPPDATA\Temp\emr-m01-store-prod-role-urls.ps1"
```

At its two hidden prompts, enter the already-set production n8n_writer password
then the production api_agent password. It writes only current-user encrypted
temporary handoffs outside Git/configuration:

- `%LOCALAPPDATA%\Temp\emr-m01-prod-n8n-writer-url.dpapi`
- `%LOCALAPPDATA%\Temp\emr-m01-prod-api-agent-url.dpapi`

Expected output starts **Encrypted prod role handoffs saved.** Close that
PowerShell window and reply **Prod role handoffs ready**. Never send passwords,
connection URLs or file contents. Codex will authenticate separately as each role
through the fixed production session5432/transaction6543 poolers, execute the
reviewed rollback-only/read-only operations and require four42501 denials per
role. It will remove consumed temporary credentials/private SQL and close the
owned children. Keep your separately saved passwords for later integration.
This does not authorize workflows, production promotion, merge or M02.

Local informational advisor findings are intentional deny-all policies on the
eleven internal tables and unused indexes on a fresh database. Retain required
FK/list/search indexes; reassess performance on real data in later milestones.
Security warnings/errors are blockers. Search correctness is tested here;
the M11 scale benchmark and full OAuth UI flow in M09 remain future work.
