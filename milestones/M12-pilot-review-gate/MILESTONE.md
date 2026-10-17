# M12 — Pilot review & tuning (gate)

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first.

## 1. Goal and outcome

The 14-day pilot on the top 50 competitors (+ Everyone Films baseline) has run on its own since the end of M08. M12 turns its data into a decision.

When M12 is done:
- **Pilot report:** `docs/reports/pilot-report.md` answers, with real numbers:
  - Did we capture everything?
  - How accurate is the AI?
  - What did it cost?
  - What will 284 competitors cost per month?
  - What broke, and what did we fix?
- **Tuning applied in dev, then prod:**
  - auto-publish threshold;
  - alias and linker thresholds;
  - prompt v2 if needed;
  - collector choices (story actor, reels pass).
- **Daily audit sample job:** live, and it keeps measuring accuracy after launch.
- **Owner decision:** go / no-go / fix-first (MA-22), recorded in `docs/DECISIONS.md` → Changes.

This is a **gate**. M13 does not start until the owner records "go" (or "go with fixes" and the fixes are done).

## 2. Context you need

- **Timing:**
  - Pilot day 1 = the date recorded in M08's PROGRESS.md and in the root PROGRESS.md "Key dates".
  - M12 starts when **both** are true: pilot day ≥ 14, and M11 is `Done`.
  - Until then the root board shows M12 as `Not started`. Codex built the web app (M09–M11) while the pilot ran.
- **Pilot scope** (D-05):
  - 50 competitors ranked in `data/pilot_50.csv`: 19 EG, 15 KSA, 16 UAE.
  - About 195 tracked accounts: 48 websites, 48 Instagram, 47 Vimeo, 41 LinkedIn, 11 YouTube.
  - Plus stories (one per Instagram account), LinkedIn employees (weekly) and the baseline `C000`.
- **Targets** (PRD §8, AI_PIPELINE §8):

  | Metric | Target |
  |---|---|
  | Accounts with a successful run in the last 48 h | ≥ 95% |
  | Items auto-published | ≥ 70% |
  | Brand accuracy (resolved org) | ≥ 90% |
  | Production-house accuracy | ≥ 95% |
  | Commercial-flag accuracy | ≥ 95% |
  | content_type accuracy | ≥ 85% |
  | occasion accuracy | ≥ 85% |
  | Credits precision | ≥ 90% |
  | Credits recall | ≥ 70% |
  | Accuracy of items with overall confidence ≥ threshold | ≥ 93% (sets the threshold) |
  | Review-queue median age | < 3 days |
  | Cost per new item | known and reported |
  | Forecast accuracy (after the pilot) | within ±20% |

- **Tunables** live in `ops.settings`:
  - `auto_publish_threshold` 0.80 (T-06, start value)
  - `alias_trgm_min` 0.6
  - `alias_embedding_min` 0.85
  - `campaign_window_days` 45
  - `campaign_similarity_min` 0.82
  - `vision_max_share` 0.3
  - `stories_twice_daily` false
  - `daily_budget_usd`

  Change them through `app.admin_set_setting` (audited) or a migration for defaults.
- **Open questions this milestone closes** (see `docs/OPEN_QUESTIONS.md`):
  - Q-08: stories once or twice a day.
  - Q-09: keep the separate Instagram `reels` run?
  - Q-07: the steady-state daily budget.
  - The LinkedIn employees cost lever (cap per company or bi-weekly; SCRAPING_SOURCES §8 shows employees dominate scraping cost).
- **Cost data:**
  - Sources: `ops.cost_ledger` (every paid unit), `ops.price_book` (unit prices), `app.costs_summary` (Costs page).
  - Comparison baseline: the estimates in `docs/SCRAPING_SOURCES.md` §8:

    | Estimate | Pilot | All 284 |
    |---|---|---|
    | Scraping per day | ≈ $2.4 | ≈ $12.4 |
    | Backfill | ≈ $70–80 | ≈ $360–410 |

  - OpenAI is extra. Use the measured cost per item from M07.
- **Story actor bake-off** (SCRAPING_SOURCES §3.2, MA-16 from M06):
  - Candidates: `data-slayer/instagram-stories-scraper` (primary), `igview-owner/instagram-story-viewer`, `louisdeconinck/instagram-story-details-scraper`. The last needs a paid Apify plan and is priced per profile.
  - D-24 applies: **no login or cookies**. If an actor needs them, it is disqualified.
- **Prompt and schema versions:**
  - `reference/prompts/extract_item.v1.md` and `reference/json-schemas/item_extraction.v1.json` (copied to `n8n/prompts/` in M07).
  - A v2 prompt bumps `prompt_version`. Results stay comparable through `ops.ai_extractions.prompt_version`.
- **Optional cost lever** (AI_PIPELINE §3): the OpenAI Batch API (≈ 50% cheaper, 24 h turnaround) for backfill items during the M15 scale-up.

## 3. Prerequisites

| Item | Needed when | Notes |
|---|---|---|
| M08 done + pilot day ≥ 14 | Before T1 | Check `ops.scrape_runs` covers ≥ 14 distinct days of daily runs in prod |
| M11 done | Before T5 (the audit uses the review UI) | The audit can also be done via the CSV sheet from M07 |
| M07 eval harness (`scripts/eval/*`) | T5 | Reuse, don't rewrite |
| MA-16 decided in M06 (story actor) | T3 | If it is still open, M12 decides it with the bake-off data |
| **MA-22** owner go/no-go | T12 | The gate |

## 4. Scope

**In**
- Data analysis of the 14 pilot days (prod, read-only queries).
- A fresh 200-item accuracy audit.
- A calibration curve and threshold choice.
- Prompt v2, if the audit shows systematic errors.
- Threshold and setting tuning.
- Collector decisions: reels pass, stories cadence and actor, LinkedIn employees cap.
- Cost actuals and the full-scale forecast.
- Performance measurements.
- The daily audit sample job.
- Top-issue fixes found in the pilot (bugs in collectors, normalizers, resolution or linker), each with a regression test.
- The pilot report.
- The owner's decision.

**Out**
- News, briefs, alerts (M13).
- Agent API (M14).
- Activating the other 234 competitors (M15).
- New platforms or actors beyond T-08. A replacement actor needs the owner's approval and goes into DECISIONS first.

## 5. References

- `docs/PRD.md` §7 (NFR), §8 (success metrics), §10 (risks)
- `docs/AI_PIPELINE.md` §2 (models), §3 (Batch API), §5 (apply rules), §6 (vision), §8 (eval), §9 (linker), §11 (audit sample)
- `docs/SCRAPING_SOURCES.md` §2 (Instagram posts/reels), §3 (stories + bake-off), §5.2 (LinkedIn employees), §8 (cost estimates), §9 (health checks)
- `docs/N8N_WORKFLOWS.md` §2 (schedule), §3 (executions budget), WF-30, WF-32, WF-91
- `docs/DATA_SCHEMA.md` §4 (ops tables, settings), §5 (RPCs)
- `docs/TESTING.md` §1 (AI eval, performance)
- `docs/OPEN_QUESTIONS.md` Q-07, Q-08, Q-09
- `docs/DECISIONS.md` (T-06 threshold, D-24 public data only, T-08 approved actors)

## 6. Deliverables

| Deliverable | Path |
|---|---|
| Analysis queries (re-runnable, read-only) | `scripts/pilot/*.sql` + `scripts/pilot/run-report.ts` (runs the queries, writes JSON + markdown tables) |
| Pilot report | `docs/reports/pilot-report.md` (+ `docs/reports/pilot-data/*.json` raw numbers, `docs/reports/pilot-charts/*.png` optional) |
| Audit sample + results | `eval/audit-pilot.v1.jsonl` (200 labeled items), `eval/results-audit-pilot-<date>.md` |
| Calibration | `eval/calibration-<date>.md`: table of threshold → share published, accuracy of published |
| Prompt v2 (only if needed) | `n8n/prompts/extract_item.v2.md` (+ schema v2 only if the fields change), WF-30 updated, exported JSON |
| Tuning migration / settings change log | Settings changed via `app.admin_set_setting` (audit log) in prod; defaults updated in a migration if they differ from seed |
| Daily audit sample | RPC `ops.create_audit_sample(p_n int)`, called from WF-91 (or a new step in WF-32); review tasks with `reason = 'audit_sample'` |
| Fixes for pilot issues | Code + regression tests, listed in the report "Issues and fixes" |
| Updated docs | `docs/DECISIONS.md` → Changes; `docs/OPEN_QUESTIONS.md` (struck rows for Q-07/08/09); `docs/SCRAPING_SOURCES.md` §8 updated with measured numbers |

## 7. Tasks

### T1: Confirm pilot window and freeze a snapshot
- Confirm the window: `select min(started_at), max(started_at), count(distinct started_at::date) from ops.scrape_runs where env = 'prod' and mode = 'daily';` must show ≥ 14 days.
- Record the window (`pilot_from`, `pilot_to`) in PROGRESS.md. All T2–T4 queries use it.
- Optionally create a **read-only analysis role** session (owner connection or `api_agent`). Never run analysis writes in prod.
- **Done when:** the window is recorded and the queries run in < 30 s each.

### T2: Coverage and collector reliability
Write `scripts/pilot/coverage.sql` and the report section "Coverage". For each platform (vimeo, instagram, instagram_stories, website_work_page, linkedin, linkedin_employees, youtube) and each actor or API:
- **Account health:**
  - accounts active / failing / invalid / paused;
  - % of accounts with a successful run in the last 48 h (target ≥ 95%);
  - median and p95 run duration.
- **Items:** items new per day (total and per account), backfill items vs daily items, items per competitor (top and bottom 10), and competitors with **zero** items on a platform where they have an account (possible misses).
- **Failures:** failures by error class (rate limit, login wall, private, actor contract drift, timeout, other), from `ops.scrape_run_accounts.error` and `ops.audit_log` `workflow_error`.
- **Duplicates and idempotency:** duplicate rate (`ai_status = 'duplicate'`); idempotency check: zero `(platform, external_id)` collisions (the unique constraint guarantees it; report re-run evidence from M04–M06).
- **Watermark sanity:** accounts whose `last_item_published_at` is older than their competitor's newest item on any other platform by more than 14 days (stale handle?).
- **Miss check (sampled):** for 20 random pilot accounts per platform, compare items stored for the last 7 days with a manual look at the public profile. Record the count found vs expected in the report as "spot-check recall". Manual browsing of public pages is fine; no logins.
- **Done when:** the coverage table is complete and every account under 95% health is explained (in the report) with a fix or a decision.

### T3: Collector decisions (stories, reels, LinkedIn employees, fallbacks)
- **Stories bake-off** (if not already decided in M06):
  1. Run the 3 story actors on the same 20 pilot usernames, twice a day for 3 days, in dev.
  2. Compare stories captured, stories missed (seen by one actor but not another), cost per story and per profile, error rate, and login requirement (must be none).
  3. Pick the primary and fallback.
  4. Record the choice in DECISIONS → Changes (MA-16).
- **Stories cadence (Q-08):** compute the share of stories whose `taken_at` is more than 12 h before the capture time, and estimate the misses with one run a day vs two (stories expire after 24 h).
  - Recommend twice a day if the estimated misses exceed 10%.
  - Set `stories_twice_daily` accordingly.
- **Reels pass (Q-09):** overlap = the share of `resultsType = reels` results also returned by the `posts` run (match on shortCode).
  - If overlap ≥ 95%, disable the separate reels pass in WF-11 (save ~50% of Instagram actor cost).
  - Otherwise keep it.
- **LinkedIn employees:**
  1. Report the profiles per company per week and the cost.
  2. Propose one lever for the owner: `maxItemsPerCompany` 100 vs 200, or bi-weekly cadence (`cadence = 14 days`).
  3. Include the cost per month for each option.
- **Fallbacks:** how often goat255 (Vimeo) and streamers/youtube-scraper (YouTube) were used, and why. If the Vimeo API needs app approval or failed for some accounts, list them.
- **Done when:** each decision has numbers, a recommendation, and a row in the report's "Decisions needed" table (for the owner in MA-22).

### T4: Cost actuals and full-scale forecast
Write `scripts/pilot/costs.sql` and the report section "Cost".
- **Actuals** over the pilot window from `ops.cost_ledger`:
  - by provider (apify, openai, serpapi, firecrawl, fixed fees), platform, category (scrape, ai_extract, embed, brief, news, fixed_fee) and day;
  - backfill vs daily (join `ops.scrape_runs.mode`);
  - cost per new item (daily only) and cost per commercial item published.
- **Estimate vs actual:** for each line in SCRAPING_SOURCES §8, show estimate, actual and delta %. Explain any delta over 30%.
- **Full-scale forecast** for 284 competitors (≈ 1,069 primary accounts excl. work pages, 1,272 rows incl. work pages and baseline; per-platform counts in `docs/DATA_SCHEMA.md` §6):
  - Scale the per-account daily costs by platform using **measured** per-account volumes (not the assumptions).
  - Add OpenAI with the measured items per account per day × cost per item.
  - Add fixed fees (n8n, Supabase, Vercel, SerpAPI plan, Firecrawl plan) from `ops.price_book`.
  - Output: daily steady state, monthly steady state, and a one-time backfill for the remaining 234 competitors (874 primary accounts; 1,035 rows incl. work pages). Give a range (p50 and p90 volumes).
- **Executions forecast:** n8n executions per day at full scale vs the 50K/month quota (N8N_WORKFLOWS §3).
- **Budget recommendation (Q-07):**
  - `daily_budget_usd` for scale-up days (backfill) and for steady state;
  - a suggested OpenAI monthly cap.
- **Done when:** the forecast table is in the report, and its inputs are traceable to queries in `scripts/pilot/`.

### T5: Fresh 200-item accuracy audit
- Build the sample with `scripts/eval/build-sample.ts` (from M07), reused with new parameters:
  - **Source:** items **published in the pilot window and not in the M07 eval set**.
  - **Stratification:**
    - platform;
    - country;
    - competitor rank band (1–10, 11–25, 26–50);
    - `ai_status` (published 140, review 40, skipped 20);
    - include ≥ 15 Arabic-only captions and ≥ 15 website project pages.
- **Labels:**
  1. Codex pre-fills labels with the strongest model.
  2. The owner or a researcher confirms them in the app's review UI. Use review tasks with `reason = 'audit_pilot'`, priority 50, and a "Label" action that stores the confirmed truth in `review_tasks.resolution`.
  3. Alternatively, export `eval/audit-pilot.v1.csv` for a sheet review and import it back.
- **Run** `scripts/eval/run.ts` against the **stored** pilot extractions (no new AI calls needed), using the targets in §2.
- **Errors:** cluster them by type (brand confused with agency, wrong production house when a service company is credited, Arabic names unresolved, non-commercial posts marked commercial, occasion misses around Saudi National Day, and so on). Give 3 examples each, with item IDs.
- **Done when:** `eval/results-audit-pilot-<date>.md` exists with the metric table, error clusters and examples, and the labels are locked (committed JSONL).

### T6: Calibration and threshold choice
- From the audit plus all human resolutions in the pilot (review tasks approved or corrected count as labels), compute for thresholds 0.60–0.95 in steps of 0.05:
  - the share of items that would auto-publish;
  - the accuracy of those items (brand + production house + commercial flag all correct);
  - the expected review-queue volume per day at full scale.
- Choose the **lowest** threshold where the accuracy of auto-published items is ≥ 93% (AI_PIPELINE §8). If no threshold reaches 93%, keep 0.80, set the prompt v2 work (T7) as mandatory, and re-measure.
- Do the same per-field analysis for alias matching:
  - the precision of trigram matches at 0.5 / 0.6 / 0.7;
  - embedding matches at 0.80 / 0.85 / 0.90 (if enabled);
  - linker similarity at 0.78 / 0.82 / 0.86, using approved and rejected `campaign_merge` tasks.
- **Done when:** `eval/calibration-<date>.md` has the tables and the recommended values (threshold, `alias_trgm_min`, `alias_embedding_min`, `campaign_similarity_min`, `campaign_window_days`). Values are applied in dev; prod waits for MA-22.

### T7: Prompt v2 and resolver/linker fixes (only for clusters that miss targets)
- For each error cluster that causes a metric to miss its target, change the smallest thing:
  1. **Prompt rules first** (`extract_item.v2.md`), for example:
     - clearer agency vs brand rule;
     - service-company wording;
     - Arabic credit verbs ("إخراج", "تصوير", "مونتاج", "إنتاج");
     - Saudi/Egyptian occasion cues.
  2. **Then the resolver:** normalization of Arabic letters (alef forms, taa marbuta, diacritics) in `private.norm`; handle-first matching.
  3. **Then the linker** settings.
- Re-run the extraction **only on the 200 audit items** with v2 (≈ 200 calls; post the cost estimate first, AGENTS rule 9). Compare v1 and v2 on the same items. Adopt v2 only if it is better or equal on every target metric and not more than 20% more expensive.
- If the schema changes (new field), create `item_extraction.v2.json` and update `ops.apply_extraction`. Avoid a schema change unless needed.
- Re-extraction of already-published pilot items is **not** automatic. Propose it to the owner with the cost (MA-22 decision row).
- **Done when:** v2 (or "v1 kept") is decided with comparison numbers, WF-30 is updated and exported, and regression tests are added for each fixed resolver or linker bug.

### T8: Fix the pilot's top issues
- Collect issues from WF-90 errors, health emails, T2 failures, review-queue reasons and owner notes in M08–M11 PROGRESS files.
- Rank them by impact (missing data > wrong data > cost > UX).
- Fix the top issues that block "go": every Sev-1 and Sev-2 (definitions in the report). Each fix gets a regression test first (TESTING §3 rule 2), a log line, and a row in "Issues and fixes".
- **Done when:** no open Sev-1; Sev-2s are fixed or explicitly accepted by the owner in MA-22.

### T9: Performance numbers
- **Web:** Lighthouse on `/`, `/feed`, `/campaigns/[id]`, `/competitors/[slug]` and `/search` (prod or preview against prod-sized data). Targets: TTFB p75 < 300 ms on cached pages; feed and search < 1.5 s p75 (PRD §7).
- **DB:** run `EXPLAIN (ANALYZE, BUFFERS)` on the feed query, competitor profile queries, `app.search` (keyword-only and hybrid), `app.similar`, `ops.get_due_accounts` and `ingest.upsert_raw_items` with a 200-item batch. Record the plans' key lines.
- **Synthetic scale check:** in **dev**, generate 100k synthetic items + embeddings (script `scripts/perf/synthetic.ts`) and confirm `app.search` stays under 800 ms of DB time. Add indexes if needed (migration + advisors).
- **Done when:** the numbers are in the report; any miss has a fix or an owner-accepted note.

### T10: Daily audit sample job
- **Migration:** add `ops.create_audit_sample(p_n int default 10) returns int`:
  - picks `p_n` random items auto-published in the last 24 h that have no open audit task;
  - inserts `app.review_tasks` (`kind = 'item_low_confidence'`, `reason = 'audit_sample'`, `priority = 200` (low), `suggestion` = current values);
  - returns the count.
  - It is `SECURITY DEFINER` in `ops`, EXECUTE granted to `n8n_writer` only.
- **Workflow:** call it from WF-91 (daily 09:15) after the health step. Export WF-91.
- **Review UI:** `/review` shows audit tasks under a filter chip "Audit". Resolving one as approve/correct feeds the running accuracy metric.
- **Metric:** add `ops.audit_accuracy(p_days int default 30) returns jsonb` (brand, production house and commercial-flag accuracy of resolved audit tasks), surfaced on `/admin/pipeline` as a small KPI tile "Audit accuracy (30d)".
- **Tests:** pgTAP: the sample never picks a non-published item, never duplicates an open audit task, and respects `p_n`.
- **Done when:** the job runs once in dev and once in prod (after MA-22), creating 10 tasks.

### T11: Write the pilot report
`docs/reports/pilot-report.md`, written in plain English for the owner (one screen per section, tables first):
1. **Summary:**
   - three lines: coverage, accuracy, cost;
   - the recommendation: go / go with fixes / no-go.
2. **Pilot facts:** window, competitors, accounts per platform, items collected (backfill vs daily), commercial items, campaigns, review tasks.
3. **Coverage & reliability** (T2).
4. **Collector decisions** (T3) with recommendations.
5. **AI accuracy** (T5): table vs targets, error clusters, examples.
6. **Calibration & tuning** (T6, T7): recommended values; v1 vs v2.
7. **Review queue:** volume per day, median age, % resolved, top reasons.
8. **Cost:** actuals, estimate vs actual, cost per item, full-scale forecast with p50/p90, backfill estimate for 234 competitors, budget recommendation, n8n executions forecast.
9. **Performance** (T9).
10. **Issues and fixes** (T8): severity, status, test.
11. **Decisions needed from the owner:** a table with each decision, the options, the recommendation and the cost impact:
    - threshold;
    - prompt v2;
    - re-extract pilot items;
    - stories actor and cadence;
    - reels pass;
    - LinkedIn employees cap;
    - daily budget;
    - scale-up wave size for M15.
12. **Readiness checklist for M13–M15.**

**Done when:** the report is committed and linked in the root PROGRESS.md log, and the owner is asked for MA-22.

### T12: Owner gate (MA-22) and apply decisions
1. Add MA-22 to PROGRESS.md "Manual actions needed". The owner reads the report and answers each row of "Decisions needed".
2. Record the decision in `docs/DECISIONS.md` → Changes. Example: "2026-11-xx · Pilot gate: GO. Threshold 0.80→0.75, prompt v2 adopted, stories twice daily, reels pass off, employees cap 100. Approved by Owner."
3. Apply the approved settings in **prod** via `app.admin_set_setting` (audited), deploy the WF-30/WF-11/WF-12/WF-18b changes to the prod workflows, export JSON, and verify the next daily run uses them.
4. Update `docs/OPEN_QUESTIONS.md` (strike Q-07, Q-08, Q-09), `docs/SCRAPING_SOURCES.md` §8 (measured numbers) and `docs/AI_PIPELINE.md` (chosen values).
5. On "no-go": list the required fixes as new tasks in this milestone, keep the status `In progress`, and repeat T5/T6 after the fixes.
6. **Done when:** the decision is recorded, prod runs with the new settings for 2 consecutive days without errors, and the root board has M12 `Done` and M13 `Not started` → next.

## 8. Interfaces & contracts

- `ops.create_audit_sample(p_n int) → int` (new, T10). Caller: WF-91.
- `ops.audit_accuracy(p_days int) → jsonb` (new, T10). Caller: `app.pipeline_summary` (admin). Shape: `{brand, production_house, commercial, n}`.
- `scripts/pilot/run-report.ts`:
  - **Input:** `--from YYYY-MM-DD --to YYYY-MM-DD --env prod`.
  - **Connection:** `SEED_DATABASE_URL` (owner, local only) **or** a read-only analysis connection. It never writes.
  - **Output:** `docs/reports/pilot-data/*.json` + markdown tables to stdout.
- `eval/audit-pilot.v1.jsonl` line: `{item_id, truth: {is_commercial_work, brand_org_id|null, agency_org_id|null, production_competitor_id, content_type, occasion, country, credits:[{person_name, role}]}, labeled_by, labeled_at}`.
- Settings keys changed only through `app.admin_set_setting` (writes `ops.audit_log`).
- Review tasks: `reason` values `audit_pilot` (T5, one-off) and `audit_sample` (T10, daily).

## 9. Acceptance criteria

- **AC1:** `docs/reports/pilot-report.md` exists with all 12 sections, every number traceable to `scripts/pilot/*.sql` or `eval/*` outputs.
- **AC2:** Coverage: the share of pilot accounts with a successful run in the last 48 h is reported per platform. Any platform under 95% has a documented cause and fix or acceptance.
- **AC3:** Accuracy: 200 labeled audit items are committed. The metric table is reported against all AI_PIPELINE §8 targets. The calibration table is reported.
- **AC4:** A threshold is chosen by the rule (lowest value with ≥ 93% accuracy of auto-published items) or kept with justification, and approved by the owner.
- **AC5:** Costs: actuals by provider, platform and category; estimate-vs-actual table; full-scale monthly forecast (p50/p90) and a backfill estimate for the remaining 234 competitors; n8n executions forecast ≤ 50K/month.
- **AC6:** Collector decisions (stories actor and cadence, reels pass, LinkedIn employees cap) are made with numbers and recorded in DECISIONS → Changes. The chosen story actor needs no login (D-24).
- **AC7:** Daily audit sample job: running in prod and creating 10 tasks per day; pgTAP tests green; the audit-accuracy tile visible on `/admin/pipeline`.
- **AC8:** No open Sev-1 issues. Every fix has a regression test, and CI is green.
- **AC9:** The owner's go/no-go (MA-22) is recorded in `docs/DECISIONS.md` → Changes. On go, the approved settings are live in prod and 2 consecutive daily prod runs succeed with them.
- **AC10:** OPEN_QUESTIONS Q-07/08/09 are resolved (struck, with answers moved to DECISIONS).

## 10. Tests to write

- **pgTAP** (`supabase/tests/m12_audit_sample.test.sql`):
  - `ops.create_audit_sample` picks only `published` items from the last 24 h;
  - it never creates a second open audit task for the same item;
  - it returns ≤ `p_n`;
  - `n8n_writer` can execute it, and `authenticated` cannot.
- **pgTAP:** `ops.audit_accuracy` returns correct shares on a fixture of 10 resolved tasks.
- **Vitest:**
  - calibration math (`scripts/eval/calibration.ts`): known input, then expected table;
  - forecast math (`scripts/pilot/forecast.ts`): per-platform scaling, p50/p90.
- **Regression tests** for every T8 fix, at the right layer (normalizer fixture, pgTAP or e2e).
- **Prompt v2:** the eval run output is committed (`eval/results-*-v2-*.md`) as evidence. No live test is needed in CI.

## 11. Manual actions from the owner

| ID | Action | When | Notes |
|---|---|---|---|
| MA-16 | Pick the stories actor (if it is still open) | T3 | Bake-off table in the report |
| — | Label or confirm the audit items (or delegate to a researcher) | T5 | About 1–2 hours in the review UI with keyboard shortcuts |
| — | Approve the cost of the v2 re-extraction on the 200 audit items | T7 | Estimate posted first; typically < $2 |
| **MA-22** | **Pilot go/no-go:** answer every row in "Decisions needed" | T12 | Recorded in DECISIONS → Changes |

## 12. Risks & gotchas

- **Survivorship bias:** items never collected can't be audited from the DB. That is why T2 includes the manual spot-check against public profiles.
- **Label leakage:** don't reuse M07 eval items, which may have influenced prompt v1. Exclude them by ID.
- **Calibration on a small sample:** 200 items gives ±3–5% error on accuracy. Combine it with the pilot's human resolutions and state the sample size next to each number.
- **Prod safety:** all analysis is read-only. Settings changes in prod happen only after MA-22, via the audited RPC.
- **Backfill skews costs:** report backfill and daily separately. Forecast the steady state from daily runs only.
- **Story capture timing:** stories expire after 24 h, so the miss estimate is an estimate. State the assumption.
- **The Batch API** changes latency (up to 24 h). Use it only for backfill items, never for the daily flow.
- **Changing the threshold** changes which items reach the feed and briefs. Don't retroactively un-publish items. The new threshold applies to new extractions only, unless the owner asks for re-scoring.

## 13. Cost & budget notes

- **Analysis:** about free (SQL + local scripts).
- **Pre-labeling** the audit with the strongest model: 200 calls (≈ $1–3). **v2 comparison:** 200 calls (≈ $0.5–2). Post estimates first (AGENTS rule 9).
- **Story bake-off:** 20 users × 2 runs × 3 days × 3 actors. data-slayer ≈ $0.01/day; igview ≈ $0.03/day + start fees; louisdeconinck ≈ $0.36/day (per profile, paid plan). Total < $5.
- **Synthetic perf data:** dev only. Embeddings for 100k synthetic items can be **random vectors** (no OpenAI cost).

## 14. Definition of done & hand-off

**Done when:**
- AC1–AC10 pass, with evidence in PROGRESS.md.
- The PR `m12-pilot-review` is merged and CI is green.
- Prod settings match the approved decision.
- The root PROGRESS.md board shows M12 `Done`.
- The "Key dates" table has "Pilot review (day 14)" filled in.

**Hand-off to M13:**
- The current settings values.
- Prompt version in production.
- Chosen story actor and cadence.
- Measured cost per item.
- The forecast table (M15 uses it for wave sizing and backfill approval).
- The list of accepted Sev-2 issues, plus anything the owner deferred.
