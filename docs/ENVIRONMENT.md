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

### Persistent development access — current policy, 23 October 2026

The owner's development-autonomy reset replaces the earlier per-attempt secret
delivery requirement. Reuse supported native GitHub/Vercel/MCP authentication
and existing n8n credentials by actual ID/type. Do not extract n8n provider
secrets or search unrelated stores. Four local approved dev inputs use the
existing CurrentUser-DPAPI code at
`%LOCALAPPDATA%\Everyone-Market-Radar-Private\secrets\dev\`: emr-dev postgres
password, emr-dev `n8n_writer` password, existing n8n Management key, and same-owner
Apify READ token. Filesystem access is limited to the intended Windows user and
SYSTEM. This protects at rest; it does not isolate the files from every program
running as that same user. Production and private-incident credentials stay out.

The one initialization/update interface is the existing helper:

```powershell
& 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03AcceptanceHandoff.ps1' -Action Initialize -Kind All
```

It imports compatible purpose-approved dev handoffs when available, then prompts
only for genuinely missing entries, in order: Admin, Management, Writer, ApifyRead.
Use saved existing values; do not reset or create credentials. The expected
success marker is `M03_DEV_ACCESS_READY`; this establishes local encrypted
storage, not endpoint authentication. `-Action Status -Kind All` reports only
entry names/presence and missing names. To replace an actually revoked/expired
entry, use `-Action Update -Kind Admin|Management|Writer|ApifyRead` with one actual
kind, through its hidden prompt. It does not reset or rotate the provider value.

Encrypted originals persist across attempts and sessions without an artificial
two-hour expiry. The existing coordinator automatically creates only its required
disposable runtime copies after readiness gates, and deletes those copies/private
scratch after child closure. It never deletes the persistent source entries.
Admin remains in the bounded database child, never n8n/web runtime; runtime
children receive only task-required inputs. Existing Machine ciphertext is reused
without regeneration. No environment/secret dump, print-secret operation, raw
credential-bearing error, build/install/test exposure or password in arguments.
Actual expiry/revocation/MFA and enforced tool policies remain real gates.

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
| `INTERNAL_WEBHOOK_SECRET` | **no** | random; shared with n8n for the planned revalidate/media routes. The M03 GW-01 route uses its own machine credential below. | M06 (media route) / M09 (revalidate) |
| `N8N_WEBHOOK_BASE` | **no** | n8n instance base URL (e.g. `https://<instance>.app.n8n.cloud`); WF-60 onboarding webhook path per `docs/N8N_WORKFLOWS.md` | M11 / M15 |
| `N8N_WEBHOOK_SECRET` | **no** | header value the app sends to the WF-60 onboarding webhook; WF-60 verifies it (credential `EMR webhook in · App`) | M11 / M15 |

### Historical M03 GW-01 dev gateway: branch Preview only

GW-01 is a completed, closed historical dev transport exception. The following
records its original controls, not instructions to recreate handoffs, enable the
route or reopen its trial. Current foundation work uses the persistent-dev policy
above and the current M03 progress. Its route was
`/api/internal/n8n/rpc`; it does not reuse `INTERNAL_WEBHOOK_SECRET`, an agent
credential or a Supabase secret key. The implementation and local checks do not
establish hosted gateway acceptance. The one additive dev migration is applied
and independently read back with the window prepared, unbound and unused.
Cloud privacy verification, private runtime delivery and the bounded live trial
remain pending; use the current M03 progress record for later verified results.

| Name | Classification | Exact source / restriction |
|---|---|---|
| `EMR_WORKER_GATEWAY_ENABLED` | server-only control | Only the exact string `true` enables the route after the other guards pass. Keep it disabled until the reviewed privacy and delivery gates pass. |
| `EMR_WORKER_GATEWAY_AUDIENCE` | server-only control | Exact sentinel `vercel-deployment`. The actual audience is derived from Vercel's deployment hostname, then checked against the immutable DB binding; the sentinel alone does not identify a deployment. |
| `EMR_WORKER_GATEWAY_WINDOW_ID` | server-only control | Fixed dev window `76c2ad42-c094-4ba4-9a0b-566e19b97780`. No fresh window or reset is inferred from redeployment. |
| `EMR_WORKER_GATEWAY_COMMIT_SHA` | server-only control | The reviewed 40-character commit SHA; must equal Vercel's actual deployment commit. |
| `EMR_WORKER_DB_PASSWORD` | **secret** | Existing **emr-dev `n8n_writer`** password only. Never use postgres, `api_agent`, service/secret keys, a prod password or a password-bearing connection URL. |
| `EMR_WORKER_GATEWAY_TOKEN_SHA256` | **secret verifier** | SHA-256 verifier of the newly generated GW-01 machine token. Treat the verifier as private; never print or commit it. The raw machine token is not an application environment variable. |

The reviewed delivery helper adds only the last two fields as **Sensitive**
Vercel variables, scoped to **Preview / branch `m03-n8n-foundation`** in project
`prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu`. Values travel through the owned CLI child's
stdin, never command arguments or reports. Do not create project-wide Preview,
Development or Production copies. The non-secret controls also belong only to
this reviewed branch Preview; their presence is not permission to enable it.

Vercel supplies `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_PROJECT_ID`,
`VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA` and `VERCEL_DEPLOYMENT_ID`. Do not replace
these with caller headers. The runtime requires `preview`, the exact branch and
project above, a generated `*.vercel.app` hostname and valid commit/deployment
IDs. A separate restricted-writer helper binds the actual reviewed HTTPS origin,
commit SHA and deployment ID once in the prepared DB window. Another deployment
cannot reuse that binding; binding itself does not start the trial clock.

The database endpoint is fixed to the emr-dev session pooler
`aws-1-eu-central-1.pooler.supabase.com:5432`, database `postgres`, login
`n8n_writer.zmotjsbzhzjvpelxvxlf`. The client verifies the pinned public Supabase
CA, certificate chain and exact hostname with `rejectUnauthorized: true` and TLS
1.2 or later. It asserts native `current_user` and `session_user` before calling
the three private gateway RPCs. No administrator credential enters this runtime;
the separately consumed dev administrator handoff authorizes only the one
reviewed additive migration.

The new n8n native `httpCustomAuth` credential is
`M03 GW-01 machine [dev]` (`EmrGw01Machine18`), restricted to the exact reviewed
Preview hostname. It holds the new `Authorization: Bearer` machine token and a
**new GW-01-only** `x-vercel-protection-bypass` value. The bypass remains in n8n;
it is not copied into app environment variables and does not replace machine
authentication. The separate `M03 GW-01 privacy canary [dev]`
(`EmrGw01Canary18`) must prove credential, execution, export and log redaction
before runtime delivery. Never place either secret in Variables, Code/Set nodes,
workflow JSON, URLs, pinned data, browser storage or reports. The route refuses
browser Origin/Cookie headers, query strings and any other request origin/path.

Use only the sealed GW-01 Windows helpers for temporary DPAPI delivery. Their
current-user Temp files are `emr-m03-gw01-dev-{writer,admin,machine,protection,management}.dpapi`;
the management handoff also has its reviewed two-hour lease. Writer and Machine
creation remain blocked until all Cloud privacy gates pass. A handoff's presence
is not authentication, delivery or trial evidence. Plaintext exists only inside
bounded owned children; do not forward it to builds, installs, tests or unrelated
commands. Close credential-bearing children after each phase and remove the
owned temporary handoffs during the recorded cleanup, retaining the owner's
separately saved original passwords. Clearing a child does not clear a parent
VS Code process.

The DB enforces the one 30-minute window, 100 admissions, 30/minute, 500/day and
two leases; the trial coordinator separately caps **all** HTTP attempts at 100.
Only the seven reviewed trial aliases are enabled. Closing the window persists
and cannot reopen it. Cleanup removes only owned trial credentials, new bypass,
branch-specific secret variables and temporary artifacts. An environment edit
does not erase secrets from older immutable deployments: reconcile and disable
the owned trial deployments as recorded. Do not delete shared credentials or
collected data. Production, provider/model calls, recurring activation, shared
incident remediation and merge approval remain separate.

### n8n Cloud (credentials + variables)

Credential names below are logical labels. M03 reuses the owner's existing
credentials by actual ID and supported type, including native `apifyApi` and
`openAiApi` through HTTP Request Predefined Credential Type. Do not rename,
duplicate or change shared credentials. Actual mappings and separately observed
saved-state/endpoint results are in M03's credential evidence.

| Credential / variable | Type | Notes |
|---|---|---|
| `Supabase Postgres · n8n_writer · dev` / `· prod` | Postgres | Host: Supavisor **session** pooler (IPv4), port 5432, user `n8n_writer.<project-ref>`, SSL required |
| `Apify API` | Native `apifyApi` via HTTP Predefined Credential Type, or a compatible existing Header Auth | Reuse actual ID; never extract or duplicate its token |
| `OpenAI API` | OpenAI / Header Auth | project key; models via `OPENAI_MODEL_EXTRACT`, `OPENAI_MODEL_REASON`, `OPENAI_MODEL_BRIEF`, `OPENAI_MODEL_EMBED` (n8n Variables or CONFIG node) |
| `SerpAPI` | Query/Header auth | |
| `Firecrawl` | Header Auth (`Authorization: Bearer`) | |
| `Vimeo token` | Header Auth (`Authorization: bearer <token>`) | |
| `YouTube Data API key` | Header Auth (`X-Goog-Api-Key`) | key restricted to YouTube Data API v3; fixed `www.googleapis.com` requests/no redirects, preserve shared domain settings; never put the key in a URL |
| `Email (Resend)` | Resend Header Auth (or SMTP) | |
| `EMR internal secret` | Header Auth | `x-emr-secret: <INTERNAL_WEBHOOK_SECRET>` for calls to Vercel internal routes and revalidate |
| `EMR webhook in · Apify` / `EMR webhook in · App` | Header Auth (webhook nodes) | verify inbound calls to WF-19 / WF-60 |
| Variables (if plan supports) or a `CONFIG` Set node | `EMR_ENV` (dev|prod), `EMR_APP_URL`, `EMR_N8N_WEBHOOK_BASE`, `APIFY_WEBHOOK_SECRET` (optional; WF-19 checks it when set, otherwise verifies callbacks by re-fetching the run from the Apify API), `ALERT_FALLBACK_EMAIL=mohamed.abdelrahman@everyone.film`, model names `OPENAI_MODEL_*`; set each workflow's timezone to Africa/Cairo | |

### Codex workstation / CI
| Name | Where | Notes |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Codex env + GitHub Actions secret | **Scoped** personal access token (dev project; prod only when the owner allows) |
| `SUPABASE_DB_PASSWORD_DEV` / `_PROD` | separate bounded administrative paths only | Dev uses the persistent CurrentUser-DPAPI entry; production is never part of the default dev profile. Existing14 M03 versions must not be replayed. |
| `SUPABASE_PROJECT_REF_DEV` / `_PROD` | repo variable | not secret |
| `SEED_DATABASE_URL` | bounded owner seed child only | Password-free, fixed-project session-pooler URI for M02; never an application-role URL |
| `PGPASSWORD` | bounded approved DB/owner-seed child only | Load only the task-required dev database entry through the existing administrative consumer; no n8n/web/build/install/test parent, `.env`, arguments or CI secret. Historical M02 temporary delivery receipts stay separate. |
| `SUPABASE_URL` | M02 owner seed child | Non-secret verified dev URL used by the logo Storage client |
| `SUPABASE_SECRET_KEY` | M02 owner seed child only | Dev secret key for owner-run logo seed; separate from the later Vercel media-route configuration |
| `VIMEO_TOKEN` / `YOUTUBE_API_KEY` | M02 owner seed child only | Public-scope Vimeo token / YouTube Data API v3 restricted key; retain originals for later n8n setup |
| `N8N_API_KEY` / n8n MCP config | Codex MCP config | to create/update workflows |
| `VERCEL_TOKEN` | optional | only if Codex deploys via CLI |

M02's historical exact private delivery commands and cleanup are in
[`scripts/seed/README.md`](../scripts/seed/README.md). The Windows helper stores
only temporary DPAPI ciphertext under the current user's local Temp directory.
The reviewed consumer verifies the source/data/packet seal before decryption,
starts a bounded plain-Node process, removes consumed handoffs and confirms child
exit. Build/test/install processes receive no live credentials. File presence is
not authentication. Production seeding requires its separate M02 approval; a
database password is not a restricted application-role credential.

## 3. Generating secrets

```bash
openssl rand -base64 48   # API_KEY_PEPPER, INTERNAL_WEBHOOK_SECRET, N8N_WEBHOOK_SECRET
```
Role passwords (`n8n_writer`, `api_agent`): `openssl rand -base64 32 | tr -d '/+=' | cut -c1-32`. The owner runs `alter role … password '…'` in the SQL editor of each project (M01 manual action) and stores them only in n8n/Vercel.

## 4. Rotation

- Rotate the API key pepper only together with re-issuing all agent keys.
- Rotate role passwords every 6 months or on staff change (update n8n credential + Vercel env, then `alter role`).
- Revoke OpenAI/Apify/SerpAPI keys from their dashboards if leaked; the cost ledger + daily budget alert surfaces anomalies.
