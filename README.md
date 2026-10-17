# everyone. Market Radar

The internal market-intelligence system for everyone. (Everyone Films). The planned system collects public competitor content, uses OpenAI to identify brands, agencies, credits and campaigns, and serves the results to the team through a web app and to AI agents through REST and MCP.

**M00: repository bootstrap and tooling is complete.** M01 has not started and awaits a new owner instruction. The current app is the everyone. / Market Radar placeholder. Collectors, Supabase, authentication and product screens arrive in later milestones. Read [PROGRESS.md](PROGRESS.md) for current checks, owner actions and hosted acceptance. Toolchain choices and the outstanding dependency advisory are recorded in [M00 toolchain evidence](milestones/M00-repo-bootstrap/evidence/toolchain.md).

Owner: Mohamed Abdelrahman · mohamed.abdelrahman@everyone.film · Created 17 Oct 2026.

## Local development

Use **Node 24 LTS**, Corepack and **pnpm 10.34.7**, pinned in `package.json`. Docker is needed from M01 for local Supabase. No `.env` file or service credentials are required for the M00 placeholder or its tests.

From the repository root:

```sh
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

The version check should print `10.34.7`. Open [http://localhost:3000](http://localhost:3000). Existing checkouts use the committed lockfile; do not rerun the app scaffold.

Commands below use `pnpm` as shorthand for `corepack pnpm`. On Windows, keep using `corepack pnpm` if PowerShell blocks `pnpm.ps1`; an installed `pnpm.cmd` also works after checking its version matches the pin. No shell execution policy change is needed.

Before the first browser test run, install Chromium:

```sh
corepack pnpm --filter web exec playwright install chromium
corepack pnpm test:e2e
```

CI also installs the browser's Linux dependencies. Browser tests build the app and start a fresh production server on port 3000; stop an existing local server on that port before running them.

## Commands

| Command              | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`           | Run the Next.js development server                                                   |
| `pnpm build`         | Build workspace packages, including the web app                                      |
| `pnpm lint`          | Lint application, shared, helper and tooling source                                  |
| `pnpm typecheck`     | Check strict TypeScript across packages and root tooling                             |
| `pnpm test`          | Run all Vitest projects, including plain-JS n8n helpers                              |
| `pnpm test:e2e`      | Run Chromium smoke and accessibility checks against a fresh build                    |
| `pnpm format`        | Format maintained source using the preservation exclusions in `.prettierignore`      |
| `pnpm format:check`  | Check formatting with the same exclusions                                            |
| `pnpm check:secrets` | Scan tracked/indexed files for targeted credential patterns without printing matches |

Dependency lifecycle scripts are blocked by the checked-in install policy. Run project commands explicitly; do not broadly approve dependency scripts. Focused unit runs include `pnpm test --project shared` and `pnpm test --project normalizers`.

## Workspace map

```text
apps/web/          Next.js App Router placeholder, unit tests and Playwright
packages/shared/  Zod environment helper, slug rules and future database types
supabase/         M01 database foundation placeholder
n8n/              Common helper tests; workflows and actor fixtures from M03–M06
scripts/          Repository checks; seed and evaluation tooling in later milestones
.github/          CI, dependency updates and pull request template
.agents/          Pinned project-local skills, policies and provenance
docs/             Binding decisions and system specifications
milestones/       M00–M15 scope, progress, acceptance evidence and handoffs
data/             Seed data and account references
reference/        SQL drafts, schemas, prompts and source research
assets/brand/     Canonical Everyone assets and tokens
templates/        Environment names and progress template
```

## How to use this pack

1. The handoff pack lives at the root of [Everyone-Market-Researcher](https://github.com/muhhammeddsayedd-prog/Everyone-Market-Researcher). Keep its paths intact and read [AGENTS.md](AGENTS.md) first.
2. Continue from root `PROGRESS.md`, then read the current milestone's `MILESTONE.md` and `PROGRESS.md`. A useful Codex instruction is: **"Read AGENTS.md and continue the current milestone."**
3. Work one milestone at a time (M00 → M15), following its Next step. Implement, test and make small Conventional Commits on its branch (`m00-bootstrap` for M00); update existing progress records with evidence and blockers.
4. Open a milestone PR into `main`. Merge after the owner's OK and required checks; milestone acceptance also includes its listed manual and hosted gates. Do not commit development work directly to `main`.
5. The owner checks root `PROGRESS.md` for status. Anything needed from the owner appears under **"Manual actions needed"** in the current milestone's `PROGRESS.md`, using the IDs in [docs/MANUAL_ACTIONS.md](docs/MANUAL_ACTIONS.md).

Binding decisions live in `docs/DECISIONS.md`; specific specifications take precedence over general ones. Record deviations and follow the existing production, paid-run and milestone gates in `AGENTS.md`.

## What's inside

| Path                                            | What it is                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                     | Codex's operating manual: read order, working loop, hard rules                                                               |
| `PROGRESS.md`                                   | Project board: current milestone, status, blockers, key dates                                                                |
| `DESIGN.md`                                     | UI design system and screen-by-screen specs for the web app                                                                  |
| `docs/PRD.md`                                   | Product requirements: users, scope, functional and non-functional requirements, metrics                                      |
| `docs/TECHNICAL.md`                             | Architecture, stack, pipeline, security, caching, CI/CD, conventions                                                         |
| `docs/DATA_SCHEMA.md`                           | Database design: schemas, tables, RLS, RPC catalog, seed plan                                                                |
| `docs/SCRAPING_SOURCES.md`                      | Per-platform sources, approved actors, input JSON, field mappings, costs                                                     |
| `docs/N8N_WORKFLOWS.md`                         | Every n8n workflow, node by node, with schedules and execution budget                                                        |
| `docs/AI_PIPELINE.md`                           | Extraction, entity resolution, vision, embeddings, campaign linker, briefs, eval                                             |
| `docs/API_SPEC.md`                              | REST API and MCP tools for agents                                                                                            |
| `docs/DESIGN_STYLE.md`                          | Brand style guide extracted from everyone.film                                                                               |
| `docs/TAXONOMIES.md`                            | Industries, formats, occasions, categories, credit roles, capabilities                                                       |
| `docs/ENVIRONMENT.md`                           | Accounts, env vars, credentials, secret handling                                                                             |
| `docs/TESTING.md`                               | Test layers, fixtures, rules                                                                                                 |
| `docs/DEVELOPMENT_PLAN.md`                      | Milestones, order, gates, effort, definition of done                                                                         |
| `docs/DECISIONS.md`                             | Binding decision log (product + technical)                                                                                   |
| `docs/OPEN_QUESTIONS.md`                        | Unanswered questions, with the default Codex uses meanwhile                                                                  |
| `docs/MANUAL_ACTIONS.md`                        | Everything only the owner can do (MA-01 … MA-28)                                                                             |
| `milestones/M00…M15/`                           | One folder per milestone: `MILESTONE.md` (full context + tasks + acceptance criteria) and `PROGRESS.md` (Codex's live notes) |
| `reference/sql/`                                | Draft SQL for the whole database (migrations are made from it in M01)                                                        |
| `reference/json-schemas/`, `reference/prompts/` | AI output schemas and prompts (versioned)                                                                                    |
| `reference/n8n/`                                | Normalized item contract shared by all collectors                                                                            |
| `reference/apify_actor_research_2026-10-17.md`  | Verified inputs, outputs and prices of the approved Apify actors and official APIs                                           |
| `reference/taxonomies.json`                     | Taxonomies as JSON                                                                                                           |
| `data/`                                         | Seed data from the competitor sheet: 285 competitors, 1,272 accounts, pilot 50, test accounts                                |
| `assets/brand/`                                 | everyone. logotype (SVG), wordmark (PNG), menu-dots icon, design tokens (CSS/JSON)                                           |
| `templates/`                                    | `.env.example`, milestone PROGRESS template                                                                                  |

## The system in one picture

This is the target architecture. M00 supplies the placeholder and development tooling; collection and service paths below are implemented later.

```
Vimeo · Instagram · Websites · LinkedIn · YouTube · (weekly) News & awards
            │  Apify approved actors · Vimeo/YouTube APIs · Firecrawl · SerpAPI
            ▼
        n8n Cloud ── collectors → RPC (n8n_writer) → Supabase ingest → only-new → AI queue
            │                                              │
            └── AI worker (OpenAI) → entities, campaigns, embeddings → Supabase app
                                                           │
                         Vercel: Next.js web app · REST /api/v1 · MCP /api/mcp
                                                           │
                         Team (Google sign-in) · AI agents (scoped keys) · Email digests & briefs
```

## Milestones at a glance

|     | Milestone                                  |     | Milestone                          |
| --- | ------------------------------------------ | --- | ---------------------------------- |
| M00 | Repo bootstrap & tooling                   | M08 | Campaign linker + **pilot launch** |
| M01 | Supabase foundation                        | M09 | Web app foundation                 |
| M02 | Seed data & account resolution             | M10 | Web app entities                   |
| M03 | n8n foundation                             | M11 | Search, review, admin              |
| M04 | Collectors I: Vimeo + Instagram            | M12 | **Pilot review & go/no-go**        |
| M05 | Collectors II: Websites, YouTube, LinkedIn | M13 | News, briefs, alerts               |
| M06 | Collectors III: Stories + upkeep           | M14 | Agent API + MCP                    |
| M07 | AI understanding                           | M15 | Scale to 284 & launch              |
