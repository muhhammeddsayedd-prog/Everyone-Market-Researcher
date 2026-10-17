# M15 — Scale & launch

> Status lives in `./PROGRESS.md`. Read `AGENTS.md` first.

## 1. Goal and outcome

Take the system from the 50-competitor pilot to **all 284 competitors + baseline** in production, and launch it to the team. When M15 is done:

1. **Onboarding:** **WF-60 Competitor onboarding** validates the accounts of any competitor added in the app or API, resolves their IDs, starts the backfill from 1 Jan 2024, and emails the owner when it's done.
2. **Full scale:** the remaining **234 competitors** (174 next wave, 60 adjacent; 874 primary accounts, 1,035 rows incl. work pages) are activated in **approved waves**, backfilled and tracked daily. The system runs **7 clean daily runs in a row at full scale**.
3. **Production is hardened.** We have verified:
   - backups and PITR;
   - a clean advisors report;
   - RLS tests on prod (read-only);
   - monitoring and error alerting;
   - a rate-limit check;
   - a secrets rotation plan;
   - a dependency audit;
   - the TECHNICAL §12 security checklist with evidence;
   - load tests of feed, search and the API.
4. **Domain:** a custom domain (MA-27, optional) is live.
5. **Docs for the team:** `docs/USER_GUIDE.md` for the team and `docs/RUNBOOK.md` for the owner and admins.
6. **Launch:** the team is onboarded with roles, and the owner signs off (MA-28). The root `PROGRESS.md` shows every milestone `Done`.

## 2. Context you need

- **The rest of the competitors:**

  | Group | Tier | Count | Primary accounts (excl. work pages) | Rows incl. work pages |
  |---|---|---|---|---|
  | Pilot (already live) | `pilot` | 50 | 195 | 232 |
  | Baseline (already live) | `baseline` (C000) | 1 | 4 | 4 + 1 work page |
  | Next wave + adjacent (to activate) | `next_wave` (174) + `adjacent` (60) | 234 | 874 | 1,035 |
  | **All** | — | **285** | **1,073** | **1,272** |

  Counts are from `data/competitor_accounts.csv` (1,272 rows incl. 199 `website_work_page` rows). Derived rows (`instagram_stories`, `linkedin_employees`) come on top.

  - Since M02, accounts of non-pilot competitors exist with `status = 'paused'`, and their competitors are `active` or `paused` per M02's gating (check `ops.get_due_accounts`: it requires `a.status in ('active','failing')` and `c.status = 'active'`).
  - Per-platform totals for all 285: website 261, instagram 256, linkedin 226, vimeo 202, work page 199, youtube 128 (`docs/DATA_SCHEMA.md` §6). Stories rows mirror Instagram; LinkedIn employees rows mirror LinkedIn.
- **Cost reference:** use the M12 measured forecast if present (`docs/reports/pilot-report.md` §8). Otherwise use SCRAPING_SOURCES §8, plus AI costs on top:

  | | Pilot | All 284 |
  |---|---|---|
  | Scraping, per day | ≈ $2.4 | ≈ $12.4 |
  | Backfill | ≈ $70–80 | ≈ $360–410 |

  The remaining 234 competitors are roughly the full backfill minus the pilot's: ≈ $290–330 for scraping, plus OpenAI for the backfill items. Consider the **OpenAI Batch API** for backfill items (AI_PIPELINE §3; ≈ 50% cheaper, 24 h turnaround) if M12 approved it.
- **Backfill mechanics** (TECHNICAL §5, N8N_WORKFLOWS):
  - Accounts with `backfill_status = 'pending'` are picked up by the hourly **backfill wave** (10 accounts per platform per hourly slot, 10:00–23:00 ≈ 140 per platform per day).
  - Apify runs go **async** with ad-hoc webhooks, and WF-19 processes the datasets.
  - Every backfill item goes to the AI queue (or to the Batch API path).
  - The daily budget alert (`ops.settings.daily_budget_usd`) is the brake. SCRAPING_SOURCES §8 suggests $150 on backfill days and $25 in steady state. Use M12's recommendation if it differs.
- **WF-60** (N8N_WORKFLOWS WF-60, API_SPEC §6.3/6.4):
  - **Trigger:** Webhook `POST /webhook/emr-onboarding`, Header Auth credential `EMR webhook in · App` (`x-emr-secret: N8N_WEBHOOK_SECRET`), body `{competitor_id, account_ids[]}`. Respond 202 immediately.
  - **Callers:** the app's admin add/edit (`/admin/competitors/new` → server action → `/api/internal/onboarding` → n8n) and `POST /api/v1/competitors` (M14).
  - **Steps:**
    1. `ops.get_onboarding_accounts(competitor_id)` (**add in M15**).
    2. Resolve per platform: Vimeo vanity → numeric user ID; YouTube @handle → channel ID → uploads playlist `UU…` (1 quota unit each); a LinkedIn company slug check.
    3. Validate reachability: an HTTP GET of the public URL. An Instagram `details` run is optional and costs one result.
    4. `ops.set_account_status(account_id, status, reason)` (**add in M15**): set active/invalid.
    5. Valid accounts keep `backfill_status = 'pending'`, so the hourly backfill wave picks them up.
    6. SUB · Notify: "Competitor X onboarded: n accounts valid, m invalid".
    7. When the backfill finishes (all accounts `done`), a second notify: "Backfill done for X: N items". Use a WF-91 daily check, or the last account's `report_account_result`.
- **Rules that still apply:**
  - Public data only (D-24): if an account hits a login wall, mark it `invalid`, never use credentials.
  - Approved actors only (T-08).
  - Ads and LinkedIn jobs are out of scope (D-08).
  - Never delete data (rule 7).
  - Prod changes and paid bulk runs need the owner's approval (AGENTS rules 8–9).
- **Security checklist:** TECHNICAL §12 (RLS, security_invoker views, SECURITY DEFINER placement, no `user_metadata` authorization, no secrets in `NEXT_PUBLIC_*`, webhook secrets with constant-time compare, scoped tokens, advisors, pinned dependencies, public data only).
- **Rotation:** ENVIRONMENT §4 (pepper, role passwords, provider keys).
- **Optional, post-launch:** an Arabic UI locale (FR-W18 / Q-02). It is **not** part of this milestone's acceptance; it's listed in the hand-off backlog.

## 3. Prerequisites

| Item | Needed when | Notes |
|---|---|---|
| M12 "go" (MA-22) recorded | Before T3 | The scale-up plan follows M12's decisions |
| M13 Done (alerts, budget alert live) | Before T3 | The budget brake must work before the backfill waves |
| M14 Done (`POST /competitors` exists) | T1 | WF-60 replaces the soft-fail placeholder |
| **MA-26** approve waves + backfill cost | Before each wave | |
| **MA-27** custom domain (optional) | T8 | |
| **MA-28** security sign-off + team onboarding | T11 | |

## 4. Scope

**In:**
- WF-60 and its RPCs.
- The app/API onboarding wiring (`/api/internal/onboarding`).
- The scale-up waves with cost estimates and monitoring.
- Capacity tuning: AI batch size, n8n concurrency, pooler limits, queue depth.
- Production hardening and the security review.
- Load tests.
- The custom domain.
- `docs/USER_GUIDE.md` and `docs/RUNBOOK.md`.
- User onboarding.
- The launch sign-off.
- Final docs sync: DECISIONS, OPEN_QUESTIONS, the root PROGRESS.

**Out:**
- New platforms or actors.
- Ads and LinkedIn jobs.
- The Arabic UI (post-launch backlog).
- A mobile app.
- Social team features (D-03, later).

## 5. References

- `docs/N8N_WORKFLOWS.md` WF-60, §2 (schedule and backfill wave), §3 (executions at full scale ≈ 181/day ≈ 5,400/month of 50K), §8 RPC list (M15: `ops.get_onboarding_accounts`, `ops.set_account_status`)
- `docs/SCRAPING_SOURCES.md` §1–6 (resolution steps per platform), §8 (cost), §9 (health checks)
- `docs/API_SPEC.md` §5 `POST /competitors`, §6.3–6.4 (onboarding internal and outbound calls)
- `docs/TECHNICAL.md` §5 (due list, watermarks, backfill), §12 (security checklist), §13 (observability and cost), §14 (performance), §15 (deployment)
- `docs/DATA_SCHEMA.md` §6 (seed and gating), §8 (rules)
- `docs/ENVIRONMENT.md` §1–4
- `docs/PRD.md` §7 (NFR), §8 (success metrics), §9 (release plan)
- `DESIGN.md` §8.20 `/admin/competitors` (onboarding dialog), §8.22 `/admin/pipeline` (backfill progress)
- `docs/reports/pilot-report.md` (M12 forecast and decisions)

## 6. Deliverables

| Deliverable | Path |
|---|---|
| Migration | `supabase/migrations/<ts>_m15_onboarding_scale.sql`: `ops.get_onboarding_accounts`, `ops.set_account_status`, `ops.activate_wave`, `ops.backfill_progress`, grants |
| Workflow | `n8n/workflows/WF-60-onboarding.json` (dev + prod), updated WF-91 (backfill-done notifications, wave progress in the health email) |
| App wiring | `apps/web/app/api/internal/onboarding/route.ts` (forwards to n8n), the `/admin/competitors` save flow calls it, and `/admin/pipeline` backfill progress uses `ops.backfill_progress` via an admin worker |
| Wave plan + estimates | `docs/reports/scale-up-plan.md` (waves, accounts, estimated items and USD per wave, dates, status per wave) |
| Hardening evidence | `docs/reports/launch-readiness.md` (security checklist with evidence, backups/PITR, advisors output, prod RLS test results, load test numbers, monitoring setup, rotation plan, dependency audit) |
| Load test scripts | `scripts/perf/load-feed.ts`, `scripts/perf/load-search.ts` (reuse `scripts/perf/api-load.ts` from M14) |
| User docs | `docs/USER_GUIDE.md`, `docs/RUNBOOK.md` |
| Final docs sync | `docs/DECISIONS.md` Changes, `docs/OPEN_QUESTIONS.md`, root `PROGRESS.md` (all Done, key dates) |

## 7. Tasks

### T1: Onboarding RPCs and WF-60
- **Migration** (`supabase migration new m15_onboarding_scale`):
  - **`ops.get_onboarding_accounts(p_competitor_id uuid) returns jsonb`:**
    - **Returns:** the competitor plus all its accounts with platform, handle, url, external_id, status and backfill_status.
    - **Missing paired rows:** creates the `instagram_stories` and `linkedin_employees` rows if they are missing (cadence 1 day or 12 h per `stories_twice_daily`, and 7 days).
  - **`ops.set_account_status(p_account_id uuid, p_status app.account_status, p_reason text) returns void`:**
    - **Updates:** the status, plus `external_id` / `uploads_playlist_id` when passed through an overload or a jsonb variant.
    - **Audit:** writes `ops.audit_log` with `actor_type 'n8n'`.
    - **Reuse:** use `ops.set_account_external_id` from M04 for IDs rather than duplicating it.
  - **Grants:** `SECURITY DEFINER` in `ops`, `search_path = ''`, EXECUTE only for `n8n_writer`.
- **WF-60:**
  1. Webhook with the Header Auth credential `EMR webhook in · App` → respond 202.
  2. SUB · Start run (`WF-60`, null, `manual`).
  3. `ops.get_onboarding_accounts`.
  4. Switch per platform, reusing the M02 and M04 resolution logic:
     - **Vimeo:** `GET https://api.vimeo.com/users/{vanity}?fields=uri` → numeric ID.
     - **YouTube:** `channels.list?forHandle=@…&part=id,contentDetails` → channel ID and uploads playlist. For `/channel/UC…` URLs, use the ID directly. For `/user/…`, use `forUsername`.
     - **LinkedIn:** check that the company URL returns 200 publicly. No scraping beyond that.
     - **Instagram and websites:** an HTTP GET of the public URL; 404 → invalid. A login-wall response is **not** treated as invalid for Instagram, since logged-out HTML is normal; rely on the first collector run instead.
  5. `ops.set_account_status` per account.
  6. SUB · Notify the owner.
  7. SUB · Finish run.
- **Errors:** WF-90.
- **Export:** export WF-60 for dev and prod.
- **Done when:** in dev, adding a test competitor through `/admin/competitors/new` **and** through `POST /api/v1/competitors` both produce a WF-60 run, resolved IDs, `active` statuses, an email, and backfilled items within 24 h (the hourly wave).

### T2: App onboarding wiring and backfill progress
- **`POST /api/internal/onboarding`:**
  - **Caller:** the admin server action after `app.admin_upsert_competitor`. It checks the admin session server-side, so it isn't callable by agents.
  - **Forwarding:** forwards to `{N8N_WEBHOOK_BASE}/webhook/emr-onboarding` with `x-emr-secret: N8N_WEBHOOK_SECRET`.
  - **On failure:** shows a toast saying "Saved. Onboarding will start with the next backfill wave." and logs the failure. The data is safe: `backfill_status = 'pending'`.
  - **API path:** switch M14's `POST /api/v1/competitors` outbound call to the same helper (`lib/onboarding.ts`).
- **`ops.backfill_progress() returns jsonb`:** per platform, accounts with `backfill_status` pending/running/done/failed; per tier; per wave, using a wave tag in `competitor_accounts.backfill_cursor` or the new column below.
- **Wave tracking:** add an `activation_wave int` column on `app.competitors` (nullable) via the migration. Expose `ops.backfill_progress` through the admin worker `app.pipeline_summary`, extended. Show it on `/admin/pipeline` (DESIGN.md §8.22 backfill progress bar per platform and per wave).
- **Done when:** the e2e test shows an admin adding a competitor seeing the onboarding dialog, and `/admin/pipeline` shows its progress.

### T3: Scale-up plan and estimates (MA-26)
- Write `docs/reports/scale-up-plan.md`:
  - **Order:** `next_wave` by sheet order, or by an M12-recommended ordering such as Production-category first; then `adjacent`.
  - **Wave size:** default ≈ **60 competitors per wave, one wave per day**. That is about 4 waves for the 234, plus a buffer day. Respect the hourly backfill throughput: 10 accounts per platform per slot × 14 slots (10:00–23:00) ≈ 140 per platform per day. A 60-competitor wave (≈ 230 accounts across 5 platforms, ≤ 60 per platform) fits in one day.
  - **Per wave:** competitors, accounts per platform, estimated backfill items (measured items per account from M12), estimated scraping USD, estimated OpenAI USD (standard vs Batch API), estimated review-queue additions, and the expected n8n executions.
  - **Budget per wave day:** set `daily_budget_usd` to the wave's estimate × 1.3 for the duration, then return to the steady-state value.
  - **Stop rules:** pause the next wave if any of these hold:
    - the failed-account share is > 5%;
    - the AI queue depth is > 2,000 for more than 12 h;
    - the daily cost is > 130% of the estimate;
    - the review queue is > 1,500 open tasks;
    - any Sev-1 issue.
- **Approval:** post the plan and ask for **MA-26**. No wave starts without approval, and each wave needs its own "approved" line in PROGRESS (or an owner approval of the whole plan with dates).
- **Done when:** the plan is approved.

### T4: Wave activation mechanics
- Add **`ops.activate_wave(p_competitor_ids uuid[], p_wave int) returns jsonb`**, executable by the **owner/admin path only** (an `app.admin_activate_wave` wrapper with `private.has_role('admin')`, plus audit). It:
  1. sets `app.competitors.status = 'active'` and `activation_wave`;
  2. sets accounts `status = 'active'` (except `invalid`);
  3. leaves `backfill_status = 'pending'`;
  4. returns the counts.
- **Admin UI:** an "Activate wave" action on `/admin/competitors` (bulk select or a CSV of slugs), with a confirm that shows the estimate from the plan.
- **Order:** run WF-60 validation for the wave's accounts **before** activation (batch mode: WF-60 accepts `{competitor_ids[]}`) so invalid handles don't waste backfill runs.
- **Done when:** the activation of a 3-competitor test wave in dev works end to end and is audited.

### T5: Run the waves (prod)
For each approved wave:
1. Validate.
2. Activate.
3. Monitor: backfill progress, queue depth (`ai_extract`, `embed`, `media`), cost vs estimate, failing accounts, review-queue size, the n8n execution count and errors, and the Supabase CPU, connections and pooler.
4. Log a daily line in PROGRESS with these numbers.
5. Apply the stop rules.
6. After the wave's backfill is done, check the competitors with **zero** items on a platform where they have an account. These may be wrong handles or inactive accounts; list them for the owner. Never auto-fix by guessing new URLs. Suggested new accounts go through the review flow (FR-C6).

Capacity tuning as needed, with every change logged:
- `ai_batch_size`;
- WF-30 concurrency (OpenAI rate limits);
- the Batch API for backfill items, if approved;
- `vision_max_share`;
- n8n concurrency;
- Postgres indexes (check `pg_stat_statements` for the top queries);
- HNSW parameters (`ef_search`), if search slows down.

**Done when:** all 234 competitors are active, and every account's backfill is `done`, `failed` (with reason) or `invalid`.

### T6: Full-scale steady state (7 clean days)
- **"Clean daily run"** means all of these:
  - every scheduled slot ran;
  - ≥ 97% of active accounts succeeded in the last 48 h (PRD §8, 3-month target; ≥ 95% is acceptable for launch with owner OK);
  - no Sev-1 errors;
  - AI queue drained to < 200 by 18:00 Cairo;
  - daily cost ≤ the approved steady-state budget;
  - the digest was sent at 09:00.
- Track each day in PROGRESS (a 7-row table).
- Reset `daily_budget_usd` to the steady-state value after the last wave.
- **Done when:** there are 7 consecutive clean days. A failed day resets the count, with its cause and fix logged.

### T7: Production hardening and security review
Write `docs/reports/launch-readiness.md` with evidence for each item:
1. **Backups and PITR:** confirm the Supabase plan backups and enable PITR if the owner approves the add-on cost. Do a **restore drill** into a scratch project or branch (verify what the plan supports) and record the time to restore.
2. **Advisors:** run `supabase db advisors` (or MCP `get_advisors`) on prod. Zero security findings; performance findings fixed or accepted.
3. **RLS on prod, read-only:** run the RLS pgTAP subset against a prod **read-only** connection, or run read probes as a non-member test user and as `api_agent`, and show the zero-row and refusal results. Never write test data to prod (TESTING rule 3).
4. **Exposed schemas:** confirm the Data API exposes only `app`, the `api`/`ops`/`ingest`/`private` schemas are not exposed, and anon has no grants.
5. **Secrets:**
   - grep the repo and the n8n exports for secret patterns (gitleaks in CI);
   - confirm no secrets are in `NEXT_PUBLIC_*`;
   - confirm the secret key is used only in the media-upload route;
   - document the **rotation plan** with dates (ENVIRONMENT §4): role passwords every 6 months, pepper only with key re-issue, provider keys on leak or staff change.
6. **Webhooks:** every internal route and the n8n webhooks reject a missing or wrong `x-emr-secret`. Test `/api/revalidate`, `/api/internal/*`, WF-19 and WF-60.
7. **Auth:**
   - invite-only works (T-11);
   - a non-invited Google account lands on `/no-access`;
   - role changes take effect;
   - session expiry is sensible;
   - deleted or disabled members lose access (`members.status = 'disabled'` → RLS denies).
8. **Rate limits:** the API 429 behaviour is re-verified in prod with a test key, which is revoked afterwards.
9. **Dependencies:** `pnpm audit` (or `osv-scanner`); Dependabot enabled; lockfile committed; no high or critical vulnerabilities, or each one has a documented mitigation.
10. **Monitoring and alerting:**
    - Vercel Analytics or Speed Insights enabled, if the owner approves the plan cost;
    - Vercel log drains or error notifications for 5xx spikes;
    - Supabase usage alerts;
    - n8n error workflow (WF-90) emails;
    - the daily health email (WF-91);
    - the budget alert (M13).

    List who receives each.
11. **Public data only:** confirm no actor input contains cookies or session fields (grep the workflow JSON for `cookie`, `sessionid`, `initialCookies`, `login`). Confirm that login-wall handling marks accounts invalid.
12. **Data hygiene:** people store only public professional data (Q-05). There are no photos or contact data in `employee_snapshots`, and items are never deleted.
- **Done when:** every item has evidence, and open items are explicitly accepted by the owner in MA-28.

### T8: Load tests and domain
- **Load tests** against prod-sized data (prod read-only, or dev loaded with a copy of the counts):
  - `/` and `/feed`: 50 concurrent users for 5 min;
  - `/search` (keyword + semantic): 20 concurrent;
  - `GET /api/v1/items` and `/search`: 100/min.
- **Targets** (PRD §7):
  - cached pages TTFB p75 < 300 ms;
  - feed and search < 1.5 s p75;
  - `app.search` DB time < 800 ms at full data size;
  - 0 5xx.
- Record the numbers in launch-readiness. Fix regressions (indexes, caching tags, `revalidate` fallbacks).
- **Custom domain (MA-27, optional):**
  - the owner adds e.g. `radar.everyone.film` in Vercel (DNS);
  - update the Supabase Auth Site URL and redirect URLs, the Google OAuth redirect, `NEXT_PUBLIC_SITE_URL`, the n8n `app_url` (Config node or Variables), the email links, and the MCP URL in the docs.
- **Done when:**
  - the load targets are met or the gaps are accepted;
  - if the domain was done, sign-in, emails and MCP work on the new domain.

### T9: User guide and runbook
- **`docs/USER_GUIDE.md`** is for the team: plain English, short, with screenshots stored in `docs/assets/guide/`. It covers:
  - signing in;
  - the market pulse;
  - the feed with filters and saved views;
  - campaigns;
  - competitor profiles and compare;
  - brands, agencies and people;
  - search tips (semantic examples) and "find similar";
  - briefs and alerts settings;
  - the review queue (analysts) and its keyboard shortcuts;
  - what the confidence badge means;
  - how to report a wrong attribution;
  - the API/MCP connection for power users (link to `/docs/api`).
- **`docs/RUNBOOK.md`** is for the owner and admins, with step-by-step procedures for:
  - adding a competitor (app or API) and checking onboarding;
  - pausing or archiving a competitor;
  - fixing a wrong handle;
  - re-running a source or account (`/admin/pipeline` re-scrape; daily vs backfill);
  - handling a broken actor: symptoms (normalizer drift alert, failing accounts), check the actor's Apify page or changelog, switch to the approved fallback, and when to ask for a new actor (owner approval, DECISIONS entry);
  - rotating keys and passwords (role passwords, pepper, provider keys, API keys);
  - restoring from backup (the drill steps from T7);
  - reading the costs page and the budget alert response;
  - reading the health email;
  - common n8n errors;
  - changing taxonomies and thresholds safely;
  - inviting and removing users;
  - an escalation and contacts list (Supabase, Vercel, n8n, Apify support links).
- **Done when:** the owner reviews both docs (part of MA-28) and they're linked from the app's user menu ("Help") and from `/admin`.

### T10: Final docs sync
- **`docs/DECISIONS.md` → Changes:** record the scale-up dates, wave sizes, steady-state budget, domain, and any deviations.
- **`docs/OPEN_QUESTIONS.md`:** every row answered or explicitly moved to a "Post-launch backlog" section. Q-02 (Arabic UI) goes into the backlog.
- **Spec drift:** update `docs/SCRAPING_SOURCES.md` §8 and `docs/N8N_WORKFLOWS.md` §3 with the measured full-scale numbers.
- **Root `PROGRESS.md`:** M15 `Done`, key dates (production launch), and a log line.
- **Post-launch backlog** (a section at the end of root PROGRESS.md):
  - Arabic UI (FR-W18 / Q-02);
  - the social media team role (D-03 later);
  - a possible Upstash rate limiter;
  - a re-extraction of pre-v2 items, if one was deferred;
  - an optional OAuth for MCP;
  - additional actors for any platform gaps (owner approval).
- **Done when:** all of this is committed.

### T11: Launch and onboarding (MA-28)
- The owner reviews `docs/reports/launch-readiness.md` and signs off (MA-28).
- Invite the team with roles (`/admin/users`): researchers as analysts, executives and management as viewers, the owner as admin. Invites are personal (D-26).
- Check that each invited user can sign in (the owner confirms 2–3 people).
- Send the launch email (WF-80 one-off or manual): a link to the app, the user guide and `/settings/alerts`.
- **Done when:** the sign-off is recorded in DECISIONS → Changes and the first users are active (`members.last_seen_at` set).

## 8. Interfaces & contracts

- `ops.get_onboarding_accounts(competitor_id uuid) → jsonb`: `{competitor:{id, slug, name}, accounts:[{id, platform, handle, url, external_id, status, backfill_status}]}`.
- `ops.set_account_status(account_id uuid, status app.account_status, reason text) → void` (audited).
- `ops.activate_wave(competitor_ids uuid[], wave int) → jsonb` through `app.admin_activate_wave` (admin): `{competitors, accounts_activated, accounts_skipped_invalid}`.
- `ops.backfill_progress() → jsonb`: `{by_platform:[{platform, pending, running, done, failed}], by_wave:[{wave, competitors, accounts, done_pct}]}`.
- WF-60 webhook: `POST /webhook/emr-onboarding`, `x-emr-secret`, body `{competitor_id}` | `{competitor_ids[]}` (batch), response 202.
- `/api/internal/onboarding` (admin session required): `{competitor_id}` → forwards; `200 {forwarded: boolean}`.

## 9. Acceptance criteria

- **AC1:** Adding a competitor in `/admin/competitors/new` and via `POST /api/v1/competitors` both trigger WF-60. IDs resolve, invalid accounts are flagged with a reason, the owner gets an email, and backfilled items appear within 24 h.
- **AC2:** The scale-up plan is approved (MA-26). All 234 remaining competitors are activated in waves. Each wave is logged with estimated vs actual items and USD, and no stop rule was ignored.
- **AC3:** After the waves, 100% of tracked accounts have `backfill_status` `done`, `failed` (with reason) or `not_applicable`, or the account is `invalid` with a reason. The zero-items list was reviewed by the owner.
- **AC4:** **7 consecutive clean daily runs at full scale**, as defined in T6, with the 7-day table in PROGRESS.
- **AC5:** n8n executions at full scale stay within the quota (actual daily executions × 30 ≤ 50,000) and are recorded.
- **AC6:** Launch readiness: every item in T7 has evidence. Advisors show zero security findings. The prod RLS read-only probes pass. The restore drill is done with its time recorded. There are no high or critical dependency vulnerabilities, or each is mitigated with the owner's acceptance.
- **AC7:** The load-test targets (PRD §7) are met or the gaps are explicitly accepted by the owner.
- **AC8:** `docs/USER_GUIDE.md` and `docs/RUNBOOK.md` exist, are reviewed by the owner, and are linked in the app.
- **AC9:** The owner's security sign-off and launch (MA-28) are recorded in DECISIONS → Changes. Team members are invited and at least 2 besides the owner have signed in.
- **AC10:** Root `PROGRESS.md`: every milestone is `Done`, the key dates are filled in, the post-launch backlog is listed, and OPEN_QUESTIONS is resolved or moved to the backlog.

## 10. Tests to write

- **pgTAP:**
  - `ops.get_onboarding_accounts` creates the missing stories and employees rows exactly once;
  - `ops.set_account_status` writes audit;
  - `app.admin_activate_wave` is refused for non-admins, activates only non-invalid accounts, and is idempotent;
  - `ops.backfill_progress` counts are correct on fixtures.
- **Vitest:** `lib/onboarding.ts` (secret header, soft-fail behaviour); the wave-estimate calculator (`scripts/scale/estimate.ts`).
- **Playwright:**
  - add competitor → onboarding dialog → pipeline progress shows it;
  - the activate-wave confirm dialog shows the estimate;
  - axe on `/admin/pipeline`.
- **Webhook security tests:** wrong or missing secret → 401 for `/api/revalidate`, `/api/internal/*`, WF-60, WF-19. For the n8n webhooks, use a manual check recorded in PROGRESS.
- **Load scripts:** committed, with results in launch-readiness.

## 11. Manual actions from the owner

| ID | Action | When | Notes |
|---|---|---|---|
| **MA-26** | Approve the scale-up waves (sizes, dates, per-wave cost) and the temporary daily budget | Before T5 | The plan is in `docs/reports/scale-up-plan.md` |
| — | Approve any paid add-ons (PITR, Vercel Analytics) if needed | T7 | List the costs first |
| **MA-27** | (Optional) add the custom domain DNS in Vercel; confirm the domain name (Q-04) | T8 | Then Codex updates the auth URLs, n8n config and emails |
| — | Review the zero-items list after each wave; fix or mark handles | T5 | Suggested accounts go through the review flow |
| **MA-28** | Review launch readiness; give the security sign-off; invite the team with roles; confirm users can sign in | T11 | Recorded in DECISIONS → Changes |

## 12. Risks & gotchas

- **Queue backlog during waves:** about 874 primary accounts (≈ 207 of them Instagram) × ~450 backfill items per Instagram account means tens of thousands of AI items. Use the Batch API for backfill if it was approved, and keep the daily items flowing first. Prioritise daily (non-backfill) messages in WF-30, for example with two queues `ai_extract` and `ai_extract_backfill`, or a `priority` field checked by the claim RPC.
- **Pooler and connection limits:** n8n plus Vercel plus pg_cron at scale. Watch the Supavisor client counts and keep n8n Postgres credentials at max 5 connections.
- **Review-queue flood:** new competitors bring many new brands and agencies. Raise the priority of `item_low_confidence` tasks for pilot-tier competitors, and batch-approve obvious aliases. Analysts should know before the waves start.
- **Instagram blocking at higher volume:** spread the runs (10 accounts per platform per hour for backfill), keep the daily runs batched, watch for actor errors, and fall back per SCRAPING_SOURCES.
- **LinkedIn employees cost** scales the most (SCRAPING_SOURCES §8). Apply M12's chosen cap or cadence before the waves.
- **YouTube quota:** 10,000 units per day is ample (about 2 units per channel per day), but a backfill of channels with many videos uses ≈ 1 unit per 50 videos. Fine; monitor it anyway.
- **Website diffs at scale:** about 260 Firecrawl maps per day. Check the plan's credit limits (MA-15).
- **Prod writes:** wave activation and settings changes happen only via audited admin RPCs, after approval.
- **Restore drill** must not touch prod data. Use a separate project or branch.

## 13. Cost & budget notes

- **Backfill for the remaining 234** (scraping, SCRAPING_SOURCES §8): ≈ $290–330. OpenAI for backfill items is on top; use M12's measured cost per item, roughly halved with the Batch API. Re-estimate per wave with M12's measured volumes.
- **Steady state at full scale:**
  - scraping ≈ **$12.4/day** (SCRAPING_SOURCES §8), dominated by LinkedIn employees;
  - plus OpenAI (measured items per day × cost per item);
  - plus SerpAPI ≈ $1.3/day;
  - plus fixed fees (n8n, Supabase Pro, Vercel, SerpAPI and Firecrawl plans).
- **Budget brake:** `daily_budget_usd` = wave estimate × 1.3 on wave days, then the approved steady-state value (M12). The budget alert (M13) emails the owner.
- **Possible add-ons** (owner approval): Supabase PITR, Vercel Analytics or Speed Insights, a larger Supabase compute size if CPU stays above 70% during waves.

## 14. Definition of done & hand-off

**Done when:**
- AC1–AC10 pass with evidence.
- PR `m15-scale-launch` is merged and CI is green.
- Prod is live at full scale with 7 clean days.
- The owner has signed off.
- The root `PROGRESS.md` shows all milestones `Done`, with the launch date.

**Hand-off: the post-launch operating mode.**
- The owner maintains the system using `docs/RUNBOOK.md`.
- Codex sessions after launch start from the root PROGRESS.md "Post-launch backlog" and open a new milestone folder (`milestones/M16-<slug>/`) per backlog item, using the same templates and rules.
