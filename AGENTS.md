# AGENTS.md — operating manual for Codex

You are building **everyone. Market Radar**, the internal market-intelligence system for everyone. (Everyone Films). The system has three parts:
- **n8n Cloud** collects public competitor content daily (Vimeo, Instagram, websites, LinkedIn, YouTube, plus weekly news and awards).
- **OpenAI** structures that content.
- **Supabase** stores it. A **Next.js app on Vercel** with a REST API and an MCP server serves it to the team and to AI agents.

Owner and approver: **Mohamed Abdelrahman** (mohamed.abdelrahman@everyone.film).

## 1. Start of every session (always, in this order)

1. Read this file.
2. Read the root `PROGRESS.md`. It says which milestone is current and what happened last.
3. Open the current milestone folder `milestones/Mxx-*/` and read `MILESTONE.md` (the full context for this milestone), then `PROGRESS.md` (your own notes: status, blockers, manual actions, next step).
4. Check the blockers and manual actions. If the owner has ticked one, verify it (for example, test the credential), then log it.
5. Continue from **Next step** in that `PROGRESS.md`.

## 2. The working loop

- Work **one milestone at a time, in order** (M00 → M15), subject to the owner's development-acceptance sequencing in `docs/DECISIONS.md`. Essential development acceptance with concrete dependencies satisfied permits the next planned milestone's local branch and draft PR while explicitly tracked coverage/rollout obligations remain open. This does not require editing the protected stale root/M03 board or authorize merge/production.
- For each task in `MILESTONE.md`:
  1. Implement it.
  2. Run its tests.
  3. Commit (Conventional Commits).
  4. Tick it in `PROGRESS.md`.
  5. Add a dated log line: what changed, which files, the test result.
- Update `PROGRESS.md` **before you stop for any reason**: end of session, blocked, or context running out. The next session (maybe a fresh one) must be able to continue from it alone.
- Within the active milestone, the owner's development authorization persists until completion or revocation. Implement, test, debug, make scoped commits, update the milestone PR, deploy protected dev previews, configure owned dev resources and finish already-approved integration work without ordinary step-by-step approvals. Preserve historical M03 A–D attempts, closed work and cumulative charges; the standing development-spending decision below governs authorized new development work and does not reopen M03.
- Technical timeouts, shutdown reserves and provider expiry still apply. After a safely closed attempt, reconcile actual side effects and counters, repair the defect and continue the incomplete step. Do not reopen closed windows, reuse spent mutation claims, overlap uncertain work or blindly repeat a paid start. A local lease/window expiry, consumed runtime copy, session resume, ordinary failure or tested source-hash change alone is not an owner-approval gate.
- Reuse native integrations and persistent CurrentUser-DPAPI development entries outside Git at `%LOCALAPPDATA%\Everyone-Market-Radar-Private\secrets\dev\`, restricted to the intended Windows account and SYSTEM. Keep encrypted originals across attempts/sessions; automatically create narrowly scoped disposable copies only where existing consumers need them, then delete those copies and scratch after their children close. Administrative credentials stay in the separate bounded administrative path, never n8n or web runtime. No persistent entry has an artificial two-hour expiry.
- When something needs the owner:
  1. Add it to the milestone's `PROGRESS.md` under "Manual actions needed" with exact click-by-click steps and why it's needed. Reuse the matching ID from `docs/MANUAL_ACTIONS.md`.
  2. Keep doing every task that doesn't depend on it.
  3. If nothing else can proceed, set the status to `Blocked: waiting on owner — MA-xx`.
- Ask only for genuinely missing/revoked credentials, required MFA/consent, enforced permission changes or provider restrictions, consequential unresolved decisions, unsafe ambiguous side effects, production/destructive work, shared credential rotation, external messaging or unapproved recurring activity. Project-owner development monetary, actor-start and API/control/management request estimates are not repeated approval gates. Request genuinely missing inputs together through one hidden-prompt initialization/update interface; never request values in chat or extract unrelated saved secrets.
- One coordinator owns hosted writes. Reuse existing helpers and targeted reviewers; locally test syntax, native contracts and error handling before real credential use. Preserve historical evidence and batch documentation with meaningful changes; do not add replacement-window script families or CI-announcement-only commits.
- For M03, use the six functional acceptance checks and the one-time AC1–AC12 mapping in `milestones/M03-n8n-foundation/MILESTONE.md` §9. Freeze expansion of the custom supervisor, credential and acceptance frameworks. Keep required tests, branch protection, critical security/data-integrity checks and cumulative limits; do not make verifier-only conditions additional delivery gates. Manual native evidence is acceptable when its identity, scope, result and limitations are recorded honestly.
- After two failed repair cycles for the same testing-tool defect, use a supported alternative or report one precise boundary. Do not build another verifier or retry a rejected action through another route. An enforced platform block remains binding; unperformed checks stay unperformed.
- The owner permitted one isolated frontend/app-shell or read-only directory slice in parallel with remaining M03 acceptance, using stable contracts and clearly labeled fixtures, with no hosted writes. That historical exception did not start M04, M09 or M10 or turn fixture data into live acceptance. Current development sequencing follows the dated owner decisions; PR merge remains separate.
- When all acceptance criteria pass:
  1. Paste the evidence.
  2. Fill in "Hand-off to next milestone".
  3. Set the status to `Done`.
  4. Update the root `PROGRESS.md` board.
  5. Open a PR `m{NN}-{slug}` → `main`.

For the owner's 28 October 2026 exception, distinguish **M04 development accepted; coverage and rollout obligations open** from the original full milestone Done, production readiness and merge. That accepted result remains closed. M05 proceeds on its separate branch from the accepted CI-green M04 head, with a stacked draft PR targeting the M04 branch while PR13 remains draft/unmerged; keep M05 changes out of PR13. The later standing development-spending decision expressly authorizes the existing M05 representative dev migration/setup/collection and temporary default-bypass scope after corrections, tests, required CI and preflight. Production, recurring activation, notifications and PR merges remain separate. The current M04 records are authoritative while protected root/M03 pointers remain stale.

The [28 October standing development-spending decision](docs/DECISIONS.md#standing-development-spending-and-essential-acceptance--28-october-2026) has no fixed project-owner monetary ceiling for reasonably necessary implementation, debugging, testing and verification of agreed milestones. Estimate and report usage; autonomously choose or adjust finite development runtime, retries, pagination, output, charge options, actor-start and request allowances. Adjust validated settings only for subsequent launches: authentic permits, server configuration, recorded allocations and actual provider acknowledgements must agree. Preserve admitted settings until their work is reconciled, retain every historical charge/counter, and never replace an uncertain paid start blindly. Each paid test must answer a concrete question or verify a fix; stop once sufficient evidence exists. Existing services/billing only: no new subscription, plan upgrade or provider billing-control change is authorized.

This policy does not override an enforced denial. The denied correction targeting `n8n/collectors/build-native-m05-callback.mjs`, the M05 `PROGRESS.md` and its `evidence/live-dev-packet-20261028.md` remains unperformed; do not recreate it through another file, helper or tool. Use a supported narrow review/permission path for a blocked action and continue independent permitted work.

## 3. Where the truth lives

| Need | File |
|---|---|
| What is decided (binding) | `docs/DECISIONS.md` |
| What to build and why | `docs/PRD.md` |
| How it fits together | `docs/TECHNICAL.md` |
| Database | `docs/DATA_SCHEMA.md` + draft SQL `reference/sql/` |
| Sources, actors, inputs and outputs | `docs/SCRAPING_SOURCES.md` + `reference/apify_actor_research_2026-10-17.md` |
| n8n workflows | `docs/N8N_WORKFLOWS.md` |
| AI extraction, linking, briefs | `docs/AI_PIPELINE.md` + `reference/json-schemas/` + `reference/prompts/` |
| REST API and MCP | `docs/API_SPEC.md` |
| UI design system and screens | `DESIGN.md` + `docs/DESIGN_STYLE.md` + `assets/brand/` |
| Taxonomies | `docs/TAXONOMIES.md` |
| Env vars, accounts, secrets | `docs/ENVIRONMENT.md` + `templates/.env.example` |
| Tests | `docs/TESTING.md` |
| The owner's to-dos | `docs/MANUAL_ACTIONS.md` |
| Unanswered questions and defaults | `docs/OPEN_QUESTIONS.md` |
| Plan and milestone order | `docs/DEVELOPMENT_PLAN.md` |
| Seed data | `data/` |

If two documents disagree:
- `DECISIONS.md` wins over everything else.
- After that, the more specific document wins over the more general one (`DATA_SCHEMA.md` over `TECHNICAL.md`, and so on).
- Note the conflict in `PROGRESS.md` and fix the losing document.

## 4. Hard rules (never break)

1. **Public data only.** Never use logins, cookies, session accounts or private APIs. Never bypass a CAPTCHA or paywall. If an actor needs a login, disable that source and tell the owner.
2. **Approved tools only.** Use only the Apify actors listed in `docs/DECISIONS.md` T-08, plus the official Vimeo and YouTube APIs, Firecrawl and SerpAPI. A new actor needs the owner's approval first.
3. **Out of scope stays out:** ad libraries, LinkedIn job postings, TikTok, Facebook, Behance, X and other platforms, video downloads and transcription.
4. **No secrets in the repo.** Never commit `.env`, keys, passwords or n8n exports that contain credentials. Never put secrets in `NEXT_PUBLIC_*`. Never print secrets in logs or PROGRESS files.
5. **Least privilege.**
   - n8n writes only through RPCs as `n8n_writer`.
   - Agents read only through the `api_agent` role.
   - The Supabase secret key is used only in `/api/internal/media-upload-url` and in owner-run seed scripts.
6. **RLS on every table**, with tests. Views use `security_invoker = true`. `SECURITY DEFINER` is allowed only in non-exposed schemas, with `search_path = ''` and EXECUTE revoked from PUBLIC.
7. **Never delete collected data.** Mark it `removed`. Never overwrite fields a human corrected (`locked_fields`, `locked_by_human`).
8. **Production needs the owner's go-ahead.** Apply migrations to prod, switch on prod schedules or start a paid production backfill only in the milestones that say so, after the owner approves in the permitted current record.
9. **Estimate and account for spending.** Estimate items/provider usage/USD from current source pricing and `ops.price_book` before development backfill or bulk tests; report actual usage and deviations. The standing owner policy authorizes reasonably necessary agreed development spending without another financial approval, including adjusted per-run/start/request allowances. Exceeding an estimate alone is not a stop. Keep finite appropriate operational bounds, real provider restrictions, security/data-integrity stops, existing billing controls and the separate production/scope gates intact.
10. **Verify before you build.** Libraries, Supabase features, n8n nodes and actor inputs change. Check the current docs:
    - Supabase changelog: `https://supabase.com/changelog.md`; any docs page also works with `.md` appended.
    - Next.js docs.
    - n8n docs.
    - The actor's Apify page.

    Record any deviation from the specs.
11. **Supabase migrations:**
    - Create files with `supabase migration new <name>`; never hand-name them.
    - Run `supabase db advisors` (or MCP `get_advisors`) and fix the findings before committing.
    - Regenerate the types after every migration.
12. **Idempotency:** re-running any job on the same window must not duplicate rows or re-run AI.

The owner's 23 October 2026 development-autonomy reset supersedes older project-level disposable-secret and repeated time-only approval requirements. The 25 October M03 functional-acceptance reset replaces the project-level closure conditions identified in the milestone's AC mapping; it does not mark unverified work complete or disable existing required checks. The 28 October decisions separate development acceptance from open coverage/rollout obligations and supersede older project-owner development financial/start/request approval gates. None overrides enforced platform/organization controls, actual provider expiry or quotas, production boundaries or billing controls. Production credentials are excluded from the default dev profile. The unrelated private R2 incident and PR merge decisions remain separate.

## 5. Tools you may use

- **GitHub:** branches and PRs.
- **Supabase CLI and Supabase MCP**, with the owner's **scoped** token. Use the dev project by default.
- **n8n MCP**, connected by the owner, to create, update and run workflows. Export each workflow's JSON to `n8n/workflows/` after changing it.
- **Vercel:** Git integration and the owner's existing authorized native CLI session. Request private sign-in only when actually required; do not manipulate OAuth caches or create replacement tokens merely to resume development.
- **Local:** pnpm, Node 24, Docker (for `supabase start`) and Playwright.

## 6. Conventions

- **Monorepo:** `apps/web`, `packages/shared`, `supabase/`, `n8n/`, `scripts/`, `docs/`, `milestones/`.
- **TypeScript:** strict mode. Validate every boundary with zod.
- **SQL:** lowercase `snake_case`, `timestamptz`, indexed foreign keys, keyset pagination.
- **Commits and branches:** Conventional Commits; one branch per milestone, `m{NN}-{slug}`; small commits.
- **Writing:** plain English in docs and PROGRESS files. The owner reads them on a phone between meetings, so say what happened, what's next and what you need.

## 7. If you are unsure

- Check `docs/OPEN_QUESTIONS.md` for a default, use it, and log that you did.
- If there is no default and the choice is cheap to reverse, pick the conventional option and log it under "Decisions & deviations".
- For irreversible data loss, production, unapproved scope or another consequential unresolved decision, ask the owner via "Manual actions needed" and continue with other tasks. Necessary agreed development spending follows the standing policy; cost or an exceeded estimate alone does not require another approval.

## 8. Project-local development skills

The selected upstream skills are installed only in `.agents/skills/`. Read
[the project skill rules](.agents/PROJECT_SKILL_RULES.md) before applying them;
[SKILLS_SETUP.md](SKILLS_SETUP.md) records pins, checks and pending entries.
Existing decisions, milestone scope, design, tests and authorization govern all
generic examples. Select technical skills for the current task and keep the
existing progress records. Spec/constraint authoring and Vercel optimization
are explicit-only. Skill setup does not start application development or grant
permission for a hosted, production or paid action.

For every frontend development or UI review task, load the project-local
`design-taste-frontend` skill alongside `frontend-ui-engineering`, then relevant
React/accessibility guidance. Taste's dashboard mode preserves `DESIGN.md`,
Everyone tokens, the approved stack and project acceptance tests. Its public-page
defaults do not add a new design brief, media downloads or motion requirements.
