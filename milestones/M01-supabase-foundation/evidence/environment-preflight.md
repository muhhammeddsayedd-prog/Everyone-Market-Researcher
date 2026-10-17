# M01 local environment preflight

Observed 2026-10-17 (Africa/Cairo). Scope: read-only environment checks and starting
the already-installed Docker Desktop. No Supabase stack, migration, CI change,
hosted connection, upgrade, terms acceptance, reset or deletion was performed by
this preflight agent.

## Docker result

- Initially, no Docker Desktop/backend processes were present, the Desktop
  status command could not retrieve status, and `com.docker.service` was stopped
  with manual startup. The selected context was `desktop-linux`, targeting
  `npipe:////./pipe/dockerDesktopLinuxEngine`.
- The installed executable is `C:\Program Files\Docker\Docker\Docker Desktop.exe`,
  version 4.80.0.232116. Its owner is `BUILTIN\Administrators`; its Authenticode
  signature is valid for Docker Inc. Running Desktop/backend processes use the
  installed Docker paths and the current Windows user's account.
- After checking current help and the [official start reference](https://docs.docker.com/reference/cli/docker/desktop/start/),
  `docker desktop start --timeout 45` returned exit 0. See [docker-start.json](docker-start.json).
  No fallback launcher was needed.
- Readback reports Desktop running, Docker CLI/server 29.6.1, Linux containers,
  24 CPUs and 16,723,730,432 bytes available to the Docker engine. The Windows
  helper service remains stopped; the working Linux engine was verified directly.
- The first available-engine inventory contained 28 running containers belonging
  to other projects. Their names, plus stopped-container names, are retained in
  [docker-readback.json](docker-readback.json). No container environment or command
  line was inspected, and no existing resource was stopped, removed or reset.
- Host listener readback shows ports 54321, 54322, 54323 and 54324 already bound
  on localhost by the Docker backend. Market Radar needs its own project ID and
  distinct ports. See [local-port-inventory.json](local-port-inventory.json).
- Host free physical memory fell from about 6.6 GiB before startup to about
  2.4 GiB in the recorded engine readback. Docker's 16 GiB memory limit is not a
  measurement of unused memory. Both workspace/system disks have over 140 GiB
  free. Preserve other projects and keep this milestone's service set small.

Process ownership/signature evidence is in [docker-process-ownership.json](docker-process-ownership.json).
The Desktop SessionID was omitted from the saved status output as nonessential;
the status and command exit code are unchanged. Engine/container readback is a
checkpoint, not evidence that a Market Radar database has started.

## Proposed local and CI database test setup

This proposal is based on the M01 acceptance criteria and the exact Supabase CLI
2.121.0 source. The root implementation agent owns installation, configuration,
service startup and validation. None of those Supabase commands ran here.

For the CLI's Compose backend, retain Postgres, GoTrue/Auth, PostgREST, the API
gateway and Storage. This supports auth-schema fixtures, database/RLS tests,
Storage metadata and the local REST exposure check. Candidate exclusions are:

```text
realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

Verify these against the installed CLI's `start --help` before use. Its source
warns and continues for invalid exclusion names, so warnings must be inspected;
an intended exclusion is not proof that a service was excluded. Do not use the
ignore-health-check flag to turn an unhealthy stack into acceptance.

For this backend, `supabase test db` runs the `supabase/pg_prove:3.36` container,
joins the project's Docker network and read-only mounts the test directory.
No host Perl/`pg_prove` installation or npm test framework is required. The CLI
enables pgTAP and restores its prior absence afterward, while preserving an
already-installed pgTAP extension. The runner rejects unsuccessful tests and
the zero-files/no-tests verdict. Its source currently selects PostgreSQL 15 or
17 test tooling; M01 expects 17, subject to the root agent's hosted-version check.

Each of the ten M01 SQL suites still needs `begin`, an explicit assertion plan,
`finish()` and `rollback`. Use the real member/non-member/anonymous/machine roles
inside tests; superuser-only successful queries do not prove RLS. Preserve positive
and negative checks for every policy, privilege denials, duplicate ingestion and
queue stability, human locks, claim exclusion, retry/watermark behavior, search
visibility, queue acknowledgement, cron and bucket metadata.

The later CI job should install the pinned CLI, start its own isolated local
stack, replay/reset only that CI-owned database, then run all ten suites. It
requires no hosted token or production database credentials. Keep root Vitest
coverage separate from database acceptance. Record file/assertion counts and
actual exit status; an empty or skipped suite is not a pass. Raw Supabase
`start`/`status` output can contain local credentials: retain redacted status
metadata rather than committing the raw output.

## Sources checked

- [Supabase local development](https://supabase.com/docs/guides/local-development)
  and [database testing](https://supabase.com/docs/guides/database/testing).
- CLI 2.121.0: [test command documentation](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/docs/supabase/test/db.md),
  [runner](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/test-db.handler.ts),
  [mount/argument handling](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/test-db.pg-prove-args.ts),
  [service catalog](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/service-catalog.ts)
  and [exclusion validation](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/start/start.exclude.ts).
- [Supabase changelog](https://supabase.com/changelog.md) was fetched before the
  Supabase audit. Relevant notes: extension version pin clauses are ignored from
  2026-08-05; PostgreSQL 15.19/17.11 changes affect some existing extension data;
  self-hosted Compose's gateway change must not be assumed to replace the CLI's
  separately verified service catalog. This preflight applied no extension or
  database changes.
