# everyone. Market Radar — development handoff pack

This folder is everything Codex needs to build **everyone. Market Radar**: the competitor-intelligence system for everyone. (Everyone Films).
- **What it does:** it tracks what 284 production houses in Egypt, KSA and the UAE publish every day on Vimeo, Instagram, their websites, LinkedIn and YouTube. AI identifies the brand, agency, credits and campaign for each item.
- **Who it's for:** the team, who read it in a web app, and AI agents, who query it through a REST API and an MCP server.

Owner: Mohamed Abdelrahman · mohamed.abdelrahman@everyone.film · Created 17 Oct 2026.

## How to use this pack

1. Copy the whole folder into the root of the GitHub repo `muhhammeddsayedd-prog/Everyone-Market-Researcher` and commit it to `main`. M00 also does this if you'd rather have Codex do it.
2. Point Codex at the repo and say: **"Read AGENTS.md and start the current milestone."**
3. Codex works milestone by milestone (M00 → M15). After every task it updates the milestone's `PROGRESS.md` and the board in the root `PROGRESS.md`.
4. Check the root `PROGRESS.md` to see where things stand. Anything Codex needs from you shows up under **"Manual actions needed"** in the current milestone's `PROGRESS.md`. The full list is in `docs/MANUAL_ACTIONS.md`.

## What's inside

| Path | What it is |
|---|---|
| `AGENTS.md` | Codex's operating manual: read order, working loop, hard rules |
| `PROGRESS.md` | Project board: current milestone, status, blockers, key dates |
| `DESIGN.md` | UI design system and screen-by-screen specs for the web app |
| `docs/PRD.md` | Product requirements: users, scope, functional and non-functional requirements, metrics |
| `docs/TECHNICAL.md` | Architecture, stack, pipeline, security, caching, CI/CD, conventions |
| `docs/DATA_SCHEMA.md` | Database design: schemas, tables, RLS, RPC catalog, seed plan |
| `docs/SCRAPING_SOURCES.md` | Per-platform sources, approved actors, input JSON, field mappings, costs |
| `docs/N8N_WORKFLOWS.md` | Every n8n workflow, node by node, with schedules and execution budget |
| `docs/AI_PIPELINE.md` | Extraction, entity resolution, vision, embeddings, campaign linker, briefs, eval |
| `docs/API_SPEC.md` | REST API and MCP tools for agents |
| `docs/DESIGN_STYLE.md` | Brand style guide extracted from everyone.film |
| `docs/TAXONOMIES.md` | Industries, formats, occasions, categories, credit roles, capabilities |
| `docs/ENVIRONMENT.md` | Accounts, env vars, credentials, secret handling |
| `docs/TESTING.md` | Test layers, fixtures, rules |
| `docs/DEVELOPMENT_PLAN.md` | Milestones, order, gates, effort, definition of done |
| `docs/DECISIONS.md` | Binding decision log (product + technical) |
| `docs/OPEN_QUESTIONS.md` | Unanswered questions, with the default Codex uses meanwhile |
| `docs/MANUAL_ACTIONS.md` | Everything only the owner can do (MA-01 … MA-28) |
| `milestones/M00…M15/` | One folder per milestone: `MILESTONE.md` (full context + tasks + acceptance criteria) and `PROGRESS.md` (Codex's live notes) |
| `reference/sql/` | Draft SQL for the whole database (migrations are made from it in M01) |
| `reference/json-schemas/`, `reference/prompts/` | AI output schemas and prompts (versioned) |
| `reference/n8n/` | Normalized item contract shared by all collectors |
| `reference/apify_actor_research_2026-10-17.md` | Verified inputs, outputs and prices of the approved Apify actors and official APIs |
| `reference/taxonomies.json` | Taxonomies as JSON |
| `data/` | Seed data from the competitor sheet: 285 competitors, 1,272 accounts, pilot 50, test accounts |
| `assets/brand/` | everyone. logotype (SVG), wordmark (PNG), menu-dots icon, design tokens (CSS/JSON) |
| `templates/` | `.env.example`, milestone PROGRESS template |

## The system in one picture

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

| | Milestone | | Milestone |
|---|---|---|---|
| M00 | Repo bootstrap & tooling | M08 | Campaign linker + **pilot launch** |
| M01 | Supabase foundation | M09 | Web app foundation |
| M02 | Seed data & account resolution | M10 | Web app entities |
| M03 | n8n foundation | M11 | Search, review, admin |
| M04 | Collectors I: Vimeo + Instagram | M12 | **Pilot review & go/no-go** |
| M05 | Collectors II: Websites, YouTube, LinkedIn | M13 | News, briefs, alerts |
| M06 | Collectors III: Stories + upkeep | M14 | Agent API + MCP |
| M07 | AI understanding | M15 | Scale to 284 & launch |
