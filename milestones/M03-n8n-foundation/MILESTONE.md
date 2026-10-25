# M03 — n8n foundation

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first.

## 1. Goal and outcome

Build the n8n Cloud backbone every collector plugs into. When M03 is done, all of the following are true:
- **Plan facts:** the five n8n Cloud plan facts are verified and recorded: execution timeout, whether sub-workflows count against the quota, Variables, Apify community node, Postgres query parameters.
- **Codex access:** Codex can create, update, run and export workflows through the owner's n8n MCP/API connection.
- **Credentials:** reuse existing approved dev credentials by actual ID and compatible type; logical names do not require renaming or duplication. Production copies belong to their separately approved milestone.
- **Supabase RPCs** used by the backbone are implemented and tested (migration + pgTAP): `ops.log_cost`, `ops.register_apify_run`, `ops.complete_apify_run`, `ops.get_apify_run`, `ops.apify_runs_pending`, `ops.get_setting`, `ops.get_price_book`, `ops.log_workflow_error`, `ops.error_count_24h`, `ops.daily_health`, `ops.accrue_fixed_costs`. The price book holds the owner's real plan prices, and `daily_budget_usd` is set.
- **Shared sub-workflows:** `SUB · Start run`, `SUB · Finish run`, `SUB · Ingest items`, `SUB · Log cost` and `SUB · Notify` (log-only or temporary SMTP until M13).
- **Workflows:**
  - **WF-00 · Orchestrator** with every schedule slot wired to collector **stubs**, kept inactive;
  - **WF-19 · Apify run callback**, verifying runs, ingesting, logging cost and finishing runs;
  - **WF-90 · Error handler**;
  - **WF-91 · Health & cost**.
- **Smoke test:** a dev-only workflow `WF-99 · Foundation smoke test [dev]` proves the whole path end to end. It starts a run, launches one approved Apify actor asynchronously with an ad-hoc webhook, then WF-19 ingests, logs the cost and finishes the run. Error routing and the forged and retried callback paths are proven too.
- **Repo:** every workflow is exported to `n8n/workflows/`, and `n8n/README.md` documents the conventions.

## 2. Context you need

- **Orchestration:** n8n Cloud, with queue mode and 50K workflow runs per month available (T-02). Every write goes through RPCs as `n8n_writer` (T-09). There is never a table node and never a service key.
- **Credentials** (canonical names from `docs/N8N_WORKFLOWS.md` §1.2):

  | Name | Type | Notes |
  |---|---|---|
  | `Supabase Postgres · n8n_writer · dev` / `· prod` | Postgres | Supavisor **session** pooler host, port 5432, db `postgres`, user `n8n_writer.<ref>`, SSL require, max connections 5 |
  | `Apify API` | Apify community node or Header Auth `Authorization: Bearer` | |
  | `OpenAI API` | Header Auth | Used from M07 |
  | `Vimeo token` | Header Auth `Authorization: bearer …` | |
  | `YouTube Data API key` | Query Auth `key=` | |
  | `Firecrawl` | Header Auth | Owner creates in M05 (MA-15); may be absent now |
  | `SerpAPI` | Query Auth `api_key=` | M13 (MA-24); may be absent now |
  | `Email (Resend)` | Header Auth | M13. Until then, `Email (SMTP temp)` if the owner provides one, else log-only |
  | `EMR internal secret` | Header Auth `x-emr-secret: <INTERNAL_WEBHOOK_SECRET>` | Outbound to the app |
  | `EMR webhook in · Apify` | Header Auth `x-emr-secret: <APIFY_WEBHOOK_SECRET>` | Only if option (a) in §4 below |
  | `EMR webhook in · App` | Header Auth `x-emr-secret: <N8N_WEBHOOK_SECRET>` | For WF-60 (M15) |

- **Conventions** (N8N_WORKFLOWS §1):
  - **Names:** `WF-XX · Name [dev]` / `[prod]` and `SUB · Name [env]`.
  - **Tags:** `env:dev|prod`, `layer:collector|ai|ops|sub`, `platform:<name>`.
  - **Timezone:** every workflow uses **Africa/Cairo**.
  - **Error handling:** the error workflow is `WF-90 · Error handler [env]`.
  - **Retries:** 3 tries, 5 s apart (Apify/OpenAI 429: 30 s).
  - **Timeouts:** HTTP 60 s; workflow timeout 15 min.
  - **Payloads:** pass IDs between workflows, not payloads.
  - **Sub-workflows:** called once per run, never per account or item.
  - **Config:** a `Config` Set node (`env`, `app_url`, `webhook_base`), or Variables `EMR_ENV`, `EMR_APP_URL`, `EMR_N8N_WEBHOOK_BASE` if the plan has them.
- **The Apify pattern (canonical):** every actor run is **async** with an ad-hoc webhook to WF-19 at `POST {webhook_base}/webhook/emr-apify-callback`. The default verification is option (b):
  1. WF-19 re-fetches the run, `GET https://api.apify.com/v2/actor-runs/{id}`, with the Apify credential.
  2. It checks that `ops.get_apify_run(id)` exists and is unprocessed.

  So a forged callback can't inject data, and no secret is needed in the payload. The collector starts the run with:
  ```
  POST https://api.apify.com/v2/acts/{owner~name}/runs?memory=1024&timeout=3600&webhooks={base64(JSON)}
  ```
  The webhook JSON carries `eventTypes` `ACTOR.RUN.SUCCEEDED`, `.FAILED`, `.TIMED_OUT` and `.ABORTED`, a `requestUrl`, and this `payloadTemplate`:
  ```
  {"eventType": {{eventType}}, "resource": {{resource}}, "emr": {run_id, platform, result_type, purpose, env, account_ids}}
  ```
  Then the collector calls `ops.register_apify_run(...)`.
- **Normalizers:** canonical plain-JS files in `n8n/normalizers/<actor>.js` + `_common.js`. Fixtures go in `n8n/normalizers/fixtures/<actor>/`, tests in `n8n/normalizers/normalizers.test.ts` (root Vitest, set up in M00). The Code nodes paste the same code.
- **Schedules** (N8N_WORKFLOWS §2, Cairo time; all in WF-00's Schedule Trigger):

  | Time | Days | Slot | Calls |
  |---|---|---|---|
  | 01:00 | daily | `web_map` | WF-21 |
  | 02:00 | daily | `vimeo` | WF-10 |
  | 02:30 | daily | `ig_posts` | WF-11 posts |
  | 03:00 | daily | `ig_reels` | WF-11 reels |
  | 03:30 | daily | `youtube` | WF-13 |
  | 04:00 | daily | `li_posts` | WF-18 |
  | 04:00 | Sat | `removal` | WF-40 |
  | 05:00 | Sun | `li_employees` | WF-18b |
  | 06:00 | daily | `stories_am` | WF-12 |
  | 06:30 | daily | `linker` | WF-32 |
  | 07:00 | Sun | `news` | WF-22 → WF-23 at 07:30 |
  | 08:00 | Mon | `briefs` | WF-50 |
  | 09:00 | daily | `digest` | WF-80 |
  | 09:15 | daily | `health` | WF-91 |
  | 18:00 | daily | `stories_pm` | WF-12, if `stories_twice_daily` |
  | hourly 10:00–23:00 | rule disabled until M04 (enabled in prod in M04–M06 after MA-14/MA-15 approval, again in M15) | `backfill_wave` | collectors in backfill mode, `limit: 10` per platform per slot |

  Own-schedule exceptions (N8N_WORKFLOWS §2): WF-30 every 30 min (M07), WF-31 every 2 h (M06), WF-33 hourly + weekly (M07). WF-32 is scheduled by WF-00.
- **Executions budget** (N8N_WORKFLOWS §3): about 160/day in the pilot and about 181/day at full scale (≈ 4.8–5.4K of 50K a month), plus about 150/day temporarily during backfill weeks.
- **Removed:** WF-20 (ad libraries), WF-14 to WF-17 (other platforms) and LinkedIn jobs. Do not build them.
- **Budget:** `ops.settings.daily_budget_usd`. Default USD 150/day on backfill days and USD 25/day after (SCRAPING_SOURCES §8, OPEN_QUESTIONS Q-07). The owner confirms (MA-13).

## 3. Prerequisites

| Item | Needed when |
|---|---|
| M02 Done (pilot accounts seeded and active, `test_accounts.csv` handles present) | Start |
| M01 pooler URL for `n8n_writer` on dev + its password (owner) | T3 |
| **MA-10**: Apify plan tier confirmed + API token | T3, T4 |
| **MA-11**: n8n credentials created + Codex's n8n MCP/API access | T2, T3 |
| **MA-12**: OpenAI project key with a budget limit (stored now, used in M07) | T3 |
| **MA-13**: daily budget USD | T4 |
| Fixed monthly fees: n8n plan, Supabase Pro × 2, Vercel plan | Reporting deferred by the owner; unknown amounts stay unknown and do not block M03 |

## 4. Scope

**In:**
- Plan verification.
- MCP/API access.
- Credentials.
- The M03 RPCs (migration + tests) and price book/settings values.
- The SUB workflows.
- WF-00 (with stubs), WF-19, WF-90 and WF-91.
- The WF-99 smoke test (dev only).
- Exports and `n8n/README.md`.

**Out:**
- Real collectors (M04–M06).
- AI workflows (M07).
- The linker (M08).
- WF-70 publish (M09).
- WF-80 alerts beyond a stub, and the real email provider (M13).
- Prod workflow copies and activating schedules (M08).
- WF-60 (M15).

## 5. References

- `docs/N8N_WORKFLOWS.md`: §1 conventions/credentials, §2 schedule, §3 executions budget, §4 Apify pattern, §5 SUB workflows, §6 WF-00/WF-19/WF-90/WF-91 specs, §7 normalizer helpers, §8 RPC list.
- `docs/DATA_SCHEMA.md` §5 (RPC catalog), `reference/sql/004_rpc_pipeline.sql` (signatures + sketches), `reference/sql/002_core_tables.sql` (`ops.*` tables), `reference/sql/006_seed_taxonomies_settings.sql` (price book).
- `docs/SCRAPING_SOURCES.md` §0 (sources), §4.2 (website-content-crawler input, used by the smoke test), §8 (cost estimates), §9 (health checks).
- `docs/TECHNICAL.md` §5.7 (Apify run pattern), §6 (n8n design), §13 (observability and cost).
- `docs/ENVIRONMENT.md` §2 (n8n credentials and variables).
- `reference/apify_actor_research_2026-10-17.md` (prices for the price book).

## 6. Deliverables

| Path / object | What |
|---|---|
| `supabase/migrations/<ts>_rpc_n8n_foundation.sql` | The 11 RPCs + grants to `n8n_writer` |
| `supabase/migrations/<ts>_price_book_plan.sql` | Real price-book rows (new `valid_from`) + fixed monthly fees + `daily_budget_usd` |
| `supabase/tests/10_n8n_foundation.test.sql` | pgTAP for the new RPCs |
| n8n (dev) | `SUB · Start run [dev]`, `SUB · Finish run [dev]`, `SUB · Ingest items [dev]`, `SUB · Log cost [dev]`, `SUB · Notify [dev]`, `WF-90 · Error handler [dev]`, `WF-19 · Apify run callback [dev]`, `WF-91 · Health & cost [dev]`, `WF-00 · Orchestrator [dev]` (inactive), stubs `WF-10/11/12/13/18/18b/21/22/23/30/32/40/50/70/80 [dev]`, `WF-99 · Foundation smoke test [dev]` |
| `n8n/workflows/*.json` | Exports (credential references only, no secrets), file names `WF-XX-<slug>.json`, `SUB-<slug>.json` |
| `n8n/normalizers/smoke_website_stub.js` | Minimal normalizer for the smoke test (crawler output → one `project_page` item) |
| `n8n/README.md` | Conventions, credential names, import order (SUBs → WF-90 → collectors → WF-00), export steps, dev/prod handling, Postgres query style (schema-qualified, `$1` params), the Apify async pattern, verification option chosen |
| `n8n/tests/README.md` + `scripts/assert/m03_smoke_setup.sql`, `m03_smoke.sql`, `m03_smoke_teardown.sql` | How to run the smoke test; C999 test account setup/teardown; SQL assertions |
| PROGRESS.md | Plan facts, executions estimate, verification option chosen |

## 7. Tasks

### T1: Verify the n8n Cloud plan facts
Check the owner's plan and record each answer, with a source link or screenshot path, in PROGRESS:
1. The maximum execution timeout per workflow (our design keeps executions under 10 minutes; workflow timeout setting 15 min).
2. Whether sub-workflow executions count against the monthly quota.
3. Whether Variables (`$vars`) are available.
4. Whether the verified community node `@apify/n8n-nodes-apify` can be installed. If not, use HTTP Request to `https://api.apify.com/v2`.
5. Whether the Postgres node supports query parameters (`$1`, `$2` via "Query Parameters").

Also record the n8n version and instance URL. Never record the API key.

**Done when:** all five are answered in PROGRESS.

### T2: n8n MCP/API access + repo conventions (needs MA-11)
1. Confirm Codex's connection. Through the owner-configured n8n MCP server (or the n8n public API with an owner-issued API key, held in Codex's MCP config, never committed), list workflows and credentials.
2. Note which MCP tool set is available (create/update/activate/execute/export). If it only supports search/execute, use the n8n public REST API (`/api/v1/workflows`) for create/update, and document it.
3. Write `n8n/README.md` with the conventions from §2: names, tags, timezone, error workflow, retries, timeouts, Config node/Variables, schema-qualified SQL with params, export procedure, import order, and "never put secrets in Set/Code nodes".

**Done when:** Codex can create an empty test workflow in dev and delete it again.

### T3: Credentials (MA-10, MA-11, MA-12)
1. Reuse the existing credentials by ID and compatible actual type, as recorded in `docs/DECISIONS.md`. Do not recreate, rename, duplicate or rotate shared credentials because a display name differs. `Firecrawl`, `SerpAPI` and `Email (Resend)` belong to later milestones.
2. Preserve completed bounded metadata checks and actual restricted-role identity receipts. Verify only genuinely changed or unused required bindings through supported native operations; record saved configuration separately from endpoint success. Use the approved restricted strict-TLS RPC transport. The native Postgres-node certificate-chain failure remains historical; do not disable SSL, enable Ignore SSL Issues or substitute an administrator login. Do not start an actor or inference as a credential test.
3. Decide on the Apify callback verification and record it:
   - **(b) re-fetch run + registered-run check** is the default;
   - **(a) secret header** only if Variables exist and the owner wants both.
4. Config: create Variables if available, otherwise use the `Config` Set node pattern (`env = dev`, `app_url = <Vercel preview or placeholder>`, `webhook_base = <n8n instance base URL>`).

**Done when:** the dev path used by the functional checks authenticates with the intended restricted identity and compatible bindings; unused later-milestone integrations are explicitly deferred. No secret values are recorded.

### T4: Migration: M03 RPCs + price book (needs MA-10, MA-13, fixed fees)
Create `supabase migration new rpc_n8n_foundation`. Every function is `security definer`, `set search_path = ''`, fully qualified, with `revoke … from public` and `grant execute … to n8n_writer`:

```sql
-- costs
ops.log_cost(p_entries jsonb) returns int
  -- jsonb array of {provider, category, quantity, unit, cost_usd, run_id?, competitor_id?, platform?, item_id?, meta?, day?}
  -- inserts into ops.cost_ledger (day defaults to current_date in Africa/Cairo); validates provider
  -- against the check constraint; returns rows inserted

-- Apify runs
ops.register_apify_run(p_apify_run_id text, p_actor_id text, p_run_id uuid, p_account_ids uuid[], p_purpose text) returns void
  -- insert … on conflict (apify_run_id) do nothing
ops.complete_apify_run(p_apify_run_id text, p_status text, p_dataset_id text, p_usage_usd numeric) returns jsonb
  -- sets status, dataset_id, usage_usd, finished_at = now(), processed_at = now() ONLY if processed_at is null;
  -- returns {updated: bool, row: {...}} so WF-19 can drop retries
ops.get_apify_run(p_apify_run_id text) returns jsonb
  -- the registered row or null
ops.apify_runs_pending(p_run_id uuid) returns int
  -- registered runs for this scrape run with processed_at is null

-- settings / prices
ops.get_setting(p_key text) returns jsonb
ops.get_price_book() returns jsonb
  -- latest valid_from per (provider, sku): {"apify/instagram-scraper:result": {"unit": "1k results", "usd": 2.30}, …}

-- errors
ops.log_workflow_error(p jsonb) returns void
  -- p = {kind: 'error'|'notify', workflow, execution_id, node, message, stack, run_id?, meta?}
  -- inserts ops.audit_log (actor_type 'n8n', action 'workflow_error' | 'notify_logged', entity_type 'workflow',
  --   entity_id = workflow, after = p)
  -- if kind = 'error' and run_id is present and that run is 'running' → status 'failed', finished_at now(), error = message
ops.error_count_24h(p_workflow text) returns int
  -- count of audit_log workflow_error rows for that workflow in the last 24h

-- health
ops.accrue_fixed_costs(p_day date) returns int
  -- for each latest price_book row with unit = 'month' (providers n8n, supabase, vercel):
  --   insert cost_ledger(day = p_day, provider, category 'fixed_fee', quantity 1, unit 'day',
  --     cost_usd = usd_per_unit / days_in_month(p_day), meta {sku})
  --   only if no row exists for (p_day, provider, meta->>'sku') → idempotent
ops.daily_health() returns jsonb
  -- { failing_accounts: [{account_id, competitor, platform, handle, last_error, consecutive_failures}],
  --   stale_accounts: [... active, backfill done/not_applicable, last_success_at older than 48h (cadence 1 day) or 9 days (cadence 7 days)],
  --   queues: {ai_extract, embed, media} queue lengths via pgmq.metrics(),
  --   items_new_yesterday: {platform: count} (app.items.first_seen_at in yesterday, Cairo),
  --   cost_yesterday: {total, by_provider},
  --   budget: {daily_budget_usd, over_budget: bool},
  --   month_to_date_usd, forecast_month_usd (mtd / days_elapsed × days_in_month),
  --   workflow_errors_24h: {workflow: count} }
```

Then:
1. Create `supabase migration new price_book_plan`.
   - Insert rows with today's `valid_from` for the owner's Apify tier. Use the prices from `reference/apify_actor_research_2026-10-17.md`; budget dltik at $2/1k.
   - Add `('n8n','plan','month',<fee>)`, `('supabase','pro','month',<fee × 2 projects>)` and `('vercel','plan','month',<fee>)`.
   - Update `ops.settings.daily_budget_usd` (MA-13).
   - `stats_daily_enabled` (false) is already seeded in M01 — do not insert it again (if you must, use `on conflict (key) do nothing`).
2. Write pgTAP `supabase/tests/10_n8n_foundation.test.sql`:
   - `log_cost` inserts N rows;
   - `register_apify_run` is idempotent;
   - `complete_apify_run` returns `updated = true` once, then `false`;
   - `apify_runs_pending` counts down;
   - `get_setting('auto_publish_threshold')` returns `0.80`;
   - `get_price_book` has the instagram-scraper key;
   - `log_workflow_error` marks a running run failed;
   - `error_count_24h` counts;
   - `accrue_fixed_costs` is idempotent (second call → 0);
   - `daily_health` returns all keys;
   - `n8n_writer` can execute every function and still cannot `select` from `ops.cost_ledger`.
3. `supabase db push` (dev), advisors, regenerate types.

**Done when:** `supabase test db` passes and the dev push succeeds.

### T5: Shared sub-workflows (dev)
Follow N8N_WORKFLOWS §5 exactly. Each uses an Execute Workflow Trigger ("Define using fields") and returns one item.

1. **`SUB · Start run`**
   - Inputs: `workflow`, `platform`, `mode`, `env`.
   - Postgres: `select ops.start_run($1, $2::app.platform, $3, $4, $5) as run_id;` with `[workflow, platform, mode, env, $execution.id]`. For a null platform, pass `null` and cast it.
   - Returns `{run_id}`.
2. **`SUB · Finish run`**
   - Inputs: `run_id`, `status`, `error`.
   - Postgres: `select ops.finish_run($1::uuid, $2, $3) as r;`, which returns jsonb with the totals.
   - Then, without waiting:
     - if `r.items_new > 0`, call WF-30 (a stub until M07);
     - if the status isn't `failed` and there are new items, call WF-70 (a stub until M09).
   - Returns `r`.
3. **`SUB · Ingest items`**
   - Inputs: `run_id`, `groups[]` (`{account_id, items[], status, error, backfill_done, backfill_cursor}`).
   - First, a validation Code node: drop items missing `external_id`, `url` or `platform`. If more than 20% of a group is dropped, set that group to `failed` with `contract_drift: <sample keys>`.
   - Then Loop Over Items, per group:
     - chunks of 500: `select ingest.upsert_raw_items($1::uuid, $2::uuid, $3::jsonb) as r;`
     - then `select ops.report_account_result($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb);`
   - Returns `{items_seen, items_new, accounts_ok, accounts_failed}`.
4. **`SUB · Log cost`**
   - Inputs: `entries[]`.
   - Postgres: `select ops.log_cost($1::jsonb);`.
5. **`SUB · Notify`**
   - Inputs: `to[]`, `subject`, `html`, `text`.
   - Until M13 it runs in **mode `log`**: it calls `ops.log_workflow_error({kind:'notify', …})` (an audit row) and, if a temporary SMTP credential `Email (SMTP temp)` exists, also sends with the n8n Send Email node.
   - The mode lives in Config/Variables (`notify_mode = log|smtp|resend`). M13 switches it to Resend.

Each SUB sets WF-90 as its error workflow.

**Done when:** each SUB passes a manual test run in dev, and the audit and run rows show up in SQL.

### T6: WF-90 · Error handler (dev)
1. Error Trigger → Code builds `{kind:'error', workflow, execution_id, node, message, stack (2 KB), mode, run_id}`. The `run_id` comes from the failed execution's data when available; collectors put it in the execution's custom data via "Execution Data" node `run_id`.
2. Postgres `ops.log_workflow_error($1::jsonb)`.
3. Postgres `ops.error_count_24h($1)`. If the count is ≥ 3, AND no email has gone out for this workflow in the last 6 h (track it via a `notify` audit row lookup inside `error_count_24h` or a second RPC param, and document which you chose), send `SUB · Notify` to `mohamed.abdelrahman@everyone.film` with subject `[Market Radar] <workflow> failing`.
4. Set WF-90 as the error workflow on every other workflow, but not on itself.

**Done when:** a forced error (`WF-99` branch "force error") writes an audit row; the third forced error produces exactly one notify, and the fourth within 6 h produces none.

### T7: WF-19 · Apify run callback (dev)
Build N8N_WORKFLOWS §6 WF-19:
1. Webhook `POST /webhook/emr-apify-callback`, responding immediately with 200.
2. Parse `eventType`, `resource.id`, `resource.defaultDatasetId`, `resource.actId`, `resource.usageTotalUsd`, `resource.status` and `emr`.
3. **Verify:**
   - `GET https://api.apify.com/v2/actor-runs/{id}` (Apify credential) must exist and be final;
   - `ops.get_apify_run(id)` must exist with `processed_at` null.

   Otherwise call `ops.log_workflow_error({kind:'error', message:'apify_callback_rejected', meta:{reason, id}})` and stop.
4. `ops.complete_apify_run(id, status, datasetId, usageTotalUsd)`. If `updated = false`, it is a retry: stop.
5. If the status isn't `SUCCEEDED`, call `report_account_result(..., 'failed', 0, 0, 'apify_<status>')` for each `emr.account_ids`, then go to step 8.
6. Page `GET /v2/datasets/{datasetId}/items?clean=true&format=json&offset=o&limit=1000` until a page returns fewer than 1,000 items.
7. Switch on `emr.platform` + actor:
   - **in M03, only one branch:** `website_work_page` + `apify/website-content-crawler` → the Code node `smoke_website_stub.js`;
   - **default branch:** fail the run with `unsupported_platform`.

   Then group by account and call `SUB · Ingest items`. M04–M06 add the real branches.
8. `SUB · Log cost`: provider `apify`, category `scrape`, `cost_usd = usageTotalUsd` split evenly per account, `meta = {actor, apify_run_id}`.
9. `ops.apify_runs_pending(run_id)`. If it is 0, call `SUB · Finish run` with `success`, or `partial` if any account failed.

**Done when:** the T9 smoke tests pass.

### T8: WF-00 · Orchestrator + collector stubs (dev, inactive)
1. Create stubs for WF-10, WF-11, WF-12, WF-13, WF-18, WF-18b, WF-21, WF-22, WF-23, WF-30, WF-32, WF-40, WF-50, WF-70 and WF-80 (WF-30 and WF-70 are called by `SUB · Finish run` and WF-91). Each has:
   - an Execute Workflow Trigger with inputs `mode`, `limit`, `result_type`, `env`;
   - a Manual Trigger;
   - a Set node returning `{stub: true, workflow: 'WF-xx', received: $json}`;
   - tags and the error workflow set.

   The stubs keep the final names, so M04+ replaces their bodies.
2. Build WF-00:
   - a Schedule Trigger with one rule per slot in §2 (Cairo timezone). The `backfill_wave` rule exists but is **disabled**.
   - **Config** node.
   - Code node "Which slot?", which maps the trigger timestamp (hour/minute/weekday) to the slot key. It also accepts a manual input `slot_override` for tests.
   - A Switch → Execute Workflow per slot ("don't wait for completion"), with inputs as in §6 WF-00:
     - `ig_posts` → WF-11 `{mode:'daily', result_type:'posts', limit:500}`;
     - `ig_reels` → WF-11 `{result_type:'reels'}`;
     - `stories_pm` → `ops.get_setting('stories_twice_daily')` → IF true → WF-12;
     - `news` → WF-22, then WF-23;
     - `health` → WF-91;
     - and so on.
3. Keep WF-00 **inactive** in M03. It is activated in M08 for prod.

**Done when:** a manual run with each `slot_override` value dispatches exactly the right stub (check the executions list), and an unknown slot does nothing and is logged.

### T9: WF-91 · Health & cost + WF-99 smoke test (dev)
1. **WF-91** (Execute Workflow Trigger + Manual Trigger; scheduled through WF-00's `health` slot):
   1. `ops.accrue_fixed_costs(current_date - 1)`.
   2. The `ops.refresh_stats_daily(...)` call **behind an IF on `ops.get_setting('stats_daily_enabled')`**. The function arrives in M10, so add the setting with `false` in the T4 migration.
   3. `ops.daily_health()`.
   4. If `budget.over_budget`, call WF-80 `{kind:'budget'}` (a stub until M13).
   5. If there are failing accounts, call WF-80 `{kind:'failing_sources'}`.
   6. `SUB · Notify`: a short daily health summary to the owner (log mode until M13).
   7. WF-70 `{tags:['stats']}` (a stub).
2. **WF-99 · Foundation smoke test [dev]** (Manual Trigger, dev only, never copied to prod):
   1. `SUB · Start run` `{workflow:'WF-99', platform:'website_work_page', mode:'manual', env:'dev'}`.
   2. **Test account, never a real one.** Before the run, `scripts/assert/m03_smoke_setup.sql` (dev only) upserts a dedicated test competitor **`C999` · `emr-smoke-test`** (tier `adjacent`, status `active`) with one `website_work_page` account for `https://everyone.film/about-everyone` (our own public site; a different URL from the baseline's work page, so no handle clash), `backfill_status = 'pending'`, and returns its `account_id`. WF-99 takes that `account_id` from its Manual Trigger input — it does **not** call `get_due_accounts`, so no seeded pilot or baseline account is claimed or changed (the claim logic is covered by pgTAP in M01). After the test, `scripts/assert/m03_smoke_teardown.sql` sets `C999` to `status = 'archived'` and its account to `paused` (dev only; never copy C999 to prod).
   3. Start an async Apify run of **`apify/website-content-crawler`** (an approved actor) with the §2 webhook pattern and this input:
      ```json
      {"startUrls":[{"url":"https://everyone.film/about-everyone"}],"crawlerType":"cheerio","maxCrawlDepth":0,"maxCrawlPages":1,"saveMarkdown":true,"proxyConfiguration":{"useApifyProxy":true}}
      ```
   4. `ops.register_apify_run(...)`, then wait for WF-19.
   5. A separate branch "force error" throws on purpose (for T6).
   6. `n8n/normalizers/smoke_website_stub.js` maps a crawler row to one item: `platform 'website_work_page'`, `external_id` = the first 32 hex characters of sha256(canonical URL) — the same rule M05 uses for website pages, `item_type 'project_page'`, `url`, `published_at` null, `title` = `metadata.title`, `caption` = `markdown` (trimmed to 8k), `payload`. Add a Vitest case with a fixture saved from this first run in `n8n/normalizers/fixtures/website-content-crawler/`.
3. **Callback tests** (scripted with `curl` against the dev webhook):
   1. A POST with an unknown run ID is rejected (audit row `apify_callback_rejected`); no items.
   2. Replaying the real callback body gives `complete_apify_run.updated = false`; no new items, no second cost row.
4. Paste the results of `scripts/assert/m03_smoke.sql` into PROGRESS:
   ```sql
   select status, items_new, cost_usd from ops.scrape_runs where workflow = 'WF-99' order by started_at desc limit 1;  -- success, 1, > 0
   select count(*) from ops.scrape_run_accounts r join ops.scrape_runs s on s.id = r.run_id where s.workflow='WF-99';  -- ≥ 1
   select count(*) from ops.cost_ledger where provider='apify' and meta->>'actor' like '%website-content-crawler%';  -- ≥ 1
   select count(*) from ops.apify_runs where processed_at is not null;  -- ≥ 1
   select count(*) from app.items where platform='website_work_page';  -- 1 after the first run, still 1 after a re-run (idempotent)
   ```

**Done when:** all assertions hold. Re-running WF-99 creates no new item: same URL hash, so `inserted = 0`.

Clean-up: the smoke item stays in dev and is queued for AI. That's fine; M07 processes it, and it is our own site.

### T10: Export, document, hand-off
1. Export every dev workflow to `n8n/workflows/` (`SUB-start-run.json`, `WF-00-orchestrator.json`, `WF-19-apify-callback.json`, `WF-90-error-handler.json`, `WF-91-health-cost.json`, the stubs, and `WF-99-smoke-test.json`). Check that no secret values are inside: `grep -iE 'bearer [a-z0-9]|apify_api_|sk-' n8n/workflows/*.json` → nothing.
2. Record the executions/day estimate in PROGRESS (pilot ≈ 160/day, full ≈ 181/day, backfill +≈ 150/day) and adjust it using T1 fact 2.
3. Update `docs/N8N_WORKFLOWS.md` and `docs/DATA_SCHEMA.md` §5 for any deviation, plus DECISIONS → Changes if needed.
4. Fill in the hand-off and update the root board.

## 8. Interfaces & contracts touched

| Contract | Detail |
|---|---|
| Webhook | `POST {webhook_base}/webhook/emr-apify-callback`; body from the Apify `payloadTemplate`: `{eventType, resource, emr:{run_id, platform, result_type, purpose, env, account_ids[]}}` |
| SUB inputs/outputs | As in T5. Collectors from M04 call `SUB · Start run` → (start Apify runs or call APIs) → `SUB · Ingest items` → `SUB · Log cost` → `SUB · Finish run` |
| RPCs added | The 11 functions in T4 (signatures above) + setting `stats_daily_enabled = false` |
| Cost ledger entry | `{provider, category, quantity, unit, cost_usd, run_id, competitor_id?, platform?, item_id?, meta}` |
| Error payload | `{kind:'error'\|'notify', workflow, execution_id, node, message, stack, run_id?, meta?}` |
| Config | `env`, `app_url`, `webhook_base`, `notify_mode` (Variables `EMR_ENV`, `EMR_APP_URL`, `EMR_N8N_WEBHOOK_BASE`, `EMR_NOTIFY_MODE` if available) |
| Env names (for the app, later) | `N8N_WEBHOOK_BASE`, `N8N_WEBHOOK_SECRET`, `INTERNAL_WEBHOOK_SECRET`, `APIFY_WEBHOOK_SECRET` (only if option a) |

## 9. Acceptance criteria

The owner's [25 October functional-acceptance decision](../../docs/DECISIONS.md#m03-functional-acceptance-and-bounded-parallel-delivery--approved-25-october-2026)
sets the current M03 closure checklist:

1. **Correct dev target and restricted access.** Verify the intended dev project,
   strict TLS and the actual least-privilege path; no administrator credential in
   application or n8n runtime.
2. **One real asynchronous collection-to-callback-to-database completion.** An
   approved public-source run completes through WF-19 and persists its run/item.
3. **Duplicate/replay and cost correctness.** Repeated content does not duplicate
   the item; callback replay does not duplicate completion or cost. Actual
   provider usage and legitimate separate run costs are recorded accurately.
4. **Invalid-callback and error handling.** Reject an unknown/unowned run with
   the rejection audit and no ingestion/cost side effects; preserve the verified
   automatic error routing and cooldown behavior.
5. **Safe stopping and documented test-data retention.** Stop admissions and
   recurring activity, reconcile owned work and resources, and document retained
   native records and C999 disposition. Unresolved work is not called settled,
   restored settings are not erasure, and collected data is not deleted.
6. **Required CI, workflow exports, and review.** Keep required tests and branch
   protection, sanitized exports and independent review. Distinguish local,
   native/manual, CI and hosted evidence; present the separate merge decision.

This is the one-time mapping of the original AC1–AC12. Historical tests and
receipts remain unchanged. Replaced/deferred requirements are not marked passed.
Task details elsewhere remain implementation references; this section controls
closure where earlier name-specific or exhaustive-verifier wording conflicts.

| Original AC | Functional check | Treatment and verified/pending boundary at b51 |
|---|---|---|
| AC1 — plan facts | 6 | **Retain; complete.** The five runtime/plan facts, 50K allowance and existing estimate are recorded. No renewed billing investigation. |
| AC2 — credentials work | 1 | **Replace the native-node/name-specific gate.** Reuse actual credential IDs/types and the approved restricted strict-TLS RPC path. Direct Writer/gateway identity and four provider metadata checks are verified; the native Postgres-node TLS failure is preserved. No model inference test is required in M03. |
| AC3 — tested RPCs/advisors | 1, 3 | **Retain.** Existing database tests/advisor/type evidence keep their dates and scope; actual22 confirms all15 migration versions and catalog/RLS/grants, with no replay. Any new security or integrity defect remains blocking. |
| AC4 — prices/budget/fixed fees | 3 | **Retain variable prices, actual usage and the USD25 alert default; defer fixed subscription-fee completeness.** Unknown fees stay unknown, not zero. |
| AC5 — end-to-end smoke | 2 | **Retain; pending and blocking.** No real actor/callback/item/cost completion has run; actors remain0. |
| AC6 — repeated run/callback | 3 | **Retain; hosted proof pending.** Local idempotency/cost/recovery tests are preserved. Require actual item-count no-op and no duplicate callback completion/cost; legitimate separate runs keep their own costs. |
| AC7 — forged callback | 4 | **Retain; hosted proof pending.** Require `apify_callback_rejected` and zero ingestion/cost effects. The separate WF99 domain denial is not this proof. |
| AC8 — automatic error routing | 4 | **Retain; actual22 passed.** All four automatic error/cooldown groups31136–31144 settled and were cleaned. Preserve log-only Notify; external email remains deferred to its milestone/approval. |
| AC9 — every hosted stub slot | 2, 6 | **Replace exhaustive native stub execution as an M03 closure gate.** Representative Vimeo parent/child31134/31135 passed. Keep the full local slot/unknown-slot contracts, inactive WF-00 and disabled schedules; collector-specific live matrices belong to their collector milestones. The original every-slot hosted requirement is replaced, not passed. |
| AC10 — native health/fixed accrual | 3, 5 | **Replace standalone WF91 execution with existing health contracts and final operational readback; defer positive hosted fixed-fee accrual while fees are unknown.** Keep local health/accrual/idempotency tests; do not claim a positive fee accrual from an empty/no-row result. |
| AC11 — clean exports | 6 | **Retain.** All25 actual restored versions/graphs are pinned. Require final sanitized exports, required CI and review at the delivery head; fixture/source checks alone do not establish live behavior. |
| AC12 — daily estimate | 6 | **Retain; complete.** Existing conservative160/day pilot and181/day full estimates remain below200/day; cumulative test allowances are separate and unchanged. |

Current results are in the [existing recovery/evidence record](evidence/dev-acceptance-fixture-gap-correction-20261024.md).
The next functional outcome is the one-page asynchronous smoke, actual callback
completion, replay and invalid-callback proof, using existing helpers/native
evidence. Count the remaining operations and shutdown before admission; the old
whole-batch plan is superseded by the approved smaller-sequence allocation:
Management2048/Vercel352, retaining1661/1464/3125/V288 and all other caps.
The [factored estimate](evidence/dev-acceptance-fixture-gap-correction-20261024.md#complete-smaller-functional-allowance--approved-25-october-2026)
includes recovery and shutdown; accepted groups and retained31145 are not rerun.
Do not reopen the closed seventh SQL window or reset prior counters. Freeze
custom-supervisor expansion; after two failed repairs of the same testing-tool
defect, use a supported alternative or report one precise boundary. Enforced
blocks remain binding and unperformed checks stay unperformed.

## 10. Tests to write

- `supabase/tests/10_n8n_foundation.test.sql` (pgTAP, T4).
- `n8n/normalizers/normalizers.test.ts`: add `smoke_website_stub` against `fixtures/website-content-crawler/everyone-about-everyone.json`.
- `scripts/assert/m03_smoke.sql` (manual, results pasted).
- `n8n/tests/README.md`: the step list for the WF-99, forged-callback, replay and forced-error tests.

## 11. Manual actions from the owner

| MA | What | When | How Codex verifies |
|---|---|---|---|
| MA-10 | Existing Apify plan/token already supplied; reuse by actual ID/type | Only a genuine revocation/access mismatch needs owner action | Preserve completed metadata/price evidence; actual actor use is a separate functional check |
| MA-11 | Existing n8n access/credentials and persistent dev originals supplied | No new handoff, name change or time renewal is requested | Use supported native stores/integrations and scoped consumers; authenticate only for the incomplete approved step |
| MA-12 | Existing OpenAI credential available; inference belongs to M07 | No M03 inference or new-key action | Preserve the bounded metadata result; do not claim it proves inference or a project spend cap |
| MA-13 | USD25/day alert default retained | No repeated billing questionnaire | Preserve the actual setting; the alert threshold is not a provider spending cap |
| (deferred) | Monthly subscription fees remain unknown where not supplied | Reporting deferred by the owner | Do not fabricate fee rows or use their absence to block M03 |
| (later) | External email/SMTP notifications | Separate later milestone/approval | M03 Notify remains log-only |

## 12. Risks & gotchas

- **Verify current docs:**
  - n8n Cloud execution limits and whether sub-workflows count;
  - the Variables availability per plan;
  - the Apify ad-hoc webhook query parameter (`webhooks` = base64 JSON) and the `payloadTemplate` variables (`{{eventType}}`, `{{resource}}`);
  - the Apify node vs HTTP;
  - the Postgres node's parameter syntax.
- **`search_path = ''`** for `n8n_writer`: every SQL in n8n must be schema-qualified, including casts (`::app.platform`) and functions (`ops.*`, `ingest.*`).
- **Supavisor session mode:** keep the n8n Postgres credential at a small max connections (5), so collectors don't exhaust the pool.
- **Webhook responds immediately.** Apify retries non-2xx responses, so process after the 200 and use `processed_at` as the replay guard.
- **No secrets in the Apify webhook payload** (option b). If option (a) is used, the secret must come from Variables or a credential-backed header, never be hard-coded in a Code node.
- **Stubs keep their final names.** Don't create v2 names later; replace the bodies.
- **Timezone:** schedule times are Cairo local, and Egypt observes DST. n8n's workflow timezone setting handles it; don't convert to UTC by hand.
- **Never activate WF-00 in M03.** Activating it with stubs would waste executions and confuse the run log.
- **The smoke test uses our own site and an approved actor only.** Don't test with arbitrary third-party sites.

## 13. Cost & budget notes

- The smoke test costs a few cents: one website-content-crawler run (cheerio, 1 page, well under $0.01 compute), plus a couple of replays (free).
- Credential tests are free.
- Fixed fees start accruing in the cost ledger from WF-91's first run. This is visibility only, not new spend.

## 14. Definition of done & hand-off

- The six current checks are verified with explicit retained/deferred dispositions from §9. Present actual evidence and the separate PR #8 merge decision; keep M03 open and the PR draft while critical checks remain incomplete. Approval of development, credentials or this checklist does not approve merge or begin M04.
- One isolated frontend/app-shell or read-only directory slice may proceed in parallel using stable contracts and labeled fixtures, with no hosted writes. It does not start M04, M09 or M10 and does not prove live ingestion.
- **M04 expects:**
  - the SUB workflows, WF-19 and WF-90 working in dev;
  - stubs WF-10 and WF-11 to replace;
  - the normalizer + fixture + Vitest pattern established;
  - the price book for cost estimates (MA-14 needs it);
  - pilot Vimeo/Instagram accounts claimable in `backfill` mode;
  - the `Vimeo token` and `Apify API` credentials working.
