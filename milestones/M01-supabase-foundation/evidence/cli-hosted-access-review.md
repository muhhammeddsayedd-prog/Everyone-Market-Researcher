# Hosted CLI access review

Observed 17 October 2026. This is documentation/source inspection only. No hosted
CLI command, credential-store lookup, browser action or hosted write was run by
this reviewer. Project refs supplied by the owner are dev
`zmotjsbzhzjvpelxvxlf` and prod `hkiafqrcxaafdbcvjlzv`; no credential is included.

## Version and source boundary

Installed CLI help reports 2.121.0 and was checked for `link`, `db push`,
`migration list`, `db advisors`, `db query` and `gen types`. The official
v2.121.0 annotated tag resolves to commit
`8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2` (tag object
`97531eb590ccd2c5cf215287ae03e877180810b4`). The active implementation is under
`apps/cli/src/`; the repository also retains a separate `apps/cli-go/` tree.

## Why ordinary link is excluded

The current `link` handler unconditionally requests
`getProjectApiKeys({ ref, reveal: true })`, extracts the elevated service-role key
and passes it to tenant version probes. Those probes send it in the `apikey`
header and, for legacy JWT keys, the Authorization header. `--skip-pooler`
changes pooler discovery only; it does not disable the key read or probes. The
accepted password flag is not consumed by this handler. The older prose about
linking with/saving a database password does not describe that implementation.

This conflicts with this project's elevated-key restriction in AGENTS rule 5.
Do not infer an exception from general account access or M01 authorization. Do
not fabricate a link by writing `.temp/project-ref`. Record a narrow T2 deviation:
verified explicit-ref access instead of a completed `supabase link` receipt.

Sources: [link handler, lines 291–307](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/commands/link/link.handler.ts#L291),
[tenant headers, lines 59–69](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/tenant-versions.ts#L59),
[link service discovery](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/link-services-core.ts).

## Supported explicit-ref workflow

CLI help and handlers support these commands without a prior link:

```sh
corepack pnpm exec supabase migration list --linked --project-ref zmotjsbzhzjvpelxvxlf
corepack pnpm exec supabase db push --linked --project-ref zmotjsbzhzjvpelxvxlf --dry-run --skip-vault
corepack pnpm exec supabase db push --linked --project-ref zmotjsbzhzjvpelxvxlf --skip-vault
corepack pnpm exec supabase db advisors --linked --project-ref zmotjsbzhzjvpelxvxlf --type security --level warn --fail-on warn
corepack pnpm exec supabase db advisors --linked --project-ref zmotjsbzhzjvpelxvxlf --type performance --level info --fail-on error
corepack pnpm exec supabase gen types --project-id zmotjsbzhzjvpelxvxlf --lang typescript --schema app,api,ops,ingest
```

These are reviewed future commands, not execution receipts. Review the exact
seven pending migration filenames before the push; do not use `--include-seed`.
`--skip-vault` avoids unrelated Vault materialization. Capture tool output
privately and emit reviewed metadata rather than raw credentials or debug logs.
The supported explicit-ref resolver can fetch pooler metadata when direct IPv6
connectivity is unavailable. Its metadata cache is not a link receipt.

Sources: [push target/ref handling](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/commands/db/push/push.handler.ts#L48),
[explicit-ref pooler fallback](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/db-config.layer.ts#L410),
[migration-list ref handling](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/commands/migration/list/list.handler.ts#L50),
[advisor ref handling](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/commands/db/advisors/advisors.handler.ts#L111).

## Token versus database password

`SUPABASE_DB_PASSWORD` is supported by the DB resolver. Precedence is explicit
password flag, private shell environment, project env file, then empty. Keep
secrets out of flags. With a nonempty password, the resolver connects as
`postgres` without minting a role. That database connection is governed by its
SQL privileges, rather than by the PAT's narrower API permissions.

Without a nonempty database password, the resolver uses the PAT to call
`createLoginRole({ref, read_only:false})`, receives temporary credentials and
connects to Postgres. Thus PAT-only `db push` is supported, but it still performs
a real database connection and temporary-role creation; there is no
`--management-api` migration-push flag. Even linked CLI advisor/query commands
resolve this database connection before their HTTP requests. A dry-run can
therefore mint a role, despite not applying migrations.

The temporary pooler-role retry path attempts ban listing/removal after its
third failed connection. Leave Network Bans permissions ungranted; failure of
that optional API call is ignored. Do not grant network changes simply to make
a failed connection retry succeed. Diagnose privately or use another reviewed
access method.

Sources: [password precedence](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/db-config.layer.ts#L297),
[temporary role creation](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/db-config.layer.ts#L203),
[retry behavior](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/command-internal/db-config.layer.ts#L232).

TypeScript generation with an explicit project ID uses the Management API
`generateTypescriptTypes` endpoint directly. The source's direct SQL generation
branch is for other languages. Use the TypeScript command above; it needs no
database password and does not itself mint a temporary role.
[Source](https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/apps/cli/src/commands/gen/types/types.handler.ts#L386).

## Smallest practical access choices

The owner can choose one private access path, scoped only to dev now:

| Path                                  | Needed access                                                                                                 | Boundary                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Explicit-ref CLI with PAT only        | Database Read-write; Connection Pooling Read; Advisors Read; Project Settings Read                            | No database password or API-key permission. SQL runs through a temporary login role.                             |
| Explicit-ref CLI with DB password     | Private project database password plus PAT for the needed read endpoints                                      | Password grants broad SQL access independently of the PAT; no need to request it if PAT-only access is suitable. |
| Connected project-scoped Supabase MCP | Migrations Read-write for apply/list, Database Read for schema/types, Advisors Read and Project Settings Read | Avoids the CLI link probe and pooler login setup; verify actual tools/permissions after connection.              |

Add Auth Config Read and Data API Config Read for M01's provider/exposure
verification. A later API exposure update needs Data API Config Read-write; do
not add unrelated settings, billing, API keys, API-key secrets, network or
account-wide project-list permissions. Production needs its separate T13 owner
approval and separately scoped access.

Use a scoped token through `SUPABASE_ACCESS_TOKEN` in a private environment.
Browser-based CLI login creates a classic full-account token, so it is not the
chosen way to establish scoped access. A dashboard login does not make a CLI
token or connected MCP tool available. No request should ask the owner to paste
a token/password into chat.

Permission mapping and token behavior were checked against the official
[scoped PAT documentation](https://supabase.com/docs/guides/platform/personal-access-tokens).
The permission set is a source-derived proposal, not a live credential test.
