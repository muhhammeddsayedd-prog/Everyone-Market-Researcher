# M10 — Web app entities

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first, then the root `PROGRESS.md`.
> **Parallel-OK while the pilot runs:** also run the daily pilot check each working session and log it in `milestones/M08-campaign-linker-pilot-launch/PROGRESS.md` → Pilot monitoring log.

## 1. Goal and outcome

Build every "who and what" page, so a user can go from any launch to its competitor, brand, agency and crew, and back, in two clicks (PRD goal 3).

When M10 is done, these pages render real pilot data with keyset pagination, filters, charts and e2e tests:
- competitors list + profile with all tabs;
- campaigns list + detail;
- brands, agencies and people lists + detail;
- compare;
- market dashboards for EG / KSA / UAE.

`app.stats_daily` is filled by `ops.refresh_stats_daily` on a schedule. If time allows: saved views (FR-W16) and CSV export (FR-W17).

## 2. Context you need

**Design spec:** `DESIGN.md`:
- §8.6 `/campaigns`
- §8.7 `/campaigns/[id]`
- §8.8 `/competitors`
- §8.9 `/competitors/[slug]` (**tabs as URL segments**)
- §8.10 `/compare`
- §8.11 brands
- §8.12 agencies
- §8.13 people
- §8.14 `/markets/[market]`

Components (DESIGN.md §6): EntityHeader (with a sticky compact version), CampaignCard, CompetitorCard, StatTile, Tabs, DataTable (server sort + keyset), Timeline, the chart wrappers (LineChart, BarChart, AreaSpark, Heatmap, ShareBar, each with "View as table"), KeyValue and LogoTile (dark/light tile tone). Re-use the M09 primitives and the `lib/data/*` pattern (typed + cached + tagged).

**Routes:**

| Route | Notes |
|---|---|
| `/competitors` | List. The baseline is pinned first with a "Baseline" pill. Default sort: activity in the period. |
| `/competitors/[slug]` | Overview |
| `/competitors/[slug]/campaigns`, `/posts`, `/clients`, `/agencies`, `/people`, `/team`, `/news`, `/accounts`, `/capabilities` | Profile tabs |
| `/campaigns` | List |
| `/campaigns/[id]` | Detail |
| `/brands`, `/brands/[slug]` | |
| `/agencies`, `/agencies/[slug]` | |
| `/people`, `/people/[slug]` | |
| `/compare?c=slug,slug[,slug,slug]` | Plus an "Include everyone." toggle (`&baseline=1`) |
| `/markets/eg`, `/markets/ksa`, `/markets/uae` | |

**Out of scope (D-08):**
- There is **no** ads page and **no** jobs page.
- The **Team** tab shows the LinkedIn employee snapshots: headcount by week, who joined, who left and a roles breakdown, from `app.employee_snapshots`. It carries the note "From public LinkedIn company employee listings; weekly."

**Data** (`docs/DATA_SCHEMA.md` §3, `reference/sql/002`, `003`):
- Competitors: `app.competitors`, `app.competitor_accounts`.
- Items: `app.feed_v`. Campaigns: `app.campaigns_v` (security-invoker, excludes merged).
- Organizations: `app.organizations` (kind brand/agency, status confirmed/unconfirmed/merged).
- People and credits: `app.people`, `app.item_credits`.
- News: `app.news_articles`, `app.news_mentions` (filled in M13; the tab shows an empty state until then).
- Team: `app.employee_snapshots`.
- Similar: `app.similar('campaign', id, 6)`.
- Aggregates: `app.stats_daily`.

**Entity rules:**
- Merged entities redirect: `/brands/old-slug` → 308 to `merged_into`'s slug.
- Unconfirmed entities show a warning StatusPill "Unconfirmed".
- Brands "returning" = a previous work with the same house more than 90 days earlier. "Lapsed" = no work for 180+ days.

**Global filters:** the market (`?market=`) and the date range (`?from=&to=`) from the top bar apply to every page.
- **Item country:** filter on the item/campaign `country`.
- **Competitor markets:** filter on `competitors.markets` containing the market.
- **Charts:** the baseline is always series 1 (green `--chart-1`), labelled "everyone.". Other series take `--chart-2…8` in a stable order by entity ID.

**Cache tags:** `competitor:{slug}`, `campaign:{id}`, `campaigns`, `brand:{slug}`, `agency:{slug}`, `person:{slug}`, `stats`, `feed`. WF-70 already sends `campaigns`/`feed`/`stats`. Entity tags are invalidated when those broad tags change: tag entity reads with both the specific tag and the broad tag.

## 3. Prerequisites

- **M09 Done:** app shell, auth, the `lib/data` pattern, the caching option, chart wrappers started.
- **M08:** pilot data with campaigns in prod and a slice in dev.
- **M05:** `app.employee_snapshots` filled (Team tab). **M07:** credits and embeddings.
- No new manual actions are expected.

## 4. Scope

**In:**
- the entity views/RPCs migration;
- `ops.refresh_stats_daily` + schedule;
- all routes listed in §2 with their tabs, filters, charts and empty/loading/error states;
- redirects for merged entities;
- the remaining chart wrappers (Heatmap, Timeline);
- e2e per page;
- saved views (FR-W16) and CSV export (FR-W17) **if time allows** (SHOULD).

**Out:**
- editing entities (merge, split, correct; that's M11, so keep the edit buttons hidden or disabled with the tooltip "Arrives with Review (M11)");
- search (M11);
- admin actions on accounts (Pause/Re-scrape buttons are visible only to admins and wired in M11);
- the news content itself (M13);
- briefs (M13).

## 5. References

- `DESIGN.md` §3.4 (chart palette), §4 (type), §5.4 (page grid: detail pages use 8 + 4 columns), §6, §8.6–§8.14, §9 (a11y), §10 (content rules)
- `docs/PRD.md` FR-W4–FR-W8, FR-W16, FR-W17
- `docs/DATA_SCHEMA.md` §3–5; `reference/sql/002_core_tables.sql` (`stats_daily`, `employee_snapshots`), `003_auth_rls_views.sql`, `005_rpc_app_api_search.sql` (`app.similar`)
- `docs/N8N_WORKFLOWS.md` WF-91 (calls `ops.refresh_stats_daily(current_date - 2)`)
- `docs/TECHNICAL.md` §10, §14 (indexes, keyset)
- `docs/TESTING.md`

## 6. Deliverables

1. **Migration `entity_views`** (`supabase migration new entity_views`). All views are `security_invoker`, all functions are `SECURITY INVOKER` unless noted, and everything is granted to `authenticated` and `api_agent`.
   - **stats_daily key fix:**
     - `alter table app.stats_daily`: add `country` to the primary key, so the key becomes `(day, competitor_id, platform, country)`;
     - make `country` `not null default 'OTHER'`;
     - log this deviation in DECISIONS → Changes.
   - **`ops.refresh_stats_daily(p_from date) → int`:**
     - `SECURITY DEFINER` in `ops`, `n8n_writer` only;
     - recomputes the days `>= p_from` in one transaction (delete + insert from `app.items` / `app.campaigns`);
     - columns: `items_new`, `commercial_new` (`is_commercial_work and ai_status='published'`), `campaigns_new` (campaigns whose `first_seen_at` is that day, attributed to `production_competitor_id`).
   - **Views:**
     - `app.competitor_overview_v`: per competitor; latest item date; counts for 7/30/90 days; accounts health summary (`jsonb` per platform: status, last_success_at).
     - `app.competitor_clients_v`: competitor × brand; first/last together, campaigns, items, status new/returning/lapsed.
     - `app.competitor_agencies_v`: competitor × agency; campaigns, last.
     - `app.competitor_people_v`: competitor × person; roles[], count, last credit.
     - `app.brand_houses_v`: brand × production house; campaigns, items, share, last.
     - `app.brand_agencies_v`.
     - `app.agency_houses_v`: agency × production house; campaigns, last.
     - `app.agency_clients_v`.
     - `app.person_credits_v`: person; item/campaign; role; organisation; date.
     - `app.person_collaborators_v`: people credited on the same items, with counts.
     - `app.team_snapshots_v`: per competitor; week; headcount; joined/left counts.
   - **Functions:**
     - `app.compare_competitors(p_ids uuid[], p_from date, p_to date, p_market text) → jsonb`, returning:
       - weekly output;
       - platform mix;
       - formats;
       - occasions;
       - top clients + shared;
       - industries matrix;
       - agencies overlap;
       - the latest headcount.
     - `app.market_dashboard(p_market text, p_from date, p_to date) → jsonb`, returning:
       - KPIs;
       - top competitors (output, commercial);
       - top brands by campaigns;
       - industries share;
       - occasions calendar (week × occasion);
       - latest big launches;
       - news ids.
   - **Indexes** found necessary by `EXPLAIN ANALYZE`, e.g.:
     - `app.items (brand_id, published_at desc)`;
     - `app.items (agency_id, published_at desc)`;
     - `app.item_credits (person_id, item_id)`.
   - pgTAP tests for each view/function: RLS (non-member gets 0 rows) and result shape.
2. **Schedule.**
   - WF-91 already calls `ops.refresh_stats_daily(current_date - 2)` daily. Verify it, and make it real if it was a stub.
   - Add a `pg_cron` job every hour at :20 that runs `select ops.refresh_stats_daily(current_date - 1)` (cheap; today + yesterday).
   - Run a one-time full backfill: `select ops.refresh_stats_daily('2024-01-01')`.
3. **Pages and components** under `apps/web/app/(app)/…` for every route in §2. New feature components:
   - `components/features/competitors/*`: CompetitorCard, AccountsHealthDots, CapabilitiesGroups;
   - `campaigns/*`: CampaignCard, CampaignTimeline, CreditsList;
   - `entities/*`: EntityHeader, RelationshipTable;
   - `compare/*`: CompetitorPicker, CompareSections;
   - `markets/*`: OccasionCalendarHeatmap.
4. **Data functions** `lib/data/{competitors,campaigns,brands,agencies,people,compare,markets,team}.ts`: typed (zod or generated types), cached, tagged.
5. **(SHOULD)** Saved views and CSV export:
   - `app.saved_views` CRUD via the user client (owner-only RLS already exists) and the FilterBar "Saved views" menu;
   - CSV export from DataTable via a streaming route `/export/[list].csv?…filters`, member-only, capped at 10,000 rows.
6. **Playwright e2e** per page family plus an a11y run on one page of each family.

## 7. Tasks

### T1 — Migration: `stats_daily` key fix + `ops.refresh_stats_daily` + schedule

**Steps:**
1. Write the function as one set-based `insert … select … group by` per day range. Use `delete … where day >= p_from` in the same transaction.
2. Grant EXECUTE to `n8n_writer` only.
3. Add the pg_cron job (`cron.schedule('stats-hourly', '20 * * * *', $$select ops.refresh_stats_daily(current_date - 1)$$)`). It runs as the owner role.
4. Make sure WF-91 calls the full-day refresh. Export WF-91 if you changed it.
5. Backfill from 2024-01-01 in dev, then in prod. Prod requires the owner's prod token, or ask the owner to run the one line. Log the timing.

**Done when:** pgTAP shows the totals equal raw counts for fixture days; the prod backfill is done; the totals match a spot SQL count (paste it).

### T2 — Migration: entity views + compare/market functions

**Steps:**
1. Implement the views and functions in Deliverable 1.
2. Keep every view `security_invoker = true`, so RLS applies (members only). Grant SELECT/EXECUTE to `authenticated` and `api_agent`. The `api.*` mirrors for the agent API are added in M14; don't add them now.
3. Run `EXPLAIN ANALYZE` on the prod-size slice for the heavy ones (`competitor_clients_v` for the largest competitor, `compare_competitors` with 4 IDs over 1 year, `market_dashboard` over 90 days). The target is < 300 ms DB time each; add indexes until it is met.
4. Run `supabase db advisors` and fix the findings. Regenerate the types.

**Done when:** pgTAP is green, and the EXPLAIN timings are pasted into PROGRESS.

### T3 — `/competitors` list

**Steps:**
1. FilterBar: market, tier (Baseline/Pilot/Next wave/Adjacent), category (13 from the taxonomy), in-house capability, status, "active in period", and a name search (trigram via `ilike`/`%` on `app.competitors.name`).
2. Grid view of CompetitorCards:
   - LogoTile 64 (tone auto);
   - name;
   - markets badges;
   - tier pill;
   - up to 3 category chips + "+n";
   - a 30-day sparkline from `stats_daily`;
   - the last post time.
3. List view, a DataTable with the columns:
   - Logo, Name, Markets, Tier, Pilot rank;
   - Categories, Items (period), Campaigns (period);
   - Last post;
   - Accounts health (5 platform dots: green ok / warning failing / muted paused / danger invalid).
4. The baseline is pinned first. Default sort: items in the period, descending. Server-side sort and keyset pagination.

**Done when:** all 285 rows are browsable (the 50 pilot + baseline show activity; paused competitors show "Paused" and no activity); e2e passes.

### T4 — `/competitors/[slug]` profile + all tabs

**Steps:**
1. EntityHeader (COMPETITOR), with:
   - LogoTile 96, name and `name_ar` (`dir=rtl`);
   - markets, tier and pilot rank;
   - category chips;
   - a website link + PlatformBadges for each tracked account, opening the source;
   - actions: "Compare with…" (→ `/compare?c=slug`), plus Edit/Pause for admins, disabled until M11 with a tooltip.
2. The sticky compact header appears after 200 px of scroll.
3. Tabs as URL segments (Radix Tabs + links; arrow-key navigation; scrollable with edge fades on mobile):

| Tab | Content | Data |
|---|---|---|
| Overview | KPI tiles (items, commercial works, campaigns, new clients: period), output by platform (stacked area 90 days), formats share, occasions share, top clients (logo list), top agencies, latest 8 items, the "vs everyone." mini compare | `stats_daily`, `feed_v`, `competitor_clients_v`, `competitor_agencies_v` |
| Campaigns | CampaignCards for this house (`production_competitor_id`), filters occasion/brand/date | `app.campaigns_v` |
| Posts | Feed filtered to the competitor, with the platform sub-filter chips (Vimeo, Instagram, Stories, Website, LinkedIn, YouTube), re-using the feed components | `feed_v` |
| Clients | Table: brand, industry, first, last, campaigns, items, status (new / returning / lapsed) | `competitor_clients_v` |
| Agencies | Table: agency, campaigns together, last | `competitor_agencies_v` |
| People | Table: name, roles, count, last credit | `competitor_people_v` |
| Team | Line chart (headcount listed by week), joined this week / left this week lists (name, title), roles breakdown bar; muted note "From public LinkedIn company employee listings; weekly." Empty state if no snapshots yet. | `team_snapshots_v`, `employee_snapshots` (latest) |
| News | Mentions list. Empty state: "News and awards arrive weekly once enabled." | `news_articles` + `news_mentions` |
| Accounts | Table per account: platform, handle (link), status pill, last success, last error (truncated + tooltip), consecutive failures, items, backfill status, next due. Admin buttons Pause/Resume/Re-scrape are visible but disabled until M11. | `competitor_accounts` |
| Capabilities | In-house capabilities grouped (Pre-production / Shoot / Post / Distribution: map the `in_house_capability` codes in `lib/taxonomy/groups.ts`), categories, research notes from the sheet (`competitors.notes`) | `competitors` |

4. Cache tag `competitor:{slug}` + `stats`. Slug changes: if a `slug` is not found, check `aliases` and redirect with 308; otherwise 404.

**Done when:** every tab renders for 3 sample pilot competitors and the baseline; empty states show where data is missing; e2e passes.

### T5 — `/campaigns` list + `/campaigns/[id]` detail

**Steps:**
1. **List:**
   - FilterBar: market, date (by last seen), brand, production house, agency, industry, occasion, platforms, min items, status.
   - Grid view: CampaignCards (auto-fill 320). Each shows the key art from the first item + a mini-thumb strip, title, brand LogoTile + name, house, agency, the date span "12 Mar – 4 Apr 2026", platform badges and the item count.
   - List view: DataTable with the DESIGN.md §8.6 columns.
   - Sort: `last_seen_at desc`, keyset.
2. **Detail** per §8.7:
   - kicker "CAMPAIGN · {occasion}", H1 "{title} — {brand} × {house}", a meta line with agency, country, dates, item count and platforms;
   - main column (8):
     - the hero item (16:9, Open at source);
     - ALL CUTS grid (items across platforms; the drawer opens per item);
     - TIMELINE (by date);
   - rail (4):
     - AI summary EN + AR (`dir=rtl`);
     - CREDITS (role → person links; organisations link to the agency/house);
     - confidence + evidence;
     - KeyValue facts;
   - SIMILAR CAMPAIGNS: 6 CampaignCards via `app.similar('campaign', id, 6)`.
3. A merged campaign redirects to `merged_into`. Analyst actions are hidden until M11.

**Done when:** a multi-platform pilot campaign shows all its cuts and credits; similar campaigns appear; e2e passes.

### T6 — Brands, agencies, people

**Steps:**
1. `/brands`:
   - list (DataTable or cards) with: logo, name, industry, country, production houses worked with (an avatar stack of LogoTiles), campaigns, last seen, and the Unconfirmed pill;
   - filters: industry, market, production house, agency, status.
2. `/brands/[slug]`:
   - EntityHeader (BRAND) → KPI tiles;
   - "Production houses they hire" (ranked bar with share, from `brand_houses_v`; the baseline is highlighted if present);
   - Agencies (from `brand_agencies_v`);
   - the campaign timeline by month (CampaignCards);
   - latest items;
   - news mentions (empty until M13).
3. `/agencies` + `/agencies/[slug]`: the same pattern, with "Production houses they hire" (`agency_houses_v`), clients (`agency_clients_v`), the campaign timeline, people credited (creative director, copywriter) and news.
4. `/people` + `/people/[slug]`:
   - list: name (+ AR), primary role, organisations, credits count, last credit; filters: role, organisation, market;
   - detail:
     - EntityHeader (PERSON, initials avatar, never a photo);
     - credits table (date, campaign/item, role, organisation) from `person_credits_v`;
     - "Works with" (`person_collaborators_v`);
     - the houses timeline;
     - the muted note "Professional credits from public sources only.".
5. Merged → 308 redirect; unknown slug → 404.

**Done when:** each detail page renders for 3 real entities; two-click navigation item → brand → house → campaign works (an e2e "drill-down" spec).

### T7 — `/compare`

**Steps:**
1. CompetitorPicker:
   - up to 4 LogoTiles with "+ Add" (a searchable popover over `app.competitors`);
   - URL `?c=slug,slug`;
   - the "Include everyone." toggle (`&baseline=1`, which adds the baseline as series 1).
2. Sections from `app.compare_competitors`:
   - output over time (weekly line);
   - platform mix (100% ShareBars);
   - formats and occasions (grouped bars);
   - top clients side by side, with shared clients highlighted (accent-soft row);
   - industries heatmap (rows = competitors, columns = industries; sequential green scale);
   - agencies overlap;
   - team size (latest headcount).
3. Every chart has a "View as table" toggle. Empty state: "Pick at least two competitors."

**Done when:** a 4-competitor comparison over 90 days renders in under 1.5 s (p75 on preview); the table view equals the chart data.

### T8 — `/markets/[market]`

**Steps:**
1. Kicker MARKET, H1 "Egypt" / "Saudi Arabia" / "United Arab Emirates", with tabs for the other markets.
2. Content from `app.market_dashboard`:
   - KPI tiles;
   - top competitors by output and by commercial works (bars);
   - top brands by campaigns;
   - industries share;
   - occasions calendar (week × occasion heatmap);
   - latest big launches (ItemCards);
   - news (empty until M13).
3. The top-bar market switcher, when on a market page, navigates between `/markets/*` instead of adding `?market=`.
4. Briefs count OTHER as EG (D-06). For dashboards, show EG = `country in ('EG')` by default, with an info tooltip "Items with unknown market are shown under All". Log this choice.

**Done when:** all three market pages render with pilot data; e2e passes.

### T9 — Charts: Heatmap, Timeline, palette consistency

**Steps:**
1. Finish the chart wrappers:
   - `Heatmap` (sequential green `--chart-seq-1…8`, labelled axes, tooltips on surface-3);
   - `Timeline` (vertical, month groups).
2. Stable colour assignment: `lib/charts/colors.ts#colorFor(entityId, index)`. The baseline is always `--chart-1`, the others follow a stable order. Every chart has a legend or direct labels; never colour-only meaning.
3. "View as table" renders an accessible `<table>` with the same numbers.

**Done when:** unit tests confirm the colour stability and the table parity.

### T10 — (SHOULD) Saved views + CSV export

**Steps:**
1. **Saved views:** the FilterBar menu "Save view…" (name) → insert `app.saved_views {name, path, filters}`. The list shows the user's views; delete is available.
2. **CSV export:**
   - the DataTable "Export CSV" calls `/export/[list].csv` with the current filters;
   - a server route checks membership, streams rows with the same data function (no cache), caps at 10,000 rows with a header comment if truncated, and uses UTF-8 with BOM (Excel + Arabic);
   - lists: feed, campaigns, competitors, brands, agencies, people.

**Done when:** a saved view restores filters after reload; the exported CSV opens in Excel with correct Arabic text (screenshot in PROGRESS). If skipped for time, mark it "Deferred to M15 backlog" in PROGRESS and in the root board notes.

### T11 — Tests and quality

**Steps:**
1. Playwright: `competitors.spec.ts`, `competitor-profile.spec.ts` (every tab), `campaigns.spec.ts`, `entities.spec.ts` (brand/agency/person + merged redirect), `compare.spec.ts`, `markets.spec.ts`, `drilldown.spec.ts` (item → brand → house → campaign → person).
2. axe on one page per family: 0 serious or critical issues.
3. Lighthouse (mobile) ≥ 90 for Accessibility on `/competitors/[slug]` and `/campaigns/[id]`, and ≥ 80 for Performance (chart-heavy pages).
4. Responsive check at 375 / 1024 / 1440.

**Done when:** CI is green and the scores are pasted.

## 8. Interfaces & contracts

| Interface | Contract |
|---|---|
| `ops.refresh_stats_daily(p_from date) → int` | Rows written; idempotent for the same range; `n8n_writer` only; also run by pg_cron hourly (`current_date - 1`) and WF-91 daily (`current_date - 2`) |
| `app.stats_daily` | PK `(day, competitor_id, platform, country)` after the T1 migration |
| Entity views | `app.competitor_overview_v`, `competitor_clients_v`, `competitor_agencies_v`, `competitor_people_v`, `brand_houses_v`, `brand_agencies_v`, `agency_houses_v`, `agency_clients_v`, `person_credits_v`, `person_collaborators_v`, `team_snapshots_v`: all `security_invoker`; SELECT for `authenticated` and `api_agent` |
| `app.compare_competitors(p_ids uuid[], p_from date, p_to date, p_market text) → jsonb` | `{competitors:[{id,slug,name,is_baseline}], weekly:[{week, competitor_id, items, commercial}], platform_mix:[…], formats:[…], occasions:[…], clients:{by_competitor:{id:[{brand_id,name,campaigns}]}, shared:[brand_id]}, industries:[{competitor_id, industry, campaigns}], agencies:{…}, headcount:[{competitor_id, headcount, snapshot_date}]}` |
| `app.market_dashboard(p_market text, p_from date, p_to date) → jsonb` | `{kpis:{items, commercial, campaigns, new_clients}, top_competitors:[…], top_brands:[…], industries:[…], occasions_calendar:[{week, occasion, items}], launches:[item ids], news:[ids]}` |
| `app.similar('campaign', id, 6)` | Similar campaigns |
| Routes | §2 table; merged → 308 to the survivor; unknown → 404 |
| Cache tags | `competitor:{slug}`, `campaign:{id}`, `brand:{slug}`, `agency:{slug}`, `person:{slug}` + broad `campaigns`, `feed`, `stats` |
| CSV route (SHOULD) | `GET /export/{feed\|campaigns\|competitors\|brands\|agencies\|people}.csv?<filters>`: members only; ≤ 10,000 rows; UTF-8 BOM |

## 9. Acceptance criteria

- **AC1** The migration is applied to dev and prod. pgTAP is green for `refresh_stats_daily`, all views (RLS negative and positive) and both functions. Advisors are clean.
- **AC2** `app.stats_daily` is backfilled from 2024-01-01 in prod. The totals for 3 random days × 3 competitors equal raw `app.items` counts (pasted). The hourly cron and WF-91 refresh are both running (the last run times are pasted).
- **AC3** `/competitors` lists all 285, with the baseline first. Filters and sort work; the health dots reflect the account status.
- **AC4** `/competitors/[slug]` renders all 10 tabs (Overview, Campaigns, Posts, Clients, Agencies, People, Team, News, Accounts, Capabilities) for 3 pilot competitors and the baseline, with correct empty states. The Team tab shows snapshot data for at least one competitor.
- **AC5** `/campaigns` and `/campaigns/[id]` work. A multi-platform campaign shows all its cuts, the timeline, credits and similar campaigns.
- **AC6** Brand, agency and person lists + details work. Merged → 308; unknown → 404. The drill-down e2e (item → brand → house → campaign → person) passes.
- **AC7** `/compare` works with 2–4 competitors + the baseline toggle. Every chart has a table view with identical numbers. Under 1.5 s p75 on preview.
- **AC8** `/markets/eg|ksa|uae` render with pilot data. The market-switch behaviour works.
- **AC9** The EXPLAIN ANALYZE timings for the heavy queries are < 300 ms DB time on the prod-size data (pasted).
- **AC10** Playwright e2e for every page family is green in CI. axe has 0 serious or critical issues. Lighthouse a11y ≥ 90 on the profile and campaign pages.
- **AC11** (SHOULD) Saved views and CSV export work, **or** they're explicitly deferred with a note on the root board.

## 10. Tests to write

- **pgTAP:** `supabase/tests/entity_views.test.sql` (shape, RLS positive and negative for each view; `compare_competitors` with the baseline; `market_dashboard` per market), `stats_daily.test.sql` (idempotency, totals).
- **Vitest:** `lib/charts/colors.ts`, `lib/taxonomy/groups.ts`, the date-span formatter ("12 Mar – 4 Apr 2026"), the client status rule (new / returning / lapsed), the CSV serializer (BOM, quoting, Arabic).
- **Playwright:** the specs listed in T11, plus visual smoke at 3 widths.

## 11. Manual actions from the owner

| ID | Action | When |
|---|---|---|
| — | Run the one-line prod backfill `select ops.refresh_stats_daily('2024-01-01');` in the prod SQL editor, if Codex has no prod token | T1 |
| — | (Optional) A quick look at 2–3 competitor profiles on production; comment in PROGRESS on anything confusing | After T4 |

## 12. Risks & gotchas

- **Polymorphic news mentions.** Join on `(entity_type, entity_id)`; there are no FKs. Keep queries indexed (`news_mentions (entity_type, entity_id)` exists).
- **Brand ↔ house share.** Count campaigns, not items, so Instagram-heavy houses aren't inflated. Show both in the tooltip.
- **Logos.** Many competitor logos are white-on-transparent. Use the LogoTile tone (dark tile by default; admins can switch in M11). Hot-linked logo URLs may break; prefer `logo_path` from Storage (OPEN_QUESTIONS Q-10).
- **Team data privacy (Q-05).** Show only name, title and location from snapshots. No photos, no LinkedIn profile links unless the owner later decides otherwise.
- **Chart performance.** Pre-aggregate in SQL (`stats_daily`, `compare_competitors`). Never send raw items to the client to aggregate.
- **The `stats_daily` PK change** must not break WF-91 and the M09 pulse queries. Update the pulse data function to use `stats_daily` now that it is filled.

## 13. Cost & budget notes

- No new external API cost. Similar campaigns use existing embeddings.
- DB load: the hourly stats refresh is set-based and cheap at pilot volume. Re-check at full scale in M15.

## 14. Definition of done & hand-off

**Done when:**
- AC1–AC10 pass (AC11 done or explicitly deferred) with evidence in PROGRESS;
- the PR `m10-web-app-entities` is merged;
- the root board is updated.

**Hand-off to M11** (fill in PROGRESS):
- where the edit/merge/split buttons are stubbed (so M11 wires them);
- the list of data functions and views M11's search/admin can re-use;
- any slow queries left;
- whether saved views and CSV were deferred.
