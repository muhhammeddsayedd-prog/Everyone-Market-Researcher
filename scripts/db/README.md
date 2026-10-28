# Database verification scripts

`run-local-ci.sh` is for the isolated GitHub-hosted `db-tests` job. It requires
GitHub Actions, CLI 2.121.0 and the checked-in local Supabase configuration. It
starts only the services needed by M01, resets only the local CI database, runs
the required seeded pgTAP suites (now14, including HC-01) and checks local advisors. Raw CLI output stays in a private
temporary file and is never uploaded; the log shows outcome labels and numeric
TAP totals. A missing suite, zero assertions, test failure, security warning/error
or performance error fails the job. Non-error performance findings still need
the milestone's documented assessment.

The same job runs `check-data-api.mjs` for the local REST exposure boundary.
It also runs `check-concurrency.mjs`: two live SQL sessions prove SKIP LOCKED,
natural-key replay, content deduplication and conflicting website URL ownership.
The local-only probe verifies project/container identity and cleans only its
UUID-marked synthetic records. It uses database lock observations as barriers
and bounded timeouts; no extension, hosted credential or external API is needed.
Neither CI script requires hosted database passwords or a Supabase access token.
The existing pnpm dependency-script block is unchanged. The pinned setup action
installs the exact CLI in its own temporary tool directory; CLI 2.121.0 has no
install lifecycle hooks, so that action selects `--ignore-scripts=true`.

## Pooler role checks

After the owner sets machine-role passwords and privately supplies the verified
project's URLs, run:

```sh
bash scripts/db/check-pooler.sh
```

Requirements: Bash 4.4+, Node 24 and a PostgreSQL 17 `psql` client on `PATH`. The script
reads `N8N_WRITER_URL` for the session pooler on port 5432 and `API_AGENT_URL` for
the transaction pooler on port 6543. Use the documented Supavisor URI format,
the `postgres` database, `<role>.<project-ref>` username and a single `sslmode`
parameter (`require`, `verify-ca` or `verify-full`). Passwords must be URI-encoded.
Unexpected query parameters and duplicate parameters fail validation.

Supply credentials through the private environment or an ignored local file;
keep them out of command lines, shell history, Git and progress/evidence files.
The script parses the URLs into private libpq environment fields, disables shell
tracing and the psql startup file, refuses password prompts, and suppresses raw
connection/query output. Only these two lines are printed:

```text
n8n_writer: OK
api_agent: OK
```

Either line becomes `FAIL` on error, with exit status 1 if either role fails.
Both roles are attempted. It verifies the actual SQL role, exercises the writer's
start/finish RPCs and the agent's read view, then rolls back the test transaction.
No permanent connection-test run row is created.

`EMR_POOLER_ENV` defaults to `dev`. Use `prod` only at M01 T13 after the recorded
owner approval and after verifying the production project/role credentials; the
script itself does not authorize hosted or production work. Pooler checks are
manual and are not run by CI.

The security regressions use synthetic URLs and fake CLI/psql processes; they
make no database or network connection:

```sh
node --test scripts/db/check-pooler.test.mjs
```

Sources: [libpq environment fields](https://www.postgresql.org/docs/17/libpq-envars.html),
[psql scripting](https://www.postgresql.org/docs/17/app-psql.html),
[pinned setup action](https://github.com/supabase/setup-cli/tree/45a513f8c64c0bc8e0e3dfe572b5c95be85f6359)
and the installed CLI's command help.
