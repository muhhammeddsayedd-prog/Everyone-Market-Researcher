# M14 — Agent API + MCP · PROGRESS

> Codex keeps this file current. Read it first in every session; update it after every task.
> The owner reads it to see where we stand, what's blocked, and what they must do.

## Status
**Not started**

| Field | Value |
|---|---|
| Started | — |
| Last updated | 2026-10-17 |
| Finished | — |
| Branch / PR | — |
| Current task | — |
| Next step | Start T1: create migration m14_agent_api (ops.api_rate_counters, api.verify_key/log_call/hit_rate_limit/market_stats and write RPCs) |

## Task checklist
- [ ] T1 — Database: agent RPCs, rate counters, grants
- [ ] T2 — DB client and request pipeline
- [ ] T3 — Shared zod schemas
- [ ] T4 — Services
- [ ] T5 — REST routes
- [ ] T6 — MCP server
- [ ] T7 — `/admin/api-keys` and key lifecycle
- [ ] T8 — `/docs/api` and OpenAPI
- [ ] T9 — Hardening
- [ ] T10 — Connect agents (MA-25) and verify

## Acceptance criteria
- [ ] AC1 — Every REST endpoint in API_SPEC §5 is implemented and passes its contract tests, covering response shapes, filters, cursor pagination (no duplicates or gaps … — evidence:
- [ ] AC2 — Auth works as specified: — evidence:
- [ ] AC3 — Rate limit: request number 121 within one minute on a 120/min key returns 429 with `Retry-After` and `X-RateLimit-Remaining: 0`, and the next window succeeds — evidence:
- [ ] AC4 — Every call, success or failure, writes a row to `ops.api_calls` with transport, tool, status and duration — evidence:
- [ ] AC5 — The DB role is isolated — evidence:
- [ ] AC6 — MCP: the SDK client lists 18 tools and 3 resources, every read tool returns data, and the write and admin tools enforce scopes — evidence:
- [ ] AC7 — `/admin/api-keys` creates a key (secret shown once), revokes it, and shows the call log — evidence:
- [ ] AC8 — `/docs/api` renders all endpoints and tools, and `public/openapi.json` passes the OpenAPI lint — evidence:
- [ ] AC9 — Load check: 100 requests/min for 5 minutes gives 0 5xx and p95 < 800 ms on `GET /items` and `GET /search` (keyword) against prod-sized dev data — evidence:
- [ ] AC10 — CI is green, advisors are clean, and the security checklist items for the API are ticked with evidence — evidence:

## Blockers
- none

## Manual actions needed from the owner
| # | Action | Why | Status |
|---|---|---|---|
| MA-20 | Add API_AGENT_DATABASE_URL, API_KEY_PEPPER, N8N_WEBHOOK_BASE, N8N_WEBHOOK_SECRET to Vercel (Preview=dev, Production=prod) | API connects as api_agent and hashes keys with the pepper | Not requested yet |
| MA-25 | Create first API keys in prod /admin/api-keys; add MCP server (https://<app-domain>/api/mcp/mcp + Bearer header) to Claude and Codex | Agents verify the API end to end | Not requested yet |

## Decisions & deviations
- none

## Risks / notes for the owner
- none

## Session log
- 2026-10-17 · milestone file created (handoff pack)

## Hand-off to next milestone
- —
