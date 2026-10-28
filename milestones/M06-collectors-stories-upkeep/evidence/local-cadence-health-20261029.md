# M06 local cadence and health continuation — 29 October 2026

Local implementation after accepted `fd2d270` / CI40778032486 (all five jobs and Vercel green). The owner's request to proceed continues development; the prepared hosted validation remains unexecuted. No hosted migration, secret binding, workflow mutation, capture, upload, schedule, email or production operation occurred.

## Implemented path

- CLI-created `20261028223330_m06_cadence_health.sql` adds `ops.set_stories_cadence(boolean)` and extends `ops.daily_health()`. No table, data backfill, automatic setting change or new accounting/approval system.
- The cadence operation serializes its setting/account update, changes only story cadence to12h/1day and audits actual changes. Null input fails. Exact replay leaves timestamps/audit unchanged. Due dates, claims, statuses, watermarks and human/source fields remain untouched. The original `report_account_result` definition and8h/20h/6h due rules remain intact. This does not answer MA-16 or turn on twice-daily collection.
- Health adds `zero_item_streaks`, `story_capture_gap` and `media_missing_24h` to all nine unchanged legacy fields. See the [dated semantics decision](../../../docs/DECISIONS.md#local-cadence-and-health-continuation--29-october-2026). Counts concern observed content, not assumed complete source coverage. No observed stories yields null; no missing-media item yields zero.
- Existing typed gateway, native worker validation and WF-91 Code accept exact legacy or complete new health contracts. Partial/unknown extensions, oversized arrays/text, invalid fractions/counts and impossible calendar dates fail closed. Legacy absence remains absence. No HTML renderer or email subsystem added; untrusted strings remain data in the existing log-mode result.
- Historical hosted WF-91/export and its direct Postgres TLS failure remain unchanged. Generated Code/graph tests are not a native Cloud receipt or permission to reactivate closed M03 dependencies. Shared callback/scheduler work still waits where M05 website correctness is a concrete dependency.

## Verification and boundaries

- Shared typed health tests:18 pass. Initial RED rejected the additive result; GREEN accepts only the complete new result while retaining legacy compatibility.
- Native worker tests:9 pass; invalid-date RED reproduced JavaScript normalization of February30/24:00 before the calendar guard correction. Existing full foundation native regression set:99 pass, no skips. This is local code execution, not reopened M03 acceptance.
- Focused maintained WF-91 VM/graph tests:11 pass, including null/absent metrics, boundaries, malformed account data, injection-as-data and no notification body dispatch. This11 is included in the99, not additional.
- CI safety tests:18 pass. Exact regular suite count increases16→17, includes the new suite21 and rejects a16-file report. Mock257-assertion output is synthetic; it is not the real SQL total. No required check disabled or weakened.
- New PostgreSQL suite:56/56 pass in the existing fixed local fixture as native NOSUPERUSER postgres with rollback-only role membership. All17 regular suites pass764/764 assertions. Seven pending definitions were prepended inside rollback-only scratch transactions; old health output minus the three new fields and its ACL are compared exactly before/after21. Original14-version/10-item/one-company fixture, absent cadence function and no writer/agent SET membership were verified preserved. Synthetic time/identity/source cases; not actual hosted restricted-login or live observation evidence.
- A separately owned schema-only qualifier replayed all21 migrations, generated complete app/ops/ingest/api types and verified raw-candidate AST parity. Only the cadence function type was added. Security and performance advisors both exited0 with zero findings. Qualification container/scratch were stopped/removed; only the ignored public receipt at `scripts/db/out/m06-cadence-health/receipt.json` remains. This bootstrap schema qualifier is separate from native privilege testing and hosted evidence.
- Targeted ESLint, Node/shell syntax, formatting and diff checks pass. Normal changed-head CI remains required after the coherent code/docs push; use the actual latest branch run, never infer success from the accepted predecessor.

Migration21 SHA256: `44b404bcf3a307f1ba0b9bf34ff2ffb47777ba837883f245fd2dd323b825d70e`.

Full21-schema types SHA256: `e6102706955ff74f831af4ca60434c762470f39aecc9759dbb890ba481266143`.

Pending media migration20 remains byte-for-byte SHA256 `9c175f8bfa82f71b61143a5e5e9e52dee5954a89dfab1723737f6206a9e03108`. The19 already-applied hosted migrations remain unchanged; no migration was applied to hosted dev. The [same single prepared dev plan](native-media-dev-validation-20261029.md) now names both local pending migrations, keeps zero actors/one existing FIFO thumbnail and does not invoke a cadence switch or stage WF-91.

Independent code review found no remaining P1/P2 issue in the cadence/audit, interval, privilege or typed/native contracts. Original failed tests remain above rather than being presented as credential or hosted failures.

Incremental provider cost USD0: no actors, collection API calls or Storage uploads. Local compute/CI/Preview/shared infrastructure allocation remains unknown. Persistent encrypted originals were not opened or changed. M05's six accepted starts/USD0.28515, data, restored runtime and website denial remain preserved. The draft-creation403 remains a delivery-access issue; normal branch delivery is independent.

## Source contracts checked

The [Supabase changelog](https://supabase.com/changelog) was read after its Markdown endpoint returned unsupported content-type in the web reader. No relevant SQL change required a package update. Native PostgreSQL function replacement and JSON/aggregate semantics were checked against [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html), [JSON functions](https://www.postgresql.org/docs/current/functions-json.html) and [PostgreSQL17 aggregates](https://www.postgresql.org/docs/17/functions-aggregate.html). Actual native role, data, advisor and type checks determine local qualification; documentation is not a hosted receipt.
