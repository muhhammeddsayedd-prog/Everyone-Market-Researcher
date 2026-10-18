# M03 — exact dev credential steps

18 October 2026. Instance: <https://muhhammedsayed.app.n8n.cloud>.
Project: **Personal** (`pHvQjDmjxVZ3KQLT`). Browser sign-in and the upgraded
50,000 execution allowance are verified. No further login is requested.

In this instance open **Personal → Credentials → Add credential**. Create the
following credentials with the exact display names. Enter secrets privately in
n8n; do not send them in chat or export credential data. Existing credentials
belong to other workflows and must not be renamed or overwritten.

## MA-11: restricted dev database

Choose **Postgres**, name **Supabase Postgres · n8n_writer · dev**, and enter:

| Field | Value |
| --- | --- |
| Host | `aws-1-eu-central-1.pooler.supabase.com` |
| Database | `postgres` |
| User | `n8n_writer.zmotjsbzhzjvpelxvxlf` |
| Password | Existing distinct emr-dev **n8n_writer** password saved during M01 |
| Maximum Number of Connections | `5` |
| Ignore SSL Issues (Insecure) | **Off** |
| SSL | **Require** |
| Port | `5432` |
| SSH Tunnel | **Off** |

Save. Expected non-secret result: the credential is saved; its connection test
succeeds. If n8n reports a TLS/certificate failure, leave **Ignore SSL Issues
off** and report only `Postgres TLS test failed`; do not send the raw error or
switch to administrator credentials. The live empty form exposes no custom-CA
field, so a failure would need a reviewed TLS-capable alternative.

This is the session-pooler application role. The PostgreSQL administrator
password and the Supabase API/service/secret key are not substitutes.

## MA-10/11/12: provider headers

For each row choose **Header Auth**. At the top of the drawer set the exact
credential display name in the first column. Set **Allowed HTTP Request
Domains → Specific Domains**, then set **Allowed Domains** exactly as shown.

| Credential display name | Header `Name` | Private `Value` | Allowed Domains |
| --- | --- | --- | --- |
| `Apify API` | `Authorization` | `Bearer ` followed by the intended Everyone Apify API token | `api.apify.com` |
| `Vimeo token` | `Authorization` | `Bearer ` followed by the existing public-only Vimeo token used in M02 | `api.vimeo.com` |
| `YouTube Data API key` | `X-Goog-Api-Key` | Existing YouTube Data API v3-restricted key used in M02 | `www.googleapis.com` |
| `OpenAI API` | `Authorization` | `Bearer ` followed by the intended `market-radar` OpenAI project API key | `api.openai.com` |

Save each one. Header Auth may show no provider-specific connection test;
**Saved** is the expected owner result, not proof of provider authentication.
Codex will perform the M03 bounded read-only endpoint tests separately and record
each result. Apify Scale is already owner-confirmed; no plan-name question is
repeated. Do not rename the existing shared `Apify account` credential used by
other workflows.

For a missing OpenAI key: open <https://platform.openai.com> → select the intended
**market-radar** project → **API keys → Create new secret key**. Save the original
in your password manager and put it only in the n8n credential above. Use project
permissions, not an organization administrator key. M03 only needs Models read
for `GET /v1/models`; paid extraction permissions can remain disabled until M07.
In **Project settings → Limits → Spend → Edit spend limit**, choose your monthly
USD limit, enable **Enforce a hard limit**, and save. Report only the chosen
non-secret limit. Alerts alone do not establish a hard cap. Current official
instructions: <https://developers.openai.com/api/docs/guides/spend-limits>.
No Vercel OpenAI secret or paid model call is needed in M03.

Readiness reply: **M03 credentials saved**, listing any credential still missing
and the non-secret OpenAI monthly hard limit. Keep your saved originals.

## Scope and verification boundaries

The Header Auth name/value/domain controls and Postgres fields above were
observed in empty drafts and cancelled without entering or saving secrets.
YouTube uses its supported key header instead of the older Query Auth example,
so the key stays out of request URLs. This matches the successful M02 official
Google API client pattern. Callback option (b) remains registered-run lookup plus
authenticated Apify readback; it does not need an inbound webhook secret.

Firecrawl (M05), SerpAPI/email (M13), app internal secret (M06/M09) and production
credential copies (M08) remain deferred. Notify remains log-only. No API key,
password or secret value is requested in chat.

The independent n8n connector still returns internal errors after verified
browser login. A narrowly bounded public-API consumer is being prepared before
any separate API-key handoff is requested; do not repeat MCP setup or send an
API key now. The dev migration administrator handoff will likewise get its own
exact reviewed helper command; it is separate from the application-role
credential entered here.
