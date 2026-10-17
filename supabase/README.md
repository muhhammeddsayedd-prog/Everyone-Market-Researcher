# Supabase foundation

M01 owns the seven migrations, local fake fixtures, RLS/role tests, private
pipeline RPCs, invoker search, queues, cron and Storage. Hosted acceptance is
tracked in [M01 progress](../milestones/M01-supabase-foundation/PROGRESS.md).

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
local baseline; dev PostgreSQL 17.11 is now verified. Production version/acceptance remains pending.

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
all five internal schemas return 406/PGRST106. Actual Auth settings return 200
with Email disabled and Google disabled. These are bounded hosted checks;
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

Production baseline application still requires the separate T13 owner go-ahead.
The [production packet](../milestones/M01-supabase-foundation/evidence/hosted-acceptance-20261017.md)
identifies prod `hkiafqrcxaafdbcvjlzv`, the same seven versions/hashes,
seeds/queues/cron/public bucket, fixture exclusions, recovery and verification.
General project access does not approve that write. Keep PR4 draft until actual
acceptance and its separate merge approval. No collection, paid provider calls,
workflow activation, application production promotion or M02 work is authorized.

## Poolers and verification boundaries

n8n uses session port 5432; the Vercel API uses transaction port 6543 with prepared
statements disabled. Usernames are `n8n_writer.<ref>` and `api_agent.<ref>`.
Privately configure `N8N_WRITER_URL` and `API_AGENT_URL` after MA-05; use
`sslmode=require` or stronger. [Verification scripts](../scripts/db/README.md)
document the secret-safe connection checks and their synthetic regressions.

### Owner actions for the dev pooler checks

MA-05 remains owner-controlled. Open **emr-dev > SQL editor**, choose a strong
different password for each role privately, replace the placeholders below in
that editor, and run:

```sql
alter role n8n_writer password '<strong writer password>';
alter role api_agent password '<strong agent password>';
```

Store the passwords privately for later n8n/Vercel setup. Do not send them in
chat or use the owner-postgres password in place of either role password.
Then open PowerShell as the same Windows user and run this exact command:

```powershell
& "$env:LOCALAPPDATA\Temp\emr-m01-store-role-urls.ps1"
```

The private helper prompts for the two role passwords with hidden input, safely
URI-encodes them and constructs the verified role-specific dev pooler URLs.
It writes only Windows current-user encrypted handoffs outside the repository:

- `%LOCALAPPDATA%\Temp\emr-m01-dev-n8n-writer-url.dpapi` — `n8n_writer.zmotjsbzhzjvpelxvxlf`, session port 5432.
- `%LOCALAPPDATA%\Temp\emr-m01-dev-api-agent-url.dpapi` — `api_agent.zmotjsbzhzjvpelxvxlf`, transaction port 6543.

Both use `aws-1-eu-central-1.pooler.supabase.com`, database `postgres` and TLS.
Report **MA-05 ready** only. Codex consumes those files only in the owned
role-check child as N8N_WRITER_URL/API_AGENT_URL, verifies each actual SQL login
role and the permitted RPC/read boundary, rolls probes back, records safe
OK/FAIL receipts and removes the temporary handoffs. The existing
`scripts/db/check-pooler.sh` requires psql, which is currently absent from PATH;
a reviewed bounded CLI-query alternative can verify the same direct logins.
No successful pooler check is claimed until it runs. OAuth, owner-postgres
access, catalogue grants and synthetic script tests do not replace it.
Production credentials stay separate and await T13 approval.

MA-06: Google Cloud Console > APIs & Services > Credentials > use/create a Web
OAuth client with callback
`https://zmotjsbzhzjvpelxvxlf.supabase.co/auth/v1/callback`. In **emr-dev >
Authentication > Sign In / Providers > Google**, privately enter its client ID
and secret, enable Google and save. Report readiness only. Codex will verify
the enabled state/callback, keep Email disabled and confirm domain autojoin 0.
The complete browser signin flow remains M09.

Local informational advisor findings are intentional deny-all policies on the
eleven internal tables and unused indexes on a fresh database. Retain required
FK/list/search indexes; reassess performance on real data in later milestones.
Security warnings/errors are blockers. Search correctness is tested here;
the M11 scale benchmark and full OAuth UI flow in M09 remain future work.
