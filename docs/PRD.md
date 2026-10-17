# PRD — everyone. Market Radar

Version 1.0 · 17 Oct 2026 · Owner: Mohamed Abdelrahman (mohamed.abdelrahman@everyone.film)
Binding decisions: `docs/DECISIONS.md`. Technical design: `docs/TECHNICAL.md`. UI: `DESIGN.md`.

---

## 1. Summary

everyone. Market Radar is an internal market-intelligence product for **everyone.** (Everyone Films), a production house with offices in Cairo, Riyadh and Dubai. Every day it collects what competing production houses publish on **Vimeo, Instagram, their websites, LinkedIn and YouTube**. AI turns each new item into structured intelligence: which brand it was for, which agency, which people were credited, what kind of work it is, which occasion, which country. Items are grouped into campaigns. The team reads it in a web app (market pulse, feed, campaigns, competitor profiles, brands, agencies, people, search, weekly briefs). AI agents read and act through a REST API and an MCP server.

## 2. Problem

- Competitor work appears across dozens of accounts and five platforms. Nobody can watch 284 companies every day by hand.
- When the team pitches a client, it cannot quickly answer: "Who has this brand worked with? Which production house did their last Ramadan film? Which agency hires whom?"
- Market shifts (a competitor winning a new telecom client, a new director joining a house, a surge of AI-produced ads) are noticed late or not at all.
- What competitive knowledge there is lives in people's heads and scattered screenshots, not in a searchable, shared record.

## 3. Goals and non-goals

### Goals (v1)
1. **Coverage:** every new public item from every tracked account on the five platforms is captured within 24 hours (stories within 12–24 hours while live).
2. **Understanding:** each commercial item is identified with brand, agency, production house, credits, format, occasion and country, auto-published at ≥ 0.80 confidence, with the rest reviewed.
3. **Answers in two clicks:** from a launch to its competitor, brand, agency and crew, and back.
4. **Search:** keyword and semantic ("Ramadan telecom films with a comedy tone") across everything, plus "find similar".
5. **Rhythm:** a weekly brief per country and market-wide, a daily email digest, and instant alerts for big launches.
6. **Agent-ready:** full API + MCP so agents can query and act with scoped keys.
7. **Cost-transparent:** the system answers "what does it cost to run?" from a real cost ledger.

### Non-goals (v1)
- Ad libraries (Meta, Google, TikTok) — out of scope.
- LinkedIn job postings — out of scope (LinkedIn employees are in scope as a weekly snapshot).
- TikTok, Facebook, Behance, X and other platforms — not scraped.
- Video download, transcription or audio analysis.
- Metric history and trend curves per post (latest snapshot only).
- Private or logged-in data of any kind.
- Public or client-facing access; this is an internal tool.
- A native mobile app (the web app must work well on mobile browsers).

## 4. Users and personas

| Persona | Who | What they need | Typical session |
|---|---|---|---|
| **Researcher** | Market/research team | Complete, correct records; review queue; corrections | Daily: feed, review queue, fix entities |
| **Analyst** | Strategy, business development, bidding | Patterns: who works with whom, share of output, formats, occasions | Several times a week: campaigns, compare, brands, search |
| **Executive / management** | Founders, heads of production, business leads | What changed this week, threats and opportunities | Weekly: brief, market pulse, alerts email |
| **Admin (owner)** | Mohamed | Add competitors, approve sources, users, keys, watch pipeline and cost | Ad hoc: admin pages |
| **AI agent** | Claude, Codex, other agents | Structured data and actions through API/MCP | On demand |

App roles: `viewer` (read everything), `analyst` (viewer + review/correct), `admin` (everything, incl. users, keys, sources, costs). Everyone sees all data.

## 5. Scope by platform

| Platform | Collected | Cadence | History |
|---|---|---|---|
| Vimeo | New videos: title, description, credits text, duration, thumbnail, plays/likes, tags, upload date | Daily | From 1 Jan 2024 |
| Instagram | Posts, reels, carousels: caption, tagged users, mentions, hashtags, thumbnail/display image, likes/comments/views, timestamp | Daily | From 1 Jan 2024 |
| Instagram stories | Live stories (24h) without login: media thumbnail, mentions/tags if exposed, timestamp | Daily (every 12h if the pilot shows misses) | None (starts day one) |
| Websites | New project/work pages: title, client, credits, description, embedded video links, images; client-logo pages; news pages | Daily diff (new URLs only) | Backfill of all existing work pages |
| LinkedIn | Company posts (text, media, reactions, date); company employees (weekly snapshot: headcount, names, titles) | Posts daily; employees weekly | Posts from 1 Jan 2024 |
| YouTube | New uploads: title, description, thumbnail, views, publish date | Daily | From 1 Jan 2024 |
| News & awards | Mentions of competitors and their clients on Google News and trade/award sites | Weekly (SerpAPI) | From 1 Jan 2024 where search allows |

## 6. Functional requirements

IDs are referenced by milestones and tests. MUST = v1; SHOULD = v1 if time allows; COULD = later.

### 6.1 Competitors and accounts
- **FR-C1 (MUST)** Seed 284 competitors + baseline from `data/competitors.csv` and their accounts from `data/competitor_accounts.csv`, keeping company IDs (C000–C284), markets, categories, in-house capabilities, logo URL, pilot rank and priority tier.
- **FR-C2 (MUST)** Each competitor has tracked accounts per platform (handle, URL, resolved external ID, status, watermark, next due time).
- **FR-C3 (MUST)** Admin can add a competitor and its accounts in the app; adding one triggers onboarding (validate accounts → backfill from 1 Jan 2024 → daily tracking).
- **FR-C4 (MUST)** Admin can pause/resume a competitor or one account, and change a tier (pilot / next wave / adjacent).
- **FR-C5 (MUST)** Account health is visible: last success, last error, items found, consecutive failures.
- **FR-C6 (SHOULD)** Suggested new accounts (e.g., a Vimeo link found in a website page) appear for admin approval, never auto-tracked.

### 6.2 Collection
- **FR-S1 (MUST)** Daily collection for all due accounts on the five platforms, only items newer than each account's watermark.
- **FR-S2 (MUST)** One-time backfill per account from 1 Jan 2024.
- **FR-S3 (MUST)** Insert-only-if-new on `(platform, external_id)`; a content fingerprint links re-posts instead of re-analysing them.
- **FR-S4 (MUST)** Metric snapshot refresh for items from the last 30 days: daily for free APIs (Vimeo, YouTube), weekly for paid sources (Instagram, LinkedIn) through the weekly 30-day listing that also does the removal check.
- **FR-S5 (MUST)** Weekly removal check for the last 90 days; missing items marked `removed`.
- **FR-S6 (MUST)** Every run logs: account, items seen, items new, status, error, provider cost.
- **FR-S7 (MUST)** No logins, cookies or CAPTCHA solving. An actor that needs them is disabled for that source.
- **FR-S8 (MUST)** Weekly news and awards via SerpAPI per competitor and per known client.

### 6.3 AI understanding
- **FR-A1 (MUST)** Every new item gets one extraction call returning the v1 schema (`reference/json-schemas/item_extraction.v1.json`): commercial-work flag, content type, brand, brand industry, campaign title, agency, production house, credits, country, language, occasion, summaries (EN/AR), caption translation, tags, per-field confidence, evidence.
- **FR-A2 (MUST)** Overall confidence ≥ 0.80 → published automatically; below → review queue.
- **FR-A3 (MUST)** Brands, agencies and people resolve to existing records via aliases (exact → fuzzy → embedding). New names create records flagged `unconfirmed` until seen twice or confirmed.
- **FR-A4 (MUST)** Thumbnails/key frames go to the model (vision) only when the text is too thin to identify the brand.
- **FR-A5 (MUST)** Every AI result stores model, prompt version, schema version, tokens and cost.
- **FR-A6 (MUST)** Embeddings for items, campaigns, competitors and briefs.
- **FR-A7 (MUST)** Campaign linker groups items: same brand + same production house + within a time window (default 45 days) + embedding similarity; uncertain merges go to review.
- **FR-A8 (MUST)** Reviewer approvals and corrections teach the alias table and are never overwritten by later AI runs (`locked_by_human`).

### 6.4 Web app
Full site map and screen specs: `DESIGN.md` §8.
- **FR-W1 (MUST)** Google sign-in restricted to the allowlist; roles viewer/analyst/admin.
- **FR-W2 (MUST)** Market pulse (home): new today/this week by country; most active competitors; new and returning clients; recent big launches; pipeline status strip.
- **FR-W3 (MUST)** Live feed: every new item, newest first, with thumbnail, competitor, platform, brand, format; filters (country, platform, competitor, brand, agency, format, occasion, industry, date, confidence, status); grid/list toggle; infinite scroll; open at source. Each item has a detail view (`/items/[id]`, also opened as a drawer from the feed) used for deep links from emails, briefs and the API.
- **FR-W4 (MUST)** Campaigns list + campaign detail (all items across platforms, credits, AI summary, similar campaigns, timeline).
- **FR-W5 (MUST)** Competitors list (logo, category, country, tier, activity score, last post) + competitor profile tabs: overview, campaigns, posts by platform, clients, agencies, people, team (LinkedIn employees snapshot), news, accounts & health, in-house capabilities.
- **FR-W6 (MUST)** Compare 2–4 competitors: volume over time, clients, industries, platforms, formats, occasions.
- **FR-W7 (MUST)** Brands, agencies, people: lists and detail pages with relationship history.
- **FR-W8 (MUST)** Markets dashboards for EG, KSA, UAE.
- **FR-W9 (MUST)** Search: one box, hybrid keyword + semantic across items, campaigns, brands, agencies, people, news; "find similar" from any item or campaign.
- **FR-W10 (MUST)** Review queue: low-confidence results, new entities, uncertain campaign merges; approve, correct, merge, reject; keyboard-friendly.
- **FR-W11 (MUST)** Briefs: weekly briefs per country + market-wide, each claim linked to source items.
- **FR-W12 (MUST)** News: weekly news and awards linked to competitors and brands.
- **FR-W13 (MUST)** Alerts settings: which events email whom (digest, instant launch, new client for a competitor, budget alert).
- **FR-W14 (MUST)** Admin: competitors & accounts, taxonomies, pipeline (runs, failures, per-source health, re-run), costs (per day/month/provider/platform/competitor, per new item, forecast, budget alert), users & roles, API keys.
- **FR-W15 (MUST)** API docs page for the agent API and MCP tools.
- **FR-W16 (SHOULD)** Saved views (filters) and shareable links.
- **FR-W17 (SHOULD)** CSV export of any list.
- **FR-W18 (COULD)** Arabic UI locale.

### 6.5 Briefs, alerts, publishing
- **FR-B1 (MUST)** Every Monday 08:00 Cairo: brief per EG, KSA, UAE + market-wide (launches, most active competitors, new and returning clients, agency–production pairings, notable team changes, news, week-over-week changes), every claim cited to items.
- **FR-B2 (MUST)** Daily digest email 09:00 Cairo to recipients; instant email for big launches (rule-based: a top-50 competitor + a TVC/brand film + a known major brand, or a configurable rule).
- **FR-B3 (MUST)** After each pipeline run, n8n triggers revalidation so cached pages refresh.
- **FR-B4 (MUST)** Budget alert email if a day's cost goes above a set limit.

### 6.6 Agent API and MCP
Full spec: `docs/API_SPEC.md`.
- **FR-G1 (MUST)** Versioned REST API `/api/v1` and MCP server `/api/mcp` with the same capabilities.
- **FR-G2 (MUST)** API keys hashed, scoped (read / write / admin), rate-limited, logged; created and revoked by admin.
- **FR-G3 (MUST)** Tools: search, get/list competitors, campaigns, items, brands, agencies, people, briefs, news, market stats; write: add competitor, approve/correct review, trigger re-scrape (admin).

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Freshness | New public items visible in the app within 24h of publication (stories: while still live). |
| Performance | Cached pages TTFB < 300 ms at p75; feed and search results < 1.5 s at p75; search over 100k items < 800 ms DB time. |
| Availability | Web app 99.5% monthly; a failed collector never blocks others; failures retried and alerted. |
| Accuracy | Brand identification ≥ 90% correct on the pilot sample among auto-published items; production-house attribution ≥ 95%; measured in M12. |
| Cost | Every paid call in the cost ledger; Costs page forecast within ±20% after the pilot. |
| Security | RLS everywhere; allowlisted Google sign-in; no service key in browser or n8n; secrets only in Vercel/n8n credential stores; API keys hashed; audit log for admin and write actions. |
| Privacy & ethics | Public data only; respect robots and rate limits where the tool exposes them; store people only as credited professionals (name, role, organisation); no personal contact data. |
| Language | Arabic and English content render correctly (RTL, Arabic font, `dir="auto"`); search works in both. |
| Accessibility | WCAG 2.2 AA for contrast, focus, keyboard navigation, alt text. |
| Responsive | Works from 375 px to 2560 px; key flows (feed, campaign, brief, search) fully usable on mobile. |
| Observability | Pipeline page shows every run; error workflow emails after repeated failures; daily health summary. |
| Maintainability | All schema changes as migrations; workflows exported to the repo; prompts and schemas versioned. |

## 8. Success metrics

| Metric | Target (end of pilot) | Target (3 months after scale-up) |
|---|---|---|
| Accounts with a successful run in the last 48h | ≥ 95% | ≥ 97% |
| Items auto-published (≥ 0.80) | ≥ 70% | ≥ 80% |
| Brand accuracy on audited sample | ≥ 90% | ≥ 93% |
| Review queue median age | < 3 days | < 2 days |
| Weekly active users (of invited) | ≥ 60% | ≥ 70% |
| Briefs opened per week (management) | ≥ 3 people | ≥ 5 people |
| Cost per new item | known and reported | within the forecast |

## 9. Release plan

1. **Foundations** (M00–M03): repo, database, seed data, n8n foundation.
2. **Collection + AI** (M04–M08): collectors, AI pipeline, campaign linker; **the 14-day pilot on the top 50 starts at the end of M08**.
3. **Web app** (M09–M11), built during the pilot against pilot data.
4. **Pilot gate** (M12): accuracy, cost, threshold tuning; owner go/no-go.
5. **Intelligence outputs** (M13): news/awards, weekly briefs, alerts.
6. **Agents** (M14): API + MCP.
7. **Scale & launch** (M15): all 284 competitors, onboarding flow, hardening, production launch.

Details: `docs/DEVELOPMENT_PLAN.md`.

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| An approved actor breaks or changes output | Missing data for a platform | Normalizer per actor with contract tests; fallback actor (Vimeo: dltik; stories: 3 candidates; YouTube: official API first); account health alerts |
| Story actors need login | No stories | Use only actors that run without login (D-24); if none works, stories are disabled and flagged in OPEN_QUESTIONS |
| Instagram rate limits / blocks | Gaps | Batched daily runs, Apify proxies, retry with backoff, watermark-based small requests |
| AI misattributes brand or production house | Wrong intelligence | Confidence threshold, evidence field, review queue, human locks, audited sample in M12 |
| Cost overrun on backfill | Budget surprise | Backfill in waves, cost ledger live from day one, daily budget alert |
| n8n execution limits or timeouts | Failed runs | Async Apify runs with webhook callbacks, batching per execution, small sub-workflows |
| Arabic text handling | Poor search/summaries | Arabic-aware full-text config (`simple` + unaccent + trigram), embeddings multilingual, bilingual summaries |
| Legal/ToS concerns | Reputational | Public data only, no login, no media downloads beyond thumbnails, people stored only as credited professionals |

## 11. Assumptions

- The competitor sheet is the verified starting list; links marked "Not verified" are not tracked.
- The owner creates accounts and keys for Supabase, Vercel, n8n, Apify, OpenAI, SerpAPI, Firecrawl, Vimeo and Google Cloud when a milestone asks (see `docs/MANUAL_ACTIONS.md`).
- Email goes out through an SMTP or transactional email provider the owner chooses in M13 (default proposal: Resend or Google Workspace SMTP).

## 12. Glossary

| Term | Meaning |
|---|---|
| Item | One public post, reel, story, video, project page, LinkedIn post or news article. |
| Campaign | A group of items for one brand by one production house close in time. |
| Watermark | The newest published time / external ID stored per account; collectors only ask for items after it. |
| Baseline | Everyone Films, tracked like a competitor for benchmarking. |
| Pilot | The first 14 days on the top 50 competitors. |
| Review queue | Items, entities and merges that need a human decision. |
