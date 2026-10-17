# Independent pipeline, API and operations review

Date: 2026-10-17. Reviewer: `m01_schema_security` agent.

Verdict: **No unresolved required source changes in the reviewed files.** This
approves the local implementation candidate. It does not establish hosted
readiness, production approval, Google sign-in, pooler access or performance.
The root engineer owns the final replay, complete test run and advisor receipts.
The later checkpoint below records the final 242-test result and independent
review of the concurrent-session probe and its hardening evidence.

## Scope and independence

Read the project rules, M01 requirements, binding decisions, data/schema/API
contracts, normalized-item JSON Schema and n8n workflow interfaces. Applied the
project-local code-review-and-quality and security-and-hardening guidance.

Reviewed code authored by other agents:

- Migrations 4–7: pipeline RPCs; app search, similar and scope helper; Storage and
  housekeeping; taxonomy, settings, price placeholders and invite seeds.
- pgTAP suites 04–09 and local fake-data seed.
- `supabase/config.toml`, the secret-safe pooler check and local CI runner, their
  regression tests and documented interfaces.

This agent authored migrations 1–3, tests 00–03 and the local Data API probe;
those are excluded from this independent approval. The separate
`token_integrity` agent reviewed migrations 1–3 and tests 00–03 and reported no
additional required source findings. Running the Data API probe here provides
runtime evidence, not independent authorship review of that probe.

## Required findings and resolution

| ID  | Severity | Finding                                                                                                                                                                                        | Resolution and evidence                                                                                                                                                                                                                                                                                                                                 |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | High     | Local email/password signup was enabled with email confirmation disabled. Signing up the invited owner's email could consume the seeded admin invite without proving ownership through Google. | Root disabled `[auth.email].enable_signup` and restarted the owned stack. The actual HTTP signup probe returns 400 with `email_provider_disabled`; a SQL read confirms no synthetic signup user was created. See `local-data-api-with-signup.json`. Hosted provider verification must separately establish the same boundary.                           |
| R2  | Medium   | Backfill claims ignored `next_due_at`, bypassing the six-hour delay after a failed collection.                                                                                                 | The backfill branch now requires the retry timestamp when `consecutive_failures > 0`. Successful unfinished backfills can continue in the next scheduler slot. `backfill-retry-red.log` reproduces the earlier failure; suite 06 adds failure-delay, due-retry and successful-pagination regressions. Final green evidence belongs to the final replay. |
| R3  | Medium   | Matching the account platform alone permitted `linkedin_employees` to enter the item writer, although that platform is excluded by the normalized-item schema.                                 | The writer now checks the complete normalized platform allowlist before writes. Suite 05 includes the employee-snapshot negative regression. `normalized-boundary-red-backfill-green.log` preserves the earlier caught-no-exception failure. Final green evidence belongs to the final replay.                                                          |
| R4  | Medium   | Concurrent website accounts discovering the same new global URL could both pass the precheck. The unique-key loser silently returned an empty diff instead of reporting an ownership conflict. | A second ownership check now runs after the unique-key insert/wait, raising 22023 for the losing account. The first owner's URL row is preserved. Read back the implemented post-insert check; the separate concurrent-session probe must supply runtime race evidence.                                                                                 |

The root engineer addressed source findings; this reviewer did not edit the
reviewed implementation. The independent review found the defects above after
the initial 238-test run, so that earlier green run does not certify the fixes.

## Accepted interface limits

- Account-result receipts are first-write-wins. Replays compare immutable
  status, counts and error; conflicting values raise. Repeated calls do not
  replace the original backfill completion/cursor, even if later progress
  arguments differ, and cannot release a newer run's claim. This is now
  explicit in `docs/TECHNICAL.md` section 5.3. M03 callbacks must send the final
  account result once and preserve those inputs on retry; new progress needs a
  new run/claim. This is not an all-argument conflict-detection guarantee.
- The current claim interface accepts its `p_mode` independently of the stored
  run mode. Root accepted this M01 interface; M03 callers must keep the start-run
  and claim modes consistent. Neither parameter grants permission for a paid
  backfill or production action.
- Search filters apply to items, as M01 T7 specifies. Other entity types retain
  their own eligibility and RLS checks. Broad search tuning and realistic-volume
  benchmarks remain M11 work.

## Review assessment

**Correctness.** Source identities are global per platform/external ID and cannot
be reassigned to another account. Insert-only raw rows retain their original
payload. Item shells and queue messages are created only for new canonical
items; replayed and content-duplicate inputs do not enqueue AI again. Empty and
undated batches preserve watermarks; timestamp ties use deterministic C
collation. Existing fields and human-locked metrics are preserved. Website
discovery remains distinct from completed crawling, so uncrawled/failed URLs
stay retryable and ignored decisions survive rediscovery.

**Security.** Machine roles receive execution privileges through non-exposed
RPCs, with empty function search paths and explicit PUBLIC revocation. The
writer holds no direct clean/raw table privileges. Run platform, current account
claim, expiry and ownership are checked before ingestion. Account-result replay
is deliberately read-only before examining a newer claim. App search/similar
remain invoker functions; their keyword and semantic branches share caller RLS
and item eligibility. The scope helper fails closed without a matching scope.
No reviewed script prints credentials, JWTs, status payloads or raw connection
errors. Pooler URLs and decoded passwords stay out of process arguments; role,
port, host, TLS and query parameters are validated, inherited connection
overrides are cleared, and connection tests roll back their writes.

**Architecture and readability.** The pipeline contains the nine M01 functions
with explicit guards and bounded batches. Later milestone writers are absent.
The per-item loop makes canonical selection and same-batch visibility explicit
instead of combining conflicting data-modifying CTEs. Existing columns, queue
message shapes and n8n return contracts are retained. Search source branches
return a consistent rank shape and fuse ranks in one place.

**Concurrency and performance.** Claims use `FOR UPDATE SKIP LOCKED` and record
the lease-owning run. Canonical selection locks the competitor before its
account; globally conflicting item keys are processed in a consistent lexical
order. These are source-level checks, supported by the pending independent
two-session probe. Batch and queue sizes have upper bounds. Search can still
materialize broad entity sets and the writer performs several indexed
operations per item; no large-volume latency claim is made.

## Evidence boundaries

- Personally executed the local Data API probe: member 200 with the known fake
  item, non-member 200 with zero rows, each non-exposed schema 406/PGRST106, and
  email signup 400/provider-disabled with zero new signup users. Cleanup passed
  for the two ownership-marked synthetic auth fixtures. The command and safe
  output are recorded in `local-data-api-with-signup.json`.
- Personally verified PostgreSQL 17 test-only membership syntax in a rolled-back
  transaction: `GRANT api_agent TO postgres WITH INHERIT FALSE, SET TRUE` permits
  the pgTAP role switch without persisting a production role-graph change.
- Read the recorded initial 238-test green result and the later targeted red
  reproductions. Final post-fix pgTAP, concurrency and advisor evidence must be
  recorded separately by the root engineer before acceptance.
- Source review did not mutate implementation conditions. The separate
  `rls-mutation.log` records the root's RLS mutation check; it is distinct from
  this review and must not be described as personally executed here.
- No hosted SQL, real pooler credential, Google OAuth exchange, production
  migration, collector/provider execution or paid backfill was performed by
  this reviewer.

## Official sources checked

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts)
- [Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes)
- [PostgREST schema selection](https://docs.postgrest.org/en/stable/references/api/schemas.html)
- [PostgreSQL 17 role grants](https://www.postgresql.org/docs/17/sql-grant.html)
- [PostgreSQL function privileges](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [PostgreSQL default privileges](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)
- [Supabase pgmq reference](https://supabase.com/docs/guides/queues/pgmq)

## Final concurrency-checker review checkpoint

Reviewed `scripts/db/check-concurrency.mjs` independently after its author ran
the four database scenarios. Two additional required safeguards and one proof
improvement were requested and then read back in the final source:

1. **Bounded owned-process shutdown.** A rejected command previously left no
   final deadline for the spawned Docker client itself. The final implementation
   terminates only the recorded database sessions after rechecking the pinned
   container, then closes only stored child handles with 300/700/300 ms stages,
   SIGTERM/SIGKILL as necessary, destroyed streams and `unref()` in `finally`.
   Failed shutdown makes the probe fail. Local handle cleanup still runs if
   database identity validation or fixture cleanup fails.
2. **Guard dependent data before synthetic parent deletion.** Additional rows
   could otherwise be deleted by a cascade, altered by `ON DELETE SET NULL`, or
   left as vector references. The final pre-delete guard rejects unexpected
   media, employee snapshots, stats, credits, campaign links, extraction rows,
   costs and embeddings connected to the synthetic company/items. It also
   checks both run/account receipt directions. Rejection rolls back cleanup;
   deletion remains restricted to this invocation's marked synthetic fixture.
3. **Identify the actual blocking session.** The probe now obtains each worker's
   backend PID and requires the known first worker to appear in
   `pg_blocking_pids()` for the waiting second worker. An unrelated lock event
   cannot stand in for the claimed serialization barrier.

No unresolved required findings remain in this script. Identity checks pin the
project, local Docker transport, container ID, database port 60322, PostgreSQL
17, database role and expected pipeline function. The two workers hold distinct
identified sessions. Outcomes require exact fixture row and queue-message
counts, and the expected website loser must exit with SQLSTATE 22023. Exceptions,
missing barriers, incomplete cleanup or unsettled handles produce failure.
The script does not claim hosted, machine-login, provider or paid-run acceptance.

Evidence read during this checkpoint:

- `pgtap-final.log`: all ten suites pass, **242 assertions**. This replaces the
  earlier 238-test result as evidence for the added pipeline boundary fixes.
- `pipeline-boundary-green.log`: focused post-fix boundary suites pass.
- `local-concurrency.json`, observed **2026-10-17 18:01:53 UTC**: all four real
  database scenarios pass, with owned-fixture cleanup OK. These cover overlapping
  SKIP LOCKED claims, repeated natural identity, concurrent content duplicates
  and the cross-account website URL conflict. The earlier receipt is preserved
  in `local-concurrency-initial.json`.
- `local-concurrency-hardening.json`, observed **2026-10-17 18:02:53 UTC**: the
  actual source Session class passes an isolated never-exiting child double;
  twelve rollback-only dependent-row cases reject cleanup with P0001, while a
  clean fixture is allowed. No fixture competitors remain. These negative cases
  validate failure controls; they are distinct from the four real concurrent
  database scenarios.

The concurrency author executed those probes; this reviewer inspected their
source and recorded receipts. No repeated broad test run or implementation
mutation was performed during this read-only review.

## Final credential-scanner review checkpoint

Independently reviewed the staged `scripts/check-secrets.mjs` and its new
isolated Node tests. Verified that the inspected working-tree files match their
staged blobs. **No unresolved required findings remain.**

The extension retains the existing detectors and index-only `git grep --cached`
behavior, adds the official CLI's Supabase PAT shape and checks password-bearing
PostgreSQL URIs, including encoded values and query passwords. Findings contain
only rule, path and line. There is no general documentation/test-directory
exemption. A reserved hostname alone cannot excuse a password; named synthetic
credentials require a reserved/loopback hostname too. Production-shaped hosts
receive no synthetic-credential exemption. Malformed host/percent parsing
cannot grant one.

The first readback found two required false negatives. A synthetic-only probe
against the actual parsing function confirmed both without printing candidate
values:

- An unrestricted angle-placeholder expression accepted arbitrary angle-wrapped
  credentials even on production-shaped hosts. The final code allows only
  explicitly named whole-value password placeholders and variable references.
- Splitting the authority on `/`, `#` or `?` before locating `@` could discard
  malformed credential-shaped userinfo. The final code inspects that userinfo
  first and detects those values instead of treating them as password-free.

The author added two regressions and recorded their true red result: eight tests
passed and the two new tests failed. After the fixes, all ten scanner tests pass;
the combined scanner/pooler regressions pass 18/18. The recorded staged scan
covers 635 files with zero findings. See `secret-scanner-verification.md` for the
actual commands, historical harness failure, red/green sequence, official PAT
source and output limits. Those test and full-index outcomes were executed by
the author/root and read here; this reviewer did not repeat the broad suites.

The tests use synthetic values in separate Git indexes with isolated Git
configuration. Assertions suppress matching values in both stdout and stderr.
Recursive fixture cleanup verifies the resolved temp parent, directory shape
and ownership marker. This remains a targeted text-credential check, not a claim
that every possible credential format or assembled runtime value is detectable.
