# Supabase foundation

M01 owns the seven migrations, local fake fixtures, RLS/role tests, private
pipeline RPCs, invoker search, queues, cron and Storage. Hosted acceptance is
tracked in [M01 progress](../milestones/M01-supabase-foundation/PROGRESS.md).

## Local development

Use Node24, pnpm10 and Docker. The exact CLI2.121.0 is a root dev dependency;
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
local baseline; hosted minor versions still need verification.

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
format it and run `corepack pnpm typecheck`. After hosted dev is available,
regenerate using `--project-id zmotjsbzhzjvpelxvxlf` instead of `--local` and verify
the same schema. Local types are not evidence of hosted deployment.

## Hosted dev and production

Verified owner-supplied refs: dev `zmotjsbzhzjvpelxvxlf`, prod
`hkiafqrcxaafdbcvjlzv`. On17October2026 both dashboards showed Everyone Pro,
Frankfurt (`eu-central-1`), healthy status, GitHub integration and no migrations.
Those observations do not establish CLI access, OAuth or a deployed schema.

The resumed17October check proved the existing dev-scoped MCP OAuth through a
fresh official Codex App Server client. Dev PostgreSQL17.11 and an empty baseline
were verified live. MCP0.14.0 apply cannot accept the existing migration version
IDs. Reuse OAuth for reads/advisors; preserve exact versions with CLI2.121.0 and
the verified database URL instead of changing history or extracting OAuth tokens.

Privately configure the existing dev DB password as `PGPASSWORD`. Do not print
it, place it in arguments, reset it or request a new PAT by default. From the
repository root, the reviewed future PowerShell workflow is:

```powershell
if ([string]::IsNullOrEmpty($env:PGPASSWORD)) { throw 'Private dev password missing' }
$devDbUri = 'postgresql://postgres.zmotjsbzhzjvpelxvxlf@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'
corepack pnpm exec supabase migration list --db-url $devDbUri
corepack pnpm exec supabase db push --db-url $devDbUri --dry-run --skip-vault
# Verify exactly the seven reviewed versions, hashes and current hosted state.
corepack pnpm exec supabase db push --db-url $devDbUri --skip-vault --yes
corepack pnpm exec supabase migration list --db-url $devDbUri
```

This host was observed in dev's Connect dialog, not inferred from the region.
The URI has no password component; the explicit URL route uses `PGPASSWORD`
without API authentication, link or service keys. Omit `--project-ref` with
`--db-url`; also omit seed/roles/debug flags. Capture raw output privately and
publish only non-secret receipts. Reconcile actual history after any failure
before retrying. See the [current source review and acceptance plan](../milestones/M01-supabase-foundation/evidence/hosted-acceptance-20261017.md).

The previously reviewed scoped-token route remains an alternative if those
credentials are already privately supplied. It is not a new token request:

```sh
corepack pnpm exec supabase migration list --linked --project-ref zmotjsbzhzjvpelxvxlf
corepack pnpm exec supabase db push --linked --project-ref zmotjsbzhzjvpelxvxlf --dry-run --skip-vault
corepack pnpm exec supabase db push --linked --project-ref zmotjsbzhzjvpelxvxlf --skip-vault
```

Review the dry-run against the exact seven files. Never supply a password or
token in command arguments. A scoped token can mint temporary database login
credentials, so the baseline does not require a persistent owner DB password.
The minimal dev permissions are Database Read-write, Connection Pooling Read,
Advisors Read and Project Settings Read. Do not grant API Keys/Secrets, billing,
Network Bans or unrelated project access.

CLI2.121.0 `link` unconditionally reads revealed API keys and probes with the
service-role key. To honor hard rule5, M01 deliberately uses supported explicit
refs instead of calling `link` or inventing a link receipt. `--linked` selects
the hosted path; `--project-ref` pins its actual target without a persisted link.
No `.temp` file is fabricated. Advisors use the same explicit ref; hosted type
generation uses `--project-id`. See the access source review in M01 evidence.

Hosted Queues/pg_cron may need enabling through
Integrations or Database → Extensions before push; verify availability rather
than assuming local behavior. Confirm Data API exposure and Google-only auth
settings separately. Run security/performance advisors and both role pooler
checks, and record actual migration versions and outputs in M01 progress.

Production baseline application requires the specific T13 owner go-ahead
recorded in progress. After that gate, verify and select the explicit prod ref, dry-run and
push the same seven files and verify advisors/roles/migration parity. Subsequent
commands return to the explicit dev ref. This authorizes no collection,
schedules, backfill or AI spend. Production
does not receive local fixtures. A PR remains unmerged until M01 acceptance and
the owner's merge approval.

## Poolers and verification boundaries

n8n uses session port5432; the Vercel API uses transaction port6543 with prepared
statements disabled. Usernames are `n8n_writer.<ref>` and `api_agent.<ref>`.
Privately configure `N8N_WRITER_URL` and `API_AGENT_URL` after MA-05; use
`sslmode=require` or stronger. [Verification scripts](../scripts/db/README.md)
document the secret-safe connection checks and their synthetic regressions.

Local informational advisor findings are intentional deny-all policies on the
eleven internal tables and unused indexes on a fresh database. Retain required
FK/list/search indexes; reassess performance on real data in later milestones.
Security warnings/errors are blockers. Search correctness is tested here;
the M11 scale benchmark and full OAuth UI flow in M09 remain future work.
