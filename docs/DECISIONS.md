# Decision log — everyone. Market Radar

Every product and technical decision that is already settled. Codex treats this file as binding. A change to any line needs the owner's approval and a new dated entry at the bottom ("Changes").

Owner: Mohamed Abdelrahman (mohamed.abdelrahman@everyone.film) — product owner, maintainer and approver.

## Product

| # | Topic | Decision |
|---|---|---|
| D-01 | Name | **everyone. Market Radar** (lowercase "everyone." with the period). Uses the everyone. wordmark from `assets/brand/`. |
| D-02 | Purpose | The company's "eyes and ears": see every new commercial, brand film, post, story and project from competing production houses the day it appears, and understand who made it for which client. |
| D-03 | Users (v1) | Market researchers, analysts, executives and management at everyone. The social media team comes later. All signed-in users see all data. |
| D-04 | Competitors | 284 production houses in the competitor sheet, plus **Everyone Films as the baseline** (benchmark, `is_baseline = true`). Any competitor added later is picked up by the same pipeline automatically. |
| D-05 | Pilot | Starts with the **top 50** competitors (sheet column AE "Pilot rank" 1–50; tier "A · Pilot"): 19 Egypt, 15 KSA, 16 UAE, plus the baseline. Then scales to all 284. |
| D-06 | Markets | Egypt (EG), Saudi Arabia (KSA), UAE. Any company that is not KSA or UAE counts as EG for briefs. |
| D-07 | Platforms in scope | **Only**: Vimeo, Instagram (posts, reels, carousels, stories), websites (work/portfolio pages), LinkedIn (company posts + company employees), YouTube. **No other social platform is scraped.** TikTok, Facebook, Behance, X, Threads, Snapchat, Pinterest and Dribbble links stay in the data for reference only. More actors can be added later on the owner's approval. |
| D-08 | Out of scope | Ad libraries (Meta, Google Ads Transparency, TikTok ads) — **out of scope**. LinkedIn job postings — **out of scope**. Video transcription — out of scope. Metric history — out of scope (latest snapshot only). |
| D-09 | News and awards | In scope, **weekly, via SerpAPI** (Google News + Google search on award/trade sites). |
| D-10 | History | Backfill from **1 Jan 2024** to today for every in-scope platform. Stories cannot be backfilled; capture starts on day one (highlights only if an actor returns them without login). |
| D-11 | Cadence | All in-scope platforms checked **daily**. LinkedIn employees: weekly snapshot. News and awards: weekly. |
| D-12 | Only-new scraping | Never re-scrape what is stored. Per-account watermarks, insert-only-if-new, content fingerprints (see TECHNICAL §5). |
| D-13 | Metrics | Latest snapshot only (views, likes, comments, plays), refreshed for items from the last 30 days: daily on free APIs (Vimeo, YouTube), weekly on paid sources (Instagram, LinkedIn). |
| D-14 | Removals | Items a source no longer returns are marked `removed`, never deleted. |
| D-15 | Other entities | Clients/brands, agencies and people (credits) are first-class records with their own pages. |
| D-16 | Campaign rule | Same brand + same production house + close in time = one campaign. The same client returning later = a new campaign. |
| D-17 | Credits taxonomy | Roles and taxonomies as in `docs/TAXONOMIES.md`, editable in admin. |
| D-18 | Language | Store the original text (often Arabic) plus an English translation and English + Arabic summaries. UI is English-first and Arabic-ready (RTL-safe content, `dir="auto"`). |
| D-19 | Media | Keep thumbnails and key frames only (Supabase Storage). Link to the full video at the source. No video downloads. |
| D-20 | Briefs | Weekly AI brief per country (EG, KSA, UAE) plus market-wide, every Monday. |
| D-21 | Alerts | Email. Daily digest + instant alerts for big launches. Recipient: **mohamed.abdelrahman@everyone.film** (more recipients configurable in the app). |
| D-22 | Search | Keyword + semantic search and "similar campaigns" are core features. |
| D-23 | Agents | Full REST API + MCP server so Claude, Codex and other agents can search, read and act. |
| D-24 | Scraping scope | **Public data only.** No logins, no cookies, no session accounts, no CAPTCHA solving. If an actor needs a login, that source is skipped. |
| D-25 | Budget | No hard cap; the system must report its own running cost (cost ledger + Costs page + forecast). |
| D-26 | Maintenance | The owner maintains the system and onboards users personally. |

## Technical

| # | Topic | Decision |
|---|---|---|
| T-01 | Source of truth | **Supabase** (Pro plan). Separate **dev** and **prod** projects. |
| T-02 | Orchestration | **n8n Cloud** (queue mode; 50K workflow runs available). n8n schedules all jobs. Codex builds workflows through the n8n MCP connection; every workflow is also exported as JSON into `n8n/workflows/`. |
| T-03 | Web app | **Next.js (App Router, TypeScript) on Vercel**. Cached pages, revalidated on demand when n8n publishes. |
| T-04 | Repo | GitHub `muhhammeddsayedd-prog/Everyone-Market-Researcher` (empty at start). |
| T-05 | AI | **OpenAI**: structured outputs (strict JSON schema) for per-item extraction, a stronger model for briefs and hard cases, `text-embedding-3-small` (1536 dims) for embeddings. Model names live in env vars and are chosen in M07 after an eval. |
| T-06 | Auto-publish | AI results with confidence **≥ 0.80** publish automatically; below goes to the review queue. Tuned after the pilot (M12). |
| T-07 | Scraping tools | Apify (approved actors only, see `docs/SCRAPING_SOURCES.md`), Vimeo API and YouTube Data API (official keys approved), SerpAPI (news/awards), Firecrawl (website URL maps). |
| T-08 | Approved Apify actors | Vimeo: `goat255/vimeo-scraper`, `dltik/vimeo-scraper`. Instagram: `apify/instagram-scraper`. Stories: `data-slayer/instagram-stories-scraper`, `igview-owner/instagram-story-viewer`, `louisdeconinck/instagram-story-details-scraper`. Websites: `apify/website-content-crawler`. LinkedIn: `harvestapi/linkedin-company-posts`, `harvestapi/linkedin-company-employees`. YouTube: `streamers/youtube-scraper`. |
| T-09 | Writes | n8n writes **only** through RPC functions using a dedicated Postgres login role `n8n_writer`. Never the service/secret key, never public API keys. |
| T-10 | Queue | Database queue (Supabase Queues / `pgmq`) holds the AI backlog. n8n schedules and drains it. |
| T-11 | Auth | Google sign-in via Supabase Auth, **invite-only**: the owner invites each email with a role. Optional switch: allow any `@everyone.film` Google account as viewer (`app.allowed_domains`, off by default). |
| T-12 | Agent API access | Hashed API keys with read / write / admin scopes, rate-limited, every call logged. The API reads the same RLS-protected data as the app through a dedicated `api_agent` role — never the service key. |
| T-13 | Security | RLS on every exposed table, `security_invoker` views, no `SECURITY DEFINER` in exposed schemas, no secrets in `NEXT_PUBLIC_*`, scoped tokens for CLI/MCP. |
| T-14 | Delivery | Milestone by milestone (`milestones/`), each with its own PROGRESS.md that Codex keeps current. |

## Changes

| Date | Change | Approved by |
|---|---|---|
| 2026-10-17 | M01 implementation record: generated `handle_norm` account key; `finish_run` JSON summary; cadence-minus-four-hours success scheduling; preserved normalized credits/media; clean invoker hybrid search. `DATA_SCHEMA.md` RPC milestone labels and `TECHNICAL.md` draft scheduling now match the specific M01 handoff. No binding product, tool, access or production gate changed. | Specified by M01 T4–T7; implementation details recorded for review |
| 2026-10-17 | Pilot backfills (M04–M06) and the M07 AI backlog run once in **prod** after the owner approves each estimate (MA-14, MA-15, MA-17), to avoid paying twice; prod schedules stay off until M08. Media v1 (WF-31) moves to M06 because story/Instagram CDN URLs expire. Stories bake-off runs 7 days. | Proposed in the handoff pack; owner confirms at MA-14 |
| 2026-10-17 | Initial decision set from the brainstorm and the architecture doc (rev 95). Ad libraries and LinkedIn jobs moved out of scope; news/awards via SerpAPI; stories only without login. | Owner |
