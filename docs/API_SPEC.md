# Agent API and MCP — everyone. Market Radar

REST API at `/api/v1` and MCP server at `/api/mcp`, both in the Next.js app on Vercel (`apps/web`). Same data, same scopes, same logging. Built in **M14**; internal endpoints (§6) are built earlier where noted.
Binding rules: D-23, T-12, `docs/TECHNICAL.md` §11–12. Data: `docs/DATA_SCHEMA.md`, `reference/sql/003…005`.
**Out of scope:** ads endpoints (D-08), LinkedIn jobs (D-08).

---

## 1. Authentication and scopes

- Header: `Authorization: Bearer emr_<prefix>_<secret>`
  - `prefix`: 8 chars `[a-z0-9]` (public, shown in the admin UI, unique in `ops.api_keys.prefix`).
  - `secret`: 32 random bytes, base64url (43 chars). Shown **once** at creation.
- Storage: `key_hash = hex(sha256(secret + API_KEY_PEPPER))`. `API_KEY_PEPPER` is a server-only env var (Vercel). Compare with `crypto.timingSafeEqual`.
- Creation (admin UI, M14): server generates prefix + secret → `app.admin_store_api_key(name, prefix, hash, scopes)` → returns id → UI shows the full key once.
- Revocation: `app.admin_revoke_api_key(id)` sets `revoked_at`; revoked keys → 401.
- Scopes:

| Scope | Allows |
|---|---|
| `read` | All GET endpoints and read MCP tools |
| `write` | `read` + `POST /competitors`, `POST /review/{taskId}/resolve` (`add_competitor`, `resolve_review`) |
| `admin` | `write` + `POST /accounts/{id}/rescrape` (`trigger_rescrape`) |

- Missing/invalid key → `401 unauthorized`; insufficient scope → `403 insufficient_scope`.

## 2. Rate limiting

- Default 120 requests/min per key (`ops.api_keys.rate_limit_per_min`).
- Implementation (no extra infra): fixed 1-minute window counter in Postgres — RPC `api.hit_rate_limit(key_id) returns int` (SECURITY DEFINER in `api`, upserts `ops.api_rate_counters(key_id, window_start, count)`; add in M14) called inside the request transaction. If Upstash is added later, swap the implementation behind `lib/api/rate-limit.ts`.
- Over the limit → `429 rate_limited` with headers `Retry-After: <seconds to window end>`, `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`. All responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`.

## 3. Database access pattern (`api_agent` role)

- `apps/web/lib/api/db.ts`: `postgres` (postgres.js) client, `API_AGENT_DATABASE_URL` = Supavisor **transaction** pooler (port 6543), user `api_agent.<project-ref>`, `prepare: false`, `max: 1` per serverless instance, `idle_timeout: 20`, SSL required. **Never** the secret/service key.
- Every request runs one transaction:
```ts
await sql.begin(async (tx) => {
  await tx`select set_config('app.api_key_id', ${keyId}, true), set_config('app.api_scope', ${scopes.join(',')}, true)`;
  // queries on api.* views / app.search / app.similar / api.* write RPCs
});
```
- `api_agent` reads only `api.*` views and `app.search`/`app.similar` (RLS policies `to api_agent using (true)` on the underlying `app` tables). Writes only via `api.*` RPCs that start with `perform private.require_api_scope('write'|'admin')` and write `ops.audit_log` (`actor_type 'api_key'`, `actor_id = current_setting('app.api_key_id')`).
- Key lookup + call logging use RPCs executable by `api_agent`: `api.verify_key(prefix) returns (id, key_hash, scopes, rate_limit_per_min, revoked_at)` and `api.log_call(key_id, transport, tool, status, duration_ms)` (SECURITY DEFINER in `api`; add in M14). Log every call (also failures), never the key or request bodies with secrets.

## 4. Conventions

| Topic | Rule |
|---|---|
| Format | JSON, UTF-8. Arabic text returned as-is. |
| Dates | ISO 8601 UTC (`2026-10-16T18:22:00Z`); date-only params `YYYY-MM-DD` (inclusive `from`, exclusive `to`) |
| Pagination | Cursor (keyset): `?limit=` (default 25, max 100) and `?cursor=` (opaque base64url of `{published_at|last_seen_at|name, id}`). Response `{ data: [...], next_cursor: string|null }` |
| Filters | Query params, comma-separated for multi-values: `country=EG,KSA`, `platform=instagram,vimeo`, `competitor=<slug>`, `brand=<slug>`, `agency=<slug>`, `content_type=<code>`, `occasion=<code>`, `industry=<code>`, `status=active|removed`, `ai_status=published|review`, `from`, `to`, `min_confidence` |
| Sorting | Default newest first; `sort=` only where listed |
| IDs | UUIDs for items/campaigns; slugs for competitors/brands/agencies/people |
| Errors | `{ "error": { "code": "not_found", "message": "Campaign not found", "details": {} } }` with HTTP status. Codes: `bad_request` 400, `unauthorized` 401, `insufficient_scope` 403, `not_found` 404, `conflict` 409, `validation_failed` 422, `rate_limited` 429, `internal` 500 |
| Validation | zod schemas in `packages/shared/src/api/*.ts`, shared by REST and MCP |
| Versioning | Path `/api/v1`. Additive changes (new fields/params) allowed in v1; breaking changes → `/api/v2`. Response header `X-EMR-API-Version: 1` |
| Caching | `Cache-Control: private, no-store` (data is per-key authorized) |
| Thumbnails | `thumbnail_url` = public Storage URL of `thumbnail_path` when saved, else `null` (source CDN URLs are not returned — they expire) |

### Shared object shapes
```json
// ItemSummary
{ "id": "uuid", "platform": "instagram", "item_type": "reel", "url": "https://www.instagram.com/reel/…/",
  "published_at": "2026-10-16T18:22:00Z", "title": null, "summary_en": "…", "summary_ar": "…",
  "thumbnail_url": "https://<project>.supabase.co/storage/v1/object/public/media/…/thumb.jpg",
  "competitor": { "slug": "good-people", "name": "Good People" },
  "brand": { "slug": "vodafone-egypt", "name": "Vodafone Egypt", "industry": "telecom" },
  "agency": { "slug": "fp7-mccann-cairo", "name": "FP7 McCann Cairo" },
  "content_type": "tvc_brand_film", "occasion": "ramadan", "country": "EG",
  "metrics": { "views": 56000, "likes": 1200, "comments": 40 }, "confidence": 0.91, "ai_status": "published",
  "campaign_id": "uuid|null", "status": "active" }
```

## 5. Endpoints

### `GET /api/v1/health` — no auth
`200 { "ok": true, "version": "1", "time": "…" }` (checks a trivial DB query with a 2 s timeout; `503` if the DB is down).

### `GET /api/v1/search` — read
Params: `q` (required, ≤ 300 chars), `types` (`item,campaign,organization,person,competitor,news`; default all), filters (`country`, `platform`, `competitor`, `from`, `to`, `content_type`, `occasion`), `semantic=true|false` (default true), `limit` (≤ 50).
Implementation: embed `q` with OpenAI `text-embedding-3-small` (server-side, `OPENAI_API_KEY`; cache embeddings of identical queries for 10 min in memory) → `app.search(q, embedding, types, filters, limit)`.
```json
{ "data": [ { "entity_type": "campaign", "entity_id": "uuid", "title": "Vodafone Ramadan 2026 — Together",
              "subtitle": "Telecom · Good People · EG", "score": 0.0312, "url": "/campaigns/uuid" } ],
  "next_cursor": null }
```

### `GET /api/v1/items` — read
Filters (all from §4) + `campaign=<uuid>`, `commercial=true|false`. Sort `published_at desc`.
`200 { data: ItemSummary[], next_cursor }`

### `GET /api/v1/items/{id}` — read
`ItemSummary` + `caption_original`, `caption_en`, `hashtags`, `mentions`, `tagged_accounts`, `duration_seconds`, `tags`, `field_confidence`, `evidence`, `credits: [{ person: {slug,name}|null, name_raw, role, organization: {slug,name}|null }]`, `campaign: {id,title}|null`, `first_seen_at`, `removed_detected_at`.

### `GET /api/v1/items/{id}/similar` — read
Params `limit` (≤ 24). `app.similar('item', id, limit)` → `{ data: [ { item: ItemSummary, distance: 0.12 } ] }`.

### `GET /api/v1/campaigns` — read
Filters: `brand`, `competitor`, `agency`, `country`, `occasion`, `industry`, `from`, `to` (on `last_seen_at`), `status=active|review`. Sort `last_seen_at desc`.
```json
{ "data": [ { "id": "uuid", "title": "Ramadan 2026 — Together", "brand": {"slug":"vodafone-egypt","name":"Vodafone Egypt"},
  "competitor": {"slug":"good-people","name":"Good People"}, "agency": {"slug":"fp7-mccann-cairo","name":"FP7 McCann Cairo"},
  "occasion": "ramadan", "country": "EG", "first_seen_at": "2026-02-20T…", "last_seen_at": "2026-03-10T…",
  "item_count": 7, "platforms": ["vimeo","instagram","youtube"], "summary_en": "…", "confidence": 0.88 } ],
  "next_cursor": "…" }
```

### `GET /api/v1/campaigns/{id}` — read
Campaign + `items: ItemSummary[]` (all, ordered by `published_at`), `credits` (merged across items, deduped by person+role), `similar: [{id,title,distance}]` (top 6), `summary_ar`.

### `GET /api/v1/competitors` — read
Filters: `tier=baseline,pilot,next_wave,adjacent`, `market=EG,KSA,UAE`, `category=<code>`, `status`. Sort `name` (default) or `activity` (items last 30 days desc).
```json
{ "data": [ { "slug": "good-people", "company_code": "C1xx", "name": "Good People", "markets": ["KSA","UAE"],
  "hq_country": "KSA", "categories": ["production","film_and_tv"], "priority_tier": "pilot", "pilot_rank": 1,
  "logo_url": "…", "website_url": "…", "items_30d": 34, "last_item_at": "2026-10-16T…" } ], "next_cursor": null }
```

### `GET /api/v1/competitors/{slug}` — read
Competitor + `in_house`, `notes`, `stats: { items_total, items_30d, campaigns_total, top_brands: [{slug,name,count}], top_agencies, formats: [{code,count}], platforms: [{platform,count}] }`, `team: { snapshot_date, headcount_listed, joined: [...], left_company: [...] } | null`, `recent_items: ItemSummary[]` (10).

### `GET /api/v1/competitors/{slug}/accounts` — read
`{ data: [ { id, platform, handle, url, status, last_success_at, last_error, consecutive_failures, items_count, backfill_status, next_due_at } ] }`.

### `GET /api/v1/brands` · `GET /api/v1/brands/{slug}` — read
List filters: `industry`, `country`, `status=confirmed|unconfirmed`, `q` (trigram on name). Detail: brand + `production_houses: [{slug,name,campaigns,last_seen_at}]`, `agencies: [...]`, `campaigns: [...]` (timeline, newest first, 50), `aliases`.

### `GET /api/v1/agencies` · `GET /api/v1/agencies/{slug}` — read
Same shape as brands; detail lists `brands` and `production_houses` the agency works with.

### `GET /api/v1/people` · `GET /api/v1/people/{slug}` — read
List filters: `role=<credit_role code>`, `q`. Detail: person + `credits: [{ item: ItemSummary, role, organization }]` (newest first) + `competitors` worked with. No contact data exists to return.

### `GET /api/v1/briefs` · `GET /api/v1/briefs/{week}/{scope}` — read
List: `{ data: [ { week_start: "2026-10-12", scope: "EG", title } ] }`. Detail: `{ week_start, scope, title, body_md, highlights: [{ claim, item_ids: [...] }], source_item_ids, created_at }`. `week` = Monday date; `scope` = `EG|KSA|UAE|ALL`.

### `GET /api/v1/news` — read
Filters: `kind=news|award`, `competitor`, `brand`, `from`, `to`. `{ data: [ { id, url, kind, title, source_name, published_at, snippet, mentions: [{entity_type, slug, name}] } ], next_cursor }`.

### `GET /api/v1/stats/market` — read
Params: `group_by` (one or two of `country,platform,competitor,brand,industry,content_type,occasion,month,week`), `metric` (`items|campaigns|commercial_items`), filters, `from`, `to` (default last 90 days).
`api.market_stats(filters, group_by, from, to)` → `{ data: [ { "country": "EG", "month": "2026-09", "items": 412 } ], meta: { from, to, metric } }`.

### `GET /api/v1/taxonomies` — read
`{ data: { industry: [{code,label_en,label_ar}], content_format: [...], occasion: [...], competitor_category: [...], credit_role: [...], in_house_capability: [...] } }` (active terms only).

### `POST /api/v1/competitors` — write
Body:
```json
{ "name": "New House", "name_ar": null, "markets": ["EG"], "hq_country": "EG", "categories": ["production"],
  "priority_tier": "next_wave", "website_url": "https://…",
  "accounts": [ { "platform": "instagram", "url": "https://www.instagram.com/newhouse/" },
                { "platform": "vimeo", "url": "https://vimeo.com/newhouse" } ] }
```
Validation: platforms limited to `vimeo|instagram|website|website_work_page|linkedin|youtube` (stories/employees rows are created automatically); unique handle per platform (`409 conflict` names the existing competitor). Calls `api.add_competitor(p)` → returns `{ id, slug, company_code, accounts: [...] }` `201`. Then the API calls WF-60 (outbound, §6.4).

### `POST /api/v1/review/{taskId}/resolve` — write
Body `{ "action": "approve" | "correct" | "reject" | "snooze" | "merge", "payload": { … } }` — payload by kind:
- `item_low_confidence` + `correct`: `{ brand_slug?, agency_slug?, content_type?, occasion?, country?, is_commercial_work?, credits?: [{name, role, organization_slug?}] }`
- `new_brand` / `new_agency` / `new_person` + `merge`: `{ merge_into_slug }`
- `campaign_merge` + `approve`/`reject`: `{}`
Returns `{ task_id, status, applied: {...} }`. `api.resolve_review(task_id, action, payload)` (same worker as the app's `app.review_resolve`).

### `POST /api/v1/accounts/{id}/rescrape` — admin
Body `{ "mode": "daily" | "backfill" }`. `api.request_rescrape(id, mode)` sets `next_due_at = now()` (and for backfill `backfill_status = 'pending'`, cursor reset). `202 { "account_id": "…", "queued_for": "next collector slot or backfill wave" }`.

## 6. Internal endpoints (not for agents)

All require header `x-emr-secret` (constant-time compare) with the env-specific secret; reject otherwise with `401`. Not listed in the API docs page; excluded from the MCP server.

### 6.1 `POST /api/revalidate` (M09)
Caller: n8n WF-70. Secret: `INTERNAL_WEBHOOK_SECRET`. Body `{ "tags": ["feed","stats","competitor:good-people"] }` (≤ 50 tags, regex `^[a-z0-9:_-]{1,80}$`). Calls `revalidateTag(tag)` for each. `200 { "revalidated": [...] }`.

### 6.2 `POST /api/internal/media-upload-url` (M06)
Caller: n8n WF-31. Secret: `INTERNAL_WEBHOOK_SECRET`. Body `{ "path": "good-people/instagram/C9x…/thumb.jpg" }` (regex `^[a-z0-9-]+/[a-z_]+/[A-Za-z0-9_-]+/(thumb|frame-0[1-3])\.jpg$`). Server creates a signed upload URL for bucket `media` with the Supabase **secret key** — the only runtime use of that key (TECHNICAL §9), in `lib/supabase/admin.ts`, imported only by this route (lint rule `no-restricted-imports` elsewhere). `200 { "signed_url": "…", "token": "…", "path": "…" }`.

### 6.3 `POST /api/internal/onboarding` (M15)
Caller: the app's own admin server action, after `app.admin_upsert_competitor`. Not an n8n target — it forwards to n8n.

### 6.4 Outbound: app → n8n WF-60
`POST {N8N_WEBHOOK_BASE}/webhook/emr-onboarding` with header `x-emr-secret: N8N_WEBHOOK_SECRET`, body `{ "competitor_id": "uuid", "account_ids": ["uuid"] }`. Expect `202`. On failure, the competitor still exists with `backfill_status = 'pending'`; the hourly backfill wave picks it up anyway (the call only speeds it up and runs validation).

## 7. MCP server

- Route: `apps/web/app/api/mcp/[transport]/route.ts` using **`mcp-handler`** (Vercel MCP adapter) and `@modelcontextprotocol/sdk`; transport **Streamable HTTP** at `https://<app-domain>/api/mcp/mcp` (SSE transport disabled unless a client needs it; if enabled it needs Redis — not in v1).
- Auth: same Bearer key as REST (`withMcpAuth` wrapper or manual check in the handler); scopes enforced per tool; calls logged with `transport = 'mcp'`.
- Every tool reuses the REST service layer (`apps/web/lib/api/services/*.ts`) — no duplicated queries.
- Server info: name `everyone-market-radar`, version `1.0.0`, instructions string: "Market intelligence on production houses in Egypt, KSA and UAE. Use search first; IDs are UUIDs for items/campaigns and slugs for competitors, brands, agencies and people."

### Tools

| Tool | Scope | Input schema (zod) | Returns |
|---|---|---|---|
| `search` | read | `{ q: z.string().min(1).max(300), types: z.array(z.enum(['item','campaign','organization','person','competitor','news'])).optional(), country: z.enum(['EG','KSA','UAE']).optional(), platform: z.enum(['vimeo','instagram','instagram_stories','website_work_page','linkedin','youtube']).optional(), from: z.string().date().optional(), to: z.string().date().optional(), limit: z.number().int().min(1).max(50).default(20) }` | ranked hits (type, id/slug, title, subtitle, score) |
| `list_items` | read | `{ competitor?: slug, brand?: slug, agency?: slug, campaign?: uuid, country?, platform?, content_type?, occasion?, from?, to?, commercial?: boolean, limit ≤ 100 default 25, cursor?: string }` | ItemSummary[] + next_cursor |
| `get_item` | read | `{ id: z.string().uuid() }` | full item with credits |
| `similar` | read | `{ entity_type: z.enum(['item','campaign']), id: uuid, limit ≤ 24 default 10 }` | similar entities with distance |
| `list_campaigns` | read | `{ brand?, competitor?, agency?, country?, occasion?, industry?, from?, to?, limit, cursor? }` | campaigns + next_cursor |
| `get_campaign` | read | `{ id: uuid }` | campaign with items, credits, similar |
| `list_competitors` | read | `{ tier?: enum[], market?: enum[], category?: string, sort?: enum['name','activity'], limit, cursor? }` | competitors |
| `get_competitor` | read | `{ slug: z.string() }` | profile + stats + team snapshot + recent items |
| `get_brand` | read | `{ slug }` | brand + houses + agencies + campaigns |
| `get_agency` | read | `{ slug }` | agency + brands + houses |
| `get_person` | read | `{ slug }` | person + credits |
| `get_brief` | read | `{ scope: z.enum(['EG','KSA','UAE','ALL']).default('ALL'), week?: z.string().date() /* Monday; default latest */ }` | brief markdown + cited items |
| `list_news` | read | `{ kind?: enum['news','award'], competitor?, brand?, from?, to?, limit, cursor? }` | articles |
| `market_stats` | read | `{ group_by: z.array(z.enum(['country','platform','competitor','brand','industry','content_type','occasion','month','week'])).min(1).max(2), metric: z.enum(['items','campaigns','commercial_items']).default('items'), from?, to?, country?, platform?, competitor? }` | rows for charts |
| `list_taxonomies` | read | `{ taxonomy?: z.enum([...6 taxonomies]) }` | codes and labels |
| `add_competitor` | write | same body as `POST /competitors` | created competitor |
| `resolve_review` | write | `{ task_id: z.number().int(), action: z.enum(['approve','correct','reject','snooze','merge']), payload: z.record(z.any()).default({}) }` | task result |
| `trigger_rescrape` | admin | `{ account_id: uuid, mode: z.enum(['daily','backfill']).default('daily') }` | queued confirmation |

Tool results: `content: [{ type: 'text', text: JSON.stringify(result) }]` plus `structuredContent` with the same object (when the SDK version supports output schemas). Errors: `isError: true` with the error code/message from §4.

### Resources
| URI | Content |
|---|---|
| `radar://taxonomies` | All active taxonomies (JSON) |
| `radar://brief/latest/{scope}` | Latest weekly brief markdown for `EG`, `KSA`, `UAE`, `ALL` |
| `radar://competitors/pilot` | The pilot list (slug, name, rank, markets) |

### Connecting agents
- **Claude (claude.ai / Claude Code / Desktop) and Codex:** add a remote MCP server with URL `https://<app-domain>/api/mcp/mcp` and header `Authorization: Bearer emr_<prefix>_<secret>`. Example `.mcp.json`:
```json
{ "mcpServers": { "market-radar": { "type": "http", "url": "https://<app-domain>/api/mcp/mcp",
  "headers": { "Authorization": "Bearer ${EMR_API_KEY}" } } } }
```
- **REST:** `curl -H "Authorization: Bearer $EMR_API_KEY" "https://<app-domain>/api/v1/search?q=ramadan%20telecom"`.
- The `/docs/api` page (FR-W15) renders this file's endpoint list, the tool table and connection snippets, with the user's own key prefix list.

## 8. Implementation notes

- Folder: `apps/web/app/api/v1/<resource>/route.ts` (+ `[id]/route.ts`); shared `lib/api/handler.ts` wraps auth → rate limit → zod parse → service → error mapping → `api.log_call`.
- Services: `lib/api/services/{search,items,campaigns,competitors,organizations,people,briefs,news,stats,taxonomies,review,accounts}.ts`, each taking the `tx` from §3.
- Route segment config: `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`, `maxDuration = 30` (MCP: 60).
- Tests (M14): Vitest for services against the local Supabase; Playwright/`fetch` tests for 401/403/429, cursor pagination stability, scope enforcement on every write tool; MCP tool list and one call per tool via the SDK client.
- OpenAPI: generate `apps/web/public/openapi.json` from the zod schemas (`zod-to-openapi` or hand-written) and link it from `/docs/api`.
