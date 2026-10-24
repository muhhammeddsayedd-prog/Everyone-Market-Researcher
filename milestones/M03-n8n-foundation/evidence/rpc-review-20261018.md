# M03 RPC review checkpoint — 18 October 2026

Reviewed migration: `supabase/migrations/20261018034220_rpc_n8n_foundation.sql`.
Final SHA256: `457ad4351b08c47b996ae67062ed701efb7d5ef63ea7658d20931f2d5dc5d3fd`.
Semantic review/test checkpoint before formatting:
`569defb4df57c60987e371216c626074135188e4a25e46bd1438e88847bb3d62`.
Repository head during final review: `adeb82a5d58c974e072f2520cc52f9ba09bb9dbb`.
The migration and follow-up normalizer changes were uncommitted at this checkpoint.
The implementation agent reported a whitespace-only final cleanup and checked
removed-whitespace equality against the semantic checkpoint. The reviewer then
read the final cost-lock, logger, ownership, item-contract, atomic-completion and
ACL sections again and independently confirmed the final hash before/after reading.

The independent reviewer read the SQL and existing M01 functions, constraints,
foreign keys and smoke ownership helpers. No database connection, query,
migration replay or test suite was run by this reviewer. This is source review,
not hosted acceptance or an independently executed concurrency receipt.

No remaining P0/P1/P2 source findings at this checkpoint. The findings below
were sent directly to the implementation agent and root, then checked again
against the final source. Apply later changes through the same review process.

| Finding | Final source disposition |
| --- | --- |
| Raw node/HTTP/SQL messages could contain credentials that a prefix denylist missed. | `log_workflow_error` stores fixed message classifications, drops the stack, bounds safe workflow/execution/node identifiers and permits only a UUID correlation field in metadata. It does not persist raw messages or response/header objects. |
| Logger accepted object/array values as workflow, execution, node or stack text. | Explicit JSON type checks reject these malformed fields. Invalid input errors are fixed messages without input values. |
| Empty cost day defaulted on insert but conflicted after midnight on retry. | Explicit days must be ISO date strings; empty and non-string values are rejected. An omitted/null day is recorded as omitted in the prepared entry, so an equal retry retains the original receipt day. |
| Sub-scale negative costs/quantities became zero before the negative check. | The raw numeric signs are checked before casting into ledger precision. |
| Cost key locks could invert the callback's row locks; reversed batches also had inconsistent key order. | All entries are validated/prepared first. Referenced parent, registry, competitor, account and item rows are locked in a consistent order before sorted provider/cost-key advisory locks and inserts. Apify attribution is checked again after the locks. |
| Bounded payload fields did not bind the outer item title/caption or exclude extra normalized fields. | The M03 processor requires the exact ten-field item, fixed actor/platform/type/URL/hash, null published date, empty metrics, exact bounded snapshot and title/caption equality. |
| Matching C999 labels alone bypassed the fixture helper's ownership receipt. | Manual registration and processing require one system creation receipt matching fixture version, dev project ref, competitor ID and account ID, in addition to the fixed C999 slug/page and live account claim. |
| Separate SQL and normalizer fixtures hid a missing `metrics` field. | The actual normalizer now emits `metrics: {}`. Its local test compares prepared output keys to the actual SQL required-key list. The migration author also exercised actual normalizer JSON through the processor in a rollback-only local transaction. |

The atomic callback keeps ingest, account result, cost, processing receipt,
completion and parent finish in one SQL transaction. An error rolls the work
back. A matching completed replay returns the durable receipt with
`updated:false` and `finished_now:false`; conflicting callback data is rejected.
The standalone completion function cannot mark an unpersisted callback complete.

Every new function remains in the non-exposed `ops` schema with
`security definer` and `search_path = ''`. EXECUTE is revoked from PUBLIC,
anon, authenticated and api_agent, and granted to n8n_writer. The new receipt
column remains on an existing RLS-protected private table. The existing
`stats_daily_enabled:false` baseline is retained.

Local evidence remains separate:

- The reviewer ran normalizer checks after the actual contract fix:
  `pnpm.cmd test --project normalizers` — native exit0, **103/103 PASS**
  (16 existing, 87 new). Targeted ESLint, root TypeScript and formatting passed.
  Fixtures are explicitly synthetic; see
  [the local normalizer receipt](local-normalizers-20261018.json).
- The migration author reported **137/137 PASS**, native exit0, against local
  PostgreSQL17 in a complete rollback. That includes the actual CommonJS
  normalizer JSON first call and replay, not only an independently constructed
  SQL item fixture. These are author-executed results, not an independent rerun.
- The lock graph was reviewed statically. Root's separate concurrency harness
  and normal CI remain the relevant execution evidence; neither is claimed here.

Runtime integration gates remain open. The WF-90 adapter must supply stable
safe identifiers rather than full UI workflow labels containing punctuation,
and use the fixed message classifications. The WF-91 adapter should pass the
Cairo day explicitly:
`ops.accrue_fixed_costs((now() at time zone 'Africa/Cairo')::date - 1)`.
The callback adapter must re-fetch final Apify state using its credential before
calling the atomic RPC; SQL does not prove that HTTP verification occurred.
The connected Cloud runtime, real actor fixture, callback execution, hosted
migration/advisors/type readback and paid smoke path are not accepted by this review.

Current official references checked:

- [PostgreSQL17 row and advisory locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  supports the lock-order and deadlock analysis.
- [PostgreSQL17 numeric precision](https://www.postgresql.org/docs/17/datatype-numeric.html)
  supports checking negative values before scale coercion.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
  supports the definer/search-path and function privilege review.
- [Supabase changelog](https://supabase.com/changelog) was checked for relevant
  current function/security changes. Markdown URLs were unavailable through the
  reader; the official HTML pages were read instead.
