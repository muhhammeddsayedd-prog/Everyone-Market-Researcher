# Decision log — everyone. Market Radar

Every product and technical decision that is already settled. Codex treats this file as binding. A change to any line needs the owner's approval and a new dated entry at the bottom ("Changes").

Owner: Mohamed Abdelrahman (mohamed.abdelrahman@everyone.film) — product owner, maintainer and approver.

## Product

| #    | Topic                       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Name                        | **everyone. Market Radar** (lowercase "everyone." with the period). Uses the everyone. wordmark from `assets/brand/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D-02 | Purpose                     | The company's "eyes and ears": see every new commercial, brand film, post, story and project from competing production houses the day it appears, and understand who made it for which client.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D-03 | Users (v1)                  | Market researchers, analysts, executives and management at everyone. The social media team comes later. All signed-in users see all data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D-04 | Competitors                 | 284 production houses in the competitor sheet, plus **Everyone Films as the baseline** (benchmark, `is_baseline = true`). Any competitor added later is picked up by the same pipeline automatically.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D-05 | Pilot                       | Starts with the **top 50** competitors (sheet column AE "Pilot rank" 1–50; tier "A · Pilot"): 19 Egypt, 15 KSA, 16 UAE, plus the baseline. Then scales to all 284.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D-06 | Markets                     | Egypt (EG), Saudi Arabia (KSA), UAE. Any company that is not KSA or UAE counts as EG for briefs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-07 | Platforms in scope          | **Only**: Vimeo, Instagram (posts, reels, carousels, stories), websites (work/portfolio pages), LinkedIn (company posts + company employees), YouTube. **No other social platform is scraped.** TikTok, Facebook, Behance, X, Threads, Snapchat, Pinterest and Dribbble links stay in the data for reference only. More actors can be added later on the owner's approval.                                                                                                                                                                                                                                                                                                                                                                                                               |
| D-08 | Out of scope                | Ad libraries (Meta, Google Ads Transparency, TikTok ads) — **out of scope**. LinkedIn job postings — **out of scope**. Video transcription — out of scope. Metric history — out of scope (latest snapshot only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-09 | News and awards             | In scope, **weekly, via SerpAPI** (Google News + Google search on award/trade sites).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D-10 | History                     | Backfill from **1 Jan 2024** to today for every in-scope platform. Stories cannot be backfilled; capture starts on day one (highlights only if an actor returns them without login).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-11 | Cadence                     | All in-scope platforms checked **daily**. LinkedIn employees: weekly snapshot. News and awards: weekly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-12 | Only-new scraping           | Never re-scrape what is stored. Per-account watermarks, insert-only-if-new, content fingerprints (see TECHNICAL §5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-13 | Metrics                     | Latest snapshot only (views, likes, comments, plays), refreshed for items from the last 30 days: daily on free APIs (Vimeo, YouTube), weekly on paid sources (Instagram, LinkedIn).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-14 | Removals                    | Items a source no longer returns are marked `removed`, never deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D-15 | Other entities              | Clients/brands, agencies and people (credits) are first-class records with their own pages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D-16 | Campaign rule               | Same brand + same production house + close in time = one campaign. The same client returning later = a new campaign.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-17 | Credits taxonomy            | Roles and taxonomies as in `docs/TAXONOMIES.md`, editable in admin.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-18 | Language                    | Store the original text (often Arabic) plus an English translation and English + Arabic summaries. UI is English-first and Arabic-ready (RTL-safe content, `dir="auto"`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D-19 | Media                       | Keep thumbnails and key frames only (Supabase Storage). Link to the full video at the source. No video downloads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D-20 | Briefs                      | Weekly AI brief per country (EG, KSA, UAE) plus market-wide, every Monday.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D-21 | Alerts                      | Email. Daily digest + instant alerts for big launches. Recipient: **mohamed.abdelrahman@everyone.film** (more recipients configurable in the app).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D-22 | Search                      | Keyword + semantic search and "similar campaigns" are core features.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-23 | Agents                      | Full REST API + MCP server so Claude, Codex and other agents can search, read and act.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-24 | Scraping scope              | **Public data only.** No logins, no cookies, no session accounts, no CAPTCHA solving. If an actor needs a login, that source is skipped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D-25 | Budget                      | No hard cap; the system must report its own running cost (cost ledger + Costs page + forecast).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-26 | Maintenance                 | The owner maintains the system and onboards users personally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D-27 | Unavailable social accounts | Collect only the supplied or subsequently verified public account for a company. If an account is absent, invalid or unresolved, skip that source; do not invent a handle or scrape another account to fill a platform quota. Keep the company and its other valid sources. A malformed URL or failed lookup does not prove the company has no account. On18October2026 the owner directed that the seven reviewed M02 YouTube sources (C102, C142, C218, C231, C233, C245, C283) be skipped: retain them as invalid/failed with their observed reasons and no fabricated IDs. Pilot acceptance covers the remaining eligible accounts (10/10), with original raw10/11 and total121/128 coverage still shown. Only these exact reviewed identities are exempt; new failures need review. |

## Technical

| #    | Topic                 | Decision                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-01 | Source of truth       | **Supabase** (Pro plan). Separate **dev** and **prod** projects.                                                                                                                                                                                                                                                                                                                                                 |
| T-02 | Orchestration         | **n8n Cloud** (queue mode; 50K workflow runs available). n8n schedules all jobs. Codex builds workflows through the n8n MCP connection; every workflow is also exported as JSON into `n8n/workflows/`.                                                                                                                                                                                                           |
| T-03 | Web app               | **Next.js (App Router, TypeScript) on Vercel**. Cached pages, revalidated on demand when n8n publishes.                                                                                                                                                                                                                                                                                                          |
| T-04 | Repo                  | GitHub `muhhammeddsayedd-prog/Everyone-Market-Researcher` (empty at start).                                                                                                                                                                                                                                                                                                                                      |
| T-05 | AI                    | **OpenAI**: structured outputs (strict JSON schema) for per-item extraction, a stronger model for briefs and hard cases, `text-embedding-3-small` (1536 dims) for embeddings. Model names live in env vars and are chosen in M07 after an eval.                                                                                                                                                                  |
| T-06 | Auto-publish          | AI results with confidence **≥ 0.80** publish automatically; below goes to the review queue. Tuned after the pilot (M12).                                                                                                                                                                                                                                                                                        |
| T-07 | Scraping tools        | Apify (approved actors only, see `docs/SCRAPING_SOURCES.md`), Vimeo API and YouTube Data API (official keys approved), SerpAPI (news/awards), Firecrawl (website URL maps).                                                                                                                                                                                                                                      |
| T-08 | Approved Apify actors | Vimeo: `goat255/vimeo-scraper`, `dltik/vimeo-scraper`. Instagram: `apify/instagram-scraper`. Stories: `data-slayer/instagram-stories-scraper`, `igview-owner/instagram-story-viewer`, `louisdeconinck/instagram-story-details-scraper`. Websites: `apify/website-content-crawler`. LinkedIn: `harvestapi/linkedin-company-posts`, `harvestapi/linkedin-company-employees`. YouTube: `streamers/youtube-scraper`. |
| T-09 | Writes                | n8n writes **only** through RPC functions using a dedicated Postgres login role `n8n_writer`. Never the service/secret key, never public API keys.                                                                                                                                                                                                                                                               |
| T-10 | Queue                 | Database queue (Supabase Queues / `pgmq`) holds the AI backlog. n8n schedules and drains it.                                                                                                                                                                                                                                                                                                                     |
| T-11 | Auth                  | Google sign-in via Supabase Auth, **invite-only**: the owner invites each email with a role. Optional switch: allow any `@everyone.film` Google account as viewer (`app.allowed_domains`, off by default).                                                                                                                                                                                                       |
| T-12 | Agent API access      | Hashed API keys with read / write / admin scopes, rate-limited, every call logged. The API reads the same RLS-protected data as the app through a dedicated `api_agent` role — never the service key.                                                                                                                                                                                                            |
| T-13 | Security              | RLS on every exposed table, `security_invoker` views, no `SECURITY DEFINER` in exposed schemas, no secrets in `NEXT_PUBLIC_*`, scoped tokens for CLI/MCP.                                                                                                                                                                                                                                                        |
| T-14 | Delivery              | Milestone by milestone (`milestones/`), each with its own PROGRESS.md that Codex keeps current.                                                                                                                                                                                                                                                                                                                  |

## Changes

### M03 callback persistence correction — 18 October 2026

Within the owner's M03 development authorization, callback verification uses
option (b): registered-run context plus authenticated Apify run readback; the
callback body supplies only an ID hint. The original early `processed_at` step
could discard failed ingestion, and separate retryable RPC nodes could lose
insertion counts or duplicate costs. M03 therefore adds one atomic, bounded
`ops.process_apify_run` transaction and a saved receipt for the one-account,
one-page, development-only website smoke path. Existing M01 interfaces and
seven applied migration files stay intact. Processed replays return durable
counts; mismatches fail closed. Standalone completion must not bypass a durable
receipt. Unsupported platforms/multiple actor registrations remain closed
until later collector milestones implement durable chunk/dispatch barriers.

The collector must reconcile the original returned actor-run ID after
registration even when a webhook arrived early or work failed after HTTP200;
it must not blindly launch another actor. A database first-transition flag is
not an exactly-once external-delivery guarantee. M03 notifications default to
audit logging, and WF-00 stays inactive. This is a safety/idempotency correction,
not production, paid-run, merge or later-milestone approval. The local migration,
advisors, generated types, hosted deployment and end-to-end acceptance have
separate evidence gates in M03 progress.

M03 reuses the owner's existing credentials by actual ID and compatible type,
without requiring canonical display names or changing shared credentials.
HTTP Request uses Predefined Credential Type for native `apifyApi` and
`openAiApi`; it must not extract tokens or duplicate them as Header Auth.
Vimeo and YouTube reuse Header Auth, with `Authorization` and
`X-Goog-Api-Key` respectively. Market Radar requests constrain fixed HTTPS
origins and reject redirects; shared domain settings are preserved.
YouTube's header replaces the older Query Auth example and keeps keys out of
URLs. The Apify metadata test uses the authenticated limits endpoint because
`users/me` includes a proxy password. No actor/model call is a credential test.
App/internal secrets remain deferred; M03 uses callback verification (b) and
log-only Notify. The saved dev Postgres port is5432; an observed strict TLS
chain failure must not be bypassed by Ignore SSL Issues or another login.

The WF-70 and WF-80 stubs keep the standard four dispatch inputs and explicitly
add optional `tags` and `kind`, respectively, for their documented callers.
SUB Finish accepts an optional verified atomic `completion` receipt. Only a
matching first-transition receipt permits downstream stub dispatch; without
one it returns the stored finish summary without dispatch. This avoids treating
a repeated M01 `finish_run` total as a new transition. It does not establish
exactly-once external delivery; later live consumers require a durable delivery
design. WF-90 uses trusted workflow ID mapping and fixed classified messages;
it does not invent a parent run ID from an unverified Error Trigger payload.

The native WF-00 adapter uses separate Sunday 07:00 news and 07:30 awards
clocks. This preserves the requested timings without assuming that a 30-minute
Wait is compatible with the reviewed 15-minute workflow timeout. Manual slot
tests use `news` for WF-22 and `awards` for WF-23; the existing shared logical
planner keeps its delayed awards representation. PM/backfill trigger nodes and
Config flags remain disabled. Start run and notification claims have no blind
automatic retry; ambiguous responses need reconciliation. SUB Log cost accepts
only keyed metadata, while the atomic processor/accrual own their safe metadata.
Known-source trigger errors without an originating execution ID correlate with
the actual error-handler execution, explicitly prefixed `handler-`, without
inventing a parent run. Automatic Error Trigger acceptance requires an actual
automatic dev failure; manual mock execution is not that proof.

M02 closed after the owner separately approved **Approve merging PR #6**
(`call_e5871c933ab04e8fad11f15a51a82b4c`). The exact reviewed head
`8ecb87cb75bc895491c815c575816cb8bab26649` passed all five CI39093312511 jobs
and Vercel, then merged at `2ee25d3442dc20e5967914c875685bcec35eddfc`
on18October2026 at06:28:57 Cairo. Protected-main documentation closeout records
the observed merge; it does not authorize M03 or any new database/provider run.
[Actual merge receipt](../milestones/M02-seed-data/evidence/merge-closure-20261018.json).

M02 T10 exact packet approval is recorded: on18October2026 the owner replied
**approved: seed prod** for reviewed head
`a17f7e25369abc5f71aab0196a4f2e7d5f3cc614`
(`call_0f2dd5cc1f3e4a6780c5feba0ca21225`), then reported
**M02 prod handoffs ready** (`call_516b09d2e7d04a2786cd55db086c2d08`).
The approved method imports accepted public dev account configuration and
exact257 frozen logo objects, rather than repeating T2–T8 external lookups.
It preserves D-27 exclusions and accepted website/logo findings; production
gets fresh row IDs and operational defaults. Dev UUIDs, timestamps, collection
state and credentials are not promoted. Limits remain285 competitors/1,754
accounts/257 logos,771 Storage requests/1,560,325 upload bytes, USD0 incremental
provider cost and zero provider/competitor-origin calls. This approves only the
bounded M02 production seed/configuration/byte-verification path. Readiness and
presence did not establish authentication; the later actual batch completed
native0/eight stages,285/1,754 configuration parity, real second no-op,257 public
logo hashes and credential cleanup. Explicit post-seed UI **Rerun linter**
completion was observed by03:18:20UTC for Security and03:18:44UTC for Performance:11 intentional deny-all
security INFO and68 performance INFO, comprising67 unused-index plus1 Auth
DB-connection absolute-allocation INFO(max10),0 WARN/ERROR. Earlier Refresh
evidence remains preserved; no backend analysis timestamp was exposed and no
CLI/MCP rerun receipt or index removal is claimed.
Production receipts prove imported configuration/bytes,
not a repeated provider exchange. PR6 merge, M03, collection, paid provider
calls and n8n remain separate. See [the packet](../milestones/M02-seed-data/evidence/prod-seed-packet-20261018.md),
[authorization](../milestones/M02-seed-data/evidence/prod-authorization-20261018.json)
and [actual acceptance review](../milestones/M02-seed-data/evidence/prod-acceptance-review-20261018.json).

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Approved by                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-18 | Approved M02 T10 promotion completed native0 with fresh prod IDs/defaults:285 competitors/1,754 accounts/257 public hash-verified logos,0 parity mismatches/default violations and an actual immediate second no-op. Preserve seven exact exclusions/23 website flags/11 source-logo plus17 no-source fallbacks. Production79 reason rows/sourceissues10 versus historical dev72/3 reflect the accepted seven D-27 overrides, not new owner findings. Explicit post-seed UI Rerun linter completed both categories:11 deny-all security INFO/67 unused-index+1 Auth-allocation performance INFO(max10),0WARN/ERROR; earlier Refresh preserved, no backend timestamp/CLI/MCP rerun receipt claimed. No schema/type/index removal or new provider calls. Spent admissions remain; cleanup passed. Separate PR6 merge/M03 gates remain. | Exact T10 approval recorded above; execution/reconciliation/populated-advisor/cleanup receipts in the M02 acceptance review. No wider authorization. |
| 2026-10-18 | M02 T10 exact production packet approved: promote accepted public dev configuration and257 sealed logo objects with fresh prod IDs/defaults, no new provider lookups or operational state/credential promotion. Preserve seven exact D-27 exclusions,23 accepted website flags and11 source-logo fallbacks. At this approval checkpoint, actual production authentication/import/parity/native completion/cleanup was pending; owner-reported readiness and presence checks did not establish acceptance. Separate PR6 merge and M03 gates remained. | Owner **approved: seed prod**, `call_0f2dd5cc1f3e4a6780c5feba0ca21225`, exact reviewed a17f7e25369abc5f71aab0196a4f2e7d5f3cc614; readiness **M02 prod handoffs ready**, `call_516b09d2e7d04a2786cd55db086c2d08` |
| 2026-10-18 | D-27 records the owner's rule to skip unavailable social sources. MA-09 closes the seven listed YouTube sources as owner-excluded and accepts23 retained website error flags plus11 initials-logo fallbacks. M02 AC4/AC5 distinguish original coverage from eligible coverage:128 original YouTube rows, seven exact invalid exclusions (one pilot),121/121 eligible resolved and10/10 eligible pilot resolved. No row deletion, false absence/resolution claim, additional provider run, production or merge approval. | Owner reply to MA-09: “If a company doesn't have a social don't scrap it. If it doesn't have youtube don't scrap it.” and “All listed website flags: ok; all11 missing logos: ok” |
| 2026-10-18 | M02 implementation: owner seed uses source-bound ownership/CAS and an encrypted Windows handoff to a sealed plain-Node child. Existing fields without ownership stay protected. Google API keys use an origin-bound header; numeric Vimeo profile IDs use `/users/<id>`; vanity/showcase acceptance still needs live verification. No new actor, product scope, access privilege or production authorization.                                                                                                           | M02 development authorized by owner; conservative implementation details/source corrections recorded for review                                                                   |
| 2026-10-17 | M01 implementation record: generated `handle_norm` account key; `finish_run` JSON summary; cadence-minus-four-hours success scheduling; preserved normalized credits/media; clean invoker hybrid search. `DATA_SCHEMA.md` RPC milestone labels and `TECHNICAL.md` draft scheduling now match the specific M01 handoff. No binding product, tool, access or production gate changed.                                                                                                                                     | Specified by M01 T4–T7; implementation details recorded for review                                                                                                                |
| 2026-10-17 | Pilot backfills (M04–M06) and the M07 AI backlog run once in **prod** after the owner approves each estimate (MA-14, MA-15, MA-17), to avoid paying twice; prod schedules stay off until M08. Media v1 (WF-31) moves to M06 because story/Instagram CDN URLs expire. Stories bake-off runs 7 days.                                                                                                                                                                                                                      | Proposed in the handoff pack; owner confirms at MA-14                                                                                                                             |
| 2026-10-17 | Initial decision set from the brainstorm and the architecture doc (rev 95). Ad libraries and LinkedIn jobs moved out of scope; news/awards via SerpAPI; stories only without login.                                                                                                                                                                                                                                                                                                                                     | Owner                                                                                                                                                                             |

## GW-01 dev transport exception - approved18 October2026

Owner approved the exact strict-TLS packet at100290a291530d30d0387269c1a0805ad4f86fcc plus bounded-trial clarifications. [Authorization](../milestones/M03-n8n-foundation/evidence/gw01-authorization-20261018.json). The existing Next.js/Vercel Node backend may serve a fixed, machine-authenticated worker-RPC route on the m03 branch protected Preview only, connecting as actual dev n8n_writer with the pinned CA and normal hostname validation. This does not make the failing native Postgres node PASS.

Includes one additive admission/idempotency dev migration, branch-specific Preview credentials, new owned trial-only custom authentication/bypass entries and cleanup, inactive owned M03 adapters, and one persisted100-total-attempt/two-concurrent/30-minute connection trial with USD1 planning reserve (not an enforced invoice cap). Invalid requests, retries, status and shutdown checks count. Clock starts only after local/preview/delivery readiness; counters/window are never replaced/reset across deployments. Bind the reviewed exact deployment URL/SHA/ID once before admission; use immutable Vercel metadata, not caller headers or a mutable alias.

Existing nine migrations, seeded data, exclusions, logos and provider credentials remain intact. No arbitrary SQL/host/role/RPC, administrator/service credential in runtime, raw-ingestion bypass or new Data API exposure. Gateway-only identity/read/retained acknowledgement acceptance is separate from live callback/actor acceptance. Production, incident remediation, actor/model calls, collection, recurring activation, notification, PR8 merge/M03 closure and M04 remain unapproved.

## M03 full-foundation source continuation — 19 October 2026

The owner's attached continuation authorizes local M03 source/adapters/tests,
necessary **forward-migration source**, and safe owned **inactive dev** workflow
provisioning through supported access. It preserves the completed GW-01 trial
as a closed historical exception. This is not approval for a new hosted window,
migration push, actor start, multi-workflow batch, production operation or merge.

The current source uses a separate fixed-alias HTTPS foundation route and actual
restricted `n8n_writer` authentication with strict CA/hostname checks. It does not
silently return to the failing native Postgres node or expose SQL/RPC/host/role
selection. Its new window is never derived from GW-01 or its remaining allowance.
No source migration creates an active approval. The exact four forward versions
and proposed lifecycle are listed in the existing
[live-acceptance packet](../milestones/M03-n8n-foundation/evidence/live-acceptance-outline-20261018.md).

Pinned n8n 2.43.5 HTTP/Apify node schemas cannot enforce a streaming response-byte
limit. The smallest M03 transport addition is therefore a server reader for the
registered original run, original INPUT and one exact Everyone page, with fixed
origins, hard streaming bounds and allowlisted output. A genuinely new dev
read-scoped provider token is a later approval/credential gate; the existing
shared native Apify token is never extracted or duplicated. Existing native
Apify credentials remain the disabled asynchronous launch binding. Two starts
maximum, separate actual cost per run, first-response-only durable admission,
original-ID reconciliation and permanent closeout are required.

All 25 generated definitions are inactive, retain no execution data and keep
launch controls disabled. Saved native IDs/exports and future live results must
be recorded separately from source/local/CI evidence. No whole-editor/context
snapshot, Variables enumeration, browser storage read or raw sensitive export
is an acceptable verification path. Unknown fees, the USD 25 alert default and
the 24 October tooling follow-up remain unchanged. Private incident preparation
and production decisions stay outside this source authorization.

## M03-C01 temporary dev retention design — approved19 October2026

The owner explicitly approved the scoped inventory at
`eee9a277c6a7d63fffe967811c92a7fd50c15b14`,
[exact inventory](../milestones/M03-n8n-foundation/evidence/m03-c01-retention-proposal-20261019.json),
as the basis for local implementation, tests, independent review and the final
[A–D acceptance packet](../milestones/M03-n8n-foundation/evidence/live-acceptance-outline-20261018.md).
This approves no Cloud change or live batch by itself.

For the same25 pinned owned dev workflows: enable manual storage only on
WF-00/WF-91/WF-99/SUB-INGEST/SUB-COST; set success/error storage to `all` on the
21 other integrated/error-capable graphs (all except WF-00/WF-99/SUB-INGEST/
SUB-COST). WF-91 overlaps; union25. Keep progress storage false and every other
setting unchanged. Preserve exact baselines for restoration. No instance,
unrelated workflow, credential or production retention change is included.

This stores full intermediate data, snapshots, headers/bodies and errors,
including unsolicited webhook input before validation. Native settings cannot
select batch IDs or safe stored fields; final-node/read-time redaction cannot
sanitize earlier storage. Private reducers must refuse sensitive reflection,
incomplete native evidence or responses above the8MiB streaming ceiling and
emit only allowlisted technical metadata/fixed diagnostic codes. Cleanup is
limited to causally owned, terminal **and independently settled** native records,
after durable projected evidence, matching DELETE acknowledgement and absence
read. Restoring settings is not erasure; lost acknowledgement plus404 is
ambiguous. Unresolved records remain inventoried with owner follow-up.

The separate live decision must cover setup, zero-actor success/failure/privacy
and cleanup proof before two conditional actor starts, then shutdown. Proposed
2048 execution-control attempts replace416; plus512 runtime attempts gives2560,
with unchanged120 native/256 gateway/32 provider-GET/two-actor/USD2 reserve/
60minute limits. No credentials, hosted migration, publication, execution,
gateway activation, production, merge or M04 are authorized here. Private R2
remains separate. The owner-reported local synthetic-state deletion was verified
by exact-path absence only; its historical blocked deletion was not retried.

## Persistent dev access and standing milestone authority — approved 23 October 2026

The owner explicitly replaced the earlier project-level disposable-secret and
time-only approval rules. Development credentials use the existing Windows
CurrentUser DPAPI implementation at
`%LOCALAPPDATA%\Everyone-Market-Radar-Private\secrets\dev\`, outside Git and
shared/cloud-synced directories, with ACL access limited to the intended user
and SYSTEM. Encrypted originals persist until actual expiry, revocation or owner
deletion; no artificial two-hour expiry applies. Existing consumers may receive
automatically generated disposable copies, which are cleaned with scratch after
their bounded children close. Initialization/update prompts once for genuinely
missing approved entries, reuses suitable purpose-approved dev handoffs and
native GitHub/Vercel/MCP/n8n stores, and exposes no print-secret interface.
Administrator credentials remain separate from application/runtime credentials;
production and unrelated incident credentials are excluded from the dev profile.

M03 development and approved A–D acceptance remain authorized until completion
or revocation, including ordinary fixes, scoped commits/PR updates, protected dev
previews and owned dev configuration. Technical timeouts and safe closure remain;
expiry or a tested source change alone does not require a new human approval.
One hosted-write coordinator must reconcile side effects and cumulative counters
before a continuation. Never reopen closed windows, reuse spent mutation claims,
overlap uncertain work or blindly repeat an ambiguous paid start. Preserve every
historical attempt/receipt and the 14 applied dev migrations, seeded data, owned
workflows, retention/privacy conditions and zero-actor gates. Starting usage is
6 management / 201 control / 207 combined; existing ceilings remain 512 / 2048 /
2560, native executions 120, gateway 256, provider GETs 32, actors 0 of 2 total
sequential starts, USD1 each / USD2 reserve and at most one new distinct item.
This decision replenishes none of those limits.

Ask only at a genuine missing/revoked credential, MFA/consent, enforced permission,
exhausted allowance, consequential unresolved decision, unsafe ambiguous effect,
production/destructive action, shared rotation, external-message or unapproved
recurrence boundary. Enforced platform/organization policies and actual provider
expiry still govern. Production, private R2 execution, PR #8 merge and M04 remain
separate. Historical approvals and closed records below/linked from milestone
evidence are unchanged; their superseded time-only and disposable-input wording
does not govern current development continuations. Implementation/tests/live
acceptance are recorded separately in the existing progress records.

## M03 cumulative management allocation — approved 24 October 2026

The owner approved the exact packet at PR #8 head `0bb8598`: **Approve cumulative
management 576; retain 152 charged**. [The immutable decision](../milestones/M03-n8n-foundation/evidence/remaining-management-allocation-approval-20261024.json)
raises only management from 512 to 576. Keep 152 management / 384 control / 536
combined charged, all historical attempts, side-effect IDs and closed windows.
Control stays 2,048 and combined stays 2,560; enforce the combined ceiling against
both actual counters before each request. Vercel stays 88 with 44 used. Two
sequential actor starts, USD 1 each / USD 2 total reserve, remain entirely unused.
No spending increase, migration replay, production, recurring activity, external
messaging, shared rotation, PR merge or M04 is approved. Standing M03 authority
and persistent dev access continue; no time-only renewal or credential handoff
is required by this allowance amendment.

## M03 cumulative Management 704 — approved 24 October 2026

The owner replied **Approve Management704; retain all charges and other limits**
to the reviewed [Management-only packet](../milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-20261024.md)
at PR #8 head `4b31c5f8447d79418b8572a872a86afd5722244d`.
[The immutable approval](../milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-approval-20261024.json)
raises only cumulative Management from 640 to **704**, retaining all **288 Management,
588 Control, 876 combined and 79 Vercel** charges. The conservative remaining
Management plan is 376 further requests, 664 cumulative, with 40 reserved.

Control **2048**, combined **2560**, Vercel **132** (included in Management),
native executions 120, SQL gateway attempts 256, direct provider reads 32 and
the original two sequential actor starts / USD 1 each / USD 2 total reserve /
at most one new distinct item stay unchanged. All attempts, closed windows,
durable intents and side-effect IDs remain preserved; no counter is reset.
Reconcile before continuation, retain cleanup capacity and run affected tests,
independent review, public source/seal checks and normal PR CI before admission.

Persistent development entries and native sessions are reused. This allowance
adds no credential delivery, time renewal, migration replay, production,
recurring activity, external message, shared rotation, R2 action, merge or M04
authority. It is not acceptance evidence.

## M03 temporary sole/default Preview bypass — approved 23 October 2026

The owner replied **“I approve”** to the exact [security-scope packet at9e7a8be](../milestones/M03-n8n-foundation/evidence/sole-bypass-scope-decision-20261023.md).
[The approval record](../milestones/M03-n8n-foundation/evidence/sole-bypass-scope-approval-20261023.json)
records authority; it is not a hosted verification receipt. The proposed packet
remains unchanged as historical review evidence.

For remaining M03 dev acceptance only, permit at most one owned temporary
automation bypass on the named existing Vercel project/team/branch. Require an
empty initial map, verify the sole owned default and report
`soleOwnedDefaultVerified:true`, `nonDefaultVerified:false`; revoke it and verify
absence on cleanup. Do not adopt, edit or revoke another entry. This knowingly
permits the project-wide default variable to populate future builds, including a
Production build started by another actor while present; it does not authorize
our production operations. All prior attempts/counters, standing M03 authority,
technical timeout/closure guards and aggregate limits remain unchanged. No
migration replay, recurring activation, external notification, private R2
execution, PR8 merge or M04 is authorized by this exception.

## M03 functional acceptance and bounded parallel delivery — approved 25 October 2026

The owner replaces the earlier project-level M03 closure checklist with the
[six functional checks and one-time AC1–AC12 mapping](../milestones/M03-n8n-foundation/MILESTONE.md#9-acceptance-criteria).
The mapping explicitly retains, replaces or defers each original criterion;
unverified work is never marked passed. Correct dev targeting, least privilege,
callback authenticity/run ownership, atomic persistence, replay/cost correctness,
safe stopping and required CI/exports/review remain delivery gates. Unknown
subscription fees and the exhaustive hosted stub matrix are not M03 blockers;
their local contracts and historical limitations remain recorded.

Freeze expansion of the custom supervisor and acceptance framework. Reuse
existing helpers and supported native tools; accept manual native evidence with
its identity, scope, actual result and limitations. After two failed repair
cycles for the same testing-tool defect, choose a supported alternative or report
one precise boundary. This changes the project acceptance policy, not an enforced
platform decision: never recreate a rejected action through another route,
disable required tests or infer acceptance from an unavailable verifier.

Preserve the actual Vimeo dispatch and four automatic error groups, all15 dev
migrations, seeded data, workflow restoration, prior attempts, closed windows,
side-effect IDs and every charged request. Actors remain0 of2 sequential starts,
USD1 each/USD2 total and at most one new distinct item. Current cumulative
ceilings at the reset were1728 Management/3584 Control/5312 combined/Vercel304;
the reset itself added no allowance. The owner's subsequent25 October exact
smaller-sequence approval raised only Management to2048 and Vercel to352,
retaining1661/1464/3125/V288 charged and Control3584/Combined5312 unchanged.
The [complete factored estimate and approval](../milestones/M03-n8n-foundation/evidence/dev-acceptance-fixture-gap-correction-20261024.md#complete-smaller-functional-allowance--approved-25-october-2026)
includes recovery/shutdown; target one actor, retaining the original two/USD2
maximum. Admit no new live batch unless its remaining operations and
shutdown fit. The real collection/callback/item/cost, replay and invalid-callback
checks remain pending. After the safely closed no-actor attempt, the owner
approved exactly **Approve Management2176 and Vercel400; retain all charges
and other limits** on25 October2026. These are the current two ceilings; retain
all1861 Management/1488 Control/3349 combined/Vercel323 charged,
Control3584/Combined5312, two sequential actors/USD2 total and one new distinct
item. The [complete269M/512C bound, including64V and recovery/shutdown](../milestones/M03-n8n-foundation/evidence/dev-acceptance-fixture-gap-correction-20261024.md#remaining-request-boundary-after-the-safely-closed-functional-attempt)
is approved without resetting any attempt, counter or spending allowance.

The subsequent [actual functional proof](../milestones/M03-n8n-foundation/evidence/functional-collection-proof-20261025.json)
records one successful asynchronous actor/callback/database item, cached callback
and content replay, stable measured/rounded cost and unknown-run rejection.
Final restoration was independently verified at21:06:53UTC on25 October
(26 October Cairo); this does not change production or merge boundaries.
On25 October, the owner explicitly
replied **Restore reviewed WF-99 baseline** for ownedqTjioYmBUVMIERVz after
its newer91abbe99 version was observed. Preserve the verified encrypted rollback
snapshot and recheck drift before restoring the exact inactive0bfea81 baseline.
The source comparison establishes native-default omissions/layout equivalence,
not who made the change; no broader credential or workflow change is approved
by that definition decision. The remaining owned baseline/Machine cleanup stays
within existing M03 authority and cumulative limits. The completed native
sequence used44 Management requests: all25 owned definitions match their reviewed
inactive baselines and the dedicated Machine binding is restored. Historical
wrapper native1/formal-closurefalse/fullD:false remain unchanged. Final charged
usage is2078/2000/4078/V358; Control includes the conservative approved512
sequence bound rather than an individually measured HTTP total. The only
remaining delivery gate is normal final-head CI/review and the separate merge
decision; no new live batch is needed.

On26 October2026 Cairo, the owner replied **I Approve merging PR #8 and closing
M03**. All five CI40234431917 jobs and Vercel passed at acceptance head
`c29f18e363b4f79159728489a4464341359a70bb`. This authorizes making PR8 ready and
merging after normal protected checks on the final closure-documentation head.
PR8's successful merge is the M03 closing transition; GitHub's merge record is
authoritative for its time and SHA. No further live acceptance run is needed.
M04 waits for a new owner instruction. Production data/migrations, recurring
activation, paid backfills, notifications and private R2 remain separate.

The b51 recovery entry remains disabled. At the decision checkpoint,
execution31145 was retained and C999 archive was pending; the subsequent
[native containment record](../milestones/M03-n8n-foundation/evidence/functional-acceptance-20261025.json)
records safe isolation and archive/pause without deletion. Existing C01 privacy/retention conditions still apply:
inventory unresolved records, document the disposition and owner follow-up,
and never report restored settings as deletion or unresolved work as settled.
The blocked genuine cleanup/freshness checks remain unperformed. Encrypted dev
originals persist; no new credential or time approval is requested.

One isolated frontend/app-shell or read-only directory slice may proceed in
parallel using stable contracts and labeled fixtures, with no hosted writes.
This is a bounded delivery exception within the current work, not the start of
M04, M09 or M10. Production, recurring activity, external notifications, private
R2, PR #8 merge and advancement to M04 remain separate.

## M04 collector integration — 27 October 2026

**Representative dev packet approved:** the owner replied “Approve the M04
representative dev packet and temporary default-bypass exception.” to reviewed
`c2dc884`. The [approval](../milestones/M04-collectors-vimeo-instagram/evidence/live-test-approval-20261027.json)
authorizes the exact four accounts, target two/max four sequential Instagram
starts, USD1/start/USD4 total, Management160/Control472/Combined632/Vercel64
and six native actions, including the temporary sole/default protection effect,
recovery, restoration and retention. Prior charges remain. Actual provider
expiry/consent and consequential drift remain genuine boundaries; production,
recurring activity, notifications, merge and M05 remain excluded.

The owner started M04 after merged M03 and requested connected Vimeo,
Instagram posts/reels and WF-19 implementation. Use the existing restricted
writer/TLS path with a fixed product-operation adapter; do not extend M03's
closed acceptance windows or introduce another verifier/credential system.

Instagram posts and reels share one owned account claim and parent. Register
all account batches before closing registration; finish/report/release only
after every required pass settles. Reels ingestion preserves the primary
watermark. This replaces the draft secondary-selector/`p_secondary` approach:
an independently selected reels pass cannot establish ownership safely after
the primary releases it. Keep the existing eight-argument report function.
The new M04 RPC and private tables track batch/page receipts and joint completion;
they do not broaden direct table grants or replace historical RPCs.

Native definitions are generated inactive local blueprints until saved and
read back from Cloud. Explicit selected UUIDs are required before a native run
starts. WF-00 fixed-selection native delivery was verified in the accepted
27 October increment; the saved definitions were restored inactive at closure.
New blueprints are local until separately delivered. Official Vimeo runs inline;
fallbacks and Instagram remain asynchronous with durable launch intents, no
automatic paid POST retry, trusted provider identity/input/cost verification
and idempotent paged settlement. Native evidence and real source fixtures
remain separate from local synthetic/code/SQL results.

The approved representative packet is now closed: ten Vimeo records, including
two content duplicates, a zero-new-item rerun, eleven unique Instagram items,
two actors and USD0.046 actual usage. All seventeen dev migrations, retained
rows, persistent credentials, prior charges and verified shutdown remain.

### Maintained product paths after the representative sample

The continued local implementation uses a maintained M04-only WF-19 and a
dedicated WF-90-M04 Error Trigger. It does not activate closed foundation
dispatch, SUB workflows or M03 test windows. The dedicated handler was installed
as `AwxhktgJdvLXE0FZ`, temporarily published before binding under the approved
native save contract, and retained inactive at incremental closure. Future
consumer bindings require verified saved state; no notification/schedule is
authorized. Its fixed `execution.error` operation
reuses `ops.log_workflow_error` through the restricted writer connection. No
run ID, raw message, stack, URL or execution data is accepted. It logs a
deduplicated classification only; failing a parent, releasing a claim or
restarting an uncertain actor requires separate reconciliation evidence.

Vimeo resume cursors bind the resource path and page width. A legacy resumed
page without its original width fails closed rather than skipping history.
Daily pagination caps are incomplete coverage, not successful full traversal.
Instagram daily INPUT uses the claimed watermark minus thirty days (floor
2024-01-01), with a trusted launch timestamp for the normalization horizon.
This adds bounded metrics refresh through duplicate upserts in the daily path;
full weekly WF-40 refresh remains M06. Result caps can still prevent complete
metrics coverage. No new schedule is authorized.

Instagram's provider has no verified historical cursor/upper-date input.
Latest-result expansion is bounded at 3,000, with per-pass checkpoints and an
explicit local history-limit stop when that bound may be saturated. SQL keeps
normalized counts rather than raw per-account counts; final settlement uses
the batch raw count conservatively. This can stop or flag coverage early; it
cannot assert complete history from filtered counts, repeated capped pages or
short reels output. Such a stop retains claims/run records for reconciliation;
the global error handler does not silently release them.

The [incremental dev packet](../milestones/M04-collectors-vimeo-instagram/evidence/incremental-dev-coverage-packet-20261027.md)
was approved at `2c450f4` and is now completed/safely closed at accepted
`6dea884`. Its source observations and limitations are retained, including
four cumulative actors/USD0.8395 and236 selected rows. Neither closed packet
grants substitute collection authority. Production, recurring activity,
notifications, PR13 merge and M05 remain separate decisions.

### History review and HC-01 approval — 27 October 2026

The [local history review](../milestones/M04-collectors-vimeo-instagram/evidence/history-capability-decision-20261027.md)
separates Everyone Vimeo page4/width5 continuation from Instagram coverage
proof. The saved Instagram0.0.831 schema has no exposed history cursor;
3000/latest-limit escalation and `resume_supported:false` are our local
controls, not a proven provider-wide restriction. Dataset EOF, a high limit
or one out-of-order old row cannot certify per-profile history completion.
The unsafe final posts-completion inference is removed; accepted bounded
collection/cost evidence remains unchanged. Source-stop evidence for posts
and reels remains independently unproved.

The linked review records the original pending proposal. The owner subsequently
approved **HC-01** with this exact decision:

> Approve fixed-selector recent Instagram monitoring for the five identified watermarked dev accounts, keeping history incomplete; explicitly defer only Instagram January2024 completeness in dev AC2 to follow-up HC-01-F1. All other criteria, production boundaries and live-spending gates remain unchanged.

This authorizes the narrow local implementation: only the existing fixed M04
daily selector may claim these active, watermarked dev Instagram identities
despite incomplete history: C000 `962c9c7e-aa0f-46ae-911b-3265859e0577`,
C001 `bed82782-753f-4ba9-91ca-691ef36f75c6`,
C130 `46149fb9-8905-4b76-9834-4b38f668a2e2`,
C270 `2d42d451-ac9a-42ac-a879-8760d63c8108`, and
C226 `3ca3befa-abe6-4540-a389-0cf16115c581`.
No future mutable selector can enlarge this exception. The general scheduled
selector remains gated on completed history, and schedules stay off.

Keep incomplete history/cursors, joint posts/reels ownership and registration
barriers, monotonic primary watermarks, reels watermark preservation, claim
fencing and replay safety. Do not force `done`/`not_applicable`; an unverified or
saturated recent result remains incomplete coverage. A forward function
migration and regression tests implement the exception without replaying the
seventeen applied dev migrations. Approval and local qualification are not
evidence of hosted application or successful daily collection.

Only Instagram January2024 completeness in **dev AC2 is deferred, not passed**,
to HC-01-F1. Vimeo AC2, production AC6 and every other criterion remain
unchanged. No live batch, spending increase, Preview/bypass activation,
production operation, recurring schedule, notification, merge, M04 completion
or M05 is authorized by this decision. A complete targeted live estimate and
its separate approval remain required before any new collection.

### M04 development acceptance and M05 sequencing — 28 October 2026

The owner approved the [HC-01 staged live packet](../milestones/M04-collectors-vimeo-instagram/evidence/hc01-staged-live-validation-packet-20261027.md) at reviewed `bb0cd01d3a6ee239540e73b1d366f86e46b17d42`, with the acceptance amendments below. This supersedes its pending-decision and evidence-only stops; historical receipts and the original packet remain unchanged. It is execution authority, not evidence that any new operation succeeded.

Scope remains exact emr-dev `zmotjsbzhzjvpelxvxlf`, the existing five Instagram identities and retained provider/build contract. Apply only migration `20261027192743_m04_recent_instagram_dev_eligibility.sql` after exact17-version preflight/dry-run, preserving all17 originals. Run Everyone posts/reels twice (4 starts), then the other four accounts twice (16 further starts) only after mandatory Stage1 checks pass. At most one reconciled two-start recovery is reserved. Everyone Vimeo is exactly one page4/width5 operation within the packet's retry bound, with no fallback actor. Protected dev setup, seven owned bindings, temporary Machine audience, temporary sole/default bypass, required owned callback/log-only-handler publication, restoration, revocation and shutdown are included. Application authentication and production-build safeguards remain.

The delivery-inclusive baseline is194 Management /775 Control /969 Combined /Vercel74, retaining frozen collection-only193/775/968/V73 and all earlier charges. New ceilings are288/2376/2664/V64; cumulative ceilings are **482 Management /3151 Control /3633 Combined /Vercel138**, with Vercel included in Management. Preserve the packet's exclusive category and recovery/shutdown reserves. At most7 new deliberate native actions and22 new actor starts, USD1/start/USD22 total; retain historical four actors/USD0.8395. Infrastructure charges remain separate. No allowance is a target, refund or scope expansion.

Missing natural metrics/pinned/fallback examples are observation gaps, not automatic Stage2 stops when mandatory checks pass. Incorrect handling of an observed example is a defect. Repeat execution must not duplicate canonical records or AI/media work for unchanged known content; independently attributable new publications may legitimately create new rows/work. Investigate unexpectedly discovered older content separately as a coverage issue. Do not force dates or real watermarks to reduce starts. Security/identity, ownership/settlement, integrity, cost, reserve, uncertain-paid-start and cap/insufficient-recent-coverage stops remain mandatory. Advancing a newest timestamp does not certify uncapped recent coverage.

**Development acceptance is separate from original full Done and rollout.** Only after essential checks and planned validation pass, record exactly **“M04 development accepted; coverage and rollout obligations open.”** Essential checks are hosted HC-01 with the exact five-account exception; actual five-account posts/reels plus repeats through selector/workflow/provider/callback/DB; correct joint claims/registration/completion/replay/duplicate/queues; truthful incomplete history and watermarks; reconciled costs and attempted work; restored configuration/verified shutdown; and ordinary required CI for delivered code. Metrics still needs meaningful normalization→ingestion→actual-DB evidence of timestamp advancement with unchanged AI/no redundant queue, using retained data if natural re-observation is absent. Failure handling still needs focused affected-contract proof for escalation, claim release, retry/terminal classification and duplicate-side-effect safety; no new live failure campaign/notification is authorized.

The exact obligations approved deferred from development acceptance remain open, with evidence/future triggers in the existing [M04 criteria map](../milestones/M04-collectors-vimeo-instagram/evidence/criteria-mapping-20261027.md): Instagram January2024 history HC-01-F1; residual Everyone Vimeo history after the authorized page (cursor correctness stays mandatory); missing real old-pinned and fallback/source examples; unavailable natural recent-metrics re-observation after meaningful integration proof; full-five Vimeo daily-repeat breadth; exact native parent/error-execution UI pairing and live consecutive-failure demonstration; production AC6/production AC7, production copies/backfill, recurring overlap and health-email delivery. Unverified fallbacks stay disabled/unreachable. General scheduled Instagram eligibility still requires complete history: resolving incomplete-history production monitoring is a separate launch issue, not an expansion of HC-01. No observed defect is waived or missing evidence marked passed.

After actual essential M04 acceptance and CI-green delivery, start M05 local development on a separate branch from that head, with a stacked draft PR targeting the M04 branch while PR13 remains draft/unmerged. Retarget/rebase only after a separate merge decision. M05 authority covers source-contract research, local website/YouTube/LinkedIn collectors, local migrations/tests, docs, scoped commits, draft delivery, required CI and ordinary protected Previews using stable contracts and honestly labeled examples/fixtures. Prepare a complete M05 live estimate when concrete; M04 allowance grants no M05 paid captures/AI, hosted migrations, activation, recurrence, notifications or production.

The protected older root/M03 boards remain stale pointers; the permitted current M04 record carries this authoritative sequencing exception. Do not bypass their enforced write restriction. Leave the denied optional staged-input JSON generation/probe unperformed; do not recreate it via a new filename, shell, tool or indirect script. An independently permitted existing execution path may proceed with required validation intact. Production, recurring activation, notifications, private R2, PR merges and direct main pushes remain excluded.

**Actual outcome28October:** **M04 development accepted; coverage and rollout obligations open.** [Actual results](../milestones/M04-collectors-vimeo-instagram/evidence/hc01-dev-results-20261028.md) establish allfive Instagram accounts twice,20 settled actors/USD0.2300, actual recent-metrics/unchanged-AI proof, correct Vimeo page4→page5 cursor,18 hosted dev versions and verified restoration/shutdown. Application948e618 passed all five CI40612074064 jobs; final result-head normal CI remains required before creating M05's separate stacked branch. The exact remaining obligations stay open and PR13 remains draft/unmerged; original full Done, production readiness and M05 start are not claimed by this record.

## M05 local contract corrections — 28 October 2026

M05 starts from M04 development acceptance at `d7daebe`, CI40617832325 all five jobs green, on a separate stacked branch. No live/production authority transfers. See the [M05 local evidence](../milestones/M05-collectors-web-youtube-linkedin/evidence/local-implementation-20261028.md).

Current official source contracts require these technical corrections to the older draft; they do not waive M05 acceptance:
- Preserve the existing SHA256-first32 website identity with lowercase host and case-preserved path, stripping query/fragment/trailing slash consistently. Never switch to FNV or lowercase case-sensitive paths. Firecrawl v2 map link objects are discovery, not exhaustive history. Preserve discovered-but-uncrawled URLs and failed retries.
- Website actor INPUT is fixed to public-only robots-respecting collection, strict certificate validation, no session rotation, cookies, downloads, HTML files, screenshots or AI. Thin public JS pages have one exact owned adaptive retry; login/CAPTCHA pages cannot enter that retry.
- YouTube resolves the actual uploads playlist returned by channels.list, reserves quota before each call using the Pacific day, and accepts EOF as source-exhaustion proof. Undocumented uploads order cannot make the first old/known row an EOF certificate. Page caps retain a bound opaque cursor and incomplete history. The original duration≤60 rule is explicitly a heuristic, not verified Shorts identity; paid fallback remains disabled.
- LinkedIn company repost/video and Short current-company shapes need real examples. Unknown ownership fails closed and costs the terminal observation. A bounded employee query stores a partial four-field observation, never a full headcount or inferred departures/hires. The complete-source comparison path stays blocked until a supported attestation exists; this is a remaining original criterion, not a silent deferral.
- Preserve the first same-capture-date employee snapshot. Exact replay is a no-op; a changed second observation conflicts without overwriting and its separate actor cost still settles once. Existing people are not overwritten.

Required tests and full migration/type parity remain. Actual fixtures, hosted migration/staging, native delivery, source coverage, three-day operation, production and merge remain separately unverified/gated. No new credential or acceptance framework is introduced.
