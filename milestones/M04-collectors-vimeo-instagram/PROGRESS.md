# M04 — Collectors I: Vimeo + Instagram (posts & reels) · PROGRESS

## Status
**In progress — connected collector integration qualified locally; native/live acceptance pending.**

| Field | Value |
|---|---|
| Started | 2026-10-26 |
| Last updated | 2026-10-27 |
| Finished | — |
| Branch / PR | `m04-collectors-vimeo-instagram` / [draft PR #13](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher/pull/13) |
| Worktree | `D:\Everyone\everyone Market Research\everyone-market-radar-m04` |
| Base | M03 merge `4f6ba6adf1ae4f9e385dd98681b2174a4e3bf5f4` |
| Current task | T3/T5/T6: concrete restricted gateway, generated WF-10/WF-11/WF-19 and joint multi-batch posts/reels settlement |
| Next step | Finish normal changed-head PR checks/review, then obtain the single [representative live packet](evidence/live-test-estimate-20261027.md) decision before any hosted collector setup or collection. No credential setup is requested. |

The owner started M04 on 26 October. M03 is complete: PR #8 is merged and post-merge CI40236388598 was read back as passing all five jobs. This does not reopen M03, its retained execution31145/C999 decisions, counters, credentials, migrations or disabled cleanup consumer. The old root board and M03 records are preserved under their existing enforced write restriction; this permitted current-milestone record supplies M04's current state. The original workspace's uncommitted work is untouched; development is isolated on the merged base above.

## Task checklist

- [ ] T1 — Real dev fixtures: pending a complete new M04 estimate/approval. Current fixtures are explicitly synthetic.
- [ ] T2 — Dev account set: no account statuses or due dates have been changed.
- [ ] T3 — RPC migrations: resolver and fixed M04 product contract locally qualified, including joint claims/registration barrier/paged settlement. Both M04 migrations remain unapplied to hosted dev.
- [ ] T4 — Normalizers: Vimeo API, goat255, dltik and Instagram adapters plus synthetic contract tests implemented; real provider captures and field coverage pending.
- [ ] T5 — WF-10: generated native HTTP/code workflow connected through the strict-TLS writer adapter to normalization, ingestion, reporting, cost and completion. Reviewed async fallback implementation also holds its claim until callback; native/provider/five-account proofs remain pending.
- [ ] T6 — WF-11: generated posts/reels batches, async launch/registration, WF-19 processing and final settlement connected locally. Native/provider coverage and complete history remain pending.
- [ ] T7 — WF-00 wiring: pending. Existing inactive definitions and schedules unchanged.
- [ ] T8 — Backfill estimate / MA-14: pending representative source observations; no M04 spending authority inferred from M03.
- [ ] T9 — Production copies/pilot: separate approval; unstarted.
- [ ] T10 — Daily overlap measurement: separate recurring-activity decision; unstarted.
- [ ] T11 — Exports/docs/hand-off: inactive generated **local blueprints** and integration documented below; preserved hosted exports are unchanged. Fresh sanitized Cloud exports await the approved representative check.

## Acceptance criteria

All milestone criteria remain open. Local proofs below are not hosted acceptance.

| Criterion | Actual evidence and remaining gate |
|---|---|
| AC1 Contract | Synthetic normalization/lifecycle, generated native code and actual local PostgreSQL integration pass. Captured real-source fixtures and native acceptance remain required; normal changed-head PR CI remains mandatory. |
| AC2 Dev backfill | Unstarted: no five-account selection or live backfill. Showcase ownership and reels exhaustion limitations must remain explicit. |
| AC3 Idempotency | Actual local SQL plus generated workflow code proves content/callback replay, one item across posts/reels, stable cost and registration ownership. Real collector second-run/queue proof remains pending. Existing M01/M03 evidence is preserved. |
| AC4 Item types | Synthetic post/carousel/reel/video cases pass; representative live types and pinned-post proof pending. |
| AC5 Watermarks/metrics | Official Vimeo deliberately traverses the 30-day metrics horizon, including known IDs. Native/database proof pending. Paid-source 30-day refresh belongs to the existing WF-40/M06 path; daily Instagram planning does not claim it. |
| AC6 Production pilot | Unstarted; separate MA-14 target/migration/backfill approval. |
| AC7 Cost | Local connected path records counted Vimeo requests at USD0 and exactly USD0.0038 across two synthetic Instagram runs, without replay duplication. The private consumer derives cost from two stable authenticated provider snapshots, not callback fields; real usage reconciliation remains pending. Unknown fixed fees stay unknown. |
| AC8 Failure | Synthetic HTTP/contract/rate-limit and ambiguous gateway failures covered. Live failure/cooldown proof pending; do not repeat accepted M03 error groups merely to manufacture M04 evidence. |
| AC9 Security | Actual local role simulation/grant/RLS tests and focused gateway/public-input/TLS-contract tests pass. Native strict-TLS restricted login, live build/owner/default attestation and fresh sanitized exports remain pending. No credential read/reset/shared credential change occurred. |

## Reviewed first slice and historical evidence (26 October)

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

## Integration after reviewed checkpoint `30b175a` (27 October)

- `apps/web/server/n8n-worker/collectors.ts`, `collector-database.ts` and the new internal route implement a fixed, Zod-validated product gateway. It reuses the existing dev session-pooler identity, pinned CA/strict TLS, response/body/deadline controls and narrow writer role. Preview project/branch/commit, machine audience, selected UUID allowlist and server-side live policy fail closed. There is no SQL/schema/host override and no private stage/settle HTTP operation.
- `20261027092832_m04_collector_product_contracts.sql` adds six RLS-protected product-state tables and one writer-only fixed-operation RPC. Start/claim/resolve/ingest/report/cost/finish reuse the existing database contracts. Launch permits and immutable receipts prevent blind paid replays; aggregate approval policy is checked across parents. No M03 function/history is replaced.
- `n8n/collectors/native-runtime.mjs` and `build-native-collectors.mjs` generate inactive WF-10/WF-11 and the WF-19 wrapper in `n8n/collectors/blueprints/`. Official Vimeo follows resolution/list/rate handling → canonical normalization → byte/item-bounded ingestion → account report → zero-dollar API cost → finish. Existing native Vimeo Header Auth and Apify predefined credentials are bound by actual type. Code-node tests run without Node `URL` or `require`. Native HTTP's response streaming byte ceiling is not established; pagination/field/time bounds and ingestion chunk bounds are implemented.
- Instagram claims the exact selected account set once, then registers every planned posts/reels chunk under that parent. A registration-complete barrier and joint pass state prevent early parent completion or release of another pass's claim. Reels ingestion preserves the primary watermark. An ambiguous actor POST stops for reconciliation without retry; registered callbacks may finish before registration closes without releasing claims.
- WF-19 classifies known M04/foundation/unknown IDs through the fixed gateway. The existing foundation nodes remain preserved. The private callback consumer verifies same-owner run `userId`, actor/build IDs, configured options and exact reviewed public INPUT against registry membership; two terminal snapshots at least ten seconds apart supply actual cost. Unknown runs are denied before provider reads. Fixed 500-row/4 MiB pages, independent result bounds and per-page hashes protect ingestion. Replayed completed runs use the saved receipt without provider reads or duplicate cost. Matched old public rows can prove a valid zero-item result; source evidence survives later empty pages. A confirmed private/login source becomes invalid after both passes settle on the first combined failure; generic failure cadence is unchanged. Missing ownership remains a failure.
- `packages/shared/src/n8n-collector-contracts.ts` defines only the required typed operations. The new generated schema members were merged from actual CLI output, preserving the known older local/hosted baseline difference. `scripts/db/run-local-ci.sh` retains every prior database phase, adds the thirteenth seeded SQL suite and requires the new app/SQL integration report. Normal PR jobs remain enabled.

Actual local qualification (no Cloud execution/provider data):

- New SQL: **132/132 pgTAP assertions**, native0. Includes restricted grants/RLS, multi-account registration/barrier, both-pass ownership/watermark preservation, idempotency, paged replay/source evidence, exact cost allocation, actor-specific launch/register limits, immediate settled privacy invalidation and invalid-state denials. Migration SHA256: `19eb07af9446189496cde17d1b9a735b99816c5008c37588d38cddbc41e6a05a`.
- Supabase CLI2.121.0 security/performance advisors: **zero issues**, native0, with the owned temporary M04 objects installed. Four-schema type generation native0; all eight new table/function members match actual generated output. Existing local history14 versus committed/hosted M03 baseline15 remains explicitly separate; no full baseline-parity claim.
- Owned temporary SQL objects and public scratch were removed after source/identity checks. Local history14, seven baseline data counts and TEST16/TEST17 absence were verified. Connected fixtures use rollback-only TEST17, never C999. This is session-authorization role simulation with a public local fixture password, **not** an actual restricted Cloud login or TLS receipt.
- Focused HTTP/driver/callback/reader suite: **48/48** across the final affected tests, native0 (19 callback +14 handler +4 driver +11 reader); generated native graph/code tests: **26/26** native0; preserved canonical normalizer/lifecycle tests: **202/202** native0; CI database-harness regression tests: **16/16** native0. Full workspace/root TypeScript, ESLint and Prettier checks: native0. Counts are separate suites, not repeated-run sums.
- The connected local integration **passes1/1, native0**, executing generated WF-10/WF-11/WF-19 code through the actual HTTP handler and PostgreSQL product contracts with synthetic provider responses. It proves Vimeo finish/one item, Instagram registration remains running, posts retain the shared lease, replay causes no provider reads, reels duplicate creates no extra item, both passes finish with exactly USD0.0038/two cost rows, and unknown classification/process rejection causes no provider reads. The final transaction rolls back and client closes; synthetic usage is not actual provider billing.

Remaining integration/live boundaries: WF-00 must pass a reviewed explicit selected-account UUID set before invoking these native collectors; omitted selection fails before starting a run. WF-10/WF-11 carry the WF-90 ID only as deferred staging metadata: its existing closed M03 gateway is not automatically invoked. A compatible global error-handler binding remains pending; handled API/source errors already report through the collector path. Real saved bindings, Cloud node behavior, actual provider INPUT/build/defaults, fallback collection membership, pinned-post behavior and callback delivery remain unverified. Reels and representative capped backfills stay incomplete; no shortened run proves full history. Only the single live packet can authorize representative setup/collection; it does not authorize all milestone live/pilot work.

## Manual actions needed from the owner

**None for the current local implementation.** Reuse the existing persistent dev entries and saved native credentials. No readiness or new credential delivery is inferred from this kickoff.

| ID / decision | Actual status | Exact next gate |
|---|---|---|
| MA-07 Vimeo public token | Existing n8n Header Auth configuration from M03 retained; no new credential requested | Verify that binding in the future bounded dev check; do not expose/extract token. |
| MA-10 Apify | Existing native `Apify API` credential and Scale-plan decision retained | Reuse actual ID/type; collect current price-book/build metadata for the single complete live estimate. |
| M04 dev fixture/live allowance | One [complete packet](evidence/live-test-estimate-20261027.md) prepared; not yet approved; no live collection begun | Four public accounts, target two/max four sequential Instagram starts, USD1 each/USD4 total; Management160/Control472/Combined632/Vercel64 plus six native actions, including recovery/shutdown and the explicitly scoped temporary sole/default bypass exception. M03 authority is not reused. |
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
- All15 successful dev migrations, seeded competitors/accounts/exclusions/logos, existing hosted shared workflows and persistent encrypted credentials are preserved. Both M04 migrations are pending hosted application.
- Production, collection schedules, external notifications, unrelated R2 work, M04 merge and M05 remain untouched.

## Session log

- 2026-10-27 · Focused cross-review fixed source-owner/options/default checks, legitimate empty-page evidence, actor-specific batch/result limits, exact30,000-row EOF handling and native callback timeout. Final48 HTTP/driver/reader assertions,26 native-code tests and1 actual local SQL/app integration pass. Final nested auth/API-key/client-secret regressions pass with the SQL integration rerun; no guard is removed. Full TypeScript/lint/format pass. Staged error-handler links remain deferred rather than invoking closed M03 windows. PR13 stays draft; normal changed-head CI must pass, with no CI-announcement-only commit.
- 2026-10-27 · Continued the existing worktree after reviewed30b175a without resetting legitimate integration work. Added the concrete fixed gateway, multi-batch/pass SQL state and generated WF-10/WF-11/WF-19 paths; reused existing security and credentials without reading secrets. SQL132/132, advisors/types and cleanup verified locally. Representative live packet prepared; native/provider evidence remains gated.
- 2026-10-26 · Focused cross-review reproduced and fixed foreign Vimeo resume cursors, invalid24:00/offset dates, Instagram private/credential-bearing thumbnail URLs and nullable resolver platform authorization. Actual final202 Vitest /31 pgTAP /15 harness tests pass; lint/types/format pass. Independent reviewers confirmed native/gateway/async settlement remains incomplete.
- 2026-10-26 · Owner kickoff verified against merged PR #8 and successful main CI40236388598; isolated M04 worktree created, preserving original dirty work and enforced record restrictions.
- 2026-10-26 · Implemented official Vimeo pagination/lifecycle/resolver and Instagram normalizer/batching with synthetic cases; focused tests and local database qualification recorded above. Native async/secondary gaps remain explicit.
- 2026-10-17 · Milestone file created (handoff pack).

## Hand-off to next milestone

Not ready. M04 remains open; no next milestone started.
