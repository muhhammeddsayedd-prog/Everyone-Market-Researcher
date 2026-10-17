# M01 source review — 2026-10-17

Supabase CLI is pinned to 2.121.0. Current command help was inspected for init,
start/exclusions, stop/project-id, migration new/up, db reset/query/advisors,
test db, status and gen types. The repository's blocked install hooks remain
enabled; this CLI release uses a platform package without an install lifecycle
hook. Node 24.18.0 and Docker Engine 29.6.1 were observed locally.

Official references checked:

- [Supabase changelog](https://supabase.com/changelog.md): extension version pins
  are ignored by the current platform; migrations use available defaults.
  PostgreSQL 17.11's pgcrypto legacy-cipher notice does not remove SHA-256.
- [CLI local development](https://supabase.com/docs/guides/local-development/cli/getting-started):
  project dev dependency and Docker on Windows.
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
  [user data](https://supabase.com/docs/guides/auth/managing-user-data), and
  [API security](https://supabase.com/docs/guides/api/securing-your-api): explicit
  grants, active membership, private authorization helpers and invoker views.
- [Queues / pgmq](https://supabase.com/docs/guides/queues/pgmq): create, read,
  send_batch, archive and archive table conventions. Queues remain private.
- [Cron](https://supabase.com/docs/guides/cron): named SQL jobs and cron.job.
- [Buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets):
  public reads, five-MiB size limit and allowed MIME types. No client write policy.
- [Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search): keyword and
  cosine-vector candidate ranks fused with reciprocal rank; the project keeps
  k=60 and its required multi-entity contract.
- [Monitoring and debugging](https://supabase.com/docs/guides/monitoring-and-debugging)
  now redirects to Observability; fetched before SQL/REST diagnosis.
- [PostgreSQL 17 GRANT](https://www.postgresql.org/docs/17/sql-grant.html) and
  [role membership](https://www.postgresql.org/docs/17/role-membership.html):
  ADMIN and SET are separate. Tests grant temporary SET membership to the runner
  inside rollback transactions, then exercise the actual machine role.
- [Default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html):
  schema-specific revokes cannot remove a global PUBLIC default. Every project
  function therefore also has explicit PUBLIC EXECUTE revocation.

Some Supabase `.md` routes were unavailable through the web reader; direct
markdown fetches or the official HTML equivalent were used. Hosted project
plan, region, Postgres version, OAuth settings and pooler behavior have **not**
been verified. Price-book values are handoff placeholders, not current quotes.

## Runtime findings retained

- Initial port56322 was occupied by an unrelated restored Docker project;
  preserved it. Both Docker bindings and host listeners, plus Windows excluded
  ranges, were checked before selecting60321/60322.
- All seven migrations and the local seed applied from zero. The first pgTAP
  run failed at machine-role SET membership and a dynamic VALUES test query;
  test setup was corrected, without broadening deployed machine privileges.
- The first passing run executed238 assertions across ten files. A rollback-only
  inversion of `private.is_member` was rejected by11 search assertions. No
  mutation remains in the migrations or running database.
- Independent review found local email signup could consume the owner's invite
  without Google verification. Local email signup is disabled; the final Auth
  rejection probe and hosted settings remain separate checks.
- Independent review found backfill failures bypassed the six-hour retry delay.
  The targeted regression failed before correction and passed after it; the final full suite has242 assertions. No hosted job ran.
