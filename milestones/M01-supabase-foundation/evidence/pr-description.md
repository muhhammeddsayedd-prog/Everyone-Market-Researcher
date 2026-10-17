The repository now has a local Supabase foundation: seven CLI-generated
migrations replace the database placeholder with36 RLS-protected project
tables, invite membership, restricted machine RPCs, invoker search, queues,
housekeeping and the media bucket. Fake C999 data is local/CI only; hosted
baseline migrations leave competitor/account tables empty for M02.

The pipeline preserves human locks and watermarks, queues each new canonical
item once, fences stale workers, respects six-hour backfill failure retries,
and rejects conflicting website ownership. Google-only configuration disables
local email signup so an unverified email cannot consume the admin invite.

Validation observed locally:

- Clean replay of all seven migrations and seed; ten pgTAP suites,242 assertions pass.
- Four real two-session concurrency scenarios pass;12 negative cleanup cases
  and bounded hung-child teardown pass, with owned-fixture cleanup.
- REST member/nonmember and all four hidden schemas pass; disabled email signup
  returns400 without creating a user.
- Advisors report zero warnings/errors. Informational findings are63 unused
  required indexes on a fresh database and11 intentionally deny-all internal tables.
- Generated types, strict typecheck, lint,39 unit tests,8 pooler/CI script tests
  and Next.js build pass. Independent reviews and RED/GREEN evidence are retained.

This is a **draft pending hosted acceptance**. Both owner-created projects were
verified healthy on Everyone Pro in Frankfurt and linked to this repository.
The requested dev-scoped MCP was added and OAuth login succeeded; the current
conversation still needs to load that new server before any hosted SQL.
MA-05 pooler credentials, MA-06 Google provider, dev/prod migration/advisor/type
parity, the production-baseline gate and owner merge approval remain open.
No hosted migration, paid collection, workflow activation or M02 work is claimed.

[GitHub CI39057026434](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39057026434)
passed quality,unit,build,e2e anddb-tests, including242 pgTAP assertions, all HTTP
probes and the four concurrent collector scenarios. Final scanner review also
passes:10 scanner tests,18 combined script tests and zero indexed findings.

CLI2.121.0 `link` reveals API keys and probes with a service-role key. The
documented key-free CLI fallback uses supported explicit project refs instead,
without inventing a link receipt. See M01 PROGRESS and evidence for exact scope,
source checks, historical failures and current blockers.
