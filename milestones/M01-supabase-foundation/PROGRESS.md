# M01 — Supabase foundation · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status

**Blocked: waiting on owner — MA-04 (private dev migration password)**

| Field           | Value                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Started         | 2026-10-17                                                                                                                                                                                                                                                                                                                                      |
| Last updated    | 2026-10-17                                                                                                                                                                                                                                                                                                                                      |
| Finished        | —                                                                                                                                                                                                                                                                                                                                               |
| Branch / PR     | m01-supabase-foundation / [#4 draft](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/4)                                                                                                                                                                                                                                |
| Current task    | Existing dev OAuth now verified live; hosted database empty. Email provider disabled. Exact-version push awaits one private credential.                                                                                                                                                                                                         |
| Verified source | 8a6502503a0b3108e65c1bfbf6a2a272e2022ebc; [CI39057325483](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/actions/runs/39057325483) all five jobs and Vercel passed. This follow-up records hosted evidence without changing SQL.                                                                                           |
| Next step       | Privately configure existing dev DB password as PGPASSWORD, then follow the [exact-version dry-run/push plan](evidence/hosted-acceptance-20261017.md). Recheck remote history before writing, exclude fixtures, verify dev catalogues/API/advisors/types, then owner role credentials and Google setup. No new login/PAT/reconnection required. |

## Task checklist

<!-- Mirror of the tasks in MILESTONE.md. Tick when done and committed. -->

- [x] T1 — Local Supabase
- [ ] T2 — Dev-scoped OAuth verified; supported link deviation recorded; app API exposure awaits schema creation
- [x] T3 — Migration 1, extensions/schemas/roles
- [x] T4 — Migration 2, core tables
- [x] T5 — Migration 3, auth, RLS, views, search triggers
- [x] T6 — Migration 4, core pipeline RPCs
- [x] T7 — Migration 5, app RPCs and first search
- [x] T8 — Migration 6, Storage and cron
- [x] T9 — Migration 7, seed taxonomies, settings, price book, owner invite
- [x] T10 — pgTAP tests
- [ ] T11 — Email provider disabled and rechecked; Google remains disabled (MA-06)
- [ ] T12 — Exact-version dev push awaits private PGPASSWORD (MA-04); post-migration types/advisors and MA-05 pooler checks pending
- [ ] T13 — CI DB job passed; prod baseline still needs separate approval and MA-05 prod
- [ ] T14 — Docs and hand-off

## Acceptance criteria

Local/CI results below are preserved receipts, not new hosted acceptance.
Current source CI is linked above. [Local inventory](evidence/local-inventory.json),
[local REST/Auth receipt](evidence/local-data-api-with-signup.json),
[local advisors](evidence/advisors-final.json), [fresh hosted receipt](evidence/hosted-resume-20261017.json).

| AC                 | Local                                                                                              | CI at reviewed source         | Hosted dev                                                                                                                   | Hosted prod                                |
| ------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| AC1 migrations     | PASS: seven CLI-generated versions reset cleanly                                                   | PASS: local reset/db-tests    | Empty ledger verified; exact-version push blocked MA-04                                                                      | Not applied; T13 approval open             |
| AC2 tables         | PASS: app25/ingest1/ops10                                                                          | PASS: table assertions        | Zero project relations; baseline absent                                                                                      | Not verified                               |
| AC3 security       | PASS: all RLS; invoker views; zero app definers; restricted roles tested                           | PASS: role/RLS assertions     | No project objects to accept yet                                                                                             | Not verified                               |
| AC4 pgTAP          | PASS: ten files,242 assertions; four two-session scenarios and REST probes                         | PASS: db-tests at source head | Wholesale fixture suites intentionally not run; bounded checks pending                                                       | Not run                                    |
| AC5 advisors       | PASS: zero WARN/ERROR;63 unused-index +11 deny-all INFO justified                                  | PASS: local advisors          | Before migration: security0; performance1 INFO Auth connection allocation. After migration pending                           | Not run                                    |
| AC6 baseline seeds | PASS:120 taxonomy terms,13 settings,17 prices, owner invite; zero autojoin domains                 | PASS: seed assertions         | Not seeded; no domain table yet. M02 fixtures not imported                                                                   | Not applied                                |
| AC7 services       | PASS: three queues, two housekeeping jobs, public five-MiB media/four MIME types; no client writes | PASS: service assertions      | Queues/cron/bucket absent                                                                                                    | Not applied                                |
| AC8 poolers        | Eight synthetic safety tests pass; not authentication                                              | Synthetic checks only         | Actual session5432/transaction6543 host discovered; roles/credentials absent (MA-05), no auth receipt                        | No auth receipt; MA-05 prod after approval |
| AC9 Data API/Auth  | PASS: member app200/nonmember empty; private schemas406; email signup400/no user created           | PASS: local REST/Auth checks  | Actual exposed public+graphql_public; add app after migration. Email DISABLED after saved change/reload; hosted REST pending | Not verified                               |
| AC10 types         | PASS: generated app/api/ops/ingest and strict typecheck                                            | PASS: quality/build           | No generation: baseline absent; local types preserved                                                                        | Not generated                              |
| AC11 Google        | Not simulated                                                                                      | No hosted login claim         | DISABLED verified; callback identified; MA-06. Full signin M09                                                               | Not configured/verified                    |
| AC12 secrets       | Prior indexed636-file scan zero; PAT/password detectors +18 script regressions passed              | PASS: source quality checks   | Presence-only credential checks; no key/OAuth material accessed or committed                                                 | No credential access or writes             |

No overall hosted AC is ticked solely from local/CI or an empty database.
The evidence follow-up receives its own checks at its eventual commit; it does
not rewrite the source run's SHA.

## Blockers

- MA-04: MCP activation is resolved by live project reads through a fresh official App Server client using existing OAuth. MCP0.14.0 cannot accept migration version IDs. Supported CLI exact-version push needs the existing private dev DB password as PGPASSWORD; absent in process/user environment and expected repository env files. No PAT or general access grant is requested.
- MA-05: roles do not exist yet; owner password creation and actual role-specific pooler authentication remain pending after push. Synthetic tests and OAuth are not connection receipts.
- MA-06: Google remains disabled; no usable private Google client is available in this session. Email disable is complete. Provider enablement and post-baseline domain-autojoin check remain.
- T13 production-baseline and PR4 merge approvals remain separately OPEN. General project access and M00 approval do not clear them.

## Manual actions needed from the owner

| #            | Exact action                                                                                                                                                                                                                                                                                                         | Why / current state                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MA-03        | No new project/access action. Dev/prod identities and Git links verified; Everyone Pro/Frankfurt; dev PostgreSQL17.11, organization spend cap enabled.                                                                                                                                                               | Resolved identity; prod baseline approval remains separate.                                                                                                                                       |
| MA-04        | Privately configure the existing emr-dev DB password as PGPASSWORD in the Codex environment, then report only readiness. Alternatively run the [documented CLI dry-run/push](evidence/hosted-acceptance-20261017.md) privately and share its non-secret receipt. No password in chat, argv or Git.                   | OAuth is working. CLI preserves all seven existing versions without PAT/link; actual dev pooler aws-1-eu-central-1.pooler.supabase.com:5432, user postgres.zmotjsbzhzjvpelxvxlf. No reset needed. |
| MA-05        | After roles exist: dev Supabase > SQL editor > set strong passwords for n8n_writer and api_agent following docs/MANUAL_ACTIONS.md. Privately set N8N_WRITER_URL with session5432 and API_AGENT_URL with transaction6543 at the observed host, database postgres, role.dev-ref user and TLS. Never paste credentials. | Owner controls password creation/rotation. Run existing rollback-only pooler checks afterward; prod credentials only after T13 approval.                                                          |
| MA-06        | Google Cloud Console > APIs & Services > Credentials > use/create a Web OAuth client with callback https://zmotjsbzhzjvpelxvxlf.supabase.co/auth/v1/callback. Dev Supabase > Authentication > Sign In / Providers > Google > privately configure valid client values and enable; report readiness only.              | Google disabled; existing Google Cloud client state unknown. Email already disabled and rechecked. Full login M09.                                                                                |
| T13 approval | After dev acceptance, review the [exact production packet](evidence/hosted-acceptance-20261017.md): target hkiafqrcxaafdbcvjlzv, seven versions/hashes, baseline seeds, queues, cron, public bucket, exclusions, recovery and verification.                                                                          | OPEN; not requested before dev is ready.                                                                                                                                                          |
| PR4 approval | Separate explicit M01 merge decision after acceptance/checks. Keep PR4 draft.                                                                                                                                                                                                                                        | OPEN; no merge or production promotion.                                                                                                                                                           |

## Decisions & deviations

- Resume transport: reuse verified dev OAuth for MCP reads/advisors. Use CLI2.121.0 explicit passwordless dev database URL plus private PGPASSWORD for exact-version migration push; MCP apply has no version argument. No auth/scope change, fabricated history, CLI link, secret key or new PAT. [Source review and execution plan](evidence/hosted-acceptance-20261017.md).
- Both Git integrations verified with automatic branching and production deployment OFF; settings preserved. Dev Email provider disabled under explicit resume authorization; global Google account signup remains ON, anonymous/manual linking OFF. app API exposure and domain autojoin need post-baseline verification.

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

- 2026-10-17 · Owner selected private PGPASSWORD setup; latest presence check still absent (intent recorded, no readiness inferred). Five-file evidence follow-up reviewed with no blockers; all seven SHA-256 seals unchanged, JSON valid, formatting/diff checks pass, indexed638-file secret scan zero findings. No application/SQL change or hosted migration. Await private credential readiness, then resume the supported dev workflow.

- 2026-10-17 · Resumed from unchanged clean source8a65025 and draft PR4; CI39057325483 all five jobs/Vercel verified. Existing OAuth proved live through official App Server direct MCP calls, no model turn/login/token extraction. Dev17.11 has zero baseline history/objects; pre-migration security0/performance1 INFO. Both Git auto-deploy/branching OFF. Dev Email disable saved/reloaded; Google disabled; real pooler hosts/API exposure/lagged usage/spend cap recorded. Exact-version CLI path reviewed; private dev password absent (MA-04), role credentials/Google pending (MA-05/06). No migration/fixtures/prod/M02/local reset. See fresh hosted evidence; prior receipts preserved.

<!-- Newest first. One line per meaningful step: date · what · files · result. -->

- 2026-10-17 · Published foundation504b54a and CI/scripts/evidence041d971 on draft PR#4. CI39057026434 passed quality,unit,build,e2e,db-tests:242 pgTAP assertions, REST/Auth, concurrency and local advisors. Browser suite4passed; Vercel check green. Peer review cleared final scanner fixes;18 script tests pass, indexed scan635zero. Evidence-only final update follows. Hosted work is blocked solely at tool activation before any database write; MA-05/06 and T13/merge gates remain. M02 not started.
- 2026-10-17 · Owner created emr-dev zmotjsbzhzjvpelxvxlf and emr-prod hkiafqrcxaafdbcvjlzv and granted access to both. Browser verified Pro/Frankfurt/healthy/GitHub links, no migrations, and Google disabled on dev. Added requested dev-scoped MCP; OAuth success and configuration enabled/OAuth readback. Active conversation still reports unknown server; no hosted SQL. See mcp-setup.json and hosted-preflight.json.
- 2026-10-17 · All seven migrations replayed from zero after fixes;242 assertions in10 pgTAP files pass. Local advisors zero warnings/errors (74INFO justified); REST/Auth probes and four real two-session concurrency scenarios pass with owned-fixture cleanup. Hardened runner also passes12 rollback-only cleanup rejection cases and bounded hung-child teardown. Unit39, pooler/CI script8 plus scanner10, strict typecheck, lint and Next build pass. Types regenerated after final replay; independent reviews retained. GitHub CI and staged secret review next.
- 2026-10-17 · First start on56322 failed: unrelated Job Radar Docker binding occupied it, no SQL applied. Checked Docker/host/reserved ranges and selected60321/60322. Restarted only verified Market Radar to disable email signup; preserved28 unrelated containers, zero missing. Config migrations/seed restored enabled before successful resets.
- 2026-10-17 · CLI2.121.0 pinned with install hooks blocked; init and seven filenames generated through CLI. Supported Docker Desktop start restored engine29.6.1. Initial preflight proposed56321/56322 (later found occupied; resolved above). Optional services disabled; startup-only migrations/seed disabled until SQL ready, then restored. See evidence/environment-preflight.md.
- 2026-10-17 · M01 authorized. Startup order completed; M00 remains Done on main d06dcd9. Created m01-supabase-foundation from a clean tree. Checked Docker (installed, daemon unavailable); scoped Supabase env token/refs/passwords absent, no app real env files or Supabase MCP tools. Public plugin discovery found an unconnected Supabase integration. Pinned CLI setup and local schema/security/test audit in progress. No hosted write, production baseline approval, paid account or credential disclosure.
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone

Not ready: M01 hosted acceptance and both approval gates remain open. Continue
from Next step above; reuse the working dev OAuth, preserve the seven hashes and
existing local/CI evidence. Do not begin M02.
