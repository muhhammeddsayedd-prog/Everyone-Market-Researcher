# Environment, accounts and secrets

Where every secret lives, who creates it, and which milestone needs it. **Never commit a secret.** `.env*` files are git-ignored; `templates/.env.example` lists names only.

## 1. Accounts the owner provides

| Service | Plan | Projects / resources | Created in | Who uses it |
|---|---|---|---|---|
| GitHub | existing | `muhhammeddsayedd-prog/Everyone-Market-Researcher` | M00 | Codex (push via PR) |
| Supabase | Pro | `emr-dev`, `emr-prod` (region close to users, e.g. `eu-central-1` Frankfurt or `me-central-1` if offered) | M01 | Codex (CLI/MCP with scoped token), n8n (`n8n_writer`), Vercel (publishable key + `api_agent`) |
| Google Cloud | — | OAuth client (Supabase Google provider), API key restricted to YouTube Data API v3 | M01 / M02 | Supabase Auth, n8n |
| Vercel | Pro (recommended for team + cron-free usage) | project `everyone-market-radar` | M00 / M09 | Web app, API, MCP |
| n8n Cloud | current plan (50K runs) | one instance; workflows tagged `env:dev` / `env:prod` | M03 | Orchestration |
| Apify | plan tier to confirm (prices assume Starter) | API token | M03 | n8n |
| OpenAI | API org | project key with usage limits set | M03 / M07 | n8n, Vercel (query embeddings only) |
| SerpAPI | plan to choose (weekly ~ 300–600 searches/month at full scale) | API key | M13 | n8n |
| Firecrawl | plan to choose | API key | M05 | n8n |
| Vimeo | developer app | personal access token, scope `public` | M02 | n8n |
| Email | Resend (recommended) or Google Workspace SMTP | sending domain verified (e.g. `radar.everyone.film`) | M13 | n8n |

## 2. Variables by runtime

### Vercel (web app, API, MCP)
| Name | Public? | Value / source | Milestone |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL | M09 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_…` | M09 |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://<domain>` | M09 |
| `SUPABASE_SECRET_KEY` | **no** | `sb_secret_…`, used **only** by `/api/internal/media-upload-url` (Storage signed upload URLs) | M06 |
| `API_AGENT_DATABASE_URL` | **no** | Supavisor **transaction** pooler URL with user `api_agent.<project-ref>`, port 6543 | M14 (M09 if the shared-reader caching option is chosen) |
| `API_KEY_PEPPER` | **no** | 32+ random bytes, base64 | M11 (key creation UI) |
| `OPENAI_API_KEY` | **no** | for search-query embeddings | M11 |
| `OPENAI_MODEL_EMBED` | no | `text-embedding-3-small` | M11 |
| `INTERNAL_WEBHOOK_SECRET` | **no** | random; shared with n8n; the one secret for all internal routes (`/api/revalidate`, `/api/internal/*`) | M06 (media route) / M09 (revalidate) |
| `N8N_WEBHOOK_BASE` | **no** | n8n instance base URL (e.g. `https://<instance>.app.n8n.cloud`); WF-60 onboarding webhook path per `docs/N8N_WORKFLOWS.md` | M11 / M15 |
| `N8N_WEBHOOK_SECRET` | **no** | header value the app sends to the WF-60 onboarding webhook; WF-60 verifies it (credential `EMR webhook in · App`) | M11 / M15 |

### n8n Cloud (credentials + variables)
| Credential / variable | Type | Notes |
|---|---|---|
| `Supabase Postgres · n8n_writer · dev` / `· prod` | Postgres | Host: Supavisor **session** pooler (IPv4), port 5432, user `n8n_writer.<project-ref>`, SSL required |
| `Apify API` | Apify API (community node) or Header Auth | API token |
| `OpenAI API` | OpenAI / Header Auth | project key; models via `OPENAI_MODEL_EXTRACT`, `OPENAI_MODEL_REASON`, `OPENAI_MODEL_BRIEF`, `OPENAI_MODEL_EMBED` (n8n Variables or CONFIG node) |
| `SerpAPI` | Query/Header auth | |
| `Firecrawl` | Header Auth (`Authorization: Bearer`) | |
| `Vimeo token` | Header Auth (`Authorization: bearer <token>`) | |
| `YouTube Data API key` | Query Auth (`key=`) | key restricted to YouTube Data API v3 |
| `Email (Resend)` | Resend Header Auth (or SMTP) | |
| `EMR internal secret` | Header Auth | `x-emr-secret: <INTERNAL_WEBHOOK_SECRET>` for calls to Vercel internal routes and revalidate |
| `EMR webhook in · Apify` / `EMR webhook in · App` | Header Auth (webhook nodes) | verify inbound calls to WF-19 / WF-60 |
| Variables (if plan supports) or a `CONFIG` Set node | `EMR_ENV` (dev|prod), `EMR_APP_URL`, `EMR_N8N_WEBHOOK_BASE`, `APIFY_WEBHOOK_SECRET` (optional; WF-19 checks it when set, otherwise verifies callbacks by re-fetching the run from the Apify API), `ALERT_FALLBACK_EMAIL=mohamed.abdelrahman@everyone.film`, model names `OPENAI_MODEL_*`; set each workflow's timezone to Africa/Cairo | |

### Codex workstation / CI
| Name | Where | Notes |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Codex env + GitHub Actions secret | **Scoped** personal access token (dev project; prod only when the owner allows) |
| `SUPABASE_DB_PASSWORD_DEV` / `_PROD` | local only | for `supabase db push` |
| `SUPABASE_PROJECT_REF_DEV` / `_PROD` | repo variable | not secret |
| `SEED_DATABASE_URL` | local only | owner/postgres connection for `scripts/seed-*.ts` |
| `N8N_API_KEY` / n8n MCP config | Codex MCP config | to create/update workflows |
| `VERCEL_TOKEN` | optional | only if Codex deploys via CLI |

## 3. Generating secrets

```bash
openssl rand -base64 48   # API_KEY_PEPPER, INTERNAL_WEBHOOK_SECRET, N8N_WEBHOOK_SECRET
```
Role passwords (`n8n_writer`, `api_agent`): `openssl rand -base64 32 | tr -d '/+=' | cut -c1-32`. The owner runs `alter role … password '…'` in the SQL editor of each project (M01 manual action) and stores them only in n8n/Vercel.

## 4. Rotation

- Rotate the API key pepper only together with re-issuing all agent keys.
- Rotate role passwords every 6 months or on staff change (update n8n credential + Vercel env, then `alter role`).
- Revoke OpenAI/Apify/SerpAPI keys from their dashboards if leaked; the cost ledger + daily budget alert surfaces anomalies.
