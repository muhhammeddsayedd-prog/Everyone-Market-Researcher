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

- Work **one milestone at a time, in order** (M00 → M15). The only exception is when the root board marks a milestone `Parallel-OK`.
- For each task in `MILESTONE.md`:
  1. Implement it.
  2. Run its tests.
  3. Commit (Conventional Commits).
  4. Tick it in `PROGRESS.md`.
  5. Add a dated log line: what changed, which files, the test result.
- Update `PROGRESS.md` **before you stop for any reason**: end of session, blocked, or context running out. The next session (maybe a fresh one) must be able to continue from it alone.
- Within the active milestone, the owner's development authorization persists until completion or revocation. Implement, test, debug, make scoped commits, update the milestone PR, deploy protected dev previews, configure owned dev resources and finish already-approved integration work without ordinary step-by-step approvals. M03 A–D retains its existing cumulative scope and limits; this does not replenish them.
- Technical timeouts, shutdown reserves and provider expiry still apply. After a safely closed attempt, reconcile actual side effects and counters, repair the defect and continue the incomplete step. Do not reopen closed windows, reuse spent mutation claims, overlap uncertain work or blindly repeat a paid start. A local lease/window expiry, consumed runtime copy, session resume, ordinary failure or tested source-hash change alone is not an owner-approval gate.
- Reuse native integrations and persistent CurrentUser-DPAPI development entries outside Git at `%LOCALAPPDATA%\Everyone-Market-Radar-Private\secrets\dev\`, restricted to the intended Windows account and SYSTEM. Keep encrypted originals across attempts/sessions; automatically create narrowly scoped disposable copies only where existing consumers need them, then delete those copies and scratch after their children close. Administrative credentials stay in the separate bounded administrative path, never n8n or web runtime. No persistent entry has an artificial two-hour expiry.
- When something needs the owner:
  1. Add it to the milestone's `PROGRESS.md` under "Manual actions needed" with exact click-by-click steps and why it's needed. Reuse the matching ID from `docs/MANUAL_ACTIONS.md`.
  2. Keep doing every task that doesn't depend on it.
  3. If nothing else can proceed, set the status to `Blocked: waiting on owner — MA-xx`.
- Ask only for genuinely missing/revoked credentials, required MFA/consent, enforced permission changes, exhausted approved limits, consequential unresolved decisions, unsafe ambiguous side effects, production/destructive work, shared credential rotation, external messaging or unapproved recurring activity. Request genuinely missing inputs together through one hidden-prompt initialization/update interface; never request values in chat or extract unrelated saved secrets.
- One coordinator owns hosted writes. Reuse existing helpers and targeted reviewers; locally test syntax, native contracts and error handling before real credential use. Preserve historical evidence and batch documentation with meaningful changes; do not add replacement-window script families or CI-announcement-only commits.
- For M03, use the six functional acceptance checks and the one-time AC1–AC12 mapping in `milestones/M03-n8n-foundation/MILESTONE.md` §9. Freeze expansion of the custom supervisor, credential and acceptance frameworks. Keep required tests, branch protection, critical security/data-integrity checks and cumulative limits; do not make verifier-only conditions additional delivery gates. Manual native evidence is acceptable when its identity, scope, result and limitations are recorded honestly.
- After two failed repair cycles for the same testing-tool defect, use a supported alternative or report one precise boundary. Do not build another verifier or retry a rejected action through another route. An enforced platform block remains binding; unperformed checks stay unperformed.
- The owner permits one isolated frontend/app-shell or read-only directory slice in parallel with remaining M03 acceptance, using stable contracts and clearly labeled fixtures, with no hosted writes. This bounded exception does not start M04, M09 or M10, and does not turn fixture data into live acceptance. PR merge and advancement to the next milestone still need their separate owner decisions.
- When all acceptance criteria pass:
  1. Paste the evidence.
  2. Fill in "Hand-off to next milestone".
  3. Set the status to `Done`.
  4. Update the root `PROGRESS.md` board.
  5. Open a PR `m{NN}-{slug}` → `main`.

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
8. **Production needs the owner's go-ahead.** Apply migrations to prod, switch on prod schedules or start a paid backfill only in the milestones that say so, after the owner approves in `PROGRESS.md`.
9. **Estimate before you spend.** Before any backfill or bulk run, post the estimated items and USD cost (from `ops.price_book`) and wait for approval.
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

The owner's 23 October 2026 development-autonomy reset supersedes older project-level disposable-secret and repeated time-only approval requirements. The 25 October M03 functional-acceptance reset replaces the project-level closure conditions identified in the milestone's AC mapping; it does not mark unverified work complete or disable existing required checks. Neither reset overrides enforced platform/organization controls, actual provider expiry, production boundaries or spending limits. Production credentials are excluded from the default dev profile. The unrelated private R2 incident and PR merge decisions remain separate; M04 must not start before the owner's next instruction.

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
- If it is expensive or irreversible (cost, data loss, prod, scope), ask the owner via "Manual actions needed" and continue with other tasks.

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
