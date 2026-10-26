# M04 — Collectors I: Vimeo + Instagram (posts & reels) · PROGRESS

## Status
**In progress — first collector implementation slice; native/live acceptance pending.**

| Field | Value |
|---|---|
| Started | 2026-10-26 |
| Last updated | 2026-10-26 |
| Finished | — |
| Branch / PR | `m04-collectors-vimeo-instagram` / [draft PR #13](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/13) |
| Worktree | `D:\Everyone\everyone Market Research\everyone-market-radar-m04` |
| Base | M03 merge `4f6ba6adf1ae4f9e385dd98681b2174a4e3bf5f4` |
| Current task | T3/T4/T5: reviewed resolver, normalizers and bounded official Vimeo collector lifecycle; T6 Instagram preparation |
| Next step | Wire the official Vimeo slice into the existing restricted gateway and native HTTP/shared workflows with fixed owned-run operations. Then prepare ONE complete M04 dev fixture/live estimate before any provider collection. |

The owner started M04 on 26 October. M03 is complete: PR #8 is merged and post-merge CI40236388598 was read back as passing all five jobs. This does not reopen M03, its retained execution31145/C999 decisions, counters, credentials, migrations or disabled cleanup consumer. The old root board and M03 records are preserved under their existing enforced write restriction; this permitted current-milestone record supplies M04's current state. The original workspace's uncommitted work is untouched; development is isolated on the merged base above.

## Task checklist

- [ ] T1 — Real dev fixtures: pending a complete new M04 estimate/approval. Current fixtures are explicitly synthetic.
- [ ] T2 — Dev account set: no account statuses or due dates have been changed.
- [ ] T3 — RPC migration: dev-only Vimeo resolver authored and locally qualified; secondary-pass ownership and reporting remain pending. No hosted migration applied.
- [ ] T4 — Normalizers: Vimeo API, goat255, dltik and Instagram adapters plus synthetic contract tests implemented; real provider captures and field coverage pending.
- [ ] T5 — WF-10: bounded official API collector and fixed-port run lifecycle implemented/tested locally; native workflow/gateway wiring and five-account live proofs pending. Paid fallbacks are proposals only.
- [ ] T6 — WF-11: pure posts/reels normalizer, matching, batching and backfill planning implemented; asynchronous registration/settlement and native wiring pending.
- [ ] T7 — WF-00 wiring: pending. Existing inactive definitions and schedules unchanged.
- [ ] T8 — Backfill estimate / MA-14: pending representative source observations; no M04 spending authority inferred from M03.
- [ ] T9 — Production copies/pilot: separate approval; unstarted.
- [ ] T10 — Daily overlap measurement: separate recurring-activity decision; unstarted.
- [ ] T11 — Exports/docs/hand-off: current code/contracts documented below; no hosted workflow changed or newly exported.

## Acceptance criteria

All milestone criteria remain open. Local proofs below are not hosted acceptance.

| Criterion | Actual evidence and remaining gate |
|---|---|
| AC1 Contract | Focused synthetic normalization/lifecycle tests pass; captured real-source fixtures and full changed-head CI remain required. |
| AC2 Dev backfill | Unstarted: no five-account selection or live backfill. Showcase ownership and reels exhaustion limitations must remain explicit. |
| AC3 Idempotency | Local lifecycle honors database insert/duplicate counts; real collector second-run/database/queue proof pending. Existing M01/M03 database evidence is preserved. |
| AC4 Item types | Synthetic post/carousel/reel/video cases pass; representative live types and pinned-post proof pending. |
| AC5 Watermarks/metrics | Official Vimeo deliberately traverses the 30-day metrics horizon, including known IDs. Native/database proof pending. Paid-source 30-day refresh belongs to the existing WF-40/M06 path; daily Instagram planning does not claim it. |
| AC6 Production pilot | Unstarted; separate MA-14 target/migration/backfill approval. |
| AC7 Cost | Local Vimeo lifecycle records actual counted API requests at USD0 using the existing cost-entry shape. No live usage or provider-cost reconciliation yet. Unknown fixed subscription fees stay unknown. |
| AC8 Failure | Synthetic HTTP/contract/rate-limit and ambiguous gateway failures covered. Live failure/cooldown proof pending; do not repeat accepted M03 error groups merely to manufacture M04 evidence. |
| AC9 Security | Local input bounds, ownership matching, public-only normalization and resolver privilege tests pass. Strict-TLS native binding and sanitized changed workflow exports remain pending. No credential read, reset or shared credential change in this slice. |

## Implemented slice and evidence

- `n8n/collectors/vimeo.mjs`: official API resolution, users/channels/groups listing, verified owner-scoped showcase cursor, pagination origin/path/page validation, daily3/backfill50 page bounds, rate-limit waits/retries, public-only normalization, explicit incomplete cursor and no paid starts.
- `n8n/collectors/vimeo-run.mjs`: start/claim → resolve if needed → collect → existing prepare-ingest/chunk validation → ingest → exact current eight-argument account report → zero-dollar API-call cost → finish. Fixed typed gateway ports have deterministic request IDs; ambiguous receipts stop for reconciliation, never automatically retry side effects. **The concrete durable gateway adapter is still pending; injected-port tests are not native execution.**
- `n8n/normalizers/{vimeoApi,goat255,dltik,instagramScraper}.js`: normalized items separated from source errors; strict dates/public URLs/owner matching; metadata-only Vimeo payload projection excludes download formats and unrelated fields. Instagram handles posts/carousels/videos/reels, hidden likes, counts, unmatched owners and private/login failures. No login/cookie input is introduced.
- `n8n/collectors/instagram.mjs`: watermark-grouped daily50/backfill10 profile batches, posts/reels plans over the same claimed account set, bounded full-wave escalation. No actor execution or scheduling occurs here.
- `20261026013910_m04_vimeo_account_resolution.sql`: only `ops.set_account_external_id(uuid,text,text)`, granted to `n8n_writer`, denied to PUBLIC/anon/authenticated/api_agent; empty definer search path; running dev Vimeo parent, active owner and live owned claim required. Preserves schedule, leases, watermarks and human fields. No primary-report signature change yet.

Local verification (26 October; synthetic/local environments only):

- Final collector/normalizer/lifecycle Vitest suite: **202/202 across6files**, native0. This includes31 Vimeo,47 Instagram and124 preserved baseline normalizer tests; do not add overlapping earlier runs to this total. All source fixtures in this slice are synthetic.
- Root TypeScript, targeted ESLint and formatting: native0 after review corrections. Existing CI/pooler-harness safety tests: **15/15**, native0; the new resolver SQL file is asserted present and an incomplete11-file report is rejected. These are mocked harness checks, separate from actual PostgreSQL tests.
- Resolver pgTAP: **31/31**, native0, actual rollback-only local PostgreSQL. The added NULL-platform denial first failed against the prior function, then passed with IS DISTINCT FROM. Fixtures use TEST15, not C999. This is local role simulation, not a new hosted restricted-login receipt. Migration SHA256: e2fa1cbf59b2e010b8b76caff6a34c5a752074e1e843071c36463c5a1a9717c1.
- Supabase CLI2.121.0 advisors with the owned temporary resolver installed: **0 warnings/errors**, native0. Four-schema type generation native0. Existing local stack has14 migrations while the preserved hosted/committed M03 baseline has15; only the generated resolver type is integrated. The known local missing `foundation_gateway_provision` overload is preserved, not silently replaced. No full local/hosted type-parity claim.
- After local qualification, owned resolver installation is removed after identity/source checks; exact14 local history and tracked data counts are unchanged. No seed, reset, hosted migration replay or collected-row deletion.
- Draft PR #13 carries the first slice; its required changed-head CI and Vercel checks are read directly on GitHub. Local results above are separate from those hosted checks.
- Existing required CI remains unchanged in strength: the seeded SQL phase now expects12 suites and includes the resolver tests. Historical M03/GW-01 suites remain mandatory in their existing phases.

## Integration work still required (not owner setup tasks)

1. The existing foundation gateway is deliberately bound to M03 branch/window/C999 contracts. Reuse its strict TLS, machine authentication and owned RPC controls while adding narrowly typed M04 operations. Do not loosen it into an arbitrary SQL/RPC proxy or reopen M03 windows. Vimeo's Node URL helper is not yet proven compatible with Cloud Code; use supported native HTTP composition or an explicitly tested compatible runtime.
2. The current async processor is a one-page website smoke processor and registration allows one actor per parent. M04 needs bounded multi-account registration/settlement plus a registration-complete barrier; callbacks must not finish a parent while more chunks can still register.
3. Secondary reels handling must cover selection, registration, ingestion and reporting ownership, not merely add `p_secondary` to report. Ingestion currently requires the primary live account lease and moves the shared watermark; the per-account result key is unique per parent/account. Preserve those data-integrity checks until the complete secondary path is tested.
4. Keep claims held until asynchronous fallback settlement. The current official-API-only slice reports an API failure and does not launch a fallback; it must not be reused unchanged to release a claim before a future fallback completes.

## Manual actions needed from the owner

**None for the current local implementation.** Reuse the existing persistent dev entries and saved native credentials. No readiness or new credential delivery is inferred from this kickoff.

| ID / decision | Actual status | Exact next gate |
|---|---|---|
| MA-07 Vimeo public token | Existing n8n Header Auth configuration from M03 retained; no new credential requested | Verify that binding in the future bounded dev check; do not expose/extract token. |
| MA-10 Apify | Existing native `Apify API` credential and Scale-plan decision retained | Reuse actual ID/type; collect current price-book/build metadata for the single complete live estimate. |
| M04 dev fixture/live allowance | Not requested; no live collection begun | Present selected accounts, provider/results usage, retry policy, recovery/shutdown calls and USD ceiling together before admission. M03's closed two-actor/USD2 allowance is not reused. |
| MA-14 production pilot | Unstarted | Separate exact target/migration/backfill/budget packet after representative dev results. |
| MA-11 production runtime | Unchanged, untested in M04 | Only inspect when production work has its separate approval; no prod credential enters the default dev profile. |
| Recurring schedules / notifications / merge | Unstarted | Separate owner decisions; M04 PR remains draft. |

## Decisions & source deviations

- Owner's functional testing approach carries into M04: focused tests, representative native/provider/database evidence; no replacement acceptance framework. Two failed repairs of the same testing mechanism require a simpler supported method or an exact blocker.
- Vimeo's 30-day metrics requirement takes precedence over an early stop on the watermark ID. Known IDs are deliberately normalized for the duplicate-upsert metrics path; cap-limited traversal remains explicitly incomplete.
- Showcase API listing requires a verified owner-scoped `/users/{owner}/albums/{showcase}/videos` path. The old global `/albums/{id}` example is not treated as verified.
- Current Instagram actor schema accepts `resultsType: reels`, but its documented date/pinned-post guarantees are specifically for posts. Reels are filtered locally; `backfill_done` remains false with `reels_backfill_exhaustion_unverified` until real evidence establishes coverage. No fabricated complete backfill.
- Vimeo raw payload is a metadata projection, not the old untouched-object promise. No download URLs/files are retained in that projection. Instagram payload is still source metadata, never an authorization input or a fetch instruction; downstream media retrieval must retain public-DNS/redirect controls.
- Sources checked26October: Vimeo common formats/rate limiting/reference, n8n native HTTP docs, the three approved actor pages, and Supabase function/security guidance. Details in `docs/SCRAPING_SOURCES.md`.

## Usage and preservation

- **M04 runtime provider requests:0; actor starts:0; new collected items:0; hosted database/workflow writes:0.** Local Docker qualification and ordinary GitHub/preview CI are separate infrastructure activity; infrastructure billing is not measured here.
- Frozen M03 ledger remains2078 Management /2000 Control /4078 combined /Vercel358, one actor. No reset or transfer of that allowance.
- All15 successful dev migrations, seeded competitors/accounts/exclusions/logos, existing shared workflows and persistent encrypted credentials are preserved. The new resolver migration is not yet hosted.
- Production, collection schedules, external notifications, unrelated R2 work, M04 merge and M05 remain untouched.

## Session log

- 2026-10-26 · Focused cross-review reproduced and fixed foreign Vimeo resume cursors, invalid24:00/offset dates, Instagram private/credential-bearing thumbnail URLs and nullable resolver platform authorization. Actual final202 Vitest /31 pgTAP /15 harness tests pass; lint/types/format pass. Independent reviewers confirmed native/gateway/async settlement remains incomplete.
- 2026-10-26 · Owner kickoff verified against merged PR #8 and successful main CI40236388598; isolated M04 worktree created, preserving original dirty work and enforced record restrictions.
- 2026-10-26 · Implemented official Vimeo pagination/lifecycle/resolver and Instagram normalizer/batching with synthetic cases; focused tests and local database qualification recorded above. Native async/secondary gaps remain explicit.
- 2026-10-17 · Milestone file created (handoff pack).

## Hand-off to next milestone

Not ready. M04 remains open; no next milestone started.
