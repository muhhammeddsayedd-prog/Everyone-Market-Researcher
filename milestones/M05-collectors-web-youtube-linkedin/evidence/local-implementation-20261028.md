# M05 local collector integration — 28 October 2026

This is local implementation evidence. No M05 source capture, hosted migration,
secret binding, native save/publication, actor start, schedule, notification or
production operation has been performed. Historical M04 acceptance is retained
at `d7daebe75341904fa62d04e911b8ea810992a2bb`, CI40617832325 all five jobs green,
Vercel green. M04 remains draft/unmerged; coverage and rollout remain open.

## Connected paths

| Path | Local implementation | Actual missing proof |
| --- | --- | --- |
| WF-21 | Firecrawl v2 map objects → exact origin/path filtering → discovered/new/failed URL diff → ≤200 URL async crawler jobs → project normalization → atomic ingest/page-to-item lookup → one exact adaptive thin retry → measured cost → closed-registration/account barrier | Real map/crawler/JS output, actual Firecrawl credential metadata and billing, Cloud publication/delivery. Default exports fail before I/O until Firecrawl is bound. |
| WF-13 | Saved channel pair / official resolver → atomic Pacific-day quota reservation before each call → uploads pages/opaque bound cursor → videos metadata → normalization → byte-bounded ingestion → cost/report/actual SQL terminal summary | Real native/channel observations, source EOF/2024 coverage, actual Shorts identity. Paid fallback is disabled/unreachable. |
| WF-18 | Exact company/date buckets → finite public company-post actors → all registrations closed → verified provider/build/INPUT/dataset callback → owner-matched ingestion → measured usage/cost once → account/run finalization | Real company repost/video/thumbnail shape; bounded latest results do not establish 2024 history. Unknown ownership never ingests. |
| WF-18b | Singleton public Short company query → verified callback → four-field projection → immutable same-capture-date snapshot → measured cost and claim settlement | Actual Short response, current-company identity and complete-source pagination/roster proof. Partial observations cannot establish hires, departures or full headcount. |

WF-00's M05 orchestrator invokes only the four authored child definitions and
reports **dispatch**, not callback completion. The maintained WF-19 extension
uses the existing authenticated gateway and native HTTP nodes for an owned thin
retry. The M05 log-only error handler accepts fixed workflow IDs and safe error
classifications; it cannot release claims, retry actors or send notifications.
All local definitions are inactive and omit recurring triggers. Historical
saved Cloud exports under `n8n/workflows/` remain untouched.

## Restricted database and recovery

The single pending local migration is
`20261028020745_m05_web_youtube_linkedin.sql`, created with pinned Supabase CLI
2.121.0. It does not replay/change the eighteen applied M04/prior migrations.
Only `ops.m05_execute` exposes fixed M05 operations through the existing
restricted writer transport; no arbitrary SQL, table DML or administrator runtime
is introduced. New private job/quota tables have RLS, no writer/agent table grants,
empty-path definers and explicit PUBLIC/anon/authenticated/agent revocations.

Existing collector request/launch/cost ledgers are reused. A replayed launch
never returns a fresh paid POST permit. Unacknowledged starts remain owned and
block closure. Multiple batches and the exact thin retry hold account claims
until registration is closed and every job is terminal. Website item links are
looked up by account/platform/external identity, never by result-array position.
The gateway-injected website URL cap is cumulative per account/approval and is
not replenished by another run or a changed map.

Employee fields are exactly `public_id`, `name`, `title`, `location`. Coverage
metadata is scalar/type-bounded; caller-supplied `complete:true` is rejected until
a supported source-attestation contract exists. Partial captures leave both
change lists empty. Existing people are inserted with `ON CONFLICT DO NOTHING`,
preserving human names, roles, status and merges. Capture date is bound to the
owned run's Cairo date, so a legitimate callback crossing midnight still settles.
A changed same-date observation preserves the first snapshot, fails the account
and records the second actor's measured cost exactly once.

Provider reads use the existing bounded strict-TLS/public-DNS transport. Foreign
owner/build or changed INPUT stops before ingestion. A verified terminal actor
with over-output settles failed with no content and its actual measured usage;
it is not silently retried or left with fabricated USD0. Error messages/exports
never include raw provider profiles, passwords or credential-bearing errors.

## Actual local verification

- Actual local PostgreSQL test applies the pending objects inside a rollback-only
  transaction and exercises gateway request decoding, exact dev claims, YouTube
  resolution/quota, ingestion replay/conflict, website ownership/linking, the
  primary/adaptive registration barrier, employee privacy/human preservation,
  cross-midnight capture, same-date conflict/cost and terminal pass settlement.
  Baseline competitor/item/run counts match before/after rollback.
- Fifteen pgTAP assertions pass on a separately owned local schema database:
  grants, RLS, empty paths, invalid operations, prod/mismatched identities and
  unknown/removed website-page denials. This is not hosted login evidence.
- Native Supabase type generation was run against that owned local schema after
  the new migration. Security and performance advisors each returned zero
  warnings/errors. The existing local fixture database was not reset/reseeded.
  Early one-off type-output checks failed locally; the supported native CLI output
  was then used directly. No failed check was claimed as success.
- Focused source/native/callback test totals and final changed-head CI references
  are recorded in the current PROGRESS, separately from these observations.
  Required CI now includes the M05 SQL test without skips and full generated-type
  parity after the normal complete migration chain. No existing required check is
  disabled. The extra PR base trigger supports the owner-approved stacked PR.

## Remaining boundaries

All original M05 acceptance criteria remain open for their missing actual source,
coverage, native, cost or rollout observations. Local fixtures are explicitly
synthetic/official-example projections, not new provider captures. The single
[representative dev packet](live-dev-packet-20261028.md) estimates setup, selected
captures, conditional repeats/recovery and shutdown; it is not execution authority.
Full pilot history, production, recurring operation, notifications and merge
remain separate. No M04 spending balance is transferred to M05.

## Latest delivery qualification and enforced edit boundary

Actual final affected commands passed: 61 source/estimator Vitest tests;
47 native/YouTube Node tests; 66 gateway/callback/database Vitest tests including
the actual rollback-only SQL scenario. These replace the earlier smaller command
sets as the latest local results; they are not hosted acceptance. The fifteen
pgTAP assertions and generated local schema/advisor results remain separate.

Automatic approval review rejected one local Node edit command before execution
with the generic reason **“blocked by policy.”** It targeted three public files:

1. `n8n/collectors/build-native-m05-callback.mjs` — the proposed additional
   finite/positive/max10 validation of the returned retry charge-cap descriptor.
2. This milestone's `evidence/live-dev-packet-20261028.md` — follow-up API-cap
   wording and final qualification/preflight wording.
3. This milestone's `PROGRESS.md` — the corresponding stale PPU-cap sentence.

Those replacements are **unperformed**. No alternate shell, helper, filename or
agent was used to recreate the rejected edit. The packet is a preserved draft,
not ready for owner live approval or execution. Its older PPU-cap wording and the
corresponding PROGRESS risk sentence remain stale pending the supported
permission/owner-edit path. The latest source review is the current official
[Run Actor API](https://docs.apify.com/api/v2/actors-runs-post); do not infer live
charge-cap acknowledgment from documentation or local tests. The already
implemented website/callback paths request/read back the current API option and
preserve known actor IDs before a missing acknowledgment stops further starts.

The concrete public corrections for owner review are: require a numeric finite
`descriptor.maxTotalChargeUsd` in `(0,10]` in the retry permit predicate; align the
two stale documentation passages to the current all-pricing-model API contract,
USD0.40/run, twelve reserved starts =USD4.80 inside Apify USD4.95 plus Firecrawl
USD0.05, with input/output limits distinct from PPR billing limits; and make exact
UUID/build/billing readbacks an explicitly bounded preflight of that same proposed
packet. These do not authorize a start, new allowance, hosted mutation or merge.
Use the three exact files above in the M05 worktree for a supported owner edit or
permission review. Read back the actual diff and rerun affected checks afterward.

No M05 dev credential was read, M05 migration applied, provider capture started,
workflow activated or production changed. Persistent encrypted originals remain.

### CI qualification repair

The first pushed head `ff9741d` opened stacked draft PR14; its protected Vercel
Preview, quality/build/e2e checks passed. CI40628554552's database job stopped in
the existing script-safety fixture before database startup: its hard-coded
fourteen-suite count and mocked phases did not yet include M05. The normal
runner/fixture now require fifteen suites, the additional unskipped M05 SQL
report and generated-type parity; all seventeen affected safety tests pass,
including failed/skipped/mismatched output rejection. No required check was
removed or weakened. The complete changed-head run remains a separate result.

Additional meaningful local integration executes the serialized native YouTube
functions through the actual typed HTTP handler and PostgreSQL operations, with
documented synthetic API responses. It proves quota/cost-once, known-ID metrics
refresh, zero duplicate item and actual terminal status, inside the same complete
rollback. Official Google metadata supplies the uploads playlist as an opaque
ID; the undocumented prefix/shared-suffix constraint was removed and separately
regressed. This does not constitute a real Google or native Cloud observation.

Pending migration SHA256: `127daace10ea35aabc29b90970e55188fa801bf4475edbc17ee2e1b199c5f996`.

### Native CI integration fixes

CI40629547212 identified two further concrete integration boundaries. Native
Node could not import the new extensionless TypeScript module from the shared
contract; the import now explicitly ends in `.ts`, supported by the existing
`noEmit` configuration. All nineteen affected M04 Vercel-task tests and the full
workspace/root TypeScript check pass. The schema assertion now expects the two
new private M05 tables:27 ops tables. Its plan and all RLS, grants, foreign-key,
invoker-view and definer checks remain unchanged.

All fifteen regular SQL suites were then executed against actual local
PostgreSQL, applying the four pending local migrations inside each rollback-only
transaction. All605 assertions passed. Existing competitor/item/run counts were
equal before/after; no hosted migration or local baseline reset occurred. Normal
changed-head CI still qualifies the entire fresh migration chain separately.

An additional Windows-only run of historical M03 protocol fixtures did not pass:
their synthetic packet has45 public keys while the closed consumer requires74,
with29 later technical8–16 evidence pins missing. The failure is at the public
keyset guard before per-file hashes, private access or native CLI work;
regenerated M05 database types are not its cause. The closed M03 consumer was not
repaired, resealed or reopened. This advisory is separate from current M05
gateway/native/rollback-SQL results and does not claim Windows-wide acceptance.

The enforced three-file edit boundary above remains unchanged. This permitted
record is the current handoff while the corresponding M05 progress/packet
corrections are unperformed. The live packet remains unready for approval.

CI40630684945 passed quality, unit, build, e2e and Vercel. Its database job
passed605 regular pgTAP assertions,102 GW-01 assertions and the foundation,
M04 and M05 actual SQL/app contracts before rejecting generated-type parity.
The local type-generation schema omitted the older fifteenth migration and
therefore lost the two-argument `foundation_gateway_provision` overload. The
accepted M04 generated overload is now preserved alongside the new native M05
output. An independent AST comparison confirms no other legacy member loss or
drift, apart from the intended employee `coverage` field. Shared typecheck and
formatting pass. The full-chain native CI comparison remains required; this
correction does not claim that the earlier local clone covered all migrations.

## Standing-spending continuation and current handoff —28October2026

The owner's later instruction is recorded once in
[the binding decision](../../../docs/DECISIONS.md#standing-development-spending-and-essential-acceptance--28-october-2026).
It authorizes necessary development costs and the existing selected M05 dev
validation/setup/migration/temporary bypass after corrections, tests, required CI
and preflight. No financial or actor-count approval is missing. The older
USD0.40/USD4.95/USD5/twelve-start proposal and the earlier manual-edit instruction
are superseded as owner gates; do not run that obsolete instruction verbatim.
Finite operational configuration still applies to each admitted execution.

Permitted code changes now separate M05's server-selected finite settings from
the unchanged M04 policy. Monetary values must be numeric, positive, finite and
exactly representable in the existing six-decimal storage; start allocations use
the positive PostgreSQL integer capacity. These are interface representations,
not new owner spending limits. A fresh matching SQL permit alone receives the
current descriptor. Replays cannot acquire a subsequent descriptor; changed
settings cannot overwrite an admitted intent or its allocation. Rows, counters
and costs remain preserved. Subsequent operational settings may be selected
under standing authorization after existing work is reconciled.

The pending migration `20261028020745` now rejects numeric coercion, NaN/Infinity
strings, nulls, overflow, nonintegral counts and silent precision rounding. Its
M05 start capacity is extended without changing the M04 RPC's original40-start
validation. Actual local rollback integration passes1/1 and pgTAP31/31, including
invalid allocations, exact representation boundaries and allocation identity
conflicts; M04 still rejects41. Pending SHA256 is now
`f3ff025065106733f7c76aec963e465a045270876c642db69e131df72f6d865e`.
It has **not** been applied to hosted development.

Primary website/LinkedIn dispatch accepts the authentic finite server charge
option rather than the former owner ceiling. LinkedIn now registers a valid
returned actor ID before stopping on missing/mismatched charge acknowledgment;
neither a later start nor registration closure follows that stop. Numeric IDs
are not coerced into confirmed starts. Native descriptors retain exact current
output/runtime agreement. The callback uses the recorded admitted amount even
when a subsequent configured amount differs: an actual charge-option violation
is costed once, receives no ingestion/retry and remains review-required on saved
replay. This is a provider-contract stop, not another financial approval gate.

The edited native collector blueprints preserve their original synthetic
selections, audience and provenance, and remain inactive/local-only. WF-21 stays
inert until genuine Firecrawl metadata is established. WF-19-M05 and its denied
builder are unchanged; these other changes do **not** implement or substitute
for its still-missing retry charge-option guard.

Fresh qualification used a separately owned schema-only local database: the
original14-version schema plus **all five** pending versions, including the older
fifteenth migration, for19 total. Native type generation exactly matched the
checked-in types. Both native CLI advisors returned0 with `--fail-on warn`.
Original baseline counts/history were equal before/after, and the owned schema
database was removed. The first load hit a pg_dump metacommand rejected by a Node
SQL client; the supported native psql restore then succeeded. No baseline reset,
hosted migration or M03 supervisor operation occurred.

### Exact remaining enforced boundary

Official [Auto-review documentation](https://learn.chatgpt.com/docs/sandboxing/auto-review)
describes `/approve` as a one-exact-action retry in the supported TUI. The owner
actually checked this conversation and reported **Command unavailable**. The
current execution surface has `approval_policy=never`, forbids escalation
arguments and exposes no tool for submitting a revised one-action review. No
permission setting, policy file, shell/tool/agent route or credential store was
changed to bypass that boundary. The old denied payload is also obsolete under
the new financial policy and must not be executed merely to obtain a retry.

The precise remaining action is a revised public edit of the same three files:
validate the native retry charge option as numeric/finite/positive and consistent
with the authentic server configuration; update the existing packet's provider
billing/estimates/authorization; and bring the existing M05 progress pointer
current. The automatic review's stated reason remains only **blocked by policy**.
Those edits and the resulting WF-19-M05 regeneration are unperformed. The current
client/host must expose a supported narrow review of that revised action before
it can be executed here. This is the live-validation blocker; no new budget,
actor-count, credential handoff or general development approval is requested.

One independent, non-secret n8n `list_credentials` attempt returned connector
error`-32603`. It establishes no missing/revoked credential or browser logout;
no replacement/login loop followed. Conservatively retain one M05 Management
attempt,0 Control/Vercel/native actions and0 actor starts. No source collection
charge was incurred by this work; Git/CI/Preview infrastructure USD is separately
unknown. M04's300/2609/2909/V111/native18/24actors/USD1.0695 record is untouched.
No M05 runtime secret was read/decrypted, no workflow published/activated, and no
temporary bypass or hosted configuration was created. M05 remains in progress;
the essential-development map is in the existing milestone, with live evidence
pending and production/recurring/merge obligations retained. Required changed-head
CI and the ordinary protected Preview qualify this permitted code slice only.

Actual affected checks for this continuation pass:47 source/lifecycle Vitest
tests,32 serialized native-workflow Node tests,33 gateway/callback Vitest tests,
one actual PostgreSQL integration and31 pgTAP assertions. Full workspace/root
TypeScript, lint, formatting and the1786-file secret scan also pass. Independent
targeted review covered the server/SQL allocation contract, native registration
and callback replay, and the development-acceptance map. These are distinct local
command results, not native Cloud/provider acceptance. The next push retains
normal required CI on the actual changed head; no check is disabled and no
CI-announcement-only commit is needed.
