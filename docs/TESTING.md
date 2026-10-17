# Testing strategy

Every milestone lists its own acceptance tests. This file sets the shared rules and tools.

## 1. Layers

| Layer | Tool | Where | Runs in CI | What it proves |
|---|---|---|---|---|
| Database | pgTAP via `supabase test db` | `supabase/tests/*.sql` | yes (local Supabase in Actions) | RLS (members vs non-members vs `api_agent`), RPC contracts, idempotency (calling `upsert_raw_items` twice inserts once), watermark advance, queue send, locked fields respected |
| Normalizers | Vitest | `n8n/normalizers/normalizers.test.ts` over `n8n/normalizers/<actor>.js` (the same plain-JS code pasted into n8n Code nodes) + fixtures `n8n/normalizers/fixtures/<actor>/*.json` | yes | Each actor/API output maps to the normalized item contract; item_type rules; date parsing; metrics |
| Shared logic | Vitest | `packages/shared` | yes | zod schemas, extraction result validation, slug/handle normalization, cost math |
| Web unit/component | Vitest + Testing Library | `apps/web` | yes | Components render states; formatters; RTL text |
| API contract | Vitest + supertest-style fetch against `next start` with a seeded local DB | `apps/web/tests/api` | yes | Auth, scopes, pagination, error format, rate limit |
| E2E | Playwright | `apps/web/e2e` | yes (against local stack with a seeded fixture user via Supabase test session) | Sign-in gate, feed, campaign drill-down, search, review approve, admin add competitor |
| n8n workflows | Manual + scripted: run each workflow in **dev** with a test account set (`data/test_accounts.csv`, 5 accounts per platform) | `n8n/tests/README.md` + SQL assertions in `scripts/assert/*.sql` | no (run by Codex per milestone, results in PROGRESS.md) | Run logged, items inserted once, no duplicate on re-run, costs logged, errors routed |
| AI eval | `scripts/eval/run.ts` | `eval/` | no (M07/M12) | Accuracy targets (AI_PIPELINE §8) |
| Accessibility | Playwright + axe | `apps/web/e2e/a11y.spec.ts` | yes | No serious/critical axe violations on key pages |
| Performance | Lighthouse CI (optional) + `EXPLAIN ANALYZE` on hot queries | `scripts/perf/` | optional | Targets in PRD §7 |

## 2. Fixtures

- `n8n/normalizers/fixtures/<actor>/`: one real-shaped JSON sample per actor/API (trimmed, anonymised where needed). Codex captures the first real outputs in dev during M04–M06 and saves them here; until then, use the field lists in `docs/SCRAPING_SOURCES.md`.
- `supabase/seed.sql`: taxonomies + one fake competitor with 3 accounts and 10 items for local dev and CI. The real seed is loaded by scripts, not by `seed.sql`.
- Test users: create them in local Supabase with the admin API in a test setup script (`member_invites` + `auth.users`), never in prod.

## 3. Rules

1. No milestone is Done without its tests passing, with the evidence pasted into PROGRESS.md.
2. Bugs found get a regression test first.
3. Never test against prod data, except read-only checks the milestone explicitly lists (M08, M15).
4. Re-running any collector on the same window must produce **zero** new rows (idempotency check) and must not re-queue AI.
5. Every RLS policy has a positive and a negative test.
