# Local database CI and pooler-script verification

Observed on 17 October 2026. This record covers script implementation and
synthetic safety checks. It does not establish a hosted pooler connection, a
GitHub Actions run or live pgTAP/advisor acceptance.

## Implementation

- `.github/workflows/ci.yml` adds an isolated GitHub-hosted `db-tests` job. It
  installs frozen workspace dependencies, uses Supabase CLI 2.121.0, runs the
  script regressions, starts/replays/tests the local database, runs local
  advisors and checks local Data API exposure. No hosted credentials are passed.
- `scripts/db/run-local-ci.sh` refuses a non-GitHub environment, clears hosted
  credential variables and uses explicit `--local` targets for reset, tests and
  advisors. Start/reset/test/advisor stdout and stderr remain in a private
  temporary file. Only fixed outcome labels and numeric pgTAP totals reach the
  log. A failure stops the pipeline. Ten test files, nonzero assertions and an
  explicit PASS verdict are required.
- The local start excludes
  `realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`.
  Database, gateway, Auth, REST and Storage remain available for M01.
- `scripts/db/check-pooler.sh` accepts privately supplied role URLs only after
  validating the pooler hostname, role, port, database, TLS mode and query
  parameter allowlist. Parsed fields are passed through libpq environment
  variables, never process arguments. psql startup files and password prompts
  are disabled; raw output is suppressed. The writer RPC test and reader query
  run in transactions that roll back. Only each role's OK/FAIL line is emitted.
- Pooler checks require Bash 4.4+, Node 24 and PostgreSQL 17 psql. They remain
  manual, with the documented owner approval required before a production
  connection. The CI job does not run them.

## Tool and source verification

The installed CLI returned `2.121.0`. Its actual `start`, `db reset`, `test db`,
`db advisors`, `status` and `db query` help was inspected before implementation.
The tested advisor invocations are security `--level warn --fail-on warn` and
performance `--level warn --fail-on error`, both with `--local`. Non-error
performance findings still require the milestone's documented assessment.

The official `supabase/setup-cli` v3.0.1 release resolves to
`45a513f8c64c0bc8e0e3dfe572b5c95be85f6359`, which is pinned in CI. Its action source
uses a temporary CLI tool installation and enables `--ignore-scripts=true` when
the selected package has no install lifecycle hook. The verified 2.121.0 package
has no preinstall/install/postinstall hook; it uses platform optional binary
packages. The project's pnpm dependency-script block remains in place.

Official CLI 2.121.0 test-runner source uses the Docker
`supabase/pg_prove:3.36` image, handles the pgTAP extension and propagates failures.
There is no additional host Perl, pg_prove or npm test-framework dependency.

Sources:

- [Pinned official setup action](https://github.com/supabase/setup-cli/tree/45a513f8c64c0bc8e0e3dfe572b5c95be85f6359)
- [Official CLI 2.121.0 source](https://github.com/supabase/cli/tree/v2.121.0)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [PostgreSQL 17 libpq environment variables](https://www.postgresql.org/docs/17/libpq-envars.html)
- [PostgreSQL 17 psql scripting](https://www.postgresql.org/docs/17/app-psql.html)

## Actual checks

`node --test scripts/db/check-pooler.test.mjs` first failed all eight tests while
the implementation scripts were absent (exit 1). After implementation, all
eight tests passed (exit 0). The final run after formatting and strengthening
the phase-stop assertions also passed 8/8 in about 8 seconds.

The tests use synthetic URLs and fake psql/Supabase executables. They cover
credentials staying out of arguments and logs, role/port/TLS/parameter
rejection, rollback SQL, independent role outcomes, explicit local CLI targets,
refusal outside GitHub Actions, immediate stop at every failed CI phase and
rejection of empty/incomplete TAP results. Synthetic stdout/stderr markers must
remain private. They make no database or network connection.

Focused ESLint passed for the Node regression file. Git Bash syntax checks
passed for both shell scripts. Prettier processed the workflow, regression file
and script README files. No pnpm install-hook policy, migration, Supabase
configuration or PROGRESS file was changed by this subtask.

The real CI runner was not invoked in the developer workspace; its guard
deliberately prevents that local reset. Hosted pooler checks remain unperformed:
no verified hosted passwords or host psql client were supplied to this subtask.
