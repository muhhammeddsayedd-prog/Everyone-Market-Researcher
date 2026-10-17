# M14 — Agent API + MCP

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first.

## 1. Goal and outcome

AI agents (Claude, Codex and others) get full, safe access to Market Radar (D-23, T-12). When M14 is done:
- **REST API:** a versioned REST API at **`/api/v1`** serves every endpoint in `docs/API_SPEC.md` §5.
- **MCP server:** an MCP server at **`/api/mcp/mcp`** (Streamable HTTP) exposes 18 tools and 3 resources over the **same service layer**.
- **Access control:**
  - **Keys:** API keys are **hashed** (`sha256(secret + API_KEY_PEPPER)`) and **scoped** (`read` / `write` / `admin`).
  - **Rate limits:** 120 requests per minute per key by default; over the limit returns 429 with `Retry-After`.
  - **Logging:** every call is logged to `ops.api_calls`, failures included.
  - **Database role:** queries run as the **`api_agent`** Postgres role through the Supavisor transaction pooler. The service key is never used.
- **Admin pages:** `/admin/api-keys` creates and revokes keys. The secret is shown once.
- **Docs page:** `/docs/api` documents REST and MCP with connection snippets and links `public/openapi.json`, which is generated from the zod schemas.
- **Agents connected:** the owner connects Claude and Codex (MA-25), and every tool works end to end.

## 2. Context you need

- **Authentication** (API_SPEC §1):
  - **Header:** `Authorization: Bearer emr_<prefix>_<secret>`.
    - `prefix`: 8 characters `[a-z0-9]`, unique in `ops.api_keys.prefix`, shown in the UI.
    - `secret`: 32 random bytes, base64url (43 characters), shown once.
  - **Hash:** `hex(sha256(secret + API_KEY_PEPPER))`. Compare with `crypto.timingSafeEqual`.
  - **Revoked keys** (`revoked_at` set) return 401.
  - **Errors:** missing or invalid key → `401 unauthorized`; scope too low → `403 insufficient_scope`.
- **Scopes:**

  | Scope | Allows |
  |---|---|
  | `read` | Every GET endpoint and every read tool |
  | `write` | `read` + `POST /competitors` (`add_competitor`) + `POST /review/{taskId}/resolve` (`resolve_review`) |
  | `admin` | `write` + `POST /accounts/{id}/rescrape` (`trigger_rescrape`) |

- **Rate limit** (API_SPEC §2):
  - **Counter:** a fixed 1-minute window counter in Postgres, kept in the table **`ops.api_rate_counters(key_id, window_start, count)`**.
  - **RPC:** **`api.hit_rate_limit(key_id) returns int`** (the count after increment), `SECURITY DEFINER` in `api`. It upserts the counter and is called inside the request transaction.
  - **Headers:** every response carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`. A 429 response also carries `Retry-After` (seconds to the end of the window).
  - **Code boundary:** the implementation sits behind `lib/api/rate-limit.ts`, so Upstash can replace it later.
  - **Cleanup:** a pg_cron job deletes counter rows older than 1 hour.
- **Database access** (API_SPEC §3):
  - **Client:** `apps/web/lib/api/db.ts` uses postgres.js with `API_AGENT_DATABASE_URL`.
    - The URL points at the Supavisor **transaction** pooler: port 6543, user `api_agent.<project-ref>`.
    - Options: `prepare: false`, `max: 1` per serverless instance, `idle_timeout: 20`, `ssl: 'require'`.
  - **Per request,** one transaction:
    ```ts
    await sql.begin(async (tx) => {
      await tx`select set_config('app.api_key_id', ${keyId}, true), set_config('app.api_scope', ${scopes.join(',')}, true)`;
      // api.* views, app.search, app.similar, api.* write RPCs
    });
    ```
  - **What `api_agent` can touch:**
    - **Views:** `api.items_v`, `api.competitors_v`, `api.campaigns_v`, `api.organizations_v`, `api.people_v`, `api.briefs_v`, `api.news_v`.
    - **Read functions:** `app.search`, `app.similar`, `api.market_stats`.
    - **Write functions:** only `api.*` RPCs that start with `perform private.require_api_scope('write'|'admin')` and write to `ops.audit_log` (`actor_type 'api_key'`, `actor_id = current_setting('app.api_key_id')`).
  - **Key lookup and logging RPCs** (executable by `api_agent`; `SECURITY DEFINER` in `api`; added here):
    - **`api.verify_key(prefix) returns table(id, key_hash, scopes, rate_limit_per_min, revoked_at)`**
    - **`api.log_call(key_id, transport, tool, status, duration_ms)`**

    Never log the key, and never log request bodies that contain secrets.
- **Conventions** (API_SPEC §4):
  - **Format:** JSON UTF-8. Arabic is returned as is.
  - **Dates:** ISO 8601 UTC. Date-only params use `YYYY-MM-DD`; `from` is inclusive and `to` is exclusive.
  - **Pagination:** keyset cursor `?limit` (default 25, max 100) and `?cursor` (opaque base64url of `{sort_key, id}`). Responses look like `{data, next_cursor}`.
  - **Filters:** comma-separated values.
  - **Errors:** `{error:{code, message, details}}`. Codes: `bad_request` 400, `unauthorized` 401, `insufficient_scope` 403, `not_found` 404, `conflict` 409, `validation_failed` 422, `rate_limited` 429, `internal` 500.
  - **Headers:** `X-EMR-API-Version: 1` and `Cache-Control: private, no-store`.
  - **Thumbnails:** `thumbnail_url` is the Storage public URL, or null. Expiring source CDN URLs are never returned.
  - **Shared object:** `ItemSummary` (API_SPEC §4).
- **Endpoints** (API_SPEC §5):
  - **Public:** `GET /health` (no auth).
  - **Read scope:**
    - `GET /search`
    - `GET /items`, `GET /items/{id}`, `GET /items/{id}/similar`
    - `GET /campaigns`, `GET /campaigns/{id}`
    - `GET /competitors`, `GET /competitors/{slug}`, `GET /competitors/{slug}/accounts`
    - `GET /brands`, `GET /brands/{slug}`
    - `GET /agencies`, `GET /agencies/{slug}`
    - `GET /people`, `GET /people/{slug}`
    - `GET /briefs`, `GET /briefs/{week}/{scope}`
    - `GET /news`
    - `GET /stats/market`
    - `GET /taxonomies`
  - **Write scope:** `POST /competitors`, `POST /review/{taskId}/resolve`.
  - **Admin scope:** `POST /accounts/{id}/rescrape`.
  - **Not here:** ads endpoints and LinkedIn jobs (D-08).
- **MCP** (API_SPEC §7):
  - **Route and libraries:** `apps/web/app/api/mcp/[transport]/route.ts`, using **`mcp-handler`** (Vercel MCP adapter) with **`@modelcontextprotocol/sdk`**. **Verify the current package names, APIs and auth helper (`withMcpAuth`) before building.**
  - **Transport:** Streamable HTTP at `/api/mcp/mcp`. SSE is disabled, since it would need Redis, which isn't in v1.
  - **Server info:** name `everyone-market-radar`, version `1.0.0`, with the instructions string from API_SPEC §7.
  - **Tools (18):** `search`, `list_items`, `get_item`, `similar`, `list_campaigns`, `get_campaign`, `list_competitors`, `get_competitor`, `get_brand`, `get_agency`, `get_person`, `get_brief`, `list_news`, `market_stats`, `list_taxonomies`, `add_competitor` (write), `resolve_review` (write), `trigger_rescrape` (admin). Input schemas are in API_SPEC §7 (zod).
  - **Results:** `content:[{type:'text', text: JSON.stringify(result)}]`, plus `structuredContent` when the SDK supports output schemas. Errors set `isError: true` and carry the §4 code and message.
  - **Resources:** `radar://taxonomies`, `radar://brief/latest/{scope}` (EG|KSA|UAE|ALL), `radar://competitors/pilot`.
- **Search embeddings:** `GET /search` and the `search` tool embed `q` at request time with `OPENAI_MODEL_EMBED` (`text-embedding-3-small`) using `OPENAI_API_KEY` (server only), then call `app.search(q, embedding, types, filters, limit)`. Reuse the M11 search service.
- **Outbound after `add_competitor`:**
  - **Call:** the API calls n8n WF-60: `POST {N8N_WEBHOOK_BASE}/webhook/emr-onboarding` with header `x-emr-secret: N8N_WEBHOOK_SECRET` and body `{competitor_id, account_ids[]}`. It expects 202 (API_SPEC §6.4).
  - **Failure is not fatal:** the competitor already exists with `backfill_status = 'pending'`, and the hourly backfill wave picks it up anyway.
  - WF-60 itself is built in M15. In M14 the call targets the webhook URL if it exists. Otherwise it logs a warning and continues.
- **Environment variables:** `API_AGENT_DATABASE_URL`, `API_KEY_PEPPER`, `OPENAI_API_KEY`, `OPENAI_MODEL_EMBED`, `N8N_WEBHOOK_BASE`, `N8N_WEBHOOK_SECRET` (ENVIRONMENT §2; `templates/.env.example`).
- **Route segment config:** `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 30` (MCP: 60).
- **Write workers:** `api.add_competitor` and `api.resolve_review` reuse the **same private workers** as `app.admin_upsert_competitor` and `app.review_resolve` (M11). There is one implementation of the business logic, with two entry points.

## 3. Prerequisites

| Item | Needed when | Notes |
|---|---|---|
| M11 Done | T1 | Review and admin workers, search service, `/admin/api-keys` shell |
| M13 Done | T4 (briefs and news services) | `lib/api/services/news.ts` and `briefs.ts` exist |
| `api_agent` password set (MA-05) | T2 | Already done in M01 |
| MA-20 Vercel env vars (`API_AGENT_DATABASE_URL`, `API_KEY_PEPPER`) | T2 | Preview = dev, Production = prod |
| **MA-25** owner creates first keys + connects Claude/Codex | T10 | |

## 4. Scope

**In:**
- Key generation, storage and revocation.
- The auth, rate-limit and logging middleware.
- The `api_agent` DB client.
- All REST endpoints.
- The MCP server with tools and resources.
- The `api.*` RPCs (verify_key, log_call, hit_rate_limit, market_stats, add_competitor, resolve_review, request_rescrape).
- `/admin/api-keys` completion: create, revoke, call log.
- `/docs/api` and `openapi.json`.
- Contract tests.
- Connecting Claude and Codex.

**Out:**
- OAuth for MCP (Bearer keys are enough in v1).
- Public or anonymous access.
- Webhooks *to* agents.
- Ads and LinkedIn jobs endpoints (D-08).
- SSE transport.
- An Upstash rate limiter (possible later).

## 5. References

- `docs/API_SPEC.md` (the whole file is binding for this milestone)
- `docs/TECHNICAL.md` §7 (roles, pooler), §11 (API), §12 (security checklist)
- `docs/DATA_SCHEMA.md` §1 (schemas and access), §5 (agent RPCs)
- `reference/sql/003_auth_rls_views.sql` (api_agent read policies, api.* views), `005_rpc_app_api_search.sql` (`app.search`, `app.similar`, `private.require_api_scope`, api write RPC sketches)
- `DESIGN.md` §8.24 `/admin/api-keys`, §8.25 `/docs/api`
- `docs/ENVIRONMENT.md` §2–4 (env, pepper rotation)
- `docs/TESTING.md` (API contract layer)
- `docs/PRD.md` FR-G1…FR-G3

## 6. Deliverables

| Deliverable | Path |
|---|---|
| Migration | `supabase/migrations/<ts>_m14_agent_api.sql`: `ops.api_rate_counters`, `api.verify_key`, `api.log_call`, `api.hit_rate_limit`, `api.market_stats`, `api.add_competitor`, `api.resolve_review`, `api.request_rescrape`, grants, pg_cron cleanup |
| DB client | `apps/web/lib/api/db.ts` |
| Middleware | `apps/web/lib/api/auth.ts` (parse, verify, scopes), `lib/api/rate-limit.ts`, `lib/api/handler.ts` (auth → rate limit → zod → service → errors → log), `lib/api/errors.ts`, `lib/api/cursor.ts` |
| Schemas | `packages/shared/src/api/*.ts` (zod, shared by REST and MCP and the OpenAPI generator) |
| Services | `apps/web/lib/api/services/{search,items,campaigns,competitors,organizations,people,briefs,news,stats,taxonomies,review,accounts}.ts` |
| REST routes | `apps/web/app/api/v1/**/route.ts` |
| MCP | `apps/web/app/api/mcp/[transport]/route.ts`, `apps/web/lib/mcp/{server.ts,tools/*.ts,resources.ts}` |
| Key admin | `/admin/api-keys` create/revoke/call log (server actions using `app.admin_store_api_key`, `app.admin_revoke_api_key`) |
| Docs | `/docs/api` (MDX from `docs/API_SPEC.md` content + generated tables), `apps/web/public/openapi.json` (generated at build by `scripts/gen-openapi.ts`) |
| Tests | `apps/web/tests/api/*.test.ts`, `apps/web/tests/mcp/*.test.ts`, pgTAP `supabase/tests/m14_api.test.sql` |

## 7. Tasks

### T1: Database: agent RPCs, rate counters, grants
Create the migration with `supabase migration new m14_agent_api`.
- **Rate counters:**
  - Table `ops.api_rate_counters (key_id uuid references ops.api_keys(id) on delete cascade, window_start timestamptz, count int not null default 0, primary key (key_id, window_start))`, with RLS enabled and no policies.
  - pg_cron: every 10 minutes, delete rows older than 1 hour.
- **`api.verify_key(p_prefix text)`:** returns the row for a prefix that exists and isn't revoked. Never returns the hash for revoked keys; it returns `revoked_at` so the API can answer 401. Also updates `last_used_at`, at most once per minute, to avoid write amplification.
- **`api.log_call(p_key_id uuid, p_transport text, p_tool text, p_status int, p_duration_ms int)`:** inserts into `ops.api_calls`.
- **`api.hit_rate_limit(p_key_id uuid) returns int`:** upserts the counter for `date_trunc('minute', now())` and returns the count.
- **`api.market_stats(p_filters jsonb, p_group_by text[], p_from date, p_to date, p_metric text) returns jsonb`:**
  - **Inputs:** `group_by` is checked against a whitelist (country, platform, competitor, brand, industry, content_type, occasion, month, week), one or two dimensions. `metric` is items | campaigns | commercial_items. The default window is the last 90 days.
  - **Implementation:** build the query **without** dynamic SQL injection risk. Use a `CASE`-based dimension expression or `format('%I')` with whitelisted identifiers only.
  - **Speed:** use `app.stats_daily` where possible.
- **`api.add_competitor(p jsonb) returns jsonb`:** `perform private.require_api_scope('write')`, then call the shared private worker used by `app.admin_upsert_competitor`. Duplicate handle → raise `unique_violation` with the existing competitor slug in `detail` (mapped to 409). Audit with `actor_type 'api_key'`.
- **`api.resolve_review(p_task_id bigint, p_action text, p_payload jsonb) returns jsonb`:** scope `write`, using the same worker as `app.review_resolve`.
- **`api.request_rescrape(p_account_id uuid, p_mode text) returns jsonb`:** scope `admin`, using the same worker as `app.admin_request_rescrape`.
- **Security for every function above:**
  - `SECURITY DEFINER`, `set search_path = ''`, fully qualified names;
  - `revoke execute … from public`; `grant execute … to api_agent`;
  - functions in `api` are not exposed by PostgREST: confirm `api` is **not** in the Data API exposed schemas.
- **Grants:** `api_agent` has `select` on `api.*` views, SELECT on `app` tables **only through RLS read policies** (needed because the `security_invoker` views run as the caller), `execute` on `app.search`, `app.similar`, `private.require_api_scope` and the `api.*` RPCs, and **no direct writes**. Prove it in pgTAP: `api_agent` can't select `ops.*` or `ingest.*`, and can't insert/update/delete any `app.*` table.
- Run advisors, then regenerate types.
- **Done when:** pgTAP (§10) is green.

### T2: DB client and request pipeline
- **`lib/api/db.ts`:** postgres.js singleton per instance with the options from §2, plus a `withApiTx(ctx, fn)` helper that runs `begin` → `set_config` → `fn(tx)` → commit.
- **`lib/api/auth.ts`:**
  1. Parse the Bearer value with regex `^emr_([a-z0-9]{8})_([A-Za-z0-9_-]{43})$`.
  2. Call `api.verify_key(prefix)`.
  3. Hash with the pepper and compare in constant time.
  4. Return `{keyId, scopes, rateLimit}`, or throw `unauthorized`.
  5. Cache successful verifications in memory for 60 s (keyed by the prefix + hash of the full token) to cut DB round trips. A revocation takes effect within 60 s; document that.
- **`lib/api/rate-limit.ts`:** call `api.hit_rate_limit`. Over the limit → `rate_limited` with `Retry-After` = seconds to the next minute.
- **`lib/api/handler.ts`:**
  - Wrap each route: auth → scope check → rate limit → zod parse (query/body) → service → JSON. Set the headers `X-EMR-API-Version`, `X-RateLimit-*` and `Cache-Control`.
  - Map errors: zod → 422; Postgres `42501` (`insufficient_scope`) → 403; `unique_violation` → 409; not found → 404; anything else → 500, with the message hidden.
  - Always call `api.log_call` in `finally`, with the status and duration.
- **`lib/api/cursor.ts`:** encode and decode `{k: sortKey, id}` as base64url. Reject tampered cursors (422).
- **Lint rule:** `no-restricted-imports` blocks `lib/supabase/admin.ts` (secret key) everywhere except `/api/internal/media-upload-url` (API_SPEC §6.2), and blocks `lib/api/db.ts` from client components.
- **Done when:** unit tests cover auth parsing, the constant-time compare, cursor round-trips and error mapping.

### T3: Shared zod schemas
- Add `packages/shared/src/api/`:
  - query schemas per endpoint (filters, pagination);
  - body schemas (`AddCompetitorBody`, `ResolveReviewBody`, `RescrapeBody`);
  - response schemas (`ItemSummary`, `ItemDetail`, `Campaign`, `CompetitorSummary`, `CompetitorDetail`, `Organization`, `Person`, `Brief`, `NewsArticle`, `MarketStatsRow`, `Taxonomies`, `ErrorBody`).
- Platform enums for writes are limited to `vimeo|instagram|website|website_work_page|linkedin|youtube` (stories and employees rows are created automatically). Country is `EG|KSA|UAE`; scope is `EG|KSA|UAE|ALL`.
- These schemas are the single source for REST validation, MCP tool input schemas and the OpenAPI generator.
- **Done when:** the schemas type-check and their snapshot tests pass.

### T4: Services
- Implement `lib/api/services/*.ts`. Each function takes `tx` + validated params and returns plain objects shaped by the response schemas.
- Items, campaigns and competitors use **keyset pagination** on `(published_at|last_seen_at|name, id)`.
- **Reuse** the M11 search and similar logic (`app.search`, `app.similar`) and the M13 news and briefs services, refactored if needed so the web app and the API share the same code path, with different DB clients.
- `get_competitor` returns:
  - the profile;
  - stats (from `app.stats_daily`);
  - accounts with health (platform, url, status, last_success_at, never internal errors);
  - the latest `employee_snapshots` (headcount, recent joins);
  - the 10 most recent items.
- **Done when:** service tests against the local Supabase with seeded fixtures pass (correct shapes, filters and pagination stability).

### T5: REST routes
- Create every route in API_SPEC §5 under `apps/web/app/api/v1/…`, each a thin `handler(...)` call.
- `GET /health` returns `{status:'ok', version, db: 'ok'|'error'}` with no auth, and never leaks environment details.
- `POST /competitors` returns 201 + `{id, slug, company_code, accounts}`, then makes the outbound WF-60 call (§2). Failure is logged, not fatal.
- `POST /accounts/{id}/rescrape` returns 202 with `{account_id, queued_for}`.
- **Done when:**
  - each endpoint has at least one contract test (auth ok, 401, 403 where relevant, validation 422, happy path shape);
  - pagination is stable across inserts.

### T6: MCP server
- Check the current `mcp-handler` and `@modelcontextprotocol/sdk` docs and versions, pin the exact versions, and record them in PROGRESS.
- **`lib/mcp/server.ts`:** register the 18 tools with input schemas derived from the shared zod schemas, and the 3 resources.
  - Each tool calls the same service inside `withApiTx`, with scope enforcement per tool.
  - Log via `api.log_call` with `transport='mcp'` and `tool=<name>`.
  - The rate limit is shared with REST.
- **Auth:** use the adapter's auth wrapper (`withMcpAuth` or the current equivalent) to read the Bearer key. Unauthorized → a proper MCP/HTTP 401 response.
- **Results:** `content` text JSON, plus `structuredContent` if supported. Errors: `isError: true` with the code and message.
- **Done when:** a test using the SDK client:
  1. connects to the local server;
  2. lists all 18 tools and 3 resources;
  3. calls each read tool successfully;
  4. confirms the write and admin tools are refused with a `read` key and work with `write` / `admin` keys.

### T7: `/admin/api-keys` and key lifecycle
- **Create:**
  - The dialog (name, scopes, rate limit) calls a server action that generates the prefix (8 lowercase alphanumeric characters, retried on collision) and the secret (32 bytes, base64url).
  - It hashes the secret with `API_KEY_PEPPER`, calls `app.admin_store_api_key(name, prefix, hash, scopes)` (admin only), then sets the rate limit.
  - It shows `emr_<prefix>_<secret>` **once** in a CodeBlock with "Copy it now — it won't be shown again." (DESIGN.md §8.24).
- **Revoke:** with a confirmation, calls `app.admin_revoke_api_key`.
- **Call log:** shows the last 100 `ops.api_calls` for the selected key, via an admin-only RPC/worker (e.g. `app.admin_api_calls(p_key_id, p_limit)`).
- The secret never reaches logs, analytics or the URL.
- **Done when:**
  - e2e: an admin creates a key, uses it with curl (`fetch`) in the test, revokes it, and the next call returns 401 (after the 60 s cache, or with the cache bypassed in the test);
  - viewers and analysts can't open the page.

### T8: `/docs/api` and OpenAPI
- **`scripts/gen-openapi.ts`:** build OpenAPI 3.1 from the shared zod schemas plus a route table, using a current zod → OpenAPI library (verify current options such as `@asteasolutions/zod-to-openapi` or `zod-openapi`). Output `apps/web/public/openapi.json` at build time (`prebuild` script).
- **`/docs/api`** (DESIGN.md §8.25), visible to members:
  - left: TOC;
  - right: sections for auth, rate limits, errors, each REST endpoint (method, path, params table, a curl example, an example response) and MCP (URL `https://<app-domain>/api/mcp/mcp`, the `.mcp.json` snippet, the tool table with input schemas, the resources);
  - the user's own key prefixes, for admins.
- **Done when:** `openapi.json` validates (an OpenAPI linter in CI), and the docs page renders every endpoint and tool.

### T9: Hardening
- **Body limits:** body size ≤ 64 KB; JSON only (`content-type` check → 415 via `bad_request`).
- **CORS:** API routes send no CORS headers (server-to-server use only). If browser agents need it later, add an allowlist.
- **Abuse:** `q` length ≤ 300; `limit` ≤ 100; `group_by` whitelist; `search` p95 timing logged.
- **Load check:** 100 requests/min sustained from one key → no 5xx; 200/min → 429s with the correct headers.
- **Security checklist:** TECHNICAL §12 items for this milestone, with the evidence pasted.
- **Done when:** the load script `scripts/perf/api-load.ts` results are in PROGRESS.

### T10: Connect agents (MA-25) and verify
1. The owner creates a `read` key for Claude and a `write` key for Codex (or as they prefer) in **prod** `/admin/api-keys`.
2. The owner adds the MCP server to Claude (claude.ai / Claude Desktop / Claude Code) and Codex with URL `https://<app-domain>/api/mcp/mcp` and header `Authorization: Bearer <key>` (API_SPEC §7 snippet).
3. Codex runs a scripted check from its own MCP client: list the tools, then call `search` "Ramadan telecom", `get_competitor` for the top pilot slug, `get_brief` ALL, `market_stats` `group_by=[country,month]`, and `list_taxonomies`.
4. The owner asks Claude one natural question (e.g., "Which production houses did Vodafone Egypt work with this year?") and confirms Claude used the tools.
- **Done when:** the evidence (tool list, outputs summary, `ops.api_calls` rows for both keys) is in PROGRESS.

## 8. Interfaces & contracts

- **Key format:** `emr_<8 [a-z0-9]>_<43 base64url>`. Stored: `prefix`, `key_hash` (hex sha256 of secret + pepper), `scopes[]`, `rate_limit_per_min`.
- **Request transaction GUCs:** `app.api_key_id` (uuid text), `app.api_scope` (comma-separated scopes).
- **RPCs (`api_agent` EXECUTE):**

  | Function | Returns |
  |---|---|
  | `api.verify_key(prefix)` | `(id, key_hash, scopes, rate_limit_per_min, revoked_at)` |
  | `api.hit_rate_limit(key_id)` | `int` |
  | `api.log_call(key_id, transport, tool, status, duration_ms)` | `void` |
  | `api.market_stats(filters, group_by, from, to, metric)` | `jsonb` |
  | `api.add_competitor(p)` | `jsonb` |
  | `api.resolve_review(task_id, action, payload)` | `jsonb` |
  | `api.request_rescrape(account_id, mode)` | `jsonb` |

  Plus `app.search(...)` and `app.similar(...)`.
- **Error body:** `{error:{code, message, details}}`, using the codes in §2.
- **MCP:** endpoint `/api/mcp/mcp`, 18 tools and 3 resources, names exactly as in API_SPEC §7.
- **Outbound to WF-60:** `POST {N8N_WEBHOOK_BASE}/webhook/emr-onboarding`, header `x-emr-secret`, body `{competitor_id, account_ids[]}`.

## 9. Acceptance criteria

- **AC1:** Every REST endpoint in API_SPEC §5 is implemented and passes its contract tests, covering response shapes, filters, cursor pagination (no duplicates or gaps across pages while new rows are inserted) and error format.
- **AC2:** Auth works as specified:
  - a missing, malformed or revoked key returns 401;
  - a `read` key on a write endpoint or tool returns 403;
  - a `write` key on `trigger_rescrape` returns 403;
  - an `admin` key is accepted everywhere.

  These are proven by tests for **every** write and admin endpoint and tool.
- **AC3:** Rate limit: request number 121 within one minute on a 120/min key returns 429 with `Retry-After` and `X-RateLimit-Remaining: 0`, and the next window succeeds.
- **AC4:** Every call, success or failure, writes a row to `ops.api_calls` with transport, tool, status and duration. No key material or secret bodies appear in logs.
- **AC5:** The DB role is isolated. pgTAP proves `api_agent` can read the `api.*` views, `app.search` and `app.similar`, reads `app` tables only through RLS read policies, **cannot** read `ops` or `ingest`, and cannot write anything except through the `api.*` RPCs. The secret key is not imported anywhere except the media-upload route (lint passes).
- **AC6:** MCP: the SDK client lists 18 tools and 3 resources, every read tool returns data, and the write and admin tools enforce scopes. Claude **and** Codex connect with the owner's keys and successfully call `search`, `get_competitor`, `get_brief` and `market_stats` (MA-25 evidence).
- **AC7:** `/admin/api-keys` creates a key (secret shown once), revokes it, and shows the call log. Non-admins are refused.
- **AC8:** `/docs/api` renders all endpoints and tools, and `public/openapi.json` passes the OpenAPI lint.
- **AC9:** Load check: 100 requests/min for 5 minutes gives 0 5xx and p95 < 800 ms on `GET /items` and `GET /search` (keyword) against prod-sized dev data.
- **AC10:** CI is green, advisors are clean, and the security checklist items for the API are ticked with evidence.

## 10. Tests to write

- **pgTAP** (`m14_api.test.sql`):
  - `verify_key` returns `revoked_at` for revoked keys;
  - `hit_rate_limit` increments per minute window;
  - `require_api_scope` raises 42501 without scope;
  - `api.add_competitor` refused with `read`, accepted with `write`, audit row written;
  - `api.request_rescrape` needs `admin`;
  - privilege matrix for `api_agent` (positive and negative);
  - `market_stats` rejects non-whitelisted `group_by`.
- **Vitest (unit):** token parsing; constant-time compare; cursor encode/decode/tamper; error mapping; zod schemas.
- **Vitest (contract, against `next start` + local Supabase seeded):** one suite per endpoint, plus auth/scope/rate-limit suites. Run them in CI with `API_KEY_PEPPER=test`.
- **MCP:** an SDK client test that lists tools and resources, calls each tool, and checks the scope matrix.
- **Playwright:** the `/admin/api-keys` lifecycle; `/docs/api` renders; axe on `/docs/api`.

## 11. Manual actions from the owner

| ID | Action | When | Notes |
|---|---|---|---|
| MA-20 | Add `API_AGENT_DATABASE_URL` (transaction pooler, `api_agent` user) and `API_KEY_PEPPER` (`openssl rand -base64 48`) to Vercel for Preview (dev) and Production (prod). Also `N8N_WEBHOOK_BASE`, `N8N_WEBHOOK_SECRET` | Before T2 in preview | The pepper is different per env; rotating it invalidates all keys (ENVIRONMENT §4) |
| **MA-25** | Create the first API keys in prod `/admin/api-keys`, then add the MCP server to Claude and Codex (URL + Bearer header) | T10 | Keep keys in a password manager; never paste them in PROGRESS |

## 12. Risks & gotchas

- **Transaction pooler and prepared statements:** postgres.js must use `prepare: false` on port 6543. `set_config(..., true)` is transaction-local, so it is correct under transaction pooling. Never use session-level `SET`.
- **Connection storms:** serverless instances × pool size can exhaust the pooler. Keep `max: 1` and check the Supavisor client limits for the plan.
- **The key cache delays revocation** by up to 60 s. Document it on the API keys page.
- **MCP libraries move fast:** pin exact versions and re-verify the auth helper and transport naming (`[transport]` route → `/api/mcp/mcp`).
- **`structuredContent` support varies by client:** always include the text JSON too.
- **Large responses:** keep tool outputs compact (summaries, not full captions; `limit` defaults of 20–25). Agents can page with the cursor.
- **Dynamic SQL in `market_stats`:** whitelist identifiers only; never interpolate user strings.
- **Shared workers:** `api.resolve_review` must behave exactly like the UI's resolve, including alias teaching and `locked_fields`. Test both entry points against the same fixtures.
- **WF-60 not built yet:** the outbound onboarding call must fail soft until M15.

## 13. Cost & budget notes

- **Infrastructure:** about zero extra. Vercel functions plus Postgres reads.
- **OpenAI:** query embeddings for `search` cost about $0.02 per 1M tokens, which is negligible. Log them to `ops.cost_ledger` (provider `openai`, category `embed`, meta `{source:'api_search'}`) in a daily aggregate rather than per call, to avoid write load. Option: a simple in-memory sum flushed every N calls, or one ledger row per day via an upsert RPC `api.add_search_embed_cost(tokens)`.
- **Rate limit defaults** keep runaway agents from causing cost: 120/min, ≈ 7,200 embeddings/hour at most per key.

## 14. Definition of done & hand-off

**Done when:**
- AC1–AC10 pass with evidence.
- PR `m14-agent-api-mcp` is merged and CI is green.
- The prod API and MCP are live, and the owner's agents are connected.
- `docs/API_SPEC.md` is updated with any deviation (package versions, auth helper name), with a Changes note in DECISIONS if behaviour changed.
- The root board is updated.

**Hand-off to M15:**
- **Onboarding call:** `POST /competitors` and the admin add both call WF-60, which M15 now builds.
- **Telemetry:** the API call logs are available for the launch monitoring dashboard.
- **Load-test numbers:** M15 uses them as the baseline for its full-scale load test.
