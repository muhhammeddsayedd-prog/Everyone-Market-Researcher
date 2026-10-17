# M13 — News, briefs, alerts

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first.

## 1. Goal and outcome

The system starts **talking to people**. When M13 is done:
- **Weekly news and awards:** collected every Sunday through **SerpAPI**, deduplicated by URL, linked to competitors and brands, and shown on `/news` and on profile tabs. Built as **WF-22 News** and **WF-23 Awards**.
- **Weekly briefs:** written every **Monday 08:00 Cairo** for **EG, KSA, UAE and ALL** (**WF-50**). Every claim cites item or campaign IDs. Briefs are saved, embedded, shown on `/briefs` and `/briefs/[week]?scope=…`, and emailed.
- **Alerts (WF-80)** go out by email:
  - a **daily digest at 09:00 Cairo**;
  - **instant launch** alerts;
  - **new client for a competitor**;
  - **failing sources**;
  - **budget**;
  - **weekly brief**.

  Recipients come from `app.alert_rules`. The default is `mohamed.abdelrahman@everyone.film` (D-21).
- **Live pages (WF-70 Publish / revalidate):** runs after every pipeline run with the exact cache tags that changed, so pages update without a redeploy.
- **`/settings/alerts`:** wired to `app.alert_rules`. Admins edit any rule; members add or remove themselves.

## 2. Context you need

- **Decisions:**
  - D-09: news and awards are in scope, **weekly, via SerpAPI only**.
  - D-20: weekly briefs per country plus market-wide, every Monday.
  - D-21: email alerts, a daily digest plus instant alerts for big launches; recipient mohamed.abdelrahman@everyone.film.
  - D-06: companies that aren't KSA or UAE count as EG in briefs.
  - D-08: ads and LinkedIn jobs are out of scope. Do not add ad sections to briefs or alerts.
- **Schedule** (N8N_WORKFLOWS §2, Cairo time; every workflow's timezone setting = Africa/Cairo; all slots live in WF-00's Schedule Trigger):

  | When | What |
  |---|---|
  | Sunday 07:00 | WF-22 News |
  | Sunday 07:30 | WF-23 Awards |
  | Monday 08:00 | WF-50 Briefs |
  | Daily 09:00 | WF-80 daily digest |
  | Daily 09:15 | WF-91 health (already exists; it calls WF-80 for `budget` and `failing_sources`) |

- **SerpAPI queries** (SCRAPING_SOURCES §7):
  1. **News per competitor:**
     - `engine=google_news`, `q="<competitor name>"`;
     - `gl=eg|sa|ae` by the HQ market, `hl=en`, plus a second `hl=ar` run when `name_ar` is known;
     - keep results from the last 8 days. The first run goes back as far as the engine returns; Google News returns ~100 recent results, so the backfill is shallow (accepted).
  2. **News per top brand:**
     - the top 30 brands by item count in the last 90 days;
     - `q="<brand> commercial OR campaign OR إعلان"`.
  3. **Awards and trade:**
     - `engine=google`, one query per site per week, with `tbs=qdr:w`;
     - `site:<domain> (Egypt OR Saudi OR UAE OR Dubai OR Riyadh OR Cairo)`;
     - sites: `adsoftheworld.com`, `lbbonline.com`, `campaignme.com`, `dubailynx.com`, the Effie MENA site (**verify the current domain** before use, for example `effie-mena.com`, and record it in PROGRESS), `shots.net`, `arabad.net`, `arabianbusiness.com`;
     - `kind = 'award'` for award sites (Ads of the World, LBB, shots, Dubai Lynx, Effie). Trade press (Campaign ME, ArabAd, Arabian Business) is `kind = 'news'` unless the title mentions an award.
  4. **Cost:** 1 search = 1 SerpAPI credit (≈ $0.015 on the default plan; confirm the plan in MA-24).

     | Weekly searches | Pilot | Full |
     |---|---|---|
     | Estimate | ≈ 140 | ≈ 620 |

- **Normalizer:** N8N_WORKFLOWS §7.10 (SerpAPI) gives `{url, kind, title, source_name, published_at, snippet, language, query, mentions[]}`. Strip `#fragment` from URLs. `published_at` comes from `iso_date` when present; otherwise parse SerpAPI's date string; otherwise null.
- **Tables:**
  - `app.news_articles` (`url` unique, `kind` news|award, `title`, `source_name`, `published_at`, `snippet`, `language`, `summary_en`, `query`, `search_tsv`);
  - `app.news_mentions` (polymorphic: `entity_type` competitor|organization|person|campaign);
  - `app.briefs` (unique `(week_start, scope)`, `body_md`, `highlights` jsonb `[{claim, item_ids[], campaign_ids[]}]`, `source_item_ids[]`, `model`, `prompt_version`);
  - `app.alert_rules` (`kind` ∈ daily_digest, instant_launch, new_client, budget, failing_sources, weekly_brief; `filters` jsonb; `recipients[]`; `active`).
- **Brief prompt and schema** (canonical names):
  - prompt `reference/prompts/weekly_brief.v1.md`;
  - Structured Outputs schema `reference/json-schemas/weekly_brief.v1.json` (`title`, `headline`, `body_md`, `highlights[]`, `data_quality_note`);
  - model env `OPENAI_MODEL_BRIEF` (AI_PIPELINE §2; stronger model; 4 calls per week);
  - copy both files to `n8n/prompts/` like the M07 prompts;
  - **citations** in `body_md` use `[item:<uuid>]` and `[campaign:<uuid>]`, and the app turns them into links.
- **Brief sections** (prompt):
  1. Headline
  2. Launches of the week (3–7)
  3. Most active competitors (top 5 vs last week)
  4. Clients (new and returning)
  5. Agency–production pairings
  6. Team moves (from `app.employee_snapshots`: senior joins and leaves)
  7. News & awards (≤ 5)
  8. What to watch
- **Helper RPCs to add in M13** (N8N_WORKFLOWS §8): `ops.get_news_queries(kind, limit)`, `ops.upsert_news(articles)`, `ops.get_brief_inputs(week_start, scope)`, `ops.save_brief(week_start, scope, brief)`, `ops.get_alert_payload(kind, ctx)`, `ops.log_alert_sent(kind, ctx)`, `ops.get_digest(since)` (used inside `get_alert_payload` for `daily_digest`). All are `SECURITY DEFINER` in `ops`, `search_path = ''`, EXECUTE only for `n8n_writer` (DATA_SCHEMA rules; TECHNICAL §12).
- **Instant launch rule** (OPEN_QUESTIONS Q-06, default until the owner decides). An item triggers an instant alert when **all** of these hold:
  - competitor `priority_tier ∈ (pilot, baseline)` (after M15: configurable tiers in `filters.tiers`);
  - `content_type ∈ (tvc_brand_film, digital_film_online_video)`;
  - `ai_status = 'published'`;
  - the brand is `confirmed` and has ≥ 2 items in 7 days.

  **OR** a brand last seen with Everyone Films (baseline) appears with a different competitor (a "client poached" alert).

  Encode the rule in SQL `ops.match_instant_rules(item_ids uuid[]) returns jsonb` (called by WF-30 after apply). Filters in `alert_rules.filters` can narrow it (markets, tiers, competitors, formats).
- **New client rule:** a brand seen with a competitor for the **first time** (no earlier `published` item for that brand and competitor pair). It goes into the daily digest by default; instant only if the rule has `filters.instant = true`.
- **Email:**
  - **Provider:** chosen in MA-23. The default is Resend (Q-03) through an HTTP node with the `Email (Resend)` credential; the alternative is the n8n Email node over SMTP.
  - **Sending domain:** must be verified (SPF/DKIM). From: `everyone. Market Radar <radar@<verified-domain>>`.
  - **Subjects:** ≤ 70 characters, starting with the event (DESIGN.md §10 content rules), for example "New TVC: Vodafone Egypt × Good People", "Weekly brief · KSA · 12 Oct", "Daily digest · 14 new launches".
  - **Template:** DESIGN.md §12 (email template) and DESIGN_STYLE.md:
    - a black header with the white **everyone.** wordmark PNG (`assets/brand/everyone-wordmark-on-black.png`, hosted in Storage `media/brand/`);
    - a black or very dark body with white text, gray `#7d7f82` micro-labels, and links in accent green `#00cd6d`;
    - a General Sans font stack with fallback `Arial, Helvetica, sans-serif`;
    - a 600 px table layout, inline CSS, dark-mode safe, `dir="auto"` on Arabic snippets;
    - item cards with a thumbnail (Storage URL), competitor, brand, format and a link to `/items/[id]` (link to our page first, then the source; DESIGN.md §11);
    - a footer with "Manage alerts" → `/settings/alerts`.
- **Revalidation (WF-70):**
  - **Call:** `POST {app_url}/api/revalidate`, header `x-emr-secret: <INTERNAL_WEBHOOK_SECRET>` (API_SPEC §6.1), body `{tags: string[]}` (≤ 50 tags, regex `^[a-z0-9:_-]{1,80}$`).
  - **Debounce:** `ops.should_publish(tags)` (built in M09).
  - **Tags** (TECHNICAL §10): `feed`, `stats`, `campaigns`, `news`, `briefs`, `competitor:{slug}`, `campaign:{id}`, `brand:{slug}`, `agency:{slug}`, `person:{slug}`, `brief:{week}`.
  - **M13 adds:** each collector and AI run passes the **specific** entity tags that changed (competitor slugs of new items, campaign IDs touched), not only the generic ones, capped at 50 (fall back to generic tags when over the cap).
- **Routes** (DESIGN.md §8.15, §8.16, §8.19):
  - `/news`: list with kind filter, competitor/brand filters, date;
  - `/briefs`: weeks list;
  - `/briefs/[week]?scope=ALL|EG|KSA|UAE`: rendered brief with highlights that open the item drawer, plus a print stylesheet;
  - `/settings/alerts`: rule cards per kind.
  - Competitor and brand profile **News** tabs read `app.news_mentions`.

## 3. Prerequisites

| Item | Needed when | Notes |
|---|---|---|
| M12 Done with owner "go" (MA-22) | Before T1 | The gate |
| M09–M11 pages exist (`/news`, `/briefs`, `/settings/alerts` shells, item drawer) | T8 | Wire real data here |
| WF-00, WF-30, WF-70 (M09 debounce), WF-91 exist | T4–T6 | Extend; don't duplicate |
| **MA-23** email provider + verified domain + recipients | T6 (sending) | Build the templates first; send once it's ready |
| **MA-24** SerpAPI account + plan + key in n8n | T2 (live runs) | Build with a mocked response first |

## 4. Scope

**In:**
- WF-22, WF-23, WF-50, WF-70 (extended), WF-80.
- The new `ops.*` RPCs listed above, plus `ops.match_instant_rules`.
- Seeded `app.alert_rules` defaults.
- The email templates.
- `/news`, `/briefs`, `/briefs/[week]`, `/settings/alerts` and the News tabs.
- Brief embeddings (via the existing `embed` queue and WF-33).
- The cost ledger for SerpAPI and brief OpenAI calls.

**Out:**
- Ad libraries (D-08).
- LinkedIn jobs (D-08).
- Slack, WhatsApp or push notifications (email only, D-21).
- An Arabic UI (Q-02).
- Social scraping for news (SerpAPI only, D-09).
- Full-article scraping of news pages: snippet only. An optional `summary_en` comes from the title and snippet.

## 5. References

- `docs/SCRAPING_SOURCES.md` §7 (news and awards) and §8 (SerpAPI cost)
- `docs/N8N_WORKFLOWS.md`:
  - §2 schedule, §3 executions;
  - §5 SUB · Notify, SUB · Log cost;
  - WF-22, WF-23, WF-50, WF-70, WF-80, WF-91;
  - §7.10 SerpAPI normalizer, §8 RPC list.
- `docs/AI_PIPELINE.md` §2 (models), §7 (brief embeddings), §10 (weekly briefs)
- `reference/prompts/weekly_brief.v1.md`, `reference/json-schemas/weekly_brief.v1.json`
- `docs/API_SPEC.md` §6.1 (`/api/revalidate`); §5 `GET /briefs`, `GET /news` (M14 reuses the services written here)
- `docs/DATA_SCHEMA.md` §3 (news_articles, news_mentions, briefs, alert_rules, employee_snapshots), §5
- `DESIGN.md` §8.15 `/news`, §8.16 `/briefs`, §8.19 `/settings/alerts`, §10 content rules, §11 do/don't; `docs/DESIGN_STYLE.md` (palette, voice)
- `docs/PRD.md` FR-S8, FR-W11, FR-W12, FR-W13, FR-B1…FR-B4
- `docs/OPEN_QUESTIONS.md` Q-03, Q-06, Q-11

## 6. Deliverables

| Deliverable | Path |
|---|---|
| Migration(s): RPCs + rule seed | `supabase/migrations/<ts>_m13_news_briefs_alerts.sql` (created with `supabase migration new`) |
| Workflows | `n8n/workflows/WF-22-news.json`, `WF-23-awards.json`, `WF-50-weekly-briefs.json`, `WF-70-publish.json` (updated), `WF-80-alerts.json`, `WF-00-orchestrator.json` (new slots), `WF-30-ai-extractor.json` (instant-rule call) |
| Prompts | `n8n/prompts/weekly_brief.v1.md`, `n8n/prompts/weekly_brief.v1.json` (copies of `reference/…`) |
| Email templates | `n8n/email/digest.html`, `instant.html`, `brief.html`, `ops.html` (budget/failing), `n8n/email/render.js` (Code-node renderer, unit-tested), plus preview PNGs in `n8n/email/previews/` |
| Web pages | `apps/web/app/(app)/news/page.tsx`, `briefs/page.tsx`, `briefs/[week]/page.tsx`, `settings/alerts/page.tsx`, news tab components |
| Services (reused by M14) | `apps/web/lib/api/services/news.ts`, `briefs.ts` |
| Tests | pgTAP `supabase/tests/m13_*.test.sql`; Vitest for `render.js` and the citation parser; Playwright for `/briefs/[week]` and `/settings/alerts` |

## 7. Tasks

### T1: Database: news, briefs and alert RPCs
Create the migration with `supabase migration new m13_news_briefs_alerts`.
- `ops.get_news_queries(p_kind text, p_limit int) returns jsonb`:
  - **`kind = 'news'`:** returns `[{query, engine:'google_news', gl, hl, competitor_id?, org_id?}]`. It covers every **active** competitor (pilot + baseline until M15 activates the rest), with an extra `hl=ar` row when `name_ar` exists, plus the top 30 brands by published items in the last 90 days.
  - **`kind = 'award'`:** returns one row per site with `engine:'google'`, `tbs:'qdr:w'` and `kind` = award or news, per the list in §2.
  - Store the site list in `ops.settings` key `award_sites` (jsonb array of `{domain, kind}`) so the owner can edit it without a deploy.
- `ops.upsert_news(p_articles jsonb) returns jsonb`:
  1. Insert into `app.news_articles` with `on conflict (url) do nothing`.
  2. Resolve mentions:
     - **(a)** keep mentions passed in, for example the competitor of the query;
     - **(b)** exact or normalized alias match of title + snippet against competitor names and aliases and `app.org_aliases` (brand/agency) using `private.norm`.
  3. Insert `app.news_mentions` with `on conflict do nothing`.
  4. Return `{inserted, mentions_added, new_article_ids[]}`.
  5. Compute `search_tsv` with a trigger, using the same pattern as items (title A, snippet/summary B).
- `ops.get_brief_inputs(p_week_start date, p_scope text) returns jsonb`. The week is Monday 00:00 → next Monday 00:00 in Africa/Cairo, converted to UTC. For scope EG, KSA or UAE, filter by item `country` (OTHER and null count as EG, D-06); ALL means no filter. Return:
  - `launches`: published commercial items, ranked by competitor tier, `content_type` (TVC first), brand seen_count and metrics. At most 60 items, with `{id, competitor, brand, agency, content_type, occasion, title, summary_en, published_at, campaign_id}`.
  - `campaigns_new` and `campaigns_updated` (IDs, titles, brand, competitor, item_count).
  - `active_competitors`: top 10 by commercial items this week, with last week's count.
  - `clients_new`: brand × competitor pairs first seen this week. `clients_returning`: pairs seen before but not in the previous 90 days.
  - `pairings`: agency × production house, this week vs new.
  - `team_moves`: from `app.employee_snapshots` joined/left this week, filtered to senior titles by a keyword list (director, head, producer, founder, partner, CEO, ECD, creative director, DOP).
  - `news`: up to 10 items this week.
  - `last_week`: counts for comparison.
  - `data_quality`: accounts failing, items in review.
- `ops.save_brief(p_week_start date, p_scope text, p_brief jsonb) returns uuid`:
  1. Upsert `app.briefs` on `(week_start, scope)`, so a re-run overwrites.
  2. Store `source_item_ids` = the distinct `item_ids` from highlights, plus the IDs parsed from `body_md` (`[item:<uuid>]`).
  3. Store `model` and `prompt_version` from `p_brief.meta`.
  4. Enqueue `embed` `{entity_type:'brief', entity_id}`.
  5. Write `ops.cost_ledger` only if the meta has a cost (WF-50 normally logs it via SUB · Log cost; don't double-count).
- `ops.match_instant_rules(p_item_ids uuid[]) returns jsonb`: applies the §2 instant rule plus each active `instant_launch` and `new_client` rule's `filters`, and returns `[{rule_id, item_id, reason}]`. Matches already alerted are excluded through `ops.alert_log`.
- `ops.get_digest(p_since timestamptz) returns jsonb`. Over the last 24 h it returns:
  - counts per country and platform;
  - the top 10 launches (same ranking as the brief);
  - new clients;
  - campaigns created;
  - review-queue size;
  - failing accounts (admin recipients only).
- `ops.get_alert_payload(p_kind text, p_ctx jsonb) returns jsonb`: returns `[{rule_id, recipients[], subject, content}]` for active rules of that kind, where `content` comes from `get_digest`, the item cards for instant alerts, the brief links for `weekly_brief`, the budget numbers from `ops.daily_health()`, or the failing accounts list. Rules whose filters exclude everything return nothing. For `daily_digest` with no new items, it returns nothing unless `filters.send_empty = true`.
- New table `ops.alert_log` (`id`, `rule_id`, `kind`, `dedupe_key` unique, `recipients[]`, `sent_at`, `provider_message_id`, `status`) with RLS enabled and no policies. Add `ops.log_alert_sent(p_kind text, p_ctx jsonb)`, which writes one row per rule and recipient batch. The `dedupe_key` is `kind:rule_id:item_id`, or `kind:rule_id:date` for digests, which prevents double sends on re-runs.
- **Seed `app.alert_rules`** (on conflict do nothing), one per kind (daily_digest, instant_launch, new_client, weekly_brief, budget, failing_sources), active, recipients `{mohamed.abdelrahman@everyone.film}`. `new_client` uses `filters: {"instant": false}`.
- **Grants:** revoke from PUBLIC; grant EXECUTE to `n8n_writer`. Run advisors, then regenerate types.
- **Done when:** the migration applies to dev and the pgTAP tests (§10) pass.

### T2: WF-22 News (weekly, Sunday 07:00)
- Start from the N8N_WORKFLOWS WF-22 spec.
- **Flow:**
  1. SUB · Start run (`WF-22`, `news`, `weekly`).
  2. Postgres `select ops.get_news_queries('news', 500);`.
  3. Loop: HTTP `GET https://serpapi.com/search.json` with the credential `SerpAPI` and params from the row, `num=20` where supported. Concurrency 3, retry 3, wait on 429.
  4. Code normalizer (§7.10): keep results with `published_at` ≥ now − 8 days, or null dates when the query is competitor-specific.
  5. Accumulate, then Postgres `select ops.upsert_news($1::jsonb);` in chunks of 200.
  6. SUB · Log cost: searches × the `serpapi:search` price.
  7. SUB · Finish run.
  8. WF-70 `{tags: ["news", "competitor:<slug>"…]}`.
- Add the **optional** `summary_en`: one fast-model call per **new** article with a title + snippet ≤ 40 words. Gate it with `ops.settings.news_summaries` (default false in M13; the owner can turn it on). Log the cost.
- Add the Sunday 07:00 slot in WF-00's Schedule Trigger.
- **Dev test:** run it with a **mocked** SerpAPI response (pinned data) before MA-24, then live on 5 competitors.
- **Done when:**
  - re-running the same week inserts 0 new articles;
  - mentions link to the right competitor;
  - the cost row is present;
  - the workflow is exported.

### T3: WF-23 Awards (weekly, Sunday 07:30)
- Same pattern as WF-22, using `ops.get_news_queries('award', 50)` and `engine=google` with `q=site:<domain> (Egypt OR Saudi OR UAE OR Dubai OR Riyadh OR Cairo)` and `tbs=qdr:w`.
- Set `kind` from the site config. Name matching happens in `ops.upsert_news`.
- Verify the Effie MENA domain and every other domain by one manual SerpAPI query each. Record the results in PROGRESS and in `ops.settings.award_sites`.
- **Done when:**
  - the 8 queries run;
  - articles are stored with the right `kind`;
  - at least one award article is matched to a competitor or brand on a historic test query (use `tbs=qdr:y` once in dev to prove the matching);
  - the workflow is exported.

### T4: WF-50 Weekly briefs (Monday 08:00)
- **Flow:**
  1. SUB · Start run (`WF-50`, null, `weekly`).
  2. Compute `week_start` = the previous Monday in Africa/Cairo.
  3. Loop over the scopes `[EG, KSA, UAE, ALL]`:
     1. Postgres `select ops.get_brief_inputs($1::date, $2);`.
     2. HTTP to the OpenAI Responses API with `OPENAI_MODEL_BRIEF`, the system and user messages from `n8n/prompts/weekly_brief.v1.md`, and strict `json_schema` from `weekly_brief.v1.json`. Timeout 120 s, retry 3.
     3. Validate the output in a Code node: ajv on the schema; every `highlights[].item_ids` and `campaign_ids` and every `[item:<uuid>]` / `[campaign:<uuid>]` in `body_md` must exist in the input. Remove unknown citations and note them in `data_quality_note`. If more than 20% of the citations are invalid, retry once with an error message.
     4. Postgres `select ops.save_brief($1::date, $2, $3::jsonb);` with meta `{model, prompt_version:'weekly_brief.v1', tokens, cost_usd}`.
     5. SUB · Log cost (category `brief`).
  4. Execute WF-80 `{kind:'weekly_brief', week_start}`.
  5. WF-70 `{tags:['briefs','brief:<week_start>']}`.
  6. SUB · Finish run.
- **Thin weeks:** if `launches` is empty for a scope, still write a short brief whose `data_quality_note` says the week was quiet. Never invent content.
- **Dev test:** run it for the **last pilot week** in dev against copied pilot data (or prod read-only input via `get_brief_inputs` run in dev with a seeded snapshot). Then run it once in prod manually after MA-23.
- **Done when:**
  - 4 briefs are saved for one week;
  - re-running overwrites rather than duplicating;
  - every citation is valid;
  - embeddings rows exist;
  - the workflow is exported.

### T5: WF-30 / collectors → instant rules and specific revalidation tags
- **WF-30:** after `ops.apply_extraction` for a batch, call `select ops.match_instant_rules($1::uuid[]);` with the newly published item IDs. If there are matches, execute WF-80 `{kind:'instant_launch', matches}` without waiting.
- **Collectors, WF-30 and WF-32:** build specific tags (`competitor:<slug>`, `campaign:<id>`, `brand:<slug>`) from the RPC results (`upsert_raw_items` returns `new_item_ids`; `apply_extraction` returns the brand/competitor; `attach_to_campaign` returns the campaign). Pass them to WF-70 with a cap of 50 tags.
- **WF-70:** keep the M09 debounce (`ops.should_publish`). Log a non-200 response from `/api/revalidate` to WF-90.
- **Done when:**
  - publishing an item in dev updates `/competitors/<slug>` and the campaign page within 1 minute without a redeploy;
  - the instant alert fires for a test item that meets the rule;
  - it does not fire again on a re-run (alert_log dedupe).

### T6: WF-80 Alerts
- **Trigger:** Execute Workflow Trigger `{kind, ctx}`, called from:
  - WF-00 at 09:00 (`daily_digest`);
  - WF-30 (`instant_launch`, including new-client matches when `filters.instant`);
  - WF-50 (`weekly_brief`);
  - WF-91 (`budget`, `failing_sources`).
- **Flow:**
  1. Postgres `select ops.get_alert_payload($1, $2::jsonb);`.
  2. Run the Code node `render.js`: kind → HTML + text fallback, subject, `List-Unsubscribe` header pointing to `/settings/alerts`.
  3. Send through SUB · Notify (Resend HTTP `POST https://api.resend.com/emails`, or SMTP), batched to ≤ 50 recipients per message, with recipients in BCC when there is more than one.
  4. Postgres `select ops.log_alert_sent($1, $2::jsonb);` with the provider message ID.
- **Budget alert:** WF-91 already compares yesterday's cost to `ops.settings.daily_budget_usd`. The email shows yesterday's cost, month-to-date, the month forecast, the top 3 providers and a link to `/admin/costs`.
- **Failing sources:** lists the accounts with `status = 'failing'`, their last error and a link to `/admin/pipeline`. Throttle it to 1 email per day.
- **Templates:** build `n8n/email/*.html` with the brand rules in §2, keeping them inline-styled and table-based. Render previews to PNG (Playwright, in a local script) and commit them for the owner to review.
- **Done when (after MA-23):**
  - all 6 kinds send a test email to the owner;
  - the digest arrives at 09:00 Cairo with counts that match SQL;
  - re-running does not resend;
  - with no new items, no digest is sent (unless `send_empty`).

### T7: Settings → Alerts UI
- **`/settings/alerts`** (DESIGN.md §8.19): one rule card per kind, with an active toggle, filters (markets, tiers, competitors, formats; budget shows the USD threshold) and a recipients chip input.
- **Permissions:**
  - Admins save any rule via `app.admin_upsert_alert_rule` (implemented in M11, or here if it is still a SKETCH; analyst/viewer are refused).
  - Non-admins can add or remove **only their own email** on each rule. Add the RPC `app.alert_self_subscribe(p_rule_id bigint, p_subscribe boolean)`, SECURITY INVOKER calling a private worker that checks `private.is_member()` and changes only `(select email from app.members where user_id = auth.uid())`.
  - Budget and failing_sources are shown to admins only.
- **Done when:** the e2e test passes (admin edits a rule; a viewer subscribes and unsubscribes themselves; a viewer can't edit others).

### T8: `/news`, `/briefs`, `/briefs/[week]` and the News tabs
- **`/news`:** list of `app.news_articles` (newest first, keyset pagination), with a kind tab (All · News · Awards), competitor/brand/date filters, mention chips linking to profiles, and an `Open source` link. Empty state: "No news this week. News updates every Sunday."
- **`/briefs`:** week list (newest first) with the 4 scope chips and the headline of each brief.
- **`/briefs/[week]?scope=ALL|EG|KSA|UAE`:**
  - render `body_md` with a safe markdown renderer (no raw HTML);
  - a citation parser turns `[item:<uuid>]` and `[campaign:<uuid>]` into link chips that open the item drawer or the campaign page;
  - highlights sidebar;
  - "Previous / next week" navigation;
  - a print stylesheet (white background, black text, wordmark);
  - `data_quality_note` shown as a muted callout.
- **Profile News tabs** (competitor, brand, agency): articles via `app.news_mentions`.
- **Caching:** tags `news` and `brief:<week>`, revalidated by WF-70.
- Put the data access in `lib/api/services/news.ts` and `briefs.ts` (shared with M14).
- **Done when:**
  - pages render real data from dev;
  - axe shows no serious violations;
  - the Playwright tests pass (brief page citations open the drawer; scope switch works).

### T9: Go live in prod
1. Copy the dev workflows to prod (N8N_WORKFLOWS §1.1).
2. Apply the migration to prod. This milestone includes prod changes for news, briefs and alerts after M12 "go", so tell the owner in PROGRESS first.
3. Turn on the Sunday, Monday and 09:00 slots in prod WF-00.
4. Run WF-22 and WF-23 once manually in prod.
5. Then wait for the next Monday brief and the next 09:00 digest. Paste the evidence: brief IDs, email screenshots and alert_log rows.
6. Export all the workflows.
- **Done when:** AC1–AC8 pass in prod.

## 8. Interfaces & contracts

| Contract | Shape |
|---|---|
| `ops.get_news_queries(kind, limit) → jsonb` | `[{query, engine, gl?, hl?, tbs?, kind, competitor_id?, org_id?}]` |
| News article (input to `ops.upsert_news`) | `{url, kind:'news'\|'award', title, source_name, published_at\|null, snippet, language:'ar'\|'en', query, summary_en?, mentions:[{entity_type, entity_id}]}` |
| `ops.upsert_news → jsonb` | `{inserted, mentions_added, new_article_ids[]}` |
| `ops.get_brief_inputs(week_start, scope) → jsonb` | `{scope, week_start, week_end, launches[], campaigns_new[], campaigns_updated[], active_competitors[], clients_new[], clients_returning[], pairings[], team_moves[], news[], last_week{}, data_quality{}}` |
| Brief output | `weekly_brief.v1.json`; citations `[item:<uuid>]`, `[campaign:<uuid>]` |
| `ops.save_brief(week_start, scope, brief) → uuid` | brief = schema output + `meta{model, prompt_version, tokens_in, tokens_out, cost_usd}` |
| `ops.match_instant_rules(item_ids) → jsonb` | `[{rule_id, item_id, reason:'big_launch'\|'client_poached'\|'new_client'}]` |
| `ops.get_alert_payload(kind, ctx) → jsonb` | `[{rule_id, recipients[], subject, content{…}}]` |
| `ops.log_alert_sent(kind, ctx)` | ctx: `{rule_id, dedupe_key, recipients[], provider_message_id, status}` |
| WF-80 input | `{kind:'daily_digest'\|'instant_launch'\|'new_client'\|'weekly_brief'\|'budget'\|'failing_sources', ctx?}` |
| WF-70 input | `{tags: string[]}` → `POST /api/revalidate` with `x-emr-secret` |
| `app.alert_self_subscribe(rule_id, subscribe)` | `void`; changes only the caller's email |

## 9. Acceptance criteria

- **AC1:** WF-22 and WF-23 run in prod on schedule (Sunday 07:00 / 07:30 Cairo). Articles are stored with the correct `kind`. Re-running the same week inserts 0 duplicates. Mentions link to competitors and brands. SerpAPI cost rows are in `ops.cost_ledger`.
- **AC2:** The first Monday after go-live, 4 briefs (EG, KSA, UAE, ALL) exist in `app.briefs`. 100% of their citations resolve to existing items or campaigns. The briefs render at `/briefs/[week]?scope=…` and are embedded.
- **AC3:** The weekly brief email reaches mohamed.abdelrahman@everyone.film with links to the 4 briefs.
- **AC4:** The daily digest arrives at 09:00 Cairo (±10 min). Its counts match `ops.get_digest` run by hand. A re-run of WF-80 for the same day sends nothing (alert_log dedupe).
- **AC5:** A test item that meets the instant rule produces exactly one instant email. A non-matching item produces none.
- **AC6:** Budget and failing-sources emails trigger from WF-91 when forced in dev (set the budget to $0.01; set a test account to failing).
- **AC7:** After a pipeline run, the affected pages (`/feed`, `/competitors/<slug>`, `/campaigns/<id>`, `/news`, `/briefs`) show new data within 2 minutes without a redeploy (WF-70 → `/api/revalidate` 200).
- **AC8:** `/settings/alerts` works as specified (admin edits rules; members self-subscribe only), with the e2e tests green.
- **AC9:** pgTAP, Vitest and Playwright tests for this milestone pass in CI. Advisors are clean. All workflows are exported with no credentials.

## 10. Tests to write

- **pgTAP:**
  - `upsert_news`: idempotent on URL; mention matching via aliases; `n8n_writer` only.
  - `get_brief_inputs`: scope filtering (OTHER counts as EG); week boundaries in Cairo time; returns only published, non-duplicate items.
  - `save_brief`: upsert overwrites; `source_item_ids` parsed from `body_md`.
  - `match_instant_rules`: positive, negative and dedupe cases.
  - `get_alert_payload`: empty digest → no rows unless `send_empty`.
  - `alert_self_subscribe`: a member changes only their own email; a non-member is refused.
  - RLS: `ops.alert_log` is not readable by `authenticated`.
- **Vitest:**
  - `n8n/email/render.js` snapshots for 6 kinds, with Arabic text using `dir="auto"` and subject ≤ 70 characters;
  - the citation parser (valid, invalid and mixed citations);
  - the SerpAPI normalizer fixtures (`n8n/normalizers/fixtures/serpapi/*.json`): google_news stories flattening, organic results, date parsing.
- **Playwright:** `/briefs/[week]` citation chips open the drawer; the scope switch; print CSS snapshot; `/news` filters; `/settings/alerts` permissions.
- **Manual (evidence in PROGRESS):** screenshots of each email kind in Gmail (desktop + mobile, dark mode).

## 11. Manual actions from the owner

| ID | Action | When | Notes |
|---|---|---|---|
| **MA-23** | Choose the email provider (default Resend). Verify the sending domain (SPF/DKIM DNS records). Add the credential in n8n. Confirm the recipient list (default mohamed.abdelrahman@everyone.film) | Before T6 sending | Q-03, Q-11 |
| **MA-24** | Create the SerpAPI account and choose a plan covering ~140 searches/week (pilot) and ~620/week (full scale), plus headroom. Add the key to the n8n credential `SerpAPI` | Before T2 live runs | Price per search goes into `ops.price_book` |
| — | Confirm or adjust the instant-launch rule (Q-06) after seeing the first week of alerts | After T6 | Record it in DECISIONS → Changes |
| — | Review the email template previews | T6 | `n8n/email/previews/` |

## 12. Risks & gotchas

- **SerpAPI date strings** are inconsistent (relative "2 days ago", localized). Prefer `iso_date`, parse the rest defensively, and keep null rather than guessing.
- **Google News `stories` clusters:** flatten them (normalizer §7.10). The same article can appear in several clusters, and URL dedupe handles that.
- **Name collisions:** competitor names like "Truffle", "Matchstick", "Toast Films" or "Mid Film" match unrelated news. Quote the full name, add the market (`gl`), and drop articles whose title and snippet don't contain the exact name or an alias. Common-word names need an extra context word ("production", "films", "إنتاج"); configure it via competitor aliases.
- **Prompt injection:** news snippets and captions are data. Keep them in the user message inside delimiters, keep the system message authoritative, and never follow instructions found in data (AI_PIPELINE §11).
- **Hallucinated citations:** validate every ID against the input and drop invalid ones. Never let the model invent numbers. The prompt says "use only the data provided".
- **Week boundaries:** compute the week in Africa/Cairo and store `week_start` as a date. Egypt has observed daylight saving time again since 2023, so the UTC offset changes during the year. Always use `AT TIME ZONE 'Africa/Cairo'` (and the n8n workflow timezone setting), never a fixed `+02:00`/`+03:00` offset.
- **Email deliverability:** use the verified domain only; no attachments. Keep the HTML small (< 100 KB); host images in Storage.
- **Revalidation storms:** keep the debounce, and cap the tags at 50 per call.
- **Double sends** when n8n retries a node: the `alert_log` unique `dedupe_key` must be written **before** marking success, and checked before sending.

## 13. Cost & budget notes

| Item | Pilot | Full scale |
|---|---|---|
| SerpAPI | ≈ 140 searches/week ≈ $2.1/week ≈ $0.30/day | ≈ 620 searches/week ≈ $9.3/week ≈ $1.33/day |
| Briefs | 4 calls/week with the brief model (~20–40k input tokens each) ≈ < $1/week, depending on the model price | same |
| Optional news summaries | ≈ < $0.05/week | ≈ < $0.2/week |
| Email | Resend free tier likely sufficient (≈ 30–60 emails/month to one recipient) | confirm the plan if recipients grow |

SerpAPI prices are at the default plan (≈ $0.015/search; confirm in MA-24). Every cost goes into `ops.cost_ledger` (provider `serpapi`, `openai`, `email` if the plan is paid).

## 14. Definition of done & hand-off

**Done when:**
- AC1–AC9 pass with evidence (brief IDs, email screenshots, `alert_log` rows, timing of the 09:00 digest, revalidation timings).
- The PR `m13-news-briefs-alerts` is merged and CI is green.
- The prod workflows are on schedule and exported.
- DECISIONS → Changes records the email provider, the final instant rule and the award site list.
- The root board is updated.

**Hand-off to M14:**
- `lib/api/services/news.ts` and `briefs.ts` exist; the `GET /news` and `GET /briefs` endpoints and the MCP tools `get_brief` / `list_news` and resource `radar://brief/latest/{scope}` reuse them.
- Brief embeddings exist, so `search` with `types=['brief']` can be added if useful.
- Note any alert-rule tweaks the owner requested.
