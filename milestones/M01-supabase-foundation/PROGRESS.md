# M01 — Supabase foundation · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status

**In progress** <!-- Not started · In progress · Blocked: <reason> · In review · Done -->

| Field        | Value                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Started      | 2026-10-17                                                                                                                            |
| Last updated | 2026-10-17                                                                                                                            |
| Finished     | —                                                                                                                                     |
| Branch / PR  | m01-supabase-foundation / not opened yet                                                                                              |
| Current task | Publish local foundation and CI; hosted MCP activation                                                                                |
| Next step    | Refresh/reconnect the authenticated Supabase MCP in Codex; verify dev read-only before hosted migrations. Finish GitHub CI meanwhile. |

## Task checklist

<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->

- [x] T1 — Local Supabase
- [ ] T2 — Link dev (needs MA-03, MA-04)
- [x] T3 — Migration 1, extensions/schemas/roles
- [x] T4 — Migration 2, core tables
- [x] T5 — Migration 3, auth, RLS, views, search triggers
- [x] T6 — Migration 4, core pipeline RPCs
- [x] T7 — Migration 5, app RPCs and first search
- [x] T8 — Migration 6, Storage and cron
- [x] T9 — Migration 7, seed taxonomies, settings, price book, owner invite
- [x] T10 — pgTAP tests
- [ ] T11 — Google provider (needs MA-06)
- [ ] T12 — Push to dev, types, advisors, pooler test (needs MA-05 on dev)
- [ ] T13 — CI DB job and prod baseline (prod needs the owner's OK + MA-05 on prod)
- [ ] T14 — Docs and hand-off

## Acceptance criteria

<!-- Mirror of MILESTONE.md; paste evidence (command + output summary, counts, screenshot paths). -->

- [ ] AC1 — Local `supabase db reset --local` passed all seven CLI-generated migrations and seed. Exact versions in [local inventory](evidence/local-inventory.json); dev/prod parity remains unverified.
- [x] AC2 — Local inventory: app25, ingest1, ops10 tables.
- [x] AC3 — Local inventory: zero project tables without RLS, zero app/api views without invoker security, zero app definers. Role suites exercise actual restricted roles.
- [ ] AC4 — Local `supabase test db --local`: ten files,242 assertions, PASS ([final log](evidence/pgtap-final.log)). GitHub CI pending.
- [ ] AC5 — Local advisors: zero warnings/errors;63 unused-index and11 deny-all internal-table informational findings justified below ([report](evidence/advisors-final.json)). Hosted dev/prod not checked.
- [x] AC6 — Local seeds:120 taxonomy terms in exact six group counts,13 settings,17 price placeholders, owner admin invite present, domain autojoin empty. No real competitor data.
- [x] AC7 — Local inventory: three queues, two named active housekeeping jobs, public five-MiB media bucket with four approved MIME types. No client Storage write policies.
- [ ] AC8 — Hosted poolers not checked. Script safety tests8/8 pass with synthetic processes; that is not a connection receipt.
- [x] AC9 — Actual local HTTP: member app200 seeded fixture, nonmember app200 empty; ops/ingest/api/private406 PGRST106. Email signup400 email_provider_disabled and no user created; cleanupOK. [Receipt](evidence/local-data-api-with-signup.json).
- [x] AC10 — Types generated from local app/api/ops/ingest and formatted; strict workspace/root typecheck passed. Regenerate from hosted dev after push.
- [ ] AC11 — Browser verified Google DISABLED on dev; MA-06 remains open.
- [x] AC12 — Foundation commit504b54a scanned597 indexed files with zero findings. Final implementation index scanned635 files with zero findings; PAT/PostgreSQL-password detectors and18 script regressions pass. Targeted scanning is not an exhaustive credential audit.

## Blockers

<!-- What stops progress, since when, what unblocks it. Remove when resolved (keep in log). -->

- MA-04: both project refs/browser access verified. Dev-scoped MCP configured and OAuth succeeded, but this conversation has not loaded it (unknown MCP server). Refresh/reconnect or restart before hosted work. No hosted migration applied.
- MA-05/06: machine-role passwords and Google provider acceptance remain open. T13 production baseline and M01 merge need their explicit approval gates.

## Manual actions needed from the owner

<!-- Exact steps, why, and where to paste results. The owner ticks them; Codex verifies. -->

| #        | Action                                                                                                                                                                                                                                                                            | Why                                                | Status                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| MA-03    | Owner created both projects; browser verified identity, Everyone Pro, Frankfurt, healthy status and GitHub link. Hosted PG version and spend cap pending.                                                                                                                         | Intended targets established                       | Identity verified                    |
| MA-04    | Codex Settings > MCP servers > refresh/reconnect supabase, or restart this session. Server added and OAuth succeeded, but active conversation reports unknown MCP server.                                                                                                         | Load dev-scoped tools, then read-only verification | Waiting for session refresh          |
| MA-05    | After roles exist, privately set role passwords in Supabase SQL editor; configure N8N_WRITER_URL session5432 and API_AGENT_URL transaction6543. Never paste credentials here. See docs/MANUAL_ACTIONS.md MA-05.                                                                   | Real pooler checks                                 | Pending hosted migrations            |
| MA-06    | Google Cloud Console > Credentials > OAuth web client: redirect https://zmotjsbzhzjvpelxvxlf.supabase.co/auth/v1/callback. Supabase dev > Authentication > Sign In / Providers > Google: privately enter client values and enable. Disable Email provider for Google-only access. | Provider acceptance, full login M09                | Google disabled; owner setup pending |
| approval | Approve applying the baseline schema to prod                                                                                                                                                                                                                                      | T13                                                | Not requested yet                    |

## Decisions & deviations

<!-- Anything that differs from the docs. Also add to docs/DECISIONS.md → Changes if it changes a decision. -->

- Supported explicit project refs replace CLI `link`: version2.121.0 link reveals API keys and probes with the service-role key, contrary to hard rule5. Key-free migration/advisor/type commands use explicit refs and scoped access. No fabricated link receipt or `.temp` file.
- M01-specific contracts replace older general RPC milestone labels and midnight scheduling in DATA_SCHEMA/TECHNICAL. Generated handle_norm, nine real pipeline RPCs, JSON run summary, all six TSV triggers and all eight search item filters are implemented. No later-milestone stub was created.
- Added indexed audit foreign keys, active-member saved-view CRUD, serialized deduplication, stale-claim fencing, first-write-wins result receipts, deterministic watermark ties and backfill failure retry gating. Normalized data retains credits/media; unsupported employee-item platforms are rejected. Website discoveries remain retryable until crawled and reject competing account ownership.
- Receipt replay compares status/counts/error; later backfill cursor/done arguments cannot overwrite the first accepted progress. Claim mode is caller-selected; M03 must pass its workflow mode consistently. These limits are documented, without new columns or changed signatures.

## Risks / notes for the owner

- Local advisors retain required FK/list/search indexes despite63 unused-index INFO findings on a fresh DB. Eleven internal tables intentionally have RLS with no user policies. Security warnings/errors must remain zero on hosted checks too.
- Search correctness is covered; M11 scale/performance acceptance and M09 Google end-to-end sign-in are not claimed. Price book contains placeholders, not approved spend estimates. No collection, paid call, production migration or workflow activation occurred.
- Tests authored first for pipeline/script work; actual RED/GREEN receipts cover failed-backfill retries and unsupported normalized platforms. A rollback-only membership mutation was rejected by11 search assertions; no mutation remains.

## Session log

<!-- Newest first. One line per meaningful step: date · what · files · result. -->

- 2026-10-17 · Owner created emr-dev zmotjsbzhzjvpelxvxlf and emr-prod hkiafqrcxaafdbcvjlzv and granted access to both. Browser verified Pro/Frankfurt/healthy/GitHub links, no migrations, and Google disabled on dev. Added requested dev-scoped MCP; OAuth success and configuration enabled/OAuth readback. Active conversation still reports unknown server; no hosted SQL. See mcp-setup.json and hosted-preflight.json.
- 2026-10-17 · All seven migrations replayed from zero after fixes;242 assertions in10 pgTAP files pass. Local advisors zero warnings/errors (74INFO justified); REST/Auth probes and four real two-session concurrency scenarios pass with owned-fixture cleanup. Hardened runner also passes12 rollback-only cleanup rejection cases and bounded hung-child teardown. Unit39, pooler/CI script8 plus scanner10, strict typecheck, lint and Next build pass. Types regenerated after final replay; independent reviews retained. GitHub CI and staged secret review next.
- 2026-10-17 · First start on56322 failed: unrelated Job Radar Docker binding occupied it, no SQL applied. Checked Docker/host/reserved ranges and selected60321/60322. Restarted only verified Market Radar to disable email signup; preserved28 unrelated containers, zero missing. Config migrations/seed restored enabled before successful resets.
- 2026-10-17 · CLI2.121.0 pinned with install hooks blocked; init and seven filenames generated through CLI. Supported Docker Desktop start restored engine29.6.1. Initial preflight proposed56321/56322 (later found occupied; resolved above). Optional services disabled; startup-only migrations/seed disabled until SQL ready, then restored. See evidence/environment-preflight.md.
- 2026-10-17 · M01 authorized. Startup order completed; M00 remains Done on main d06dcd9. Created m01-supabase-foundation from a clean tree. Checked Docker (installed, daemon unavailable); scoped Supabase env token/refs/passwords absent, no app real env files or Supabase MCP tools. Public plugin discovery found an unconnected Supabase integration. Pinned CLI setup and local schema/security/test audit in progress. No hosted write, production baseline approval, paid account or credential disclosure.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone

<!-- Filled when Done: what exists now, how to run/verify it, known gaps, what the next milestone should start with. -->

- —
